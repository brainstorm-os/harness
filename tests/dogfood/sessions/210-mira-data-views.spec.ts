/**
 * Session 210 — Mira wires her operating hub together with the new data
 * surfaces: the Notes `/database` + `/graph` slash commands (9.12.12 /
 * 9.13.12), block copy-link (B11.13), the Database timeline's drag-to-move +
 * dependency arrows (9.12.10), and the Graph's per-view layout persistence +
 * drag-to-link (9.13.6 / 9.13.11).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira embeds live views and works the timeline + graph (210)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("210-mira-data-views");
	try {
		s.chat(
			SPEAKER.Mira,
			"Hub day. The ops doc should carry the live Content Calendar and the graph inline now — and the timeline should finally let me drag dates instead of editing cells.",
		);

		// ---- Notes: /database + /graph embeds ------------------------------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		const newNote = notes.locator('[aria-label*="new" i], button:has-text("New")').first();
		await newNote.click().catch(() => undefined);
		await notes.waitForTimeout(1500);
		await notes.keyboard.type("Q3 operating hub — live views", { delay: 30 });
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(600);
		await notes.keyboard.type("Editorial pipeline, embedded live:", { delay: 20 });
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("/database", { delay: 60 });
		await notes.waitForTimeout(1200);
		await s.shot(notes, "01-slash-database-menu");
		const slashRows = await notes
			.locator('[role="menuitem"], [role="option"], .fm-menu button')
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`slash menu rows for /database: ${JSON.stringify(slashRows.slice(0, 10))}`);
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(1200);
		await s.shot(notes, "02-database-embed-picker");
		// The embed picker should list ONLY List/v1 collections — pick the first.
		const pickerRows = await notes
			.locator('[role="option"], [role="menuitem"], [class*="picker"] button, .fm-menu button')
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`embed picker rows: ${JSON.stringify(pickerRows.slice(0, 10))}`);
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(3500);
		await s.shot(notes, "03-database-embedded");

		// /graph on the next line.
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.keyboard.press("End").catch(() => undefined);
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("/graph", { delay: 60 });
		await notes.waitForTimeout(1200);
		await s.shot(notes, "04-slash-graph-menu");
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(1200);
		await s.shot(notes, "05-graph-embed-picker");
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(3500);
		await s.shot(notes, "06-graph-embedded");

		// Block copy-link: hover the first paragraph, open the block ⋯ menu.
		const firstPara = notes.locator('[contenteditable="true"] p, .editor p').first();
		if (await firstPara.isVisible().catch(() => false)) {
			await firstPara.hover().catch(() => undefined);
			await notes.waitForTimeout(700);
			const blockHandle = notes
				.locator('[aria-label*="block" i], [class*="block-action"], [class*="drag-handle"]')
				.first();
			if (await blockHandle.isVisible().catch(() => false)) {
				await blockHandle.click().catch(() => undefined);
				await notes.waitForTimeout(800);
				const actionRows = await notes
					.locator('[role="menuitem"], .fm-menu button')
					.allTextContents()
					.catch(() => [] as string[]);
				s.note(`block action rows: ${JSON.stringify(actionRows.slice(0, 12))}`);
				await s.shot(notes, "07-block-action-menu");
				const copyLink = notes
					.locator('[role="menuitem"]:has-text("Copy link"), .fm-menu button:has-text("Copy link")')
					.first();
				if (await copyLink.isVisible().catch(() => false)) {
					await copyLink.click().catch(() => undefined);
					s.note("clicked Copy link on a block");
				} else {
					s.note("no Copy link row in block menu");
					await notes.keyboard.press("Escape").catch(() => undefined);
				}
			} else {
				s.note("no block handle affordance found on hover");
			}
		}

		// ---- Database: timeline drag + dependencies ------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		const contentCal = db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/content/i")
			.first();
		if (await contentCal.isVisible().catch(() => false)) {
			await contentCal.click().catch(() => undefined);
			await db.waitForTimeout(1500);
		}
		await s.shot(db, "08-database-collection");
		// View strip: look for a Timeline view (or a way to add one).
		const viewTabs = await db
			.locator('[role="tab"], [class*="view-tab"], [class*="view-strip"] button')
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`view tabs: ${JSON.stringify(viewTabs)}`);
		const timelineTab = db
			.locator('[role="tab"]:has-text("Timeline"), button:has-text("Timeline")')
			.first();
		let onTimeline = false;
		if (await timelineTab.isVisible().catch(() => false)) {
			await timelineTab.click().catch(() => undefined);
			await db.waitForTimeout(1500);
			onTimeline = true;
		} else {
			// Try a new-view affordance.
			const addView = db
				.locator(
					'[aria-label*="view" i][aria-label*="new" i], [aria-label*="add view" i], [class*="view-strip"] [aria-label*="add" i]',
				)
				.first();
			if (await addView.isVisible().catch(() => false)) {
				await addView.click().catch(() => undefined);
				await db.waitForTimeout(800);
				await s.shot(db, "09-new-view-menu");
				const timelineOption = db
					.locator('[role="menuitem"]:has-text("Timeline"), .fm-menu button:has-text("Timeline")')
					.first();
				if (await timelineOption.isVisible().catch(() => false)) {
					await timelineOption.click().catch(() => undefined);
					await db.waitForTimeout(2000);
					onTimeline = true;
				} else {
					s.note("no Timeline option in new-view menu");
					await db.keyboard.press("Escape").catch(() => undefined);
				}
			} else {
				s.note("no Timeline tab and no add-view affordance found");
			}
		}
		if (onTimeline) {
			await s.shot(db, "10-timeline-view");
			// Drag the first timeline bar to the right by ~2 day-columns.
			const bar = db.locator('[class*="timeline"] [class*="bar"], [class*="timeline-item"]').first();
			const box = await bar.boundingBox().catch(() => null);
			s.note(`timeline first bar box: ${JSON.stringify(box)}`);
			if (box) {
				await db.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
				await db.mouse.down();
				await db.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 12 });
				await db.mouse.up();
				await db.waitForTimeout(1500);
				await s.shot(db, "11-timeline-after-drag");
				const after = await bar.boundingBox().catch(() => null);
				s.note(`bar after drag: ${JSON.stringify(after)} (moved = x differs from ${box.x})`);
			}
			// Dependencies toggle in view settings.
			const viewSettings = db
				.locator('[aria-label*="view settings" i], [aria-label*="settings" i]')
				.first();
			if (await viewSettings.isVisible().catch(() => false)) {
				await viewSettings.click().catch(() => undefined);
				await db.waitForTimeout(800);
				await s.shot(db, "12-view-settings");
				const depToggle = db.locator("text=/dependenc/i").first();
				if (await depToggle.isVisible().catch(() => false)) {
					await depToggle.click().catch(() => undefined);
					await db.waitForTimeout(1000);
					await db.keyboard.press("Escape").catch(() => undefined);
					await s.shot(db, "13-timeline-dependencies");
				} else {
					s.note("no Show-dependencies toggle found in view settings");
					await db.keyboard.press("Escape").catch(() => undefined);
				}
			}
		}

		// ---- Graph: layout persistence + drag-to-link ----------------------
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(4000);
		await s.shot(graph, "14-graph-open");
		const title = await graph
			.locator(".app-header__title")
			.first()
			.textContent()
			.catch(() => null);
		s.note(`graph header title: ${title}`);
		const canvas = graph.locator("canvas").first();
		const cbox = await canvas.boundingBox().catch(() => null);
		if (cbox) {
			const cx = cbox.x + cbox.width / 2;
			const cy = cbox.y + cbox.height / 2;
			// Plain drag from centre — should move a node (or pan); persisted per-view.
			await graph.mouse.move(cx, cy);
			await graph.mouse.down();
			await graph.mouse.move(cx + 120, cy + 60, { steps: 10 });
			await graph.mouse.up();
			await graph.waitForTimeout(1200);
			await s.shot(graph, "15-graph-after-drag");
			// Alt-drag from a fresh spot — the drag-to-create-link rubber band.
			await graph.keyboard.down("Alt");
			await graph.mouse.move(cx - 100, cy - 60);
			await graph.mouse.down();
			await graph.mouse.move(cx + 60, cy + 80, { steps: 10 });
			await s.shot(graph, "16-graph-link-rubber-band");
			await graph.mouse.up();
			await graph.keyboard.up("Alt");
			await graph.waitForTimeout(1000);
			await s.shot(graph, "17-graph-link-release-menu");
			const linkMenuRows = await graph
				.locator('[role="menuitem"], .fm-menu button')
				.allTextContents()
				.catch(() => [] as string[]);
			s.note(`link-release menu rows: ${JSON.stringify(linkMenuRows.slice(0, 10))}`);
			await graph.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("graph canvas has no bounding box");
		}

		s.chat(
			SPEAKER.Mira,
			"Hub wired. The doc now carries the pipeline and the map — if the embeds render live, this is the workflow I described in week one.",
		);
	} finally {
		await s.finish();
	}
});
