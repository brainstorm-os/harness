# YouTube upload kit — Brainstorm Notes (VID-notes, ~1:43)

Paste-ready fields for the upload. Video: `tests/dogfood/.promo-notes/vid-notes-1080p.mp4`.
Captions: upload `tests/dogfood/.promo-notes/vid-notes.srt` as English subtitles
(nothing is burned in). Visibility: Public · not made for kids · Category:
**Science & Technology**. See [`vid-notes.md`](vid-notes.md) for the storyboard.

## Title

> Brainstorm Notes — the block editor that's also a database (local-first)

*(alternates: "Brainstorm Notes in 100 seconds — blocks, properties, mentions & more" ·
"Meet Brainstorm Notes — write, structure, and connect everything" ·
"A private, local-first notes app with real properties and backlinks")*

## Description

```
A full tour of Notes in Brainstorm — the block editor where every document is
also structured data, on a private vault that lives on your machine.

Write in clean type, drop in any block with "/", turn Markdown into structure
as you type, add code blocks, format inline, @-mention people, notes, and
dates, give a note real properties, an icon, and comments, search across
everything, and pin / share / template / export / lock any note.

⚡ Free beta (macOS · Windows · Linux):
https://getbrainstorm.online

What's in the video:
0:00 What Notes is — write in clean type
0:13 Blocks, Markdown & code — the "/" palette
0:41 Inline formatting & @-mentions
0:57 Properties & icons — a document that's also data
1:14 Comments & search
1:29 Note actions & get the beta

Why Brainstorm Notes:
• Local-first — your notes live on your machine, in a vault you can copy
• Every note carries real properties — status, owner, dates — so it's data too
• @-mention people, notes, and dates; everything stays linked across the vault
• A full block editor — headings, lists, checklists, quotes, code, callouts, embeds
• End-to-end encrypted sync & real-time collaboration
• Part of a local-first workspace OS: 19 apps sharing one data model
• Free and in open beta

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
the attribution above is present** — keep it in the description, verbatim.

Caveat: the original Jamendo track page (id 1670597) now 404s and the artist
appears on Jamendo's paid licensing arm, but a CC grant is **irrevocable**, so
the CC BY 3.0 licence embedded in the downloaded copy still applies. If YouTube
Content ID auto-claims the track, dispute it with the embedded CC BY 3.0
metadata as proof — so **keep `tools/promo/assets/vid-notes-music.mp3` and its
tags**. (Run `ffprobe -show_entries format_tags <file>` to re-read them.)

## Tags

```
brainstorm, notes app, block editor, local-first, knowledge management,
second brain, pkm, notion alternative, obsidian alternative, anytype alternative,
markdown editor, note taking, privacy, end-to-end encryption, backlinks,
properties, database notes, productivity app, open source, desktop app
```

## Chapters note

The six timestamps in the description double as chapters (each ≥10s, first at
0:00 — YouTube's requirements). They group the 13 scenes; if scene budgets
change in `tools/promo/notes-scenes.mjs`, recompute so each chapter start still
matches a cumulative scene time and stays ≥10s apart.

Scene cumulative starts (from `notes-scenes.mjs`): write 0:04 · slash 0:13 ·
blocks 0:21 · code 0:33 · format 0:41 · mention 0:49 · properties 0:57 ·
icon 1:07 · comments 1:14 · organize 1:21 · actions 1:29 · title 1:37.

## Pinned comment (optional)

> Everything here is the real Notes app driving itself against a demo vault —
> no mockups. Every note is also structured data you can query, and it all
> lives in a private vault on your machine. Free beta at getbrainstorm.online;
> the whole shell is source-available (AGPL) on GitHub. Ask us anything 👇

## Thumbnail

No rendered thumbnail asset yet. Options: the "Notes — Write · structure ·
connect" intro slide (already rendered by `cards.py`), or a clean frame of the
slash-command palette (scene 02) or the rich-blocks doc (scene 03) with the
wordmark. `tools/promo/cards.py` can render one at 1280×720 if we want it
generated rather than hand-made.
