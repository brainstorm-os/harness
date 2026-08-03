/**
 * Session 937 — probe: WHY does `entities.applyDoc` reject for every Journal
 * day? Session 936 proved F-488 is not fixed by shell #460: the healing resend
 * exhausts all five attempts on every journal entity, so the rejection is
 * permanent, not the transient lazy-create the backoff assumed. #460's give-up
 * message discards the underlying error, so this asks the service directly.
 *
 * Payload is the canonical EMPTY Yjs update (`[0, 0]` → "AAA=") — zero structs,
 * zero deletes. It is a valid no-op if it ever reaches the doc, so this cannot
 * mutate the Northbound vault; the gates we're probing (row lookup, then the
 * `entities.write:<type>` capability) both run BEFORE any apply.
 *
 * Records factual captures only.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** Yjs update with 0 structs and 0 deletes — a valid no-op. */
const EMPTY_UPDATE_B64 = "AAA=";

test("probe why applyDoc rejects for journal days (937)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("937-probe-journal-applydoc-rejection");
	try {
		const page = await s.openApp(APP.Journal);
		await page.waitForTimeout(2600);
		s.note("\n### probe — entities.applyDoc / entities.get for journal days");

		const report = await page.evaluate(async (updateB64) => {
			type EntitiesApi = {
				applyDoc?(id: string, b64: string): Promise<unknown>;
				get?(id: string): Promise<unknown>;
			};
			const root = (
				window as unknown as {
					brainstorm?: {
						services?: { entities?: EntitiesApi };
						capabilities?: { list?(): Promise<unknown> };
						ydoc?: Record<string, unknown>;
					};
				}
			).brainstorm;
			const bs = { entities: root?.services?.entities, capabilities: root?.capabilities };
			if (!bs.entities) {
				return {
					error: "no brainstorm.services.entities",
					services: Object.keys(root?.services ?? {}).join(","),
					ydoc: Object.keys(root?.ydoc ?? {}).join(","),
				};
			}

			const ids = ["journal-2026-07-25", "journal-2026-07-29"];
			const rows: Record<string, string> = {};
			for (const id of ids) {
				try {
					const row = await bs.entities.get?.(id);
					rows[id] = row
						? `EXISTS type=${(row as { type?: string }).type ?? "?"}`
						: "NULL (no row)";
				} catch (e) {
					rows[id] = `get threw: ${(e as Error).message}`;
				}
			}

			const applies: Record<string, string> = {};
			for (const id of ids) {
				try {
					await bs.entities.applyDoc?.(id, updateB64);
					applies[id] = "RESOLVED (no rejection)";
				} catch (e) {
					applies[id] = `REJECTED: ${(e as Error).message}`;
				}
			}

			let caps = "(capabilities API absent)";
			try {
				caps = JSON.stringify(await bs.capabilities?.list?.());
			} catch (e) {
				caps = `caps threw: ${(e as Error).message}`;
			}

			return { rows, applies, caps };
		}, EMPTY_UPDATE_B64);

		s.note("```json");
		s.note(JSON.stringify(report, null, 2));
		s.note("```");
	} finally {
		await s.finish();
	}
});
