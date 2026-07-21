# Brainstorm — 60-second promo (storyboard + VO script)

The YouTube launch promo: **~83s story cut** — Mira founds Northbound Studio
and runs it end-to-end in Brainstorm, from vault creation to shipping — told
through
**Northbound Studio** — the synthetic marketing world built by
`seedMarketingEntities` (clients Harbor & Co / Meridian / Atlas, projects,
people, tasks, events, notes, journal, whiteboard). Footage is captured by the
automated rig (`tests/dogfood/promo/`), assembled by `tools/promo/render.mjs`,
narrated by a free TTS track (`tools/promo/voiceover.mjs`). Re-render any
release with:

```sh
bun run promo:capture         # fresh seeded vault + drive + record the story scenes
bun run promo:voiceover       # free TTS narration (edge-tts; `say` fallback)
bun run promo:render          # assembly → tests/dogfood/.promo/promo-60s-1080p.mp4
```

## Voiceover script (story cut · ~83s)

> **[S0 slide]** Meet Mira. She's starting a studio — and she'll run it all
> from one place.
> **[S1]** Day one: a private vault. Everything the studio makes lives here —
> encrypted, on her machine.
> **[S2 slide]** *(silent — "Build the studio")*
> **[S3]** Client briefs live in Notes — real documents, tied to real projects.
> **[S4]** The pipeline runs on boards and views — drag a deal, plan the week.
> **[S5]** Thinking gets mapped — graph and whiteboard.
> **[S6]** Tasks, calendar, journal — the day runs itself.
> **[S7 slide]** *(silent — "The team joins")*
> **[S8]** The team works in chat — updates, files, decisions — right next to
> the work.
> **[S9]** An AI agent drafts alongside them — grounded in the vault.
> **[S10]** Client mail lands beside the projects it belongs to.
> **[S11]** Research happens in-app — captured straight to the vault.
> **[S12]** And anything is one search away.
> **[S13]** Northbound runs on Brainstorm. Yours can too — free beta at
> getbrainstorm.online.

## Scene table

The cut is a STORY (vault creation → studio → team → shipping) with silent
slide interstitials as musical breaths. Scene list = `tools/promo/scenes.mjs`
(single source of truth: ids, budgets, VO, captions, slides). New app scenes:
**Agent** (seeded conversation + typed prompt), **Mailbox** (mock client mail
seeded as `Email/v1` rows through the app's own entity caps), **Browser**
(omnibox + tabs — page content paints in an isolated native view the
screencast can't see; the chrome carries the scene, and a display-capture
final pass would show real page content). Chat additionally links a document
through the composer's Add-context menu.

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
- **Music**: the committed bed is **"Inspiring Advertising" by Rafael Krux
  (CC BY 4.0)** at `tools/promo/assets/music.mp3` (owner's pick from the
  audition set in `tests/dogfood/.promo/music-candidates/`). **CC-BY requires
  a credit — put this in the YouTube description:**
  `Music: "Inspiring Advertising" by Rafael Krux, licensed under CC BY 4.0
  (creativecommons.org/licenses/by/4.0)`. To swap tracks, replace the file
  and re-render.
  ⚠ **Epidemic Sound and Artlist are NOT free catalogs** — both are paid
  subscription licenses behind "free music" ad keywords; a track used without
  an active subscription draws a YouTube Content ID claim. If you subscribe to
  either, download your track and drop it in as `music.mp3` — the license
  stays valid for videos published while subscribed.
- **Captions**: `promo-60s.srt` is emitted next to the mp4 (upload alongside
  on YouTube; nothing is burned in).
