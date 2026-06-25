# 65 — Object selection and cross-app drag-and-drop

Users expect to **select objects** in one app and **drag them into another** — a row from the database onto a kanban card, three notes into a collection, a file into a chat composer, a contact onto a calendar day. On a real desktop OS this is the connective tissue between apps. Brainstorm models itself as a desktop OS, so it owes the same affordance.

This doc analyses the problem end-to-end and proposes the architecture. It is deliberately exhaustive because the feature is **deceptively hard**: a drag that begins in one app and ends in another crosses Brainstorm's *hardest* boundary — the cross-app process/sandbox boundary that is the whole security model ([OQ-4](../reference/11-open-questions.md), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)). The naïve "HTML5 drag-and-drop just works" assumption baked into [17-interoperability.md §Drag-and-drop](17-interoperability.md) is **false for the cross-app case**, and most of this doc exists to explain why and what to do instead.

It refines [17-interoperability.md](17-interoperability.md) (which sketched the MIME-type idea), and connects to [31-linking-protocol.md](31-linking-protocol.md) (`brainstorm://` references), [63-action-surface.md](63-action-surface.md) (where drop targets and selection-aware actions overlap), [57-open-resolution.md](57-open-resolution.md), and [21-objects-and-collections.md](../data/21-objects-and-collections.md) (membership semantics of a drop).

## Implementation status (2026-06-23)

`DND-1`–`DND-5` shipped; `DND-6` partial. The shell-mediated spine is live: the
`selection` and `dnd` broker services, the transparent click-through ghost
overlay (OQ-DND-1 → option (a)), the preload `app:drag-over/leave/drop`
forwarder, and the `@brainstorm/sdk/object-dnd` `useDragSource` / `useDropTarget`
primitives. The drop registry now **rect-hit-tests** the within-window point
against each target's element (a `dropRef` the consumer attaches), so multiple
positioned drop zones in one window (Calendar days, Files folders, board
columns) route by cursor position — superseding the original "v1 is window-level,
not sub-region rect-scoped" limitation; a target that attaches no `dropRef`
stays window-level (the Notes editor). Native intra-renderer DnD is retained;
the pointer-vs-native conflict on a shared element is resolved by a dedicated
**grip** (Database rows, Files entries) whose `suppressNativeDragRef` neutralises
the row's native `draggable` for the gesture. App rollout: Database rows-as-source
+ board-column set-property/membership, Calendar day-cell date-set, Files
source-grip + folder/tree membership-add, Notes editor reference target. Scope D
(`DND-5`): `dnd.exportFile` materialises the renderer-supplied (decrypted) bytes
to a sanitised temp path and hands the OS drag to `webContents.startDrag`. The
keyboard twin `DND-6` ships the AddMembership isomorph ("Add to collection…")
via the shared object menu (Notes + Database); the Move/Link twins follow the
action surface ([63](63-action-surface.md)). **Real-shell gate remaining:** the
pointer-drag gesture across windows (OS pointer-capture loss) and the
`startDrag`-during-`dragstart` latency for large files want a live dogfood pass.

## Principles

1. **A drag transfers a *reference*, never content.** The thing that moves between apps is an object identity (`entityId` + type + a display label), not the object's properties or its rich-text body. The receiving app resolves the reference through the entities service with its *own* capabilities. This preserves the encryption boundary (per [17 Principle 5](17-interoperability.md)) — ciphertext never crosses an app boundary, and a malicious drop target learns only what it could already query.
2. **The drop target decides the meaning.** The source says "here is object X." The target decides whether that becomes a link, a transclusion, a row, a collection member, a reschedule, or nothing. The same dragged object means different things dropped in different places. The source never dictates the effect.
3. **Within a renderer, the platform's native drag is fine. Across renderers, the shell must mediate.** Intra-app drags ride HTML5 DnD as they do today. Cross-app drags *cannot* — they need a shell-brokered drag session (the central finding of this doc, §"Why cross-app is hard").
4. **Degrade outward, enrich inward.** A drag leaving Brainstorm for another desktop app carries only standard MIME (`text/plain`, `text/uri-list` as a `brainstorm://` deep link). A drag landing inside Brainstorm carries the structured reference.
5. **Every drag has a keyboard and pointer-free equivalent.** Drag-and-drop is never the *only* way to perform an operation. "Move to…", "Add to collection…", cut/paste, and the action surface ([63](63-action-surface.md)) cover the same ground for keyboard and screen-reader users (per [35-code-conventions.md §Keyboard](../foundations/35-code-conventions.md)).
6. **One selection model, one drag payload.** Selection math and the drag wire-format are shared SDK primitives, not per-app reinventions. Apps differ only in *what* is selectable and *what* a drop does.

## Part I — Current state (what exists today)

### Selection

Selection is already partly unified around a shared primitive, with per-app state containers on top.

- **`@brainstorm/sdk/selection`** — pure multi-select math: `computeRange()`, `toggleId()`, `modifierFromEvent()`, `SelectionModifier` (None / Range / Toggle). This is the single source of shift/cmd-click semantics. Database rows, Files content pane, and Graph nodes all use it.
- **Per-app state** — Database holds a mutable `Set<id>` + anchor; Files a frozen reducer; Graph a `Set` + anchor; Whiteboard a selection set inside its imperative engine. Same *math*, different *storage*. This is acceptable (the math is what must agree) but should be acknowledged.
- **Editor selection** is its own world: `block-selection-store.ts` (anchor/focus + `selectedKeys`), `block-selection-plugin.tsx` (mouse + keyboard chords), `marquee-plugin.tsx` (rubber-band). It is block-granular and DOM-class-driven for performance.
- **`@brainstorm/sdk/a11y`** — `useCompositeKeyboard()` + `SelectionAttribute` give roving-focus listbox/grid/tablist keyboarding with the right `aria-selected`/`aria-checked` wiring.

**Designed but not built:** [17 §Selection](17-interoperability.md) specifies a `selection.publish()` / `selection.current()` host service so the shell knows "what is the focused app's selection" for selection-driven intents. **No such service exists in the broker today.** This is a gap §Part IV closes.

### Drag-and-drop

Every drag that works today is **intra-app** (source and target in the *same* renderer):

| Surface | Mechanism | Scope |
|---|---|---|
| Editor blocks (Notes) | marquee + block-selection, `application/x-brainstorm-blocks` clipboard | within one editor |
| Database grid/board columns | `@dnd-kit/sortable` | within the view |
| Database rows / cards | HTML5 `application/vnd.brainstorm.entity+json` | within the app |
| Tasks lists | hand-rolled HTML5 `wireListDnd` | within a list |
| Files content list + sidebar tree | HTML5 `application/vnd.brainstorm.entity+json`; Alt = copy | within the app |
| Bookmarks tag board | HTML5 entity MIME | within the board |
| Form-designer fields | custom `application/x-bs-form-field` | within the builder |
| Whiteboard / Graph | imperative pointer-capture (no HTML5 DnD) | within the canvas |
| Notes editor as a *drop target* | `entity-drop-plugin.tsx` reads the entity MIME → Mention (plain) / Transclusion (Alt) | source must be same renderer |

The shipped entity-drag contract (`packages/sdk/src/entity-drag.ts`, B11.8):

```ts
const ENTITY_DRAG_MIME = "application/vnd.brainstorm.entity+json";
type EntityDragPayload = { entityId; entityType; label; iconRef? };
```

It is hardened (strips C0/bidi/zero-width controls, length-clamps, `text/plain` fallback) and **single-entity**.

**The cross-app drag is explicitly unimplemented.** `apps/notes/.../entity-drop-plugin.tsx` notes that a drag originating outside the editor's own renderer "is NOT covered (follow-up: needs shell-brokered channel)." That follow-up is this doc.

### Why the doc-17 design doesn't ship as written

[17 §Drag-and-drop](17-interoperability.md) asserts:

> The shell does not need to mediate during a drag — the renderers handle it via Electron's native drag/drop.

This is **only true within a single renderer**. It does not hold across apps, and it diverged from the implementation in two ways:

1. **MIME mismatch.** Doc 17 specifies `application/x-brainstorm-entity` = `{ entityIds: string[], sourceApp }` and `application/x-brainstorm-blockprotocol`. The code ships `application/vnd.brainstorm.entity+json` = `{ entityId, entityType, label, iconRef? }` (single, no `sourceApp`). §Part IV reconciles these.
2. **Process boundary.** The "native DnD just works" claim is the load-bearing error. §Part II is the correction.

## Part II — Why cross-app is hard

### The boundary a cross-app drag crosses

Per [OQ-4](../reference/11-open-questions.md): **each app runs in its own renderer process**; all of one app's windows share that renderer, but two *different* apps never do. Tabbed windows use `WebContentsView`, one per tab. Cross-app isolation is *the* security boundary.

HTML5 drag-and-drop — `dragstart`, `dragover`, `drop`, and the `DataTransfer` object with custom MIME types — is **scoped to a single web contents**. Chromium does not serialize a `DataTransfer` across renderer processes or across top-level windows. So:

- A drag *within* Notes (list → editor, same renderer): native DnD works. ✅ (this is what ships today)
- A drag from Database (renderer A) to Notes (renderer B): the `drop` in B fires with an **empty** custom-MIME `DataTransfer`. Brainstorm's payload never arrives. ❌

The only native cross-window/cross-process drag channel Electron exposes is **`webContents.startDrag({ file | files, icon })`** — an OS-level drag that carries **files and an icon, nothing else**. It cannot carry `application/vnd.brainstorm.entity+json`. (It is still useful for the *drag-a-file-out-to-Finder* case, §Part V.)

> **Decision:** cross-app drag-and-drop is **shell-mediated**, not native. The shell runs a *drag session*: it tracks the pointer, owns the drag-ghost overlay, hit-tests the target window via the window index, negotiates the drop with the target app over the broker, and transfers the (reference-only) payload. Native HTML5 DnD is retained **only** for intra-renderer drags. This directly overrides the "shell does not mediate" line in [17 §Drag-and-drop](17-interoperability.md).

### What the shell already has to make this possible

- **`WindowIndex`** (`main/window/window-index.ts`) — a live map of every app window's `bounds` (x/y/w/h), `monitorId`, state, focus, sorted by recency; plus monitor topology with work-areas. This is the hit-testing substrate: given a screen point, the shell can resolve *which window (which app)* is under the cursor. It is shell-privileged — apps cannot enumerate other windows, which is exactly the property we want (the source app must not learn the geometry of others).
- **The broker + envelope + capability ledger** (`ipc/broker.ts`, `ipc/envelope.ts`, `capabilities/ledger.ts`) — every app↔shell message is an authenticated, capability-checked, fail-closed envelope with an unforgeable preload-stamped `app` id. A drag session rides this.
- **Shell→app broadcast channels** (`app:intent`, `app:vault-entities-changed`, `brainstorm:app-visibility`) — the existing pattern for the shell pushing events into app windows. Drop-target notifications use the same shape.
- **Intents** ([17](17-interoperability.md)) — the async, shell-routed cross-app request bus. A completed cross-app drop is, semantically, an `insert`/`open`/`compose` intent with a drop location. Cross-app DnD is best understood as **a direct-manipulation front-end to the intents bus**, not a parallel system.

## Part III — Conceptual model

### What is a draggable object

The unit of transfer is an **object reference**, the shipped payload generalised to multi-select and tagged with provenance:

```ts
type ObjectDragItem = {
  entityId: string;
  entityType: string;   // type URL, e.g. "io.brainstorm.note/Note/v1"
  label: string;        // resolved title, captured at drag start (hardened)
  iconRef?: string;     // emoji glyph / icon name for faithful ghost rendering
};

type ObjectDragPayload = {
  v: 1;
  sourceApp: string;    // stamped by the shell from the drag session, not app-provided
  items: ObjectDragItem[];
};
```

This is **not** the whole entity. The receiving app gets identities and a label to render an affordance; it fetches anything more through `entities.get()` under its own `entities.read:<type>` capability. If it lacks the capability, the drop degrades to a non-resolving chip or is refused.

Non-entity drags (raw files into a composer, an editor block fragment) are separate payload kinds carried on the same session (`FileDragPayload`, `BlockFragmentPayload`), negotiated by MIME the same way.

### What is selection

Selection is the *set of objects a drag would carry if it started now*. Unifying it (§Part IV) means: any app can answer "what do you have selected" in the shared `ObjectDragItem[]` shape, which is exactly the drag payload's `items`. Selection and drag are the same data at rest vs. in motion.

### The four drag scopes

| Scope | Source → Target | Transport | Status |
|---|---|---|---|
| **A. Intra-surface** | within one list/canvas/editor | native HTML5 / pointer | ✅ ships per-app |
| **B. Intra-app cross-window** | two windows of the *same* app | **shared renderer** → native HTML5 still works | ⚠️ untested; should work |
| **C. Cross-app** | app A renderer → app B renderer | **shell-mediated drag session** | ❌ this doc |
| **D. Outbound / inbound OS** | Brainstorm ↔ Finder/browser/other app | `webContents.startDrag` (out, files); OS file-drop (in) | ❌ §Part V |

Scope C is the hard one and the rest of Part IV is about it. Scope B is worth a regression test — because an app's windows share a renderer (OQ-4), native DnD *should* survive a window-to-window drag, but only if both windows are in the same `WebContents`; tabbed `WebContentsView`s of one app are *separate* web contents and therefore behave like scope C even within one app. **Conclusion: tab-to-tab is mediated even inside one app.**

### Drop semantics — the meaning matrix

What a dropped object *becomes* is the target's decision (Principle 2). The vocabulary:

| Semantic | What it does | Mutates source? | Example target |
|---|---|---|---|
| **Reference (link)** | inline mention / `brainstorm://` link | no | Notes editor (plain drop → `MentionNode`) |
| **Transclude** | live embedded card/block | no | Notes editor (Alt drop → `TransclusionNode`); doc embedding a kanban |
| **Add membership** | manual `members.include` override ([21](../data/21-objects-and-collections.md)) | no (entity unchanged; collection gains a member) | a collection, a Database view, a kanban column |
| **Set a property** | write a relation/date/status by dropping onto a slot | yes (target writes the dropped item's id into its own field, or vice-versa) | Calendar day (sets date), board column (sets group-by value), relation cell |
| **Move** | remove from source container, add to target | yes (both) | Files folder tree (default = move, Alt = copy) |
| **Copy / duplicate** | create a new entity from the dropped one | creates new | rare; explicit Alt-modifier or target choice |
| **Compose** | combine N dropped objects into a new one | creates new | "drop 3 notes onto New Collection" |

> **Decision:** the default semantic for a cross-app drop is **the least destructive one the target supports** — reference/transclude/add-membership before move, never copy-by-default, never a source mutation the source didn't initiate. Move (a source mutation) is only the default for *containers whose entire purpose is placement* (Files folders), and even there Alt inverts to copy. This mirrors the editor's existing plain-drop=Mention / Alt-drop=Transclusion split.

> **Decision:** the meaning a target offers is **declared**, not guessed. An app declares which drop semantics it accepts for which entity types (manifest `registrations`, alongside intent handlers — §Part IV), so the shell can (a) show a correct drop affordance during `dragover` and (b) refuse a drop the target can't honour *before* the pointer is released.

## Part IV — Proposed architecture

### 1. Unify selection first (`selection` host service)

Build the `selection.publish` / `selection.current` service [17](17-interoperability.md) specified:

- Renderer side: a `useSelection()` SDK hook wrapping the existing `@brainstorm/sdk/selection` math, whose state is the canonical `ObjectDragItem[]`. Apps replace their bespoke `Set`/anchor containers with it as they're touched (ratchet, not big-bang).
- On selection change, the hook calls `selection.publish({ items })` over the broker. The shell keeps **only the focused app's** published selection (one slot, replaced on focus change — no cross-app selection aggregation, no privacy leak between apps).
- `selection.current()` returns it for selection-driven intents and for the action surface ([63](63-action-surface.md)). This is also what a keyboard "move selection to…" reads.

This is independently useful (it lights up "summarize selection", "export selection") and is the precondition for cross-app drag, because **the drag payload is just the published selection in motion**.

### 2. The shell-mediated drag session (scope C)

Lifecycle, all over the broker (new `dnd` service, capability `dnd.drag` to start, `dnd.drop` to receive):

1. **Begin.** On `dragstart` of a known object, the source app calls `dnd.begin({ payloadKind, items })` (items default to the current selection). The shell:
   - stamps `sourceApp` from the renderer-identity registry (unforgeable),
   - opens a **drag session** (one global active session; a second `begin` cancels the first),
   - renders the **drag ghost** as a shell-owned overlay that follows the OS cursor (a small frameless click-through always-on-top window, or a dashboard-renderer overlay layer), showing the label/icon and an N-badge for multi-select. The ghost is shell-owned precisely *because* it must cross over other apps' windows, which an app renderer can't paint on.
2. **Track + hit-test.** The shell tracks the global cursor. For each move it resolves the target window from `WindowIndex` (point-in-bounds, top-most by z-order/focus, monitor-aware) and the target app from renderer-identity. It throttles to ~60 Hz coalesced (the window index already debounces geometry at 16 ms).
3. **Negotiate (`dragover`).** When the cursor enters a new candidate target, the shell sends `app:drag-over` to that window with `{ sessionId, payloadKind, itemTypes, point-in-window }` — **types and a within-window point only, never the payload bytes, never `sourceApp` identity unless the target holds a capability to learn it.** The target replies (or its preloaded drop-zones reply) with the drop semantic it would apply at that point (or "reject"). The shell updates the ghost's cursor affordance (copy/link/move/no-drop) from the reply. This is the cross-process equivalent of `preventDefault()` in `dragover`.
4. **Drop.** On pointer-up over an accepting target, the shell:
   - re-checks capabilities (target must hold the right to *receive* this kind, e.g. `entities.write:<type>` for membership/property writes; fail-closed),
   - delivers `app:drop` to the target window with the full `ObjectDragPayload` + within-window point + chosen semantic,
   - the target performs the operation (insert node, add member, set property…) using its own capabilities and returns `{ ok }`,
   - the shell tears down the ghost and closes the session.
5. **Cancel.** Escape, drop on empty space, drop on a rejecting target, or a source/target crash → session closes, ghost removed, nothing mutated. Fail-closed throughout (a thrown capability check ends the drag, never completes it).

```
 source app           shell (main)                         target app
 ──────────           ────────────                         ──────────
 dragstart ─ dnd.begin({items}) ─► open session, stamp sourceApp
                                    paint ghost overlay  ──► (follows cursor over ALL windows)
 (pointer moves) ────────────────► hit-test WindowIndex ─── app:drag-over({types,pt}) ─►
                                  ◄── {semantic | reject} ──────────────────────────────
                                    update ghost affordance
 (pointer up) ──────────────────► re-check caps (fail-closed)
                                    app:drop({payload,pt,semantic}) ─────────────────────►
                                  ◄── {ok} ─────────────── perform op via own caps
                                    teardown
```

> **Decision:** the payload bytes reach a target **only on `drop`**, never on `drag-over`. During hover a target learns *that* a drag of certain *types* is overhead and *where*, never *which* objects or *which* source app (unless capability-granted). This bounds what a passive app learns from a user merely dragging across its window.

> **Decision:** there is exactly **one** active drag session, owned by the shell. No app can observe or hijack another app's drag; a target only ever hears about a drag once the cursor is over *its own* window.

### 3. Reconcile the MIME / payload contract

> **Decision:** standardise on the *shipped* base name and generalise it. `application/vnd.brainstorm.entity+json` becomes the entity payload for **both** intra-app HTML5 DnD (where it already lives) and the shell session (scope C), widened from a single item to `ObjectDragPayload` (`{ v, sourceApp, items[] }`). The single-item helpers stay as a thin shim over `items[0]` for back-compat. Doc 17's `application/x-brainstorm-entity` / `…-blockprotocol` names are **superseded** — the block-protocol embed case is carried as a distinct `payloadKind` on the same session, not a parallel MIME. Update [17](17-interoperability.md) to point here.

`sourceApp` is stamped by the **shell** from the drag session (it was app-provided and forgeable in the doc-17 sketch). For intra-app HTML5 drags there is no shell session, so `sourceApp` there is best-effort/self-asserted and must not be trusted for a security decision — only the broker-mediated path carries a trustworthy `sourceApp`.

### 4. The drop-target SDK primitive

A `useDropTarget({ accepts, onDrop, dropEffectFor })` hook (SDK) so apps declare, in one place:

- which `payloadKind`s + entity types they accept,
- the semantic for a given hover point (`dropEffectFor` → reference/member/property/…/reject),
- the handler that performs it on `drop`.

It transparently handles **both** transports: intra-renderer it wires native `dragover`/`drop` (reading `application/vnd.brainstorm.entity+json`); cross-app it subscribes to `app:drag-over`/`app:drop`. Apps write one drop handler and get both scopes. This is also where the per-type declaration that feeds `dragover` negotiation (§Part III "declared, not guessed") is registered, mirroring the manifest intent registrations.

## Part V — Out-of-Brainstorm (scope D)

- **Drag a file out** (e.g. a Files entry to Finder): use `webContents.startDrag({ file, icon })` from main, triggered by a `dnd.exportFile` broker call once the entity's bytes are materialised to a temp path. This is the *one* native cross-boundary drag Electron supports.
- **Drag an object out** (to a browser, another app): no file — fall back to the OS clipboard/drag standard types only: `text/plain` (label) + `text/uri-list` (`brainstorm://entity/<id>` deep link per [31](31-linking-protocol.md)). Brainstorm content "degrades to a link."
- **Drop a file in** (Finder → an app window): native OS file drop already fires `drop` with `dataTransfer.files` inside the target renderer (the editor media stack relies on this). This works without the shell session and stays as-is; the `useDropTarget` hook treats it as the `FileDragPayload` kind.

## Accessibility

Per Principle 5, every drag has a non-pointer twin:

- **Keyboard:** selection via the shared composite-keyboard a11y primitives; a "Move to… / Add to… / Link to…" command (from the object menu and the action surface [63](63-action-surface.md)) that opens a target picker and performs the *same* drop semantic the pointer would. Bound through the shortcut registry, never raw `e.key` ([35](../foundations/35-code-conventions.md)).
- **Cut/copy/paste** is the keyboard isomorph of move/copy drag and uses the same payload contract on the clipboard (the structured type layered over standard types, per [17 §Clipboard](17-interoperability.md)).
- **Screen reader:** the drag ghost is decorative; the *operation* is announced ("Linked 3 objects into Note 'Roadmap'") via the target's live region, not the motion. Drop targets expose `aria-dropeffect`/grabbed state on the keyboard path.
- **Reduced motion:** the ghost follows the cursor without inertial animation; respect the OS reduce-motion setting.

## Anti-patterns

- **Don't ship cross-app drag on raw HTML5 DnD.** It will silently no-op across renderers (empty `DataTransfer`) — the exact trap doc 17 set. Cross-app = shell session, always.
- **Don't put the payload on `dragover`.** Hover must leak types + location only.
- **Don't trust app-provided `sourceApp` or item identities for authorization.** The shell stamps `sourceApp`; the *target's own* capabilities gate what it can resolve. A dropped `entityId` is an untrusted string until validated (the entity-id regex + the entities service's own checks).
- **Don't let the source dictate the effect.** No "this is a move" from the source; the target decides, defaulting least-destructive.
- **Don't copy by default.** Reference/transclude/membership first; move only for placement containers; copy only on explicit intent.
- **Don't reinvent selection or the payload per app.** Shared `selection` service + `ObjectDragPayload` + `useDropTarget`. Three uses ⇒ extract (per [CLAUDE.md DRY](../../CLAUDE.md)).
- **Don't paint the drag ghost from an app renderer.** It can't cross other windows; the shell owns it.

## Where this fits

This is **shell/platform infrastructure**, not an app feature, and it has a hard dependency chain:

1. `selection` host service + `useSelection` (unblocks selection-driven intents independently).
2. `dnd` broker service + drag-session state machine + shell drag-ghost overlay + `WindowIndex` hit-testing.
3. `useDropTarget` SDK primitive + MIME reconciliation; migrate Notes' `entity-drop-plugin` onto it as the reference target.
4. Roll drop targets across apps (collections/Database membership, Calendar date-set, Files move, kanban column).
5. Scope D (file out via `startDrag`, link-out, file-in already works).
6. Keyboard/cut-paste twins + a11y pass.

It naturally follows the app-platform interop work (it *is* the direct-manipulation face of [17](17-interoperability.md)/[63](63-action-surface.md)) and should be sequenced after the action surface lands, since both share the selection service and the declared-capability registry. Concrete iteration numbering goes in [implementation-plan.md](../implementation-plan.md) when scheduled.

## Open questions

New OQs (added to [11-open-questions.md](../reference/11-open-questions.md) as OQ-DND-1..6):

- **OQ-DND-1** — Drag-ghost mechanism: a dedicated frameless click-through always-on-top window vs. a dashboard-renderer overlay layer vs. an OS-native drag image. Cross-monitor + cross-DPI behaviour and click-through reliability decide it.
- **OQ-DND-2** — Hover-leak policy: is `sourceApp` *ever* revealed to a target on `drag-over`, or only on `drop`, or only with a capability? (Leaning: only on drop, only with capability.)
- **OQ-DND-3** — Does a passive app need any capability to *receive* drag-over notifications over its own window, or is that ambient (it's the user's pointer over the user's window)? (Leaning: ambient for hover, capability-gated for the actual drop payload.)
- **OQ-DND-4** — Multi-item heterogeneous selection (objects of mixed types, or objects + files): does a target negotiate per-item or all-or-nothing? (Leaning: target declares; default all-or-nothing for v1.)
- **OQ-DND-5** — Auto-scroll / spring-loaded folders / auto-raise-window-on-hover during a cross-app drag: in scope for v1 or deferred?
- **OQ-DND-6** — Should intra-app DnD *also* migrate onto the shell session for uniformity, or keep native HTML5 intra-renderer for latency? (Leaning: keep native intra-renderer; one `useDropTarget` API over both transports.)

Pre-existing related: [OQ-4](../reference/11-open-questions.md) (per-app renderer — the boundary this all crosses), OQ-31 (clipboard history), OQ-GR-2 (graph drag-to-create-link), OQ-DB-27 (board/calendar drag-write).

## Summary

- **Selection** is mostly unified (`@brainstorm/sdk/selection`) but the `selection` *host service* doc 17 promised was never built — build it first; it doubles as the drag payload.
- **Intra-app drag** works today on native HTML5 DnD. **Cross-app drag does not and cannot** on native DnD, because each app is its own renderer and `DataTransfer` doesn't cross that boundary — contradicting [17 §Drag-and-drop](17-interoperability.md)'s "shell doesn't mediate" claim.
- **Cross-app drag must be a shell-mediated drag session:** shell stamps the source, owns the cursor-following ghost, hit-tests target windows via `WindowIndex`, negotiates the drop semantic over the broker (types + location on hover, payload only on drop), re-checks capabilities fail-closed, and delivers a **reference-only** payload the target resolves with its own capabilities.
- **The drop target decides the meaning** (reference / transclude / membership / property / move / copy / compose), defaulting least-destructive, declared not guessed.
- **The wire format** standardises on the shipped `application/vnd.brainstorm.entity+json`, widened to `{ v, sourceApp, items[] }`; doc 17's alternate MIME names are superseded.
- **Every drag has a keyboard / cut-paste / action-surface twin.**
- It is **the direct-manipulation front-end to the intents bus**, not a separate system — and it is platform infrastructure gated on the selection service and the action-surface registry.
