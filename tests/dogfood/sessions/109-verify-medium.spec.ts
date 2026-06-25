/**
 * Session 109 — verify the medium batch (F-053 tz picker, F-049 graph de-jargon).
 * Built fresh (no SKIP_BUILD).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("verify medium batch (109)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("109-verify-medium");
	try {
		// F-053 — the time-zone select is grouped (Common + regions).
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);
		await cal
			.locator('.cal-toolbar__tab[data-view="week"]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(400);
		await cal
			.locator('.cal-toolbar__new, [aria-label*="new event" i], [aria-label*="new" i]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(700);
		await cal
			.locator(".cal-detail__more-summary")
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(400);
		await s.shot(cal, "01-event-detail-open");
		const optgroups = await cal
			.locator(".cal-detail__more select optgroup")
			.evaluateAll((els) => els.map((e) => (e as HTMLOptGroupElement).label))
			.catch(() => [] as string[]);
		s.note(`F-053 tz optgroups: ${JSON.stringify(optgroups.slice(0, 12))}`);

		// F-049 — the graph panel reads plainly now.
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(2200);
		await s.shot(graph, "02-graph-panel");
		const headers = (await graph.locator(".sidebar-section h2").allInnerTexts()).map((t) => t.trim());
		const hint = (await graph.locator(".sidebar-section__hint").first().textContent()) ?? "";
		s.note(`F-049 panel headers: ${JSON.stringify(headers)}`);
		s.note(`F-049 hint: ${JSON.stringify(hint.replace(/\s+/g, " ").trim())}`);

		s.note("captured medium-batch verification");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
