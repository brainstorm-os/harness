/**
 * Session 328 — the agent bucket's LAST residue: a granted, MODEL-BACKED run.
 *
 * Every agent session so far (325 real-shell, 326 packaged) proved the same
 * thing: the @-mention chain reaches `main`, the ledger is re-checked, and the
 * agent honestly refuses with "I have no AI permission in this vault". That is
 * the refusal path, and it completes with ZERO model calls — so nothing has
 * ever watched an agent actually think.
 *
 * This grants the agent `ai.use` through the real Settings → Team surface, then
 * @-mentions it and waits for a reply that is NOT the refusal. The provider is
 * Ollama (owner's call, 2026-08-02): the shell already falls back to
 * `OLLAMA_PROVIDER_ID` when a vault has no persisted default, and Ollama is
 * running locally with `qwen2.5:7b` / `llama3.2`, so no key material and no
 * network egress are involved.
 *
 * The first cut of this spec appeared to show a broken product — no reply in 13
 * minutes. The main-process log showed NO mention-runner activity at all, which
 * located the fault in the SPEC: it clicked a text match to pick the agent, but
 * the typeahead is keyboard-driven and takes Enter before the composer's submit
 * handler, so the draft went out as plain text and no mention was ever made.
 * Worth recording because the failure mode reads exactly like a product bug.
 *
 * The assertion is deliberately "not the refusal" rather than a content match.
 * A local 7B model's wording is not a stable contract, and asserting on it
 * would make this spec fail for the wrong reason forever. What must be true is
 * that a model was reached and its output came back through the mention runner.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** The honest-refusal phrasings `main` writes when the agent cannot reach a
 *  model. Seeing ANY of these means the run did not become model-backed. */
const REFUSALS = /can't run yet|no AI permission|couldn't reach a model|not configured/i;

test("agent — granted, model-backed mention run (328)", async () => {
	test.setTimeout(900_000);
	const s = await startSession("328-agent-model-backed-run");

	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(2500);
		await dash.keyboard.press("Escape");

		// ── Grant the agent AI through the real surface ────────────────────
		await dash.locator('[aria-label="Settings"]').first().click();
		await dash.waitForTimeout(900);
		await dash.locator(".settings__nav-item", { hasText: "Team" }).first().click();
		await dash.waitForTimeout(900);
		await s.shot(dash, "01-team-directory");

		const names = await dash
			.locator('[data-testid="team-directory"] .grants-panel__app-name')
			.allInnerTexts()
			.catch(() => [] as string[]);
		expect(names.length, "the vault must have at least one agent").toBeGreaterThan(0);
		const agent = names[0] ?? "";
		s.note(`granting AI to: ${agent}`);

		await dash.getByRole("button", { name: `Manage agent ${agent}` }).click();
		await dash.waitForTimeout(800);
		await s.shot(dash, "02-agent-grants");

		// `ai.use` is an UNSCOPED agent-grantable capability, so it shows as a
		// plain toggle row rather than a scoped picker.
		const aiRow = dash.getByRole("dialog").locator(".setting-row--toggle", { hasText: /AI/i }).first();
		const already = await aiRow.locator("input[type=checkbox]").isChecked().catch(() => false);
		if (!already) {
			await aiRow.click();
			await dash.waitForTimeout(700);
		}
		const granted = await aiRow.locator("input[type=checkbox]").isChecked().catch(() => null);
		s.note(`ai.use granted through the real ledger: ${granted}`);
		await s.shot(dash, "03-ai-granted");
		await dash.keyboard.press("Escape");
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// ── Mention it and wait for a real answer ──────────────────────────
		const ch = await s.openApp(APP.Chat);
		await ch.waitForTimeout(2200);
		const channels = ch.locator(".chat__channel-name");
		if ((await channels.count()) > 0) {
			await channels.first().click();
			await ch.waitForTimeout(800);
		}
		const composer = ch.locator(".chat__composer-input").first();
		await composer.click();
		await ch.keyboard.type(`@${agent.split(" ")[0] ?? agent}`, { delay: 40 });
		await ch.waitForTimeout(1500);
		// SEE the typeahead rather than guessing at it — two runs failed with zero
		// mention activity in the main log and no image of what the composer was
		// actually doing.
		await s.shot(ch, "04-typeahead-open");
		// The typeahead is KEYBOARD-driven and takes Enter before the composer's
		// submit handler (see `mention-composer-plugin`). The previous cut clicked
		// a text match instead, which selected something else entirely and left
		// the draft as plain text — so nothing ever reached the mention runner and
		// the run looked like a broken product rather than a broken spec.
		await ch.keyboard.press("Enter");
		await ch.waitForTimeout(800);
		await s.shot(ch, "05-after-commit");
		// A per-run nonce: three earlier runs sent the IDENTICAL prompt, so a
		// `lastIndexOf` on the question text could land on a previous run's
		// message and read a previous run's reply (or, worse, whatever text
		// follows it). The nonce pins the scan to THIS run's send.
		const nonce = `probe-${Date.now()}`;
		await ch.keyboard.type(` in one short sentence, what is this vault about? [${nonce}]`, {
			delay: 5,
		});
		await ch.keyboard.press("Enter");
		await ch.waitForTimeout(1500);
		await s.shot(ch, "06-after-send");
		s.note("mention sent — waiting on a local model, which is slower than a refusal");

		// Read ONLY the message list. The previous cut scanned `body.innerText()`,
		// whose tail after the prompt is the MEMBERS sidebar + composer
		// placeholder — so it "passed" on sidebar junk 16 seconds in, before any
		// reply existed. Scope to the messages container and require a line that
		// is not the author/time header.
		const msgs = ch.locator('[data-testid="messages"]');
		let text = "";
		for (let i = 0; i < 90; i += 1) {
			const body = (await msgs.innerText().catch(() => "")) ?? "";
			const idx = body.lastIndexOf(nonce);
			const tail = idx >= 0 ? body.slice(idx + nonce.length).trim() : "";
			// Drop the closing "]" of our own message and the agent's
			// author/time header line — what remains is the reply body.
			text = tail
				.replace(/^\]?\s*/, "")
				.split("\n")
				.filter((l) => l.trim().length > 0 && !l.trim().startsWith(agent))
				.join("\n")
				.trim();
			if (text.length > 0 && !REFUSALS.test(text)) break;
			await ch.waitForTimeout(2000);
		}
		await s.shot(ch, "07-agent-reply");
		s.note(`reply (${text.length} chars): ${text.slice(0, 200)}`);

		expect(text.length, "the agent must have replied at all").toBeGreaterThan(0);
		expect(
			REFUSALS.test(text),
			`still the refusal path — a model was never reached: ${text.slice(0, 160)}`,
		).toBe(false);
		s.note("MODEL-BACKED run confirmed — the agent bucket's last residue is closed");
	} finally {
		await s.finish();
	}
});
