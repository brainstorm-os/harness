/**
 * Probe 932 — why does every pointer interaction in Tasks time out?
 *
 * Session 329's sweep captured Tasks' main view fine but ALL hover/clicks
 * (rows AND the header ⋯) hit the 30s actionability timeout, in both themes,
 * while the other 19 apps interact normally. That smells like an invisible
 * full-window overlay eating pointer events. This probe asks the page what
 * element sits at the center of the first task row and at the header ⋯, and
 * whether anything covers the viewport.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe — tasks pointer-event blocker (932)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("932-probe-tasks-pointer");
	try {
		const page = await s.openApp(APP.Tasks);
		await page.waitForTimeout(2500);

		const report = await page.evaluate(() => {
			const out: string[] = [];
			const probe = (label: string, x: number, y: number) => {
				const el = document.elementFromPoint(x, y);
				const path: string[] = [];
				let cur: Element | null = el;
				for (let i = 0; cur && i < 6; i += 1) {
					const cls = typeof cur.className === "string" && cur.className ? `.${cur.className.split(" ").join(".")}` : "";
					path.push(`${cur.tagName.toLowerCase()}${cls}`);
					cur = cur.parentElement;
				}
				out.push(`${label} @(${x},${y}): ${path.join(" << ") || "NOTHING"}`);
				if (el) {
					const cs = getComputedStyle(el);
					out.push(`  pointer-events=${cs.pointerEvents} position=${cs.position} z-index=${cs.zIndex} opacity=${cs.opacity}`);
				}
			};
			const row = document.querySelector("[data-entity-id]");
			if (row) {
				const r = row.getBoundingClientRect();
				out.push(`first row rect: ${JSON.stringify(r)} visible=${r.width > 0 && r.height > 0}`);
				probe("row center", r.x + r.width / 2, r.y + r.height / 2);
			} else {
				out.push("NO [data-entity-id] in DOM");
			}
			const more = document.querySelector(".app-header .bs-object-menu__more");
			if (more) {
				const r = more.getBoundingClientRect();
				probe("header-more center", r.x + r.width / 2, r.y + r.height / 2);
			} else {
				out.push("NO header .bs-object-menu__more");
			}
			probe("viewport center", window.innerWidth / 2, window.innerHeight / 2);
			return out.join("\n");
		});
		s.note(report);

		// And what does Playwright's own actionability say, quickly?
		const row = page.locator("[data-entity-id]:visible").first();
		const err = await row
			.hover({ timeout: 5000 })
			.then(() => "hover OK")
			.catch((e: Error) => `hover FAILED: ${e.message.split("\n").slice(0, 3).join(" | ")}`);
		s.note(err);
	} finally {
		await s.finish();
	}
});
