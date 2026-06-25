# 54 — Web Browser (the web, inside the vault)

This doc introduces a first-party **Web Browser app** (`brainstorm.browser`) and the canonical types it brings: `brainstorm/WebPage/v1` (a captured page) and `brainstorm/BrowsingSession/v1` (ephemeral by default). It removes the second-biggest reason a knowledge-tool user leaves: "I need to look something up / read this article / grab this page." Today that means a context switch to a separate browser, manual copy-paste, and a broken trail between the source and the note. Brainstorm brings browsing **inside** — capability-gated, tracker-resistant, and clip-to-vault in one motion — so research stays in the graph.

It builds on [03-app-model.md](03-app-model.md) (sandboxed apps, no daemons), [38-network-and-proxy.md](../security/38-network-and-proxy.md) (the network broker, the embed sandbox, **OQ-168** — browser-style apps are mediated, not CSP-relaxed), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (trust model), [17-interoperability.md](../platform/17-interoperability.md) (intents), [31-linking-protocol.md](../platform/31-linking-protocol.md) (`brainstorm://` vs `https://` anchors), [apps/notes/20-blocks/bookmark.md](notes/20-blocks/bookmark.md) + the Bookmarks app (impl-plan 9.18 — this app subsumes its post-v1 web-clipper), [18-storage-and-search.md](../data/18-storage-and-search.md) (clips are indexed), and [22-ai-foundations.md](../platform/22-ai-foundations.md) (summarize / extract from a page).

## The core tension and its resolution

[38 §Renderer-side enforcement](../security/38-network-and-proxy.md) physically prevents an app renderer from loading arbitrary remote content: CSP `connect-src 'self'`, `webRequest` interception, no third-party `frame-src`. [38 OQ-168](../security/38-network-and-proxy.md) asks whether a browser-style app should get a relaxed CSP and answers **no** — "such apps go through `network.connect:*` and the broker, not via CSP relaxation." But a real browser must render arbitrary remote HTML **and execute its JavaScript** — that cannot pass through a request/response broker, and it must not run in the Brainstorm app-renderer security context (a JS-executing remote origin one `postMessage` away from the SDK is exactly the boundary [09](../security/09-security-and-sandbox.md) exists to hold).

> **Decision:** web content runs in **shell-managed Electron `WebContentsView` instances**, not in the Mailbox-style app renderer and not in the Brainstorm-app security context. Each is created by a privileged shell **`WebView` host service** in a **locked-down, partitioned, ephemeral `session`**: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, no preload, no access to the Brainstorm `window.brainstorm` bridge, its own cookie/storage partition that is **destroyed when the tab closes** (private-by-default), third-party cookies blocked, HTTPS-upgraded, and a built-in tracker/ad blocklist. This is the **embed sandbox of [38 §Embeds](../security/38-network-and-proxy.md) generalized from one provider iframe to a full navigable page** — same trust posture, larger surface. It directly answers OQ-168: the browser is *shell-mediated*, never an app whose CSP was loosened.

> **Decision:** the Web Browser **app renderer is only chrome** — tabs, URL bar, reader pane, find bar, the clip button. It has **no access to the page DOM**. It drives the `WebView` host service (`open` / `navigate` / `back` / `reload` / `close` / `findInPage` / `capture`) and receives only *metadata events* (title, favicon, URL, load state, security state, blocked-tracker count). The bytes and the live DOM never enter a Brainstorm renderer. Same split as Mailbox ([53](53-mailbox.md)): the dangerous engine is shell-side; the app is the surface.

> **Decision:** the partitioned web session shares the **one proxy configuration and the same egress audit** as everything else ([38 §Proxy support](../security/38-network-and-proxy.md), [§Network panel](../security/38-network-and-proxy.md)). Browsing shows up in **Settings → Privacy → Network** per hostname like every other request — no privileged bypass, no surprise egress. WebRTC, camera, mic, geolocation, notifications, and MIDI are **denied by default** in the web session's `setPermissionRequestHandler` (consistent with [38](../security/38-network-and-proxy.md)); a per-site grant is an explicit user action surfaced in the address bar.

## Capability surface

| Capability | Meaning | Prompt severity |
|------------|---------|-----------------|
| `web.browse` | Use the shell `WebView` host service to open navigable web pages. | **High** — this is the broadest egress surface a user can grant; the prompt says so plainly ("This app can open and display any website"). |
| `web.capture` | Ask the shell to extract a reader snapshot of the current page into a `WebPage/v1`. | Medium — no raw bytes to the app; the shell does the extraction. |
| `network.connect:*` | Implied-reviewed alongside `web.browse` (the user sees one combined sheet, not two). | High. |

> **Decision:** `web.browse` is a **distinct, scarce capability**, not folded into `network.connect:*`. A bring-your-own-API app that needs `network.connect:*` for request/response should *not* thereby be able to render arbitrary JS-executing pages. Separating them keeps the capability review honest (per [09 §Naming convention](../security/09-security-and-sandbox.md)): "make HTTP requests" and "show me any website with its scripts running" are different risks and get different prompts.

## Entity types

### `brainstorm/WebPage/v1`

A page the user deliberately captured ("clip this"). This is the durable artifact; browsing itself is ephemeral.

| Property | Type | Notes |
|----------|------|-------|
| `url` / `canonicalUrl` | text, count `{1,1}` / `{0,1}` | The source. |
| `title` | text, count `{1,1}` | From `<title>` / OpenGraph. |
| `capturedAt` | dateTime, count `{1,1}` | |
| `readerDoc` | richText (Yjs), count `{0,1}` | Readability-extracted main content, sanitized, **stored in the vault** so it survives link-rot and reads offline. Editable like any Note (it is a Yjs doc — annotate, highlight, link out). |
| `rawHtmlSnapshot` | entityRef → file entity, count `{0,1}` | Optional full-DOM snapshot blob (opt-in per OQ-WV-3 — heavier, higher fidelity). |
| `screenshot` | entityRef → file entity, count `{0,1}` | Optional above-the-fold image. |
| `excerpt` / `siteName` / `byline` | text, count `{0,1}` | Card metadata (same parse as the link-preview service, [38 §Link previews](../security/38-network-and-proxy.md)). |
| `tags` | entityRefs, count `{0,∞}` | Personal taxonomy. |
| `aiProvenance` | block, count `{0,1}` | Set if the summary/excerpt was AI-generated ([22](../platform/22-ai-foundations.md)). |

> **Decision:** a clip captures the **content into the vault**, not just the URL. The number-one failure of URL-only bookmarking is link-rot; the number-two is that the source and the thought live in different apps. `WebPage/v1` stores the reader extraction as an editable Yjs doc, so a captured article is a first-class object — searchable ([18](../data/18-storage-and-search.md)), linkable ([31](../platform/31-linking-protocol.md)), graph-connected, annotatable — exactly like a Note.

> **Decision:** `WebPage/v1` and the Bookmarks app's `Bookmark/v1` are **distinct but composable**: a Bookmark is "I want to find this URL again" (lightweight, no body); a WebPage is "I captured this content". A Bookmark can reference a WebPage. This **subsumes the post-v1 web-clipper browser extension** (impl-plan 9.18.5/9.18.6): with an in-app browser, clipping is a button in our own chrome — no MV3 extension, no LAN-pairing channel, no separate review pipeline. The 9.18 plan note must be reconciled (see *Cross-doc reconciliation* below).

### `brainstorm/BrowsingSession/v1`

The tab set + per-tab history of one window. **Ephemeral and vault-local by default** — closed tabs leave no trace unless the user pins a tab or opts into history retention (Settings → Privacy). Never synced cross-device in v1. This type exists so a crashed window can restore tabs and so "reopen closed tab" works — not as a surveillance log.

## Reader, clip, and find

- **Reader mode** — shell-side Readability extraction rendered in the app's own reader pane (a Brainstorm renderer surface showing *sanitized extracted text*, not the live page) with the vault's typography ([13](../shell/13-frontend-stack.md)). The live page stays in its `WebContentsView`; the reader pane is the safe, themable projection.
- **Clip** — one button: `web.capture` → `WebPage/v1` written via the entities service, dropped into the active context (a Note's cursor, a Folder, a Database list) per the user's choice. Selected text in the page clips just the selection (the shell returns the extraction; the app never touched the DOM).
- **Find in page** — driven through `WebView.findInPage`; results are coordinates the shell highlights in the `WebContentsView`, not text handed to the app.
- **Downloads** — routed to the Files host service (impl-plan 9.10): a download becomes a file entity in a `Folder/v1` ([30](30-file-manager-and-folders.md)), capability-checked, never a silent write to disk.

## Agentic surface — research without leaving

This is where "leave the app less" becomes "the agent does the leaving for you":

- **Agent app** ([55](55-agent-app.md)) holds `web.browse` + `web.capture` as **granted tools**. "Find the three most-cited papers on X and put a summary table in my Research note" → the agent navigates, the shell extracts, the agent writes a Database/Note — the three-tier fail-closed intersection of [39 §Capabilities](39-automations-and-workflows.md) bounds it (agent-tools ⊆ Agent-app caps ⊆ user grant). The user reviewed "this app can browse the web" once; the agent operates inside that envelope.
- **Automations** ([39](39-automations-and-workflows.md)): a `WebPage/v1` `entity-event onCreate` trigger feeds downstream steps ("when I clip an article, extract action items, tag it, file it"). Browsing itself is user-initiated — there is deliberately no "scrape this site on a cron" trigger in v1 (see Non-goals).
- **AI** ([22](../platform/22-ai-foundations.md)): "summarize this page" / "extract the data table" runs through the AI broker on the *shell-extracted* content, with provenance stamped on the result.

## Privacy & security

- **Cookies persist, encrypted under the vault key (Browser-10, OQ-WV-6).** Normal tabs share one in-memory Chromium partition so a login sticks across tabs *and* across restarts — a usable browser. Crucially we do **not** use a Chromium `persist:` partition (its on-disk cookie store is only OS-keyed — Keychain/DPAPI, or a hardcoded `v10` key on Linux — and it writes localStorage/IndexedDB in plaintext). Instead the session stays in-memory (Chromium writes nothing to disk) and the shell mirrors cookies into an encrypted `cookies.db` (the 6th DataStore, SQLCipher under a per-DB HKDF subkey of the vault master key), re-injecting them on vault open. A session token is therefore exactly as protected at rest as the user's own entities, and unreadable while the vault is locked. The jar lives entirely in the main process — no page or app renderer ever touches a cookie (no new IPC/capability surface). **Private tabs** keep the original throwaway per-tab partition (no persistence, never written to the jar, never persisted to the session record — incognito). **Settings → Privacy → Clear browsing data** wipes the encrypted store and the live session. *(v1 persists cookies only; localStorage/IndexedDB persistence is a later iteration — it needs per-origin scripting Chromium doesn't expose cleanly from the main process.)*
- Per-tab isolation still holds where it matters: third-party cookies are blocked (a third-party subresource neither sends nor stores cookies, judged per-request against the requesting tab's first-party); tracker/ad blocklist on by default (toggle per [38 §User control](../security/38-network-and-proxy.md)).
- Tracking-pixel and fingerprint resistance: no WebRTC, reduced `navigator` surface, blocked third-party storage — the same posture [38 §Embeds](../security/38-network-and-proxy.md) takes for embeds, applied to full pages.
- The app renderer cannot reach the page: no DOM bridge, no `executeJavaScript` exposed to the app, no raw bytes — a compromised Browser app cannot exfiltrate page content it was never given.
- Threat-model addition to [09 §Threat model](../security/09-security-and-sandbox.md): "malicious site attacks the host" → the `WebContentsView` is an OS-sandboxed, Node-less, isolated renderer with no Brainstorm bridge; blast radius is the throwaway partition. "Malicious Browser app exfiltrates browsing" → it never receives page content or history beyond metadata events; clips are explicit user actions.

## Performance budgets

| Metric | Budget |
|--------|--------|
| New tab → first paint of `about:blank` chrome | < 100ms p95 |
| Navigate → first contentful paint (network-bound; chrome overhead only) | < 50ms shell overhead p95 |
| Clip → `WebPage/v1` persisted (reader extraction, no raw snapshot) | < 800ms p95 |
| Reader-mode toggle | < 150ms p95 |
| Idle `WebContentsView` memory (1 tab, page loaded) | governed by Chromium; **cap of N background tabs before suspend** (OQ-WV-2) |

## Non-goals (v1)

- **A Chromium-extension host.** No MV2/MV3 extension runtime. The clipper is built-in (that *is* the point); arbitrary extensions are a v2 question with a large trust surface.
- **A default-system-browser replacement.** No profile sync, no password manager beyond the credential store, no PWA install. This is a *research surface inside the vault*, not a Chrome competitor.
- **Scheduled/headless scraping.** No "crawl this site nightly" trigger in v1 — that is an abuse and trust minefield; browsing is user- or agent-turn-initiated. Revisit as a connector ([56](56-connector-framework.md)) with explicit per-site consent if demand is real.
- **Cross-device browsing history sync.** History is ephemeral and vault-local; syncing it is opt-in and post-v1.
- **DRM / EME playback.** Out of scope v1.

## Cross-doc reconciliation needed

Mirrors the pattern [22 §Cross-doc reconciliation](../platform/22-ai-foundations.md) used when it reversed an [01](../foundations/01-vision.md) non-goal. Tracked as a follow-up; this doc does not edit the others:

- **`WebPage/v1` is RETIRED** (OQ-RX-5, user directive 2026-05-19 — see [58-readable-content-extraction.md](58-readable-content-extraction.md)). The browser's clip collapses onto **one captured-page object, `brainstorm/Bookmark/v1`**: page content → Lexical blocks in the Bookmark's own universal body; OG/metadata → entity properties; the browser's richer extras (screenshot, raw-DOM snapshot) become optional properties / file-attachments on that same Bookmark. Throughout this doc, read every `WebPage/v1` reference as `Bookmark/v1` (+ body). The doc-54 rewrite to remove the type lands at the **Browser-1** iteration; this section records the supersede.
- **impl-plan 9.18 (Bookmarks)** — the post-v1 web-clipper browser extension (9.18.5) and automated scrape (9.18.6) are **superseded** by in-app `web.capture`. Re-scope 9.18.5/6 to "Bookmarks consumes the captured `Bookmark/v1` body" rather than "ship a browser extension".
- **[38 OQ-168](../security/38-network-and-proxy.md)** — resolved by this doc's shell-mediated `WebContentsView` decision; mark it resolved when the plan iteration lands.
- **[09](../security/09-security-and-sandbox.md)** — add the `WebContentsView` partition + `web.browse` to the capability matrix and threat model.

## Phasing

| Capability | v1 | v2 |
|------------|----|----|
| `WebView` host service + partitioned `WebContentsView` + `web.browse` | ✓ | — |
| Tabbed chrome, URL bar, back/forward, find-in-page | ✓ | — |
| Tracker/ad blocklist, third-party-cookie block, HTTPS-upgrade | ✓ | — |
| Reader mode + `web.capture` → `WebPage/v1` (subsumes web-clipper) | ✓ | — |
| Downloads → Files host service | ✓ (rides 9.10) | — |
| `WebPage/v1` `entity-event` trigger; AI summarize/extract | ✓ (rides 11 / 11b) | — |
| Per-site permission grants (camera/mic/geo) | ✓ (deny-default + explicit grant) | — |
| Full raw-DOM snapshot capture (high-fidelity) | ✓ (opt-in, OQ-WV-3) | — |
| Cross-device history sync | — | ✓ |
| Extension runtime (MV3) | — | ✓ (trust-gated) |
| Scheduled site monitoring | — | ✓ (as a consented connector) |

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md) via the dev-MCP `oq.*` path:

- **OQ-WV-1** — Process model: one `WebContentsView` per tab (isolation, memory cost) vs. a pooled few with suspend? Interacts with OQ-WV-2.
- **OQ-WV-2** — Background-tab suspension threshold and restore semantics (how many live tabs before freeze).
- **OQ-WV-3** — Default capture fidelity: reader-extraction only (light, link-rot-proof, lossy) vs. also a raw-DOM/MHTML snapshot (heavy, faithful). Lean: reader by default, raw snapshot opt-in per clip.
- **OQ-WV-4** — Blocklist source + update path: bundled static list, or a signed updatable feed via the network broker (overlaps the threat-intel feed of [32](32-store-verification.md))?
- **OQ-WV-5** — Does the agent's `web.browse` get a *narrower* sub-capability (e.g. `web.browse:read-only`, no form submission) so an autonomous loop can't POST to arbitrary endpoints? Lean: yes — agent-driven browsing defaults to read-only navigation; interactive form submission requires a user-in-the-loop step.
- **OQ-WV-6** — Cookie/session persistence model. *[RESOLVED in implementation-plan Browser-10]* — **persistent-by-default + private tabs, cookies-only v1, encrypted under the vault key.** Normal tabs share one in-memory partition whose cookies are mirrored into an encrypted `cookies.db` (SQLCipher / per-DB HKDF subkey of the master key) and re-injected on vault open; we deliberately do **not** use a Chromium `persist:` partition (OS-keyed cookie crypto + plaintext DOM storage — below the vault's at-rest bar). Private tabs keep the throwaway per-tab partition (no persistence, never persisted to the session record). `localStorage`/IndexedDB persistence deferred (needs per-origin scripting Chromium doesn't expose from the main process). Supersedes this doc's original "partition destroyed on close / no persistence" posture.

## Summary

- A first-party browser brings web research **inside** the vault; the source and the thought stop living in different apps.
- Web content runs in **shell-managed, partitioned, Node-less `WebContentsView`s** — the [38](../security/38-network-and-proxy.md) embed sandbox generalized to full pages; this resolves OQ-168 (mediated, not CSP-relaxed).
- The app renderer is **chrome only** — no page DOM, no raw bytes; the dangerous engine is shell-side, exactly like Mailbox.
- Clipping captures **content into the vault** as an editable, searchable, linkable `WebPage/v1` — subsuming the post-v1 web-clipper extension.
- Private-by-default partitions, tracker blocking, deny-default device permissions, full egress audit in Settings.
- The Agent app can browse and capture as a **granted, fail-closed tool** — research happens without the user ever leaving.
