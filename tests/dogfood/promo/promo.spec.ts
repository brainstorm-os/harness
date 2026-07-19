/**
 * Promo capture rig — drives the 8 storyboard scenes of the 60s promo
 * (docs/marketing/promo-60s.md) against a FRESH synthetic vault seeded by
 * `seedMarketingEntities` ("Northbound Studio" — clients, projects, people,
 * tasks, events, notes, journal, whiteboard) and records one clip per scene.
 *
 * The synthetic seed is the ONLY footage source — never the live dogfood
 * vault nor any backup clone of it (owner rule 2026-07-19: real-vault clones
 * carry personal imports and must not be filmed). The vault is wiped and
 * re-seeded every run, so takes are clean and repeatable.
 *
 * Runs FOCUSED when the ffmpeg backend is active (real cursor on camera) —
 * the machine must be unattended while this runs.
 *
 * Scene drivers are deliberately defensive: every fancy interaction (a drag,
 * a view flip) is wrapped so a selector drifting with the product never
 * kills the run — the scene still records real footage of the open surface,
 * and the render stays producible. Failures are logged for polish passes.
 */

import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	type ElectronApplication,
	type Page,
	_electron,
	test,
} from "@playwright/test";
import { beat, glideClick, glideDrag, glideTo, typeHuman } from "../lib/humanize";
import { ScreencastRecorder, makePromoRecorder } from "../lib/recorder";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const SHELL_DIR = join(HARNESS, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");
const PROMO_DATA = join(HARNESS, "tests", "dogfood", ".promo-data");
const CLIPS_DIR = join(HARNESS, "tests", "dogfood", ".promo", "clips");
const WALLPAPER = "stormy-sea.png";
const WALLPAPER_SRC = join(HARNESS, "docs", "art", "wallpaper", WALLPAPER);

/** 16:9 stage in logical px; captured ×2 Retina → 2880×1620 → 1080p. */
const STAGE = { x: 0, y: 40, width: 1440, height: 810 };

const TAB_STRIP = "/chrome/tab-strip";
const DASHBOARD = "/renderer/index.html";

type BW = {
	brainstorm: {
		vaults: {
			list(): Promise<{ id: string }[]>;
			session(): Promise<unknown>;
			create(input: { name: string; path: string }): Promise<unknown>;
			activate(id: string): Promise<unknown>;
		};
		apps: { launch(id: string): Promise<unknown> };
		dev: {
			seedPrebuiltApps(): Promise<unknown>;
			seedMarketingEntities(): Promise<unknown>;
		};
		dashboard: {
			setAppearanceMode(mode: string): Promise<void>;
			setTheme(theme: string): Promise<void>;
			setWallpaper(wallpaper: { kind: string; value: string }, slot?: string): Promise<void>;
		};
	};
};

async function tileAllWindows(app: ElectronApplication): Promise<void> {
	await app
		.evaluate(({ BrowserWindow }, stage) => {
			for (const w of BrowserWindow.getAllWindows()) {
				try {
					w.setMinimumSize(480, 360);
					w.setPosition(stage.x, stage.y);
					w.setContentSize(stage.width, stage.height);
				} catch {
					// best-effort
				}
			}
		}, STAGE)
		.catch(() => undefined);
}

test("capture promo scenes", async () => {
	test.setTimeout(1_200_000);
	// Fresh synthetic vault every take — no real-vault data, clean repeats.
	rmSync(PROMO_DATA, { recursive: true, force: true });
	mkdirSync(PROMO_DATA, { recursive: true });
	mkdirSync(CLIPS_DIR, { recursive: true });

	const app = await _electron.launch({
		executablePath: ELECTRON_BIN,
		args: [MAIN_ENTRY, `--user-data-dir=${PROMO_DATA}`],
		cwd: SHELL_DIR,
		timeout: 120_000,
		env: {
			...process.env,
			BRAINSTORM_DEV_INSECURE_CREDENTIALS: "1",
			BRAINSTORM_AUTO_SEED: "0",
			BRAINSTORM_APP_WINDOW_WIDTH: String(STAGE.width),
			BRAINSTORM_APP_WINDOW_HEIGHT: String(STAGE.height),
			// Screencast films the window without OS focus — don't steal the
			// operator's focus while the rig runs. The ffmpeg display backend
			// (explicit opt-in) needs focus; drop this only for that mode.
			...(process.env.PROMO_CAPTURE === "ffmpeg" ? {} : { BRAINSTORM_NO_FOCUS: "1" }),
			NODE_ENV: "production",
		},
	});

	const dashboard = await app.firstWindow({ timeout: 60_000 });
	await dashboard.evaluate(async (dataDir) => {
		const bs = (window as unknown as BW).brainstorm;
		if (!(await bs.vaults.session())) {
			await bs.vaults.create({ name: "Northbound Studio", path: `${dataDir}/vault` });
		}
		await bs.dev.seedPrebuiltApps();
		await bs.dev.seedMarketingEntities();
	}, PROMO_DATA);
	// Promo look: dark Midnight + the stormy-sea wallpaper (matches the
	// title card's dark ground).
	mkdirSync(join(PROMO_DATA, "vault", "dashboard", "wallpapers"), { recursive: true });
	copyFileSync(WALLPAPER_SRC, join(PROMO_DATA, "vault", "dashboard", "wallpapers", WALLPAPER));
	await dashboard.evaluate(async (wallpaper) => {
		const bs = (window as unknown as BW).brainstorm;
		await bs.dashboard.setAppearanceMode("dark");
		await bs.dashboard.setTheme("default-dark");
		await bs.dashboard.setWallpaper({ kind: "image", value: wallpaper }, "dark");
	}, WALLPAPER);
	await dashboard.waitForTimeout(5000);
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
	await tileAllWindows(app);
	await dashboard.waitForTimeout(1500);

	const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor);
	const recorder = makePromoRecorder(CLIPS_DIR, { ...STAGE, scale });

	/** Screencast frames carry no OS cursor — overlay a synthetic one that
	 *  follows the driven mouse so glides/clicks read on camera. */
	const ensureCursor = async (page: Page): Promise<void> => {
		if (!(recorder instanceof ScreencastRecorder)) return;
		await page
			.evaluate(() => {
				if (document.getElementById("__promo-cursor")) return;
				const dot = document.createElement("div");
				dot.id = "__promo-cursor";
				dot.style.cssText =
					"position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;" +
					"background:rgba(255,255,255,.9);border:2px solid rgba(20,20,20,.65);" +
					"box-shadow:0 1px 6px rgba(0,0,0,.45);pointer-events:none;left:-60px;top:-60px";
				document.documentElement.appendChild(dot);
				window.addEventListener(
					"mousemove",
					(e) => {
						dot.style.left = `${e.clientX - 11}px`;
						dot.style.top = `${e.clientY - 11}px`;
					},
					true,
				);
			})
			.catch(() => undefined);
	};

	/** Point the recorder at the surface currently on camera. */
	const film = async (page: Page): Promise<void> => {
		await ensureCursor(page);
		await recorder.film(page);
	};

	const isAppPage = (p: Page, id: string) =>
		p.url().includes(`/${id}/`) && !p.url().includes(TAB_STRIP) && !p.url().includes(DASHBOARD);

	const openApp = async (id: string): Promise<Page> => {
		await dashboard.evaluate(async (appId) => {
			await (window as unknown as BW).brainstorm.apps.launch(appId);
		}, id);
		const deadline = Date.now() + 30_000;
		while (Date.now() < deadline) {
			const page = app.windows().find((p) => isAppPage(p, id));
			if (page) {
				await page.waitForLoadState("domcontentloaded").catch(() => undefined);
				await tileAllWindows(app);
				await page.waitForTimeout(1800);
				return page;
			}
			await dashboard.waitForTimeout(250);
		}
		throw new Error(`promo: app window for ${id} never appeared`);
	};

	const closeAppWindows = async (): Promise<void> => {
		await app
			.evaluate(({ BrowserWindow }) => {
				const all = BrowserWindow.getAllWindows();
				for (const w of all) {
					// Keep the dashboard (first-created) window.
					if (all.indexOf(w) > 0) w.close();
				}
			})
			.catch(() => undefined);
		await dashboard.waitForTimeout(800);
	};

	/** Record one scene; driver failures log but never kill the run. */
	const scene = async (name: string, drive: () => Promise<void>): Promise<void> => {
		await recorder.start(name);
		try {
			await drive();
		} catch (error) {
			console.warn(`[promo] scene ${name} driver degraded: ${String(error)}`);
			await beat(dashboard, 2500);
		}
		await recorder.stop();
	};

	// ── S1: dashboard reveal ────────────────────────────────────────────────
	await scene("01-dashboard", async () => {
		await film(dashboard);
		await glideTo(dashboard, 300, 500, 700);
		await beat(dashboard, 700);
		await glideTo(dashboard, 1100, 420, 1100);
		await beat(dashboard, 800);
	});

	// ── S2: Notes — open the HQ hub and WRITE into it ──────────────────────
	await scene("02-notes", async () => {
		const notes = await openApp("io.brainstorm.notes");
		await film(notes);
		const doc = notes
			.locator(".notes__sidebar-item")
			.filter({ hasText: /Harbor|Reading|Meridian|Atlas/i })
			.first();
		if (await doc.count().catch(() => 0)) {
			await glideClick(notes, doc).catch(() => undefined);
			await beat(notes, 800);
		}
		const editor = notes.locator('[contenteditable="true"]').first();
		if (await editor.count().catch(() => 0)) {
			await editor.click().catch(() => undefined);
			await notes.keyboard.press("Meta+ArrowDown").catch(() => undefined);
			await notes.keyboard.press("Enter").catch(() => undefined);
			await typeHuman(notes, "Harbor sign-off booked for Thursday — bring direction two. ");
			await typeHuman(notes, "Meridian kickoff notes are in.");
		}
		// Properties panel open — show structured data living on the doc.
		const props = notes.locator('[aria-controls="notes-props"]').first();
		if (await props.count().catch(() => 0)) {
			await glideClick(notes, props).catch(() => undefined);
			await beat(notes, 900);
		}
	});

	// ── S3: Database — Clients board: DRAG a deal + flip the view ──────────
	await scene("03-database", async () => {
		await closeAppWindows();
		const db = await openApp("io.brainstorm.database");
		await film(db);
		const collection = db
			.locator(".db-sidebar__list-item")
			.filter({ hasText: /project|client|task/i })
			.first();
		if (await collection.count().catch(() => 0)) {
			await glideClick(db, collection).catch(() => undefined);
			await beat(db, 700);
		}
		const boardTab = db.locator("#view-tabs .db-tab").filter({ hasText: /board/i }).first();
		if (await boardTab.count().catch(() => 0)) {
			await glideClick(db, boardTab).catch(() => undefined);
			await beat(db, 700);
		}
		const card = db.locator(".dbv-board__card").first();
		const targetCol = db.locator(".dbv-board__column").nth(2);
		if ((await card.count().catch(() => 0)) && (await targetCol.count().catch(() => 0))) {
			await glideDrag(db, card, targetCol, 1000).catch(() => undefined);
			await beat(db, 600);
		}
		for (const label of [/calendar/i, /timeline/i, /gallery/i]) {
			const tab = db.locator("#view-tabs .db-tab").filter({ hasText: label }).first();
			if (await tab.count().catch(() => 0)) {
				await glideClick(db, tab).catch(() => undefined);
				await beat(db, 900);
				break;
			}
		}
	});

	// ── S4: Graph pan/zoom → Whiteboard beat ───────────────────────────────
	await scene("04-graph-whiteboard", async () => {
		await closeAppWindows();
		const graph = await openApp("io.brainstorm.graph");
		await film(graph);
		await glideTo(graph, 720, 420, 400);
		await graph.mouse.down();
		await glideTo(graph, 500, 300, 900);
		await graph.mouse.up();
		await graph.mouse.wheel(0, -400);
		await beat(graph, 800);
		await closeAppWindows();
		const wb = await openApp("io.brainstorm.whiteboard");
		await film(wb);
		await glideTo(wb, 600, 400, 400);
		await wb.mouse.down();
		await glideTo(wb, 900, 520, 800);
		await wb.mouse.up();
		await beat(wb, 900);
	});

	// ── S5: Tasks (CREATE one) → Calendar (NEW event) → Mailbox ────────────
	await scene("05-operate", async () => {
		await closeAppWindows();
		const tasks = await openApp("io.brainstorm.tasks");
		await film(tasks);
		const newTask = tasks.locator(".tasks-header__action").first();
		if (await newTask.count().catch(() => 0)) {
			await glideClick(tasks, newTask).catch(() => undefined);
			const input = tasks.locator(".tasks-compose__input").first();
			if (await input.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) {
				await input.click().catch(() => undefined);
				await typeHuman(tasks, "Send Vertex proposal");
				await tasks.keyboard.press("Enter").catch(() => undefined);
				await beat(tasks, 700);
				await tasks.keyboard.press("Escape").catch(() => undefined);
			}
		}
		await closeAppWindows();
		const cal = await openApp("io.brainstorm.calendar");
		await film(cal);
		const newEvent = cal.locator(".cal-toolbar__new").first();
		if (await newEvent.count().catch(() => 0)) {
			await glideClick(cal, newEvent).catch(() => undefined);
			await beat(cal, 500);
			const titleInput = cal.locator("input:focus, input[placeholder]").first();
			if (await titleInput.count().catch(() => 0)) {
				await typeHuman(cal, "Issue #8 planning");
				await cal.keyboard.press("Enter").catch(() => undefined);
			}
			await beat(cal, 600);
			await cal.keyboard.press("Escape").catch(() => undefined);
		}
		await closeAppWindows();
		// Fresh synthetic vault has no mail account — the Journal's seeded
		// daily entries are the "operation log" beat instead.
		const journal = await openApp("io.brainstorm.journal");
		await film(journal);
		await beat(journal, 1500);
	});

	// ── S6: team — the Chat surface (split-screen collab is the upgrade) ───
	await scene("06-team", async () => {
		await closeAppWindows();
		const chat = await openApp("io.brainstorm.chat");
		await film(chat);
		// Fresh vault: CREATE the team channel on camera, then post into it.
		const newChannel = chat.locator('[aria-label="New channel"]').first();
		if (await newChannel.count().catch(() => 0)) {
			await glideClick(chat, newChannel).catch(() => undefined);
			const nameInput = chat.locator(".bs-input").first();
			if (await nameInput.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) {
				await nameInput.click().catch(() => undefined);
				await typeHuman(chat, "studio");
				const create = chat.getByRole("button", { name: /create channel/i }).first();
				await create.click().catch(() => undefined);
				await beat(chat, 700);
			}
		}
		const composer = chat.locator('textarea, [contenteditable="true"]').last();
		if (await composer.count().catch(() => 0)) {
			await composer.click().catch(() => undefined);
			await typeHuman(chat, "Harbor direction two is ready for review 🎉");
			await beat(chat, 400);
			await chat.keyboard.press("Enter").catch(() => undefined);
		}
		await beat(chat, 1200);
	});

	// ── S7: search across everything ───────────────────────────────────────
	await scene("07-search", async () => {
		await closeAppWindows();
		await film(dashboard);
		await dashboard.bringToFront().catch(() => undefined);
		// Motion first — screencast only emits frames on paint, and the
		// injected cursor repaints on mousemove.
		await glideTo(dashboard, 720, 400, 900);
		await dashboard.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
		await beat(dashboard, 800);
		await typeHuman(dashboard, "harbor");
		await beat(dashboard, 1600);
		await glideTo(dashboard, 760, 500, 700);
		await beat(dashboard, 900);
		await dashboard.keyboard.press("Escape").catch(() => undefined);
	});

	// ── S8 is a render-side title card — no capture. ───────────────────────

	await recorder.stop();
	await app.close();
	console.log(`[promo] clips → ${CLIPS_DIR}`);
});
