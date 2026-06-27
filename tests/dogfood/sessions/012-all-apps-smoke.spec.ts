/**
 * Session 012 — broad smoke sweep across every first-party app.
 *
 * The G3 bug-burn-down engine: launch the REAL shell against the Northbound
 * vault, open each app in turn, and collect every `pageerror` +
 * `console.error` from window creation (listeners are wired on `app.on
 * ("window")` so mount-time throws are caught too). A screenshot per app and
 * a grouped error dump land in the session notes for triage.
 *
 * This spec is intentionally non-asserting on individual apps (one broken app
 * shouldn't blind the sweep to the other 19); it fails only if NOTHING opens.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("smoke: open every app, collect console/page errors", async () => {
	test.setTimeout(600_000);
	const s = await startSession("012-all-apps-smoke");

	// url → unique error lines. Wire on every window from creation so a throw
	// during initial mount (before openApp resolves) is still captured.
	const errors = new Map<string, Set<string>>();
	const record = (url: string, line: string) => {
		const key = url.split("?")[0] ?? url;
		(errors.get(key) ?? errors.set(key, new Set()).get(key))?.add(line);
	};
	s.app.on("window", (page) => {
		page.on("pageerror", (err) => record(page.url(), `pageerror: ${err.message.split("\n")[0]}`));
		page.on("console", (msg) => {
			if (msg.type() === "error") record(page.url(), `console.error: ${msg.text().split("\n")[0]}`);
		});
	});

	let opened = 0;
	try {
		for (const [name, id] of Object.entries(APP)) {
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(1500);
				await s.shot(page, `app-${name.toLowerCase()}`);
				s.note(`✓ opened ${name}`);
				opened += 1;
			} catch (e) {
				s.note(`✗ ${name} FAILED to open: ${(e as Error).message.split("\n")[0]}`);
			}
		}

		// Grouped error dump for triage.
		s.note("\n=== console.error / pageerror by window ===");
		if (errors.size === 0) s.note("(none)");
		for (const [url, lines] of errors) {
			// Shorten the url to the app id / surface for readability.
			const m = url.match(/io\.brainstorm\.[a-z-]+|\/renderer\/|\/chrome\//);
			s.note(`\n[${m?.[0] ?? url}]`);
			for (const line of [...lines].slice(0, 20)) s.note(`  ${line}`);
		}
		s.note(`\nopened ${opened}/${Object.keys(APP).length} apps`);

		expect(opened, "at least one app should open").toBeGreaterThan(0);
	} finally {
		await s.finish();
	}
});
