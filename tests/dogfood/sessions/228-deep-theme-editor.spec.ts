/**
 * Session 228 — Deep Theme Editor walkthrough. Exercises the real Theme Editor
 * surface end-to-end the way a founder customising their workspace would:
 *
 *  • the base-theme select (Midnight / Sepia / …) — change it, confirm the
 *    token base column + live preview re-paint;
 *  • every tab — Token set / Icon pack / Typography / Style pack — confirm the
 *    editor pane content actually swaps;
 *  • edit a colour token (type a new hex into a token input) and confirm the
 *    docked LIVE PREVIEW panel re-paints to that value (the core promise:
 *    "preview updates instantly");
 *  • pick a different icon pack (or note Phosphor-only when none installed);
 *  • change a typography setting (density scale) and watch the preview text;
 *  • interact with the Style pack tab, noting whether it's gated;
 *  • name the theme + Save, then confirm it lands in the theme select;
 *  • open the header ⋯ "More actions" menu and click an item;
 *  • record the missing-dependency banner if it appears;
 *  • PERSISTENCE — reopen the app and confirm the saved theme is still listed.
 *
 * Every action is judged from observable DOM and narrated as
 * `[PASS]/[FAIL]/[?] <action> — <observed>` via s.note(). Each step is wrapped
 * in try/catch so a single failure never aborts the walkthrough.
 *
 * F-234 note: Theme Editor has no Back/Forward navigation in its header — the
 * header composition is recorded below.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep theme-editor walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-theme-editor");

	// A unique theme name so the persistence check can find exactly our save.
	const themeName = `Founder Theme ${Date.now()}`;
	// A vivid, unambiguous colour so the preview-repaint assertion is decisive.
	const NEW_HEX = "#ff00aa";

	try {
		const page = await s.openApp(APP.ThemeEditor);
		await page.waitForTimeout(2600);

		// ── Header composition (F-234) — record what chrome the header actually
		// has (title + ⋯ only; no Back/Forward nav).
		try {
			const headerHtml = await page
				.locator('[data-testid="app-header"]')
				.innerHTML()
				.catch(() => "");
			const hasTitle = headerHtml.includes("app-header__title");
			const hasMore =
				headerHtml.includes("bs-object-menu__more") || headerHtml.includes("te-header__more");
			const hasBack = /aria-label="[^"]*[Bb]ack/.test(headerHtml);
			const hasForward = /aria-label="[^"]*[Ff]orward/.test(headerHtml);
			s.note(
				`[?] header composition (F-234) — title=${hasTitle} moreMenu=${hasMore} back=${hasBack} forward=${hasForward} (no nav expected)`,
			);
		} catch (err) {
			s.note(`[FAIL] header composition probe — ${(err as Error).message}`);
		}
		await s.shot(page, "00-opened");

		// ── Initial state: read the current base-theme select label, the first
		// token value, and a preview swatch so later changes are diffable.
		const selectBtn = page.locator(".te-toolbar__select").first();
		const firstTokenInput = page.locator(".te-row__value").first();
		const previewRoot = page.locator(".te-preview").first();

		const initialSelectLabel = await selectBtn.innerText().catch(() => "");
		s.note(`[?] initial base-theme label — "${initialSelectLabel}"`);

		const readPreviewBg = async (): Promise<string> =>
			previewRoot.evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => "");
		const readFirstToken = async (): Promise<string> => firstTokenInput.inputValue().catch(() => "");

		const initialPreviewBg = await readPreviewBg();
		const initialFirstToken = await readFirstToken();
		s.note(`[?] initial preview bg="${initialPreviewBg}" firstToken="${initialFirstToken}"`);

		// ─────────────────────────────────────────────────────────────────────
		// 1) BASE-THEME SELECT — switch to a different built-in (Midnight, else
		//    the first non-current option) and assert tokens + preview update.
		// ─────────────────────────────────────────────────────────────────────
		try {
			await selectBtn.click();
			await page.waitForTimeout(600);
			const menu = page.locator(".fm-menu, [role='menu']").first();
			const menuVisible = await menu.isVisible().catch(() => false);
			await s.shot(page, "01-theme-select-open");

			if (!menuVisible) {
				s.note("[FAIL] base-theme select — menu did not open");
			} else {
				// Prefer Midnight; fall back to any item whose label differs from
				// the current selection.
				const items = menu.locator("[role='menuitem'], .fm-menu__item, button");
				const n = await items.count();
				let chosenLabel = "";
				let clicked = false;
				for (const target of ["Midnight", "Sepia", "Solar", "High Contrast", "Default Light"]) {
					const opt = menu.getByText(target, { exact: true }).first();
					if ((await opt.count()) > 0 && target !== initialSelectLabel.trim()) {
						chosenLabel = target;
						await opt.click().catch(() => undefined);
						clicked = true;
						break;
					}
				}
				if (!clicked && n > 0) {
					const opt = items.nth(Math.min(1, n - 1));
					chosenLabel = (await opt.innerText().catch(() => "")).trim();
					await opt.click().catch(() => undefined);
					clicked = true;
				}
				await page.waitForTimeout(900);

				const newSelectLabel = (await selectBtn.innerText().catch(() => "")).trim();
				const newPreviewBg = await readPreviewBg();
				const newFirstToken = await readFirstToken();
				const labelChanged = newSelectLabel !== initialSelectLabel.trim();
				const previewChanged = newPreviewBg !== initialPreviewBg;
				const tokenChanged = newFirstToken !== initialFirstToken;
				const verdict = labelChanged && (previewChanged || tokenChanged) ? "PASS" : "FAIL";
				s.note(
					`[${verdict}] switch base theme → "${chosenLabel || newSelectLabel}" — label "${initialSelectLabel.trim()}"→"${newSelectLabel}", preview "${initialPreviewBg}"→"${newPreviewBg}", firstToken "${initialFirstToken}"→"${newFirstToken}"`,
				);
				await s.shot(page, "02-after-base-theme-switch");
			}
		} catch (err) {
			s.note(`[FAIL] base-theme select — ${(err as Error).message}`);
			await page.keyboard.press("Escape").catch(() => undefined);
		}

		// Re-baseline the token/preview readings after the base switch.
		const baseFirstToken = await readFirstToken();
		const basePreviewBg = await readPreviewBg();

		// ─────────────────────────────────────────────────────────────────────
		// 2) TABS — switch through every tab and assert the pane content swaps.
		//    TokenSet → .te-grid, IconPack → .te-packs, Typography → .te-typo,
		//    StylePack → .te-stylepack.
		// ─────────────────────────────────────────────────────────────────────
		const tabPanes: Array<{ label: string; pane: string }> = [
			{ label: "Token set", pane: ".te-grid" },
			{ label: "Icon pack", pane: ".te-packs" },
			{ label: "Typography", pane: ".te-typo" },
			{ label: "Style pack", pane: ".te-stylepack" },
		];
		for (const { label, pane } of tabPanes) {
			try {
				const tab = page.locator("[role='tab']", { hasText: label }).first();
				await tab.click();
				await page.waitForTimeout(500);
				const selected = (await tab.getAttribute("aria-selected").catch(() => "")) === "true";
				const paneVisible = await page
					.locator(pane)
					.first()
					.isVisible()
					.catch(() => false);
				const verdict = selected && paneVisible ? "PASS" : "FAIL";
				s.note(
					`[${verdict}] tab "${label}" — aria-selected=${selected}, pane ${pane} visible=${paneVisible}`,
				);
				await s.shot(page, `03-tab-${label.toLowerCase().replace(/\s+/g, "-")}`);
			} catch (err) {
				s.note(`[FAIL] tab "${label}" — ${(err as Error).message}`);
			}
		}

		// ─────────────────────────────────────────────────────────────────────
		// 3) EDIT A COLOUR TOKEN — back on Token set, type a new hex into the
		//    first token's text input and assert the live preview re-paints.
		//    This is the core "preview updates instantly" promise.
		// ─────────────────────────────────────────────────────────────────────
		try {
			await page.locator("[role='tab']", { hasText: "Token set" }).first().click();
			await page.waitForTimeout(400);

			// Prefer a token that drives the preview background so the assertion is
			// visible; `--color-background-primary` is the first family member.
			const bgInput = page.locator('.te-row__value[aria-label="--color-background-primary"]').first();
			const targetInput = (await bgInput.count()) > 0 ? bgInput : firstTokenInput;
			const targetName = (await targetInput.getAttribute("aria-label").catch(() => "")) ?? "";

			const beforeBg = await readPreviewBg();
			await targetInput.click();
			await targetInput.fill("");
			await targetInput.fill(NEW_HEX);
			await page.keyboard.press("Tab"); // commit + blur
			await page.waitForTimeout(700);

			const afterValue = await targetInput.inputValue().catch(() => "");
			const afterBg = await readPreviewBg();
			// Read the actual painted var on the preview root, the truest signal.
			const paintedVar = await previewRoot
				.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), targetName)
				.catch(() => "");
			const valueAccepted = afterValue.toLowerCase().includes("ff00aa");
			const previewRepainted = afterBg !== beforeBg || paintedVar.toLowerCase().includes("ff00aa");
			const verdict = valueAccepted && previewRepainted ? "PASS" : "FAIL";
			s.note(
				`[${verdict}] edit colour token "${targetName}"=${NEW_HEX} — input now "${afterValue}", preview bg "${beforeBg}"→"${afterBg}", painted var="${paintedVar}"`,
			);
			await s.shot(page, "04-token-edited-preview-repaint");

			// Reset the token so we don't poison the persisted theme's base look
			// (Save below should still capture the override, but reset keeps the
			// preview readable for later screenshots — the override is recorded).
			const resetBtn = page.locator(".te-row--overridden .te-row__reset").first();
			if ((await resetBtn.count()) > 0) {
				// Leave it overridden so Save persists a real token-set entity;
				// just note the reset affordance is present.
				s.note("[?] token reset affordance present on overridden row");
			}
		} catch (err) {
			s.note(`[FAIL] edit colour token — ${(err as Error).message}`);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 3b) COLOUR-PICKER swatch — open the rich picker from a token swatch and
		//     confirm it mounts (alternate edit path to the text input).
		// ─────────────────────────────────────────────────────────────────────
		try {
			const swatch = page.locator(".te-row__swatch").first();
			if ((await swatch.count()) > 0) {
				await swatch.click();
				await page.waitForTimeout(500);
				const pickerVisible = await page
					.locator(".bs-color-picker")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(
					`[${pickerVisible ? "PASS" : "FAIL"}] colour-picker swatch — picker mounted=${pickerVisible}`,
				);
				await s.shot(page, "05-color-picker");
				// Cancel out so we don't change the token via this path.
				const cancel = page.locator(".bs-color-picker__btn", { hasText: "Cancel" }).first();
				if ((await cancel.count()) > 0) await cancel.click().catch(() => undefined);
				else await page.keyboard.press("Escape").catch(() => undefined);
				await page.waitForTimeout(300);
			} else {
				s.note("[?] colour-picker swatch — no swatch row found to open the picker");
			}
		} catch (err) {
			s.note(`[FAIL] colour-picker swatch — ${(err as Error).message}`);
			await page.keyboard.press("Escape").catch(() => undefined);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 4) ICON PACK — pick a different pack and assert the preview icons
		//    change; note when only the built-in Phosphor pack is installed.
		// ─────────────────────────────────────────────────────────────────────
		try {
			await page.locator("[role='tab']", { hasText: "Icon pack" }).first().click();
			await page.waitForTimeout(500);
			const packs = page.locator(".te-pack");
			const packCount = await packs.count();
			s.note(`[?] icon packs available — ${packCount}`);

			// Snapshot a preview icon (the sample window header glyph) before.
			const previewIconBefore = await previewRoot
				.locator(".te-mini-window__titlebar svg, .te-mini-tile__face svg")
				.first()
				.innerHTML()
				.catch(() => "");

			if (packCount <= 1) {
				const hint = await page
					.locator(".te-packs__hint")
					.first()
					.innerText()
					.catch(() => "");
				s.note(`[?] icon pack — only built-in Phosphor installed (gated): "${hint}"`);
			} else {
				const other = packs.nth(1);
				const otherName = (await other.innerText().catch(() => "")).trim();
				await other.click();
				await page.waitForTimeout(700);
				const checked = (await other.getAttribute("aria-checked").catch(() => "")) === "true";
				const previewIconAfter = await previewRoot
					.locator(".te-mini-window__titlebar svg, .te-mini-tile__face svg")
					.first()
					.innerHTML()
					.catch(() => "");
				const iconsChanged = previewIconAfter !== previewIconBefore;
				const verdict = checked ? (iconsChanged ? "PASS" : "?") : "FAIL";
				s.note(
					`[${verdict}] pick icon pack "${otherName}" — aria-checked=${checked}, preview icon changed=${iconsChanged}`,
				);
			}
			await s.shot(page, "06-icon-pack");
		} catch (err) {
			s.note(`[FAIL] icon pack — ${(err as Error).message}`);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 5) TYPOGRAPHY — change the density scale via its menu + edit a font
		//    stack, then confirm the preview text re-renders.
		// ─────────────────────────────────────────────────────────────────────
		try {
			await page.locator("[role='tab']", { hasText: "Typography" }).first().click();
			await page.waitForTimeout(500);

			const previewFontBefore = await previewRoot
				.locator(".te-mini-doc__body")
				.first()
				.evaluate((el) => getComputedStyle(el).fontFamily)
				.catch(() => "");

			// Density scale — open the anchored menu and pick "Compact".
			const scaleBtn = page.locator(".te-typo__scale").first();
			const scaleBefore = (await scaleBtn.innerText().catch(() => "")).trim();
			await scaleBtn.click();
			await page.waitForTimeout(500);
			const scaleMenu = page.locator(".fm-menu, [role='menu']").first();
			const target = scaleBefore === "Compact" ? "Comfortable" : "Compact";
			const scaleOpt = scaleMenu.getByText(target, { exact: true }).first();
			let scaleChanged = false;
			if ((await scaleOpt.count()) > 0) {
				await scaleOpt.click();
				await page.waitForTimeout(600);
				const scaleAfter = (await scaleBtn.innerText().catch(() => "")).trim();
				scaleChanged = scaleAfter !== scaleBefore && scaleAfter === target;
				s.note(`[${scaleChanged ? "PASS" : "FAIL"}] density scale — "${scaleBefore}"→"${scaleAfter}"`);
			} else {
				await page.keyboard.press("Escape").catch(() => undefined);
				s.note("[FAIL] density scale — menu option not found");
			}

			// Edit a font-family stack and confirm the preview body font re-renders.
			const stackInput = page.locator(".te-typo__stack").first();
			if ((await stackInput.count()) > 0) {
				await stackInput.click();
				await stackInput.fill("Georgia, serif");
				await page.keyboard.press("Tab");
				await page.waitForTimeout(700);
				const previewFontAfter = await previewRoot
					.locator(".te-mini-doc__body")
					.first()
					.evaluate((el) => getComputedStyle(el).fontFamily)
					.catch(() => "");
				const fontChanged = previewFontAfter !== previewFontBefore;
				// The body role may not be the UI role; treat any preview text
				// font-family delta as a pass, else note observed values.
				s.note(
					`[${fontChanged ? "PASS" : "?"}] typography font stack — preview body font "${previewFontBefore}"→"${previewFontAfter}"`,
				);
			}
			await s.shot(page, "07-typography");
		} catch (err) {
			s.note(`[FAIL] typography — ${(err as Error).message}`);
			await page.keyboard.press("Escape").catch(() => undefined);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 6) STYLE PACK — type CSS, observe the validator problem list, and note
		//    whether "Edit in Code Editor" is gated (disabled until saved).
		// ─────────────────────────────────────────────────────────────────────
		try {
			await page.locator("[role='tab']", { hasText: "Style pack" }).first().click();
			await page.waitForTimeout(500);

			const cssArea = page.locator(".te-stylepack__css").first();
			const stylePackVisible = await cssArea.isVisible().catch(() => false);
			if (stylePackVisible) {
				await cssArea.click();
				await cssArea.fill('[data-bs-region="app-header"] {\n  border-bottom-width: 3px;\n}');
				await page.waitForTimeout(600);
				const cssValue = await cssArea.inputValue().catch(() => "");
				const accepted = cssValue.includes("border-bottom-width");
				const problems = await page
					.locator(".te-stylepack__problem")
					.allInnerTexts()
					.catch(() => []);
				s.note(`[${accepted ? "PASS" : "FAIL"}] style pack CSS edit — value accepted=${accepted}`);
				s.note(
					`[?] style pack validator — ${problems.length} problem row(s): ${JSON.stringify(problems)}`,
				);

				const openBtn = page.locator(".te-stylepack__open").first();
				const disabled = await openBtn.isDisabled().catch(() => true);
				s.note(
					`[?] style pack "Edit in Code Editor" — disabled(before save)=${disabled} (gated on save: expected true)`,
				);
			} else {
				s.note("[FAIL] style pack — CSS editor not visible");
			}
			await s.shot(page, "08-style-pack");
		} catch (err) {
			s.note(`[FAIL] style pack — ${(err as Error).message}`);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 7) NAME + SAVE — name the theme, click Save, and assert it lands in the
		//    theme select (and the status line confirms).
		// ─────────────────────────────────────────────────────────────────────
		try {
			const nameInput = page.locator(".te-toolbar__name").first();
			await nameInput.click();
			await nameInput.fill(themeName);
			await page.waitForTimeout(300);

			const saveBtn = page.locator(".te-toolbar__save").first();
			await saveBtn.click();
			await page.waitForTimeout(1500);

			const status = (
				await page
					.locator(".te-toolbar__status")
					.first()
					.innerText()
					.catch(() => "")
			).trim();
			const savedOk = /saved/i.test(status);
			s.note(`[${savedOk ? "PASS" : "FAIL"}] save theme — status="${status}"`);
			await s.shot(page, "09-after-save");

			// Confirm the saved theme appears in the select menu.
			await selectBtn.click();
			await page.waitForTimeout(600);
			const menu = page.locator(".fm-menu, [role='menu']").first();
			const listed =
				(await menu
					.getByText(themeName, { exact: true })
					.count()
					.catch(() => 0)) > 0;
			s.note(
				`[${listed ? "PASS" : "FAIL"}] saved theme listed in select — "${themeName}" present=${listed}`,
			);
			await s.shot(page, "10-saved-theme-in-select");
			await page.keyboard.press("Escape").catch(() => undefined);
			await page.waitForTimeout(300);
		} catch (err) {
			s.note(`[FAIL] name + save theme — ${(err as Error).message}`);
			await page.keyboard.press("Escape").catch(() => undefined);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 8) HEADER ⋯ "More actions" — open the menu and click an item.
		// ─────────────────────────────────────────────────────────────────────
		try {
			const moreBtn = page.locator(".te-header__more, .bs-object-menu__more").first();
			await moreBtn.click();
			await page.waitForTimeout(600);
			const menu = page.locator(".fm-menu, [role='menu']").first();
			const opened = await menu.isVisible().catch(() => false);
			const expanded = (await moreBtn.getAttribute("aria-expanded").catch(() => "")) === "true";
			const items = await menu
				.locator("[role='menuitem'], .fm-menu__item, button")
				.allInnerTexts()
				.catch(() => []);
			s.note(
				`[${opened ? "PASS" : "FAIL"}] header ⋯ menu — opened=${opened} aria-expanded=${expanded}`,
			);
			s.note(`[?] header ⋯ items — ${JSON.stringify(items)}`);
			await s.shot(page, "11-more-actions-menu");

			// Click "Preview across shell" if present (it paints + reverts).
			const previewItem = menu.getByText("Preview across shell", { exact: false }).first();
			if ((await previewItem.count()) > 0) {
				await previewItem.click();
				await page.waitForTimeout(1200);
				const status = (
					await page
						.locator(".te-toolbar__status")
						.first()
						.innerText()
						.catch(() => "")
				).trim();
				s.note(`[?] clicked "Preview across shell" — status="${status}"`);
				await s.shot(page, "12-after-preview-shell");
			} else {
				await page.keyboard.press("Escape").catch(() => undefined);
				s.note("[?] header ⋯ — 'Preview across shell' not offered (no theme service?)");
			}
		} catch (err) {
			s.note(`[FAIL] header ⋯ menu — ${(err as Error).message}`);
			await page.keyboard.press("Escape").catch(() => undefined);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 9) MISSING-DEPENDENCY BANNER — record if it ever appears.
		// ─────────────────────────────────────────────────────────────────────
		try {
			const banner = page.locator(".te-banner").first();
			const bannerVisible = await banner.isVisible().catch(() => false);
			if (bannerVisible) {
				const text = await banner.innerText().catch(() => "");
				s.note(`[?] missing-dependency banner shown — "${text.replace(/\s+/g, " ").slice(0, 160)}"`);
				await s.shot(page, "13-dependency-banner");
			} else {
				s.note("[?] missing-dependency banner — not shown (no unresolved component refs)");
			}
		} catch (err) {
			s.note(`[FAIL] dependency banner probe — ${(err as Error).message}`);
		}

		// ─────────────────────────────────────────────────────────────────────
		// 10) PERSISTENCE — reopen the app and confirm the saved theme is listed.
		// ─────────────────────────────────────────────────────────────────────
		try {
			const reopened = await s.openApp(APP.ThemeEditor);
			await reopened.waitForTimeout(2600);
			await s.shot(reopened, "14-reopened");

			const reSelect = reopened.locator(".te-toolbar__select").first();
			await reSelect.click();
			await reopened.waitForTimeout(700);
			const reMenu = reopened.locator(".fm-menu, [role='menu']").first();
			const stillListed =
				(await reMenu
					.getByText(themeName, { exact: true })
					.count()
					.catch(() => 0)) > 0;
			s.note(
				`[${stillListed ? "PASS" : "FAIL"}] persistence after reopen — "${themeName}" present=${stillListed}`,
			);
			await s.shot(reopened, "15-persistence-select");

			// Load it back and confirm the editor adopts the saved theme name.
			if (stillListed) {
				await reMenu
					.getByText(themeName, { exact: true })
					.first()
					.click()
					.catch(() => undefined);
				await reopened.waitForTimeout(1000);
				const loadedName = (
					await reopened
						.locator(".te-toolbar__name")
						.first()
						.inputValue()
						.catch(() => "")
				).trim();
				const loadedOk = loadedName === themeName;
				s.note(`[${loadedOk ? "PASS" : "?"}] reload saved theme — name input="${loadedName}"`);
				await s.shot(reopened, "16-reloaded-theme");
			} else {
				await reopened.keyboard.press("Escape").catch(() => undefined);
			}
		} catch (err) {
			s.note(`[FAIL] persistence reopen — ${(err as Error).message}`);
		}

		s.note("\n— deep theme-editor walkthrough complete —");
	} finally {
		await s.finish();
	}
});
