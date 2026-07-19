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

## Voiceover script (10 scenes · 60s)

> **[S0]** Meet Brainstorm — an operating system for your mind.
> **[S1]** Create a vault — private, encrypted, on your machine — and you're in.
> **[S2]** Notes that hold real work — clients and projects, linked right in
> the page.
> **[S3]** Databases with boards, calendars, and views — drag a deal, plan an
> issue.
> **[S4]** Map the thinking on a graph or a whiteboard.
> **[S5]** Tasks, calendar, journal — the whole operation in one place, no
> tabs.
> **[S6]** Bring the team in — same vault, live together, end-to-end
> encrypted.
> **[S7]** Make it yours — themes, wallpapers, shortcuts.
> **[S8]** And search finds anything — instantly, across everything.
> **[S9]** Your whole business, in a workspace you own. Free beta at
> getbrainstorm.online.

## Scene table

Every scene shows **real work being done**, each clip auto-compresses so the
whole take fits its slot, and every footage scene carries an indigo lower-third
caption (site palette, `tools/promo/cards.py`) so a first-time viewer always
knows what they're seeing. Bookend cards use the site's indigo on #161616 and
point at **getbrainstorm.online**.

| # | t (s) | Surface | Action captured | Caption |
|---|-------|---------|-----------------|---------|
| 0 | 0–4 | Intro card | Logo + "An operating system for your mind" | — |
| 1 | 4–11 | Welcome / onboarding | Real first-run: name the vault, pick the Small-business template, Create vault → dashboard reveal | Step 1 — create your vault |
| 2 | 11–18 | Notes | Open the Harbor brief, type an update line, open properties | Notes — documents with real work inside |
| 3 | 18–25 | Database | Board drag + view flip | Database — boards, calendars, views |
| 4 | 25–30 | Graph → Whiteboard | Map pan/zoom; whiteboard beat | Graph & Whiteboard — map the thinking |
| 5 | 30–38 | Tasks → Calendar → Journal | Create a task + a calendar event, land on the day log | Tasks · Calendar · Journal |
| 6 | 38–44 | Chat | Create #studio, post an update | Chat — your team, end-to-end encrypted |
| 7 | 44–49 | Settings | Header gear → Appearance → live theme flips | Settings — make it yours |
| 8 | 49–54 | Search | Header search → type a query → results | Search — find anything, instantly |
| 9 | 54–60 | Outro card | Brand + posture + getbrainstorm.online (indigo) | — |

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
- **Music**: the committed bed is **"Corporate company introduction video" by
  Bertsz (freesound.org, CC0 1.0 — public domain, no attribution required,
  commercial use fine)** at `tools/promo/assets/music.mp3`, mixed at 0.22
  volume under the VO. To swap it, replace that file and re-render.
  ⚠ **Epidemic Sound and Artlist are NOT free catalogs** — both are paid
  subscription licenses behind "free music" ad keywords; a track used without
  an active subscription draws a YouTube Content ID claim. If you subscribe to
  either, download your track and drop it in as `music.mp3` — the license
  stays valid for videos published while subscribed.
- **Captions**: `promo-60s.srt` is emitted next to the mp4 (upload alongside
  on YouTube; nothing is burned in).
