# 31 — Linking protocol

This doc defines a **unified, extensible link protocol** across Brainstorm. The linking pain in prior tools motivates this: links in the editor are plain text-shaped, can't reference content in different spaces, can't link to chat messages, can't link to specific blocks within an entity. Brainstorm needs **one link concept** that spans all of these and survives concurrent edits.

It builds on [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) (Block Protocol link entity types as the substrate), [07-editing-lexical.md](../editing/07-editing-lexical.md) (Lexical link nodes), [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md) (BlockEmbedNode), [17-interoperability.md](17-interoperability.md) (`intent.open` accepts URIs), [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (cross-space access semantics), and [22-ai-foundations.md](22-ai-foundations.md) (AI-generated links use the same scheme).

## What went wrong in prior tools

- **Plain-text links.** Editor links rendered as flat URL-shaped strings; no structured target other than entity-id-or-URL. Couldn't link to a paragraph, a row, a comment.
- **Single-space scoping.** Links across spaces required out-of-band sharing or didn't work at all.
- **No link-to-chat / link-to-message.** Conversational content couldn't be referenced from documents.
- **No link-to-block.** A document might embed a kanban board, but linking to "this card on the kanban inside this doc" wasn't first-class.
- **Anchor instability.** Links pointing at sub-document positions broke when the document was edited (byte-offset anchors).
- **External URLs treated separately.** Native `https://` URLs lived in a different conceptual space than internal references.

Brainstorm's response: **one URI scheme, capability-aware, encryption-aware, anchor-stable across CRDT edits**, used uniformly for cross-entity refs, sub-entity refs, cross-space refs, block refs, ephemeral refs (chat, awareness), and external URLs.

## Principles

1. **One scheme.** Every internal target is addressable via a `brainstorm://` URI. External URLs are also valid (passed through). No parallel addressing systems.
2. **Extensible.** New target kinds can be added without breaking the scheme. Apps register handlers per path prefix.
3. **Anchor-stable across edits.** Sub-entity targets use Yjs `RelativePosition` (CRDT-aware), not byte offsets. A link to "the third paragraph" survives concurrent edits that insert paragraphs above it.
4. **Capability- and encryption-aware.** Following a link runs the standard access path; capability prompts apply; an unreachable target (insufficient access, encrypted to a key the user doesn't hold) shows a fallback rather than leaking metadata.
5. **Round-trippable.** Links survive copy-paste through OS clipboard, drag-and-drop, message send, and external sharing without corruption.
6. **Personal-by-default.** Annotations attached to links (titles, comments) are user-scoped by default; promotable.

## The URI scheme

```
brainstorm://<authority>/<path>[?<query>][#<fragment>]
```

- **`<authority>`** — what kind of target. Curated by the shell (per OQ-30's intent-namespace decision; same model). Apps cannot invent new authorities.
- **`<path>`** — addresses within the authority's namespace.
- **`<query>`** — optional parameters for resolution (e.g. preferred handler).
- **`<fragment>`** — sub-target (anchor) within the resolved entity, if applicable.

### Curated authorities

| Authority           | Path shape                                                      | What it addresses                                  |
|---------------------|-----------------------------------------------------------------|----------------------------------------------------|
| `entity`            | `/<entity-id>`                                                  | A full entity.                                     |
| `entity/block`      | `/<entity-id>/<block-cell-id>`                                  | A specific block (cell) within an entity's layout. |
| `entity/property`   | `/<entity-id>/<property-name>`                                  | A property value of an entity.                     |
| `entity/anchor`     | `/<entity-id>/<property-name>/<anchor-id>`                      | A position inside a property's rich-text fragment. |
| `space`             | `/<space-id>`                                                   | A space (org-level; v2). Entry point.              |
| `space/entity`      | `/<space-id>/<entity-id>`                                       | A space-qualified entity (cross-space link).       |
| `vault`             | `/<vault-id>`                                                   | A vault (mostly UI; cross-vault is v2).            |
| `vault/entity`      | `/<vault-id>/<entity-id>`                                       | A vault-qualified entity.                          |
| `chat`              | `/<thread-id>/<message-id>`                                     | A chat message in a thread (when chat exists). v2. |
| `query`             | `/<query-id>`                                                   | A saved query / smart-folder reference.             |
| `intent`            | `/<verb>?...`                                                   | A "do this" link — opens the launcher / dispatches an intent. |

Examples:

```
brainstorm://entity/ent_01HXKMZ                              ← link to a Note
brainstorm://entity/block/ent_01HXKMZ/header                ← link to its "header" block-cell
brainstorm://entity/anchor/ent_01HXKMZ/body/p3              ← link to a position inside its body
brainstorm://space/entity/spc_engineering/ent_01HXM0R       ← cross-space link (v2)
brainstorm://chat/thr_design/msg_4                          ← link to a chat message (v2)
brainstorm://query/qry_my_open_tasks                        ← link to a saved query
brainstorm://intent/process?kind=summarize&entity=ent_X    ← intent link
https://example.com/...                                     ← external URL, passed through
```

> **Decision:** authorities are **curated** (shell-defined). New authorities require a shell release. Apps that want app-specific addressing use `intent` URIs (e.g. `brainstorm://intent/open?app=io.example.tasks&payload=...`).

> **Decision:** there is **no** `entity/v1` versioning in the URI. Entity ids are stable across entity-type-version bumps.

## Anchor stability

The hard part: linking to "the third paragraph" of a Yjs-backed rich-text document such that the link survives concurrent edits inserting/removing paragraphs above it.

> **Decision:** sub-entity anchor ids are **Yjs `RelativePosition` tokens**, base64url-encoded. Yjs's `RelativePosition` is CRDT-aware: it identifies a position relative to a CRDT operation (a specific character/element insertion), not by absolute offset. The position survives any operation that doesn't directly affect that anchor.

Concretely: when the user clicks "Copy link to this paragraph" in the editor:

1. Lexical's selection is mapped to a position in the underlying `Y.XmlFragment`.
2. The Y.Doc's `createRelativePosition` produces a `RelativePosition` token.
3. The token is encoded into the URI as the `anchor-id`.

When the link is followed:

1. The shell resolves the entity, opens it.
2. The Y.Doc's `createAbsolutePositionFromRelativePosition` converts the token back to a current position.
3. The editor scrolls to / highlights that position.

If the target was removed (the paragraph deleted), the `RelativePosition` resolves to `null`. The opener falls back to scrolling to a nearby position (per Yjs's `findClosestPosition`) and showing "the linked content has been removed" inline.

> **Decision:** anchor tokens are **opaque**. Apps don't generate or inspect them; the SDK provides `links.createAnchor(yfragment, position)` and `links.resolveAnchor(yfragment, anchorId)`. This isolates apps from Yjs internals.

> **Open:** anchor tokens encode internal Yjs structure; their format may change across Yjs versions. We pin Yjs version per [13-frontend-stack.md](../shell/13-frontend-stack.md) and migrate anchors at Yjs-major upgrades. Tracked as OQ-124.

## Resolution

Following a `brainstorm://` URI is mediated by the shell's **link resolver**:

```
   1. Parse URI → authority + path + query + fragment
   2. Look up authority handler (curated registry)
   3. Resolve target identity (entity id, block-cell id, etc.)
   4. Capability check:
      - Does the user have access to the entity (per access record)?
      - Does the calling app have read capability for the entity's type?
      - For cross-space links: is the user in the space?
   5. If yes: load the entity; find the anchor (if applicable); dispatch intent.open
   6. If no: render "unavailable" fallback with explanation
```

Resolution is **always shell-mediated**. Apps do not parse `brainstorm://` URIs themselves; they call `brainstorm.services.links.resolve(uri)` and receive a structured result or a typed failure.

> **Decision:** the link resolver is the **single point** for cross-app navigation. Cross-app intent dispatch (per [17-interoperability.md](17-interoperability.md)) is layered on top — `intent.open` with a URI payload routes through the link resolver first.

### Failure modes (no metadata leak)

When a link's target is unreachable, the user sees one of these — and the resolver returns the same generic "unavailable" status to the calling app:

- **Target not in this vault** — vault-qualified link, but this device doesn't have the vault registered.
- **Target in a space you can't access** — cross-space link, user not in the space (v2).
- **Target encrypted to a key you don't have** — user is in the space but doesn't have the entity's DEK wrap (rare; recently rotated and not yet propagated).
- **Target deleted** — entity is soft-deleted or hard-deleted.
- **Target's app uninstalled** — fallback renderer (per [03-app-model.md](../apps/03-app-model.md)) handles display.

> **Decision:** failure messages **do not leak metadata** — the user sees "you don't have access" or "the link is unavailable", not "the entity is `ent_01HXM0R` and lives in space `spc_finance`". Like the conventional 404-vs-403 distinction; we always say "unavailable" externally and let audit-log entries record the actual reason for diagnostics.

## How rich text uses links

Per [07-editing-lexical.md](../editing/07-editing-lexical.md), Lexical has a built-in link node. In Brainstorm, that node's `href` is a `brainstorm://` URI (or external URL). The renderer:

- Internal URIs → mounted with the link resolver; click opens via `intent.open`; hover shows a preview card sourced via `intents.suggest({ verb: "quick-look", payload: { uri } })`.
- External URLs → standard browser-link behavior; click opens via the OS handler.

For block-level embeds (per [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md)), the `BlockEmbedNode`'s `(blockId, entityId)` pair is **also** representable as a `brainstorm://entity/block/...` URI. Block embeds and block links are isomorphic; the difference is whether they render inline (link) or mount the block (embed).

## Cross-space and cross-org

> **Decision:** cross-space links use the `space/entity` authority. Resolution requires the user to be a member of the destination space (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)). The link itself is not a credential; it's an *address*.

A common case: a user with a personal vault and an org membership has links from a personal note to an org document. The resolver:

1. Parses `brainstorm://space/entity/<spc>/<ent>`.
2. Checks the user's space memberships (loaded from the org identity per [16](../security/16-identity-orgs-encryption.md)).
3. If member: opens the org-side entity (which may live in a different vault context entirely if the org is hosted elsewhere).
4. If not member: "unavailable" fallback.

> **Open:** can a personal-vault link to an org-vault entity work *across vault registry boundaries*? Today's design has one open vault per shell window; cross-vault navigation requires opening the other vault. v2 may unify. Tracked as OQ-125.

## Linking to chat messages (v2)

Per [22-ai-foundations.md](../platform/22-ai-foundations.md) (AI as foundational), conversation is one of five AI surfaces. Chat is therefore a foundational concern even if the chat app ships post-v1. The URI scheme provides for it:

```
brainstorm://chat/<thread-id>/<message-id>
```

When chat lands:
- Threads are entities (probably `brainstorm/ChatThread/v1`).
- Messages are entities or sub-entities of threads (probably `brainstorm/ChatMessage/v1`).
- The chat app registers as opener for both types.
- Linking to a message uses the URI; resolving navigates the chat app to that message.

> **Decision:** chat is post-v1; the URI authority is reserved now so post-v1 chat doesn't break the linking model.

## Sharing links externally

A user copying a link to share with another user (or to paste in another app):

> **Decision:** `brainstorm://` URIs are valid in OS clipboard and across app boundaries. Pasting outside Brainstorm shows the URI as text (with whatever the host app does with unknown schemes). Pasting back into Brainstorm reattaches the structured link.

For cross-user / cross-device sharing, the URI is one half of the story; the *grant* (DEK wrap) is the other. Sharing flow:

1. User clicks "Share entity" → produces a URI **and** an access-grant record (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)).
2. Recipient pastes the URI; their device tries to resolve.
3. If they don't have access yet, the URI's resolution requests the grant from the sender's device (peer-to-peer or via relay).
4. Once the grant arrives, resolution succeeds.

> **Decision:** the URI itself is **not** a capability. It's an address. Access still flows through the access-record + DEK-wrap mechanism. This separation lets users share URIs publicly (e.g. paste into a tweet) without leaking the data — only the address.

## Links as entities (link annotations)

A user wants to annotate a link with a comment, a tag, a custom title. Brainstorm models this through the existing entity machinery:

> **Decision:** a **link** appearing in rich text is just a Lexical link node — no entity required. A **link annotation** (comment, tag, custom title beyond the URI's resolved-name default) is a `brainstorm/LinkAnnotation/v1` entity referencing the URI plus user-added properties.

This means:
- Links in prose are cheap (just nodes in a Y.Doc).
- Annotated links are first-class entities, syncable, scope-able, layered.
- A link can be annotated by multiple users independently (their personal annotations don't conflict; annotations promoted to org scope appear for everyone).

> **Open:** does a LinkAnnotation entity participate in the layout/property overlay system? Probably yes — same as any entity. Tracked as OQ-126.

## Capability surface

New capabilities (per [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) naming convention):

- `links.resolve` — granted by default to all apps. Required to call the resolver.
- `links.create` — granted by default. An app can create URIs for content it has access to.
- `links.dispatch:<authority>` — granted by default for `entity` and `intent`; broader scopes (`*`) require explicit grant.

The resolver itself enforces **per-target** capabilities at resolution time (not at link-creation time). Creating a link to an entity the user doesn't have access to is a no-op (returns `null`); the link-text remains in the prose but resolves to "unavailable."

> **Decision:** apps cannot leak access through URI creation. The resolver is the gate.

## Link previews and the "linkrot" problem

> **Decision:** link previews (hover-card / inline-snippet) are sourced via `intent.quick-look` with the URI as payload. The opener is the entity's primary handler. This means previews respect the user's app choices and capability grants without special-case code.

For external URLs, preview is opt-in per app — fetching `https://...` for preview requires the network capability. By default, external URLs have no preview (just the displayed link text).

For internal URIs, "linkrot" (target deleted, type changed) is handled by the resolver's failure modes. The link node remains in the Y.Doc; it just renders as "unavailable" with the reason. Users can audit broken links across their data via a "broken links" launcher query.

> **Open:** should the shell maintain a passive **link integrity index** that tracks links and their target reachability, surfacing a "5 broken links across your data" badge? Useful but adds storage. Tracked as OQ-127.

## Performance

| Scenario                                       | Mitigation                                                           |
|------------------------------------------------|---------------------------------------------------------------------|
| Resolving 100 links in a hover-rich page       | Resolution is sub-ms (entity lookup); previews lazy-load.            |
| Anchor token computation in long doc           | `RelativePosition` is O(log n) for typical Yjs tree shapes.          |
| Following a cross-space link not yet pulled    | Pull the entity on-demand; show loading state for ~500ms.            |
| Bulk URI rewrite (e.g. moved entity)           | Not needed — URIs are entity-id-based; ids don't change on move.      |

## What this is **not**

- **Not a separate identity layer.** Sharing access is still per-entity DEK-wrap (per 16). URIs are addresses.
- **Not a permalink service.** No URL shortener; no off-platform redirect. URIs are valid for the lifetime of the entity / vault registry.
- **Not opinionated about external URLs.** `https://...` is passed through; the OS or an installed app handles it.
- **Not a graph database.** Entity-to-entity edges are `entityRef` properties (per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md)) and BP link entity types (per [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md)). Links in rich text are different — ephemeral references in prose, not first-class data edges.

## Cross-doc updates needed

- [07-editing-lexical.md](../editing/07-editing-lexical.md) — Lexical link nodes use `brainstorm://` URIs; cross-link to this doc.
- [15-embedding-and-composition.md](../editing/15-embedding-and-composition.md) — `BlockEmbedNode`'s `(blockId, entityId)` pair is isomorphic to a `brainstorm://entity/block/...` URI; cross-link.
- [17-interoperability.md](17-interoperability.md) — `intent.open` accepts a URI payload alongside the structured payload; document.
- [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) — note that BP link entity types are the *data* substrate; this doc is the *navigation* substrate.
- [22-ai-foundations.md](../platform/22-ai-foundations.md) — AI-extracted links use `brainstorm://`.
- [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) — share-flow produces URI + access grant.
- [04-shell.md](../shell/04-shell.md) — launcher accepts URIs as input.

## Phasing

| Capability                                       | v1   | v2  |
|--------------------------------------------------|------|-----|
| `brainstorm://` scheme defined                   | ✓    | ✓   |
| Authorities: `entity`, `entity/block`, `entity/property`, `entity/anchor`, `vault`, `vault/entity`, `query`, `intent` | ✓ | ✓ |
| Authorities: `space`, `space/entity`, `chat`     | reserved | ✓ |
| Anchor stability via Yjs `RelativePosition`      | ✓    | ✓   |
| Link resolver (capability + access checked)      | ✓    | ✓   |
| Failure modes (no metadata leak)                  | ✓    | ✓   |
| Lexical link nodes use the scheme                | ✓    | ✓   |
| Hover preview via `intent.quick-look`             | ✓    | ✓   |
| Round-trippable through OS clipboard              | ✓    | ✓   |
| `LinkAnnotation` entity type                     | ✓    | ✓   |
| Cross-space resolution                           | —    | ✓   |
| Chat message linking                             | —    | ✓   |
| Cross-vault link resolution                      | —    | ✓ (post-OQ-125) |
| Link integrity index                             | —    | ✓ (post-OQ-127) |

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-124** — Anchor token format compatibility across Yjs major versions; migration policy.
- **OQ-125** — Cross-vault link resolution (today vault is per-shell-window; cross-vault navigation requires switching).
- **OQ-126** — `LinkAnnotation` participation in layout/property overlays.
- **OQ-127** — Passive link integrity index (broken-link tracking) — useful but adds storage.

## Summary

- **One URI scheme** `brainstorm://<authority>/<path>` with curated authorities. External `https://` URLs pass through.
- **Authorities** cover entity, block-within-entity, property, sub-entity anchor, space, vault, chat, saved query, intent — extensible by shell release.
- **Anchor stability** uses Yjs `RelativePosition` tokens — sub-entity links survive concurrent edits.
- **Resolver mediates everything** — single point for capability + access checks; uniform failure mode without metadata leak.
- **Capability- and encryption-aware** — URIs aren't credentials; access flows through the access-record / DEK-wrap mechanism.
- **Lexical link nodes use the scheme** — same model for in-prose and cross-app references.
- **Block embeds and block links are isomorphic** — same target, different rendering.
- **Annotations are entities** (`LinkAnnotation/v1`); plain links are just Lexical nodes.
- v1 ships full resolver + entity / block / anchor authorities; v2 adds space, chat, cross-vault.
