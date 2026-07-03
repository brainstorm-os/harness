/**
 * Session 375 — the widgets day. Mira finally sets up her dashboard with
 * widgets: she opens the "+ Add widget" catalog, places every widget the
 * product ships (7 across Notes / Tasks / Calendar / Contacts / Bookmarks),
 * arranges them into a tidy grid, and lives with them for a while — dragging,
 * resizing, collapsing, checking dark mode, removing one she doesn't need,
 * and finally rebooting the shell to see whether her dashboard survives.
 *
 * The spec drives the REAL user path (header + button → fancy-menu rows →
 * card chrome), not the upsertWidget API, except for the tidy-grid arrange
 * step where exact geometry is the point.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Bs = {
	brainstorm: {
		dashboard: {
			upsertWidget(id: string, r: Record<string, unknown>): Promise<void>;
			removeWidget(id: string): Promise<void>;
			registeredWidgets(): Promise<unknown[]>;
			setAppearanceMode?: (mode: string) => Promise<void>;
		};
		apps: { launch(id: string): Promise<void> };
	};
};

const CATALOG = [
	{ appId: APP.Notes, kind: "recent-notes", menu: "Recent Notes" },
	{ appId: APP.Tasks, kind: "open-tasks", menu: "Open Tasks" },
	{ appId: APP.Tasks, kind: "task-stats", menu: "Task Stats" },
	{ appId: APP.Calendar, kind: "today-agenda", menu: "Today's Agenda" },
	{ appId: APP.Calendar, kind: "week-ahead", menu: "Week Ahead" },
	{ appId: APP.Contacts, kind: "list-contacts", menu: "Contacts" },
	{ appId: APP.Bookmarks, kind: "recent-bookmarks", menu: "Recent Bookmarks" },
] as const;

const CARD = '[data-testid^="dashboard-widget-"]';
// Fancy-menu rows are listbox options (`role="option"`), not menuitems.
const MENU_ROW = '[role="option"], [role="menuitem"]';

test("widgets dogfood (375)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("375-widgets-dogfood");
	const page = s.dashboard;

	const cardIds = () =>
		page.$$eval(CARD, (els) =>
			els.map((el) => (el.getAttribute("data-testid") ?? "").replace("dashboard-widget-", "")),
		);

	try {
		await page.waitForTimeout(2500);

		// --- 0. Clean slate: note + remove leftovers from earlier sessions.
		const leftovers = await cardIds();
		s.note(`pre-existing widgets: ${leftovers.length} (${leftovers.join(", ") || "none"})`);
		await page.evaluate(async (ids) => {
			const bs = (window as unknown as Bs).brainstorm;
			for (const id of ids) await bs.dashboard.removeWidget(id);
		}, leftovers);
		await page.waitForTimeout(600);
		await s.shot(page, "dashboard-before");

		// --- 1. The catalog: open the header "+ Add widget" menu.
		const addBtn = page.getByRole("button", { name: "Add widget" });
		const addBtnVisible = await addBtn.isVisible().catch(() => false);
		s.note(`header "Add widget" button visible: ${addBtnVisible}`);
		expect(addBtnVisible, "the + Add widget header button exists").toBe(true);
		await addBtn.click();
		await page.waitForTimeout(600);
		const menuItems = await page.locator(MENU_ROW).allTextContents();
		s.note(`add-widget catalog rows: ${JSON.stringify(menuItems)}`);
		await s.shot(page, "add-widget-catalog");
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);

		// --- 2. Add every widget through the menu, one reopen per pick.
		const placed: Array<{ id: string; appId: string; kind: string; menu: string }> = [];
		for (const w of CATALOG) {
			const before = await cardIds();
			await addBtn.click();
			await page.waitForTimeout(400);
			// Substring match: an icon-fallback initials glyph can prefix the row's
			// text content (seen live: "NORecent Notes" for the Notes row — F-log).
			const row = page.locator(MENU_ROW).filter({ hasText: w.menu }).first();
			const rowVisible = await row.isVisible().catch(() => false);
			if (!rowVisible) {
				s.note(`✗ catalog row "${w.menu}" not found — skipping`);
				await page.keyboard.press("Escape");
				continue;
			}
			await row.click();
			await page.waitForTimeout(700);
			const after = await cardIds();
			const fresh = after.find((id) => !before.includes(id));
			s.note(`added "${w.menu}" → card ${fresh ?? "MISSING"} (cards ${before.length}→${after.length})`);
			if (fresh) placed.push({ id: fresh, appId: w.appId, kind: w.kind, menu: w.menu });
		}
		expect(placed.length, "all 7 catalog widgets placed").toBe(7);
		await s.shot(page, "all-widgets-stacked-as-added");

		// --- 3. Arrange into a tidy 3-column grid (exact geometry via API).
		const layout: Record<string, { x: number; y: number; w: number; h: number }> = {
			"recent-notes": { x: 4, y: 6, w: 40, h: 20 },
			"open-tasks": { x: 4, y: 28, w: 40, h: 20 },
			"task-stats": { x: 4, y: 50, w: 20, h: 20 },
			"today-agenda": { x: 46, y: 6, w: 40, h: 20 },
			"week-ahead": { x: 46, y: 28, w: 40, h: 40 },
			"list-contacts": { x: 88, y: 6, w: 40, h: 20 },
			"recent-bookmarks": { x: 88, y: 28, w: 40, h: 20 },
		};
		await page.evaluate(
			async (args) => {
				const bs = (window as unknown as Bs).brainstorm;
				for (const p of args.placed) {
					const geo = args.layout[p.kind];
					if (!geo) continue;
					await bs.dashboard.upsertWidget(p.id, {
						appId: p.appId,
						kind: p.kind,
						...geo,
						paused: false,
						collapsed: false,
					});
				}
			},
			{ placed, layout },
		);
		await page.waitForTimeout(1500);
		await s.shot(page, "arranged-grid-light");

		// --- 4. Content audit: every iframe mounted, themed, showing rows or a
		//        clean empty state. Close-up shot per widget.
		for (const p of placed) {
			const card = page.locator(`[data-testid="dashboard-widget-${p.id}"]`);
			const frameCount = await card.locator(".dashboard-widgets__frame").count();
			const title = await card.locator(".dashboard-widgets__title").textContent().catch(() => "?");
			const wf = page
				.frames()
				.find((f) => f.url().startsWith("bswidget://") && f.url().includes(p.kind));
			const inner = wf
				? await wf
						.evaluate(() => {
							const cs = getComputedStyle(document.documentElement);
							return {
								rows: document.querySelectorAll('[class*="__row"], [class*="__day"]').length,
								empty: document.querySelectorAll('[class*="__empty"]').length,
								count: document.querySelector('[class*="__count"]')?.textContent ?? null,
								themed: cs.getPropertyValue("--color-text-primary").trim().length > 0,
								bodyText: document.body.textContent?.slice(0, 120) ?? "",
							};
						})
						.catch(() => null)
				: null;
			s.note(
				`widget ${p.kind} · title="${title}" · iframe=${frameCount} · ${JSON.stringify(inner)}`,
			);
			await s.shot(page, `widget-${p.kind}`, card);
		}

		// --- 5. Interactions on real chrome.
		const statsId = placed.find((p) => p.kind === "task-stats")?.id;
		const notesId = placed.find((p) => p.kind === "recent-notes")?.id;
		const weekId = placed.find((p) => p.kind === "week-ahead")?.id;

		// 5a. Drag Recent Notes by its grip; snap + land.
		if (notesId) {
			const card = page.locator(`[data-testid="dashboard-widget-${notesId}"]`);
			const grip = card.locator(".dashboard-widgets__grip");
			const gb = await grip.boundingBox();
			const before = await card.boundingBox();
			if (gb && before) {
				await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
				await page.mouse.down();
				await page.mouse.move(gb.x + 100, gb.y + 40, { steps: 10 });
				await page.mouse.up();
				await page.waitForTimeout(700);
				const after = await card.boundingBox();
				s.note(
					`drag notes: (${before.x},${before.y}) → (${after?.x},${after?.y}) — moved ${after ? (after.x - before.x).toFixed(0) : "?"}px, snap-to-8 remainder x=${after ? (after.x - before.x) % 8 : "?"}`,
				);
				// drag it back
				const gb2 = await grip.boundingBox();
				if (gb2) {
					await page.mouse.move(gb2.x + gb2.width / 2, gb2.y + gb2.height / 2);
					await page.mouse.down();
					await page.mouse.move(gb2.x - 100 + gb2.width / 2, gb2.y - 40 + gb2.height / 2, { steps: 10 });
					await page.mouse.up();
					await page.waitForTimeout(500);
				}
			}
		}

		// 5b. Resize Task Stats: shrink far below the minimum (expect clamp),
		//     then grow it back.
		if (statsId) {
			const card = page.locator(`[data-testid="dashboard-widget-${statsId}"]`);
			const before = await card.boundingBox();
			const grip = card.locator(".dashboard-widgets__resize");
			const gb = await grip.boundingBox();
			if (gb && before) {
				await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
				await page.mouse.down();
				await page.mouse.move(gb.x - 300, gb.y - 300, { steps: 12 });
				await page.mouse.up();
				await page.waitForTimeout(600);
				const clamped = await card.boundingBox();
				s.note(
					`resize clamp: ${before.width}×${before.height} → ${clamped?.width}×${clamped?.height} (min should be 64×48 + chrome)`,
				);
				await s.shot(page, "task-stats-clamped-min", card);
				const gb2 = await grip.boundingBox();
				if (gb2) {
					await page.mouse.move(gb2.x + gb2.width / 2, gb2.y + gb2.height / 2);
					await page.mouse.down();
					await page.mouse.move(gb2.x + 160, gb2.y + 160, { steps: 12 });
					await page.mouse.up();
					await page.waitForTimeout(600);
				}
				const grown = await card.boundingBox();
				s.note(`resize grow: → ${grown?.width}×${grown?.height}`);
				await s.shot(page, "task-stats-regrown", card);
			}
		}

		// 5c. Collapse Task Stats (leave it collapsed — reboot must restore it).
		if (statsId) {
			const card = page.locator(`[data-testid="dashboard-widget-${statsId}"]`);
			const before = await card.boundingBox();
			await card.getByRole("button", { name: "Collapse widget" }).click();
			await page.waitForTimeout(500);
			const after = await card.boundingBox();
			s.note(`collapse task-stats: h ${before?.height} → ${after?.height}`);
			await s.shot(page, "task-stats-collapsed", card);
		}

		// 5d. The ⋯ widget menu — what does it offer?
		if (notesId) {
			const card = page.locator(`[data-testid="dashboard-widget-${notesId}"]`);
			await card.getByRole("button", { name: "Widget options" }).click();
			await page.waitForTimeout(400);
			const opts = await page.locator(MENU_ROW).allTextContents();
			s.note(`widget ⋯ menu items: ${JSON.stringify(opts)}`);
			await s.shot(page, "widget-options-menu");
			await page.keyboard.press("Escape");
			await page.waitForTimeout(300);
		}

		// 5e. Duplicate placement: a second Recent Notes — two independent frames?
		{
			const before = await cardIds();
			await addBtn.click();
			await page.waitForTimeout(400);
			await page.locator(MENU_ROW).filter({ hasText: "Recent Notes" }).first().click();
			await page.waitForTimeout(800);
			const after = await cardIds();
			const dupe = after.find((id) => !before.includes(id));
			const notesFrames = page.frames().filter((f) => f.url().includes("recent-notes")).length;
			s.note(`duplicate recent-notes: card=${dupe ?? "MISSING"} · notes frames now=${notesFrames}`);
			await s.shot(page, "duplicate-recent-notes");
			if (dupe) {
				const card = page.locator(`[data-testid="dashboard-widget-${dupe}"]`);
				await card.getByRole("button", { name: "Widget options" }).click();
				await page.waitForTimeout(400);
				await page.locator(MENU_ROW).filter({ hasText: /^Remove widget$/ }).click();
				await page.waitForTimeout(500);
				s.note(`removed duplicate via ⋯ → Remove; cards now ${(await cardIds()).length}`);
			}
		}

		// 5f. ↗ opens the owning app.
		if (notesId) {
			const card = page.locator(`[data-testid="dashboard-widget-${notesId}"]`);
			await card.getByRole("button", { name: /Open .*/ }).click();
			const appPage = await (async () => {
				const deadline = Date.now() + 15_000;
				while (Date.now() < deadline) {
					const hit = s.appPagesFor(APP.Notes)[0];
					if (hit) return hit;
					await page.waitForTimeout(500);
				}
				return null;
			})();
			s.note(`widget ↗ open-app: notes window opened=${appPage != null}`);
		}

		// 5g. Remove Week Ahead through its ⋯ menu (Mira keeps 6).
		if (weekId) {
			const card = page.locator(`[data-testid="dashboard-widget-${weekId}"]`);
			await card.getByRole("button", { name: "Widget options" }).click();
			await page.waitForTimeout(400);
			await page.locator(MENU_ROW).filter({ hasText: /^Remove widget$/ }).click();
			await page.waitForTimeout(500);
			const ids = await cardIds();
			s.note(`removed week-ahead: cards now ${ids.length} (expect 6)`);
		}

		// --- 6. Dark mode: do widgets re-theme live?
		const lightToken = await page
			.frames()
			.find((f) => f.url().startsWith("bswidget://"))
			?.evaluate(() =>
				getComputedStyle(document.documentElement).getPropertyValue("--color-text-primary").trim(),
			);
		await page.evaluate(() =>
			(window as unknown as Bs).brainstorm.dashboard.setAppearanceMode?.("dark"),
		);
		await page.waitForTimeout(1800);
		const darkToken = await page
			.frames()
			.find((f) => f.url().startsWith("bswidget://"))
			?.evaluate(() =>
				getComputedStyle(document.documentElement).getPropertyValue("--color-text-primary").trim(),
			);
		s.note(`live retheme: --color-text-primary light="${lightToken}" dark="${darkToken}" (changed=${lightToken !== darkToken})`);
		await s.shot(page, "arranged-grid-dark");
		await page.evaluate(() =>
			(window as unknown as Bs).brainstorm.dashboard.setAppearanceMode?.("auto"),
		);
		await page.waitForTimeout(1200);

		// --- 7. Keyboard reachability: tab from the surface — which widget
		//        controls can Mira reach without a mouse?
		await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		const reached: string[] = [];
		for (let i = 0; i < 60; i++) {
			await page.keyboard.press("Tab");
			const focus = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el) return null;
				const inWidget = el.closest(".dashboard-widgets") != null;
				return inWidget
					? `${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.className}]`
					: null;
			});
			if (focus) reached.push(focus);
		}
		s.note(
			`keyboard: widget-layer elements reachable by Tab (60 presses): ${reached.length === 0 ? "NONE" : JSON.stringify([...new Set(reached)])}`,
		);

		s.note(`final card ids: ${JSON.stringify(await cardIds())}`);
	} finally {
		await s.finish();
	}

	// --- 8. Reboot: does the dashboard come back exactly as Mira left it?
	const s2 = await startSession("375-widgets-dogfood-reboot");
	try {
		const page2 = s2.dashboard;
		await page2.waitForTimeout(3000);
		const cards = await page2.$$eval(CARD, (els) =>
			els.map((el) => ({
				id: (el.getAttribute("data-testid") ?? "").replace("dashboard-widget-", ""),
				rect: (() => {
					const r = el.getBoundingClientRect();
					return { x: r.x, y: r.y, w: r.width, h: r.height };
				})(),
			})),
		);
		s2.note(`after reboot: ${cards.length} widgets (expect 6): ${JSON.stringify(cards)}`);
		expect(cards.length, "widgets survive a shell restart").toBe(6);
		const frames = page2.frames().filter((f) => f.url().startsWith("bswidget://")).length;
		s2.note(`bswidget frames after reboot: ${frames}`);
		await s2.shot(page2, "after-reboot");
	} finally {
		await s2.finish();
	}
});
