/**
 * Session 914 — is F-422 still visible?
 *
 * F-422: the calendar was littered with chips reading "ipeline ready",
 * "peline ready", "Pipeline readyPipe…" and one literally reversed
 * (".no won morf pu d…"). The INPUT bug was F-299 and is fixed; what was
 * left owed is data repair of the historical rows.
 *
 * The calendar's own KV store now holds 20 clean milestone events, and
 * `entities.db` is encrypted so it can't be inspected from outside — so the
 * only honest way to answer "are the corrupted titles still on screen" is to
 * open the app and read the chips. Read-only: navigates and captures, never
 * edits.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** The signatures from the report — fragments, a doubled title, and reversed text. */
const CORRUPT = [/ipeline ready/, /peline ready/, /\.no won/, /morf pu/, /readyPipe/];

test("F-422: are corrupted event titles still in the calendar? (914)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("914-f422-calendar-titles");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(3500);
		await s.shot(cal, "calendar-open");

		// Collect every chip label across a few months around the reported window.
		const seen: string[] = [];
		const scan = async (label: string) => {
			const chips = cal.locator(".cal-chip");
			const n = await chips.count();
			const texts = (await chips.allTextContents().catch(() => [] as string[])).map((t) =>
				t.replace(/\s+/g, " ").trim(),
			);
			seen.push(...texts);
			s.note(`[cal] ${label}: ${n} chips — ${texts.slice(0, 12).join(" | ").slice(0, 320)}`);
			await s.shot(cal, `month-${label}`);
		};

		await scan("current");
		// Walk back a few months to cover July 2026 (the reported screenshot).
		const prev = cal.locator('[aria-label*="Previous"], [aria-label*="previous"]').first();
		for (let i = 0; i < 3 && (await prev.count()) > 0; i++) {
			await prev.click().catch(() => undefined);
			await cal.waitForTimeout(1200);
			await scan(`minus${i + 1}`);
		}

		const bad = seen.filter((t) => CORRUPT.some((re) => re.test(t)));
		s.note(`[cal] total chips scanned: ${seen.length}`);
		s.note(
			bad.length > 0
				? `[verdict:f422] STILL PRESENT — ${bad.length} corrupted title(s): ${JSON.stringify(bad.slice(0, 10))}`
				: "[verdict:f422] CLEAN — no corrupted titles in the scanned months",
		);
	} finally {
		await s.finish();
	}
});
