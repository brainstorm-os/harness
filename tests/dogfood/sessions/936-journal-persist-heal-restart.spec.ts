/**
 * Session 936 — F-488 release gate for 0.13.0: does a Journal body written into
 * a day that does NOT exist yet survive a full shell restart?
 *
 * The bug: `transport.persist` swallowed the "not found" rejection that
 * `entities.applyDoc` answers while a journal day's implicit create is still
 * committing. A Yjs update is a diff, so the dropped one is never re-carried —
 * the canonical doc keeps a permanent hole, every later struct that depends on
 * it parks in `pendingStructs`, and the body renders blank forever under a
 * word-count that still reads the old snippet. dbb9a6e1 (shell #460) answers
 * the rejection by re-shipping the replica's full state on a backoff.
 *
 * This drives the exact race: land on a fresh day and write IMMEDIATELY, with
 * no settle wait, so the persist races the create. Then it closes the shell
 * completely and reopens the same persistent Northbound vault — the only way to
 * prove the bytes reached disk rather than sitting in the worker's live doc.
 *
 * Two launches, so `startSession` is called twice; the vault is persistent
 * across both (never delete tests/dogfood/.data).
 *
 * Records factual captures only; the verdict is decided in triage.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** Mirrors `SESSIONS_ROOT` in the founder harness (not exported). */
const SESSION_LOG_DIR = join(process.cwd(), "tests", "dogfood", ".sessions");

const MARKER = "F-488 restart durability probe 936";
/** Steps back from today, to land on a day the Northbound vault has never
 *  opened — that is what makes the write race an implicit create. */
const DAYS_BACK = 9;

async function appendParagraph(page: Page, text: string): Promise<string> {
	return page
		.evaluate(async (t) => {
			const dev = (
				window as unknown as { __brainstormJournalDev?: { appendParagraph(s: string): Promise<void> } }
			).__brainstormJournalDev;
			if (!dev) return "(no dev hook)";
			await dev.appendParagraph(t);
			return "ok";
		}, text)
		.catch((e) => `(threw: ${(e as Error).message})`);
}

async function currentEntryId(page: Page): Promise<string> {
	return page
		.evaluate(() => {
			const dev = (
				window as unknown as { __brainstormJournalDev?: { currentEntryId(): string | null } }
			).__brainstormJournalDev;
			return dev?.currentEntryId() ?? "(none)";
		})
		.catch((e) => `(threw: ${(e as Error).message})`);
}

async function bodyText(page: Page): Promise<string> {
	return page
		.locator(".journal__entry-editor")
		.first()
		.innerText()
		.catch(() => "(no editor)");
}

/** Walk back `days` days with the day pager. */
async function pageBack(page: Page, days: number): Promise<void> {
	for (let i = 0; i < days; i += 1) {
		await page
			.locator(".journal__day-pager .bs-date-pager__arrow--prev")
			.first()
			.click()
			.catch(() => undefined);
		await page.waitForTimeout(120);
	}
}

test("journal persist heals across a real restart (936)", async () => {
	test.setTimeout(900_000);

	// ---- Launch 1: write into a never-opened day, racing the implicit create.
	const a = await startSession("936-journal-persist-heal-restart-write");
	let entryId = "(unset)";
	try {
		const page = await a.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		a.note("\n### launch 1 — write into a never-opened day (F-488 race)");

		await pageBack(page, DAYS_BACK);
		const before = await bodyText(page);
		a.note(`day ${DAYS_BACK} back, body before write: ${JSON.stringify(before.slice(0, 120))}`);
		await a.shot(page, "journal-01-fresh-day");

		// No settle wait — the point is to race `entities.applyDoc` against the
		// day's implicit create, which is what made the old code drop the update.
		const appended = await appendParagraph(page, MARKER);
		a.note(`appendParagraph: ${appended}`);
		entryId = await currentEntryId(page);
		a.note(`entry id: ${entryId}`);

		await page.waitForTimeout(1200);
		const afterWrite = await bodyText(page);
		a.note(`body after write contains marker: ${afterWrite.includes(MARKER)}`);
		await a.shot(page, "journal-02-after-write");

		// The healing resend backs off 250/500/1000/2000/4000ms. Stay alive past
		// the whole schedule — closing inside it is a separate (known) hole.
		await page.waitForTimeout(9000);
		a.note("waited out the full persist-retry backoff before closing");
		await a.shot(page, "journal-03-after-backoff");
	} finally {
		await a.finish();
	}

	// ---- Launch 2: same vault, cold. Did the bytes reach disk?
	const b = await startSession("936-journal-persist-heal-restart-verify");
	try {
		const page = await b.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		b.note("\n### launch 2 — cold reopen of the same vault");
		b.note(`entry id written in launch 1: ${entryId}`);

		await pageBack(page, DAYS_BACK);
		await page.waitForTimeout(1400);
		const reopened = await bodyText(page);
		b.note(`body after restart: ${JSON.stringify(reopened.slice(0, 200))}`);
		b.note(`MARKER SURVIVED RESTART: ${reopened.includes(MARKER)}`);
		await b.shot(page, "journal-04-after-restart");

		// The ydoc worker now warns on load when a reconstructed doc holds
		// structs it cannot integrate (`pendingStructs`) — the durable signature
		// of exactly this bug. Its ABSENCE is the success signal for this gate;
		// its presence means a hole survived the fix.
		let unintegratable = "(console.log unreadable)";
		try {
			const log = readFileSync(
				join(SESSION_LOG_DIR, "936-journal-persist-heal-restart-verify", "console.log"),
				"utf8",
			);
			const hits = log.split("\n").filter((l) => l.includes("unintegratable structs"));
			unintegratable = hits.length === 0 ? "none" : hits.join(" | ");
		} catch {
			// best-effort — the assertion above is the primary signal
		}
		b.note(`worker pendingStructs warnings: ${unintegratable}`);
	} finally {
		await b.finish();
	}
});
