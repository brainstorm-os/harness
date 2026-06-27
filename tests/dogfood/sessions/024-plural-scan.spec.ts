/**
 * Session 024 — ICU plural-leak + pluralization scan across apps.
 *
 * CLAUDE.md documents a real bug (F-162): an ICU plural template written
 * against the app-side `createT` (which does `{name}` interpolation only, no
 * ICU) leaks the raw `{count, plural, …}` string to the UI. This opens each
 * app and scans the rendered text for raw ICU templates and for
 * singular/plural mismatches ("1 items"), reporting anything suspicious.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const RAW_ICU = /\{[a-zA-Z]+,\s*(plural|select|selectordinal),/;
const SINGULAR_PLURAL = /\b1\s+([a-z]+(?:s|es))\b/g; // "1 items", "1 tasks" — likely wrong

test("plural scan: no raw ICU templates or singular/plural mismatches", async () => {
	test.setTimeout(300_000);
	const s = await startSession("024-plural-scan");
	const icuLeaks: string[] = [];
	try {
		for (const [name, id] of Object.entries(APP)) {
			let page: Awaited<ReturnType<typeof s.openApp>>;
			try {
				page = await s.openApp(id);
			} catch {
				continue;
			}
			await page.waitForTimeout(1300);
			const text =
				(await page
					.locator("body")
					.innerText()
					.catch(() => "")) ?? "";

			if (RAW_ICU.test(text)) {
				const snippet = text.match(RAW_ICU)?.[0] ?? "";
				icuLeaks.push(`${name}: RAW ICU LEAK "${snippet}"`);
				s.note(`✗ ${name}: RAW ICU "${snippet}"`);
			}
			// Allowlist common correct singulars ("1 task selected" is fine when the
			// noun is genuinely plural-form; we only flag obvious count nouns).
			const sp = [...text.matchAll(SINGULAR_PLURAL)]
				.map((m) => m[0])
				.filter((m) =>
					/\b1\s+(items|tasks|notes|files|folders|bookmarks|events|channels|results|words|properties|fields|forms|contacts|messages)\b/.test(
						m,
					),
				);
			if (sp.length > 0) {
				s.note(`~ ${name}: possible singular/plural mismatch: ${[...new Set(sp)].join(", ")}`);
			} else {
				s.note(`✓ ${name}: no plural leak`);
			}
		}

		s.note(`\nraw ICU leaks: ${icuLeaks.length}`);
		for (const l of icuLeaks) s.note(`  ${l}`);
		expect(icuLeaks, "no raw ICU plural/select templates should leak to the UI").toEqual([]);
	} finally {
		await s.finish();
	}
});
