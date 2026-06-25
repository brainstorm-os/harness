/**
 * Session 228 — DEEP Books walkthrough. Exercises the real Books surface end to
 * end: the empty-library state (and its duplicated "No books yet" — F-style
 * redundancy in BOTH the sidebar blank and the main placeholder); the "Import a
 * book" button (the native file dialog can't be driven by Playwright, so we
 * record that it opens-but-can't-be-completed and instead seed a real `Book/v1`
 * row through the capability-gated `entities.create` — Books holds
 * `entities.write:brainstorm/Book/v1`, so this is the only programmatic import
 * path and it needs NO native dialog); the library shelf (Notes-style recency
 * sections + Search books); opening a book → the reader surface; the TOC /
 * outline; page turns + the two-page spread; the book-info / properties
 * inspector (metadata renders + author edit writes back); library + book-info
 * show/hide toggles; the header ⋯ "More actions" menu (suspected no-op in the
 * empty state — we confirm PASS/FAIL); LINKS (a TOC entry that navigates the
 * reader is the closest link affordance); and PERSISTENCE across a reopen.
 *
 * EVERY action is judged from observable DOM and logged as [PASS]/[FAIL]/[?]
 * via s.note(); each step is wrapped in try/catch so a single failure never
 * aborts the walkthrough. States + failures are screenshotted.
 *
 * IMPORTANT FINDINGS baked into the script:
 *  - There is NO sample/seed opt-in affordance in the shell UI: the
 *    `library.openSample` i18n key is ORPHANED (never rendered); the in-memory
 *    sample book only opens on the standalone (no-vault) preview build, so it's
 *    unreachable here. We therefore seed via `entities.create`.
 *  - There is NO `window.__brainstorm*Dev` hook for Books (unlike Notes).
 *  - A real PDF reader (canvas pages, spread, PDF outline TOC) needs a backing
 *    `File/v1` with a fetchable `brainstorm://asset/<id>` URL, which only the
 *    native `files.import` picker can produce — so the rendered PDF page / spread
 *    can't be fully driven here. We seed (a) an EPUB book (lists + selects +
 *    inspector + the honest "EPUB not built yet" reader notice) and (b) a PDF
 *    book with a bogus fileId (verifies the "Couldn't open" failure path), and
 *    record that the live PDF render is undriveable without the dialog.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const BOOK_ENTITY_TYPE = "brainstorm/Book/v1";

/** A Book/v1 property record, mirroring `serializeBook` in
 *  apps/books/src/logic/book-codec.ts. Seeded directly through the
 *  capability-gated entities service — no native file dialog involved. */
function bookRecord(args: {
	id: string;
	name: string;
	author: string;
	format: "epub" | "pdf";
	fileId: string | null;
	now: number;
}): Record<string, unknown> {
	return {
		id: args.id,
		name: args.name,
		icon: null,
		format: args.format,
		author: args.author,
		fileId: args.fileId,
		spineLength: 0,
		reading: { position: null, progress: 0, lastReadAt: null },
		createdAt: args.now,
		updatedAt: args.now,
	};
}

/** Create a Book/v1 in the live vault from inside the Books renderer, returning
 *  the new id or an error string. Uses `window.brainstorm.services.entities`,
 *  the exact surface the Books app itself imports through. */
async function seedBook(
	page: import("@playwright/test").Page,
	record: Record<string, unknown>,
): Promise<string> {
	return page.evaluate(
		async ({ type, rec }) => {
			const bs = (
				window as unknown as {
					brainstorm?: {
						services?: {
							entities?: {
								create?: (
									t: string,
									props: Record<string, unknown>,
									id?: string,
								) => Promise<{ id?: unknown }>;
							} | null;
						} | null;
					};
				}
			).brainstorm;
			const create = bs?.services?.entities?.create;
			if (!create) return "no-entities-create";
			try {
				const reply = await create(type, rec, rec.id as string);
				return typeof reply?.id === "string" ? (reply.id as string) : (rec.id as string);
			} catch (e) {
				return `create-threw: ${(e as Error).message}`;
			}
		},
		{ type: BOOK_ENTITY_TYPE, rec: record },
	);
}

test("deep books walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-books");

	// `step` runs one probe, never throws, and records exactly one PASS/FAIL/?.
	const step = async (label: string, fn: () => Promise<string>): Promise<void> => {
		try {
			const observed = await fn();
			s.note(observed);
		} catch (error) {
			s.note(`[FAIL] ${label} — threw: ${(error as Error).message}`);
		}
	};

	try {
		const books = await s.openApp(APP.Books);
		await books.waitForTimeout(2600);
		await s.shot(books, "00-launch");

		// --- Empty-library state -------------------------------------------------
		await step("empty library state", async () => {
			const sidebarBlank = await books
				.locator(".books__library-blank-title")
				.first()
				.innerText()
				.catch(() => "");
			const mainBlank = await books
				.locator(".books__notice-title")
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(books, "01-empty-library");
			const sidebarSaysNoBooks = /no books/i.test(sidebarBlank);
			const mainSaysNoBooks = /no books/i.test(mainBlank);
			if (sidebarSaysNoBooks && mainSaysNoBooks) {
				return `[PASS] empty library — duplicated "No books yet" in BOTH sidebar ("${sidebarBlank}") AND main ("${mainBlank}") (F-style redundancy confirmed)`;
			}
			if (sidebarSaysNoBooks || mainSaysNoBooks) {
				return `[?] empty library — only one surface shows "No books yet" (sidebar="${sidebarBlank}", main="${mainBlank}")`;
			}
			return `[?] empty library — no "No books yet" copy found (sidebar="${sidebarBlank}", main="${mainBlank}"); vault may already hold books from a prior session`;
		});

		// --- Sample opt-in: confirm it is ABSENT --------------------------------
		await step("sample opt-in affordance", async () => {
			const sampleBtn = books.locator(
				'button:has-text("sample"), [aria-label*="sample" i], .books__library-import-cta:has-text("sample")',
			);
			const count = await sampleBtn.count().catch(() => 0);
			return count > 0
				? `[?] a sample/seed affordance IS present (${count}) — unexpected; library.openSample key may have been wired`
				: "[PASS] no sample opt-in in shell UI (library.openSample is an orphaned i18n key; sample only opens on the standalone no-vault preview) — seeding via entities.create instead";
		});

		// --- "Import a book" button --------------------------------------------
		// The CTA exists in the empty shelf AND a header +/Import button exists.
		// Clicking opens the OS file dialog, which Playwright can't complete — we
		// assert the button is present + enabled, do NOT click it (a modal native
		// dialog would hang the session), and record the dialog as undriveable.
		await step("Import a book button present", async () => {
			const cta = books.locator(".books__library-import-cta").first();
			const headerImport = books.locator('[aria-label="Import a book"]').first();
			const ctaVisible = await cta.isVisible().catch(() => false);
			const headerVisible = await headerImport.isVisible().catch(() => false);
			await s.shot(books, "02-import-affordances");
			if (ctaVisible || headerVisible) {
				return `[PASS] "Import a book" affordance present (empty-shelf CTA=${ctaVisible}, header button=${headerVisible}) — NOT clicked: it opens a native OS file dialog that Playwright cannot complete, so import-via-dialog is UNDRIVEABLE in this harness; seeding programmatically below`;
			}
			return "[FAIL] no Import affordance found (neither empty-shelf CTA nor header button)";
		});

		// --- Programmatic import (the only driveable path) ----------------------
		const now = Date.now();
		const epubId = `bk_epub_${now}`;
		const pdfId = `bk_pdf_${now}`;
		await step("seed EPUB Book/v1 via entities.create", async () => {
			const id = await seedBook(
				books,
				bookRecord({
					id: epubId,
					name: "Deep Work",
					author: "Cal Newport",
					format: "epub",
					fileId: null,
					now,
				}),
			);
			return id === epubId
				? `[PASS] seeded EPUB book "${id}" through capability-gated entities.create (entities.write:brainstorm/Book/v1)`
				: `[FAIL] EPUB seed returned "${id}" (expected ${epubId})`;
		});
		await step("seed PDF Book/v1 (bogus fileId, failure-path probe)", async () => {
			const id = await seedBook(
				books,
				bookRecord({
					id: pdfId,
					name: "The Pragmatic Programmer",
					author: "Hunt & Thomas",
					format: "pdf",
					fileId: "file_does_not_exist",
					now: now + 1,
				}),
			);
			return id === pdfId
				? `[PASS] seeded PDF book "${id}" (no real file — exercises the "Couldn't open" path)`
				: `[FAIL] PDF seed returned "${id}" (expected ${pdfId})`;
		});
		await books.waitForTimeout(1600);
		await s.shot(books, "03-after-seed");

		// --- Library shelf lists the seeded books -------------------------------
		await step("library lists seeded books", async () => {
			const rows = books.locator(".books__row");
			const n = await rows.count().catch(() => 0);
			const titles = await books
				.locator(".books__row-title")
				.allInnerTexts()
				.catch(() => [] as string[]);
			const hasEpub = titles.some((t) => /Deep Work/.test(t));
			const hasPdf = titles.some((t) => /Pragmatic/.test(t));
			return hasEpub && hasPdf
				? `[PASS] shelf shows ${n} rows incl. both seeded books — titles: ${JSON.stringify(titles)}`
				: `[FAIL] seeded books missing from shelf (rows=${n}, titles=${JSON.stringify(titles)}, hasEpub=${hasEpub}, hasPdf=${hasPdf})`;
		});

		// --- Notes-style recency sections ---------------------------------------
		await step("library recency sections render", async () => {
			const sections = await books
				.locator(".books__library-section")
				.allInnerTexts()
				.catch(() => [] as string[]);
			return sections.length > 0
				? `[PASS] Notes-style recency sections present: ${JSON.stringify(sections)}`
				: "[?] no recency section headings found (.books__library-section)";
		});

		// --- Search books -------------------------------------------------------
		await step("Search books filters the shelf", async () => {
			const search = books.locator('[aria-label="Search books"]').first();
			await search.click().catch(() => undefined);
			await search.fill("Pragmatic").catch(() => undefined);
			await books.waitForTimeout(700);
			const titlesAfter = await books
				.locator(".books__row-title")
				.allInnerTexts()
				.catch(() => [] as string[]);
			await s.shot(books, "04-search-pragmatic");
			const onlyPdf =
				titlesAfter.some((t) => /Pragmatic/.test(t)) && !titlesAfter.some((t) => /Deep Work/.test(t));
			// No-results probe.
			await search.fill("zzzznotabook").catch(() => undefined);
			await books.waitForTimeout(600);
			const noResults = await books
				.locator(".books__library-noresults")
				.first()
				.isVisible()
				.catch(() => false);
			await search.fill("").catch(() => undefined);
			await books.waitForTimeout(500);
			return onlyPdf
				? `[PASS] search "Pragmatic" filtered shelf to the PDF only (${JSON.stringify(titlesAfter)}); no-results state for a miss: ${noResults}`
				: `[?] search did not filter as expected (after="${JSON.stringify(titlesAfter)}", noResultsForMiss=${noResults})`;
		});

		// --- Open a book → reader surface ---------------------------------------
		// EPUB: the reader should land on the honest "EPUB not built yet" notice.
		await step("open EPUB book → EPUB-pending notice", async () => {
			const epubRow = books.locator(".books__row", { hasText: "Deep Work" }).first();
			await epubRow.click().catch(() => undefined);
			await books.waitForTimeout(1800);
			await s.shot(books, "05-epub-open");
			const notice = await books
				.locator(".books__notice-text")
				.first()
				.innerText()
				.catch(() => "");
			const headerTitle = await books
				.locator(".app-header__title")
				.first()
				.innerText()
				.catch(() => "");
			const isEpubPending = /EPUB|isn't built|not built/i.test(notice);
			return isEpubPending
				? `[PASS] EPUB opens to the honest "not built yet" notice ("${notice}"); header title = "${headerTitle}"`
				: `[?] EPUB reader notice unexpected ("${notice}"); header title = "${headerTitle}"`;
		});

		// --- Book-info / properties inspector ------------------------------------
		await step("inspector renders metadata", async () => {
			// Ensure the inspector is shown (it defaults open when a book is selected).
			const inspector = books.locator(".bs-props").first();
			const open = await inspector.isVisible().catch(() => false);
			const inspectorText = await inspector.innerText().catch(() => "");
			await s.shot(books, "06-inspector");
			const showsAuthor = /Cal Newport|Author/i.test(inspectorText);
			const showsFormat = /EPUB|Format/i.test(inspectorText);
			const showsMeta = /Added|Last read|Never/i.test(inspectorText);
			return open && (showsAuthor || showsFormat || showsMeta)
				? `[PASS] inspector open with metadata (author=${showsAuthor}, format=${showsFormat}, meta=${showsMeta})`
				: `[FAIL] inspector missing/empty (open=${open}, author=${showsAuthor}, format=${showsFormat}, meta=${showsMeta})`;
		});

		// --- Edit a property (author) writes back -------------------------------
		await step("edit author property persists to vault", async () => {
			const newAuthor = "Calvin Newport";
			// The shared properties-panel renders editable text cells; target the
			// author row's input/contenteditable within the inspector.
			const inspector = books.locator(".bs-props").first();
			const authorCell = inspector.locator('input, [contenteditable="true"], textarea').first();
			let edited = false;
			if (await authorCell.count().catch(() => 0)) {
				await authorCell.click().catch(() => undefined);
				await authorCell.fill?.(newAuthor).catch(() => undefined);
				// contenteditable has no fill — fall back to select-all + type.
				await books.keyboard.press("Meta+a").catch(() => undefined);
				await books.keyboard.type(newAuthor, { delay: 8 }).catch(() => undefined);
				await books.keyboard.press("Tab").catch(() => undefined);
				await books.waitForTimeout(800);
				edited = true;
			}
			await s.shot(books, "07-author-edited");
			// Verify against the live vault row, the source of truth.
			const stored = await books.evaluate(
				async ({ id }) => {
					const get = (
						window as unknown as {
							brainstorm?: {
								services?: { entities?: { get?: (i: string) => Promise<unknown> } | null } | null;
							};
						}
					).brainstorm?.services?.entities?.get;
					if (!get) return "no-get";
					const row = (await get(id).catch(() => null)) as {
						properties?: { author?: unknown };
					} | null;
					return (row?.properties?.author as string) ?? "<none>";
				},
				{ id: epubId },
			);
			if (!edited)
				return `[?] no editable author cell found in inspector — could not attempt edit (stored author="${stored}")`;
			return stored === newAuthor
				? `[PASS] author edit wrote back to vault (stored="${stored}")`
				: `[?] author edit not reflected in vault row yet (stored="${stored}", expected "${newAuthor}") — cell editing may use a different commit gesture`;
		});

		// --- Table of contents ---------------------------------------------------
		// EPUB has no live reader, so its TOC is empty (the honest state). We
		// assert the Contents section renders + record whether entries exist.
		await step("TOC / Contents section renders", async () => {
			const tocSection = books.locator(".books__toc").first();
			const tocVisible = await tocSection.isVisible().catch(() => false);
			const tocLinks = books.locator(".books__toc-link");
			const linkCount = await tocLinks.count().catch(() => 0);
			const emptyVisible = await books
				.locator(".books__toc-empty")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(books, "08-toc");
			if (linkCount > 0) {
				// LINK PRIORITY: click a TOC entry and assert the reader navigates.
				const before = await books
					.locator(".books__status")
					.first()
					.innerText()
					.catch(() => "");
				await tocLinks
					.nth(Math.min(1, linkCount - 1))
					.click()
					.catch(() => undefined);
				await books.waitForTimeout(800);
				const after = await books
					.locator(".books__status")
					.first()
					.innerText()
					.catch(() => "");
				await s.shot(books, "08b-toc-navigated");
				return after !== before
					? `[PASS] TOC link navigated the reader (status "${before}" → "${after}")`
					: `[?] TOC link clicked but reader status unchanged ("${after}") — navigation may not have moved the page`;
			}
			return tocVisible && emptyVisible
				? "[PASS] Contents section renders its honest empty state for an EPUB (no live reader → no outline) — no clickable TOC links to follow"
				: `[?] TOC section state unclear (visible=${tocVisible}, links=${linkCount}, empty=${emptyVisible})`;
		});

		// --- Page turn / spread (PDF reader is undriveable without a real file) ---
		await step("page-turn / two-page spread", async () => {
			const next = books.locator('[aria-label="Next page"]').first();
			const prev = books.locator('[aria-label="Previous page"]').first();
			const navPresent =
				(await next.count().catch(() => 0)) > 0 || (await prev.count().catch(() => 0)) > 0;
			if (!navPresent) {
				return "[PASS] no page-nav footer for the EPUB (expected — the reflow/PDF reader only mounts for openable content; the live PDF render with canvas pages + two-page spread needs a real File/v1 from the native import dialog, which is UNDRIVEABLE here)";
			}
			const before = await books
				.locator(".books__status")
				.first()
				.innerText()
				.catch(() => "");
			await next.click().catch(() => undefined);
			await books.waitForTimeout(600);
			const after = await books
				.locator(".books__status")
				.first()
				.innerText()
				.catch(() => "");
			const isSpread = /Pages\s+\d+–\d+/.test(after) || /Pages\s+\d+-\d+/.test(after);
			return after !== before
				? `[PASS] page turned (status "${before}" → "${after}"); spread mode=${isSpread}`
				: `[?] page-nav present but status unchanged ("${after}")`;
		});

		// --- Library + book-info show/hide toggles ------------------------------
		await step("library show/hide toggle", async () => {
			const lib = books.locator("#books-library").first();
			const toggle = books.locator('[aria-label="Hide library"], [aria-label="Show library"]').first();
			await toggle.click().catch(() => undefined);
			await books.waitForTimeout(500);
			const hiddenClass = await lib.getAttribute("class").catch(() => "");
			await s.shot(books, "09-library-hidden");
			const collapsed = (hiddenClass ?? "").includes("books__library--closed");
			await toggle.click().catch(() => undefined); // restore
			await books.waitForTimeout(400);
			return collapsed
				? "[PASS] library toggle collapses the shelf (class → books__library--closed)"
				: `[?] library toggle did not add --closed (class="${hiddenClass}")`;
		});
		await step("book-info show/hide toggle", async () => {
			const toggle = books
				.locator('[aria-label="Hide book info"], [aria-label="Show book info"]')
				.first();
			const before = await books
				.locator(".bs-props--open")
				.count()
				.catch(() => 0);
			await toggle.click().catch(() => undefined);
			await books.waitForTimeout(500);
			const after = await books
				.locator(".bs-props--open")
				.count()
				.catch(() => 0);
			await s.shot(books, "10-bookinfo-toggled");
			return after !== before
				? `[PASS] book-info toggle changed inspector open-state (open count ${before} → ${after})`
				: `[?] book-info toggle had no observable effect (open count stayed ${before})`;
		});

		// --- Header ⋯ "More actions" menu ----------------------------------------
		// Open with a book selected (the ⋯ is disabled for sample/none) and assert
		// whether a menu actually appears.
		await step("header ⋯ More actions menu", async () => {
			const more = books.locator('[aria-label="More actions"]').first();
			const disabled = await more.isDisabled().catch(() => false);
			await more.click().catch(() => undefined);
			await books.waitForTimeout(600);
			const menuVisible = await books
				.locator(".fm-menu, [role='menu'], [role='listbox']")
				.first()
				.isVisible()
				.catch(() => false);
			await s.shot(books, "11-more-menu");
			await books.keyboard.press("Escape").catch(() => undefined);
			if (disabled) {
				return `[?] ⋯ More actions is DISABLED with this selection — no menu (matches the "opens nothing" suspicion when no removable book is active)`;
			}
			return menuVisible
				? "[PASS] ⋯ More actions opened a fancy-menu (e.g. Remove from library)"
				: "[FAIL] ⋯ More actions clicked but NO menu appeared — confirms the suspected no-op";
		});

		// --- Open the PDF book → "Couldn't open" failure path -------------------
		await step("open PDF (bogus file) → failure notice", async () => {
			const pdfRow = books.locator(".books__row", { hasText: "Pragmatic" }).first();
			await pdfRow.click().catch(() => undefined);
			await books.waitForTimeout(2500);
			const notice = await books
				.locator(".books__notice-text")
				.first()
				.innerText()
				.catch(() => "");
			await s.shot(books, "12-pdf-failure");
			const failed = /Couldn't open|couldn't open|open/i.test(notice) && !/EPUB/i.test(notice);
			return failed
				? `[PASS] PDF with a missing file falls to the honest failure notice ("${notice}") rather than spinning forever`
				: `[?] PDF open notice unexpected ("${notice}") — may still be loading or showed a different state`;
		});

		// --- Persistence: reopen the app ----------------------------------------
		await step("persistence — books survive an app reopen", async () => {
			await books.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(800);
			const reopened = await s.openApp(APP.Books);
			await reopened.waitForTimeout(2600);
			const titles = await reopened
				.locator(".books__row-title")
				.allInnerTexts()
				.catch(() => [] as string[]);
			await s.shot(reopened, "13-after-reopen");
			const hasEpub = titles.some((t) => /Deep Work/.test(t));
			const hasPdf = titles.some((t) => /Pragmatic/.test(t));
			// Confirm the edited author survived too.
			const storedAuthor = await reopened.evaluate(
				async ({ id }) => {
					const get = (
						window as unknown as {
							brainstorm?: {
								services?: { entities?: { get?: (i: string) => Promise<unknown> } | null } | null;
							};
						}
					).brainstorm?.services?.entities?.get;
					if (!get) return "no-get";
					const row = (await get(id).catch(() => null)) as {
						properties?: { author?: unknown };
					} | null;
					return (row?.properties?.author as string) ?? "<none>";
				},
				{ id: epubId },
			);
			return hasEpub && hasPdf
				? `[PASS] both seeded books persisted across reopen (titles=${JSON.stringify(titles)}, stored author="${storedAuthor}")`
				: `[FAIL] seeded books did not persist (titles=${JSON.stringify(titles)}, hasEpub=${hasEpub}, hasPdf=${hasPdf})`;
		});
	} finally {
		await s.finish();
	}
});
