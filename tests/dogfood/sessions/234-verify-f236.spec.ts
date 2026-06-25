/**
 * Session 234 — robust re-verify of F-236 (journal entry body persists across
 * a date round-trip). The 231/232 specs typed the marker with synthetic
 * keystrokes (`editor.type`), which never land in the Yjs-bound Lexical body
 * under headless Electron — so their precheck ("marker present right after
 * typing") was false and the persistence assertion tested nothing.
 *
 * This drives the body through the Journal dev hook
 * (`window.__brainstormJournalDev.appendParagraph`) — the same proper-path
 * write Notes uses — then navigates to another day and back and asserts the
 * marker survived. No synthetic typing.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("re-verify F-236 journal body survives date round-trip (234)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("234-verify-f236");
	try {
		const jo = await s.openApp(APP.Journal);
		await jo.waitForTimeout(2600);
		const marker = `f236survive${Date.now() % 100000}`;

		const wrote = await jo
			.evaluate(async (m) => {
				const dev = window.__brainstormJournalDev;
				if (!dev) return { ok: false, why: "no dev hook" };
				try {
					await dev.appendParagraph(m);
					return { ok: true, entry: dev.currentEntryId() };
				} catch (e) {
					return { ok: false, why: (e as Error).message };
				}
			}, marker)
			.catch((e) => ({ ok: false, why: String(e) }));
		s.note(
			`[${wrote.ok ? "ok" : "?"}] F-236 precheck — appended marker via dev hook: ${JSON.stringify(wrote)}`,
		);

		const presentAfterWrite = await jo
			.locator(".journal__entry-body [contenteditable], [contenteditable='true']")
			.first()
			.evaluate((el, m) => (el.textContent ?? "").includes(m), marker)
			.catch(() => false);
		s.note(
			`[${presentAfterWrite ? "ok" : "?"}] F-236 marker visible in body after write = ${presentAfterWrite}`,
		);
		await jo.waitForTimeout(1600); // gated autosave flush

		// Navigate to a different day, then back to today.
		const otherDay = await jo
			.evaluate(() => {
				const today = document.querySelector(
					".cal-mini__day--today, .cal-mini__day[aria-current], [class*='--today']",
				);
				const days = Array.from(
					document.querySelectorAll(".cal-mini__day, [class*='cal-mini__day'], [class*='mini'] button"),
				).filter((d) => /^\d+$/.test((d.textContent ?? "").trim()));
				const other = days.find((d) => d !== today && d.getBoundingClientRect().width > 0);
				if (other) (other as HTMLElement).setAttribute("data-fleet-other", "1");
				return other ? (other.textContent ?? "").trim() : null;
			})
			.catch(() => null);
		await jo
			.locator("[data-fleet-other='1']")
			.first()
			.click()
			.catch(() => undefined);
		await jo.waitForTimeout(1300);
		await jo
			.getByRole("button", { name: /today/i })
			.first()
			.click()
			.catch(() => undefined);
		await jo.waitForTimeout(1800);

		const survived = await jo
			.locator(".journal__entry-body [contenteditable], [contenteditable='true']")
			.first()
			.evaluate((el, m) => (el.textContent ?? "").includes(m), marker)
			.catch(() => false);
		s.note(
			`[${survived ? "PASS" : "FAIL"}] F-236 marker survived round-trip (to day ${otherDay} and back) = ${survived}`,
		);
		await s.shot(jo, "01-journal-after-roundtrip");
	} finally {
		await s.finish();
	}
});
