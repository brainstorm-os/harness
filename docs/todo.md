Hi HN, I've been building Brainstorm, a knowledge-management tool modeled as a small desktop operating system rather than a single monolithic app.

The core idea: instead of one editor that owns your notes, Brainstorm is an Electron shell that hosts sandboxed apps - Notes, Database, Calendar, Graph, Whiteboard, Browser, Mailbox, and more - that all read and write the same local data. Apps are isolated from each other behind a capability ledger and an IPC broker, so a misbehaving or untrusted app can't reach data it wasn't granted.

What it's built on:

- Block Protocol for data interop, so blocks and entity types are portable across apps instead of locked into one tool.
- Yjs (CRDTs) for the data layer, so editing is conflict-free and ready for multi-device sync.
- Lexical for rich text.

Everything is local-first. Your vault is four SQLite databases plus a snapshot+tail file format for the CRDT state, all on your own disk. There's no server in the loop for normal use, and the identity keys never leave the machine.

A few things I'm happy with:

- The security model is fail-closed: any error in a capability check returns unavailable, never access.
- Every app is a real React app over a shared SDK and design system, so the whole thing feels like one product rather than a pile of plugins.
- It's signed and notarized on macOS, Windows, and Linux, with in-app auto-update.

It's a public beta (v0.1.5) - downloads are on GitHub Releases. Still rough in places, and I'd genuinely like feedback on the app-sandbox model and whether the OS framing makes sense to people, or just adds friction.

Happy to answer anything about the architecture, the CRDT storage format, or the capability/IPC design.