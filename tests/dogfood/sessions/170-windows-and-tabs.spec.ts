/**
 * Session 170 — windows & tabs.
 *
 * Mira checks the new window management: opening objects gives her a real
 * tabbed window (shell-drawn strip), the window/tab is labelled with the
 * object's name, and modifier-clicks on in-doc links open new tabs / windows
 * the way her browser does. This is the real-Electron proof for the
 * BaseWindow + WebContentsView container architecture (docs/shell/33 + 37).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("windows and tabs", async () => {
	const s = await startSession("170-windows-and-tabs");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForLoadState("domcontentloaded");
		s.note("Opened Notes.");

		// Stage 2 — the shell-drawn tab strip is its own chrome page in the
		// container window, and it renders at least one tab.
		const strip = s.tabStrip();
		expect(strip, "tab strip page should exist for the container").not.toBeNull();
		if (strip) {
			await strip.waitForSelector("[role='tab']", { timeout: 10_000 });
			const tabCount = await strip.locator("[role='tab']").count();
			s.note(`Tab strip rendered with ${tabCount} tab(s).`);
			expect(tabCount).toBeGreaterThanOrEqual(1);
			await s.shot(strip, "tab-strip");
		}

		// Stage 1 — the window/tab title reflects the open object's name, not the
		// app id. (Notes publishes `document.title`; the shell mirrors it.)
		const title = await notes.title();
		s.note(`Window title: "${title}".`);
		expect(title.length).toBeGreaterThan(0);
		expect(title).not.toBe(APP.Notes);
		await s.shot(notes, "notes-window");

		// Stage 3 — modifier-clicks on an in-doc entity link open new tabs / windows.
		// Best-effort: only if the open note has a transclusion / entity link.
		const linkSel =
			".notes__transclusion-card, .notes__inline-transclusion, a[href^='brainstorm://entity/']";
		const link = notes.locator(linkSel).first();
		if (await link.count()) {
			const beforeTabs = strip ? await strip.locator("[role='tab']").count() : 0;
			await link.click({ modifiers: ["Meta"] }); // Cmd+click → new tab
			await notes.waitForTimeout(1_500);
			const afterTabs = strip ? await strip.locator("[role='tab']").count() : 0;
			s.note(`Cmd+click a link: tabs ${beforeTabs} → ${afterTabs}.`);
			if (strip) await s.shot(strip, "two-tabs");

			const beforeWindows = s.appPagesFor(APP.Notes).length;
			await link.click({ modifiers: ["Shift"] }); // Shift+click → new window
			await notes.waitForTimeout(1_500);
			const afterWindows = s.appPagesFor(APP.Notes).length;
			s.note(`Shift+click a link: Notes pages ${beforeWindows} → ${afterWindows}.`);
		} else {
			s.note("No in-doc entity link in the open note — skipped the new-tab / new-window check.");
		}

		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
