/**
 * Session 111 — the Vertex engagement, end to end (real operations).
 *
 * Mira works one advisory deal through its whole lifecycle and we watch where
 * the app carries her vs where she falls off: the deal record (does it model a
 * pipeline stage? a fee? a close date?), the proposal (Notes — fine), setting
 * up the engagement (a project with deliverables + hours?), and then the part a
 * studio actually lives or dies on — invoicing + getting paid + seeing the
 * revenue. Notes only; gaps land in `business-wishlist.md` (read back after).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Vertex engagement end to end (111)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("111-advisory-engagement");
	try {
		// 1. The deal record — open Vertex Labs and see what a "deal" is modeled as.
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(1500);
		await db
			.locator(".db-sidebar__list-item", { hasText: /^\s*Clients/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		const vertex = db.locator("text=Vertex Labs").first();
		if (await vertex.count()) {
			await vertex.click().catch(() => undefined);
			await db.waitForTimeout(800);
		}
		await s.shot(db, "01-deal-record");
		// The inspector/detail fields that model the deal.
		const dealFields = (
			await db
				.locator(
					"[class*='inspector'] [class*='prop'], [class*='detail'] [class*='field'], .bs-props [class*='row']",
				)
				.allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 25);
		s.note(`Vertex deal-record fields: ${JSON.stringify(dealFields)}`);

		// 2. The engagement — is there a project model with deliverables/hours/fee?
		await db
			.locator(".db-sidebar__list-item", { hasText: /Projects/i })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await s.shot(db, "02-projects");
		const projectRows = (
			await db.locator(".dbv-grid__row, [class*='card'], [class*='row']").allInnerTexts()
		)
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 12);
		s.note(`Projects (engagements) present: ${JSON.stringify(projectRows)}`);

		// 3. Invoicing / payment / revenue — the studio's lifeblood. Look for ANY
		//    surface that lets Mira bill the engagement and record payment.
		const lists = (await db.locator(".db-sidebar__list-item").allInnerTexts())
			.map((t) => t.replace(/\s+/g, " ").trim())
			.filter(Boolean);
		const billing = lists.filter((l) =>
			/invoice|bill|payment|revenue|financ|income|account/i.test(l),
		);
		s.note(`Any billing/payment/revenue surface in lists? ${JSON.stringify(billing)}`);

		// 4. Could she at least write a proposal + an invoice as a doc? (Notes.)
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		const noteTitles = (await notes.locator(".notes__sidebar-title").allInnerTexts())
			.map((t) => t.trim())
			.filter((t) => /proposal|invoice|engagement|vertex|statement|contract|sow/i.test(t));
		s.note(`Proposal/invoice/engagement docs Mira has in Notes: ${JSON.stringify(noteTitles)}`);

		s.note("captured the advisory engagement lifecycle for gap analysis");
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
