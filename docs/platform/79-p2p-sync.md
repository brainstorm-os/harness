# Peer-to-peer sync: the `P2P-0` spike report

**What a user gets:** two of your own machines keep the same vault in step by talking directly to each other. No account, no server in the middle, and on a local network no third party sees even the timing or the size of what you edit. If the other machine is asleep or on a different network, the blind relay quietly picks the work up, and nothing about that fallback is visible except a line in the sync panel telling you which path is live.

This is the report from the `P2P-0` spike: the load-bearing decisions for the peer-to-peer track, each with its options, a recommendation, the cost, and what would change the recommendation. It is the `10.0` analogue for the peer transport. It produces no product code.

**Status: `P2P-1` is startable.** Nothing gates it. `LAN-2b(d)` is open but is **not** a prerequisite, for a reason given in full in [§10](#10-verdict-is-p2p-1-startable). Two engineering gaps that the prototype measured, not assumed, must land *inside* `P2P-1` rather than after it.

**The single most useful thing this spike found:** most of `P2P-1` is already built. The `LAN-*` ladder shipped the hard half (the transport, the listener, the channel-bound admission handshake, the backfill path) while `P2P-0` was still unstarted. What remains is genuinely small, and three quarters of it is discovery. The second most useful thing: the prototype found a specific new privacy leak that only appears once discovery exists, and two liveness gaps that only appear once a peer can sleep. All three are named below with the numbers behind them.

Read alongside:
- [data/lan-p2p-sync.md](../data/lan-p2p-sync.md): the shipped LAN slice's design. This doc does not repeat it; it extends it and corrects two points.
- [data/lan-channel-binding.md](../data/lan-channel-binding.md): the admission handshake, shipped.
- [data/lan-admission-principal.md](../data/lan-admission-principal.md): why the per-device key is the principal.
- [data/20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md): the sync model the transport carries.
- [security/16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md): the trust model none of this changes.
- [_review/2026-07-26-lan-p2p-security-gate.md](../_review/2026-07-26-lan-p2p-security-gate.md): the gate that shaped the shipped handshake.

---

## 1. The honest starting position: what is already built

Every claim here was read out of the shipped shell, not inferred from the plan. Paths are relative to `packages/shell/src/main/`.

**The transport seam is real and narrow.** `RelayPort` (`sync/relay-port.ts`) is four methods and one optional: `send`, `onFrame`, `offFrame`, `close`, `requestAsset?`. Two classes implement it: `LoopbackRelayPort` and `WebSocketRelayPort`. A third transport would be a small file. One caveat worth knowing before anyone plans against it: the richer verbs (`subscribe`, `unsubscribe`, `subscribeBatch`, `requestCatalog`, `requestRotate`) are **not** on the interface. `ActiveRelayOrchestrator` reaches them by structural duck-typing (`sync/active-relay.ts`, the `maybeSubscribe` / `maybeUnsubscribe` helpers and the `port as RelayPort & { … }` casts). Any new transport has to match undeclared signatures exactly, with no compiler help.

**The LAN transport is not a new transport.** `ActiveRelayKind.Lan` and `ActiveRelayKind.WebSocket` are both backed by the same `WebSocketRelayPort` class. Only the address and the injected handshake differ (`main/index.ts`, the `makeRelayPort` branch). This is the shipped answer to the transport question and [§4](#4-transport) does not reopen it.

**The listener exists and is hardened.** `sync/lan-relay-listener.ts` binds a real inbound socket over `node:http` + `ws`, with an address allowlist (`isBindableAddress`: private IPv4 literal or loopback, never a wildcard), per-source connection accounting, a rate window, `Origin` rejection before the 101, an auth deadline, an 8 MiB message cap and bounded teardown. It passed a `/pentester` pass that failed first with three blocking findings and then passed on re-run; both runs are in [`_review/evaluations.jsonl`](../_review/evaluations.jsonl).

**Admission is channel-bound and mutual.** `sync/lan-admission.ts` + `sync/lan-relay-host.ts` implement the handshake from [lan-channel-binding.md](../data/lan-channel-binding.md): client sends `hello{deviceAccount}`, the host seals a 32-byte nonce to that device's roster X25519 key with HPKE base mode (`info = "brainstorm/lan-admission/v1"`, AAD binding both account names), the client opens it and signs a direction-tagged transcript, the host verifies against the roster Ed25519 key and answers with its own direction-tagged proof, which the client verifies before it sends anything at all. There is no plaintext-nonce fallback on the LAN path: an unknown, revoked or X25519-less device makes `sealFor` return `null` and the host closes.

**Revocation is enforced on the LAN path, in both directions.** `sync/lan-sync-wiring.ts` rebuilds the roster directory from `DevicesStore.listActive()` on every access, so a revoked device is absent from the admission map by construction and a revoke lands on the very next connection with no restart. The client's directory is built the same way, so a revoked *host* is rejected too. This matters for the `LAN-2b(d)` verdict in [§10](#10-verdict-is-p2p-1-startable).

**Hosting is default-off.** `sync/lan-host-policy.ts` defines `LanHostMode` with `DEFAULT_LAN_HOST_MODE = Off`, persisted per device in `lan-host-prefs.json`. `sync/lan-host-factory.ts` returns `null` rather than ever constructing a host without a handshake.

**Three gaps in the shipped code that the plan does not show.** Reading the code rather than the rung text turned these up, and `P2P-1` inherits all three:

1. **`LAN-3` is half done.** The listener produces exactly the URL the pairing payload wants (`LanListenerAddress.url`, commented as such), and `pairing-payload.ts` validates and accepts it behind the scheme allowlist that `LAN-3` shipped. But nothing connects the two. `pairing-service.ts` takes its `relayUrl` from `session.getRelayUrl()`, which reads `vault.json.syncRelay.url`. `LanHostController.onUrlChanged` has exactly one production consumer, and it is a `console.info`. The *accepting* half of `LAN-3` shipped; the *producing* half did not.
2. **Nothing writes `syncRelay.lan = true`.** The flag added in #350 is the sole selector of the LAN trust model, and `setSyncRelayConfig` has one non-test caller (`ipc/soak-handlers.ts`) which never sets it. The LAN dial flow does not exist. This is `P2P-1`'s core work item, not an afterthought.
3. **`isDeviceRevoked` is still unwired on the relay path.** The predicate on `PipelineContext` (`sync/envelope-pipeline.ts`) is optional and has zero non-test producers, so revocation is enforced at LAN admission and nowhere else. This is a pre-existing relay-path gap that `P2P-1` neither creates nor closes, and it is the live half of `LAN-2b(d)`.

---

## 2. The prototype and what it measured

Throwaway, kept out of the product, at [`scratch/p2p-0-prototype/`](../../scratch/p2p-0-prototype/) in this branch. Five small Node scripts: a host that advertises `_brainstorm-sync._tcp` over mDNS and binds a WebSocket listener on the real LAN interface, a peer that browses, dials and runs an admission-shaped handshake, a LAN survey, a staleness harness and a frozen-peer harness.

The riskiest unknowns were discovery reachability and what happens when a peer sleeps, so those are what it measured. Environment: macOS 26.0.1, Node 26.3.0, one machine on a home LAN (`192.168.2.0/24`, gateway `.1`, host `.50`), one other physical device present (`.40`).

### 2.1 Discovery works, and it is genuinely on the wire

`bonjour-service` 1.4.4 (MIT, pure JS, 5 runtime packages, no native build) advertised `brainstorm-<8-byte-hex>._brainstorm-sync._tcp` with a minimal TXT (`{v:"1", sid:<ephemeral>}`). The **native macOS `mDNSResponder`** saw it:

```
dns-sd -B _brainstorm-sync._tcp local
 0:09:36.108  Add        2  11 local.  _brainstorm-sync._tcp.  brainstorm-02b290944d2ce837
```

Interface index 11 is `en0`, the real LAN adapter, not loopback. A pure-JS advertiser therefore interoperates with the platform responder rather than living in its own world.

**Cross-machine multicast on this LAN is fine.** A 10 s survey browsing common service types found 4 instances across 2 distinct IPv4 hosts, and the first *remote* instance (a device at `192.168.2.40`, a different physical machine) resolved to an address in **228 ms**. That is the honest cross-machine number.

### 2.2 Discovery to admitted is fast enough to be invisible

Three consecutive runs, two processes, real LAN interface (not loopback):

| | run 1 | run 2 | run 3 |
|---|---|---|---|
| mDNS browse to service resolved | 9 ms | 6 ms | 6 ms |
| TCP + WebSocket open | 5 ms | 3 ms | 3 ms |
| Admission handshake round trip | 7 ms | 3 ms | 3 ms |
| **Discovery to admitted, end to end** | **22 ms** | **13 ms** | **13 ms** |

Handshake crypto, measured separately: host seal 1988 µs cold then 271 / 318 µs warm; client open + sign 1410 / 954 / 930 µs; host verify 1014 µs cold then 168 / 143 µs warm. Sub-millisecond once warm. The admission handshake is not a cost centre and no one needs to optimise it.

*Caveat, stated plainly:* the 6 to 9 ms discovery figure is two processes on one machine, so both talk to the same responder. It is a lower bound. The cross-machine number to design against is the 228 ms from the survey.

### 2.3 mDNS does not tell you when a peer goes away

The host was `SIGKILL`ed with a browser left running, so no goodbye packet went out. That is what a lid closing looks like.

```
{"phase":"goes-away-detection","reportedDown":false,"msAfterKill":null}
```

**No `down` event in 20 seconds.** The record simply stays. When the host restarted on a new ephemeral port it was rediscovered in **970 ms**, but under a *new* instance name, so the browser then held one live record and one stale one with no way to tell them apart.

Consequence: **discovery is a source of address hints, never a source of liveness.** Anything that treats an mDNS record as "the peer is up" will be wrong, and will be wrong in the direction of hanging.

### 2.4 Dialing a sleeping peer costs 75 seconds

The number that most directly shapes the design. A TCP connect to a silent LAN address, which is exactly what a sleeping or powered-down machine looks like since it sends no RST:

| target | outcome | time |
|---|---|---|
| silent LAN address, OS default | `ETIMEDOUT` | **75,010 ms** |
| silent LAN address, 3 s application deadline | deadline fired | 3,003 ms |
| live host, closed port (control) | `ECONNREFUSED` | 1 ms |

Without an explicit connect deadline, one attempt to reach a sleeping peer stalls the transport for **seventy-five seconds**. `WebSocketRelayPort` has no connect deadline today. `awaitOpen(timeoutMs = 5000)` is an observer that resolves or rejects for the caller; it does not abort the socket or advance the backoff.

### 2.5 An established socket does not notice a peer that sleeps

The host was `SIGSTOP`ed: socket open, no RST, no answers, which is the mid-session sleep case.

```
{"phase":"detection","heartbeatNoticedMs":5047,"transportNoticedMs":null}
{"phase":"after-wake","usable":true,"totalFrozenMs":5050}
```

**The transport never noticed.** An application heartbeat with a 5 s answer deadline noticed in 5,047 ms. This matches the code: there is no ping, pong, keepalive or idle timeout anywhere in `websocket-relay-port.ts`, `lan-relay-host.ts` or `lan-relay-listener.ts`. Liveness detection is entirely `onclose` / `onerror` from the socket, and a sleeping peer produces neither. The only heartbeat in the sync tree is the ~15 s awareness one in `awareness-broadcaster.ts`, which is a protocol heartbeat on top of the transport and does not fail the transport when it goes unanswered.

The second line matters as much as the first: after `SIGCONT` the socket was **still usable**. So "heartbeat missed, tear the socket down" is the wrong reflex; it would destroy a connection that was about to recover.

*Caveat, stated plainly:* `SIGSTOP` freezes the process, not the network interface. A real machine sleep also drops the Wi-Fi association and the gateway's ARP and NAT state, so a real wake is more likely to find the socket dead than this test suggests. The "still usable" result is optimistic; the "never noticed" result is not, and it is the one that drives the design.

### 2.6 What the prototype did not test

Windows and Linux (nothing was run on either). Two Brainstorm shells on two machines (the cross-machine evidence is the mDNS survey against a third-party device plus the `dns-sd` check, not a second shell). A real suspend and resume. Networks with client isolation, a corporate VLAN, or a guest network with multicast filtering. The prototype substituted `node:crypto` X25519 + HKDF + ChaCha20-Poly1305 for the shipped RFC 9180 `hpkeSealBase`; the shape and the dominant cost (one X25519 agreement) are the same, but the microsecond figures are indicative, not a benchmark of the shipped primitive.

---

## 3. Discovery

**Options.** (a) mDNS / DNS-SD on the LAN. (b) A signaling server that peers register with and query. (c) Manual pairing codes or typed addresses. (d) The pairing payload's existing `relayUrl` slot as a one-shot bootstrap. (e) A custom UDP multicast beacon.

**Recommendation: (d) + (a) + (c), in that order of precedence, with one addition the prototype forced.**

1. **Bootstrap from the pairing payload.** The plumbing exists on both ends and is unconnected (see [§1](#1-the-honest-starting-position-what-is-already-built), gap 1). Wiring `LanHostController.onUrlChanged` into the pairing flow finishes `LAN-3` and gets a just-paired device onto the LAN with no discovery code on the critical path.
2. **Re-discover with mDNS,** `_brainstorm-sync._tcp` via `bonjour-service`. Measured working, interoperating with the platform responder, 228 ms cross-machine, 5 pure-JS runtime packages.
3. **Always offer manual `host:port`,** because multicast is filtered on guest and corporate networks often enough that automatic discovery cannot be the only path.
4. **Gate the dial on a rotating discovery tag in the TXT record.** This is new, and it comes out of the prototype rather than the existing design.

### 3.1 The new finding: automatic dialing discloses your device identity

In the shipped handshake the client speaks first, and what it says is `hello{deviceAccount}`, its Ed25519 device public key, in cleartext, before the host has authenticated anything. That is sound today because the only address a device ever dials came from a pairing payload it already trusts.

Discovery breaks that assumption. Once a device dials whatever advertises `_brainstorm-sync._tcp`, **any machine on the network can harvest device identity keys by advertising the service and waiting.** The keys are stable and per-device, so a passive collector on a café network can recognise the same laptop when it comes back, and can link two of your machines together by collecting both. The channel-bound handshake stops the attacker from being *admitted*; it does not stop the disclosure, because the disclosure is the first message.

Threat **T6** in [lan-p2p-sync.md](../data/lan-p2p-sync.md) anticipated the beacon side of this and specified a non-linking TXT. It did not anticipate the dial side, because in a pairing-address world there is no dial side.

**Fix: the advertiser proves it belongs to your identity before you dial it.** `P2P-1` is scoped own-device-only, single identity across multiple devices, and every one of those devices holds the same sovereign user key. So derive a discovery secret from it once, `HKDF(sovereign key, "brainstorm/lan-discovery/v1")`, and put a truncated `HMAC(discovery secret, coarse time epoch)` in the TXT record. Own devices recognise it instantly; a sniffer sees an opaque value that rotates on its own; a rogue advertiser cannot produce one. Only then does the dialer send `hello`.

This is deliberately a mechanism that does **not** generalise. Two different users share no such secret, so `P2P-4` cannot reuse it and will need its own answer. That is the point: it keeps multi-user out of the `P2P-1` design instead of half-designing it. Filed as `OQ-P2P-5`.

**Reject the signaling server for LAN discovery.** A signaling server is a server, in the one feature whose entire claim is that there is not one, and it would have to be reachable exactly when the internet is not. It becomes relevant only for `P2P-3`, and [§5](#5-nat-traversal) argues the existing blind relay should be that server rather than a new one.

**Reject the custom UDP beacon** for now. It is more code than `bonjour-service` and buys metadata control that the rotating TXT tag already buys. Keep it as the fallback if a real network is found where mDNS is blocked but raw multicast is not, which would be an unusual configuration.

**Cost.** One runtime dependency (`bonjour-service`, 5 packages, MIT, pure JS). Per the dependency rule it needs an `electron-builder --dir` dry-run before it ships, because `verify` and `test` never run the packager. A multicast responder triggers a first-run firewall prompt on macOS and Windows. Roughly one new module for the advertiser and browser, plus the tag derivation.

**What would change my mind.** A measured failure of `bonjour-service` to bind port 5353 alongside `avahi-daemon` on Linux or the built-in responder on Windows, which would push discovery to a custom beacon on those platforms. Or evidence that the target networks filter multicast often enough that manual entry becomes the primary path, in which case discovery drops down the priority list and `P2P-1` becomes mostly the dial flow.

---

## 4. Transport

**Options.** (a) Reuse `WebSocketRelayPort` over TCP against the shipped `LanRelayListener`. (b) Raw TCP or TLS with a bespoke framing. (c) QUIC. (d) WebRTC data channels.

**Recommendation: (a). This is already decided by shipped code and should not be reopened.**

`ActiveRelayKind.Lan` and `ActiveRelayKind.WebSocket` are the same `WebSocketRelayPort` class with a different address and a different injected handshake (`main/index.ts`, the `makeRelayPort` branch). The listener, the blind fan-out, the admission gate, the reconnect and backoff schedule, the drop-oldest send queue, the subscription re-announce and the `LAN-8` state-vector backfill all exist and are tested. The measured cost of the whole path from discovery to admitted is 13 to 22 ms. There is no problem here that a new transport solves.

(b) is (a) without the tested parts. (c) QUIC would buy multiplexed streams and faster handshakes for a workload that is one logical stream of small frames, at the price of a native or immature dependency in the packaging matrix; the measured 3 to 5 ms connect and sub-millisecond crypto say the handshake is not the bottleneck. (d) WebRTC is the wrong shape for a LAN: it is a NAT-traversal system with a data channel attached, it needs signaling and a STUN server to do its job, and using it on a link where both peers can already see each other is paying the entire cost for none of the benefit. Its only genuine use is [§5](#5-nat-traversal), and it can be added there as a second `RelayPort` implementation without touching anything above `active-relay.ts`.

### 4.1 Two things the transport is missing, both measured

These are not optional polish. They are the difference between "works in a test" and "works on a laptop".

**A connect deadline.** Measured: 75,010 ms to fail a dial to a sleeping peer with the OS default; 3,003 ms with a 3 s application deadline ([§2.4](#24-dialing-a-sleeping-peer-costs-75-seconds)). `WebSocketRelayPort` has no deadline. Without one, a LAN-preferred transport that finds a stale address stalls for over a minute before it can fall back to the relay, and the user sees an application that has silently stopped syncing. Recommendation: a 3 s connect deadline on LAN dials, which is roughly 13x the measured cross-machine discovery time and three orders of magnitude above the 3 to 5 ms measured connect, so it will not fire on a healthy link.

**A heartbeat with a degraded state.** Measured: a frozen peer was never noticed by the transport; a 5 s heartbeat deadline noticed in 5,047 ms; and the socket was still usable after the peer woke ([§2.5](#25-an-established-socket-does-not-notice-a-peer-that-sleeps)). Recommendation: a ping on the LAN path with an answer deadline that moves the port to a *degraded* state rather than closing it. Degraded means the status surface stops claiming a live LAN link and the relay fallback is armed, while the socket is given a grace period to answer. Closing immediately would tear down connections that recover, which the measurement shows is a real case.

Both belong on the LAN path first. Whether the cloud path wants them too is a separate question with a hosted node on the other end, and is out of scope here.

**Cost.** Small and additive: a timer and an abort on the connect path, a ping or pong pair and a state on the port. Neither touches the relay-blind fence, since a keepalive carries no routing metadata.

**What would change my mind.** A workload where the single-stream WebSocket becomes head-of-line blocked behind large asset transfers, which would argue for QUIC or a second channel. The asset plane is deliberately out of the LAN MVP, so this is not a live concern.

---

## 5. NAT traversal

**Options.** (a) Nothing: LAN plus relay only. (b) Best-effort direct connectivity where the network permits it (same NAT, UPnP-IGD or NAT-PMP, manual port forward). (c) Full ICE with STUN and a TURN fallback, via WebRTC or a hand-rolled stack.

**Recommendation: (a) for `P2P-1` and `P2P-2`. Re-scope `P2P-3` to (b). Do not build (c).**

The reasoning is a single observation that should be stated plainly because it changes what `P2P-3` is worth:

**NAT traversal needs a rendezvous server, so it does not deliver "no server". And the relay is already blind, so it does not deliver privacy either.**

The relay stores sealed ciphertext addressed by opaque routing tokens derived from the entity DEK. It never sees a document, a title, an entity id or an account it can link to a person. A peer-to-peer connection across the internet therefore does not improve confidentiality over the relay in any way a user could notice. What it improves is latency, independence from relay availability and quota, and bandwidth cost. Those are real but they are optimisations, not the product claim.

The LAN case is completely different, and it is why `P2P-1` is the hero rather than `P2P-3`. On a LAN there is genuinely no third party at all, not even a blind one, so the timing and volume metadata that the relay operator could in principle observe never leaves the building. And it works with the internet unplugged. That is a claim a user understands and can verify.

So: `P2P-3` should be re-scoped from "NAT traversal" to "direct connection whenever the network already allows it", which covers two machines behind the same home NAT reaching each other by private address, plus an opportunistic UPnP-IGD or NAT-PMP mapping, plus a manual port forward for people who want one. Every one of those reuses the shipped transport unchanged. Full ICE, STUN and TURN is a large, permanently-maintained subsystem whose entire payoff is a latency improvement over a path that already works, and it should not be built without a user asking for it.

**If it is ever built, the signaling server already exists.** The blind relay is an authenticated, always-reachable, content-blind message bus between exactly the devices that need to exchange ICE candidates. Candidate exchange would ride it as sealed frames like everything else, so no new server and no new trust relationship. Worth writing down now so nobody proposes a signaling service later.

**Does this change the transport choice today? No.** WebRTC would only be needed under (c), and under (c) it would arrive as a second `RelayPort` implementation selected by `active-relay.ts`, which is exactly the seam that exists. Choosing the WebSocket path now forecloses nothing.

**Cost of the recommendation.** Effectively zero now; it removes work from the roadmap rather than adding it.

**What would change my mind.** Relay bandwidth cost becoming a real line item at scale, or a user segment that cannot use a relay at all for policy reasons and is not co-located. Either would justify (c), and at that point the blind relay as signaling channel is the design.

---

## 6. Trust and admission

**This is determined by shipped code and should not be re-decided.** `P2P-1` reuses the channel-bound HPKE handshake verbatim ([§1](#1-the-honest-starting-position-what-is-already-built), and the full specification in [lan-channel-binding.md](../data/lan-channel-binding.md)). The properties that matter:

- The principal is the **per-device** Ed25519 key, not the sovereign user key. Devices are distinguishable and individually revocable.
- The nonce is HPKE-sealed to the peer's roster X25519 key, so possession of that key is a precondition for answering at all. This is what defeats the relay attack that plain mutual challenge-response cannot.
- The AAD binds both account names, so a challenge sealed for device A is useless against device B.
- Direction tags separate the client proof from the host proof, so neither is usable as the other.
- The client sends nothing beyond `hello` until it has verified the host's proof.
- The roster is rebuilt from `listActive()` per access, so revocation lands on the next connection, in both directions.

**Where `P2P-1` differs from what shipped, and it is one thing.** Every dial today targets an address that came from a pairing payload. `P2P-1` introduces dialing an address that came from a broadcast. That single change is what creates the identity-disclosure problem in [§3.1](#31-the-new-finding-automatic-dialing-discloses-your-device-identity), and the rotating discovery tag is the answer. Nothing else about the trust model moves.

**Own-device-only, and how this design keeps it that way.** `P2P-1` is one identity across several devices. Every mechanism above depends on that: the roster is the identity's device list, and the discovery tag is derived from the identity's own key. Multi-user peer-to-peer (`P2P-4`) has neither a shared roster nor a shared secret between the two sides, so it cannot reuse either and will need cross-identity admission built on the `Collab-C5` / `C6` sharing model. Naming that boundary explicitly is the mechanism that stops `P2P-4` leaking backwards into `P2P-1`: any proposal that requires a peer to admit a *different* identity is out of scope by construction, not by judgement.

**Cost.** Zero for the reused parts. The discovery tag is a KDF call and a TXT field.

**What would change my mind.** Nothing short of a finding against the shipped handshake, which had a security review and a pentest ([`_review/evaluations.jsonl`](../_review/evaluations.jsonl)).

---

## 7. Relationship to the relay

**Options.** (a) Exclusive: one transport at a time, LAN preferred, relay as fallback. (b) Dual: run both and let CRDT idempotency deduplicate. (c) Race: start both, keep the first to answer.

**Recommendation: (a), with a fast and explicit fallback.**

`ActiveRelayOrchestrator` holds a single `#current` port, so (a) is also the cheap option, but it is not the reason to choose it. The reason is that **(b) and (c) both silently break the claim the product makes about LAN sync.** `LAN-5` shipped a status surface that says syncing is happening on the local network with no server involved. If the relay connection is also live and also carrying frames, that statement is false, and a false privacy claim is a trust failure rather than a cosmetic one. Dual transport would mean the relay observes exactly the timing and volume metadata that LAN mode exists to avoid.

So: prefer LAN when a peer is discovered and admitted, use the relay otherwise, and never both at once for the same vault.

**The fallback has to be fast, and this is where [§2.4](#24-dialing-a-sleeping-peer-costs-75-seconds) becomes load-bearing.** Exclusive selection means that while the LAN attempt is in flight, nothing is syncing. Measured, a dial to a sleeping peer takes 75 s to fail on its own. Exclusive transport without a connect deadline is therefore a 75-second sync outage every time you open your laptop somewhere the other machine is asleep. With the 3 s deadline from [§4.1](#41-two-things-the-transport-is-missing-both-measured) it is a 3-second pause nobody notices. The deadline is not a nice-to-have; it is what makes the exclusive model acceptable.

**The relay's blindness does not regress, because nothing about the relay changes.** No new verb, no new field, no new metadata. The relay keeps storing sealed ciphertext addressed by opaque routing tokens. `P2P-1` adds a path that bypasses it and adds nothing to it.

**Snapshot authority (`OQ-P2P-2`), and why there is no conflict to resolve.** The durable node holds a sealed tail; a LAN peer does not. The concern is what happens when a device that has been syncing over LAN reconnects to the relay and finds the node's copy older. The answer is that there is no authority to conflict with: the node is a **store, not an arbiter**. Yjs merge is commutative and idempotent, `SeqTracker` bounds replay, and the reconciliation path already exists as the `LAN-8` state-vector diff, with the ydoc worker's `snapshot` verb already taking `sinceStateVectorB64`. Reconnecting to the relay is the same operation as reconnecting to a peer.

The real consequence is not conflict, it is a **gap**: if two devices co-edit over LAN and neither ever reconnects to the relay, the durable node's copy stays stale, so a third cold device restoring from zero gets an old state. That is acceptable and is already the documented position, because [20-database-growth-and-sync.md](../data/20-database-growth-and-sync.md)'s fresh-device bootstrap rule already requires that a peer *or* a relay be online. It is worth surfacing to the user rather than hiding: a device that has not reached the relay in a long time should be able to say so.

**One boundary to hold in `P2P-2`.** `P2P-2`'s reconciliation must stay on the relay side. The moment a LAN host persists its own sealed per-entity tail so that a peer can back-fill while the *other* editing peer is offline, that is `LAN-9`, and `LAN-9` is gated behind `LAN-2b`. Building it under a `P2P-2` label would route around a gate, which is exactly the failure mode the gate ledger exists to prevent.

**Cost.** The selection logic and the deadline. No orchestrator restructuring, because exclusive is what it already does.

**What would change my mind.** A measured pattern of LAN links flapping badly enough that exclusive selection produces visible sync gaps even with a fast deadline. The fix would then be dual transport plus an honest status surface that stops claiming "no server", which is a product decision and not a purely technical one.

---

## 8. Portability

**Verified.** macOS 26.0.1. Advertising, browsing, cross-machine resolution, binding a listener on a private IPv4 address, and the full handshake all work, with the numbers in [§2](#2-the-prototype-and-what-it-measured). The pure-JS advertiser interoperates with the platform `mDNSResponder`.

**Windows and Linux: expected to work, not tested, and the risk is concentrated in one place.** The listener is `node:http` + `ws`, which is as portable as Node gets, and the handshake is pure computation. The risk is **binding UDP 5353 alongside the platform responder**: `avahi-daemon` on most Linux desktops and the built-in responder on Windows 10 and later both hold that port. `multicast-dns` sets `SO_REUSEADDR`, which is usually enough, but "usually" is not a design position. This must be tested on both before `P2P-1` ships, and it is the one item that could change the discovery recommendation per platform. Filed as `OQ-P2P-3`.

**Firewall prompts on all three.** Binding an inbound socket and joining a multicast group both prompt on macOS and Windows. Releases are already signed and notarized so the dialog is not alarming, but it is a first-run cost and needs a moment in the UI that explains why it is being asked.

**Two portability defects in the shipped listener that `P2P-1` should fix while it is in there.**

- **Interface selection takes the first private IPv4.** `lan-host-factory.ts` uses `deps.addresses()[0]` over `lanInterfaces()`. On a machine with Docker (`172.17.0.1` on Linux), a VPN `utun`, a virtual-machine host adapter or both Wi-Fi and Ethernet, "first" is arbitrary and frequently the wrong one, and the failure is silent: the listener binds an address no peer can reach. `P2P-1` needs a deliberate choice, and mDNS makes a better one possible since it can advertise every candidate address and let the peer try them in order. The prototype's own browse returned five addresses for one host, so multi-address handling is unavoidable anyway.
- **IPv6 is unsupported.** `isBindableAddress` requires a 4-octet IPv4 literal, and `lanInterfaces` filters to IPv4. The prototype's mDNS resolution returned link-local and global IPv6 addresses alongside the IPv4 one. This is fine as a v1 restriction but should be a written decision, not an accident, because IPv6-only networks exist and the failure mode is again a silent no-op.

**What the mobile companion inherits, and what it does not.** From [76-mobile-companion.md](76-mobile-companion.md), design-only, no development scheduled.

*Inherits:* the transport (a WebSocket client), the admission handshake (X25519 plus Ed25519 plus HPKE, all portable), the roster, the sealed envelope pipeline, and everything else that would live in the portable `@brainstorm/vault-core`. A phone can be a fully-functional LAN *client*.

*Does not inherit:* the host role and the discovery role. Three reasons, in order of how hard they are. On iOS, using multicast at all requires the `com.apple.developer.networking.multicast` entitlement, which needs an approved request to Apple; Android needs a multicast lock via `NsdManager`, which is easier but not free. Both platforms restrict background execution hard enough that a phone cannot be relied on to be listening. And a phone binding an inbound listening socket on an untrusted network is a worse trade than a laptop doing it.

So the mobile position is: **client only, never host, discovery deferred**, dialing an address supplied by pairing or by the desktop over the relay. That is a smaller surface than the desktop and it needs no new design work now. It does mean phone-to-phone LAN sync is out of scope indefinitely, which is the right call. Filed as `OQ-P2P-6`.

**What would change my mind.** A Linux or Windows test that fails on port 5353, which would move those platforms to a custom beacon or to bootstrap-plus-manual only.

---

## 9. What `P2P-1` actually has to build

The executable brief, in dependency order. Roughly six work items, of which two are small fixes and one is the only genuinely new subsystem.

1. **Finish `LAN-3`'s producing half.** Route `LanHostController.onUrlChanged` into the pairing payload so a newly paired device gets `ws://<private-ip>:<port>` and can reach the host on first contact with no discovery involved. The accepting half already shipped.
2. **Build the LAN dial flow, the one that writes `syncRelay.lan = true`.** Today nothing does. This is the item that turns the shipped machinery into a feature: pick a peer address, set the config, let `ActiveRelayOrchestrator` rebuild as `ActiveRelayKind.Lan`, and surface the result. It carries the Settings affordance for turning LAN hosting on, since `DEFAULT_LAN_HOST_MODE` is `Off`.
3. **Add the connect deadline and the heartbeat with a degraded state** ([§4.1](#41-two-things-the-transport-is-missing-both-measured)). 3 s and roughly 5 s respectively, from the measurements. These are prerequisites for item 4 being usable, not follow-ups.
4. **Add mDNS discovery**: advertise `_brainstorm-sync._tcp`, browse, and hand addresses to item 2. Treat records as address hints with no liveness meaning ([§2.3](#23-mdns-does-not-tell-you-when-a-peer-goes-away)), handle multiple addresses per instance, and expect stale records.
5. **Add the rotating discovery tag** ([§3.1](#31-the-new-finding-automatic-dialing-discloses-your-device-identity)). No `hello` to an advertiser that cannot produce a valid tag. This is a security requirement of automatic discovery, not an enhancement, and it should land in the same change as item 4.
6. **Fix interface selection and decide the IPv6 position** ([§8](#8-portability)).

**Gates.** A `bonjour-service` dependency triggers the dependency rule, so an `electron-builder --dir` dry-run is required. Items 4 and 5 change what the device broadcasts and who it will talk to, which is new attack surface on the first inbound socket, so a `/security-review` is required and a `/pentester` pass is warranted on the discover-to-dial path specifically. Both go in [`_review/evaluations.jsonl`](../_review/evaluations.jsonl) with a rubric, per the recorded-gates rule.

---

## 10. Verdict: is `P2P-1` startable?

**Yes. Nothing blocks it.**

**On `LAN-2b(d)`, plainly: it is not a prerequisite for `P2P-1`.**

The reasoning, from the code rather than the rung text. `LAN-2b(d)` has two halves. The first is enforcement at admission, and it **is done**: `lan-sync-wiring.ts` rebuilds the roster from `listActive()` on every access, so a revoked device is not in the admission map, cannot be sealed a challenge, and is closed at `hello`. The client's directory is built the same way, so a revoked host is rejected symmetrically. LAN admission is in fact the strictest revocation enforcement anywhere in the product today.

The second half is the substantive one and it is open: a revoked device still holds the DEKs it was given, so revoking it does not claw back read access to data it can still reach. The fix is routing `revokeDevice` into `ROT-3a` rotate-on-revoke, which re-keys real user data and is correctly an owner decision rather than a coding task.

`P2P-1` does not touch that. It adds no read path for a revoked device: on the LAN path a revoked device is refused before any routing metadata moves, and on the relay path it is exactly as capable after `P2P-1` as before. If anything `P2P-1` improves the posture, because a device that syncs over LAN is syncing over the one path where revocation is actually enforced.

**Two things must hold for that to stay true, and both are stated above so they are testable rather than assumed:**

- `P2P-1` must not build a **host-side durable tail**. That is `LAN-9`, `LAN-9` is gated behind `LAN-2b`, and a sealed tail is precisely the artefact a revoked device could read if it were ever admitted. [§7](#7-relationship-to-the-relay) draws this boundary for `P2P-2` as well.
- `P2P-1` must not weaken admission to make discovery convenient. The discovery tag in [§3.1](#31-the-new-finding-automatic-dialing-discloses-your-device-identity) sits *in front of* the handshake and adds a check; it must never become a substitute for one.

**The unwired relay-path `isDeviceRevoked` predicate** ([§1](#1-the-honest-starting-position-what-is-already-built), gap 3) deserves naming separately even though it does not block this track. It is a live gap in shipped code on the relay path, it is defence in depth that costs almost nothing to wire, and it is currently doing nothing at all because it has no non-test producer. It should be wired regardless of what the owner decides about rotate-on-revoke.

---

## 11. Open questions filed

Positions are recorded in [reference/11-open-questions.md](../reference/11-open-questions.md) as `OQ-P2P-1` through `OQ-P2P-6`. In summary:

- **`OQ-P2P-1`: discovery and transport.** Position taken: transport is settled by shipped code (reuse `WebSocketRelayPort`); discovery is pairing address, then mDNS, then manual, gated by a rotating identity tag. Non-blocking.
- **`OQ-P2P-2`: relay fallback and snapshot authority.** Position taken: exclusive transport with LAN preferred and a 3 s dial deadline; the durable node is a store and not an arbiter, so there is no authority conflict, only a staleness gap that is already the documented position. Non-blocking.
- **`OQ-P2P-3`: does discovery bind port 5353 alongside `avahi` and the Windows responder?** Genuinely open and untested. Blocks the discovery rung on those platforms, not the track.
- **`OQ-P2P-4`: is `P2P-3` worth building at all,** given that NAT traversal needs a rendezvous server and the relay is already blind, so the payoff is latency rather than privacy. Blocks `P2P-3` only.
- **`OQ-P2P-5`: the discovery tag's derivation and rotation cadence,** and what replaces it for multi-user `P2P-4`, which shares no secret across identities. Blocks the discovery rung.
- **`OQ-P2P-6`: mobile's transport-only position.** Confirm the iOS multicast entitlement and Android multicast-lock constraints before `MOB-*` assumes anything. Blocks nothing now.

The original `OQ-P2P-3` in the plan (does peer-to-peer change the multi-user trust model, or only the transport) is answered in [§6](#6-trust-and-admission) and does not need to stay open: **only the transport changes.** The number is reused above for the platform question, which is a real unknown, rather than kept alive for a question the spike settled.
