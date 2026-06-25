/**
 * Session 181 — the team reviews the Agent app (local-model slice), with or
 * without Ollama running.
 *
 * Session 174 hard-skips when Ollama is unreachable, so the Agent app's UX
 * never gets exercised on a machine without a local model. This session always
 * opens the app and reviews it: Marcus checks the empty state + composer +
 * single app-header (the recent chrome fix); Mira sends a prompt. If Ollama is
 * up, the full broker→model→transcript round-trip is asserted; if it's down,
 * the bar is that the failure is SURFACED as a clear error (the recent
 * "surfaced errors" fix), never a silent hang or a stuck "Thinking…".
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const OLLAMA_ENDPOINT = process.env.BRAINSTORM_OLLAMA_ENDPOINT ?? "http://localhost:11434";

async function ollamaReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(2000) });
		return res.ok;
	} catch {
		return false;
	}
}

test("Agent app review — UX + graceful failure, round-trip if a model is up (181)", async () => {
	test.setTimeout(300_000);
	const reachable = await ollamaReachable();
	const s = await startSession("181-agent-app-review");
	try {
		s.note(`Ollama reachable at ${OLLAMA_ENDPOINT}: ${reachable}`);
		s.chat(
			SPEAKER.Marcus,
			reachable
				? "Reviewing the Agent app with a local model up — empty state, composer, and the reply chrome."
				: "Reviewing the Agent app without a model running — I want to see the empty state and, critically, that a send fails LOUDLY, not silently.",
		);

		const agent = await s.openApp(APP.Agent);
		await agent.waitForLoadState("domcontentloaded");
		await agent.waitForTimeout(1400);
		await s.shot(agent, "01-agent-empty");

		// Chrome review: exactly ONE app-header (the recent single-top-header fix),
		// and a usable composer (input + send).
		const chrome = await agent.evaluate(() => ({
			headerCount: document.querySelectorAll(".app-header").length,
			hasInput: !!document.querySelector("[data-testid='agent-input']"),
			hasSend: !!document.querySelector("[data-testid='agent-send']"),
		}));
		s.note(`agent chrome: ${JSON.stringify(chrome)}`);
		s.chat(
			SPEAKER.Marcus,
			chrome.headerCount === 1 && chrome.hasInput && chrome.hasSend
				? "Clean: one header, a real composer with input + send. The chrome reads finished."
				: `Chrome is off — headers=${chrome.headerCount}, input=${chrome.hasInput}, send=${chrome.hasSend}. Filing.`,
		);

		const input = agent.locator("[data-testid='agent-input']");
		if (!(await input.count())) {
			s.note("no composer input — cannot exercise a send this run");
			return;
		}

		const prompt = "In one sentence, what is a knowledge-management app good for?";
		await input.fill(prompt).catch(() => undefined);
		await agent
			.locator("[data-testid='agent-send']")
			.click()
			.catch(() => undefined);
		s.note(`sent: "${prompt}"`);
		s.chat(SPEAKER.Mira, "Asked the agent a quick question — watching what comes back.");

		const reply = agent
			.locator(".agent__msg--assistant .agent__msg-body:not(.agent__msg-body--thinking)")
			.first();
		const errorBanner = agent.locator("[data-testid='agent-error']");

		if (reachable) {
			// A "reachable" Ollama (responds to /api/tags) can still fail to
			// generate — e.g. the llama-server runner binary is missing after a
			// version bump (HTTP 500). So race the reply against a surfaced error
			// instead of blocking the full 180s: a reply proves the round-trip; a
			// surfaced error proves graceful failure; only a silent hang is a bug.
			const outcome = await Promise.race([
				reply.waitFor({ state: "visible", timeout: 150_000 }).then(() => "reply" as const),
				errorBanner.waitFor({ state: "visible", timeout: 150_000 }).then(() => "error" as const),
			]).catch(() => "timeout" as const);
			if (outcome === "reply") {
				const text = (await reply.textContent().catch(() => ""))?.trim() ?? "";
				await s.shot(agent, "02-agent-reply");
				s.note(`agent replied (${text.length} chars): ${text.slice(0, 160)}`);
				s.chat(SPEAKER.Kai, "Broker → Ollama → transcript round-trip works end-to-end.");
				expect(text.length, "assistant reply rendered").toBeGreaterThan(0);
			} else {
				const errText = (await errorBanner.textContent().catch(() => ""))?.trim() ?? "";
				await s.shot(agent, "02-agent-generate-error");
				s.note(
					`reachable but no reply (outcome=${outcome}); surfaced error: "${errText.slice(0, 180)}"`,
				);
				s.chat(
					SPEAKER.Marcus,
					outcome === "error"
						? `Ollama is reachable but couldn't generate ("${errText.slice(0, 80)}") — the app surfaced it cleanly rather than hanging. Round-trip unproven (host model issue), failure path good.`
						: "Ollama is reachable but the app neither replied nor surfaced an error within 150s — that's a silent hang. Filing.",
				);
				// A surfaced error is acceptable (host can't run the model); a silent
				// hang is not.
				expect(outcome, "reachable Ollama must reply or surface an error, never hang").toBe("error");
			}
		} else {
			// No model: the bar is a SURFACED error within a bounded time, and no
			// permanently-stuck "Thinking…" placeholder.
			const surfaced = await errorBanner
				.waitFor({ state: "visible", timeout: 30_000 })
				.then(() => true)
				.catch(() => false);
			const errText = (await errorBanner.textContent().catch(() => ""))?.trim() ?? "";
			const stuckThinking = await agent.locator(".agent__msg-body--thinking").count();
			await s.shot(agent, "02-agent-no-model");
			s.note(
				`no-model: errorSurfaced=${surfaced} stuckThinking=${stuckThinking} err="${errText.slice(0, 160)}"`,
			);
			s.chat(
				SPEAKER.Marcus,
				surfaced
					? `Good — with no model, the send fails with a visible error ("${errText.slice(0, 80)}"), not a silent hang. That's the right behaviour.`
					: "Bad — sending with no model gave no surfaced error within 30s. A founder would just stare at a dead composer. Filing.",
			);
			expect(surfaced, "failure is surfaced as a visible error when no model is available").toBe(true);
		}
		s.note("Agent app review complete (UX + failure path / round-trip).");
	} finally {
		await s.finish();
	}
});
