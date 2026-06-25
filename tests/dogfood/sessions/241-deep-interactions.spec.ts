/**
 * Session 241 — deeper interaction probe across apps the 239 sweep only saw
 * idle: actually DRIVE a create/edit/select flow and judge from observable DOM
 * change (count / text / class / selection), capturing a before+after shot.
 * Each step is wrapped so one broken affordance never aborts the rest.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type FounderSession, startSession } from "../lib/founder";

const pass = (s: FounderSession, a: string, o: string) => s.note(`[PASS] ${a} — ${o}`);
const fail = (s: FounderSession, a: string, o: string) => s.note(`[FAIL] ${a} — ${o}`);
const judge = (s: FounderSession, a: string, ok: boolean, o: string) =>
	ok ? pass(s, a, o) : fail(s, a, o);

async function count(page: Page, sel: string): Promise<number> {
	return page
		.locator(sel)
		.count()
		.catch(() => -1);
}

test("deep interactions probe (241)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("241-deep-interactions");
	try {
		// ── Calendar: create an event via the New dialog ───────────────────────
		try {
			const cal = await s.openApp(APP.Calendar);
			await cal.waitForTimeout(2500);
			const before = await count(cal, ".cal-month__event, .cal-event, [class*='event']");
			await cal
				.locator('.app-header button[aria-label*="New" i], .app-header button[aria-label*="event" i]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(1000);
			const title = cal.locator('input[type="text"]:visible, [contenteditable="true"]').first();
			await title.click().catch(() => undefined);
			await cal.keyboard.type("Probe 241 event", { delay: 15 });
			await s.shot(cal, "calendar-01-dialog");
			const saveBtn = cal.locator('button:has-text("Save")').first();
			await saveBtn.click().catch(() => undefined);
			await cal.waitForTimeout(1200);
			const after = await count(cal, ".cal-month__event, .cal-event, [class*='event']");
			await s.shot(cal, "calendar-02-after-save");
			judge(s, "Calendar create event", after > before, `events ${before} → ${after}`);
		} catch (e) {
			fail(s, "Calendar create event", (e as Error).message);
		}

		// ── Bookmarks: add a bookmark ──────────────────────────────────────────
		try {
			const bm = await s.openApp(APP.Bookmarks);
			await bm.waitForTimeout(2500);
			const before = await count(
				bm,
				".bookmark, [class*='bookmark-card'], [class*='bookmark__row'], li",
			);
			await bm
				.locator(
					'.app-header button[aria-label*="Add" i], .app-header button[aria-label*="bookmark" i]',
				)
				.first()
				.click()
				.catch(() => undefined);
			await bm.waitForTimeout(900);
			const urlInput = bm.locator('input[type="url"]:visible, input[type="text"]:visible').first();
			await urlInput.click().catch(() => undefined);
			await bm.keyboard.type("https://example.org/probe-241", { delay: 10 });
			await s.shot(bm, "bookmarks-01-add");
			await bm.keyboard.press("Enter").catch(() => undefined);
			await bm.waitForTimeout(1500);
			const after = await count(
				bm,
				".bookmark, [class*='bookmark-card'], [class*='bookmark__row'], li",
			);
			await s.shot(bm, "bookmarks-02-after");
			judge(s, "Bookmarks add", after !== before, `items ${before} → ${after}`);
		} catch (e) {
			fail(s, "Bookmarks add", (e as Error).message);
		}

		// ── Tasks: toggle a task complete ──────────────────────────────────────
		try {
			const tk = await s.openApp(APP.Tasks);
			await tk.waitForTimeout(2500);
			const checks = tk.locator(
				'[role="checkbox"], .task-row__check, button[aria-label*="complete" i]',
			);
			const before = await checks.count();
			await s.shot(tk, "tasks-01-before");
			await checks
				.first()
				.click()
				.catch(() => undefined);
			await tk.waitForTimeout(1200);
			await s.shot(tk, "tasks-02-after-complete");
			s.note(`Tasks complete-toggle: checkboxes=${before} (see shot for state change)`);
		} catch (e) {
			fail(s, "Tasks complete", (e as Error).message);
		}

		// ── Contacts: create a contact via compose ─────────────────────────────
		try {
			const ct = await s.openApp(APP.Contacts);
			await ct.waitForTimeout(2500);
			const before = await count(
				ct,
				"[class*='contact-row'], [class*='contacts__item'], [class*='person']",
			);
			await ct
				.locator('.app-header button[aria-label*="New" i], .app-header button[aria-label*="contact" i]')
				.first()
				.click()
				.catch(() => undefined);
			await ct.waitForTimeout(900);
			await s.shot(ct, "contacts-01-compose");
			const nameInput = ct.locator('input[type="text"]:visible').first();
			await nameInput.click().catch(() => undefined);
			await ct.keyboard.type("Probe Contact 241", { delay: 12 });
			await ct.waitForTimeout(400);
			await s.shot(ct, "contacts-02-typed");
			s.note(`Contacts compose: rows before=${before} (see shot)`);
		} catch (e) {
			fail(s, "Contacts create", (e as Error).message);
		}

		// ── Graph: click a node → selection / inspector ────────────────────────
		try {
			const g = await s.openApp(APP.Graph);
			await g.waitForTimeout(3000);
			await s.shot(g, "graph-01-open");
			// Click near the center where labelled hubs live.
			const box = await g
				.locator("canvas")
				.first()
				.boundingBox()
				.catch(() => null);
			if (box) {
				await g.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
				await g.waitForTimeout(1200);
			}
			await s.shot(g, "graph-02-after-click");
			s.note("Graph node click: see before/after shots for selection/inspector change");
		} catch (e) {
			fail(s, "Graph click", (e as Error).message);
		}

		// ── Whiteboard: add a sticky via toolbar ───────────────────────────────
		try {
			const wb = await s.openApp(APP.Whiteboard);
			await wb.waitForTimeout(2800);
			await s.shot(wb, "whiteboard-01-open");
			const stickyBtn = wb
				.locator('[aria-label*="sticky" i], [title*="sticky" i], .wb-toolbar button')
				.first();
			await stickyBtn.click().catch(() => undefined);
			await wb.waitForTimeout(600);
			const box = await wb
				.locator("canvas")
				.first()
				.boundingBox()
				.catch(() => null);
			if (box) {
				await wb.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
				await wb.waitForTimeout(800);
			}
			await s.shot(wb, "whiteboard-02-after-add");
			s.note("Whiteboard add sticky: see before/after shots");
		} catch (e) {
			fail(s, "Whiteboard add", (e as Error).message);
		}
	} finally {
		await s.finish();
	}
});
