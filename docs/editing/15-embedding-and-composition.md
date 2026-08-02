# 15 — Embedding and composition: Block Protocol meets Lexical

Brainstorm has two ways to compose content:

- **Lexical custom nodes** — vocabulary inside a rich-text document.
- **Block Protocol embeds** — references from anywhere (a document, a panel, a widget) to a standalone block bound to its own entity.

These look similar from a distance and they share the same Yjs substrate, but they solve different problems. This doc defines the division of labor, the bridge between them, and the decision criterion app authors apply.

It supersedes the embedding-related sections of [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) and [07-editing-lexical.md](07-editing-lexical.md), which now cross-reference here.

## The two mechanisms

### Lexical custom nodes — the document's vocabulary

A **custom Lexical node** is a node type contributed by an app to extend rich text. The text-editor app registers nodes like `paragraph`, `heading`, `list`. A code-editor app might add `CodeBlockNode`. A database app adds `EntityChipNode` (an @-mention pill).

What's special about a custom Lexical node:

- It lives **inside the document's Yjs fragment** (the same fragment Lexical is bound to via `@lexical/yjs`).
- The cursor moves through it. Selection can span across it. Keyboard shortcuts work over it.
- Lexical's history (undo/redo), copy/paste serialization, and IME all naturally include it.
- It is rendered by the providing app (registered by node-type id, e.g. `io.example.code/code-block`).
- If the providing app isn't installed, a fallback chip is shown (per the fallback-renderer principle).

Custom Lexical nodes are *part of the prose*. They participate in flow. You read them as you read the surrounding paragraphs.

### Block Protocol embeds — references to standalone things

A **Block Protocol embed** is a reference, from one place in the UI, to a block bound to a separate entity. The block runs in its own sandboxed iframe; it has its own UI, its own (possibly different) framework, its own collaborative state.

What's special about a Block Protocol embed:

- It lives **as a small reference** wherever it's placed: in a document, in a panel, in a widget. The reference is two pieces of data: `(blockId, entityId)`.
- The reference does **not** carry the block's content. The content is in the *embedded entity's* Y.Doc.
- The block is sandboxed (cross-origin iframe). It cannot reach into its host's state.
- It has its own editing surface, possibly nothing in common with the surrounding context.
- If the providing app isn't installed, a placeholder card is shown using the entity type's display hints.

Block Protocol embeds are *standalone*. They have their own life cycle. The cursor does not "enter" them in any text-editing sense.

## The bridge: `BlockEmbedNode`

Inside a Lexical document, a Block Protocol embed appears as exactly **one Lexical node type**: `BlockEmbedNode`.

```ts
type BlockEmbedNode = LexicalNode & {
  blockId: string;       // e.g. "io.example.kanban/board"
  entityId: string;      // the entity the block is bound to
};
```

When Lexical encounters a `BlockEmbedNode` while rendering, it asks the shell:
- "What renders blockId X?" → the shell looks up the registry, finds the providing app.
- The shell mounts a sandboxed iframe at that point, configured to load the block bundle, bound to entityId Y.

> **Decision:** this doc takes OQ-8's option (a) — the iframe is mounted **inside the embedding app's renderer** (rather than hosted directly by the shell). Layout and focus stay simple, the block runs in a cross-origin sandbox so the security boundary is preserved. OQ-8 in [11-open-questions.md](../reference/11-open-questions.md) tracks whether to ever revisit.

> **Decision:** custom Lexical nodes and Block Protocol blocks live in **separate registries** (closing OQ-12 with option a). They serve adjacent purposes — inline node-in-prose vs. embedded UI fragment — and have different serialization, lifecycle, and rendering expectations. The bridge between the two layers is `BlockEmbedNode`, not registry unification.

To Lexical, the `BlockEmbedNode` is a void/atomic node — the cursor jumps over it; selection treats it as a single unit; copy gives you a portable representation; paste re-mounts the embed.

To the user, the embed feels like an object inside their document. They can move it, delete it, copy-and-paste it elsewhere — the *reference* travels; the underlying entity stays put.

> **Decision:** the Lexical document never inlines an embedded entity's content. Embeds are references only. The embedded entity is a peer Yjs doc with its own life, edited through whichever app the block belongs to.

## The decision criterion

When an app author is designing new content, the decision tree:

```
   Are you adding content inside a rich-text editing surface?
     │
     ├── No → Use a Block Protocol embed directly (panel, widget, card).
     │       The thing you're embedding is already standalone.
     │
     └── Yes → Does the user's cursor flow through it?
                │
                ├── Yes → Lexical custom node.
                │         Examples: code block (you type code in it), @-mention,
                │                   inline equation, link, simple inline image.
                │
                └── No  → Block Protocol embed via `BlockEmbedNode`.
                          Examples: kanban board, database table view,
                                    Mermaid diagram, complex image canvas, video.
```

The criterion is **about UX**, not data shape. The same underlying entity might appear:

- as a Lexical custom node (lightweight inline display) in one context,
- as a Block Protocol embed (full editing surface) in another.

The text-editor app gets to choose which it presents. The data — the entity in the entities service — is the same in both cases.

### Worked example: meeting-notes document

A user opens a meeting-notes document in the text-editor app:

```
[paragraph]   We met to discuss Q3 priorities.
[paragraph]   @ana raised the [link: Roadmap doc] question.
[code-block]   $ deploy --target=staging
[block-embed: kanban / ent_OKR2025Q3]   ← rendered as iframe
[paragraph]   Action items below.
[block-embed: db-table / ent_actionItems] ← rendered as iframe
```

What's living where:

| Element                    | What it is                       | Where it lives                                       |
|----------------------------|----------------------------------|------------------------------------------------------|
| paragraph                  | Built-in Lexical node            | document's Y.XmlFragment                             |
| @ana mention               | Custom Lexical node `EntityChip` | document's Y.XmlFragment + reference to person ent.  |
| Roadmap link               | Built-in Lexical link node       | document's Y.XmlFragment                             |
| code block                 | Custom Lexical node `CodeBlock`  | document's Y.XmlFragment (text inline)               |
| kanban embed               | `BlockEmbedNode` reference       | document's Y.XmlFragment (small ref) + own entity Y.Doc |
| action-items table embed   | `BlockEmbedNode` reference       | document's Y.XmlFragment (small ref) + own entity Y.Doc |

When you delete the kanban embed from the document, you delete the **reference**. The Kanban entity itself is unaffected; it can be re-embedded in another doc, or opened directly.

## Shared Yjs substrate

Both mechanisms ultimately serialize into Yjs, which is what makes them composable cleanly.

```
   ┌─────────────────────────────────────────────────────────────┐
   │  Document entity's Y.Doc                                    │
   │  ─────────────────────────────                              │
   │   properties.body : Y.XmlFragment    ← Lexical binds here   │
   │     ├── paragraph (built-in)                                │
   │     ├── code-block (custom Lexical node)                    │
   │     ├── entity-chip (custom Lexical node)                   │
   │     └── BlockEmbedNode { blockId, entityId }   ─────┐       │
   └──────────────────────────────────────────────────────┼──────┘
                                                          │
                                                          │  reference only
                                                          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Embedded entity's Y.Doc (separate)                         │
   │  ──────────────────────────────────                         │
   │   properties.* : whatever the entity type defines           │
   │   (the kanban entity has columns, cards, etc.)              │
   └─────────────────────────────────────────────────────────────┘
```

Both are first-class Yjs docs. Both go through snapshot + tail persistence. Both can be synced. Both can have awareness. Two users editing the same kanban board — one through the document, one directly — converge naturally.

## Authoring guidance for app developers

If you're building an app that contributes to rich-text documents:

1. **Default to a custom Lexical node** for anything inline or flow-like. Code, equations, mentions, links, small images — all custom Lexical nodes.
2. **Reach for `BlockEmbedNode`** only when the content has its own substantial editing surface or its own collaborative state.
3. **Don't build both** for the same entity unless you have a real UX reason. Pick the right level for the use case.
4. **Custom Lexical nodes serialize stably** — give them a versioned type id (`io.example.code/code-block@v1`). Past documents must continue to render after upgrades.
5. **Block Protocol embeds get isolation for free** — but at the cost of an iframe (memory, slight focus complexity). Don't reach for them lightly.

## Sandbox primitive (Stage 9.5)

`BlockEmbedNode` references mount via a single primitive — `@brainstorm/sdk/block-frame` (`packages/sdk/src/block-frame/`) — that every BP block in the product runs in. The primitive is intentionally narrow; everything below is enforced by code (constants are deep-frozen + regression-fenced; the static `iframe-src-check` guard in the mcp-server suite blocks new `iframe.src` writes anywhere else in the repo). 9.5.1 shipped the iframe primitive, 9.5.2 shipped the BP postMessage transport, 9.5.3 added the bounded-cost gates + adversarial sweep + inner-frame helper + static guard.

| Layer                                | What it enforces                                                                                                                                                                                                                              | Where                                                              |
|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| iframe attributes                    | `sandbox="allow-scripts"` only; no `allow-same-origin` (→ opaque origin); `allow=""` (Permissions-Policy deny-all); `referrerpolicy="no-referrer"`; `loading="lazy"`; `srcdoc` ONLY (never `src` — see static guard below).                   | `block-frame.ts` / `block-frame-constants.ts`                      |
| inner-document CSP                   | `default-src 'none'`, `connect-src 'none'` (no fetch / XHR / WebSocket), `img-src data:` only, `script-src 'unsafe-inline'` bounded by opaque origin, every other directive `'none'`.                                                          | `block-frame-constants.ts` (`BLOCK_FRAME_CSP_DIRECTIVES`)         |
| transport identity gate              | Inbound dropped unless `event.source === iframe.contentWindow` (sibling-iframe spoofing has the same `origin: "null"` — only the Window reference is authentic).                                                                              | `transport.ts` / `inner-transport.ts`                              |
| transport channel gate               | Per-handle 122-bit CSPRNG channel id; inbound with wrong id dropped.                                                                                                                                                                          | `transport.ts` / `inner-transport.ts`                              |
| transport phase gate                 | Outbound + inbound gated on `BlockFramePhase.Mounted`; `Paused` (offscreen) drops both directions (no queueing).                                                                                                                              | `transport.ts`                                                     |
| payload-size cap                     | Default 256 KiB per message (`BLOCK_FRAME_DEFAULT_MAX_PAYLOAD_BYTES`); JSON-length × 2 byte proxy; outbound + inbound dropped + counted by `BlockFrameDropReason`.                                                                            | `transport.ts` / `inner-transport.ts`                              |
| inbound rate-limit (host-side)       | Default 1000/s per transport (`BLOCK_FRAME_DEFAULT_MAX_INBOUND_PER_SECOND`); sliding window, charged only after the security gates accept; over-limit dropped + counted.                                                                      | `transport.ts`                                                     |
| static `iframe.src` guard            | Repo-wide TS-AST scan: `<iframe src=>` JSX, `iframe.src = ...` assignment, `iframe.setAttribute("src", ...)` are CI errors anywhere in `apps/`, `packages/shell/src/`, `packages/sdk/src/`. Escape hatch: `// iframe-src-exempt` per call site. | `tools/mcp-server/src/tools/iframe-src-check.ts`                   |
| inner-frame helper                   | `createBlockFrameInnerTransport({expectedChannelId, expectedEntityId, ...})` — the symmetric block-side primitive (subpath `@brainstorm/sdk/block-frame/inner`). Mirrors host's identity/channel/entity/direction/size gates.                  | `inner-transport.ts`                                               |

What 9.5.x **does not** ship — deferred forward:

- **Real-Chromium opaque-origin proof** + real sibling-iframe spoofing test: needs Playwright (plan rung 13.3). jsdom does not enforce iframe sandbox / opaque origin; the in-suite tests pin the contract, the Playwright sibling verifies enforcement.
- **Capability enforcement itself**: the transport carries the capability list in the Startup envelope but does NOT gate calls — the broker is the authoritative gate (9.4.4 mount seam wires this).
- **BP protocol semantics**: 9.3.3 (Block Protocol conformance + Hook handlers). The transport is the secure pipe; the BP wire format on top of `BlockFrameMessageKind.Message` payloads is opaque to it.

## External web embeds — the embed-block family *(B11.20a design, 2026-08-02)*

Besides the two internal mechanisms above there is a third, narrower composition case: **content that lives on someone else's servers** — a YouTube video, a map, a Figma file — pasted into a document as a URL. This section is the design for that family: the provider catalogue, its tiers, the insertion surface, and the privacy/fallback posture. The security envelope (why embeds are dangerous, the embed sandbox, `network.embed:<provider>`) is owned by [38-network-and-proxy.md §Embeds](../security/38-network-and-proxy.md); this section owns the product shape. Anytype's ~30 embed processors are the reference ceiling — we deliberately start small and tier up.

### What exists today (as-shipped baseline)

- `classifyUrl` (`packages/editor/src/plugins/embed-providers.ts`) — a pure URL→provider classifier. Allowlisted providers map a watch/share URL to the provider's official embed endpoint; **everything else degrades to a bookmark card**, so the renderer never iframes an arbitrary origin. Shipped providers: **YouTube** (via `youtube-nocookie.com`), **Vimeo**, **Loom**, **Figma**, **CodeSandbox**.
- `WebEmbedNode` — the Lexical node rendering the `<iframe>` (`sandbox` minimal, `referrerpolicy="no-referrer"`, re-classifies its persisted URL on render so a hand-edited doc can't smuggle an arbitrary origin past the allowlist). ⚠️ Two diverging copies exist (`packages/editor/src/nodes/` and `apps/notes/src/editor/nodes/`) — consolidation is part of the build rung.
- Reachable from the **Notes palette only** (`block.embed.bookmark`) + the paste-a-lone-URL path. Journal/Tasks/Bookmarks hosts cannot insert one.
- Doc 38's `network.embed:<provider>` capability and default click-to-load are **designed but not enforced** — the iframe mounts directly from the app renderer (marked `iframe-src-exempt`) and loads on render.

### Provider catalogue and tiers

One block, many providers: the family stays **one node type + one classifier** — adding a provider is a new `classifyUrl` branch + a catalogue row, never a new node. Local *processor* blocks (equation today; Mermaid/Graphviz if ever) render with **no network** and are explicitly out of this family.

| Tier | Providers | Posture |
|------|-----------|---------|
| **1 — shipped** | YouTube (`youtube-nocookie`), Vimeo, Loom, Figma, CodeSandbox | Keep; retrofit click-to-load (below). |
| **1b — B11.20b builds** | **Google Maps** (`google.com/maps`/`maps.google.com` place/search/`@lat,lng` URLs → keyless `output=embed` endpoint; `maps.app.goo.gl` short links classify as bookmark — resolving them needs network the classifier must never have), **OpenStreetMap** (`export/embed.html?bbox=…` — the privacy-friendly sibling, no cookies) | Maps has **no** no-cookie variant → click-to-load is mandatory for it, not optional. |
| **2 — next** | X/Twitter (snapshot/link-preview only, per doc 38), Spotify, SoundCloud, GitHub Gist, CodePen, Miro | Each needs a privacy-posture row in doc 38 before shipping. |
| **3 — long tail (toward the Anytype set)** | Twitch, Sketchfab, Canva, Telegram, Bilibili, Google Drive/Docs, Airtable, Typeform, … | Only on demand; Instagram/Facebook likely **never** (embed endpoints are login/tracking-hostile). |

Per-provider metadata the catalogue carries: accepted URL shapes → embed endpoint mapping (tracking params stripped), default **aspect ratio** (video 16:9; Maps/OSM 4:3; Figma/CodeSandbox 3:2 tall), and **load policy** (click-to-load default per doc 38's OQ-164 leaning; a provider with no cookie-free endpoint is click-to-load always).

### Insertion surface (pairs with B11.19 sections)

- **Paste a lone URL** → auto-classify, insert the right block (shipped behaviour, kept).
- **Slash menu**: the generic **Web embed / Bookmark** command moves from the Notes-only set into the **shared catalogue** under the Embeds section, so Journal/Tasks/Bookmarks palettes can opt in. The **v1 providers get first-class rows** (YouTube, Google Maps) — same insertion path, provider-specific label/icon/keywords and a pre-configured URL prompt — so `/youtube` and `/maps` behave the way users arriving from Notion/Anytype expect. Tier-2+ providers ride the generic command's keywords first and are promoted to their own row only with evidence of use (the Embeds section must not become 30 rows of noise on day one).

### Fallbacks (offline / export / not-embeddable)

- **No network / not yet clicked**: the block renders a local placeholder card — provider glyph, best-effort title from the URL, the URL itself — never a spinner.
- **Export**: MD → the plain URL; HTML → an anchor (never the iframe); PDF → the placeholder card. An embed must never make an export hang on a remote fetch.
- **Unclassifiable / de-allowlisted URL**: bookmark card (shipped behaviour, kept).

### Build rung (B11.20b) checklist

Google Maps + OpenSteetMap branches in `classifyUrl` (pure, exhaustively unit-tested) · shared-catalogue surfacing + provider rows · click-to-load facade retrofit across tier 1 · consolidate the two `WebEmbedNode` copies into `@brainstorm/editor` · per-provider aspect ratios · doc 38 provider table updated in the same PR.

## Summary

- **Lexical custom nodes** = vocabulary inside the prose stream. Lives in the document's Yjs fragment. Cursor flows through.
- **Block Protocol embeds** = references to standalone things. Lives as `(blockId, entityId)` in the document; underlying content is its own Yjs doc. Cursor jumps over.
- **The bridge** is one Lexical node type — `BlockEmbedNode` — that turns a reference into a mounted iframe.
- **The criterion** is whether the cursor flows through.
- **The substrate** is Yjs, both sides.
- **The sandbox** is the 9.5 primitive — every BP embed runs through it; the static `iframe-src-check` guard ensures nothing in the repo opens a non-opaque iframe by accident.
