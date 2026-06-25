# Graph — history animation

This is the temporal-playback feature the user explicitly asked for. Prior tools that tried to ship something similar couldn't make it useful because their data model didn't track link creation time on the edge — they could animate nodes appearing, but not the moment two nodes *got connected*. Brainstorm's `links` table already carries `created_at` and `deleted_at` (per [data/18-storage-and-search.md §Schema](../../data/18-storage-and-search.md)), so we get edge-accurate playback for free. This doc specifies the playback model, the scrubber UI, the persistence, and the performance budget.

## What the animation shows

A history-animated graph plays the **order in which entities and links were created** in the visible subset of the vault. Scrubbing the timeline:

- Pulls the *cutoff* — a single moment-in-time `t`.
- Hides everything whose `created_at > t`.
- Hides everything whose `deleted_at` is non-null and `deleted_at ≤ t`.
- Easing (per `HistoryReveal`) softens the binary appear/disappear into a 24-hour fade window.

The user sees their vault **grow**: first the seed Notes, then the first Tag, then the first Person, then connections, then bursts of activity around projects, then the present.

The conventional graph-timeline UI shape — a play/pause button, a 1x/2x/4x speed toggle, a draggable seek bar, a date label with `NumberFlow`-animated digits — is the right starting form (per [00-overview.md §Prior-art cross-reference](00-overview.md#prior-art-cross-reference)). The difference is what the timeline *reveals* — prior tools reveal nodes; we reveal nodes *and* edges.

## Persistence

The state of the scrubber lives on the `GraphView/v1` entity (per [01-data-model.md §HistoryAnimationState](01-data-model.md#historyanimationstate)):

```ts
export type HistoryAnimationState = {
  enabled: boolean;
  startAt: number | null;   // ms epoch, null = earliest event in pattern
  endAt:   number | null;   // ms epoch, null = "now" (re-evaluated on each open)
  cutoffAt: number | null;  // playhead; null = at endAt
  speed: number;            // 1/2/4/8/16
  reveal: HistoryReveal;
};
```

Persisting the cutoff is the difference between a one-shot novelty and a real tool. The user can pause mid-playback, close the window, come back tomorrow, and the playback resumes exactly where it stopped. Screen-recording a vault's history becomes a real workflow.

## Computing the timeline range

When the user enables the animation, the renderer:

1. Subscribes to the pattern (per [10-pattern-filters.md §Live updates](10-pattern-filters.md#live-updates)).
2. Asks the entities service for `history.bounds(patternId)`, which returns `{minCreatedAt, maxCreatedAt}` across the visible nodes and edges. This is a single SQL `MIN(created_at), MAX(created_at)` over the pattern's WHERE clause — cheap.
3. Sets `startAt` and `endAt` defaults to those bounds.

The user can override:
- Drag the left handle of the scrubber → moves `startAt`. Everything before is hidden; the available timeline shrinks.
- Drag the right handle → moves `endAt`. Same on the other side.
- Click a date label to set `startAt` / `endAt` directly via a date picker.

## The scrubber UI

Roughly the conventional shape, extended:

```
┌ History ─────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  ▶  1x  [——●———————————————————————————————]   2025-03-14    1,245 / 8,930   │
│                                                                                │
│  [⏮ Earliest] [Today] [Now]                                Reveal: [Eased ▾]  │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **▶/⏸** — play/pause. While playing, advances the cutoff at the base rate of *1 day per second* multiplied by the speed.
- **1x / 2x / 4x / 8x / 16x** — speed cycler (click cycles forward; shift-click cycles back).
- **Scrubber bar** — full timeline span; the playhead is a thumb the user drags. Tick marks at every month boundary. A faint histogram behind the bar shows the *event density* (count of `created_at` ms in each daily bucket); the user can see "burst weeks" at a glance.
- **Date label** — the current cutoff, with `NumberFlow`-animated digits. Click the date to open a date-picker that jumps to that day.
- **Count label** — "events shown / total events." The user sees what fraction of the vault is currently in view.
- **⏮ Earliest** — jump cutoff to `startAt`.
- **Today** — jump cutoff to start-of-today.
- **Now** — jump cutoff to `endAt` (effectively "show everything").
- **Reveal** — `Strict` / `Eased` / `Recent`. Defaults to `Eased`. See below.

The scrubber lives in a docked panel at the bottom of the Graph app window when `history.enabled` is true. The panel collapses to a single thin strip when not the focus.

### Keyboard control

Per the [keyboard rule](../../foundations/35-code-conventions.md#keyboard-handling), all of the following land as named chords:

- `Space` → play / pause (`graph/history.toggle-play`)
- `[` / `]` → step backward / forward by 1 day (`graph/history.step-back` / `graph/history.step-forward`)
- `Shift+[` / `Shift+]` → step by 1 week
- `Home` → jump to `startAt`
- `End` → jump to `endAt`
- `+` / `-` → cycle speed up / down

These are user-rebindable through the cheatsheet (per [shell/24-keyboard-shortcuts.md](../../shell/24-keyboard-shortcuts.md)).

## Reveal modes

```ts
export enum HistoryReveal {
  Strict = "strict",   // binary: t < created → invisible; t ≥ created → visible.
  Eased  = "eased",    // strict + 24h fade-in around the cutoff for context.
  Recent = "recent",   // only the last N hours; older entities fade to background.
}
```

### `Strict`

Pure cutoff. Entities pop into existence on their `created_at` day. Useful for *counting* — "by 2024-Q3 we had 312 entities." Visually staccato.

### `Eased` (default)

The cutoff has a 24-hour soft window: entities created within `[cutoff - 24h, cutoff + 24h]` interpolate alpha from 0 to 1 across the window. The visual effect is a "front line" of recently-appeared entities at the cutoff, with older entities solid behind.

### `Recent`

Inverse of `Eased`. The last 72 hours of activity are full opacity; everything older is at 0.2 alpha and grey. Useful for "what's happening *lately*" instead of "how did we get here."

## The append-event stream

The renderer doesn't poll. The entities service exposes one new query shape — `history.events(patternId, since)` — that returns an event stream:

```ts
type HistoryEvent =
  | { kind: "node.created", entityId: string, at: number, type: string }
  | { kind: "node.deleted", entityId: string, at: number }
  | { kind: "node.updated", entityId: string, at: number }     // for `Recent` mode emphasis
  | { kind: "edge.created", linkId:   string, at: number, linkType: string, source: string, dest: string }
  | { kind: "edge.deleted", linkId:   string, at: number };
```

Events come in `created_at`-ascending order. The renderer buffers them and applies them as the playhead advances. Buffering keeps the per-frame work proportional to the number of *new* events in that frame, not the total node count — so playback at 16x speed across a vault with 100k entities stays at 60fps as long as the per-frame delta is bounded.

### Live-tail behavior

When `endAt = null` ("now"), the subscription stays open and new events created *during playback* are streamed in. If the cutoff is at `endAt = "now"` (i.e. the playhead is at the right edge), new events appear immediately; if the cutoff is behind, they're queued and appear when the playhead reaches their time.

### Time bucketing

To keep the per-frame cost bounded, events are bucketed into 1-day buckets server-side (the entities service does this in SQL with `strftime('%Y-%m-%d', created_at / 1000, 'unixepoch')` and emits each day as one stream message). At 16x speed = 16 days/s = 60fps means roughly 0.27 day-buckets per frame, well within budget. At 1x speed = 1 day/s, the per-frame work is essentially zero except on burst-days.

## Playback algorithm (renderer side)

```ts
function tick(dt: number): void {
  if (!isPlaying) return;
  const newCutoff = cutoff + dt * MS_PER_DAY * speed;
  for (const ev of eventsBetween(cutoff, newCutoff)) {
    apply(ev);  // mark node/edge as visible or hidden
  }
  cutoff = newCutoff;
  if (cutoff >= endAt) { stop(); }
  publishCutoff(cutoff);
}

function apply(ev: HistoryEvent): void {
  switch (ev.kind) {
    case "node.created": nodes.get(ev.entityId).visibleAt = ev.at; break;
    case "node.deleted": nodes.get(ev.entityId).hiddenAt  = ev.at; break;
    case "edge.created": edges.get(ev.linkId).visibleAt   = ev.at; break;
    case "edge.deleted": edges.get(ev.linkId).hiddenAt    = ev.at; break;
    case "node.updated": nodes.get(ev.entityId).activityAt = ev.at; break;  // for Recent emphasis
  }
}
```

The renderer's per-frame `draw()` evaluates per-node and per-edge whether they're visible at the current cutoff (using the apply'd timestamps) and, per the `reveal` mode, computes an alpha. The compute is `O(visible-nodes)` per frame, well-bounded by the pattern's hard cap.

### Seek (jump)

When the user drags the scrubber thumb, the renderer:

1. Sets `cutoff = newCutoff` immediately.
2. Recomputes `apply` for *all* events with `created_at ≤ cutoff` (and `deleted_at ≤ cutoff`).
3. Re-renders one frame.

The recompute is `O(events-up-to-cutoff)`, bounded by total event count. At 100k events that's ~10ms even on a slow laptop — well within the 50ms seek budget per [00-overview.md §Performance budgets](00-overview.md#performance-budgets).

## Edge cases

### Entity created before its first incoming link

The entity appears on its own `created_at`. The link appears on its `created_at`, regardless of whether the destination entity is already visible. If the destination isn't visible yet (rare but possible if the entity was created *after* the link's creation time, which can happen on imports), the edge is buffered and rendered only once both endpoints are visible. This matches the visual intuition.

### Multiple events on the same day

Sub-day ordering is by `created_at` millisecond precision. The histogram in the scrubber bar bins by day, but the playback respects the millisecond order within a day for smooth animation.

### Soft-deleted entities

Soft-deletes (`entities.deleted_at IS NOT NULL`) become `node.deleted` events in the stream. When the playhead crosses the deletion, the node visibly disappears (its alpha animates to 0 over the reveal window). If the user scrubs backward past the deletion, the node re-appears.

### Backfilled `created_at` per OQ-GR-3

For legacy data without reliable `created_at`, the backfill rule from [01-data-model.md §Backfill](01-data-model.md#backfill-for-entities-created-before-timestamp-tracking) applies before the history stream is queried. The backfill is one-shot per vault on Graph-app first-launch.

## Performance

The history animation respects the same overall budget as the static graph render (per [00-overview.md §Performance budgets](00-overview.md#performance-budgets)):

| Operation                            | Budget                                  |
|--------------------------------------|-----------------------------------------|
| Initial bounds query (`MIN/MAX(created_at)`) | < 100ms                          |
| Initial event stream load (10k events)| < 500ms                                |
| Playback step (one frame at 16x speed) | < 16ms (60fps)                        |
| Seek (jump cutoff)                    | < 50ms                                  |
| Reveal-mode switch (Strict ↔ Eased)   | < 5ms                                   |

The renderer falls back to `Strict` reveal automatically when the visible node count exceeds 10k *and* `Eased` would be too expensive (rare but possible on extreme pattern shapes).

## What this enables

Three concrete uses observed from analogous features in prior tools:

1. **Onboarding storytelling.** "Here's how my vault grew" as a 30-second screen recording. The renderer's persisted `cutoffAt` lets the user pause, screenshot, and resume — useful for visual essays.
2. **Investigative archeology.** "When did I first connect *Person X* and *Topic Y*?" Scrub backward until the edge disappears; the date is on the scrubber.
3. **Productivity reflection.** "What was I working on in 2024-Q3?" `startAt = 2024-07-01`, `endAt = 2024-09-30` constrains the playback to one quarter. Combined with the pattern (`type = Note AND tag = work`), the user sees just that quarter's work topology.

## Summary

- Animate the order in which entities and links were created (and deleted) by scrubbing a cutoff timestamp.
- Conventional scrubber UI shape — play/pause, speed cycler, dragable bar, date label — adopted as the starting form. Brainstorm extends to edge timestamps.
- Persisted `HistoryAnimationState` on the GraphView lets paused playback survive vault reopen.
- Three reveal modes: `Strict` (hard cutoff), `Eased` (24h soft window — default), `Recent` (last-N-hours emphasis).
- Server-side bucketing keeps per-frame work bounded; 60fps playback up to 16x speed on 100k-event vaults.
- Backfill rule for legacy data per OQ-GR-3.
