# 40 — Theme store

This doc covers how **themes** (and their components) reach users in Brainstorm. Themes share the app-store's distribution machinery — package format, manifest URL, signing, channels, catalogs, discovery, threat-intel — but with a different payload (passive design data, no code) and a few theme-specific surfaces (live preview, author profile, ratings, paid themes later).

It builds on [13-frontend-stack.md §Themes](../shell/13-frontend-stack.md) (what a theme is — token set + icon pack + typography composite), [36-design-system.md](../shell/36-design-system.md) (the token namespace themes target), [14-app-store.md](14-app-store.md) (the distribution mechanics this doc reuses), [32-store-verification.md](32-store-verification.md) (continuous trust + threat-intel), and [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (the trust posture).

> **Decision:** themes are distributed exactly the way apps are — through the same store, the same manifest-URL protocol, the same signing trust chain, the same install / update / remove lifecycle, the same catalog channels. The user installs a theme the way they install an app. Everything theme-specific in this doc is *additive* on top of [14-app-store.md](14-app-store.md), not a parallel mechanism.

This collapses two ecosystems into one. A user looking for "a dark theme by author X" uses the same store surface they use to find "a calendar app by author Y." Catalogs list both. Subscriptions, ratings, revocations all flow through one infrastructure.

## What's distributed

A theme is a **composite** of three entities (per [13-frontend-stack.md §Themes](../shell/13-frontend-stack.md)):

| Component   | Entity type                  | What it specifies                              |
|-------------|------------------------------|------------------------------------------------|
| Token set   | `brainstorm/TokenSet/v1`     | Concrete values for every semantic token.       |
| Icon pack   | `brainstorm/IconPack/v1`     | SVGs keyed by canonical icon name.              |
| Typography  | `brainstorm/Typography/v1`   | Font stacks + scale.                            |
| Composite   | `brainstorm/Theme/v1`        | References one of each.                         |

> **Decision:** each component is **independently distributable** through the store. A theme package may ship any subset:
> - A standalone token set ("Solarized Dark token set, pairs with Phosphor").
> - A standalone icon pack ("Hand-drawn icon pack, pairs with anything").
> - A standalone typography choice ("Serif Reading typography").
> - A composite Theme that references components it ships *and/or* references components the user already has installed.

The same store surface lists all four kinds, with a `kind` filter so the user can browse "themes vs token sets vs icon packs vs typography." Mix-and-match is the point.

A composite Theme that references a component the user doesn't have triggers an install of that dependency (with the user's confirmation, surfacing the same provenance — author, fingerprint, license — for every dependency).

## Package format

> **Decision:** themes ship in the same `.brainstorm` archive format as apps (per [14 §Package format](14-app-store.md)), distinguished by `manifest.kind: "theme"`. The format and tooling are shared; only the payload schema differs.

```
io.example.solarized-dark-2.1.0.brainstorm
└── (extracted)
    ├── manifest.json              // kind: "theme", identity, dependencies, metadata
    ├── theme/                     // theme payload (replaces apps' dist/)
    │   ├── tokens.json            // TokenSet values, if shipped
    │   ├── icons/                 // IconPack SVGs, if shipped
    │   │   ├── save.svg
    │   │   └── ...
    │   ├── typography.json        // Typography spec, if shipped
    │   ├── fonts/                 // optional bundled font files
    │   │   └── *.woff2
    │   └── theme.json             // composite reference, if this is a composite
    ├── assets/
    │   ├── icon.png               // store-listing icon
    │   ├── preview-light.png      // dashboard rendered with this theme (light variant)
    │   ├── preview-dark.png       // dashboard rendered with this theme (dark variant)
    │   └── screenshots/           // optional extra screenshots
    └── SIGNATURES/                // same as apps
        ├── manifest.sig
        ├── bundle.sig
        └── pubkey.pem
```

> **Decision:** theme packages **must not contain executable code**. The bundle validator rejects packages whose `theme/` tree contains `.js`, `.wasm`, `.html`, native binaries, or SVGs with active content (`<script>`, foreign-object embedding, `javascript:` URIs, on* attributes). Themes are passive data; the security review that applies to apps doesn't apply because there's nothing to review for execution behavior.

This is the single biggest reason themes are a separate `kind` in the manifest: it shifts validation from *behavioral analysis* (what does this app do at runtime?) to *static lint* (does this data conform to the token namespace and pass the safety filters?). The result is a much cheaper review and a faster path from author to catalog.

## Identity, signing, trust

Identical to apps (per [14 §Identity and signing](14-app-store.md)):

- Every theme has an **Ed25519 publisher key**. The public key is part of the theme's identity.
- **Trust on first use (TOFU)** — the user confirms the fingerprint on first install; future updates must verify against the same key (or a key signed by the original — rotation chain).
- **Revocation** records, **key rotation** records, and the **same-key requirement on updates** all apply unchanged.
- **Threat-intel feed** entries (per [32-store-verification.md](32-store-verification.md)) carry the same `packageId` / `publisherKey` shape. A theme with a malicious icon pack (e.g., SVG with hidden tracking) can be flagged the same way a malicious app can.

> **Decision:** v1 ships theme signing as **soft signing** (matching apps' v1 posture). v2 makes signing **mandatory** for catalog-listed themes. Local sideload always works, with explicit unsigned warnings.

## Install protocol

Same manifest-URL flow as apps. The manifest JSON is shaped identically, with `kind: "theme"`:

```jsonc
// https://example.com/themes/solarized/manifest.json
{
  "id": "io.example.solarized-dark",
  "kind": "theme",                                       // distinguishes from "app"
  "currentVersion": "2.1.0",
  "channels": {
    "stable": "2.1.0",
    "beta":   "2.2.0-beta.1"
  },
  "versions": {
    "2.1.0": {
      "url": "https://example.com/themes/solarized/io.example.solarized-dark-2.1.0.brainstorm",
      "sha256": "ab12...",
      "signature": "..."
    }
  },
  "publisherKey": "ed25519:...",
  "components": {
    "tokenSet":   { "id": "io.example.solarized-dark.tokens",   "version": "2.1.0" },
    "iconPack":   { "extends": "shadcn/phosphor-regular" },     // reference, not shipped
    "typography": { "id": "io.example.solarized-dark.serif",    "version": "2.1.0" }
  },
  "metadata": {
    "name": "Solarized Dark",
    "author": { "displayName": "Ethan Schoonover", "url": "https://ethanschoonover.com" },
    "description": "Classic precision-balanced palette tuned for Brainstorm.",
    "iconUrl": "https://example.com/themes/solarized/icon.png",
    "previewLight": "https://example.com/themes/solarized/preview-light.png",
    "previewDark": "https://example.com/themes/solarized/preview-dark.png",
    "screenshots": ["..."],
    "tags": ["dark", "low-contrast", "reading", "minimal"],
    "categories": ["Dark themes", "Reading"],
    "appearance": "dark",                                // light | dark | both
    "wcagLevel": "AA",                                   // contrast-lint result
    "homepage": "https://example.com/themes/solarized",
    "source": "https://github.com/example/solarized-brainstorm",
    "license": "MIT"
  }
}
```

`components` declares whether this package *ships* each piece (`id` + `version`) or merely *references* one that the user must have (`extends: "<other-package-id>"`). Composite themes can reference shell-bundled components (`shell/default-light`, `shadcn/phosphor-regular`) so the package itself stays small.

The shell fetches the manifest, fetches the bundle on confirm, verifies the signature, validates payload (see *Validation* below), and offers the install confirmation with metadata + preview + capability summary (which is always "none" for themes).

## Distribution channels

Same four channels as apps (per [14 §Distribution channels](14-app-store.md)):

1. **Official Brainstorm registry.** Themes and apps share one registry, filtered by kind in the store UI.
2. **Third-party catalogs.** A catalog can host apps and themes side-by-side, or specialize in one (e.g. a "Themes by Design Studio X" catalog).
3. **Direct manifest URL (sideload).** Paste a theme manifest URL into the shell. Same flow as apps.
4. **Local file.** A `.brainstorm` archive on disk, optionally unsigned. Used by theme authors testing locally.

> **Decision:** the official registry's listing criteria for themes parallel apps: signed, passes automated review (static validation only — no behavioral analysis), publisher accountable. Inclusion is non-exclusive — a theme listed in the official registry can also be distributed via the author's website or other catalogs.

## Discovery in the shell

The dashboard's store surface (a privileged shell view, per [14 §Discovery in the shell](14-app-store.md)) has a top-level **Apps / Themes** tab split. The themes view shows:

- **Featured / curated** picks.
- **Browse by category** — Dark, Light, High-contrast, Reading, Minimal, Brand-friendly, Hand-drawn-icons, etc.
- **Browse by component** — token sets only, icon packs only, typography only, or composites.
- **Search** across name, description, tags, author display name.
- **Installed** — themes (and components) on this device; status (active / installed / update available).
- **Active** — the theme currently in use (single highlighted entry).
- **Sources** — catalogs subscribed.

A theme detail page shows:

- **Name + author.** Author display name links to an *author profile* page (more from this author) keyed on the publisher key.
- **Preview** — light + dark variants (per the manifest's preview assets) rendered at dashboard scale. The "Try it" affordance applies the theme transiently for live preview without committing (see *Live preview* below).
- **Screenshots** — additional surfaces (settings, editor, etc.) at the author's discretion.
- **Description.**
- **Rating** — aggregated 1–5 stars, supplied by the catalog (see *Ratings and reviews* below). Always attributed to the source catalog.
- **Install count** — supplied by the catalog. Attribution displayed.
- **Components** — token set / icon pack / typography this theme ships or references; each links to its own detail page.
- **Accessibility info** — WCAG conformance level from the contrast lint; reduced-motion compatibility; font-scale compatibility. Computed at validation time, baked into the manifest.
- **Publisher key fingerprint.** Always visible; the truth of identity.
- **Version history + channel selection.**
- **License, source, homepage.**
- **Author** information — same model as apps (key + display name + optional verified-author badge from the catalog).

> **Decision:** the store surface is a **privileged shell view**, not an app. Same reasoning as for apps — it must be available before any third-party app is installed, and cannot be replaced by an app (phishing vector).

> **Forward link:** themes (and their components) appear inside the unified marketplace surface defined in [47-marketplace.md](47-marketplace.md), browsable side-by-side with apps, plugins, layout packs, locale packs, and any other content kind. The lifecycle and validation rules in this doc are unchanged; 47 adds the navigation, library, wallet, and developer-portal surfaces around them.

## Author

The truth of authorship is the **publisher Ed25519 key**. Everything else (display name, verified badge, profile page) is layered on top.

- **Display name** — set by the author in their theme manifests. Not unique; not authoritative. Two different keys may publish under the same display name and the user sees a fingerprint disambiguation when they overlap.
- **Verified-author badge** — a catalog may attest that a given key belongs to a real-world entity (e.g., the official Phosphor team's key). The badge is per-catalog and visually attributed.
- **Author profile page** — keyed on the publisher key, surfaces "more themes by this author" across all subscribed catalogs. A user who liked one theme by a key can discover others by the same key without trusting the catalog's curation.
- **Multi-component authorship** — if an author ships a separate token set, icon pack, and typography under the same key, the profile page groups them; the user can install the bundle or pick à la carte.

> **Decision:** the **publisher key** is the unit of authorship. Display names are mutable metadata; the key is the durable identity. This matches the app-store posture and means a malicious party can't impersonate an author by typing their display name into a manifest — the key won't match.

## Ratings and reviews

> **Decision:** ratings and reviews are **catalog-supplied**, not platform-supplied. The platform doesn't operate a central ratings store; each catalog (official or third-party) collects and serves its own ratings. The shell renders catalog ratings with explicit attribution ("4.6 ★ via official-registry / 412 ratings").

This matches the principle from [14 §Distribution channels](14-app-store.md) that catalogs are first-class and the official one is just the default. A user subscribed to multiple catalogs sees per-catalog ratings, not a synthetic average.

| Catalog responsibility                                        | Platform responsibility                                           |
|---------------------------------------------------------------|-------------------------------------------------------------------|
| Collect rating submissions (account, anti-abuse, moderation).  | Render the rating value(s) the catalog returns.                   |
| Aggregate per-theme and per-author ratings.                    | Attribute rating source visibly.                                  |
| Surface short text reviews if the catalog supports them.       | Show reviews as catalog content, not platform-endorsed.           |
| Enforce review-content policies (spam, hate, payment-for-stars). | Allow user to hide reviews from a given catalog.                |

> **Decision:** the shell never aggregates ratings across catalogs into a single number. A theme listed in three catalogs displays three rating tags. This is honest about provenance and avoids the "Amazon-style aggregate average" pathology where a single hostile catalog distorts the picture.

> **Open:** does the platform define a *shape* for rating submission (so catalogs interoperate on the user-side: rate once, syndicate)? Or is rating submission entirely a catalog UI concern (user goes to the catalog's website to rate)? Tracked as OQ-169.

## Lifecycle: install, update, remove

### Install

1. User clicks **Install** in the store (or pastes a manifest URL).
2. Shell fetches the manifest, fetches the bundle, **verifies the signature** against the publisher key (TOFU if first install).
3. Shell **validates** the payload (see *Validation* below).
4. Shell shows the install confirmation: name + author + key fingerprint + preview + license + size. Capabilities row reads "**none** — themes don't request capabilities."
5. On confirm, shell unpacks into the vault registry: creates `TokenSet/v1`, `IconPack/v1`, `Typography/v1`, and/or `Theme/v1` entities with `installedFrom: {manifestUrl, publisherKey, version, kind: "theme"}` provenance.
6. **The theme is not auto-activated.** It appears in Settings → Themes as installed; the user picks it explicitly.

> **Decision:** install never auto-activates. Reasoning: a theme is a visual identity change that affects every surface; the user makes that choice deliberately. Auto-activation would be a worse UX than the click of "Activate."

### Update

Identical to apps (per [14 §Update channels](14-app-store.md)):

- Per-theme subscribed channel (default `stable`).
- Shell polls catalog manifests periodically; new version triggers download, validation, install.
- Themes never request new capabilities (themes don't have capabilities), so updates are never blocked on re-consent. The validation gate is what protects the user.
- If the active theme updates, the shell **re-renders live** (per [13 §Themes](../shell/13-frontend-stack.md) — switching is runtime, no reload).
- **Update-frequency rate-limit** (per [32 §Update-time delta validation](32-store-verification.md)) applies — default max 1 update / 24 hours per theme. Stops a malicious catalog or compromised key from cycling a theme rapidly to evade scrutiny.

### Remove

1. User clicks **Uninstall** in the store or in Settings → Themes.
2. If the theme is currently active, shell switches to the default (Default Light or Default Dark, per OS preference) **before** removing the entities. The user sees the switch happen.
3. If other installed themes reference this theme's components (via `extends`), the shell warns and offers to either:
   - Keep the orphan component (still usable by other themes).
   - Remove the component too (only if no other installed theme references it).
4. User-authored token sets that extend this theme's token set are surfaced with the same warning; the user can flatten (inline the inherited values) or accept the dependency loss.

> **Decision:** uninstall is always **fully reversible** — the user can reinstall from the same manifest URL and get back to where they were. The shell does **not** preserve theme entities after uninstall; the truth of state is the install record, not stale entity data.

## Live preview

> **Decision:** before installing or activating a theme, the user can **preview it live**. The shell applies the theme to the dashboard (and any open shell surface) transiently for a few seconds — long enough to see how it actually looks at scale — without committing the change. A "Keep" / "Discard" affordance returns to the previous theme.

This solves the "screenshot lies" problem: a preview PNG can't show motion, focus rings, hover states, or how the theme interacts with the user's actual content. Live preview is the difference between a theme store and a wallpaper picker.

Live preview is also available *post-install* — Settings → Themes shows installed themes with a Preview button on each, so the user can A/B without juggling activation state.

> **Decision:** live preview only applies to the **active renderer surfaces** (dashboard + Settings, plus any preview-opted-in app windows). It does **not** retroactively switch the print theme or any export-in-flight. Persistent activation is required to take effect on print/export.

> **Open:** how long is the default preview window? 30s? Until the user clicks somewhere outside the preview affordance? Indefinite with a banner? Tracked as OQ-170.

## Validation

Themes go through static validation at install time (and at catalog-listing time, before they appear in the official registry):

- **Token namespace compliance.** A token set defines only known semantic tokens (per [36-design-system.md](../shell/36-design-system.md)); unknown token names are rejected. Token values pass CSS parsing.
- **No executable content.** Bundle contains no `.js`, `.wasm`, `.html`, `.bin`, native binaries. SVGs in the icon pack are sanitized — no `<script>`, no `<foreignObject>` with arbitrary content, no `javascript:` URIs, no event handlers (`onload`, `onclick`, …). Sanitization runs **at install time and at render time** (defense in depth).
- **Font references.** Typography may reference system-font stacks and bundle font files (`woff2`); references to **external URLs** for fonts are rejected (no `@font-face url(https://...)`).
- **Contrast lint.** The token-contrast linter (per [36 §Accessibility](../shell/36-design-system.md)) runs against the default semantic mappings. WCAG AA is the floor for catalog listing in the official registry; failure surfaces as a strong warning at sideload install. The result is baked into the manifest as `wcagLevel: "AA" | "AAA" | "fail"`.
- **Focus-ring presence.** Theme cannot resolve `color.focus.ring` to a value that disappears against `color.background.*`. Hidden focus rings fail validation.
- **Preview asset present.** A theme without `assets/preview-light.png` and/or `assets/preview-dark.png` (matching its `appearance`) fails listing.
- **License declared.** Required for catalog listing; warning at sideload if missing.

> **Decision:** the contrast and focus-ring checks are **not bypassable** even with explicit user acknowledgment. A theme that hides focus rings or fails contrast is hostile to keyboard users and screen readers; we'd rather refuse installs than ship that accessibility regression. Authors fix the theme.

> **Open:** are there validation rules that *should* be user-overridable with explicit acknowledgment (e.g., a deliberately ultra-low-contrast aesthetic for ambient screens)? Tracked as OQ-171.

## Live preview & validation in the theme-editor app

The first-party **theme-editor app** (per Stage 9.9 in the implementation plan; per [13 §Lifecycle](../shell/13-frontend-stack.md)) is where authors compose token sets, browse icon packs, pick typography, and save composite Theme entities — *before* packaging for distribution.

The editor surfaces all validation rules above as inline feedback (contrast warnings on the editor canvas, focus-ring preview, namespace-unknown-token errors). A theme authored in the theme-editor and exported to a `.brainstorm` package passes installation validation by construction; authors don't have to re-run the linter after pack.

The CLI (`brainstorm-cli pack <theme-dir>`, per [14 §CLI](14-app-store.md)) is the non-GUI path for the same outcome.

## Paid themes

> **Decision:** paid themes follow the **same posture as paid apps** (per [14 §Economic model](14-app-store.md)). Out of scope for v1. The platform takes no commercial position — no payment processing, no entitlement enforcement, no DRM. Catalogs that choose to offer paid themes handle payment and entitlement themselves; the shell installs based on the catalog's instruction.

The package format and install protocol intentionally do not encode payment. A future paid-theme model can layer on top of this design without changing the format.

Anticipated v2 shape (non-binding; subject to design when paid apps are designed):

| Concern                                | Likely posture                                                                                                  |
|----------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Payment                                | Off-platform — the catalog operates a storefront (Stripe, Paddle, etc.); the user pays the catalog, not Brainstorm. |
| Entitlement                            | Catalog issues a signed install token bound to the user's catalog account; shell verifies the token before unpacking. |
| Subscription lapse                     | Catalog publishes a **threat-intel-like advisory** with `advisedAction: "info"` (per [32 §Threat-intel feed](32-store-verification.md)) — surface a banner, never silently disable. |
| Refund flow                            | Off-platform — catalog handles, then user uninstalls normally.                                                    |
| Free trial                             | Catalog's concern — issue time-limited install tokens; shell renders the expiration banner.                       |
| Author revenue                         | Catalog's relationship with author.                                                                               |
| Platform fees                          | None — Brainstorm doesn't take a cut, because Brainstorm doesn't process the payment.                              |

> **Decision:** when paid themes ship, they share infrastructure with paid apps. We do not design a parallel paid-themes pipeline. Resolves the obvious "what about paid theme apps" symmetry by collapsing it.

> **Decision (resolves OQ-172, per [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md)):** entitlement is **per-catalog and non-portable in v2**. A user who buys a theme through Catalog A cannot install it via Catalog B mirroring A's listings. A cross-catalog entitlement envelope is deferred to post-v2, gated on observed demand and a separate cryptographic design. Federation in the catalog model is already a v2+ open surface (OQ-169 for ratings); we do not pre-commit infrastructure for it.

## What metadata catalogs MUST and MAY publish

For a theme entry in any catalog:

**Required:** `id`, `kind: "theme"`, `currentVersion`, manifest URL, name, author (display name + key), description, preview image(s), license.

**Recommended:** screenshots, tags, categories, homepage, source repo URL, appearance (light/dark/both), WCAG level, "components" breakdown (what it ships vs. references).

**Optional / catalog-specific:** ratings, install counts, badges, review excerpts, "more by this author" cross-links.

> **Decision:** required + recommended fields render in a uniform way across catalogs. Catalog-specific fields (especially ratings) are visually attributed to their source catalog. Resolves the trust-asymmetry between official and third-party catalogs without privileging one.

## Threat model for themes

Themes are passive data, not code — the threat surface is much smaller than apps. What a malicious theme could try and how validation defeats it:

| Attack                                                          | Mitigation                                                                  |
|-----------------------------------------------------------------|------------------------------------------------------------------------------|
| Embed JavaScript in an icon-pack SVG.                            | SVG sanitizer at install + render time strips `<script>`, event handlers, `javascript:` URIs. |
| Use SVG `<foreignObject>` to embed HTML / iframes.               | Sanitizer rejects foreign objects.                                           |
| Reference an external font URL that beacons (privacy attack).    | Validator rejects `@font-face url(http*)`; only system-font stacks and bundled `woff2` allowed. |
| Set `color.focus.ring` to transparent (accessibility attack).    | Focus-ring validator rejects.                                                |
| Set body text to a contrast level that fails WCAG.                | Contrast linter floors at AA; below-AA themes flagged at sideload, rejected at official-registry listing. |
| Define a token name outside the namespace (cause shell bugs).    | Namespace whitelist; unknown tokens rejected.                                |
| Ship a 50 MB icon pack to consume disk.                          | Per-theme size cap (default 10 MB; configurable). Validator rejects oversized packages. |
| Trojan a paid-theme entitlement check (catalog-specific).        | The threat-intel feed model from [32](32-store-verification.md) applies — catalogs can flag.    |
| Compromise the publisher key and ship a malicious update.         | Same protections as apps: signature mismatch warning, rate-limit, threat-intel killbit. |

What themes **cannot do**:

- Run JavaScript.
- Request capabilities (no capability surface exists for themes).
- Open network connections.
- Read user data.
- Modify other apps' or user-authored entities.
- Persist anything beyond their own entity records.

A misbehaving or compromised theme is, in the worst case, **uninstall-cleanly recoverable** — the user removes it and their data is untouched.

## Phasing

| Capability                                                      | v1                          | v2                      |
|-----------------------------------------------------------------|------------------------------|-------------------------|
| Manifest-URL install (same as apps)                              | yes                          | yes                     |
| Local file install                                               | yes                          | yes                     |
| Composite Theme install / update / remove                        | yes                          | yes                     |
| Individual component install (token set / icon pack / typography) | yes                         | yes                     |
| Dependency resolution (composite references uninstalled component) | yes — prompts user to install missing pieces | yes |
| Official registry listing (themes alongside apps)                | yes, minimal — manual add    | full discovery surface  |
| Third-party catalogs (themes alongside apps)                     | yes (manual subscribe)       | yes                     |
| Signing                                                          | optional, encouraged         | mandatory for listing   |
| Live preview before activation                                    | yes (in store + Settings)   | yes (richer surfaces)   |
| Static screenshot preview                                         | yes                         | yes                     |
| Ratings (catalog-supplied, attributed)                            | yes — display only           | richer surfaces, possibly cross-catalog federation (OQ-169) |
| Author profile (key-keyed, "more by this author")                | basic                       | richer with verified-author badges |
| Threat-intel feed for themes                                      | yes (same infra as apps)     | yes                     |
| Validation: namespace + sanitizer + contrast lint                 | yes                          | yes                     |
| Auto-update                                                       | manual / opt-in              | opt-in default-on        |
| Key rotation, revocation                                          | per [14 §Identity and signing](14-app-store.md) — soft in v1 | mandatory in v2 |
| Paid themes                                                       | no                           | up for design — same posture as paid apps |
| Theme-editor app (authoring)                                      | ships in Stage 9             | richer                   |
| `brainstorm-cli pack` for themes                                  | yes                          | yes                     |
| Wallpaper packs as a distributable theme component                | OQ-173                       | TBD                      |

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-169** — Federated ratings across catalogs. Does the platform define a standard rating-submission envelope so a user rating a theme once syndicates to all subscribed catalogs, or are ratings per-catalog only?
- **OQ-170** — Live-preview window duration. 30s timeout? Until the user clicks outside the preview affordance? Indefinite with a banner?
- **OQ-171** — User-overridable validation rules. Should some checks (e.g., deliberately low contrast for ambient screens) be bypassable with explicit acknowledgment, or are all validation rules absolute?
- **OQ-172** — Cross-catalog entitlement portability for paid themes. Standard entitlement-token envelope (buy on catalog A, install via catalog B mirroring A's listings) or per-catalog and non-portable?
- **OQ-173** — Wallpaper packs as a separately-distributable theme component (`brainstorm/WallpaperPack/v1`)? Currently wallpapers are user-uploaded files; should they be a first-class shippable theme component with its own author/rating model?

## Summary

- **Themes ship through the same store as apps.** Same manifest URL, same Ed25519 signing, same install / update / remove lifecycle, same channels, same threat-intel killbit feed, same trust model.
- **Theme packages are passive data.** No executable code; validation is static lint (namespace compliance + SVG sanitizer + contrast lint + focus-ring check).
- **Distribution units are flexible.** A composite Theme, a standalone TokenSet, a standalone IconPack, or a standalone Typography choice each ship as a single package; composites can reference components the user already has installed.
- **Authorship is keyed on the publisher Ed25519 key.** Display names are mutable metadata; the key is the durable identity. Author profile pages aggregate themes from the same key across all subscribed catalogs.
- **Ratings are catalog-supplied and per-catalog attributed.** The platform doesn't aggregate across catalogs in v1.
- **Live preview is first-class** — the user sees the theme applied to their actual dashboard before committing.
- **Paid themes are v2** and share infrastructure with paid apps, when designed. Platform takes no commercial position; payment and entitlement live in catalogs.
- **Threat surface is narrow.** Themes cannot run code, request capabilities, or read user data — the worst case is a malicious icon SVG (sanitized) or an accessibility-hostile token set (lint-rejected). Cleanly uninstallable in every case.
