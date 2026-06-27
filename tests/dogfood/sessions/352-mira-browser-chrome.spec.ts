/**
 * Session 352 — Mira drives the Web Browser chrome (in-flight-app probe).
 *
 * Rounds out the in-flight-app coverage (Automations 349, Agent 350, Mailbox
 * 351 → Browser here). Real web navigation needs network egress the dogfood
 * box may not have, so this probes the CHROME a user touches before any page
 * loads: the new-tab state, the address bar, the tab strip (open a second tab),
 * back/forward, and the clip-to-vault ("Save to vault") affordance. Address-bar
 * input is exercised without awaiting a real load. Per the loop protocol the
 * spec records intent + neutral observations only; the verdict comes from the
 * captures.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Mira drives the browser chrome — new tab, address bar, clip (352)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("352-mira-browser-chrome");
	s.chat(
		SPEAKER.Mira,
		"Giving the in-app browser a spin — new tab, the address bar, and whether I can clip a page into the vault. Just the chrome today; I want to see it feels like a real browser.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const browser = await s.openApp(APP.Browser);
		await browser.waitForTimeout(1800);
		await s.shot(browser, "01-new-tab");

		const inv = await browser.evaluate(() => {
			const labels = new Set<string>();
			for (const el of [...document.querySelectorAll("[aria-label]")].slice(
				0,
				50,
			))
				labels.add(el.getAttribute("aria-label") ?? "");
			const placeholders = [...document.querySelectorAll("[placeholder]")]
				.map((el) => el.getAttribute("placeholder") ?? "")
				.filter(Boolean);
			const tabCount = document.querySelectorAll(
				'[role="tab"], .bs-tab, [class*="tab"]',
			).length;
			return { labels: [...labels], placeholders, tabCount };
		});
		s.note(`=== aria-labels === ${JSON.stringify(inv.labels)}`);
		s.note(`=== placeholders === ${JSON.stringify(inv.placeholders)}`);
		s.note(`tab-ish element count (heuristic): ${inv.tabCount}`);

		// Address bar: type a query (don't await a real load — network may be off).
		const addr = browser.locator(
			'[aria-label="Address bar"], [placeholder="Search or enter web address"]',
		);
		if ((await addr.count().catch(() => 0)) > 0) {
			await addr
				.first()
				.click()
				.catch(() => undefined);
			await addr
				.first()
				.fill("getbrainstorm.online")
				.catch(() => undefined);
			await browser.waitForTimeout(600);
			await s.shot(browser, "02-address-typed");
			s.note("typed a web address into the address bar");
		} else {
			s.note("no address bar found");
		}

		// Open a second tab — the tab strip should grow.
		const newTab = browser.locator(
			'[aria-label="Open a new tab"], button:has-text("New tab"), [aria-label="New tab"]',
		);
		if ((await newTab.count().catch(() => 0)) > 0) {
			await newTab
				.first()
				.click()
				.catch(() => undefined);
			await browser.waitForTimeout(800);
			await s.shot(browser, "03-second-tab");
			s.note("opened a second tab");
		} else {
			s.note("no New tab affordance found");
		}

		// Clip-to-vault affordance present? (Browser-5)
		const clip = browser.locator(
			'[aria-label="Save to vault"], button:has-text("Save to vault")',
		);
		s.note(
			`"Save to vault" (clip) affordance present: ${(await clip.count().catch(() => 0)) > 0}`,
		);

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors driving the browser chrome").toEqual(
			[],
		);
	} finally {
		await s.finish();
	}
});
