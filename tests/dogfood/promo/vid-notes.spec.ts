/**
 * VID-notes capture — the tight ~65s Notes highlight reel (the first app-
 * showcase episode). Drives the Notes app through seven beats against a fresh
 * synthetic "Northbound Studio" vault and records one clip per beat via the
 * shared promo stage (`lib/promo-stage.ts`); `notes-scenes.mjs` + the promo
 * voiceover/render tools assemble the clips into `vid-notes-1080p.mp4`.
 *
 * Scene ids mirror the content scenes in `tools/promo/notes-scenes.mjs`
 * (00-slide / 08-title are render-side cards, not captured here). Drivers are
 * defensive: a selector drifting never kills the run — the beat still records
 * real footage of the open surface.
 *
 *   bun run promo:capture:notes && bun run promo:vo:notes && bun run promo:render:notes
 */

import { join } from "node:path";
import { type Page, test } from "@playwright/test";
import { beat, glideClick, typeHuman } from "../lib/humanize";
import { launchPromoStage } from "../lib/promo-stage";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const DATA = join(HARNESS, "tests", "dogfood", ".promo-notes-data");
const CLIPS = join(HARNESS, "tests", "dogfood", ".promo-notes", "clips");
const NOTES = "io.brainstorm.notes";

test("capture VID-notes reel", async () => {
	test.setTimeout(1_200_000);
	const s = await launchPromoStage({ dataDir: DATA, clipsDir: CLIPS });

	await s.createVault("Northbound Studio", join(DATA, "vault"));
	await s.waitForSession();
	await s.seedMarketing();

	const notes = await s.openApp(NOTES);

	const body = (): ReturnType<Page["locator"]> => notes.locator('[contenteditable="true"]').first();

	/** New empty note; caret parked in the title line (top of the editor). */
	const newNote = async (): Promise<void> => {
		await notes.locator('[aria-label="New note"]').first().click().catch(() => undefined);
		await notes.waitForTimeout(1000);
		// The doc title is the first editable line — click it (fixed stage, so the
		// position is stable) so the title populates rather than the body.
		const titleEl = notes
			.locator('[data-placeholder="Title"], [placeholder="Title"], [aria-label="Title"]')
			.first();
		if (await titleEl.count().catch(() => 0)) await titleEl.click().catch(() => undefined);
		else await notes.mouse.click(712, 138).catch(() => undefined);
	};

	/** Open a specific seeded doc by sidebar label. */
	const openDoc = async (label: RegExp): Promise<void> => {
		const doc = notes.locator(".notes__sidebar-item").filter({ hasText: label }).first();
		if (await doc.count().catch(() => 0)) {
			await glideClick(notes, doc).catch(() => undefined);
			await beat(notes, 800);
		}
	};

	// ── 01: WRITE — clean typography, words front and center ──────────────
	await s.scene("01-write", async () => {
		await s.film(notes);
		await newNote();
		await typeHuman(notes, "Harbor & Co — brand direction", 26);
		await notes.keyboard.press("Enter");
		await typeHuman(
			notes,
			"Nautical, without the clichés. Deep indigo, a single warm accent, generous space.",
			16,
		);
		await beat(notes, 900);
	});

	// ── 02: SLASH MENU — the discoverability affordance ───────────────────
	await s.scene("02-slash", async () => {
		await s.film(notes);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "/", 40);
		await beat(notes, 1500);
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.keyboard.press("Backspace").catch(() => undefined);
	});

	// ── 03: RICH BLOCKS — markdown shortcuts build structure ──────────────
	//     Each shortcut fires from a FRESH paragraph — a bullet list is exited
	//     with an Enter on the empty item before the quote, so `>` converts.
	await s.scene("03-blocks", async () => {
		await s.film(notes);
		await typeHuman(notes, "# Deliverables", 22);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Three things to ship this week:", 16);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "- Logo suite", 18);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Packaging mockups", 18);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Launch microsite", 18);
		await notes.keyboard.press("Enter");
		await notes.keyboard.press("Enter"); // empty bullet → exit the list
		await typeHuman(notes, "> Ship the first round by Thursday.", 18);
		await beat(notes, 1200);
	});

	// ── 04: INLINE FORMATTING — select text → the format toolbar ──────────
	await s.scene("04-format", async () => {
		await s.film(notes);
		await notes.keyboard.press("Home");
		await notes.keyboard.press("Shift+End");
		await beat(notes, 1100);
		const bold = notes.locator('[aria-label*="Bold"], [data-format="bold"]').first();
		if (await bold.count().catch(() => 0)) await glideClick(notes, bold).catch(() => undefined);
		else await notes.keyboard.press("Meta+b").catch(() => undefined);
		await beat(notes, 900);
	});

	// ── 05: MENTIONS & LINKS — connect the note to the vault ──────────────
	await s.scene("05-mention", async () => {
		await s.film(notes);
		await notes.keyboard.press("End");
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Owner ", 24);
		await notes.keyboard.type("@");
		await beat(notes, 1400);
		// Keyboard-pick the first offered person (the mention typeahead handles
		// arrows/Enter regardless of its DOM shape).
		await notes.keyboard.press("ArrowDown").catch(() => undefined);
		await beat(notes, 500);
		await notes.keyboard.press("Enter").catch(() => undefined);
		await beat(notes, 1100);
	});

	// ── 06: PROPERTIES — a document that is also data ─────────────────────
	//     The seeded brief carries real properties; open its panel, then add
	//     one on camera so the affordance is visible either way.
	await s.scene("06-properties", async () => {
		await s.film(notes);
		await openDoc(/Brand brief/i);
		const props = notes
			.locator('[aria-controls="notes-props"], [aria-label*="roperties"], [aria-label*="nspector"]')
			.first();
		if (await props.count().catch(() => 0)) {
			await glideClick(notes, props).catch(() => undefined);
			await beat(notes, 1100);
		}
		const addProp = notes.getByRole("button", { name: /add property/i }).first();
		if (await addProp.count().catch(() => 0)) {
			await glideClick(notes, addProp).catch(() => undefined);
			await beat(notes, 1300);
			await notes.keyboard.press("Escape").catch(() => undefined);
		}
		await beat(notes, 700);
	});

	// ── 07: COMMENTS — collaboration lives with the work ──────────────────
	await s.scene("07-comments", async () => {
		await s.film(notes);
		// The right panel's second tab (Properties | Comments).
		const commentsTab = notes
			.locator('[role="tab"], .notes__panel-tab, button')
			.filter({ hasText: /^\s*Comments\s*$/i })
			.first();
		if (await commentsTab.count().catch(() => 0)) {
			await glideClick(notes, commentsTab).catch(() => undefined);
			await beat(notes, 1200);
		}
		// Focus the composer and draft a comment (don't send — no need).
		const composer = notes
			.locator('[placeholder*="omment"], [aria-label*="omment"], textarea, [contenteditable="true"]')
			.last();
		if (await composer.count().catch(() => 0)) {
			await composer.click().catch(() => undefined);
			await typeHuman(notes, "Love direction two — let's take it to the client.", 18);
		}
		await beat(notes, 1100);
	});

	await s.finish();
	console.log(`[vid-notes] clips → ${CLIPS}`);
});
