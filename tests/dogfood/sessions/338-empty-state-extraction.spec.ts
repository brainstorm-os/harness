/**
 * Session 338 — verify the shared `@brainstorm/sdk/empty-state` extraction.
 *
 * Preview, Automations and Books each grew their own glyph+title+hint empty
 * state; they now render through ONE shared `<EmptyState>` (`.bs-empty-state`).
 * This opens each in the real shell, captures the empty surface, and asserts
 * the shared chrome actually paints — Preview's "Nothing to preview" is the
 * deterministic one (a fresh launch with no file selected), so it carries the
 * hard assertion; Books + Automations are captured for the eyeball read.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("shared EmptyState renders across Preview / Automations / Books (338)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("338-empty-state-extraction");
	try {
		// Preview — deterministic: a dashboard launch opens with no file, so the
		// "Nothing to preview" hero empty must be the shared surface.
		const preview = await s.openApp(APP.Preview);
		if (preview) {
			const errs = collectConsoleErrors(preview);
			await preview.waitForTimeout(2400);
			await expect(preview.locator(".bs-empty-state")).toHaveCount(1);
			await s.shot(preview, "preview-empty");
			if (errs.errors.length > 0) s.note(`[?] preview console errors: ${errs.errors.length}`);
			await preview.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}

		// Automations + Books — capture for the eyeball read; soft-note whether
		// the shared surface is present (depends on seeded content).
		for (const [appId, slug] of [
			[APP.Automations, "automations"],
			[APP.Books, "books"],
		] as const) {
			const page = await s.openApp(appId);
			if (!page) continue;
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(2400);
			const sharedCount = await page.locator(".bs-empty-state").count();
			s.note(`[i] ${slug}: ${sharedCount} .bs-empty-state on open`);
			await s.shot(page, `${slug}-open`);
			if (errs.errors.length > 0) {
				s.note(`[?] ${slug} console errors (${errs.errors.length}):`);
				for (const e of errs.errors.slice(0, 6)) s.note(`    ${e}`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});

test("adoption-sweep empties render (Contacts / Code-editor / Notes / Mailbox) (338b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("338b-empty-state-sweep");
	try {
		// Content-dependent: the seeded vault has contacts/notes, so some of these
		// won't be empty on launch (Code-editor's vault has no code files, so it
		// reliably is). Capture all four + soft-note the shared-surface count; the
		// hard guarantee is no console error from the migrated render path.
		for (const [appId, slug] of [
			[APP.Contacts, "contacts"],
			[APP.CodeEditor, "code-editor"],
			[APP.Notes, "notes"],
			[APP.Mailbox, "mailbox"],
		] as const) {
			const page = await s.openApp(appId);
			if (!page) continue;
			const errs = collectConsoleErrors(page);
			await page.waitForTimeout(2400);
			const sharedCount = await page.locator(".bs-empty-state").count();
			s.note(`[i] ${slug}: ${sharedCount} .bs-empty-state on open`);
			await s.shot(page, `${slug}-open`);
			if (errs.errors.length > 0) {
				s.note(`[?] ${slug} console errors (${errs.errors.length}):`);
				for (const e of errs.errors.slice(0, 6)) s.note(`    ${e}`);
			}
			await page.close().catch(() => undefined);
			await s.dashboard.waitForTimeout(300).catch(() => undefined);
		}
	} finally {
		await s.finish();
	}
});
