# 09 — Security and sandboxing

This doc defines the trust model, isolation strategy, and threat model for Brainstorm. It assumes the architecture in [02-architecture.md](../foundations/02-architecture.md), the app model in [03-app-model.md](../apps/03-app-model.md), and the SDK contract in [08-app-sdk.md](../apps/08-app-sdk.md).

## Threat model

The user is the trust root. Everything else is to varying degrees untrusted.

Adversaries we design against:

- **Malicious app authors** — an installed app may try to exfiltrate data, escalate capabilities, or compromise the shell.
- **Compromised app updates** — an originally honest app whose update has been tampered with.
- **Malicious blocks embedded in user content** — a block reference inside a document points at an app that misbehaves when rendered.
- **Network adversaries** — for any traffic that crosses the network (sync transports, app network calls).
- **Local malware on the user's machine** — partially mitigated; Brainstorm is not a substitute for OS-level security, but should not make things worse.
- **Prompt-injection in AI flows** — user content (notes, emails, comments synced from elsewhere) can contain text that tries to manipulate the model ("Ignore previous instructions and …"). The AI broker mitigates at the broker level (region-tagged prompts, sanitization, output filtering, narrowed capability scope per call). Detail in [22-ai-foundations.md](../platform/22-ai-foundations.md).
- **Cloud-AI data exposure** — if a user enables a cloud AI provider, their plaintext content may reach that provider. The shell surfaces this clearly per call class; provider routing is per the user's explicit configuration. Never silent.

Out of scope (or accepted risk) for v1:

- Side-channel attacks across renderer processes.
- Physical access by someone with the device unlocked.
- Sandbox escapes from V8/Chromium itself (we inherit Electron's security posture; we follow [Electron security guidelines](https://www.electronjs.org/docs/latest/tutorial/security)).

## Trust hierarchy

```
   user
     │
     ▼
   shell (fully trusted)
     │
     ├─► core services (trusted, in shell process)
     │
     ▼
   apps (untrusted; sandboxed; capability-limited)
     │
     ▼
   blocks (untrusted; tighter sandbox; no capabilities)
```

The shell is the trust boundary. Apps are explicitly untrusted: nothing they say is taken at face value, every host-service call is checked.

## Isolation: process model

> **Decision:** every app runs in a renderer process distinct from the shell's main and dashboard processes. Renderers run with:
> - `nodeIntegration: false`
> - `contextIsolation: true`
> - `sandbox: true`
> - A preload script that exposes only the SDK's `brainstorm` global; nothing else from Node or Electron internals.

This is the same posture Electron's security checklist requires for "untrusted content" renderers. We treat *all* app content as untrusted. The dashboard renderer is the exception; it is shell-owned, shell-bundled, and runs with shell privileges.

> **Open:** does each app window get its own renderer process, or do windows of the same app share? Sharing is per-app default; cross-app never share. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

### Why not iframes?

Iframes inside a single renderer are cheaper but share a process with their parent. A bug in app A could potentially read app B's memory. Renderer-per-app gives OS-level isolation. For *blocks* embedded inside another app's window, we use iframes — but the iframe is sandboxed (see Blocks below), and even then the worst-case blast radius is one renderer.

## Capabilities

A **capability** is a named, scoped grant. Capabilities are listed in the manifest, presented to the user at install (and on update if new ones appear), recorded in the capability ledger, and checked on every host-service call.

### Naming convention

`<service>.<verb>[:<scope>]`

Examples:
- `entities.read:io.example/Note/v1` — read entities of one type.
- `entities.write:io.example/Note/v1` — write same.
- `entities.read:*` — read all entity types (heavily prompted; broad).
- `files.open:text/*` — be a default opener for `text/*` MIME types; receive file handles via intent.
- `files.pick` — invoke the file picker on user gesture.
- `network.connect:wss://sync.example.com` — connect to a specific host.
- `network.connect:*` — broad network (heavily prompted).
- `identity.sign` — request signatures from the local user identity.
- `tray.publish` — appear in the system tray.
- `yjs.raw` — direct access to Y.Doc objects (uncommon).
- `notifications.post` — post user-visible notifications.
- `intents.dispatch:open` — dispatch open-intents (most apps need this).
- `intents.handle:open` — register as a handler for open-intents.
- `blocks.publish` — register block components.
- `widgets.publish` — register dashboard widgets.
- `ai.use` — invoke any AI broker call (generate, extract, transform, search). Required for any AI feature.
- `ai.context:<entityType>` — narrow scope: AI calls may include content of these entity types in their prompts.
- `ai.context:*` — broad: any entity content may be packed into prompts (heavily prompted).
- `ai.cost:<budget>` — per-app monthly budget cap on cloud AI; user sets the budget at install.
- `ai.provider:<id>` — restrict an app to specific provider(s) (default: shell-routed); request implies a user-visible provider lock.
- `shortcuts.global` — register a system-wide hotkey that fires when the app is not focused (sensitive; requires explicit grant).

### Granting

> **Decision:** capabilities are granted by the user, never inferred. There is no "implicit" capability beyond a default minimum: `storage.kv` (own keyspace), `intents.dispatch:open`, and the right to render UI in the app's own window.

Two ways to grant:
- **At install** — the manifest declares requested capabilities; the user reviews and approves.
- **At runtime** — `capabilities.request(cap, reason)` triggers a modal prompt with the reason text.

The user can revoke at any time from a single settings panel. Revocation takes effect on the next host-service call; running app windows receive a `capability-changed` event and are expected to degrade gracefully.

### Scoping

Capabilities are *scoped* wherever scoping makes sense. `entities.read:io.example/Note/v1` is much weaker than `entities.read:*`. The shell's capability prompt prefers the narrowest form an app can ask for.

> **Decision:** apps cannot request a broad capability and pretend it is narrow. The capability ledger stores the literal scope the user approved. A request for `entities.read:*` is presented as such, in plain language ("This app wants to read **all** entities of any type. That includes data created by other apps.").

## Blocks

Blocks are a tighter sandbox than apps:

- Loaded as iframes (cross-origin boundary) inside the host app's window.
- No `brainstorm` global. Communicate only via Block Protocol postMessage envelope to the host.
- No filesystem, no network (except as proxied by the host with capability).
- Inherit *no* capabilities. The host calls into entities on the block's behalf, scoped to the entity the block was bound to.
- One block, one entity. A block cannot pivot to inspect another entity it wasn't bound to.

This means a malicious block can, at worst, lie about the entity it was rendering — it cannot read other entities, escalate, or persist anything outside its bound entity.

> **Decision:** the registry of block providers is a soft binding. The user can replace which app provides which block id (e.g. swap one Markdown renderer for another). The shell warns when a block's provider changes.

### The block-frame primitive (Stage 9.5)

The block-frame primitive at `@brainstorm/sdk/block-frame` is the single mount path every BP block runs in. It enforces the above as code, not as policy. The detailed breakdown of which layer enforces which threat is the [Sandbox primitive table](../editing/15-embedding-and-composition.md#sandbox-primitive-stage-95) in the embedding doc. Summary:

1. **iframe attributes** pin sandbox / CSP / Permissions-Policy / referrer / loading at construction.
2. **`srcdoc` stub / `bsblock://` bundle** — the static `iframe-src-check` CI guard (`tools/mcp-server/src/tools/iframe-src-check.ts`) rejects any `iframe.src` write, `iframe.setAttribute("src", ...)` call, or `<iframe src=>` JSX anywhere in `apps/`, `packages/shell/src/`, `packages/sdk/src/`. The inert *stub* frame (no bundle) uses `srcdoc`. A frame running a real app-contributed bundle loads from its own **`bsblock://` origin** instead — because a `srcdoc` document **inherits the embedding app's CSP** (`script-src 'self'`), which would block the bundle's inline script; a separate registered scheme gives the block document its OWN CSP (`block-frame-constants.ts` `BLOCK_FRAME_CSP`, served as a response header by `packages/shell/src/main/blocks/block-frame-protocol.ts`) without weakening the embedding app's. The frame is still `sandbox="allow-scripts"` (opaque origin, no ambient authority); the scheme only decouples the document's CSP. The single `iframe.setAttribute("src", makeBlockFrameUrl(...))` in `block-frame.ts` carries the `// iframe-src-exempt` token; embedding apps grant `frame-src bsblock:` in their own CSP. The guard still catches any *other* `src` write. Escape hatch elsewhere: `// iframe-src-exempt` per call site (only legitimate non-BP iframes like a web-embed-of-URL node).
3. **postMessage transport** (`createBlockFrameTransport` + `createBlockFrameInnerTransport`) is the ONE legitimate cross-boundary channel — three security gates (identity / channel-id / phase) + two bounded-cost gates (per-message size cap, per-second inbound rate-limit) + per-reason drop counters via `dropCounts()` for future telemetry. Per-event logging is intentionally absent (would be a DoS amplifier).

The capability list a block runs with is carried in the transport's first `Startup` envelope but enforcement lives in the broker — the transport is the secure pipe, not the gate. A block that asks for an entity outside its bound `entityId` reaches the broker, gets denied, and the block sees `Unavailable`.

The real-Chromium adversarial pass (opaque-origin proof + sibling-frame spoofing under actual sandbox enforcement; jsdom does not enforce sandbox) is deferred to plan rung 13.3 (Playwright sibling tests).

## Network

> **Decision:** apps have no network access by default. `network.connect:*` is a broad capability with explicit scary-looking prompts. Most apps should ask for narrow scopes.

The shell's own network use (sync transport endpoints, update fetches) is configured in shell settings, not by apps.

> **Open:** how are sync transport endpoints configured per-account vs. per-shell? A multi-device user wants the same sync endpoint on both. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Filesystem

Apps see no filesystem paths. They see opaque `FileHandle`s, granted via:

- The user explicitly invoking the file picker through an app.
- The user opening a file with that app via the shell or another app's intent dispatch.

Handles can be persisted (apps can save them and reuse on next launch), but their underlying paths are not revealed. A handle can be revoked from the settings panel. The shell rate-limits and audits file access; an app reading thousands of files in a tight loop is suspicious and surfaced.

> **Open:** do we expose a "folder watch" capability? Useful for things like a "recent screenshots" widget; risky because folder content changes constantly. Tracked in [11-open-questions.md](../reference/11-open-questions.md).

## Identity and signing

The shell holds an identity keypair for the local user. Apps can request the shell to sign a payload (`identity.sign` capability). The private key never leaves the shell process; apps see only signatures and the public part of the key.

This is what enables, for example, an app to mark an entity it produced with a verifiable signature — without trusting the app with the user's private key.

## Update integrity

> **Decision:** v1 ships without mandatory app signing (apps may install from local packages or URLs). v2 requires signatures.

For v1:
- Updates that change the manifest's identity (id, signature key once we have one) are rejected.
- Updates with new capability requests trigger a re-consent dialog.
- The bundle hash is recorded after install; future updates show the user a diff hash and version delta.

> **Open:** is "auto-update" something Brainstorm offers, or is the user always in the loop? Auto-update is convenient but conflicts with "user is the trust root". Likely: opt-in auto-update for capability-stable updates only. Tracked in [11-open-questions.md](../reference/11-open-questions.md). *[RESOLVED 2026-06-29 — OQ-147: shell-level in-app auto-update (electron-updater, checks GitHub Releases) shipped in v0.1.5, ON by default, disable in Settings → Updates.]*

## Logging and audit

The shell keeps a per-app audit log:

- Capability grants and revocations.
- Significant host-service calls (writes, deletes, network connects, file accesses).
- Anomalies (rate-limit hits, denied calls).

The user can review the audit log per app. Logs do **not** include content (entity payloads, file bytes) — only metadata, so the log itself is not a sensitivity multiplier.

## Encryption

- **At rest** — Yjs storage on disk is encrypted with a key derived from a user-set passphrase or OS keychain entry. v1 may default to OS-keychain to keep onboarding simple; passphrase is an option.
- **In transit** — sync transports are TLS-mandatory. The Yjs payload itself is additionally end-to-end encrypted between the user's devices using identity keys (shipped Stage 10; the relay is blind and sees ciphertext only).
- **Apps** see decrypted entity content; encryption is below the entity layer.

> **Open:** is end-to-end encryption part of v1? It complicates server-relayed sync but gives much stronger guarantees. Tracked in [11-open-questions.md](../reference/11-open-questions.md). *[RESOLVED 2026-06-29 — OQ-18/OQ-26: E2E synced-payload encryption shipped in Stage 10 over a blind relay.]*

## Failure-open vs. fail-closed

> **Decision:** capability checks fail closed. If the capability ledger is unavailable (corrupt, locked), apps cannot make capability-checked calls — they receive `Unavailable`. Better a degraded experience than an undetected escalation.

## What this protects against, summarised

- Malicious app reading the entire entity store: blocked by per-type read capabilities and the principle that apps must declare scope.
- Malicious app exfiltrating data: blocked by default-no-network; broad-network requires explicit per-host or wildcard grant.
- Malicious app reading files: blocked by no-direct-FS and per-handle access.
- Malicious block: blocked by no-capabilities-for-blocks and one-block-one-entity.
- Compromised update: surfaced via diff prompt; capability changes require re-consent.

## What this does not protect against, summarised

- A user who clicks through every prompt without reading.
- A bug in our capability check.
- An OS-level compromise.
- A disgruntled-but-clever app that does damage *within* its granted capabilities (e.g. an app granted `entities.write:Foo` corrupting Foo entities). Mitigation: undo via Yjs history, recoverable soft-deletes, audit log to inform revocation.
