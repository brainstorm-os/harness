/**
 * Session 919 — the hidden-window contract.
 *
 * Agent-driven harness runs launch a real Electron shell, often several at
 * once and often for minutes. Until `BRAINSTORM_HIDDEN_WINDOWS` existed, every
 * one of them threw windows over whatever the developer was doing. Hidden is
 * now the default for every launch path (`lib/shell-launch-env.ts`); this spec
 * guards both halves of that bargain:
 *
 *   1. NOTHING is mapped onto a display — the dashboard and every app window
 *      report `isVisible() === false` for the whole run.
 *   2. Capture still works — the renderer of a never-shown window keeps
 *      painting, so screenshots and the promo rig's CDP screencast keep
 *      returning real frames.
 *
 * (2) is the half that fails silently. A hidden window whose compositor has
 * stopped still screenshots; it just screenshots black, and every visual
 * dogfood check downstream would quietly start passing on nothing. The
 * screencast frame count is the direct evidence: a stopped compositor emits
 * zero frames.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { visibleWindowsRequested } from "../lib/shell-launch-env";

/** Count CDP screencast frames over `ms` — the promo recorder's own capture
 *  path, so this measures exactly what the rigs depend on. */
async function screencastFrames(page: import("@playwright/test").Page, ms: number): Promise<number> {
	const session = await page.context().newCDPSession(page);
	let frames = 0;
	session.on("Page.screencastFrame", (frame) => {
		frames += 1;
		session
			.send("Page.screencastFrameAck", { sessionId: frame.sessionId })
			.catch(() => undefined);
	});
	await session.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
	await page.waitForTimeout(ms);
	await session.send("Page.stopScreencast").catch(() => undefined);
	await session.detach().catch(() => undefined);
	return frames;
}

test("hidden mode: no window is mapped, and capture is still real", async () => {
	test.setTimeout(300_000);
	test.skip(visibleWindowsRequested(), "this run opted into visible windows");

	const s = await startSession("919-hidden-window-mode");
	try {
		const windows = async (): Promise<{ title: string; visible: boolean }[]> =>
			s.app.evaluate(({ BaseWindow }) =>
				BaseWindow.getAllWindows().map((w) => ({ title: w.getTitle(), visible: w.isVisible() })),
			);

		const atBoot = await windows();
		s.note(`windows at boot: ${JSON.stringify(atBoot)}`);
		expect(atBoot.length, "the dashboard window exists").toBeGreaterThan(0);
		expect(atBoot.filter((w) => w.visible), "no window mapped at boot").toEqual([]);

		const page = await s.openApp(APP.Notes);
		await page.waitForTimeout(2_000);

		const afterOpen = await windows();
		s.note(`windows after opening Notes: ${JSON.stringify(afterOpen)}`);
		expect(afterOpen.length, "the app window exists too").toBeGreaterThan(atBoot.length);
		expect(afterOpen.filter((w) => w.visible), "no window mapped after an app opens").toEqual([]);

		for (const surface of [s.dashboard, page]) {
			// Chromium keeps a never-shown window's renderer in the visible state
			// (`paintWhenInitiallyHidden`); "hidden" here means painting stopped.
			expect(await surface.evaluate(() => document.visibilityState)).toBe("visible");

			const frames = await screencastFrames(surface, 2_000);
			s.note(`${surface.url().split("/").pop()}: ${frames} screencast frames / 2s`);
			expect(frames, "a hidden window still produces screencast frames").toBeGreaterThan(0);

			// A same-size solid-colour PNG lands in the low single-digit KB; a real
			// rendered surface is an order of magnitude larger.
			const shot = await surface.screenshot({ scale: "css" });
			s.note(`${surface.url().split("/").pop()}: screenshot ${shot.length} bytes`);
			expect(shot.length, "the screenshot is not a blank frame").toBeGreaterThan(20_000);
		}
	} finally {
		await s.finish();
	}
});
