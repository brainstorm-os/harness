/** 205d — title dblclick rename probe (F-198 verification). */
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("title dblclick rename (205d)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("205d-rename-probe");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		const name = wb.locator(".whiteboard__board-name").first();
		s.note(`title text: ${await name.textContent().catch(() => "?")}`);
		await name.dblclick().catch((e) => s.note(`dblclick threw: ${e.message}`));
		await wb.waitForTimeout(600);
		const probe = await wb.evaluate(() => {
			const a = document.activeElement as HTMLElement | null;
			const span = document.querySelector(".whiteboard__board-name");
			return {
				active: a ? `${a.tagName}.${a.className}` : "none",
				spanHtml: span?.innerHTML.slice(0, 120) ?? "missing",
			};
		});
		s.note(JSON.stringify(probe));
		await s.shot(wb, "01-after-dblclick");
		if (probe.active.startsWith("INPUT")) {
			await wb.keyboard.press("Meta+a");
			await wb.keyboard.type("Q3 GTM map", { delay: 10 });
			await wb.keyboard.press("Enter");
			await wb.waitForTimeout(800);
			s.note(`title after rename: ${await name.textContent().catch(() => "?")}`);
			await s.shot(wb, "02-renamed");
		}
	} finally {
		await s.finish();
	}
});
