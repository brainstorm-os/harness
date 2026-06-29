# 07 — Editing with Lexical

This doc defines how rich text works in Brainstorm. It refers to [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) for the surrounding entity model and [06-collaboration-yjs.md](06-collaboration-yjs.md) for the CRDT layer.

## Why Lexical

Rich text is a feature of multiple apps (the text-editor app, comments and descriptions in database apps, code blocks in code editor, captions in image viewer, etc.). We want one editor framework to do this everywhere so that:

- A user's rich-text experience (shortcuts, behavior, accessibility) is consistent across apps.
- The Yjs binding for rich text is written once, used many times.
- Rich text content from one app can be displayed faithfully in another.

Lexical fits: it has a clear separation between the editor state (the abstract document) and the rendered React tree, and it has a well-supported Yjs binding (`@lexical/yjs`).

## Where Lexical lives

> **Decision:** Lexical is **not** a host service. It ships as a library used by apps. Each app that needs rich text imports Lexical and the Brainstorm editor configuration package.

Reasoning:

- Rich-text behavior should not require an IPC round-trip per keystroke.
- Apps need to add custom node types for their domain (e.g. a code-editor's snippet node, a database's @-mention chip).
- The shell does not need to know about editor state; it knows about the underlying Yjs fragment.

What the shell *does* provide:

- The `Y.XmlFragment` (or `Y.XmlText`) the editor binds to, as resolved from a property `$ref` (see [05](../data/05-data-and-blocks-protocol.md)).
- An awareness channel for the editor's collaborator cursors.
- A baseline node-type schema (paragraph, heading, list, link, code, image — agreed across apps so that text from one app reads in another).

## The `brainstorm-editor` package

Provides:

- A pre-configured Lexical editor factory.
- The baseline node set, defined to round-trip through Yjs cleanly.
- A serialization layer that maps Lexical state to a stable wire format (`@lexical/json` extended with Brainstorm node ids for custom nodes).
- A **block embedding node** — a Lexical node whose content is "render block X bound to entity Y" (see below).

Apps use this package; they do not configure Lexical from scratch. This keeps node-type compatibility manageable.

> **Open:** is `brainstorm-editor` shipped as a versioned library that apps bundle, or a host service the app loads at runtime? Bundling is simpler; host-loading would let us upgrade editor behavior across all apps at once. *[RESOLVED 2026-06-29 — bundled per app (Notes ships React + Lexical + Vite)]* Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Yjs binding

Lexical's collaboration plugin (`@lexical/yjs`) takes a `Y.Doc` and a fragment id and keeps the editor state in sync with the CRDT. Brainstorm uses this directly:

- When an app opens an editor for entity `E`'s `body` property, it asks the host service for the `Y.XmlFragment` at `doc://E/body`.
- The shell returns a fragment from the renderer's replica of `E`'s Y.Doc.
- Lexical binds to that fragment. From this point, editor state is just a view on the Y.Doc.

Awareness flows the same way: the shell exposes the awareness channel scoped to the entity, the editor's collaboration plugin plugs in.

> **Decision:** Lexical state is *always* backed by a Yjs fragment in Brainstorm. There is no "non-collaborative Lexical mode". Even local-only edits go through Yjs, so that turning sync on later is a pure transport addition.

## Custom node types

An app may define custom Lexical nodes for its domain:

- **Code editor app** — a `CodeBlockNode` with a language attribute and syntax-aware children. Its serialization is a known wire format.
- **Database app** — an `EntityChipNode` for in-text references to entities (an `@`-mention).
- **Drawing app** — an `InlineSketchNode` for a small embedded sketch.

For these to render across apps, Brainstorm requires:

1. Custom nodes serialize to a recorded type id (e.g. `io.example.code/code-block@v1`).
2. The brainstorm-editor library knows how to render a "stranger" node when the originating app is not installed: it falls back to a generic placeholder bearing the node's known display hint.
3. The shell's registry maps node type ids to the providing app, the same way it maps block ids.

> **Open:** are custom Lexical nodes the same registry as Block Protocol blocks, or a separate registry? They serve adjacent purposes (embeddable UI in rich text vs. embeddable UI as standalone block). *[RESOLVED 2026-06-29 — separate registries bridged by BlockEmbedNode (OQ-12)]* Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Block embedding inside rich text

> The full integration story between Lexical custom nodes and Block Protocol embeds — when to use which, the decision criterion ("does the cursor flow through it?"), and how the two share the Yjs substrate — is in [15-embedding-and-composition.md](15-embedding-and-composition.md). The summary follows.

A document edited in app A may want to embed a block produced by app B (a code snippet, a Mermaid diagram, a database view). Brainstorm handles this via a single Lexical node type:

`BlockEmbedNode { blockId: string, entityId: string }`

When rendered, this node mounts a **block frame** (per the policy in [05](../data/05-data-and-blocks-protocol.md)) — a sandboxed iframe that loads the providing app's block UI, bound to the referenced entity. To app A, the embedded block is opaque content; to the user, it is interactive.

Selection, focus, and clipboard cross the iframe boundary via Block Protocol messages. Editing inside the block writes to the embedded entity's Y.Doc; the outer document's Y.Doc is unaffected (it only stores the embed reference, not the embedded content).

> **Decision:** the rich-text document does **not** inline the embedded entity's content. The embed is a reference. This keeps the wire format compact and portable, and it is what makes embedded content survive changes in either side.

## Reading rich text without an editor

Apps that only display rich text (a search-result preview, a launcher snippet, a graph node label) use a **read-only renderer** from `brainstorm-editor`. The renderer:

- Walks the Yjs fragment tree directly.
- Renders the baseline nodes natively.
- Renders custom nodes via either the registered renderer (if installed) or a fallback chip.
- Does **not** instantiate Lexical, which is a heavier dependency than needed for read paths.

## Plain-text fields

For fields typed as `text` (not `richtext`) — e.g. a note's title — the SDK exposes a small text-editor primitive over `Y.Text`, not Lexical. This keeps the title path lightweight while still benefitting from CRDT collaboration.

## Large documents

Lexical reconciles its whole node tree into the DOM, so very long documents are a DOM-size cost (not a model cost — the Yjs doc and EditorState stay cheap). How the editor stays within the `<16ms` keystroke→paint budget on large documents — a two-phase, measurement-gated virtualization that **never mutates the Yjs-bound state** (the §Yjs binding decision is load-bearing here) — is specified in [52-editor-virtualization.md](52-editor-virtualization.md).

> **Open:** whether `content-visibility` + offscreen-decorator-unmount alone clears the budget or true reconciliation-windowing is required, and the threshold at which virtualization activates. *[RESOLVED 2026-06-29 — Phase-1 (content-visibility + decorator-unmount) always-on clears the budget; OQ-185 resolved at Stage 13.4a]* Tracked as OQ-185 in [11-open-questions.md](../reference/11-open-questions.md).

## Summary

- Lexical is a library, used by apps that need rich text.
- All rich text is Yjs-backed, even offline.
- A shared baseline node set keeps cross-app compatibility.
- Custom nodes are registered like blocks, with installed/uninstalled fallback rendering.
- Block embedding inside rich text uses a single Lexical node referencing a block id + entity id, mounted in a sandboxed frame.
