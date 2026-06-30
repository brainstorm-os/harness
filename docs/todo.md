I've spent a lot of time in note/PKM tools, and the thing that always got me is that they're one big editor with plugins — a single document model everything has to extend. Every time I wanted a new kind of thing, it had to become a first-class concept in the core, and the core just kept growing.

So I tried the opposite. This is a desktop shell that knows nothing about meaning — there's no built-in "page" or "task" or "note". It just hosts apps: launches them, gives them a window, persists and syncs their state, and gets out of the way. The actual concepts live inside small sandboxed apps, and they talk to each other through Block Protocol instead of sharing internals.

Right now there are about 20 of these apps sharing one SDK — notes, a database, files, a PDF viewer, calendar, a graph view, code editor, browser, and so on. Everything is local-first: each doc is a Yjs CRDT, offline works, and sync is something you add rather than something you depend on. There's end-to-end encrypted sync across your own devices over a relay that never sees plaintext. 

It's single-user for now; sharing with other people is the next big piece. Builds for macOS, Windows, and Linux are on the Releases page.

Mostly I built it to get out of my own way, and at this point it more or less builds itself. The part I'm least sure about is the central bet: shoving all the meaning out of the shell and into apps that speak a shared protocol. I'd genuinely like to know whether that holds up or whether it just moves the coupling somewhere I can't see yet.