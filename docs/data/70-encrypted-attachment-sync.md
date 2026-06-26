# 70 — Encrypted attachment and blob synchronization

This doc covers how Brainstorm replicates **binary attachment bytes** (images, PDFs, video, file uploads) between a user's devices, and how a hosted **blob node** can durably hold those bytes so a device with no local copy can restore them. It builds on [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (DEKs, member wraps, the blind relay), [18-storage-and-search.md](18-storage-and-search.md) (the local `AssetStore` and at-rest sealing), and [20-database-growth-and-sync.md](20-database-growth-and-sync.md) (the Y.Doc sync substrate and selective sync).

It exists because the sync substrate in [20](20-database-growth-and-sync.md) moves **only Y.Docs**. The relay routes per-entity encrypted Yjs envelopes and nothing else. Attachment bytes do not belong in a Y.Doc — a 2 GB video is not a CRDT — so today they have **no path off the device**. A second device sees the `File/v1` entity (it synced as a Y.Doc) but cannot fetch the bytes. This doc designs that second path.

## Two planes, not two products

Brainstorm already has two local data layers ([20](20-database-growth-and-sync.md): Y.Docs vs derived SQLite). Sync adds a third axis: **metadata vs bytes**.

| Plane              | Carries                                              | Unit            | Transport                        | Size      |
|--------------------|-----------------------------------------------------|-----------------|----------------------------------|-----------|
| **Metadata plane** | Entity state, incl. the file *reference* + blob key | Y.Doc / entity  | Relay (pub/sub, [20](20-database-growth-and-sync.md)) | KB        |
| **Blob plane**     | The attachment *bytes*                              | Encrypted blob  | Blob node (request/response)     | MB–GB     |

> **Decision:** attachment bytes sync on a **separate plane** from Y.Docs, with a different transport shape. The metadata plane is publish/subscribe and chatty-small; the blob plane is fetch-by-hash and rare-large. The `File/v1` entity travels on the metadata plane and *points at* a blob; the blob travels on the blob plane only when a device actually needs it.

The two planes share **one identity and one key hierarchy**. A device authorized on an entity (it holds the entity DEK) can decrypt that entity's blob references; the blob node, like the relay, is structurally blind.

## What already exists (the at-rest half)

The encryption and local-storage halves are built. The transport is the missing half.

- **`AssetStore`** (`main/assets/asset-store.ts`) seals every blob with a **fresh per-asset DEK** (XChaCha20-Poly1305, AAD `brainstorm/asset-blob/v1:<assetId>`) and writes ciphertext to `<assetsDir>/<prefix>/<assetId>.enc`. The blob is never written plaintext.
- **Random per-asset keys, deliberately not convergent** (OQ-236): identical plaintext → distinct ciphertext, so a blind relay/node can't learn that two users hold the same file. `content_hash` is a **local-only** plaintext sha256 used as a dedup hint and integrity check — it is never the on-disk filename and **never sent over the wire**.
- **`asset_deks`** (`storage/entities-repo/asset-deks-repo.ts`) wraps each per-asset DEK under the **vault master key**, AAD `brainstorm/asset-dek/v1:`, with a `version` column forward-allocated for rotation.
- Files-app uploads, Books, and bookmark media already route through `AssetStore`; a `File/v1` entity (`{ name, mime, size, assetId, attachment }`) references the asset by `assetId`.

The store's own header says it is built "for blind-sync blobs." This doc cashes that in.

## The one decision the sync transport forces: where the blob DEK lives

Today the per-asset DEK is wrapped under the **vault master key** (`asset_deks`). That is correct for local-at-rest but **cannot sync** — the master key never leaves the device, so a second device could fetch the ciphertext blob and still not open it.

> **Decision:** for a synced attachment, the per-asset DEK is **re-homed into the referencing entity's Y.Doc**, wrapped under that entity's DEK (which is already member-wrapped per [16](../security/16-identity-orgs-encryption.md)). The local `asset_deks` row becomes a **derived cache** of that synced value, not the source of truth.

This nests the existing hierarchy cleanly and inherits all of its properties for free:

```
member wrap        E_alice(entityDEK)         ← per device, on the metadata plane
  └─ entity DEK    Enc(entityDEK, ydoc)        ← entity Y.Doc, syncs via relay
       └─ blob key  { assetId, blobKey, hash } ← a field inside the Y.Doc
            └─ blob  Enc(blobKey, bytes)        ← the blob plane; node sees only this
```

Consequences, all desirable:

- **Sharing comes for free.** Share the entity ([16](../security/16-identity-orgs-encryption.md) member wrap) and the recipient can already decrypt the blob reference, then fetch + open the blob. No separate attachment-ACL.
- **Revocation comes for free.** Removing a member rotates the **entity** DEK; future references re-wrap, and the removed member keeps only historical access — identical to entity-content semantics. The blob node needs no notion of membership.
- **The blob node stays a dumb content store.** It authorizes by sovereign pubkey (like the relay) and stores `hash → ciphertext`. It never holds a key, never holds plaintext, never holds an ACL. "[20](20-database-growth-and-sync.md) / the cloud never holds vault content" remains literally true — it holds ciphertext bytes.

## Content addressing on the wire

The blob node is a **content-addressed store (CAS)**: the address is `hash(ciphertext)`.

> **Decision:** the wire/store address is the hash of the **ciphertext**, computed per blob (and per chunk, below). The existing plaintext `content_hash` stays local-only (OQ-236) — hashing plaintext for addressing would re-leak the equality the random DEK was chosen to hide.

Because the DEK is random per asset, ciphertext addresses are unique per asset, so there is **no cross-user dedup** — by design. Cross-user dedup requires convergent encryption (DEK = hash of plaintext), which leaks file-equality (confirmation-of-file attacks) and was already refused in OQ-236. Within a single vault, dedup-by-plaintext-`content_hash` stays available as a *local* optimization before sealing.

## Chunking and transfer

> **Decision:** blobs are split into fixed-size chunks (default **4 MiB**), each chunk **independently sealed and independently content-addressed**. The blob reference in the Y.Doc carries an ordered manifest of chunk hashes plus the blob key.

Chunking buys three things:

- **Resumable / parallel transfer.** A 2 GB upload that drops at 90% resumes from the last missing chunk; downloads fan out across chunks.
- **Delta re-upload.** Editing a large file re-seals and re-uploads only the changed chunks; unchanged chunks keep their address and are already on the node.
- **Bounded memory.** Seal/open one chunk at a time — never hold a multi-GB plaintext buffer (consistent with the import-walk memory guards in [20](20-database-growth-and-sync.md)).

**Fetch is lazy.** A cold device ([20](20-database-growth-and-sync.md), restore-from-zero) syncs the metadata plane first — every `File/v1` entity appears immediately — and pulls **bytes on access**, not eagerly. This mirrors the selective-sync tiers in [20](20-database-growth-and-sync.md) (pinned / active / reachable / on-demand): a blob is `on-demand` until something opens it, then it materializes with a brief loading state. A small **eager tier** for thumbnails/preview-size derivatives keeps galleries from rendering empty; previews are themselves assets (their own blob keys), so they ride the same machinery.

## The asset CAS — not a new node

The byte-plane store is **not a new service**: it is the existing `brainstorm-sync` durable node (which already shipped `SYNC-0`–`SYNC-5`: forward relay → storage-backed snapshot+tail → object-store backend → entitlement-gated admission → ops) extended with a **content-addressed asset store (CAS)** behind the same `SnapshotStore` seam that `SYNC-2` introduced. The Y.Doc plane uses the per-entity snapshot+tail layout; the asset plane adds an opaque-chunk-by-ciphertext-hash layout next to it. Same node, same admission, same relay-blind invariant.

- **Interface:** `PUT hash → ciphertext-chunk`, `GET hash → ciphertext-chunk`, `HAS hash` (so a client skips already-present chunks before uploading). No pub/sub — distinct from the Y.Doc control channel.
- **Zero-knowledge:** stores ciphertext keyed by ciphertext-hash; admission is the same `SYNC-4` two-proof handshake (entitlement token + device-signed nonce); the route path stays crypto-free (relay-blind, CI-fenced). It cannot decrypt.
- **Operator:** the managed bucket (R2/S3 via the `SYNC-3` `ObjectBucket` adapter) is the default, metered tier; a **self-hosted** node (`STORAGE_DIR` / bring-your-own-bucket) is the sovereignty escape hatch — identical to how the Y.Doc plane already selects forward-only / local / s3 from env.
- **Not authoritative.** Like the relay, it is a durable cache of bytes the device already authored, never a source of truth that can mutate content. Losing the node loses durability, never integrity. `.bsbundle` export remains the local-only backup.

## Garbage collection — the actually-hard part

Storing and fetching encrypted chunks is the easy 80%. Reclaiming them safely across offline devices is where this design earns its keep.

A blob is dead when **no live `File/v1` reference** points at its `assetId` anywhere in the vault. Locally this is already solved: [18](18-storage-and-search.md)/[20](20-database-growth-and-sync.md) reference-count content-addressed blobs by entity-property scan and GC weekly (OQ-43). The new problem is the **node**, where references live across devices that may be offline:

- An offline laptop may still reference a blob the phone just "deleted." If the node reclaims it, the laptop's file is gone forever on next sync.
- CRDT deletes are tombstones that converge eventually, so "no peer references this" is never instantaneously knowable.

> **Decision (proposed):** the node never GCs on a single device's say-so. Reclamation is **conservative mark-and-sweep against the converged metadata state**, gated by: (1) a grace period after a chunk's last reference is tombstoned; (2) a **last-seen guard** — do not reclaim chunks referenceable by any device that has synced within a retention window (default 90 days, matching the tail-prune policy in OQ-46); (3) reclamation is reversible within the grace window (mark, don't immediately delete). Surfacing GC activity (the silent-vs-visible question) inherits OQ-43.

This is the design risk to socialize before implementation — not the crypto, which is settled.

## Recovery — phrase-only, end to end

Account recovery is **recovery-phrase-only** (no key escrow; consistent with the sovereign-pubkey identity in [16](../security/16-identity-orgs-encryption.md) and account recovery in [51](../security/51-account-recovery-and-web-auth.md)). The blob plane requires nothing extra, because every blob key chains back to the vault root the phrase derives:

```
recovery phrase → vault master key → decrypt member wraps → entity DEKs
  → decrypt Y.Docs → blob keys + chunk manifests → GET chunks from node → open bytes
```

A user who lost every device recovers the phrase, syncs the metadata plane, and lazily re-materializes bytes from the node. The corollary is the standard sovereign trade-off: **lose the phrase, lose the data** — the node holds only ciphertext nobody can open. Durable byte storage without phrase custody is durable nothing; the product must make phrase backup unmissable, but that is a [28](../foundations/28-vault-and-onboarding.md)/[51](../security/51-account-recovery-and-web-auth.md) onboarding concern, not a blob-plane one.

## Billing surface

Bytes are where storage cost actually lives — Y.Docs are kilobytes, a media library is gigabytes. The blob node is therefore the natural **metered resource** (cloud-attachment quota by tier, already named in [16](../security/16-identity-orgs-encryption.md) and [20](20-database-growth-and-sync.md)), accounted through the per-device `account.db` and the shell-only `billing.read` capability. Quota is enforced node-side on `PUT` (the node knows ciphertext bytes stored per pubkey without decrypting anything).

## What this subsystem does **not** do

- **Put bytes in Y.Docs.** The metadata plane carries references only.
- **Cross-user dedup.** Refused with convergent encryption (OQ-236); random per-asset keys are the whole point.
- **Let the node read, mutate, or merge content.** It stores and serves ciphertext chunks; all crypto and all merging stay on-device.
- **Hard-delete on one device's command.** Node reclamation is conservative, grace-gated, and last-seen-guarded.
- **Escrow keys for recovery.** Phrase-only; the node holds ciphertext that is worthless without the phrase.

## Open questions

This is the **asset subsystem Part-B sync review**, so the Part-A questions already on file are the spine — plus two genuinely new decisions this design forces.

Already filed (Part A → resolve before/at Part B):

- **OQ-236** ✅ — content-addressing vs blind-relay equality leak: resolved as random per-asset DEK (no convergent encryption); "recorded for the Part-B sync review" — this doc is that review, and confirms the decision (ciphertext-hash addressing keeps the wire blind).
- **OQ-237** — `brainstorm://asset` access enforcement once assets are shared cross-app/cross-member (owner-graph reachability vs signed asset-URL tokens). Gates the `Asset-B7` share fan-out.
- **OQ-238** — separate `assets.bind` capability vs folding bind into `network.preview`. Gates `Asset-B4`.
- **OQ-239** — orphan-asset reap TTL for preview-minted unbound assets (mirror the upload-session reaper). The *local* half of GC; `Asset-B6` extends it to the node.

New, to file via the dev-MCP server (not yet numbered):

- **Asset-DEK re-homing migration** ✅ *(resolved in implementation-plan Asset-B1, 2026-06-26)* — `asset_deks` rows are master-key-wrapped; the open-time pass (`entities/rehome-asset-deks.ts`) re-homes each referenced asset's DEK into the owning entity's Y.Doc under the entity DEK (`brainstorm.meta → assetDeks` map). Idempotent via the `asset_refs.rehomed_at` schema-v7 marker (cf. the 10.x retro-wrap pass); the local `asset_deks` row is **left in place as a derived cache** (not stripped); absent-key pairs defer, non-syncable singletons stamp local-only.
- **Cross-device / offline-peer asset GC** — node-side reclamation grace window + last-seen retention guard (default 90 days, tied to OQ-46), and whether reclamation is surfaced or silent (inherits OQ-43). Gates `Asset-B6`. *The design risk of this whole subsystem.*

Design notes (not OQs): chunk size is fixed 4 MiB for v1 (content-defined chunking is a later delta-dedup optimization behind the same manifest); the eager-vs-lazy derivative tier (which thumbnail/preview size prefetches) is tunable per the selective-sync tiers in [20](20-database-growth-and-sync.md).

## Summary

- Attachment **bytes** sync on a **separate blob plane** from Y.Docs; the metadata plane carries only a reference + the blob key.
- The at-rest half already exists: `AssetStore` seals blobs under **random per-asset DEKs** (not convergent, OQ-236), content-addressed, blind-sync-ready.
- The one new decision the transport forces: **re-home the per-asset DEK from the vault master key into the referencing entity's Y.Doc** (under the entity DEK), making the local `asset_deks` row a derived cache. Sharing and revocation then inherit the [16](../security/16-identity-orgs-encryption.md) member-wrap semantics for free.
- On the wire, blobs are **chunked (4 MiB), each chunk independently sealed and content-addressed by ciphertext-hash**; transfer is resumable, delta-efficient, and **lazily fetched** on access.
- The **blob node** is a zero-knowledge content-addressed store — the byte-plane analogue of the relay; hosted (metered) by default, self-hostable for sovereignty.
- **GC across offline peers is the real risk**: conservative mark-and-sweep against converged state, grace-windowed and last-seen-guarded.
- Recovery is **phrase-only** and chains end-to-end to blob bytes; lose the phrase, lose the data.
