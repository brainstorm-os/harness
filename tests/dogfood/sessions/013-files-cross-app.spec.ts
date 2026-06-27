/**
 * Session 013 — close the loop on the Files universal-browser change.
 *
 * Two behaviours the visibility spec (011) didn't cover, both shipped in
 * shell#1 but unverified live:
 *   1. Double-clicking a non-File object (a Note/Task) opens it in its OWNER
 *      app (intent.open routing), not a dead-end inside Files.
 *   2. "Remove" on a non-File object soft-deletes it to the Bin and it
 *      disappears from Files (needs the new entities.write:* grant).
 *
 * Targets the vault's "DeleteMe …" seed objects for the destructive step so
 * no real Northbound data is harmed.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Files: open routes to owner app + Remove soft-deletes to Bin", async () => {
	test.setTimeout(180_000);
	const s = await startSession("013-files-cross-app");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(2000);

		// ── 1. Open-routing: double-click a Note row → Notes window appears ──
		const notesBefore = s.appPagesFor(APP.Notes).length;
		const noteRow = files
			.locator('[data-testid="content-row"]')
			.filter({ has: files.locator(".content-row__type", { hasText: "Note" }) })
			.first();
		const haveNote = (await noteRow.count()) > 0;
		if (haveNote) {
			const noteName = (await noteRow.locator(".content-row__name").textContent())?.trim();
			s.note(`double-clicking Note row "${noteName}"`);
			await noteRow.dblclick();
			await files.waitForTimeout(2500);
			const notesAfter = s.appPagesFor(APP.Notes).length;
			s.note(`Notes windows: ${notesBefore} → ${notesAfter}`);
			await s.shot(files, "after-open-note");
			expect(notesAfter, "double-clicking a Note in Files should open the Notes app").toBeGreaterThan(
				notesBefore,
			);
		} else {
			s.note("no Note row found — skipping open-routing assertion");
		}

		// ── 2. Remove a "DeleteMe" object → it leaves the Files list ──
		const delRow = files
			.locator('[data-testid="content-row"]')
			.filter({ has: files.locator(".content-row__name", { hasText: /^DeleteMe/ }) })
			.first();
		const haveDel = (await delRow.count()) > 0;
		if (haveDel) {
			const delName = (await delRow.locator(".content-row__name").textContent())?.trim();
			const delId = await delRow.getAttribute("data-id");
			s.note(`removing "${delName}" (id=${delId})`);
			// Select ONLY this row, then drive the unambiguous bulk-action bar →
			// confirm dialog ("Move to Recently Deleted" = soft-delete to the Bin).
			await delRow.click();
			await files.waitForTimeout(400);
			await files.locator('[data-testid="bulk-delete"]').click();
			await files.waitForTimeout(500);
			await s.shot(files, "delete-confirm");
			await files.locator('[data-testid="confirm-ok"]').click();
			await files.waitForTimeout(2000);
			const stillPresent = await files
				.locator(`[data-testid="content-row"][data-id="${delId}"]`)
				.count();
			s.note(`row with id=${delId} still present after Delete: ${stillPresent}`);
			await s.shot(files, "after-remove");
			expect(stillPresent, "Deleted object should disappear from the Files list").toBe(0);
		} else {
			s.note("no DeleteMe object found — skipping Remove assertion");
		}

		s.note(`\nconsole/page errors during run: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors during Files cross-app flows").toEqual([]);
	} finally {
		await s.finish();
	}
});
