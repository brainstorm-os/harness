/**
 * Probe 935 — is a COLLAPSED sidebar still in the tab order?
 *
 * Probes 932/934 found the same shape in two apps: with the sidebar collapsed,
 * its rows stay in the DOM at `x = -240` with full width and height — visible
 * to CSS, off the screen to a human. That is how the audit sweep hung for 30s
 * per interaction, but the interesting question is the accessibility one: if
 * those rows are still focusable, a keyboard user tabs into a panel they
 * cannot see, and a screen-reader user is read a list that is not on screen.
 *
 * This asks each app directly: how many focusable elements sit outside the
 * viewport, and does pressing Tab from the header actually land on one?
 */

import { test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

const TARGETS: ReadonlyArray<readonly [string, AppId]> = [
	["tasks", APP.Tasks],
	["files", APP.Files],
	["notes", APP.Notes],
];

const FOCUSABLE =
	"a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [role=button], [role=option], [role=row]";

test("probe — off-canvas focusables in a collapsed sidebar (935)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("935-probe-offcanvas-focus");
	try {
		for (const [label, id] of TARGETS) {
			let report = "";
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(3000);
				report = await page.evaluate((sel) => {
					const out: string[] = [];
					const all = Array.from(document.querySelectorAll<HTMLElement>(sel));
					const off = all.filter((el) => {
						const r = el.getBoundingClientRect();
						if (r.width <= 0 || r.height <= 0) return false;
						return r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight;
					});
					out.push(`focusable total=${all.length} offscreen=${off.length}`);
					for (const el of off.slice(0, 6)) {
						const r = el.getBoundingClientRect();
						const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
						const hiddenAncestor = el.closest("[aria-hidden='true'],[hidden],[inert]");
						out.push(
							`  ${el.tagName.toLowerCase()}.${cls} x=${Math.round(r.x)} y=${Math.round(r.y)} ` +
								`tabindex=${el.getAttribute("tabindex") ?? "-"} guarded=${hiddenAncestor ? hiddenAncestor.tagName.toLowerCase() : "NO"}`,
						);
					}
					return out.join("\n");
				}, FOCUSABLE);

				// Does Tab actually reach one? Walk from the document start.
				await page.evaluate(() => {
					document.body.setAttribute("tabindex", "-1");
					(document.body as HTMLElement).focus();
				});
				const landed: string[] = [];
				for (let i = 0; i < 25; i += 1) {
					await page.keyboard.press("Tab");
					const info = await page.evaluate(() => {
						const el = document.activeElement as HTMLElement | null;
						if (!el || el === document.body) return null;
						const r = el.getBoundingClientRect();
						const offscreen = r.right <= 0 || r.bottom <= 0;
						const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
						return offscreen ? `${el.tagName.toLowerCase()}.${cls} x=${Math.round(r.x)}` : null;
					});
					if (info) landed.push(info);
				}
				report += `\n  TAB landed on ${landed.length} offscreen element(s) in 25 presses`;
				for (const l of landed.slice(0, 4)) report += `\n    ${l}`;
			} catch (e) {
				report = `FAILED: ${(e as Error).message.split("\n")[0]}`;
			}
			s.note(`\n=== ${label} ===\n${report}`);
		}
	} finally {
		await s.finish();
	}
});
