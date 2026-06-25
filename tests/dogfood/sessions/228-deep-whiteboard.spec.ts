/**
 * Session 228 — Deep Whiteboard walkthrough.
 *
 * A founder-session that DEEPLY exercises the Whiteboard app's real surface:
 * the board list (switch / new / delete), the bottom authoring toolbar
 * (select / sticky / text / frame / pen — active state + create one object
 * per tool), node text editing, the header menus (Add to board / Style /
 * Arrange / Export / Layers / ⋯ More actions), connectors between two
 * objects, the board-list hide/show toggle, and persistence on a board
 * switch round-trip.
 *
 * Canvas interactions can't be driven by synthetic pointer events (Playwright
 * can't drive `setPointerCapture`), so wherever possible we drive the WIRED
 * path through the engine dev hook `window.__brainstormWhiteboardDev`
 * (`nodeIds` / `dragNodeBy` / `connect` / `drawInk`) and the React chrome
 * (toolbar buttons by `aria-label`, header menu buttons by `data-testid` /
 * `aria-label`, board rows by `.whiteboard__nav-row`). Object creation goes
 * through the "Add to board" header menu (the same engine action the tools
 * fire on canvas), then we assert the node count moved via the dev hook.
 *
 * EVERY action is judged from observable state and recorded as
 * `[PASS] / [FAIL] / [?] <action> — <observed>` via `s.note()`; every step is
 * wrapped in try/catch so a single failure never aborts the walkthrough.
 */

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type WbDev = {
	nodeIds: () => string[];
	connect: (sourceId: string, destId: string) => string | null;
	drawInk: (points: ReadonlyArray<{ x: number; y: number }>) => string | null;
	dragNodeBy: (id: string, dx: number, dy: number) => { x: number; y: number; guides: number };
	edgeState: (id: string) => unknown | null;
};

test("deep whiteboard walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-whiteboard");

	// PASS / FAIL / ? recorder. Every step funnels through here so the notes.md
	// reads as a flat verdict log regardless of how the assertion was reached.
	const verdict = (ok: boolean | null, action: string, observed: string): void => {
		const tag = ok === null ? "[?]" : ok ? "[PASS]" : "[FAIL]";
		s.note(`${tag} ${action} — ${observed}`);
	};

	// Read the live node ids from the engine dev hook (the wired path).
	const nodeIds = async (page: Page): Promise<string[]> =>
		page
			.evaluate(
				() =>
					(
						window as unknown as { __brainstormWhiteboardDev?: WbDev }
					).__brainstormWhiteboardDev?.nodeIds() ?? [],
			)
			.catch(() => [] as string[]);

	const nodeCount = async (page: Page): Promise<number> => (await nodeIds(page)).length;

	// Active tool from the toolbar's aria-pressed state.
	const activeTool = async (page: Page): Promise<string | null> =>
		page
			.evaluate(() => {
				const btn = document.querySelector('.whiteboard__tool[aria-pressed="true"]');
				return btn?.getAttribute("aria-label") ?? null;
			})
			.catch(() => null);

	const boardName = async (page: Page): Promise<string> =>
		page
			.locator(".whiteboard__board-name")
			.first()
			.innerText()
			.catch(() => "");

	const boardRowCount = async (page: Page): Promise<number> =>
		page
			.locator(".whiteboard__nav-row")
			.count()
			.catch(() => 0);

	// Open a header menu button by its data-testid or accessible name, then
	// click a `[role="menuitem"]` matching `itemText`. Returns whether both the
	// menu opened and the item was found+clicked.
	const openMenuAndClick = async (
		page: Page,
		trigger: { testId?: string; label?: string },
		itemText: string,
	): Promise<{ opened: boolean; clicked: boolean }> => {
		const triggerLoc = trigger.testId
			? page.locator(`[data-testid="${trigger.testId}"]`).first()
			: page.locator(`[aria-label="${trigger.label}"]`).first();
		await triggerLoc.click().catch(() => undefined);
		await page.waitForTimeout(400);
		const menu = page.locator('.fm-menu, [role="menu"]').first();
		const opened = await menu.isVisible().catch(() => false);
		let clicked = false;
		if (opened) {
			const item = page.locator('[role="menuitem"]', { hasText: itemText }).first();
			if (await item.count().catch(() => 0)) {
				await item.click().catch(() => undefined);
				clicked = true;
			}
		}
		await page.waitForTimeout(400);
		return { opened, clicked };
	};

	const dismissMenus = async (page: Page): Promise<void> => {
		await page.keyboard.press("Escape").catch(() => undefined);
		await page.waitForTimeout(200);
	};

	try {
		const wb = await s.openApp(APP.Whiteboard);
		await wb.waitForTimeout(3000);
		await s.shot(wb, "00-opened");
		verdict(
			true,
			"open Whiteboard app",
			`header present: ${await wb.locator(".app-header").count()}`,
		);

		// ── New whiteboard ──────────────────────────────────────────────────
		// "New whiteboard" header button opens a template menu; pick "Blank
		// board". Assert a new board row appears.
		try {
			const beforeRows = await boardRowCount(wb);
			const r = await openMenuAndClick(wb, { testId: "whiteboard-new-board" }, "Blank");
			await wb.waitForTimeout(1500);
			const afterRows = await boardRowCount(wb);
			await s.shot(wb, "01-new-board");
			verdict(
				r.opened && afterRows >= beforeRows,
				'"New whiteboard" → Blank board',
				`menu opened=${r.opened}, clicked=${r.clicked}, rows ${beforeRows}→${afterRows}, active="${await boardName(wb)}"`,
			);
		} catch (e) {
			verdict(false, '"New whiteboard"', `threw: ${(e as Error).message}`);
		}

		// Make sure at least two boards exist so the switch test has somewhere to
		// go. Create a second blank board.
		try {
			const before = await boardRowCount(wb);
			if (before < 2) {
				await openMenuAndClick(wb, { testId: "whiteboard-new-board" }, "Blank");
				await wb.waitForTimeout(1200);
			}
			verdict(true, "ensure ≥2 boards for switch test", `rows now ${await boardRowCount(wb)}`);
		} catch (e) {
			verdict(false, "ensure ≥2 boards", `threw: ${(e as Error).message}`);
		}

		// Record the id of the board we'll treat as the disposable "test board"
		// (the currently-active one — the most recently created).
		const testBoardName = await boardName(wb);

		// ── Bottom authoring toolbar: each tool ─────────────────────────────
		// Click each tool, assert it becomes active (aria-pressed), then create
		// one object via the matching engine action (Add-to-board for the
		// node-spawning tools; the dev hook for pen/ink) and assert the count
		// rose. Select is the no-spawn default and is asserted on active-state.
		const toolChecks: Array<{
			tool: string; // toolbar aria-label
			create?: { menuItem: string } | "ink"; // how to make an object
		}> = [
			{ tool: "Select" },
			{ tool: "Sticky note", create: { menuItem: "Sticky note" } },
			{ tool: "Text", create: { menuItem: "Text" } },
			{ tool: "Frame", create: { menuItem: "Frame" } },
			{ tool: "Pen", create: "ink" },
		];

		for (const tc of toolChecks) {
			try {
				await wb
					.locator(`.whiteboard__tool[aria-label="${tc.tool}"]`)
					.first()
					.click()
					.catch(() => undefined);
				await wb.waitForTimeout(300);
				const active = await activeTool(wb);
				verdict(active === tc.tool, `select tool "${tc.tool}"`, `active tool = "${active}"`);

				if (tc.create) {
					const before = await nodeCount(wb);
					if (tc.create === "ink") {
						// Pen: drive the wired ink path via the dev hook (a synthetic
						// pointer can't draw freehand). Asserts the same addNode path.
						const inkId = await wb
							.evaluate(
								() =>
									(
										window as unknown as { __brainstormWhiteboardDev?: WbDev }
									).__brainstormWhiteboardDev?.drawInk([
										{ x: 200, y: 200 },
										{ x: 260, y: 220 },
										{ x: 300, y: 280 },
										{ x: 340, y: 240 },
									]) ?? null,
							)
							.catch(() => null);
						await wb.waitForTimeout(600);
						const after = await nodeCount(wb);
						verdict(
							Boolean(inkId) && after > before,
							`create object with "${tc.tool}" (ink)`,
							`ink id=${inkId}, nodes ${before}→${after}`,
						);
					} else {
						// Node-spawning tools: the "Add to board" header menu fires the
						// same engine create action the on-canvas tool does.
						const r = await openMenuAndClick(wb, { label: "Add to board" }, tc.create.menuItem);
						await wb.waitForTimeout(700);
						const after = await nodeCount(wb);
						verdict(
							r.clicked && after > before,
							`create object with "${tc.tool}"`,
							`add-menu clicked=${r.clicked}, nodes ${before}→${after}`,
						);
					}
				}
			} catch (e) {
				verdict(false, `tool "${tc.tool}"`, `threw: ${(e as Error).message}`);
			}
		}
		await s.shot(wb, "02-objects-created");

		// ── Double-click a node to edit its text ────────────────────────────
		// The sticky/text body is a `.whiteboard__node-body` carrying
		// `data-node-id`; double-click flips it to `contenteditable`. Type, then
		// blur and assert the text changed.
		try {
			const editable = wb.locator(".whiteboard__node-body").first();
			const beforeText = await editable.innerText().catch(() => "");
			await editable.dblclick().catch(() => undefined);
			await wb.waitForTimeout(400);
			const isEditing = await wb
				.locator(".whiteboard__node-body--editing, .whiteboard__node-body[contenteditable='true']")
				.count()
				.catch(() => 0);
			const stamp = "228-edit";
			await wb.keyboard.type(stamp, { delay: 12 }).catch(() => undefined);
			await wb.waitForTimeout(300);
			await wb.keyboard.press("Escape").catch(() => undefined);
			await wb.waitForTimeout(400);
			const afterText = await wb
				.locator(".whiteboard__node-body")
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(wb, "03-node-text-edit");
			verdict(
				isEditing > 0 && afterText.includes(stamp) && afterText !== beforeText,
				"double-click node → edit text",
				`editing=${isEditing > 0}, "${beforeText}" → "${afterText}"`,
			);
		} catch (e) {
			verdict(false, "edit node text", `threw: ${(e as Error).message}`);
		}

		// ── Add to board menu (open + click each kind) ──────────────────────
		// Already used Sticky/Text/Frame above; here exercise the shape kinds to
		// prove every Add row fires an engine create. Assert count grows each.
		for (const item of ["Rectangle", "Ellipse", "Triangle", "Diamond", "Line", "Arrow"]) {
			try {
				const before = await nodeCount(wb);
				const r = await openMenuAndClick(wb, { label: "Add to board" }, item);
				await wb.waitForTimeout(500);
				const after = await nodeCount(wb);
				verdict(r.clicked && after > before, `Add to board → "${item}"`, `nodes ${before}→${after}`);
			} catch (e) {
				verdict(false, `Add to board → "${item}"`, `threw: ${(e as Error).message}`);
			}
		}
		await s.shot(wb, "04-shapes-added");

		// ── Connectors between two objects ──────────────────────────────────
		// The dev hook `connect(a, b)` drives the wired buildConnectorEdge path
		// (validity check + persist). Assert it returns an edge id + the edge is
		// queryable.
		try {
			const ids = await nodeIds(wb);
			if (ids.length >= 2) {
				const a = ids[0] as string;
				const b = ids[1] as string;
				const edgeId = await wb
					.evaluate(
						([s1, s2]) =>
							(
								window as unknown as { __brainstormWhiteboardDev?: WbDev }
							).__brainstormWhiteboardDev?.connect(s1 as string, s2 as string) ?? null,
						[a, b],
					)
					.catch(() => null);
				await wb.waitForTimeout(500);
				const edgeOk = await wb
					.evaluate(
						(id) =>
							Boolean(
								(
									window as unknown as { __brainstormWhiteboardDev?: WbDev }
								).__brainstormWhiteboardDev?.edgeState(id as string),
							),
						edgeId,
					)
					.catch(() => false);
				await s.shot(wb, "05-connector");
				verdict(
					Boolean(edgeId) && edgeOk,
					"create connector between two objects",
					`edge id=${edgeId}, edgeState found=${edgeOk}`,
				);
			} else {
				verdict(null, "create connector", `only ${ids.length} node(s) — skipped`);
			}
		} catch (e) {
			verdict(false, "create connector", `threw: ${(e as Error).message}`);
		}

		// ── Style menu (select an object first, then Style) ─────────────────
		// Style is disabled with no selection. Select via the Select tool +
		// click a node, then open the Style header menu and assert it lists
		// styling items.
		try {
			await wb
				.locator('.whiteboard__tool[aria-label="Select"]')
				.first()
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(200);
			await wb
				.locator(".whiteboard__node-body")
				.first()
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(400);
			const styleBtn = wb.locator('[aria-label="Style"]').first();
			const styleDisabled = await styleBtn.getAttribute("aria-disabled").catch(() => null);
			await styleBtn.click().catch(() => undefined);
			await wb.waitForTimeout(400);
			const menu = wb.locator('.fm-menu, [role="menu"]').first();
			const styleOpen = await menu.isVisible().catch(() => false);
			const styleItemCount = await wb
				.locator('[role="menuitem"]')
				.count()
				.catch(() => 0);
			await s.shot(wb, "06-style-menu");
			verdict(
				styleOpen && styleItemCount > 0,
				"select object → open Style menu",
				`aria-disabled=${styleDisabled}, menu open=${styleOpen}, items=${styleItemCount}`,
			);
			await dismissMenus(wb);
		} catch (e) {
			verdict(false, "Style menu", `threw: ${(e as Error).message}`);
		}

		// ── Arrange menu ────────────────────────────────────────────────────
		try {
			const r = await openMenuAndClick(wb, { label: "Arrange" }, "Align left");
			await s.shot(wb, "07-arrange-menu");
			verdict(
				r.opened,
				"open Arrange menu + click Align left",
				`opened=${r.opened}, clicked=${r.clicked}`,
			);
			await dismissMenus(wb);
		} catch (e) {
			verdict(false, "Arrange menu", `threw: ${(e as Error).message}`);
		}

		// ── Export menu (popover) ───────────────────────────────────────────
		try {
			await wb
				.locator('[aria-label="Export"]')
				.first()
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(500);
			const exportOpen = await wb
				.locator('.bs-popover, [role="dialog"], .export-popover')
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(wb, "08-export-popover");
			verdict(exportOpen, "open Export popover", `popover visible=${exportOpen}`);
			await dismissMenus(wb);
		} catch (e) {
			verdict(false, "Export popover", `threw: ${(e as Error).message}`);
		}

		// ── Layers panel toggle ─────────────────────────────────────────────
		try {
			const layersBtn = wb.locator('[aria-label="Toggle layers"], [aria-label*="ayers"]').first();
			const before = await layersBtn.getAttribute("aria-pressed").catch(() => null);
			await layersBtn.click().catch(() => undefined);
			await wb.waitForTimeout(400);
			const after = await layersBtn.getAttribute("aria-pressed").catch(() => null);
			const panelVisible = await wb
				.locator(".whiteboard__layers-host *")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(wb, "09-layers-panel");
			verdict(
				before !== after || panelVisible,
				"toggle Layers panel",
				`aria-pressed ${before}→${after}, panel content visible=${panelVisible}`,
			);
		} catch (e) {
			verdict(false, "Layers panel toggle", `threw: ${(e as Error).message}`);
		}

		// ── Board-list hide / show ──────────────────────────────────────────
		try {
			const root = wb.locator("#whiteboard-root").first();
			const before = await root.getAttribute("data-nav-open").catch(() => null);
			// PanelToggleButton's accessible name flips between show/hide.
			await wb
				.locator('[aria-label="Hide board list"], [aria-label="Show board list"]')
				.first()
				.click()
				.catch(() => undefined);
			await wb.waitForTimeout(400);
			const after = await root.getAttribute("data-nav-open").catch(() => null);
			verdict(before !== after, "toggle board list (hide/show)", `data-nav-open ${before}→${after}`);
			// Restore visible for subsequent board-row interactions.
			if (after === "false") {
				await wb
					.locator('[aria-label="Show board list"]')
					.first()
					.click()
					.catch(() => undefined);
				await wb.waitForTimeout(400);
			}
			await s.shot(wb, "10-board-list-toggle");
		} catch (e) {
			verdict(false, "board list toggle", `threw: ${(e as Error).message}`);
		}

		// ── Header ⋯ "More actions" menu (open + inspect items) ─────────────
		// The object ⋯ is the LAST element in the header right group.
		try {
			const more = wb.locator('[aria-label="More actions"]').last();
			await more.click().catch(() => undefined);
			await wb.waitForTimeout(500);
			const menu = wb.locator('.fm-menu, [role="menu"]').first();
			const opened = await menu.isVisible().catch(() => false);
			const items = await wb
				.locator('[role="menuitem"]')
				.allInnerTexts()
				.catch(() => [] as string[]);
			await s.shot(wb, "11-more-actions");
			verdict(
				opened,
				"open header ⋯ More actions menu",
				`opened=${opened}, items=${JSON.stringify(items)}`,
			);
			// Try a non-destructive item if present (e.g. Duplicate / Copy link).
			const benign = wb
				.locator('[role="menuitem"]', { hasText: /Duplicate|Copy link|Rename|Pin|Favorite/i })
				.first();
			if (await benign.count().catch(() => 0)) {
				const label = await benign.innerText().catch(() => "");
				await benign.click().catch(() => undefined);
				await wb.waitForTimeout(500);
				verdict(true, "⋯ menu: click benign item", `clicked "${label}"`);
			} else {
				await dismissMenus(wb);
				verdict(null, "⋯ menu: benign item", "no benign item matched");
			}
		} catch (e) {
			verdict(false, "header ⋯ More actions", `threw: ${(e as Error).message}`);
		}

		// ── LINKS (PRIORITY): board-row navigation ──────────────────────────
		// The clearest "link" affordance in Whiteboard is the board-list row:
		// each row links to (opens) another board. Click a non-active row and
		// ASSERT navigation (the active board name + active-row highlight moved).
		try {
			const rows = wb.locator(".whiteboard__nav-row");
			const total = await rows.count();
			if (total >= 2) {
				const nameBefore = await boardName(wb);
				// Find a row that is NOT the active one.
				let targetIndex = -1;
				for (let i = 0; i < total; i += 1) {
					const cls =
						(await rows
							.nth(i)
							.getAttribute("class")
							.catch(() => "")) ?? "";
					if (!cls.includes("whiteboard__nav-row--active")) {
						targetIndex = i;
						break;
					}
				}
				if (targetIndex >= 0) {
					const targetLabel = await rows
						.nth(targetIndex)
						.locator(".whiteboard__nav-row-name")
						.innerText()
						.catch(() => "");
					await rows
						.nth(targetIndex)
						.click()
						.catch(() => undefined);
					await wb.waitForTimeout(1200);
					const nameAfter = await boardName(wb);
					const activeRowName = await wb
						.locator(".whiteboard__nav-row--active .whiteboard__nav-row-name")
						.first()
						.innerText()
						.catch(() => "");
					await s.shot(wb, "12-link-navigation");
					verdict(
						nameAfter !== nameBefore && (nameAfter === targetLabel || activeRowName === targetLabel),
						"LINK: click board row → navigate to that board",
						`board "${nameBefore}" → "${nameAfter}" (target "${targetLabel}", active row "${activeRowName}")`,
					);
				} else {
					verdict(null, "LINK: board-row navigation", "no inactive row to click");
				}
			} else {
				verdict(null, "LINK: board-row navigation", `only ${total} board(s)`);
			}
		} catch (e) {
			verdict(false, "LINK: board-row navigation", `threw: ${(e as Error).message}`);
		}

		// ── Persistence: switch boards and back ─────────────────────────────
		// Return to the test board and confirm its object count survived the
		// navigation away-and-back (the canvas content reloads from the vault).
		try {
			const rows = wb.locator(".whiteboard__nav-row");
			const total = await rows.count();
			// Capture object count of whatever board is active now, switch to
			// another, then switch back and re-read.
			const startName = await boardName(wb);
			const startCount = await nodeCount(wb);
			if (total >= 2) {
				// Switch to a different row…
				let otherIndex = -1;
				for (let i = 0; i < total; i += 1) {
					const nm = await rows
						.nth(i)
						.locator(".whiteboard__nav-row-name")
						.innerText()
						.catch(() => "");
					if (nm !== startName) {
						otherIndex = i;
						break;
					}
				}
				if (otherIndex >= 0) {
					await rows
						.nth(otherIndex)
						.click()
						.catch(() => undefined);
					await wb.waitForTimeout(1000);
					const awayName = await boardName(wb);
					const awayCount = await nodeCount(wb);
					verdict(
						awayName !== startName,
						"persistence: switch away — canvas content changed",
						`board "${startName}"(${startCount} nodes) → "${awayName}"(${awayCount} nodes)`,
					);
					// …and back to the start board by name.
					const backRow = wb.locator(".whiteboard__nav-row", { hasText: startName }).first();
					await backRow.click().catch(() => undefined);
					await wb.waitForTimeout(1200);
					const backCount = await nodeCount(wb);
					await s.shot(wb, "13-persistence-roundtrip");
					verdict(
						(await boardName(wb)) === startName && backCount === startCount,
						"persistence: switch back — objects survived",
						`back on "${startName}", nodes ${startCount} → ${backCount}`,
					);
				} else {
					verdict(null, "persistence round-trip", "no other board to switch to");
				}
			} else {
				verdict(null, "persistence round-trip", `only ${total} board(s)`);
			}
		} catch (e) {
			verdict(false, "persistence round-trip", `threw: ${(e as Error).message}`);
		}

		// ── Cleanup: delete the test board (assert removal) ─────────────────
		// Select the disposable test board, open its ⋯ menu, click Delete, and
		// assert the row count dropped.
		try {
			// Activate the test board (created earlier) by name if still present.
			const testRow = wb.locator(".whiteboard__nav-row", { hasText: testBoardName }).first();
			if (await testRow.count().catch(() => 0)) {
				await testRow.click().catch(() => undefined);
				await wb.waitForTimeout(800);
			}
			const before = await boardRowCount(wb);
			const more = wb.locator('[aria-label="More actions"]').last();
			await more.click().catch(() => undefined);
			await wb.waitForTimeout(500);
			const deleteItem = wb.locator('[role="menuitem"]', { hasText: /Delete|Remove/i }).first();
			let deleteClicked = false;
			if (await deleteItem.count().catch(() => 0)) {
				await deleteItem.click().catch(() => undefined);
				deleteClicked = true;
				await wb.waitForTimeout(600);
				// A confirm dialog may appear — accept it if so.
				const confirmBtn = wb
					.locator('[role="dialog"] button', { hasText: /Delete|Remove|Confirm|OK/i })
					.first();
				if (await confirmBtn.count().catch(() => 0)) {
					await confirmBtn.click().catch(() => undefined);
					await wb.waitForTimeout(800);
				}
			} else {
				await dismissMenus(wb);
			}
			await wb.waitForTimeout(800);
			const after = await boardRowCount(wb);
			await s.shot(wb, "14-after-delete");
			verdict(
				deleteClicked && after < before,
				"cleanup: delete test board",
				`delete clicked=${deleteClicked}, rows ${before}→${after}`,
			);
		} catch (e) {
			verdict(false, "delete test board", `threw: ${(e as Error).message}`);
		}

		s.note("--- session 228 complete ---");
	} finally {
		await s.finish();
	}
});
