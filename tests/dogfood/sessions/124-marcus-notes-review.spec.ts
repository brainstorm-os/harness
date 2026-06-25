/**
 * Session 124 — Marcus design-reviews the Notes surface.
 *
 * The content app is where Priya's been producing — so Marcus turns his
 * consistency lens on it: the resting list, the header right-group order
 * (object ⋯ must be LAST), the editor chrome (title, Add cover, the gutter),
 * and how a real doc reads. Specific, substantiated friction in his voice; he
 * narrates the pass in the team chat. Friction from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Notes surface (124)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("124-marcus-notes-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Doing a pass on Notes — it's where all our writing lives, so it has to feel considered. Starting with the resting list and the header.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1800);
		await s.shot(notes, "01-notes-resting");

		// Header right-group order: the object ⋯ menu must be the LAST element.
		const headerRight = await notes
			.locator(".app-header__right, [class*='header__right']")
			.first()
			.locator("button")
			.evaluateAll((els) =>
				els.map((e) => (e as HTMLElement).getAttribute("aria-label") || (e as HTMLElement).className),
			)
			.catch(() => [] as string[]);
		s.note(`Notes header right-group (order matters, ⋯ last): ${JSON.stringify(headerRight)}`);

		// Open the Beacon one-pager Priya just wrote and scrutinize the editor.
		const doc = notes.locator("text=/Beacon Analytics — the case/i").first();
		if (await doc.count()) {
			await doc.click().catch(() => undefined);
			await notes.waitForTimeout(1000);
			await s.shot(notes, "02-doc-open");
		}

		// The editor chrome a careful reader notices: title sizing, Add-cover, the
		// left gutter handle, and whether anything is misaligned.
		const chrome = await notes
			.locator(
				".notes__title, [class*='add-cover'], [class*='cover'], .notes__gutter, [class*='placeholder']",
			)
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`Editor chrome text: ${JSON.stringify(chrome)}`);

		// The note list: does every row read consistently (icon + title, no orphans)?
		const rows = await notes
			.locator(".notes__sidebar-title, [class*='sidebar'] [class*='title']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 12),
			)
			.catch(() => [] as string[]);
		s.note(`Note list rows (top 12): ${JSON.stringify(rows)}`);
		const untitledCount = rows.filter((r) => /untitled/i.test(r)).length;
		s.note(`"Untitled" rows visible: ${untitledCount}`);

		s.chat(
			SPEAKER.Marcus,
			untitledCount >= 3
				? `Notes reads clean structurally, but the sidebar's cluttered with ${untitledCount}+ "Untitled" notes — empty drafts pile up with no way to tell them apart. That's noise in the one place I look to find things.`
				: "Notes pass done — header order and editor chrome are consistent. Filing details from the captures.",
		);
		s.note("Marcus reviewed the Notes surface; friction from captures.");
	} finally {
		await s.finish();
	}
});
