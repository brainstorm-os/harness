/** Scene table for the **Notes** app-showcase reel (VID-notes) — the tight
 *  ~65s highlight cut of the Notes app's functionality. Same shape as the 60s
 *  promo's `scenes.mjs` (id · seconds · vo · caption · slide/titleCard · speed)
 *  so `voiceover.mjs` and `render.mjs` drive it unchanged via `PROMO_SCENES`.
 *
 *  `slide`/`titleCard` scenes are render-side cards (no captured clip); the
 *  rest map to a `<id>.mov` clip recorded by `promo/vid-notes.spec.ts`. */

export const SCENES = [
	{
		id: "00-slide-notes",
		seconds: 4,
		vo: "This is Notes — where your thinking takes shape.",
		slide: { title: "Notes", sub: "Write · structure · connect" },
	},
	{
		id: "01-write",
		speed: 1.3,
		seconds: 9,
		vo: "Start writing. Clean type, your words front and center — nothing in the way.",
		caption: "Write",
	},
	{
		id: "02-slash",
		speed: 1.3,
		seconds: 8,
		vo: "Press slash for anything — headings, lists, checklists, callouts.",
		caption: "Slash menu",
	},
	{
		id: "03-blocks",
		speed: 1.35,
		seconds: 9,
		vo: "Markdown shortcuts turn keystrokes into structure as you type.",
		caption: "Rich blocks",
	},
	{
		id: "04-format",
		speed: 1.3,
		seconds: 7,
		vo: "Select text for the inline toolbar — format without leaving the keyboard.",
		caption: "Inline formatting",
	},
	{
		id: "05-mention",
		speed: 1.3,
		seconds: 8,
		vo: "Mention anything — a person, a note, even a date — and it stays linked across your vault.",
		caption: "Mentions & links",
	},
	{
		id: "06-properties",
		speed: 1.35,
		seconds: 8,
		vo: "Every note carries real properties — status, owner, dates. A document that's also data.",
		caption: "Properties",
	},
	{
		id: "07-comments",
		speed: 1.3,
		seconds: 8,
		vo: "And comment right on the doc — the conversation lives with the work.",
		caption: "Comments",
	},
	{
		id: "08-title",
		seconds: 6,
		vo: "Notes, in Brainstorm. Free beta at getbrainstorm dot online.",
		caption: "getbrainstorm.online",
		titleCard: true,
	},
];
