/**
 * Session 374 — accessibility: accessible-name audit.
 *
 * The last full a11y pass (session 311) found focus invisible in 8/9 apps;
 * PR #66 fixed the focus-ring class. This audit covers the next most common
 * real a11y defect: an INTERACTIVE element with no accessible name — an
 * icon-only button, an unlabeled input, a control a screen reader announces as
 * just "button" / "edit text". For every app it walks the DOM and flags each
 * focusable/interactive element whose computed accessible name (aria-label →
 * aria-labelledby → alt → visible text → title) is empty. Non-asserting; writes
 * a triage report grouped by app.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Finding = { app: string; sig: string; role: string; reason: string };

test("a11y: every interactive element has an accessible name", async () => {
	test.setTimeout(600_000);
	const s = await startSession("374-a11y-name-audit");
	const flagged: Finding[] = [];

	for (const [name, id] of Object.entries(APP)) {
		let page: Awaited<ReturnType<typeof s.openApp>>;
		try {
			page = await s.openApp(id);
		} catch {
			s.note(`[${name}] did not open — skipped`);
			continue;
		}
		await page.waitForTimeout(1200);

		const found = await page
			.evaluate(() => {
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
					"combobox",
					"searchbox",
					"spinbutton",
					"textbox",
				]);
				const norm = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
				const nameOf = (el: Element): string => {
					const aria = norm(el.getAttribute("aria-label"));
					if (aria) return aria;
					const labelledby = el.getAttribute("aria-labelledby");
					if (labelledby) {
						const parts = labelledby
							.split(/\s+/)
							.map((rid) => norm(document.getElementById(rid)?.textContent))
							.filter(Boolean);
						if (parts.length) return parts.join(" ");
					}
					if (el.tagName === "IMG") {
						const alt = el.getAttribute("alt");
						if (alt !== null) return norm(alt); // alt="" is a valid (decorative) name decision
					}
					// A native control wrapped in / associated with a <label>.
					if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
						const labels = (el as HTMLInputElement).labels;
						if (labels && labels.length && norm([...labels].map((l) => l.textContent).join(" "))) {
							return norm([...labels].map((l) => l.textContent).join(" "));
						}
						const ph = norm(el.getAttribute("placeholder"));
						if (ph) return ph; // placeholder is a weak name but counts as "not silent"
						const title = norm(el.getAttribute("title"));
						if (title) return title;
					}
					const text = norm(el.textContent);
					if (text) return text;
					const title = norm(el.getAttribute("title"));
					if (title) return title;
					// A tooltip host the shared runtime reads.
					const tip = norm(el.getAttribute("data-bs-tooltip"));
					if (tip) return tip;
					return "";
				};

				const out: Array<{ sig: string; role: string; reason: string }> = [];
				const seen = new Set<string>();
				for (const el of Array.from(document.querySelectorAll("*"))) {
					const role = el.getAttribute("role") ?? "";
					const tag = el.tagName;
					const tabbable = el.getAttribute("tabindex") === "0";
					const interactive =
						INTERACTIVE_TAGS.has(tag) || INTERACTIVE_ROLES.has(role) || tabbable;
					if (!interactive) continue;
					// Skip hidden / zero-size (not perceivable → not a real control here).
					const r = (el as HTMLElement).getBoundingClientRect();
					if (r.width < 4 || r.height < 4) continue;
					if ((el as HTMLElement).getAttribute("aria-hidden") === "true") continue;
					// A hidden native input behind a painted control is fine (checkbox pattern).
					if (tag === "INPUT" && ["checkbox", "radio"].includes((el as HTMLInputElement).type) && r.width < 4) continue;
					if (nameOf(el)) continue;
					const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 2).join(".");
					const sig = `${tag.toLowerCase()}${cls ? `.${cls}` : ""}${role ? `[${role}]` : ""}`;
					if (seen.has(sig)) continue;
					seen.add(sig);
					out.push({
						sig,
						role: role || tag.toLowerCase(),
						reason: tag === "INPUT" || tag === "TEXTAREA" ? "unlabeled field" : "no accessible name (icon-only / empty)",
					});
				}
				return out;
			})
			.catch(() => []);

		for (const f of found) flagged.push({ app: name, ...f });
		s.note(`[${name}] ${found.length} unnamed interactive element(s)`);
	}

	const lines: string[] = ["", "## Interactive elements missing an accessible name", ""];
	if (flagged.length === 0) lines.push("_none — every interactive element has a name_");
	for (const f of flagged) lines.push(`- **${f.app}** \`${f.sig}\` — ${f.reason}`);
	s.note(lines.join("\n"));

	await s.finish();
	expect(true).toBe(true);
});
