# X / Twitter — Build-apps video (AppForge, rides toward 0.12.0)

Human voice, first person, same register as the release posts. Subject: the
finished VID-build-apps cut (1:32) — an app is two files, written in the
product's own code editor OR drafted by the agent, installed straight from the
vault, and still boxed by the capability ledger either way.

**Attach the video natively.** Upload
`tests/dogfood/.promo-build-apps/vid-build-apps-1080p.mp4` directly to the
post — 92s fits X's 2:20 limit, and native video massively out-reaches an
external YouTube link (X downranks outbound links in the main post). Put the
YouTube link in the **first reply**, not the post body, once the upload from
[`vid-build-apps-youtube.md`](vid-build-apps-youtube.md) is live.

**Hashtags are mandatory from now on** (owner rule 2026-07-30 — the untagged
release posts lost most of their reach). See the kit at the bottom; 2–3 tags
per post, never more.

---

## Option A — the two-files hook (recommended)

An app in Brainstorm is two files.

manifest.json says what it's allowed to touch. index.html talks to your vault.
No bundler, no npm install, no terminal — in this video both files are written
in Brainstorm's own code editor and installed straight out of the vault. Ninety
seconds later it's a live, sandboxed app reading real data.

Or skip the typing: the agent drafts the same two files. Nothing lands in your
vault until you approve — and however the code got written, the installed app
still only sees what it was granted. Asking for more comes back refused.

Free beta, Mac/Windows/Linux: getbrainstorm.online

#localfirst #buildinpublic #AIagents

---

## Option B — the agent-first hook

I asked the agent inside my note-taking OS to write me an app. It drafted two
files — a manifest and a page — I approved them into my vault, and installed
the app from there. No terminal ever appeared, because no build step exists in
that path.

The part I care about: the agent can't save a byte without my approval, and the
finished app is held by the same capability ledger as every built-in one. It
declared what it wanted up front; everything else is refused.

Watch it happen in 90 seconds 👇

Free beta, Mac/Windows/Linux: getbrainstorm.online

#AIagents #localfirst #buildinpublic

---

## First reply (either option)

Full version with chapters on YouTube: <youtube-link>

The long-form write-up — the app model, what the agent actually sees of your
vault, and why the permission ledger doesn't care who wrote the code:
getbrainstorm.online/blog/an-app-is-two-files

The shell is source-available (AGPL) on GitHub, and the whole thing runs local —
your keys, no cloud required.

*(The article ships with site PR #65 — deploy the site to prod before posting
the reply; `vercel deploy --prod` from site main, per the release memory.)*

---

## Hashtag kit (standing — every future post)

Rule: **2–3 hashtags per post.** One core + one or two topical. More than three
reads as spam and measurably hurts reach; zero is what tanked the release-post
visibility (posts through v0.11.0 carried none).

- **Core (pick one, always present):** `#localfirst` · `#buildinpublic` · `#PKM`
- **Topical (pick 1–2 to match the post's subject):**
  - agent / AI features → `#AIagents` · `#AI`
  - privacy / crypto features → `#encryption` · `#privacy`
  - release announcements → `#opensource` (AGPL shell) · `#indiedev`
  - notes / knowledge features → `#notetaking` · `#knowledgemanagement`

Placement: end of the post, own line. Don't hashtag mid-sentence words.

## Notes

- Everything claimed is real and merged: AppForge-1 (install from folder /
  `.brainstorm` file, shell #364), AppForge-2 (install from vault code files,
  #366), AppForge-3 (agent propose-code-file, #365), demo-agent drafting a
  real second app (#374). The video's real-vs-scripted table is in
  [`vid-build-apps.md`](vid-build-apps.md).
- "Refused, in the broker's own words" (scene 08) is the capability wall —
  safe to state plainly; it's the fail-closed broker, not marketing-speak.
- Don't say "app store" or "marketplace" — that's v2 (`14.x`); this is
  install-from-your-own-vault.
- This post is feature marketing between releases; the next *release* post is
  the 0.12.0 cut ("Share for real"), and it carries tags per the kit above.
