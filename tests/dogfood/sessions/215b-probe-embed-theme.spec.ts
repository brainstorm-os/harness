/**
 * Probe 215b — why does the embedded-list block still paint light in a dark
 * theme? Reads the block iframe's :root inline vars + computed colors in the
 * running shell (the F-210 theme half).
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe: embed iframe theme state (215b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("215b-probe-embed-theme");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(3000);
		await notes
			.locator("aside li, [class*='sidebar'] li")
			.filter({ hasText: "Fix verification — embeds" })
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(4000);
		// Host-side facts.
		const host = await notes.evaluate(() => {
			const root = document.documentElement;
			let tokenCount = 0;
			for (let i = 0; i < root.style.length; i++) {
				if (root.style.item(i).startsWith("--")) tokenCount++;
			}
			return {
				inlineTokens: tokenCount,
				colorScheme: getComputedStyle(root).colorScheme,
				bgPrimary: getComputedStyle(root).getPropertyValue("--color-background-primary").trim(),
			};
		});
		s.note(`host: ${JSON.stringify(host)}`);
		// Frame-side facts.
		const frame = notes.frameLocator("iframe").first();
		const inner = await frame
			.locator("html")
			.evaluate((el) => {
				const root = el as HTMLElement;
				let tokenCount = 0;
				const sample: string[] = [];
				for (let i = 0; i < root.style.length; i++) {
					const k = root.style.item(i);
					if (k.startsWith("--")) {
						tokenCount++;
						if (sample.length < 4) sample.push(`${k}=${root.style.getPropertyValue(k).trim()}`);
					}
				}
				const cs = getComputedStyle(root);
				const body = root.ownerDocument.body;
				return {
					inlineTokens: tokenCount,
					sample,
					colorScheme: cs.colorScheme,
					inlineColorScheme: root.style.colorScheme || "(none)",
					bodyBg: body ? getComputedStyle(body).backgroundColor : "?",
					bgPrimaryVar: cs.getPropertyValue("--color-background-primary").trim() || "(unset)",
				};
			})
			.catch((e) => ({ error: String(e).slice(0, 200) }));
		s.note(`frame: ${JSON.stringify(inner)}`);
		await s.shot(notes, "01-embed-state");
	} finally {
		await s.finish();
	}
});
