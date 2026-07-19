# Brainstorm — 60-second promo (storyboard + VO script)

The YouTube launch promo: **≤60s**, all-capabilities montage told through
**Northbound Studio** — the synthetic marketing world built by
`seedMarketingEntities` (clients Harbor & Co / Meridian / Atlas, projects,
people, tasks, events, notes, journal, whiteboard). Footage is captured by the
automated rig (`tests/dogfood/promo/`), assembled by `tools/promo/render.mjs`,
narrated by a free TTS track (`tools/promo/voiceover.mjs`). Re-render any
release with:

```sh
bun run promo:capture         # fresh seeded vault + drive + record the 8 scenes
bun run promo:voiceover       # free TTS narration (edge-tts; `say` fallback)
bun run promo:render          # assembly → tests/dogfood/.promo/promo-60s-1080p.mp4
```

## Voiceover script (~140 words · target 58s at normal cadence)

> **[S1]** This is Northbound — a real research business, running entirely in
> one private workspace.
> **[S2]** Notes that hold real work — clients and projects, linked right in
> the page.
> **[S3]** Databases with boards, calendars, and views — drag a deal, plan an
> issue.
> **[S4]** Map the thinking on a graph or a whiteboard.
> **[S5]** Tasks, calendar, journal — the whole operation in one place, no
> tabs.
> **[S6]** And it's not just you. Your team works in the same vault — live,
> together — while everything stays end-to-end encrypted.
> **[S7]** Search finds anything, instantly. Your data never leaves your
> machine unless you say so.
> **[S8]** Brainstorm. Your whole business, in a workspace you own. Free beta
> on GitHub.

## Scene table

Every scene shows **real work being done** (typed text, dragged cards, created
items), and each clip is time-compressed per `scenes.mjs` `speed` (1.25–1.45×)
so the cut reads fast without robotic driving.

| # | t (s) | Surface | Action captured (all real work) | Caption (srt) |
|---|-------|---------|--------------------------------|----------------|
| 1 | 0–7 | Dashboard | Northbound vault, themed; cursor sweeps the live widgets | A whole business in one workspace |
| 2 | 7–15 | Notes | Open the HQ hub and **type two real update lines** into it; open the properties panel | Documents with live data inside |
| 3 | 15–22 | Database | Clients board: **drag a deal one stage over**, then flip to another view | Boards, calendars, views |
| 4 | 22–29 | Graph → Whiteboard | Map pan/zoom; whiteboard interaction beat | Map the thinking |
| 5 | 29–37 | Tasks → Calendar → Journal | **Create a task** ("Send Vertex proposal"), **create a calendar event** ("Issue #8 planning"), land on the day log | Tasks · Calendar · Journal |
| 6 | 37–47 | Chat (team surface) | **Create the #studio channel** on camera, then **type + send** a team update *(two-shell split-screen co-editing is the queued upgrade)* | Real-time team, end-to-end encrypted |
| 7 | 47–54 | Search | Open the launcher, **type a query**, results land live | Find anything, instantly |
| 8 | 54–60 | Title card | Logo, "Local-first · E2E-encrypted · Open beta", download URL | brainstorm — download on GitHub |

## Footage source policy (owner rule, 2026-07-19)

**Only the synthetic `seedMarketingEntities` vault is ever filmed.** The live
dogfood vault and any backup clone of it are off-limits — the real vault
carries personal imports that must never appear in public footage. The rig
wipes and re-seeds `tests/dogfood/.promo-data` on every run, so takes are
clean, repeatable, and contain zero real data by construction.

## Production notes

- **Footage source**: `tests/dogfood/.promo-data` — a fresh vault created and
  seeded by `bs.dev.seedMarketingEntities()` at the start of every capture run
  (see §Footage source policy above). Scenes write into it freely (typed note
  lines, a created task/event/channel/message); the next run starts clean.
- **Geometry**: windows at 1440×810 CSS (16:9) captured at Retina 2× →
  2880×1620 → downscaled to a crisp 1920×1080@60.
- **Capture**: default backend is the **CDP screencast** — it films only the
  driven app windows (safe while the machine is in use; synthetic cursor,
  paint-driven frame rate). The 60fps real-cursor **display capture**
  (`PROMO_CAPTURE=ffmpeg`) is an explicit opt-in ONLY: it records the whole
  screen region, so the machine must be fully unattended for the run — it
  never auto-activates.
- **Humanized driving**: eased multi-step cursor moves + jittered typing
  (`tests/dogfood/lib/humanize.ts`) — footage must not look robotic.
- **Scene 6**: two `launchCollabShell` shells over `launchRelay`
  (`tests/dogfood/lib/collab-team.ts`), tiled side-by-side via main-process
  `setBounds`; captured in one frame.
- **VO**: `edge-tts` (free, no key) en-US neural voice; macOS `say` fallback
  so the pipeline always renders. Free upgrade path if neither pleases:
  kokoro-onnx (local, Apache-2.0). Regenerate with `tools/promo/voiceover.mjs`.
- **Music**: optional — drop a licensed track at `tools/promo/assets/music.*`
  (YouTube Audio Library is the no-cost source) and re-render; the mix ducks
  music −14 dB under VO. Renders fine without.
- **Captions**: `promo-60s.srt` is emitted next to the mp4 (upload alongside
  on YouTube; nothing is burned in).
