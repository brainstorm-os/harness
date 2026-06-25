/**
 * Probe 210b — settles three threads session 210 left hanging:
 *   1. does the Notes embed picker commit by MOUSE (Enter/Escape were dead)?
 *   2. the Timeline path: switch a view's kind via View settings, then drag
 *      a bar (9.12.10);
 *   3. graph drag-to-link starting from an actual node dot (9.13.11).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("probe: embed-by-mouse, timeline via view settings, graph link-drag (210b)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("210b-probe-embed-timeline-link");
	try {
		s.chat(SPEAKER.Priya, "Probe pass on the three loose ends from Mira's hub day.");

		// ---- 1. Notes embed picker, mouse path ------------------------------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		// Reuse yesterday's hub note (first sidebar row = most recent).
		const hub = notes
			.locator("aside li, [class*='sidebar'] li")
			.filter({ hasText: "Q3 operating hub" })
			.first();
		if (await hub.isVisible().catch(() => false)) {
			await hub.click().catch(() => undefined);
			await notes.waitForTimeout(1500);
		}
		// Click at the end of the body and add the embed via mouse.
		const body = notes.locator('[contenteditable="true"]').first();
		await body.click().catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("/database", { delay: 50 });
		await notes.waitForTimeout(1000);
		const dbCommand = notes
			.locator(
				'.fm-menu button:has-text("Database"), [role="menuitem"]:has-text("Database"), [role="option"]:has-text("Database")',
			)
			.first();
		if (await dbCommand.isVisible().catch(() => false)) {
			await dbCommand.click().catch(() => undefined);
		} else {
			await notes.keyboard.press("Enter");
		}
		await notes.waitForTimeout(1200);
		const pickerRow = notes.locator('text="Content Calendar"').last();
		const rowVisible = await pickerRow.isVisible().catch(() => false);
		s.note(`picker row "Content Calendar" visible: ${rowVisible}`);
		if (rowVisible) {
			await pickerRow.click().catch(() => undefined);
			await notes.waitForTimeout(3500);
			await s.shot(notes, "01-after-mouse-pick");
			const embedCount = await notes
				.locator('iframe, [class*="embed"]')
				.count()
				.catch(() => 0);
			s.note(`embed nodes in doc after mouse pick: ${embedCount}`);
		} else {
			await s.shot(notes, "01-picker-missing");
		}

		// ---- 2. Database timeline via view settings -------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		const contentCal = db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/content calendar/i")
			.first();
		await contentCal.click().catch(() => undefined);
		await db.waitForTimeout(1500);
		// Select the probe-created "Grid 2" tab if present (sacrificial view).
		const grid2 = db.locator('[role="tab"]:has-text("Grid 2"), button:has-text("Grid 2")').first();
		if (await grid2.isVisible().catch(() => false)) {
			await grid2.click().catch(() => undefined);
			await db.waitForTimeout(1000);
		}
		const settingsBtn = db.locator("#toolbar-settings").first();
		if (await settingsBtn.isVisible().catch(() => false)) {
			await settingsBtn.click().catch(() => undefined);
			await db.waitForTimeout(900);
			await s.shot(db, "02-view-settings");
			// Find the layout/kind row and pick Timeline.
			const layoutRow = db
				.locator(
					'.fm-menu button:has-text("Layout"), [role="menuitem"]:has-text("Layout"), button:has-text("Grid")',
				)
				.first();
			await layoutRow.click().catch(() => undefined);
			await db.waitForTimeout(800);
			await s.shot(db, "03-layout-page");
			const timelineOpt = db
				.locator('.fm-menu button:has-text("Timeline"), [role="menuitem"]:has-text("Timeline")')
				.first();
			if (await timelineOpt.isVisible().catch(() => false)) {
				await timelineOpt.click().catch(() => undefined);
				await db.waitForTimeout(1500);
				await db.keyboard.press("Escape").catch(() => undefined);
				await db.waitForTimeout(800);
				await s.shot(db, "04-timeline-view");
				// Drag the first bar right by ~2 columns.
				const bar = db
					.locator(
						'[class*="timeline"] [class*="bar"], [class*="timeline"] [class*="item"], [class*="timeline"] [draggable]',
					)
					.first();
				const box = await bar.boundingBox().catch(() => null);
				s.note(`timeline bar box: ${JSON.stringify(box)}`);
				if (box) {
					await db.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
					await db.mouse.down();
					await db.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 12 });
					await db.mouse.up();
					await db.waitForTimeout(1500);
					const after = await bar.boundingBox().catch(() => null);
					s.note(`bar after drag: ${JSON.stringify(after)}`);
					await s.shot(db, "05-timeline-after-drag");
				} else {
					const timelineClasses = await db
						.locator('[class*="timeline"] *')
						.evaluateAll((els) =>
							[...new Set(els.slice(0, 60).map((el) => el.className?.toString?.() ?? ""))].slice(0, 20),
						)
						.catch(() => [] as string[]);
					s.note(`timeline inner classes: ${JSON.stringify(timelineClasses)}`);
				}
			} else {
				s.note("no Timeline option on layout page");
				await db.keyboard.press("Escape").catch(() => undefined);
			}
		} else {
			s.note("no #toolbar-settings button");
		}

		// ---- 3. Graph link-drag from a real node ----------------------------
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(4000);
		// Close the filter panel if open so the canvas is unobstructed.
		const filterToggle = graph.locator('[aria-label*="filter" i], [aria-pressed="true"]').first();
		await filterToggle.click().catch(() => undefined);
		await graph.waitForTimeout(800);
		await s.shot(graph, "06-graph-clean");
		// Find a labeled node: the DOM labels carry the node positions.
		const label = graph
			.locator('[class*="label"]')
			.filter({ hasText: /northbound/i })
			.first();
		let pos = await label.boundingBox().catch(() => null);
		if (!pos) {
			const anyLabel = graph.locator('[class*="label"]').first();
			pos = await anyLabel.boundingBox().catch(() => null);
		}
		s.note(`node label box: ${JSON.stringify(pos)}`);
		if (pos) {
			// The dot sits just above the label text.
			const nx = pos.x + pos.width / 2;
			const ny = pos.y - 8;
			await graph.keyboard.down("Alt");
			await graph.mouse.move(nx, ny);
			await graph.mouse.down();
			await graph.mouse.move(nx + 150, ny + 40, { steps: 12 });
			await s.shot(graph, "07-link-rubber-band");
			// Release over another node if one is near; otherwise empty space.
			await graph.mouse.up();
			await graph.keyboard.up("Alt");
			await graph.waitForTimeout(1000);
			await s.shot(graph, "08-after-release");
			const menuRows = await graph
				.locator('[role="menuitem"], .fm-menu button')
				.allTextContents()
				.catch(() => [] as string[]);
			s.note(`release menu rows: ${JSON.stringify(menuRows.slice(0, 10))}`);
			await graph.keyboard.press("Escape").catch(() => undefined);
		}

		s.chat(SPEAKER.Priya, "Probe done — answers in the notes.");
	} finally {
		await s.finish();
	}
});
