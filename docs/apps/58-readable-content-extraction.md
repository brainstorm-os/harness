# 58 — Readable content extraction (clean page capture for Bookmarks)

This doc introduces a shell-side **readable-extraction core** and the **`services.network.readable(url)`** service that lets the Bookmarks app (and, later, the Web Browser app and Notes' bookmark block) turn a saved link into its *actual article content* — the wiki page's body, the blog post's prose — with the navigation, sidebars, menus, cookie banners, ad slots and footer chrome stripped out. It is the missing middle between [38 §Link previews](../security/38-network-and-proxy.md) (metadata only — title, description, OG image) and [54 §Reader, clip, and find](54-web-browser.md) (`web.capture` off a *live* JS-executing `WebContentsView`, which requires the whole Web Browser app).

It builds on [38-network-and-proxy.md](../security/38-network-and-proxy.md) (the network broker, the per-vault preview setting, the SSRF / proxy / cap / cache machinery this service reuses wholesale), [21-objects-and-collections.md](../data/21-objects-and-collections.md) (**every object has a universal, lazy rich-text `body`** — the reserved 9.3.2b `getYFragment`; the captured content lands *there*, on the Bookmark itself, not in a separate entity), [apps/notes/20-blocks/bookmark.md](notes/20-blocks/bookmark.md) + the Bookmarks app (impl-plan 9.18), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capability naming, threat model), [18-storage-and-search.md](../data/18-storage-and-search.md) (captured bodies are indexed), and [07-editing-lexical.md](../editing/07-editing-lexical.md) (the captured body is an editable Yjs richText).

> **See also:** the *engineering sequencing* is impl-plan §Network broker & readable extraction (Net-1 / Net-2) and §Bookmarks 9.18.5/.6.

> **Product decision (user directive 2026-05-19):** there is **one captured-page object — `brainstorm/Bookmark/v1` — everywhere**. The Bookmarks app, Database/Graph/collection views, the Notes bookmark block, **and the Web Browser app's clip** all create / open / show the *same* object in the shared single object space ([21](../data/21-objects-and-collections.md), OQ-DM-1). It is an **ordinary editable block object, like a Note**. **`WebPage/v1` is retired** — not "distinct but composable" (this supersedes the doc-54 decision; see *Relationship to doc 54*). Capture is gated by a per-bookmark **"download page content"** flag chosen at creation: *off* (default) → OpenGraph data as **entity properties** only; *on* → also the cleaned page content converted to **Lexical blocks** in the Bookmark's own universal rich-text `body`. OG/metadata → the composable **property model**; page content → the same **Lexical/Block-Protocol block tree** every object's body uses; both fully editable. Because it is a normal entity, it surfaces in Database/Graph/collections with zero per-app work.

## The problem

A saved link with only `title` + `description` + favicon is a thin card. The number-one failure of URL-only bookmarking is link-rot; the number-two is that "I'll read this later" never happens because the link is one more tab, not content in the vault. The user's mental model of "save this page" is **save what's worth reading on it** — the encyclopedia article, not its category nav, language list, edit toolbar, and donation banner.

Brainstorm already commits ([38](../security/38-network-and-proxy.md)) that **apps have zero network access**; every fetch goes through the shell network broker. So "Bookmarks fetches the page and cleans it up" is not an option — there is nothing for an app to do here except *ask*. The question this doc answers is: **what does the shell give it back, and how is that content modelled and stored.**

## Non-negotiable inheritances

The readable service is, by construction, **`network.preview` that also returns the article body**. It does not introduce one byte of new network posture. It inherits, unchanged, from [38](../security/38-network-and-proxy.md):

- Fetch from the **main process** with the active proxy config; the app never sees the host or the bytes.
- **No JavaScript execution.** Static HTTP `GET` of the served HTML; no headless browser on this path. JS-rendered SPAs that ship an empty `<body>` get a graceful "no clean reading view" result, never a blank doc. (The *live-DOM* path for those pages is `web.capture` — [54](54-web-browser.md) — feeding the *same* extraction core; see *One core, two feeders*.)
- **No cookies, no auth, no `Authorization`, GET only, no cross-scheme redirects, max 5 hops.** Login-walled and paywalled pages do not extract.
- **No private-network access** (`127.0.0.1`, RFC1918, `::1`, `.local`, …) without the separate loud opt-in capability — same SSRF floor as previews.
- **Per-vault setting** (`Off` / `On` / `Allowlist` / `Manual`) and the **privacy-strict default-off** ([38 §User control](../security/38-network-and-proxy.md), OQ-163) govern this service identically to previews.
- **Never on drafts.** The shell does not extract until the owning entity is *user-committed* ([38](../security/38-network-and-proxy.md)) — pasting a URL into an unsaved compose surface does not touch the network.
- **Per-(canonicalUrl, locale) cache, 24 h TTL**, shared with the preview cache: saving the same article into N surfaces is one network hit.
- Every request is **egress-audited** per host in Settings → Privacy → Network, like all other traffic.

> **Decision:** `services.network.readable` is a *superset response* of `services.network.preview`, not a new egress class. It returns the preview record **plus** the extracted article. Because the payload is materially larger and the parse is non-trivial, it is gated by its **own capability `network.readable`** (the app that only wants a card asks for `network.preview` and never gets bodies). Severity is **Low–Medium**: the app still never sees raw bytes or the host — the shell fetches, extracts, sanitizes, and returns a projection — but the projection is the page's substantive content, so the prompt says so plainly ("can fetch and save the readable contents of links you bookmark").

## One core, two feeders

There is exactly **one reader-extraction core** in the shell. It is a pure function:

```
extractReadable({ html, baseUrl, lang? }) -> ReadableArticle | null
```

`ReadableArticle = { meta: { title, byline?, siteName?, excerpt?, lang?, publishedAt? }, blocks: BlockNode[], textContent, length }`. `blocks` is the page rendered as the **same Block-Protocol / Lexical block tree every object's body uses** ([07-editing-lexical.md](../editing/07-editing-lexical.md), the 9.3.2b universal-body transport) — *not* an opaque HTML blob. `meta` is the OpenGraph/`<meta>` record that becomes **entity properties** (see below). `textContent` is the flattened text for indexing/excerpting.

> **Decision (user directive 2026-05-19):** a captured bookmark is **an ordinary editable block object, exactly like a Note**. The sanitized article HTML is *converted to Lexical blocks* (the same `paragraph`/`heading`/`list`/`quote`/`code`/`image`/`table` node set the editor already speaks) and written into the Bookmark's universal `body`; the OpenGraph/metadata fields are written as **typed entity properties through the composable property model** ([21 §Properties](../data/21-objects-and-collections.md), [properties are vault-level]/composable-property-model), not bespoke `Bookmark/v1` columns. There is no special "captured-page" render path — opening a content-bearing bookmark is opening a block document; its properties show in the standard property surface; both are editable, linkable, searchable like any object. The HTML→Lexical importer is the **same one Notes' paste/HTML-import uses** ([apps/notes/20-blocks/](notes/20-blocks/)) — not a parallel converter.

**Two feeders, one core, one object** (`Bookmark/v1`). Only the HTML *source* differs:

1. **Static feeder — `services.network.readable(url)`** (this doc, Net-2). The network broker fetches the served HTML and hands it to the core. This is what Bookmarks uses. It covers the overwhelmingly common case — server-rendered articles, wikis, blogs, docs, news — needs no Web Browser app, and ships first.
2. **Live-DOM feeder — `web.capture`** ([54](54-web-browser.md), Net-3, rides Browser-1). The in-app `WebContentsView` hands its *rendered* DOM to the same core; the Web Browser app's clip button. Handles JS-only/SPA pages browsed inside the product.
*(~~External-browser feeder — the web clipper (Clip-1)~~ — **dropped 2026-07-21**. In-app clipping in the Web Browser (feeder #2, Net-3) covers the clip need; a separate browser extension is not needed. History preserved in [§Web clipper](#web-clipper-dropped-2026-07-21--superseded-by-in-app-browser-clipping) below.)*

> **Decision:** the extraction + sanitization + HTML→Lexical logic is **not duplicated** and the **write target is the same** for both feeders: a `Bookmark/v1` (OG → properties, page → Lexical body). Same extractor, same object, two callers. The Bookmarks v1 surface does **not wait** for the in-app browser — it ships on the static feeder now; the live-DOM (Net-3) feeder is an additive later channel onto the identical core and object.

### The extraction core, concretely

- **Article isolation** via Mozilla **Readability** (`@mozilla/readability`) run over a parsed DOM. The DOM is built **without a script engine** — `linkedom` (light, no JS) on the static path; the live `WebContentsView`'s already-rendered DOM on the capture path. This strips `<nav>`, `<aside>`, `<header>`/`<footer>` boilerplate, comment threads, share bars, related-posts rails and the rest of the page furniture, leaving the main column. The user's "wiki page without menus, sidebars and other interface elements" is exactly Readability's design target.
- **Sanitization** is a strict **allowlist** (not a denylist) over Readability's output, and the allowlisted tag set is **exactly the set the HTML→Lexical importer maps 1:1** (`p h1–h6 ul ol li blockquote pre code em strong a img figure figcaption table/thead/tbody/tr/th/td hr br`); a fixed attribute set (`href` on `a`, `src`/`alt` on `img`, nothing else); **all** `script`/`style`/`iframe`/`object`/`embed`/event-handler attributes/`javascript:`+`data:` URLs dropped; relative URLs rewritten absolute against `baseUrl`; tracking-pixel `<img>` (1×1, known beacon hosts) removed. Anything outside the set degrades to its nearest block (unknown container → its children; unmappable inline → plain text) — never dropped silently into nothing, never carried as raw HTML. The sanitizer is the security boundary; because the output is *converted to Lexical blocks* (not injected as HTML), a sanitizer miss cannot become DOM — the block importer only emits known node types, a second structural backstop.
- **Pure and deterministic** — input HTML fixture → fixed `ReadableArticle`. Tested against a fixture corpus (MediaWiki, a WordPress blog, an MDN doc, a news article, a JS-only shell, a login wall, an oversized doc) with golden outputs. No network in the core's tests.
- **Off the main thread.** Parsing + Readability on a budget-capped (see below) document is CPU-heavy; it runs in a utility worker, not the broker's main-process event loop (OQ-RX-3).

### Budgets

| | Preview ([38](../security/38-network-and-proxy.md)) | Readable (this doc) |
|---|---|---|
| Response size cap | 1 MB | **3 MB** (article HTML ≫ `<head>`; over-cap → metadata-only result) |
| Fetch time cap | 5 s | **8 s** |
| Extraction time cap | — | **2 s** in-worker, then abort → metadata-only |
| Stored body cap | — | **~1 MB textContent** into the Bookmark's `body`; longer is truncated with a visible "captured content truncated — open original for the full page" marker (never silently) |

## What it produces and where it goes

> **Decision:** the captured content fills the **Bookmark's own universal rich-text `body`** — the lazy `Y.XmlFragment` *every* object already has ([21 §Universal rich-text body](../data/21-objects-and-collections.md), the reserved 9.3.2b `getYFragment`). **No separate entity, no parallel store, no `WebPage/v1` in the Bookmarks flow.** This is *not* a new "fat field" — it is the body transport that already exists for every object; a content-bearing Bookmark is just a Bookmark whose body is non-empty, so it is searchable ([18](../data/18-storage-and-search.md)), linkable ([31](../platform/31-linking-protocol.md)), graph-connected and editable for free, with zero schema/BP change. (This supersedes the [54](54-web-browser.md) "a Bookmark is lightweight, no body; it references a WebPage" line for the Bookmarks app — and it is the *consistent* reading of OQ-DM-1, under which "Bookmark has no body" was already the anomaly. `WebPage/v1` remains the Web Browser app's clip artifact on its own surface; see *Relationship to doc 54*.)

> **Decision:** OpenGraph / `<title>` / `<meta>` data is recorded as **typed entity properties through the composable property model**, *not* bespoke `Bookmark/v1` columns: `title`/`description`/`siteName`/`author`/`publishedAt`/`coverImage`/`favicon`/`canonicalUrl`/`lang`. The existing `Bookmark/v1` typed fields (`title`, `description`, `coverImageUrl`, `faviconUrl` in `types/bookmark.ts`) become **property-backed** — this is the OQ-DM-1 "per-app hardcoded fields → properties" migration applied here (tech-debt paydown the single-object-space remodel already mandates, done as this iteration touches the type). The only non-property bit of capture state is `contentCapturedAt` — itself recorded as property `valueMeta` on the body, not a new column.

> **Decision:** capture is **opt-in per bookmark via a "download page content" flag chosen at creation**, not implicit. Flag **off** (default) → OpenGraph/metadata only via `services.network.preview` (the existing 9.18.6 scrape) → properties. Flag **on** → also `services.network.readable` → properties **and** the page converted to **Lexical blocks** in the Bookmark's universal `body`. The flag is itself a property the user can flip later ("Download content" on an OG-only bookmark = a one-shot fetch then; "Forget content" clears the body back to OG-only).

So the data flow:

1. **Create, flag off (default):** Bookmarks creates the `Bookmark` and (if the per-vault network setting permits, entity committed) calls `services.network.preview(url)` → OG record written as **properties**. Body stays empty. No large payload.
2. **Create, flag on:** the shell additionally calls `services.network.readable(url)` (cap `network.readable`; per-vault setting; draft-checked) → broker fetch (cache→network, all [38](../security/38-network-and-proxy.md) protections) → static feeder → extraction core (worker) → `{ meta, blocks | null }`. `meta` → properties; if `blocks` is non-null it is written into the Bookmark's universal `body` via the entities/body transport (now an ordinary editable block document) and `contentCapturedAt` is stamped.
3. **`blocks === null`** (JS-only page, login wall, over-budget, timed out, extraction empty) → properties-only, body empty, and a visible **"Couldn't capture a clean reading view"** state with the reason + "Open original ↗" — never an empty body masquerading as content, never a silent failure.

## UX

- **The flag is in the add-bookmark compose surface:** a single **"Download page content"** checkbox/toggle next to the URL field, with one line of help ("Save a clean, offline-readable copy of the page. Off = link + preview only."). Its default follows a per-vault preference (off by default — the lighter, no-extra-egress choice; a vault can opt the default on). Off → on save, OG-only, instant, no body fetch. On → bookmark saves immediately; the body fills asynchronously in the background (saving never blocks on the network); the card shows a "capturing…" then a "Reading view" affordance that opens the bookmark's own body.
- **Toggle later, both ways:** an OG-only bookmark has a **"Download content"** action (one-shot fetch then); a content-bearing one has **"Forget content"** (clears the body back to OG-only, `contentCapturedAt` → `null`) and **"Refresh content"** (busts the 24 h cache, re-fetches).
- **`Off` / privacy-strict / `network.readable` not granted:** the flag is shown disabled with the reason ("Page-content download is off for this vault — Settings → Privacy → Network"); bookmark saves OG-only. No surprise traffic, ever.
- **Failure** degrades to OG-only with an explicit explanatory state and an "Open original ↗" action; the reason (login required / no readable content / page too large / timed out) is shown, not swallowed.
- **Editing:** the captured body is the Bookmark's own universal body, so it is editable, annotatable and linkable exactly like any object's body — the same editor surface, no special case.
- **Accessibility / discoverability:** the flag is a real labelled focusable control with help text; the per-vault default and the `network.readable` grant are discoverable in Settings → Privacy → Network alongside previews; the card actions live in the Bookmarks card action menu (no new global chord).

## Security & privacy

- The extraction core's **sanitizer is the boundary**: extracted HTML is rendered as trusted content, so the allowlist is strict and tested adversarially (the `/pentester` pass on Net-2 specifically targets sanitizer bypass: SVG/MathML script vectors, mutation-XSS, `srcset`, CSS `expression`, redirect-to-`javascript:`).
- **No JS on the static path** structurally removes the "page runs code in our context" class — the static feeder never executes anything; the live-DOM feeder runs JS only in the [54](54-web-browser.md) Node-less partitioned `WebContentsView`, never in a Brainstorm renderer.
- **SSRF** is the [38](../security/38-network-and-proxy.md) preview floor verbatim (private ranges blocked; opt-in `network.readable.private` mirrors `network.preview.private`).
- **Fingerprinting:** the per-URL cache and shell-side fetch mean a malicious app cannot use "save this bookmark" to enumerate the user's IP against N hosts — same mitigation [38 §Threat model](../security/38-network-and-proxy.md) cites for previews.
- **Provenance:** a captured body is marked machine-extracted from `url` at `contentCapturedAt` (it is not user-authored prose, until the user edits it); if an AI summary/excerpt is later derived it carries `aiProvenance` per [22](../platform/22-ai-foundations.md).

## Relationship to doc 54 / cross-doc reconciliation

This doc **does not edit other docs**; it records the reconciliation (mirroring [22 §Cross-doc reconciliation](../platform/22-ai-foundations.md) / [54](54-web-browser.md)):

- **[54](54-web-browser.md) `WebPage/v1` is RETIRED** (user directive 2026-05-19 — this is now a Decision, not OQ-RX-5). There is one captured-page object, `Bookmark/v1`, everywhere. The Web Browser app's clip button **creates / updates a `Bookmark`** (OG → properties, page → Lexical body) exactly like the Bookmarks app and the Notes block — reusing this doc's shared extraction core via the live-DOM feeder. This **supersedes** doc 54's `WebPage/v1` entity type and its "a Bookmark is lightweight, no body; it references a WebPage / distinct but composable" decisions; it is the consistent reading of OQ-DM-1 (every object has a body — "Bookmark has no body" was the anomaly). The browser's *richer* capture extras become **optional properties / file-attachments on the same `Bookmark`**, not a separate type: above-the-fold `screenshot` → a cover/image property; opt-in raw-DOM snapshot → an attached file entity (the OQ-WV-3 / OQ-RX-4 spill, now hung off the Bookmark). `brainstorm/BrowsingSession/v1` (ephemeral tab set) is unaffected. The doc-54 edit + plan reconciliation land at **Browser-1** (this doc does not edit doc 54; it records the supersede).
- **impl-plan 9.18.5 / 9.18.6 (Bookmarks)** — 9.18.5 = "download page content" flag → static `services.network.readable` feeder fills the Bookmark's body (no `WebPage/v1`); 9.18.6 = the OG/metadata half via `network.preview`. Both feed the one `Bookmark/v1`.
- **Web-clipper DROPPED** (user directive 2026-07-21) — final state after a reinstate (2026-05-19) then remove-to-separate-effort (2026-05-30). Doc 54's original stance stands: the in-app Web Browser **subsumes** the external-browser web-clipper. In-app clipping (`web.capture`, feeder #2, Net-3) meets the clip need; a separate browser extension is not built. `Clip-1` + `OQ-RX-7` retired.
- **[38](../security/38-network-and-proxy.md)** — add `network.readable` (and `network.readable.private`) to the capability table next to `network.preview`; note the shared cache and the 3 MB/8 s budget delta. (Edit lands with Net-2, not in this doc.)
- **[09](../security/09-security-and-sandbox.md)** — add `network.readable` to the capability matrix; add "extracted-HTML sanitizer bypass" to the threat model with the allowlist mitigation.

## Web clipper (DROPPED 2026-07-21 — superseded by in-app Browser clipping)

> **Decision (user directive 2026-07-21):** the external-browser web clipper is **dropped** — the clip need is met by **in-app clipping in the Web Browser** (feeder #2, `Net-3` live-DOM capture → same core → same `Bookmark/v1`), so a separate browser extension is **not needed**. This retires `Clip-1` (no longer a tracked rung, in this repo or as a separate effort) and **OQ-RX-7**. The design below is kept only as historical record. *(Prior states: scoped post-v1 as Clip-1 2026-05-19; removed-to-separate-effort 2026-05-30; now fully dropped.)*

A browser extension / bookmarklet that captures the page the user is **already looking at in their own browser** and saves it as a Brainstorm `Bookmark/v1`. It is highly used in practice because it captures **authed, paywalled, and JS-heavy pages while the user is logged in** — exactly the long tail the static `network.readable` feeder cannot reach.

> **Decision:** the web-clipper is **feeder #3**, not a new object, type, or extraction path. It hands the shell either the URL (→ shell runs the static path) or the page's already-rendered + already-authed DOM/selection (→ the shell runs the **same extraction core**, sanitizer-first). It produces the **same `Bookmark/v1`** (OG → properties, page → Lexical body) the Bookmarks app, Database, Notes block and in-app browser produce. Zero new model; the only new surface is the *transport in* and the *extension artifact*.

> **Decision:** the extension is **untrusted**; the shell still **sanitizes + extracts** every clip through the same core (an extension-supplied DOM is treated exactly as hostile-origin HTML — same allowlist, same Lexical conversion). The extension never writes the vault directly; it submits to a shell-side **clip receiver** bound to a **user-paired token** (pairing is an explicit one-time user action, revocable in Settings → Privacy → Network). No always-listening unauthenticated socket.

This is **complementary to**, not subsumed by, the in-app Web Browser ([54](54-web-browser.md)): the in-app browser is for browsing *inside* the product; the clipper meets the user *in the browser they already use*. Both end at one `Bookmark/v1`. Scoped post-v1 (**Clip-1**); transport + browser matrix is OQ-RX-7.

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md) (`OQ-RX-*` namespace):

- **OQ-RX-1** — Ship the **static `network.readable` service standalone**, or fold readable capture entirely into `web.capture` and make Bookmarks wait for the whole Web Browser app (Browser-1)? **Lean: standalone.** It is small, reuses 100% of the preview machinery, unblocks the user's actual ask years before Browser-1, and the Web Browser app later just adds the second feeder onto the shared core — no rework. (This is the load-bearing decision; everything above assumes the lean.)
- **OQ-RX-2** — Extraction profile: stock Readability defaults for every site, or a small set of **site-class profiles** (a MediaWiki profile keyed off `#mw-content-text` / generator meta, a docs-site profile) layered on top for the long-tail of pages Readability scores poorly? **Lean: stock Readability v1; add profiles only behind measured extraction-quality misses, profile = pure data hint into the same core.**
- **OQ-RX-3** — Extraction locus: the network-broker main process vs. a **utility worker**. A 3 MB parse + Readability pass can stall the broker event loop. **Lean: worker** (the storage/ydoc utility-process pattern from `main/workers.ts`), main process only orchestrates fetch + cache + cap.
- **OQ-RX-4** — Captured-body storage ceiling and truncation UX: hard ~1 MB textContent cap on the Bookmark's body with a visible truncation marker + "open original" (lean) vs. spilling very long pages to a separate raw-HTML file entity. **Lean: cap + visible marker v1; raw spill is post-v1 and opt-in, shared with [54](54-web-browser.md) OQ-WV-3.**
- **OQ-RX-5 — RESOLVED (Decision, user directive 2026-05-19):** there is **one captured-page object, `Bookmark/v1`, everywhere**; the Web Browser clip creates the same object; `WebPage/v1` is retired; browser-only extras become optional properties/attachments on the Bookmark. No longer open; recorded here for trace. The doc-54 edit lands at Browser-1.
- **OQ-RX-6** — HTML→Lexical conversion fidelity & reuse: confirm the captured page is converted with the **same HTML-import path Notes' paste uses** (not a parallel converter), and the allowlisted tag set is exactly that importer's 1:1-mappable set with unmappable nodes degrading to paragraph/text. Edge cases: `<figure>`+`<figcaption>` → image block + caption; nested tables → flattened-with-marker; `<pre><code>` language inference; footnotes/`<sup>` anchors. **Lean: reuse the Notes importer, freeze the allowlist↔block-set equivalence in a shared constant, golden-test the edge cases; no separate converter.**
- **OQ-RX-7** — Web-clipper transport, trust & browser matrix (Clip-1, post-v1): how does the external-browser extension reach the shell — (a) a loopback HTTP receiver bound to a user-paired bearer token; (b) a native-messaging host; (c) a `brainstorm://clip?…` deep-link through the open-resolution OS-handoff ([57](../platform/57-open-resolution.md))? And which browsers ship (Chrome/Edge MV3, Firefox, Safari)? **Lean: native-messaging or `brainstorm://` deep-link (no listening socket); extension submits URL + optional selection/rendered-DOM; shell always re-sanitizes + extracts via the same core; pairing explicit + revocable; Chromium + Firefox first, Safari follows. Extension artifact built & store-reviewed separately from the app bundle.** Blocking only for Clip-1.

## Phasing

| | v1 | later |
|---|----|----|
| Network broker core (`network.fetch`/`network.preview`, SSRF/proxy/cap/cache, per-vault setting, egress audit) — **Net-1** | ✓ | — |
| Readable core (Readability + allowlist sanitizer + HTML→Lexical via the Notes importer, worker, fixture corpus) + `services.network.readable` + `network.readable` cap — **Net-2** | ✓ | — |
| Bookmarks "download page content" flag → Lexical-block body + OG→properties — **9.18.5** | ✓ (rides Net-2) | — |
| Bookmarks OG/metadata scrape → properties (via `network.preview`); `Bookmark/v1` typed fields → property-backed (OQ-DM-1) — **9.18.6** | ✓ (rides Net-1) | — |
| Notes bookmark-block "download content" (same service, same body model) | ✓ (rides Net-2 + 9.18.4) | — |
| Live-DOM feeder (`web.capture` → same core → **same `Bookmark/v1`**, `WebPage/v1` retired) — **Net-3** | — | ✓ (rides Browser-1, [54](54-web-browser.md); doc-54 supersede lands here) |
| ~~**Web clipper** — external-browser extension~~ — **Clip-1 DROPPED 2026-07-21** (superseded by in-app Browser clipping, Net-3) | — | — |
| Site-class extraction profiles (OQ-RX-2) | — | ✓ (quality-driven) |
| Raw-DOM snapshot / screenshot as Bookmark attachment-properties (OQ-RX-4 / OQ-WV-3) | — | ✓ (opt-in per capture) |

## Summary

- **One captured-page object — `brainstorm/Bookmark/v1` — everywhere.** Bookmarks app, Database/Graph/collections, Notes bookmark block, and the Web Browser clip all create / open / show the *same* object. `WebPage/v1` is **retired** (supersedes doc 54; reconciled at Browser-1).
- "Save a bookmark properly" = a per-bookmark **"download page content"** flag. Off (default) → OpenGraph data as **entity properties** only. On → the page also converted to **Lexical blocks** in the Bookmark's **own universal `body`** — an ordinary editable block object, exactly like a Note.
- **OG/metadata → the composable property model; page content → the same Block-Protocol/Lexical block tree every object uses.** The existing `Bookmark/v1` typed fields become property-backed (the OQ-DM-1 migration applied here); the HTML→Lexical converter is the **Notes import path reused**, not a parallel one.
- The shell already owns all network egress; this is **`network.preview` + the article body**, gated by its own `network.readable` capability, inheriting every SSRF/proxy/cache/draft/per-vault protection unchanged.
- **One extraction core, two feeders, one object:** static `network.readable` (Bookmarks, ships first — Net-2) and live-DOM `web.capture` (in-app Web Browser, later — Net-3) both produce the same `Bookmark`. No duplicated extractor, no second type. *(The external-browser web clipper — Clip-1 — was dropped 2026-07-21; in-app Browser clipping covers the need.)*
- Failure is always an explicit, explained, properties-only state — never a blank body masquerading as content, never silent network.
