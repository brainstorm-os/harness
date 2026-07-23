# Build a new app inside Brainstorm (VID-build-apps)

An episode of the app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): the self-hosting
story — **Brainstorm builds its own apps, from inside itself.** You author a real
React/TS app in the code editor (or let the agent write it), the shell builds it
in-process, and it installs as a live, sandboxed, capability-gated app in your
grid. Target length **~2:10**.

The differentiator: it's an **OS for your knowledge that extends itself**, and
the apps you (or the agent) build are held by the *same* sandbox + capability
ledger as every bundled app — so new code, however it got there, still can't
touch anything you didn't grant it.

> **⚠️ PRODUCTION STATUS — do NOT capture yet.** This is the *target* experience.
> It depends on the in-app IDE program (`IDE-0`→`IDE-5`) which is **not built**:
> the esbuild build-service worker (`IDE-1`), the code-editor → project-workspace
> evolution (`IDE-2`), the Build-&-Install front-door (`IDE-3`), the in-app
> scaffold (`IDE-4`), and the agent-authored-app rung (`IDE-5`, which reuses
> Agent-11). Film order: **VID-agent first** (shipped), this one after `IDE-3`
> lands (`IDE-5` unlocks the agent-builds-it act). Script now so the build aims
> at a demo, not the reverse.

Capture will run against the synthetic **Northbound Studio** world (never the
live dogfood vault, owner rule 2026-07-19), via the shared promo pipeline; scene
drivers will live in `tests/dogfood/promo/vid-build-apps.spec.ts`.

## Voiceover script (~2:10)

> **[S0 slide]** Brainstorm is an operating system for your knowledge. So what if
> it could build its own apps — from inside itself?
> **[S1]** Mira wants something the built-in apps don't do: a "client health"
> board, her way. She opens New app.
> **[S2]** A real project drops into her vault — a working React app: a manifest,
> a component, a live view of her real data. She opens it in the code editor.
> **[S3]** She changes a few lines — real React, against Brainstorm's own SDK.
> The list, the columns, the colors. Her app, her rules.
> **[S4]** Build and install. Brainstorm compiles it right here — no terminal, no
> setup — and her new app is in the grid, running, reading her actual vault.
> **[S5]** Or she doesn't write it at all. She asks the agent: build me a client-
> health board. It proposes the app — the manifest, the code — the same way it
> proposes a note. She reviews it, and builds it. The OS just wrote her an app.
> **[S6]** And here's the quiet part: this is untrusted code — hers, or the
> agent's — and it's held by the same sandbox as every other app. It sees only
> what she granted. Build anything. It still can't reach past its walls. All
> local.
> **[S7 slide]** A knowledge OS that builds its own apps. getbrainstorm.online.

## Scene table

| # | Screen | On-screen action | VO / caption |
|---|--------|------------------|--------------|
| S0 | Title slide over the Brainstorm dashboard (app grid) | Fade in | "It builds its own apps" |
| S1 | App grid → "New app" | Click New app; a name/id dialog ("Client Health") | VO S1 |
| S2 | Code editor opens on the scaffolded project | File tree visible (`manifest.json`, `src/app.tsx`); the starter app already renders a live `useVaultEntities` list in a side preview | VO S2 · caption: "A real React app, in your vault" |
| S3 | Code editor, `src/app.tsx` | Type a few lines — add a status column / colour by health; SDK imports visible (`@brainstorm-os/react-yjs`) | VO S3 |
| S4 | Build & Install action | Progress ("Building…") → success toast → cut to the app grid with the new **Client Health** icon → open it: it's live, showing real Northbound clients | VO S4 · caption: "Compiled in-app. No terminal." |
| S5 | Agent app (the chain to VID-agent) | Ask: *"Build me a client-health board from my contacts."* → the agent proposes an **app** as artifacts (manifest + files shown as a reviewable card/diff) → review → **Build & Install** → the app appears | VO S5 · caption: "Describe it. The OS builds it." |
| S6 | Split: the new app running + a capability sheet | Show the app's granted capabilities (e.g. `entities.read:*` only); attempt something ungranted → politely refused | VO S6 · caption: "Untrusted code, fully contained" |
| S7 | Title slide | Logo + URL | VO S7 · "getbrainstorm.online" |

## Notes for the edit

- **S4 is the payoff** — an app the viewer watched get authored is now a real
  icon in the grid, reading real data. Hold the reveal; that's the "wait, it
  actually built it" moment.
- **S5 is why this pairs with VID-agent.** Same propose→approve gesture, bigger
  artifact. If both videos are out, cross-cut a half-second of the Agent-11
  note-card next to the app-card to make the parallel explicit.
- **S6 sells the safety without a lecture.** One granted-capabilities sheet + one
  polite refusal says more than a paragraph. Keep it to a beat.
- Do **not** show `npm install`, a package.json full of deps, or a terminal —
  the in-app apps build against the shell-provided SDK/React only (fixed
  externals, no arbitrary npm). Showing a terminal would misrepresent the model
  *and* undercut the "no setup" promise.

## Dependencies to land before this can be filmed

| Rung | What it unblocks in this script |
|------|--------------------------------|
| `IDE-1` build-service worker (esbuild) | S4 "Building…" → running app |
| `IDE-2` project workspace (code-editor writes a real project tree) | S2/S3 authoring |
| `IDE-3` Build & Install front-door | S4 one-click |
| `IDE-4` in-app scaffold ("New app") | S1/S2 |
| `IDE-5` agent-authored apps (reuses Agent-11) | S5 (the agent act) |

## One-line hooks (for the post / thumbnail)

- "An OS for your knowledge — that builds its own apps."
- "Describe an app. Watch Brainstorm build it. It still can't touch what you didn't grant."
- Thumbnail: a code-editor pane on the left, the freshly-built app icon lighting up in the grid on the right.
