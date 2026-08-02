# 38 — Network egress, link previews, and proxy support

This doc is the privacy- and operability-side companion to [09-security-and-sandbox.md](09-security-and-sandbox.md). It zooms in on **what happens when an app (or the shell) makes a network request** — the privacy properties the user can rely on, the affordances the shell offers, and how Brainstorm coexists with restrictive networks (corporate firewalls, captive portals, regional filters).

It exists because two failure modes hurt comparable products today:

1. **Surprise network traffic.** An app fetches a link preview, an embed thumbnail, a YouTube video, an analytics ping — and the user discovers it via Little Snitch, a proxy log, or a privacy audit. Each request that's not the user's intentional action is a possible privacy regression and a possible exfiltration vector.
2. **Hostile networks break the product.** Corporate users sit behind transparent HTTPS-inspecting proxies, allow-list firewalls, MITM TLS interceptors. Apps that hard-code direct egress assume a network they don't have. Sync stops working. Updates fail silently. Users blame Brainstorm.

This doc commits to: every network request is **declared, observable, and revocable**; the shell **respects** the host OS's proxy configuration and **lets the user override** it; and the shell ships **first-class link-preview and embed handling** so apps don't have to roll their own (and quietly leak IP addresses doing it).

## Goals

1. **No surprise egress.** Apps cannot make a network request without an audit-logged, capability-checked call that flows through the shell's network broker.
2. **Defense in depth, not just sandbox.** Sandboxing the renderer prevents most direct egress; the broker enforces policy on the remainder (fetch, WebSocket, WebRTC, image/iframe loads).
3. **First-class link-preview and embed.** The shell renders previews with shell-side fetch + per-domain policy, not by trusting every app's link parser. Apps describe the link; the shell shows the preview.
4. **Works behind proxies.** System proxy, manual proxy, PAC, no-proxy lists. HTTPS-inspecting corporate proxies that re-sign certificates with a trusted enterprise CA work without surgery.
5. **Observable.** A network panel in Settings shows every host the shell and apps have talked to in the last N days, grouped by app, with per-request capability and outcome.
6. **Local-first first.** The default install talks to **nothing on the network** beyond what the user explicitly opts into. Even Brainstorm's own update / telemetry endpoints are opt-in (or off in v1).

## The network broker

> **Decision:** all app-originated network requests pass through a **network broker** in the shell main process. Apps cannot use `fetch`, `XMLHttpRequest`, `WebSocket`, `WebRTC`, `<img src>`, `<iframe src>`, `<video src>`, or any other DOM-level egress directly to arbitrary hosts. The renderer's CSP (per OQ-145 / docs/09) plus Electron's request interceptors enforce this; the broker provides the legitimate channel.

The broker:

1. Receives requests as IPC envelopes (`network.fetch`, `network.connect`, `network.preview`, `network.embed`).
2. Resolves the calling app's `network.connect:<scope>` capabilities; rejects requests outside the granted scope (per [09 §Network](09-security-and-sandbox.md)).
3. Applies the active proxy configuration (system / manual / PAC).
4. Issues the request from the **main process** — so the renderer's `fetch` never sees the target host directly, and DNS resolution is done by the shell.
5. Logs the request to the audit log (method, host, byte count, outcome — never body content).
6. Returns the response (or a typed error) to the caller.

> **Decision:** the broker **never** echoes the user's own IP to the renderer. The renderer learns only the response body and metadata the broker chose to surface. This blocks IP-fingerprint exfil patterns where an app derives the user's IP from network timing or response headers it shouldn't have.

### Renderer-side enforcement

Even with the broker as the legitimate channel, the renderer must be physically prevented from going around it:

- **CSP** (per OQ-145): `connect-src 'self'`; `img-src 'self' data: blob:`; `frame-src 'self'`; `media-src 'self' blob:` for app renderers. The `'self'` is a no-op (apps are loaded from `file://`); no external host can be added by the app.
- **Web request interception** via `session.webRequest.onBeforeRequest` (Electron API): every renderer's outgoing HTTP(S) request is inspected; non-`file://` and non-`devtools://` schemes are blocked unless they originate from the broker's main-process `net.request`.
- **WebRTC** is disabled by default in app renderer sessions (`session.setPermissionRequestHandler` denies camera/mic/ICE). Apps that need realtime media request via `network.media` (out of v1 scope).

> **Decision:** if an app needs to display an image from a URL the user pasted, it submits the URL to `network.preview` or `network.fetch` (depending on whether it wants the rendered preview or raw bytes); the broker returns a `blob:` URL the renderer can place in `<img src>`. The renderer never sees the host.

## Capability namespace

The existing `network.connect:<scope>` (per [09 §Naming convention](09-security-and-sandbox.md)) is the load-bearing primitive. This doc refines it:

| Capability                          | Meaning                                                                                 | Prompt severity |
|-------------------------------------|-----------------------------------------------------------------------------------------|-----------------|
| `network.connect:https://a.example` | One exact origin (scheme + host + default port).                                         | Low — narrow.   |
| `network.connect:https://*.a.example` | All subdomains of one host. Useful for sharded CDNs.                                    | Medium.         |
| `network.connect:*`                 | Any host. Used by browsers, web-clipper apps, AI bring-your-own-API apps.                | High — scary.   |
| `network.preview`                   | Use the shell's link-preview surface for any URL the user pasted into your app.          | Low — preview only; the app never sees the byte stream. |
| `network.embed:<provider>`          | Embed media (YouTube, Vimeo, Twitter, etc.) via the shell's embed sandbox.                | Low — per-provider; shell mediates. |
| `network.embed:*`                   | Use any registered embed provider.                                                       | Medium.         |
| `network.fetch:<scope>`             | Same scope rules as `network.connect`; request/response style only, no streaming/WS.      | Inherits scope severity. |
| `network.proxy.override`            | Override the shell's proxy config (e.g., an SSH-tunnel app needs to bypass).               | High — rare.    |

> **Decision:** `network.preview` and `network.embed:<provider>` are deliberately separate from `network.connect`. They cost the app **no host disclosure** — the shell sees the URL, fetches/renders, and returns a presentation token. Apps that only want preview/embed UX never need to ask for arbitrary network access.

> **Decision:** `network.connect:<scope>` and `network.fetch:<scope>` are split so that an app can request "request/response only" without implying WebSocket / SSE / WebRTC access. The shell's prompt makes the difference visible ("This app wants to make HTTP requests" vs. "open long-lived network connections").

## Link previews

The single most common reason an app wants network access is: the user pasted a URL, and the app wants to show a richer card than a bare anchor.

### Why the shell handles previews

If 30 apps each fetch link previews directly, the user's IP touches 30× the destinations. Worse, those fetches happen at *paste* time (potentially every time the user pastes a URL, even into a draft they never publish) — that's a far more sensitive signal than what the user actually opens. And every app reinvents OG-tag parsing, redirect handling, image decoding, byte-budget enforcement, and time-out logic.

> **Decision:** the shell ships **one link-preview service** (`brainstorm.services.network.preview(url)`) that:
>
> 1. Fetches the URL **from the shell's main process** with the active proxy config.
> 2. Caps response size (default 1 MB) and time (default 5 s).
> 3. Parses OpenGraph, Twitter Card, JSON-LD, and `<title>` / `<meta description>` fallbacks.
> 4. Decodes the first preview image (capped at 2 MP, 500 KB), strips EXIF / GPS, re-encodes as `image/webp`.
> 5. Returns a typed `LinkPreview` record: `{ url, canonicalUrl, title, description, image?: blob, siteName, mediaType, fetchedAt }`.
> 6. Caches the result per (canonicalUrl, locale) with a 24h TTL; subsequent paste-into-N-apps of the same URL is one network hit, not N.

The app inserts the returned `LinkPreview` into its content (or its Lexical node, per [07-editing-lexical.md](../editing/07-editing-lexical.md)); the bytes that crossed the network never touched the renderer.

### User control

Link-preview behavior is **per-vault settings** (per [25-settings.md](../shell/25-settings.md)):

- **Off** (default for **vaults whose path matches a privacy-strict pattern** — TBD per OQ-163): no previews fetched; pasted URLs render as plain links.
- **On for any URL** (default for normal vaults).
- **On but only for an allowlist** (e.g., the user's own blogs, internal wikis).
- **Manual** — show a "Fetch preview" button next to the link; only fetches on click.

> **Decision:** the shell **never** fetches link previews for URLs in *draft* / *private* / *not yet committed* states unless the user pastes the URL into a surface the app marks as "user committed." Drafts touching the network is a category we deliberately avoid; an app's compose surface that pastes URLs into a not-yet-saved entity must hold the preview until the user saves or otherwise commits.

> **Open:** OQ-163 — what "privacy-strict" patterns default link previews to off? Vaults inside `~/Private`, vaults with names matching `*-secure*`, vaults the user marked private at creation? Tentative leaning: ship a one-click "Privacy mode" toggle on the vault that disables all non-essential network (previews, embeds, telemetry, update checks) and tracks per-vault.

### What previews cannot do

- **No JavaScript execution.** Previews are static metadata extraction; the shell does not spin up a browser to render the page. Sites that require JS to populate OG tags get the default fallback.
- **No cookies, no auth.** Previews are fetched with a fresh cookie jar per request; no Brainstorm-identity headers, no host-cookies, no `Authorization`. Sites that require login don't preview.
- **No POST / non-GET.** Previews are `GET` only.
- **No redirects across schemes.** `https://` → `http://` is blocked. `https://` → `https://` redirects are followed up to 5 hops.
- **No private network access.** `127.0.0.1`, `10/8`, `172.16/12`, `192.168/16`, `::1`, `fc00::/7`, `fe80::/10`, `.local` mDNS hosts — all blocked by default. (Stops cross-protocol attacks like "preview of `http://localhost:9200/`" hitting the user's local services.)

> **Decision:** **private network access is opt-in** with a separate capability `network.preview.private` (defaults off, prompts loudly). Same rule applies to `network.fetch` and `network.connect` — the scope `*` does **not** include private ranges; the user must grant a separate `network.connect.private` to allow that.

## Embeds (YouTube, Vimeo, Twitter, …)

Many apps want to embed external content: a YouTube video inside a doc, a tweet pinned to a Note, a SoundCloud track in a Card.

### Why these are dangerous

Each provider's official embed snippet typically loads a `<script>` from their CDN. That script:

- Knows the user's IP.
- Sets cookies tied to the user's account on that platform.
- Sends analytics (view counts, engagement, dwell time) to the platform.
- Can mutate the parent page if not iframed (and even iframed embeds set tracking cookies and run their own JS).

In other words, every embed is a third-party tracker pretending to be content.

### What the shell does instead

> **Decision:** the shell ships an **embed sandbox** for a curated set of providers. The embed sandbox:
>
> 1. Renders the embed in a per-provider, no-cookie, no-storage iframe pinned to `about:blank` with the embed HTML written in.
> 2. Strips third-party tracking parameters from the embed URL.
> 3. Uses **privacy-preserving embed endpoints** where the provider offers them (`youtube-nocookie.com`, Twitter's `cards.twitter.com` snapshot variant, etc.).
> 4. Loads the embed only after the user **explicitly clicks Play** (default behavior — no autoload). The placeholder shows the title/thumbnail fetched via `network.preview`, not via the platform's tracking-laden embed.
> 5. Network requests from the embed iframe are still subject to the broker's policy: the embed iframe gets its own `network.connect:<provider-origin>` derived capability, scoped to the provider's origins only.
> 6. The embed iframe is destroyed when the user navigates away from the page or closes the surface; storage clears with it.

Apps request `network.embed:<provider>` to use a specific provider, or `network.embed:*` to use any registered provider. The user sees per-provider grants.

### Providers in v1

Curated, conservative. *(Reconciled 2026-08-02 against what shipped — the product catalogue, tiers, and insertion surface live in [15-embedding-and-composition.md §External web embeds](../editing/15-embedding-and-composition.md); this list is the security posture per provider.)*

**Shipped** (allowlisted in `classifyUrl`; anything else degrades to a bookmark card):

- `youtube` (via `youtube-nocookie.com`).
- `vimeo` (via `player.vimeo.com`).
- `loom`, `figma`, `codesandbox` (official embed endpoints).

**Next (B11.20b):**

- `google-maps` (keyless `output=embed` endpoint). **No cookie-free variant exists → click-to-load is mandatory for this provider**, not the OQ-164 default; short links (`maps.app.goo.gl`) are *not* resolved (that would need network in the classifier) and stay bookmark cards.
- `openstreetmap` (`export/embed.html` — no cookies; the privacy-friendly map sibling).

**Designed, unshipped (tier 2 — each needs its posture row here before it ships):**

- `twitter` / `x` (snapshot mode, no JS embed; or render as link-preview-only if snapshot endpoint disappears).
- `mastodon`, `bluesky` (federated; per-instance fetched as link previews).
- `spotify`, `soundcloud`, `github-gist`, `codepen`, `miro`.

> **Decision:** v1 ships the curated providers above. Apps cannot register new embed providers in v1. Post-v1: a per-vault user-defined provider list with explicit risk acknowledgement. Curating providers is a security feature, not a gatekeeping move.

> **Gap (as-shipped vs this design, tracked under B11.20b):** the shipped `WebEmbedNode` mounts its iframe directly from the app renderer (`iframe-src-exempt`, minimal `sandbox` + `no-referrer`) and loads on render — the `network.embed:<provider>` capability check and the click-to-load default of this section are **not yet enforced**. The allowlist + official-endpoint mapping ARE enforced (renderer-side re-classification on render, so a hand-edited document cannot iframe an arbitrary origin).

> **Open:** OQ-164 — should every embed default to **click-to-load** (privacy-strict) or **auto-load with placeholder** (UX-friendly)? Tentative leaning: click-to-load. Most embeds the user inserts aren't watched immediately; loading them on render leaks per-page-render. Make auto-load an opt-in per embed via a small affordance.

## The shell's own network traffic

Brainstorm itself talks to the network only when the user has opted in:

| Surface                  | Default in v1 | Opt-in path                                                                |
|--------------------------|---------------|----------------------------------------------------------------------------|
| Update check             | **Off**        | Settings → Updates → "Check for updates automatically".                    |
| Crash reporter           | **Off**        | Settings → Privacy → "Send anonymized crash reports". **Feedback-2 ✅ landed 2026-05-25** (OQ-144 resolved). |
| Telemetry / usage stats  | **Off forever** | No path; we don't collect this. Per [01-vision.md](../foundations/01-vision.md) Principle 9. |
| Sync transport           | **Off until paired** | Vault settings → Multi-device → "Pair this device". Sync endpoint per-vault. |
| AI broker (cloud providers) | **Off until configured** | Settings → AI → "Add provider". User pastes BYO API keys; per [22-ai-foundations.md](../platform/22-ai-foundations.md). |
| Link previews            | **On for normal vaults**, off for privacy-strict | Per-vault Settings → Privacy.                                              |
| Embed providers          | **Click-to-load** by default | Per-vault Settings → Privacy → "Auto-load embeds from these providers".    |

> **Decision:** **a fresh install of Brainstorm on a fresh vault makes zero outbound connections** until the user opts something in. This is the baseline test that gates every release. CI runs a packaged binary in a network-namespaced sandbox; any outgoing packet fails the test.

> **Decision:** the **AI broker** is the largest network-egress surface in normal use. It is documented in [22-ai-foundations.md](../platform/22-ai-foundations.md); this doc references its policy. AI requests go through the network broker like everything else; provider hosts are scoped capabilities; user-paid traffic is per-vault settings.

## Proxy support

### What the shell respects

> **Decision:** the network broker, the shell's update path, the AI broker, the sync transport, and the embed sandbox all share **one proxy configuration**. There is no per-surface override that bypasses it.

Proxy modes, in order of preference:

1. **System proxy** (default). On macOS, read from `scutil --proxy` / `Network.framework` (via Electron's `session.resolveProxy`). On Windows, read from WinHTTP and IE settings. On Linux, read `http_proxy` / `https_proxy` / `no_proxy` env vars; honor GNOME proxy settings where available.
2. **Manual proxy.** User specifies `http://proxy.corp:3128`, optionally a separate `https://` proxy, a SOCKS5 proxy, plus a no-proxy list. Per-vault override is allowed (a home vault and a work vault can use different proxies).
3. **PAC (Proxy Auto-Config).** User pastes a URL or a `.pac` file; Electron's PAC evaluator handles the rest.
4. **Direct.** No proxy.

> **Decision:** Brainstorm's default is **system proxy with a one-click "use direct connection" override**. Corporate users get sync that works on-net and at home with no reconfiguration; privacy-conscious home users on macOS who configured a system-wide MITM proxy for Little Snitch get the same.

### Authentication

- **Basic / digest** — username and password stored in the credentials store (per [29-credentials-storage.md](29-credentials-storage.md)). The shell sends Proxy-Authorization headers; never logs the credential.
- **NTLM / Kerberos / Negotiate** — supported on Windows out of the box via Chromium; on macOS via the OS Kerberos cache when present. Linux requires user-installed Kerberos.
- **PAC with auth-bypass** — supported via standard PAC return values.

> **Open:** OQ-165 — proxy authentication credential prompt UX: native modal at first 407, or surface in Settings only? Tentative leaning: native modal on first encounter per session, with a "remember for this vault" checkbox that persists to the credentials store.

### Corporate HTTPS-inspecting proxies

Many enterprises run a transparent HTTPS proxy that decrypts traffic with a private CA installed on every employee's machine. Brainstorm must coexist:

> **Decision:** Brainstorm uses the **OS root-store** for certificate validation by default, **not** Electron's bundled NSS root store. This means corporate-installed CAs are trusted automatically when the OS trusts them. The same toggle controls whether *additional* user-installed PEM files are loaded for cert-pinning-relaxed sync transports.

> **Open:** OQ-166 — should Brainstorm offer **cert pinning** for shell-owned endpoints (update server, opt-in telemetry) that bypasses OS root? This would defeat an MITM proxy. Two competing concerns: defense against malicious enterprise admins vs. operability in legitimate corporate environments. Tentative leaning: no cert pinning by default in v1 (corporate operability wins); add an opt-in "strict cert" mode for high-threat users in v2.

### Failure modes

A proxy that's unreachable, a PAC that's malformed, a NTLM credential that's wrong — each fails with a typed error and a remediation hint surfaced in Settings → Network → "Why is sync not working?":

- `ProxyUnreachable` — show host + port; offer "Switch to direct".
- `PacEvaluationFailed` — show the script line that threw.
- `ProxyAuthFailed` — re-prompt for credentials; show last-tried username.
- `TlsHandshakeFailed` — show cert subject + issuer; explain "this might be your corporate proxy" if issuer doesn't match a public CA.

> **Decision:** proxy failures never silently degrade. The shell surfaces a visible banner in the dashboard's status bar and a notification once per N hours, plus a detailed diagnostic in Settings.

## Network panel in Settings

> **Decision:** Settings → Privacy → **Network** shows:
>
> - **Active proxy:** what mode (system / manual / PAC / direct), what's resolved for a representative URL.
> - **Per-app egress:** every app with a `network.connect`, `network.fetch`, `network.preview`, `network.embed` grant; per-app traffic byte counters (sent / received, last 7 days); top 10 hosts contacted (or "no hosts contacted").
> - **Recent requests** (last 24h, capped to 1000 entries): timestamp, app, method, host, status, byte count, latency. Filterable. Exportable as JSON for users who want to audit.
> - **Blocked requests:** anything the broker refused (capability missing, scope mismatch, private-network attempt, CSP violation). Same columns. Helps users diagnose "why doesn't this app's feature work" and helps surface malicious behavior.
> - **Provider list for embeds:** which providers are enabled per vault; click-to-load vs auto-load setting per provider.
> - **One-click revoke:** any app's network capabilities can be revoked from this panel.

This is the privacy surface that converts the abstract capability model into something a user can actually understand and act on.

> **Open:** OQ-167 — retention for the network log. Tentative leaning: 7 days rolling, capped at 50 MB; user can export then purge. Per-app counters retain longer (90 days) since they're small.

## Logging hygiene

What we log vs. what we don't:

- **Logged:** request timestamp, calling app, HTTP method, hostname (not full URL), response status, byte count, latency, capability used, outcome.
- **Not logged:** the full URL (query strings can carry tokens), request body, response body, request headers (except a normalized `Content-Type`), response headers (except `Content-Type`, `Content-Length`).

> **Decision:** **hostname only** in the network log, **never** path or query. A request to `https://api.example.com/v1/secret-document-id?token=...` logs as `api.example.com`. This bounds the audit log's sensitivity so the log itself isn't a data-leak vector.

The audit log is encrypted at rest along with the rest of vault data per [09 §Encryption](09-security-and-sandbox.md) (once Stage 3b lands the SQLCipher driver swap).

## Threat model adjustments

Adds to [09 §Threat model](09-security-and-sandbox.md):

| Adversary                          | What this doc commits us to defend against                                                |
|------------------------------------|-------------------------------------------------------------------------------------------|
| **Malicious app exfiltrating data via embed**     | Embed sandboxes are origin-scoped; `network.connect:*` not implied by `network.embed:*`. |
| **Malicious app fingerprinting via preview**      | Previews go through shell-side broker; user IP not disclosed to the app; per-URL cache prevents N-fetch fingerprints. |
| **App probing local network**                     | Private network access requires separate `*.private` capability; default `*` scope excludes it. |
| **Enterprise MITM proxy operator inspecting Brainstorm traffic** | Trust OS root store by default (operability). v2 offers cert-pinned shell endpoints (OQ-166). |
| **Attacker controlling a registered embed provider's CDN**       | Per-embed origin scoping limits blast radius; embed iframe is destroyed on navigate-away. |

### What this doc explicitly does NOT solve

- A user who pastes a URL containing a token (`/?token=...`) — the shell logs only the host, but the **app's preview** of that URL may still render the path. Hygiene around tokens-in-URLs is upstream of Brainstorm.
- A user who installs a privacy-hostile embed provider's app on top of the shell-shipped curated list — that app's manifest will declare its embed origins, but a sufficiently determined hostile provider can still gather what the user explicitly granted. Mitigation: surface providers in Settings, prefer the curated list.
- A compromised OS root store. (No defense; this is below the trust boundary.)

## Cross-doc updates needed

- [09-security-and-sandbox.md](09-security-and-sandbox.md) — link to this doc from the "Network" section; refine the capability list to reflect `network.preview`, `network.embed:<provider>`, `network.fetch:<scope>` split; mention the network broker.
- [22-ai-foundations.md](../platform/22-ai-foundations.md) — AI broker traffic flows through the network broker; cite shared proxy config.
- [25-settings.md](../shell/25-settings.md) — Settings → Privacy → Network panel; per-vault privacy toggle.
- [29-credentials-storage.md](29-credentials-storage.md) — proxy auth credentials stored under per-vault credentials store with `proxy.<host>:<port>` key prefix.
- [17-interoperability.md](../platform/17-interoperability.md) — link previews referenced as a shared service apps consume rather than implement; embed sandbox referenced from "block embedding" discussion.
- [11-open-questions.md](../reference/11-open-questions.md) — OQs 163-167 added.

## Phasing

| Capability                                            | Stage         | Notes                                                                 |
|-------------------------------------------------------|---------------|-----------------------------------------------------------------------|
| Network broker (`network.fetch` + `network.connect` capability-checked) | 4 / 7b        | Capability model already exists in Stage 4; the broker as an IPC service lands when apps first need network — likely 7b's intents bus iteration if a sample app needs network. **Net-1a ✅ 2026-05-24** — `executeNetworkFetch` + SDK proxy + production bindings. **Net-1b ✅ 2026-05-25** — `network.fetch.private` widener cap (SDK opt-in via `allowPrivate: true`, SSRF guard relaxes `LocalHostname` + `PrivateIp` rejections; hard floor unconditional). **Net-1c ✅ 2026-05-25** — `network.preview` cached per-(canonicalUrl, locale) for 24h with 1024-entry LRU, cleared on vault switch, pruned every 30 min, audit log size-rotates at 10 MiB. |
| CSP + webRequest interception in app renderers          | 7b            | Lands with the first non-trivial app renderer wiring.                  |
| Link-preview service (shell-side)                       | 8             | Needs the layout system to render preview cards uniformly. UX in `chrome.actionBar` for paste-link affordances. **Net-1a ✅ 2026-05-24** — `network.preview` HEAD probe + OG / Twitter / JSON-LD extractor. |
| Embed sandbox (YouTube, Vimeo, Twitter)                 | 9             | After the Lexical embed-node plumbing per [15](../editing/15-embedding-and-composition.md). |
| Proxy config: system / manual / direct                  | 7b            | Required for any non-toy network use; system mode is one Electron API call. **Net-1d ✅ 2026-05-25** — `ProxyConfig` keystone (Direct/System/Manual/Pac discriminated union) + `validateProxyConfig` + `matchesNoProxy` + `resolveEffectiveProxy`; `productionApplyProxyConfig` maps the typed config onto `session.defaultSession.setProxy` (Chromium `fixed_servers` rules + `proxyBypassRules`). Default = System (one-click direct override) per doc-38 §Decision. PAC plumbed (mode + storage; Electron evaluates natively) — custom evaluator stays deferred. |
| Proxy config: PAC                                       | 9 (with AI)   | PAC adds little until AI broker / sync transports rely on it.          |
| Proxy auth (Basic, NTLM, Kerberos)                      | 10            | Lands with sync transport.                                             |
| Cert-pinned shell endpoints (opt-in strict mode)        | post-v1       | OQ-166.                                                                |
| Network panel in Settings                               | 12            | Lives in the localization/a11y/perf-budget stage's settings polish. **Net-1f ✅ 2026-05-25** — Settings → Privacy → Network panel: active proxy with per-vault override editor, privacy mode segmented control + allowlist editor, per-app egress (last 7 days, virtualized) with one-click revoke (drops `network.fetch` / `.private` / `network.preview` grants in one go), Recent + Blocked requests tables (virtualized, capped at 1000, filterable by app + host substring) sharing a `<RequestsTable>` primitive, JSON-lines export, preview-cache compact row with Clear-cache confirm, embed-providers placeholder for Stage 9. Six new privileged read-only IPC channels (`network-audit:recent` / `:blocked` / `:per-app-summary` + `network-cache:stats` / `:clear` + `network-broker:state`). Dashboard-only; never broker-exposed. |
| Per-vault Privacy mode toggle                           | 8             | Lands with Settings overlay completion. **Net-1e ✅ 2026-05-25** — `VaultNetworkSettings` (privacy + optional proxy override) persisted at `<vaultPath>/shell/network-settings.json` with default-on-first-read (privacy On for normal paths, Off for privacy-strict paths per OQ-163); privileged `vault:network-settings:get`/`:set` IPC; broker `handlePreview` consults the active vault's privacy config BEFORE the cache lookup and throws typed `PreviewBlocked` with a `reason` field (PrivacyOff / PrivacyManual / PrivacyAllowlistMiss); preview cache wiped on every privacy-mode flip. |

### Net-1 implementation status (2026-05-25)

| Slice | Status | Notes |
|-------|--------|-------|
| Net-1a — broker foundation | ✅ | SSRF guard primitive + `executeNetworkFetch` + broker handler + SDK proxy + `network.preview` HEAD/OG extractor. |
| Net-1b — `.private` cap widener | ✅ | `network.fetch.private` capability + SDK `allowPrivate?: boolean` opt-in. Floor unconditional. |
| Net-1c — preview cache + hardening | ✅ | 24h TTL + 1024-entry LRU per-(canonicalUrl, locale); cleared on vault switch; periodic 30-min prune; audit-log 10 MiB rotation. |
| Net-1d — proxy config (system / manual / PAC) | ✅ | `ProxyConfig` discriminated union + strict validator (per-error-variant enum) + `matchesNoProxy` (exact / leading-dot suffix / leading-star glob / IPv4 CIDR / `*` bypass / IPv6 exact fallback) + `resolveEffectiveProxy` + Electron `setProxy` shape-mapper. `authKey` carries an opaque per-vault credential-store key (doc-29); never an inline password. PAC mode = Electron-native (no custom evaluator v1). Default = System per doc-38 §Decision. |
| Net-1e — per-vault privacy setting | ✅ | `PrivacyMode` enum (Off / On / Allowlist / Manual) + `VaultNetworkSettings { privacy, proxyOverride: ProxyConfig \| null }` + `validatePrivacyConfig` + `validateVaultNetworkSettings` + `isPrivacyStrictPath` (OQ-163 detector: `Private`/`Privacy`/`Secure`/`Confidential` segments, `*-secure*`/`*-private*` globs, `~/Private/` + `~/Documents/Private/` home-relative shortcuts; cross-platform on macOS `/` + Windows `\`) + `defaultPrivacyConfigForPath` (Off for privacy-strict, On otherwise) + `isPreviewAllowed` + `matchesAllowlist`. Shared `host-patterns.ts` matcher extracted so privacy allowlist + proxy `noProxy` cannot drift. JSON-persisted at `<vaultPath>/shell/network-settings.json` (default-on-first-read; corrupt → defaults + re-persist; never throws). Privileged-only IPC: `vault:network-settings:get` / `:set` / `vault:network-settings:changed` (dashboard fan-out) / `app:vault-network-settings-changed` (app staleness signal, payload-free — apps re-discover via the broker's typed error). `network.preview` handler consults the privacy config BEFORE the cache lookup; blocked → typed `PreviewBlocked` error with `reason` field (renderer picks the affordance — Off → grey out; Manual → "Fetch preview" button; Allowlist miss → "Add to allowlist"). Preview cache wiped on every privacy-block flip. Production `getProxyConfig` reader is now vault-aware (per-vault `proxyOverride` else shell-wide default). |
| Net-1f — Privacy → Network egress UI | ✅ | Settings → Privacy → Network panel reading the rotated audit log (newest-first, capped at 1000, virtualized via `@tanstack/react-virtual`), cache stats (`statsSnapshot()` over the LRU cache), per-vault toggle (segmented Off / On / Allowlist / Manual + allowlist tag-input editor), proxy editor (Popover with mode segmented control + conditional fields per mode + per-vault-override checkbox), per-app egress (last 7 days, with revoke that drops `network.fetch` / `.private` / `network.preview` grants in one round-trip), Recent + Blocked requests sharing a `<RequestsTable>` primitive, JSON-lines export, preview-cache compact row with Clear-cache confirm. Privileged-only IPC: six new channels (`network-audit:recent` / `:blocked` / `:per-app-summary` + `network-cache:stats` / `:clear` + `network-broker:state`) mount on the same `registerNetworkSettingsHandlers` call; dashboard-only. Auto-refreshes on `vault:network-settings:changed`. **Net-1 parent now ✅** — all six slices shipped. |

## Open questions (new)

- **OQ-163** — Vault patterns that default link previews to off ("privacy-strict" detection).
- **OQ-164** — Embed default: click-to-load vs auto-load with placeholder.
- **OQ-165** — Proxy auth credential prompt UX (modal-on-407 vs Settings-only).
- **OQ-166** — Cert pinning for shell-owned endpoints (defeats corporate MITM proxy — operability cost).
- **OQ-167** — Network log retention window.
- **OQ-168** — Should app-renderer CSP be configurable per-app (e.g., a browser-style "open URL" app that legitimately wants `connect-src *`)? Tentative leaning: no — such apps go through `network.connect:*` capability and the broker, not via CSP relaxation.

## Summary

- Every app network request flows through a **shell main-process network broker**, capability-checked and audit-logged. Renderers cannot fetch directly.
- The shell ships **first-class link previews** (`network.preview`) and an **embed sandbox** (`network.embed:<provider>`) so apps don't roll their own and don't leak IPs.
- Default is **zero outbound** on a fresh vault. Updates, telemetry, AI, sync, link previews, and embeds are each opt-in (sync at pairing time; previews on-by-default for normal vaults but off in privacy-strict mode).
- The shell **respects system proxy** by default and supports manual, PAC, and direct modes. Per-vault overrides allowed.
- **Corporate HTTPS-inspecting proxies** work because Brainstorm trusts the OS root store.
- **Settings → Privacy → Network** surfaces every host every app has contacted; one-click revoke; exportable log.
- **Logs hostnames, not paths or bodies.** Bounded sensitivity of the audit data itself.
- v1 protects against surprise egress and works in restricted networks; v2 adds cert pinning, broader provider lists, and richer auth.
