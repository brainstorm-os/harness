# 46 — Marketing and promotion

This doc is the **demand-side counterpart to [43-monetisation-strategy.md](43-monetisation-strategy.md)**. Monetisation says what we charge for and why; this doc says how the product reaches the people who should use it, what we tell them, where we tell them, and what we refuse to do to get attention.

Audience, channels, and messaging only — not pricing copy. Concrete launch dates and per-channel spend are operational and live outside the design docs; this doc fixes the **strategy**, **posture**, and **shape** of the marketing surface so that operational decisions stay coherent.

## Principles

Non-negotiable. Everything below derives from them.

1. **Marketing is product.** The first thing a prospective user touches is marketing. The product is the second. They must say the same thing. A landing-page promise the product doesn't deliver is a bug filed against marketing. A product capability the landing page hides is a bug filed against marketing.
2. **No dark patterns at the funnel either.** [43 §What we charge for](43-monetisation-strategy.md) commits to no dark patterns inside the product. The same standard applies upstream: no countdown timers, no "1,247 people viewing this", no false scarcity, no email-or-leave gates, no "free forever — credit card required" trial dishonesty, no opt-out-by-default newsletter signups, no GDPR-malicious cookie banners.
3. **The free product is the marketing.** [01 §Principle 6](../foundations/01-vision.md) — boring where possible. The strongest claim we can make is "install it, it works, your data stays yours." Every channel optimises for getting the user to that experience, not for capturing them in a funnel before they get there.
4. **Tell the truth about the competition.** Other knowledge tools are brilliant at different things — cloud collaboration, single-user markdown editing, local-first object graphs. We compete by being a *different shape* (OS-shell, app-hosted), not by lying about theirs. Comparison content cites strengths *and* weaknesses on both sides. Honest comparisons rank well on search precisely because most competitor content is sales-shaped.
5. **No content monetisation in marketing channels either.** No sponsored placements inside our docs, blog, or community. No affiliate links pointing at third-party tools whose only qualification is they pay us. No newsletter-with-ads. Marketing channels are marketing channels; they do not become a second revenue line.
6. **Marketing speaks like a contributor, not a marketer.** Every public-facing piece of writing — landing, blog, social, changelog — uses the same voice and vocabulary as the design docs. No "synergise," no "unlock your productivity," no "10x your second brain." Plain English; concrete claims; named tradeoffs. If a sentence wouldn't pass a code review for vagueness, it wouldn't pass marketing review either.
7. **Privacy by default in marketing analytics too.** [43 §What we explicitly do not monetise](43-monetisation-strategy.md) item 2 prohibits a third-party analytics SDK *in the shell*. The same rule applies to the landing page and docs: privacy-preserving server-side analytics only (Plausible / Umami / equivalent self-hosted), no Google Analytics, no Hotjar session recordings, no Facebook Pixel, no cross-site fingerprinting. The marketing surface respects the same threat model as the product.
8. **The user is not a "lead."** We do not buy intent data. We do not build shadow profiles of unsigned-up visitors. We do not retarget. The first time the user appears in our database is when they choose to be there — by creating an account, joining the community, or subscribing to the newsletter.

> **Decision:** marketing and promotion **inherit the product's privacy posture**. A user reading a Brainstorm comparison page leaves the same footprint as a user reading a Wikipedia article: server access logs, no client-side identifiers, no advertising-network beacons.

## Positioning

The single-sentence positioning we anchor every public claim to:

> **Brainstorm is the local-first OS for your knowledge work — install apps, own your data, never need an account.**

Three load-bearing words:

- **OS** — not "workspace," not "app," not "platform." OS communicates the right shape (host + apps, not a monolithic document) and the right expectation (apps are interchangeable, the shell is stable). Sets us apart from every competitor that positions as "the one tool".
- **Local-first** — the [Ink & Switch] term has enough industry recognition by now to do the heavy lifting. Communicates: works offline, your data is on your disk, sync is additive, no service can hold you hostage. Distinct from "private" (which has been laundered by too many products) and from "self-hosted" (which implies sysadmin work).
- **Apps** — communicates the open ecosystem from the first second. Sets up that this is composable, not a single application. Naturally addresses the "but how do I do X?" question — *with an app, the same way you'd add X to your phone*.

> **Decision:** the positioning sentence is **load-bearing copy**. It appears verbatim on the landing hero, the app store listing, the GitHub README, the Wikipedia page. Variants are allowed in long-form (blog, docs) but the canonical sentence is what we A/B against and what we measure recognition against.

### What we do not lead with

- **"X alternative."** Comparison framings cede positioning. We use comparison framing in *secondary* surfaces (per-product `/compare/<x>` pages) where the visitor already arrived with the comparison in mind, but we do not put it on the hero.
- **"Powered by AI."** AI is foundational ([01 §Principle 8](../foundations/01-vision.md), [22](22-ai-foundations.md)), not the headline. Lead with AI and we attract the AI-shaped audience that wants chat-and-agents and leaves when they discover the product is a shell. AI surfaces feature in the *capability tour*, not the hero.
- **"Block editor."** That puts us in the block-editor-replica bucket. We are not a block editor; we host one (Notes), among other things. Lead with the shell.
- **"Open source."** It is true, it matters, it appears in the second half of the page and prominently in the footer. But "open source" as a *headline* attracts a self-selecting audience (FOSS enthusiasts) and undersells to everyone else.
- **"For your second brain."** The PKM subculture is a real audience but a *narrow* one. Leading with PKM-coded language scopes the addressable user down to people who already use that vocabulary. We address that audience in dedicated landing pages; we do not let it write the homepage.

## Audience

Four primary segments. Each gets a distinct landing page, distinct messaging, distinct channels. The shell + apps are the same product; the *story* differs.

### Segment 1 — Alumni of prior local-first knowledge tools

Users currently or formerly on local-first object-graph products, plugin-extended markdown editors, outliner-style PKM tools, or cloud-databases-with-privacy-paranoia. They want local-first; they want a real data model; they have already walked away from a closed product once; they are willing to invest learning time for ownership.

- **Acquisition channels:** PKM-adjacent subreddits, communities of comparable products (we are not adversarial — many of us came from there), HackerNews, Lobsters.
- **Message:** "Brainstorm is the local-first knowledge product built by people who learned the lessons from a previous attempt in this space. Same ownership posture; different shape — the shell hosts apps, so adding a feature doesn't ripple across the whole product."
- **Proof point on the page:** the architecture docs are public. The competitive moat is the *shape*, not the secret. Reading [02-architecture.md](../foundations/02-architecture.md) before downloading is a *good* funnel signal.
- **Anti-pattern:** "We are X but better." We are not. We are different. Alumni walked away from a different product once; the way we earn their trust is by being honest about what we are and are not, not by claiming a victory.

### Segment 2 — Developer / power user

Engineers, designers, indie hackers, researchers, technical writers. The kind of person who reads CHANGELOG before INSTALL.md, who has opinions about CRDTs vs OT, who installs nightly builds.

- **Acquisition channels:** GitHub (releases, issues, discussions), HackerNews, lobste.rs, technical Twitter / Mastodon / Bluesky, podcast appearances on Changelog / Software Engineering Daily / Hacker News Recap.
- **Message:** "The shell is an Electron + IPC + capability-ledger host. Apps are sandboxed renderers. Yjs is the CRDT. SQLite + FTS5 is the store. Block Protocol is the interop. Here are the design docs. Here is the SDK. Build an app this weekend."
- **Proof point on the page:** a *real* "build your first app" tutorial — 20 minutes, ends with an installable bundle. The Code Editor app ([26-shell-as-framework.md](../apps/26-shell-as-framework.md)) is the centrepiece: "write apps inside the product you write apps for."
- **Anti-pattern:** "Designed for developers." Too narrow. The funnel for this segment is "respect their intelligence and they bring their colleagues." We message *to* them but the product isn't *for* them exclusively.

### Segment 3 — Privacy-conscious individual

Journalists, lawyers, therapists, researchers handling sensitive data, people in jurisdictions with adversarial regimes, people who simply do not want their notes scraped for training. They need a product they can use confidently *without* becoming a cryptographer.

- **Acquisition channels:** Privacy-focused publications (EFF DeepLinks, Privacy Guides, ProtonMail blog cross-promo where mutual), Mastodon `#privacy` / `#localfirst`, professional associations (e.g. ICIJ-style journalism networks), the digital-rights blog circuit.
- **Message:** "Your data stays on your disk. No account required. End-to-end encryption everywhere it's possible. The shell brokers AI so models never see what you don't authorise. We've documented the threat model — read it before you trust us."
- **Proof point on the page:** [09-security-and-sandbox.md](../security/09-security-and-sandbox.md) and [16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md) linked prominently. Independent security review summary (post-Stage-3b audit) linked when available. Concrete contrast against common knowledge tools on the privacy axis.
- **Anti-pattern:** crypto-maximalist messaging ("untraceable", "fully anonymous", "your data is *yours*"). Sounds like every shovelware privacy app. We use precise language because precise language is *less* common in this space and reads as more credible.

### Segment 4 — Small team / org early adopter

Startups, small agencies, research labs, university departments. 5–50 people. The team that's currently on a frankenstein of cloud workspace + project tracker + design tool + chat and feels the seams. Lands later in the funnel because Team / Enterprise plans ship in v2 ([43 §Phasing](43-monetisation-strategy.md)).

- **Acquisition channels:** professional networks (LinkedIn, regional founder communities, IndieHackers), warm intros from existing users, conference talks at engineering / design / research events. Eventually — paid search on very specific intent queries (self-hosted-team intent). Never display advertising.
- **Message:** "Server-readable spaces when you need shared search and AI; end-to-end-encrypted personal entities by default. SSO and audit when you grow. Move your vault to your own infrastructure when you outgrow ours."
- **Proof point on the page:** documented migration path from common prior knowledge tools ([45-import-export.md](45-import-export.md)). Self-hosting story is published, including the "what runs where, what costs what" honesty. The Enterprise pricing is public ([43 §Decision: no contact-sales-for-pricing](43-monetisation-strategy.md)).
- **Anti-pattern:** "Enterprise-ready" anything. Empty word. Use specifics — SSO via SAML/OIDC, SCIM provisioning, custom DPA, on-prem relay. Lists are credible; adjectives aren't.

### Segments we do not optimise for (in v1)

- **Mobile-first users.** v1 is desktop-only ([01 §Non-goals](../foundations/01-vision.md)). We message honestly: "Desktop now. Mobile companion later." We do not capture intent we can't serve.
- **AI-first users.** We message AI as foundational architecture, not as the headline. Users who want a chat-with-your-notes product as their primary surface are better served by a chat-with-your-notes product today; we will eventually serve them via the AI agent app ([22-ai-foundations.md](22-ai-foundations.md)), but not at v1 launch.
- **Enterprise IT buyers.** Until Stage 14 + the org tier ships, we do not run an enterprise sales motion. Team-shaped landing exists for inbound interest but there is no SDR follow-up; the page invites the user to subscribe to a launch list and leaves them alone.

## Differentiation matrix

How we explicitly position relative to adjacent products. This is the structure that powers per-product `/compare/<x>` pages. The matrix is *honest* — every cell describes Brainstorm precisely; competitor columns are filled in per-page from the actual competitor's published facts, and each cell would be something they would agree with if asked.

| Axis                       | Brainstorm                                               |
|----------------------------|----------------------------------------------------------|
| Shape                      | OS-shell hosting apps                                    |
| Data location              | Local-first, sync optional                                |
| Data format                | Yjs + Block Protocol entities                            |
| Multi-app composition      | First-class — apps share entities                        |
| Account required           | No                                                       |
| AI architecture            | Shell brokers; BYO keys or platform-managed (v2)         |
| AI agent posture           | Bounded actor — same sandbox as apps; acts *on* local data, builds artifacts |
| Customisation scope model  | Per-entity / type / list / user / org                     |
| Open source                | Shell + all bundled apps                                  |
| Mobile parity              | Deferred (desktop v1)                                     |
| App SDK / extension model  | Sandboxed apps with capability grants                     |
| Pricing legibility         | Listed, including Enterprise                              |

Honesty notes used in comparison content:

- Mature cloud workspaces have excellent mobile and we won't have parity for a long time.
- Plugin-extended markdown editors have ecosystems of plugins we won't match on count; we trade scope for a sandbox.
- Local-first object-graph products have mature relay-based sync. The teams behind them are not adversaries; some of us are alumni. Our differentiation is the *architectural shape*, not a claim that anyone else is "wrong."
- Outliner-first paradigms are uniquely good for a real audience. We do not have an outliner app on day one; "ship an outliner as a third-party app on Brainstorm" is an open invitation.

> **Decision:** the differentiation matrix above is **the canonical comparison source**. Comparison pages render from it; community contributors can PR rows; competitors are notified on substantive changes. We do not run comparison content that contradicts this table.

## Messaging architecture

Three layers, each with a precise audience and length budget.

### Layer 1 — Hero (one sentence)

The positioning sentence. Verbatim. Appears on the homepage above the fold, in the GitHub README under the project title, and on every comparison page sidebar.

### Layer 2 — Capability tour (six tiles, one paragraph each)

Six things the product does, each a clickable tile leading to deeper documentation. Ordered for the median visitor's interest, not for our internal architecture's importance.

1. **Apps you choose, not features bundled in.** Install Notes, Database, Files, Graph from us. Install third-party apps from the catalog or a URL. Uninstall what you don't use. The shell stays small.

2. **Your data, your disk.** Every document is a file on your machine. Sync is optional and uses Yjs CRDTs. Export to standard formats anytime. No account required, ever.
3. **AI when you want it, never when you don't.** The shell brokers every AI call. Use your own provider keys, or pay-as-you-go through us (v2). Local model bundled for offline. Set per-app budgets that cap runaway costs. When you *do* want an agent, it acts through the same capability sandbox every app uses — it builds real objects in your apps (a doc, a database view) and can do exactly what you granted, never more. AI ships as an *app you install*, not something baked into the shell: install it and AI actions appear across your apps; don't, and there is no AI in the product.
4. **Customise without polluting the shared workspace.** Database views, dashboard layouts, shortcut bindings, theme — all personal by default. Explicit "share with team" elevates to org scope when you want it. (A common pain in cloud workspace products.)
5. **A real app SDK.** Sandboxed, capability-gated, with a stable contract. Build apps inside the product using the Code Editor app. Ship them via the catalog or a URL. Sideload installs incur no fee.
6. **Designed in public.** The architecture docs are linked from the footer. The open questions register is published. The implementation plan is checked into the repo. Read before downloading.

Each tile is a link to a real doc — the capability tour is the funnel into the design docs for users who want depth. Conventional SaaS "see what's possible" marketing pages, by contrast, link to template galleries. We link to specs because the audience that wants depth is the audience that converts.

### Layer 3 — Long-form (blog, docs, talks)

The architecture docs themselves are the long-form. Blog posts are progress reports + design rationale ("Why we picked Lexical for Notes", "How the capability ledger fails closed", "What we learned about quotas from prior tools"). Talks are 25-minute conference talks at engineering / design events; they cover one architectural decision in depth and reference the doc for the rest.

**No "ultimate guide to PKM."** No SEO-bait. Long-form is for the audience that wants signal, not the audience that wants reassurance.

> **Decision:** the blog publishes **on a real cadence, with real content, or not at all**. Empty content marketing — restating common knowledge, reposting Reddit discussions, recycling competitor announcements — is forbidden. Target cadence: 1 post / 2 weeks during stage transitions, 1 post / month otherwise. Quality threshold: every post answers "what is the design decision and what was the alternative?".

## Channels

Where the audience encounters us, ranked by where we put effort.

### Tier 1 — owned

These are the channels we control, optimise heavily, and stake the brand on. The point of every other channel is to drive traffic to one of these.

- **Landing page** (`brainstorm.[tld]`). Hero + capability tour + comparison + footer. Loads under 100 KB; no client-side framework above the fold; Lighthouse 100/100/100/100. Renders identically without JavaScript.
- **Documentation site** (`docs.brainstorm.[tld]`). Render of `/docs` from the repo. Same Markdown source the contributors read; no marketing layer between the user and the design. This is the "designed in public" promise concretised. It is also a **sibling artifact** of the in-shell `DocsPack/v1` per [60](60-developer-docs.md): the same Markdown source the shell ships inside a signed, catalog-distributed pack is what this site renders as static HTML on every merge to `main` (via the out-of-repo `Site-2` CI job). One source, two renders, **zero drift possible by construction**. The shell never fetches a page from this site at runtime — it reads from the bundled `DocsPack` (offline-first); the web mirror exists for SEO, deep-linking, social sharing, and developers who don't have the shell installed yet.
- **GitHub repository.** README is the second landing page (treated with equal care). Issues, discussions, and releases are public-facing artefacts; the bug-report template is part of the brand.
- **Changelog** (`brainstorm.[tld]/changelog`). Each release gets a 200-word human-written summary linked from the release. Following the changelog should be sufficient to track the product.
- **Newsletter** (opt-in, double-opt-in, 1 issue / 4–6 weeks). Stage transitions, major releases, security-review summaries. No tracking pixels; plain-text-friendly HTML; one-click unsubscribe; archive public.

### Tier 2 — communities we participate in

We *are members* of these; we don't broadcast at them. The team posts under real names. We respond to threads, we admit mistakes, we don't link-drop.

- **HackerNews** — Launch announcements (Show HN), stage-transition posts, occasional design-decision essays. We do not *plan* HN appearances; we ship interesting things and post them honestly.
- **Lobsters** — Engineering-audience appearances; cross-post when relevant.
- **PKM-adjacent communities** — Participate in comparison threads when asked by name. Never start a "Brainstorm is better" thread. The communities police self-promotion correctly; respect that.
- **r/LocalLLaMA / r/selfhosted / r/privacy** — Capability-relevant posts (local AI, self-hosted relay, encryption posture). Same posting rules.
- **Mastodon / Bluesky / Twitter** — Team accounts post technical updates. No "engagement-optimised" content. No "thread of 47 tweets explaining why X is broken." Plain announcements; replies engaged with as human conversation. **Every X post carries 2–3 relevant hashtags** (owner rule 2026-07-30 — the untagged posts through v0.11.0 lost most of their reach): one core tag (`#localfirst` / `#buildinpublic` / `#PKM`) + one or two topical, per the standing kit in [`docs/marketing/x-post-build-apps.md` §Hashtag kit](../marketing/x-post-build-apps.md). Never more than three; media (native video/screenshot) attached to the post, external links in the first reply.
- **Discord / Matrix server** (ours). The contributor + user community. Code-of-conduct enforced. The team is present and visible; office-hours-style "AMA"s during stage transitions.
- **Communities of comparable prior products** — Specifically: we do not adversarially recruit from any prior product's community. We are present, by real names, as alumni and as people genuinely interested in local-first knowledge tools. If someone there asks "what is this Brainstorm thing?" we answer honestly and link to docs. We never run paid acquisition targeting those users.

### Tier 3 — paid acquisition

We do not buy attention in v1. This is a deliberate, not budget-driven, position.

- **No display advertising.** Trackers + retargeting are incompatible with [§Principles 7–8](#principles).
- **No paid social.** Same reasoning.
- **No influencer / creator sponsorships in v1.** A creator-with-an-audience promoting a tool they actually use is product placement we can't authenticate from the outside; we won't fund it.
- **Paid search exploration (Tier 2 in v2):** when Team / Enterprise plans ship, we may run a small paid-search experiment on high-intent queries (self-hosted-team intent) — strict budget, strict consent posture (no third-party tracking on the landing page), measured by direct conversion not by engagement. If we cannot run paid search without breaking [§Principles 2 and 7](#principles), we will not run it.

> **Decision:** **no paid acquisition in v1**. The funnel is organic — community, GitHub, HackerNews, search via good content, word of mouth from happy users. We earn growth or we don't grow. Revisit in v2 only with a published rationale.

### Tier 4 — earned media

We do not pitch to it; we ship interesting things and let it find us.

- **Engineering podcasts** (Changelog, Software Engineering Daily, Software Unscripted, …) — Available for interview on architectural decisions. We are not "available for sponsored placements." If a podcast accepts sponsorships, we may consider one on stage-transition launches with a clear "this is a paid spot" disclosure; same standard as our own community-channel posture.
- **Tech press** (Ars Technica, The Register, Heise, LWN, Linux Weekly News, …) — Stage transition launches and security reviews are real news. We send a press note to journalists who have written credibly about local-first or PKM tooling. No PR firm; no embargo theatre.
- **Academic / research mentions** — The architecture is genuinely novel in shape; if researchers in HCI / local-first / PKM want to cite us, we cooperate (provide build artefacts, answer questions, link to the published paper). Free.

## Launch sequence

Aligned with [implementation-plan.md](../implementation-plan.md) stages. Each phase has a distinct audience and posture; we do not "launch" once.

### Phase 0 — Stealth / pre-alpha (Stages 0–7)

Now. The product is being built; the design docs are public; the repository is public. **No marketing exists.** The landing page is a placeholder ("Brainstorm — local-first OS for knowledge work. Building in public. [GitHub] [Docs]"). The newsletter signup is the only call to action.

The deliberate choice here: a half-built product with marketing is worse than a half-built product without. Reading the design docs and the implementation plan is the strongest possible signal we can give the audience that we exist and that we are serious; further marketing copy is noise.

### Phase 1 — Alpha (Stage 8 — Notes app done, first usable thing)

The product is *usable for one job* (taking notes locally with the Notes app). Audience: developer / power-user segment. Posture: "Here's an alpha. The format is stable, the API is not. Help us find bugs."

- Landing page upgraded to the real Layer 1 + Layer 2 messaging, but with prominent "Alpha" banner.
- GitHub README + release notes do most of the work.
- One Show HN post timed to the Stage 8 milestone, written by the founder, honest about state.
- No press outreach. No comparison pages yet.
- Newsletter goes from "we exist" to "monthly progress."

### Phase 2 — Beta (Stage 11 — Database app + Files + AI broker landed)

The product is usable for multiple jobs. Audience expands to alumni of prior local-first knowledge tools and privacy-conscious individuals. Posture: "Beta. Free. Real product. Account-less. Help us find the rough edges."

- Per-product comparison pages publish under `/compare/<product-slug>`, one per prior tool we have a real comparison story for.
- Dedicated landing pages per segment (Phase 2: power-user + prior-tool-alum; Phase 3 adds privacy + team).
- Documentation site stylised; the same Markdown source as the repo, but rendered for the public.
- Engineering podcast outreach starts — only on architectural posts, never as a "promote the product" pitch.
- HN, lobsters, relevant subreddits — substantive posts on each stage's interesting decision (one per stage transition, not every iteration).

### Phase 3 — v1 (end of Stage 13)

The shell + all v1-target apps are real. Audience: full primary segment list. Posture: "1.0. Free local product, forever. Pre-register for hosted services."

- Press notes to the technical press list. Coordinated launch — same day across all owned channels, HN, newsletter, podcasts that confirmed.
- Comparison pages refreshed with current facts.
- The "build an app this weekend" tutorial is the centrepiece of developer marketing; it is now a real 20-minute experience that ends with a working app.
- The launch list (collected during Phase 0–2) gets a personal email from the founder. Not from a marketing-automation tool.
- Conference talk submissions for the year (engineering + design + privacy conferences).

### Phase 4 — Commercial launch (Stage 14, v2)

Plus / Pro / Team / Enterprise plans land. Hosted relay, encrypted backup, cloud attachments live. Audience adds small-team / org early adopters.

- Pricing page goes live (already drafted per [44-pricing.md](44-pricing.md); the marketing surface renders that doc).
- Enterprise landing page goes live with documented pricing (no "contact sales for pricing").
- The Team-shaped landing page starts a *small* paid-search experiment with the constraints in [§Tier 3 — paid acquisition](#tier-3--paid-acquisition).
- Newsletter cadence may increase to 1 / 3 weeks during the commercial rollout; revert to 1 / 4–6 weeks once stable.

> **Decision:** **no big-bang launch.** Four phased introductions, each appropriate to the product's state. The audience the product cannot yet serve does not see the product yet.

## Product Hunt campaign

Moved to the funding section — see §Product Hunt campaign in `funding/pre-seed-options.md`, where it sits alongside the other launch / community-outreach channels (r/PKMS, Hacker News). The anti-pattern commitments it depends on stay defined here ([§What we don't do](#what-we-dont-do-anti-patterns-by-name)); phase/whether-at-all is still **OQ-MK-9**.

## Content strategy

What we publish, how often, and why.

### Blog

Two recurring formats, plus ad-hoc.

- **Design decision posts** (every 2–4 weeks): "Why we chose Yjs over Automerge", "How the IPC envelope works", "What prior local-first tools taught us about scope". 1,000–2,500 words. Linked from the matching design doc. Each one is a candidate for the engineering podcast circuit.
- **Stage-transition retrospectives** (one per stage, every 4–10 weeks): What landed, what surprised us, what we are doing next. 600–1,200 words. Includes a screenshot, a perf number, and a security note.

Ad-hoc posts when we have something to say: a security advisory, a major architecture revision, a public response to a community question that deserves a permanent home.

### Documentation

The design docs are the canonical artefact. The docs site renders `/docs` as published. We do *not* maintain a parallel "user-facing documentation" that drifts from the design docs; we maintain the design docs, and where the user needs operational guidance ("how to install", "how to sync") that operational guidance is part of the same doc tree, not a separate marketing site.

### Tutorials

Two tutorials, both maintained.

1. **"Install Brainstorm and take your first note"** — 5 minutes. Aimed at every segment.
2. **"Build your first Brainstorm app"** — 20 minutes. Aimed at developers. Ends with an installable bundle.

These are *not* "10 tips to organise your second brain." They are concrete tasks ending in a concrete result. Tutorials are part of the *product*; we treat their accuracy as a build-breaking concern.

### Video

- **No 60-second motion-graphics product video** (the kind every SaaS publishes). They are interchangeable, expensive, and obsolete in six months.
- **Yes** to recorded conference talks (we publish on our channel and embed in the relevant blog post).
- **Yes** to short screen recordings demonstrating specific capabilities, where they substitute for prose more effectively than a screenshot ("here's the dashboard launcher", "here's a database view"). Hosted on the docs site, not on YouTube; no third-party-tracking player.

### Social

Plain announcements. No threads. No "🚀". No reaction-bait. Posts linking to the blog, to a release, to a doc. Replies engaged with as conversation, not as growth-hack opportunities.

> **Decision:** **the content surface is sized to what we can do well**. One blog post every 2–4 weeks, two maintained tutorials, occasional video where prose is insufficient. Skipping a publishing slot is never a problem; publishing a bad post to keep a cadence is.

## What we don't do (anti-patterns by name)

Surfacing the boundaries explicitly because the temptation will recur and is industry-standard.

1. **Email gates on docs.** The architecture docs are public. The implementation plan is public. There is no PDF whitepaper behind a "give us your work email" wall.
2. **"Talk to sales" pages without prices.** [43](43-monetisation-strategy.md) commits this. Enterprise pricing is published; the negotiation surface is documented.
3. **Lifecycle-email manipulation.** The newsletter is one editorial cadence. We do not run "you haven't opened the product in 7 days, here are 5 reasons to come back" drip campaigns. The user is not a churn metric.
4. **"Free trial — credit card required."** The free product is the free product, forever. Paid plans (when they land in v2) offer a 14-day no-card trial of Plus; Pro / Team / Enterprise require a card but do not bill until day 15. Per [43 §Free → paid conversion mechanics](43-monetisation-strategy.md).
5. **In-product upsell injection.** No "you've used 3 features — upgrade to unlock more!" interstitials. Capabilities are real ([43 §What we charge for](43-monetisation-strategy.md)); upsell happens at the moment the user reaches for the capability, not as ambient interruption.
6. **SEO-bait content.** "Best X alternatives 2026" listicles ghost-written for backlinks. Even if it would rank.
7. **Affiliate / referral programs.** No "give a friend 1 month free, get 1 month free." It distorts the conversation between users and turns advocacy into a transaction.
8. **Fake urgency.** No "Early-bird pricing ends Friday." No "Limited beta access — request invite." If the product is ready, it is available; if it is not ready, it is not.
9. **Hostile competitor framing.** The differentiation matrix is honest. We do not run "Why X fails" content. We can write "Why we built differently than X" — that's a different post and reads as such.
10. **Astroturfing.** No employees posting under pseudonyms on Reddit. No paid reviews. No "early-access community" that exists to seed organic-looking content. The team posts under real names, identified as team, in every public channel.

> **Decision:** these anti-patterns are **commitments**, mirrored from the product side of the same posture in [43 §What we explicitly do not monetise](43-monetisation-strategy.md). Crossing one of them requires a publicly documented rationale change.

## Metrics

What we measure. What we do not. How we use it.

### What we measure

- **Installs** (counted by build downloads + first-run telemetry, which is opt-in-by-default-off; for build downloads, just an aggregate counter from the file CDN access log — no user identifiers).
- **Active install retention** (sampled from opt-in telemetry; we report aggregate retention curves with explicit "based on N opted-in installs" footnotes).
- **GitHub stars + forks + contributors + issues filed/closed.** A real signal because we are an open codebase.
- **Newsletter subscribers + open rate + churn rate.** With consent, with one-click unsubscribe, with publicly archived issues.
- **Documentation page visits** (server-side, no client identifiers). Aggregate page popularity informs which docs need work.
- **Community size** (Discord/Matrix members, public).
- **Conversion to paid** (v2 only; counted at the entitlement system per [45-payments-architecture.md](45-payments-architecture.md)).
- **NPS / CSAT?** **No**. NPS is a noisy metric that has been demonstrated repeatedly to not predict what its users think it predicts. We will instead surface a *single* one-line survey ("what would you tell a friend about Brainstorm?") at the user's option, never automatically, and read the responses.

### What we do not measure

- **Anonymous-visitor pixel tracking.** No third-party analytics SDK on the landing page or docs. Server access logs only, retained 90 days, aggregated into trends, and the raw logs deleted on schedule.
- **Per-user product analytics by default.** Opt-in only. The opt-in surface (Settings → Privacy → "share aggregate usage stats") shows the user *exactly* what will be sent (a list of event names and aggregate counters; no document content, no entity ids, no user ids).
- **A/B tests on the docs.** The docs are authoritative; we don't run experiments on what the truth says.
- **A/B tests on the landing.** *Possibly* in v2, on the hero copy specifically, with privacy-preserving infrastructure. We are skeptical that A/B-testing the hero is high-leverage; positioning quality dwarfs micro-optimisation.

### How we report

- A public dashboard with the aggregate metrics above. Updated quarterly. "Here is how many people are using the product; here is how many are paying us; here is how the community is growing." The dashboard is a *commitment* — once we publish it, regressions are not hidden.

> **Decision:** **the metrics dashboard is public**. We publish growth, decline, and stagnation honestly. This is the strongest *positive* differentiator from competitors that hide their numbers, and the strongest *negative* selection pressure on bad strategy (we cannot quietly chase a vanity metric if the metric is public).

## Composition with the rest of the architecture

Marketing is downstream of every other doc; it composes by *not contradicting*.

- **[01-vision.md](../foundations/01-vision.md)** — the positioning sentence is the vision sentence's outward face. Principle 9 (personal by default) is the *messaging hook* for the "customise without polluting the workspace" capability tile.
- **[43-monetisation-strategy.md](43-monetisation-strategy.md)** — the paid surface in messaging is exactly what 43 says is paid. Free-forever in messaging is exactly what 43 says is free-forever.
- **[44-pricing.md](44-pricing.md)** — the pricing page renders 44 directly; no marketing layer between the doc and the prospect.
- **[16-identity-orgs-encryption.md](../security/16-identity-orgs-encryption.md)** — privacy claims are sourced from the identity / encryption design, not generalised marketing pap.
- **[09-security-and-sandbox.md](../security/09-security-and-sandbox.md)** — security claims are sourced from the threat model. We do not claim coverage we do not have.
- **[14-app-store.md](../apps/14-app-store.md), [26-shell-as-framework.md](../apps/26-shell-as-framework.md)** — the developer-segment messaging ("build apps inside the product") references the actual Code Editor app, not a vapor capability.
- **[22-ai-foundations.md](22-ai-foundations.md), [55-agent-app.md](../apps/55-agent-app.md), [62-agent-harness.md](62-agent-harness.md)** — the AI claims in the capability tour (a brokered, *bounded* agent that acts through the same sandbox as apps and builds real artifacts) are sourced from the AI architecture, not from generic "powered by AI" copy. AI stays in the **capability tour, never the hero** (§What we do not lead with) — the agent is a capability we ground, not the headline we sell.
- **[implementation-plan.md](../implementation-plan.md)** — the launch phases are anchored to the implementation plan's stages. We do not promote v1 capabilities before they ship.

If a marketing claim contradicts a design doc, the design doc wins and the marketing copy is corrected. This direction is invariant.

## Open questions

Surfaced for follow-up; added to [11-open-questions.md](../reference/11-open-questions.md).

- **OQ-MK-1** — Domain choice. `brainstorm.app` vs `brainstorm.dev` vs `brainstorm.[country-tld]`. Some are squatted; some carry cost implications. Decision affects brand-recognition trajectory. *[RESOLVED 2026-06-29 — getbrainstorm.online; site is live and public.]*
- **OQ-MK-2** — Trademark posture. Register the word "Brainstorm" in the productivity-software class, or accept the generic-word risk? "Brainstorm" is a common English word; registration in a specific class is feasible but contested. Lean: register in the relevant classes once we have v1 revenue; accept the risk until then.
- **OQ-MK-3** — Conference-talk strategy: pitch to existing conferences (Strange Loop / SREcon / RustConf / FOSDEM / equivalents) or organise our own (local-first / PKM / decentralised-knowledge) micro-conference once a year? Lean: pitch first; revisit in v2 once we have a real community.
- **OQ-MK-4** — Should we run a **bug-bounty / responsible-disclosure program** as a marketing surface as well as a security surface? Per [09](../security/09-security-and-sandbox.md), the disclosure program is a security commitment. Whether we *also* surface it in marketing (badge on the landing, "we paid out $X this year") is a separate question; some teams find this credibility-positive, others find it noisy.
- **OQ-MK-5** — Founder-led vs team-led public posture. Founder-led builds personal recognition but doesn't scale; team-led scales but loses a credibility lever. Lean: founder-led for Phase 0–2, team-led from Phase 3 onward, both visible as named team members throughout.
- **OQ-MK-6** — Should we publish a public **non-customer list** ("companies that use Brainstorm")? Big-SaaS-style logo walls are vanity, but a small "in production at:" footer line on the landing — with explicit per-company consent — can be a credible signal. Trade-off: requires customers; can't ship before there are customers.
- **OQ-MK-7** — Translation strategy for marketing. The product is localised ([21-localization.md](../platform/21-localization.md)); is the landing page? Lean: English-only for Phase 0–3; community-translated landing pages from Phase 4 if community contributors volunteer; no paid translation in v1.
- **OQ-MK-9** — Product Hunt: do it at all, and if so which phase only? Phase 3 (v1) is the lean; the open part is whether a Phase 4 commercial-launch second post is substantive enough to not read as a re-launch, and whether *any* PH presence can survive contact with PH culture without an upvote-ask. Lean: Phase 3 only, AMA-posture, abort if it requires crossing an anti-pattern.
- **OQ-MK-8** — Comparison-page invitation to competitors. Should we email each subject team when we publish a `/compare/<x>` page, inviting them to flag inaccuracies? The honest move. Some teams will engage; some will ignore. None will retaliate. Lean: yes, with a one-week heads-up before publication.

## Cross-doc reconciliation

Light edits in adjacent docs to keep claims consistent:

- **[00-index.md](../00-index.md) §Commercial** — add a row for this doc.
- **[43-monetisation-strategy.md](43-monetisation-strategy.md)** — add a forward pointer to this doc next to the "What we explicitly do not monetise" section; the privacy-in-marketing posture (§Principles 7–8 here) is the upstream-channel application of 43's no-content-monetisation commitment.
- **[44-pricing.md](44-pricing.md)** — note that the pricing page renders 44 directly (no marketing rewrite between doc and prospect).
- **[01-vision.md §Non-goals](../foundations/01-vision.md)** — the "no marketplace, billing, or developer accounts in v1" non-goal already cross-links to 43; add a forward pointer to this doc for the *marketing posture* on v1's non-commercial surface.
- **[implementation-plan.md](../implementation-plan.md)** — note the four marketing launch phases against their stage anchors (Stage 8 alpha, Stage 11 beta, end-of-Stage-13 v1, Stage 14 commercial).
- **[11-open-questions.md](../reference/11-open-questions.md)** — add OQ-MK-1 through OQ-MK-9.

These reconciliations are tracked as a follow-up task in [implementation-plan.md](../implementation-plan.md) under the marketing-surface workstream (parallel to but distinct from the commercial-surface workstream of Stage 14).

## Summary

- **Marketing is product**. The landing page and the running product tell the same story or one is broken.
- **No dark patterns at the funnel**, same standard as the product. No tracking pixels, no fake urgency, no email gates, no astroturfing.
- **Positioning sentence is load-bearing**: *Brainstorm is the local-first OS for your knowledge work — install apps, own your data, never need an account.* Three load-bearing words (OS, local-first, apps).
- **Four primary audience segments**: alumni of prior local-first knowledge tools, developers/power users, privacy-conscious individuals, small-team early adopters (the last enters in v2). Each gets a dedicated landing; the product is one.
- **Comparison content is honest**. Differentiation matrix is canonical; we cite competitors' strengths and weaknesses; we invite them to flag inaccuracies before publishing.
- **No paid acquisition in v1**. Organic only — community, GitHub, HackerNews, search via good content, word of mouth. Revisit in v2 with published rationale.
- **Four-phase launch sequence** anchored to implementation-plan stages: stealth (now), alpha (Stage 8), beta (Stage 11), v1 (end of Stage 13), commercial (Stage 14). No big-bang launch.
- **Content cadence is sized to quality**. Skipping a slot is fine; publishing weak content to keep cadence is not.
- **Metrics dashboard is public**. We publish growth, decline, and stagnation honestly. The strongest commitment device against bad strategy.
- **Composes with the rest of the architecture**. Every claim is sourced from a design doc; if the marketing copy contradicts a design doc, the design doc wins.
- **Product Hunt**: one honest AMA-posture launch at v1; no upvote-asks, no fake urgency, no paid hunter; abort rather than cross an anti-pattern.
- Surfaces 9 marketing-specific open questions for follow-up.
