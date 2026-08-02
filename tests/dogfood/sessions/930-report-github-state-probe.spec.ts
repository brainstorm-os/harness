/**
 * TEMP probe 930 — Help → "Report on GitHub" under the owner-like state the
 * regression spec never covers: a REAL vault with the Browser app installed,
 * a Browser window ALREADY OPEN, and a remembered default handler
 * `(open, scheme:https) → io.brainstorm.browser`. Fresh-vault probes pass and
 * every refusal path toasts, so the remaining silent candidate is the
 * handled:true focus-existing + pushed-intent path. Cleans its pin up after.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type DashboardBridge = {
	brainstorm: {
		dashboard: {
			setDefaultHandler: (verb: string, signature: string, appId: string | null) => Promise<void>;
			defaultsCatalog?: () => Promise<unknown>;
			snapshot?: () => Promise<{ osHandoffConsent?: Record<string, string> } | null>;
		};
	};
};

test("930 — report-on-github stateful probe", async () => {
	const s = await startSession("930-report-github-state-probe");
	const { app, dashboard } = s;
	try {
		await app.evaluate(({ shell }) => {
			const g = globalThis as unknown as { __ext?: string[] };
			g.__ext = [];
			shell.openExternal = async (url: string) => {
				g.__ext?.push(url);
			};
		});

		// What state does the vault ALREADY hold for https? (the owner-answer)
		const preState = await dashboard.evaluate(async () => {
			const bs = (window as unknown as DashboardBridge).brainstorm;
			const catalog = await bs.dashboard.defaultsCatalog?.().catch((e: unknown) => `ERR ${String(e)}`);
			const snap = await bs.dashboard.snapshot?.().catch(() => null);
			return JSON.stringify({ catalog, consent: snap?.osHandoffConsent ?? null });
		});
		s.note(`pre-existing state: ${preState}`);
		console.log(`PROBE pre-state ${preState}`);

		// A Browser window already open — the focus-existing path's precondition.
		const browserPage = await s.openApp(APP.Browser);
		await dashboard.waitForTimeout(2500);

		// ── Scenario 0: NO stored state → the "Open with…" picker must render
		// ABOVE the Help overlay. If it mounts behind it, the button reads dead.
		// Instrumented: observe the prompt channel AND the raw dispatch result.
		const dispatchResult = await dashboard.evaluate(async () => {
			const bs = window.brainstorm as unknown as {
				openWithPrompt?: { on: (l: (r: unknown) => void) => () => void };
				intents: { dispatch: (i: unknown) => Promise<unknown> };
			};
			bs.openWithPrompt?.on((req) => console.log(`PROBE-PROMPT-REQ ${JSON.stringify(req)}`));
			const race = await Promise.race([
				bs.intents
					.dispatch({
						verb: "open",
						payload: { url: "https://github.com/brainstorm-os/shell/issues/new/choose" },
					})
					.then((r) => `resolved ${JSON.stringify(r)}`),
				new Promise((resolve) => setTimeout(() => resolve("STILL-PENDING after 8s"), 8000)),
			]);
			return String(race);
		});
		console.log(`PROBE scenario0 dispatch=${dispatchResult}`);
		s.note(`scenario0 dispatch=${dispatchResult}`);
		await dashboard.keyboard.press("Escape");
		await dashboard.waitForTimeout(300);
		await dashboard.getByRole("button", { name: /help/i }).first().click();
		await dashboard.waitForSelector('[data-testid="help-report-github"]', { timeout: 10000 });
		await dashboard.click('[data-testid="help-report-github"]');
		await dashboard.waitForTimeout(2000);
		const pickerVisible = await dashboard
			.getByText("Open with…")
			.isVisible()
			.catch(() => false);
		// Is the picker in the DOM at all, and what covers its center point?
		const occlusion = await dashboard.evaluate(() => {
			const all = Array.from(document.querySelectorAll("*"));
			const el = all.find((n) => n.textContent === "Open with…" && n.children.length === 0);
			if (!el) return "picker-not-in-dom";
			const r = el.getBoundingClientRect();
			const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
			return `rect=${JSON.stringify(r)} topElement=${top?.className ?? top?.tagName ?? "?"} containsTitle=${el.contains(top) || top?.contains(el) || el === top}`;
		});
		await s.shot(dashboard, "00-no-state-click");
		console.log(`PROBE scenario0 picker-visible=${pickerVisible} occlusion=${occlusion}`);
		s.note(`scenario0 picker-visible=${pickerVisible} occlusion=${occlusion}`);
		await dashboard.keyboard.press("Escape");
		await dashboard.waitForTimeout(500);
		await dashboard.keyboard.press("Escape");
		await dashboard.waitForTimeout(500);

		// Remembered default: https → in-vault Browser.
		await dashboard.evaluate(async () => {
			const bs = (window as unknown as DashboardBridge).brainstorm;
			await bs.dashboard.setDefaultHandler("open", "scheme:https", "io.brainstorm.browser");
		});

		await dashboard.getByRole("button", { name: /help/i }).first().click();
		await dashboard.waitForSelector('[data-testid="help-report-github"]', { timeout: 10000 });
		await s.shot(dashboard, "01-help-open");

		await dashboard.click('[data-testid="help-report-github"]');
		await dashboard.waitForTimeout(4500);
		await s.shot(dashboard, "02-dashboard-after-click");
		await s.shot(browserPage, "03-browser-after-click");

		const browserPages = s.appPagesFor(APP.Browser);
		const states: string[] = [];
		for (const p of browserPages) {
			const st = await p
				.evaluate(() => {
					const omni = document.querySelector<HTMLInputElement>("input");
					return `omnibox=${omni?.value ?? "?"} title=${document.title}`;
				})
				.catch((e) => `ERR ${String(e)}`);
			states.push(st);
		}
		const ext = await app.evaluate(
			() => (globalThis as unknown as { __ext?: string[] }).__ext ?? [],
		);
		const toast = await dashboard
			.locator(".toast, [class*='toast']")
			.allTextContents()
			.catch(() => []);
		console.log(
			`PROBE result browser-pages=${browserPages.length} states=${JSON.stringify(states)} externally=${JSON.stringify(ext)} toasts=${JSON.stringify(toast)}`,
		);
		s.note(
			`after click: browser-pages=${browserPages.length} states=${JSON.stringify(states)} externally=${JSON.stringify(ext)} toasts=${JSON.stringify(toast)}`,
		);
	} finally {
		// Leave Northbound as found: clear the probe's pin.
		await dashboard
			.evaluate(async () => {
				const bs = (window as unknown as DashboardBridge).brainstorm;
				await bs.dashboard.setDefaultHandler("open", "scheme:https", null);
			})
			.catch(() => {});
		await s.finish();
	}
});
