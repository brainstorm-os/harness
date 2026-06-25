/** 205e — instrument the sticky typing flow: where does focus go mid-string? */
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("sticky typing focus probe (205e)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("205e-typing-probe");
	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		const stage = wb.locator("[class*='canvas']").first();
		const box = await stage.boundingBox();
		if (!box) throw new Error("no canvas box");
		const pt = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 };
		await wb.mouse.move(pt.x, pt.y);
		await wb.keyboard.press("s");
		await wb.waitForTimeout(400);
		const active = async () =>
			await wb.evaluate(() => {
				const a = document.activeElement as HTMLElement | null;
				return a ? `${a.tagName}.${a.className.toString().slice(0, 60)}` : "none";
			});
		s.note(`after s: ${await active()}`);
		const chunks = ["Leads", ": refe", "rrals ", "+ news", "letter", " CTA"];
		for (const chunk of chunks) {
			await wb.keyboard.type(chunk, { delay: 15 });
			s.note(`after "${chunk}": ${await active()}`);
		}
		await wb.waitForTimeout(600);
		s.note(`after settle: ${await active()}`);
		const dump = await wb.evaluate(() =>
			Array.from(document.querySelectorAll(".whiteboard__node")).map(
				(el) =>
					`${el.className.toString().replace("whiteboard__node ", "")}: "${el.textContent?.trim().slice(0, 50)}"`,
			),
		);
		s.note(`nodes: ${JSON.stringify(dump, null, 1)}`);
		await s.shot(wb, "01-final");
	} finally {
		await s.finish();
	}
});
