/**
 * Shared capture stage for the promo / app-showcase rigs — launches the shell
 * in production mode against a fresh synthetic vault, sizes every window to a
 * fixed 16:9 stage, and hands back the recorder + the scene/film/openApp
 * machinery the scene drivers call.
 *
 * Windows are HIDDEN by default (`shell-launch-env.ts`) — the rig films the
 * pages over CDP, so nothing needs to be on the developer's display. The
 * `PROMO_CAPTURE=ffmpeg` display backend is the exception: it films the screen,
 * so it puts the windows back on it and tiles them into the capture rect.
 *
 * Extracted from `promo/promo.spec.ts` so a second rig (the per-app VID-*
 * highlight reels) reuses the exact stage rather than re-deriving it. The 60s
 * promo still inlines its own copy for now and should migrate onto this stage
 * next time it's touched — this lib is the go-forward shared harness.
 *
 * Footage source is ALWAYS the synthetic `seedMarketingEntities` world
 * ("Northbound Studio"), never the live dogfood vault nor a clone of it (owner
 * rule 2026-07-19). The default backend is the permission-free CDP screencast
 * (films only the driven windows) — see `lib/recorder.ts`.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type ElectronApplication, type Page, _electron } from "@playwright/test";
import { type PromoRecorder, ScreencastRecorder, makePromoRecorder } from "./recorder";
import { beat } from "./humanize";
import { shellLaunchEnv, visibleWindowsRequested } from "./shell-launch-env";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const SHELL_DIR = join(HARNESS, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

const TAB_STRIP = "/chrome/tab-strip";
const DASHBOARD = "/renderer/index.html";

/** Logical-px 16:9 stage on the primary display (captured ×2 Retina → 1080p). */
export type Stage = { x: number; y: number; width: number; height: number };
export const DEFAULT_STAGE: Stage = { x: 0, y: 40, width: 1440, height: 810 };

/** The dev bridge exposed on the dashboard window in insecure-dev mode. */
type Bridge = {
	brainstorm: {
		vaults: {
			session(): Promise<unknown>;
			create(input: { name: string; path: string }): Promise<{ id?: unknown }>;
			activate(id: string): Promise<unknown>;
		};
		apps: { launch(id: string): Promise<unknown> };
		dev: {
			seedPrebuiltApps(): Promise<unknown>;
			seedMarketingEntities(): Promise<unknown>;
		};
	};
};

export type PromoStage = {
	app: ElectronApplication;
	dashboard: Page;
	recorder: PromoRecorder;
	stage: Stage;
	/** Point the recorder (and the synthetic cursor) at the surface on camera. */
	film(page: Page): Promise<void>;
	/** Launch an app by id and return its window, sized to exactly 16:9. */
	openApp(id: string): Promise<Page>;
	/** Close every app window, leaving the dashboard. */
	closeAppWindows(): Promise<void>;
	/** Record one scene; a driver throw logs but never kills the run. */
	scene(name: string, drive: () => Promise<void>): Promise<void>;
	tileAllWindows(): Promise<void>;
	/** Create + activate a fresh vault off camera (bridge, no UI). */
	createVault(name: string, vaultPath: string): Promise<void>;
	/** Wait for an active vault session (post vault-create, sync or on camera). */
	waitForSession(): Promise<void>;
	/** Off camera: seed prebuilt apps + the Northbound marketing world, dismiss
	 *  first-run dialogs, and hide the dev-seed affordance. */
	seedMarketing(): Promise<void>;
	finish(): Promise<void>;
};

export async function launchPromoStage(opts: {
	dataDir: string;
	clipsDir: string;
	stage?: Stage;
}): Promise<PromoStage> {
	const stage = opts.stage ?? DEFAULT_STAGE;
	rmSync(opts.dataDir, { recursive: true, force: true });
	mkdirSync(opts.dataDir, { recursive: true });
	mkdirSync(opts.clipsDir, { recursive: true });

	const app = await _electron.launch({
		executablePath: ELECTRON_BIN,
		args: [MAIN_ENTRY, `--user-data-dir=${opts.dataDir}`],
		cwd: SHELL_DIR,
		timeout: 120_000,
		env: shellLaunchEnv({
			BRAINSTORM_APP_WINDOW_WIDTH: String(stage.width),
			BRAINSTORM_APP_WINDOW_HEIGHT: String(stage.height),
		}),
	});

	const dashboard = await app.firstWindow({ timeout: 60_000 });
	await dashboard.waitForTimeout(2500);

	// Hidden runs size the windows but never place them: there is no display to
	// place them on, and the CDP screencast reads from the page anyway. Only the
	// ffmpeg display backend needs the windows tiled into its capture rect.
	const place = visibleWindowsRequested();
	const tileAllWindows = async (): Promise<void> => {
		await app
			.evaluate(({ BrowserWindow }, s) => {
				for (const w of BrowserWindow.getAllWindows()) {
					try {
						w.setMinimumSize(480, 360);
						if (s.place) w.setPosition(s.x, s.y);
						w.setContentSize(s.width, s.height);
					} catch {
						// best-effort
					}
				}
			}, { ...stage, place })
			.catch(() => undefined);
	};
	await tileAllWindows();

	const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor);
	const recorder = makePromoRecorder(opts.clipsDir, { ...stage, scale });

	const ensureCursor = async (page: Page): Promise<void> => {
		if (!(recorder instanceof ScreencastRecorder)) return;
		await page
			.evaluate(() => {
				if (document.getElementById("__promo-cursor")) return;
				const el = document.createElement("div");
				el.id = "__promo-cursor";
				el.style.cssText =
					"position:fixed;z-index:2147483647;width:17px;height:24px;pointer-events:none;" +
					"left:-60px;top:-60px;transform-origin:2px 2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))";
				el.innerHTML =
					'<svg width="17" height="24" viewBox="0 0 17 24" xmlns="http://www.w3.org/2000/svg">' +
					'<path d="M1 1 L1 18.6 L5.3 14.8 L8 21.5 L11.2 20.2 L8.5 13.7 L14.2 13.7 Z" ' +
					'fill="black" stroke="white" stroke-width="1.4" stroke-linejoin="round"/></svg>';
				document.documentElement.appendChild(el);
				window.addEventListener(
					"mousemove",
					(e) => {
						el.style.left = `${e.clientX - 1}px`;
						el.style.top = `${e.clientY - 1}px`;
					},
					true,
				);
				window.addEventListener("mousedown", () => {
					el.style.transform = "scale(0.82)";
				}, true);
				window.addEventListener("mouseup", () => {
					el.style.transform = "scale(1)";
				}, true);
			})
			.catch(() => undefined);
	};

	const film = async (page: Page): Promise<void> => {
		await ensureCursor(page);
		await recorder.film(page);
	};

	const isAppPage = (p: Page, id: string) =>
		p.url().includes(`/${id}/`) && !p.url().includes(TAB_STRIP) && !p.url().includes(DASHBOARD);

	const openApp = async (id: string): Promise<Page> => {
		await dashboard.evaluate(async (appId) => {
			await (window as unknown as Bridge).brainstorm.apps.launch(appId);
		}, id);
		const deadline = Date.now() + 30_000;
		while (Date.now() < deadline) {
			const page = app.windows().find((p) => isAppPage(p, id));
			if (page) {
				await page.waitForLoadState("domcontentloaded").catch(() => undefined);
				await tileAllWindows();
				await page.waitForTimeout(600);
				const inner = await page
					.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
					.catch(() => null);
				const dh = inner ? stage.height - inner.h : 0;
				if (dh > 0) {
					await app
						.evaluate(({ BrowserWindow }, arg) => {
							for (const w of BrowserWindow.getAllWindows()) {
								try {
									if (!w.webContents.getURL().includes("/renderer/index.html")) {
										w.setContentSize(arg.w, arg.h + arg.dh);
									}
								} catch {
									// best-effort
								}
							}
						}, { w: stage.width, h: stage.height, dh })
						.catch(() => undefined);
				}
				await page.waitForTimeout(1200);
				return page;
			}
			await dashboard.waitForTimeout(250);
		}
		throw new Error(`promo-stage: app window for ${id} never appeared`);
	};

	const closeAppWindows = async (): Promise<void> => {
		await app
			.evaluate(({ BrowserWindow }) => {
				for (const w of BrowserWindow.getAllWindows()) {
					try {
						if (!w.webContents.getURL().includes("/renderer/index.html")) w.close();
					} catch {
						// best-effort
					}
				}
			})
			.catch(() => undefined);
		await dashboard.waitForTimeout(800);
	};

	const scene = async (name: string, drive: () => Promise<void>): Promise<void> => {
		await recorder.start(name);
		try {
			await drive();
		} catch (error) {
			console.warn(`[promo-stage] scene ${name} driver degraded: ${String(error)}`);
			await beat(dashboard, 2500);
		}
		await recorder.stop();
	};

	const createVault = async (name: string, vaultPath: string): Promise<void> => {
		await dashboard.evaluate(
			async ({ vName, vPath }) => {
				const bs = (window as unknown as Bridge).brainstorm;
				const created = await bs.vaults.create({ name: vName, path: vPath });
				if (created?.id) await bs.vaults.activate(String(created.id));
			},
			{ vName: name, vPath: vaultPath },
		);
	};

	const waitForSession = async (): Promise<void> => {
		await dashboard.waitForFunction(
			async () => (await (window as unknown as Bridge).brainstorm.vaults.session()) !== null,
			undefined,
			{ timeout: 90_000, polling: 500 },
		);
	};

	const seedMarketing = async (): Promise<void> => {
		await dashboard.evaluate(async () => {
			const bs = (window as unknown as Bridge).brainstorm;
			await bs.dev.seedPrebuiltApps();
			await bs.dev.seedMarketingEntities();
		});
		await dashboard.waitForTimeout(4000);
		for (const label of ["Got it", "Close", "Done"]) {
			const btn = dashboard.getByRole("button", { name: label }).first();
			if (await btn.count().catch(() => 0)) {
				await btn.click({ timeout: 2000 }).catch(() => undefined);
			}
		}
		await dashboard.keyboard.press("Escape").catch(() => undefined);
		await dashboard
			.addStyleTag({ content: ".dashboard__dev-seed{display:none!important}" })
			.catch(() => undefined);
		await tileAllWindows();
		await dashboard.waitForTimeout(1000);
	};

	const finish = async (): Promise<void> => {
		await recorder.stop().catch(() => undefined);
		await app.close().catch(() => undefined);
	};

	return {
		app,
		dashboard,
		recorder,
		stage,
		film,
		openApp,
		closeAppWindows,
		scene,
		tileAllWindows,
		createVault,
		waitForSession,
		seedMarketing,
		finish,
	};
}
