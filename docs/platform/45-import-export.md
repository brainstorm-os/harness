# 45 — Import and export

Import/export is consistently a top source of user complaint in prior local-first knowledge tools. This doc treats it as a first-class product surface in Brainstorm: what formats are supported, how, what fidelity each carries, where the UI lives, how operations stream and recover, and how a vault round-trips end-to-end.

Builds on:
- [17-interoperability.md](17-interoperability.md) — the underlying mechanism: `intent.import` / `intent.export` verbs, exporter/importer registration, the file picker via the files service.
- [23-output-printing-pdf.md](23-output-printing-pdf.md) — PDF export specifically.
- [05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) — the entity / block model the formats are mapped to.
- [28-vault-and-onboarding.md](../foundations/28-vault-and-onboarding.md) — vault as the unit of bulk export/import.
- [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) — encryption boundary that imports/exports must respect.

## Failure modes Brainstorm's design is shaped against

These are the recurring failure modes seen across prior local-first knowledge tools.

1. **Third-party importers are typically lossy and incomplete.** Page bodies come through but relations, formulas, gallery layouts, and select/multi-select option colors drop silently. Users run the importer, lose trust, and then doubt every subsequent block they see.
2. **Markdown export strips almost all structure.** Relations, properties, embedded objects, layout — none survives. Users can "export" but not actually take their data with them.
3. **No takeout / bulk export.** Exporting is per-entity. Exporting a whole space means clicking through every page. No archive / no migrate-to-new-device flow at all.
4. **Block fidelity loss inside the same product.** Callouts become plain paragraphs on Markdown re-import, toggle blocks lose their state, mentions become dead text. Round-trip through any external format is destructive.
5. **Referenced files aren't bundled.** A note that embeds an image, when exported as Markdown, references a path that doesn't exist next to the file. Users have to manually re-pair attachments.
6. **CSV import doesn't create proper types.** A CSV with 12 columns produces an "Object" with 12 string properties, no type, no inference. Date strings stay strings; numbers stay strings.
7. **No dry-run.** A 5,000-page import either works or makes a mess that's painful to undo. Users are afraid to import.
8. **No progress, then silent failures.** Long imports show a spinner with no per-entity progress. Failures often surface as a small toast many minutes after starting, with no error report or "what got imported, what didn't".
9. **One-way only.** You can't export a space and re-import it. The product's own format is a black box you can't take with you.
10. **PDF is rasterized.** (Addressed separately in [23-output-printing-pdf.md](23-output-printing-pdf.md).)
11. **Discoverability is bad.** Import lives in one menu, export in another, and the per-app variants are inconsistent — some apps have it under "File", some under "…", some not at all.
12. **Identity / encryption coupling.** Exports bake the source identity in. Importing into a fresh account requires workarounds.

## Principles

1. **Everything visible is exportable.** If a user can see it in Brainstorm, they can write it to disk. No "stuck in the product" state.
2. **Two scopes always available**: **per-entity** (selection / one entity / a folder) and **whole-vault** (takeout). Vault-level export is always one click from Settings.
3. **A canonical, lossless round-trip format** (`.bsbundle`). Importing a bundle produced by Brainstorm rebuilds the source state byte-for-byte (modulo timestamps and content-addressed blobs reusing existing on-disk copies). This is the contract that lets users *trust* the product with their data.
4. **Fidelity is declared per format.** Every importer/exporter ships a fidelity matrix (what's preserved / lossy / dropped). The UI surfaces this *before* the user commits.
5. **Importers/exporters live in apps**, not the shell. The shell provides the orchestration surface (bulk vault export, file picker, progress UI, the registry). Per-format handlers are owned by the app that knows the data.
6. **Long operations stream**: progress per-entity, cancellable mid-flight, partial-state safe, with a written report on completion.
7. **Dry-run before write.** Every importer can do a non-destructive scan that produces counts, warnings, conflicts, and an import plan the user reviews before confirming.
8. **Discoverability is centralized.** One "Export…" verb in launcher, right-click, app menus; the shell composes the format list from registered handlers. Same for "Import…".
9. **Identity-portable.** Bundles produced by one identity can be imported by another (the new identity becomes the author of the imported entities; provenance preserves the original).

## Two scopes

### Per-entity export / import

Built directly on the `intent.export` and `intent.import` verbs from [17-interoperability.md](17-interoperability.md). The user has a selection (one entity, a few entities, a folder, a Database view) and writes it out — or picks a file and imports it into a target type/location.

This is the default surface. It covers the everyday "send this note as Markdown to my colleague" case.

### Vault-level export / import (takeout / restore)

A shell-owned surface in `Settings → Backup & Migration`. Operates on **all** entities in the vault, regardless of which app owns them, plus the shell-level state (registry, capability ledger, settings, shortcut bindings, themes, wallpapers). Produces a single `.bsbundle` archive.

> **Decision:** vault export is a shell capability, not an app capability. Reason: it must include shell-level state (settings, theme, ledger), and it must work even when no apps are installed (e.g. a freshly created vault). It uses the same on-disk shape an app importer would produce, so the format is uniform.

> **Decision:** vault **import** always creates a *new* vault, never merges into an existing one. Reason: merging two vaults raises identity-collision, schema-version-divergence, and capability-ledger-merge problems that have no clean answer. "Take the bundle, give me a vault that looks like that" is a finite operation; "weave it into this vault" is open-ended. Users who want to bring select entities across run a per-entity import.

> **Open:** OQ-245 — should `.bsbundle` import support a *cherry-pick* mode (select entity types or a folder subtree to import, instead of all-or-nothing)? *(Renumbered 2026-06-12 from a stale "OQ-183", which the canonical ledger had already assigned to the custom-CSS modding question.)*

## Bundle format — `.bsbundle`

The canonical round-trip format. A `.bsbundle` is a zstd-compressed tar archive with the following layout:

```
manifest.json                     # bundle metadata, schema versions, app inventory
schemas/                          # entity-type schemas (property definitions)
  brainstorm/Note/v1.json
  brainstorm/List/v1.json
  ...
entities/                         # one JSON per entity, BP-compatible
  <type>/<id>.json
ydoc/                             # per-entity Yjs doc binary (snapshot+tail)
  <id>.bin
blobs/                            # content-addressed binary attachments
  <sha256-prefix>/<sha256>
links.jsonl                       # entity-to-entity links (typed edges), one per line
properties.jsonl                  # property definitions / per-entity overrides
provenance.jsonl                  # per-entity provenance records (one per line)
apps.json                         # installed-app references (id + version + signature, not source)
shell/                            # shell-level state (whole-vault only)
  settings.json
  shortcuts.json
  ledger.json                     # capability grants
  themes/
  wallpapers/
```

> **Decision:** apps' source bundles are referenced (id + version + publisher key) but *not* embedded. Importing a vault on a machine without those apps installed triggers the install flow per [14-app-store.md](../apps/14-app-store.md) (or, if offline, leaves the entities with their owning app marked `pending-install` until the app is available).

> **Decision:** binary attachments are content-addressed (`sha256`). The same blob shared across many entities appears exactly once in the bundle. Re-importing a bundle next to an existing vault that already has those blobs is a no-op for storage.

> **Decision:** entity JSON files carry only the *declarative* state (properties, type, refs). Yjs document binaries (rich-text content, collaborative cursors omitted) live alongside in `ydoc/`. This separation lets non-Brainstorm tooling read entity metadata without a Yjs runtime, and keeps the format diff-friendly.

> **Decision:** `manifest.json` records `bundleFormatVersion` (semver, currently `1.0.0`). Importers reject incompatible majors and warn on newer minors.

> **Open:** OQ-246 — bundle signing. Should `.bsbundle` carry a publisher Ed25519 signature, so importers can verify the bundle wasn't tampered with in transit? Useful for team-distributed bundles; adds a key-management surface. *(Renumbered 2026-06-12 from a stale "OQ-184", which the canonical ledger had already assigned to the app-lock soft/hard-lock question.)*

## Supported import formats (v1 baseline)

The shell ships **no built-in importers**. Each format below is owned by a specific app (or is part of the vault-restore flow). The "Owner" column says where the importer lives.

| Format                         | Extension(s)              | Produces                                          | Owner                                                       | Notes                                                                                                                              |
|--------------------------------|---------------------------|---------------------------------------------------|-------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| Brainstorm bundle              | `.bsbundle`               | Whole vault, or scoped subset                     | Shell (vault restore) + per-app for per-entity              | Lossless round-trip; the trust-anchor format.                                                                                       |
| Markdown — single              | `.md`, `.markdown`         | `brainstorm/Note/v1`                              | Notes app                                                   | Frontmatter (YAML) → properties; wikilinks → entity links if a matching title exists; otherwise dead links flagged in the report. |
| Markdown — folder              | folder of `.md` + assets   | Multiple Notes, a Folder, attached files          | Notes app                                                   | Folder structure → `Folder/v1` hierarchy; relative-path images → File entities; `.canvas` files parsed if present.                  |
| Markdown — zip                 | `.zip` containing `.md`s   | Same as Markdown folder                           | Notes app                                                   | Convenience for received archives.                                                                                                  |
| Plain text                     | `.txt`                    | `brainstorm/Note/v1` (single paragraph block)     | Notes app                                                   | Loss-tolerant; no structure to preserve.                                                                                            |
| HTML                           | `.html`, `.htm`            | `brainstorm/Note/v1`                              | Notes app                                                   | Sanitized to BP-compatible blocks; class- and inline-style information dropped.                                                     |
| CSV                            | `.csv`, `.tsv`             | `brainstorm/List/v1` + member entities of a chosen type | Database app                                                | Column-to-property mapping UI; type-inference per column (date / number / bool / select); option-color preserved if present.        |
| JSON                           | `.json`, `.jsonl`          | Member entities of a chosen type                  | Database app                                                | One entity per object (or per line for JSONL); schema inferred or mapped.                                                           |
| Wiki-style vault (folder of Markdown + wikilinks) | folder        | Folder tree of Notes + tags + canvases             | Migration: per-product app (separately installable)         | `.md` with `[[wikilinks]]`, `#tags`, embedded images, `[[file.png]]` resolved; `.canvas` → Whiteboard-app entity when that app exists. |
| Page-database export (HTML + CSV) | `.zip`                 | Pages → Notes; databases → Lists; relations resolved | Migration: per-product app (separately installable)         | HTML+CSV export shape; gallery/list/board view kinds map to Brainstorm view kinds; formulas dropped with a warning.                 |
| Object-graph product export    | `.zip` (or product-native) | Object types → entity types; relations → properties; pages → Notes | Migration: per-product app (separately installable) | Closest semantic match of any source. Sets/Collections → Lists; object types → entity types; relations → properties.                |
| iCalendar                      | `.ics`                     | `brainstorm/Event/v1` entities                    | Calendar app (future)                                       | Stage-gated on Calendar app shipping.                                                                                                |
| vCard                          | `.vcf`                     | `brainstorm/Contact/v1` entities                  | Contacts app (future)                                       | Stage-gated on Contacts app shipping.                                                                                                |
| OPML                           | `.opml`                    | Outline structure → Notes hierarchy or List       | Notes app or future Outliner app                            | Useful for RSS-reader / mind-map imports.                                                                                            |
| Image                          | `.png`/`.jpg`/...          | `brainstorm/Image/v1` (a kind of File)             | File manager                                                | Passthrough; metadata (EXIF) read into properties; orientation respected.                                                            |
| File (generic)                 | any                       | `brainstorm/File/v1`                              | File manager                                                | Passthrough; the file's bytes become a blob; MIME type recorded.                                                                     |

> **Decision:** the big "migration apps" (one per source product we support) are *first-party but separately installed*. Reason: each is a heavy parser (importing from a structured-object product needs the entire source's type catalog mapped), only matters for migrating users, and bundling them all inflates the shell's default download. They live in the app store; the first-launch onboarding flow offers a "Migrating from…" picker that installs the right one.

> **Open:** OQ-247 — should the migration importers ship *as part of the shell* (always available, no install step on first launch) at the cost of bundle size, given that migration is the single most common Stage-0 use case for new users? *(Renumbered 2026-06-12 from a stale "OQ-185", which the canonical ledger had already assigned to the editor-virtualization question.)*

## Supported export formats (v1 baseline)

Same shape — every exporter belongs to an app, except the shell-level vault export.

| Format                         | Extension(s)         | Source                                             | Owner                                                          | Notes                                                                                                                  |
|--------------------------------|----------------------|----------------------------------------------------|----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Brainstorm bundle              | `.bsbundle`          | One/many entities, a folder, or the whole vault    | Shell (vault) + per-app (subset)                               | Lossless. The format users back up to.                                                                                  |
| Markdown — single              | `.md`                | One Note                                           | Notes app                                                      | Frontmatter populated from properties; embedded blocks rendered as fenced syntax when they have a known representation. |
| Markdown — folder              | folder               | A Folder of Notes + attachments                    | Notes app                                                      | Folder structure preserved; attached files written next to the `.md`s; wikilinks emitted when target is in-scope.       |
| Plain text                     | `.txt`               | One Note                                           | Notes app                                                      | All formatting stripped.                                                                                                |
| HTML                           | `.html`              | One Note                                           | Notes app                                                      | Self-contained; images either inlined as data-URIs or written to a sibling assets folder (user choice).                 |
| CSV                            | `.csv`               | A Database view (one row per member)               | Database app                                                   | Columns = visible properties (default) or all properties (option); date/number formatting respects locale.              |
| JSON                           | `.json`              | A Database / a List / arbitrary entity selection   | Database app + generic exporter in shell                       | One object per entity; schema reference included.                                                                       |
| JSONL                          | `.jsonl`             | Same as JSON                                       | Database app                                                   | Streaming-friendly; one entity per line.                                                                                |
| PDF                            | `.pdf`               | Any printable entity                               | Print/PDF subsystem ([23-output-printing-pdf.md](23-output-printing-pdf.md)) | Real PDF (selectable text, embedded fonts, document outline, metadata, optional accessibility tags).                    |
| GraphML / DOT / SVG / PNG      | `.graphml` / `.gv` / `.svg` / `.png` | A Graph view                              | Graph app                                                      | See iteration 9.13.13 in [implementation-plan.md](../implementation-plan.md).                                          |
| ICS                            | `.ics`               | Calendar entities                                  | Calendar app (future)                                          | Stage-gated.                                                                                                            |
| vCard                          | `.vcf`               | Contact entities                                   | Contacts app (future)                                          | Stage-gated.                                                                                                            |
| Image / File                   | original             | An Image / File entity                             | File manager                                                   | Round-trip the blob bytes; metadata kept in EXIF when applicable.                                                       |

> **Decision:** no entry-point produces a format the shell can't also re-consume (except where round-trip is fundamentally impossible — PDF, image rasters). Every other exporter has a paired importer somewhere in the catalog.

## The fidelity contract

Every importer/exporter declares, in its manifest, a **fidelity descriptor** the shell shows the user before the operation:

```jsonc
"fidelity": {
  "lossless": false,
  "preserves": ["text", "headings", "lists", "code blocks", "tables", "image embeds (relative path)"],
  "lossy":     ["color callouts (collapsed to plain paragraphs)", "embedded-block view kind"],
  "drops":     ["typed links to non-Markdown entities", "per-property colors", "Yjs collaborative cursors"]
}
```

The shell renders this in the import/export confirmation dialog: a three-column "Preserved / Lossy / Dropped" panel the user must acknowledge for any operation that isn't fully lossless. The `.bsbundle` format is the only one allowed to declare `"lossless": true`; everything else lists trade-offs honestly.

> **Decision:** the fidelity descriptor is *not* free-form marketing copy. It's a structured list reviewable across releases. CI fails if a registered handler declares `lossless: true` for any format other than `.bsbundle`.

## The import flow

1. **Trigger.** Launcher ("Import…"), Settings ("Import vault…"), app menu ("File → Import…"), or right-click on a Folder ("Import into…").
2. **Source picker.** `files.requestOpen` with the `filters` populated from the registered importers' supported extensions (per [`CLAUDE.md` §Conventions that bite](../../CLAUDE.md): "File-open / file-save dialogs declare allowed extensions when the operation is filterable").
3. **Format detection.** Importer is chosen by extension + magic-bytes sniff. If ambiguous (e.g. a folder that could be a wiki-style vault or plain Markdown), the user picks.
4. **Mapping UI** (where applicable). CSV column → property mapping; source type → entity type mapping; source tag → property-or-folder choice. Defaults are inferred; the user adjusts.
5. **Dry-run.** Importer scans the source without writing. Result: a structured plan — entity counts per type, conflict count, warnings, file-size estimate, time estimate.
6. **Confirm.** User reviews plan + fidelity panel; clicks Import.
7. **Streaming write.** Importer creates entities through the entities service (with its capabilities). Progress is reported per-entity via the `progress` host service. Operation is cancellable.
8. **Result report.** On completion (or cancellation), a structured report appears: N created, M skipped, K failed (with reasons), a "View imported entities" link, and the option to save the report as a file.

> **Decision:** every importer must implement `dryRun(): ImportPlan` separately from `run(): AsyncIterable<ImportProgress>`. The dry-run is required; the shell will refuse to register an importer that throws "not implemented" from `dryRun`.

> **Decision:** partial-failure semantics are **atomic per entity, transactional across the batch by default**. A run that hits an entity-write error rolls back that entity but keeps the prior successes. Users can opt into "stop on first error" in the confirmation dialog; the default is "continue and report".

## The export flow

1. **Trigger.** Launcher ("Export…"), entity right-click ("Export…"), app menu, or Settings ("Export vault…").
2. **Scope.** Selection / one entity / a folder / a Database view / the whole vault — depending on entry point.
3. **Format pick.** Shell calls `intents.suggest({ verb: "export", payload: { entityIds, format: "*" } })` and renders the registered formats, each with its label and a one-line fidelity summary.
4. **Options.** Per-format options (e.g. "include attachments", "page size", "scope to descendants"). The exporter declares its options schema; the shell renders a generic form.
5. **Destination.** `files.requestSave` for a single file, or a folder picker for multi-file outputs (Markdown-folder export).
6. **Stream.** Exporter writes to the chosen destination; progress reported. Cancellable.
7. **Report.** Same shape as import — what was written, any warnings (e.g. "3 typed links could not be represented in Markdown — see report").

> **Decision:** export operations never modify source entities, ever — not even to record "last exported at" metadata. Provenance flows one way: into the destination, never back. (Counter-example users sometimes ask for: "remember which entities have been exported to my external vault." That's a sync concern, not an export concern, and is out of scope for v1.)

## Conflict resolution

For imports that may collide with existing data (rare for new-vault imports; common for per-entity imports):

| Strategy            | What it does                                                                                          |
|---------------------|-------------------------------------------------------------------------------------------------------|
| Skip                | Drop the incoming entity; keep the existing.                                                          |
| Duplicate (default) | Create the incoming entity with a fresh id; preserve original-id in provenance.                       |
| Overwrite           | Replace the existing entity's properties with the incoming ones; preserve existing entity id.         |
| Merge (per-property)| Field-by-field: keep existing when set, take incoming when existing is empty. Yjs docs merge via CRDT. |
| Stop                | Halt the import; surface the conflict for resolution.                                                 |

The user picks per-import in the confirmation dialog; the choice is not sticky.

> **Decision:** entity-id collisions are essentially impossible except for `.bsbundle` re-import. For all other formats, importers generate fresh ids — there's no way the incoming JSON could collide with a v4 UUID already in the vault. So conflict UI is shown only when the bundle path is taken, or when the importer explicitly maps by some user-meaningful key (title, slug, etc.).

## Identity and provenance

Every imported entity carries a `provenance` record:

```json
{
  "source": "<source-product-id>",
  "sourceVersion": "2026-04",
  "originalId": "5f9a3e72-...",
  "originalUrl": "https://example.com/...",
  "importedAt": "2026-05-13T14:22:01Z",
  "importedBy": "<vault-identity-id>",
  "importerApp": "io.brainstorm.example-import",
  "importerVersion": "1.0.0"
}
```

Subsequent exports of that entity (in any format that supports provenance — currently bundle and JSON) carry it forward. This makes round-trip migrations debuggable and lets users see where a note originally came from years later.

> **Decision:** provenance is per-entity, not per-vault. A vault can contain entities imported from many sources at different times, and the lineage of each is preserved independently.

> **Decision:** identity in `importedBy` is the *importing* identity, not the *original author*. Encryption and signing operate on the new identity — see [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md). Original-author metadata, where the source format provided it, lives in a separate `originalAuthor` field inside `provenance`.

## Streaming, progress, cancellation

Long operations use the shell's `progress` host service (registered as part of Stage 7's notifications work, used by other long-running flows like vault index builds).

- **Streamed progress.** The importer/exporter yields `{ done, total, label, kind }` events per-entity (or per-batch for fine-grained ones).
- **Cancellation.** The user can cancel any in-flight operation. Partial results are preserved (importer) or the partial file is deleted (exporter), and the report indicates the cancellation point.
- **Backgrounding.** Long imports run in the background; the user can switch apps freely. A persistent notification chip in the dashboard shows progress; clicking it returns to the operation surface.
- **Pause/resume.** Bundle imports/exports support pause/resume (the bundle's content-addressed shape makes resume a natural fit). Other formats do not.

> **Decision:** the import/export progress UI is *not* a modal dialog. It's a non-blocking notification with a "View" affordance that opens the full operation surface. Blocking modals during long-running imports are a major irritant for users with large workspaces (8-hour imports = 8 hours staring at a spinner).

## Discoverability surfaces

Where the user finds these capabilities:

- **Launcher** — typing "import", "export", or a format name surfaces matching handlers.
- **Right-click** on an entity, folder, or selection → "Export…" submenu (formats from `intents.suggest`).
- **Right-click** on a Folder in the file manager → "Import into…" submenu.
- **App menu** (`File → Import…`, `File → Export…`) — composed by the shell, populated from the focused app's registered handlers plus shell-level entries.
- **Settings → Backup & Migration** — the home for vault-level operations:
  - Export Vault…
  - Restore from Vault Backup… (creates a new vault)
  - Migrate from… (lists supported source products — installs the appropriate importer app and walks the user through)
  - Scheduled backups (writes a `.bsbundle` to a chosen folder daily / weekly / monthly)
- **Drag-and-drop onto the dashboard** — dragging a `.md`, `.csv`, `.bsbundle`, or known archive onto the dashboard triggers the import flow with format auto-detected (per [17 §Drag-and-drop](17-interoperability.md#drag-and-drop)).

> **Decision:** there is one Export submenu and one Import submenu, ever. Every entry-point composes from the same registration index; users see the same list of options no matter where they invoked it from. The common prior-art failure mode of "this menu has CSV but that menu doesn't" is structurally impossible.

## Scheduled / automated export

`Settings → Backup & Migration → Scheduled backups` lets users automate vault export:

- Cadence: daily / weekly / monthly / on-shutdown.
- Destination: a local folder, an external drive, or a cloud-mounted folder (Dropbox, iCloud Drive, etc. — Brainstorm writes to the local path; the cloud provider handles upload).
- Retention: keep last N (default 7 daily + 4 weekly).
- Notification on success/failure.

> **Decision:** scheduled remote (over-the-network) backup is **not** a v1 feature. Reason: it implies a Brainstorm-hosted backup service or per-user cloud credentials, both of which carry significant trust, billing, and encryption-key-management implications. v1 only writes to local paths the OS gives Brainstorm access to. Users who want cloud backup mount their cloud as a local folder.

> **Open:** OQ-186 — should the Automations app ([39-automations-and-workflows.md](../apps/39-automations-and-workflows.md)) expose `export.vault` and `export.selection` as workflow actions, so users can build custom backup pipelines (e.g. "every Sunday, export the `Project Phoenix` folder as a bundle, write to Dropbox, post a Slack message")? This would supersede the limited scheduled-backups UI above.

## Capability surface

Importers and exporters require these capabilities, granted at install or at first invocation:

| Operation               | Required caps                                                                                                |
|-------------------------|--------------------------------------------------------------------------------------------------------------|
| Per-entity export       | `entities.read:<type>` for the source types; `files.write` for the destination.                              |
| Per-entity import       | `entities.write:<targetType>`; `files.read` for the source.                                                  |
| Vault export (shell)    | None (shell-internal); user-driven only via the Settings surface.                                            |
| Vault import (shell)    | None (creates a new vault, no existing-vault access needed).                                                 |
| Migration apps          | Same as per-entity import, plus possibly `entities.write:*` if the importer creates many types in one pass.  |

> **Decision:** `entities.write:*` is rare and treated as a "powerful capability" in the install-time grant flow. Bulk migration apps need it; everyday importers (CSV → one specific type) do not.

## Round-trip guarantee for `.bsbundle`

The format's defining test, run in CI from Stage 9 onward:

```
make-test-vault → export to bundle A → import bundle A as new vault →
  export to bundle B → compare A and B byte-equivalent
                      (ignoring timestamps in manifest.json and provenance.importedAt)
```

A `.bsbundle` regression that breaks this test fails the build. Property tests generate vaults of varying shapes (entity counts, type variety, link densities, blob sizes, Yjs doc complexity); the round-trip must hold for all of them.

> **Decision:** the round-trip test is *not* optional. It's a load-bearing piece of the user-trust story. Stage 13's hardening pass adds a manual cross-platform test (export on macOS, import on Linux, verify state) on top of the CI round-trip.

## Where each handler lives (initial app ownership map)

A pointer to the currently-planned home of each handler. Useful when looking for the code.

| Handler                                  | App                                                             | Implementation plan reference                                                                 |
|------------------------------------------|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `.bsbundle` import/export (per-entity)   | Shell SDK helper, callable from any app                         | Stage 9 (after the entities service exists)                                                  |
| `.bsbundle` whole-vault import/export    | Shell — Settings → Backup & Migration                            | Stage 9                                                                                       |
| Markdown / plain text / HTML             | Notes app                                                       | Stage 9 (Notes app)                                                                           |
| CSV / JSON / JSONL                       | Database app                                                    | Stage 9.12 (Database app), iteration 9.12.x for `export-list`                                |
| PDF (export only)                        | Print/PDF subsystem                                              | Stage 8 (print/PDF foundation)                                                                |
| GraphML / DOT / SVG / PNG                | Graph app                                                       | Stage 9.13.13 (Graph export pipeline)                                                         |
| Page-database migration                  | `io.brainstorm.page-db-import` (separately installable)          | Stage 14 (post-beta migration apps)                                                           |
| Wiki-vault migration                     | `io.brainstorm.wiki-import`                                      | Stage 14                                                                                      |
| Object-graph migration                   | `io.brainstorm.object-graph-import`                              | Stage 14                                                                                      |
| ICS / vCard                              | Calendar / Contacts apps                                         | Post-v1 (those apps are not in the Stage 9 first-party roster)                               |
| Workflow JSON (`.brainstorm-workflow+json`) | Automations app                                              | Stage 11b.16                                                                                  |

> **Open:** OQ-187 — should "migration from product X" apps be a recognised category in the app store (with a dedicated onboarding entry point), or just regular apps tagged "migration"?

## Extensibility: format adapters, non-file sources, and a converter market

*Design exploration added 2026-06-02 — refines the "importers/exporters live in apps" model above (Principle 5) and the first-party migration-app model. Captures three deltas from a design conversation; the build is deferred until 2–3 real adapters exist to pull on the contract — we don't deepen the mapping UI (still the shallow column→property + type-inference + dedupe-key of §The import flow step 4) speculatively.*

The model above answers *"where do importers live"* with **apps** (Notes owns Markdown, Database owns CSV/JSON) plus **heavy first-party migration apps** (one per source product, separately installed). Two gaps remain.

### The format long tail is unbounded — open it to a converter market

We cannot ship an importer for every format users have. For the `Task/v1` type alone: Todoist, Things, TickTick, Asana, Trello, Jira, TaskPaper, a dozen CSV dialects — and that is *one* entity type. The first-party roster (Notes/Database owning the generic formats; migration apps owning whole-product exports) leaves a long tail nothing covers.

The proposal: a **format adapter** — a small, **pure** converter distributed through the marketplace as a versioned, updatable unit (the same install / version / update machinery as any content-kind, per [47-marketplace.md](../apps/47-marketplace.md)). When a source format changes (a tool revises its CSV columns), the author ships an adapter update and users get it like an app update — no shell release. Adapters may be **third-party**, which is the whole point: the ecosystem fills the long tail the core team and first-party migration apps cannot. This does **not** replace `.bsbundle`, the in-app generic importers, or the heavy first-party migration apps — it is a *lighter* lane beside them for the per-format long tail.

> **Decision (clarification):** an app never needs to "own" import/export for its type. A `Task/v1` is importable today via the generic CSV/JSON importer (choose `Task` as the member type — see the CSV row above) without the Tasks app shipping any importer; the entities land in the object space and Tasks shows them because they *are* Tasks. Per-app importers exist only for **self-describing** formats whose semantics one app uniquely knows (Notes↔Markdown). Adapters cover the rest. Tasks correctly has no import/export surface of its own.

### Parse / Map split — what keeps an adapter small *and* safe

An adapter factors into two stages, which is what lets the hard part stay shared and the unsafe part stay contained:

- **Parse** (format-specific, pure): bytes → a normalized record set (a "table" — named columns + values). This is nearly all a CSV / XLSX / JSON adapter does.
- **Map** (records → canonical entity properties): for **generic** formats this is the **shared mapping UI already specced in §The import flow step 4** (column→property + type inference + dedupe key — the shallow v1); for **self-describing** formats the adapter supplies a deterministic map and skips the UI.

So most community adapters reduce to *"teach Brainstorm to read format X into a table"* — small, low-risk, reusing one mapping UI rather than reimplementing it. (A saved mapping is itself a small shareable artifact — a possible second market beside parser-adapters; deferred.)

Because the adapter only sees bytes / records and returns plain drafts — never touching the network, files, the ledger, or IPC — it can run in a **powerless isolate with no host bridge** (time/memory-bounded). The host does the file pick (`files.read`), the dedupe plan, and the entity writes. A powerless adapter has an *empty* capability surface, which is the argument for letting it through a **lighter marketplace review lane** than active-code apps / connectors.

### Sources aren't only files — one-shot API import

The import flow above is entirely file-based (`files.requestOpen`). But a major real case — **import from Notion via its API** — is *one-shot* yet *over the network with OAuth*. That falls between this doc (file imports) and [56-connector-framework.md](../apps/56-connector-framework.md) (continuous sync). They are two independent axes:

| | One-shot (import) | Continuous (sync) |
|---|---|---|
| **File source** | CSV / Markdown / `.bsbundle` | (file-watch — rare) |
| **API source** | **Notion API import** | connector live sync (GitHub, Slack) |

All four feed the same downstream: parse → map → project to canonical types → dedupe → write into the object space. The clean factoring is to make **Source** a pluggable stage (file picker | authenticated paged API) ahead of parse/map. An **API source reuses the connector framework's OAuth + scoped-egress broker** for fetching (it already authenticates to a host and pages without the app holding the token) but runs **once** — no persistent `SyncMapping/v1` cursor. A Notion import is, in effect, *a connector that does not keep a cursor.*

This keeps the security story intact: the network — the dangerous capability — lives entirely in the reviewed, connector-tier **Source** stage; the **parse/map** stage stays a powerless transform. Sequencing falls out naturally: **file-source import is buildable on its own** (no network dependency; fixes the immediate "can't get a CSV in" gap), while **API-source import rides on the connector / [38-network-and-proxy.md](../security/38-network-and-proxy.md) infrastructure** and lands with or after it.

> **Open:** OQ-242 — the community format-adapter market. Is a "format adapter" a distinct, lightweight marketplace content-kind (pure-transform, versioned, light review lane, possibly third-party) beside the heavy first-party migration apps — or do we only ever ship first-party importers + migration apps and treat any third-party converter as a full app?

> **Open:** OQ-243 — where one-shot authenticated-API import (e.g. Notion) lives: inside this doc's import flow as a non-file **Source** stage reusing the connector OAuth/egress broker but keeping no cursor — or as a "run-once" mode of a [56](../apps/56-connector-framework.md) connector.

> **Open:** OQ-244 — adapter execution sandbox: a **powerless no-bridge isolate** (adapter sees only bytes/records, returns drafts; host owns files/network/writes) — or adapter code running inside the consuming/owning app (simpler, but it inherits that app's capabilities and forfeits the light review lane). Determines whether a third-party converter market is safe to open.

## Non-goals (v1)

- **Real-time sync to external services.** Export is a one-shot operation; we don't keep a live mirror to any third-party workspace or vault. Users who want that build it through the Automations app, accepting the resulting model as "scheduled overwrite", not "sync".
- **Format normalization across dialects.** We don't try to bridge CSV-with-commas vs CSV-with-semicolons silently; users pick the dialect in the importer's options.
- **Live merge of two existing vaults.** Vault import always creates a new vault (see Decision above).
- **Cloud backup as a Brainstorm-hosted service.** Local-folder writes only in v1.
- **Per-format normalization council.** We don't ship a "the one true Markdown flavor"; the Notes app's importer ships its dialect, and other importers ship theirs.
- **OCR or content extraction during import.** A PDF imports as a `File/v1` entity; we don't extract the text into a Note. (Future: an AI-broker `process` intent could do this.)

## Summary

- Two scopes always available: per-entity (intent-driven) and whole-vault (Settings → Backup & Migration).
- `.bsbundle` is the lossless canonical format; every other format declares fidelity honestly.
- The shell composes one Import menu and one Export menu from per-app registrations; no app rolls its own.
- Long operations stream, are cancellable, run in background, and end with a structured report.
- Migration from common prior knowledge tools ships as first-party-but-separately-installed apps via the store.
- Round-trip through `.bsbundle` is a CI-enforced byte-level guarantee.
- Every imported entity carries provenance; subsequent exports preserve it.
- Scheduled backups (local-folder only in v1) sit in Settings; cloud-mediated backup is a v2 concern.
