/**
 * Session 908 — Marcus design-reviews the Mailbox (specialist catch-up turn).
 *
 * Marcus has never reviewed Mailbox — it shipped its whole account-management
 * arc (Mailbox-10..13: rail accounts + ⋯ menus, error banner + Reconnect,
 * neutral connect surfaces, sync-window picker, Load older) after his last
 * rotation (#350). The owner has been finding the design gaps himself; this
 * session puts Marcus's lens on every state that arc created.
 *
 * The walkthrough deliberately CREATES a broken IMAP account (unreachable
 * loopback host via the real dialog) — that exercises the failure chrome the
 * owner kept hitting (banner, rail row, Edit connection…) and doubles as the
 * standing mail fixture the dogfood vault lacked. It stays in the vault.
 *
 * Spec only navigates + captures + inventories; Marcus's substantiated
 * friction is written from the screenshots afterward (never in-spec).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Marcus design-reviews the Mailbox — connect states, failure chrome, list (908)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("908-marcus-mailbox-design-review");
	s.chat(
		SPEAKER.Marcus,
		"Mailbox never crossed my desk and apparently it grew a whole account-management story while I wasn't looking. I'm going in skeptical: empty state, both connect forms, and — since mail servers fail — every pixel of the failure chrome.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const mail = await s.openApp(APP.Mailbox);
		await mail.waitForTimeout(1800);
		await s.shot(mail, "01-first-impression");

		// ── The empty/connect state (or the rail, if an account already exists).
		const connectCta = mail.locator("button", { hasText: "Connect account" });
		const hasCta = (await connectCta.count().catch(() => 0)) > 0;
		s.note(`connect CTA visible: ${hasCta}`);

		// ── Connect dialog, both tabs.
		if (hasCta) {
			await connectCta.first().click();
		} else {
			// ⋯ menu → Connect mail account…
			await mail.locator(".bs-object-menu__more").last().click();
			await mail.locator("text=Connect mail account").first().click().catch(() => undefined);
		}
		await mail.waitForTimeout(600);
		await s.shot(mail, "02-connect-dialog-google");

		const imapTab = mail.locator("button", { hasText: "IMAP / SMTP" });
		if ((await imapTab.count().catch(() => 0)) > 0) {
			await imapTab.first().click();
			await mail.waitForTimeout(400);
			await s.shot(mail, "03-connect-dialog-imap");

			// Inventory the form controls — Marcus reads alignment/face from the
			// screenshot; the inventory pins what exists for the notes.
			const inv = await mail.evaluate(() => {
				const dialog = document.querySelector("[data-testid=mb-connect]") ?? document.body;
				const labels = [...dialog.querySelectorAll("label span, .mb-connect__label")]
					.map((el) => (el.textContent ?? "").trim())
					.filter(Boolean)
					.slice(0, 20);
				const buttons = [...dialog.querySelectorAll("button")]
					.map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 20);
				return { labels, buttons };
			});
			s.note(`=== imap form labels === ${JSON.stringify(inv.labels)}`);
			s.note(`=== imap form buttons === ${JSON.stringify(inv.buttons)}`);

			// ── Create the standing BROKEN fixture: unreachable loopback host.
			const fields = mail.locator("[data-testid=mb-connect] input");
			const setByIndex = async (index: number, value: string) => {
				await fields.nth(index).fill(value).catch(() => undefined);
			};
			// Order per the form: address, username, password, imap host, imap
			// port, smtp host, smtp port (checkbox inputs are not <input type=text>
			// but fill() on a checkbox would throw — caught above).
			const texts = mail.locator(
				'[data-testid=mb-connect] input[type="text"], [data-testid=mb-connect] input[type="search"], [data-testid=mb-connect] input:not([type])',
			);
			await texts.nth(0).fill("marcus.fixture@example.test").catch(() => undefined);
			await mail
				.locator('[data-testid=mb-connect] input[type="password"]')
				.first()
				.fill("not-a-real-password")
				.catch(() => undefined);
			// IMAP + SMTP hosts → loopback ports nothing listens on.
			const hostInputs = texts;
			const hostCount = await hostInputs.count();
			s.note(`text inputs in dialog: ${hostCount}`);
			// address(0), username(1), imap host(2), imap port(3), smtp host(4), smtp port(5)
			await hostInputs.nth(2).fill("127.0.0.1").catch(() => undefined);
			await hostInputs.nth(3).fill("59993").catch(() => undefined);
			await hostInputs.nth(4).fill("127.0.0.1").catch(() => undefined);
			await hostInputs.nth(5).fill("59465").catch(() => undefined);
			await s.shot(mail, "04-imap-filled");

			await mail
				.locator("[data-testid=mb-connect] button[type=submit]")
				.click()
				.catch(() => undefined);
			// connect creates the account; the first sync then fails against the
			// dead loopback — give it time to surface the failure chrome.
			await mail.waitForTimeout(12_000);
			await s.shot(mail, "05-failure-chrome");

			// ── The rail account row + its ⋯ menu.
			const railMenu = mail.locator(".mb-rail__heading-menu");
			if ((await railMenu.count().catch(() => 0)) > 0) {
				await railMenu.first().hover().catch(() => undefined);
				await mail.waitForTimeout(300);
				await railMenu.first().click().catch(() => undefined);
				await mail.waitForTimeout(500);
				await s.shot(mail, "06-account-menu");
				// Edit connection… → the prefilled reconnect dialog.
				await mail
					.locator("text=Edit connection")
					.first()
					.click()
					.catch(() => undefined);
				await mail.waitForTimeout(600);
				await s.shot(mail, "07-reconnect-prefilled");
				await mail.keyboard.press("Escape").catch(() => undefined);
			} else {
				s.note("no rail account ⋯ found — capture 05 shows whatever state resulted");
			}

			// ── The list area + footer affordance state with zero messages.
			await s.shot(mail, "08-list-after-failure");
		}

		s.note(`=== console errors (${errors.length}) ===`);
		for (const e of errors.slice(0, 20)) s.note(e);

		s.chat(
			SPEAKER.Marcus,
			"Captured the whole arc — empty state, both connect forms, a real failure, the account menu, and the pre-filled repair dialog. Writing up what holds and what drifts.",
		);
	} finally {
		await s.close();
	}
});
