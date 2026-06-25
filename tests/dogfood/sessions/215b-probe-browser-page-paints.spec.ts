/**
 * Probe 215b — "browser does not show page again" (user report 2026-06-11).
 * Drives a real navigation, then inspects the shell-side WebContentsView from
 * the MAIN process: does a web view exist, is it visible, are its bounds
 * non-zero and inside the window? Finishes with a native window capture
 * (capturePage includes WebContentsViews — the renderer screenshot doesn't).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("probe: navigated page actually paints in the browser window (215b)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("215b-probe-browser-page-paints");
	try {
		const br = await s.openApp(APP.Browser);
		await br.waitForTimeout(4000);
		await s.shot(br, "01-browser-boot");

		const omnibox = br.locator('[aria-label="Address bar"]').first();
		await omnibox.click();
		await omnibox.fill("https://example.com");
		await omnibox.press("Enter");
		await br.waitForTimeout(6000);

		// Renderer-side state: what does the chrome believe?
		const tabs = await br
			.locator('[class*="tab"]')
			.allTextContents()
			.catch(() => [] as string[]);
		s.note(`chrome tabs after navigate: ${JSON.stringify(tabs.filter((t) => t.trim()).slice(0, 6))}`);

		// Region rect as the chrome measures it (what it pushes via SetBounds).
		const region = await br.evaluate(() => {
			const el = document.querySelector(".browser__region");
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return { x: r.left, y: r.top, w: r.width, h: r.height };
		});
		s.note(`chrome web-region rect: ${JSON.stringify(region)}`);

		// MAIN process: enumerate every BaseWindow's contentView children and
		// report each child view's bounds/visibility + its webContents URL.
		const views = await s.app.evaluate(({ BaseWindow }) => {
			type AnyView = {
				getBounds(): { x: number; y: number; width: number; height: number };
				getVisible?: () => boolean;
				webContents?: { getURL(): string; isDestroyed(): boolean };
				children?: AnyView[];
			};
			const out: Array<{
				window: string;
				url: string;
				bounds: { x: number; y: number; width: number; height: number };
				visible: string;
			}> = [];
			for (const win of BaseWindow.getAllWindows()) {
				const content = (win as unknown as { contentView: AnyView }).contentView;
				const winBounds = win.getBounds();
				const tag = `win#${win.id} ${win.getTitle?.() ?? ""} ${winBounds.width}x${winBounds.height} visible=${win.isVisible()}`;
				for (const child of content.children ?? []) {
					out.push({
						window: tag,
						url:
							child.webContents && !child.webContents.isDestroyed()
								? child.webContents.getURL()
								: "<no-wc>",
						bounds: child.getBounds(),
						visible: String(child.getVisible ? child.getVisible() : "?"),
					});
				}
			}
			return out;
		});
		for (const v of views) {
			s.note(
				`view [${v.window}] url=${v.url.slice(0, 90)} bounds=${JSON.stringify(v.bounds)} visible=${v.visible}`,
			);
		}

		// THE regression guard (user report 2026-06-11 "browser does not show
		// page again"): the navigated page's view must be visible AND sized —
		// a 0×0 view loads the page invisibly (JS runs, screen stays blank).
		const pageView = views.find((v) => v.url.startsWith("https://example.com"));
		expect(pageView, "a WebContentsView for the navigated URL must exist").toBeTruthy();
		expect(pageView?.visible).toBe("true");
		expect(pageView?.bounds.width ?? 0).toBeGreaterThan(100);
		expect(pageView?.bounds.height ?? 0).toBeGreaterThan(100);

		// Native capture of the browser window — includes WebContentsViews.
		const capture = await s.app.evaluate(async ({ BaseWindow }) => {
			for (const win of BaseWindow.getAllWindows()) {
				const content = (
					win as unknown as {
						contentView: {
							children?: Array<{
								webContents?: {
									getURL(): string;
									capturePage(): Promise<{ toPNG(): Buffer }>;
									isDestroyed(): boolean;
								};
							}>;
						};
					}
				).contentView;
				for (const child of content.children ?? []) {
					const wc = child.webContents;
					if (wc && !wc.isDestroyed() && wc.getURL().startsWith("https://example.com")) {
						const img = await wc.capturePage();
						return img.toPNG().toString("base64");
					}
				}
			}
			return null;
		});
		s.note(
			`web view capturePage: ${capture ? `${Math.round(capture.length / 1024)}KB png` : "NO example.com view found"}`,
		);
		if (capture) {
			const { writeFileSync } = await import("node:fs");
			const { join } = await import("node:path");
			writeFileSync(
				join(
					"tests",
					"dogfood",
					".sessions",
					"215b-probe-browser-page-paints",
					"03-webview-native.png",
				),
				Buffer.from(capture, "base64"),
			);
		}
		await s.shot(br, "02-after-navigate");
	} finally {
		await s.finish();
	}
});
