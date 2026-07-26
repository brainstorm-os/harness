import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe the app page API surface (914c)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("914c-api-probe");
	try {
		const db = await s.openApp(APP.Database);
		await db.waitForTimeout(3000);
		const shape = await db.evaluate(() => {
			const w = window as unknown as Record<string, unknown>;
			const bs = w.brainstorm as Record<string, unknown> | undefined;
			const describe = (o: unknown, depth = 0): unknown => {
				if (!o || typeof o !== "object" || depth > 1) return typeof o;
				return Object.fromEntries(
					Object.keys(o as object).map((k) => [k, typeof (o as Record<string, unknown>)[k]]),
				);
			};
			return {
				globals: Object.keys(w).filter((k) => /brainstorm|bs|vault|sdk/i.test(k)),
				brainstormKeys: bs ? Object.keys(bs) : null,
				nested: bs
					? Object.fromEntries(Object.keys(bs).slice(0, 25).map((k) => [k, describe(bs[k], 1)]))
					: null,
			};
		});
		s.note(`[api] ${JSON.stringify(shape).slice(0, 3500)}`);
	} finally {
		await s.finish();
	}
});
