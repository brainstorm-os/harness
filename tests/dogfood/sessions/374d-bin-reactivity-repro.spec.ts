/**
 * Session 374d — repro: "deleting from bin stopped working — reactivity".
 *
 * The bin purge machinery is verified green (374/b/c); the reported symptom
 * is stale UI. Probes, all against the Notes sidebar list (the app-side
 * reactive surface):
 *   1. Delete the open note via the ⋯ menu → the sidebar must drop the row.
 *   2. RESTORE it from the Bin (IPC, no touch on Notes) → the sidebar must
 *      re-grow the row live (cross-surface fan-out).
 *   3. Delete again, PARK the Notes window (shell close keeps the renderer
 *      warm), purge from the Bin, relaunch Notes (unparks the SAME renderer)
 *      → the purged note must not resurrect, and the revived app must still
 *      be live (a new note can be created and listed).
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Bridge = {
	brainstorm: {
		bin: {
			list(): Promise<Array<{ id: string; title: string }>>;
			restore(id: string): Promise<boolean>;
			purge(id: string): Promise<boolean>;
		};
		windows: {
			list(): Promise<Array<{ id: string; appId?: string }>>;
			close(id: string): Promise<boolean>;
		};
		dev: {
			notes: { createAndOpenScratchNote(): Promise<{ ok: boolean; entityId?: string }> };
		};
	};
};

const SIDEBAR = '[aria-label="Notes list"]';

test("bin restore/purge propagate to open and parked Notes", async () => {
	test.setTimeout(420_000);
	const s = await startSession("374d-bin-reactivity");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});
	const dash = s.dashboard;
	const listBin = () => dash.evaluate(() => (window as unknown as Bridge).brainstorm.bin.list());

	const ensureSidebar = async (notes: Page) => {
		const show = notes.locator('[aria-label="Show notes list"]');
		if (await show.count()) {
			await show.click();
			await notes.waitForTimeout(600);
		}
	};

	const deleteOpenNote = async (notes: Page) => {
		await notes.locator(".notes__header-right button, .app-header__right button").last().click();
		await notes.waitForTimeout(600);
		const del = notes
			.locator('[role="menu"] .fm-row')
			.filter({ hasText: /^Delete( note)?$|^Move to Bin$/ })
			.first();
		await expect(del, "Notes ⋯ menu has Delete note").toBeVisible({ timeout: 5_000 });
		await del.click({ force: true });
		await notes.waitForTimeout(1200);
	};

	try {
		await dash.waitForTimeout(1500);
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// ── Setup: scratch note with a typed, denormalized title ──
		const title = "ReactivityProbe374";
		const res = await dash.evaluate(() =>
			(window as unknown as Bridge).brainstorm.dev.notes.createAndOpenScratchNote(),
		);
		expect(res.ok, "scratch note created").toBe(true);
		await dash.waitForTimeout(2000);
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		let landed = false;
		for (let attempt = 0; attempt < 3 && !landed; attempt++) {
			const editable = notes.locator('[contenteditable="true"]').first();
			await editable.click({ force: true }).catch(() => undefined);
			await notes.waitForTimeout(300);
			await notes.keyboard.press("ControlOrMeta+A").catch(() => undefined);
			await notes.keyboard.type(title, { delay: 30 });
			await notes.waitForTimeout(1500);
			landed = (await notes.locator(`.app-header__title:has-text("${title}")`).count()) > 0;
		}
		expect(landed, "typed title landed").toBe(true);
		await ensureSidebar(notes);
		await s.shot(notes, "sidebar-with-note");
		await expect(
			notes.locator(`${SIDEBAR} :text("${title}")`).first(),
			"note listed in sidebar",
		).toBeVisible({ timeout: 10_000 });

		// ── 1. Delete via ⋯ → sidebar drops the row ──
		await deleteOpenNote(notes);
		await s.shot(notes, "after-delete");
		const goneAfterDelete = (await notes.locator(`${SIDEBAR} :text("${title}")`).count()) === 0;
		s.note(`1. sidebar dropped the row after delete: ${goneAfterDelete}`);

		let bin = await listBin();
		const row = bin.find((it) => it.title === title);
		s.note(`   deleted note in bin: ${Boolean(row)}`);
		expect(row, "deleted note reaches the bin").toBeTruthy();
		if (!row) throw new Error("unreachable");

		// ── 2. Restore from the Bin → sidebar re-grows the row LIVE ──
		const restored = await dash.evaluate(
			(id) => (window as unknown as Bridge).brainstorm.bin.restore(id),
			row.id,
		);
		s.note(`2. bin.restore returned: ${restored}`);
		await notes.waitForTimeout(2500);
		await s.shot(notes, "after-restore");
		const backAfterRestore = (await notes.locator(`${SIDEBAR} :text("${title}")`).count()) > 0;
		s.note(`   sidebar re-grew the row after restore (no touch): ${backAfterRestore}`);

		// ── 3. Delete again, PARK, purge, relaunch ──
		await notes.locator(`${SIDEBAR} :text("${title}")`).first().click();
		await notes.waitForTimeout(1000);
		await deleteOpenNote(notes);
		bin = await listBin();
		const row2 = bin.find((it) => it.title === title);
		expect(row2, "note back in bin for the purge round").toBeTruthy();
		if (!row2) throw new Error("unreachable");

		const wins = await dash.evaluate(() =>
			(window as unknown as Bridge).brainstorm.windows.list(),
		);
		for (const w of wins.filter((w) => w.appId === "io.brainstorm.notes")) {
			const closed = await dash.evaluate(
				(id) => (window as unknown as Bridge).brainstorm.windows.close(id),
				w.id,
			);
			s.note(`3. parked notes window ${w.id}: ${closed}`);
		}
		await dash.waitForTimeout(1500);

		const purged = await dash.evaluate(
			(id) => (window as unknown as Bridge).brainstorm.bin.purge(id),
			row2.id,
		);
		s.note(`   bin.purge returned: ${purged}`);
		bin = await listBin();
		s.note(`   still in bin after purge: ${bin.some((it) => it.id === row2.id)}`);

		const revived = await s.openApp(APP.Notes);
		await revived.waitForTimeout(2500);
		await ensureSidebar(revived);
		await s.shot(revived, "revived-after-purge");
		const staleCount = await revived.locator(`${SIDEBAR} :text("${title}")`).count();
		s.note(`   purged note still listed in revived Notes: ${staleCount > 0}`);

		// Liveness probe: the revived renderer must still complete broker work.
		const livenessTitle = "RevivedLiveness374";
		await revived.locator('[aria-label="New note"]').first().click({ force: true });
		await revived.waitForTimeout(1500);
		await revived.keyboard.type(livenessTitle, { delay: 30 });
		await revived.waitForTimeout(2000);
		const liveness =
			(await revived.locator(`${SIDEBAR} :text("${livenessTitle}")`).count()) > 0;
		s.note(`   revived renderer creates+lists a new note: ${liveness}`);

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);

		expect(goneAfterDelete, "1. sidebar must drop a deleted note").toBe(true);
		expect(backAfterRestore, "2. sidebar must re-grow a bin-restored note live").toBe(true);
		expect(staleCount, "3. revived Notes must not resurrect the purged note").toBe(0);
		expect(liveness, "3. revived Notes must still be live").toBe(true);
	} finally {
		await s.finish();
	}
});
