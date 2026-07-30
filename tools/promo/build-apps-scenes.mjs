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
 *  ── Two rules this table is built on ────────────────────────────────────
 *
 *  1. **`seconds` is a hard ceiling on the VO** (`render.mjs` does
 *     `atrim=0:seconds`), so every budget below carries ≥0.6s of headroom
 *     over its measured line. Re-run `promo:vo:build-apps` after ANY wording
 *     change — it prints `<line>s / <budget>s` per scene and flags overruns.
 *  2. **`speed` is a FLOOR, not the compression.** `render.mjs` raises it
 *     per scene to `dur / (seconds - 0.2)` (cap 3×) so the whole captured
 *     action always fits. A hand-set floor above what the clip needs buys a
 *     frozen tail — which is only ever right when the clip's LAST frame is a
 *     deliberate hold (a picker, a reveal, a card). Those three scenes set a
 *     floor below; everywhere else the driver paces the beat and the
 *     auto-derived factor does the work.
 *
 *  ── Ordering: why the refusal is scene 08, not the last thing you see ───
 *
 *  The first cut ran … agent → **walls** → title, so the final content frame
 *  of the episode was a red `refused — …` line under a mostly-empty page. It
 *  is the proof beat, but as an ENDING it reads "the app crashed". The
 *  refusal now lands directly after `07-launch` — the app has just read her
 *  clients, so watching the SAME app be told no is at its most legible right
 *  there — and the episode closes on `11-payoff`: the grid carrying both new
 *  apps, and the one she wrote running.
 *
 *    bun run promo:capture:build-apps
 *    bun run promo:vo:build-apps
 *    bun run promo:render:build-apps
 */

export const SCENES = [
	{
		id: "00-slide-hook",
		// 5, not the 4 the 3.0s line needs: it buys the first chapter marker its
		// 10s minimum (see `vid-build-apps-youtube.md` §Chapters note).
		seconds: 5,
		vo: "An OS for your knowledge — that runs the apps you write.",
		slide: { title: "It runs the apps you write", sub: "An OS for your knowledge" },
	},
	{
		id: "01-the-gap",
		seconds: 5,
		vo: "Mira wants a client pulse board. Nothing built in does it — she writes one.",
		caption: "The gap",
	},
	{
		id: "02-manifest",
		seconds: 10,
		vo: "An app here is two files. A manifest that says what it is — and exactly what it may touch. One line: read her projects. Nothing else.",
		caption: "The manifest",
	},
	{
		id: "03-page",
		seconds: 9,
		vo: "And a page. It asks the vault for her clients and draws them. Real data — no export, no build step.",
		caption: "The page",
	},
	{
		id: "04-install-from-vault",
		// Floor: the picker is reached through a button and a menu row — travel,
		// not content. Compress the travel; the frozen tail is the candidate list.
		speed: 1.3,
		seconds: 6,
		vo: "Now she installs it — straight from the vault. No folder, no zip, no terminal.",
		caption: "Install from the vault",
	},
	{
		id: "05-consent",
		// No floor: the hold that matters is MID-clip (the sheet), so a frozen
		// tail here would sit on the marketplace behind it. The driver spends the
		// scene's seconds on the sheet instead.
		seconds: 6,
		vo: "Brainstorm shows her exactly what she's about to run, and what it asked for.",
		caption: "What it's allowed to do",
	},
	{
		id: "06-installed",
		// Floor: the toast and the marketplace dismissal are travel; the last
		// frame — the new tile under the cursor — is the beat. Freeze on it.
		speed: 1.2,
		seconds: 5,
		vo: "And there it is. A real app, in her grid.",
		caption: "Installed",
	},
	{
		id: "07-launch",
		seconds: 7,
		vo: "Its own window, its own sandbox — showing her actual clients. Typed to installed in about a minute.",
		caption: "It runs",
	},
	{
		id: "08-walls",
		seconds: 10,
		vo: "Here's the quiet part: untrusted code, behind the same walls as everything else. It gets what she granted — ask for more, and the broker says no.",
		caption: "Same walls as everything else",
	},
	{
		id: "09-agent-drafts",
		// Floor: the composer type-in is travel; the last frame is the second
		// staged code card, which is worth holding.
		speed: 1.2,
		seconds: 9,
		vo: "Or she doesn't write it at all. She asks the agent, and it drafts the files — code she can read before anything is saved.",
		caption: "Or let the agent write it",
	},
	{
		id: "10-agent-approve",
		seconds: 7,
		vo: "She approves them, they land in the vault as real files, and install the same way.",
		caption: "Approve → install",
	},
	{
		id: "11-payoff",
		seconds: 8,
		vo: "Two apps that didn't exist this morning. One she wrote, one she asked for — both in the grid, both behind the same walls.",
		caption: "Apps she wrote, running",
	},
	{
		id: "12-title",
		seconds: 5,
		vo: "An OS for your knowledge that runs the apps you write. getbrainstorm dot online.",
		titleCard: true,
	},
];
