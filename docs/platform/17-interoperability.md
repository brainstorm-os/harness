# 17 — Interoperability between apps

Apps in Brainstorm don't import each other and don't hold references to each other (per [01-vision.md](../foundations/01-vision.md)). But users want apps to *work together*: open a database row in the editor, drag a note into a kanban card, export selected rows to CSV, pipe a selection through an LLM, paste a structured chunk that round-trips into another app.

This doc consolidates the interop patterns. Most of the underlying primitives are already defined elsewhere — intents in [08-app-sdk.md](../apps/08-app-sdk.md), Block Protocol entities and embeds in [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md), composition in [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md). This doc explains *how to use them together* and adds two patterns the earlier docs didn't cover: **format I/O** (export/import to external formats) and **drag-and-drop / clipboard** semantics.

## Principles

1. **No direct app-to-app calls.** Apps never import or message each other directly. The shell mediates everything.
2. **Apps interoperate through four channels:**
   - **Shared entities** — typed data both apps can read/write.
   - **Intents** — structured cross-app requests routed by verb.
   - **Block embedding** — one app's UI rendered inside another's surface.
   - **Format I/O** — converting entities to/from external formats (CSV, Markdown, PDF, JSON, etc.).
3. **Discovery is centralized.** The shell knows what each app can do (registered openers, intent handlers, exporters). The user finds capabilities through one set of surfaces (right-click menus, "More Actions" sheets, the launcher) — not by hunting through each app.
4. **Interop is async and best-effort.** A cross-app request returns when the target app finishes (or rejects). No app blocks waiting on another.
5. **Interop preserves the encryption model.** Cross-app routing happens in the shell process; ciphertext does not leak across the boundary. The receiving app gets entity *references*, not exfiltrated content.

## The four mechanisms — when to use which

| Mechanism            | Use when…                                                                                          | Examples                                         |
|----------------------|----------------------------------------------------------------------------------------------------|--------------------------------------------------|
| Shared entities      | Two apps treat the same data as theirs.                                                            | Notes app and graph viewer reading the same Notes. |
| Intents              | One app asks another to *act on* something.                                                        | "Open this row in the editor", "summarize this".  |
| Block embedding      | One app needs to *display or edit* another app's content inline.                                   | Kanban board inside a doc; image canvas in a note. |
| Format I/O           | Crossing the boundary between Brainstorm and the outside world (or moving structured content out). | Export selection as CSV; import Markdown file.    |

These are not exclusive. A real workflow often chains them: drag a row (intent), drop it into an editor (block embed), export the editor's doc later (format I/O).

## Mechanism 1 — Shared entities

Already covered in [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md). Briefly:

- An app holds an `entities.read:<type>` and/or `entities.write:<type>` capability.
- It queries, subscribes, and mutates entities through the entities service.
- Multiple apps reading/writing the same entity type *is the interop* — no negotiation needed.

This is the **lowest-friction** interop. If your two apps care about the same entity type, they don't need intents or any other mechanism — they just both speak the type.

## Mechanism 2 — Intents

An **intent** is a structured request from one app for *something to happen* with a piece of data, routed by the shell to a registered handler. From [08-app-sdk.md](../apps/08-app-sdk.md):

```ts
intents.dispatch({ verb, payload, source }): Promise<IntentResult | null>
intents.register(handler): void   // declared in manifest
```

This doc fills in the **vocabulary**. The verb namespace is global (so apps that don't know each other can still meet at a verb).

### The standard intent verbs

| Verb           | Meaning                                                            | Typical payload                            |
|----------------|--------------------------------------------------------------------|--------------------------------------------|
| `open`         | Open this thing in an appropriate app.                              | `{ entityId }` or `{ fileHandle }`         |
| `insert`       | Insert this thing at the current selection of the focused editor.   | `{ entityId, blockId? }` or `{ data }`     |
| `share`        | Share this thing to another destination.                            | `{ entityId, target? }`                    |
| `convert`      | Convert this entity to another entity type or format.               | `{ entityId, targetType }`                 |
| `export`       | Write this thing to an external format (CSV, MD, etc.).             | `{ entityIds, format }`                    |
| `import`       | Read an external format and produce entities.                       | `{ fileHandle, format, intoType? }`        |
| `process`      | Run this through a transform/processor (often AI — summarize, extract, classify, etc.). | `{ entityId, kind, params? }`              |
| `compose`      | Combine multiple entities into a new one.                           | `{ entityIds, intoType }`                  |
| `quick-look`   | Show a non-modal preview without launching a full editor.           | `{ entityId }`                             |

> **Decision:** the verb namespace is curated. New verbs can be added in shell releases. Apps cannot invent new verbs at runtime, only handle/dispatch existing ones.

*(OQ-30 — open vs. curated namespace — is **resolved** at the curated decision above. How an app's registered handlers surface as contributed actions in **other apps' menus** is specified in [63 — the action surface](63-action-surface.md); OQ-AS-1..5 there.)*

### Registering as a handler

A handler declaration in the manifest:

```jsonc
"registrations": {
  "intents": [
    { "verb": "open", "entityType": "io.example/Note/v1", "kind": "primary" },
    { "verb": "insert", "blockId": "io.example.text-editor/paragraph" },
    { "verb": "export", "entityType": "io.example/Database/v1", "format": "text/csv" },
    { "verb": "process", "kind": "summarize" }
  ]
}
```

The shell uses the registration index to answer "which apps can handle `verb=X` for `entityType=Y` (or `format=Z`)?" That answer drives:

- The right-click "Open with…" menu on entities and files.
- The "Share" sheet's destination list.
- The "Export" submenu's format options.
- The "Process" menu's transformation options.
- The launcher's intent suggestions ("Summarize selected", "Convert to PDF").

### Dispatching

```ts
const result = await brainstorm.services.intents.dispatch({
  verb: "open",
  payload: { entityId: "ent_..." },
  source: { app: "io.example.db", reason: "user-clicked-row" }
});
```

The shell:
1. Looks up registered handlers for `(verb, entityType-derived-from-payload)` or `(verb, format)`.
2. If multiple, prompts the user to choose (or uses a stored default — e.g. user picked "always open Notes in Editor").
3. Routes the intent to the chosen app.
4. The handler returns a result (`{ ok: true, output? }` or `{ ok: false, reason }`).

### Default handlers

The shell remembers user choices: "always open `Note/v1` with `text-editor`". Defaults are scoped to `(verb, entityType-or-format)` pairs and visible in settings. The user can clear them.

> **Decision:** there is no global "default app". Defaults are per-`(verb, type)` pair. This avoids the "I made app X my default and now it owns my whole life" trap.

## Mechanism 3 — Block embedding

Covered in [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) and [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md). The interop angle:

- App A (a doc) embeds a block from app B (a kanban) by reference.
- The user's editing across apps "feels integrated" without the apps knowing each other.
- Removing app B turns the embed into a fallback card; the doc remains valid.

When to choose embedding over an intent:
- The user is going to **see** B's content as part of A's surface → embed.
- The user wants A to **trigger** something in B and move on → intent.

## Mechanism 4 — Format I/O

This is the new pattern, and it's how Brainstorm moves structured content **across the boundary** with the outside world. CSV, Markdown, JSON, PDF, ICS, vCard, plain text — these are the formats users live with outside Brainstorm.

> **Decision:** format I/O is implemented as a specialization of intents (`export` and `import` verbs). It gets its own doc-level treatment because it is the highest-volume cross-boundary operation and has format-specific lifecycle (file pickers, encoding, schema mapping).

### Export

An app that can take an entity (or selection) and write a file in a foreign format registers as an **exporter**:

```jsonc
"registrations": {
  "intents": [
    {
      "verb": "export",
      "entityType": "io.example/Database/v1",
      "format": "text/csv",
      "label": "CSV (current view)"
    },
    {
      "verb": "export",
      "entityType": "io.example/Database/v1",
      "format": "application/json",
      "label": "JSON"
    }
  ]
}
```

The flow when a user clicks "Export selection as…":

1. The current app dispatches `intent.export` with `{ entityIds, format: <user-chosen> }`.
2. If the dispatching app is itself the exporter (most common case for "export this DB"), it handles the intent in-process, prompting `files.requestSave` for a destination.
3. If the exporter is a separate app, the shell hands the intent over; the user sees the receiving app save the file.

The exporter receives the entity ids, fetches them through the entities service (with its own capabilities), and writes to a `FileHandle` via the files service. The shell's `files.requestSave` flow surfaces the native save dialog.

### Import

Symmetric. An app that can read a foreign format and produce entities of a known type registers as an **importer**:

```jsonc
{
  "verb": "import",
  "format": "text/csv",
  "intoType": "io.example/Database/v1",
  "label": "Import CSV into Database"
}
```

Triggered from the launcher ("Import CSV…") or from an app's UI ("Add rows from file"). The user picks a file via `files.requestOpen`; the importer parses; entities are created via the entities service.

### Format vs. type — a clarification

- **Entity types** (e.g. `io.example/Note/v1`) are Brainstorm-internal, schema-defined. Two apps speak the same entity type and the data is the same data.
- **Formats** (e.g. `text/csv`, `text/markdown`) are external, byte-stream-defined. Two apps speak the same format only if they agree on the same dialect (CSV has many).

> **Decision:** the shell does not normalize foreign formats. If app A exports CSV and app B imports CSV, they're agreeing on the format string, not on the byte-level dialect. Edge cases (CSV quoting differences, Markdown flavors) are between the apps and the file.

### Common formats Brainstorm cares about (v1 baseline)

- `text/plain`, `text/markdown`, `text/csv`, `text/html`
- `application/json`
- `application/pdf` (export only for v1)
- `image/*` (passthrough)
- Future: ICS, vCard, RSS, OPML

The shell ships **no built-in importers/exporters**. They come from apps. The text-editor app brings Markdown export; a database app brings CSV/JSON; a print/PDF app brings PDF export. If no exporter is installed for a format, that option simply doesn't appear in the menu.

## Drag-and-drop

> **Superseded by [65 — object selection and cross-app drag-and-drop](65-object-selection-and-cross-app-dnd.md).** The sketch below assumed native HTML5 DnD carries custom MIME types *between* apps. It does not: each app is its own renderer process ([OQ-4](../reference/11-open-questions.md)), and a `DataTransfer` does not cross that boundary — a cross-app drop fires with empty custom-MIME data. Cross-app drag is therefore **shell-mediated** (a drag session: shell-owned ghost, `WindowIndex` hit-testing, capability-checked drop), and the wire format standardises on the *shipped* `application/vnd.brainstorm.entity+json` (`{ v, sourceApp, items[] }`), superseding the two MIME names below. Native HTML5 DnD is retained only for intra-renderer drags. See 65 for the full design. The original sketch is kept below for context.

> **Decision (original sketch — see correction above):** drag-and-drop between apps uses HTML5 DnD with two custom MIME types layered on top of native types:
> - `application/x-brainstorm-entity` — JSON: `{ entityIds: string[], sourceApp: string }`
> - `application/x-brainstorm-blockprotocol` — JSON: `{ blockId, entityId, payload }`

Plus the standard MIME types (`text/plain`, `text/html`, `text/uri-list`, `image/png`, etc.) for compatibility with non-Brainstorm targets.

When you drag from app A to app B:
- The browser's drag/drop fires natively. The drop target sees the custom MIME types in `dataTransfer`.
- App B inspects what's available and decides how to handle it: insert as a `BlockEmbedNode`, copy properties into a row, render as text, etc.
- If app B doesn't recognize the structured types, it falls back to whatever standard types are also present (`text/plain` is a sensible representation).

The shell does not need to mediate during a drag — the renderers handle it via Electron's native drag/drop. The shell *does* expose a small helper (`brainstorm.services.dnd.serialize(entityIds)`) that builds the standard payload so apps don't reinvent the encoding.

> **Decision:** dragging *outside* Brainstorm (to another desktop app, to the browser) uses the standard MIME types only. Brainstorm content "degrades" gracefully — typically as `text/plain` (the entity's display title) and `text/uri-list` (a deep-link URL into Brainstorm).

## Clipboard

Same model as drag/drop:

- Standard clipboard formats are populated (text, HTML, image).
- Custom Brainstorm formats are layered on top via `ClipboardItem` / Electron's clipboard API.
- Pasting into a Brainstorm app *with* the custom formats: structured paste (e.g. `BlockEmbedNode` insertion).
- Pasting into a Brainstorm app *without* custom formats (e.g. you copied from a browser): falls back to standard handling.
- Pasting outside Brainstorm: standard formats only; custom data dropped.

> **Open:** does the shell *track* clipboard contents (a clipboard history surface)? Useful, but a privacy concern. Tracked as OQ-31 in [11-open-questions.md](../reference/11-open-questions.md).

## Selection

A common interop need is "do something with my current selection." Brainstorm needs a shared notion of selection so that "summarize this" works regardless of which app is focused.

> **Decision:** the focused app exposes its current selection (when meaningful) via a host service: `selection.current()`. The selection is a typed payload — entity-id list for grid-style selection, a Yjs range pointer for editor selection, etc. The shell uses this when the user invokes an intent that needs a "what is selected?" payload.

Apps that want to participate (most do) call `selection.publish(payload)` whenever their internal selection changes. Apps that don't simply expose nothing.

This is the bridge between "user has selected three rows in the database" and "now they invoke `process:summarize`".

## Walkthrough: "Open this row in the editor"

1. User right-clicks a row in the database app.
2. The DB app's context menu calls `brainstorm.services.intents.suggest({ verb: "open", payload: { entityId } })`.
3. The shell returns: `[ { app: "io.example.text-editor", label: "Open in Editor" }, { app: "io.example.note", label: "Open as Note" } ]`.
4. The DB app shows the menu; the user picks "Open in Editor".
5. The DB app calls `intents.dispatch({ verb: "open", payload: { entityId } })`.
6. The shell routes to the editor app, which launches a window (or focuses an existing one) showing that entity.

## Walkthrough: "Export selected rows to CSV"

1. User selects rows in the DB app.
2. DB app calls `selection.publish({ kind: "entityIds", entityIds: [...] })`.
3. User invokes "Export…" (menu, hotkey, or launcher).
4. DB app calls `intents.suggest({ verb: "export", payload: { entityIds, format: "*" } })`.
5. Shell returns formats with available exporters: `[ "text/csv", "application/json", "text/markdown" ]` (assuming each is registered by some installed app).
6. User picks CSV.
7. DB app dispatches `intent.export` with `{ entityIds, format: "text/csv" }`.
8. The CSV exporter (could be the DB app itself, could be a dedicated converter app) handles the intent: prompts a save destination via `files.requestSave`, writes the CSV.

## Walkthrough: "Drag a database row into a doc to embed it"

1. User starts dragging a row in the DB app.
2. DB app populates `dataTransfer` with `application/x-brainstorm-entity` (the row's entity id) and `text/plain` (its title) and `text/uri-list` (a deep link).
3. User drops on the editor.
4. Editor inspects `dataTransfer`, sees `x-brainstorm-entity`, asks the registry: "is there a block id registered as primary for entity-type `io.example/DBRow/v1`?"
5. If yes, editor inserts a `BlockEmbedNode { blockId, entityId }` at the drop point. The DB app's row block is mounted there.
6. If no, the editor inserts a fallback chip with the title and the deep-link.

## Walkthrough: "Send selection to LLM"

1. User has a selection (whether of rows, of text, or of any entity).
2. User invokes "Process → Summarize" from the launcher.
3. Shell dispatches `intent.process` with `{ kind: "summarize", payload: <selection> }`.
4. An installed LLM app handles the verb-kind. It receives the selection, runs its model, returns the summary as either:
   - An inline result rendered in a notification/popover, or
   - A new entity (`io.example/Summary/v1`), with the user prompted to "Open" it (which fires another intent).

## Discoverability surfaces

Where users find what's possible:

- **Right-click context menus** on entities, blocks, selections → enumerate `open`, `insert`, `share`, `process`, `convert`, `export` handlers for the targeted item.
- **The launcher** → "intent results" alongside app/entity results. Typing "summarize" surfaces all `process` handlers with kind starting with "summarize".
- **The "More Actions" affordance** in app UIs → standardized button apps can render that the shell populates. (Concretized as the `useContributedActions` / `<ActionMenu>` SDK primitive in [63 — the action surface](63-action-surface.md), which makes every app's menus contribution-aware.)
- **Settings → Defaults** → user reviews per-`(verb, type)` defaults and clears them.

> **Decision:** the shell standardizes the interop surface. Apps don't roll their own "Share" menu; they call `intents.suggest` and render the result through the shell-provided menu component (built on `@react-fancy-menus/core` — see [13-frontend-stack.md](../shell/13-frontend-stack.md)). The same engine renders right-click menus, "Open with…", "Export to…", and the launcher's intent suggestions, so the user sees one consistent surface for every cross-app action.

## Failure modes

- **No handler registered for an intent** → shell informs the dispatcher with `{ ok: false, reason: "no-handler" }`. The dispatcher should either degrade silently (if the intent was speculative) or show a useful message ("Install an app that can convert to PDF").
- **Handler crashes mid-intent** → the dispatcher receives `{ ok: false, reason: "handler-error" }` after a timeout (default 30s, can be longer for `process` verbs).
- **User cancels mid-intent** → `{ ok: false, reason: "cancelled" }`.
- **Capability missing** → `{ ok: false, reason: "capability-denied" }`.

## Performance

Intent dispatch follows the same IPC path as any host-service call (per [12-shell-architecture.md](../shell/12-shell-architecture.md)). The expected latency for routing is sub-2ms; user-visible latency is dominated by the *handler* (which may launch a window, decrypt, fetch, etc.).

> **Decision:** intent dispatch is asynchronous. The dispatcher must not block UI on the result. Showing a spinner is the dispatching app's responsibility.

## Non-goals

- **A general message bus.** Apps cannot subscribe to broadcast streams. Cross-app communication is request/response or fire-and-forget by intent.
- **Synchronous app-to-app calls.** Always async, always shell-mediated.
- **Plugins for plugins.** An app cannot register handlers on behalf of another app. Each registration is owned by exactly one app's manifest.
- **Format normalization.** The shell does not transcode CSV dialects, normalize Markdown flavors, or interpret format semantics. That's the apps' job.
- **AI-only interop.** AI is foundational (per Principle 8 in [01-vision.md](../foundations/01-vision.md) and detail in [22-ai-foundations.md](22-ai-foundations.md)) and the `process` verb is *the* surface for many AI features (summarize, extract, classify, transform). But `process` is not AI-only — non-AI processors register the same way. Interop is mechanism-agnostic; AI is one important consumer.

## Summary

- Four mechanisms: shared entities, intents, block embedding, format I/O.
- Intents have a curated verb vocabulary (`open`, `insert`, `share`, `convert`, `export`, `import`, `process`, `compose`, `quick-look`).
- Format I/O is intents specialized for CSV/Markdown/JSON/etc., with `export` and `import` verbs.
- Drag-and-drop and clipboard use standard MIME types plus two custom Brainstorm types for structured payloads.
- Selection is published by the focused app via a host service so that intents can act on "what's selected".
- Discovery is centralized: right-click menus, launcher, "More Actions" — driven by the shell's registration index.
- The shell never lets one app speak for another. Intents are the entire vocabulary of cross-app workflows.
