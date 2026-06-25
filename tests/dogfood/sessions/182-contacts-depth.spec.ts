/**
 * Session 182 — Contacts depth (work-week day 4): birthdays, company, graph.
 *
 * With the relationship layer landed (F-147/F-148), Mira fleshes a contact out
 * and Priya checks the knowledge seams. (1) Mira sets a birthday via the date
 * cell and confirms it surfaces on the card + the upcoming-birthdays strip.
 * (2) She tries to set a company — and we report whether any Company candidates
 * exist to pick (if none, that's the next gap: no way to create a company from
 * Contacts). (3) Priya checks whether a person→person link Mira made shows up
 * in the Graph app, i.e. the connection is real across apps, not just in the
 * Contacts UI.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Contacts depth — birthday, company candidates, graph cross-check (182)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("182-contacts-depth");
	try {
		s.chat(
			SPEAKER.Mira,
			"Fleshing out a contact properly now the links work — a birthday and a company — and Priya wants to see the connection show up in the graph.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);
		const rowCount = await c
			.locator(".contacts-row")
			.count()
			.catch(() => 0);
		s.note(`contacts in the book: ${rowCount}`);
		if (rowCount === 0) {
			s.note("empty book — nothing to flesh out this run");
			return;
		}

		await c
			.locator(".contacts-row")
			.first()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(1000);
		if ((await c.locator(".bs-props--open").count()) === 0) {
			await c
				.locator(".contacts-icon-btn")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(700);
		}

		// Company: how many candidates can Mira actually pick? (0 ⇒ next gap.)
		const companyTrigger = c
			.locator(".bs-props__row[data-property-key='company'] .bs-cell-link-trigger")
			.first();
		let companyCandidates = -1;
		if (await companyTrigger.count()) {
			await companyTrigger.click().catch(() => undefined);
			await c.waitForTimeout(1200);
			companyCandidates = await c
				.locator(".bs-cell-pop-row")
				.count()
				.catch(() => 0);
			await c.keyboard.press("Escape").catch(() => undefined);
			await c.waitForTimeout(400);
		}
		s.note(`company picker candidates available: ${companyCandidates}`);

		// Birthday: set it through the date cell, then confirm it surfaces.
		const bdayTrigger = c
			.locator(".bs-props__row[data-property-key='birthday'] [class*='bs-cell']")
			.first();
		let bdaySet = false;
		if (await bdayTrigger.count()) {
			await bdayTrigger.click().catch(() => undefined);
			await c.waitForTimeout(800);
			// The date cell opens a calendar / today affordance; click a day if present.
			const day = c.locator("[class*='cal'] button, .bs-cell-pop button, [data-day]").first();
			if (await day.count()) {
				await day.click().catch(() => undefined);
				await c.waitForTimeout(500);
				await c.keyboard.press("Escape").catch(() => undefined);
				bdaySet = true;
			}
			await c.waitForTimeout(500);
		}
		const bdayShown = await c
			.locator(".contacts-detail__birthday")
			.count()
			.catch(() => 0);
		s.note(`birthday: attemptedSet=${bdaySet} shownOnCard=${bdayShown > 0}`);
		await s.shot(c, "01-contact-fleshed");

		s.chat(
			SPEAKER.Mira,
			companyCandidates === 0
				? "Heads up — the Company picker has no candidates to choose. There's no company in the vault and no way to make one from Contacts. That's the next gap."
				: `Company picker offers ${companyCandidates} option(s); birthday ${bdayShown > 0 ? "shows on the card" : "didn't surface"}.`,
		);

		// Priya: does a person→person link show in the Graph app?
		const graph = await s.openApp(APP.Graph);
		await graph.waitForLoadState("domcontentloaded");
		await graph.waitForTimeout(2500);
		await s.shot(graph, "02-graph");
		const graphStats = await graph
			.evaluate(() => {
				const canvas = document.querySelector("canvas");
				return {
					hasCanvas: !!canvas,
					nodeHint: document.body.innerText.match(/\b(\d+)\s+(nodes|objects)\b/i)?.[0] ?? null,
				};
			})
			.catch(() => null);
		s.note(`graph: ${JSON.stringify(graphStats)}`);
		s.chat(
			SPEAKER.Priya,
			"Pulled up the graph to see the people connections render — reading the picture from the capture.",
		);
		s.note("Contacts depth: birthday + company-candidate check + graph cross-check.");
	} finally {
		await s.finish();
	}
});
