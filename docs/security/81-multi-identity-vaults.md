# Multi-identity vaults

**Status:** design, unbuilt. Filed 2026-08-08 from `F-493` (pairing bricks the joining device's vault). Owner position taken: build real multi-identity rather than sidestep it.

Today a vault has exactly **one** sovereign user identity, and that assumption is welded into the open path, the sync wire, and the access model. This document says precisely where, what has to change, and which questions must be answered before any of it is written — the same rule `10.3c` set for itself, because this is a key-distribution change and those are designed first.

---

## 1 · Why this exists

`F-493`: pairing a second device writes the **source's** identity secret into the **target's own existing vault** (`setSecret(<target vaultId>, "identity", …)`, `main/ipc/pairing-handlers.ts`). Nothing updates that vault's `vault.json.identityPublicKey`, so the next `VaultSession.open` compares the two, finds them different, and throws. The device cannot open its vault at all.

The code states the assumption it was built on:

> *"the target's vault.json is the same logical vault as the source's, just opened on a different device after the user copies it across, so the keys match by construction"*

That holds only if the user manually copied the vault folder across first. Nothing says so, nothing enforces it, and Settings → Devices → Join is only reachable from a device that already has a vault open — so the target **always** has one.

**Read this before implementing.** Multi-identity removes the crash but does not, by itself, give the joining device access to the vault it joined: vault A holding identity B is still vault A, with none of B's content. Whatever ships must answer §5 as well, or the user trades a loud failure for a silent one.

## 2 · The invariant today

One vault ⇒ one identity, enforced at open:

```ts
// main/vault/session.ts
if (expectedPublicKeyBase64 && expectedPublicKeyBase64 !== publicKeyBase64) {
  throw new Error(`Vault ${vaultId}: identity public key in keystore does not match vault.json …`);
}
```

`expectedPublicKeyBase64` comes from `vault.json.identityPublicKey` — a single string, written once at creation (`main/vault/vault.ts`) and only ever *preserved* by later writers.

## 3 · Everything that assumes it

| Site | Assumption | What multi-identity forces |
|---|---|---|
| `vault.json.identityPublicKey` | one base64 string | a **set**, plus a schema version and a migration for every existing vault |
| `session.ts` open check | exact equality | membership test against the set |
| keystore | one `"identity"` secret per vault id | N secrets, addressed per identity |
| `VaultSession.identity` | the vault's identity | **the session's ACTIVE identity** — a new concept, and every consumer inherits it |
| sync `PipelineContext.devicePub` | `session.identity.publicKey` | which identity signs an envelope, and how a peer knows which to verify against |
| `inboxChannelFor(identity.publicKeyBase64)` | one inbox | N inboxes subscribed, or one per active identity |
| `ResolvedMember.member` / `addedBy` | names an identity | unchanged in shape, but "is this member me?" becomes a set test |
| entity `createdBy` | an identity | unchanged in shape; provenance now spans identities within one vault |
| `DevicesStore` roster | devices of *the* identity | devices of *an* identity — the roster becomes per-identity |

The shape changes are small. The semantic change is not: **"who am I in this vault"** stops being a constant and becomes state, and every one of those call sites currently reads it as a constant.

## 4 · What must be decided first

Filed as `OQ-248` … `OQ-251`. None is a detail; each changes what the code looks like.

- **OQ-248 — active identity.** Does a session present ONE identity at a time (chosen at open, switchable) or ALL of them simultaneously? One identity keeps the sync wire and signing unchanged and makes "who am I" answerable; all-at-once avoids a mode but forces every signer, inbox and roster to become plural.
- **OQ-249 — provenance across identities.** Entities carry `createdBy`. After adopting a second identity, are the first identity's entities still *yours*? If the answer is "yes, any identity in the vault owns them", the access model's meaning changes — a grant to identity A now implicitly reaches whoever else the vault admits.
- **OQ-250 — trust to admit.** Adding an identity to a vault is exactly the operation `F-493` performs *by accident*. What authorises it? Today pairing writes the secret with no vault-side record. Whatever ships needs a signed, auditable admission — otherwise "multi-identity" is a supported path for silently repointing someone's vault.
- **OQ-251 — migration and rollback.** Every existing vault has the single-string field. A vault opened by a multi-identity build and then by an older build must not brick — the failure mode being fixed is precisely a vault that will not open.

## 5 · The gap this does not close

Multi-identity lets vault A hold identity B. It does **not** give the joining device vault B's data. A user who joins from a device that already has a vault will, after this lands, successfully open a vault that does not contain what they joined for.

So the pairing flow still has to decide what "join" means on a device that already has a vault — provision a new vault for the joined one, adopt into the current one, or refuse. That decision is `F-493`'s original triage (a)/(b)/(d) and it survives this design. **Multi-identity is a prerequisite for some of those answers, not a replacement for making the choice.**

## 6 · Gates

Key distribution and the vault-open path. `/security-review` **and** `/pentester` before ✅, recorded in [`_review/evaluations.jsonl`](../_review/evaluations.jsonl) per the gates-are-recorded rule. Specific things a pentest should try: admitting an identity without authorisation (OQ-250), downgrading a multi-identity vault to a single-identity build (OQ-251), and using a second admitted identity to read entities shared only to the first (OQ-249).
