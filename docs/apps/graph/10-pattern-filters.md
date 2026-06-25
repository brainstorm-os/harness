# Graph — pattern filters

This is the doc that captures **the differentiator**: filters that aren't a single list of predicates over rows, but a **pattern of subjects connected by edges**, where each subject has its own predicates and each edge has its own typed constraint. Prior tools typically expose flat graph filters ("which entity types do I want visible"); the Database app's filters are nested AND/OR per [database/30-filters-sorts.md](../database/30-filters-sorts.md) but still apply uniformly to *one set of rows*. The Graph app's filter is qualitatively richer because the data is a graph, not a table.

The canonical example from the user's brief:

> Select all *Persons* that are connected to each other via *School* and that are connected to *City* = "Berlin".

That can't be written as a flat predicate. It's a pattern with four subjects (`$A: Person`, `$B: Person`, `$S: School`, `$C: City`) and four edges. The pattern compiler in the entities service turns it into a SQL recursive-join plan that returns the entities and links that satisfy a valid binding.

## The shape

```ts
export enum SubjectKind {
  // A set of entities matching a (type + predicate) constraint.
  Entity = "entity",
}

export type Subject = {
  kind: SubjectKind.Entity;
  // Constraint over types: an entity is a candidate if its type URL is in this set.
  // Empty array = "any type"; the renderer surfaces a warning because that's expensive.
  types: string[];
  // PropertyPredicate (mirror of database/30-filters-sorts.md). null = no property
  // constraint; nodes matched only by type.
  where: PropertyPredicate | null;
  // Display-only: subject name surfaced in the renderer (above the subject's nodes).
  // The pattern uses the *key* in the subjects map as the binding name, not this.
  displayName: string;
  color: string | null;       // explicit node tint; null = inherit from settings.coloring
  icon: Icon | null;          // overrides per-node icons in this subject
  // Hard limit on the number of nodes this subject can contribute. Default 5000.
  // Useful for "show me up to 20 Persons" kinds of slicing.
  limit: number | null;
};
```

```ts
export enum EdgeMatch {
  // The edge must exist in the user's vault (i.e. there's a row in `links`).
  Required = "required",
  // The edge may exist; bindings without it are still emitted but the edge is
  // omitted from the rendered set.
  Optional = "optional",
  // The edge must NOT exist; bindings where it does are excluded.
  Forbidden = "forbidden",
}

export enum EdgeDirection {
  Out  = "out",   // from → to as declared
  In   = "in",   // from → to in the schema, but the link is dest→source in storage
  Both = "both",
}

export type EdgeConstraint = {
  // Two keys into the pattern's `subjects` map.
  from: string;
  to: string;
  // One or more link-type URLs. Empty array = "any link type" (expensive).
  linkTypes: string[];
  direction: EdgeDirection;
  match: EdgeMatch;
  // Optional: traverse 1..N hops of the same link type instead of exactly one.
  // [1,1] (default) is a single hop; [1, 3] is "between 1 and 3 hops"; [0, 0] is
  // an identity edge (the subjects must bind to the same entity).
  hops: [number, number];
};
```

```ts
export type GraphPattern = {
  // Named subjects. Key = binding name used in EdgeConstraint.from/to.
  // Examples: { A: ..., B: ..., S: ..., City: ... }
  subjects: Record<string, Subject>;
  // Edge constraints between subjects. Order doesn't matter (the compiler reorders
  // for the best join plan); duplicates are folded.
  edges: EdgeConstraint[];
  // Which subject "owns" the rendered group label in the UI. Defaults to the first
  // subject by insertion order. Purely cosmetic.
  primarySubject: string;
};
```

## The canonical example, encoded

> Persons (`$A`, `$B`) who studied at the same `School` and both live in `City="Berlin"`.

```ts
const pattern: GraphPattern = {
  subjects: {
    A:    { kind: SubjectKind.Entity, types: ["io.example/Person/v1"], where: null,
            displayName: "Person A", color: null, icon: null, limit: null },
    B:    { kind: SubjectKind.Entity, types: ["io.example/Person/v1"], where: null,
            displayName: "Person B", color: null, icon: null, limit: null },
    S:    { kind: SubjectKind.Entity, types: ["io.example/School/v1"], where: null,
            displayName: "Shared school", color: null, icon: null, limit: null },
    City: { kind: SubjectKind.Entity, types: ["io.example/City/v1"],
            where: { $eq: { name: "Berlin" } },
            displayName: "Berlin", color: null, icon: null, limit: 1 },
  },
  edges: [
    { from: "A", to: "S",    linkTypes: ["io.example/StudiedAt/v1"],
      direction: EdgeDirection.Out, match: EdgeMatch.Required, hops: [1, 1] },
    { from: "B", to: "S",    linkTypes: ["io.example/StudiedAt/v1"],
      direction: EdgeDirection.Out, match: EdgeMatch.Required, hops: [1, 1] },
    { from: "A", to: "City", linkTypes: ["io.example/LivesIn/v1"],
      direction: EdgeDirection.Out, match: EdgeMatch.Required, hops: [1, 1] },
    { from: "B", to: "City", linkTypes: ["io.example/LivesIn/v1"],
      direction: EdgeDirection.Out, match: EdgeMatch.Required, hops: [1, 1] },
  ],
  primarySubject: "A",
};
```

The renderer shows:

- Every `Person` that satisfies binding to `$A` *or* `$B` (in practice, the same set — both subjects share the same constraint).
- The shared `School` nodes that bound `$S`.
- The single `City` node = Berlin.
- The four typed edges that wired them together.

A `Person` who studied at a Berlin school but lives in Munich is *not* shown — they don't satisfy the `LivesIn → Berlin` edge.

## UI

The filter is built in a panel (left rail of the Graph app window) with two sections: **Subjects** and **Connections**.

```
┌ Subjects ─────────────────────────────────────────┐
│                                                     │
│  ▣ $A   Person                       [edit] [✕]   │
│  ▣ $B   Person                       [edit] [✕]   │
│  ▣ $S   School                       [edit] [✕]   │
│  ▣ $City  City   name = "Berlin"     [edit] [✕]   │
│                                                     │
│  [+ Add subject]                                    │
└────────────────────────────────────────────────────┘

┌ Connections ──────────────────────────────────────┐
│                                                     │
│  $A —[ StudiedAt ▸ ]→ $S          required   ✕    │
│  $B —[ StudiedAt ▸ ]→ $S          required   ✕    │
│  $A —[ LivesIn   ▸ ]→ $City       required   ✕    │
│  $B —[ LivesIn   ▸ ]→ $City       required   ✕    │
│                                                     │
│  [+ Add connection]                                 │
└────────────────────────────────────────────────────┘
```

Clicking `[edit]` on a subject opens the same predicate-builder component as the Database app's filter (per [database/30-filters-sorts.md §Filter UI](../database/30-filters-sorts.md)). Reusing it is non-negotiable — per the [DRY rule in CLAUDE.md](../../../CLAUDE.md#conventions-that-bite), the predicate UI has exactly one implementation in the codebase.

Adding a connection opens a fancy-menus popover with three lanes: **From** (a subject picker), **Link type** (filtered to types whose source-type matches `From.types` and dest-type matches `To.types`), **To** (subject picker, defaults to "+ new subject"). The popover sets `direction = Out`, `match = Required`, `hops = [1,1]` by default; an "Advanced" toggle reveals the rest.

### Visual aid: the pattern shape preview

To the right of the Connections list, a small static SVG renders the pattern as a tiny node-link diagram (one circle per subject, one stroke per edge constraint). It's not the live graph — it's the *schema* of the filter. As subjects and connections change, this preview snaps to the new shape. The preview is also the entry point for some operations:

- Drag a subject in the preview onto another subject → adds an edge between them.
- Right-click an edge → opens the Connection editor.
- Right-click a subject → opens the Subject editor.

The preview cap is 16 subjects + 32 edges, matching the per-pattern caps in [01-data-model.md §Hard caps](01-data-model.md#hard-caps). Larger patterns just disable the preview pane and show the list-only UI.

### Pattern templates

The "Saved patterns" dropdown above the Subjects list lets a user save the current pattern as a template (a separate `brainstorm/GraphPatternTemplate/v1` entity — *open question* whether this is a separate entity type or a fork of the parent Graph; tentative: fork on save, no separate type). Templates are listed in the dropdown with their saved name; loading one replaces the current pattern.

Seeded templates ship with the app:

- *"Everything"* — one subject `Any: types=[]`, no edges. The default.
- *"Notes + Tags"* — `Note` subject, `Tag` subject, one connection.
- *"My Network"* — `Person A`, `Person B`, edge `linkType: any` between them; useful for personal-CRM-style vaults.

The full design of seeded templates lives in the Stage 9.13.* iterations — they're not in this doc because the user-base-derived "common patterns" are best curated after the app is in users' hands.

## Compilation

The entities service compiles a `GraphPattern` to a SQL plan against `entities.db` + `links`. The plan is a *deterministic, single-pass* SELECT — no recursion in v1 unless `hops[1] > 1`.

### Single-hop pattern (most common)

For a pattern with `n` subjects and `m` required edges where all `hops = [1,1]`:

```sql
-- For the example above (Persons sharing a Berlin school):
SELECT
  A.id     AS A_id,    A.type    AS A_type,    A.properties AS A_props,
  B.id     AS B_id,    B.type    AS B_type,    B.properties AS B_props,
  S.id     AS S_id,    S.type    AS S_type,    S.properties AS S_props,
  City.id  AS City_id, City.type AS City_type, City.properties AS City_props,
  L_AS.id  AS edge_AS, L_BS.id  AS edge_BS,
  L_AC.id  AS edge_AC, L_BC.id  AS edge_BC
FROM entities  A
JOIN entities  B    ON B.type    = 'io.example/Person/v1' AND B.id   != A.id
JOIN entities  S    ON S.type    = 'io.example/School/v1'
JOIN entities  City ON City.type = 'io.example/City/v1'
                     AND json_extract(City.properties, '$.name') = 'Berlin'
JOIN links L_AS ON L_AS.source_entity_id = A.id    AND L_AS.dest_entity_id = S.id
                AND L_AS.link_type = 'io.example/StudiedAt/v1' AND L_AS.deleted_at IS NULL
JOIN links L_BS ON L_BS.source_entity_id = B.id    AND L_BS.dest_entity_id = S.id
                AND L_BS.link_type = 'io.example/StudiedAt/v1' AND L_BS.deleted_at IS NULL
JOIN links L_AC ON L_AC.source_entity_id = A.id    AND L_AC.dest_entity_id = City.id
                AND L_AC.link_type = 'io.example/LivesIn/v1'   AND L_AC.deleted_at IS NULL
JOIN links L_BC ON L_BC.source_entity_id = B.id    AND L_BC.dest_entity_id = City.id
                AND L_BC.link_type = 'io.example/LivesIn/v1'   AND L_BC.deleted_at IS NULL
WHERE A.type = 'io.example/Person/v1' AND A.deleted_at IS NULL
  AND B.deleted_at IS NULL AND S.deleted_at IS NULL AND City.deleted_at IS NULL;
```

Each row of the result is one *binding*. The compiler de-duplicates: the visible node set is `UNION(rows.A_id, rows.B_id, rows.S_id, rows.City_id)`; the visible edge set is `UNION(rows.edge_AS, rows.edge_BS, rows.edge_AC, rows.edge_BC)`. Two rows that contribute the same node merge into one rendered node (with both bindings noted).

> **Decision:** in v1, two `Person` subjects in the same pattern are allowed to bind to the **same** entity — for the canonical example, that means a Person who is "both A and B" (i.e. studied at their own school and lives in Berlin) shows up once. If users want strictly different bindings (`A.id != B.id`), they tick "**Distinct subjects**" in the pattern editor; this adds `A.id != B.id` to the SQL. Default: distinct, because the canonical example expects it.

### Multi-hop edges

When an edge constraint declares `hops = [a, b]` with `b > 1`, the compiler emits a *recursive CTE*:

```sql
WITH RECURSIVE reach AS (
  SELECT source_entity_id AS start, dest_entity_id AS curr, 1 AS hop
  FROM links
  WHERE link_type = :lt AND deleted_at IS NULL
  UNION ALL
  SELECT r.start, l.dest_entity_id, r.hop + 1
  FROM reach r
  JOIN links l ON l.source_entity_id = r.curr AND l.link_type = :lt AND l.deleted_at IS NULL
  WHERE r.hop < :max
)
SELECT ... FROM ... JOIN reach r ON ... WHERE r.hop BETWEEN :min AND :max
```

Recursive CTEs are *expensive*. The compiler caps recursion at `hops[1] = 6` regardless of user input; deeper is a banner "narrow the source first." This is enforced both at write time (the entity validator clamps `hops[1]` to ≤6) and at compile time (defensive).

### Forbidden edges

`EdgeMatch.Forbidden` compiles to a `NOT EXISTS` subquery. Cheap; no special handling.

### Optional edges

`EdgeMatch.Optional` compiles to a `LEFT JOIN` and the edge is included in the result only when the join succeeds. The bound subjects are part of the visible node set whether or not the optional edge bound; the edge itself is only drawn when it bound.

### Cost limits

Before running the plan, the compiler runs `EXPLAIN QUERY PLAN` and computes a rough cost (sum of estimated row counts on each join). If the cost exceeds `GRAPH_PATTERN_COST_CEIL` (env-configurable; default 2,000,000 estimated rows), the compiler returns a structured error `PatternTooExpensive` that the renderer surfaces as a banner with a "Narrow the source" call-to-action. The cost ceiling is one of the things the audit-log records (per [security/09 §Logging and audit](../../security/09-security-and-sandbox.md)) so we can tune it on real data.

## Live updates

The pattern is subscribed; the renderer doesn't re-issue the query when data changes. The entities service emits incremental updates over the subscription:

- A new entity is created that satisfies one of the subjects → the service tests the entity against the per-subject predicates and emits `node-added` if it matches any subject (and the binding is still valid given the existing pattern).
- A new link is created that satisfies an edge constraint → the service tests the link and emits `edge-added` (and if the link enables new bindings, the corresponding `node-added` events for the newly-included nodes).
- An entity property is updated such that a subject predicate flips → `node-updated` or `node-removed`.
- An entity or link is soft-deleted → `node-removed` / `edge-removed`.

The wire shape mirrors [`entities.subscribe` updates](../../data/18-storage-and-search.md) but adds a `subject` tag (which subject this node bound to) and an `edgeConstraint` tag (which edge constraint this edge satisfies). The Graph app uses these to keep subject-tinted styling correct after live updates.

## What this is NOT

- **Not Cypher.** No path variables, no aggregation in patterns, no `WHERE` clauses that reference cross-subject properties. The Graph app's pattern is a strict subset of what's expressible in property-graph query languages — and that's a feature, not a bug. The UI maps 1:1 to the language; a power-user-only "advanced query" mode that exposes more is a v2 question.
- **Not a saved query language.** Patterns aren't text; they're structured entities in the vault. The user edits the pattern through the UI; the rendered SQL is internal to the entities service.
- **Not a write surface.** A pattern selects what's *shown*, not what's *written*. Creating a new node in the Graph app goes through the Database-app-style create flow described in [database/40-create-flow.md](../database/40-create-flow.md) (subject-inherited type, plus the pattern's required edges, are pre-filled — see [50-embedding-and-intents.md §Create flow](50-embedding-and-intents.md#create-flow)).

## What this enables

A pattern is *more expressive* than a flat filter list in two crucial ways:

1. **Two-subject coreference.** "Two Persons who share a thing" is impossible with a single-subject filter. A pattern handles it.
2. **Property predicates per subject role.** "A Person *connected to* a Berlin-based Company" lets the *Company* carry the `city = Berlin` predicate while the *Person* has no city constraint. A flat filter list can only say "city = Berlin" *somewhere*, with no way to scope.

This is the heart of why the Graph app is a separate first-party app from the Database app: the *queries the user wants to ask* are graph-shaped, not row-shaped. Row-shaped products hit a wall here. Brainstorm's substrate is graph-shaped, so the Graph app speaks graph.

## Summary

- A pattern is a `Record<string, Subject>` + `EdgeConstraint[]` — named subject sets connected by typed edges.
- Subjects reuse the `PropertyPredicate` language from the Database app; edges add a typed-link layer on top.
- Optional / Required / Forbidden edge match, In/Out/Both directions, 1..N hops.
- Compiles to a single SQL JOIN (or recursive CTE for multi-hop) against `entities.db` + `links`.
- Live updates over a subscription; the renderer never re-runs the query.
- 16 subjects, 32 edges, 6-hop max — caps enforced at write time and at compile time.
- The two-Person-sharing-a-school example is the canonical demo; the UI surfaces a static SVG preview of the pattern shape alongside the list editor.
