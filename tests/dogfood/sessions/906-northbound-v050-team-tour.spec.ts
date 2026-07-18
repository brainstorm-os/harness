/**
 * Session 906 — the Northbound team tours v0.5.0 against the business.
 *
 * v0.5.0 landed yesterday ("Switch in, stay current, feel solid"). The team
 * walks the new functionality asking one question each:
 * - Mira (business): does Contacts de-dup/merge (F-158/DT-9) keep my CRM
 *   trustworthy? She seeds the classic mistake — the same client contact
 *   entered twice — and drives the new review→merge flow end to end.
 * - Priya (knowledge): F-070 gave Journal + Tasks the same embed/transclusion
 *   the Notes editor has — can the weekly log finally embed the live pipeline?
 * - Dana (ops): what's the Clients pipeline worth? The aggregation footer /
 *   rollup story on the Database grid (DT-4 rollups UI is queued for 0.5.1 —
 *   verify what a user can actually reach today).
 * - Marcus (design): the polish batch — Files gallery rest-frames (F-392),
 *   control faces (F-304) — plus whether "what changed" (What's-New, 13.12b
 *   update adoption) is even discoverable after the update.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";
import { collectConsoleErrors } from "../lib/invariants";

test("v0.5.0 team tour — merge, embeds, pipeline math, polish (906)", async () => {
	test.setTimeout(540_000);
	const s = await startSession("906-northbound-v050-team-tour");
	try {
		const d = s.dashboard;
		await d.waitForTimeout(2000);
		s.chat(SPEAKER.Mira, "v0.5.0 tour: I'll take Contacts merge, Priya takes Journal/Tasks embeds, Dana runs the pipeline numbers, Marcus sweeps the polish.");

		// ================= Mira — Contacts de-dup/merge (F-158/DT-9) =========
		const contacts = await s.openApp(APP.Contacts);
		const cErrs = collectConsoleErrors(contacts);
		await contacts.waitForTimeout(2500);
		await s.shot(contacts, "contacts-before");

		// Seed the realistic duplicate: the same Vertex Labs contact typed twice.
		const addOnce = async (which: string) => {
			await contacts.locator('[data-testid="contacts-new"]').click();
			await contacts.waitForTimeout(500);
			const dialog = contacts.locator('[data-testid="contacts-compose"]');
			const fields = dialog.locator("input");
			await dialog.locator('[data-testid="contacts-compose-name"]').fill("Jonas Wehner");
			// field order: name, company, email, phone (only name has a testid)
			const n = await fields.count();
			if (n >= 3) await fields.nth(2).fill("jonas@vertexlabs.io");
			if (which === "second" && n >= 2) await fields.nth(1).fill("Vertex Labs");
			await s.shot(contacts, `contacts-compose-${which}`);
			await dialog.locator('[data-testid="contacts-compose-create"]').click();
			await contacts.waitForTimeout(800);
		};
		let dupFlowRan = false;
		try {
			await addOnce("first");
			await addOnce("second");
			const dupsBtn = contacts.locator('[data-testid="contacts-dups-open"]');
			const dupsVisible = (await dupsBtn.count()) > 0;
			s.note(
				`[mira/contacts] created Jonas Wehner twice (same email); duplicates pill ${dupsVisible ? "APPEARED — it noticed on its own, good" : "did NOT appear — how do I find dupes?"}`,
			);
			await s.shot(contacts, "contacts-dups-pill");
			if (dupsVisible) {
				await dupsBtn.click();
				await contacts.waitForTimeout(600);
				await s.shot(contacts, "contacts-dups-dialog");
				const review = contacts.locator('[data-testid="contacts-dups-review"]').first();
				if ((await review.count()) > 0) {
					await review.click();
					await contacts.waitForTimeout(500);
					await s.shot(contacts, "contacts-dups-review");
					const merge = contacts.locator('[data-testid="contacts-dups-merge"]').first();
					if ((await merge.count()) > 0) {
						await merge.click();
						await contacts.waitForTimeout(1200);
						dupFlowRan = true;
						await s.shot(contacts, "contacts-after-merge");
						const remaining = await contacts
							.evaluate(() => document.body.textContent?.split("Jonas Wehner").length ?? 1)
							.then((parts) => parts - 1)
							.catch(() => -1);
						s.note(
							`[mira/contacts] merged; "Jonas Wehner" now appears ${remaining}× in the visible list area (want exactly 1 row — sidebar list + maybe detail pane)`,
						);
					} else s.note("[mira/contacts] review opened but no Merge button found");
				} else s.note("[mira/contacts] dups dialog has no Review affordance");
			}
		} catch (e) {
			s.note(`[mira/contacts] merge flow broke: ${String(e).slice(0, 200)}`);
		}
		if (cErrs.errors.length > 0) for (const e of cErrs.errors.slice(0, 4)) s.note(`    contacts console: ${e}`);
		s.chat(
			SPEAKER.Mira,
			dupFlowRan
				? "Contacts caught my double-entered Vertex contact and merged it — that's real CRM hygiene."
				: "Contacts merge: I couldn't get through the flow — details in the log.",
		);
		await contacts.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ================= Priya — F-070 embeds in Journal ===================
		const journal = await s.openApp(APP.Journal);
		const jErrs = collectConsoleErrors(journal);
		await journal.waitForTimeout(2500);
		try {
			const editor = journal.locator('[contenteditable="true"]').first();
			if ((await editor.count()) > 0) {
				await editor.click();
				await journal.keyboard.press("End");
				await journal.keyboard.type("Pipeline check: ");
				await journal.keyboard.type("/");
				await journal.waitForTimeout(900);
				await s.shot(journal, "journal-slash-menu");
				const menuText = await journal.evaluate(() => {
					const el =
						document.querySelector('[class*="typeahead"], [class*="slash"], [role="listbox"], .fm-menu') ??
						null;
					return el ? (el.textContent ?? "").slice(0, 400) : "";
				});
				s.note(
					`[priya/journal] slash menu ${menuText ? `opened: "${menuText.slice(0, 160)}…"` : "did NOT open"}`,
				);
				await journal.keyboard.type("Clients");
				await journal.waitForTimeout(900);
				await s.shot(journal, "journal-slash-clients");
				await journal.keyboard.press("Enter");
				await journal.waitForTimeout(1200);
				const embed = await journal.evaluate(() => {
					const el = document.querySelector('[class*="embed"], [class*="entity-card"], [data-entity-ref]');
					return el ? { cls: el.className.toString().slice(0, 80), text: (el.textContent ?? "").slice(0, 120) } : null;
				});
				s.note(
					embed
						? `[priya/journal] embed landed: ${embed.cls} — "${embed.text}"`
						: "[priya/journal] pressed Enter on the slash result but no embed/reference node found in the entry",
				);
				await s.shot(journal, "journal-embed-result");
			} else s.note("[priya/journal] no editable entry surface found");
		} catch (e) {
			s.note(`[priya/journal] embed probe broke: ${String(e).slice(0, 200)}`);
		}
		if (jErrs.errors.length > 0) for (const e of jErrs.errors.slice(0, 4)) s.note(`    journal console: ${e}`);
		await journal.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ================= Priya — F-070 embeds in Tasks =====================
		const tasks = await s.openApp(APP.Tasks);
		const tErrs = collectConsoleErrors(tasks);
		await tasks.waitForTimeout(2500);
		try {
			const row = tasks.locator('[class*="tasks-row"], [class*="task-row"], [class*="tasks-list"] [role="button"], [class*="tasks"] li').first();
			if ((await row.count()) > 0) {
				await row.click();
				await tasks.waitForTimeout(1000);
				await s.shot(tasks, "tasks-detail");
				const editor = tasks.locator('[contenteditable="true"]').last();
				if ((await editor.count()) > 0) {
					await editor.click();
					await tasks.keyboard.press("End");
					await tasks.keyboard.type(" /");
					await tasks.waitForTimeout(900);
					await s.shot(tasks, "tasks-slash-menu");
					const menuOpen = await tasks.evaluate(
						() =>
							document.querySelector('[class*="typeahead"], [class*="slash"], [role="listbox"], .fm-menu') !==
							null,
					);
					s.note(`[priya/tasks] task description slash menu ${menuOpen ? "opened" : "did NOT open"}`);
					await tasks.keyboard.press("Escape").catch(() => undefined);
					// tidy the probe chars
					await tasks.keyboard.press("Backspace");
					await tasks.keyboard.press("Backspace");
				} else s.note("[priya/tasks] opened a task but found no description editor");
			} else s.note("[priya/tasks] no task row found to open");
		} catch (e) {
			s.note(`[priya/tasks] probe broke: ${String(e).slice(0, 200)}`);
		}
		if (tErrs.errors.length > 0) for (const e of tErrs.errors.slice(0, 4)) s.note(`    tasks console: ${e}`);
		s.chat(SPEAKER.Priya, "Embed parity check done — Journal and Tasks slash menus probed; captures attached.");
		await tasks.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ================= Dana — pipeline math on the Clients grid ==========
		const db = await s.openApp(APP.Database);
		const dbErrs = collectConsoleErrors(db);
		await db.waitForTimeout(2500);
		try {
			const clients = db.locator("text=Clients").first();
			if ((await clients.count()) > 0) {
				await clients.click();
				await db.waitForTimeout(1500);
				await s.shot(db, "db-clients-grid");
				const footer = await db.evaluate(() => {
					const els = Array.from(document.querySelectorAll('[class*="footer"], [class*="agg"]'));
					for (const el of els) {
						const t = (el.textContent ?? "").trim();
						if (t.length > 0) return { cls: el.className.toString().slice(0, 80), text: t.slice(0, 200) };
					}
					return null;
				});
				s.note(
					footer
						? `[dana/db] Clients grid footer: ${footer.cls} — "${footer.text}" (can I read the pipeline total at a glance?)`
						: "[dana/db] NO aggregation footer visible on the Clients grid — where's my pipeline total?",
				);
				// Is a rollup column reachable from the grid? (DT-4 UI queued 0.5.1)
				const addCol = db.locator('[data-testid*="add-column"], [aria-label*="column" i], [class*="add-column"]').first();
				s.note(
					`[dana/db] add-column affordance ${(await addCol.count()) > 0 ? "present" : "not found from the grid"} — rollup authoring is the 0.5.1 promise, checking today's reality`,
				);
			} else s.note("[dana/db] no 'Clients' list in the Database sidebar?!");
		} catch (e) {
			s.note(`[dana/db] probe broke: ${String(e).slice(0, 200)}`);
		}
		if (dbErrs.errors.length > 0) for (const e of dbErrs.errors.slice(0, 4)) s.note(`    database console: ${e}`);
		s.chat(SPEAKER.Dana, "Ran the Clients grid — footer + rollup reality captured.");
		await db.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ================= Marcus — Files gallery rest-frames (F-392) ========
		const files = await s.openApp(APP.Files);
		const fErrs = collectConsoleErrors(files);
		await files.waitForTimeout(2500);
		try {
			const sw = files.locator('[data-testid="view-switch"]').first();
			if ((await sw.count()) > 0) {
				await sw.click();
				await files.waitForTimeout(500);
				await s.shot(files, "files-view-menu");
				const gallery = files.locator("text=/gallery/i").first();
				if ((await gallery.count()) > 0) {
					await gallery.click();
					await files.waitForTimeout(1200);
					const probe = await files.evaluate(() => {
						const mode = document.body.getAttribute("data-view-mode");
						const tile = document.querySelector(".content-row") as HTMLElement | null;
						if (!tile) return { mode, tile: null };
						const cs = getComputedStyle(tile);
						return {
							mode,
							tile: { border: `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`, bg: cs.backgroundColor, shadow: cs.boxShadow },
						};
					});
					s.note(
						`[marcus/files] gallery mode=${probe.mode}; first tile at rest: border=${probe.tile?.border ?? "n/a"} bg=${probe.tile?.bg ?? "n/a"} shadow=${probe.tile?.shadow ?? "n/a"} (want transparent frame at rest per F-392)`,
					);
					await s.shot(files, "files-gallery-rest");
				} else {
					s.note("[marcus/files] view menu open but no Gallery option visible");
					await files.keyboard.press("Escape").catch(() => undefined);
				}
			} else s.note("[marcus/files] no view-switch in the Files header");
		} catch (e) {
			s.note(`[marcus/files] probe broke: ${String(e).slice(0, 200)}`);
		}
		if (fErrs.errors.length > 0) for (const e of fErrs.errors.slice(0, 4)) s.note(`    files console: ${e}`);
		await files.close().catch(() => undefined);
		await d.waitForTimeout(300);

		// ================= Marcus — where do I read what changed? ============
		try {
			const hit = await d.evaluate(() => {
				const nodes = Array.from(document.querySelectorAll("button, [role='button'], [data-testid]"));
				for (const el of nodes) {
					const label = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("data-testid") ?? ""} ${(el.textContent ?? "").slice(0, 40)}`;
					if (/what.?s.?new|changelog|release/i.test(label)) {
						return { testid: el.getAttribute("data-testid"), label: label.trim().slice(0, 80) };
					}
				}
				return null;
			});
			if (hit) {
				s.note(`[marcus/dashboard] What's-New affordance found: ${JSON.stringify(hit)}`);
				const trigger = hit.testid
					? d.locator(`[data-testid="${hit.testid}"]`).first()
					: d.locator("button", { hasText: /what.?s new/i }).first();
				await trigger.click().catch(() => undefined);
				await d.waitForTimeout(900);
				const body = await d.evaluate(() => document.body.textContent ?? "");
				s.note(
					`[marcus/dashboard] What's-New ${body.includes("0.5.0") ? "mentions 0.5.0 ✓" : "does NOT mention 0.5.0"} after opening`,
				);
				await s.shot(d, "whats-new");
				await d.keyboard.press("Escape").catch(() => undefined);
			} else {
				s.note(
					"[marcus/dashboard] swept every button/testid on the dashboard for a What's-New / changelog / release affordance — nothing. After an auto-update, where does a user learn what changed?",
				);
				await s.shot(d, "dashboard-no-whats-new");
			}
		} catch (e) {
			s.note(`[marcus/dashboard] whats-new probe broke: ${String(e).slice(0, 200)}`);
		}
		s.chat(SPEAKER.Marcus, "Polish sweep done — gallery rest-state probed, What's-New discoverability checked.");

		s.note("[team] v0.5.0 tour complete — captures + notes above; friction distilled to the log after readback.");
	} finally {
		await s.finish();
	}
});
