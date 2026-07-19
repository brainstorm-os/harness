/** Single source of truth for the promo's scene timings, VO lines, and
 *  captions — shared by voiceover.mjs and render.mjs; mirrors the scene
 *  table in docs/marketing/promo-60s.md. `speed` time-compresses the
 *  captured footage at render time (auto-raised so the whole take fits). */

export const SCENES = [
	{
		id: "00-intro",
		seconds: 4,
		vo: "Meet Brainstorm — an operating system for your mind.",
		caption: "brainstorm",
		introCard: true,
	},
	{
		id: "01-onboarding",
		speed: 1.3,
		seconds: 7,
		vo: "Create a vault — private, encrypted, on your machine — and you're in.",
		caption: "Step 1 — create your vault",
	},
	{
		id: "02-notes",
		speed: 1.35,
		seconds: 7,
		vo: "Notes that hold real work — clients and projects, linked right in the page.",
		caption: "Notes — documents with real work inside",
	},
	{
		id: "03-database",
		speed: 1.45,
		seconds: 7,
		vo: "Databases with boards, calendars, and views — drag a deal, plan an issue.",
		caption: "Database — boards, calendars, views",
	},
	{
		id: "04-graph-whiteboard",
		speed: 1.35,
		seconds: 5,
		vo: "Map the thinking on a graph or a whiteboard.",
		caption: "Graph & Whiteboard — map the thinking",
	},
	{
		id: "05-operate",
		speed: 1.45,
		seconds: 8,
		vo: "Tasks, calendar, journal — the whole operation in one place, no tabs.",
		caption: "Tasks · Calendar · Journal",
	},
	{
		id: "06-team",
		speed: 1.3,
		seconds: 6,
		vo: "Bring the team in — same vault, live together, end-to-end encrypted.",
		caption: "Chat — your team, end-to-end encrypted",
	},
	{
		id: "07-settings",
		speed: 1.35,
		seconds: 5,
		vo: "Make it yours — themes, wallpapers, shortcuts.",
		caption: "Settings — make it yours",
	},
	{
		id: "08-search",
		speed: 1.3,
		seconds: 5,
		vo: "And search finds anything — instantly, across everything.",
		caption: "Search — find anything, instantly",
	},
	{
		id: "09-title",
		seconds: 6,
		vo: "Your whole business, in a workspace you own. Free beta at getbrainstorm dot online.",
		caption: "getbrainstorm.online",
		titleCard: true,
	},
];
