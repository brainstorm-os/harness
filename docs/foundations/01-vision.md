# 01 — Vision and principles

## What Brainstorm is

Brainstorm is a **personal knowledge-management product shaped like an operating system**. The user's screen shows a wallpaper, icons, and optional widgets. Each icon launches an **app** — a text editor, a structured database, a file browser, a PDF editor, a graph viewer, a code editor, a browser, a calendar, whatever the user installs. Each app runs in its own window and owns its own logic, UI, and (mostly) its own data.

The shell does not know what an app does. It knows only how to host one: how to launch it, give it a window, broker its access to shared services, persist its state, sync it across devices, route data into and out of it, and remove it cleanly when the user uninstalls it.

## What Brainstorm is *not*

- **Not a single monolithic editor.** Brainstorm is not a "block editor with plug-ins." There is no single document model that every app extends.
- **Not a workspace product with hardcoded surfaces.** There is no built-in concept of "page", "task", or "project" at the shell level. Those are app-level concerns.
- **Not a thin shell over a web app.** The shell is a real host with a real contract; apps are real units, not React components mounted in a tab strip.

## Lessons that shape Brainstorm

The author previously worked on a similar local-first knowledge product. The defining problem there was **interconnection**: data model, sync, UI, schema, and product surface co-evolved as one system, so any change rippled. New features required edits to many layers at once; the surface area kept expanding because every concept had to be a first-class shell concept to be usable.

Brainstorm starts from the opposite premise: **the shell holds nothing about meaning, only about hosting**. Concepts live inside apps. Apps share information by speaking a common interop language (Block Protocol), not by sharing internals.

> **Decision:** the shell has no domain schema. There is no `Page`, `Task`, or `Note` known to the shell. Those are entity types defined by apps and shared via Block Protocol.

## Principles

### 1. Apps are the unit of change

Adding, removing, and updating an app must not require touching the shell or any other app. If a user uninstalls the PDF editor, the rest of the system is unaffected — including documents that previously embedded PDFs (they degrade to a default block view, not an error).

### 2. Coupling is via contracts, not code

Apps do not import each other. They interoperate through three channels:

- **Block Protocol** for typed data and embeddable UI.
- **Host services** (storage, sync, files, identity, intents) provided by the shell on a stable, versioned API.
- **Capabilities** explicitly granted by the user.

Direct app-to-app calls are not part of the model. Cross-app workflows are mediated by the shell.

### 3. Local-first by default

Every document is a Yjs doc. Offline edits are first-class. Sync is an addition, not a precondition. The shell ships with a local persistence layer; remote sync is a service plugged into the same Yjs primitive.

### 4. The schema is owned by data, not apps

Block Protocol entity types are referenced by URL. Multiple apps can read and write entities of the same type without one app being the "owner". An app can introduce a new entity type, but cannot claim exclusivity on existing ones.

### 5. Composition over configuration

If two apps both render Block Protocol entities, the shell can put them side by side without either app knowing. Embedding a block from app A inside a document edited by app B is a property of the protocol, not a feature implemented per-app.

### 6. Boring where possible

Use established primitives — Electron for the host shell, standard Block Protocol entity URLs, Yjs as the CRDT, Lexical for rich text. The novelty in Brainstorm is the **integration shape**, not new technology underneath.

### 7. The user is the trust boundary

Apps are not assumed safe. Sandboxing and capability grants are not "later" work; they are part of the app model from day one. See [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

### 8. AI is foundational, not optional

A knowledge-management product without integrated AI is not viable on today's market. AI is therefore a first-class concern in Brainstorm's architecture from day one — the shell brokers all AI calls, provenance is universal across entities, the encryption boundary is designed knowing AI will need plaintext, and a local model ships with the shell. This is **not** "AI-first UX" (the product still works as a deterministic knowledge tool). It is "AI-foundational architecture" — the system is engineered so AI features can be added without rebuilding security, sync, or storage. See [22-ai-foundations.md](../platform/22-ai-foundations.md).

### 9. Personal by default

In any collaborative or multi-device context, what a user creates or customizes is **theirs by default**. Database views, dashboard layouts, shortcut bindings, settings overrides, saved filters, custom property definitions, theme picks — all default to a personal, user-scoped existence that syncs across the user's devices but is not visible to anyone else.

Sharing is **explicit opt-in**. The user takes a deliberate action ("Share with team", "Make available org-wide") to elevate something from personal to shared. This is the Linear pattern, and a deliberate response to the failure mode common in cloud-workspace and shared-workspace tools where one user's idiosyncratic customizations pollute the shared workspace and become impossible to clean up.

The mechanism that implements this principle is the **scope** model: every customization is an entity with an explicit scope (`entity` / `type` / `collection` / `user` / `org`). The default scope when a user creates something is `user`. The product surfaces the scope distinction with a clear "Just for me" / "Share with team" affordance whenever the user is in an org context.

See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) for the canonical scope mechanism (applied to property definitions and vocabularies); [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md) and [25-settings.md](../shell/25-settings.md) for the same pattern applied to bindings and settings; [13-frontend-stack.md](../shell/13-frontend-stack.md) for theme entities.

## North star (long-horizon)

Beyond v1, Brainstorm aims to be the **operating system for an AI-native company**: humans and their AI agents sharing one knowledge base, one identity system, and one capability ledger, so agents do real work with scoped, audited, revocable permissions on data the company actually owns. This is not a pivot — knowledge management and project management become *what the agents operate on*. It is also not v1 scope: the agent-orchestration surface it needs is gated to its natural stage (post-AI-broker), and naming it here is meant to sharpen the *why* of the foundation work, not pull engineering forward. The full thesis, the segment we win, the local↔cloud routing constraint, and the explicit "this reorders nothing" boundary are in [67-ai-native-company.md](67-ai-native-company.md).

## Non-goals (initial)

- A marketplace, billing, or developer accounts **in v1**. Apps install from local packages or URLs; distribution comes later. (The full commercial design — consumer subscriptions, org subscriptions, catalog fee, payments architecture — lands as **v2 Stage 14** per [43-monetisation-strategy.md](../platform/43-monetisation-strategy.md) / [44-pricing.md](../platform/44-pricing.md) / [45-payments-architecture.md](../platform/45-payments-architecture.md). The free local product remains free forever; commerce never gates the v1 experience.)
- Mobile parity. The first target is desktop (macOS/Windows/Linux via Electron).
- ~~An AI-first interface.~~ **AI is foundational** (see Principle 8 and [22-ai-foundations.md](../platform/22-ai-foundations.md)) — the shell brokers AI from day one. What's deferred is *the chat / agent app*, not the architecture.
- Multi-tenant / org features. Brainstorm is a single-user product first; multi-device sync is the only collaboration surface in v1.

> **Open:** is real-time multi-user collaboration in v1, or single-user multi-device only? Yjs supports both, but threat model and account system differ. Tracked in [11-open-questions.md](../reference/11-open-questions.md). *[RESOLVED 2026-06-29 — single-user multi-device only shipped (E2E sync over a blind relay); multi-user sharing is v2.]*
