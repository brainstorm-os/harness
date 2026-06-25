# Templates

Status: **design** (resolves [OQ-LD-10](../reference/11-open-questions.md#oq-ld-10--templates-as-a-type); closes the *default-template ownership* open sub-point of [21-objects-and-collections.md](../data/21-objects-and-collections.md); refines [OQ-JR-1](../reference/11-open-questions.md#oq-jr-1--journal-templates); gives [implementation-plan §B11.10](../implementation-plan.md) its foundation design). This doc does not introduce a new storage or trust mechanism — it **activates** the uniform-object model ([21](../data/21-objects-and-collections.md)), the layered-scope precedence ([19](../data/19-properties-and-schemas.md)), the shared create-flow ([database/40](../apps/database/40-create-flow.md)), and the editor slash-menu so that *one* templating capability is inherited by every app, rather than each app inventing its own.

## The problem (and why it is platform-level)

"Notes templates" was scoped as a Notes feature. It is not a Notes feature. The moment objects are uniform — every object is a rich-text body **plus** properties ([21 §Universal rich-text body](../data/21-objects-and-collections.md)) — a template is just *a pre-filled object you stamp out copies of*. That shape is identical for a Task, a Mail draft, a Contact, a Database row, a Journal entry, or a Note. A per-app template system would re-implement the same "clone this prototype into a new entity" logic in every app — the exact silo the [21](../data/21-objects-and-collections.md) remodel removed.

So templates are built **once**, as a cross-cutting platform foundation, and every app picks them up through surfaces it already has (the create-flow and the editor). This is what [§B11.10](../implementation-plan.md) already anticipated by tagging it *"cross-app … not Notes-internal"*; this doc is its design.

## "Template" is three concepts, not one

Conflating them is the trap. They share a data shape (below) but differ in how they are *applied*:

1. **Object template** — a prototype entity of some type. Applied by the **create-flow**: "new X from template Y" clones the prototype's body + properties into a fresh entity. Generalizes to *everything entity-backed* (Task, Mail draft, Contact, Database row, Note, Journal entry).
2. **Block / snippet template** — a reusable rich-text fragment. Applied by the **editor slash-menu**: insert the fragment at the cursor. Generalizes to *everything using `@brainstorm/editor`* (Notes, Journal, Tasks/Bookmark bodies, the `CompactEditor` composers).
3. **Vault template** — a whole curated vault (Welcome-2's 7 starter vaults). **Already built and out of scope here** — these are read-only build-time JSON manifests imported through `runWelcomeSeed` ([OQ-WC-3, resolved](../reference/11-open-questions.md)), *not* `Template/v1` entities. This doc covers user-authored object and block templates only; it does not touch the Welcome-2 path.

A Mail "template" is instructive: it is concept #1 (an object template of `Email/v1` in its draft state) whose body is concept #2 (editor content). A clean foundation gives mail templates for free.

## The data shape: `brainstorm/Template/v1`

> **Decision (resolves OQ-LD-10 → option (a)):** a template is its **own Block-Protocol entity type, `brainstorm/Template/v1`**, not a regular entity tagged `isTemplate`. A template that produces a `Task/v1` is itself a `Template/v1` — the type it produces is a **property** (`targetType`), not the object's identity type ([21](../data/21-objects-and-collections.md): one `entityType` per object; the `targetType` reference does not violate this).

Rationale — the tagged-entity alternative (fewer types, simpler) loses decisively on one point: **query pollution**. If a Task template were a `Task/v1` flagged `isTemplate`, then *every* Tasks view whose source is `byType = [Task]` would surface it unless every source and every filter in every app remembered to exclude `isTemplate`. That is a footgun replicated across the whole product. An own type keeps templates out of normal queries **by construction**, makes "templates for type T" a lookup rather than a full-scan-plus-filter, and keeps the [21](../data/21-objects-and-collections.md) one-type-per-object invariant clean.

A `Template/v1` reuses the uniform-object machinery wholesale — it *is* an object:

| Field | Meaning |
|---|---|
| (universal `root` body) | The **prototype body** — the rich text copied into instances. Lazy/zero-cost when empty, exactly as every object ([21 §Universal body](../data/21-objects-and-collections.md)). |
| `templateKind` | Enum `object \| block-snippet` (a TS string enum per code conventions — never a bare literal). |
| `targetType` | The BP entity-type URL an **object** template instantiates (e.g. `brainstorm/Task/v1`). `null`/ignored for `block-snippet`. |
| `prototype` (reserved key) | The **prototype properties** copied into instances (identity/provenance/universal props excluded). **Implementation note (B11.10a):** these are nested under one reserved `prototype` key on the entity's property bag rather than sitting flat alongside the control/presentation fields — so a prototype property named `targetType`/`name`/etc. can never collide with template machinery, and the copy is a single `{...prototype}` spread instead of a fragile key-exclusion walk. |
| `name`, `icon`, `cover` | How the template presents **in the picker** — describes the template itself, not necessarily the instance (see OQ-TPL-1). |

No new storage: a `Template/v1` is one row in `entities.db`, one Y.Doc, accessed through `entities.*` like any object, capability-gated per type. The registry already accepts a new type via the manifest `registrations.entityTypes[]` → `EntityTypesRepository.upsert` path; `Template/v1` is shell-bundled (it is not owned by any single app).

### Instantiation

Object template → new entity:

1. Resolve the create-flow **draft** as today ([database/40](../apps/database/40-create-flow.md)): type + criteria-inherited pinned properties from `source ∪ view.filters`.
2. Deep-copy the template's `root` body and prototype property values onto the draft.
3. `entities.createEntity(targetType, properties)` and bind the copied body.

> **Decision (pin precedence):** criteria-inherited pins (step 1) **win** over template values (step 2) for any property they both set. The pins are what make the new entity match the list it is being created in; a template must not silently knock the entity out of its own view. The template fills everything the criteria leaves unset. (This makes "+ New from template" in a filtered Tasks view produce a task that both matches the filter *and* carries the template's checklist body.)

Block-snippet template → editor insert: the slash-menu copies the template's `root` fragment to the cursor through the editor's existing insert path (the same path paste uses) — no entity is created.

## Scope and ownership

Templates resolve through the **same layered precedence as PropertySchema and Layout** ([19 §Conflict resolution](../data/19-properties-and-schemas.md): `entity > collection > type > user > org`), which is what lets a template be global, type-wide, or collection-specific without a parallel mechanism.

- **Vault-global / type-level** — a `Template/v1` with a given `targetType` is offered wherever that type is being created.
- **Collection-owned** — a Collection (`List/v1`) already reserves a `defaultTemplate` slot and may own a template set ([21 §The model](../data/21-objects-and-collections.md): *"A Collection additionally may own a property schema … and a default template"*). A collection's templates are offered in that collection's create picker.

> **Decision (closes the doc-21 *default-template ownership* open sub-point):** the **default** template for "+ New" resolves through a terminating ladder, more-specific-wins per [19](../data/19-properties-and-schemas.md): `view.defaultTemplate` (explicit, already in [database/40](../apps/database/40-create-flow.md)) → owning `collection.defaultTemplate` → type-level default template → none (blank). When an object's create context spans multiple schema-bearing collections, `collection > type` from the [19](../data/19-properties-and-schemas.md) precedence decides — no new rule.

## The shared surfaces (what every app inherits)

The foundation ships **two** affordances; apps get templating by having these, not by writing template UI.

1. **Create-flow picker** — when "+ New" / `Cmd+N` resolves a type/collection that has ≥1 applicable template, the create-flow ([database/40](../apps/database/40-create-flow.md)) offers *Blank* + each template through the shared fancy-menus runtime (`@brainstorm/sdk/menus`, per the menu standards — no bespoke list). Picking a template runs instantiation above. Zero templates → today's behavior unchanged (straight to a blank draft). This is the *"`Cmd+N` flow in every app picks up the same surface"* of §B11.10.
2. **Editor slash-menu insert + "save selection as template"** — `@brainstorm/editor`'s slash menu lists `block-snippet` templates; selecting one inserts the fragment. The block-selection menu gains *"Save selection as template"* → captures the selected blocks into a new `Template/v1 { templateKind: block-snippet }`. Inherited by every editor-bearing app at once.

A third, lighter affordance falls out for free: because templates are ordinary objects, *"Save as template"* on any object's ⋯ menu clones the current object into a `Template/v1 { templateKind: object, targetType: <its type> }`, and templates are browsable/manageable in the Database app (or a seeded "Templates" collection) with no bespoke management screen.

## Security

No new capability or trust surface. Templates are ordinary `entities.*` rows, capability-gated per type like everything else; instantiation is the existing client-side copy → `entities.createEntity` write path; a snippet insert is body content through the editor's existing insert path (same trust as paste — no escalation). The Welcome-2 vault-template path (build-time, read-only) is untouched and remains separate.

## Reconciliation with existing docs

- **[database/40-create-flow.md §Templates](../apps/database/40-create-flow.md)** — its "v2, OQ-LD-10 open" note is superseded: `view.defaultTemplate` clones a `Template/v1` per this doc, resolved through the ladder above.
- **[Notes §B11.10](../implementation-plan.md)** — Notes' "block snippets" = surface #2; "object templates" = surface #1 over `Note/v1`. Notes is a *consumer* of the foundation, not the owner.
- **[OQ-JR-1 — Journal templates](../reference/11-open-questions.md#oq-jr-1--journal-templates)** — refined: a journal template is a `Template/v1 { targetType: Note/v1 }` owned by the Journal collection (a per-vault default via the collection's `defaultTemplate`), **not** a bespoke `kind=journal-template` flag on a Note. Journal templates become an application of this foundation.
- **[file-manager-ux §"Templates…"](../apps/41-file-manager-ux.md)** — its "Templates…" menu sourced from a `brainstorm/Template/v1` query is exactly surface #1, now concrete.
- **[graph/10 pattern templates](../apps/graph/10-pattern-filters.md)** — out of scope. A graph pattern "template" is a fork of a `GraphView` entity (a saved view), a different concept from object/block templates; it does not use `Template/v1`.
- **Welcome-2 vault templates** — out of scope (build-time JSON manifests, not entities), as stated above.

## Open questions

> **OQ-TPL-1 — RESOLVED for v1 (B11.10a):** object-template instantiation copies **body + prototype properties only**. `name`/`icon`/`cover` describe the template in the picker and are *not* seeded onto the instance (the codec stores them as siblings of `prototype`, outside the copied bag). A future opt-in `seedIcon`/`seedCover`/`seedName` is the natural extension; not built for v1.

> **OQ-TPL-2 — RESOLVED for v1 (B11.10):** **preserve references.** A block-snippet's `root` fragment inserts through the editor's existing insert path — the *same* path paste uses — so transclusion / object-link / mention nodes carry their `entityId` verbatim and resolve to the original objects. A snippet is a reusable view of *your graph*, not a literal-text macro; re-pointing each reference to a fresh deep-copied object subtree has no clear owner and is not what "insert this snippet" means. A future *"detach / duplicate referenced objects"* is an explicit opt-in on the insert, never the default.

> **OQ-TPL-3 — RESOLVED for v1 (B11.10):** **static prototypes; dynamic tokens are v2.** Instantiation is a pure structural deep-copy (`instantiateObjectTemplate` + the body copy) with no expansion pass — there is no token grammar in v1, so `{{today}}` typed into a template body persists as literal text. A token resolver is a localized v2 addition that does not change the `Template/v1` data shape; the Journal daily-note `{{today}}` need is tracked by [OQ-JR-1](../reference/11-open-questions.md#oq-jr-1--journal-templates) and rides that v2 work.

> **OQ-TPL-4 — RESOLVED for v1 (B11.10):** **yes — ordinary entities on the existing path.** `Template/v1` rows sync and share exactly like any other entity: they are capability-gated `entities.*` rows, so the selective-sync policy (`10.13`) and collab share (`Collab-C5`) apply with no template-specific handling. Only the Welcome-2 vault-template artifacts (build-time JSON, not entities) stay off the entity path.

## Implementation

Gated behind this design. The **foundation rung** builds `Template/v1` + instantiation + the two shared surfaces; per-app pickups are then free (a consuming app gets the create picker by virtue of using the shared create-flow, and snippets by virtue of using `@brainstorm/editor`). Ladder in [implementation-plan §B11.10](../implementation-plan.md); the foundation is the Stage 12 `templates` rung that §B11.10 is gated on.
