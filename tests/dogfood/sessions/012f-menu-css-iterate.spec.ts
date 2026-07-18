/**
 * 012f — F-406 CSS iteration probe: open the Files view select, then inject
 * candidate CSS fixes cumulatively and measure the live menu after each, so
 * the real fix is known before it ships (per the inject-probe pattern —
 * a passing injection still needs a clean rebuild to confirm).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const CANDIDATES: ReadonlyArray<{ label: string; css: string }> = [
	{
		label: "icon-reserve",
		css: ".fm-menu .fm-row__icon:empty { display: inline-flex; inline-size: 14px; block-size: 14px; }",
	},
	{
		label: "row-auto-width",
		css: ".fm-menu .fm-row { width: auto; min-width: 100%; }",
	},
	{
		label: "list-max-content",
		css: ".fm-menu .fm-list { width: max-content; min-width: 100%; }",
	},
	{
		label: "name-no-shrink",
		css: ".fm-menu .fm-row__name { flex: 1 0 auto; }",
	},
];

test("iterate CSS candidates on the live select menu", async () => {
	const s = await startSession("012f-menu-css-iterate");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(3000);
		await files.locator(".bs-select").last().click();
		await files.waitForTimeout(700);

		const measure = () =>
			files.evaluate(() => {
				const menu = document.querySelector(".fm-menu");
				const gallery = Array.from(document.querySelectorAll(".fm-row")).find((r) =>
					(r.textContent ?? "").includes("Gallery"),
				);
				const name = gallery?.querySelector(".fm-row__name");
				const icon = gallery?.querySelector(".fm-row__icon");
				return {
					menuW: menu instanceof HTMLElement ? Math.round(menu.getBoundingClientRect().width) : 0,
					galleryClipped:
						name instanceof HTMLElement ? name.scrollWidth > name.clientWidth + 1 : null,
					iconW: icon instanceof HTMLElement ? Math.round(icon.getBoundingClientRect().width) : -1,
					blankIconW: (() => {
						const list = Array.from(document.querySelectorAll(".fm-row"))
							.find((r) => (r.textContent ?? "").includes("List"))
							?.querySelector(".fm-row__icon");
						return list instanceof HTMLElement
							? Math.round(list.getBoundingClientRect().width)
							: -1;
					})(),
				};
			});

		s.note(`[base] ${JSON.stringify(await measure())}`);
		for (const c of CANDIDATES) {
			await files.addStyleTag({ content: c.css });
			await files.waitForTimeout(200);
			s.note(`[+${c.label}] ${JSON.stringify(await measure())}`);
		}
		await s.shot(files, "menu-after-injection");
	} finally {
		await s.finish();
	}
});
