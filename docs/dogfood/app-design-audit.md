# Per-app design audit — the POLISH-APP rubric

The checklist every `POLISH-APP-*` rung runs (owner directive 2026-08-01: *"design quality is still bad, all apps have elements that look bad and out of our design patterns, we need to polish each app separately"*). One rung = one app = **drain its mechanical baseline + walk this rubric + fix what it surfaces**, with before/after evidence in both themes.

The standing lesson from every prior polish round ([[polish-adjacent-control-heights]], [[standing-mission-stabilise-and-polish]]): a finding that recurs across apps is a **system gap**, not an app bug — the fix is an SDK extraction or a new lint ratchet, and only then the per-app sweep. Each rubric row names the enforcement that exists; where the row says *judgment*, a human (or agent with screenshots) has to look.

## 0. Mechanical gates (run `bun run lint` — must be green, baselines may only shrink)

| Gate | Tool |
| ---- | ---- |
| No phantom CSS tokens | `check-css-tokens.mjs` (zero-baseline) |
| No literal colors / px font-sizes | `check-design-drift.mjs` (ratchet; drain this app's files to zero or `design-ok`-annotate deliberate data-literals with a reason) |
| No hardcoded border-radius | `check-hardcoded-radius.mjs` (zero-baseline) |
| Native controls wear the shared face | `check-control-faces.mjs` (ratchet — drain this app's entries) |
| No native `<select>` | `check-native-select.mjs` |
| No bespoke empty-state CTAs | `check-bespoke-empty-cta.mjs` |
| Panel toggles declare availability | `check-panel-toggles.mjs` |
| Reactivity via the shared stack | `check-app-reactivity.mjs` (ratchet — drain this app's entries) |

## 1. Both-themes pass *(judgment — the single highest-yield check)*

Screenshot every surface of the app in **light and dark** (and ideally High-Contrast). Look for: washed-out or ascender-tip contrast text, fills that read as slabs in one theme, borders that vanish, `design-ok` literals that turn out NOT to be theme-independent after all.

## 2. Type rhythm *(mostly mechanical now)*

Sizes only from `--text-size-*` (the even-pixel scale has **no 11/13px tiers** — split odd sizes by role: titles/content → `md`, status/meta → `sm`). Weights from the token scale. One heading face per level across panels.

## 3. Controls & rows *(judgment + gates)*

- Adjacent controls on one row share a height from `--control-height-*` — an input beside a select beside a button must align pixel-exact.
- Buttons: shared `bs-btn` faces only (primary = `data-bs-primary`; quiet secondary = default/`--neutral` per surface); no hand-rolled pills.
- Every interactive element has a `:focus-visible` ring and a disabled state that explains itself (tooltip/hint when the reason isn't visible — the panel-toggle rule generalises).
- The read-only lock gates **every** write affordance (inspector, cover, icon, drag, rename, delete, menu — [[lock-enforcement-all-write-paths]]).

## 4. Header *(conventions in CLAUDE.md — verify, don't re-derive)*

SDK-owned `.app-header` (no per-app re-declaration), title carries `app-header__title`, object-⋯ is the **last** element in `__right`, 44px baseline, glass surface.

## 5. Menus & popovers

Every menu through the shared fancy-menus runtime; button-triggered menus pass an anchor element (right-side triggers align `End`); dialogs/popovers on the shared `<Popover>`; no bespoke dropdown `<div>`s.

## 6. Empty, loading, error states *(judgment)*

Every list/pane/panel has a designed empty state on the shared `<EmptyState>` (hero for main surfaces, compact for sidebars) — no bare-text placeholders, no dead white space. Loading and error states exist and are centred the same way.

## 7. Selection, hover, badges *(judgment)*

Selected rows/pressed toggles use the **accent-soft fill** (never neutral grey — the one-grey-selection bug class). One chip/badge family per surface; color carries semantics (warning/success), never decoration. Avatars/monograms follow the shared initials rules.

## 8. Alignment & overflow *(judgment)*

Shared left edges (the icon-gutter rule: if any row has an icon, all rows reserve the slot); text truncates with ellipsis + `title`, never clips mid-glyph; narrow-width reflow doesn't overlap; covers/media hosts in column flex carry `flex-shrink: 0`.

## 9. Evidence & closure

The rung closes with: baseline entries drained (or annotated with reasons), before/after screenshots (both themes) linked from the rung, and **any cross-app finding filed as an SDK extraction / new ratchet rung** rather than fixed only locally.
