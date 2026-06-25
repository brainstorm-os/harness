/**
 * Regression 332 — closing an open task must remove the `.tasks-detail` node.
 *
 * The Tasks content column swaps between the detail route and the list via a
 * ternary where both branches are a `<div className="tasks-content">` at the
 * same position. Without distinct `key`s React reconciles them IN PLACE and
 * never removes the imperatively-appended `.tasks-detail` subtree (it doesn't
 * own it) — the orphaned detail node then paints over the list and every
 * navigation looks dead even though state moved. This asserts the detail node
 * is gone after each escape path (sidebar click, header back, Escape).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const detailCount = (tk: import("@playwright/test").Page) =>
	tk.evaluate(() => document.querySelectorAll(".tasks-detail").length);

test("regression: closing a task leaves no stale detail node (332)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("332-tasks-detail-close-no-stale-node");
	const tk = await s.openApp(APP.Tasks);
	await tk.waitForTimeout(2500);

	await tk
		.locator(".tasks-sidebar__row", { hasText: "Inbox" })
		.first()
		.click()
		.catch(() => undefined);
	await tk.locator(".task-row").first().waitFor({ state: "visible", timeout: 8000 });

	// Open → close via a sidebar surface.
	await tk.locator(".task-row").first().click();
	await tk.waitForTimeout(700);
	expect(await detailCount(tk), "detail opens").toBe(1);
	await tk.locator(".tasks-sidebar__row", { hasText: "Today" }).first().click();
	await tk.waitForTimeout(700);
	expect(await detailCount(tk), "no stale detail after sidebar nav").toBe(0);

	// Open → close via the header back button.
	await tk.locator(".tasks-sidebar__row", { hasText: "Inbox" }).first().click();
	await tk.waitForTimeout(500);
	await tk.locator(".task-row").first().click();
	await tk.waitForTimeout(700);
	expect(await detailCount(tk), "detail reopens").toBe(1);
	await tk.locator('[data-testid="nav-back"]').first().click();
	await tk.waitForTimeout(700);
	expect(await detailCount(tk), "no stale detail after back").toBe(0);
});
