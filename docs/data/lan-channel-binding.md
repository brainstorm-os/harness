# LAN admission, channel-bound — the G2 fix

Design for **LAN-2b(a)+(b)**, the last critical item blocking LAN-4's external
socket bind. Supersedes the "mutual challenge" mitigation in
[`lan-p2p-sync.md`](lan-p2p-sync.md) §4.3 / T4, which does not work. Findings:
`../_review/2026-07-26-lan-p2p-security-gate.md`
G2. Principal decision: [`lan-admission-principal.md`](lan-admission-principal.md).

## Why the specified fix fails

The design says: the host challenges the client, *and the client verifies the
host back* — mutual challenge-response over Ed25519, and T4 claims this closes
the rogue-host case.

It doesn't. Against a **relay** (the attacker sits between two honest devices
and forwards messages), signature-only mutual auth is defeated by construction:

```
victim  ⟷  attacker  ⟷  real host
```

The attacker forwards the real host's nonce to the victim and the victim's
signature back to the real host. Binding the *peer's claimed account* into the
signed payload doesn't help — the attacker simply claims the real host's
account, and when the real host challenges it, relays that challenge to the
victim too. Every signature the honest parties produce is one the attacker
needed. Both sides finish "authenticated" with the attacker in the middle.

The general result: **a signature proves possession of a key, not that the key
is on the other end of *this connection*.** Challenge-response stops
impersonation *without a live victim*; it cannot stop a relay. Preventing that
requires binding authentication to a **key agreement** whose secret the relay
cannot derive — which is exactly what TLS and Noise do, and what a bare
signature does not.

## The fix

Bind admission to an **X25519 key agreement against the roster's
`deviceX25519Pub`**, so a party that cannot derive the channel secret cannot
participate — relay or not.

Everything needed already ships:

- Every device has a static X25519 keypair (`session.deviceX25519`, secret
  never leaving the main process) — the key HPKE DEK-wraps are already sealed
  to.
- Each roster record carries the peer's `deviceX25519Pub`, so both peers
  already hold each other's public key **offline, from pairing**. No new key
  material and no new distribution problem.
- `@brainstorm-os/native` exposes `hpkeSealBase` / `hpkeOpenBase` (RFC 9180,
  KAT-pinned) and `x25519GetPublicKey`, wrapped by
  `main/credentials/hpke.ts`.

### Handshake

The host still challenges first; the nonce is now delivered **sealed to the
connecting device's X25519 key**, which makes possession of that secret a
precondition for answering at all.

1. **Client → host** `hello{ deviceAccount }` — the client names which device it
   claims to be (its Ed25519 pubkey, the LAN principal per the principal note).
2. Host looks that up in `lanRosterAdmissionSet(...)`; unknown or revoked ⇒
   close. It then takes that record's `deviceX25519Pub` and sends
   **`challenge{ enc, ct }`** = `hpkeSealBase(pkR = clientX25519Pub, info =
   "brainstorm/lan-admission/v1", aad = hostDeviceAccount ‖ clientDeviceAccount,
   pt = nonce)`.
3. **Client** `hpkeOpenBase`s it with its X25519 secret. A relay cannot: it
   holds neither device's secret, so it cannot learn the nonce or re-seal one.
   The client answers `auth{ sig }` = Ed25519 over
   `"brainstorm/lan-admission/v1" ‖ hostDeviceAccount ‖ clientDeviceAccount ‖
   nonce`.
4. **Host** verifies the signature against the roster Ed25519 key for that
   account and admits.
5. **Host → client** `auth-ok{ proof }` = Ed25519 by the *host's* device key
   over `"brainstorm/lan-admission/v1/host" ‖ clientDeviceAccount ‖ nonce`. The
   client verifies against the host's roster record before it sends anything
   (it already holds nothing back until `auth-ok` — G5, shipped in #311).

**Why this stops the relay.** The nonce is confidential to the holder of the
client's X25519 secret. An attacker relaying step 2 cannot open the ciphertext,
so it cannot produce step 3 itself; and it cannot re-seal the real host's nonce
to the victim, because it would have to seal *to the victim's* key while the
real host sealed *to the attacker's* — different ciphertexts, and the AAD binds
both account names, so a cross-connection swap fails authentication. Each
completed handshake is bound to one pair of devices.

**Direction tags** (`…/v1` vs `…/v1/host`) prevent reflection: neither side's
proof is usable as the other's.

### Why not a plain signature over an ECDH shared secret

Equivalent security, more foot-guns: it needs a raw-ECDH primitive we don't
currently expose, plus hand-rolled KDF and transcript hashing. HPKE base mode
gives sealed delivery + AAD binding in one audited call we already ship and
already KAT-test. Reuse beats a bespoke construction on the security path.

### What this does NOT do

It authenticates the *handshake*, not every subsequent byte: the socket stays
plaintext `ws://` afterwards, so a MITM that cannot join can still observe
frame sizes and timing (T3/T6 metadata) and drop or reorder frames (a DoS the
CRDT layer heals). Encrypting the whole channel — deriving a transport key from
the same HPKE exchange — is the natural follow-on and would close T3/T6
properly. **OQ-LAN-3 should be resolved as: authentication binding is REQUIRED
(this doc); full transport encryption is the next rung, no longer "deferred
defense-in-depth" but a scoped follow-up.**

## Wire compatibility

All three messages are existing control ops gaining fields (`challenge` gains
`enc`/`ct` and loses the plaintext `nonce`; `auth` gains nothing it doesn't
have; `auth-ok` gains `proof`), plus one new `hello`. The **cloud** path is
untouched — the hosted node keeps its plaintext-nonce SYNC-4b handshake, and
the client already distinguishes the two by local config
(`requireAdmission`), not by sniffing the wire, so there is no downgrade path.
LAN has no deployed peers, so there is no migration window to honor.

## Relay-blind placement

`lan-relay-host.ts` is inside the CI fence (`sync/**/*relay*.ts`) and must stay
crypto-free: it already shuttles opaque `challenge`/`auth` control strings and
calls an injected `admit(...)`. The HPKE seal/open and both signature
operations live in `lan-admission.ts`, which is deliberately outside the fence
— the same split the current code uses. **The LAN-4 bind module must be named
`lan-relay-listener.ts`** so it inherits the fence (gate finding G12: a module
named `lan-listener.ts` would not).

## Test plan

Each of these fails without the fix:

1. **Relay attack** — three parties: honest client, honest host, attacker
   forwarding verbatim between them. Attacker must fail admission. This is the
   test the current design has no answer for.
2. **Wrong X25519 key** — a device on the roster whose X25519 secret doesn't
   match its record cannot open the challenge.
3. **Cross-connection swap** — a `challenge` sealed for device A, replayed to
   device B, fails (AAD binds both accounts).
4. **Reflection** — the host's `auth-ok` proof does not verify as a client
   `auth` proof, and vice versa (direction tags).
5. **Revoked device** — excluded at step 2 before any crypto.
6. **Happy path** — two paired devices complete the handshake, live co-edit and
   backfill still converge (extend the existing `lan-p2p-sync.test.ts`).

## Rungs

- **LAN-2b(a)** — the handshake in `lan-admission.ts` + `lan-relay-host.ts`
  (tests 1–5 above).
- **LAN-2b(b)** — client-side host verification wired through
  `WebSocketRelayPort` as an injected `verifyHost` callback (keeps the port
  relay-blind), gated on `requireAdmission`.
- Both land **before** LAN-4's bind; then re-run `/pentester` against the real
  socket per the gate's closing requirement.
