/**
 * VID-notes capture — a full walk of the Notes app's functionality (the first
 * app-showcase episode). Drives Notes through a dozen beats against a fresh
 * synthetic "Northbound Studio" vault and records one clip per beat via the
 * shared promo stage (`lib/promo-stage.ts`); `notes-scenes.mjs` + the promo
 * voiceover/render tools assemble the clips into `vid-notes-1080p.mp4`.
 *
 * Scene ids mirror the content scenes in `tools/promo/notes-scenes.mjs`
 * (00-slide / 12-title are render-side cards, not captured here). Drivers are
 * defensive: a selector drifting never kills the run — the beat still records
 * real footage of the open surface.
 *
 *   bun run promo:capture:notes && bun run promo:vo:notes && bun run promo:render:notes
 */

import { join } from "node:path";
import { test } from "@playwright/test";
import { beat, glideClick, glideTo, typeHuman } from "../lib/humanize";
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

	/** New empty note, editor body focused (reliable — click the contenteditable
	 *  itself; a coordinate click lands on the block handles and steals focus). */
	const newNote = async (): Promise<void> => {
		await notes.locator('[aria-label="New note"]').first().click().catch(() => undefined);
		await notes.waitForTimeout(1000);
		await notes.locator('[contenteditable="true"]').first().click().catch(() => undefined);
		await notes.waitForTimeout(250);
	};

	/** Open a seeded doc by sidebar label. */
	const openDoc = async (label: RegExp): Promise<void> => {
		const doc = notes.locator(".notes__sidebar-item").filter({ hasText: label }).first();
		if (await doc.count().catch(() => 0)) {
			await glideClick(notes, doc).catch(() => undefined);
			await beat(notes, 800);
		}
	};

	// ── 01: WRITE — clean typography ──────────────────────────────────────
	await s.scene("01-write", async () => {
		await s.film(notes);
		await newNote();
		await typeHuman(notes, "Harbor & Co — brand direction", 26);
		await notes.keyboard.press("Enter");
		await typeHuman(
			notes,
			"Nautical, without the clichés. Deep indigo, a single warm accent, generous space.",
			15,
		);
		await beat(notes, 900);
	});

	// ── 02: SLASH MENU — the full block palette ───────────────────────────
	await s.scene("02-slash", async () => {
		await s.film(notes);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "/", 40);
		await beat(notes, 1500);
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.keyboard.press("Backspace").catch(() => undefined);
	});

	// ── 03: RICH BLOCKS — markdown shortcuts (fresh paragraph each) ───────
	await s.scene("03-blocks", async () => {
		await s.film(notes);
		await typeHuman(notes, "# Deliverables", 20);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "- Logo suite", 16);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Packaging mockups", 16);
		await notes.keyboard.press("Enter");
		await notes.keyboard.press("Enter"); // exit bullet list
		await typeHuman(notes, "1. Research", 16);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Design", 16);
		await notes.keyboard.press("Enter");
		await notes.keyboard.press("Enter"); // exit numbered list
		await typeHuman(notes, "[] Send direction two", 16);
		await notes.keyboard.press("Enter");
		await notes.keyboard.press("Enter"); // exit checklist
		await typeHuman(notes, "> Ship the first round by Thursday.", 16);
		await beat(notes, 1200);
	});

	// ── 04: CODE BLOCK — fresh note, /code, type source ───────────────────
	await s.scene("04-code", async () => {
		await s.film(notes);
		await newNote();
		await typeHuman(notes, "Brand tokens", 22);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "/code", 26);
		await beat(notes, 900);
		await notes.keyboard.press("Enter"); // insert Code (top match)
		await beat(notes, 500);
		await typeHuman(notes, "const indigo = '#4f46e5';", 15);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "const accent = '#f59e0b';", 15);
		await beat(notes, 1100);
	});

	// ── 05: INLINE FORMATTING — select a line → the toolbar ───────────────
	await s.scene("05-format", async () => {
		await s.film(notes);
		await newNote();
		await typeHuman(notes, "Brand voice", 22);
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Warm, honest, a little nautical — never precious.", 15);
		await notes.keyboard.press("Home");
		await notes.keyboard.press("Shift+End");
		await beat(notes, 1100);
		const bold = notes.locator('[aria-label*="Bold"], [data-format="bold"]').first();
		if (await bold.count().catch(() => 0)) await glideClick(notes, bold).catch(() => undefined);
		else await notes.keyboard.press("Meta+b").catch(() => undefined);
		await beat(notes, 1000);
	});

	// ── 06: MENTIONS & LINKS — @ typeahead → linked chip ──────────────────
	await s.scene("06-mention", async () => {
		await s.film(notes);
		await notes.keyboard.press("End");
		await notes.keyboard.press("Enter");
		await typeHuman(notes, "Owner ", 22);
		await notes.keyboard.type("@");
		await beat(notes, 1400);
		await notes.keyboard.press("ArrowDown").catch(() => undefined);
		await beat(notes, 500);
		await notes.keyboard.press("Enter").catch(() => undefined);
		await beat(notes, 1100);
	});

	// ── 07: PROPERTIES — seeded brief → panel → add a property ────────────
	await s.scene("07-properties", async () => {
		await s.film(notes);
		await openDoc(/Brand brief/i);
		const props = notes
			.locator('[aria-controls="notes-props"], [aria-label*="roperties"], [aria-label*="nspector"]')
			.first();
		if (await props.count().catch(() => 0)) {
			await glideClick(notes, props).catch(() => undefined);
			await beat(notes, 1000);
		}
		const addProp = notes.getByRole("button", { name: /add property/i }).first();
		if (await addProp.count().catch(() => 0)) {
			await glideClick(notes, addProp).catch(() => undefined);
			await beat(notes, 1300);
			// Pick "Status" from the property-type menu.
			const status = notes.getByText(/^\s*Status\s*$/i).first();
			if (await status.count().catch(() => 0)) {
				await glideClick(notes, status).catch(() => undefined);
				await beat(notes, 1200);
			}
			await notes.keyboard.press("Escape").catch(() => undefined);
		}
		await beat(notes, 700);
	});

	// ── 08: ICONS — click the note icon → the emoji picker grid ───────────
	await s.scene("08-icon", async () => {
		await s.film(notes);
		const icon = notes
			.locator('.notes__doc-icon, .notes__title-icon, [aria-label*="icon" i], [aria-label*="emoji" i]')
			.first();
		if (await icon.count().catch(() => 0)) {
			await glideClick(notes, icon).catch(() => undefined);
			await beat(notes, 1800); // hold the open emoji-picker grid
			await notes.keyboard.press("Escape").catch(() => undefined);
		}
		await beat(notes, 700);
	});

	// ── 09: COMMENTS — the Comments tab → draft a comment ─────────────────
	await s.scene("09-comments", async () => {
		await s.film(notes);
		const commentsTab = notes
			.locator('[role="tab"], .notes__panel-tab, button')
			.filter({ hasText: /^\s*Comments\s*$/i })
			.first();
		if (await commentsTab.count().catch(() => 0)) {
			await glideClick(notes, commentsTab).catch(() => undefined);
			await beat(notes, 1100);
		}
		const composer = notes
			.locator('[placeholder*="omment"], [aria-label*="omment"], textarea, [contenteditable="true"]')
			.last();
		if (await composer.count().catch(() => 0)) {
			await composer.click().catch(() => undefined);
			await typeHuman(notes, "Love direction two — let's take it to the client.", 16);
		}
		await beat(notes, 1000);
	});

	// ── 10: SEARCH & ORGANIZE — search box → jump between notes ───────────
	await s.scene("10-organize", async () => {
		await s.film(notes);
		const search = notes
			.locator('[placeholder*="Search notes" i], .notes__search input, [aria-label*="earch" i]')
			.first();
		if (await search.count().catch(() => 0)) {
			await glideClick(notes, search).catch(() => undefined);
			await typeHuman(notes, "Harbor", 40);
			await beat(notes, 1300);
		}
		// Jump to a result / another note in the sidebar.
		const row = notes.locator(".notes__sidebar-item").filter({ hasText: /Positioning|Harbor/i }).first();
		if (await row.count().catch(() => 0)) {
			await glideClick(notes, row).catch(() => undefined);
			await beat(notes, 1000);
		}
	});

	// ── 11: NOTE ACTIONS — object menu (right-click title) + read-only lock ─
	await s.scene("11-actions", async () => {
		await s.film(notes);
		// The object menu opens on a right-click of the title (per the codebase).
		const title = notes.locator(".app-header__title").first();
		if (await title.count().catch(() => 0)) {
			const box = await title.boundingBox().catch(() => null);
			if (box) await glideTo(notes, box.x + box.width / 2, box.y + box.height / 2, 450);
			await title.click({ button: "right" }).catch(() => undefined);
			await beat(notes, 1700); // hold the open actions menu
			await notes.keyboard.press("Escape").catch(() => undefined);
		}
		// Toggle the read-only lock in the header.
		const lock = notes
			.locator('[aria-label*="lock" i], [aria-label*="read-only" i], [aria-label*="read only" i]')
			.first();
		if (await lock.count().catch(() => 0)) {
			await glideClick(notes, lock).catch(() => undefined);
			await beat(notes, 1100);
			await glideClick(notes, lock).catch(() => undefined);
		}
		await beat(notes, 700);
	});

	await s.finish();
	console.log(`[vid-notes] clips → ${CLIPS}`);
});
