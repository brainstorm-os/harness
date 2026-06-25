# 59 — App lifecycle and the catalog (0→1: bootstrap, install, update)

This doc closes the gap between the **distribution design** ([14-app-store.md](14-app-store.md) — package format, signing, install protocol) and the **product surface** ([47-marketplace.md](47-marketplace.md) — the Marketplace shell view, wallet, developer portal) with the part neither one specifies concretely: **how an app actually travels from a build to a running window in a fresh vault, and how it stays current afterward — through the cloud catalog, not through seeding.**

It is the runtime + ops counterpart to those two docs. 14 says "the unit of install is a manifest URL" and "the shell checks for updates periodically"; 47 says "the user clicks Install and the shell downloads the bundle." Neither says where the catalog lives, what its wire contract is, how first-party apps get into it, or what replaces the demo seeder we ship today. This doc does.

It builds on: [14-app-store.md](14-app-store.md), [47-marketplace.md](47-marketplace.md), [32-store-verification.md](32-store-verification.md) (continuous trust), [45-payments-architecture.md](../platform/45-payments-architecture.md) (entitlement-token issuer keys, baked-in catalog keys), and the cloud control plane (`../brainstorm-cloud`, Phase 3.4 "Remote catalog API").

## The problem we're fixing

Today an app reaches a vault through **exactly one mechanism: seeding.**

- **Dev** (`main/dev/seed-demo-apps.ts`): on every boot, for each entry in `FIRST_PARTY_APPS`, uninstall → `vite build` → `installPrebuiltBundle` → pin a dashboard icon. Re-deploy happens only on full shell restart.
- **Prod** (`main/apps/seed-packaged-apps.ts`): on first open of a vault, read prebuilt bundles from `process.resourcesPath/apps/<dir>/dist` and install each not-yet-registered first-party app. 13.10 added an upgrade path: a bundled manifest whose **version** outranks the registry row routes through `AppInstaller.update()` (caps diffed + granted).

Both paths share the same install machinery (`AppInstaller`, the registry repos, the capability ledger, `hashBundleDirectory`, dashboard pinning) — that part is solid and we keep it. What's missing is everything *above* the installer:

1. **There is no runtime catalog.** The set of installable apps is hard-coded in `FIRST_PARTY_APPS` and frozen at binary-build time. The Marketplace surface (`main/marketplace/marketplace-service.ts`) lists the union of installed rows + the bundled first-party catalog + 5 built-in themes — it cannot show, fetch, or install anything the binary didn't ship. `ListingSource.Catalog` is an enum member with no producer.
2. **First-party app updates are welded to the shell binary.** A Notes bugfix can only reach users by shipping a whole new Electron build (the 13.10 upgrade path only fires from `extraResources`). That's the wrong cadence — **default apps should update separately from the shell.**
3. **Provenance is thin.** The `apps` registry row records `signature_status` / `signature_key_id` (13.2, advisory) but not *where the app came from* (bootstrap cache vs catalog vs sideload), which catalog, or which channel — so we can't reason about update sources or trust per-install.
4. **"Demo seeding" is a dev affordance masquerading as the product's 0→1.** Removing it means defining what genuinely replaces it.

## The three concepts (and how they relate)

| Concept | What it is | Where it lives | Source of truth for |
|---|---|---|---|
| **Catalog** | The cloud-hosted, signed index of installable content — listings, versions per channel, bundle URLs + hashes + signatures. The official Brainstorm catalog is the default; third-party catalogs use the same contract. | `../brainstorm-cloud` (control plane) + object storage for bundles | *What exists to install and what the current version is.* |
| **Bundle cache** | A read-only set of `.brainstorm` bundles shipped inside the shell binary (`extraResources`). It is **a build-time snapshot of catalog entries**, not an independent source. Exists purely for the offline-first floor: first run with no network still gets the core apps. | Inside the app bundle, `process.resourcesPath/apps/*` | *Nothing authoritative — it's a cache.* |
| **Registry** | Per-vault installed state: which apps are installed, at what version, from what source, with what capabilities. The existing `registry.db` `apps`/`openers`/`blocks`/`entity_types`/`widgets`/`intents` tables. | `<vault>/registry.db` | *What is installed in this vault right now.* |

The load-bearing relationships:

- **The bundle cache is a cache of the catalog.** Every bootstrap bundle the binary ships corresponds to a real catalog listing at a known version. On first run we install from the cache (offline-safe); the moment we're online, the **catalog** — not the cache — is what we check for updates. The cache is never consulted again after first install.
- **First-party apps are ordinary catalog entries.** `io.brainstorm.notes` is published to the catalog, signed with the Brainstorm publisher key, and updated through the same path as any third-party app. The only thing special about first-party apps is (a) they're signed by the Brainstorm key (the catalog's baked-in trusted key), and (b) a curated subset is also pre-cached in the binary as the bootstrap set. **This is what decouples default-app updates from shell updates** (problem #2): a Notes fix is a new catalog version, picked up by the update engine on the next poll, with no new Electron build.
- **The registry never trusts the cache or the catalog blindly.** Every install — bootstrap, catalog, or sideload — runs through `AppInstaller`, which verifies the bundle hash, records signature status, applies capability grants, and writes the registry rows. The catalog tells us *what* and *where*; the installer enforces *integrity and consent*.

> **Decision:** the bundle cache is **a cache of catalog entries, never a parallel source of truth.** It seeds the offline-first first run and is then ignored. This is what lets us delete the seeder's "the binary defines the app set" assumption without losing offline capability.

> **Decision:** **first-party apps are unified catalog entries** signed by the Brainstorm publisher key. There is no privileged first-party update path distinct from the catalog. Default-app updates flow through the catalog update engine, independent of the Electron shell's own auto-update ([13.6](../implementation-plan.md), [§Two update planes](#two-update-planes-app-vs-shell)).

## The 0→1 first-run flow (offline-capable)

When a fresh vault opens, the shell runs the **bootstrap installer** (the replacement for `seedPackagedApps`):

```
fresh vault opened
  │
  ├─ for each app in the BOOTSTRAP_SET (curated default apps, e.g. Notes/Files/Database/Tasks/…):
  │     read cached bundle from process.resourcesPath/apps/<dir>
  │     AppInstaller.install({ bundleDir })          ← existing machinery, unchanged
  │       · verify bundle hash, record signature status + key id
  │       · stamp provenance: source=BootstrapCache, catalog_id=brainstorm-official,
  │         channel=stable, catalog_version=<the version this snapshot represents>
  │       · apply default + manifest capability grants
  │       · write registry rows, pin dashboard icon
  │
  └─ vault now has the core apps, with ZERO network. ✔ local-first floor preserved
```

Later, when the device is online, the **update engine** ([§Update engine](#the-update-engine-client)) reconciles every catalog-sourced install — including the bootstrap set, because they're stamped `catalog_id=brainstorm-official` — against the live catalog and offers updates.

> **Decision:** the bootstrap set is a **curated subset** of first-party apps (the apps a brand-new user needs to be productive offline), not all 21. The rest of the first-party apps are catalog entries the user installs on demand from the Marketplace. The exact membership is [OQ-LC-1](#open-questions). Lean: Notes, Files, Database, Tasks, Calendar — the everyday core; everything else (Graph, Whiteboard, Mailbox, Browser, …) installs from the catalog.

> **Decision:** the bootstrap install is **non-negotiable and offline** — it never blocks on the network and never fails because the catalog is unreachable. The cache is the floor. This preserves the account-less, network-less floor from [01-vision.md](../foundations/01-vision.md), exactly as `seedPackagedApps` does today (it throws only if `extraResources/apps` is *missing* — a build defect — never on network).

## Two update planes (app vs shell)

There are two independent update mechanisms, and keeping them separate is the point of this design:

| Plane | What updates | Mechanism | Cadence | Doc |
|---|---|---|---|---|
| **Shell update** | The Electron binary itself (main process, preload, dashboard renderer, the bundle cache). | 13.6 beta-channel: a feed check → manual download → OS handoff (v1); auto-install (v2). The shell never silently fetches a binary in v1. | On release. | [implementation-plan §13.6](../implementation-plan.md) |
| **App update** | Installed apps (first-party *and* third-party), themes, and future content kinds. | This doc's **update engine**: catalog poll → per-channel version compare → download → `AppInstaller.update()` (capability-diff prompt). | Every few hours / on demand / at launch when stale (per [14 §Update behavior](14-app-store.md)). | This doc. |

> **Decision:** **app updates and shell updates are separate planes.** A first-party app fix ships as a catalog version and reaches users on the app-update cadence; it does **not** require a shell release. A shell release refreshes the bundle cache (so a future fresh vault bootstraps from newer snapshots) but does **not** itself update already-installed apps — that's the app-update plane's job, against the live catalog. This is the direct consequence of "default apps get updated so we can update them separately."

## How an app gets *into* the catalog (the publish pipeline)

This is the "added to the marketplace" half of the request. Two author tracks, one catalog contract.

### First-party apps (the Brainstorm publisher)

Automated from CI, dogfooding the exact third-party pipeline:

```
CI (on a tagged app release, e.g. notes-v1.5.0)
  1. build      bun run build         → apps/notes/dist
  2. pack       brainstorm-cli pack   → io.brainstorm.notes-1.5.0.brainstorm   (tar+zstd, per 14 §Package format)
  3. sign       brainstorm-cli sign   → SIGNATURES/ (Ed25519, Brainstorm publisher key; key in CI secret/HSM, never in repo)
  4. upload     → object storage (content-addressed by sha256)
  5. list       → catalog admin API: create/update the listing's version entry
                  (version, channel, bundle URL, sha256, signature) for io.brainstorm.notes
  6. cache      (shell-build only, periodic) → refresh extraResources bootstrap bundles
                  from the current `stable` catalog versions of the BOOTSTRAP_SET
```

Steps 1–5 happen **per app release** and are what make a default-app update reach users without a shell build. Step 6 happens **per shell release** and only refreshes the offline-first snapshot — it is not how updates are delivered.

> **Decision:** the Brainstorm publisher key is the catalog's baked-in trusted key (same mechanism as the entitlement-token issuer key in [45 §Entitlement tokens](../platform/45-payments-architecture.md), with rotation). First-party listings are signed by it; the shell trusts it on first run without TOFU prompting (it's compiled in). Third-party listings TOFU per [14 §Trust model](14-app-store.md).

> **Decision:** first-party publishing is **CI-driven and reviewed** through the admin panel's marketplace queue ([48-admin-panel.md](../platform/48-admin-panel.md) §1 / cloud Phase 4.3), even for our own apps — it keeps the catalog authoring path single-sourced and exercises the review lane we require of third parties.

### Third-party apps

The developer-portal path already designed in [47 §Becoming a developer](47-marketplace.md) and [14 §Developer onboarding](14-app-store.md): sign in with the sovereign publisher key → submit a manifest URL + store metadata → browser-side signing → the listing appears in the catalog (subject to the review lane, [32-store-verification.md](32-store-verification.md)). v2 ships free listings (cloud Phase 3.3 / iteration 14.22). Nothing in *this* doc changes that; it just defines the catalog the listing lands in.

## The catalog API contract

This is the concrete shape of cloud Phase 3.4 ("Remote catalog API — admin-authored marketplace source"), which is currently undefined. The shell already has a `marketplace:listings` IPC and a kind-agnostic `MarketplaceListing` type; the catalog client resolves remote listings into more of those rows.

### Endpoints

All responses are JSON, served over HTTPS from the catalog host (the official catalog is a Brainstorm-operated origin; third-party catalogs implement the same contract at their own origin).

```
GET  /v1/catalog/index            → signed catalog index (the listing roster + per-listing current versions)
GET  /v1/catalog/listing/{id}     → full listing detail (metadata, screenshots, channels, version history)
GET  /v1/catalog/manifest/{id}    → the per-app manifest URL document (per 14 §Install protocol)
GET  <bundle url>                 → the .brainstorm bundle (content-addressed; may be a CDN/object-store URL)
GET  /v1/catalog/threat-intel     → signed threat-intel feed (per 32-store-verification.md)
```

### The signed catalog index

The index is the document the shell polls. It is **signed by the catalog's listing key** (baked in for the official catalog; TOFU'd + fingerprint-shown for third-party, per [47 §Sources](47-marketplace.md)) so a hijacked origin can't inject listings.

> **Decision (landed — `catalog-edge` 3.4a):** the index is served as a **detached-payload signed envelope** — `{ payload, kid, signature }` where `payload` is `base64url(JSON index)` and `signature` is `base64url(ed25519_sign(payload_ascii))`. The shell base64url-decodes `payload` to get the index object below and verifies the signature over the exact `payload` string against the `kid`-selected key. This is the same JWS-style discipline as the entitlement token ([45 §Entitlement tokens](../platform/45-payments-architecture.md)): signing the *transmitted bytes* gives automatic cross-language agreement with **no JSON-canonicalization ambiguity** (the earlier "signature field inside the index" sketch is superseded by this envelope — same content, robustly verifiable). The decoded `payload` is:

```jsonc
// GET /v1/catalog/index
{
  "catalogId": "brainstorm-official",
  "generatedAt": 1750000000,
  "ttlSeconds": 3600,                       // client re-poll hint
  "listings": [
    {
      "id": "io.brainstorm.notes",
      "kind": "app",                        // ContentKind enum value (per 47 §content-kind registry)
      "publisherKey": "ed25519:…",          // Brainstorm key for first-party
      "name": "Notes",
      "summary": "…",
      "iconUrl": "https://…/notes/icon.svg",
      "channels": {
        "stable": "1.5.0",
        "beta":   "1.6.0-beta.2"
      },
      "versions": {
        "1.5.0": {
          "manifestUrl": "https://…/notes/manifest.json",
          "bundleUrl":   "https://cdn…/io.brainstorm.notes-1.5.0.brainstorm",
          "sha256":      "ab12…",
          "signature":   "…",              // Ed25519 over the bundle content hash
          "sdk":         "1",
          "minShell":    "1.0.0"           // compatibility floor (per 14 detail page "Compatibility")
        }
      },
      "firstParty": true                    // convenience flag; authoritative trust is the publisherKey
    }
    // … one entry per listing
  ]
}
// ↑ this object is the `payload` (base64url-encoded) inside the signed
//   envelope { payload, kid, signature } the endpoint actually returns.
```

> **Decision:** the index carries **per-channel current version pointers + a version table**, not just "latest." This is what the update engine compares against, and it's how a user on `beta` for one app and `stable` for another (per [14 §Update channels](14-app-store.md), per-app channels) resolves correctly from one document.

> **Decision:** the catalog index is **signed and offline-verifiable**, mirroring the bundle-signature posture. The shell verifies the index signature against the catalog's listing key before trusting any row. A failed verify → the shell keeps the last good cached index and surfaces a Sources warning; it never installs from an unverified index.

> **Decision:** the shell **caches the last good index** (under `userData`, app-global, like `update-prefs.json` from 13.6) with its `generatedAt`/`ttlSeconds`. Offline or on fetch failure, the Marketplace renders from cache and the update engine no-ops; it never blocks the UI on the network.

### Bundle delivery and integrity

The `bundleUrl` is content-addressed (sha256 in the path or as the object key) and may point at a CDN / object store, decoupled from the API origin. The shell:

1. downloads the bundle to a temp path,
2. verifies `sha256` matches the index entry (integrity),
3. verifies the Ed25519 `signature` against the listing's `publisherKey` (authenticity + TOFU per [14 §Trust model](14-app-store.md)),
4. unpacks (tar+zstd) and hands the unpacked `bundleDir` to `AppInstaller.install` / `.update`,
5. `AppInstaller` independently recomputes `hashBundleDirectory` and records it on the registry row (the existing 13.2 path — a second, installer-owned integrity check).

> **Decision:** the catalog is **relay-blind to vault content and never sees who installs what at user granularity** — it serves a public, signed index + public bundles. Install events are not reported per-user (matches [47 §Analytics](47-marketplace.md): aggregated, coarse-grained, no per-user data). The catalog is a CDN-shaped read surface, not a tracking surface.

## The catalog client + install engine (shell side)

New shell subsystem under `main/catalog/` (kept distinct from `main/marketplace/`, which stays the kind-agnostic listing aggregator the UI reads):

- **`CatalogClient`** — fetches + verifies the signed index, caches it, exposes `listings()` / `listing(id)` / `resolveVersion(id, channel)`. Pure-ish: injected `fetch` + clock + signature-verifier + cache store (testable in-process, mirroring `UpdateService` from 13.6).
- **`InstallEngine`** — given a listing + chosen version: download → verify sha + signature → unpack → `AppInstaller.install`. Wires the existing TOFU trust store (publisher-key-per-app-id, [14 §Trust model](14-app-store.md)) and capability-consent modal.
- The **`MarketplaceService`** gains a third source alongside installed-rows and the first-party bundle catalog: remote catalog listings (the `ListingSource.Catalog` producer that's currently absent). Its kind-agnostic shape needs no change.

The install button on the Marketplace detail page (14.18, already shipped as a UI shell) calls `InstallEngine.install(listingId, channel)` through a new `marketplace.install` capability (shell-only, already reserved in [47 §Capability surface](47-marketplace.md)).

## The update engine (client)

Periodic + on-demand reconciliation of catalog-sourced installs against the live catalog. Reuses 14's update-behavior rules verbatim:

```
update tick (every few hours · on demand · at launch if index is stale)
  refresh signed catalog index (CatalogClient)
  for each installed app where source ∈ {BootstrapCache, Catalog}:
     resolved = index.resolveVersion(app.id, app.channel)        // per-app channel
     if resolved.version > app.version:
        if resolved adds NO new capabilities beyond current grants:
           auto-update on next launch  (subject to user setting, OQ-14)   → AppInstaller.update()
        else:
           surface "Update available — N new permissions"; prompt the capability diff   → AppInstaller.update()
        verify sha + signature + publisher-key continuity (TOFU / rotation) before applying
```

- **First-party apps update here**, because they're stamped `source=BootstrapCache` or `Catalog` with `catalog_id=brainstorm-official` — there is no separate first-party update code path (the unification decision).
- **Capability changes are never silent** (restated from [14](14-app-store.md)): a version that requests new caps always prompts the diff, regardless of channel or auto-update setting. `AppInstaller.update()` already diffs + grants/revokes; the engine adds the *consent gate* before calling it.
- **Sideloaded / local-file installs are not auto-updated** (no catalog to poll); they show "installed from file" and update only via re-sideload.

> **Decision:** the update engine reuses **`AppInstaller.update()`** unchanged — the same routine the 13.10 packaged-upgrade path uses. The engine is the *fetch + verify + consent* layer above it; the installer stays the single chokepoint for registry mutation + capability diffing. No second update mechanism is introduced.

## Migration off seeding

Staged so each step is shippable and verifiable in the in-process pipeline (per [CLAUDE.md §Reproduce before you patch](../../CLAUDE.md)):

| Step | Change | Removes |
|---|---|---|
| **M1** | Add registry provenance ([§Schema changes](#registry-schema-changes-v9-landed--1429)). Backfill existing rows as `source=BootstrapCache, catalog_id=brainstorm-official`. ✅ landed (14.29). | — |
| **M2** | Rename/refit `seedPackagedApps` → **`bootstrapApps`**: same install-from-`extraResources` behavior, but installs the curated `BOOTSTRAP_SET` (not all 21) and stamps provenance. Same offline-first throw-on-missing-resources contract. ✅ landed (14.30; `BOOTSTRAP_APPS` = Notes/Files/Database/Tasks/Calendar). | The "binary defines the full app set" assumption (the rest become catalog-only). |
| **M3** | Land `CatalogClient` + `InstallEngine`; wire the Marketplace install button + `ListingSource.Catalog`. Non-bootstrap first-party apps + third-party apps now install from the catalog. | The Marketplace's inability to install anything not in the binary. |
| **M4** | Land the update engine; first-party (and third-party) apps update from the catalog. | First-party updates being welded to the shell binary (problem #2). |
| **M5** | Retire the **dev demo-seeder** (`seed-demo-apps.ts`'s rebuild-every-boot loop) in favor of a **dev catalog** (a `file://` or `localhost` catalog the dev shell subscribes to) + a `brainstorm-cli dev` install. Dev iteration becomes "rebuild + bump version → dev catalog → update engine picks it up," matching production semantics instead of forking them. | The demo seeder entirely. |

> **Decision:** the dev demo-seeder is retired **last** (M5), and only once the catalog-driven path is proven, because it's the workhorse of every dogfood session today. Until M5, dev keeps seeding; M2–M4 are exercised against a **dev catalog fixture** in the in-process pipeline first. We do not delete the seeder before its replacement is real (avoids a "patch → ask user to retest" loop on the most-used dev affordance).

> **Decision:** `FIRST_PARTY_APPS` stays as the **canonical roster of Brainstorm-authored apps** (the marketplace reads it so first-party apps remain visible-as-installable after uninstall — the bug its header documents). Post-migration it's annotated with `bootstrap: boolean` (is it in the offline cache) and remains the build-time input to the publish pipeline + bundle-cache refresh. It stops being the *installer's* source of truth (the catalog is) and becomes *metadata about what Brainstorm publishes*.

## Registry schema changes (v9) *(landed — 14.29)*

Additive migration on `registry.db` `apps`. **The migration is v9, not v8** — the v8 slot was already taken by the intent presentation-metadata migration (doc 63 / AS-3); the next free version was 9. Pre-existing rows backfill to `bootstrap-cache` / `brainstorm-official` / `stable` (column defaults + a one-shot `UPDATE` for `catalog_id`).

```sql
-- v9: install provenance
ALTER TABLE apps ADD COLUMN install_source   TEXT NOT NULL DEFAULT 'bootstrap-cache';  -- InstallOrigin enum
ALTER TABLE apps ADD COLUMN catalog_id       TEXT;            -- e.g. 'brainstorm-official'; NULL for sideload/local
ALTER TABLE apps ADD COLUMN channel          TEXT NOT NULL DEFAULT 'stable';           -- UpdateChannel enum (per 13.6)
ALTER TABLE apps ADD COLUMN publisher_key    TEXT;            -- Ed25519 publisher key the install trusts (TOFU anchor)
ALTER TABLE apps ADD COLUMN catalog_version  TEXT;            -- the catalog version this install corresponds to
UPDATE apps SET catalog_id = 'brainstorm-official' WHERE install_source = 'bootstrap-cache';
```

The provenance discriminator is a TS string enum named **`InstallOrigin`** (not `InstallSource` — that name is already the installer's *input* type `{ bundleDir }`), per [CLAUDE.md §Enums](../../CLAUDE.md):

```ts
export enum InstallOrigin {
  BootstrapCache = 'bootstrap-cache',   // installed from the binary's offline cache on first run
  Catalog        = 'catalog',           // fetched + installed from a (the official or a third-party) catalog
  Sideload       = 'sideload',          // direct manifest URL
  LocalFile      = 'local-file',        // a .brainstorm on disk (dev / private)
  Dev            = 'dev',               // dev demo-seeder (retired at M5)
}
```

> **Decision:** `publisher_key` is recorded **per install** even though `signature_key_id` (13.2) overlaps — `signature_key_id` is "who signed this bundle's manifest" (advisory, may be null for unsigned), while `publisher_key` is "the TOFU anchor this app id is bound to for future updates." They coincide for signed first-party apps but are distinct concepts ([14 §Trust model](14-app-store.md) vs §Key rotation). The `license_issuer_trust` table in [47](47-marketplace.md) is the post-v2 commerce analog; this is the install-trust analog.

Each new column is written by `AppInstaller` from an `InstallProvenance` argument the bootstrap installer / install engine supplies; the existing repos (`AppsRepository`) gain the typed fields. No inline SQL outside the repo (per [CLAUDE.md §Repository pattern](../../CLAUDE.md)).

## Phasing / iterations

These slot into [implementation-plan.md](../implementation-plan.md) Stage 14 alongside the marketplace iterations 14.17–14.28 from [47](47-marketplace.md). They are **v2** (the catalog is a v2 surface), with M1/M2 (provenance + bootstrap refit) landable earlier as beta-hardening since they only refit the existing seeder.

| Iteration | Phase | Scope |
|---|---|---|
| **14.29** ✅ | v2 (M1) | Registry provenance — schema **v9** + `InstallOrigin` enum + `InstallProvenance` threaded through `AppInstaller` + `AppsRepository`; backfill existing rows. *Landed 2026-06-22.* |
| **14.30** ✅ | v2 (M2) | Bootstrap installer — `seedPackagedApps` → `bootstrapApps`; curated `BOOTSTRAP_SET` (Notes/Files/Database/Tasks/Calendar); offline-first; stamps `BootstrapCache` provenance (dev seeder stamps `Dev`). `FIRST_PARTY_APPS` annotated `bootstrap`; `BOOTSTRAP_APPS` export. *Landed 2026-06-22.* |
| **14.31** ✅ | v2 (M3) | `CatalogClient` — signed index fetch + offline Ed25519-verify (over the exact base64url payload) + last-good cache + per-channel resolve; `ListingSource.Catalog` producer in `MarketplaceService`. Pure core + client + 37 tests. *Landed 2026-06-22 (live shell wiring with 14.32).* |
| **14.32** ✅ | v2 (M3) | `InstallEngine` — resolve → download → **integrity (sha256)** + **authenticity (Ed25519/TOFU)** gates → unpack → `AppInstaller.install` (Catalog provenance). Core + `CatalogFileCache` + bindings (2026-06-22); **live-wired (`catalog-runtime` + Marketplace Install button) + verified end-to-end in-process AND over live HTTP** (2026-06-23). |
| **14.33** ✅ | v2 (M4) | Update engine — `planCatalogUpdates` + `UpdateEngine.check()` (capability-delta classify: Auto vs NeedsConsent) + `applyAuto()`/`apply()` → `AppInstaller.update`; first-party apps update independent of the shell binary; shared `acquireBundle` (integrity+authenticity) with 14.32. +24 tests. *Landed 2026-06-22 (live refresh/consent-UI with 14.34).* |
| **14.34** ◑ | v2 | First-party publish pipeline. **Package format LOCKED + landed 2026-06-22** (OQ-LC-7 → tar+gzip): `main/catalog/brainstorm-package.ts` — pack/unpack(+to-dir, zip-slip-guarded)/sha256/sign/verify, reusing the `.bsbundle` codec, +14 tests. **Publish core + catalog serving landed**: `catalog-publish.ts` + `tools/publish-first-party-catalog.ts` pack+sign all 20 apps into real `.brainstorm` bundles + a real-signed index; **catalog-edge serves them** (`FileCatalogStore` + `GET /assets/*`, cloud 3.4c) — verified live end-to-end (real index → served a 6.7 MB bundle, traversal-guarded). **Live install wiring landed + verified (2026-06-23)** — `catalog-runtime` + `marketplace-handlers` route the Marketplace Install button through the live engine; proven in-process + over live HTTP (notes + graph installed from a running catalog-edge). *Remaining:* CI automation of the publish + bundle-cache refresh + the live **update-flow** UI (periodic `UpdateEngine` + consent prompt) + a real-shell Electron Marketplace dogfood. **Security (from 14.33 review): the live install/update IPC must route catalog updates *only* through `UpdateEngine` (the consent classifier) — `AppInstaller.update` grants `diff.added` unconditionally at the chokepoint (the seeder relies on that), so the consent gate lives one layer up; the engines are the only sanctioned catalog→installer path.** **Locks the `.brainstorm` package compression** (the packer + the client `unpack` must agree): lean **tar+gzip** (Node-core `zlib`, already used by `.bsbundle`) over the tar+zstd sketch in [14](14-app-store.md), which would need a native dep the shell lacks — tracked as [OQ-LC-7](../reference/11-open-questions.md). |
| **14.35** | v2 (M5) | Retire the dev demo-seeder → dev catalog fixture + `brainstorm-cli dev`; dogfood iteration moves to catalog semantics. |

Cloud-side (`../brainstorm-cloud/docs/plan.md` Phase 3.4, expanded): the catalog index endpoint + signing, bundle object storage + CDN, admin authoring (Phase 4.3 review queue), and the first-party CI publish automation.

## Open questions

Added to [11-open-questions.md](../reference/11-open-questions.md) under a new "App lifecycle and catalog (added in 59)" subsection:

- **OQ-LC-1** — Membership of the offline `BOOTSTRAP_SET`. Lean: Notes, Files, Database, Tasks, Calendar (the everyday core); all other first-party apps install from the catalog on demand. Trade-off: larger set = better offline first-run, bigger binary + more bundle-cache refresh churn per shell release.
- **OQ-LC-2** — Should the catalog index be a single document, or paginated/sharded once the listing count is large? Lean: single signed document for v2 (listing count is small); shard with a signed manifest-of-shards when it grows. Sign per-shard.
- **OQ-LC-3** — Bundle-cache refresh cadence (publish step 6): refresh the `extraResources` bootstrap bundles every shell release (simple, always-fresh-enough) vs only on demand (smaller diffs)? Lean: every release — the cache only needs to be "recent enough that first-run isn't badly stale," and the update engine fixes staleness immediately when online.
- **OQ-LC-4** — Dev-catalog mechanism (M5): a `file://` catalog the dev shell subscribes to, vs a tiny `localhost` catalog server, vs a `brainstorm-cli dev --watch` that re-publishes on rebuild. Lean: `localhost` catalog server reusing the real `CatalogClient` so dev exercises the production verify path (signature optional in dev).
- **OQ-LC-5** — Rollback: if a catalog app update is bad, does the shell keep the prior bundle to roll back to (the installer keeps bundle dirs on disk per-version today — uninstall doesn't vacuum), and is rollback user-initiated or automatic on launch-crash detection? Lean: keep N-1 bundle, user-initiated rollback from the Library row in v2; crash-loop auto-rollback is post-v2.
- **OQ-LC-6** — Does removing demo seeding change the **Welcome/onboarding** flow ([Welcome-2](../implementation-plan.md))? A fresh vault now bootstraps the core set offline, but the "here are apps to add" discovery moment now points at the catalog — needs an onboarding hand-off to the Marketplace. Lean: yes, onboarding gains a "browse the catalog" step once online; out of scope for this doc, flagged for Welcome-2.

## Cross-doc reconciliation

- **[14-app-store.md](14-app-store.md)** — add a forward-link from §Install protocol + §Update channels to this doc (this doc is the concrete catalog + runtime engine behind 14's abstract "manifest URL" + "the shell checks periodically").
- **[47-marketplace.md](47-marketplace.md)** — link from §Distribution channels + §Install flow; note `ListingSource.Catalog` is produced by `CatalogClient` (this doc), and that first-party apps are catalog entries.
- **[32-store-verification.md](32-store-verification.md)** — the threat-intel feed endpoint joins the catalog API surface here; no posture change.
- **[implementation-plan.md](../implementation-plan.md)** — add iterations 14.29–14.35; note the migration steps M1–M5.
- **[../brainstorm-cloud/docs/plan.md](../../../brainstorm-cloud/docs/plan.md)** — expand Phase 3.4 into the catalog index endpoint + signing + bundle storage + first-party publish automation sub-tasks.
- **[00-index.md](../00-index.md)** — insert in the Distribution-and-trust section as 25e, after 25d (marketplace).

## Summary

- **Seeding is replaced, not patched.** The bundle cache becomes an *offline-first cache of catalog entries*; the **catalog** is the source of truth for what's installable and current.
- **First-party apps are ordinary, unified catalog entries** signed by the Brainstorm key. A curated subset is pre-cached for offline first-run; the rest install on demand.
- **Two update planes stay separate** — the shell binary updates on its own cadence (13.6); installed apps (first-party included) update from the catalog. **Default apps update separately from the shell**, which is the whole point.
- **The catalog API is a signed, offline-verifiable, CDN-shaped read surface** — a signed index (roster + per-channel versions), content-addressed signed bundles, a threat-intel feed. Third-party catalogs implement the same contract.
- **The publish pipeline** is one contract, two author tracks: first-party CI (build→pack→sign→upload→list) and the third-party developer portal — both landing in the same catalog through the same review lane.
- **The install/update engines sit above the existing `AppInstaller`** — they add fetch + verify + consent; the installer stays the single chokepoint for registry mutation and capability diffing. No second install/update mechanism is introduced.
- **Migration is staged M1–M5**, retiring the dev seeder last, behind a proven catalog path, with a dev catalog fixture exercising the production verify path.
- **Lands in Stage 14** (iterations 14.29–14.35), with provenance + bootstrap refit (M1/M2) landable earlier as beta-hardening.
</content>
</invoke>
