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

import { mkdirSync, rmSync } from "node:fs";
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

	// The vault is created ON CAMERA in scene 01 through the real welcome
	// flow — no bridge shortcut. The shell boots straight into the welcome
	// view because the data dir is empty; the new default light theme +
	// wallpaper are exactly what a first-run user sees, so nothing is
	// overridden.
	const dashboard = await app.firstWindow({ timeout: 60_000 });
	await dashboard.waitForTimeout(2500);
	await tileAllWindows(app);

	const scale = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor);
	const recorder = makePromoRecorder(CLIPS_DIR, { ...STAGE, scale });

	/** Screencast frames carry no OS cursor — overlay a synthetic one that
	 *  follows the driven mouse so glides/clicks read on camera. */
	const ensureCursor = async (page: Page): Promise<void> => {
		if (!(recorder instanceof ScreencastRecorder)) return;
		await page
			.evaluate(() => {
				if (document.getElementById("__promo-cursor")) return;
				// The classic macOS arrow (black body, white outline), tip at
				// the pointer position; squeezes slightly on press.
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
				// getAllWindows() order is NOT creation order — identify the
				// dashboard by URL (closing it by index killed a whole run).
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

	// ── S1: onboarding — create the vault through the REAL welcome flow ────
	await scene("01-onboarding", async () => {
		await film(dashboard);
		await beat(dashboard, 500);
		await glideClick(dashboard, dashboard.getByText("Create a new vault").first());
		await beat(dashboard, 400);
		const nameInput = dashboard.locator('input[placeholder="Personal"]').first();
		if (await nameInput.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
			await nameInput.click().catch(() => undefined);
			await typeHuman(dashboard, "Northbound Studio");
		}
		// The suggested location is the REAL ~/Documents/Brainstorm — repoint
		// it into the promo data dir (instant fill; visually a path is a path).
		await dashboard
			.locator(".welcome__path-row input")
			.first()
			.fill(`${PROMO_DATA}/vault`)
			.catch(() => undefined);
		await glideClick(dashboard, dashboard.getByRole("button", { name: "Continue" }).first());
		await beat(dashboard, 500);
		// Pick the Small-business starter template on camera, then create.
		const template = dashboard.getByText("Small business").first();
		if (await template.count().catch(() => 0)) {
			await glideClick(dashboard, template).catch(() => undefined);
			await beat(dashboard, 400);
		}
		const createBtn = dashboard.getByRole("button", { name: "Create vault" }).first();
		await createBtn.scrollIntoViewIfNeeded().catch(() => undefined);
		await beat(dashboard, 300);
		await glideClick(dashboard, createBtn).catch(() => undefined);
		// The dashboard materialises — hold the reveal.
		await beat(dashboard, 2500);
	});

	// Vault creation (+ template import) finishes asynchronously — wait for
	// the session before seeding, or the dev channels reject.
	await dashboard.waitForFunction(
		async () => (await (window as unknown as BW).brainstorm.vaults.session()) !== null,
		undefined,
		{ timeout: 90_000, polling: 500 },
	);
	// Off camera: fill the fresh vault so the app scenes have real content.
	await dashboard.evaluate(async () => {
		const bs = (window as unknown as BW).brainstorm;
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
	await tileAllWindows(app);
	await dashboard.waitForTimeout(1000);

	// ── S3: Notes — open the HQ hub and WRITE into it ──────────────────────
	await scene("03-notes", async () => {
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

	// ── S4: Database — Clients board: DRAG a deal + flip the view ──────────
	await scene("04-database", async () => {
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

	// ── S5: Graph pan/zoom → Whiteboard beat ───────────────────────────────
	await scene("05-graph-whiteboard", async () => {
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

	// ── S6: Tasks (CREATE one) → Calendar (NEW event) → Mailbox ────────────
	await scene("06-operate", async () => {
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

	// ── S8: chat — the Chat surface (split-screen collab is the upgrade) ───
	await scene("08-chat", async () => {
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
			// Link the brief through the composer's Add-context menu — the
			// "files in chat" beat — then send.
			const attach = chat.locator('[aria-label="Add context"]').first();
			if (await attach.count().catch(() => 0)) {
				await glideClick(chat, attach).catch(() => undefined);
				await beat(chat, 500);
				const linkDoc = chat.getByText("Link a document").first();
				if (await linkDoc.count().catch(() => 0)) {
					await glideClick(chat, linkDoc).catch(() => undefined);
					await beat(chat, 500);
					const pick = chat.getByText(/Harbor/i).last();
					if (await pick.count().catch(() => 0)) {
						await glideClick(chat, pick).catch(() => undefined);
						await beat(chat, 400);
					}
				} else {
					await chat.keyboard.press("Escape").catch(() => undefined);
				}
			}
			await chat.keyboard.press("Enter").catch(() => undefined);
		}
		await beat(chat, 1200);
	});

	// ── S9: Agent — the seeded conversation + a typed prompt ──────────────
	await scene("09-agent", async () => {
		await closeAppWindows();
		const agent = await openApp("io.brainstorm.agent");
		await film(agent);
		const convo = agent.getByText("Tighten the Harbor brief").first();
		if (await convo.count().catch(() => 0)) {
			await glideClick(agent, convo).catch(() => undefined);
			await beat(agent, 900);
		}
		const composer = agent.locator('textarea, [contenteditable="true"]').last();
		if (await composer.count().catch(() => 0)) {
			await composer.click().catch(() => undefined);
			// Type the prompt but don't send — no model is wired in the rig.
			await typeHuman(agent, "Draft the pricing section from our last call notes");
		}
		await beat(agent, 900);
	});

	// ── S10: Mailbox — mocked client mail (seeded through the app's own
	//         entity caps; the mailbox is a viewer over Email/v1 rows) ───────
	await scene("10-mailbox", async () => {
		await closeAppWindows();
		const mail = await openApp("io.brainstorm.mailbox");
		await mail
			.evaluate(async () => {
				const bs = (
					window as unknown as {
						brainstorm?: {
							services?: {
								entities?: {
									create?: (t: string, p: Record<string, unknown>) => Promise<{ id?: unknown }>;
								} | null;
							} | null;
						};
					}
				).brainstorm;
				const create = bs?.services?.entities?.create;
				if (!create) return;
				const acct = await create("brainstorm/MailAccount/v1", {
					address: "mira@northbound.studio",
					displayName: "Mira — Northbound",
					enabled: true,
				});
				const accountRef = String(acct?.id ?? "");
				const inbox = await create("brainstorm/MailFolder/v1", {
					accountRef,
					path: "INBOX",
					role: "inbox",
					unreadCount: 2,
				});
				const folderRef = String(inbox?.id ?? "");
				const now = Date.now();
				const mk = (
					fromName: string,
					fromAddr: string,
					subject: string,
					body: string,
					ageMin: number,
					unread: boolean,
				) =>
					create("brainstorm/Email/v1", {
						accountRef,
						folderRefs: [folderRef],
						messageId: `<promo-${ageMin}@northbound.local>`,
						threadKey: `promo-${ageMin}`,
						from: [{ name: fromName, address: fromAddr }],
						to: [{ name: "Mira", address: "mira@northbound.studio" }],
						subject,
						receivedAt: now - ageMin * 60_000,
						bodyText: body,
						flags: unread ? ["unread"] : [],
					});
				await mk(
					"Ana Moreau",
					"ana@harborandco.com",
					"Re: Brand directions — we love option two",
					"The nautical-without-clichés route is exactly right. Can we see packaging mockups by Thursday?",
					42,
					true,
				);
				await mk(
					"Tom Becker",
					"tom@meridianhealth.app",
					"Booking flow — kickoff agenda",
					"Sharing the agenda for Monday. The appointment screen is the priority for sprint one.",
					180,
					true,
				);
				await mk(
					"Sophie Lambert",
					"sophie@atlasrobotics.io",
					"Series A deck — final rehearsal",
					"Deck looks strong. Locking the rehearsal for Friday 3pm — bring the printed one-pagers.",
					900,
					false,
				);
			})
			.catch(() => undefined);
		await beat(mail, 1500);
		await film(mail);
		const row = mail.getByText("we love option two").first();
		if (await row.count().catch(() => 0)) {
			await glideClick(mail, row).catch(() => undefined);
		}
		await beat(mail, 1800);
	});

	// ── S11: Browser — omnibox + tabs (page content paints in an isolated
	//         native view the screencast can't see; the chrome carries it) ───
	await scene("11-browser", async () => {
		await closeAppWindows();
		const browser = await openApp("io.brainstorm.browser");
		await film(browser);
		const omnibox = browser.locator('[aria-label="Address bar"]').first();
		if (await omnibox.count().catch(() => 0)) {
			await glideClick(browser, omnibox).catch(() => undefined);
			await typeHuman(browser, "getbrainstorm.online");
			await browser.keyboard.press("Enter").catch(() => undefined);
			await beat(browser, 2500);
		}
		// The "captured straight to the vault" beat — the clip star runs its
		// visible saving → saved phases in the chrome.
		const clip = browser.locator('[aria-label="Save to vault"]').first();
		if (await clip.count().catch(() => 0)) {
			await glideClick(browser, clip).catch(() => undefined);
			await beat(browser, 1200);
		}
		await beat(browser, 700);
	});

	// ── S12: search across everything ───────────────────────────────────────
	await scene("12-search", async () => {
		await closeAppWindows();
		await film(dashboard);
		await glideClick(dashboard, dashboard.locator('[aria-label="Search the vault"]').first());
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
