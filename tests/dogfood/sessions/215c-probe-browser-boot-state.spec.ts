/**
 * Probe 215c — companion to 215b: capture the web-view state RIGHT AFTER boot
 * (restore settled, no user navigation) to see what the restore flow produced.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function dumpViews(s: Awaited<ReturnType<typeof startSession>>, label: string) {
	const views = await s.app.evaluate(({ BaseWindow }) => {
		type AnyView = {
			getBounds(): { x: number; y: number; width: number; height: number };
			getVisible?: () => boolean;
			webContents?: { getURL(): string; isDestroyed(): boolean };
			children?: AnyView[];
		};
		const out: string[] = [];
		for (const win of BaseWindow.getAllWindows()) {
			const content = (win as unknown as { contentView: AnyView }).contentView;
			for (const child of content.children ?? []) {
				const url =
					child.webContents && !child.webContents.isDestroyed() ? child.webContents.getURL() : "<no-wc>";
				out.push(
					`win#${win.id} url=${url.slice(0, 80)} bounds=${JSON.stringify(child.getBounds())} visible=${child.getVisible ? child.getVisible() : "?"}`,
				);
			}
		}
		return out;
	});
	for (const v of views) s.note(`[${label}] ${v}`);
}

test("probe: browser web-view state at boot, before any navigation (215c)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("215c-probe-browser-boot-state");
	try {
		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(1500);
		await dumpViews(s, "t+1.5s");
		await br.waitForTimeout(4000);
		await dumpViews(s, "t+5.5s");
		const omniValue = await br
			.locator('[aria-label="Address bar"]')
			.first()
			.inputValue()
			.catch(() => "?");
		s.note(`omnibox at boot: "${omniValue}"`);
		const tabDom = await br.evaluate(() =>
			Array.from(document.querySelectorAll('[role="tab"], .browser__tab')).map((el) => ({
				cls: el.className,
				text: (el.textContent ?? "").trim().slice(0, 40),
				selected: el.getAttribute("aria-selected"),
			})),
		);
		s.note(`tab DOM: ${JSON.stringify(tabDom)}`);
		await s.shot(br, "01-boot-settled");
	} finally {
		await s.finish();
	}
});
