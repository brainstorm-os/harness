/**
 * Session 911 — Marcus design-reviews four apps that never crossed his desk:
 * Journal, Books, Preview, and Chat. The owner is uneasy that the fleet's
 * design isn't uniformly polished; these four have had no dedicated Marcus
 * rotation, so this is a breadth pass — first impression + a couple of real
 * states each — to surface where the chrome, empty states, and typography
 * drift from the apps he's already signed off.
 *
 * Spec only navigates + captures + inventories; Marcus's substantiated
 * friction is written from the screenshots afterward (never in-spec).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { SPEAKER } from "../lib/team-chat";

test("Marcus design-reviews Journal · Books · Preview · Chat (911)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("911-marcus-journal-books-preview-chat");
	s.chat(
		SPEAKER.Marcus,
		"Four apps I've never reviewed: Journal, Books, Preview, Chat. Going in cold — empty states, header chrome, typography, the first interaction each. If the fleet's polish is uneven this is where it shows.",
	);

	const errors: string[] = [];
	s.app.on("window", (page) => {
		page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(`console.error: ${m.text().split("\n")[0]}`);
		});
	});

	const inventory = async (page: import("@playwright/test").Page, label: string) => {
		const inv = await page.evaluate(() => {
			const header = document.querySelector(".app-header");
			const headerButtons = header
				? [...header.querySelectorAll("button")].map((b) =>
						(b.getAttribute("aria-label") ?? b.textContent ?? "").replace(/\s+/g, " ").trim(),
					)
				: [];
			const title = (header?.querySelector(".app-header__title")?.textContent ?? "").trim();
			const emptyState = (document.querySelector(".bs-empty-state, [class*=empty]")?.textContent ?? "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 160);
			return { title, headerButtons: headerButtons.filter(Boolean).slice(0, 12), emptyState };
		});
		s.note(`=== ${label} header title === ${JSON.stringify(inv.title)}`);
		s.note(`=== ${label} header buttons === ${JSON.stringify(inv.headerButtons)}`);
		if (inv.emptyState) s.note(`=== ${label} empty state === ${JSON.stringify(inv.emptyState)}`);
	};

	try {
		// ─────────────────────────── Journal ───────────────────────────
		const journal = await s.openApp(APP.Journal);
		await journal.waitForTimeout(1600);
		await s.shot(journal, "01-journal-first");
		await inventory(journal, "journal");
		// Open the sidebar / entry list if present, then a day entry.
		await journal
			.locator(".journal__entry, .journal-entry, [data-testid*=entry]")
			.first()
			.click()
			.catch(() => undefined);
		await journal.waitForTimeout(700);
		await s.shot(journal, "02-journal-entry");

		// ──────────────────────────── Books ────────────────────────────
		const books = await s.openApp(APP.Books);
		await books.waitForTimeout(1600);
		await s.shot(books, "03-books-first");
		await inventory(books, "books");
		await books
			.locator(".book-card, .books__item, [data-testid*=book]")
			.first()
			.click()
			.catch(() => undefined);
		await books.waitForTimeout(700);
		await s.shot(books, "04-books-detail");

		// ─────────────────────────── Preview ───────────────────────────
		const preview = await s.openApp(APP.Preview);
		await preview.waitForTimeout(1600);
		await s.shot(preview, "05-preview-first");
		await inventory(preview, "preview");

		// ──────────────────────────── Chat ─────────────────────────────
		const chat = await s.openApp(APP.Chat);
		await chat.waitForTimeout(1600);
		await s.shot(chat, "06-chat-first");
		await inventory(chat, "chat");
		// Open a channel if the rail has any.
		await chat
			.locator(".chat__channel, .channel-row, [data-testid*=channel]")
			.first()
			.click()
			.catch(() => undefined);
		await chat.waitForTimeout(700);
		await s.shot(chat, "07-chat-channel");
		// The composer surface (shared CompactEditor) — capture it focused.
		await chat
			.locator("[contenteditable=true], .bs-compact-editor__content")
			.first()
			.click()
			.catch(() => undefined);
		await chat.waitForTimeout(400);
		await s.shot(chat, "08-chat-composer");

		s.note(`=== console errors (${errors.length}) ===`);
		for (const e of errors.slice(0, 30)) s.note(e);

		s.chat(
			SPEAKER.Marcus,
			"Captured all four — first impressions plus a real interaction each. Reading the frames now; writing up what holds and what drifts against the fleet baseline.",
		);
	} finally {
		await s.finish();
	}
});
