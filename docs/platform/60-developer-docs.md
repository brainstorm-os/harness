# 60 — Developer documentation distribution

## Why this doc exists

Brainstorm v1 ships an in-shell Help center by **baking a curated docs subset into the shell binary at build time** (per [`OQ-HELP-1`](../reference/11-open-questions.md#oq-help-1--in-app-help-center-content-source--resolved--position-taken-2026-05-19-unblocks-help-1)). That decision is correct for v1: offline-first, no runtime egress, no new content kind to review. It has one structural limit — **doc fixes ship only with the binary**, so a typo, a new tutorial, or a clarifying paragraph waits for the next release.

This doc designs the v2 upgrade path. The same Markdown source becomes a signed, versioned, fetchable **`DocsPack/v1`** content kind — distributed through the same catalog + signing + caching machinery that already ships apps, themes, icon packs, layout packs, locale packs, workflow packs, shortcut packs, and wallpaper packs (per [`47-marketplace.md` §Content-kind registry](../apps/47-marketplace.md)).

It also widens the corpus the Help center surfaces from "end-user help only" to "end-user help **and** developer documentation hub" — so authors building Brainstorm apps / themes / extensions get the same searchable, in-shell, offline-first reading experience users already get.

> **Decision:** this is the **upgrade path** for `OQ-HELP-1`, not a contradiction of it. v1 ships bundled-only as that OQ already resolved. The `DocsPack` layer slots in on top once the catalog distribution (14.17/14.18) and network broker (Net-1) mature. A user who never connects to the network never sees a difference from v1.

## Principles

1. **Single source of truth.** Markdown lives in `docs/` in this repo. Two renders: (a) the in-shell reader, hydrated from a `DocsPack`, and (b) a public web mirror at `docs.brainstorm.app`. Both renders read the *same* commit-ish of the source — drift is impossible by construction.
2. **Updateable without a binary release.** A typo fix or new tutorial lands as a new `DocsPack` version, signed by the official catalog key, and reaches users on next launch over the network broker.
3. **Offline-first.** Every shell binary embeds a **bootstrap `DocsPack`** at build time. A fresh install, an offline install, or a self-hosted install with the catalog disabled all read docs immediately — no online step required. The fetched `DocsPack` only ever *supersedes* the bootstrap; it never replaces it on disk (so a failed update / corrupted cache silently falls back).
4. **One trust path.** `DocsPack/v1` is signed by the official Brainstorm catalog publisher key — same key, same verification, same threat surface as any other first-party content. No new sign-in / no portal account / no per-author keys.
5. **First-party-only in v2.** The `DocsPack` kind reserves a `publisher === BRAINSTORM_CATALOG_KEY` invariant in v2. Per-app embedded docs (a third-party app shipping its own help) is a coherent extension but explicitly **post-v2** — designed below for forward-compat, not built.
6. **Same reader, wider corpus.** The in-shell Help reader from `Help-1` reads from the cached `DocsPack` instead of a baked-in static blob. The reader contract (`?` opens contextual help, route-derived topic key per [`OQ-HELP-2`](../reference/11-open-questions.md#oq-help-2--contextual--f1-per-surface-help-mechanism--resolved--position-taken-2026-05-19-unblocks-help-2)) does not change — only the substrate.

## Scope: what does and doesn't ship inside the `DocsPack`

**In:**
- **User-facing Help center** — getting started, per-app help, FAQs, the curated subset already designed for `OQ-HELP-1`.
- **Developer documentation hub** — how to build an app (manifest, capability surface, sandbox model, lifecycle), how to author each free content kind (`ThemePack`, `IconPack`, `LayoutPack`, `WallpaperPack`, `LocalePack`, `WorkflowPack`, `ShortcutPack`), recipes, anti-patterns, starter template links.
- **SDK reference** — auto-generated from `packages/sdk/` + `packages/sdk-types/` source at build time (every public export, every type, every JSDoc paragraph).
- **Capability catalogue** — auto-generated from the capability registry — every default-grant, every prompt-grant, every never-grant capability with its scope grammar, the prompts the user sees, the threat-model notes from [`docs/security/09-security-and-sandbox.md`](../security/09-security-and-sandbox.md).
- **IPC / wire reference** — the envelope shape, the public services (`entities.*`, `files.*`, `intents.*`, `shortcuts.*`, `network.*`, `search.*`, `dashboard.*`, …), per-method signatures (also generator-fed from `packages/sdk-types/`).
- **Glossary, conventions, and contributor index** — the user-curated subset of `docs/foundations/35-code-conventions.md` and `docs/00-index.md` relevant to extension authors. The *internal design docs* (this doc, `_review/`, OQ ledger) do **not** ship — they are the source's substrate, not the published surface ([[project_docs_org_repo_clean]]).

**Out (stays elsewhere):**
- **"What's new" / changelog** — already lands as a build-time-bundled artifact per [`OQ-FB-1`](../reference/11-open-questions.md#oq-fb-1--whats-new--changelog-source--trigger--resolved--position-taken-2026-05-19-unblocks-feedback-3) (Feedback-3 slice 1 shipped 2026-05-23). Stays in the binary because it's version-coupled (the "first-launch on a new version" trigger doesn't have a clean equivalent on an asynchronously-updated docs pack). The `DocsPack` *links* to the changelog topic; it doesn't carry it.
- **The publishing portal at `developers.brainstorm.app`** — that's the **action** surface (sign in, upload listings, browser-side signing, analytics — Stage 14.22). The `DocsPack` is the **reading** surface. The portal links to the docs hub for how-to content; the docs hub links to the portal for the action.
- **Internal architecture / design docs** — `docs/_review/`, `docs/reference/11-open-questions.md`, and the internal-only docs are not part of the pack. The public web mirror also omits them.

## Architecture: source → pack → readers

```
                       ┌──────────────────────────────┐
                       │  docs/ in this repo (canon)  │
                       │  + generated SDK reference   │
                       │  + generated capability cat. │
                       └─────────────┬────────────────┘
                                     │ CI build job (on merge to main)
                ┌────────────────────┴───────────────────┐
                ▼                                        ▼
   ┌──────────────────────────┐         ┌───────────────────────────────┐
   │  DocsPack/v1 (signed)    │         │  Static HTML render           │
   │  → catalog               │         │  → docs.brainstorm.app        │
   └────────────┬─────────────┘         └───────────────────────────────┘
                │ shell launches, network broker fetches if newer
                ▼
   ┌──────────────────────────┐
   │  cached DocsPack on disk │  ◀── bootstrap DocsPack baked in
   │  (per-vault data dir)    │      shell binary at build time
   └────────────┬─────────────┘      (fallback / fresh install)
                │
                ▼
   ┌──────────────────────────┐
   │  in-shell Help reader    │
   │  (privileged renderer)   │
   └──────────────────────────┘
```

Three observations:
- The **bootstrap pack** in the shell binary is the same on-disk format as a fetched pack. The reader doesn't branch on "where did this pack come from" — it just reads whichever pack has the higher `version` field at startup, with the catalog-fetched pack winning ties.
- The **public web mirror** is a pure CI job — there is no runtime web service for docs. The web mirror is for SEO, deep-linking, sharing on social, and developers who don't have the shell installed yet. The shell reader never reaches out to the web mirror.
- The **catalog distribution** is the same path apps and themes already use. No new server, no new auth surface, no new threat surface.

## `DocsPack/v1` shape

A `DocsPack` is a signed bundle in the same envelope every other content kind uses (per [`14-app-store.md` §Package format](../apps/14-app-store.md)):

```jsonc
// manifest (signed inline header)
{
  "kind": "docs",
  "specVersion": 1,
  "name": "brainstorm-official-docs",          // first-party fixed name in v2
  "displayName": "Brainstorm documentation",
  "version": "2026.06.04+1234",                // CalVer; trailing build number monotonic
  "publisher": {
    "key": "<Brainstorm-catalog-Ed25519-pubkey>",
    "fingerprint": "bs1pub:..."
  },
  "sourceCommit": "<git-sha of docs/ at build>",
  "languages": ["en"],                          // locale packs handle other locales separately
  "sections": [
    { "id": "user-help",     "title": "Help",       "topics": [/* topic ids */] },
    { "id": "developer-hub", "title": "Build",      "topics": [/* topic ids */] },
    { "id": "sdk-reference", "title": "SDK",        "topics": [/* generated */]  },
    { "id": "capabilities",  "title": "Capabilities","topics": [/* generated */] },
    { "id": "ipc-reference", "title": "Wire",       "topics": [/* generated */] }
  ],
  "contentRoot": "content/",                    // payload dir inside the pack
  "searchIndexBuilt": "fts5/v1",                // pre-built index format (server-side)
  "compatibleShells": "^X.Y.Z"                  // honoured by `assertVaultFormatSupported` analog
}
```

Payload layout inside the pack:

```
content/
  user-help/
    getting-started.md
    notes-app.md
    ...
  developer-hub/
    build-an-app.md
    build-a-theme.md
    build-a-layout-pack.md
    ...
  sdk-reference/                       // generator output, do not hand-edit
    @brainstorm/sdk/index.md
    @brainstorm/sdk/find-replace/index.md
    ...
  capabilities/                        // generator output
    files.read.md
    intents.dispatch.md
    ...
  ipc-reference/                       // generator output
    entities.read.md
    network.fetch.md
    ...
  assets/                              // images, diagrams, code samples
search-index/                          // pre-built FTS5 index for cold-start search
```

> **Decision:** the search index is **pre-built server-side and shipped inside the pack**. The shell does not rebuild a docs index from Markdown on first launch — that would be a multi-second startup hit on cold install. The same FTS5 primitive that powers vault search (per [`9.22`](../implementation-plan.md)) reads the shipped index file directly. Pack swap = swap two files atomically.

> **Decision:** **CalVer + monotonic build number** (`2026.06.04+1234`) for `DocsPack` versioning rather than SemVer. Docs have no API surface to version — they have a release moment. CalVer makes "is the user reading current docs?" answerable at a glance in the reader footer.

## In-shell Help reader contract (extension of `OQ-HELP-1`)

The Help center renderer designed for `Help-1` (privileged shell surface, under `packages/shell/src/renderer/help/`) is the only consumer in v2. It gains:

- **Source switch**: instead of reading from a baked-in static blob inlined at build time, it reads from the cached `DocsPack` on disk (or the bootstrap pack if no fetched pack exists yet). The reader is unaware which pack it's reading from — both have identical on-disk shape.
- **Footer affordance**: shows `Docs <version> · SDK <packages/sdk version>`. If the SDK version is newer than the docs `compatibleShells`, a quiet banner reads "Docs are catching up to this build — some pages may be out of date." The banner is informational, not blocking.
- **Search**: continues to use the FTS5 primitive (per [`9.22`](../implementation-plan.md)). The reader opens the pre-built `search-index/` from the pack — no per-startup index rebuild.
- **`?`-key topic mapping** (per `OQ-HELP-2`): unchanged. The reader receives a topic key derived from the focused surface's route; resolves it against the pack's `sections[*].topics`; falls back to the section landing page; falls back to the user-help home.
- **No third-party docs surface in v2.** The reader hard-asserts that the loaded pack's `publisher.key === BRAINSTORM_CATALOG_KEY`. A bundle whose publisher doesn't match is rejected at load time and the bootstrap pack is used instead — this prevents a tampered cache from serving altered docs.

## Public web mirror

`docs.brainstorm.app` is a static site rendered by CI from the same `docs/` source on every merge to `main`. It serves the same corpus the `DocsPack` carries (Help, Developer hub, SDK reference, Capabilities, IPC reference). The web mirror also covers:

- **Anchored deep links** the in-shell reader can hand off to the system browser when a user explicitly chooses "Open in browser" (consent-gated per [`57-open-resolution.md`](57-open-resolution.md)).
- **SEO + sharing** — a developer Google-searching "how to build a Brainstorm app" lands on the developer hub without needing the shell installed.
- **An "edit this page" affordance** anchoring to the GitHub source path for the rendered page (drives external contributions on the same source the shell reads from).

> **Decision:** the public web mirror is **not** a runtime dependency of the shell. The shell never fetches a page from `docs.brainstorm.app` — only the catalog, only as a signed `DocsPack`. The web mirror is a sibling artifact, not a substrate.

This lives in the company/operational tier (out-of-this-repo) under `Site-2 — docs portal` and consumes the docs source from a CI hand-off (build artifact uploaded, web mirror's deploy pipeline picks it up); the rendering pipeline does not import shell or packages source.

## Update flow

On shell launch, after the active vault session is established (so the network broker has a session to attribute traffic to):

1. **Compare versions.** Read `version` from the cached pack on disk (or the bootstrap pack if none cached). Issue a HEAD-equivalent catalog query — same path apps/themes already use. If catalog `version` ≤ local, exit.
2. **Fetch the delta** (or the whole pack on first install) over the network broker — same `network.*` capability the catalog already uses for app/theme updates. **No new capability.**
3. **Verify** — publisher key against the pinned `BRAINSTORM_CATALOG_KEY`, signature against the pack bytes, fingerprint against the manifest. Same verification path as every other signed pack.
4. **Stage + atomic swap** — write to a temp path, fsync, rename over the cached pack. The reader picks the new pack up on next focus / next surface mount; no live reload of an open Help page (avoids in-flight reading-surface churn — the user finishes their current page on the old pack, the next page they open is from the new pack).
5. **Telemetry: none.** We do not phone home with "did the user open the new pack." The success signal is the next update landing.

Failure modes:
- **Network unreachable** → no error surfaced; retry next launch. The cached or bootstrap pack continues to serve.
- **Signature fails** → drop the candidate pack, log to the runtime error log ([[triage-error-log]]), do not retry that exact version. Cached pack continues to serve.
- **Corrupted cache** → reader load-time validation fails → reader falls back to the bootstrap pack and asks the updater to re-fetch on next launch.

> **Decision:** updates are **silent and automatic**, no per-update prompt. The pack is first-party-signed (low risk), small (Markdown + generated reference + pre-built index — order of single-digit MB), and the content is purely informational (no behavioural change to the product). A user who wants control gets a "Check for updates" entry in the Help footer and a setting under Privacy → Network that disables the auto-check (consistent with the per-app egress controls in [`docs/security/38-network-and-proxy.md`](../security/38-network-and-proxy.md)).

## Capabilities

- **`docs.read`** — default-grant **for the privileged Help renderer only**. Never granted to a sandboxed third-party app. Reads from the cached `DocsPack`. Scope grammar: `docs.read:<section>` (e.g. `docs.read:user-help`, `docs.read:sdk-reference`) for future per-section access; v2 grants the unscoped form to the Help renderer.
- **`docs.update`** — privileged shell-internal, never broker-exposed. Triggers a manual update check (the user-facing "Check for updates" button). The background-on-launch check is shell-internal main-process code; this capability is for the user-initiated path.

No new app-facing capability. Sandboxed apps that want to direct a user to a help topic do so via the existing `intents.dispatch` surface against an `open` intent on a `brainstorm://help/<topic>` URI (per [`57-open-resolution.md`](57-open-resolution.md)).

## Bootstrap-pack relationship

Every shell binary embeds a `DocsPack` at build time, sourced from the same CI step that publishes the catalog `DocsPack`. The embed is byte-identical to the catalog pack as of the build commit. Reasons:

- **First launch on a fresh install is fully functional offline.** A user can read every doc, every SDK reference, every capability description, without ever connecting to the network.
- **Air-gapped / self-hosted / OQ-RX-7-style "network egress off"** installs continue to have working docs forever (they just don't receive updates).
- **Fallback substrate.** If the cached pack is corrupted, signed by a key that doesn't match, or empty (first launch), the reader uses the bootstrap.

The bootstrap is **never deleted** from the binary. Reader logic:

```
on startup:
  bootstrap_pack = embedded_pack()
  cached_pack    = read_disk_pack() or None
  active_pack    = cached_pack if cached_pack and cached_pack.version > bootstrap_pack.version
                                  and verify(cached_pack)
                              else bootstrap_pack
```

> **Decision:** the bootstrap pack and the cached pack live in **separate places** — bootstrap in the binary's resource section, cached under the user data dir. Updates never write to the binary's resource section (that would invalidate the shell binary signature; would require sudo on most platforms; would brick a code-signed install). They write to the user data dir. This keeps shell-binary integrity orthogonal to docs freshness.

## First-party-only in v2

`DocsPack/v1` reserves the **first-party publisher key** invariant. A pack signed by any other key is rejected. Rationales:

- **One review path.** The official Brainstorm docs are reviewed in this repo's PR flow. No second review surface to staff.
- **One trust signal in the reader.** The Help footer shows one publisher — no "third-party docs may differ in quality" disclaimers.
- **Avoids the help-injection threat surface.** A third-party-signed docs pack that the reader would render alongside official docs is a new social-engineering vector ("install this 'best-practices' pack to get our app working"). We don't open that surface in v2.

**Per-app embedded docs (post-v2 — explicitly designed for forward-compat, not built):** a third-party app's manifest could declare a `docs: { contentRoot: "..." }` field pointing to Markdown shipped *inside the app bundle*. The Help reader would surface these under a separate "Installed app docs" section, scoped to the installed app's id, attributed to the app's publisher key (not the catalog key). This reuses the app's existing signing surface, doesn't introduce a second pack format, and gives third parties a way to ship per-app help. Deferred because:
- The user-facing source of "trust this doc" then has to differentiate per-app docs from official docs in chrome — extra UX surface.
- App-help search becomes a second corpus or a federated query — extra design.
- It's not on the v1/v2 critical path — extension authors can host their own docs externally and link in the meantime.

> **Decision:** per-app embedded docs are designed for forward-compat but **explicitly post-v2**. The `DocsPack/v1` reader's first-party assertion is the single forward-incompatible point — when per-app docs ship, the reader either grows a second loader (apps-side docs are not `DocsPack`s, they are app-manifest fields) or the assertion narrows to "the *primary* pack must be first-party, secondary per-app sections render with attribution." That decision is taken when per-app docs are scheduled.

## What this doesn't change

- **`OQ-HELP-1` v1 resolution stands** — v1 ships bundled-at-build-time. The `DocsPack` layer is **v2** and slots in on top.
- **`OQ-HELP-2` topic mapping stands** — `?` opens contextual help via a route-derived topic key, no per-surface registration API.
- **`OQ-FB-1` changelog stays in the binary** — Feedback-3 already shipped it; the `DocsPack` does not carry the changelog.
- **Publishing portal scope (14.22) unchanged** — `developers.brainstorm.app` is still the *action* surface for free listings; the docs hub is the *reading* surface. They link to each other.
- **No new content-kind privileges for apps.** `docs.read` is privileged-renderer-only.
- **No new network egress.** The update check uses the existing network broker's catalog-fetch path.

## Iterations

These slot into Stage 14 alongside the other content-kind work. The bootstrap-pack iteration is **decoupled from catalog readiness** — it can ship as soon as the Help reader (`Help-1`) needs a corpus, well before 14.17/14.18 mature catalog distribution.

| Iter        | When     | What                                                                                                                                                                                                                                                                                                              |
| ----------- | -------- | --- |
| **DocsHub-1** | v2 (early — pairs with `Help-1`) | `DocsPack/v1` on-disk format + reader-side validator + bootstrap pack baked into the shell binary at build time. Help reader (`Help-1`) reads from the bootstrap pack. No catalog wiring yet; updates not possible — this is the v1→v2 substrate swap that lets `Help-1` exit. Closes the structural part of `OQ-HELP-1`. |
| **DocsHub-2** | v2 (after 14.17 + 14.18 mature) | Catalog wiring: launch-time HEAD check, network-broker fetch, signature verify, staged + atomic-swap of the cached pack. "Check for updates" affordance in Help footer. Privacy → Network setting to disable the auto-check. |
| **DocsHub-3** | v2 (after `packages/sdk` stabilises) | SDK reference + capability catalogue + IPC reference generators wired into the docs build. Output committed to a `docs/_generated/` tree (gitignored payload, committed only at release tags) and fed into the `DocsPack`. Generator runs as part of `bun run build` and as a CI check on every merge. |
| **DocsHub-4** | v2 (after `Net-1`) | Public web mirror at `docs.brainstorm.app` — CI job, static HTML render of the same source, "edit this page" GitHub anchors. Lives in the out-of-repo `Site-2` slot (which this doc gives a concrete design for). |
| **DocsHub-5** | **post-v2** | Per-app embedded docs (third-party). See §First-party-only in v2 for the deferred-design surface. |

These rows insert into [implementation-plan.md §Commercial backend & company ops](../implementation-plan.md#commercial-backend--company-ops-stage-14-v2) alongside `14.22 / 14.23 / 14.24 / 14.24a`. `Site-2` in the out-of-repo block now points at this doc instead of being a `gap`.

## Open questions

(All filed inline so the iterations above can land — none gate `DocsHub-1`.)

- **OQ-DOCS-1** — *First-party-only vs allow third-party `DocsPack`s in v2?* — **RESOLVED in implementation-plan Stage 14: first-party-only.** Per-app embedded docs deferred to post-v2 (`DocsHub-5`).
- **OQ-DOCS-2** — *Auto-update behaviour: silent on launch, prompt on launch, or manual only?* — Lean: silent on launch (first-party-signed, small, informational); user can disable via Privacy → Network. Confirm with build.
- **OQ-DOCS-3** — *SDK reference generator: TypeDoc with custom theme, hand-rolled walker over `.d.ts`, or extracted JSDoc only?* — Lean: TypeDoc with a custom Markdown theme that renders into the same source tree as hand-written prose so cross-links work uniformly. Decided in `DocsHub-3`.
- **OQ-DOCS-4** — *Locale story for `DocsPack`: one pack per locale, or one pack with per-locale subtrees, or locale packs (per [`21-localization.md`](21-localization.md)) layered on top?* — Lean: one pack per locale, named `brainstorm-official-docs-<bcp47>`, fetched on demand based on the user's active locale. Defer to whichever `DocsHub` iteration adds a non-English locale; English-only ships first.
- **OQ-DOCS-5** — *How does the in-shell reader handle a `DocsPack` whose `compatibleShells` excludes the running shell version?* — Lean: render the section landing pages and the footer warning, hide the SDK-reference + IPC-reference + capability-catalogue sections (these are the version-sensitive ones) until a compatible pack is reachable. Decided in `DocsHub-2`.

## Cross-doc updates (apply when this design lands)

- **[`apps/47-marketplace.md` §Content-kind registry](../apps/47-marketplace.md)** — add `DocsPack/v1` to the kinds table; note the first-party-only invariant; link to this doc.
- **[`reference/11-open-questions.md` §Help, feedback & changelog](../reference/11-open-questions.md#help-feedback--changelog--oq-help-1--oq-fb-1)** — add a note on `OQ-HELP-1` pointing forward to this doc as the v2 upgrade path (the v1 resolution stands).
- **[`platform/46-marketing-and-promotion.md` §Documentation site](46-marketing-and-promotion.md)** — note that the docs site renders the same source the in-shell `DocsPack` carries; one source, two renders.
- **[`foundations/49-self-hosting.md`](../foundations/49-self-hosting.md)** — note that a self-hosted Brainstorm can pin to a `DocsPack` version or disable the auto-check; the bootstrap pack guarantees forever-offline operation.
- **[`implementation-plan.md`](../implementation-plan.md)** + **[`implementation-plan-table.md`](../implementation-plan-table.md)** — add the `DocsHub-1..5` rows; replace the `Site-2 — docs portal — gap` note with a pointer to this doc.

## Glossary

- **`DocsPack/v1`** — a signed, versioned bundle of Markdown + generated SDK/IPC/capability reference + a pre-built FTS5 index, distributed through the catalog. First-party-only in v2.
- **Bootstrap pack** — a `DocsPack` embedded in the shell binary at build time. Always present, never deleted. Used until a fetched pack with a higher version installs.
- **Cached pack** — a `DocsPack` fetched from the catalog and persisted to the user data dir. Atomically swapped on update.
- **Public web mirror** — static-HTML render of the same Markdown source, served at `docs.brainstorm.app`. Sibling artifact to the `DocsPack`; not a runtime dependency of the shell.
- **Help reader** — the privileged shell renderer under `packages/shell/src/renderer/help/` (designed in `Help-1`). The sole consumer of `docs.read` in v2.
- **Developer documentation hub** — the `developer-hub` + `sdk-reference` + `capabilities` + `ipc-reference` sections of the `DocsPack`. Distinct from the publishing portal at `developers.brainstorm.app` (which is for *actions*: sign in, upload, see analytics).
