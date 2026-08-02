# Northbound friction log

Mira's running record of everything that got in her way while trying to run her
business inside Brainstorm. This is the **single channel** from the founder role
to the build (see [`README.md`](README.md)). The developer role triages each
entry and moves its status forward.

**Status:** `open` → `triaged` → `done` (or `wontfix` with a reason).
**Kind:** `bug` (it's broken) · `design` (it works but it's clumsy) · `gap`
(I can't do the thing at all).

Newest sessions on top.

---

## Format

```
### F-NNN — <one line, in Mira's voice>
- **session:** <NNN-slug>   **kind:** bug|design|gap   **app:** <app>   **status:** open
- **what I was trying to do:** …
- **what happened:** …
- **what I expected:** …
- **evidence:** tests/dogfood/.sessions/<name>/<shot>.png  (+ console line if relevant)
- **triage:** _(developer fills this in: repro / plan iteration / OQ / wontfix)_
```

<!-- Entries land below this line, newest session first. -->

### F-481 - the Backup & Migration screen is ugly: glassy neutral buttons, cramped padding, sloppy layout — design isn't being held to first-class
- **session:** owner-report-2026-08-02 + probe 923   **kind:** design   **app:** shell (Settings, Button/SDK primitives)   **status:** 🟡 primitives fixed (shell #439); audit backlog open
- **what I was trying to do:** use Settings → Backup & Migration.
- **what happened:** the neutral "Choose file/folder/export…" buttons render as heavy glossy smudged chips on the settings glass, button side-insets are visibly too tight (8px on a 32px pill — should be space-3), and the screen's layout reads sloppy. This is symptomatic — design quality isn't being enforced.
- **what I expected:** quiet secondary buttons that match the fields they sit beside, comfortable control padding, and one consistent settings design language.
- **evidence:** owner screenshot (light theme); after-shots `tests/dogfood/.sessions/923-settings-design-fixes/` with computed-style assertions (padding-left 12px, no gloss gradient on Neutral).
- **triage / resolution (developer, 2026-08-02, shell #439 + audit):** primitives first — Button md side padding space-2→space-3 (shell `.button--md` AND SDK `.bs-btn`), Neutral de-glossed onto the shared field face (`--color-field-*`, #437) matching adjacent inputs and the always-flat app-side `.bs-btn--neutral`, backup-card hover elevation removed (non-clickable), Sm-field-beside-Md-button mismatches fixed in Network/Browser-privacy (the recurring adjacent-control-heights class), 32px icon-chip/indent literal deduplicated. Then a **strict 25-finding audit of the whole Settings surface** — [`docs/_review/2026-08-02-settings-design-audit.md`](../_review/2026-08-02-settings-design-audit.md) — found the same pathology repeated in every pill/tab/chip (single-value padding shorthand), four hand-rolled Segmented clones, three competing card idioms, six title treatments, one fully off-token sheet (billing), literal brand hexes, five off-pattern focus rings, and hover-lift on static marketing cards. The audit ends with the enforcement plan (R1-R3 CSS-literal/focus/motion ratchets + shared `.settings__card`/`.settings__tile`/`<Segmented>` consolidation) — the ratchets are what makes this the LAST time this class of complaint recurs, per the standing stabilise-and-polish mission. Backlog items are ranked in the audit doc; the membership-card hover-lift (finding 21) needs an owner call.
### F-480 - the light/dark switch does nothing again (5th time) — this time only when the light slot names a theme the running shell doesn't know
- **session:** owner-report-2026-08-02 + probes 921/922   **kind:** bug   **app:** shell (dashboard / theme)   **status:** ✅ fixed (shell #435)
- **what I was trying to do:** flip to light with the sun/moon header button after picking the new Porcelain theme for my light slot.
- **what happened:** the click does nothing — the shell stays dark. No error anywhere I can see. It has now died on me five separate times over the months.
- **what I expected:** the shell flips instantly, every time, like it does right after a restart.
- **evidence:** `tests/dogfood/.sessions/922-probe-porcelain-toggle-skew/` — `notes.md` shows `after click to light: theme=nord` with `pageErrors=["Cannot convert undefined or null to object"]` and `console.log` has `[brainstorm] React error boundary caught: TypeError…`; probe 921 (same build, default themes) is green, isolating the trigger to the unknown-theme slot.
- **triage / resolution (developer, 2026-08-02, shell #435):** the mode write always landed (the owner's vault doc showed `mode` flipping; mtime tracked the clicks) — the death was in the repaint. `applyThemeVars` indexed the precomputed `FLATTENED` map with a theme name read from persisted vault state; a name the renderer bundle doesn't ship (here: `porcelain` in the light slot, merged 12:15:15, while the dev server's renderer pre-bundled tokens at 12:15:00 — main hot-restarted and accepted the name, the renderer never learned it) made `Object.entries(undefined)` throw before `dataset.theme` was stamped; the React error boundary ate it, so the toggle just looked dead. App windows kept theming because tab-strip / app-preload / widgets-layer already guard with `isThemeName(name) ? name : DEFAULT_THEME` — the dashboard's own provider was the one surface missing the guard. Fixed by aligning it (resolve-or-fallback + a `console.warn` naming the skew so the error log stops being silent about it); red→green in `theme-provider.apply.test.ts`, real-shell repro pinned by probe 922. Not dev-only: an install older than a theme named in a shared/synced vault slot crashed the dashboard the same way at boot. **Why "5th time" keeps happening:** each new-theme merge under a running shell reproduces the class and a restart silently "fixes" it — the fallback removes the class, and the warn makes any future recurrence name itself. Residue closed in the same PR: main's red `typecheck:apps` (`apps/theme-editor/src/app.tsx:101` — Porcelain missing from the `Record<ThemeName, …>` label map) is fixed in shell #435 too (map entry + `theme.porcelain` in all six locale catalogs); the Graphite PR (#434) carries the same gap for its own theme and was flagged — the new-theme checklist effectively includes the theme-editor label map.

### F-479 - presence between two users is broken: awareness frames arrive but the receiver has no DEK
- **session:** collab-010-presence-live (2026-08-02 chores dogfood)   **kind:** bug   **app:** shell (sync / presence)   **status:** 🔴 open
- **what I was trying to do:** the standing two-shell presence check — Mira and Marcus open a shared note and should see each other.
- **what happened:** neither sees the other; the spec times out waiting for the peer name.
- **what I expected:** presence appears within a couple of seconds, as `PRES-4` shipped it in `v0.4.2`.
- **evidence:** `tests/dogfood/.sessions/collab-010-presence-live/` — `relay-audit.log` shows awareness frames flowing BOTH ways (282 bytes each, every 15 s), so the transport is fine; `marcus.console.log` ends with `[dev:collab] receive failed: envelope-pipeline: no DEK for entity ent_presence_note`. The frames arrive and cannot be opened.
- **NOT a regression from the 2026-08-01/02 window:** reproduced identically against a **v0.12.0 baseline build** (the pre-window tag) in the same environment, so the polish / agent-UI / app-tools work is not implicated. In the same sweep `003` (durable node) passed on re-run — flaky under parallel load with `ydoc: file shorter than header` — and `012` is the already-filed `10.3c` multi-device DEK gap, a *different* (same-user, two-device) hole.
- **triage (developer, 2026-08-02):** same failure CLASS as F-466 (a share-time `WrapBootstrap` never reaching the receiver's inbox), which shell #350 fixed for the relay-classification cause, and as the retro-wrap ordinal bug shell #387 fixed. This is a cross-USER share, so `10.3c` does not explain it. Next step is to bisect `v0.11.x..v0.12.0` over the wrap-delivery path rather than re-diagnose from scratch — both prior fixes landed in that window and either could have regressed the other.

### F-478 - inserting a reference in a quote drags an empty quote block along, deleting one deletes both
- **session:** owner-report-2026-08-01   **kind:** bug   **app:** notes (packages/editor)   **status:** ✅ fixed (shell #424)
- **what I was trying to do:** add a `!@` reference to an iteration inside a note.
- **what happened:** the transcluded card appeared together with a stray empty quote block right under it, and deleting the quote block removed the reference card with it.
- **what I expected:** the reference lands as its own block; deleting a neighbouring quote leaves it alone.
- **evidence:** owner screenshot (transclusion card + empty quote bar beneath, "Status: Reverted" iteration); reproduced failing-first in `transclusion-typeahead-plugin.test.ts` — a `!@` committed inside a `QuoteNode` nested the BLOCK `TransclusionNode` inside the quote.
- **triage (developer, 2026-08-01):** `applyTransclusionInsertion` replaced the trigger text IN PLACE, so any non-paragraph host (quote / heading / list item) swallowed the block card as a child: the host rendered as a stray empty bar beside the card and deleting it deleted the card too — they were parent and child, not neighbours. The card is now hoisted to a top-level sibling after the host; the host keeps any remaining text and is removed only when the trigger was its entire content. `applyEmbedInsertion` checked and NOT affected (it replaces the whole target block, so it never nests). Fix + pinned test in the shell PR.

### F-477 - the Backup & Migration settings panel looks thrown together
- **session:** owner-report-2026-07-31   **kind:** design   **app:** shell (settings)   **status:** ✅ fixed (shell #401)
- **what I was trying to do:** look over the export / import options in Settings → Backup & Migration.
- **what happened:** the panel reads as a mess — the description text is squeezed into a narrow ragged column beside oversized buttons with labels like "Choose an export (.zip or folder)…", the cards have big empty dead zones, and the Notion token box is a bare white input that matches nothing else in the app.
- **what I expected:** the same tidy card layout as the rest of Settings — clean text, consistent buttons, a themed input.
- **evidence:** owner screenshot (dark theme over wallpaper); reproduced in the real-shell visual spec.
- **triage (developer, 2026-07-31):** three causes. (1) *Layout* — the card header was one flex row, so the action button's width was subtracted from the description column for the card's **entire height**; with labels as wide as "Choose an export (.zip or folder)…" the copy wrapped into a narrow ragged column and left large dead zones. The header is now a grid (icon | title | action on one centered baseline, description spanning the full card width below at a 64ch measure), and follow-up content (token row, progress, run reports, errors) hangs at the title's left edge. (2) *Buttons* — labels tightened to `Export…` / `Choose file…` / `Choose folder…` / `Choose export…`; the format detail already lives in each card's hint, and the actions now read as one right-aligned column. (3) *Input* — the Notion API token field was a raw `<input class="bs-input">`; `bs-input` is an SDK **app-side** class the shell renderer deliberately never loads, so the field rendered as an unstyled native input (the same phantom-class family as the phantom-CSS-token rule). It now uses the shared `<TextField>` (password, Md) beside its Connect button. New real-shell visual spec `tests/visual/specs/settings-backup-migration.spec.ts` guards the panel end-to-end, including that the token field rides the shared `text-field__input` face. Panel tests 5/5, typecheck + lint green. Fix: shell #401.

### F-476 - properties panel items jump when editing is clicked
- **session:** owner-report-2026-07-31   **kind:** bug   **app:** shared (sdk property-ui)   **status:** ✅ fixed (shell #395)
- **what I was trying to do:** edit a property value in an object's Properties panel.
- **what happened:** the moment I clicked a value to edit it, the rows in the panel jumped — the edited row changed size and everything below it shifted.
- **what I expected:** clicking into a value swaps in an editor in place; nothing else moves.
- **evidence:** owner report (no session capture); reproduced with a pixel-measurement harness over the real stylesheets — editing a 2-line Long-text value grew its row by ~17px per extra line and shifted every row below by the same amount.
- **triage (developer, 2026-07-31):** two rest↔edit box mismatches in the shared cells, worst on Multiline (Long text). (1) The panel's one-line truncation rule (`.bs-props__row-value > :first-child`, `white-space: nowrap` + ellipsis — meant for long emails/URLs) outranks `.bs-cell-multiline`'s own `pre-wrap` on specificity, so a Long-text value RESTED as one truncated line but EDITED as all its lines through the auto-grow textarea — the row grew by N−1 lines on click. The truncation rule now exempts `.bs-cell-multiline` + `.bs-cell-multiline-input`, so the rest face shows the full wrapped value and exactly matches the editor's footprint. (2) All three inline editors kept the rest face's full padding while adding their 1px border (the CSS comment claimed the border "eats" the padding; it didn't) — a 1px text shift on every scalar edit, 2px height change on multiline. Editor padding is now `calc(<rest padding> - var(--border-width))`. After the fix every measured row moves ≤0.06px (textarea `scrollHeight` integer rounding) entering/leaving edit on scalar, hard-newline, and soft-wrap values. Stylesheet-invariant regression guards in `packages/sdk/src/property-ui/cells-css-parity.test.ts` (jsdom can't measure layout); 206 property-ui tests green. Affects every app hosting the shared panel. Fix: shell #395.

### F-475 — the browser's ⋯ menu does nothing once a page is loaded
- **session:** 920-probe-browser-more-menu   **kind:** bug   **app:** Browser   **status:** done
- **what I was trying to do:** open the browser's ⋯ overflow menu (new private tab / summarize / clear data) while reading a page.
- **what happened:** clicking ⋯ did nothing visible. On an empty new tab the menu opens fine — with a page loaded, nothing. Same for the history menu, the shield menu, and the omnibox suggestions once I looked: every floating popup is dead while browsing, which is exactly when I want them.
- **what I expected:** the menu drops over the page like in every other browser.
- **evidence:** tests/dogfood/.sessions/920-probe-browser-more-menu/notes.md (main-process view stacking), 03-03-menu-open-over-page.png
- **triage (developer, 2026-07-31):** architectural, not a dead button — the menu *opened* every time. The page is a native `WebContentsView` stacked **above** the app's chrome view (probe 920: chrome=child[1], page=child[2]; later child paints on top), so any chrome DOM that drops below the toolbar into the page region is painted over natively. The DOM said `role=menu` open; the user saw nothing — the down-stack banner/tray comments in `styles.css` even documented the constraint ("a bottom-overlay would be hidden behind the native WebContentsView") but the popup class was never covered, and the menu's own dimmer can't intercept page clicks either (the page view eats them), so the popup also never closed on outside-click. Fix (shell + sdk + app): (1) new tab-scoped `WebViewMethod.SetChromeOnTop {tabId, on}` — on open the window container re-adds the app's renderer view on top (`WindowContainer.raiseActiveTabView`), on close the page view re-stacks via `ManagedWebView.bringToFront()`, and `Activate` now also brings the page view forward so any tab interaction heals an orphaned raise; ownership is entry.appId-checked, fail-soft. (2) App renderer views are now created with a **transparent native background** (the themed BaseWindow paints identically behind), and the browser's `body` + `.browser__region` are a real alpha hole — so while the chrome is raised the page stays visible under the floating menu, exactly like a normal browser dropdown. (3) The browser chrome subscribes via new SDK `watchMenuOpenState` (one fancy-menus store subscription covers ⋯/history/shield menus AND the omnibox typeahead; survives the async host mount; close-animation counts as open so quick re-opens don't flicker) and raises/lowers around the popup stack. No new capability — the method rides `web.browse`, and nothing about the page crosses the boundary in either direction. Probe 920 asserts the real-shell stacking flips and restores with zero console errors; deep-browser 228 green as regression cover; +9 unit tests (service routing/ownership, container raise, SDK watcher, app raise/lower wiring). **Residue:** the delegated tooltip chips (`data-bs-tooltip`, a separate DOM controller outside the menu store) still place *below* toolbar buttons into the page region, so a tooltip over a loaded page stays invisible — cosmetic sibling of this class; hover-driven raising would thrash IPC, so it likely wants top-placement inside the toolbar band instead.

### F-470 - I shared a note with a teammate and nothing ever reached them
- **session:** collab-009-channel-cascade   **kind:** bug   **app:** shell (sync)   **status:** done
- **what I was trying to do:** share a chat channel with Marcus so he could read the conversation.
- **what happened:** Marcus's shell received the key for the channel and then dropped every frame that followed. Nothing appeared on his side, ever. His main-process log: `[live-sync] receive failed for ent_chan_general: envelope-pipeline: sender ... is not an authorized writer of ent_chan_general`.
- **what I expected:** the channel and its messages to show up, the way sharing has always worked in the demos.
- **evidence:** `tests/dogfood/.sessions/collab-009-channel-cascade/marcus.console.log`
- **triage (developer, 2026-07-31):** real, and worse than it looked - the F-288 Viewer-write gate resolved the sender against the receiver's LOCAL access record, and a first-time member has no local doc, so the owner was denied by the very frame that carried the record. Permanent deadlock on every cross-user share. It hid because every green collab spec receives through the ungated dev-bridge receiver and every unit test stubbed the predicate. Fixed by `authorizesAsShareBootstrap` (bootstrap only when the local doc has NO record, and only for a signature-verified active Editor+ in the incoming state) plus a self-key short-circuit for paired devices / restore. `009` now gets the channel + a message through; the residual is F-471.

### F-471 - one message of the shared channel still never arrives
- **session:** collab-009-channel-cascade   **kind:** bug   **app:** shell (sync)   **status:** ✅ fixed (shell #384)
- **what I was trying to do:** share a channel that already had two messages in it.
- **what happened:** after F-470 was fixed, the channel and the first message converge on Marcus's shell but `ent_msg_followup` never does - deterministically, every run. The relay audit shows the wrap forwarded to him and no update frame after it.
- **what I expected:** sharing a channel gives a teammate the whole conversation.
- **evidence:** `tests/dogfood/.sessions/collab-009-channel-cascade/relay-audit.log`
- **triage (developer, 2026-07-31):** the initial-state gap on the cross-user inbox path - the owner emits a child's full state right after that child's wrap, but the receiver only subscribes the child's channel once the wrap resolves, so a forward-only relay drops whatever lands in the gap. Design 71 §flow-1 nominates the durable node's snapshot+tail backfill to close it, but the production node **ignores the Collab-C5 `route` inbox override**, so pointing the spec at the node is strictly worse (no wrap reaches the receiver at all - measured). Needs either the node fanning by `route ?? entityId` or a receiver-initiated state request after subscribe. Own rung; spec `009` deliberately stays red until it holds.
- **re-triage (developer, 2026-07-31, after the fix):** the root cause above was **wrong**, and the earlier read that this would not reproduce was wrong too - running the collab suite hidden reproduced it on the first try. It is not an initial-state gap. The owner enumerates a container's children from the **SQLite index**, while the receiver's container-descent gate reads the child's parent property back out of the **doc it is sent**; an entity whose properties were never written through the Y.Doc has an empty property map, so the two disagree and the receiver refuses with `deny-container-not-a-child` (in `marcus.console.log`, for `ent_msg_kickoff` - the FIRST message, not the follow-up the original filing named). The shape is reachable in production because the ydoc worker only hydrates a legacy doc's property map on a write. Sharing now seeds the child's doc from its row first, leaving the receiver's check as strict as #379 made it. `009` passes in 2.5s, and a unit test pins the empty-map shape before the share and the parent property after, because the dogfood specs do not run in CI.

### F-474 - LAN sync admits my laptop but nothing actually syncs
- **session:** collab-012-lan-two-devices   **kind:** bug   **app:** shell (sync)   **status:** triaged — the LAN half named in this entry is ✅ fixed (shell #394); the symptom persists on a **different** root cause, now filed as plan rung `10.3c`
- **what I was trying to do:** sync two of my own machines over the local network with the relay stopped, which is P2P-1's headline.
- **what happened:** after the admission fixes in shell #385 the laptop is admitted and its transport really is `lan`, but nothing converges. The desktop hosts and never joins the session it is hosting, so its own edits reach nobody. `012` now fails at the convergence step instead of at the dial.
- **what I expected:** an edit on either machine to appear on the other.
- **evidence:** `tests/dogfood/.sessions/collab-012-lan-two-devices/{mira,marcus}.console.log`
- **triage (developer, 2026-07-31):** the host's own code assumes a client that nothing creates - `DEFAULT_LAN_MAX_CONNECTIONS` is commented "two paired devices need 2 (the host's own loopback client + the guest)", but no path ever dials the host's own listener; `onUrlChanged` only updates the discovery advert.
  **An attempt is written up here so the next pass does not repeat it.** Adding a `SelfHost` dial source ranked below every real peer, fed from `onUrlChanged`, gets a long way: the host self-dials, the listener accepts the connection (logged: 2 live, the guest plus itself), and NOT ONE failure path fires - no seal refusal, no unanswered challenge, no bad host proof, no missing hello, no rejected hello. All of those are instrumented as of #385 and #386. The connection is still dropped at the client's 3000 ms deadline, so the handshake stalls somewhere between "accepted" and "authenticated" without ever failing.
  Two things ruled out: it is not the OS (a raw `node:net` connect to this machine's own LAN IP succeeds from plain node AND from Electron), and it is not the host-listen policy (a reconcile probe showed `want=true` throughout, so the `[lan-host] stopped` line is teardown, not a policy flip).
  The next pass wants per-step handshake timing on both halves of a self-connection - accepted, hello in, challenge out, auth in, verified, auth-ok out, proof verified - because the failure is an absence rather than an error. Also worth deciding whether the host should feed its own `FrameRouter` in-process instead of dialling itself over a socket: the round trip buys nothing when both ends are one process, and it is exactly the part that fails.
- **re-triage (developer, 2026-08-01, after re-running the spec):** the fix the previous triage was reaching for **landed** (shell #394) and it works — the host now joins its own session through `LanRelayHost.webSocketCtor()`, the in-process seam, rather than dialling its own address over a socket. A fresh run logs `[lan-dial] target … (self-host)` then `connection accepted (2 live)`, and `012` gets **past every transport assertion**: both shells report `transportKind: "lan"` against a private address with the relay process stopped. So the LAN transport claim is now met.
  **The symptom survived because it never had one cause.** What remains is not LAN at all: `[dev:collab] receive failed: envelope-pipeline: no DEK for entity ent_lan_brief`. The laptop has no key for the entity, and it never could have — **nothing in production ever gives a paired device an entity DEK.** All five production `wrapDekForRecipient` call sites address either *this* device (`session.deviceX25519.publicKey`) or a *cross-user* member/invite key resolved by user identity, under which two devices of one identity are the same recipient; pairing transfers the identity secret and writes roster records but no keys; and each device mints its own X25519 pair, so a wrap sealed to device 1 is structurally unopenable by device 2. Stage `10.3b` shipped the whole receive half — envelope kind, seq tracker, and an authorization branch that explicitly admits a wrap from *this same identity* — and was marked ✅ on an E2E test that **hand-builds the wrap production never builds**. Filed as **`10.3c`** with an executable brief; this entry stays open until that rung lands, because from Mira's chair the machine still does not sync.
- **do not claim in release notes:** two of your own devices do not sync — not over the local network and not over the relay. The LAN link itself is real (it connects, admits, and reports "no server"), but no data crosses it, so do not describe multi-device sync as working. Sharing with **another person** over the relay is unaffected and does work.

### F-473 - my laptop will not join the desktop over the local network
- **session:** collab-012-lan-two-devices   **kind:** bug   **app:** shell (sync)   **status:** ✅ fixed (all three named causes: `bun install` for the mDNS dep · shell #385 admission · shell #386 failure-path logging) — verified 2026-08-01 by a live `012` run reaching `transportKind: "lan"` on both shells; what the session was ultimately after is blocked on `10.3c`, tracked in F-474
- **what I was trying to do:** sync my two machines over the local network with the relay stopped, which is what P2P-1 says I can now do.
- **what happened:** the desktop listens on its private address (`[lan-host] listening on ws://192.168.2.50:65414`) and the laptop targets exactly that address, then gives up instantly and falls back: `[lan-dial] target ws://192.168.2.50:65414 (manual)` followed immediately by `[lan-dial] no peer - relay`. Automatic discovery does not find it either. The transport stays `loopback`.
- **what I expected:** the two machines to find each other and sync with no server involved.
- **evidence:** `tests/dogfood/.sessions/collab-012-lan-two-devices/{mira,marcus}.console.log`
- **triage (developer, 2026-07-31):** three separate things, and the spec had never actually been run before today.
  1. **mDNS was dead locally.** `bonjour-service` is declared in `packages/shell/package.json` but was installed in no local tree, so the responder threw `ERR_MODULE_NOT_FOUND` and automatic discovery could never work. `bun install` fixes it; it also unbreaks local `tsc`. This means P2P-1's auto-discovery half has never been exercised on this machine, which is exactly what the packaging gate exists to catch.
  2. **The manual dial still fails with mDNS present.** *(Resolved in shell #385 - the roster the handshake authenticates against was never re-read after pairing, pairing was asymmetric so neither device recorded the other, and every refusal was silent. The dial is now admitted and the transport is `lan`; what remains is convergence, tracked as F-474.)* In `LanDialMode.Manual` the coordinator only returns `null` when the URL is cooling down, so the target being set and cleared in consecutive log lines means the connection was attempted and failed. Not an environment block: a raw `node:net` connect to this machine's own LAN IP succeeds, so the socket layer is fine. Root cause not yet found.
  3. **A failed dial says nothing about why.** The failure path logs only `no peer - relay`, with no reason, no address, no error code. That is undiagnosable in the field and should be fixed regardless of (2).
  Also worth noting: the cooldown is 60 s while the spec waits 30 s, so once a dial fails the manual fallback cannot recover inside the test - and a user who typos an address then corrects it waits a minute.

### F-472 - two shells on a shared note never see each other's presence
- **session:** collab-010-presence-live   **kind:** bug   **app:** shell (presence)   **status:** ✅ fixed (shell #387 — the retro-wrap placeholder DEK now mints at ordinal 0, below every real wrap, so an owner's first share outranks it instead of being rejected as a replay)
- **what I was trying to do:** see who else is on the note I just shared.
- **what happened:** both shells publish presence (the relay audit shows awareness frames in both directions) but each fails to open the other's: `xchacha20poly1305: open failed: aead::Error`. Neither sees anyone.
- **what I expected:** an avatar for the other person, the way the presence stack shows it.
- **evidence:** `tests/dogfood/.sessions/collab-010-presence-live/marcus.console.log`
- **triage (developer, 2026-07-31):** they hold different DEKs. The dogfood's `installShareReceiver` creates the receiver's row with `dek_id IS NULL` before the share lands, the boot `retroWrapNullDeks` pass then mints a LOCAL DEK for it (marcus logs `wrapped 9 entities` where every other shell logs 8), and `installEntityDek`'s monotonic rule then rejects the owner's v1 wrap as not-strictly-newer. The trigger is dev-bridge-shaped - production's `installWrap` creates the row and its DEK together - but the hazard is real: any null-DEK row awaiting a wrap becomes permanently un-shareable. The fix touches DEK version semantics on a security-critical path, so it is its own rung rather than a drive-by. Presence itself is wired and covered by `presence-scenario.test.ts` + the PRES-4 gate.

### F-469 — I can't resize anything on a whiteboard
- **session:** user report, owner-confirmed (2026-07-29)   **kind:** gap   **app:** whiteboard   **status:** ✅ fixed (shell #358)
- **what I was trying to do:** make a sticky note bigger so more of its text shows, and shrink a frame that was way too large for the three cards inside it.
- **what happened:** nothing on the board is resizable — no handles on a selected node, no cursor change on the edges, nothing. Every sticky is forever 180×180.
- **what I expected:** select a node → grab a corner or edge → drag to resize, like every other whiteboard tool.
- **evidence:** user request (resizable sticky notes); owner verified in code — nodes carry `width`/`height` in the model and the renderer paints them, but there is zero resize machinery (no handles, no interaction).
- **triage:** _(✅ fixed shell #358 — plan rung 9.17.23: 8 resize handles on the single selected node (corner squares + edge strips below the connector dots), pure `logic/resize.ts` with per-kind minimums + anchoring + aspect lock (Shift; default-on for images), moving-edge snap-to-guides via the drag magnet, one commit per gesture (single-step undo), lock/read-only gated at grip AND commit, Alt+Arrow keyboard resize, grip aria-labels + live-region announcements in all six locales. Real-shell visual spec `whiteboard-resize.spec.ts` green; also repaired the dead `whiteboard-snap.spec.ts`.)_

### F-468 — Help → "Report on GitHub" does nothing
- **session:** owner dogfood (2026-07-28)   **kind:** bug   **app:** shell / help + open ladder   **status:** ✅ fixed (shell #349)
- **what happened:** clicking the Help header's "Report on GitHub" button produced no visible reaction — no window, no prompt, no error.
- **what I expected:** the GitHub issue-template page to open (or at least be asked how to open it).
- **evidence:** real-shell Playwright probe: on a clean vault the chain works (the "Open outside the vault?" consent prompt appears), but every *refusal* outcome — previously-denied consent, cancelled picker, no opener — resolves to an explained `{handled:false, message}` the fire-and-forget `window.open` path **discarded**. One "Never for this kind"/cancel and the button is permanently, silently dead. Doc-57's "never a silent no-op" invariant stopped one hop short of the user.
- **triage:** _(✅ fixed shell #349 — Help + billing dispatch through a shared `renderer/ui/open-external.ts` that surfaces refusals as a toast; new real-shell e2e regression spec `help-report-github.spec.ts`. Probe also caught a literal `{signature}` rendering in the consent prompt's reason line — missing interpolation arg, fixed in the same PR. Residue: main-side routed organic links (`wireDashboardLinkRouting` / app tab views) still discard results — needs a main→renderer surface, follow-up.)_

### F-467 — feedback dialog's "Enable sending" button is ugly
- **session:** owner dogfood (2026-07-28)   **kind:** design   **app:** shell / feedback dialog   **status:** ✅ fixed (shell #349)
- **what happened:** the opt-in banner's Enable-sending button is a glaring solid-white pill (the `Neutral` inverse-surface hero face on a dark theme) dropped mid-sentence inside the banner paragraph, wrapping the line around a 36px control.
- **what I expected:** a banner action that sits with the banner — subtle, aligned, on the theme.
- **triage:** _(✅ fixed shell #349 — banner is now a flex row (`.feedback-dialog__banner--action`, text + right-aligned action), button switched to the theme-accent `Glass` variant; screenshot-verified light theme in the built shell, variant is theme-aware for dark.)_

### F-466 — collab session 001 no longer converges over the in-process relay
- **session:** collab-011-asset-relay-loop (2026-07-28)   **kind:** bug   **app:** collab harness / sync   **status:** ✅ fixed (shell PR #350). Root cause: shell #335 made `makeRelayPort` classify ANY loopback/private `syncRelay` URL as a LAN peer (`isLanRelayUrl`) and build the port with `requireAdmission: true`. A plain relay server never runs the LAN admission handshake, so the port sat "Open but never admitted" and the G5 hold swallowed every subscription made before the socket opened — first among them the LiveSyncEngine's `inbox:<userPub>` channel (subscribed at session activation, before the relay is configured). The owner's share-time `WrapBootstrap` routed to that inbox had no subscriber and was dropped; entity-channel subscribes (made post-open) leaked through the gate, so Updates still arrived and Marcus logged `no DEK for entity` forever. 003/011 stayed green only because the durable node's backfill re-serves the wrap on a late subscribe. Fix: the LAN trust model is now selected ONLY by an explicit `syncRelay.lan: true` config flag (never the address), and gated ports now hold post-open subscribes/sends until admission too (G5 completed). Regression pinned by `packages/shell/src/main/sync/inbox-wrap-delivery.test.ts` (fails on the old classification, receiver's real install path) + orchestrator/port unit tests; 001/003/011 re-run green.
- **what happened:** while closing the Asset-B4 relay-loop gate, regression-running the collab suite showed `001-mira-marcus-share` (in-process `launch-relay` transport) failing `awaitConverged` — Marcus logs `[dev:collab] receive failed: envelope-pipeline: no DEK for entity ent_hub_brief` repeatedly, i.e. the inbox `WrapBootstrap` never installs before the Update frames arrive.
- **what I expected:** the whole collab suite green.
- **evidence:** tests/dogfood/.sessions/collab-001-mira-marcus-share/marcus.console.log (`no DEK for entity`); reproduced twice.
- **triage:** _(open. NOT an Asset-B4 regression: reproduced identically against a stashed origin/main baseline build in the same worktree environment; `003` (durable node) and the new `011` are green there. Suspect the in-process relay's inbox-channel delivery vs the durable node's — the wrap rides `inboxChannelFor(userPub)`, which only the production LiveSyncEngine subscribes.)_

### F-465 — half my Today list is junk from your own tests
- **session:** 915-northbound-business-state (2026-07-27)   **kind:** bug   **app:** Tasks / Contacts (vault data)   **status:** _(open — F-424(b) residue, now measured)_
- **what I was trying to do:** open Tasks and see what I owe today.
- **what happened:** **5 of the 11 overdue items are test residue** — `DeleteMe task 26658`, and *four* copies of `Ship pricing page` with random number suffixes (`35757`, `63574`, `25859`, `36941`). The real work — "Send Vertex Labs the Q3 proposal", "Issue #8 — final edit pass" — is buried among them, and the whole list is stamped red OVERDUE. Contacts has the same problem: `Page Probe E510658 (Advisor)` and `Probe Z144741 (renamed)` sit among my six real people.
- **what I expected:** my vault to contain my data. If a probe writes rows, it cleans them up.
- **evidence:** `tests/dogfood/.sessions/915-northbound-business-state/03-04-tasks-open.png` (5/11), `05-06-contacts-open.png` (2 probe contacts).
- **triage:** _(open. This is F-424(b) — "residue sweep still open" — with the extent finally counted rather than described: it is not a cosmetic tail, it is ~45% of the owner's Today view. Two halves: (1) sweep the existing rows, which needs the per-owning-app delete path since the renderer `vaultEntities` surface has no delete; (2) stop new residue at the source — the probe specs that mint `DeleteMe task <rand>` / `Ship pricing page <rand>` / `Probe <rand>` rows should either write to a scratch vault or delete what they create. (2) matters more: sweeping without it just resets the clock.)_

### F-464 — a contact's avatar shows "P(" as their initials
- **session:** 915-northbound-business-state (2026-07-27)   **kind:** bug   **app:** Contacts   **status:** _(open)_
- **what I was trying to do:** scan the contact list.
- **what happened:** the row for `Probe Z144741 (renamed)` shows a **`P(`** avatar — it took the `(` of "(renamed)" as an initial.
- **what I expected:** initials to be letters. Any name whose second word starts with punctuation — `Dana (Northbound)`, `Lee (ex-Acme)`, `O'Brien` — hits this.
- **evidence:** `tests/dogfood/.sessions/915-northbound-business-state/05-06-contacts-open.png`
- **triage:** _(open — the initials derivation takes the first character of each of the first two whitespace-separated words without requiring it to be a letter. Small, but it is on every avatar in the app and the same helper probably backs other entity avatars. Fix in the shared helper, not in Contacts.)_

### F-463 — the automations template gallery shows raw key names, on the business templates
- **session:** 915-northbound-business-state (2026-07-27)   **kind:** bug   **app:** Automations   **status:** ✅ done (2026-07-27, shell #329)
- **what I was trying to do:** set up a business workflow — I have no automations yet, so the app offered me its templates.
- **what happened:** two of the six cards read `template.triage-new-email.name` / `template.triage-new-email.desc` / `template.triage-new-email.trigger` and `template.email-follow-up-nudge.*` instead of words. The other four were fine. The two broken ones are the *business* ones — email triage and follow-up — i.e. the ones I actually came for.
- **what I expected:** template cards to have names.
- **evidence:** `tests/dogfood/.sessions/915-northbound-business-state/01-01-automations-open.png`
- **triage / resolution (2026-07-27, shell #329):** real, in every locale, for two releases. The view builds its keys dynamically — ``t(`template.${template.id}.name` as AutomationsI18nKey)`` — so the template literal hid the key from `check-app-i18n.mjs` (it only sees literal arguments) and the `as` cast suppressed the type error. **Two safety nets, blinded by the same two lines.** Underneath is a duplication: `templates.ts` carries English `name`/`description`/`triggerSummary` inline *and* the catalog carries the translated copies, so one side can be populated while the other is forgotten. Fixed with the 36 missing entries (2 templates × 3 keys × 6 locales) plus a zero-baseline `check-template-i18n.mjs`. The gate caught a locale I had missed by hand (`es.json`) on its first run. **It also exposed two CI gaps**: `verify` ran `lint:apps` not `lint`, so `biome check .` never ran in CI at all, and the two newest ratchets were wired into `lint` only — meaning CI ran neither. Restructured so there is one list and CI runs it.

### F-462 — the widget Size menu doesn't mark my current size (and can't)
- **session:** 913b verification pass (2026-07-26)   **kind:** design   **app:** Shell (dashboard widget ⋯ menu)   **status:** ✅ done (2026-07-26, shell #300 — verified in the real app)
- **what I was trying to do:** check which size a dashboard widget is currently set to, from the same ⋯ → Size menu I use to change it.
- **what happened:** none of **Small / Medium / Large** is marked. No check, no selected styling — the group reads as three equally-unchosen options, so the menu can tell me what sizes exist but not which one I'm on.
- **what I expected:** a "pick one of three" menu shows which of the three is current — the documented select-menu affordance (a check on the chosen option).
- **evidence:** session 913b per-row probe — `Small [slot:1 svg:0] | Medium [slot:1 svg:0] | Large [slot:1 svg:0]`, **no `fm-row--selected` on any row**; screenshot `04-widget-menu-zoom.png` (the highlight visible on "Small" is the keyboard-active row on open, not a selection).
- **triage:** _(open — this is NOT the F-461 gutter bug; that one is fixed and the labels align correctly. This is the second half of the same owner report, and it turns out to be a **modelling** problem rather than a missing icon. `widgets-layer.tsx` computes `const current = record.w === fp.w && record.h === fp.h` against the three preset footprints — but the resize grip writes **arbitrary** `w`/`h` in `WIDGET_UNIT` steps (`onResizePointerMove` → `clampWidgetSizeToSurface`). So the moment a user drags a widget to any size of their own, the record matches no preset and every row is correctly-but-uselessly "not current". The menu is only honest for a widget that has never been hand-resized. Options: (a) mark the **nearest** preset and treat the presets as snap targets; (b) add an explicit "Custom" row that is selected when no preset matches, so the state is nameable; (c) show the actual cell dimensions in the section header ("Size — 4x3"). (b)+(c) are the honest pair — (a) alone would claim a size the widget isn't. Worth deciding alongside whether free-resize and presets should coexist at all.)_

- **fix (shell #300, verified in dogfood 913b):** took options **(b)+(c)** — name the state rather than guess a preset. The section header now carries the real footprint (**"Size — 20×21"**) so the actual size is always readable, and a non-interactive **"Custom"** row takes the check when no preset matches. It appears only when true; a permanent row would read as a fourth pickable size. Selecting a preset still snaps to it. Option (a) — marking the *nearest* preset — was rejected: it would claim a size the widget isn't.
  The match is now the pure `matchedWidgetSize` (null for a user size), so "none of these" is representable and testable; +3 tests including the both-axes case (Small/Medium share a height, Medium/Large share a width, so a one-axis compare mislabels). **Real-app confirmation:** the probed widget is **20×21** — one unit taller than Small's 20×20 — and the menu now renders `Size — 20×21 / Small / Medium / Large / ✓ Custom / Open app / Remove widget` (6 rows, `Custom [slot:1 svg:1]`), where before it was 5 rows with nothing marked.
### F-461 — half the rows in a menu have icons and half don't
- **session:** owner spot-check (2026-07-25)   **kind:** design   **app:** Shell (dashboard widget menu; likely fleet-wide)   **status:** ✅ done (2026-07-26, shell #296)
- **what I was trying to do:** resize a dashboard widget from its ⋯ menu.
- **what happened:** the menu is visibly two different menus stacked. The **Size** group (Small / Medium / Large) has no leading icon at all and shows the current size as a filled row highlight; the actions below it (**Open app**, **Remove widget**) each carry an icon. So the icon gutter is empty for the top half and occupied for the bottom half, and the selected size is communicated by a highlight rather than the check the select-menu convention specifies.
- **what I expected:** one menu. Either every row carries a leading glyph, or the enumerated-choice rows carry a **check on the chosen option** (the documented affordance — see CLAUDE.md §select-menu: "check on the chosen option") in the same gutter the icons use, so labels and gutter line up down the whole menu.
- **evidence:** owner screenshot 2026-07-25 (dashboard widget ⋯ menu). Not yet reproduced in a dogfood capture.
- **triage:** _(open — do NOT fix only the widget menu. This is a fleet question: which menus mix icon-bearing and icon-less rows, and which enumerated-choice groups signal selection by highlight instead of a check. **Sweep every `openAnchoredMenu` / `openObjectMenu` / `openSelectMenu` call site**, decide the rule once (leading glyph optional, but the gutter must be consistent within a menu; a chosen option in an enumerated group always gets the check), then land it as a shared-runtime default rather than per-menu edits — otherwise it re-drifts. Candidate for a lint ratchet in the same shape as `check-panel-toggles.mjs`: a menu config whose rows disagree on `icon` presence. Owner-reported, so it also wants a real screenshot capture to pin the before/after.)_
- **fix:** the gutter is now reserved by the **shared runtime**, not the call sites (shell #296). `openContextMenu` is the one chokepoint every menu funnels through — `openAnchoredMenu`, `openObjectMenu` and `openSelectMenu` all map onto it — so the rule is applied once and covers all ~198 call sites: **when any action row in a list carries an icon, every other action row in that list gets `blankMenuIcon`** (the no-op spacer that already existed for this purpose in the select menus). A menu whose rows are *all* icon-less is left alone (no gutter is a consistent gutter); headers/dividers never take a slot; each cascade child is normalized as its own list, since a submenu opens as its own popup. The enumerated-check half of the report was already satisfied — `widgets-layer.tsx` does put a `Check` on the chosen size; what was missing was the spacer on the *unchosen* rows, which is what collapsed the gutter.
- **after-shot captured 2026-07-26 — dogfood session 913b** (`tests/dogfood/.sessions/913b-f461-menu-f405-slash/04-widget-menu-zoom.png`), the real widget ⋯ menu the report was filed against. Per-row probe: `Small [slot:1 svg:0] | Medium [slot:1 svg:0] | Large [slot:1 svg:0] | Open app [slot:1 svg:1] | Remove widget [slot:1 svg:1]`. **Every row now occupies the icon gutter** (`slot:1` throughout — the unchosen sizes get #296's no-op spacer), so the labels line up down the whole menu instead of stepping sideways at the divider. That is the reported defect, closed, with the evidence the owner asked for. The size rows correctly show `svg:0` — they carry no glyph by design; reserving the column is what fixes the alignment.
- **fleet audit 2026-07-26 (the "are there still menus without icons" check):** swept every menu call site — **67 files open menus, 47 build rows**. **11 files have menus where *every* row lacks an icon.** Split two ways:
  - **~7 are correctly icon-less** — dynamic or enumerated *pick-one* lists where the rows are data, not verbs, so there is no glyph to depict and the check marks the choice: Database view-settings (property / relation / option pickers), Graph property defs, Tasks dependency candidates, Whiteboard connector routing / arrow / colour, the editor embed chooser, spellcheck suggestions, Form-designer's property list. These want the check-on-chosen affordance, not icons.
  - **4 are genuine action menus that deviate** from the shared object menu (which gives *every* action row a glyph — Open / Pin / Copy-link / Trash): `dictionary-editor` (Merge/Archive/Delete), `window-strip` (8 window-management verbs), `AttachContextButton` (Mention/Link/Upload), `theme-editor` (Preview shell / Open in code editor).
  **The blocker is the icon registry, not the call sites.** It holds **65 glyphs** and has none for *minimize, fill-screen, tile-left/right, centre, move-to-display, merge, upload, mention, preview* — so three of the four cannot be fixed by picking an existing icon, only by extending the registry (a design call, not a polish patch). Only `dictionary-editor` had exact fleet-standard matches already (`Archive`, `Trash`) and is fixed in shell #297. **Decision (owner, 2026-07-26): accept icon-less menus — the bar is *internal* consistency, not fleet-wide glyph parity.** A menu whose rows all lack an icon is fine; what is rejected is a menu whose rows *disagree*, and #296 makes that impossible by construction. So `window-strip`, `AttachContextButton` and `theme-editor` stay icon-less by choice, the registry is NOT extended for them, and a future audit should not re-open this. **F-461 is closed on this basis.** Note the gutter is *internally* consistent in all 11 either way — #296 guarantees that; this is the separate, cross-menu question of whether comparable menus agree.
  **The suggested lint ratchet was deliberately NOT added.** With the runtime normalizing, rows disagreeing on `icon` presence is no longer a defect to detect — it's the expected call-site input, so a `check-panel-toggles`-shaped check would fire on correct code. Enforcement-by-construction is the stronger guarantee; the invariant is pinned by 4 tests instead (3 fail without the fix, verified by reverting). **Residue:** the before/after screenshot capture the owner asked for is still owed.

### F-458 — my triage automation figures out an email is urgent but can't write that anywhere
- **session:** 914-mira-business-automation-audit (2026-07-23)   **kind:** gap   **app:** Automations   **status:** ✅ done (2026-07-26 — engine shell #302, builder UI shell #305; shipped in v0.10.1)
- **what I was trying to do:** build the automation I actually want for my business — "when a support email comes in, have the AI decide how urgent it is, then tag the email (or open a task) with that priority so my team sees it."
- **what happened:** the AI step happily classifies the email ("urgent"), but there's no step that can take that answer and put it *onto* an object. The **Entity** step only writes whatever the previous step already produced — I can't say "set `priority` to the AI's answer" — and the **Code** step can reshape text but can't build a `{ priority: … }` record (no way to write an object). So the automation can think, but it can't file. The only actions that actually land are "draft a reply" (opens a Mailbox draft) and "notify me" — and the notification text is fixed, so it can't even say *which* email or *how* urgent.
- **what I expected:** to pick "update this email → set priority = <the AI's answer>", or "create a Task titled <subject>, priority = <the AI's answer>", right in the builder.
- **evidence:** verified in-process — `packages/shell/src/main/integration/business-triage-flow.test.ts` (shell branch `verify/business-automation-flow`): the classify→draft path passes; the second case pins that the pure step set cannot assemble a new entity's fields from AI output. Root cause: `EntityStep` has no static/computed properties field (`operandProperties(ctx.input)` is the only source) and `code-expression.ts` has no object-literal grammar.
- **triage:** _(open — the intended path for "act with computed fields" is an **AIAgent step with a mutating intent tool**, but today the only broadly-handled write-ish intent is `compose` (draft email). Smallest fixes, any one of which unblocks "classify + file": (a) a static/template `properties` field on the Entity Create/Update step that can interpolate prior step outputs; or (b) object-literal + `merge()` support in the Code grammar; or (c) a first-party "file/label" intent (create-Task / set-property) the AIAgent can call. Recommend (a) — smallest, most legible in the builder.)_
- **fix (option (a), two halves):** **Engine — shell #302 (merged 2026-07-26):** `EntityStep` carries an optional `properties` map whose values are expressions in the existing audited Code grammar, evaluated against the same scope (prior-step outputs + `input`) — `{ priority: "classify.content", title: "email.properties.subject" }`. Declared fields are AUTHORITATIVE (the operand is not merged underneath — with an entity trigger the operand is `{ entityId, type, verb }`, and stamping event metadata onto the record is the silent-wrong-write class this exists to remove); a bad expression fails the step naming the field. The boundary test documenting the old limitation is replaced by the workflow this report wanted: Email trigger → Get → AI classify → Create Task{priority: AI answer}, asserting the created task's fields. **Builder UI — shell #305 (PR open):** the Entity step config shows a "Fields to write" list for Create/Update — field name + value expression per row, each with the prior-step binding picker (step ids are uuids; picking beats typing) — plus save-time validation that blocks a dangling bare reference but never second-guesses a literal (`'urgent'`) or computed value. Plan rung `11b.18`.

### F-459 — building an email automation needs a hidden "Code" step just to pass the email along
- **session:** 914-mira-business-automation-audit (2026-07-23)   **kind:** design   **app:** Automations   **status:** ✅ done (2026-07-26, shell #301)
- **what I was trying to do:** wire "when a new Email arrives → look at the email → classify it." I picked the **Email arrives** trigger, then added a **Get Email** step, expecting it to just work.
- **what happened:** the Get step got nothing. It turns out the trigger hands the next step `{ entityId: … }`, but the Entity step wants a bare id (or `{ id: … }`), so they don't line up — I had to drop in a **Code** step containing `input.entityId` between them to translate. No normal person building an automation would guess that.
- **what I expected:** the **Email arrives** trigger should feed straight into a step that acts on that email, with no glue step.
- **evidence:** verified in `business-triage-flow.test.ts` — the workflow only runs once a `Code: input.entityId` step is inserted before `Entity Get`. Root cause: `AutomationsHost.onEntityChange` fires the payload `{ entityId, type, verb }` (automations-host.ts), but `entityInterpreter`'s `operandId` reads a bare string or `{ id }` (step-interpreters.ts), never `entityId`.
- **triage:** _(open — smallest fix: teach `operandId` to also accept `{ entityId }` (and/or have the EntityEvent trigger payload carry `id` as an alias). One-line-ish, removes the glue step from every entity-triggered workflow.)_
- **fix (shell #301, merged 2026-07-26):** exactly the smallest fix — `operandId` also accepts `{ entityId }`, fixed at the reader (other consumers already read `entityId` from the event payload), with an explicit `id` still winning when both are present so a prior step's operand is never shadowed by the trigger's. Proof is the deletion: the `Code: input.entityId` glue step in `business-triage-flow.test.ts` is REMOVED and the flow still runs trigger → Entity Get → AI classify → draft. +3 unit tests.

### F-460 — I asked the assistant to "make a task for this" and it just talked back
- **session:** 914-mira-business-automation-audit (2026-07-23)   **kind:** gap   **app:** Agent   **status:** ✅ done (Agent-11b 2026-07-23 · 11d/11e shipped in v0.10.0)
- **what I was trying to do:** use the AI assistant the way I'd use a chief-of-staff — "read this and create a follow-up task", "add this person to my contacts."
- **what happened:** the assistant can *find* things and *open* them, and it can draft an email or save our chat as an automation — but it can't actually create or change anything in my workspace from the chat. It answered as if it had done it, but nothing appeared.
- **what I expected:** the assistant to take the action (create the task, update the record) — or at least tell me it can't, rather than implying it did.
- **evidence:** `apps/agent/src/logic/agent-tools.ts` — `curatedAgentTools` offers exactly one tool, `open` (read-only navigation); the code note says mutating verbs "arrive with the per-conversation grant UI (Agent-5)". So chat-side actions are limited to open / draft-email / save-as-automation. (Automations workflows CAN act via AIAgent tools — the chat app just doesn't expose them yet.)
- **triage:** _(open — two things: (1) the honesty bug — the model shouldn't claim it acted when it has no write tool; tighten the system prompt to state its tools are read-only. (2) the feature — land the Agent-5 per-conversation grant UI so a user can grant, e.g., "create Task" and the curated set expands beyond `open`. Ties to F-458's "file/label" intents.)_
- **closed 2026-07-26 (verified in code):** the evidence line — "`curatedAgentTools` offers exactly one tool, `open`" — is no longer true. It now returns `open` **plus** the full propose set, plus `PROPOSE_ROW_VERB` (when the vault has databases) and `PROPOSE_DATABASE_VERB`. **Agent-11b** (2026-07-23, the same day this was filed — the session ran against a pre-11b build) made the agent generate real vault data in chat, and **11d/11e** shipped in `v0.10.0`. Both halves of the triage are answered: the write path exists, and it's *propose→approve* rather than silent action, with `PROPOSE_TOOL_GUIDANCE` in the system prompt — so the model no longer has to claim an action it can't take. What it produces is a card you approve, which is the honest form of "make a task for this".
### F-457 — flipping to the year overview and back drops me on January, not this month
- **session:** 912-mira-calendar-deep / 912b-calendar-view-anchor-repro   **kind:** bug   **app:** Calendar   **status:** ✅ done (2026-07-23, shell PR #257)
- **what I was trying to do:** doing my usual planning — I tapped **Year** to eyeball the whole year, then tapped **Month** to get back to what I was doing.
- **what happened:** the month grid jumped to **January 2026** and stayed there, even though it's July. The agenda then showed "January 2026" under a "Today" heading, which made no sense. The **Today** button pulls me back, but I shouldn't have to.
- **what I expected:** switching to Year and back leaves me on the month I was already looking at (July).
- **evidence:** tests/dogfood/.sessions/912-mira-calendar-deep/09-12-new-event-detail.png (grid reads "January 2026"); repro 912b notes: `initial "July 2026" → after Year→Month "January 2026"`.
- **triage:** root cause — `setView` collapsed the anchor to `startOfYear` (Jan 1) for the Year tab, and the Month tab never re-normalized, so it kept January. The year view derives Jan→Dec from `getFullYear(anchor)` and year-nav steps ±12 months, so a Jan-1 anchor was never needed. Fixed by a pure `viewSwitchAnchor` (Day/Week snap; Month/Year/Agenda keep the anchor) + a Year→Month regression test. Only the Year round-trip was affected — direct Month→Agenda was already fine. **shell PR #257.**
  - _(Seed-data note, NOT a product bug: this session also surfaced garbled all-day event titles — "ipeline ready", a reversed "…d up from now on", random "Ship pricing page 63574" suffixes. They render identically across month + week views, so they're stored Northbound-seed artifacts, consistent with the earlier `012b-corrupt-event-forensics` corruption — left alone.)_

### F-456 — creating a vault in Downloads on Windows fails with "directory is not empty"
- **session:** user report (2026-07-22)   **kind:** bug   **app:** Shell (vault create)   **status:** ✅ done (2026-07-22, shell PR #243)
- **what I was trying to do:** create a new vault in (or in a fresh folder under) my Downloads folder on Windows.
- **what happened:** vault creation was refused with "Directory is not empty" even though the folder looked empty to me.
- **what I expected:** a folder that only holds Windows/OneDrive housekeeping files should be usable for a new vault.
- **evidence:** multiple Windows user reports; no dogfood shot (external report).
- **triage / resolution (developer, 2026-07-22, shell PR #243):** `ensureDirectoryUsable` (`packages/shell/src/main/vault/vault.ts`) treated **any** non-empty folder as unusable, but Windows Downloads / OneDrive-synced folders routinely carry a `desktop.ini` (and `Thumbs.db`; macOS `.DS_Store`), so a freshly-made folder there was rejected. Fix: OS-metadata entries no longer count toward emptiness; real user content still rejects. New test `vault-directory-usable.test.ts` (metadata-only folder succeeds; a folder with `report.pdf` still throws). Shipped alongside the analytics observability work that now lets us **see** this class of failure (`Error Encountered` events — the 0.8.0 analytics observability rider, shell PR #243).

### F-455 — a fresh journal day is a barren white page with no invitation to write
- **session:** 911-marcus-journal-books-preview-chat (2026-07-21)   **kind:** design   **app:** Journal   **status:** ✅ done (2026-07-23)
- **what happened (Marcus):** opening today's entry (no content yet) shows only a small "Start with a template" label + three chips marooned in the top-left, then a vast empty white canvas. The code DOES wire a `writeHint` placeholder ("Start writing your entry…") for the empty day, but it never renders — so there's no cursor prompt, no "click here to write" invitation. Next to Books' and Preview's centered `<EmptyState>` (icon + heading + subtitle + CTA), the daily writing surface — the app's whole point — is the least inviting empty state in the fleet.
- **what I expected:** the empty day should invite writing — a visible placeholder where the cursor lands ("Start writing your entry…", which is already authored) and/or a centered start affordance, not a blank page with the quick-start chips as a top-left afterthought.
- **evidence:** tests/dogfood/.sessions/911-marcus-journal-books-preview-chat/01-01-journal-first.png, 02-02-journal-entry.png (0 console errors)
- **triage / resolution (developer, 2026-07-23):** two halves. (1) Journal mounted the shared title-invariant plugin, which always injects an empty TitleNode as root[0] — Lexical's `$canShowPlaceholder` then stays false, so the wired `writeHint` never paints (the title itself is `display:none` in journal chrome). Dropped the title-invariant plugin from Journal; TitleNode stays registered for Notes-seeded bodies. (2) Shared `.bs-editor__placeholder` CSS was missing entirely — added dim absolute face in `editor-theme.css` + `position:relative` on the journal host. Source guard test locks the no-title-plugin invariant.

### F-454 — Preview's window has no name when nothing's open
- **session:** 911-marcus-journal-books-preview-chat (2026-07-21)   **kind:** design   **app:** Preview   **status:** ✅ done (2026-07-21, shell PR #231)
- **what happened (Marcus):** with no file open, Preview's header reads blank — a bare "0 of 0" page counter sits where the title belongs. Every other app names itself (Books "Books", Chat "Chat"); Preview's is the one window that looks unlabelled/unfinished.
- **what I expected:** the header carries the app name ("Preview") until a file is open, like the rest of the fleet.
- **evidence:** tests/dogfood/.sessions/911-marcus-journal-books-preview-chat/05-05-preview-first.png
- **triage / resolution (developer, 2026-07-21, shell PR #231):** the title face was `activeFile?.info.name ?? ""` — empty with nothing open. Now falls back to `t("app.title")` ("Preview"). +2 structure tests updated (were asserting the empty title). *(Session note: Books = gold-standard centered `<EmptyState>`; Chat = polished Slack-style; 0 console errors across all four apps reviewed.)*

### F-453 — the problems panel never reacts while I type broken code
- **session:** 910-marcus-code-editor-design-review (2026-07-19)   **kind:** design?   **app:** Code editor   **status:** ✅ not-a-bug (2026-07-19, rule-set read — shell PR #223 notes)
- **what happened (Marcus):** typed a snippet with an unused variable into a fresh file; "No problems" never changed — the panel reads as static text, not a live surface. (The unclosed paren I typed got auto-closed, so the syntax was valid — fair.)
- **triage:** _(open — probe-gated per the F-449 lesson: check the built-in linter's rule set first (unused-var may simply not be a rule) and whether diagnostics run on the unsaved buffer; only then decide bug vs rule-gap vs working-as-designed. If the panel IS inert on unsaved buffers, that's the find.)_

### F-452 — the References panel speaks our internal dev jargon to end users
- **session:** 910-marcus-code-editor-design-review (2026-07-19)   **kind:** design   **app:** Code editor   **status:** ✅ done (2026-07-19, shell PR #223 — neutral copy en+es)
- **what happened (Marcus):** the always-visible right panel says "No plan or open-question ids referenced in this file." — plan ids? open-question ids? That's the BRAINSTORM DEV VAULT's vocabulary leaking into a first-party app that Product Hunt users will open on day one. Nobody outside this repo knows what an OQ is.
- **what I expected:** the panel hidden unless the vault actually has the dev-plan structures, or generic copy ("No linked objects referenced in this file").
- **evidence:** tests/dogfood/.sessions/910-marcus-code-editor-design-review/01+03.png

### F-451 — every New file mints another immortal "untitled-N.ts"
- **session:** 910-marcus-code-editor-design-review (2026-07-19)   **kind:** design   **app:** Code editor   **status:** ✅ done (2026-07-19, shell PR #223 — create arms the inline rename; Escape keeps the default)
- **what happened (Marcus):** the create flow drops you into "untitled-3.ts" with no naming moment — and the vault already held untitled-2 from someone's earlier poke. This is the untitled-flood class (F-424) being manufactured at the source.
- **what I expected:** creation invites a name — inline rename armed on create (title selected, type-to-replace), Escape keeping the default.
- **evidence:** tests/dogfood/.sessions/910-marcus-code-editor-design-review/01+02.png


### F-450 — the Read surface's empty state tells me to "Add bookmark" — that's not how anything gets read
- **session:** 909-marcus-bookmarks-design-review (2026-07-19)   **kind:** design   **app:** Bookmarks   **status:** ✅ done (2026-07-19, shell PR #223 — Read/Archive get surface-true hints; Inbox/Tags keep the CTA)
- **what happened (Marcus):** the Read (and Archive) empty states reuse the inbox CTA verbatim — but adding a bookmark lands in the Inbox; nothing about the promised action fills THIS surface. The empty state renders beautifully now (the shared hero face — #219 verified live in this session) and then promises the wrong repair.
- **what I expected:** surface-appropriate copy — Read: "Mark a bookmark as read and it lands here" (no CTA, or a "Go to Inbox" one); Archive likewise.
- **evidence:** tests/dogfood/.sessions/909-marcus-bookmarks-design-review/03-06-surface-read.png

### F-449 — clicking a bookmark card did nothing in the scripted walkthrough
- **session:** 909-marcus-bookmarks-design-review (2026-07-19)   **kind:** bug?   **app:** Bookmarks   **status:** ✅ not-a-bug (2026-07-19, probe 909b)
- **what happened:** the spec clicked the first card and captured an unchanged screen — no detail pane, no visible response.
- **triage / resolution (probe 909b, 2026-07-19):** capture artifact confirmed — session 909's locator `[class*=card]` matched the cards CONTAINER (`.bookmarks__cards`), so the click landed on empty space. The targeted probe clicks `.bookmarks__card` and the detail island opens correctly (screenshot in 909b). Product behavior is fine. Bonus find in the same shot: the detail's source LINK repeats a domain title — fixed as the F-448 tail (falls back to the full URL; same shell PR #222).

### F-448 — a bookmark titled by its domain reads "example.com / example.com"
- **session:** 909-marcus-bookmarks-design-review (2026-07-19)   **kind:** design   **app:** Bookmarks   **status:** ✅ done (2026-07-19, shell PR #222)
- **what happened (Marcus):** the card meta repeats the title verbatim when the captured title is the bare domain — pure noise in the row.
- **triage / resolution:** the meta shows the domain only when it differs from the title.

### F-447 — the connect dialog's primary action hides below the fold
- **session:** 908-marcus-mailbox-design-review (2026-07-19)   **kind:** design   **app:** Mailbox (connect dialog)   **status:** ✅ done (2026-07-23)
- **what happened (Marcus):** the IMAP form's help paragraph is five lines before a single field appears; by the time the SMTP row renders, Cancel/Connect are cut off at the popover fold — the primary action of the dialog isn't visible when it opens. In reconnect mode (dialog pre-filled, user came to change ONE field) the same five-line lecture pushes the button even further down.
- **what I expected:** the primary action visible at open — shorter help (link the provider details out), or a sticky footer, and reconnect mode should drop the how-to prose entirely.
- **evidence:** tests/dogfood/.sessions/908-marcus-mailbox-design-review/03+07.png
- **triage / resolution (developer, 2026-07-23):** Cancel/Connect moved to the shared Popover sticky footer (`form=` association keeps submit wired). Reconnect mode drops the IMAP how-to lecture entirely. Create mode keeps help in the scrollable body; primary action always visible at open.

### F-446 — the popover panel is translucent enough that the page bleeds through the form
- **session:** 908-marcus-mailbox-design-review (2026-07-19)   **kind:** design   **app:** SDK popover (cross-app)   **status:** ✅ done (2026-07-19, shell PR #220 — 52% elevated-surface veil over the glass, frosted look kept)
- **what happened (Marcus):** with the indigo hero CTA behind it, the connect dialog shows blurry violet blobs THROUGH the panel, right behind the Email/Username/Password fields — the glass surface is too transparent over saturated content, and form legibility pays for it. Visible in both the connect and reconnect captures.
- **what I expected:** a dialog surface that reads as a surface — more opacity or stronger blur on `<Popover>`'s panel (this is the shared primitive, so every app's dialogs inherit whatever we choose).
- **evidence:** tests/dogfood/.sessions/908-marcus-mailbox-design-review/03-03-connect-dialog-imap.png

### F-445 — a connection failure speaks errno and offers no way forward
- **session:** 908-marcus-mailbox-design-review (2026-07-19)   **kind:** design   **app:** Mailbox   **status:** ✅ done (2026-07-19, shell PR #220 — classifySyncError: connectivity class gets human copy + the inline Reconnect… affordance)
- **what happened (Marcus):** the banner reads "Sync failed: imap: connect ECONNREFUSED 127.0.0.1:59993" — raw wire jargon — and unlike the auth failure (which earned a friendly hint + a Reconnect… button), a connection failure gets NO inline action, even though Edit connection… is exactly the fix and exists one hidden hover-menu away.
- **what I expected:** "Couldn't reach imap.example.com — check the host and port" + the same inline Reconnect…/Edit connection affordance the auth path has.
- **evidence:** tests/dogfood/.sessions/908-marcus-mailbox-design-review/05-05-failure-chrome.png
- **triage:** _(open — map ECONNREFUSED/ENOTFOUND/ETIMEDOUT to human copy in the driver-error → note path and extend the banner's reconnect affordance to connection-class failures; small, ride the next Mailbox PR.)_

### F-444 — a third small-radius CTA (Bookmarks) — "fix all such buttons at once"
- **session:** owner report (2026-07-19)   **kind:** design   **app:** Bookmarks / lint infra   **status:** ✅ done (2026-07-19, shell PR #219)
- **what happened:** the Bookmarks inbox empty state ships the same unsized primary CTA — third instance of the class (Mailbox F-437 → Code-editor F-441 → this).
- **triage / resolution (developer, 2026-07-19, shell PR #219):** the F-441 SDK enforcement only reaches surfaces that USE the shared `<EmptyState>`; Bookmarks' was a bespoke div + bare `bs-btn`. Converted (hero face = enforced lg geometry) — and the class is now RATCHETED: `tools/check-bespoke-empty-cta.mjs` (zero-baseline, in `lint`/`lint:apps`) fails any `__empty` container offering a `data-bs-primary` CTA outside `<EmptyState>`. Red-checked against the pre-fix tree. Repo sweep confirmed no other offenders (code-editor already shared — its report predated #209; form-designer/mailbox are text-only hints).

### F-443 — imported numbered lists count "1. 1. 1." — every item its own list
- **session:** owner report (2026-07-19, with the Anytype client source for `updateNumbersTree`)   **kind:** bug   **app:** shell/import (Anytype)   **status:** ✅ done (2026-07-19, shell PR #218)
- **what happened:** a numbered list from Anytype renders every item as "1." — the numbering restarts per item.
- **what I expected:** 1. 2. 3. — Anytype numbers client-side over consecutive Numbered siblings.
- **triage / resolution (developer, 2026-07-19, shell PR #218):** the client splices invisible **layout-Div wrappers inline before numbering** (`updateNumbersTree`'s `unwrap`); our converter had no `block.layout` handling, so each Div wrapper opened a fresh grouping scope → one single-item `<ol>` per item. `convertChildren` now pre-flattens `layout.style === "Div"` exactly like the client; Row/Column layouts keep their own scope (client restarts numbering per cell — parity test). **Existing docs repair by re-running the import** — the F-398 hash-skip replants bodies whose new serialization differs.

### F-442 — imported note images bleed off the window edge inside an unstyled figure
- **session:** owner report (2026-07-19, imported lesson notes)   **kind:** bug   **app:** editor (shared)   **status:** ✅ done (2026-07-19, shell PR #217)
- **what happened:** images in imported notes render wider than the content column and get cut by the window edge; "it uses figure which has huge margin".
- **what I expected:** images sized to the column, aspect kept.
- **triage / resolution (developer, 2026-07-19, shell PR #217):** the editor's legacy bare `image` node renders `<figure class="bs-editor__image">` which had **no CSS rule anywhere** — the UA default `margin: 1em 40px` plus an uncapped imported pixel width (Anytype plants carry one) is exactly the overflow. Pre-IE-10e plants keep bare `image` nodes forever (idempotent re-import skips unchanged bodies), so the clamp went into the shared `editor-theme.css` (self-heals every doc, no migration): inline margins zeroed, figure+img `max-width: 100%`, `height: auto`, styled caption. Geometry pinned by a `styles-image-figure.test.ts` guard (the lane-fill pattern). Longer-term dedup residue: TWO image node families exist (`ImageBlockNode` `.notes__image` styled vs bare `ImageNode`) — converging them is the fix-class.

### F-441 — Code-editor's "New file" has the same unsized-button drift; stop fixing it one app at a time
- **session:** owner report (2026-07-18)   **kind:** design   **app:** SDK empty-state   **status:** ✅ done (2026-07-18, shell PR #209)
- **what happened:** the hero empty-state CTA shipped with no size class again (md face, `--radius-sm`) — Code-editor this time, right after Mailbox's F-437. The owner: "would be great to fix it everywhere and stop drifting from design system."
- **triage / resolution (developer, 2026-07-18, shell PR #209):** system enforcement, not another call-site patch — `.bs-empty-state--hero .bs-empty-state__action .bs-btn` now carries the lg face (height/padding/`--radius-md`) in the shared SDK CSS, so every app's hero CTA inherits it and cannot drift back.

### F-440 — my inbox synced "35 new" and that's all I'll ever get — no pages, no way to load older mail
- **session:** owner report (2026-07-18)   **kind:** gap   **app:** Mailbox   **status:** ✅ done (2026-07-18 picker #210 · 2026-07-19 backfill+paging #214 = Mailbox-12)
- **what happened:** the first sync pulled a handful of messages and stopped; no pagination, no "load older", no hint that a 30-day window was chosen for me.
- **what I expected:** my mailbox — or at least a visible choice of how much history syncs and a way to extend it later.
- **triage / resolution (developer, 2026-07-18):** `connectImap` silently defaulted `SyncWindow.Days30`; the engine already supports 30d/90d/1y/all + a 500/folder page budget. (a) ✅ shell PR #210 — the IMAP form exposes a "Sync mail from" picker (shared `SelectMenu`, default 90d). (b) open — **Mailbox-12**: progressive backfill ("load older" per folder without remove+reconnect) + list paging/virtualization for large mailboxes.

### F-439 — "Show remote content" does nothing — the images never appear
- **session:** owner report (2026-07-18)   **kind:** bug   **app:** Mailbox   **status:** ✅ done (2026-07-18, shell PR #208)
- **what happened:** clicking the banner's "Show remote content" changed nothing; remote images stayed missing with zero feedback.
- **triage / resolution (developer, 2026-07-18, shell PR #208):** probe-reproduced, real root cause: **`about:srcdoc` iframes inherit the app page's CSP** — the page allowed `img-src 'self' data: blob: brainstorm:` only, so the frame's relaxed opt-in CSP could never win; the click was structurally a no-op. App-page img/font/media now include `https:` (invariant documented next to the meta); the frame's own blocked-mode CSP stays the default-deny enforcement. Proof: local-https test image naturalWidth 0 → 1 across the fix. Deeper follow-up noted: dedicated `brainstorm://` mail-body documents with per-message CSP headers would let the app page stay fully strict.

### F-438 — my first real inbox: every mail takes two clicks, folders are called INBOX/Social, and blocked images are broken-glyph soup
- **session:** owner report (2026-07-18, first successful mail.ru sync — 35 messages)   **kind:** design   **app:** Mailbox   **status:** ✅ done (2026-07-18, shell PR #207)
- **what happened:** (a) every single message rendered as a one-item "conversation" — expander chevron, count badge, a literal "1 message" line — so opening ANY mail took a click to expand the tree (showing a duplicate row) and a second click to open; (b) the rail showed raw server paths (`INBOX/Social`, `INBOX/Receipts`); (c) the "Sync finished — 35 new" banner parked permanently; (d) with remote content blocked, every remote `<img>` painted a broken-image glyph.
- **what I expected:** singles open on first click with no conversation chrome; folder names, not transport paths; transient success notices; blocked images invisible, not broken.
- **triage / resolution (developer, 2026-07-18, shell PR #207):** singles render as plain `MessageRow`s (threads with 2+ keep the expander; regression test clicks a single and asserts first-click open); `INBOX/` prefix stripped for display; info notes self-dismiss after 6s (errors persist); blocked mode hides remote-src images via frame style, inline `data:`/`cid:` untouched. Rode along: `bun run lint` was red on main (biome slips from #201/#202 — CI's verify job doesn't run the biome half; worth a CI follow-up) + web comments restamped F-429→F-433. **Second pass (owner: "check it actually … a lot of elements look ugly"), verified against a realistic mock inbox with probe screenshots:** the reading pane's dedicated 44px toolbar band (Reply/Forward floating top-left, two icons in an empty strip) merged into the subject row; bespoke `.mb-reading__action`/`.mb-body__remote-btn` replaced with the shared `.bs-btn` primitive; and row subjects/snippets — flex containers where `text-overflow` never applied — now truncate with a real ellipsis via an inner `.mb-row__text`. Screenshot-verified: first-click open, thread chrome only on real conversations, INBOX/-prefix strip (mock mail.ru folder set), blocked-remote-image hiding, banner/button alignment.

### F-437 — the connect CTA is an unsized button with small-radius corners, and the password field assumes I own an "App password"
- **session:** owner report (2026-07-18, post-#202 retest)   **kind:** design   **app:** Mailbox / SDK button   **status:** ✅ done (2026-07-18, shell PR #205)
- **what happened:** (a) the "Connect account" hero CTA has no `bs-btn--*` size class — md face, `--radius-sm` corner at hero prominence; (b) the IMAP form labels its secret field "App password", which dead-ends anyone who doesn't have one (the owner: "it still asks for App password which i do not have").
- **triage / resolution (developer, 2026-07-18, shell PR #205):** system fix + copy fix: `bs-btn--lg` (unused by any caller until now) never adjusted radius — the SDK lg variant now carries `--radius-md`, and the CTA takes `bs-btn--lg`. Password field relabeled "Password"; the app-password requirement (and the providers that enforce it: Gmail/iCloud/Yahoo/Fastmail) moved into the dialog help text. en+es.

### F-436 — `bun run dev` has been serving me two-day-old apps no matter how often I restart
- **session:** owner report follow-up (2026-07-18, "I still don't have Reconnect")   **kind:** bug   **app:** shell dev seeder   **status:** ✅ done (2026-07-26, shell #299; the shared-SDK staleness vector (d) via shell #288's `bundle-staleness.ts`)
- **what happened:** every app bundle in the Personal vault is dated **16 Jul 15:02** while app fixes merged 17–18 Jul (incl. #198's Files/Agent fixes and #202's Mailbox UX) — the owner restarted repeatedly and legitimately concluded the fixes "didn't work". `~/.brainstorm/logs/errors.log` shows why: auto-seed per-app vite builds exiting 1 in bulk (11:51 + 11:59 boots — notes, database, tasks, calendar, journal, code-editor, whiteboard, bookmarks…), and `seedDemoApps` counts those as per-app *warnings* while still marking the vault seeded; a failed build leaves the old dist, the unchanged bundle hash makes the installer skip, and the stale copy survives forever. The logged esbuild error is truncated to a useless stack tail, so the root cause of the build failures is unknown.
- **what I expected:** a dev restart deploys my current source, or screams visibly when it can't.
- **evidence:** `~/.brainstorm/logs/errors.log` 2026-07-18T09:51/09:59Z warns; `<vault>/apps/*` mtimes 16 Jul vs shell main 17–18 Jul.
- **triage:** _(open — (a) capture full stderr of the per-app build, (b) a failed build must surface as a boot-blocking banner/notification, not a console warn, (c) don't mark the app "seeded/skipped" when its build failed. Root-cause of the esbuild exits still to be found — same class as the DEPLOYFIX-59069a1 poisoned-vault trap, new vector.) **Second vector confirmed 2026-07-18 (22:10 smoke):** the vite per-app CSS cache served PR #205's app-theme.css change stale — the smoke build's `bs-btn--lg` rule lacked the new `border-radius` even though main had it; a warm-cache seed rebuild propagates app-source changes but not shared-SDK CSS. (d) the seeder should build with a cold CSS cache or hash the SDK inputs into the app-bundle hash.)_
- **fix (shell #299, merged 2026-07-26):** the invariant the code *documented* was only enforced for a seed that THROWS — a per-app vite build that fails resolves normally into `result.errors`, and the `.then()` branch marked the vault seeded anyway (failed build → old dist → unchanged bundle hash → installer skips → stale forever). A resolved-with-errors seed now takes the thrown path: bounded retry (`MAX_SEED_ATTEMPTS`), and on exhaustion boot completes but `console.error` names exactly which apps are stale (**(c)**, and **(b)** as a loud error rather than a banner). **(a)**: the diagnostic kept `stderr.slice(-400)` — the node stack tail — while vite prints the actionable file+line FIRST; `summarizeBuildStderr` now keeps head + tail and says how much it dropped. Vector **(d)** was closed by shell #288's `bundle-staleness.ts`, which hashes shared-package inputs (`@brainstorm-os/sdk`, `sdk-types`, `editor`, …) into the app-bundle staleness check so an SDK/CSS edit invalidates every app. +3 tests.

### F-435 — composing mail is plain-text; I want the real editor surface and HTML mail out
- **session:** owner report (2026-07-18)   **kind:** gap   **app:** Mailbox   **status:** ✅ done (2026-07-18, shell #208 — Mailbox-11)
- **what I was trying to do:** write a mail with formatting.
- **what happened:** the composer body is a bare textarea; sent mail is text-only.
- **what I expected:** the shared rich-text editor surface (like Notes), sending proper HTML mail.
- **triage:** _(open — the transport is ready: `mail.send` → MIME builder already accepts `bodyHtml` and both drivers submit it; only the composer never produces HTML. Plan rung Mailbox-11: editor-surface compose producing sanitized HTML + a plain-text alternative part, HTML-aware reply/forward quoting.)_

### F-434 — an IMAP socket timeout crashes the whole mailbox worker
- **session:** owner report follow-up (2026-07-18)   **kind:** bug   **app:** Mailbox (worker)   **status:** ✅ done (2026-07-18, shell PR #206)
- **what happened:** during a sync attempt against the owner's misconfigured/unreachable IMAP host, `imapflow` threw `Socket timeout` as an **uncaughtException** in the mailbox worker — the worker died (`exited with code 1; respawning`, then code 2) instead of the attempt failing like an auth rejection does.
- **what I expected:** a connect/socket failure surfaces as a sync error in the app (like "authentication failed" does), never a worker crash.
- **evidence:** `~/.brainstorm/logs/errors.log` 2026-07-18T18:24:15Z (`imapflow/lib/imap-flow.js:949` TLSSocket timeout, uncaught).
- **triage / resolution (developer, 2026-07-18, shell PR #206):** exactly the hypothesis — imapflow reports post-connect socket failures as unlistened `'error'` events → uncaughtException → worker death. `ensureImap` now attaches a lifetime error listener (log + drop the cached connection, guarded against clobbering a replacement client) so the next call redials; regression test emits the event through the injected client seam. Owner kept hitting it live (a respawn per failed sync).

### F-433 — even logged into X, every follow/login API call 403s — our browser announces itself as Electron
- **session:** owner report (2026-07-18)   **kind:** bug   **app:** Browser (shell web session)   **status:** ✅ done (2026-07-18, shell PR #201)
- **what I was trying to do:** use x.com in the Browser after the F-426 report — logged in, tried to follow someone.
- **what happened:** `POST /i/api/1.1/friendships/create.json` and every `flow/viewer.json` 403; castle (X's device-risk SDK) throws; the page works in Chrome with the same account.
- **what I expected:** a logged-in interactive session to behave like Chrome — same engine, same user at the keyboard.
- **triage / resolution (developer, 2026-07-18, shell PR #201):** the locked web session shipped Electron's default UA (`… Brainstorm/0.5.3 Chrome/… Electron/… Safari/…`) — anti-bot walls read the `Electron/…` token as automation and 403 write/login APIs regardless of trust-site state (trust only lifts OUR blocklist/cookie-strip; it can't fix what we tell the server we are). Fixed: `chromeEquivalentUserAgent` strips the Electron + app tokens once per session (`configureSessionPolicy`), unit-tested. **Owner retest needed** (trust x.com per F-426, restart shell, retry follow/login); if 403s persist, next suspect is `sec-ch-ua` client-hint branding, which `setUserAgent` does not change. *(Note: the merged shell code comment + PR #201 body say "F-429" — allocated before harness PR #67 claimed 427-430; the web-policy.ts comment correction rides the next browser PR.)*

### F-432 — my mail account failed to sync and then simply ceased to exist
- **session:** owner report (2026-07-18)   **kind:** design   **app:** Mailbox   **status:** ✅ done (2026-07-18, shell PR #202)
- **what I was trying to do:** connect an IMAP account; the first sync rejected my credentials.
- **what happened:** the error banner truncated mid-sentence ("…not your accou…") with no way to read the rest and no reconnect affordance despite telling me to reconnect; the account appeared NOWHERE (the rail only shows accounts that have synced folders); there was no way to remove or retry it; and the message list claimed "Mail for this folder will appear here once it syncs" as if everything were fine.
- **what I expected:** see the failing account, read the whole error, and fix or remove the account where the error is shown.
- **evidence:** owner screenshot 2026-07-18 19:51 (sync-failed banner + empty rail + "No messages" blurb)
- **triage / resolution (developer, 2026-07-18, shell PR #202):** four fixes: (1) banner wraps instead of ellipsizing, gets error tone + `role=alert`, and auth failures carry an inline **Reconnect…** button; (2) the rail always renders every account ("Not synced yet" when folderless) with a per-account ⋯ → Sync this account / Remove account — first UI exposure of `mail.disconnect`; `accountsFromEntities` now hides `enabled:false` (disconnected) rows; (3) empty state stops promising mail while the last sync failed; (4) see F-431 for the connect-surface copy. **Known gap (open follow-up):** connect always *creates* an account — a credential-edit path (reconnect-in-place, `connectImap` accepting an existing accountRef) needs a service change; today the flow is remove + re-add.

### F-431 — Mailbox pretends it's Google-only; IMAP/SMTP hides inside a "Connect Google account" dialog
- **session:** owner report (2026-07-18)   **kind:** design   **app:** Mailbox   **status:** ✅ done (2026-07-18, shell PR #202)
- **what I was trying to do:** connect a custom IMAP/SMTP mailbox.
- **what happened:** every entry point said Google — menu "Connect Google account…", CTA "Connect Gmail", dialog title "Connect Google account" — with the IMAP/SMTP form living as a tab *inside* the Google-titled dialog, reading like a Google sub-option.
- **what I expected:** a provider-neutral "connect mail account" surface where Google and IMAP/SMTP are peers.
- **triage / resolution (developer, 2026-07-18, shell PR #202):** copy predates the IMAP slice (Mailbox-2 landed into Mailbox-5's Gmail-era strings). All connect surfaces neutralized (en+es): "Connect mail account…" / "Connect account" / CTA blurb naming both families; dialog title "Connect mail account".

### F-430 — button corners differ around the app, and ButtonSize.Sm is a cramped face
- **session:** owner report (2026-07-18)   **kind:** design   **app:** shell/ui + Chat   **status:** ✅ fixed, in review (shell PR #203)
- **what happened:** some buttons wear invented corner radii (hardcoded px, not the token scale) — Chat alone had nine (7px icon buttons, 10px send/composer, 5px pills); and the 24px `ButtonSize.Sm` face reads cramped everywhere it's used.
- **triage / resolution:** all radii tokenized onto the 2/4/8/12 scale (Chat ×9, SDK menus 0.25rem, two stray 8px) + a **zero-baseline CI guard** (`tools/check-hardcoded-radius.mjs` in `bun run lint`) so a px radius outside the scale fails the build — the systemic fix the control-face complaints keep asking for. `ButtonSize.Sm` removed outright: 79 call sites → Md (compiler-enforced), `.button--sm` CSS deleted; IconButton's own scale untouched.


### F-429 — disabled glossy buttons flatten into a single-colour slab
- **session:** owner report (2026-07-18)   **kind:** design   **app:** shell/ui (Button)   **status:** ✅ fixed, in review (shell PR #200)
- **what happened:** glass/primary buttons lose the glossy treatment entirely in disabled/loading states — flat background, no shine.
- **triage / resolution:** the F-410 readable-disabled-labels fix zeroed all three shine layers on `:disabled`; the face gradient survived but reads flat without its speculars under the desaturate. Shine layers now dim to 0.45 instead of vanishing — material identity kept, inert read kept (desaturate + no outer shadow). Tuning knob is the single 0.45 if it reads too shiny live.


### F-428 — my "Stunden" collection imported as a note (again, next to its List)
- **session:** owner report (2026-07-18)   **kind:** bug   **app:** shell/import (Anytype)   **status:** ✅ fixed, in review (shell PR #199)
- **what happened:** the Anytype Collection object minted BOTH its Database List and a Note twin — a junk "Stunden" note in the notes list per import source.
- **triage / resolution:** Anytype's `details.layout` is the object-KIND discriminator (owner supplied the ObjectLayout enum; verified against the export — Stunden = 14 Collection). The importer now routes on it: Collection mints its List only; chrome layouts (Dashboard/Space/Date/SpaceView/Participant) never mint entities. Existing Note twins are residue for the sweep (import never deletes). Full kind-routing (Task(2)/Bookmark(11) → native types) filed as IE-10e residue.

### F-427 — imported screenshots render page-width huge in the editor
- **session:** owner report (2026-07-18)   **kind:** bug   **app:** shell/import + editor   **status:** ✅ fixed, in review (shell PR #199)
- **what happened:** every imported image fills the editor at natural size; Anytype stored my chosen display width and the import dropped it.
- **triage / resolution:** two halves. (1) the importer emitted the bare inline `image` node — the editor's resizable media block is `image-block` (alignment + `widthPercent`); it now emits that. (2) Anytype exports the width as `fields.width`, a FRACTION of editor width (verified: 0.195 → 20%) — carried into `widthPercent`, clamped 10–100. Seed stand-in added (decorator kind, v2 shape); asset-src rewrite covers the new node; re-import replants existing bodies (hash changes) so widths repair in place.

### F-426 — X.com won't let me post, and nothing tells me the browser's privacy shield is why
- **session:** owner report (2026-07-18)   **kind:** design   **app:** Browser   **status:** ✅ done (2026-07-21, shell #230)
- **what happened:** posting on X fails with a wall of console noise — our tracker blocklist cancels X's device-risk beacons (`ERR_BLOCKED_BY_CLIENT` on doubleclick/castle), X's anti-bot then 403s every `flow/viewer.json`, and the page's own nonce-CSP logs an inline-script violation. The DESIGNED fix exists — ⋯ → "Trust this site" (Browser-8) lifts the blocklist + 3p-cookie strip for the first party — but nothing at the point of breakage says so; the owner's first theory was CORS.
- **what I expected:** when a site misbehaves under strict privacy, the browser should offer the trust escape hatch where I'm looking — e.g. the blocked-tracker chip expands into "This site may not work with tracking protection — Trust this site", instead of leaving the count as trivia.
- **evidence:** owner console dump (flow/viewer.json 403s + castle errors + CSP violation), 2026-07-18
- **triage:** _(open — UX: make the tracker chip actionable (one-click trust + reload prompt); maybe detect repeated 403/blocked-beacon patterns to raise the hint proactively. The blocklist/strip behavior itself is working as designed.)_ **Update 2026-07-18:** the 403 half turned out to be a real bug, not the shield — the session's Electron-branded UA trips X's anti-bot even on trusted sites; split out and fixed as F-433 (shell PR #201). This entry stayed open for the trust-chip discoverability UX only. **Resolved 2026-07-21 (shell #230):** the blocked-tracker shield is now a button — clicking it names the blocked count, warns "Some features may not work with protection on," and offers one-click "Trust this site & reload" (reuses Browser-8 `onToggleTrust`). +2 tests.


### F-425 — the Agent's nested bullet lists collapse into one dash-riddled line
- **session:** 012-all-apps-smoke (polish sweep 2026-07-18)   **kind:** design   **app:** Agent   **status:** ✅ done (2026-07-18)
- **what happened:** an answer with `1. Documents:` followed by four `- link` sub-bullets renders the dashes inline — "- link - link - link" wrapped as prose — instead of a nested list.
- **what I expected:** nested bullets under the numbered item.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/12-app-agent.png
- **triage / resolution (developer, 2026-07-18, shell PR #198):** the column-0-anchored list matchers slurped indented `- item` lines into the paragraph as inline dashes. Matchers now tolerate ≤8 spaces of indent (nesting flattens to one level, documented); paragraph break rules match. Agent + Preview inherit; 507 tests green.

### F-424 — the Files vault root greets me with three rows of "(untitled)"
- **session:** 012-all-apps-smoke (polish sweep 2026-07-18)   **kind:** design   **app:** Files (universal browser)   **status:** 🟡 partial (2026-07-18)
- **what happened:** the vault root gallery leads with ~13 "(untitled)" Note/CodeFile/Profile tiles (probe residue + import leftovers) — name-sorted, "(untitled)" wins the top of the view, so the first screen of my vault is anonymous cards.
- **what I expected:** my named content first; untitled objects grouped last (or a cleanup affordance).
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/08-app-files.png
- **triage / resolution:** (a) ✅ shipped (shell PR #198) — name sort sinks untitled entities below named ones in both directions. (b) residue sweep still open: probe 012g found the rows (DeleteMe task, 2 probe Persons, doubled DeleteMe note) but the renderer `vaultEntities` surface has no delete and ignores the probe's query shape (list returned the full readable set) — the sweep needs the bin/delete path per owning app, and the corrupted "Pipeline ready" calendar chips live in calendar's LEGACY KV storage (no entity anywhere carries those strings), so their repair goes through the calendar storage adapter, not entities.

### F-423 — an imported note opens with an empty Title even though everything else knows its name
- **session:** 012-all-apps-smoke (polish sweep 2026-07-18)   **kind:** bug   **app:** Notes / shell import   **status:** ✅ done (2026-07-18)
- **what happened:** "Stunde 27 | Natasha" — window header, sidebar row and Database all show the name, but the editor's title node is the gray "Title" placeholder.
- **what I expected:** the title in the document, like every note I create by hand.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/01-app-notes.png
- **triage / resolution (developer, 2026-07-18, shell PR #198):** verified real (012c probe: explicit navigation, hydrated, h1 empty) — but the hash hypothesis was wrong (the hash already covers the title; a clean-room plant+hydrate repro passes). Rather than chase which historical plant minted each copy, the fix is self-healing at the editor seam: `NormalizeEmptyDocPlugin`'s non-empty path now runs the full repair once hydration settles — enforce the title invariant (a title-less planted body has a heading first), then adopt the entity's stored title into the empty TitleNode (once, at open, history-merge). A deliberate user clear stays cleared (clearing empties storedTitle too). In-process repro over genuinely-planted docs, titled + title-less; 493 Notes tests green.

### F-422 — my calendar is full of events named "ipeline ready" and ".no won morf pu d…"
- **session:** 012-all-apps-smoke (polish sweep 2026-07-18)   **kind:** bug   **app:** Calendar (event create input)   **status:** 🟡 diagnosed (2026-07-26, session 914 — 8 of the rows are repairable, 2 need owner intent)
- **what happened:** July is littered with chips reading "ipeline ready", "peline ready", "Pipeline readyPipe…", and one that is *literally reversed*: ".no won morf pu d…" = "…d up from now on." backwards. CSS can't reverse Latin text — these titles are STORED corrupted.
- **what I expected:** events named what was typed.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/04-app-calendar.png
- **triage / resolution (developer, 2026-07-18):** the INPUT bug is F-299, already fixed with a regression test (`entry-editor-seed-plant.test.tsx` plants "Pipeline ready" verbatim) — the calendar chips show HISTORICAL data typed while F-299 was live. The event-detail title is plain local state (no race at HEAD). Remaining work is data repair only, folded into F-424(b): the corrupted rows live in calendar's legacy KV storage (no entity in entities.db carries those strings — probes 012b/012e/012g), so the repair goes through the calendar storage adapter.

- **DIAGNOSIS CORRECTED 2026-07-26 (sessions 914 / 914b / 914e, real packaged shell + the Northbound vault).** The earlier triage was wrong on both counts: it said the corrupted rows "live in calendar's legacy KV storage … so their repair goes through the calendar storage adapter". They do not.
  - **Still visible:** yes — session 914 scanned the month views and found corrupted chips live on screen, so this was never repaired.
  - **The calendar KV is clean.** `data/apps/io.brainstorm.calendar/kv.json` holds exactly 20 milestone events, all well-formed. The bad chips are **mirrors**, not calendar events.
  - **The real owners are 13 `io.brainstorm.journal/Entry/v1` entities**, corrupted in their **body**. Found by enumerating `brainstorm.services.vaultEntities.list()` from a granted app page — `entities.db` is encrypted, so it cannot be inspected from outside the app (a plain `sqlite3` open fails with "file is not a database").
  - **`properties.body` is a PREVIEW, not the source.** `previewBodyText(body, maxChars = 200)` in `apps/journal/src/logic/journal-projection.ts` derives it, which is why the probed values end in `…`. So a repair must write the entry's **Y.Doc body through the editor**; patching `properties.body` would be overwritten on the next reprojection. This is the part the old triage would have sent someone the wrong way on.

  **Exact classification** (13 regex matches → 8 repairable, 2 owner-only, 3 false positives):
  - **8 truncated, unambiguous → `"Pipeline ready"`**: `journal-2026-06-30`, `-07-01`, `-07-03`, `-07-04`, `-07-05` (`"peline ready"`), `-07-06`, `-07-07` (`"ipeline ready"`), `-07-08`. Lost 1–2 leading characters to the F-299 input bug. Not a guess: three sibling entries (`-07-09`, `-07-14`, `-07-23`) hold exactly `"Pipeline ready"`, so the intended text is evidenced rather than inferred.
  - **2 need the owner's intent, NOT auto-repairable**: `journal-2026-07-18` is **reversed** (`".no won morf pu dekcab steg ti ;tluav siht ni sevil ynapmoc eht :nosseL …"` — reads back as "…lesson: the company lives in this vault; it gets backed up from now on."), and `journal-2026-06-29` is a **duplication** (`"Pipeline readyPipeline is looking healthy after two closed deals. Pipeline is looking healthy after two closed deals.Loc…"`) that runs on into other content. Reversing the first is mechanical but changes real prose; de-duplicating the second requires knowing what was meant.
  - **3 were false positives of my own probe** — `-07-09`, `-07-14`, `-07-23` have body exactly `"Pipeline ready"` and are healthy; the match came from `/peline ready/` matching inside the correct word. Recorded because the same regex would mislead the next person.

  **Deliberately not auto-edited.** The 8 are safe to repair, but this is the owner's permanent fixture vault ([[northbound-vault-permanent]] rule) and the repair path is "type into the Journal body", which is exactly how the corruption happened. Backup taken first (`northbound-2026-07-26.tar.gz`). Next step is a small repair session over those 8 dates, leaving the 2 for the owner.
### F-421 — Files gallery is a field of gray strips floating over dead space
- **session:** owner report (2026-07-18), reproduced in 905 re-run   **kind:** bug   **app:** Files   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** browse my imported screenshots in Files' Gallery view.
- **what happened:** every tile is a thin gray strip with a "PNG" badge — no thumbnail, even for sealed image assets — and below each row there's a huge dead gap. The layout has been "fixed" several times (f9e55cb frames, F-374 rings, F-392 gallery frames) and still reads broken.
- **what I expected:** image tiles showing the actual image, filling their cells.
- **evidence:** tests/dogfood/.sessions/905-anytype-files-deep-verify/10-files-screenshot-search.png (17:10 run)
- **triage / resolution (developer, 2026-07-18, same PR as F-420):** two independent root causes, neither touched by the earlier frame fixes. (1) **Lane fill:** `body[data-view-mode="gallery"|"grid"] .content-row` never declared `height: 100%` — the virtualizer's lane box is fixed-height and the host passes it through, but the card shrink-wrapped at the lane's top, collapsing the `flex:1` media band to a strip and leaving the lane remainder as the dead gap (the old always-on card chrome had *masked* this as a "small card"; the borderless-at-rest rework exposed it). Fixed with `height: 100%` on both tile modes + a **lane-fill contract test** (`styles-lane-fill.test.ts`, red/green-checked, all three fixed-lane modes) in the same guard style as `styles-rest-frames.test.ts` — the recurring-regression class now has a ratchet, per the "fix the system, not the instance" rule. (2) **Thumbnail gate:** the tile renders a thumb only off `properties.assetMime` (the upload path's contract) — the Anytype importer sealed File entities with `mime` only, so imported images could never preview. Importer now writes `assetMime`; re-running an import repairs existing entities in place. 333 Files tests + 397 shell tests green; real-shell re-verified (905 re-run: thumbnails paint, lanes filled).

### F-420 — my Anytype screenshots imported broken — and some as the WRONG image
- **session:** owner report (2026-07-18) after 905-anytype-files-deep-verify   **kind:** bug   **app:** shell/import (Anytype)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** trust that the 460MB with-files re-import actually brought my media across.
- **what happened:** notes still showed broken images (raw `bafyrei…` srcs — 38 across the lesson notes), and a deep audit found worse: **41 more images silently bound to the wrong binary** — screenshots taken in the same second slug to the same filename stem, the export disambiguates on disk with `_a`/`_o` suffixes, and the F-396 slug matcher bound *both* objects to the suffix-less file. The "verified" 420/457 number hid both classes.
- **what I expected:** every image the export contains, showing the image it actually is.
- **evidence:** tests/dogfood/.sessions/905-anytype-files-deep-verify/notes.md ([file-blocks] lines, 09:44 run: 26/28 loaded, 2 raw CIDs)
- **triage / resolution (developer, 2026-07-18, shell PR):** the export **states the binary mapping outright** — every file object's `details.source` is the export-relative binary path (`files/<name>`), 457/457 exact on the real export including all 37 name-less pasted screenshots, zero collisions. The hash route is a dead end (`fileId`/`fileSourceChecksum` hash the *encrypted* DAG — unreproducible from the exported plaintext), and the slug matcher was reverse-engineering a mapping it never needed to guess. Importer now binds `source`-first (slug chain kept as fallback for source-less exports); name-less objects synthesize a display name (binary basename + mime-derived extension) so sealed assets serve `image/png`, not octet-stream. **Verified against ground truth, not aggregates:** plan audit binds 457/457 with a bijective object↔binary map, 397/397 body images resolve; in-app re-run created the 37 missing File entities (+26MB), second run idempotent (0 created, +0MB), "Stunde 6 | Natasha" loads 28/28 images (was 26). **Process lesson (the real F-396 failure):** the fix was accepted on aggregate counts ("420/457 bound, missing dropped to 38") without asserting *which* binary each object got or auditing the residue — deep verifies must check the full mapping against the export, which is exactly what caught the 41 wrong-content bindings.
### F-416 — Anthropic's tile truncates mid-word: "Anthropic (Clau…"
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (AI)   **status:** ✅ done (2026-07-23)
- **what I was trying to do:** glance over the provider tiles on Settings → AI.
- **what happened:** the first tile's label truncates mid-word inside its own parenthesis — "Anthropic (Clau…" — while every neighbour fits. The tile is fixed-width; the one label that matters most reads like a typo.
- **what I expected:** the full name, or a truncation that doesn't cut inside a parenthesis ("Anthropic").
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/13-ai.png
- **triage / resolution (developer, 2026-07-23):** tile uses a short label (`shell.settings.ai.anthropic.tile` = "Anthropic"); credential dialog keeps the full "Anthropic (Claude)" name. Optional `tileNameKey` on `ProviderMeta` so other providers can follow without forking the tile.

### F-415 — Backup & Migration shouts five identical red buttons at me
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Backup & Migration)   **status:** ✅ done (2026-07-23)
- **what I was trying to do:** find the one action I actually wanted (export a backup) among the import cards.
- **what happened:** all five cards — Export vault, Import data, Obsidian, Notion, Anytype — end in the same filled-accent primary. On Rose (red accent) the page reads like five alarm buttons; nothing says which action is the headline and which are occasional migrations.
- **what I expected:** one primary (probably Export vault) and quieter secondary faces for the import entry points.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/07-backup-migration.png
- **triage / resolution (developer, 2026-07-23):** Export vault stays `ButtonVariant.Primary`; Import data / Obsidian / Anytype / Notion entry points drop to `Neutral`. In-dialog confirm actions stay primary (contextual). Hierarchy assertion in the panel smoke test.

### F-414 — Default apps asks me to pick an opener for "brainstorm/AutomationHostDesignation/v1"
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Default apps)   **status:** ✅ done (2026-07-23)
- **what I was trying to do:** set which app opens my notes and bookmarks.
- **what happened:** the OBJECT TYPES list greets me with raw internal ids — `brainstorm/AutomationHostDesignation/v1`, `brainstorm/TokenSet/v1`, `brainstorm/WhiteboardEdge/v1`, `brainstorm/BrowsingSession/v1` — dozens of rows for types I never open by hand, all labeled in wire-format. My actual types are buried in the middle.
- **what I expected:** human names ("Note", "Bookmark"), and only types a user can actually open.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/10-default-apps.png
- **triage / resolution (developer, 2026-07-23):** `buildDefaultsCatalog` drops plumbing types (`isPlumbingEntityType`) and types no app claims as an opener (generic Notes inheritance alone no longer floods the list). Each entry carries a human `label` via `typeDisplayName`; the Settings face shows the caption, wire id stays on `title=`.

### F-413 — my avatar is a pale circle with a speck of dust in it
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Identity)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** figure out what the little circle next to the display-name box is.
- **what happened:** with no photo and no name yet, the avatar button renders the initials fallback of an empty string — a bare "•". It looks like a rendering glitch, and nothing hints that clicking it picks a photo.
- **what I expected:** an affordance — a camera or person glyph.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/14-identity.png → after/14-identity.png
- **triage / resolution (developer, 2026-07-18, shell PR #189):** the empty-name fallback now renders a camera glyph (the button opens the photo picker); initials return as soon as a name exists.

### F-412 — the search stats leave a hole where a fourth tile should be
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Search index)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** read the index health tiles.
- **what happened:** three tiles sit on the first row and INDEX SIZE sits alone on the second next to an empty slot — at the default window size, every time. The grid's 160px min fits exactly three columns at this panel width, so the fourth always wraps.
- **what I expected:** a balanced 2×2 (or all four in a row when there's room).
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/09-search-index.png → after/search-index.png
- **triage / resolution (developer, 2026-07-18, shell PR #189):** min track 160→220px; 2×2 at the default width, 4-up on wide panels.

### F-411 — "Trust site" invites a click it can't honor; "Link account" greys out. Pick one.
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Network / Billing)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** understand whether the empty-input action buttons do anything.
- **what happened:** Browser-privacy's "Trust site" renders full-strength next to an empty input (clicking just flags an error), while Billing's "Link account" in the identical layout renders disabled until something is pasted. Two conventions for the same pattern, three sections apart.
- **what I expected:** the same rule everywhere.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/19-network-b.png · before/18-billing.png
- **triage / resolution (developer, 2026-07-18, shell PR #189):** "Trust site" now gates on a non-empty draft like "Link account"; the invalid-origin error still shows for non-empty junk.

### F-410 — the Save button is white text on almost-white; I thought it was missing
- **session:** 908-settings-sweep   **kind:** bug   **app:** shell (shared Button)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** save my display name on Identity (and read Billing's "Upgrade via checkout").
- **what happened:** every DISABLED filled button fades to 55% opacity, which on light themes (Rose especially) washes the accent face into the panel while the label stays white — Save / Upgrade via checkout / Link account were borderline invisible. Dark themes masked it, which is presumably how it shipped.
- **what I expected:** a disabled button that still reads as a button.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/14-identity.png · before/18-billing.png → after/billing.png
- **triage / resolution (developer, 2026-07-18, shell PR #189):** disabled filled faces (glass/primary/neutral/destructive) keep full opacity and desaturate instead (`filter: saturate(.25)`, gloss/shadows dropped); ghost variants keep the opacity fade. Same class as the 12.17 accent-contrast work — the disabled state had escaped that ratchet.

### F-409 — Network says "System proxy" twice and stacks it under "Edit proxy"
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Network)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** check which proxy the vault uses.
- **what happened:** the Active proxy block shows a "System proxy" pill on the left AND a right-aligned "System proxy" value directly under the right-aligned "Edit proxy" control — two right-stacked labels that read as a broken duplicated row. (Mode System resolves to kind Deferred, whose hint is the same string.)
- **what I expected:** the mode once, and a resolved hint only when it adds information.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/19-network.png → after/19-network.png
- **triage / resolution (developer, 2026-07-18, shell PR #189):** the resolved-kind hint renders only when it differs from the mode label.

### F-408 — the Data page tells me the same paragraph twice on one screen
- **session:** 908-settings-sweep   **kind:** design   **app:** shell/settings (Data)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** add my first property.
- **what happened:** the section intro ("Properties and dictionaries are vault-level…") repeats verbatim inside the empty-state card two centimetres below — the same t-key (`shell.settings.data.summary`) wired into both slots.
- **what I expected:** the empty state to tell me what to DO, not re-read the intro.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/06-data.png → after/06-data.png
- **triage / resolution (developer, 2026-07-18, shell PR #189):** new `shell.settings.data.properties.emptyHint` copy for the empty state.

### F-407 — my per-app notification list reshuffles itself every visit
- **session:** 908-settings-sweep   **kind:** bug   **app:** shell (apps:list-installed)   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** find Chat in Settings → Notifications → per-app toggles.
- **what happened:** the list came up Books, Browser, Agent, Calendar, Automations… — and on the next visit, alphabetical. `apps:list-installed` partitions orphans by pushing inside a `Promise.all` of fs checks, so the order is whatever the filesystem answered first; every consumer (notification toggles, icon picker) inherits the shuffle.
- **what I expected:** the same order every time.
- **evidence:** tests/dogfood/.sessions/908-settings-sweep/before/04-notifications.png (scrambled) → after/04-notifications.png (alphabetical, stable across passes)
- **triage / resolution (developer, 2026-07-18, shell PR #189):** partition after the checks settle, preserving the repo's `ORDER BY id`; verified stable across two full sweep passes.

### F-417 — I edited "Acme's deal value" and the number landed on Vertex
- **session:** 907i / 907l (rebuild arc)   **kind:** bug   **app:** Database   **status:** ✅ done (verified in the real app, session 913, 2026-07-26)
- **what I was trying to do:** give each of my four clients its deal value: select a row, type the number in the details panel.
- **what happened:** the panel silently kept editing a **different row**. Clicking another row's name or cells does not retarget the open details panel (and doesn't even move the selection); cell clicks **accumulate** into a multi-selection ("4 selected") whose panel edits the anchor object. Net effect: I typed 25000, 18000, 32000 for three different clients and all three overwrote **Vertex Labs**, one after the other — the last one stuck and my real Vertex number (48000) was gone. Nothing warned me; every edit felt targeted and succeeded.
- **what I expected:** the panel to edit the record I clicked, or refuse. Editing a record other than the one I believe is selected is data corruption with extra steps.
- **evidence:** tests/dogfood/.sessions/907i-crm-deal-inspector/02-grid-final.png (panel says "Vertex Labs · Deal value 32,000" after edits aimed at 3 other rows); 907l …/01-grid-final.png ("4 selected" + SUM 32,000).
- **triage:** _(open — two halves: (1) the right panel must follow the active row (or show WHOSE record it edits loudly); (2) plain click on any cell should move selection to that row, not accumulate. This burned a real founder workflow four sessions in a row.)_
- **VERIFIED FIXED 2026-07-26 — dogfood session 913** (`tests/dogfood/.sessions/913-f417-inspector-target-verify/`), driving the real packaged shell against the owner's Northbound vault. (1) **The panel follows the clicked row:** Acme Analytics → panel "Acme Analytics", Halcyon Research → "Halcyon Research", Beacon Ventures → "Beacon Ventures". (2) **Cell clicks no longer accumulate:** two successive plain cell clicks left the panel on one record and the selection-count bar **absent** — the "4 selected" symptom is gone. (3) **The data itself is correct and the reported loss is undone:** the Clients grid reads Beacon 32,000 · Halcyon 18,000 · Acme 25,000 · **Vertex Labs 48,000** — each value on its own row, and Vertex holding the very number the report said was destroyed. Screenshot `04-panel-halcyon.png` shows the Halcyon row selected with the panel titled "Halcyon Research" and Deal value 18,000. The session is deliberately **non-destructive** (it verifies targeting and never types a value) since it runs against the real vault. **F-418 closes with it** — it was triaged as the same anchor model, and the inspector property row it needed is the one shown working here.
- **superseded re-triage 2026-07-26 (code read only — NOT verified in a running app):** current `main` looks like it already satisfies both halves, so this entry may be stale. (1) `applyClick` (`apps/database/src/logic/selection.ts`) replaces the set on a plain click — `new Set([id])` — and only accumulates under Cmd/Ctrl; the grid row's `handleClick` (`react/grid-view.tsx`) passes real `shiftKey`/`metaKey`, and the cell-level `stopPropagation` calls are all deliberate and narrow (the hover "Open" button, an *active* title input, double-click-to-rename), so an ordinary cell click still bubbles to the row. (2) row clicks route through `onSelectEntity` → `applyClick` → `renderInspector`, so the panel retargets; and the multi-select branch of `renderInspector` now renders a **read-only** "N selected" summary list rather than editing the anchor — which is the specific data-loss path reported. **Do not close on this note** — the shell repo's history is squashed, so I couldn't date the fix, and a code read is not a repro. Next step is a dogfood capture on the 907i/907l scenario; if it's clean, close F-417 and F-418 together (F-418 was triaged as the same anchor model).

### F-418 — a number cell that won't open: I clicked, double-clicked, pressed Enter — nothing
- **session:** 907h / 907o (rebuild arc)   **kind:** bug   **app:** Database   **status:** ✅ done (closes with F-417 — verified in session 913, 2026-07-26)
- **what I was trying to do:** type deal values straight into the grid's Number column, row after row.
- **what happened:** the **first** number cell I clicked after opening the window edits fine (inline input, Enter commits, the SUM footer updates). Every other row's number cell after that is dead — click, click+Enter, double-click, select-the-row-first: no editor, no error, no console line (4 attempts × 3 rows × several sessions). The only workaround that filled all four rows was **restarting the app between each value** — one edit per boot.
- **what I expected:** click a cell, type a number — for every row, not just the first one I touch.
- **evidence:** tests/dogfood/.sessions/907h-crm-deal-final/notes.md (click/click+Enter/dblclick/select-first all "never got an inline input"); 907o notes.md (one value per fresh boot, four boots to fill four cells).
- **triage:** _(open — likely the same selection/anchor model as F-417: the inline editor only arms on the anchor row, and clicks on other rows don't re-anchor. Select-cells are fine (their menu opens per-row) — Number/Text cells are the broken kind.)_

### F-419 — the app let me create a second "Deal value" and then quietly split my data across the twins
- **session:** 907d / 907e / 907k (rebuild arc)   **kind:** design   **app:** Database / property system   **status:** ✅ done (2026-07-23)
- **what I was trying to do:** add a "Deal value" (Number) collection property — the create dialog is genuinely good (name, kind tiles, options textarea).
- **what happened:** a retry created a **second identical "Deal value"** — no warning, no merge offer, nothing distinguishes the twins anywhere (the add-column picker listed "Deal value" once, the inspector showed two identical rows, values landed sometimes on one and sometimes on the other, and which def the grid column bound to was undiscoverable). I only untangled it by finding Settings → Data and deleting one def — which worked well (usage-count in the confirm is nice), but nothing in the Database app points there.
- **what I expected:** creating a property with a name that already exists on this collection should warn or reuse; twin properties should at least be visually distinguishable.
- **evidence:** tests/dogfood/.sessions/907f-crm-fill-values/03-grid-filled.png (inspector: "Deal value" twice); 907k notes.md (Settings → Data shows 2 rows, delete → 1).
- **triage / resolution (developer, 2026-07-23):** the view-column constructor already reused same-name+type via `findReusablePropertyDef` (F-034); the **collection** property path did not — that was the twin factory. Collection create now consults the same helper and refuses to mint a second def, flashing that the property already exists. (Existing twins remain data residue for a Settings → Data cleanup.)

### F-403 — my dashboard shows a database id where the company name should be
- **session:** 906-northbound-v050-team-tour   **kind:** bug   **app:** Contacts (widget)   **status:** ✅ done (2026-07-23)
- **what I was trying to do:** glance at the Contacts widget after cleaning up my duplicate Vertex contact.
- **what happened:** Jonas Wehner's second line reads `ent_mrq2jeakonfzl4aj`. In the app his company shows fine (a "Vertex Labs" chip), but the widget prints the raw entity id. It's not the merge — the 903 capture shows the same leak on an older contact (`ent_mrbyrapeyce60oel`), so ANY contact whose company is a linked Company entity wears an id on my desktop.
- **what I expected:** the company name (or nothing) — never an internal id.
- **evidence:** tests/dogfood/.sessions/906-northbound-v050-team-tour/13-dashboard-no-whats-new.png; tests/dogfood/.sessions/903-recent-ship-sweep/01-dashboard-labels.png (same leak, pre-0.5.0)
- **triage / resolution (developer, 2026-07-23):** widget query now includes `Company/v1` so linked `Person.company` ids resolve to names via `companyNameIndex`; unresolved `ent_*` ids fall back to empty (never paint wire format). Free-text company strings still show. Unit coverage for resolve / hide / free-text.

### F-404 — I merged two contacts and the app never told me it worked (it errored instead)
- **session:** 906-northbound-v050-team-tour   **kind:** bug   **app:** Contacts   **status:** ✅ done (2026-07-23)
- **what I was trying to do:** finish the duplicate review — "Merge 2 contacts".
- **what happened:** the merge itself worked (one row left, fields unioned — genuinely good), but there was no confirmation of any kind, and the console logged `pageerror: io.brainstorm.contacts lacks capability for ui.notify` at that moment. So the app *tried* to tell me and the shell dropped it: the toast the flow ships is dead on arrival because the capability isn't in the manifest.
- **what I expected:** "Merged 2 contacts — the duplicate is in the Bin" (the dialog promises Bin recovery; the confirmation is where I'd learn that held).
- **evidence:** tests/dogfood/.sessions/906-northbound-v050-team-tour/console.log (pageerror line); 07-contacts-after-merge.png
- **triage / resolution (developer, 2026-07-23):** granted `notifications.post` in the Contacts manifest (the Stage 7.7 cap that backs `ui.notify`). Merge / vCard toasts can now reach the shell.

### F-405 — Journal (and Tasks) advertise "Type '/' for commands" but the menu can't embed anything
- **session:** 906 / 906c / 906d   **kind:** bug   **app:** editor (Journal + Tasks hosts)   **status:** ✅ done (2026-07-26 — walls 2+3 verified in 913b; wall 1 closed on evidence re-read: the "Notes lists pages" premise was a 906d probe-selector artifact)
- **what I was trying to do:** the F-070 headline — put the live pipeline into my weekly log: type `/` in today's entry and reference a page, exactly like I do in Notes every day.
- **what happened:** three walls. (1) In Notes, `/Stunde` lists my pages to embed right in the menu; in Journal the same query **dismisses the menu** and leaves `/Stunde` as literal text in my entry. (2) The Journal/Tasks slash menu is block-types only — no Embed, no Reference, no page results (`/emb` matches nothing and also dies to plain text). (3) Mid-line `/` after a space doesn't open the menu at all (Notes pops it anywhere). So the embed *nodes* shipped, but no path a user can type reaches them outside Notes.
- **what I expected:** parity means the same `/` experience: pages listed, an Embed/Reference command, mid-line trigger.
- **evidence:** tests/dogfood/.sessions/906d-slash-parity-probe/notes.md (Notes lists pages, Journal `/emb` → literal text) + 01/02 shots; 906c/01-journal-slash-fresh-block.png (block-commands-only menu); 906/08-journal-slash-menu.png (mid-line `/` inert)
- **triage:** _(open — F-070 follow-up: the shared block-embed/mention nodes are in the Journal/Tasks builds (`apps/journal/src/ui/entry-editor.tsx` promotes `block-embed`), but the hosts' slash typeahead isn't wired to the entity-search/embed commands the Notes menu has. Wire the shared embed picker into both hosts' `/` menus.)_

- **dogfood session 913b, 2026-07-26** (`tests/dogfood/.sessions/913b-f461-menu-f405-slash/`), real packaged shell, real vault. **Wall 2 is FIXED:** typing `/` in today's Journal entry opens the menu with **19 command rows** (Text · Heading 1/2/3 · lists · Quote · Callout · Code · Divider · Toggle …), and `/emb` narrows to exactly **Embed** ("Insert a preview card pointing at another vault object") and **Reference** ("Embed a live view of another page") — screenshot `07-journal-slash-emb.png`. The report's "`/emb` matches nothing and dies to plain text" no longer reproduces. **Wall 3 is fixed by construction** — every full-editor host now routes through the same `SlashMenuPlugin` (Journal via `FullEditorPlugins` → `StandardEditingPlugins`), so Notes and Journal cannot differ on the trigger; pinned by tests in shell #298. **Wall 1 is NOT verified:** this session typed command queries (`/`, `/emb`), not a page-name query like `/Stunde`, so whether Journal lists *pages* inline the way Notes does is still open — that is the mention/transclusion typeahead, not the block catalogue. Keep the entry open for that one wall.
- **note on the earlier automated verdict:** the first run of 913b logged "`/emb` NOT SURFACED" — a **false negative from the spec's selector**, not a product finding. The slash menu renders through the shared fancy-menus runtime (`openTypeaheadMenu`), whose rows are `.fm-row`, not `[role="menuitem"]`. The screenshot contradicted the log, which is why the shot is the evidence of record here and the note was discarded.
- **wall 1 CLOSED 2026-07-26 (evidence re-read, same false-positive class as above):** the claim "in Notes, `/Stunde` lists my pages to embed right in the menu" traces solely to the 906d probe — and its screenshot (`906d-slash-parity-probe/01-notes-slash-stunde.png`) shows **no slash menu open at all**. The logged "menu items" are literally the Notes **sidebar** rows, matched by the probe's `[role="listbox"] [role="option"]` selector: "Hausaufgabe 03.06.2026 Leset…", "Stunde 31 | Natasha" ×3, "Stunde 30 | Natasha" ×3, "📕Stunden" ×3 — the import-heavy vault's recent-notes list verbatim, each ×3 from nested matches. The Journal capture in the same probe caught its sidebar day list the same way (one "row" even contains the typed residue `/emb/Stund`). The spec's other citation ("session 114") has no surviving artifact. Code confirms the premise was never true at HEAD: the shared `SlashMenuPlugin` filters a static command catalogue for **every** host — Notes included — and no host lists pages inline in the slash menu; the sanctioned page path is `/emb` → **Embed** → the shared entity picker (`BlockEmbedPickerPlugin`, mounted for all full-editor hosts, pinned by shell #298). So there is no Notes↔Journal parity gap left: all three walls are either fixed and verified (2), fixed by construction with tests (3), or founded on a probe artifact (1). *Process residue: two dogfood specs in a row produced false verdicts from guessed selectors — matches the [[dogfood-spec-false-verdicts]] rule; future probes must assert on `.fm-row` (the shared menu row class) and read the screenshot before logging a verdict.*
### F-406 — the Files view menu shows me "Ic…", "G…", "G…" and expects me to pick one
- **session:** 906-northbound-v050-team-tour   **kind:** design   **app:** Files   **status:** ✅ done (2026-07-18, shell `0e7d3df6` — verified live; friction log catch-up 2026-07-23)
- **what I was trying to do:** switch the Vault view to Gallery from the header's view select.
- **what happened:** the dropdown renders so narrow every option label truncates to two letters — "Ic…", "G…", "G…" — and the *current* option renders as a bare checkmark with **no label at all**. Two of the four options both read "G…" (Gallery? Grid?), so the menu is literally undecidable without trial and error. This is the shared select-menu primitive wearing its check-column wrong, not a Files-only style.
- **what I expected:** a menu wide enough for its own labels: List / Icons / Gallery / Grid, check on the current one.
- **evidence:** tests/dogfood/.sessions/906-northbound-v050-team-tour/11-files-view-menu.png
- **triage / resolution (developer, 2026-07-18, `0e7d3df6`):** select opener floors `minWidth` at 200px (`Math.max(trigger, 200)`); empty icon column reserved so checked/unchecked rows align. Live-verified: 200px surface, 0 clipped labels.

### F-402 — every imported note opens with a blank title over the body
- **session:** 905-anytype-files-deep-verify / 905b   **kind:** bug   **app:** shell/import + Notes   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** open "Stunde 8" and see it as I left it in Anytype — title on top, lesson underneath.
- **what happened:** the window header, the sidebar row, and the Database row all say "Stunde 8" — but the note itself opens with an EMPTY title line and the body starting straight at "Seite 29". Every imported note is like this (`h1.notes__title` is empty on all 4 copies probed across both import sources): the title lives only in the entity properties, the importer never plants a Title node into the body doc. If I type into that blank title, which name wins?
- **what I expected:** the note's title in the note.
- **evidence:** tests/dogfood/.sessions/905b-anytype-fresh-copy-probe/notes.md (`editor-title=""` on every row); tests/dogfood/.sessions/905-anytype-files-deep-verify/06-stunde-8-blocks.png (body starts at "Seite 29", header says "Stunde 8").
- **triage / resolution (developer, 2026-07-18, shell PR #182):** confirmed — the importer never planted a Title node (the seeder/template path does). Every planted body now opens with the same `title` node shape the Welcome seeder plants (`withTitleNode`), including a title-only body for drafts with no block content. 905 re-run: `editor h1 = "Stunde 8"` / `"Stunde 6 | Natasha"` — **titles bar PASS**.

### F-401 — my chapter tag finally has a row in Properties… and the row says "Empty"
- **session:** 905b-anytype-fresh-copy-probe   **kind:** bug   **app:** shell/import + Notes   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** confirm the F-394 fix — "Stunde 8" wearing its "Kapitel 9" tag in the Properties panel on a fresh import (the fix ships values in `properties.values`, re-import refreshes).
- **what happened:** halfway there. The freshly imported copy DOES show a "tags" property row now (the old copy still says "No properties on this note yet", as F-394's no-migration note predicted) — but the row's value renders **"Empty"**. The value is either not landing in the shape the panel's value-store expects (imported as a bare `["Kapitel 9"]` array vs the labeled envelope?) or landing and not rendering. Either way I still can't see my chapter anywhere.
- **what I expected:** `tags: Kapitel 9`.
- **evidence:** tests/dogfood/.sessions/905b-anytype-fresh-copy-probe/notes.md (row#16 panel: "tags Empty"); 02-stunde-8-row16.png.
- **triage / resolution (developer, 2026-07-18, shell PR #182):** shape mismatch at three levels, all fixed in `importAnytypeExport`: (1) under a pre-existing SCALAR `tags` def (this vault's state, registered by a pre-F-394 build) the imported bare-string array coerced to `null` → "Empty"; (2) ISO date strings under a Date def failed `isDateValueShape` → same; (3) a fresh multi-Text def had no `vocabulary`, so `defaultViewFor` fell back to the scalar pill cell which can't render the envelope. Schema registration now runs BEFORE the entity loop, multi-value tag-likes mint a vocabulary Dictionary from the observed option labels (they render through the Tag cells), and every values-bag entry is coerced to its effective catalog def's stored shape (arrays join under scalar text defs; dates become `{ at, granularity }`). Established defs are still never overwritten. 905 re-run: panel shows `tags  Kapitel 9` — **properties bar PASS**.

### F-400 — I re-exported my space (as Anytype tells you to) and Brainstorm doubled it
- **session:** 905-anytype-files-deep-verify   **kind:** bug   **app:** shell/import   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** the exact flow the wizard implies is safe: my first export was JSON-only (904), so after the F-396 fix I re-exported WITH files and imported again, expecting my existing lessons to be refreshed with their media.
- **what happened:** Anytype names every export by timestamp ("Anytype.20260717.130907.7" vs "Anytype.20260717.145135.3.zip"), and the import dedupe key includes that archive name — so the second import didn't update my 49 lessons, it minted 49 MORE. Database now shows TWO "Stunden" Lists (41 members each) and every lesson exists twice with identical titles and dates. Worse, the Notes list windows its rows, so search looked like there was only one copy until I scrolled — I genuinely couldn't tell what had happened.
- **what I expected:** the same space to update in place — Anytype object ids are stable content ids (`bafy…`); the export's *filename* is the one thing guaranteed to change every time.
- **evidence:** tests/dogfood/.sessions/905-anytype-files-deep-verify/11-database-stunden.png (two "Stunden" 41-member Lists); 905b notes.md (2 rows per title).
- **triage / resolution (developer, 2026-07-18, shell PR #182):** confirmed — the dedupe source was `anytype:<archiveName>` and Anytype timestamps every export filename. The source is now `anytype:<spaceId>` (the export's own `details.spaceId`, majority across snapshots; archive name only as last-resort fallback — `anytypeImportSource`). **Back-compat:** vaults holding imports keyed by the old archive-name source import the space once more as new under the stable key (the old key could never match a new export anyway); from then on every re-export updates in place. 905 re-run: both runs `0 created / 49 updated` against the previously imported space.

### F-399 — an update run that created nothing cost me another 412MB of disk
- **session:** 905-anytype-files-deep-verify   **kind:** bug   **app:** shell/import   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** re-run the same 460MB zip (the card promises "updates rather than duplicates") and move on.
- **what happened:** the report said "0 created, 49 updated" — clean. But the vault on disk went 208MB → 625MB (run 1) → **1037MB (run 2)**. The second run re-sealed all ~370 referenced binaries into the AssetStore again and repointed the File entities at the new copies, leaving the first run's ~412MB as bound-but-orphaned assets nothing references.
- **what I expected:** an update run to cost roughly nothing; my vault not to grow by the export's size every time I re-import it.
- **evidence:** tests/dogfood/.sessions/905-anytype-files-deep-verify/notes.md ([run1]/[run2] vault-size lines).
- **triage / resolution (developer, 2026-07-18, shell PR #182):** exactly as triaged — `writeAsset` ran per referenced binary before the `existingByKey` check, so every update run re-sealed ~370 binaries and left the previous run's copies bound-but-orphaned. An existing File entity now keeps its asset when the content-addressed file object id + byte length match; a genuinely changed binary is re-sealed and the replaced asset removed via `deleteAsset` (no orphan leak). 905 re-run: update run vault growth **+0MB** (was +412MB).

### F-398 — re-importing pastes a second copy of every note under the first
- **session:** 905-anytype-files-deep-verify / 905b   **kind:** bug   **app:** shell/import   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** trust "re-importing the same export updates rather than duplicating".
- **what happened:** the entity ROWS update, but the note BODIES accumulate: the freshly imported "Stunde 8" has every heading exactly twice after two runs (h2 9→18, the whole lesson repeated top to bottom), and the copy that's been through more imports is at SIX copies (h2=54, 168 images for a 28-image page, the same PDF link four times). Each run's `plantImportSerializedBody` builds a brand-new Y.Doc and applies its update onto the existing body doc — Yjs merges the two versions, so every plant APPENDS the full body again.
- **what I expected:** re-import to leave the body as-is (or replace it), never to duplicate it.
- **evidence:** tests/dogfood/.sessions/905b-anytype-fresh-copy-probe/notes.md (h2=18 fresh / h2=54 old vs 9 in the export; imgs 56 / 168 vs 28); 905/08-stunde-27-checkboxes.png (120 checkboxes vs 20 exported).
- **triage / resolution (developer, 2026-07-18, shell PR #182):** exactly as triaged — a fresh `Doc()`'s update merged into a non-empty doc concatenates two Yjs histories. Two-part fix: the importer stamps a planted-state content hash (`importBodyHash`) so an unchanged body on re-import is **skipped outright** (zero doc updates on the 905 re-run), and a changed body loads the current doc snapshot (new ydoc-worker `snapshot` seam), clears the shared `root` XmlText, re-plants, and ships only the replace diff — deterministic replace, never append. 905 re-run: fresh copy `h2=9 h3=20`, checklist `=20` — exactly the export's counts. (The pre-fix copies keep their multiplied bodies — different dedupe sources, untouched by design.)

### F-397 — 416 "created", and not one screenshot actually shows in my notes
- **session:** 905-anytype-files-deep-verify / 905b   **kind:** bug   **app:** shell/import   **status:** ✅ done (2026-07-18)
- **what I was trying to do:** the whole point of re-exporting with files: open "Stunde 6 | Natasha" (28 screenshots in Anytype) and see the screenshots. The owner's bar for this import: "documents should have proper blocks, file blocks and properties and titles".
- **what happened:** the report was glowing — 416 created, missing media down from 406 to 38, my 370 binaries sealed (the vault grew 417MB to prove it), the Files app lists every screenshot and PDF. But in the NOTES: zero. Every `<img>` still has the Anytype display name as its src ("Screenshot 2026-03-06 at 09.38.18.png" → broken placeholder), not one `brainstorm://asset/` URL in any copy of any note (905b probed all four). The PDF file block in "Stunde 8" is a link whose href is the bare filename — clicking it goes nowhere, even though its File entity exists. So the media made it into the vault but never into the documents, and the report can't tell the difference. (Also: the File entities take the export's slugged, truncated filenames — "screenshot-2026-03-20-at-09-21-27.png", "15649-18_15-a1-2-mo-mi-2025-09-10-07_00-pm-175.pdf" — not the names I gave them.)
- **what I expected:** image blocks rendering my sealed screenshots inline; the PDF block linking to its File entity.
- **evidence:** tests/dogfood/.sessions/905-anytype-files-deep-verify/07-stunde-6-images.png (broken placeholders), 09-files-pdf-search.png + 10-files-screenshot-search.png (the same files, fine in Files); 905b notes.md (asset=0 loaded=0 on every copy).
- **triage / resolution (developer, 2026-07-18, shell PR #182):** both triage pointers confirmed: (1) the re-plant's map was keyed by the slugged on-disk name while body srcs carry the display name — assets are now sealed BEFORE the (single) body plant, which rewrites through an asset-src index resolving file object ids, display names, and slugged/truncated on-disk names (the F-396 slug + unique-truncation rule applied to BOTH sides; ambiguity never guesses); (2) the rewrite now covers `link.url` too, so non-image file blocks (PDFs) carry their sealed asset URL. File entities also keep the user's display name, not the slugged stem. 905 re-run: "Stunde 6 | Natasha" **26 of 28 `<img>` with `brainstorm://asset/` srcs, 26 actually loaded** (the other 2 are among the 38 binaries the export doesn't contain) — **file-blocks bar PASS**. Residue (pre-existing, editor-level, not importer): Lexical `LinkNode.sanitizeUrl` renders any non-http(s) anchor as `href="about:blank"`, so the PDF link's ANCHOR is inert even though its node url is the asset URL — affects every `brainstorm://` link in an `<a>`; needs an editor allowlist decision, follow-up candidate.

### F-396 — I re-exported WITH files (460MB) and the import still says every file is missing
- **session:** owner report (2026-07-18)   **kind:** bug   **app:** shell/import   **status:** ✅ done (2026-07-18)
- **what happened:** the wizard imported the objects fine but reported "406 file(s) referenced but binaries were not in the export" — with 457 binaries sitting right there in `files/`.
- **what I expected:** my screenshots and PDFs to land in my notes.
- **triage / resolution (developer, 2026-07-18, shell PR #181):** the export writes binaries under SLUGIFIED names (lowercase, non-[a-z0-9_] runs → dash) and truncates long stems at ~46 chars; the importer matched display names verbatim → zero hits. Slug rule derived empirically against all 457 binaries; the attachment index now keys slugged stem+ext with a unique-truncation-prefix fallback (never guesses on ambiguity), used by both the file-object and inline-block-name paths. Real-zip verify: 420/457 bound, 370 page file-links land, missing 406 → 38 (all name-less file objects). Ships in v0.5.1.

### F-395 — the Anytype import card's finish line is a dead end, and "1 failed" won't tell me what failed
- **session:** 904-anytype-import-wizard   **kind:** design   **app:** shell/settings (Backup & Migration)   **status:** ✅ done (2026-07-17)
- **what I was trying to do:** run the same export a second time — the card itself promises "re-importing the same export updates rather than duplicating" — and understand the "1 failed" in my run report.
- **what happened:** after a run the card shows only the summary line; the "Choose an export…" button is gone until I leave Backup & Migration and come back (the generic Import-data card has an "Import another file" affordance — this card doesn't). And the report says "1 failed" with no way to see *what* failed or *why*, so I sat there wondering which of my lessons didn't make it.
- **what I expected:** an "import another export" affordance right on the done state, and a failed count that expands into the actual reasons.
- **evidence:** tests/dogfood/.sessions/904-anytype-import-wizard/04-anytype-run2-report.png + notes.md ([run2] lines)
- **triage / resolution (developer, 2026-07-17, shell PR #179):** confirmed — the Obsidian/Notion/Anytype done states rendered only the summary `<p>` (no reset affordance; only the generic Import card had one), and the Anytype handler's `failed` row carried its media reason as a string the UI reduced to a count. All four flows now share one `<ImportDoneState>`: summary line, each `failed` row expanded into its actual reason, and an "Import another…" button that resets the flow in place. Known failures localize — `ImportFailure` grew optional `reasonKey`/`reasonArgs`, and the Anytype media row renders an ICU-pluralized explanation ("N referenced files were not included in the export — Anytype's JSON export usually leaves file binaries out…") with the literal reason kept as the fallback for dynamic engine failures.

### F-394 — my chapter tags survived the import but nothing will show them to me
- **session:** 904-anytype-import-wizard   **kind:** bug   **app:** Notes   **status:** ✅ done (2026-07-17)
- **what I was trying to do:** confirm "Stunde 8" still wears the Kapitel chapter tag I gave it in Anytype.
- **what happened:** the note itself came across beautifully — full bilingual body, headings, bold speaker names, even the original Aug/Sept 2025 created/updated dates. But no tag anywhere: not on the page, and the Properties panel says "No properties on this note yet." The import card told me relations come along, so where did my tags go?
- **what I expected:** the lesson's chapter tag visible on the imported note — on the page or at least as a row in its properties.
- **evidence:** tests/dogfood/.sessions/904-anytype-import-wizard/08-notes-stunde-8-panel.png (panel open, "No properties on this note yet")
- **triage / resolution (developer, 2026-07-17, shell PR #179):** stored-but-unsurfaced, exactly as suspected — the importer wrote relations only at the **top level** of the entity property bag, but the shared property panel reads per-note values from the def-keyed `properties.values` bag (`@brainstorm/sdk/property-ui` value-store), so `note.values` was `{}` and the panel honestly reported "no properties". The importer now mirrors user relations into `properties.values` keyed by the same `propertyKey` slug `deriveTypeSchemas` registers (values and defs always agree; top-level keys stay for Database columns/search), array relations derive multi-valued defs so tags render as tag lists, entity meta (`createdAt`/`updatedAt`/`icon`) no longer mints bogus defs, and registration never clobbers an established catalog def. Existing vault data isn't migrated — re-running the import (idempotent, F-395's new affordance) refreshes the same entities with the values bag.

### F-393 — my imported Anytype collection shows in the Database sidebar but clicking it never opens it
- **session:** 904-anytype-import-wizard   **kind:** bug   **app:** Database   **status:** ✅ done (2026-07-17)
- **what I was trying to do:** open "Stunden" — my old Anytype collection, now a List with a 41-member badge in the Database sidebar.
- **what happened:** the row highlights when I click it, but the main pane stays on Tasks; five seconds later, still Tasks. The console logged `pageerror: presence.publish: unknown entity` at the same moment, so *something* registered my click — the view just never came.
- **what I expected:** click a List → see its members, exactly like clicking Notes or Tasks does.
- **evidence:** tests/dogfood/.sessions/904-anytype-import-wizard/10-database-stunden-list.png + console.log ("presence.publish: unknown entity")
- **triage / resolution (developer, 2026-07-17, shell PR #179):** two independent root causes, not one. (1) The importer mints each Collection as a `List/v1` with `views: []`, and Database's `selectList` → `resolveListView` **silently no-ops on a view-less List** — row highlighted, pane never changed. Fixed in the consumer (any cross-app producer can mint a bare List): the app synthesizes a stable-id fallback Grid (`view_vault_listfallback_<listId>`, columns derived from the members) at every state-composition point; repro-first test round-trips the exact importer-minted collection through the codec. (2) The pageerror was a red herring tied to the click only by timing: the stage header published presence for the **active** list id, and vault-derived pseudo-lists (`list_vault_*`, e.g. the Tasks type-list on screen) aren't entities — the broker's type-resolution gate threw, surfacing as an unhandled-rejection pageerror. The header now publishes only entity-backed List ids, and the SDK presence transport swallows (warn-once) refused publishes — presence is display-only and can never crash the console again. The imported list id shape (`anytype-list-<stem>-<digest>`) is legal per `SAFE_ENTITY_ID_RE`; no importer id change needed.

### F-392 — gallery tiles still wear the card frame we already removed from the grid
- **session:** owner report (2026-07-17)   **kind:** bug   **app:** Files   **status:** ✅ done (2026-07-17)
- **what happened:** the always-on tile border/background that f9e55cb removed from Grid view survived in **Gallery** view (`body[data-view-mode="gallery"] .content-row` — elevated background + solid border on every tile at rest). Third recurrence of the rest-state frame class (after f9e55cb tiles and F-374 focus-ring container framing).
- **triage / resolution (developer, 2026-07-17, shell PR #171):** gallery tiles now match the grid stance — transparent background + transparent border track at rest, hover keeps the lift, selection tints the track; no layout shift. Audited the rest of Files (grid tiles, corner chips, overlays, badges, dividers — clean) and the shared `app-theme.css` ring rule (post-F-374 exclusions intact; no shared fix needed). **Durable guard:** `apps/files/src/styles-rest-frames.test.ts` parses every Files CSS file and fails when a rest-state rule on tile/row/container classes declares a non-transparent border/outline/box-shadow (reasoned allowlist for intentional frames; vacuousness check so selector renames can't disarm it; verified red/green). 325 files-app tests green.

### F-391 — my pinned tiles still say "Form Designer" and "Web Browser" after the rename
- **session:** 903-recent-ship-sweep   **kind:** bug   **app:** shell/dashboard   **status:** ✅ done (2026-07-17)
- **what I was trying to do:** walk the v0.4.6 release notes — the update said four apps got shorter names.
- **what happened:** the launcher grid shows the new names, but the icons I pinned weeks ago still carry the old labels ("Form Designer", "Theme Editor", "Web Browser", "Code Editor"). So the rename half-happened on my desktop.
- **what I expected:** a rename to reach every place the app's name shows, including pins I made before it.
- **evidence:** tests/dogfood/.sessions/903-recent-ship-sweep/01-dashboard-labels.png
- **triage (developer, 2026-07-17):** confirmed — app-kind dashboard icons persist a label snapshot at pin time and the pin resolver only live-resolved **entity** pins (its own doc claimed otherwise); the renderer fell back to the stored snapshot. Fix (shell PR #170): `resolvePins` now resolves `kind:"app"` icons through the registry's current manifest name on every read (an app the registry no longer knows keeps its stored label, same tombstone stance as entity pins), and the snapshot handler's entity-only gate includes app pins. 3 new resolver tests; 106 dashboard tests green. Session 903's other probes were clean: snap grid visible mid-drag, Journal inline toolbar horizontal (0.4.6 theme sync verified live), notification center opens. One harness note: the sweep's What's-New selector found no affordance — verify the real trigger's testid before reading that as a product gap.

### F-390 — Database list view paints the status/date chips on top of the row titles
- **session:** user report (2026-07-13)   **kind:** bug   **app:** Database   **status:** ✅ done (2026-07-13, shell PR #156)
- **what I was trying to do:** read the curated Tasks list's "Upcoming" (List-kind) view.
- **what happened:** on rows whose entities have no icon, the long titles ran the full row width and the status/priority/date chips painted ON TOP of the title text at what looked like random fixed columns; even empty date cells occupied a wide invisible band.
- **what I expected:** title left (ellipsized), chips packed right — never overlapping.
- **evidence:** user screenshot (2026-07-13); reproduced + verified by `tests/dogfood/sessions/900-dbv-list-probe.spec.ts` (computed-grid dump: before `133px 660px 0px`, after `0px 672px 122px`).
- **triage / resolution (2026-07-13, shell PR #156):** `.dbv-list__glyph:empty { display:none }` removed the iconless glyph from the row's **grid flow**, shifting every child one auto-placed track left — title into `auto` (can't shrink below the nowrap string), props strip into `1fr` (collapsed to ~0), so the right-packed chips overflowed leftward over the title. Fixed by pinning each child to its explicit `grid-column` (1/2/3); plus two amplifiers: the SDK date/link cells' panel-oriented `width:100%` inflated each strip cell to the full 28ch cap (now content-sized inside the strip), and the read-only strip painted the `title`/`name` column again as the first chip (now skipped, matching the editable strip).

### F-389 — the light/dark button switches my apps but the shell doesn't change until a beat later
- **session:** user report (2026-07-11)   **kind:** bug   **app:** Shell (dashboard)   **status:** ✅ done (2026-07-11)
- **what I was trying to do:** flip between light and dark with the sun/moon button in the dashboard header.
- **what happened:** the open apps re-themed instantly and the choice was saved, but the shell itself (dashboard background + chrome) didn't change immediately — it lagged behind the apps.
- **what I expected:** the shell flips at the same instant the apps do; light/dark is one action.
- **evidence:** user report; new live `ThemeProvider` mount test (`theme-provider.live.test.tsx`) reproduces the shell-lag path.
- **triage / resolution (2026-07-11, shell PR #137):** the dashboard resolved its theme only from the entity-pin-**enriched** `dashboard:snapshot`, which `await`s a registry/entities DB read on a pinned dashboard — while app windows get a **synchronous** `app:theme-changed` push, so the shell trailed the apps by that enrichment latency. Fixed by pushing the resolved theme name to the dashboard renderer on the same synchronous signal (`broadcastThemeToWindows` → new preload `dashboard.onTheme`); `ThemeProvider` applies it the instant it arrives (gated on an open vault so it never overrides the welcome Rose pin), and the snapshot re-applies idempotently. Closes the previously-untested click→repaint chain that let this silently regress. Rides the next patch bucket (0.3.2), cut **after** presence + the remaining small tasks.

### F-388 — Contacts still isn't a page like everything else, and its left panel is rough
- **session:** user report (2026-07-08)   **kind:** design   **app:** Contacts   **status:** ✅ done (2026-07-08)
- **what I was trying to do:** use Contacts like I use Tasks — open a person, see their properties at the top, write notes about them below.
- **what happened:** (a) the left panel had no inline padding — rows and group headers sat flush against the edges; (b) the search field had its own outline and overflowed past the panel border when focused; (c) the app opened with the right properties panel already covering the content, every launch; (d) the name field rendered as a boxed form input with an outline; (e) the detail was a static card — no editor surface, despite repeated asks that a contact be a *page* (properties at top like a task, editable rich-text body below).
- **what I expected:** the standard entity page every other app has: hero + inline shared property cells + the shared editor body; a sidebar that reads like Notes/Tasks; the inspector closed until I ask for it.
- **evidence:** user screenshots (2026-07-08); tests/dogfood/.sessions/228-deep-contacts/06-06-properties-open.png + .sessions/229-contacts-page-probe/* (after).
- **triage / resolution (2026-07-08, plan `9.23.6`):** shipped in one pass — detail rebuilt as the Tasks-style page (inline `personPropertyRows` block over the shared cells + `PersonBodyEditor` on the person's UniversalBody Y.Doc, legacy `bio` seeds the body and is cleared on first real edit); sidebar search replaced with the shared `<Searchbar>` (fixes outline + overflow) and the list scroller got its inline inset; right panel now rides `@brainstorm/sdk/panel-state` with a closed default; the hero name keeps the `.bs-input` face class for the control ratchet but is styled as an editor page title (no resting box). `plainTextToSerializedState`/`hasLegacyText`/`shouldClearLegacyText` extracted to `@brainstorm/editor` (Tasks' seed-body now delegates). The 228 deep spec's stale selectors are superseded by the new 229 probe.

### F-387 — the Journal widget clips the first letters of my entries ("Pipeline ready" shows as "peline ready")
- **session:** 375c-widgets-fixes-verify   **kind:** bug   **app:** journal (widget)   **status:** wontfix (vault data — F-299 residue)
- **what I was trying to do:** glance at my journal tile on the dashboard.
- **what happened:** every snippet row drops its leading characters — "Pipeline ready…" renders as "peline ready", the 30 Jun row as "ipeline ready". Different rows lose different amounts, so it reads like the preview starts at a random offset into the body.
- **what I expected:** snippets start at the first character of the entry body.
- **evidence:** tests/dogfood/.sessions/375c-widgets-fixes-verify/03-all-new-widgets-grid.png (Journal card, all three rows).
- **triage / resolution (2026-07-03):** not a widget bug — the widget renders faithfully. The same 375c capture shows the 29 Jun row intact ("Pipeline ready") while older rows clip by *varying* amounts; CSS clipping would be uniform. These entries are stored clipped in the Northbound vault — the F-299-era "first characters eaten at creation" residue already documented in F-320's triage (the graph node literally named "ote"). `previewBodyText` and the widget CSS both check out clean. Status: the vault data is the artifact; no code change. Wontfix (data), kept on record so the next reader doesn't re-chase it. *(Filed as F-385 in session 375c; renumbered — main's F-385/F-386 landed first.)*

### F-385 — selecting text in the chat composer pops a broken shard of a toolbar — two stacked letters in a clipped box
- **session:** user report (2026-07-03)   **kind:** bug   **app:** Chat   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** select "hello" in the chat composer to bold it.
- **what happened:** a tiny box appeared above the selection showing "B" with half of an "I" clipped under it — the formatting toolbar rendered as a vertical stack cut off after ~1.5 buttons.
- **what I expected:** the horizontal B/I/U/S/code/link pill that Notes shows on selection.
- **evidence:** user screenshot (composer with "hello" selected).
- **triage (developer, 2026-07-03, shell branch `chat-rich-composer`):** CSS cascade order, not a layout bug. The toolbar borrows the fancy-menus `.fm-menu` glass, and `.fm-menu` ships `flex-direction: column; overflow: hidden`. `editor-theme.css` pinned `row`/`visible` at equal specificity (0,1,0) — so whichever stylesheet the app's bundle emits LAST wins. Notes happened to order editor-theme after the runtime CSS; chat ordered it before, so `.fm-menu` won and stacked+clipped the buttons. Fix: compound selector `.fm-menu.notes__inline-toolbar` (0,2,0) — the same order-proof pattern the toolbar's own colour/overflow dropdowns already used. Real-shell verified via `tests/visual/specs/chat-rich-composer.spec.ts` (asserts computed `flex-direction: row`, `overflow: visible`, and a wide-not-tall pill).

### F-386 — I can't make a list in chat — no bullets, no numbers, no checkboxes, and `- ` just sits there as text
- **session:** user report (2026-07-03)   **kind:** gap   **app:** Chat (shared composer)   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** send a teammate a short checklist in a channel — the kind of message I'd write in Slack without thinking.
- **what happened:** the composer only does inline marks + links; typing `- `, `1. ` or `[] ` does nothing, and there's no list affordance anywhere.
- **what I expected:** Slack-level markup: bulleted / numbered / checkbox lists, quotes, code blocks, mentions inline in the text, links — the whole message vocabulary.
- **evidence:** user report (with the F-385 screenshot).
- **triage (developer, 2026-07-03, shell branch `chat-rich-composer`):** shipped as a `<CompactEditor>` upgrade so chat, comments and the Agent composer all get it: list/quote/code-block nodes + `ListPlugin`/`CheckListPlugin`, a curated Markdown shortcut set (`- ` `1. ` `[] ` `> ` ``` ``` ``, inline marks, links — deliberately no headings), typed-URL autolink, Enter still sends while Shift+Enter starts the next list item (Slack model), bullet/numbered/to-do toggles on the selection toolbar, checklist face + read-only rendering (`renderEditorState` now renders `check` lists with their checked state). Inline `@`-mentions already worked (F-377). Plan rung: implementation-plan §Chats dogfood slice; real-shell verified via `tests/visual/specs/chat-rich-composer.spec.ts`.

### F-379 — I shrank a widget and it teleported off my screen; after a restart it was just gone
- **session:** 375-widgets-dogfood   **kind:** bug   **app:** shell (dashboard widgets)   **status:** ✅ done (2026-07-17)
- **resolution (developer, 2026-07-17, shell PR #172):** two halves — the shrink-to-minimum ×10 re-migration was fixed in PR #92, but records already teleported stayed baked off-surface forever (probe geometry: cell 500 on an 800px screen). New pure `clampWidgetOrigin` + surface tracking in the widgets layer: display, gestures and writes all clamp, so stranded widgets self-heal on next render and an off-surface origin can never persist again. Repro-first regression on the exact baked geometry; 271 dashboard tests green.
- **what I was trying to do:** make the Task Stats tile as small as it goes, then grow it back.
- **what happened:** the moment the resize hit the minimum height, the card jumped from (32, 400) to ~(336, 4000) — 10× its position, parked ~3200px below the fold. After a restart it "vanished" (it's still there, at y=4016px on an 800px screen).
- **what I expected:** the card stays put; the minimum size is a supported state, not a trap.
- **evidence:** tests/dogfood/.sessions/375-widgets-dogfood-reboot/01-after-reboot.png (5 cards visible, 6 exist); 375b-widgets-probe notes.md — stored geometry left:336px top:4016px decodes to exactly (col 4→40, row 500=50×10).
- **triage:** `migrateWidgetRecord` (`packages/shell/src/renderer/dashboard/grid.ts:187`) classifies a record as pre-7.3b legacy when `w ≤ 6 OR h ≤ 6` cells and scales it ×10 — but `WIDGET_MIN_H` **is 6**, so a current-format widget resized to minimum height re-enters the migration and teleports; subsequent writes bake the ×10 x/y in. The "self-terminating" comment only holds for width (min 8 > 6). Fix: discriminate on width alone (`w > LEGACY_WIDGET_MAX_CELL` → current format), + regression test at the h=6 boundary. **Fixed in shell PR #92** (`fix/widget-min-resize-migration`).

### F-380 — after the shell reinstalled an app, its widget became a husk: slug title, initials icon, blank body
- **session:** 375-widgets-dogfood   **kind:** bug   **app:** shell (dashboard widgets)   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** just look at my dashboard.
- **what happened:** the Recent Notes widget titled itself the raw slug "recent-notes", the Notes glyph fell back to "NO" initials (in the add-widget catalog AND the desktop icon), and after a restart the widget body was a permanent placeholder — while five seconds later the add-widget catalog showed the same widget with its proper name and everything in the registry was healthy.
- **what I expected:** the widget shows its name, its app's icon, and its content — or heals itself once the app is back.
- **evidence:** tests/dogfood/.sessions/375-widgets-dogfood/04-arranged-grid-light.png (slug title), 02-add-widget-catalog.png ("NO" initials in catalog), 375-widgets-dogfood-reboot/01-after-reboot.png (placeholder body, 4 iframes for 6 cards); console: `http404: brainstorm://app-icon/io.brainstorm.notes` during boot; 375b probe: post-seed registry healthy (`hasIcon:true`, name "Recent Notes").
- **triage:** three one-shot reads race any app (re)install and never refresh: (1) widget titles — `widgets-layer.tsx:320` fetches `registeredWidgets()` once on mount (`[]` deps); (2) iframe entry — `widgets-layer.tsx:571` resolves once, `!entry → return` leaves a dead placeholder with no retry; (3) app icon — `app-icon-cache.ts` persists `hasIcon:false` to localStorage when `listInstalled()` lands mid-reinstall, and `AppIcon`'s `onError` latches. The dogfood harness reseeds every boot (Notes first, right in the dashboard-mount window) so Mira hits it every session — but any real app update/reinstall while the dashboard is open does the same. Fix shape: broadcast an `apps:changed` event from the installer (install/uninstall/refreshRegistrations) → preload subscription → widgets-layer re-fetches titles + un-resolved entries, icon cache re-lists. Needs its own iteration (main + preload + renderer + tests).
- **triage / resolution (2026-07-03, shell PR #94 `fix/widgets-lifecycle-ux`):** the installer now broadcasts a payload-free `apps:changed` to the dashboard from every chokepoint (install / update / uninstall / refreshRegistrations); the widgets layer re-fetches titles and re-resolves iframe entries on that edge (an update's new bundle sha live-reloads the iframe), and the icon cache re-lists. Regression tests: installer broadcast integration, jsdom layer test that mounts mid-reinstall and watches the slug title heal. Verified real-Electron in session 375c — the per-boot reseed no longer husks the Notes widget (title "Recent Notes", iframe mounts, real glyph in the catalog).

### F-381 — every widget's empty state is a dead end
- **session:** 375-widgets-dogfood   **kind:** design   **app:** contacts / calendar (widget surfaces)   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** glance at my dashboard: Contacts said "No contacts yet.", Today's Agenda and Week Ahead said "Nothing scheduled".
- **what happened:** true statements (the probe confirms the vault has zero `Person/v1` entities), but the tile just sits there — no "add a contact", no "schedule something", not even a hint that clicking ↗ opens the app. An empty glance tile is the one moment a widget should invite action.
- **what I expected:** a one-tap affordance in widget empty states (open-intent to the owning app's create flow — the bridge already allows the `open` verb).
- **evidence:** tests/dogfood/.sessions/375-widgets-dogfood/08-widget-today-agenda.png, 10-widget-list-contacts.png; 375b probe notes (entity-type histogram: no Person/v1 in 163 entities).
- **triage / resolution (2026-07-03, shell PR #96 `feat/widgets-round-2`):** shared `WidgetEmpty` in `@brainstorm/sdk/widget` (dim message + link-styled CTA dispatching an entityType-only `open` intent that routes to the app's registered opener). Retrofitted into all five existing widgets (both calendar tiles, both tasks tiles) and built into the six new ones. Verified in 375c: the empty Contacts tile shows "Add people" and clicking it launches the Contacts app.

### F-382 — the widget ⋯ menu has exactly one item
- **session:** 375-widgets-dogfood   **kind:** design   **app:** shell (dashboard widgets)   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** make Task Stats small without pixel-dragging the corner grip.
- **what happened:** ⋯ offers only "Remove widget". No size presets (small / medium / large exist in the manifest schema and the add-menu footprints), no "open app" (it's a separate hover-only glyph), nothing else. Meanwhile precise resizing means dragging an 8px corner grip.
- **what I expected:** at least Size → Small / Medium / Large, and Open <app>.
- **evidence:** tests/dogfood/.sessions/375-widgets-dogfood/15-widget-options-menu.png; notes.md `widget ⋯ menu items: ["Remove widget"]`.
- **triage / resolution (2026-07-03, shell PR #94):** ⋯ menu now carries Size → Small / Medium / Large (via `widgetFootprint`, current footprint checked) + Open app, Remove last. Verified in 375c (menu rows + Small snapping the card to 160×160).

### F-383 — I can't move or resize a widget without a mouse
- **session:** 375-widgets-dogfood   **kind:** gap   **app:** shell (dashboard widgets)   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** arrange widgets by keyboard (60 Tab presses, all reachable controls logged).
- **what happened:** Tab reaches open ↗ / collapse / ⋯ / the iframe — but the drag grip and resize grip are pointer-only. There is no keyboard path to move or resize a widget at all.
- **what I expected:** focusable grips with arrow-key move/resize (8px steps, Shift for coarse), like the icon grid's keyboard story.
- **evidence:** tests/dogfood/.sessions/375-widgets-dogfood/notes.md keyboard-reachability line.
- **triage / resolution (2026-07-03, shell PR #94):** both grips are focusable (`role=button`, accent focus ring; the hover-revealed resize grip reveals on focus) and nudge on the 8px grid with arrow keys, Shift = 4 cells, through the same optimistic-pending path as pointer gestures. Verified in 375c: grip focus + ArrowRight moved exactly 8px; resize grip + ArrowDown grew exactly 8px.

### F-384 — every widget downloads my whole vault to show 8 rows
- **session:** 375b-widgets-probe   **kind:** design   **app:** shell (widget bridge)   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** (developer-side observation while probing F-381.)
- **what happened:** `widget-bridge:list-entities` returns the full entity list the app can read — for apps holding `entities.read:*` that's the entire vault (163 entities today) — and each widget filters client-side to its handful of rows. Seven widgets × every `vault-entities-changed` signal re-pulls the whole list into each sandboxed iframe.
- **what I expected:** a typed/limited query (type filter + limit + sort) on the bridge, or at least fan-out coalescing; this is also the natural place the future parameterised `bind` lands.
- **evidence:** tests/dogfood/.sessions/375b-widgets-probe/notes.md (identical 163-entity histograms via the contacts and database app grants).
- **triage / resolution (2026-07-03, shell PRs #94 + #96):** `vaultEntities.list()` accepts `{types, limit}` threaded shim → parent proxy → preload → handler; validation/filtering is pure (`ipc/widget-list-query.ts`). Every widget now passes its typed query (module-level const) so no widget ships the whole vault. Bonus: a scoped-read app (Books) is admitted through a typed query covering its grants — the old handler flatly demanded `entities.read:*`. Verified in 375c (Books widget renders, not capability-denied).

### F-378 — apps remember my right panel across windows — every new window opens with the inspector already on
- **session:** user report (razor, 2026-07-03)   **kind:** design   **app:** notes, journal, tasks, books, preview, code-editor   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** open an app window fresh and look at an object.
- **what happened:** because I'd toggled the properties/inspector panel open in some earlier window, every later window of that app opens with the right panel already on — the open state is saved in `localStorage`, so it outlives the window that set it.
- **what I expected:** the panel keeps its state while I switch objects inside one window, but a new app window always starts with the right panel closed (the app default).
- **evidence:** user report; `localStorage` writes at notes `PROPS_PREF_KEY`, journal `PROPS_OPEN_PREF_KEY`, tasks `PROPS_OPEN_KEY`, books/preview `INSPECTOR_PREF_KEY`, code-editor `REFS_OPEN_KEY`.
- **triage / resolution (2026-07-03, shell PR #90 `fix/right-panel-session-scope`):** new SDK helper `@brainstorm/sdk/panel-state` (`readPanelOpen`/`writePanelOpen`, backed by `sessionStorage` — window-scoped, survives reloads within a window, resets per new window). All six apps' right-panel open prefs routed through it; left nav sidebars stay in `localStorage` (durable device pref, intended). Books keeps its deliberate open-by-default inspector. SDK unit tests + 192 affected suites green.

### F-377 — @-mentioning someone dumps a chip above the composer and a boxed "attachment" under the message — not an inline mention like Slack
- **session:** 377-inline-mentions (user report, 2026-07-03)   **kind:** design   **app:** Chat + Agent   **status:** ✅ done (2026-07-03)
- **what I was trying to do:** mention a teammate in a chat message, the way I would in Slack.
- **what happened:** picking the person from the `@` typeahead removed my `@…` text and stuck a chip in a rail ABOVE the message form; after sending, the message carried a boxed chip with a cube icon under the text. The mention never appeared *in* the text. The Agent composer behaved the same way.
- **what I expected:** the mention renders inline in the draft as I type (editable around it) and inline in the sent message — identical in Chat and Agent.
- **evidence:** user screenshot (chat transcript with `Razor` box chip); fix evidence `tests/dogfood/.sessions/377-inline-mentions/02-inline-chip-in-composer.png`, `03-sent-message-inline-mention.png`, `05-agent-inline-chip.png`
- **triage (developer, 2026-07-03):** the composer plugin deliberately excised the `@token` and routed the person into the composer-context rail (`candidateToAttachment`), so the mention only existed as a `MessageAttachment` chip. Fix (shell PR #74 `65bdf2a`): `MentionComposerPlugin` gained an `insertNode` commit mode planting a real inline `MentionNode`; `renderEditorState` renders `mention` nodes as chips (was the `⟦mention⟧` fallback); the send path lifts inline mentions into wire attachments (`withMentionAttachments`) so the mention-notifier + agent grounding still work, and `visibleAttachments` hides the redundant chip (legacy messages keep theirs). The Agent's `<textarea>` composer was migrated onto the same CompactEditor+mention surface (user turns persist + render `richBody`). Real-shell verified: inline chip in both composers, zero rail/attachment chips.

### F-376 — user avatars in chat draw as a square photo floating inside a circle
- **session:** 377-inline-mentions (user report, 2026-07-03)   **kind:** design   **app:** Chat   **status:** ✅ done (2026-07-03)
- **what happened:** my profile photo rendered as a small rounded SQUARE centred inside a larger grey circle with a ring — instead of the photo filling the circle.
- **what I expected:** the photo fills the circular avatar, clipped round, like every other chat product.
- **evidence:** user screenshot (message gutter avatars).
- **triage (developer, 2026-07-03):** the SDK image icon hard-codes a 4px corner radius and chat rendered it at 28px inside a 34px bordered circle — a square in a ring. Fix (same PR #74): `Avatar` sizes image icons to the full host diameter so the host's `radius-full + overflow:hidden` clips them round; glyph (emoji/pack) avatars stay centred at ~0.8× so they don't crop; the members-panel avatar now sizes to its 26px row (the component previously hard-coded 28px inside it).


### F-321 — Automations greets me with "No device hosts automations yet — claim it" — I don't know what a device host is
- **session:** 012-all-apps-smoke (2026-07-01 re-run)   **kind:** design   **app:** automations   **status:** ✅ done (2026-07-02)
- **what I was trying to do:** open Automations to set up a reminder.
- **what happened:** the first thing in the app is an info banner in infra jargon — "No device hosts automations yet — claim it to run schedules here." with a "Claim" button. I had to reverse-engineer that it means "schedules run on one of your devices; make it this one."
- **what I expected:** plain-language copy, e.g. "Schedules need one of your devices to run on. Use this device" — or just claim automatically on first workflow save and say so.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/14-app-automations.png
- **triage / resolution (2026-07-02, branch `fix/dogfood-visual-audit`):** the whole `host.*` copy family in `apps/automations/src/i18n.ts` spoke scheduler jargon. Rewritten in plain device language: banner → "Schedules need one of your devices to run on.", button → "Use this device", plus takeover/status/failure variants. 4 exact-copy test assertions updated + a button-label assertion added; 153 automations tests green.

### F-320 — Graph nodes are labelled "ent_mr15" and "ote"
- **session:** 012-all-apps-smoke (2026-07-01 re-run)   **kind:** design   **app:** graph   **status:** ✅ done (2026-07-02)
- **what I was trying to do:** look at my vault's graph.
- **what happened:** several visible node labels are raw id fragments ("ent_mr15" on ~7 nodes) and one is "ote" — a clipped "Note". Whatever these entities are, the graph shows me internals, not names.
- **what I expected:** a human title on every node (derived title or type name + ordinal for untitled), and labels that truncate with an ellipsis, never by dropping leading characters.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/06-app-graph.png
- **triage / resolution (2026-07-02, branch `fix/dogfood-visual-audit`):** two distinct verdicts. **(a) "ent_mr15" fixed** — `rawNodeLabel` fell back to `entity.id.slice(0, 8)`, and since ids are `ent_` + base36 timestamp, *every* title-less entity minted the same ~17h window collapses to the identical fragment — the 7 labels were 7 distinct title-less entities. Fallback is now a human caption `t("node.untitled")` = "{Type} (untitled)" via new shared `typeDisplayName()` (`@brainstorm/sdk/system-entities`); also killed the last raw-id paint in the LocalBadge ("(missing entity)"). This overturns session-336's "as-is" ruling. **(b) "ote" is not a clip** — pixel-measured: the label is centred exactly on its node, no ellipsis, and appears identically in session 340 on an older build; the vault genuinely contains an entity *named* "ote" (F-299-era first-chars-eaten residue). No leading-clip code path exists (both label layers truncate end-only); a regression test now pins the end-only invariant. Graph 463 + SDK 2390 tests green.

### F-319 — the Agent's answers show raw markdown (`###`, `**`) and raw node ids in the transcript
- **session:** 012-all-apps-smoke (2026-07-01 re-run)   **kind:** bug   **app:** agent   **status:** ✅ done (2026-07-02)
- **what I was trying to do:** re-read an agent conversation about my Q3 plan.
- **what happened:** the stored transcript renders the reply as literal `### Summary of Northbound Q3 Plan`, `**Documents:**` — and cites documents as `[n_mqz1aegg_2qmlcl] Northbound Q3 plan 32834`, a raw node id in my face.
- **what I expected:** formatted markdown and entity references rendered as clickable titles — i.e. what F-312 says was fixed. Either the fix doesn't cover historical/stored messages in the transcript view, or it regressed.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/12-app-agent.png
- **triage / resolution (2026-07-02, branch `fix/dogfood-visual-audit`):** split verdict. **Raw `###`/`**` markdown: not a bug on main** — F-312's fix (shell PR #60) renders stored and new assistant messages identically through the shared `<Markdown>`; a repro test with a persisted message passed unmodified on HEAD. The screenshot came from a build of `feat/sdk-control-face-primitive`, which forked *before* PR #60 merged — stale-bundle artifact, the documented CLAUDE.md trap. A pinning test now guards it anyway. **Raw `[n_…]` node ids: real display-time bug, fixed** — the retrieval context feeds the model `- [<id>] <title>` lines (`buildRetrievalContextBlock`), small models echo that format verbatim, and the renderer only resolved `[label](id)` links, so bracket-ids printed literally. New pure `linkifyEntityRefs()` (`apps/agent/src/logic/transcript.ts`) rewrites `[<id>] Title` → `[Title](<id>)` at display time (stored body + AI wire transcript stay canonical); bare `[<id>]` keeps id-as-label like `citationsToLinks`. Fail-first tests; 169 agent tests green. Residue noted for the SDK parser: nested list structure under an ordered item still flattens (deliberate parser scope, not agent).

### F-318 — the Files vault browser is a wall of "(untitled) Message" rows
- **session:** 012-all-apps-smoke (2026-07-01 re-run)   **kind:** design   **app:** files   **status:** ✅ done (2026-07-02)
- **what I was trying to do:** browse my vault in Files.
- **what happened:** the first full screen of "Vault" is ~20 identical "(untitled) · Message · Today" rows — chat messages surfaced as top-level untitled items, burying my real documents. Database's "All vault items" (153) has the same pollution (36 Messages).
- **what I expected:** child/derived entities (chat messages, similar plumbing types) either excluded from the universal browsers by default or given derived titles (first line of the message) — and never sorted above my named documents.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/08-app-files.png
- **triage / resolution (2026-07-02, branch `fix/dogfood-visual-audit`):** root cause — the intents bus synthesizes a generic fallback viewer for *every* typed entity, so Files' "browsable when an opener resolves" test over-includes, and `brainstorm/Message/v1` matched no internal-type suffix. No existing flag fit (SYSTEM is presentation-only and excludes deliberate creations), so the same shared chokepoint gained a **new classification**: `ChildEntityType` / `isChildEntityType` (`@brainstorm/sdk/system-entities`) — parent-scoped child content (Message, Comment) that default top-level browse listings may exclude. Files' `browsableTypeSet` consumes it; Database's "All vault items" (separate code path) consumes the same flag, and its auto-minted "Messages"/"Comments" type-lists now group under the collapsed System disclosure (still browsable by deliberate drill-in). Search untouched. Repro-first tests both sides (messages excluded; untitled Notes still listed); files+database+sdk 3487 tests green. Catalog doc updated.

### F-317 — Preview's empty state sits far left of centre, and the Details panel opens on the LEFT over blurred content
- **session:** 012-all-apps-smoke (2026-07-01 re-run)   **kind:** bug   **app:** preview   **status:** ✅ done (2026-07-02)
- **what I was trying to do:** open Preview, then toggle the right panel.
- **what happened:** (a) the "Nothing to preview" empty state is centred on x≈200 of an 1100px window — it hugs the left edge; (b) the right-panel toggle opens a floating "Details" card pinned to the LEFT side, overlapping and blurring the empty state under it. Every other app docks the inspector on the right.
- **what I expected:** empty state centred in the pane; Details as a right-docked panel like the rest of the fleet.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/14-app-preview.png, 19-app-preview.png
- **triage / resolution (2026-07-02, branch `fix/dogfood-visual-audit`):** ONE root cause, both symptoms. `.preview` is `grid-template-columns: auto minmax(0,1fr)` and the collapsed sidebar is `display:none` — a none'd grid item generates no box, so `.preview__main` auto-placed into the `auto` column and shrink-wrapped to ~398px. The empty state centred in that 398px stage (symptom a), and the inspector — which is the standard fleet right-edge glass overlay, `position:absolute; inset-inline-end:0`, same as Files/Database — anchored to the shrunk container's right edge at x≈398 (symptom b; the "blur" is the normal `.glass--strong` surface). Fix: one declaration, `grid-column: 2` on `.preview__main`. Reproduced and re-verified in real Chromium at 1100px (before: main 0–358; after: main flush 0–1100 collapsed / 260–1100 open, inspector docked 780–1100). 3 layout-contract tests added (red-checked); 297 preview tests green.

### F-316 — multi-day calendar events render as per-day pills with the title clipped mid-word ("ipeline ready", "peline ready")
- **session:** 012-all-apps-smoke (2026-07-01 re-run)   **kind:** bug   **app:** calendar   **status:** ✅ done (2026-07-02)
- **what I was trying to do:** glance at July in Month view.
- **what happened:** one "Pipeline ready" event spanning many days renders a pill in every day cell, each showing the title clipped by a character offset — "ipeline ready", "peline ready" — and the first cell shows it doubled ("Pipeline readyPipe…"). Fifteen day cells of near-identical broken pills.
- **what I expected:** a single continuous spanning bar with the title drawn once (or per-week), leading characters never clipped.
- **evidence:** tests/dogfood/.sessions/012-all-apps-smoke/04-app-calendar.png
- **triage / resolution (2026-07-02, branch `fix/dogfood-visual-audit`):** the visual is **vault-data residue, not a render bug** — the pills are ~12 distinct per-day journal entries whose *stored bodies* are "ipeline ready"/"peline ready"/doubled "Pipeline ready Pipeline ready": they were typed by session 362 walking days forward while F-299 (journal eats the first word's leading chars) was still live. The writer fix already landed, so the data can't regrow; the mangled titles live only in `tests/dogfood/.data` (vault-hygiene rule says don't hand-edit — they age out as the calendar moves on). Multi-day events already render as one ribbon per week row, titled once per segment, end-ellipsized. **However the investigation found a real bug in exactly this machinery, fixed:** `month-view.tsx` paired day cells to compiled events via a render-order counter (`cellCounter`) that desyncs whenever the child grid re-renders without the parent (React StrictMode double-render → dev builds painted the whole month with ZERO events; reproduced red first). `MonthGridReactCell` now carries a stable row-major `index` and the pairing uses it. Calendar+SDK 326 and journal 190 tests green.

### F-315 — the Conversation settings dialog looks off — default-looking controls + bad paddings
- **source:** user (real-shell dogfood, Agent → Conversation settings)   **kind:** design   **app:** agent   **status:** ✅ done (2026-07-01)
- **what I was trying to do:** open the Agent's per-conversation settings.
- **what happened:** the controls read as unstyled/"system default" and the paddings were off.
- **what I expected:** controls on our shared faces, consistent padding.
- **triage / resolution (2026-07-01):** audited every control in the app. There are **no native `<select>`s** — the provider picker already uses the shared `<SelectMenu>` (`.bs-select`, self-imported CSS). The "default-looking" control was the **hand-rolled budget `<input>`** (`.agent-settings__budget-input`: its own height/border, and **12px** horizontal padding vs the select's 8px — the "bad padding", the two controls' text started at different insets). Fix = the DS-input migration (DS-input-2): budget input → `.bs-input` (now 8px padding, shared height/border/focus, aligns with the select); the memory-popover inline rename `<input>` → `.bs-input--sm` (kept its `flex:1` row-fill delta only); both bespoke input CSS blocks deleted. Removed both files from `tools/control-faces-baseline.json` (29→27). The composer `<textarea>` stays hand-rolled (distinct primary surface). Agent typecheck + biome + css-tokens + control-face ratchet clean; agent build + 82 agent tests green.

### F-314 — editing a status/select cell drops me into a plain text field, no value picker
- **source:** user (real-shell dogfood, Database grid)   **kind:** design   **app:** database   **status:** ✅ done (2026-07-01)
- **what I was trying to do:** edit a status/select-style cell in the grid.
- **what happened:** the cell became a bare free-text input — I had to retype the value with no list of the options already in use.
- **what I expected:** a value picker — type to filter **and** select from the values already in that column (a combobox), the way a status field should work.
- **triage / resolution (DS-cell-combobox-1, 2026-07-01):** the picker (`TagCell`) only fires for columns whose effective `PropertyDef` carries a `vocabulary` (catalog-backed); inferred columns resolved to a `Pill`/plain-text editor (`effective-def.ts` deliberately never attaches a vocabulary). A real feature, not a CSS tweak. Shipped: (1) optional `suggestions?: readonly string[]` on the shared `CellProps` (additive — existing cells unaffected); (2) `columnValueSuggestions` (database `logic/`) gathers a column's distinct existing values, **self-gating to enumerable columns** (short values · few distinct · they repeat) so prose / identifier columns stay plain text; (3) the grid memoizes per-column suggestions and threads them through `EditableCell` → the cell; (4) the formatted text cell, when given suggestions, edits as a **type-or-pick combobox** via the shared `openSearchPicker` (`@brainstorm/sdk/menus`) — filter the existing values, or commit a new one through a synthetic "use «typed»" row (free text preserved). Falls back to the inline input when no menu host is mounted. +tests: `comboboxRows` (filter + synthetic-row), `columnValueSuggestions` (the enumerable heuristic). Typecheck (packages+apps) + biome + reactivity ratchet clean; 752 database + 203 SDK property-ui tests green. Plan rung **DS-cell-combobox-1** added to implementation-plan.

### F-313 — Database grid + Properties popover polish (hovers, padding, ellipsis, checkbox, action rows)
- **source:** user (real-shell dogfood, Database)   **kind:** design   **app:** database   **status:** ✅ done (2026-07-01)
- **what happened (five nits, one screenshot each):** (1) row + sidebar **hovers didn't follow the accent scheme** (neutral grey) and the cell under the cursor **overlaid a second hover tint** on the row, reading as a darker patch; (2) the grid carried **redundant inline padding** — table padding-inline *and* the row grip gutter *and* the cell padding stacked, pushing the first column 16px past the stage-header baseline; (3) long **text-cell values weren't ellipsized** — they hard-clipped; (4) the Properties popover **checkboxes were a bespoke red box**, not our shared checkbox; (5) the popover's **"Add column / rollup / formula" rows** were bare text, uneven height, with no separation from the list.
- **triage / resolution (2026-07-01):**
  - **Hover overlay:** `--hover` is translucent, so the editable cell button's own `:hover` painted a *second* `--hover` over the row's. Dropped the in-grid cell-button hover (the row hover is the affordance + the button fills the whole cell).
  - **Hover scheme:** overrode `--hover` on the app `body` to a faint accent tint (`color-mix(--accent 7%)`, fainter than the ~12% accent-subtle SELECTED fill, derived from the injected `--accent` so it themes) — every `var(--hover)` site (rows, sidebar, popover/menu) now reads on-scheme from one place.
  - **Padding:** removed `.dbv-grid__table` `padding-inline`; the row grip gutter (12px) + cell padding (8px) now sum to the 20px stage-header baseline, and rows go full-bleed.
  - **Ellipsis:** the stretched value button (`flex:1`) lacked `min-width:0`, so it kept `min-width:auto` (= content width) and never shrank; added `min-width:0` (+ ellipsis on the editable title label).
  - **Checkbox:** Properties visibility toggle now uses the shared `createCheckbox` (`@brainstorm/sdk/checkbox`); deleted the bespoke `.db-popover__column-toggle` paint CSS.
  - **Action rows:** `buildPopoverAction` helper — leading Plus glyph + label on a 28px menu-row face, below a new `.db-popover__divider`. All three add-* rows go through it.
  - **checks:** biome + css-tokens + database typecheck clean; 746 database tests green.

### F-312 — the Agent's replies show raw markdown (`###`, `**bold**`, lists) as literal text
- **source:** user (real-shell dogfood, session 372)   **kind:** bug   **app:** agent   **status:** ✅ done (2026-06-30)
- **what happened:** the model answers in markdown (headings, bold, bullet/numbered lists, inline code), but the Agent rendered the message body as raw text — so `### Summary`, `1. **Documents:**`, `- **Goals:**` all showed literally instead of as formatted blocks.
- **what I expected:** the reply renders as formatted prose — headings, bold, real bullet lists.
- **evidence:** tests/dogfood/.sessions/372-agent-dynamic-context-qwen/04-reply-northbound-plan.png (before: literal `###`/`**`).
- **triage / resolution (DS-markdown-1, 2026-06-30):** there was no shared markdown→React renderer; the only markdown-to-view logic was Preview's DOM-based `markdown-to-dom.ts` (copy one). Per the SDK "extract at copy two" rule, promoted the **pure block parser** to a new **`@brainstorm/sdk/markdown`** (canonical home) and added a small XSS-safe **`<Markdown>` React renderer** + `@brainstorm/sdk/markdown.css` (`.bs-markdown` prose). Preview now imports the shared parser (DOM builder unchanged); the Agent renders assistant bodies via `<Markdown>` (user turns stay plain) with an entity-link resolver so `[label](id)` citations open via the cap-checked `open` intent. +SDK markdown tests (parser, React render, link-safety, XSS); preview tests green via re-export; typecheck (packages+apps) + biome + css-token clean. Re-dogfooded (372): headings/bold/lists now render as blocks.

### F-311 — the Agent invents company data (fake clients) instead of reading my vault
- **source:** user + real-shell dogfood (session 372, local Qwen)   **kind:** bug   **app:** agent + shell search   **status:** ✅ done (2026-06-30)
- **what I was trying to do:** ask the Agent about my own workspace — what's in my vault, and questions about my actual notes/contacts — backed by a local model (qwen2.5:7b via Ollama).
- **what happened:** the Agent knew the *shape* of the vault (it recited the real type counts and the installed-app list correctly) but never the *content*. Asked "what is my business / who are my clients", it confidently answered **"ACME Tech Solutions"** and **"Global Innovations Inc."** and claimed *"these names are derived from the contacts in your vault"* — pure fabrication. Capturing the exact prompt sent to the model (via a logging proxy) showed **zero retrieved content** in any turn: the `## Your vault` tally + app catalog were present, but the retrieval block was always empty.
- **what I expected:** the Agent grounds answers in my real notes/contacts, and when it doesn't have something it says so instead of inventing it.
- **evidence:** tests/dogfood/.sessions/372-agent-dynamic-context-qwen/04-reply-business-summary.png (fabricated clients) + the captured per-turn prompts (no retrieval block).
- **triage / root cause:** two independent defects. (1) **Search NL bug** — the Agent feeds the *whole user turn* into `search.hybrid`, but `buildMatchExpression` ANDed **every** token (stopwords included), so a full sentence (`"what" AND "is" AND … AND "clients"*`) matched no document; with the semantic half gated off, hybrid degraded to lexical → 0 hits → ungrounded chat. The FTS index itself was fine (119 docs; a keyword probe returned hits). (2) **Retrieval self-pollution** — the just-asked question is persisted + indexed as a `Message/v1`, so once the AND query *did* match, it matched the conversation's own echo and outranked every real note (and the OR fallback never fired). Plus the model happily fabricated when ungrounded.
- **resolution (Agent-grounding, 2026-06-30):** shell branch `feat/agent-vault-grounding`. (a) **`buildMatchExpression` NL fallback** (`search/search-indexer.ts`): the precise AND stays the primary path (launcher unchanged); on an empty AND match it retries as an **OR over content words** (small stopword set dropped), bm25-ranked — natural-language queries now return relevant hits. (b) **`excludeTypes`** added through the search stack (`SearchQuery` → indexer → service) so the Agent excludes its own Conversation/Message/Memory from retrieval and grounds on the user's content, not its transcript. (c) **Anti-fabrication guard** — a shared grounding clause appended to both agent system prompts: answer only from provided context, say "not in your vault" rather than invent. +tests (search-indexer NL/exclude, grounding-prompt). Re-dogfooded with Qwen (session 372): retrieval now injects real vault objects.

### F-310 — the drag/reorder grip sticks to the row content in every list & table
- **source:** user (real-shell dogfood)   **kind:** design   **app:** database + files (shared)   **status:** ✅ done (2026-06-30)
- **what happened:** the hover-revealed reorder drag-handle (six-dot grip) crowds the row — it's pinned over the first cell with no gap, so it touches / overlaps the leading status glyph + title in the Database grid (and the icon/name in the Files list).
- **what I expected:** the grip sits in a gutter to the LEFT of the content with breathing room, like every other product's row handle — it never overlaps what it's a handle for.
- **evidence:** user screenshot (Database grid row, grip flush against the status circle + title). Repro + fix captured in dogfood session **372**.
- **triage:** _root cause is the same class as F-304: the grip element + its spacing CSS were **re-implemented per surface** (`.dbv-grid__drag-grip` / `.content-row__drag-grip` — identical copy-pasted blocks), both `position:absolute; left:0` over the first cell with no reserved gutter, so the 16px grip overlapped content that starts at only ~8px of cell padding. No single place owned "the grip clears the content."_
- **resolution (DS-grip-1, 2026-06-30):** shell branch `feat/sdk-control-face-primitive`. Extracted a shared **`.bs-drag-grip`** face into `@brainstorm/sdk/app-theme.css` (box / grab cursor / hidden→revealed transition / absolute pin), and migrated both surfaces onto it — each now reserves a real leading gutter so the grip parks **clear** of the first cell (the scroll containers clip overflow-x, so the gutter is reserved *inside* the row, not floated into negative space). Measured **4px gap** grip→content on both, no clipping; head/body/foot share `.dbv-grid__row` so the grid columns stay aligned. Plan rung **DS-grip-1**; catalog updated. typecheck (apps) + database/files build + css-token/control-face/biome clean.

## User-reported while dogfooding the real shell (2026-06-30)

Two issues hit directly in the running app (screenshots in the chat), fixed the
same turn.

### F-308 — PDF preview opens clipped / doesn't fit or respond to the pane
- **source:** user (real-shell dogfood)   **kind:** bug   **app:** preview   **status:** ✅ done (2026-06-30)
- **what happened:** opening a wide slide deck (`brainstorm-deck.pdf`) in Preview rendered the page at 100% — wider than the pane — so the left edge ("A desktop OS for…") was cut off, and resizing the window didn't reflow.
- **what I expected:** the page fits the pane on open and re-fits as the pane resizes.
- **evidence:** user screenshot (Preview, brainstorm-deck.pdf, "A desktop OS" clipped at left).
- **resolution:** shell branch `fix/preview-pdf-fit`. The viewer initialised `zoom=1` but only applied fit-to-width when `zoom<=0` (an "unset" sentinel that never triggered). Replaced with a `userZoomed` flag: fit-to-page on load AND on every resize until the user picks an explicit zoom; the Fit control returns to responsive. `fitScale` already caps at 100% (no upscaling). typecheck + 55 preview tests green.

### F-309 — Database inspector properties look unpolished + show a Collections block
- **source:** user (real-shell dogfood)   **kind:** design   **app:** database (+ shared inspector)   **status:** ✅ done (2026-06-30)
- **what happened:** the entity inspector read as an airy form, mixed a "COLLECTIONS" membership block into the Properties tab, and (for a file-backed DesignDoc) the fields weren't editable.
- **what I expected:** a dense, polished property sheet consistent across apps, no collections block, with vault properties editable (file-derived fields may stay read-only).
- **evidence:** user screenshot (inspector for "70 — Encrypted attachment…" with Path/Slug/Category + COLLECTIONS).
- **resolution:** shell branch `fix/inspector-consistency`. Tightened the **shared** `.bs-props` row padding (space-2 → space-1 vertical), so every app's inspector reads as a dense property sheet — this lands in one place since all apps render through the shared panel.
- **correction (2026-06-30):** an earlier draft of this branch ALSO dropped the database's COLLECTIONS block — that was a **misread of "do not show collections properties" and is reverted.** Collections are load-bearing: a `PropertySchema` with `scope.kind = "list"` is *resolved against List membership* (per [docs/apps/database/01-data-model.md](../apps/database/01-data-model.md)) — i.e. adding an object to a collection (e.g. a book → Horror / Fantasy) makes that collection's properties "light up" on the object, editable, and they're preserved (not surfaced) when it leaves. So the Database inspector's Collections block is the **reference** behaviour. The real complaint, re-read: **other apps' inspectors do NOT surface those list-scoped (collection-inherited) properties and aren't editable, unlike the database** — "the logic should be consistent with databases." Session 371's "0 collections" assertion is void (superseded by the revert). **Forward work:** bring collection-inherited properties + editing to the non-database app inspectors so all apps match the database. Still open.

## Session 368 — Marcus: cross-app design-system audit (2026-06-30)

Mira had been collecting visual snags (paddings, off-system controls, layouts
that don't hold), so Marcus did a **measured** sweep across 12 apps + the shell:
header baselines, input-vs-button control heights, inspector padding, empty/detail
layouts. Method: crop the chrome, measure the contracts, file specific offenders.

**What holds (praise, earned):** the **44px app-header baseline is exact on all
12 apps** (off-by 0.0 everywhere). **Settings → AI** and **Bookmarks** are clean,
on-system, well-spaced. **Tasks** and the **dashboard** read well.

**What doesn't** — four findings below (F-304 the systemic one).

### F-304 — text inputs and buttons don't share a control height (whole fleet)
- **session:** 368-marcus-design-system-audit   **kind:** design   **app:** fleet (notes/tasks/books/whiteboard/files + others)   **status:** ✅ done (2026-07-17) — Files + Contacts-compose + Whiteboard ✅ (baseline 29→25, 2026-06-30), fleet ladder open
- **resolution (completion, 2026-07-17, shell PR #175):** ladder closed. Baseline had already shrunk to 9 via merged slices; the final 7 migrated — shell-renderer panels (help search, AI panel, billing, browser-privacy, MCP, notification times, welcome) onto the ratchet-exempt `ui/` `<TextField>`/`<TextArea>` primitives (the shell never loads app-theme.css, so `.bs-input` was never the right face there), dead face CSS deleted, small additive primitive extensions (time type, Lg size, error chrome). **Baseline 9 → 2**, both reasoned exceptions recorded in the baseline file (mailbox compose surface; data-section borderless inline editors). All gates green (279 tests, both typechecks, all four tool checks).
- **what I was trying to do:** check that a text field sitting next to a button lines up — the thing that's been bugging Mira.
- **what happened:** measured the first input vs the first button in each surface — they almost never match. **Books** input=22px next to a 32px button (10px off). **Notes / Tasks / Whiteboard** input=22 vs button=26. **Files** has *three* heights in one toolbar row: input=23, select=24, button=26. Inputs render ~22px (an ad-hoc field) while `.bs-btn` is 26–32px, so any input-beside-button row steps.
- **what I expected:** one control height. A field, a select, and a button on the same row are the same height — that's what the new `.bs-input` primitive is for.
- **evidence:** notes.md control-height lines; tests/dogfood/.sessions/368-marcus-design-system-audit/14-files-01-full.png (search input vs "List" / "Sort by" controls), 24-books-01-full.png.
- **triage:** _root cause is the design system isn't ENFORCED — `.bs-input` (DS-input-1) landed but only Calendar migrated; the rest still use bare inputs. The `check-control-faces.mjs` shrinking-baseline ratchet already exists; the fix is to migrate apps onto `.bs-input` and shrink the baseline._
- **resolution (Files slice, 2026-06-30):** shell branch `fix/f304-files-control-faces` (313ff75). Files migrated: toolbar search wrapper → `.bs-input--sm` (field now 24px, pixel-exact with the sort/view controls — the 3-heights-in-one-row offender), bulk-rename + smart-folder dialogs → `.bs-input` (md), inline row rename → `.bs-input--sm` + accent-border delta; per-app box CSS deleted. Baseline 29 → 27 (dropped dialogs.tsx + content-list.tsx). Verified by dogfood session **369** (search field / `.bs-input` / toolbar button all 24px)._
- **resolution (round 2, 2026-06-30):** shell branch `polish/r2-books-contacts-whiteboard` (8099fb9, stacked on the Files branch). **Contacts** compose field → `.bs-input` (md; input now == the dialog button at 32px) and **Whiteboard** board-name rename → `.bs-input--sm` (24px); per-app box CSS deleted, both files dropped from the baseline (**27 → 25**). Verified by dogfood session **370**. **Remaining: 25 baselined files across ~15 apps** (agent, automations, browser, chat, contacts[detail/list], database, form-designer, graph, journal, mailbox, notes, preview, theme-editor) — same mechanical migration, ratchet-gated; a few carry legitimate exceptions (borderless title inputs, composite search wrappers) that stay baselined by design. Continue per prioritization._

### F-305 — Books shows two empty states at once
- **session:** 368-marcus-design-system-audit   **kind:** design   **app:** books   **status:** ✅ done (2026-06-30)
- **what happened:** on an empty library the **sidebar** shows a "No books yet / Import a PDF or EPUB…" block with a full-width primary **"Import a book"** button, and at the same time the **center** shows a separate shared hero "Nothing to read yet / Import a book from the library to start reading" — with *no* action. Two empty states, two messages, and the CTA is split off from the prominent surface.
- **what I expected:** one empty state. The prominent center hero carries the single primary action; the sidebar doesn't duplicate it.
- **evidence:** tests/dogfood/.sessions/368-marcus-design-system-audit/24-books-01-full.png
- **triage:** _design — collapse to one empty state (hero owns the CTA), or suppress the center hero while the library panel's empty block is showing._
- **resolution (2026-06-30):** shell branch `polish/r2-books-contacts-whiteboard` (8099fb9). The prominent reader-pane hero now carries the single "Import a book" CTA (new `ReaderNotice` `onImport` prop); the sidebar empty block is a quiet "No books yet" note with its redundant primary button removed (Import also stays in the header menu). Verified by dogfood session **370** (1 hero CTA, 0 sidebar CTA; screenshot `01-books-empty-full.png`)._

### F-306 — Automations & Mailbox headers break the shared chrome contract
- **session:** 368-marcus-design-system-audit   **kind:** design   **app:** automations / mailbox   **status:** wontfix — by-design (2026-06-30)
- **what happened:** **Automations** header has the title floating with **no back/forward nav and nothing on the right at all** — no object ⋯ menu (the contract says ⋯ is the last/rightmost element of every header). **Mailbox** likewise has no nav arrows, so its title starts at a different x (~88px) than the rest of the fleet (~150px, after the `‹ ›` nav). Every other app I swept (Notes/Tasks/Files/Bookmarks/Contacts/Books) carries nav-then-title and a trailing ⋯.
- **what I expected:** identical header skeleton everywhere — nav on the left, content actions then the ⋯ object menu last on the right.
- **evidence:** tests/dogfood/.sessions/368-marcus-design-system-audit/34-automations-02-header.png, 33-automations-01-full.png, 37-mailbox-02-header.png, 36-mailbox-01-full.png
- **triage:** _design/bug — align both to the SDK `.app-header` left/right groups + the ⋯-last rule (per CLAUDE.md header conventions)._
- **resolution (2026-06-30): WONTFIX — by-design.** Re-examined the source on the fix pass: Automations' empty `app-header__right` is deliberate and **test-asserted** (`app.test.tsx`: "renders the app-header with NO trailing object ⋯") — its comment notes "a permanently-disabled ⋯ reads as broken" since no Automations surface has a header *object* to act on (actions live on rows / the visible toolbar). Mailbox's right group is simply empty in the no-account state (nothing to compose yet). The title-x difference vs Notes/Files is because those apps carry nav-history `‹ ›` arrows and Automations/Mailbox don't — also legitimate. The ⋯-last contract is about *ordering when a ⋯ exists*, not a requirement that every header have one. No fix; the verify-before-patch pass caught this before "fixing" intentional behavior._

### F-307 — Contacts empty state points at a list that isn't there
- **session:** 368-marcus-design-system-audit   **kind:** design   **app:** contacts   **status:** wontfix — mostly harness artifact (2026-06-30)
- **what happened:** with no person selected the surface shows a centered hero "No contact selected / Choose a person from the list, or create a new contact" — but no people list is visible (empty/collapsed) and there's no create action in the hero; the only "create" is the header `+`. So it tells me to pick from a list I can't see and offers no way forward from the hero itself.
- **what I expected:** when there are no contacts, the hero says so and offers a primary "New contact" action (matching Books/Mailbox, which put the CTA in the hero).
- **evidence:** tests/dogfood/.sessions/368-marcus-design-system-audit/21-contacts-01-full.png
- **triage:** _design — give the no-contacts hero a primary create action and reconcile the copy with whether a list is shown._
- **resolution (2026-06-30): WONTFIX — mostly a harness artifact.** Re-examined the source: the Contacts **list panel already renders an `EmptyState` with a primary "New contact" CTA** (`person-list.tsx`, `data-testid="contacts-empty-new"`) when there are zero people. The "blank list + centered placeholder" I captured was the generic-sweep collapsing the list panel (a known harness limitation — see [[dogfood-inspector-navigation]]), not a product state. The "No contact selected" centered placeholder is the correct two-pane behavior when a populated list has no selection. Residual nit (the detail placeholder copy says "choose from the list" even when the list is empty) is minor and low-value; left unfixed. No code change._

## Iteration-chores retrospective — 2-day review sweep (2026-06-30)

Ran `/iteration-chores` over the last 2 days of merged work (shell PRs #14–#46:
read-only lock fleet, shared `<EmptyState>`/`<SelectMenu>`/`<LockButton>`,
dictionary-editor menu migration, settings frost-in perf). Security ✅ (no new
IPC/capability/dep surface; lock is advisory-by-design), pentest ✅ (no
exploitable findings), performance ✅ (all size budgets pass), memory-leak ✅
(lock fleet *reduces* lifetime surface). Code review surfaced one real class of
bug — partial lock enforcement (F-303). Design review flagged nice-to-fix nits
(emoji-as-icons now fleet-wide via the shared inline toolbar; ColorMenu/OverflowMenu
in that toolbar still bespoke — pending the fancy-menus migration; LockButton
double tooltip).

### F-303 — read-only lock left secondary write paths editable (database/bookmarks/code-editor)
- **source:** iteration-chores code review (not a dogfood session)   **kind:** bug   **app:** Database / Bookmarks / Code-editor   **status:** ✅ done (2026-06-30)
- **what happened:** the Lock-2 rollout gated each app's *primary* surface but missed *secondary* ones, so a record showing "locked" could still be edited: **database** — inspector Properties tab, cover, icon, and board/calendar/timeline drag all persisted on a locked record (only grid cells + title rename were gated; the plan's "cells read-only across every view" over-claimed); **bookmarks** — cover button + full properties panel stayed editable; **code-editor** — a locked file was still renamable/deletable via the ⋯ menu.
- **what I expected:** a locked object is read-only on every surface.
- **resolution (developer, 2026-06-30):** shell PR #47 (`83ac38d`). Database routes cover/icon/inspector + drag through a new exported `isRecordLocked()` and passes `onEdit: undefined` to `InspectorProperties` (read-only paint); bookmarks gate the cover button + OR `locked` into every panel row; code-editor extracts `isCodeFileEditable()` gating rename/delete + defense-in-depth guards. Lock stays an advisory affordance (the entities-service write is still capability-gated). Tests: `isCodeFileEditable` matrix + bookmark-panel-locked + new `inspector-properties` read-only test. typecheck (packages+apps) + lint clean; affected app suites green. Tracked as plan **Lock-4**.

## Session 362 — app consistency + functionality loop (2026-06-29)

Functionality: re-ran the deep-CRUD verify (342) — create works in Notes, Tasks,
Database, Calendar, Contacts, Bookmarks, Files. One real data-loss bug surfaced
(F-299). Consistency: three code audits (header chrome / menus / empty-states).
**Headers are clean** across all 20 apps (an audit claim that "Bookmarks has no
app-header" was a FALSE POSITIVE — grep silently missed `app.tsx:1000`; verified
by hand). Menus + empty-states have real debt (F-300, F-301).

### F-299 — Journal eats the first word when I start writing on a new day

- **session:** 362-journal-first-char   **kind:** bug   **app:** journal   **status:** DONE (branch `fix/journal-first-char-f299`)
- **what I was trying to do:** open Journal on a day with no entry yet and just start typing.
- **what happened:** the leading character(s) are dropped, **deterministically**.
  Typing "Pipeline ready" lands as "ipeline ready" / "peline ready" (the number
  lost grows with how slow the implicit-create handoff is). A **Lexical error #94**
  also fires (uncaught `pageerror`) during the handoff. Confirmed 3/3 on fresh
  dates; an already-created entry (real editor already mounted) does NOT drop.
- **what I expected:** every character I type lands, from the first.
- **root cause (mechanism):** an entry-less date renders `.journal__write-placeholder`
  (`ImplicitCreateBody`, `apps/journal/src/app.tsx:1904`). The first keystroke arms
  `entities.create`; on resolve the app seeds the real `<EntryEditorIsland>` from the
  placeholder text and calls `focusEditorAtEnd`. The seed is applied via Lexical
  `setEditorState` inside `initialEditorState` (`apps/journal/src/ui/entry-editor.tsx:235-265`)
  but races the Yjs `CollaborationPlugin` hydration and throws #94, so the seed text
  is lost — the real editor mounts empty, focus lands, and only post-handoff
  keystrokes survive (hence the *first* chars vanish). The code already has layered
  fixes + comments about this exact "first character lost" symptom, so it's fragile.
- **evidence:** `tests/dogfood/.sessions/362-journal-first-char/` (notes + `step-*.png`);
  repro spec `tests/dogfood/sessions/362-journal-first-char.spec.ts`.
- **Lexical #94 decoded:** "splice: could not find collab element node" — a
  `@lexical/yjs` binding error. The seed of the freshly-created Yjs doc races the
  binding bootstrap: the splice throws, the seed aborts, the doc stays empty, and
  only post-handoff keystrokes survive (so the *first* word — the seeded text — is
  what's lost).
- **partial fix shipped (branch `fix/journal-first-char-f299`, status: reduced, not closed):**
  (1) `apps/journal/src/ui/entry-editor.tsx` — the seed plant called
  `editor.setEditorState()` + a nested `editor.update`/`editor.focus` inside
  CollaborationPlugin's bootstrap update (illegal); replaced with the update-safe
  `plantJournalSeed` (deserialize blocks via `$parseSerializedNode`, append,
  `selectEnd`). Unit-tested (`entry-editor-seed-plant.test.tsx`, 4 tests).
  (2) `apps/journal/src/app.tsx` `focusEditorAtEnd` — dropped the raw
  `window.getSelection()`/range manipulation that raced the binding (caret now set
  by the plant). **Effect: dropped chars 2→1, #94 3×→1×** (measured via session 362)
  — better, but NOT closed; a char is still lost.
- **FIX (option a — eliminate the handoff):**
  1. `apps/journal/src/app.tsx` `EntryBody` — an entry-less mutable day now renders
     the real `<EntryEditorIsland>` directly (bound to the deterministic stable id),
     not the placeholder. The id is identical before/after the entity exists, and the
     island sits at the same JSX slot in both cases, so React keeps ONE editor mounted
     across the create — no handoff, no seed, no lost first word. Template chips moved
     above the editor; `ImplicitCreateBody` + `seedFromText` deleted.
  2. The entity is created on **focus** of the writing area (intent to write, before
     the first keystroke), with lazy-create on first edit as a backstop — so browsing
     doesn't mint empty days but the row exists in time for content persists.
  3. `packages/react-yjs/src/resolver-accessor.ts` — `persist` now swallows a
     not-found `applyDoc` (symmetric with `load`'s existing handling) so the
     editor-mounts-before-create window doesn't emit unhandled rejections.
  4. `apps/journal/src/ui/entry-editor.tsx` — seed plant rewritten to update-safe
     `plantJournalSeed` (`$parseSerializedNode` + `selectEnd`, no `setEditorState`);
     `app.tsx` `focusEditorAtEnd` dropped its racy DOM-selection manipulation.
- **VERIFY (session 362, 2 trials):** first char survives in-session AND persists
  across away+back ("Pipeline ready" intact); **Lexical #94 = 0, applyDoc not-found = 0.**
  Deep-CRUD verify (342) journal step now clean. 285 journal+react-yjs unit tests pass
  (incl. new `entry-editor-seed-plant.test.tsx`); packages + journal-app typecheck clean.
  (Unrelated: 342's Database add-row check reports a non-deterministic count 22→22 / 25→22
  — the known unreliable virtualized-grid row count, see session 344, not this change.)

### F-300 — Files hand-rolls menus instead of the shared fancy-menus runtime

- **session:** 362-journal-first-char (menu audit)   **kind:** design   **app:** files/sdk   **status:** DONE (SDK dictionary menu PR #24; Files destination picker PR #30)
- **what happened:** the sort menu and the bulk move/copy destination picker render a
  `<div role="menu">` with `role="menuitem(radio)"` buttons inside a shared `<Popover>`,
  instead of opening through `openAnchoredMenu` / `openSelectMenu`. Violates the standing
  "every menu through the shared runtime" rule. (The sort one is really a multi-control
  settings popover, so it's borderline; the destination "pick a folder" picker is a clear
  candidate for `openSearchPicker`.) The SDK `dictionary-editor.tsx:407` row-action menu
  has the same `menuOpen`+`<div role="menu">` anti-pattern.
- **evidence:** `apps/files/src/ui/dialogs.tsx:171` (sort), `:381` (destination);
  `packages/sdk/src/property-ui/dictionary-editor.tsx:407` (row menu).
- **DONE (PR #24):** SDK `dictionary-editor` row ⋯ menu now opens via `openAnchoredMenu`
  (removed `menuOpen` + `<div role="menu">` + local `MenuItem`; orphaned `.notes__dict-menu*`
  CSS deleted; test drives the real runtime). 198 property-ui tests pass.
- **DONE (PR #30):** Files bulk move/copy **destination picker** now uses the shared
  `openSearchPicker` (anchored to the bulk-bar button; type-to-filter folders) instead of the
  centered `<Popover>` + `<div role="menu">` list. The Files **sort popover** (`dialogs.tsx`)
  is a multi-control settings panel (radios + direction + tile size + columns + apply-to-all),
  NOT a menu — it correctly stays a `<Popover>` (reclassified: not a violation). F-300 closed.

### F-302 — Database stage shortcuts used raw `keydown`/`e.key` instead of the registry

- **session:** 362-journal-first-char (keyboard audit)   **kind:** design   **app:** database (+ others)   **status:** DONE (database converted PR #26; input-local handlers annotated PR #31)
- **what happened:** a keyboard-handling audit (rule: keyboard via `useShortcut`/`attachShortcut`,
  never raw `e.key`) found ~15 hits. The clearest high-severity one: Database's
  `bindStageKeyboard` drove Escape (close inspector) / Mod+A (select all) / Space (Quick Look)
  via a raw `addEventListener("keydown")` — right next to `bindViewTabKeyboard`, which already
  uses the sanctioned `attachShortcut`.
- **DONE (PR #26):** stage shortcuts moved onto `attachShortcut`; single-key chords inherit the
  shared editable/menu suppression (deleted the hand-rolled `isTextInputFocused` guard). 820
  database tests pass.
- **remaining (tracked, NOT bundled):** Shell tab-strip `tab-strip.tsx:70` (Enter/Space activate)
  + dashboard `app-grid.tsx:124` (input→grid nav) — small shell-chrome handlers; SDK
  `add-property-picker.tsx:187` + `find-replace/find-bar.tsx:89` (Enter/arrows/Escape on a
  search input — likely legit input-local, want `keyboard-exempt` annotations). The bulk of the
  rest are inline-edit Enter/Escape commits (chat/whiteboard/files/contacts/notes-equation) where
  the project's resolution is to MARK `keyboard-exempt` consistently, not rewire — a judgment-y
  annotation pass, deferred (some siblings already carry the comment; these don't).

### F-301 — Several apps hand-roll full-pane empty states instead of `<EmptyState>`

- **session:** 362-journal-first-char (empty-state audit)   **kind:** design   **app:** files/database/tasks/whiteboard/calendar/journal   **status:** ✅ done (2026-07-27 — the last deferral was stale; see the close-out below)
- **what happened:** a shared `<EmptyState>` Hero exists (`@brainstorm/sdk/empty-state`),
  but several full-pane empties are hand-rolled: Files `.content-empty`
  (`content-list.tsx:361` — glyph+title+body+CTA, duplicates the Hero; note it doubles as
  an OS-drop target, so wrap rather than replace), Database defines a **local component
  literally named `EmptyState`** shadowing the SDK one (`mount.tsx:74`, minimal title+body,
  no Hero glyph), Tasks (`surface-view.ts:539`, DOM-built) and Whiteboard
  (`engine.ts:2274`, `layers-panel.ts:91`, DOM-built) build empties imperatively,
  Calendar agenda (`agenda-view.tsx:36`), Journal empty entry (`app.tsx:1816`).
- **evidence:** file:lines above (verified by hand-read, not just grep).
- **DONE (this PR):** Files folder/search empty (`content-list.tsx`) now renders the shared
  `<EmptyState>` inside the drop-target wrapper (kept as the OS-drop zone; dead
  `.content-empty__glyph/h2/p/__cta` CSS removed); Calendar agenda empty
  (`agenda-view.tsx`) renders `<EmptyState icon=KindDate>` (orphaned `.cal-empty` CSS
  removed). Verified session 363: Files search-empty shows `.bs-empty-state`, zero legacy
  markers; 595 files+calendar tests pass, css-tokens clean.
- **remaining:** Database's local `EmptyState` (`mount.tsx:74`) — **renamed to `StageEmpty`
  (PR #25)** to stop shadowing the SDK name; kept intentionally minimal ("empty vault =
  empty app"). **Tasks (`surface-view.ts`) DONE (PR #29)** via a new SDK DOM twin
  `createEmptyState()` (the imperative counterpart of `<EmptyState>`). Whiteboard
  `engine.ts` (nav) + `layers-panel.ts` (layers) are **compact single-line panel-list
  empties** (like the calendar sidebar empty) — reclassified as acceptable compact empties,
  NOT full-pane Heroes (a Hero glyph in a narrow nav/layers list would look wrong). Journal
  empty (`app.tsx`) deferred to avoid conflicting with the F-299 branch (PR #22).
- **NEW SDK primitive (PR #29):** `createEmptyState()` (DOM twin of `<EmptyState>`) — use it
  for any future imperative-DOM empty instead of hand-building `.bs-empty-state` markup.
- **CLOSED 2026-07-27 (verified by reading the code, not the note).** The one item still
  listed as outstanding — "Journal empty (`app.tsx`) deferred to avoid conflicting with the
  F-299 branch" — is stale twice over: that branch merged long ago, and the markup it points
  at is not a full-pane Hero to begin with. Journal has two empties, and both are the
  *compact hint* shape this entry already reclassified as acceptable for Whiteboard's
  nav/layers lists and the Calendar sidebar: `.journal__empty` (`app.tsx:1803`) is a bare
  `<p>` inside the entry body — `align-items: flex-start`, faint text, no glyph, no CTA —
  shown when a past day has no entry, and `.journal__overview-empty` (`app.tsx:1518`) is a
  single small faint line inside an overview list. Converting either to a Hero would be a
  regression, not a fix: a centred glyph+title+CTA block inside the entry body would read as
  a full-pane empty for a *pane that is not empty*. Nothing remains; the `<EmptyState>` /
  `createEmptyState()` pair plus the zero-baseline `tools/check-bespoke-empty-cta.mjs` gate
  (which deliberately passes `<p>`-only hints) is what holds the line from here.

## Session 361 — property-editing consistency audit (2026-06-29)

**What I checked:** the worry that every app reinvents property editing. I drove
the property surface of every property-bearing app and cross-read the code:
all of them — Notes, Journal, Database, Tasks, Contacts, Books, Bookmarks, Files,
Graph, Preview — render and edit properties through the SAME shared stack
(`<PropertiesPanel>` / `EntityPropertiesPanel` chrome whose value column resolves
through the `getCell(valueType, view)` registry in `@brainstorm/sdk/property-ui`).
Database's `EditableCell` and the per-app row adapters still bottom out in
`getCell`, so the *editing* interaction is genuinely identical; only the row
bridging (typed field → PropertyDef) is app-local, which is correct. No native
`<select>` survives anywhere. **The fear is mostly unfounded — the team already
centralised this well.** One real exception below.

- **evidence:** `tests/dogfood/.sessions/361-property-editing-consistency/` —
  Database inspector (`01`/`02`, shared Properties/Comments tabs + editable
  cells) and Bookmarks (`05`, `.bs-props` = 10 rows / 18 shared `.bs-cell-*`
  editors, click-value → shared popover). Spec: `tests/dogfood/sessions/361-property-editing-consistency.spec.ts`.

### F-298 — Calendar's event editor reinvents property editing instead of using the shared cells

- **session:** 361-property-editing-consistency   **kind:** design   **app:** calendar   **status:** PARTIAL — Status unified (PR #28); structural migration still OQ-DM-gated
- **what I was trying to do:** edit an event's status/colour/date the same way I
  edit a task's status or a bookmark's tags.
- **what happened:** Calendar's `event-detail.tsx` hand-rolls its whole form — a
  custom `RadioGroup` for **Status** and **Colour** (vs the vocabulary-backed
  single-select `TagCell` every other app uses for status), a custom
  `DateTimeField`, and native `<input>`/`<textarea>` for title/location/notes.
  It imports neither `<PropertiesPanel>` nor `getCell`. So the one place I'd most
  expect "status is status everywhere" breaks: switching between Tasks/Contacts
  (TagCell menu) and Calendar (radio buttons) is two different interactions for
  the same concept. (`SelectMenu` for the timezone *is* shared — partial reuse.)
- **what I expected:** the same status/select/date editors as the rest of the fleet.
- **evidence:** `apps/calendar/src/ui/react/event-detail.tsx:443,459` (RadioGroup
  status/colour), `:406,412` (DateTimeField), `:377,433,522` (native inputs);
  `apps/calendar/src/ui/react/radio-group.tsx` (calendar-only, not in the SDK).
- **DONE (PR #28, path a):** Status `<RadioGroup>` → shared `<SelectMenu>` (the one
  Calendar already uses for time zone), so the single-select *interaction* now matches
  the fleet. Colour stays a swatch radiogroup (a visual palette, deliberately not a
  dropdown). Orphaned segmented CSS removed; 285 calendar tests pass; dogfood 365.
- **remaining (path b, OQ-DM-gated):** the structural fix — make Event a property-bearing
  vault entity (`values` map + catalog) and drive the form through `<PropertiesPanel>` /
  `getCell` like Tasks/Contacts (which would also fold in the custom `DateTimeField` +
  native title/location/notes inputs). Blocked on resolving OQ-DM; do NOT resolve that
  open question unilaterally. `radio-group.tsx` stays (Colour still uses it).

## Session 354 — fleet read-only lock: foundation + Notes + Journal (2026-06-28)

**User feature:** "lock should be present in all apps where possible, and synced."
Lock = **read-only** (block edits, allow view/navigate); sync is automatic
(`locked` is a normal synced entity property). Rolling out **one app per commit,
dogfood-verified each**. This entry covers the foundation + first two apps.

- **Shared `@brainstorm/sdk/lock-button` `<LockButton>`** (shell `5471c90`) — one
  header toggle for the whole fleet (`.header-icon-btn`, `aria-pressed` locked
  state already accent-styled). **Notes migrated** off its bespoke button onto it.
- **Journal read-only lock** (shell `c43621d`) — header toggle reads/writes the
  entry's synced `locked`; the editor goes read-only via `editable={mutable &&
  !locked}` threaded through `EntryEditorIsland → JournalEntryEditor →
  <BrainstormEditor>`.
- **Shared-editor bug found + fixed (verify-before-believe).** First Journal run:
  the lock button toggled but the editor **stayed `contenteditable="true"`**.
  Root cause: `<BrainstormEditor>` only seeded `editable` in `initialConfig` —
  Lexical never re-reads it, so a post-mount lock did nothing (Notes only worked
  via its *own* reactive `EditablePlugin`). **Fix:** a small reactive
  `EditableSync` plugin (`editor.setEditable` on prop change) in the shared
  editor — **unblocks lock for every BrainstormEditor consumer** (Tasks/Bookmarks).
- **verified (dogfood 354):** lock affordance shows for a real entry;
  `contenteditable` flips **true → false (locked) → true (unlocked)**; 0 console
  errors. (Test note: a journal entry must exist first — created via a template —
  before the lock affordance appears, which is correct.)
- **rollout status:** ✅ Notes, ✅ Journal, ✅ **Code-editor** (`fe5dc2b`,
  355), ✅ **Whiteboard** (`3d08f1f`, 356: board-level engine `readonly`),
  ✅ **Tasks** (`140b60f`, 357: body editor read-only via the imperative
  inspector mount + EditableSync; rebased onto the concurrent property-cells
  refactor), ✅ **Calendar** (`de96e68`, 358: EventDetail form wrapped in a
  `<fieldset disabled>` + Save/Delete suppressed), ✅ **Database** (`dfad0fc`,
  359: per-record lock gates the shared `editProperty` commit → cells read-only
  across every view; inspector rename frozen), ✅ **Bookmarks** (`e728e95`, 360:
  detail body editor read-only via EditableSync; the earlier "BookmarkDetail is
  dead code" call was a grep-tool artifact — it's rendered at app.tsx:1494).
  **🎉 ROLLOUT COMPLETE — all 8 apps (Notes, Journal, Code-editor, Whiteboard,
  Tasks, Calendar, Database, Bookmarks) ship a synced read-only lock.**
- **evidence:** `packages/sdk/src/lock-button/`, `packages/editor/src/editor.tsx`
  (EditableSync), `apps/journal/src/…`; `tests/dogfood/.sessions/354-journal-lock/`.

## Session 353 — inline formatting toolbar: locked-state + icon polish (2026-06-28)

`tests/dogfood/sessions/353-inline-toolbar-lock-and-align.spec.ts` — **user-reported**
defects on the floating B/I/U/S toolbar (a screenshot showed it up on a locked
note + off-center icons). The user's wider point landed: *a clean console run
isn't "polished" — I'd been skipping alignment + locked-state artifacts*
([[polish-scrutinize-alignment-and-locked-state]]). Reproduced each defect,
fixed, and **verified by rebuild + on-screen measurement** (not code-reading).
**All FIXED → shell `main` `fa2f507`.**

### F-297 — inline toolbar shows on a locked note + baseline-off-center, undersized icons
- **session:** 353-inline-toolbar-lock-and-align   **kind:** bug (interaction + visual)   **app:** Notes / shared editor   **status:** ✅ done + verified (2026-06-28)
- **(a) shows on a LOCKED note.** Locking a note sets `editor.setEditable(false)` (B11.11, `contenteditable="false"`), but text is still *selectable* — and the toolbar's `read()` never checked editability, so the bar stayed up. **Repro (measured):** select text (bar shows) → lock → `toolbar still present: true`. **Fix:** gate `read()` on `editor.isEditable()` **+** a `registerEditableListener` so locking *while selected* dismisses it. **After:** `still present: false`.
- **(b) icons baseline-high (off-center).** Each `ToolButton` wrapped its inline SVG in a redundant `<span>` that carried text-baseline descender space → glyph sat high. **Fix:** removed the span (icons already carry `aria-hidden`). **Measured:** top-gap == bottom-gap (4px) — centered; was lopsided before.
- **(c) icons too small/thin (20×20 requested).** Shared catalogue size is 16px. **Fix:** scoped `.notes__inline-toolbar-btn svg { display:block; width:20px; height:20px }`. **Measured:** icon `16×16 → 20×20`.
- **debt found:** the inline-toolbar CSS is **duplicated** — `@brainstorm/editor/editor-theme.css` (journal/tasks/chat/bookmarks) **and** `apps/notes/src/styles.css` (Notes ships its own copy). The first rebuild fixed the size everywhere *but Notes*; both copies now carry the rule, flagged in-code as debt to de-dup when Notes adopts the shared sheet.
- **verified:** session 353 re-run — icon 20×20 · gaps 4/4 centered · no span · toolbar gone on lock · 0 console errors. Build path: `editor-theme.css` is per-app-bundled (not shell-injected), so each editor app rebuilds to pick it up.
- **evidence:** `packages/editor/src/plugins/inline-toolbar-plugin.tsx`, `editor-theme.css`, `apps/notes/src/styles.css`; captures `…/353-…/02-toolbar-tight.png` (before/after), `03-locked-while-selected.png`.

## Session 352 — Mira drives the Web Browser chrome (2026-06-28)

`tests/dogfood/sessions/352-mira-browser-chrome.spec.ts` — Mira turn, completes
the in-flight-app coverage (Automations 349 · Agent 350 · Mailbox 351 · Browser
here). Probes the chrome a user touches before any page loads (network egress
may be off in the harness). **Verdict: the browser chrome is solid; found + fixed
one real a11y bug (F-296).**

- **Real-browser chrome.** Tabs (open/close/+), Back · Forward · Reload ·
  History, a "Local page" security indicator, address bar ("Search or enter web
  address"), **Save to vault** clip affordance (Browser-5), and a Browser menu —
  opening a second tab grew the strip cleanly (captures `01`–`03`). 0 console
  errors.

### F-296 — a blank new browser tab had NO accessible name (empty aria-label) — FIXED
- **session:** 352-mira-browser-chrome   **kind:** bug (a11y)   **app:** Web Browser   **status:** ✅ done + verified (2026-06-28)
- **what surfaced it:** the chrome's aria-label dump contained an **empty `""`** entry — an interactive element with no accessible name.
- **root cause:** the tab button's `aria-label` (and `data-bs-tooltip`) were `tab.title || tab.url` (`apps/browser/src/app.tsx:1179/1181`). A **fresh blank tab** has *both* empty, so its accessible name resolved to `""` — while sighted users saw **"New tab"** (rendered via the *separate* visible fallback `tab.title || t("tab.untitled")`, line 1191). A screen-reader user navigating tabs heard an unlabeled button; the accessible name didn't match the visible label. (Exactly the class the repo's own `a11y-button-name-check` audit targets.)
- **fix:** add the same `|| t("tab.untitled")` fallback the visible title already uses, to both the `aria-label` and the tooltip — so the accessible name is "New tab", matching what's on screen. One-token change, no design judgment (unlike F-295), type-safe (mirrors the existing line-1191 usage).
- **verified (real shell):** rebuilt `apps/browser` + re-ran `352` — the aria-label dump's empty `""` became **"New tab"**. Shipped to **shell `main`** (`3516d74`, via an isolated worktree off `origin/main`).
- **evidence:** `apps/browser/src/app.tsx:1179-1181` (before/after); `tests/dogfood/.sessions/352-mira-browser-chrome/notes.md` (the `""` → `"New tab"` aria-label dump across the fix).

## Session 351 — Mira sets up email — Mailbox connect flow (2026-06-28)

`tests/dogfood/sessions/351-mira-mailbox-connect.spec.ts` — Mira turn, in-flight
app. Without a connected account Mailbox has no mail, so the surface that matters
is the **connect flow** (the first wall any new user hits). **Verdict: the
connect flow is well-designed; it surfaces a *known* gap honestly. No new
finding, 0 errors.**

- **Empty state is clear:** "No mail account yet / Connect your Google account to
  sync mail into this vault" + a primary **Connect Gmail** CTA (capture
  `01-empty-state.png`).
- **Connect dialog is clean + honest** (`02-connect-google.png`): a **Google |
  IMAP / SMTP** tab pair, plain-language setup help, OAuth client ID / Client
  secret / Account label fields, and a trust line — *"the credentials are sealed
  in this vault's keystore."* The **IMAP/SMTP** tab switches cleanly (`03`).
- **Confirms the known `Mailbox-9` gap (not a new finding).** Connecting **Gmail
  today requires the user to "Create a Desktop-app OAuth client in Google Cloud
  Console… paste the client ID and secret here"** — a developer task a normal
  operator (Mira) can't realistically do. This is exactly what **`Mailbox-9`
  (official Google OAuth client registration)** exists to remove; it's tracked +
  pending (an external org task with weeks-of-lead-time). The real-shell evidence
  here = the dialog text. **What softens it well:** the **IMAP/SMTP** tab is a
  genuine escape hatch (app-password connect, no Google Cloud project) — so a
  user *can* get mail in today without BYO-OAuth. The design handles the
  constrained state about as gracefully as possible.

## Session 350 — Marcus design-reviews the Agent app (2026-06-27)

`tests/dogfood/sessions/350-marcus-agent-design-review.spec.ts` — specialist
turn (after 348/349 Mira). Marcus reviews the **Agent** app's craft: empty
state, composer, context rail, conversation settings. **Verdict: design is
strong; one minor finding (F-295).**

- **Empty state is honest + clear.** Centered sparkle tile, "Ask the agent
  anything", and a trust line that names the model story: *"Chat runs on your
  local model. Your messages stay on this device."* (capture `01-empty-state.png`).
- **Composer behaves.** Send is correctly **disabled when empty and enables on
  input** (`02`); the **Add context** rail opens a clean menu — *Mention or link
  a document* · *Upload media…* (`03`).
- **Per-conversation settings are correctly gated.** The ⚙ Conversation
  settings + ⋯ More buttons are **`disabled` in the empty state** (`activeConv
  === null`, app.tsx:1211/1248) — settings are per-conversation, so there's
  nothing to configure until a conversation exists. Honest, not a dead button.
  *(My probe clicked the disabled ⚙ and saw no popover — confirmed via code-read
  that this is correct gating, not a bug.)*
- **0 console/page errors** across the review.

### F-295 — Agent "Memory" header button uses a ★ star icon — DOWNGRADED to minor/by-design on deeper read
- **session:** 350-marcus-agent-design-review   **kind:** design   **app:** Agent   **status:** triaged → minor, likely keep-as-is (2026-06-28)
- **what I first saw:** the Agent header's **Memory** affordance (`aria-label="Memory"`) renders **`IconName.Star`** (`apps/agent/src/app.tsx:1224`). First glance reads ★ as *favorite*, not *memory*.
- **verify-before-fix (2026-06-28):** went to apply a swap and checking first overturned the finding on two counts:
  1. **`IconName.Database` (the first-pass recommendation) is not a real icon** — the `IconName` enum has no `Database`/`Brain`/`Library`/`Bookmark` member (valid set: `…History, Star, Pin, …, Archive, Tag, Kind*`). The proposed swap would have been a **type error**. (My earlier "Database is in the registry" was a grep hit on a *comment* + glyph-key, not an enum member — a verify-before-believe miss, now corrected.)
  2. **The star is a *consistent* metaphor, not a one-off wrong icon.** There are **two** `Star` uses in the app: the header **Memory** button (`1224`) and the per-message **"Remember"** action (`1340`, `className="agent__remember"` → `rememberFact`, `title=memory.remember.hint`). So **★ = "remember / memory"** is the app's intentional glyph in *both* places. "You star things to remember them" is a defensible, learnable metaphor; changing only the header would *break* the consistency with Remember.
- **disposition:** **not fixed.** The only valid same-meaning alternatives (`Archive` "stored away", `Pin` "pinned facts") are not clearly better than ★-as-remember, and any change must touch **both** sites to stay consistent. Net: a very minor, arguable nit — recommend **keep as-is** unless design wants to redo the whole remember/memory glyph language deliberately (then swap `1224` *and* `1340` together). No code change shipped — forcing a broken (`Database`) or partial (one-site) change would be worse than the nit.
- **evidence:** `apps/agent/src/app.tsx:1224` (Memory) + `:1340` (Remember); `IconName` enum in `packages/sdk/src/icon/icon-registry.ts` (no Database member).

## Session 349 — Mira builds an automation (in-flight-app deep probe) (2026-06-27)

`tests/dogfood/sessions/349-mira-builds-automation.spec.ts` — first of the
in-flight-app deep probes (the connector/agentic surfaces the core-CRUD sweeps
open but never drive). Mira opens **Automations** and builds a real workflow.
**Verdict: clean — the builder is genuinely well-built, zero findings.**

- **New workflow → Build dialog** is clear and well-structured: Name ("What
  does this workflow do?"), Trigger ("Fires on → Run on demand"), Steps,
  Capabilities ("This workflow needs no special capabilities") + Cancel/Save
  (capture `02-builder-open.png`).
- **Step palette is rich — 11 kinds**: Dispatch intent · Entity operation ·
  Notify · Wait · AI call · AI agent · Branch · For each · Expression · Export ·
  Run workflow.
- **Live capability surfacing (strong design signal).** Adding a "Dispatch
  intent" step renders a clean step card (reorder ↑↓ · duplicate · delete) with
  a Verb field, and the **Capabilities** section live-updates to
  `intents.dispatch:open` with a **"Not granted"** badge — the builder tells
  Mira exactly which capability the step needs and that it isn't granted yet
  (capture `04-step-configured.png`). Honest, consent-first.
- **0 console/page errors** through open → build → add step → configure.

By-design (not friction): a "No device hosts automation… / Claim" banner — the
`11b.6` host-claim model; the builder composes regardless, execution waits on a
claimed host. No product change.

## Session 348 — Mira drafts a structured doc + reopen persistence stress (2026-06-27)

`tests/dogfood/sessions/348-mira-structured-doc-reopen.spec.ts` — back to Mira
after Priya's 347 audit. Targets the two surfaces the breadth sweep skipped: a
doc built from **varied block types** and the **reopen-persistence** path that
has bitten before (the "switch/reopen → blank body" F-class, sessions 311/312).
**Verdict: clean — zero findings.**

- **All 7 block types insert cleanly** via the slash path (`runBlockCommand`):
  `heading2 · numberedList · quote · code · callout · toggle · divider` — every
  one returned `ok`, and they render correctly (numbered item, quote bar, code
  box, callout with ⓘ, toggle ▾, divider rule — capture `01-structured-doc.png`).
- **Persistence is byte-stable across a full renderer reload.** Before reload:
  **12 blocks / 150 body chars**. After `page.reload()` + re-select from the
  list: **12 blocks / 150 body chars — identical** (captures `02`/`03`). The
  body re-hydrates from the vault intact; the blank-body bug class does **not**
  reproduce.
- **0 console/page errors** across drafting + reload + reselect.

A strong positive signal for the editor block model + the Yjs/storage
re-hydration path. No product change.

## Session 347 — Priya's knowledge-integrity audit (2026-06-27)

`tests/dogfood/sessions/347-priya-knowledge-integrity.spec.ts` — a specialist
turn after the Mira-breadth `012`–`028` sweep, deep-probing the **connective
tissue** the breadth pass skipped: can Priya cross-reference / embed from the
editor, is what she writes findable, and does the Graph render it as connected.
**Verdict: the knowledge layer is healthy — zero product findings.**

- **Embed / reference discoverability — rich.** `/embed` surfaces **Embed ·
  Graph · Book highlight · Bookmark · Reference**, each with a one-line
  description (capture `02-slash-embed.png`). A research editor can embed a
  preview card, a live reference, a saved graph, or a book highlight from the
  slash menu — exactly the surfaces a cited deliverable needs.
- **Cross-linking — rich + typed.** `@` offers 15 options spanning Today/
  Tomorrow/Yesterday + journal entries, Notes, Bookmark, Task, Project,
  BrowsingSession, CodeFile, Event, ListView — each with its type label
  (capture `03-mention-typeahead.png`).
- **Findable.** Vault search `knowledge-integrity` surfaces the new note. **Graph** canvas renders. **0 console/page errors** across the whole audit.

**Spec hygiene (fixed this turn, not a product bug):** the first run logged
`"/embed" slash-menu results: []` — a **stale selector in the new spec**
(`.notes__slash-menu`), since the slash menu migrated to the shared
fancy-menus runtime (`.fm-menu` / `role="option"`). Switched the locator to
`.fm-menu [role="option"]` and re-ran: it now captures the five commands above.
Another verify-before-believe catch (this time in our own probe) — the feature
was always there; the selector had drifted.

**Not filed (vault cruft, per the hygiene rule):** the `@` list shows one Note
titled `DeleteMe note 56368DeleteMe note 26658` (two `DeleteMe` test titles
concatenated into one entity) — accumulated dogfood-session residue in the
persistent vault, Mira's-desk cruft not a product bug.

## Session 012–028 (app-sweep arc) — fleet dogfood sweep across all 20 apps + shell surfaces (2026-06-27)

> **Numbering note:** these are the **app-sweep** arc specs (full slugs below), a
> *different* track from the early-June CRM arc that reused the same `0NN`
> numbers (`023-track-deal-size` ≠ `023-tasks-nav`). Always disambiguate by slug.

A 17-session breadth sweep landed spec-only across the branch (the specs were
committed; the friction distillation + triage this block records were the missing
half). Coverage: an all-apps smoke open (`012`), the shell surfaces — dashboard
testids/aria, vault search (object + content), Bin, Settings (`015`–`017`) —
per-app deep CRUD on Notes/Files/Database/Calendar/Whiteboard/Tasks
(`013`/`014`/`018`/`019`/`020`/`023`), a remaining-apps create-affordance probe
(`021`), and the fleet-wide invariants: **dark-mode render (`022`), ICU
plural-leak scan (`024`), in-grid cell edit→persist→revert (`025`), dashboard
pin/unpin (`026`), cross-app clipboard / "Copy as block" (`027`), inbound
deeplink open (`028`)**. **Hard signal: 0 page/console errors across all 17
sessions; 20/20 apps render clean on dark; 0 ICU plural leaks across 20 apps.**
Cross-app clipboard, "Copy as block" → `brainstorm://entity` URI, and inbound
`open-url` deeplink all verified end-to-end. Two findings filed below — **both
downgraded to not-a-product-bug on a verify-before-believe follow-up** (F-293 a
smoke-harness renderer-pile-up artifact; F-294 a probe miss — the grid is
already searchable). Three further minor observations **not filed** — (a) `021`
saw no create affordance on
Books/Graph/Preview/Journal/ThemeEditor, expected for the view/tool apps but
**Books is worth a later look** (a reading app with collections); (b) several
apps emit *informational* boot logs (`[property-ui] catalog loaded`, `[files]
boot: snapshot=…`) through `console.warn`, which clutters the warn channel and
trips error-log heuristics — dev hygiene, not founder friction; (c) `026`
self-healed a pre-existing dashboard pin before asserting — vault cruft, not a
bug.

### F-293 — opening all 20 apps in a burst, 5 of them time out (smoke-harness artifact, not a product bug)
- **session:** 012-all-apps-smoke   **kind:** bug (launch perf)   **app:** shell / window-open   **status:** ✅ triaged — harness artifact, no product fix (2026-06-27)
- **what happened:** the smoke opened 15/20; **ThemeEditor, Agent, Automations, Mailbox, FormDesigner** each failed `founder: no app page for io.brainstorm.<id> after 20000ms`.
- **root cause (verify-before-believe, 2026-06-27):** `012-all-apps-smoke` opens all 20 apps in a **sequential loop and never closes a window** (`founder.openApp` retains every page; teardown is only at `s.finish()`), so by the 11th–20th open there are **10–20 live renderers** competing for CPU/RAM and the *heavier* apps' cold-open slips past the harness's 20s page-wait. The failing five are scattered across positions #11/12/14/16/17 (not strictly monotonic — Contacts #13 / Browser #15 / Books #18 / Preview #19 / Chat #20 passed), which fits **contention**, not per-app breakage. The same five open cleanly one-at-a-time (`021`) and **all 20** open with 0 errors in `022`/`024`. So the apps work; the unrealistic 20-renderer pile-up is the variable.
- **why it's not a bug:** no founder opens 20 apps and holds all 20 renderers alive inside 30s. The realistic path (open, use, the window-manager reaps idle ones) never reproduces it.
- **residual signal:** weak — the *heavier* apps are the slowest to cold-open under memory pressure, worth noting against **OQ-101** (cold-start budget) / **OQ-150** (V8 snapshots), cross-linked there. Not a measured cold-start number (the pile-up confounds it).
- **follow-up (this turn):** the smoke could close each window before opening the next to get a clean per-app cold-open signal — left as a harness improvement, not filed as product work.
- **evidence:** `tests/dogfood/.sessions/012-all-apps-smoke/notes.md` ("opened 15/20 apps"); `tests/dogfood/lib/founder.ts` (`openApp` retains pages; no per-iteration close).

### F-294 — "Show all apps" grid "has no search" — NOT A BUG, the probe never opened the grid
- **session:** 015-shell-dashboard   **kind:** ~~gap~~ → not-a-bug   **app:** shell / app launcher   **status:** ✅ wontfix — already implemented (2026-06-27)
- **what was logged:** the spec probed `[data-testid="app-grid-search"]` and found none → noted "no app-grid-search found on dashboard".
- **root cause (verify-before-believe, 2026-06-27):** the **AppGrid already has a full search field** — `packages/shell/src/renderer/dashboard/app-grid.tsx` mounts a `TextField type="search"` (`data-testid="app-grid-search"`, autofocus) that filters via the launcher's `filterApps` ranking, with Enter-to-launch-top-result and ArrowDown/Right into a roving 2-D grid. The grid is a **popover** (opened from the footer "Show all apps" start button / `⌘⇧Space`); its search input only mounts when the popover is `open`. **Spec `015` never opened the popover** — it dumped *dashboard-page* testids directly — so the input wasn't in the DOM and the `count()===0` branch logged a phantom gap. Exactly the [format note](#format) class: "a zero `.foo` match usually means the selector missed, not that the thing is absent."
- **fix (this turn):** `015-shell-dashboard.spec.ts` now clicks the "Show all apps" affordance to open the grid **before** probing `app-grid-search`, so the search is actually exercised and the false gap can't recur. No product change — the feature was always there.
- **evidence:** `app-grid.tsx` (the search `TextField` + `filterApps`); `015-shell-dashboard.spec.ts` (probed the dashboard page, not the opened grid).

## Session 328 (re-run) — every-button sweep, fresh signal across all 20 apps (2026-06-26)

Re-ran the proven every-button sweep to get a current health signal — especially
on the newer in-flight apps (Mailbox/Agent/Browser/Automations) that the core-app
CRUD sessions don't deep-probe. **32 menus, 205 buttons, 20/20 apps, 0 stuck
overlays** (the hard signal — clean). Two real findings surfaced; the 86
"possible dead button" entries are the sweep's known heuristic false-positive
class (nav/selection/number buttons — "Board", "Timeline", "Today", day cells
"1".."21", list rows — whose effect is real but not DOM-observable by the
effect-detector), **not filed**.

### F-291 — Calendar logs a React setState-in-render warning
- **session:** 328-rerun   **kind:** bug   **app:** Calendar   **status:** ✅ done (2026-06-26)
- **root cause:** `setView` and `step` (calendar `app.tsx`) called `recordNav(...)` — which `navHist.push` → notifies nav-history subscribers → their `setState` — **inside the `setAnchorState` updater function**. React runs state updaters during the render phase, so that fired a *different* component's setState mid-render ("update FR while rendering SU"). The sibling nav actions (`openMonth`/`setAnchor`/`goToday`) already did it right (compute `next`, set state, record outside the updater).
- **fix (2026-06-26):** added an `anchorRef` (latest anchor) so `setView`/`step` compute `next` from `anchorRef.current` OUTSIDE the updater, then `setAnchorState(next)` + `recordNav(...)` in the handler body — no side effect inside the updater. `tsc` (apps) + biome clean.
- **verified:** new `tests/dogfood/sessions/346-calendar-nav-no-setstate-warning.spec.ts` cycles every view kind + steps prev/next/today → **0 console errors, 0 setState-in-render warnings** (was the 1 Calendar console error in the 328 sweep).
- **what happened:** during the Calendar button sweep the renderer logged *"Cannot update a component while rendering a different component … setState() call inside …"* (React's setState-in-render anti-pattern; minified components "FR"/"SU"). Surfaced as the 1 Calendar console error.
- **why it matters:** setState-in-render can cause double-renders / subtle stale-state glitches; React will escalate this to an error in a future major.
- **ruled out:** `overflow-popover.tsx` (its `setPos` is in `useLayoutEffect`, correct — not the culprit). The offender is a child calling a parent/sibling setter during render; needs a repro + component stack to locate.
- **evidence:** `tests/dogfood/.sessions/328-every-button-sweep/console.log` ("[calendar] error: Cannot update a component …").
- **triage:** _(next)_ open Calendar with React DevTools / a stack-trace build, click through views to repro, move the offending setter into an effect/handler.

### F-292 — emoji glyphs newer than the bundled set fail to load (🪪/🫯)
- **session:** 328-rerun   **kind:** bug   **app:** Notes / Journal / Database (shared editor emoji)   **status:** ✅ resolved-enough (2026-07-08 — symptom fixed [clean 404]; real impact is 2 Emoji-14 glyphs blank in the icon-picker grid only, which already degrades via the picker's `onError` hide. Regenerating the 3,921-webp art set for 2 glyphs is disproportionate; closing. Reopen if a content path [not just the picker grid] ever requests a missing emoji webp)
- **what happened:** `brainstorm://emoji/1faea.webp` (🪪) and `1faef.webp` (🫯) fail with `ERR_UNEXPECTED` in Notes/Journal/Database. The bundled emoji art set (`art/emoji`, 3921 webp, iamcal img-apple-160) predates these Emoji-14 glyphs, but the editor's emoji shortcode/typeahead offers them — so rendering one requests a missing webp. (The *curated* IconPicker set of 144 is clean — verified zero missing — so this is the larger typeahead/shortcode dataset, not the picker.)
- **fix (symptom, 2026-06-26):** the `brainstorm://emoji` serve handler now `stat()`-checks the file and returns a clean **404** for a missing glyph instead of letting `net.fetch` throw and surface as `ERR_UNEXPECTED` (`main/index.ts`); `tsc` + biome clean.
- **scope (re-assessed 2026-06-26 — lower than first logged):** note **content is unaffected** — the editor's emoji typeahead inserts the raw unicode **char** (system font), not a `brainstorm://emoji` img, so no content request fails. The failing requests come **only from the icon-picker emoji grid** (`emoji-data.ts`'s full set lists a couple Emoji-14 glyphs without a bundled webp), and the picker **already degrades by design** — its `onError` hides the broken img (`picker.tsx`). So the real-world impact is: those 2 glyphs show **blank in the picker grid only**, plus a failed-request log (now a clean 404, not `ERR_UNEXPECTED`, after the handler fix).
- **status:** symptom fixed + characterised as minor/cosmetic. **Optional polish (low value, not done):** improve the picker `onError` to fall back to the raw char (system emoji) instead of hiding, or gate `emoji-data.ts` to the built filenames — either makes newer glyphs show via system font. Not worth the perf/structure churn in the virtualized grid for 2 glyphs; revisit if the gap widens with future emoji versions.
- **evidence:** `…/328-every-button-sweep/console.log`; `art/emoji/1faea.webp` + `1faef.webp` confirmed absent while `1f600.webp` present.

## Session 345 — fleet-wide delete-affordance + menu-health sweep (2026-06-26)

`tests/dogfood/sessions/345-delete-affordance-sweep.spec.ts` — across all 20 apps,
opens the object/context menu (header ⋯ or right-click an `[data-entity-id]`) and
checks for a Delete row + zero console errors. **Result: ✅ ZERO console errors
across all 20 apps** during the menu interaction (strong fleet-health signal).
Delete confirmed reachable via the heuristic for **5** apps (Notes, Tasks,
Database, Bookmarks, Files).

The other 15 reported "no delete found" — **a probe limitation, NOT a gap**, and
not filed as findings. The heuristic only reaches the *header* object menu or a
*top-level* `[data-entity-id]`; apps whose delete lives on a detail/event/cell
menu aren't reached. Spot-checked the suspicious data apps against code:
**Contacts** (`onRemove → setConfirmDeleteId` + confirm) and **Calendar**
(`calendar.menu.delete` + `EventDetailOutcome.Deleted`) both **have** delete — my
probe just didn't open the person/event detail. The rest are tool/view apps
(Graph, Preview, Browser, Code/Theme Editor, Agent, …) that legitimately have no
per-object delete. (Verify-before-believe, again — 345 found no bugs.)

## Session 344 — Database delete flow verified (the piece 343 deferred) (2026-06-26)

`tests/dogfood/sessions/344-database-lifecycle.spec.ts`. Picks up the Database
lifecycle 343 deferred. A first grounded attempt mis-fired — this vault has no
"Clients" grid, so it fell back to a BOARD list ("Tasks") whose cards aren't grid
rows, and the grid is `@tanstack/react-virtual` (row-count checks unreliable). All
**harness/state artifacts, not bugs** (code-read confirms delete: row menu
"Delete" → `confirmDeleteEntity` → a `delete-entity-confirm` popover with a
`.bs-btn--danger` → `deleteEntity` through the entities service). So 344 asserts
the part a GUI test reliably can, **view-agnostically and non-destructively**:
right-click any `[data-entity-id]` → the shared menu offers **Delete** → the
**confirm popover appears** → **Cancel** closes it cleanly — **zero console
errors**. ✅ Passes. The delete *flow* is wired and safe across whatever view the
list renders; row-grid create/delete (virtualization-aware, on a guaranteed grid
list) stays the one deferred piece.

## Session 343 — the delete/edit lifecycle the create-sweeps skip (2026-06-26)

342 verifies the *create* action of each core app; nothing exercises **edit** or
**delete** — where data-loss and stuck-state bugs hide. New spec
`tests/dogfood/sessions/343-delete-lifecycle.spec.ts` runs create → edit (must
persist) → **delete via the object ⋯ menu** → verify-gone, with zero console
errors. **Result: ✅ Notes and Tasks pass the full lifecycle cleanly** — delete
works, the object leaves the surface, no console errors. No friction filed.

**Method note (selector lesson, worth carrying forward).** The first two runs
filed *four* findings ("Notes/Tasks object ⋯ menu has no Delete row", etc.) —
**all false positives** from wrong selectors. Ground truth (from the working
"tidy" sessions, e.g. `051-tidy-tasks`): fancy-menus rows are
**`.fm-menu [role="option"]`** (not `.bs-object-menu__item`, a different
component), and the Delete label is exactly `Delete`. Verified against the app
code (Notes/Tasks both wire `onRemove`/`onDelete`) *before* believing the run —
the findings evaporated once the selector was corrected. Lesson for future GUI
sessions: confirm an affordance is genuinely absent (code + a known-good
selector) before recording it; a "missing" affordance is usually a wrong query.
**Database lifecycle deferred** — its grid add/row-delete affordances aren't the
header-⋯ menu, so it needs a dedicated session with grounded selectors (342
already proves DB add-row works, so the trimmed-out DB findings were not bugs).

## Session collab-005 — the Northbound team ships Issue #4 (2026-06-26)

User-prompted: *"we stopped using our Northbound team in dogfooding?"* — we had. The
last ~12 sessions (335–342) were solo single-vault mechanical sweeps; the
Mira+Marcus+Priya persona narrative and the multi-persona paired-vault collab
loop had gone dark since ~session 218 / collab-004. **Root cause of the silence:**
the repo split broke the collab harness outright — `tests/dogfood/lib/collab-team.ts`
did a value-import of `@brainstorm/tokens` (`ThemeName` enum) and every collab spec
value-imported `AccessRole` from shell **main-process source**, both unresolvable
from the thin post-split harness `node_modules` (no `yjs`/`@noble`/`@brainstorm/*`).
So `playwright --config=playwright.collab.config.ts` failed at module load — the
team loop couldn't even start. **Fixed** by inlining both as harness-local mirrors
(the `founder.ts` pattern: never import shell source — drive via `window.brainstorm`):
`ThemeName` → a string union, `AccessRole` → a `{Owner,Editor,Viewer}` const exported
from `collab-team.ts`; all five collab specs (001–005) repointed. 002 (three-editor
baseline) now passes again (3.4 s); new session 005 passes (8.5 s).

New spec `tests/dogfood/collab/005-northbound-issue4-team.spec.ts` drives the Issue #4
narrative beyond 002: mixed roles (Marcus Editor, Priya Viewer), a Viewer receiving
**live** editor edits (controlled diagnostic confirmed Viewers converge live, not just
on the share snapshot), revoke, and re-invite. Three findings + one harness gap.

**Collab hardening (2026-06-26).** After 005 surfaced the findings, the loop fixed
every harness/engine bug and widened coverage — the collab suite is now **8 sessions,
all green** (001–008): `006` per-entity DEK isolation ✅ (revoke one doc, the other
stays live — doc 16's promise holds), `007` four-way concurrent contention ✅ (20
simultaneous edits across 4 teammates all merge byte-identical — relay fan-out + CRDT
merge scale), `008` offline-reconnect ✅ (a teammate misses live edits while away, the
durable node backfills them on reconnect). Fixed: F-289 (multi-entity receiver), F-287
(re-grant access view), F-290 (durable-node launcher path) + the import-breakage
revival. Remaining open are F-286 / F-288 — both **Collab-C5** feature work (Share UX:
Viewer read-only + rotate-on-revoke), not quick fixes.

### F-286 — a revoked teammate keeps reading new edits (revoke ≠ forward secrecy)
- **session:** collab-005   **kind:** design/security   **app:** shell / sync (collab)   **status:** ✅ done (content) — 2026-07-09, shell PR #128. `SharingEngine.revoke` now rotates the entity DEK: mint DEK′ → HPKE re-wrap for survivors only → versioned/monotonic install (member-wrap v2 with an AAD-authenticated ordinal; `installEntityDek` accepts strictly-newer, rejects rollback) → durable deferred-rotation resume (offline/failed rotations mark `pending_rotations` and drain on relay-connect + boot). So a revoked member holds only the old DEK and can't decrypt any post-revoke frame (`ROT-3a` + `ROT-3a-i` + `ROT-3a-ii`, design [73](../security/73-rotate-on-revoke.md)). Security review clean across three lenses. **Metadata** unlinkability (a revoked member still sees ciphertext traffic exists) is `ROT-3b`, gated on `10.11b`. **Release-cut verification pending:** the `/pentester` two-shell real-relay dogfood before 0.3.0 ships.
- **what I was trying to do:** take Marcus off the Issue #4 brief, then keep editing it privately.
- **what happened:** after `revoke(Marcus)`, Mira edited the brief and **Marcus still saw the new text** (`"[mira: final pass after Marcus rolled off]"`). Revocation sets the access record's `revokedAt` (policy) but does **not** rotate the entity DEK or drop Marcus's relay subscription, so his shell keeps decrypting post-revoke frames with the DEK he already holds.
- **what I expected:** once revoked, Marcus can read history but not anything written after.
- **why it's subtle (not a surprise bug):** DEK *rotation* is deliberately **decoupled from access change** (resolved OQ, Stage 10.0). So this is the *consequence* of that decision surfacing end-to-end: revocation is not cryptographically effective until an explicit rotation. The in-product Share/revoke flow (Collab-C5) must **rotate-on-revoke** (and unsubscribe the removed member) or "remove access" is only advisory.
- **evidence:** `tests/dogfood/.sessions/collab-005-northbound-issue4-team/mira.notes.md` ("Forward-secrecy probe: Marcus STILL SEES post-revoke edits").
- **triage:** _(developer)_ confirm whether the production `revoke` path (engine `share`/`revoke`, not just the dev bridge) rotates + unsubscribes; if not, this is a Collab-C5 requirement, not optional.

### F-287 — you can't re-invite a revoked teammate (revoke is a dead end)
- **session:** collab-005   **kind:** bug   **app:** shell / sync (access-record)   **status:** ✅ done (2026-06-26)
- **root cause (not what the symptom implied):** the share *engine* was already correct — `grantAccess` appends a fresh live entry after a revoke, and `isActiveMember`/`activeMembers`/`roleOf` all resolve the re-grant as active. The bug was in the **access VIEW**: `SharingEngine.access()` returned `resolveMembers()` — the raw **per-append audit log** — so a re-granted member had TWO rows (the stale revoked one first, then the live one). Any consumer doing `view.find(m => m.member === X)` (the dogfood, and any future Share UI) hit the revoked row and read `active: false`.
- **fix (2026-06-26):** new `resolveCurrentMembers(doc, entityId)` in `access-record.ts` collapses the audit log to **one CURRENT row per member** (an active grant wins; else the latest-granted entry); `SharingEngine.access()` now returns that instead of the raw audit list (`resolveMembers` stays for the audit trail). **RED→GREEN**: new bridge test "re-granting a revoked member reactivates them in the access view" (failed: 2 rows, find hit the revoked one; passes: 1 active row); extended the access-record unit test to assert the de-duped current view; 40/40 collab unit tests green, `tsc` + biome clean. **Dogfood**: `collab/005` re-invite is now a passing assertion (`marcusRows.length === 1 && active`), verified real-shell.

### F-288 — a Viewer can still write; nothing blocks it at the data layer
- **session:** collab-005   **kind:** gap   **app:** shell / sync (collab) + Collab-C5   **status:** ✅ done (2026-07-08, shell PR #112 — Viewer read-only enforced at the data layer via the envelope-pipeline `authorizeWriter` gate + `isAuthorizedWriter` over the signed access record; drops a Viewer's signed update on live + restore paths; shipped in 0.2.0)
- **what happened:** Priya, granted **Viewer**, called an edit and it **propagated to the editors** — there is no data-layer write-block for Viewers (expected: a blind-relay CRDT can't refuse a key-holder's frame; the relay can't read roles).
- **what I expected:** a Viewer is read-only.
- **resolution direction:** this is correct at the crypto layer; enforcement belongs in the **in-product Share UX (Collab-C5)** — disable editing affordances for Viewers and don't emit their frames. Record it so C5 ships with Viewer read-only, not as an afterthought.
- **evidence:** `…/priya.notes.md` ("Viewer write-protection probe: a Viewer's edit PROPAGATED to the editors").
- **triage:** _(developer)_ fold "Viewer = read-only at the UI + no emit" into the Collab-C5 spec.

### F-289 — the dogfood collab bridge can't share two docs with one teammate (harness gap)
- **session:** collab-005   **kind:** gap (harness)   **app:** tests/dogfood (collab-dev-bridge)   **status:** ✅ done (2026-06-26)
- **fix (2026-06-26):** `CollabDevBridge` now keeps a `Set` of subscribed entity ids and ONE shared frame listener that dispatches each frame by **its own `header.entityId`** (the frame already carries it), instead of a single `#receiverEntityId` whose second install detached the first. `installShareReceiver` is now additive (subscribe + add to the set; install the listener once); `#detachReceiver` unsubscribes the whole set. Mirrors the production `LiveSyncEngine` (which tracks many). **RED→GREEN** unit test in `collab-dev-bridge.test.ts` ("Marcus receives live edits on TWO entities shared at once") — failed on the old code (`ent_brief_a did not converge`), passes now; original single-entity test stays green; `tsc --noEmit` clean. **Dogfood verified** by new `collab/006-per-entity-isolation.spec.ts` (1.9s): Marcus holds the brief AND the CRM note live at once, and — the payoff — **per-entity DEK isolation HOLDS**: revoking Marcus from the brief left the CRM note fully live for him (separate DEK + separate access record), validating the [16](../security/16-identity-orgs-encryption.md) per-entity-DEK promise end to end. This unblocks the multi-doc probe 005 had to drop.

### F-290 — durable-node collab sessions can't launch (`spawn bun ENOENT`)
- **session:** collab-003 / collab-004   **kind:** gap (harness)   **app:** tests/dogfood (launch-durable-node)   **status:** ✅ done (2026-06-26)
- **root cause (not bun):** `bun` was fine — `launch-relay.ts` spawns it bare and works. The real cause was a **non-existent `cwd`**, which also throws `spawn <cmd> ENOENT`: `launch-durable-node.ts` resolved `SYNC_MAIN` to `../brainstorm-sync/src/main.ts`, but the org migration renamed the durable-node repo to **`sync`** (`brainstorm-os/sync`). The path didn't exist, so `cwd: dirname(SYNC_MAIN)` pointed at a missing dir. Same post-split path-rot class as the collab-005 import breakage.
- **fix (2026-06-26):** `SYNC_MAIN` now resolves the first existing of `../sync` then `../brainstorm-sync` (legacy), and throws a clear "not found under …" error instead of a cryptic ENOENT if neither exists. `existsSync` guard added.
- **verified:** `003-durable-node` (1.5s) + `004-wipe-and-restore` (2.8s) pass again; the **full collab suite is 6/6 green** (001–006). SYNC-2 durable-node + cold-restore dogfood coverage restored.

## Session 342 — deep CRUD verify; the db-lock now fires on a SINGLE create (2026-06-25)

User-reported ("I still find functionality that doesn't work"). A new spec
(`tests/dogfood/sessions/342-deep-crud-verify.spec.ts`) drives the PRIMARY data
action of each core app — create a note / task / row / event / bookmark, type,
verify it lands, zero console errors — instead of just opening windows. First
run: **9 of 9 core actions broken**, all tracing to one root cause.

### F-278 — `database is locked` on entity create — ROOT-CAUSED + FIXED (was "burst-only")
- **session:** 328/335/342   **kind:** bug   **app:** shell (entities.db write path)   **status:** ✅ done (2026-06-25)
- **escalation (342):** the prior triage called this "stress-only … never seen in 30+ realistic founder sessions." It is no longer. Session 342 did **single, spaced-out creates** (1.8 s settle, app closed between each) and still logged **53 `database is locked` errors** across Notes, Tasks, Database, Journal, Calendar, Bookmarks — a user cannot create *any* object. The 5 s `busy_timeout` made each failing create *hang 5 s* first, so the whole tour took 5.2 min.
- **root cause (corrects the 2026-06-23 analysis):** the prior triage assumed "exactly ONE cached connection." Wrong. `[DBLOCK-DIAG]` instrumentation in `storage/sqlite.ts` showed **two live connections** to `entities.db` (`live=1` → `live=2`, both WAL, no close between). `DataStores.open()` consults its resolved cache *synchronously* but then `await`s the async driver-open+migrate — so two concurrent `open("entities")` callers BOTH miss the cache and each open a **separate** connection. The cache keeps only the last; the first **leaks as a second live writer**. Under WAL two writers hit a reserved-lock deadlock that returns `SQLITE_BUSY` *immediately* — which is why `busy_timeout` never helped (it's not checkpoint contention). Boot fans out exactly this race: the search reindex, the vault-entities listing, and the 10.14 restore-materialization all call `open("entities")` concurrently.
- **fix:** memoize the in-flight open promise per kind in `DataStores` (`opening` map) so concurrent callers collapse onto one connection. ~15 lines.
- **verify:** RED→GREEN unit test `data-stores.test.ts` › "collapses CONCURRENT opens of a kind onto one connection (F-278 stampede)" (4 concurrent `open("entities")` → all the same handle; fails on the old code). Real-shell: session 342 re-run → **0 locks, `max-live=1`, "ALL CORE ACTIONS WORK"**, runtime 5.2 min → 35 s (creates no longer hang on busy_timeout). 23/23 data-stores tests + `typecheck:packages` + biome clean. The two follow-on findings (Journal body text, Calendar same-day event) were **test-selector artifacts** — Journal writes the body fine ("7 words"), the Calendar event was hidden under the month-cell "+2 more" (verified on Agenda); both assertions corrected so 342 is a clean reusable baseline.

## Session 341 — user-reported: window-strip overflow (2026-06-25)

### F-285 — the open-windows strip overflows off-screen and becomes unusable with many windows
- **session:** user-reported   **kind:** bug   **app:** shell (dashboard footer)   **status:** ✅ done (2026-06-25)
- **what happened:** the dashboard footer's running-windows strip laid each tile out at a fixed `max-width: 200px` with `flex-shrink: 0` (never condensing) over an `overflow-x: auto` track whose **scrollbar was hidden** (`scrollbar-width: none`). Past ~5–6 windows the tiles overflowed past the right edge with no visible scrollbar and no scroll affordance — the off-screen windows were unreachable by mouse (only a trackpad two-finger swipe, undiscoverable).
- **fix (2026-06-25):** browser-tab behaviour — tiles now **condense** (`flex-shrink: 1`, the label gets `min-width: 0` so it ellipsizes then collapses toward icon-only while the icon always stays), so far more windows fit before the track has to scroll. For the genuine overflow case, the strip is wrapped (`.window-strip-wrap`) and grows **‹ ›  scroll buttons** (a `CaretDown` rotated ±90°) that appear *only* when the track can scroll that way (overflow detected via a `ResizeObserver` + scroll listener + recompute on window-count change) and page the track on click; the keyboard cursor also `scrollIntoView`s its tile when arrowing into the overflow. Scroll buttons are `tabIndex=-1` (mouse convenience; keyboard users rove + auto-scroll). +1 unit test (no-overflow → no buttons; mid-scroll → both; far-left → right-only); the existing KBN toolbar tests stay green; typecheck + biome + css-token clean.

## Session 339 — cross-app element-consistency audit (2026-06-24)

A different dogfooding method: instead of walking each app in isolation, capture
the SAME element across all 20 apps and read them side-by-side (all headers
together, all detail panes, all ⋯ menus, all empties) to find drift, define a
master, and align the outliers. Capture spec: `339-cross-app-consistency.spec.ts`
(main + detail + ⋯ menu per app). **0 console errors across all 20 apps.**

### F-284 — center-pane empties were inconsistent; aligned all to the shared <EmptyState> master
- **session:** 339-cross-app-consistency   **kind:** design   **app:** Chat, Mailbox, Agent (+ icon registry)   **status:** ✅ done (2026-06-24)
- **what the comparison surfaced:** primary center-pane empties drifted three ways — **Chat** "Pick a channel" / "No messages yet" had **no glyph at all**; **Mailbox** "No mail account yet" used a **flat envelope** (no chip); **Agent** "Ask the agent anything" used a **hand-rolled 44px chip** — while Preview / Books / Contacts / Code-editor already used the shared rose-chip Hero `<EmptyState>`. Master = the shared EmptyState.
- **fix (2026-06-24):** added a `Chat` glyph to the icon registry (enum + Phosphor `chat-circle` + regenerated `icon-glyphs.ts` + React `ICON_REGISTRY`) so Chat's empties carry a fitting icon; routed all three apps' center empties through `<EmptyState>` Hero (Chat → Chat glyph, Mailbox → KindEmail, Agent → Sparkle), preserving CTAs via the `action` slot and the `data-testid`/`scrollRef` wrappers. Deleted the hand-rolled markup + dead CSS; updated the 228-deep-mailbox / 228-deep-agent spec selectors to `.bs-empty-state*`. 10 apps now share the one empty-state chrome. typecheck + biome + css-token clean; chat/mailbox/agent/sdk suites green; screenshot-verified (339b).
- **deferred observations (recorded, not fixed — need a product call):**
  - **Header nav buttons missing in Chat / Mailbox / Agent / Automations.** The document/object apps (Notes, Journal, Tasks, Database, Calendar, Contacts, Bookmarks, Files, Books) show the shared `‹ ›` nav-history buttons; the connector/tool apps don't. Either wire `NavButtons` for consistency or confirm these surfaces have no navigable history by design.
  - **Secondary "nothing selected" detail-pane prompts** (e.g. Contacts right pane "No contact selected") use a muted grey treatment, distinct from the Hero center empties — a defensible second tier, but it varies app-to-app (some muted, some absent). Worth a deliberate master for the detail-pane tier.

## Session 338 — empty-state design-system unification (2026-06-24)

Follow-up to the 337 sweep's recorded non-defect ("Books 'Couldn't open this
book's file' renders as bare centred text vs siblings' iconned empty states").
Rather than patch Books alone, extracted the shared empty-state chrome that
Preview, Automations and Books had each grown locally. Spec:
`338-empty-state-extraction.spec.ts`.

### F-282 — empty states were three hand-rolled placeholders; now one shared `<EmptyState>`
- **session:** 338-empty-state-extraction   **kind:** design   **app:** Preview, Automations, Books   **status:** ✅ done (2026-06-24)
- **what happened:** the "nothing here yet" surface was hand-rolled three ways — Preview's `.preview__empty` (88px accent-chip glyph + heading + hint), Automations' `.au-empty-state` (28px dim glyph + title + body), and Books' reader-pane notices (bare centred `<p>` text, no glyph). Books' failure/empty/epub-pending states in particular read as unstyled text next to the iconned empties everywhere else. Three copies = past the DRY ceiling, and empty-state chrome is a shareable primitive (not on the catalog's *deliberately-not-shared* list).
- **fix (2026-06-24):** new `@brainstorm/sdk/empty-state` — `<EmptyState icon title hint action tone>` (+ CSS), `tone` = `Hero` (large accent chip) / `Compact` (small dim glyph), enum per the no-string-discriminator rule. Migrated all three apps onto it; deleted the two app-local `empty-state.tsx` + their dead CSS; routed Books' reader notices (loadFailed → Warning glyph; epub-pending / empty-library / no-book-open → a document glyph + title + hint) through it. Books' empty glyph started as `IconName.Read` (rendered a misleading "done" check-circle) → switched to `IconName.View` (the document/page glyph, matching Preview). +3 SDK tests; all three apps' unit + boot-smoke suites green; typecheck:packages + typecheck:apps + css-token gate clean. **Real-shell verified (338):** Preview "Nothing to preview", Books "Nothing to read yet", and the shared chrome all paint the rose accent chip + title + hint, clean console.
- **follow-up adoption sweep (2026-06-24, F-283):** migrated four more genuine full-surface empties onto the shared `<EmptyState>` — **Contacts** list ("No contacts yet" + New-contact CTA, Hero), **Code-editor** ("No code files yet" + New-file CTA, Hero, grid-spanning), **Notes** center "no note open" (Hero; `hint` widened to `ReactNode` so the inline `<kbd>` shortcut survives), **Mailbox** message list (Compact tone for the narrow pane; Inbox glyph empty / Search glyph no-results). Deleted each app's hand-rolled empty markup + dead CSS. Deliberately **left alone**: Files / Graph / Tasks `__empty` (small inline panel labels, not the glyph+title+hint shape) and dashboard widgets / narrow sidebars (a glyph chip would be oversized) — over-application is a smell per the catalog. +0 console errors across all four (338b); Contacts + Code-editor empties screenshot-verified painting the shared chrome; Notes/Mailbox empties are content-gated in the seeded vault (unit-tested instead).

## Session 337 — design-polish eyeball sweep across all 20 apps (2026-06-24)

Fresh subjective design walk (complement to 336) over a rebuilt shell + all 20
apps — main surface + a drilled-in object + open ⋯ menu (40 screenshots).
**0 console errors across all 20 apps.** The product reads as cohesive and
polished; the one cross-cutting defect was empty-state primary CTAs drifting off
the design system. Spec: `337-design-polish-sweep.spec.ts`; verify:
`337b-empty-cta-verify.spec.ts`.

### F-280 — empty-state "create your first X" CTAs render off the design system (Chat, Code Editor)
- **session:** 337-design-polish-sweep   **kind:** design   **app:** Chat, Code Editor   **status:** ✅ done (2026-06-24)
- **what happened:** every app's empty-state primary CTA is supposed to be the shared glossy accent button (`class="bs-btn" data-bs-primary` — the 2-colour gloss face in `@brainstorm/sdk/app-theme.css`), as Contacts ("New contact"), Books ("Import a book"), Mailbox ("Connect Gmail") and 7 other apps render it. Two apps drifted: **Chat** ("New channel", empty state + both New-channel dialog buttons) used a **phantom `.bs-btn--primary` class** that doesn't exist in the SDK — so the buttons fell back to the bare transparent base `.bs-btn` and read as plain bold text, not a button; **Code Editor** ("New file" empty-state CTA) used an app-local ghost class (`.editor__file-new`), rendering an outline button instead of the glossy primary.
- **what I expected:** the prominent "first object" CTA looks identical across apps — the glossy rose primary.
- **evidence:** `337-design-polish-sweep/29-chat-1-main.png`, `38-code-editor-1-main.png`.
- **fix (2026-06-24):** Chat — swapped all 3 `bs-btn bs-btn--primary` → `bs-btn` + `data-bs-primary` (the canonical hook). Code Editor — the empty-state button now uses `bs-btn` + `data-bs-primary` (the sidebar-header "New" stays a quiet ghost, correctly), and `.editor__empty-new` is reduced to spacing only. No SDK change (the hook already existed and 10 apps use it; this just brings the two outliers onto it). **Real-shell verified (337b):** both now paint the glossy rose primary matching Contacts/Books/Mailbox, clean console. chat + code-editor `tsc`/biome/css-token/build clean; 499 chat+code-editor tests green.
### F-281 — three more design-polish nits from the 337 sweep (Automations · Books · Graph)
- **session:** 337-design-polish-sweep   **kind:** design   **app:** Automations, Books, Graph   **status:** ✅ done (2026-06-24)
- **what happened + fix (2026-06-24):**
  - **Automations** — the empty state read "No workflows yet. Start from a template below." but the template gallery only rendered after clicking "New from template", so there were no templates below (broken promise). Fix: when there are no workflows, the **template gallery IS the empty state** (its "Start from a template" title + cards, the same actionable-empty-state pattern as Welcome-2 / Journal); `TemplateGallery` gained a `dismissible` prop so its Cancel hides when there's nothing to dismiss back to. Removed the now-dead `workflows.empty` string + `EmptyState` import. Test updated to assert the gallery-as-empty-state.
  - **Books** — the "No books yet / Import a PDF or EPUB…" headline+blurb rendered **identically** in both the sidebar library panel (with the Import button) and the main reader pane. Fix: the reader pane now shows a distinct, complementary message — "Nothing to read yet / Import a book from the library to start reading." (new `reader.emptyLibrary*` keys) — pointing at the sidebar's import affordance instead of echoing it.
  - **Graph** — the bottom-right zoom controls sat **behind** the open glass sidebar (the canvas is full-viewport; the sidebar is an `absolute` glass overlay), so they ghosted through the frost and were unclickable. Fix: the controls now sit to the **left** of the open sidebar (`transform: translateX(-1 × --graph-sidebar-width)`) and slide back to the window edge when it collapses (`[data-sidebar-collapsed="true"]`), tracked via transform so they follow the panel's own slide. (The faint node labels showing through the glass are intentional frosting — canvas paints behind the panel — and were left as-is.)
- **verify:** automations + books + graph `tsc`/biome(my files)/css-token/build clean; **860 unit tests green** (graph+automations+books), incl. the updated Automations empty-state test. **Real-shell verified (337c, 2026-06-24):** Automations empty state now renders the template gallery (4 cards + glossy Add, no Cancel); Books reader pane shows the distinct "Nothing to read yet"; Graph zoom controls sit crisp + clickable left of the open sidebar — and this confirmed the earlier "faint pink blur at Graph's bottom-right" was exactly the occluded zoom-controls ghosting through the glass (now gone). (Harness aside: the first 337c run hung on `firstWindow` because a prior killed run left a stale Chromium `SingletonLock` in `tests/dogfood/.data/`; removing `.data/Singleton*` cleared it.)

## Session 334/335 — thorough full-product re-sweep after the last two days' work (2026-06-23)

Re-ran the exhaustive every-button sweep (328) across all 20 apps plus a new
new-logic/design spec (334) over the features that landed 2026-06-22/23 (cross-app
DnD, Formula properties, Catalog/Marketplace, Contacts widget, Tasks Gantt,
Settings reopen-on-last-section). Verified along the way: **Settings reopens on
the last-viewed section** (picked "Notifications" → reopened there ✅); the
**Contacts dashboard widget is opt-in** (added via "+ Add widget", so a vault that
never added one shows 0 cards — not a bug). The sweep surfaced two real backend
findings, below. Specs: `334-new-logic-design-sweep.spec.ts`,
`335-broadcast-and-lock-reverify.spec.ts`.

### F-277 — entity write crashes when a window is torn down mid-broadcast (`reading 'isDestroyed' of undefined`)
- **session:** 328-every-button-sweep   **kind:** bug   **app:** shell (all apps via entity writes)   **status:** ✅ done (2026-06-23)
- **what happened:** the sweep closes each app's renderer before opening the next. A Tasks save that landed while a sibling window was tearing down logged `[tasks/entities-repo] saveTask failed: Cannot read properties of undefined (reading 'isDestroyed')`. The error propagated from the **main process**: every entity write fans a stale-signal/`app:*-changed` broadcast to all app windows, guarded by `win.webContents.isDestroyed()`. A tab closing concurrently leaves an `AppWindow` whose `webContents` Electron has already nulled (the type says non-optional, but teardown races make it nullish), so the guard itself threw — and the originating write IPC rejected. Hit any app, not just Tasks.
- **fix (2026-06-23):** new shared `isAppWindowLive(win)` predicate in `apps/launcher.ts` (`Boolean(win.webContents) && !win.webContents.isDestroyed()`); every window broadcaster now routes its guard through it instead of an inline `win.webContents.isDestroyed()` — **8 call sites** across `vault-entities-broadcast`, `ydoc-remote-broadcast`, `properties-handlers`, `network-settings-handlers`, `intent-broadcast`, and `dashboard-handlers` (theme/locale/format/theme-preview). +1 repro test (a torn-down window must be skipped, not throw). **Real-shell verified (335):** drive Tasks writes while closing a sibling Notes window → **0 isDestroyed errors** (was a guaranteed crash). 1040 shell tests green.

### F-278 — `database is locked` on a burst of rapid entity creates (stress-only)
- **session:** 328/335   **kind:** bug   **app:** Notes (entities.db write path)   **status:** ✅ done (2026-06-25 — root-caused + fixed; see the Session 342 F-278 entry above. The "same-connection / busy_timeout-immune" hunch was half-right: it WAS busy_timeout-immune, but because of a *second* leaked connection from a concurrent-open stampede, not same-connection contention.)
- **what happened:** hammering ~8 note creates inside ~1s makes nearly every `entities.create` / `applyDoc` reject with `Error: database is locked` (25 hits in 335), so the notes don't persist and the body apply then logs `applyDoc … not found` (the row never committed). **Never seen in 30+ realistic founder sessions** — only under synthetic rapid-fire.
- **analysis so far (2026-06-23):** ruled out a second writer — entities.db has exactly ONE cached connection in main (storage worker handles only files/kv.json; search uses search.db; the 10.14 restore + automations engines go through the same repo; one `DataStores` per session). The create transaction is a *synchronous* better-sqlite3 txn (not held across the post-commit `await ydoc.setEntityState`), and there's no open `.iterate()` on the connection. Added `PRAGMA busy_timeout = 5000` (correct, standard hardening for WAL write contention — kept as defense-in-depth) but the burst symptom persists, so the conflict is same-connection and busy_timeout-immune. **Next:** runtime SQL-call trace to identify what holds entities.db at burst time; consider serialising renderer-side entity writes (per-id queue) so concurrent creates can't collide. Tracked here rather than patched blind.

## Session 336 — design-eyeball walk across all 20 apps (2026-06-23)

Subjective complement to the mechanical 328 sweep: walked all 20 apps capturing
the main surface + a drilled-in object + an open ⋯ menu (40 screenshots) for a
designer's read. **0 console errors across all 20 apps** — and the F-277
broadcast crash / F-278 lock did NOT appear in normal use (confirming F-277 fixed
and F-278 is truly burst-only). Apps are in good shape overall: clean chrome,
consistent headers, polished empty states (Journal templates, Preview "press
Space to Quick Look", Mailbox connect-Gmail, Tasks "Press N"). Spec:
`tests/dogfood/sessions/336-design-eyeball-walk.spec.ts`. One concrete UI defect:

### F-279 — Tasks empty-priority chip reads "Priority" (a noun), not a CTA like its siblings
- **session:** 336-design-eyeball-walk   **kind:** design   **app:** Tasks   **status:** ✅ done (2026-06-23)
- **what happened:** a task with no priority set renders its priority chip with the bare word **"Priority"**, so an unset row reads `Priority · 2 Jun · Inbox` — the floating "Priority" looks like a mislabeled field/column, not a "click to set" affordance. Its siblings are verbs/values: the empty **date** chip says "Schedule", the empty **project** chip says "Inbox". The app's own CSS comments even name this affordance "Set priority", so the catalog value had drifted from the intended copy.
- **fix:** `apps/tasks/src/i18n/t.ts` — `tasks.row.chip.priority.set` "Priority" → **"Set priority"**, matching the "Schedule" sibling pattern and the documented intent. tasks typecheck + 36 task-row tests green.

### Non-defects observed (recorded, not fixed)
- **Title-less entities show their raw id as a name** in Database's all-vault-items grid and Chat's channel list (`m-mqp018n4`, `roster-mqnj79q8`, `compose-…`). Mostly test debris (real messages/channels have content/names), but the fallback itself could show a type-derived label. Left as-is (touches shared name resolution; low value vs risk).
- **Books "Couldn't open this book's file"** renders as bare centred text vs siblings' iconned empty states — but it's a seed-data edge case (book without a file).
- **Persistent dogfood vault is now heavily polluted with test debris** (duplicate "New project"/"Client intake"/"Daily planning nudge", junk notes "@" "/head", raw-id channels) from the 328/335 hammering — not product bugs, but a `rm -rf tests/dogfood/.data` before the next eyeball session would make captures cleaner.

## Session 328 — "check every button" full-product interaction sweep (2026-06-22)

A deliberately exhaustive interaction sweep across **all 20 first-party apps** —
the widest yet. For each app it opens the window, then drives every interactive
affordance a user could click (header buttons, object ⋯ / popup menus,
sidebar/nav controls, and in-content buttons) and asserts the interaction
INVARIANTS (`tests/dogfood/lib/invariants.ts`): every menu opens AND dismisses
on **both** Escape and an outside-press leaving no click-trapping overlay; every
button produces an observable effect; no interaction wedges the app behind a
lingering overlay. Spec: `tests/dogfood/sessions/328-every-button-sweep.spec.ts`.
**32 menus + ~200 buttons probed across 20/20 apps.** Net result after fixes:
**zero stuck-overlay (hanging-menu) findings anywhere.**

The sweep initially surfaced 5 "stuck overlay" findings (Graph ×4, Files ×1).
Triage resolved all 5 — one real (mis-classified panel), the rest harness
artifacts that exposed two real gaps in the shared interaction-invariant harness:

### F-275 — Graph history scrubber is a `role="dialog"` that the interaction harness reads as a stuck overlay
- **session:** 328-every-button-sweep   **kind:** bug   **app:** Graph   **status:** ✅ done (2026-06-22)
- **what happened:** the Graph "Show history playback" toggle opens the bottom-left scrubber panel (`II 1× Eased … 0/0`), an intentionally persistent, non-modal docked control that stays live while you drag the time slider. It was `role="dialog"` with **no `data-permanent`**, so the now-standard interaction-invariant sweep classified it as a transient overlay that must auto-dismiss — and (correctly) reported that it traps clicks and never closes on Escape/outside-press. Four findings (one per scrubber button) all pointed at this one panel.
- **what I expected:** a persistent docked panel should not be treated as (or semantically be) a transient modal dialog.
- **fix (2026-06-22):** marked the scrubber `aria-modal="false"` + `data-permanent` (`apps/graph/src/app.tsx`). This is both correct a11y (it is a non-modal surface) and the harness's documented signal for "intentional persistent surface, not an auto-dismissing overlay". +1 unit test (`apps/graph/src/app.test.tsx`) locks the attributes in. Verified real-shell: Graph now passes the sweep with zero stuck findings.
- **evidence:** `tests/dogfood/.sessions/328-every-button-sweep/` (graph shots).

### F-276 — interaction harness false-flagged shared `<Popover>` dismissal (Files sort)
- **session:** 328-every-button-sweep   **kind:** bug (test harness)   **app:** Files / dogfood harness   **status:** ✅ done (2026-06-22)
- **what happened:** the sweep reported the Files **Sort/View** popover as not dismissing on an outside press (`esc=true, outside=false`). A focused repro (`328b-files-sort-dismiss.spec.ts`) proved the popover **does** dismiss on a backdrop press — it was a harness bug. Two causes: (1) `probeMenuTrigger` keyed "opened" solely on `.fm-menu`, so a trigger opening a shared `<Popover>` (a full-viewport modal whose centred panel is small) looked like it "never opened" yet left a surface up → false stuck; (2) `clickOutside` computed its outside-point from the **root** rect (the whole viewport for a modal `<Popover>`) instead of the actual panel, so the press landed unpredictably.
- **fix (2026-06-22):** `tests/dogfood/lib/invariants.ts` — `probeMenuTrigger` now recognises `.fm-menu` **and** `.bs-popover`/`.popover`/non-permanent dialogs as "the menu", so popover-opening triggers get the full dismiss cycle; `clickOutside` now presses a point outside every interactive **panel** rect (hitting the backdrop/dimmer), reliable for full-viewport modals. Also sharpened `probeButton`'s dead-button detector (element count + `aria-selected/current/expanded` + input count + a 650ms async-IPC settle window) to cut false positives. These harden the shared harness used by every sweep (321 included).
- **note on the 35 `[?]` "possible dead button" signals:** spot-verified representative ones in source — all false positives: Code Editor "New" (`createNewFile` — real, async-IPC create lands after the snapshot), Tasks "New project" (`onCreateProject` — real), Graph "Zoom out"/"Reset view" (canvas-transform only, no DOM signal by design), and the Journal/Calendar mini-calendar day cells. No genuinely-dead button found.

## Session collab-002 — three-way live collaboration through the sync service (2026-06-20)

Ran two live two/three-shell collab sessions to verify multiple agents collaborate
in real time through the sync relay service:
- `collab-001-mira-marcus-share` — Mira shares a brief with Marcus; both co-edit; Mira revokes. **PASS** (8.9s).
- `collab-002-three-way-live` (new) — Mira shares with Marcus **and** Priya; all three co-edit concurrently; Mira revokes Marcus. **PASS** (18.1s).

Each shell is a separate real Electron process with its OWN sovereign identity +
theme + vault, all connected to one standalone `@brainstorm/relay-server`
process (`ws://`) — the sync service. Evidence the traffic genuinely transited
the relay: `collab-002…/relay-audit.log` shows 20 ciphertext frames (16
`update` + 4 `wrap-bootstrap`) **fanned out to three distinct connections** (9 to
Marcus, 9 to Priya, 2 to Mira), and the final persisted text —
`"North star — Q3. [mira: ship Oct 14] [marcus: 3 hero layouts] [priya: framing = jobs-to-be-done]"`
— is byte-identical across all three shells. The relay holds no key (relay-blind)
so it relays ciphertext only.

### F-274 — live collaboration works through the relay, but not yet inside the app UIs
- **session:** collab-002-three-way-live   **kind:** gap   **app:** shell / sync   **status:** ✅ done (2026-07-08 — the in-product Share UX shipped as 0.2.0 "Sharing & permissions": ShareDialog + roles + revoke + F-288 viewer enforcement, over the 10.12 live-sync path. Deferred to backlog: F-286 rotate-on-revoke (needs DEK rotation) + presence avatars)
- **UPDATE (2026-06-26, via collab-005):** this entry was stale — its first half is **done**. Part (1) "no always-on auto-sync of app-UI edits" was **resolved by `10.12` (LiveSyncEngine, landed 2026-06-22)**: the normal entities-service edit path now auto-emits shared-entity updates (echo-free; solo edits stay off the relay). What remains open is part (2) — **the in-product Share UX (`Collab-C5`)**: granting/revoking access is still only reachable via the `dev:collab` bridge, not a real "Share" affordance. Collab-005 also surfaced what C5 must carry: Viewer read-only enforcement ([[F-288]]), rotate-on-revoke for real forward secrecy ([[F-286]]), and re-grant-after-revoke ([[F-287]]). Narrowed from "gap" to the C5 build.
- **what I was trying to do:** have two+ agents co-edit the *same note in the Notes app*, live, and see each other's typing.
- **what happened:** the C4 collaboration subsystem (share/grant/encrypted-relay/converge/revoke) works end to end through the standalone relay service — proven live with 2 and 3 shells. But two pieces of the "in the app UI" experience are not yet wired: (1) **no always-on auto-sync of app-UI edits** — `encryptAndEmit` (ydoc update → relay) is called only by explicit bridges (collab-dev-bridge, pairing, soak), not by the ydoc-store persist path, so typing in the live Notes editor does not auto-emit to the relay; (2) **no in-product share UI** — granting access is only reachable via the `dev:collab` bridge, not a real "Share" affordance. So today the working real-time path is the C4 bridge over the relay; the app-UI co-editing layer (an always-on sync worker that emits every shared-entity update, plus the C5 in-product Share UI) is the next stage.
- **what I expected:** open a shared note in Notes on two shells and watch edits flow both ways.
- **evidence:** `tests/dogfood/.sessions/collab-002-three-way-live/` (relay-audit.log + per-shell shots); spec `tests/dogfood/collab/002-three-way-live.spec.ts`.
- **triage (developer, 2026-06-20):** confirmed by tracing the emit callers — the relay/CRDT half is done and verified live; the always-on sync worker + C5 in-product Share UI are unbuilt and are the work that makes collaboration visible *inside* each app. **Boundary note:** the sync relay correctly lives in the **product / sync plane** (`@brainstorm/relay-server`, relay-blind, deployable as its own service). It must **not** move into the `brainstorm-cloud` commercial control-plane repo — that repo's own CLAUDE.md states the hard invariant *"never holds vault content … no relay traffic, no CRDT."* "The brainstorm-cloud sync service" is therefore this relay deployed as a standalone cloud service, not code inside the commercial repo.

## Session 320 — deep "Today" walkthrough (2026-06-20)

A focused dogfood loop on the Tasks **Today** surface — the product's daily
driver. The seeded Northbound vault lands nothing in Today, so the session
manufactures the state Today is supposed to show (a task scheduled today, an
open task scheduled in the past) and checks the Overdue/Today bucketing, the
sidebar count badge, completion, and the Show-completed toggle. Spec:
`tests/dogfood/sessions/320-deep-today.spec.ts`.

### F-273 — past-scheduled open tasks pile up under the literal "Today" heading
- **session:** 320-deep-today   **kind:** bug   **app:** Tasks   **status:** ✅ done (2026-06-20)
- **what I was trying to do:** open Today to see what I actually need to do now.
- **what happened:** Today showed **"OVERDUE · 1"** then a "TODAY" section stuffed with ~27 tasks dated **"2 Jun" / "4 Jun" / "6 Jun"** — work I'd *scheduled* days ago and never finished. Only the one task with a passed *due* date counted as overdue; everything scheduled-but-slipped silently rolled into "Today" with a dim grey date chip, so the "Today" heading was a lie and the handful of genuinely-today tasks were buried.
- **what I expected:** a scheduled day that has already passed is just as "overdue" to me as a missed deadline — it should surface under **Overdue**, with the date chip styled like an overdue date, not hide under "Today".
- **evidence:** `tests/dogfood/.sessions/320-deep-today/02-01-today-initial.png` (before-fix capture showed "OVERDUE · 1" over a wall of "2 Jun" rows under TODAY).
- **triage (developer, 2026-06-20):** confirmed in the real shell. Root cause: `isOverdue` keyed **only** on `dueAt < now`, so an open task with a past `scheduledAt` and no due date was neither overdue nor future — and the Today-surface partition (`compile-surface.ts`) plus the row/inspector chip styling both keyed off that deadline-only predicate, dropping such tasks into the "Today" section with a plain date chip. **Fix:** added a shared `isPastDue(task, now)` in `apps/tasks/src/logic/task-status.ts` = passed deadline **OR** an open task scheduled before the start of today (the `< startOfToday` boundary keeps tasks scheduled earlier *today* in Today). The Today Overdue partition, the row's `data-overdue` flag, and the inspector now all use this one definition, so a row shown under "Overdue" always reads as overdue (red `date-overdue` chip). **Verified real-shell (session 320 re-run):** the wall of past rows moved to **"OVERDUE · 27"** with red date chips; only genuinely-today work sits under "TODAY"; sidebar badge, completion, and Show-completed all still pass (`02-01-today-initial.png` after fix). +1 compile-surface test, +3 task-row tests; 404 tasks tests green.

## Session 311 — Sol's first day: interaction & accessibility sweep (2026-06-20)

Mira's fourth hire, **Sol Reyes** (Interaction & Accessibility Engineer), ran
their onboarding sweep — no artifact, just *driving* affordances across 9 apps
(Notes, Database, Tasks, Calendar, Files, Contacts, Bookmarks, Journal,
Preview): accessible-name audit on every header control, a 22-step keyboard
tab-walk checking focus is reachable *and visibly indicated*, hover feedback,
the object ⋯ menu open→Escape cycle, and `prefers-reduced-motion`. 45
screenshots in `tests/dogfood/.sessions/311-sol-interaction-a11y-sweep/`.
Broadly healthy — every header control has an accessible name (0 unnamed across
all 9 apps), focus is keyboard-reachable everywhere, Escape closes menus, motion
honors the OS preference. Two findings below; one systemic.

### F-270 — keyboard focus is invisible on almost every control in 8 of 9 apps
- **session:** 311-sol-interaction-a11y-sweep   **kind:** bug   **app:** SDK / all apps   **status:** ✅ done (2026-06-20)
- **what I was trying to do:** tab through each app with the keyboard to see where focus is.
- **what happened:** only **Notes** shows a focus indicator. Database, Tasks, Calendar, Files, Contacts, Bookmarks, Journal and Preview render **no visible ring** as I tab through their headers, toolbars and sidebars — I lose track of where I am the instant I stop using the mouse. A keyboard or switch user cannot operate these apps with confidence (WCAG 2.4.7 Focus Visible, Level AA).
- **what I expected:** a clear focus ring on every interactive element on keyboard focus, consistent across apps.
- **evidence:** `07-database-02-focus-ring.png` (no ring) vs `02-notes-02-focus-ring.png` (pink ring on the focused row); same `[FAIL] … focus visible` verdict for 8 of 9 apps in `notes.md`.
- **triage (developer/Kai, 2026-06-20):** the **same** global `:focus-visible, :focus { outline: none !important }` anti-pattern lived in **three** places, each killing all focus rings (and beating the no-`!important` per-component opt-ins, so the SDK's own rings were dead code): `packages/sdk/src/app-theme.css` (all apps), `packages/editor/src/editor-theme.css` (the editor-hosting apps — Journal/Tasks/Bookmarks, which is why those three stayed broken after the first pass), and `packages/shell/src/renderer/styles.css` (the dashboard/start-menu/window-strip/settings — not in Sol's app sweep but the identical bug). Fix in all three: **mouse-only suppression** (`:focus:not(:focus-visible){ outline:none }`) plus a **baseline keyboard ring scoped under `:root`** (`:root :focus-visible{ outline:2px solid var(--color-focus-ring); outline-offset:-2px }`) — the `:root` gives it (0,0,2,0) so it survives the single-class `outline: none` resets some components carry (`.bs-date-pager__arrow`, `.bookmarks__nav-btn`), while prose contenteditables keep their own `:focus-visible{ outline:none }` opt-out so typing has no ring. Verified real-shell (three rebuild→re-run cycles of 311): **8/9 apps now show a ring on all 22 keyboard stops** (Notes, Database, Tasks, Calendar, Contacts, Bookmarks, Journal, Preview); the only residual is Files' `div:Resize sidebar` drag-handle (see F-272). Evidence: `32-bookmarks-02-focus-ring.png` (red ring on the row ⋯, was 22/22 missing).

### F-271 — header ⋯ is disabled on open with no indication why
- **session:** 311-sol-interaction-a11y-sweep   **kind:** design   **app:** Tasks, Bookmarks   **status:** ✅ done (2026-06-23)
- **what I was trying to do:** open the object ⋯ menu in the header right after opening the app.
- **what happened:** clicking the header ⋯ did nothing. It's *disabled* until there's an active object (`createMoreButton(…, { disabled: true })` in `bookmarks/src/ui/header-right.ts`), but it looks identical to an enabled control and offers no hover tooltip explaining why — so it reads as a dead button.
- **what I expected:** either the ⋯ is hidden when there's nothing to act on, or it stays enabled and explains (tooltip / disabled-reason) what it needs.
- **evidence:** `14-tasks-04-menu.png`, `34-bookmarks-04-menu.png` (no menu surface after the click).
- **resolution (developer, 2026-06-23):** decided **explain, not hide** (the ⋯ is "never absent" so its trailing-edge spot stays stable across object/no-object states). Root cause of "no indication": both the React `ObjectMenuMoreButton` and the imperative `createMoreButton` set the **native `disabled` attribute**, and a natively-disabled button emits **no hover/focus events**, so its `data-bs-tooltip` never fired. **Fix (shared SDK, both twins):** use `aria-disabled` (keeps it hoverable + focusable; click/key handlers + the delegated container handler skip an aria-disabled ⋯) + a new optional **`disabledReason`** that becomes the tooltip (falls back to the action label). Tasks passes `t("tasks.menu.moreDisabled")` = "Open a task or project to see its actions". So the dimmed ⋯ now explains itself on hover/focus and announces `aria-disabled` to AT, while still never opening. +2 SDK tests (React + imperative); 76 object-menu tests green; tasks typecheck + lint clean. Fixes every app using the shared ⋯ (Tasks, Bookmarks, Files, code-editor, agent, …).

### F-272 — Files sidebar resize handle takes keyboard focus but shows no ring
- **session:** 311-sol-interaction-a11y-sweep   **kind:** design   **app:** Files   **status:** ✅ done (2026-06-23)
- **what I was trying to do:** tab through Files after the F-270 fix landed.
- **what happened:** every button now rings, but one tab stop — the `div` "Resize sidebar" drag handle — is keyboard-focusable yet shows no focus ring (and a drag handle isn't keyboard-operable anyway). Same shape as the journal/notes resize handles, which carry an explicit `outline: none` opt-out.
- **what I expected:** either the handle isn't a tab stop (it's a pointer-only affordance), or it's keyboard-operable with arrow keys *and* shows a ring.
- **evidence:** `notes.md` `[FAIL] files focus visible — 1/22 … div:Resize sidebar`.
- **resolution (developer, 2026-06-23):** decided **keyboard-operable + ringed** (the handle already IS operable — the shared `useResizable` binds ←/→ to move, Home/End to snap, dbl-click to reset; so it correctly stays a tab stop). The gap was purely the missing ring: every handle's per-app CSS opts out of the outline (a thin inset outline reads poorly on a ~6px bar). **Fix:** one shared rule in `@brainstorm/sdk/app-theme.css` — `[role="separator"][aria-orientation="vertical"]:focus-visible { box-shadow: 0 0 0 2px var(--color-focus-ring) }` — a clearly-visible box-shadow ring (independent of the `outline:none` opt-outs) that covers **every** resize handle across Files / Notes / Journal / … in one place. **Verified real-shell** (`tests/dogfood/sessions/333-f272-resize-ring-verify.spec.ts`, real Electron Files renderer): the handle exists, is a keyboard-operable separator (`tabindex=0`), and the shipped focus-ring rule (`box-shadow: 0 0 0 2px …`) matches it — so a keyboard user gets the ring the 311 sweep's own check (`boxShadow !== "none"`) registers. css-token gate + lint clean.

## Session 309 — code-level polish sweep, all 19 apps + shell + SDK (2026-06-19)

A static design-rubric audit across every app (no real-shell run — the live
shell is already verified healthy through sessions 303–308). Five parallel
read-only auditors hunted for the concrete, rule-backed defects: dead/no-op
affordances, header-chrome drift, phantom CSS tokens, bespoke menus / native
`<select>`/`datetime-local`, missing `t()` on visible faces, inline plural
ternaries, reactivity-loop violations, and icon-glyph mismatches. The apps are
**broadly clean** (zero phantom tokens, zero header-flex re-declarations, zero
reactivity violations); the audit surfaced a focused set of genuine, fixable
issues — all fixed this session. Gates: `typecheck:apps` + `build:apps` clean
(no type-strip traps), all touched app suites green, css-token + reactivity
ratchets clean.

**Broken / non-working (fixed):**
- **F-261 — Whiteboard board back/forward buttons were permanently dead.** The
  header `<NavButtons>` was fed an app-local history nothing ever pushed to
  (`onNavigate` a no-op), while the engine maintained a *separate*, never-consumed
  board history with `applyingNavHistory` hard-coded `false`. Wired the engine's
  real history through `boardNav()`/`goBoardBack`/`goBoardForward`/`applyBoardLocation`
  (guarded so applying a history step doesn't re-push); removed the dead app-local
  state. +5 engine-nav tests.
- **F-262 — Contacts vCard export/import failed silently.** Both call sites dropped
  the optional `notify` arg, so the five toast strings (`vcard.exported`/`exportFailed`/
  `importNone`/`imported`/`importFailed`) were dead — a failed import or "no contacts"
  did nothing visible. Wired `runtime.services.ui.notify` exactly as Calendar does. +4 tests.
- **F-263 — Automations showed a permanently-disabled ⋯.** A `disabled`
  `ObjectMenuMoreButton` placeholder (no object context) read as a live-but-broken
  button. Now renders no ⋯ when there's nothing to act on.
- **F-264 — Shell vocab color picker was a hand-rolled `<div role="menu">`.** Bypassed
  the shared menu runtime (no anchoring/flip/shift, no shared keyboard model).
  Converted to `openAnchoredMenu` off the trigger; dropped the manual toggle state +
  dead CSS. +1 test (asserts it opens the runtime menu, not a bespoke div).
- **F-265 — Form-designer couldn't delete saved forms.** No delete/rename anywhere —
  junk forms were permanent. Added `entities.delete` to the runtime + a per-row ⋯ /
  right-click "Delete form" through the shared menu runtime, gated by a confirm. +2 tests.

**Bad design / visible (fixed):**
- **F-266 — Automations used a native `<input type="datetime-local">`** for the reminder
  due date (the prohibited OS-native pattern F-229 removed from Tasks/Calendar).
  Replaced with the shared calendar popover + `.bs-select` time. +3 tests.
- **F-267 — Mailbox used the dashboard Pin glyph for the email Flag feature** → swapped
  to `IconName.Star` in all four sites; also gave SMTP TLS its own key and killed a
  `#fff` body flash on dark themes.
- **F-268 — Browser:** the overflow menu wore a settings-gear glyph (→ neutral overflow
  glyph), "Clear browsing data" gave no feedback (→ `role="status"` confirmation), and
  native `title=` / un-hidden emoji defeated the tooltip chip + a11y (→ `data-bs-tooltip`/
  `aria-label`/`aria-hidden`).
- **F-269 — Books reader controls used native `title=`** (which the `.bs-tooltip` host
  skips) → `data-bs-tooltip` on Prev/Next, Aa, and all highlight swatches/actions.
- **Visible untranslated English (→ `t()`):** Graph connection-editor enum options
  ("out/in/both", "required/optional/forbidden") + inspector "Name"; Preview image-zoom
  HUD + inline plural + a nav-chevron used as the empty-state hero; Code-editor baked
  diagnostic messages; Files "File"/"Note" type labels + three inline plural ladders;
  Notes link-markup "Note" literal (+ `friendlyTypeName` fallback); Journal word-count
  plural ternary (+ deleted the dead, never-imported `header-right.ts`); SDK shared
  date-cell "Previous/Next month" aria-labels threaded through the labels seam.
- Fixed a stale pre-existing red test: `preview/manifest.test.ts` asserted *all* opens
  SECONDARY, contradicting F-257 (Preview is the *primary* ephemeral `application/pdf`
  opener). Test now encodes the F-257 intent.

**Real-shell verification (Electron 41.7.0, specs `309-polish-verify` + `309b-whiteboard-nav-verify`):**
all PASS. Whiteboard (F-261): created a 2nd board → back **enabled** → clicked back →
returned "Untitled whiteboard" → "Your first sketch", forward then enabled (the dead
buttons now work end-to-end). Automations (F-266): `input[type=datetime-local]` count **0**,
shared `.au-capture__due-trigger` present. Browser (F-268): "Clear browsing data" →
`role=status` shows **"Browsing data cleared"**. Books (F-269): 6 reader controls carry
`data-bs-tooltip`, **0** native `title`. Form-designer delete + mailbox flag-star not driven
live (need a seeded saved form / connected account) — covered by unit tests
(`app.delete.test.tsx`, mailbox suite) + structural presence. Review battery (code /
design / security / pentest / perf / leak) clean; one design nit fixed in the same pass —
the browser overflow ⋯ wore a drag-grip glyph (`dots-six-vertical`), so added a proper
`IconName.More` (`dots-three-vertical`, all 6 weights) and pointed the menu at it; plus
the automations due-clear `×` → `<Icon Close>` and a raw-rem → `--space-5` token.

## Session 308 — deep functional verification round 4, real Electron (2026-06-19)

Extended live-CRUD coverage to the last reliable untested creates. Spec:
`tests/dogfood/sessions/308-deep-functional-verify-4.spec.ts`.

- **Bookmarks add:** Add bookmark → URL → submit → cards **1 → 2**. Works.
- **Contacts create:** New contact → name → Enter → rows **0 → 1**; the new
  "Dogfood Contact 308" renders with avatar, detail pane, and the
  Properties/Comments right panel (`308-deep-verify-4/04-ct-02-after-create.png`).

Console clean. No defects. This completes deep-CRUD coverage of the data apps
(notes, journal, tasks, calendar, files, database, bookmarks, contacts) +
theme-editor + code-editor across sessions 303–308 — every create/edit flow
works in the live shell.

## Session 307 — journal "Link an entry" (F-237 re-examination), real Electron (2026-06-19)

Drove the journal entry-linking flow now that the journal is React. Spec:
`tests/dogfood/sessions/307-journal-link-entry-verify.spec.ts`.

**F-237 → ✅ done — both halves work:**
- **Insert:** "Link an entry" → anchored calendar picker (`.bs-cal-popover`) →
  pick a day → a "@<day>" mention chip lands in the body (`[data-entity-id]`
  4→6; body shows "@ Saturday, 20 June 2026").
- **Click-navigate:** clicking that chip routed the journal "Friday, 19 June" →
  "Saturday, 20 June 2026" (`JournalMentionClickPlugin` → open-entity → the
  journal's own Entry opener focuses the day).

(Selector note for the harness: the sidebar mini-calendar and the picker popover
both render `.bs-cal-month__cell` — scope day-cell picks to `.bs-cal-popover` or
you navigate instead of link.)

## Session 306 — journal body persistence (F-251 re-examination), real Electron (2026-06-19)

Drove the exact F-251 repro now that the journal React migration has landed.
Spec: `tests/dogfood/sessions/306-journal-persistence-verify.spec.ts`.

Wrote a marker into today's body (`__brainstormJournalDev.appendParagraph`),
navigated to the previous day, returned to today (re-mount + cold re-hydrate),
and the body **re-rendered the seeded welcome content + the marker** (len 148,
no Lexical `#83`, clean console). **F-251 + F-236 (same root cause) → ✅ done** —
the React migration stabilised the editor host, so the detach/reattach that
stranded Yjs hydration no longer happens. (Low-confidence cosmetic note: "0
words" / "No entry yet" shown while the body had content — likely correct
empty-day template behaviour + a dev-hook artifact, not the blank bug; flagged
for a real-typing follow-up.) F-237 (journal mention-chip click) is separate and
remains open — its insertion path can't be driven via the dev hook.

## Session 305 — deep functional verification round 3, real Electron (2026-06-19)

Continued the live-CRUD pass. Spec: `tests/dogfood/sessions/305-deep-functional-verify-3.spec.ts`.

- **Database "+ New" (CRUD):** the toolbar `#toolbar-new` button → create→type→Enter
  handoff (F-215) → data rows **3 → 4**. Create works. (First attempt mis-targeted
  the grid foot row, which is the **aggregation summary** ("N rows"), not a create
  affordance — fixed the spec to use `#toolbar-new`.)
- **Notes body edit (F-251 control):** new note → `__brainstormNotesDev.appendParagraph`
  → body contains the marker. The notes editor accepts and renders body text — the
  working control proving the journal F-251 blank-body is journal-mount-specific,
  not a shared-editor problem.

Console clean. No defects.

## Session 304 — deep functional verification round 2, real Electron (2026-06-19)

Continued the live-CRUD pass. Spec: `tests/dogfood/sessions/304-deep-functional-verify-2.spec.ts`; evidence `tests/dogfood/.sessions/304-deep-verify-2/`.

- **Calendar create (resolves F-258):** New event → titled → Save. The dialog
  defaulted to today, the **Events** sidebar count incremented 1→2, and the
  event landed on today — collapsed into the month-view **"+2 more"** overflow
  (so it's present but not a top-level `.cal-chip`). The old `chips=0` reading
  was a harness counting artifact; event creation + placement work. F-258 → ❎
  not a bug.
- **Files new folder (CRUD):** New → New folder → content rows **1 → 2**. Works.

Console clean. No defects.

## Session 303 — deep functional verification, real Electron (2026-06-19)

Beyond the 302 surface sweep — this one DRIVES real interactions and captures
the outcome, to verify recently-shipped fixes live and exercise CRUD. Spec:
`tests/dogfood/sessions/303-deep-functional-verify.spec.ts`; evidence:
`tests/dogfood/.sessions/303-deep-verify/` (notes + screenshots).

**All three checks passed in the live shell:**
- **F-240 (Theme-editor save):** named a theme → clicked **Save theme** → status
  read **"Theme saved."**, and the theme then **appears in the picker**
  ("Dogfood Verify Theme"). Save + persist + list all work. Closed.
- **F-238 (Code-editor rename/delete):** the file row's context menu offers
  **Open / Pin to dashboard / Rename / Remove** — the rename + delete
  affordances are live. Closed.
- **CRUD create (Tasks):** New task → typed a title → Enter → the list went from
  **0 → 1** task. Create works end-to-end.

No defects surfaced. The shipped fixes are confirmed in the real shell; both
F-240 and F-238 flip from "re-verify pending" to ✅ done.

## Session 302 — credential-free functional sweep, all apps, real Electron (2026-06-19)

Fresh real-shell sweep over every app that works without external credentials
(Mailbox OAuth + the Agent generate flow skipped; Agent still opened for its
idle state). For each app: open → settle → idle shot → fire the primary "+/New"
header action → open the trailing ⋯ → cycle panel toggles, capturing each.
Evidence: `tests/dogfood/.sessions/302-credfree-sweep-a/` and `…-b/`
(`notes.md` + screenshots + renderer/main `console.log`). Spec:
`tests/dogfood/sessions/302-credfree-functional-sweep.spec.ts`.

**Headline — the apps are healthy.** All 18 boot, render real data, and paint
their primary surfaces. **Group A (notes, database, tasks, calendar, journal,
graph, whiteboard, files, bookmarks, contacts) is renderer-console-clean.**
Every app measured the canonical header (44px, shared `app-header__title`
14px/600); every primary "+/New" action is present and fires; the object ⋯
menus open **populated** (verified by screenshot — Database: Open / Pin /
Copy embed link / Export / Remove; Theme-editor: Preview across shell / Edit
in Code Editor). The `items=0` reading in every `notes.md` ⋯ line is a
**spec selector miss** (the menu-item class isn't `.bs-object-menu__item` /
`[role='menuitem']` in this build), **not** an empty menu — confirmed against
the captured screenshots, per the "zero match = selector miss" rule.

The only console signal was a single benign 404 (see F-260). No new product
defects: this corroborates sessions 239/246 — the app surface is in good shape.

### F-260 — Notes app-icon 404s once on a freshly-seeded vault's first paint
- **session:** 302-credfree-sweep-b   **kind:** bug?   **app:** shell/dashboard   **status:** ◑ low-confidence (likely fresh-seed startup race; self-heals)
- **what happened:** the dashboard logged a single `brainstorm://app-icon/io.brainstorm.notes?v=0.1.0` → **404** on the first paint of a brand-new vault. No other app's icon 404'd.
- **what I expected:** the Notes icon to resolve like every other app's.
- **evidence:** `302-credfree-sweep-b/console.log` (`[dashboard] http404: brainstorm://app-icon/io.brainstorm.notes?v=0.1.0`).
- **triage (developer, 2026-06-19):** **not a missing asset** — `notes/manifest.json` declares `"icon": "icon.svg"` and the file IS present in the installed bundle (`<vault>/apps/io.brainstorm.notes/0.1.0/icon.svg`), same as every peer. The dev seeder rebuilds+reinstalls all first-party apps on boot, and the dashboard paints its pin grid concurrently; the earliest-requested icon (Notes) can hit the `brainstorm://app-icon` handler in the window where `AppsRepository.getActive` resolves a record whose bundle is mid-reinstall → a one-shot 404 that the renderer falls back from (initials) and that self-heals on the next paint. Same class as the long-closed F-006/F-007 fresh-vault races. Only reproduces on a *brand-new* vault's first boot, never on a warm one. Logged for a future look (debounce the icon request until seed completes, or have the seeder finish before the dashboard requests icons); deliberately not patched blind — a single benign transient 404 isn't worth a startup-ordering change without confirming it recurs.

## Session 255 — live-use polish + team build sessions (235–238), real Electron (2026-06-18)

Two streams folded together: (1) issues spotted in live use of the Graph and the
Files→Books open path; (2) a clean four-persona team build run (Mira operating hub
· Priya cited evidence brief · Dana operations system · Marcus brand+theme) — all
4 passed, all console-clean, **14 live cross-app transclusions composed**, and
the old **F-240 theme-save now succeeds** ("Theme saved."). The team run surfaced
one soft calendar observation; the 228-deep sweep earlier the same day surfaced
the AI empty-state gap. Three live-use items were fixed in the same turn.

### F-255 — the Graph "Export" button wears an "open external link" icon
- **session:** live use / 236-priya-evidence-brief   **kind:** design   **app:** Graph   **status:** ✅ done (2026-06-18)
- **what I was trying to do:** export the graph view from the header.
- **what happened:** the export button used the box-with-up-right-arrow glyph — the universal "open in another app / go to a URL" icon — so it read as *open external*, not *export*.
- **what I expected:** a download/export glyph, matching the Export row already in the header ⋯ menu.
- **evidence:** user screenshot (Graph header + Selected-node panel).
- **triage (developer, 2026-06-18):** `GraphIcon.Export` was mapped to `"open-external"` (`apps/graph/src/ui/icons.ts`). Remapped to `"download"` so the header button and the ⋯-menu Export item (`IconName.Download`) agree. Graph typecheck + build clean.

### F-256 — Graph "Selected node" panel showed "Seeded by: brainstorm-seed" and "View: list"
- **session:** live use   **kind:** bug   **app:** Graph   **status:** ✅ done (2026-06-18)
- **what I was trying to do:** inspect the selected node ("foundations").
- **what happened:** the inspector listed internal plumbing as if it were my editable properties — **"Seeded by: brainstorm-seed"** (internal seed provenance) and **"View: list"** (collection chrome).
- **what I expected:** only real, user-facing properties — nothing internal.
- **evidence:** user screenshot.
- **triage (developer, 2026-06-18):** the editable-fields builder (`apps/graph/src/logic/inspector-fields.ts`) iterated every scalar property minus a small denylist; the leaked key is `__seededBy` (`SEED_PROVENANCE_KEY`). Fix: skip any `__`-prefixed key (the reserved/internal convention) + added `view`/`source`/`kind` (collection chrome) to the denylist. Regression test added (`__seededBy` + `view` filtered); 7/7 green.

### F-257 — opening a PDF from Files silently added it to my Books library
- **session:** live use   **kind:** design   **app:** Files / Books   **status:** ✅ done (2026-06-18; real-shell verify pending)
- **what I was trying to do:** open/glance at a PDF from the Files app.
- **what happened:** it opened in Books **and minted a permanent `Book/v1`**, so the PDF appeared in my Books library/reading list even though I only wanted to look at it once.
- **what I expected:** opening ≠ adding to a library — a quick ephemeral preview, like Quick Look.
- **evidence:** reported in live use.
- **triage (developer, 2026-06-18):** both Books and Preview claimed `open`/`application/pdf` at *secondary* priority, so the resolver fell to install order and Books won (`intents-bus.ts` `pickOpenerAppId` — primary wins, else first row). Made **Preview the `primary` `open` opener for `application/pdf`** (`apps/preview/manifest.json`): a plain open now previews ephemerally (creates nothing); Books keeps its *secondary* opener as the explicit **"Open with → Books"** read-and-keep path. 122 affected tests green; typecheck/lint/build clean. **Remaining:** real-shell confirm (open a PDF from Files → previews, no Book row) — needs a full shell restart to re-seed the manifest.

### F-258 — Dana created a calendar event but no date chip rendered
- **session:** 237-dana-operations-system   **kind:** bug?   **app:** Calendar   **status:** ❎ not a bug (harness artifact — verified live, session 304)
- **what I was trying to do:** schedule "Ship Issue #1" while systematizing operations.
- **what happened:** the event was created (the session passed), but the harness counted `chips=0` — no date/event chip showed in the checked view.
- **what I expected:** the new event to render as a chip in the calendar.
- **evidence:** `tests/dogfood/.sessions/237-dana-operations-system/03-03-calendar-dialog.png`, `04-04-calendar.png` + notes (`calendar event "Ship Issue #1" chips=0`).
- **triage (developer, 2026-06-19):** **reproduced the create flow live and confirmed it's a harness counting artifact, not a missing chip.** Session 304 drove New event → titled it → Save: the dialog defaulted STARTS to today, the **Events** sidebar calendar incremented 1→2 (so the event persisted), and the event landed on today's cell — but month view collapses a busy day's extra events into a **"+N more"** affordance, so the event is present but *not* rendered as a top-level `.cal-chip`. The `chips=0`/`chips↓` reading is the harness counting only un-collapsed chips and missing the overflow bucket. Event creation + placement work; closing as not-a-bug. (`304-deep-verify-2/02-cal-02-after-create.png` shows "Journal" + "+2 more" on the day the event was added.)

### F-259 — with no AI model configured, the Agent errors instead of offering setup
- **session:** 228-deep-agent   **kind:** gap   **app:** Agent   **status:** ◑ partial — error guidance fixed; full pre-send onboarding empty-state still deferred (11.3/11c)
- **what I was trying to do:** ask the Agent a question on a fresh environment (no local model, no cloud key).
- **what happened:** every send returned **"Something went wrong generating a reply. (Ollama unreachable…)"** — an error, not guidance. The headline AI flow can't be reached without first configuring a provider, and nothing tells me to.
- **what I expected:** a graceful "connect a model / add a provider key" empty-state before I can send — not an error after.
- **evidence:** `tests/dogfood/.sessions/228-deep-agent/notes.md`.
- **triage (developer, 2026-06-19):** the raw "Something went wrong (Ollama unreachable)" symptom is gone — the agent loop now forces `kind: "Unavailable"` on a failed generate (`app.tsx` turn path) and the plain-chat path propagates the SDK `Unavailable` error, so failures hit the actionable branch, not the generic fallback. **But that branch hard-coded the Ollama hint for *every* provider** — a cloud-key-missing failure wrongly told the user to run `ollama serve`. **Fixed:** `unavailableMessage(provider)` (`apps/agent/src/app.tsx`) now branches — local (`ollama`) → "is Ollama running? `ollama serve`…"; a cloud provider → "Couldn't reach {provider}. Check that its API key is set in Settings → AI…" (provider named via the `provider.<id>` catalog, bare-id fallback); AUTO (shell-routed) → general "pick / set up a provider". 4 unit tests in `app.test.tsx` cover the branches. **Still deferred:** the *pre-send* onboarding empty-state that detects "no provider reachable" before the user even sends needs a provider-readiness query the `AiService` doesn't expose yet (no `providers()`/`status()`) — that's the 11.3/11c onboarding piece, design-gated, not built blind here.

## Session 246 — deep functional sweep, all 18 apps, real Electron (2026-06-17)

Re-ran the `228-deep-<app>` driven sweeps over all 18 apps against the
production build, after the import-track + mid-flight close-out work landed.
Evidence: `tests/dogfood/.sessions/228-deep-*/` (per-app `notes.md` verdict log +
screenshots + renderer `console.log`).

**Headline — the apps are healthy.** All 18 open, render real data, and paint
their primary surfaces (spot-confirmed Calendar, Books, Journal, Whiteboard).
**17/18 are renderer-console-clean** after filtering environment noise (macOS
`task_policy_set` QoS denials; Agent's "Ollama unreachable" with no local model
server; the spec's `northbound.example` DNS failures; DevTools/Autofill). The
high `[FAIL]` counts in several `notes.md` (Calendar 15, Notes 15, Whiteboard
19, Tasks 11) are **stale-spec drift, not broken features** — the session-228
specs assert old selectors (e.g. Calendar's native `datetime-local` inputs +
old source names) that the apps have since evolved past (custom date picker;
the 9.15.23 catalog-driven CALENDARS sidebar). Screenshot-verified.

### F-253 — window visibility broadcast crashed on a torn-down tab view
- **session:** 228-deep-books / 228-deep-form-designer   **kind:** bug   **app:** shell (window-container)   **status:** ✅ done (2026-06-17)
- **what happened:** the Books + Form-designer deep sweeps logged a recurring main-process error `TypeError: Cannot read properties of undefined (reading 'isDestroyed')` at `sendVisibility → broadcastVisibility → BaseWindow hide/show`. The app UI still rendered fine (it's a hide/show lifecycle race, not a render blocker).
- **evidence:** `tests/dogfood/.sessions/228-deep-books/console.log` (line 33)
- **triage (developer, 2026-06-17):** a tab's `view.webContents` can be **undefined** (not merely destroyed) when the view is torn down while the window still fires a hide/show visibility event; `sendVisibility`/`sendStripVisible` guarded only `isDestroyed()`, not the reference. Guarded the whole `webContents` reference. Regression test asserts a visibility broadcast survives a tab whose webContents was nulled (fails with the exact TypeError before the fix). Commit `741a87f9`.

### F-254 — Tasks logged a `replaceChildren` DOM race on an edit-blur
- **session:** 228-deep-tasks   **kind:** bug   **app:** Tasks   **status:** ✅ done (2026-07-08, shell PR #117 — the blur→re-render race fixed at all inline-edit sites: restore DOM synchronously, defer the reactive commit via queueMicrotask so blur settles before `replaceChildren`)
- **what happened:** a single renderer `pageerror`: `Failed to execute 'replaceChildren' on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?` — a transient DOM mutation race when a re-render `replaceChildren`s a node that a blur handler moved. Non-fatal (the app keeps working).
- **evidence:** `tests/dogfood/.sessions/228-deep-tasks/console.log` (line 31)
- **triage / resolution (2026-07-03, shell PRs #94 + #96):** `vaultEntities.list()` accepts `{types, limit}` threaded shim → parent proxy → preload → handler; validation/filtering is pure (`ipc/widget-list-query.ts`). Every widget now passes its typed query (module-level const) so no widget ships the whole vault. Bonus: a scoped-read app (Books) is admitted through a typed query covering its grants — the old handler flatly demanded `entities.read:*` (which would have blocked the Books widget outright). Verified in 375c (Books widget renders, not capability-denied).

## Session 239 — fresh design + functionality sweep, real Electron (2026-06-15)

A full real-process pass over all 18 apps against the accumulated Northbound
vault (a forked copy of the persistent dogfood vault), capturing each app's
idle state, header face, and the trailing object ⋯ menu *opened* (so a dead/
empty menu shows in the shot, not just inferred). Evidence:
`tests/dogfood/.sessions/239-fresh-sweep-a/` and `…-b/`.

**Headline — the apps are in good shape.** Every app opens, renders real data,
and its primary affordances work. The fresh pass **confirms a batch of prior
findings as fixed** in the live shell: F-229 (Tasks *and* Calendar new-item
dialogs now use the design-system date picker + `.bs-select` time, no native
`dd/mm/yyyy`), F-230 (graph labels declutter — only the priority labels show,
no smear), F-231 (Browser title measures as the shared `app-header__title`
face), F-232 (Form Designer header is 44px), F-233 + F-244 (Files sidebar:
folder *and* storage rows both use the accent-soft selection, no grey pill),
F-234 (Graph carries a trailing ⋯ with view actions; single-surface React apps
correctly carry only the ⋯). Header title face is 14px/600/shared across all 18.

The one **new, reproducible defect** is the empty-state ⋯ (see F-249).

**Functional CRUD pass (sessions 228-deep-notes + 228-deep-database, re-run 2026-06-15):**
drove real create / edit / view / menu flows. Every `[FAIL]` line in these two
walkthroughs was confirmed a **harness artifact, not a product bug**, by reading
the captured screenshots + the apps' unit tests: (1) Database's FAILs (`+New`,
name-edit, filter/sort, new-collection shapes, header ⋯) are selector drift —
the screenshots show the new-collection menu opening with all three shapes, the
inspector rendering full properties incl. real Created/Updated dates, rename +
view-switching working (`228-deep-database/17-11a-new-list-menu.png`,
`20-13-header-more-menu.png`). (2) Notes' FAILs (markdown `1.`/`[]`/`>`/```/`---`,
inline-code, mention insertion) are the long-standing "Playwright can't drive the
Yjs-bound Lexical body" limit — the transformers are registered in `editor.tsx`'s
`MarkdownShortcutPlugin` and covered by green unit tests
(`markdown-block-transformers.test.ts`, `typing-shortcuts.test.ts`). No product
regression in either app.

### F-249 — the object ⋯ is dead the moment Journal and Books open
- **session:** 239-fresh-sweep   **kind:** design   **app:** Journal / Books   **status:** ✅ done (2026-06-15)
- **what I was trying to do:** open the header overflow menu right after opening the app.
- **what happened:** Journal opens on **today** (an empty entry until you write) and Books opens on the **library** (no book selected). In both, the trailing ⋯ is *disabled* (`disabled` is wired on the no-object state), so clicking it does nothing — and a disabled ⋯ at 0.35 opacity reads as a live-but-broken button (this is exactly the original F-227 / F-228 report). So the very first state each app shows has a dead-looking ⋯.
- **what I expected:** the ⋯ to behave like Graph's — always offering at least *view-level* actions (Graph's ⋯ has Fit / Reset / Export / Filters / Settings even with no bound record). A trailing ⋯ that anchors the header's right edge in every app shouldn't be inert in an app's default state.
- **evidence:** `239-fresh-sweep-a/13-journal-02-more-menu.png` (no menu after click), `239-fresh-sweep-b/16-books-02-more-menu.png` (no menu after click); Graph for contrast: `239-fresh-sweep-a/15-graph-02-more-menu.png` (6-item menu).
- **triage (developer, 2026-06-15):** supersedes F-227 + F-228. Both apps *correctly* disabled the object-scoped ⋯ when no entity is bound — the gap was that neither offered the *view-level* actions that would make the ⋯ live in its default state. **Fix shipped:** Journal's empty-day ⋯ now opens a view-actions menu — a **Start with a template** section (Daily review / Gratitude / Free write, each mints the focused day's entry), Go-to-today (when off today), and Export (`createEmptyDayMoreButton` in `apps/journal/src/app.ts`, wired into `renderJournalHeader`'s no-entry branch). Books' no-selection ⋯ now opens **Import a book** + show/hide library (`libraryViewActions` + a custom header ⋯ in `apps/books/src/app.tsx`, mirroring Graph's `openObjectMenu`-with-extras / `openAnchoredMenu` split). Object-scoped actions still apply when an entry/book *is* bound (the view actions append as object-menu extras). **Verified real-shell (session 240):** Journal ⋯ opens a 5-item menu, Books ⋯ a 3-item menu — `240-verify-empty-more/01-journal-more-open.png`, `02-books-more-open.png`. Regression test: `apps/books/src/app.test.tsx` ("header ⋯ is live … when no book is selected (F-249)").

## Session 244 — right-panel (inspector / properties / comments) sweep (2026-06-15)

An under-tested surface: the right panel only populates once an entity is
SELECTED, so idle screenshots miss it. Drove it across every app that has one —
selected an entity, opened the inspector, captured + measured the panel, and
switched to the Comments tab on the prose apps. Evidence:
`tests/dogfood/.sessions/244-right-panel-a/` and `…-b/`.

Mostly healthy: Database's inspector renders the cover band + real property
values (Priority, Scheduled, Created/Updated dates, Assignee chip) + Open /
Quick Look; Books' inspector measured clean (44px head, 14/600 title, cover
108/shrink-0, 4 rows, 0 empty values); the Journal Comments tab works (composer
+ "No comments yet"); Tasks opens a well-laid-out detail (Blocked by / Tags /
Time / Repeat / Subtasks). The one clear cross-app defect is F-252.

### F-252 — the right panel shows "Properties" TWICE (tab + panel header)
- **session:** 244-right-panel   **kind:** design   **app:** Notes / Journal   **status:** ✅ done (2026-06-15)
- **what happened:** in the prose apps the right panel has a tab strip ("Properties | Comments"); the Properties tab then renders the shared `PropertiesPanel`, which draws its OWN `.bs-props__head` titled "Properties" + a × close — so "Properties" appears twice, stacked, with a redundant close (the Comments tab has no such inner header, so the asymmetry is obvious).
- **what I expected:** one "Properties" label. The tab strip IS the header.
- **evidence:** `244-right-panel-a/02-notes-02-comments.png`, `05-journal-01-panel.png` (both show the doubled header); `06-journal-02-comments.png` (Comments tab, single header — the contrast).
- **triage (developer, 2026-06-15):** `CommentsRightPanel` (`packages/editor/src/comments/right-panel-tabs.tsx`) renders the tab strip and then the host's `properties` node, which is `<PropertiesPanel title="Properties">` → its own head. **Fix shipped:** added `hideHeader?: boolean` to the shared `@brainstorm/sdk/properties-panel`; Notes (`apps/notes/...`) and Journal (`apps/journal/...`) pass `hideHeader` whenever the panel is hosted inside the comments tab strip (and keep their own header in the standalone, no-comments-adapter case). The app-header Show/Hide-properties toggle still closes the panel, so dropping the inner × loses nothing. Verified real-shell (session 245): both apps show the Properties tab with **zero** inner `.bs-props__head`.

### F-251 — journal entry body renders BLANK on reopen (data is intact on disk)
- **session:** 242-journal-persistence   **kind:** bug   **app:** Journal   **status:** ✅ done (fixed by the journal React migration; verified live, session 306)
- **resolution (developer, 2026-06-19):** F-251's own triage named the fix as "the journal's pending React migration … stabilize the editor host so it is never re-parented while mounted." That migration has since landed — the journal is now a React app (`apps/journal/src/app.tsx`; the imperative `app.ts` is gone), and the body editor mounts in a stable host that the render loop no longer rebuilds, so the detach/reattach that stranded the Yjs hydration can't happen. **Verified live (session 306):** wrote a marker into today's body via `__brainstormJournalDev.appendParagraph`, navigated to the previous day, returned to today (forces an editor re-mount + cold re-hydrate from the Y.Doc) — the body re-rendered the **seeded welcome content + the marker** (innerText len 148, marker present), with **no Lexical `#83`** and a clean console (`306-journal-persistence/03-journal-03-back-to-today.png`). The blank-on-reopen symptom is gone. (The "0 words" / "No entry yet" seen alongside body content in 306 is a **dev-hook artifact, confirmed not a bug**: `wordCount` is a persisted entity property derived from the body by `apps/journal/src/logic/denormalize-entry.ts` (`denormalizeBody(state) → update(noteId, { body, wordCount })`) on the editor's real onChange — the `__brainstormJournalDev.appendParagraph` hook writes the Y.Doc body but bypasses that onChange/denormalize path, so the persisted count stays stale. Real typing recomputes it.)
- **what I was trying to do:** open a journal day that already has body content (created earlier — a template-minted entry / a prior day's writing).
- **what happened:** the editor body renders **completely empty** even though the entry plainly still exists — the word-count reads "9 words", the ALL ENTRIES list shows the entry by its first heading, and the on-disk `journal-2026-06-15.ydoc` (816 bytes) contains the text ("What went well today? What was hard? Tomorrow's focus"). So the data persisted; the editor just shows nothing.
- **what I expected:** the body to hydrate from its Y.Doc on reopen, like Notes does.
- **evidence:** `tests/dogfood/sessions/242-journal-persistence.spec.ts` (`test.fixme`, fails: `body after REOPEN renders heading: false (len 1)`), screenshots `242-journal-persistence/02-02-template-minted.png` (entry chrome + "9 words" but empty editor). **Control:** `243-notes-persistence.spec.ts` PASSES — Notes cold-loads a pre-existing note's full body on reopen, same resolver + `<BrainstormEditor>` + `applyPending`/`whenLoaded` wiring.
- **triage (developer, 2026-06-15):** **Not persistence** (Y.Doc on disk is complete) and **not the core CRDT/resolver** (Notes is fine through the identical path). It is **journal-specific**: the journal is an imperative-DOM app that mounts the body editor as a `createRoot` island and, in its `render()` loop, recreates the body `host` and **re-parents the editor host (`host.appendChild(entryEditorHost)`) on every repaint** — which races the editor's async Yjs hydration (`@lexical/yjs` populates Lexical via `observeDeep` fired by the snapshot apply inside `LocalProvider.connect`; a detach/reattach in that window strands the apply → blank). `BlankRecoveryPlugin` is supposed to catch "Y.Doc has blocks, Lexical has none" and remount — but the remount can't recover here because the resolver returns the **same already-applied doc** for a still-referenced entry (no fresh `observeDeep` events), so it exhausts its 2-attempt budget and stays blank. **Verified NOT the body re-seed** (`entry.seedBody` re-injection): removing it did not change the blank. **Fix direction:** stabilize the journal's editor host so it is never re-parented while mounted (keep the editor in a persistent container the `render()` loop doesn't rebuild) — i.e. the journal's pending React migration, or a scoped mount rewrite. Deliberately NOT patched blind: the editor mount is load-bearing and a wrong change blanks every day. Tracked for a focused follow-up.

### F-250 — Files' "+New" opens a centred dialog, not an anchored menu
- **session:** 239-fresh-sweep (+ 241 interaction probe)   **kind:** design   **app:** Files   **status:** ✅ done (2026-06-15)
- **what I was trying to do:** create a new folder/file from the header **+**.
- **what happened:** the + opened a **centred modal popover** ("New folder / New file") floating in the middle of the window, disconnected from the + button that opened it — a hand-rolled `<Popover role="menu">` (`NewMenuPopover`). Every other app opens this kind of "pick one of N" choice as a fancy-menu **dropping from the trigger** (Database's "+" / the LISTS "+", the object ⋯ menus, etc.).
- **what I expected:** an anchored fancy-menu under the + button, per the standing rule "every menu / dropdown / 'pick one of N' popup uses the shared fancy-menus runtime — a hand-rolled popover standing in for a menu is rejected."
- **evidence:** `227-functional-sweep-a/26-files-05-toggle.png` (the centred "New" dialog), contrasted with `228-deep-database/17-11a-new-list-menu.png` (Database's + drops an anchored menu).
- **triage (developer, 2026-06-15):** confirmed — `NewMenuPopover` was a `<Popover>` standing in for a 2-item menu, rendered centred. **Fix shipped:** the + button now opens an `openAnchoredMenu` (New folder / New file, anchored to the button, `MenuAlign.End`) through the same fancy-menus runtime Files already mounts for its object ⋯; removed `NewMenuPopover`, its `newMenuOpen` state, and the orphaned `.new-menu` CSS (`apps/files/src/app.tsx`, `ui/dialogs.tsx`, `styles.css`). The shared runtime owns anchoring/keyboard/theming. SortMenuPopover stays a Popover (it's a multi-control view-settings *panel*, not a simple menu — same call as Database's grid-settings popover). Verified real-shell (session 240): the menu opens anchored under the + (left edge past the viewport mid-line, not centred).

## Session 238 — Marcus builds the brand & crafts the theme (2026-06-14)

Product-artifact turn (Marcus, design) — completes full team coverage. He
produced the brand artifact AND encoded it: a **"Northbound — Brand & Design
System"** spec note (voice / palette / typography / usage), and then crafted the
brand in the **Theme Editor** — set `--color-background-primary` to deep ink
`#0b1020` and `--color-accent-default` to a signal blue `#5b8cff`, named it
**"Northbound"**, and saved (status "Theme saved."). The live preview repainted
to the new accent (`03-03-tokens-edited.png`, `04-04-theme-saved.png`); the brand
doc transcludes the HQ hub so the brand threads into the operating system. This
exercised the Theme Editor — an app none of the prior three turns touched.

**No new product friction.** One harness lesson (see F-248, corrected above):
the brand doc and Dana's 237 playbook both persisted as **"Untitled"** because
their titles were set via synthetic `keyboard.insertText`, which bypasses the
`AutosavePlugin`'s interaction gate (`KEY_DOWN`/`PASTE`/`CUT`/`DROP`) — so the
title never denormalized to the entity property. Their bodies are intact (Y.Doc
layer 1); only the list-row/header title (layer 2) is missing. A real user
(typing or Cmd+V paste) trips the gate normally, so this is purely a synthetic-
harness artifact. Future turns set titles via `keyboard.type` + verify/retry.

## Session 237 — Dana systematizes Northbound's operations (2026-06-14)

Product-artifact turn (Dana, ops & growth). On the persistent vault she built an
operating SYSTEM, not just docs: a **"Northbound Operations — the system"**
playbook note (publishing cadence / renewal chain / pipeline hygiene) that
**transcludes Mira's HQ hub and Priya's evidence brief**, the recurring chores as
**3 Tasks**, and — her core surface, exercised for real — an **Automations
workflow from a template + a captured reminder** ("Renewal nudge — advisory
clients (14-day window)", confirmed in the Reminders list, tagged Tomorrow ·
Upcoming). Captures in `tests/dogfood/.sessions/237-dana-operations-system/`.

**Headline: deep composition works.** The playbook showed **8 nested
transclusions** — it transcludes the hub and the brief, which in turn transclude
*their* sources (thesis, this-week, the three evidence notes), all rendering
recursively inline. Three turns of artifacts now thread into one operating doc
across Notes + Tasks + Automations.

**No new product friction this turn.** Two non-product notes:
- **F-246 — confirmed fixed in the real shell.** This boot logged **zero**
  wallpaper/thumb errors (was an error every boot) — the lazy-mint healed the
  persistent vault on first request, as designed. Closed.
- **Harness note (Calendar selectors stale).** Dana's "Ship Issue #1" event
  opened the New-event dialog and filled the title fine, but didn't save: the
  spec reused 228-deep-calendar's selectors, which are now stale — the date
  control is a **custom date-picker + a `.bs-select` time dropdown** (not a
  `datetime-local` input), and the **Save button is a sibling of `.cal-detail`,
  not inside it**, so the save click missed and the dialog stayed open
  (`03-03-calendar-dialog.png`). The dialog itself is well-formed; this is a
  test-selector fix for the next Calendar-touching turn, **not** product friction.

## Session 236 — Priya builds a cited evidence brief (2026-06-14)

Product-artifact turn (Priya, research editor): on the persistent vault (Mira's
235 hub + thesis present), Priya wrote three source/finding notes then a **"Why
the wedge works — evidence base"** brief whose body **transcludes each source
under the claim it backs** (the citation renders live inline) and links back to
Mira's investment thesis. The composed brief landed cleanly — 4 transclusions,
each claim followed by its evidence
(`tests/dogfood/.sessions/236-priya-evidence-brief/01-01-brief-top.png`,
`02-02-brief-bottom.png`). The Graph rendered a surface too (`03-03-graph.png`).
The knowledge-layer composition seam (transclusion-as-citation) works well. Two
things surfaced.

### F-246 — (follow-up) completed: the residual wallpaper-thumb 404 is gone (lazy-mint)
- **session:** 236-priya-evidence-brief   **kind:** bug   **app:** shell/dashboard   **status:** ✅ done (2026-06-14)
- **what happened:** the 235 fix removed the dangerous `ERR_UNEXPECTED` main-process throw, but the renderer **still logged a benign `404` every boot** for the default wallpaper's missing `.thumb.jpg` blur-up underlay (`[dashboard] http404: brainstorm://wallpaper/stormy-sea.png.thumb.jpg` → `Failed to load resource: 404`). Still crying-wolf on the hot path, and the blur-up never worked for the default.
- **triage (developer, 2026-06-14):** completed the fix at the protocol chokepoint instead of the seed (which only helps *new* vaults — the persistent dogfood vault already existed and would never heal). The `brainstorm://wallpaper` handler now **lazy-mints** a missing `.thumb.jpg` from its original (reusing the exported `ensureThumbnail` from `dashboard-handlers.ts`) and serves it — so the miss becomes a `200`, the thumbnail exists for next time, and **every vault (new + existing) self-heals on first boot** with no boot-time work. Genuinely-absent files still degrade to a clean `404`, never an `ERR_UNEXPECTED`. Shell rebuilds clean, `typecheck:packages` + 13 wallpaper unit tests green. Real-shell console confirmation folds into turn 237's boot (the persistent vault mints the thumb on that boot).

### F-248 — typing a note title immediately after "New note" drops the first several characters
- **session:** 236-priya-evidence-brief   **kind:** bug   **app:** Notes   **status:** ✅ resolved — confirmed harness (2026-06-14, corrected in session 238)
- **what I was trying to do:** create source notes and name them right away.
- **what happened:** titles typed right after clicking "New note" lost a *variable* run of leading characters — sidebar shows `"atency in operator teams"` (from "Source — Decision latency in operator teams", **19 chars dropped**), `"— Newsletter-to-advisory…"` ("Source " dropped), `"hy the wedge works (evidence base)"` ("Brief — W" dropped); one title ("Source — What operators pay…") survived intact. `tests/dogfood/.sessions/236-priya-evidence-brief/01-01-brief-top.png` (sidebar).
- **what I expected:** the whole title to land.
- **triage (developer, 2026-06-14):** the note title is NOT a separate input — it's a `TitleNode` *inside* the Lexical editor, so per-char `keyboard.type` right after New-note races the Yjs/Lexical binding and drops leading chars (like the body-typing race). **First "fix" (session 237) was WRONG — corrected in 238:** I switched the harness to `keyboard.insertText(title)`, which landed the title *visually* in the editor H1 but left the note **"Untitled" in the sidebar/header** (Dana's 237 playbook + Marcus's 238 brand doc both persisted untitled). Root cause: the `AutosavePlugin` that denormalizes `title`/`snippet` to the entity properties is **interaction-gated** — `markTouched` fires only on `KEY_DOWN_COMMAND` / `PASTE_COMMAND` / `CUT_COMMAND` / `DROP_COMMAND` (`packages/editor/src/plugins/autosave-plugin.tsx`), to suppress mount/hydration echo writes. `keyboard.type` trips it (real keydowns); synthetic `keyboard.insertText` dispatches an `input` event that trips *nothing*, so layer-2 denormalization never runs and the title property stays empty (the body still persists via the Y.Doc transport, layer 1). **This is HARNESS-only, NOT a product bug: a real user typing OR pasting (Cmd+V → `PASTE_COMMAND`) trips the gate fine** — only a synthetic `insertText` (which no human generates) slips through. **Correct harness rule:** set titles with `keyboard.type` (trips the gate → title denormalizes) + a verify-and-retry to defeat the leading-char drop (the retry's keydowns warm the binding); use the `__brainstormNotesDev` hook only for the body. Do NOT use `insertText` for titles. No product change.

## Session 235 — Mira rebuilds the Northbound operating hub (2026-06-14)

Product-artifact turn (not a sweep): on a fresh vault, Mira wrote the investment
thesis + a "this week" plan in Notes, then built a **Northbound HQ** hub note
whose body **transcludes both source docs live** (the thesis renders inline in
the hub, not a copy), filed the week's three deliverables as real Tasks, and
went to log the day in Journal. The hub + transclusion + tasks all landed
cleanly (`tests/dogfood/.sessions/235-mira-operating-hub/03-03-hub.png`,
`04-04-tasks.png`); the cross-app composition seam (Notes transclusion) works.
Two things surfaced.

### F-246 — the dashboard logs an error on every boot for the default wallpaper's missing thumbnail
- **session:** 235-mira-operating-hub   **kind:** bug   **app:** shell/dashboard   **status:** ✅ done (2026-06-14)
- **what I was trying to do:** just open my workspace.
- **what happened:** every dashboard boot logs `[main:err] Error: net::ERR_FILE_NOT_FOUND` and the renderer records `requestfailed: brainstorm://wallpaper/stormy-sea.png.thumb.jpg (net::ERR_UNEXPECTED)`. Nothing visibly breaks (the full wallpaper still loads — F-007), but it's a crying-wolf error on the hot path.
- **what I expected:** no error on a clean boot.
- **evidence:** console in `tests/dogfood/.sessions/235-mira-operating-hub/console.log`
- **triage (developer, 2026-06-14):** root cause = the dashboard requests a `.thumb.jpg` blur-up underlay for the wallpaper (`wallpaperThumbUrl`), but the **seeded default wallpaper has no minted thumbnail** (thumbs are minted on upload, and the seed copies the png raw). The `brainstorm://wallpaper` protocol handler did `return net.fetch(file://…)` directly, so a missing file **rejected out of the async `protocol.handle` callback** → surfaced as `ERR_UNEXPECTED` to the renderer + an `ERR_FILE_NOT_FOUND` main-process error each boot. Fix (`packages/shell/src/main/index.ts`): wrap the wallpaper file fetch in try/catch and return a clean `404` on miss — the optional thumb now degrades silently (the `<img>` underlay's `onerror` handles absence) instead of throwing. The full wallpaper exists so it's unaffected. Shell rebuilds clean; 13 wallpaper unit tests green. Real-shell console verification folds into the next turn's boot (re-running 235 would duplicate Mira's data — vault hygiene). The same `net.fetch`-without-catch pattern exists in the sibling `icon`/`cover` branches; left as a scoped follow-up since only the wallpaper thumb was surfaced.

### F-247 — (harness note, not product friction) Journal's empty-day editor isn't mounted until you start writing
- **session:** 235-mira-operating-hub   **kind:** design   **app:** Journal   **status:** triaged (harness nuance)
- **what happened:** the session's `__brainstormJournalDev.appendParagraph` returned `false` on today's empty entry — the day shows the template chooser ("Daily review / Gratitude / Free write" + "Start writing your entry…") and the Lexical editor (whose ref the dev hook captures) only mounts once the user starts writing or picks a template. `tests/dogfood/.sessions/235-mira-operating-hub/05-05-journal.png`.
- **triage (developer, 2026-06-14):** this is an **observation/harness artifact, not product friction** — a real user clicks into "Start writing your entry…" (or a template) and the editor mounts normally. The fix is on the *harness* side: a Journal-writing session must click the entry body (or a template chip) before calling the dev hook. Noted for the next Journal-touching session; no product change. (If anything, the empty-day template-first state is intentional UX.)

## Session 228 — deep per-app walkthrough across all 18 apps (2026-06-13)

A deep walkthrough per app (one self-asserting spec each, `tests/dogfood/sessions/228-deep-<app>.spec.ts`): every header control, menu item, CRUD path, **link-create-and-click**, view mode, and persistence, each emitting `[PASS]/[FAIL]/[?]` from observable DOM (see each session's `notes.md`). Triaged: a harness `[FAIL]` can be a selector miss or an undriveable native control — only confirmed product defects get an F-number below; the probable-but-unverified set (Calendar/Tasks dialog-create, Database CRUD, Files view-switch, Contacts property edits, Whiteboard tool activation) is logged in [`implementation-plan.md` → Dogfood cross-app findings backlog](../implementation-plan.md) pending real-shell confirmation. **Headline still holds: runtime is quiet; the issues are dead controls + missing affordances, not broad breakage.**

> **Fix pass — 2026-06-13 (9-agent fleet, one agent per app).** 13 findings across both sweeps taken to **code-complete + app-scoped green** (per-app `tsc` + `biome` + unit tests; workspace typecheck + CSS-token gate clean, no new lint/reactivity regressions). Each finding's `status` below is updated to `🟡 fix landed` with a one-line developer note. **Now real-shell verified** (see the verification block below — 12/13 confirmed against a clean-HEAD shell build, incl. the four manifest/host changes **F-228, F-238, F-240, F-242** which a fresh dogfood install re-grants from manifest); **F-237 alone remains unverified** (rests on unit tests). Untouched this pass: **F-228b** (EPUB reader, in-flight 9.21.2), **F-229** (native date pickers), **F-241** (Agent insert/link seam).
> - **F-227** Journal ⋯ — *no change needed*: the populated-entry ⋯ already opens the shared fancy-menu; the dead button was the empty-today state where a disabled affordance is intended. Confirm in shell.
> - **F-236** Journal body lost — mounted the editor's `BlankRecoveryPlugin` (Journal never had it) + a capped per-note remount nonce, backstopping the apply/observeDeep blank-render race on date switch / cold reopen.
> - **F-237** Journal mention — added app-local `JournalMentionClickPlugin` (capture-phase chip click → shared `dispatchOpenEntity`); insertion already produced a real MentionNode.
> - **F-228** Books ⋯ — runtime now exposes `capabilities` + `intents.dispatch`; new `asObjectMenuRuntime` gives the menu a live **Open** + **Remove from library** (was permanently-disabled/empty).
> - **F-238** Code-editor — **Rename** + **Delete** added to the shared object ⋯ / context menu (rename popover + `validateRenamePath`; persist via `entities.update`, soft-delete via `entities.delete` — both already capped).
> - **F-239** Form Designer — empty Create blocked: every fill field treated as required, inline `role="alert"` errors, focus first-invalid, `*` markers.
> - **F-232** Form Designer 45px — added the missing universal `box-sizing:border-box` reset (content-box + 1px border made the 44px header render 45px); no `.app-header` override existed to delete.
> - **F-240** Theme-editor Save — manifest was missing `write:brainstorm/Typography/v1` + the Typography/v1 entityType, so the fail-closed ledger threw and `catch {}` swallowed it. Added both + a manifest regression test.
> - **F-242** Contacts company — manifest now registers Contacts as the **Company/v1** opener + open-intent handler (the chip dispatched correctly but nothing handled it → dashboard fallback); landing surface filters people to that company.
> - **F-230** Graph labels — added pure unit-tested `declutterLabels` (greedy screen-space AABB suppression by priority: hovered > degree) wired into the Pixi label overlay.
> - **F-234** Graph ⋯ — added an always-present trailing object ⋯ (view actions Fit/Reset/Export/Filters/Settings; Open/Pin when bound to a Graph/v1 record), `MenuAlign.End`.
> - **F-231** Browser title — title span now carries the shared `app-header__title`; the per-app font/overflow fork is reduced to a single `max-width:none` delta.
> - **F-233** Files sidebar — the storage ("All media") row now binds `aria-selected` so it lights up accent-soft like folder rows (the accent rule already existed; the row wasn't opting in).
>
> **Real-shell verification (sessions 231 + 232, 2026-06-13):** 11/13 confirmed working against the live shell (screenshots in `.sessions/231-verify-fleet/` + `232-verify-fleet-b/`): F-227, F-228 (⋯ → Open + Remove), F-230 (labels declutter, no smear), F-231 (14px/600 shared face), F-232 (44px), F-233 (accent `aria-selected`, bg rgba(56,189,248,.16)), F-234 (⋯ opens Fit/Reset/Export/Filters/Settings), F-238 (Rename+Delete in the file menu), F-239 (empty-create blocked), F-240 (Save persists, theme listed, no error), F-242 (company chip no longer falls to the dashboard). **F-236 + F-237 remain manually-unverified** — Playwright can't drive the Lexical editor (`.type()` didn't land); they rest on their unit tests and need a manual click in the real shell.
>
> **Verification completed — clean-HEAD re-run + F-236 (2026-06-13).** Re-ran 231 + 232 in an isolated worktree built at the fix commit `5bf538ec` (no sibling working-tree changes) — **the 11 reproduce identically**, so the verdicts are the shipped code, not a contaminated build. Two of the earlier `[FAIL]`/`[?]` notes were **false-fails in the verify specs, not product defects**: (1) **F-228** — the 232 note read `items:[]` because it queried `.fm-menu`/`[role=menuitem]`, but the anchored menu renders as `.bs-object-menu` / `.bs-object-menu__item`; the screenshot (`.sessions/232-verify-fleet-b/01-01-books-menu-selected.png`) shows the live **Open + Remove from library** menu. ✅ (2) **F-236** — `editor.type()` never lands in the Yjs-bound Lexical body under headless Electron, so its precheck was false and it tested nothing. New session **234** (`234-verify-f236.spec.ts`) drives the body through the proper path (`window.__brainstormJournalDev.appendParagraph`), navigates to another day and back, and the marker **survives the round-trip** → ✅. Also re-ran 229/230/233: F-243 capture shows **no hard error**, calendar tabs 28px, files storage button transparent — all ✅. **Net: 12/13 real-shell verified + F-243.** The lone residual is **F-237** (journal mention-chip click) — its insertion path can't be set up via the dev hook, so it still rests on unit tests + a manual click. PDF teardown (`b822c7c1`) is unexercised (the dogfood vault holds no PDF). _Worktree run, never touched the persistent shell._

### F-244 — Files sidebar "All media" is a solid grey pill (super ugly, Midnight)
- **session:** live use (2026-06-13)   **kind:** bug   **app:** Files   **status:** ✅ done (grey-pill fix landed + verified session 233; `.sidebar__tree-row` resets `appearance`/`background`. Confirmed 2026-07-08)
- **what happened:** the storage "All media" row renders a solid native-grey rounded pill at rest, jarring against the transparent folder rows above it.
- **root cause:** `.sidebar__tree-row` is a real `<button>` for the storage row (folder rows are `<div>`s) and the base rule never reset `appearance`/`background` → native UA `ButtonFace` grey leaked through (same class of bug as the SDK `.bs-btn` ButtonFace leak, but on this app-local class). The earlier F-233 fix only addressed the *selected* state.
- **fix:** `appearance:none; background:transparent` (+ width/font/text-align) on `.sidebar__tree-row`. Session 233 confirms resting bg = `rgba(0,0,0,0)`.

### F-245 — Books (and Preview) crash on PDF teardown: "doc.destroy is not a function"
- **session:** live use (2026-06-13)   **kind:** bug   **app:** Books / Preview   **status:** ✅ done (2026-07-08, 0.2.2 — the pdf.js-v6 teardown fix [`openPdfDocument` overrides `doc.destroy` → the loading task's Promise `destroy`] is in place and now pinned by a regression test simulating the exact v6 proxy shape [shell `open-teardown.test.ts`]. Follow-up: seed a real PDF book for end-to-end dogfood coverage — no book/asset seeding exists yet)
- **what happened:** opening a PDF book throws into the error boundary ("Something went wrong — doc.destroy is not a function").
- **root cause:** pdfjs-dist 6.x **removed `PDFDocumentProxy.destroy()`** (the Promise teardown now lives only on `PDFDocumentLoadingTask`); `@brainstorm/sdk/pdf-engine`'s `openPdfDocument` returned the raw proxy cast to a type that still declared `destroy(): Promise<void>`, so `doc.destroy().catch()` threw. Same path in Preview's `pdf-renderer.ts`.
- **fix:** `openPdfDocument` keeps the loading task and exposes its `destroy()` on the returned document. Couldn't exercise in dogfood (the Northbound vault has no PDFs) — verify by reopening a PDF book / Preview-ing a PDF in the real shell.

### F-236 — I wrote today's journal entry, reopened the date, and my text was gone
- **session:** 228-deep-journal   **kind:** bug   **app:** Journal   **status:** ✅ done (same root cause as F-251; fixed by the journal React migration; verified live, session 306)
- **what happened:** typed a marker into today's entry, navigated away and back to today — the body no longer contained it. Yesterday's seeded body also didn't round-trip.
- **what I expected:** journal bodies persist across date navigation + reopen.
- **evidence:** `tests/dogfood/.sessions/228-deep-journal/notes.md` (`[FAIL] Reopen today — marker LOST on reopen`).
- **triage:** _(open — Journal writes only the body and is sensitive to the title=ISO-date contract; suspect a save/rebind gap on date switch. Reproduce in the editor save path.)_

### F-237 — I can't link from one journal entry to another (the link insert does nothing)
- **session:** 228-deep-journal   **kind:** bug   **app:** Journal   **status:** ✅ done (verified live, session 307 — both halves: insert + click-navigate)
- **what happened:** opening the link/mention picker and choosing a target did not insert a link chip into the entry — so the reported "linking an entry and clicking it does nothing" fails one step earlier, at insertion.
- **what I expected:** insert a link → it renders a chip → clicking it navigates to that entry.
- **evidence:** `228-deep-journal/notes.md` (`[FAIL] Insert link — no mention chip inserted`).
- **triage (developer, 2026-06-19):** drove the full flow live now that the journal is React. **Insert works:** "Link an entry" (`.journal__link-btn`) opens an anchored calendar picker (`.bs-cal-popover`); picking a non-today day inserts a "@<day>" mention chip into the current entry's body (`[data-entity-id]` count 4→6; the body shows "@ Saturday, 20 June 2026" — `307-journal-link/02-jl-02-after-link.png`). **Click-navigate works:** clicking that journal-entry chip routed the journal from "Friday, 19 June 2026" → "Saturday, 20 June 2026" (`JournalMentionClickPlugin` → `dispatchOpenEntity` → the journal's own `Entry/v1` opener focuses the linked day). The original "insert does nothing" was the pre-React-migration editor; both halves are now confirmed. (Earlier run mis-clicked the sidebar mini-calendar — both it and the popover render `.bs-cal-month__cell`; scope day picks to `.bs-cal-popover`.)

### F-238 — Code-editor has no way to rename or delete a file
- **session:** 228-deep-code-editor   **kind:** gap   **app:** Code-editor   **status:** ✅ done (verified live, session 303 — file context-menu offers Open / Pin / Rename / Remove)
- **what happened:** double-click does nothing; the file's object menu offers only Open / Pin (no Rename), and the row menu has no Remove/Delete — so `untitled*.ts` files pile up in the vault with no way to rename or remove them.
- **what I expected:** rename + delete affordances on a code file.
- **evidence:** `228-deep-code-editor/notes.md` (`[FAIL] Rename file`, `[FAIL] Delete test file`).
- **triage (developer, 2026-06-19):** shipped. The object menu now offers **Rename** (`renameFile` → SDK `.bs-popover` with `validateRenamePath`: rejects empty + duplicate paths, `RenameError` messaging) and **Delete** (`confirmDeleteFile` → confirm popover → `runtime.services.entities.delete` soft-delete), both wired as `onRename`/`onDelete` object-menu extras (`apps/code-editor/src/app.tsx:589-590`), each gated on the runtime exposing `entities.update`/`entities.delete` so older shells degrade gracefully. Real-shell re-verify pending (next batched run).

### F-239 — Form Designer creates an entity from a completely empty form
- **session:** 228-deep-form-designer   **kind:** bug   **app:** Form Designer   **status:** ✅ done (shipped; real-shell re-verify pending)
- **what happened:** on the Fill tab, clicking Create with every field blank still created a new Person ("Created a new Person.") — no required-field validation.
- **what I expected:** required fields block submission until filled.
- **evidence:** `228-deep-form-designer/notes.md` (`[?] Required-field validation (Create empty) — status = "Created a new Person."`).
- **triage (developer, 2026-06-19):** shipped. `requiredEmptyFields` (`apps/form-designer/src/logic/visibility-rules.ts:73`) computes the set of empty *visible* required fields; Create is blocked with `status.needsFill` ("Fill in the required fields before creating.") and each offending field shows `fill.fieldRequired` ("{name} is required."). Validation is correctly scoped to fields the user can actually see (a hidden-by-rule required field can't block submit). Real-shell re-verify pending.

### F-240 — Saving a theme fails ("Could not save the theme")
- **session:** 228-deep-theme-editor   **kind:** bug   **app:** Theme-editor   **status:** ✅ done (verified live, session 303 — Save → "Theme saved." + the theme lists in the picker)
- **what happened:** named a theme and clicked Save theme → status read "Could not save the theme."; the theme was not added to the picker and did not survive a reopen. Saving is the app's core action.
- **what I expected:** Save persists the theme + lists it in the select.
- **evidence:** `228-deep-theme-editor/notes.md` (`[FAIL] save theme — status="Could not save the theme."`, `[FAIL] persistence after reopen`).
- **triage (developer, 2026-06-19):** the 2026-06-13 finding predates theme-editor's React conversion (the reference conversion, 9.9.7). In the shipped React app the save path is fully wired (`apps/theme-editor/src/app.tsx` `onSave` → `saveTheme`/`saveTokenSet`/`saveTypography`/`saveStylePack`) and the manifest grants matching `entities.write` caps for every type it persists (`brainstorm/{Theme,TokenSet,StylePack,Typography}/v1`), so the original imperative-DOM gap is gone. **Separately fixed a real observability defect:** the `onSave` `catch {}` swallowed the error with no log, leaving any genuine save failure undebuggable (it just showed "Could not save the theme."). Now logs `console.error("[theme-editor] save failed", err)` before the status. Real-shell save→reopen re-verify still pending (next batched run).

### F-243 — Adding a valid link "couldn't be parsed" (it was the capture error blaming the link)
- **session:** live use (2026-06-13)   **kind:** bug   **app:** Bookmarks   **status:** ◑ partial (copy fixed; no-content split pending)
- **what I was trying to do:** add `https://ruyixuanhotpot.de/` as a bookmark.
- **what happened:** it read as "could not be parsed" — i.e. like the add failed.
- **what I expected:** the bookmark to be saved.
- **triage (developer, 2026-06-13):** **the URL parses + saves + captures fine** — verified two ways: `normalizeUrl("https://ruyixuanhotpot.de/")` → `"https://ruyixuanhotpot.de"` (not null), and a live probe (`230-probe-bookmark-url`) added it (list 6→7) and captured **3,444 chars** of readable content with **no error**. So the code path is sound; the reported failure was a **transient/environment content-fetch failure** surfacing the capture error **"Couldn't capture this page — check the link and try again."** — which wrongly blames the (valid, saved) link. **Fix shipped:** reworded to "Couldn't fetch this page's content — the bookmark is saved; try again anytime." (`apps/bookmarks/src/i18n/manifest.ts`), so a capture miss no longer reads as "the link is bad / wasn't added". **Follow-up:** `captureContent` still shows this same error for the *no-readable-content* case (a non-article landing page) — that should be an informational "saved as a link; no readable article found", not a retryable error. Tracked in the plan task table.

### F-242 — Clicking a contact's company opens the dashboard, not the company
- **session:** 228-deep-contacts   **kind:** bug   **app:** Contacts   **status:** ✅ done (2026-06-24)
- **what happened:** a contact's **Company** chip/link (e.g. "Acme Z104651") is a live link, but clicking it resolved to the dashboard (`…/renderer/index.html`) instead of opening the Company entity. The rest of the detail pane is fine — properties render with values, the contact created cleanly (so the batch's property-edit "timeouts" were harness selector misses, not real).
- **what I expected:** clicking the company opens that Company/v1 object (the graph already models Company as a real entity).
- **evidence:** `228-deep-contacts/10-10-company-opened.png`, `11-11-after-link-nav.png` + `notes.md` (`link navigation target url — file:///…/index.html`).
- **resolution (developer, 2026-06-24):** the chip dispatch (`openEntityRef → intents.dispatch({verb:"open", payload:{entityId, entityType}})`) and the manifest `Company/v1` opener were already correct — the 2026-06-13 fix pass closed the **cold-launch** path (`rt.launch.reason === "open-entity"`, verified fresh-launch sessions 231/232). The residual was the **already-running window**: clicking a company chip while Contacts is open dispatches `open`, the launcher *focuses the existing window* (so `rt.launch` never updates) and re-emits the intent on the `app:intent` channel — but Contacts subscribed to **no** runtime lifecycle events, so the open was dropped and the window stayed put (the dashboard `index.html` was the stale-build symptom of the same un-handled open). **Fix:** Contacts now subscribes to `rt.on("intent", …)` (mirroring Notes/Database) and resolves an inbound `open` through a new pure `resolveOpenTarget(entityId, entities)` — a Person selects directly, a Company (or a not-yet-loaded target, since Contacts only owns Company opens) lands on its people view, clearing any open person so the detail pane doesn't mask the landing. Added the `on?(event, handler)` lifecycle surface to `ContactsRuntime`. +6 unit tests (`logic/open.test.ts`: dispatch contract for company/person + null-safe no-op; `resolveOpenTarget` Person/Company/unseen). 120 contacts tests green; contacts `tsc`/biome/build clean. Real-shell reverify (running-window company click) folds into the next dogfood pass.

### F-241 — The Agent can't link to or insert into my notes
- **session:** 228-deep-agent   **kind:** gap   **app:** Agent   **status:** ✅ done (2026-07-18)
- **merged (2026-07-18):** shell PR #184 — user-gesture-only insert intent through the verb-scoped `intents.dispatch:insert` grant per `platform/75-agent-notes-seam.md`; owner security review passed.
- **what happened:** agent replies are plain text only — no affordance to cite/link a vault entity or insert a reply into a note. For a knowledge product the assistant should connect to the knowledge.
- **what I expected:** replies can reference vault entities and/or be inserted into a note.
- **evidence:** `228-deep-agent/notes.md` (`[?] no entity-link or insert-into-note affordance in any reply`).
- **triage:** _(was open — `11c`; note Ollama was unreachable this run so generation itself wasn't exercised — the gap is the missing seam, not the model.)_
- **resolution (developer, 2026-07-18 — design-first):** the seam was designed before code — **[platform/75-agent-notes-seam.md](../platform/75-agent-notes-seam.md)**: the Agent never writes note bytes; a target-addressed `insert` intent crosses the broker's verb-scoped `intents.dispatch:insert` ledger gate (fail-closed, denials audited, NOT in the default-grant set) and **Notes performs the append in its own sandbox** through its normal editor pipeline. v1 is **user-gesture only** — `insert` is deliberately not a model-callable tool, so no prompt injection can write a note. Built per the design (shell **PR #184**): per-reply **"Add to note"** → keyboard-navigable note picker → **insert-at-end** (citation links rewritten to `brainstorm://entity/…`, provenance line back to the conversation) or **link-this-chat**; Notes handles running-window + cold-launch delivery with a fail-closed refusal matrix (malformed / unknown note / **locked** → visible notice, never silent). +35 tests across sdk-types/shell/notes/agent incl. the capability-gate enforcement pair; i18n en+es. **PR held open for owner security review** (new capability surface — the general self-merge grant is overridden here). Real-shell dogfood (doc 75 `ANS-4`) pending merge.

## Session 227 — functional sweep across all 18 apps (2026-06-13)

Not a build-an-artifact session: an active app-by-app pass. For every app we
opened it, fired its primary "new/add" affordance, typed into whatever surface
appeared, opened the object ⋯ menu, toggled its view/panel controls, and
*measured* the `.app-header` + title face into numbers so cross-app drift falls
out objectively (evidence: `tests/dogfood/.sessions/227-functional-sweep-a/`
and `…-b/`).

**Headline — the good news first:** runtime is quiet. Across 18 apps the only
console noise was two benign CSP-directive warnings in Notes (`prefetch-src` /
`navigate-to` not recognized by this Chromium) and OS process-policy noise — no
pageerrors, no failed resources, no thrown exceptions. The core knowledge apps
(Notes, Database, Tasks, Calendar, Journal, Code-editor, Bookmarks, Files,
Whiteboard, Contacts, Agent) all *work* — create flows open, editors take input,
views switch. So this is **not** "half is broken." What it is: a handful of
dead controls and a layer of visual/interaction inconsistency between apps. The
header title face is the bright spot — 16 of 18 apps measured **identically**
(44px header, 1px bottom border, 14px / 600 / `app-header__title`).

### F-227 — Journal's header ⋯ "More actions" does nothing
- **session:** 227-functional-sweep-a   **kind:** bug   **app:** Journal   **status:** ✅ done (2026-06-15, via F-249)
- **what I was trying to do:** open the header overflow menu on today's entry (export / actions).
- **what happened:** the ⋯ "More actions" button looks live (normal enabled chrome), but clicking it opens no menu at all — the view is pixel-identical before and after the click. Compare Automations/Form-Designer/Database/Whiteboard, whose ⋯ open a proper fancy-menu in the same sweep.
- **what I expected:** a menu, or — if there genuinely are no actions in this state — a disabled affordance, not a live-looking button that silently no-ops.
- **evidence:** `227-functional-sweep-a/17-journal-01-open.png` vs `18-journal-04-more-menu.png` (identical).
- **triage:** _(open — likely an empty/unwired action set in the today-empty-entry state; either populate it or disable it.)_

### F-228 — Books' header ⋯ "More actions" does nothing
- **session:** 227-functional-sweep-b   **kind:** bug   **app:** Books   **status:** ✅ done (2026-06-15, via F-249)
- **what I was trying to do:** open the header overflow menu in the library view.
- **what happened:** same as Journal — ⋯ is a live-looking button that opens nothing on click (before/after screenshots identical). Reproduces in the empty-library state; needs a re-check with a book selected.
- **what I expected:** an actions menu, or a disabled button when there's nothing to act on.
- **evidence:** `227-functional-sweep-b/19-books-01-open.png` vs `20-books-04-more-menu.png` (identical).
- **triage:** _(open — same shape as F-227; the dead ⋯ pattern may be shared between these two empty-state apps.)_

### F-229 — Tasks & Calendar "New" dialogs use raw native date pickers
- **session:** 227-functional-sweep-a   **kind:** design   **app:** Tasks / Calendar   **status:** ✅ done (verified live, session 239)
- **what I was trying to do:** set a Scheduled/Due date on a new task and start/end on a new event.
- **what happened:** both dialogs drop in **native `<input type=date/datetime-local>`** controls — OS-chrome spinners with a `dd/mm/yyyy` placeholder and the browser calendar glyph. `dd/mm/yyyy` is the wrong order for an `en` build, and the control looks nothing like the polished date UI everywhere else (the journal/calendar mini-calendar, the shared Calendar property cell). Two date experiences in one product.
- **what I expected:** the design-system date picker, consistent format, consistent chrome — per the "enumerated/﻿typed inputs go through the shared cell, native `<select>` is rejected" convention; native date inputs are the same smell.
- **evidence:** `227-functional-sweep-a/09-tasks-02-new.png`, `13-calendar-02-new.png`, `15-calendar-04-more-menu.png`.
- **triage:** _(open — route both dialogs through the shared date/calendar property cell.)_

### F-230 — Graph node labels collide into an unreadable pile
- **session:** 227-functional-sweep-a   **kind:** design   **app:** Graph   **status:** ✅ done (verified live, session 239 — only priority labels show, no smear)
- **what I was trying to do:** read the graph on open.
- **what happened:** the labelled hub nodes near the centre overprint each other — "Q3 operating hub — live views", "Content Calendar", "Candidates", "Priya Nair" overlap so the text is a smear ("Co…ndar"). No label-collision avoidance / fade-at-density.
- **what I expected:** labels that declutter at this zoom (hide on overlap, or fade all but the hovered/important ones).
- **evidence:** `227-functional-sweep-a/19-graph-01-open.png`.
- **triage:** _(open — needs label-collision handling in the draw loop.)_

### F-231 — Browser's title is the one app that forks the shared title face
- **session:** 227-functional-sweep-b   **kind:** design   **app:** Browser   **status:** ✅ done (verified live, session 239 — `browser__tab-title` now carries the shared `app-header__title` face; see `apps/browser/src/styles.css:96`)
- **what I was trying to do:** (measurement) — confirm every app's header title is the shared face.
- **what happened:** 16/18 apps measured **14px / weight 600 / `app-header__title`**. Browser's title element is `browser__tab-title` — **not** the shared class — at **13.3px / weight 400**. It's the active-tab label, so it's a *different element*, but per the standing rule the title face must be the shared one in every app; Browser is the lone fork (exactly the drift the rule exists to stop).
- **what I expected:** the active-tab label to carry/inherit the shared title face, or a documented delta.
- **evidence:** `227-functional-sweep-b/12-browser-01-open.png` + measured header JSON in `…-b/notes.md`.
- **triage:** _(open — reconcile the tab-title face with `app-header__title`, or record the intentional delta.)_

### F-232 — Form Designer's header is 45px, one pixel off the 44px baseline
- **session:** 227-functional-sweep-b   **kind:** design   **app:** Form Designer   **status:** ✅ done (verified live, session 239 — `box-sizing: border-box` keeps the 1px border inside 44px; `apps/form-designer/src/styles.css:7`)
- **what I was trying to do:** (measurement) — header height across apps.
- **what happened:** every other app's `.app-header` measured exactly **44px**; Form Designer measured **45px**. One pixel, but it's the kind of baseline drift the fixed-44px panel-header rule exists to prevent.
- **what I expected:** 44px, like everyone else.
- **evidence:** measured header JSON in `227-functional-sweep-b/notes.md` (`"headerH":45`).
- **triage:** _(open — find the extra pixel, likely a border/padding override in form-designer's header CSS.)_

### F-233 — Files sidebar uses two different "selected" treatments
- **session:** 227-functional-sweep-a   **kind:** design   **app:** Files   **status:** ✅ done (verified live, session 239 — both folder + storage rows use `--accent-soft`; `apps/files/src/styles.css:362`)
- **what I was trying to do:** read which sidebar item is active.
- **what happened:** in the same sidebar, the selected **folder** row ("Vault") gets a blue accent-soft highlight, while the **storage** row ("All media") gets a flat **grey pill** — the old grey `--hover` active state we already swept away elsewhere. Two active-state visual languages stacked in one rail.
- **what I expected:** one selection treatment (accent-soft) for both sections — per the focus-ring/active-state token sweep (active = accent-soft, never grey).
- **evidence:** `227-functional-sweep-a/23-files-01-open.png`.
- **triage:** _(open — point the storage-row active state at the same accent-soft token as folder rows.)_

### F-234 — header composition drifts: nav + object ⋯ present in some apps, absent in others
- **session:** 227   **kind:** design   **app:** cross-app (Graph / Theme-editor / Automations / Mailbox / Form-designer)   **status:** ✅ done (resolved + verified live, session 239 — canonical skeleton: Graph carries a trailing ⋯ with view actions; single-surface React apps correctly carry only the ⋯, no Back/Forward)
- **what I was trying to do:** (measurement) — enumerate each app's header controls.
- **what happened:** the header-left **Back/Forward** nav is present in 11 apps (Notes, Database, Tasks, Calendar, Journal, Files, Bookmarks, Books, Contacts, Code-editor, Whiteboard) but **absent** in the single-surface React apps (Theme-editor, Automations, Mailbox, Form-designer). Separately, **Graph** carries neither Back/Forward nor the trailing object **⋯** menu that the standing header rule says every app ends its right group with — its header is an icon-only overlay (link/play/filter/settings/export). So "where's the overflow menu / can I go back" isn't answerable consistently across apps.
- **what I expected:** a documented, consistent header skeleton — either nav everywhere it makes sense, or an explicit rule that single-surface apps omit it; and the object ⋯ present (even Graph).
- **evidence:** the `controls:` lines in both sessions' `notes.md`; `227-functional-sweep-a/19-graph-01-open.png`.
- **triage:** _(open — decide the canonical header skeleton and bring the outliers onto it.)_

### F-235 — Browser page content area reads blank in capture (verify in real shell)
- **session:** 227-functional-sweep-b   **kind:** bug?   **app:** Browser   **status:** ✅ resolved — not a bug (2026-07-08). Confirmed architecturally: the Browser renders web content in a native `WebContentsView` (shell `index.ts`), which the renderer's screenshot cannot composite — so a capture shows chrome + a blank content area even though the page loaded (the tab title resolved). A capture-harness limitation, not a blank page; the page renders correctly in the real shell)
- **what happened:** the captured page shows the tab strip + URL bar + a fully **blank** content area for `https://example.com/`. BUT the tab title resolved to "Example Domain" (the page *did* load), and the web content is a separate native `WebContentsView` the renderer screenshot can't composite — so this is likely a capture limitation, not a real blank page. Flagging because a real blank-page regression here has bitten before (F-224).
- **what I expected:** to see the example.com body.
- **evidence:** `227-functional-sweep-b/12-browser-01-open.png`, `14-browser-03-typed.png`.
- **triage:** _(needs a real-shell eyeball — `bun run dogfood:open` → Browser → example.com — before treating as a bug.)_

### Data-hygiene observations (not product bugs, but a signal)
Mira's accumulated vault now carries visible duplicate residue that no create
path dedupes or auto-names away: **Contacts** lists 7× "Dana Whitfield" (2 with a
company, 5 bare), **Whiteboard** has 3× "Q3 GTM map", **Agent** has 6
conversations all named "In one sentence, what is a kno…", and **Database**'s
Content Calendar trails 4 blank "Untitled" rows. Test residue, yes — but it
points at missing affordances: conversation auto-titling from first turn,
duplicate-detection on contact create (Bookmarks already does "N duplicate links
found · Merge" — that pattern should generalise), and an empty-row reaper.

## Sessions 221–222 — cover-consistency fix + broad visual sweep (2026-06-13)

Ran on an isolated fork of Mira's vault (separate user-data-dir, so the live
persona loop on the shared vault is untouched). Session 221 verified the cover
fix with on-page measurement; session 222 opened all 18 apps for a visual pass.
**Headline:** the fleet is in strong shape — every app opened clean, no broken
renders, console quiet apart from the known/intentional block-frame CSP notes.

### F-225 — the right-panel inspector cover looked different in every app
- **session:** 221-cover-consistency   **kind:** design   **app:** Database / Books / Files (shared cover)   **status:** ✅ done (fixed + DB verified live, 2026-06-13)
- **what I was trying to do:** trust that an object's cover reads the same wherever it has a face (the top "Covers are not consistent in interfaces" TODO).
- **what happened:** the three right-panel *inspector* cover hosts diverged — Files `16/6` + `--radius-md`, Database `16/6` + **square (no radius)**, Books **`16/9`** + `--radius-md`. Same context, three looks.
- **fix (developer, 2026-06-13):** unified the inspector-preview context on aspect **16/6** + `border-radius: var(--radius-md)` + `flex-shrink:0` — Books inspector now passes `aspect={16/6}` (`apps/books/src/ui/inspector.tsx`), `.db-inspector__cover` gained `border-radius: var(--radius-md)` (`apps/database/src/styles.css`); Files was already the reference. The *doc-banner* context (Notes + Bookmarks-detail, full-bleed `16/5`, square) and the *gallery poster card* (`3/4`) are intentionally distinct contexts per `docs/foundations/50-object-covers.md`, so they were left as-is. **Verified live (session 221):** the DB inspector cover measures `border-radius: 8px`, `flex-shrink: 0`, inner aspect `2.667/1` (=16/6). 235 unit tests + typecheck + css-token guard green.

### F-226 — `[] ` and `--- ` typed nothing; the checklist/divider markdown shortcuts were never wired
- **session:** 223-notes-functional   **kind:** bug   **app:** Notes + shared editor (Journal/Tasks/Bookmarks)   **status:** ✅ done (fixed + verified live, 2026-06-13)
- **what I was trying to do:** write with muscle-memory markdown — `[] ` for a to-do, `--- ` for a divider — the way every other block (`# `, `- `, `> `, ` ``` `) already converts on type.
- **what happened:** `[] A todo` stayed literal text and `--- ` produced an ugly `—-` (Notes' `--`→`—` em-dash typing shortcut ate the dashes). Both the **To-do list** and **Divider** blocks exist in the slash menu — only their *markdown shortcuts* were missing. Root cause: every editor mounted `MarkdownShortcutPlugin` with the bare `@lexical/markdown` `TRANSFORMERS`, which omits `CHECK_LIST` and ships no HR transformer at all.
- **fix (developer, 2026-06-13):** new shared `packages/editor/src/markdown-block-transformers.ts` exports `CHECK_LIST` (re-exported) + a canonical `HR_TRANSFORMER`, prepended to the transformer list in both Notes' editor and the shared `StandardEditingPlugins` (so Journal/Tasks/Bookmarks get it too). The HR regExp also matches the em-dash-mangled `—-` / `——` forms so the `--- ` gesture still works in Notes despite its `--`→`—` shortcut. Export side (`serialize-markdown.ts`) gained a `horizontalrule` → `---` case so dividers round-trip. **Note: Lexical fires element transformers only on a trailing SPACE** (`--- `/`*** `, not `---`+Enter) — standard, matches `# `/`> `. **Verified live (session 223):** `[] ` → a checkbox item; `*** ` → 1 divider, `--- ` → a 2nd divider (HR DOM count 1→2). 557 editor tests + 3 new transformer tests + serialize HR test + typecheck + lint green.

### Sweep notes (222) — confirmed *not* bugs (intentional, documented)
- **Block-frame CSP `prefetch-src` / `navigate-to` "unrecognized" console warnings** — deliberate aspirational hardening (`block-frame-constants.ts`, deep-frozen + pentest-asserted); the directives are unenforced by this Chromium but kept on purpose. Left as-is.
- **Tasks rows show a dim "Priority" on every row** — the empty-state of the editable priority chip (`task-row.test.ts` "renders an empty affordance when None"), not stray text.
- **Duplicate Contacts / Agent conversations** — accumulated hiring-session data in the vault, not a render bug.

## Owner report — browser blank page recurrence (2026-06-11)

### F-224 — the browser stopped showing pages again once it had a session to restore
- **session:** owner report (probes 215b/215c)   **kind:** bug   **app:** Browser   **status:** ✅ done (fixed + real-shell verified, 2026-06-11)
- **what I was trying to do:** browse — open the Browser, go to a page, read it.
- **what happened:** the chrome was fine (tab restored, omnibox showed the URL, title resolved) but the page area stayed blank. The page was actually *loading* — its scripts logged to the console — it just never appeared. First launch ever worked; it broke once a previous session existed to restore.
- **what I expected:** the page shows, like the day Browser-2 landed (and like F-160's fix restored).
- **evidence:** probes `tests/dogfood/.sessions/215b-probe-browser-page-paints/notes.md` (pre-fix: `https://example.com/` view at `bounds={0,0,0,0}` while a stale `about:blank` view holds the sized slot) and `215c-…/notes.md` (pre-fix: after a restore the only host-side view is the seed `about:blank` — the restored active tab's view was never opened).
- **triage (developer, 2026-06-11):** root cause = the BrowsingSession/v1 restore effect (new in the 209-213 checkpoint) branched its imperative follow-up on a `let applied` flag **mutated inside the `setSession` updater and read back synchronously**. React only runs an updater eagerly when the hook's queue is empty; in a real launch the seed tab's `about:blank` load events are always queued first, so the updater deferred, `applied` read `false`, and the block that closes the seed view + opens the restored active tab's view never ran. The chrome's bounds push for the restored tab id then hit the host **before** any `open` for it — the host drops `SetBounds` for unknown tabs — so the later omnibox navigate mounted the view with no bounds: **0×0, loading invisibly**. Unit tests passed because an empty queue takes React's eager path — the bug only existed under real-shell event timing. Fix (`apps/browser/src/app.tsx`): (1) the restore decision now reads the last-rendered session (`sessionRef`), never an updater side effect (guard kept inside the updater too); (2) extracted `pushBoundsFor(tabId)` and made `openView` chase **every** `open` with a fresh bounds push, killing the whole open-vs-bounds ordering class. Regression guards: `app-features.test.tsx` "restores when seed load events land before the stored read resolves" (reproduces the deferred-updater ordering; fails on the old code) + real-shell probe `215b-probe-browser-page-paints.spec.ts` asserting the navigated URL's `WebContentsView` is visible with non-zero bounds (plus a native `capturePage` proving pixels). Verified: probe captures the rendered Example Domain page; boot shows exactly one sized, visible web view.

## Session 214 — Marcus's measured fleet audit (2026-06-11)

All 18 apps opened and *measured* against the documented contracts (header
geometry, the one title face, button weights, the 24/32/40 control scale,
sub-12px text); per-app numbers in
`tests/dogfood/.sessions/214-marcus-design-audit/notes.md`, a header crop per
app alongside. **What held:** every header sits at exactly 44px; every app
that has a header ⋯ puts it last; the title face is the shared 14px/600 in
13 of 18 apps; no sub-12px text anywhere except the Graph's zoom-scaled
canvas labels (10px world-space — defensible, noted, not filed). What didn't
hold is below. Marcus's note: "the 44px discipline is real praise — someone
swept this fleet recently and it shows. The rest is drift coming back."

### F-220 — Calendar and Files don't use the one title face
- **session:** 214-marcus-design-audit   **kind:** design   **app:** Calendar / Files   **status:** ✅ done (2026-06-12)
- **what I was looking at:** the rule says EVERY app's header title carries `.app-header__title` (14px/600, ellipsis, max-width). The chrome sweep deleted nine per-app forks. Two survive.
- **what happened:** Calendar renders "June 2026" as `H1.cal-toolbar__range` — visibly larger and heavier than every other app's title sitting next to it. Files has **no title element at all** — "Vault" is loose text that matches neither `.app-header__title` nor any h1/h2/title class, so it has none of the shared ellipsis/max-width safety.
- **what I expected:** the same 14px/600 face in all 18 headers, exactly like Notes/Tasks/Whiteboard.
- **evidence:** tests/dogfood/.sessions/214-marcus-design-audit/04-calendar-header.png vs 01-notes-header.png; 08-files-header.png; notes.md (`title=MISSING (H1.cal-toolbar__range)` / `title=MISSING (none)`)
- **triage:** fixed (2026-06-12 fix fleet) — the Calendar range heading and the Files current-breadcrumb segment now carry `.app-header__title`; both per-app font forks deleted. Re-audit (214 re-run): every app with a header shows the shared 14px/600 face (browser tab-strip + form-designer stub excepted by design).

### F-221 — four controls ship bold; buttons are never bold
- **session:** 214-marcus-design-audit   **kind:** design   **app:** Notes / Files / Bookmarks / Calendar   **status:** ✅ done (2026-06-12)
- **what I was looking at:** the standing control rule — buttons use `--text-weight-medium`, never 600+.
- **what happened:** computed `font-weight` ≥ 600 on: Notes **"Properties"** (w=600), Files **"Folders"** (w=600), Bookmarks **"Save current view as a collection"** (w=600), Calendar's **today date cell "11"** (w=700). The first three are plain toolbar/sidebar controls with no excuse; the calendar one is clearly "today emphasis" — but the token rules already say emphasis is accent's job (`--color-accent-*`), not weight.
- **what I expected:** medium weight everywhere; today marked with the accent like the rest of the product does selection/today.
- **evidence:** tests/dogfood/.sessions/214-marcus-design-audit/notes.md (BOLD lines per app, class-attributed)
- **triage:** fixed (2026-06-12 fix fleet) — Notes "Properties" (the shared .bs-panel-tab, fixed at source for Journal too), Files "Folders", Bookmarks "Save current view" all at --text-weight-medium; the calendar today cell keeps its accent treatment with medium weight (SDK calendar css, full + compact grids). Re-audit (214 re-run): zero bold buttons across all 18 apps.

### F-222 — almost nothing sits on the 24/32/40 control-height scale
- **session:** 214-marcus-design-audit   **kind:** design   **app:** fleet-wide   **status:** ✅ done (2026-06-12)
- **what I was looking at:** control heights come from `--control-height-sm/md/lg` (24/32/40) — never hand-rolled.
- **what happened:** the measured population is a smear, not a scale. Small controls land at 21–28: Notes "Properties"/"Comments" 26, Books "Typography" 26, Graph chips 26, Calendar's segmented Year/Month/Week/Day/Agenda 28, Bookmarks tag rows 28 and "Open …" links 21, Whiteboard "Reset zoom" 22. Mids land anywhere from 31 to 39: Automations "Import"/"New from template" 31, Whiteboard board rows 31, code-editor file tab 35, Notes "Add property" 35, Tasks nav rows 38, Database view tabs 39. Eighteen apps, and barely a control measures 24, 32 or 40 outside the shared SDK buttons.
- **what I expected:** every interactive control snapping to one of the three heights; a 39px view tab next to a 32px toolbar button is exactly the "almost aligned" noise the scale exists to kill.
- **evidence:** tests/dogfood/.sessions/214-marcus-design-audit/notes.md (off-scale lines per app, with class names and measured px)
- **triage:** done — core sweep (2026-06-12 fix fleet): every named offender mapped to the scale (Notes tabs 24 + Add property 32, Database view tabs 32, Calendar segmented control 24, Graph chips 24 + add-buttons 32, Whiteboard reset-zoom 24, Books type/highlight 24, Tasks Board/Timeline toggles 32, Automations buttons 32, Files Folders 24, Bookmarks save-view 24). Re-audit residue (small, flagged for the next pass): calendar header Today/DatePager cluster 28, code-editor file tab 35, mailbox Connect Gmail 34, bookmarks Merge 27 + inline open-links 21, books Sort library 26. List rows, menu rows and grid day-cells stay off the control scale by design.
- **note:** intentional non-controls measured and excused: contacts list rows (48), theme-editor preview tiles (62), calendar/journal mini-cal day cells (30) — list rows and grid cells aren't on the control scale.

### F-223 — the header ⋯ overflow exists in half the fleet and not the other half
- **session:** 214-marcus-design-audit   **kind:** design   **app:** Tasks / Journal / Bookmarks / Books / Agent / Automations   **status:** ✅ done (2026-06-12)
- **what I was looking at:** "the object ⋯ is the LAST element in `.app-header__right`, in every app" — it's where my hand goes for export/rename/anything in Notes, Database, Whiteboard, Files, Contacts, Mailbox, code-editor, Calendar.
- **what happened:** **Tasks** ends at [New task | Hide sidebar], **Journal** at [Hide calendar | Show properties], **Bookmarks** at [Add bookmark | Hide sidebar], **Books** at [Typography | Highlights], **Agent** at [New chat], **Automations** has an empty right group. Same product, two header grammars — in half the apps the catch-all simply isn't there, so whatever it would hold is either missing or hidden somewhere I didn't find.
- **what I expected:** the ⋯ anchoring the right edge of all 18 headers (stub apps excused).
- **evidence:** tests/dogfood/.sessions/214-marcus-design-audit/notes.md (the `right=[…]` inventory per app)
- **triage:** fixed (2026-06-12 fix fleet) — the ⋯ now anchors all six headers: Tasks (live on the task detail route, disabled on built-in surfaces), Journal (disabled face on empty days/rollups instead of vanishing), Bookmarks (live collection menu on list surfaces, detail route already correct), Books (both readers; live for a vault-backed book, disabled for the sample — and the parallel React conversion carries it in the React header), Agent (active conversation), Automations (disabled by design; Import/template stay visible toolbar actions). SDK grew `paintHeaderRight` + a disabled ObjectMenuMoreButton face so the affordance is never absent. Re-audit (214 re-run): every right group ends with More actions.

## Sessions 212–213 — the third hire: Dana Okafor, Operations & Growth (2026-06-11)

Northbound made its third hire, run entirely in-app per the standing funnel:
role brief (Notes) → applicants on the Candidates board (Database) → interview
event (Calendar) → scorecard (Notes) → offer + onboarding cadence (Tasks).
**Dana Okafor (Operations & Growth)** joins Marcus and Priya as the fourth
founder-side persona (see README §The fourth persona); her lens is the ops
spine — Automations, Calendar, the CRM-as-operated-pipeline, Contacts/Mailbox
as they land. Day one she captured her first automation: a renewal-check
reminder for Beacon Analytics ("13 Jul · Upcoming"). The funnel itself shook
out five paper cuts, below — adding two *named* candidate rows took four
attempts and flooded the pipeline with 13 blank rows along the way.

### F-215 — "+ New" made a row but kept the keyboard, then minted a blank row per Enter
- **session:** 212-mira-hires-ops / 212b-mira-hiring-fixup   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** click "+ New" on the Candidates grid and type the applicant's name — twice, for two applicants.
- **what happened:** the row appears, but focus STAYS on the "+ New" toolbar button (`activeElement: BUTTON.db-toolbar__btn--primary`). Everything I typed went nowhere, and every Enter re-fired the focused button — another blank row. Two name-entry attempts left the pipeline at **17 rows, 13 of them "Untitled"**.
- **what I expected:** "+ New" hands the keyboard to the new row's title (the Notion/Anytype pattern: create → type name → Enter commits).
- **evidence:** tests/dogfood/.sessions/212b-mira-hiring-fixup/01-01-candidates-after-add.png (the Untitled flood), 212b notes (activeElement probe), 212c notes (repro)
- **triage:** fixed (2026-06-12 fix fleet) — the create path records the new entity id as a pending title edit; the grid scrolls it into the virtual window and the title cell opens its inline editor on mount, taking focus off the toolbar button. Typing names the row, Enter commits; a create-in-flight guard blocks double-creates. Real-shell verified (215): activeElement is the INPUT after + New; exactly one new, named row.

### F-216 — renaming a row is a secret double-click
- **session:** 212c-mira-pipeline-cleanup / 212d-mira-names-candidates   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** put names on the two Untitled rows the composer left me.
- **what happened:** single-clicking the title looks like it does something (it's a button) but typing after it goes nowhere; the rename editor only opens on **double-click**, and the only hint is a hover tooltip ("Double-click to rename"). Nothing on the row, the ⋯ menu, or the right-click menu offers Rename.
- **what I expected:** a Rename on the row menu, or single-click-to-edit on the title cell like the other property cells.
- **evidence:** 212c notes (`activeElement after name-cell click: BUTTON.dbv-grid__title-label--editable`), 212d notes (dblclick → INPUT, names land)
- **triage:** fixed (2026-06-12 fix fleet) — Rename on the row context menu (pencil icon) opens the same inline title editor; double-click stays. Real-shell verified (215): menu offers Rename.

### F-217 — I can't delete a row from Database; "Remove from list" leaves the corpse in the vault
- **session:** 212c-mira-pipeline-cleanup   **kind:** gap   **app:** Database   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** clean 13 blank "Untitled" rows out of my Candidates pipeline.
- **what happened:** the row's right-click menu offers **Open / Pin to dashboard / Remove from "Candidates"** — no Delete. I removed them from the list eleven times, but the blank Object entities still exist (All vault items kept the count; they'll show in Graph and search too). There is no way I found to actually destroy an object from Database.
- **what I expected:** Delete (with confirm) on the row menu — especially for objects the grid itself just minted.
- **evidence:** tests/dogfood/.sessions/212c-mira-pipeline-cleanup/01-01-row-context-menu.png + notes (menu inventory)
- **triage:** fixed (2026-06-12 fix fleet) — destructive Delete on the row object menu (Trash, confirm via the SDK Popover pattern) calling entities.delete; no manifest change needed (the broker gates delete on entities.write:*, already granted). Real-shell verified (215): probe row deleted through the confirm flow and gone.

### F-218 — the New-event dialog ignores Enter, and defaults to June 1st on June 11th
- **session:** 212-mira-hires-ops / 212b-mira-hiring-fixup   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** put Dana's interview on the calendar: +, type the title, Enter.
- **what happened:** Enter in the title field does nothing — the dialog only commits via the "Save event" button, so my first event silently died with the session. Also the prefilled start was **01/06/2026 09:00** — the 1st of the month — not today or the next slot, on a dialog opened from the month view on the 11th.
- **what I expected:** Enter-in-title = Save (the dialog has exactly one primary action); start defaulting to today / the next round hour.
- **evidence:** tests/dogfood/.sessions/212-mira-hires-ops/04-04-interview-event.png (dialog open, title typed, 01/06 default), 212b notes ("event saved via Save event")
- **triage:** fixed (2026-06-12 fix fleet) — Enter in the title commits the same save as the primary (via the shared chord parser; empty-title Enter surfaces validation instead of dying); default start is the Day view's selected day, else today at the next full hour (pure `defaultEventStart`, clock injected). Real-shell verified (215): default read 2026-06-12T12:00 and Enter saved + closed.

### F-219 — Automations' "Add reminder" looks clickable on an empty form and silently does nothing
- **session:** 213-dana-day-one   **kind:** design   **app:** Automations   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** day one, capture my first renewal reminder.
- **what happened:** with the capture row empty (my text had landed on the tab, not the input), "Add reminder" rendered as the enabled blue primary; clicking it did nothing — no validation message, no focus jump to the empty subject, no disabled state. I only learned the form was empty by looking.
- **what I expected:** the primary disabled until the form is valid, or the click telling me what's missing. (Filled properly it works — "Renewal check — Beacon Analytics · 13 Jul · Upcoming".)
- **evidence:** tests/dogfood/.sessions/213-dana-day-one/05-05-reminder-typed.png (focus ring on the tab, empty input, blue Add), 213b-dana-wires-renewal/02-02-reminder-listed.png (the working capture)
- **triage:** fixed (2026-06-12 fix fleet) — Add reminder renders disabled (+aria-disabled, dimmed primary) until the subject is non-empty; Enter in the subject submits; a blank date still falls to defaultDue. Real-shell verified (215): disabled empty, enabled after typing.

## Sessions 209–211 — the fleet-drop sweep (2026-06-11)

The team swept everything from the ten-PR fleet merge (#117–#126) plus the
in-flight browser-history and bookmarks-DnD work: the Browser's new memory
(history, suggestions, find-in-page, session restore), the Notes `/database` +
`/graph` embeds, the Database timeline + view settings, the Graph's
drag-to-link, the code-editor's find / multi-cursor / folding / formatter,
the Whiteboard's rich-text toolbar, the Calendar's CalDAV entry, the theme
editor, and the dashboard chrome. Captures under
`tests/dogfood/.sessions/209*`, `210*`, `211*`.

**Verified working ✅:**

- **Browser memory (Browser-9)** — visits feed omnibox suggestions
  (title + URL rows, arrow-key + Enter navigation) and a History menu
  ("Recently visited" + red destructive Clear); both SURVIVE a full shell
  restart, and the open tab comes back on launch with the right URL
  (BrowsingSession/v1 restore). This closes Mira's oldest browser complaint.
- **Find-in-page** — Cmd+F bar with live "1 of 2" counts, Enter cycling,
  Escape dismiss. Star clip ("Save to vault") present on the toolbar.
- **Bookmarks board DnD fix (in-flight)** — the dedicated regression spec
  passes against the production build (card drop retags across lanes,
  mid-drag vault refresh deferred, horizontal scroll kept); in the founder
  vault the board's scroll position also survived 4s of live-store ticks.
  Compose dialog's "Download page content for offline reading" defaults ON
  (9.18.5).
- **Notes `/database` embed (9.12.12)** — the slash command surfaces, the
  embed picker is correctly scoped to Lists only (Candidates / Clients /
  Content Calendar), and a mouse pick drops a LIVE grid of the collection
  inline (rows match the source). The graph also gained an "Editor links"
  edge for the new embed — cross-app consistency held. (Keyboard path broken
  — F-209; rendering quality — F-210.)
- **Database view machinery** — the view tab-strip + "+" new-view, and the
  view-settings popover (View name / View type / Layout / Properties / Shown
  objects) all work; switching a Grid to Timeline via View type works
  (empty-state gap — F-211).
- **Graph drag-to-link (9.13.11)** — Alt-drag from a node draws the dashed
  rubber band, highlights the target node label, and release opens a
  "Link to <target>" menu offering the catalog entityRef property
  ("Research notes") + the "Related to" fallback. Exactly the designed flow.
- **Code editor (B9.3 + 9.7.3 + 9.7.8)** — find bar with case / whole-word /
  regex / in-selection toggles + replace; Cmd+D multi-cursor paints
  secondary selections; indent-folding chevrons appear on the function +
  if-block; Cmd+Shift+F Prettier-formats the buffer (`sum=items` →
  `sum = items`). All against the real Y.Text buffer.
- **Whiteboard rich text (9.17.12)** — selection raises the floating format
  toolbar with B / I / U / S, six real colour swatches, and S / M / L sizes
  (the F-200 "no swatches" complaint is properly closed). Text-entry head
  loss is new friction — F-213.
- **Calendar (9.15.19)** — the ⋯ menu carries "CalDAV sync…" alongside
  Import / Export iCal. (Live sync needs a real server account — residue.)
- **Theme editor** — Token set / Icon pack / Typography / Style pack tabs +
  the live preview panel render clean and polished.
- **Dashboard chrome** — launcher tile context menu (Open / Remove from
  dashboard / red Uninstall app); notification center opens with a tidy
  empty state (the new per-app icon rendering needs a posted notification to
  judge — none in the vault).

**Not harness-verifiable this round** (recorded residue, not friction):
Books PDF reading mode (no PDF in the founder vault; OS file dialogs can't
be driven), whiteboard presence (needs a second shell), connector push +
Mailbox OAuth (need live accounts).

### F-209 — the embed picker ignores Enter and Escape; my next command landed inside its search box
- **session:** 210-mira-data-views   **kind:** bug   **app:** Notes (editor embed picker)   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** insert the live Content Calendar with `/database`, keyboard only — the way I write everything else.
- **what happened:** the picker opened with "Candidates" highlighted, but Enter did nothing (twice), and Escape didn't dismiss it either. I carried on typing my next command and `/graph` went straight INTO the picker's search box ("Nothing matches "/graph""). No embed ever landed. The mouse path works fine (210b).
- **what I expected:** Enter inserts the highlighted collection; Escape closes the picker and returns me to the text.
- **evidence:** tests/dogfood/.sessions/210-mira-data-views/02-02-database-embed-picker.png (picker, row active), 03-03-database-embedded.png (identical after Enter + 3.5s), 04-04-slash-graph-menu.png ("/graph" inside the picker search)
- **triage:** fixed (2026-06-12 fix fleet) — the picker's search input owns focus while open, so the Lexical KEY_* command registrations never saw a key; the input's own onKeyDown now drives the picker through the app chord table (the dormant `ActionId.CloseEmbedChooser` wired for Escape). Enter commits the active row, arrows move it, Escape dismisses and refocuses the editor. +4 plugin tests. Real-shell verified (session 215): Enter inserted the live grid; typing after Escape landed in the doc.

### F-210 — the embedded database shows raw property ids, raw epoch dates, raw entity ids — on a white card in my dark theme
- **session:** 210b-probe-embed-timeline-link   **kind:** bug   **app:** Notes × Database (live embed)   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** see my editorial pipeline inline in the ops doc.
- **what happened:** the embed IS live (right rows, right names) but the columns read "Prop mpye0tff 8acd19" and "Prop mpye2ond 2etq7m", the date column shows `1780963200000`, the ref column shows `di_mpyebi7o_82fbln` — and the whole block renders as a white-surface card inside my dark note.
- **what I expected:** the same column names, date formatting and chips the Database app shows; the embed following the app theme like every other block.
- **evidence:** tests/dogfood/.sessions/210b-probe-embed-timeline-link/01-01-after-mouse-pick.png
- **triage:** fixed (2026-06-12 fix fleet), two halves. **Data:** the block reuses the app's effective-def inference + the SDK date formatter; `ent_…` refs resolve to entity titles via graph getEntity, unresolvable ids render a dimmed "N references" — never a raw id. **Theme:** root cause — both embed hosts harvested only `documentElement`'s INLINE vars (exactly 3 preload header paddings; theme tokens live in stylesheets), so blocks painted light fallbacks. New shared `collectBlockThemeVars` (@brainstorm/sdk/block-runtime) reads computed custom properties (+ stylesheet-walk fallback) and resolves a concrete color-scheme from the background's luminance; Notes + Whiteboard hosts adopted. Real-shell verified (215/215b): headers "Name"/"Reference", formatted cells, 201 tokens land, embed renders dark. Residue: minted opaque property keys can't recover display names inside the block (the properties catalog isn't on the block transport) — they header by inferred type instead.

### F-211 — switching my calendar to Timeline lands on "No items have a value…" instead of picking my date column
- **session:** 210c-probe-timeline-linkdrag   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** see the Content Calendar as the new timeline (9.12.10) and drag a date.
- **what happened:** View settings → View type → Timeline switched fine, but the view came up empty: "No items have a value for t…". The collection has exactly one date property — the Month view already lays the issues out on it — but the timeline didn't bind it, and nothing on the empty state points me at the Dates page that would.
- **what I expected:** the obvious date property auto-selected (or the empty state offering a one-click "use Publish date").
- **evidence:** tests/dogfood/.sessions/210c-probe-timeline-linkdrag/02-02-timeline-view.png
- **triage:** fixed (2026-06-12 fix fleet) — switching a view's kind to Timeline auto-binds the date axis: an existing Calendar sibling's axis wins, else the best-ranked date property (single candidate = the pick). Empty-state copy split: bound-but-valueless points at View settings → Dates by name; no-date-property says so. Real-shell verified (215): Timeline switch shows the issues immediately.

### F-212 — BrowsingHistories, Triggers and ListViews now sit in my sidebar like they're my data
- **session:** 210-mira-data-views   **kind:** design   **app:** Database / Graph   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** open my Content Calendar.
- **what happened:** the Database sidebar (and the Graph's type filter) now list **BrowsingHistories (1)**, **BrowsingSessions (1)**, **ListViews (9)**, **Triggers (1)**, **Workflows (1)** — plumbing records from the browser, the saved-views system and automations, presented exactly like my own collections. Every new system entity ships another one of these.
- **what I expected:** infrastructure records stay out of my browsing surfaces (or live under a collapsed "System" group), the way app code doesn't show up in Files.
- **evidence:** tests/dogfood/.sessions/210-mira-data-views/09-09-new-view-menu.png (sidebar), 210-mira-data-views/12-16-graph-link-rubber-band.png (filter chips)
- **triage:** fixed (2026-06-12 fix fleet) — shared `SYSTEM_ENTITY_TYPES` in @brainstorm/sdk/system-entities (membership rule: side-effect records only; Reminders/StylePacks are deliberate creations and stay user content). Database sidebar groups system type-lists under a collapsed System disclosure below user lists; the Graph SHOW panel renders them last in a de-emphasised System sub-group. Presentation only — no query semantics changed. Real-shell verified (215).

### F-213 — the whiteboard ate the first half of my sticky's text again
- **session:** 211-priya-studio-tools   **kind:** bug   **app:** Whiteboard   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** double-click the canvas, type "Launch narrative — bold the stakes", make it bold.
- **what happened:** the committed node reads "**ive — bold the stakes**" — the first ~13 characters vanished, even though typing started ~0.9s after the double-click. An extra empty node also appeared near the sticky during the same flow, which smells like early keystrokes falling through to the canvas S/T/F creation chords before the inline editor takes the keyboard.
- **what I expected:** every character lands in the sticky I just spawned (the F-199 fix covered the blur-commit half; this is the focus-handoff half).
- **evidence:** tests/dogfood/.sessions/211-priya-studio-tools/07-07-sticky-typed.png (empty extra node mid-flow), 10-10-sticky-committed.png (truncated text)
- **triage:** fixed (2026-06-12 fix fleet) — root cause was NOT a focus race: bare-canvas double-click did nothing at all (only edge-label picking), so the typed string fell to the window-level chords until the first 't' matched CreateText and spawned a node mid-sentence — explaining the exact 13-char head loss AND the stray node. Now bare-canvas dblclick spawns a sticky straight into inline edit with synchronous focus, and creation chords are dead while any edit is active (fail-closed even if focus escapes). Two adjacent bugs fixed en route (beginEdit re-entry wiping uncommitted text; placeholder board's nodes array shared across engines). 8 new engine tests, all verified red pre-fix. Real-shell verified (215): immediate typing after dblclick lands in full, no extra nodes.

### F-214 — find reopens with my last query stuck in the box, so typing appends to it
- **session:** 211b-probe-code-editor   **kind:** design   **app:** code-editor (shared FindBar)   **status:** ✅ done (2026-06-12)
- **what I was trying to do:** Cmd+F, type "sum".
- **what happened:** the bar reopened still holding yesterday's "total" with the caret at the end — my "sum" made it "totalsum" → "No results" on a buffer with five `sum`s. I read it as find being broken until I looked at the input.
- **what I expected:** the previous query pre-selected on reopen (every editor does this), so typing replaces it and Enter-with-no-typing reuses it.
- **evidence:** tests/dogfood/.sessions/211b-probe-code-editor/02-02-find.png
- **triage:** fixed (2026-06-12 fix fleet) — both FindBar twins (React + vanilla-DOM, which had the same bug) select() the retained query on every open, so typing replaces and bare Enter reuses. Real-shell verified (215): reopen + "beta" reads "beta", not "alphabeta".

## Sessions 205–208 — the new-functionality sweep (2026-06-10)

The team spent a day on everything that shipped since session 204: the
Whiteboard's templates / connector styling / images / freehand, the Books
reader (typography + highlights), the Bookmarks typed citation metadata, the
Database saved-views strip, the Tasks board, and the code-editor's new visual
layers. Captures under `tests/dogfood/.sessions/205*`, `206*`, `207*`, `208*`.

**Fix sweep (same day):** all twelve entries below were fixed by a six-cluster
agent fleet + adversarial review (commit on `worktree-dogfood`), then re-verified
against the production build in sessions 205/205b/205d/205e/206/206b/207/208.
The notable extra finds during verification: two module-eval-order crashes
(`styleTriggerBtn` / `layersToggleBtn` TDZ — the kind typecheck and jsdom tests
can't catch, only a real boot) and a blur-vs-repaint race in the inline editors.

**Verified working ✅:**

- **Whiteboard templates** (9.17.18) — "New whiteboard" offers Blank / Kanban
  columns / Flowchart / Mind map; Flowchart stamps a connected starter map.
- **Connector styling** (9.17.16) — with an edge selected, Style offers Route
  (Curved / Right-angle / Straight), end caps (Arrow / Dot / Box / Diamond),
  "Both ends arrowed", "Dashed line", and six colours. Mira's dashed
  planned-vs-committed distinction works.
- **Books typography** (9.21.3) — the Aa panel (Font / Size / Line spacing /
  Width / Page theme) is clean, applies live, and reads like a finished
  feature.
- **Bookmarks Site + Notes editing** (9.18.6/.7) — clicking the *value* side
  opens the shared property-cell editors; a renamed Site ("Example Press")
  persists and immediately re-renders in the detail body.
- **Database saved views** (9.12.x) — the Content Calendar now carries a real
  view tab-strip (Grid + a Month-calendar view with the issues laid out on
  their dates, Week/Month/Year toggle). This closes the years-old "I re-apply
  the same filter every session" complaint in its core.

### F-197 — a blank panel floats over the right third of every board
- **session:** 205b-edge-style-probe   **kind:** bug   **app:** whiteboard   **status:** done
- **what I was trying to do:** see my whole board.
- **what happened:** a 240×620 empty box sits over the canvas on every board —
  no title, no rows, no empty-state, no close affordance. The DOM says it's
  `aside.whiteboard__layers` with **0 children**.
- **what I expected:** the Layers panel either renders content (with a header
  and a close button) or doesn't render at all.
- **evidence:** tests/dogfood/.sessions/205b-edge-style-probe/notes.md (DOM
  probe), 205-mira-strategy-board-v2/12-13-final-board.png
- **triage:** fixed same-day — `.whiteboard__layers` carried `display:flex`, outranking the UA `[hidden]` rule; rebuilt as a hidden-by-default glass overlay with 44px header, close, rows + empty state (`ui/layers-panel.ts`, CSS pinned by test). Real-shell verified: no phantom panel.

### F-198 — every template board is "Untitled whiteboard" and I can't rename it
- **session:** 205-mira-strategy-board-v2   **kind:** design   **app:** whiteboard   **status:** done
- **what I was trying to do:** create my "Q3 GTM map" from the Flowchart template.
- **what happened:** the board lands as "Untitled whiteboard"; double-clicking
  the header title does nothing; I found no rename anywhere I looked. My board
  list is on its way to five Untitleds.
- **what I expected:** a name prompt on create, or an editable title (Notes
  pattern) — the window-titling rule says objects name their windows.
- **evidence:** tests/dogfood/.sessions/205-mira-strategy-board-v2/04-04-titled.png
- **triage:** fixed same-day — in-place title rename (dblclick → input, Enter/blur commits, Escape cancels, `ui/board-rename.ts`) + template-derived default names ("Flowchart", not "Untitled whiteboard"). Real-shell verified: board renamed to "Q3 GTM map", sidebar follows live.

### F-199 — new stickies all spawn on the same spot and my text vanishes
- **session:** 205-mira-strategy-board-v2   **kind:** bug   **app:** whiteboard   **status:** done
- **what I was trying to do:** place two labeled stickies and connect them.
- **what happened:** every sticky I created landed at the exact same canvas
  point — I ended up with **8 identical stickies stacked at (674,366)** without
  noticing. Double-click-then-type never put text into any of them (one attempt
  produced a separate empty "Text" node instead).
- **what I expected:** new nodes place at my click / cursor (or cascade), and
  double-click-to-edit puts the caret in the sticky I clicked.
- **evidence:** tests/dogfood/.sessions/205c-edge-style-probe2/notes.md (node
  inventory), 205-mira-strategy-board-v2/12-13-final-board.png
- **triage:** fixed same-day — pure `logic/spawn-position.ts`: spawn at pointer (else viewport centre) with +24/+24 cascade off occupied spots; new sticky/text drops straight into inline edit; the editing node is preserved across repaints and blur-commit is microtask-deferred (no more half-committed text feeding the create chords). Real-shell verified: full label lands in the sticky.

### F-200 — the Style menu is a wall of text rows, and it opens on nothing
- **session:** 205-mira-strategy-board-v2   **kind:** design   **app:** whiteboard   **status:** done
- **what I was trying to do:** restyle a node.
- **what happened:** Style opens even with nothing selected (applying to…
  what?) and presents twenty flat text rows — "Fill: Yellow", "Text colour:
  Red" — no swatches, no grouping, two different label idioms ("Text: Small"
  vs "Text colour: Red"). The zoom cluster also exposes two controls both
  named "Reset" to a screen reader.
- **what I expected:** disabled (or contextual) Style with no selection;
  colour swatch rows; one labelling idiom; unique control names.
- **evidence:** tests/dogfood/.sessions/205-mira-strategy-board-v2/06-06-style-menu.png,
  205-mira-strategy-board-v2/notes.md (toolbar inventory with double "Reset")
- **triage:** fixed same-day — Style trigger disabled (aria-disabled + hint) with no selection; menu grouped under labelled sections with one label idiom (`logic/style-menu.ts`; SDK AnchoredMenuItem grew an additive `section` row kind); zoom controls renamed "Reset zoom to 100%" / "Reset view". Colour swatch glyphs deferred (menu icon path is stroke-glyph only).

### F-201 — selecting a passage opens an empty "Highlight" dialog
- **session:** 206-priya-reading-room   **kind:** bug   **app:** books   **status:** done
- **what I was trying to do:** highlight the passage that defines the anchor
  model — the first highlight of my reading workflow (9.21.4).
- **what happened:** the selection held and a "Highlight" dialog opened —
  completely empty. Title, close ×, and a blank body: no colour choice, no
  note field, no confirm. The flow dead-ends.
- **what I expected:** the create-highlight form, or no dialog at all.
- **evidence:** tests/dogfood/.sessions/206-priya-reading-room/07-07-highlight-created.png
- **triage:** fixed same-day — the create dialog now renders quote preview, five colour swatches, Cancel + "Add highlight"; commit lands in the HighlightStore and the panel/page. Real-shell verified.

### F-202 — the reader floats in the top half of the window, and its math is off
- **session:** 207-marcus-new-surfaces-review   **kind:** design   **app:** books   **status:** done
- **what I was trying to do:** read.
- **what happened:** the page + footer occupy roughly the top 520px; below the
  footer is ~200px of dead background. And the footer told me "Page 1 of 2 ·
  0% read", then "Page 2 of 2 · 45% read" — on the *last* page I've read less
  than half?
- **what I expected:** the reading column centered in (or filling) the window,
  the footer at the window's bottom edge, and a progress number consistent
  with the page count.
- **evidence:** tests/dogfood/.sessions/207-marcus-new-surfaces-review/01-01-books-full.png,
  206-priya-reading-room/02-02-paged-forward.png
- **triage:** fixed same-day — reader stage fills the window with the footer on the bottom edge; `readingProgress` is end-anchored (last page = 100%, boundary unit-tested). Real-shell verified: "Page 2 of 2 · 100% read".

### F-203 — Books header: a pilcrow stands in for "highlights", no ⋯, 45px tall
- **session:** 207-marcus-new-surfaces-review   **kind:** design   **app:** books   **status:** done
- **what I was trying to do:** find my highlights from the header.
- **what happened:** the highlights button is a **¶** — a paragraph mark; that
  glyph means "formatting marks", not "highlights". There's no object ⋯ menu
  (the contract says it anchors every header's right edge), and the header
  measures 45px against the 44px baseline every other app sits on.
- **what I expected:** a highlighter/marker glyph, the standard ⋯ last, 44px.
- **evidence:** tests/dogfood/.sessions/207-marcus-new-surfaces-review/02-02-books-header.png,
  notes.md (header height probe)
- **triage:** fixed same-day (icon + height) — highlighter glyph via the SDK `createGlyphElement` builder replaces the ¶; the stray header pixel removed (44px verified). The ⋯ object menu stays deferred until the reader fronts a real entity (preview drop reads a sample book).

### F-204 — I can't record an author the scraper didn't find
- **session:** 206b-priya-bookmark-metadata   **kind:** gap   **app:** bookmarks   **status:** done
- **what I was trying to do:** fill in Author and Published on a source —
  citation basics (9.18.6 shipped these as typed fields).
- **what happened:** the Properties panel shows URL / Site / Description /
  Notes / Tags / Saved / Read / Archived — **no Author or Published rows at
  all**. The typed rows only render when the scraper already filled them, so
  there's no way to add one by hand. (Notes and Site edit fine — but only when
  I click the *value* side; clicking the row label does nothing.)
- **what I expected:** empty Author / Published rows I can click and fill, the
  way Notes shows "Empty" and edits.
- **evidence:** tests/dogfood/.sessions/206b-priya-bookmark-metadata/02-02-properties-open.png,
  notes.md (panel inventory + row probes)
- **triage:** fixed same-day — Author and Published rows always render with the shared "Empty" placeholder and edit via the shared property cells (text + date), writing through the 9.18.6 typed setters. Real-shell verified: both rows present and empty-editable. Label-side click still doesn't focus the editor (matches the shared property-cell behaviour elsewhere — value side is the edit surface).

### F-205 — "No code files yet" — and no way to make one
- **session:** 207-marcus-new-surfaces-review   **kind:** gap   **app:** code-editor   **status:** done
- **what I was trying to do:** open any file to see the new indent guides /
  bracket matching (9.7.3).
- **what happened:** the empty state says "Snippets, configs, and REPL scratch
  files you create in this vault open here" — but the window offers **no
  create affordance**: no +, no New-file button, no menu. The header holds
  only nav arrows and two panel toggles. Dead end.
- **what I expected:** a "New file" action in the empty state and in the
  header.
- **evidence:** tests/dogfood/.sessions/207-marcus-new-surfaces-review/11-13-code-editor-full.png
- **triage:** fixed same-day — the existing `createNewFile()` path (collision-free `untitled*.ts` + auto-open) is now reachable: "New file" button in the empty state + a header + action. Real-shell verified.

### F-206 — the Tasks board draws its rows on top of each other
- **session:** 208-mira-content-views   **kind:** bug   **app:** tasks   **status:** done
- **what I was trying to do:** plan the week on the Board view.
- **what happened:** card titles in the "No status" column render overlapping
  vertically — lines collide and several rows repeat ("Call the printer…"
  appears 4×). Unreadable.
- **what I expected:** one card per task, spaced.
- **evidence:** tests/dogfood/.sessions/208-mira-content-views/06-06-tasks-board.png
- **triage:** fixed same-day — board card layout corrected (`ui/board-view.ts`; reviewer fix-up added the Escape-cancel path to the inline add). Real-shell verified: 22 cards in a column render cleanly spaced with priority/date/assignee chips.

### F-207 — all 24 of my tasks are "No status"; the board's real columns are empty
- **session:** 208-mira-content-views   **kind:** design   **app:** tasks   **status:** done
- **what I was trying to do:** see my week as a board.
- **what happened:** every task I've ever made (via Today / Inbox / the plan)
  sits in "No status" (24); To-do and In progress both show 0. Nothing in my
  normal capture flow ever assigns a status, so the board view starts useless.
- **what I expected:** capture flows default to To-do (or the board buckets by
  something my tasks actually have, like due date).
- **evidence:** tests/dogfood/.sessions/208-mira-content-views/06-06-tasks-board.png
- **triage:** fixed same-day — status-less tasks bucket into To-do at presentation level (no entity rewrite); the board's inline "+ New task" carries its column's status; statuses are an as-const union. Real-shell verified: To-do 22 / In progress 0 / Done 6, "No status" gone.

### F-208 — a saved view is born "New view", forever
- **session:** 208-mira-content-views   **kind:** design   **app:** database   **status:** done
- **what I was trying to do:** keep a named calendar view of the Content
  Calendar ("Publishing calendar").
- **what happened:** the view tab is literally named "New view" — no naming
  prompt on create, no visible rename on the tab. Same disease as the
  whiteboard's Untitleds (F-198): unnamed objects multiply.
- **what I expected:** name-on-create or inline tab rename.
- **evidence:** tests/dogfood/.sessions/208-mira-content-views/02-02-content-calendar.png
- **note:** the calendar view itself is good — month grid, issues on dates,
  Week/Month/Year, Today nav.
- **triage:** fixed same-day — `defaultViewName(kind, existing)` mints "Calendar" / "Calendar 2"-style names (never "New view"); `ViewConfigAction.SetName` reducer rename; dblclick or F2 renames the tab inline. Reducer + naming unit-tested; the pre-fix "New view" tab in the vault is now renameable in place.

## Session 204 — Day 5: Priya's research loop closes (2026-06-09)

Browser-5's lean slice (built today off F-161's founder signal) got its
real-shell pass. Captures: `tests/dogfood/.sessions/204-priya-clips-a-source/`.

**Verified ✅:** load example.com in the Browser → the new **Save-to-vault**
clip button enables → click → Bookmark entities 4 → 5 → **"Example Domain"
renders in the Bookmarks Inbox** (url + title correct) — and Bookmarks'
duplicate detection immediately offers to Merge it with the hand-added
session-194 entry, which is exactly the seam the feature replaces. The clip
goes through the existing `entities.write:brainstorm/Bookmark/v1` capability
(zero new IPC surface); page-supplied title/url are sanitized via the new
shared `@brainstorm/sdk/sanitize-text` before persisting. **F-161 closed as
the lean slice** — reader-mode snapshot + favicon backfill stay on the
roadmap (Net-2-gated `WebViewMethod.Capture` path).

(Harness note: the first run probed the entity count from the *Browser* page
and failed with "lacks capability for vault-entities.list" — correct
fail-closed behavior; the probe moved to the Bookmarks app.)

## Session 203 — Day 4: ownership reaches the knowledge map (2026-06-09)

Marcus checked whether assignment is a real *relationship* — does the Graph
draw Task→Person? Captures: `tests/dogfood/.sessions/203-assignee-graph-edge/`.

**Found + fixed in-day:** first pass showed **zero** Assignee links — the
`assigneeId` EntityRef def was registered only by the **dev seeder** (gated on
`isDev && AUTO_SEED`), so this production-build vault's catalog never carried
it and the shell's catalog-driven ref derivation had nothing to match. Fix:
the **Tasks app idempotently ensures the def** via the properties service at
boot (`properties.write` was already in its manifest); shape pinned to the
seeder's by unit test. Re-run: **2 `detail:"Assignee"` links** derive
(both deliverables → Priya's Person record) and the honest F-157 counter
ticks 8 → 10. Pattern worth remembering: *any* catalog def that only the dev
seeder writes is invisible to real vaults — apps should own their defs.

## Session 202 — Day 3: Mira reads the week by person (2026-06-09)

F-164's read half got its real-shell look. Captures:
`tests/dogfood/.sessions/202-read-week-by-person/`.

**Verified ✅:** Upcoming's header carries **"Group by assignee"** (same toggle
family as "Show completed"); toggling sections the same task set per person —
**PRIYA NAIR** headlines her deliverable (with her name chip on the row),
**UNASSIGNED** holds the rest; toggling back restores date sections. One bug
found and fixed in-day: first run showed **"Unknown person"** as the section
heading — the shared entity-title index hydrates async after first paint and
nothing repainted on hydration. Fixed with a debounced
`subscribeEntityTitles → render()` (same 250ms window as the vault reload);
re-run shows the real name. **F-164 closed.** (The assignee row-chip half
landed in parallel as plan iteration 9.14.15; the grouping + this repaint
completed it.)

## Session 200 — Day 2: the team owns the week; review-in-the-tool (2026-06-09)

Mira re-owned the title-string-era deliverables with real assignees, then the
team ran its first in-doc comment review on the Issue #4 outline. The assignee
flow held up in real work; the comment flow surfaced the day's headline bug
(F-163) — found, fixed and re-verified inside the same day. Captures:
`tests/dogfood/.sessions/200-team-owns-the-week/`, `200c-comment-review-retry/`.

**Positive verification:** picking an assignee from the detail panel works in
a real flow (Priya Nair set on the Issue #4 deliverable, chip persists,
Updated bumps). After the F-163 fix: select → ⋯ More → **Comment** → composer
focuses in the Comments tab → post → the commented block carries a highlight →
hovering it shows the **View comments** chip → click scrolls the panel to the
thread (badge "1", Resolve/Reply present). Review-in-the-tool works end to end.

### F-163 — the editor never received the comment wiring the app was passing
- **session:** 200b/200c-comment-review   **kind:** bug   **app:** Notes (editor mount)   **status:** ✅ done (2026-06-09)
- **what happened:** Priya selected a paragraph to leave a review comment and the inline toolbar had **no Comment action anywhere** (overflow showed only Remove formatting / Inline equation / Mention / Emoji); no commented-block highlight or hover chip could ever appear either.
- **root cause (developer):** `apps/notes/src/editor/editor.tsx`'s `<NoteContextProvider>` mount cherry-picked `noteId`/`values`/`setValue` from the context object and **silently dropped** `onCommentSelection` / `commentedBlockIds` / `onCommentBlockClick` — the app wired comments correctly upstream (the Comments tab + panel worked), but the editor-side context never saw them, in every real shell. Unit tests stayed green because they wire the context directly. Fix: forward the **whole** context object (`{...noteContext}`) so the next optional field can't be dropped; comment in place explains the trap. Verified end-to-end in session 200c (evidence above).
- **harness note:** 200b's first attempt also typo-clicked the right panel's "Comments" *tab* (substring match) and typed a sentence into the doc body — repaired in 200c before the retry.

### F-164 — I can write "Priya owns this" but can't ask "what's on Priya's plate this week?"
- **session:** 200-team-owns-the-week   **kind:** gap   **app:** Tasks   **status:** ✅ done (2026-06-09; verified in 202)
- **what I was trying to do:** after re-owning the week's deliverables with real assignees, read the week by person.
- **what happened:** assignment is write-only — the list surfaces (Today/Upcoming) show no owner on rows and offer no by-assignee grouping or filter, so the lists still read as one undifferentiated pile.
- **what I expected:** see who owns each row at a glance, and some way to slice a surface by person.
- **evidence:** `tests/dogfood/.sessions/200-team-owns-the-week/03-upcoming-after.png`.
- **triage (developer, 2026-06-09):** in build — assignee name chip on rows + one deliberate by-assignee grouping mechanism on the existing surface-compile architecture.

### Vault hygiene (parked — owner decision)
The sidebar still carries pre-fix residue: yesterday's "Untitled · HH:MM"
ghost notes (created before F-196 landed), harness notes ("Keep me — has
content" ×3, "eck", "Colour me redred"), and the duplicate contacts
(7× Dana Whitfield, 6× Sam Okonkwo, …). The new discard fixes stop NEW
ghosts; the backlog needs a one-time cleanup. A scripted sweep was drafted
and **deliberately not run** — heuristic deletion against the persistent
vault wants explicit owner sign-off. Options: (a) approve the scripted
sweep, (b) hand-clean via `bun run dogfood:open`, (c) leave it.

### F-165 — my own review comment is signed "Anonymous"
- **session:** 200c-comment-review-retry   **kind:** design   **app:** Notes (comments) / shell identity   **status:** ✅ done (2026-07-08, shell PR #116 — a posted comment's author now resolves to the signed vault display name [`roster.self`], falling back to the key fingerprint, not the localStorage "Anonymous"; new `@brainstorm/sdk/self-display-name` hook)
- **what happened:** the posted comment renders with author **"Anonymous"** — in my own vault, where the shell holds my identity.
- **evidence:** `tests/dogfood/.sessions/200c-comment-review-retry/06-06-thread-focused.png`.
- **triage (developer, 2026-06-09):** known, documented limitation — `localPresenceName()` reads a renderer-local preference and defaults to "Anonymous"; the shell's `IdentityService` exposes only key material (`id`/`publicKeyBase64`/`fingerprint`), **no display name**. The real fix is a vault-identity display-name channel (shell-side, new IPC surface → wants a security pass), which also pre-stages the collab presence arc. Not a drive-by patch; left open against the identity work.

## Session 198–199 — fix-batch verification day (2026-06-09)

Mira, Marcus and Kai gave today's five-fix batch its first real-shell pass.
Captures: `tests/dogfood/.sessions/198-*/`, `199-assignee-picker-probe/`.
**All five verified — no new friction filed:**

- **F-152 Assignee ✅** — the detail Properties panel carries an **Assignee**
  row; clicking the value cell opens a people picker, typing narrows it,
  **"Priya Nair"** (a real Contacts person) is offered, and the pick persists
  as a chip with Updated bumped (`199-…/03-assignee-set.png`). (198's "Priya
  not offered" was a harness miss — it clicked the row *label*, a no-op.)
- **F-153 Repeat caption ✅** — the detail shows "Does not repeat" exactly
  once (the select); the parroting caption is gone.
- **F-157 edge counter ✅** — Filters reports **Visible edges: 8** on the live
  vault, matching a drawn web instead of the structural 0.
- **F-158 contact ghosts ✅** — New contact persists (23 → 24), park the app,
  the abandoned blank evaporates (→ 23); `198-contact-ghost-check/`.
- **F-159 legend/Now overlap ✅** — measured bounding boxes: legend
  `y 586–666`, Now pill `y 681–699` — clear separation.

## Session 196 — Mira makes the team "real": roles + mentions both already work; blank notes pile up (2026-06-09)

Mira returned to two long-open complaints — that a contact can't hold a job
title (F-155) and that she can't @-mention a teammate (F-156) — and ran the
*decisive* test on each, rather than the under-sampled probes the originals were
filed from. Captures: `tests/dogfood/.sessions/196-mira-people-first-class/`.

**Positive verification (both resolved — the originals were sampling artifacts):**
- **F-155 — a contact CAN hold a role.** The role field is a real, editable
  property; it just lives in the **Properties inspector** (the Info toggle in the
  header-right), not on the card face. Mira opened Marcus Lee's inspector, set
  **Role = "Product Designer"**, and the detail subtitle immediately read
  **"Product Designer · Northbound"**. 187 probed only the card for a role
  *input* and missed the inspector. Evidence: `02-inspector-open.png`,
  `03-role-set.png`. **Closing F-155 as resolved.** (Residual *discoverability*
  nit only: role is a primary attribute shown in the subtitle but settable just
  via the inspector — noted, not a gap.)
- **F-156 — @-mentioning a teammate works.** Typing **`@Marc`** in a note
  surfaces **"Marcus Lee — Person"** as the *top* typeahead option (with the
  Person type label), alongside related Object/Note/Task hits. 188's "no people"
  reading came from grabbing only the first 8 rows of the *unfiltered* list (3
  date rows + alphabetically-early entities crowd "Marcus"/"Priya" out); filter
  by name and the person is right there. Evidence:
  `04-mention-typeahead-named.png`. **Closing F-156 as resolved.**

### F-196 — every "New note" I abandon leaves an "Untitled" ghost in the sidebar
- **session:** 196-mira-people-first-class   **kind:** bug   **app:** Notes   **status:** ✅ done (2026-06-09)
- **what I was trying to do:** just work in Notes across sessions.
- **what happened:** the sidebar is a wall of **"Untitled · 13:05 / 13:09 / … / 14:56"** rows (plus a stray "eck", "Dana Whitfield :"). The F-066 auto-discard *exists* but only fires when you switch **note → note**; if you hit "New note" and then **close/park the window or switch to another app** while the blank is still selected, the empty note persists forever. So abandoned blanks accumulate as ghosts.
- **what I expected:** an abandoned blank note (no title, body, icon, cover, or properties) evaporates when I leave it — the Notion / Apple-Notes behaviour — not just when I happen to click another note first.
- **evidence:** `tests/dogfood/.sessions/196-mira-people-first-class/04-mention-typeahead-named.png` (sidebar of Untitled rows).
- **triage (developer, 2026-06-09):** confirmed. The F-066 discard was wired to a *selection-change* effect only (`prev → selectedId`), so leaving Notes without first switching notes skipped it. Fix: extracted the discard decision to a pure `shouldDiscardAbandoned(id, sessionSet, notesMap)` (session-created **and** still `isAbandonedEmpty` → can never delete authored/pre-existing content) and added a **second trigger** on the shell's `brainstorm:app-visibility` (`visible:false`) + `pagehide` events — closing a window *parks* the renderer (hidden but alive), so the async `entities.remove` still flushes. Unit tests: extended `abandoned-empty.test.ts` with 4 `shouldDiscardAbandoned` cases (window-close ghost discarded; pre-existing/authored/null kept). Real-shell verified in **session 197**: created a content note + a blank, dispatched the park event → **Note entities 55 → 54** (blank gone), content note survives. typecheck:apps clean.

## Session 195 — Mira runs an automation: the engine creates workflows, but a string leaks (2026-06-09)

Session 192 only opened the Automations template gallery; Mira came back to
verify a workflow can actually be added + fire. Captures:
`tests/dogfood/.sessions/195-mira-automations-run/`.

**Positive verification:** adding a template **creates a real, persisted
workflow** — "Daily planning nudge" landed under Workflows and the "No workflows
yet" empty state cleared. The engine isn't template chrome; it does persist
workflows. (It lands *Disabled* with an Enable toggle — a reasonable default.)

### F-162 — a workflow row shows the raw text `{count, plural, one {# step} other {# steps}}`
- **session:** 195-mira-automations-run   **kind:** bug   **app:** Automations (+ Browser; SDK i18n)   **status:** ✅ done (2026-06-09, owner picked Option B)
- **what I was trying to do:** add a workflow and read its summary.
- **what happened:** the workflow row's step-count renders the **raw ICU message string** `{count, plural, one {# step} other {# steps}}` instead of "1 step". `05-06-runs-tab.png` also shows the Runs tab never populated (no "Run now" on a row; time-triggered workflows only fire on the scheduler, so a user can't confirm execution from the UI — a separate, smaller UX gap).
- **what I expected:** "1 step".
- **triage (developer, 2026-06-09):** root cause = the **shared app-side `t()` (`createT` in `@brainstorm/sdk/i18n`) does naive `{name}` replacement only — it has no ICU plural/select support** (`common-labels.ts:209`, `template.replace(/\{(\w+)\}/…)`). The regex can't even match `{count, plural, …}` (comma after `count`), so the whole template leaks verbatim. Affected sites that wrote ICU plurals against `createT`: **automations** `workflow.stepCount` + `status.loaded`, **browser** `shield.blocked` — all 3 leak. Notably **contacts + mailbox catalogs already carry comments** saying the app-side `t()` is `{name}`-only *by design* and deliberately use semantic keys instead of a plural rule — so two apps know this and route around it, two don't. **This is a design fork the docs don't position** (CLAUDE.md §Localization mandates ICU plurals — but that's written for the *shell* renderer's FormatJS/en.json; the *app-side* `createT` is a different, deliberately-minimal primitive):
   - **Option A — make `createT` ICU-aware** (back it with `IntlMessageFormat`/FormatJS). Honors the CLAUDE.md rule, fixes all 3 sites + any future plural, but adds a formatter to **every sandboxed app bundle** (size-limit budgets) and changes a design-system primitive used by all 11 apps.
   - **Option B — keep `createT` `{name}`-only** (the contacts/mailbox position) and **fix the 3 offending sites** to the established non-ICU pattern (count-specific / semantic keys). Matches existing app code and adds zero bundle weight, but brushes against CLAUDE.md's "never a `count === 1 ?` branch" — would need a sanctioned tiny plural helper so it isn't ad-hoc per app.
   **Resolution (owner picked Option B, 2026-06-09):** kept `createT` `{name}`-only (zero bundle cost, matches the contacts/mailbox convention) and added the sanctioned **`plural(t, count, "<base>.one", "<base>.other")`** helper to `@brainstorm/sdk/i18n` — the `count === 1` selection lives in that one shared helper, never in component code. Converted the 3 ICU sites to `.one`/`.other` `{count}` keys + a catalog-bound `plural` re-export (`apps/automations/src/i18n.ts`, `apps/browser/src/i18n.ts`); call sites in `app.ts`/`app.tsx` now call `plural(...)`. Codified the two-`t()`s/two-plural-rules split in CLAUDE.md §Localization so the next app doesn't repeat it. Tests: `create-t.test.ts` pins `plural()` incl. an explicit "never leaks a raw ICU template" regression case (9 pass); packages + both app tsconfigs typecheck clean. (Real-shell re-render deferred — deterministic string formatting, fully covered by the unit test; a dogfood:build was skipped to avoid baking unrelated in-flight WIP into bundles.)

## Session 194 — Priya tests the revived Browser as a research instrument (2026-06-09)

With the Browser loading pages again (F-160 fixed), Priya — whose job is reading
sources and citing them — put it through a real research pattern. Captures:
`tests/dogfood/.sessions/194-priya-browser-research-instrument/`.

**Positive verification (no change needed):** the Browser **loads real pages and
is stable** — example.com renders to "Example Domain", navigation works, **zero
console / envelope errors** across the session. F-160's fix holds under real use.

### F-161 — I can read a source in the Browser but can't clip it into the vault to cite it
- **session:** 194-priya-browser-research-instrument   **kind:** gap   **app:** Browser   **status:** ✅ done (lean slice, 2026-06-09; verified in 204) — reader-mode snapshot stays Net-2-gated
- **what I was trying to do:** read a source in the browser, then save it into the vault as a Bookmark so I can cite it in a brief — the core research loop.
- **what happened:** the browser navigates and renders fine, but there is **no clip / save / capture affordance anywhere** in the chrome. The page I'm reading can't become a Bookmark. Meanwhile Bookmarks already holds a hand-added "Example Domain" entry tagged `#newsletter-research` — so the *destination* exists; the **bridge from the browser to it doesn't.** I'd have to copy the URL out and re-add it by hand in Bookmarks, which defeats the point of having the browser in-app.
- **what I expected:** a "clip to vault / save as bookmark" action (reader-mode snapshot ideal) so the read → save → cite seam closes inside the app.
- **evidence:** `194-…/02-source-1.png` (example.com renders), `194-…/06-07-bookmarks.png` (the lone seed bookmark; nothing captured from the browser), notes: `clip-to-vault / capture affordance present in the browser: false`.
- **triage (developer, 2026-06-09):** **not a bug — a not-yet-built iteration.** Clip-to-vault is **Browser-5** on the roadmap (`web.capture` → `brainstorm/Bookmark/v1`, reader-mode snapshot); the shipped browser is Browser-1/2/3 (scaffold + WebView host engine + chrome). The app's own i18n already promises "clip-to-vault capture as bookmarks", and the `WEB_CAPTURE_CAP` capability + the `Bookmark/v1` artifact contract are already defined — so the wiring is staged, the affordance just isn't built. **Founder signal:** from the research chair this is the *highest-value* next browser increment — a research browser you can't save *from* isn't a research tool. Prioritise Browser-5 over further chrome polish. (Multi-tab driving in this session was a harness limit — the `+` / per-tab omnibox live in the separate tab-strip WebContentsView the spec can't reach from the app body page — so no finding is filed on tabs.)

## Session 192–193 — touring the commercial + team spine that shipped (2026-06-09)

Mira walked the apps that didn't exist when she filed her biggest gaps
(sessions 110/111/112: "no commercial spine") — Automations, Form Designer,
Mailbox, Contacts, Browser — to see what's real now. Captures:
`tests/dogfood/.sessions/192-mira-commercial-spine-tour/`,
`tests/dogfood/.sessions/193-mira-browser-loads/`. The wishlist reconciliation
(what's now resolved vs. still open) is in
[`business-wishlist.md`](business-wishlist.md) §Session 192. One hard bug found
and fixed:

### F-160 — the Browser app can't load any page (every WebView call is rejected)
- **session:** 192-mira-commercial-spine-tour   **kind:** bug   **app:** Browser   **status:** ✅ done (2026-06-09)
- **what I was trying to do:** open the new Browser app and load a research source (example.com) to capture for an issue.
- **what happened:** the browser chrome (tabs, omnibox, nav) rendered, but typing a URL + Enter did nothing — the page stayed blank — and the console logged `service must be a lowercase identifier` four times.
- **what I expected:** the page loads, like any browser.
- **evidence:** `192-…/11-05-browser-loaded-page.png` (blank body, "New tab" never resolves) + console `[browser] pageerror: service must be a lowercase identifier` ×4.
- **triage (developer, 2026-06-09):** root cause = the just-landed Browser-2/3 WebView host engine registered the service and built its envelopes with the wire name **`"webView"`** (capital V), but the IPC envelope's `service` field is lowercase-only (`SERVICE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/`). So **every** WebView call (open/navigate/back/forward/reload/…) failed `validateEnvelope` and fail-closed returned before reaching the handler — the whole app was dead, not just slow. The name was a duplicated literal across 13 sites (1 registration + 12 SDK proxy calls). Fix: extracted a single `WEBVIEW_SERVICE = "webview"` constant in `@brainstorm/sdk-types/web-view.ts`, used it in the shell registration (`main/index.ts`) and every SDK `callService` (`sdk/runtime.ts`), so the wire name can't drift into something the broker rejects. Regression guard: `envelope.test.ts` now asserts `validateEnvelope({…, service: WEBVIEW_SERVICE}).ok === true` (pins the shipped wire name to the validator). Verified real-shell (session 193): example.com loads, the tab title resolves to **"Example Domain"** (page metadata flows back through the now-working service), zero envelope errors. (The page body is blank in the Playwright capture only because the `WebContentsView` is an out-of-process native view outside the renderer's paint tree — a harness screenshot limitation, not a product issue.)

### Spine tour — positive verifications + what's still thin (no new F unless noted)
- **Automations is real ✅** — Workflows / Reminders / Runs tabs, a template gallery (Daily planning nudge, Weekly review nudge, New bookmark alert, Test notification) that runs against the engine. *But* the **pipeline-rule authoring** Mira actually needs (DT-1: "when a Client's *Stage* becomes *Proposal*, create a task") isn't surfaced — only "New from template", no custom when-property-changes → then-set-property builder. So the engine shipped; the CRM-funnel authoring UX hasn't. (Wishlist DT-1 → partial.)
- **Form Designer is still a COMING-SOON stub ❌** — "WYSIWYG layout editor… coming soon". So the **billing chain (invoice/proposal/SOW + PDF) still does not exist** — the single most business-critical gap (DT-2) is unchanged. `192-…/04-02-form-designer-landing.png`.
- **Mailbox is a real shell but unwired 🟡** — inboxes / flagged / search / reading pane all render, but "No messages — appears once it syncs": no account connected, no client threads, no newsletter send. The vault *does* carry Messages (18) + Conversations (6) entities, so the data model is staged. (DT-6 → built-but-unwired.)
- **Contacts is real & populated ✅** — Person records for the team (Marcus Lee, Priya Nair @ Northbound) + a 23-row People list in Database. The *people-model* half of DT-9 is done. **But** the duplicate accumulation (F-158) is visibly bad now — **7× "Dana Whitfield"** + duplicate "Priya Raman" — with still no merge/cleanup. `192-…/08-04-contacts-landing.png`.
- **Database CRM grid cover persists** — the Clients grid view is dominated by a full-width gold gradient cover band that pushes the columns out of view (the recurring cover-on-data-grid issue). Lists are rich now (People 23, Companies 4, Clients 3, Candidates 4, Content Calendar 3). `192-…/13-06-database-landing.png`.

## Session 187–190 — team roster, cited outline, findability, graph review (2026-06-08)

Four "days" running the real business with the team now real. The headline is a
**theme, not a single bug**: across three apps the product has **no
first-class "person" connective tissue**. Mira can't assign a task to a person
(F-152), can't record a contact's role (F-155), and Priya can't @-mention a
teammate in a doc (F-156) — three faces of the same missing primitive. There
were also two clean **positive verifications** (search reaches into bodies; the
Notes outline + graph render hold up).

**Positive verification (no change needed):**
- **Full-text findability works (189).** Searching a *body phrase* not in any
  title — "rented distribution" — returned exactly the Issue #4 outline; "Issue
  #4" → 1 hit, "Beacon" → 4 relevant hits (one-pager, Active case, research
  index, competitive note). Search reaches into bodies, not just titles.
  Evidence: `189-priya-findability-audit/*-search-*.png`.
- **Notes long-doc authoring + graph render hold (188/190).** The five-section
  Issue #4 outline wrote cleanly via the editor; the graph settles and draws the
  reason legend (Property references / Editor links / Shared attributes).

### F-155 — a contact can hold a company but not a job title / role
- **session:** 187-mira-team-roster   **kind:** gap   **app:** Contacts   **status:** ✅ done (not-a-gap; verified in 196 — role field exists in the Properties inspector)
- **what I was trying to do:** add Marcus (Product Designer) and Priya (Research Editor) to Contacts as my team, *with their roles*.
- **what happened:** I could set each person's **company** (Northbound) via the inline picker, but there's **no role / job-title field anywhere** on the contact — not on the detail card, not in the properties panel. So "Product Designer" / "Research Editor" has nowhere to live. A team roster without titles barely qualifies as a roster.
- **what I expected:** a `role` (or `title`) text/select field on a Person, right next to Company.
- **evidence:** `tests/dogfood/.sessions/187-mira-team-roster/02-02-detail-marcus.png`, `03-02-detail-priya.png` (no role field; notes: `role field present + set: false` for both).
- **triage:** _(developer — add a `role`/`title` ValueType.Text property to Person/v1 in Contacts; pairs with F-152 assignee + F-156 person-mention as the same "people are first-class" slice.)_

### F-156 — I can't @-mention a teammate in a note; the picker omits people
- **session:** 188-priya-issue4-outline   **kind:** gap   **app:** Notes   **status:** ✅ done (not-a-gap; verified in 196 — `@Marc` surfaces "Marcus Lee — Person" as the top hit)
- **what I was trying to do (Priya):** end the Issue #4 outline with "Assigned reviewer: @Mira" — a real @-mention pointing at a person record.
- **what happened:** typing `@` opens the mention typeahead, but it offers **dates** (Today/Tomorrow/Yesterday), **journal entries**, **objects** ("Acme Research Co."), and **tasks** ("Advisory — Beacon…") — **no people / contacts at all**. Marcus and Priya (just added to Contacts in 187) don't appear. Picking anything left **no mention chip** ("mention chip after pick" was empty). So a doc literally cannot reference a teammate. (B11.1 added a *label* for member mentions, but the candidate list never includes Person/v1.)
- **what I expected:** the @-typeahead surfaces my Contacts people, and picking one drops a resolvable person chip that links to their contact record.
- **evidence:** `tests/dogfood/.sessions/188-priya-issue4-outline/02-02-mention-typeahead.png` (the menu — dates, entries, an Object, a Task; zero people).
- **triage:** _(developer — the mention provider queries Note/Entry/Object/Task entity sources but not Person/v1; add Person to the mention candidate query so the member-mention label that already exists has something to resolve.)_

### F-157 — the graph is 160 nodes and reads as disconnected dots ("Visible edges: 0")
- **session:** 190-marcus-graph-design-review   **kind:** bug   **app:** Graph   **status:** ✅ done (2026-06-09)
- **what I was trying to do (Marcus / Priya):** judge the knowledge map — is the vault a connected web or scattered islands?
- **what happened:** the Filters panel reports **Visible nodes: 160, Visible edges: 0** — yet a *handful* of edges actually draw on canvas (a small cluster around "Research index — Northbound", "Beacon Analytics", "Competitive note", "Reading-list synthesis"). So either edge extraction is under-connecting almost everything (160 entities, ~0 relationships detected) **or** the "Visible edges" stat is miscounting to 0 while edges render — and either way the map presents as a sea of unconnected dots. For a knowledge product whose pitch is connection, that's the central design+integrity problem on this surface.
- **what I expected:** a connected core (issues ↔ briefs ↔ clients ↔ reading list) and an edge count that matches what's drawn.
- **evidence:** `tests/dogfood/.sessions/190-marcus-graph-design-review/01-01-settled.png` (MATCHES: 160 nodes / 0 edges, near-empty web).
- **triage (developer, 2026-06-09):** **stat bug, not under-connection.** The Filters summary reported `matchResult.links.size` — links bound by *pattern edge constraints* — and the default pattern has `edges: []`, so "Visible edges" was structurally always 0 regardless of what drew. (Bonus: "Visible nodes" double-counted entities matched by multiple subjects.) The canvas draws `db.links` under `showUnmatched` (default on), which is why a handful of edges painted while the counter said 0. Fix: new pure `sceneStats(scene)` reports the *painted* `renderNodes`/`renderEdges` counts (plus a separate match-bindings count); labels also localized via `t()`. RED→GREEN test in `apps/graph/src/render/scene.test.ts` pins counter == painted set. Under-connection ruled out app-side — the graph faithfully renders the link snapshot it's given; if the vault genuinely under-links, that's shell-side extraction, and the honest counter will now make it visible. Real-shell verify in the next session.

### F-158 — Contacts is accumulating duplicate + "Unnamed" rows with no way to clean up (watch)
- **session:** 187-mira-team-roster   **kind:** design   **app:** Contacts   **status:** ✅ done (2026-07-17) done (ghost prevention, 2026-06-09) — merge/de-dup remains a follow-up
- **resolution (developer, 2026-07-17, shell PR #176):** Contacts gains duplicate detection + merge (the DT-9 tail). Pure matcher (normalized email = strong, folded name = candidate; union-find groups, so 7× Dana Whitfield is one group), survivor defaults to most-complete/oldest, field-level union patch. Merge itself is a new capability-gated `entities.merge` broker op reusing the existing `entities.write:<type>` grant: refs rewritten across every live referrer (property-ref + stored links, transactional, self-loops collapse), losers soft-deleted to the Bin (restorable), idempotent re-merge. Sidebar Duplicates strip → two-step Popover dialog, full keyboard path, en+es. 43 new tests; 2992 green across touched suites. Known v1 limit: rich-text body mentions aren't rewritten (same as delete today).
- **what happened:** the book now shows **7× "Dana Whitfield", 6× "Sam Okonkwo", 4× "Theo Marsh", 2× "Priya Raman"** and **2× "Unnamed"** rows. Much of this is dogfood test cruft accumulating in the persistent vault — but it surfaces two real product gaps: (1) there's **no de-dup / merge** for people, and (2) an **abandoned "new contact" leaves an empty "Unnamed" record** rather than discarding it.
- **what I expected:** new-contact with no name entered doesn't persist a ghost row; and some way to merge obvious duplicates.
- **evidence:** `tests/dogfood/.sessions/187-mira-team-roster/04-03-roster.png`.
- **triage (developer, 2026-06-09):** confirmed — "New contact" persists a Person immediately, so abandoning it left an "Unnamed" ghost. Fix mirrors the Notes F-196 pattern: pure `isAbandonedEmpty(person)` (no name/emails/phones/role/bio/company/dates/links) + `shouldDiscardAbandoned(id, sessionCreated, persons)` — only a record created *this session* and still empty may ever be discarded; any content-authoring patch permanently removes the id from the discardable set (`patchAuthorsContent`), so an in-flight edit can never be deleted. Two triggers: navigation away from the record + the shell's `brainstorm:app-visibility`/`pagehide` park events. 17 unit tests (`apps/contacts/src/logic/abandoned-empty.test.ts`); typecheck + biome clean. **Merge/de-dup of the existing duplicates stays open as a follow-up**; the historical dupes are vault cruft a reseed would clear. Real-shell verify (window-close trigger) in the next session.

### F-159 — the graph timeline "Now" pill overlaps the edge-reason legend (nit)
- **session:** 190-marcus-graph-design-review   **kind:** design   **app:** Graph   **status:** ✅ done (2026-06-09)
- **what happened (Marcus):** bottom-left, the timeline scrubber's **"Now"** indicator sits **on top of** the legend's third row, so "Shared attributes" reads as "Now d attributes" — two distinct controls colliding in the same corner. Also: the Graph header's right group ends at Filters/Settings with **no trailing ⋯ object menu**, unlike every other app (minor parity drift).
- **evidence:** `tests/dogfood/.sessions/190-marcus-graph-design-review/01-01-settled.png` (Now over the legend), `02-02-legend.png`.
- **triage (developer, 2026-06-09):** legend lifted clear of the bottom-corner controls (`.edge-legend` now bottoms out above the history FAB / "Now" pill row instead of sitting at 12px where the pill lands). Header parity: Graph now appends the shared ⋯ object menu **last** in `.app-header__right` (`attachObjectMenuTrigger`, End-aligned) — it targets the bound `Graph/v1` record, so it stays hidden on the standalone vault graph (which isn't an entity) and appears when a saved graph is open; forcing a ⋯ with no object behind it would have been chrome theater. Real-shell verify in the next session.

## Session 185–186 — work-week kickoff + Tasks detail design review (2026-06-08)

Monday. The team is real now (Marcus on brand, Priya on research), so Mira
opened Tasks to read a deliverable on the freshly-polished detail route and
block out the week. Marcus then design-reviewed that same detail layout. The
polish pass (`fix/tasks-detail-polish` — consistent detail fields + section
rhythm + single-click title edit) gets its **first real-shell look** here.

**Positive verification (no change needed):**
- The detail route is clean and legible: title row + summary chips
  (Priority / date / project), then well-ordered uppercase sections —
  **BLOCKED BY · TAGS · TIME (Estimate/Logged) · REPEAT · SUBTASKS · COMMENTS** —
  with a right **Properties** panel (Status/Priority/Scheduled/Due/Project/
  Created/Updated). Section rhythm is even; nothing duplicated between the body
  and the panel except the glanceable summary chips. The title label now reports
  `cursor: pointer` (the single-click-edit affordance landed). Evidence:
  `185-mira-weekly-cadence/02-02-detail-top.png`, `03-03-detail-lower.png`.
- Real founder work landed correctly: three team deliverables (Beacon prep /
  review Marcus's brand v1 / Priya's Issue #4 outline) scheduled across the week
  and grouped by day on Upcoming. Evidence: `05-05-upcoming-after.png`.

### F-152 — every deliverable I scheduled is owned by a person, but Tasks has no "assignee"
- **session:** 185-mira-weekly-cadence   **kind:** gap   **app:** Tasks   **status:** ✅ done (2026-06-09)
- **what I was trying to do:** block out this week's work now that I have a team — some of it is mine, some is Marcus's, some is Priya's.
- **what happened:** there's no owner/assignee field on a task. The detail Properties panel has Status, Priority, Scheduled, Due, Project, Created, Updated — but nothing for *who owns this*. So I encoded the person into the **title string** ("Priya — Issue #4 research outline", "Review Marcus's brand system v1"). That's how every team task on my list now reads.
- **what I expected:** an **Assignee** field that points at a Person/v1 (the same people my new Contacts app holds), so I can see "everything Priya owns" without parsing titles — and so it's ready to mean something when teammates come onto shared vaults.
- **evidence:** `tests/dogfood/.sessions/185-mira-weekly-cadence/05-05-upcoming-after.png` (titles carrying the owner), `02-02-detail-top.png` (Properties panel — no assignee row).
- **triage:** _(developer — assignee as a Person/v1 EntityRef property is solo-buildable today and pre-stages the sync-gated collaboration arc; the picker + live title source already exist from Contacts F-147. Scope before building.)_
- **fix (developer, 2026-06-09):** `Task.assigneeId` (nullable Person/v1 ref, mirrors `projectId`) + an editable **Assignee** row in the detail Properties panel through the shared scalar Link picker cell (the F-147 pattern: `ValueType.EntityRef`, `allowedTypes [Person/v1]`, `count {0,1}`), resolved against the shared editor entity index Tasks already feeds for mentions. Registered `assigneeId` in the vault property catalog (`plan-properties.ts`) so the Task→Person edge projects into the Graph via the catalog-driven ref rule, labelled "Assignee". **Real-shell verified (session 199):** picker opens from the value cell, lists Contacts people, "Priya Nair" picked + persists as a chip.

### F-153 — the Repeat caption just repeats the dropdown's value back to me
- **session:** 186-marcus-tasks-detail-review   **kind:** design   **app:** Tasks   **status:** ✅ done (2026-06-09)
- **what I was trying to do (Marcus):** judge the REPEAT control in the detail body.
- **what happened:** the recurrence select reads **"Does not repeat"**, and the italic caption *directly below it* also reads **"Does not repeat"** — the helper line echoes the selected value verbatim, so it carries zero information for the default case. A caption under a control should add something the control doesn't already say (the resolved schedule, the next occurrence), not parrot it.
- **what I expected:** either no caption when the value is the trivial default, or a caption that describes the *resolved* recurrence (e.g. "Every Monday", "Next: 15 Jun") for an actual rule.
- **evidence:** `tests/dogfood/.sessions/186-marcus-tasks-detail-review/03-03-detail-lower.png` ("Does not repeat" shown twice, select + caption).
- **triage:** _(developer — hide the caption when it would equal the select label / the no-repeat default; otherwise render the human-readable resolved rule.)_
- **fix (developer, 2026-06-09):** new pure `recurrenceCaption` in `@brainstorm/sdk/recurrence-edit` — the shared editor now hides the `.bs-recur__summary` line when it would equal the no-repeat default or the selected kind's own option label, and renders the resolved rule ("Weekly on Mon") otherwise. Fixes Calendar's copy of the same echo for free (same SDK component).

### F-154 — a seeded task body shows a raw "MarcusRef check /ref" instead of a mention (watch)
- **session:** 186-marcus-tasks-detail-review   **kind:** bug?   **app:** Tasks   **status:** ✅ closed — session residue, not a bug (2026-06-09)
- **what happened:** the "Call the printer about the proofs" body renders a checklist line as literal **"Send draft to MarcusRef check /ref"** plus a trailing **empty** checkbox item — what looks like a seeded @-mention / `/ref` slash token that never resolved, left as plain text in the task body editor.
- **what I expected:** a resolved mention chip (or, if it's pure seed cruft, it shouldn't ship in the demo body at all).
- **evidence:** `tests/dogfood/.sessions/186-marcus-tasks-detail-review/03-03-detail-lower.png`.
- **triage:** _(developer — likely a seed-content artifact in the Tasks demo body, not a live editor bug; confirm whether the task-body editor registers the mention/ref nodes the seeder plants [cf. the journal #83 node-KIND lesson] before closing as seed cruft.)_
- **root cause (developer, 2026-06-09):** neither seed content nor a node-registration gap — it's accumulated dogfood-session typing in the persistent vault. Session 008 created "Call the printer about the proofs"; session 154 typed "Send draft to Marcus" into its body (todo block); session 160 then typed `Ref check ` + `/` + `ref` + Enter on the same line expecting the slash menu — it never opened, so the literal text stayed and the Enter split left the trailing empty checkbox. No repo source contains the string; the Tasks body editor registers the full node set (`FULL_EDITOR_NODES` incl. MentionNode/TransclusionNode), so a seeded mention would have resolved. Nothing to fix in code; the line is editable cruft in `tests/dogfood/.data`.

## Session 178 — Notes B11 field affordances (2026-06-08)

Real-shell pass over the four Notes rungs that landed this session
(B11.1 member mentions, B11.2 emoji toolbar row, B11.3 inline select cell,
B11.6 page-lock chord). Three worked first try; the inline select cell had a
real rendering bug, found and fixed inside the session.

### F-143 — I added options to my inline status picker but couldn't switch between them
- **session:** 178-mira-notes-b11-fields   **kind:** bug   **app:** Notes   **status:** done
- **what I was trying to do:** put an inline `/select` status cell in a note (To do / Doing / Done) and switch the picked value by clicking an option.
- **what happened:** adding an option worked (type it + Enter), but the dropdown of existing options never actually appeared on screen — clicking where an option should be did nothing, and the value stayed put.
- **what I expected:** the options dropdown shows below the chip and I can click one to switch the value.
- **evidence:** tests/dogfood/.sessions/178-mira-notes-b11-fields/03-03-picker-empty.png (chip with no visible menu) → after fix 05-04b-picker-reopened.png (menu renders with both options + Add option…).
- **triage:** _(dev)_ **DONE 2026-06-08.** Root cause: the select-field menu was an `position:absolute` child of the inline decorator, clipped away by the editor's `overflow` so it was in the DOM but invisible/unhittable (add-via-input still worked because `fill` tolerates a near-invisible input). Fixed by portaling the menu to `<body>` with `position:fixed` computed from the chip rect (the same pattern the inline-toolbar / typeahead popovers use), and checking the portaled menu in the outside-click hit-test. B11.3. Re-ran 178 → passes (switch lands "To do").
## Session 181 (rerun) — "Ollama not answering" was the agent display, not the model (2026-06-07)

### F-151 — the Agent never shows a reply even though generation succeeds
- **session:** 181   **kind:** bug   **app:** Agent   **status:** ✅ done (2026-06-07)
- **what happened (user):** "ollama not answering" — send a message, nothing comes back; "no logs in network/console."
- **investigation:** Ollama + the network broker are FINE — the network audit shows every `/api/chat` POST returning **HTTP 200 with the reply** in ~1s (`{"status":200,"outcome":"completed"}`). The agent screenshot after a send shows "No conversations yet" + the empty state: a confirmed-200 reply rendered nothing, with no error. Root cause: the transcript renders **only** from the persisted `Conversation`/`Message` entities round-tripping back through the live `useVaultEntities` snapshot. When that broadcast lags or drops, the user's own message AND the reply stay invisible forever. (Earlier "passes" were a test artifact — session 181 ran after 174, so its `.first()` reply selector matched 174's *pre-existing* message; it never actually verified a fresh reply.)
- **fix (developer, 2026-06-07):** the agent now renders the turn **optimistically** — a local echo of the user message and the assistant reply (`result.content`) appears the instant generation returns, independent of the entity broadcast; each echo is pruned once its persisted twin shows up in the snapshot. **Verified session 181**: a fresh send now renders the reply in ~12s (real 192-char generation), no 150s hang.
- **note:** the underlying flaky entity-broadcast (newly-created entities not always pushed live to `useVaultEntities`) is the deeper infra issue this works around; it also explains the user's "+ in Contacts does nothing" when the broadcast lags. Tracked for a proper shell-side fix.

## Session 184 — create a company from Contacts (2026-06-07)

### F-150 — the Company picker has no candidates; no way to make a company
- **session:** 182   **kind:** gap   **app:** Contacts   **status:** ✅ done (2026-06-07)
- **what happened (Mira):** after company became a real ref picker (F-147), it had **zero candidates** — nothing in the founder's toolset mints a `Company/v1`, so a contact could never actually name a company.
- **fix (developer, 2026-06-07):** the shared LinkCard picker only links *existing* entities, so Contacts owns creation: added `entities.write:brainstorm/Company/v1` to the manifest and an inline **"Add company"** affordance on the contact card (shown when none is set) that mints a `Company/v1` and links it in one step (`createCompanyFor` in `app.tsx`). **Verified session 184**: created "Northbound Studio" from a contact → it resolves onto the card as a clickable company link AND becomes a reusable candidate in the picker for the next contact. (Security note: new write capability scoped to `Company/v1`, the one type Contacts now authors beyond Person.)
- **scaffold follow-up (done):** the F-149 base resets (`* { box-sizing }`, `body { margin:0 }`) are now baked into `bun run new-app`'s `styles.css` template so no future app ships without them.

## Session 183 — header parity: the new React apps were missing base resets (2026-06-07)

User-reported, repeatedly: Contacts AND Agent headers were the "wrong height"
vs every other app, the Contacts "New contact" CTA was a heavy text pill (should
be an icon), and "the body has a default 8px margin." All one systemic miss.

### F-149 — Contacts + Agent headers wrong height; 8px body inset; CTA not an icon
- **session:** 183   **kind:** bug   **app:** Contacts + Agent   **status:** ✅ done (2026-06-07)
- **what happened:** both *new* React apps (Contacts, Agent) shipped without the base resets every established app carries, so: (1) the browser-default `body { margin: 8px }` inset the whole app — header not flush, reading the wrong height/position; (2) no `* { box-sizing: border-box }`, so the header's 1px border sat OUTSIDE the shared 44px (→ 45px); (3) Agent additionally re-declared `.app-header { min-height: 44px; padding: 0 12px }`, clobbering the shell-injected height + macOS traffic-light inset padding; (4) the Contacts CTA was a `data-bs-primary` text pill instead of the ghost icon button every other app uses in the header.
- **fix (developer, 2026-06-07):** added `* { box-sizing: border-box }` + `body { margin:0; padding:0; height:100%; overflow:hidden }` to both apps' `styles.css` (mirrors Tasks/Bookmarks/Notes); stripped Agent's `.app-header` height/padding overrides so it inherits the shared rule; converted the Contacts "New contact" button to a 28px ghost `.contacts-icon-btn` icon (kept `.contacts-btn` for the delete dialog). **Verified session 183 by measurement**: Tasks, Contacts, Agent all report `headerH=44, headerTop=0, bodyMargin=0` — exact parity.
- **root-cause note:** the scaffold (`bun run new-app`) and/or `@brainstorm/sdk/app-theme.css` should carry these base resets so a new app can never miss them again — filed as the durable lesson.

## Session 181 — Agent app review (work-week day 3) (2026-06-07)

Reviewed the Agent app (local-model slice) on a machine with **no Ollama
running** — session 174 hard-skips that case, so the UX had never been
exercised without a model. **No friction found — a positive verification:**
- Chrome is clean: exactly one `.app-header` (the recent single-top-header fix
  holds) and a real composer (`agent-input` + `agent-send`).
- The no-model failure path is correct: sending with Ollama down surfaces a
  clear error within bounds (`"Something went wrong generating a reply. (Ollama
  unreachable … net::ERR_CONNECTION_REFUSED)"`) with **no stuck "Thinking…"**
  placeholder — validates the recent "surfaced errors" fix. A founder gets told
  what's wrong, not a dead composer.
- **Blocked (not a bug):** the full broker → Ollama → transcript round-trip
  can't be verified here because Ollama isn't running on the host. To verify:
  `ollama serve & ollama pull llama3.2`, then `bun run dogfood -- -g "174|181"`.

## Session 179 — Contacts gets a real connection layer (work-week day 2) (2026-06-07)

Day 1 surfaced that Contacts — an app whose whole pitch is *relationships* —
had no way to actually make one. Day 2 built + verified the connection layer.

### F-147 — I can't set a contact's company
- **session:** 177   **kind:** gap   **app:** Contacts   **status:** ✅ done (2026-06-07)
- **what I was trying to do (Priya/Mira):** point a contact at their company so I can jump to it.
- **what happened:** the detail view only shows a company *link* when one already exists (read-only), and the properties panel rendered Company as a read-only text line. There was no affordance anywhere to *set* or change it — a contact could only get a company if some other app wrote the ref.
- **triage (developer, 2026-06-07):** the `company` property def was `ValueType.Text` + in the read-only set, with a stale "edited from the body chip" comment for a chip that never existed. Fix: made it a real `ValueType.EntityRef` (`allowedTypes: [Company/v1]`, `count {0,1}`) so the shared LinkCard picker cell renders; wired an `EntityTitleSource` over the live vault snapshot into the panel's `PropertiesProvider` so the picker can list + resolve companies; `applyPersonPropertyValue` maps the picked id back to `{ company: id }`. **Verified session 179**: the Company field is now an editable picker.

### F-148 — I can't add a related person to a contact
- **session:** 177   **kind:** gap   **app:** Contacts   **status:** ✅ done (2026-06-07)
- **what I was trying to do (Priya):** connect two people (a client and their colleague) so the relationship is navigable.
- **what happened:** the detail "Related people" section only rendered when links already existed, and the properties panel had no related-people field at all. No way to create a link.
- **triage (developer, 2026-06-07):** added a `links` multi `ValueType.EntityRef` def (`allowedTypes: [Person/v1]`, `count {0,50}`) rendering the shared multi LinkCard picker, backed by the same live `EntityTitleSource`; the edited labeled-ref value maps back to `{ links: ids }`. **Verified session 179**: opened a contact, added "Theo Marsh" through the picker, and it resolved into the Related-people section (navigable chip). 39 contacts unit tests green (covering the new ref-value mapping both directions).
- **watch → cleared (session 180):** 179's "1 candidate" was a popover render-timing read (600ms). Re-probed with a 1.5s settle: the picker lists the full set (4 candidates for the 4 people in the book). No bug.

## Session 175–177 — first work-week day on the new Contacts app (2026-06-07)

The new build ships a dedicated **Contacts** app (a React surface over the
shared `Person/v1` space) plus the agent local-model slice. Day one of the work
week put the team on Contacts: Mira ran it cold (first-run + add people), Marcus
design-reviewed it, Priya audited its link layer. Two app-blocking bugs and one
harness flake came out of the first hour.

### F-143 — the new Contacts app failed to build, so it never installed
- **session:** (dev boot / pre-175)   **kind:** bug   **app:** Contacts   **status:** ✅ done (2026-06-07)
- **what happened:** dev boot auto-seed died with `contacts: build: build exited with code 1` — `Cannot find package '@vitejs/plugin-react' imported from apps/contacts/vite.config.ts`. The app never got installed into the vault.
- **what I expected:** the app builds and launches.
- **triage (developer, 2026-06-07):** Contacts was converted from a plain `app.ts` stub to a React app (`app.tsx`) and its `package.json` gained the React deps, but `apps/contacts/node_modules` was still the stale stub layout (only `vite`/`typescript`/`@brainstorm/*`) — no symlink for `@vitejs/plugin-react`/`react`/`react-dom`. Bun's lockfile already listed them so `bun install` reported "no changes" and never re-materialised the missing symlinks. Fix: `rm -rf apps/contacts/node_modules && bun install` relinked them. Build green; app installs + launches.

### F-144 — Contacts looked unstyled: giant title, "New contact" stranded below the search
- **session:** 175/176   **kind:** bug   **app:** Contacts   **status:** ✅ done (2026-06-07)
- **what happened (Marcus):** the header read like an unstyled page — an oversized browser-default `<h1>` "Contacts", and the "New contact" action dropped onto its own row below the search bar instead of sitting on the header baseline.
- **what I expected:** the same 44px header as every other app — title left, action on the same row to the right.
- **triage (developer, 2026-06-07):** the shared `.app-header` rule in `@brainstorm/sdk/app-theme.css` only owns the drag-region + height/padding; the **flex layout + title face are per-app** (Tasks/Bookmarks each define them). Contacts' `styles.css` was missing the `.app-header` / `__left` / `__right` / `__title` block entirely, so the header didn't flex and the `<h1>` fell back to the browser default. Fix: added the header block mirroring Tasks/Bookmarks. Verified session 176: 45px bar, 14px/600 title, action on the same row to the right, accent button at 28px.

### F-145 — Back from a contact never returns to the list; can only ever add one person
- **session:** 175   **kind:** bug   **app:** Contacts   **status:** ✅ done (2026-06-07)
- **what I was trying to do (Mira):** add my first few contacts — create one, go back, create the next.
- **what happened:** only 1 of 3 landed. After creating a person I was stuck on its detail view — pressing Back did nothing, so there was no way back to the list to add another, and the list read empty.
- **what I expected:** Back returns me to the people list.
- **triage (developer, 2026-06-07):** root cause = a sentinel collision. Contacts modelled its **list route as bare `null`** (`Location = { id: string } | null`, `initial: null`). But the shared `NavButtons` reserves JS `null` as the "nothing to apply" return from `history.back()`/`forward()` at the ends of the stack — `goBack()` does `if (loc !== null) onNavigate(loc)`. So stepping back to the list returned `null` and was swallowed; `setLocation` never fired. Fix: model the list as a **non-null** `{ id: null }` (matching Bookmarks' `openId: null` idiom) — `Location = { id: string | null }`, `initial: { id: null }`, and the delete/reset paths updated. Now Back returns `{ id: null }` (≠ JS null) → applied → list renders. apps typecheck + contacts build clean. **Verified session 178**: added three contacts in a row, Back returned to the list 3/3, all three render in the book. (A doubled "Dana Whitfield" in the read-back is persistent-vault accumulation across 175+178, not a create bug — Sam/Theo each appear once.)

### F-146 — Priya's session aborted: "Mira's vault is already open"
- **session:** 177   **kind:** infra (harness)   **app:** dogfood harness   **status:** ✅ done (2026-06-07)
- **what happened:** session 177 failed instantly with `Mira's vault is already open (pid 27197)` — the prior session's Electron process hadn't fully released the vault's SingletonLock before the next session's `assertVaultUnlocked` ran (the prior app page had closed early). Not a product bug.
- **triage (developer, 2026-06-07):** cleared the stale lock + leftover pid and re-ran. Watch for early app-page close in 176 (the "Target page has been closed" mid-session) leaving the Electron process alive a beat too long; if it recurs, add a short settle/retry in `assertVaultUnlocked`.

## Session 170–173 — window chrome (tabs), Theme Editor, live-embed sweep (2026-06-06)

Real-shell pass over the recent shell/app changes: Chrome-style window
management + tab strip, the Theme Editor, and a full-vault sweep for live block
embeds. Marcus took the window chrome, Priya/Mira the embeds.

- **Window titles ✅** — app windows are titled with the open *object's* name
  ("Research index — Northbound", "Theme Editor"), not the app id. `170/02-notes-window.png`.
- **Single→multi tab transition ✅** — a one-tab window renders a clean title
  (no pill); clicking `+` opens a second tab and the strip flips to proper pills
  with an active state + close buttons (`173`: `tabs 1→2 solo→0 activePill=1 closeBtns=2`).
  `171/02-strip-single-tab.png`, `173/01-strip-multi-tab.png`.
- **Theme Editor ✅** — opens with the token grid + a live cross-app Preview
  panel; window strip clean. `171/01-theme-editor-window.png`.
- **Automations / Connector** — not exercised: engine spine only, not yet wired
  into the running shell UI, so there's nothing for the founder to drive yet.

### F-139 — the single-tab window header looked awkward (lone pill + stranded "+")
- **session:** 171-marcus-window-chrome   **kind:** design   **app:** shell/window-chrome   **status:** ✅ done (2026-06-06)
- **what I was trying to do:** just have a normal window for one open object.
- **what happened:** with a single tab the window showed a half-visible "tab" pill that read as neither a tab nor a title, and the new-tab `+` floated all the way out at the far top-right corner of the window. It felt off versus the clean header we had before tabs.
- **what I expected:** one object = a clean window title, with the `+` near it (browser-style), not stranded at the edge.
- **evidence:** `tests/dogfood/.sessions/171-marcus-window-chrome/02-02-strip-single-tab.png` (after).
- **resolution (developer, 2026-06-06):** a lone tab now renders as a window *title* (`.tab--solo`: transparent, primary text, 13px/600 — no pill/shadow), and `.strip__tabs` is `flex: 0 1 auto` so the `+` trails the title instead of being stretched to the window edge. Measured in real Electron (session 171): single-tab strip `solo=1 activePill=0 closeBtns=0`, geometry `tabToPlusGap=4px` (the `+` sits 4px after the title) and `plusToRightEdge=889px` (889px of slack — no longer pinned to the corner). Multi-tab pills confirmed unchanged (session 173). Note: the strip is its own shell-drawn `WebContentsView`; edits only show after a full Electron quit+relaunch, not a window reload (see memory).

### F-140 — embeds in my hub doc show static folder cards, not the live database
- **session:** 173-mira-tabs-and-embeds   **kind:** design   **app:** Notes / block-embeds   **status:** ✅ done (2026-06-06)
- **what I was trying to do:** read my "Northbound HQ" hub, where I embedded the live Clients pipeline and Content Calendar.
- **what happened:** the embeds render as static entity *cards* — a folder icon + "Clients / List", "Content Calendar / List" — not the live grid. Across the whole vault (48 docs) the only embeds are these cards (3 docs, 12 embeds, **0 loaded live frames**). The live inline render that shipped never lit up for the embeds I actually composed.
- **what I expected:** the embed reflects the live source (the Clients grid inline), or at least upgrades to it.
- **evidence:** `tests/dogfood/.sessions/173-mira-tabs-and-embeds/02-02-embed-doc-45.png` (Content Calendar card, before); `02-02-embed-doc-0.png` (Clients **live grid**, after).
- **triage (developer, 2026-06-06):** root cause = `BlockEmbedNode` freezes a `blockId` at insert time. Mira built the hub (sessions 063–088) *before* the Database app registered its `io.brainstorm.database/embedded-list` block (shipped 2026-06-06), so `blocks.forType("brainstorm/List/v1")` returned null then and the node persisted the fallback sentinel `io.brainstorm.shell/entity-card/v1`. The render path keyed off that stored id, so the documented "the same persisted node lights up later" promise never held for embeds inserted before their provider existed.
- **resolution (developer, 2026-06-06):** `BlockEmbedView` now re-resolves the fallback sentinel by entity type at render — when the stored id is `SHELL_ENTITY_CARD_BLOCK_ID`, it calls `blocks.forType(entityType)` and renders the live block if a provider now exists (`effectiveBlockId`). The on-disk node is untouched (no migration, no read-path write); an explicitly-chosen block id is always honoured; a type nobody provides stays a card. Reproduced first with two RED→GREEN tests in `block-embed-registry.test.tsx` (a `List` embed holding the sentinel upgrades to BlockProtocol + `--bp` mount; a `Note` embed stays a card — 7/7 green). Verified real-shell (session 173 re-run): the "Northbound HQ" Clients embed renders the **live grid** (Acme Research Co. / Beacon Analytics / Vertex Labs rows), liveFrames 0→2. Notes app typecheck clean. Follow-up (separate, minor): the embedded grid shows raw property/relation ids as column headers — an `embedded-list` block display concern, not this node bug.

### F-141 — Notes app icon 404'd on the dashboard (benign, falls back to initials)
- **session:** 171-marcus-window-chrome   **kind:** bug   **app:** shell/dashboard   **status:** wontfix-now (benign) (2026-06-06)
- **what happened:** dashboard load logged `http404: brainstorm://app-icon/io.brainstorm.notes?v=0.1.0` once. No visual breakage.
- **triage (developer, 2026-06-06):** `resolveAppIconPath` returns 404 when `getActiveVaultSession()` is null (handler `index.ts` ~L305) — the dashboard requested the icon during boot before the vault session was active (a transient load-race; the bundle's `apps/notes/icon.svg` exists and resolves once the session is up). The renderer's `<img onError>` falls back to a deterministic initials tile, so impact is nil. Not chasing a speculative boot-path change for a single benign log line; revisit only if it becomes a persistent miss (icon stays blank after boot).

### F-142 — the single-tab strip still looked broken (split bar, always black) + no way to add a tab once collapsed
- **session:** 173-mira-tabs-and-embeds   **kind:** design   **app:** shell/window-chrome   **status:** ✅ done (2026-06-07)
- **what I was trying to do:** just have a clean window for one open object (the F-139 follow-up — the lone-tab "title" approach still read wrong).
- **what happened:** with one tab the strip still showed as a split bar pressed to the window's top edge, always dark regardless of theme, with the "+" floating in it. It didn't read as a clean header at all.
- **what I expected:** one object = no tab bar; the app's own header is the window title.
- **evidence:** `tests/dogfood/.sessions/171-marcus-window-chrome/02-theme-editor-collapsed-strip.png`.
- **resolution (developer, 2026-06-07):** **supersedes F-139's lone-title approach.** The strip now collapses to *zero height* and hides its chrome view entirely on a single-tab window (`WindowContainer.layout` — strip only earns vertical space with 2+ tabs); the app's own `.app-header` already reserves the macOS traffic-light gutter, so the window reads exactly like the pre-tabs single window. The multi-tab strip's "split"/always-black look was two separate bugs, both fixed (`ce0db7da`): the strip background now matches the window paint (`color.background.primary`) so the strip + traffic-light gutter are one continuous title bar, tabs are vertically centred, and the active tab is an elevated surface; theme-on-switch was already wired via `CHROME_THEME_CHANNEL` (needs a full quit+relaunch to load — the strip is a separate `WebContentsView`). **Caught a regression in the same loop:** collapsing the strip also hid its "+", leaving a lone window with no mouse *or* keyboard way to open a second tab (no ⌘T existed). Fixed (`b6a0df4a`) with a **File ▸ New Tab** menu item + `CmdOrCtrl+T` accelerator routed to the focused tab's container (`launcher.containerForTabSender` → `orchestrator.addTab`, the same path the strip "+" uses) — the F-004 precedent. +6 unit tests (menu-setup handler, launcher resolver) and the dogfood `shot()` helper hardened so a hidden/zero-size surface never crashes a session. Real-shell residue: the ⌘T keyboard path depends on `getFocusedWebContents()`, which the harness can't exercise (inactive windows) — verify on a clean relaunch. Sessions 171 (`collapsed=true innerH=0`) + 173 (`menuItemPresent=true`) green.

## Session 161 — verify the outstanding-issue fix batch in the shipped shell (2026-06-06)

Real-shell pass over the five remaining friction items after fixing them.
**Three verified directly, two confirmed by test + code path** (the editor
harness can't get a clean slash capture against the cluttered persistent vault):
- **F-068 ✅** — Files header now ends with the object ⋯ (`.app-header__right .bs-object-menu__more` count=1; breadcrumb-left count=0). `01-01-files-header.png`.
- **F-048 ✅** — the resting (zoomed-out) graph paints **8 named hub labels** ("Beacon Analytics", "Research index — Northbound", "Competitive note — analytics moat", "Reading-list synthesis — the through-line", "Research — the trust tax in CI/CD", …) over the dot field, with their inferred edges — a named knowledge map, not anonymous dots. `03-03-graph-resting.png`.
- **F-045 ✅** — typing an existing open task's name ("Call the printer about the proofs") into the compose form shows the duplicate-name hint. `04-04-tasks-duplicate-hint.png`.
- **F-070b** — unit-tested (`orderCommandsByPalette`) + same render path session 157 verified; the in-shell slash capture was harness-blocked (a future journal day shows "No entry yet" with no editor; today's persistent entry is cluttered). Not a product gap.
- **F-066** — auto-discard is unit-tested; a clean real-shell capture needs a fresh vault (the persistent one's empty-note pile predates the fix) — deferred to a fresh-vault check.

## Session 160 — Reference command + card in Tasks (code-confirmed; harness miss on the probe) (2026-06-06)

Closing the one gap left from rung (c)/F-138: both were verified in the Journal
but never visually in **Tasks**, which shares the same editor mount. The probe
was a harness miss — the synthetic `/` landed in a *stale to-do item* in the
task body (the "Send draft to Marcus" checkbox from session 154) instead of a
fresh line, so the slash menu never opened (`03-03-slash-with-reference.png`
shows "…MarcusRef check /" as literal text). **No new friction** — and the
shared path is confirmed in code: Tasks mounts `FullEditorPlugins` with
`currentEntityId={taskId}` and no `transclusion={false}`
(`apps/tasks/src/ui/inspector-editor.tsx:109`), so `showTransclusion = hasEntity
= true` → the same `mergedCommands` that put "Reference" in the Journal palette
(session 157) adds it here too, and the card CSS now ships from the editor
package (F-138) so it renders framed everywhere. The Tasks body editor has no
dev hook and accumulates content across the persistent vault, which is the
recurring reason these Tasks probes miss (also 154/156); not a product issue.

## Session 159 — Priya's references survive a cold reopen, but rendered unstyled in the Journal (2026-06-06)

The real test of an embed isn't inserting it — it's whether it holds when she
comes back. Priya cold-reopened today's log (fresh shell boot, persistent
vault) and the references she dropped in 157/158 **persisted and resolved** to
the live "Clients" page. But they rendered as a **bare underlined link**
("ClientsTranscluded List" — title run straight into the subtitle, no chrome),
not the framed card the command's "Embed a live view" description promises —
because the transclusion card's CSS never shipped with the node when the editor
unified. Filed + fixed as **F-138**; re-verified the card now renders framed in
the Journal. (Stray `R` / `x` / `!@Clients x` lines in the captures are harness
keystroke residue against the persistent vault — not product friction.)

### F-138 — the "Reference" card renders unstyled (a bare link) in Journal/Tasks
- **session:** 159-priya-reference-roundtrip   **kind:** bug   **app:** Journal / Tasks (shared editor)   **status:** ✅ done (2026-06-06)
- **what I was trying to do:** read a daily log that embeds a live "Reference" to the Clients pipeline (the rung-(c) affordance).
- **what happened:** the reference resolved to the right page but rendered as a **plain underlined inline link** — "ClientsTranscluded List", the page title jammed into the literal subtitle with no separator and no card chrome (no border, no icon, no layout). The command's own caption says "Embed a **live view** of another page"; what landed read like a broken link.
- **what I expected:** the same framed card it is in Notes — bordered pill, icon slot, "Clients" title, "Transcluded List" subtitle.
- **evidence:** before — `tests/dogfood/.sessions/159-priya-reference-roundtrip/` first run (`02-02-reference-rendered.png` bare underlined text); after the fix — `03-03-journal-full.png` (framed card).
- **triage (developer, 2026-06-06):** the transclusion/inline-transclusion **nodes** live in `@brainstorm/editor` (they emit `notes__transclusion-*` / `notes__inline-transclusion-*` classes) but their **CSS lived only in `apps/notes/src/styles.css`** — 0 transclusion rules in any editor-package stylesheet. Notes styled them by accident of co-location; once the unification + F-070 rung (c) gave Journal/Tasks the node, they got the markup with no styles → the unstyled link. The "node moved to the package, CSS stayed in the app" trap ([[project_workspace_css_subpath_export]]). Fix: extracted all 21 rules into `packages/editor/src/nodes/transclusion-styles.css`, `@import`-ed from the shared `editor.css` that Notes/Journal/Tasks all already load — single source, every editor consumer gets the chrome. Class names kept `notes__`-prefixed to avoid a cross-file rename (now package-owned tech debt to neutralise when the node renderers are next touched). Real-shell verified (session 159 re-run): the journal reference renders as the framed card. Notes unaffected (still imports `editor.css`).

## Sessions 157 + 158 — Priya gets her live reference, and the double-menu is gone (2026-06-06)

The thing Priya couldn't do in session 155 — anchor a daily log to the live
Clients pipeline — now works. Kai wired **F-070 rung (c)**: a shared
**"Reference"** slash command in the Journal/Tasks editor that opens the page
picker. Two real-shell sessions verify it end-to-end, and one bug that fell out
of the first pass got fixed before it reached the log proper.

- **Session 157 (Priya, F-070 rung (c)) ✅** — the journal `/` palette now reads
  exactly like Notes: all 15 shared blocks **with descriptions** ("Text — Plain
  paragraph", …) **plus** "Reference — Embed a live view of another page".
  Picking "Reference" opens the transclusion page-picker and dropping a page
  inserts a real transclusion node in the body. Priya's blocked need from 155 is
  unblocked. Captures: `tests/dogfood/.sessions/157-priya-journal-reference/`
  (`02-02-slash-with-reference.png`, `04-04-reference-picker-open.png`).
- **Session 158 (double-menu fix) ✅** — see **F-137** below.

### F-137 — `!@` in the journal editor opened two stacked menus at once
- **session:** 157-priya-journal-reference   **kind:** bug   **app:** Notes / Journal / Tasks (shared editor)   **status:** ✅ done (2026-06-06)
- **what I was trying to do:** type the transclusion trigger `!@` to reference a page (the new rung-(c) affordance).
- **what happened:** a single `!@` opened the **mention** typeahead *and* the **transclusion** page-picker stacked on top of each other — two menus from one trigger (first seen in session 157 shot `04-04-reference-picker-open.png`). Confusing, and a keystroke could land in the wrong one.
- **what I expected:** `!@` opens exactly one menu — the page picker.
- **evidence:** `tests/dogfood/.sessions/158-priya-verify-single-menu/01-01-at-mention.png` (`@` alone → one mention/date menu) and `02-02-bang-at-transclusion.png` (`!@` → one transclusion picker, type-labeled entities, no stacking).
- **triage (developer, 2026-06-06):** root cause — `!@` satisfied *both* grammars: `detectTransclusionTrigger` matched `!@`, but `detectMentionTrigger` also matched the bare `@` inside it, so both typeaheads mounted. Fix: `detectMentionTrigger` now returns `null` when the `@` is immediately preceded by `!`, deferring that case to transclusion (`packages/editor/src/plugins/mention-ops.ts`). RED→GREEN regression test in `mention-ops.test.ts` ("defers `!@` to the transclusion trigger — never opens a mention too"). Shared-editor fix, so it covers Notes/Journal/Tasks. Real-shell verified (session 158): `@`→one menu, `!@`→one menu. (The spec's popover *count* selector over-matches — it includes `[class*="transclusion"]`, which also catches the transclusion nodes accumulating in Priya's persistent journal body across runs; the screenshots are the verdict, and they're clean.)

## Session 109 — medium-batch verification (real shell) (2026-06-04)

Confirmed F-053 + F-049 in the shipped shell. Both pass. Captures: `tests/dogfood/.sessions/109-verify-medium/`.
- **F-053 ✅** — the time-zone picker is grouped: `Common` first, then Africa / America / Asia / Europe / … region optgroups (no more 400-item flat scroll).
- **F-049 ✅** — the Graph panel reads plainly: headers `Filters` / `Types to show` / `Connections` / `Matches`, and the hint is "Choose what to show and how it's connected…" — the "subjects / typed connections / Where" jargon is gone.
## Session 155 — Priya does cited knowledge work in the shared-editor Journal (2026-06-06)

Now that Journal shares the full editor, Priya wrote a cited daily research log
and tried the two things her work depends on. **@-mentions work** — typing
`@Clients` opened the typeahead and inserted a real, resolved mention chip in
the journal body (a genuine unification win; the journal used to be a plain
paragraph box). But **she could not anchor the log to live evidence**: the
journal `/` palette has no embed / transclusion / reference block at all (15
items: Text, H1–H3, bulleted/numbered/to-do, quote, code, callout, divider,
toggle list, table, 2/3 columns), and every item shows a **bare label with no
description**. So her explicit need — "anchor this log to the live Clients
pipeline and the source I'm leaning on" — is blocked by the palette. This is the
knowledge-work angle on **F-070**; corroborating evidence added there.

(Harness notes, not product: a stray "R" at the top of the entry is the seed
keystroke that fires the placeholder→editor handoff — only the first char of a
synthetic `keyboard.type` lands in a Yjs editor; and "1 word" is the counter not
updating on programmatic `appendParagraph` writes, which bypass the input path a
real typist would trigger. Neither is filed.)

### F-070 (update) — knowledge-work corroboration from Priya (session 155)
- **status:** open (unchanged — this is the design fork F-070 already flagged)
- **new evidence:** `tests/dogfood/.sessions/155-priya-journal-knowledge/04-04-mention-picked.png` (the `@Clients` mention resolves to a chip — mentions work in Journal) and `05-05-slash-palette.png` (the journal palette: 15 bare-label items, **no embed/transclusion/reference**).
- **direction chosen (owner, 2026-06-06):** **one catalogue + per-app palette** — the shared catalogue becomes the single source (descriptions everywhere); each app declares a deliberate ordered subset and appends only its genuinely app-specific commands; Journal/Tasks gain embed/transclusion. Tracked as plan iteration **9.18.3c** (rungs a–d).
- **rung (a) landed + real-shell verified (developer, 2026-06-06):** canonical `editor.block.*.description` strings added to the editor i18n and wired into `createStandardBlockCommands`, so the shared catalogue now carries descriptions. Session 156 (Marcus) confirmed the **Journal** slash menu renders all 15 captions matching the canonical strings ("Plain paragraph", "Largest section title", …) — `tests/dogfood/.sessions/156-marcus-verify-f070-descriptions/01-01-journal-slash.png`. Tasks shares the identical code path (the 156 Tasks probe was a harness miss — it stayed on the Upcoming list, never reached the detail editor — not a regression). `standard-commands.test.tsx` asserts every shared command carries a resolved description.
- **rung (b) landed (developer, 2026-06-06):** a `palette?: readonly string[]` seam on `FullEditorPlugins`/`StandardEditingPlugins` — an ordered subset of shared command ids; the catalogue is filtered + reordered to match (pure `orderCommandsByPalette`, unit-tested; default = full set), and the host-gated "Reference" still appends after. First consumer: the **Journal** declares a deliberate daily-log palette (`JOURNAL_BLOCK_PALETTE`) that **drops the 2- and 3-column layouts** Marcus flagged as backwards for a dated entry. So the "arbitrary subset" half of F-070 is now a *deliberate, per-app* subset.
- **rung (c) landed + real-shell verified (developer, 2026-06-06):** a shared **"Reference"** slash command (`block.transclusion`, category Embed) added to `FullEditorPlugins` whenever transclusion is enabled — it inserts the `!@` trigger so the existing transclusion typeahead opens for picking the page. Host-gated (not in the always-on base catalogue), so it surfaces in Journal/Tasks (entity context present) exactly where Priya needed it. Session 157 confirms it in the real shell — "Reference — Embed a live view of another page" sits in the journal palette and dropping a page inserts a transclusion node. Surfaced + fixed one bug doing it (**F-137**, the `!@` double-menu, session 158). `standard-commands.test.tsx` (`createTransclusionCommand` host-gated) + `mention-ops.test.ts` (`!@` defers to transclusion) cover both. **F-070 stays open** pending rungs (b) palette-subset seam and (d) Notes migration off its bespoke catalogue.
- **root cause confirmed (developer, 2026-06-06):** there are **two block-command catalogs**, not one filtered list. Notes builds its own rich, *described* slash catalog locally (≈30 blocks incl. image/video/embed/equation/etc.); Journal/Tasks get the shared `StandardEditingPlugins` set built by `createStandardBlockCommands` (`packages/editor/src/standard-commands.tsx`), which is leaner and whose `turnIntoCmd`/`turnIntoAction` entries carry **no `description`** (the slash row renders `command.description` only if present — `slash-menu-plugin.tsx:247`). So both F-070 symptoms — the arbitrary subset *and* the missing descriptions — trace to the same gap: the unification moved the *plugins* into the package but not the *command catalog*. Resolving it is a real refactor + a design decision (the canonical shared catalog, the deliberate per-app palette, whether Journal/Tasks expose embed/transclusion, descriptions everywhere) — **war-room / plan-iteration territory, not a drive-by patch.** Left open pending that decision.

## Session 154 — Mira uses the shared editor in a Task for real, then round-trips it (2026-06-05)

Past 151–153's "does it mount" probes: Mira opened a deliverable and actually
planned it in the task body — typed structured notes, inserted a real block
from the `/` menu, then left and came back. **The unification delivers** — full
prose lands (not just the first char), the slash menu opens and inserts in the
Tasks body exactly like Notes, and her body content persists (session 152's
line was still there this session). One real bug fell out of inserting the
to-do block; the detail round-trip itself was inconclusive (harness nav landed
on Inbox, not the task's list — a spec artifact, not product friction).

### F-136 — a brand-new "To-do list" block inserts already checked off
- **session:** 154-mira-task-notes-roundtrip   **kind:** bug   **app:** Notes / Journal / Tasks (shared editor)   **status:** ✅ done (2026-06-05)
- **what I was trying to do:** add a to-do to a deliverable — `/` → "To-do list" → type the item.
- **what happened:** the moment the block inserted, the item came up **checked and struck through** ("Send draft to Marcus" with a filled checkbox), as if I'd already completed it — before I'd touched the checkbox. A fresh to-do reading as *done* is backwards and quietly wrong (it'd hide the item under "show completed").
- **what I expected:** a new to-do starts **unchecked**, ready to be ticked when it's actually done.
- **evidence:** `tests/dogfood/.sessions/154-mira-task-notes-roundtrip/06-06-block-inserted.png` (checked + strikethrough on insert); `05-05-slash-todo-filtered.png` (the `/todo` → "To-do list" pick)
- **triage (developer, 2026-06-05):** confirmed in code — `turn-into-plugin.tsx:64` built the seed item with `$createListItemNode(listType === "check")`, but that argument **is the `checked` flag**, so a check list seeded its first item `checked: true`. Shared-editor bug, so it bit every app (Notes/Journal/Tasks) since the unification, not just Tasks. Fix: pass `listType === "check" ? false : undefined` so a fresh to-do starts unchecked. RED→GREEN regression test `packages/editor/src/plugins/turn-into-todo.test.tsx` (dispatches `TURN_INTO_COMMAND(TodoList)`, asserts the first item is unchecked); 37 editor block/command tests green, packages typecheck clean. (Running dogfood vault picks up the fix on the next `dogfood:build`.)

## Session 153 — Marcus reviews shared-editor consistency across apps (2026-06-05)

Marcus turned his consistency lens on the editor unification's promise — the
"same" writing surface across Notes/Journal/Tasks (all on `FullEditorPlugins`).
He triggered the block (`/`) menu in each and compared them. The editor mounts
are solid everywhere (verified in 151/152), but the **block menu is materially
different between apps** — which is exactly the inconsistency a shared component
is supposed to eliminate. Filed as F-070.

### F-070 — the "shared" editor shows a different block menu in each app
- **session:** 153-marcus-editor-consistency   **kind:** design   **app:** Notes / Journal / Tasks (shared editor)   **status:** ✅ done (2026-07-17)
- **resolution (completion, 2026-07-17, shell PR #178):** the remainder closed — embed + transclusion blocks now available in the Journal and Tasks editors (insert via palette, render, navigate), wired through the shared editor layer rather than per-app forks; rode on #177's editor-theme de-duplication (Notes now consumes the shared editor-theme.css — the 0.4.6 'separate task' note discharged).
- **what I was trying to do:** confirm the unified editor feels identical everywhere — same blocks, same menu.
- **what happened:** the `/` block menu diverges between apps that supposedly share one editor:
  1. **Palette size/contents differ.** Notes offers ~30 block types (Text, headings, lists, quote, code, callout, **image, video, audio, file, property, toggle headings, table of contents, sub-page, embed, equation, checkbox, date, number, bookmark**, divider, toggle, table, columns). Journal offers **15** — a strict subset: Text, H1–H3, bulleted/numbered/to-do lists, quote, code, callout, divider, toggle list, table, 2/3 columns. So Journal is missing image/video/audio/file/property/toggle-headings/ToC/sub-page/embed/equation/bookmark — yet it *keeps* table + 2- and 3-column layouts, which feels backwards for a daily log (I'd want an image or an embed in a journal entry far sooner than a 3-column layout). The subset reads arbitrary, not curated.
  2. **Item presentation differs.** The Notes menu shows a **description under each label** ("Text — Plain paragraph", "Heading 1 — Largest section title", "Callout — Highlighted info / tip / warning box"). The Journal menu, otherwise identical-looking, shows **bare labels with no descriptions**. Same component, two different renderings — that's the kind of detail that makes a tool feel unfinished.
  - (Tasks registers its own node set too, so it's likely a third variant; its menu opens fine — see session 152 — but I couldn't get a clean item-by-item read in this harness because the Tasks detail route's nav state and empty-body focus were flaky to drive. Worth measuring its palette explicitly.)
- **what I expected:** if the editor is shared, the block menu should be one curated thing — same items (modulo blocks an app genuinely can't host, and *those* omissions should be deliberate, not incidental) and the same presentation (descriptions either everywhere or nowhere).
- **evidence:** `tests/dogfood/.sessions/153-marcus-editor-consistency/01-01-notes-slash.png` (Notes: 30 items, with descriptions) vs `02-02-journal-slash.png` (Journal: 15 items, no descriptions)
- **triage:** _(developer: the divergence comes from each app registering a different node set — Notes full, Journal `JOURNAL_EDITOR_NODES`, Tasks `STANDARD_ADDITIONAL_NODES` — and the slash-menu config keying off that. The palette filtering is partly correct (don't offer a block the app can't render) but (a) the Journal subset needs a deliberate decision, not whatever happens to be registered, and (b) the description-vs-no-description split looks like a menu-config wiring gap, not an intentional choice. Pairs with the stale "keep it light" comment flagged in session 151. War-room candidate: what's the intended per-app block palette as the unification lands?)_

## Session 152 — Mira adds notes in the shared-editor task detail (2026-06-05)

**No product friction — task notes are real rich text now.** The other half of
the unification: a task's detail body mounts `FullEditorPlugins`
(`tasks-detail__editor`), the same stack as Notes/Journal. Mira opened a
deliverable ("Call the printer about the proofs") on its detail route, dropped
into the body, and typed a working note — it landed cleanly (no Yjs-keystroke
corruption), and `/` **opens the full block menu** (Text, H1–H3,
bulleted/numbered/to-do lists, Quote, Code, Callout) right in the task body, with
the Notes-style block gutter (drag handle + `+`) and the properties panel
alongside. The task "notes" field is no longer a flat string — it's the full
editor. **No `[tasks/inspector-editor]` / `#83` / decorator / Y.Doc / seed-plant
errors** in the console.
- evidence: tests/dogfood/.sessions/152-mira-task-shared-editor/04-04-task-slash-probe.png (block menu open in the task body)

## Session 151 — Priya writes in the shared-editor Journal (2026-06-05)

**No product friction — the Journal got *more* capable.** On the shared-editor
build (Tasks + Journal now mount `@brainstorm/editor`'s `FullEditorPlugins`),
Priya wrote a structured daily log directly in the Journal day view. The live
`JournalEntryEditor` mounted cleanly after the first keystroke (placeholder →
editor handoff, entry `journal-2026-06-05`), the structured body went in, and —
the headline — typing `/` now **opens the full block menu** (Text, H1–H3,
bulleted/numbered/to-do lists, Quote, Code, Callout) right in the journal. The
old in-place journal editor was deliberately "light" (no slash menu — you opened
the day in Notes for blocks); the unification brings the Notes suite to the day
view. **No `#83` / decorator / Y.Doc / seed-plant errors** in the console. From
the knowledge-layer lens this is a win: structured journaling without leaving the
calendar context.
- evidence: tests/dogfood/.sessions/151-priya-journal-shared-editor/03-03-journal-slash-probe.png (slash menu open in the day editor)
- dev note (not founder-visible): `apps/journal/src/ui/entry-editor.tsx`'s header comment is now stale — it still claims "no MentionTypeahead, no SlashMenu, no TablesPlugin … Journal-in-place keeps the chrome light," but the mount is `<FullEditorPlugins>`. Worth a comment update (and a design confirm that Journal *intends* the full suite now) as the unification lands.

## Session 150 — Marcus re-checks the dashboard grid layout (2026-06-05)

**No product friction.** After the `dashboard/grid.ts` layout rework, the launcher
grid reads clean: two aligned rows, even spacing, tidy wrapping, glyphs rendering
(post-F-069). No layout regression. (Box-metric probe was noisy from over-matching
nested elements — verdict taken from the capture.)
- evidence: tests/dogfood/.sessions/150-marcus-dashboard-grid/01-01-dashboard-grid.png

## Session 149 — Mira re-checks the Northbound HQ hub (regression) (2026-06-05)

**No product friction — keystone intact.** After a week of new notes/issues/links,
the operating hub still composes cleanly: the investor brief transcludes inline
(Thesis/Traction + nested Clients List), **0 broken/missing markers**. No
regression in the composition layer from the added content.
- evidence: tests/dogfood/.sessions/149-mira-hub-regression/01-01-hub.png

## Session 148 — Priya checks search findability (2026-06-05)

**No product friction.** Searching the notes for "moat" surfaced exactly the
relevant pieces — Issue #3 (Distribution moats), the Competitive note (analytics
moat), and the craft-trial briefs. Search answers by theme; the knowledge base is
findable end to end. (The 2× craft-trial result is the known duplicate-note cruft,
correctly returned.)
- evidence: tests/dogfood/.sessions/148-priya-findability/01-01-search-moat.png

## Session 147 — Marcus re-checks property cells (inconclusive) (2026-06-05)

**No friction; inconclusive probe.** Tried to re-review the property-cell rendering
(sdk WIP) but Clients is a gallery view, so the grid-cell locators (`.bs-cell-pill`)
matched nothing and the capture caught a card cover, not the cells. No verdict
manufactured from uninformative captures. No regression signs — the cell pills /
values have rendered correctly across many prior sessions (118/119/125/139/146).
A useful future angle would be a grid-backed list (Projects) for the inline cells.

## Session 146 — Mira runs the numbers on the Clients book (2026-06-05)

**No product friction.** Mira read the Clients collection and tallied the book:
Vertex $48k + Acme $25k (Active) + Beacon $12k (Lead) = **$85k** ($73k active).
Values + stage chips all render correctly. Pure operator read; nothing to fix.
- evidence: tests/dogfood/.sessions/146-mira-running-numbers/01-01-clients.png

## Session 145 — Priya builds a research index (2026-06-05)

**No product friction.** A "Research index — Northbound" note links two pieces as
clean inline chips (`@Research — the trust tax in CI/CD`, `@Beacon Analytics`) —
both real graph edges post-F-067. Confirms the corrected single-token mention
method holds across multiple mentions in one doc, and the graph is getting
genuinely connected as Priya builds.
- evidence: tests/dogfood/.sessions/145-priya-research-index/01-01-index.png

## Session 144 — Marcus re-checks Database (live WIP) (2026-06-05)

**No product friction — no regression.** Rebuilt the Database app with its live
source WIP (`app.ts` / `styles.css`) and re-reviewed the grid: columns clean
(NAME / CREATED AT / RESEARCH NOTES / UPDATED AT), the relation chip renders, and
the footer reads **"1 row"** — the F-065 fix still holds on the exact surface
where it first surfaced (session 118). The in-flight DB changes didn't regress
anything visible.
- evidence: tests/dogfood/.sessions/144-marcus-database-recheck/01-01-grid.png

## Session 143 — Mira opens her workspace; F-069 re-check (2026-06-05)

**F-069 resolved (see above).** Mira's start-of-day glance at the home screen
doubled as the F-069 re-check: **18/18 glyph imgs loaded** now (was 0 in session
141), so the dashboard icons render properly again after `build:app-icons` + the
shell rebuild. One tile still on its initials fallback (one app lacks a glyph
asset — correct). No outstanding product friction.
- evidence: tests/dogfood/.sessions/143-mira-workspace-open/01-01-dashboard.png

## Session 142 — Priya writes a competitive note linking Beacon (2026-06-05)

**No product friction — validates two fixes together.** A short competitive note
with a single `@Beacon` mention inserted cleanly as an inline chip (mid-sentence,
no plain-text spillover) — confirming the corrected token-then-pick mention method
(F-135 playbook rule) AND that the mention materializes as a real graph edge
(F-067). Both working in concert.
- evidence: tests/dogfood/.sessions/142-priya-competitive-note/02-02-note.png

## Session 141 — Marcus re-reviews the dashboard app-icons (2026-06-05)

### F-069 — dashboard app-icons are all showing the initials fallback (glyph art not loading)
- **session:** 141-marcus-dashboard-icons   **kind:** bug?/wip   **app:** shell/dashboard   **status:** ✅ resolved — stale built-art during rework (2026-06-05)
- **✅ resolution (session 143):** it was the stale-build hypothesis — once `build:app-icons` regenerated the glyph assets (ran during the 141 commit) and the shell was rebuilt, the dashboard now renders **18/18 glyph imgs loaded** (`naturalWidth > 0`), where 141 had **0** (all initials). One tile still shows initials (one app has no glyph asset — correct fallback). Not a code defect; the in-flight rework just needed the icon build + a restart, as flagged.
- **what I noticed:** every app tile on the home screen renders its 2-letter **initials** (NO, FI, BA, GR, TA, CA, JO, …) on the gradient, not its glyph. The *tiles* themselves are coherent — uniform glossy dark treatment, consistent shape/spacing — it's specifically the glyph art that's absent.
- **why:** `app-icon.tsx` renders the glyph `<img>` when an icon asset exists, else falls back to initials-on-gradient. Initials across the board = no glyph asset resolving. This lines up with the **active icon rework** (all 19 apps' `icon.svg` are modified in the working tree).
- **likely fix / confirm:** if this is the in-progress rework, the built art just needs regenerating — `bun run build:app-icons` (then full shell restart). If you're NOT mid-rework, the glyph asset path has regressed. Flagging so it's a deliberate state, not a silent one.
- **evidence:** tests/dogfood/.sessions/141-marcus-dashboard-icons/01-01-dashboard.png
- **triage:** not a shipped-product defect (it's live WIP) — surfaced for confirmation, no code change.

## Session 140 — Marcus design-reviews the Tasks surface (2026-06-05)

**No product friction — clean surface.** Today reads consistently: toggle + name +
Priority/date/Inbox chips per row, tidy surface nav (Inbox/Today/Upcoming +
Projects + Archived). The date chips use relative for recent ("Yesterday") and
absolute for older ("2 Jun") — a sensible pattern, not an inconsistency. The
earlier duplicate seed tasks (noted session 119) have cleared via completions.
Verdict from captures.
- evidence: tests/dogfood/.sessions/140-marcus-tasks-review/01-01-today.png

## Session 139 — Mira reviews the Candidates pipeline (2026-06-05)

**No product friction.** The Candidates grid reads cleanly — 4 candidates from the
designer hiring round (Marcus Lee, Tom Becker, Sofia Alvarez, Priya Nair), tidy
columns, and a correct **"4 rows"** footer (incidental re-confirmation that the
F-065 plural fix holds).

Fiction continuity note (NOT product): the seed Candidates list includes a
"Priya Nair — Sr. Brand Designer" from the designer round — same name as the
research-editor persona we hired in session 121, but a different (fictional)
person. Noted so future sessions don't conflate the two Priyas; no app change.
- evidence: tests/dogfood/.sessions/139-mira-candidates-pipeline/01-01-candidates.png

## Session 138 — Priya reviews the Content Calendar pipeline (2026-06-05)

**No product friction — pipeline coherent.** The Content Calendar collection
renders as a calendar-layout view with Issue #1/#2/#3 scheduled one per week
(Jun 9 / 16 / 23). The issues Priya's drafting are tracked with dates, not
floating as loose docs — and it's the same DB collection shown as a month
calendar (cross-app/multi-view working). Nothing to fix.
- evidence: tests/dogfood/.sessions/138-priya-content-calendar/01-01-content-calendar.png

## Session 137 — Marcus design-reviews the Files surface (2026-06-05)

Rows read consistently (glyph + name + "Empty folder" + relative modified), the
List/Grid/Gallery switcher + search are clean. One consistency question:

### F-068 — Files puts the object ⋯ menu on the breadcrumb (left), not last in the header-right group
- **session:** 137-marcus-files-review   **kind:** design   **app:** Files   **status:** ✅ done (2026-06-06)
- **resolution (developer, 2026-06-06):** aligned to the cross-app convention without losing the breadcrumb nav model. The breadcrumb keeps its **right-click** object-menu trigger (`ObjectMenuTrigger noMoreButton` — "the right-click trigger stays on the title"), and a standalone **`ObjectMenuMoreButton`** is now the **last** element in `.app-header__right` (after New + the two panel toggles) — the SDK already had this exact split (`ObjectMenuMoreButton`'s doc names "the rightmost header chip while the title stays a context-menu wrapper"). So Files now reads identically to Notes/Database/Whiteboard: ⋯ anchors the trailing edge, right-click stays on the breadcrumb. No new CSS, no convention exception needed. apps typecheck clean.
- **what I noticed:** every other app (Notes, Database, Whiteboard, Calendar) ends `.app-header__right` with the object ⋯ menu (the documented "⋯ last" rule). Files instead anchors its object ⋯ to the **breadcrumb** in `.app-header__left`; the right group is just New + the two panel toggles, no ⋯.
- **why it might be fine:** Files is breadcrumb-navigated and the "object" is the *current folder* — anchoring its menu to the breadcrumb is a defensible pattern, and the ⋯ is still visible (dim-on-rest via `ObjectMenuTrigger`).
- **why it's worth a look:** it's a real deviation from the cross-app convention; a consistency-strict user reads "the ⋯ is somewhere different here." Either bless the breadcrumb pattern as the Files exception (and note it in the convention), or move the object ⋯ to last in `.app-header__right` to match.
- **evidence:** tests/dogfood/.sessions/137-marcus-files-review/01-01-resting.png
- **triage:** confirmed in code (`apps/files/src/app.tsx`: ObjectMenuTrigger in `.app-header__left`; right group = New + 2 panel toggles). **Design decision, not a rushed fix** — moving it could be wrong for Files' nav model. Left for a human call.

## Session 136 — Mira's weekly operating review (2026-06-05)

**No product friction.** Mira closed the week with a review (team / pipeline /
knowledge base / next week) posted to the team channel. She opened the Journal to
review the week; the entry editor renders fine (placeholder present), but its
**dev hook** (`__brainstormJournalDev`) didn't install within an 8s wait this run
— a harness/dev-tooling flake (it worked in session 120), not a product issue, so
the review was routed to the chat (the natural home for a founder wrap-up anyway).
Worth a look only if a future session needs to write Journal *content* — the
editor itself is fine for real users.
- evidence: tests/dogfood/.sessions/136-mira-weekly-review/01-01-journal.png

## Session 135 — Priya writes a synthesis note linking her research (2026-06-05)

**No product friction.** Priya wrote a "Reading-list synthesis" note; the
`@Research` mention inserted as a real chip (and post-F-067 that's now a live
graph edge). The two `@Issue #1/#2` mentions stayed plain text — a **harness
error** (the spec typed the full multi-word title, and the typeahead closes at the
space; real users type `@Issue` then pick). Playbook updated with the
type-the-token-then-pick rule. Not a product defect.
- evidence: tests/dogfood/.sessions/135-priya-synthesis-links/01-01-synthesis.png

## Session 134 — Marcus design-reviews the Whiteboard (2026-06-05)

**No product friction — clean surface.** Tool palette (Select / Sticky / Text /
Frame) + zoom control read clearly; the header ⋯ ("More actions") sits last per
the standing rule; and a persistent bottom hint bar surfaces the shortcuts
(S/T/F, drag-to-connect, pinch-to-zoom) — good quiet discoverability. The two
"unlabeled" header buttons were just the text buttons Arrange/Export, not a11y
gaps. Marcus's sparing-praise verdict. Verdict from captures.
- evidence: tests/dogfood/.sessions/134-marcus-whiteboard-review/01-01-resting.png

## Session 133 — verify the F-067 fix (2026-06-05)

**Fix verification session** (see F-067 above). Priya wrote a note that
`@`-mentions Beacon; a temporary shell link-count log showed the vault snapshot
go from **1 link → 2** once it autosaved — confirming note→note edges now
materialize. Diagnostic since reverted.

## Session 130 — Priya audits the knowledge graph (2026-06-05)

### F-067 — the graph shows my knowledge as 88 disconnected nodes (0 edges)
- **session:** 130-priya-graph-audit   **kind:** bug   **app:** Graph   **status:** ✅ done + verified (2026-06-05)
- **✅ FIX (session 133):** note→note edges are now materialized. At autosave the Notes app extracts body cross-refs from the live `SerializedEditorState` (`extractNoteReferences`) and persists them to `properties.bodyRefs`; the shell projection (`noteToProjection`) now prefers `coerceNoteReferences(note.bodyRefs)` over walking the flat `body` snippet, falling back to the body walk for legacy/rich-JSON rows. `coerceNoteReferences` extracted to `@brainstorm/sdk/note-references` (shared by the notes codec + shell). Files: `note-references.ts`, `note-entities-codec.ts`, `vault-entities-service.ts` (pass `bodyRefs` through), `notes/store/note.ts` + `codec.ts` (StoredNote field + round-trip), `notes/app.tsx` (autosave). Tests: 4 new codec cases (13 pass) + the full entities/notes-store suite (307 pass). **End-to-end verified:** a temporary link-count log showed the vault snapshot go from **1 link → 2 links** the moment a new note's `@Beacon` mention autosaved — the edge now exists where before there were none. Diagnostic reverted; shell+notes rebuilt clean.
- **Backfill note:** existing pre-fix notes only gain edges on their next save (their `bodyRefs` aren't populated yet); a one-time migration to backfill from the Y.Doc bodies is a possible follow-up if we want the whole existing vault connected immediately.
- **what I was trying to do:** open the graph to see how the research connects — issues, briefs, clients, reading list as one web.
- **what happened:** the graph is a field of isolated dots. The MATCHES panel reads **Visible nodes 88, Visible edges 0**. Despite a vault full of cross-links — the Beacon `@`-mention, the HQ hub's nested transclusions (investor brief, Clients list, thesis), the issue citations — the map shows essentially no connections.
- **what I expected:** the links I've been making all run to render as edges; the graph is where "is my knowledge connected?" gets answered, and right now the answer looks like "no" when it shouldn't.
- **evidence:** tests/dogfood/.sessions/130-priya-graph-audit/01-01-graph-settled.png
- **triage (read-only trace, session 131):** the projection path **exists and looks correct**, so this is *not* "we never build body links":
  - `vault-entities-service.ts` body-walks `BODY_PROJECTED_TYPES = {Note/v1, Journal/Entry/v1}` and re-derives their edges from the rich-text `body` every snapshot.
  - `note-entities-codec.ts` → `noteToProjection()` turns each body ref into a `links` row, via `extractNoteReferences()` (re-exported from `@brainstorm/sdk/note-references`), which handles **MENTION**, **BLOCK_EMBED**, and **TRANSCLUSION** node types — so the `@Beacon` mention and the hub transclusions *should* each yield a link.
  - the snapshot then **drops dangling links** (`out.links = out.links.filter(l => entityIds.has(l.destEntityId))`).
  So the 0-edges almost certainly comes down to one of: **(a)** the ref dest IDs (parsed from the `brainstorm://entity/<id>` URI the persisted nodes store) don't match the real entity IDs in the snapshot → every body link is dropped as dangling; or **(b)** the graph's whole-vault default (no pattern selected) doesn't *render* edges even when present.
  - **confirm next (needs runtime, hence still dedicated):** log `out.links.length` before/after the dangling filter for the dogfood vault (does the filter zero them?), and compare a mention's parsed dest id against `Beacon`'s actual entity id. If dest IDs mismatch → fix is in the URI/id parsing or how persisted nodes store the target. If links survive but the graph shows 0 → it's a graph default/pattern issue.
  - **Not a blind fast-turn patch** (reproduce-before-patch: needs the runtime link count first). Highest-value finding of the run — Priya's lens working as intended.
- **✅ ROOT CAUSE CONFIRMED (session 132, temporary main-process diagnostic, since reverted):** ran the dogfood vault through `vaultEntities.list()` with link-count logging. Result: **88 entities, 1 link total, 0 dropped as dangling** — so it's *not* the dangling/ID-mismatch hypothesis. A second probe in the note-walk: **`noteRows=35, bodyDerivedLinks=0`, and `firstBodySample` was the plain string `"Issue #3 — Distribution moats at seed (draft)"`.** So:
  - The note entity rows in `entities.db` carry `properties.body` as a **plain string** (title/snippet), **not** the rich-text Lexical tree. `extractNoteReferences` walks a Lexical node tree for mention/embed/transclusion nodes; handed a plain string it correctly returns **0 refs** → **no note produces any edge**. The rich body (where the `@`-mentions and transclusions actually live) is in the **Y.Doc**, which the projection never reads.
  - The single surviving link is an inferred `shared-property/Bookmark.tags` edge — the only edge type that doesn't depend on body content.
  - Net: the knowledge graph shows isolated nodes because **note→note edges are never materialized** from what's stored — the projection reads the wrong source (denormalized `properties.body` string) for the rich content.
  - **Fix options (a design call — needs a plan iteration, not a fast-loop patch):** (1) at note save/autosave, extract refs and persist them as **stored `links` rows** (cleanest — edges computed once, projection already merges stored links; matches the "stored links first" path); or (2) carry the full rich-text body JSON in `properties.body` so the existing body-walk works (bloats every row); or (3) have the projection read the Y.Doc body. Recommend (1). Owner: Yes, i wanted to suggest it too, we can index links and use them to understand what links to the object in different areas.
  - Status: **root-caused, ready to fix — awaiting go-ahead** for the (1) save-time link-persistence iteration. 

## Session 129 — Marcus design-reviews the Calendar (2026-06-05)

**No product friction — clean, polished surface.** Marcus walked month → week →
day → agenda. The calendar colour legend (Events / Tasks / Birthdays) stays
consistent from the month grid to the agenda list, event chips are colour-matched
to their calendar, month overflow uses "+N more", today is clearly marked, and
the agenda groups sensibly (Tomorrow / This week / Later). Nothing to fix — his
sparing-praise verdict. Verdict decided from captures per the hardened pattern.
- evidence: tests/dogfood/.sessions/129-marcus-calendar-review/{01-01-resting,05-02-view-agenda}.png

## Session 128 — Mira checks the Northbound HQ hub (2026-06-05)

**No product friction — strong positive on the core.** Mira searched up the hub
(search surfaced an older below-the-fold note fine) and it's fully wired:
- **Note transclusions render inline** — the "investor brief" transcludes its
  live Thesis/Traction text into the hub, not just a card.
- **They nest** — a "Clients List" embed sits inside the transcluded investor
  brief; the investment thesis transcludes too. Zero broken markers.
- This is the cross-app/Block-Protocol composition the dogfood exists to prove,
  working end-to-end.

Harness note: the first attempt looked for the hub in the visible sidebar and
missed it (older note, below the fold) — switched to the search box (the way a
user would find it), which also confirms search works. Per the hardened pattern,
verdict decided from the captures, not the spec.
- evidence: tests/dogfood/.sessions/128-mira-hub-check/02-02-hub.png

## Session 127 — Priya drafts Issue #3 (2026-06-05)

**No product friction — clean artifact.** Issue #3 ("Distribution moats at seed")
drafted via the notes dev hook: thesis → why-it-holds → from-our-desk (citing the
Beacon work) → the weekly wedge → sources/open-questions. Renders cleanly, filed
correctly under TODAY (the sidebar date-grouping TODAY/YESTERDAY/PREVIOUS 7 DAYS
works). Third real artifact from Priya this run.
- evidence: tests/dogfood/.sessions/127-priya-issue-3-draft/01-01-issue-3-draft.png

## Session 126 — Marcus design-reviews Bookmarks (2026-06-05)

**No product friction — clean surface.** The reading list reads well: favicon
placeholder, title, domain, description and tag chip all consistent; tag sidebar
and counts tidy. Nothing to fix.

Process note: the spec initially auto-emitted a "missing favicon, list looks
ragged" verdict from a zero `.bookmarks__card-favicon` count — but that was a
selector miss (the fallback is a different element; the card has a clean gradient
placeholder). Corrected the transcript and **changed the pattern**: specs now
post intent/neutral only, and the friction verdict is decided after viewing the
captures (playbook updated). Same lesson as 125 — don't trust raw selector counts.
- evidence: tests/dogfood/.sessions/126-marcus-bookmarks-review/01-01-bookmarks-resting.png

## Session 125 — Mira opens Beacon to move it to Active (2026-06-05)

**No product friction filed (inconclusive harness turn).** Mira opened the Beacon
record after approving the one-pager; the inspector shows Status (Lead), deal
size and last-contact as editable fields — the capability is intact (captures).
But driving the property-cell popover (click pill → pick "Active") from a
synthetic Playwright click proved **flaky to script** — across re-runs the
inspector-open and the right pill-target resolved inconsistently. That's a
harness limitation, not a confirmed product bug, so nothing is filed and **no
"didn't stick" claim stands** (an early auto-generated chat line to that effect
was incorrect and was removed from the transcript).

Worth a *proper* future look (not this fast turn): whether opening a record from
a gallery/grid via a single click is as reliable/discoverable as it should be —
it's now been awkward to drive in 118/119/125, though it did open in some runs.
- evidence: tests/dogfood/.sessions/125-mira-beacon-active/02-beacon-inspector.png

## Session 124 — Marcus design-reviews the Notes surface (2026-06-04)

Header order and editor chrome read consistently. One thing Marcus flagged:

### F-066 — empty "Untitled" notes pile up in the sidebar with no cleanup
- **session:** 124-marcus-notes-review   **kind:** design   **app:** Notes   **status:** ✅ done (2026-06-06)
- **resolution (developer, 2026-06-06):** Notes now auto-discards a note you **created this session, opened, and left completely empty** (no title, body, icon, cover or property values) when you navigate to another note — the Notion / Apple-Notes behaviour Marcus expected. Scoped tightly so it can **never** delete real content: (1) only **session-created** ids (`createdThisSessionRef`, set in `create`) are eligible — a pre-existing note is never touched; (2) emptiness is read off the title/body **mirrors**, which the *gated* AutosavePlugin writes only on real user input (the [[project_editor_save_contract]] invariant), so an empty mirror provably means nothing was ever typed — no autosave/flush race; (3) the prune fires on **navigate-away**, not on teardown, dodging unmount races. Pure `isAbandonedEmpty()` + a `useEffect` on `selectedId` in `use-notes.ts`; unit test `abandoned-empty.test.ts` (empty incl. whitespace → true; any title/body/icon/cover/value → false). The pre-existing dogfood-cruft rows are deliberately left as-is (auto-deleting notes a user already has would be the bigger surprise); the *behaviour* that created them is what's fixed. notes typecheck + tests green.
- **triage:** *most* of these specific rows are dogfood test cruft (sessions that clicked "New note" without finishing) — NOT representative volume. But the underlying behavior (truly-empty untitled notes persist forever) is a real paper-cut a normal user hits too. Auto-discard-on-close is a **behavioral fork** with real edge cases in this codebase (autosave race, `BlankRecoveryPlugin`, undo) — NOT a rush fix. Filing as triaged; needs a design position (small OQ / plan note) before code. No product change this turn.
- **what I was trying to do:** scan the note list to find things.
- **what happened:** the sidebar carries a stack of "Untitled · HH:MM (2)…(7)" notes — empty drafts that never got a title or body, sitting permanently alongside real docs.
- **what I expected:** a note I create and leave completely empty shouldn't persist as permanent clutter (Notion/Apple Notes auto-discard a truly-empty note on navigate-away).
- **evidence:** tests/dogfood/.sessions/124-marcus-notes-review/01-01-notes-resting.png
- **triage:** *most* of these specific rows are dogfood test cruft (sessions that clicked "New note" without finishing) — NOT representative volume. But the underlying behavior (truly-empty untitled notes persist forever) is a real paper-cut a normal user hits too. Auto-discard-on-close is a **behavioral fork** with real edge cases in this codebase (autosave race, `BlankRecoveryPlugin`, undo) — NOT a rush fix. Filing as triaged; needs a design position (small OQ / plan note) before code. No product change this turn.
- **harness note:** dogfood sessions that create notes must title them (the dev-hook sessions now do); don't leave empty drafts.

## Session 123 — Priya builds the Beacon one-pager (2026-06-04)

**No new product friction.** Priya fulfilled the 122 hand-off: a cited one-pager
making the case to move Beacon from Lead to Active (analytics-moat wedge, cited to
the reading list and the live pipeline). The connective tissue she cares about
works — `@Beacon` matched the real **Beacon Analytics** record and inserted a
resolved mention chip into the doc. Artifact shipped, narrated in the team chat.

Harness caveat (not product): my session's cursor for the "Linked record" line
landed mid-paragraph (Playwright keyboard into Lexical), so the chip split one
sentence. The *mention itself* behaved correctly — splitting around an inserted
inline node is right. Future link-insertion sessions should position at a true
empty trailing paragraph before typing `@`.
- evidence: tests/dogfood/.sessions/123-priya-beacon-onepager/{01-01-onepager,03-03-after-link}.png

## Session 122 — Mira's pipeline check + first live team-chat hand-off (2026-06-04)

**No new product friction.** Short operating session that doubles as the first
in-session use of the new **team chat** (see `README.md` → "The team chat"): Mira
reviewed the Clients pipeline (Vertex/Acme active, Beacon a $12k lead — all
rendering fine) and handed the "Beacon one-pager" to Priya in the channel, with
Kai (eng) responding. The collaboration is now watchable live via
`bun run dogfood:watch`. No bugs surfaced.

## Session 121 — Priya Nair's craft trial: the research editor starts (2026-06-04)

Northbound's **second hire**, research editor **Priya Nair** (see `README.md`),
debuts. Her lens — "is the knowledge trustworthy, findable, well-connected" —
gets pointed at the product's core, and the core holds up.

**No new product friction.** Her craft trial brief ("distribution moats at seed")
wrote cleanly via the notes dev hook (thesis → cited evidence → recommendation →
open questions), and the connective tissue she lives in all works:
- **Embed a live surface:** `/embed` surfaces an **Embed** command ("Insert a
  preview card…") plus **Bookmark** — the research-editor's central need (a brief
  that embeds the live pipeline) is present and discoverable by keyword. Resolves
  the "VERIFY embed discoverability" left open in sessions 113/114.
- **Cross-link:** typing `@` opens a rich typeahead spanning notes, clients,
  tasks, journal entries and bookmarks — well-connected knowledge works.
- evidence: tests/dogfood/.sessions/121-priya-craft-trial/{01-01-cited-brief,02-02-slash-menu,03-03-mention-typeahead}.png

One observation (not new product friction): the `@` typeahead shows the duplicate
"Call the printer about the proofs" tasks 4×, the same persistent-vault cruft
noted in session 119 — it dilutes the picker but the dupes are test data, not a
defect.

## Session 120 — Mira closes a deliverable + logs the day (2026-06-04)

**No new product friction**, and a clean live confirmation of the just-committed
Tasks fix. Ticking a deliverable dropped Today 10 → 9; flipping **Show completed**
added only **2** rows (today's finished work), not the long-finished backlog —
the `compile-surface` Today-filtering fix (commit `3d2e73c9`) behaves correctly
from a founder's seat. The Journal entry editor is present and writable. No bugs.

Two harness (not product) notes, fixed in the session spec for future turns:
- The journal editor selector was stale (`.journal__entry-editor` no longer the
  contenteditable's ancestor) — now targets the contenteditable directly.
- Raw Playwright keystrokes into the Lexical/Yjs journal only land the first char
  (known Yjs-binding race). Journal text now goes through `__brainstormJournalDev.appendParagraph`, mirroring the Notes dev-hook pattern.
- evidence: tests/dogfood/.sessions/120-mira-close-the-day/{02-02-after-complete,03-03-show-completed,04-04-journal-logged}.png

## Session 119 — Mira plans the week + checks the Clients pipeline (2026-06-04)

**No new product friction.** Mira's Today surface rendered correctly, the Clients
pipeline (Vertex Labs / Acme Research / Beacon Analytics, with engagement $ and
stage chips) is intact, and the Database footer plural fix from F-065 is live.
One thing looked like a bug and wasn't:

- **"Call the printer about the proofs" appears 5× on Today** — diagnosed as
  *persistent-vault test-data accumulation*, not a product defect. Session
  `008-small-fixes-check` types that exact string; re-running it against Mira's
  persistent vault appended a copy each time. No product code change. (Loop
  hygiene: each turn authors a *new* session number, never re-runs a
  data-creating session, so the loop itself won't add to this.)
  evidence: tests/dogfood/.sessions/119-mira-week-plan/01-01-tasks-today.png

## Session 118 — Marcus design-reviews the Database surface (2026-06-04)

### F-065 — the grid footer says "1 rows" — a tool that ships "1 rows" doesn't sweat the details
- **session:** 118-marcus-database-review   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-04)
- **what I was trying to do:** read the Projects list to see how many records it holds.
- **what happened:** the sticky grid footer reads **"1 rows"** under the Name column. Ungrammatical — the kind of seam that makes a careful user distrust everything else.
- **what I expected:** "1 row" for a single record, "N rows" otherwise (the app already does exactly this in export-flow and the filter summary).
- **evidence:** tests/dogfood/.sessions/118-marcus-database-review/01-01-database-resting.png
- **triage:** repro = direct (visible in the capture). Fixed in `apps/database/src/react/grid-view.tsx` — the footer total now pluralizes on `rows.length`, matching the app's established `n === 1 ? "row" : "rows"` idiom. Regression tests added in `grid-view.integration.test.tsx` (1 → "1 row", 2 → "2 rows").

## Session 117 — building the engagement model end to end (real shell) (2026-06-04)

Mira builds the thing session 111 said was missing: on a collection she adds an **Hours** (Duration) column and a **Research notes** (Relation) column, then links a real note. **All three work in the shipped shell.** Captures: `tests/dogfood/.sessions/117-build-engagement-model/`.

### Validation note (not a finding) — Hours + a client link land, and the relation links a real note
- Added a `Number → Duration` column "Hours" → it persists as a real grid column (`["NAME","CREATED AT","UPDATED AT","HOURS"]`). Added a `Relation` column "Research notes" → persists too. Clicking the relation cell opens the shared note picker, and picking a note shows it as a chip — the cell read back **"Issue #2 — pricing power at seed (draft)"**. So `B5.12` (Hours) + `B5.13` (Relation) compose into a working engagement model: a row carries hours *and* links to its research notes. **Remaining (filed against DT-3):** the relation only offers **notes** to link (no target entity-type picker yet — can't point it at a Client/Task/Person row), and there's no rollup of Hours across linked rows. (Harness aside: the column-add flow leaves the View-settings popover open and a bare `input[type=text]` matches the "View name" box — the session now scopes to `.bs-inline-property-form__name`.)

## Session 116 — verifying the right-panel fix (real shell) (2026-06-04)

Owner-reported friction, fixed + verified in the shipped shell. Captures: `tests/dogfood/.sessions/116-verify-inspector-close/`.

### F-064 — the Details inspector stayed open with nothing selected
- **session:** 116-verify-inspector-close   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-04)
- **what was seen (owner):** "right panel not closing when nothing is selected is quite frustrating" — the Database Details inspector, once open (a row peek), stayed open showing "Select an item to see its properties." after the selection cleared, leaving an empty panel eating horizontal space.
- **resolution (developer, 2026-06-04):** the inspector is now selection-bound — `renderInspector` closes the panel whenever the selection is empty (the peek that opened on a row simply goes away when nothing's selected), instead of lingering with the prompt. The header inspector toggle still opens it deliberately, but seeds the **first visible row** so it's never an empty shell (a no-op only on a genuinely empty grid). The dropped `inspectorPinned` nuance from the first attempt was more than asked for; the rule is now the simple one the owner wanted: *no selection → no panel.* **Verified real-shell** (session 116): peek opens → `data-inspector-open=true`; switch lists (selection clears) → `false`; header toggle → `true` (opened on the first row). apps/database typecheck + biome clean.

## Session 115 — modelling an advisory engagement (Hours + a client link) (2026-06-04)

Mira puts the two new DT-3 primitives to work — a **Duration** number format (a column of *Hours*, `B5.12`) and a **Relation** property kind (link a row to its notes, `B5.13`) — both filling the gap session 111 found (a deal was a flat `{Status, Deal size}` with no hours, no link). She opens a collection's column constructor and checks they're there. Captures: `tests/dogfood/.sessions/115-engagement-model/`.

### Validation note (not a finding) — the engagement primitives landed and are discoverable
- The property constructor now offers a **Relation** tile (link to notes, with an "Allow multiple values" toggle) and, under Number, a **Duration** format — both confirmed present in the shipped shell. So a collection row can finally carry Hours *and* link to its research notes, the two pieces an engagement model needs. **Remaining (filed against DT-3):** the relation links only to **notes** in v1 (no target entity-type picker yet — can't point it at Tasks/People/a custom collection), and there's no rollup of Hours across linked rows yet.

## Session 108 — war-room batch verification (real shell) (2026-06-04)

Confirmed the three war-room/medium fixes in the shipped shell. **All pass.** Captures: `tests/dogfood/.sessions/108-verify-warroom/`.
- **F-052 ✅** — Journal opens on **"Thursday, 4 June 2026"** (today), not the last-viewed date.
- **F-043 ✅** — Tasks shows **22 empty affordances visible at rest** (the quiet always-on rail; was `display:none` until hover).
- **F-054 ✅** — the new-event "More options" disclosure is **collapsed by default**, secondary fields hidden until expanded.

## Session 107 — the recurring cadence: Mira works the new Calendar (2026-06-04)

The Calendar grew up (9.15: Year view, recurrence editor, reminders, attendees, ICS, time-zones). Mira put it to work — set up the standing weekly design review and walked the publishing Year view; Marcus re-reviewed the expanded surface he last saw in 095. The Year view + reminders + attendees + status + colour all land well; **F-042 holds** (legend colours on the chips). Two new findings on the new event detail, one quick fix. Captures: `tests/dogfood/.sessions/107-recurring-cadence/`.

### F-053 — the Time Zone picker dumps the entire IANA database
- **session:** 107-recurring-cadence   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-04)
- **what he saw:** the event detail's TIME ZONE field defaults to "Local time" (good), but opening it is a native `<select>` of **~400 IANA zones** in one flat scroll — Africa/Abidjan … Antarctica/Vostok … Pacific/Wallis — no search, no grouping, no common-zones shortcut.
- **what he expected:** "if I ever need to change the zone, give me a search box and a short list of likely ones (my local, UTC, a few majors), not the whole tz database to scroll. A 400-item native dropdown is unusable for the one time a year I set a cross-zone call." Evidence: `02-02-event-detail.png` + the captured 400-zone option dump.
- **resolution (developer, 2026-06-04):** the flat dump is now grouped. Two pure helpers in `logic/timezone.ts` — `commonTimeZones()` (the viewer's local zone first, then UTC + ~10 major hubs, deduped + validity-checked) and `groupedTimeZones()` (the full IANA set bucketed by region prefix, regions + zones sorted). The event-detail picker renders a **"Common"** `<optgroup>` shortlist up top, then one `<optgroup>` per region (Africa / America / Asia / Europe / …); "Local time" stays the first ungrouped option and the event's own zone is still guaranteed selectable. Kept it a **native `<select>`** deliberately — that preserves full keyboard + screen-reader support *and* native type-to-search across the optgroups (so the "no search" gap is covered for keyboard users without hand-rolling a combobox). +6 tests (`timezone.test.ts` shortlist/grouping invariants · `event-detail.test.ts` grouped-picker render); apps typecheck + biome clean. Real-shell visual verify deferred to the next fix-batch session (jsdom exercises the actual DOM-building path).

### F-054 — the new-event form is an 11-field wall
- **session:** 107-recurring-cadence   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-04)
- **resolution:** the secondary fields (time zone, location, status, colour, repeat, reminders, attendees, description) now fold under a native **"More options"** `<details>` disclosure; title + all-day + starts + ends stay primary, with Save in the footer. The disclosure auto-opens only when *editing* an event that already has one of those set, so existing data is never hidden. Keyboard- and screen-reader-accessible (native summary).
- **what he saw:** "New event" stacks **eleven fields** before Save — title, all-day, starts, ends, time zone, location, status, colour, repeat, reminders, attendees — you scroll the popover to reach Save.
- **what he expected:** "a quick event is *title + when*. Show those two, put Save right there, and fold time-zone / status / colour / attendees behind a 'More options' disclosure. As-is, jotting a 30-minute call feels like filing a form." Evidence: `02-02-event-detail.png`.

### F-053b — "Custom (RRULE)" leaked iCalendar jargon (FIXED)
- **session:** 107-recurring-cadence   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-04)
- **what he saw:** the REPEAT options ended with **"Custom (RRULE)"** — RRULE is RFC-5545 internals (same schema-leak smell as "CodeFile entities" in F-051).
- **resolution:** relabelled to **"Custom…"** (`calendar.recurrence.kind.custom`); the builder still opens, the acronym's gone.

## Session 106 — fix-batch verification (real shell) (2026-06-04)

Re-ran the fixed surfaces against a fresh build to confirm the unit/typecheck-only fixes hold in the shipped shell. **All five pass.** Captures: `tests/dogfood/.sessions/106-verify-batch/`.
- **F-040 ✅** — agenda chips: *no* "0:00"; Draft Issues read "All day".
- **F-039 ✅** — the seven same-minute blanks now read "Untitled · 23:31", "(2)" … "(7)" — 11/11 untitled labels distinct.
- **F-047 ✅** — Files sidebar shows only "FOLDERS"; the empty "Smart folders" / "Tags" sections are gone.
- **F-050 ✅** — Bookmarks surfaces: Inbox / Read / Archive / **Tag board** (no second "Tags").
- **F-051 ✅** — Code Editor empty copy: "Snippets, configs, and REPL scratch files you create in this vault open here." (no "CodeFile entities").

## Sessions 103–105 — first-week work + Marcus sweeps the last apps (2026-06-04)

The week continues: Mira **drafts Issue #1** end to end (Notes, ~1015-char body, 103), **checks the pipeline** (Clients + Content Calendar, 104), and **logs the days** (Journal). Marcus closes out his app-surface sweep — **Graph** (103), **Bookmarks** (104), **Code Editor** + **Journal** (105). Five new findings, and a theme: **seed cruft + thin empty-states** recur across apps. Captures under `tests/dogfood/.sessions/103…`, `104…`, `105…`.

### F-048 — the Graph is an unlabeled, near-edgeless dot-field (Marcus)
- **session:** 103-issue-1-draft   **kind:** design   **app:** Graph   **status:** ✅ done (2026-06-06)
- **resolution (developer, 2026-06-06):** both halves addressed without a risky LOD rewrite.
  - **Labels at rest** — the survey-zoom LOD still hides the full label cloud (that part is correct — 150 labels at once is unreadable), but the **`HUB_LABEL_COUNT` (8) highest-degree nodes now keep their labels at any zoom**, so a zoomed-out graph reads as a *named map* (its hubs are titled) instead of anonymous dots. Crucially this is **bounded by construction** — a single-pass top-N-by-radius selection (radius is degree-derived in `scene.ts`) adds at most 8 cheap HTML-div labels regardless of zoom or total node count, so it stays inside the labels perf budget *without* the measured Pixi-LOD/text-pooling change the triage (rightly) didn't want rushed. The label divs already ride `transform` (compositor-only), edges/sim are untouched (the `edgeRebuilds ≤ 5` guardrail is unaffected). Pure `topNByRadius()` + unit test `hub-labels.test.ts`.
  - **"No edges" / offer to infer** — already largely closed by **F-067**: note→note `@`-mentions now materialize as real graph edges (session 133 confirmed the link count rising on autosave), so a vault with cross-references is no longer edgeless. The empty-connections state already *says so* plainly ("No connections — subjects render independently"). Shared-tag / co-occurrence inference remains a possible future enhancement, not a defect — filed-as-done with that noted.
- **assessment (2026-06-04):** the graph **already has a labels system** (`setting-labels`, on by default) — it's LOD-gated, so at the resting zoomed-out view of 81+ nodes no labels paint (a deliberate perf choice). Making hub labels show at rest is a *measured* Pixi-LOD + text-pooling change that must be re-checked against the documented graph-perf guardrails (edge-rebuild ≤5/30-ticks, force-sim budget). Deliberately NOT rushed into the war-room batch — it gets its own focused iteration with before/after perf numbers. The "no edges" half is largely the data (few typed relationships), not a render bug; relationship-inference (mentions / shared tags) is the bigger design question there.
- **assessment (2026-06-04):** the graph **already has a labels system** (`setting-labels`, on by default) — it's LOD-gated, so at the resting zoomed-out view of 81+ nodes no labels paint (a deliberate perf choice). Making hub labels show at rest is a *measured* Pixi-LOD + text-pooling change that must be re-checked against the documented graph-perf guardrails (edge-rebuild ≤5/30-ticks, force-sim budget). Deliberately NOT rushed into the war-room batch — it gets its own focused iteration with before/after perf numbers. The "no edges" half is largely the data (few typed relationships), not a render bug; relationship-inference (mentions / shared tags) is the bigger design question there.
- **what he saw:** 81 entities render as a scatter of coloured dots with **no labels** and **almost no edges** — the Connections panel literally reads "No connections — subjects render independently." A "knowledge graph" with nothing connected and nothing labelled is a dot plot.
- **what he expected:** "label the hubs at rest (or on a light zoom), and if my notes/clients/tasks genuinely have no typed relationships, *say so* and offer to infer some (mentions, shared tags) — don't just show me 81 anonymous dots and call it a graph. As-is it's decoration." Evidence: `02-02-graph-resting.png`.

### F-049 — the Graph's control panel reads like a query language (Marcus)
- **session:** 103-issue-1-draft   **kind:** design   **app:** Graph   **status:** ✅ done (2026-06-04)
- **resolution (developer, 2026-06-04):** reframed the filters panel around a plain front door. The view now leads with **"Show"** — one checkbox chip per entity type present in the vault (Note, Task, Person, …, each with its count), toggling membership of the primary subject's types; **leaving everything off shows the whole vault** (empty types = any). **Matches** sits right below as live feedback. The full power — **Pattern / Subjects / Connections** (subjects scoped to types, typed connections, the Where clause) — folds under a collapsed **"Advanced — subjects & connections"** `<details>` disclosure, so it's there when you need it but no longer the first thing you see. The Show lens and the Advanced type-picker edit the same subject, so they stay consistent. New pure `primarySubjectKey()` helper in `pattern-edit.ts` (primary, else first subject — never targets nothing) + `renderShowToggles()` in `app.ts`; chip/disclosure CSS; i18n `show.toggle`/`show.empty`. +1 pattern-edit test (primary/fallback/drift); apps typecheck + biome clean. Real-shell visual verify deferred to the next fix-batch session (app.ts has no DOM-test harness; the toggle logic routes through the already-tested `updateSubject`/`availableEntityTypes`).
- **triage (2026-06-04):** an Advanced-disclosure reframe of the pattern panel (lead with plain "show: notes / clients / tasks" toggles, fold subjects/connections/Where under Advanced) — a contained but real layout change; picked up in a later fix batch.
- **what he saw:** the right panel is a "PATTERN" builder — "A pattern is one or more **subjects** (each scoped to entity types) wired by **typed connections**… **Where…**". Subjects, typed connections, a Where clause.
- **what he expected:** "I opened a graph to *see my work connected*, and got a SQL builder. Lead with the graph and a couple of plain toggles ('show: notes, clients, tasks'); bury 'subjects / typed connections / Where' under an Advanced disclosure. The power is fine; it shouldn't be the front door." Evidence: `02-02-graph-resting.png`.

### F-050 — Bookmarks shows "Tags" twice (nav item + section) (Marcus)
- **session:** 104-research-and-bookmarks   **kind:** design   **app:** Bookmarks   **status:** ✅ done (2026-06-04)
- **resolution:** the "Tags" surface is a board view grouped by tag — distinct from the "TAGS" filter list, but the identical label stacked them. Renamed the surface to **"Tag board"** (`surface.tags` i18n), so the rail reads Inbox / Read / Archive / Tag board, with the filter list under its own "TAGS" header. (Seed "Example Domain" bookmark is separate seeder cleanup.)
- **what he saw:** the left rail has a **"Tags" nav button** (count 3) *and*, directly below, a **"TAGS" section** listing All / newsletter-research / reading-list / research. The same concept, twice, stacked.
- **what he expected:** "pick one — either the button *is* the section header, or drop the button. Two 'Tags' six pixels apart is the kind of thing that makes me doubt the rest." Also flagged the seed **"Example Domain" (example.com)** bookmark — "documentation-example cruft nobody swept." Evidence: `03-03-bookmarks-resting.png`.

### F-051 — the Code Editor empty state explains, then strands (Marcus)
- **session:** 105-marcus-editor-journal   **kind:** design   **app:** Code Editor   **status:** ✅ done (jargon) / deferred (CTA) (2026-06-04)
- **resolution:** reworded the empty-state copy to drop the schema leak — now "Snippets, configs, and REPL scratch files you create in this vault open here." (no "CodeFile entities"). The "New file" CTA is deferred: this app is a *viewer* of code-files created elsewhere (no in-app create flow yet), so a button would be non-functional — it lands with the create path.
- **what he saw:** a clean centred empty state — "No code files yet / Code files created in this vault appear here. Snippets, configs and REPL fragments are stored as **CodeFile entities**." — but **no "New file" button**. It tells you what goes here and gives you no way to put something there.
- **what he expected:** "a good empty state explains *and* hands me the button. Add a 'New code file' CTA right under the copy. And drop 'CodeFile entities' — that's your schema leaking; I don't think in entities." Evidence: `01-01-code-resting.png`. (Credit: the empty-state *copy* and centring are otherwise the nicest of the apps I swept.)

### F-052 — the Journal opens on yesterday, not today (Marcus)
- **session:** 105-marcus-editor-journal   **kind:** design   **app:** Journal   **status:** ✅ done (2026-06-04, war-room call)
- **resolution (owner call → fix):** position taken — **a daily journal opens on today.** Writing today's entry is the primary action; "restore where I left off" is the wrong default for a journal. Boot now sets focus to today (and seeds the nav with it) instead of restoring the last-viewed date; in-session back/forward still works. (The mini-calendar entry-density heat-map is a separate enhancement, left as a follow-up.)
- **what he saw:** opening Journal landed on **"Wednesday, 3 June"** (the last entry) while today is the **4th** — and the mini-calendar barely signals which days have entries (one faint dot under the 2).
- **what he expected:** "a *daily* journal should open on today, ready to write — make me click 'Today' to revisit yesterday, not the reverse. And mark the days I actually journaled clearly, so the month is a heat-map of my cadence, not a guessing game." Evidence: `02-02-journal-resting.png`.

## Session 102 — brand-system kickoff: a real work day (Mira + Marcus) (2026-06-04)

First working day after the hire. One vault (collaboration still sync-gated), so the team is both of them: **Mira produces, Marcus critiques.** Mira shipped real, composed work — the **"Brand System — Sprint 1"** brief (Notes, ~840-char body: goal / four deliverables / weekly cadence / the exported-artifacts working arrangement), the **four Sprint-1 deliverables** as tasks, and a **journal** kickoff entry. Marcus did his first on-the-job design review — **Files**, where the brand assets will live. Captures: `tests/dogfood/.sessions/102-brand-system-kickoff/`. Three new findings.

### F-045 — duplicate tasks pile up on Today with no dedup or grouping
- **session:** 102-brand-system-kickoff   **kind:** design   **app:** Tasks   **status:** ✅ done (2026-06-06)
- **resolution (developer, 2026-06-06):** the compose form now **warns on create** when an open task already carries the typed name — a muted, live "You already have an open task with this name." hint under the name field (`tasks-compose__hint`), refreshed on every keystroke. **Non-blocking** by design: it never prevents the create (legitimate recurring same-name to-dos still work), it just stops you *quietly* stacking a fifth identical row. The duplicate set is built from open (`completedAt === null`) tasks only, so a finished task of the same name doesn't nag. Chose warn-on-create over collapse-with-count because collapsing distinct entities in the list view hides real (if identical) tasks and fights the per-row checkbox model. apps typecheck + biome clean.
- **triage (2026-06-04):** mostly dogfood-vault churn (repeated session creates), but the underlying ask — collapse exact-duplicate tasks / warn on create — is a real small feature; deferred to a later batch.
- **what happened:** Today shows **five identical "Call the printer about the proofs"** rows (all 2 Jun), stacked one after another. Nothing groups, merges, or flags them — five separate checkboxes for one errand. (Vault churn from repeated creation, but the founder experience is the point: a daily view that lets identical tasks stack is a daily view I stop trusting.)
- **what I expected:** either collapse exact duplicates with a count, or at least warn "you already have this task" on create. A to-do list that quietly accepts five copies of the same line buries the real work under noise. Evidence: `02-02-deliverables.png`.

### F-046 — a new task lands dateless in Inbox with no quick-schedule
- **session:** 102-brand-system-kickoff   **kind:** design   **app:** Tasks   **status:** ❎ mostly not-a-bug (2026-06-04)
- **triage → re-triaged (2026-06-04, cycle 2):** investigation corrected this. The compose form **already renders Scheduled + Due date inputs in create mode** (`compose-view.ts:85-97`) — the four deliverables landed dateless only because the session script typed the name and hit Create without touching the date fields (a *test artifact*, not a missing affordance). The genuine sliver left is the lack of quick **presets** ("Today / Tomorrow / Next week" chips) beside the native date input — a minor nicety, not the "never offers a date" originally filed. Downgraded; presets are a backlog enhancement. (A reminder, like F-039/F-046, that real-shell + code verification catches over-claimed findings.)
- **what happened:** Mira created the four Sprint-1 deliverables through the "+ New task" composer; all four landed **undated, in Inbox** ("Newsletter template…" shows "Priority · Inbox", no date chip). She wants to spread them across the 30-day sprint, but the create flow never offers a date — she'd have to open each task afterward to schedule it.
- **what I expected:** the quick-add composer should let me set a due date inline (a "tomorrow / next week / pick a date" affordance right in the create row), the way Things/Todoist do — so planning a sprint is one pass, not create-then-reopen-each. Evidence: `02-02-deliverables.png`.

### F-047 — Files shows empty "Smart Folders" and "Tags" sidebar sections as bare headers (Marcus)
- **session:** 102-brand-system-kickoff   **kind:** design   **app:** Files   **status:** ✅ done (2026-06-04)
- **resolution:** the "Smart folders" and "Tags" sections were `defaultCollapsed` placeholders for unbuilt features ("…arrive with…") — bare labelled shelves over nothing. Removed both from the Files sidebar (`app.tsx`); they return when the features ship. (Seed "My first folder" cruft is a separate seeder cleanup.)
- **what he saw (Marcus's first Files review):** the left rail renders **"SMART FOLDERS"** and **"TAGS"** as section headers with **nothing under them** — two labelled shelves holding air before he's made a single smart folder or tag. Plus a seed **"My first folder"** (empty, "Empty folder · Yesterday") that reads as leftover onboarding, not something he made.
- **what he expected:** "don't show me a 'Tags' shelf with nothing on it. Either hide an empty section until it has contents, or give it a real empty-state ('No tags yet — add one') — a bare header is the UI equivalent of an empty promise. And clean up the placeholder folder; shipping a vault with 'My first folder' in it tells me nobody swept the floor." Evidence: `04-04-files-resting.png`.
- **his nod (rare):** the List row's "Empty folder" subtitle + the List/Grid/Gallery toggle + "Sort by: Manual" are clean. "The folder view itself is fine. It's the empty scaffolding around it that's sloppy."

### Verification note (not a finding)
- This session reused the **pre-#89 app build** (`SKIP_BUILD`, since it doesn't exercise the re-fixed surfaces), so the sidebar still shows seven colliding "Untitled · 23:31" — the merged F-039 ordinal fix isn't in *this* bundle (it would number them). And F-023 (Properties panel covering the prose) is visible again in `01-01-brief.png` — still the open war-room item.

## Session 101 — Marcus re-checks his fixes (verification re-review) (2026-06-04)

Marcus re-opens the six surfaces the dev side claimed fixed (F-037..F-042 + F-039) and reads the captures. He's pleased by half and re-files the rest — the loop catching its own misclaimed "done"s. Captures: `tests/dogfood/.sessions/101-marcus-verify-fixes/`.

### Verdict
- **✅ F-041 (Calendar date format) — confirmed.** Agenda headers read "Sat 6 Jun / Tue 9 Jun / Sat 13 Jun…" — one date language, day-of-month always present. "Good. Now I read down the column without translating."
- **✅ F-042 (Calendar legend colours) — confirmed.** Task dots are orange, Events purple, per the legend. "A Draft Issue reads as mine at a glance. This is what a colour key is *for*."
- **✅ F-038 (Database view naming) — confirmed.** Adding a view named it "Grid 2" (not "New view") and dropped straight into inline rename. (The *existing* Candidates board is still titled "New view" — a pre-fix view; the fix only names new ones, which is fine — he can rename it.)
- **❌ F-040 (Calendar "0:00") — STILL BROKEN, re-filed → re-fixed.** The Draft Issue chips still showed a leading "0:00". The first fix only caught `dueAt`-only tasks; these carry a `scheduledAt` pinned to **local midnight**. Re-fix: a task with no time-of-day (midnight `scheduledAt` *or* `dueAt`-only) is all-day. +1 unit test. "Still inventing midnight — try again." (now addressed)
- **⚠️ F-039 (Notes untitled) — PARTIAL, re-filed → strengthened.** Two notes created across a minute boundary disambiguated ("Untitled · 11:00" vs "· 10:59"), but **seven** blank notes from one minute all read "Untitled · 23:31" — still ambiguous. Strengthened: same-time untitled labels now get an "(n)" ordinal ("Untitled · 23:31", "… (2)", "… (3)"). +3 unit tests. "Better, but a column of seven identical '23:31's is the same problem wearing a clock." (now addressed)
- **✅ F-037 (Database funnel order) — correct, but unverifiable here.** The Candidates board shows a non-funnel order **because it's in MANUAL mode** — a deliberate column drag from the hiring sessions, which (by design) overrides the new option-order default. A *fresh* board grouped by a Select now funnel-orders out of the box. Caveat surfaced: there's no "reset column order" affordance once you've dragged — a small follow-up, not a re-open.

## Session 100 — the offer (hiring arc, solo phase complete) (2026-06-03)

### Marcus's offer & onboarding — caps the solo hiring arc (works)
- **session:** 100-designer-hired   **app:** Notes   **status:** ✅ verified
- Capstone of the *solo* hiring process: after the strong trial + scorecard (099 → Offer), Mira wrote **"Hiring — Marcus offer & onboarding"** — terms (part-time contract, day rate + equity path), the first-30-days brand-system plan, and the explicit handoff: real collaboration (shared vault, live editing, permissions) needs the **second paired vault over sync**, so until the sync / identity-orgs stages land she brings him in via exported artifacts + a shared review cadence. **Status: offer accepted.** Completes the arc Mira runs alone — brief (089) → roster (090) → stages (091) → board (092) → trial reviews (093–097) → fixes (F-036, F-044) → scorecard (099) → offer (here). Evidence: `tests/dogfood/.sessions/100-designer-hired/01-01-offer.png`.
- **side note (to verify, not filed):** moving Marcus to "Hired" via the grid Stage *cell* (changing an already-set Select) didn't open the option popover on the click — unlike setting an *empty* cell (091), which worked. Possibly the inspector overlay intercepting the rightmost cell (F-023) or the chip swallowing the trigger click; recorded the offer in Notes instead. Worth a focused check before claiming a "can't change a set Select from the grid" finding.

## Session 099 — Marcus's design-trial scorecard (2026-06-03)

### Scoring the designer's trial — ties the review thread to the hire (works)
- **session:** 099-designer-scorecard   **app:** Notes   **status:** ✅ verified
- Closes the loop between the two threads: Marcus's design reviews (093–097) **were** his craft trial, so Mira wrote his **scorecard** — "Hiring — Marcus Lee scorecard (design trial)" — evaluating against the role brief's bar (opinionated / fast / owns ambiguity), citing his actual findings (eight specific defects F-037→F-044 + the F-023 escalation, two already shipped as fixes) and his praise-once signal. **Verdict: strong hire → move to Offer.** A real hiring artifact that grounds the decision in observed work. Evidence: `tests/dogfood/.sessions/099-designer-scorecard/01-01-scorecard.png`.
- **harness-residue note (reinforces F-039):** the first attempt set the body but lost the title to a focus race → left an extra **"Untitled"** note; the rerun (focus editor → `Meta+ArrowUp` to the TitleNode → type) titled it correctly. The sidebar now shows several indistinguishable "Untitled" rows — exactly the F-039 collision Marcus flagged, seen in the wild. To sweep in a tidy pass.

## Session 098 — fixing F-044 (sticky placeholder legibility) (2026-06-03)

### F-044 fixed: sticky placeholder is now legible — verified
- **session:** 098-f044-sticky-placeholder   **app:** Whiteboard   **status:** ✅ done
- Closed the loop on Marcus's contrast catch (097). Root cause: `.whiteboard__node-body--placeholder` used the global `--text-faint` (a light grey tuned for *dark* surfaces) for *all* node placeholders — on a light-yellow sticky that's near-invisible. Fix: a sticky-scoped placeholder rule inks it as **muted dark grey** (`rgba(0,0,0,0.45)`) so it reads against the tint while staying clearly secondary to the 0.85 real text. One CSS rule, whiteboard-app-local.
- **verified real-shell:** the same board's empty stickies now show a clearly-readable **"New note"** (vs the ghost text in 097). Built the whiteboard app standalone + SKIP_BUILD session (full `build:apps` still trips on the in-flight planned-app scaffolds). Evidence: `tests/dogfood/.sessions/098-f044-sticky-placeholder/01-01-sticky-placeholder.png`.
- **second design finding turned into a fix** (after F-036) — the find→fix loop closing on the designer persona's catches.

## Session 097 — Marcus's design review: Whiteboard (2026-06-03)

Fifth design review by the designer persona — a canvas surface. Verdict: *"the interactions are right; the surface details aren't — I can barely read my own sticky."* Captures: `tests/dogfood/.sessions/097-design-review-whiteboard/`.

### F-044 — the sticky placeholder text is near-illegible (low contrast)
- **session:** 097-design-review-whiteboard   **kind:** design   **app:** Whiteboard   **status:** ✅ done (2026-06-03, session 098)
- **what he saw:** an empty sticky shows its **"New note" placeholder in pale text on the pale-yellow fill** — it's barely visible, well under any reasonable contrast bar.
- **what he expected:** "a placeholder I have to squint at fails its one job. Darken it (a muted-but-readable ink on yellow), and make sure real sticky text clears contrast on every sticky color too — this is the kind of thing that has to be right on a *design* tool or no designer trusts the rest." Evidence: `02-02-sticky-hovered.png`.

### Marcus's punch-list
- **Every sticky is the same yellow.** On a board the entire point is color to cluster and signal — there's no visible color choice at creation. "Give me sticky colors; a one-color board is a worse whiteboard than the wall behind me."
- **The help bar never leaves.** A permanent strip — "S sticky · T text · F frame · drag to move · double-click to edit · drag a handle to connect · pinch or Ctrl-scroll to zoom" — is glued to the bottom of every board. "Great for minute one, clutter forever. Fade it after my first node, or fold it behind a '?'."
- **Connection handles are hover-only** (small blue dots that appear on node hover/select) — the same hover-to-exist pattern as the Tasks chips (F-043). Softened here because the help bar *says* "drag a handle to connect", but a keyboard user still has no path.

## Session 096 — Marcus's design review: Tasks (2026-06-03)

Fourth design review by the designer persona. Verdict: *"a calm list — that hides its own controls and can't decide how to write a date."* Captures: `tests/dogfood/.sessions/096-design-review-tasks/`.

### F-043 — a task row's controls are invisible until you hover the exact row
- **session:** 096-design-review-tasks   **kind:** design   **app:** Tasks   **status:** ✅ done (2026-06-04, war-room call)
- **resolution (owner call → fix):** position taken — Marcus's option (b), a **quiet always-on chip rail.** The empty "Set priority / Schedule / Inbox" affordances are now visible at rest (low opacity), brightening on row hover/focus and full on direct hover, so a first-time user discovers them without hovering the exact row and keyboard users get them too. Always-shown ⇒ no phantom-gap width (the original reason for `display:none`), so the margin-collapse hack was removed. (The deeper option-c "single + entry" stays a possible later refinement if the rail reads busy.)
- **what he saw:** at rest, a task row is just a checkbox + a title (plus a chip only if a value is already *set* — e.g. #1's "Getting started"). The **priority / date / project affordances are `opacity:0` until you hover that precise row** (mechanically confirmed in session 080: the empty project chip was un-clickable until a `row.hover()`). Looking at the list cold, there is no visible way to set a priority or a date.
- **what he expected:** "controls that appear only when the cursor is already on them aren't discoverable — a first-time user never learns they exist. Show a quiet always-on affordance (a faint '+ set' or a persistent chip rail), or at least reveal on row *focus*, not just mouse-hover (keyboard users get nothing). Hover-to-exist is a power-user shortcut masquerading as the primary UI." Evidence: `01-01-list-resting.png` (rows #2/#3 are bare) + the 080 repro.

### F-041 — reinforced (cross-app): Tasks repeats the relative/absolute date-label split
- **session:** 096-design-review-tasks   **app:** Tasks   **status:** ✅ done (2026-06-04)
- **what he saw:** the Upcoming groups read **"SAT"** then **"13 JUN"** then **"20 JUN"** — the *same* mixed relative-weekday / absolute-date format he flagged in the Calendar agenda (F-041), now in a second app. And "SAT" alone is ambiguous — which Saturday?
- **his note:** "this isn't one app's bug, it's a missing shared date-formatting rule. Fix it in one place — a `formatGroupDate` both Tasks and Calendar call — and pick a lane: relative *or* absolute, with a day-of-month when it's relative." Cross-app reinforcement (Calendar 095 + Tasks here).
- **resolution (developer, 2026-06-04):** built the shared `formatGroupDate` in `@brainstorm/sdk/date-formatters` exactly as Marcus asked — **one** format both apps call: the universal "Today"/"Tomorrow"/"Yesterday" anchors, and for every other day a weekday + day-of-month + month ("Sat 13 Jun"). No relative↔absolute switch mid-list, and the always-present day-of-month kills the bare-"SAT" ambiguity. Tasks' "Upcoming" section headers (`surface-view.ts` → `formatGroupDateLabel`) and the Calendar agenda day sub-headers (`agenda-view.ts`) both adopt it; row chips keep `formatDateRelative`. +4 SDK unit tests. Closes both the Calendar (F-041) and Tasks reinforcement.

## Session 095 — Marcus's design review: Calendar (2026-06-03)

Third design review by the designer persona — a fresh surface, fresh flaws (no F-023 rehash). Verdict: *"it lays out cleanly, then undermines itself with a fake time, a split-personality date format, and a legend it doesn't honour."* Captures: `tests/dogfood/.sessions/095-design-review-calendar/`.

### F-040 — untimed tasks render as "0:00" (a null dressed as midnight)
- **session:** 095-design-review-calendar   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-04)
- **what he saw:** the Draft-Issue tasks (which have a date but no *time*) show a leading **"0:00"** in both agenda and month ("● 0:00  Draft Issue #1…"), while real events show true ranges ("9:00 – 10:00"). 
- **what he expected:** "those tasks have no time — so don't invent midnight. Show no time, or label them all-day, the way the Week view's all-day band already does. '0:00' reads as a real 12am slot and it isn't." Evidence: `02-02-agenda.png`, `01-01-month.png`.
- **resolution (developer, 2026-06-04):** the model already had the `allDay` flag (Events/Birthdays use it) — the Task→`ScheduledItem` projector just hard-coded `allDay: false`. Fixed at the source (`from-vault-entities.ts`): a task plotted from `dueAt` alone (a due *date*, no time-of-day) projects `allDay: scheduledAt === null`, so month drops the time prefix and agenda reads "All day" instead of the invented "0:00"; a task with a real `scheduledAt` still shows its time. No renderer change — the existing all-day path handles it.
- **re-fix (2026-06-04, after session 101 verify):** the first fix was insufficient — the seeded Draft Issue tasks carry a `scheduledAt` pinned to **local midnight**, not a null/`dueAt`-only, so they still showed "0:00". Now `allDay = scheduledAt === null || isLocalMidnight(start)` (new `isLocalMidnight` helper) — a task with no time-of-day at all is all-day; a real clock time keeps it. +1 unit test.

### F-041 — the agenda mixes relative and absolute date labels in one list
- **session:** 095-design-review-calendar   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-04)
- **what he saw:** scrolling the Agenda, the date-group sub-headers switch formats by proximity — **"Saturday", "Tuesday"** under *This week*, then **"13 Jun", "16 Jun", "18 Jun"** under *Later*. One column, two date languages.
- **what he expected:** "pick one. Relative weekday names and absolute day-month dates in the same scroll make me convert in my head. If you want relative, keep it relative ('Sat', 'next Tue'); if absolute, all absolute." (Sharpens the note from session 069.)
- **resolution (developer, 2026-06-04):** fixed via the shared `formatGroupDate` — see the F-041 Tasks entry above (session 096) for the full resolution. The agenda day sub-headers now read "Today" / "Tomorrow" / "Sat 13 Jun" consistently, no relative↔absolute switch.

### F-042 — the Calendars legend colors don't show on the items
- **session:** 095-design-review-calendar   **kind:** design   **app:** Calendar   **status:** ✅ done (2026-06-04)
- **what he saw:** the left **Calendars** legend promises **Events = purple, Tasks = orange, Birthdays = pink** — but every item dot/chip in the agenda and month is the **same blue**. A Task (Draft Issue) is indistinguishable from an Event (Newsletter); the legend's color system isn't applied to the rendered items.
- **what he expected:** "if you draw me a color key, honour it — a task should read orange so I can tell my own deliverables from meetings at a glance. A legend the calendar ignores is worse than no legend; it actively misleads." Evidence: `02-02-agenda.png`.
- **resolution (developer, 2026-06-04):** the legend `SOURCE_COLOR` map lived privately in `sidebar.ts`, so the items never saw it and fell back to the CSS `--accent` blue. Promoted it to the single source of truth in `logic/scheduled-item.ts` (beside `ItemSource`); the sidebar legend and the item chip (`event-chip.ts`) now both read it. A chip's `--chip-color` is `item.colorHint ?? SOURCE_COLOR[item.source]`, so a Task reads orange, an Event purple, a Birthday pink — the key the legend draws is the colour items actually wear. A per-item `colorHint` still overrides.

### Marcus's punch-list
- **Month chips are unreadable.** Every event is truncated to "9:00 New…" — the three Newsletters are indistinguishable in the month grid, and the leading time eats the width the title needs. "In month view I can't tell issue #1 from #3. Drop the time (the row position *is* the day) and give the title the space."

## Session 094 — Marcus's design review: Notes (2026-06-03)

Second review by the designer persona. Notes is where Mira lives, so Marcus judged the reading/writing surface. Verdict: *"the blank page is the best-designed thing here — and then I open Properties and it eats my document."* Captures: `tests/dogfood/.sessions/094-design-review-notes/`.

### F-023 — reinforced (and worse): the Properties panel clips the *document* itself
- **session:** 094-design-review-notes   **app:** Notes   **status:** ✅ done (2026-06-04, owner ruling — see F-023/067 for the fix)
- **what he saw:** with Properties open, the note's **title is cut off mid-word** — "Issue #1 — The case for dev-**to** " — and **every body line is sheared** at the panel's left edge ("…talk to each", "…winners of the", "…ship substrate-grade reliability t"). The panel is an opaque overlay sitting *on top of* the text column, not beside it.
- **why it matters (his words):** "In the database this clipped a column (F-023). Here it guillotines my *prose* — the title's cut in the middle of a word. A panel that describes the document must never cover the document. This is the same bug wearing a worse outfit; it's not a database quirk, it's systemic across every right-panel surface." Strong cross-app escalation evidence for the F-023 fork (Database 067, embed cards 063/064/070, now Notes prose). Evidence: `02-02-properties.png`.

### F-039 — duplicate "Untitled" notes are indistinguishable in the list
- **session:** 094-design-review-notes   **kind:** design   **app:** Notes   **status:** ✅ done (2026-06-04)
- **what he saw:** creating a new note left **two rows both labelled "Untitled"** in the sidebar (the new one + a prior one), with nothing to tell them apart. 
- **what he expected:** "either don't let me strand two 'Untitled's, or disambiguate them (a timestamp, a preview, *something*). A list of identical labels is a list I stop trusting." Evidence: `03-03-empty-note.png`.
- **resolution (developer, 2026-06-04):** the list already disambiguates an untitled note that has *body* text (it shows a clipped body snippet) — the gap was the truly-blank note, which fell back to a bare "Untitled". New `listLabel()` in `notes-list.tsx` suffixes that case with the note's last-edited clock time ("Untitled · 2:32 PM") so two blank notes are tellable apart; the clean "Untitled" is still used for the drag + object-menu labels (a single note's identity isn't ambiguous there). +3 unit tests (`notes-list.test.tsx`). Marcus's "a timestamp, a preview, *something*" — the preview was already there for non-blank notes; this adds the timestamp for blank ones.
- **strengthened (2026-06-04, after session 101 verify):** the minute-granularity timestamp still collided when several blanks shared a minute (the vault had seven "Untitled · 23:31"). Added `disambiguateLabels()` — a list-level pass (over the full ordered set, not the virtualised rows) that appends an "(n)" ordinal to the 2nd, 3rd… untitled note sharing a time label ("Untitled · 23:31", "… (2)", "… (3)"). Deliberately-same *titled* notes are left alone. +3 unit tests.

### Marcus's punch-list
- **The empty Properties panel doesn't earn its third of the screen.** On a blank, property-less note it spends ~⅓ of the width to say "No properties on this note yet" + Created/Updated "just now". "If it has nothing to show, it shouldn't be this big — and it *definitely* shouldn't be this big *on top of my text*." (Root cause shared with F-023.)
- **Credit where due (rare from him):** the blank note is right — a quiet "+ Add cover" instead of a forced gold banner (the F-002 fix), big clear "Title" placeholder, calm canvas. "This is the one screen that respects me. Make the rest feel like this."

## Session 093 — Marcus's design review: Database (2026-06-03)

First review by the **second persona** — Marcus Lee, the designer Mira's hiring (his craft trial = reviewing Brainstorm). Skeptical, detail-strict. He went through the Database app; verdict: *"competent, but it tells me things that aren't true and leaves its own defaults half-done."* Captures: `tests/dogfood/.sessions/093-design-review-database/`.

### F-037 — a Board grouped by a status reads out of funnel order
- **session:** 093-design-review-database   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-04)
- **what he saw:** the Candidates board (grouped by Stage) lays the columns out **Applied → Offer → Screen → Interview**. That's not a funnel — Offer sits *before* Screen and Interview. The lanes follow option-creation / data order, and a Select carries no inherent sequence, so an ordered pipeline renders as nonsense left-to-right.
- **what he expected:** "a pipeline is the one place column order *is* the meaning. Out of the box the stages should read in their defined order (Applied→Screen→Interview→Offer). Columns are drag-reorderable, sure, but I shouldn't have to hand-sort my own funnel every time, and a teammate opening it sees the wrong story." 
- **evidence:** `04-04-board.png`. Related to the Select having no orderable options (ties to F-034's property-catalog gaps).
- **resolution (developer, 2026-06-04):** the Select *does* carry an order — its dictionary `items` array is the defined option order — it just wasn't used; `groupRows` (compile-view) emitted lanes in first-seen *data* order. Now the default lane order follows the property's option order (a new `groupOrderResolver` → `optionOrderById` resolves each key's index in its dictionary; threaded through `compileViewCached`), so the funnel reads Applied→Screen→Interview→Offer out of the box. The null/"Uncategorized" lane and any non-option value keep first-seen order, last. A manual drag-reorder (board `groupOrder`) still overrides — Marcus's "drag-reorderable, sure, but I shouldn't have to hand-sort every time." +2 compile-view unit tests; 482 database tests green.

### F-038 — a view you create is just called "New view"
- **session:** 093-design-review-database   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-04)
- **what he saw:** the board he's looking at is titled **"New view"** in the tab strip (tab labels were `["Grid","New view"]`). Adding a view never asked what it's for and didn't name it by its type.
- **what he expected:** "name it on create, or at least default to the type — 'Board', 'Gallery'. 'New view' is the kind of leftover default that makes me think nobody used this twice. Database's 'Blank collection' and Files' 'New folder' drop you straight into inline rename; a new *view* should too."
- **evidence:** `03-03-view-tabs.png`.
- **resolution (developer, 2026-06-04):** both halves done. A new view is now named after its type via `viewKindLabel` — "Grid" (the kind it's created as), not the anonymous "New view"; `uniqueName` still de-dupes ("Grid 2"). And `createNewViewAndSelect` drops **straight into inline rename** on the freshly-rendered tab (reusing the proven `beginInlineRename` + `commitViewRename`, the exact "Blank collection" / "New folder" flow Marcus cited) — Enter commits, Escape keeps the type-default. Once the user retypes the view to a Board/Gallery, that's their named view.

### Marcus's punch-list (smaller, real, not separate F-numbers)
- **Card chips have no hierarchy.** On the Clients cards, a status ("Active"/"Lead"), a currency ("US$48,000.00") and a date ("15 Jun 2026") all render as the *same* grey pill. "Three different kinds of data wearing one uniform — I can't scan value from status from date." (`01-01-grid-with-inspector.png`)
- **Ragged card content.** Vertex shows one chip, Acme two, Beacon three — every card surfaces a different field set, so the gallery has no consistent structure to scan down. Pick a card template and hold it.
- **Board overflows with no affordance.** The 4th lane (Interview) is amputated at the right edge; nothing says the board scrolls. "If there's more, *show* me there's more."
- **Decorative covers that mean nothing.** Each card wears a big id-seeded gradient band eating its top half — "it implies a categorization that doesn't exist; on a *data* card that's noise, not identity. Make it opt-in."
- **(verify, possibly my own test-state)** the tab labelled "Grid" rendered the gallery — likely leftover view-kind state from earlier sessions changing view types, flagged for confirmation, not filed as a product flaw.

## Session 092 — the hiring funnel as a board (2026-06-03)

### Candidates Kanban grouped by Stage — works; F-036 fix confirmed on a fresh property
- **session:** 092-hiring-board   **app:** Database   **status:** ✅ verified
- Fourth piece of the first-hire arc: Mira views the Candidates pipeline as a **Board grouped by Stage** — the funnel reads as lanes **Applied (Tom) / Screen (Marcus) / Interview (Priya) / Offer (Sofia)**. The recruiting Kanban. Evidence: `tests/dogfood/.sessions/092-hiring-board/01-01-hiring-board.png`.
- **F-036 fix confirmed on a brand-new property:** the board group-by picker listed `["— none —","Name","Created at","Updated at","Stage"]` — the **Stage** column (created in 091, *after* the 088 fix) reads by its **name**, not "Prop mpyk0ojh 0jkawv". So the fix holds for freshly-minted properties, and grouping is now selectable by name end to end.

## Session 091 — candidates in the funnel (2026-06-03)

### Stage column + place each candidate — works (no friction)
- **session:** 091-candidate-stages   **app:** Database   **status:** ✅ verified
- Third piece of the first-hire arc: Mira added a **Stage** Select column to Candidates and placed each applicant in the funnel — **Tom Becker → Applied, Marcus Lee → Screen, Priya Nair → Interview, Sofia Alvarez → Offer**. The flat roster (090) is now a working recruiting pipeline. Reused the proven add-column (066) + inline-cell-set (067) mechanics, re-closing the inspector before each Stage cell (F-023 workaround). Evidence: `tests/dogfood/.sessions/091-candidate-stages/01-01-staged.png`.

## Session 090 — the candidates pipeline (2026-06-03)

### Candidates collection with designer applicants — works (no friction)
- **session:** 090-candidates-pipeline   **app:** Database   **status:** ✅ verified
- Second piece of the first-hire arc: Mira stood up a **Candidates** collection with her four designer applicants (Priya Nair, Marcus Lee, Sofia Alvarez, Tom Becker), one row each — the recruiting roster. Built through the Database UI (new blank collection → rename via `#stage-title` → `#toolbar-new` per row → inline rename), the same flow as the Content Calendar (065). Sits in the sidebar beside Clients + Content Calendar. Pipeline Status + a board view come next (091). Idempotent. Evidence: `tests/dogfood/.sessions/090-candidates-pipeline/02-02-applicants.png`.

## Session 089 — the first hire: Designer role brief (2026-06-03)

### Opening the hiring arc — the Designer role brief (no friction)
- **session:** 089-designer-role-brief   **app:** Notes   **status:** ✅ verified
- New arc (owner redirect): Mira makes her **first hire — a designer**. The hiring *process* is solo founder work in her own vault, so it builds on today's apps (only the eventual teammate-as-collaborator onboarding is sync-gated). This is the foundational artifact: **"Hiring — Designer (first hire)"** — a role brief with *why now / the role / what good looks like (first 90 days) / comp / the interview process*. Later sessions add the Candidates pipeline (Database board), interview events (Calendar), and scorecards (Notes) on top. README growth-arc section realigned (core area = built; first hire = now; team collaboration = sync-gated later). Evidence: `tests/dogfood/.sessions/089-designer-role-brief/01-01-brief.png`.

## Session 088 — fixing F-036 (property pickers show names) (2026-06-03)

### F-036 fixed: view-settings pickers resolve display names — verified
- **session:** 088-property-names-fix   **app:** Database   **status:** ✅ done
- Turned the F-036 finding into a fix. The shared `propertyOptions()` in `view-settings.ts` now resolves each key to its **catalog display name** (from `props.vaultProperties`, the map already used at the column list), falling back to `humanize(key)` only for built-ins — so the board group-by, gallery cover/subtitle, and calendar/timeline date pickers all read real names. One change, all four sites (the same shape the grid header used for F-017).
- **verified real-shell:** the Calendar **"Place on"** picker now reads `["Name","Created at","Updated at","Publish date","Status"]` and the gallery **"Cover"** picker reads `[…,"Status","Deal size","Last contact"]` — **zero** cryptic "Prop …" labels remain, and the real names ("Publish date"/"Status") are present. Verified against a database bundle rebuilt with the fix. Evidence: `tests/dogfood/.sessions/088-property-names-fix/01-01-clients-settings.png`.
- **build note:** built the database app standalone (`--filter @brainstorm-app/database`) + ran the session with `SKIP_BUILD` — the full `build:apps` currently also builds the in-flight planned-app scaffolds, so a targeted rebuild is the safe path until those settle. Unit test for `propertyOptions` deferred (vitest config is mid-change from the parallel work); the real-shell session is the verification.

## Session 087 — the editorial calendar, on a calendar (2026-06-03)

### Content Calendar as a Calendar view — works (completes view-type coverage)
- **session:** 087-calendar-view   **app:** Database   **status:** ✅ verified
- Mira viewed the Content Calendar as a Database **Calendar** view with the date-axis on **Publish date** — the three issues land on their ship dates in the June 2026 month grid (Issue #1 → Tue 9, #2 → Tue 16, #3 → Tue 23), with Week/Month/Year toggles. The editorial calendar, literally on a calendar. Completes the Database **view-type coverage**: grid / board (083) / gallery (086) / calendar (here). Evidence: `tests/dogfood/.sessions/087-calendar-view/01-01-calendar.png`.
- **F-036 (4th site):** the calendar date-axis picker ("Place on") again listed custom properties as cryptic keys ("Prop mpye0tff 8acd19"). F-036 is now confirmed across **board group-by + gallery cover/subtitle + calendar date-axis + timeline start/end** — every `propertyOptions()` consumer in view-settings. One shared fix (resolve names) clears all of them.

## Session 086 — the client roster as a gallery (2026-06-03)

### Clients CRM as a Gallery view — works; F-036 reinforced
- **session:** 086-clients-gallery   **app:** Database   **status:** ✅ verified (gallery) / F-036 reinforced
- Mira added a **Gallery** view to the Clients CRM — the three leads (Vertex Labs, Acme Research Co., Beacon Analytics) render as visual cards with id-seeded gradient covers. Completes the Database view-type coverage (grid / board 083 / gallery here). Evidence: `tests/dogfood/.sessions/086-clients-gallery/01-01-gallery.png`.
- **F-036 reinforced (concrete second site):** the gallery **Cover** picker listed the CRM's custom properties as **"Prop mpx6xww2 2vzk7i" / "Prop mpxounp8 icdi7i" / "Prop mpxqabl5 kz1yqz"** (Deal size / Status / Last contact) instead of their names — built-ins ("Name", "Created at") read fine. So F-036 is confirmed across **board group-by (083) + gallery cover/subtitle (here)** — every `propertyOptions()` consumer in view-settings. The Cover/Subtitle pickers are effectively unusable for custom properties until names are resolved (the F-017-class fix applied once to the shared helper).

## Session 085 — sorting by ship date (2026-06-03)

### Sort the pipeline by Publish date — works (no friction)
- **session:** 085-sort-pipeline   **app:** Database   **status:** ✅ verified
- Mira sorted the Content Calendar grid ascending by **Publish date** so the issues read in ship order — Issue #1 (9 Jun) → #2 (16) → #3 (23). Completes the grid's query-control coverage: **filter** (084), **group/board** (083), **sort** (here). Like the filter cascade, the sort menu labels columns by **display name** (`propertyDisplayName`, the F-017 fix) — confirming F-036 is isolated to the view-settings `propertyOptions()` pickers. Also cleared 084's lingering filter (hygiene). No friction. Evidence: `tests/dogfood/.sessions/085-sort-pipeline/01-01-sorted.png`.

## Session 084 — what's left to ship (2026-06-03)

### Filtering the pipeline (Status is not Published) — works (no friction)
- **session:** 084-filter-pipeline   **app:** Database   **status:** ✅ verified
- On the Content Calendar grid Mira built a filter — **Status is not Published** — leaving just the unshipped issues (Issue #3 Drafting + Issue #2 Scheduled; the Published Issue #1 dropped out, FILLED 2). Exercises the full filter-builder cascade (`#toolbar-filter` → Add filter rule → property → operator → value), five levels of fancy menus on a real Select property, end-to-end. Notably the filter's **property menu shows the proper name "Status"** (via `colLabel`) — so the F-036 cryptic-key issue is specific to the view-settings `propertyOptions()` pickers, *not* the filter cascade. Idempotent (clears any existing filter first). No friction. Evidence: `tests/dogfood/.sessions/084-filter-pipeline/01-01-filtered.png`.

## Session 083 — the pipeline as a board (2026-06-03)

### Content Calendar as a Kanban board — works, plus a property-name finding
- **session:** 083-pipeline-board   **app:** Database   **status:** ✅ verified (board) / F-036 open
- Mira added a second view to the Content Calendar, switched it to **Board**, and grouped by **Status** — the three issues fan out into **Drafting (Issue #3) · Scheduled (#2) · Published (#1)** lanes, each with a count. A genuinely useful second lens on the editorial pipeline she built (065–067), sitting beside the Grid view. Exercises add-view + the view-type segmented control + board group-by (all uncovered). Evidence: `tests/dogfood/.sessions/083-pipeline-board/01-01-board.png`.

### F-036 — the Group-by picker labels custom properties by cryptic key, not name
- **session:** 083-pipeline-board   **kind:** design/bug   **app:** Database   **status:** ✅ done (2026-06-03, session 088)
- **what I saw:** opening the board's **Group by** picker, the custom properties showed as **"Prop mpye0tff 8acd19"** and **"Prop mpye2ond 2etq7m"** — the humanized internal *keys* — instead of their display names **"Publish date"** and **"Status"**. The built-ins read fine ("Name", "Created at", "Updated at"); only the user-created Select/Date columns are unreadable.
- **what I expected:** the picker to show the property's **display name** (the grid header correctly shows "PUBLISH DATE" / "STATUS"), so I can tell which column I'm grouping by.
- **likely cause:** the shared `propertyOptions()` in `view-settings.ts` labels options with `humanize(key)`; for a property created via the inline form the key is an opaque id (`prop_…`), so humanize yields garbage. The grid header avoided exactly this (F-017) by resolving the def **name** — the group-by / date-axis / gallery cover+subtitle pickers that share `propertyOptions` never got the same fix.
- **impact:** a user can't reliably pick a group-by/cover/subtitle property by name — they'd have to guess between "Prop mpye0tff…" entries. I only got the right one by choosing the most-recently-added key. Same class as F-017, narrow fix (resolve names in `propertyOptions`). Surfaced, not blind-fixed (it's shared across several pickers — worth doing once, deliberately).

## Session 082 — writing Issue #1 (2026-06-03)

### Drafting the actual newsletter content — works (no friction)
- **session:** 082-draft-issue1   **app:** Notes   **status:** ✅ verified
- Mira wrote the real content for **"Issue #1 — The case for dev-tools infra"** — five paragraphs of genuine newsletter copy (hook → the shift → why-now → founder takeaway → next-week teaser), titled to match the Content Calendar row. Closes the loop from plan (065–067) → schedule (069/073) → **write**. A real content artifact, not a coverage check — the knowledge base now holds the issue she's been planning. Clean. Evidence: `tests/dogfood/.sessions/082-draft-issue1/01-01-draft.png`.

## Session 080 — filing a deliverable under a project (2026-06-03)

### F-035 — there's no way to create a project from the Tasks app
- **session:** 080-task-to-project   **kind:** gap   **app:** Tasks   **status:** ✅ done (2026-06-04)
- **resolution (developer, 2026-06-04):** took the affordance the triage itself proposed — **"a ＋ by the Projects heading inline-renaming a new `Project/v1`"** (mirroring Database "New collection" / Files "New folder"). The Projects heading is now a row with a trailing **"+"** button (hover-revealed, focus-visible); clicking it mints a `Project/v1` at the end of the active list, selects it, and opens its **sidebar row as a focused inline-rename input** (Enter / blur commits, Escape cancels — a blank name keeps the default so a fresh project is never nameless). This also fills a second gap: projects had **no rename path at all** before, so the same `onRenameProject` wiring makes existing projects renamable too. New `state.renamingProjectId` + `onCreateProject`/`onRenameProject` handlers + `newProjectId()` mint; `renameProjectRow()` in the sidebar; heading-add / rename-input CSS; i18n `tasks.sidebar.newProject`/`renameProject` + `tasks.project.defaultName`. +3 sidebar render tests (affordance gated on the handler · row→input swap · Enter-commit / Escape-cancel); 203 tasks tests green; apps typecheck + biome clean. Real-shell verify deferred to the next fix-batch session. Task→project *assignment* already worked (the row's project chip), so the pipeline is now complete: create a project, name it, file tasks under it.
- **what I was trying to do:** group my three "Draft Issue" deliverables under a dedicated **"Newsletter"** project.
- **what happened:** I couldn't make a project. The Projects sidebar group has **no add/＋ affordance** (0 add-project buttons), and the compose/edit form's project picker only lists **existing** projects (Inbox + whatever's already there) with no "create new". The only project in the vault is the seeded "Getting started", so a new user is stuck with whatever projects happen to exist.
- **what I expected:** a "New project" affordance by the Projects heading (mirrors "New collection" in Database, "New folder" in Files) — creating an organizing container is a first-class action everywhere else.
- **workaround (verified):** I filed a deliverable under the existing **"Getting started"** project via the row's project chip → Move-to-project menu (hover-revealed chip → anchored menu → pick the project). "Draft Issue #1" now lives under that project. So task→project *assignment* works cleanly; only project *creation* is missing.
- **evidence:** `tests/dogfood/.sessions/080-task-to-project/01-project.png`.
- **triage (surface, not blind-fixed):** a real gap — but where project creation should live is a small design call (a ＋ by the Projects heading inline-renaming a new `Project/v1`, mirroring Database's "Blank collection"? or a compose-form "+ New project"?). Flagging for the owner rather than guessing the affordance. Covers the task→project assignment path either way.

## Session 079 — scanning the agenda (2026-06-03)

### Calendar Agenda view — works (coverage, completes the calendar views)
- **session:** 079-agenda-view   **app:** Calendar   **status:** ✅ verified
- Mira switched to the **Agenda** view to read her schedule end-to-end in one column: the three newsletter sends, the three Draft-Issue deliverables, and the Vertex Labs intro call, all date-bucketed. Completes Calendar view coverage (Month 073, Week 077, Agenda here). No friction. Evidence: `tests/dogfood/.sessions/079-agenda-view/01-agenda.png`.

## Session 078 — archiving a source (2026-06-03)

### Bookmark archive lifecycle — works (coverage, no friction)
- **session:** 078-archive-bookmark   **app:** Bookmarks   **status:** ✅ verified
- Mira archived a source she's done with (right-click card → **Archive**): Inbox **2 → 1**, and it landed on the **Archive** surface. Completes the bookmark lifecycle coverage (062 covered mark-read; this is the remaining archive/unarchive surface move). Clean, no friction. Evidence: `tests/dogfood/.sessions/078-archive-bookmark/02-02-archive.png`.

## Session 077 — reviewing the week (2026-06-03)

### Calendar Week view + week-by-week nav — works (coverage, no friction)
- **session:** 077-week-view   **app:** Calendar   **status:** ✅ verified
- Mira switched to **Week view** and paged forward to the publishing week (8–14 June) to see the first newsletter send laid out by hour. Newsletter #1 renders as a 9:00–10:00 chip on Tuesday the 9th, in the hourly grid with the all-day band + Calendars sidebar; the Draft Issue task sits in the all-day band. Covers the Calendar's other layout + week-by-week pager (Month view was 073) — a corner where layout friction would hide; none found. Evidence: `tests/dogfood/.sessions/077-week-view/02-02-publishing-week.png`.

## Session 076 — the monthly operating review (capstone) (2026-06-03)

### Deepest cross-app composition yet — transclusion-of-a-doc-that-embeds + direct embeds — works
- **session:** 076-monthly-review   **app:** Notes × Notes × Database   **status:** ✅ verified
- The capstone of the core operating area: **"Northbound — June review & next 30 days"** pulls the whole workspace into one founder's-monthly-review doc. It **transcludes the live weekly review (070)** inline, **embeds the Content Calendar pipeline + the Clients CRM**, and lays out the next-30 plan in prose. The composition runs **three levels deep**: the outer review transcludes the weekly review, which *itself* embeds the two databases — so the page shows the weekly review's title + prose + its two nested database cards, then the plan, then the two direct embeds (`transclusions=1`, `embeds=4` = 2 direct + 2 nested-in-the-transclusion). Block-Protocol composition holds multiple levels deep with no special-casing. Evidence: `tests/dogfood/.sessions/076-monthly-review/02-02-review.png`.
- **milestone:** this closes out the **core startup area** — across sessions 063–076 Mira has built the operating hub, the knowledge base (brief / thesis / weekly + monthly review), the pipelines (Clients CRM + filled editorial Content Calendar), the file workspace, the Tasks + Journal cadence, the publishing calendar, the research reading list, and the strategy board. The next arc (collaboration & hiring) is gated on the sync / identity-orgs stages, which aren't built yet — so the buildable core-area scope is now substantially complete.

## Session 075 — the strategy board (2026-06-03)

### Connector gesture between two stickies — works (first dogfood; needed an affordance)
- **session:** 075-strategy-board   **app:** Whiteboard   **status:** ✅ verified
- Mira dropped two sticky notes via the **tool palette** (click-to-place at distinct points — the Figma/Miro convention, distinct from 061's Add-menu path) and **drew a connector** between them by dragging from one sticky's edge handle to the other. The edge model went **0 → 1**. This is the **first dogfood of the Whiteboard connector gesture** — the last named core-area piece ("strategy/funnel on the Whiteboard"). Evidence: `tests/dogfood/.sessions/075-strategy-board/02-02-connected.png` (3 stickies; the connector is GPU-painted so it doesn't show in the headless capture — the help bar's "drag a handle to connect" + edge-count=1 confirm it).
- **harness work landed (developer-role):** connectors paint GPU-side (Pixi) with **no DOM trace**, and the GPU-less headless env doesn't paint them at all — yet the edge *model* updates. Added a one-line `.whiteboard__nodes[data-edge-count]` mirror in `paint()` so a test/harness can assert a connection landed without a renderer (parallels the existing `dataset.edgesVisible/edgesCulled` on the Pixi canvas, which only update when Pixi mounts). This unblocks future connector dogfooding.
- **the headless ceiling (not a product bug):** sticky *bodies* are CRDT contenteditables that synthetic keystrokes corrupt, so the board's nodes stay unlabelled in the harness — a richer *labelled* strategy board is a real-user / live-shell exercise, not a headless one. The structure (nodes + connector) is what's dogfoodable here, and it works.

## Session 074 — the research reading list (2026-06-03)

### Tag + filter a reading list in Bookmarks — works (no friction)
- **session:** 074-reading-list   **app:** Bookmarks   **status:** ✅ verified
- Mira grouped her captured sources into a research reading list: she tagged her bookmarks with a shared **"newsletter-research"** label (right-click card → **Edit tags** → comma-separated input → Save), then clicked the tag in the Tags nav to filter to just that list (`#newsletter-research · 2 bookmarks`). The tag-edit **appends** — a card that already had `#research` kept it and gained `#newsletter-research` (the form pre-fills the current tags; the session reads + extends rather than overwrites). The tag-edit + tag-filter path is clean and UI-driven. Evidence: `tests/dogfood/.sessions/074-reading-list/03-03-filtered.png`.

## Session 073 — the publishing schedule (2026-06-03)

### Newsletter sends on the Calendar — works, and it composes (no friction)
- **session:** 073-publishing-schedule   **app:** Calendar (× Tasks projection)   **status:** ✅ verified
- Mira put the three newsletter sends on the Calendar as timed Events (9 / 16 / 23 June, 09:00) so the schedule lives where she sees the rest of her week. Exercises the Calendar create path — header **"New event"** → the shared detail popover (title + start/end `datetime-local`) → Save — for the first time in this vault. The dates line up with the Content Calendar pipeline (065–067), so the two surfaces agree.
- **the composition is the story:** the Month view shows the new **Events** sitting alongside the **projected Draft-Issue Tasks** (the deliverables from 069) *and* the Vertex Labs intro call, with a Calendars sidebar toggling Events / Tasks / Birthdays. The Calendar is doing its job as the **cross-app temporal index** — one grid, three sources. Evidence: `tests/dogfood/.sessions/073-publishing-schedule/02-02-month-after.png`.

## Session 072 — tidying the duplicate collection (2026-06-03)

### Deleted the stray "New collection" — works (vault hygiene)
- **session:** 072-tidy-vault   **app:** Database   **status:** ✅ verified
- Swept the residue 065's failed first run left behind: a stray **"New collection"** (a duplicate of the Content Calendar) sitting in the Database sidebar. Deleted it the normal way — right-click the collection → **Delete** — and verified it's gone from the sidebar; Content Calendar remains intact with its filled pipeline. Verifies the sidebar list context-menu delete path.
- **note:** `deleteList` removes the collection wrapper + views but not its member objects, so the 3 generic Objects that were pinned into "New collection" persist as unfiled entities (still counted under the auto-derived "Objects" list). Fully purging those orphans is an object-level sweep (the shared object-menu's remove-vs-delete semantics want a careful pass) — deferred; the visible sidebar clutter is the win here.


## Session 071 — today's daily log (2026-06-03)

### Daily log in Journal — works (first dogfood; needed a harness hook)
- **session:** 071-journal-daily-log   **app:** Journal   **status:** ✅ verified
- The last cadence piece: Mira jumped to **today**, started the entry, and wrote a three-line end-of-day log (what shipped / what's next). It writes into `journal-2026-06-03` cleanly. **This is the first time the Journal day body has been dogfooded** — it needed a keystroke-safe path, because raw synthetic keystrokes corrupt the Yjs-bound editor in headless Electron (the same constraint that gave Notes `__brainstormNotesDev`). Evidence: `tests/dogfood/.sessions/071-journal-daily-log/02-02-logged.png`.
- **harness work landed (developer-role):** added `window.__brainstormJournalDev` (`appendParagraph` + `currentEntryId`), built on a new **shared** `@brainstorm/editor` dev primitive (`EditorCapturePlugin` + `devAppendParagraph`) so Notes/Journal/(future Tasks-inspector) don't each re-implement the capture+append mechanic. The critical Notes hook was left untouched (its migration onto the shared primitive is a tracked follow-up — safe incremental extraction). This is harness enablement, not Mira's friction — a real user types in Journal fine; the hook only exists so the headless harness can.
- **minor observations (not product bugs):** (1) the Journal opened on the **seeded June-2 welcome entry, not today** — Mira had to click *Today* to reach the current day; a daily-log tool arguably defaults to today. (2) The footer reads **"0 words"** for the programmatically-appended body — the word-count/snippet denormalize is gated on real interaction (`KEY_DOWN`/`PASTE`/…), so a harness append doesn't refresh it (same known artifact as Notes `appendParagraph`; a real typing user updates it). (3) **run-1 residue:** my first attempt (before the today-jump) appended the three lines to the June-2 welcome entry; harmless filler in a seed entry, noted with the other vault residue to sweep.

## Session 070 — the weekly operating review (2026-06-03)

### Composed review doc: both live data surfaces embedded inline — works
- **session:** 070-weekly-review   **app:** Notes × Database   **status:** ✅ verified
- Mira wrote a recurring **"Northbound — weekly operating review"** — prose on the week's focus plus the two live data surfaces she steers by, embedded inline: the **Content Calendar** (the editorial pipeline she built + filled in 065–067) and the **Clients** CRM. This is the **first time the Content Calendar pipeline is woven into the knowledge base**, closing the loop data-surface → review-doc. Both embeds resolved to their correct entity cards (`embeds=2`, titles "Content Calendar" + "Clients"). The cross-app composition holds for a second distinct artifact type (review, vs the one-time hub in 064). Evidence: `tests/dogfood/.sessions/070-weekly-review/02-02-review.png`.
- **minor ordering quirk (not friction):** `appendParagraph` appends at the doc root while the embed inserts at the cursor, so a label paragraph I added between the two embeds landed *after* both cards rather than between them. A harness-sequencing artifact of mixing the two insert paths, not a product issue — both embeds are present and correct.
- **F-023 still visible:** the Properties panel (open) again clipped the right edge of the embed cards — same inspector-overlay-covers-content fork tracked under 067/063/064/060; not re-triaged here.

## Session 069 — the newsletter cadence (2026-06-03)

### Deliverables in Tasks, scheduled ahead of each issue — works (no friction)
- **session:** 069-weekly-cadence   **app:** Tasks   **status:** ✅ verified
- The Content Calendar (065–067) says *what* ships and *when*; Mira put the matching *work* on her task list. Three **"Draft Issue #N"** deliverables, each scheduled ahead of its issue's publish date (6 / 13 / 20 Jun). Drove the Tasks compose form end-to-end: header **"+"** → `.tasks-compose` (name + scheduled-date inputs; the date field takes an ISO/natural-language string via `parseDateInput`) → primary submit. All three land on **Upcoming**, grouped by date (Sat · 13 Jun · 20 Jun). This is the **"deliverables in Tasks" cadence** piece of the core operating area, and it closes the loop between the editorial pipeline and her day-to-day work. Evidence: `tests/dogfood/.sessions/069-weekly-cadence/02-02-upcoming-after.png`.
- **note (not friction):** the nearest date group renders as the weekday (`SAT`) while later groups render as the date (`13 JUN` / `20 JUN`) — a reasonable near-term-vs-later heuristic, though a bare `SAT` with no day-of-month is marginally ambiguous; flagging only as a possible polish thought, not a problem.

## Session 068 — organizing the files (2026-06-03)

### File folder structure (Research / Drafts / Brand / Clients) — works (no friction)
- **session:** 068-files-structure   **app:** Files   **status:** ✅ verified
- Mira's knowledge base is growing, so she set up Northbound's top-level file structure in the **Files** app: **Research / Drafts / Brand / Clients**. First dogfood of the Files create + inline-rename path — toolbar **New → "New folder"** drops an "Untitled folder" selected with an inline rename input (`[data-testid="rename-input"]`); type the name → Enter. All four landed cleanly in both the sidebar tree and the content list ("Empty folder · Today"), no stray "Untitled folder" left behind. The create/rename flow is clean and fully UI-driven. (File *content* uploads through a native OS dialog — not driveable headlessly — so this builds the skeleton those files will live in; the organizing act is the verified piece.) Evidence: `tests/dogfood/.sessions/068-files-structure/02-02-folders.png`.

## Session 067 — working the pipeline (2026-06-03)

### Filled the editorial calendar: a date + a lane on every issue — works
- **session:** 067-fill-pipeline   **app:** Database   **status:** ✅ verified
- Mira worked the Content Calendar like a real editor: she **dated each issue** (a weekly cadence — 9 / 16 / 23 Jun) and **dropped each into a pipeline lane** — Issue #1 *Published*, #2 *Scheduled*, #3 *Drafting*. Both via live inline grid-cell editing: the **Date cell** (open → type ISO date → Set) and the **Select cell** (open → type the lane → "Create" — each lane minted on the fly through the shared tag-cell create path). The inspector confirms the bindings (Issue #3: Publish date 23 Jun 2026, Status Drafting). The editorial calendar is now a *usable* pipeline, not just a schema — the seam between the Database grid and the shared SDK property cells works end-to-end. Evidence: `tests/dogfood/.sessions/067-fill-pipeline/02-02-filled-pipeline.png`.

### F-023 — the Details inspector overlay BLOCKS the rightmost column (escalation: functional, not cosmetic)
- **session:** 067-fill-pipeline   **kind:** design/bug   **app:** Database   **status:** ✅ done (2026-06-04)
- **resolution (owner ruling + developer, 2026-06-04):** owner call on the fork — **the overlay-floats-above-content rule stands; hovering over content is fine** ("it can hover over content, I do not see a problem"). The bug was never the overlay — it was **auto-opening it on cell-select**. The fix is the **Notion/Anytype model** the owner pointed at: (1) selecting/editing a cell now ONLY selects — `onSelectEntity` no longer flips `inspectorOpen` (that auto-open was what made editing the rightmost column a close→click→it-reopens fight, and the open overlay's backdrop swallowed clicks on the cells beneath); (2) the inspector opens only on a **deliberate action** — a new hover-revealed **"Open" affordance** (`IconName.OpenExternal`) in each row's name/title cell (new `onOpenInspector` = select + open panel, no cross-app intent), plus the existing header toggle + double-click. So you only ever see the panel when you asked for it, and while it's open you edit *in the panel* (not the cells behind it). Resolves all three F-023 instances (094 Notes prose, 067 + 033 Database) — the auto-open was the common cause. New `onOpenInspector` + `OpenRecordButton`; threaded through GridView → GridRow → title cell; hover-reveal CSS; +1 test (opens inspector + stops propagation so it never also selects). 418 database tests green; apps typecheck + biome clean. Rule recorded in [[project_right_panel_glass_overlay_rule]]: a right panel opens only on deliberate action, never as a side effect of selection. Real-shell verify deferred to the next fix-batch session.
- **what I was trying to do:** set the Status (rightmost column) on each issue.
- **what happened:** I couldn't click the Status cells at all. The Details inspector is a right-edge `glass--strong` overlay floating over the grid, and **its backdrop intercepts the pointer events** on the rightmost column — Playwright reported `<aside id="db-inspector"> … intercepts pointer events`. Worse: **selecting/editing *any* cell forces the inspector back open** (`onSelectEntity` → `state.chrome.inspectorOpen = true`, app.ts:1357), so even after I closed it, the moment I dated a row the overlay reappeared and re-blocked Status. Editing the rightmost column becomes a repeated fight: close inspector → click cell → inspector reopens → close again. I only got through by closing it before *every* Status click.
- **what I expected:** the rightmost column to be clickable while the inspector is open — the inspector should not sit over live grid cells (or selecting a cell shouldn't auto-pop an overlay that covers the cell I'm editing).
- **evidence:** `tests/dogfood/.sessions/067-fill-pipeline/02-02-filled-pipeline.png` (Status values clipped to "Drafti"/"Sched"/"Publis" under the panel); Playwright interception log on `#db-inspector`.
- **triage (surface, not blind-fixed):** this is the **F-023 design fork**, now with teeth — it's not just visual clipping (sessions 063/064/060) but a **functional block** of the rightmost column, amplified by the auto-reopen-on-select behavior. Two coupled decisions for the owner: (1) the right-panel-glass-overlay rule says inspectors float *above* content and content must not reflow — but over an interactive grid that overlay swallows clicks on the cells beneath it; should the grid **reserve a track** (reflow) when the inspector is open, or should the overlay be **click-through except its own chrome**, or should the grid **scroll the covered columns into view**? (2) should selecting a cell **auto-open** the inspector at all when it would cover the very column being edited? Flagging for direction rather than guessing, per the design-fork rule. (Earlier F-023 reinforcements: sessions 063, 064, 060.)

## Session 066 — a real editorial pipeline (2026-06-03)

### Deepening the Content Calendar: typed Publish-date + Status columns — works
- **session:** 066-editorial-pipeline   **app:** Database   **status:** ✅ verified
- The Content Calendar (065) was a bare list of issue titles. To plan a weekly newsletter Mira needs *when* each issue ships and *where* it sits in the pipeline, so she added two columns to the existing collection via the schema editor: **"Publish date"** (Date) and **"Status"** (Select). Flow: select the collection in the sidebar → `#toolbar-settings` (View settings) → **Add column… → Create new property** → the shared `<InlinePropertyForm>` (name + kind tile + Create). The grid now reads **NAME · PUBLISH DATE · STATUS** across all three issues — a typed editorial schema, not just a title list. (Per-row values — dating each issue + the Drafting→Scheduled→Published lane — are a follow-up: the Select needs its options and each row dated, driven once a fresh-Select cell-edit is dogfooded.)
- **reinforces F-034 (duplicate property defs):** "Create new property" *always mints a new def*, so re-running this would have produced a **second "Publish date"** in the vault catalog (the 065 first-run residue meant one already existed). The founder workaround is to **pick the existing property** from the same picker instead of creating — but the picker offers both paths with no nudge toward reuse, so the duplicate-accumulation F-034 describes is one stray click away on every column add. The session is idempotent (skips a column whose header already exists) precisely to avoid seeding more dupes. Still awaiting the owner's dedupe-vs-disambiguate decision on F-034.
- **reinforces F-023 (inspector overlay covers right cells):** the Details panel sat open over the grid and **clipped the Status column header** (rendered "STATU"). The newly-added rightmost column is exactly the cell the overlay hides — the same inspector-overlay-covers-content fork, now biting a freshly-created column. Evidence: `tests/dogfood/.sessions/066-editorial-pipeline/02-02-columns-added.png`.
- **residue note (unchanged):** the stray **"New collection" (3 rows)** from 065's failed first run is still in the sidebar — a tidy pass still owed (the failed-mid-build harness-artifact pattern, not a product bug).

## Session 065 — the editorial calendar (2026-06-03)

### New data surface: a Content Calendar collection — works (no friction)
- **session:** 065-content-calendar   **app:** Database   **status:** ✅ verified
- Northbound sells a weekly newsletter, so Mira stood up a **"Content Calendar"** collection and lined up her first three issues as rows ("Issue #1 — The case for dev-tools infra", "#2 — Pricing power at seed", "#3 — When to raise"). Built entirely through the Database UI: `#sidebar-new-list` → "Blank collection", rename via the contenteditable `#stage-title` heading, `#toolbar-new` per row, inline double-click rename (`.dbv-grid__title-label--editable` → `.dbv-grid__title-input`). A second operating-data surface beyond the Clients CRM. Publish-date / status columns are a follow-up.
- **residue (harness artifact, to tidy):** my *first* run failed at the collection rename only (rows succeeded), leaving a stray **"New collection" (3 rows)** in the persistent vault next to the correct "Content Calendar". Same failed-mid-build residue pattern as the old F-024 Untitled objects — a dogfood-harness artifact, not a product bug. Will sweep stray collections in a tidy pass.

## Session 064 — the operating hub (2026-06-03)

### Deep cross-app composition: a hub with live transclusions + embed — works
- **session:** 064-operating-hub   **app:** Notes × Database   **status:** ✅ verified
- Mira built **"Northbound HQ"** — her operating home doc (core-startup-area phase): narrative + **transclusion links to her investor brief and investment thesis** (real entity ids captured via `currentNoteId()`) + the **live Clients pipeline embedded**. The composition is real and *deep*: the transcluded **brief renders its full body inline — including the brief's OWN nested Clients embed** — so the hub shows `embeds=2` (the hub's Clients embed + the one nested inside the transcluded brief). One page, the whole business one click away. The product's Block-Protocol promise holds under a genuinely composed artifact.
- **clarifies the two embed mechanisms:** `insertTransclusion` (TransclusionNode) renders the **live inline content** of the target (B6.4b — the thesis showed as a bordered "Transcluded Note" with its body); `block.embed.entity` (BlockEmbedNode) is the v1 **reference card** (F-063 note). So "see the live thing inline" = transclusion today; the *embed-card* live-render is the planned upgrade.
- **observation (not filed as friction):** a transclusion expands the target's *full* body inline (incl. nested embeds) — powerful, but for a hub-of-links a **compact/collapsed** transclusion mode would help avoid a long page; worth a design thought if hubs become common. **Reinforces F-023:** the Properties panel overlaid + clipped the right edge of the embed/transclusion cards again.

## Session 063 — assembling the investor brief (2026-06-03)

### Cross-app composition: a document with an embedded database — works (v1)
- **session:** 063-investor-brief   **app:** Notes × Database   **status:** ✅ verified
- Mira built a real artifact — a titled **"Northbound — investor brief"** note with narrative prose (thesis / traction / pipeline) **plus her live Clients database embedded as a block** (`block.embed.entity` → embed picker → "Clients"). The composition flow works end-to-end: prose persists, the embed inserts and renders a "Clients · List" block carrying the database's identity. The product's core promise (Block-Protocol cross-app composition) exercised in dogfood for the first time.
- **by-design v1 (not friction), points at a planned capability:** the embedded database renders as the **shell entity *card*** (icon + name + type), not a live inline table — per `block-embed-node.tsx`, "v1 ships the fallback card path only; the full Block-Protocol render (block-frame iframe + B6.4a live transclusion sub-editor) lights up the *same persisted node* when a providing app ships it." So "see the pipeline inline in the brief" lands when the live-embed provider ships; today's node is forward-compatible. A **planned-feature pointer**, not a bug.
- **reinforces F-023:** the Properties panel (left open) overlaid the right edge of the embed card — the inspector-overlay-covers-content design fork, again.

## Session 062 — triaging the reading list (2026-06-03)

### Bookmark read-lifecycle (Inbox → Read) — works (no friction)
- **session:** 062-bookmark-mark-read   **app:** Bookmarks   **status:** ✅ verified
- Mira right-clicked a source in her Inbox and chose **Mark read** — it moved out of the queue: Inbox **3 → 2**, Read **0 → 1**. The read-lifecycle (card object menu → surface move + live nav counts) works cleanly. The triage side of Bookmarks verified.

## Session 061 — a strategy board (2026-06-03)

### Whiteboard create + add sticky — works (no friction)
- **session:** 061-whiteboard-sticky   **app:** Whiteboard   **status:** ✅ verified
- Mira opened the Whiteboard (board "Your first sketch" in the board-list sidebar) and dropped a sticky via the **Add to board** menu → "Sticky note": a yellow sticky landed center-canvas with selection handles, on a clean grid with the tool palette + help hints ("S sticky · T text · F frame · drag to move · double-click to edit…"). First dogfood of the Whiteboard app — the create/add path is clean. (Didn't type into the sticky body — it's a CRDT-backed contenteditable; placing the node is the verified action.)

## Session 060 — metadata on a note (2026-06-03)

### Note property binding (Add-property picker) — works (no friction)
- **session:** 060-note-property   **app:** Notes   **status:** ✅ verified
- Mira opened the Properties panel and bound a property to her thesis note via the **Add property** picker (search + list of definitions + "Create new property"). Picked "Amount" → it became a property row on the note. The custom-metadata-on-an-object flow is clean and UI-driven.

### F-034 — the Add-property picker lists duplicate "Deal size" definitions
- **session:** 060   **kind:** bug? (candidate)   **app:** Notes / Database / property catalog   **status:** ✅ done (2026-06-04)
- **resolution (developer, 2026-06-04):** took the safe, **non-destructive** policy (no risky catalog migration) on both ends. (1) **Stop minting new dupes** — the "+ Create new property" commit now calls `findReusablePropertyDef`: if a catalog def with the same name (case-insensitive) + value type already exists, the column lands on *that* def instead of a fourth identical one (same name + type IS the same property — the Notion/Anytype rule). (2) **De-clutter the existing dupes** — `buildColumnAdderOptions` now collapses Existing entries that share a display name + value type, so the picker shows "Deal size · Number" **once** even when the catalog still holds four (display-only; the dupe defs stay, the first wins the slot). A genuinely different type ("Deal size · Text") is kept separate. +6 tests (collapse-keeps-distinct-type · reuse by case-insensitive name+type · no-match-on-type-mismatch · null on new/blank); database suite green; apps typecheck + biome clean. (A one-time sweep of the dogfood vault's existing dupe defs is unneeded — they're now collapsed in the UI and no new ones accrue.) Real-shell verify deferred to the next fix-batch session.
- **what I saw:** the Add-property picker showed **"Deal size · Number" four times** (plus one "Amount", one "Last contact · Date", one "Status · Select"). Four indistinguishable entries with the same name + type — a user can't tell which to pick, and the list is cluttered.
- **likely cause:** the CRM "Deal size" currency column was added/re-created across several dogfood sessions, and each add appears to **mint a new property definition** rather than reuse an existing def with the same name+type. So the vault's property catalog accumulated duplicate defs. (Partly a dogfood-vault artifact from repeated CRM-building, but the underlying behavior — no dedup/disambiguation — would bite a real user who re-adds a column.)
- **triage (surface, not blind-fixed):** needs a decision — should property creation **dedupe by name+type** (Anytype/Notion-style: reuse the existing def), or should the picker **disambiguate** duplicates (show source/usage count), and should existing dupes be **swept**? Touches the shared property catalog + a one-time vault cleanup, so flagging for the owner rather than guessing a dedup policy in an unattended loop. Evidence: `tests/dogfood/.sessions/060-note-property/02-02-picker.png`.

## Session 059 — stepping back and forth (2026-06-03)

### Nav back/forward across notes — works (no friction)
- **session:** 059-nav-back-forward   **app:** Notes   **status:** ✅ verified
- Mira opened her prep note, then her thesis, then used the header **Back** button — it restored the prep note; **Forward** re-advanced to the thesis. The shared nav-history primitive (B8) restores the previously-viewed object correctly in both directions. A core daily interaction verified clean.

## Session 058 — finding text in a note (2026-06-03)

### F-033 — Cmd+F couldn't find inside a note (chord collision) — ✅ fixed
- **session:** 058-find-in-note   **kind:** bug   **app:** Notes   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** find a word inside my thesis note.
- **what happened:** Cmd+F focused the **notes-list search** in the sidebar instead of opening the in-document find bar — even though the editor mounts the shared find-replace primitive (doc 59). Two actions were bound to `Mod+f` (the notes-list search `FocusNotesSearch` + the in-doc FindPlugin's `CmdOrCtrl+f`), and the list search won, so the in-doc find/replace bar was **unreachable on its canonical chord**.
- **root cause + fix (developer, 2026-06-03):** chord collision in `apps/notes/src/keyboard/default-chords.ts`. Per doc 59, Cmd+F belongs to in-document find; moved the notes-list search to **`Mod+Shift+F`** (the VS Code / Notion "find across notes" convention), freeing `Mod+f` for the FindPlugin. Verified real-shell (session 058): **Cmd+F opens the find/replace bar** ("lead" → 1 of 2 → Next → 2 of 2 → Escape closes), and **Cmd+Shift+F focuses the notes-list search**. Added a chord-collision guard test (`default-chords.test.ts`, 3 cases) so `Mod+f` can't be re-shadowed. apps typecheck clean.

## Session 057 — a research reading list (2026-06-03)

### Bookmark tagging + tag filtering — works (no friction)
- **session:** 057-reading-list   **app:** Bookmarks   **status:** ✅ verified
- Mira captured a source and filed it under a **#reading-list** tag, then opened that tag from the sidebar. The tag filter works: clicking it switches to the Tags surface filtered to that tag (`aria-selected=true`, header "#reading-list · 1 bookmark") showing just the tagged card with its readable-extracted title + description. The sidebar tag list reflects her accumulated vault — **All (3), reading-list (1), research (1 from session 039), Untagged (1)** — confirming bookmark continuity across sessions. The organize side of Bookmarks is clean.

## Session 056 — giving the thesis an identity (2026-06-03)

### Note icon picker (emoji search → cell → apply) — works (no friction)
- **session:** 056-note-icon   **app:** Notes   **status:** ✅ verified
- Mira set a **compass 🧭** on her "Northbound — investment thesis" note: opened the header icon affordance, typed "compass" in the picker search, picked the matching emoji. The picker applies + closes on pick, and the per-object icon then renders **consistently in the doc heading, the sidebar row, and the header breadcrumb** (per-object-icon-everywhere). The object-identity flow is clean end-to-end.

## Session 055 — pinning to the dashboard (2026-06-03)

### Dashboard pin (object menu → dashboard.pin) — works (no friction)
- **session:** 055-pin-to-dashboard   **app:** Notes → Shell dashboard   **status:** ✅ verified
- Mira pinned her **"Northbound — investment thesis"** note to the dashboard from the header ⋯ object menu. The menu verb flips correctly (**Pin to dashboard** ↔ **Remove from dashboard**) and the pin persists; the shell dashboard live-updates to show the note as an entity pin (`dashboard-icon-pin_<id>`) alongside the 11 app icons. The cross-app pin feature works end-to-end.
- **harness note (not a product bug):** my first two selector guesses were wrong — the shared object menu renders as a **fancy menu** (`.fm-menu [role="option"]`), not the headless `.bs-object-menu__item`; and dashboard pins are `.dashboard-icons__icon` (testid `dashboard-icon-pin_<id>`), not `.dashboard__icon`. A wrong selector first reported "0 pins" — verified the real selectors + screenshot before concluding (per the "verify the interaction before blaming the app" lesson). The session now drives a deterministic pinned end-state so it's re-runnable against the persistent vault.

## Session 054 — scheduling a follow-up (2026-06-03)

### Task date popover (Scheduled/Due tabs + mini-calendar) — works (no friction)
- **session:** 054-schedule-followup   **app:** Tasks   **status:** ✅ verified
- Mira clicked a task's date chip, switched to the **Due** tab, paged to next month, picked the **15th**, and hit Apply — the chip updated from "Due Today" to **"Due 15 Jul"** and the popover closed. The date-editing path (shared `createMiniCalendar`, Scheduled/Due tabs, Clear/Apply) is clean and well-built; a core CRUD action verified end-to-end. The popover anchors to the chip and floats above the list (expected), and the selected day shows a clear ring.

## Session 053 — a blank note that doesn't shout (2026-06-03)

### F-002 — new notes opened with an unchosen gold cover banner — ✅ fixed
- **session:** 053-blank-note-no-cover   **kind:** design   **app:** Notes   **status:** ✅ done (2026-06-03)
- A brand-new note used to lead with a full-bleed id-seeded gold banner Mira never chose (logged across sessions 001/052). Owner picked the **Notion-style** direction: the Notes editor now shows the cover band only once a cover is set; a coverless note shows a quiet **"+ Add cover"** affordance that opens the cover picker. The id-seeded gradient still backs every reserved-space surface (gallery cards, list, search, dashboard pins) — consistent with `50-object-covers.md §56` (the layout owns whether a context shows the band). See the full resolution under the F-002 entry below. Verified real-shell.

## Session 052 — prepping for the Vertex Labs call (2026-06-03)

### New note → title → body — works (no friction)
- **session:** 052-prep-vertex-call   **app:** Notes   **status:** ✅ verified
- Mira created a fresh **"Vertex Labs — intro call prep"** note, named it, and dropped in a 4-line agenda (goal / their pain / pitch / ask). Title landed in the heading (not the body — F-001 stays fixed), the body persisted, and the note shows under **TODAY** in the sidebar, selected. The everyday note-taking path is clean.
- **reinforces F-002:** the brand-new note still opens with the **giant gold cover banner** Mira never chose — visible across the whole top of her prep note. Known design friction (war-room candidate); not re-fixed here.

## Session 051 — tidying the task list (2026-06-03)

### Task delete (row ⋯ → Delete) — works (no friction)
- **session:** 051-tidy-tasks   **app:** Tasks   **status:** ✅ verified
- Mira deleted the stray **"Untitled"** task left in the Inbox (the F-024 residue) via the row's **⋯ object menu → Delete**. Before: the Untitled task was present; after: gone. The task-delete CRUD path — which no prior session had exercised — works cleanly. **F-024 residue cleared.**

### F-032 — every dogfood session timed out at setup (harness, not product)
- **session:** 051   **kind:** bug   **app:** _(dogfood harness)_   **status:** ✅ done (2026-06-03)
- **what happened:** every founder session timed out after 180s with an empty notes file — Mira's work never ran. The renderer console was empty, so triage was blind.
- **root cause (developer, 2026-06-03):** the harness re-seeds the persistent vault every session via `bs.dev.seedDemoApps()`, which **vite-builds all 11 apps from source in-process**. That now costs ~200s (preview's pdf.js bundle made it the heaviest), which exceeds the common `test.setTimeout(180_000)` — the build ran *inside* the per-test budget and never finished (7 of 11 apps installed, then the timeout fired mid-build of #8). Latent for sessions whose budget happened to exceed the (smaller, earlier) build cost; preview's growth tipped it over for everyone.
- **fix (developer, 2026-06-03):** (1) the harness now captures the Electron **main-process** stdout/stderr into the session `console.log` (it only captured the renderer console before — which is why the wedge was invisible); (2) added a `build` option to `seedDemoApps` and a `dev:seed-prebuilt-apps` IPC (`seedPrebuiltApps()`) that installs the bundles already on disk **without** a per-app vite rebuild; (3) a Playwright `globalSetup` builds the app bundles **once** per invocation (outside the per-test budget; guarantees freshness), and `startSession` installs them prebuilt. Sessions now start in seconds. `BRAINSTORM_DOGFOOD_SKIP_BUILD=1` reuses on-disk bundles for a fast re-run when app source is unchanged. Verified: session 051 timed out at 180s before; after, it passes in ~10–14s, and the full default path (globalSetup build → prebuilt install → session) completes green.

## Session 050 — reviewing the schedule (2026-06-03)

### Calendar Agenda view — works (no friction)
- **session:** 050-review-schedule   **app:** Calendar   **status:** ✅ verified
- Mira's **"Vertex Labs — intro call" (18 Jun, 14:00–15:00)** shows in the Agenda's upcoming list, alongside her follow-up task — confirming cross-app projection (Calendar surfaces Tasks + Events together). Clean pass.
- **reinforces F-028 (+ residue):** the agenda also lists the **"Follow up with Vertex Labs" task that session 044 completed** — a completed task still surfacing in upcoming. And there appear to be **two near-duplicate follow-up tasks** ("…(48k deal)" + a plain one) from earlier sessions. Both are minor (the completed-visibility ambiguity of F-028 + test residue); worth a one-time tidy + an F-028 decision, not fixed here.

## Session 049 — clients gallery (2026-06-03)

### Gallery view — works (no friction); confirms F-031 on cards
- **session:** 049-clients-gallery   **app:** Database   **status:** ✅ verified
- Switched Clients to the Gallery view: cards render her client names (Vertex Labs / Acme Research Co. / Beacon Analytics) with the **Status chip reading the label** ("Lead"/"Active", no raw `di_` id — the F-031 read-only-paint fix covers gallery cards too) and the **Deal size in currency**. Clean pass — the visual CRM view works.

## Session 048 — the pipeline kanban (2026-06-03)

### F-030 — board columns labeled by raw option id, not the Status label
- **session:** 048-pipeline-kanban   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what happened:** switching Clients to a Board grouped by Status produced columns named **"di_mpx7wljg_pkxtbx"** / **"di_mpx7veqp_74a2yl"** (the raw option ids) instead of "Active" / "Lead". A kanban with opaque-id columns is unusable.
- **root cause + fix (developer, 2026-06-03):** the board group-label resolver (`groupLabelResolver`) only resolved a group key as an *entity* id → title; a Select group key is an *option* id, so it fell through to the raw key. Added `optionLabelById` (scans the cached dictionaries) as the fallback, reusing the dictionary cache from F-027. Verified real-shell (session 048): columns read **"Lead" / "Active" / "Uncategorized"** with the right client cards + currency totals. Database typecheck clean.

### F-031 — board/gallery card chips show the raw option id
- **session:** 048   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- the board **card** rendered the Status property as a chip reading the raw option id (`di_…`), not "Active"/"Lead" — the read-only paint (`render/cells.ts`) didn't resolve a vocabulary value's id→label the way the editable tag-cell does.
- **fix (developer, 2026-06-03):** added an id→label vocabulary resolver (`buildVocabularyLabelResolver` / `resolveVocabularyLabel`) alongside the existing colour resolver, installed in `loadVaultProperties`; `render/cells.ts` now resolves a Select value's id→label and colours by that label. Fixes board + gallery cards and any read-only Select paint. +1 cells test (id `"s1"` → "Done" + colour). Verified real-shell (session 048): card chips read **Lead / Active**, no `di_` ids. 10 cells tests green.

### Harness incident (self-inflicted, recovered)
- while debugging this session the dogfood harness hung at startup; root cause was my own aggressive background-run + `pkill -9` retries leaving the persistent vault wedged (see [[feedback_dogfood_no_aggressive_kill]]). Recovered after the dev shell was closed; product/`main` was never affected. Lesson recorded — run dogfood sessions serially in the foreground.

## Session 046–047 — finding things (2026-06-03)

### Notes search (FTS5, body match) — works (no friction)
- **session:** 047-notes-search   **app:** Notes   **status:** ✅ verified
- Mira searched her notes for **"Vertex"** — a client named only in the investment-thesis note's *body* (not its title) — and the search returned exactly **"Northbound — investment thesis"**. The FTS5 index matches body content, and (since Notes search shares the shell's `services.search.query` index) this confirms her notes are indexed.

### Harness gap — global search (launcher) not driveable headlessly
- **session:** 046-global-search   **kind:** testability (not product)   **status:** noted
- the launcher (Cmd/Ctrl+Space, `shell/launcher`) wouldn't open in the dogfood harness — the chord never reaches the renderer under `BRAINSTORM_NO_FOCUS=1`, and there's no dev hook to open it. **Not product friction** (a focused user gets the launcher; the chord is wired). Follow-up for testability: expose a gated `window.__brainstormShellDev.openLauncher()` (mirroring Notes' dev hook) so cross-app global search can be dogfooded. The search index itself is validated via the in-app Notes path above.

## Session 045 — total pipeline value (2026-06-03)

### F-029 — a currency column's aggregation showed a bare number, not money
- **session:** 045-pipeline-total   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** read my total pipeline value from the Deal size footer.
- **what happened:** the SUM footer read **"85,000"** — a bare number — while every Deal-size cell reads "US$25,000.00". Inconsistent, and a total pipeline value should read as money.
- **root cause + fix (developer, 2026-06-03):** `formatAggregation` used a fixed `Intl.NumberFormat` with no knowledge of the column. It now takes the column's `def` and renders a value-unit aggregation (Sum/Average/Min/…) in the column's format — currency (with `def.currency`) or percent — while count-unit aggregations stay plain (a count is never money). The grid footer threads `columnDefs` through. +3 tests. Verified real-shell (session 045): the Deal size footer reads **SUM = US$85,000.00** (12k + 25k + 48k). 30 aggregation tests green.

## Session 044 — completing a task (2026-06-03)

### Task completion — works (no friction)
- **session:** 044-complete-task   **app:** Tasks   **status:** ✅ verified
- Mira marked **"Follow up with Vertex Labs"** done via the row's completion toggle: `data-done` flipped and the task left the active Upcoming list (completed tasks hidden by default). Clean pass — task completion works.
- **minor candidate (F-028):** after completing, turning on **"Show completed"** in Upcoming didn't resurface the (future-dated) completed task — it likely re-groups under its completed-today bucket rather than its old scheduled day, so "Show completed" on a future surface shows nothing. Ambiguous (arguably correct), low priority — noted for a clean repro, not fixed.

## Session 043 — organizing the vault (2026-06-03)

### Files create + name a folder — works (no friction)
- **session:** 043-organize-files   **app:** Files   **status:** ✅ verified
- Mira created a folder and named it **"Northbound"**. New → New folder creates it *and* auto-opens inline rename with the name selected, so she typed the real name in one step (nice touch); it shows in both the content list and the sidebar tree. Clean pass — Files folder creation works for organizing her vault. (Minor residue: an earlier verification run left an "Untitled folder"; worth a one-time tidy.)

## Session 041 — filtering by Status (2026-06-03)

### F-027 — filtering a Select column by its label matches nothing
- **session:** 041-apply-status-filter → 042   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **fix (developer, 2026-06-03):** the filter value step now detects a vocabulary/Select property (`selectOptionsFor`) and opens an **option picker** (the dictionary's labels) instead of the free-text prompt; the chosen option's **id** is stored as the filter value so `is/contains` matches the stored id, and `describeRule` resolves that id back to its label via `selectLabelForValue` so the chip reads `Status is "Lead"`. Cached `snapshot.dictionaries` (only `properties` was cached) for id→label. Verified real-shell (session 042): the value picker shows `["Lead","Active"]`; `Status is Lead` narrows Clients to `["Beacon Analytics"]`; the chip reads the label. 470 database tests green.
- **what I was trying to do:** filter Clients to just my Leads — `Status contains "Lead"`.
- **what happened:** the cascade worked (after F-026) and I typed "Lead" in the value prompt, but the grid went to **0 rows** — even though Beacon's Status visibly reads "Lead".
- **root cause (confirmed, session 041):** a Select cell stores the option's **id** (`tag-cell` emits `item.id`), not its label. The filter value is a **free-text** prompt, so `contains "Lead"` is compared against the stored id and never matches. So you can't filter a CRM by status — the whole point of a status field.
- **fix plan (queued for a focused iteration):** when filtering a vocabulary/Select property, the value step should be an **option picker** (the dictionary's labels) that stores the chosen option **id** as the filter value (so `$eq id == id` matches), and `describeRule` should resolve that id back to its label for the chip. Needs caching `snapshot.dictionaries` (only `properties` is cached today) for id→label. Bigger than a one-liner, so deferred to its own iteration rather than shipped half-done.

## Session 040 — filtering the pipeline (2026-06-03)

Mira went to filter her Clients down to just the leads — and couldn't filter at all.

### F-026 — the filter builder's submenu never opens (filtering impossible)
- **session:** 040-filter-pipeline   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what happened:** opening the filter menu and clicking **"Add filter rule"** just closed the menu — no property picker, no way to choose what to filter on. The whole filter-builder cascade (Add rule → property → operator → value) was dead.
- **root cause (probe, session 040):** `@120ms after Add filter rule: {menus:0}` — the submenu opened *synchronously* inside the menu-item's click handler, and the fancy-menu runtime closes the active menu on select **after** the handler returns, tearing the just-opened submenu down with it. (Sort/etc. never hit this because their items don't open a further menu.)
- **fix (developer, 2026-06-03):** new `openSubmenuNextFrame()` defers each cascade submenu (`openFilterPropertyMenu` / `openFilterOperatorMenu` / `openFilterGroupMenu`) by one frame, so it opens *after* the parent's close settles. Verified real-shell: Add filter rule → property menu opens with 3 options.

### F-017 (filter surface) — property menu/chips showed the raw key
- **session:** 040   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- the filter `colLabel` used `humanize(propertyId)`; now routed through the shared `propertyDisplayName` (sixth and final F-017 surface — grid header, inspector, columns list, sort menu, export, filter all consistent). Verified: the filter property menu reads **"Status / Deal size / Last contact"**.

## Session 039 — capturing a research source (2026-06-03)

### Bookmarks capture + readable extraction — works (no friction)
- **session:** 039-capture-source   **app:** Bookmarks   **status:** ✅ verified
- Mira added `https://example.com` with "Download page content" on, tagged #research. The bookmark landed with its **title ("Example Domain"), domain, and meta description** all pulled by readable extraction, filed under the research tag. Clean pass — the capture flow works for her research library. (The two "Example Domain" cards are different URLs — this one + session 014's `example.com/research/through-line` — not a duplicate bug; example.com serves the same page for any path.)

## Session 038 — scheduling a meeting (2026-06-03)

### F-025 — picking a later start blocks save with "End must be after the start"
- **session:** 038-schedule-meeting   **kind:** bug   **app:** Calendar   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** create "Vertex Labs — intro call" and set it to 18 Jun, 14:00.
- **what happened:** I set the **start** to 18 Jun, but the **end** stayed at the form's default (1 Jun) — now before the start — so Save failed with *"End must be after the start."* The form never moved the end when I moved the start, so any event scheduled away from the default day errors and has to have its end hand-fixed.
- **fix (developer, 2026-06-03):** the start input now carries the end by the same delta (preserve duration) on change — the calendar-standard behaviour (`event-detail.ts`); `draft` stays in sync so the all-day toggle reflects the shift. +1 test (move start past the end → end follows, duration preserved, save resolves). Verified real-shell (session 038): the meeting saves and lands on 18 Jun. 132 calendar tests green.

## Session 036–037 — research notes (2026-06-03)

### Notes research note — works (no friction)
- **session:** 036-research-note   **app:** Notes   **status:** ✅ verified
- Mira wrote her core artifact: a note titled **"Northbound — investment thesis"** with a 3-line body (via the `__brainstormNotesDev.appendParagraph` hook — the reliable path, since raw Playwright keystrokes corrupt the Yjs body). Title typed into the auto-focused TitleNode stuck; body rendered; the note shows in the sidebar under TODAY. Clean pass — the Notes editor works for her real workflow.

### F-024 (broadened) — "Untitled" object residue across apps; tidied
- **session:** 035/036/037   **kind:** bug? (candidate, partially actioned)   **app:** Notes + Tasks   **status:** ✅ done (2026-06-04, not reproducible)
- the early note-focus exploration sessions (001–004) left **6 "Untitled" notes** in Mira's sidebar, plus a stray "Untitled" task in the Tasks Inbox (F-024). All are empty/nameless objects from earlier compose/quick-add flows. **Tidied (session 037):** deleted the 6 Untitled notes; sidebar is now clean (thesis + Welcome + two titled early notes). The Tasks "Untitled" remains. **Open:** confirm whether a user can still create an empty-named note/task today (the compose form treats empty-name submit as a no-op, so the minting path — likely an immediate quick-add on `+`/Cmd+N — needs a clean repro).
- **root-cause audit (developer, 2026-06-04):** no current path mints a nameless **task** — the *only* task-creation path is the compose form's `commit`, guarded by `if (trimmed.length === 0) return;` (the inline-rename path guards the same way). There is no immediate quick-add on `+`/`Cmd+N` (both open the focused composer). For **notes**, a blank "Untitled" note is a legitimate transient (you create, then type) and is now disambiguated in the list by F-039 (last-edited time + "(n)" ordinal). So the residue was historical churn from the now-removed early-focus exploration flow, already tidied — **not reproducible today**. Closing.

## Session 035 — scheduling a follow-up (2026-06-03)

With "Last contact" dates in the CRM, Mira scheduled a follow-up with her top
lead — a cross-app step (Database → Tasks).

### Tasks follow-up scheduling — works (no friction)
- **session:** 035-schedule-followup   **app:** Tasks   **status:** ✅ verified
- Created **"Follow up with Vertex Labs (48k deal)"** via the header New-task button, set a scheduled date (2026-06-20), submitted — it landed correctly under **Upcoming** with its name + date intact. The Tasks create + date scheduling flow works end-to-end. Recorded as a clean pass (the F-004 button + F-009 scheduling fixes hold up in a real workflow).

### F-028 — completed tasks cluttered the upcoming Agenda
- **session:** 044 → 050   **kind:** bug   **app:** Calendar   **status:** ✅ done (2026-06-03)
- a task Mira **completed** still showed in the Calendar **Agenda** (the forward-looking "what's coming up" list), undifferentiated from live items — confusing in a to-do-style view.
- **root cause + fix (developer, 2026-06-03):** the Task→calendar projection deliberately keeps completed tasks (so they stay on the Month/Week/Day grids as *history*) — but the Agenda is forward-looking. `taskToScheduledItem` now carries `done` (from `completedAt`), and `compileAgendaView` excludes `done` items from the upcoming list while the date-grid views keep them. +2 tests (projection sets `done`; agenda drops `done`). Verified real-shell (session 050): the agenda dropped from 5 rows to 3 — the completed follow-up tasks are gone, the meeting (event) stays. 134 calendar tests green. (The two near-duplicate follow-up tasks turned out both completed, so they no longer appear; residue is now harmless.)

### F-024 — a stray "Untitled" task sits in the Inbox (candidate)
- **session:** 035   **kind:** bug? (candidate)   **app:** Tasks   **status:** ✅ done (2026-06-04, not reproducible)
- **what happened:** the Inbox carries an **"Untitled"** task (not from this session — my follow-up went to Upcoming, named). Likely residue from an earlier compose/quick-add that created a task with no name. The compose form treats an empty-name submit as a no-op, so the path that minted it is unclear — possibly a Cmd+N quick-add. Worth a clean repro (can an empty-named task be created?) + a one-time tidy of the stray.
- **root-cause audit (developer, 2026-06-04):** consolidated with **F-024 (broadened)** — see that entry. The only task-creation path is the compose `commit`, guarded by `if (trimmed.length === 0) return;`; `Cmd+N` / `+` both open the focused composer (no immediate nameless mint). So an empty-named task can't be created today; the stray is historical residue. Not reproducible — closing.

## Session 033–034 — running the pipeline (2026-06-03)

Mira filled a deal size for each client and sorted by value to see her biggest
deals. It worked — and surfaced two more things.

### F-017 (sort-menu + export surfaces) — raw keys again
- **session:** 033/034   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what happened:** the **sort menu** listed her columns as "Prop Mpx6xww2…" instead of "Deal size" (so you couldn't tell which to sort by), and the **CSV/JSON/Markdown export** would write the generated key as the column header.
- **fix (developer, 2026-06-03):** one shared `propertyDisplayName(propertyId)` (catalog `name` → humanized-key fallback) now backs the sort menu *and* export headers, joining the grid header / inspector / columns-list (the F-017 family is now consistent across all five surfaces). Verified real-shell (session 034): sort menu reads "Status / Deal size / Last contact". Pipeline sort by Deal size returns Vertex (48k) → Acme (25k) → Beacon (12k).

### F-023 — editing right-side cells fights the open inspector
- **session:** 033   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-04, owner ruling — see F-023/067 for the fix)
- **what happened:** with the Details inspector open, the right-hand columns sit *under* it (the inspector is a glass overlay above content, by the right-panel rule — content must not reflow), so those cells can't be clicked to edit; and selecting any row re-opens the inspector, so editing several cells in a wider table means closing it repeatedly.
- **triage:** stems from the deliberate overlay design ([[project_right_panel_glass_overlay_rule]]) + auto-open-on-select. Not a clear bug — a design call (e.g. don't auto-reopen on select while editing, or let the grid scroll the active cell clear of the overlay). → war room. Workaround today: close the inspector while bulk-editing.

## Session 031 — completing the CRM (2026-06-03)

### F-022 — I couldn't remove a column I added by mistake
- **session:** 031-remove-column-cleanup   **kind:** gap   **app:** Database   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** drop the duplicate "Deal size" columns left over from setting up.
- **what happened:** the View-settings Columns list let me re-order (drag) and hide (checkbox) a column, but there was **no way to remove one**. A column added by mistake was permanent (hidden at best) — a CRM you can't take fields off of isn't really editable.
- **fix (developer, 2026-06-03):** each column row gains a remove (×) button (`columnsSection`, `view-settings.ts`) that drops it from the view's columns; the property def stays in the vault catalog so it can be re-added via "Add column". The Name/title column is the collection's identity and isn't removable. Dim affordance that brightens on row hover. Verified real-shell (session 031): removed 2 duplicate Deal-size columns from Clients, leaving exactly one — Status + Deal size.

## Session 023–026 — tracking deal value (2026-06-03)

Mira went to record each client's deal size in dollars — which meant making a
money column. That's where the currency story starts.

### F-019 — I can't make a money column (no currency option when creating a property)
- **session:** 023-track-deal-size   **kind:** gap   **app:** Database (SDK property form)   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** add a "Deal size" column in dollars.
- **what happened:** the property creator offered Text / Number / Boolean / Date / Select / File, and a sub-format only for **Text** (Plain/Url/Email/Phone). Picking Number gave a plain number — no way to say "this is money", no currency. So I couldn't track deal value as currency.
- **architecture (established 2026-06-03, owner asked first):** currency is a **per-property modifier**, not per-value — a money column is `number` + `format=currency` + `currency:"<ISO-4217>"` (one currency per column; the value stays a bare number; defaults to USD). The data layer, **validator**, and **formatter** (`Intl.NumberFormat`) already supported this; the per-value `valueMeta` shape (a currency *with each value*) is the v2 design (`docs/data/19…:348`, OQ-LD-15). The only gap was the creation UX.
- **fix (developer, 2026-06-03):** added a **Number sub-format control** (Plain / Currency / Percent) to the shared `<InlinePropertyForm>`, mirroring the Text one; picking **Currency** reveals a curated ISO-4217 **code picker** (USD default). `draftInlineProperty` layers `format`+`currency` (or `format=percent`) onto the Number def. New logic (`InlineNumberFormat`, `supportsNumberFormat`, `INLINE_CURRENCY_CODES`) + form UI + labels wired in Database + Notes. +7 SDK tests. Verified real-shell (session 023): the form shows Currency + a USD picker and creates a named "Deal size" currency column. Reusable across every app that mints properties.

### F-020 — editing a formatted number wiped it (currency/grouped values can't reload)
- **session:** 025-currency-cell-probe   **kind:** bug   **app:** Database (SDK cells)   **status:** ✅ done (2026-06-03)
- **what happened (found by code-reading while verifying F-019):** the number cells (`PillCell`/`PlainCell`) pre-filled their `<input type="number">` editor with the *formatted display* — "$25,000", "25%", or even a grouped "25,000" — none of which an HTML number input can hold, so re-editing parsed back to `NaN` and silently cleared the value.
- **fix (developer, 2026-06-03):** new shared `editScalar(def, value)` — numbers edit as their **raw value** (e.g. `25000`), text edits as its display (identity). Wired into both number cells. +2 tests. Makes the currency feature (and any grouped/large number) actually round-trip on re-edit.

### F-017 (view-settings surface) — the Columns list still showed the raw key
- **session:** 024   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what happened:** the View-settings **Columns** list labeled each toggle with the generated key ("Prop Mpx6xww2 2vzk7i") instead of the property name. Third surface of F-017 (after the grid header + inspector).
- **fix:** `columnsSection` now reads the catalog def's `name` (it already receives `vaultProperties`), falling back to the humanized key. Verified real-shell (session 024): the Columns list reads "Status", "Deal size".

### F-021 — clicking a number/text cell did nothing unless you hit the tiny text
- **session:** 025/027/028/029   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what happened:** clicking a number (or text) cell in the grid usually did nothing — focus landed on the row, no editor. So I couldn't enter a deal size at all.
- **root cause (residue-free repro, session 028):** NOT a focus-steal. The scalar editor (`.bs-cell-pill` / `.bs-cell-plain`) is an `inline-flex` button sized to its *content* ("Empty"), so in a wide grid cell most of the cell is dead space — a click there hits the cell/row and selects, never reaching the button's `onClick`. Select/Tag worked only because its trigger fills the cell. A real user clicking anywhere but the small text got nothing.
- **fix (developer, 2026-06-03):** the editable scalar control now stretches to fill the cell in the grid (`.dbv-grid__cell--editable > .bs-cell-pill/.bs-cell-plain { flex: 1; max-width: none }`), so the WHOLE cell is the edit click-target (Notion-style full-cell hover + click; text stays left-aligned). Verified real-shell (session 029): clicking the cell center opens the editor, `25000` renders **"US$25,000.00"**, the column SUMs, and re-editing reloads the raw `25000` (F-020). **Currency works end-to-end: create the column → type an amount → see it formatted.**
- **note:** Mira's vault carries a few residue collections ("New collection", "New collection 2") + duplicate Deal-size columns in Clients from verification runs — worth a one-time tidy.

## Session 020–022 — triaging leads (2026-06-03)

Mira's CRM reads end-to-end now, so she did the next real thing: set a **Status**
on each client (Lead / Active) to triage her pipeline.

### F-018 — a Select cell's option list opens *behind* the Details inspector
- **session:** 020-set-client-status   **kind:** bug   **app:** Database (SDK cells)   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** set each client's Status — click the Status cell, type "Lead", create the option.
- **what happened:** the option popover opened and the "Create 'Lead'" row was right there, but clicking it did nothing — the Status stayed "Select…". I couldn't set a status at all with the inspector open.
- **root cause + fix (developer, 2026-06-03):** the probe (session 021) nailed it — at the create row's coordinates the topmost element was `db-inspector__collection-open`: the **Details inspector (`#db-inspector`, z-index 100) painted over the cell popover and swallowed the click**, even though `.bs-cell-pop` is z-index 200. The popover was rendered *in place* in the React tree, so its `z-index` was trapped inside the virtualized grid's stacking context (and its `position: fixed` re-based to a transformed ancestor) — it never competed at the root layer. Fix: `CellPopover` now `createPortal`s its panel to `document.body` (`packages/sdk/src/property-ui/cells/cell-popover.tsx`), so `fixed` resolves against the viewport and `z-index: 200` beats the inspector. Same "transient layers escape to the top" rule as F-016. Verified real-shell: probe (021) sets "Lead" via the create row (`createIsTopmost: true`, click ok); full session (020) sets Lead/Active on two clients with colored chips. Fixes the editing popover for *every* app's cells (Notes / Bookmarks inspectors had the same latent trap).

### F-017 (inspector surface) — the property row also showed the key, not the name
- **session:** 020   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what happened:** with the grid header fixed (F-017), the **Details inspector** still labeled the property "Prop Mpx6xww2 2vzk7i" instead of "Status".
- **fix (developer, 2026-06-03):** `InspectorProperties` already resolves an effective def per row for the editing cell — the `<dt>` label now reads that def's `name` (falling back to `humanize(key)`), the same rule as the grid header. Verified real-shell (session 022): inspector labels read "Status".

## Session 017–018 — fleshing out the CRM (2026-06-02)

With inline rename working, Mira named all three clients (Acme Research Co.,
Beacon Analytics, Vertex Labs) and went to give the collection a **Status**
column — the next thing any CRM needs.

### F-015 — "Add column…" is below the fold in View settings and can't be reached
- **session:** 018-flesh-out-crm   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-02)
- **what I was trying to do:** add a Status column to my Clients collection.
- **what happened:** the Grid-settings popover is tall — View name → a SHOWN-OBJECTS type checklist → View type → Layout — and the **Columns / "Add column…"** section is at the very bottom, *past the bottom edge of the window*. I can't scroll to it; it's just unreachable. So I can't add a column at all on a normal-height window.
- **what I expected:** the settings panel fits the window and I can scroll to every section, including Add column.
- **evidence:** `tests/dogfood/.sessions/018-flesh-out-crm/02-02-view-settings-open.png` (popover runs off the bottom; "Add column…" never visible). Harness probe: *'Add column…' fully in viewport without scrolling: false*, and a click on it fails with *element is outside of the viewport*.
- **root cause + fix (developer, 2026-06-02):** `openViewSettings`'s `positionPopover` set `top = anchorBottom + 8` but left the height to the CSS `max-height: calc(100vh - 96px)` — a fixed cap that ignores *where* the popover is anchored. Anchored ~148px down, the popover can run to ~780px, past a 728px window, so its bottom section (and the bottom of its own scroll area) sits off-screen and is unreachable. Fix: extracted a pure `computePopoverPlacement(anchor, viewport, opts)` helper (`logic/popover-placement.ts`) that clamps `maxHeight` to the actual space below the anchor and **flips the panel above** the anchor when there's materially more room there; `positionPopover` now just applies it. The popover's existing `overflow-y: auto` then gives a reachable scrollbar within the viewport. Unit-tested (clamp-below, flip-above, horizontal clamp, min-height floor); verified real-shell (session 018): Add column became reachable. (Benefits every view-settings open, not just small windows.)

### F-016 — the column-adder menu opened *behind* the settings panel; its options couldn't be clicked
- **session:** 018-flesh-out-crm   **kind:** bug   **app:** Database (SDK menus)   **status:** ✅ done (2026-06-02)
- **what happened:** with "Add column…" reachable (F-015), clicking it opened the adder menu — but because the button sits at the *bottom* of the now-fitted settings popover, the menu flips *up* and overlaps the panel. The menu rendered *under* the panel: every click on "Create new property" landed on the View-settings popover instead. (Harness: *`.db-popover` subtree intercepts pointer events* over the menu row.)
- **root cause + fix (developer, 2026-06-02):** the fancy-menus runtime leaves `.fm-menu` at `z-index: auto`, while `.db-popover` is `z-index: 101` — so a menu overlapping its own host popover loses the stacking contest. A menu is a transient top-most action layer and must sit above any surface it opens from. Fix: `.fm-menu { z-index: 130 }` in `packages/sdk/src/menus/menus.css` (above the popover/object-menu overlays at 101/102, below the full-screen pickers at 1000). Verified real-shell (session 018): the adder menu sits on top, "Create new property" is clickable, the property form opens. Fixes every fancy menu opened from inside a dialog/popover, not just this one.

### F-017 — a column I created shows its internal id, not the name I gave it
- **session:** 018-flesh-out-crm   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** finish adding the **Status** column (named it "Status", picked the Select kind, hit Create).
- **what happened:** the column was added, but its header reads **"PROP MPX6XWW2 2VZK7I"** — the generated property *key* — not "Status". So I can't tell my own columns apart. evidence: `tests/dogfood/.sessions/018-flesh-out-crm/05-03-status-column-added.png`; harness: *Column headers after add: ["NAME","PROP MPX6XWW2 2VZK7I"]*.
- **root cause + fix (developer, 2026-06-03):** the grid header rendered `humanize(column.propertyId)` (`grid-view.tsx`) — it never consulted the property def's display `name`, so a user-created key (`prop_<…>`) always showed as a humanized id. (My first triage *also* blamed the property catalog for returning 0 — that was **wrong**: re-reading the full session console showed the catalog round-trip works fine; `setProperty` persists and `list()` returns `1 properties, 1 dictionaries` right after creation. The def — name and all — was available the whole time; only the header ignored it.) Fix: a `columnLabel(propertyId, defs)` helper feeds the header the effective def's `name` (catalog def via `resolvePropertyDef`, else inferred), falling back to `humanize(key)` only when nothing resolves; `SortableHeaderCell` renders it for both the visible text and the `title`. +2 tests (created-name shown, humanized-key fallback). Verified real-shell (session 019): the Clients grid header reads **STATUS**, no raw `prop_` key. Mira's CRM now reads end-to-end — named rows + named, editable Status column.

## Session 015–016 — naming clients (2026-06-02)

### F-014 — collection rows (generic Objects) can't be renamed
- **session:** 015/016   **kind:** bug/gap   **app:** Database   **status:** ✅ done (2026-06-02)
- **what happened:** Mira's 3 client rows are all "Untitled" and she can't name them. The grid **title column is not inline-editable** (`grid-view.tsx:553` — double-click calls `onOpen(entity)`, opening it, not an inline editor), and opening the row shows the inspector with **no editable name field** (`Editable name field present: false`) — just *"Untitled · Object · Open in default"*. So there is **no way to name a client**, in the grid or the inspector. The generic `brainstorm/Object/v1` rows I added for F-008b are creatable but dead-ends: no rename, and "Open in default" has no opener registered for the type.
- **root cause:** the F-008b generic-Object keystone is incomplete — a row needs *some* way to set its name. The grid intentionally opens-on-double-click (rename normally happens in the entity's own app), but a generic Object has no own app, so the loop is unclosed.
- **fix options (design call):** (a) make the grid title cell inline-editable (spreadsheet-style rename — most CRM-natural, but changes open-on-dblclick); (b) add an editable name field to the inspector for generic Objects; (c) register a minimal detail/editor for `Object/v1`. → war room.
- **triage + fix (developer, 2026-06-02):** shipped **(a) + (b)**, scoped to generic Objects so typed rows keep renaming in their own app. (a) The grid title cell now renders an inline-editable `EditableTitle` for a `brainstorm/Object/v1` row (`grid-view.tsx`): double-click the name → text input → Enter/blur commits to `properties.name`, Escape discards; pointer/key events are kept off the row so editing never selects/opens/drags it. Single-click still selects, so the row's open-on-double-click is preserved for typed rows. (b) The inspector heading is now the rename field for a generic Object (`app.ts renderInspector`, mirroring the collection-title heading) so the row isn't a dead-end after you open it. Both write through the same optimistic `persistEntityPatch`. Tests: 4 new `EditableTitle` cases in `grid-view.integration.test.tsx` (commit on Enter, commit on blur, discard on Escape, no-op when unchanged) — RED→GREEN; 463 database tests green. Verified in the real shell (session 017): a client renamed `Untitled` → `Acme Research Co.` inline in the grid, reflected in the inspector, no console errors. `tests/dogfood/.sessions/017-rename-client-inline/03-03-clients-after.png`. **Mira can name her clients.**

## Session 012–014 — Mira expands (2026-06-02)

### F-013 — Graph opens to a technical "Pattern" builder, not a knowledge map
- **session:** 012-mira-expands   **kind:** design   **app:** Graph   **status:** ✅ done (2026-06-04, via F-049)
- **what happened:** Mira opened Graph expecting to *see her work connected*; instead the default surface is a Pattern editor — *"A pattern is one or more subjects (each scoped to entity types) wired by typed connections. Edit the subjects and connections below…"*. That's power-user / data-model language. A non-technical founder doesn't know what a "subject scoped to entity types" is.
- **resolution (developer, 2026-06-04):** this is the original of the **F-049** war-room fork (Marcus re-found it in 103), and the F-049 reframe closes it: the Graph filters panel now leads with a plain **"Show"** lens (a checkbox per entity type; all-off = the whole vault connected) with the subjects / typed-connections / Where builder folded under a collapsed **"Advanced"** disclosure — exactly the "approachable map, Pattern behind an advanced toggle" direction this entry asked for. See F-049 for the implementation.
- **triage:** needs a design call — is the default an approachable "everything, connected" map with the Pattern builder behind an advanced toggle? Likely a war-room item.

### Bookmarks capture — NOT a bug (harness artifact)
- Session 012's "0 bookmarks captured" was my **test selector**, not the app: the empty-state "Add bookmark" button shares the `.bookmarks__form-btn--primary` class with the form's "Save bookmark", so the unscoped selector clicked the wrong one. Scoping to the dialog (`[role="dialog"] …`) → the bookmark captures fine **and** runs readable-extraction (fetched the page's title + description). Recorded so it isn't mistaken for friction. Reinforces: verify the interaction before blaming the app.

## Session 009 — Mira's first real workday (2026-06-02)

The blockers are fixed, so Mira did real work (journal, deliverables, Clients
CRM). It worked — and surfaced the next wave. These are **candidates** pending
clean reproduction next session, not yet confirmed bugs.

### F-011 — can't add rows while the Details inspector is open
- **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-02)
- **what happened:** Mira couldn't add rows to her collection — "+ New" did nothing. Session 009 looked like a rename problem, but session 011 pinned it: the **open Details inspector** (`#db-inspector`, a `glass--strong` absolute overlay pinned `top:0;bottom:0;end:0;width:320px`) **covers the view-bar toolbar**, so "+ New" / filter / sort / settings are unclickable while it's open (Playwright: *`#db-inspector intercepts pointer events`*). Since the inspector's open/closed state persists, Mira's CRM was effectively unusable whenever it was open.
- **root cause + fix (developer, 2026-06-02):** the inspector floats above the rows (right-panel rule — rows must not reflow), but it also sat over the toolbar. Fix: inset *only* the toolbar row by the inspector width when open (`.db-main[data-inspector-open="true"] .db-stage__view-bar { padding-inline-end: var(--db-inspector-width) }`) so its buttons sit left of the overlay; the data rows stay full-width underneath. Verified real-shell (session 011): Mira added 3 client rows to Clients with the inspector open. (This also resolves the session-009 "rename" red herring.)
- **evidence:** `tests/dogfood/.sessions/011-mira-builds-crm/01-clients-filled.png`

### F-012 — journal "N words" count looks stale / wrong
- **kind:** bug   **app:** Journal   **status:** ✅ done (2026-06-04)
- **what happened:** today's entry shows far more than "9 words" of text but the footer reads "9 words". Likely the word-count isn't recomputed on the rendered body.
- **evidence:** `tests/dogfood/.sessions/009-mira-workday/01-journal-written.png`
- **root cause + fix (developer, 2026-06-04):** repro'd in the projection logic, not the render. `projectJournalEntries` computed the footer/properties count as `wordCount(previewBodyText(note.body))` — and `previewBodyText` **truncates the body to 200 chars** for the date-navigator preview. So the count was the *preview's* word count, capped at ~35 words and frozen there no matter how long the entry grew (the "looks stale" symptom — it stops climbing). New exported `bodyWordCount(body)` counts the **whole** flattened body (no truncation); the projection now uses it. The projection re-runs on every vault-entities `onChange`, so the count tracks edits live — once it's counting the full body. +4 tests (past-the-cap count · nested Lexical body · empty/unknown · proof the old preview path under-counts); journal typecheck + biome clean. Real-shell verify deferred to the next fix-batch session.

### Vault hygiene (testing artifacts, not product bugs)
- Mira's vault accumulated junk **"New collection 4–11"** from the F-008 verification runs, and today's **journal body carries garbled text** typed into the *pre-fix* broken editor (session 002). Both are self-inflicted test residue in her real workspace — worth a one-time cleanup, not friction reports. F-003 itself is confirmed working (the seeded entry + mention render correctly).

## Session 006 — F-008 keystone verification (2026-06-02)

### F-010 — a freshly-created collection doesn't stay active
- **session:** 006-crm-collection-check   **kind:** bug   **app:** Database   **status:** ✅ done (2026-06-02)
- **what I was trying to do:** create a blank "Clients" collection and immediately start adding rows to it.
- **what happened:** the new collection is created, but the view falls straight back to "All vault items" — the collection isn't the active surface and doesn't appear as its own sidebar entry, so the next "+ New" doesn't reliably land in it.
- **root cause (developer, 2026-06-02):** `createListWithSource` sets the new collection active in memory, but persisting the new `List/v1` entity fires a vault `onChange` → `loadVaultEntities` rebuild that re-applies the *persisted* active selection (`app.ts:3097`); the persist is debounced, so the rebuild clobbers the in-memory selection back to the default. Post-9.3.5.V (lists are entities) this likely affects typed-list creation too — the F-008 keystone work *exposed* it. The generic-Object row-create logic itself is correct + unit-tested; this is the integration seam in front of it.
- **evidence:** `tests/dogfood/.sessions/006-crm-collection-check/02-blank-collection-created.png`, `03-row-added.png`
- **triage (developer, 2026-06-02):** root cause — `schedulePersist` refreshed the in-memory `persistedUserDeltas` overlay for `viewOverrides`/`lastViewByList` (with a comment explaining why a rebuild can land before the debounced disk write) but **missed `lists`/`views`/`active`**, so a just-created collection wasn't in the overlay and `applyVaultSnapshot` dropped it → selection couldn't resolve → reset. Fix: extend that synchronous overlay refresh to `lists`/`views`/`active`; and `createEntityInActiveList` now `schedulePersist`s the membership before its reload so a new row survives the rebuild. Verified end-to-end in the real shell (session 006): blank collection stays active, "+ New" lands a generic Object in it (count 0 → 1). 459 database tests green. **F-008 keystone now works end-to-end.**

## Session 002 — build the business (2026-06-02)

Mira tried to actually stand Northbound up: thesis note, a Clients CRM, this
week's deliverables, today's journal. The note and the tasks worked; the CRM
and the journal did not.

### F-008 — I can't build a CRM; "New list" only filters existing types
- **session:** 002-build-the-business   **kind:** gap   **app:** Database   **status:** ✅ done (2026-06-02) — Phase 2 relations deferred. See [war-room thread](war-room.md#thread-f-008--a-crm--custom-collection-for-northbound)
- **what I was trying to do:** create a "Clients" collection with my own columns (company, status, deal size, last contact).
- **what happened:** the only create affordance — the New-list `+` — opens a dialog titled *"New list — choose what to show"* with checkboxes for **existing** types (Folders, Notes, Bookmarks, Events, Projects, Tasks, Whiteboards, Entries). A "list" here is a saved *filter/view* over things that already exist, not a new table I can give my own fields. There's no "new object type" / "new collection with custom properties" anywhere. So I cannot build a CRM — the core thing a research business needs.
- **what I expected:** create a new collection, define my own properties, add rows.
- **evidence:** `tests/dogfood/.sessions/002-build-the-business/03-db-after-new-list.png`
- **triage (developer, 2026-06-02):** investigation flipped this — most of it already EXISTS, just hidden. Custom columns (colored select / currency / date) shipped in 9.3.5.U.b; user collections persist as `List/v1` entities (9.3.5.V). The "New list — choose what to show" dialog hides that you can build your own collection. Split into **F-008a** (discoverability — buildable now) + **F-008b** (the real gap: creating a brand-new typed *row* in a user collection — `app.ts:1934` only creates rows for `ByType` lists; needs a data-model position, OQ-DM territory). See the [war-room thread](war-room.md#thread-f-008--a-crm--custom-collection-for-northbound). **Resolved 2026-06-02 (owner: generic Object type):** (1) "New collection → Blank collection" entry makes custom collections discoverable; (2) `decideRowCreate` mints a `brainstorm/Object/v1` for manual collections + pins it into members so "+ New" works (9d048b4c); (3) F-010 fix keeps the new collection active (e198cf08); (4) the View-settings Columns section + "Add column…" now render on an *empty* collection (was gated on `columns.length > 0`) so Mira can add her first custom column. All real-shell verified (sessions 006, 007). **Mira can build the Clients CRM end-to-end.** Bidirectional relations remain Phase 2.

### F-009 — adding a task from "Today" silently files it into Inbox
- **session:** 002-build-the-business   **kind:** design   **app:** Tasks   **status:** ✅ done (2026-06-02)
- **what I was trying to do:** add this week's deliverables while looking at Today.
- **what happened:** Cmd+N worked and captured all three, but they went to **Inbox** with no date, so nothing showed where I was looking (Today). Fine as a capture model, but the disconnect is mildly confusing when you add from a dated view.
- **what I expected:** either land on Today (the view I'm in) or a hint that it went to Inbox.
- **evidence:** `tests/dogfood/.sessions/002-build-the-business/06-tasks-after.png`
- **triage (developer, 2026-06-02):** composing while on Today now defaults the new task's schedule to today (`defaultScheduledAt` on the compose form), and the post-create landing puts a today-scheduled task on Today instead of redirecting to Inbox. Verified real-shell (session 008): a task added from Today appears under TODAY. (Explicit Inbox composing is unchanged.)

## Session 001 — day one (2026-06-02)

Mira's first hour: opened the app, started her first research note, went looking
for a CRM, a place for this week's work, and today's journal entry.

### F-001 — I typed my note's title and it became a body paragraph instead
- **session:** 001-day-one   **kind:** design   **app:** Notes   **status:** ❎ not reproduced (harness artifact, 2026-06-02)
- **what I was trying to do:** create my first note and give it the title "Northbound — research thesis".
- **what happened:** I hit `+`, a new note opened with the cursor in the body, and my "title" text landed as the first body paragraph. The Title field stayed empty (header still says "Untitled"), yet the sidebar list shows my note *named* "Northbound — research thesis" (derived from the body). So the note has two conflicting identities at once.
- **what I expected:** a new note focuses the **title** first (like Notion/Bear/Apple Notes); what I type is the title until I press Enter.
- **evidence:** `tests/dogfood/.sessions/001-day-one/03-notes-after-new.png`, `04-notes-typed.png`
- **triage (developer, 2026-06-02):** could NOT reproduce as a product bug. The Notes editor's `InitialFocusPlugin` focuses the TitleNode on new-note mount. Session 001's script *clicked into the body* before typing, which overrode that focus — the cause was the harness, not the app. Honest repro (session 004): create note → don't click → type → `title="My research thesis title"`, body empty. Initial focus → title works. The only residual is cosmetic: a note with body content but an empty title shows "Untitled" in the header while the sidebar shows a body-derived name — a legitimate edge state, not worth a change. **Closing as not-a-bug.**

### F-002 — a brand-new blank note has a giant gold cover banner
- **session:** 001-day-one (resolved in 053-blank-note-no-cover)   **kind:** design   **app:** Notes   **status:** ✅ done (2026-06-03)
- **what I was trying to do:** just start writing.
- **what happened:** an empty note opens with a large default gold cover eating the top third of the page before I've written a word.
- **what I expected:** a clean blank note; the cover is something I *add*, not a default that dominates an empty page.
- **evidence:** `tests/dogfood/.sessions/001-day-one/03-notes-after-new.png` (before); `tests/dogfood/.sessions/053-blank-note-no-cover/01-01-fresh-note.png` (after — clean note + "Add cover").
- **resolution (developer, 2026-06-03):** owner picked the Notion-style direction. The Notes **editor** now shows the cover band only when the note has an explicit `properties.cover`; a coverless note shows a quiet, discoverable **"+ Add cover"** affordance instead (opens the same cover picker). Doc-consistent: `50-object-covers.md §56` gives the layout authority over *whether a context shows the band at all*, so suppressing the editor band for a coverless note doesn't touch the covers-everywhere invariant — the **id-seeded gradient still backs every reserved-space surface** (gallery cards, list rows, search results, dashboard pins). Verified real-shell (session 053): blank note has no band, "Add cover" present + opens the picker. apps typecheck clean.

### F-003 — I couldn't write today's journal entry; the editor was blank
- **session:** 001-day-one   **kind:** bug   **app:** Journal   **status:** ✅ done (2026-06-02)
- **what I was trying to do:** write today's daily log.
- **what happened:** Journal opened on "Tuesday, 2 June 2026" with the calendar on the left, but the writing area was empty — no cursor, no placeholder, just "0 words" — and the console threw `[journal/editor] Minified Lexical error #83`. There was nowhere to type.
- **what I expected:** click today, get a focusable editor.
- **evidence:** `tests/dogfood/.sessions/001-day-one/07-journal.png` + console: `[journal] error: [journal/editor] Minified Lexical error #83`
- **update (session 002):** reproduced. The `#83` error fires again on load. I *could* type, but my text landed in the entry's title/heading row and the body still reads **"0 words"** — the body editor isn't capturing normal writing. So journaling is still effectively broken: there's no working body to write the day into. evidence: `tests/dogfood/.sessions/002-build-the-business/07-journal.png`
- **triage (developer, 2026-06-02):** root cause = `#83` decodes to `@lexical/yjs`'s *"could not find decorator node"*. The seeder plants `mention` as an inline **`DecoratorNode`** (`packages/editor/src/seed-nodes.ts` `SeedMentionNode`), but the journal registered `mention` as a **`TextNode`** (`apps/journal/src/editor/passthrough-nodes.ts` `JournalMentionNode`) — a node-KIND mismatch, so the binding rolled back the whole body. The welcome journal entry's seeded body contains exactly such a mention (`welcome-content.ts:188`). Fix: converted `JournalMentionNode` to an inline `DecoratorNode` matching the seeder's kind (renders the label as plain inline text). Regression test: `passthrough-nodes.test.tsx` ("renders a seeded body containing an inline @-mention without throwing (#83)") — RED→GREEN. Verified in the real shell (session 003): no `#83`, body renders "…Take the product tour". 150 journal/seed tests green.

### F-004 — Tasks "Today" has no visible way to add a task
- **session:** 001-day-one   **kind:** gap   **app:** Tasks   **status:** ✅ done (2026-06-02)
- **what I was trying to do:** add this week's first deliverable.
- **what happened:** "Today" shows "Nothing scheduled for today / You're caught up" but there's no `+` or "New task" button anywhere on the view or in the header. I don't know how to add anything.
- **what I expected:** an obvious add-task affordance, especially in the empty state.
- **evidence:** `tests/dogfood/.sessions/001-day-one/06-tasks.png`
- **triage (developer, 2026-06-02):** confirmed — the only add path was `Cmd+N` (`ActionId.Compose`), undiscoverable for a new user. Fix: added a header "+" New-task button (`buildNewTaskButton` in `apps/tasks/src/app.ts`, `.tasks-header__action` CSS), placed as the first content action in the header-right group, calling the same `handleComposeIntent({})` the shortcut does — mirrors Notes' header new-note button. Verified in the real shell (session 005): button visible → click opens the focused "New task" composer → task created with the mouse alone. evidence: `tests/dogfood/.sessions/005-add-task-button-check/02-composer-open.png`

### F-005 — Database dropped me on "Folders" with no clear path to my own CRM
- **session:** 001-day-one   **kind:** design   **app:** Database   **status:** ✅ done (2026-06-04)
- **resolution (developer, 2026-06-04):** two halves. (1) **The "make my own collection" path** — this was the same gap as **F-008**, since resolved: the **"New collection → Blank collection"** entry (a custom collection you fill with your own objects + columns) is now discoverable, with `decideRowCreate` minting `brainstorm/Object/v1` rows and the View-settings "Add column…" working on an empty collection. So the CRM is buildable end-to-end. (2) **The "dropped me on Folders" landing** — the fresh-open fallback (`repairActiveSelection`) landed on the most-populous auto-derived *type-list* ("Folders"/"Notes"), never the user's own work. New `firstOwnCollectionSelection` makes the fallback **prefer the user's own collection** (a Manual/Blank collection, `source === null`) when one exists, before the system type-list — so a founder who built a Clients CRM opens onto it, not "Folders". A returning user with a resolvable saved selection still lands where they left off (the persisted-nav check wins first). apps typecheck + biome clean; 28 list/nav tests green; `firstOwnCollectionSelection` is app-internal nav logic (no app.ts unit harness, like `repairActiveSelection`) — real-shell verify deferred to the next fix-batch session.
- **what I was trying to do:** set up a client/lead CRM with my own fields.
- **what happened:** Database opened on a "Folders" list (auto-derived by type), the lists are all system-ish (Folders, Notes, Bookmarks, Events, Projects, Tasks…), one row is literally "Vault", and it's not obvious how I'd create *my own* collection with *my own* columns. There's a `+` by LISTS but no signpost that says "this is where a CRM goes".
- **what I expected:** an obvious "new collection / new database" with custom properties.
- **evidence:** `tests/dogfood/.sessions/001-day-one/05-database.png`
- **triage:** _(open — see F-008; the path I was looking for doesn't exist yet.)_

### F-006 — console error right after creating a new note (Y.Doc not found)
- **session:** 001-day-one   **kind:** bug   **app:** Notes   **status:** ✅ done (2026-06-02)
- **what I was trying to do:** create a new note (the F-001 flow).
- **what happened:** immediately after `+`, the console logged `[react-yjs] failed to load Y.Doc for entity n_mpwrddri_g4ft11 ... not found`. The note still worked, but this looks like a create→load race (the renderer tried to load the doc before the create committed).
- **what I expected:** no error on the create path.
- **evidence:** console: `[notes] error: [react-yjs] failed to load Y.Doc for entity n_mpwrddri_g4ft11 ... entities.loadDoc: ... not found`
- **triage (developer, 2026-06-02):** the renderer can mount the editor before the create commits, so `transport.load` gets a benign "not found" — distinct from a corrupt/failed hydrate, but it was logged as an error all the same (crying wolf). Fix: `resolver-accessor.ts` now treats a not-found `loadDoc` rejection as an empty replica (the first persist creates it) and only re-throws genuine failures to `onError`. Verified real-shell (session 008): no Y.Doc error on note create.

### F-007 — dashboard logged two missing-resource errors on load
- **session:** 001-day-one   **kind:** bug   **app:** shell/dashboard   **status:** ✅ done (2026-06-02)
- **what happened:** opening the dashboard logged two `net::ERR_FILE_NOT_FOUND`. Nothing visibly broke, but something bundled is being requested and isn't there.
- **evidence:** console: `[dashboard] error: Failed to load resource: net::ERR_FILE_NOT_FOUND` (×2)
- **triage (developer, 2026-06-02):** the captured URL (harness now logs failed-request URLs) was `…/out/renderer/stormy-sea.png` — the **default vault wallpaper never loaded**. It's seeded as a bare filename (`stormy-sea.png`); the `<img src>` (and the CSS path) resolved it against the renderer root instead of the `brainstorm://wallpaper/` vault protocol that serves `<vault>/dashboard/wallpapers/`. Fix: shared `resolveWallpaperImageSrc` routes any scheme-less value through the protocol (heals existing vaults), used by both `wallpaper-layer.tsx` `<img>` and `wallpaperBackground`; the seed now stores the canonical protocol URL. +3 wallpaper unit tests; real-shell verified (session 008): no failed asset requests, wallpaper loads.
