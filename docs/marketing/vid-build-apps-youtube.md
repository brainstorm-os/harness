# YouTube upload kit — Build an app inside Brainstorm (VID-build-apps, 1:32)

Paste-ready fields for the upload. Video:
`tests/dogfood/.promo-build-apps/vid-build-apps-1080p.mp4`. Captions: upload
`tests/dogfood/.promo-build-apps/vid-build-apps.srt` as English subtitles
(nothing is burned in). Visibility: Public · not made for kids · Category:
**Science & Technology**. See [`vid-build-apps.md`](vid-build-apps.md) for the
storyboard and the real-vs-scripted table.

## Title

> An app here is two files — writing and installing a real app inside Brainstorm

*(alternates: "A knowledge OS that runs the apps you write — no build step, no terminal" ·
"I wrote an app inside my note-taking OS and installed it in 90 seconds" ·
"Let the agent write the app — it still can't touch what you didn't grant")*

## Description

```
Brainstorm is a local-first operating system for your knowledge — and it runs
the apps you write yourself.

An app here is two files: a manifest.json that says what it is and exactly what
it's allowed to touch, and an index.html that talks to the vault. No bundler, no
npm install, no terminal, no build step. In this video both files are written in
Brainstorm's own code editor, installed straight from the vault, and the result
is a live, sandboxed app in the grid reading real data. Then the agent is asked
for a second app — a different one — and it drafts its own manifest and page,
which are approved into the vault and install the same way. Both apps end up in
the grid, and both are held by the same capability ledger as every built-in app:
they see what they were granted, and asking for more comes back refused, in the
broker's own words.

⚡ Free beta (macOS · Windows · Linux):
https://getbrainstorm.online

What's in the video:
0:00 An OS that runs the apps you write
0:16 The page — reading real vault data
0:30 Install, and what it's allowed to do
0:44 Same walls as everything else
0:57 The agent drafts a second app
1:20 Two apps in the grid

Why this matters:
• An app is manifest.json + index.html — that's the whole platform contract
• Install from your own vault's code files — no folder, no zip, no terminal
• Every app declares its capabilities up front, and you consent before it runs
• The agent can draft code files, but nothing is saved until you approve
• Agent-written code gets no special treatment — same sandbox, same ledger
• Your code and your data stay on your machine, in a vault you can copy
• Part of a local-first workspace OS: 20+ apps sharing one data model
• Free and in open beta

Everything on screen is the real product driving itself against a synthetic
demo vault. The only scripted element is the AI model's output in the agent
section, so the take is deterministic — the drafting, the approval, the writes
and the install are the genuine pipeline.

Download: https://getbrainstorm.online
Source (AGPL): https://github.com/brainstorm-os/shell
Feedback & issues: https://github.com/brainstorm-os/shell/issues

Music: "Uplifting Corporate" by Soundrider (Dope), from the album "New Horizon"
— licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
Source: Jamendo.
```

**License — CC BY 3.0 (verified from the file's embedded metadata):** the track
was downloaded from Jamendo's free Creative Commons catalog; its `LICENSE` /
`WCOP` / `copyright` ID3 tags all read `creativecommons.org/licenses/by/3.0/`.
CC BY 3.0 **permits commercial use and YouTube** (monetized or not) **provided
the attribution above is present** — keep it in the description, verbatim. Same
bed as `VID-notes` (`tools/promo/assets/vid-notes-music.mp3`); keep the file and
its tags in case Content ID auto-claims it.

## Tags

```
brainstorm, local-first, knowledge management, app platform, sandboxed apps,
capability security, build your own app, no build step, html app, desktop app,
electron, second brain, pkm, notion alternative, obsidian alternative,
anytype alternative, ai agent, local ai, privacy, open source
```

## Chapters note

The six timestamps in the description double as chapters (each ≥10s, first at
0:00 — YouTube's requirements). They are cumulative scene starts from
`tools/promo/build-apps-scenes.mjs`; if scene budgets change, recompute so each
chapter start still matches a cumulative scene time and stays ≥10s apart.

Scene cumulative starts (agent-act pacing pass, 2026-07-30): `00-slide-hook`
0:00 · `01-the-gap` 0:05 · `02-manifest` 0:08 · `03-page` 0:16 ·
`04-install-from-vault` 0:25 · `05-consent` 0:30 · `06-installed` 0:35 ·
`07-launch` 0:39 · `08-walls` 0:44 · `09-agent-ask` 0:50 · `10-agent-drafts`
0:57 · `11-agent-approve` 1:05 · `12-agent-files` 1:11 · `13-agent-install`
1:15 · `14-payoff` 1:20 · `15-title` 1:27 (total 1:32, unchanged).

`00-slide-hook` is 5s rather than the 3.0s its line needs precisely so the first
chapter clears the 10s minimum. Ten of the sixteen scene starts are deliberately
NOT chapter markers because they sit <10s from a neighbour — the six above cover
them, and the film is now built out of more, shorter scenes than the chapter
minimum can follow one-for-one.

Verified against the shipped cut: every cumulative start above matches a cue
start in `vid-build-apps.srt` and the rendered file is exactly 92s, so the six
timestamps in the description need no adjustment.

## Pinned comment (optional)

> Both apps in this video are two files each — a manifest and a page — one
> written in Brainstorm's own code editor, one drafted by the agent, both
> installed straight out of the vault. No build step exists in that path, which
> is why you never see a terminal. The agent can't save a byte without your
> approval, and whatever writes them, the installed app is still boxed by the
> capability it asked for at install — which is why the second app asks for
> exactly the same one line as the first. Free beta at getbrainstorm.online; the
> shell is source-available (AGPL) on GitHub. Ask us anything 👇

## Thumbnail

No rendered thumbnail asset yet. Best frame: the split of the code editor with
`manifest.json` open on the capability line (scene `02`) next to the freshly
installed **Client Pulse** tile in the grid (scene `06`). Text overlay: "An app
here is two files." `tools/promo/cards.py` can render one at 1280×720 if we
want it generated rather than hand-made.
