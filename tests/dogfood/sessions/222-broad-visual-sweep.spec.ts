/**
 * Session 222 — broad visual sweep. Open every app against Mira's vault and
 * capture a full-window shot, so the current visual state of all 18 apps can be
 * reviewed in one pass for "broken / ugly / working badly" issues. Also records
 * any renderer console errors per app (the console.log aggregates them).
 */

import { test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

const SWEEP: [string, AppId][] = [
	["notes", APP.Notes],
	["database", APP.Database],
	["tasks", APP.Tasks],
	["calendar", APP.Calendar],
	["journal", APP.Journal],
	["graph", APP.Graph],
	["whiteboard", APP.Whiteboard],
	["files", APP.Files],
	["bookmarks", APP.Bookmarks],
	["code-editor", APP.CodeEditor],
	["theme-editor", APP.ThemeEditor],
	["agent", APP.Agent],
	["contacts", APP.Contacts],
	["automations", APP.Automations],
	["browser", APP.Browser],
	["mailbox", APP.Mailbox],
	["form-designer", APP.FormDesigner],
	["books", APP.Books],
];

test("broad visual sweep across all apps (222)", async () => {
	test.setTimeout(540_000);
	const s = await startSession("222-broad-visual-sweep");
	try {
		let i = 0;
		for (const [name, id] of SWEEP) {
			i += 1;
			const prefix = String(i).padStart(2, "0");
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(2600);
				await s.shot(page, `${prefix}-${name}`);
				s.note(`opened ${name}`);
			} catch (err) {
				s.note(`FAILED to open ${name}: ${(err as Error).message}`);
			}
		}
	} finally {
		await s.finish();
	}
});
