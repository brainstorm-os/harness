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
- **Tags exist in frontmatter and render on a post page as a meta line, but there
  is no tag browsing or tag filtering.** Do not claim "browse by tag" until that
  ships.

## Option A: the writing angle (recommended)

There is a blog on getbrainstorm.online now.

One feed with the articles, every release since 0.5, and the demo videos, so you can
see what actually shipped in a month in one scroll. RSS if you prefer that.

I rewrote every post by hand before publishing. No em-dashes, no "it's not X, it's Y",
no dramatic one-line paragraphs. If you have been reading AI-written developer blogs
lately you know the tics I mean, and stripping them out was most of the work.

## Option B: the capability angle

New on getbrainstorm.online: a blog.

It is one feed of articles, releases and videos instead of three separate pages, so a
month of work reads in one scroll. There is an RSS feed.

The posts are about what you can actually do: attachments that follow your vault across
machines, mail accounts that start workflows, an agent that drafts objects you approve
before anything is saved, and how an app in Brainstorm can be two files.

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
