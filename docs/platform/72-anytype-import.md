# 72 — Anytype import

Design for importing an [Anytype](https://anytype.io) space into a Brainstorm vault. Planning doc — no code yet; this fixes the mapping, the format choice, the fidelity contract, and the open questions before a line is written.

Builds on:
- [45-import-export.md](45-import-export.md) — the import framework this plugs into: the parse/map split, the fidelity descriptor, the Backup & Migration wizard, the ownership model. **Read that first.** This doc is one more *Source* under that framework.
- [../data/05-data-and-blocks-protocol.md](../data/05-data-and-blocks-protocol.md) — the entity / block model Anytype data maps *onto*.
- [../data/70-encrypted-attachment-sync.md](../data/70-encrypted-attachment-sync.md) — the asset byte-plane that Anytype file objects land in.
- Prior third-party importers as the reference implementation: `IE-6` Notion (`main/import/notion-import.ts`) and `IE-5` Obsidian (`main/import/obsidian-import.ts`) — pure parse → plan → privileged vault-binding, fed an extracted file list by the wizard.

## Why Anytype is worth a first-class importer

Anytype is the closest structural peer to Brainstorm of any tool a user might switch from. It is local-first, end-to-end encrypted, and — decisively — its data model is **objects + typed relations + a block tree**, which is nearly one-to-one with Brainstorm's entity / property / Lexical-body model. Where the Notion and Obsidian importers fight an impedance mismatch (Markdown-plus-frontmatter, or a page/database split that isn't quite our type/entity split), Anytype maps cleanly: an Anytype Object *is* a Brainstorm entity, an Object Type *is* an entity type, a Relation *is* a property. This is the highest-fidelity third-party migration we can offer, and it targets exactly the local-first, privacy-conscious user Brainstorm is for (the launch audience — see [ops/launch-plan.md](../ops/launch-plan.md)).

## The Anytype data model (source side)

An exported Anytype **Space** is a set of **Objects**. Each Object carries:

- **`id`** — a stable object id (referenced by other objects' relations and by link/mention blocks).
- **type** — the Object Type id (itself an object in the space).
- **`details`** — a flat map of `relationKey → value`: the object's properties (title, created date, custom relations, and the value of any object-link relations as target ids).
- **blocks** — the rich-content block tree (the body).

Supporting object kinds in the same space:

- **Object Type** — defines a layout + a set of relations. → a Brainstorm **entity type** (catalog `entity_types`).
- **Relation** — a typed property definition. Anytype relation *formats*: `longtext`/`shorttext`, `number`, `date`, `checkbox`, `select`(tag, single), `multiselect`(tag, multi), `object`(link to other objects), `file`, `url`, `email`, `phone`, `status`. → a Brainstorm **PropertyDef**.
- **Set** — a saved query (a type + filters + a view). → a Brainstorm **Database view / `List/v1`** with a `ListSource` query.
- **Collection** — a manual, ordered list of objects. → a Brainstorm **`List/v1`** with manual membership (the IE-6 Notion-database treatment).
- **File / media objects** — an image, file, or bookmark. → a Brainstorm **asset** (chunked, encrypted; [70](../data/70-encrypted-attachment-sync.md)) referenced by the owning entity.

### Block coverage

Anytype's block editor and Brainstorm's Lexical body overlap heavily. Clean maps: paragraph, heading 1–3, bulleted / numbered / checkbox (to-do) lists, quote, code (with language), callout, divider, table, LaTeX/equation, bookmark, file/image/video embed, and **link-to-object / mention** (→ a Brainstorm inline entity mention, the same node the editor already uses). The block tree is walked into `richBody` (Lexical JSON) with a plain-text `body` alongside (the canonical form for search + agent grounding), exactly as Notes stores it.

## Format choice: JSON, not protobuf (recommended)

Anytype exports a space in three shapes:

| Export | Fidelity | Parse cost | Verdict |
|---|---|---|---|
| **JSON** | Full object graph — types, relations, `details`, blocks, sets/collections | Plain JSON; no schema dependency | **Recommended v1 source.** |
| **Protobuf** (`.pb`) | Full — the native on-disk form | Needs Anytype's `.proto` + a generated decoder vendored in | Richer/most-authoritative, but a heavier, version-coupled dependency. Deferred (OQ-ANY-1). |
| **Markdown** | Lossy — blocks → md, relations/types/sets dropped | Trivial (reuses the Obsidian folder path) | **Not** worth a dedicated importer — the generic Markdown-folder import already covers it. |

v1 parses the **JSON export**: a directory (the wizard extracts the zip, owning the path-traversal + size guards, mirroring the Obsidian walk) of one JSON file per object, cross-referencing by object id. If the JSON export proves materially lossier than protobuf in practice (relation-format detail, view definitions), OQ-ANY-1 revisits vendoring the protobuf decoder.

## Where it lives

A shell-side importer `main/import/anytype-import.ts`, **pure + transport-injected**, exactly like `notion-import.ts` / `obsidian-import.ts`: the Backup & Migration wizard hands it the already-extracted file list; it returns an `AnytypeImportPlan` (entity drafts, minted type/relation catalog defs, resolved link graph, list/collection membership, asset references); the vault binding (`importAnytypeExport`) walks that plan through the same privileged create + link + asset-bind path the seeder / `.bsbundle` restore / other importers use. No new capability surface — it reuses the wizard's file read and the existing entity/catalog/asset writers.

### Parse / Map split (per doc 45)

- **Parse** (pure): the JSON export → a normalized record set — objects with `{id, typeId, details, blocks}`, plus the type + relation + set/collection definitions. No I/O.
- **Map** (records → canonical): objects → entity drafts; Object Types → `entity_types` catalog rows; Relations → PropertyDefs (format → Brainstorm property type); object-link relation values → typed entity-ref links; blocks → `richBody`/`body`; Sets → `List/v1` + `ListSource`; Collections → `List/v1` manual membership; file objects → asset drafts. This is a **self-describing** format, so the map is deterministic — it skips the generic column→property mapping UI (doc 45 §Parse/Map: self-describing formats supply their own map).

## Fidelity contract

```jsonc
"fidelity": {
  "lossless": false,
  "preserves": [
    "objects → entities", "object types → entity types",
    "relations → typed properties (text/number/date/checkbox/select/multiselect/url/email/phone/object-link)",
    "block tree → rich body (paragraph, headings, lists, todo, quote, code, callout, divider, table, LaTeX, bookmark)",
    "object-link relations & mention blocks → typed entity links",
    "Collections → List (manual membership)", "files/images → encrypted assets"
  ],
  "lossy": [
    "Sets: the type + membership import; complex multi-filter/aggregation views may simplify to a single query (OQ-ANY-4)",
    "relation option colors (mapped to the nearest Brainstorm select-option palette)",
    "block-level background colors / text colors not in the theme token set"
  ],
  "drops": [
    "Anytype space-level settings / widgets / dashboard layout",
    "object-type layout hints Brainstorm has no analog for",
    "version history (only current state imports)",
    "Anytype identity / space membership (the importing identity becomes author; provenance kept in a source-id property)"
  ]
}
```

Per doc 45, only `.bsbundle` may declare `lossless: true`; this ships an honest three-column matrix the wizard shows before the user commits.

## Dry-run + report

Inherits the framework's dry-run: a non-destructive scan produces counts (objects by type, relations, sets/collections, files, resolved vs dangling links) and a written report on completion (what imported, what was lossy, what dropped) — no bespoke work beyond populating the shared plan/report shape.

## Open questions

- **OQ-ANY-1** — JSON vs protobuf source. Ship JSON v1; revisit vendoring the protobuf decoder only if the JSON export is demonstrably lossier on a real space. Gate: a fidelity diff on a representative export.
- **OQ-ANY-2** — Type/relation **dedupe against the target vault catalog**. When an imported Object Type or Relation matches an existing vault type/property by name+shape, reuse it vs mint a namespaced copy? (Mirrors the Notion-database column→PropertyDef question; lean reuse-by-name, mint-on-conflict.)
- **OQ-ANY-3** — Relation-format → property-type table: the exact mapping for `status`, `multiselect` option colors, `object` (single vs multi ref), and `file`/`url`/`email`/`phone` (dedicated property types vs annotated text). Needs a real export to pin.
- **OQ-ANY-4** — Set (saved-query) translation depth: how much of Anytype's filter/sort/view model maps to a Brainstorm `ListSource` vs simplifies to "all objects of type T". v1 imports the type + a best-effort query; complex views degrade to the type query with a report note.
- **OQ-ANY-5** — asset bundling: confirm the JSON export co-locates file bytes (or references them) so file objects resolve to real bytes for the asset byte-plane, not dangling paths (failure mode #5 in doc 45).

## Iteration plan (proposed — `IE-10`)

Rungs, smallest-shippable-first, mirroring the IE-5/IE-6 core→tail shape:

- **`IE-10a` — Parse core.** JSON export → normalized record set (objects, types, relations, sets/collections). Pure; property-tested against a real exported space fixture. No writes.
- **`IE-10b` — Map + plan.** Records → `AnytypeImportPlan`: entity drafts, catalog type/relation defs, link graph, list membership, asset refs. Pure; resolves OQ-ANY-2/3 with the fixture in hand.
- **`IE-10c` — Vault binding + wizard.** `importAnytypeExport` walks the plan through the privileged writers; register the source in the Backup & Migration wizard with its fidelity descriptor + dry-run; add the `.zip`/folder source to the picker filters.
- **`IE-10d` — Assets + sets tail.** File objects → encrypted assets (OQ-ANY-5); Set → `ListSource` best-effort (OQ-ANY-4). Real-shell verify: import a representative Anytype space, confirm types/relations/links/bodies/collections/assets land, review the report.

Gate before starting `IE-10a`: obtain a **real Anytype JSON export** of a non-trivial space (types + relations + sets + collections + files) as the test fixture — the whole design leans on the actual export shape, and the OQs can't close without it.
