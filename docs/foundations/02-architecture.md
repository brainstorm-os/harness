# 02 — Architecture overview

## The three layers

```
┌──────────────────────────────────────────────────────────────────┐
│  APPS  (sandboxed, independent, replaceable)                      │
│  ─────────────────────────────────────────────────────            │
│  text editor  │  database  │  pdf  │  graph  │  code  │  …        │
└────────┬─────────┬────────┬───────┬─────────┬────────┬────────────┘
         │         │        │       │         │        │
         │   Block Protocol + capability-gated host services         │
         │         │        │       │         │        │
┌────────▼─────────▼────────▼───────▼─────────▼────────▼────────────┐
│  SHELL  (the host: dashboard, launcher, window manager,           │
│          IPC broker, capability checker)                           │
└────────┬───────────────────────────────────────────────────────────┘
         │
         │   stable internal APIs
         │
┌────────▼───────────────────────────────────────────────────────────┐
│  CORE SERVICES  (storage, sync, identity, files, intents, search)  │
│  Yjs runtime, persistence backends, transport adapters             │
└────────────────────────────────────────────────────────────────────┘
```

Three layers, two boundaries. The shell-to-services boundary is internal and can evolve freely. The shell-to-app boundary is **the** stable contract — any breaking change there breaks every installed app.

## The shell

The **shell** is the Electron main process plus a privileged renderer that hosts the dashboard. It owns:

- Windowing (creating, focusing, restoring, closing app windows).
- The dashboard surface (wallpaper, icons, widgets, launcher).
- The capability ledger (what each app is allowed to do).
- The IPC broker (every host-service call from an app passes through it).
- The session: which apps are running, which windows are open, where they were placed.

The shell deliberately holds no domain knowledge. It cannot tell you what an entity *means*, only that one exists, who created it, and who has access.

See [04-shell.md](../shell/04-shell.md).

## Apps

An **app** is a self-contained package that the shell can install, launch, suspend, and remove. Each launched app runs in its own renderer process (Electron `BrowserWindow`, or `WebContentsView` when hosted inside a tab group per [33-windows-and-menus.md](../shell/33-windows-and-menus.md)) and communicates with the shell only via the host-services IPC.

Apps cannot:
- Open files outside their grant.
- Make arbitrary network requests (network is a capability).
- Hold references to other apps.
- Mutate shell state directly.

Apps can:
- Open windows they own.
- Read and write entities they have access to (Block Protocol).
- Subscribe to Yjs docs they have access to.
- Register block types they implement (other apps can embed them).
- Register themselves as handlers for entity types or file MIME types.

See [03-app-model.md](../apps/03-app-model.md) and [08-app-sdk.md](../apps/08-app-sdk.md).

## Core services

Behind the shell sit a set of **core services** — internal to the shell process, not directly exposed to apps. Apps reach them through host-service IPC, which the shell mediates with capability checks.

| Service       | Responsibility                                                            |
|---------------|---------------------------------------------------------------------------|
| `storage`     | Local persistence of Yjs docs and blob attachments.                       |
| `sync`        | Transport adapter (e.g. y-websocket, local relay) over Yjs updates.       |
| `entities`    | Block Protocol entity store: typed records, links, queries.               |
| `files`       | User-grantable filesystem access; abstracted as opaque file handles.      |
| `identity`    | The local user; key material for signing and (eventually) device pairing. |
| `intents`     | Cross-app actions — "open this with…", "share to…" — without app coupling.|
| `search`      | Index over entities and Yjs document content.                             |

These services are versioned independently of the shell UI; the SDK pins to a service API version.

## Where the external technologies fit

```
              ┌──────────────────────────────┐
   apps ───►  │   Block Protocol contract    │  ◄─── apps
              │   (entity URLs, link URLs,    │
              │    block component contract)  │
              └──────────────┬───────────────┘
                             │
              ┌──────────────▼───────────────┐
              │   entities service            │
              │   (typed records, links)      │
              └──────────────┬───────────────┘
                             │
              ┌──────────────▼───────────────┐
              │   Yjs docs                   │  ◄─── Lexical state
              │   (one or many per entity)   │       binds here
              └──────────────┬───────────────┘
                             │
              ┌──────────────▼───────────────┐
              │   storage + sync             │
              │   (local persistence,        │
              │    transport adapters)       │
              └──────────────────────────────┘
```

- **Block Protocol** is the contract apps see. Apps publish/consume entities and embed blocks at this layer.
- **Yjs** sits underneath the entity model. Each entity (or each rich-text field of an entity) is backed by a Yjs doc. Apps don't think about CRDTs day-to-day; they think about entities.
- **Lexical** is used by any app that needs rich text. Lexical state is bound to a Yjs `XmlFragment` or equivalent; the binding is a published library, not a per-app concern.

This stack is detailed in [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md), and [07-editing-lexical.md](../editing/07-editing-lexical.md).

## Process model

> **Decision:** each app runs in its own renderer process. The shell runs in the Electron main process and a privileged dashboard renderer.

Reasoning:
- Process isolation is the cheapest reliable sandbox boundary.
- Crash isolation: a wedged app does not take down the shell.
- Memory isolation: an app cannot reach into another app's heap.
- Update isolation: hot-reloading or replacing an app does not touch the rest of the session.

Trade-off: more memory and slower cold start than tab-style hosting. We accept this; Brainstorm targets desktops with reasonable RAM.

**How apps in different processes share the same Yjs doc:** the entities service holds the canonical Y.Doc on the shell side and exposes a Yjs `Provider` over IPC to each renderer that has access. Whether the canonical lives in the main process or a dedicated yjs worker is OQ-18 *[RESOLVED 2026-06-29 — dedicated ydoc worker]*; the contract is the same. Specified in [06-collaboration-yjs.md](../editing/06-collaboration-yjs.md).

## Boundaries summarised

- **Shell ↔ apps:** stable, versioned, IPC, capability-checked. **The** contract.
- **Shell ↔ core services:** internal, evolves with the shell.
- **Apps ↔ apps:** indirect only — through entities, intents, or by embedding each other's registered blocks.
- **Apps ↔ filesystem / network:** mediated by the shell, gated by capabilities.

## What this architecture buys us

- Removing or replacing an app touches one package boundary.
- The shell can be upgraded without breaking apps, as long as the host-services API version is preserved.
- A new app gets useful behavior (storage, sync, embedding, search) for free as soon as it speaks the contract.
- Any cross-app feature has a natural home: it is either a standard entity type, a host-service capability, or an intent.
