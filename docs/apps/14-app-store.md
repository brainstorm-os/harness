# 14 — App store

This doc covers how apps reach users in Brainstorm: package format, install protocol, distribution channels, update channels, discovery in the shell, trust and revocation, and developer onboarding. It builds on [03-app-model.md](03-app-model.md) (what an app is) and [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (the trust model).

## Goals

The app distribution system has to satisfy:

1. **Frictionless install** for the user — review capabilities, confirm, done.
2. **No mandatory marketplace** — users can install from a URL, a local file, or a third-party catalog.
3. **Verifiable provenance** — the user can know which key signed an installed app and whether updates come from the same author.
4. **Rapid iteration for developers** — load an unsigned dev build for testing in seconds; sign for distribution when ready.
5. **No lock-in** — Brainstorm is not a marketplace product; we never *require* developers to publish through us.

Brainstorm's app store is one channel among several. The shell can install from any of them.

> **Note:** the same store + manifest-URL + signing infrastructure also distributes **themes** (and their components — token sets, icon packs, typography). The package format below carries a `manifest.kind` discriminator (`"app"` vs. `"theme"`); themes are passive data with a much smaller threat surface but reuse this doc's entire mechanism. See [40-theme-store.md](40-theme-store.md) for the theme-specific surface (live preview, author profiles, catalog ratings, accessibility validation, paid-themes posture).

## Package format

> **Decision:** apps ship as a single signed archive: `<id>-<version>.brainstorm`. ~~Internally a tar+zstd archive~~ **Superseded (OQ-LC-7, 14.34): tar + gzip** — zstd needs a runtime the shell can't guarantee; gzip is Node-core and the format reuses the deterministic `.bsbundle` codec (`main/bundle/bundle-archive.ts`). See [59 §14.34](59-app-lifecycle-and-catalog.md) + `main/catalog/brainstorm-package.ts`.

```
io.example.text-editor-1.4.2.brainstorm
└── (extracted)
    ├── manifest.json              // identity, capabilities, registrations
    ├── dist/                      // bundle assets
    │   ├── index.html
    │   ├── main-<hash>.js
    │   └── ...
    ├── assets/                    // icons, screenshots, schemas
    │   ├── icon.png
    │   └── schemas/note.v1.json   // entity-type schemas, if any (per OQ-2)
    └── SIGNATURES/
        ├── manifest.sig           // signature over manifest.json
        ├── bundle.sig             // signature over the bundle's content hash
        └── pubkey.pem             // signing public key (or pointer)
```

- The archive is **content-addressable**. A given `id`+`version` always has the same hash; updates change the hash; the shell records the hash on install for later integrity checks.
- The archive is **verifiable** offline. Once you have the bundle, you can verify the signature against the embedded public key; key trust is a separate question the shell answers via its trust store.
- The format is **inspectable** — `tar -I zstd -tf …` works on any system, no Brainstorm-specific tooling needed to look inside.

> **Open:** does the package format allow native modules (compiled binaries) at any point, or is it pure JS/asset bundle forever? Native modules massively complicate signing and platform compatibility. Tracked as OQ-22 in [11-open-questions.md](../reference/11-open-questions.md).

## Identity and signing

Every app has a **signing key** — an Ed25519 keypair. The public key is part of the app's identity (along with `id` and `version`).

### v1 phasing

> **Decision:** v1 ships with **soft signing** — apps may be signed; signed apps are preferred but unsigned apps install with extra warnings. v2 makes signing **mandatory** for non-dev installs.

This phasing exists because v1's developer ecosystem will be tiny and we don't want signing to be a barrier to first-day developers. By v2, signing infrastructure (key generation, rotation, revocation) is mature enough to require.

### Trust model

When an app is installed for the first time:

- The user sees: app id, version, requested capabilities, **signing key fingerprint**, source (where the bundle came from).
- The user confirms; the public key is recorded as **trusted-on-first-use** for that app id.
- All future updates for that app id must verify against the same key (or a key signed by the original — see *key rotation* below).

If a malicious party replaces the app's manifest URL or hosts a different bundle at the same URL, the signature mismatch fails verification and the user sees a strong warning ("This app's signing key has changed. Either the developer rotated their key, or someone is impersonating this app.").

### Key rotation

A developer rotating their signing key publishes a small **rotation record** signed by the *old* key, declaring the *new* key trusted for the same app id. The shell verifies the rotation chain on update.

> **Open:** is rotation a v1 feature or v2? It's not necessary for v1 but designing it in from the start avoids rework. Tracked as OQ-23.

### Revocation

If a key is compromised, the developer can publish a **revocation record** (signed by a backup key, or via a recovery flow). The shell checks revocations during update; revoked keys mean updates from that key are refused. Already-installed apps continue to work — revocation is forward-looking.

> **Decision:** revocation does not auto-uninstall. The user is informed and given the choice to uninstall or to migrate to a re-signed bundle. We do not silently delete the user's data and apps.

## Install protocol

The unit of installation is a **manifest URL** — a URL pointing at a JSON document describing where to fetch the bundle.

```jsonc
// https://example.com/text-editor/manifest.json
{
  "id": "io.example.text-editor",
  "currentVersion": "1.4.2",
  "channels": {
    "stable": "1.4.2",
    "beta":   "1.5.0-beta.3",
    "dev":    "1.5.0-dev.20260509"
  },
  "versions": {
    "1.4.2": {
      "url": "https://example.com/text-editor/io.example.text-editor-1.4.2.brainstorm",
      "sha256": "ab12...",
      "signature": "..."
    },
    "1.5.0-beta.3": { ... },
    "1.5.0-dev.20260509": { ... }
  },
  "publisherKey": "ed25519:...",
  "metadata": {
    "name": "Text Editor",
    "description": "...",
    "iconUrl": "https://example.com/text-editor/icon.png",
    "screenshots": ["https://example.com/...", "..."],
    "tags": ["editor", "rich-text"],
    "categories": ["Productivity"],
    "homepage": "https://example.com/text-editor",
    "source": "https://github.com/example/text-editor",
    "license": "MIT"
  }
}
```

A manifest URL is what travels — pasted into the shell's "Install from URL" dialog, shared as a link, indexed by directories. The shell fetches the manifest, fetches the chosen channel's bundle, verifies signature against the publisher key, and offers the install confirmation.

> **Forward link:** the concrete **catalog** behind this abstract manifest-URL model — the signed catalog index, the bundle delivery + integrity path, the shell-side `CatalogClient` / `InstallEngine` / update engine, the offline-first bundle cache that replaces the demo seeder, and the first-party publish pipeline — is in [59-app-lifecycle-and-catalog.md](59-app-lifecycle-and-catalog.md). That doc is the runtime + ops layer; this doc is the format + protocol it implements.

> **Decision:** manifest URLs are public, stable identifiers for an app. They are the unit of sharing.

> **Decision:** the shell fetches the **bundle** lazily (only when the user confirms install). The manifest itself is small and can be checked frequently for updates.

## Distribution channels

The shell can install from four kinds of source:

### 1. The official Brainstorm registry

A directory of curated apps, hosted by Brainstorm's organization. Indexed by name, category, popularity.

> **Decision:** the official registry is **non-exclusive**. Apps may be listed there *and* distributed elsewhere. Inclusion is a convenience, not a requirement.

The registry's role is discovery, not gating: users browse, click "install", which is the same install protocol applied to a registry-supplied manifest URL.

### 2. Third-party catalogs

Anyone can run a registry. The format is the same: a directory of manifest URLs with metadata. The user can add a third-party catalog to their shell ("subscribe to this catalog"), and the registry's contents appear alongside the official one (visually distinguished).

> **Decision:** third-party catalogs are first-class. Brainstorm's own registry is just the default catalog the shell ships with subscribed.

### 3. Direct manifest URL (sideload)

The user pastes a manifest URL into the shell. Same install flow as the registry, no intermediary.

This is the path for:
- Internal/enterprise apps (private URL).
- Beta testing new apps before listing.
- Apps the developer doesn't want to list publicly.

### 4. Local file (developer mode)

A `.brainstorm` archive on disk, optionally unsigned. The shell installs it after confirming the user understands it's unverified.

> **Decision:** local-file installs run in the same sandbox as any other app. They get **no extra capabilities**. Developer-mode is about source, not privilege.

## Update channels

Per the manifest, an app can publish multiple channels. The shell tracks each app's *subscribed channel* (default `stable`). Users can switch channels per-app (e.g. opt one specific app into `beta`).

> **Decision:** channels are per-app, not per-shell. A user might run a stable text editor and a beta database app in the same shell.

### Update behavior

The shell checks for updates periodically (every few hours; on demand by the user; at app launch if cached version is older than a threshold). When a new version on the subscribed channel is found:

- If new version requests **no new capabilities** beyond what was already granted: the shell may auto-update on next app launch (subject to user setting — see OQ-14).
- If new version requests **new capabilities**: the user is prompted with a clear diff before installing.
- If the signature fails to verify, the update is refused; the user is alerted.

> **Decision:** an app can never *silently* gain capabilities. Capability changes are always re-prompted, regardless of channel or auto-update setting.

> **Forward link:** "the shell checks periodically" is implemented by the **update engine** in [59 §The update engine](59-app-lifecycle-and-catalog.md#the-update-engine-client). Note the **two-plane separation** that doc establishes: installed apps (first-party included) update from the **catalog** on this cadence; the Electron **shell binary** updates on its own cadence ([implementation-plan §13.6](../implementation-plan.md)). A first-party app fix is a catalog version, not a shell release.

## Discovery in the shell

The dashboard's app store surface (a privileged dashboard view, not a separate app) shows:

- **Featured / curated** picks from the official registry and any subscribed catalogs.
- **Search** across catalog metadata (name, description, tags).
- **Categories** — Productivity, Editors, Viewers, etc.
- **Installed** — what's on this device, with status (up to date / update available / channel).
- **Sources** — the catalogs the user is subscribed to, with a way to add or remove.

App detail pages show: description, screenshots, capability requirements (with explanations), publisher key fingerprint, version history per channel, source/homepage links, license.

> **Decision:** the app store surface is **not** an app. It's a privileged shell view, with direct access to the registry/install services. Reasoning: it must be present even when no apps are installed and must be incapable of being replaced by an arbitrary app (which would be a phishing vector).

> **Open:** can third-party apps register themselves as additional discovery surfaces (e.g. a "curated for science research" app that's effectively a custom storefront)? Useful but a privilege-escalation risk to design carefully. Tracked as OQ-24.

## What metadata catalogs MUST and MAY publish

For an entry in any catalog:

**Required:** `id`, `currentVersion`, manifest URL, name, description, icon URL, publisher key.

**Recommended:** screenshots, tags, categories, homepage, source repo URL, license.

**Optional / catalog-specific:** ratings, install counts, review excerpts, tags, badges.

> **Decision:** the shell renders only the *Required* and *Recommended* fields in a uniform way. Catalog-specific metadata is shown but visually attributed ("via official-registry").

## Economic model

Out of scope for v1.

For v2, possibilities include: paid apps via the official registry, license-key activation handled by the app itself (off-platform), donations/voluntary tipping, enterprise licensing. The package format and install protocol intentionally do not encode any of these — they are concerns of catalogs and apps, not the platform.

> **Decision:** Brainstorm v1 takes no commercial position. The platform itself does not handle payments, licenses, or app activation.

> **Decision (v2):** the full economics of catalog-mediated commerce — what fee applies, how it's collected, how Brainstorm Commerce (managed payments) works — is in [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md) and [45-payments-architecture.md](../platform/45-payments-architecture.md). Headline: **0% catalog fee under $10k/year revenue per developer, 15% above; sideload installs always 0%** (resolves OQ-81). Managed payments ("Brainstorm Commerce") ships post-v2 (resolves OQ-80).

> **Forward link:** the user-facing store surface (browse / install / library / updates / wallet / sources), the extensible content-kind registry, the developer portal at `developers.brainstorm.app`, and the operational fee mechanics are unified in [47-marketplace.md](47-marketplace.md). The app-store mechanism documented here is the foundation; 47 is the product shape that builds on it.

## Developer onboarding

For v1, the onboarding is intentionally lightweight — there's no developer account, no submission process, no review. The flow is:

1. Build the app (recommended track in [13-frontend-stack.md](../shell/13-frontend-stack.md), against the SDK in [08-app-sdk.md](08-app-sdk.md)).
2. Generate a signing keypair (one-line `brainstorm-cli keygen`, or any Ed25519 tool).
3. Build the bundle (`brainstorm-cli pack ./my-app` produces `io.example.my-app-1.0.0.brainstorm`).
4. Sign and host it.
5. Share the manifest URL.

For listing in the official registry: a separate manual application later, when the registry exists. Not a v1 blocker.

> **Decision:** there is no submission/review process before an app can be installed. Sandboxing and capability prompts are the user's protection, not a centralized review.

## CLI

> **Decision:** Brainstorm ships a `brainstorm-cli` for developer-side workflows: `keygen`, `pack`, `sign`, `verify`, `manifest` (generate a manifest skeleton), `dev` (load an unsigned bundle into a shell with developer mode enabled).

The CLI is a separate distribution from the shell. Most users never need it.

## Threats and mitigations recap

This section restates threats from [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) in the context of distribution:

- **Malicious bundle on a hijacked URL** → signature verification fails (publisher key mismatch); user warned.
- **Compromised publisher key** → revocation record stops future updates; existing installs flagged.
- **Phishing app posing as another** → distinct signing keys; key fingerprint visible at install; same id collision impossible (registry rejects, manifest URL is the user's anchor of trust).
- **Update with new capabilities** → re-prompted, never silent.
- **Sideloaded malware** → sandboxed like any app; capability prompts apply; user accepts the absence of a publisher signature with explicit warning.

## Phasing

| Capability                   | v1                           | v2                      |
|------------------------------|------------------------------|-------------------------|
| Manifest URL install         | yes                          | yes                     |
| Local file install           | yes                          | yes                     |
| Official registry            | minimal listing, manual add  | full discovery surface  |
| Third-party catalogs         | yes (manual subscribe)       | yes                     |
| Signing                      | optional, encouraged         | mandatory               |
| Auto-update                  | manual / opt-in              | opt-in default-on       |
| Key rotation                 | not present                  | yes                     |
| Revocation                   | manual checks                | automated checks        |
| Paid apps                    | no                           | up for design           |
| Submission / review          | no                           | no (curation by listing only) |
