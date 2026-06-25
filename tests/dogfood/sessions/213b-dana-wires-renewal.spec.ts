/**
 * Session 213b — Dana wires the renewal reminder properly (213's typing
 * landed on the tab, not the capture input — and "Add reminder" no-opped
 * silently on the empty form, which she's filing).
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Dana wires the Beacon renewal reminder (213b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("213b-dana-wires-renewal");
	try {
		const auto = await s.openApp(APP.Automations);
		await auto.waitForTimeout(3000);
		await auto
			.locator('button:has-text("Reminders")')
			.first()
			.click()
			.catch(() => undefined);
		await auto.waitForTimeout(800);
		const subject = auto.locator('input[placeholder*="Remind" i]').first();
		await subject.click();
		await subject.fill("Renewal check — Beacon Analytics (30 days out)");
		const due = auto.locator('input[type="datetime-local"]').first();
		await due.fill("2026-07-13T09:00").catch(() => s.note("datetime fill failed"));
		await s.shot(auto, "01-capture-filled");
		await auto.locator('button:has-text("Add reminder")').first().click();
		await auto.waitForTimeout(1500);
		await s.shot(auto, "02-reminder-listed");
		const listed = await auto
			.locator("main, [class*='list']")
			.first()
			.textContent()
			.catch(() => null);
		s.note(`reminders surface now reads: ${listed?.slice(0, 200)}`);

		// Runs view — her audit trail.
		await auto
			.locator('button:has-text("Runs")')
			.first()
			.click()
			.catch(() => undefined);
		await auto.waitForTimeout(1000);
		await s.shot(auto, "03-runs-view");

		s.chat(
			SPEAKER.Dana,
			"Renewal check for Beacon Analytics is captured — fires 13 July, 30 days ahead of the renewal. First brick of the chain. Also filing: the capture row let me click Add on an empty form and said nothing.",
		);
	} finally {
		await s.finish();
	}
});
