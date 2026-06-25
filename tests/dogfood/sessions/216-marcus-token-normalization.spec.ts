/**
 * Session 216 — Marcus verifies the design-token normalization pass
 * (radius → scale, hover → --hover, padding/margin → --space-*). Opens the
 * list/padding-heavy apps, captures a full-window shot of each (so the snap
 * reads at a glance), and measures the live computed radius/padding values to
 * confirm they sit on the {4,6,8,12,16} radius set + the {2,4,8,12,16,24,32}
 * spacing set — i.e. the normalization actually shipped in the built bundle.
 */

import { test } from "@playwright/test";
import { APP, type AppId, SPEAKER, startSession } from "../lib/founder";

function measureTokens(): { offRadius: string[]; offPadding: string[]; sampled: number } {
	// Defined INSIDE so they serialize into the page `evaluate` (module-level
	// closures don't cross into the browser context).
	const RADIUS_OK = new Set([0, 4, 6, 8, 12, 16, 9999]);
	const SPACE_OK = new Set([0, 2, 4, 8, 12, 16, 24, 32, 48, 64]);
	const offRadius = new Set<string>();
	const offPadding = new Set<string>();
	let sampled = 0;
	const els = document.body.querySelectorAll("*");
	let i = 0;
	for (const node of els) {
		if (++i > 4000) break;
		const el = node as HTMLElement;
		if (el.offsetParent === null) continue;
		const r = el.getBoundingClientRect();
		if (r.width < 4 || r.height < 4) continue;
		sampled++;
		const cs = getComputedStyle(el);
		const radius = Math.round(Number.parseFloat(cs.borderTopLeftRadius) || 0);
		if (radius > 0 && !RADIUS_OK.has(radius) && offRadius.size < 12) {
			offRadius.add(`${radius}px .${el.className.toString().slice(0, 28)}`);
		}
		for (const side of ["paddingTop", "paddingLeft"] as const) {
			const p = Math.round(Number.parseFloat(cs[side]) || 0);
			if (p > 0 && !SPACE_OK.has(p) && offPadding.size < 12) {
				offPadding.add(`${p}px .${el.className.toString().slice(0, 28)}`);
			}
		}
	}
	return { offRadius: [...offRadius], offPadding: [...offPadding], sampled };
}

const APPS: [string, AppId][] = [
	["notes", APP.Notes],
	["database", APP.Database],
	["tasks", APP.Tasks],
	["calendar", APP.Calendar],
	["files", APP.Files],
	["bookmarks", APP.Bookmarks],
	["contacts", APP.Contacts],
	["agent", APP.Agent],
];

test("Marcus verifies the token-normalization pass (216)", async () => {
	test.setTimeout(580_000);
	const s = await startSession("216-marcus-token-normalization");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Spacing + radius got pulled onto the token scale — corners, hovers, paddings. I'm opening the list-heavy apps to see if it reads cleaner or if anything went too loose. Full shots + a ruler on the computed values.",
		);
		for (const [name, id] of APPS) {
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(2600);
				await s.shot(page, `${name}-full`);
				const m = await page.evaluate(measureTokens).catch(() => null);
				if (m) {
					s.note(`=== ${name} === sampled ${m.sampled} visible els`);
					s.note(
						m.offRadius.length
							? `off-scale radius: ${m.offRadius.join(" · ")}`
							: "radius: all on-scale ✓",
					);
					s.note(
						m.offPadding.length
							? `off-scale padding: ${m.offPadding.join(" · ")}`
							: "padding: all on-scale ✓",
					);
				} else {
					s.note(`=== ${name} === measure failed`);
				}
			} catch (error) {
				s.note(`=== ${name} === FAILED: ${(error as Error).message.slice(0, 120)}`);
			}
		}
		s.chat(SPEAKER.Marcus, "Captures in. Reading the crops + the off-scale lists now.");
	} finally {
		await s.finish();
	}
});
