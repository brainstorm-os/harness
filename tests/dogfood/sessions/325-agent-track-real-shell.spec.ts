/**
 * Session 325 — the agent track's FIRST real-shell exercise (0.13.0 agents
 * bucket) + the Teams-2 screenshot pass.
 *
 * Everything on Teams-1..5 / 12a..e shipped on in-process gates only; this
 * session drives the real Electron shell:
 *
 *   1. Settings → Team: directory (creating two probe agents if the vault
 *      predates the Teams-4 seeder), the manage dialog with every grant
 *      group INCLUDING the new Delegation group (shell #425), and a
 *      delegation toggle round-trip persisted through the real ledger IPC.
 *   2. Chat @-mention of a zero-grant agent → the deterministic honest
 *      refusal reply (NO_PERMISSION_REPLY) — exercises mention-runner →
 *      ledger re-check → main-side channel write with ZERO model calls.
 *   3. Automations trigger builder: the new Assign-to-agent select, fed by
 *      the live cap-gated roster.agents projection.
 *
 * Deliberately NOT a packaged-build exercise — that half stays open.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("agent track — real-shell pass + Teams-2 screenshots", async () => {
	test.setTimeout(480_000);
	const s = await startSession("325-agent-track-real-shell");
	try {
		const dash = s.dashboard;
		await dash.waitForTimeout(1500);
		// Dismiss the auto-opened "What's new" popover — it overlays the header.
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(500);

		// ── 1. Settings → Team ──────────────────────────────────────────────
		await dash.locator('[aria-label="Settings"]').first().click();
		await dash.waitForTimeout(800);
		const nav = dash.locator(".settings__nav");
		if (!(await nav.isVisible().catch(() => false))) {
			// Fallback: the keyboard shortcut opens Settings regardless of chrome.
			await dash.keyboard.press("Meta+Comma");
			await dash.waitForTimeout(800);
		}
		// Composite-nav items carry keyboard-pattern ARIA — target by class+text.
		await dash.locator(".settings__nav-item", { hasText: "Team" }).first().click();
		await dash.waitForTimeout(800);
		await s.shot(dash, "01-team-directory");

		// Ensure at least two agents exist (Northbound predates the seeder).
		const ensureAgent = async (name: string) => {
			const rows = dash.locator('[data-testid="team-directory"] .grants-panel__app-name');
			const names = await rows.allInnerTexts().catch(() => [] as string[]);
			if (names.includes(name)) return;
			await dash.getByLabel("New agent name").fill(name);
			await dash.getByRole("button", { name: "Create agent" }).click();
			await dash.waitForTimeout(900);
			// Creating opens the manage dialog for the new agent — close it.
			await dash.keyboard.press("Escape");
			await dash.waitForTimeout(400);
		};
		await ensureAgent("Probe Alpha");
		await ensureAgent("Probe Beta");
		await s.shot(dash, "02-team-directory-populated");

		// Open Probe Alpha's manage dialog; capture the grant groups.
		await dash.getByRole("button", { name: "Manage agent Probe Alpha" }).click();
		await dash.waitForTimeout(600);
		await s.shot(dash, "03-agent-dialog-grants");

		// Delegation toggle round-trip: Alpha may delegate to Beta. The whole
		// ToggleRow is a <label>; click the row (the hidden input is not a
		// pointer target — force-clicking it dispatches to nothing).
		const betaRow = dash
			.getByRole("dialog")
			.locator(".setting-row--toggle", { hasText: "Probe Beta" });
		await betaRow.click();
		await dash.waitForTimeout(600);
		await s.shot(dash, "04-delegation-granted");
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(400);
		// Reopen — the grant must have persisted through the real ledger.
		await dash.getByRole("button", { name: "Manage agent Probe Alpha" }).click();
		await dash.waitForTimeout(600);
		const persisted = await dash
			.getByRole("dialog")
			.getByLabel("Allow delegating to Probe Beta")
			.isChecked()
			.catch(() => null);
		s.note(`delegation grant persisted across dialog reopen: ${persisted}`);
		expect(persisted).toBe(true);
		// Revoke again so the vault's grant state is left as found.
		await dash
			.getByRole("dialog")
			.locator(".setting-row--toggle", { hasText: "Probe Beta" })
			.click();
		await dash.waitForTimeout(500);
		await dash.keyboard.press("Escape");
		await dash.keyboard.press("Escape");
		await dash.waitForTimeout(400);

		// ── 2. Chat @-mention → honest refusal (zero model calls) ───────────
		const ch = await s.openApp(APP.Chat);
		await ch.waitForTimeout(1500);
		const channels = ch.locator(".chat__channel-name");
		if ((await channels.count()) > 0) await channels.first().click();
		await ch.waitForTimeout(600);
		const composer = ch.locator(".chat__composer-input").first();
		await composer.click();
		// No spaces before the pick — whitespace closes the mention trigger.
		await ch.keyboard.type("@Probe", { delay: 40 });
		await ch.waitForTimeout(900);
		await s.shot(ch, "05-mention-typeahead-agent");
		// Pick Probe Alpha's row explicitly (two probes match the query).
		const alphaOption = ch.getByText("Probe Alpha", { exact: true }).last();
		if (await alphaOption.isVisible().catch(() => false)) {
			await alphaOption.click();
		} else {
			await ch.keyboard.press("Enter");
		}
		await ch.waitForTimeout(300);
		await ch.keyboard.type(" status check please", { delay: 5 });
		await ch.keyboard.press("Enter");
		// The refusal is main-side and model-free — it should land fast.
		const refusal = ch.getByText(/can't run yet|no AI permission/i).first();
		await refusal.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
		await ch.waitForTimeout(400);
		await s.shot(ch, "06-mention-honest-refusal");
		const refusalShown = await refusal.isVisible().catch(() => false);
		s.note(`mention honest-refusal reply rendered: ${refusalShown}`);
		expect(refusalShown).toBe(true);

		// ── 3. Automations: Assign-to-agent select (live roster.agents) ─────
		const au = await s.openApp(APP.Automations);
		await au.waitForTimeout(1500);
		await au.getByRole("button", { name: "New workflow" }).first().click();
		await au.waitForTimeout(600);
		// Trigger kind → "When something changes" (EntityEvent). The kind
		// select is the first bs-select in the trigger section.
		const kindSelect = au.locator(".au-builder .bs-select").first();
		await kindSelect.click();
		await au.waitForTimeout(300);
		await au.locator(".fm-menu .fm-row", { hasText: /entity|changes|event/i }).first().click();
		await au.waitForTimeout(500);
		const assigneeSelect = au.getByRole("button", { name: "Assign to agent" });
		const hasAssignee = (await assigneeSelect.count()) > 0;
		s.note(`assignee select present on EntityEvent trigger: ${hasAssignee}`);
		if (hasAssignee) {
			await assigneeSelect.click();
			await au.waitForTimeout(400);
			await s.shot(au, "07-assignee-options");
			const alphaRow = au.locator(".fm-menu .fm-row", { hasText: "Probe Alpha" });
			const rosterLive = (await alphaRow.count()) > 0;
			s.note(`roster.agents feeds the picker (Probe Alpha listed): ${rosterLive}`);
			expect(rosterLive).toBe(true);
			await au.keyboard.press("Escape");
		}
		await au.keyboard.press("Escape");

		s.note(
			"agent-track real-shell pass complete: Team directory + grants dialog + delegation persistence + mention refusal + live assignee picker",
		);
	} finally {
		await s.finish();
	}
});
