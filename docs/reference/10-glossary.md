# 10 — Glossary

Canonical definitions of terms used across the Brainstorm design docs. When a term is first introduced in another doc, it should appear in **bold**; the definition lives here.

---

**App**
A self-contained package the shell can install, launch, suspend, update, and remove. Each running app lives in its own renderer process, has at least one window, and communicates with the shell only via host services. Apps cannot reference each other directly. See [03-app-model.md](../apps/03-app-model.md).

**App store surface**
The privileged dashboard view that lets users discover, install, update, and manage apps. Lives inside the shell, not as an app. See [14-app-store.md](../apps/14-app-store.md).

**App identity**
The `(id, version, [signing key])` triple that uniquely identifies an app. The id is reverse-DNS, immutable across versions; the version is semver; the signing key (v2+) authenticates updates.

**Audit log**
Per-app metadata trail of capability grants/revocations, host-service calls of significance, and anomalies. Reviewable by the user. Excludes content. See [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**Awareness**
Yjs's ephemeral collaborator state — cursors, selections, presence. Not persisted; bounded to a session. Surfaced inside editors and (lightly) in the shell. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

**Block**
A UI component identified by a block id, rendering content from an entity through a Block Protocol message channel. Sandboxed in an iframe inside the host app's window. Blocks have no capabilities of their own; they inherit none from their providing app. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**Block frame**
The sandboxed iframe that hosts a block, communicating with the host app via Block Protocol postMessage envelopes. The cross-origin boundary is the security boundary. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Block id**
Stable identifier for a block component, e.g. `io.example.text-editor/paragraph`. Mapped to its providing app in the shell's registry. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Block Protocol**
External standard ([blockprotocol.org](https://blockprotocol.org/)) for typed entities, link types, and embeddable block components communicating over a defined message channel. Brainstorm adopts it as its data interop layer. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Capability**
A named, scoped grant authorizing an app to perform a class of action (e.g. `entities.read:io.example/Note/v1`, `network.connect:wss://sync.example.com`). Granted by the user, recorded in the capability ledger, checked on every host-service call. See [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**Capability ledger**
The shell's persistent record of which apps have which capabilities. Source of truth for capability checks. Editable by the user from the settings panel.

**Core service**
An internal subsystem of the shell (not directly exposed to apps) — `storage`, `sync`, `entities`, `files`, `identity`, `intents`, `search`. Apps reach core services through the host-service IPC, gated by capabilities. See [02-architecture.md](../foundations/02-architecture.md).

**Custom Lexical node**
A Lexical node type contributed by an app for its domain (e.g. a code-block node, an entity-chip node). Serializes to a recorded type id; renders via the providing app, with a generic fallback when the providing app is not installed. See [07-editing-lexical.md](../editing/07-editing-lexical.md).

**Dashboard**
The shell-owned screen the user sees when no app is focused. Holds the wallpaper, icons, widgets. Its layout is itself a Yjs doc and syncs across devices. Not an app. See [04-shell.md](../shell/04-shell.md).

**Default minimum capabilities**
Capabilities granted to every app implicitly: own `storage.docs` keyspace, `intents.dispatch:open`, render in own windows. Everything else requires an explicit grant.

**Entity**
A typed structured record with an id, an entity type URL, a properties record, links to other entities, and provenance. The unit of shareable, sync-able data. Each entity is backed by exactly one Y.Doc. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

**Entity type**
A schema document at a URL (e.g. `io.example/Note/v1`) defining the shape of an entity's properties, allowed link types, and display hints. Owned by no single app. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Entities service**
The core service that stores entities, handles queries and subscriptions, and manages link integrity. See [02-architecture.md](../foundations/02-architecture.md), [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Fallback renderer**
A generic, type-driven view used when the app that would normally render a piece of content (entity, block, or custom Lexical node) is not installed. Derived from the entity type's display hints. Required behavior: no errors, no broken UI. See [03-app-model.md](../apps/03-app-model.md), [07-editing-lexical.md](../editing/07-editing-lexical.md).

**FileHandle**
An opaque token granting an app access to one specific file. Does not reveal filesystem paths to the renderer. Granted by user picker or intent. Revocable. See [08-app-sdk.md](../apps/08-app-sdk.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**Host service**
A capability-gated API the shell exposes to apps for storage, entities, files, sync, intents, search, identity, blocks, UI, and capability management. Reached via IPC; every call passes through the capability check. See [08-app-sdk.md](../apps/08-app-sdk.md).

**Icon (dashboard icon)**
A visual launcher placed on the dashboard, pointing at an app, an entity, or a saved view. User-positioned. See [04-shell.md](../shell/04-shell.md).

**Identity**
The local user's keypair, held by the shell. The private key never leaves the shell process. Apps can request signatures with `identity.sign`. See [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**Intent**
A structured cross-app request (e.g. `{ verb: "open", payload: { entityId } }`) routed by the shell to an app registered as a handler. The mechanism for cross-app workflows without app-to-app references. See [08-app-sdk.md](../apps/08-app-sdk.md).

**Launcher**
The keyboard-driven palette (global hotkey) that searches across apps, entities, files, and intents. A shell surface, not an app. See [04-shell.md](../shell/04-shell.md).

**Lexical**
External rich-text editor framework ([lexical.dev](https://lexical.dev/)). Used as a library by apps that need rich text. Its state is bound to a Yjs `Y.XmlFragment` via `@lexical/yjs`. See [07-editing-lexical.md](../editing/07-editing-lexical.md).

**Link**
A typed, directional edge between two entities. Identified by a link type URL with cardinality and source/destination type constraints. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Manifest**
The static metadata file inside an app package describing identity, version, SDK pin, capability requests, and registrations (openers, blocks, entity types, widgets). Data, not code. See [03-app-model.md](../apps/03-app-model.md).

**brainstorm-editor**
The internal package providing the pre-configured Lexical editor factory, the baseline node set, the read-only renderer, and the block-embedding node. Used by every app that displays or edits rich text. See [07-editing-lexical.md](../editing/07-editing-lexical.md).

**Opener**
A registration declaring an app as a handler for a MIME type or entity type. The shell routes "open this" intents to a registered opener. An entity type can have multiple openers; one is `primary`, others are alternatives. See [03-app-model.md](../apps/03-app-model.md).

**Process model**
One renderer process per app (with v1 ambiguity around per-window sub-processes). The shell main process plus the privileged dashboard renderer hold the trusted side. See [02-architecture.md](../foundations/02-architecture.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**Provider (Yjs)**
A standard Yjs concept for an object that ships updates between a Y.Doc and a remote source. In Brainstorm, the IPC bridge between an app's renderer replica and the shell's canonical Y.Doc behaves as a Provider; transport adapters (websocket, p2p) are also Providers. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

**Registration**
A static declaration in an app's manifest contributing something to the shell's registries: an opener, a block, an entity type, or a widget. Added on install, removed on uninstall. See [03-app-model.md](../apps/03-app-model.md).

**Registry (shell registry)**
The shell's index from MIME types and entity types to apps that can open them; from block ids to providing apps; from custom node type ids to providing apps; from widget ids to providing apps. Updated as apps install/uninstall. See [03-app-model.md](../apps/03-app-model.md), [04-shell.md](../shell/04-shell.md).

**Renderer process**
An Electron process that hosts a window's web context. In Brainstorm, each app gets at least one renderer, sandboxed and context-isolated. The dashboard runs in its own privileged renderer. See [02-architecture.md](../foundations/02-architecture.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md).

**SDK (App SDK)**
The contract between an app and the shell: a single `brainstorm` global injected via preload, exposing host services and lifecycle callbacks. Versioned via `manifest.sdk`. See [08-app-sdk.md](../apps/08-app-sdk.md).

**Search service**
The core service that indexes entity properties (per type display hints) and Yjs rich-text content. Read-only API to apps. See [02-architecture.md](../foundations/02-architecture.md), [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Session**
The set of running apps and window placements at a given moment. Persisted by the shell so it can offer "restore previous session" on launch.

**Shell**
The Electron main process plus the privileged dashboard renderer. Owns hosting, brokering, capability checks, persistence, sync, identity, and registries. Holds no domain knowledge. See [04-shell.md](../shell/04-shell.md).

**Snapshot + tail**
The on-disk format for a Yjs doc: a periodic compacted state plus an append-only update log since. The format is intentionally Yjs-portable for backup and migration. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

**Storage service**
The core service that persists Yjs docs and app-private key/value data. Each app has its own private keyspace; entities are shared via the entities service. See [02-architecture.md](../foundations/02-architecture.md).

**Sync transport**
A pluggable adapter that ships Yjs updates between devices: local-only, self-hosted relay, hosted relay, or P2P. Selected by the shell, not the app. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

**Tray (system tray)**
The OS-level menu-bar / system-tray entry an app can publish with the `tray.publish` capability. Subset of the app's menu. See [04-shell.md](../shell/04-shell.md).

**Type registry**
The shell's local resolver from entity-type URLs to schemas. Schemas come from app bundles and (eventually) URL-fetched sources. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md).

**Widget**
A small, mostly-read embeddable view contributed by an app, rendered on the dashboard. Paused when off-screen. UI-restricted (no modals, bounded size). See [04-shell.md](../shell/04-shell.md).

**Yjs**
External CRDT runtime ([yjs.dev](https://yjs.dev/)). The substrate for entity data, rich-text fragments, and awareness. Each entity is backed by one Y.Doc. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

---

## Terms added in 12 / 13 / 14 / 15

(Pending alphabetic interleave; kept as a section for now.)

**BlockEmbedNode**
The single Lexical node type that bridges Lexical and Block Protocol. Stores a `(blockId, entityId)` reference; renders as a sandboxed iframe loading the providing app's block UI. The cursor jumps over it as a void node. See [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md).

**Block Protocol message channel**
The postMessage envelope a block uses to talk to its host: receives `entity` updates, emits property/link mutation requests. The block's only outward channel; it has no other access to the system. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), [08-app-sdk.md](../apps/08-app-sdk.md).

**Boot sequence**
The cold-start path of the shell, from Electron process spawn through dashboard first paint. Performance-budgeted at <300ms cold / <150ms warm. See [12-shell-architecture.md](../shell/12-shell-architecture.md).

**Catalog**
A directory of apps with manifest URLs and metadata. The official Brainstorm registry is one catalog; users can subscribe to third-party catalogs. The shell's discovery surface aggregates across subscribed catalogs. See [14-app-store.md](../apps/14-app-store.md).

**Channel (update channel)**
A stream of releases for an app: `stable`, `beta`, `dev`, etc. Subscribed per-app, not per-shell. The shell installs the latest version on the subscribed channel. See [14-app-store.md](../apps/14-app-store.md).

**Composition criterion**
The decision rule for adding new content types: *does the cursor flow through it?* If yes → custom Lexical node. If no → Block Protocol embed via `BlockEmbedNode`. See [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md).

**Developer mode**
A shell mode that allows installing unsigned local-file bundles for testing. Apps installed in developer mode run in the same sandbox as any other app — no extra privileges. See [14-app-store.md](../apps/14-app-store.md).

**Dashboard renderer**
The privileged renderer process that hosts the shell's user-facing surfaces (dashboard, launcher, settings, app store, notifications). Bundled with the shell, runs with extended host-API access compared to app renderers. See [12-shell-architecture.md](../shell/12-shell-architecture.md).

**IPC broker**
The component in the shell's main process that validates, capability-checks, and routes every host-service call from app renderers. Stamps the calling app's identity at the preload boundary; the app cannot forge it. See [12-shell-architecture.md](../shell/12-shell-architecture.md).

**Main process**
The Electron main process. Coordinates the shell: holds the capability ledger, the registry, the IPC broker, and the window manager. Does no heavy I/O — that lives in worker processes. See [12-shell-architecture.md](../shell/12-shell-architecture.md).

**Manifest URL**
A public, stable URL pointing at an app's manifest JSON. The unit of sharing, indexing, and installation. The shell fetches a manifest URL, picks a channel, fetches and verifies the bundle, and offers the install confirmation. See [14-app-store.md](../apps/14-app-store.md).

**Package**
The signed `.brainstorm` archive (tar+zstd) containing an app's manifest, bundle, assets, and signatures. Content-addressable; the same id+version always has the same hash. See [14-app-store.md](../apps/14-app-store.md).

**Performance budget**
A targeted upper bound on a runtime metric (cold start, IPC round-trip, bundle size, etc.). A regression past a budget is treated as a bug. Enforced in CI for size budgets; profiled in performance tests for latency budgets. See [12-shell-architecture.md](../shell/12-shell-architecture.md), [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Publisher key**
The Ed25519 public key associated with an app's signing identity. Recorded on first install; future updates must verify against it (or against a key signed by it via key rotation). See [14-app-store.md](../apps/14-app-store.md).

**react-yjs**
The internal React-side hook package that exposes Yjs observables to React components: `useYDoc`, `useYMap`, `useYText`, `useYXmlFragment`, `useAwareness`. Read-only; mutations go through the SDK. See [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Revocation record**
A signed declaration that a publisher key is no longer trusted (typically after compromise). The shell refuses updates from revoked keys; already-installed apps continue to run with a warning. See [14-app-store.md](../apps/14-app-store.md).

**Rotation record**
A small object signed by an old publisher key declaring a new key trusted for the same app id. Lets developers rotate keys without breaking the trust chain for existing installs. See [14-app-store.md](../apps/14-app-store.md).

**Sideload**
Installing an app from a manifest URL or a local file outside any catalog. Fully supported, sandboxed identically to catalog installs. See [14-app-store.md](../apps/14-app-store.md).

**Subscribed channel**
The channel an installed app currently follows for updates (default `stable`). User-changeable per-app. See [14-app-store.md](../apps/14-app-store.md).

**Trusted-on-first-use (TOFU)**
The trust model for app signing keys: the user's first install of an app records its publisher key; future updates must verify against the same key or a successor via rotation. See [14-app-store.md](../apps/14-app-store.md).

**Worker process**
A Node-based child process spawned by the shell's main process to handle heavy I/O and CPU work: storage, sync, search indexing, the canonical Yjs runtime. Decoupled from the main process so that disk/network/CPU pressure does not block the policy/IPC path. See [12-shell-architecture.md](../shell/12-shell-architecture.md).

**`brainstorm-cli`**
A command-line tool for developer workflows: keygen, pack, sign, verify, manifest scaffolding, dev-mode load. Distributed separately from the shell; most users never need it. See [14-app-store.md](../apps/14-app-store.md).

---

## Terms added in 16 / 17

**Access record**
A signed list of `(memberPubkey, role, addedBy, addedAt, revokedAt)` tuples for an entity, stored alongside the entity's content. Defines who can decrypt updates. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Blind relay**
A sync-transport server that routes Yjs update envelopes between devices but cannot decrypt their contents. Sees only routing metadata and signatures. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Consumer account**
An optional cloud-side account adding hosted services (relay, recovery, attachment storage) to a sovereign user identity. Anchored by an email; does not hold content keys. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Data Encryption Key (DEK)**
A symmetric key (AES-GCM-256 or XChaCha20-Poly1305 — see OQ-25) per entity, used to encrypt that entity's Yjs updates and snapshots. Wrapped under each member's public key for distribution. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Device identity**
The Ed25519 keypair generated on first-run for each Brainstorm install. Used to sign Yjs updates and authenticate to relays. Stored in OS keychain. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Exporter**
An app registered as a handler for `intent.export` from a particular entity type to a particular external format (e.g. CSV, Markdown). The shell surfaces installed exporters in the Export menu. See [17-interoperability.md](../platform/17-interoperability.md).

**Format I/O**
The pattern for crossing the boundary between Brainstorm and external file formats: `intent.export` writes entities to a foreign format; `intent.import` reads a foreign format into entities. See [17-interoperability.md](../platform/17-interoperability.md).

**Importer**
Symmetric of exporter — an app registered as a handler for `intent.import` reading a particular external format into a particular entity type. See [17-interoperability.md](../platform/17-interoperability.md).

**Intent verb**
A standardized action name in the cross-app intent vocabulary: `open`, `insert`, `share`, `convert`, `export`, `import`, `process`, `compose`, `quick-look`. Curated by the shell (per OQ-30). See [17-interoperability.md](../platform/17-interoperability.md).

**Member key wrap**
The DEK encrypted under a specific member's public key. One wrap per member per DEK version. Adding a member adds a wrap; removing a member rotates the DEK and re-wraps for remaining members. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Organization**
A managed multi-user identity with members, roles, billing, and shared spaces. Has its own keypair. Members are sovereign users who accepted a signed invite. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Selection (cross-app)**
The currently selected items in the focused app, published via `selection.publish` and read by intent dispatchers via `selection.current`. The bridge between "user has selected three rows" and "now they invoke `process:summarize`". See [17-interoperability.md](../platform/17-interoperability.md).

**Server-readable space**
An organization space in which the org's server holds keys to decrypt content. Enables server-side search, audit, DLP, and compliance scans. Per-space, opt-in, surfaced to users in the UI. The trade-off against E2E is explicit. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Sovereign user identity**
A pubkey-anchored user identity that requires no account. Used by default for all users; multi-device sync works via local key pairing. The "no account ever required" floor of the product. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**Space**
An organization-scoped tenancy boundary. A space owns entities, defines default access, encryption mode (E2E or server-readable), audit retention, and sync transport. Distinct from a "workspace" — Brainstorm has no workspace concept at the shell level. See [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md).

**`@react-fancy-menus/core`** (a.k.a. **fancy-menus**)
The declarative React menu constructor used for every menu surface in Brainstorm — launcher, context menus, intent menus, tray menus, in-app menus. In-house package developed in parallel (located at `../fancy-menus`); re-exported through the SDK so apps share the engine. Provides Floating UI positioning, virtualization, drag-reorder, keyboard nav, theming, and a rich row/panel vocabulary out of the box. See [13-frontend-stack.md](../shell/13-frontend-stack.md).

---

## Terms added in 19 (properties and schemas)

**Canonical type schema**
The property schema declared by an entity type's URL (e.g. `io.example/Note/v1`). Immutable per version. Defines the properties every entity of that type has by definition. See [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Effective schema**
The merged schema for a given entity at read time: canonical type schema + all matching property overlays, composed by the entities service. What apps actually see when they ask "what are this entity's properties?". See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**PropertySchema entity**
A first-class entity (`brainstorm/PropertySchema/v1`) defining a single property — its name, value type, optional vocabulary reference, scope, required flag, display hints. Properties are entities; this is what makes them shareable, syncable, encryptable like any other data. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Property overlay**
A property defined by a PropertySchema entity, applied on top of the canonical type schema. Identified by its scope (entity / type / collection / user / org). See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Property scope**
The explicit attribute on a PropertySchema declaring where the property applies: a single entity, all entities of a type, all entities in a collection, all entities owned by a user, or all entities in an org. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Value type (base)**
The fundamental data shape of a property — one of six primitives: `text`, `number`, `boolean`, `date`, `entityRef`, `richText`. Other semantics (select, phone, email, URL, multi-select, status, file attachment) are composed from these via **modifiers**, not separate types. Files are first-class entities of type `brainstorm/File/v1`; "file properties" are entityRefs to that type. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**File entity**
A first-class entity of canonical type `brainstorm/File/v1`. Wraps a content-addressed blob (in `data/attachments/`) with metadata (`filename`, `mimeType`, `size`, `blobRef`, plus user-overlay properties like tags). Searchable, taggable, refer-to-able like any entity. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md), [18-storage-and-search.md](../data/18-storage-and-search.md).

**Modifier (property)**
Configuration that turns a base value type into a specific property. Includes `multiple`, `labels`, `vocabulary`, `format`, `pattern`, `range`, `precision`, `granularity`, `mimeTypes`, `maxSizeBytes`, `allowedTypes`, `inverse`, `computed`, `required`, `unique`, `display`. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Cardinality (`count`)**
Allowed value-count range on a property: `{ min, max }`. `min ≥ 0`, `max ≥ 1`, hard upper bound `max ≤ 50`. Universal — every base type except `richText` declares one. Replaces both `required` (= `min ≥ 1`) and a boolean `multiple` flag (= `max > 1`). When `max == 1` storage is a bare value; when `max > 1` storage is a `Y.Array` of `{value, label?}`. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Label (multi-value)**
A per-value category within a `multiple` property's value list — e.g. Home / Work / Mobile for phone numbers. Configured as a closed string set on the PropertySchema. Distinct from a vocabulary (which constrains values, not categorizes them). See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Format modifier**
A semantic format hint on a `text` or `number` property: `email`, `url`, `phone`, `currency`, `percent`, `markdown`, `code`. Affects validation and display, not storage. Replaces having separate value types per format. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Inverse property**
A computed property view of an entityRef link from the destination side. Declared on the primary entityRef property's `inverse` modifier. Both sides are writable through to the same underlying link. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Derived property** (a.k.a. computed property, formula)
A property whose value is computed from other properties via a sandboxed expression language. Cached, dependency-tracked, recomputed on input change. v2 only. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Display options**
Per-PropertySchema rendering preferences: `view` kind (gallery / list / viewer / chip / card / pill / progress / etc., per base type) and view-specific `options`. Apps respect these as the default; they may override per-collection-view. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

---

## Terms added in 20 / 21

**Active set**
The subset of entities a device currently keeps locally synced based on the sync policy (pinned / recently-accessed / reachable from those). Entities outside the active set are on-demand. See [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).

**Pinned entity**
An entity the user has explicitly marked to be kept always synced and offline-available on a device, regardless of access patterns. See [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).

**Selective sync**
The mechanism that scales sync to large data sets and constrained devices: only entities in the active set are synced; the rest are fetched on demand. Each device has its own sync policy. See [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).

**Sync policy**
Per-device configuration for selective sync: priorities (pinned, active-window, reachable-depth), storage caps. Defaults differ per device class (desktop = everything; phone = pinned + recent). See [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md).

**Tail (Yjs)**
The append-only update log of a Y.Doc since its last snapshot. Compacted into a fresh snapshot when it grows past a threshold. See [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md), [18-storage-and-search.md](../data/18-storage-and-search.md).

**Translation context**
Mandatory metadata on a translatable string: `description` (what it means, where it appears, tonal guidance), optional `placeholderExamples`, optional screenshots. Missing description is a build error. See [21-localization.md](../platform/21-localization.md).

**`labelKey` vs `label`**
The convention distinguishing app-shipped translatable strings (`labelKey`, references the app's translation catalog) from user-created literal strings (`label`, taken verbatim). Mirrored across `name` / `nameKey`, `description` / `descriptionKey`, etc. See [21-localization.md](../platform/21-localization.md).

**Locale fallback chain**
The resolution order for a locale request: `<requested>` → `<base of requested>` → `en-US` → `en`. Shell and apps each resolve independently against this chain. See [21-localization.md](../platform/21-localization.md).

**Stale translation flag**
A translation marked stale when its source string changed (detected by content-hash). The translation is still shown but flagged for re-review. See [21-localization.md](../platform/21-localization.md).

---

## Terms added in 22 / 23

**AI broker**
The shell core service that mediates every AI call: capability checks, provider routing, key management, streaming, prompt-injection filtering, audit, cost tracking. Apps invoke standardized AI verbs; the broker dispatches. See [22-ai-foundations.md](../platform/22-ai-foundations.md).

**Provider abstraction**
The AI-broker mechanism that lets apps invoke generation/embedding/etc. without picking a specific LLM provider. The shell ships bundled providers (Anthropic, OpenAI, local); user picks defaults; apps can request specific ones with user approval. See [22-ai-foundations.md](../platform/22-ai-foundations.md).

**AI provenance**
Optional metadata block on entities and properties recording AI's role in their creation: `kind` (generated / extracted / transformed / suggested / partial), `via` (model id), `atUtc`, `confidence`, `userAccepted`. Surfaces UI markers and lets users filter their data by authorship. See [22-ai-foundations.md](../platform/22-ai-foundations.md).

**Print theme**
A special theme variant the shell forces during print-view rendering, regardless of the user's normal theme: light background, high-contrast text, no decorative colors. Tokens resolve to print-appropriate values automatically. See [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md), [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Print view**
The read-only, paginated, printer-aware rendering of an entity. Lives behind a `brainstorm://print/<app-id>/<entity-id>` URL provided by the entity's owning app; rendered in an off-screen renderer process; wrapped in the shell's `<PrintView>` frame. Drives both `intent.print` and `intent.export:application/pdf`. See [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md).

**Theme**
A composite visual-identity bundle: token set + icon pack + typography. Each piece is its own entity (`brainstorm/TokenSet/v1`, `brainstorm/IconPack/v1`, `brainstorm/Typography/v1`); a `brainstorm/Theme/v1` entity references all three. Active theme is a Yjs doc that syncs across the user's devices; switching is runtime, no reload. Personal-by-default; promotable to org. Themes and their components are distributed through the same store as apps — same `.brainstorm` package format (`manifest.kind: "theme"`), same Ed25519 signing, same install / update / remove lifecycle. See [13-frontend-stack.md](../shell/13-frontend-stack.md), [40-theme-store.md](../apps/40-theme-store.md).

**Theme store**
The distribution mechanism for themes and their components (token sets, icon packs, typography). Reuses the app-store infrastructure end-to-end: manifest-URL install protocol, official and third-party catalogs, Ed25519 signing + TOFU, threat-intel feed, update channels. Themes are passive data (no executable code); validation is static lint (token namespace compliance, SVG sanitizer, WCAG-AA contrast lint, focus-ring presence). Authorship is keyed on the publisher Ed25519 key; ratings are catalog-supplied with explicit attribution; live preview lets the user try a theme before committing. Paid themes deferred to v2, same posture as paid apps. See [40-theme-store.md](../apps/40-theme-store.md).

---

## Terms added in 24 / 25

**Personal-by-default principle**
In any collaborative or multi-device context, customizations (views, layouts, shortcut bindings, settings, themes, property definitions) default to user-scoped (personal across devices) and require explicit opt-in to elevate to shared (collection, org). Vision-level principle (`01-vision.md` Principle 9). Implemented uniformly via the scope mechanism on PropertySchema, Vocabulary, ShortcutBindings, Settings, Theme entities. See [01-vision.md](../foundations/01-vision.md).

**Shortcut binding entity**
A `brainstorm/ShortcutBindings/v1` entity, scope `user` by default, recording the user's overrides as `(target-id, chord)` pairs. Layers under shell + app defaults to produce the resolved binding map. Created lazily; syncs across the user's devices. See [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).

**Mod (shortcut modifier)**
The platform-appropriate modifier in shortcut chord declarations: `⌘` on macOS, `Ctrl` elsewhere. Apps declare `Mod+S`; the shell resolves and displays per-platform. See [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).

**Cheatsheet**
The `⌘ Shift K` (default) command-palette surface listing every active shortcut for the current context. Implemented as a fancy-menus body. Always-on; apps cannot disable or replace it. See [24-keyboard-shortcuts.md](../shell/24-keyboard-shortcuts.md).

**Settings schema**
A `brainstorm/SettingsSchema/v1` definition for one setting (owner, section, key, value type and modifiers, default, label, description). Reuses the property-system value types and modifiers from [19-properties-and-schemas.md](../data/19-properties-and-schemas.md). Auto-renders into the unified settings window. See [25-settings.md](../shell/25-settings.md).

**Settings overlay**
A user (or org) entity holding only the *deltas from default*: `{ "<section>/<key>": value, ... }`. Reset-to-default removes the key. Storage stays small; new app defaults propagate to non-customized users. See [25-settings.md](../shell/25-settings.md).

**Locked setting (v2)**
An org-overlay setting where the org disallows user override. Compliance / brand-control scenario. The user-overlay value is ignored; the UI shows the lock visibly. See [25-settings.md](../shell/25-settings.md).

**Per-device setting**
A setting whose scope is structurally tied to a single device (sync transport endpoint, selective-sync policy, local-model location). Stored in a local-only entity that does not sync. Distinct from per-user settings, which sync. See [25-settings.md](../shell/25-settings.md).

---

## Terms added in 26

**App project**
A `brainstorm/AppProject/v1` entity holding the source files, manifest, and assets of an in-development app. Syncs across the user's devices like any entity. The Code Editor app reads/writes via standard `entities.*` calls. Built/packed produces a `.brainstorm` archive ready to install or publish. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

**Code Editor app**
A first-party app that ships with the shell (or installs on first need). CodeMirror 6-based, TypeScript-aware (LSP in worker), Block Protocol-aware. Edits app projects, runs tests, builds/packs/signs/publishes. Uses the SDK like any app — no special privileges. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

**Dev mode**
A per-device shell capability that enables loading apps from app projects (rather than from packaged archives), with hot reload and capability-stub support for tests. Dev-mode apps face the same capability prompts as installed apps; sandbox parity is the safety guarantee. Opt-in per device. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

**Hot reload (dev mode)**
On file save in the Code Editor app, the shell rebuilds the bundle (Vite incremental) and reloads the running app's renderer. Yjs-backed state survives; in-memory React state is lost (same as a refresh). Full-renderer reload, not React Fast Refresh. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

**`mock-shell-dock`**
A testing environment that simulates the shell's SDK surface for integration tests of an in-development app. Sibling concept to Block Protocol's `mock-block-dock`. Provides preset capability prompt answers, fake sync, deterministic persistence. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

**Share link**
A manifest URL pointing at a personal hosting endpoint (the user's own server, attachment-storage URL, or a quick-share endpoint), used to distribute an in-development or self-published app outside the official catalog. The lightest-weight publish path. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

**Automated review**
The catalog-side review pipeline (v2) for apps submitted to the official catalog: capability scan, static analysis, behavioral fuzzing in mock-shell-dock, sandbox-escape probes, AI-assisted code review. Human review is reserved for ambiguity (broad-capability apps, unknown-developer first publishes, ambiguous purpose). The sandbox remains the actual safety guarantee. See [26-shell-as-framework.md](../apps/26-shell-as-framework.md).

---

## Terms added in 27 (Layouts)

**Layout**
A first-class entity (`brainstorm/Layout/v1`) defining how an entity is *presented* (vs. *what it has*, which is schema). A layout is a tree of cells (property / block / group / text / divider) with a mode (`stacked` / `grid` / `freeform`) and a context (`full` / `card` / `row` / `chip` / `preview` / `whiteboard` / `print`). Personal-by-default, scope-layered like PropertySchema. See [27-layouts.md](../shell/27-layouts.md).

**Layout cell**
A node in a layout tree. Six kinds: `property` (renders a property value), `block` (mounts a Block Protocol embed), `chrome` (renders a shell-provided structural element: action bar, breadcrumb, meta, etc.), `group` (logical container of child cells), `text` (literal text/heading), `divider`. Each has positioning hints per the parent layout's mode. See [27-layouts.md](../shell/27-layouts.md).

**Chrome cell**
A layout cell of kind `chrome` that renders a shell-provided structural element by name (`actionBar`, `breadcrumb`, `meta`, `windowControls`, `entityHeader`, `tabs`). The shell renders **no fixed chrome** outside layouts — every structural element around an entity is a chrome cell that the layout positions and parameterises. This is the architectural answer to the hardcoded cover / title / icon / floating-controls problem common in prior block editors. See [27-layouts.md](../shell/27-layouts.md).

**Layout context**
The visual surface in which an entity is being rendered: `full` (dedicated window), `card` (board / gallery), `row` (table), `chip` (inline mention), `preview` (hover-card), `whiteboard` (freeform canvas), `print` (print-view). The same entity can have separate layouts for separate contexts. See [27-layouts.md](../shell/27-layouts.md).

**Layout mode**
The positioning model of a layout: `stacked` (vertical flow, default, accessibility-friendly), `grid` (declared columns/rows), `freeform` (user-positioned coordinates on an infinite canvas, whiteboard-style). See [27-layouts.md](../shell/27-layouts.md).

**Reading order (layout)**
A linear list of cell ids declared on a Layout entity that screen readers and keyboard navigation use to traverse the layout. Auto-derived for `stacked`, optional for `grid`, **mandatory** for `freeform`. See [27-layouts.md](../shell/27-layouts.md).

**Layout editor**
An app that produces and modifies Layout entities. The shell ships at least a form-designer (v1, for stacked/grid) and a whiteboard-designer (v2, for freeform). Layout editors are just apps; the shell does not own the editing experience. See [27-layouts.md](../shell/27-layouts.md).

---

## Terms added in 28 (Vault and onboarding)

**Vault**
A self-contained directory holding one user's data: identity keys, entity database, Yjs documents, attachments, installed apps, settings, audit log. Portable — tar/zip = backup; copy = move between machines. One vault is open per shell window. Borrows the term from conventional local-first knowledge tools. See [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).

**Vault registry**
A small file outside any vault, in OS-standard app-config locations, that tracks known vaults' paths and display metadata (name, color, icon, last-opened, format version). Doesn't contain content; recreatable from a scan if lost. The only Brainstorm state that lives outside a vault. See [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).

**Vault format version**
A `<major>.<minor>` value in the vault's `vault.json` that determines openability. Forward-only migrations: a newer shell can open and migrate an older vault; an older shell refuses a newer vault. See [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).

**First-launch flow**
The onboarding sequence the shell runs when the vault registry is empty: Welcome → Create / Open / Pair / Import → vault initialization → land on populated dashboard. See [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md).

---

## Terms added in 30 (File manager and Folders)

**Folder**
A canonical entity type (`brainstorm/Folder/v1`) holding a list of member entities, an optional saved query, and standard metadata. The unit of hierarchical organization. Membership is recorded *on the folder*, not on the child — an entity can be in zero, one, or many folders. See [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).

**File-manager app**
A first-party app that surfaces hierarchical organization: tree / grid / list views, drag-and-drop, multi-select, breadcrumb navigation, smart-folder authoring. Registers as primary opener for `Folder/v1`. Just an app — does not own the Folder entity type, the breadcrumb chrome, or hierarchy at the shell level. See [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).

**Smart folder**
A Folder with a `query` property that auto-resolves additional members from an entities query. Explicit `members` and the query coexist (manual + auto). Reuses the entities query API; not a separate query language. See [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).

**Reverse index (entityRef-property containment)**
The SQL index in `entities.db` (per [18-storage-and-search.md](../data/18-storage-and-search.md)) that lets "which folders contain this entity?" be O(1). Folders' `members` produce link rows like any entityRef property; no special-case code. See [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).

**Vault root folder**
The Folder entity at the top of a vault's hierarchy, pinned by `vault.json`'s `rootFolderId`. The file manager opens here by default. Just a Folder at the data layer; the shell's reference is the only "specialness." See [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md), [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).

**Navigation state (breadcrumb context)**
Per-window state recording the path the user took to arrive at the currently-focused entity (e.g. A → B → X). Read by the `chrome.breadcrumb` cell to render breadcrumbs. Falls back to reverse-membership walk when no nav context exists. See [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md).

---

## Terms added in 29 (Credentials storage)

**Credential store**
The host service that holds sensitive credentials (identity private key, vault master key, AI provider keys, sync tokens, app-private secrets) on platform-appropriate backends. Two tiers: real OS keystore items for primary keys, encrypted SQLite blobs for everything else. Apps invoke `brainstorm.services.credentials.*`; the shell mediates so platform abstraction lives in one place. See [29-credentials-storage.md](../security/29-credentials-storage.md).

**Tier 1 / Tier 2 (credential storage)**
Tier 1 = real OS keystore items (`@napi-rs/keyring` → Keychain Services / DPAPI / Secret Service) for the identity private key and vault master key. Tier 2 = SQLite blobs in `credentials.db`, encrypted under the master key, for everything else (AI provider keys, sync tokens, app-private secrets). Tier 2 keeps the keystore uncluttered while Tier 1 protects the root of trust. See [29-credentials-storage.md](../security/29-credentials-storage.md).

**Vault master key**
The 32-byte symmetric key generated at vault creation and stored as a Tier 1 OS keystore item. Encrypts `credentials.db` and the vault's at-rest databases. Loaded into memory on vault open; cleared on vault close. See [29-credentials-storage.md](../security/29-credentials-storage.md).

**Passphrase fallback**
Credential-store mode used when no OS keystore is available (some Linux configurations, headless). Argon2id-derived key wraps the vault master key; the wrapped form is stored in the vault directory itself (readable before the master key is available). See [29-credentials-storage.md](../security/29-credentials-storage.md).

---

## Terms added in 31 (Linking protocol)

**`brainstorm://` URI scheme**
The unified, extensible scheme for addressing internal targets: entities, blocks within entities, properties, sub-entity anchors, spaces, vaults, chat messages, saved queries, intents. Curated authorities; resolver-mediated; capability- and encryption-aware. External `https://` URLs pass through. See [31-linking-protocol.md](../platform/31-linking-protocol.md).

**Link resolver**
The shell's single point for following any `brainstorm://` URI. Parses authority + path, looks up handler, capability- and access-checks, dispatches `intent.open` (or returns failure with no metadata leak). Apps call `brainstorm.services.links.resolve(uri)`; they don't parse URIs themselves. See [31-linking-protocol.md](../platform/31-linking-protocol.md).

**Anchor token**
A base64url-encoded Yjs `RelativePosition` identifying a position inside a property's rich-text fragment. CRDT-aware: survives concurrent edits that don't affect the anchor itself. Apps use the SDK's `links.createAnchor` / `links.resolveAnchor` rather than touching Yjs internals. See [31-linking-protocol.md](../platform/31-linking-protocol.md).

**LinkAnnotation entity**
A `brainstorm/LinkAnnotation/v1` entity wrapping a URI plus user-added properties (tags, custom title, comment). Used when a link needs annotation; plain in-prose links are just Lexical nodes (no entity). Personal-by-default, scope-promotable. See [31-linking-protocol.md](../platform/31-linking-protocol.md).

---

## Terms added in 33 (Windows and system menus)

**System menu (Electron application menu)**
The OS-native menu — global menu bar on macOS, per-window menu on Windows / Linux. Composed by the shell from shell-owned items, currently-focused-app items (declared in app manifest's `menus`), and OS-standard items (`role`-based via Electron). Menu items + keyboard shortcuts share the same registry. See [33-windows-and-menus.md](../shell/33-windows-and-menus.md).

**Window index**
The shell main process's authoritative list of all open windows across all apps: `(appId, windowId, title, bounds, state, focused, lastFocusedAt, thumbnail?, group?)`. Exposed only to the dashboard renderer via a privileged service; apps cannot enumerate other apps' windows. Drives the window-list widget, window switcher overlay, and Window-menu list. See [33-windows-and-menus.md](../shell/33-windows-and-menus.md).

**Window switcher overlay**
A global hotkey (default `Mod+\``) opens a fancy-menus surface showing all windows from the window index with thumbnails (when available) and titles. Mouse or keyboard navigation; release to switch. Implementation is shell-internal, uses fancy-menus like every other menu surface. See [33-windows-and-menus.md](../shell/33-windows-and-menus.md).

**Tab group**
Multiple windows from the same app rendered in a single OS window with a tab strip. macOS uses native tabs via `tabbingIdentifier`; Windows / Linux use a `chrome.tabs` cell rendered by the layout system. Intra-app only in v1; cross-app deferred to v2 (OQ-136). See [33-windows-and-menus.md](../shell/33-windows-and-menus.md).

---

## Terms added in 34 (App-side workers)

**Worker SDK shim**
A library (`@brainstorm/sdk/worker` worker-side, `@brainstorm/sdk/worker-host` main-thread relay) that gives Web Worker code transparent access to `brainstorm.services.*` via postMessage relay. Mirrors the SDK surface so apps can call entities, intents, AI, search, etc. from inside a worker without rolling their own postMessage protocol. Ships as part of the shared platform libraries. See [34-app-workers.md](../shell/34-app-workers.md).

**Worker pool**
A convenience helper (`@brainstorm/sdk/worker-pool`) for apps that spawn many short-lived workers. Keeps a set of N workers warm; tasks dispatch to the next free one. Amortizes the 5-15ms cold-spawn cost. See [34-app-workers.md](../shell/34-app-workers.md).

**Capability inheritance (workers)**
Web Workers and SharedWorker inherit their parent renderer's capabilities exactly — no new surface, no separate prompts. Workers count toward the parent's resource budgets (memory, CPU, IPC quota). The user's grant of `entities.read:*` to an app covers all of that app's worker code automatically. See [34-app-workers.md](../shell/34-app-workers.md).

---

## Terms added in 35 (Code conventions)

**Conventional Commits**
The commit-message format Brainstorm adopts: `<type>(<scope>): <summary>` with body and optional footer. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`, `build`, `ci`. Required for trunk; freer-form on feature branches. See [35-code-conventions.md](../foundations/35-code-conventions.md).

**Coverage floor**
The minimum test-coverage threshold per package class: 85% shell core, 80% SDK packages, 70% first-party apps. Floors, not ceilings — PRs dropping below are rejected. Third-party-app track is not enforced. See [35-code-conventions.md](../foundations/35-code-conventions.md).

**Feature folder**
Per-package source layout convention — co-locate code that changes together (`src/window-manager/`, `src/entities/`) over type-of-thing folders (`src/components/`, `src/hooks/`). See [35-code-conventions.md](../foundations/35-code-conventions.md).

**Token set**
A concrete value mapping for the `brainstorm-tokens` design-token namespace (colors, spacing, typography scale, motion, radii, shadows, z-layers). `light`, `dark`, `system`, and `print` ship with the shell. Custom token sets are `brainstorm/TokenSet/v1` entities. See [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Icon pack**
A `brainstorm/IconPack/v1` entity that maps **semantic icon names** (e.g. `save`, `settings`, `entity.note`) to actual SVG content. Apps reference icons by name via `<Icon name="save" />`; the active pack resolves them. The shell maintains a canonical icon-name registry; apps can register app-scoped names too. See [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Canonical icon-name registry**
The shell-curated, versioned namespace of icon names that any icon pack should define (`save`, `entity.<type>`, etc.). Adding canonical names is a shell-release decision; app-scoped names are unrestricted. See [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Typography (theme component)**
A `brainstorm/Typography/v1` entity declaring font stacks for `ui`, `body`, `code`, `display` slots, plus a typographic scale variant. Brainstorm does not bundle proprietary fonts in v1; custom typography references system or user-installed fonts. See [13-frontend-stack.md](../shell/13-frontend-stack.md).

**Vocabulary**
A first-class entity (`brainstorm/Vocabulary/v1`) listing the allowed values for `select` / `multiSelect` properties. Inline by default (one vocab per property); promotable to shared (multiple properties pointing at the same vocab). See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Inline vocabulary**
A vocabulary auto-created and owned by a single PropertySchema. Promoting it makes it a shared vocabulary referenced by multiple properties. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Shared vocabulary**
A standalone Vocabulary entity referenced by multiple PropertySchemas. Editing its values affects every referencing property. See [19-properties-and-schemas.md](../data/19-properties-and-schemas.md).

**Y.Doc / Y.Map / Y.Array / Y.Text / Y.XmlFragment**
Yjs core types. In Brainstorm: each entity is a Y.Doc; properties live in a `Y.Map`; rich text uses `Y.XmlFragment` (Lexical's binding); tags-style lists use `Y.Array`; plain collaborative text uses `Y.Text`. See [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).
