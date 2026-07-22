/** Scene table for the **Notes** app-showcase reel (VID-notes) — a full walk of
 *  the Notes app's functionality. Same shape as the 60s promo's `scenes.mjs`
 *  (id · seconds · vo · caption · slide/titleCard · speed) so `voiceover.mjs`
 *  and `render.mjs` drive it unchanged via `PROMO_SCENES`.
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
		vo: "Press slash for any block — headings, lists, callouts, code, images, and more.",
		caption: "Slash menu",
	},
	{
		id: "03-blocks",
		speed: 1.4,
		seconds: 12,
		vo: "Markdown shortcuts build structure as you type — headings, lists, checkboxes, and quotes.",
		caption: "Rich blocks",
	},
	{
		id: "04-code",
		speed: 1.3,
		seconds: 8,
		vo: "Drop in a code block — monospaced and syntax-aware — when a note calls for one.",
		caption: "Code blocks",
	},
	{
		id: "05-format",
		speed: 1.3,
		seconds: 8,
		vo: "Select text for the inline toolbar — bold, italic, links, and color, all from the keyboard.",
		caption: "Inline formatting",
	},
	{
		id: "06-mention",
		speed: 1.3,
		seconds: 8,
		vo: "Mention anything — a person, a note, even a date — and it stays linked across your vault.",
		caption: "Mentions & links",
	},
	{
		id: "07-properties",
		speed: 1.35,
		seconds: 10,
		vo: "Give a note real properties — status, owner, dates. A document that's also data.",
		caption: "Properties",
	},
	{
		id: "08-icon",
		speed: 1.3,
		seconds: 7,
		vo: "Make any note yours with an icon of its own.",
		caption: "Icons",
	},
	{
		id: "09-comments",
		speed: 1.3,
		seconds: 7,
		vo: "Comment right on the doc — the conversation lives with the work.",
		caption: "Comments",
	},
	{
		id: "10-organize",
		speed: 1.35,
		seconds: 8,
		vo: "Search across every note, and jump between them from the sidebar.",
		caption: "Search & organize",
	},
	{
		id: "11-actions",
		speed: 1.3,
		seconds: 8,
		vo: "Pin it, share it, save it as a template, export it — or lock it read-only.",
		caption: "Note actions",
	},
	{
		id: "12-title",
		seconds: 6,
		vo: "Notes, in Brainstorm. Free beta at getbrainstorm dot online.",
		caption: "getbrainstorm.online",
		titleCard: true,
	},
];
