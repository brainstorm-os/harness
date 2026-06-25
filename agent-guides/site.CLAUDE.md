# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

The **marketing surface** for [Brainstorm](../app) — the local-first OS-shell knowledge product being built in the sibling repo. This repo renders:

- The public landing page (`brainstorm.[tld]`) — hero, capability tour, comparison pages, per-segment pages.
- The changelog and blog.
- Eventually (Phase 4): the docs portal (`docs.brainstorm.[tld]`), as a static mirror of `../docs/`.
- Eventually (Phase 4): the pricing page, rendered from `../docs/platform/44-pricing.md`.

**The site is empty as of this writing.** Today's state is Phase 0 from [`docs/implementation-plan.md`](docs/implementation-plan.md). Before touching anything, read that plan in full — it anchors every iteration to a phase of the brainstorm launch sequence and to the design docs that authorise each claim.

## Source of truth

**Every product claim on this site comes from a design doc in `../docs/`.** If marketing copy contradicts a design doc, the design doc wins and the marketing copy is corrected. This direction is invariant.

Load-bearing docs for site work, in order of how often you'll touch them:

- [`../docs/platform/46-marketing-and-promotion.md`](../docs/platform/46-marketing-and-promotion.md) — **the canonical spec for this site.** Positioning sentence, capability tour, audience segments, launch phases, anti-patterns, content rules. **Read before any copy change.**
- [`../docs/platform/43-monetisation-strategy.md`](../docs/platform/43-monetisation-strategy.md) — what's free forever, what's paid, what we refuse to monetise.
- [`../docs/platform/44-pricing.md`](../docs/platform/44-pricing.md) — concrete pricing numbers.
- [`../docs/platform/60-developer-docs.md`](../docs/platform/60-developer-docs.md) — DocsHub-4 / `docs.brainstorm.[tld]` spec.
- [`../docs/foundations/01-vision.md`](../docs/foundations/01-vision.md) — vision and principles every page implicitly stands on.
- [`../docs/00-index.md`](../docs/00-index.md) — reading-order map for the rest.

If `../app/` is not checked out as a sibling, the docs-mirror build step degrades gracefully; the rest of the site builds without it. Most site work needs only a *read* of those docs.

## Commands

Once `Site-0.1` (scaffold) lands, this section describes what works. **Before then**, only `git` and editor operations apply.

```sh
bun install              # install deps
bun run dev              # Astro dev server (port 4321)
bun run build            # static build to dist/
bun run preview          # serve dist/ locally
bun run typecheck        # tsc --noEmit (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
bun run lint             # biome check .
bun run format           # biome format --write .
bun run test             # vitest (unit + content schema validation)
bun run test -- <path>   # one file / pattern
bun run visual           # Playwright visual regression
bun run lh               # lighthouse-ci against a local preview build
bun run size             # size-limit budgets per .size-limit.json
bun run build:og         # regenerate public/og/ from current content
```

Performance + a11y + size budgets are enforced in CI. A PR that regresses `/` below Lighthouse 100/100/100/100 or above the 100 KB hero budget fails — fix the regression rather than raising the budget.

## Tech stack (and why)

- **Astro 4** — static-first by default; ships zero JS unless an island opts in via `client:*`. Native MD/MDX content collections — the right shape for the eventual docs mirror. The hero scene is the **only** React island; everything else is plain Astro components.
- **Bun** — matches `../app`'s runtime.
- **TypeScript strict** — same flags as brainstorm (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Biome** — lint + format in one tool. Matches brainstorm. No ESLint, no Prettier.
- **Vanilla CSS + custom properties** — design tokens live in `src/styles/tokens.css`. No Tailwind runtime; no CSS-in-JS. Astro's scoped styles handle component-local rules.
- **three.js + @react-three/{fiber,drei,postprocessing}** — only inside `src/three/` and only loaded by the hero scene island. Patterns adapted from `../mysite/src/three/`.
- **Vitest** (unit) + **Playwright** (visual regression).

Adding a runtime dependency requires justification in the PR description. The bar is high: the entire site target is a static surface under 100 KB above the fold.

## Big-picture architecture

**Three principles that shape every file:**

1. **Zero JS above the fold, on every page.** The hero (`<h1>`, links, inline SVG mark) is pure HTML/CSS. The 3D scene mounts below the fold as a `client:visible` island, gated on `prefers-reduced-motion`, network conditions (`navigator.connection`), and pointer type. The site renders identically with JavaScript disabled — this is a CI-tested invariant, not aspirational.

2. **Content is data, not markup.** Capability tiles, comparison rows, segment copy, blog posts, changelog entries all live as typed Markdown under `src/content/` and are validated by zod schemas in `src/content/config.ts`. Pages render from collections; no copy lives in `.astro` files.

3. **The site mirrors `../docs/` — it does not paraphrase it.** The pricing page renders the pricing doc directly. The docs portal renders the docs corpus directly. The capability tiles each link to the design doc that authorises them. A page that introduces a claim with no design-doc citation does not pass review.

**Layout, top to bottom:**
- `src/pages/` — routes (file-based). Most are thin shells that pull from a content collection.
- `src/layouts/` — `Base.astro` (head, font preload, analytics-or-not) and `Article.astro` (long-form).
- `src/components/` — Astro components (zero JS); React TSX only when an island is required.
- `src/three/` — React Three Fiber scene + materials + scroll helpers. Only imported from `HeroScene.tsx`.
- `src/styles/` — `tokens.css` (palette + spacing + type scale), `reset.css`, `typography.css`, `prose.css`.
- `src/content/` — typed Markdown collections.
- `src/lib/` — `og.ts` (satori OG image builder), `analytics.ts`, content helpers.
- `scripts/` — build-time helpers (`build-og.ts`, `docs-mirror.ts`).
- `public/` — favicon, OG images (built artifact), inline-SVG asset sources.

## Visual identity

A condensed reference; the full spec is in [`docs/implementation-plan.md §3`](docs/implementation-plan.md#3-visual-identity).

**Palette** (defined in `src/styles/tokens.css`, derived directly from `../docs/art/icon/icon.svg`):

```
--bg-deep    #0d1626   navy base
--bg-mid     #1b2a44   navy top of gradient
--paper      #f4f6fb   off-white type + hero geometry
--cyan-core  #e8fbff   bolt tip / focus rings
--cyan-mid   #5cc8ee
--cyan-deep  #2b9bd1
--cyan-glow  #1ea8d6   radial halo behind the hero mark
--hairline   rgba(244,246,251,0.08)
```

**Type:** Inter (variable, weights 500/700) for sans; JetBrains Mono (400) for eyebrow labels and inline code; Instrument Serif italic for sparing emphasis. Self-hosted, subset, preloaded weight 500.

**Mark:** the **wireframe brain** from `../docs/art/icon/icon7.png`, redrawn as inline SVG. Three weights: full (hero, ~24 KB), simplified (nav), single-glyph (favicon, derived from `icon8/9` — the shipping lightning bolt).

**Hero scene** (below fold, gated): faceted icosahedron with simplex-noise vertex displacement (paper-white, flat-shaded, the "mind under thought") + low-opacity wireframe brain in cyan + cyan radial glow. Adopt the mysite recipe: `meshStandardMaterial` flat-shading, ACES tone mapping, bloom + vignette postprocessing. Mobile / reduced-motion / save-data all fall back to the static SVG above.

**Visual reference assets** (read-only; the site does not import these):
- `../docs/art/icon/icon0.png` … `icon9.png` — the icon evolution. `icon0–1` are the original brain+bolt; `icon7` is the wireframe brain that becomes our hero mark; `icon8–9` are the shipped simplified bolt that becomes our favicon.
- `../docs/art/wallpaper/stormy-sea.png` — the mood (weather as metaphor for thought; low-poly as the texture of structure-being-built).
- `../mysite/src/three/Scene.tsx`, `Form.tsx`, `Shards.tsx` — the technical reference for the hero scene. Same shading language, brainstorm-specific geometry.

## Hard constraints (from `46-marketing-and-promotion.md`)

These are not aspirational; CI fails the PR if you break them.

- **No third-party scripts.** No GA, no Hotjar, no Facebook Pixel, no Intercom, no Segment, no Calendly, no Stripe.js outside the (future) pricing surface, no embedded YouTube. If you need analytics, use self-hosted Plausible (Phase 2+).
- **No dark patterns.** No exit-intent popups, no countdown timers, no fake scarcity, no "1,247 people viewing this", no email gates on docs, no cookie banners obstructing content, no auto-playing video. The `46 §What we don't do` list is the canonical anti-pattern register.
- **No emojis in copy.** Inline SVG glyphs when a visual marker is needed. (The mysite-style `◇ ◆ ●` glyphs render as inline SVG, not Unicode.)
- **No marketing-speak.** No "synergise", no "unlock", no "10x your second brain", no "AI-powered" as a headline. A small linter in CI flags banned phrases.
- **Voice matches the design docs.** Same vocabulary, same posture. If a sentence wouldn't pass a code review for vagueness, it wouldn't pass marketing review either.
- **Renders identically without JavaScript.** Tested in CI by serving `dist/` to a no-JS Playwright run.
- **Positioning sentence is verbatim everywhere it appears.** Defined once in `src/content/positioning.ts` (or equivalent constant); pages import. Don't paraphrase.

## Conventions

- **File naming:** `kebab-case` for files and folders. React components are `PascalCase.tsx`; Astro components are `PascalCase.astro`; helpers are `kebab-case.ts`.
- **No default exports** for library code (named exports only). Astro pages are an exception (they default-export by Astro convention).
- **Strict TS.** No `any` without an `// eslint-disable`-style reason comment. `import type` for type-only imports. **`import { type Foo }` then `Foo.bar()` is forbidden** — esbuild strips it and you get a runtime undefined with zero tsc signal (same bug brainstorm's CLAUDE.md documents).
- **No raw string literals as discriminators.** Same rule brainstorm follows: enums or `as const` objects with derived union types. `case "alpha":` rejected; `case Phase.Alpha:` required.
- **No comments explaining WHAT.** Code reads itself. Comments only when the WHY is non-obvious (a perf constraint, a doc citation, a security invariant).
- **Every claim cites a design doc.** In capability tiles, comparison rows, segment copy: include a `source:` field in frontmatter pointing at `../docs/...`. PRs without citations get rejected.
- **Inline SVG over images** when the asset is geometric (mark, dividers, capability glyphs). Raster only for photographs (currently: none).
- **DRY everywhere.** Two call sites doing the same thing go through the same component / helper. Three is a hard ceiling. The `BrainMark`, `Divider`, `EyebrowLabel`, `Footer` are shared primitives — don't reinvent.

## How to make a change

1. **Check `docs/implementation-plan.md`** for the iteration ladder. Find the iteration that covers what you're about to do (or surface that there isn't one — most site work corresponds to an iteration).
2. **Check the relevant `../docs/` source** for the claim you're rendering. Copy the citation into the content frontmatter.
3. **Implement.** Stay inside the budgets — if you're about to load a font, a script, or a library, justify it against the 100 KB hero budget first.
4. **Run the gates:** `bun run typecheck && bun run lint && bun run test && bun run build && bun run lh && bun run size`. All green or the PR doesn't ship.
5. **Update `docs/implementation-plan.md`** in the same turn — mark the iteration done with a one-line note. Same workflow rule as brainstorm.

## What this CLAUDE.md does not cover

- The brainstorm shell architecture, IPC, capabilities, storage, vault, etc. — read `../app/CLAUDE.md` for that.
- How to write a brainstorm app — read `../docs/apps/08-app-sdk.md`.
- Git workflow / commit conventions — this repo isn't a git repository yet; conventions to be added when it becomes one.
