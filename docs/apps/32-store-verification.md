# 32 — Store-level verification and update integrity

This doc extends [14-app-store.md](14-app-store.md) with the **post-install verification** and **continuous-trust** mechanisms needed to keep installed apps trustworthy after they're shipped — modeled on the **Chrome Web Store**'s signing + manifest verification + remote-blocklist pattern. The goal is that a previously-trusted app turning out to be malicious doesn't quietly continue running; the user finds out, has options, and the platform can revoke.

It builds on [14-app-store.md](14-app-store.md) (the basics: package format, signing, install protocol, update channels, automated review), [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (threat model, capability ledger), [26-shell-as-framework.md](26-shell-as-framework.md) (dev mode), and [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) (identity / signing infrastructure).

## What 14 already covers

- `.brainstorm` package format with embedded Ed25519 signature.
- Trusted-on-first-use (TOFU) on first install.
- Same-key requirement on updates (with rotation chain support, OQ-23).
- Automated review pipeline (capability scan, static analysis, behavioral fuzzing in mock-shell-dock, sandbox-escape probes, AI-assisted code review).
- Revocation records (publisher-key compromise stops future updates).
- The sandbox is the actual safety guarantee.

What 14 leaves under-specified:
- How does a compromised-app flag propagate to *already-installed copies*?
- What happens at runtime — is the bundle hash verified, and how often?
- What if a malicious update slips through automated review?
- How do users learn about a compromised app they've installed?
- What's the recovery story when a previously-trusted app is later flagged?

This doc fills in those gaps.

## Principles

1. **Verify at every meaningful boundary.** First install, every update, periodic checks at runtime. Not "trust on first install and never look again."
2. **Killbits propagate.** A compromised app discovered after distribution gets flagged via a signed feed; subscribed shells learn within hours.
3. **No silent removal.** A user's app is never silently uninstalled — the user sees what's flagged and decides. Data is preserved either way.
4. **Federated trust.** Brainstorm's hosted catalog is one trust source; users may subscribe to additional audit-feed catalogs run by third parties. No single point of compromise.
5. **The user is the trust root.** All trust signals are surfaced; the user can override (with explicit acknowledgment) but never has trust changed silently.

## Five mechanisms

### 1. Runtime bundle integrity verification

> **Decision:** the shell records the **SHA-256 hash** of every installed app's bundle at install time, in the capability ledger. On every app launch (or periodically for long-running apps), the shell re-verifies the bundle's hash against the recorded value. A mismatch refuses the launch with a clear "this app's files have been tampered with" message and the option to reinstall.

The recorded hash lives in `ledger.db` (per [12-shell-architecture.md](../shell/12-shell-architecture.md)), encrypted at rest under the vault master key (per [29-credentials-storage.md](../security/29-credentials-storage.md)). Tampering with the ledger requires the vault master key, raising the bar.

Verification is cheap — SHA-256 of a 50KB-1MB bundle is sub-millisecond — and runs:
- On every cold app launch.
- On warm-launch if the bundle file mtime differs from recorded.
- After every update install (final hash check).

> **Decision:** if integrity check fails, the app is **suspended** (per the quarantine flow below) — not silently removed. The user sees the failure and chooses next action.

### 2. Update-time delta validation

When an update is fetched (per the manifest URL flow in 14):

> **Decision:** the shell validates **all** of the following before installing an update:
> - Same package id as the installed version.
> - Signature verifies against the installed publisher key, OR a valid rotation record bridges to a new key.
> - Update version is strictly greater than installed (no downgrades by default; user can opt into downgrade with explicit acknowledgment).
> - Manifest-declared capabilities don't escalate beyond what's currently granted without re-prompting the user.
> - Bundle SHA-256 matches the catalog-advertised hash (catches MITM at delivery time).
> - Update-frequency rate-limit not exceeded (default: max 1 update / 24 hours per app).

If any validation fails, the update is refused with a specific reason logged to audit and surfaced to the user.

> **Decision:** capability *escalation* — the new manifest requests a capability not in the previously-granted set — always triggers a user re-consent dialog. Capability *reduction* (removal) is silent.

> **Open:** what's the policy when the catalog-advertised hash mismatches the local download? Options: (a) refuse, surface error (default); (b) refuse and report to the catalog (for catalog-side anomaly tracking, with telemetry opt-in). Tracked as OQ-130.

### 3. Threat-intel feed (the Chrome killbit equivalent)

> **Decision:** every catalog publishes a **threat-intel feed** — a signed, append-mostly list of `(packageId, publisherKey, severity, reason, advisedAction)` records. Shells subscribed to a catalog poll its threat-intel feed periodically (default: every 6 hours) and react to new entries.

Feed entry shape:

```jsonc
{
  "id": "ti_2026_5_10_001",
  "packageId": "io.example.bad-app",
  "publisherKey": "ed25519:abc...",
  "severity": "critical" | "high" | "medium" | "low",
  "reason": "compromised-publisher-key" | "malicious-behavior" | "sandbox-escape-attempt" | "data-exfiltration" | "deprecated" | "...",
  "discoveredAt": 1700000000000,
  "advisedAction": "uninstall" | "suspend" | "warn" | "info",
  "details": "Human-readable explanation linked from the catalog UI",
  "signature": "..."
}
```

Feed signature uses a **separate root key** from the catalog's normal listing operations — so a compromise of the catalog's day-to-day infrastructure doesn't grant the ability to publish forged threat-intel records (or unflag legitimately-flagged apps).

> **Decision:** the threat-intel feed signing key is **rotated rarely** (target: every 2 years) and stored offline / in HSM. Compromise of the listing-key infrastructure doesn't compromise the killbit channel.

User behavior on receiving a flagged-app entry depends on `advisedAction`:

| advisedAction | Default shell behavior                                                  |
|---------------|--------------------------------------------------------------------------|
| `uninstall`   | App is **suspended** immediately; user prompted: "Uninstall (recommended), keep with risk acknowledged, or wait for a fix?" |
| `suspend`     | App is suspended; user prompted similarly but uninstall is not recommended (the issue may be fixable). |
| `warn`        | Notification banner; app continues running. User can review and decide. |
| `info`        | Quiet notification surfaced in the app store / settings; informational.  |

> **Decision:** auto-quarantine (suspend without explicit user action) is the default for `critical` severity. The user is **always notified**; never silent.

> **Open:** users can "ignore" a flagged app — should we surface that ignored state prominently in settings to avoid forgotten ignores? Yes, leaning. Tracked as OQ-131.

### 4. Behavioral telemetry (opt-in)

The shell already keeps a **per-app audit log** (per [09-security-and-sandbox.md](../security/09-security-and-sandbox.md)) of capability grants, host-service calls, anomalies. Behavioral telemetry extends this with optional aggregation:

> **Decision:** behavioral telemetry is **opt-in per vault**, default off. When enabled, anomaly summaries (not raw audit-log content) can be sent to a chosen catalog's anomaly-detection endpoint. Format: anonymized counts of capability denials, sandbox-escape-attempt-shaped events, IPC-rate spikes — never user content, never entity ids.

Use cases:
- A user opts in; their device contributes to "this app is exhibiting weird behavior on N% of installs" signals.
- The catalog aggregates and may issue threat-intel records based on patterns.
- Privacy posture is preserved: telemetry is never default-on, and sensitive paths (sync transport content, AI prompt content) are never surfaced.

> **Decision:** the user **never** opts into telemetry on a per-app basis silently. Telemetry is a top-level vault setting; enabling it is a deliberate UX moment.

### 5. App-impersonation detection

A common attack pattern: publish a malicious app under a name similar to a popular legit app (`io.example.notes` vs `io.example.notess`).

> **Decision:** at install time, the shell does **fuzzy name + similar-purpose detection** against:
> - Apps already installed in this vault.
> - The official catalog's listed apps (cached locally).
>
> If a similar-named or similar-purposed app exists with a *different publisher key*, the shell warns explicitly: "This app's name is similar to {existing app}, but it has a different publisher. Continue?"

The shell also publishes the publisher key fingerprint at the install confirmation — comparing fingerprints is the user's last line of defense.

> **Open:** how aggressive should fuzzy detection be? Levenshtein distance, n-gram, embedding similarity? Pick one. Tracked as OQ-132.

## Quarantine flow

When an installed app is flagged:

```
   [Threat-intel feed delivers a record for app X]
                │
                ▼
   [Shell suspends app X]
                │
                ▼
   [User notified]                         (top-banner + optional OS notification)
                │
                ▼
   ┌────────────┴────────────┐
   │  User chooses:           │
   │  • Uninstall (data kept) │
   │  • Keep, acknowledge risk│
   │  • Wait for developer fix│
   └─────────────────────────┘
                │
                ▼
   [If "Wait":]
     - App stays suspended
     - Shell polls catalog for an update or threat-intel reversal
     - When update arrives, integrity-checks per usual; if good, re-enables
```

> **Decision:** "Uninstall" preserves the app's **data** (entities, attachments, app-private storage). The app's bundle and capability grants are removed; data lives until the user explicitly deletes it. This matches the uninstall flow in [03-app-model.md](03-app-model.md).

> **Decision:** "Keep with risk acknowledged" requires typing the app's name to confirm — friction proportional to risk level. The choice is logged in audit; the shell can surface "you are running 3 risk-acknowledged apps" reminders weekly.

> **Decision:** the user can re-suspend a kept-with-risk app at any time from settings. Reversing "Keep" is one click; reversing "Uninstall" is reinstall.

## Federated trust

> **Decision:** users can subscribe to **multiple catalogs**, each with its own threat-intel feed. The shell treats threat-intel records as **OR-combined**: if any subscribed catalog flags an app, that flag applies. There is no "majority vote" or "weighted trust"; one catalog flagging is enough to surface to the user.

Use cases:
- Default Brainstorm catalog publishes its own threat intel.
- Industry-specific audit catalog (e.g. "open-source-only verified", "privacy-respecting verified") publishes additional flags.
- Org-internal catalog flags apps that aren't compatible with org's compliance.

The user can unsubscribe from catalogs they don't trust; their threat-intel records stop applying.

> **Decision:** Brainstorm's hosted catalog provides threat intel for apps it has listed *and for any app the catalog has been informed about*. Sideloaded apps (per [14-app-store.md](14-app-store.md) sideload flow) are still subject to threat-intel records keyed on `packageId` + `publisherKey` — even if the user installed via direct URL, threat intel applies.

## Capability surface

New capabilities for the shell-internal layer (apps don't request these):

- The shell internally has `threat-intel.poll` (always on, configurable interval) and `threat-intel.act` (suspend / warn).
- The user has settings to:
  - Subscribe / unsubscribe catalogs.
  - View flagged apps.
  - Override a flag (acknowledge risk).
  - Adjust polling interval and aggressiveness.

## Performance and footprint

| Concern                                       | Cost                                                           |
|-----------------------------------------------|----------------------------------------------------------------|
| Bundle hash verification on launch             | <5ms for typical bundle                                         |
| Threat-intel feed poll                         | Small JSON; <50KB per catalog per day; cached                   |
| Audit log write per flagged-app event          | Low                                                             |
| Telemetry aggregation (when opted in)          | Bounded; summarized, not raw                                    |

> **Decision:** threat-intel polling defaults to every 6 hours; user-configurable from 1 hour to 24 hours. More frequent polling for `critical`-severity-prone apps if the catalog signals high alert state.

## What this is **not**

- **Not centralized control.** The user can override every flag. Brainstorm's hosted catalog is one trust source among many.
- **Not "phone home" telemetry.** Behavioral telemetry is strictly opt-in and anonymized.
- **Not silent enforcement.** Every action that affects the user's installed apps is surfaced — no quiet removals, no quiet downgrades.
- **Not a virus scanner.** We don't run signature-based malware scanning on bundles. Sandbox + capability-based threat model is the safety guarantee; threat-intel is the public-knowledge layer.

## Cross-doc updates needed

- [14-app-store.md](14-app-store.md) — link to this doc; the threat-intel feed is mentioned in passing in 14's "Threats and mitigations" section.
- [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) — extend threat model with the post-install verification surface.
- [26-shell-as-framework.md](26-shell-as-framework.md) — dev-mode apps don't have threat-intel coverage (the user authoring is the trust source); make explicit.
- [25-settings.md](../shell/25-settings.md) — add Settings → Apps → Threat Intel panel.

## Phasing

| Capability                                       | v1   | v2  |
|--------------------------------------------------|------|-----|
| Bundle hash on install                           | ✓    | ✓   |
| Runtime bundle integrity verification            | ✓    | ✓   |
| Update-time delta validation                     | ✓    | ✓   |
| Capability escalation re-consent                 | ✓    | ✓   |
| Threat-intel feed (signed)                       | ✓    | ✓   |
| Threat-intel poll subscription                    | ✓    | ✓   |
| Quarantine flow (suspend / keep / uninstall)      | ✓    | ✓   |
| App-impersonation detection at install           | ✓    | ✓   |
| Federated multi-catalog trust                    | ✓    | ✓   |
| Behavioral telemetry (opt-in, anonymized)        | —    | ✓   |
| AI-assisted threat-intel record drafting        | —    | ✓   |
| Cross-vault threat-intel state sharing           | —    | ✓ (post-OQ-109) |
| Reputation signals (install / review counts)     | —    | ✓ (catalog feature, not shell feature) |

## Open questions

These are added to [11-open-questions.md](../reference/11-open-questions.md):

- **OQ-130** — catalog-advertised hash mismatch policy (refuse only vs refuse + report-to-catalog).
- **OQ-131** — surface "ignored flagged apps" prominently in settings to avoid forgotten ignores.
- **OQ-132** — fuzzy-name app-impersonation algorithm (Levenshtein, n-gram, or embedding similarity).
- **OQ-133** — telemetry default surface — never default-on, but should the first-run flow ask?

## Summary

- **Five mechanisms** beyond signing-and-install:
  1. Runtime bundle integrity verification (every launch).
  2. Update-time delta validation (capability + signature + hash + downgrade refused).
  3. Threat-intel feed (signed, federated, killbit-style).
  4. Behavioral telemetry (opt-in, anonymized, off by default).
  5. App-impersonation detection at install.
- **Quarantine flow** suspends rather than silently uninstalls; user sees, decides, can override with friction proportional to risk.
- **Federated trust** — users subscribe to multiple catalogs; OR-combined flagging.
- **The sandbox is still the safety guarantee** — these mechanisms are the *trust update* layer, not a replacement for the sandbox.
- v1 ships everything except behavioral telemetry; telemetry arrives in v2 with explicit user opt-in.
