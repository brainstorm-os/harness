# CLAUDE.md — brainstorm-sync

This file guides Claude Code when working in the **zero-knowledge sync plane**. It is a *separate repo and deploy boundary* from both the Brainstorm product (`../app`) and the commercial control plane (`../cloud`). Read this before touching anything.

## What this repo is

The hosted **sync infrastructure** for Brainstorm: a relay-blind node that forwards (SYNC-1) and — once SYNC-2 lands — durably stores the **encrypted** CRDT traffic between a user's devices and collaborators. It is the deployable production form of the relay the product currently spawns in-process for tests (`../app/packages/relay-server`).

It is the **third plane** in a three-plane system:

| Plane | Repo | Holds | Trust model |
|---|---|---|---|
| **Product data plane** | `../app` | Vault content (Yjs/CRDT), keys, the Electron client | client-only — does all crypto |
| **Sync plane** | **this repo** | **ciphertext only** (encrypted Y.Doc updates + wrapped DEKs) + routing metadata | **relay-blind** — holds no key, can't decrypt |
| **Commercial control plane** | `../cloud` | email · plan · payment · entitlements | server-readable PII / payments |

## The load-bearing invariant (read twice)

**This node is relay-blind. It stores and forwards CIPHERTEXT ONLY, holds no key, and can never decrypt vault content.**

- **No crypto on the route path.** No `@noble/*`, no cipher/HPKE/envelope-seal, no DEK/identity-key handling. The node reads the plaintext **routing header** (`entityId`, `sender`, `kind`, `seq`, `nonce`, `ts`) for fan-out + the audit log, and forwards the opaque body untouched. Adding a crypto import to anything on the route path (`src/wire.ts`, `src/router.ts`, `src/server.ts`, `src/audit-log.ts`, future `src/sync/*`) is a security regression — gate it behind a reviewed `// relay-blind-exempt` note, or (almost always) don't.
- **Ciphertext never enters the audit log.** `AuditEntryInput` has no payload field by construction; keep it that way. The audit records routing metadata only.
- **No product code.** Do NOT import `@brainstorm/*` packages. The relay core here is a deliberate standalone copy of the product's wire format — the product keeps its own `packages/relay-server` for its test harnesses. The two repos share only the **wire protocol** (the contract), never code. This mirrors how `cloud` shares only `api-client`.
- **This is why it can't live in `cloud`** (whose invariant is "no vault content, no CRDT, no relay traffic, even encrypted") **nor** bloat the product repo.

A stray crypto import or a product-package dependency breaks the zero-knowledge guarantee. Treat both as security regressions, not conveniences.

## The seam: the wire protocol

The single coupling to the product is the **Stage-10 wire protocol** — the first-byte channel (`0x00` control / `0x01` frame) + the routing-header schema in `src/wire.ts`. The product's `packages/shell/src/main/sync` envelope codec is the canonical source; `src/wire.ts` mirrors only what the node needs to peek at. Changes to the header schema are lockstep with the product — coordinate via `/add-dir ../app`. Treat it as a published contract: additive changes preferred, versioned breaks only.

The seam to `cloud` arrives at SYNC-4: the node will verify a `cloud` Ed25519 **entitlement token** to admit a connection and meter usage — **authorization only; vault data never crosses into the commercial plane.**

## Layout

```
src/
  wire.ts        routing-header decoder (the contract surface)
  audit-log.ts   ciphertext-NEVER routing-metadata log
  router.ts      (entityId → connId) subscriptions + blind fan-out
  server.ts      relay core (channel demux + connection handlers) — testable, socket-free
  main.ts        Bun.serve entrypoint: env config, /healthz, graceful shutdown
  *.test.ts      bun:test (zero-dep)
Dockerfile       oven/bun image + healthcheck
```

## Stack & commands

- **Runtime:** Bun (no runtime deps — the relay is pure TS).
- **Tests:** `bun test` (built-in runner, zero install).
- **Lint/format:** biome. **Typecheck:** `tsc --noEmit` (needs `bun install` for devDeps).

```sh
bun install        # devDeps (biome, tsc, @types/bun)
bun test           # run the suite (no install required)
bun run start      # boot the node on PORT (default 7780)
bun run typecheck
bun run lint
```

## Roadmap (tracked in `../docs/implementation-plan.md` §Durable sync node)

- **SYNC-0** ✅ scaffold + this CLAUDE.md.
- **SYNC-1** ✅ forward-only relay node (online live layer).
- **SYNC-2** ✅ storage-backed durable node — **core landed** (`src/sync/`): a pluggable `SnapshotStore` (in-memory + filesystem `FileSnapshotStore`), the OQ-SYNC-3 **snapshot+tail** layout with **client-driven compaction** (a `Snapshot` frame bumps the version + resets the tail), and **offline backfill** (the server replays `wraps ++ snapshot ++ tail` to a connection on subscribe — `store`-optional, so a no-store node is still forward-only SYNC-1). This is what makes restore-from-loss possible. **The node also retains `WrapBootstrap` frames** (the HPKE-sealed per-entity DEK wraps, bounded at `WRAP_RETENTION`) and serves them **first** in backfill, so a reconnecting device with its keystore intact recovers the DEK (with its own X25519 key) *before* applying the encrypted state — restore without account recovery for the keystore-intact case. The node still holds only ciphertext (it has no X25519 key — relay-blind preserved). **Deferred by design:** the object-storage backend (R2/S3) is **SYNC-3** (the interface is ready); **crypto-based "access-record-authorized fetch" stays out** — the node is relay-blind (no Ed25519 verify on the route path), so confidentiality is the DEK's job (it serves ciphertext; non-members can't decrypt) and the verified admission/entitlement check is **SYNC-4**. Per-`(account, …)` key scoping also rides SYNC-4's verified identity.
- **SYNC-3** ✅ pluggable storage provider (local / managed / self-hosted). The `SnapshotStore`/`AccountCatalog` interfaces are the seam; `object-store.ts` adds an `ObjectBucket`-backed `ObjectSnapshotStore` + `ObjectAccountCatalog` (same opaque snapshot+tail shape as the local file backend), and `bun-s3-bucket.ts` is the zero-dep S3/R2/MinIO adapter (Bun's built-in S3 client). `main.ts` selects the backend from env (`STORAGE_BACKEND`/`STORAGE_DIR`/`S3_*`). The bucket credential is transport auth, not a vault key — relay-blind preserved.
- **SYNC-4** ✅ entitlement-gated admission + metering (the `cloud` seam). **SYNC-4a** account catalog (`account-catalog.ts` + `file-account-catalog.ts` + object backend): records `sender→entityId` and answers the `catalog` control query. **SYNC-4b** the gated handshake — `entitlement.ts` verifies a `cloud` Ed25519 token (WebCrypto, offline, the contract mirrored not imported) and `admission.ts` runs the **two-proof** handshake: token (`sub` = billing account → admission/plan/quota) **plus** a server-nonce signed by the device **identity key** (`account` = base64url pubkey = wire `sender` → scopes the catalog + checks emission). `server.ts` gates frames/subscribe/catalog until authenticated, forces the catalog account to the proven one, and meters connect/ingress/egress (`metering.ts`) to `METERING_LOG_PATH`. Both verifies are the one reviewed `relay-blind-exempt` (auth, not content); `server.ts` only consults an **injected** `Admission` (type-only import) so the route path stays crypto-free. Open `ENTITLEMENT_KEYS` unset ⇒ open admission, wire path unchanged.
- **SYNC-5** ✅ ops — abuse caps + rate limits + quotas in `limits.ts` (a pure, injected-clock `Limits` facade over token-bucket `KeyedRateLimiter`s): per-IP connection rate, per-connection message + byte rate, per-account frame rate, hard caps on frame/control size + subscriptions-per-connection; on by default (`LIMITS_DISABLED=1` to disable). Audit sink/rotation is the existing `AUDIT_LOG_PATH` NDJSON + external logrotate; deploy manifests are the `Dockerfile` + `.env.example`.

Open questions live in `../docs/reference/11-open-questions.md` (OQ-SYNC-1/2/3, all resolved): storage-provider default, admission model, encrypted-snapshot storage layout.
