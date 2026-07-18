/**
 * 012d — F-406 reproduction check at HEAD: open the Files header view
 * select and measure the menu's rendered option labels (the report:
 * "Ic…", "G…", "G…" + a label-less checked row, menu clamped to the
 * trigger's width).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("Files view select menu renders full labels", async () => {
	const s = await startSession("012d-files-view-menu-probe");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(3000);
		await files.locator(".bs-select").last().click();
		await files.waitForTimeout(700);
		const probe = await files.evaluate(() => {
			const menu = document.querySelector(".fm-menu");
			const menuEl = menu instanceof HTMLElement ? menu : null;
			const rows = Array.from(document.querySelectorAll(".fm-row"));
			return {
				menuW: menuEl ? Math.round(menuEl.getBoundingClientRect().width) : 0,
				menuStyle: menuEl
					? {
							width: getComputedStyle(menuEl).width,
							minWidth: getComputedStyle(menuEl).minWidth,
							maxWidth: getComputedStyle(menuEl).maxWidth,
							inline: menuEl.getAttribute("style") ?? "",
						}
					: null,
				labels: rows.map((r) => {
					const el = r as HTMLElement;
					const name = el.querySelector(".fm-row__name");
					const icon = el.querySelector(".fm-row__icon");
					return {
						text: (el.textContent ?? "").trim(),
						nameClipped:
							name instanceof HTMLElement ? name.scrollWidth > name.clientWidth + 1 : null,
						iconW: icon instanceof HTMLElement ? Math.round(icon.getBoundingClientRect().width) : -1,
						iconEmpty: icon ? icon.childNodes.length === 0 : null,
					};
				}),
			};
		});
		s.note(`[probe] view menu: ${JSON.stringify(probe)}`);
		await s.shot(files, "files-view-menu");
		expect(probe.labels.length).toBeGreaterThan(2);
		for (const l of probe.labels) {
			expect(l.text.length, `label "${l.text}" not empty`).toBeGreaterThan(2);
			expect(l.nameClipped, `label "${l.text}" not clipped`).toBe(false);
		}
	} finally {
		await s.finish();
	}
});
