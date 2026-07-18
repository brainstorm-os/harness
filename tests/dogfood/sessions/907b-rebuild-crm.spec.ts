/**
 * Session 907b — rebuilding Northbound, part 2: the CRM + content calendar.
 *
 * Creates two blank collections in Database ("Clients", "Content Calendar"),
 * adds rows, and names them. Adaptive + idempotent: lists are skipped if
 * present, rows are only added up to the wanted count (re-runs are safe), and
 * every unknown interaction screenshots before it acts.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const CLIENT_ROWS = ["Vertex Labs", "Acme Analytics", "Halcyon Research", "Beacon Ventures"];
const CALENDAR_ROWS = ["Issue #5 — The trust tax", "Issue #6 — Build vs. buy, again", "Issue #7 — The context window", "Issue #8 — Through-lines"];

test("rebuild Northbound — Clients + Content Calendar (907b)", async () => {
	test.setTimeout(540_000);
	const s = await startSession("907b-rebuild-crm");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(2000);
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);

		const sidebarHas = async (name: string) =>
			(await db.locator("#list-nav", { hasText: name }).count().catch(() => 0)) > 0 &&
			(await db.locator("#list-nav").textContent().catch(() => ""))!.includes(name);

		const buildList = async (name: string, rows: string[], slug: string) => {
			if (await sidebarHas(name)) {
				s.note(`[db] list "${name}" already in the sidebar — selecting it`);
				await db.locator("#list-nav >> text=" + name).first().click();
				await db.waitForTimeout(1000);
			} else {
				await db.locator("#sidebar-new-list").click();
				await db.waitForTimeout(600);
				await s.shot(db, `${slug}-newlist-menu`);
				const item = db.locator("text=Blank collection").first();
				if ((await item.count()) === 0) {
					s.note(`[db] new-list menu did not open for "${name}" — aborting this list`);
					return;
				}
				await item.click();
				await db.waitForTimeout(1200);
				// The heading IS the rename field (contenteditable #stage-title).
				const title = db.locator("#stage-title");
				await title.click();
				await db.keyboard.press("Meta+A");
				await db.keyboard.type(name);
				await db.keyboard.press("Enter");
				await db.waitForTimeout(800);
				const got = (await title.textContent().catch(() => ""))?.trim();
				s.note(`[db] created list, renamed to "${got}" (want "${name}")`);
			}

			// Rows: only top up to the wanted count.
			const countText = await db.locator("#stage-count").textContent().catch(() => "0");
			const have = Number((countText ?? "0").replace(/\D/g, "") || "0");
			const need = Math.max(0, rows.length - have);
			s.note(`[db] "${name}" has ${have} rows; adding ${need}`);
			for (let i = 0; i < need; i++) {
				await db.locator("#toolbar-new").click();
				await db.waitForTimeout(900);
				if (i === 0) await s.shot(db, `${slug}-after-first-new`);
				// If the new-row flow opened an editor/inspector with a name field,
				// use it; otherwise fall back to typing into the focused element.
				const nameInput = db
					.locator('input[placeholder*="name" i], [class*="inspector"] input[type="text"], [contenteditable="true"][class*="title"]')
					.first();
				const rowName = rows[have + i] ?? `${name} row ${i}`;
				if ((await nameInput.count()) > 0 && (await nameInput.isVisible().catch(() => false))) {
					await nameInput.fill?.(rowName).catch(async () => {
						await nameInput.click();
						await db.keyboard.press("Meta+A");
						await db.keyboard.type(rowName);
					});
					await db.keyboard.press("Enter");
				} else {
					await db.keyboard.type(rowName);
					await db.keyboard.press("Enter");
				}
				await db.waitForTimeout(600);
				await db.keyboard.press("Escape").catch(() => undefined);
			}
			await s.shot(db, `${slug}-done`);
		};

		await buildList("Clients", CLIENT_ROWS, "clients");
		await buildList("Content Calendar", CALENDAR_ROWS, "calendar");

		const sidebarText = (await db.locator("#list-nav").textContent().catch(() => "")) ?? "";
		s.note(`[db] sidebar after rebuild: "${sidebarText.replace(/\s+/g, " ").slice(0, 300)}"`);
		await s.shot(db, "sidebar-final");
		s.chat(SPEAKER.Mira, "CRM skeleton is back: Clients + Content Calendar collections live again in Database.");
		await db.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
