# X / Twitter: the blog

Announcing the blog at [getbrainstorm.online/blog](https://getbrainstorm.online/blog).
First person singular, plain, no drama. **No em-dashes** (owner rule, 2026-07-30):
the tic is the rhetorical pause, so swapping in a hyphen does not count.

> **⚠️ Do not post until the blog is live.** It depends on site PRs **#67** (the
> capability-led rewrite of all six posts) and **#68** (the unified feed, tags,
> videos, RSS) being merged, **and** on someone running `vercel deploy --prod`
> from `main` afterwards, because production does not auto-deploy. Check
> `getbrainstorm.online/blog` renders the timeline before posting.

## What is actually true (keep the copy inside this)

- One reverse-chronological feed at `/blog`, grouped by month: **34 entries** at
  launch: 2 essays, 4 capability articles, 29 releases, 3 videos.
- Filter chips (Everything / Articles / Releases / Videos), CSS-only, work with
  JavaScript disabled.
- RSS at `/blog/rss.xml`, all entries.
- Every post rewritten by hand: capability-led, positive, no em-dashes, none of
  the AI constructions.
- **Tag browsing is being built** so the "browse by tag" line above is true at
  post time. It rides a PR stacked on the feed work. Verify tag pages resolve on
  the live site before posting; if they are not live, drop that clause and say
  "subscribe over RSS" instead.

## Option A: alternative (not picked)

There is a blog on getbrainstorm.online now.

One feed with the articles, every release since 0.5, and the demo videos, so a month of
work reads in one scroll. RSS if you prefer that.

The posts are about what you can actually do: attachments that follow your vault between
machines, mail accounts that start workflows, and an agent that drafts contacts and tasks
you approve before anything is saved.

### Why the writing angle was cut

An earlier draft ended by announcing that the posts were written by hand with no
em-dashes and no AI tics. It was the worst paragraph in the file. It had a list of three,
a knowing aside to the reader, and a closing line that reframed the paragraph above it,
which are three of the habits it claimed to have removed. Beyond that, saying you write
like a person is something only someone very online about AI would say, and it invites
every reader to grade the prose instead of reading it. Write plainly and let people
notice on their own.

## FINAL (owner pick 2026-07-30)

New on getbrainstorm.online: a blog.

It is one feed of articles, releases and videos instead of three separate pages, so a
month of work reads in one scroll. Browse by tag, or subscribe over RSS.

The posts are about what you can actually do: attachments that follow your vault across
machines, mail accounts that start workflows, an agent that drafts objects you approve
before anything is saved, and how an app in Brainstorm can be two files.

#localfirst #buildinpublic

### Hashtags

Two is the ceiling. X suppresses reach on posts that look tagged for discovery, and
three or more reads as marketing rather than as a person posting.

- `#localfirst` is the one that matters. It is a small, real community and it is exactly
  the audience for a vault you own on a machine you own.
- `#buildinpublic` reaches solo founders, who are the people most likely to care that one
  person wrote all of this.
- Considered and rejected: `#AI` and `#productivity` are too noisy to return anyone, and
  `#PKM` skews toward Obsidian and Notion switchers who will be better served by a post
  about import rather than about a blog.
- If you want only one, use `#localfirst`.

## Option C: short

Brainstorm has a blog now: getbrainstorm.online/blog

Articles, every release, and the demo videos in one timeline. RSS included. Written by
a person, which these days is apparently a feature.

## Thread version

**1/** Brainstorm has a blog now. getbrainstorm.online/blog

**2/** It is one timeline instead of three pages. Articles, every release since 0.5, and
the demo videos, newest first, grouped by month. You can filter to one kind, and it works
with JavaScript off.

**3/** The posts are about capabilities rather than changelogs. Attachments that follow
your vault. Mail accounts that start workflows. An agent that drafts contacts, tasks and
events as cards you approve before anything is written.

**4/** I rewrote all of them by hand first. No em-dashes, no "not X but Y", no one-line
paragraphs doing rhetorical work. The tics are easy to produce and tiring to read.

**5/** RSS at getbrainstorm.online/blog/rss.xml if you would rather not visit a website.

## Notes

- Option A performs best with a developer audience, because the anti-AI-prose angle is a
  real shared complaint and the post demonstrates the claim by being written that way.
  Option B is better if the goal is product discovery rather than engagement.
- Do not say "we". Brainstorm is one person, and the blog now says so in every byline.
- Do not claim tag browsing (see above). If tag pages ship first, Option A gains a line:
  "browsable by topic".
- Pair with a screenshot of the timeline showing July, where the density is the argument.
