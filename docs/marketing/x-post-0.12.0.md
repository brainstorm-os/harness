# X / Twitter: 0.12.0

Owner rules applied: two hashtags, no em-dashes anywhere, first person singular,
capability-led. Link goes in the first reply, media native. See
`x-post-blog.md` for the reasoning on the tag choice.

> **Do not post until** the release is published on GitHub, the site shows the
> 0.12.0 entry (it does not auto-deploy from main, so run `vercel deploy --prod`
> and check the live page), and the downloads page lists the real asset URLs.

## What is actually true (keep the copy inside this)

- An app is `manifest.json` + `index.html`. No bundler, no package.json, no
  compile step. This was already true; what is new is being able to act on it
  from inside the product.
- Install as app works from selected vault code files, from a folder on disk,
  and from a `.brainstorm` bundle.
- The agent drafts the files as cards you approve. Nothing is written before you
  approve.
- Installed-this-way apps are unsigned, marked as such, held to the sideloaded
  trust tier.
- Shared objects show member names, with the key fingerprint beside them.
- **Do NOT claim LAN sync.** Two paired machines admit each other now, but
  nothing converges over that link yet (F-474). The 0.11.0 post already claimed
  LAN sync early once; do not repeat it.

## FINAL

You can build an app inside Brainstorm now and install it into your own vault.

An app here is two files, a manifest and an index.html. No bundler, no compile
step. Write them in the Code editor, hit Install as app, and it is on your
dashboard. Or ask the agent to write them and approve the result.

Shared objects also show people by name now instead of a public key.

#localfirst #buildinpublic

## First reply

Release notes and downloads: getbrainstorm.online/blog

## Alternative, shorter

Brainstorm 0.12.0: write an app in the built-in editor, install it into your
vault, no build step and no terminal.

An app is a manifest and an index.html. That is the whole format. The agent can
draft both for you and you approve them before anything is saved.

#localfirst #buildinpublic

## Notes

- The hook is "build an app inside the thing", because that is the part no other
  local-first tool can do and it is genuinely new in this release.
- Resist adding the security detail to the post. It reads as defensive. It is in
  the release notes for the people who go looking.
- Pair with a screen recording of the two-file app going from editor to
  dashboard. That single clip is the whole argument.
