/**
 * Session 075 — Mira sketches a strategy board on the Whiteboard.
 *
 * She drops two sticky notes via the tool palette (click-to-place at distinct
 * points — the Figma/Miro convention, distinct from 061's Add-menu path) and
 * draws a connector between them: the first dogfood of the Whiteboard
 * CONNECTOR gesture (hover a node → drag from its edge handle to another node).
 *
 * Connectors paint GPU-side (Pixi) with no DOM trace, and the GPU-less headless
 * env doesn't paint them at all — but the edge MODEL still updates, so this
 * relies on the `.whiteboard__nodes[data-edge-count]` affordance (added
 * alongside this session) to assert the connection landed. Idempotent: if the
 * board already has a connector, the build is skipped.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const EDGE_COUNT = ".whiteboard__nodes";

test("draw a connector between two sticky notes", async () => {
	test.setTimeout(180_000);
	const s = await startSession("075-strategy-board");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(1500);

		// Ensure a board is open (mint one if the canvas chrome is absent).
		if ((await wb.locator(".whiteboard__add-trigger").count()) === 0) {
			await wb
				.locator('[data-testid="whiteboard-new-board"]')
				.click()
				.catch(() => undefined);
			await wb
				.locator(".fm-menu .fm-row", { hasText: "Blank board" })
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(900);
		}
		await s.shot(wb, "01-board");

		const edgesBefore = Number(
			(await wb.locator(EDGE_COUNT).first().getAttribute("data-edge-count")) ?? "0",
		);
		s.note(`edges before: ${edgesBefore}`);

		if (edgesBefore === 0) {
			const wrap = wb.locator(".whiteboard__canvas-wrap").first();
			// Two stickies at well-separated points (tool reverts to Select after
			// each place, so re-select the Sticky tool before each click).
			const stickyTool = wb.locator(".whiteboard__tool").nth(1);
			for (const pos of [
				{ x: 320, y: 300 },
				{ x: 820, y: 320 },
			]) {
				await stickyTool.click();
				await wb.waitForTimeout(250);
				await wrap.click({ position: pos });
				await wb.waitForTimeout(500);
			}

			// Connect the leftmost sticky to the rightmost (distinct, separated).
			const stickies = wb.locator(".whiteboard__node--sticky");
			const n = await stickies.count();
			s.note(`sticky nodes on board: ${n}`);
			const boxes: Array<{
				i: number;
				x: number;
				box: { x: number; y: number; width: number; height: number };
			}> = [];
			for (let i = 0; i < n; i++) {
				const box = await stickies.nth(i).boundingBox();
				if (box) boxes.push({ i, x: box.x, box });
			}
			boxes.sort((a, b) => a.x - b.x);
			const left = boxes[0];
			const right = boxes[boxes.length - 1];
			if (left && right && left.i !== right.i) {
				const leftNode = stickies.nth(left.i);
				await leftNode.hover(); // reveal the (hover-gated) connection handles
				await wb.waitForTimeout(200);
				const handle = await leftNode.locator(".whiteboard__handle--right").boundingBox();
				if (handle) {
					await wb.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
					await wb.mouse.down();
					await wb.mouse.move(right.box.x + right.box.width / 2, right.box.y + right.box.height / 2, {
						steps: 14,
					});
					await wb.mouse.up();
					await wb.waitForTimeout(700);
					s.note("dragged a connector from the left sticky to the right sticky");
				}
			}
		} else {
			s.note("board already has a connector — skipping build");
		}
		await s.shot(wb, "02-connected");

		const edgesAfter = Number(
			(await wb.locator(EDGE_COUNT).first().getAttribute("data-edge-count")) ?? "0",
		);
		s.note(`edges after: ${edgesAfter}`);
		expect(edgesAfter, "the board has at least one connector").toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
