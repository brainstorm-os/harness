# 08 — App SDK

This doc defines the contract between an app and the shell. It is the *concept-level* API surface — function names and shapes for clarity, not a frozen spec. Lifecycle and packaging are in [03-app-model.md](03-app-model.md); this doc covers what an app calls and what the shell calls back.

## The SDK in one paragraph

An app boots, identifies itself to the shell, receives its capabilities and launch context, registers handlers for shell events, and from then on calls **host services** to read and write entities, attach editors to rich-text fragments, request capabilities, open files, post intents, and render UI. The shell speaks back through a small set of **app callbacks** (lifecycle, intent dispatch, capability changes).

## Boot handshake

When the shell launches an app's `entry`, the app receives a global `brainstorm` object exposed by the renderer preload. Schematically:

```ts
const brainstorm: AppRuntime = {
  app: {
    id: "io.example.text-editor",
    version: "1.4.2",
    sdkVersion: "1",
  },
  capabilities: ["storage.docs", "entities.read:io.example/Note/v1", …],
  launch: {
    reason: "open-entity" | "open-file" | "fresh" | "session-restore",
    entityId?: string,
    file?: FileHandle,
    deepLink?: string,
  },
  services: {
    entities, storage, files, sync, intents, search, identity, blocks, ui, capabilities
  },
  on(event, handler) // register lifecycle/event callbacks
};
```

> **Decision:** the SDK is exposed via a single global stamped at preload time. Apps do not load the SDK from npm; the shell injects it. This makes the SDK version a property of the *shell*, not the app — consistent with `manifest.sdk`.

> **Open:** do we also publish a typed npm package (`@brainstorm/sdk-types`) with type declarations only, no runtime? Likely yes, for DX. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Lifecycle callbacks

```ts
brainstorm.on("ready", () => { /* shell finished handshake */ });
brainstorm.on("suspend", () => { /* renderer about to be paused */ });
brainstorm.on("resume", () => { /* renderer resumed after pause */ });
brainstorm.on("intent", (intent) => { /* shell is dispatching an intent */ });
brainstorm.on("capability-changed", (caps) => { /* user revoked or granted */ });
brainstorm.on("close", () => { /* user closed the last window; renderer may be terminated */ });
```

Apps must handle `intent` to participate in cross-app flows. They may ignore others.

## Host services

Each service is exposed under `brainstorm.services.<name>`. Calls are async and may reject with a `CapabilityDenied` error.

### `entities`

```ts
entities.get(id): Promise<Entity>
entities.subscribe(query, onUpdate): Subscription
entities.create(type, properties, links?): Promise<Entity>
entities.update(id, patch): Promise<Entity>
entities.delete(id): Promise<void>
entities.query(query): Promise<Entity[]>
entities.getYFragment(entityId, propertyPath): Promise<Y.XmlFragment>   // for editors
entities.getYText(entityId, propertyPath): Promise<Y.Text>
```

All `entities.*` calls are scoped by the app's `entities.read:*` / `entities.write:*` capabilities, per entity type. A query that touches a type the app cannot read silently filters out matching entities (it does **not** error — surfacing existence is itself information).

### `storage`

```ts
storage.put(key, value): Promise<void>      // app-private key/value
storage.get(key): Promise<Value | null>
storage.list(prefix?): Promise<string[]>
storage.delete(key): Promise<void>
```

App-private. Each app gets its own keyspace; collisions across apps are impossible. For shared structured data, use `entities`.

### `files`

```ts
files.requestOpen(opts): Promise<FileHandle | null>     // shows native picker
files.requestSave(opts): Promise<FileHandle | null>
files.read(handle): Promise<ArrayBuffer | ReadableStream>
files.write(handle, data): Promise<void>
files.watch(handle, onChange): Subscription
files.handleFromIntent(intent): FileHandle              // when launched as opener
```

`FileHandle`s are opaque tokens scoped to the app. They do not leak filesystem paths to the renderer. Granted via user picker or intent dispatch — never granted ambiently.

### `sync`

Apps almost never call sync directly; entity collaboration is automatic. The exposed surface is small:

```ts
sync.status(entityId): Promise<SyncStatus>     // e.g. "local-only", "syncing", "stale"
sync.subscribeStatus(entityId, onChange): Subscription
```

Configuration of transports is **shell-only** (not in the SDK).

### `intents`

```ts
intents.dispatch(intent): Promise<IntentResult | null>
intents.register(handler): void                // declared in manifest, attached at runtime
```

An **intent** is a structured cross-app request: `{ verb: "open" | "share" | "insert" | …, payload, source }`. The shell routes intents to apps based on registrations. Apps participating in an intent see it arrive via `brainstorm.on("intent", ...)`.

Examples:
- Notes app dispatches `{ verb: "open", payload: { entityId } }` → shell routes to the registered opener.
- Database app dispatches `{ verb: "insert", payload: { blockId, entityId } }` → focused editor handles.
- File browser dispatches `{ verb: "open", payload: { fileHandle } }` → registered MIME handler.

Intents are how apps trigger cross-app workflows without holding references to each other.

### `search`

```ts
search.query(q, opts?): Promise<SearchResult[]>
search.subscribe(q, onUpdate): Subscription
```

Read-only; apps cannot write directly into the search index. The index is populated from entities and Yjs content automatically.

### `identity`

```ts
identity.user(): { id: string, name?: string, avatar?: string }
identity.signPayload(payload): Promise<Signature>     // requires capability
```

Local user. Signing is gated behind `identity.sign` capability and used by helpers (e.g. an app sharing an entity to another device).

### `blocks`

```ts
blocks.register(blockId, component): void           // in manifest; runtime is for hot-reload dev
blocks.embed(targetEl, blockId, entityId): BlockHandle
blocks.list(): BlockMeta[]                          // discoverable blocks
```

`embed` is the host-mediated way to mount another app's block inside your UI. Returns a handle for unmount.

### `ui`

```ts
ui.openWindow(spec): Promise<WindowId>              // open another window owned by this app
ui.closeWindow(id): Promise<void>
ui.notify(notification): Promise<void>
ui.setSettingsPanel(component): void                // contributes to shell settings
ui.tray(spec): TrayHandle | null                    // requires capability
ui.menu(config): MenuHandle                          // build a menu via @react-fancy-menus/core (re-exported)
```

The `ui.menu` helper is a thin wrapper around `@react-fancy-menus/core` (see [13-frontend-stack.md](../shell/13-frontend-stack.md)). Apps build menus by passing the same declarative config schema the shell uses; the SDK re-export means every app's menus inherit the shell's theming, accessibility, and keyboard behavior.

### `capabilities`

```ts
capabilities.list(): string[]                              // current grants
capabilities.request(cap, reason): Promise<boolean>        // shows user prompt
capabilities.subscribe(onChange): Subscription
```

## Block component contract

Blocks an app contributes implement a small interface:

```ts
type BlockComponent = (props: {
  entity: Entity,
  readOnly: boolean,
  service: BlockProtocolMessageChannel
}) => ReactElement;
```

The `service` channel is the Block Protocol message API: it receives `entity` updates pushed from the host and emits property/link mutation requests back. It is the **only** channel the block has to the outside world — a block has no `brainstorm` global, no fetch, no storage. Blocks are intentionally "smaller" than apps; they are renderable fragments, not full programs.

> **Decision:** blocks are sandboxed in a tighter context than apps. They **inherit no capabilities** — they cannot acquire any. The shell (not the host app) reads the bound entity on the block's behalf using the **block's grant chain**: a block bound to entity E can read E if either (a) the embedding app holds `entities.read` for E's type, or (b) the entity's access record explicitly grants the embedded view access. The host app is not a capability proxy; it cannot read entities the block needs that the host itself can't see. If neither path grants access, the block renders the fallback ("You don't have access to this content") — same as elsewhere. See [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) and the embedding model in [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md).

## Versioning

- `manifest.sdk` pins a major SDK version (`"1"`).
- Within `"1"`, the shell may add new methods to services. Existing methods keep their behavior.
- Removing or changing a method bumps `sdk` to `"2"`. The shell can host both at once during transition; apps pinned to `"1"` keep working.

The host-services *protocol* is also versioned (the IPC envelope carries a protocol version). The SDK shape and the protocol may version separately.

## Errors

All SDK calls reject with structured errors:

- `CapabilityDenied { capability }` — try `capabilities.request`.
- `NotFound { kind, id }` — entity, file, etc.
- `Conflict { reason }` — rare; mostly for non-CRDT operations.
- `Unavailable { service, reason }` — service offline (e.g. sync transport down).
- `Invalid { reason }` — malformed input.

Apps should expect `Unavailable` on any sync-touching call and degrade gracefully.

## What the SDK deliberately does **not** expose

- Direct filesystem paths.
- Network sockets (a `network` capability later may, with restrictions).
- Other apps' internal state.
- The shell's IPC layer directly.
- Y.Doc instances — only fragments scoped to specific properties of entities the app can access.
- Anything labeled `internal/*` in the host services.

The smaller this surface, the smaller the coupling.
