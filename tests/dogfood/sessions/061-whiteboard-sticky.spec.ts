/**
 * Session 061 — Mira starts a strategy board.
 *
 * She opens the Whiteboard, creates a board if she has none, and drops a
 * sticky via the "Add to board" menu. Exercises the Whiteboard create path
 * (board creation + the fancy Add menu → sticky placement) — an entirely
 * uncovered app. Nodes are HTML divs, so the placed sticky is assertable.
 * (Doesn't type into the sticky body — that's a CRDT-backed contenteditable;
 * creating the node is the dogfooded action.)
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("add a sticky to a whiteboard", async () => {
	test.setTimeout(180_000);
	const s = await startSession("061-whiteboard-sticky");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(1500);
		await s.shot(wb, "01-landing");

		// Open/create a board — the canvas chrome (Add trigger) only shows with
		// a board active. If there's no Add trigger, mint a board first.
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
			s.note("created a new board");
		}
		const haveCanvas = (await wb.locator(".whiteboard__add-trigger").count()) > 0;
		s.note(`board canvas ready (Add trigger present): ${haveCanvas}`);

		const before = await wb.locator(".whiteboard__node--sticky").count();
		s.note(`stickies before: ${before}`);

		await wb.locator(".whiteboard__add-trigger").first().click();
		await wb.waitForTimeout(400);
		await wb
			.locator('.fm-menu [role="option"]', { hasText: /sticky/i })
			.first()
			.click();
		await wb.waitForTimeout(700);
		await s.shot(wb, "02-after-add");

		const after = await wb.locator(".whiteboard__node--sticky").count();
		s.note(`stickies after: ${after}`);

		expect(haveCanvas, "a board is open with the Add affordance").toBe(true);
		expect(after, "adding a sticky places a sticky node on the board").toBeGreaterThan(before);
	} finally {
		await s.finish();
	}
});
