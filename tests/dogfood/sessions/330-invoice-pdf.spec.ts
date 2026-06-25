/**
 * Session 330 — verify the Designer's invoice → PDF flow (DT-2 acceptance).
 *
 * Mira opens the Designer, switches to Documents, creates an invoice, fills the
 * bill-to + a line item, sees the live preview compute the total, and exports a
 * PDF. The native save dialog is stubbed to a temp path so the export runs
 * headless; we then assert a real PDF landed on disk (%PDF header, non-trivial
 * size). This is the real-shell gate behind the unit-tested render core.
 */

import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("invoice → PDF export (330)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("330-invoice-pdf");
	const pdfPath = join(tmpdir(), `northbound-invoice-${process.pid}.pdf`);
	try {
		// Stub the native save dialog → our temp path so requestSave resolves
		// headless (no OS modal to wedge the run).
		await s.app.evaluate(({ dialog }, filePath) => {
			dialog.showSaveDialog = (async () => ({
				canceled: false,
				filePath,
			})) as typeof dialog.showSaveDialog;
		}, pdfPath);

		const page = await s.openApp(APP.FormDesigner);
		await page.waitForTimeout(2500);
		await s.shot(page, "designer-forms");

		// Switch to the Documents surface.
		await page.getByRole("tab", { name: /documents/i }).click();
		await page.waitForTimeout(600);
		await s.shot(page, "documents-empty");

		// Create an invoice.
		await page
			.getByRole("button", { name: /new invoice/i })
			.first()
			.click();
		await page.waitForTimeout(1200);

		// Fill the bill-to name + a line item (qty 10 × 250 = 2500).
		const billToName = page.locator(".invoices__party").nth(1).locator("input").first();
		await billToName.fill("Vertex Labs");
		const desc = page.locator(".invoices__item-edit input").first();
		await desc.fill("Advisory retainer");
		const qty = page.locator(".invoices__item-edit input[type=number]").first();
		await qty.fill("10");
		const price = page.locator(".invoices__item-edit input[type=number]").nth(1);
		await price.fill("250");
		await page.waitForTimeout(700);
		await s.shot(page, "invoice-filled");

		// The live preview (which IS the PDF) should show the computed total.
		const paper = page.locator(".invoices__paper");
		const previewText = (await paper.innerText().catch(() => "")) ?? "";
		s.note(`preview text contains "Vertex Labs": ${previewText.includes("Vertex Labs")}`);
		s.note(`preview total present ($2,500.00): ${previewText.includes("2,500")}`);
		expect(previewText, "preview should render the bill-to").toContain("Vertex Labs");
		expect(previewText, "preview should render the computed total").toContain("2,500");

		// Export the PDF.
		await page.getByRole("button", { name: /export pdf/i }).click();
		await page.waitForTimeout(2500);
		await s.shot(page, "after-export");

		const wrote = existsSync(pdfPath);
		s.note(`PDF written to disk: ${wrote} (${pdfPath})`);
		expect(wrote, "an invoice PDF should be written").toBe(true);
		if (wrote) {
			const bytes = readFileSync(pdfPath);
			s.note(`PDF size: ${bytes.length} bytes; header: ${bytes.subarray(0, 5).toString("latin1")}`);
			expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
			expect(bytes.length).toBeGreaterThan(1000);
		}
	} finally {
		await s.finish();
	}
});
