# 21 — Localization

This doc covers how Brainstorm handles user-facing language: what gets translated, what doesn't, the format and tooling, locale negotiation between shell and apps, and the trade-offs that emerged from the recurring pain in prior tools. Builds on [13-frontend-stack.md](../shell/13-frontend-stack.md) (which deferred i18n to this doc) and [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) (PropertySchemas have display hints that may or may not be translatable).

## What went wrong in prior tools

Localization is a chronic pain in prior tools of this shape, with several recurring causes:

- **Externalization was incomplete.** Strings leaked into UI components hardcoded; translators couldn't reach them; the surface was never "done".
- **Source string changes silently broke translations.** Renaming the English wording of a button left existing translations either stale (still showing the old wording) or empty (English fell through), without anyone noticing until users reported it.
- **No required context.** Translators saw a list of strings without knowing what the strings *did*. "Open" — open what? A door? A file? A relationship? Got mistranslated.
- **English-centric plural rules.** Code that branched on `count === 1 ? "1 item" : count + " items"` works for English; not for Russian, Polish, Arabic, Welsh, or any of the languages with three or more plural forms.
- **RTL was bolt-on, not structural.** Layouts that worked LTR broke when mirrored.
- **Dates / numbers / currencies inconsistent.** Different surfaces formatted dates differently; some used the user's locale, some used English defaults.
- **No mechanism for third-party / installable content.** When new content types were added (apps, plugins), their translations either had to be merged into the central catalog or shipped half-localized.
- **User content vs. UI content was conflated.** Notes were translated when they shouldn't have been; UI strings stayed English when they should have been localized.

Brainstorm's localization architecture is a deliberate response to each of these.

## Principles

1. **A string with no translation context is broken.** Tooling enforces context at extraction time.
2. **String identity is stable; English wording is not.** Renaming a string in the source doesn't invalidate its translations.
3. **User content is never translated.** Apps' UI is. Property names users invent stay in the language the user typed.
4. **Apps own their translations.** The shell does not aggregate per-app catalogs.
5. **Plural rules go through ICU MessageFormat.** No `count === 1` branching.
6. **RTL is structural.** Logical CSS properties throughout; no `margin-left` that wouldn't mirror.
7. **Locale is a shell-wide setting.** Apps follow the shell's choice and provide their own translations for it.

## What gets localized vs. what's user content

The boundary is the most important architectural decision in this doc. Crossing it badly is what bit prior tools.

| Surface                                                                                  | Localized? | Notes                                                          |
|------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------|
| Shell UI strings (menus, dialogs, settings labels, error messages)                       | ✓          | Bundled with the shell.                                         |
| App UI strings                                                                           | ✓          | Each app bundles its own translations.                          |
| Built-in vocabulary values shipped *by apps* (e.g. an app's pre-shipped Status list)     | ✓          | Vocabulary values have stable ids; labels are translation keys. |
| Entity-type schema display hints (the canonical type's "title" label etc.)               | ✓          | Translation keys in the BP type definition; resolved at render. |
| Date / number / currency / unit formatting                                               | ✓          | `Intl.*` APIs.                                                  |
| Pluralization                                                                             | ✓          | ICU MessageFormat.                                              |
| Help text and onboarding strings                                                         | ✓          |                                                                |
| Block protocol Hook and Service standardized prompts                                     | ✓          | Shell-rendered; localized by the shell.                         |
| Documentation                                                                            | ✓ (later)  | Phased; v1 ships English docs only.                             |
| —                                                                                        |            |                                                                |
| **User-created** PropertySchema names                                                    | ✗          | User's chosen string. If they typed "Stato" we keep "Stato".    |
| **User-created** Vocabulary values                                                        | ✗          | Same.                                                          |
| Entity content (Yjs rich text, text properties, etc.)                                    | ✗          | User content. Not touched.                                      |
| Entity property values that happen to be human-readable strings                          | ✗          | Same.                                                          |
| File / attachment names                                                                   | ✗          |                                                                |

The distinction is **who authored the string**: shell or app authors → localized; users → not localized.

### App-shipped vs. user-created vocabularies

A worked example. An app ships a baked-in Status vocabulary:

```jsonc
// vocabulary entity provided by io.example.tasks app, locale-aware
{
  "type": "brainstorm/Vocabulary/v1",
  "properties": {
    "nameKey": "io.example.tasks/vocab.Status.name",
    "values": [
      { "id": "todo",    "labelKey": "io.example.tasks/vocab.Status.values.todo",    "color": "gray"  },
      { "id": "doing",   "labelKey": "io.example.tasks/vocab.Status.values.doing",   "color": "blue"  },
      { "id": "blocked", "labelKey": "io.example.tasks/vocab.Status.values.blocked", "color": "red"   },
      { "id": "done",    "labelKey": "io.example.tasks/vocab.Status.values.done",    "color": "green" }
    ]
  }
}
```

The shell sees `labelKey` and resolves it through the app's translation catalog at the user's locale. Compare to a user-created vocabulary:

```jsonc
{
  "type": "brainstorm/Vocabulary/v1",
  "properties": {
    "name": "Mein Status",
    "values": [
      { "id": "vc-1", "label": "Anfangen", "color": "gray"  },
      { "id": "vc-2", "label": "Geht",     "color": "blue"  }
    ]
  }
}
```

`label` (literal) vs `labelKey` (translation reference) is the explicit distinction.

> **Decision:** every translatable string in app-shipped data is a `*Key` field referencing the app's translation catalog. User-created data uses literal `*` fields (`name`, `label`, `description`). The two are never mixed in the same field.

> **Decision:** the shell never tries to detect the language of user content or auto-translate it. If a user types in German and the UI is set to English, the user content stays German.

## String IDs are stable

The first architectural move. Every translatable string has a stable id, not an English-key.

```ts
// good: stable id
t("toolbar.save")
t("dialog.confirmDelete.body")

// bad: English-as-key
t("Save")
t("Are you sure you want to delete this?")
```

Reasons:
- Renaming the English copy doesn't invalidate translations.
- Reusing the same English text for two different surfaces (e.g. "Open" the verb on one button vs. "Open" the adjective on a status indicator) gets two separate ids and two independent translations.
- Translators see the id in their tools; they can't accidentally edit the source language.

> **Decision:** ids are **dotted reverse-domain** for app-shipped strings (`io.example.tasks/dialog.confirmDelete.body`) and **shell-namespaced** for shell strings (`shell/launcher.placeholder`). Collisions are impossible by construction.

## Required translation context

The second move. Every string has metadata that travels with it:

```ts
t("dialog.confirmDelete.body", {
  defaultMessage: "Are you sure you want to delete \"{name}\"? This cannot be undone.",
  description: "Body of the confirmation dialog when the user clicks Delete on an entity. {name} is the entity's display name. Tone: cautionary, not alarmist.",
  values: { name: entity.title },
});
```

The `defaultMessage` is the source-language string (English by default).
The `description` is **mandatory**. Tooling fails extraction if it's missing.
The `values` are interpolation parameters (and are part of the string's signature for plural/gender selection).

> **Decision:** missing `description` is a build error. Translators receive these descriptions in their tooling; they are part of the contract.

> **Open:** do we also require screenshots / context images for UI strings? Useful for translators, expensive to maintain. Tracked as OQ-52.

## ICU MessageFormat for plurals and genders

Hardcoded `count === 1 ? "X" : "Y"` is wrong; ICU MessageFormat is the standard:

```ts
t("inbox.unreadCount", {
  defaultMessage: "{count, plural, =0 {No unread} one {# unread} other {# unread}}",
  description: "Header showing how many unread items in the inbox. {count} is the integer count.",
  values: { count: unreadCount },
});
```

Languages with multiple plural forms (Polish, Russian, Welsh, Arabic) get their proper rules via `Intl.PluralRules` lookups inside the formatter. Translators write the plural variants natively in MessageFormat syntax.

> **Decision:** MessageFormat is the only string format. Concatenation in code (`"Hello " + name`) is a build error caught by lint.

> **Decision:** the runtime is **FormatJS** (`@formatjs/intl`) — battle-tested, ICU-compliant, native `Intl` integration, smallest credible bundle for the feature set.

## Tooling-enforced extraction

The third move — automation makes the rest possible:

- **Biome rule** (or ESLint plugin where Biome doesn't yet cover the case — see OQ-65) prohibits string literals in JSX text nodes and certain prop positions (configured per UI library).
- **`brainstorm-cli i18n extract`** scans the source tree, extracts every `t()` call into a JSON catalog with id, defaultMessage, description, and call-site location.
- **CI fails** on:
  - Strings without a description.
  - Hardcoded text that bypasses `t()`.
  - Strings present in the catalog but no longer referenced (dead translations are surfaced for review).
  - Source-string changes that should mark translations as stale (a content-hash on the source string is part of the catalog; changes flip a `staleTranslations: true` flag).

The catalog is checked into source control. Translation files (per-locale) are separate JSON files that translators (or services) edit.

> **Decision:** the source strings live in code (via `t()` calls); the catalog is generated; translation files are produced from the catalog. The flow is **code → catalog → translation files**, never the reverse.

## Per-app translation packs

The fourth move. The shell does not aggregate per-app translations.

```
my-app.brainstorm/
├── manifest.json
├── dist/...
├── i18n/
│   ├── en.json          // source language
│   ├── de.json
│   ├── ja.json
│   ├── es.json
│   └── ...
└── ...
```

When the user's locale is set to German:
- The shell loads its own `de.json`.
- Each running app loads *its own* `de.json` for its strings.
- The shell exposes the active locale to apps via `brainstorm.services.i18n.locale`.
- Apps use their own translation runtime (typically `@formatjs/intl` configured to point at their bundled catalogs).

If an app didn't ship `de.json`, it falls back through the chain (`de-AT` → `de` → app's source language, typically `en`). The user sees a slightly mixed-language UI (German shell + English-where-the-app-didn't-translate); flagged in app-store metadata as "partial localization".

> **Decision:** localization is per-app, not centralized. The shell does not host or merge app translation catalogs.

> **Decision:** apps declare which locales they ship in their manifest:
> ```jsonc
> "i18n": { "source": "en", "locales": ["en", "de", "ja", "es", "fr"] }
> ```
> The shell's app-store surface can filter and warn based on this metadata.

### Translation-runtime convergence

Both the shell and `@brainstorm/sdk` re-export the same FormatJS-based runtime, so apps use a consistent `t()` API. App authors can opt out and bring their own runtime, but the SDK provides the canonical path.

## Locale negotiation

```
   User's chosen locale (shell setting): "de-AT"
        │
        ▼
   Resolved chain: ["de-AT", "de", "en-US", "en"]
        │
        ▼
   Shell loads first chain entry that has a translation file.
   Apps load first chain entry that *they* shipped.
        │
        ▼
   `@formatjs/intl` configured per surface; t() resolves per locale.
```

> **Decision:** the locale **fallback chain** is `<requested>` → `<base of requested>` → `en-US` → `en`. Shell and apps both use the chain; they may resolve to different locales (shell speaks Austrian German, an app speaks generic German because it has no `de-AT` file — that's fine).

> **Decision:** locale is a single shell setting. Apps cannot pick their own locale. (Apps that *display* user content in multiple languages — like a translation app — are doing user-content rendering, which is a different concern.)

### Locale switching at runtime

Switching locale should not require restart. The shell broadcasts a `locale-changed` event; apps that handle it re-render with the new strings. Apps that ignore it pick up the change at next launch.

## Date / number / currency / unit

Use `Intl.*` APIs. Never hand-format.

```ts
const formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(d);
const formattedAmount = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(n);
```

> **Decision:** the SDK provides convenience hooks (`useFormatDate`, `useFormatNumber`, `useFormatCurrency`) wrapping `Intl.*` and bound to the active locale. Apps that use them get correct formatting for free.

## RTL and bidi

> **Decision:** all shell layout uses **logical CSS properties**: `margin-inline-start` not `margin-left`; `padding-block-end` not `padding-bottom`; `text-align: start` not `text-align: left`. Flipping is automatic for RTL locales.

> **Decision:** the design-token package (`brainstorm-tokens`) is RTL-aware: tokens like `space.indent` work in inline-start direction.

For mixed-direction content (an Arabic UI showing English content), `dir="auto"` on text-rendering elements lets the browser decide per-paragraph. User content is rendered with `dir="auto"` by default.

> **Open:** how do we test RTL coverage at scale? Visual diffs across RTL/LTR snapshots? Tracked as OQ-53.

## App-store presentation

Apps declare locales in metadata (per [14-app-store.md](../apps/14-app-store.md)). The app-store surface:

- Shows which locales an app ships in.
- Warns at install: "This app is fully localized for English; partial for German".
- Lets users filter the directory by locale support.

This makes localization quality a visible attribute, which incentivizes app authors to translate more.

## Phasing

> **Decision:** v1 ships with **the full architecture**: stable ids, required descriptions, ICU MessageFormat, FormatJS runtime, per-app catalog model, RTL-ready layout. **English-only** at launch. Other locales arrive as community / commercial translations land.
>
> The reason to ship the architecture in v1, even with one locale, is exactly the lesson from prior tools: bolting i18n on later means thousands of strings to chase down. Building it right from day one costs little extra; retrofitting costs a lot.
>
> **Update (2026-06-06, settings-overhaul — product-owner call, see OQ-21):** the "English-only at launch" stance is **lifted for the shell**. v1 now ships a **runtime language switch** in Settings → Language & Region: a locale-pack loader (`renderer/i18n/locale-pack-loader.ts`) resolves a pack via the shared fallback chain and applies it through `applyLocalePack(locale, pack)` (English base + overlay, so untranslated keys fall back); a top-level **`LocaleGate`** remounts the shell subtree on change so `t()` re-reads the catalog. **Machine-translated seed packs (`es`, `de`)** ship to prove the pipeline (partial coverage; flagged for human review). The chosen language is **per-vault (synced)**, so a second device inherits it. **Still pending (next iteration):** app-renderer propagation via `brainstorm.services.i18n.locale` + the `locale-changed` broadcast below, per-app translated catalogs, and the pre-vault surfaces (vault picker / lock screen render before a vault opens, so they stay on the last applied language).
>
> **Regional formats** are a separate, complementary control (Settings → Language & Region → Regional formats): hour cycle / date style / first-day-of-week / number locale / time zone, each defaulting to "automatic" (follow the OS). They thread through the shared `@brainstorm/sdk/date-formatters` `FormatContext`; the shell header clock honours them today, app-surface adoption rides the same `services.i18n` propagation.

| Capability                                              | v1   | v2  |
|---------------------------------------------------------|------|-----|
| Stable string ids                                       | ✓    | ✓   |
| Required descriptions                                   | ✓    | ✓   |
| ICU MessageFormat                                       | ✓    | ✓   |
| FormatJS runtime in shell + SDK                         | ✓    | ✓   |
| Per-app translation packs                               | ✓    | ✓   |
| Logical CSS / RTL-ready layout                          | ✓    | ✓   |
| `*Key` vs `*` literal field convention                  | ✓    | ✓   |
| Extraction CLI (`brainstorm-cli i18n extract`)          | ✓    | ✓   |
| CI enforcement (lint + missing-translation flags)       | ✓    | ✓   |
| Source-string change → stale flag                       | ✓    | ✓   |
| Locales shipped at v1                                   | en-US only | many |
| Translator-facing tooling integration (Crowdin / etc.)  | not blocking | likely |
| Documentation translation                                | —    | ✓ (community) |
| Screenshot context for translators                      | optional | recommended (OQ-52) |

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-52** — Screenshot/context images for translators: required, recommended, or optional?
- **OQ-53** — RTL test coverage strategy.
- **OQ-54** — Translation-service integration (Crowdin, Lokalise, weblate, custom): pick one or stay agnostic?
- **OQ-55** — Pluralization for languages with non-standard rules (Welsh: 6 forms; Arabic: 6; Russian: 4) — confirm FormatJS coverage for the locales we plan to support.

## Summary

- **String externalization is enforced by tooling**, not discipline (ESLint rule, build failure on missing context, CI on stale translations).
- **String ids are stable**; English wording is not. Reused English gets distinct ids for distinct surfaces.
- **Translation context is mandatory** — every string has a description; missing description = build error.
- **ICU MessageFormat** for plurals and genders. FormatJS as the runtime.
- **Apps own their translations**, bundled as per-locale JSON in their package.
- **Locale is shell-wide**; apps follow. Fallback chain `<requested>` → `<base>` → `en-US` → `en`.
- **RTL is structural** via logical CSS; design tokens are RTL-aware.
- **User content is never translated** — labels users invent, vocabulary values they create, entity bodies they write — all stay in the language they were authored in.
- **App-shipped vocabularies use `labelKey`**, user-created use `label`. The convention is enforced.
- v1 ships **architecture + en-US**; other locales arrive incrementally without retrofitting.
