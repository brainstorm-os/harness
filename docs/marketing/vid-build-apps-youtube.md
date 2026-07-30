# YouTube upload kit — Build an app inside Brainstorm (VID-build-apps, 1:45)

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
is a live, sandboxed app in the grid reading real data. Then the agent drafts
the same two files, they're approved into the vault, and they install the same
way — and the finished app is still held by the same capability ledger as every
built-in app: it sees what it was granted, and asking for more comes back
refused, in the broker's own words.

⚡ Free beta (macOS · Windows · Linux):
https://getbrainstorm.online

What's in the video:
0:00 An OS that runs the apps you write
0:11 The manifest — one capability line
0:23 The page — reading real vault data
0:37 Install straight from the vault
0:52 Installed — a real app in the grid
1:07 Or let the agent write it
1:29 Same sandbox, same walls

Why this matters:
• An app is manifest.json + index.html — that's the whole platform contract
• Install from your own vault's code files — no folder, no zip, no terminal
• Every app declares its capabilities up front, and you consent before it runs
• The agent can draft code files, but nothing is saved until you approve
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

The seven timestamps in the description double as chapters (each ≥10s, first at
0:00 — YouTube's requirements). They are cumulative scene starts from
`tools/promo/build-apps-scenes.mjs`; if scene budgets change, recompute so each
chapter start still matches a cumulative scene time and stays ≥10s apart.

Scene cumulative starts: `00-slide-hook` 0:00 · `01-the-gap` 0:05 ·
`02-manifest` 0:11 · `03-page` 0:23 · `04-install-from-vault` 0:37 ·
`05-consent` 0:45 · `06-installed` 0:52 · `07-launch` 0:58 ·
`08-agent-drafts` 1:07 · `09-agent-approve` 1:19 · `10-walls` 1:29 ·
`11-title` 1:40 (total 1:45).

## Pinned comment (optional)

> The app in this video is two files — a manifest and a page — written in
> Brainstorm's own code editor and installed straight out of the vault. No
> build step exists in that path, which is why you never see a terminal. The
> agent can draft the same files, but it can't save them without your approval,
> and whatever writes them, the installed app is still boxed by the capability
> it asked for at install. Free beta at getbrainstorm.online; the shell is
> source-available (AGPL) on GitHub. Ask us anything 👇

## Thumbnail

No rendered thumbnail asset yet. Best frame: the split of the code editor with
`manifest.json` open on the capability line (scene `02`) next to the freshly
installed **Client Pulse** tile in the grid (scene `06`). Text overlay: "An app
here is two files." `tools/promo/cards.py` can render one at 1280×720 if we
want it generated rather than hand-made.
