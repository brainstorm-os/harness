/**
 * VID-agent-team capture (foundations cut) — the Agent-11 propose→approve loop:
 * the agent drafts real vault objects in chat and the human approves them. Drives
 * the Agent app against a fresh synthetic "Northbound Studio" vault and records
 * one clip per beat via the shared promo stage (`lib/promo-stage.ts`).
 *
 * The agent's proposals come from the capture-only **scripted demo provider**
 * (`BRAINSTORM_DEMO_AGENT`, set by `promo:capture:agent`) — it returns a fixed
 * propose-contact → propose-task → propose-event → final sequence that the REAL
 * agent loop parses, dispatches, and stages. Only the model is scripted; the
 * tray, the edits, and the approve→`entities.create` are the genuine pipeline.
 *
 * Scene ids mirror the content scenes in `tools/promo/agent-team-scenes.mjs`
 * (00-slide / 06-title are render-side cards, not captured here). Drivers are
 * defensive: a selector drifting never kills the run.
 *
 *   bun run promo:capture:agent && bun run promo:vo:agent && bun run promo:render:agent
 */

import { join } from "node:path";
import { test } from "@playwright/test";
import { beat, glideClick, typeHuman } from "../lib/humanize";
import { launchPromoStage } from "../lib/promo-stage";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const DATA = join(HARNESS, "tests", "dogfood", ".promo-agent-data");
const CLIPS = join(HARNESS, "tests", "dogfood", ".promo-agent", "clips");
const AGENT = "io.brainstorm.agent";
const CONTACTS = "io.brainstorm.contacts";
const TASKS = "io.brainstorm.tasks";

const PROMPT =
	"I just got off a call with Priya Rao at Meridian about the Q3 retainer. Set me up to follow through.";

test("capture VID-agent-team reel", async () => {
	test.setTimeout(1_200_000);
	const s = await launchPromoStage({ dataDir: DATA, clipsDir: CLIPS });

	await s.createVault("Northbound Studio", join(DATA, "vault"));
	await s.waitForSession();
	await s.seedMarketing();

	const agent = await s.openApp(AGENT);
	agent.on("console", (m) => {
		const t = m.text();
		if (t.includes("[agent-diag]") || t.toLowerCase().includes("error")) console.log("[APP]", t);
	});

	/** Card locator by its `data-kind` — the card's field VALUES live in
	 *  `<input>`s (not DOM text), so `hasText` can't match them; the kind attr can. */
	const card = (kind: string) =>
		agent.locator(`[data-testid="agent-proposal"][data-kind="${kind}"]`).first();

	// ── 01: ASK — tell the agent, in your own words ──────────────────────────
	await s.scene("01-ask", async () => {
		await s.film(agent);
		// Wait for the app to mount (the send button is the reliable ready-signal)
		// before starting a fresh chat, so the New-chat click doesn't miss and the
		// transcript opens clean.
		await agent
			.locator('[data-testid="agent-send"]')
			.first()
			.waitFor({ state: "visible", timeout: 15_000 })
			.catch(() => undefined);
		await agent
			.locator('[aria-label="New chat"]')
			.first()
			.click()
			.catch(() => undefined);
		await beat(agent, 900);
		const composer = agent.locator('[contenteditable="true"], textarea').last();
		await composer.click().catch(() => undefined);
		await beat(agent, 300);
		await typeHuman(agent, PROMPT, 22);
		await beat(agent, 500);
		await agent
			.locator('[data-testid="agent-send"]')
			.click()
			.catch(() => undefined);
	});

	// ── 02: PROPOSE — real objects, staged for review ────────────────────────
	await s.scene("02-propose", async () => {
		await s.film(agent);
		// The demo provider drives the real loop; cards land as the turn runs.
		await agent
			.locator('[data-testid="agent-proposal"]')
			.first()
			.waitFor({ state: "visible", timeout: 30_000 })
			.catch(() => undefined);
		await beat(agent, 1600);
	});

	// ── 03: EDIT — you're the editor ─────────────────────────────────────────
	await s.scene("03-edit", async () => {
		await s.film(agent);
		// The contact card's Phone field (empty) — fill it to show live editing.
		const phone = card("contact").locator("input").nth(2);
		if (await phone.count().catch(() => 0)) {
			await phone.click().catch(() => undefined);
			await beat(agent, 300);
			await typeHuman(agent, "+1 555 0142", 40);
		}
		await beat(agent, 900);
	});

	// ── 04: APPROVE — you commit; drop what you don't want ───────────────────
	await s.scene("04-approve", async () => {
		await s.film(agent);
		// Discard the check-in event, keep the contact + the task.
		await card("event")
			.locator('[data-testid="agent-proposal-discard"]')
			.click()
			.catch(() => undefined);
		await beat(agent, 800);
		await card("contact")
			.locator('[data-testid="agent-proposal-approve"]')
			.click()
			.catch(() => undefined);
		await beat(agent, 800);
		await card("task")
			.locator('[data-testid="agent-proposal-approve"]')
			.click()
			.catch(() => undefined);
		await beat(agent, 1000);
	});

	// ── 05: KEPT — the drafts are now real, in their apps ────────────────────
	await s.scene("05-kept", async () => {
		const contacts = await s.openApp(CONTACTS);
		await s.film(contacts);
		await beat(contacts, 1600);
		const tasks = await s.openApp(TASKS);
		await s.film(tasks);
		// The follow-up is due next week — Upcoming surfaces it (Today wouldn't).
		await tasks
			.locator("text=Upcoming")
			.first()
			.click()
			.catch(() => undefined);
		await beat(tasks, 1400);
	});
});
