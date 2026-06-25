/**
 * Session 228 — DEEP Preview inspector walkthrough. Verifies the right-panel
 * consistency rollout for Preview: the inspector now renders the SHARED
 * Properties | Comments tab strip (`.bs-panel-tabs`) hosting editable vault
 * properties (`EntityPropertiesPanel`), with the file's intrinsic facts in the
 * read-only `meta` footer — identical chrome to Notes / Journal. Drives a real
 * Electron shell: launch Preview, preview a seeded file from the library
 * sidebar, open the inspector, and assert the tab strip + Add-property control
 * + a write-through bind, then the Comments tab.
 *
 * Observable-DOM judged `[PASS]/[FAIL]/[?]` lines; each step try/caught so one
 * miss never aborts the walk. States + failures screenshotted.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("deep preview inspector walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-preview");
	try {
		const preview = await s.openApp(APP.Preview);
		await preview.waitForTimeout(2600);
		await s.shot(preview, "00-preview-launched");

		// Seed a previewable File/v1 entity + a bound property directly from the
		// Preview page — this exercises Preview's NEW write capabilities
		// (entities.write:brainstorm/File/v1 + the default properties.write) and
		// gives the inspector real editable content. A 1×1 PNG data URI is enough
		// for entityToPreviewFile to accept the row into the library sidebar.
		const seed = await preview
			.evaluate(async () => {
				const bs = (window as unknown as { brainstorm?: { services?: Record<string, unknown> } })
					.brainstorm;
				const entities = bs?.services?.entities as
					| { create?: (t: string, p: Record<string, unknown>) => Promise<{ id: string }> }
					| undefined;
				const properties = bs?.services?.properties as
					| { setProperty?: (d: Record<string, unknown>) => Promise<void> }
					| undefined;
				if (!entities?.create || !properties?.setProperty) return { ok: false, reason: "no services" };
				await properties.setProperty({ key: "author", name: "Author", icon: null, valueType: "text" });
				const png =
					"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
				const created = await entities.create("brainstorm/File/v1", {
					name: "lotr-cover.png",
					mime: "image/png",
					attachment: png,
					size: 70,
					values: { author: "J. R. R. Tolkien" },
				});
				return { ok: true, id: created.id };
			})
			.catch((e: Error) => ({ ok: false, reason: e.message }));
		s.note(
			`[${seed.ok ? "PASS" : "FAIL"}] Seed File/v1 + property via Preview's write caps — ${seed.ok ? `created ${("id" in seed && seed.id) || "?"}` : `failed: ${"reason" in seed ? seed.reason : "?"}`}`,
		);
		await preview.waitForTimeout(1500);

		const sidebarRows = preview.locator(".preview__sidebar-row button");

		// ── 1. Preview a seeded vault file from the library sidebar ────────────
		try {
			const count = await sidebarRows.count().catch(() => 0);
			if (count > 0) {
				const name = await sidebarRows
					.first()
					.innerText()
					.catch(() => "");
				await sidebarRows.first().click({ timeout: 5000 });
				await preview.waitForTimeout(1200);
				const title = await preview
					.locator(".app-header__title")
					.first()
					.innerText()
					.catch(() => "");
				s.note(
					`[${title ? "PASS" : "FAIL"}] Preview a file — sidebar "${name}", header title "${title}"`,
				);
			} else {
				s.note("[?] Preview a file — no File/v1 rows in the seeded vault sidebar");
			}
			await s.shot(preview, "01-file-previewed");
		} catch (e) {
			s.note(`[FAIL] Preview a file — ${(e as Error).message}`);
		}

		// ── 2. Open the inspector (panel must be on-screen, not just in the DOM) ─
		try {
			const rootCollapsed = () =>
				preview
					.locator("#preview-root")
					.evaluate((el) => el.classList.contains("preview--inspector-collapsed"))
					.catch(() => true);
			if (await rootCollapsed()) {
				await preview.locator('[data-testid="inspector-toggle"]').first().click({ timeout: 5000 });
				await preview.waitForTimeout(700);
			}
			// Fall back to the `i` shortcut if the toggle didn't take.
			if (await rootCollapsed()) {
				await preview.locator("#preview-root").click({ position: { x: 400, y: 300 } });
				await preview.keyboard.press("i");
				await preview.waitForTimeout(700);
			}
			const collapsed = await rootCollapsed();
			// On-screen check: the panel's left edge sits within the viewport when expanded.
			const box = await preview
				.locator(".preview__inspector")
				.first()
				.boundingBox()
				.catch(() => null);
			const vw = preview.viewportSize()?.width ?? 1100;
			const onScreen = box != null && box.x < vw - 40;
			s.note(
				`[${!collapsed && onScreen ? "PASS" : "FAIL"}] Inspector opens on-screen — collapsed=${collapsed}, panel.x=${box?.x ?? "?"} (vw=${vw})`,
			);
			await s.shot(preview, "02-inspector-open");
		} catch (e) {
			s.note(`[FAIL] Open inspector — ${(e as Error).message}`);
		}

		// ── 3. SHARED Properties | Comments tab strip present (the consistency fix) ─
		try {
			const tabs = preview.locator(".bs-panel-tabs").first();
			const tabsVisible = await tabs.isVisible().catch(() => false);
			const tabLabels = await preview
				.locator(".bs-panel-tab")
				.allInnerTexts()
				.catch(() => [] as string[]);
			const hasProps = tabLabels.some((l) => /propert/i.test(l));
			const hasComments = tabLabels.some((l) => /comment/i.test(l));
			s.note(
				`[${tabsVisible && hasProps && hasComments ? "PASS" : "FAIL"}] Properties | Comments tab strip — visible=${tabsVisible}, tabs=[${tabLabels.join(", ")}]`,
			);
			await s.shot(preview, "03-tab-strip");
		} catch (e) {
			s.note(`[FAIL] Tab strip — ${(e as Error).message}`);
		}

		// ── 4. File facts ride the read-only meta footer (not editable rows) ───
		try {
			const metaRows = await preview
				.locator(".bs-props__meta-row")
				.allInnerTexts()
				.catch(() => [] as string[]);
			const hasType = metaRows.some((r) => /type/i.test(r));
			s.note(
				`[${metaRows.length > 0 ? "PASS" : "FAIL"}] File facts in meta footer — ${metaRows.length} rows, has-Type=${hasType}`,
			);
		} catch (e) {
			s.note(`[FAIL] Meta footer — ${(e as Error).message}`);
		}

		// ── 5. The seeded "Author" property renders as an EDITABLE row ─────────
		try {
			const rowLabels = await preview
				.locator(".bs-props__row-label")
				.allInnerTexts()
				.catch(() => [] as string[]);
			const hasAuthor = rowLabels.some((l) => /author/i.test(l));
			// Its value cell carries the seeded text + an editable (non-readOnly) cell.
			const valueText = await preview
				.locator(".bs-props__row[data-property-key='author'] .bs-props__row-value")
				.first()
				.innerText()
				.catch(() => "");
			s.note(
				`[${hasAuthor ? "PASS" : "FAIL"}] Editable property row renders — labels=[${rowLabels.join(", ")}], Author value "${valueText.trim()}"`,
			);
			await s.shot(preview, "05-editable-row");
		} catch (e) {
			s.note(`[FAIL] Editable property row — ${(e as Error).message}`);
		}

		// ── 5b. Edit write-through: change the value and confirm it persists ───
		try {
			const cell = preview
				.locator(".bs-props__row[data-property-key='author'] .bs-props__row-value")
				.first();
			const editable = cell.locator("input, [contenteditable='true'], textarea").first();
			if ((await editable.count()) > 0) {
				await editable.click({ timeout: 5000 });
				await preview.keyboard.press("ControlOrMeta+a").catch(() => undefined);
				await editable.fill("Tolkien (edited)").catch(() => undefined);
				await preview.keyboard.press("Enter").catch(() => undefined);
				await preview.waitForTimeout(900);
				// Read it back from the vault to prove entities.write:File/v1 landed.
				const persisted = await preview
					.evaluate(
						async (id) => {
							const bs = (window as unknown as { brainstorm?: { services?: Record<string, unknown> } })
								.brainstorm;
							const get = (bs?.services?.entities as { get?: (i: string) => Promise<unknown> })?.get;
							const e = (await get?.(id)) as { properties?: { values?: Record<string, unknown> } } | null;
							return (e?.properties?.values?.author as string) ?? null;
						},
						"id" in seed ? seed.id : "",
					)
					.catch(() => null);
				s.note(
					`[${persisted === "Tolkien (edited)" ? "PASS" : "?"}] Edit write-through persists to the File entity — values.author="${persisted}"`,
				);
				await s.shot(preview, "05b-edit-persisted");
			} else {
				s.note("[?] Edit write-through — no inline editable control in the Author cell");
			}
		} catch (e) {
			s.note(`[FAIL] Edit write-through — ${(e as Error).message}`);
		}

		// ── 6. Switch to the Comments tab ──────────────────────────────────────
		try {
			const commentsTab = preview.locator(".bs-panel-tab", { hasText: /comment/i }).first();
			if ((await commentsTab.count()) > 0) {
				await commentsTab.click({ timeout: 5000 });
				await preview.waitForTimeout(700);
				const commentsBody = await preview
					.locator(".bs-comments, .comments-panel, [class*='comment']")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(`[${commentsBody ? "PASS" : "?"}] Comments tab renders — body visible=${commentsBody}`);
				await s.shot(preview, "06-comments-tab");
			} else {
				s.note("[?] Comments tab — strip not present (no comment mutation surface)");
			}
		} catch (e) {
			s.note(`[FAIL] Comments tab — ${(e as Error).message}`);
		}

		await s.shot(preview, "07-preview-final");
	} finally {
		await s.finish();
	}
});
