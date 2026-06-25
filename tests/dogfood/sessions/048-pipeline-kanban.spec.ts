/**
 * Session 048 — Mira views her pipeline as a kanban board. Switches the Clients
 * view to Board (grouped by a property) and checks the columns + client cards
 * render. The classic CRM pipeline view; dogfoods the Board view over her
 * generic-Object clients.
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

test("view the Clients pipeline as a Board (kanban)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("048-pipeline-kanban");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await openClients(db);
		// Close the Details inspector first — its overlay can cover the toolbar
		// (esp. in non-grid layouts), which would block the settings button.
		await db
			.locator("#inspector-close")
			.click({ timeout: 4000 })
			.catch(() => undefined);
		await db.waitForTimeout(400);

		const settingsBtn = db.locator("#toolbar-settings");
		try {
			await settingsBtn.click({ timeout: 6000 });
		} catch {
			s.note("toolbar-settings not clickable (covered?) — recovering via grid");
		}
		await db.waitForTimeout(500);
		const boardBtn = db.locator(".db-popover").getByText("Board", { exact: true }).first();
		s.note(`Board view-type option present: ${(await boardBtn.count()) > 0}`);
		await boardBtn
			.click({ timeout: 6000 })
			.catch((e) => s.note(`Board click failed: ${(e as Error).message.split("\n")[0]}`));
		await db.waitForTimeout(700);
		// Note what it grouped by (the board section shows a group-by control).
		const groupHint =
			(await db
				.locator(".db-popover")
				.innerText()
				.catch(() => "")) ?? "";
		s.note(`Settings after Board switch mentions group-by: ${/group/i.test(groupHint)}`);
		await db.keyboard.press("Escape");
		await db.waitForTimeout(500);
		await s.shot(db, "01-board");

		const boardPresent = (await db.locator(".dbv-board").count()) > 0;
		s.note(`Board renders: ${boardPresent}`);
		const colLabels = await db
			.locator(".dbv-board__label")
			.allInnerTexts()
			.catch(() => []);
		const colCounts = await db
			.locator(".dbv-board__count")
			.allInnerTexts()
			.catch(() => []);
		s.note(
			`Board columns: ${JSON.stringify(colLabels.map((l, i) => `${l.trim()} (${(colCounts[i] ?? "").trim()})`))}`,
		);
		const cards = await db
			.locator(".dbv-board__card-title")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Cards on board: ${JSON.stringify(cards.map((c) => c.trim()))}`);

		// F-031: the card's Status chip must read the label, not the raw option id.
		const cardText =
			(await db
				.locator(".dbv-board")
				.innerText()
				.catch(() => "")) ?? "";
		const chipShowsLabel = /\bLead\b|\bActive\b/.test(cardText);
		const chipShowsRawId = /di_[a-z0-9]/i.test(cardText);
		s.note(
			`Card chips show Status label (Lead/Active): ${chipShowsLabel}; still show raw "di_" id: ${chipShowsRawId}`,
		);

		expect(boardPresent).toBe(true);
		expect(cards.some((c) => /Vertex Labs|Acme|Beacon/i.test(c))).toBe(true);
		expect(chipShowsRawId).toBe(false);
	} finally {
		// Switch back to Grid so the persistent vault stays grid-default for later runs.
		try {
			await db
				.locator("#inspector-close")
				.click({ timeout: 3000 })
				.catch(() => undefined);
			await db.locator("#toolbar-settings").click({ timeout: 5000 });
			await db.waitForTimeout(400);
			await db
				.locator(".db-popover")
				.getByText("Grid", { exact: true })
				.first()
				.click({ timeout: 5000 });
			await db.waitForTimeout(400);
			await db.keyboard.press("Escape");
		} catch {
			// best-effort restore
		}
		await s.finish();
	}
});
