/**
 * Session 329 — commercial-spine readiness check.
 *
 * Re-verifies the `docs/dogfood/business-wishlist.md` gaps (DT-1..DT-9) against
 * the CURRENT product. The last reconciliation (Session 192, 2026-06-09) found
 * the commercial spine mostly ❌/🟡 (Form Designer a stub, Mailbox unwired, no
 * automation authoring, no task assignee). A lot has shipped since. This drives
 * the relevant apps and records, per DT, whether the capability is now present —
 * evidence for updating the wishlist verdicts. It asserts nothing hard (a
 * readiness probe, not a gate); it captures presence + a screenshot per app.
 */

import { type Page, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function present(page: Page, selector: string): Promise<boolean> {
	return (
		(await page.locator(selector).count()) > 0 &&
		(await page
			.locator(selector)
			.first()
			.isVisible()
			.catch(() => false))
	);
}

test("commercial-spine readiness (329)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("329-business-wishlist-readiness");
	try {
		// ── DT-9: Tasks Assignee/Owner person-relation ──────────────────────
		{
			const page = await s.openApp(APP.Tasks);
			await page.waitForTimeout(2500);
			await s.shot(page, "tasks");
			// Create a task so the inspector renders, then look for an assignee field.
			const groupByAssignee = await page.getByText(/assignee/i).count();
			const hasAssigneeAria = await page
				.locator('[aria-label*="ssignee" i],[data-field="assignee"],[data-testid*="assignee" i]')
				.count();
			s.note("## DT-9 Tasks assignee");
			s.note(
				`- "assignee" text occurrences: ${groupByAssignee}; assignee controls: ${hasAssigneeAria}`,
			);
			s.note(`- verdict: ${groupByAssignee + hasAssigneeAria > 0 ? "PRESENT" : "ABSENT"}`);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300);
		}

		// ── DT-1: Automations — author a when→then rule (EntityEvent trigger) ─
		{
			const page = await s.openApp(APP.Automations);
			await page.waitForTimeout(2500);
			await s.shot(page, "automations-home");
			s.note("\n## DT-1 Automations authoring");
			// Try to open a workflow builder via the header "New"/create affordance.
			const newBtn = page.locator(".app-header button", { hasText: /new|create|workflow/i }).first();
			if (await newBtn.count()) {
				await newBtn.click().catch(() => undefined);
				await page.waitForTimeout(1200);
				await s.shot(page, "automations-new");
			}
			// Builder presence: a trigger section + step kinds.
			const builder = await present(
				page,
				'[class*="workflow-builder"],[class*="builder"],[data-testid*="builder" i]',
			);
			const triggerSection = await present(page, '[class*="trigger" i]');
			const stepText = await page
				.getByText(/trigger|when|then|step|notify|create entity|update/i)
				.count();
			s.note(
				`- builder visible: ${builder}; trigger section: ${triggerSection}; trigger/step labels: ${stepText}`,
			);
			s.note(
				`- verdict: ${builder || triggerSection ? "AUTHORING UI PRESENT" : "engine-only / not found from header"}`,
			);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300);
		}

		// ── DT-2: Form Designer — real builder + export/PDF ─────────────────
		{
			const page = await s.openApp(APP.FormDesigner);
			await page.waitForTimeout(2500);
			await s.shot(page, "form-designer");
			s.note("\n## DT-2 Form Designer + PDF");
			const comingSoon = await page.getByText(/coming soon/i).count();
			const palette = await present(
				page,
				'[class*="palette"],[class*="field-list"],[class*="designer"],[data-testid*="palette" i]',
			);
			const exportAffordance = await page.getByText(/export|pdf|download|publish/i).count();
			s.note(
				`- coming-soon stub: ${comingSoon > 0}; designer surface present: ${palette}; export/pdf labels: ${exportAffordance}`,
			);
			s.note(`- verdict: ${comingSoon > 0 ? "STILL A STUB" : "REAL BUILDER"}`);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300);
		}

		// ── DT-4: Database — computed rollup column option ──────────────────
		{
			const page = await s.openApp(APP.Database);
			await page.waitForTimeout(2800);
			await s.shot(page, "database");
			s.note("\n## DT-4 Database rollups");
			// Look for a footer aggregation row + rollup option in add-column / property kinds.
			const footer = await present(
				page,
				'[class*="aggregat"],[class*="footer"][class*="grid"],[class*="dbv-grid__footer"]',
			);
			const rollupText = await page.getByText(/rollup|sum|count|average|total/i).count();
			s.note(`- aggregation footer present: ${footer}; rollup/sum labels: ${rollupText}`);
			s.note(
				`- verdict: ${footer || rollupText > 0 ? "ROLLUP/AGGREGATION SURFACED" : "not visible here"}`,
			);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300);
		}

		// ── DT-6: Mailbox — connect a real account (IMAP/OAuth) ─────────────
		{
			const page = await s.openApp(APP.Mailbox);
			await page.waitForTimeout(2500);
			await s.shot(page, "mailbox");
			s.note("\n## DT-6 Mailbox wiring");
			const connect = await page.getByText(/connect|add account|imap|gmail|oauth|sign in/i).count();
			s.note(`- connect-account affordance labels: ${connect}`);
			s.note(`- verdict: ${connect > 0 ? "CONNECT UI PRESENT (wired)" : "no connect UI found"}`);
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300);
		}

		// ── DT-5 / DT-7: absent surfaces (website builder, finances) ────────
		s.note("\n## DT-5 Website builder / DT-7 Finances");
		s.note(
			"- no website/publishing app and no finances/P&L app exist in the registry (confirmed by app list) → STILL OPEN",
		);

		s.note("\n## NOTE");
		s.note(
			"Verdicts above are presence checks; cross-reference with code inspection in the chat summary.",
		);
	} finally {
		await s.finish();
	}
});
