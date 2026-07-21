/** Single source of truth for the promo's scene timings, VO lines, and
 *  captions — shared by voiceover.mjs and render.mjs; mirrors the scene
 *  table in docs/marketing/promo-60s.md.
 *
 *  The cut is a STORY: Mira founds Northbound Studio and runs it end-to-end
 *  in Brainstorm — vault creation → building the studio → the team joining →
 *  shipping. `slide` scenes are render-side interstitials (no clip, no VO —
 *  a musical breath); `speed` time-compresses footage (auto-raised so the
 *  whole take fits). */

export const SCENES = [
	{
		id: "00-slide-meet",
		seconds: 5,
		vo: "Meet Mira. She's starting a studio — and she'll run it all from one place.",
		slide: { title: "Meet Mira.", sub: "Founder, Northbound Studio" },
	},
	{
		id: "01-onboarding",
		speed: 1.3,
		seconds: 7,
		vo: "Day one: a private vault. Everything the studio makes lives here — encrypted, on her machine.",
		caption: "Day 1 — create the vault",
	},
	{
		id: "02-slide-build",
		seconds: 3,
		vo: "",
		slide: { title: "Build the studio", sub: "" },
	},
	{
		id: "03-notes",
		speed: 1.35,
		seconds: 7,
		vo: "Client briefs live in Notes — real documents, tied to real projects.",
		caption: "Notes — briefs and documents",
	},
	{
		id: "04-database",
		speed: 1.45,
		seconds: 7,
		vo: "The pipeline runs on boards and views — drag a deal, plan the week.",
		caption: "Database — the pipeline",
	},
	{
		id: "05-graph-whiteboard",
		speed: 1.35,
		seconds: 5,
		vo: "Thinking gets mapped — graph and whiteboard.",
		caption: "Graph & Whiteboard",
	},
	{
		id: "06-operate",
		speed: 1.45,
		seconds: 8,
		vo: "Tasks, calendar, journal — the day runs itself.",
		caption: "Tasks · Calendar · Journal",
	},
	{
		id: "07-slide-team",
		seconds: 3,
		vo: "",
		slide: { title: "The team joins", sub: "" },
	},
	{
		id: "08-chat",
		speed: 1.3,
		seconds: 8,
		vo: "The team works in chat — updates, files, decisions — right next to the work.",
		caption: "Chat — the team, in the vault",
	},
	{
		id: "09-agent",
		speed: 1.3,
		seconds: 7,
		vo: "An AI agent drafts alongside them — grounded in the vault.",
		caption: "Agent — AI, grounded in your vault",
	},
	{
		id: "10-mailbox",
		speed: 1.35,
		seconds: 6,
		vo: "Client mail lands beside the projects it belongs to.",
		caption: "Mailbox — mail beside the work",
	},
	{
		id: "11-browser",
		speed: 1.35,
		seconds: 6,
		vo: "Research happens in-app — captured straight to the vault.",
		caption: "Browser — research, captured",
	},
	{
		id: "12-search",
		speed: 1.3,
		seconds: 5,
		vo: "And anything is one search away.",
		caption: "Search — everything, instantly",
	},
	{
		id: "13-title",
		seconds: 7,
		vo: "Northbound runs on Brainstorm. Yours can too — free beta at getbrainstorm dot online.",
		caption: "getbrainstorm.online",
		titleCard: true,
	},
];
