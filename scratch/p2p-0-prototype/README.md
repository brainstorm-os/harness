# `P2P-0` throwaway prototype

Evidence for [docs/platform/79-p2p-sync.md](../../docs/platform/79-p2p-sync.md) §2. **Not product code, never merged into the shell.** It exists so the spike reports measurements rather than assertions.

Run with `bun add bonjour-service ws` then plain `node`, on a real LAN interface (not loopback):

| script | what it answers |
|---|---|
| `host.mjs` | advertises `_brainstorm-sync._tcp`, binds a WebSocket listener on the LAN interface, runs an admission-shaped handshake (X25519 + HKDF + ChaCha20-Poly1305 standing in for the shipped RFC 9180 HPKE, plus Ed25519 both directions) |
| `peer.mjs` | browses, dials the discovered address, completes the handshake; reports discovery, connect, handshake and end-to-end timings |
| `lan-survey.mjs` | is multicast actually propagating between *different* machines on this network |
| `staleness.mjs` | what a vanishing peer looks like: goes-away detection, dialing a cached dead address, rediscovery after a restart on a new port |
| `frozen-peer.mjs` | the sleep case: `SIGSTOP` the host so the socket stays open with no RST, and measure what notices |

Cross-check the advert against the platform responder with `dns-sd -B _brainstorm-sync._tcp local` on macOS.

Headline numbers are in [79 §2](../../docs/platform/79-p2p-sync.md), along with what was **not** tested (Windows, Linux, two real shells, a real suspend/resume, filtered networks).
