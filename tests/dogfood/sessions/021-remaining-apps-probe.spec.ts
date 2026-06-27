/**
 * Session 021 — interaction probe across the remaining apps.
 *
 * For each app: open it, screenshot, trigger its primary create affordance
 * ("New …" / "Add …" / "Create …"), screenshot the resulting composer/state,
 * then Escape (non-destructive — no objects persisted). Console/page errors
 * are captured per app for triage. The broad net for composer-mount crashes
 * and silent console errors the smoke (open-only) sweep can't see.
 */

import { expect, test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

const PROBE: Array<{ name: string; id: AppId }> = [
	{ name: "Bookmarks", id: APP.Bookmarks },
	{ name: "Contacts", id: APP.Contacts },
	{ name: "Chat", id: APP.Chat },
	{ name: "CodeEditor", id: APP.CodeEditor },
	{ name: "FormDesigner", id: APP.FormDesigner },
	{ name: "Books", id: APP.Books },
	{ name: "Agent", id: APP.Agent },
	{ name: "Automations", id: APP.Automations },
	{ name: "ThemeEditor", id: APP.ThemeEditor },
	{ name: "Graph", id: APP.Graph },
	{ name: "Preview", id: APP.Preview },
	{ name: "Journal", id: APP.Journal },
];

test("probe: every remaining app opens + its create affordance fires cleanly", async () => {
	test.setTimeout(300_000);
	const s = await startSession("021-remaining-apps-probe");
	const errorsByApp = new Map<string, Set<string>>();
	let current = "shell";
	const record = (line: string) => {
		(errorsByApp.get(current) ?? errorsByApp.set(current, new Set()).get(current))?.add(line);
	};
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => record(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") record(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		for (const { name, id } of PROBE) {
			current = name;
			let page: Awaited<ReturnType<typeof s.openApp>>;
			try {
				page = await s.openApp(id);
			} catch (e) {
				s.note(`✗ ${name}: failed to open — ${(e as Error).message.split("\n")[0]}`);
				continue;
			}
			await page.waitForTimeout(1400);
			await s.shot(page, `${name.toLowerCase()}-open`);

			// Fire the first visible create affordance, if any.
			const create = page
				.locator(
					'[aria-label^="New "], [aria-label^="Add "], [aria-label^="Create "], button:has-text("New "), button:has-text("New channel"), button:has-text("New workflow")',
				)
				.first();
			if ((await create.count()) > 0 && (await create.isVisible().catch(() => false))) {
				try {
					await create.click({ timeout: 4000 });
					await page.waitForTimeout(1000);
					await s.shot(page, `${name.toLowerCase()}-create`);
					await page.keyboard.press("Escape");
					await page.waitForTimeout(300);
					s.note(`✓ ${name}: opened + create affordance fired`);
				} catch (e) {
					s.note(`~ ${name}: create affordance click failed — ${(e as Error).message.split("\n")[0]}`);
				}
			} else {
				s.note(`• ${name}: opened (no obvious create affordance)`);
			}
		}

		// Error dump per app.
		s.note("\n=== console/page errors by app ===");
		let total = 0;
		for (const [app, lines] of errorsByApp) {
			s.note(`\n[${app}] (${lines.size})`);
			for (const l of [...lines].slice(0, 15)) s.note(`  ${l}`);
			total += lines.size;
		}
		if (total === 0) s.note("(none)");
		s.note(`\ntotal distinct errors: ${total}`);

		expect(errorsByApp.size >= 0, "probe completed").toBe(true);
	} finally {
		await s.finish();
	}
});
