# Notes — app showcase reel (VID-notes)

The first episode of the weekly app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): a tight **~65s**
highlight cut of the **Notes** app's functionality. Notes is VID-1 (owner pick
2026-07-22); its polish gate passed in dogfood session 912.

Footage is captured by the automated rig against the synthetic **Northbound
Studio** world (`seedMarketingEntities` — never the live dogfood vault, owner
rule 2026-07-19), assembled by the shared promo renderer, and narrated by the
free edge-tts track. Re-render with:

```sh
bun run promo:capture:notes    # fresh seeded vault → drive Notes → record clips
bun run promo:vo:notes         # edge-tts narration (say fallback)
bun run promo:render:notes     # assembly → tests/dogfood/.promo-notes/vid-notes-1080p.mp4
```

The reel reuses the 60s promo's pipeline: the shared capture stage
(`tests/dogfood/lib/promo-stage.ts`), the scene table
(`tools/promo/notes-scenes.mjs`), and the parameterized `voiceover.mjs` /
`render.mjs` (driven by `PROMO_SCENES` / `PROMO_DIR` / `PROMO_OUT`). Scene
drivers live in `tests/dogfood/promo/vid-notes.spec.ts`.

## Voiceover script (~65s)

> **[00 slide]** This is Notes — where your thinking takes shape.
> **[01]** Start writing. Clean type, your words front and center — nothing in
> the way.
> **[02]** Press slash for anything — headings, lists, checklists, callouts.
> **[03]** Markdown shortcuts turn keystrokes into structure as you type.
> **[04]** Select text for the inline toolbar — format without leaving the
> keyboard.
> **[05]** Mention anything — a person, a note, even a date — and it stays
> linked across your vault.
> **[06]** Every note carries real properties — status, owner, dates. A
> document that's also data.
> **[07]** And comment right on the doc — the conversation lives with the work.
> **[08 title]** Notes, in Brainstorm. Free beta at getbrainstorm.online.

## Scene table

| # | id | secs | beat | on screen |
|---|----|------|------|-----------|
| 0 | `00-slide-notes` | 4 | title slide | "Notes — Write · structure · connect" |
| 1 | `01-write` | 9 | Write | new note; type a title + a paragraph in clean type |
| 2 | `02-slash` | 8 | Slash menu | `/` opens the command menu |
| 3 | `03-blocks` | 9 | Rich blocks | markdown shortcuts → heading, list, checklist, quote |
| 4 | `04-format` | 7 | Inline formatting | select a line → inline toolbar → bold |
| 5 | `05-mention` | 8 | Mentions & links | `@` → typeahead → linked chip (person / note / date) |
| 6 | `06-properties` | 8 | Properties | seeded brief → properties panel + add a property |
| 7 | `07-comments` | 8 | Comments | Comments tab → draft a comment on the doc |
| 8 | `08-title` | 6 | title card | getbrainstorm.online |

Total ≈ 66s. Slides `00`/`08` are render-side cards (no captured clip); the
rest map to a `<id>.mov` clip. Per-scene `speed` time-compresses the footage so
each action fits its budget (see `render.mjs`).

## Publish (owner)

Upload `vid-notes-1080p.mp4` with `vid-notes.srt` as the caption track. The reel
re-opens (a re-shoot) whenever Notes changes materially — it's a standing
`VID-notes` rung, not a one-off.
