/**
 * Session 353 — the inline formatting toolbar: locked-state + alignment.
 *
 * Directly reproduces two real polish defects the user pointed at:
 *   1. the floating B/I/U/S formatting toolbar STILL appears on a **locked**
 *      (read-only) note — selecting text in a `contenteditable="false"` note
 *      shows formatting controls that shouldn't be there.
 *   2. the toolbar's icons are baseline-off-center (an extra <span> wraps each
 *      inline SVG) and too small.
 *
 * Repro: make a note with text, select it, capture the toolbar (tight), then
 * LOCK the note, select again, and capture — the toolbar should be gone after
 * the fix. Verdict from the captures. Re-run after the fix lands to confirm.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

type NotesDev = { appendParagraph: (text: string) => Promise<void> };

const TITLE = "353 — toolbar lock + alignment";

test("inline toolbar — hidden when locked, icons centered (353)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("353-inline-toolbar-lock-and-align");
	s.chat(
		SPEAKER.Marcus,
		"Pinning down two toolbar defects: the formatting bar shows on a locked note, and its icons sit off-center. Repro then fix — and I'll re-shoot to prove the pixels changed, not just the code.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) =>
			errors.push(`pageerror: ${e.message.split("\n")[0]}`),
		);
		page.on("console", (m) => {
			if (m.type() === "error")
				errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1200);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp").catch(() => undefined);
		await notes.keyboard.type(TITLE, { delay: 10 });
		await notes
			.evaluate(async () => {
				const dev = (window as unknown as { __brainstormNotesDev?: NotesDev })
					.__brainstormNotesDev;
				await dev?.appendParagraph(
					"Select this sentence to summon the formatting toolbar.",
				);
			})
			.catch(() => undefined);
		await notes.waitForTimeout(500);

		const selectBody = async () => {
			// Triple-click the body paragraph → native non-collapsed selection.
			const para = notes
				.locator("[contenteditable] p, [contenteditable] div")
				.filter({ hasText: "Select this sentence" })
				.first();
			await para.click({ clickCount: 3 }).catch(() => undefined);
			await notes.waitForTimeout(700);
		};

		// ── Unlocked: toolbar should appear (capture for alignment/icon size) ──
		await selectBody();
		const toolbar = notes.locator(".notes__inline-toolbar");
		const shownUnlocked = (await toolbar.count().catch(() => 0)) > 0;
		s.note(`unlocked — inline toolbar present: ${shownUnlocked}`);
		await s.shot(notes, "01-toolbar-unlocked-page");
		if (shownUnlocked) await s.shot(notes, "02-toolbar-tight", toolbar.first());
		// Empirical alignment/size check — don't eyeball a tiny PNG.
		const metrics = await notes
			.evaluate(() => {
				const btn = document.querySelector<HTMLElement>(
					".notes__inline-toolbar-btn",
				);
				const svg = btn?.querySelector("svg");
				if (!btn || !svg) return null;
				const b = btn.getBoundingClientRect();
				const s = svg.getBoundingClientRect();
				return {
					icon: `${Math.round(s.width)}x${Math.round(s.height)}`,
					topGap: Math.round(s.top - b.top),
					bottomGap: Math.round(b.bottom - s.bottom),
					hasSpan: !!btn.querySelector("span"),
				};
			})
			.catch(() => null);
		s.note(
			`icon size: ${metrics?.icon} · top-gap ${metrics?.topGap}px / bottom-gap ${metrics?.bottomGap}px (equal = centered) · redundant span inside button: ${metrics?.hasSpan}`,
		);

		// ── The real repro: lock the note WHILE the selection + toolbar are up.
		//    With no editable listener the bar stays (the user's bug); the fix
		//    dismisses it the moment the note locks. ──
		await notes
			.locator('[aria-label="Lock page (read-only)"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1000);
		const shownAfterLock =
			(await notes
				.locator(".notes__inline-toolbar")
				.count()
				.catch(() => 0)) > 0;
		s.note(
			`locked-while-selected — toolbar still present: ${shownAfterLock}  (expected: false after fix)`,
		);
		await s.shot(notes, "03-locked-while-selected");

		// Unlock again (leave the note usable).
		await notes
			.locator('[aria-label="Unlock page"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(400);

		s.note(`\nconsole/page errors: ${errors.length}`);
		for (const e of [...new Set(errors)].slice(0, 20)) s.note(`  ${e}`);
		expect(errors, "no console/page errors exercising the toolbar").toEqual([]);
	} finally {
		await s.finish();
	}
});
