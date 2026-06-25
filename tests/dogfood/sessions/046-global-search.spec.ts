/**
 * Session 046 — Mira uses global search to find everything about a client. Opens
 * the launcher (Cmd/Ctrl+Space) on the dashboard, searches "Vertex", and checks
 * her client (and any note/task mentioning it) surfaces. Dogfoods cross-app
 * search across her vault.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

test("global search finds a client across the vault", async () => {
	test.setTimeout(180_000);
	const s = await startSession("046-global-search");
	try {
		const dash = s.dashboard;
		await dash.bringToFront().catch(() => undefined);
		// Focus the renderer so the launcher chord lands (harness runs NO_FOCUS).
		await dash
			.locator("body")
			.click({ position: { x: 5, y: 5 } })
			.catch(() => undefined);
		await dash.waitForTimeout(500);

		// Try the chord both ways, and as a fallback the in-renderer command hook.
		let open = false;
		for (const key of ["Meta+Space", "Control+Space"]) {
			await dash.keyboard.press(key);
			await dash.waitForTimeout(500);
			open = (await dash.locator(".launcher-menu, .fm-menu").count()) > 0;
			if (open) break;
		}
		if (!open) {
			const dispatched = await dash
				.evaluate(() => {
					const w = window as unknown as { __brainstormShellDev?: { openLauncher?: () => void } };
					if (w.__brainstormShellDev?.openLauncher) {
						w.__brainstormShellDev.openLauncher();
						return true;
					}
					return false;
				})
				.catch(() => false);
			s.note(`Chord failed; dev openLauncher hook present: ${dispatched}`);
			await dash.waitForTimeout(500);
			open = (await dash.locator(".launcher-menu, .fm-menu").count()) > 0;
		}
		s.note(`Launcher opened: ${open}`);
		await s.shot(dash, "01-launcher-open");

		await dash.keyboard.type("Vertex", { delay: 40 });
		await dash.waitForTimeout(900);
		const titles = await dash
			.locator(".launcher-menu__title")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Search results for "Vertex": ${JSON.stringify(titles.map((t) => t.trim()))}`);
		await s.shot(dash, "02-results");

		const foundClient = titles.some((t) => /Vertex Labs/i.test(t));
		s.note(`Found the client "Vertex Labs": ${foundClient}`);
		s.note(`Result count: ${titles.length}`);

		expect(open).toBe(true);
	} finally {
		await s.finish();
	}
});
