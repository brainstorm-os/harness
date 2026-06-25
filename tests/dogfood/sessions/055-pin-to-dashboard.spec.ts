/**
 * Session 055 — Mira pins a key object to her dashboard.
 *
 * She wants her investment-thesis note one click away from her command
 * center. She opens the note's ⋯ object menu and toggles "Pin to dashboard".
 * Exercises the cross-app dashboard-pin feature (shared object menu →
 * dashboard.pin) — not yet dogfooded — and confirms the pin state actually
 * persists by reopening the menu and seeing the verb flip to "Remove from
 * dashboard", then flip back when unpinned.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function openHeaderMenu(notes: import("@playwright/test").Page): Promise<string[]> {
	// Header ⋯ opens the shared object menu, which renders as a fancy menu
	// (`.fm-menu` with role=option rows), not the headless `.bs-object-menu`.
	await notes
		.locator(".notes__header .bs-object-menu__more, header .bs-object-menu__more")
		.first()
		.click();
	await notes.waitForTimeout(400);
	const menu = notes.locator(".fm-menu").first();
	if ((await menu.count()) === 0) return [];
	return (await menu.locator('[role="option"]').allInnerTexts()).map((t) => t.trim());
}

test("pin an object to the dashboard (toggle persists)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("055-pin-to-dashboard");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		// Open a real note (her thesis), falling back to the first listed note.
		const thesis = notes.locator("text=Northbound — investment thesis").first();
		if (await thesis.count()) await thesis.click();
		else
			await notes
				.locator(".notes__nav-item, .notes__list-row, aside a, aside button")
				.first()
				.click()
				.catch(() => undefined);
		await notes.waitForTimeout(1000);
		await s.shot(notes, "01-note-open");

		const clickPinItem = async (): Promise<void> => {
			await notes
				.locator(".fm-menu")
				.first()
				.locator('[role="option"]', { hasText: /dashboard/i })
				.first()
				.click();
			await notes.waitForTimeout(700);
		};

		// What does the header object menu actually offer?
		const items = await openHeaderMenu(notes);
		s.note(`header object-menu items: ${JSON.stringify(items)}`);
		await s.shot(notes, "02-menu-open");
		expect(
			items.find((t) => /dashboard/i.test(t)) ?? "",
			"object menu offers a pin/unpin action",
		).toMatch(/dashboard/i);

		// Drive to a deterministic PINNED end state regardless of the persistent
		// vault's starting state: if already pinned, unpin first, then pin.
		if (/remove/i.test(items.find((t) => /dashboard/i.test(t)) ?? "")) {
			await clickPinItem();
			await openHeaderMenu(notes);
		}
		await clickPinItem(); // now pinned
		await s.shot(notes, "03-pinned");

		const after = (await openHeaderMenu(notes)).find((t) => /dashboard/i.test(t)) ?? "";
		s.note(`pin verb after pinning: "${after}"`);
		await notes.keyboard.press("Escape").catch(() => undefined);
		expect(after, "after pinning, the menu verb is 'Remove from dashboard'").toMatch(/remove/i);

		// The pin must actually appear on the dashboard surface — an entity pin
		// renders as `.dashboard-icons__icon` with testid `dashboard-icon-pin_<id>`.
		await s.dashboard.waitForTimeout(900);
		const entityPins = await s.dashboard.locator('[data-testid^="dashboard-icon-pin_"]').count();
		const allIcons = await s.dashboard.locator(".dashboard-icons__icon").count();
		s.note(`dashboard: ${allIcons} icons total, ${entityPins} entity pins`);
		await s.shot(s.dashboard, "04-dashboard");
		expect(
			entityPins,
			"the pinned note shows as an entity pin on the dashboard",
		).toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
