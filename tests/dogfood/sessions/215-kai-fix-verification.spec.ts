/**
 * Session 215 — Kai re-drives every behavior the F-209..F-223 fix fleet
 * changed, against the production build: embed-picker keyboard, embedded
 * grid rendering, Database +New/rename/delete + System group + timeline
 * auto-bind, calendar dialog Enter + default date, whiteboard first-keystroke
 * capture, reminder-capture validation, FindBar select-on-reopen. The 214
 * audit spec re-runs separately for the chrome contracts.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const MOD = process.platform === "darwin" ? "Meta" : "Control";

test("Kai verifies the friction-fix fleet in the real shell (215)", async () => {
	test.setTimeout(540_000);
	const s = await startSession("215-kai-fix-verification");
	try {
		s.chat(
			SPEAKER.Kai,
			"Fix-fleet verification pass: every F-209..F-223 behavior, real shell, no mercy.",
		);

		// ---- F-209 + F-210: embed picker keyboard + embed rendering ----------
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes
			.locator('[aria-label*="new" i], button:has-text("New")')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1500);
		await notes.keyboard.type("Fix verification — embeds", { delay: 20 });
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("/database", { delay: 50 });
		await notes.waitForTimeout(1000);
		await notes.keyboard.press("Enter"); // command
		await notes.waitForTimeout(1200);
		await notes.keyboard.press("Enter"); // F-209: commit highlighted picker row
		await notes.waitForTimeout(3500);
		const embedCount = await notes
			.locator('[class*="embed"] iframe, iframe')
			.count()
			.catch(() => 0);
		s.note(`F-209 Enter-commit: embeds in doc = ${embedCount} (expect >=1)`);
		await s.shot(notes, "01-embed-after-enter");
		// Escape path: open another picker and dismiss.
		await notes.keyboard.press("Enter").catch(() => undefined);
		await notes.keyboard.type("/graph", { delay: 50 });
		await notes.waitForTimeout(900);
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(900);
		await notes.keyboard.press("Escape"); // F-209: dismiss
		await notes.waitForTimeout(600);
		await notes.keyboard.type("escaped back to editor", { delay: 15 });
		await notes.waitForTimeout(800);
		const bodyText = await notes
			.locator('[contenteditable="true"]')
			.first()
			.textContent()
			.catch(() => "");
		s.note(
			`F-209 Escape-dismiss: editor got the text after Escape = ${bodyText?.includes("escaped back to editor")}`,
		);
		await s.shot(notes, "02-after-escape-typing");
		// F-210: the embedded grid headers must not read "Prop <id>".
		const frame = notes.frameLocator("iframe").first();
		const headerCells = await frame
			.locator("th, [class*='head']")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`F-210 embed headers: ${JSON.stringify(headerCells.slice(0, 8))}`);
		const rawProp = headerCells.some((h) => /Prop [a-z0-9]/.test(h));
		const rawEpoch = await frame
			.locator("td")
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(
			`F-210 raw-prop headers present: ${rawProp}; sample cells: ${JSON.stringify(rawEpoch.slice(0, 6))}`,
		);
		await s.shot(notes, "03-embed-rendering");

		// ---- F-215/216/217 + F-212 + F-211: Database --------------------------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		// F-212: System group in sidebar.
		const sidebarText = await db
			.locator("aside, [class*='sidebar']")
			.first()
			.textContent()
			.catch(() => "");
		s.note(
			`F-212 sidebar: has System group = ${/System/i.test(sidebarText ?? "")}; BrowsingHistories visible at top level = ${sidebarText?.indexOf("BrowsingHistories") !== -1 && (sidebarText?.indexOf("BrowsingHistories") ?? 0) < (sidebarText?.indexOf("System") ?? 99999)}`,
		);
		await s.shot(db, "04-sidebar-system-group");
		await db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/candidate/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1500);
		const grid = db.locator('[role="tab"]:has-text("Grid"), button:has-text("Grid")').first();
		await grid.click().catch(() => undefined);
		await db.waitForTimeout(800);
		const before = await db
			.locator(".dbv-grid__title-label")
			.count()
			.catch(() => 0);
		// F-215: + New → type immediately → Enter. Exactly one new, named row.
		await db
			.getByRole("button", { name: "New", exact: true })
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(900);
		const active = await db
			.evaluate(() => document.activeElement?.tagName ?? "none")
			.catch(() => "?");
		s.note(`F-215 activeElement after + New: ${active} (expect INPUT)`);
		await db.keyboard.type("Probe Row — delete me", { delay: 20 });
		await db.keyboard.press("Enter");
		await db.waitForTimeout(1200);
		const after = await db
			.locator(".dbv-grid__title-label")
			.count()
			.catch(() => 0);
		const probeVisible = await db
			.locator('text="Probe Row — delete me"')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`F-215 rows ${before}→${after} (expect +1); named row visible: ${probeVisible}`);
		await s.shot(db, "05-row-named");
		// F-216/F-217: row menu has Rename + Delete; delete the probe row.
		const probeRow = db.locator("[data-entity-id]").filter({ hasText: "Probe Row" }).first();
		await probeRow.click({ button: "right" }).catch(() => undefined);
		await db.waitForTimeout(800);
		const menuText = await db
			.locator(".fm-menu, [role='menu']")
			.last()
			.textContent()
			.catch(() => "");
		s.note(
			`F-216/217 row menu: Rename=${/Rename/i.test(menuText ?? "")} Delete=${/Delete/i.test(menuText ?? "")}`,
		);
		await s.shot(db, "06-row-menu");
		const del = db.locator('.fm-menu :text("Delete"), [role="menu"] :text("Delete")').first();
		if (await del.isVisible().catch(() => false)) {
			await del.click().catch(() => undefined);
			await db.waitForTimeout(800);
			await s.shot(db, "07-delete-confirm");
			const confirmBtn = db
				.locator('button:has-text("Delete"), [class*="danger"]:has-text("Delete")')
				.last();
			await confirmBtn.click().catch(() => undefined);
			await db.waitForTimeout(1200);
			const stillThere = await db
				.locator('text="Probe Row — delete me"')
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`F-217 after delete: probe row still visible = ${stillThere} (expect false)`);
		} else {
			await db.keyboard.press("Escape").catch(() => undefined);
		}
		// F-211: new view → Timeline via View type → bars appear (auto-bound date).
		await db
			.locator("aside, nav, [class*='sidebar']")
			.locator("text=/content calendar/i")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		await db
			.locator(".db-tabs [aria-label='New view'], [aria-label='New view']")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1200);
		await db
			.locator("#toolbar-settings")
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(800);
		await db
			.locator('button:has-text("View type")')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(700);
		await db
			.locator('button:has-text("Timeline")')
			.first()
			.click()
			.catch(() => undefined);
		await db.waitForTimeout(1500);
		await db.keyboard.press("Escape").catch(() => undefined);
		await db.waitForTimeout(900);
		const timelineText = await db
			.locator("#stage-body, main")
			.first()
			.textContent()
			.catch(() => "");
		s.note(
			`F-211 timeline after switch: empty-state present = ${/No items have a value/i.test(timelineText ?? "")} (expect false); issues visible = ${/Issue #/.test(timelineText ?? "")}`,
		);
		await s.shot(db, "08-timeline-autobound");

		// ---- F-218: calendar dialog ------------------------------------------
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2500);
		await cal
			.locator('.app-header [aria-label*="new" i], .app-header button:has-text("+")')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(1000);
		const startVal = await cal
			.locator('input[type="datetime-local"]')
			.first()
			.inputValue()
			.catch(() => "?");
		s.note(`F-218 default start: ${startVal} (expect today 2026-06-12, next full hour)`);
		await cal.keyboard.type("Fix-verification event", { delay: 15 });
		await cal.keyboard.press("Enter"); // F-218: Enter commits
		await cal.waitForTimeout(1500);
		const dialogStill = await cal
			.locator('text="Save event"')
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`F-218 Enter-commit: dialog still open = ${dialogStill} (expect false)`);
		await s.shot(cal, "09-calendar-after-enter");

		// ---- F-213: whiteboard first-keystroke capture ------------------------
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		const wbox = await wb
			.locator("canvas")
			.first()
			.boundingBox()
			.catch(() => null);
		if (wbox) {
			const nodesBefore = await wb
				.evaluate(() => document.querySelectorAll("[data-node-id]").length)
				.catch(() => -1);
			await wb.mouse.dblclick(wbox.x + wbox.width * 0.7, wbox.y + wbox.height * 0.75);
			// NO wait — type immediately; every char must land.
			await wb.keyboard.type("Immediate capture check", { delay: 15 });
			await wb.waitForTimeout(700);
			await s.shot(wb, "10-whiteboard-typed");
			await wb.mouse.click(wbox.x + 40, wbox.y + 40);
			await wb.waitForTimeout(900);
			const nodesAfter = await wb
				.evaluate(() => document.querySelectorAll("[data-node-id]").length)
				.catch(() => -1);
			const wbText = await wb.evaluate(() => document.body.textContent ?? "").catch(() => "");
			s.note(
				`F-213 full text committed: ${wbText.includes("Immediate capture check")}; nodes ${nodesBefore}→${nodesAfter} (expect +1)`,
			);
			await s.shot(wb, "11-whiteboard-committed");
		}

		// ---- F-219: reminder capture validation -------------------------------
		const auto = await s.openApp(APP.Automations);
		await auto.waitForTimeout(2500);
		await auto
			.locator('button:has-text("Reminders")')
			.first()
			.click()
			.catch(() => undefined);
		await auto.waitForTimeout(800);
		const addBtn = auto.locator('button:has-text("Add reminder")').first();
		const disabledEmpty = await addBtn.isDisabled().catch(() => false);
		await auto
			.locator('input[placeholder*="Remind" i]')
			.first()
			.fill("validation probe")
			.catch(() => undefined);
		await auto.waitForTimeout(400);
		const disabledTyped = await addBtn.isDisabled().catch(() => true);
		s.note(
			`F-219 Add reminder: disabled when empty = ${disabledEmpty} (expect true); disabled after typing = ${disabledTyped} (expect false)`,
		);
		await s.shot(auto, "12-reminder-validation");

		// ---- F-214: FindBar select-on-reopen ----------------------------------
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(2500);
		await ce
			.locator("aside li")
			.first()
			.click()
			.catch(() => undefined);
		await ce.waitForTimeout(1000);
		await ce
			.locator(".editor__buffer")
			.first()
			.click()
			.catch(() => undefined);
		await ce.keyboard.press(`${MOD}+f`);
		await ce.waitForTimeout(600);
		await ce.keyboard.type("alpha", { delay: 20 });
		await ce.keyboard.press("Escape");
		await ce.waitForTimeout(500);
		await ce
			.locator(".editor__buffer")
			.first()
			.click()
			.catch(() => undefined);
		await ce.keyboard.press(`${MOD}+f`);
		await ce.waitForTimeout(600);
		await ce.keyboard.type("beta", { delay: 20 });
		await ce.waitForTimeout(500);
		const findVal = await ce
			.locator('[class*="find"] input')
			.first()
			.inputValue()
			.catch(() => "?");
		s.note(`F-214 reopen+type: find input = "${findVal}" (expect "beta", not "alphabeta")`);
		await s.shot(ce, "13-findbar-reopen");
		await ce.keyboard.press("Escape").catch(() => undefined);

		s.chat(SPEAKER.Kai, "Verification pass captured — per-fix verdicts in the session notes.");
	} finally {
		await s.finish();
	}
});
