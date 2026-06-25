/**
 * Session 205 — Mira rebuilds the strategy surface with the new Whiteboard
 * tools (9.17.16 connector styling / 9.17.18 templates / 9.17.11 image
 * insertion / 9.17.9 freehand).
 *
 * Templates surface in the "New whiteboard" dropdown (Blank board / Kanban
 * columns / Flowchart / Mind map). Flowchart ships with connectors — the
 * direct route to exercising connector styling. Interaction hints from the
 * shipped bar: "S sticky · double-click to edit · drag a handle to connect".
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira maps the Q3 GTM on the whiteboard (205)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("205-mira-strategy-board-v2");
	try {
		s.chat(
			SPEAKER.Mira,
			"The whiteboard learned templates, connector styles, and images. Rebuilding the Q3 GTM map with the new tools.",
		);

		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		await s.shot(wb, "01-whiteboard-open");

		// New board from the Flowchart template (it ships with connectors).
		await wb
			.locator('button:has-text("New whiteboard")')
			.first()
			.click()
			.catch(() => undefined);
		await wb.waitForTimeout(800);
		await s.shot(wb, "02-template-menu");
		const flowchart = wb.getByText("Flowchart", { exact: true }).first();
		if (await flowchart.isVisible().catch(() => false)) {
			await flowchart.click().catch(() => undefined);
			await wb.waitForTimeout(1800);
			s.note("created a board from the Flowchart template");
			s.chat(
				SPEAKER.Mira,
				"New board straight from the Flowchart template — GTM skeleton in one click.",
			);
		} else {
			s.note("Flowchart template entry not visible in the New-whiteboard menu");
			await wb.keyboard.press("Escape").catch(() => undefined);
		}
		await s.shot(wb, "03-template-board");

		// Rename-by-using: the board title should reflect her artifact. Probe
		// whether the header title is editable (double-click).
		const title = wb
			.locator(".whiteboard__board-name, .app-header h1, .app-header [class*='title']")
			.first();
		await title.dblclick().catch(() => undefined);
		await wb.waitForTimeout(500);
		const titleInput = wb.locator("input:focus, [contenteditable='true']:focus").first();
		if ((await titleInput.count().catch(() => 0)) > 0) {
			await wb.keyboard.press("Meta+a").catch(() => undefined);
			await wb.keyboard.type("Q3 GTM map", { delay: 12 });
			await wb.keyboard.press("Enter").catch(() => undefined);
			s.note("renamed board via title dblclick");
		} else {
			s.note("board title not editable by double-click — how do I name my board?");
		}
		await s.shot(wb, "04-titled");

		// Select a template connector and restyle it (9.17.16).
		const stage = wb.locator(".wb-canvas, .wb-stage, [class*='canvas']").first();
		const box = await stage.boundingBox().catch(() => null);
		const edge = wb.locator("[data-edge-id], .wb-edge, svg [data-edge]").first();
		let edgeSelected = false;
		if (await edge.count().catch(() => 0)) {
			await edge.click({ force: true }).catch(() => undefined);
			edgeSelected = true;
		} else if (box) {
			// Flowchart connectors run between template nodes — click between the
			// first two shapes (center-ish of the template layout).
			await wb.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.35);
		}
		await wb.waitForTimeout(600);
		await s.shot(wb, "05-edge-select-attempt");
		const styleBtn = wb.locator('[aria-label^="Style"]').first();
		if (await styleBtn.isVisible().catch(() => false)) {
			await styleBtn.click().catch(() => undefined);
			await wb.waitForTimeout(900);
			await s.shot(wb, "06-style-menu");
			const dashed = wb.getByText(/dashed|dotted/i).first();
			if (await dashed.isVisible().catch(() => false)) {
				await dashed.click().catch(() => undefined);
				await wb.waitForTimeout(600);
				await s.shot(wb, "07-connector-styled");
				s.chat(
					SPEAKER.Mira,
					"Dashed connector = planned-but-not-committed. The map can finally say that.",
				);
			} else {
				s.note(`Style menu had no dash/dotted entry (edgeSelected=${edgeSelected})`);
				await wb.keyboard.press("Escape").catch(() => undefined);
			}
		} else {
			s.note("Style button not in header after selecting");
		}

		// Image insertion (9.17.11) via "Add to board".
		await wb
			.locator('[aria-label="Add to board"]')
			.first()
			.click()
			.catch(() => undefined);
		await wb.waitForTimeout(800);
		await s.shot(wb, "08-add-menu");
		const imgItem = wb.getByText(/image/i).first();
		if (await imgItem.isVisible().catch(() => false)) {
			await imgItem.click().catch(() => undefined);
			await wb.waitForTimeout(900);
			const fileInput = wb.locator('input[type="file"]').first();
			if ((await fileInput.count().catch(() => 0)) > 0) {
				await fileInput
					.setInputFiles("docs/art/icon/icon9.png")
					.catch((e) => s.note(`image setInputFiles failed: ${(e as Error).message}`));
				await wb.waitForTimeout(1500);
			} else {
				s.note("image insert opened no in-page file input (native dialog?) — can't drive, can't see");
				await wb.keyboard.press("Escape").catch(() => undefined);
			}
			await s.shot(wb, "09-after-image-attempt");
		} else {
			s.note("no image entry under Add to board");
			await wb.keyboard.press("Escape").catch(() => undefined);
		}

		// Two labeled stickies + a handle-drag connection, on empty canvas space.
		if (box) {
			const a = { x: box.x + box.width * 0.2, y: box.y + box.height * 0.68 };
			const b = { x: box.x + box.width * 0.42, y: box.y + box.height * 0.82 };
			for (const [pt, label] of [
				[a, "Leads: referrals + newsletter CTA"],
				[b, "Advisory: 2 retainers by Sept"],
			] as const) {
				// S spawns a sticky at the pointer and drops straight into inline
				// edit (F-199) — move, press, type. No click in between (that
				// would blur-commit the fresh editor).
				await wb.mouse.move(pt.x, pt.y);
				await wb.keyboard.press("s").catch(() => undefined);
				await wb.waitForTimeout(400);
				await wb.keyboard.type(label, { delay: 10 });
				// Commit by clicking neutral canvas, not Escape (Escape may discard).
				await wb.mouse.click(box.x + box.width * 0.08, box.y + box.height * 0.95);
				await wb.waitForTimeout(400);
			}
			await s.shot(wb, "10-stickies-placed");

			// Connect: select A, drag from its right-edge handle to B.
			await wb.mouse.click(a.x, a.y);
			await wb.waitForTimeout(500);
			const handle = wb.locator("[class*='handle']").first();
			const hbox = await handle.boundingBox().catch(() => null);
			if (hbox) {
				await wb.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
				await wb.mouse.down();
				await wb.mouse.move(b.x, b.y, { steps: 12 });
				await wb.mouse.up();
				s.note("dragged from a node handle to the second sticky");
			} else {
				s.note("no visible connect handle on the selected sticky");
			}
			await wb.waitForTimeout(800);
			await s.shot(wb, "11-connected");

			// Freehand annotation (9.17.9).
			await wb
				.locator('[aria-label="Pen"]')
				.first()
				.click()
				.catch(() => undefined);
			const cx = box.x + box.width * 0.08;
			const cy = box.y + box.height * 0.45;
			await wb.mouse.move(cx, cy);
			await wb.mouse.down();
			for (let i = 1; i <= 12; i++) {
				await wb.mouse.move(cx + i * 7, cy + Math.sin(i / 2) * 22, { steps: 2 });
			}
			await wb.mouse.up();
			await wb.waitForTimeout(700);
			await s.shot(wb, "12-freehand");
		}

		await s.shot(wb, "13-final-board");
		s.chat(SPEAKER.Mira, "Q3 GTM map drafted with the new tools — friction to the log.");
	} finally {
		await s.finish();
	}
});
