# Universal object covers

Every object — a note, a bookmark, a book, a person, a task, a List — can carry a **cover**: a wide banner image (or gradient/colour) that gives the object a face in card and header contexts. It is the visual companion to the [universal icon](39-universal-icons.md): the icon is the small per-object glyph; the cover is the large per-object backdrop. There is exactly one shape for a cover, exactly one picker, and exactly one renderer — and every app shows an object's own cover identically.

This is what makes a gallery of bookmarks, a shelf of books, or a board of notes read as a wall of distinct objects rather than a list of titles.

## Shape

```ts
export enum CoverKind {
  Image    = "image",     // brainstorm://cover/<sha256>.<ext>
  Gradient = "gradient",  // a named gradient from the curated set
  Color    = "color",     // a single token-bound colour
}

export type Cover =
  | { kind: CoverKind.Image;    value: string; focal?: { x: number; y: number } }
  | { kind: CoverKind.Gradient; value: string }
  | { kind: CoverKind.Color;    value: string };
```

- **Image** — an uploaded asset at `<vault>/covers/<sha256>.<ext>`, addressed via the privileged `brainstorm://cover/<sha256>.<ext>` scheme (parallel to `brainstorm://wallpaper/...` and `brainstorm://icon/...` — see `main/index.ts`). Content-addressed, so duplicate uploads dedupe. `focal` is a normalised `0..1` point the renderer keeps visible when the display aspect is narrower than the source (a wide banner cropped into a card) — drag-to-reposition, no destructive crop.
- **Gradient** — a key into the curated gradient set (the same palette family `app-icon-palette.ts` / the seeded-gradient fallback already use). Deterministic, theme-neutral.
- **Color** — a single colour. Stored as a **theme-token reference by default** — `var(--token)` (the `--token` shorthand is accepted and normalised), so a cover follows the active theme rather than freezing a literal. An absolute literal (hex / `rgb()` / `hsl()` / `oklch()` / a named keyword) is the explicit escape hatch for a user-picked raw colour. The value is validated to be exactly *one* token or *one* literal — never multiple tokens, a `var(--x, …)` fallback, or arbitrary CSS — since it is interpolated into an inline `style`; anything else degrades to the id-seeded gradient. Resolved by `normalizeCoverColor` in `@brainstorm/sdk/entity-cover`. See [[OQ-COV-1]] (resolved 2026-05-17).

A `null` cover means "no explicit cover": the renderer falls back to a **deterministic gradient seeded by the object's id** (never a broken-image square — this is the existing behaviour the Database gallery already specifies in [apps/database/20-views.md](../apps/database/20-views.md)).

## Where covers live

A cover is a **reserved universal property on every object** — `properties.cover` — exactly like `properties.icon` and the universal rich-text `body` (per the single-object-space resolution, [data/21-objects-and-collections.md](../data/21-objects-and-collections.md), OQ-DM-1). It is **not** a per-app field and **not** a per-view-only setting. One object, one cover, shown the same everywhere.

The Database gallery's `coverProperty` (a *view* knob) becomes a documented **per-view override**: a view may point its cards at a specific property for their cover; absent that, the card uses the object's universal `properties.cover`; absent that, the id-seeded gradient. Precedence is `view.coverProperty` → `properties.cover` → seeded gradient. An explicit view-level **"none"** suppresses the band for that view only (it does *not* fall through to the seeded gradient — the object still shows its own cover everywhere else). The single typed primitive for this rule is `resolveCoverForView(subject, source)` (`ViewCoverMode.Inherit | Property | None`) in `@brainstorm/sdk/entity-cover`, returning a `Suppressed` outcome for the "none" case; every card surface routes through it so the precedence is never re-implemented per app (the rejected anti-pattern, same as per-object icons).

## The picker

One shared primitive: `<CoverPicker value={cover} onChange={…}>`, mirroring `<IconPicker>` (`packages/shell/src/renderer/ui/`).

Tabs: **Image** (upload from disk or paste URL — file dialog declares image extensions per the file-dialog convention), **Gallery** (a curated bundled set), **Gradient**, **Color**, and an explicit **Remove**. The Image tab includes a **focal-point** control (drag the visible band on a wide-but-short crop). Returns `Cover | null`; the caller owns persistence.

## Rendering

Single render function `<EntityCover entity={…} aspect={…} />`, plus a non-React `createEntityCoverElement` twin for canvas/DOM-only surfaces — paired exactly as `<EntityIcon>` / `createEntityIconElement` are (see [[project_entity_icon_dom_helper]]). Always render through it; never inline `<img>` for a cover in feature code. It lazy-loads images as they scroll into view, applies the focal point for the target aspect, and falls back to the id-seeded gradient on missing/404 — no broken-image squares, ever.

## Per-object covers everywhere (cross-app invariant)

The same hard consistency rule as [per-object icons everywhere](39-universal-icons.md): **every app that renders an object in a card or header context shows that object's OWN cover, identically.** A cover set on a bookmark appears the same in the Database gallery, the Bookmarks app, search results, and a dashboard pin. Keying a card's backdrop off `entity.type` (a per-type cover map) is the rejected anti-pattern, the same way a per-type icon map is.

Surfaces that consume `<EntityCover>`:

- **Card grids** — Database `gallery` / `board` cards, search-result cards, the dashboard pinned-object tile.
- **Object headers** — the universal object editor (Notes), Files detail, Bookmarks, Books, Contacts, the Journal day header.
- **Lists are objects too** — a List carries `properties.cover` and renders by the same rule (a curated List can ship with a cover); not a special case.

## Layout integration

[shell/27-layouts.md](../shell/27-layouts.md) already names `cover` as a layout chrome cell. That doc owns *where* the cover sits per context (header band height, whether a context shows it at all); **this** doc owns the *shape, picker, storage, and renderer*. The chrome cell renders `<EntityCover>`; layout decides placement under the same layered-overlay precedence as PropertySchema (`entity > collection > type > user > org > app-default`).

## Storage of uploaded images

`brainstorm://cover/<sha256>.<ext>` is registered alongside `wallpaper` and `icon` in `main/index.ts`'s protocol handler. The upload path is shared with wallpapers/icons (`dashboard-handlers.ts`'s `uploadWallpaper` is the template): content-hash filename, resize to a cover-max (a wide band, e.g. ≤1600px wide) plus a card thumbnail (e.g. 480×320) so grids don't decode full-resolution banners. A **Settings → Cover library** section enumerates every uploaded cover image — preview, where used, delete — the same pattern as the wallpaper / icon-library galleries.

## Future

- **Unsplash-style provider** (post-v1) — the Gallery tab gains a pluggable image provider; until then it is the bundled curated set only. Out of scope for v1 and explicitly not a network dependency of the core feature.
- **Generated covers** — once the AI broker (Stage 11) lands, "generate a cover" can seed the image kind; the shape does not change.
