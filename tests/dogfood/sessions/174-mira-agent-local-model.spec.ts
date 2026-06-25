/**
 * Session 174 — Mira talks to the new Agent app, backed by a LOCAL model
 * (Ollama). This is the first end-to-end exercise of the AI broker slice:
 * app → `services.ai.generate` → broker `ai` service → Ollama provider →
 * `localhost:11434` (via the network broker, `allowPrivate`) → reply rendered
 * into the Conversation/Message transcript.
 *
 * The session SKIPS gracefully when Ollama isn't reachable, so it never
 * red-bars CI on a machine without a local model. To run it for real:
 *     ollama serve & ollama pull llama3.2
 *     bun run dogfood -- -g "174"
 * Override the endpoint/model with BRAINSTORM_OLLAMA_ENDPOINT / _MODEL.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const OLLAMA_ENDPOINT = process.env.BRAINSTORM_OLLAMA_ENDPOINT ?? "http://localhost:11434";

async function ollamaReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, {
			signal: AbortSignal.timeout(2000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

test("Mira chats with the Agent app over a local model (174)", async () => {
	test.setTimeout(300_000);
	const reachable = await ollamaReachable();
	test.skip(
		!reachable,
		`Ollama not reachable at ${OLLAMA_ENDPOINT} — skipping local-model session.`,
	);

	const s = await startSession("174-mira-agent-local-model");
	try {
		const agent = await s.openApp(APP.Agent);
		await agent.waitForLoadState("domcontentloaded");
		await agent.waitForTimeout(1200);
		await s.shot(agent, "agent-empty");
		s.note("Agent app opened — empty-state prompt visible.");
		s.chat(SPEAKER.Mira, "Trying the new Agent app on a local model — no cloud key.");

		const prompt = "In one sentence, what is a knowledge management app good for?";
		await agent.locator('[data-testid="agent-input"]').fill(prompt);
		await agent.locator('[data-testid="agent-send"]').click();
		s.note(`Sent: "${prompt}"`);

		// The transcript shows the user turn immediately and a "Thinking…"
		// placeholder while the model runs; the real reply replaces it.
		const reply = agent
			.locator(".agent__msg--assistant .agent__msg-body:not(.agent__msg-body--thinking)")
			.first();
		try {
			await reply.waitFor({ state: "visible", timeout: 180_000 });
		} catch {
			const err = await agent
				.locator('[data-testid="agent-error"]')
				.textContent()
				.catch(() => null);
			throw new Error(
				`No assistant reply within 180s. ${err ?? "(no error banner — is a model pulled? `ollama pull llama3.2`)"}`,
			);
		}

		const text = (await reply.textContent())?.trim() ?? "";
		await s.shot(agent, "agent-reply");
		s.note(`Agent replied (${text.length} chars): ${text.slice(0, 160)}`);
		s.chat(SPEAKER.Kai, "Broker→Ollama→transcript round-trip works end-to-end.");

		expect(text.length).toBeGreaterThan(0);

		// The conversation persisted as an entity — it shows in the sidebar.
		// (The dogfood vault is persistent, so prior runs may have left more.)
		expect(await agent.locator(".agent__conv").count()).toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
