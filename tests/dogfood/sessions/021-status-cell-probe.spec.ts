/**
 * Session 021 — focused probe of ONE Select-cell edit, to characterize why
 * setting a Status didn't stick in session 020. Clean, single cell, heavy
 * capture: what opens on click, whether the "Create" row exists + is clickable,
 * and whether the value commits.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe: set one client's Status (Select inline create)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("021-status-cell-probe");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Clients$/ })
			.first()
			.click();
		await db.waitForTimeout(1000);

		const cell = db
			.locator(".dbv-grid__row:not(.dbv-grid__row--head) .dbv-grid__cell--editable")
			.first();
		await cell.click();
		await db.waitForTimeout(500);
		const afterClick = await db.evaluate(() => ({
			popInputs: document.querySelectorAll(".bs-cell-pop-input").length,
			popovers: document.querySelectorAll(".bs-cell-pop-list, [class*='bs-cell-pop']").length,
			focused: document.activeElement?.className ?? null,
		}));
		s.note(`After cell click: ${JSON.stringify(afterClick)}`);
		await s.shot(db, "01-after-cell-click");

		const input = db.locator(".bs-cell-pop-input");
		if ((await input.count()) > 0) {
			await input.fill("Lead");
			await db.waitForTimeout(400);
			const popState = await db.evaluate(() => {
				const create = document.querySelector(".bs-cell-pop-row--create");
				const r = create?.getBoundingClientRect();
				const top = create ? document.elementFromPoint((r?.left ?? 0) + 5, (r?.top ?? 0) + 5) : null;
				return {
					createRows: document.querySelectorAll(".bs-cell-pop-row--create").length,
					createVisible: !!(r && r.width > 0 && r.height > 0),
					topElAtCreate: top?.className ?? null,
					createIsTopmost: !!(create && top && (create === top || create.contains(top))),
				};
			});
			s.note(`Popover state w/ "Lead": ${JSON.stringify(popState)}`);
			await s.shot(db, "02-create-row");

			const create = db.locator(".bs-cell-pop-row--create").first();
			try {
				await create.click({ timeout: 5000 });
				s.note("create.click(): ok");
			} catch (e) {
				s.note(`create.click() FAILED: ${(e as Error).message.split("\n")[0]}`);
			}
			await db.waitForTimeout(500);
			await db.keyboard.press("Escape");
			await db.waitForTimeout(400);
		}

		const cellText = (await cell.innerText().catch(() => "")) ?? "";
		s.note(`Cell text after: ${JSON.stringify(cellText.replace(/\s+/g, " ").trim())}`);
		await s.shot(db, "03-final");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
