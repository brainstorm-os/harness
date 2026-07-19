/** Single source of truth for the promo's scene timings, VO lines, and
 *  captions — shared by voiceover.mjs and render.mjs; mirrors the scene
 *  table in docs/marketing/promo-60s.md. */

export const SCENES = [
	{
		id: "01-dashboard",
		seconds: 7,
		vo: "This is Northbound — a real research business, running entirely in one private workspace.",
		caption: "A whole business in one workspace",
	},
	{
		id: "02-notes",
		seconds: 8,
		vo: "Notes that hold live data — the client pipeline, embedded right in the page.",
		caption: "Documents with live data inside",
	},
	{
		id: "03-database",
		seconds: 7,
		vo: "Databases with boards, calendars, and views — drag a deal, plan an issue.",
		caption: "Boards, calendars, views",
	},
	{
		id: "04-graph-whiteboard",
		seconds: 7,
		vo: "Map the thinking on a graph or a whiteboard.",
		caption: "Map the thinking",
	},
	{
		id: "05-operate",
		seconds: 8,
		vo: "Tasks, calendar, mail, and automations — the whole operation, one place, no tabs.",
		caption: "Tasks · Calendar · Mail · Automations",
	},
	{
		id: "06-team",
		seconds: 10,
		vo: "And it's not just you. Your team works in the same vault — live, together — while everything stays end-to-end encrypted.",
		caption: "Real-time team, end-to-end encrypted",
	},
	{
		id: "07-search",
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
