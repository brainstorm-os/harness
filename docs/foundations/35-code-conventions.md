# 35 — Code conventions and contributor standards

This is a **contributor-facing** doc — different audience from the design docs. Where the design docs explain *what* Brainstorm is, this doc explains *how* code that fits should be written, organized, named, tested, and reviewed.

It's the synthesis of decisions scattered across [13-frontend-stack.md](../shell/13-frontend-stack.md) (tooling, libraries), [21-localization.md](../platform/21-localization.md) (string handling), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capability declarations), [29-credentials-storage.md](../security/29-credentials-storage.md) (crypto routing), and the personal-by-default principle in [01-vision.md](01-vision.md).

> **Note:** there's a brief `CONTRIBUTING.md` at the repo root pointing here. This doc is the canonical reference; CONTRIBUTING is the entry point.

## Naming conventions

### Files and folders

- **Source files:** `kebab-case` — `text-editor.ts`, `entity-list.tsx`, `use-y-doc.ts`.
- **Test files:** alongside source, `*.test.ts(x)` — `entity-list.test.tsx`. No `__tests__/` folders.
- **Folders:** `kebab-case` — `apps/text-editor/`, `shell/window-manager/`. Lowercase, no spaces, no dots.
- **Index / barrel files:** avoid except at package boundaries (top-level `src/index.ts`); large barrels defeat tree-shaking.

### Identifiers

| Kind                          | Convention            | Example                            |
|-------------------------------|-----------------------|------------------------------------|
| React components              | `PascalCase`          | `EntityList`, `LayoutEditor`       |
| React hooks                   | `useCamelCase`        | `useEntity`, `useYDoc`             |
| Functions / variables         | `camelCase`           | `formatDate`, `entityId`           |
| Constants (true constants)    | `SCREAMING_SNAKE_CASE` | `MAX_VAULT_SIZE_BYTES`            |
| Configuration / tokens        | `camelCase`           | `defaultTheme`, `iconRegistry`     |
| Types and interfaces          | `PascalCase`          | `Entity`, `PropertySchema`         |
| Generic type parameters       | Single letter or `T`-prefixed descriptive | `T`, `TEntity`, `K extends keyof T` |
| Enums and union members       | `PascalCase`          | `LayoutMode.Stacked`               |

> **Decision:** **no `I`-prefix on interface/type names.** `Entity`, not `IEntity`. Apps that follow C#-style conventions internally are fine; the SDK and shell don't.

> **Decision:** prefer `type` over `interface` except where declaration merging is required. `interface` is reserved for cases where extension is explicitly needed.

### Domain-specific identifiers

| Concept                      | Format                                    | Example                                   |
|------------------------------|-------------------------------------------|-------------------------------------------|
| Entity ids                   | `ent_<ULID>`                              | `ent_01HXKMZ7AB8CDEFGHIJKLMNOPQ`          |
| App ids                      | reverse-DNS                               | `io.example.text-editor`                  |
| Entity type URLs             | `<reverse-dns>/<TypeName>/v<n>`           | `io.example/Note/v1`                      |
| Block ids                    | `<app-id>/<block-name>`                   | `io.example.kanban/board`                 |
| Custom Lexical node ids      | `<app-id>/<node-name>`                    | `io.example.code/code-block`              |
| Capability names             | `<service>.<verb>[:<scope>]`              | `entities.read:io.example/Note/v1`        |
| Intent verbs                 | shell-curated, lowercase                   | `open`, `share`, `process`, `export`      |
| Translation keys             | `<owner-id>/<dotted.path>`                | `io.example.editor/dialog.confirmDelete.body` |
| Vault ids                    | `vlt_<ULID>`                              | `vlt_01HXKMZ...`                          |
| Window ids (per app)         | app-supplied short string or ULID         | `main`, `inspector`                        |
| URI scheme                   | `brainstorm://<authority>/<path>`         | per [31-linking-protocol.md](../platform/31-linking-protocol.md) |

These all live in the design docs; this is the consolidated lookup.

## Code structure

### Repository layout (monorepo)

```
brainstorm/
├── packages/
│   ├── shell/             ← the Electron shell + dashboard
│   ├── sdk/               ← @brainstorm/sdk (re-exports + worker shim)
│   ├── sdk-types/         ← @brainstorm/sdk-types (typings only)
│   ├── tokens/             ← brainstorm-tokens
│   ├── react-yjs/          ← Yjs ↔ React hooks
│   ├── editor/             ← brainstorm-editor (Lexical config)
│   └── cli/                ← brainstorm-cli
├── apps/                   ← first-party apps (text editor, file manager, etc.)
│   ├── text-editor/
│   ├── files/
│   ├── code-editor/
│   ├── form-designer/
│   └── theme-editor/
├── docs/                   ← design docs (this set)
├── package.json            ← Bun / pnpm workspace root
└── README.md
```

> **Decision:** **Bun workspaces** for the development monorepo (per [13-frontend-stack.md](../shell/13-frontend-stack.md) tooling). Each package has its own `package.json`, `tsconfig.json`, and standalone build.

> **Open:** if Bun's workspace support has rough edges at the time of first build, fall back to pnpm. Tracked as OQ-151.

### Per-package structure

```
packages/<name>/
├── src/
│   ├── index.ts            ← public API barrel (and only here)
│   ├── <feature>/
│   │   ├── *.ts(x)         ← feature implementation
│   │   ├── *.test.ts(x)    ← tests alongside source
│   │   └── types.ts         ← per-feature types if substantial
│   └── shared/             ← shared internal utilities
├── package.json
├── tsconfig.json
└── README.md               ← what's this package, who uses it
```

> **Decision:** **feature folders** over type-of-thing folders. `src/window-manager/` and `src/entities/`, not `src/components/` and `src/hooks/`. Co-locate code that changes together.

> **Decision:** **only the package root `src/index.ts` is a barrel.** Internal feature folders may have a local `index.ts` for that feature's surface, but no transitive reexports.

### Shared components — reuse before you write (the SDK reuse rule)

Brainstorm is an app-development framework: first-party apps and third-party developers build against the **same** library, `@brainstorm/sdk`. The rule:

> **Any UI element or piece of logic that exists in ≥2 apps is ONE shared SDK module. Reuse it; never reimplement it.**

- **Before writing a component / helper / list row / popover / formatter / picker / icon / data-access layer, check the [SDK component catalog](../apps/09-shared-sdk-catalog.md) and `packages/sdk/package.json`'s `exports` map.** If it exists, import it from its documented subpath.
- **Extract at copy two.** The first time you'd copy-paste something from one app into another, move it to the SDK instead (this generalises the *no abstraction without two uses, three is a hard ceiling* rule below). The catalog exists because this was missed repeatedly — `panelToggleIcon` shipped 8×, the searchbar 7×, `frustum.ts` / `language-detect.ts` each verbatim twice.
- **Component CSS lives in the SDK**, exported as a subpath (e.g. `@brainstorm/sdk/searchbar/searchbar.css`), never re-declared in an app's `styles.css`.
- A PR that reimplements something already in the catalog, or copy-pastes UI chrome between apps instead of extracting, is **rejected**. Over-extraction is also a smell — see the catalog's *What is deliberately not shared* for the app-specific adapters that correctly stay local.

### Imports

Order and grouping:

```ts
// 1. External packages (alphabetical)
import { useEffect } from "react";
import * as Y from "yjs";

// 2. @brainstorm/* internal packages (alphabetical)
import { entities } from "@brainstorm/sdk";
import type { Entity } from "@brainstorm/sdk-types";

// 3. Other workspace packages (alphabetical)
import { useYDoc } from "react-yjs";

// 4. Local relative imports (alphabetical)
import { LayoutCell } from "./layout-cell";
import { resolveProperty } from "./resolve-property";
```

> **Decision:** **type imports use `import type`** to keep the runtime emit clean and to enable better tree-shaking.

> **Decision:** **no default exports for library code.** Named exports only — easier refactoring (renames don't silently break consumers), better discoverability via grep/IDE.

> **Decision:** **no implicit cycle imports.** Biome flags them (or a separate check via `madge` if Biome doesn't yet — per OQ-65). Cycles are a code-smell but allowed via lint-disable for genuine cases.

## Code style

Enforced by Biome (per [13-frontend-stack.md](../shell/13-frontend-stack.md)). Below are the manually-decided defaults beyond Biome's recommendations.

### TypeScript

```jsonc
// tsconfig base (extended by every package)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,   // pragmatic; allow x.foo on indexed types
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "es2022",
    "jsx": "react-jsx"
  }
}
```

> **Decision:** `strict: true` always. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` always — these catch real bugs.

### Errors and async

- **Throw structured errors.** Never throw strings. The SDK exports typed error classes (`CapabilityDenied`, `NotFound`, `Conflict`, `Unavailable`, `Invalid`); shell and apps reuse these where appropriate.
- **Async/await over `.then()`.** No mixing.
- **Don't swallow errors.** A `catch` that doesn't either re-throw, return a typed error result, or log + degrade is a bug.

### Comments

Per the project's no-comments-for-WHAT default (per the harness's working-style guidance):

- **Default to no comment.** Code reads itself if names are good.
- **Add a comment only when the WHY is non-obvious** — a hidden constraint, a workaround for a specific bug (with link to issue or PR), behavior that would surprise a reader, a non-obvious invariant.
- **No comments referencing PR / issue numbers** unless the comment is explaining a workaround that lasts beyond resolution.
- **No `// removed X` placeholders.** Delete or use git history.
- **JSDoc on exported functions in shared packages** (SDK, tokens, fancy-menus reexports). Internal-only code: optional.

### Booleans and naming

- Boolean variables / props: `isX`, `hasX`, `canX`. No `should` (prefer imperative names).
- Boolean function names: predicate-shaped — `isValid()`, `hasCapability()`.
- Negations sparingly: prefer `if (!isReady)` over a `isNotReady` field.

### Enums, not raw string literals

Anywhere a string is a **discriminator, kind, mode, status, verb, or any value drawn from a known small set**, declare a TS string enum (or `const X = { ... } as const` with a derived union type) and reference it by name at every use site — both the type declaration and every `case` / `===` / object literal.

```ts
// ✗ bad — raw literals repeated across files
type WallpaperKind = "solid" | "gradient" | "image";

switch (wallpaper.kind) {
	case "solid": ...
	case "gradient": ...
	case "image": ...
}

// ✓ good — single source of truth
export enum WallpaperKind {
	Solid = "solid",
	Gradient = "gradient",
	Image = "image",
}

switch (wallpaper.kind) {
	case WallpaperKind.Solid: ...
	case WallpaperKind.Gradient: ...
	case WallpaperKind.Image: ...
}
```

> **Decision:** repeated string literals are rejected — they make refactors fragile, grep noisy, and let typos compile silently. Enums centralise the literal and force every reference through a named symbol.

Practical notes:

- **String enums only** — `Solid = "solid"`, not numeric. Wire format (IPC, JSON, SQLite) stays as the string, so the enum value *is* the serialisation.
- **No `const enum`** — incompatible with `isolatedModules` and bundler typechecking.
- **`const X = { ... } as const` is an acceptable equivalent** when TS enum runtime emission causes bundle-size or interop friction (no runtime object exported, just the derived type). The call-site contract is identical.
- **Existing string-literal unions** in the codebase (`DashboardIconKind`, opener kinds, etc.) are migration debt — refactor them when adjacent code is touched; don't block an unrelated PR on a sweeping rewrite.

### Keyboard handling

Every keyboard interaction in the renderer flows through the **shortcut registry** per [`24-keyboard-shortcuts.md`](../shell/24-keyboard-shortcuts.md). Raw `e.key === "Escape"` / `e.key === "Enter"` / `e.key === "Arrow…"` listeners are forbidden in new code; the registry is the single source of truth for what each key does so it stays user-rebindable, conflict-checked, and visible in the cheatsheet.

```ts
// ✗ bad — raw key check; not rebindable; invisible to users
const onKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Escape") onClose();
};

// ✓ good — declared in the shortcut registry, bound via the renderer hook
useShortcut("shell/close-popover", onClose);

// ✓ also good — for chords scoped to a specific app surface
useShortcut("io.example.editor/save", onSave, { scope: "window" });
```

> **Decision:** the **only** acceptable raw-key code is inside the renderer-side shortcut delivery hook itself (the one place we translate browser KeyboardEvents to action ids). Everywhere else: declare an action, bind via the hook.

This rule covers: dialog/popover dismissal (`Escape`), list navigation (`Arrow…`), confirmation (`Enter`), tab cycling (`Tab` / `Shift+Tab`), and every modifier-chord. Even seemingly trivial keys (`Escape closes me`) deserve a declared id so the cheatsheet lists them and the user can rebind.

Existing raw `e.key` sites in `packages/shell/src/renderer/` are tech-debt to migrate when the renderer-side `useShortcut` hook lands (Stage 7b iteration prior to any new keyboard-bound component); new code does not add to that debt.

### Localization: wrap every user-visible string

Every string a user can see is wrapped in the translate function `t(key)` from day one, never as a bare string literal. Retrofitting i18n at Stage 12 is enormously expensive — wrapping each new string costs nothing at write-time and keeps the project ready for translation work whenever it lands.

```tsx
// ✗ bad — bare string; cannot be translated
<button onClick={onSave}>Save</button>

// ✓ good — string id, locale-resolved
<button onClick={onSave}>{t("shell.actions.save")}</button>
```

The `t()` function is implemented in `packages/shell/src/renderer/i18n/t.ts`. Until the full ICU / pack-loading machinery lands per [`21-localization.md`](../platform/21-localization.md), `t(key)` may fall back to a manifest of English defaults keyed by id — the **string contract is the id**, not the value. When the locale layer arrives, only the loader changes.

> **Decision:** no exceptions. Even one-off strings ("Loading…", "Untitled", "No results") use `t()`. The rare exception — a hardcoded brand name like "Brainstorm" — is acceptable as a literal since it doesn't translate.

Lint enforcement (Stage 8, when the renderer surface grows): a custom Biome rule flags string literal children inside JSX text nodes for `*.tsx` files under `renderer/`, with an allowlist for known non-translatable tokens (numbers, single-character punctuation, names).

### Floating surfaces are height-bounded; their lists virtualize

Every floating surface (overlay panel, popover, dialog, dropdown, menu) **caps its height to the viewport** — `max-height: min(<comfortable-cap>, calc(100vh - var(--space-8)))` on the panel, with the scrollable region `flex: 1; min-height: 0; overflow-y: auto` inside. A surface that sizes to its content grows off-screen the moment its content does; the Bin shipped exactly this bug (a content-bound panel that ran past the bottom of the display). The cap is not optional and not a polish pass — it's a property of the panel chrome from the first build, like the 44px header baseline.

Any list inside a height-bounded surface (or anywhere else) **virtualizes by default** via `@tanstack/react-virtual` — see *Virtualize lists by default*. The only exception is a small, bounded menu (launcher hits, context menus, mention typeahead, tabs). Anything whose row count is bound by vault or user-input volume virtualizes at first build; retrofitting it later costs orders of magnitude more.

> **Token-scale footgun.** `var(--space-N)` for an `N` past the end of the scale (it tops out at `--space-8`) is **not** a CSS error — it resolves to an undefined variable, which invalidates the *entire* declaration at computed-value time, so the rule is silently dropped with no build/typecheck signal. This is how the Bin's `max-height` (written against a nonexistent `--space-10`) evaporated and the panel grew unbounded; the same silently voided `--space-1_5` paddings on the object-menu and calendar surfaces. `packages/tokens/src/space-scale-usage.test.ts` now fails the build on any out-of-range `--space-*` reference across all renderer/app CSS. Never reference a space step the scale doesn't define.

### Type hierarchy: names at the body size, `sm` for secondary only

`--text-size-sm` (12px) is **secondary** text: list-row meta and descriptions, captions, hints, timestamps. A primary **name/title** in a list row reads at the common body size `--text-size-md` (14px) — never `sm`. Defaulting a whole surface to `sm` flattens the name/meta hierarchy so names read as supporting text; the canonical row pattern is name = `--text-size-md` + `--color-text-primary`, meta = `--text-size-sm` + `--color-text-tertiary`. Panel and section headings step up to `--text-size-lg` and above. Every `font-size` still comes from a `--text-size-*` token — no raw px (see [`36-design-system.md`](../shell/36-design-system.md)).

## Testing

### Test runners

- **Vitest** for unit and component tests (per [13-frontend-stack.md](../shell/13-frontend-stack.md)).
- **Playwright** for end-to-end against built shell.
- **`@vitest/coverage-v8`** for coverage.

### Coverage

| Package class                    | Coverage target |
|----------------------------------|-----------------|
| Shell core (window manager, IPC broker, entities service) | ≥ 85% |
| SDK packages (sdk, sdk-types, react-yjs, editor)        | ≥ 80% |
| First-party apps                 | ≥ 70%           |
| Third-party app track            | not enforced (recommended)  |
| `_review/` artifacts             | n/a             |

> **Decision:** coverage targets are floors, not ceilings. PRs that drop coverage below the floor are rejected; PRs that raise coverage are good.

### Test structure

- Co-locate: `entity-list.test.tsx` next to `entity-list.tsx`.
- One assertion concept per test; multiple `expect` is fine if they assert the same conceptual thing.
- Test names describe behavior: `it("rejects writes with insufficient capability")`, not `it("test 1")`.

### Test ids for E2E

- `data-testid` attributes for stable selectors. Format: `<feature>-<element>` — `entity-list-row`, `launcher-input`.
- Never depend on CSS class names or layout structure for selectors.

## Git and contribution

### Commit messages

> **Decision:** **Conventional Commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `style:`, `build:`, `ci:`. Required for the trunk; freer-form on feature branches.

Format:
```
<type>(<scope>): <short summary>

<body>

<footer (BREAKING CHANGE, refs)>
```

Example:
```
feat(entities): add getMany batched read

Implements OQ-102. Reduces broker round-trips for list-shaped UIs from N
calls to one.

Refs OQ-102.
```

### Branches

> **Decision:** trunk-based with short-lived feature branches.
> - `main` — always shippable.
> - Feature branches: `feature/<short-name>` or `fix/<short-name>`.
> - PRs target `main`; squash-merge by default.

### PR template

```markdown
## What this changes
<2-3 sentences>

## Why
<link to design doc / OQ being resolved / bug>

## Capability changes
<None | New capabilities requested: ... | Capability scope changed: ...>

## Localization
<None | New strings added; en.json updated>

## Tests
<unit | component | e2e | none — and reason if none>

## Performance
<no expected impact | budget X is affected; profiled at: ...>

## Breaking changes
<None | Migration path: ...>
```

### Code review

Reviewers check:

1. **Design-doc alignment.** Does this match the relevant design doc? If not, did the design doc need to change first?
2. **Capability surface.** New capabilities? Properly declared? Necessary scope?
3. **Localization.** Any user-facing strings going through `t()`?
4. **Personal-by-default.** New customizations default to `user` scope?
5. **Tests.** Coverage at or above the package's floor?
6. **Performance.** Anything that could hit a budget per [12](../shell/12-shell-architecture.md), [13](../shell/13-frontend-stack.md), [18](../data/18-storage-and-search.md)?

## Required compliance per existing docs

These are non-negotiable; CI enforces where possible:

| Concern                    | Source                                                | Enforcement                                |
|----------------------------|-------------------------------------------------------|--------------------------------------------|
| Localization               | [21-localization.md](../platform/21-localization.md) | Biome (or ESLint plugin) bans hardcoded JSX text; `t()` calls require `description` |
| Bundle size                | [13-frontend-stack.md](../shell/13-frontend-stack.md) | `size-limit` per package on every PR        |
| Accessibility              | [13-frontend-stack.md](../shell/13-frontend-stack.md) | `react-aria` for non-menu primitives; visual-regression diffs include RTL |
| Security: crypto routing   | [29-credentials-storage.md](../security/29-credentials-storage.md) | Lint rule banning direct platform-keystore-API imports outside the credential-store package |
| Security: capability declarations | [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) | Manifest validator; capability scope review in PR |
| Personal-by-default        | [01-vision.md](01-vision.md) Principle 9              | Code review                                |
| Reading order on layouts   | [27-layouts.md](../shell/27-layouts.md)              | Layout entity validator                    |
| Translation context        | [21-localization.md](../platform/21-localization.md) | CI fails on missing `description`           |

## Tooling

| Tool                | Use                                                | Config                                  |
|---------------------|----------------------------------------------------|-----------------------------------------|
| Bun (or pnpm — OQ-151) | Workspace, package management, scripts           | `package.json` workspaces               |
| Biome               | Lint + format                                       | `biome.json` at repo root               |
| TypeScript          | Type checking; project references                  | per-package `tsconfig.json` extending root base |
| Vite + Rollup       | Dev / build                                         | per-package `vite.config.ts`            |
| Vitest              | Unit + component tests                              | per-package `vitest.config.ts`          |
| Playwright          | E2E                                                 | top-level `e2e/` directory              |
| `@vitest/coverage-v8` | Coverage                                          | enforced in CI                          |
| `size-limit`        | Bundle-size budgets                                | per-package `.size-limit.json`          |
| `madge`             | Cycle detection (until Biome covers, OQ-65)         | CI check                                |
| `brainstorm-cli`    | Scaffolding for app authors                         | published as `@brainstorm/cli`          |

## What's NOT enforced (and why)

- **No author tags / copyright headers** in source files. Git history is authoritative; headers rot.
- **No commit message length cap** beyond Conventional-Commit type prefix. Long bodies are fine when needed.
- **No alphabetical-property ordering** in object literals. Logical grouping > alphabetical.
- **No file-size cap.** A 1000-line file is fine if it's one cohesive concept; a 50-line file of fragmented concepts is worse.

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-151** — Bun workspaces vs pnpm workspaces — pick after first real workspace setup attempt.
- **OQ-152** — Cycle detection: is Biome's coverage adequate at the time of first ship, or do we keep `madge` as a separate check?
- **OQ-153** — JSDoc requirement for SDK exports: just-the-name + types adequate, or full `@param` / `@returns`?

## Summary

- **Files:** kebab-case. **React components / types:** PascalCase. **Functions / variables:** camelCase. **Constants:** SCREAMING_SNAKE_CASE.
- **Bun workspaces** monorepo; **feature folders** within packages; **only package-root barrels**.
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`**.
- **Conventional Commits**; trunk-based development; PR template lists capability/localization/test/perf changes.
- **Coverage floors** per package class (85% shell core, 80% SDK packages, 70% first-party apps).
- **Required compliance** with localization, bundle-size, accessibility, crypto routing, capability declarations, personal-by-default — enforced by CI where possible.
- **Comments default to none**; only the WHY when non-obvious.
- A repo-root `CONTRIBUTING.md` points here.
