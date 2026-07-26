/**
 * Session 914b — locate the F-422 corrupted objects.
 *
 * The calendar's own KV holds only clean milestone events, so the corrupted
 * chips are MIRRORS of other entities (Journal / Tasks / Notes). `entities.db`
 * is encrypted, so the only way to enumerate them is through a granted app
 * page's `vaultEntities.list()`. Read-only: identifies id + type + title so a
 * repair can be targeted rather than guessed.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const BAD = /ipeline ready|peline ready|readyPipe|\.no won|morf pu/;

test("F-422: locate the corrupted objects (914b)", async () => {
	test.setTimeout(420_000);
	const s = await startSession("914b-f422-locate-objects");
	try {
		// Database is the broad reader (its "All vault items" list showed 1088).
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3500);

		const found = await db.evaluate(async () => {
			const api = (
				window as unknown as {
					brainstorm?: { services?: { vaultEntities?: { list?: () => Promise<unknown> } } };
				}
			).brainstorm?.services;
			if (!api?.vaultEntities?.list) return { error: "no services.vaultEntities.list on this page" };
			try {
				const snap = (await api.vaultEntities.list()) as {
					entities?: Array<{ id: string; type: string; properties?: Record<string, unknown> }>;
				};
				const list = snap?.entities ?? [];
				const re = /ipeline ready|peline ready|readyPipe|\.no won|morf pu/;
				const hits = list
					.filter((e) => {
						const p = e.properties ?? {};
						return Object.values(p).some((v) => typeof v === "string" && re.test(v));
					})
					.map((e) => ({
						id: e.id,
						type: e.type,
						fields: Object.fromEntries(
							Object.entries(e.properties ?? {})
								.filter(([, v]) => typeof v === "string" && re.test(v as string))
								.map(([k, v]) => [k, String(v).slice(0, 90)]),
						),
					}));
				return { total: list.length, hits };
			} catch (e) {
				return { error: String(e) };
			}
		});

		s.note(`[probe] ${JSON.stringify(found).slice(0, 3000)}`);
		const hits = (found as { hits?: unknown[] }).hits ?? [];
		s.note(`[probe] corrupted objects found: ${hits.length}`);
		await s.shot(db, "database-open");
	} finally {
		await s.finish();
	}
});
