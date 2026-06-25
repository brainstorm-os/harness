# Property constructor

UI for **defining a property type**. Used by [property-list.md](property-list.md) when the user picks "+ Create new property" from `<AddPropertyMenu>`. Same component is the editor for an existing property reached from **Settings → Properties**.

## Surface

A two-panel modal (uses the shared `<Popover size="large">` primitive):

- **Left** — form: name, icon, kind picker, kind-specific options.
- **Right** — live preview: the property rendered with its currently-chosen view against a sample value. Lets the user see what it'll look like before committing.

## Form fields

| Field | Notes |
|---|---|
| **Name** | Text input. Default focus. Validated non-empty. |
| **Icon** | `<IconPicker>` button — pack / emoji / image (see [foundations/39-universal-icons.md](../../../foundations/39-universal-icons.md)). Default: an auto-picked emoji based on the kind (e.g. `🔢` for Number). |
| **Kind** | Segmented control or kind-picker menu. **Immutable post-creation** — disabled in edit mode with a tooltip explaining why. |
| **Description** | Optional `<textarea>` — shows as a tooltip on the property's name everywhere. |
| **Default view** | Dropdown of allowed views for the chosen kind. Sets the new block's view if the user doesn't override per-block. |

## Kind-specific options

The form rebuilds its bottom section when `kind` changes.

### Text / Url / Email / Phone
- (none — just name/icon/description)

### Number
- **Format** — Integer / Decimal (precision N) / Percent / Currency (code).
- **Min**, **Max** — optional.
- **Step** — for the up/down arrow on the cell.

### Date
- **Include time** — toggle.
- **Default to now** — toggle. (Pre-fills when adding to a note.)

### Boolean
- (none)

### Select / MultiSelect
- **Dictionary** — dropdown of existing dictionaries + "**+ New dictionary**". Selecting an existing one shares its vocabulary with other properties (e.g. one `Country` dictionary referenced by `Birthplace` and `Citizenship`).
- **MultiSelect only — `maxItems`** — optional cap.
- Below the dropdown: an embedded `<DictionaryEditor>` for the chosen dictionary. Edits flow through immediately.

### File
- **Accept** — multi-select of MIME-globs (`image/*`, `video/*`, `audio/*`, `application/pdf`, custom). Default: empty (accept all).
- **Max count** — optional.

### Link (entity reference)
- **Entity type** — dropdown of registered entity types in the vault (Stage 9+; until then a free-text input). Empty = any.
- **Multi** — toggle. Single vs. multi-link.

## Live preview

Shows the cell rendered against a sample value:
- Renderer reads the in-form draft (not yet persisted) and instantiates the appropriate `Cell` component.
- Below the cell, a row of view chips lets the user preview each allowed view.

Means the user sees their property's look *before* committing — closes the loop the design review flagged in the bigger app design.

## Commit & cancel

- **Save** — writes to `propertyStore` (`storage.kv` key `property:<key>`). If launched from `<AddPropertyMenu>`, also adds the new key to the originating PropertyList's `__propertyKeys`.
- **Cancel** — discards. If launched from `<AddPropertyMenu>`, doesn't add anything.

`key` is generated as `prop_<base36(now)>_<random6>` — same shape as note ids. Stable forever.

## Edit mode

Reached from:
- **Settings → Properties** — click a property row.
- A property block's gutter menu — "Edit property…".

Differences from create mode:
- `kind` field disabled.
- A **Delete** button at the bottom — destructive variant of `<Confirm>`. Confirms with the count of bound values that will be nulled.

## Where used

In edit mode the right panel includes a **"Used by N notes"** card that expands to a list of consumers (links to open each note). Same usage index as the dictionary-editor's per-item view.

## fancy-menus migration

Kind-picker menu and the dictionary dropdown are anchored menus. Migrate to `@react-fancy-menus/core` (task #36).

## Validation

- Name: required, non-empty.
- Icon: any `Icon | null` accepted; picker enforces shape.
- Number bounds: min ≤ max if both set.
- Select dictionary: required; cannot save until a dictionary is chosen (or created inline).

## Accessibility

- Form is a `<form>` with proper `<label>` ↔ control associations.
- Kind picker: `role="radiogroup"` (single-select) with arrow-key navigation between options.
- Live preview is `aria-live="polite"` so screen readers describe the changes as the user edits.

## Future

- **Computed properties** — read-only properties derived from other values (e.g. `Days since created = today - createdAt`). Defer to post-v1; expression language is a separate doc.
- **Property templates** — pre-built bundles (e.g. "Task properties: Status / Priority / Due / Assignee") inserted as a group. Defer.
- **Cross-vault property registry** — share property definitions across vaults via export/import. Tied to entities (Stage 9+).
