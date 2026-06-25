/**
 * Session 137 — Marcus design-reviews the Files surface.
 *
 * The file workspace. Marcus checks the row layout (glyph + name + type +
 * modified), the header order, and the empty/populated states for consistency
 * with the rest of the product. Spec posts intent/neutral; verdict from the
 * captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Files surface (137)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("137-marcus-files-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"Reviewing Files — the workspace's filing cabinet. Checking row consistency (glyph/name/type/modified) and the chrome.",
		);

		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(2000);
		await s.shot(files, "01-resting");

		const rows = await files
			.locator(".content-row__name")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 16),
			)
			.catch(() => [] as string[]);
		s.note(`file rows (${rows.length}): ${JSON.stringify(rows)}`);

		const rowCount = await files
			.locator(".content-row")
			.count()
			.catch(() => 0);
		const typedCount = await files
			.locator(".content-row__type")
			.count()
			.catch(() => 0);
		const modifiedCount = await files
			.locator(".content-row__modified")
			.count()
			.catch(() => 0);
		s.note(`rows=${rowCount} withType=${typedCount} withModified=${modifiedCount}`);

		const emptyState = await files
			.locator(".content-empty")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`empty-state text (if any): ${JSON.stringify(emptyState)}`);

		const headerRight = await files
			.locator(".app-header__right")
			.first()
			.locator("button")
			.evaluateAll((els) => els.map((e) => (e as HTMLElement).getAttribute("aria-label") || ""))
			.catch(() => [] as string[]);
		s.note(`header right-group: ${JSON.stringify(headerRight)}`);

		s.chat(SPEAKER.Marcus, "Walked the file list — pulling my notes from the captures.");
		s.note("Marcus reviewed the Files surface; verdict from captures.");
	} finally {
		await s.finish();
	}
});
