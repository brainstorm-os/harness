/**
 * 012g — the F-422/F-424b residue repair (WRITES to the Northbound vault;
 * backup taken: .data-backups/northbound-2026-07-18-pre-residue-sweep.tar.gz).
 *
 * 1. Reminders (brainstorm/Reminder/v1): repair F-299-corrupted titles —
 *    "ipeline ready" variants → "Pipeline ready"; doubled → single; a fully
 *    reversed title → reversed back.
 * 2. Tasks: delete "DeleteMe task 26658".
 * 3. Contacts: delete the two probe Persons.
 * 4. Notes: delete the doubled "DeleteMe note …".
 *
 * Each repair runs from the app window that owns the type (capability
 * scope). Read-only dump lines record before/after.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Row = { id: string; properties?: Record<string, unknown> };

async function listType(page: Page, type: string): Promise<Row[]> {
	return await page.evaluate(async (t) => {
		const svc = (
			window as unknown as {
				brainstorm?: {
					services?: {
						vaultEntities?: { list(q: { types: string[] }): Promise<unknown> };
					};
				};
			}
		).brainstorm?.services?.vaultEntities;
		if (!svc) return [];
		const res = (await svc.list({ types: [t] })) as
			| Array<{ id: string; properties?: Record<string, unknown> }>
			| { entities?: Array<{ id: string; properties?: Record<string, unknown> }> };
		return Array.isArray(res) ? res : (res.entities ?? []);
	}, type);
}

async function updateTitle(page: Page, id: string, title: string): Promise<string> {
	return await page.evaluate(
		async ({ id, title }) => {
			const svc = (
				window as unknown as {
					brainstorm?: {
						services?: {
							vaultEntities?: {
								update(id: string, props: Record<string, unknown>): Promise<unknown>;
							};
						};
					};
				}
			).brainstorm?.services?.vaultEntities;
			if (!svc?.update) return "no update api";
			try {
				await svc.update(id, { title });
				return "ok";
			} catch (err) {
				return String(err).slice(0, 90);
			}
		},
		{ id, title },
	);
}

async function deleteEntity(page: Page, id: string): Promise<string> {
	return await page.evaluate(async (id) => {
		const svc = (
			window as unknown as {
				brainstorm?: {
					services?: { vaultEntities?: { delete?(id: string): Promise<unknown> } };
				};
			}
		).brainstorm?.services?.vaultEntities;
		if (!svc?.delete) return "no delete api";
		try {
			await svc.delete(id);
			return "ok";
		} catch (err) {
			return String(err).slice(0, 90);
		}
	}, id);
}

/** "Pipeline ready" repair for one corrupted variant, or null if healthy. */
function repairedTitle(raw: string): string | null {
	if (raw === "Pipeline ready") return null;
	// Doubled ("Pipeline readyPipeline rea…" or "DeleteMe note XDeleteMe note Y").
	if (/^(Pipeline ready)+/.test(raw) && raw !== "Pipeline ready") return "Pipeline ready";
	// Leading chars eaten ("ipeline ready", "peline ready", …).
	if (/^[A-Za-z]{0,6}ipeline ready$/.test(raw) || /^\w{0,4}peline ready$/.test(raw)) {
		return "Pipeline ready";
	}
	// Fully reversed (".no won morf …") — reverse restores the original.
	if (/^\.\S/.test(raw) && /\bmorf\b|\bnow\b/.test(raw.split("").reverse().join(""))) {
		return raw.split("").reverse().join("");
	}
	return null;
}

test("repair corrupted reminder titles + delete probe residue", async () => {
	const s = await startSession("012g-residue-repair");
	try {
		// ── Reminders via Calendar (it plots them; shares the type cap) ──
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(3000);
		const reminders = await listType(cal, "brainstorm/Reminder/v1");
		s.note(`[reminders] ${reminders.length} rows`);
		let repaired = 0;
		for (const r of reminders) {
			const raw = String(r.properties?.title ?? "");
			const fixed = repairedTitle(raw);
			if (fixed !== null && fixed !== raw) {
				const res = await updateTitle(cal, r.id, fixed);
				s.note(`[repair] ${r.id.slice(0, 18)} "${raw.slice(0, 40)}" → "${fixed.slice(0, 40)}": ${res}`);
				if (res === "ok") repaired++;
			}
		}
		s.note(`[reminders] repaired=${repaired}`);
		await cal.close().catch(() => undefined);

		// ── Tasks: DeleteMe task ─────────────────────────────────────────
		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2500);
		for (const r of await listType(tasks, "brainstorm/Task/v1")) {
			if (/^DeleteMe/i.test(String(r.properties?.title ?? r.properties?.name ?? ""))) {
				s.note(`[tasks] delete ${r.id}: ${await deleteEntity(tasks, r.id)}`);
			}
		}
		await tasks.close().catch(() => undefined);

		// ── Contacts: probe Persons ──────────────────────────────────────
		const contacts = await s.openApp(APP.Contacts);
		await contacts.waitForTimeout(2500);
		for (const r of await listType(contacts, "brainstorm/Person/v1")) {
			const label = String(r.properties?.fullName ?? r.properties?.name ?? "");
			if (/Probe [A-Z]\d{6}/.test(label)) {
				s.note(`[contacts] delete "${label}" ${r.id}: ${await deleteEntity(contacts, r.id)}`);
			}
		}
		await contacts.close().catch(() => undefined);

		// ── Notes: doubled DeleteMe note ─────────────────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2500);
		for (const r of await listType(notes, "io.brainstorm.notes/Note/v1")) {
			if (/^DeleteMe/i.test(String(r.properties?.title ?? ""))) {
				s.note(`[notes] delete ${r.id}: ${await deleteEntity(notes, r.id)}`);
			}
		}
		await notes.close().catch(() => undefined);
	} finally {
		await s.finish();
	}
});
