/** Single source of truth for the promo's scene timings, VO lines, and
 *  captions — shared by voiceover.mjs and render.mjs; mirrors the scene
 *  table in docs/marketing/promo-60s.md. */

export const SCENES = [
	{
		id: "01-dashboard",
		speed: 1.25,
		seconds: 7,
		vo: "This is Northbound — a real research business, running entirely in one private workspace.",
		caption: "A whole business in one workspace",
	},
	{
		id: "02-notes",
		speed: 1.35,
		seconds: 8,
		vo: "Notes that hold real work — clients and projects, linked right in the page.",
		caption: "Documents with live data inside",
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
		seconds: 7,
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
		seconds: 10,
		vo: "And it's not just you. Your team works in the same vault — live, together — while everything stays end-to-end encrypted.",
		caption: "Real-time team, end-to-end encrypted",
	},
	{
		id: "07-search",
		speed: 1.3,
		seconds: 7,
		vo: "Search finds anything, instantly. Your data never leaves your machine unless you say so.",
		caption: "Find anything, instantly",
	},
	{
		id: "08-title",
		seconds: 6,
		vo: "Brainstorm. Your whole business, in a workspace you own. Free beta on GitHub.",
		caption: "brainstorm — download on GitHub",
		titleCard: true,
	},
];
