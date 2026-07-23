/**
 * Session 912 — VID-1 capture dry-run for **Notes** (the first YouTube
 * episode's subject). Per the VID-* gate: before the tape rolls, walk every
 * documented affordance the video will show and capture it, so any defect that
 * would show on camera surfaces first (each becomes a POLISH-* rung and blocks
 * the shoot).
 *
 * Spec only navigates + captures + inventories; the capture-blocking friction
 * is written from the screenshots afterward (never asserted in-spec — a dry-run
 * is not a pass/fail test).
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Notes VID-1 capture dry-run (912)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("912-notes-vid1-dryrun");
	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const inv = async (page: Page, label: string) => {
		const data = await page.evaluate(() => {
			const header = document.querySelector(".app-header");
			const title = (header?.querySelector(".app-header__title")?.textContent ?? "").trim();
			const buttons = header
				? [...header.querySelectorAll("button")]
						.map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").replace(/\s+/g, " ").trim())
						.filter(Boolean)
						.slice(0, 14)
				: [];
			return { title, buttons };
		});
		s.note(`=== ${label} :: title=${JSON.stringify(data.title)} buttons=${JSON.stringify(data.buttons)}`);
	};

	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// 1. First impression — the list + whatever note opens by default.
		await inv(notes, "first-open");
		await s.shot(notes, "01-first-open");

		// 2. Open an existing note with real content (first sidebar row).
		const firstRow = notes.locator(".notes__sidebar-item").first();
		if ((await firstRow.count()) > 0) {
			await firstRow.click();
			await notes.waitForTimeout(900);
			await s.shot(notes, "02-existing-note");
		}

		// 3. New note → the empty-note first frame (the write invitation).
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1000);
		await s.shot(notes, "03-empty-note");

		// 3b. Move the caret to the empty body — the "Type '/' for commands" hint
		// should appear on the focused empty paragraph (verifies Notes isn't hit
		// by the Journal/Tasks F-405 hint-missing bug).
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(500);
		const hint = await notes.locator('[data-empty-hint="true"]').count();
		const hintText = await notes
			.locator('[data-empty-hint="true"]')
			.first()
			.getAttribute("data-empty-hint-text")
			.catch(() => null);
		s.note(`empty-body hint present: ${hint > 0} text=${JSON.stringify(hintText)}`);
		await s.shot(notes, "03b-empty-body-focused");

		// 4. Type a title + a body line (the core writing moment).
		await notes.keyboard.type("VID-1 dry-run — Notes on camera", { delay: 14 });
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("A paragraph the video will show being written.", { delay: 10 });
		await notes.waitForTimeout(500);
		await s.shot(notes, "04-typed");

		// 5. Slash command menu — the discoverability affordance.
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("/", { delay: 20 });
		await notes.waitForTimeout(700);
		await s.shot(notes, "05-slash-menu");
		await notes.keyboard.press("Escape");
		await notes.keyboard.press("Backspace");

		// 6. Rich blocks via markdown shortcuts — heading, list, checklist, quote.
		await notes.keyboard.type("# A heading", { delay: 10 });
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("- bullet one", { delay: 10 });
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("[] a checkbox task", { delay: 10 });
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("> a quote", { delay: 10 });
		await notes.waitForTimeout(500);
		await s.shot(notes, "06-rich-blocks");

		// 7. Inline toolbar — select a line and show the format bar.
		await notes.keyboard.press("Home");
		await notes.keyboard.press("Shift+End");
		await notes.waitForTimeout(600);
		await s.shot(notes, "07-inline-toolbar");

		// 8. Right-panel tabs (backlinks / comments / inspector) if present.
		const panelToggles = notes.locator(
			'.app-header__right button[aria-label*="anel"], .app-header__right button[aria-label*="nspector"], .app-header__right button[aria-label*="acklink"]',
		);
		if ((await panelToggles.count()) > 0) {
			await panelToggles.first().click();
			await notes.waitForTimeout(700);
			await s.shot(notes, "08-right-panel");
		}

		// 9. Object menu (⋯) — covers / icon / export / delete surface.
		const more = notes.locator('.app-header__right button').last();
		if ((await more.count()) > 0) {
			await more.click({ trial: false }).catch(() => {});
			await notes.waitForTimeout(600);
			await s.shot(notes, "09-object-menu");
			await notes.keyboard.press("Escape");
		}

		s.note(`console/page errors captured: ${errors.length}`);
		for (const e of errors.slice(0, 20)) s.note(`  ! ${e}`);

		// Leave the persistent Northbound vault as found — delete every note this
		// dry-run created (title starts "VID-1 dry-run"). Best-effort; never fails
		// the run. Deletes via the open note's header-title right-click menu (the
		// 014 pattern — always in-viewport).
		try {
			for (let i = 0; i < 12; i += 1) {
				const headerTitle = (await notes.locator(".app-header__title").first().textContent()) ?? "";
				if (!headerTitle.includes("VID-1 dry-run")) {
					const stale = notes.locator(".notes__sidebar-item", { hasText: "VID-1 dry-run" }).first();
					if ((await stale.count()) === 0) break;
					await stale.click();
					await notes.waitForTimeout(500);
				}
				await notes.locator(".app-header__title").first().click({ button: "right" });
				await notes.waitForTimeout(450);
				const del = notes.getByRole("option", { name: /delete|move to bin|trash/i }).first();
				if ((await del.count()) === 0) break;
				await del.click();
				await notes.waitForTimeout(400);
				const confirmOk = notes.locator('[data-testid="confirm-ok"]');
				if ((await confirmOk.count()) > 0) await confirmOk.click();
				await notes.waitForTimeout(900);
			}
			s.note("cleanup: removed VID-1 dry-run notes from the vault");
		} catch (e) {
			s.note(`cleanup skipped: ${(e as Error).message.split("\n")[0]}`);
		}
	} finally {
		await s.finish();
	}
});
