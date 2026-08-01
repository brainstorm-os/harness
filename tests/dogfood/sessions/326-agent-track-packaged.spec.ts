/**
 * Session 326 — the agent track's PACKAGED-build exercise (0.13.0 agents
 * bucket, the second of the two named residues; session 325 did the dev-build
 * half).
 *
 * Packaging is not a formality here — it changes things a dev build cannot
 * prove:
 *   - `app.isPackaged` flips, which turns the dev seeder OFF and the analytics
 *     install-id ON;
 *   - the renderer + apps load out of an **asar archive** rather than loose
 *     files, so any path assumption that worked in dev can break;
 *   - native addons resolve from `Resources/native/` (the crypto addon, the
 *     SQLCipher driver the encrypted vault refuses to open without, and the
 *     image addon) rather than from `node_modules`.
 *
 * So this drives the same agent chain 325 proved, against the packaged binary:
 * the Team directory and its grant dialog (incl. the Delegation group), a
 * delegation grant persisted through the real ledger, and the @-mention →
 * ledger re-check → main-side honest-refusal reply. If packaging broke agent
 * identity, the ledger, or the mention runner, it fails here.
 *
 * Run with BRAINSTORM_PACKAGED_APP set to the packaged executable.
 */

import { expect, test } from "@playwright/test";
import { APP, IS_PACKAGED_RUN, startSession } from "../lib/founder";

test("agent track — packaged-build exercise", async () => {
	test.setTimeout(480_000);
	// A green run against a dev build would be a false pass — the whole point
	// is the packaged surface.
	expect(
		IS_PACKAGED_RUN,
		"set BRAINSTORM_PACKAGED_APP to the packaged executable for this session",
	).toBe(true);

	const s = await startSession("326-agent-track-packaged");
	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(2000);
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// The packaged shell must have opened the ENCRYPTED vault — that alone
		// proves the SQLCipher native addon resolved from Resources/native/.
		await s.shot(dash, "01-packaged-boot");

		// ── Settings → Team ────────────────────────────────────────────────
		await dash.locator('[aria-label="Settings"]').first().click();
		await dash.waitForTimeout(1000);
		await dash.locator(".settings__nav-item", { hasText: "Team" }).first().click();
		await dash.waitForTimeout(1000);
		await s.shot(dash, "02-team-directory");

		const rows = dash.locator('[data-testid="team-directory"] .grants-panel__app-name');
		const names = await rows.allInnerTexts().catch(() => [] as string[]);
		s.note(`packaged: team directory lists ${names.length} agent(s): ${names.join(", ")}`);
		expect(names.length, "the vault's agents must resolve in a packaged build").toBeGreaterThan(0);

		// Open the first agent's manage dialog — the grant groups incl. Delegation.
		const first = names[0] ?? "";
		await dash.getByRole("button", { name: `Manage agent ${first}` }).click();
		await dash.waitForTimeout(800);
		await s.shot(dash, "03-agent-dialog-packaged");

		// Delegation grant round-trip through the REAL ledger in a packaged app.
		const target = names.find((n) => n !== first);
		if (target) {
			const row = dash
				.getByRole("dialog")
				.locator(".setting-row--toggle", { hasText: target });
			await row.click();
			await dash.waitForTimeout(800);
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(400);
			await dash.getByRole("button", { name: `Manage agent ${first}` }).click();
			await dash.waitForTimeout(800);
			const persisted = await dash
				.getByRole("dialog")
				.locator(".setting-row--toggle", { hasText: target })
				.locator("input[type=checkbox]")
				.isChecked()
				.catch(() => null);
			s.note(`packaged: delegation grant persisted through the real ledger: ${persisted}`);
			expect(persisted).toBe(true);
			// Leave the vault as found.
			await dash
				.getByRole("dialog")
				.locator(".setting-row--toggle", { hasText: target })
				.click();
			await dash.waitForTimeout(500);
		} else {
			s.note("packaged: only one agent in the directory — delegation toggle not exercised");
		}
		await dash.keyboard.press("Escape");
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// ── Chat @-mention → honest refusal (zero model calls) ─────────────
		const ch = await s.openApp(APP.Chat);
		await ch.waitForTimeout(2000);
		const channels = ch.locator(".chat__channel-name");
		if ((await channels.count()) > 0) {
			await channels.first().click();
			await ch.waitForTimeout(800);
		}
		const composer = ch.locator(".chat__composer-input").first();
		await composer.click();
		await ch.keyboard.type(`@${first.split(" ")[0] ?? first}`, { delay: 40 });
		await ch.waitForTimeout(1000);
		await s.shot(ch, "04-mention-typeahead-packaged");
		const option = ch.getByText(first, { exact: true }).last();
		if (await option.isVisible().catch(() => false)) {
			await option.click();
		} else {
			await ch.keyboard.press("Enter");
		}
		await ch.waitForTimeout(400);
		await ch.keyboard.type(" packaged smoke", { delay: 5 });
		await ch.keyboard.press("Enter");

		// The refusal is written by MAIN with no model call — it must appear even
		// in a packaged build with no AI provider configured.
		const refusal = ch.getByText(/can't run yet|no AI permission|couldn't reach a model/i).first();
		await refusal.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
		await ch.waitForTimeout(500);
		await s.shot(ch, "05-mention-reply-packaged");
		const replied = await refusal.isVisible().catch(() => false);
		s.note(`packaged: mention produced a main-written agent reply: ${replied}`);
		expect(replied, "the mention chain must survive packaging").toBe(true);

		s.note("agent track packaged-build exercise complete");
	} finally {
		await s.finish();
	}
});
