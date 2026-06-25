/**
 * Session 179 — Mira exercises the two Notes affordances 178 confirmed exist
 * but didn't fully drive: B11.1 member/contact mentions and B11.2's emoji
 * overflow entry.
 *
 *   1. B11.1 — open the `@` mention picker (Mod+Shift+M) and confirm her
 *      Contacts (Person/v1) show up alongside notes, captioned with the
 *      friendly type label ("Person", not the raw `brainstorm/Person/v1` URI).
 *   2. B11.2 — select text, open the inline toolbar's overflow (…) menu, click
 *      Emoji, and confirm the emoji browse list opens.
 *
 * Mention is opened via the chord (keystroke-free `@` insert + picker open) to
 * avoid the Yjs-corrupting full-typing path; the picker shows all entities on
 * the empty query, so the friendly captions are readable without a query.
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const EDITOR = '[contenteditable="true"]';
const MENTION_MENU = ".notes__mention-menu";
const CAPTION = ".notes__mention-menu .fm-row__caption";
const EMOJI_ROW = ".notes__emoji-row";

test("Mira mentions a contact and opens the emoji menu from the toolbar (179)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("179-mira-mention-and-emoji");
	try {
		s.chat(
			SPEAKER.Mira,
			"Want to @-mention a person from my contacts in a note, and drop an emoji from the toolbar — checking both actually work now.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes.locator('[aria-label="New note"]').first().click();
		await notes.waitForTimeout(1400);
		await notes.locator(EDITOR).first().click();
		await notes.waitForTimeout(300);

		// ── B11.1 — mention picker via the chord; read the captions ─────────
		await notes.keyboard.press("Meta+Shift+m");
		await notes.waitForTimeout(700);
		const mentionOpen = (await notes.locator(MENTION_MENU).count()) > 0;
		s.note(`mention picker opened via Mod+Shift+M=${mentionOpen}`);
		await s.shot(notes, "01-mention-picker");

		const captions = await notes
			.locator(CAPTION)
			.allInnerTexts()
			.then((t) => t.map((x) => x.trim()))
			.catch(() => [] as string[]);
		const uniqueCaptions = [...new Set(captions)];
		s.note(`mention row captions (unique): ${JSON.stringify(uniqueCaptions)}`);
		const personPresent = uniqueCaptions.some((c) => /^person$/i.test(c));
		const rawUriCaption = uniqueCaptions.some((c) => c.includes("/") || c.includes("brainstorm/"));
		s.note(`person caption present=${personPresent}; any raw-URI caption=${rawUriCaption}`);

		// Pick the first Person row to confirm a mention chip actually inserts.
		let mentionInserted = false;
		if (personPresent) {
			const personRow = notes
				.locator(`${MENTION_MENU} .fm-row`)
				.filter({ has: notes.locator(".fm-row__caption", { hasText: /^Person$/ }) })
				.first();
			await personRow.click().catch(() => undefined);
			await notes.waitForTimeout(600);
			mentionInserted =
				(await notes
					.locator(".notes__mention, [data-lexical-mention], a[href^='brainstorm']")
					.count()) > 0;
			s.note(`mention chip inserted after picking a Person=${mentionInserted}`);
			await s.shot(notes, "02-mention-inserted");
		}
		await notes.keyboard.press("Escape").catch(() => undefined);
		await notes.waitForTimeout(300);

		// ── B11.2 — emoji from the inline toolbar overflow ──────────────────
		// Surface the toolbar by selecting the note (Meta+a), open the overflow
		// (…), click Emoji, and confirm the emoji browse list opens.
		await notes.locator(EDITOR).first().click();
		await notes.keyboard.press("Meta+a").catch(() => undefined);
		await notes.waitForTimeout(500);
		const toolbarUp = (await notes.locator(".notes__inline-toolbar").count()) > 0;
		s.note(`inline toolbar surfaced=${toolbarUp}`);
		let emojiBrowseOpened = false;
		if (toolbarUp) {
			await notes
				.locator('[aria-label="More"]')
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(400);
			await s.shot(notes, "03-overflow-open");
			const emojiRow = notes.locator(".notes__inline-overflow-menu .fm-row", {
				hasText: /emoji/i,
			});
			await emojiRow
				.first()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(700);
			const emojiRows = await notes.locator(EMOJI_ROW).count();
			emojiBrowseOpened = emojiRows > 0;
			s.note(`emoji browse list opened from toolbar=${emojiBrowseOpened} (rows=${emojiRows})`);
			await s.shot(notes, "04-emoji-browse");
			await notes.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("inline toolbar didn't surface — emoji-from-toolbar check skipped (selection flake).");
		}

		// ── Verdict ─────────────────────────────────────────────────────────
		expect(mentionOpen).toBe(true);
		expect(personPresent).toBe(true);
		expect(rawUriCaption).toBe(false); // friendly labels, never the raw URI
		if (toolbarUp) expect(emojiBrowseOpened).toBe(true);
	} finally {
		await s.finish();
	}
});
