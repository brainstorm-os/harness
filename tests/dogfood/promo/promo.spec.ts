/**
 * Promo capture rig — drives the 8 storyboard scenes of the 60s promo
 * (docs/marketing/promo-60s.md) against the PROMO vault clone
 * (`tests/dogfood/.promo-data`, built by `bun run promo:prepare-vault`) and
 * records one clip per scene via the OS-level `SceneRecorder`.
 *
 * Never touches the live Northbound vault. Runs FOCUSED (no
 * `BRAINSTORM_NO_FOCUS`) so the real cursor is on camera — the machine must
 * be unattended while this runs.
 *
 * Scene drivers are deliberately defensive: every fancy interaction (a drag,
 * a view flip) is wrapped so a selector drifting with the product never
 * kills the run — the scene still records real footage of the open surface,
 * and the render stays producible. Failures are logged for polish passes.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	type ElectronApplication,
	type Page,
	_electron,
	test,
} from "@playwright/test";
import { beat, glideDrag, glideTo, scrollHuman, typeHuman } from "../lib/humanize";
import { ScreencastRecorder, makePromoRecorder } from "../lib/recorder";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const SHELL_DIR = join(HARNESS, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");
const PROMO_DATA = join(HARNESS, "tests", "dogfood", ".promo-data");
const CLIPS_DIR = join(HARNESS, "tests", "dogfood", ".promo", "clips");

/** 16:9 stage in logical px; captured ×2 Retina → 2880×1620 → 1080p. */
const STAGE = { x: 0, y: 40, width: 1440, height: 810 };

const TAB_STRIP = "/chrome/tab-strip";
const DASHBOARD = "/renderer/index.html";

type BW = {
	brainstorm: {
		vaults: {
			list(): Promise<{ id: string }[]>;
			session(): Promise<unknown>;
			activate(id: string): Promise<unknown>;
		};
		apps: { launch(id: string): Promise<unknown> };
		dev: { seedPrebuiltApps(): Promise<unknown> };
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
	if (!existsSync(PROMO_DATA)) {
		throw new Error("run `bun run promo:prepare-vault` first — .promo-data missing");
	}
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
			NODE_ENV: "production",
		},
	});

	const dashboard = await app.firstWindow({ timeout: 60_000 });
	await dashboard.evaluate(async () => {
		const bs = (window as unknown as BW).brainstorm;
		if (!(await bs.vaults.session())) {
			const [vault] = await bs.vaults.list();
			if (!vault) throw new Error("promo vault clone has no vault registered");
			await bs.vaults.activate(vault.id);
		}
		await bs.dev.seedPrebuiltApps();
	});
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
		await glideTo(dashboard, 300, 500, 900);
		await beat(dashboard, 1200);
		await glideTo(dashboard, 1100, 420, 1600);
		await beat(dashboard, 1500);
	});

	// ── S2: Notes — HQ hub with the live embed ─────────────────────────────
	await scene("02-notes", async () => {
		const notes = await openApp("io.brainstorm.notes");
		await film(notes);
		const hq = notes.getByText(/Northbound HQ/i).first();
		if (await hq.count().catch(() => 0)) {
			await hq.click().catch(() => undefined);
			await beat(notes, 1200);
		}
		await scrollHuman(notes, 900, 2400);
		await beat(notes, 1000);
	});

	// ── S3: Database — Clients board drag + view flip ──────────────────────
	await scene("03-database", async () => {
		await closeAppWindows();
		const db = await openApp("io.brainstorm.database");
		await film(db);
		const clients = db.getByText(/^Clients$/).first();
		if (await clients.count().catch(() => 0)) {
			await clients.click().catch(() => undefined);
			await beat(db, 1500);
		}
		await glideDrag(
			db,
			'[draggable="true"]',
			'[data-testid*="column"]:nth-of-type(3), .db-board__column:nth-of-type(3)',
			1200,
		).catch(() => undefined);
		await beat(db, 1500);
	});

	// ── S4: Graph pan/zoom → Whiteboard beat ───────────────────────────────
	await scene("04-graph-whiteboard", async () => {
		await closeAppWindows();
		const graph = await openApp("io.brainstorm.graph");
		await film(graph);
		await glideTo(graph, 720, 420, 500);
		await graph.mouse.down();
		await glideTo(graph, 500, 300, 1200);
		await graph.mouse.up();
		await graph.mouse.wheel(0, -400);
		await beat(graph, 1200);
		await closeAppWindows();
		const wb = await openApp("io.brainstorm.whiteboard");
		await film(wb);
		await beat(wb, 2000);
	});

	// ── S5: Tasks → Calendar → Mailbox quick cuts ──────────────────────────
	await scene("05-operate", async () => {
		await closeAppWindows();
		const tasks = await openApp("io.brainstorm.tasks");
		await film(tasks);
		await beat(tasks, 2200);
		await closeAppWindows();
		const cal = await openApp("io.brainstorm.calendar");
		await film(cal);
		await beat(cal, 2200);
		await closeAppWindows();
		const mail = await openApp("io.brainstorm.mailbox");
		await film(mail);
		await beat(mail, 2500);
	});

	// ── S6: team — the Chat surface (split-screen collab is the upgrade) ───
	await scene("06-team", async () => {
		await closeAppWindows();
		const chat = await openApp("io.brainstorm.chat");
		await film(chat);
		await beat(chat, 1200);
		const composer = chat.locator('textarea, [contenteditable="true"]').last();
		if (await composer.count().catch(() => 0)) {
			await composer.click().catch(() => undefined);
			await typeHuman(chat, "Issue #12 draft is ready for review 🎉");
			await beat(chat, 600);
			await chat.keyboard.press("Enter").catch(() => undefined);
		}
		await beat(chat, 1800);
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
		await typeHuman(dashboard, "renewal");
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
