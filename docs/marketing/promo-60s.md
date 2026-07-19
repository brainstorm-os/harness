# Brainstorm — 60-second promo (storyboard + VO script)

The YouTube launch promo: **≤60s**, all-capabilities montage told through
**Northbound** — Mira Anand's research studio, the dogfood world that already
lives in the vault. Footage is captured by the automated rig
(`tests/dogfood/promo/`), assembled by `tools/promo/render.mjs`, narrated by a
free TTS track (`tools/promo/voiceover.mjs`). Re-render any release with:

```sh
bun run promo:prepare-vault   # clone the newest Northbound backup → .promo-data
bun run promo:capture         # drive + record the 8 scenes (machine unattended)
bun run promo:render          # VO + assembly → tests/dogfood/.promo/promo-60s-1080p.mp4
```

## Voiceover script (~140 words · target 58s at normal cadence)

> **[S1]** This is Northbound — a real research business, running entirely in
> one private workspace.
> **[S2]** Notes that hold live data — the client pipeline, embedded right in
> the page.
> **[S3]** Databases with boards, calendars, and views — drag a deal, plan an
> issue.
> **[S4]** Map the thinking on a graph or a whiteboard.
> **[S5]** Tasks, calendar, mail, and automations — the whole operation, one
> place, no tabs.
> **[S6]** And it's not just you. Your team works in the same vault — live,
> together — while everything stays end-to-end encrypted.
> **[S7]** Search finds anything, instantly. Your data never leaves your
> machine unless you say so.
> **[S8]** Brainstorm. Your whole business, in a workspace you own. Free beta
> on GitHub.

## Scene table

| # | t (s) | Surface | Action captured | Caption (srt) |
|---|-------|---------|-----------------|----------------|
| 1 | 0–7 | Dashboard | Northbound vault, themed + wallpapered; slow reveal, cursor glides over app icons | A whole business in one workspace |
| 2 | 7–15 | Notes | HQ hub doc scrolls; live Clients-pipeline embed visible; click into a brief | Documents with live data inside |
| 3 | 15–22 | Database | Clients CRM board — drag a card one stage right; switch board→calendar view | Boards, calendars, views |
| 4 | 22–29 | Graph → Whiteboard | Literature map pan/zoom beat; cut to strategy whiteboard | Map the thinking |
| 5 | 29–37 | Tasks → Calendar → Mailbox | Quick cuts: this week's tasks; month view; real inbox | Tasks · Calendar · Mail · Automations |
| 6 | 37–47 | Two shells (Mira ·nord / Marcus ·rose) | Side-by-side co-editing the same brief over the sync relay; a chat message lands | Real-time team, end-to-end encrypted |
| 7 | 47–54 | Search | Cmd-K style instant search across everything; open a result | Find anything, instantly |
| 8 | 54–60 | Title card | Logo, "Local-first · E2E-encrypted · Open beta", download URL | brainstorm — download on GitHub |

## ⚠ Pre-publish gate — vault curation

The promo films a clone of the REAL Northbound vault, and the first captures
show it verbatim: test residue (`ReactivityProbe*`, `RevivedLiveness*`) and
**personal-looking notes** (`Stunde NN | Natasha`, `Hausaufgabe …`) appear in
the Notes sidebar, and several dashboard widgets show empty states. **Do not
publish any cut until a curation pass runs inside `.promo-data`** (delete/
rename residue + personal items in the clone — never in the live vault — and
fill or hide empty widgets). The draft exists to prove the pipeline, not to
ship.

## Production notes

- **Footage source**: `tests/dogfood/.promo-data` — a tarball clone of the
  newest Northbound backup (`tests/dogfood/.data-backups/northbound-*.tar.gz`).
  The live vault `tests/dogfood/.data` is **never** touched (owner rule,
  dogfood README §The vault is permanent).
- **Geometry**: windows at 1440×810 CSS (16:9) captured at Retina 2× →
  2880×1620 → downscaled to a crisp 1920×1080@60.
- **Capture**: per-scene ffmpeg avfoundation region capture with
  `-capture_cursor 1`; the rig runs focused (no `BRAINSTORM_NO_FOCUS`), so the
  machine must be unattended during `promo:capture`; macOS Screen-Recording
  permission must be granted to the invoking terminal once.
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
