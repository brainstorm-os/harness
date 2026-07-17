/**
 * Session 903 — Mira sweeps what shipped in v0.4.5 → v0.4.6.
 *
 * She's been heads-down on the newsletter for a week; the app updated under
 * her twice. This session is her walking the release notes like a user:
 * - the four app renames (Forms / Themes / Browser / Code) on her dashboard,
 * - the What's-New entry for 0.4.6,
 * - the Files grid (tiles borderless at rest, no overlap),
 * - the editor look OUTSIDE Notes (Journal is her daily surface — the shared
 *   editor theme was just synced back to the Notes look),
 * - the dashboard snap grid while dragging an icon,
 * - the notification center (entries should open their subject now).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("recent-ship sweep — renames, files grid, editor theme, snap grid (903)", async () => {
	test.setTimeout(480_000);
	const s = await startSession("903-recent-ship-sweep");
	try {
		// ---- App renames on the dashboard --------------------------------
		const d = s.dashboard;
		await d.waitForTimeout(2000);
		const labels = await d
			.evaluate(() =>
				Array.from(document.querySelectorAll('[class*="icon-grid"] [class*="label"], [class*="dashboard-icon"]'))
					.map((el) => (el.textContent ?? "").trim())
					.filter((t) => t.length > 0 && t.length < 30),
			)
			.catch(() => [] as string[]);
		const renames = ["Forms", "Themes", "Browser", "Code"] as const;
		const oldNames = ["Form Designer", "Theme Editor", "Web Browser", "Code Editor"] as const;
		s.note(
			`[renames] dashboard labels seen: new=${renames.filter((n) => labels.some((l) => l === n || l.includes(n))).join(",") || "none"}; stale=${oldNames.filter((n) => labels.some((l) => l.includes(n))).join(",") || "none"} (want all new, no stale)`,
		);
		await s.shot(d, "dashboard-labels");

		// ---- Snap grid while dragging an icon ----------------------------
		const icon = d.locator('[class*="dashboard-icon"], [data-testid*="icon"]').first();
		const box = await icon.boundingBox().catch(() => null);
		if (box) {
			await d.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await d.mouse.down();
			await d.mouse.move(box.x + 140, box.y + 90, { steps: 12 });
			await d.waitForTimeout(300);
			await s.shot(d, "snap-grid-mid-drag");
			const gridVisible = await d
				.evaluate(() => {
					for (const el of Array.from(document.querySelectorAll("*"))) {
						const before = getComputedStyle(el, "::before");
						if (
							before.backgroundImage.includes("linear-gradient") &&
							Number.parseFloat(before.opacity) > 0.01
						) {
							return true;
						}
					}
					return false;
				})
				.catch(() => false);
			await d.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
			await d.mouse.up();
			s.note(
				`[snap-grid] hairline overlay ${gridVisible ? "visible" : "NOT detected"} mid-drag — I do like seeing where things will land. (dropped the icon back)`,
			);
		} else {
			s.note("[snap-grid] couldn't grab a dashboard icon to drag — is the grid selector gone?");
		}

		// ---- What's New should tell me about 0.4.6 ------------------------
		const whatsNew = d.locator('[data-testid*="whats-new"], [aria-label*="new" i][class*="whats"]').first();
		const wnCount = await whatsNew.count().catch(() => 0);
		if (wnCount > 0) {
			await whatsNew.click().catch(() => undefined);
			await d.waitForTimeout(800);
			const text = await d.evaluate(() => document.body.textContent ?? "").catch(() => "");
			s.note(
				`[whats-new] popover ${text.includes("0.4.6") ? "mentions 0.4.6" : "does NOT mention 0.4.6"}; "Fixes across the desktop" ${text.includes("Fixes across the desktop") ? "present" : "absent"}`,
			);
			await s.shot(d, "whats-new");
			await d.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("[whats-new] no What's-New affordance found on the dashboard — where do I read release notes?");
		}

		// ---- Files grid: borderless tiles, no overlap ---------------------
		const files = await s.openApp(APP.Files);
		const fErrs = collectConsoleErrors(files);
		await files.waitForTimeout(2500);
		const tileProbe = await files
			.evaluate(() => {
				const tiles = Array.from(document.querySelectorAll('[class*="grid"] [class*="tile"], [class*="files-grid"] > *'));
				if (tiles.length === 0) return null;
				const first = tiles[0] as HTMLElement;
				const cs = getComputedStyle(first);
				const rects = tiles.slice(0, 40).map((t) => t.getBoundingClientRect());
				let overlaps = 0;
				for (let i = 0; i < rects.length; i++) {
					for (let j = i + 1; j < rects.length; j++) {
						const a = rects[i];
						const b = rects[j];
						if (a.left < b.right - 4 && b.left < a.right - 4 && a.top < b.bottom - 4 && b.top < a.bottom - 4) overlaps++;
					}
				}
				return { count: tiles.length, border: cs.borderWidth + " " + cs.borderColor, overlaps };
			})
			.catch(() => null);
		s.note(
			tileProbe
				? `[files] ${tileProbe.count} tiles; first tile border at rest: ${tileProbe.border}; overlapping pairs: ${tileProbe.overlaps} (want 0)`
				: "[files] no grid tiles found — empty vault view?",
		);
		await s.shot(files, "files-grid");
		if (fErrs.errors.length > 0) for (const e of fErrs.errors.slice(0, 3)) s.note(`    files: ${e}`);
		await files.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(250).catch(() => undefined);

		// ---- Journal: the shared editor look outside Notes ----------------
		const journal = await s.openApp(APP.Journal);
		const jErrs = collectConsoleErrors(journal);
		await journal.waitForTimeout(2500);
		const editor = journal.locator('[contenteditable="true"]').first();
		const hasEditor = (await editor.count().catch(() => 0)) > 0;
		if (hasEditor) {
			await editor.click().catch(() => undefined);
			await journal.keyboard.type("Theme check: the editor outside Notes should look right again.");
			await journal.keyboard.press("Home");
			await journal.keyboard.press("Shift+End");
			await journal.waitForTimeout(600);
			const toolbar = await journal
				.evaluate(() => {
					const menu = document.querySelector(".fm-menu") as HTMLElement | null;
					if (!menu) return null;
					const cs = getComputedStyle(menu);
					return { direction: cs.flexDirection, visible: cs.display !== "none" };
				})
				.catch(() => null);
			s.note(
				toolbar
					? `[journal] inline toolbar flex-direction=${toolbar.direction} (want row — it stacked vertically before 0.4.6)`
					: "[journal] selected text but no .fm-menu inline toolbar appeared",
			);
			await s.shot(journal, "journal-inline-toolbar");
			await journal.keyboard.press("End");
			// Clean up the probe line so tomorrow's entry isn't noise.
			for (let i = 0; i < 70; i++) await journal.keyboard.press("Backspace");
		} else {
			s.note("[journal] no editable surface found — can't check the editor theme here");
		}
		await s.shot(journal, "journal-overview");
		if (jErrs.errors.length > 0) for (const e of jErrs.errors.slice(0, 3)) s.note(`    journal: ${e}`);
		await journal.close().catch(() => undefined);
		await s.dashboard.waitForTimeout(250).catch(() => undefined);

		// ---- Notification center: entries should open their subject -------
		const bell = d.locator('[data-testid*="notification"], [aria-label*="notification" i]').first();
		if ((await bell.count().catch(() => 0)) > 0) {
			await bell.click().catch(() => undefined);
			await d.waitForTimeout(600);
			const entryButtons = await d
				.locator('[class*="notification"] button, [class*="notification-center"] [role="button"]')
				.count()
				.catch(() => 0);
			s.note(
				`[notifications] center opened; ${entryButtons} clickable entr${entryButtons === 1 ? "y" : "ies"} — reminders should jump to their task/event now (empty center = nothing to verify today)`,
			);
			await s.shot(d, "notification-center");
			await d.keyboard.press("Escape").catch(() => undefined);
		} else {
			s.note("[notifications] no notification affordance found from the dashboard");
		}

		s.note(
			"[mira] verdict pass: renames read cleaner on the dashboard (Code / Forms — finally). Main things I care about this week: does Journal's editor still feel like Notes, and does the Files grid stay put when I resize. Screenshots attached.",
		);
	} finally {
		await s.finish();
	}
});
