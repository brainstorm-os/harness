/**
 * Session 344 — the Database delete affordance is reachable and error-free.
 *
 * 343 left Database out; a first grounded attempt then mis-fired because the
 * Database app's content is view-variable — this vault has no "Clients" grid, so
 * it fell back to a BOARD list ("Tasks") whose cards aren't grid rows, and the
 * grid is `@tanstack/react-virtual` anyway (row-count checks are unreliable).
 * Those were all harness/state artifacts, not bugs (code-read confirms delete
 * works: row/object menu "Delete" → `confirmDeleteEntity` → a `delete-entity-
 * confirm` popover with a `.bs-btn--danger` → `deleteEntity` through the entities
 * service, the same hard-delete the entities pipeline tests already cover).
 *
 * So this session asserts the part a GUI test should: the delete FLOW is WIRED
 * and SAFE — right-click any entity → the shared menu offers "Delete" → the
 * confirm popover appears → Cancel closes it cleanly — with ZERO console errors.
 * It is VIEW-AGNOSTIC (targets `[data-entity-id]`, works for board cards or grid
 * rows) and NON-DESTRUCTIVE (cancels), so it's repeatable on the persistent
 * founder vault. record-don't-throw.
 */

import { test } from "@playwright/test";
import { APP, type FounderSession, startSession } from "../lib/founder";
import { appInteractive, collectConsoleErrors } from "../lib/invariants";

test("Database delete affordance is reachable + confirm flow is safe (344)", async () => {
	test.setTimeout(300_000);
	const s: FounderSession = await startSession("344-database-lifecycle");
	const findings: string[] = [];
	const record = (problem: string) => {
		findings.push(problem);
		s.note(`  [BROKEN] ${problem}`);
	};

	try {
		s.note("\n## Database — delete affordance + confirm flow");
		const page = await s.openApp(APP.Database);
		page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
		page.setDefaultTimeout(3500);
		const errs = collectConsoleErrors(page);
		await page.waitForTimeout(1800);

		// Any addressable entity (board card or grid row both carry data-entity-id).
		const entity = page.locator("[data-entity-id]").first();
		if ((await entity.count().catch(() => 0)) === 0) {
			record("Database: no entities rendered to exercise delete on");
		} else {
			await entity.click({ button: "right", timeout: 3000 }).catch(() => undefined);
			await page.waitForTimeout(500);
			const del = page
				.locator('.fm-menu [role="option"]')
				.filter({ hasText: /^Delete$/i })
				.first();
			if ((await del.count().catch(() => 0)) === 0) {
				record("Database: right-click context menu offers no Delete");
				await page.keyboard.press("Escape").catch(() => undefined);
			} else {
				await del.click({ timeout: 3000 }).catch(() => undefined);
				await page.waitForTimeout(600);
				const confirm = page.locator('[data-testid="delete-entity-confirm"]').first();
				if ((await confirm.count().catch(() => 0)) === 0) {
					record("Database: Delete did not raise the confirm popover");
				} else {
					await s.shot(page, "db-delete-confirm");
					// Cancel — verify the safe path closes cleanly, nothing deleted.
					const cancel = confirm.locator(".bs-btn--ghost").first();
					if ((await cancel.count().catch(() => 0)) > 0)
						await cancel.click({ timeout: 2000 }).catch(() => undefined);
					else await page.keyboard.press("Escape").catch(() => undefined);
					await page.waitForTimeout(600);
					if ((await confirm.count().catch(() => 0)) > 0)
						record("Database: confirm popover did not close on Cancel");
				}
			}
		}

		if (errs.errors.length > 0) record(`Database: ${errs.errors.length} console error(s) — ${errs.errors[0]}`);
		if (!(await appInteractive(page))) record("Database: left non-interactive (overlay trap)");
		await page.close().catch(() => undefined);

		s.note("\n## RESULT — database delete flow");
		if (findings.length === 0)
			s.note("  ✅ right-click → Delete → confirm popover → Cancel closes cleanly; no console errors.");
		else {
			s.note(`  ${findings.length} finding(s):`);
			for (const f of findings) s.note(`   • ${f}`);
		}
	} finally {
		await s.finish();
	}
});
