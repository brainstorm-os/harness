/**
 * Probe 211b — code-editor retry with the right target (`.editor__buffer`
 * textarea): typing, find (B9.3), Cmd+D multi-cursor (9.7.3), indent
 * folding, Cmd+Shift+F Prettier format (9.7.8).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const MOD = process.platform === "darwin" ? "Meta" : "Control";

test("probe: code editor buffer — find, multi-cursor, fold, format (211b)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("211b-probe-code-editor");
	try {
		const ce = await s.openApp(APP.CodeEditor);
		await ce.waitForTimeout(3000);
		const fileRow = ce.locator("aside li, [class*='file'] li").first();
		await fileRow.click().catch(() => undefined);
		await ce.waitForTimeout(1200);
		const buffer = ce.locator(".editor__buffer").first();
		const bufVisible = await buffer.isVisible().catch(() => false);
		s.note(`.editor__buffer visible: ${bufVisible}`);
		if (!bufVisible) return;
		await buffer.click();
		// Indented code so indent-folding has regions; messy spacing so the
		// formatter has something to fix.
		await ce.keyboard.type(
			"function totals(items){\n  const sum=items.map(x=>x.price).reduce((a,b)=>a+b,0)\n  if(sum>100){\n    return {sum,big:true}\n  }\n  return {sum,big:false}\n}\nconst out=totals(list)\n",
			{ delay: 10 },
		);
		await ce.waitForTimeout(1200);
		await s.shot(ce, "01-typed");
		const value = await buffer.inputValue().catch(() => "");
		s.note(`buffer length after typing: ${value.length}`);

		// Find.
		await ce.keyboard.press(`${MOD}+f`);
		await ce.waitForTimeout(700);
		await ce.keyboard.type("sum", { delay: 30 });
		await ce.waitForTimeout(900);
		const findText = await ce
			.locator('[class*="find"]')
			.first()
			.textContent()
			.catch(() => null);
		s.note(`find bar: ${findText?.slice(0, 80)}`);
		await s.shot(ce, "02-find");
		await ce.keyboard.press("Escape");
		await ce.waitForTimeout(400);

		// Multi-cursor: select first "sum" then Cmd+D twice.
		const idx = value.indexOf("sum");
		await buffer.evaluate((el, i) => {
			const ta = el as HTMLTextAreaElement;
			ta.focus();
			ta.setSelectionRange(i, i + 3);
		}, idx);
		await ce.keyboard.press(`${MOD}+d`);
		await ce.keyboard.press(`${MOD}+d`);
		await ce.waitForTimeout(800);
		await s.shot(ce, "03-multi-cursor");
		const carets = await ce
			.locator('[class*="caret"], [class*="cursor"], [class*="selection"]')
			.count()
			.catch(() => 0);
		s.note(`secondary caret/selection decorations: ${carets}`);
		await ce.keyboard.press("Escape").catch(() => undefined);

		// Folding affordances.
		const folds = await ce
			.locator('[class*="fold"]')
			.count()
			.catch(() => 0);
		s.note(`fold affordances: ${folds}`);
		await s.shot(ce, "04-gutter");
		if (folds > 0) {
			await ce
				.locator('[class*="fold"]')
				.first()
				.click()
				.catch(() => undefined);
			await ce.waitForTimeout(700);
			await s.shot(ce, "05-folded");
		}

		// Format.
		await buffer.click().catch(() => undefined);
		await ce.keyboard.press(`${MOD}+Shift+f`);
		await ce.waitForTimeout(2500);
		const formatted = await buffer.inputValue().catch(() => "");
		s.note(
			`formatted? before=${value.includes("sum=items")} after has "sum = items": ${formatted.includes("sum = items")}`,
		);
		await s.shot(ce, "06-after-format");

		s.chat(SPEAKER.Priya, "Code-editor probe done with the right target this time.");
	} finally {
		await s.finish();
	}
});
