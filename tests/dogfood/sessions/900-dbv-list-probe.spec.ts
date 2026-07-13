/**
 * Session 900 — layout probe for the Database LIST view overlap bug
 * (user screenshot 2026-07-13: row titles paint UNDER the status/priority
 * chips in the "Upcoming" list view of the curated Tasks list).
 *
 * Opens Database → Tasks → Upcoming, then dumps the first list row's
 * computed layout: item display/grid-template, each child's class +
 * bounding rect, and the props-strip children. Screenshot alongside.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe — dbv-list row layout", async () => {
	test.setTimeout(180_000);
	const s = await startSession("900-dbv-list-probe");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator("#list-nav .db-sidebar__list-name", { hasText: /^Tasks$/ })
			.first()
			.click();
		await db.waitForTimeout(900);
		// Switch to the "Upcoming" (List-kind) view tab.
		await db.getByText("Upcoming", { exact: true }).first().click();
		await db.waitForTimeout(900);

		await s.shot(db, "upcoming-list");

		const probe = await db.evaluate(() => {
			const item = document.querySelector(".dbv-list__item");
			if (!item) return { error: "no .dbv-list__item found" };
			const cs = getComputedStyle(item);
			const rect = (el: Element) => {
				const r = el.getBoundingClientRect();
				return `x=${Math.round(r.x)} y=${Math.round(r.y)} w=${Math.round(r.width)} h=${Math.round(r.height)}`;
			};
			const children = [...item.children].map((c) => ({
				cls: c.className,
				rect: rect(c),
				text: (c.textContent ?? "").slice(0, 60),
			}));
			const props = item.querySelector(".dbv-list__props");
			const propChildren = props
				? [...props.children].map((c) => ({
						cls: (c as HTMLElement).className,
						rect: rect(c),
						pos: getComputedStyle(c).position,
						text: (c.textContent ?? "").slice(0, 40),
					}))
				: null;
			return {
				itemDisplay: cs.display,
				itemGridCols: cs.gridTemplateColumns,
				itemRect: rect(item),
				children,
				propsDisplay: props ? getComputedStyle(props).display : "none",
				propChildren,
				itemHtml: item.outerHTML.slice(0, 1200),
			};
		});
		s.note(`PROBE: ${JSON.stringify(probe, null, 1)}`);
		expect(true).toBe(true);
	} finally {
		await s.close();
	}
});
