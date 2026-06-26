/**
 * Session 020 — light dogfood of Whiteboard canvas interactions.
 *
 * Whiteboard is canvas/imperative, so content isn't easily asserted via the
 * DOM. This exercises the documented gestures (S = sticky, T = text) + a
 * canvas click to place, types a label, and watches for console/page errors —
 * the gross-failure net for the draw loop + tool palette.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Whiteboard: place a sticky + text without errors", async () => {
	test.setTimeout(180_000);
	const s = await startSession("020-whiteboard-deep");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(2000);
		await s.shot(wb, "whiteboard-initial");

		// The canvas host fills the window below the header. Click near centre to
		// focus it, then drive the keyboard shortcuts from the on-screen legend.
		const canvas = wb.locator("canvas").first();
		const hasCanvas = (await canvas.count()) > 0;
		s.note(`canvas present: ${hasCanvas}`);

		// Place a sticky (S), click to drop it, type a label.
		await wb.mouse.move(550, 360);
		await wb.mouse.click(550, 360);
		await wb.waitForTimeout(300);
		await wb.keyboard.press("KeyS");
		await wb.waitForTimeout(400);
		await wb.mouse.click(450, 320);
		await wb.waitForTimeout(500);
		await wb.keyboard.type("Dogfood sticky", { delay: 15 });
		await wb.waitForTimeout(400);
		await s.shot(wb, "after-sticky");

		// Place a text node (T) elsewhere.
		await wb.keyboard.press("Escape");
		await wb.waitForTimeout(300);
		await wb.keyboard.press("KeyT");
		await wb.waitForTimeout(400);
		await wb.mouse.click(700, 450);
		await wb.waitForTimeout(400);
		await wb.keyboard.type("note", { delay: 15 });
		await wb.waitForTimeout(400);
		await s.shot(wb, "after-text");
		await wb.keyboard.press("Escape");
		await wb.waitForTimeout(300);

		// ── Cleanup: the seeded "Your first sketch" canvas starts empty, so the
		// only content is what this run added — select all + delete restores it. ──
		await wb.mouse.click(550, 360);
		await wb.waitForTimeout(200);
		await wb.keyboard.press("Escape");
		await wb.keyboard.press("Meta+a");
		await wb.waitForTimeout(300);
		await wb.keyboard.press("Backspace");
		await wb.waitForTimeout(600);
		await s.shot(wb, "after-cleanup");

		s.note(`\nconsole/page errors during canvas interaction: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(hasCanvas, "whiteboard should mount a canvas").toBe(true);
		expect(errors, "no console/page errors placing sticky/text").toEqual([]);
	} finally {
		await s.finish();
	}
});
