/** Single source of truth for the promo's scene timings, VO lines, and
 *  captions — shared by voiceover.mjs and render.mjs; mirrors the scene
 *  table in docs/marketing/promo-60s.md. `speed` time-compresses the
 *  captured footage at render time. */

export const SCENES = [
	{
		id: "01-onboarding",
		speed: 1.3,
		seconds: 7,
		vo: "Meet Brainstorm. Create a vault — private, encrypted, on your machine — and you're in.",
		caption: "Your vault, created in seconds",
	},
	{
		id: "02-notes",
		speed: 1.35,
		seconds: 7,
		vo: "Notes that hold real work — clients and projects, linked right in the page.",
		caption: "Documents with real work inside",
	},
	{
		id: "03-database",
		speed: 1.45,
		seconds: 7,
		vo: "Databases with boards, calendars, and views — drag a deal, plan an issue.",
		caption: "Boards, calendars, views",
	},
	{
		id: "04-graph-whiteboard",
		speed: 1.35,
		seconds: 6,
		vo: "Map the thinking on a graph or a whiteboard.",
		caption: "Map the thinking",
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
		seconds: 7,
		vo: "Bring the team in — same vault, live together, end-to-end encrypted.",
		caption: "Real-time team, end-to-end encrypted",
	},
	{
		id: "07-settings",
		speed: 1.35,
		seconds: 6,
		vo: "Make it yours — themes, wallpapers, shortcuts. Everything's a setting away.",
		caption: "Make it yours",
	},
	{
		id: "08-search",
		speed: 1.3,
		seconds: 6,
		vo: "And search finds anything — instantly, across everything.",
		caption: "Find anything, instantly",
	},
	{
		id: "09-title",
		seconds: 6,
		vo: "Brainstorm. Your whole business, in a workspace you own. Free beta on GitHub.",
		caption: "brainstorm — download on GitHub",
		titleCard: true,
	},
];
