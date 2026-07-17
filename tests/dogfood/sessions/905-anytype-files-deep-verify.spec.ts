/**
 * Session 905 — Mira re-imports her Anytype space, this time WITH the files.
 *
 * Session 904 proved the wizard works but her export was JSON-only — every
 * screenshot and PDF was reported missing (406 of them, F-396). The owner's
 * fix (shell #181, binary slug matching) shipped to main, and Mira re-exported
 * from Anytype with "include files" on: a 460MB zip — 618 snapshots + 457
 * binaries. Today is the DEEP verify against the owner's acceptance bar:
 *
 *   "documents should have proper blocks, file blocks and properties and titles"
 *
 * 1. Import run: preview count, run report (expect missing ≈38, NOT 406).
 * 2. Blocks: "Stunde 8" (2×h1, 9×h2, 20×h3, 58 numbered, 15 bullets in the
 *    export) + "Stunde 27 | Natasha" (20 checkboxes) render as REAL Lexical
 *    blocks — headings/lists/checkbox items, not paragraphs.
 * 3. File blocks: "Stunde 6 | Natasha" (28 images in the export) shows <img>
 *    elements with brainstorm://asset/ srcs that ACTUALLY load
 *    (naturalWidth > 0); "Stunde 8"'s PDF file block renders something
 *    sensible and its File entity exists (Files app).
 * 4. Properties: "Stunde 8" wears its Anytype tag ("Kapitel 9") in the
 *    Properties panel (F-394 fix live).
 * 5. Titles: real titles in the editor h1 and in Files/Database rows.
 * 6. Idempotency: a second run of the same zip updates instead of creating,
 *    and the images still render.
 *
 * Harness note: the native picker is stubbed main-side to answer with the zip
 * path (the 904/330/336/342 pattern); everything downstream — zip read, parse,
 * preview, run, asset sealing — is the real wizard code path. Generous
 * timeouts: the pick loads a 460MB zip and the run seals ~420 binaries.
 */

import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, NORTHBOUND_DATA_DIR, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

const ZIP_PATH = "/Users/admin/Downloads/Anytype.20260717.145135.3.zip";

/** Parse "Imported — N created, M updated, K failed." into numbers. */
function parseReport(text: string): { created: number; updated: number; failed: number } | null {
	const m = text.match(/(\d+)\s+created,\s+(\d+)\s+updated,\s+(\d+)\s+failed/);
	if (!m || !m[1] || !m[2] || !m[3]) return null;
	return {
		created: Number.parseInt(m[1], 10),
		updated: Number.parseInt(m[2], 10),
		failed: Number.parseInt(m[3], 10),
	};
}

/** Parse the F-395 media line: "N referenced file(s) was/were not included…". */
function parseMissing(text: string): number | null {
	const m = text.match(/(\d+)\s+referenced files?\s+(?:was|were)\s+not included/);
	return m?.[1] ? Number.parseInt(m[1], 10) : null;
}

/** Vault dir size in MB (du -sk) — evidence for asset-store growth per run. */
function vaultSizeMb(): number {
	try {
		const out = execSync(`du -sk "${NORTHBOUND_DATA_DIR}"`, { encoding: "utf8" });
		return Math.round(Number.parseInt(out.split("\t")[0] ?? "0", 10) / 1024);
	} catch {
		return -1;
	}
}

/** Everything Mira can see about the currently open note, from the DOM. */
type DocProbe = {
	title: string;
	h1Body: number; // h1 headings EXCLUDING the title node
	h2: number;
	h3: number;
	ul: number;
	ol: number;
	li: number;
	checkItems: number;
	imgsTotal: number;
	assetImgs: number; // <img src="brainstorm://asset/…">
	assetLoaded: number; // …of those, naturalWidth > 0
	brokenSrcSample: string[];
	pdfLinks: Array<{ text: string; href: string }>;
	bodyChars: number;
	panelText: string; // Properties panel content (empty when closed)
};

async function probeDoc(page: Page): Promise<DocProbe | null> {
	return await page
		.evaluate(() => {
			const editor = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
			const scope: ParentNode = editor ?? document.body;
			const title = document.querySelector("h1.notes__title")?.textContent?.trim() ?? "";
			const q = (sel: string) => scope.querySelectorAll(sel).length;
			const imgs = [...scope.querySelectorAll("img")] as HTMLImageElement[];
			const assetImgs = imgs.filter((i) =>
				(i.getAttribute("src") ?? "").startsWith("brainstorm://asset/"),
			);
			const panel = document.querySelector('[aria-label="Note properties"]') as HTMLElement | null;
			return {
				title,
				h1Body: [...scope.querySelectorAll("h1")].filter(
					(h) => !(h as HTMLElement).classList.contains("notes__title"),
				).length,
				h2: q("h2"),
				h3: q("h3"),
				ul: q("ul"),
				ol: q("ol"),
				li: q("li"),
				checkItems: q('li[role="checkbox"], li[aria-checked]'),
				imgsTotal: imgs.length,
				assetImgs: assetImgs.length,
				assetLoaded: assetImgs.filter((i) => i.naturalWidth > 0).length,
				brokenSrcSample: imgs
					.filter((i) => !(i.getAttribute("src") ?? "").startsWith("brainstorm://asset/"))
					.slice(0, 3)
					.map((i) => (i.getAttribute("src") ?? "").slice(0, 90)),
				pdfLinks: ([...scope.querySelectorAll("a")] as HTMLAnchorElement[])
					.filter(
						(a) =>
							/\.pdf/i.test(a.getAttribute("href") ?? "") || /\.pdf/i.test(a.textContent ?? ""),
					)
					.slice(0, 4)
					.map((a) => ({
						text: (a.textContent ?? "").slice(0, 60),
						href: (a.getAttribute("href") ?? "").slice(0, 100),
					})),
				bodyChars: (editor?.innerText ?? "").length,
				panelText: (panel?.innerText ?? "").replace(/\s+/g, " ").slice(0, 400),
			};
		})
		.catch(() => null);
}

test("Anytype with-files import — blocks, file blocks, properties, titles (905)", async () => {
	test.setTimeout(3_000_000);
	const s = await startSession("905-anytype-files-deep-verify");
	try {
		const d = s.dashboard;
		const dErrs = collectConsoleErrors(d);
		await d.waitForTimeout(1500);
		const sizeBefore = vaultSizeMb();

		// Stub the native picker to answer with the 460MB with-files zip.
		await s.app.evaluate(({ dialog }, zip) => {
			dialog.showOpenDialog = (async () => ({
				canceled: false,
				filePaths: [zip],
			})) as typeof dialog.showOpenDialog;
		}, ZIP_PATH);

		// A modal popover can greet the dashboard on boot (the v0.5.0 update /
		// What's-New card shipped since 904) — its backdrop swallows every click,
		// so acknowledge and dismiss it before doing anything.
		for (let i = 0; i < 3; i++) {
			const backdrop = d.locator('[data-bs-region="popover-backdrop"]');
			if ((await backdrop.count().catch(() => 0)) === 0) break;
			if (i === 0) {
				s.note(
					"[boot] a popover was up when the app opened (the update card, most likely) — dismissing it before I can get to Settings",
				);
				await s.shot(d, "boot-popover");
			}
			await d.keyboard.press("Escape").catch(() => undefined);
			await d.waitForTimeout(700);
			if ((await backdrop.count().catch(() => 0)) > 0) {
				await d
					.locator('.popover [aria-label="Close"], [data-bs-region="popover-backdrop"][aria-label="Close"]')
					.first()
					.click({ timeout: 3000 })
					.catch(() => undefined);
				await d.waitForTimeout(700);
			}
		}

		// ---- Settings → Backup & Migration --------------------------------
		await d.getByRole("button", { name: "Settings", exact: true }).first().click();
		await d.waitForTimeout(1000);
		await d.locator(".settings__nav-item", { hasText: "Backup & Migration" }).first().click();
		await d.waitForTimeout(1000);
		const card = d.locator('[data-testid="backup-migration-anytype"]');
		await expect(card).toBeVisible({ timeout: 15_000 });
		await card.scrollIntoViewIfNeeded().catch(() => undefined);
		await s.shot(d, "anytype-card");

		// ---- Pick the 460MB zip → preview ---------------------------------
		// The pick reads + inflates the whole archive in the main process, so
		// the form can take a while to appear.
		await d.locator('[data-testid="backup-migration-anytype-pick"]').click();
		const form = d.locator('[data-testid="backup-migration-anytype-form"]');
		await form.waitFor({ state: "visible", timeout: 300_000 });
		const sourceLine = ((await form.textContent().catch(() => "")) ?? "").trim();
		const objectCount = Number.parseInt(sourceLine.match(/—\s*(\d+)\s+objects/)?.[1] ?? "-1", 10);
		s.note(
			`[preview] the 460MB zip loaded; wizard says: "${sourceLine.slice(0, 140)}" — ${objectCount} objects parsed out of 618 snapshots (rest are relations/types/options/file-objects, as expected)`,
		);
		await s.shot(d, "anytype-preview-zip");

		// ---- Run 1 — the with-files import --------------------------------
		const runStart1 = Date.now();
		await d.locator('[data-testid="backup-migration-anytype-run"]').click();
		const done = d.locator('[data-testid="backup-migration-anytype-done"]');
		await done.waitFor({ state: "visible", timeout: 1_500_000 });
		const run1Secs = Math.round((Date.now() - runStart1) / 1000);
		const report1Text = ((await done.textContent().catch(() => "")) ?? "").trim();
		const report1 = parseReport(report1Text);
		const missing1 = parseMissing(report1Text);
		const sizeAfterRun1 = vaultSizeMb();
		s.note(
			`[run1] ${run1Secs}s: "${report1Text.slice(0, 320)}" → created=${report1?.created ?? "?"} updated=${report1?.updated ?? "?"} failed-rows=${report1?.failed ?? "?"}; missing media=${missing1 ?? "?"} (904's JSON-only export said 406 — the bar is ≈38, the name-less file objects)`,
		);
		s.note(
			`[run1] vault on disk: ${sizeBefore}MB → ${sizeAfterRun1}MB (+${sizeAfterRun1 - sizeBefore}MB — my screenshots and PDFs are actually IN there now)`,
		);
		await s.shot(d, "anytype-run1-report");

		// ---- Run 2 — same zip again via the F-395 "Import another export…" -
		const again = d.locator('[data-testid="backup-migration-anytype-done-again"]');
		const againThere = (await again.count().catch(() => 0)) > 0;
		s.note(
			`[run2] the done state ${againThere ? 'has the "Import another export…" button now (F-395 fixed — last time I had to leave the section and come back)' : "STILL has no way to run another import (F-395 regressed?)"}`,
		);
		if (againThere) {
			await again.click();
		} else {
			await d.locator(".settings__nav-item", { hasText: "Data" }).first().click();
			await d.waitForTimeout(600);
			await d.locator(".settings__nav-item", { hasText: "Backup & Migration" }).first().click();
			await d.waitForTimeout(1000);
		}
		await d.locator('[data-testid="backup-migration-anytype-pick"]').click();
		await form.waitFor({ state: "visible", timeout: 300_000 });
		const runStart2 = Date.now();
		await d.locator('[data-testid="backup-migration-anytype-run"]').click();
		await done.waitFor({ state: "visible", timeout: 1_500_000 });
		const run2Secs = Math.round((Date.now() - runStart2) / 1000);
		const report2Text = ((await done.textContent().catch(() => "")) ?? "").trim();
		const report2 = parseReport(report2Text);
		const missing2 = parseMissing(report2Text);
		const sizeAfterRun2 = vaultSizeMb();
		const idempotent = report2 !== null && report2.created === 0 && report2.updated > 0;
		s.note(
			`[run2] ${run2Secs}s: "${report2Text.slice(0, 320)}" → created=${report2?.created ?? "?"} updated=${report2?.updated ?? "?"} missing=${missing2 ?? "?"} — ${idempotent ? "clean update, no duplicates created" : "NOT a clean update (want created=0, updated>0)"}`,
		);
		s.note(
			`[run2] vault on disk after the re-run: ${sizeAfterRun1}MB → ${sizeAfterRun2}MB (+${sizeAfterRun2 - sizeAfterRun1}MB — an update run that creates nothing should not cost me another half-gigabyte)`,
		);
		await s.shot(d, "anytype-run2-report");

		await d.keyboard.press("Escape").catch(() => undefined);
		await d.waitForTimeout(600);
		if (dErrs.errors.length > 0) for (const e of dErrs.errors.slice(0, 4)) s.note(`    dashboard: ${e}`);

		// ---- Notes: deep-verify the documents ------------------------------
		const notes = await s.openApp(APP.Notes);
		const nErrs = collectConsoleErrors(notes);
		await notes.waitForTimeout(3000);

		/** Search for `title` in the nav and probe every exact-match copy the
		 *  vault holds (904's JSON-only import + today's zip import both live in
		 *  this vault — dedupe is keyed on the archive name, so the same lesson
		 *  can exist twice). Returns the copies' probes in nav order; leaves the
		 *  hits locator live so a caller can re-click a chosen copy. */
		const searchHits = (title: string) =>
			notes.locator(".notes__nav").getByText(title, { exact: true });
		const probeCopies = async (title: string): Promise<DocProbe[]> => {
			const search = notes.locator('input[placeholder*="Search" i]').first();
			await search.click().catch(() => undefined);
			await search.fill("").catch(() => undefined);
			await search.fill(title).catch(() => undefined);
			await notes.waitForTimeout(1500);
			const hits = searchHits(title);
			const n = await hits.count().catch(() => 0);
			const probes: DocProbe[] = [];
			for (let i = 0; i < Math.min(n, 3); i++) {
				await hits.nth(i).click().catch(() => undefined);
				await notes.waitForTimeout(2500);
				// Give brainstorm://asset/ images time to resolve before judging.
				let p = await probeDoc(notes);
				for (let tick = 0; tick < 15; tick++) {
					if (!p || p.assetImgs === 0 || p.assetLoaded === p.assetImgs) break;
					await notes.waitForTimeout(1000);
					p = await probeDoc(notes);
				}
				if (p) probes.push(p);
			}
			s.note(
				`[notes] "${title}": ${n} cop${n === 1 ? "y" : "ies"} in the sidebar${n > 1 ? " — my 904 JSON-only import and today's zip import are BOTH here; same lessons, twice" : ""}`,
			);
			return probes;
		};
		/** Re-click copy `index` of `title` so the screen shows the copy the
		 *  notes talk about (probing leaves the LAST copy open, not the best). */
		const showCopy = async (title: string, probes: DocProbe[], chosen: DocProbe | null) => {
			const index = chosen ? probes.indexOf(chosen) : -1;
			if (index < 0 || index === probes.length - 1) return;
			await searchHits(title).nth(index).click().catch(() => undefined);
			await notes.waitForTimeout(2500);
		};
		const best = (probes: DocProbe[]): DocProbe | null =>
			probes.length === 0
				? null
				: ([...probes].sort(
						(a, b) =>
							b.assetLoaded - a.assetLoaded ||
							b.assetImgs - a.assetImgs ||
							(b.panelText.includes("Kapitel") ? 1 : 0) - (a.panelText.includes("Kapitel") ? 1 : 0),
					)[0] ?? null);

		// Open the Properties panel BEFORE iterating copies — the only visible
		// difference between the 904 copy and today's is the tag in the panel,
		// so it must be open while each copy is probed. The toggle needs an
		// open note to mount, so open any lesson first.
		const anyNote = notes.locator(".notes__nav").getByText(/Stunde/).first();
		if ((await anyNote.count().catch(() => 0)) > 0) {
			await anyNote.click().catch(() => undefined);
			await notes.waitForTimeout(1500);
		}
		const showProps = notes.getByRole("button", { name: "Show properties" }).first();
		if ((await showProps.count().catch(() => 0)) > 0) {
			await showProps.click().catch(() => undefined);
			await notes.waitForTimeout(800);
		} // else: already open (toggle reads "Hide properties") — fine either way.

		// ---- (2)+(4)+(5) "Stunde 8": blocks + tag + title ------------------
		// Export truth: 2×Header1, 9×Header2, 20×Header3, 58 Numbered,
		// 15 Marked, one PDF file block, tag "Kapitel 9".
		const s8copies = await probeCopies("Stunde 8");
		const s8 = s8copies.find((p) => p.panelText.includes("Kapitel")) ?? best(s8copies);
		await showCopy("Stunde 8", s8copies, s8);
		if (s8) {
			s.note(
				`[blocks] "Stunde 8" (title reads "${s8.title}"): h1(body)=${s8.h1Body} h2=${s8.h2} h3=${s8.h3} ol=${s8.ol} ul=${s8.ul} li=${s8.li} — export had 2/9/20 headings + 58 numbered + 15 bulleted items; ${s8.h2 >= 9 && s8.h3 >= 20 && s8.ol > 0 && s8.li >= 50 ? "these are REAL heading/list blocks, not flattened paragraphs" : "structure did NOT fully survive (compare the numbers above)"}`,
			);
			s.note(
				`[file-blocks] "Stunde 8" PDF link(s): ${s8.pdfLinks.length > 0 ? s8.pdfLinks.map((l) => `"${l.text}" → ${l.href}`).join(" ; ") : "NONE found in the body"} — ${s8.pdfLinks.some((l) => l.href.startsWith("brainstorm://asset/")) ? "the link points at the sealed asset" : "the link still points at a bare filename, not the imported file"}`,
			);
			s.note(
				`[properties] Properties panel on "Stunde 8": ${s8.panelText.length > 0 ? `"${s8.panelText.slice(0, 200)}"` : "(closed or empty)"} — Kapitel tag ${s8.panelText.includes("Kapitel") ? "VISIBLE (F-394 fix is live)" : "NOT visible"}`,
			);
		} else {
			s.note('[notes] could not open "Stunde 8" at all');
		}
		await s.shot(notes, "stunde-8-blocks");

		// ---- (3) "Stunde 6 | Natasha": 28 images must actually render ------
		const s6copies = await probeCopies("Stunde 6 | Natasha");
		const s6 = best(s6copies);
		await showCopy("Stunde 6 | Natasha", s6copies, s6);
		if (s6) {
			s.note(
				`[file-blocks] "Stunde 6 | Natasha" (title "${s6.title}"): ${s6.imgsTotal} <img> in the body, ${s6.assetImgs} with brainstorm://asset/ srcs, ${s6.assetLoaded} actually LOADED (naturalWidth>0)${s6.brokenSrcSample.length > 0 ? `; non-asset srcs e.g. ${s6.brokenSrcSample.join(", ")}` : ""} — export carries 28 images; ${s6.assetLoaded >= 20 ? "my screenshots are really in my notes now" : s6.assetImgs > 0 && s6.assetLoaded === 0 ? "the srcs are asset URLs but they don't LOAD — sealed assets that 404 are as good as missing" : "the images did not come across as asset blocks"}`,
			);
			// Scroll a rendered image into view for the money shot.
			const img = notes.locator('img[src^="brainstorm://asset/"]').first();
			if ((await img.count().catch(() => 0)) > 0) {
				await img.scrollIntoViewIfNeeded().catch(() => undefined);
				await notes.waitForTimeout(800);
			}
		} else {
			s.note('[notes] could not open "Stunde 6 | Natasha"');
		}
		await s.shot(notes, "stunde-6-images");

		// ---- (2) "Stunde 27 | Natasha": 20 checkboxes ----------------------
		const s27copies = await probeCopies("Stunde 27 | Natasha");
		const s27 = best(s27copies);
		await showCopy("Stunde 27 | Natasha", s27copies, s27);
		if (s27) {
			s.note(
				`[blocks] "Stunde 27 | Natasha" (title "${s27.title}"): check-list items=${s27.checkItems} (export has 20 Checkbox blocks) — ${s27.checkItems >= 15 ? "real checkbox blocks" : "checkboxes flattened or missing"}`,
			);
		}
		await s.shot(notes, "stunde-27-checkboxes");
		if (nErrs.errors.length > 0) for (const e of nErrs.errors.slice(0, 3)) s.note(`    notes: ${e}`);
		await notes.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(300).catch(() => undefined);

		// ---- (3)+(5)+(6) Files: the PDF's File entity + no duplicates ------
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(3000);
		const filesSearch = files.locator('[data-testid="toolbar-search-input"]').first();
		const countRows = async (needle: string): Promise<number> => {
			if ((await filesSearch.count().catch(() => 0)) === 0) return -1;
			await filesSearch.click().catch(() => undefined);
			await filesSearch.fill(needle).catch(() => undefined);
			await files.waitForTimeout(1800);
			return await files
				.locator(".content-row")
				.count()
				.catch(() => -1);
		};
		const pdfRows = await countRows("seite");
		s.note(
			`[files] searching "seite": ${pdfRows} row(s) — the "Stunde 8" PDF ("…Mo+Mi_Seite 1.pdf") ${pdfRows > 0 ? "exists as a File entity" : "is NOT findable in Files"}${pdfRows === 1 ? "; exactly one after two runs = no duplicate file entities" : pdfRows > 1 ? "; MORE than one — the re-run may have duplicated it" : ""}`,
		);
		await s.shot(files, "files-pdf-search");
		const shotRows = await countRows("screenshot-2026-03-20");
		s.note(
			`[files] searching "screenshot-2026-03-20": ${shotRows} row(s) ${shotRows === 1 ? "— stable across both runs" : shotRows > 1 ? "— duplicated?" : "— missing"}; note the names are the export's slugged truncated filenames, not what I called them in Anytype`,
		);
		await s.shot(files, "files-screenshot-search");
		await files.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(300).catch(() => undefined);

		// ---- (5) Database: the Stunden collection's rows carry titles ------
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		const stundenCount = await db
			.getByText("Stunden", { exact: true })
			.count()
			.catch(() => 0);
		s.note(
			`[database] "Stunden" appears ${stundenCount}× in the sidebar${stundenCount > 1 ? " — one List per import source: my collection is duplicated too" : ""}`,
		);
		if (stundenCount > 0) {
			await db.getByText("Stunden", { exact: true }).last().click().catch(() => undefined);
			await db.waitForTimeout(4000);
			const memberRows = await db
				.getByText(/Stunde \d/)
				.count()
				.catch(() => 0);
			s.note(
				`[database] opened a "Stunden" List: ${memberRows} lesson rows visible with real titles${memberRows > 0 ? " (F-393 fix holding — the pane actually opened)" : " — the List did not open or shows no rows"}`,
			);
		}
		await s.shot(db, "database-stunden");
		await db.close().catch(() => undefined);

		// ---- Verdict -------------------------------------------------------
		const bars = {
			blocks: (s8 !== null && s8.h2 >= 9 && s8.ol > 0) || (s27?.checkItems ?? 0) >= 15,
			fileBlocks: (s6?.assetLoaded ?? 0) >= 20,
			properties: s8?.panelText.includes("Kapitel") ?? false,
			titles: (s8?.title.startsWith("Stunde") ?? false) && (s6?.title.startsWith("Stunde") ?? false),
		};
		s.note(
			`[mira] verdict vs the owner's bar — blocks:${bars.blocks ? "PASS" : "FAIL"} file-blocks:${bars.fileBlocks ? "PASS" : "FAIL"} properties:${bars.properties ? "PASS" : "FAIL"} titles:${bars.titles ? "PASS" : "FAIL"}. Missing media ${missing1 ?? "?"} (was 406 before the slug fix). ${bars.blocks && bars.fileBlocks && bars.properties && bars.titles ? "Three years of German lessons — screenshots, PDFs, tags and all — actually live here now." : "The import is close, but the failing bar(s) above are what I'd hold the release on."}`,
		);
	} finally {
		await s.finish();
	}
});
