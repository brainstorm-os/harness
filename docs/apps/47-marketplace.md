# 47 — Marketplace, wallet, and developer accounts

This doc unifies the install + commerce surface of Brainstorm. It is the **product-level counterpart** to the per-format docs already in the tree:

- [14-app-store.md](14-app-store.md) — how apps are packaged, signed, delivered.
- [32-store-verification.md](32-store-verification.md) — how continuous trust works after install.
- [40-theme-store.md](40-theme-store.md) — how themes (and their components) reuse the app-store machinery.
- [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md) — the commercial *posture* (what we charge for, principles).
- [44-pricing.md](../platform/44-pricing.md) — concrete prices, quotas, regional posture.
- [45-payments-architecture.md](../platform/45-payments-architecture.md) — billing service, account.db, Stripe plumbing, entitlement tokens. *(Note: 45 currently describes a dual-processor design (Paddle MoR for consumer, Stripe for B2B + Connect). The processor choice has been simplified to **Stripe-only** with Stripe Tax + Brainstorm as MoR; 45 is flagged for revision. This doc — 47 — uses the simplified posture throughout.)*

Those docs describe **distinct mechanisms**. This doc describes the **user-facing whole** they compose into: a single Marketplace surface that lists everything a user can install or buy, a Wallet that aggregates their purchases and payment methods without us custodying funds, a Developer Portal where authors list and earn, and an extensible **content-kind registry** so plugins, layout packs, locale packs, workflow packs, and future kinds plug in without rearchitecting the surface.

It builds on the foundation in those docs and stays consistent with them: **Brainstorm remains out of payment custody for third-party purchases** (per [43 §Catalog economics](../platform/43-monetisation-strategy.md), reaffirmed below). The wallet is a UX abstraction, not a balance we hold.

## What this doc adds

| Surface                                       | What 14 / 40 / 43 / 45 already cover                                  | What 47 adds                                                                                                |
|-----------------------------------------------|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Store UX (browse / search / detail / install) | Sketch in [14 §Discovery](14-app-store.md), [40 §Discovery](40-theme-store.md). | Concrete navigation model, panel layout, library, updates surface, install flow across kinds — **free items only in v2**. |
| Wallet                                        | Not defined anywhere.                                                  | The wallet concept (UX aggregator, not platform-held funds); data model; portability story. **In v2: subscriptions + payment methods + receipts + tax info.** Marketplace-purchase entitlements and the post-v2 AI-credit balance are designed here for forward-compat. |
| Developer accounts                            | One-liner in [45 §14.10](../platform/45-payments-architecture.md).      | Developer portal scope. **In v2: free listings, browser-side signing, aggregated analytics, threat-intel/appeal.** KYC, Stripe Connect Express, payouts, multi-publisher orgs designed here for forward-compat but **deferred to post-v2** alongside paid marketplace. |
| Fee mechanics                                 | Rate set in [43 §Catalog economics](../platform/43-monetisation-strategy.md). | Operational detail (how the rate is computed per checkout, currency, refund impact, opt-in for promotion) — **designed here, deferred to post-v2**. |
| Content kinds beyond apps + themes            | Apps in 14; theme composite in 40.                                     | An extensible **content-kind registry** (apps, themes, token sets, icon packs, typography, plugins, layout packs, locale packs, workflow packs, wallpaper packs) and the contract a new kind has to satisfy. All free in v2; paid distribution layers on later. |
| Plugins                                       | Not defined.                                                            | Plugins as a v2 content kind (free): what they are, the host-app contract, sandboxing posture, deferred runtime design. |
| AI credit balance (single-purpose, post-v2)    | Mentioned as "platform-managed AI pay-as-you-go" in [43 §AI monetisation](../platform/43-monetisation-strategy.md). | Concrete legal grounding under EU PSD2 Art 3(k) / German ZAG §2a (limited-network exemption) + EU voucher VAT directive 2016/1065 + German consumer-protection floor (BGB §312g). Two-balance rule — AI credits **must not** be fungible with any future marketplace balance. |

The doc is foundational: it sets the **product shape** that Stage 14 of [implementation-plan.md](../implementation-plan.md) builds against.

> **Decision:** **v2 ships subscriptions-only commerce**. Plus / Pro / Team / Enterprise subscriptions ship in Stage 14 (per [43](../platform/43-monetisation-strategy.md) / [44](../platform/44-pricing.md) / [45](../platform/45-payments-architecture.md)). The marketplace ships in v2 as a **free-content surface** (browseable apps / themes / plugins / icon packs / layout packs / locale packs / workflow packs / shortcut packs / wallpaper packs — all gratis). **Paid marketplace assets**, the catalog platform fee (0%/15%), developer KYC + payouts via Stripe Connect Express, and paid-content entitlement aggregation in the wallet **defer to post-v2**. The post-v2 design is reserved in this doc so the v2 surfaces (manifest format, capability surface, wallet schema, developer-portal schema) anticipate the future without rework.

> **Decision:** the **AI credit balance** ships post-v2 (alongside or after paid marketplace), under the legal constraints set out in [§The AI credit balance (post-v2)](#the-ai-credit-balance-post-v2). It is **never** fungible with a marketplace balance — the two are legally distinct instruments under PSD2 / ZAG, and mixing them would push Brainstorm into full e-money licensing.

## Principles

These extend the principles in [43 §Principles](../platform/43-monetisation-strategy.md) — they are the marketplace-specific tightenings on top.

1. **One surface, every kind.** Apps, themes, plugins, icon packs — all live in the same Marketplace surface. The user does not learn two different stores. New kinds appear in the same surface without UI rework.
2. **v2 is subscriptions-only; paid marketplace is post-v2.** The marketplace ships in v2 as a free-content distribution surface, with the manifest format / capability surface / wallet schema / developer-portal schema designed to anticipate paid-content layering. This sequences regulatory + ops surface (Stripe Connect, KYC, payouts, refunds, fee mechanics, MoR-side considerations) behind the simpler subscription surface that's already designed in 43/44/45.
3. **Single-path commerce — the catalog is the only paid surface.** When paid marketplace ships post-v2, the **catalog is the only path** for charging users. Apps cannot integrate Stripe (or any other processor) directly into their own runtime; developers cannot run a parallel paid-distribution channel that asks Brainstorm users to pay them off-catalog and then activate a sideloaded app via a license key. **Sideload distribution stays free-only.** This is a hard policy boundary: it gives users one trust path (Brainstorm chrome around every charge), one refund path, one tax path, one threat-intel path. No second commerce path exists.
4. **No platform custody of any third-party funds, ever.** Catalog purchases route through **Stripe Connect Express on Brainstorm's platform account**; the principal (minus the platform fee) lands in the developer's Connect sub-account; Brainstorm never custodies the developer's money. The wallet aggregates *records* (receipts, entitlements), never transferable *balances*.
5. **Two-balance rule (EU regulatory floor).** When the AI credit balance ships (post-v2), it is **single-purpose** — redeemable only for Brainstorm AI-broker calls — and **never fungible** with a marketplace-purchase balance. This keeps AI credits under the PSD2 Art 3(k) / ZAG §2a limited-network exemption; a single fungible balance would push us into e-money licensing in every EU member state plus comparable jurisdictions.
6. **Wallet is the user's view, not a vault.** The wallet is a privileged shell view that shows "what I'm subscribed to, how I pay, and (post-v2) what I own." It is not a place where Brainstorm holds the user's money in any transferable form.
7. **Developer accounts are opt-in and minimal.** A developer can publish without an account (free sideload distribution, threat-intel still applies). An account is required for catalog listing. In v2 the developer-portal surface is **free-listings only** — no KYC, no payouts. KYC + Stripe Connect Express + payouts arrive with paid marketplace post-v2.
8. **Per-developer KYC is Stripe's job.** Post-v2, Stripe Connect Express handles identity verification, bank linkage, tax forms. Brainstorm orchestrates the flow; we don't ourselves verify identity or store tax documents.
9. **Content kinds are an open registry, not a switch statement.** The shell knows how to list, install, update, and remove anything that conforms to the kind contract. New kinds register without changes to the marketplace UI.
10. **The marketplace surface is part of the shell.** Like the existing app-store surface, it is a privileged shell view, not an app. Reasoning unchanged from [14 §Discovery in the shell](14-app-store.md): it must be present pre-install and cannot be phished by a third-party app.
11. **No paid placement.** Editorial featured slots, no pay-to-rank. Restated from [43 §What we explicitly do not monetise](../platform/43-monetisation-strategy.md) for the marketplace surface.

> **Decision (load-bearing — the single-path rule, expanded):** apps **must not** import or invoke any payment-processor SDK (Stripe.js, Stripe Elements, Paddle.js, PayPal SDK, Lemon Squeezy, etc.) inside their own runtime. The marketplace's automated review (per [32-store-verification.md](32-store-verification.md)) treats any such import as a hard rejection at submission, and the runtime sandbox refuses outbound network calls to known processor domains from app-scoped renderers. Any "paid features" inside a Brainstorm app are activated by an **entitlement token in the wallet**, issued by the Brainstorm catalog flow — never by an in-app checkout. This is enforced by a renderer-side CSP + main-process network broker rule + a build-time linter shipped with `@brainstorm/sdk`.

> **Decision:** **side-channel licensing (developer's own website asks for payment off-platform; user installs sideloaded app + activates with a license key the developer's server emails them)** is also not allowed for content published through the Brainstorm catalog. A developer who lists in the catalog uses the catalog's checkout — period. A developer who chooses not to list in the catalog ships their app for free (sideload) and either monetises entirely outside Brainstorm (consulting, hosted services, an out-of-band procurement contract for enterprise customers) or doesn't monetise at all. There is **no hybrid** where a sideload Brainstorm app charges Brainstorm users through a separate flow.

> **Decision:** the **enterprise / private-distribution path** stays open. A company can sideload a private internal app and pay for the development however they pay for any other internal software (consulting contract, internal cost-centre). What's prohibited is the *user-facing in-product purchase flow* outside the catalog. B2B procurement happens out-of-band where it always has — invoices, contracts, BAFA, whatever — without touching the Brainstorm runtime.

## The content-kind registry

Today, the bundle manifest carries `kind: "app" | "theme"` (per [14 §Package format](14-app-store.md), [40 §Package format](40-theme-store.md)). The registry generalises that: `kind` is a string drawn from an extensible set, and each kind is described by a **kind descriptor** that the shell uses to validate / install / list / update.

> **Decision:** the manifest `kind` field is a TS string enum mirrored at runtime as `ContentKind`. Adding a new kind = adding a new enum member + registering a kind descriptor in the shell. Per [`CLAUDE.md §Enums`](../../CLAUDE.md), string-discriminator unions are not acceptable — every kind is enum-named.

### The kind descriptor

A kind descriptor declares everything the shell needs to handle a content kind generically:

```ts
interface ContentKindDescriptor {
  kind: ContentKind;                          // 'app' | 'theme' | 'plugin' | …
  displayName: TranslationKey;                // "Apps" / "Themes" / "Plugins"
  validator: (bundle: BundleHandle) => Promise<ValidationResult>;
  installer: (bundle: BundleHandle, ctx: InstallContext) => Promise<InstallReceipt>;
  uninstaller: (receipt: InstallReceipt, ctx: UninstallContext) => Promise<void>;
  updater: (current: InstallReceipt, next: BundleHandle) => Promise<InstallReceipt>;
  storeCard: ReactComponent<{ listing: CatalogListing }>;    // grid/card view
  detailPage: ReactComponent<{ listing: CatalogListing }>;   // detail view
  manageRow: ReactComponent<{ install: InstalledItem }>;     // library row
  capabilitySurface: Capability[];            // what the kind can do at runtime ([] for passive data)
  threatProfile: 'active-code' | 'passive-data' | 'metadata-only';
  signaturePolicy: 'mandatory' | 'soft-encouraged' | 'optional';
  reviewModel: 'behavioral' | 'static-only' | 'metadata-only';
}
```

`ContentKind` enum (initial set):

```ts
export enum ContentKind {
  App = 'app',
  Theme = 'theme',
  TokenSet = 'token-set',
  IconPack = 'icon-pack',
  Typography = 'typography',
  Plugin = 'plugin',                  // v2 — see §Plugins
  LayoutPack = 'layout-pack',         // v2 — closes OQ-89
  WallpaperPack = 'wallpaper-pack',   // v2 — closes OQ-173
  LocalePack = 'locale-pack',         // v2 — packaged ICU MessageFormat catalogs (per 21-localization)
  WorkflowPack = 'workflow-pack',     // v2 — shareable automation bundles (per 39-automations)
  ShortcutPack = 'shortcut-pack',     // v2 — keyboard binding profiles (per 24-keyboard-shortcuts)
}
```

### Per-kind properties at a glance

| Kind             | Threat profile  | Review model     | Signature in v2 | Capability surface          | Phase   |
|------------------|-----------------|------------------|-----------------|-----------------------------|---------|
| App              | active-code     | behavioral       | mandatory       | manifest-declared           | v1*     |
| Theme (composite) | passive-data    | static-only      | mandatory       | none                        | v1      |
| Token set        | metadata-only   | static-only      | mandatory       | none                        | v1      |
| Icon pack        | passive-data    | static-only      | mandatory       | none                        | v1      |
| Typography       | metadata-only   | static-only      | mandatory       | none                        | v1      |
| Plugin           | active-code     | behavioral       | mandatory       | host-app extension surface  | v2      |
| Layout pack      | metadata-only   | static-only      | optional        | none                        | v2      |
| Wallpaper pack   | passive-data    | static-only      | optional        | none                        | v2      |
| Locale pack      | passive-data    | static-only      | optional        | none                        | v2      |
| Workflow pack    | metadata-only   | metadata-only    | optional        | runs under user's caps      | v2      |
| Shortcut pack    | metadata-only   | metadata-only    | optional        | none                        | v2      |
| Docs pack        | passive-data    | static-only      | mandatory       | none (privileged Help reader only) | v2 (first-party-only) |

*v1 ships app install from URL / disk per [14](14-app-store.md). The *catalog* (browseable in-shell store) is v2 (Stage 14.10).

> **Decision:** **`DocsPack/v1` is reserved first-party-only in v2** — the kind's reader hard-asserts `publisher.key === BRAINSTORM_CATALOG_KEY` and rejects any other publisher. It is the only first-party-only kind in the registry; every other kind accepts any signed publisher. Reasons + per-app embedded-docs forward-compat designed in [60 §First-party-only in v2](../platform/60-developer-docs.md); upgrades the in-shell Help center from bundled-at-build-time ([OQ-HELP-1](../reference/11-open-questions.md#oq-help-1--in-app-help-center-content-source--resolved--position-taken-2026-05-19-unblocks-help-1) v1 resolution) to a catalog-distributed, atomic-swap-on-launch pack while preserving offline-first via a bootstrap pack embedded in every shell binary.

> **Decision:** every kind shipped via the marketplace must have either `'active-code'` or a complete static-validator pipeline that defeats the same threats SVG-sanitisation defeats for themes. We do not introduce kinds with under-specified threat profiles — that's how a malicious wallpaper pack ships with embedded JS.

### Cross-kind composition

Some kinds reference others. A theme references a token set, icon pack, typography (per [40 §Components](40-theme-store.md)). A plugin references a host app. A workflow pack references an automation engine version. The kind descriptor declares `references: ContentKind[]` and the installer resolves them transitively — the user sees one install confirmation listing every dependency with its publisher + fingerprint.

> **Decision:** dependency resolution is **explicit and prompted**, never silent. The user sees every transitive content item, every publisher key, every fingerprint at install time. Auto-install of dependencies (no prompt) is reserved for shell-bundled defaults only.

## The Marketplace surface

> **Decision:** the Marketplace is a **privileged shell view**, accessed via a top-level dashboard tile (and `⌘K → "store"`). It is not an app. Same reasoning as the existing app-store surface in [14 §Discovery](14-app-store.md): it must exist pre-install, and cannot be replaced or shadowed by a third-party app (which would be a phishing vector).

### Top-level navigation

```
┌──────────────────┬─────────────────────────────────────────────────────────┐
│  Discover        │   Hero / featured / new this week                       │
│                  │                                                          │
│  Browse          │   Curated rows by topic (Productivity, Reading, …)      │
│   Apps           │                                                          │
│   Themes         │   "Recently updated"                                    │
│   Plugins        │   "From authors you follow"                             │
│   Icon packs     │                                                          │
│   …              │                                                          │
│                  │                                                          │
│ ───────────────  │                                                          │
│                  │                                                          │
│  Library     •3  │   ← installed items, with update badge                  │
│  Updates         │                                                          │
│  Wishlist        │                                                          │
│                  │                                                          │
│ ───────────────  │                                                          │
│                  │                                                          │
│  Sources         │   ← subscribed catalogs                                 │
│                  │                                                          │
│ ───────────────  │                                                          │
│                  │                                                          │
│  Wallet          │   ← payment methods, entitlements, receipts             │
│                  │                                                          │
└──────────────────┴─────────────────────────────────────────────────────────┘
```

The sidebar is the navigation pane on the **left** per the project-wide convention ([App panel sides convention](../../CLAUDE.md#conventions-that-bite); reaffirmed across the renderer chrome). The header reserves 86 px on the left for macOS traffic lights as standard for every app window header.

> **Decision:** **Discover** is the default landing pane; **Browse** is a per-kind grid; **Library** is the user's installed items with update affordances; **Sources** is the catalog subscription manager; **Wallet** is the payments / entitlements / receipts surface. Five top-level sections is the upper bound — adding more would dilute orientation.

### Browse: kind filter is mandatory

A user clicking "Browse → Apps" sees only `kind = "app"` listings. The same filter applies to themes, plugins, etc. Cross-kind search (typing into the unified search field) returns mixed results but visually labels each row's kind.

> **Decision:** there is **no aggregate "all kinds" list** outside search results. A user browsing without a kind filter would have no useful affordance — themes and apps need different cards, ratings carry different meanings, install flows differ. The kind selector is part of every browse surface by construction.

### Detail page — uniform structure across kinds

Each kind descriptor supplies a `detailPage` component, but the *frame* is uniform:

| Region                | Always shows                                                                                       |
|-----------------------|----------------------------------------------------------------------------------------------------|
| Identity header        | Name • author display name (→ author profile) • publisher-key fingerprint • version • channel       |
| Visual                 | Icon + screenshots OR live preview (themes) OR motion preview (themes / plugins)                    |
| Description            | Author-supplied long description (Markdown subset; sanitised)                                       |
| What it can do         | For active-code kinds: capability list with plain-English explanations. For passive: "no runtime capabilities". |
| Trust signals          | Publisher-key fingerprint, signing status, threat-intel state, catalog verification badge (if any)   |
| Catalog metadata       | Rating (per-catalog, attributed), install count (per-catalog, attributed), badges                    |
| Compatibility          | Required shell version, host-app version (plugins), required content (themes)                        |
| Commercial             | Price (if paid), checkout button, "Already owned" badge if the wallet records an active entitlement  |
| Provenance             | License, source repo URL, homepage, last-updated, version history per channel                         |
| Manage                 | Install / Update / Uninstall / Switch channel / Report                                                |

> **Decision:** the **publisher key fingerprint** is always visible on the detail page, at the top, in a monospace font, with a copy affordance. Restated from [14 §Trust model](14-app-store.md) and [40 §Author](40-theme-store.md). Display names lie; keys don't.

### Library — single surface for installed items across kinds

The Library lists every installed content item from every kind in a unified table:

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Kind       Name                  Author          Channel   Version  Update         │
│ ──────────────────────────────────────────────────────────────────────────────────  │
│ App        Notes                 brainstorm.app  stable    1.4.2    —              │
│ Theme      Solarized Dark        E. Schoonover   stable    2.1.0    [→ 2.2.0]      │
│ Plugin     Math expressions      A. Dev          stable    0.3.1    —              │
│ Icon pack  Phosphor              Phosphor team   stable    2.0.0    —              │
│ Workflow   Daily review          K. Allen        stable    1.1.0    —              │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Filter by kind. Bulk operations on selection (update all / channel switch / uninstall). Click into any row → detail page.

> **Decision:** **Updates** is a Library-filter-preset, not a separate area. Showing "3 updates available" in the sidebar nav badge surfaces the same set; the badge clears when the user opens the filter.

> **Forward link:** the concrete **catalog API contract** behind these listings (the signed catalog index, bundle delivery + integrity, the shell-side `CatalogClient` that produces `ListingSource.Catalog` rows, the offline-first bundle cache that replaces the demo seeder, and how **first-party apps are unified catalog entries** that update separately from the shell binary) is in [59-app-lifecycle-and-catalog.md](59-app-lifecycle-and-catalog.md). This doc is the product surface; 59 is the runtime + ops layer that feeds it.

### Install flow (v2 — free items only)

A user clicks **Install** on a free item:

1. Shell fetches the manifest, checks signature, runs the kind's static validator.
2. Modal: name + author + fingerprint + size + capabilities (or "none") + dependencies (with their own publishers + fingerprints) + license. Confirm.
3. Shell downloads the bundle, verifies the bundle hash, runs the kind's installer, registers the install in the registry and capability ledger.

### Paid-item install flow (deferred to post-v2)

When paid marketplace ships post-v2 it layers onto the same flow with these additions, listed here so the v2 architecture anticipates them:

1. Same manifest + signature + validator step.
2. Modal: name + author + fingerprint + price + currency + "billed by Brainstorm on behalf of *<developer>*" + dependencies.
3. **Checkout** opens in a shell-owned, embedded BrowserView (per [38-network-and-proxy.md](../security/38-network-and-proxy.md)'s embed sandbox), rendering **Stripe Checkout** under Brainstorm's chrome. The catalog-issued checkout URL is single-use and 24h-bounded (per [45 §Fraud and abuse](../platform/45-payments-architecture.md)).
4. Stripe Checkout collects payment; Stripe applies the platform fee via Connect application-fee semantics; principal lands in the developer's Connect sub-account; Brainstorm's catalog then issues the **entitlement token** (Ed25519-signed by the catalog's token-issuing key, baked into the shell binary with rotation per [45 §Entitlement tokens](../platform/45-payments-architecture.md)). The shell records the entitlement in the wallet's purchase table.
5. The bundle is downloaded, hashed, installed.

> **Decision (post-v2, designed for v2 forward-compat):** the checkout view is **shell-owned**, never embedded in an app's renderer. An app cannot intercept payment input; the user always sees the Brainstorm chrome around any payment surface. This is the principle from [45 §Capability surface](../platform/45-payments-architecture.md): no app can ever cause a charge.

> **Decision (post-v2):** when a paid item is installed, the wallet records: `(itemId, kind, publisherKey, catalogId, purchaseTimestamp, processorReceiptId, entitlementToken)`. The entitlement token is the load-bearing artifact for "do I still own this?"; everything else is for the user-readable history. The `purchase` table is defined in v2 (schema landed early) but stays empty until paid marketplace ships.

### Uninstall flow

Per-kind `uninstaller` runs. Per the per-kind decision in 14/40, the user's **data** survives uninstall by default; the bundle and capability grants don't. Re-install restores from the same manifest URL.

### Sources (subscribed catalogs)

The user can add / remove catalogs. Each catalog is a manifest URL pointing at a registry. The shell renders catalog metadata (display name, threat-intel feed URL, ratings policy). Per [14 §Distribution channels](14-app-store.md), catalogs are first-class; the official Brainstorm catalog is just the default.

> **Decision:** every catalog the user adds shows its **listing key fingerprint** and its **threat-intel feed signing-key fingerprint** (per [32 §Threat-intel feed](32-store-verification.md)). The user can verify out-of-band. The signature keys for the official catalog are baked into the shell binary (with key rotation, mirroring [45 §Entitlement tokens](../platform/45-payments-architecture.md)).

## The wallet

The wallet is the user's surface for **everything money-related** in Brainstorm. The set of "everything money-related" expands by phase:

- **v2 (Stage 14):** subscription state (Plus / Pro / Team / Enterprise), payment methods, subscription receipts + invoices, tax info, refunds in-flight.
- **post-v2 (with paid marketplace):** marketplace purchases (entitlement tokens), per-developer license-issuer TOFU records, marketplace refund history.
- **post-v2 (with platform-managed AI credits):** a **separate**, **single-purpose**, **non-transferable** AI credit balance. See [§The AI credit balance (post-v2)](#the-ai-credit-balance-post-v2).

It is **not**:
- A balance Brainstorm holds on the user's behalf as transferable value.
- A credit / debit account.
- A custodial wrapper around any value.

It **is**:
- A privileged shell view that aggregates records (subscriptions, receipts, payment-method tokens, and — when they ship — entitlements + AI credit usage) that already exist elsewhere (in processors, in the billing edge, in developer license issuers) into one navigable surface.

> **Decision:** Brainstorm does **not** hold user funds in any transferable form, in v2 or post-v2. The wallet is a **UX abstraction**, not a money-transmission product. This keeps us out of MTL/MSB registration in the US (50 states), out of PSD2 / national equivalents in the EU, and out of FCA registration in the UK — for the subscription and marketplace surfaces. The AI credit balance (post-v2) is the **only** balance-shaped instrument we ever introduce, and is engineered to fit a specific narrow regulatory carve-out (per [§The AI credit balance (post-v2)](#the-ai-credit-balance-post-v2)).

### What the wallet aggregates

| Surface                    | What it shows                                                                                              | Where the data lives                              | Phase     |
|----------------------------|------------------------------------------------------------------------------------------------------------|---------------------------------------------------|-----------|
| **Subscription**           | Current Brainstorm plan (Free / Plus / Pro / Team / Enterprise), period, renewal date, manage actions.       | `account.db` + billing-edge (per [45](../platform/45-payments-architecture.md)).             | v2         |
| **Payment methods**        | Tokenised PMs (Visa **** 4242, Apple Pay, SEPA, …). Add / remove / default. Never store the PAN.            | Stripe Customer object. Tokens cached locally for display only.                              | v2         |
| **Receipts / invoices (subs)** | Itemised history of subscription charges; downloadable PDF.                                              | Billing-edge.                                       | v2         |
| **Tax info**               | Country, VAT/GST ID (B2B), invoice address.                                                                  | Billing-edge; passed to processors for tax computation. | v2         |
| **Refunds in-flight (subs)** | Subscription refund requests pending / resolved; status.                                                   | Billing-edge.                                       | v2         |
| **Purchases**              | Every marketplace item the user owns: app / theme / plugin / etc., with entitlement state.                  | `wallet.db` (see schema below). Empty until paid marketplace ships.       | post-v2   |
| **Receipts (marketplace)**  | Itemised history of marketplace one-time purchases; downloadable PDF (developer- or catalog-hosted).         | Developer's processor / catalog.                    | post-v2   |
| **Refunds in-flight (marketplace)** | Marketplace refund requests pending / resolved; status.                                              | Developer-side; surfaced through the catalog.       | post-v2   |
| **Trusted license issuers** | Per-app TOFU record of which Ed25519 key issued each app's license tokens (per [45 §Third-party license verification](../platform/45-payments-architecture.md)). | `wallet.db`. Empty until paid marketplace ships. | post-v2   |
| **AI credits**              | Remaining AI credit balance; usage by app; top-up history; expiry. **Single-purpose** under PSD2/ZAG (see below). | Billing-edge usage_meter table + dedicated balance ledger. | post-v2  |

### Wallet data model

A new SQLite file, `wallet.db`, sits next to `account.db` per [45 §account.db](../platform/45-payments-architecture.md) — **separate from the vault**, encrypted under the per-device storage-master-key. Reason for keeping it out of the vault is identical to account.db's: the wallet is identity-meta about the user's relationship with us / with developers, not vault content.

The schema is designed in one piece so v2 can land the migrations once; tables `purchase` / `license_issuer_trust` / `ai_credit_*` stay empty until their feature ships post-v2.

```sql
CREATE TABLE _schema_version (version INTEGER PRIMARY KEY);

-- v2 (subscriptions surface):

CREATE TABLE payment_method (
    id                    TEXT PRIMARY KEY,         -- processor token id
    processor             TEXT NOT NULL,
    kind                  TEXT NOT NULL CHECK (kind IN ('card','wallet','bank','paypal')),
    display_brand         TEXT,                     -- 'Visa', 'Mastercard', 'Apple Pay', …
    display_last4         TEXT,
    is_default            INTEGER NOT NULL DEFAULT 0,
    added_at              INTEGER NOT NULL,
    last_used_at          INTEGER
);

CREATE TABLE receipt_cache (
    id                    TEXT PRIMARY KEY,
    purchase_id           TEXT,                     -- FK to purchase (post-v2), nullable for sub-payments
    subscription_id       TEXT,                     -- FK to account.db subscription, nullable
    pdf_url               TEXT,                     -- developer-hosted or billing-edge-hosted
    pdf_sha256            BLOB,                     -- integrity for the cached download
    cached_at             INTEGER
);

-- post-v2 (marketplace purchases — schema lands in v2, stays empty until the feature ships):

CREATE TABLE purchase (
    id                    TEXT PRIMARY KEY,         -- shell-side id, distinct from processor receipt
    item_id               TEXT NOT NULL,            -- manifest id, e.g., 'io.example.text-editor'
    item_kind             TEXT NOT NULL,            -- ContentKind value
    publisher_key         BLOB NOT NULL,            -- Ed25519 publisher key
    catalog_id            TEXT,                     -- nullable for sideload purchases
    purchased_at          INTEGER NOT NULL,
    price_minor           INTEGER NOT NULL,         -- cents
    currency              TEXT NOT NULL,            -- ISO 4217
    processor             TEXT NOT NULL,            -- 'stripe' | 'paddle' | 'developer-direct'
    processor_receipt_id  TEXT NOT NULL,
    entitlement_token     BLOB NOT NULL,            -- Ed25519-signed by the developer's license-issuing key
    entitlement_state     TEXT NOT NULL CHECK (entitlement_state IN ('active','refunded','disputed','expired','revoked'))
);

CREATE TABLE license_issuer_trust (
    app_id                TEXT NOT NULL,
    issuer_key            BLOB NOT NULL,            -- Ed25519
    trusted_at            INTEGER NOT NULL,
    rotation_of           BLOB,                     -- nullable; the prior key this one rotates from
    PRIMARY KEY (app_id, issuer_key)
);

-- post-v2 (AI credit balance — single-purpose under PSD2/ZAG; see §The AI credit balance below).
-- KEPT IN A DEDICATED LEDGER, separate from `purchase` / `payment_method` rows, because mixing
-- the two is the legal trip-wire (fungibility → e-money licensing).

CREATE TABLE ai_credit_ledger (
    id                    TEXT PRIMARY KEY,
    kind                  TEXT NOT NULL CHECK (kind IN ('topup','consume','expire','correction')),
    units                 INTEGER NOT NULL,         -- AI credit units, integer (sub-cent precision)
    units_balance_after   INTEGER NOT NULL,         -- running balance after this entry (sanity)
    consumed_by_app_id    TEXT,                     -- nullable; set on 'consume'
    occurred_at           INTEGER NOT NULL,
    topup_payment_id      TEXT,                     -- FK to a billing-edge top-up record, on 'topup'
    notes                 TEXT
);

CREATE TABLE ai_credit_topup (
    id                    TEXT PRIMARY KEY,
    purchased_at          INTEGER NOT NULL,
    units_purchased       INTEGER NOT NULL,
    price_minor           INTEGER NOT NULL,         -- cents charged at top-up time (VAT-inclusive per single-purpose-voucher rules)
    currency              TEXT NOT NULL,            -- ISO 4217
    vat_minor             INTEGER NOT NULL,         -- VAT amount; charged at top-up because single-purpose voucher
    vat_country           TEXT NOT NULL,            -- ISO 3166-1 alpha-2
    expires_at            INTEGER NOT NULL,         -- ≥3 years from purchase (German consumer-protection floor)
    processor             TEXT NOT NULL,
    processor_receipt_id  TEXT NOT NULL
);
```

> **Decision:** the **entitlement token** is the durable record of ownership for marketplace purchases (post-v2). Because all paid distribution is catalog-mediated (per Principle 3 — the single-path rule), every entitlement token comes from one source: the Brainstorm catalog, issued at checkout completion. A user reinstalling on a new device re-verifies their identity (sovereign-key challenge) and the billing-edge re-issues entitlement tokens for every purchase on record. There is no developer-side parallel issuance path to reconcile.

> **Decision:** per [`CLAUDE.md §Repository pattern for SQL`](../../CLAUDE.md#conventions-that-bite), each `wallet.db` table gets a repo class under `main/wallet/repos/` (`PurchaseRepo`, `PaymentMethodRepo`, `LicenseIssuerTrustRepo`, `ReceiptCacheRepo`, `AiCreditLedgerRepo`, `AiCreditTopupRepo`). The `WalletService` is pure orchestration.

> **Decision:** `ai_credit_*` tables are deliberately **not** linked to `purchase` rows by foreign key, and consuming AI credit cannot be expressed as a `purchase` (it's metered consumption against a pre-paid voucher). Mixing the two tables structurally would invite engineering paths that make AI credits fungible with marketplace credit — which is the legal trip-wire we explicitly avoid (per Principle 4 of this doc and [§The AI credit balance (post-v2)](#the-ai-credit-balance-post-v2)).

### The AI credit balance (post-v2)

When platform-managed AI ships in v2 per [43 §AI monetisation](../platform/43-monetisation-strategy.md), it ships as **pay-as-you-go only** — the user attaches a payment method, AI calls are billed at provider passthrough plus a small margin, no balance is held. **No regulatory exposure.**

A **pre-paid AI credit balance** — top up €20, spend it down across AI calls, no recurring sub required — is a distinct surface that ships **post-v2** under specific legal constraints. This section sets them out so the v2 schema (above) and the v2 `WalletService` skeleton (Stage 14.19) anticipate the shape without prematurely shipping it.

**The legal frame (EU / Germany — research-grade, requires lawyer review before launch):**

The pre-paid AI credit balance is engineered as a **single-purpose voucher** under EU VAT Directive 2016/1065 (transposed into German UStG §3 Abs. 13–15), and as a **limited-network instrument** under PSD2 Art. 3(k) (transposed into German Zahlungsdiensteaufsichtsgesetz, ZAG §2a). To remain inside the exemptions, the balance must satisfy **all** of:

1. **Single-purpose**. The balance is redeemable **only** for AI calls made through Brainstorm's own AI broker (per [22-ai-foundations.md](../platform/22-ai-foundations.md)), with the AI service explicitly identified and a known VAT rate at top-up time. It is **not** redeemable for marketplace items, subscriptions, third-party content, or any other goods.
2. **Limited network**. Acceptance is Brainstorm-only — no third-party developer can accept AI credits as payment for their own services. The "very limited range of services" interpretation of PSD2 Art 3(k) is the controlling test; BaFin has been strict about it since the 2019 EBA guidelines.
3. **Non-transferable**. Credits cannot be transferred to another user, gifted, traded, or assigned. Stored locally in `ai_credit_ledger`, scoped to the consumer account.
4. **Non-refundable to cash, with statutory exceptions**. Once the 14-day BGB §312g right-of-withdrawal window passes (or is waived for immediately-started digital consumption per BGB §356 Abs. 5), the balance is non-refundable in cash. Statutory consumer-protection exceptions remain — we honor them on a case-by-case basis without making them a documented user-facing flow.
5. **Bounded life**. Expiry ≥ 3 years from top-up. German courts have repeatedly invalidated short-expiry pre-paid balances under §307 BGB ("unreasonable disadvantage"); 3 years is the conservative floor referenced in BaFin's interpretive guidance and matches Bundesgerichtshof case law on Gutschein-Verfallklauseln.
6. **VAT at top-up time**. Single-purpose voucher → VAT owed when the voucher is sold, not when redeemed. Charged at the consumer's country rate at top-up. **Stripe Tax** computes the rate per jurisdiction at checkout; Brainstorm (as MoR) remits via **EU OSS** (One-Stop-Shop) registered through Germany for all 27 EU member states, **UK VAT** registration separately (post-Brexit), and **US state nexus** registrations managed through Stripe Tax's automatic-registration flow as thresholds are crossed.
7. **Outstanding-balance notification to BaFin**. Once average outstanding balance crosses **€1M over 12 rolling months**, file the notification per ZAG §2a Abs. 4. Below the threshold no filing is required; we monitor and notify proactively at ~€800k to give regulator-runway. This applies to **the German user balance specifically**; comparable thresholds in other EU member states are tracked per-country.
8. **The two-balance rule**. The AI credit balance is **never** combined with a marketplace-purchase balance, **never** convertible to or from one, and **never** spent on anything outside the AI broker. Implementation: separate tables (`ai_credit_*` vs `purchase`), separate `WalletService` methods (no `transferToMarketplaceBalance`-shaped surface exists, ever), separate user-facing copy ("AI credits" and "Marketplace purchases" are visually and textually distinct in the wallet UI).

> **Decision (post-v2):** Brainstorm offers an optional **pre-paid AI credit balance** alongside the default pay-as-you-go AI billing. The balance is structured to fit the EU single-purpose voucher + limited-network exemption *by construction*. Specifically: single-purpose for AI broker calls only; non-transferable; non-refundable past the 14-day withdrawal window (with statutory exceptions); ≥3-year expiry; VAT at top-up; BaFin notification at €1M-12-mo rolling outstanding. The v2 wallet schema lands these tables empty so post-v2 activation is a feature-flag flip, not a migration.

> **Decision:** **the AI credit balance and the marketplace-purchase balance are legally and architecturally separate.** No code path links them. No UI affordance hints at convertibility. They are surfaced in the same wallet view as two distinct sections with explanatory copy. This is a regulatory-load-bearing decision, not an aesthetic one.

> **Decision (post-v2):** when a user **deletes their consumer account** with a non-zero AI credit balance, the documented behavior is: (a) we offer a 14-day grace to use up or migrate the balance; (b) any residual balance at account closure is **refunded pro-rata** to the original payment method, **not forfeited**. Forfeiture clauses on pre-paid balances have been repeatedly invalidated in German consumer-protection jurisprudence (BGH, OLG decisions on Gutschein-Verfallklauseln); we treat refund-on-account-closure as the safe default.

> **Decision:** **no other balance-shaped instruments** are introduced. The marketplace remains "out of payment custody" forever; subscriptions remain recurring direct charges; AI credits remain the single, narrow, regulated-carve-out exception. Crossing this line requires a board-level review and explicit re-design of the regulatory posture.

> **Open:** how aggressively to surface "this is non-refundable past 14 days" copy in the top-up flow? Strong lean: very clearly, on the top-up confirmation, with a checkbox the user ticks acknowledging the withdrawal-right waiver if they want to start using credits immediately. Tracked as OQ-MK-11 below.

> **Open:** do we ever ship the AI credit balance in non-EU markets first (where consumer-protection floor is looser) before expanding to EU? Reasonable answer: no — single legal model across markets, designed to the strictest applicable, is operationally simpler and avoids cross-jurisdiction surprises. Tracked as OQ-MK-12.

### Out-of-scope balance shapes

For explicitness:

- **Marketplace-fungible wallet balance** (Steam-wallet-style) — **never**. Spans multiple developers and multiple kinds, fails the limited-network test, becomes full e-money. Requires €350k regulatory capital under ZAG, ongoing BaFin supervision, comparable licensing in every other jurisdiction.
- **Multi-purpose vouchers** — **never** as a v2 or post-v2 surface. VAT-at-redemption, ambiguous categorization, much higher operational cost.
- **Peer-to-peer transfer of AI credits** — **never**. Transferability fails the "very limited range of services" test instantly.
- **Cashback / rewards balance** that accumulates from subscription spending and converts to anything — **never** in v1 / v2 / post-v2. Same regulatory analysis.

### Wallet portability across devices

A user owns the wallet through their **sovereign identity**. The wallet itself is per-device (`wallet.db` is local). To re-hydrate on a new device:

1. New device runs the consumer-account sign-in (per [16 §Identity tiers](../security/16-identity-orgs-encryption.md)).
2. Sovereign-key challenge proves identity to the billing edge.
3. Billing edge returns: `account.db` state (subscriptions, plan history) + the **purchase index** (the list of purchases the billing edge has on record for this account; this is *not* the entitlement tokens themselves, just the index).
4. For each purchase in the index, the new device fetches the freshly-issued **entitlement token** from the billing-edge. Because every purchase passed through the catalog at checkout time (per Principle 3 — the single-path rule), there is exactly one source-of-truth path for re-issuance; no developer-side reconciliation, no manual license-key re-entry, no "is this developer integrated with wallet aggregation" branching.

> **Decision:** **wallet aggregation is automatic and universal post-v2.** Because all paid distribution is catalog-mediated, the catalog is the sole token issuer; the billing-edge always has the user's full purchase history on file (subject to consumer-account sign-in). There is no opt-in / opt-out for developers — listing in the catalog **is** opting in to aggregation by construction. This collapses what was previously an open question (OQ-MK-1, now resolved by the single-path rule).

### Wallet UI

Settings → Account → Wallet is the canonical entry point. There is also a top-level entry in the Marketplace sidebar (per the navigation diagram above) so a user can reach Wallet from the same surface they buy things on.

Two top-level panes:

- **Overview** — current plan + active entitlements (with kind badges) + last 3 receipts + payment methods + tax info.
- **History** — full receipt list (searchable, filterable, exportable to CSV/PDF).

> **Decision:** the wallet's **export** affordance is the only canonical commerce-export path. The user can download their entire payment history (purchases + subscriptions + refunds + tax line items) as a single CSV. Restated for legibility: we do not gate accounting data the user paid us for behind a paywall, and we make it self-serve.

### Wallet and the sovereign identity

The wallet is keyed on the **consumer account**, not the vault. Per [16 §Consumer account](../security/16-identity-orgs-encryption.md) and [45 §account.db](../platform/45-payments-architecture.md):

- The user's sovereign identity (Ed25519 keypair) is the auth root.
- The consumer account *links* to that identity for hosted services + commerce.
- Wallet contents are scoped to that consumer account; the vault remains content-only.

A user without a consumer account has a wallet with only sideload-purchases and developer-direct license tokens — locally accumulated, not server-aggregated. The moment they sign in to a consumer account, the local wallet merges with the server-side purchase index.

> **Decision:** the wallet **never** auto-creates a consumer account. Sideload-paid apps stay local-only until the user explicitly enrols. This preserves the account-less floor from [01-vision.md](../foundations/01-vision.md).

## Developer accounts

A **developer account** is the surface a publisher uses to list content in the official Brainstorm catalog. Free, sideload-distributed content has never required a developer account and continues not to.

The developer portal lives at `developers.brainstorm.app`. It is web-only — no in-shell developer-portal surface — because (a) publishing-quality screenshots / docs / pricing / KYC is desk-and-browser work, and (b) it keeps the publish surface away from the install surface, reducing accidental tab-switching mistakes.

> **Decision:** **v2 ships a free-listings developer portal**. All paid-commerce surfaces (Stripe Connect Express onboarding, KYC, payouts, tax statements, refund/dispute orchestration) **defer to post-v2** alongside paid marketplace. The portal's data model, schema, and UI flows are designed below for forward-compat; the paid surfaces are noted as **(post-v2)** and not built in v2.

### Becoming a developer (v2 — free listings)

The v2 path:

1. **Sign in** to the developer portal using the same sovereign identity that signs the developer's content (challenge-response over the Ed25519 publisher key).
2. **Provide an email** + display name for developer-portal account recovery + threat-intel notifications.
3. **Submit a listing**: link a manifest URL + provide store metadata (description, screenshots, support URL).

That's the entire v2 onboarding. No payout processor, no KYC, no tax setup — the v2 catalog lists free content only.

> **Decision:** **the publisher Ed25519 key is the identity of the developer**, not their email. A developer with the same key across multiple listings shows up as one author. A developer can have multiple keys (a personal key and a per-app key) at their discretion; the catalog renders each key as a separate author profile but lets a developer-account "claim" multiple keys (signed claim, recorded by the portal) so they aggregate in the developer dashboard.

> **Decision:** developer-account sign-in is **password-less**. Sovereign-key challenge-response is the only auth path. Email is recovery + threat-intel notifications only, never a primary factor.

### Becoming a developer (post-v2 — paid listings)

When paid marketplace ships post-v2, the onboarding extends with:

4. **Connect Stripe Connect Express.** The Connect flow runs in a Stripe-hosted surface — Stripe collects KYC (identity documents, bank account, tax-form info, beneficial ownership). We never see them. We receive `(connectAccountId, verificationStatus, country, payoutCurrency)`.
5. **Tax setup.** Developer enters their tax country and VAT/GST ID. Stripe Tax handles withholding and remittance for the developer's *own* sales (Brainstorm's platform fee is a separate revenue line on Brainstorm's tax return).

> **Decision (post-v2):** **sandbox-mode listings** are first-class. A developer can list, test, and refine without going through KYC. They cannot list publicly or accept real payment until verified. This shortens the "publish a free experiment" loop without weakening the trust surface for paid content.

> **Decision (post-v2):** Brainstorm does **not** store KYC documents or PII beyond what Stripe Connect's webhook returns to us (status, business name, country, payout currency). The developer's identity-document images are never visible to Brainstorm staff.

### The developer dashboard

Surfaces inside `developers.brainstorm.app`:

| Pane                          | What's there                                                                                                       | Phase     |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------|-----------|
| **Overview**                  | This week's installs, threat-intel state. Health-at-a-glance.                                                       | v2         |
| **Listings**                  | Per-listing CRUD: manifest URL, screenshots, description, channels.                                                  | v2         |
| **Versions**                  | Upload + sign new versions (the portal provides a browser-side signing flow that keeps the private key off our servers — see below). | v2 |
| **Analytics**                 | Installs / DAU / retention curves / version-uptake / geography (country-coarse), aggregated, no per-user data.       | v2         |
| **Reviews**                   | Catalog-supplied ratings + reviews; respond / flag affordances.                                                     | v2         |
| **Threat-intel**              | Any threat-intel-feed entries currently affecting your listings, with appeal mechanism.                              | v2         |
| **Support cases**             | User-submitted reports about your listings.                                                                          | v2         |
| **API keys**                  | Tokens for the developer-side CLI (publish from CI, automate listings).                                              | v2         |
| **Payouts**                   | Stripe Connect payout history; KYC status; tax-form status; bank-account changes.                                  | post-v2   |
| **Revenue**                   | Per-listing sales, refunds, platform-fee accumulation toward the $10k threshold.                                     | post-v2   |
| **Pricing**                   | Per-listing price + currency configuration; promotional opt-in toggle (see Fee mechanics below).                      | post-v2   |
| **Team**                      | Multi-publisher membership.                                                                                            | post-v2   |

> **Decision:** developer-side **signing keys never leave the developer's machine**. The portal's "upload a new version" flow signs the bundle in the browser (WebCrypto, the developer's exported keypair lives in IndexedDB locally) and uploads the signed bundle. The portal stores only the **public** key + the signed bundle. A developer worried about WebCrypto-side leakage signs offline with the CLI and uploads pre-signed.

### Per-listing CRUD

A listing is the **catalog row** for a piece of content. It records:

- Bound publisher key fingerprint (must match every uploaded bundle's signature).
- Manifest URL (the developer's canonical source; the catalog re-serves it with a cache + signature).
- Title, description, screenshots, tags, categories, locales.
- Channels (`stable`, `beta`, `dev`).
- Distribution: public / unlisted / sandbox.
- License + source repo + homepage + support URL.
- **(post-v2)** Pricing (one-time price + currency in post-v2; multi-tier subscriptions and free-trial in a later phase).

Editing a listing's channel state replicates to the catalog within minutes. Pulling a listing keeps already-installed users unaffected (their existing bundle continues to work; only new installs see the listing gone).

### Analytics

> **Decision:** developer-side analytics are **aggregated and coarse-grained**. We never expose per-user behavior to developers; we surface aggregates (installs, daily active users at the listing level, version-uptake curve, country grouped by region). Compatible with the privacy posture from [43 §What we explicitly do not monetise](../platform/43-monetisation-strategy.md): no user-level analytics, ever.

> **Decision:** developers can **not** see who installed their app (no email, no pubkey, no fingerprint). They see "Tuesday: 142 installs in US, 38 in EU, 12 in JP" and similar.

### Payouts (post-v2)

Stripe Connect handles payouts on the **standard schedule** (weekly, T+2 in the US; longer in some regions). Brainstorm collects the 0% or 15% platform fee as a **Stripe application-fee** at charge creation time (per [45 §Catalog fee collection](../platform/45-payments-architecture.md), which will be revised to drop the Paddle-Connect alternative); the remainder routes to the developer's Connect account; Stripe pays out per their schedule.

The developer dashboard surfaces:

- **Current balance** (Stripe-Connect-side; we display, we don't custody).
- **Next payout date + amount**.
- **Payout history** with downloadable summaries.
- **Tax statements** (1099-K in US; equivalent forms in EU; processed and delivered by Stripe).

> **Decision (post-v2):** developer payouts are **Stripe Connect's responsibility end-to-end**. We do not run a parallel payout flow. If Stripe Connect is unavailable in a country, the developer cannot list paid content from that country. We document the supported-country list in the developer portal and surface it at signup.

### Refunds and disputes (post-v2)

| Case                            | Who acts                                                                                                | Effect on the developer                                                                          |
|----------------------------------|---------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| User clicks "Refund" within 7 days | Catalog → Stripe → refund                                                                              | Reverses the sale; rolls back the developer's running-revenue counter for the 0%/15% threshold.   |
| User contacts developer for refund > 7 days | Developer issues refund in their dashboard                                                       | Same.                                                                                              |
| User contacts Brainstorm support > 7 days | We forward to developer with a recommended outcome                                                | Developer decides; we do not coerce.                                                              |
| Chargeback (card dispute)        | Stripe handles; developer notified; developer may submit evidence                                       | Held funds on the disputed amount; loss if upheld; counter rolled back.                            |
| Threat-intel flag (per 32)       | Catalog publishes flag; user's shell quarantines; developer notified with appeal flow                    | Listings paused pending appeal; existing installs see the threat-intel banner.                     |

> **Decision (post-v2):** the catalog provides **a single-click refund button** for catalog-mediated purchases, within the 7-day window, **without requiring the developer's involvement**. Stripe returns the funds; the developer's dashboard reflects the reversal. Beyond 7 days, the developer is the decision-maker.

### Multi-publisher orgs (developer teams — post-v2)

A real developer is sometimes a team. The portal supports:

- A **developer organization** with multiple members.
- Members have roles: owner, admin, publisher, billing.
- Listings are owned by the org, not by an individual member.
- The org has its own Stripe Connect account (KYC for the legal entity, not for individuals).

> **Decision:** multi-publisher orgs ship **post-v2**, alongside paid marketplace. The data model (`developer_org`, `developer_org_membership`) is reserved in the developer-portal schema from day one so the migration is non-breaking.

> **Open:** when multi-publisher orgs ship, do they share a single publisher key (simpler, but creates a "lose the key" multi-victim incident) or a key-per-publisher with org-signed cross-claims (more robust, more complex)? Tracked as OQ-MK-2 below.

## Fee mechanics — operational detail (post-v2)

This whole section describes the **post-v2 design**. None of it lands in v2 (which ships subscriptions-only commerce). It is documented here so that when paid marketplace activates post-v2, the schema, ops surface, and developer-facing semantics are already settled.

[43 §Catalog economics](../platform/43-monetisation-strategy.md) sets the rate (0% under $10k/yr, 15% above; sideload always 0%). [45 §Catalog fee collection](../platform/45-payments-architecture.md) describes the Stripe Connect mechanism (in the dual-processor variant; the Stripe-only revision will simplify this). This section fills in operational gaps relevant to the marketplace experience.

### Revenue measurement window

> **Decision:** the **$10k threshold is per publisher key, rolling 12 months, gross of refunds**. Specifically: at checkout-creation time the billing edge queries the running 365-day gross revenue attributed to the listing's publisher key; if that total is below $10k, fee = 0%; otherwise fee = 15% on the portion above $10k.

Rolling 365 days rather than calendar year:
- Reduces "I crossed the threshold in November and just hit a tax cliff for December" feel.
- Aligns with the fee being a **continuous** function of revenue, not a calendar-year ratchet.
- Refunds during the 365-day window subtract from the running total — a developer who refunds back below $10k pays 0% again on subsequent sales.

### Cross-listing accumulation

> **Decision:** revenue accumulates **per publisher key**, not per listing. A developer with three apps under the same key sees one cumulative meter; the 0%-threshold benefit is per-developer, not per-listing.

This prevents the obvious trick of splitting a successful product into many sub-listings to stay under the threshold each. It also matches the developer's natural mental model — they have one revenue line, not separate ones per SKU.

### Currency

> **Decision:** the threshold is denominated in **USD**, computed from each sale via Stripe's spot-rate at sale time. Sales in EUR / GBP / JPY etc. are converted at the rate Stripe returns on the charge webhook payload.

We pick USD because (a) Stripe Connect's reporting layer is USD-native; (b) the developer's local-currency revenue still matters to them locally, but for the threshold we need a single denominator; (c) Apple, Steam, and Stripe all denominate similar thresholds in USD. *(For a German company, EUR-denominated threshold is the obvious alternative. The trade-off is mainly cosmetic; USD is the industry default. Open to revisit per OQ.)*

The developer dashboard shows the running 365-day total in **both** USD and the developer's preferred reporting currency.

### Promotional opt-in (revisited)

[43](../platform/43-monetisation-strategy.md) introduces an option: a developer can opt to forgo the 0% threshold benefit in exchange for editorial-promotion eligibility (featured slots, newsletter inclusion, store-spotlight rotation). This is **strictly opt-in** and exists because editorial promotion has real ad-equivalent value, and asymmetric eligibility (only paying-fee developers get featured) better aligns with the no-paid-placement principle (paying-fee is *the same as paying-fee for everyone*, just at a different threshold).

> **Open:** does this opt-in actually balance correctly, or does it inadvertently push small developers to give up the threshold benefit before they should? Tracked as OQ-PA-5 (already open in [45](../platform/45-payments-architecture.md)). Re-surfaced here for visibility.

### Subscriptions vs one-time purchases

> **Decision:** v2 catalog-mediated commerce supports **one-time purchases only**. Subscriptions for marketplace items (a developer charging $5/mo for their app) land **post-v2** alongside Brainstorm Commerce. The 15% rate applies identically to one-time and (when shipped) subscription marketplace revenue.

Reasoning: subscriptions add cancellation, dunning, proration, plan-change UX surfaces that we already build for *our own* subs and would have to duplicate for marketplace subs. The duplication is non-trivial and not warranted in early post-v2. A developer who needs subscription pricing earlier ships it through their own out-of-band business (enterprise procurement contract, side-channel licensing) outside the Brainstorm app surface entirely — see *§The single-path rule* below.

## Plugins as a new content kind

A **plugin** is a v2 content kind: a small unit of extension that runs **inside a host app's renderer**, extending behavior without being its own app. Plugins solve "I want to add Math expressions to Notes" without forcing the user to install a whole new editor.

### What a plugin is, formally

A plugin is a `.brainstorm` archive with `manifest.kind: "plugin"`. The manifest declares:

```jsonc
{
  "id": "io.example.notes-math",
  "kind": "plugin",
  "currentVersion": "0.3.1",
  "host": {
    "appId": "brainstorm.notes",          // the app this plugin extends
    "appVersionRange": "^1.4.0",          // semver range
    "extensionPoint": "lexical-node"      // declared by the host app
  },
  "publisherKey": "ed25519:...",
  // … standard metadata
}
```

The plugin runs in the **host app's renderer**, sharing its capabilities. It does *not* request its own capabilities — it inherits.

> **Decision:** a plugin **cannot request capabilities the host app doesn't already have**. The plugin's effective capability set is a *subset* of the host's. This collapses the trust model to "trust the plugin as much as you trust the host app you installed it into", which is the only mental model users can sanely reason about.

### The host-app extension contract

A host app declares the extension points it offers in its manifest:

```jsonc
{
  "id": "brainstorm.notes",
  "pluginHost": {
    "extensionPoints": [
      { "id": "lexical-node",         "stable": true,  "since": "1.4.0" },
      { "id": "slash-command",        "stable": false, "since": "1.5.0-beta" }
    ]
  }
}
```

Each extension point has an **API surface** (a TypeScript interface) the host app publishes alongside the manifest. The plugin developer implements that interface. The host app loads the plugin lazily, validates it conforms to the interface, mounts it.

> **Decision:** **host apps are responsible for their plugin runtime**. Brainstorm provides the install / sandbox / capability-inheritance machinery; the host app provides the mount mechanics, lifecycle hooks, and the API surface. We do not run a plugin runtime; the host app does.

> **Decision:** the host app's API surface is **versioned**. The plugin manifest's `appVersionRange` gates whether the plugin is compatible. The shell warns at install time if the host app's version drifts below the range.

### Sandbox posture

Plugins run **inside the host app's existing renderer**, not in their own isolated context. Per [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)'s "intra-app windows share a renderer" decision (OQ-4 (b)), the trust boundary is the *app*, not the plugin. A malicious plugin can do anything the host app can do; the user accepts that when they install the plugin.

This is the **same trust model** as browser extensions for a single browser tab: a Chrome extension running in a tab can do anything the tab is allowed to do. We don't pretend otherwise.

> **Decision:** the trust model for plugins is explicit at install time: the install confirmation reads **"This plugin runs inside *<host app name>* and can do anything *<host app name>* can do."** No additional capability prompts beyond what the host app already requested.

### Plugin runtime design (deferred)

The detailed plugin runtime (loader, lifecycle, hot-reload during dev, API-surface stability story, deprecation policy, plugin-to-plugin conflict resolution) is **not in scope of this doc**. It lands in a separate doc when the first host app declares plugin support (the Notes app is the natural candidate; Stage 13 Lexical work is the prerequisite).

> **Decision:** plugin runtime design is a **post-Stage-13 doc**. This doc reserves the content-kind slot, the marketplace listing surface, and the install flow. The runtime is a future doc.

> **Open:** which host app ships the first plugin extension point — Notes (Lexical nodes), Database (custom view kinds), or Graph (custom layout algorithms)? Lean: Notes, since it has the most mature node-extension surface and broadest user reach. Tracked as OQ-MK-3 below.

## Scaling to future kinds

The kind registry is open. Adding a kind is a documented process so we don't end up with `kind: "snowflake"` for every new content-shaped idea.

### What a kind requires

To add a new kind to the registry, the following must exist:

1. **A design doc** in `docs/apps/` or `docs/platform/` describing the kind, its data shape, its threat model, its install lifecycle.
2. **A validator** (static checks for passive-data kinds, behavioral fuzz for active-code kinds).
3. **A capability surface** (`[]` for passive kinds; declared otherwise).
4. **A signature policy** (whether signing is mandatory, recommended, or optional).
5. **Kind-card and kind-detail React components** for the store surface.
6. **A "manage row"** for the Library.
7. **An installer + uninstaller + updater** (often trivial — drop a file in the registry, mark it active).
8. **A threat-intel-feed-mapping** (`kind` is included on feed entries so subscribers know what they're filtering).
9. **A `brainstorm-cli pack` adapter** so authors can package the kind.
10. **An OQ-tracked phasing plan** (when v1? v2? post-v2?).

> **Decision:** a new kind ships only when all 10 are in place. We do not introduce "experimental kinds" with under-spec'd review — historically that's how install ecosystems get sloppy.

### What makes a *good* kind

A kind should be considered for the registry if it satisfies all of:

- **Plural authorship is real.** Multiple authors will plausibly publish content of this kind. (Counter-example: "user's personal API key" is not a kind — there's exactly one author per key.)
- **Distribution adds value.** Putting it through manifest URLs and signed bundles adds something a direct file-share can't (discovery, updates, threat intel). Counter-example: a one-line text snippet doesn't.
- **The threat profile is clean.** Either passive data with a static validator, or active code under an existing trust model. We do not introduce "active code under a new partial trust model."
- **It composes with existing kinds.** New kinds slot into the existing surface; they don't require a parallel marketplace UI.

We will say **no** to kinds that don't meet all four. The right home for one-off content is the user's drive or their preferred file-sharing service.

### Kind RFC process

> **Decision:** a new kind is proposed via an RFC in `docs/apps/` (or `docs/platform/` if the kind cuts across product surfaces). The RFC is reviewed against the four "good kind" criteria. The RFC lists the 10 deliverables and identifies which stage of the implementation plan introduces each. The RFC lands as a doc and slots into the index reading order.

The RFCs we already implicitly have, treated as the canonical examples:

- `app` — [14-app-store.md](14-app-store.md), [03-app-model.md](03-app-model.md).
- `theme` / `token-set` / `icon-pack` / `typography` — [40-theme-store.md](40-theme-store.md).
- `layout-pack` — [27-layouts.md](../shell/27-layouts.md) (kind is implied; OQ-89 tracks).
- `wallpaper-pack` — OQ-173 tracks.
- `locale-pack` — [21-localization.md](../platform/21-localization.md) describes the content, this doc names the kind.
- `workflow-pack` — [39-automations-and-workflows.md](39-automations-and-workflows.md).
- `shortcut-pack` — [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).
- `plugin` — this doc reserves the kind; runtime doc deferred.

## Capability surface — new

Additive to [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) and the existing `commerce.*` capabilities in [45 §Capability surface](../platform/45-payments-architecture.md). Apps almost never request marketplace capabilities; the surface is shell-internal.

| Capability                              | Holders                          | Allows                                                                          |
|-----------------------------------------|----------------------------------|---------------------------------------------------------------------------------|
| `marketplace.read`                       | shell only                       | The Marketplace shell surface reads the catalog index, listings, threat intel.   |
| `marketplace.install`                    | shell only                       | Trigger installs (kind-dispatched to the right installer).                        |
| `marketplace.uninstall`                  | shell only                       | Trigger uninstalls.                                                              |
| `wallet.read`                            | shell only                       | Wallet surface reads `wallet.db`.                                                |
| `wallet.write`                           | shell only                       | Wallet surface records purchases, updates payment methods.                       |
| `developer-portal.bridge`                | not granted to apps               | (Web-only — the developer portal authenticates over a sovereign-key signature handshake; no in-shell SDK surface.) |
| `commerce.read` *(unchanged from 45)*    | any app (auto-granted)            | Read user's plan + quotas; show "you own this app" badges.                       |
| `commerce.verifyLicense.self` *(unchanged from 45)* | any app (auto-granted)  | Verify the calling app's own license token.                                       |

> **Decision:** no app receives `marketplace.*` or `wallet.*` capabilities. The marketplace and wallet are shell-only surfaces; any third-party "store-like" experience is a separate app calling out to the shell-owned surface via shell-provided intents (`intent: marketplace.open(listingId)`).

## SDK surface — additions

Apps that interact with the marketplace and wallet do so through these helpers, added to the existing `brainstorm.services.commerce` namespace (per [45 §SDK surface](../platform/45-payments-architecture.md)):

```ts
// Already in 45 — restated for completeness:
brainstorm.services.commerce.getPlan(): Promise<PlanInfo>;
brainstorm.services.commerce.getQuotaUsage(metric): Promise<QuotaUsage>;
brainstorm.services.commerce.requestUpgrade(targetPlan): Promise<void>;  // opens shell flow
brainstorm.services.commerce.verifyLicense(licenseToken): Promise<LicenseVerification>;

// New in 47:
brainstorm.services.commerce.openMarketplace(deepLink?: MarketplaceDeepLink): Promise<void>;
// opens the shell-owned Marketplace surface, optionally deep-linking to:
//   { kind: 'listing', listingId, channel? }
//   { kind: 'library', filter? }
//   { kind: 'wallet', view? }

brainstorm.services.commerce.ownsItem(itemId: string): Promise<boolean>;
// "is there a non-revoked entitlement in the wallet for this item id?"
// Useful for a host app to gate content (e.g., a free app with a paid plugin).

brainstorm.services.commerce.onWalletChange(handler): UnsubscribeFn;
// fired when an entitlement is added / removed / changed state.
```

> **Decision:** **`ownsItem` is the only wallet-readable surface for apps**. Apps cannot iterate the wallet, cannot see other items' details, cannot read the user's payment methods. The wallet is shell-only for everything else.

> **Decision:** **deep-linking** into the Marketplace is shell-owned. A third-party app can request `openMarketplace({ kind: 'listing', listingId: '…' })`, the shell opens the Marketplace with that listing focused; the app receives no observable state about whether the user installed, bought, or dismissed.

## Threat model — additions

Most of the threat surface for installable content is in [14 §Threats and mitigations](14-app-store.md), [32 §Five mechanisms](32-store-verification.md), and [40 §Threat model for themes](40-theme-store.md). The marketplace + wallet add a few:

| Attack                                                                | Mitigation                                                                                              |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Malicious checkout URL impersonating a legitimate one                 | Checkout links are catalog-issued, single-use, signed with a Brainstorm-side timestamp, expire after 24h (per [45 §Fraud](../platform/45-payments-architecture.md)). The checkout opens in shell-owned chrome; no app can intercept input. |
| Wallet-poisoning by a malicious developer (inject false entitlement)  | Entitlement tokens are Ed25519-signed by the developer's license-issuing key, trusted-on-first-use; rotation requires a signed-by-old-key record. A spoofed token fails verification. |
| Phishing developer portal (steal a publisher's signing key via OAuth-like flow) | Developer-portal auth is sovereign-key challenge-response — no OAuth, no password, no shared secret to phish. Browser-side signing keeps the private key off our servers. |
| Catalog rank manipulation (paid placement)                             | No paid placement, ever (restated). Editorial featured slots are documented to users.                    |
| Listing impersonation (similar-named listing under different key)      | App-impersonation detection at install (per [32 §App-impersonation detection](32-store-verification.md)) extends to all kinds. Fuzzy name + publisher-key disambiguation. |
| Compromised developer-portal session                                  | Sessions are bound to device key + short-lived (15 min, refreshed via sovereign-key signature). Listing changes require a fresh signature, not just a session cookie. |
| Plugin escalates beyond the host app's capabilities                    | Plugin capabilities are *intersect* with host-app capabilities, enforced by the host app's plugin loader. The shell's capability ledger sees only the host app's grants. |
| Wallet re-hydration on a compromised device                            | Sovereign-key challenge-response. A device without the sovereign key cannot reconstitute the wallet. Compromised devices are revoked via the existing identity-recovery flow ([16](../security/16-identity-orgs-encryption.md)). |
| Coercive refund-then-keep-using on a paid app                          | Refund triggers entitlement-state → `refunded`; `verifyLicense` returns negative; the app refuses access on next launch. (Developer's responsibility to honor entitlement state in their app.) |

> **Decision:** the **refund-and-keep-using** attack is the developer's to mitigate at the app level — Brainstorm provides the entitlement-state change, the developer's app must honor it. We document the expected check (`verifyLicense` on each launch + on resumption) in the developer-portal docs.

## Phasing

Reconciled with [implementation-plan.md](../implementation-plan.md) Stage 14 + [43](../platform/43-monetisation-strategy.md) / [45](../platform/45-payments-architecture.md) phasing. The new iterations introduced by this doc slot into Stage 14 alongside existing 14.10 / 14.11.

| Capability                                                       | v1 (Stages 0–13)                  | v2 (Stage 14)                                              | post-v2                              |
|------------------------------------------------------------------|------------------------------------|------------------------------------------------------------|--------------------------------------|
| Marketplace shell surface (privileged view)                       | minimal store via [14 §Discovery](14-app-store.md) | full surface (this doc), **free items only**           | adds paid surfaces                    |
| Content-kind registry — runtime + manifest discrimination          | `app` + `theme` + theme-components | adds `plugin` (slot reserved), `layout-pack`, `wallpaper-pack`, `locale-pack`, `workflow-pack`, `shortcut-pack` (all free in v2) | paid distribution layered on existing kinds |
| Browse + search + detail page                                      | —                                  | yes                                                        | richer                                |
| Library (installed + updates surface)                              | minimal (per-kind today)            | unified across kinds                                       | -                                     |
| Wishlist                                                            | —                                  | yes (v2.x)                                                  | -                                     |
| Sources (catalog subscription manager)                              | manual subscribe via [14 §Third-party catalogs](14-app-store.md) | richer UI                                | federation features                   |
| Wallet — payment methods (for subs)                                 | —                                  | yes (Stripe Customer object surface)                       | -                                     |
| Wallet — subscription state, receipts, tax info                     | —                                  | yes                                                        | -                                     |
| Wallet — export (subs)                                              | —                                  | yes (CSV / PDF)                                             | -                                     |
| Wallet — re-hydrate on new device                                    | —                                  | yes (sovereign-key challenge)                                | -                                     |
| Wallet — purchases / entitlements (marketplace items)               | —                                  | schema lands empty (forward-compat)                          | yes (activated with paid marketplace) |
| Wallet — trusted license-issuer TOFU records                         | —                                  | schema lands empty                                            | yes                                   |
| Wallet — AI credit balance (single-purpose voucher, PSD2/ZAG)        | —                                  | schema lands empty                                            | yes (per §The AI credit balance)       |
| Developer portal — sign-in, free listings, browser-side signing       | —                                  | yes (Stage 14.22)                                          | -                                     |
| Developer portal — aggregated analytics, threat-intel + appeal        | —                                  | yes                                                        | richer                                |
| Developer portal — Stripe Connect Express, KYC, payouts, tax statements | —                                | —                                                          | yes (with paid marketplace)            |
| Developer portal — multi-publisher orgs                              | —                                  | —                                                          | yes                                   |
| Developer portal — API surface (publish-from-CI, read analytics)     | —                                  | yes (Stage 14.22, per OQ-MK-9 lean)                        | -                                     |
| Fee mechanics — 0%/15% per publisher key, rolling 365d gross          | —                                  | —                                                          | yes (with paid marketplace)            |
| Cross-listing accumulation                                            | —                                  | —                                                          | yes                                   |
| Promotional opt-in trade                                              | —                                  | —                                                          | yes                                   |
| Paid marketplace items (one-time purchases)                          | —                                  | —                                                          | yes                                   |
| Marketplace subscriptions (developer charges €5/mo for an app)        | —                                  | —                                                          | later post-v2                          |
| Plugins as a content kind (free)                                       | —                                  | yes (slot reserved; runtime doc deferred)                    | runtime doc + first host-app support  |
| Brainstorm Commerce (managed payments for developers)                  | —                                  | —                                                          | later post-v2                          |
| Payment processor                                                      | n/a                                | **Stripe + Stripe Tax** (Brainstorm as MoR via EU OSS / Germany; UK VAT separately; US state nexus via Stripe Tax) | adds Stripe Connect Express for marketplace |

### Stage 14 — new iterations introduced by this doc

These slot into [implementation-plan.md](../implementation-plan.md) Stage 14 alongside the existing 14.1 – 14.16. v2-scope iterations land in v2; post-v2 iterations are documented here for forward-compat but **build later**.

| Iteration | Phase    | Scope                                                                                                                       |
|-----------|----------|------------------------------------------------------------------------------------------------------------------------------|
| 14.17     | v2       | Content-kind registry runtime + manifest enum + per-kind descriptor scaffolding in the shell.                                |
| 14.18     | v2       | Marketplace shell surface — Discover / Browse / Library / Updates / Sources panels; deep-linking; cross-kind search. **Free items only.** |
| 14.19     | v2       | `wallet.db` schema + repos under `main/wallet/repos/`; `WalletService` skeleton; wallet UI shell. Schema lands all tables (sub-related and post-v2 placeholders) so post-v2 activation is a feature flip, not a migration. |
| 14.20     | v2       | Wallet — payment methods (Stripe Customer object surface, SEPA + cards + Apple Pay + Google Pay + iDEAL); subscription state surface; sub receipt cache. |
| 14.21     | v2       | Wallet — receipt / invoice surface for subscriptions; tax info (country + VAT/GST ID); CSV / PDF export.                       |
| 14.22     | v2       | Developer portal v1 — sovereign-key sign-in; listings CRUD (free items); browser-side signing flow; aggregated analytics; threat-intel + appeal; developer-portal API (publish-from-CI + read-only analytics + listing CRUD, per OQ-MK-9 lean). **No Stripe Connect, no KYC, no payouts** — those defer to post-v2. |
| 14.23     | v2       | New content kinds (all free) — `layout-pack` (closes OQ-89), `wallpaper-pack` (closes OQ-173), `locale-pack`, `workflow-pack`, `shortcut-pack`; their validators + installers + listing surfaces + `brainstorm-cli pack` adapters. |
| 14.24     | v2       | Plugin **slot reservation** — `ContentKind.Plugin` enum member + manifest validator + marketplace listing surface. Runtime not yet wired (deferred to a post-Stage-13-and-14 plugin runtime doc, gated on the first host app declaring an extension point). |
| 14.25     | post-v2  | Paid marketplace activation — Stripe Connect Express developer onboarding; KYC handoff; checkout flow (shell-owned chrome); entitlement-token issuance + storage in `purchase` table; `commerce.ownsItem` SDK helper; refund-within-7-days self-serve. |
| 14.26     | post-v2  | Fee mechanics operational layer — rolling-365d gross attribution per publisher key (Stripe application-fee at charge time); cross-listing accumulation; USD-denominated threshold with per-sale spot-rate conversion; promotional-opt-in toggle; refund-aware accumulation math. |
| 14.27     | post-v2  | Multi-publisher developer orgs — schema reserved in 14.22; activated here. Owner / admin / publisher / billing roles. Listings owned by the org. Org-level Stripe Connect account. |
| 14.28     | post-v2  | AI credit balance — `ai_credit_ledger` + `ai_credit_topup` tables activated. Single-purpose voucher under EU 2016/1065; Stripe Tax computes VAT at top-up; BaFin §2a notification process documented and trigger-monitored at €800k outstanding-balance watermark. ≥3-year expiry; refund-on-account-closure flow. |

The existing iterations 14.10 (developer portal Stripe Connect onboarding) and 14.11 (catalog fee collection) **defer to post-v2** alongside the marketplace-paid surfaces. They are not v2 work. The current 14.10 / 14.11 entries in the implementation plan should be moved (this reconciliation tracked in the cross-doc updates below).

> **Decision:** the 14.x numbering is preserved (no renumbering) so existing iteration references in commits and review notes remain valid. Iterations 14.25 – 14.28 are tagged **post-v2** in the implementation plan; they execute as their own sub-stage after v2 ships, gated on observed demand for paid marketplace + AI credits.

> **Decision:** 14.24 ships the plugin **content kind** but not the **plugin runtime**. The plugin runtime is a future doc + future implementation that depends on at least one host app declaring an extension point (Notes / Database / Graph). Listing plugins (free) without a runtime is intentional: it lets developers prepare while the runtime work happens.

## Cross-doc reconciliation

Adopting this doc requires light edits in the docs that already touch the surface:

- **[14-app-store.md](14-app-store.md)** — add a forward-link to this doc from §Discovery and §Economic model. The marketplace surface here generalises the app-store surface there.
- **[40-theme-store.md](40-theme-store.md)** — add a forward-link from §Discovery in the shell. The theme surface plugs into the unified marketplace.
- **[43-monetisation-strategy.md](../platform/43-monetisation-strategy.md)** — note that the wallet is the UX wrapper for the commercial surface. No principle change.
- **[45-payments-architecture.md](../platform/45-payments-architecture.md)** — link from §Catalog fee collection to this doc's developer-portal section; note that `wallet.db` is the user-side companion to `account.db` (per the §Wallet data model section above).
- **[26-shell-as-framework.md](26-shell-as-framework.md)** — link from §Paid apps and revenue to this doc's developer-accounts section.
- **[implementation-plan.md](../implementation-plan.md)** — add iterations 14.17 – 14.26; note their dependencies on 14.10 / 14.11 / 14.6.
- **[00-index.md](../00-index.md)** — insert this doc in the Distribution-and-trust section, after 40 (theme store) and before 32 (store verification); or as a top-level new section "Marketplace and commerce" depending on framing preference. (Lean: after 32, before the cross-cutting section, since it bridges install + commerce.)

## Open questions

Added to [11-open-questions.md](../reference/11-open-questions.md) under a new "Marketplace and wallet (added in 47)" subsection:

- **OQ-MK-1** — ~~Wallet-aggregation opt-in for developers selling outside the catalog~~ — **RESOLVED by the single-path rule** (Principle 3 above): all paid distribution is catalog-mediated; aggregation is automatic for every catalog-mediated purchase; selling outside the catalog is not a permitted path. No opt-in surface needed.
- **OQ-MK-2** — Multi-publisher developer orgs (post-v2): single shared publisher key (simpler, single-incident risk) vs key-per-publisher with org-signed cross-claims (more robust, more complex)? Lean: key-per-publisher.
- **OQ-MK-3** — Which host app ships the first plugin extension point — Notes (Lexical nodes), Database (custom view kinds), or Graph (custom layout algorithms)? Lean: Notes.
- **OQ-MK-4** — Per-developer rate-card variation: should we ever offer per-developer rate negotiation (e.g., "your app is strategic to us, you get 5% instead of 15%")? Lean: no — the rate is published, rate-card-only, no negotiation (per [43 §Catalog economics](../platform/43-monetisation-strategy.md)). Surfaced here for explicit closure.
- **OQ-MK-5** — Marketplace subscriptions for third-party apps (post-v2, with Brainstorm Commerce): same 15% rate or different rate to account for subscription churn handling? Lean: same rate.
- **OQ-MK-6** — Cross-developer co-authoring (two publisher keys co-sign one listing): should the catalog support multi-signature listings (a theme co-signed by a designer and a typographer)? Lean: no in v2; revisit with observed demand.
- **OQ-MK-7** — Refund policy for catalog-mediated content beyond 7 days: developer-controlled (current decision) vs catalog-mediated escalation path (the catalog can refund as a courtesy and absorb the cost)? Lean: developer-controlled.
- **OQ-MK-8** — Wishlist surface on the marketplace: nice-to-have or essential for v2? Lean: nice-to-have, ships post-14.18 if time allows.
- **OQ-MK-9** — Developer-portal API surface: should we ship a public developer-portal API (publish-from-CI, automate listings, query analytics programmatically), or keep the portal web-only in v2? Lean: yes, ship a developer-portal API in 14.22 with read-only analytics + listing CRUD.
- **OQ-MK-10** — Wallet-side per-kind organization: in the wallet, should purchases be grouped by kind (Apps / Themes / Plugins / …) or chronologically (most recent first)? Lean: kind-grouped with a toggle for chronological.

## Summary

- **One marketplace, all kinds.** Apps, themes, plugins, icon packs, layout packs, locale packs, workflow packs, shortcut packs, wallpaper packs — all in one shell-owned surface, listed through one extensible content-kind registry.
- **v2 ships subscriptions-only commerce + free marketplace.** Plus / Pro / Team / Enterprise subscriptions per existing [43](../platform/43-monetisation-strategy.md) / [44](../platform/44-pricing.md). Marketplace surfaces every content kind as free. Paid marketplace surfaces, developer KYC + payouts, AI credit balance — all deferred to post-v2, architecturally anticipated in v2 schema so activation is a feature-flip not a migration.
- **Single-path commerce (load-bearing).** When paid marketplace ships post-v2, the Brainstorm catalog is the **only** charging path. Apps cannot integrate Stripe (or any processor) into their own runtime; developers cannot run a side-channel "buy on my website, activate via license key" flow against Brainstorm users. Sideload stays free-only. Enforced by review (rejects processor-SDK imports), runtime sandbox (blocks outbound to processor domains from app renderers), and build-time linter in `@brainstorm/sdk`.
- **The wallet is a UX aggregator, not a balance.** Brainstorm doesn't hold the user's money in any transferable form. In v2: subscription state, payment methods (Stripe Customer tokens), subscription receipts, tax info. In post-v2: marketplace entitlements (catalog-issued Ed25519-signed tokens) + AI credit balance (single-purpose voucher under PSD2 Art 3(k) / ZAG §2a).
- **The AI credit balance is the only balance-shaped instrument we ever ship**, and is engineered to fit the EU single-purpose voucher + limited-network exemption by construction: single-purpose for AI broker only; non-transferable; non-refundable past 14-day withdrawal window with statutory exceptions; ≥3-year expiry; VAT at top-up via Stripe Tax; BaFin notification at €1M-rolling-12-mo outstanding balance.
- **Payment processor: Stripe-only.** Stripe + Stripe Tax for subscriptions and (post-v2) marketplace + AI credits. Brainstorm becomes Merchant of Record for consumer SKUs, with EU OSS registration via Germany covering all 27 EU member states. UK VAT registration separately. US state nexus via Stripe Tax's auto-registration. [45-payments-architecture.md](../platform/45-payments-architecture.md) is flagged for revision (its current dual-processor design with Paddle MoR + Stripe is superseded by this Stripe-only posture).
- **Developer portal at `developers.brainstorm.app`** — v2: sovereign-key auth, free listings, browser-side signing, aggregated analytics, threat-intel + appeal, public API for publish-from-CI. post-v2: Stripe Connect Express, KYC, payouts, multi-publisher orgs.
- **Plugins are a v2 content kind** with the manifest slot reserved (14.24). Plugin runtime design is a deferred future doc; host-app extension points (Notes / Database / Graph) drive the first runtime work post-Stage-13.
- **Fee mechanics (post-v2)**: 0% under $10k/yr rolling 365-day gross per publisher key; 15% above the threshold; cross-listing accumulation per publisher; rate is published, no negotiation; promotional opt-in trade exists.
- **Lands in Stage 14** of [implementation-plan.md](../implementation-plan.md): v2 iterations 14.17 – 14.24; post-v2 iterations 14.25 – 14.28. Existing 14.10 / 14.11 move to post-v2 alongside the marketplace-paid surfaces.
- **Surfaces 10 new open questions** (OQ-MK-1 resolved by the single-path rule; OQ-MK-2 through OQ-MK-10 + new OQ-MK-11 / OQ-MK-12 from the AI credit section) for follow-up.
