# LAN P2P sync — same-network collaboration with no relay

Design for the **Track C wedge**: *two devices on the same network collaborate live, with no server.* Planning doc — it fixes the transport contract, the discovery mechanism, and (most of all) the **security model** before code, because a LAN transport opens the shell's **first inbound listening socket** and that is a genuine new attack surface on the product's core E2EE plane.

**Thesis: this is an ADDITION, not a rebuild.** The collaboration stack (`main/sync/` + `main/collab/` + `main/pairing/`) is built and tested end-to-end against a *blind relay transport*. That transport already sits behind an abstraction — `RelayPort` / `RelaySurface`, selected by `ActiveRelayOrchestrator`. The relay is **already fully untrusted**: every frame is Ed25519-signed and DEK-sealed by the sender and re-verified by the recipient; the relay only fans opaque bytes to subscribers of a routing key. So "no server" = **run the same blind fan-out on the LAN instead of in the cloud**, plug it in behind `RelayPort`, and the entire sealed CRDT + awareness + pairing pipeline runs peer-to-peer unchanged.

Builds on:
- `10.3a`–`10.4` blind relay wire path — `relay-port.ts` (`RelayPort`/`RelaySurface`), `websocket-relay-port.ts` (client), `active-relay.ts` (transport selection), `@brainstorm-os/relay-server` (`FrameRouter` blind fan-out).
- `10.5a`–`10.5c` pairing — `main/pairing/pairing-handshake.ts` (QR + SAS), `pairing-service.ts`. The pairing payload **already carries a `relayUrl`** the target dials post-pair.
- `10.11` routing tokens — `routing-token.ts` (pseudonymous per-entity wire key, derived from the DEK).
- `10.12` `LiveSyncEngine` + envelope pipeline — the always-on seal/open loop; consumes a `RelaySurface`, blind to which transport backs it.
- `SYNC-4b` gated admission — `challenge-responder.ts` + `WebSocketRelayPort.onChallenge`: a node can **challenge** a connecting client to sign a nonce before admission. Today only hosted/metered nodes challenge; **§4 repurposes this as the LAN peer-authentication gate.**
- `74` presence transport (`docs/data/74-presence-transport.md`) — awareness rides the same DEK-sealed relay path; a LAN transport carries it for free.

---

## 1. The `relay-port` contract (what a new transport must satisfy)

Two interfaces in [`relay-port.ts`](../../packages/shell/src/main/sync/relay-port.ts). A transport implements **`RelayPort`**; the swap-stable **`RelaySurface`** is what consumers (`LiveSyncEngine`, pairing, presence, restore) actually bind to, and `ActiveRelayOrchestrator` implements it by delegating to the *current* port.

### 1.1 `RelayPort` — the transport a LAN implementation provides

```ts
interface RelayPort {
  send(frame: Uint8Array): void;                 // enqueue one opaque EncryptedFrame
  onFrame(cb: (frame: Uint8Array) => void): void; // inbound opaque frames
  offFrame(cb: (frame: Uint8Array) => void): void;
  requestAsset?(frame: Uint8Array): Promise<Uint8Array>; // OPTIONAL blob plane (CAS)
  close(): void;
}
```

Plus the **optional, duck-typed** methods `ActiveRelayOrchestrator` probes for with `typeof port.x === "function"` (a transport supplies what it can; absence degrades gracefully):

| Method | Meaning | LAN MVP stance |
|---|---|---|
| `subscribe(routingKey)` / `unsubscribe(routingKey)` | join/leave a routing channel | **required** — the host router needs it; on a 2-peer symmetric link it can be a no-op (everything fans to the one peer, exactly like `LoopbackRelayPort`) |
| `subscribeBatch(keys[])` | bulk subscribe (fresh-device bootstrap) | optional; loop `subscribe` if absent |
| `requestCatalog(account)` | ask a **durable node** for the account's entity list + versions | **omit** — a LAN peer is not a durable backfill node (see OQ-LAN-5) |
| `requestRotate(from,to,account?)` | re-home routing-token storage on a durable node | **omit** — no durable storage; rotation degrades to local-table-only (`active-relay.ts` already handles a transport without it) |
| `requestAsset(frame)` | blob-plane HAS/PUT/GET | optional; omit for MVP (attachments backfill via cloud relay or a later LAN CAS) |

**The hard contract a transport MUST honor** (learned from `LoopbackRelayPort` + `WebSocketRelayPort`):

1. **Opaque bytes only.** One `EncryptedFrame` per `send`; deliver it byte-identical to `onFrame`. A transport does **not** parse the routing header, does **not** import crypto. This is the **relay-blind invariant**, enforced by the CI fence `tools/mcp-server/src/tools/relay-noble-import-check.ts`, which matches `**/sync/**/*relay*.ts`. **Any file named `*relay*.ts` here (e.g. `lan-relay-port.ts`) inherits the fence** — zero `@noble/*`, `../credentials/*`, `node:crypto`, or envelope-seal imports, or the audit fails. Peer authentication crypto is injected as a callback (like `onChallenge`), never imported.
2. **No echo.** A sender never receives its own frame back (Loopback filters by port identity; the relay-server filters by connId). The recipient's own `LiveSyncEngine` would drop a self-frame anyway, but the transport must not deliver it.
3. **Defensive copy** each frame before fan-out so a listener mutating the buffer can't corrupt siblings or the sender's view.
4. **Listener throw isolation** — one listener throwing must not block fan-out to the others.
5. **Survive port swaps.** `ActiveRelayOrchestrator` migrates listeners + subscriptions to a replacement port *before* closing the old one; a transport's `close()` must be idempotent and must not fire listeners after close.
6. **`send` never throws for a transient offline state** — queue it (`WebSocketRelayPort` uses a 256-cap drop-oldest ring) or drop it silently; online-only consumers treat a missed frame as a missed frame. (`WebSocketRelayPort.send` throws only when the port is *disposed*.)

### 1.2 `RelaySurface` — what consumers see, and where the LAN transport plugs in

`ActiveRelayOrchestrator` ([`active-relay.ts`](../../packages/shell/src/main/sync/active-relay.ts)) is the single seam. On every `setActiveVaultSession` it reads `vault.json.syncRelay` and rebuilds the port:

```
onSessionChanged → readSyncRelayUrl(vaultPath)
   absent  → LoopbackRelayPort          (single-device / tests)
   present → makeRelayPort(url)          (production: new WebSocketRelayPort({url, onChallenge}))
```

`makeRelayPort` is injected once at boot ([`main/index.ts` ~1839](../../packages/shell/src/main/index.ts)). **This is the plug-in point.** A LAN transport lands here in one of two shapes:

- **Option A (recommended MVP) — reuse `WebSocketRelayPort` verbatim.** Point its URL at a LAN address. One peer hosts an embedded blind relay (`@brainstorm-os/relay-server`'s `createRelayCore`) bound to a LAN interface; every peer — *including the host, over `ws://127.0.0.1:port`* — connects with the existing, battle-tested `WebSocketRelayPort` (reconnect/backoff/queue/challenge all reused). **Zero new wire-path code.** New modules: a LAN relay *host*, discovery, and a resolver that yields the `ws://…` URL. `active-relay.ts` needs no change beyond an `ActiveRelayKind.Lan` label if we want the sync-status panel to distinguish it.
- **Option B (future, symmetric) — a new `LanRelayPort implements RelayPort`.** A direct peer socket, no host role; `subscribe`/`unsubscribe` become no-ops that fan to the one peer (the `LoopbackRelayPort`-over-a-socket model). Cleaner conceptually and truly serverless, but re-implements reconnect/queue that `WebSocketRelayPort` already has, and needs a dial/listen tie-break. Sketch in [Appendix A](#appendix-a--lanrelayport-skeleton-future-symmetric-transport).

**Recommendation: ship Option A for the MVP** (fastest path to a live demo, maximal reuse of tested code), and treat Option B as the durable evolution once >2 peers or host-independence matter. Both satisfy the exact same `RelayPort` contract, so the choice is invisible above `active-relay.ts`.

---

## 2. Wire protocol (unchanged — this is why reuse works)

The LAN link speaks the **existing** first-byte-tagged binary WebSocket protocol ([`websocket-relay-port.ts`](../../packages/shell/src/main/sync/websocket-relay-port.ts) + [`relay-server/src/server.ts`](../../packages/relay-server/src/server.ts)):

| Channel byte | Payload | Direction |
|---|---|---|
| `0x00` | JSON control (`subscribe`/`unsubscribe`/`rotate`/`catalog`/`auth`; server→client `rotated`/`catalog-result`/`challenge`/`auth-ok`) | both |
| `0x01` | opaque `EncryptedFrame` bytes | both |
| `0x02` | asset (CAS) request/response | both (omit on LAN MVP) |
| `0x03` | bundled backfill | server→client (omit on LAN MVP) |

A frame's routing metadata is the **routing header** (`routing-header.ts`): `{v, kind, entityId, sender, seq, nonce, ts, route?}`. The relay fans by `route ?? entityId` (a routing token in 10.11 mode) and **peeks nothing else**. This is what makes the transport swappable — the LAN host router is the same `FrameRouter` that already backs the cloud relay, and the LAN client is the same `WebSocketRelayPort`.

---

## 3. Local peer discovery

The problem: a freshly-booted shell must find the paired peer's `ws://<ip>:<port>` on the current LAN, where IPs are DHCP-volatile.

### 3.1 Options weighed

| Mechanism | UX | Metadata exposure | Electron/dep cost | Verdict |
|---|---|---|---|---|
| **Pairing-payload address** (reuse `relayUrl`) | zero-config *at pair time* | none beyond pairing | **none** — field exists | ✅ **bootstrap** — good for first contact, stale after an IP change |
| **mDNS / Bonjour** (`_brainstorm._tcp`) | zero-config re-discovery | broadcasts service presence + TXT to the whole LAN | JS-only `bonjour-service` (no native build); runs in main | ✅ **recommended re-discovery**, with a *minimal non-linking TXT* |
| **UDP multicast beacon** (custom) | zero-config | broadcasts, but we control the payload (can be an encrypted/rotating beacon) | hand-rolled, more code | ⚠️ fallback if mDNS is blocked; better metadata control |
| **Manual IP / QR** | worst (type an address) | none | none | ✅ **always-available fallback** (hostile/locked-down LANs, mDNS-blocked corp nets) |

### 3.2 Recommendation

**Pairing-payload address for bootstrap + mDNS/Bonjour for ongoing re-discovery + manual entry as the escape hatch.** Concretely:

1. **At pairing time**, the source device puts its LAN listener address in the existing `relayUrl` slot (`ws://<lan-ip>:<port>`), so the just-paired device already knows how to reach it for the first session — *no discovery code on the critical path for the MVP demo*.
2. **On later sessions**, advertise/browse `_brainstorm-sync._tcp` over mDNS. **The TXT record carries only a per-session ephemeral service-instance id — never the device Ed25519 pubkey, vault id, or user handle in cleartext** (those would let any LAN sniffer link your devices across networks). Identity is proven *after* connect via the §4 admission challenge, not asserted in the beacon.
3. **Manual `host:port` entry** in Settings → Sync for LANs where multicast is blocked or the user wants no broadcast at all.

**Electron/security constraints to flag:** discovery + the listener run in the **main process** (Node), not a sandboxed renderer. Opening a listening socket and a multicast responder both trigger **OS firewall prompts** (macOS incoming-connection prompt via the signed app; Windows Defender) — a first-run UX cost, and the app must be signed/notarized (already true for releases) to avoid a scary dialog. Corporate networks frequently **block multicast** (client isolation / AP isolation) — hence manual entry is not optional. mDNS on macOS is native (`dns-sd`) but we prefer the JS `bonjour-service` to avoid a native build in the packaging matrix.

---

## 4. Security model — the reason we spike before coding

### 4.1 What carries over unchanged (the good news)

The relay has **never** been trusted. Re-stating the invariants the LAN transport inherits verbatim:

- **Every frame is Ed25519-signed** over `canonicalHeaderBytes || ciphertext`, verified by the recipient against the `sender` pubkey in the header (`envelope-seal.ts`). A malicious transport (or a hostile LAN peer) that forges or tampers a frame fails verification **before any AEAD work** — the recipient is the last line of defense, and it holds.
- **Every payload is DEK-sealed** (XChaCha20-Poly1305, per-entity DEK, random nonce). The transport sees ciphertext only. A LAN eavesdropper learns nothing about content.
- **The recipient re-derives everything** — routed id must match the resolved row (`EntityIdMismatch`), header is re-canonicalized as AAD, writer-role is checked (`authorizeWriter`, F-288), revoked devices are dropped pre-crypto (`isDeviceRevoked`). None of this depends on the transport being honest.
- **Membership is cryptographic.** DEKs reach a device only via HPKE member-wraps sealed to its X25519 key (`10.2`); pairing (§QR/SAS) transfers the user identity under a `pairingSecret` with a human-verified SAS. A LAN attacker who never paired holds no DEK and no roster membership — it can inject nothing that opens and read nothing sealed.

**So the LAN transport cannot weaken confidentiality or integrity of doc content.** What it *can* do is open new surface around *reachability, metadata, and availability.*

### 4.2 New attack surface a LAN listener opens (threat sketch)

| # | Threat | Impact | Mitigation |
|---|---|---|---|
| **T1** | **First inbound listening socket.** Today the shell only *dials out*. A LAN host binds a port — every host on the LAN (café wifi, hostile roommate, corp VLAN) can now connect. | Reachability: an attacker can open a socket to our process. | **Admission challenge (T2 mitigation) is mandatory on LAN.** Bind to the specific LAN interface, not `0.0.0.0`, where feasible. Random high port. Connection-rate limit + max-connections cap on the host. |
| **T2** | **Unauthenticated subscriber observes traffic graphs.** Even blind, a connected peer can `subscribe` to routing tokens and watch which tokens carry frames, when, and how big — a **traffic-analysis** side channel. On the *cloud* relay only the operator saw this; on LAN **any peer** could. | Metadata leak: co-editing timing/volume per pseudonymous entity. Routing tokens (10.11) pseudonymize the id but not the timing/size. | **Gate LAN admission with the SYNC-4b challenge — repurposed as peer auth.** The LAN host **always challenges** (inverting the cloud rule "an open node never challenges"). A connecting device must sign the nonce with its **device identity key**; the host verifies the signature against the vault's **signed device roster** (`meta.devices` add-device records — a paired device already has it) before allowing any `subscribe`/frame. A non-member's socket is closed at the handshake. This uses the *existing* `challenge-responder.ts` signer path — no new crypto, just a roster-membership verifier on the host side (which, being auth logic, lives *outside* the relay-blind fence, injected as a callback). |
| **T3** | **No transport TLS.** `ws://` on the LAN is plaintext transport (frames inside are E2EE). A LAN MITM (ARP spoofing) can intercept the socket. | Sees ciphertext only (no content leak); can **drop/reorder/replay** frames. | CRDT apply is idempotent + order-independent; `SeqTracker` bounds replay; reconnect heals drops → **DoS-only, not a content break.** Optionally wrap in TLS with a pairing-derived PSK later (OQ-LAN-3); the admission challenge already authenticates the peer, so PSK-TLS is defense-in-depth against passive metadata capture, not a correctness requirement. |
| **T4** | **Rogue service advertisement.** An attacker advertises a fake `_brainstorm-sync._tcp` instance. | A victim dials the attacker instead of the peer. | The victim's frames are sig-verified + DEK-sealed → the rogue host learns nothing and can inject nothing accepted. Worst case: the victim leaks its *subscribe* traffic (routing tokens) to the rogue — **closed by T2's admission challenge running in BOTH directions** (client also verifies the host proves roster membership before subscribing). Mutual challenge. |
| **T5** | **Same-host local processes.** Binding a LAN port also exposes it to other local users/processes on the machine. | A co-resident process can connect. | T2 admission gate applies identically (must prove roster membership). Prefer binding to the LAN iface, not exposing more than needed; the host's own client uses `127.0.0.1` (unavoidable, same-user). |
| **T6** | **Discovery metadata linkage.** mDNS TXT / beacon payload could leak device pubkey / vault id → a passive LAN sniffer links your devices across networks over time. | Long-term deanonymization of device fleet. | **Minimal non-linking beacon** (§3.2): ephemeral per-session instance id only; identity proven post-connect. Rotate the advertised instance name per session. |
| **T7** | **DoS via connection/frame flood.** An admitted-or-not peer floods connections or malformed frames. | Availability. | Host: connection-rate + max-conn caps, malformed-frame drop-and-count (the `FrameRouter` already drops malformed frames without closing the conn). Per-peer send backpressure mirrors the broker's fixed-depth queue. Admission challenge means an *unadmitted* flooder never reaches the router. |
| **T8** | **Firewall-prompt fatigue / accidental exposure.** User clicks "allow" on a broad firewall rule; port stays open beyond the session. | Persistent exposure. | Open the listener **only while a LAN-shared entity is actually open** (tie the host lifecycle to `LiveSyncEngine` tracking a shared+LAN-admitted entity); close it when the last shared window closes. Never listen at idle. |

### 4.3 The load-bearing security decision

**LAN admission is authenticated by a mandatory, mutual, pairing-rooted challenge — the SYNC-4b machinery inverted.** Cloud rule: *open node never challenges.* LAN rule: *node always challenges, and the client verifies the host back.* Proof of admission = an Ed25519 signature over the host's nonce, checked against the **signed device roster** both peers already hold from pairing. This converts "any LAN host can connect and watch traffic graphs" (T2/T4/T5) into "only a device already in this vault's roster can subscribe" — with **no new key material and no new crypto primitive**, only a roster-membership verifier callback on the host (injected outside the relay-blind fence).

Everything else (content confidentiality/integrity) is already guaranteed by the unchanged sealed-envelope pipeline. This gate is the single most important new component and must get a dedicated `/security-review` + `/pentester` pass on the `connect → challenge → verify-roster → admit → subscribe → route` path before it ships (per CLAUDE.md continuous-audit rule; mirrors the ROT-4 / presence-transport gate).

---

## 5. Open questions (OQ-LAN-*)

Numbered in the Track-C LAN namespace; resolve (take a position, document here + in `11-open-questions.md`) before the corresponding rung lands.

- **OQ-LAN-1 — Transport shape: Option A (embedded blind relay + reuse `WebSocketRelayPort`) vs Option B (symmetric `LanRelayPort`)?** *Leaning A for MVP* (max reuse), B as evolution. Blocks LAN-2. **Position taken: Option A** — LAN-1 (`lan-relay-host.ts`) embeds the blind `FrameRouter` host and the unchanged `WebSocketRelayPort` connects to it; proven green this pass.
- **OQ-LAN-2 — Host election on a 2-peer LAN. ✅ LOCKED (2026-07-23): deterministic election by device id — the LOWER device id hosts the embedded relay; the peer connects as guest.** Symmetric + negotiation-free (both peers compute the same split), so exactly one binds the listener with no round-trip. Rejected: mDNS-advertiser-hosts (non-deterministic, flaps on who-advertised-last) and first-opener-hosts (races). Implemented as `electLanRole(self, peer)` in `lan-admission.ts`. Listener lifecycle still ties to an open shared entity (T8).
- **OQ-LAN-3 — Is transport TLS (pairing-derived PSK) required for v1, or is the admission challenge + E2EE sufficient?** *Leaning: challenge + E2EE sufficient for v1; PSK-TLS is defense-in-depth for T3/T6 metadata, deferred.* Non-blocking for MVP. **Revisited by the mandatory security review before the real listener ships.**
- **OQ-LAN-4 — Discovery dependency: `bonjour-service` (JS) vs native `dns-sd` vs custom UDP beacon?** Weigh packaging-matrix cost (any `bun.lock` runtime change needs an electron-builder `--dir` dry-run per the dep-changes rule) vs metadata control. *Leaning `bonjour-service` + manual fallback.* Blocks LAN-4.
- **OQ-LAN-5 — Backfill of offline edits. ✅ LOCKED (2026-07-23): live + backfill is IN SCOPE for the MVP (not live-only).** A peer that was off-LAN while the other edited MUST catch up on reconnect. In a 2-peer LAN the peers ARE the store (each holds the full CRDT doc), so backfill is a full-state (or state-vector-diff) `Snapshot` exchange on reconnect — no separate durable node needed *when the editing peer is present*. This is heavier than live-only: it adds a resync **trigger** (LAN-7), a diff **efficiency** rung (LAN-8), and a host-side **durable tail** for the both-peers-absent gap (LAN-9). Proven end-to-end (localhost, no cloud relay) in LAN-6 this pass. The remaining open sub-question is only *how far* LAN-9 goes (does the host persist a sealed tail so a peer backfills even when the OTHER editing peer is absent, or is present-peer reconciliation enough for v1?) — *leaning present-peer for v1, host-tail as a fast-follow*.
- **OQ-LAN-6 — Coexistence with the cloud relay.** Can a device be on LAN *and* cloud simultaneously (dual transport, dedup by CRDT idempotency), or is it one-or-the-other per `vault.json.syncRelay`? `ActiveRelayOrchestrator` currently holds ONE `#current` port. Dual-transport needs a fan-out orchestrator change. *Leaning: MVP is one-transport (LAN when discovered, else cloud); dual is a follow-on.* Blocks any multi-transport rung.
- **OQ-LAN-7 — Roster availability for the admission verifier.** The host verifies a connecting device against the signed device roster. Confirm both peers hold the current roster offline (they do post-pairing via `meta.devices`), and define behavior when the roster is stale (a device added on another network). Blocks the §4.3 gate.
- **OQ-LAN-8 — mDNS TXT contents & instance-name rotation cadence** (T6). What is the exact minimal non-linking payload, and how often does the instance id rotate? Leaf-local.

---

## 6. MVP slice — live + backfill (OQ-LAN-5 locked)

**Goal:** two devices, same LAN, already paired, one shared doc syncing live edits + presence, **and a peer that was off-LAN catches up on reconnect**, with **no cloud relay reachable**. Prove the wedge.

**Chosen shape:** Option A (embedded blind relay on the elected host + existing `WebSocketRelayPort` clients), device-id host election (OQ-LAN-2), pairing-payload address for bootstrap (mDNS is a follow-on), admission challenge as the auth gate, and full-state resync for backfill.

**Rung-count honesty:** locking **live + backfill** (not live-only) grows the slice from **6 → ~8–9 rungs**. The live-only path was LAN-1…LAN-6; backfill adds **LAN-7 (resync trigger)**, **LAN-8 (state-vector diff efficiency)**, and **LAN-9 (host-side durable tail)** — the "durable-node / history-reconciliation" work previously deferred. LAN-8/LAN-9 are the heavier, genuinely-new rungs the backfill decision buys.

### File-by-file work list

| Rung | Status | File(s) | Change |
|---|---|---|---|
| **LAN-1** *(host)* | ✅ **landed (localhost proof)** | `main/sync/lan-relay-host.ts` **(new)** | `LanRelayHost` wraps `@brainstorm-os/relay-server`'s `createRelayCore` (blind `FrameRouter` fan-out, reused verbatim) and adds the per-connection admission gate. **Relay-blind — CI fence verified (0 violations).** Exposes only an **in-process** `webSocketCtor()` (localhost proof); the real external-socket bind (Bun `serve` / `ws`) is **withheld behind the security review** (see below). |
| **LAN-2** *(admission gate)* | ✅ **landed (localhost proof)** | `main/sync/lan-admission.ts` **(new)** | §4.3 challenge: host sends `challenge{nonce}` (existing control op); client answers via `onChallenge` (`makeLanChallengeResponder`, signs the nonce with the device key); host verifies the signature against the signed device roster (`makeLanAdmissionVerifier` → roster membership + Ed25519 verify) and admits (`auth-ok`) or closes. Auth crypto lives **outside** the relay-blind fence, injected into LAN-1 as the `admit(account, sig, nonce)` callback. Also holds `electLanRole` (OQ-LAN-2 lock). **NOT shippable until the security review clears it.** |
| **LAN-6** *(tests)* | ✅ **landed green** | `main/sync/lan-relay-host.test.ts`, `main/sync/lan-p2p-sync.test.ts` **(new)** | `lan-relay-host.test.ts` (6): election; open-host fan-out (cloud parity); admit a valid roster member; reject non-roster; reject forged signature. `lan-p2p-sync.test.ts` (1): two `LiveSyncEngine`s over the localhost `LanRelayHost` prove **live co-edit converge** AND **backfill** — B disconnects, A edits, B reconnects (re-auth + swap-survive re-subscribe), a full-state resync reconciles B's doc — **no cloud relay**. Reuses the existing envelope suites unchanged (transport is opaque to them). |
| **LAN-3** *(discovery bootstrap)* | ⬜ next | `main/pairing/pairing-handshake.ts` + `pairing-service.ts` (touch) | Put the host's `ws://<lan-ip>:<port>` in the existing `relayUrl` slot when LAN mode is chosen at pair time. No new module. |
| **LAN-4** *(transport selection + election)* | ⬜ next — **needs security review first** | `main/sync/active-relay.ts` + `main/index.ts` (touch) | Add `ActiveRelayKind.Lan`. Run `electLanRole`; the host peer starts `LanRelayHost` bound to a **real** LAN interface (⚠️ gated on the security review) and connects its own `WebSocketRelayPort` at `ws://127.0.0.1:port`; the guest connects at `ws://<peer-ip>:port`. Tie host lifecycle to an open shared entity (T8). |
| **LAN-5** *(status UX)* | ⬜ next | `main/sync/sync-status-store.ts` + dashboard sync-status panel (touch) | Surface "Syncing on local network (no server)" vs "Syncing via relay" — the wedge made visible. |
| **LAN-7** *(backfill trigger)* | ⬜ NEW (backfill) | `main/sync/lan-relay-host.ts` (extend) + `websocket-relay-port.ts` (small additive) + live-sync wiring | Automate the resync LAN-6 drives by hand: the blind host notifies existing subscribers of a channel when a NEW subscriber joins (routing metadata only — a `resync{key}` control, stays blind); the client surfaces it as an event; the wiring calls the engine's snapshot emit for that entity. Turns reconnect-backfill from test-driven into automatic. |
| **LAN-8** *(backfill efficiency)* | ⬜ NEW (backfill) | `main/sync/` (new) + live-sync-engine (small) | Replace the full-state snapshot with a **Yjs state-vector diff**: on join, exchange state vectors and send only the missing update (`Y.encodeStateAsUpdate(doc, remoteSV)`), bounding backfill cost for large docs. Full-state (LAN-6) is the correct-but-heavy baseline this optimizes. |
| **LAN-9** *(host-side durable tail)* | ⬜ NEW (backfill) — **needs security review** | `main/sync/` (new) | The both-peers-absent gap: the elected host persists a sealed (opaque) per-entity tail so a returning peer backfills even when the OTHER editing peer is offline. Blind storage (ciphertext only). Scope is OQ-LAN-5's remaining sub-question — may stay a fast-follow if present-peer reconciliation suffices for v1. |

**What is still deliberately NOT in the MVP:** mDNS auto-discovery (LAN-3 uses the pairing address; mDNS is a fast-follow), the blob/asset plane (`0x02`), bundled backfill (`0x03`), dual LAN+cloud transport (OQ-LAN-6), and TLS/PSK on the transport (OQ-LAN-3, pending the security review). Each is a named follow-on, not a gap.

### ⚠️ Security gate (blocking) — the real listener is NOT shippable from the build pass

LAN-1/LAN-2/LAN-6 landed as the **localhost / in-process proof only**. Opening a **network-reachable** listening socket (LAN-4's real bind + LAN-9's durable tail) is the shell's first inbound socket and **MUST pass a dedicated `/security-review` + `/pentester`** over the `connect → challenge → verify-roster → admit → subscribe → route` path (per CLAUDE.md continuous-audit; mirrors the ROT-4 / presence-transport gate) **before any bind to a real external interface**. `lan-relay-host.ts` deliberately implements no external-socket `listen()`; the in-process `webSocketCtor()` is all that exists until the review clears.

**Pre-handoff gate (for the shippable rungs):** `bun run verify` (typecheck + build + in-process pipeline) + the full `bun run test` (LAN sockets touch the reconnect/queue paths the ubuntu CI exercises), plus — because LAN-4 may add a `ws`/discovery runtime dep — an electron-builder `--dir` dry-run per the dep-changes rule, and the security review above.

---

## Appendix A — `LanRelayPort` skeleton (future symmetric transport)

Not built here (the doc is the deliverable). Sketched to make the Option-B contract concrete: a single peer socket, `subscribe`/`unsubscribe` as fan-to-the-one-peer no-ops, dial/listen decided by a pubkey tie-break, admission crypto injected (never imported — the file is named `*relay*` and lives under `sync/`, so it inherits the relay-blind fence).

```ts
// packages/shell/src/main/sync/lan-relay-port.ts  — RELAY-BLIND (no crypto imports)
import type { RelayPort } from "./relay-port";

export type LanRelayPortOptions = {
  peerAddress: string;                 // ws://<ip>:<port> resolved by discovery
  selfPubB64: string;                  // for the dial/listen tie-break (OQ-LAN-2)
  peerPubB64: string;
  wsImpl?: unknown;                    // injected socket ctor (test seam)
  // Admission is injected as opaque callbacks so this file imports NO crypto:
  answerChallenge?: (nonce: string) => Promise<{ account: string; sig: string } | null>;
  verifyPeer?: (account: string, sig: string, nonce: string) => boolean; // roster check
};

export class LanRelayPort implements RelayPort {
  readonly #listeners = new Set<(f: Uint8Array) => void>();
  // #socket, #state, #sendQueue (drop-oldest ring, cap 256), #reconnect schedule
  // — same lifecycle model as WebSocketRelayPort, minus the durable-node verbs.

  send(_frame: Uint8Array): void {
    // TODO: 0x01-wrap and write to the single peer socket; queue if not Open.
  }
  onFrame(cb: (f: Uint8Array) => void): void { this.#listeners.add(cb); }
  offFrame(cb: (f: Uint8Array) => void): void { this.#listeners.delete(cb); }

  // 2-peer fan-out ⇒ subscribe/unsubscribe are no-ops (everything goes to the peer),
  // matching LoopbackRelayPort semantics. Present so active-relay's duck-typing finds them.
  subscribe(_key: string): void {/* no-op: single peer */}
  unsubscribe(_key: string): void {/* no-op: single peer */}

  close(): void {
    // TODO: idempotent teardown; clear listeners; close socket; stop reconnect.
  }

  // TODO connect(): dial if selfPubB64 < peerPubB64 else listen (tie-break, OQ-LAN-2);
  //   on accept/open run the MUTUAL admission challenge via the injected callbacks
  //   BEFORE delivering any 0x01 frame to #listeners (T2/T4/T5);
  //   on inbound 0x01: defensive-copy → fan to #listeners with per-listener try/catch;
  //   NO requestCatalog/requestRotate/requestAsset (no durable node on LAN).
}
```

---

## Cross-references

- Transport contract: [`relay-port.ts`](../../packages/shell/src/main/sync/relay-port.ts), [`active-relay.ts`](../../packages/shell/src/main/sync/active-relay.ts), [`websocket-relay-port.ts`](../../packages/shell/src/main/sync/websocket-relay-port.ts)
- Blind fan-out reused by the LAN host: [`relay-server/src/router.ts`](../../packages/relay-server/src/router.ts), [`server.ts`](../../packages/relay-server/src/server.ts)
- Sealed pipeline (unchanged): [`envelope-seal.ts`](../../packages/shell/src/main/sync/envelope-seal.ts), [`routing-header.ts`](../../packages/shell/src/main/sync/routing-header.ts), [`live-sync-engine.ts`](../../packages/shell/src/main/sync/live-sync-engine.ts)
- Peer auth reused for admission: [`challenge-responder.ts`](../../packages/shell/src/main/sync/challenge-responder.ts)
- Pairing bootstrap: [`pairing-handshake.ts`](../../packages/shell/src/main/pairing/pairing-handshake.ts)
- Related transports: [`74-presence-transport.md`](74-presence-transport.md), [`20-database-growth-and-sync.md`](20-database-growth-and-sync.md), [`16-identity-orgs-encryption.md`](../security/16-identity-orgs-encryption.md)
</content>
