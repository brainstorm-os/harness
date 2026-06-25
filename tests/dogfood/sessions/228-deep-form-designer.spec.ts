/**
 * Session 228 — DEEP Form Designer walkthrough. Exercises the full Form
 * Designer v1 surface end-to-end: the Builder (name, "Creates entities of
 * type" select, Add field across multiple property types, configure / reorder
 * / remove a field, Save form → forms sidebar) and Fill (render the saved form,
 * fill every field — PRIORITY on a relation/reference field that links another
 * object — Create the target entity, required-field validation), the header ⋯
 * "More actions" menu ("New form"), the F-232 header-height measurement, and
 * persistence on reopen.
 *
 * Every action narrates a [PASS]/[FAIL]/[?] line judged from observable DOM and
 * is wrapped in try/catch so a single failure never aborts the walkthrough.
 * Selectors mirror the shipped app (apps/form-designer/src/app.tsx) and reuse
 * session 222's patterns (.fd-builder, .fd-mode__tab, .fd-input, .fm-row,
 * .fd-field-card, .fd-sidebar__item).
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type FounderSession, startSession } from "../lib/founder";

/** Run `fn`, narrate a verdict line from its observed result, never throw. */
async function step(
	s: FounderSession,
	action: string,
	fn: () => Promise<{ ok: boolean | null; observed: string }>,
): Promise<void> {
	try {
		const { ok, observed } = await fn();
		const tag = ok === null ? "[?]" : ok ? "[PASS]" : "[FAIL]";
		s.note(`${tag} ${action} — ${observed}`);
	} catch (error) {
		s.note(`[FAIL] ${action} — threw: ${(error as Error).message.slice(0, 120)}`);
	}
}

const count = (page: Page, sel: string): Promise<number> =>
	page
		.locator(sel)
		.count()
		.catch(() => 0);

test("deep form-designer walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-form-designer");
	try {
		const fd = await s.openApp(APP.FormDesigner);
		await fd.waitForTimeout(2800);
		await s.shot(fd, "open");

		// --- App shell present ---
		await step(s, "Form Designer opened", async () => {
			const builder = await count(fd, ".fd-builder");
			const tabs = await count(fd, ".fd-mode__tab");
			const sidebar = await count(fd, ".fd-sidebar");
			return {
				ok: builder > 0 && tabs >= 2 && sidebar > 0,
				observed: `builder=${builder} tabs=${tabs} sidebar=${sidebar}`,
			};
		});

		// --- F-232: header height measurement (others are 44px) ---
		await step(s, "Header height (F-232 expects ~44px)", async () => {
			const box = await fd
				.locator(".app-header, [data-testid='app-header']")
				.first()
				.boundingBox()
				.catch(() => null);
			const h = box ? Math.round(box.height) : -1;
			return {
				ok: h === 44 ? true : h > 0 ? null : false,
				observed: `measured header height = ${h}px (44 expected)`,
			};
		});

		// =========================== BUILDER ===========================

		// --- Name the form ---
		const formName = `Client intake ${Date.now().toString().slice(-5)}`;
		await step(s, "Name the form", async () => {
			const input = fd.locator(".fd-builder .fd-input").first();
			await input.fill(formName);
			await fd.waitForTimeout(200);
			const val = await input.inputValue().catch(() => "");
			return { ok: val === formName, observed: `name input = "${val}"` };
		});

		// --- "Creates entities of type" select: open, pick a type, assert ---
		await step(s, "Open target-type select", async () => {
			await fd.locator(".fd-select.bs-select, .fd-builder .bs-select").first().click();
			await fd.waitForTimeout(500);
			const opts = await count(fd, ".fm-row");
			await s.shot(fd, "target-type-options");
			return { ok: opts > 0, observed: `${opts} type options rendered` };
		});
		await step(s, "Pick target type 'Person' (has relation-capable props)", async () => {
			// Prefer Person — a first-party type more likely to carry a relation
			// field for the LINKS path; fall back to any selectable option.
			const person = fd.locator(".fm-row", { hasText: "Person" }).first();
			const target =
				(await person.count().catch(() => 0)) > 0 ? person : fd.locator(".fm-row").first();
			const label = await target.innerText().catch(() => "");
			await target.click().catch(() => undefined);
			await fd.waitForTimeout(500);
			const shown = await fd
				.locator(".fd-select .bs-select__value, .fd-builder .bs-select__value")
				.first()
				.innerText()
				.catch(() => "");
			return {
				ok: shown.length > 0 && !shown.toLowerCase().includes("custom"),
				observed: `picked "${label.trim()}" → trigger shows "${shown.trim()}"`,
			};
		});

		// --- Add multiple fields of different property types ---
		// Each "Add field" opens the property-catalog fancy menu; pick distinct
		// rows so we cover several value/relation types. The menu lists only
		// not-yet-added properties, so re-opening yields fresh choices.
		const addedNames: string[] = [];
		for (let i = 0; i < 4; i += 1) {
			await step(s, `Add field #${i + 1} (open property picker)`, async () => {
				const before = await count(fd, ".fd-field-card");
				await fd.locator(".fd-fields__header button").first().click();
				await fd.waitForTimeout(500);
				const rows = await count(fd, ".fm-row");
				if (rows === 0) return { ok: null, observed: "no properties offered (empty catalog)" };
				// Pick the i-th distinct row when available so types differ.
				const pick = fd.locator(".fm-row").nth(Math.min(i, rows - 1));
				const picked = (await pick.innerText().catch(() => "")).trim();
				await pick.click().catch(() => undefined);
				await fd.waitForTimeout(500);
				const after = await count(fd, ".fd-field-card");
				if (picked) addedNames.push(picked);
				return {
					ok: after > before,
					observed: `picked "${picked}"; field cards ${before} → ${after}`,
				};
			});
		}
		await s.shot(fd, "fields-added");
		await step(s, "Multiple field rows present", async () => {
			const cards = await count(fd, ".fd-field-card");
			return { ok: cards >= 1, observed: `${cards} field card(s); added=[${addedNames.join(", ")}]` };
		});

		// --- Configure a field: relabel the first field ---
		await step(s, "Configure field — set a custom label", async () => {
			const labelInput = fd.locator(".fd-field-card .fd-input--sm").first();
			if ((await labelInput.count().catch(() => 0)) === 0)
				return { ok: false, observed: "no field-card label input found" };
			await labelInput.fill("Full name");
			await fd.waitForTimeout(200);
			const val = await labelInput.inputValue().catch(() => "");
			return { ok: val === "Full name", observed: `field label input = "${val}"` };
		});

		// --- Reorder a field (move first down) ---
		await step(s, "Reorder field — move first field down", async () => {
			const cards = await count(fd, ".fd-field-card");
			if (cards < 2) return { ok: null, observed: `only ${cards} field(s) — reorder N/A` };
			const firstNameBefore = (
				await fd
					.locator(".fd-field-card .fd-field-card__name")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			// Down arrow is the 2nd action button in the first card's actions.
			await fd
				.locator(".fd-field-card")
				.first()
				.locator(".fd-field-card__actions button")
				.nth(1)
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(300);
			const firstNameAfter = (
				await fd
					.locator(".fd-field-card .fd-field-card__name")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			return {
				ok: firstNameBefore !== firstNameAfter,
				observed: `first field "${firstNameBefore}" → "${firstNameAfter}"`,
			};
		});

		// --- Remove a field (last card's × action) ---
		await step(s, "Remove a field", async () => {
			const before = await count(fd, ".fd-field-card");
			if (before === 0) return { ok: null, observed: "no fields to remove" };
			await fd
				.locator(".fd-field-card")
				.last()
				.locator(".fd-field-card__actions button")
				.last()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(300);
			const after = await count(fd, ".fd-field-card");
			return { ok: after < before, observed: `field cards ${before} → ${after}` };
		});
		await s.shot(fd, "fields-configured");

		// --- Save form → must appear in the forms sidebar ---
		await step(s, "Save form", async () => {
			const fieldsNow = await count(fd, ".fd-field-card");
			if (fieldsNow === 0) return { ok: null, observed: "no fields — save would be rejected" };
			await fd
				.locator(".fd-builder__footer button[data-bs-primary]")
				.first()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(1200);
			const statusTxt = (
				await fd
					.locator(".fd-status")
					.innerText()
					.catch(() => "")
			).trim();
			const inSidebar = await fd
				.locator(".fd-sidebar__item", { hasText: formName })
				.count()
				.catch(() => 0);
			return {
				ok: inSidebar > 0 || statusTxt.toLowerCase().includes("saved"),
				observed: `status="${statusTxt}"; sidebar matches=${inSidebar}`,
			};
		});
		await s.shot(fd, "after-save");

		// =========================== FILL ===========================

		await step(s, "Switch to Fill tab", async () => {
			await fd
				.locator(".fd-mode__tab")
				.nth(1)
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(800);
			const selected = await fd
				.locator(".fd-mode__tab[aria-selected='true']")
				.innerText()
				.catch(() => "");
			const fillPresent = await count(fd, ".fd-fill, .fd-main");
			return {
				ok: selected.toLowerCase().includes("fill") && fillPresent > 0,
				observed: `active tab="${selected.trim()}" fill-pane=${fillPresent}`,
			};
		});

		await step(s, "Saved form renders as a fillable form", async () => {
			const rows = await count(fd, ".fd-fill__row");
			await s.shot(fd, "fill-rendered");
			return {
				ok: rows > 0 ? true : null,
				observed: `${rows} fillable row(s) (0 may mean no form selected outside-shell)`,
			};
		});

		// --- Required-field validation: try Create with nothing filled ---
		await step(s, "Required-field validation (Create empty)", async () => {
			const rows = await count(fd, ".fd-fill__row");
			if (rows === 0) return { ok: null, observed: "no fillable rows — validation N/A" };
			await fd
				.locator(".fd-fill__footer button[data-bs-primary]")
				.first()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(700);
			const statusTxt = (
				await fd
					.locator(".fd-status")
					.innerText()
					.catch(() => "")
			).trim();
			return { ok: null, observed: `status after empty Create = "${statusTxt}"` };
		});

		// --- LINKS (PRIORITY): exercise a relation/reference field if present ---
		// A relation cell renders an object-picker control rather than a plain
		// text input. Look for one inside a fill row, open it, pick the first
		// linkable object, and assert a chip/linked value appears.
		await step(s, "LINKS — relation field picks & links an object", async () => {
			const relTriggers = fd.locator(
				".fd-fill__row .bs-relation, .fd-fill__row [data-relation], .fd-fill__row .bs-chip-cell, .fd-fill__row button.bs-select",
			);
			const relCount = await relTriggers.count().catch(() => 0);
			if (relCount === 0)
				return { ok: null, observed: "no relation/reference field in this form — link path N/A" };
			await relTriggers
				.first()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(600);
			const options = await count(fd, ".fm-row, [role='option']");
			await s.shot(fd, "link-picker");
			if (options === 0)
				return { ok: false, observed: "relation control opened but offered no linkable objects" };
			const pickLabel = (
				await fd
					.locator(".fm-row, [role='option']")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			await fd
				.locator(".fm-row, [role='option']")
				.first()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(500);
			const linked = await count(
				fd,
				".fd-fill__row .bs-chip, .fd-fill__row .bs-chip-cell__chip, .fd-fill__row [data-linked='true']",
			);
			await s.shot(fd, "link-applied");
			return {
				ok: linked > 0,
				observed: `picked "${pickLabel}"; linked chips visible=${linked}`,
			};
		});

		// --- Fill every field then Create the target entity ---
		await step(s, "Fill every field", async () => {
			const rows = fd.locator(".fd-fill__row");
			const n = await rows.count().catch(() => 0);
			if (n === 0) return { ok: null, observed: "no fillable rows" };
			let filled = 0;
			for (let i = 0; i < n; i += 1) {
				const row = rows.nth(i);
				// Plain text/number inputs are the broad, reliable fill target.
				const input = row.locator("input[type='text'], input:not([type]), textarea").first();
				if ((await input.count().catch(() => 0)) > 0) {
					await input.fill(`Sample ${i + 1}`).catch(() => undefined);
					filled += 1;
				}
			}
			await fd.waitForTimeout(300);
			await s.shot(fd, "fill-values");
			return { ok: filled > 0 ? true : null, observed: `filled ${filled}/${n} row input(s)` };
		});

		await step(s, "Create entity from filled form", async () => {
			const rows = await count(fd, ".fd-fill__row");
			if (rows === 0) return { ok: null, observed: "no form to submit" };
			const statusBefore = (
				await fd
					.locator(".fd-status")
					.innerText()
					.catch(() => "")
			).trim();
			await fd
				.locator(".fd-fill__footer button[data-bs-primary]")
				.first()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(1400);
			const statusAfter = (
				await fd
					.locator(".fd-status")
					.innerText()
					.catch(() => "")
			).trim();
			await s.shot(fd, "after-create");
			return {
				ok: statusAfter.toLowerCase().includes("created"),
				observed: `status "${statusBefore}" → "${statusAfter}"`,
			};
		});

		// --- Verify the created entity surfaces in the Database app ---
		await step(s, "Created entity visible in Database", async () => {
			const db = await s.openApp(APP.Database).catch(() => null);
			if (!db) return { ok: null, observed: "Database app did not open" };
			await db.waitForTimeout(2500);
			const rows = await db
				.locator(".db-grid__row, [role='row'], .db-row")
				.count()
				.catch(() => 0);
			await s.shot(db, "database-after-create");
			return { ok: rows > 0 ? true : null, observed: `Database shows ${rows} row element(s)` };
		});

		// =========================== HEADER ⋯ MENU ===========================

		await step(s, "Header ⋯ More-actions menu opens", async () => {
			await fd
				.locator(".bs-object-menu__more")
				.first()
				.click()
				.catch(() => undefined);
			await fd.waitForTimeout(500);
			const items = await count(fd, ".fm-row");
			await s.shot(fd, "more-menu");
			return { ok: items > 0, observed: `${items} menu item(s)` };
		});
		await step(s, "Header ⋯ → 'New form' resets the builder", async () => {
			const item = fd.locator(".fm-row", { hasText: "New form" }).first();
			if ((await item.count().catch(() => 0)) === 0) {
				await fd.keyboard.press("Escape").catch(() => undefined);
				return { ok: false, observed: "'New form' item not in menu" };
			}
			await item.click().catch(() => undefined);
			await fd.waitForTimeout(600);
			// New form switches to Builder with an empty name input.
			const onBuilder = await fd
				.locator(".fd-mode__tab[aria-selected='true']")
				.innerText()
				.catch(() => "");
			const nameVal = await fd
				.locator(".fd-builder .fd-input")
				.first()
				.inputValue()
				.catch(() => "?");
			return {
				ok: onBuilder.toLowerCase().includes("builder") && nameVal === "",
				observed: `tab="${onBuilder.trim()}" name input="${nameVal}"`,
			};
		});

		// =========================== PERSISTENCE ===========================

		await step(s, "Persistence — reopen Form Designer, saved form present", async () => {
			await fd.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(800);
			const reopened = await s.openApp(APP.FormDesigner);
			await reopened.waitForTimeout(3000);
			const inSidebar = await reopened
				.locator(".fd-sidebar__item", { hasText: formName })
				.count()
				.catch(() => 0);
			const allItems = await reopened
				.locator(".fd-sidebar__item")
				.count()
				.catch(() => 0);
			await s.shot(reopened, "reopened-sidebar");
			return {
				ok: inSidebar > 0,
				observed: `saved form "${formName}" present=${inSidebar > 0}; total sidebar items=${allItems}`,
			};
		});
	} finally {
		await s.finish();
	}
});
