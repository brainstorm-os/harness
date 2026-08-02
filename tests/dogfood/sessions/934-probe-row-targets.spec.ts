/**
 * Probe 934 — which element should the 329 sweep right-click, per app?
 *
 * The twenty-app audit came back with a coverage hole: in notes, files, graph,
 * whiteboard, code-editor, theme-editor, agent and books the `03-context-menu`
 * capture was pixel-identical to `01-main` — no menu ever opened — so those
 * apps' row hover + context menus went unjudged. Probe 932 already showed the
 * cause in Tasks (the first `[data-entity-id]` is an off-canvas sidebar row at
 * x=-240: CSS-visible, never actionable).
 *
 * Rather than guess a selector per app, ask each app: for every candidate row
 * element, report its rect and whether `elementFromPoint` at its centre lands
 * inside it. The first candidate that passes is the one the sweep should drive.
 */

import { test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

const TARGETS: ReadonlyArray<readonly [string, AppId]> = [
	["notes", APP.Notes],
	["files", APP.Files],
	["graph", APP.Graph],
	["whiteboard", APP.Whiteboard],
	["codeeditor", APP.CodeEditor],
	["themeeditor", APP.ThemeEditor],
	["agent", APP.Agent],
	["books", APP.Books],
	["chat", APP.Chat],
];

test("probe — actionable row targets per app (934)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("934-probe-row-targets");
	try {
		for (const [label, id] of TARGETS) {
			let report = "";
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(2200);
				// A list hydrated from the vault can take longer than the open —
				// the first cut of this probe reported "no candidates" for seven
				// apps that plainly render rows, which was the probe being early,
				// not the app being empty.
				await page
					.waitForFunction(
						() =>
							document.querySelectorAll("[data-entity-id], li, [role=row], [role=listitem]").length > 0,
						undefined,
						{ timeout: 15_000 },
					)
					.catch(() => {});
				report = await page.evaluate(() => {
					const lines: string[] = [];
					const seen = new Set<string>();
					const candidates = Array.from(
						document.querySelectorAll<HTMLElement>("[data-entity-id], li, [role=row], [role=listitem]"),
					).slice(0, 400);
					for (const el of candidates) {
						const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
						const key = `${el.tagName.toLowerCase()}.${cls}`;
						if (seen.has(key)) continue;
						const r = el.getBoundingClientRect();
						if (r.width <= 0 || r.height <= 0) continue;
						const cx = r.x + r.width / 2;
						const cy = r.y + r.height / 2;
						const onScreen = cx > 0 && cy > 0 && cx < window.innerWidth && cy < window.innerHeight;
						const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
						const actionable = Boolean(hit && (el.contains(hit) || hit.contains(el)));
						seen.add(key);
						lines.push(
							`${actionable ? "OK  " : "no  "} ${key} rect=(${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}) entity=${el.hasAttribute("data-entity-id")}`,
						);
						if (lines.length >= 14) break;
					}
					return lines.join("\n") || "no candidates";
				});
			} catch (e) {
				report = `FAILED: ${(e as Error).message.split("\n")[0]}`;
			}
			s.note(`\n=== ${label} ===\n${report}`);
		}
	} finally {
		await s.finish();
	}
});
