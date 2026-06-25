# 19 — Properties and schemas

This doc covers how Brainstorm models user-extensible structured data — properties, value types, modifiers, scopes, inverse relations, derived properties — and the rationale for the chosen design. Two prior-art design schools define the design space: the **page-database school** (properties belong to a database) and the **universal-relation school** (relations are first-class universal entities). Brainstorm picks neither verbatim; it also rejects the universal-relation school's "every semantic is a separate value type" approach in favor of **composable properties** built from a small base-type set plus modifiers.

This is a foundational doc. It builds on [05-data-and-blocks-protocol.md](05-data-and-blocks-protocol.md) (Block Protocol's canonical type system) and is read alongside [18-storage-and-search.md](18-storage-and-search.md) (how properties are indexed and queried).

## The two design schools

### Page-database school: properties belong to a database

In the page-database school, a *database* is a collection of pages with a shared property schema. You add a "Status" column to your project tracker; every page in that database gets a Status. Across databases — your project tracker, your bug tracker, your meeting notes — there is no shared property identity.

**What's good about it:** concrete mental model (database = table, property = column), zero setup friction, local clarity, no global namespace pressure.

**What hurts:** no reuse across databases (you re-create "Person", "Status", "Tags" everywhere), cross-database queries are weak, value sets fragment (two "Status" properties with the same options are unrelated), schema migration is per-database, no global ontology.

### Universal-relation school: relations are first-class entities

In the universal-relation school, every property (often called a "Relation") is itself an object. Types declare which relations they use. "Author" is one relation, used by Books, Articles, Notes — same identity, same value space.

**What's good about it:** real reuse, global ontology emerges, schema is data, refactoring centralizes.

**What hurts:** cognitive overhead, setup friction for one-off needs, naming collisions in the global namespace, value-set sharing is implicit and confusing, more state to sync/index, **and crucially** — products in this school proliferate value types (separate types for phone, email, URL, status, etc.) when these are mostly the same shape with behavioral differences. The user creates a "Status (Select)" type, a "Phone (Text)" type, a "Tags (Tag)" type — each is a different beast in the data model when they could be the same primitive plus modifiers.

### Where Brainstorm starts

Brainstorm has Block Protocol's **canonical entity-type schema** at a URL (per [05-data-and-blocks-protocol.md](05-data-and-blocks-protocol.md)). This is fixed by virtue of the type URL being immutable per version. But users will want to extend that schema with their own properties — Status, Priority, Project, Customer. That extension layer is what the two prior-art schools model differently.

Brainstorm's answer is **composable properties with explicit scope**: a small set of base value types, a universal set of modifiers (multiplicity, labels, vocabulary, format, validation, display), and an explicit scope attribute. The user builds properties by picking a base type and configuring; reuse is opt-in via scope promotion.

## Composable properties

A property is **a base value type plus modifiers**. There are six base value types:

| Base value type | Description                                              | Storage primitive          |
|-----------------|----------------------------------------------------------|----------------------------|
| `text`          | UTF-8 string                                             | string in `Y.Map` or `Y.Text` (CRDT-merged) |
| `number`        | Integer or float                                          | number in `Y.Map`          |
| `boolean`       | true / false                                             | bool in `Y.Map`            |
| `date`          | ISO-8601 date or datetime, timezone-aware                | string in `Y.Map`          |
| `entityRef`     | Reference to another entity (including File entities)    | entity id (string) + link in links table |
| `richText`      | Collaborative rich text (Lexical-bound)                  | `Y.XmlFragment`            |

That's it. Phone, email, URL, status, tag, person, **file**, and the rest are **not separate value types** — they are `text` (with format modifiers) or `entityRef` (with `allowedTypes` constraints and display modifiers). The proliferation of value types in the universal-relation school was a mistake.

### Files are entities, not a value type

Files in Brainstorm are first-class entities of a canonical type `brainstorm/File/v1`. A File entity has properties like `filename`, `mimeType`, `size`, `blobRef` (a content-addressed reference to the on-disk blob in `data/attachments/`), plus user-added properties (tags, descriptions) via the same overlay mechanism as any other entity.

A property like "Attachments" on a Note is therefore an **entityRef property restricted to `brainstorm/File/v1`**, with display modifiers that drive a file-aware view (gallery, viewer, thumbnail):

```jsonc
{
  "name": "Attachments",
  "valueType": "entityRef",
  "count": { "min": 0, "max": 50 },
  "allowedTypes": ["brainstorm/File/v1"],
  "entityFilter": {                                  // narrows what File entities qualify
    "mimeType": ["image/*", "application/pdf"],
    "maxSizeBytes": 10485760
  },
  "display": { "view": "gallery", "options": { "thumbnailSize": "medium" } }
}
```

This unifies several things that were special-cased before:
- **Searching files** — they're entities, indexed by the entities + search subsystems like any entity.
- **Tagging files** — overlay a Tags property on `brainstorm/File/v1`, exactly like any other type.
- **Collections of files** — query for entities of type `brainstorm/File/v1`, optionally filtered.
- **Files in graph views** — a file appears as a node like any other entity.
- **Files as intent targets** — `intent.open` / `intent.share` / `intent.export` route the same way.

The drag-from-OS-to-property flow becomes: shell creates a File entity (uploads blob to `data/attachments/`, populates File properties), the receiving property records an entityRef. `entityFilter` checks gate the upload before the entity is created.

> **Decision:** there is no `file` value type. There is a canonical `brainstorm/File/v1` entity type; properties referring to files are entityRefs with `allowedTypes: ["brainstorm/File/v1"]`. File-specific UX (gallery / viewer / thumbnail) is a property of the entityRef *display*, not a separate value type.

> **Open:** do we ship sub-types like `brainstorm/Image/v1`, `brainstorm/Video/v1`, `brainstorm/Audio/v1` that extend `File/v1` with tighter constraints, or stay with one File type and let `entityFilter`/`mimeType` narrow as needed? Tracked as OQ-64.

### Modifiers

Modifiers are the configuration that turns a base type into a meaningful property. Most modifiers apply to most types; this table is the matrix.

| Modifier       | Purpose                                                                                                                          | Applies to                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `count`        | Allowed cardinality range: `{ min, max }`. `min` ≥ 0, `max` ≥ 1. Hard upper bound on `max` is **50**. Replaces `required` and a boolean `multiple`. | All except `richText` (which is always `{1, 1}`). |
| `labels`       | When `count.max > 1`, optional labeled categories per value (Home / Work / Mobile).                                              | All except `richText`.            |
| `vocabulary`   | An entity reference to a Vocabulary entity. Restricts allowed values.                                                            | `text` and `number`.              |
| `format`       | Built-in semantic format affecting validation and display: `email`, `url`, `phone`, `currency`, `percent`, `markdown`, `code`.   | `text`, `number`.                 |
| `pattern`      | User-supplied regex for validation.                                                                                              | `text`.                           |
| `range`        | `{min, max}` constraint on numeric/date *value* (note: distinct from `count`, which is on cardinality).                          | `number`, `date`.                 |
| `precision`    | Decimal places for numeric display.                                                                                              | `number`.                         |
| `granularity`  | One of `date` / `datetime` / `time`. Whether time-of-day is part of the value.                                                   | `date`.                           |
| `allowedTypes` | Which entity types are valid targets.                                                                                            | `entityRef`.                      |
| `entityFilter` | Optional structured filter narrowing which entities of `allowedTypes` qualify (e.g. `mimeType` and `maxSizeBytes` for File refs). | `entityRef`.                      |
| `inverse`      | Declares an inverse name on the target type (see "Inverse properties" below).                                                    | `entityRef`.                      |
| `computed`     | Marks the property as derived; provides expression and dependencies (see "Derived properties").                                  | All except `richText` and `file`. |
| `unique`       | Each value must be unique within the scope.                                                                                      | `text`, `number`, `entityRef`.    |
| `display`      | Display options — see "Display options" below.                                                                                   | All.                              |

This is the constructor: pick a base type, layer modifiers, get a property. A conventional "Status (select)" = `text` + `vocabulary` + `count: {min: 0, max: 1}`. A "Status (multi-select)" = same with `count.max > 1`. "Phone numbers (up to 5, labeled)" = `text` + `format: phone` + `count: {min: 0, max: 5}` + `labels: [Home, Work, Mobile]`. A required title = `text` + `count: {min: 1, max: 1}`. Everything composes.

## Cardinality and labels

Two distinct concepts that often co-occur.

### Cardinality (`count`)

Every property declares how many values it accepts via a `count` range:

```jsonc
"count": { "min": 0, "max": 1 }     // optional, single (the default)
"count": { "min": 1, "max": 1 }     // required, exactly one
"count": { "min": 0, "max": 5 }     // optional, up to 5
"count": { "min": 1, "max": 50 }    // required, up to 50 (the hard upper bound)
"count": { "min": 2, "max": 4 }     // require between 2 and 4 values
```

> **Decision:** the hard upper bound on `count.max` is **50**. Properties with conceptually larger cardinality (e.g. "all tasks linked to this project") should be modeled as a relation traversed via inverse property, not as a multi-value property crammed past the bound.

> **Decision:** `count` replaces the boolean `multiple` modifier *and* the `required` modifier from earlier drafts. Required = `count.min ≥ 1`; multi = `count.max > 1`. One concept, one knob, no redundancy.

`count.min` defaults to `0`. `count.max` defaults to `1`. Omitting `count` entirely means `{ min: 0, max: 1 }` — the most common shape.

`richText` is always implicitly `{ min: 1, max: 1 }` — a Yjs `Y.XmlFragment` is one collaborative document, not many.

### Storage shape

> **Decision:** storage shape follows `count.max`:
> - `count.max == 1` → **bare value** in the entity's `Y.Map` property field.
> - `count.max > 1` → **`Y.Array` of `{ value, label? }` records**, regardless of how many values are present at any moment (a list-typed property with one current value still stores it as a one-element array).

Examples:

```jsonc
// count: {0, 1}
"properties": { "title": "Meeting prep" }

// count: {0, 5}
"properties": {
  "phones": [
    { "value": "+1-555-1234" },
    { "value": "+1-555-5678" }
  ]
}
```

This split keeps the common case (scalar properties) ergonomic while supporting list semantics cleanly when needed.

### Labels

When `count.max > 1`, an optional `labels` set categorizes values:

```jsonc
"phones": [
  { "value": "+1-555-1234", "label": "Mobile" },
  { "value": "+1-555-5678", "label": "Home" },
  { "value": "+1-555-9999" }                       // unlabeled is allowed
]
```

Labels are **per-property configuration**, not a separate vocabulary entity. They're a closed set of strings on the PropertySchema. Two properties on different entity types can independently declare `labels: [Home, Work, Mobile]`; they don't merge.

> **Decision:** labels are a property-local concept, not promoted to a global construct. Vocabularies cover the "I want shared values across properties" case; labels cover the "I want to categorize my multiple values within this property" case. These are different needs.

> **Open:** can the same label appear multiple times in one property's value set (e.g. two Home phones)? Default: yes (don't enforce uniqueness on labels). Tracked as OQ-48.

### Cardinality change rules

- **Increase `count.max`** (e.g. `1 → 5`): if the existing storage was bare, it's wrapped to a one-element array. Existing data preserved.
- **Decrease `count.max`** (e.g. `5 → 1`): each entity exceeding the new bound requires the user to pick which values to keep. Migration-grade operation; not a quiet edit.
- **Increase `count.min`**: warn for entities currently below the new minimum; require fix or revert.
- **Decrease `count.min`**: free.
- **Cross the `1` boundary** (max from 1 to >1): re-shapes storage from bare to array. Done in one transaction per entity.

## Display options

Display options describe **how** a property's value is rendered, separate from **what** the value is. They live on the PropertySchema as a `display` block:

```jsonc
"display": {
  "label": "Attachments",
  "icon": "paperclip",
  "order": 30,
  "view": "gallery",                    // base-type-specific view kind
  "options": {                          // view-specific options
    "thumbnailSize": "medium",
    "showFilename": true
  }
}
```

The `view` and `options` are interpreted per base type:

| Base type   | Valid `view` kinds                         | Notes                                            |
|-------------|---------------------------------------------|--------------------------------------------------|
| `text`      | `inline`, `block`, `multiline`, `pill` (with vocabulary) | `pill` requires `vocabulary`.       |
| `number`    | `inline`, `progress`, `rating`             | `rating` requires `range`.                       |
| `boolean`   | `checkbox`, `switch`                       |                                                  |
| `date`      | `inline`, `relative`, `calendar`           | `relative` shows "3 days ago"; `calendar` shows month-grid. |
| `entityRef` | `chip`, `card`, `list`, `table`, `graph`   | `graph` only meaningful when `count.max > 1` and the data is graph-shaped. |
| `entityRef` (when `allowedTypes` includes `brainstorm/File/v1`) | `gallery`, `list`, `viewer`, `thumbnail`, `inline-preview` | File-aware views. `viewer` opens in-place; `gallery` is a tile grid. |
| `richText`  | `inline`, `block`, `card`                  | `block` is the full editor; `inline` is read-only one-liner. |

> **Decision:** display options are **defaults set on the PropertySchema**. Per-collection / per-view overrides are a feature of the rendering app (a database app's view config can override). The user's chosen default in the PropertySchema is what apps fall back to.

> **Open:** how do display options interact with `fancy-menus`' rich row vocabulary? E.g. an `entityRef` with `count.max > 1` rendered with `view: "chip"` could naturally use the `chip` row kind in fancy-menus. We should formalize the mapping. Tracked as OQ-49.

## Inverse properties

Inverse (a.k.a. reverse) properties are how Brainstorm answers a recurring gap in prior tools: when Person A has a "children" entityRef property pointing at Person B, Person B should naturally show "parent: A" without anyone editing B.

> **Decision:** inverse properties are **computed views, not stored data**. The link is recorded once; both the primary and inverse views read from the same record and can both write through to it.

### Declaring an inverse

A primary entityRef property can declare an inverse on its target type:

```jsonc
{
  "name": "Children",
  "scope": { "kind": "type", "target": "io.example/Person/v1" },
  "valueType": "entityRef",
  "count": { "min": 0, "max": 50 },
  "allowedTypes": ["io.example/Person/v1"],
  "inverse": {
    "name": "Parent",
    "count": { "min": 0, "max": 1 },    // cardinality for the inverse direction
    "auto": true                         // auto-materialize on the target type's schema
  }
}
```

The entities service automatically:

1. Materializes a virtual `Parent` PropertySchema on `Person/v1`'s effective schema.
2. Routes writes to either side back to the same underlying link.
3. Validates cardinality on writes (e.g. setting B's `Parent` to D when B is already a child of A: warn the user; resolve via "remove from A" or "fail").

### Editing the inverse

```
   A.children += B           ⇔     B.parent = A
   B.parent = A              ⇔     A.children += B and remove B from any other parent
   A.children -= B           ⇔     B.parent = null
```

These are the same edit, written from different angles. The UI surfaces the inverse like a normal property; the user doesn't think about which side is "primary".

### When inverse cardinality is violated

Setting `B.parent = A` when `B.parent = D` already, with `inverse.count.max == 1`:

- Default: surface a one-click resolution: "Replace D with A as parent? (will remove B from D's children)" / "Cancel".
- The user is in control; no silent fixup.

> **Decision:** inverse properties are read-only at the PropertySchema level — users cannot directly create an inverse PropertySchema; they declare the inverse on the primary one. This avoids two-way ownership confusion.

> **Decision:** Brainstorm does not store the inverse separately in the Y.Doc. Reads compute it from the links table; writes route to the primary's storage. The links table (per [18-storage-and-search.md](18-storage-and-search.md)) is the source of truth.

## Derived (computed) properties

A derived property's value is computed from other properties or links — not stored. It's recomputed when its dependencies change and cached for read.

### The expression language

> **Decision:** derived properties use a **small, sandboxed expression language** with no I/O, no side effects, deterministic evaluation. The reference grammar is JsonLogic-shaped or a similar minimal expression DSL — see OQ-50 for the language choice.

Functions available (initial set):
- Arithmetic: `+`, `-`, `*`, `/`, `mod`, `abs`, `round`, `floor`, `ceil`.
- Comparison: `=`, `!=`, `<`, `<=`, `>`, `>=`.
- Logical: `and`, `or`, `not`.
- Aggregation (over multi-value properties or relations): `sum`, `avg`, `count`, `min`, `max`, `concat`.
- String: `length`, `upper`, `lower`, `trim`, `concat`, `slice`, `match`.
- Date: `now`, `add`, `diff`, `format`.
- Conditional: `if`.

Examples:

```jsonc
// total cost = sum of nested item costs
{ "computed": { "expression": "sum(items.cost)", "dependsOn": ["items"] } }

// status from due date
{ "computed": {
  "expression": "if(now() > dueDate, 'overdue', if(now() > dueDate - days(3), 'soon', 'ok'))",
  "dependsOn": ["dueDate"]
} }

// rollup across an entityRef
{ "computed": {
  "expression": "count(linkedTasks(status = 'open'))",
  "dependsOn": ["linkedTasks"]
} }
```

### Dependency tracking and recomputation

The entities service tracks the dependency graph (which properties depend on which others). When a dependency changes, dependent computed properties are invalidated. Recomputation happens lazily on read (with cached results) and eagerly for properties marked `eager: true` (e.g. those used in queries).

> **Decision:** derived properties are write-once via the expression — users cannot manually override the computed value. To override, change the expression or duplicate to a non-computed property.

> **Decision:** derived properties cannot reference other derived properties of *unbounded depth*. Cycle detection rejects circular dependencies; depth limit (default 5) bounds compute time.

### Performance and storage

- Computed property values are cached in the entities table (denormalized) for query/sort performance.
- Cache invalidation runs in the storage worker (per [18-storage-and-search.md](18-storage-and-search.md)).
- A property marked `computed.eager: true` is recomputed and persisted when its dependencies change; otherwise it's recomputed on first read after invalidation.

### Phasing

> **Decision:** derived properties are **v2**, not v1. The expression language, dependency tracker, and cache invalidator are real engineering and don't earn their cost in the smallest viable product. v1 ships read-only display-formatting (e.g. "show this date relative") which covers a slice of the use case without expressions.

## Vocabularies

A **Vocabulary** is a first-class entity (`brainstorm/Vocabulary/v1`) that constrains a property's allowed values:

```jsonc
{
  "id": "ent_vocab_general_status",
  "type": "brainstorm/Vocabulary/v1",
  "properties": {
    "name": "General Status",
    "values": [
      { "id": "todo",    "label": "To Do",    "color": "gray"  },
      { "id": "doing",   "label": "Doing",    "color": "blue"  },
      { "id": "blocked", "label": "Blocked",  "color": "red"   },
      { "id": "done",    "label": "Done",     "color": "green" }
    ]
  }
}
```

A property with `valueType: text` and `vocabulary: <vocab-id>` is what page-database tools would call a "select"; raise `count.max` above 1 and it's a "multi-select". The vocabulary entity is shared across any number of properties that point to it.

### Vocabulary lifecycle

- **Inline vocabulary** — a property with vocabulary auto-creates a private vocab scoped to itself.
- **Promote inline → shared** — user clicks "Make this list reusable"; the vocab becomes a standalone entity, the original property points at it.
- **Fork shared → inline** — user wants to diverge; a fresh inline vocab is seeded with current values.

> **Decision:** vocabularies are explicit, not inferred. The product never silently merges two value sets that "look similar". Promotion is a deliberate user act.

> **Open:** when does the UI nudge promotion (e.g. user typed "Status" and a shared "Status" vocab already exists)? Visible suggestion, never forced. Tracked as OQ-41.

## Value envelopes

A property's *value* is what the user enters into a field. So far that's been a scalar (string / number / boolean / ISO-date / entity id) or, for multi-value properties, a `Y.Array<{value, label?}>`. Real-world fields often carry **meta** that travels with the value: a price has a currency *and* an exchange rate snapshot; a measurement has a unit; an AI-extracted text has a source URL and a confidence score; a timestamp has a timezone-at-write-time. Cramming meta into separate sibling properties (`price`, `priceCurrency`, `priceCourseToUSD`) breaks the one-thing-per-property mental model and means filters / sorts / display options have to coordinate across three keys.

> **Decision:** a property value is **logically an envelope** of the shape `{ value: T, ...meta }` where the meta keys are declared on the PropertySchema via a new `valueMeta` modifier. When `valueMeta` is omitted, the envelope's meta is empty and storage uses the bare-scalar form (today's behavior, preserved). When `valueMeta` is present, storage always writes the envelope.

### The `valueMeta` modifier

```ts
type ValueMetaFieldSchema = {
  valueType: "text" | "number" | "boolean" | "date" | "entityRef";
  // The same modifier subset that applies to scalar properties of this type:
  required?: boolean;                          // must be set when the envelope is written
  snapshot?: boolean;                          // freeze on write; ignore upstream changes
  allowedTypes?: string[];                     // for entityRef meta fields
  vocabulary?: string;                         // for text meta fields
  format?: "currency" | "url" | "email" | …;
};

type ValueMeta = Record<string /* meta-field name */, ValueMetaFieldSchema>;
```

Each meta field is a tiny PropertySchema in miniature. Three meta-field flags are unique to envelopes:

- **`required`** — the envelope cannot be written without this meta field set.
- **`snapshot`** — once written, the value of this meta field is frozen. If its upstream source changes later, the snapshot stays. Used for exchange-rate captures, locale-at-write-time, etc.
- **`(none yet)`** — extensibility hook; future flags belong here.

### Examples

Currency-aware price:

```jsonc
{
  "name": "Price",
  "valueType": "number",
  "format": "currency",
  "valueMeta": {
    "currency": {
      "valueType": "entityRef",
      "allowedTypes": ["brainstorm/Currency/v1"],
      "required": true
    },
    "courseToUSD": {
      "valueType": "number",
      "snapshot": true
    }
  }
}
```

Stored value: `{ value: 123, currency: "ent_currency_eur", courseToUSD: 1.07 }`.

Measurement with unit:

```jsonc
{
  "name": "Weight",
  "valueType": "number",
  "valueMeta": {
    "unit": {
      "valueType": "text",
      "vocabulary": "ent_vocab_mass_units",
      "required": true
    }
  }
}
```

AI-extracted citation:

```jsonc
{
  "name": "Quote",
  "valueType": "text",
  "valueMeta": {
    "sourceUrl":   { "valueType": "text", "format": "url" },
    "confidence":  { "valueType": "number" },
    "extractedAt": { "valueType": "date", "snapshot": true }
  }
}
```

### Storage shape

> **Decision:** storage shape follows the schema, not the data:
> - `count.max == 1` AND `valueMeta` absent → **bare scalar** in `Y.Map`.
> - `count.max == 1` AND `valueMeta` present → **single envelope** `{ value, ...meta }` in `Y.Map`.
> - `count.max > 1` → **`Y.Array<envelope>`**, where each envelope is `{ value, label?, ...meta }`. The existing `label` meta-field is a pre-existing case of this rule (a `label` was always meta avant la lettre).

Migration: declaring `valueMeta` on a previously-bare property promotes existing values to envelopes via a one-shot rewrite (`{ value: <existing>, /* meta empty until set */ }`). Removing `valueMeta` *demotes* envelopes back to bare values; meta data is preserved under a `(removed meta)` key on each entity (parallel to the "(removed property)" behavior in §Property mutations §Remove).

### Read API

> **Decision:** the entities service always returns the envelope form on read, regardless of storage. Callers see `{ value, ...meta }` uniformly; the `meta` keys are an empty object when the schema declares no `valueMeta`. This kills the per-call "is this a scalar or an envelope?" branch in app code.

Writers accept either form (bare scalar OR envelope). The entities service normalizes at the write boundary using the PropertySchema's `valueMeta` declaration. A bare write to an envelope-declaring property leaves the meta keys at their previous values (or unset if first write); a partial envelope write merges over existing meta.

### Filter / sort / display interaction

Filters target the envelope's *fields* by path:

```ts
// Filter on the value:                                   $eq: { "price.value": 99.99 }
// Filter on the meta:                                    $eq: { "price.currency": "ent_currency_eur" }
// Filter on the bare-scalar path (no envelope schema):   $eq: { "title": "Meeting" }
```

For schema-typed-as-envelope properties, the bare path (`$eq: { "price": 99 }`) is shorthand for `$eq: { "price.value": 99 }` — the entities service rewrites at compile time. This keeps user-typed filters readable and tolerates schema drift.

> **Decision:** sort by `<property>` (no path) sorts by `<property>.value`. Sorting by a meta field requires the explicit `<property>.<metaName>` path.

> **Open (OQ-LD-15):** when a filter targets a property by the bare path and the schema later adds `valueMeta`, the rewrite "bare → .value" is unambiguous. But if a schema previously had `valueMeta` and the user wrote a filter against `<property>.currency`, then the schema drops `valueMeta`, the filter now references a non-existent path. Tentative: silently treat as `$exists: false` and surface a one-time warning on the filter row; better than failing the whole query. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

> **Open (OQ-LD-16):** display options live on the PropertySchema; do meta fields get their own display options, or share the property's? Tentative: meta fields inherit the property's display by default; per-meta-field display overrides land in v2 when the design-system layout system can express compound rendering.

### Phasing

> **Decision:** value envelopes ship in **v1**. The bare-scalar / `Y.Array<{value,label?}>` story is the v0 baseline; envelopes are the v1 generalisation. Migration of existing data is identity-shaped (no envelopes today → no rewrite needed; new envelope-declaring schemas wrap as they write).

## PropertySchema as a first-class entity

A property definition is itself an entity (`brainstorm/PropertySchema/v2`). It is synced, encrypted, and shared like any other entity — meaning a property added on one of your devices propagates to the others.

```jsonc
{
  "id": "ent_prop_phones_for_people",
  "type": "brainstorm/PropertySchema/v2",
  "properties": {
    "name": "Phone",
    "scope": { "kind": "type", "target": "io.example/Person/v1" },

    // composable property body
    "valueType": "text",
    "count": { "min": 0, "max": 5 },
    "labels": ["Mobile", "Home", "Work", "Other"],
    "format": "phone",

    "display": {
      "label": "Phone",
      "icon": "phone",
      "order": 40,
      "view": "list",
      "options": { "format": "international" }
    }
  }
}
```

The "constructor-like editor" the user mentioned is the UI for building this entity: pick a base type, configure modifiers, set display, choose scope. The schema is the data; the editor is the UI on top.

## Layered scopes

The scope mechanism from the previous design is preserved. A PropertySchema's effective domain is the set of entities it applies to; scope is an explicit attribute:

```ts
type Scope =
  | { kind: "entity"; target: string }              // applies to one entity
  | { kind: "type"; target: string }                // applies to all entities of type URL X
  | { kind: "collection"; target: string }          // applies to entities in collection C
  | { kind: "user"; target: string }                // applies to all entities owned by user U
  | { kind: "org"; target: string };                // applies to all entities in org O
```

> **Decision (OQ-DM-1 — see [21-objects-and-collections.md](21-objects-and-collections.md)):** `scope: { kind: "collection", target }` **is** the "adding an object to a collection makes it inherit that collection's properties" mechanism. A Collection unifies with `brainstorm/List/v1` (source + `members` + views, product-wide — not database-app-internal); a schema-bearing Collection owns a set of `collection`-scoped PropertySchema entities. Membership is M:N and authoritative on the Collection (per [30-file-manager-and-folders.md](../apps/30-file-manager-and-folders.md): the object doesn't know its collections; reverse lookup via the `links`/`members` index). An object's effective schema is its single Block-Protocol type's canonical schema ∪ every member collection's overlay, composed by the entities service exactly as below — multi-typing needs **no** second `entityType`.

- Default scope when adding a property: `type` (matches the page-database mental model).
- Promotion to broader scope (`type` → `user` → `org`) is a user-initiated, surfaced action.
- "Just this entity" is a one-click affordance from the property creation dialog.

| Scope        | Use case                                            |
|--------------|-----------------------------------------------------|
| `entity`     | "Just this one note has this special property."     |
| `type`       | "All entities of type Note get a Status property." (page-database default) |
| `collection` | "Entities in this Project get a Priority property." |
| `user`       | "Across all my entities of any type, I track an Author." |
| `org`        | "Every entity in this org has a CostCenter." (v2)   |

## Reading effective schemas

When app A loads entity E:

1. Look up E's BP entity-type T → fetch the canonical type-schema (cached locally).
2. Find all PropertySchema entities whose scope matches E (entity / type / collection / user / org).
3. For each entityRef PropertySchema with `inverse: true`, materialize the virtual inverse on the target type.
4. Compose: canonical type schema + matching overlays + materialized inverses.
5. Resolve display options.
6. Return the **effective schema**: list of `(property name, value type, modifiers, source layer, display)`.

> **Decision:** schema composition happens in the entities service (shell side). Apps see the already-composed effective schema with each property tagged by its source layer. Apps never reimplement layering.

### Conflict resolution

Two layers add a property with the same `name`:

> **Decision:** the **more specific** layer wins, with explicit precedence:
> 1. `entity` (most specific)
> 2. `collection`
> 3. `type`
> 4. `user`
> 5. `org`
> 6. canonical BP type schema (least specific)
>
> A layer **cannot change the value type** of a property defined in a more-specific parent. Display refinements (label, icon, view, options) are allowed — see OQ-39.

## Storage representation

Inside an entity's Y.Doc:

```
root: Y.Map
├── "type": "io.example/Person/v1"
├── "properties": Y.Map
│   ├── "title":  Y.Text                                    // canonical, single, richText
│   ├── "phones": Y.Array<{value, label?}>                  // overlay (type-scoped, multi)
│   ├── "Status": "doing"                                   // overlay (type-scoped, single, vocab)
│   └── "Tags":   Y.Array<{value}>                          // overlay (user-scoped, multi)
└── "links":  Y.Array<linkRecord>                           // entityRef-property links
```

The Y.Doc stores **values keyed by name**. Whether a property comes from BP's canonical schema or an overlay is **not** marked in the Y.Doc — that meaning lives in the PropertySchema entities. Schema is data, decoupled from storage shape.

> **Decision:** values are typed at write time according to the effective schema. Writing a string to a `number` property fails. The entities service mediates writes.

> **Decision:** when `count.max > 1`, storage is always a `Y.Array` of `{ value, label? }` objects regardless of how many values are present at any moment. When `count.max == 1`, storage is a bare value in the `Y.Map`. The shape follows the schema's *capability*, not the current value count.

## Property mutations

### Add

1. User clicks "+ Property" on an entity, in a database column header, or on a type's schema page.
2. Constructor-like editor: pick base type, configure modifiers, set scope (default `type`), set display.
3. Shell creates a PropertySchema entity with the chosen scope.
4. Effective schemas including this entity now include the new property.
5. Existing entities of the same type / collection / etc. immediately show the property — empty value.

### Edit

- **Display hints** — free.
- **Vocabulary changes** — adding values: free. Removing values: warn if any entity uses them; offer "migrate to…".
- **Modifier changes** — most are free (e.g. add a label set, increase multiplicity). Some require migration:
  - `count.max` decrease that drops below current value counts: requires picking which values to keep per entity.
  - `count.min` increase above zero: warns for entities currently below the new minimum.
  - Changing `format` for `text`: data preserved; validation re-applies (existing values not retroactively validated).
  - Changing `vocabulary`: existing values stay if still valid in new vocab; otherwise flagged.
- **`valueType` change** — rejected. Create a new property and migrate explicitly.

### Remove

> **Decision:** removing a PropertySchema does **not** delete property values from existing entities. Values stay as orphan data; UI shows them under "(removed property)". Re-creating a property with the same name reattaches automatically.

### Promote scope

Scope changes upward (more general): `entity` → `type` → `user`. Property applies to more entities; existing values preserved.
Demote (more specific): possible with confirmation; some values become out of scope.

> **Decision:** scope changes are explicit; never side effects.

## Querying

Queries (per [18-storage-and-search.md](18-storage-and-search.md)) reference properties by name within an entity-type context:

```ts
entities.query({
  type: "io.example/Person/v1",
  where: {
    $eq: { "phones.label": "Mobile" }              // querying labeled multi-value
  },
  orderBy: [{ property: "createdAt", direction: "desc" }]
})
```

Multi-value properties support both "any value matches" (`$contains`) and label-aware predicates (`property.label = X`). Inverse properties query through the links table without special syntax.

For derived properties (when v2 ships), queries include them by name; the entities service uses cached values when available, recomputes when stale.

## Phasing

> **Decision:** v1 ships entity / type / user scopes; the six base value types; modifiers `count`, `labels`, `vocabulary`, `format`, `pattern`, `range`, `precision`, `granularity`, `allowedTypes`, `entityFilter`, `unique`; display options. The canonical `brainstorm/File/v1` entity type ships with v1. **v2** adds collection scope (after the collection model is finalized), org scope (with the org model), inverse properties, derived properties, and richer vocabulary management.

| Capability                               | v1   | v2  |
|------------------------------------------|------|-----|
| Canonical BP type schemas                | ✓    | ✓   |
| Entity / type / user scopes              | ✓    | ✓   |
| Collection scope                         | post-collection-design | ✓ |
| Org scope                                | —    | ✓   |
| Composable value types + modifiers       | ✓    | ✓   |
| Inline + shared vocabularies             | ✓    | ✓   |
| Display options                          | ✓    | ✓   |
| Inverse properties                       | —    | ✓   |
| Derived (computed) properties / formulas | —    | ✓   |
| Property migration tooling (full)        | minimal | ✓ |

## Open questions surfaced by this doc

- **OQ-38** — Collection scope in v1?
- **OQ-39** — Conflict-resolution strictness (display-only renames in higher layers).
- **OQ-40** — Derived property timing and expression-language choice.
- **OQ-41** — Vocabulary promotion suggestions UX.
- **OQ-42** — Property migration tooling for v1 (rename, vocab edit, multiplicity flip).
- **OQ-48** — Label uniqueness in multi-value properties (default: not enforced).
- **OQ-49** — Display options ↔ fancy-menus row-kind mapping.
- **OQ-50** — Derived-property expression language: JsonLogic? CEL? Custom DSL? — chosen with v2 design.
- **OQ-51** — Inverse cardinality conflicts: prompt UX vs. silent fixup vs. fail.

## Summary

- A property is **a base value type plus modifiers**. Six base types (`text`, `number`, `boolean`, `date`, `entityRef`, `richText`); modifiers cover cardinality, labels, vocabulary, format, validation, constraints, display, computed.
- **Files are entities**, not a value type. The canonical `brainstorm/File/v1` entity type wraps blob references; "file properties" are `entityRef` properties with `allowedTypes: ["brainstorm/File/v1"]` and file-aware display modifiers (gallery / viewer / thumbnail).
- **Cardinality is universal** via the `count: {min, max}` modifier (hard cap `max ≤ 50`). Replaces both `required` (= `count.min ≥ 1`) and a boolean multi flag (= `count.max > 1`).
- **Phone, email, URL** are not separate types — they are `text` with `format` modifiers.
- **Vocabularies** are first-class entities; "select" = `text` + `vocabulary` + `count.max == 1`; "multi-select" = same with `count.max > 1`. Promotable from inline to shared.
- **Inverse properties** are computed views from the links table — declared on the primary entityRef, materialized on the target type, writable from either side.
- **Derived properties** (formulas) are v2; sandboxed expression language; cached.
- **Display options** are property-level (gallery / list / viewer for files; chip / card / list for entityRefs; etc.).
- **PropertySchema is itself an entity** with explicit scope (`entity` / `type` / `collection` / `user` / `org`). Default scope when creating: `type`.
- **Effective schema = canonical BP type schema ∪ matching overlays ∪ materialized inverses**, composed by the entities service. More-specific layers win on name conflicts.
- The Y.Doc stores values keyed by name; meaning lives in PropertySchema entities. Schema is data.
