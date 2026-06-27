/**
 * Session 351 — Mira tries to set up email in Mailbox (in-flight-app probe).
 *
 * Mira turn (after Marcus 350). Mailbox is in-flight; without a connected
 * account there's no mail, so the surface that actually matters for a new user
 * is the **connect flow** — the first wall every Mailbox user hits. Mira opens
 * Mailbox, reads the empty state, and walks the Connect dialog (Google OAuth +
 * IMAP/SMTP modes) as far as a credential-less run can — capturing what the app
 * asks her for. No real account is connected (no creds), so this is a design +
 * onboarding probe, not a sync test. Per the loop protocol the spec records
 * intent + neutral observations; the verdict is decided from the captures.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Mira sets up email — Mailbox connect flow (351)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("351-mira-mailbox-connect");
	s.chat(
		SPEAKER.Mira,
		"Want my email in here too. Opening Mailbox to connect an account — let's see what it asks me for and how clear the setup is for someone who just wants their inbox.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const mail = await s.openApp(APP.Mailbox);
		await mail.waitForTimeout(1800);
		await s.shot(mail, "01-empty-state");

		const inv = await mail.evaluate(() => {
			const labels = new Set<string>();
			for (const el of [...document.querySelectorAll("[aria-label]")].slice(
				0,
				50,
			))
				labels.add(el.getAttribute("aria-label") ?? "");
			const buttons = [...document.querySelectorAll("button")]
				.map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
				.filter(Boolean)
				.slice(0, 30);
			const bodyText = (document.body.innerText ?? "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 240);
			return { labels: [...labels], buttons, bodyText };
		});
		s.note(`=== aria-labels === ${JSON.stringify(inv.labels)}`);
		s.note(`=== buttons === ${JSON.stringify(inv.buttons)}`);
		s.note(`=== body text === ${inv.bodyText}`);

		// Open the connect dialog from the empty-state CTA.
		const connect = mail.locator(
			'button:has-text("Connect Gmail"), button:has-text("Connect")',
		);
		if ((await connect.count().catch(() => 0)) > 0) {
			await connect
				.first()
				.click()
				.catch(() => undefined);
			await mail.waitForTimeout(900);
			await s.shot(mail, "02-connect-google");
			const dialogText = (
				await mail
					.locator('[role="dialog"], .bs-popover, .bs-dialog')
					.first()
					.innerText()
					.catch(() => "")
			)
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 400);
			s.note(`connect dialog (Google) asks for: ${dialogText}`);

			// Switch to IMAP / SMTP mode if the dialog offers it.
			const imap = mail.locator(
				'button:has-text("IMAP"), label:has-text("IMAP"), [role="tab"]:has-text("IMAP")',
			);
			if ((await imap.count().catch(() => 0)) > 0) {
				await imap
					.first()
					.click()
					.catch(() => undefined);
				await mail.waitForTimeout(600);
				await s.shot(mail, "03-connect-imap");
				s.note("switched the connect dialog to IMAP/SMTP mode");
			} else {
				s.note("no IMAP mode switch found in the connect dialog");
			}

			// Close without connecting (no real credentials).
			await mail.keyboard.press("Escape").catch(() => undefined);
			await mail.waitForTimeout(300);
		} else {
			s.note("\nno Connect affordance found on the Mailbox empty state");
		}

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(
			errors,
			"no console/page errors walking the Mailbox connect flow",
		).toEqual([]);
	} finally {
		await s.finish();
	}
});
