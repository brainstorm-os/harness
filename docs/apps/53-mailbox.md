# 53 — Mailbox (email as entities)

This doc introduces a first-party **Mailbox app** (`brainstorm.mailbox`) and the canonical types it brings: `brainstorm/Email/v1`, `brainstorm/MailAccount/v1`, `brainstorm/MailFolder/v1`. It closes the single largest reason a knowledge-tool user still alternates with another application all day: their inbox. Email is where tasks are born, where documents arrive, where decisions are recorded — and prior local-first tools left it entirely outside the graph. Brainstorm pulls it **inside**, as entities, so automations, AI, search, Graph, and the Agent app all operate on mail the same way they operate on everything else.

It builds on [03-app-model.md](03-app-model.md) (apps as packages, no background daemons), [08-app-sdk.md](08-app-sdk.md) (host services + intents), [17-interoperability.md](../platform/17-interoperability.md) (intents are *the* cross-app vocabulary), [38-network-and-proxy.md](../security/38-network-and-proxy.md) (all egress through the network broker), [29-credentials-storage.md](../security/29-credentials-storage.md) (OAuth tokens / app passwords in Tier 2), [22-ai-foundations.md](../platform/22-ai-foundations.md) (AI triage), [39-automations-and-workflows.md](39-automations-and-workflows.md) (`Email/v1` is the entity its examples already assume), [21-objects-and-collections.md](../data/21-objects-and-collections.md) (email lives in the one shared object space), [18-storage-and-search.md](../data/18-storage-and-search.md) (mail is indexed like any entity), and [56-connector-framework.md](56-connector-framework.md) (Mailbox is the framework's reference connector).

## Why a first-party app, not a bridge left to the ecosystem

[39 §Step composition examples](39-automations-and-workflows.md) already writes workflows against `brainstorm/Email/v1` and calls the source "a hypothetical email-bridge app". That hypothetical is load-bearing — three product pillars (Automations, the Agent app, Graph) cite it — so it should not stay hypothetical and should not be left to a third party whose quality and trust we don't control.

> **Decision:** Mailbox is **first-party** (bundled with the shell, like file-manager and automations — see [03 §Multiple windows / kinds](03-app-model.md)). It is also the **reference implementation of the connector framework** ([56](56-connector-framework.md)): every architectural choice here is the connector contract applied to the hardest real case (long-lived sockets, OAuth, large blobs, immutable-vs-editable content). A third-party Outlook/Fastmail/Proton connector later reuses the same `MailAccount/v1` + transport surface.

> **Decision:** email is **entities, not a private mailbox silo**. An `Email/v1` is a normal object in the single object space ([21](../data/21-objects-and-collections.md)). Consequence: a Database list can be "Emails where `from` is in my Investors collection", Graph paints sender→thread→task edges, the Agent app cites a message by `brainstorm://entity/<id>`, and an Automation fires on `entity-event onCreate brainstorm/Email/v1` — none of these need a Mailbox API.

## The shell-vs-app split (the load-bearing decision)

Apps are sandboxed renderers with no socket access and no background lifecycle ([03 §Lifecycle](03-app-model.md)). IMAP `IDLE`, JMAP `EventSource`, and SMTP submission are **long-lived TLS sockets**, and mail must keep arriving while the Mailbox window is closed. So, exactly as the scheduler/runner is shell-side for Automations ([39 §Scheduler](39-automations-and-workflows.md)) and the sync transport is a worker:

> **Decision:** the protocol engine is a **shell-side `MailTransport` core service** (a `utilityProcess` worker alongside storage / ydoc / sync, per [12 §Process model](../shell/12-shell-architecture.md)). It owns the IMAP/JMAP/SMTP connections, the fetch cursor, the idle-reconnect loop, and the projection of fetched messages into `entities.db`. The Mailbox **app** is the designer and viewer only: it reads `Email/v1` entities through the entities service and dispatches `compose` / `send` / `reply` intents. If the Mailbox window is closed, mail still syncs; that is the whole point — same as a scheduled task not needing its config app open.

> **Decision:** the network broker ([38](../security/38-network-and-proxy.md)) is request/response-oriented; mail needs a **brokered long-lived transport channel**. `MailTransport` opens its sockets through a broker primitive scoped by a new `network.connect:<mail-host>` grant (the existing `network.connect` capability already covers non-HTTP long-lived connections — [38 §Capability namespace](../security/38-network-and-proxy.md) splits `connect` from `fetch` precisely so WebSocket/SSE/raw-TLS is a separate, scarier grant). Egress is still capability-checked, proxy-respecting, and audit-logged in **Settings → Privacy → Network** like every other request. The renderer never sees the socket or the credentials.

## Entity types

### `brainstorm/MailAccount/v1`

One configured account. Holds **no secrets** — the OAuth token / app-password lives in the credential store ([29 §Tier 2](../security/29-credentials-storage.md)) keyed by account id, owned by the Mailbox scope; the shell injects auth into `MailTransport` requests, the renderer never holds it (same shape as the AI broker injecting provider keys, [22](../platform/22-ai-foundations.md)).

| Property | Type | Notes |
|----------|------|-------|
| `address` | text, count `{1,1}` | The email address. |
| `displayName` | text, count `{0,1}` | Outgoing "From" name. |
| `protocol` | text + vocabulary, count `{1,1}` | `imap` \| `jmap` \| `gmail-api` \| `ms-graph`. Use the `MailProtocol` enum. |
| `authKind` | text + vocabulary, count `{1,1}` | `oauth2` \| `app-password` \| `basic`. `oauth2` flows through the connector OAuth broker ([56 §OAuth broker](56-connector-framework.md)). |
| `incoming` / `outgoing` | jsonValue, count `{1,1}` | Host/port/TLS for IMAP+SMTP; absent for JMAP/API (single endpoint). |
| `syncWindow` | text + vocabulary, count `{1,1}` | `30d` \| `90d` \| `1y` \| `all`. Bounds the initial backfill (mirrors selective sync, [20](../data/20-database-growth-and-sync.md)). |
| `enabled` | boolean, count `{1,1}` | Pause without removing. |

### `brainstorm/MailFolder/v1`

A server folder/label, mirrored so folder views work offline and so a folder is addressable (`brainstorm://entity/<id>`). `{ accountRef, path, role (inbox|sent|drafts|archive|trash|spam|custom), unreadCount }`.

### `brainstorm/Email/v1`

The message. **Received mail is immutable**; only user-authored state (flags, tags, the draft body of a reply) is mutable.

| Property | Type | Notes |
|----------|------|-------|
| `accountRef` / `folderRefs` | entityRef(s), count `{1,1}` / `{1,∞}` | A message can be in multiple labels (Gmail). |
| `messageId` | text, count `{1,1}` | RFC 5322 `Message-ID`; the stable dedupe + idempotency key across devices. |
| `threadKey` | text, count `{0,1}` | Server thread id or References-derived; threads surface as a `List/v1` view, not a new type. |
| `from` / `to` / `cc` | entityRef[] → `Person/v1`, count varies | Resolved to `Person/v1` ([9.12.13 People](../implementation-plan-table.md)) where the address matches; Graph edges fall out for free. |
| `subject` | text, count `{0,1}` | Indexed (FTS5, [18](../data/18-storage-and-search.md)). |
| `receivedAt` | dateTime, count `{1,1}` | Sort + calendar projection. |
| `bodyText` / `bodyHtmlSafe` | text / richText, count `{0,1}` | Immutable. HTML is sanitized + rendered through the **embed-sandbox model** ([38 §Embeds](../security/38-network-and-proxy.md)): remote images/CSS blocked by default, click-to-load "Show remote content", no scripts, no cookies. Hostile HTML mail is the same threat class as a hostile embed. |
| `attachments` | entityRef[] → file entities, count `{0,∞}` | Each attachment is a file entity in a `Folder/v1` ([30](30-file-manager-and-folders.md)); large blobs ride the chunked-upload path (impl-plan 9.10a / OQ-188), not a single IPC envelope. |
| `flags` | text[] + vocabulary, count `{0,∞}` | `unread` \| `flagged` \| `answered` \| `draft`. Mutable; written back to the server by `MailTransport`. |
| `tags` | entityRefs, count `{0,∞}` | Personal taxonomy — vault-local, never pushed to the server. |
| `aiProvenance` | block, count `{0,1}` | Set when an AI step classified/extracted from this message ([22 §Provenance](../platform/22-ai-foundations.md)). |

> **Decision:** an inbound body is stored as an immutable entity property, **not** a Yjs CRDT doc — there is no concurrent editing of received mail; CRDT overhead would be pure cost. A **draft** (compose / reply) *is* a Yjs doc (same substrate as Notes, [06](../editing/06-collaboration-yjs.md)) so it composes with the editor, survives a crash, and merges across the user's own devices. A draft promotes to an immutable `Email/v1` on send.

> **Decision:** flags and tags are split. **Flags** are server state (`\Seen`, `\Flagged`) and sync back. **Tags** are vault-local personal taxonomy and never leave the device — the same privacy boundary the rest of Brainstorm holds. A user can tag every recruiter mail "noise" without telling their mail provider.

## Sending — as intents, not a Mailbox API

Composition reuses the editor; sending is an intent so any app can trigger it (the Agent app, an Automation, a "email this note" command):

- `intent.compose` ({ to?, subject?, bodyRef?, accountRef? }) → opens the Mailbox composer pre-filled. Selected text in Notes + `/email` → compose with that text quoted.
- `intent.send` (draft entityRef) → `MailTransport` performs SMTP/JMAP submission, writes the resulting immutable `Email/v1` into the Sent folder, idempotent on a client-stamped submission id (resend-after-crash is safe).
- `intent.reply` / `intent.forward` (email entityRef) → composer seeded with quoted thread + recipients.

> **Decision:** outbound submission is **idempotent and shell-side**. The composer can be closed the instant Send is pressed; `MailTransport` owns the retry. A submission stamps a `submissionId`; the Sent-folder projection rejects a duplicate id, so a flaky network never double-sends. Same idempotency discipline as Automations' per-fire id ([39 §Failure modes](39-automations-and-workflows.md)).

## Sync model

Mirrors [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md): **initial** (bounded by `syncWindow`), **selective** (folders the user opted in), **incremental** (IMAP `IDLE` / JMAP push / Gmail history-id / Graph delta). The fetch cursor persists in `registry.db` so a restart resumes, not refetches. Conflict policy: server is authoritative for message existence and flags; vault is authoritative for tags and AI-derived properties (disjoint by construction, so no merge conflict).

## Agentic surface — the payoff

This is the doc 39 example, now real:

```
[Trigger: entity-event onCreate brainstorm/Email/v1, filter folder.role=inbox]
  → [AIAgent: "Classify: action-required | informational | newsletter | spam.",
              tools=[], outputSchema={class: enum, summary: string}]
  → [Branch: agent.class === "action-required"]
      → [Intent: extract Tasks from body → Tasks app]
      → [Notify: agent.summary]
    [Branch: agent.class === "newsletter"]
      → [Entity: add tag "reading" to the Email]
```

- **Automations** ([39](39-automations-and-workflows.md)): `Email/v1` is a first-class `entity-event` trigger source; the n8n-style AI-agent step classifies/extracts within the workflow's capability envelope.
- **Agent app** ([55](55-agent-app.md)): "reply to Dana confirming Thursday and file the thread under Project Atlas" — the agent dispatches `intent.reply` + tag intents as **tools it was granted**, three-tier fail-closed (agent-tools ⊆ Agent-app-caps ⊆ user grant), per [39 §Capabilities](39-automations-and-workflows.md). The user never left the product to do their email.
- **Search/Graph**: mail is FTS5+vector indexed ([18](../data/18-storage-and-search.md)/[22](../platform/22-ai-foundations.md)); sender↔thread↔task edges are automatic because participants resolve to `Person/v1`.

## Capabilities & security

| Capability | Why |
|------------|-----|
| `network.connect:<mail-host>` | The brokered long-lived IMAP/SMTP/JMAP socket. Scoped to the account's hosts only; `*` is **not** implied. |
| `credentials.read/write:self` | `MailTransport` reads the account token from Tier 2 ([29](../security/29-credentials-storage.md)); the renderer never does. |
| `entities.read/write:brainstorm/Email/v1` (+ `MailAccount`/`MailFolder`) | Project + read mail. |
| `intents.dispatch:compose,send,reply` | Sending is intent-mediated. |
| `ai.use` (optional) | Only if the user enables AI triage; per-app quota ([22](../platform/22-ai-foundations.md)). |

- HTML mail renders in the embed sandbox: no JS, no cookies, no remote fetch until the user clicks "Show remote content" (tracking-pixel defeat is the headline privacy win — most webmail leaks an open-receipt on render; Brainstorm does not).
- The OAuth client secret and token never cross IPC into the renderer; the shell injects auth in `MailTransport` (the [29](../security/29-credentials-storage.md) "apps never see the key" invariant, applied to mail).
- Threat-model addition: a malicious *other* app cannot read `Email/v1` without an explicit `entities.read:brainstorm/Email/v1` grant the user reviews — mail is not ambiently readable just because it is in the shared space (the [09](../security/09-security-and-sandbox.md) per-type grant gate already enforces this).

## Performance budgets

| Metric | Budget |
|--------|--------|
| New-mail visible after server delivery (IDLE/push active) | < 10s p95 |
| Mailbox open → inbox first paint (cached) | < 200ms p95 (per [13](../shell/13-frontend-stack.md)) |
| Body render (sanitized HTML, remote blocked) | < 50ms p95 |
| Initial backfill rate | ≥ 50 msg/s (metadata), bodies lazy |
| Memory: `MailTransport` worker steady-state | < 80 MiB per account |

## Non-goals (v1)

- **Full webmail feature-parity.** No rules engine *inside* Mailbox — rules are Automations ([39](39-automations-and-workflows.md)); that is the entire point of not bolting a half-grammar onto every app (CLAUDE.md / [39 §Why a dedicated app](39-automations-and-workflows.md)).
- **PGP / S/MIME.** Encryption-at-rest covers stored mail; end-to-end mail crypto is post-v1 (OQ-MB-5).
- **Calendar-invite (iTIP) handling.** Parsing `.ics` into `Event/v1` is a Calendar-app concern reached via intent; v1 surfaces the attachment, v2 wires the round-trip.
- **Exchange/EWS legacy protocol.** Microsoft 365 via Graph API only; on-prem Exchange is v2.
- **Sieve / server-side filters.** Vault-local Automations only; we do not write server filter scripts in v1.

## Phasing

| Capability | v1 | v2 |
|------------|----|----|
| `MailAccount` / `MailFolder` / `Email` types + `MailTransport` worker | ✓ | — |
| IMAP + SMTP (app-password / Basic) | ✓ | — |
| OAuth2 (Gmail, Microsoft 365) via the connector OAuth broker | ✓ | — |
| JMAP | ✓ | — |
| Sanitized HTML render in embed sandbox; click-to-load remote | ✓ | — |
| Compose/reply/forward as intents; idempotent send | ✓ | — |
| `entity-event` trigger source for Automations; AI triage step | ✓ (rides 11 / 11b) | — |
| Attachments as file entities | ✓ | — |
| iTIP calendar invites round-trip | — | ✓ |
| PGP / S/MIME | — | ✓ |
| On-prem Exchange / EWS | — | ✓ |
| Unified inbox across accounts as a saved `List/v1` | ✓ (it is just a list) | — |

## Open questions surfaced by this doc

- **OQ-MB-1** *[RESOLVED in implementation-plan Mailbox-2, 2026-06-08]* — `MailTransport` gets **its own `utilityProcess` worker** (`workers/mailbox/`), alongside storage/ydoc/extraction. Isolation (a wedged mail socket can't stall the sync transport) won over process-count thrift; the resilient-worker respawn machinery already amortises the cost.
- **OQ-MB-2** *[RESOLVED in implementation-plan Mailbox-2, 2026-06-08]* — **Special-case mail in the broker, not a generic `network.socket` channel.** The long-lived socket lives **inside the driver** in the mailbox worker; the worker's RPC surface is `_shell`-gated (no renderer reaches it) and egress is still scoped by `network.connect:<mail-host>`. A generic typed socket channel was rejected as a far larger attack surface for one consumer; it can still be generalised later if a second long-lived-socket consumer appears.
- **OQ-MB-3** *[RESOLVED in implementation-plan Mailbox-1, 2026-06-08]* — **Derive `threadKey` ourselves, preferring a provider thread id when present.** `deriveThreadKey` precedence: provider `threadId` → `References` root → `In-Reply-To` → own `Message-ID`. Honours Gmail/JMAP grouping where it exists, stays cross-provider consistent where it doesn't.
- **OQ-MB-4** *[RESOLVED in implementation-plan Mailbox-1, 2026-06-08]* — **Hard cap + newest-first pagination, not refuse.** `syncWindow=all` is bounded by `SYNC_WINDOW_ALL_MAX_MESSAGES` (50k/account); the backfill walks newest-first and stops at the cap, so a 200k-message mailbox can't exhaust the storage budget.
- **OQ-MB-5** — PGP/S/MIME key custody: reuse the credential store, or a separate keyring scope? (Defer to v2 but decide the data shape now.) *(Still open — v2; the `Email/v1` shape carries no crypto fields yet.)*
- **OQ-MB-6** *[RESOLVED in implementation-plan Mailbox-7, 2026-06-08]* — **Link-to-existing, never auto-create.** A participant address resolves to a `Person/v1` only when it already matches a contact's email (`person-resolver.ts`); a Person is never created on first sight (avoids contact-list pollution from newsletter senders). The user promotes an address explicitly in Contacts. Overlaps OQ-CT-1.

## Summary

- One first-party app turns the inbox — the biggest reason users leave a knowledge tool — into entities in the shared object space.
- The protocol engine is a **shell-side `MailTransport` worker** (mail keeps flowing with the window closed); the app is designer + viewer; sending is an idempotent intent.
- Received mail is immutable; drafts are Yjs; flags sync to the server, tags stay vault-local.
- HTML mail is rendered through the existing embed sandbox — no scripts, no trackers, click-to-load remote content.
- Mailbox is the **reference connector** for [56](56-connector-framework.md); OAuth + token custody reuse the shell broker so the renderer never holds a secret.
- The agentic payoff is concrete: Automations trigger on `Email/v1`, the Agent app sends/triages mail as granted intents — the user does their email without leaving.
