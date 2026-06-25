# Bookmark block

External URL with OG-tag preview. Distinct from inline `<a>` links (formatting) and from `LinkBlock` (in-vault entity reference).

## State

```ts
class BookmarkBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;
  __url: string;
  __title: string;
  __description: string;
  __imageHash: string | null;    // OG image, stored in mediaStore
  __faviconHash: string | null;  // same
  __state: BookmarkState;
}

enum BookmarkState {
  Empty   = "empty",     // freshly inserted, no URL yet
  Fetching = "fetching", // fetch in flight
  Done    = "done",      // populated
  Errored = "errored",   // fetch failed
}
```

## States

| State | Visual |
|---|---|
| Empty | Card with a URL input + paste button. |
| Fetching | Card with file name (URL) + spinner + cancel. |
| Done | Card: favicon · title · description · image (if any). Click → open in default browser. |
| Errored | Card: URL + error message + Retry + Replace. |

## Fetch

The renderer never touches HTTP. Calls a new shell service:

```ts
window.brainstorm.services.bookmarks.fetch({ url }): Promise<BookmarkPreview>
```

Backed by a host service in the storage worker (or a new `fetch` worker — to be decided when it lands). Capability: `network.fetch:bookmark` — non-default; install-time grant for first-party apps; runtime prompt for third-party.

Worker steps:
1. HEAD then GET the URL with a small timeout + redirect cap.
2. Parse `<meta property="og:*">` + `<meta name="twitter:*">` + `<title>` + `<link rel="icon">`.
3. Download `og:image` and favicon into `mediaStore` (content-addressed; dedup'd).
4. Return `{ title, description, imageHash, faviconHash }`.

This mirrors the conventional `blockBookmarkFetch` IPC shape, run in a worker rather than middleware.

## Privacy / proxy

`bookmarks.fetch` honors the [network egress / proxy design doc](../../../security/38-network-and-proxy.md). User can:
- Block all bookmark fetches per-vault.
- Allowlist a domain pattern.
- Route through a configured proxy.

Each fetch is logged in a per-vault audit trail (URL, time, capability source). Settings → Security exposes the log.

## Insertion

- Slash: `/bookmark` → inserts an empty bookmark, focuses the URL input.
- Paste a URL on its own line → smart-insert: prompts inline ("Insert as bookmark or text?" — default bookmark on Enter).
- Drag-drop a URL from another app's address bar → same prompt.

## Refresh

Gutter menu has a "Refresh preview" action — re-fetches and updates the block. Useful when target page metadata changes.

## Selection / clipboard

`application/x-brainstorm-blocks` includes the OG fields. Pasting into a different vault carries the cached preview (no re-fetch needed); the image hash is replayed against the destination vault's `mediaStore` (and triggers a copy-bytes if needed, via the clipboard's bundled `referencedMedia` payload — see [`01-data-model.md`](../01-data-model.md)).

## Accessibility

- Card is a single focusable element; `aria-label="Bookmark: <title>"`; opens on Enter.
- Empty / errored state shows form inputs with proper labels.

## Open questions

- **Webview-based preview** — should we ever render the page's screenshot? No, for security and bandwidth reasons. Stay with OG fields.
- **Per-vault disable** — should the bookmark block hide itself entirely if `network.fetch:bookmark` is blocked at vault level? Or render as a "fetching blocked" state with a link to Settings? Latter is friendlier.
