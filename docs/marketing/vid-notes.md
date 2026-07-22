# Notes — app showcase reel (VID-notes)

The first episode of the weekly app-showcase series (`VID-*` in
[`../implementation-plan.md`](../implementation-plan.md)): a full walk of the
**Notes** app's functionality (~1:40). Notes is VID-1 (owner pick 2026-07-22);
its polish gate passed in dogfood session 912.

Footage is captured by the automated rig against the synthetic **Northbound
Studio** world (`seedMarketingEntities` — never the live dogfood vault, owner
rule 2026-07-19), assembled by the shared promo renderer, and narrated by the
free edge-tts track over an uplifting-corporate bed (`vid-notes-music.mp3`),
with the **voiceover mixed clearly above the music**. Re-render with:

```sh
bun run promo:capture:notes    # fresh seeded vault → drive Notes → record clips
bun run promo:vo:notes         # edge-tts narration (say fallback)
bun run promo:render:notes     # assembly → tests/dogfood/.promo-notes/vid-notes-1080p.mp4
```

The reel reuses the 60s promo's pipeline: the shared capture stage
(`tests/dogfood/lib/promo-stage.ts`), the scene table
(`tools/promo/notes-scenes.mjs`), and the parameterized `voiceover.mjs` /
`render.mjs` (driven by `PROMO_SCENES` / `PROMO_DIR` / `PROMO_OUT` /
`PROMO_MUSIC` / `PROMO_VO_GAIN` / `PROMO_MUSIC_GAIN`). Scene drivers live in
`tests/dogfood/promo/vid-notes.spec.ts`.

## Voiceover script (~1:40)

> **[00 slide]** This is Notes — where your thinking takes shape.
> **[01]** Start writing. Clean type, your words front and center — nothing in
> the way.
> **[02]** Press slash for any block — headings, lists, callouts, code, images,
> and more.
> **[03]** Markdown shortcuts build structure as you type — headings, lists,
> checkboxes, and quotes.
> **[04]** Drop in a code block — monospaced and syntax-aware — when a note
> calls for one.
> **[05]** Select text for the inline toolbar — bold, italic, links, and color,
> all from the keyboard.
> **[06]** Mention anything — a person, a note, even a date — and it stays
> linked across your vault.
> **[07]** Give a note real properties — status, owner, dates. A document that's
> also data.
> **[08]** Make any note yours with an icon of its own.
> **[09]** Comment right on the doc — the conversation lives with the work.
> **[10]** Search across every note, and jump between them from the sidebar.
> **[11]** Pin it, share it, save it as a template, export it — or lock it
> read-only.
> **[12 title]** Notes, in Brainstorm. Free beta at getbrainstorm.online.

## Scene table

| # | id | secs | beat | on screen |
|---|----|------|------|-----------|
| 0 | `00-slide-notes` | 4 | title slide | "Notes — Write · structure · connect" |
| 1 | `01-write` | 9 | Write | new note; title + a paragraph in clean type |
| 2 | `02-slash` | 8 | Slash menu | `/` opens the full block palette |
| 3 | `03-blocks` | 12 | Rich blocks | markdown → heading, bullet + numbered lists, checklist, quote |
| 4 | `04-code` | 8 | Code blocks | `/code` → a monospaced code block |
| 5 | `05-format` | 8 | Inline formatting | select a line → inline toolbar → bold |
| 6 | `06-mention` | 8 | Mentions & links | `@` → typeahead → linked chip |
| 7 | `07-properties` | 10 | Properties | seeded brief → panel → add a Status property |
| 8 | `08-icon` | 7 | Icons | click the note icon → emoji picker |
| 9 | `09-comments` | 7 | Comments | Comments tab → draft a comment |
| 10 | `10-organize` | 8 | Search & organize | search box → jump between notes |
| 11 | `11-actions` | 8 | Note actions | object ⋯ menu (pin/share/template/export) + read-only lock |
| 12 | `12-title` | 6 | title card | getbrainstorm.online |

Total ≈ 103s. Slides `00`/`12` are render-side cards (no captured clip); the
rest map to a `<id>.mov` clip. Per-scene `speed` time-compresses the footage so
each action fits its budget (see `render.mjs`).

## Publish (owner)

Upload `vid-notes-1080p.mp4` with `vid-notes.srt` as the caption track. The reel
re-opens (a re-shoot) whenever Notes changes materially — it's a standing
`VID-notes` rung, not a one-off.
