/**
 * Session 045 — "what's my total pipeline value?" Mira reads the Deal size
 * aggregation footer. Verifies F-029: a currency column's SUM renders in the
 * column's currency (US$…), consistent with the cells, not a bare number.
 */

import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function openClients(db: Page): Promise<void> {
	await db
		.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
		.first()
		.click();
	await db.waitForTimeout(800);
}

test("pipeline total: currency-formatted Deal size aggregation (F-029)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("045-pipeline-total");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);

		// Clear any filter left from earlier sessions so all clients aggregate.
		for (let i = 0; i < 4; i++) {
			await db.locator("#toolbar-filter").click();
			await db.waitForTimeout(450);
			const rule = db
				.locator('.fm-menu [role="option"]', { hasText: /^(Status|Deal size|Last contact|Name)\b/ })
				.first();
			if ((await rule.count()) === 0) {
				await db.keyboard.press("Escape");
				break;
			}
			await rule.click();
			await db.waitForTimeout(450);
		}
		await openClients(db);

		const footVals = await db
			.locator(".dbv-grid__foot-value")
			.allInnerTexts()
			.catch(() => []);
		const footKinds = await db
			.locator(".dbv-grid__foot-kind")
			.allInnerTexts()
			.catch(() => []);
		s.note(
			`Footer aggregations: ${JSON.stringify(footKinds.map((k, i) => `${k.trim()}=${(footVals[i] ?? "").trim()}`))}`,
		);
		await s.shot(db, "01-footer");

		const dealVal = footVals.map((v) => v.trim()).find((v) => /\$|85,000|US\$/.test(v)) ?? "";
		s.note(`Deal size aggregation cell: ${JSON.stringify(dealVal)}`);
		const isCurrency = /\$|US\$/.test(dealVal);
		const sums = /85,000/.test(dealVal);
		s.note(`Currency-formatted: ${isCurrency}; sums to 85,000: ${sums}`);

		expect(isCurrency).toBe(true);
		expect(sums).toBe(true);
	} finally {
		await s.finish();
	}
});
