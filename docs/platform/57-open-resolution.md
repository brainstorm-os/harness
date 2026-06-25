# 57 — Open resolution (always know what to do with a piece of content)

This doc defines the **open-resolution contract**: a single, *total* function the shell owns that answers, for any piece of content the user can click, "what happens now?". It is the connective tissue that makes the apps described across the docs add up to a product: a URL inside a bookmark opens in the Web Browser ([54](../apps/54-web-browser.md)); a `mailto:` opens in Mailbox ([53](../apps/53-mailbox.md)); a `@mention` opens the referenced object in its owning app; a `.csv` file opens in whatever app registered for it; and when *nothing in the vault* claims it, the shell hands off to the operating system — never a dead click.

It refines, it does not replace, [26-interoperability.md](17-interoperability.md) (the `open` intent verb, openers registry, per-`(verb, type)` defaults, the "Open with…" surface) and [30-linking-protocol.md](31-linking-protocol.md) (the `brainstorm://` resolver). It builds on [38-network-and-proxy.md](../security/38-network-and-proxy.md) (the egress audit and embed-sandbox trust posture extend to OS handoff), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (capability model), and the entity / value model of [19-properties-and-schemas.md](../data/19-properties-and-schemas.md) + [20b-objects-and-collections.md](../data/21-objects-and-collections.md).

## The gap this closes

The interop doc gives apps a way to *register* as openers and a `no-handler` failure when none did. That is enough to power an "Open with…" menu, but it is not a guarantee. Three things were missing:

1. **The unit of "open" was the whole entity.** The user's mental model is finer: they click *a value inside an entity* — the URL field of a bookmark, an email property, a phone number, a file attachment, a `@mention`. Resolution must work on **openable values**, not only whole objects.
2. **`no-handler` was terminal.** "Nothing happens" is the one outcome a knowledge tool can't afford. There was no defined, exhaustive fall-through.
3. **No bridge to the OS.** A plain `https://` with no Web Browser installed, a `.docx`, a `tel:` — these have an obvious meaning *outside* the vault, and the product had no sanctioned way to honor it.

> **Decision:** opening is a **total function**. For every openable target there is exactly one defined resolution, computed by one shell primitive, reached the same way from every call site (clicking a URL in a bookmark, a `@mention`, double-clicking a file, a launcher hit, an `intent.open` dispatch). "Nothing happens" is not a reachable state; the only terminal is an *explained* refusal (the dangerous-scheme floor below), never silence.

## Openable targets

The resolver's input is a **target**, normalized from whatever the user clicked into one of a small, closed set of kinds:

| Target kind   | Examples                                                        | Where it comes from |
|---------------|-----------------------------------------------------------------|---------------------|
| `internal`    | `brainstorm://entity/<id>`, `brainstorm://…` authorities        | a `@mention`, a deep link, an entity reference value |
| `entity`      | a Brainstorm entity, addressed by id → resolved to its type     | clicking an object anywhere; `intent.open { entityId }` |
| `scheme`      | `https:`, `http:`, `mailto:`, `tel:`, `geo:`, `sms:`, custom `app://` | a URL value (bookmark, link property, rich-text link, captured page) |
| `file`        | a file entity or external path, keyed by extension + sniffed MIME | a file attachment, a download, the file manager |

`internal` is always in-vault and always resolvable (the [30-linking-protocol.md](31-linking-protocol.md) resolver owns it — anchor stability, resolver-mediated capabilities). `entity` reuses the existing `EntityTargetResolver` (id → `{ type, mime }`). `scheme` and `file` are the new surface.

> **Decision:** the openers registry's `targetKind` extends from `entity_type | mime` to **`entity_type | mime | scheme | extension`**. App manifests gain the matching `openers` registration forms — `{ "kind": "primary", "scheme": "https" }`, `{ "kind": "secondary", "extension": "csv" }` — exactly parallel to the existing `entityType` / `mime` forms. No new verb: openers remain semantic shorthand for "this app handles `open` on target X". The Web Browser registers `scheme:https`/`scheme:http`; Mailbox registers `scheme:mailto`; Files registers a long `extension:*` tail; etc. — none of these apps invent open behavior, they *register* against the one resolver.

## The resolution ladder

`OpenResolver.resolve(target) → Resolution` walks an exhaustive, terminating ladder. First match wins:

1. **`internal` → linking-protocol resolver.** `brainstorm://…` is resolved in-vault, always. It never reaches the OS and never prompts. (Doc 30.)
2. **A stored user default for this target** — the per-`(open, target)` default that already exists in the interop model (doc 26 §Default handlers). One entry per target *signature* (the entity type, the MIME, the scheme, the extension). If set, it wins outright. This is also where an "always use my system browser for `https:`" choice lives — see §App-vs-OS.
3. **Registered in-vault openers**, by priority: a single `primary` opener launches directly; multiple candidates (or only `secondary` ones) raise the shared **"Open with…"** surface (doc 26 §Discoverability — the one `@react-fancy-menus`-driven menu, not a per-app reinvention). Picking an option here offers "Always" → writes the rung-2 default.
4. **Universal-body fallback** — *only for `entity` / `internal` targets* with no registered opener: open in the Notes editor, exactly as the interop doc already specifies for unclaimed entity types. A Brainstorm object is always openable by something in the vault; it **never** falls to the OS.
5. **System default (OS handoff)** — *only for `scheme` / `file` targets* with no in-vault handler, and only after the consent gate (§System default). `shell.openExternal` for a URL scheme; `shell.openPath` for a file.
6. **Terminal refusal** — reachable *only* for a hard-blocked dangerous scheme (§Security floor) or a genuinely unknown, OS-meaningless target. It is an explicit, explained affordance ("This link type can't be opened for security reasons" / "No app can open this and your system has no default for it"), surfaced inline — never a no-op.

> **Decision:** rungs 4 and 5 are mutually exclusive by target kind. Entities fall *inward* (to the universal editor); external schemes/files fall *outward* (to the OS). This is what makes the function total without ever leaking a Brainstorm object to an external handler or trapping an external URL with no in-vault claimant.

## System default — the OS handoff gate

When rung 5 is reached the shell does not silently hand off. It applies a **first-use-per-protocol consent gate**, scoped per vault:

- The **first time** a given scheme (or file extension) would leave the vault, the user is asked once — *"Brainstorm has no app for `https:`. Open these in your system browser? Always / Just once / No."* The "Always" choice is remembered per scheme/extension (it writes a rung-2 default keyed to `system`); "Just once" handles this one and asks again next time; "No" cancels and is also remembered (until cleared in Settings).
- **Medium-risk schemes** (`tel:`, `sms:`, and any custom `app://`-style scheme) carry an extra warning line in that same prompt — they can dial, message, or hand off to an arbitrary local app — but are still allowed through the gate.
- Every OS handoff is an **egress event** in *Settings → Privacy → Network* ([38 §Network panel](../security/38-network-and-proxy.md)), per destination — identical treatment to every other thing that leaves the vault. There is no privileged, unaudited path out.

> **Decision:** OS handoff is gated by a distinct, scarce capability **`system.open-external`**. User-initiated clicks in shell/first-party chrome exercise it implicitly (the consent prompt *is* the review). An **app or agent** that wants to trigger an external open must hold `system.open-external` explicitly — it is not implied by `network.connect:*` (making an HTTP request and "make the user's OS open this" are different risks, same reasoning as `web.browse` in [54](../apps/54-web-browser.md)). For the Agent app the three-tier fail-closed intersection of [39 §Capabilities](../apps/39-automations-and-workflows.md) bounds it (agent-tool ⊆ app cap ⊆ user grant); an autonomous loop cannot fling URLs at the OS unless the user granted exactly that.

### Security floor — hard-blocked schemes

Some schemes have no legitimate place in a clicked value and are pure exploit vectors. These are **never offered, never prompted, never handed to the OS** — rung 6 with an explanation:

`javascript:` · `data:` · `vbscript:` · `file:` resolving **outside the open vault** · and the null/`about:`-class. The blocklist is a fixed floor, not user-relaxable (a malicious entity must not be able to social-engineer a user into a one-click code execution). `file:` *inside* the vault is not external at all — it resolves as a `file` target through rung 3/5 like any other vault file.

> **Decision:** the floor is a hard block independent of the consent gate. The gate decides *whether to ask*; the floor decides *whether it is askable at all*. Schemes on the floor are unconditionally rung 6. Everything else is gated, not blocked.

## App-vs-OS — when both can

When an in-vault app *and* the OS can both handle a scheme (Web Browser installed *and* the system has a default browser; Mailbox installed *and* a system mail client), rung 3 would pick the in-vault app and the OS would never be consulted — but the user may legitimately prefer their system browser. So:

> **Decision:** the **first time** a scheme is opened while *both* an in-vault opener and an OS default exist, the resolver raises a one-time choice — *"Open `https:` links with ▸ Web Browser (in vault) ▸ System browser — [Set default]"* — and remembers it as the rung-2 default. After that it never asks again for that scheme. This is the same first-use-and-remember model as the OS-handoff gate, extended to the app-vs-OS fork, and it is the same per-`(open, target)` default store the interop doc already defines — no new mechanism, just a second place it is written. The default is reviewable and clearable in *Settings → Defaults* alongside every other open default. There is deliberately **no global "default app"** (doc 26's decision stands); the fork is per scheme.

In-vault is presented first because it is safe by construction (partitioned `WebContentsView`, embed sandbox, clip-to-vault — [54](../apps/54-web-browser.md)); the system option is one click away and, once chosen, sticky.

## The resolver is one primitive

> **Decision:** there is exactly one `OpenResolver` in the shell. `intent.open` becomes a thin caller of it; clicking a URL value, a `@mention`, a file row, or a launcher result all normalize to a target and call the same `resolve`. No app and no shell surface implements its own open logic or its own "Open with…" menu. This is the doc-26 "discovery is centralized" principle made into a single code path, and it is what guarantees totality — there is one ladder, so there is one answer.

A companion **"Why did this open here?"** affordance (in the same menu, and in Settings → Defaults) shows which rung fired and lets the user change the default — resolution is explainable, not magic.

## Cross-doc reconciliation needed

This doc does not edit the others; tracked as follow-ups (same pattern as [54 §Cross-doc reconciliation](../apps/54-web-browser.md)):

- **[26-interoperability.md](17-interoperability.md)** — `no-handler` is no longer terminal for the `open` verb on openable content; the resolver guarantees a resolution. `no-handler` survives for non-`open` verbs and as the *internal* signal that drives rungs 4–6. The "Open with…" surface and per-`(verb, type)` defaults are reused verbatim; add the rung-2 `system` default and the app-vs-OS fork to its §Default handlers.
- **Openers registry / app-model** — `targetKind` gains `scheme | extension`; manifest validator gains the matching `openers` forms. First-party manifests of [53](../apps/53-mailbox.md)/[54](../apps/54-web-browser.md) (and Files) register scheme/extension openers.
- **[09-security-and-sandbox.md](../security/09-security-and-sandbox.md)** — add `system.open-external` to the capability matrix; add the dangerous-scheme floor and the OS-handoff egress path to the threat model.
- **[38-network-and-proxy.md](../security/38-network-and-proxy.md)** — OS handoff is an audited egress destination in the Network panel; document it next to the embed-sandbox posture.
- **[30-linking-protocol.md](31-linking-protocol.md)** — note that `internal` targets are rung 1 of this ladder (resolver-owned, never OS, never prompted).

## Phasing

| Capability | v1 | v2 |
|------------|----|----|
| `OpenResolver` primitive + total ladder; `intent.open` rewired through it | ✓ | — |
| `targetKind` extended to `scheme \| extension`; manifest opener forms | ✓ | — |
| First-use-per-protocol OS-handoff consent gate + per-vault memory | ✓ | — |
| Dangerous-scheme hard-block floor | ✓ | — |
| App-vs-OS first-use fork + Settings → Defaults review/clear | ✓ | — |
| Egress audit of OS handoff in Settings → Privacy → Network | ✓ (rides 38) | — |
| `system.open-external` capability + agent fail-closed intersection | ✓ | — |
| "Why did this open here?" explainer | ✓ | — |
| Per-org/admin policy over the floor + allowed schemes (MDM-style) | — | ✓ |

## Open questions surfaced by this doc

Registered and **resolved 2026-05-19** in [11-open-questions.md → Open resolution](../reference/11-open-questions.md) (each to the v1 leaning below; OpenRes-1 is unblocked):

- **OQ-OR-1** — Consent-memory granularity → **per scheme for v1**; domain-scoped opt-in is v2.
- **OQ-OR-2** — Floor org-relaxable? → **never via user toggle**; only signed org policy in v2, never for `javascript:`/`data:`/`vbscript:`.
- **OQ-OR-3** — Stale rung-2 default (app uninstalled) → **silent re-resolve**, explainer reflects it, entry not eagerly deleted.
- **OQ-OR-4** — `quick-look` → **a presentation modifier on the one ladder**, not a second resolver pass.
- **OQ-OR-5** — Extension-less / ambiguous-MIME file → **universal viewer (Files preview) with an "Open with…" escape**, no blocking prompt.

## Summary

- Opening is a **total function**: one shell `OpenResolver`, one exhaustive ladder, one answer — no silent dead clicks.
- Targets normalize to four kinds — `internal`, `entity`, `scheme`, `file`; openers extend to `scheme`/`extension` with no new verb.
- The ladder: internal resolver → stored default → in-vault openers (→ "Open with…") → universal editor (entities only) → OS handoff (schemes/files only, gated) → explained refusal (floor only).
- OS handoff is **first-use-per-protocol consent**, per-vault memory, audited as egress, gated by the scarce `system.open-external` capability; the Agent app is bounded by the fail-closed intersection.
- A small fixed floor (`javascript:`/`data:`/`vbscript:`/external `file:`) is **hard-blocked** — never offered, never prompted.
- When both an in-vault app and the OS can handle a scheme, the user is asked once and the choice sticks; there is still no global default app.
- Every rung and the explainer are reused/centralized from the interop and linking docs — this doc adds the *guarantee*, not a parallel mechanism.
