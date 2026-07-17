/**
 * Session 905b — Mira hunts for the OTHER copy of her lessons.
 *
 * 905's deep verify hit a wall: the vault provably holds TWO copies of every
 * lesson (Database shows two "Stunden" Lists, 41 members each — one per
 * import source), yet Notes search surfaced exactly ONE row per title, and
 * the copy it surfaced had no tags, no working images, and 6× duplicated
 * body content. Which copy was that? Did the fresh zip import's copies get
 * the tags (F-394) and asset-backed images the report promised?
 *
 * The Notes list is windowed (@tanstack/react-virtual) — only the visible
 * slice is in the DOM, so 905's `count()` couldn't see past the viewport.
 * This session scrolls the search results to the very bottom, probes EVERY
 * exact-title row it passes (Properties panel open throughout), and reports
 * per-copy: tag visibility, image srcs, PDF hrefs, body multiplication.
 *
 * No imports run here — this is pure follow-up verification on 905's vault.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type CopyProbe = {
	rowIndex: number;
	title: string;
	panelText: string;
	hasKapitel: boolean;
	imgsTotal: number;
	assetImgs: number;
	assetLoaded: number;
	pdfHrefs: string[];
	h2: number;
	checkItems: number;
};

async function probeOpenDoc(page: Page): Promise<Omit<CopyProbe, "rowIndex"> | null> {
	return await page
		.evaluate(() => {
			const editor = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
			const scope: ParentNode = editor ?? document.body;
			const imgs = [...scope.querySelectorAll("img")] as HTMLImageElement[];
			const assetImgs = imgs.filter((i) =>
				(i.getAttribute("src") ?? "").startsWith("brainstorm://asset/"),
			);
			const panel = document.querySelector('[aria-label="Note properties"]') as HTMLElement | null;
			const panelText = (panel?.innerText ?? "").replace(/\s+/g, " ").slice(0, 300);
			return {
				title: document.querySelector("h1.notes__title")?.textContent?.trim() ?? "",
				panelText,
				hasKapitel: panelText.includes("Kapitel"),
				imgsTotal: imgs.length,
				assetImgs: assetImgs.length,
				assetLoaded: assetImgs.filter((i) => i.naturalWidth > 0).length,
				pdfHrefs: ([...scope.querySelectorAll("a")] as HTMLAnchorElement[])
					.filter((a) => /\.pdf/i.test(a.getAttribute("href") ?? ""))
					.slice(0, 2)
					.map((a) => (a.getAttribute("href") ?? "").slice(0, 90)),
				h2: scope.querySelectorAll("h2").length,
				checkItems: scope.querySelectorAll('li[role="checkbox"], li[aria-checked]').length,
			};
		})
		.catch(() => null);
}

test("Anytype import — find and probe every copy of a lesson (905b)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("905b-anytype-fresh-copy-probe");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(1500);
		// Dismiss any boot popover (the update card) before doing anything.
		for (let i = 0; i < 3; i++) {
			if ((await d.locator('[data-bs-region="popover-backdrop"]').count().catch(() => 0)) === 0) break;
			await d.keyboard.press("Escape").catch(() => undefined);
			await d.waitForTimeout(700);
		}

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);

		// Open some note so the Properties toggle mounts, then keep the panel
		// open for the whole hunt — the tag row is the only visible difference
		// between the two copies of a lesson.
		const anyNote = notes.locator(".notes__nav").getByText(/Stunde/).first();
		if ((await anyNote.count().catch(() => 0)) > 0) {
			await anyNote.click().catch(() => undefined);
			await notes.waitForTimeout(1500);
		}
		const showProps = notes.getByRole("button", { name: "Show properties" }).first();
		if ((await showProps.count().catch(() => 0)) > 0) {
			await showProps.click().catch(() => undefined);
			await notes.waitForTimeout(800);
		}

		/** Scroll the windowed results list top→bottom, clicking + probing every
		 *  row whose title text is exactly `title`. Virtual rows carry
		 *  data-index, which is stable across the scroll. */
		const probeAllCopies = async (title: string, shotLabel: string): Promise<CopyProbe[]> => {
			const search = notes.locator('input[placeholder*="Search" i]').first();
			await search.click().catch(() => undefined);
			await search.fill("").catch(() => undefined);
			await search.fill(title).catch(() => undefined);
			await notes.waitForTimeout(1800);

			// Scroll container inside the nav (the virtualizer's element). Mark it
			// fresh each search (clear stale marks from a previous hunt).
			const scrollInfo = await notes.evaluate(() => {
				for (const el of document.querySelectorAll("[data-bs-probe-scroll]")) {
					delete (el as HTMLElement).dataset.bsProbeScroll;
				}
				const nav = document.querySelector(".notes__nav");
				if (!nav) return null;
				const els = [nav, ...nav.querySelectorAll("*")] as HTMLElement[];
				const sc = els.find((e) => e.scrollHeight > e.clientHeight + 40);
				if (!sc) return { total: -1 };
				sc.dataset.bsProbeScroll = "1";
				sc.scrollTop = 0;
				return { total: sc.scrollHeight };
			});
			const results: CopyProbe[] = [];
			const seen = new Set<number>();
			for (let step = 0; step < 40; step++) {
				// Rows whose normalized text contains an exact-title element — the
				// results list highlights the query, splitting the title across
				// <mark>-ish children, so leaf-text equality can't work; Playwright's
				// getByText(exact) normalizes across descendants.
				const rows = notes
					.locator(".notes__nav [data-composite-index]")
					.filter({ has: notes.getByText(title, { exact: true }) });
				const n = await rows.count().catch(() => 0);
				const indices: number[] = [];
				for (let i = 0; i < n; i++) {
					const raw = await rows.nth(i).getAttribute("data-composite-index").catch(() => null);
					const idx = raw === null ? Number.NaN : Number.parseInt(raw, 10);
					if (Number.isFinite(idx)) indices.push(idx);
				}
				for (const idx of indices) {
					if (seen.has(idx)) continue;
					seen.add(idx);
					await notes
						.locator(`.notes__nav [data-composite-index="${idx}"]`)
						.first()
						.click()
						.catch(() => undefined);
					await notes.waitForTimeout(2200);
					// Let asset images resolve before judging.
					let p = await probeOpenDoc(notes);
					for (let tick = 0; tick < 12; tick++) {
						if (!p || p.assetImgs === 0 || p.assetLoaded === p.assetImgs) break;
						await notes.waitForTimeout(1000);
						p = await probeOpenDoc(notes);
					}
					if (p) {
						results.push({ rowIndex: idx, ...p });
						await s.shot(notes, `${shotLabel}-row${idx}`);
					}
				}
				const done = await notes.evaluate(() => {
					const sc = document.querySelector(
						'[data-bs-probe-scroll="1"]',
					) as HTMLElement | null;
					if (!sc) return true;
					sc.scrollTop += Math.max(200, sc.clientHeight * 0.7);
					return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 8;
				});
				await notes.waitForTimeout(600);
				if (done) break;
			}
			s.note(
				`[hunt] "${title}": scrolled the whole result list (container ${scrollInfo?.total ?? "?"}px) — found ${results.length} row(s) with that exact title`,
			);
			for (const r of results) {
				s.note(
					`    · row#${r.rowIndex}: editor-title="${r.title}" | Kapitel tag ${r.hasKapitel ? "YES" : "no"} | imgs=${r.imgsTotal} asset=${r.assetImgs} loaded=${r.assetLoaded} | pdf hrefs: ${r.pdfHrefs.join(", ") || "—"} | h2=${r.h2} checks=${r.checkItems} | panel: "${r.panelText.slice(0, 140)}"`,
				);
			}
			return results;
		};

		const s8 = await probeAllCopies("Stunde 8", "stunde-8");
		const s6 = await probeAllCopies("Stunde 6 | Natasha", "stunde-6");

		// ---- What did we learn? -------------------------------------------
		const s8withTag = s8.filter((p) => p.hasKapitel).length;
		const anyAssetImgs = [...s8, ...s6].some((p) => p.assetImgs > 0);
		const anyLoaded = [...s8, ...s6].some((p) => p.assetLoaded > 0);
		s.note(
			`[verdict] "Stunde 8" copies found: ${s8.length} (expected 2 — one per import source); with the Kapitel-9 tag visible in Properties: ${s8withTag}`,
		);
		s.note(
			`[verdict] across every copy probed: any brainstorm://asset img srcs at all: ${anyAssetImgs ? "YES" : "NO"}; any image actually rendering: ${anyLoaded ? "YES" : "NO"} — ${anyLoaded ? "the zip copy renders its screenshots" : "NO copy renders a single screenshot: even the fresh with-files import left the bodies pointing at bare filenames, so the 416-created report is only half the story"}`,
		);
	} finally {
		await s.finish();
	}
});
