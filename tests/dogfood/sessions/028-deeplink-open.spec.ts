/**
 * Session 028 — inbound deeplink opens the entity (end-to-end).
 *
 * Fires the real macOS `open-url` event in the MAIN process (what the OS does
 * when a `brainstorm://entity/<id>` link is clicked in a browser) via
 * Playwright's electronApp.evaluate, and asserts an app window/page opens for
 * that entity — the fix for "deeplinks are not opening from the browser".
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

const DEEPLINK = "brainstorm://entity/welcome-event-explore";

test("deeplink: brainstorm://entity/<id> opens the entity's app", async () => {
	test.setTimeout(180_000);
	const s = await startSession("028-deeplink-open");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
	});
	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape"); // dismiss what's-new

		const urlsBefore = s.app.windows().map((w) => w.url());
		s.note(`windows before: ${urlsBefore.length}`);

		// Fire the deeplink the way macOS delivers it — an `open-url` app event
		// in the main process. (Windows/Linux deliver via argv / second-instance,
		// covered by the deep-link.test.ts unit tests.)
		const result = await s.app.evaluate(({ app }, link) => {
			let prevented = false;
			const evt = {
				preventDefault() {
					prevented = true;
				},
			};
			app.emit("open-url", evt, link);
			return { prevented };
		}, DEEPLINK);
		s.note(`open-url fired — preventDefault called: ${result.prevented}`);

		// The entity's owner app should launch/open for it.
		await dash.waitForTimeout(3500);
		const urlsAfter = s.app.windows().map((w) => w.url());
		s.note(`windows after: ${urlsAfter.length}`);
		const newWindows = urlsAfter.filter((u) => !urlsBefore.includes(u));
		for (const u of newWindows) s.note(`  + ${u.split("/").slice(-3).join("/")}`);
		await s.shot(dash, "after-deeplink");

		const openedAnApp = newWindows.some((u) => /io\.brainstorm\.[a-z-]+/.test(u));
		s.note(`deeplink opened an app window for the entity: ${openedAnApp}`);

		expect(result.prevented, "the open-url handler must preventDefault (it's wired)").toBe(true);
		expect(
			urlsAfter.length,
			"the deeplink should open an app window/page for the entity",
		).toBeGreaterThan(urlsBefore.length);
		expect(openedAnApp, "the newly opened window should be an app renderer").toBe(true);
		expect(errors, "no page errors during deeplink open").toEqual([]);
	} finally {
		await s.finish();
	}
});
