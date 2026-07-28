# X / Twitter — Brainstorm 0.11.0 "Bytes everywhere, fast"

Human voice, first person. The headline is the one users have been quietly
burned by everywhere: attachments that don't follow you. Keep the "thumbnails
instantly, full file on demand" pairing — it's the whole design in one line.
Don't re-headline LAN sync (we claimed the wifi story in the 0.9.1 post);
this release's honest LAN news is the sharing fix. Two framings — pick one.

---

## Option A — the attachment story (recommended)

Brainstorm 0.11.0 is out. This one's about your files.

Until now, the images and files you attached lived only on the device where you
added them — sync moved your notes, not your bytes. Now attachments follow your
vault: thumbnails are always there so previews show up instantly, and the full
file downloads the moment you actually open it. Nothing to manage, nothing
hogging your disk.

Still end-to-end encrypted the whole way — the relay stores sealed chunks it
can't read, addressed by hashes it can't reverse.

Also in here:
– the Browser got a reader mode, and "Save to vault" now keeps the article, not just the link
– apps badge their icons: unread chats, agent approvals waiting, failed automations
– every single app now speaks Spanish, German, French, Italian & Portuguese
– fixed: sharing over a self-hosted relay silently never delivered the keys. It does now.

All local, your keys, no cloud required. Free beta, Mac/Windows/Linux:
getbrainstorm.online

---

## Option B — shorter, punchier

Brainstorm 0.11.0: your attachments finally travel with you.

Add an image on your laptop, open the note on your desktop — the preview is
already there, the full file arrives when you click it. Lazy where it saves you
disk, eager where it saves you waiting. End-to-end encrypted both ways; the
relay only ever sees sealed chunks.

Plus: a reader mode in the Browser, app icons that tell you what needs you
(unread chats, waiting approvals, failed runs), and the whole suite in five
languages.

All local, your keys, no cloud. getbrainstorm.online

---

## Thread version (if you want to stretch it)

**1/** Brainstorm 0.11.0 is out. The theme: bytes everywhere, fast — your
attachments now follow your vault across devices.

**2/** The design: thumbnails are *always* synced, so every preview is instant.
The full file stays lazy — it downloads the moment you open it, not before.
Fast where you look, light where you don't.

**3/** Encryption doesn't take a day off for this: files are chunked and sealed
per-attachment before they leave your device. The relay stores ciphertext
addressed by hashes — it can't read a byte, and it can't tell two users'
identical files apart.

**4/** The Web Browser learned reader mode (Cmd/Ctrl+Shift+R): any article,
stripped to clean text. And "Save to vault" now captures the readable content
with it — the bookmark keeps the words, not just the URL.

**5/** Your dashboard now tells you where you're needed: Chat badges unread
messages, the Agent badges proposals waiting for your approval, Automations
badges failed runs. One combined count on the dock.

**6/** And the whole suite — all twenty apps — now speaks Spanish, German,
French, Italian, and Portuguese. Switch once in Settings, everything follows.

**7/** All local, your keys, no cloud required. Free beta, Mac/Windows/Linux:
getbrainstorm.online

---

## Notes
- The encryption line ("sealed chunks, hashes it can't reverse") is accurate to
  the implementation (per-asset DEKs, ciphertext-addressed CAS, relay-blind) —
  safe to say plainly; don't soften it into vague "encrypted" marketing-speak.
- The sharing fix in Option A is deliberately candid (same instinct as the 0.9.1
  post): "silently never delivered the keys" names a real bug we fixed the day
  we found it — that candor lands well with the local-first crowd.
- If pairing with media: the reader-mode before/after or a two-device
  thumbnail-appears clip would carry this better than a static screenshot; the
  promo pipeline's capture specs can produce the latter against two seeded
  vaults (see tests/dogfood/collab).
- Not mentioned on purpose: webhook connectors (developer-facing; save for a
  changelog-adjacent dev post), Anytype import fidelity (was in the 0.5.x
  story), LAN sync (claimed in 0.9.1 — re-headlining it reads like we shipped
  it twice).
