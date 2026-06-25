/**
 * Session 211 — Priya's working-tools pass over the rest of the fleet drop:
 * code-editor find bar / multi-cursor / folding / Prettier format (B9.3 +
 * 9.7.3 + 9.7.8), Whiteboard rich-text runs + format toolbar (9.17.12),
 * Calendar's CalDAV dialog (9.15.19), the theme-editor, and the dashboard
 * chrome (notification center app icons + launcher).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const MOD = process.platform === "darwin" ? "Meta" : "Control";

test("Priya works the studio tools — editor, whiteboard, calendar, chrome (211)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("211-priya-studio-tools");
	try {
		s.chat(
			SPEAKER.Priya,
			"Tools day. The code editor allegedly grew find, multi-cursor and a formatter overnight — and the whiteboard learned bold text. Believing it when I see it.",
		);

		// ---- Code editor ----------------------------------------------------
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(3000);
		await s.shot(ce, "01-code-editor-open");
		// Open an existing file from the sidebar, else create one.
		const fileRow = ce
			.locator('[class*="sidebar"] [class*="row"], [class*="file-list"] li, aside li')
			.first();
		if (await fileRow.isVisible().catch(() => false)) {
			await fileRow.click().catch(() => undefined);
			await ce.waitForTimeout(1500);
		} else {
			const newFile = ce.locator('[aria-label*="new" i], button:has-text("New")').first();
			await newFile.click().catch(() => undefined);
			await ce.waitForTimeout(1200);
		}
		// Make sure there's some JS-ish content to find/format.
		const pane = ce.locator('[contenteditable="true"], [class*="pane"], textarea').first();
		await pane.click().catch(() => undefined);
		await ce.keyboard.type("const total = items.map(x=>x.price).reduce((a,b)=>a+b,0)\n", {
			delay: 15,
		});
		await ce.keyboard.type("const label = 'total'\nconst report = { label, total }\n", { delay: 15 });
		await ce.waitForTimeout(800);
		await s.shot(ce, "02-typed-code");

		// Find bar (B9.3).
		await ce.keyboard.press(`${MOD}+f`);
		await ce.waitForTimeout(800);
		const findVisible = await ce
			.locator('[class*="find"]')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`code-editor find bar visible after Cmd+F: ${findVisible}`);
		if (findVisible) {
			await ce.keyboard.type("total", { delay: 30 });
			await ce.waitForTimeout(900);
			await s.shot(ce, "03-find-matches");
			const findText = await ce
				.locator('[class*="find"]')
				.first()
				.textContent()
				.catch(() => null);
			s.note(`find bar reads: ${findText?.slice(0, 120)}`);
			await ce.keyboard.press("Escape");
		} else {
			await s.shot(ce, "03-no-find-bar");
		}

		// Multi-cursor: select the word "total", Cmd+D to add occurrences.
		await pane.click().catch(() => undefined);
		await ce.keyboard.press(`${MOD}+f`).catch(() => undefined); // re-find to place cursor
		await ce.keyboard.press("Escape").catch(() => undefined);
		// Double-click the word in the buffer instead.
		const word = ce.locator("text=total").first();
		await word.dblclick().catch(() => undefined);
		await ce.keyboard.press(`${MOD}+d`).catch(() => undefined);
		await ce.keyboard.press(`${MOD}+d`).catch(() => undefined);
		await ce.waitForTimeout(600);
		await s.shot(ce, "04-multi-cursor");

		// Folding gutter presence.
		const foldChevrons = await ce
			.locator('[class*="fold"], [class*="gutter"] [class*="chevron"]')
			.count()
			.catch(() => 0);
		s.note(`fold affordances in gutter: ${foldChevrons}`);

		// Format (9.7.8) — Cmd+Shift+F should prettify the arrow-function soup.
		await pane.click().catch(() => undefined);
		await ce.keyboard.press(`${MOD}+Shift+f`);
		await ce.waitForTimeout(1500);
		await s.shot(ce, "05-after-format");

		// ---- Whiteboard rich text -------------------------------------------
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		await s.shot(wb, "06-whiteboard-open");
		const wcanvas = wb.locator("canvas").first();
		const wbox = await wcanvas.boundingBox().catch(() => null);
		if (wbox) {
			// Double-click to spawn a sticky in inline edit (F-199 fix behavior).
			await wb.mouse.dblclick(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2);
			await wb.waitForTimeout(900);
			await wb.keyboard.type("Launch narrative — bold the stakes", { delay: 20 });
			await wb.waitForTimeout(500);
			await s.shot(wb, "07-sticky-typed");
			// Select all text in the inline editor → format toolbar should appear.
			await wb.keyboard.press(`${MOD}+a`);
			await wb.waitForTimeout(800);
			const fmtToolbar = wb.locator('[class*="format"], [role="toolbar"]').last();
			const fmtVisible = await fmtToolbar.isVisible().catch(() => false);
			s.note(`whiteboard format toolbar visible on selection: ${fmtVisible}`);
			await s.shot(wb, "08-format-toolbar");
			if (fmtVisible) {
				const fmtButtons = await fmtToolbar
					.locator("button")
					.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim()))
					.catch(() => [] as unknown[]);
				s.note(`format toolbar buttons: ${JSON.stringify(fmtButtons)}`);
				const bold = fmtToolbar.locator('[aria-label*="bold" i], button:has-text("B")').first();
				await bold.click().catch(() => undefined);
				await wb.waitForTimeout(500);
				await s.shot(wb, "09-after-bold");
			}
			// Bold via chord too, then commit by clicking away.
			await wb.keyboard.press(`${MOD}+b`).catch(() => undefined);
			await wb.mouse.click(wbox.x + 80, wbox.y + 80);
			await wb.waitForTimeout(800);
			await s.shot(wb, "10-sticky-committed");
		}

		// ---- Calendar: CalDAV dialog ----------------------------------------
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2500);
		const moreBtn = cal.locator(".app-header__right button").last();
		await moreBtn.click().catch(() => undefined);
		await cal.waitForTimeout(800);
		const menuRows = await cal
			.locator('[role="menuitem"], .fm-menu button')
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`calendar ⋯ rows: ${JSON.stringify(menuRows.slice(0, 12))}`);
		await s.shot(cal, "11-calendar-object-menu");
		const caldav = cal
			.locator('[role="menuitem"]:has-text("CalDAV"), .fm-menu button:has-text("CalDAV")')
			.first();
		if (await caldav.isVisible().catch(() => false)) {
			await caldav.click().catch(() => undefined);
			await cal.waitForTimeout(1000);
			await s.shot(cal, "12-caldav-dialog");
			await cal.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("no CalDAV row in calendar ⋯ menu");
			await cal.keyboard.press("Escape").catch(() => undefined);
		}

		// ---- Theme editor (React conversion + uncommitted styling) ----------
		const te = await s.openApp(APP.ThemeEditor);
		await te.waitForTimeout(2500);
		await s.shot(te, "13-theme-editor");

		// ---- Dashboard chrome: notification center + launcher ---------------
		const bell = s.dashboard.locator('[aria-label*="notification" i]').first();
		if (await bell.isVisible().catch(() => false)) {
			await bell.click().catch(() => undefined);
			await s.dashboard.waitForTimeout(900);
			await s.shot(s.dashboard, "14-notification-center");
			const items = await s.dashboard
				.locator(".notif-center__item")
				.count()
				.catch(() => 0);
			const appIcons = await s.dashboard
				.locator(".notif-center__app")
				.count()
				.catch(() => 0);
			s.note(`notification items: ${items}, with app-icon leads: ${appIcons}`);
			await s.dashboard.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("no notification bell found on dashboard");
		}
		await s.shot(s.dashboard, "15-dashboard-launcher");
		// Right-click an app tile — the launcher context menu (uncommitted work).
		const tile = s.dashboard
			.locator('[class*="launcher"] [class*="tile"], [class*="app-icon"]')
			.first();
		if (await tile.isVisible().catch(() => false)) {
			await tile.click({ button: "right" }).catch(() => undefined);
			await s.dashboard.waitForTimeout(800);
			await s.shot(s.dashboard, "16-launcher-context-menu");
			const rows = await s.dashboard
				.locator('[role="menuitem"], .fm-menu button')
				.allTextContents()
				.catch(() => [] as string[]);
			s.note(`launcher context rows: ${JSON.stringify(rows.slice(0, 10))}`);
			await s.dashboard.keyboard.press("Escape").catch(() => undefined);
		}

		s.chat(
			SPEAKER.Priya,
			"Studio pass done. Multi-cursor in a vault-native editor is the headline if it held; the whiteboard bold is the thing Mira will actually use tomorrow.",
		);
	} finally {
		await s.finish();
	}
});
