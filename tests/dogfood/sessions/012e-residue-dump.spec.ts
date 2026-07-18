/**
 * 012e — residue dump (read-only) for the F-422 repair + F-424b sweep:
 * find every entity whose title/name carries an F-299 corruption signature
 * ("ipeline ready" variants, doubled, reversed) plus the named probe
 * residue, with their types + ids, so the repair probe can be exact.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const TYPES = [
	"brainstorm/Event/v1",
	"brainstorm/Note/v1",
	"brainstorm/Task/v1",
	"io.brainstorm.journal/Entry/v1",
	"brainstorm/Person/v1",
	"brainstorm/Contact/v1",
];

test("dump corruption-signature + probe-residue entities", async () => {
	const s = await startSession("012e-residue-dump");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(3000);
		const dump = await cal.evaluate(async (types) => {
			const svc = (
				window as unknown as {
					brainstorm?: {
						services?: { vaultEntities?: { list(q: { types: string[] }): Promise<unknown> } };
					};
				}
			).brainstorm?.services?.vaultEntities;
			if (!svc) return { error: "no vaultEntities" };
			const out: unknown[] = [];
			for (const t of types) {
				try {
					const res = (await svc.list({ types: [t] })) as
						| Array<{ id: string; type?: string; properties?: Record<string, unknown> }>
						| { entities?: Array<{ id: string; type?: string; properties?: Record<string, unknown> }> };
					const rows = Array.isArray(res) ? res : (res.entities ?? []);
					for (const r of rows) {
						const p = r.properties ?? {};
						const label = String(p.title ?? p.name ?? p.fullName ?? "");
						if (
							/peline ready/i.test(label) ||
							/morf pu/.test(label) ||
							/readyPipe/.test(label) ||
							/^DeleteMe/i.test(label) ||
							/Probe [A-Z]\d{6}/.test(label)
						) {
							out.push({ type: r.type ?? t, id: r.id, label: label.slice(0, 80) });
						}
					}
				} catch (err) {
					out.push({ type: t, error: String(err).slice(0, 80) });
				}
			}
			return { matches: out };
		}, TYPES);
		s.note(`[dump] ${JSON.stringify(dump, null, 1).slice(0, 4000)}`);
	} finally {
		await s.finish();
	}
});
