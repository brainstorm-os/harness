/** Scene table for the **Agent** propose→approve reel (VID-agent-team, the
 *  foundations cut). Same shape as the other reels (id · seconds · vo · caption ·
 *  slide/titleCard · speed) so `voiceover.mjs` and `render.mjs` drive it
 *  unchanged via `PROMO_SCENES`.
 *
 *  `slide`/`titleCard` scenes are render-side cards (no captured clip); the rest
 *  map to a `<id>.mov` clip recorded by `promo/vid-agent-team.spec.ts`.
 *
 *  This is the SINGLE-USER foundations cut (you + your agent). The full
 *  team-of-people + team-of-agents vision (VID-agent-team.md) ships once the
 *  0.12.0 collab + AGENTS-AS-MEMBERS rungs land. */

export const SCENES = [
	{
		id: "00-slide-agent",
		seconds: 4,
		vo: "This isn't a chatbot. It's a teammate — and it hands you real things you keep.",
		slide: { title: "Work with the agent", sub: "It proposes · you decide" },
	},
	{
		id: "01-ask",
		speed: 1.2,
		seconds: 9,
		vo: "Just tell it what you need, in your own words. Here: a follow-up after a client call.",
		caption: "Ask",
	},
	{
		id: "02-propose",
		speed: 1.1,
		seconds: 10,
		vo: "It doesn't just reply — it drafts real objects. A contact, a follow-up task, a check-in — staged for your review.",
		caption: "Proposed — not saved",
	},
	{
		id: "03-edit",
		speed: 1.2,
		seconds: 7,
		vo: "You're the editor. Fix a field right on the card. Nothing's been saved yet.",
		caption: "You're the editor",
	},
	{
		id: "04-approve",
		speed: 1.15,
		seconds: 10,
		vo: "Approve what's right, drop what's not. What you approve is committed — the agent never writes on its own.",
		caption: "You commit",
	},
	{
		id: "05-kept",
		speed: 1.2,
		seconds: 9,
		vo: "And now they're real — a contact in Contacts, a task in Tasks. Drafted by the agent, kept by you.",
		caption: "Now they're real",
	},
	{
		id: "06-title-agent",
		seconds: 5,
		vo: "Work with the agent — not around it. Free beta at getbrainstorm.online.",
		titleCard: { title: "getbrainstorm.online", sub: "Work with the agent" },
	},
];
