# Build a new app inside Brainstorm (VID-build-apps)

An episode of the app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): the self-hosting
story — **Brainstorm runs apps you wrote inside it.** You write an app's files in
the code editor (or let the agent draft them), install them straight from the
vault, and it's a live, sandboxed, capability-gated app in your grid, reading
your real data. Target length **~2:00**.

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

## Voiceover script (~2:00)

> **[S0 slide]** Brainstorm is an operating system for your knowledge. The apps
> it runs are just apps — including the ones you write yourself.
> **[S1]** Mira wants something the built-in apps don't do: a pulse board for her
> clients, her way. So she writes one.
> **[S2]** An app here is two files. A manifest that says what it is and what it's
> allowed to touch — and a page.
> **[S3]** The page asks the vault for her clients and draws them. Real data, no
> copy, no export. She's writing it in the code editor, in the same vault the app
> will read.
> **[S4]** Now she installs it. From the vault, directly — no folder, no zip, no
> terminal. Brainstorm shows her exactly what she's about to run, and what it
> asked for.
> **[S5]** And there it is. A real app in her grid, in its own sandbox, showing
> her actual clients.
> **[S6]** Or she doesn't write it at all. She asks the agent — and it drafts the
> files, the same way it drafts a note. She reads them, approves them, installs.
> **[S7]** Here's the quiet part: this is untrusted code — hers, or the agent's —
> and it lives behind the same walls as everything else. It sees what she granted
> it, and nothing else. Ask for more, and it's refused.
> **[S8 slide]** A knowledge OS that runs the apps you write. getbrainstorm.online

## Scene table

Ids map 1:1 to `tools/promo/build-apps-scenes.mjs`; `slide` entries are
render-side cards with no captured clip.

| # | id | secs | beat | on screen |
|---|----|------|------|-----------|
| 0 | `00-slide-hook` | 5 | slide | "It runs the apps you write" over the dashboard |
| 1 | `01-the-gap` | 6 | S1 | Dashboard/app grid; Mira scans it — nothing does client pulse |
| 2 | `02-manifest` | 12 | S2 | Code editor: new file `client-pulse/manifest.json`, typed — id, name, version, `sdk`, `entry`, and one capability line (`entities.read:brainstorm/Project/v1`). Hold on the capability line |
| 3 | `03-page` | 14 | S3 | New file `client-pulse/index.html`; the page's real body typed/revealed — `window.brainstorm` call, a list, a status dot |
| 4 | `04-install-from-vault` | 8 | S4 | Marketplace → **Install from…** → **From vault code files…** → picker lists the **Client Pulse** candidate found in the vault |
| 5 | `05-consent` | 7 | S4 | The install sheet: name · id · version · **requested capabilities** · unsigned advisory. Confirm |
| 6 | `06-installed` | 6 | S5 | Success toast → the app grid, the new **Client Pulse** icon appearing |
| 7 | `07-launch` | 9 | S5 | Open it — the app renders real Northbound clients in its own window |
| 8 | `08-agent-drafts` | 12 | S6 | Agent app: *"Build me a client pulse board."* → two staged cards (`manifest.json`, `index.html`) with code previews |
| 9 | `09-agent-approve` | 10 | S6 | Approve both → files land in the vault → same install path → same app |
| 10 | `10-walls` | 9 | S7 | The app's granted capabilities (Settings → Security → Capability grants); then, in the app itself, an ungranted attempt refused — `vaultEntities.list()` needs `entities.read:*`, which it was never given, and the broker's own message renders |
| 11 | `11-title` | 5 | slide | Logo + getbrainstorm.online |

Content ≈ 93s + 10s of slides ≈ **1:43** before per-scene speed compression;
budget `speed` on `02`/`03` (typing) and `08` (agent turn) to land ~2:00.

### Why the capability is scoped, not `entities.read:*`

The earlier draft put `entities.read:*` on the manifest's one capability line.
The shipped app asks for **`entities.read:brainstorm/Project/v1`** instead, and
that is a better episode, not a smaller one: a wildcard read makes S7's "it sees
what she granted it, and nothing else" an assertion, while a scoped read makes it
**demonstrable**. The board renders the vault's real client projects, and the same
app asking for the whole vault (`vaultEntities.list()`, which statically requires
`entities.read:*`) comes back refused — from the broker, in the broker's own
words, with no staging:

> refused — studio.northbound.client-pulse lacks capability for vault-entities.list

One further honesty note for S7: a capability denial is **silent** everywhere else
in the product — it lands in `<vault>/logs/audit.log` as `ipc.denied` and has no
UI. The refusal on camera is visible only because *the demo app itself* catches
the rejected promise and prints it. That is a truthful thing for an app to do (any
app can), but do not describe it as a shell-level warning, and do not stage a
"denial toast" or a Settings denials list — neither exists.

## Notes for the edit

- **S4→S5 is the payoff.** The viewer watched those two files get typed; now the
  same bytes are an icon in the grid. Hold the icon reveal — that's the "wait, it
  actually installed it" beat. Do not cut away early.
- **Do not show a terminal, `npm install`, or a `package.json` full of deps.**
  Not because it would look bad, but because it would be *false*: there is no
  build step in this path. The absence of a terminal is the feature.
- **The consent sheet is not a speed bump, it's the product.** Let it breathe for
  a beat — capabilities and the unsigned advisory on screen are what make the
  sandbox claim in S7 land later.
- **S6 pairs with VID-agent.** Same propose→approve gesture, bigger artifact. If
  both episodes are out, cross-cut a half-second of the note-card next to the
  code-file card to make the parallel explicit.
- **S7 sells safety without a lecture** — one grants sheet, one refusal, move on.
- Say "install", never "compile" or "build" — the words have to match the model.

## What is real vs. scripted (state this if anyone asks)

| Element | Status |
|---|---|
| The two-file app, its code, and that it runs | **Real** — there is no build step to fake |
| Install from vault code files, the consent sheet, capabilities, the sandbox | **Real** (`AppForge-1/2`) |
| The agent staging code files, approve → entity writes → install | **Real** (`AppForge-3`) |
| The agent's *model output* in S6 | **Scripted** (`BRAINSTORM_DEMO_AGENT=appforge`) — capture-only, so takes are deterministic |
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
