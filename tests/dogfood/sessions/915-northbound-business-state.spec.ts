/**
 * Session 915 — Northbound business-operations state audit.
 *
 * The owed 11b.18 residue: *"a real-shell 914-followup session rebuilding
 * Mira's triage automation end-to-end."* Before rebuilding anything, this
 * establishes what is actually THERE — the 914 audit's central finding was that
 * the engine could "think but not file", and both halves (`EntityStep.properties`
 * + the trigger feeding the Entity step) shipped in v0.10.1. So the question is
 * whether Mira's business actually runs on them now, or whether the capability
 * shipped and nothing uses it.
 *
 * Walks the business path in the order Mira would: what automations exist and
 * have they ever run → does the CRM hold a real pipeline → is work tracked in
 * Tasks → what is inbound. Read-only: navigates, counts and captures, never
 * edits. The vault is the owner's real Northbound data ([[northbound-vault-permanent]]),
 * backed up before this ran.
 *
 * Verdicts are NOT written here. Per the standing lesson, the screenshots and
 * the counted `note()` lines are the evidence; a spec that asserts its own
 * conclusion is how a false "verified" gets recorded.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** Trim + collapse whitespace so noted labels stay on one line. */
const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Count a selector, tolerating an app that never renders it. */
async function countOf(page: import("@playwright/test").Page, selector: string): Promise<number> {
	return page
		.locator(selector)
		.count()
		.catch(() => 0);
}

/** First N text contents for a selector, cleaned. */
async function labels(
	page: import("@playwright/test").Page,
	selector: string,
	limit = 12,
): Promise<string[]> {
	const texts = await page
		.locator(selector)
		.allTextContents()
		.catch(() => [] as string[]);
	return texts.map(clean).filter(Boolean).slice(0, limit);
}

test("915 — what state is Northbound's business actually in?", async () => {
	test.setTimeout(600_000);
	const s = await startSession("915-northbound-business-state");

	try {
		// ── 1. Automations: do the workflows exist, are they on, have they run?
		const auto = await s.openApp(APP.Automations);
		await auto.waitForTimeout(3500);
		await s.shot(auto, "01-automations-open");

		// The list rows carry the workflow name + enabled state. Selector is
		// deliberately broad: this is a survey, and a miss should show up as a
		// zero count to investigate, not as a thrown locator error.
		for (const sel of [".automations__row", "[data-workflow-id]", ".wf-row", "[role='row']"]) {
			const n = await countOf(auto, sel);
			if (n > 0) s.note(`[automations] ${sel} → ${n} rows: ${(await labels(auto, sel)).join(" | ")}`);
		}
		s.note(`[automations] body text sample: ${clean((await auto.innerText("body")).slice(0, 900))}`);

		// Open the first workflow, if any, to see its steps — the 914 report's
		// core complaint was a workflow that needed a glue Code step to file.
		const firstRow = auto.locator(".automations__row, [data-workflow-id], [role='row']").first();
		if ((await firstRow.count().catch(() => 0)) > 0) {
			await firstRow.click({ timeout: 5000 }).catch(() => {});
			await auto.waitForTimeout(2000);
			await s.shot(auto, "02-automations-first-workflow");
			s.note(`[automations] opened workflow: ${clean((await auto.innerText("body")).slice(0, 900))}`);
		} else {
			s.note("[automations] NO workflow rows matched any known selector — see 01 screenshot");
		}

		// ── 2. The CRM: is there a real pipeline behind the automations?
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3500);
		await s.shot(db, "03-database-open");
		for (const sel of [".db-row", "[role='row']", ".db-grid__row"]) {
			const n = await countOf(db, sel);
			if (n > 0) s.note(`[database] ${sel} → ${n} rows: ${(await labels(db, sel, 8)).join(" | ")}`);
		}
		s.note(`[database] body sample: ${clean((await db.innerText("body")).slice(0, 700))}`);

		// ── 3. Tasks: is the work the automations are supposed to file visible?
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(3000);
		await s.shot(tasks, "04-tasks-open");
		for (const sel of [".tasks-row", "[role='row']", ".tasks__row", "li"]) {
			const n = await countOf(tasks, sel);
			if (n > 0) {
				s.note(`[tasks] ${sel} → ${n}: ${(await labels(tasks, sel, 10)).join(" | ")}`);
				break;
			}
		}

		// ── 4. Mailbox: the inbound side of a triage workflow.
		const mail = await s.openApp(APP.Mailbox);
		await mail.waitForTimeout(3500);
		await s.shot(mail, "05-mailbox-open");
		s.note(`[mailbox] body sample: ${clean((await mail.innerText("body")).slice(0, 700))}`);

		// ── 5. Contacts: who the pipeline is with.
		const contacts = await s.openApp(APP.Contacts);
		await contacts.waitForTimeout(3000);
		await s.shot(contacts, "06-contacts-open");
		s.note(`[contacts] body sample: ${clean((await contacts.innerText("body")).slice(0, 500))}`);
	} finally {
		await s.finish();
	}
});
