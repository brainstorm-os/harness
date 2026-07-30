# Build a new app inside Brainstorm (VID-build-apps)

An episode of the app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): the self-hosting
story — **Brainstorm runs apps you wrote inside it.** You write an app's files in
the code editor (or let the agent draft them), install them straight from the
vault, and it's a live, sandboxed, capability-gated app in your grid, reading
your real data. Target length **1:30–1:50**; the shipped cut is **1:32**.

The differentiator: it's an **OS for your knowledge that extends itself**, and
the app you just wrote is held by the *same* sandbox + capability ledger as every
bundled app — so new code, however it got there, still can't touch anything you
didn't grant it.

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

**The demo app: "Client Pulse"** — a small board that lists Northbound Studio's
clients with a status dot, reading the vault through `entities.read`. It must be
genuinely working code that genuinely installs; if the app on camera doesn't run,
the episode doesn't ship.

## Voiceover script (1:32 as rendered)

> **[S0 slide]** An OS for your knowledge — that runs the apps you write.
> **[S1]** Mira wants a client pulse board. Nothing built in does it — she writes
> one.
> **[S2]** An app here is two files. A manifest that says what it is — and exactly
> what it may touch. One line: read her projects. Nothing else.
> **[S3]** And a page. It asks the vault for her clients and draws them. Real data
> — no export, no build step.
> **[S4]** She installs it straight from the vault. No folder, no zip, no
> terminal.
> **[S5]** Brainstorm shows her exactly what she's about to run, and what it asked
> for.
> **[S6]** And there it is. A real app, in her grid.
> **[S7]** Its own window, its own sandbox — showing her actual clients. Typed to
> installed in about a minute.
> **[S8]** Here's the quiet part: untrusted code, behind the same walls as
> everything else. It gets what she granted — ask for more, and the broker says
> no.
> **[S9]** Or she doesn't write it at all. She asks the agent, and it drafts the
> files — code she can read before anything is saved.
> **[S10]** She approves them, they land in the vault as real files, and install
> the same way.
> **[S11]** Two apps that didn't exist this morning. One she wrote, one she asked
> for — both in the grid, both behind the same walls.
> **[S12 slide]** A knowledge OS that runs the apps you write.
> getbrainstorm.online

## Scene table

Ids map 1:1 to `tools/promo/build-apps-scenes.mjs`; `slide` entries are
render-side cards with no captured clip. `speed` is a *floor* — `render.mjs`
raises it per scene so the whole captured action fits the budget; a hand-set
floor is only for scenes whose last frame is a hold worth freezing on.

| # | id | secs | speed | beat | on screen |
|---|----|------|-------|------|-----------|
| 0 | `00-slide-hook` | 5 | — | slide | "It runs the apps you write" |
| 1 | `01-the-gap` | 5 | **1.2** | S1 | Dashboard/app grid; Mira scans it — nothing does client pulse |
| 2 | `02-manifest` | 10 | auto | S2 | Code editor: new file `client-pulse/manifest.json` — the FILES sidebar grows a **`client-pulse` folder node** with the file nested under it. Typed: id, name, version, `sdk`, `entry`, and one capability line (`entities.read:brainstorm/Project/v1`). Hold on the capability line |
| 3 | `03-page` | 10 | auto (~1.4×) | S3 | New file `client-pulse/index.html` — the folder now holds **both** files. The skeleton and the `window.brainstorm` query typed, then the finished file revealed in one motion |
| 4 | `04-install-from-vault` | 6 | auto | S4 | Marketplace → **Install from…** → **From vault code files…** → picker lists the **Client Pulse** candidate found in the vault |
| 5 | `05-consent` | 6 | auto | S5 | The install sheet: name · id · version · **requested capabilities** · unsigned advisory. Confirm |
| 6 | `06-installed` | 5 | **1.25** | S6 | Success toast → marketplace dismissed **in the beat** → the grid, cursor landing on the new **Client Pulse** tile |
| 7 | `07-launch` | 7 | auto | S7 | Open it — summary strip + real Northbound clients, cards rising in, in its own window |
| 8 | `08-walls` | 10 | auto | S8 | **The consent sheet recalled** via the vault picker's *Install* → sheet → *Cancel* (what she actually agreed to) — *not* the Settings grants popover; then, in the app, **both probes**: the granted read succeeds in green, `vaultEntities.list()` comes back refused in red, in the broker's own words |
| 9 | `09-agent-drafts` | 8 | auto | S9 | Agent app: *"Build me a small hello app I can install."* → two staged cards (`manifest.json`, `index.html`) with code previews |
| 10 | `10-agent-approve` | 7 | auto (~1.9×) | S10 | Approve both → files land in the vault → same install path → same consent sheet |
| 11 | `11-payoff` | 8 | auto | S11 | The grid carrying **both** new tiles, then Client Pulse opened one last time — its cards painting in |
| 12 | `12-title` | 5 | — | slide | Logo + getbrainstorm.online |

Content 82s + 10s of slides = **1:32** as rendered (down from 1:45). Every
budget carries ≥0.35s of headroom over its measured VO line (the tightest is
`08-walls` at 9.62s / 10s) — a scene's budget is
a hard ceiling on its narration (`atrim=0:seconds`), so `promo:vo:build-apps`
prints `<line>s / <budget>s` per scene and must be re-run after any wording
change. The budgets above are fitted to a real capture (every scene lands
1.05–1.95×, none truncated, none with more than a beat of held tail); refit them
against a fresh one if the drivers change, and **never against a run recorded
while `build:apps` is running** — that inflates every clip 30–60%.

### Why the walls beat is scene 08, and the episode ends on the grid

*(pacing pass 2026-07-30, after the owner watched the 1:45 cut.)* The first cut
ran … agent → walls → title, so the **last content frame of the episode was a
small red `refused — …` line** under a mostly-empty white page. It is the
strongest proof in the reel and it is completely honest — but as an *ending* it
reads "the app crashed", which is the opposite of the claim the hook makes.

Three changes, no product change and nothing dropped:

1. **The refusal moved to scene 08**, one beat after the app has just read her
   clients. Same app, same window, one call inside the grant and one outside it
   — the contrast is at its most legible there, and it no longer has to carry
   the ending.
2. **The app runs both probes**, granted and ungranted, side by side (green ✓
   and red ✕). A lone red line reads as a failure; a pair reads as a boundary.
3. **A new closing scene `11-payoff`** — the grid carrying both tiles that were
   not there at the top of the episode, then Client Pulse opened one last time
   with its cards animating in. Affirmative, and it pays off "it runs the apps
   you write" with a picture rather than a sentence.

### The app takes shape as a folder (scenes 02–03)

*(final capture 2026-07-30, against shell #372.)* The Code editor's FILES
sidebar is now a **folder tree** (`9.7.12`, `apps/code-editor/src/logic/path-tree.ts`)
— a folder is a shared `/`-prefix of the `CodeFile` paths that exist, and folders
render expanded by default. The two files this episode types are
`client-pulse/manifest.json` and `client-pulse/index.html`, so the sidebar grows
a real **`client-pulse` folder node** the moment the first file is named, and the
second file lands inside it.

That is better storytelling than the flat list it replaces and it costs nothing:
scene 02 shows the app coming into existence *as a thing with a shape*, scene 03
shows it filling out, and scene 04's vault picker then reads
"**Client Pulse** · client-pulse · 2 files" — the same folder, named back at the
viewer by the installer. No driver change was needed (the rename popover takes a
full path, and `.editor__file` / `[title="<path>"]` still address a file row), so
this is a doc-of-record note rather than a script change.

### Why the demo app was restyled

The same pass rebuilt the Client Pulse page (`tests/dogfood/promo/client-pulse-source.ts`)
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

### Why the capability is scoped, not `entities.read:*`

The earlier draft put `entities.read:*` on the manifest's one capability line.
The shipped app asks for **`entities.read:brainstorm/Project/v1`** instead, and
that is a better episode, not a smaller one: a wildcard read makes S8's "it gets
what she granted" an assertion, while a scoped read makes it **demonstrable**.
The board renders the vault's real client projects, and the same app asking for
the whole vault (`vaultEntities.list()`, which statically requires
`entities.read:*`) comes back refused — from the broker, in the broker's own
words, with no staging:

> refused — studio.northbound.client-pulse lacks capability for vault-entities.list

### Why the walls beat shows the consent sheet, not the grants popover

*(owner decision 2026-07-30, after the second capture.)* The first cut of this
scene opened **Settings → Security → Capability grants**, which truthfully lists
**22** capabilities for Client Pulse — because every installed app receives a
baseline set (`credentials.read:self`, `sharing.read`, `roster.read`, …) on top
of what its manifest asked for. Accurate, but it reads as a contradiction under
the VO *"It gets what she granted."*, and explaining the baseline mid-episode
costs more than the beat is worth.

So the scene recalls the **install consent sheet** instead — the one requested
capability and the unsigned advisory, i.e. exactly what the user agreed to — and
keeps the refusal. Same claim, no asterisk, no product change. The grants
popover is not wrong and is not being hidden; it is simply the wrong surface for
this sentence.

*How it is driven (nothing staged):* the scene re-opens Marketplace → **Install
from…** → **From vault code files…** off camera, then on camera clicks *Install*
on the same **Client Pulse** candidate — which renders the real
`install-from-vault` consent sheet, verbatim (*"Version 1.0.0 ·
studio.northbound.client-pulse. Capabilities requested:
entities.read:brainstorm/Project/v1. This app comes from your vault's code files
and is unsigned — only install apps you trust."*) — holds on it, and dismisses
with **Cancel**. It is a recall of the shipped sheet, not a second install and
not a mock. *(A follow-up worth filing on its own merits: the grants popover
does not distinguish shell-baseline capabilities from app-requested ones, which
is confusing outside the video too.)*

One further honesty note: a capability denial is **silent** everywhere else in
the product — it lands in `<vault>/logs/audit.log` as `ipc.denied` and has no
UI. The refusal on camera is visible only because *the demo app itself* catches
the rejected promise and prints it. That is a truthful thing for an app to do (any
app can), but do not describe it as a shell-level warning, and do not stage a
"denial toast" or a Settings denials list — neither exists.

## Notes for the edit

- **S4→S6 is the payoff.** The viewer watched those two files get typed; now the
  same bytes are an icon in the grid. Hold the icon reveal — that's the "wait, it
  actually installed it" beat. `06-installed` dismisses the marketplace *inside*
  the beat so the tile is genuinely on screen; the capture asserts it is, because
  the first cut played that line over a list of apps that were already there.
- **Do not show a terminal, `npm install`, or a `package.json` full of deps.**
  Not because it would look bad, but because it would be *false*: there is no
  build step in this path. The absence of a terminal is the feature.
- **The consent sheet is not a speed bump, it's the product.** Let it breathe for
  a beat — capabilities and the unsigned advisory on screen are what make the
  sandbox claim in S8 land later. That hold is also why `05-consent` sets no
  `speed` floor: a floor would compress the sheet and freeze the tail on the
  marketplace behind it.
- **S9 pairs with VID-agent.** Same propose→approve gesture, bigger artifact. If
  both episodes are out, cross-cut a half-second of the note-card next to the
  code-file card to make the parallel explicit.
- **S8 sells safety without a lecture** — one consent sheet, one granted call,
  one refusal, move on. Never end the episode on it (see §Why the walls beat is
  scene 08).
- **Idle is not footage.** The recorder is the CDP screencast: it emits frames on
  paint, and `render.mjs` clones the last frame out to the scene budget. A `beat`
  on a settled surface is therefore a literal freeze, not a pause — hold only
  where something is still moving or has just changed.
- **Stage surfaces between scenes, never inside one.** `s.scene` starts the
  recorder before the driver runs, so an in-scene `openApp` records ~4s of the
  previous, settled surface. Every app window this reel opens is opened in the
  gap between two scenes, where the recorder is stopped and the wait is free.
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
| The two-file app, its code, and that it runs | **Real** — there is no build step to fake |
| Install from vault code files, the consent sheet, capabilities, the sandbox | **Real** (`AppForge-1/2`) |
| The agent staging code files, approve → entity writes → install | **Real** (`AppForge-3`) |
| The agent's *model output* in S9 | **Scripted** (`BRAINSTORM_DEMO_AGENT=appforge`) — capture-only, so takes are deterministic |
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
- "Let the agent write it. It still can't touch what you didn't grant."
- Thumbnail: code-editor pane on the left, the freshly-installed app icon lighting
  up in the grid on the right.
