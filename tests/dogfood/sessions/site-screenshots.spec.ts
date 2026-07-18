/**
 * Marketing-site screenshot capture (not a dogfood session).
 *
 * Boots the production-built shell against a FRESH, throwaway user-data dir,
 * seeds a believable REAL-WORLD studio workspace (clients, projects, people,
 * notes, tasks, events), applies the pass's theme + wallpaper, then captures
 * clean shots of the desktop and key apps for getbrainstorm.online.
 *
 * Two passes, selected via SITE_SHOT_PASS:
 *   light (default) — Default Light theme + green-valley wallpaper → raw/
 *   dark            — Midnight theme + stormy-sea wallpaper → raw/midnight/
 *
 * Output: PNGs into <harness>/site/public/screenshots/raw[/midnight]/ at CSS scale.
 *
 * Run:  BRAINSTORM_DOGFOOD_SKIP_BUILD=1 SITE_SHOT_PASS=light bun run dogfood tests/dogfood/sessions/site-screenshots.spec.ts
 */

import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Page, _electron, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SHELL_DIR = process.env.BRAINSTORM_SHELL_DIR ?? join(REPO_ROOT, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

const DATA_DIR = join(REPO_ROOT, "tests", "dogfood", ".screenshots-data");
const VAULT_DIR = join(DATA_DIR, "vault");

const PASS =
	process.env.SITE_SHOT_PASS === "dark"
		? {
				name: "dark",
				mode: "dark",
				theme: "midnight",
				wallpaper: "stormy-sea.png",
				sub: "midnight",
			}
		: {
				name: "light",
				mode: "light",
				theme: "default-light",
				wallpaper: "green-valley.png",
				sub: "",
			};
const WALLPAPER_SRC = join(REPO_ROOT, "docs", "art", "wallpaper", PASS.wallpaper);
const OUT_DIR = join(REPO_ROOT, "site", "public", "screenshots", "raw", PASS.sub);

const APP = {
	Notes: "io.brainstorm.notes",
	Database: "io.brainstorm.database",
	Tasks: "io.brainstorm.tasks",
	Calendar: "io.brainstorm.calendar",
	Graph: "io.brainstorm.graph",
	Contacts: "io.brainstorm.contacts",
	Agent: "io.brainstorm.agent",
	ThemeEditor: "io.brainstorm.theme-editor",
	Whiteboard: "io.brainstorm.whiteboard",
	Bookmarks: "io.brainstorm.bookmarks",
	Journal: "io.brainstorm.journal",
} as const;
type AppId = (typeof APP)[keyof typeof APP];

const TAB_STRIP = "/chrome/tab-strip";
const DASHBOARD = "/renderer/index.html";

type BW = {
	brainstorm: {
		vaults: {
			list: () => Promise<Array<{ id: string }>>;
			create: (o: { name: string; path: string }) => Promise<unknown>;
			activate: (id: string) => Promise<unknown>;
			session: () => Promise<unknown>;
		};
		dev: {
			seedPrebuiltApps: () => Promise<unknown>;
			seedMarketingEntities: () => Promise<unknown>;
		};
		dashboard: {
			setTheme: (theme: string) => Promise<void>;
			setAppearanceMode: (mode: string) => Promise<void>;
			setWallpaper: (w: { kind: string; value: string }, slot?: string) => Promise<void>;
		};
		apps: { launch: (id: string) => Promise<void> };
	};
};

let shotN = 0;
async function shot(page: Page, label: string): Promise<void> {
	shotN += 1;
	const file = join(OUT_DIR, `${String(shotN).padStart(2, "0")}-${label}.png`);
	try {
		await page.screenshot({ path: file, scale: "css" });
	} catch (e) {
		console.warn(`shot ${label} skipped: ${(e as Error).message}`);
	}
}

test("capture marketing screenshots", async () => {
	test.setTimeout(900_000);
	rmSync(DATA_DIR, { recursive: true, force: true });
	mkdirSync(DATA_DIR, { recursive: true });
	mkdirSync(OUT_DIR, { recursive: true });

	const app: ElectronApplication = await _electron.launch({
		executablePath: ELECTRON_BIN,
		args: [MAIN_ENTRY, `--user-data-dir=${DATA_DIR}`],
		cwd: SHELL_DIR,
		timeout: 120_000,
		env: {
			...process.env,
			BRAINSTORM_DEV_INSECURE_CREDENTIALS: "1",
			BRAINSTORM_NO_FOCUS: "1",
			// Don't auto-seed the plan projection — we seed our own real-world set.
			BRAINSTORM_AUTO_SEED: "0",
			// Larger app windows for the marketing shots (product default stays 1100×720).
			BRAINSTORM_APP_WINDOW_WIDTH: "1440",
			BRAINSTORM_APP_WINDOW_HEIGHT: "900",
			NODE_ENV: "production",
		},
	});

	const dashboard = await app.firstWindow({ timeout: 60_000 });
	dashboard.on("console", (m) => {
		if (m.type() === "error") console.log(`[dash:err] ${m.text()}`);
	});

	// Maximise every open window so the shots show the app at full size. The
	// app/container windows are fixed-size, so force their content box too.
	const maximizeAll = () =>
		app
			.evaluate(({ BrowserWindow }) => {
				for (const w of BrowserWindow.getAllWindows()) {
					try {
						w.setMinimumSize(480, 360);
						w.setContentSize(1440, 900);
						w.maximize();
					} catch {
						// best-effort
					}
				}
			})
			.catch(() => undefined);

	// Create vault + install apps.
	await dashboard.evaluate(async (dataDir) => {
		const bs = (window as unknown as BW).brainstorm;
		const list = await bs.vaults.list();
		let session = await bs.vaults.session();
		if (list.length === 0) {
			await bs.vaults.create({ name: "Northbound Studio", path: `${dataDir}/vault` });
			session = await bs.vaults.session();
		} else if (!session && list[0]) {
			await bs.vaults.activate(list[0].id);
			session = await bs.vaults.session();
		}
		await bs.dev.seedPrebuiltApps();
		await bs.dev.seedMarketingEntities();
	}, DATA_DIR);

	// Drop the pass's wallpaper into the vault's wallpaper store, then apply
	// the pass's theme + wallpaper to its appearance slot.
	mkdirSync(join(VAULT_DIR, "dashboard", "wallpapers"), { recursive: true });
	copyFileSync(WALLPAPER_SRC, join(VAULT_DIR, "dashboard", "wallpapers", PASS.wallpaper));
	await dashboard.evaluate(
		async ({ mode, theme, wallpaper }) => {
			const bs = (window as unknown as BW).brainstorm;
			await bs.dashboard.setAppearanceMode(mode);
			await bs.dashboard.setTheme(theme);
			await bs.dashboard.setWallpaper({ kind: "image", value: wallpaper }, mode);
		},
		{ mode: PASS.mode, theme: PASS.theme, wallpaper: PASS.wallpaper },
	);

	await dashboard.waitForTimeout(6000);
	// Dismiss the first-launch "What's new" modal for a clean desktop shot.
	for (const label of ["Got it", "Close", "Done"]) {
		const btn = dashboard.getByRole("button", { name: label }).first();
		if (await btn.count().catch(() => 0)) {
			await btn.click({ timeout: 2000 }).catch(() => undefined);
			await dashboard.waitForTimeout(500);
		}
	}
	await dashboard.keyboard.press("Escape").catch(() => undefined);
	// Dev-only header chrome (seed/reseed buttons) shows on any unpackaged
	// launch — hide it so the shots match what a packaged build renders.
	await dashboard
		.addStyleTag({ content: ".dashboard__dev-seed{display:none!important}" })
		.catch(() => undefined);
	await maximizeAll();
	await dashboard.waitForTimeout(1500);
	await shot(dashboard, "desktop");

	const isAppPage = (p: Page, id: AppId) =>
		p.url().includes(`/${id}/`) && !p.url().includes(TAB_STRIP) && !p.url().includes(DASHBOARD);

	const openApp = async (id: AppId): Promise<Page> => {
		await dashboard.evaluate((a) => (window as unknown as BW).brainstorm.apps.launch(a), id);
		const deadline = Date.now() + 25_000;
		while (Date.now() < deadline) {
			const hit = app.windows().find((p) => isAppPage(p, id));
			if (hit) return hit;
			await app.waitForEvent("window", { timeout: 1_000 }).catch(() => undefined);
		}
		throw new Error(`no app page for ${id}`);
	};

	const captures: Array<[AppId, string, (p: Page) => Promise<void>]> = [
		[
			APP.Database,
			"database",
			async (p) => {
				await p.waitForTimeout(3000);
				// The Tasks list (board) is clean: Status/Priority pills populated,
				// task icons, no mixed-type noise (the all-vault grid pulls in chat
				// messages with raw ISO timestamps + an icon column).
				const tasks = p.getByText("Tasks", { exact: true }).first();
				if (await tasks.count().catch(() => 0)) {
					await tasks.click().catch(() => undefined);
					await p.waitForTimeout(1800);
				}
			},
		],
		[
			APP.Notes,
			"notes",
			async (p) => {
				await p.waitForTimeout(2500);
				// Open the note that carries an embedded bookmark card.
				const embed = p.getByText("Reading — Designing for trust").first();
				if (await embed.count().catch(() => 0)) {
					await embed.click().catch(() => undefined);
					await p.waitForTimeout(1500);
				}
			},
		],
		[APP.Tasks, "tasks", async (p) => void (await p.waitForTimeout(3000))],
		[APP.Calendar, "calendar", async (p) => void (await p.waitForTimeout(3000))],
		[
			APP.Contacts,
			"contacts",
			async (p) => {
				await p.waitForTimeout(2500);
				// Select a person so the detail panel isn't the empty state.
				const person = p.getByText("Daniel Ortiz").first();
				if (await person.count().catch(() => 0)) {
					await person.click().catch(() => undefined);
					await p.waitForTimeout(1500);
				}
			},
		],
		[
			APP.Graph,
			"graph",
			async (p) => {
				await p.waitForTimeout(4000);
				// Zoom in a few steps so the nodes read bigger in the shot.
				const canvas = p.locator("canvas").first();
				const box = await canvas.boundingBox().catch(() => null);
				if (box) {
					const cx = box.x + box.width / 2;
					const cy = box.y + box.height / 2;
					// One gentle step — just enough that nodes read, not max zoom.
					await p.mouse.move(cx, cy);
					await p.mouse.wheel(0, -200).catch(() => undefined);
					await p.waitForTimeout(400);
				}
				await p.waitForTimeout(800);
			},
		],
		[APP.Whiteboard, "whiteboard", async (p) => void (await p.waitForTimeout(3500))],
		[APP.Bookmarks, "bookmarks", async (p) => void (await p.waitForTimeout(3000))],
		[
			APP.Journal,
			"journal",
			async (p) => {
				await p.waitForTimeout(2800);
				// Open a real seeded entry (today defaults to the empty welcome).
				const entry = p.getByText("Three brand directions", { exact: false }).first();
				if (await entry.count().catch(() => 0)) {
					await entry.click().catch(() => undefined);
					await p.waitForTimeout(1500);
				}
			},
		],
		[
			APP.Agent,
			"agent",
			async (p) => {
				await p.waitForTimeout(2500);
				// Open the thread that has a transcript (the app may default to another).
				const conv = p.getByText("Tighten the Harbor brief").first();
				if (await conv.count().catch(() => 0)) {
					await conv.click().catch(() => undefined);
					await p.waitForTimeout(2000);
				}
			},
		],
	];

	for (const [id, label, prep] of captures) {
		let page: Page | null = null;
		try {
			page = await openApp(id);
			await maximizeAll();
			await page.waitForTimeout(700);
			await prep(page);
			await shot(page, label);
		} catch (e) {
			console.warn(`capture ${label} failed: ${(e as Error).message}`);
		}
		await page?.close().catch(() => undefined);
		await dashboard.waitForTimeout(500);
	}

	await app.close().catch(() => undefined);
});
