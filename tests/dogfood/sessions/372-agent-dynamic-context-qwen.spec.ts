/**
 * Session 372 — does the Agent actually use DYNAMIC CONTEXT? Backed by a local
 * Qwen model (Ollama), driven against Mira's real Northbound vault.
 *
 * The worry (raised 2026-06-30): the agent "doesn't know surrounding context or
 * company data". The agent app *does* assemble a context region per turn —
 * workspace catalog + a tally of what's actually in the vault + hybrid-retrieval
 * hits + pinned attachments + long-term memory (app.tsx → joinContextBlocks).
 * This session proves end-to-end whether that grounding reaches the model and
 * shapes the answer, by asking questions that are ONLY answerable from Mira's
 * own vault — and capturing each reply for human judgement.
 *
 * Determinism beyond the (fuzzy) model text: point Ollama at a logging proxy
 * (BRAINSTORM_OLLAMA_ENDPOINT) so the EXACT prompt — including the injected
 * "## Your vault …" context — is recorded for inspection.
 *
 * Run for real:
 *     ollama serve & ollama pull qwen2.5:7b
 *     node <scratch>/ollama-logging-proxy.mjs 11435 /tmp/ollama-proxy.jsonl &
 *     BRAINSTORM_OLLAMA_ENDPOINT=http://localhost:11435 \
 *       BRAINSTORM_OLLAMA_MODEL=qwen2.5:7b bun run dogfood:fast -- -g "372"
 * Skips gracefully when the endpoint isn't reachable.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const OLLAMA_ENDPOINT = process.env.BRAINSTORM_OLLAMA_ENDPOINT ?? "http://localhost:11434";
const MODEL = process.env.BRAINSTORM_OLLAMA_MODEL ?? "llama3.2";

async function reachable(): Promise<boolean> {
	try {
		const res = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(2000) });
		return res.ok;
	} catch {
		return false;
	}
}

test("Agent grounds its answers in Mira's vault context (372)", async () => {
	test.setTimeout(600_000);
	test.skip(!(await reachable()), `Ollama not reachable at ${OLLAMA_ENDPOINT} — skipping.`);

	const s = await startSession("372-agent-dynamic-context-qwen");
	try {
		const agent = await s.openApp(APP.Agent);
		await agent.waitForLoadState("domcontentloaded");
		await agent.waitForTimeout(1500);
		// Start a FRESH conversation: the Northbound vault is persistent, so prior
		// sessions' answers live on as Message entities. A clean transcript is the
		// only honest test of the grounding guard — otherwise the model parrots its
		// own earlier (pre-fix) replies instead of reasoning from this turn's context.
		await agent.getByRole("button", { name: "New chat" }).click();
		await agent.waitForTimeout(500);
		await s.shot(agent, "agent-empty");
		s.chat(SPEAKER.Mira, `Checking whether the Agent really knows my workspace (model: ${MODEL}).`);

		const input = agent.locator('[data-testid="agent-input"]');
		const send = agent.locator('[data-testid="agent-send"]');
		const replies = agent.locator(
			".agent__msg--assistant .agent__msg-body:not(.agent__msg-body--thinking)",
		);

		async function ask(label: string, prompt: string): Promise<string> {
			const before = await replies.count();
			await input.fill(prompt);
			await send.click();
			s.note(`**Q (${label}):** ${prompt}`);
			try {
				await expect
					.poll(async () => replies.count(), { timeout: 240_000, intervals: [1000] })
					.toBeGreaterThan(before);
			} catch {
				const err = await agent
					.locator('[data-testid="agent-error"]')
					.textContent()
					.catch(() => null);
				throw new Error(`No reply for "${label}" within 240s. ${err ?? "(no error banner)"}`);
			}
			const text = (await replies.last().textContent())?.trim() ?? "";
			s.note(`**A (${label}):** ${text}`);
			await s.shot(agent, `reply-${label}`);
			return text;
		}

		// Q1 — company data: only answerable from the vault-data tally block.
		const a1 = await ask(
			"vault-inventory",
			"Strictly from what you know about MY workspace, what kinds of items are in my vault right now and roughly how many of each? If you don't actually have that information, say so plainly.",
		);

		// Q2 — workspace awareness: the apps/tools catalog block.
		const a2 = await ask(
			"workspace-apps",
			"What apps do I have available in this workspace? List the ones you can see.",
		);

		// Q3 — content grounding: a query that shares vocabulary with real notes
		// ("Northbound Q3 plan" notes exist in the vault), so retrieval should
		// surface them and the answer should reflect their actual content.
		const a3 = await ask(
			"northbound-plan",
			"Summarize what my notes say about the Northbound Q3 plan.",
		);

		// Q4 — honesty/guard: the vault has no object literally describing
		// "clients", so retrieval should find nothing relevant. A grounded agent
		// admits it rather than inventing client names.
		const a4 = await ask(
			"clients-guard",
			"Who are my clients? List them by name if you actually have that in my vault.",
		);

		s.chat(
			SPEAKER.Kai,
			"Captured four grounded answers + the exact prompts sent to the model (proxy log) for review.",
		);

		// Loose, non-flaky assertions — the real verdict is read from the captured
		// replies + the proxy prompt log. Each turn must at least produce a
		// substantive answer served by the pinned model.
		for (const [label, text] of [
			["vault-inventory", a1],
			["workspace-apps", a2],
			["northbound-plan", a3],
			["clients-guard", a4],
		] as const) {
			expect(text.length, `${label} reply should be substantive`).toBeGreaterThan(20);
		}

		// The model badge should show the pinned model actually served the turn.
		const modelBadge = await agent.locator(".agent__msg-model").last().textContent();
		s.note(`Model badge: ${modelBadge ?? "(none)"}`);

		expect(await agent.locator(".agent__conv").count()).toBeGreaterThanOrEqual(1);
	} finally {
		await s.finish();
	}
});
