/**
 * Session 918b — measurement pass for the 918 polish sweep.
 *
 * Screenshots say "that looks off"; this dumps the numbers that prove it:
 * control heights along the Marketplace toolbar row, the vault-picker row
 * insets, the disabled-vs-enabled Install faces, and the Code editor right
 * panel's stacked header insets.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const MEASURE = `(() => {
	const out = [];
	const box = (sel, label) => {
		const el = document.querySelector(sel);
		if (!el) { out.push(label + ": (absent)"); return; }
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		out.push(
			label + ": h=" + Math.round(r.height) + " w=" + Math.round(r.width) +
			" left=" + Math.round(r.left) +
			" bg=" + cs.backgroundColor + " border=" + cs.borderTopWidth + " " + cs.borderTopColor +
			" opacity=" + cs.opacity + " filter=" + cs.filter
		);
	};
	box(".marketplace__toolbar", "toolbar");
	box(".marketplace__chips", "chips");
	box(".marketplace__chip", "chip[0]");
	box(".marketplace__search", "searchbar");
	box(".marketplace__toolbar > button", "install-from button");
	return out.join("\\n");
})()`;

test("918b — measured polish numbers", async () => {
	test.setTimeout(420_000);
	const s = await startSession("918b-appforge-measure");
	const dash = s.dashboard;
	await dash.waitForTimeout(1500);
	await dash.keyboard.press("Escape");

	await dash.locator('[aria-label="Open Marketplace"]').first().click();
	await dash.waitForTimeout(1500);
	s.note(`\n### Marketplace toolbar (light)\n\`\`\`\n${await dash.evaluate(MEASURE)}\n\`\`\`\n`);

	await dash.locator(".marketplace__toolbar button", { hasText: "Install from" }).first().click();
	await dash.waitForTimeout(800);
	await dash.locator(".fm-row", { hasText: "From vault code files" }).first().click();
	await dash.waitForTimeout(2000);
	const rows = await dash.evaluate(() => {
		const out: string[] = [];
		for (const li of Array.from(document.querySelectorAll(".marketplace__vault-sources li"))) {
			const name = li.querySelector(".marketplace__update-name");
			const meta = li.querySelector(".marketplace__update-version");
			const problem = li.querySelector(".marketplace__vault-problem");
			const btn = li.querySelector("button");
			const r = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().left) : -1);
			const cs = btn ? getComputedStyle(btn) : null;
			out.push(
				`row "${name?.textContent}": nameLeft=${r(name)} metaLeft=${r(meta)} problemLeft=${r(problem)} ` +
					`btn h=${btn ? Math.round(btn.getBoundingClientRect().height) : -1} ` +
					`disabled=${(btn as HTMLButtonElement | null)?.disabled} ` +
					`opacity=${cs?.opacity} filter=${cs?.filter} title=${(btn as HTMLElement | null)?.title ?? "(none)"}`,
			);
		}
		const dialog = document.querySelector('[data-testid="install-from-vault-dialog"]');
		if (dialog) {
			const summary = dialog.querySelector(".marketplace__vault-summary");
			const list = dialog.querySelector(".marketplace__vault-sources");
			out.push(
				`summaryLeft=${summary ? Math.round(summary.getBoundingClientRect().left) : -1} ` +
					`listLeft=${list ? Math.round(list.getBoundingClientRect().left) : -1}`,
			);
		}
		return out.join("\n");
	});
	s.note(`\n### Vault picker rows (light)\n\`\`\`\n${rows}\n\`\`\`\n`);
	await s.shot(dash, "vault-picker-light");

	// Consent sheet button faces.
	const installRow = dash
		.locator(".marketplace__vault-sources li", { hasText: "Milestones" })
		.first();
	if ((await installRow.count()) > 0) {
		await installRow.locator("button").first().click();
		await installRow.page().waitForTimeout(1200);
		const sheet = await dash.evaluate(() => {
			const out: string[] = [];
			for (const btn of Array.from(document.querySelectorAll(".popover__footer button, .confirm__footer button, .popover button"))) {
				const cs = getComputedStyle(btn);
				const r = btn.getBoundingClientRect();
				out.push(
					`"${btn.textContent?.trim()}" class=${btn.className} h=${Math.round(r.height)} ` +
						`bgImage=${cs.backgroundImage.slice(0, 70)} color=${cs.color}`,
				);
			}
			return out.join("\n");
		});
		s.note(`\n### Consent sheet buttons (light)\n\`\`\`\n${sheet}\n\`\`\`\n`);
		await s.shot(dash, "consent-light");
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);
	}
	await dash.keyboard.press("Escape");
	await dash.waitForTimeout(400);
	await dash.keyboard.press("Escape");
	await dash.waitForTimeout(600);

	// Code editor right panel: the stacked diagnostics + REFERENCES headers.
	const code = await s.openApp(APP.CodeEditor);
	await code.waitForTimeout(2500);
	const panel = await code.evaluate(() => {
		const out: string[] = [];
		const sel = [
			".editor__diagnostics",
			".editor__diagnostics-empty",
			".editor__diagnostics-head",
			".editor__references",
			".editor__references-head",
			".editor__refs-heading",
			".editor__aside",
			".editor__side",
		];
		for (const s of sel) {
			for (const el of Array.from(document.querySelectorAll(s))) {
				const r = el.getBoundingClientRect();
				out.push(
					`${s}: left=${Math.round(r.left)} top=${Math.round(r.top)} h=${Math.round(r.height)} text="${(el.textContent ?? "").trim().slice(0, 30)}"`,
				);
			}
		}
		// Anything that looks like a panel header in the right rail.
		const rail = document.querySelector(".editor__aside, .editor__side, aside");
		if (rail) {
			out.push(`rail class=${(rail as HTMLElement).className} left=${Math.round(rail.getBoundingClientRect().left)}`);
			for (const child of Array.from(rail.children)) {
				const r = child.getBoundingClientRect();
				out.push(
					`  child .${(child as HTMLElement).className} left=${Math.round(r.left)} h=${Math.round(r.height)}`,
				);
			}
		}
		return out.join("\n");
	});
	s.note(`\n### Code editor right rail\n\`\`\`\n${panel}\n\`\`\`\n`);
	await s.shot(code, "code-right-rail");

	await s.finish();
});
