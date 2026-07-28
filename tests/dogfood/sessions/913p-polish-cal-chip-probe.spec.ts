/**
 * POLISH 0.11.0 probe — why do Calendar month all-day chips clip the START of
 * their labels ("ipeline ready")? Dump geometry + computed styles of the chip
 * button, its title span, and every ancestor up to the cell.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe — calendar month chip left-clip", async () => {
	test.setTimeout(180_000);
	const s = await startSession("913p-polish-cal-chip-probe");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(2500);
		const dump = await cal.evaluate(() => {
			const out: unknown[] = [];
			const chips = Array.from(document.querySelectorAll(".cal-chip--compact")).slice(0, 6);
			for (const chip of chips) {
				const title = chip.querySelector(".cal-chip__title");
				const info = (el: Element | null) => {
					if (!el) return null;
					const cs = getComputedStyle(el);
					const r = el.getBoundingClientRect();
					return {
						cls: el.className,
						text: (el.textContent ?? "").slice(0, 30),
						rect: { x: Math.round(r.x), w: Math.round(r.width) },
						scrollLeft: (el as HTMLElement).scrollLeft,
						scrollWidth: (el as HTMLElement).scrollWidth,
						clientWidth: (el as HTMLElement).clientWidth,
						direction: cs.direction,
						justify: cs.justifyContent,
						overflow: cs.overflow,
						textIndent: cs.textIndent,
						transform: cs.transform,
						margin: cs.margin,
						padding: cs.padding,
					};
				};
				const ancestors: unknown[] = [];
				let a: Element | null = chip.parentElement;
				for (let i = 0; i < 4 && a; i++, a = a.parentElement) ancestors.push(info(a));
				out.push({ chip: info(chip), title: info(title), ancestors });
			}
			// ribbons too
			const ribbons = Array.from(document.querySelectorAll(".cal-month__ribbon")).slice(0, 4);
			const ribbonDump = ribbons.map((rb) => ({
				rb: {
					cls: rb.className,
					text: (rb.textContent ?? "").slice(0, 30),
					scrollLeft: (rb as HTMLElement).scrollLeft,
					scrollWidth: (rb as HTMLElement).scrollWidth,
					clientWidth: (rb as HTMLElement).clientWidth,
					rect: (() => {
						const r = rb.getBoundingClientRect();
						return { x: Math.round(r.x), w: Math.round(r.width) };
					})(),
				},
				title: (() => {
					const t2 = rb.querySelector(".cal-month__ribbon-title");
					if (!t2) return null;
					const r = t2.getBoundingClientRect();
					return {
						text: (t2.textContent ?? "").slice(0, 30),
						rect: { x: Math.round(r.x), w: Math.round(r.width) },
						scrollLeft: (t2 as HTMLElement).scrollLeft,
						scrollWidth: (t2 as HTMLElement).scrollWidth,
						clientWidth: (t2 as HTMLElement).clientWidth,
					};
				})(),
			}));
			return { chips: out, ribbons: ribbonDump };
		});
		s.note(JSON.stringify(dump, null, 1));
		expect(true).toBe(true);
	} finally {
		await s.finish();
	}
});
