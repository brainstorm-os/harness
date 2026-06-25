# 63 — The action surface (apps contributing actions across the system)

Installing an app on a desktop OS makes the *whole system* more capable: a new app adds entries to the Share sheet, the Services menu, the right-click "Quick Actions", the "Open with" list. Brainstorm should work the same way — **install an app and relevant new actions appear in other apps' menus** — and it nearly does already: the intents registry, the curated verb namespace, `intents.suggest`, and the shell-provided menu component ([17](17-interoperability.md)) are the entire mechanism. What's missing is the **wiring that makes every app's menus registry-aware**, and a **framework surface third-party developers use** to both *contribute* actions and *host* them. This doc specifies that — the **action surface**.

The motivating example is the Agent app ([55](../apps/55-agent-app.md)/[62](62-agent-harness.md)): install it and a cover/object menu gains "Generate an image from this doc" or "Summarize"; uninstall it and those items simply don't exist. That is the cleanest possible statement of **AI is optional** — AI ships as *a contributing app*, not a feature baked into the shell. But the Agent is just the marquee contributor; the surface is general, and any first- or third-party app uses the same two SDK elements.

It builds on [17-interoperability.md](17-interoperability.md) (intents, the curated verb namespace, `intents.suggest`, the shell-standardized menu component, and the *"an app cannot register on behalf of another"* non-goal — **preserved, not broken**), [37-cross-app-navigation.md](../shell/37-cross-app-navigation.md) (the shared `buildObjectMenuItems` object-menu builder this makes registry-aware), [57-open-resolution.md](57-open-resolution.md) (the `open` verb / "Open with…" half — **already designed**; this doc adds the *non-`open`* verbs), [03-app-model.md](../apps/03-app-model.md) + [08-app-sdk.md](../apps/08-app-sdk.md) (manifest intent registrations are the contribution declaration), [09-shared-sdk-catalog.md](../apps/09-shared-sdk-catalog.md) (the new host-side primitive joins the catalog), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capabilities; the display-vs-dispatch boundary), and [62-agent-harness.md](62-agent-harness.md) (the Agent app as the highest-leverage contributor).

## The model: two roles, one surface

> **Decision:** every cross-app action is a **contribution** (an app declares "I can do `verb` to things shaped like X") *surfaced* by a **host** (any app's menu renders the contributions that apply to the object under the user's cursor). Both roles are **SDK framework elements** — identical for first-party and third-party apps. An app is usually both: Notes hosts contributed actions on a note *and* contributes `insert`/`convert` actions other apps host. The shell mediates every contribution; **no app ever injects directly into another app's UI** (the [17 §Non-goals](17-interoperability.md) "plugins for plugins" invariant holds — a contribution is the contributor declaring its *own* capability in its *own* manifest; the host asks the shell what applies and renders the answer).

| Role | What it does | Framework element |
|------|--------------|-------------------|
| **Contributor** | Declares actions it can perform on objects/values/selections | Manifest `intents` registration + presentation metadata |
| **Host** | Renders applicable contributed actions in its menus | SDK `useContributedActions` hook / `<ActionMenu>` primitive |
| **Shell** | Indexes contributions, answers `intents.suggest`, enforces caps + trust + dispatch | `intents.suggest` + the shared fancy-menus runtime |

### What already exists (the mechanism)

- **The intents registry** (`intents-repo.ts` → `findHandlers({verb, entityType, mime, format, kind, blockId})`), ranked primary/secondary.
- **A curated, closed verb namespace** ([17](17-interoperability.md)): `open · insert · share · convert · export · import · process · compose · quick-look`.
- **`intents.suggest`** and the decision that apps render the result through *one* shell-provided menu component built on `@react-fancy-menus/core` ([17 §Discoverability](17-interoperability.md)).
- **Dispatch + fail-closed result codes** (`no-handler`, `handler-error`, `cancelled`, `capability-denied`).

### The one missing wire

> **Decision:** today `buildObjectMenuItems` ([37](../shell/37-cross-app-navigation.md)) renders only built-ins (`Open`/`Pin`/`Remove`) plus app-passed `extraItems`; **nothing calls `intents.suggest` to surface other apps' contributions.** This doc makes the menu builders **suggestion-aware** and ships the host-side SDK primitive that does it once, for every surface. This was deliberately deferred pending the design below (which verbs, where, with what guardrails); it is not new architecture.

## Contributor side — declaring an action (framework)

A contribution is an ordinary manifest intent registration ([17](17-interoperability.md)) carrying **presentation metadata** so the host can render it without knowing the contributor:

```jsonc
"registrations": {
  "intents": [
    {
      "verb": "process",                 // curated verb — the action's semantics
      "entityType": "io.brainstorm.notes/Note/v1",  // applicability (discriminator)
      "kind": "generate-image",          // sub-selector within the verb
      "label": "Generate image from this doc",       // host-rendered, t()-translatable
      "icon": "sparkle",                 // shell IconName; host renders it, not the app
      "group": "ai",                     // grouping bucket (see §Anti-rot)
      "priority": "secondary"            // ordering within its group
    }
  ]
}
```

> **Decision:** contributions may only use **curated verbs** (the namespace stays closed, [17 OQ-30 resolved]). The action's *semantics* are the verb; the `kind` discriminates within it; `label`/`icon`/`group`/`priority` are pure presentation. **The host trusts none of the contributor's rendering** — it renders `label`/`icon` through the shell with sanitization and framing (§Security), so a contribution cannot forge a native item.

"Generate an image from a doc" is `process` with `kind: "generate-image"` — **no new verb needed**; `process` is already *"run this through a transform/processor (often AI)"* ([17](17-interoperability.md)). Whether genuinely *generative-from-nothing* actions (no source entity) deserve a dedicated `generate` verb is OQ-AS-5.

## Host side — surfacing actions (framework)

One SDK primitive, dropped into any menu, makes that menu registry-aware:

```ts
// React
const actions = useContributedActions({ target, verbs?: ContributedVerb[] });
// → ranked, grouped, capability-checked ContributedAction[]; reactive to installs

// or imperative, for non-React menu sites
const actions = await brainstorm.services.intents.suggest({ target, verbs });
```

```tsx
<ActionMenu target={note}>          {/* hosts Open-with + contributed actions */}
  <ActionMenu.BuiltIns pin remove /> {/* app's own built-ins stay first-class */}
</ActionMenu>
```

> **Decision:** `buildObjectMenuItems` ([37](../shell/37-cross-app-navigation.md)) gains an internal `intents.suggest` pass, so **every existing object menu becomes contribution-aware with no per-app change** — the same incremental rollout the universal-icon/cover passes used. The cover menu, selection menu, block menu, and slash-command picker adopt the same `useContributedActions` hook. There is exactly **one** code path that turns a registry contribution into a rendered, dispatchable menu item; apps never hand-roll it (the [DRY] standing rule).

`target` is the thing under the cursor — an entity, a value (a URL, an email, a file ref per [57](57-open-resolution.md)), or the live selection ([17 §Selection](17-interoperability.md)). The hook resolves `target` → discriminators (`entityType`/`mime`/`format`), calls `intents.suggest`, applies the trust/cap/grouping rules below, and returns ready-to-render items. Selecting one **dispatches the intent** — it does not run contributor code in the host.

## Security — display in the host, dispatch in the contributor

The invariant that makes this safe rather than a plugin free-for-all:

> **Decision:** a contributed action **renders in the host app but executes in the contributor's sandbox.** Choosing "Generate image" in Notes' cover menu dispatches `process` to the **Agent app**, which runs it under **its own** capabilities; Notes never gains the Agent's powers and never executes Agent code. Every dispatch is **fail-closed** ([02 §IPC](../foundations/02-architecture.md)): a contribution whose dispatch the broker can't authorize returns `capability-denied` and the action is *not shown as enabled*. This is the existing intents boundary ([17](17-interoperability.md)); the action surface adds no new trust primitive — it is read-mostly discovery plus the existing dispatch path.

| Surface | Posture |
|---------|---------|
| Contribution index | Read from the registry; reflects only **installed** apps. Uninstall → contributions vanish from every host menu (this *is* the install-gating). |
| Label / icon | Shell-rendered with sanitization (length + charset limits, no markup), framed by verb and attributed to the source app (`"Summarize — Agent"`), so a contribution can't impersonate a built-in or a different app. |
| Dispatch | Routed by the shell to the contributor's sandbox; host gains nothing; capability-checked per call. |
| Trust tier | First-party + catalog-signed contributions rank inline; **sideloaded** apps' contributions are quarantined under "More…" until the user promotes them (OQ-AS-3), so a sideloaded app can't silently plant an action high in every menu. |
| User control | Settings → an app's contributions can be disabled wholesale; per-`(verb,type)` defaults already clearable ([17 §Defaults](17-interoperability.md)). |

## Anti–menu-rot — the hard part isn't security, it's restraint

The macOS Services menu became a junk drawer because every app dumped everything everywhere. The surface is governed so it stays useful:

- **Relevance-gated, never dumped.** A contribution shows only when its discriminators match the `target` (type/mime/format; value-level predicates are OQ-AS-2). The cover menu shows "Generate image" only for types the Agent registered.
- **Grouped, not flat.** Contributions render in shell-defined buckets — `Open with…` ([57](57-open-resolution.md)), `Share to…`, `Convert to…`, `Actions` (the `process`/`compose` group) — never as a flat splice into the built-ins.
- **Capped inline + "More…".** At most *N* contributed items inline per group; the rest collapse under "More actions…". The object ⋯ menu stays the catch-all anchor ([SDK header rule]).
- **Ranked.** primary > secondary, then trust tier, then app name — deterministic, so an object's menu reads the same every time.
- **Deduped.** Two apps registering the same `(verb, kind)` collapse to one labeled choice, not two near-identical rows.

> **Decision:** the action surface optimizes for **the median object's menu staying short**. A contribution earns inline placement by relevance + trust; everything else is one click away under "More…". A surface that shows every installed app's every action on every object is the failure mode, not the goal.

## Where contributed actions appear

| Surface | Verbs surfaced | Notes |
|---------|----------------|-------|
| Object ⋯ menu | `process` `convert` `compose` `share` `export` | The catch-all; `Open with…` already here via [57](57-open-resolution.md). |
| Cover / object header menu | `process` (e.g. generate/replace cover image) | The motivating example. |
| Selection menu (editor) | `insert` `process` `convert` | Acts on the live selection ([17 §Selection](17-interoperability.md)). |
| Block menu / slash command | `insert` `convert` | Per-block contributions. |
| Launcher | all | Already designed ([17 §Discoverability](17-interoperability.md)); typing "summarize" surfaces `process` handlers. |
| "More Actions" button | all applicable | The standardized affordance ([17](17-interoperability.md), [37](../shell/37-cross-app-navigation.md)). |

Exactly *which* verbs are eligible on *which* surface is OQ-AS-1.

## Performance budgets

| Metric | Budget |
|--------|--------|
| `intents.suggest` (registry lookup + cap/trust filter) | < 5ms p95 (small indexed table; cached, invalidated on install/uninstall/grant change) |
| Menu open → contributed items rendered | within the existing menu-open budget ([13](../shell/13-frontend-stack.md)); suggestion runs synchronously off the warm cache |
| Contribution index rebuild (on install/uninstall) | < 100ms p95 |

The registry is tiny relative to the entity store; suggestion is a cheap metadata query, not a content scan.

## Non-goals

- **Plugins for plugins.** An app still cannot register a handler on behalf of another ([17 §Non-goals](17-interoperability.md)); a contribution is the contributor declaring its own capability. The host only *surfaces* what the shell indexes.
- **Contributor code in the host.** A contributed action never executes in the host's renderer; it dispatches an intent. No shared memory, no callback into the host.
- **Inventing verbs at runtime.** The namespace stays curated ([17 OQ-30 resolved]); new verbs are shell releases.
- **A general message bus / broadcast.** Unchanged from [17](17-interoperability.md) — request/response or fire-and-forget by intent only.
- **Unbounded third-party placement.** Sideloaded contributions are trust-gated (above); the surface is not an open billboard.

## Phasing

| Capability | v1 | post-v1 |
|------------|----|----|
| `Open with…` (the `open` verb half) | ✓ ([57](57-open-resolution.md)) | — |
| `intents.suggest` registry pass in `buildObjectMenuItems` | ✓ | — |
| `useContributedActions` / `<ActionMenu>` SDK primitive | ✓ | — |
| `process`/`share`/`convert`/`export` contributions in object + cover + selection menus | ✓ | richer surfaces |
| Trust-tier gating for sideloaded contributions | ✓ (basic: inline vs. More…) | per-contribution review |
| Value-level applicability predicates | — | ✓ (OQ-AS-2) |
| Dedicated `generate` verb (if needed) | — | ✓ (OQ-AS-5) |

## Cross-doc reconciliation needed

Tracked as follow-ups:

- **[17-interoperability.md](17-interoperability.md)** — the inline `> **Open:**` at §The standard intent verbs is stale (OQ-30 is resolved); the "Discoverability surfaces" + "More Actions" lines are concretized here. Add a forward pointer to this doc.
- **[37-cross-app-navigation.md](../shell/37-cross-app-navigation.md)** — note that `buildObjectMenuItems` gains the `intents.suggest` pass specified here; `extraItems` remains for an app's *own* actions.
- **[09-shared-sdk-catalog.md](../apps/09-shared-sdk-catalog.md)** — add `useContributedActions` / `<ActionMenu>` to the catalog.
- **[22-ai-foundations.md](22-ai-foundations.md)** + **[62-agent-harness.md](62-agent-harness.md)** — the Agent app is the marquee *contributor*; "AI ships as an installable app, not baked into the shell" is concretized by this surface.
- **impl-plan** — file the action-surface rungs (suggestion pass + SDK primitive + trust gating) after the open-resolution work.

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-AS-1** — Verb-to-surface eligibility: which curated verbs may surface on which menu (object/cover/selection/block). Lean: `process`/`convert`/`compose`/`share`/`export` on object+selection, `insert` on editor selection, `open` via open-resolution.
- **OQ-AS-2** — Applicability granularity: type/mime/format discriminators only (cheap) vs. value-/content-level predicates ("only Notes containing an image"). Lean: discriminators in v1; predicates post-v1 (per-menu-open cost).
- **OQ-AS-3** — Trust tier for third-party contributions: do sideloaded apps' actions appear inline, or under "More…" until promoted? Is there per-contribution review for catalog apps? Lean: first-party + catalog inline, sideload under "More…".
- **OQ-AS-4** — Inline cap `N` per group and the grouping thresholds (the concrete UX numbers).
- **OQ-AS-5** — Generative-from-nothing actions: a dedicated `generate` verb, or keep using `process` with `kind`? Lean: `process` in v1; revisit if source-less generation becomes common.

## Summary

- Brainstorm should feel like a real OS: **install an app and relevant new actions appear across other apps' menus** — the Share-sheet / Services / Quick-Actions model, made native.
- The **mechanism already exists** (intents registry, curated verbs, `intents.suggest`, the shell menu component). The missing wire is making menus suggestion-aware; this doc ships it as **two SDK framework elements** — a *contributor* declaration (manifest intent + presentation metadata) and a *host* primitive (`useContributedActions` / `<ActionMenu>`) — identical for first- and third-party apps.
- **Security is by construction:** a contribution *renders in the host, executes in the contributor's sandbox*, fail-closed; the host gains nothing. The [17](17-interoperability.md) "no plugins for plugins" invariant holds — the shell mediates everything.
- **The hard part is restraint:** relevance-gating, grouping, inline caps + "More…", trust tiers, and per-app disable keep the surface from becoming a junk drawer.
- This is the **composability payoff** of the app platform — and the mechanism by which **AI stays optional**: the Agent app is one contributor among many; uninstall it and its actions vanish.
</content>
</invoke>
