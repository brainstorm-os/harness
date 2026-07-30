import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
test("header menu pickers (917)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("917-menu-check");
	const ce = await s.openApp(APP.CodeEditor);
	await ce.waitForTimeout(2500);
	await ce.locator(".editor__file[data-file-id] .editor__file-open").first().click();
	await ce.waitForTimeout(800);
	await ce.locator(".app-header__right .bs-object-menu__more").last().click();
	await ce.waitForTimeout(1000);
	await s.shot(ce, "01-header-menu");
	const theme = ce.locator(".fm-row").filter({ hasText: /Syntax theme/ }).first();
	if ((await theme.count()) > 0) {
		await theme.hover();
		await ce.waitForTimeout(1200);
		await s.shot(ce, "02-syntax-theme-submenu");
	}
	await ce.keyboard.press("Escape");
	await s.finish();
});
