# Universal icon model

Every "thing" that has a face in the UI — installed app, dashboard pin, entity, property type, dictionary item, tag, even a single note — can carry an **icon**. There is exactly one shape for that icon, and exactly one picker.

## Shape

```ts
export enum IconKind {
  Pack = "pack",
  Emoji = "emoji",
  Image = "image",
}

export type Icon =
  | { kind: IconKind.Pack;  value: string }   // e.g. "phosphor/heart"
  | { kind: IconKind.Emoji; value: string }   // e.g. "🌍"
  | { kind: IconKind.Image; value: string };  // brainstorm://icon/<sha256>.png
```

- **Pack** — a glyph from a registered icon pack. Today Phosphor (`packages/shell/src/renderer/ui/icon.tsx`). When user-pickable icon packs land (task #14), `value` namespaces the pack id (`"<pack-id>/<glyph-name>"`).
- **Emoji** — the raw codepoint(s). Stored as the literal string; the renderer relies on the platform font.
- **Image** — an uploaded asset stored at `<vault>/icons/<sha256>.<ext>`, addressed via the privileged `brainstorm://icon/<sha256>.<ext>` scheme (parallel to `brainstorm://wallpaper/...` — see `main/index.ts`). Content-addressed so duplicate uploads dedupe.

A `null` icon means "use the default for this kind of thing." Renderers fall back to `<AppIcon initials …>` for apps, a tinted generic for entities, etc.

## The picker

One shared primitive: `<IconPicker value={icon} onChange={…}>` in `packages/shell/src/renderer/ui/icon-picker.tsx`.

Tabs: **Icon** (search the active pack), **Emoji** (search + skin-tone modifier), **Image** (upload from disk or paste URL), and an explicit **Remove** button. Bottom row has a **Random** button that picks deterministically from a curated palette — useful for properties/dictionary items where the user just wants a quick visual differentiator.

Returns an `Icon | null` to the caller's `onChange`. Caller owns persistence.

## Where icons live

Cross-cutting — every entity-like surface gets an `icon: Icon | null` field:

| Surface | Where stored |
|---|---|
| Installed app | `manifest.json#icon` (relative file path, served via `brainstorm://app-icon/<appId>`) → today's only icon source. Will normalise into `Icon` once the registry is entity-modeled (Stage 9). |
| Dashboard pin | `DashboardIcon#icon?: Icon` — overrides the app's default icon on the dashboard. |
| Entity (Stage 9+) | first-class `icon` column on every entity. |
| Property type | `Property#icon: Icon` — see [property-list.md](../apps/notes/20-blocks/property-list.md). |
| Dictionary item | `DictionaryItem#icon: Icon` — see [dictionary-editor.md](../apps/notes/20-blocks/dictionary-editor.md). |
| Tag / status option | same as dictionary item. |
| Vault | `VaultEntry#icon?` — already in the preload type. |

## Rendering

Single render function: `<EntityIcon icon={icon} size={N} fallback={"initials"|"pack-name"|...} />`. Always render through it; never inline `<img>` or Phosphor component pickers in feature code. The function handles missing/broken assets (image 404 falls back to initials-with-gradient via the existing `<AppIcon>` palette code, which is generic enough to reuse).

## Per-object icons everywhere (cross-app invariant)

**Every app that lists or renders objects shows each object's OWN icon, identically.** An object's icon is its universal `properties.icon` (`Icon` shape above). An app **must** render that per-object icon; the entity *type* glyph is a **fallback used only when the object has no icon**, never the primary.

This is a hard consistency rule, not a per-app choice — the same object must look the same in Graph, Notes, Database, Files, the dashboard, search results, mentions, etc. A user who set 🚀 on a project sees 🚀 in *all* of them.

- **Reference implementations:** Graph (`apps/graph/src/render/scene.ts` — `readEmojiIcon(entity.properties.icon) ?? typeGlyph(type)`) and Notes. Database matches via the shared `entityIcon(entity)` helper in `apps/database/src/render/cells.ts` (object emoji → else type glyph), used by the grid / list / board / gallery renderers.
- **Lists are objects too.** A Database `List` carries `icon: Icon | null` and renders by the *same* rule (its own icon, else a default List glyph) — a list is not a special case.
- **Anti-pattern (explicitly rejected):** keying the row glyph off `entity.type` only (a per-type icon map) so every object of a type looks the same. That was the Database bug fixed here; do not reintroduce it in any view or app.
- Pack/image kinds route through the universal `<EntityIcon>` renderer above; the lightweight per-view helpers handle the common emoji case and fall back to the type glyph for the rest until every surface consumes `<EntityIcon>` directly.

## Storage of uploaded images

`brainstorm://icon/<sha256>.<ext>` is registered alongside `wallpaper` in `main/index.ts`'s protocol handler. The upload path is shared with wallpapers (`packages/shell/src/main/ipc/dashboard-handlers.ts`'s `uploadWallpaper` is the template) — content-hash filename, `nativeImage.toJPEG()` resize to a sensible icon-max (e.g. 256×256), thumbnail at 64×64 for grid use.

## Settings → Icon library

A new Settings section enumerates every uploaded image-icon in the vault — preview, where used, delete. Same pattern as the wallpaper gallery.

## Future

- **Icon packs** (task #14) — second pack ships when the icon-pack manifest lands.
- **Per-vault icon themes** — a vault can declare its default-pack + accent colour, so all "Pack" icons rendered in that vault pick up the theme.
- **Emoji rendering** — when we want consistent cross-platform emoji, we ship Twemoji as a built-in pack and route emoji → pack at render time.
