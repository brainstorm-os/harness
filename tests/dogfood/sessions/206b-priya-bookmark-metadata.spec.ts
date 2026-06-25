/**
 * Session 206b — Priya's citation-store probe, take two: open a bookmark's
 * detail route (cards are [data-entity-id], background click opens), toggle
 * the Properties panel (aria-label "Properties"), and try to fill the new
 * typed fields: Author / Published / Notes / Site (9.18.6 + 9.18.7).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya fills citation metadata on a bookmark (206b)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("206b-priya-bookmark-metadata");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2500);

		const card = bm.locator("[data-entity-id]").last();
		s.note(
			`cards visible: ${await bm
				.locator("[data-entity-id]")
				.count()
				.catch(() => 0)}`,
		);
		await card.click().catch(() => undefined);
		await bm.waitForTimeout(1500);
		await s.shot(bm, "01-detail");

		const propsToggle = bm.locator('[aria-label="Properties"]').first();
		s.note(`Properties toggle visible: ${await propsToggle.isVisible().catch(() => false)}`);
		await propsToggle.click().catch(() => undefined);
		await bm.waitForTimeout(1000);
		await s.shot(bm, "02-properties-open");

		const panel = bm.locator(".bs-props, [class*='props']").first();
		const panelText = await panel.textContent().catch(() => null);
		s.note(`panel text: ${panelText?.slice(0, 500) ?? "(none)"}`);

		const fill = async (labelRe: RegExp, value: string, shotName: string) => {
			const row = bm
				.locator(
					".bs-props [class*='row'], .bs-props [class*='prop'], [class*='props'] [class*='cell']",
				)
				.filter({ hasText: labelRe })
				.first();
			const vis = await row.isVisible().catch(() => false);
			if (!vis) {
				s.note(`row ${labelRe} not visible`);
				return;
			}
			await row.click().catch(() => undefined);
			await bm.waitForTimeout(400);
			const editor = bm.locator("input:focus, textarea:focus, [contenteditable='true']:focus");
			if ((await editor.count().catch(() => 0)) > 0) {
				await bm.keyboard.type(value, { delay: 12 });
				await bm.keyboard.press("Enter").catch(() => undefined);
				await bm.waitForTimeout(500);
				s.note(`filled ${labelRe} = ${value}`);
			} else {
				s.note(`row ${labelRe}: click focused no editor`);
			}
			await s.shot(bm, shotName);
		};
		await fill(/author/i, "Jan Leike", "03-author");
		await fill(/publish/i, "2026-05-21", "04-published");
		await fill(/note/i, "Methodology solid; cite in Issue #5.", "05-notes");
		await fill(/site/i, "Example Press", "06-site");

		// Roundtrip: back to list, reopen, recheck.
		const back = bm.locator('[aria-label*="back" i], [aria-label*="Back" ]').first();
		await back.click().catch(() => undefined);
		await bm.waitForTimeout(1000);
		await card.click().catch(() => undefined);
		await bm.waitForTimeout(1200);
		await bm
			.locator('[aria-label="Properties"]')
			.first()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(800);
		await s.shot(bm, "07-after-roundtrip");
		const panelText2 = await panel.textContent().catch(() => null);
		s.note(`panel text after roundtrip: ${panelText2?.slice(0, 500) ?? "(none)"}`);
		s.chat(
			SPEAKER.Priya,
			"Citation metadata probe done — author/date/notes/site, then a roundtrip to see what survived.",
		);
	} finally {
		await s.finish();
	}
});
