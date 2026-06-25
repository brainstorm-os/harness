# 56 — Connector framework (the outside world, as entities)

This doc defines the **connector framework**: a standard, signed **bridge-app contract** plus a shell-side **OAuth / credential / sync broker** that lets *any* external system — Gmail, Google Calendar, Slack, GitHub, Jira, Linear, Notion, Salesforce, an S3 bucket, a company's internal REST/GraphQL API — be wrapped as an installable, sandboxed, capability-scoped **connector** that mirrors external resources into vault entities and exposes intents. It is the scalable form of "make users leave the app less": rather than one bespoke first-party app per service, one contract that the whole ecosystem (and every enterprise's internal IT) can target. It introduces `brainstorm/Connector/v1`, `brainstorm/ConnectorAccount/v1`, `brainstorm/SyncMapping/v1`, `brainstorm/SyncRun/v1`.

It builds on [03-app-model.md](03-app-model.md) (apps as signed packages, no daemons), [08-app-sdk.md](08-app-sdk.md) (manifest, capabilities, host services), [14-app-store.md](14-app-store.md) + [32-store-verification.md](32-store-verification.md) + [47-marketplace.md](47-marketplace.md) (signed distribution, continuous trust, content-kind registry), [17-interoperability.md](../platform/17-interoperability.md) (intents are *the* integration vocabulary; format I/O), [29-credentials-storage.md](../security/29-credentials-storage.md) (token custody, Tier 2 per-app keyspace, "apps never see the key"), [38-network-and-proxy.md](../security/38-network-and-proxy.md) (egress scoping + audit), [22-ai-foundations.md](../platform/22-ai-foundations.md) (connectors expose intents the agent uses as tools), [39-automations-and-workflows.md](39-automations-and-workflows.md) (the scheduler runs periodic sync; automations consume connectors), [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md) (the initial/selective/incremental + cursor model, reused for external→vault sync), and [53-mailbox.md](53-mailbox.md) (Mailbox is the reference connector).

## Why a framework, not N apps

Three of this repo's "leave less" surfaces are really the same shape: Mailbox ([53](53-mailbox.md)) authenticates to a provider, mirrors remote resources into entities, exposes intents, syncs on a schedule. Calendar/Contacts bridges, Slack, GitHub issues, Jira, a CRM — all the same shape. Building each as a snowflake means N auth flows, N token-custody mistakes, N sync engines, N audit surfaces. And it leaves **B2B stranded**: an enterprise's value is in *their* internal systems, which no first-party app will ever cover.

> **Decision:** there is **one connector contract** and **one shell-side broker**. A connector is a normal signed, sandboxed app ([03](03-app-model.md)/[14](14-app-store.md)) that declares a connector manifest section; it never holds OAuth client secrets or raw tokens, never opens its own sockets, and never runs in the background. The shell owns auth, token refresh, egress, scheduling, and the entity projection. Mailbox is the reference implementation, not a special case.

> **Decision:** this is the **B2B unblock**. Orgs publish **private/unlisted connectors** sideloaded or via an org channel ([47 §fee mechanics](47-marketplace.md): sideload is always 0%; private listings carry no catalog fee) targeting their internal APIs. The same contract that wraps Gmail wraps `https://erp.acme.internal`. Enterprise integration becomes "install a signed connector", reviewed on the standard capability sheet, with full egress audit — not a services engagement.

## The custody invariant (the load-bearing security decision)

> **Decision:** a connector **never possesses the OAuth client secret or the access/refresh token**. Auth flows through the shell **OAuth broker**: the connector calls `oauth.authorize(provider)`, the shell runs the Authorization-Code-with-PKCE flow, owns the redirect (loopback `http://127.0.0.1:<ephemeral>` or a registered `brainstorm://oauth/<connector>` scheme — OQ-CN-2), stores the tokens in the credential store Tier 2 ([29](../security/29-credentials-storage.md)) keyed by `ConnectorAccount` id, owned by the connector's scope, and **refreshes them shell-side**. The connector makes external calls via `connectors.request({ accountRef, method, path, body })`; the shell injects `Authorization`, applies the proxy and the connector's declared egress scope ([38](../security/38-network-and-proxy.md)), and returns the response. This is exactly the AI-broker pattern ([22](../platform/22-ai-foundations.md): "apps never see the API key") and the [29 §AI provider keys](../security/29-credentials-storage.md) custody model, generalized. A compromised connector cannot exfiltrate a token it was architecturally never given; its blast radius is the scoped requests the user reviewed.

> **Decision:** a connector's network egress is **its declared origins only**. The manifest lists the exact hosts (`api.github.com`, `*.slack.com`); the broker enforces `network.connect:<those>` and **refuses anything else**, logged in **Settings → Privacy → Network** ([38](../security/38-network-and-proxy.md)) per host. `network.connect:*` is *not* granted to connectors — a connector that wants to talk to arbitrary hosts is rejected at review. (Contrast the Web Browser's `web.browse` ([54](54-web-browser.md)) — different surface, different scarce capability.)

## Entity types

### `brainstorm/Connector/v1`

An installed connector configuration (the app provides the code; this is the user's instance of it). `{ connectorAppId, displayName, enabled, egressOrigins (frozen from manifest, shown read-only), defaultSyncInterval }`.

### `brainstorm/ConnectorAccount/v1`

One authenticated account on a connector (a user may have two GitHub accounts). **Holds no secret** — the token lives in Tier 2 keyed by this entity's id; this row holds only `{ connectorRef, externalAccountLabel, scopesGranted, authState (active|expired|revoked), lastAuthAt }`. Revoking deletes the Tier 2 token and flips `authState`.

### `brainstorm/SyncMapping/v1`

The declarative heart: how an external resource type maps to a vault entity type.

| Property | Type | Notes |
|----------|------|-------|
| `accountRef` | entityRef → `ConnectorAccount/v1`, count `{1,1}` | |
| `externalKind` | text, count `{1,1}` | e.g. `github:issue`, `gcal:event`, `slack:message`. |
| `entityType` | text, count `{1,1}` | The vault type it projects to (`Task/v1`, `Event/v1`, `Note/v1`, a user `List/v1`…). |
| `fieldMap` | jsonValue, count `{1,1}` | External field → property, via the composable property model ([19](../data/19-properties-and-schemas.md)); declared by the connector, user-overridable. |
| `direction` | text + vocabulary, count `{1,1}` | `pull` \| `push` \| `two-way`. Per-mapping. Use the `SyncDirection` enum. |
| `conflictPolicy` | text + vocabulary, count `{1,1}` | `external-wins` \| `vault-wins` \| `two-way-merge`. Default `external-wins` for `pull`. |
| `filter` | jsonValue, count `{0,1}` | e.g. "issues assigned to me, open". Bounds volume (selective sync, [20](../data/20-database-growth-and-sync.md)). |
| `cursor` | jsonValue, count `{0,1}` | Delta cursor (ETag / `updated_since` / webhook checkpoint). Persists so restart resumes. |

> **Decision:** external resources project into the **single object space** ([21](../data/21-objects-and-collections.md)) as the *same* canonical types the rest of Brainstorm uses — a GitHub issue becomes a `Task/v1`, a Google Calendar event an `Event/v1`. It does **not** invent `GithubIssue/v1`. Consequence: an imported issue is just a Task — it appears in the Tasks app, on the Calendar, in Graph, in a Database list, and the Agent app reasons over it with zero connector-specific code. A `connector.source` value-meta field ([19 §valueMeta](../data/19-properties-and-schemas.md)) records provenance and the round-trip handle.

### `brainstorm/SyncRun/v1`

Every sync execution, mirroring `WorkflowRun/v1` ([39](39-automations-and-workflows.md)): `{ mappingRef, startedAt, status, pulled, pushed, conflicts, error, costNote }`. Surfaced in the connector's Runs view; auto-pruned (default 90 days).

## Sync model — reuse, don't reinvent

Sync **is** [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md) pointed at an external source instead of Yjs: **initial** (filtered backfill), **selective** (only mapped/filtered resources), **incremental** (provider delta API or webhook). The periodic trigger is the **Automations scheduler** ([39 §Scheduler](39-automations-and-workflows.md)) — a connector does **not** run its own timer (apps have no background lifecycle, [03](03-app-model.md)); a `SyncMapping` registers a `Time` (or `Webhook`) trigger whose handler is `connectors.sync(mappingRef)`. Webhook-in connectors pair with [39 §Trigger kinds](39-automations-and-workflows.md)'s `Webhook` trigger and the network broker's ingress ([38](../security/38-network-and-proxy.md)). Idempotency: every external resource carries a stable external id; the projection upserts on it (same discipline as Mailbox `messageId` / Automations fire-id) so a re-run never duplicates.

## Trust & distribution

- Connectors are signed apps under [14](14-app-store.md) with **continuous store-level verification** ([32](32-store-verification.md)): a connector that starts contacting an origin outside its frozen manifest set is a quarantine signal.
- The capability sheet at install shows, in plain language: which **provider** it authenticates to, the **egress origins**, the **OAuth scopes** it will request, and **which entity types it will write**. Same review surface as any app ([09](../security/09-security-and-sandbox.md)) — no new consent UI.
- Revoke = disconnect (delete Tier 2 token) + a choice: keep mirrored entities (they become plain vault objects, frozen) or purge them. Never a silent half-state.
- Marketplace: connectors are a **content-kind** in the [47 §extensible content-kind registry](47-marketplace.md) ("connector pack"); the [47](47-marketplace.md) plugin slot reserved for v2 generalizes here. Org-private connectors use the sideload / private-channel path (0% fee).

## Agentic surface

Connectors are where the agent's reach becomes unbounded *safely*:

- Each connector's intents (`open`/`create`/`update`/`export` on the mapped types, plus connector-specific verbs) are **tools** the Agent app ([55](55-agent-app.md)) and Automations agent-step ([39](39-automations-and-workflows.md)) can be granted — three-tier fail-closed, no new mechanism.
- *"File this Slack thread as a Task and assign it to me"*, *"open a GitHub issue from this bug note"*, *"sync my Jira board into a Database every hour"* — the first two are agent tool calls, the third is a `SyncMapping` on a `Time` trigger. The user never opens Slack/GitHub/Jira.
- B2B: an enterprise's private connector to their internal ERP exposes intents; the org's Automations and Agent app operate the ERP from inside Brainstorm, audited, capability-bounded.

## Performance budgets

| Metric | Budget |
|--------|--------|
| `oauth.authorize` round-trip (excl. user consent + provider) | < 300ms shell overhead p95 |
| `connectors.request` proxy/auth-inject overhead | < 30ms p95 over the raw network call |
| Incremental sync overhead per changed resource | < 20ms p95 (excl. provider latency) |
| Initial backfill rate | ≥ 100 resources/s (metadata) |
| Max active `SyncMapping` per vault | 200 (soft) / 2000 (hard) |
| Default `SyncRun` retention | 90 days |

## Non-goals (v1)

- **Bundling third-party connectors in the shell.** Connectors are apps ([39 §Non-goals](39-automations-and-workflows.md) already states this for SaaS bridges). The shell ships the *framework* + the Mailbox reference connector; the catalog grows through the marketplace.
- **A general ETL / data-warehouse.** Connectors mirror resources into canonical entities for use *in Brainstorm*, not arbitrary table replication.
- **Two-way for everything.** `direction`/`conflictPolicy` are per-mapping and default to safe `pull`/`external-wins`. Full bidirectional sync of a complex external system is opt-in per mapping and explicitly the connector author's contract to honor.
- **Connectors with their own background daemon or arbitrary egress.** Sync is shell-scheduled; egress is the frozen origin set; `network.connect:*` is rejected at review.
- **Org-private connector portal.** The developer-portal path for *private* org connectors (signing, distribution to just-our-org) is v2, on the [47 §developer portal](47-marketplace.md) timeline.

## Cross-doc reconciliation needed

Tracked as a follow-up; not edited here:

- **[53-mailbox.md](53-mailbox.md)** — already forward-references this doc; confirm `MailAccount/v1`'s OAuth path is "the connector OAuth broker", not a Mailbox-private flow (it is, by this doc's custody invariant).
- **[47-marketplace.md](47-marketplace.md)** — register "connector" as a first-class content-kind in the registry; tie the reserved plugin slot to this contract.
- **[39-automations-and-workflows.md](39-automations-and-workflows.md)** — the `Webhook` trigger + scheduler are the connector sync substrate; add the back-reference.
- **[29-credentials-storage.md](../security/29-credentials-storage.md)** — add `oauth:<connector>:<account-id>` to the Tier 2 key examples; note shell-side refresh ownership.

## Phasing

| Capability | v1 | v2 |
|------------|----|----|
| Connector manifest section + `Connector`/`ConnectorAccount`/`SyncMapping`/`SyncRun` types | ✓ | — |
| Shell OAuth broker (Auth-Code + PKCE, shell-owned redirect, shell-side refresh) | ✓ | — |
| `connectors.request` (auth-injected, egress-scoped, audited) | ✓ | — |
| Pull + selective + incremental sync via the Automations scheduler | ✓ | — |
| Push / two-way per-mapping with conflict policy | ✓ (basic) | ✓ (richer merge) |
| Webhook-in connectors (network ingress) | ✓ (rides 38/39) | — |
| Mailbox as reference connector | ✓ ([53](53-mailbox.md)) | — |
| Calendar / Contacts / Slack / GitHub / Jira / Linear connectors | a starter set | broad catalog |
| Marketplace "connector" content-kind | ✓ ([47](47-marketplace.md)) | — |
| Org-private signed connector distribution | sideload only | ✓ (dev portal) |
| Connector-authored intents as agent tools | ✓ ([55](55-agent-app.md)/[39](39-automations-and-workflows.md)) | — |

## Open questions surfaced by this doc

To be added to [11-open-questions.md](../reference/11-open-questions.md) via the dev-MCP `oq.*` path:

- **OQ-CN-1** — Manifest schema for `fieldMap`/`SyncMapping`: fixed connector-declared map, or user-editable mapping UI in v1? Lean: connector ships a default, Settings exposes overrides.
- **OQ-CN-2** — OAuth redirect mechanism: ephemeral loopback `127.0.0.1` (works everywhere, firewall-sensitive) vs. registered `brainstorm://oauth/...` custom scheme (clean, OS-registration-dependent). Lean: loopback primary, custom-scheme fallback.
- **OQ-CN-3** — Two-way conflict UX when `two-way-merge` can't auto-resolve: queue for user, last-writer-wins, or block the mapping? Lean: queue + a conflicts view in the connector app.
- **OQ-CN-4** — Token refresh failure / revoked-upstream handling: silent disable + notify, or block sync with a banner? Lean: disable the mapping, surface in Settings, notify once.
- **OQ-CN-5** — Should the framework expose a typed long-lived-socket channel (shared with [53 OQ-MB-2](53-mailbox.md)) for streaming connectors (IMAP IDLE, Slack RTM), or is HTTP+webhook sufficient for v1? Lean: HTTP+webhook in v1; Mailbox's brokered socket is the one exception until OQ-MB-2 generalizes it.
- **OQ-CN-6** — Marketplace trust tier for connectors: do connectors (high egress + token custody) require a stricter review lane than ordinary apps in [32](32-store-verification.md)? Lean: yes — a dedicated connector review tier.

## Summary

- One **signed bridge-app contract** + one **shell OAuth/credential/sync broker** turns any external system into a sandboxed, capability-scoped connector — the scalable form of "everything inside".
- The **custody invariant**: a connector never holds the client secret or token; the shell injects auth and enforces the frozen egress origin set — the AI-broker/[29](../security/29-credentials-storage.md) model generalized.
- External resources project into the **single object space** as canonical types (a GitHub issue *is* a `Task/v1`) — zero connector-specific code downstream.
- Sync **reuses** [20](../data/20-database-growth-and-sync.md) (initial/selective/incremental) and the Automations scheduler ([39](39-automations-and-workflows.md)); idempotent on external ids.
- This is the **B2B unblock**: enterprises ship private signed connectors to their internal APIs, reviewed and audited on the standard surface — integration becomes an install, not an engagement.
- Mailbox ([53](53-mailbox.md)) is the reference connector; the Agent app ([55](55-agent-app.md)) and Automations drive connector intents as fail-closed tools.
