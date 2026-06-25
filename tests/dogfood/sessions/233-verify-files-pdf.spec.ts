/**
 * Session 233 — verify two user-reported regressions:
 *  - Files sidebar "All media" storage button shows the native UA ButtonFace
 *    grey at REST (it's a <button>; the base `.sidebar__tree-row` rule didn't
 *    kill appearance/background). After the fix its resting bg must be
 *    transparent, like the folder <div> rows.
 *  - PDF teardown crash "doc.destroy is not a function" — pdfjs 6.x
 *    `PDFDocumentProxy.destroy()` returns void; the fix routes destroy through
 *    the loading task. Open a PDF in Preview, then open another to force the
 *    first's dispose → destroy(), and assert no error boundary surfaced.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("verify files sidebar + pdf destroy (233)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("233-verify-files-pdf");
	try {
		// ── Files sidebar storage button resting background ──
		const fl = await s.openApp(APP.Files);
		await fl.waitForTimeout(2000);
		const storageBg = await fl
			.evaluate(() => {
				const btn = document.querySelector('[data-testid="sidebar-storage"]') as HTMLElement | null;
				if (!btn) return null;
				const cs = getComputedStyle(btn);
				return {
					bg: cs.backgroundColor,
					appearance: cs.appearance,
					isButton: btn.tagName === "BUTTON",
				};
			})
			.catch(() => null);
		// Resting (storageOpen=false) must be transparent — NOT a ButtonFace grey.
		const transparent =
			!!storageBg && (storageBg.bg === "rgba(0, 0, 0, 0)" || storageBg.bg === "transparent");
		s.note(
			`[${transparent ? "PASS" : "FAIL"}] files storage button resting bg transparent (no ButtonFace grey): ${JSON.stringify(storageBg)}`,
		);
		await s.shot(fl, "01-files-sidebar");

		// ── PDF open + dispose cycle (exercises doc.destroy via the loading task) ──
		const pdfRows = fl
			.locator(".file-row, [data-testid='file-row'], [class*='file'][class*='row']")
			.filter({ hasText: /\.pdf/i });
		const pdfCount = await pdfRows.count().catch(() => 0);
		s.note(`[?] found ${pdfCount} pdf rows in Files`);
		if (pdfCount > 0) {
			await pdfRows
				.first()
				.dblclick()
				.catch(() => undefined);
			await fl.waitForTimeout(2500);
			let pv = s.appPagesFor(APP.Preview)[0];
			s.note(`[${pv ? "ok" : "?"}] preview opened for first PDF`);
			if (pv) await s.shot(pv, "02-preview-pdf-1");
			// Open a second PDF → disposes the first renderer → first doc.destroy().
			await pdfRows
				.nth(Math.min(1, pdfCount - 1))
				.dblclick()
				.catch(() => undefined);
			await fl.waitForTimeout(2500);
			pv = s.appPagesFor(APP.Preview)[0];
			// Scan every Preview page for the error boundary that the crash raised.
			const crash = await Promise.all(
				s.appPagesFor(APP.Preview).map((p) =>
					p
						.evaluate(() => {
							const text = document.body.innerText;
							return /something went wrong|is not a function|doc\.destroy/i.test(text);
						})
						.catch(() => false),
				),
			);
			const anyCrash = crash.some(Boolean);
			s.note(
				`[${!anyCrash ? "PASS" : "FAIL"}] no PDF teardown crash after open→reopen (doc.destroy): crashPages=${JSON.stringify(crash)}`,
			);
			if (pv) await s.shot(pv, "03-preview-pdf-2");
		} else {
			s.note(
				"[?] no PDF rows to exercise the destroy path — verify books/Preview PDF teardown manually",
			);
		}

		s.chat(SPEAKER.Marcus, "Files sidebar + PDF destroy verify (233) done — see notes.md.");
	} finally {
		await s.finish();
	}
});
