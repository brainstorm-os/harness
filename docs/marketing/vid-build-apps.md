# Build a new app inside Brainstorm (VID-build-apps)

An episode of the app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): the self-hosting
story — **Brainstorm runs apps you wrote inside it.** You write an app's files in
the code editor, install them straight from the vault, and it's a live,
sandboxed, capability-gated app in your grid, reading your real data. Then the
**agent writes a second one, the same way**. Target length **1:30–1:50**; the
shipped cut is **1:32**.

The differentiator: it's an **OS for your knowledge that extends itself**, and
the app you just wrote — or the one the agent wrote — is held by the *same*
sandbox + capability ledger as every bundled app. New code, however it got
there, still can't touch anything you didn't grant it.

> **✅ PRODUCTION STATUS — filmable.** Rewritten 2026-07-29 against what actually
> shipped. The earlier draft assumed an in-app IDE program (`IDE-0`→`IDE-5`) with
> an esbuild build-service; **none of that was ever built, and none of it is
> needed** — the platform requires no build step at all, which is a better story
> than the one it replaces. What this script uses is real and on `main`:
> `AppForge-1` (install from a local folder / `.brainstorm` file, shell #364),
> `AppForge-2` (**install from vault code files**, shell #366 — the payoff beat),
> `AppForge-3` (the agent's `propose-code-file` staged artifact, shell #365).
> The one scripted element is the **model's output** in the agent act, via the
> established capture-only `BRAINSTORM_DEMO_AGENT=appforge` provider — the tray,
> the approval, the entity writes and the install are all the real pipeline
> (same honesty posture as `vid-agent-team`).

**The hero fact this episode is built on: an app here is two files.** A
`manifest.json` and an `index.html` that talks to `window.brainstorm`. No
bundler, no `npm install`, no terminal, no build. That is not a simplification
for the camera — it is the actual platform contract (`main/apps/manifest.ts`
requires only `id`, `name`, `version`, `sdk: "1"`, `entry`, `capabilities`).

Capture runs against the synthetic **Northbound Studio** world (never the live
dogfood vault, owner rule 2026-07-19) via the shared promo pipeline; scene
drivers live in `tests/dogfood/promo/vid-build-apps.spec.ts`, scene table in
`tools/promo/build-apps-scenes.mjs`.

## The two apps

Both are genuine two-file, no-build apps. Both ask for the **same single scoped
capability**, `entities.read:brainstorm/Project/v1`, and nothing else. Both are
installed through `apps:install-from-vault` and boxed by the same ledger. If
either doesn't run on camera, the episode doesn't ship.

| | **Client Pulse** — she writes it | **Milestones** — the agent writes it |
|---|---|---|
| id | `studio.northbound.client-pulse` | `studio.northbound.milestones` |
| what it is | a status board: every client project with a status dot, description and milestone label, ordered by name | a timeline: a countdown to the soonest milestone, then each project as a lead-time lane ordered by date |
| source of truth | `tests/dogfood/promo/client-pulse-source.ts` (typed on camera) | the scripted model output, `DEMO_AGENT_APPFORGE_SCRIPT` in shell `main/ai/demo-agent-provider.ts` (drafted on camera) |
| asserted by | `07-launch` renders ≥1 seeded client | `assertDraftedAppIsReal` (harness `promo/milestones-source.ts`) + `14-payoff` renders ≥1 lane |

### Why the agent's app is a real second product, not a hello-world

*(owner decision 2026-07-30, after watching the 1:32 cut.)* The shipped cut had
the agent draft a `hello-app` whose entire body was `<h1>Hello, Brainstorm!</h1>`
with `"capabilities": []`, and then closed on **Client Pulse** — her app — under
narration about the agent's. Three things were wrong and they compounded:

1. **The toy contradicted the claim.** The line is *"Or she doesn't write it at
   all"* — i.e. the agent does work equivalent to hers. A hello-world with no
   capabilities proves neither that the agent can write an app nor that the
   broker holds agent-written code, because an app that asks for nothing can't
   be told no.
2. **The payoff opened the wrong app**, so "two apps, one she wrote, one the
   agent wrote" was asserted over a picture of one of them.
3. It also meant the reel never showed the agent's app *running*, which is the
   only thing that makes "it wrote an app" checkable.

So the demo script now drafts **Milestones** — a different product from Client
Pulse, with its own id, asking for the same one scoped capability, rendering the
same seeded projects on a date-ordered timeline. It installs alongside hers, and
the closing shot is **the agent's app running**. The bytes live with the scripted
model output in the shell (that is what the agent must *produce* on camera); the
harness holds the identity constants and an invariant check —
`assertDraftedAppIsReal` fails the run if the drafted manifest lacks `sdk: "1"`,
asks for anything other than the one capability, or if the page is a stub or a
copy of Client Pulse. A prior regression shipped a drafted manifest without
`sdk`, which greyed out the picker's Install button; the shell-side test
`demo-agent-provider.test.ts` runs the real `validateManifest` over it and the
harness re-checks the bytes the vault actually received.

## Voiceover script (1:32 as rendered)

> **[S0 slide]** An OS for your knowledge — that runs the apps you write.
> **[S1]** Nothing built in does client pulse.
> **[S2]** So she writes one. Two files. The manifest says what it is — and
> exactly what it may touch.
> **[S3]** And a page. It asks the vault for her clients and draws them. Real
> data — no export, no build step.
> **[S4]** She installs it straight from the vault. No zip, no terminal.
> **[S5]** Exactly what she's about to run — and what it asked for.
> **[S6]** There it is. A real app in her grid.
> **[S7]** Its own window, its own sandbox, showing her actual clients.
> **[S8]** It gets exactly what she granted. Ask for the whole vault, and the
> broker says no.
> **[S9]** Or she doesn't write it at all — she asks the agent for a milestones
> board.
> **[S10]** It drafts two files: a manifest asking for the same single
> permission, and a page she reads before anything is saved.
> **[S11]** She approves — and only then is anything written.
> **[S12]** The files land beside the ones she wrote.
> **[S13]** Same picker, same consent, same install.
> **[S14]** Two apps that weren't there this morning — one she wrote, one the
> agent wrote.
> **[S15 slide]** A knowledge OS that runs the apps you write.
> getbrainstorm.online

## Scene table

Ids map 1:1 to `tools/promo/build-apps-scenes.mjs`; `slide` entries are
render-side cards with no captured clip. `speed` is a *floor* — `render.mjs`
raises it per scene so the whole captured action fits the budget. This table
sets **no floors at all**: every budget is fitted to a measured clip, and where a
hold is wanted, the driver shoots it rather than freezing on a padded tail.

| # | id | secs | beat | on screen |
|---|----|------|------|-----------|
| 0 | `00-slide-hook` | 5 | slide | "It runs the apps you write" |
| 1 | `01-the-gap` | 3 | S1 | One sweep across the app grid, parking on the **Code** tile. Three seconds, not six — a hand-off, not a tour |
| 2 | `02-manifest` | 8 | S2 | Code editor: new file `client-pulse/manifest.json` — the FILES sidebar grows a **`client-pulse` folder node** with the file nested under it. Typed: id, name, version, `sdk`, `entry`, and one capability line (`entities.read:brainstorm/Project/v1`). Hold on the capability line |
| 3 | `03-page` | 9 | S3 | New file `client-pulse/index.html` — the folder now holds **both** files. The skeleton and the `window.brainstorm` query typed, then the finished file revealed in one motion |
| 4 | `04-install-from-vault` | 5 | S4 | Marketplace → **Install from…** → **From vault code files…** → picker lists the **Client Pulse** candidate found in the vault |
| 5 | `05-consent` | 5 | S5 | The install sheet: name · id · version · **requested capabilities** · unsigned advisory. Confirm. *The only full pass over this flow in the film* |
| 6 | `06-installed` | 4 | S6 | Success toast → marketplace dismissed **in the beat** → the grid, cursor landing on the new **Client Pulse** tile |
| 7 | `07-launch` | 5 | S7 | Open it — summary strip + real Northbound clients, cards rising in, in its own window |
| 8 | `08-walls` | 6 | S8 | **Continues 07 in the same window.** The grant the app prints in its own header (`vault access: entities.read:brainstorm/Project/v1`), then **both probes**: the granted read succeeds in green, `vaultEntities.list()` comes back refused in red, in the broker's own words. No dialog |
| 9 | `09-agent-ask` | 7 | S9 | Agent app, empty thread: *"Build me a milestones board."* typed, sent, **Thinking…**, and the first code-file card landing |
| 10 | `10-agent-drafts` | 8 | S10 | Both cards read: the manifest's capability line, then the page's code scrolled — real CSS, a real `entities.query`, ~200 lines. Not a stub |
| 11 | `11-agent-approve` | 6 | S11 | Tray scrolled back to the top, **Add to vault** on both cards, tray empties, the created-objects row appears |
| 12 | `12-agent-files` | 4 | S12 | Code editor: the FILES tree now carries a **`milestones/` folder next to `client-pulse/`** — the agent's files in the same place as hers, opened and scrolled |
| 13 | `13-agent-install` | 5 | S13 | The same picker → row → consent sheet → confirm, played at ~2.5× because the viewer already watched it in full at 04–05 |
| 14 | `14-payoff` | 7 | S14 | The grid carrying **both** new tiles, then **the agent's app** opened — its lanes painting in, reading the same projects through the same broker |
| 15 | `15-title` | 5 | slide | Logo + getbrainstorm.online |

Content 82s + 10s of slides = **1:32**, unchanged from the previous cut — but
redistributed. Every budget carries ≥0.5s of headroom over its measured VO line;
a scene's budget is a hard ceiling on its narration (`atrim=0:seconds`), so
`promo:vo:build-apps` prints `<line>s / <budget>s` per scene and must be re-run
after any wording change. The budgets are fitted to a real capture (no scene
truncated, none with more than a beat of held tail); refit them against a fresh
one if the drivers change, and **never against a run recorded while `build:apps`
is running** — that inflates every clip 30–60%.

### The pacing pass: what changed and why (2026-07-30)

*(owner, after the 1:32 cut: "there are some problems with montage … the agent
part is not very well designed … you have a screen where just mouse move at the
start and 2 times install dialogue shows, so it needs to be more dynamic.")*

Four structural edits, same 92s total:

1. **The idle opening is gone.** `01-the-gap` ran 5–6s of a cursor drifting over
   a settled grid — motion carrying no information. It is 3s now, one sweep, and
   it ends parked on the Code tile so the cut into the editor is a hand-off.
2. **The install chrome is shown once.** The picker → consent-sheet flow
   appeared three times in the old cut (her app, the walls beat's recall, the
   agent's app). It now plays **once in full** for her app (`04`+`05`) — that is
   the beat that teaches what installing means — and **once compressed** for the
   agent's (`13`, five seconds at ~2.5×). Re-running it at length taught nothing
   and was the main reason the back half dragged.
3. **The walls beat lost its dialog** (see below).
4. **The agent act roughly doubled**, from 15s across two scenes to **30s across
   four** (`09`→`13`): the prompt typed, the reply thinking, the cards arriving,
   the code *read* rather than glimpsed, the approve gesture landing, and the
   files appearing in the Code editor's tree beside hers. This is the sequence
   that proves "the OS wrote an app", so it is now the longest act in the film
   rather than the shortest.

### Why the walls beat stopped recalling the consent sheet

*(supersedes the 2026-07-30 note "Why the walls beat shows the consent sheet,
not the grants popover", which is why that section is gone.)* That decision was
right about the surface it rejected — Settings → Security → **Capability grants**
truthfully lists ~22 rows for Client Pulse, because every installed app receives
a shell baseline on top of what its manifest asked for, and that reads as a
contradiction under *"it gets what she granted"*. It was wrong to reach for a
dialog instead. Re-opening the install sheet made the picker/consent chrome the
third-most-shown surface in the film, cost ~4s of staging, and put a modal in
front of the app at the exact moment the point is about the app.

The grant is already on screen **inside the app**: Client Pulse prints
`vault access: entities.read:brainstorm/Project/v1` in its own header, read from
`window.brainstorm.capabilities`, and the granted ✓ / refused ✕ probe pair sits
in its footer. So `08-walls` holds on the header line and runs the pair, in the
same window `07-launch` left open — no staging, no dialog, and the whole beat
lives where the claim lives. Same claim, one fewer dialog, five seconds cheaper.

*(A follow-up worth filing on its own merits, unchanged: the grants popover does
not distinguish shell-baseline capabilities from app-requested ones, which is
confusing outside the video too.)*

### Why the episode ends on the agent's app

*(pacing pass 2026-07-29 moved the refusal off the ending; this pass fixed what
the ending was.)* The first cut ran … agent → walls → title, so the last content
frame was a red `refused — …` line, which reads "the app crashed". The refusal
moved to `08`, one beat after the app has just read her clients — same app, same
window, one call inside the grant and one outside it — and the app runs **both**
probes so a lone red line reads as a boundary, not a failure.

The closing scene then has to be affirmative, and it has to match the sentence
over it. It is now: the grid carrying two tiles that were not there at the top of
the episode, and then **Milestones** — the app the agent wrote — opening and
painting its lanes in from the vault's real projects.

### The apps take shape as folders (scenes 02–03, 12)

*(final capture 2026-07-30, against shell #372.)* The Code editor's FILES
sidebar is a **folder tree** (`9.7.12`, `apps/code-editor/src/logic/path-tree.ts`)
— a folder is a shared `/`-prefix of the `CodeFile` paths that exist, and folders
render expanded by default. So the sidebar grows a real **`client-pulse` folder
node** the moment the first file is named (scene 02), the second file lands
inside it (scene 03), and after the agent's approval a **`milestones/` folder
appears next to it** (scene 12) — the agent's output filed exactly where hers is,
which is the whole argument of that beat. Scene 04's vault picker then reads
"**Client Pulse** · client-pulse · 2 files" — the same folder, named back at the
viewer by the installer.

### Why the Client Pulse page looks the way it does

The 2026-07-29 pass rebuilt it (`tests/dogfood/promo/client-pulse-source.ts`)
because it occupied the top third of a 16:9 window and left a large empty white
area under it for two whole scenes — `07-launch` alone was 9s of a near-static
frame (its clip was 981 KB against ~15 MB for the moving scenes). It is still a
genuine two-file, no-build app reading `entities.read:brainstorm/Project/v1` and
nothing else; what changed is ordinary app code:

- the page owns the viewport (`min-height: 100vh` column, board `flex: 1` with
  stretching grid rows, walls panel pinned to the bottom edge);
- a three-tile summary strip (clients · active · next milestone) derived from the
  **same** granted query — no second capability, no invented data;
- cards rise in with a staggered delay and light up on hover. This is not only
  cosmetic: the capture records through the CDP screencast, which emits frames
  **on paint**, so a page that never repaints yields almost no footage and
  `render.mjs` then clones its last frame out to the scene budget.

Milestones is built to the same brief for the same reason — a hero countdown, a
lane per project with a lead-time bar, staggered rise-in on load.

### Why the capability is scoped, not `entities.read:*`

The earlier draft put `entities.read:*` on the manifest's one capability line.
Both shipped apps ask for **`entities.read:brainstorm/Project/v1`** instead, and
that is a better episode, not a smaller one: a wildcard read makes S8's "it gets
what she granted" an assertion, while a scoped read makes it **demonstrable**.
The board renders the vault's real client projects, and the same app asking for
the whole vault (`vaultEntities.list()`, which statically requires
`entities.read:*`) comes back refused — from the broker, in the broker's own
words, with no staging:

> refused — studio.northbound.client-pulse lacks capability for vault-entities.list

One honesty note: a capability denial is **silent** everywhere else in the
product — it lands in `<vault>/logs/audit.log` as `ipc.denied` and has no UI. The
refusal on camera is visible only because *the demo app itself* catches the
rejected promise and prints it. That is a truthful thing for an app to do (any
app can), but do not describe it as a shell-level warning, and do not stage a
"denial toast" or a Settings denials list — neither exists.

## Notes for the edit

- **Scenes cross-dissolve; they do not fade to black.** `render.mjs` used to
  fade every segment out to black and in from black and then concatenate, which
  put three frames of *pure black* at every scene boundary — the one at 1:27 was
  the one that got noticed (a bright grid meeting a dark title card), but it was
  in all thirteen joins and it reads as a montage seam. Segments are now
  rendered `FADE` seconds long and joined with `xfade` at an offset of the
  running scene total, so scene starts — and therefore the VO track and the SRT
  — are unchanged to the frame, the film is still exactly `sum(seconds)` long,
  and only its opening and closing touch black.
- **S4→S6 is the payoff.** The viewer watched those two files get typed; now the
  same bytes are an icon in the grid. Hold the icon reveal — that's the "wait, it
  actually installed it" beat. `06-installed` dismisses the marketplace *inside*
  the beat so the tile is genuinely on screen; the capture asserts it is, because
  an early cut played that line over a list of apps that were already there.
- **Do not show a terminal, `npm install`, or a `package.json` full of deps.**
  Not because it would look bad, but because it would be *false*: there is no
  build step in this path. The absence of a terminal is the feature.
- **The consent sheet is not a speed bump, it's the product** — but it only
  earns a full pass once. Let it breathe in `05`; compress it in `13`.
- **The proposal tray is height-capped.** Two code-file cards (each a 240px
  preview plus head and actions) used to push the second card's Approve row and
  the composer clean off the bottom of the window, with nothing scrollable to
  reach them — that is why the shipped cut's agent scenes were four frozen
  seconds of a half-visible card. The tray now caps at `52vh` and scrolls
  internally (shell `apps/agent/src/styles.css`), which is a real bug fix, not a
  camera trick; the driver then reads card one, travels to card two, and scrolls
  back up before approving.
- **Keep the agent prompt short.** The conversation title is the first message
  and the header title face ellipsises at `min(440px, 60vw)`; the previous
  prompt truncated mid-sentence on camera ("Build me a small hello app I can
  install — a manifest and a…"). `"Build me a milestones board."` fits.
- **S9–S13 pair with VID-agent.** Same propose→approve gesture, bigger artifact.
  If both episodes are out, cross-cut a half-second of the note-card next to the
  code-file card to make the parallel explicit.
- **S8 sells safety without a lecture** — one grant line, one granted call, one
  refusal, move on. Never end the episode on it.
- **Idle is not footage.** The recorder is the CDP screencast: it emits frames on
  paint, and `render.mjs` clones the last frame out to the scene budget. A `beat`
  on a settled surface is therefore a literal freeze, not a pause — hold only
  where something is still moving or has just changed.
- **Stage surfaces between scenes, never inside one.** `s.scene` starts the
  recorder before the driver runs, so an in-scene `openApp` records ~4s of the
  previous, settled surface. Every app window this reel opens is opened in the
  gap between two scenes — including the new-chat click that starts the agent
  act, which is staged off camera because a miss drops the whole act into a
  seeded thread.
- **The marketplace remembers where it was left.** Dismiss it before clicking
  bare wallpaper: a fixed number of Escapes is not enough against a
  dialog + picker + marketplace stack, and the click then lands on an app card
  and strands the marketplace on a detail page — which killed the agent act in
  the first dry run and recorded 179s of a frozen detail page. `backToGrid`
  gates the click on the overlay count being zero, and `openVaultInstaller`
  walks *Back* if it finds no Install-from button.
- Say "install", never "compile" or "build" — the words have to match the model.

## What is real vs. scripted (state this if anyone asks)

| Element | Status |
|---|---|
| **Client Pulse** — the app she types, its code, and that it runs | **Real** — there is no build step to fake |
| **Milestones** — the app the agent drafts, its code, and that it runs | **Real** — it installs through the same path and renders the same vault rows; `assertDraftedAppIsReal` fails the capture if it is a stub |
| Install from vault code files, the consent sheet, capabilities, the sandbox | **Real** (`AppForge-1/2`) |
| The agent staging code files, approve → entity writes → install | **Real** (`AppForge-3`) |
| The agent's *model output* in S9–S11 (i.e. *which* app it decides to write) | **Scripted** (`BRAINSTORM_DEMO_AGENT=appforge`) — capture-only, so takes are deterministic |
| The vault contents | Synthetic Northbound Studio seed |

## Dependencies

All shipped — `AppForge-1` (#364), `AppForge-2` (#366), `AppForge-3` (#365).
The remaining gate is the `VID-*` track's own: polish gate (capture dry-run
clean; any defect files a `POLISH-*` rung and blocks the shoot) → script +
capture → publish. The dry-run doubles as `AppForge-2`'s owed real-shell
verification (it shipped proven at the IPC/installer layer only).

## One-line hooks (for the post / thumbnail)

- "An OS for your knowledge — that runs the apps you write."
- "An app here is two files. Watch one go from typed to installed in ninety seconds."
- "Then I asked the agent to write the second one. It still can't touch what you didn't grant."
- Thumbnail: code-editor pane on the left, the freshly-installed app icon lighting
  up in the grid on the right.
