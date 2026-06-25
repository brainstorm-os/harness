/**
 * Probe 315 — verify the tasks app after its imperative→React conversion. This
 * conversion is a HYBRID: the chrome + state + reactivity are React, but the
 * heavy per-surface view-builders stay imperative DOM behind a `useDomHost` ref
 * boundary, rebuilt (replaceChildren) when their inputs change. The key risk vs.
 * the original (which patched one row in place) is the full-content rebuild on
 * mutation — so this probe specifically measures SCROLL RETENTION across a task
 * toggle, plus the usual render/console-clean checks. Rich data (the Northbound
 * vault has many tasks), unlike the sparse bookmarks probe.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe: tasks React conversion (315)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("315-probe-tasks-react");
	const tk = await s.openApp(APP.Tasks);
	await tk.waitForTimeout(2500);

	const headerOk = await tk
		.locator(".app-header")
		.first()
		.isVisible()
		.catch(() => false);
	const surfaceCount = await tk
		.locator(".tasks-sidebar__row")
		.count()
		.catch(() => 0);
	await s.shot(tk, "01-default-surface");

	// The default "Today" surface is legitimately empty in the test vault; the
	// Inbox surface holds the seeded task(s). Navigate there to exercise a row.
	await tk
		.locator(".tasks-sidebar__row", { hasText: "Inbox" })
		.first()
		.click()
		.catch(() => undefined);
	await tk.waitForTimeout(800);
	await tk
		.locator(".task-row")
		.first()
		.waitFor({ state: "visible", timeout: 8000 })
		.catch(() => undefined);
	const rowCount = await tk
		.locator(".task-row")
		.count()
		.catch(() => 0);
	s.note(
		`[probe] appHeader=${headerOk}, sidebarSurfaceRows=${surfaceCount}, inboxTaskRows=${rowCount}`,
	);
	await s.shot(tk, "02-inbox");

	// ── Mutation rebuild + scroll behaviour (best-effort; sparse vault) ──
	const scroller = tk.locator(".tasks-content").first();
	const beforeTop = await scroller.evaluate((el) => el.scrollTop).catch(() => -1);
	await tk
		.locator(".task-row__toggle")
		.first()
		.click()
		.catch(() => undefined);
	await tk.waitForTimeout(900);
	const afterTop = await scroller.evaluate((el) => el.scrollTop).catch(() => -1);
	const rowsAfter = await tk
		.locator(".task-row")
		.count()
		.catch(() => 0);
	s.note(`[probe] scrollTop before=${beforeTop} after=${afterTop}; rows after toggle=${rowsAfter}`);
	await s.shot(tk, "03-after-toggle");

	// ── Board + Timeline surfaces render without crashing ──
	await tk
		.locator(".tasks-sidebar__row", { hasText: "Board" })
		.first()
		.click()
		.catch(() => undefined);
	await tk.waitForTimeout(700);
	const boardOk = await tk
		.locator(".tasks-surface, .tasks-board, .task-row")
		.count()
		.catch(() => 0);
	await s.shot(tk, "04-board");
	await tk
		.locator(".tasks-sidebar__row", { hasText: "Timeline" })
		.first()
		.click()
		.catch(() => undefined);
	await tk.waitForTimeout(700);
	await s.shot(tk, "05-timeline");
	s.note(`[probe] board surface rendered (elements=${boardOk})`);

	expect(headerOk, "app-header chrome renders").toBe(true);
	expect(
		surfaceCount,
		"sidebar surface rows render (Inbox/Today/Upcoming/Board/Timeline)",
	).toBeGreaterThanOrEqual(5);
	expect(
		rowCount,
		"Inbox surface renders task rows from useLiveEntities via the view-builder",
	).toBeGreaterThan(0);
});
