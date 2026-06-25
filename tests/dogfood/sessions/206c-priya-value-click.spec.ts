/** 206c — do bookmark property VALUES edit on click? (Notes "Empty", Site value) */
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("value-side click editing probe (206c)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("206c-priya-value-click");
	try {
		const bm = await s.openApp(APP.Bookmarks);
		await bm.waitForTimeout(2500);
		await bm
			.locator("[data-entity-id]")
			.last()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(1200);
		await bm
			.locator('[aria-label="Properties"]')
			.first()
			.click()
			.catch(() => undefined);
		await bm.waitForTimeout(900);

		const notesValue = bm.getByText("Empty", { exact: true }).first();
		await notesValue.click().catch(() => undefined);
		await bm.waitForTimeout(600);
		let focused = await bm
			.evaluate(() => {
				const a = document.activeElement as HTMLElement | null;
				return a ? `${a.tagName}.${a.className}` : "none";
			})
			.catch(() => "err");
		s.note(`after Notes value click, activeElement: ${focused}`);
		await s.shot(bm, "01-notes-value-clicked");
		if (focused.startsWith("TEXTAREA") || focused.startsWith("INPUT")) {
			await bm.keyboard.type("Methodology solid; cite in Issue #5.", { delay: 10 });
			await bm.keyboard.press("Enter").catch(() => undefined);
			await bm.waitForTimeout(600);
			await s.shot(bm, "02-notes-filled");
		}

		const siteValue = bm.getByText("example.com", { exact: true }).last();
		await siteValue.click().catch(() => undefined);
		await bm.waitForTimeout(600);
		focused = await bm
			.evaluate(() => {
				const a = document.activeElement as HTMLElement | null;
				return a ? `${a.tagName}.${a.className}` : "none";
			})
			.catch(() => "err");
		s.note(`after Site value click, activeElement: ${focused}`);
		await s.shot(bm, "03-site-value-clicked");
		if (focused.startsWith("INPUT") || focused.startsWith("TEXTAREA")) {
			await bm.keyboard.press("Meta+a").catch(() => undefined);
			await bm.keyboard.type("Example Press", { delay: 10 });
			await bm.keyboard.press("Enter").catch(() => undefined);
			await bm.waitForTimeout(600);
			await s.shot(bm, "04-site-renamed");
		}
	} finally {
		await s.finish();
	}
});
