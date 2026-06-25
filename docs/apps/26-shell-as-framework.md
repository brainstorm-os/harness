# 26 — Shell as a framework for app development

This doc describes Brainstorm's **in-product app-development** capabilities: a code-editor app that runs inside the shell, dev-mode hot-reload, in-shell testing, packaging, and publishing — the full author lifecycle for new apps **without leaving Brainstorm**. The model is roughly "browser extensions, but with first-class sandboxing and a real distribution path including paid apps".

It builds on [03-app-model.md](03-app-model.md) (what an app is), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (the trust model), and [14-app-store.md](14-app-store.md) (the packaging and distribution flow).

## The vision

A user has an idea: a small app that pulls together their notes and tasks in a particular way. Today, "build a small app" means installing Node + a build tool + scaffolding + an editor + figuring out signing + finding a host. By the time you have a working dev loop you've spent a weekend.

Brainstorm's pitch: open the **Code Editor app**, click "New App", get a working scaffold and a live preview window. Edit, save, see it in your shell instantly. When it's good, click "Pack" to produce a `.brainstorm` bundle. Click "Sign" to sign it with a keypair the shell already manages for you. Click "Share Link" to install it on another device, or "Publish to Catalog" to list it.

Three benefits fall out:

1. **Parity with installed apps.** A dev-mode app runs in the same sandbox, with the same capability model, as any installed app. There is no privileged "developer-only" path that can exfiltrate or escalate.
2. **Personal apps stay personal.** Most of what people build will be small, idiosyncratic, never published. The product makes that natural — a personal app is just a dev-mode app you never bother to publish.
3. **The marketplace pull is real.** Lower the barrier to publishing, more apps get published. Brainstorm's value proposition compounds with ecosystem size.

## Components

The pieces that have to exist for this to work.

### Code Editor app

A first-party app that ships with the shell (or installs on first need). It is a real code editor:

- **Lexical-bound** for general text? No — code editing has different needs (syntax-aware navigation, multi-cursor, structural navigation). Use **CodeMirror 6** or a Monaco-like editor for the code surface; Lexical remains the rich-text editor for non-code surfaces.
- **TypeScript-aware** with Language Server Protocol (LSP) integration — `typescript` running in a Web Worker, providing completions, hover types, find references, rename.
- **Project-aware** — opens a Brainstorm app project (see below) and shows file tree, manifest editor, capability declarations, run/test buttons.
- **Block Protocol-aware** — knows about BP types and blocks; can scaffold a new block via `create-block-app`.
- **Test integration** — runs the project's tests using a bundled `vitest` runner.
- **Git** (post-v1) — for users who want version control.

> **Decision:** the Code Editor app uses CodeMirror 6 as the editing surface (smaller, embeddable, well-suited to in-product authoring). Monaco is too heavy. The same app can later expose Lexical-mode for prose files.

> **Decision:** the Code Editor app is **just an app** — it has no special privileges. It uses the SDK like any app would. Its capabilities are scoped to the app project the user is editing.

### App projects

An **app project** is a special kind of entity (`brainstorm/AppProject/v1`) that holds the source files and manifest of an in-development app. Treating projects as entities means:

- They sync across the user's devices via Yjs (write code on the laptop, continue on the desktop).
- They get versioning, search, sharing, all the entity machinery.
- The Code Editor app reads/writes them via standard `entities.*` calls.
- A user's projects appear in the launcher, can be tagged, can be exported.

Project structure (canonical):

```
my-app/                         (a brainstorm/AppProject/v1 entity)
├── manifest.json               (the app's manifest — see 03-app-model.md)
├── package.json                (npm-style; references SDK and other deps)
├── tsconfig.json
├── src/
│   ├── index.tsx
│   ├── components/
│   └── ...
├── i18n/                       (per 21-localization.md)
├── icons/                      (or referenced from a base icon pack)
├── tests/
└── README.md
```

Files inside a project are stored as content within the project entity (or as referenced File entities for binary assets). The Code Editor app shows them as a normal file tree.

### Dev mode

A shell capability, opt-in per device, that enables:

- **Loading apps from app projects** — runs the project's bundle (post-build) directly without a packaged `.brainstorm` archive.
- **Hot reload** — file save → background rebuild → renderer reloads.
- **Test runs** — the app project can run its tests against a real shell environment.
- **Capability stubs** — for capabilities the user hasn't granted yet, dev mode can stub them with prompts ("This app would request `network.connect`; mock the response?") for testing.

> **Decision:** dev mode **does not** disable sandboxing or capability prompts. Apps in dev mode are still capability-gated; the user grants the same way they would for a packaged app. The only difference is the source: project-from-disk vs. signed-bundle-from-catalog.

> **Decision:** dev mode is **per-device** (not per-user). Enabling dev mode on the laptop doesn't enable it on the phone. Reason: the surface is sensitive (loading unsigned code) and the user should opt-in per machine.

### Hot reload

When the user saves a file in the Code Editor app:

1. The Code Editor writes the change to the project entity.
2. The shell's dev-mode controller observes the project entity's change.
3. It rebuilds the app's bundle (Vite in incremental mode, in a background worker).
4. On successful build, it tells the running app's renderer to reload.
5. The renderer reloads. The new code starts.

State **survives** reloads where it lives in Yjs entities (any entities the dev-mode app was reading). Pure renderer state (in-memory React state) is lost — same as a refresh would do. This is a feature: it forces the developer to design state correctly from the start.

> **Decision:** hot reload is full-renderer reload, not React Fast Refresh. Fast Refresh is brittle for apps that mix React with non-React surfaces (Lexical, fancy-menus, pdfjs, etc.). Full reload is reliable; the speed penalty is small with Vite.

### Test environment

Three layers of testing match three needs:

1. **Unit tests** (Vitest) — pure logic. Run in a Node worker. No shell integration required.
2. **Component tests** — render React components in isolation. Use `@testing-library/react` + Vitest's browser mode.
3. **Integration tests** — run the app *inside a mock shell*. Brainstorm provides `mock-shell-dock` (analogous to `mock-block-dock` from BP) that simulates the SDK surface, capability prompts, sync, persistence.

The Code Editor app's "Run Tests" button picks the appropriate layer based on file location (anything in `tests/integration/` runs in mock-shell-dock; etc.).

> **Decision:** integration tests run against `mock-shell-dock`, not the full shell. Faster, no flakiness from real OS interactions. A separate "live test" mode runs the real shell for end-to-end smoke tests.

### Build and pack

The Code Editor app exposes:

- **Build** — runs the project's Vite build, produces optimized bundles in a temp area.
- **Pack** — wraps the build output + manifest + assets + signatures into a `.brainstorm` archive (per [14-app-store.md](14-app-store.md)).
- **Verify** — runs static checks: capability declarations match actual code, no inline strings (per [21-localization.md](../platform/21-localization.md) tooling), no obvious lint failures, manifest valid.

These are wrappers around `brainstorm-cli` (per [14-app-store.md](14-app-store.md)) — same tooling the dedicated CLI provides, exposed as buttons in the editor.

### Sign and publish

The shell already manages a keypair per user (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)). Reuse the same identity infrastructure for app signing — though typically with a *separate* signing keypair scoped to "apps I publish" (so the user's identity-signing key isn't used for app distribution).

**Sign** — generates the signature record over the packed archive using the user's app-signing key.

**Publish** — three options:

- **Share link** — generate a manifest URL pointing at a personal hosting endpoint (the user's own server, an attachment-storage URL, a quick-share endpoint). The link is what travels.
- **Self-hosted catalog** — push to a catalog the user runs (per [14-app-store.md](14-app-store.md)).
- **Brainstorm catalog (v2)** — submit to the official catalog. Triggers automated review.

> **Decision:** the dev path defaults to **share link** — frictionless internal/personal sharing without any catalog. Publishing to the official catalog is an explicit later step.

## Capability handling for in-development apps

> **Decision:** dev-mode apps go through **the same capability prompts** as installed apps. A dev-mode app declaring `entities.write:io.example/Note/v1` triggers the same install-time review as any other app's install.

This is critical for two reasons:
1. The user can't reason about safety if dev mode magically grants everything.
2. It ensures the developer experiences the exact prompts their users will see, catching capability-request UX issues early.

Three differences from installed-app capability handling:

- Capability prompts can be **stubbed** for tests (the test framework provides preset answers).
- Hot reload **does not re-prompt** for already-granted capabilities even if the manifest changes — but if the manifest *adds* a capability, that triggers a re-prompt on the next renderer reload.
- The user's grants for a dev-mode app are **scoped to the project** (not the eventual published app id). If the same project later publishes as `io.example.tasks`, the published app starts with no grants — it's a different app from the user's perspective.

## Paid apps and revenue

Paid apps ship **post-v2** (not in v2). The full design — developer portal, KYC handoff, payouts via Stripe Connect Express, fee mechanics, the single-path commerce rule, refund and dispute handling — is in [47-marketplace.md](47-marketplace.md). The note below restates the headline shape; 47 is authoritative on the details.

> **Decision (post-v2 — per [47 §Principles](47-marketplace.md)):** Brainstorm supports paid apps via the catalog. The **catalog is the only paid surface** — apps cannot integrate any payment processor (Stripe.js, Paddle.js, PayPal SDK, etc.) into their own runtime; developers cannot run a side-channel "buy on my website + activate via license key" flow against Brainstorm users. Sideload distribution stays free-only. v2 supports **one-time purchases only**; subscriptions and donations/tipping for marketplace items are later post-v2.

Mechanism (full economics in [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md); concrete fee schedule in [44-pricing.md §Catalog economics](../platform/44-pricing.md); plumbing in [45-payments-architecture.md §Catalog fee collection](../platform/45-payments-architecture.md), revision pending):

- Payment routes through **Stripe Connect Express on Brainstorm's platform account**. Stripe Checkout collects payment in shell-owned chrome; Stripe's Connect application-fee semantics route the platform fee to Brainstorm and the principal to the developer's Connect sub-account.
- The **entitlement token** for each purchase is issued by the **Brainstorm catalog** (Ed25519-signed by the catalog's token-issuing key) on charge completion, and stored in the user's wallet. The app validates the token at runtime via the SDK helper `commerce.verifyLicense(token)`. There is no developer-side license-issuance path.
- Brainstorm **takes a platform fee** on catalog-mediated purchases: **0% on the first $10k/year of catalog revenue per developer, 15% above** (resolves OQ-81). Sideload installs incur no fee — *because sideload is free-only* under the single-path rule.
- The catalog provides a **single-click refund** for catalog-mediated purchases within 7 days; beyond 7 days, the developer is the decision-maker via their developer-portal dashboard.

> **Decision:** the catalog's job is **discovery, trust, and being the single commerce path**. Brainstorm does not custody developer funds — Stripe Connect sub-accounts hold the developer's money — but Brainstorm does orchestrate the charge so users only ever see Brainstorm chrome at payment time.

> **Decision (resolves OQ-80, per [43-monetisation-strategy.md §Catalog economics](../platform/43-monetisation-strategy.md)):** an optional **"Brainstorm Commerce"** fully-managed-payments service ships later post-v2 (not at paid-marketplace launch). It is a developer-facing simplification over Stripe Connect Express, never a replacement; self-managed developers using Stripe Connect remain first-class.

### Earning from apps in practice

A developer's path (post-v2):

1. Build an app in the Code Editor (free).
2. Ship as free (v2-onward) or paid (post-v2).
3. To list a **paid** app: sign in to the developer portal (`developers.brainstorm.app`) with sovereign-key challenge, complete Stripe Connect Express onboarding (KYC handled by Stripe), set a price + currency on the listing.
4. The Brainstorm catalog routes every paid install through a single-use, 24h-bounded checkout URL. Stripe Checkout runs in shell-owned chrome on the user's device; on success the catalog issues an entitlement token to the user's wallet; the app's runtime verifies it via `commerce.verifyLicense`.
5. Brainstorm collects the platform fee (0%/15% per the threshold rules) as a Stripe application-fee at charge creation; the remainder routes to the developer's Connect sub-account; Stripe pays out on its standard schedule.
6. Refunds within 7 days are catalog-mediated single-click; beyond 7 days the developer decides via their dashboard. Tax statements (1099-K in US, EU equivalents) are processed and delivered by Stripe Tax.

This keeps Brainstorm **out of payment custody** for the developer's funds (Stripe Connect holds them) while keeping the **user experience single-path** (every charge happens in Brainstorm chrome).

## Automated review

For the **official catalog** (v2+), submitted apps go through an automated review pipeline before listing. The user mentioned this should be automatic where possible — agreed.

What's automatable:

- **Capability scan** — declared capabilities checked against actual SDK calls; mismatch flagged. Apps that ask for `network.connect:*` but never call network are suspicious.
- **Static analysis** — known-bad patterns (eval, dynamic import of untrusted URLs, prototype pollution shapes), dependency-vulnerability check (audit), bundle-size check (per perf budgets).
- **Behavioral fuzzing** — `mock-shell-dock` runs the app through random capability scenarios, monitors for crashes, IPC anomalies, suspicious sequences.
- **Sandbox-escape attempts** — known sandbox-escape payloads tested; renderer must resist.
- **AI-assisted code review** — automated review reads the source diff, checks for prompt-injection vulnerabilities, suspicious patterns, missing tests on critical paths. Surfaces concerns to a human reviewer when the score is high.

What's **not automatable** (and gates human review):

- Apps requesting **broad** capabilities (`entities.*`, `network.*`, `ai.cost:high`).
- Apps that handle E2E content via cloud AI providers (privacy implications need a human read).
- First publish from an unknown developer (a one-time vetting).
- Apps whose purpose isn't clear from the description (could be hiding intent).

> **Decision:** automated review is the default; human review is reserved for ambiguity. Most apps can ship in hours, not weeks.

> **Decision:** **the sandbox is the actual safety guarantee**, not the review process. A reviewed app that turns out to be malicious is still confined to the capabilities the user granted — the user can revoke them and uninstall in seconds.

> **Open:** how transparent is the review pipeline to developers? They should see what was checked and why a flag fired. Tracked as OQ-82.

## Threat model additions

In-product app development raises specific threats:

- **Dev-mode used as backdoor** — mitigated by sandbox parity. Dev-mode apps face the same capability prompts as installed apps.
- **Project entity as malware vector** — if a malicious actor shares a project entity, the recipient might run it. Mitigated by capability prompts at first run; same as installing any unsigned app.
- **AI-assisted code generation embedding malicious patterns** — if AI suggests unsafe code, the developer is responsible. Static-analysis tools catch obvious issues; the user is the trust root.
- **License-key piracy** — license verification is the developer's concern; Brainstorm provides a verification helper but doesn't enforce.
- **Catalog impersonation** — catalogs are subscribed by the user; we surface publisher key fingerprints. Same trust model as [14-app-store.md](14-app-store.md).

## Phasing

> **Decision:** v1 ships the Code Editor app (basic), dev mode, hot reload, build/pack/sign locally, share-link distribution. **v2** adds paid apps, the official catalog with automated review, license-key delivery, integration with payment processors.

| Capability                                    | v1   | v2  |
|-----------------------------------------------|------|-----|
| Code Editor app (CodeMirror, LSP, projects)   | basic | full (refactor, multi-file refactor, git) |
| App projects as entities                      | ✓    | ✓   |
| Dev mode (per-device, capability-prompted)    | ✓    | ✓   |
| Hot reload                                    | ✓    | ✓   |
| Mock-shell-dock testing                       | ✓    | ✓   |
| Build / pack / sign in editor                 | ✓    | ✓   |
| Share-link publishing                         | ✓    | ✓   |
| Self-hosted catalog publishing                | ✓    | ✓   |
| Official Brainstorm catalog                   | minimal listing | full discovery |
| Automated review pipeline                     | —    | ✓   |
| Paid apps (one-time, subscription)            | —    | ✓   |
| License-key SDK helper                        | —    | ✓   |
| Managed payments option                       | —    | post-v2 |
| Revenue dashboard                             | —    | v2+ |
| AI-assisted code review                        | —    | ✓   |

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-80** *[RESOLVED in [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md)]* — Managed payments option for developers who don't want to integrate Stripe Connect / Paddle themselves. Resolution: yes, but **post-v2** as "Brainstorm Commerce".
- **OQ-81** *[RESOLVED in [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md)]* — Platform fee rate. Resolution: **0% under $10k/year per developer, 15% above**; sideload always 0%.
- **OQ-82** — Review-pipeline transparency to developers (what's checked, why flags fire).
- **OQ-83** — Per-app-id key reuse: when a project becomes a published app, does the dev-mode signing key become the app's signing key? Or is publishing a key-rotation event?
- **OQ-84** — Does the Code Editor app embed an AI assistant from day one (paired with [22-ai-foundations.md](../platform/22-ai-foundations.md))? Likely yes — natural fit.

## Summary

- **Build, test, distribute apps without leaving Brainstorm.** Code Editor app + dev mode + hot reload + share-link publishing form the v1 dev loop.
- **Sandbox parity**: dev-mode apps are subject to the same capability prompts as installed apps. No privileged dev path.
- **App projects as entities** — sync across the user's devices, get versioning, search, sharing for free.
- **Hot reload** preserves Yjs-backed state across reloads; in-memory React state is lost.
- **mock-shell-dock** for integration testing (sibling concept to BP's mock-block-dock).
- **Paid apps** in v2: one-time / subscription / donation; payment custody is **off-platform** via developer-integrated processors; Brainstorm takes a platform fee on catalog-mediated purchases (rate per OQ-81).
- **Automated review** (v2 catalog): capability scan, static analysis, behavioral fuzzing, AI-assisted code review. Human review reserved for ambiguity. The **sandbox is the actual safety guarantee**, not review.
- v1 = full local dev loop; v2 = catalog, paid apps, automated review, revenue.
