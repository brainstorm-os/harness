# 75 — Agent → Notes seam (insert into / link to a note)

Design for **F-241** — the Agent app's replies dead-end as plain text: no affordance to insert a reply into a note or to connect the chat to one. This doc fixes the seam — how an AI-surface app writes *into* a user document under the capability model — before code, because "the agent writes into my notes" is a security-relevant surface and the chokepoint choice is the whole design.

Builds on:
- [../apps/55-agent-app.md](../apps/55-agent-app.md) — the Agent app (Stage `11c`): tools are granted intents, three-tier fail-closed intersection (agent-tools ⊆ conversation-grants ⊆ app-caps), citations are `brainstorm://` links.
- [63-action-surface.md](63-action-surface.md) + [17-interoperability.md](17-interoperability.md) — the curated verb namespace already contains **`insert`**, and AS-3 already gave it a **delivery channel** (`ACTION_SURFACE_VERBS` in `main/intents/intents-bus.ts`: launch-context ride for a fresh window, `app:intent` push for a running one). No verb is invented here.
- [31-linking-protocol.md](31-linking-protocol.md) — `brainstorm://entity/<id>` links; Notes already extracts body links into `bodyRefs` (backlinks + graph edges).
- [../security/09-security-and-sandbox.md](../security/09-security-and-sandbox.md) — verb-scoped `intents.dispatch:<verb>` grants, ledger-checked in the broker, fail-closed, denials audited.
- Prior art in-tree: Mailbox's composer verbs (intent → handling app acts in its own sandbox) and Journal's `compose` → Notes — the same "dispatcher asks, owner writes" shape this doc reuses.

## The gap (precisely)

Agent replies render markdown with clickable citations (Agent-4/9), but a reply is a terminal artifact: the user cannot file it into their knowledge. Three things are missing; everything else already exists:

1. ❌ **An affordance** on an assistant message: *insert this reply at the end of a note* / *link this chat into a note*.
2. ❌ **A payload contract + handler** for the `insert` verb: the bus can deliver `insert` since AS-3, but no app registers for it and no payload shape is pinned.
3. ❌ **The grant**: the Agent app holds `intents.dispatch:open` only — it has no path that mutates another app's document (correctly; that's the point of this design).

Not missing: the verb + delivery channel (doc 63/AS-3), the routing (bus matches `(verb, entityType)` intent rows from manifests), the capability machinery (verb-scoped dispatch grants, ledger-checked), the link protocol, or the editor machinery to append content.

## Architecture — dispatch to the document's owner, never write the document

> **Decision:** the Agent app **never writes note bytes**. It dispatches an `insert` intent whose payload names the target note and carries markdown; the shell's intents bus routes it to the note type's registered handler (Notes); **Notes performs the append inside its own sandbox, in its visible editor, under its own capabilities**. The Agent's entire new privilege is `intents.dispatch:insert` — the right to *ask*, reviewed on the standard capability sheet.

The rejected alternative — granting the Agent `entities.write:io.brainstorm.notes/Note/v1` (or worse, a Y.Doc write path) — would let an AI-surface app silently mutate documents with no owning-app mediation, no visible feedback, and a second body-write implementation to keep correct (Y.Doc universal-body root + snippet + `bodyRefs` extraction all live in Notes). The intent path reuses the one editor that already knows how to write a note body correctly, and makes the write *observable by construction*: handling the intent focuses/launches Notes on the target note, so the user watches the content land and one Cmd+Z (the note's own history) undoes it.

### Payload contract (the `insert` verb, target-addressed)

Doc 17 sketched `insert` as "insert at the current selection of the focused editor." This seam needs the **target-addressed** variant — the dispatcher names the entity to insert into (the bus routes on `payload.entityType`, exactly like the composer verbs):

```jsonc
{
  "verb": "insert",
  "payload": {
    "entityId":   "<target note id>",
    "entityType": "io.brainstorm.notes/Note/v1",  // routes to the registered handler
    "position":   "end",                           // v1: append only
    "markdown":   "<content to append>"            // markdown, the lingua franca both sides already speak
  }
}
```

- **Markdown is the interchange form** — the Agent already renders replies as markdown (`@brainstorm/sdk/markdown`), Notes already imports markdown (`@lexical/markdown` transformers). No new rich-text wire format.
- **"Link to note" is not a second content kind.** Linking the chat into a note is just inserting the one-line markdown `[<conversation title>](brainstorm://entity/<conversationId>)` — the link node flows into `bodyRefs` at autosave, so the note↔conversation edge appears in backlinks and the graph with zero new machinery.
- **Provenance rides in-document.** An inserted reply is suffixed with an attribution line linking the source conversation (`— [<title>](brainstorm://entity/<convId>)`). The user (and the graph) can always answer "where did this text come from" from the note itself.
- The contract (`buildNoteInsertPayload` / fail-closed `parseNoteInsertPayload`, length-bounded markdown) is frozen in `@brainstorm/sdk-types` so dispatcher and handler cannot drift.

### The two v1 affordances (Agent side)

Per assistant message, one **"Add to note"** action (message action row, next to "Remember") opening a popover: a mode toggle — **insert the reply** vs **link this chat** — over a searchable note list (filtered from the vault snapshot the app already holds). Full keyboard path: the action is a real focusable button; the popover arrows/Enter/Escape like every shared menu. On success, a transient confirmation names the note; on failure the standard inline error (never silent).

### Notes side (the handler)

Notes' manifest registers `{ verb: "insert", entityType: "io.brainstorm.notes/Note/v1", priority: "primary" }`. Handling (running-window `app:intent` push AND cold-launch `launch.reason === "intent"`, mirroring Mailbox):

1. Fail-closed parse of the payload (shared sdk-types parser; wrong type / blank id / oversized markdown → refused).
2. **Locked-note refusal**: a note with `properties.locked` set refuses the insert with a visible notice — the lock is advisory for humans, but a programmatic write path must respect it strictly.
3. Open/select the target note (the same `openEntity` path an `open` intent takes).
4. Once the note's editor is mounted and its Y.Doc hydrated (`whenLoaded`), append: markdown → blocks via a headless Lexical parse with the Notes transformer set, appended to the document root in one editor update (one undo step). Autosave then refreshes the snippet + `bodyRefs` exactly as if the user had typed it.

## Capability + security model (the review focus)

The write chain crosses four independent gates, each fail-closed:

1. **Install-time grant.** `intents.dispatch:insert` is a manifest capability on the Agent app, shown on the same capability sheet as every app's grants. It is *not* in the default-minimum grant set (`default-grants.ts` grants only `intents.dispatch:open`) — sideloaded or third-party agents don't get it for free.
2. **Broker chokepoint.** The dispatch crosses the IPC broker: preload-stamped renderer identity (`RendererIdentityRegistry`), verb-scoped ledger check (`intents.dispatch:insert` must be a live grant), fail-closed on ledger error, **denials audited** (`ipc.denied` in the vault audit log).
3. **Bus routing.** The bus routes only to an app that *registered* for `(insert, entityType)` in its manifest — the dispatcher cannot choose the executor, and an unhandled type is a structured `no-handler`, never a fallback write.
4. **Owner-side validation.** Notes re-validates the payload shape, refuses locked notes, and applies the append through its normal editor pipeline — the same undo, autosave, sync, and `bodyRefs` discipline as user typing. Nothing in the payload is interpreted as HTML or executed; markdown text becomes text/element nodes via the sanctioned transformers.

**The model cannot fire this path in v1.** The affordance is a **user gesture in trusted app chrome** — `insert` is deliberately *not* added to the curated agent-tool set, so no tool call, no prompt-injected instruction, and no web content the agent read can cause a note write. The user picks the message, the mode, and the target note. "The agent writes into my documents" is, precisely, "the user files an agent reply into a note they chose." Making `insert` a *model-callable tool* is explicitly v2, and it would arrive through the existing three-tier intersection + per-conversation grant + inline escalation prompt (Agent-5) with a confirm-write step — no new machinery, but a deliberate, separately-reviewed step.

**Audit trail**: (a) the ledger records the grant (and the user can revoke it on the app sheet); (b) the broker audit-logs every denied attempt; (c) the append is visible live in the opened editor and undoable; (d) the in-document provenance line + the `bodyRefs`-projected conversation↔note edge make the write attributable at rest. A success-side audit event for agent-originated intent dispatches is OQ-ANS-2.

**Blast radius**: the new surface is one verb-scoped dispatch grant on one first-party app, routed to one first-party handler that appends bounded markdown to the end of a user-picked note. No wildcard, no entity write, no new IPC channel, no shell privilege.

## v1 scope

| Capability | v1 | later |
|---|----|----|
| Insert reply at end of a chosen note (append-only) | ✓ | arbitrary position / at-selection |
| Link the conversation into a chosen note | ✓ | — |
| Provenance suffix + graph edge via `bodyRefs` | ✓ | richer provenance chrome |
| User-gesture only (message action row, keyboard path) | ✓ | model-callable `insert` tool behind grant + confirm (v2) |
| Notes as handler | ✓ | any app registering `(insert, <its type>)` — Journal is the obvious second |

## Iteration plan (`F-241` / 11c seam v1)

- **`ANS-1` — contract.** `@brainstorm/sdk-types` insert-intent payload types + build/parse (fail-closed, bounded); intents-bus test pinning the `insert` delivery channel; broker enforcement test pinning the `intents.dispatch:insert` capability gate (denied without grant, allowed with).
- **`ANS-2` — Notes handler.** Manifest registration; running-window + cold-launch intent handling; locked-note refusal; headless markdown-append editor helper + mount-time apply plugin; visible notice on refusal. Unit tests at the parse / append / refusal levels.
- **`ANS-3` — Agent affordance.** `intents.dispatch:insert` manifest cap; "Add to note" message action + popover (mode toggle, note search, keyboard path); markdown assembly (citation-id links rewritten to `brainstorm://entity/…`, provenance suffix); success/failure surface; i18n en+es. Unit tests on the pure assembly + candidate filtering.
- **`ANS-4` — verification (gate).** Real-shell dogfood: reply → insert into an existing note (content + provenance land, backlink edge appears), link-chat into a note, locked-note refusal, cold-launch insert (Notes not running). Security review of the grant + payload path rides the PR (owner-reviewed; no self-merge).

## Open questions

- **OQ-ANS-1** — target-addressed `insert` vs doc-17's at-selection `insert`: same verb, discriminated by payload (`entityId` present = target-addressed). Revisit if a real at-selection contributor lands and the shapes fight.
- **OQ-ANS-2** — success-side audit: should agent-originated `insert` dispatches append a vault audit event (beyond the in-document provenance)? Lean yes, as part of a general "app X dispatched mutating verb Y" audit lane rather than a Notes special case.
- **OQ-ANS-3** — insert into a *new* note ("create note from reply"): one popover action away, but it drags in title derivation + `compose` semantics; deferred to keep v1 append-only.
- **OQ-ANS-4** — when the v2 model-callable tool lands: does `insert` require a per-call confirm (MCP-4's `decideToolFriction` shape) even when granted? Lean yes — writes into user documents confirm by default.
