The one-line difference

  Notion, Obsidian, and Anytype each nailed one axis. Brainstorm is the only one combining all three: local-first + encrypted data, apps that share one typed graph through an open standard, and AI agents as governed first-class citizens. None of the three can add the missing axes without rebuilding from the data model up.

  Head-to-head

  vs. Notion — Notion is cloud-first, account-required, and its AI is a chat bolt-on with no user control over what data the model sees. Brainstorm is local-first and end-to-end encrypted, and
  agents act through a capability-gated sandbox on data you own. Notion can't match this without re-architecting auth + storage; their data model assumes cloud routing.

  vs. Obsidian — Obsidian got local-first right but is single-user markdown + plugins with no shared schema. Each plugin is its own island; there's no typed entity graph two plugins agree on.
  Brainstorm's apps share one graph natively via Block Protocol, plus real multi-device CRDT sync (Yjs) and governed agents.

  vs. Anytype (your own house) — closest peer: local-first, encrypted, object-graph. Brainstorm's two deltas are (1) apps as first-class composable units, not an object model with views — a real
  sandboxed-app platform with an SDK and capability ledger, and (2) agent governance built into the foundation — the same ledger that isolates apps lets agents act on your private graph with a scoped, auditable, revocable trail. Anytype would have to add a process/capability model it doesn't have today.

  The moat

  The doc states it as "ecosystem lock-in without data lock-in" — three layers:

  1. Agent governance as infrastructure, not a feature. The capability ledger isn't a permissions UI bolted on later — it's the same primitive that sandboxes apps. Agents are just another
  principal with scoped, revocable, audited caps. Incumbents treat agents as a UI layer; matching this means rebuilding their trust model.
  2. Interop via an open standard (Block Protocol), not a proprietary schema. Switching the shell is cheap for users (data is portable) — but building a third Block-Protocol app is expensive, so
  apps accumulate around the platform. Stickiness lives in the ecosystem, not in trapping your data.
  3. A segment incumbents structurally can't serve: orgs that can't send operational data to a third-party model — regulated, sovereignty-sensitive, IP-paranoid teams that still want agents doing
  real work. The claim no cloud incumbent can make: encrypted data + on-device agents + capability audit trail.