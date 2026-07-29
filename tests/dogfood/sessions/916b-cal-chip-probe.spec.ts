/**
 * Session 916b — DOM probe for the week-view block-chip meta clipping.
 * Dumps every `.cal-chip--block`'s rect, density, and child line boxes so the
 * clipping mechanism is established from geometry, not guessed from pixels.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe week-view block chip geometry", async () => {
	test.setTimeout(240_000);
	const s = await startSession("916b-cal-chip-probe");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);
		await cal.getByRole("tab", { name: "Week" }).first().click();
		await cal.waitForTimeout(1000);
		const dump = await cal.evaluate(() => {
			const out: unknown[] = [];
			for (const chip of Array.from(document.querySelectorAll(".cal-chip--block"))) {
				const r = chip.getBoundingClientRect();
				const kids = Array.from(chip.children).map((k) => {
					const kr = k.getBoundingClientRect();
					const cs = getComputedStyle(k);
					return {
						cls: k.className,
						text: (k.textContent ?? "").slice(0, 40),
						h: Math.round(kr.height),
						top: Math.round(kr.top - r.top),
						display: cs.display,
						lineHeight: cs.lineHeight,
						fontSize: cs.fontSize,
					};
				});
				out.push({
					density: chip.getAttribute("data-density"),
					h: Math.round(r.height),
					styleHeight: (chip as HTMLElement).style.height,
					text: (chip.textContent ?? "").slice(0, 44),
					kids,
				});
			}
			return out;
		});
		s.note(JSON.stringify(dump, null, 1));
	} finally {
		await s.finish();
	}
});
