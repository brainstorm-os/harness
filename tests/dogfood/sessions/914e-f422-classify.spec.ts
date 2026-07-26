import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("F-422: classify the journal bodies exactly (914e)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("914e-f422-classify");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3500);
		const out = await db.evaluate(async () => {
			const api = (
				window as unknown as {
					brainstorm?: { services?: { vaultEntities?: { list?: () => Promise<unknown> } } };
				}
			).brainstorm?.services;
			if (!api?.vaultEntities?.list) return { error: "no list" };
			const snap = (await api.vaultEntities.list()) as {
				entities?: Array<{ id: string; type: string; properties?: Record<string, unknown> }>;
			};
			const journals = (snap?.entities ?? []).filter((e) => e.type.includes("journal"));
			return {
				totalJournals: journals.length,
				rows: journals
					.map((e) => ({
						id: e.id,
						// every string field, full value, so nothing is judged on a truncation
						fields: Object.fromEntries(
							Object.entries(e.properties ?? {})
								.filter(([, v]) => typeof v === "string" && (v as string).length > 0)
								.map(([k, v]) => [k, v as string]),
						),
					}))
					.filter((r) => Object.values(r.fields).some((v) => /peline|\.no won|morf pu/.test(v))),
			};
		});
		s.note(`[classify] ${JSON.stringify(out, null, 1).slice(0, 6000)}`);
	} finally {
		await s.finish();
	}
});
