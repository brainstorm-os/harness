/**
 * Session 309b — live proof of the whiteboard board back/forward fix (F-261).
 *
 * Before the fix the header NavButtons were fed an app-local history nothing
 * pushed to (onNavigate a no-op), so back/forward were PERMANENTLY disabled.
 * This drives: create a 2nd board → back ENABLES → click back → it navigates.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

function result(label: string, data: unknown): void {
	// biome-ignore lint/suspicious/noConsole: harness signal channel
	console.log(`RESULT ${label}: ${JSON.stringify(data)}`);
}

test("session 309b whiteboard board-nav", async () => {
	test.setTimeout(600_000);
	const s = await startSession("309b-whiteboard-nav");
	try {
		const page = await s.openApp(APP.Whiteboard);
		await page.waitForTimeout(2800);
		const back = page.locator('[data-testid="nav-back"]').first();
		const fwd = page.locator('[data-testid="nav-forward"]').first();
		const title = page.locator(".whiteboard__board-name-row");

		const backDisabledInitial = await back.isDisabled().catch(() => null);
		const titleInitial = (
			await title
				.first()
				.innerText()
				.catch(() => "")
		).trim();
		await s.shot(page, "wb-01-initial");

		// Open the new-board menu and pick the first template → creates + opens a
		// new board, which the engine pushes onto its board history.
		await page
			.locator('[data-testid="whiteboard-new-board"]')
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(700);
		await page
			.locator(".fm-row")
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(1600);
		const titleAfterNew = (
			await title
				.first()
				.innerText()
				.catch(() => "")
		).trim();
		const backEnabledAfterNew = !(await back.isDisabled().catch(() => true));
		await s.shot(page, "wb-02-after-new-board");

		// Click back → should return to the first board.
		let titleAfterBack = "";
		let fwdEnabledAfterBack: boolean | null = null;
		if (backEnabledAfterNew) {
			await back.click().catch(() => undefined);
			await page.waitForTimeout(1400);
			titleAfterBack = (
				await title
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			fwdEnabledAfterBack = !(await fwd.isDisabled().catch(() => true));
			await s.shot(page, "wb-03-after-back");
		}

		result("whiteboardNav", {
			backDisabledInitial,
			titleInitial,
			titleAfterNew,
			backEnabledAfterNew,
			titleAfterBack,
			navigatedBack: Boolean(titleAfterBack) && titleAfterBack !== titleAfterNew,
			fwdEnabledAfterBack,
		});
	} finally {
		await s.finish();
	}
});
