/** Scene table for the **build-an-app** episode (VID-build-apps) — the
 *  self-hosting story: two files typed in the code editor become a real,
 *  sandboxed, capability-gated app in the grid, reading real vault data.
 *
 *  Same shape as the other reels (id · seconds · speed · vo · caption ·
 *  slide/titleCard) so `voiceover.mjs` and `render.mjs` drive it unchanged
 *  via `PROMO_SCENES`. `slide`/`titleCard` entries are render-side cards with
 *  no captured clip; every other id maps to a `<id>.mov` recorded by
 *  `promo/vid-build-apps.spec.ts`.
 *
 *  Ids mirror `docs/marketing/vid-build-apps.md` §Scene table 1:1.
 *
 *  No scene sets `speed`: `render.mjs` derives the compression per scene from
 *  the captured clip's real duration (`dur / (seconds - 0.2)`, capped at 3×),
 *  so the typing scenes and the agent turn play back snappier without ever
 *  being truncated. A hand-set `speed` is a FLOOR, and a floor above what the
 *  clip needs just buys a frozen tail — the drivers pace the beats instead.
 *
 *    bun run promo:capture:build-apps
 *    bun run promo:vo:build-apps
 *    bun run promo:render:build-apps
 */

export const SCENES = [
	{
		id: "00-slide-hook",
		seconds: 5,
		vo: "An operating system for your knowledge — that runs the apps you write yourself.",
		slide: { title: "It runs the apps you write", sub: "An OS for your knowledge" },
	},
	{
		id: "01-the-gap",
		seconds: 6,
		vo: "Mira wants a pulse board for her clients. Nothing built in does it. So she writes one.",
		caption: "The gap",
	},
	{
		id: "02-manifest",
		seconds: 12,
		vo: "An app here is two files. A manifest that says what it is — and exactly what it's allowed to touch. One line: read your entities. Nothing else.",
		caption: "The manifest",
	},
	{
		id: "03-page",
		seconds: 14,
		vo: "And a page. It asks the vault for her clients and draws them. Real data — no copy, no export, no build step. She's writing it in the code editor, in the same vault the app will read.",
		caption: "The page",
	},
	{
		id: "04-install-from-vault",
		seconds: 8,
		vo: "Now she installs it — straight from the vault. No folder, no zip, no terminal.",
		caption: "Install from the vault",
	},
	{
		id: "05-consent",
		seconds: 7,
		vo: "Brainstorm shows her exactly what she's about to run, and what it asked for.",
		caption: "What it's allowed to do",
	},
	{
		id: "06-installed",
		seconds: 6,
		vo: "And there it is. A real app, in her grid.",
		caption: "Installed",
	},
	{
		id: "07-launch",
		seconds: 9,
		vo: "Its own window, its own sandbox — showing her actual clients. From typed to installed, in about a minute.",
		caption: "It runs",
	},
	{
		id: "08-agent-drafts",
		seconds: 12,
		vo: "Or she doesn't write it at all. She asks the agent, and it drafts the files — the same way it drafts a note. Two staged cards, code she can read before anything is saved.",
		caption: "Or let the agent write it",
	},
	{
		id: "09-agent-approve",
		seconds: 10,
		vo: "She reads them, approves them, and they land in the vault as real files. Same install path. Same app.",
		caption: "Approve → install",
	},
	{
		id: "10-walls",
		// 11s, not the storyboard's original 9: the S7 line reads 10.0s and the
		// renderer TRIMS a VO to its scene budget (`atrim=0:seconds`), so a 9s
		// budget cut "…it sees what she granted. Nothing more." mid-sentence —
		// the one line the whole scene exists to deliver. The captured clip is
		// 11.0s, so 11 also plays it at ~1× instead of compressing it.
		seconds: 11,
		vo: "Here's the quiet part: this is untrusted code — hers, or the agent's — behind the same walls as everything else. It sees what she granted. Nothing more.",
		caption: "Same walls as everything else",
	},
	{
		id: "11-title",
		seconds: 5,
		vo: "An OS for your knowledge, that runs the apps you write. getbrainstorm dot online.",
		titleCard: true,
	},
];
