# Media blocks

Three media block types share most of their architecture; the inspector is **Brainstorm's improvement over the prior-art baseline** (most block editors expose only a resize handle).

| Block | Kind | Default file types |
|---|---|---|
| Image | `image` | png, jpg, jpeg, gif, webp, avif, svg |
| Video | `video` | mp4, webm, mov |
| Audio | `audio` | mp3, wav, ogg, m4a, flac |

## Block state (Lexical)

```ts
class MediaBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;
  __fileHash: string | null;   // null in placeholder state
  __kind: MediaKind;           // image | video | audio
  __alignment?: "left" | "center" | "right";
  __width?: number;            // px — image / video only; null = natural
  __caption?: string;          // optional
}

enum MediaKind { Image = "image", Video = "video", Audio = "audio" }
```

Full file metadata (alt text, focal point, dimensions, EXIF, upload state, etc.) lives in `mediaStore[fileHash]` — not on the block. This means a file referenced by multiple blocks shares metadata.

## mediaStore

```ts
type MediaRecord = {
  hash: string;             // content-addressed
  mime: string;
  size: number;             // bytes
  name: string;             // original filename
  // Image-specific
  altText?: string;
  caption?: string;          // moves OUT of the block once set — caption is per-file, shared
  focalPoint?: { x: number; y: number }; // 0..1; default {0.5, 0.5}
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  dominantColor?: string;    // hex; computed at upload for placeholder fill
  exif?: Record<string, unknown>;
  // Video-specific
  durationMs?: number;
  posterHash?: string;       // a sibling MediaRecord for the poster frame
  // Common
  uploadedAt: number;
  uploadedBy?: string;       // user id, post-Stage 11
};
```

Files themselves live in `<vault>/data/apps/<appId>/files/<hash>.<ext>`. Served via `brainstorm://app-file/<appId>/<hash>` (a new privileged scheme — mirrors `wallpaper` / `app-icon`).

## States

| State | Trigger | UI |
|---|---|---|
| Empty | Block freshly inserted | Placeholder card with three actions: Upload from disk, Paste URL, "Choose from library" |
| Uploading | After file dropped | Card with file name + progress bar; cancellable |
| Ready | Upload complete | Full media render with inspector handle |
| Errored | Upload failed | Card with error message + Retry / Replace / Delete |
| Broken | File hash exists but file gone | Card with "File missing" + Replace |

## Inspector

The improvement vector. Two surfaces:

### Inline inspector (below the media)

Always-visible thin strip under a focused media block. Shows: alignment, width, alt-text input (image only), caption input. Disappears when block loses focus.

### Side panel

Opened via the block's gutter `…` menu → "Inspector". A right-edge slide-in panel with everything:

- **Identity** — file name (editable for image's alt), MIME, size, hash (short), copy-to-clipboard
- **Dimensions** — intrinsic vs. rendered; reset to natural; aspect-ratio lock toggle
- **Focal point** — draggable point over a thumbnail; persists to `mediaStore`
- **Alt text** — `<textarea>`, image only (a11y)
- **Caption** — `<textarea>`, shared across all blocks referencing this file
- **Replace** — file picker; replaces the file at the same hash binding (the block keeps its position; only the binding moves)
- **Open original** — opens at the system path or via `brainstorm://app-file/...` in a new window
- **Copy URL** — copies the `brainstorm://app-file/...` URL
- **Download** — system save dialog
- **EXIF** (image only, collapsible) — read-only key/value table
- **Where used** — list of every block in this vault that references this hash

## Image-specific behaviours

- **Click-to-zoom** lightbox.
- **Right-click → Copy image** (renderer-level).
- **Drag-resize handle** on the right edge (image + video). Width is per-block; intrinsic dims stay on the file.

## Video-specific behaviours

- Standard `<video controls>`.
- **Auto-poster** — first frame extracted on upload (`canvas.drawImage` of `<video>` at `currentTime: 0.1`), stored as a sibling image and referenced via `posterHash`.
- **Loop / autoplay / mute** toggles in inspector.

## Audio-specific behaviours

- Compact card with play / scrub / time / waveform stub. Waveform is computed lazily (analyser node) and cached as a tiny PNG inside `mediaStore`.

## Upload flow

1. User drops a file (or pastes from clipboard, or picks via the placeholder Upload button).
2. App calls `services.storage.uploadFile({ kind: MediaKind, file: ArrayBuffer, name })` (new SDK method, gated by a `files.upload:self` capability — default-minimum, granted at install for first-party apps).
3. Worker hashes content (`SHA-256`), writes to `<vault>/data/apps/<appId>/files/<hash>.<ext>`, computes intrinsic dims + dominant colour + (image only) EXIF, writes to `mediaStore`.
4. Returns `MediaRecord`.
5. App sets `__fileHash` on the block.

Worker handles dedup automatically — same content = same hash = no extra write.

## Where the upload API lives

Today: `storage.kv` only. Stage-3-light extends the storage worker with:

- `storage.uploadFile(arg)` — accepts `{ kind, name, bytes }` (bytes are a `Uint8Array` carried via Electron's structured-clone IPC). Returns `MediaRecord`.
- `storage.listFiles(opts)` — listing for the inspector's "Choose from library".
- `storage.deleteFile(hash)` — refcount-aware; only deletes if no blocks reference. (Reference index built from the same crawl as the dictionary usage index.)

## Block insertion

From the slash menu: `/image`, `/video`, `/audio`. Or drag a file directly into the editor → auto-detects MIME → inserts the appropriate block.

## Selection / clipboard

Inherits from [`30-selection.md`](../30-selection.md). Clipboard wire format `application/x-brainstorm-block` carries `{ blockId, __fileHash, __kind, __alignment, __width, __caption }` — pasting into the same vault re-binds to the same file. Pasting into a different vault triggers a "copy file too" confirm.

## Property-block integration

A `File`-kind property's value is a list of file hashes (see [property-list.md](property-list.md)). The `GalleryCell` and `FileListCell` cells share rendering with this block — same `<MediaThumb>` / `<MediaPlayer>` components, just configured smaller. The inspector is reachable from the cell's "..." menu, same panel.

## fancy-menus migration

Inspector's section disclosures and the inline kebab use anchored menus. Migrate to `@react-fancy-menus/core` (task #36).

## Accessibility

- Image without alt-text shows a small dotted underline in the editor (dev-mode visual nag); a screen reader announces "image, no description, edit alt text" via `aria-describedby`.
- Video has captions slot (VTT track upload, post-v1 — but the spot is reserved in the inspector).
- Audio has transcript slot (post-v1).
- Keyboard:
  - Focus a media block → `Enter` opens inspector.
  - `Cmd+Shift+I` opens inspector for any block that supports it (registered via the shortcut registry).

## Future

- **Image editing** (crop, rotate) — separate "edit" panel; post-v1.
- **WebP / AVIF re-encode on upload** for size savings — opt-in.
- **Cloud thumbnail rendering** when entities + sync land (Stage 9+). Today everything is local.
