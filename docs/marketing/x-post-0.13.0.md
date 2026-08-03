# X / Twitter: 0.13.0

Owner rules applied: two hashtags, no em-dashes anywhere, first person singular,
capability-led. Link goes in the first reply, media native. See
`x-post-blog.md` for the reasoning on the tag choice.

> **Do not post until** the release is published on GitHub (it is: v0.13.0), the
> site shows the 0.13.0 entry (site #84 must be merged AND `vercel deploy --prod`
> run from main, because merging only builds a Preview), and the downloads page
> lists the real asset URLs.

## What is actually true (keep the copy inside this)

- An agent appears in Settings then Team next to the people, with a name and a
  face. Not in a separate AI section.
- It holds permissions from the same list a person holds, per entity type, and
  you can revoke them.
- Mention it with @ in a Chat channel and it answers in the thread with the
  vault as context.
- It proposes, you approve. Nothing is written to the vault before you approve.
- One agent can delegate to another; the second runs with the intersection of
  both sets of permissions, never more.
- An agent can be the assignee of an automation and runs when it fires.
- Settings then AI has an Agent activity panel: every run, every tool call,
  every refusal, filterable.
- Apps publish typed actions other apps discover and call. They appear in an
  object's overflow menu, the editor's slash menu, as an automation step, and to
  the agent. You are asked before the first run and re-asked if the app changes
  what the action does.
- Porcelain (flat paper white) and Graphite (its charcoal dark twin).
- Twenty-app design pass.
- Journal: text typed the instant you open a new day is now saved.
- **Do NOT claim LAN sync or multi-device sync.** Neither converges yet (F-474,
  and the 10.3b producer was never built). The 0.11.0 post claimed LAN sync
  early once already. Do not repeat it.
- **Do NOT claim the Journal fix repairs old damage.** It does not. Days damaged
  before 0.13.0 stay blank and the content is gone (F-491). This belongs in the
  blog and the release notes, not in the post, but never contradict it.

## FINAL

Most products bolt an assistant onto the side. A box in the corner with a master
key and no permissions anyone wrote down.

In Brainstorm an agent is a member of your vault. It shows up in your team list
with a name, it holds permissions from the same list a person holds, and you can
see every run, every tool call and every refusal it made.

It proposes. You approve.

#localfirst #buildinpublic

## First reply

Release notes and downloads: getbrainstorm.online/blog

## Alternative, shorter

Brainstorm 0.13.0: an agent is now a member of your vault, not a panel bolted
onto the side.

Same permission list a person gets. Mention it with @ in a channel. It proposes
and you approve, and there is a log of every run, call and refusal.

#localfirst #buildinpublic

## Notes

- The hook is the framing, not the feature list. "A member, not a feature" is
  the whole argument and every other product is the contrast, so the first two
  lines do the work.
- Resist listing app tools in the same post. It is the more technically
  interesting half of the release but it needs a paragraph to land, and a post
  that tries to carry both lands neither. It is the natural follow-up post,
  ideally with a clip of an action defined in one app being run from another.
- Pair with a screen recording of the Team list showing an agent beside the
  people, then the activity panel scrolling. The refusals column is the detail
  that makes people look twice.
- The Journal caveat is deliberately absent here and deliberately present in the
  blog post. A post is not the place to explain unrecoverable data loss, but if
  anyone asks in replies, answer plainly and link the blog.
