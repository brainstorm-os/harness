/**
 * Session 373 — focus-frame audit.
 *
 * Dogfood report: "the focus frame appears often in places it's not expected
 * and looks super ugly." This spec grounds that empirically instead of guessing
 * across the CSS: for every app, it drives the REAL keyboard path (Tab) and,
 * after each stop, reads `document.activeElement` — its tag/role/size and its
 * computed focus indicator (outline or a focus-ring box-shadow). It flags every
 * stop that SHOWS a ring but is NOT a genuine interactive control (a divider, a
 * container, a static/decorative element, an oversized region) — i.e. the
 * "unexpected ugly frame" class. Non-asserting; it writes a triage report.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"]);
const INTERACTIVE_ROLES = new Set([
	"button",
	"link",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"tab",
	"checkbox",
	"radio",
	"switch",
	"slider",
	"textbox",
	"combobox",
	"searchbox",
	"spinbutton",
]);

type Stop = {
	app: string;
	sig: string;
	tag: string;
	role: string;
	w: number;
	h: number;
	indicator: string;
	reason: string;
};

test("focus-frame audit: tab every app, flag unexpected rings", async () => {
	test.setTimeout(600_000);
	const s = await startSession("373-focus-frame-audit");
	const flagged: Stop[] = [];

	for (const [name, id] of Object.entries(APP)) {
		let page: Awaited<ReturnType<typeof s.openApp>>;
		try {
			page = await s.openApp(id);
		} catch {
			s.note(`[${name}] did not open — skipped`);
			continue;
		}
		await page.waitForTimeout(1200);
		// Candidate-fix probe: inject a suppression rule (from env) so the fix can
		// be validated against the real rendered apps without an 11-min rebuild.
		const candidate = process.env.FOCUS_FIX_CSS;
		if (candidate) {
			await page.addStyleTag({ content: candidate }).catch(() => undefined);
		}
		// Establish a keyboard context at the top-left of the window so Tab walks
		// the app's own focus order (click the header/body, not a specific control).
		try {
			await page.mouse.click(8, 8);
		} catch {
			/* some windows guard the drag region — ignore */
		}

		const seen = new Set<string>();
		for (let i = 0; i < 60; i++) {
			await page.keyboard.press("Tab");
			const stop = await page
				.evaluate(() => {
					const el = document.activeElement as HTMLElement | null;
					if (!el || el === document.body) return null;
					const cs = getComputedStyle(el);
					const outlined = cs.outlineStyle !== "none" && Number.parseFloat(cs.outlineWidth) > 0;
					const ringShadow = /rgb|var|inset 0 0 0|0 0 0 2px/.test(cs.boxShadow) && cs.boxShadow !== "none";
					const indicator = outlined
						? `outline ${cs.outlineWidth} ${cs.outlineColor}`
						: ringShadow
							? `box-shadow ${cs.boxShadow.slice(0, 40)}`
							: "";
					if (!indicator) return null;
					const r = el.getBoundingClientRect();
					const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 2).join(".");
					return {
						sig: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""}`,
						tag: el.tagName,
						role: el.getAttribute("role") ?? "",
						editable: el.isContentEditable,
						w: Math.round(r.width),
						h: Math.round(r.height),
						indicator,
					};
				})
				.catch(() => null);
			if (!stop || seen.has(stop.sig)) continue;
			seen.add(stop.sig);

			const interactive =
				INTERACTIVE_TAGS.has(stop.tag) ||
				stop.editable ||
				INTERACTIVE_ROLES.has(stop.role);
			const isSeparator = stop.role === "separator" || stop.role === "presentation" || stop.role === "none";
			const oversized = stop.w * stop.h > 120_000; // ~a whole panel/region
			if (interactive && !isSeparator && !oversized) continue;

			const reason = isSeparator
				? "focusable separator/decorative"
				: !interactive
					? "non-interactive element receives a ring"
					: "oversized region (full-bleed frame)";
			flagged.push({ app: name, sig: stop.sig, tag: stop.tag, role: stop.role, w: stop.w, h: stop.h, indicator: stop.indicator, reason });
		}
		s.note(`[${name}] tabbed 60 stops — ${[...seen].length} distinct focusable, ${flagged.filter((f) => f.app === name).length} flagged`);
	}

	// Report, grouped by app.
	const lines: string[] = ["", "## Flagged focus frames (unexpected rings)", ""];
	if (flagged.length === 0) lines.push("_none — every keyboard focus stop was a genuine interactive control_");
	for (const f of flagged) {
		lines.push(`- **${f.app}** \`${f.sig}\` ${f.w}×${f.h}px — ${f.reason} (${f.indicator})`);
	}
	s.note(lines.join("\n"));

	await s.finish();
	expect(true).toBe(true);
});
