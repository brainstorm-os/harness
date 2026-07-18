/**
 * Session 906b — follow-ups from the 906 team tour.
 *
 * - Priya: the Journal slash menu did NOT open mid-line in 906. Control probe:
 *   "/" on a fresh empty block (the documented trigger), plus the footer
 *   "Link an entry" affordance. Then the same fresh-block probe in Notes as
 *   the parity baseline, and a cleanup of the 906 probe residue.
 * - Priya: Tasks — the 906 row selector was wrong; dump the real DOM, open a
 *   task, find the description editor, probe "/".
 * - Dana: Database — "Clients" wasn't found by text; dump what the sidebar
 *   actually lists, then open the pipeline list and read the footer.
 * - Marcus: What's-New lives inside Help (help.tsx wires onOpenWhatsNew) —
 *   walk ⓘ → What's new and check it tells the 0.5.0 story.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("v0.5.0 tour follow-ups — journal slash, tasks, db sidebar, whats-new (906b)", async () => {
	test.setTimeout(540_000);
	const s = await startSession("906b-v050-tour-followups");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(2000);

		// ============ Priya — Journal: slash on a fresh empty block ==========
		const journal = await s.openApp(APP.Journal);
		const jErrs = collectConsoleErrors(journal);
		await journal.waitForTimeout(2500);
		try {
			// Clean 906's residue first: the "Pipeline check: /Clients" line.
			const residue = journal.locator('text=Pipeline check:').first();
			if ((await residue.count()) > 0) {
				await residue.click();
				await journal.keyboard.press("Home");
				await journal.keyboard.press("Shift+End");
				await journal.keyboard.press("Backspace");
				await journal.waitForTimeout(400);
				s.note("[priya/journal] cleaned the 906 probe residue line");
			}
			const editor = journal.locator('[contenteditable="true"]').first();
			await editor.click();
			await journal.keyboard.press("Control+End").catch(() => undefined);
			await journal.keyboard.press("End");
			await journal.keyboard.press("Enter");
			await journal.keyboard.type("/");
			await journal.waitForTimeout(1000);
			await s.shot(journal, "journal-slash-empty-block");
			const menu = await journal.evaluate(() => {
				const el = document.querySelector('[class*="typeahead"], [class*="slash-menu"], [role="listbox"]');
				return el ? (el.textContent ?? "").slice(0, 300) : null;
			});
			s.note(
				menu
					? `[priya/journal] slash on an EMPTY block DID open: "${menu.slice(0, 140)}…" (so mid-line "/" after a space is the broken case)`
					: "[priya/journal] slash menu does NOT open even on a fresh empty block — the placeholder literally says \"Type '/' for commands\"",
			);
			if (menu) {
				await journal.keyboard.type("Clients");
				await journal.waitForTimeout(900);
				await s.shot(journal, "journal-slash-clients2");
				await journal.keyboard.press("Enter");
				await journal.waitForTimeout(1200);
				const embed = await journal.evaluate(() => {
					const el = document.querySelector('[class*="embed"], [class*="entity-card"], [data-entity-ref], [class*="mention"]');
					return el ? { cls: el.className.toString().slice(0, 80), text: (el.textContent ?? "").slice(0, 120) } : null;
				});
				s.note(
					embed
						? `[priya/journal] embed/reference landed: ${embed.cls} — "${embed.text}"`
						: "[priya/journal] Enter on the result inserted NO embed/reference node",
				);
				await s.shot(journal, "journal-embed-result2");
			} else {
				// tidy the lone "/"
				await journal.keyboard.press("Backspace");
			}
			// The footer "Link an entry" affordance — what does it do?
			const link = journal.locator("text=Link an entry").first();
			if ((await link.count()) > 0) {
				await link.click();
				await journal.waitForTimeout(900);
				await s.shot(journal, "journal-link-an-entry");
				const after = await journal.evaluate(() => {
					const el = document.querySelector('[role="dialog"], [role="listbox"], [class*="popover"], [class*="picker"]');
					return el ? (el.textContent ?? "").slice(0, 200) : null;
				});
				s.note(
					after
						? `[priya/journal] "Link an entry" opened: "${after.slice(0, 140)}…"`
						: '[priya/journal] clicked "Link an entry" and nothing visibly opened',
				);
				await journal.keyboard.press("Escape").catch(() => undefined);
			}
		} catch (e) {
			s.note(`[priya/journal] follow-up broke: ${String(e).slice(0, 200)}`);
		}
		if (jErrs.errors.length > 0) for (const e of jErrs.errors.slice(0, 4)) s.note(`    journal console: ${e}`);
		await journal.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ============ Priya — Notes baseline: same fresh-block "/" ===========
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2500);
		try {
			const editor = notes.locator('[contenteditable="true"]').first();
			if ((await editor.count()) > 0) {
				await editor.click();
				await notes.keyboard.press("End");
				await notes.keyboard.press("Enter");
				await notes.keyboard.type("/");
				await notes.waitForTimeout(1000);
				const menu = await notes.evaluate(() => {
					const el = document.querySelector('[class*="typeahead"], [class*="slash-menu"], [role="listbox"]');
					return el ? true : false;
				});
				s.note(`[priya/notes] baseline: slash on a fresh block in NOTES ${menu ? "opens" : "does NOT open either?!"}`);
				await s.shot(notes, "notes-slash-baseline");
				await notes.keyboard.press("Escape").catch(() => undefined);
				await notes.keyboard.press("Backspace");
				await notes.keyboard.press("Backspace");
			}
		} catch (e) {
			s.note(`[priya/notes] baseline broke: ${String(e).slice(0, 200)}`);
		}
		await notes.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ============ Priya — Tasks: find the real rows =======================
		const tasks = await s.openApp(APP.Tasks);
		const tErrs = collectConsoleErrors(tasks);
		await tasks.waitForTimeout(3000);
		try {
			await s.shot(tasks, "tasks-overview");
			const dump = await tasks.evaluate(() => {
				const slot = document.querySelector("#tasks-content-slot") ?? document.body;
				const kids = Array.from(slot.querySelectorAll("*")).slice(0, 400);
				const classCounts = new Map<string, number>();
				for (const k of kids) {
					const c = (k.className ?? "").toString().split(/\s+/)[0];
					if (c) classCounts.set(c, (classCounts.get(c) ?? 0) + 1);
				}
				const top = Array.from(classCounts.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, 12)
					.map(([c, n]) => `${c}×${n}`)
					.join(", ");
				return { top, text: (slot.textContent ?? "").slice(0, 200) };
			});
			s.note(`[priya/tasks] content slot classes: ${dump.top}; text head: "${dump.text.slice(0, 120)}"`);
			const row = tasks.locator('#tasks-content-slot [class*="row"], #tasks-content-slot li, [class*="task"] [class*="title"]').first();
			if ((await row.count()) > 0) {
				await row.click();
				await tasks.waitForTimeout(1200);
				await s.shot(tasks, "tasks-detail");
				const editors = await tasks.locator('[contenteditable="true"]').count();
				if (editors > 0) {
					const editor = tasks.locator('[contenteditable="true"]').last();
					await editor.click();
					await tasks.keyboard.press("End");
					await tasks.keyboard.press("Enter");
					await tasks.keyboard.type("/");
					await tasks.waitForTimeout(1000);
					const menu = await tasks.evaluate(
						() => document.querySelector('[class*="typeahead"], [class*="slash-menu"], [role="listbox"]') !== null,
					);
					s.note(`[priya/tasks] task description slash menu ${menu ? "OPENS — embed parity reachable" : "does NOT open"}`);
					await s.shot(tasks, "tasks-slash");
					await tasks.keyboard.press("Escape").catch(() => undefined);
					await tasks.keyboard.press("Backspace");
					await tasks.keyboard.press("Backspace");
				} else {
					s.note(`[priya/tasks] opened a task; contenteditable editors found: ${editors} — where do I write the brief?`);
				}
			} else {
				s.note("[priya/tasks] still no clickable row found — see tasks-overview shot for what the list actually renders");
			}
		} catch (e) {
			s.note(`[priya/tasks] follow-up broke: ${String(e).slice(0, 200)}`);
		}
		if (tErrs.errors.length > 0) for (const e of tErrs.errors.slice(0, 4)) s.note(`    tasks console: ${e}`);
		await tasks.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ============ Dana — Database: what does the sidebar list? ===========
		const db = await s.openApp(APP.Database);
		const dbErrs = collectConsoleErrors(db);
		await db.waitForTimeout(3000);
		try {
			await s.shot(db, "db-overview");
			const side = await db.evaluate(() => {
				const el =
					document.querySelector('[class*="sidebar"]') ?? document.querySelector('nav') ?? document.body;
				return (el.textContent ?? "").replace(/\s+/g, " ").slice(0, 500);
			});
			s.note(`[dana/db] sidebar text: "${side}"`);
			const clients = db.locator('[class*="sidebar"] >> text=/clients/i').first();
			if ((await clients.count()) > 0) {
				await clients.click();
				await db.waitForTimeout(1500);
				await s.shot(db, "db-clients-grid");
				const footer = await db.evaluate(() => {
					const els = Array.from(document.querySelectorAll('[class*="footer"], [class*="agg"]'));
					for (const el of els) {
						const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
						if (t.length > 0) return t.slice(0, 200);
					}
					return null;
				});
				s.note(
					footer
						? `[dana/db] Clients footer reads: "${footer}"`
						: "[dana/db] Clients grid has NO readable aggregation footer — I still can't see what the pipeline is worth",
				);
			} else {
				s.note("[dana/db] no Clients entry in the sidebar — the CRM list I built is not where I left it (see db-overview)");
			}
		} catch (e) {
			s.note(`[dana/db] follow-up broke: ${String(e).slice(0, 200)}`);
		}
		if (dbErrs.errors.length > 0) for (const e of dbErrs.errors.slice(0, 4)) s.note(`    database console: ${e}`);
		await db.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ============ Marcus — Help ⓘ → What's new → 0.5.0? ==================
		try {
			const help = d
				.locator('[aria-label*="help" i], [data-testid*="help"], button[title*="help" i]')
				.first();
			if ((await help.count()) > 0) {
				await help.click();
				await d.waitForTimeout(1000);
				await s.shot(d, "help-overlay");
				const wn = d.locator("text=/what.?s new/i").first();
				if ((await wn.count()) > 0) {
					await wn.click();
					await d.waitForTimeout(1200);
					const body = await d.evaluate(() => document.body.textContent ?? "");
					s.note(
						`[marcus/help] Help → What's new works; popover ${body.includes("0.5.0") ? "tells the 0.5.0 story ✓" : "does NOT mention 0.5.0 — what version am I reading about?"}`,
					);
					await s.shot(d, "whats-new-via-help");
					await d.keyboard.press("Escape").catch(() => undefined);
				} else {
					s.note("[marcus/help] Help opened but no What's-new entry visible");
					await d.keyboard.press("Escape").catch(() => undefined);
				}
			} else {
				s.note("[marcus/help] no Help affordance found on the dashboard top bar");
			}
		} catch (e) {
			s.note(`[marcus/help] probe broke: ${String(e).slice(0, 200)}`);
		}

		s.chat(SPEAKER.Priya, "Follow-ups done: journal/tasks slash reality + the Notes baseline captured.");
		s.chat(SPEAKER.Dana, "Database sidebar dumped — now we know where (or whether) the Clients pipeline lives.");
	} finally {
		await s.finish();
	}
});
