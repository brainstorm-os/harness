# 25 — Settings architecture

Settings in Brainstorm follow the same layered approach as schemas (per [19-properties-and-schemas.md](../data/19-properties-and-schemas.md)) and shortcuts (per [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md)): **OS-level shell settings + per-app settings + (v2) org-level defaults**, all surfaced through one unified shell-owned settings window. Settings are personal by default per the principle in [01-vision.md](../foundations/01-vision.md).

Builds on [04-shell.md](04-shell.md) (shell as host of settings as a privileged surface) and [08-app-sdk.md](../apps/08-app-sdk.md) (apps register panels via `ui.setSettingsPanel`).

## Goals

1. Users find every setting in one place — no per-app settings windows scattered across the system.
2. Apps own their settings semantically (the editor knows what its settings mean) but render them in the shell-owned settings window.
3. Settings sync across the user's devices.
4. Org admins (v2) can set defaults; users override locally.
5. Reset-to-defaults is a first-class operation, per-section.

## The layered model

```
   ┌────────────────────────────────────────────────────────────────────┐
   │  EFFECTIVE SETTINGS (what apps actually read at runtime)            │
   │     = shell-default ∪ app-default ∪ org-overlay ∪ user-overlay     │
   │     more-specific layers win                                        │
   └────────────────────────────────────────────────────────────────────┘
                                   ▲
   ┌───────────────────────────────┴──────────────────────────────────┐
   │  USER OVERLAY      personal-by-default; user-scoped entity         │
   │    (Yjs doc; syncs across user's devices)                          │
   └────────────────────────────────────────────────────────────────────┘
                                   ▲
   ┌───────────────────────────────┴──────────────────────────────────┐
   │  ORG OVERLAY (v2)  org admins set defaults / required values       │
   │    (org-scoped entity; member's user overlay can override unless   │
   │     org marks a setting as locked)                                 │
   └────────────────────────────────────────────────────────────────────┘
                                   ▲
   ┌───────────────────────────────┴──────────────────────────────────┐
   │  APP DEFAULTS      apps ship reasonable defaults in their manifest │
   └────────────────────────────────────────────────────────────────────┘
                                   ▲
   ┌───────────────────────────────┴──────────────────────────────────┐
   │  SHELL DEFAULTS    bundled with the shell                          │
   └────────────────────────────────────────────────────────────────────┘
```

> **Decision:** the resolution order is **shell-default → app-default → org-overlay → user-overlay**, with each higher layer overriding the prior. Org admins may mark specific settings as **locked** (user cannot override) for compliance scenarios; locked settings are visibly marked in the UI.

## Settings as data

Like properties, settings are typed values with explicit schemas. The shell ships a `SettingsSchema` model parallel to PropertySchema:

```jsonc
{
  "type": "brainstorm/SettingsSchema/v1",
  "properties": {
    "owner": "io.example.editor",       // app id, or "shell" for shell settings
    "section": "appearance",            // grouping within the owner's settings
    "key": "lineHeight",                // the setting's stable id
    "valueType": "number",              // reuses property value types from 19
    "default": 1.5,
    "range": { "min": 1.0, "max": 2.5 },
    "precision": 2,
    "label":   { "$key": "io.example.editor/settings.lineHeight.label" },
    "description": { "$key": "io.example.editor/settings.lineHeight.description" }
  }
}
```

Reusing the property-system primitives (value types, modifiers, vocabularies, display options) means the same constructor-like editor and validation pipeline works for settings.

> **Decision:** settings reuse the property model (six base value types + modifiers + vocabularies + display) from [19-properties-and-schemas.md](../data/19-properties-and-schemas.md). One conceptual machinery; one set of UI components.

## Where settings live (storage)

Settings values are stored in two entities per scope:

- **Shell settings**: `brainstorm/Settings/shell/v1` — one entity, user-scoped (per device or per user — see OQ-76).
- **App settings**: `brainstorm/Settings/app/v1` per app — one entity per installed app, user-scoped.
- **Org settings (v2)**: `brainstorm/Settings/org/v1` — org-scoped, accessible to org members.

Each entity holds a flat `values` map keyed by `<section>/<key>`:

```jsonc
{
  "type": "brainstorm/Settings/app/v1",
  "properties": {
    "appId": "io.example.editor",
    "values": {
      "appearance/lineHeight": 1.6,
      "appearance/showLineNumbers": true,
      "behavior/autosaveDelayMs": 2000
    },
    "scope": { "kind": "user", "target": "<user-id>" }
  }
}
```

A setting only appears in `values` if the user (or org) has overridden the default. Defaults are not duplicated.

> **Decision:** settings entities only store **deltas from default**. Reset-to-default for a key is just removing the key from `values`. Storage stays small; new app defaults propagate to users who haven't customized.

## App registration

Apps declare their settings schema in their manifest:

```jsonc
"settings": {
  "sections": [
    {
      "id": "appearance",
      "label": { "$key": "io.example.editor/settings.appearance" },
      "icon": "palette",
      "schema": [
        { "key": "lineHeight",       "valueType": "number", "default": 1.5, "range": { "min": 1.0, "max": 2.5 }, "label": { "$key": "..." } },
        { "key": "showLineNumbers",  "valueType": "boolean", "default": true, "label": { "$key": "..." } }
      ]
    },
    {
      "id": "behavior",
      "label": { "$key": "io.example.editor/settings.behavior" },
      "schema": [
        { "key": "autosaveDelayMs", "valueType": "number", "default": 2000, "range": { "min": 500, "max": 30000 } }
      ]
    }
  ]
}
```

The shell auto-renders these into the settings window using property-system display logic. Apps that need custom rendering for one or more settings can register a custom React component via `ui.setSettingsPanel(component)` per section; the shell mounts it in the appropriate slot.

> **Decision:** declarative-settings-via-manifest is the default; custom-component panels are an opt-in for the rare setting that needs special UI.

## Reading settings

Apps read settings via the SDK:

```ts
const lineHeight = await brainstorm.services.settings.get("appearance/lineHeight");        // returns the effective value (with overrides applied)
brainstorm.services.settings.subscribe("appearance/lineHeight", value => { /* react */ });

// bulk read
const all = await brainstorm.services.settings.getAll("appearance");                       // entire section
```

The settings service composes layers (shell-default → app-default → org-overlay → user-overlay) on read; apps see one resolved value.

## Writing settings

Apps write settings on behalf of the user (typically through the settings UI, but apps may also offer "save current state as preference" affordances):

```ts
await brainstorm.services.settings.set("appearance/lineHeight", 1.6);
await brainstorm.services.settings.reset("appearance/lineHeight");                          // remove user override
```

Writes go to the user-overlay entity (creating it if needed). They sync across the user's devices via Yjs.

> **Decision:** an app can only write to **its own** settings namespace (`<app-id>/...`). Writing to another app's or the shell's settings is rejected.

> **Decision:** writes to org-locked settings throw `Forbidden`. Apps should check the lock state before offering an edit affordance — exposed via `settings.metadata("appearance/lineHeight").locked`.

## The unified settings surface

The shell's Settings window has a single navigation column with sections grouped by source:

- **Brainstorm** (shell settings) — Account, Appearance, Privacy, Sync, Notifications, Defaults, Storage, Shortcuts, AI, Advanced.
- **Apps** (one entry per installed app) — each app's `sections` from its manifest.
- **Organization** (v2, when in an org) — org-managed defaults (read-only display).

Search across all settings (label + description) is at the top. Reset-to-default is per-setting (right-click) and per-section (toolbar button).

> **Decision:** the Settings window is **a privileged shell surface**, not an app. Reasoning matches the dashboard's reasoning ([04-shell.md](04-shell.md)): it must work even when no apps are installed, and it must be incapable of being replaced by an arbitrary app.

> **Decision:** apps cannot open their own settings windows. They can deep-link to their section in the shell's settings via `intents.dispatch({ verb: "open", payload: { kind: "settings-section", appId, sectionId } })`.

## Shell settings (the canonical set)

What the shell itself exposes as settings:

| Section          | Examples                                                                                       |
|------------------|------------------------------------------------------------------------------------------------|
| **Account**      | Identity (sovereign / consumer / org), recovery options, sign-out, link account.                |
| **Appearance**   | **Mode** (Light / Dark / Auto-follows-OS) — top-of-section segmented control; **pair slots** — two side-by-side cards for the Light and Dark pairs, each holding a theme picker (filtered to themes whose `TokenSet.appearance` matches the slot) + a wallpaper picker (solid / gradient / uploaded image). Plus scheme-neutral globals: **icon pack** (user-pickable from the bundled set + sideloaded packs — see [13 §Icon packs](13-frontend-stack.md) and [36](36-design-system.md)), typography, density, reduced motion. Full model in [36 §Appearance modes & pair slots](36-design-system.md#appearance-modes--pair-slots); mode is per-device, pairs are per-vault (see [OQ-156](../reference/11-open-questions.md#oq-156--theme-persistence-scope)). Wallpaper picker currently surfaced as a dashboard toolbar popover (Stage 7.9); migrates into this section once the Settings overlay completes in Stage 8. |
| **Sync**         | Devices paired, sync transport, hosted relay, attachment cloud quota, last-sync timestamps.     |
| **Privacy**      | E2E preferences, audit log access, tracking opt-outs, telemetry (off by default).                |
| **AI**           | Default provider, BYO API keys, per-app quotas, prompt-injection-filter aggressiveness, local-model selection. |
| **Notifications**| Per-app notification permissions; quiet hours; sound; do-not-disturb override.                  |
| **Defaults**     | Default app per `(verb, type)` (per [17-interoperability.md](../platform/17-interoperability.md)); default new-entity types. |
| **Shortcuts**    | Full rebinding UI (per [24-keyboard-shortcuts.md](24-keyboard-shortcuts.md)).                   |
| **Storage**      | Disk usage by category, sync policy (selective sync per device), compaction status, manual VACUUM. |
| **Locale**       | Active locale (per [21-localization.md](../platform/21-localization.md)), date / number / currency display preferences. |
| **Advanced**     | Developer mode toggle (sideload), audit-log viewer, performance counters, reset to defaults.    |

Each shell section has its own settings schema, declared in the shell's bundle.

## Per-device vs per-user settings

Some settings are inherently per-device (sync transport endpoint, selective-sync policy, local-model location); others are inherently per-user (theme preference, locale, AI provider keys). The schema marks each:

```jsonc
{ "key": "sync/policy", "valueType": "...", "scope": "device", "default": ... }
{ "key": "appearance/theme", "valueType": "entityRef", "scope": "user", "default": ... }
```

Per-device settings are stored in a local-only entity (does not sync). Per-user settings are in a synced user-scoped entity.

> **Open:** the boundary between per-device and per-user is sometimes ambiguous (e.g. should "sound on/off" follow the user across devices or be per-device?). Default: per-user unless the setting is structurally device-bound. Tracked as OQ-76.

## Reset and migration

- **Reset one** — removes the key from the user-overlay entity; the effective value falls back to default.
- **Reset section** — bulk-removes all keys for a section.
- **Reset all** — removes the entire user-overlay entity (with confirmation).
- **App update changes a default** — existing user overrides are preserved; users who hadn't overridden see the new default automatically.
- **App update removes a setting** — the orphaned override stays in the user-overlay entity (similar to property-removal in [19-properties-and-schemas.md](../data/19-properties-and-schemas.md)) under "(removed)" until the user chooses to clean it up.

> **Decision:** removing a setting from an app's schema does not delete the user's stored override. Re-adding the same `(section, key)` reattaches it.

## Org-level (v2)

For organizations:

- The org admin maintains a `brainstorm/Settings/org/v1` entity per app or per shell area.
- Members see the org-overlay layered under their personal user-overlay.
- Settings can be marked **locked** (`locked: true`) — members cannot override; the org's value is enforced.
- Settings can be marked **suggested** — org's value is the default, but members can change.
- Settings can be **freely user-overridable** — org provides a default; user fully controls.

> **Decision:** org admins cannot read user-overlay settings (privacy). They can set defaults; they cannot inspect what an individual member has chosen.

> **Open:** when a user leaves an org, what happens to settings overrides that were org-scoped? They simply disappear from the layered resolution, falling back to app/shell defaults — the user's personal overrides stay. Tracked as OQ-77.

## Phasing

> **Decision:** v1 ships the layered model (shell-default → app-default → user-overlay), all-shell sections, app-section registration, search, reset, sync. v2 adds org-overlay and locked settings.

| Capability                              | v1 | v2 |
|-----------------------------------------|----|----|
| Layered model (shell + app + user)      | ✓  | ✓  |
| Settings schemas via manifest            | ✓  | ✓  |
| Custom panel via `ui.setSettingsPanel`   | ✓  | ✓  |
| Search across all settings              | ✓  | ✓  |
| Reset per-setting / per-section         | ✓  | ✓  |
| Per-device vs per-user scope marker     | ✓  | ✓  |
| Sync via Yjs                            | ✓  | ✓  |
| Org-overlay + locked settings           | —  | ✓  |
| Settings export/import                  | post-v1 | ✓ |

## Open questions surfaced by this doc

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-76** — Per-device vs per-user default policy when ambiguous.
- **OQ-77** — Settings cleanup when a user leaves an org (preserved? removed? prompt?).
- **OQ-78** — Settings export/import (manual user backup; v1 nice-to-have or post-v1?).
- **OQ-79** — Should the search ranking surface descriptions (so users find a setting by what it does, not just its label)? Probably yes; design open.

## Summary

- **One unified shell-owned settings window** — apps don't open their own.
- **Layered resolution**: shell-default → app-default → org-overlay (v2) → user-overlay; more-specific wins; org-locked settings deny user override.
- Settings are typed via the same machinery as properties ([19-properties-and-schemas.md](../data/19-properties-and-schemas.md)) — six value types, modifiers, vocabularies.
- Apps register sections in their manifest; the shell auto-renders. Custom panels for special cases.
- **Settings are personal by default** — user-scoped Yjs entities sync across devices; orgs can set defaults in v2 without seeing personal overrides.
- Reset-to-default removes the user override; storage is delta-from-default.
- v1 ships the full single-user / multi-device flow; org overlay arrives in v2.
