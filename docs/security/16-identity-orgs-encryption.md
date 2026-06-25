# 16 — Identity, organizations, and encryption

This doc reconciles three things that are usually treated separately and end up fighting each other: **identity**, **encryption**, and **collaboration / organizations**. A similar prior local-first knowledge product struggled with the combination — getting end-to-end encryption to coexist gracefully with multi-user collaboration is not a solved problem in the wider industry, and the solutions that exist trade off severely.

This doc lays out the approach. It builds on [02-architecture.md](../foundations/02-architecture.md), [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md), and [09-security-and-sandbox.md](09-security-and-sandbox.md).

## Principles

1. **The local product works without an account.** Always. No account is ever required to install Brainstorm, run apps, edit data, or use multi-device sync. Account-less is the floor.
2. **End-to-end encryption is the default**, not a feature toggle. Synced data leaves a device only as ciphertext under a key the relay does not hold.
3. **Membership is data, not a key.** Adding/removing access to a piece of content is a record, not a redistribution of secrets across all participants.
4. **Granularity is per-entity.** Access control and encryption keys attach to entities, not to workspaces. Removing a user from one note does not require re-keying everything they ever saw.
5. **Server-side features are opt-in and visible.** If an organization needs server-readable data (for indexing, audit, compliance), entering that mode is an explicit, surfaced choice — not a silent downgrade.
6. **Forward secrecy is not a goal.** Past collaborators who had access still have access to past data. We do not aim for the Signal property that revoked members can't decrypt history they already saw — that is incompatible with shared-document semantics in any practical sense.

## What prior local-first tools got stuck on (and why)

A short, fair-faced summary of the recurring pain, because the design here is a deliberate response:

- **Workspace-level keys.** A space had a shared key; revoking a member required rotating that key, which meant re-encrypting and re-distributing across every document in the space. Big spaces ⇒ painful operations.
- **Late joiners.** A new member added to an existing space had to receive history; if history was encrypted under keys they didn't have, you re-encrypt or you give a "fresh start" with no history. Both have UX costs.
- **Server processing.** Search indexes, previews, content moderation, audit logs — all server-side capabilities — were impossible against ciphertext. Either the client did everything (slow, battery-hungry, hard for cross-device search) or you broke E2E silently.
- **Awareness on encrypted data.** Presence/cursor info wanted to flow through the relay, but encrypting it per-recipient added overhead.

The Brainstorm response is structural: granular DEKs + blind relay + explicit server-readable opt-in mode. Each pain above is addressed below.

## Identity tiers

There are four kinds of identity in the system. They stack; you may have several at once.

### 1. Device identity — always

Every Brainstorm install generates an Ed25519 keypair on first run. Stored in the OS keychain. This is the device's voice in the system.

- Used to sign Yjs updates so other peers know the update came from a device they expect.
- Used to authenticate the device to relays.
- Never leaves the device.
- Cannot be revoked from outside; the user can replace it (which orphans data the device was responsible for, with recovery via other devices).

### 2. Sovereign user identity — always (no account)

A second Ed25519 keypair represents the *user* across their devices. When the user has only one device, the device key and user key are functionally the same. With multiple devices, the user key is generated once and **shared between paired devices** via key exchange.

- Pubkey-anchored. The user has no email, no password, no Brainstorm-side record.
- Sharing is by pubkey. To share an entity with another sovereign user, you exchange pubkeys (via QR, link, or whatever channel) and grant access to that pubkey.
- Recovery is the user's responsibility. If they lose all devices and have no backup, the keys are gone.
- This is the **default** identity.

> **Decision:** Brainstorm v1 ships only sovereign identity. No account system. Multi-device works via local key pairing (QR or 6-digit code).

> **Note:** the recovery-phrase-loss / "give me a password" / Web-2.0-auth pressure that hit prior sovereign-key products is addressed in [51-account-recovery-and-web-auth.md](51-account-recovery-and-web-auth.md) — it refines the recovery story here and in 28/29 *without changing this doc's encryption model or phasing table*.

#### Self-asserted display profile (the human-facing identity)

The sovereign identity above is a *cryptographic* identity — a 32-byte Ed25519 public key. That is the trust anchor, but it is unusable as a **human-facing identity**: collaboration and communication surfaces (share dialogs, member lists, presence cursors, `createdBy` attribution, any future messaging) need a name and a face, not a pubkey. v1 closes this gap **without** introducing an account, a server, or any verified record:

- **Self-asserted profile, stored as a synced entity.** Each user holds a `Profile/v1` entity — a singleton in their own vault — carrying `{ displayName, avatarRef?, pubkey }`, signed by their sovereign Ed25519 key. Storing it as a vault entity (not a renderer-local `localStorage` pref) means it **syncs across the user's own paired devices** through the normal sync substrate, so every device shows the same name/face, and editing it on one device propagates. `displayName` is a convenience label; `avatarRef` points at a media blob under the existing encrypted media-at-rest seal (OQ-240). The signature binds the label to the key — it does **not** make the label *true*.
- **The pubkey stays the identity.** A self-asserted name is **not** a trust claim: two users can pick the same `displayName`, and any user can claim any string. The Ed25519 pubkey is the sole identity; the profile is a hint rendered next to it.
- **Petname / local override (Signal model).** Because self-asserted names aren't trustworthy, each user may **locally rename** any contact (a petname), and the UI distinguishes "their self-asserted name" from "the name you gave them." First contact with a key shows the self-asserted name with a not-yet-verified affordance; pubkey verification (compare fingerprints out-of-band) is what upgrades trust, exactly as device-pairing SAS does today.
- **Two sync axes.** *Within your own identity*, the `Profile/v1` entity syncs device-to-device like any vault entity (one master copy, your name everywhere). *Across identities*, a signed **snapshot** of the profile travels alongside the `ShareInvite` (which already binds X25519→Ed25519, see Collab-C2) and is cached in the access record / Yjs awareness state, so a collaborator can render names for everyone in a shared entity without a directory service. No global lookup, no presence server — other people's profiles propagate peer-to-peer with the share and are cached on their `Person/v1` contact.
- **The Contacts app is the registry.** "People I've shared with / been shared by" are `Person/v1` entities; a contact's `pubkey` + petname live there, making Contacts the natural home for trust state and local renames.

This layer is purely additive to the encryption model: it adds no plaintext to the relay, grants no new capability surface on the wire (the profile is signed app-data, not a privileged record), and is fully replaced/enriched when the **consumer account** (below) later supplies a verified, recoverable profile. Open question + sequencing: [OQ-ID-1](../reference/11-open-questions.md#oq-id-1--human-facing-user-identity-for-collaboration) and plan iteration **Collab-C6**.

### 3. Consumer account — optional

An opt-in cloud-side account that provides hosted services. Linked to the user's sovereign identity (the account *holds* the sovereign pubkey; it does not replace it).

- Anchored by an email address (for recovery and notifications).
- Provides: hosted relay, hosted recovery (an encrypted backup of keys), cloud attachment storage, multi-device pairing convenience.
- The account does **not** hold user content keys. It holds *encrypted* backups of those keys (sealed under a passphrase or a recovery factor). The account server cannot decrypt content.
- A consumer account is the upgrade path from sovereign — the user's data and identity are unchanged; capabilities are added.

### 4. Organization — optional

A managed multi-user identity. An organization is a separate identity that owns shared resources and has members.

- Has its own keypair (the org's signing key).
- Has roles: **Owner**, **Admin**, **Member**, **Guest** (read-only / external).
- Has a billing relationship.
- May run its own relay endpoint or use Brainstorm's hosted one.
- Optionally has access to **server-readable** spaces (see encryption section).

A user becomes part of an organization by accepting an invite (signed by the org); their sovereign identity now has additional access to org-owned entities.

## When does a user need an account?

The decision tree:

```
   Do you want to use Brainstorm?
     ▶ No account needed. Sovereign identity is automatic.

   Do you want to sync between your own devices?
     ▶ No account needed. Local pairing (QR/code) sets up shared keys.

   Do you want a hosted relay (so devices that aren't online together still sync)?
     ▶ Either: self-host a relay (no account), or
              create a consumer account (hosted relay).

   Do you want recovery if you lose all your devices?
     ▶ Either: keep your own offline backup of your keys (no account), or
              consumer account (hosted encrypted backup).

   Do you want to share an entity with another individual?
     ▶ No account needed. Exchange pubkeys; share via invite link.

   Do you want a managed multi-user environment with admin, audit, billing?
     ▶ Organization account.
```

Account-less is genuinely viable for many users. The account exists for convenience, not for unlocking the product.

## What does a paying user pay for?

> **Decision:** the **local product** is free forever. The shell, SDK, all sandboxing, all CRDT machinery, P2P sync, self-hosted relay, the package format, and all bundled apps are free. There is no feature gate inside the local experience.

What is paid:

| Tier              | Free                                  | Consumer paid                              | Organization paid                                                       |
|-------------------|---------------------------------------|--------------------------------------------|-------------------------------------------------------------------------|
| Local app         | ✓                                     | ✓                                          | ✓                                                                       |
| Local-only sync   | ✓                                     | ✓                                          | ✓                                                                       |
| P2P sync          | ✓                                     | ✓                                          | ✓                                                                       |
| Self-hosted relay | ✓                                     | ✓                                          | ✓                                                                       |
| Hosted relay      | —                                     | ✓ (subject to fair-use)                    | ✓ (with org-level SLA)                                                  |
| Cloud attachments | —                                     | ✓ (quota by tier)                          | ✓                                                                       |
| Multi-device      | ✓ (local pairing)                     | ✓ (cloud-assisted recovery)                | ✓                                                                       |
| Encrypted backup  | —                                     | ✓                                          | ✓                                                                       |
| Multi-user shares | ✓ (peer-to-peer, by pubkey)           | ✓                                          | ✓                                                                       |
| Org-level ACL     | —                                     | —                                          | ✓                                                                       |
| Audit logs        | local only                            | local only                                 | ✓ (server-side, retained)                                               |
| SSO / SCIM        | —                                     | —                                          | ✓                                                                       |
| Server-readable spaces | —                                | —                                          | ✓ (opt-in)                                                              |

> **Decision:** Brainstorm itself does not handle premium-app commerce in v1 or v2. Apps that want to charge handle their own billing off-platform. (The catalog mechanism that does ship in v2 takes a platform fee on catalog-mediated purchases without custodying the principal — see [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md) and [45-payments-architecture.md §Catalog fee collection](../platform/45-payments-architecture.md).)

> **Decision:** the full commercial design — what the consumer / Plus / Pro / Team / Enterprise plans charge for, concrete prices, the entitlement system, the billing architecture — is in [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md), [44-pricing.md](../platform/44-pricing.md), and [45-payments-architecture.md](../platform/45-payments-architecture.md). The tier table above is the seed of the plan ladder there; the docs cross-reference each other.

## Encryption model

This is the core of the doc. The challenge is to allow multiple users to edit the same Yjs doc concurrently while keeping the server unable to read content.

### Per-entity Data Encryption Key (DEK)

Each entity has its own symmetric key — its **DEK** (256-bit AES-GCM, or XChaCha20-Poly1305; both fine).

- Yjs updates and snapshots for that entity are encrypted under the DEK before they leave the device.
- The relay sees ciphertext blobs and a **routing envelope** containing only the entity id (or an opaque routing token) and a signature from the sending device.

### Member key wraps

For each member of an entity, the DEK is **wrapped** (encrypted) under that member's public key:

```
   entity:ent_OKR2025Q3
   ├── DEK_v3 (current)
   └── wraps:
       ├── for alice@pk:abc...   →  E_alice(DEK_v3)
       ├── for bob@pk:def...     →  E_bob(DEK_v3)
       └── for carol@pk:ghi...   →  E_carol(DEK_v3)
```

The wraps are stored alongside the entity's other metadata (themselves replicated through the relay; they're small).

### Adding a member

The inviter (who has the current DEK) creates a new wrap of the DEK under the new member's public key, signs an "access grant" record, and publishes it. The new member can immediately decrypt all current and historical content of the entity.

> **Why this is better than rotating:** no re-encryption of any prior data. New members get a wrap, not a re-keyed history.

### Removing a member

Removing access requires that future updates use a *new* DEK that the removed member doesn't have. The flow:

1. The remover (must have admin role) generates `DEK_v(n+1)`.
2. Wraps `DEK_v(n+1)` for each remaining member.
3. Publishes a "key rotation" record signed by their key.
4. From this point, updates are encrypted under `DEK_v(n+1)`.

The removed member retains **historical** access (they had `DEK_v(n)`). They cannot read new updates.

> **Decision:** Brainstorm's revocation is forward-only. We do not pretend to retrieve content from minds, devices, or backups. This is a documented property, surfaced in the UI when you remove someone ("They will keep access to anything they could already see; they will not be able to read changes from now on.").

### Granularity matters

Because DEKs are per-entity:

- Removing a user from one entity rotates one DEK and re-wraps for that entity's remaining members. **No effect on any other entity.**
- A 10,000-entity workspace where you revoke one user's access touches only the entities they had access to — and even then, only one rotation per entity, on demand.
- This is the structural fix to the workspace-key pain in prior local-first tools.

### Membership as data

Each entity has a small **access record** — a list of `(memberPubkey, role, addedBy, addedAt, revokedAt)` tuples — that itself is part of the entity's Yjs doc, signed by the granting party. Membership lives at the same layer as the data; it isn't separate infrastructure.

### Late joiners

A late joiner gets:
- The current DEK wrap (so they can decrypt the snapshot and current updates).
- The full Yjs doc snapshot + tail (delivered through the relay, ciphertext as far as the relay sees, decryptable with their wrap).
- They do **not** need to receive new copies of historical content. They can read everything from the moment of their access grant.

### The blind relay

The relay's job: route Yjs update envelopes between devices. It sees:
- Routing tokens (entity ids, hashed if needed).
- Ciphertext blobs.
- Signatures over the envelope (so it can drop forged messages cheaply).
- Awareness pings (optionally encrypted; small).

It does not see: entity content, user names, document titles, links, attachments. The relay can be hosted by Brainstorm, by the user, by an organization — the privacy guarantee is the same.

> **Decision:** Brainstorm's hosted relay is operationally blind. Audit logs at the relay record routing metadata only.

### Awareness encryption

Awareness data (cursor positions, selection ranges, presence) is small but frequent. We encrypt it under the entity's DEK (same as content). Awareness is never persisted; relay forwards and forgets.

### Attachments

Large blobs (images, PDFs, video) are encrypted under per-attachment DEKs and uploaded to attachment storage (cloud or self-hosted). The reference inside an entity is `(attachmentId, blobDEK)`. Members of the entity can fetch and decrypt; the storage server cannot.

### Key material at rest

- The user's identity keys are stored in the OS keychain (or, optionally, encrypted with a passphrase).
- Per-entity DEKs are kept in memory while the entity is open and persisted encrypted under the user's storage-master-key (derived from the identity, or from a passphrase) when at rest.

### Forward secrecy: explicitly out of scope

We do not implement double-ratcheting or per-message keying. The cost is that a compromise of a current DEK exposes everything that was encrypted under it (until rotation). Trade-off: practical, well-understood crypto vs. the operational nightmare of editing-document forward secrecy.

## Organizations in detail

An **organization** is a managed multi-user identity:

- Has a primary key (org root key) and a published org pubkey.
- Has members with roles (Owner, Admin, Member, Guest).
- Owns **spaces** — collections of entities under shared org governance.

### Spaces

A **space** is a tenancy boundary inside an organization. An entity belongs to a space. The space defines:
- Default access (who automatically gets access to entities created in this space).
- The encryption mode (E2E by default, or **server-readable** if explicitly enabled — see below).
- Audit retention rules.
- Sync transport configuration (which relay endpoint, which storage endpoint).

A user can be in multiple spaces; entities know which space they belong to.

### Roles

- **Owner** — billing and org-existential decisions; transfers to admin or terminates org.
- **Admin** — manage members, manage spaces, manage billing, configure audit.
- **Member** — read/write within their granted spaces.
- **Guest** — read-only access to specific entities, often externals (clients, contractors).

### Server-readable spaces

This is the explicit opt-out from E2E for organizations that need server-side capabilities.

> **Decision:** server-readable mode is a property of a **space**, not the product. An org can run all-E2E spaces, all-server-readable spaces, or mix. The user always sees which mode a space is in.

A server-readable space encrypts data at rest (so a database breach is not a content leak) but with **a key the org's server holds**. The server can decrypt to:
- Index for full-org search.
- Generate previews and notifications.
- Run DLP / audit / compliance scans.
- Apply server-side ACL (faster than client-checked).
- **Run AI on plaintext** — semantic search, summaries, extraction, conversation agents over the org's shared data. This is the explicit "we want server-side AI features" reason to opt into server-readable. See [22-ai-foundations.md](../platform/22-ai-foundations.md).

The user joining a server-readable space sees a **clear notice** in the entity-open and space-overview surfaces. We do not assume users understand the cryptographic distinction; we surface it in plain language ("Your organization can read content in this space.").

> **Decision:** the server-readable mode is **per-space** so individuals can keep personal/draft content in personal E2E spaces while collaborating in server-readable org spaces.

### Org-level audit

In server-readable spaces, the org has access to per-entity audit (who viewed, who edited, what changed). In E2E spaces, audit is limited to access-grant events (which are signed and recorded), not content events (which the server doesn't know about).

### Org sync transport

Orgs may run their own relay (self-hosted on their infrastructure) or use Brainstorm's hosted relay. Either way, the relay is operationally blind for E2E spaces. For server-readable spaces, the relay is co-located with content storage that the org's server can decrypt.

### AI and the encryption boundary

Per [22-ai-foundations.md](../platform/22-ai-foundations.md), AI runs on the **trusted side** of the encryption boundary:

- **For E2E content** (personal entities, E2E spaces): AI calls happen **on the user's own device** (using the bundled local model) **or to a cloud endpoint configured by the user with their own credentials**. Brainstorm's hosted infrastructure does not broker AI calls for E2E content — there is no plaintext path through the relay.
- **For server-readable spaces**: the org's server can run AI on its plaintext copy. This is one of the principal reasons to opt into server-readable mode. Org admins configure provider routing and policy at the space level.
- **The relay never sees AI prompts or responses.** It routes opaque envelopes; AI is not its concern.

Surface this clearly when the user invokes an AI feature: "This call uses {provider}. Content from this space ({E2E | server-readable}) will be visible to the model." Never silent.

## Transitions

### Sovereign → Consumer

The user creates a consumer account by adding an email. Their sovereign identity is unchanged. The account adds:
- Encrypted backup of identity keys (sealed under a recovery passphrase).
- Hosted relay endpoint configured.
- Cloud attachment storage.

Reversible: the user can delete the account; their data and sovereign identity remain locally.

### Consumer → Organization owner

A consumer account holder creates an organization. They become its first Owner. Their personal sovereign identity is preserved separately; the org has its own identity. The user now operates with two contexts (personal and org); the shell makes this visible (a context switcher, akin to "personal account" / "work account" in other apps).

### Joining an organization

A user receives an invite (signed by an org admin). On acceptance:
- Their sovereign identity gains membership in the org.
- They see the org's shared spaces in their workspace.
- Personal entities remain personal — joining an org doesn't share anything they didn't choose to share.

### Leaving / being removed

- The user keeps their personal data unchanged.
- Their access to org-owned entities is revoked via the per-entity DEK rotation flow described above.
- Their historical knowledge (what they saw before) is acknowledged as out-of-our-control.

## Phasing

> **Decision:** v1 ships **sovereign identity only**, with **encrypted multi-device sync**. No accounts, no orgs, no hosted services. The encryption model is implemented end-to-end for personal multi-device use.

| Capability                   | v1                              | v2                            |
|------------------------------|---------------------------------|-------------------------------|
| Device identity              | yes                             | yes                           |
| Sovereign user identity      | yes                             | yes                           |
| Multi-device sync (E2E)      | yes (local pairing)             | yes (also cloud-assisted)     |
| P2P sync                     | yes                             | yes                           |
| Self-hosted relay            | yes                             | yes                           |
| Per-entity DEK encryption    | yes (model in place)            | yes (used by multi-user)      |
| Member wraps                 | yes (single-user, multi-device) | yes (multi-user)              |
| Multi-user sharing (sovereign-to-sovereign) | no (deferred)    | yes                           |
| Consumer accounts            | no                              | yes                           |
| Hosted relay                 | no                              | yes                           |
| Cloud attachments            | no                              | yes                           |
| Organizations                | no                              | yes                           |
| Server-readable spaces       | no                              | yes                           |
| Org audit / compliance       | no                              | yes                           |
| Premium apps commerce        | no                              | not yet planned               |

The v1 / v2 split is conservative. Designing the encryption and identity model now (in v1) ensures the v2 features add capability without rework.

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- OQ-25: cipher selection (AES-GCM vs. XChaCha20-Poly1305) and protocol version negotiation.
- OQ-26: device-pairing UX details (already partly OQ-10) — explicit choice between QR-only and code-fallback.
- OQ-27: whether server-readable spaces' keys can rotate independently of content keys (compliance scenario).
- OQ-28: whether the org's relay endpoint config is enforced for E2E spaces too, or only server-readable ones.
- OQ-29: how revoked-but-historical-access members appear in audit logs and access records (should they be visible permanently, or fade out?).

## Summary

- The local product is account-less, free, and works fully offline. That's the floor we never touch.
- E2E encryption is structural: per-entity DEKs, member key wraps, blind relay, granular revocation. This is a deliberate response to the workspace-key and re-encryption pains seen in prior local-first tools.
- Accounts and organizations are layers that *add capability without removing the floor*.
- Server-side capabilities (search, audit, DLP) are an explicit, per-space, surfaced opt-out from E2E — for organizations that need them.
- Forward secrecy is not a goal. Revocation is forward-only. We say so plainly.
- v1 = sovereign + multi-device with the encryption model proven. v2 = accounts, orgs, hosted services, multi-user.
