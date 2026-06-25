# Link block

In-vault reference to another entity (today: another Note). Distinct from **inline links** (`@lexical/link`'s `LinkNode`, which is an anchor inside text flow) and from [bookmarks](bookmark.md) (which fetch external web URLs).

We call this `linkBlock` to avoid collision with `LinkNode`.

## State

```ts
class LinkBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;
  __targetId: string;             // entity id (today: note id)
  __style: LinkStyle;             // Inline | Card
  __snippet?: boolean;            // Card style only — show body snippet
}

enum LinkStyle { Inline = "inline", Card = "card" }
```

## Renders

| Style | Visual |
|---|---|
| **Inline** | `<a>` with target's icon + title, sized to text line height. Pill-shaped chip. |
| **Card** | A bordered card: icon + title (large) + optional snippet (first 120 chars of body, stripped) + tiny "Open" affordance. |

## Insertion

- Slash: `/link` → opens a search popover (in-vault entity suggest). Pick → inserts an Inline link.
- `@` inside text: opens a mention suggest. Picking creates an inline `MentionNode` (text-flow, not a block); pressing `Tab` or selecting "Insert as card" promotes to a `LinkBlock`.
- Paste a `brainstorm://entity/<id>` URL → smart-insert as a card; with `Shift` modifier as inline.

## Live binding

The block subscribes to the target's `{ icon, title }` and re-renders when those change. If the target is deleted, the block renders a deleted-state card with the last-known title and an "Unlink" affordance.

## "Show snippet" toggle

Card style only. When on, fetches the first non-empty text block from the target's body and renders it below the title. Refreshes when target saves.

## Selection / clipboard

Same as other blocks. Clipboard wire format includes `__targetId`. Pasting into a different vault triggers a "target not found" deleted-state card.

## Accessibility

- Whole card is a single focusable `<a href="brainstorm://entity/<id>">`-styled element (semantically a button if it opens in-app, anchor if it opens cross-app).
- Icon has `aria-hidden`; title is the accessible name.
- "Unlink" / "Open in new window" reachable from the gutter `…` menu.

## Open questions

- **Multi-target links** — should one block render N targets (a "related list")? Probably no; that's what a property of `Link` kind in a `PropertyList` is for.
- **Cross-app routing** — links to entities owned by another app (e.g. Database entries) route through Stage 7.5's intents bus with verb `open`. v1 handles only same-app (note→note) targets.
