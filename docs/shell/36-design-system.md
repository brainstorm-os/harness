# 36 — Design system

This doc defines the **design system** for Brainstorm — the structured set of visual variables (tokens) that every shell surface and every recommended-track app uses. It complements [13-frontend-stack.md](13-frontend-stack.md)'s "Themes" section (which describes *what* a theme is) by specifying *what tokens exist*, *how they're named*, and *how code uses them*.

The architectural framing: **all design variables live inside a theme**. There are no hardcoded colors, spacings, fonts, or motion values in shell or app code — only token references. A theme is a complete value mapping for the token namespace; switching themes re-renders the whole system with new values; user-created themes follow the same shape as bundled ones.

It builds on [13-frontend-stack.md](13-frontend-stack.md) (theme composition: tokens + icon pack + typography), [27-layouts.md](27-layouts.md) (layouts reference tokens via display options), [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md) (the print theme), [21-localization.md](../platform/21-localization.md) (RTL implications), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (theme entities and capability surfaces).

## Visual identity & design direction

The token surface below is the *structural* part of the design system. The **identity** — what Brainstorm feels and looks like — sits one layer up. This section captures the direction; the full system (token values, component grammar, motion grammar, brand kit) will be built out separately using Claude Design and slotted into the structures defined later in this document.

### Aesthetic direction

> **Decision:** the visual language is **low-poly**: faceted geometric shapes, flat-shaded triangular planes, a sense of "things assembled from a small number of decisive cuts."

Anchors:

- **App icon** — the brain mark is a low-poly polyhedral form. The same construction grammar (triangular facets, deliberate light/shadow facets, restrained palette) extends to:
  - Wallpapers and dashboard backdrops.
  - Empty-state illustrations.
  - System-level decorative elements (loading states, transitions).
- The low-poly direction sits *underneath* the icon-pack layer described in [13-frontend-stack.md](13-frontend-stack.md). Phosphor (the default icon pack) provides the *functional* UI iconography (save, settings, etc.); low-poly is for *brand* surfaces — the brain mark, decorative wallpaper, illustrative empty states, splash imagery.

### Brand identity

> **Decision:** Brainstorm's brand identity is **two-part**: a wordmark (the typeface treatment of the name "Brainstorm") and a brain mark (the low-poly polyhedral form, available as both raster and vector).

Components:

- **Wordmark.** "Brainstorm" set in a chosen typeface that conveys the same low-poly / faceted feeling — geometric, decisive cuts in the letterforms; not soft, not handwritten. The wordmark is the primary lock-up for headers, the application title, store listings, and document watermarks.
- **Brain mark.** Standalone, no text. Used as the app icon (already shipping; see `packages/shell/art/icon.{png,@2x.png,icns}`), the dock icon, the tray icon, favicons, and any small-format identity surface.
- **Vector versions of the brain mark.** Required so the mark scales across:
  - Small UI surfaces (dashboard cards, settings header, install dialogs).
  - Documentation and the README.
  - Future store listings, social cards, OG images.
  - Possible future animated states (boot animation, idle motion).

Lock-up rules, color variants, typography pairing, and exact spec sheets are the subject of the **full design-system build with Claude Design** noted below.

### What ships when

The visual-identity work has two horizons:

| Horizon                | What lands                                                                                                                                                       |
|------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Now (v0)**           | The shipped brain mark in `packages/shell/art/`; bundled default light / dark token sets (Rose / Midnight, in `packages/tokens/`) with runtime theme switching; a single-color subtle accent. Enough to ship a usable shell. |
| **Claude-Design build** | Full token-value derivation from the brand kit; wordmark typeface selection + licensing; vector brain-mark masters (SVG family + brand assets); low-poly wallpaper palette; component grammar (radii, shadow recipes, motion easings, surface treatments); per-context illustration kit; print/PDF theme values. Slots into the token namespace below without changing its shape — only the *values* and the *icon-pack contents* change.    |

> **Decision:** the **token namespace, semantic names, and architectural decisions** documented in this file are stable; the Claude-Design build only fills in values and produces brand assets. This means feature code written against tokens today won't need to change when the design system formally lands.

> **Open:** wordmark typeface — pending Claude-Design pass. Until then the shell uses the system stack from [13 §Typography](13-frontend-stack.md).

> **Open:** low-poly motion grammar — does the brain mark animate on splash / idle? Brand decision deferred.

## Token hierarchy

Two layers, deliberately:

| Layer            | Purpose                                                            | Who references                                      |
|------------------|--------------------------------------------------------------------|-----------------------------------------------------|
| **Primitive tokens** | Raw, unopinionated values: `scale.1 = 4px`, `palette.blue.500 = #6aa9ff`, etc. | Theme definitions only.                             |
| **Semantic tokens**  | Meaning-named tokens: `color.background.primary`, `space.md`. Reference primitives. | All shell and app code; everywhere.                 |

> **Decision:** apps and shell code reference **semantic tokens only**. Primitive tokens are theme-internal — they exist so theme authors can write `palette.blue.500` instead of `#6aa9ff` and have it propagate through every reference. Code that bypasses semantic tokens and reads primitives directly is a code-review reject.

This split is what makes theming actually work: changing dark mode to light mode redefines the semantic tokens, but the primitive palette can stay or change as the theme author wishes. Multiple themes can share a palette but have different semantic mappings (e.g., a "high contrast dark" theme shares dark's palette but maps `color.text.primary` to pure white instead of off-white).

## The semantic token namespace

The shell's `brainstorm-tokens` package defines this namespace. It's stable per major SDK version (per [13-frontend-stack.md](13-frontend-stack.md)); changes go through OQ + SDK-major bumps.

### Colors

| Token                              | Meaning                                                              |
|------------------------------------|----------------------------------------------------------------------|
| `color.background.primary`         | Main app / dashboard / window background.                            |
| `color.background.elevated`        | Slightly raised surfaces — cards, panels, modals.                    |
| `color.background.subtle`          | Subtle background tint for hover states, table-row striping, etc.    |
| `color.background.inverse`         | Inverse of `background.primary` (light bg in dark mode, vice versa). |
| `color.surface.default`            | Default surface for floating UI: menus, tooltips, popovers.          |
| `color.surface.overlay`            | Heavy-shadow overlay surface (modals, dialogs).                      |
| `color.border.subtle`              | Subtle borders — table rows, settings rows.                          |
| `color.border.default`             | Default border — input fields, card outlines.                        |
| `color.border.strong`              | Emphasized borders — focused fields, selected items.                 |
| `color.text.primary`               | Body text, primary labels.                                           |
| `color.text.secondary`             | Subdued text — descriptions, meta, captions.                         |
| `color.text.tertiary`              | Least emphasized text — placeholders, disabled labels.               |
| `color.text.inverse`               | Text on inverted backgrounds (e.g. on `accent.primary`).             |
| `color.text.link`                  | Hyperlink text (`brainstorm://` links, external URLs).               |
| `color.accent.subtle`              | Subtle accent background (selected-state, active item background).   |
| `color.accent.default`             | Primary accent — buttons, focus rings.                               |
| `color.accent.strong`              | Strong accent — primary CTAs, important highlights.                  |
| `color.accent.text`                | Text color used on accent backgrounds.                               |
| `color.state.success`              | Success state — confirmations, completed indicators.                 |
| `color.state.warning`              | Warning state — non-fatal alerts.                                    |
| `color.state.error`                | Error state — failed states, destructive actions.                    |
| `color.state.info`                 | Informational state — neutral notifications.                          |
| `color.chrome.background`          | Window chrome (title bar overlay) background.                        |
| `color.chrome.text`                | Window chrome text/symbols.                                          |
| `color.shadow.subtle` … `.strong`  | Shadow tints by intensity.                                           |
| `color.focus.ring`                 | Focus-ring color for keyboard navigation.                            |

### Spacing

4px-based scale. Every layout uses these; no arbitrary pixel values.

| Token        | Value (light/dark) | Use                                                |
|--------------|--------------------|----------------------------------------------------|
| `space.0`    | 0px                | No space.                                          |
| `space.0_5`  | 2px                | Hairline (rare).                                   |
| `space.1`    | 4px                | Tightest gaps — icon-to-text within a chip.        |
| `space.2`    | 8px                | Default tight gap.                                 |
| `space.3`    | 12px               | Medium gap — between related elements.             |
| `space.4`    | 16px               | Default padding inside surfaces.                   |
| `space.5`    | 24px               | Section separation.                                |
| `space.6`    | 32px               | Major section separation.                          |
| `space.7`    | 48px               | Page-level spacing.                                |
| `space.8`    | 64px               | Largest standard space (hero margins).             |

> **Decision:** `space.X` values are absolute pixels, not rems. Reasoning: Brainstorm is a desktop app with fixed UI scaling; rem-based scaling for accessibility would re-flow the whole shell in confusing ways. Accessible-text scaling happens via the font-size scale below, not via space units.

> **Open:** does a `density` theme dimension shrink all space tokens by a factor (e.g., compact 0.75×, comfortable 1.25×)? Tracked as OQ-154.

### Typography

Font sizes:

| Token              | Size (px) | Line-height (rem-ish) | Use                                          |
|--------------------|-----------|------------------------|----------------------------------------------|
| `text.size.xs`     | 11        | 1.4                    | Tiny labels, badges.                          |
| `text.size.sm`     | 12        | 1.45                   | Captions, secondary text.                     |
| `text.size.md`     | 13        | 1.5                    | Body default.                                 |
| `text.size.lg`     | 15        | 1.5                    | Emphasized body, dialog body.                 |
| `text.size.xl`     | 18        | 1.4                    | Section headings, card titles.                |
| `text.size.2xl`    | 22        | 1.3                    | Page titles, entity titles in `full` context. |
| `text.size.3xl`    | 32        | 1.2                    | Hero / dashboard title.                       |
| `text.size.display` | 48       | 1.1                    | Marketing-style display only.                 |

Font weights:

| Token                  | Numeric weight | Use                                  |
|------------------------|----------------|--------------------------------------|
| `text.weight.regular`  | 400            | Body text.                            |
| `text.weight.medium`   | 500            | Emphasized body, labels.              |
| `text.weight.semibold` | 600            | Section titles, button text.          |
| `text.weight.bold`     | 700            | Reserved for hero text.               |

Font families (mapped from the theme's typography choice — per [13-frontend-stack.md](13-frontend-stack.md)):

| Token             | Default                                                                 |
|-------------------|-------------------------------------------------------------------------|
| `text.family.ui`  | `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif` |
| `text.family.body`| Same as `ui` by default; custom typography can override.                |
| `text.family.code`| `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace`            |
| `text.family.display` | Same as `ui` by default.                                            |

Line-height tokens for fine-grained control:

| Token                     | Value | Use                                          |
|---------------------------|-------|----------------------------------------------|
| `text.lineHeight.tight`   | 1.2   | Headings, large titles.                       |
| `text.lineHeight.normal`  | 1.5   | Body text.                                    |
| `text.lineHeight.relaxed` | 1.7   | Long-form reading content.                    |

### Radii

| Token         | Value | Use                                              |
|---------------|-------|--------------------------------------------------|
| `radius.none` | 0     | No rounding.                                      |
| `radius.sm`   | 4px   | Subtle rounding — pills, small buttons.           |
| `radius.md`   | 8px   | Default — cards, inputs.                          |
| `radius.lg`   | 12px  | Modals, large surfaces.                           |
| `radius.xl`   | 16px  | Hero cards, app icons.                            |
| `radius.full` | 9999px | Circles (avatars, pill buttons).                 |

### Control heights

Canonical row-heights for interactive form controls. Any control that sits
on a toolbar/row line — buttons, text inputs, search fields, selects — sizes
its `height` from this scale (with `box-sizing: border-box`) so siblings of
the same size line up pixel-exact and can never drift. A hardcoded control
height (`height: 32px` on a button/input instead of `var(--control-height-md)`)
is a code-review reject, same as a hardcoded `space`/`radius` value.

| Token                | Value | Use                                              |
|----------------------|-------|--------------------------------------------------|
| `control.height.sm`  | 24px  | Compact controls — toolbar inline buttons, chips. |
| `control.height.md`  | 32px  | Default — buttons, text inputs, search fields.    |
| `control.height.lg`  | 40px  | Prominent controls — primary form actions.        |

### Stateful controls never change box metrics

A control's **selected / active / pressed / checked / current** state must be
**pure paint** — it may change `background`, `color`, `border-color`,
`box-shadow`, or `outline`, but it must **never** change a property that alters
the element's box (`border-width`/`border-style`/the `border` shorthand,
`padding`, `margin`, `font-size`, `font-weight` on an auto-sized box,
`width`/`height` on an auto-sized box). A state that adds a border the rest
state doesn't reserve makes the element grow on click and shoves its siblings —
a layout-shift bug (the user-reported Calendar "filter by type" toggle that
grew when activated was exactly this: an active-state border with no
reservation).

Correct techniques, in order of preference:

1. **Reserve the border in the rest state**, then only swap its colour when
   active: `border: 1px solid transparent` at rest →
   `border-color: var(--accent)` when `[aria-pressed="true"]`. With the global
   `box-sizing: border-box`, the reserved transparent border occupies the box
   from the start, so activating it is zero-reflow. (Tab underlines do the same
   with `border-bottom: 2px solid transparent` → `border-bottom-color`.)
2. **Use `box-shadow` or `outline`** for the active ring — neither participates
   in layout, so no reservation is needed.
3. **Reserve a fixed box** when the active state needs a filled chip/circle
   (e.g. a "today" day-number): give *every* instance the final
   `width`/`height`/`display:inline-flex`/`border-radius` at rest and let the
   active state only change `background`/`color`.
4. Otherwise restrict the state to `background` / `color` only.

This is the same invariant as the **focus-outline rule** (see
[35-code-conventions §Keyboard handling / focus]: a focus ring must *replace*
the border with `outline-offset: -1px` + `border-color: transparent`, sitting
on the reserved border position rather than stacking outside it and shifting
layout). Both rules reduce to: **interactive state is paint, never reflow.** A
PR whose active/selected rule introduces an unreserved border/padding/size
delta is a code-review reject.

### Focus

A keyboard-driven focus ring is a single design-system rule, not a per-component style. Three structural tokens in `:root` (defined in `packages/shell/src/renderer/styles.css`, alongside `--app-header-height`):

| Token                         | Value                                | Use                                                                   |
|-------------------------------|--------------------------------------|-----------------------------------------------------------------------|
| `--focus-ring-outline`        | `2px solid var(--color-focus-ring)`  | Composite outline. Drives every focus ring; never re-spelled inline.  |
| `--focus-ring-offset`         | `2px`                                | Default offset. Used by the global `:focus-visible` rule.             |
| `--focus-ring-offset-inset`   | `-1px`                               | Inset offset for bordered inputs so the ring sits on the reserved border position rather than stacking outside it (per [[feedback_focus_outline_replaces_border]]). |

The global rule `:focus-visible { outline: var(--focus-ring-outline); outline-offset: var(--focus-ring-offset); }` is the single source of truth — any element that focus-visible-matches gets the ring for free. Per-component rules exist **only** when the offset deviates from the default: bordered inputs (`.text-field__input`, `.segmented__item`, `.data__form-name`, `.data__vocab-input`, …) consume `var(--focus-ring-offset-inset)`; the tight-icon-button case keeps a literal `1px`; the deep-inset Data row trigger keeps a literal `-2px` (both annotated with a one-line *why*).

Two intentional exemptions: `.icon-picker__cell` colours with `--color-accent-default` (the picker's accent reads through the focus ring); `.settings__swatch` / `.settings__swatch-pick` own a custom `::after` scale-and-shadow chrome and set `outline: none`. Anything else inventing a new ring is a code-review reject.

See [61-keyboard-accessibility §Focus management invariants](61-keyboard-accessibility.md#focus-management-invariants) for the broader keyboard-focus contract (`:focus-visible` vs `:focus`, suppression on pointer-driven focus, restore-on-modal-close).

### Shadows

| Token         | Use                                              |
|---------------|--------------------------------------------------|
| `shadow.none` | No shadow.                                        |
| `shadow.sm`   | Subtle elevation — hover states, raised inputs.   |
| `shadow.md`   | Default elevation — cards, panels.                |
| `shadow.lg`   | Strong elevation — popovers, dropdowns.           |
| `shadow.xl`   | Heaviest — modals, dialogs.                       |
| `shadow.inner.sm/md` | Inset shadows — pressed states, wells.    |

Shadow values are computed from `color.shadow.subtle`…`.strong` + spread/offset; theme authors can override the full shadow string per-level.

### Motion

| Token                          | Value      | Use                                                |
|--------------------------------|------------|----------------------------------------------------|
| `motion.duration.instant`      | 0ms        | Hover state changes, no animation.                 |
| `motion.duration.fast`         | 100ms      | Small UI feedback — button press, focus ring.      |
| `motion.duration.normal`       | 200ms      | Default — modals opening, menus appearing.         |
| `motion.duration.slow`         | 400ms      | Larger transitions — page changes, dashboard switch. |
| `motion.duration.deliberate`   | 700ms      | Long deliberate animations — celebratory states.   |
| `motion.easing.linear`         | `linear`   | Continuous motion (progress bars).                 |
| `motion.easing.standard`       | `cubic-bezier(0.4, 0, 0.2, 1)` | Material-style "standard" curve.                  |
| `motion.easing.emphasized`     | `cubic-bezier(0.2, 0, 0, 1)`   | Snappier entry.                                   |
| `motion.easing.decelerated`    | `cubic-bezier(0, 0, 0.2, 1)`   | Soft ending.                                      |

> **Decision:** apps respect the user's "reduced motion" preference. The `motion.duration.*` tokens silently resolve to `0` when reduced motion is on. Apps don't have to check — using the token is enough.

### Async loading & busy state

**Rule:** any control that fires an async request and any element whose content is loading must show a loader. A button awaiting a request shows the loader **in place of or alongside its label** (the button stays its own size — never collapses), disables itself, and sets `aria-busy="true"`. Non-button async regions (panels fetching data, lists hydrating, an inspector resolving an entity) show the same loader centered in the region until content is ready. No async affordance is allowed to sit visually idle while work is in flight — an unstyled wait reads as a frozen UI.

The canonical loader is the single-ring spinner below: a circle in the theme's border tone with a transparent gap, rotating. The ring color is **`--color-border-default`** — the same weight as the product's chrome borders — so it reads correctly on every theme. Never hardcode an rgba into the ring.

Markup (pure CSS — no SVG):

```html
<span class="loader" role="status" aria-label="Loading"></span>
```

CSS (canonical spec — adapted from [uiverse.io by Fernando-sv](https://uiverse.io); changed from the original by the theme-token ring color and em-relative sizing, both required by our conventions):

```css
.loader {
  display: inline-block;
  box-sizing: border-box;
  /* Default to the surrounding text size so it sits inline in a button.
     Region-level loaders set an explicit width/height AND font-size so the
     em-scaled ring thickness grows with the loader. */
  width: 1em;
  height: 1em;
  border: max(2px, 0.11em) solid var(--color-border-default);
  border-left-color: transparent;
  border-radius: 50%;
  animation: loader-spin 1s linear infinite;
}

@keyframes loader-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  /* Reduced-motion users still get a visible busy signal — the held ring
     with its gap — just no spin. */
  .loader { animation: none; }
}
```

**Conventions:**

- Ships once as a shared renderer primitive (alongside `<Popover>`, `<Icon>`) — apps and shell consume that, they do not paste this CSS. Same DRY ceiling as every other chrome primitive.
- Size is `1em` by default so it tracks the button/text it sits in; region-level loaders set an explicit size (a small region uses ~`var(--space-*)`-scale; a full panel uses a larger fixed size) and mirror it into `font-size` so the ring thickness scales proportionally.
- The ring is always `var(--color-border-default)` with a transparent left gap. It carries the theme's border weight on every surface — filled buttons, panels, inspectors — do not theme it per variant or hardcode a color.
- Disabled-while-busy: a busy button is also `disabled` / `aria-disabled` so the action can't double-fire; the loader is the visible reason, not a separate spinner appended next to a still-clickable button.

### Z-layers

| Token                  | Value | Use                                                |
|------------------------|-------|----------------------------------------------------|
| `z.base`               | 0     | Default content.                                   |
| `z.dropdown`           | 10    | Inline dropdowns, autocomplete.                    |
| `z.sticky`             | 20    | Sticky headers, table headers.                     |
| `z.overlay`            | 30    | Dimming overlays.                                  |
| `z.modal`              | 40    | Modals.                                            |
| `z.popover`            | 50    | Popovers, tooltips floating above content.         |
| `z.toast`              | 60    | Toasts, transient notifications.                   |
| `z.commandPalette`     | 70    | The launcher / command palette (above everything). |
| `z.windowControlsOverlay` | 80 | Title bar / chrome — top of stacking order.        |

### Cursors

Cursor style signals the interaction affordance of an element. Use the standard CSS cursor keywords consistently across shell and apps; no custom cursor images in v1.

| Use                                                              | Cursor                                                  |
|------------------------------------------------------------------|---------------------------------------------------------|
| Clickable (button, link, menu item, dashboard icon)              | `pointer`                                               |
| Pure draggable (graph node, slider thumb, drag handle)           | `grab` at rest; `grabbing` while actively dragging      |
| Click **and** drag (icon that can be opened or reordered, card)  | `pointer` at rest; `grabbing` while actively dragging   |
| Resizable horizontal edge (left/right)                           | `ew-resize`                                             |
| Resizable vertical edge (top/bottom)                             | `ns-resize`                                             |
| Resizable corner (NW–SE diagonal)                                | `nwse-resize`                                           |
| Resizable corner (NE–SW diagonal)                                | `nesw-resize`                                           |
| Resizable column boundary (table / split pane)                   | `col-resize`                                            |
| Resizable row boundary (table / split pane)                      | `row-resize`                                            |
| Text-editable region                                             | `text`                                                  |
| Disabled control                                                 | `not-allowed`                                           |
| Read-only chrome (panel headers, decorative surfaces)            | omit `cursor` (inherits `default`)                      |

The `grab` ↔ `grabbing` flip is implementation-driven: while a drag is active (after mousedown + threshold), set a class or `[data-dragging="true"]` on the element (or its ancestor) and apply `grabbing`. The graph app already uses this pattern — see `apps/graph/src/styles.css` for the canonical example.

> **Decision:** elements that support **both** click and drag (e.g. a dashboard icon you can either open or reorder) show `pointer` at rest — the primary affordance is the click. The cursor only flips to `grabbing` once a drag actually starts, not on hover. Showing `grab` on hover would mis-signal the click as a secondary action.

> **Decision:** custom cursor images are not part of v1. The system uses native cursor keywords so the platform's pointer styling (macOS, Windows, Linux) stays consistent with every other application the user runs.

## Themes

A **theme** is a complete value mapping for the semantic tokens, plus the icon pack and typography choices (per [13-frontend-stack.md](13-frontend-stack.md) where the theme structure is fully specified).

The shell ships three built-in theme variants:

| Theme         | Use                                                                         |
|---------------|-----------------------------------------------------------------------------|
| `Default Light` | Built-in light-scheme theme (`TokenSet.appearance = "light"`).            |
| `Default Dark`  | Built-in dark-scheme theme  (`TokenSet.appearance = "dark"`).             |
| `Print`         | Used during print/PDF rendering (per [23-output-printing-pdf.md](../platform/23-output-printing-pdf.md)). Removes decorative chrome; high-contrast text on white. |

Following the OS light/dark preference is **not a theme** but the appearance-mode axis described below — themes themselves declare a fixed `appearance` and the mode selects which pair is live.

Plus per-user accessibility overlays (per [13-frontend-stack.md](13-frontend-stack.md)):

- **High contrast** — overrides text/border tokens to maximum contrast.
- **Reduced motion** — overrides `motion.duration.*` to `0`.

These are not themes per se; they're overlays applied on top of the active theme.

### Appearance modes & pair slots

Themes and wallpapers are paired against the **appearance mode**, not picked once globally. This is the difference between "I switched to dark mode" being a one-click action and a multi-step re-do-everything chore.

**Three concepts, kept separate:**

1. **Appearance mode** — one of `light` / `dark` / `auto`. `auto` follows the OS `prefers-color-scheme` and re-resolves on change. This is the user-facing toggle.
2. **Pair slot** — the **(theme, wallpaper)** pair active in a given mode. Two slots exist per user: `appearance.light` and `appearance.dark`. The active slot is chosen by the effective mode (`auto` resolves to the OS preference at read time).
3. **Theme `appearance` declaration** — every `TokenSet/v1` declares `appearance: "light" | "dark"` (already specified — see the Solarized Dark example below). The slot picker filters compatible themes by this declaration so a dark theme cannot be dropped into the light slot.

**Effective resolution:**

```
mode := user setting (light | dark | auto)
effectiveMode := mode === "auto" ? matchMedia("(prefers-color-scheme: dark)") ? "dark" : "light" : mode
activePair := effectiveMode === "dark" ? appearance.dark : appearance.light
applyTheme(activePair.theme); applyWallpaper(activePair.wallpaper);
```

`auto` mode subscribes to the OS preference change (`matchMedia` listener in the dashboard renderer, OS event in main) and re-applies the corresponding pair on the next paint. Per OQ-155 (theme transitions) the swap is instant in v1.

**Shortcut:** a single `appearance.toggle` action (registered in `default-chords.ts`) flips the *effective* mode. From `auto`, the toggle pins the explicit opposite of the currently-resolved mode (so the user gets the immediate visual change they expected); from `light`/`dark` it flips to the other. Re-entering `auto` is an explicit Settings action — the shortcut never lands there accidentally.

**Pair widening — deferred.** A pair is **(theme, wallpaper)** in v1. Icon pack and typography are scheme-neutral in the bundled set and stay global; if a future theme author needs scheme-specific icons or fonts, widen the pair shape, don't add a parallel switch. StylePack (per OQ-183) is global for the same reason — modders style chrome, not modes.

**Migration from the single-theme world:** the existing `appearance/theme` and `appearance/wallpaper` settings seed the slot matching the theme's declared `appearance`; the opposite slot seeds from the matching `Default *` theme + the default gradient wallpaper. The user sees the same thing they saw before until they enter Settings → Appearance and customise the other slot.

**Settings → Appearance** surfaces this as: a three-way mode segmented control at top, then two side-by-side pair cards (Light / Dark) each with theme picker + wallpaper picker. The card matching the *effective* mode highlights as active. See [25-settings.md](25-settings.md#appearance).

**Persistence:** the mode is per-device, the pairs are per-vault. See [OQ-156](../reference/11-open-questions.md#oq-156--theme-persistence-scope) for the rationale (dark-mode laptop + light-mode desktop must coexist without overwriting each other).

### Custom user themes

Per [13-frontend-stack.md](13-frontend-stack.md), users author custom themes by composing token sets, icon packs, and typography choices. User-authored themes can stay personal-by-default, be promoted to org scope, or be **packaged and distributed** through the same store as apps — see [40-theme-store.md](../apps/40-theme-store.md) for the distribution path (package format, signing, install/update/remove lifecycle, author profile, ratings, paid themes in v2).

The token-set portion lives as a `brainstorm/TokenSet/v1` entity:

```jsonc
{
  "type": "brainstorm/TokenSet/v1",
  "properties": {
    "name": "Solarized Dark",
    "appearance": "dark",
    "extends": "Default Dark",         // optional — inherit and override
    "tokens": {
      "color.background.primary": "#002b36",
      "color.text.primary": "#93a1a1",
      "color.accent.default": "#268bd2"
      // partial — only overrides; the rest inherits from `extends`
    }
  }
}
```

> **Decision:** user-created token sets can **extend** built-in or other user-created token sets, only overriding the tokens they want to change. This is what makes "I want Dark but with a green accent" a single-line theme.

### StylePacks & the `data-bs-region` hook contract

The fourth, optional theme component is a `brainstorm/StylePack/v1` — user-authored **raw CSS** for the "move that pixel" cases the token model deliberately doesn't reach (OQ-183, resolved 9.9.4). Because a StylePack ships code-shaped content it goes through a **bundle validator** (`sanitizeStylePackCss` in `@brainstorm/sdk-types`) that rejects `javascript:`/`vbscript:` URLs, `@import`, `-moz-binding`, `behavior:`, `expression(...)`, and external/network `url()` fetches (warns on `data:` URIs); a pack with any error-severity finding never installs.

StylePack CSS targets a **frozen hook surface**, not private class names (which churn on every refactor). Every skinnable chrome region carries a stable `data-bs-region="<name>"` attribute — the contract is `STYLE_HOOK_REGIONS` in `@brainstorm/sdk-types` (`style-hooks.ts`), pinned by a structural guard so a refactor can't silently drop a hook. A StylePack writes, e.g.:

```css
[data-bs-region="dashboard-header"] { backdrop-filter: blur(24px) saturate(1.4); }
[data-bs-region="app-header"]       { border-bottom-width: 2px; }
```

Frozen regions (v1): app frame (`app-header`, `app-header-left`, `app-header-right`, `app-header-title`); dashboard (`dashboard`, `dashboard-header`, `dashboard-header-left`, `dashboard-header-right`, `dashboard-body`, `dashboard-tray`); `lock-screen`; the shared popover/dialog (`popover`, `popover-backdrop`, `popover-panel`); settings (`settings`, `settings-sidebar`, `settings-main`). Adding a region is additive; removing/renaming one is a breaking change that bumps `STYLE_HOOK_VERSION`. The shell renderer stamps its own chrome in JSX; the shared `.app-header` chrome is stamped from the single `app-preload` chokepoint so every app window gets the hooks without per-app markup.

> **Accessibility posture:** token sets are contrast-linted (OQ-171); StylePacks can override anything visual and are **not** linted (full CSS evaluation is intractable), so StylePack-modified chrome ships without the contrast guarantee — the editor + installer surface that at apply time.

## How code references tokens

### CSS

CSS variables are the lingua franca. The shell exposes the active theme's tokens as CSS custom properties on `:root`:

```css
:root {
  --color-background-primary: #0b1220;
  --color-text-primary: #e7eef9;
  --space-3: 12px;
  --space-4: 16px;
  --radius-md: 8px;
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.18);
  /* …all tokens… */
}
```

Code uses them:

```css
.dashboard__card {
  background: var(--color-background-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-md);
  color: var(--color-text-primary);
  transition: background var(--motion-duration-fast) var(--motion-easing-standard);
}
```

### TypeScript

For dynamic styles or computed values, the same tokens are available as a typed module:

```ts
import { tokens } from "@brainstorm/tokens";

const dashboardCardStyle = {
  background: tokens.color.background.elevated,
  borderRadius: tokens.radius.md,
  padding: tokens.space[4],
};
```

The TS module reads from CSS custom properties at runtime via `getComputedStyle(document.documentElement)`, so changing the active theme updates these values too.

> **Decision:** **CSS-variable references are the default**; TS-module access is for cases where CSS isn't enough (e.g., computing a derived value, passing to a canvas, integrating with a third-party styling library). Most code uses CSS.

### React hooks

For React components that need to react to theme changes:

```ts
import { useToken } from "@brainstorm/tokens";

function Card({ children }) {
  const padding = useToken("space.4");      // dynamically resolves
  const accent = useToken("color.accent.default");
  // …
}
```

`useToken` subscribes to theme changes and triggers re-render on switch.

### Naming convention in CSS

CSS variables use kebab-case with dots flattened to hyphens:

| Token (TS / JSON path)               | CSS variable                              |
|--------------------------------------|-------------------------------------------|
| `color.background.primary`           | `--color-background-primary`              |
| `color.text.primary`                 | `--color-text-primary`                    |
| `space.4`                            | `--space-4`                               |
| `text.size.md`                       | `--text-size-md`                          |
| `text.lineHeight.normal`             | `--text-line-height-normal`               |
| `motion.duration.fast`               | `--motion-duration-fast`                  |
| `motion.easing.standard`             | `--motion-easing-standard`                |
| `radius.md`                          | `--radius-md`                             |
| `shadow.md`                          | `--shadow-md`                             |
| `z.modal`                            | `--z-modal`                               |

## RTL considerations

Tokens are direction-agnostic. Layout direction is handled via CSS logical properties (per [21-localization.md](../platform/21-localization.md)):

```css
/* Good — flips in RTL */
padding-inline-start: var(--space-4);
margin-block-end: var(--space-3);

/* Bad — doesn't flip */
padding-left: var(--space-4);
margin-bottom: var(--space-3);
```

The token system itself is direction-neutral; theme authors don't need a separate RTL theme.

## Accessibility

- **Color contrast.** Every theme must meet WCAG AA (4.5:1 for body text, 3:1 for large/UI text) for the default semantic mappings. The shell ships a token-contrast linter that runs at theme-author time.
- **Focus rings.** `color.focus.ring` is always visible against `color.background.*`. Custom themes that hide focus rings fail validation.
- **High-contrast variant.** Every shipped theme has a high-contrast counterpart automatically derived; user enables via OS preference or settings.
- **Reduced motion.** All `motion.duration.*` resolve to `0` when reduced motion is enabled (OS preference or settings override).
- **Font scale.** Users can apply a font-scale overlay (1.0× / 1.25× / 1.5×) that multiplies `text.size.*` values. Layout reflows accordingly.

## Tokens are NOT

- **Not hardcoded values.** A `padding: 12px` in code (not via `var(--space-3)`) is a code-review reject.
- **Not arbitrary CSS variables.** All CSS variables in the system either come from the token namespace or have a documented exception (e.g., third-party libraries that need to inject their own).
- **Not unbounded.** The token list above is the complete v1 namespace. Adding tokens is a shell-release decision; apps don't get to add new token names that other apps see.
- **Not platform-detection.** A theme is the same on macOS, Windows, Linux. Platform-specific adjustments (like custom-vs-native window chrome — per [33-windows-and-menus.md](33-windows-and-menus.md)) use platform CSS classes, not tokens.

## Implementation reference (v0)

The current v0 implementation lives in `src/renderer/theme/` (per the early-implementation shell). Key files:

- `src/renderer/theme/tokens.ts` — TypeScript definitions for every semantic token; the source of truth.
- `src/renderer/theme/themes.ts` — built-in themes (Default Light, Default Dark) referencing the primitive palette.
- `src/renderer/theme/theme-provider.tsx` — React provider that applies the active theme's tokens as CSS variables on `:root`.
- `src/renderer/theme/css-vars.ts` — utility for translating token paths to CSS-variable names.

Future v1 work:
- Migrate to a shared `brainstorm-tokens` workspace package once the monorepo is set up.
- Add `useToken` React hook for dynamic theme subscriptions.
- Add `TokenSet/v1` entity-type support for user-created themes.
- Ship the `Print` theme variant.
- Add reduced-motion / high-contrast / font-scale overlays.

## Phasing

| Capability                                              | v0 (now) | v1   | v2  |
|---------------------------------------------------------|----------|------|-----|
| Semantic token namespace fixed                           | ✓        | ✓    | ✓   |
| Default Dark theme implemented                           | ✓        | ✓    | ✓   |
| Default Light theme                                      | —        | ✓    | ✓   |
| System theme (auto-follow OS)                            | —        | ✓    | ✓   |
| Print theme                                              | —        | ✓    | ✓   |
| Theme switching at runtime (CSS-variable swap)           | hardcoded | ✓   | ✓   |
| `useToken` React hook                                    | —        | ✓    | ✓   |
| `@brainstorm/tokens` published workspace package          | —        | ✓    | ✓   |
| `TokenSet/v1` entity-type for user themes                 | —        | ✓    | ✓   |
| Reduced-motion overlay (OS preference + setting)         | —        | ✓    | ✓   |
| High-contrast overlay                                    | —        | optional | ✓ |
| Font-scale overlay                                       | —        | optional | ✓ |
| Custom-theme editor app                                  | —        | optional | ✓ |
| Token-contrast lint at theme-author time                 | —        | ✓    | ✓   |
| Org-scoped brand themes                                  | —        | —    | ✓   |

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-154** — Density dimension on themes (compact / default / comfortable) — shrink/grow all space tokens.
- **OQ-155** — Theme transitions — animate token changes when user switches theme, or instant swap? Trade-off: nicer UX vs. potential glitching during in-progress animations.
- **OQ-156** — Theme persistence — user's active theme stored as a per-vault setting (current plan) vs. a per-device setting (so a dark-mode laptop and light-mode desktop look right). Hybrid?

## Summary

- **Two layers**: primitive tokens (raw values, theme-internal) and semantic tokens (meaning-named, used everywhere).
- **All design variables live in a theme.** No hardcoded values in shell or app code.
- **Token namespace covers**: colors (background / surface / border / text / accent / state / chrome / shadow / focus), spacing (4px-based 0…8), typography (sizes + weights + families + line-heights), radii, shadows, motion (duration + easing), z-layers, cursor conventions (pointer / grab / grabbing / resize family / text / not-allowed).
- **CSS variables are the default reference path**; TypeScript module access for dynamic / non-CSS cases; React `useToken` hook for components that need to react to theme changes.
- **RTL** handled via CSS logical properties, not separate themes.
- **Accessibility** baked in: contrast lint, focus-ring requirements, reduced-motion auto-resolution, font-scale overlay.
- v0 ships Default Dark hardcoded; v1 ships full theme system with switching, user-created themes, and overlays; v2 ships org-scoped brand themes.
