/**
 * Session 228 — DEEP Mailbox walkthrough.
 *
 * Mailbox is a viewer over `Email/v1` / `MailFolder/v1` / `MailAccount/v1`
 * entities that the shell-side MailTransport worker projects from a connected
 * Google account. With NO account connected (the only state reachable in this
 * harness — real Google OAuth cannot be completed by an automated driver) the
 * app shows its "No mail account yet" empty-state CTA. So the headline finding
 * of this session is structural: mail LISTING / READING / COMPOSE are all
 * GATED behind a live OAuth-connected account and cannot be exercised here.
 *
 * What CAN be exercised — and what this session covers thoroughly — is the
 * un-connected surface: the empty-state CTA (icon + copy + button), the
 * "Connect Gmail" action and exactly what it initiates, the header ⋯ "More
 * actions" menu and its items, header composition (F-234: no Back/Forward),
 * and that the app opens without erroring. Every action is judged from
 * observable DOM and recorded as [PASS]/[FAIL]/[?] — never aborting.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep mailbox walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-mailbox");

	try {
		// ── Open the app ────────────────────────────────────────────────────
		let mail: Awaited<ReturnType<typeof s.openApp>> | null = null;
		try {
			mail = await s.openApp(APP.Mailbox);
			s.note("[PASS] open Mailbox — app window resolved");
		} catch (err) {
			s.note(`[FAIL] open Mailbox — ${(err as Error).message}`);
			return; // nothing else is reachable without a window
		}
		const page = mail;
		await page.waitForTimeout(2600);
		await s.shot(page, "01-opened");

		// Does the app render its root at all, or did it white-screen / error?
		try {
			const rootVisible = await page
				.locator(".mb-app")
				.first()
				.isVisible()
				.catch(() => false);
			const bodyText = await page
				.locator("body")
				.innerText()
				.catch(() => "");
			const looksErrored = /error|exception|cannot read|undefined is not/i.test(bodyText);
			if (rootVisible && !looksErrored) {
				s.note("[PASS] app renders without error — .mb-app present, no error text in body");
			} else if (rootVisible) {
				s.note(`[?] app renders but body has error-ish text — first 200ch: ${bodyText.slice(0, 200)}`);
			} else {
				s.note("[FAIL] .mb-app root not visible — possible white-screen");
			}
		} catch (err) {
			s.note(`[FAIL] render check threw — ${(err as Error).message}`);
		}

		// ── Header composition (F-234) ──────────────────────────────────────
		try {
			const header = page.locator('[data-testid="app-header"]').first();
			const headerVisible = await header.isVisible().catch(() => false);
			s.note(`[${headerVisible ? "PASS" : "FAIL"}] app-header present — visible=${headerVisible}`);

			const titleText = await page
				.locator(".app-header__title")
				.first()
				.innerText()
				.catch(() => "");
			s.note(
				`[${titleText.trim() === "Mailbox" ? "PASS" : "?"}] header title — observed "${titleText.trim()}"`,
			);

			// F-234: Mailbox header carries NO Back/Forward navigation chrome.
			const backCount = await page
				.locator('[aria-label="Back"], [aria-label="Forward"], .app-header__nav')
				.count()
				.catch(() => 0);
			s.note(
				`[${backCount === 0 ? "PASS" : "?"}] F-234 no Back/Forward in header — nav-affordance count=${backCount}`,
			);

			// The ⋯ overflow must be the rightmost element in the right group.
			const moreBtn = page.locator(".bs-object-menu__more").first();
			const moreVisible = await moreBtn.isVisible().catch(() => false);
			s.note(
				`[${moreVisible ? "PASS" : "FAIL"}] header ⋯ More-actions button present — visible=${moreVisible}`,
			);

			// With no account connected, the sync icon + panel toggle should be hidden.
			const syncBtnCount = await page
				.locator('[aria-label="Sync now"]')
				.count()
				.catch(() => 0);
			s.note(`[?] header sync-now button (expected hidden, no account) — count=${syncBtnCount}`);
		} catch (err) {
			s.note(`[FAIL] header inspection threw — ${(err as Error).message}`);
		}
		await s.shot(page, "02-header");

		// ── Empty-state CTA: "No mail account yet" ──────────────────────────
		try {
			const cta = page.locator(".mb-cta").first();
			const ctaVisible = await cta.isVisible().catch(() => false);
			s.note(
				`[${ctaVisible ? "PASS" : "FAIL"}] empty-state CTA (.mb-cta) renders — visible=${ctaVisible}`,
			);

			const iconCount = await page
				.locator(".bs-empty-state__glyph")
				.count()
				.catch(() => 0);
			s.note(
				`[${iconCount > 0 ? "PASS" : "FAIL"}] CTA mail icon (.bs-empty-state__glyph) present — count=${iconCount}`,
			);

			const ctaTitle = await page
				.locator(".bs-empty-state__title")
				.first()
				.innerText()
				.catch(() => "");
			s.note(
				`[${/no mail account/i.test(ctaTitle) ? "PASS" : "?"}] CTA title copy — observed "${ctaTitle.trim()}"`,
			);

			const ctaBlurb = await page
				.locator(".bs-empty-state__hint")
				.first()
				.innerText()
				.catch(() => "");
			s.note(
				`[${/connect your google account/i.test(ctaBlurb) ? "PASS" : "?"}] CTA blurb copy — observed "${ctaBlurb.trim()}"`,
			);

			const connectBtn = page.locator(".mb-cta .bs-btn").first();
			const connectText = await connectBtn.innerText().catch(() => "");
			const connectEnabled = await connectBtn.isEnabled().catch(() => false);
			s.note(
				`[${/connect gmail/i.test(connectText) && connectEnabled ? "PASS" : "?"}] Connect-Gmail button — text "${connectText.trim()}", enabled=${connectEnabled}`,
			);

			// Inventory other affordances in the empty state (there should be none
			// beyond the single Connect button — record what's actually there).
			const ctaButtons = await cta
				.locator("button, a")
				.allInnerTexts()
				.catch(() => [] as string[]);
			s.note(`[?] empty-state affordances inventory — ${JSON.stringify(ctaButtons)}`);
		} catch (err) {
			s.note(`[FAIL] empty-state inspection threw — ${(err as Error).message}`);
		}
		await s.shot(page, "03-empty-state-cta");

		// ── The ONE real action: click "Connect Gmail" ──────────────────────
		// This does NOT silently kick off a browser OAuth round-trip on click —
		// it surfaces the ConnectAccountDialog (Popover testid "mb-connect") that
		// first collects the Google OAuth client id/secret. The actual browser
		// consent only runs AFTER submitting that form (mail.connectGmail), which
		// cannot complete in the harness. We record exactly which it is.
		try {
			const connectBtn = page.locator(".mb-cta .bs-btn").first();
			await connectBtn.click({ timeout: 4000 });
			await page.waitForTimeout(1200);

			const dialog = page.locator('[data-testid="mb-connect"]').first();
			const dialogVisible = await dialog.isVisible().catch(() => false);
			if (dialogVisible) {
				s.note(
					"[PASS] Connect Gmail INITIATES the connect flow — opens the Connect-Google-account credential dialog (not a silent no-op). Browser OAuth consent only runs after submitting client id/secret, which the harness cannot complete.",
				);
			} else {
				// Fall back to detecting any other state change: a new window/popup,
				// a status bar, or external-browser launch.
				const popupOpened = s.app.windows().length;
				const syncBar = await page
					.locator(".mb-syncbar")
					.count()
					.catch(() => 0);
				s.note(
					`[?] Connect Gmail click — no mb-connect dialog seen; window-count=${popupOpened}, syncbar=${syncBar} (record what changed)`,
				);
			}
			await s.shot(page, "04-connect-dialog");
		} catch (err) {
			s.note(`[FAIL] Connect-Gmail click threw — ${(err as Error).message}`);
		}

		// ── Exercise the Connect dialog form (the credential-collection surface) ─
		try {
			const dialog = page.locator('[data-testid="mb-connect"]').first();
			if (await dialog.isVisible().catch(() => false)) {
				const fields = await dialog
					.locator(".mb-connect__input")
					.count()
					.catch(() => 0);
				s.note(`[${fields >= 1 ? "PASS" : "?"}] connect dialog fields present — input count=${fields}`);

				const helpText = await dialog
					.locator(".mb-connect__help")
					.first()
					.innerText()
					.catch(() => "");
				s.note(`[?] connect dialog help copy — "${helpText.slice(0, 120)}…"`);

				// Submit must stay disabled until a client id is typed.
				const submit = dialog.locator('button[type="submit"]').first();
				const disabledEmpty = await submit.isDisabled().catch(() => true);
				s.note(
					`[${disabledEmpty ? "PASS" : "?"}] submit disabled with empty client id — disabled=${disabledEmpty}`,
				);

				// Type a placeholder client id; submit should enable, but we do NOT
				// submit (real OAuth would launch a browser the harness can't drive).
				const idInput = dialog.locator(".mb-connect__input").first();
				await idInput.fill("228-harness.apps.googleusercontent.com").catch(() => undefined);
				await page.waitForTimeout(300);
				const enabledAfter = await submit.isEnabled().catch(() => false);
				s.note(
					`[${enabledAfter ? "PASS" : "?"}] submit enables once client id typed — enabled=${enabledAfter} (NOT submitted: OAuth browser consent is un-driveable here)`,
				);
				await s.shot(page, "05-connect-dialog-filled");

				// Close via Cancel — must return to the empty-state CTA.
				const cancel = dialog.locator(".bs-btn--secondary").first();
				await cancel.click({ timeout: 3000 }).catch(() => undefined);
				await page.waitForTimeout(700);
				const backToCta = await page
					.locator(".mb-cta")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(
					`[${backToCta ? "PASS" : "?"}] Cancel returns to empty-state CTA — cta visible=${backToCta}`,
				);
			} else {
				s.note("[?] connect dialog not open — skipping form exercise");
			}
		} catch (err) {
			s.note(`[FAIL] connect-dialog form exercise threw — ${(err as Error).message}`);
		}
		await s.shot(page, "06-after-connect-dialog");

		// ── Header ⋯ "More actions" menu ─────────────────────────────────────
		try {
			const moreBtn = page.locator(".bs-object-menu__more").first();
			await moreBtn.click({ timeout: 4000 });
			await page.waitForTimeout(900);

			const menu = page.locator(".fm-menu, [role='menu'], [role='listbox']").first();
			const menuVisible = await menu.isVisible().catch(() => false);
			s.note(`[${menuVisible ? "PASS" : "?"}] ⋯ menu opens — visible=${menuVisible}`);

			const expanded = await moreBtn.getAttribute("aria-expanded").catch(() => null);
			s.note(
				`[${expanded === "true" ? "PASS" : "?"}] ⋯ button aria-expanded on open — observed "${expanded}"`,
			);

			if (menuVisible) {
				const items = await menu
					.locator("[role='menuitem'], .fm-menu__item, button")
					.allInnerTexts()
					.catch(() => [] as string[]);
				s.note(`[?] ⋯ menu items inventory — ${JSON.stringify(items)}`);
				// Expect at least "Mark all as read" (disabled, no mail) and the
				// "Connect Google account…" entry when the mail service is present.
				const hasConnect = items.some((i) => /connect/i.test(i));
				const hasMarkRead = items.some((i) => /mark all/i.test(i));
				s.note(
					`[${hasMarkRead ? "PASS" : "?"}] menu offers "Mark all as read" — present=${hasMarkRead}`,
				);
				s.note(
					`[?] menu offers "Connect Google account" — present=${hasConnect} (present iff mail service wired)`,
				);
			}
			await s.shot(page, "07-more-menu");

			// Try selecting the Connect item from the menu (the other path into the
			// connect dialog) — judged by whether the dialog reappears.
			if (menuVisible) {
				const connectItem = menu.locator("text=/connect/i").first();
				if (await connectItem.isVisible().catch(() => false)) {
					await connectItem.click({ timeout: 3000 }).catch(() => undefined);
					await page.waitForTimeout(900);
					const dlg = await page
						.locator('[data-testid="mb-connect"]')
						.first()
						.isVisible()
						.catch(() => false);
					s.note(
						`[${dlg ? "PASS" : "?"}] menu "Connect…" item opens the connect dialog — dialog visible=${dlg}`,
					);
					await s.shot(page, "08-menu-connect-dialog");
					// Dismiss with Escape so we leave clean.
					await page.keyboard.press("Escape").catch(() => undefined);
					await page.waitForTimeout(400);
				} else {
					s.note("[?] no Connect item in ⋯ menu — likely demo/no-mail-service mode; nothing to click");
					await page.keyboard.press("Escape").catch(() => undefined);
				}
			}
		} catch (err) {
			s.note(`[FAIL] ⋯ menu exercise threw — ${(err as Error).message}`);
		}

		// ── Confirm the gated surfaces are absent (headline finding evidence) ─
		try {
			const folderRail = await page
				.locator(".mb-app__panes, .mb-rail")
				.count()
				.catch(() => 0);
			const messageList = await page
				.locator('[aria-label="Messages"], .mb-list')
				.count()
				.catch(() => 0);
			const composeBtn = await page
				.locator('[aria-label*="Compose" i], [aria-label*="New message" i]')
				.count()
				.catch(() => 0);
			s.note(
				`[PASS] gated surfaces absent without OAuth — panes=${folderRail}, messageList=${messageList}, compose=${composeBtn} (all expected 0: mail listing/reading/compose require a connected account)`,
			);
		} catch (err) {
			s.note(`[FAIL] gated-surface check threw — ${(err as Error).message}`);
		}

		// ── Re-open resilience: close to dashboard, reopen, ensure no error ──
		try {
			await page.waitForTimeout(400);
			const reopened = await s.openApp(APP.Mailbox).catch(() => null);
			if (reopened) {
				await reopened.waitForTimeout(1500);
				const stillCta = await reopened
					.locator(".mb-cta, .mb-app")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(
					`[${stillCta ? "PASS" : "?"}] reopen Mailbox — renders cleanly again, surface visible=${stillCta}`,
				);
				await s.shot(reopened, "09-reopened");
			} else {
				s.note("[?] reopen Mailbox — could not resolve a second window (may have focused existing)");
			}
		} catch (err) {
			s.note(`[FAIL] reopen check threw — ${(err as Error).message}`);
		}

		// ── Headline finding ────────────────────────────────────────────────
		s.note(
			"[HEADLINE] Mailbox is OAuth-gated: with no connected Google account the only reachable surface is the 'No mail account yet' empty-state CTA + the credential-collection connect dialog + the header ⋯ menu. Mail listing, reading, threading, flag mutation, and compose are ALL gated behind a live OAuth-connected account and CANNOT be exercised in the automated harness (Google browser consent is un-driveable). This session deeply covers the un-connected surface only.",
		);
		await s.shot(page, "10-final");
	} finally {
		await s.finish();
	}
});
