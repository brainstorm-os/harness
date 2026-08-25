# The admission principal — which key proves "I am an allowed device"

Decision note for **LAN-2b(c)**, the item the rest of the LAN security gate
depends on (`../_review/2026-07-26-lan-p2p-security-gate.md`
G3/G4). It also unblocks the device-revocation fix, which is a *live* gap on
today's build.

## The problem in one paragraph

Two key spaces exist and the code mixes them. The **sovereign user key**
(`session.identity`) is one keypair per *vault*, replicated to every paired
device — it signs frames (the wire `sender`), the challenge response, and the
`add-device` roster records. The **per-device key**
(`session.deviceEd25519`) is one keypair per *device*, minted at pairing, and
is what the roster is keyed on (`deviceEd25519Pub`). Admission
(`isRosterMember(account)`) receives the *user* key but looks it up in a table
keyed by *device* keys — in a different base64 variant, no less. So it either
never matches, or "matches" a credential every device shares equally.

The consequence is not a lookup bug, it is an **expressiveness** failure: a
credential identical on every device cannot name one device, so per-device
revocation is not implementable on top of it. That is why G4 can't be fixed
without settling this first.

## What the wire carries today

The routing header's `sender` is the **user** key. There is no per-device field
anywhere in the frame. So a recipient literally cannot tell *which device* sent
an update — which is the root reason `isDeviceRevoked` has no correct
implementation to be wired to, independent of whether someone remembers to
wire it.

## Option A — the per-device key is the principal (recommended for LAN)

The LAN challenge is signed by `signWithDeviceKey` and `account` carries
`deviceEd25519Pub`; the verifier compares against `listActive()` in one
canonical encoding.

- **Fixes G3 and the LAN half of G4 outright.** One key space, and the roster
  can name exactly one device, so revocation becomes expressible.
- **Removes the sovereign key from the LAN signing path entirely** — which
  supersedes the G1 domain tag *for this transport*: a key that never signs
  roster records cannot be an oracle for them.
- **Costs nothing in deployment.** Both ends ship in our binary; the session
  already exposes `signWithDeviceKey` and `deviceEd25519`. No coordination with
  the hosted node.
- **Limitation:** it authenticates the *transport connection* only. Frames
  still carry the user key as `sender`, so the recipient still can't attribute
  an update to a device. That's Option C's job.

## Option B — keep the user key, add a second device proof

The `auth` control carries both the user-key signature (as today, for catalog
scoping) and a device-key signature over the same context-bound payload.

- **Preserves the cloud contract.** The hosted node scopes the catalog to
  `account` = user key — that's the SYNC-4a metadata fix — so the cloud path
  can't simply swap principals without a node change. Option B is the shape
  that works for *both* transports.
- **Costs:** two signatures per admission, a wire-format addition, and the node
  must learn to verify the second one before it can act on it.
- **Verdict:** the right answer for the **cloud** path later; unnecessary
  ceremony for LAN, where we own both ends.

## Option C — put the device in the routing header (needed for real revocation)

Add a `device` field to the routing header alongside `sender`, signed under the
existing signature, and have the recipient check it against the roster.

- **This is the only option that makes `isDeviceRevoked` meaningful**, because
  it's the only one where a *frame* names its device.
- The header is versioned (`v`), so this is an additive change with a
  compatibility window rather than a break.
- **Necessary but not sufficient for a stolen device:** the thief's device
  already holds the DEKs. Blocking its writes doesn't un-share what it can
  already read. Real remedy = **rotate** (below).

## Recommendation

1. **LAN-2b(c): take Option A now.** Cheapest, ours end to end, and it's what
   makes the LAN admission gate mean anything at all.
2. **Device revocation: rotate, don't just flag.** Route
   `PairingService.revokeDevice` into the existing **ROT-3a rotate-on-revoke**
   machinery — rotate the DEKs the revoked device held and re-wrap to the
   survivors. That machinery is already built and already resumes deferred
   rotations at boot; device revocation simply never called it. This is the
   substantive fix; the predicate is defense-in-depth.
   ⚠️ Sequencing hazard: [[rotate-on-revoke-needs-receive-path-test]] — the
   owner-side rotation tests were false-green because `installEntityDek` no-ops
   on an existing DEK and drops the rotated DEK′ (survivor lock-out). Fix the
   receive path (versioned/monotonic DEK install) *before* pointing another
   caller at it, or device revocation will lock out the wrong devices.
3. **Option C when frame-level attribution is actually needed** — pair it with
   making `isDeviceRevoked` a required (non-optional) context field so a
   missing wiring is a type error rather than a silent fail-open.
4. **Option B when the cloud path needs per-device revocation** — it needs the
   hosted node to move first, so it is not on the LAN critical path.

## What this does *not* decide

Whether an admitted peer may subscribe to arbitrary routing keys (gate G7, new
**OQ-LAN-9**). That is an authorization question on top of whichever principal
we pick, and it stays open.
