/**
 * Session 214 — Marcus's measured design audit of ALL apps. Not vibes:
 * every app is opened and measured against the documented contracts —
 * header 44px + shared `.app-header__title` face (14px/600), the ⋯ last
 * in the right group, buttons never bold (`--text-weight-medium`),
 * control heights on the 24/32/40 scale, no visible text under 12px.
 * Each app also gets a header crop; the numbers + crops ARE the review.
 */

import { test } from "@playwright/test";
import { APP, type AppId, SPEAKER, startSession } from "../lib/founder";

type AuditResult = {
	headerHeight: number | null;
	titlePresent: boolean;
	titleFont: string | null;
	titleFallback: string | null;
	rightButtons: (string | null)[];
	boldButtons: string[];
	offScaleButtons: string[];
	smallFonts: string[];
};

const AUDITED: [string, AppId][] = [
	["notes", APP.Notes],
	["database", APP.Database],
	["tasks", APP.Tasks],
	["calendar", APP.Calendar],
	["journal", APP.Journal],
	["graph", APP.Graph],
	["whiteboard", APP.Whiteboard],
	["files", APP.Files],
	["bookmarks", APP.Bookmarks],
	["code-editor", APP.CodeEditor],
	["theme-editor", APP.ThemeEditor],
	["agent", APP.Agent],
	["contacts", APP.Contacts],
	["automations", APP.Automations],
	["browser", APP.Browser],
	["mailbox", APP.Mailbox],
	["form-designer", APP.FormDesigner],
	["books", APP.Books],
];

function auditPage(): AuditResult {
	const out: AuditResult = {
		headerHeight: null,
		titlePresent: false,
		titleFont: null,
		titleFallback: null,
		rightButtons: [],
		boldButtons: [],
		offScaleButtons: [],
		smallFonts: [],
	};
	const header = document.querySelector(".app-header");
	if (header) {
		out.headerHeight = Math.round(header.getBoundingClientRect().height * 10) / 10;
		const title = header.querySelector(".app-header__title");
		out.titlePresent = !!title;
		if (title) {
			const cs = getComputedStyle(title);
			out.titleFont = `${cs.fontSize}/${cs.fontWeight}`;
		} else {
			const fallback = header.querySelector("h1, h2, [class*='title']");
			out.titleFallback = fallback
				? `${fallback.tagName}.${fallback.className.toString().slice(0, 50)}`
				: null;
		}
		const right = header.querySelector(".app-header__right");
		if (right) {
			out.rightButtons = [...right.children]
				.filter((el) => (el as HTMLElement).offsetParent !== null)
				.map(
					(el) =>
						el.getAttribute("aria-label") ??
						el.textContent?.trim()?.slice(0, 18) ??
						el.className.toString().slice(0, 18),
				);
		}
	}
	// Buttons: weight + control-height scale (24/32/40 ± borders; icon
	// buttons inside list rows legitimately vary, so report the worst few).
	const SCALE = new Set([24, 32, 40, 44]);
	for (const b of document.querySelectorAll("button")) {
		const el = b as HTMLElement;
		if (el.offsetParent === null) continue;
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) continue;
		const cs = getComputedStyle(el);
		const weight = Number.parseInt(cs.fontWeight, 10);
		const label = (el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "?").slice(0, 26);
		if (weight >= 600 && out.boldButtons.length < 10) {
			out.boldButtons.push(`"${label}" w=${weight}`);
		}
		const h = Math.round(rect.height);
		if (
			!SCALE.has(h) &&
			h >= 18 &&
			(el.textContent?.trim()?.length ?? 0) > 0 &&
			out.offScaleButtons.length < 10
		) {
			out.offScaleButtons.push(`"${label}" h=${h}`);
		}
	}
	// Visible leaf text under 12px.
	const seen = new Set<string>();
	const all = document.body.querySelectorAll("*");
	let i = 0;
	for (const node of all) {
		if (++i > 5000) break;
		const el = node as HTMLElement;
		if (el.children.length > 0 || el.offsetParent === null) continue;
		const text = el.textContent?.trim();
		if (!text) continue;
		const fs = Number.parseFloat(getComputedStyle(el).fontSize);
		if (fs > 0 && fs < 12) {
			seen.add(`${fs}px .${el.className.toString().slice(0, 36)} "${text.slice(0, 16)}"`);
			if (seen.size >= 8) break;
		}
	}
	out.smallFonts = [...seen];
	return out;
}

test("Marcus measures every app against the design contracts (214)", async () => {
	test.setTimeout(580_000);
	const s = await startSession("214-marcus-design-audit");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Full-fleet audit, with a ruler this time: header geometry, the one title face, button weights, the control-height scale, sub-12px text. Eighteen apps. Numbers first, taste second.",
		);
		for (const [name, id] of AUDITED) {
			try {
				const page = await s.openApp(id);
				await page.waitForTimeout(2800);
				const result = await page.evaluate(auditPage).catch(() => null);
				if (result) {
					s.note(`=== ${name} ===`);
					s.note(
						`header=${result.headerHeight}px title=${
							result.titlePresent ? result.titleFont : `MISSING (${result.titleFallback ?? "none"})`
						} right=[${result.rightButtons.join(" | ")}]`,
					);
					if (result.boldButtons.length) s.note(`BOLD buttons: ${result.boldButtons.join(", ")}`);
					if (result.offScaleButtons.length)
						s.note(`off-scale buttons: ${result.offScaleButtons.join(", ")}`);
					if (result.smallFonts.length) s.note(`sub-12px text: ${result.smallFonts.join(" · ")}`);
				} else {
					s.note(`=== ${name} === audit evaluate failed`);
				}
				const header = page.locator(".app-header").first();
				if (await header.isVisible().catch(() => false)) {
					await s.shot(page, `${name}-header`, header);
				} else {
					await s.shot(page, `${name}-full`);
				}
			} catch (error) {
				s.note(`=== ${name} === FAILED to open/audit: ${(error as Error).message.slice(0, 120)}`);
			}
		}
		s.chat(
			SPEAKER.Marcus,
			"Audit captured. Anything bold on a button, off the height scale, or under 12px is in the notes with its class name attached — no arguing with a computed style.",
		);
	} finally {
		await s.finish();
	}
});
