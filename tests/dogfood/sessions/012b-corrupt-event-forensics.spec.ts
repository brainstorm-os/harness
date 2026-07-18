/**
 * 012b — forensics probe for F-422: dump the corrupted calendar events'
 * raw records (title, created/updated stamps) via the Calendar app's own
 * runtime, so we know WHEN they were created and can match the session
 * that typed them. Read-only.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("dump corrupted event records", async () => {
	const s = await startSession("012b-corrupt-event-forensics");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(3000);
		const dump = await cal.evaluate(async () => {
			const svc = (
				window as unknown as {
					brainstorm?: { services?: { vaultEntities?: { list(t: string): Promise<unknown[]> } } };
				}
			).brainstorm?.services?.vaultEntities;
			if (!svc) return { error: "no vaultEntities service" };
			const types = ["brainstorm/Event/v1", "calendar/Event/v1"];
			const out: unknown[] = [];
			for (const t of types) {
				try {
					const rows = (await svc.list(t)) as Array<{
						id: string;
						properties?: Record<string, unknown>;
						createdAt?: number;
						updatedAt?: number;
					}>;
					for (const r of rows) {
						const title = String(r.properties?.title ?? "");
						if (/peline|morf|won won|readyPipe/.test(title) || /^[a-z]?ipeline/.test(title)) {
							out.push({
								type: t,
								id: r.id,
								title,
								createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
								updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
								createdBy: r.properties?.createdBy ?? null,
							});
						}
					}
				} catch {
					// type may not exist
				}
			}
			return { matches: out };
		});
		s.note(`[forensics] ${JSON.stringify(dump, null, 1).slice(0, 3000)}`);
	} finally {
		await s.finish();
	}
});
