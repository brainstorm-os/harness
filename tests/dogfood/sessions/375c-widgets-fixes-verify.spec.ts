/**
 * Session 375c — verification pass for the widget round: the F-380..F-384
 * fixes (shell PR #94) and the widget expansion (6 new widgets + empty-state
 * CTAs). Drives the REAL paths that failed in session 375:
 *   - F-380: the per-boot reseed used to husk the Notes widget (slug title,
 *     initials icon, dead placeholder) — now the apps:changed push must heal
 *     the title/entry live in the same session, no restart.
 *   - F-381: an empty widget shows a CTA that launches the owning app.
 *   - F-382: the ⋯ menu carries Size presets + Open app + Remove (last).
 *   - F-383: Tab reaches the grips; arrows move/resize on the 8px grid.
 *   - F-384/scoped-caps: the Books widget renders through a typed query
 *     despite Books holding no entities.read:* grant.
 *   - New widgets: catalog shows all 13; each new one mounts and renders
 *     rows or the shared empty CTA.
 */

import { expect, test } from "@playwright/test";
import { startSession } from "../lib/founder";

type Bs = {
	brainstorm: {
		dashboard: {
			upsertWidget(id: string, r: Record<string, unknown>): Promise<void>;
			removeWidget(id: string): Promise<void>;
		};
	};
};

const NEW_WIDGETS = [
	{ appId: "io.brainstorm.journal", kind: "today-journal", menu: "Journal" },
	{ appId: "io.brainstorm.books", kind: "currently-reading", menu: "Currently Reading" },
	{ appId: "io.brainstorm.chat", kind: "recent-messages", menu: "Recent Messages" },
	{ appId: "io.brainstorm.agent", kind: "recent-conversations", menu: "Conversations" },
	{ appId: "io.brainstorm.automations", kind: "recent-runs", menu: "Recent Runs" },
	{ appId: "io.brainstorm.mailbox", kind: "inbox", menu: "Inbox" },
] as const;

const CARD = '[data-testid^="dashboard-widget-"]';
const MENU_ROW = '[role="option"], [role="menuitem"]';

test("widget fixes + new widgets verify (375c)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("375c-widgets-fixes-verify");
	const page = s.dashboard;

	const cardIds = () =>
		page.$$eval(CARD, (els) =>
			els.map((el) => (el.getAttribute("data-testid") ?? "").replace("dashboard-widget-", "")),
		);

	try {
		await page.waitForTimeout(2500);

		// Clean slate.
		const leftovers = await cardIds();
		await page.evaluate(async (ids) => {
			const bs = (window as unknown as Bs).brainstorm;
			for (const id of ids) await bs.dashboard.removeWidget(id);
		}, leftovers);
		await page.waitForTimeout(500);

		// --- F-380: place a Notes widget IMMEDIATELY, then confirm its title is
		// (or becomes) the registered name — session 375 saw the slug stick
		// forever because the boot reseed raced the one-shot title fetch.
		await page.evaluate(async () => {
			const bs = (window as unknown as Bs).brainstorm;
			await bs.dashboard.upsertWidget("widget_375c_notes", {
				appId: "io.brainstorm.notes",
				kind: "recent-notes",
				x: 4,
				y: 6,
				w: 40,
				h: 20,
				paused: false,
				collapsed: false,
			});
		});
		const notesCard = page.locator('[data-testid="dashboard-widget-widget_375c_notes"]');
		await expect(notesCard.locator(".dashboard-widgets__title")).toHaveText("Recent Notes", {
			timeout: 20_000,
		});
		s.note("F-380: notes widget title resolved to 'Recent Notes' (no slug husk)");
		const notesFrame = await notesCard.locator(".dashboard-widgets__frame").count();
		s.note(`F-380: notes iframe mounted: ${notesFrame === 1}`);
		expect(notesFrame, "notes widget iframe mounts post-reseed").toBe(1);

		// --- F-382: the ⋯ menu now carries Size presets + Open app + Remove.
		await notesCard.getByRole("button", { name: "Widget options" }).click();
		await page.waitForTimeout(400);
		const opts = await page.locator(MENU_ROW).allTextContents();
		s.note(`F-382: ⋯ menu rows: ${JSON.stringify(opts)}`);
		await s.shot(page, "widget-options-menu");
		expect(opts.join("|")).toContain("Small");
		expect(opts.join("|")).toContain("Open app");
		expect(opts.at(-1), "Remove is last").toContain("Remove");
		// Pick Small — the card should snap to the small footprint (160×160+chrome).
		await page.locator(MENU_ROW).filter({ hasText: /^Small$/ }).click();
		await page.waitForTimeout(700);
		const smallBox = await notesCard.boundingBox();
		s.note(`F-382: after Size→Small: ${smallBox?.width}×${smallBox?.height}`);
		expect(smallBox?.width, "Small preset width").toBe(160);

		// --- F-383: keyboard move — focus the grip, ArrowRight = +8px.
		const grip = notesCard.locator(".dashboard-widgets__grip");
		await grip.focus();
		const before = await notesCard.boundingBox();
		await page.keyboard.press("ArrowRight");
		await page.waitForTimeout(500);
		const after = await notesCard.boundingBox();
		const dx = (after?.x ?? 0) - (before?.x ?? 0);
		s.note(`F-383: grip focus + ArrowRight moved card ${dx}px (expect 8)`);
		expect(dx, "arrow key moves one 8px cell").toBe(8);
		// Resize grip: ArrowDown grows height by 8px.
		const rgrip = notesCard.locator(".dashboard-widgets__resize");
		await rgrip.focus();
		const beforeH = (await notesCard.boundingBox())?.height ?? 0;
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(500);
		const afterH = (await notesCard.boundingBox())?.height ?? 0;
		s.note(`F-383: resize grip + ArrowDown grew height ${afterH - beforeH}px (expect 8)`);
		expect(afterH - beforeH, "arrow key resizes one 8px cell").toBe(8);

		// --- New widgets: all six place from the catalog and render.
		const addBtn = page.getByRole("button", { name: "Add widget" });
		await addBtn.click();
		await page.waitForTimeout(500);
		const catalog = await page.locator(MENU_ROW).allTextContents();
		s.note(`catalog rows (${catalog.length}, expect 13): ${JSON.stringify(catalog)}`);
		await s.shot(page, "catalog-13-widgets");
		await page.keyboard.press("Escape");
		expect(catalog.length, "catalog lists 13 widgets").toBe(13);

		let col = 0;
		for (const w of NEW_WIDGETS) {
			const beforeIds = await cardIds();
			await addBtn.click();
			await page.waitForTimeout(400);
			await page.locator(MENU_ROW).filter({ hasText: w.menu }).first().click();
			await page.waitForTimeout(800);
			const freshId = (await cardIds()).find((id) => !beforeIds.includes(id));
			s.note(`added ${w.kind} → ${freshId ?? "MISSING"}`);
			expect(freshId, `${w.kind} placed`).toBeTruthy();
			// Tidy into a row for the screenshot sweep.
			if (freshId) {
				await page.evaluate(
					async (args) => {
						const bs = (window as unknown as Bs).brainstorm;
						await bs.dashboard.upsertWidget(args.id, {
							appId: args.appId,
							kind: args.kind,
							x: 4 + (args.col % 3) * 42,
							y: 30 + Math.floor(args.col / 3) * 24,
							w: 40,
							h: 20,
							paused: false,
							collapsed: false,
						});
					},
					{ id: freshId, appId: w.appId, kind: w.kind, col },
				);
				col += 1;
			}
		}
		await page.waitForTimeout(2500);

		// Content audit per new widget: iframe up, body has rows OR the shared
		// empty CTA (which is itself the F-381 fix).
		for (const w of NEW_WIDGETS) {
			const wf = page
				.frames()
				.find((f) => f.url().startsWith("bswidget://") && f.url().includes(w.kind));
			const inner = wf
				? await wf
						.evaluate(() => ({
							rows: document.querySelectorAll('[class*="__row"], [class*="__day"]').length,
							emptyCta: document.querySelectorAll(".bs-widget-empty__action").length,
							emptyMsg:
								document.querySelector(".bs-widget-empty__message")?.textContent ?? null,
							text: document.body.textContent?.slice(0, 100) ?? "",
						}))
						.catch(() => null)
				: null;
			s.note(`widget ${w.kind}: ${JSON.stringify(inner)}`);
			expect(inner, `${w.kind} iframe reachable`).toBeTruthy();
			expect(
				(inner?.rows ?? 0) > 0 || (inner?.emptyCta ?? 0) > 0,
				`${w.kind} shows rows or an actionable empty state`,
			).toBe(true);
		}
		await s.shot(page, "all-new-widgets-grid");

		// --- F-384 / scoped caps: Books renders through its typed query.
		const booksFrame = page
			.frames()
			.find((f) => f.url().startsWith("bswidget://") && f.url().includes("currently-reading"));
		const booksDenied = booksFrame
			? await booksFrame.evaluate(() => document.body.textContent?.includes("capability") ?? false)
			: true;
		s.note(`F-384: books widget capability-denied: ${booksDenied} (expect false)`);
		expect(booksDenied, "scoped-cap Books widget is not denied").toBe(false);

		// --- F-381: click an empty-CTA and confirm the owning app launches.
		// Contacts has zero Person entities in this vault, so its widget is
		// reliably empty — place it and click "Add people".
		await page.evaluate(async () => {
			const bs = (window as unknown as Bs).brainstorm;
			await bs.dashboard.upsertWidget("widget_375c_contacts", {
				appId: "io.brainstorm.contacts",
				kind: "list-contacts",
				x: 88,
				y: 6,
				w: 40,
				h: 20,
				paused: false,
				collapsed: false,
			});
		});
		await page.waitForTimeout(2000);
		const contactsFrame = page
			.frames()
			.find((f) => f.url().startsWith("bswidget://io.brainstorm.contacts"));
		expect(contactsFrame, "contacts widget iframe").toBeTruthy();
		const ctaLabel = await contactsFrame
			?.evaluate(() => {
				const btn = document.querySelector(".bs-widget-empty__action") as HTMLElement | null;
				return btn?.textContent ?? null;
			})
			.catch(() => null);
		s.note(`F-381: contacts empty CTA label: ${ctaLabel}`);
		await s.shot(page, "contacts-empty-cta");
		expect(ctaLabel, "contacts empty state has a CTA").toBeTruthy();
		await contactsFrame?.evaluate(() => {
			(document.querySelector(".bs-widget-empty__action") as HTMLElement | null)?.click();
		});
		const contactsOpened = await (async () => {
			const deadline = Date.now() + 15_000;
			while (Date.now() < deadline) {
				if (s.appPagesFor("io.brainstorm.contacts").length > 0) return true;
				await page.waitForTimeout(500);
			}
			return false;
		})();
		s.note(`F-381: CTA launched Contacts app: ${contactsOpened}`);
		expect(contactsOpened, "empty CTA opens the owning app").toBe(true);

		await s.shot(page, "final-dashboard");
		s.note(`final cards: ${(await cardIds()).length}`);
	} finally {
		await s.finish();
	}
});
