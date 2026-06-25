# 23 — Output: printing and PDF export

This doc covers **page-shaped output**: printing, PDF export, and the shared rendering pipeline behind both. All three are chronic pain points in prior tools — pages cut off, layouts broken at page boundaries, no real PDF metadata, formatting drift between screen and paper.

Brainstorm treats this as a first-class capability with one shared rendering path. Builds on [17-interoperability.md](17-interoperability.md) (the `intent.export` and `intent.print` verbs), [13-frontend-stack.md](../shell/13-frontend-stack.md) (themes, styling), and [12-shell-architecture.md](../shell/12-shell-architecture.md) (the renderer process model).

## What went wrong in prior tools

- **Layouts not designed for pagination.** Editor views laid out for infinite scroll; printing produced cut-off blocks, awkward page breaks, missing content past the first page.
- **PDF export was screenshot-shaped.** Output looked rasterised; text wasn't selectable, fonts were embedded inconsistently, file sizes ballooned.
- **No metadata.** PDFs lacked title, author, language, document outline. Searching them in Finder/Preview was frustrating.
- **Theme leaked into print.** Dark-mode UI rendered with a dark background on paper, wasting toner and making text hard to read.
- **No print-preview.** Users saw the broken result *after* sending to printer.
- **Per-app inconsistency.** Each app rolled its own print path; some had it, some didn't, none agreed on conventions.

Brainstorm's design is shaped by avoiding each of these.

## Principles

1. **One shared render path** for print and PDF, used by every entity-rendering app.
2. **Print view is a real surface**, not an afterthought — read-only, paginated, printer-aware.
3. **Themes don't leak.** Print rendering uses a print-specific theme variant (light, high-contrast type, no decorative chrome).
4. **PDFs are real PDFs** — selectable text, embedded fonts, document outline, metadata, optional accessibility tags.
5. **Preview before commit.** No printing without a print-preview surface.
6. **Capability-gated** — printing and PDF export require explicit user invocation; apps don't print silently.

## The two intents

Two new entries in the standard intent vocabulary (extending [17-interoperability.md](17-interoperability.md)):

| Intent verb | Payload                                                  | Behavior                                                                              |
|-------------|----------------------------------------------------------|---------------------------------------------------------------------------------------|
| `print`     | `{ entityIds, options? }` or `{ selection, options? }`    | Render to a print-preview surface; user confirms; OS print dialog opens.              |
| `export`    | `{ entityIds, format: "application/pdf", options? }`     | Render via the same path; PDF written to a user-chosen location (`files.requestSave`). |

Both intents go through the same renderer (described below). `print` ends in the OS print dialog; `export` ends in a saved PDF file.

> **Decision:** print and PDF export share the renderer, not just the intent dispatcher. Whatever appears in the print preview is what comes out as a PDF. No drift.

## The print-view contract

Every app that registers as an opener for an entity type **may** also register a print-view handler. Without one, the shell falls back to a generic print view derived from the entity's display hints.

```jsonc
// in app manifest registrations
"intents": [
  { "verb": "print",  "entityType": "io.example/Note/v1" },
  { "verb": "export", "entityType": "io.example/Note/v1", "format": "application/pdf" }
]
```

When the intent dispatches, the providing app spawns a **print-view window** — a hidden renderer process that loads a special URL on the app:

```
brainstorm://print/<app-id>/<entity-id>?theme=print&page=letter&...
```

The app's print-view route renders the entity in a print-aware layout. The shell's render-driver controls pagination, takes the rendered output, and either drives the OS print dialog (`print` verb) or extracts a PDF (`export` verb).

> **Decision:** the print view runs in a **separate, off-screen renderer process**, not the app's main window. Reasoning: it can render without disturbing the user's current state, can render at the print-target's DPI/page-size, and crashes there don't take down the app.

## Pagination

CSS Paged Media handles most of the work. The shell's print-view environment loads with:

- `@media print` styles applied (so the app's print-only styles take over).
- A reset that removes app chrome (no toolbars, sidebars, status bars).
- Page-size and orientation set per the user's choice in the preview surface.
- Logical CSS properties (per [21-localization.md](21-localization.md)) so RTL prints correctly.

The shell wraps the app's print render in a frame that owns:

- **Page boxes** — `@page { size: …; margin: … }` configured at print time.
- **Page breaks** — uses `break-before` / `break-after` / `break-inside` properties; the renderer respects them.
- **Headers and footers** — page header (entity title, optional org logo for org-readable spaces), page footer (page numbers, total, optional date).
- **Page numbers** — `counter(page)` / `counter(pages)` via CSS counters.

> **Decision:** page-break behavior is driven by the *content semantics* the app declares, not by ad-hoc CSS in the app's main editor view. A heading element should declare `break-before: page` (or avoid it via `break-after: avoid`); the print view honours it.

> **Decision:** the shell provides a `<PrintView>` component (re-exported via SDK) that wraps an app's print rendering with the standard frame (page setup, headers, footers, page numbers). Apps fill the body; the shell renders the frame.

### Per-page responsibilities

| Concern                       | Owned by  |
|-------------------------------|-----------|
| Page size, orientation, margins | Shell (from user preview choice) |
| Theme (print theme override)  | Shell    |
| Header / footer template      | Shell, with overridable slots |
| Page number rendering         | Shell    |
| Body content                  | App      |
| Page-break hints              | App (via CSS) |
| Block-level pagination tweaks | App      |

## The print theme

Themes (per [13-frontend-stack.md](../shell/13-frontend-stack.md)) include a special **`print`** variant. When the print-view window loads, the shell forces theme = `print`, regardless of the user's normal theme:

- Background: white (or sepia for the user's preference).
- Text: dark high-contrast.
- Accent / decoration colors: muted; large blocks of color avoided.
- Font sizes: typographically tuned for paper (slightly larger body, denser line height).

Apps that have decorative theming (gradients, dark surfaces) lose them automatically because they're using token references — the tokens just resolve to print-theme values.

> **Decision:** the shell's print theme is **not user-customisable by default** (so default printing always works). Power users can author a custom print theme as a `brainstorm/Theme/v1` entity with `kind: "print"`.

## Print preview

Before committing to print or PDF, the user always sees a preview surface:

- Live render of the print view at the chosen page size.
- Page navigation (first / prev / next / last).
- Per-page thumbnails in a sidebar.
- Controls: page size, orientation, margins, scale (fit / actual size / custom %), color (color / grayscale / black-and-white).
- "Print…" button → OS print dialog.
- "Save as PDF…" button → file picker.

> **Decision:** preview is mandatory. There is no `intent.print` flow that bypasses it. (If automated print pipelines emerge later, they go through a distinct API with explicit user opt-in.)

## PDF specifics

When the user picks "Save as PDF" (or invokes `intent.export` with `application/pdf`), the shell drives the same print-view renderer through Electron's `webContents.printToPDF` API. The result is a real PDF, not a screenshot.

> **Decision:** PDFs include:
> - Document **title** (entity's display title, possibly with version or date suffix).
> - **Author** (the local user's display name; or the org's name if the entity is org-owned).
> - **Subject / description** (optional, from entity properties' display hints).
> - **Language** (the active locale).
> - **Producer** ("Brainstorm v1.x").
> - A **document outline** (PDF bookmarks) derived from the entity's headings (rich-text content) or from the document structure (sections, attachments).
> - Embedded fonts (no host-font dependence).
> - **Tagged-PDF accessibility tree** when the source content has semantic structure (headings, lists, tables).

Metadata population happens inside the print-driver in the shell — apps don't have to populate it; they may override fields if needed via the `<PrintView metadata={…}>` slot.

> **Open:** PDF/A (archival) — a stricter PDF subset for long-term archival. Useful for org compliance scenarios. Adds constraints on fonts, colors, transparency. Tracked as OQ-68.

> **Decision:** PDFs of E2E-encrypted content are produced **on-device only**. The plaintext leaves the trust boundary only as the user-chosen output file (saved locally or to user-controlled storage). The shell does not transmit PDFs through the relay.

## Batch export

Some apps (database, file browser) want to export multiple entities at once.

> **Decision:** batch export is supported via `intent.export` with `entityIds: [...]` and one of two modes:
> - **`mode: "single-pdf"`** — one PDF with all entities concatenated, with a table of contents.
> - **`mode: "per-entity"`** — one PDF per entity, written to a chosen folder.
>
> The shell renders entities sequentially; large batches show progress.

Batch PDF generation uses a worker process so large jobs don't block the main shell.

## Per-app responsibilities

A well-behaved app:

- Provides a print-view route at `brainstorm://print/<app-id>/...`.
- Wraps its print body in `<PrintView>` (from the SDK).
- Declares page-break semantics in CSS (no orphaned `<h1>`, no split tables when avoidable).
- Embeds fonts via the shell's font registry (or inlines).
- Optionally provides PDF metadata overrides via `<PrintView metadata={…}>`.
- Handles `intent.print` and `intent.export` for its types.

Without registering, an app's entities still print — via the **fallback print view** rendered by the shell from display hints (title, summary, properties as a definition list).

## Fallback print view

When no app has registered a print-view handler for a type, or the app is uninstalled, the shell renders a generic readable view:

- Entity title (h1).
- Type label and identifier (small).
- Properties as a definition list, ordered by the type's `display.order` hints.
- Rich-text fields rendered with the read-only Lexical renderer (per [07-editing-lexical.md](../editing/07-editing-lexical.md)).
- Linked entities (entityRef properties) rendered as a list with their own titles.
- Metadata footer (created, last modified).

This is the fallback-renderer principle from [03-app-model.md](../apps/03-app-model.md) applied to print: never errors, always produces something useful.

## Privacy and security

- The print-view renderer runs with the same sandbox as a normal app renderer; the print-driver shell-side handles capability checks.
- Apps cannot trigger printing or PDF export silently — both verbs require user-gesture origin (a button click, a menu pick, a hotkey).
- An app cannot read what the user printed — the rendered output goes from print-view-renderer → shell → printer/PDF, never back to the app.
- For org-readable spaces, prints/PDFs may include an org-defined watermark or footer (per [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)) — shell-rendered, not app-controllable.

> **Decision:** there is no "silent print" capability. Printing and PDF export always involve user-visible UI.

## Performance

| Metric                                       | Target                |
|----------------------------------------------|-----------------------|
| Open print preview for a typical entity      | <1s                   |
| Render a 50-page document for preview        | <3s                   |
| Generate a 50-page PDF                       | <5s                   |
| Batch export of 100 entities (separate files)| <60s                  |
| PDF file size (50 pages, mostly text)        | <500KB (with subset fonts) |

Benchmarks against modern hardware; lower-end relaxed 2-3×.

## Capabilities

New capabilities introduced (per the naming convention in [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)):

- `print.dispatch:<entityType>` — an app can dispatch `intent.print` for a given entity type. Most apps implicitly hold this for types they handle.
- `print.handle:<entityType>` — an app registers as a print handler for a type.
- `export.handle:<entityType>:<format>` — covered already by [17-interoperability.md](17-interoperability.md)'s export verb registration.

These are auto-granted at install for apps that register print-view handlers for their declared opener types; explicit grants required only for cross-type dispatch.

## Phasing

> **Decision:** v1 ships the full pipeline (intents, print preview, PDF export with metadata, fallback render) plus first-party print views for the bundled apps (text editor, database). v2 adds tagged-PDF accessibility, PDF/A archival, batch export with TOC, and watermarking for org-readable spaces.

| Capability                                  | v1   | v2  |
|---------------------------------------------|------|-----|
| `intent.print` and `intent.export:application/pdf` | ✓    | ✓   |
| Shared render path (print & PDF)             | ✓    | ✓   |
| Print preview surface                        | ✓    | ✓   |
| Page setup (size, orientation, margins)      | ✓    | ✓   |
| Page numbers, headers, footers               | ✓    | ✓   |
| Print theme override                         | ✓    | ✓   |
| Embedded fonts                                | ✓    | ✓   |
| Document outline / bookmarks                 | ✓    | ✓   |
| Standard PDF metadata (title, author, lang)  | ✓    | ✓   |
| Fallback print view (any entity)             | ✓    | ✓   |
| Tagged PDF accessibility tree                | partial | ✓ |
| PDF/A archival mode                          | —    | ✓   |
| Batch export with TOC                         | per-entity only | ✓ |
| Org-watermarked output                        | —    | ✓   |

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-68** — PDF/A archival mode (v2 compliance scenario).
- **OQ-69** — Are headers/footers themable by org or only shell-default?
- **OQ-70** — How are tagged-PDF semantics derived from custom Lexical nodes (need the source app to declare structural roles)?

## Summary

- Print and PDF export use **one shared render pipeline** rooted in a print-view route every entity-rendering app provides.
- A **mandatory preview surface** sits before any print or PDF output; no silent printing.
- A **print theme** override removes UI chrome and decorative colors; produces paper-readable output regardless of the user's normal theme.
- **PDFs are real PDFs** — selectable text, embedded fonts, metadata, document outline, accessibility tags (where source supports).
- The shell provides a `<PrintView>` component apps wrap their print body in; the shell owns pagination, headers, footers, page numbers, metadata.
- A **fallback print view** renders any entity from display hints when no app has registered — same fallback-renderer principle as elsewhere.
- v1 ships infrastructure plus first-party views for bundled apps; v2 adds tagged-PDF, PDF/A, batch export with TOC, org watermarking.
