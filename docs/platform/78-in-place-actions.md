# 78 — In-place actions (apps that transform a fragment and hand back a proposal)

Builds on [63-action-surface.md](63-action-surface.md) (the contributed-action surface, `AS-1`→`AS-4` ✅), [17-interoperability.md](17-interoperability.md) (the four interop mechanisms + the curated verb namespace), [75-agent-notes-seam.md](75-agent-notes-seam.md) (propose→approve for cross-app writes), [31-linking-protocol.md](31-linking-protocol.md) (`RelativePosition` anchor stability), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capabilities, fail-closed broker) and [77-agent-observability.md](77-agent-observability.md) (the trace substrate).

[63](63-action-surface.md) shipped the **launcher** half of app-contributed actions: install an app, and its actions appear in *other apps' object menus* — pick one and the contributing app opens and takes over. That is the Share-sheet. This doc ships the other half, the one that makes apps feel like they genuinely **extend each other**:

> **Decision:** an installed app may contribute an action that runs on a **fragment** of what you are looking at — a paragraph, a selection, a block, an image, a cell — and **returns a result into the place you were**, as a **proposal the user approves**. The host renders it, the contributor computes it, the host applies it. Nothing about "renders in the host, executes in the contributor's sandbox" changes; one clause is added: **it resolves in the host**.

The motivating story: *the Agent app is installed, so selecting a paragraph in a Journal entry offers "Rewrite" — the rewritten paragraph comes back as a diff over the original, and lands only when the user accepts.* Uninstall the Agent and the action disappears. Install a Translate app and "Translate" appears in the same place, on every text selection in every app, with no change to Journal.

## What is actually missing (verified against the code, 2026-07-29)

`AS-1`→`AS-4` shipped real machinery — the intents registry with presentation metadata, `intents.suggestActions`, `groupContributedActions` (dedupe/rank/cap/trust-quarantine), per-app disable in Settings, and the Agent app's live `process:summarize` / `process:ask` contributions. Three structural gaps stand between that and the story above.

1. **Targets stop at the object.** `ContributedActionTarget` is `{ entityId, entityType, mime, format }` — whole objects only. A paragraph, a text range, a block, an embedded image, a table cell, a canvas shape cannot be named, so no contribution can apply to one.
2. **Dispatch is one-way.** `ACTION_SURFACE_VERBS` in `intents-bus.ts` route an activation to the contributor over the launch context (cold app) or the `app:intent` push (running app) — the same channel the composer verbs use. **There is no return channel.** So "Rewrite this paragraph" can only mean "open the Agent app with the paragraph seeded into a prompt" (`seedFromProcessIntent`); the paragraph itself is never touched.
3. **The in-document surfaces were never wired.** `useContributedActions` / `<ActionMenu>` ship in `packages/sdk/src/contributed-actions/` but have **zero callers** — the only live path is the `suggestActions` pass inside `openObjectMenu`. The editor's inline toolbar, block-gutter menu and slash menu are hardcoded lists. (The `AS-2` plan bullet claims adoption "by the cover menu / editor-selection menu / block menu / slash picker"; that half did not land. `AS-8` below is the honest pickup.)

## The model

### Fragments are targets

`ContributedActionTarget` gains an optional `fragment`. A fragment is **shape + anchor + preview**, and the three parts have deliberately different trust:

```ts
export type ActionFragment = {
  kind: FragmentKind;          // TextRange · Block · Blocks · Cell · Rows · Region · Whole
  contentKind: ContentKind;    // Text · RichText · Code · Image · Table · Shape
  /** Host-owned locator. Opaque to the contributor; never leaves the host. */
  anchor: FragmentAnchor;
  /** The bounded bytes the contributor is permitted to see, materialized lazily. */
  preview?: FragmentPreview;   // { mime, markdown | text | ref, byteLength }
};
```

- The **anchor never crosses to the contributor.** The shell holds it against the request id; the contributor receives only `{ kind, contentKind, mime, byteLength }` plus the content it is allowed to read. The contributor cannot address a position in the host's document, only answer a question about a blob — so it cannot aim a write.
- Text anchors are a **Yjs `RelativePosition` pair** ([31](31-linking-protocol.md)), not offsets. A rewrite that returns after the user has typed elsewhere still lands on the right words; if the range was deleted while the request was in flight, resolution fails cleanly and the proposal is refused instead of landing in the wrong place.
- **Preview bytes are materialized on activation, never on menu open** — see §Performance.

### Applicability by content shape

A "Translate" action applies to *any text anywhere*, which no `entityType` can express. The manifest intent registration gains a `contentKinds` discriminator:

```jsonc
{ "verb": "process", "kind": "translate", "contentKinds": ["text", "rich-text"],
  "label": "Translate…", "icon": "language", "group": "actions", "priority": "secondary" }
```

This stays inside [OQ-AS-2](../reference/11-open-questions.md)'s adopted position — it is a closed enum matched like `mime`/`format`, not a value-level predicate over content. Orthogonal-discriminator semantics are unchanged: an empty column wildcards that dimension.

### The return channel: request → fulfill → **propose**

`dispatch` stays fire-and-forget. A second, strictly narrower method carries results:

- **`intents.request({ verb, kind, appId, fragment })`** — host side. The shell mints a transaction `{ requestId, hostApp, contributorApp, contentKind, digest, expiresAt }`, materializes the preview, and delivers it to the contributor.
- **`intents.fulfill({ requestId, result })`** — contributor side. The shell validates: the request exists and is un-expired; **the responding app is the dispatch target, taken from the verified envelope identity, never the payload**; exactly one response per request; the result is inside the size cap; and its `contentKind` is in the same class it was asked about (a text rewrite may not return HTML).
- The validated result reaches the host as a **proposal**, never a write.

> **Decision:** a returned fragment is a **proposal, not a mutation**. The host renders it as a diff over the original and applies it only on a human approve gesture — the [75](75-agent-notes-seam.md)/OQ-ANS-4 propose-not-persist posture, generalized from "the agent" to "any contributing app". This is the invariant that makes it safe for an arbitrary installed app to offer to rewrite your journal.

Applying is one undo step in the host's own editor, because the host owns the transaction.

### Where they appear

All four surfaces resolve through the one `useContributedActions` path — no bespoke per-surface wiring:

| Surface | Target | Verbs |
|---|---|---|
| Editor **inline toolbar** (non-collapsed selection) | `TextRange` fragment | `process`, `convert` |
| Editor **block-gutter ⋯** menu | `Block` / `Blocks` fragment | `process`, `convert`, `export` |
| Editor **slash menu** | insertion point | `insert`, `compose` |
| Object **⋯ menu** (shipped, `AS-1`) | whole object | unchanged |

## Security and capabilities

Two new capability strings, in the existing `intents.*` family, both explicit grants (never in `DEFAULT_APP_CAPABILITIES`):

- **`intents.request:<verb>`** — the host may send a fragment of the user's content to another app for processing. Gesture-gated by construction: only ever fired from a shell-rendered action the user picked.
- **`intents.fulfill:<verb>`** — the contributor may return content that will be offered into another app's document. Strictly stronger than `intents.handle:<verb>` (which only receives), so it is a distinct line at install review.

Everything else is inherited, not invented: broker cap-check on every call, fail-closed to `Unavailable`; contributor identity from `RendererIdentityRegistry`; per-app "disable contributions" in Settings kills request *and* fulfill for that app; the trust tiers and quarantine of `AS-4` apply unchanged.

Additional posture specific to this surface:

- **Locked objects refuse before dispatch** — no fragment leaves a locked note (the standing lock-enforcement-on-every-write-path rule; the *read* is refused too, since a rewrite of a locked paragraph is a write in waiting).
- **Refusals are loud.** Contributor uninstalled mid-flight, deadline exceeded, response failing validation — each resolves the pending affordance to a named refusal chip. Fail-closed's failure mode is silence ([77](77-agent-observability.md)); a hung shimmer is the bug.
- **Every request/fulfill pair is a trace row** naming host app, contributor app, verb, content kind, byte length, outcome — metadata only, no fragment bytes. This wants [77](77-agent-observability.md)'s substrate rather than a second one (see §Cross-doc reconciliation).
- **No auto-chaining.** A result never dispatches another action; multi-step is an Automations workflow, explicitly authored.

## Performance budgets

- **Menu open must not read content.** Applicability is decided from the fragment's *shape* (`kind` + `contentKind` + the existing discriminators), all of which the host already knows. Serializing the selection happens **on activation**. Serializing on every selection change would put a document walk behind the inline toolbar's appearance — the one budget this feature can plausibly blow.
- Fragment preview is size-capped (proposed 32 KiB / a selection-length cap, tuned at implementation); over-cap activation refuses with an explanation rather than truncating silently.
- Request deadline shell-enforced (proposed 30 s default) with optional contributor progress; the host shows pending state and can cancel, after which a late fulfill is dropped.
- Inline-toolbar resolution is on the hot path of *every* text selection — it holds the existing suggest budget with a harder inline cap (§Non-goals notwithstanding, this is the surface most at risk of junk-drawer rot).

## Non-goals

- **Contributor code in the host process.** Still never. The "no plugins for plugins" invariant of [17](17-interoperability.md) is untouched — this adds a shell-mediated request/response, not an extension host.
- **General app-to-app RPC.** One bounded, gesture-initiated, size-capped, deadline-bound exchange over a curated verb. Not a socket, not a service the contributor can initiate.
- **Value-level applicability predicates.** Still [OQ-AS-2](../reference/11-open-questions.md), still post-v1. `contentKinds` is an enum, not a predicate language.
- **Silent apply.** No trusted-app fast path in v1 (see OQ-AS-8).
- **The host gaining anything.** A host never receives a capability, a handle, or contributor code — only a validated blob it may choose to apply.

## Phasing

| Capability | v1 | post-v1 |
|---|---|---|
| Fragment targets + `contentKinds` discriminator | ✓ (`AS-5`) | richer fragment kinds |
| `intents.request` / `intents.fulfill` transaction | ✓ (`AS-6`) | streaming partial results |
| Proposal preview + approve + single-undo apply | ✓ (`AS-7`) | inline per-hunk accept |
| Editor inline-toolbar / block / slash surfaces | ✓ (`AS-8`) | canvas + table-cell surfaces |
| Agent as first live in-place contributor | ✓ (`AS-9`) | third-party contributors via catalog |
| Pending / cancel / refusal UX + trace rows | ✓ (`AS-10`) | — |
| Trusted-contributor auto-apply | — | ✓ (OQ-AS-8) |

## Cross-doc reconciliation needed

- **[63-action-surface.md](63-action-surface.md)** — add a forward pointer: 63 is the object/launcher half, 78 the fragment/return half. Its phasing row "`process`/… contributions in object + cover + **selection** menus ✓ (v1)" overstates what landed; the selection half is `AS-8` here.
- **[09-shared-sdk-catalog.md](../apps/09-shared-sdk-catalog.md)** — still missing `useContributedActions` / `<ActionMenu>` (a 63 follow-up never done); add them plus the new `useActionProposal` / `<ProposalPreview>` when `AS-7` lands.
- **[77-agent-observability.md](77-agent-observability.md)** — in-place action traces should share `agent_events`' substrate generalized beyond the agent, not fork a parallel ledger (OQ-AS-10).
- **[75-agent-notes-seam.md](75-agent-notes-seam.md)** — its `insert`-intent propose→approve path is the special case of the general rule stated here; note the generalization.
- **impl-plan** — the `AS-2` bullet's adoption claim is stale; annotate rather than rewrite, and let `AS-8` carry the residue.

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md): **OQ-AS-6** (fragment anchor durability + exactly what a contributor sees), **OQ-AS-7** (who authorizes a fragment leaving the host — cap, gesture, or both), **OQ-AS-8** (is approval always required, or may a trusted contributor auto-apply), **OQ-AS-9** (inline-toolbar restraint numbers), **OQ-AS-10** (shared trace substrate with 77, or separate).

## Summary

- [63](63-action-surface.md) made installed apps contribute **actions on objects** that *launch* the contributor. This doc makes them contribute **actions on fragments** that *return a result where you were*.
- Three concrete gaps close: **fragments as targets** (a paragraph can be named), a **request/fulfill transaction** (results can come back), and the **editor surfaces actually wired** (the `AS-2` residue).
- Safety is inherited, not invented: the anchor never leaves the host, the contributor answers about a blob and cannot aim a write, and **every returned fragment is a proposal a human approves** — [75](75-agent-notes-seam.md)'s posture generalized from the agent to every app.
- This is what makes the app platform compose: **Journal knows nothing about rewriting, translating, or summarizing** — it only knows how to offer a selection and apply a proposal. Every capability its users get from a selection came from some other app they chose to install.
