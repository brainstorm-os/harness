# Publish a website from your vault (design)

**Status:** design / not built. Track A ("use Brainstorm to build and publish a
website"). This is **net-new** — there is no publish-to-site / static-export
capability today. (`catalog-publish` is app-store catalog signing;
`extract-html` / readable-content-extraction is the Browser reader — both
unrelated.)

The good news up front: **almost all the raw material already exists.** A
hardened Lexical→HTML serializer ships today, a single-note HTML/PDF export flow
ships today, Collections are a first-class "set of entities" primitive, and the
theme tokens flatten to CSS variables. The net-new work is the *multi-page*
layer: reading many entities' bodies (not just the open one), rewriting internal
links to relative pages, generating a themed stylesheet, and packaging the result
as one downloadable artifact. No new shell capability is required for the MVP.

---

## 1. Ground truth — what already exists

### 1.1 The Lexical→HTML serializer already exists ✅ (the crux)

[`packages/editor/src/serialize-html.ts`](../../packages/editor/src/serialize-html.ts)
exports **`serializedStateToHtml(state, { maxBlocks? })`**: a pure
`SerializedEditorState → escaped HTML string`. It is the string twin of the
in-app React preview (`renderEditorState`), emits standalone semantic HTML (no
`bs-editor__*` classes), HTML-escapes every text + attribute, and passes URLs
through a scheme allowlist (`https? | mailto | tel | brainstorm | # | / | .`).
Covered block vocabulary: paragraph, heading (h1–h6), quote, list/listitem,
link/autolink, code/pre, text (bold/italic/underline/strike/code), linebreak,
tab, image (with `<figure>`/`<figcaption>`).

**Two gaps for a website:**
- It has **no entity-link resolution** — an internal link stored as
  `brainstorm://entity/<id>` survives (the scheme is allowlisted) but stays a
  `brainstorm://` URL a browser can't follow. It needs rewriting to a relative
  `<slug>.html`.
- **`page-ref` / `mention` / `date-mention` nodes fall through to the default
  branch** (rendered as plain text, link dropped). These *are* the internal
  links between pages — they must render as `<a href="<slug>.html">`.
- **`data:` image `src` is dropped** (not in the allowlist), so inlined/vault
  images vanish. A site-export mode needs to opt those back in (or extract
  binaries to an `assets/` folder).

Markdown export also exists (`serializedStateToMarkdown`).

### 1.2 Single-note export already exists ✅

[`apps/notes/src/ui/note-export.ts`](../../apps/notes/src/ui/note-export.ts) —
`buildNoteExportItems` splices **Export… → Markdown / HTML / PDF** into a note's
object menu. It reads the open note's live `SerializedEditorState`
(`getState()`), encodes via `serializedStateToHtml` / `serializedStateToMarkdown`
(PDF via the privileged `services.export.printToPdf`), and saves through the
shared file flow. This is the **single-page precedent** — a website MVP is its
multi-page generalization.

### 1.3 The file-save flow — single file only

[`@brainstorm-os/sdk/export-file`](../../packages/sdk/src/export-file/index.ts):
`requestSaveBytes(files, { suggestedName, filters, encode })` runs
`services.files.requestSave` → `write` and returns a `SaveDisposition`
(`Saved | Cancelled | Failed`). Plus `suggestedFilename` (FS-hostile-char clamp,
96-char stem cap) and `textToBytes`. **`SaveFileService` writes exactly one
file** — there is no directory-write / write-many capability. This directly
shapes the MVP output decision (§3): package the whole site as one file.

### 1.4 Collections — the "which entities" primitive ✅

[`packages/sdk/src/collections.ts`](../../packages/sdk/src/collections.ts): a
Collection (a "List" entity) resolves to a member set via
`effectiveMembers(resolved, { include, exclude })` =
`(source ∪ include) \ exclude`. This is the designed way to name "a set of
entities" and is exactly the shape a site's page list wants.

### 1.5 Reading *other* entities' bodies — the multi-page crux

The open note's state comes from the live editor. A site needs the body of
**every** member page, most of which aren't mounted. Two facts make this tractable:

- **Loading a doc snapshot is already an app capability.**
  [`packages/sdk/src/entity-body-copy.ts`](../../packages/sdk/src/entity-body-copy.ts)
  defines the transport `loadDoc(id) → { snapshotB64, truncatedTail }` /
  `applyDoc` / `closeDoc`, wired in `runtime.ts`. Notes already holds
  `entities.read:*`. So an app can pull any entity's Y.Doc snapshot bytes.
- **The inverse of the snapshot is a solved pattern.**
  [`plantSerializedStateIntoDoc`](../../packages/editor/src/plant-state.ts)
  writes a `SerializedEditorState` into a Y.Doc via a headless editor + the
  `@lexical/yjs` shared root (`doc.get("root", XmlText)`), and
  [`plant-import-body.ts`](../../packages/shell/src/main/import/plant-import-body.ts)
  drives it. **The one primitive that does not yet exist is the reader**:
  `serializedStateFromDoc(doc) → SerializedEditorState` (headless editor bound to
  the doc, then `editor.getEditorState().toJSON()`). That is the single new
  editor primitive the MVP adds.

So the batch pipeline per page is:
`loadDoc(id)` → apply snapshot into a fresh `Y.Doc` → **`serializedStateFromDoc`**
→ `serializedStateToHtml(state, { resolveEntityHref })`.

### 1.6 Theme → CSS ✅

[`packages/tokens`](../../packages/tokens/src/index.ts) exports
`flattenTokens(tokens)` → `Record<string,string>` of `--color-…` / `--space-…` /
`--radius-…` names (e.g. `color.background.primary → --color-background-primary`),
and `themes: Record<ThemeName, Tokens>` (defaultDark/Light, midnight, sepia,
solar, forest, nord, aurora, mint, rose, slate, highContrast). A published
`styles.css` is `:root { …flattenTokens(themes[pick])… }` plus a small
typographic base mapping the exported semantic tags to those variables.

---

## 2. INPUT — what becomes a site

Two shapes, one serializer. MVP ships **(A)**; **(B)** is the same assembler with
a different member-enumeration front end.

**(A) A page tree — a root Notes/Journal page + its `page-ref` sub-pages
(transitive).** Ships first because it needs **no new picker UI**: the entry is a
"Publish website…" row on a page's object menu, the member set is that page plus
everything reachable through its `page-ref` nodes (sub-pages), the home page is
the root, and the nav is the tree. `page-ref`
([`apps/notes/src/editor/nodes/page-ref-node.tsx`](../../apps/notes/src/editor/nodes/page-ref-node.tsx))
already carries `entityId` — enumeration is a body walk + BFS over refs, bounded
by a page cap.

**(B) A Collection.** `effectiveMembers` gives the member ids directly; the home
page is either the Collection's own body or an auto-generated index. Entry point
is a "Publish website…" action in Database (where Collections live). Same
`assembleSite` core.

Publishable entity types = those with a rich body (Notes `Note`, Journal entries;
any entity using the universal editor body). Database *rows* without bodies render
as a titled stub (or are skipped) — see open questions.

---

## 3. OUTPUT — a self-contained static site, packaged as one `.zip`

**Decision: bundle the whole site as a single `.zip`, saved through the existing
single-file dialog.** Rationale:

- `SaveFileService` writes one file (§1.3). A multi-file folder export needs a
  **net-new shell capability** (`requestSaveDir` + `writeInto(dir, relPath,
  bytes)` — arbitrary multi-file writes under a chosen directory, a real
  path-traversal / capability surface). MVP avoids that entirely.
- It honors the CLAUDE.md rule literally: a *file* save with an extension filter
  `filters: [{ name: t("website"), extensions: ["zip"] }]` (folder pickers
  correctly carry no filters — but we're not picking a folder).
- The precedent (`note-export.ts`) already saves bytes this way; only the encoder
  changes (one HTML string → a zip of many files).

### Bundle layout

```
site.zip
├─ index.html          # home page (root page, or an auto TOC for a Collection)
├─ <slug>.html         # one page per member entity; slug = kebab(title), id-deduped
├─ styles.css          # generated once from the chosen tokens theme
└─ assets/<hash>.<ext> # (phase 2) extracted vault image binaries
```

- **Per page:** `<!doctype html>` + `<head>` (charset, viewport, `<title>`,
  `<link rel="stylesheet" href="styles.css">`) + `<body>` with a light chrome
  (site title, back-to-home / nav list) wrapping
  `serializedStateToHtml(state, { resolveEntityHref, allowDataImages })` inside a
  centered reading column.
- **Internal links resolved:** the assembler builds an `id → slug.html` map over
  the member set and passes `resolveEntityHref(id)` to the serializer. In-set
  links (`brainstorm://entity/<id>` hrefs, `page-ref`, `mention`) become
  `<a href="<slug>.html">`; out-of-set targets render as plain text (dead
  `brainstorm://` links never reach the browser).
- **Fully offline / self-contained:** no external fonts, scripts, or CSS (matches
  the artifact CSP discipline). System font stack in `styles.css`.

### The zip writer — dependency-free

A **store-only (no-compression) ZIP** is ~80 lines: per-file local header +
data + a central directory + end-of-central-directory record, each entry
carrying a CRC-32. The shell already uses CRC-32 for the ydoc tail format
([`ydoc-store.ts`](../../packages/shell/src/main/storage/ydoc-store.ts), via
`node:zlib`), but that's main-side; the app-side writer bundles a tiny standard
CRC-32 table (no `node:zlib` in the sandbox). This adds **zero runtime
dependencies** (a new dep would trigger the packaging dry-run gate). `fflate`
(tiny, MIT, tree-shakeable) is the fallback if real deflate is wanted later.

### Smaller fallback already 90% done

A **single-page site = one self-contained styled `.html`** is essentially the
existing `note-export.ts` HTML path with a themed `<style>` inlined. If the
multi-page work slips, shipping "Export as styled web page (.html)" first is a
one-file change and a real user win.

---

## 4. HOSTING / PREVIEW model

- **Local preview (MVP, light):** the export popover lists the pages that will be
  published and offers **Preview home page**, which opens the generated
  `index.html` in the **Browser app** via the existing `open` intent (or an
  in-panel `<iframe srcdoc>` of the composed home page — note `srcdoc` inherits
  the app-page CSP, which is fine for fully-inline content). No new surface.
- **Export to disk (MVP):** the `.zip` via `requestSaveBytes` (§3). The user
  unzips and opens `index.html` — a browsable local site.
- **Publish to a host (later, out of MVP scope):** a `publish.*` capability +
  a target adapter (GitHub Pages / Netlify / S3 / Brainstorm-hosted), with the
  host token in the credentials store (same routing as AI keys). Explicitly
  deferred — the local-first zip is the whole MVP.

---

## 5. THEME — reuse the tokens

`themeToCss(themeName)` builds `styles.css`:
1. `:root { }` from `flattenTokens(themes[themeName])` — every semantic color /
   space / radius token as a CSS custom property.
2. A ~40-line typographic base binding the *exported* semantic HTML to those
   tokens: a `max-width: 42rem` centered reading column, system font stack,
   `h1–h6` scale, `p`/`blockquote`/`ul`/`ol`/`pre code`/`figure`/`a`
   (link color = `--color-accent…`), light/dark handled by shipping the chosen
   theme's values directly (a single-theme site; a `prefers-color-scheme`
   two-theme sheet is a later nicety).

The export popover's **theme picker** defaults to the current app theme, so a
published site looks designed, not raw. This is the cheap, high-leverage polish.

---

## 6. MVP slice + file-by-file work

**MVP:** *From a Notes page's object menu → "Publish website…" → pick a theme →
export a browsable multi-page static site (root page + its sub-pages, internal
links resolved, themed) as a single `.zip`.* No new shell capability (Notes
already holds `entities.read:*` + `files.write`).

### New / changed files

**editor (the two primitives):**
1. **`packages/editor/src/serialize-html.ts`** *(extend, don't fork — DRY)* — add
   an options bag `{ maxBlocks?, resolveEntityHref?: (entityId: string) => string
   | null, allowDataImages?: boolean }`. Rewrite `link`/`autolink` hrefs matching
   `brainstorm://entity/<id>` through `resolveEntityHref`; render `page-ref` /
   `mention` / `date-mention` as `<a href={resolveEntityHref(id)}>label</a>` when
   in-set else plain text; add `data:` to the image-`src` allowlist when
   `allowDataImages`. Extend `serialize-html.test.ts`.
2. **`packages/editor/src/doc-to-state.ts`** *(new)* —
   `serializedStateFromDoc(doc: Y.Doc): SerializedEditorState`, the inverse of
   `plantSerializedStateIntoDoc` (headless editor + `@lexical/yjs` binding over
   `doc.get("root", XmlText)`, then `getEditorState().toJSON()`). Export from
   `packages/editor/src/index.ts`. Add a round-trip test
   (`plant → serializedStateFromDoc` is identity).

**sdk (the pure assembler — new subpath `@brainstorm-os/sdk/site-export`):**
3. **`packages/sdk/src/site-export/assemble-site.ts`** *(new)* —
   `assembleSite({ pages: { id, title, state }[], homeId, siteTitle, theme }):
   { files: { path: string; bytes: Uint8Array }[] }`. Slugging + `id→slug.html`
   map + dedupe; per-page HTML doc (chrome + reading column) via
   `serializedStateToHtml` with the resolver bound; `index.html`; `styles.css`.
   Pure, unit-tested against fixture states.
4. **`packages/sdk/src/site-export/theme-css.ts`** *(new)* — `themeToCss` (§5).
5. **`packages/sdk/src/site-export/zip.ts`** *(new)* — `zipStore(files): Uint8Array`
   store-only ZIP writer + a local CRC-32 table. Tested against a known-vector.
6. **`packages/sdk/src/site-export/index.ts`** *(new)* — subpath barrel. Add the
   `./site-export` **`exports` entry in `packages/sdk/package.json`** *and the
   matching `vitest.config.ts` alias* (new SDK subpaths need both).

**app integration (Notes, smallest entry):**
7. **`apps/notes/src/ui/site-export.ts`** *(new)* — `buildSiteExportItems`: a
   "Publish website…" object-menu row that (a) enumerates the page tree (root +
   transitive `page-ref` sub-pages, capped), (b) `loadDoc`s each member via the
   runtime transport → `serializedStateFromDoc`, (c) `assembleSite` →
   `zipStore`, (d) `requestSaveBytes` with the `.zip` filter, (e) opens the theme
   picker in the shared **export popover** (reuse `openExportPopover`, add a theme
   radiogroup). Mirror `note-export.ts` structure; keep it a pure builder taking
   the state/transport surfaces so it unit-tests against stubs.
8. **`apps/notes/src/app.tsx`** *(edit)* — splice `buildSiteExportItems` into the
   object-menu extras next to `buildNoteExportItems`.
9. **`apps/notes/src/i18n/en.json`** *(edit)* — new keys (menu row, dialog title,
   filter name, theme legend, "N pages" via the `plural` helper — app-side
   `createT` has no ICU).
10. **tests** — `site-export.test.ts` (Notes, stubbed transport + files),
    plus the editor/sdk unit tests above. A Playwright assertion on the popover
    per the user-facing-PR standard.

**docs / plan:**
11. **`docs/implementation-plan.md`** — a tracked iteration id (new feature ⇒
    plan rung same turn it ships). **`docs/apps/09-shared-sdk-catalog.md`** — add
    the `/site-export` subpath row.

### Reuse ledger (checked the catalog first)
`serializedStateToHtml`, `plantSerializedStateIntoDoc` (pattern), `flattenTokens`
+ `themes`, `effectiveMembers`, `requestSaveBytes` / `suggestedFilename` /
`textToBytes`, `openExportPopover`, the `loadDoc/applyDoc/closeDoc` transport,
`IconName`, `ObjectMenuExtraItem`, `createT`/`plural`. **Genuinely new:**
`serializedStateFromDoc` (editor), the `site-export` assembler + `themeToCss` +
`zipStore` (sdk), the Notes menu row. No new UI *component* — the export popover
gains a radiogroup, not a new dialog.

---

## 7. Open questions

- **OQ-WEB-1 — zip vs folder.** MVP ships zip (no new capability). Is a real
  `requestSaveDir` + sandboxed multi-file write worth the security surface for a
  directly-browsable folder, or is unzip acceptable?
- **OQ-WEB-2 — images/binaries.** MVP inline vault images as `data:` URIs
  (`allowDataImages`, bloats HTML) vs phase-2 extract to `assets/<hash>.<ext>`
  (needs a serializer hook to emit a relative `src` + the binary resolver). Which
  first?
- **OQ-WEB-3 — non-body entities.** Database rows / entities without a rich body:
  render a titled property table, a stub, or skip?
- **OQ-WEB-4 — nav chrome.** Auto-generate a nav sidebar / breadcrumb from the
  page tree, or keep MVP to inline links + a home TOC only?
- **OQ-WEB-5 — out-of-set links.** Plain text (MVP) vs a "not published" tooltip
  vs keep the `brainstorm://` link for a future in-app open?
- **OQ-WEB-6 — page cap / large sites.** `serializedStateFromDoc` per page is a
  headless bind; cap the member count (e.g. 200) and/or batch off the main thread
  for big vaults.
- **OQ-WEB-7 — publish target.** Which host(s) for the eventual `publish.*`
  capability, and does Brainstorm host, or only export for the user's own host?
- **OQ-WEB-8 — two-theme output.** Ship a `prefers-color-scheme` light+dark
  `styles.css` (both token sets) vs the chosen single theme?
