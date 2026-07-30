/** Scene table for the **build-an-app** episode (VID-build-apps) — the
 *  self-hosting story: two files typed in the code editor become a real,
 *  sandboxed, capability-gated app in the grid, reading real vault data — and
 *  then the agent writes a SECOND real app the same way.
 *
 *  Same shape as the other reels (id · seconds · speed · vo · caption ·
 *  slide/titleCard) so `voiceover.mjs` and `render.mjs` drive it unchanged
 *  via `PROMO_SCENES`. `slide`/`titleCard` entries are render-side cards with
 *  no captured clip; every other id maps to a `<id>.mov` recorded by
 *  `promo/vid-build-apps.spec.ts`.
 *
 *  Ids mirror `docs/marketing/vid-build-apps.md` §Scene table 1:1.
 *
 *  ── Three rules this table is built on ──────────────────────────────────
 *
 *  1. **`seconds` is a hard ceiling on the VO** (`render.mjs` does
 *     `atrim=0:seconds`), so every budget below carries ≥0.5s of headroom
 *     over its measured line. Re-run `promo:vo:build-apps` after ANY wording
 *     change — it prints `<line>s / <budget>s` per scene and flags overruns.
 *  2. **`speed` is a FLOOR, not the compression.** `render.mjs` raises it
 *     per scene to `dur / (seconds - 0.2)` (cap 3×) so the whole captured
 *     action always fits. A hand-set floor above what the clip needs buys a
 *     frozen tail — which is only ever right when the clip's LAST frame is a
 *     deliberate hold. This table sets NO floors: every budget below is fitted
 *     to a measured clip, and where a hold is wanted the driver shoots it.
 *     **Never fit a budget to a clip recorded while something else is
 *     building**: the first dry run ran alongside `build:apps` and every clip
 *     came out 30-60% long.
 *  3. **A beat that is only motion gets cut.** *(pacing pass 2026-07-30, after
 *     the owner watched the 1:32 cut: "you have a screen where just mouse move
 *     at the start and 2 times install dialogue shows — it needs to be more
 *     dynamic".)* Three structural consequences, and they are why the ids
 *     below no longer match the previous cut's:
 *
 *       - the opening grid scan is **3s**, not 5-6, and ends parked on the
 *         Code tile — a hand-off, not a tour;
 *       - the picker → consent-sheet flow is shown **once, in full**, for the
 *         app she writes (`04`+`05`). The agent's app re-uses the same path in
 *         **one 4s scene** (`13`), because the viewer already knows it; and the
 *         walls beat no longer recalls the consent sheet at all — it makes the
 *         point *inside the running app*, where the grant is printed in the
 *         header and the granted/refused probe pair sits under it;
 *       - the seconds that buys go to **the agent actually working**: asking
 *         (`09`), the drafts arriving and being read (`10`), approving (`11`),
 *         and the files landing in the Code editor's tree (`12`). That act ran
 *         15s in the previous cut and runs **29s** here, in the same 92s total.
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
		seconds: 3,
		vo: "Nothing built in does client pulse.",
		caption: "The gap",
	},
	{
		id: "02-manifest",
		seconds: 8,
		vo: "So she writes one. Two files. The manifest says what it is — and exactly what it may touch.",
		caption: "The manifest",
	},
	{
		id: "03-page",
		// 9: the skeleton is 510 characters typed in 2-char runs (~9s of clip),
		// which lands ~1.3× — fast, confident typing rather than the blur a
		// shorter budget produces.
		seconds: 9,
		vo: "And a page. It asks the vault for her clients and draws them. Real data — no export, no build step.",
		caption: "The page",
	},
	{
		id: "04-install-from-vault",
		seconds: 5,
		vo: "She installs it straight from the vault. No zip, no terminal.",
		caption: "Install from the vault",
	},
	{
		id: "05-consent",
		// The hold that matters is MID-clip (the sheet), so the driver spends the
		// scene's seconds on the sheet rather than on a frozen tail.
		seconds: 5,
		vo: "Exactly what she's about to run — and what it asked for.",
		caption: "What it's allowed to do",
	},
	{
		id: "06-installed",
		seconds: 4,
		vo: "There it is. A real app in her grid.",
		caption: "Installed",
	},
	{
		id: "07-launch",
		seconds: 5,
		vo: "Its own window, its own sandbox, showing her actual clients.",
		caption: "It runs",
	},
	{
		id: "08-walls",
		// One continuous take with `07` — same app, same window, no staging
		// between them — so the cut lands as a beat inside a shot rather than a
		// scene change. The consent-sheet recall this scene used to open with is
		// gone: the grant is already printed in the app's own header.
		seconds: 6,
		vo: "It gets exactly what she granted. Ask for the whole vault, and the broker says no.",
		caption: "Same walls as everything else",
	},
	{
		id: "09-agent-ask",
		seconds: 7,
		vo: "Or she doesn't write it at all — she asks the agent for a milestones board.",
		caption: "Ask the agent",
	},
	{
		id: "10-agent-drafts",
		seconds: 8,
		vo: "It drafts two files: a manifest asking for the same single permission, and a page she reads before anything is saved.",
		caption: "It drafts a real app",
	},
	{
		id: "11-agent-approve",
		seconds: 6,
		vo: "She approves — and only then is anything written.",
		caption: "Approve",
	},
	{
		id: "12-agent-files",
		seconds: 4,
		vo: "The files land beside the ones she wrote.",
		caption: "In the vault, beside hers",
	},
	{
		id: "13-agent-install",
		// 5, not 4: the whole picker → row → sheet → confirm path is ~12s of
		// capture, and 4s put it at the renderer's 3× cap — i.e. one bad take away
		// from a truncated confirm. At 5 it plays ~2.5×, which is still the
		// "you already know this" compression the pacing pass asked for.
		seconds: 5,
		vo: "Same picker, same consent, same install.",
		caption: "Same install path",
	},
	{
		id: "14-payoff",
		seconds: 7,
		vo: "Two apps that weren't there this morning — one she wrote, one the agent wrote.",
		caption: "Two new apps in the grid",
	},
	{
		id: "15-title",
		seconds: 5,
		vo: "A knowledge OS that runs the apps you write. getbrainstorm dot online.",
		titleCard: true,
	},
];
