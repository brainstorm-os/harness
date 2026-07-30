/**
 * VID-build-apps capture — the self-hosting episode: two files written in the
 * Code editor become a real, sandboxed, capability-gated app in the grid,
 * reading the vault's real data. Drives the production shell against a fresh
 * synthetic "Northbound Studio" vault and records one clip per beat via the
 * shared promo stage (`lib/promo-stage.ts`).
 *
 * Scene ids mirror the content scenes in `tools/promo/build-apps-scenes.mjs`
 * and the storyboard's table in `docs/marketing/vid-build-apps.md`
 * (`00-slide-hook` / `12-title` are render-side cards, not captured here).
 * Drivers are defensive — a selector drifting degrades the beat, never kills
 * the run.
 *
 * What is REAL here: BOTH apps, their code, that they install and run, the
 * consent sheet, the capability grants, and the refusal. The ONE scripted
 * element is the model's output in the agent act, via the capture-only
 * `BRAINSTORM_DEMO_AGENT=appforge` provider (`promo:capture:build-apps` sets
 * it) — the tray, the approval, and the entity writes are the genuine
 * pipeline, exactly as in `vid-agent-team`. What that script drafts is a
 * second, genuinely working app ("Milestones", see `milestones-source.ts`):
 * its own id, its own product, the same one scoped capability, asserted here
 * against the bytes the vault actually received.
 *
 * Two mechanics worth knowing before editing a driver:
 *
 *  1. **Never `keyboard.type` into the Code editor.** Its `<textarea>` carries
 *     an auto-close-pairs keydown handler AND an autocomplete popup that
 *     swallows Enter — typing JSON/HTML through `keydown` produces duplicated
 *     closers and eaten newlines. `typeSource` below inserts each character
 *     through `Input.insertText`, which fires `input` (the Y.Text binding's
 *     channel) without a `keydown`, so it looks identical on camera and lands
 *     byte-exact.
 *  2. **The buffer only reaches `properties.content` on an explicit save.**
 *     The installer reads the entity property, so every file gets a
 *     `CmdOrCtrl+S` before it is installed, and `ensureFileContent` re-asserts
 *     the bytes off camera before the install act.
 *
 * And two PACING rules, learned from the first cut (105s, ~20s of it a static
 * white page):
 *
 *  3. **Idle is not footage.** The recorder is the CDP screencast, which emits
 *     frames ON PAINT. A `beat()` on a settled surface produces almost no
 *     footage, and `render.mjs` then clones the last frame out to the scene
 *     budget — a literal freeze. So a hold only goes where something is still
 *     moving or has just changed, and the scene budgets in the scene table are
 *     sized to the driven action rather than the other way round.
 *  4. **Every scene ends on the frame worth freezing.** Whatever the last
 *     painted frame is, the viewer may sit on it for up to a second. Park the
 *     cursor and land the beat before the driver returns.
 *  5. **A beat that is only motion gets cut.** *(pacing pass 2026-07-30.)* The
 *     opening grid scan is 3s and hands off to the Code tile; the picker →
 *     consent flow is driven ONCE in full (04+05) and re-used compressed for
 *     the agent's app (13); the walls beat makes its point inside the running
 *     app instead of recalling the consent sheet. The seconds that frees go to
 *     the agent act (09→13), which is the thing the episode is actually about.
 *
 *   bun run promo:capture:build-apps && bun run promo:vo:build-apps && bun run promo:render:build-apps
 */

import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { beat, glideClick, glideTo, scrollHuman, typeHuman } from "../lib/humanize";
import { launchPromoStage } from "../lib/promo-stage";
import {
	CLIENT_PULSE_APP_ID,
	CLIENT_PULSE_APP_NAME,
	CLIENT_PULSE_INDEX_HTML,
	CLIENT_PULSE_INDEX_HTML_ON_CAMERA,
	CLIENT_PULSE_INDEX_PATH,
	CLIENT_PULSE_MANIFEST,
	CLIENT_PULSE_MANIFEST_PATH,
	assertOnCameraIsSubsequence,
} from "./client-pulse-source";
import {
	MILESTONES_APP_ID,
	MILESTONES_APP_NAME,
	MILESTONES_INDEX_PATH,
	MILESTONES_MANIFEST_PATH,
	MILESTONES_PROMPT,
	assertDraftedAppIsReal,
} from "./milestones-source";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const DATA = join(HARNESS, "tests", "dogfood", ".promo-build-apps-data");
const CLIPS = join(HARNESS, "tests", "dogfood", ".promo-build-apps", "clips");

const CODE = "io.brainstorm.code-editor";
const AGENT = "io.brainstorm.agent";
const CODE_FILE_TYPE = "brainstorm/CodeFile/v1";

/** The `CmdOrCtrl` half of the editor's Save chord, per platform. */
const MOD = process.platform === "darwin" ? "Meta" : "Control";

/** Console / page errors seen on ANY window. The polish gate's bar is zero. */
type Defect = { where: string; text: string };

test("capture VID-build-apps reel", async () => {
	test.setTimeout(1_800_000);
	assertOnCameraIsSubsequence();

	const defects: Defect[] = [];
	const watch = (page: Page, where: string): void => {
		page.on("console", (message) => {
			if (message.type() !== "error") return;
			// The URL matters as much as the text — "Failed to load resource" with
			// no origin is unactionable, and this run's only errors were 404s.
			const at = message.location().url;
			defects.push({ where, text: at ? `${message.text()} — ${at}` : message.text() });
		});
		page.on("pageerror", (error) => {
			defects.push({ where, text: `pageerror: ${String(error)}` });
		});
	};

	const s = await launchPromoStage({ dataDir: DATA, clipsDir: CLIPS });
	watch(s.dashboard, "dashboard");

	await s.createVault("Northbound Studio", join(DATA, "vault"));
	await s.waitForSession();
	await s.seedMarketing();

	// ── helpers ─────────────────────────────────────────────────────────────

	/** Type into the Code editor's textarea through `Input.insertText` — see the
	 *  header note on why `keyboard.type` cannot be used here. Paces like a
	 *  person; jitter keeps it off the metronome.
	 *
	 *  `runLength` is how many characters go per insert. It exists because the
	 *  cost here is the CDP round trip, not `paceMs`: at one character per
	 *  insert this measured ~46 ms/char, so the 510-char page skeleton alone ran
	 *  36s of clip against a 9s budget — past the renderer's 3× cap, i.e. a
	 *  truncated scene. Short runs cut the round trips proportionally; the bytes
	 *  are identical either way.
	 *
	 *  The lever to tune it by is the ON-SCREEN character rate, which is
	 *  (captured chars/sec × the scene's playback speed). Runs of 2 put the page
	 *  skeleton at roughly 100 chars/sec on screen — brisk, still legibly
	 *  materialising. Runs of 3 measured ~145, which reads as a blur. */
	const typeSource = async (
		page: Page,
		text: string,
		paceMs: number,
		runLength = 1,
	): Promise<void> => {
		for (let i = 0; i < text.length; i += runLength) {
			await page.keyboard.insertText(text.slice(i, i + runLength));
			await page.waitForTimeout(paceMs + Math.random() * paceMs);
		}
	};

	const buffer = (page: Page) => page.locator("textarea.editor__buffer").first();

	/** New file → the inline rename popover the editor auto-arms → the path.
	 *  Leaves the caret in the (empty) buffer, ready to type.
	 *
	 *  The New button lives in the header right, next to the files-panel toggle,
	 *  so clicking it parks the pointer where that toggle's tooltip opens — and
	 *  "Hide files" then hangs over the opening second of the scene (it did, in
	 *  the 1:45 cut). Glide into the buffer FIRST, then settle. */
	const newCodeFile = async (page: Page, path: string): Promise<void> => {
		await page
			.locator("button.editor__file-new, button.editor__empty-new, button.editor__header-new")
			.first()
			.click()
			.catch(() => undefined);
		const rename = page.locator(".editor__rename-input").first();
		await rename.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
		if (await rename.count().catch(() => 0)) {
			await rename.fill("").catch(() => undefined);
			await typeHuman(page, path, 22);
			await beat(page, 250);
			await page.keyboard.press("Enter").catch(() => undefined);
		}
		await glideTo(page, 520, 300, 400);
		await buffer(page).click().catch(() => undefined);
		await beat(page, 350);
	};

	const save = async (page: Page): Promise<void> => {
		await page.keyboard.press(`${MOD}+s`).catch(() => undefined);
		await beat(page, 400);
	};

	/** Read the vault's CodeFile rows through the Code editor's own (capability
	 *  checked) entities service — the same surface the app uses. */
	const readCodeFiles = async (page: Page): Promise<{ path: string; content: string }[]> =>
		page
			.evaluate(async (type) => {
				const api = (window as unknown as {
					brainstorm: {
						services: {
							entities: {
								query(q: { type: string }): Promise<{ properties: Record<string, unknown> }[]>;
							};
						};
					};
				}).brainstorm;
				const rows = await api.services.entities.query({ type });
				return rows.map((row) => ({
					path: String(row.properties.path ?? ""),
					content: String(row.properties.content ?? ""),
				}));
			}, CODE_FILE_TYPE)
			.catch(() => []);

	/** Off-camera safety net: re-assert a file's exact bytes before the install
	 *  act. Typing is the footage; the installed bundle must be the real file
	 *  whatever the editor did with a keystroke. */
	const ensureFileContent = async (page: Page, path: string, content: string): Promise<void> => {
		const row = page.locator(".editor__file").filter({ has: page.locator(`[title="${path}"]`) });
		const target = (await row.count().catch(() => 0))
			? row.first()
			: page.locator(".editor__file").filter({ hasText: path.split("/").pop() ?? path }).first();
		await target.click().catch(() => undefined);
		await beat(page, 400);
		const buf = buffer(page);
		await buf.click().catch(() => undefined);
		await page.keyboard.press(`${MOD}+a`).catch(() => undefined);
		await page.keyboard.insertText(content).catch(() => undefined);
		await save(page);
	};

	const marketplace = () => s.dashboard.locator('[data-testid="marketplace"]');

	/** Every modal surface this reel opens over the dashboard. `backToGrid`
	 *  waits on this being empty — see the note there. */
	const overlays = () =>
		s.dashboard.locator(
			'[data-testid="marketplace"], [data-testid="confirm-dialog"], [data-testid="install-from-vault-dialog"]',
		);

	/** Click a target only if it is actually there, and never spend more than
	 *  `timeout` finding out. A bare `glideClick(...).catch()` on a missing
	 *  element still burns Playwright's 30s locator timeout inside the take —
	 *  three of them turned one scene into a 179s clip. */
	const clickIfPresent = async (
		page: Page,
		target: ReturnType<Page["locator"]>,
		timeout = 4000,
	): Promise<boolean> => {
		const there = await target
			.waitFor({ state: "visible", timeout })
			.then(() => true)
			.catch(() => false);
		if (!there) return false;
		await glideClick(page, target).catch(() => undefined);
		return true;
	};

	/** Dashboard → Marketplace → Install from… → From vault code files… */
	const openVaultInstaller = async (): Promise<void> => {
		if (!(await marketplace().count().catch(() => 0))) {
			const open = s.dashboard.getByRole("button", { name: "Open Marketplace" }).first();
			if (!(await clickIfPresent(s.dashboard, open))) {
				await s.dashboard.keyboard.press(`${MOD}+Shift+p`).catch(() => undefined);
			}
			await marketplace().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
		}
		await beat(s.dashboard, 550);
		const installFrom = s.dashboard
			.locator('[data-testid="marketplace"] button.button')
			.filter({ hasText: "Install from" })
			.first();
		// The marketplace remembers where it was left. If a previous scene
		// stranded it on an app's detail page there is no Install-from button at
		// all, and every later beat in this act dies with it — so walk Back once
		// before giving up.
		if (!(await clickIfPresent(s.dashboard, installFrom))) {
			const back = s.dashboard
				.locator('[data-testid="marketplace"] button')
				.filter({ hasText: "Back" })
				.first();
			console.warn("[vid-build-apps] marketplace was not on Browse — walking Back");
			await clickIfPresent(s.dashboard, back);
			await beat(s.dashboard, 500);
			await clickIfPresent(s.dashboard, installFrom);
		}
		await beat(s.dashboard, 650);
		const fromVault = s.dashboard
			.locator(".fm-menu .fm-row")
			.filter({ hasText: "From vault code files" })
			.first();
		await clickIfPresent(s.dashboard, fromVault);
		await s.dashboard
			.locator('[data-testid="install-from-vault-dialog"]')
			.waitFor({ state: "visible", timeout: 15_000 })
			.catch(() => undefined);
	};

	/** Dismiss whatever overlay stack is up and land back on bare wallpaper. The
	 *  reveal shots (`06-installed`, `11-payoff`) are shot on the grid, and an
	 *  Escape alone returns focus to the marketplace button — whose tooltip then
	 *  hangs open over the reveal, so a click on bare wallpaper drops it.
	 *
	 *  The click is gated on the overlays being GONE, and that gate is the whole
	 *  point: a fixed three Escapes is not enough when the stack is
	 *  dialog + picker + marketplace, and (700, 470) then lands on whatever app
	 *  card sits under it. It opened Calendar's detail page, which stranded the
	 *  marketplace for the rest of the run — the agent's app never installed and
	 *  one scene recorded 179s of a frozen detail page. */
	const backToGrid = async (): Promise<void> => {
		for (let i = 0; i < 6; i++) {
			if ((await overlays().count().catch(() => 1)) === 0) break;
			await s.dashboard.keyboard.press("Escape").catch(() => undefined);
			await s.dashboard.waitForTimeout(250);
		}
		const left = await overlays().count().catch(() => 1);
		if (left === 0) await s.dashboard.mouse.click(700, 470).catch(() => undefined);
		else console.warn(`[vid-build-apps] backToGrid: ${left} overlay(s) still up — skipped the click`);
		await s.dashboard.waitForTimeout(300);
	};

	/** Icon cells as the dashboard store holds them — the ground truth behind
	 *  "did the new tile land on a free cell or on top of an existing app". */
	const iconCells = async (): Promise<string[]> =>
		s.dashboard
			.evaluate(async () => {
				const snap = await (window as unknown as {
					brainstorm: {
						dashboard: {
							snapshot(): Promise<{
								icons: Record<string, { x: number; y: number; label?: string }>;
							} | null>;
						};
					};
				}).brainstorm.dashboard.snapshot();
				return Object.values(snap?.icons ?? {}).map(
					(icon) => `${icon.label ?? "?"}@${icon.x},${icon.y}`,
				);
			})
			.catch(() => [] as string[]);

	const vaultRow = (name: string) =>
		s.dashboard
			.locator('[data-testid="install-from-vault-dialog"] li.marketplace__update-row')
			.filter({ hasText: name })
			.first();

	/** Glide the cursor onto a locator's box — the wheel-target primitive the
	 *  agent act needs, because `scrollHuman` wheels wherever the pointer is.
	 *  `fx`/`fy` pick the point inside the box (0.02 lands in a container's own
	 *  padding, i.e. over the scroller and not over a nested one). */
	const glideToBox = async (
		page: Page,
		target: ReturnType<Page["locator"]>,
		ms: number,
		fx = 0.5,
		fy = 0.5,
	): Promise<boolean> => {
		const box = await target.first().boundingBox().catch(() => null);
		if (!box) return false;
		await glideTo(page, box.x + box.width * fx, box.y + box.height * fy, ms);
		return true;
	};

	/** Glide onto a dashboard tile by label; reports whether it was there. The
	 *  grid reveals are only worth their seconds if the tile is on screen. */
	const glideToTile = async (name: string, ms: number): Promise<boolean> => {
		const tile = s.dashboard.locator(".dashboard-icons__icon").filter({ hasText: name }).first();
		if (!(await tile.count().catch(() => 0))) return false;
		const box = await tile.boundingBox().catch(() => null);
		if (!box) return false;
		await glideTo(s.dashboard, box.x + box.width / 2, box.y + box.height / 2, ms);
		return true;
	};

	// ── 01: THE GAP — the grid, and nothing in it does client pulse ─────────
	// 3s, down from 5+: the previous cut opened on six seconds of a cursor
	// drifting over a settled grid, which is motion carrying no information.
	// One sweep, then park on the Code tile — the scan and the hand-off to the
	// next scene in a single gesture.
	await s.scene("01-the-gap", async () => {
		await s.film(s.dashboard);
		await beat(s.dashboard, 250);
		await glideTo(s.dashboard, 300, 240, 500);
		if (!(await glideToTile("Code", 700))) await glideTo(s.dashboard, 900, 300, 700);
		await beat(s.dashboard, 700);
	});

	const code = await s.openApp(CODE);
	watch(code, "code-editor");

	// ── 02: THE MANIFEST — what it is, and what it may touch ───────────────
	await s.scene("02-manifest", async () => {
		await s.film(code);
		await newCodeFile(code, CLIENT_PULSE_MANIFEST_PATH);
		await typeSource(code, CLIENT_PULSE_MANIFEST, 11);
		await save(code);
		// Hold on the capability line — the whole safety story rests on it.
		await beat(code, 800);
	});

	// ── 03: THE PAGE — it asks the vault for her clients and draws them ────
	await s.scene("03-page", async () => {
		await s.film(code);
		await newCodeFile(code, CLIENT_PULSE_INDEX_PATH);
		await typeSource(code, CLIENT_PULSE_INDEX_HTML_ON_CAMERA, 9, 2);
		await beat(code, 500);
		// Reveal the finished page in one motion (markup first, styling after —
		// every line typed above is in these bytes verbatim).
		await code.keyboard.press(`${MOD}+a`).catch(() => undefined);
		await code.keyboard.insertText(CLIENT_PULSE_INDEX_HTML).catch(() => undefined);
		await save(code);
		await beat(code, 400);
		await scrollHuman(code, 380, 900).catch(() => undefined);
		await beat(code, 500);
	});

	// ── 04: INSTALL FROM VAULT — no folder, no zip, no terminal ────────────
	await s.scene("04-install-from-vault", async () => {
		// Off camera: pin the exact bytes, then hand the stage to the dashboard.
		await ensureFileContent(code, CLIENT_PULSE_MANIFEST_PATH, CLIENT_PULSE_MANIFEST);
		await ensureFileContent(code, CLIENT_PULSE_INDEX_PATH, CLIENT_PULSE_INDEX_HTML);
		const saved = await readCodeFiles(code);
		console.log(
			`[vid-build-apps] vault code files: ${saved.map((f) => `${f.path} (${f.content.length}B)`).join(", ")}`,
		);
		await s.closeAppWindows();
		console.log(`[vid-build-apps] icon cells before install: ${(await iconCells()).join(" ")}`);

		await s.film(s.dashboard);
		await beat(s.dashboard, 400);
		await openVaultInstaller();
		await beat(s.dashboard, 1300);
	});

	// ── 05: CONSENT — name · id · version · capabilities · unsigned ────────
	await s.scene("05-consent", async () => {
		await s.film(s.dashboard);
		const row = vaultRow(CLIENT_PULSE_APP_NAME);
		await glideClick(s.dashboard, row.getByRole("button", { name: "Install" })).catch(
			() => undefined,
		);
		const sheet = s.dashboard.locator('[data-testid="confirm-dialog"]');
		await sheet.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
		// Let it breathe — the consent sheet is the product, not a speed bump.
		// This hold IS the scene, which is why the scene table sets no `speed`
		// floor here: a floor would compress the sheet and then freeze the tail
		// on the marketplace behind it.
		await beat(s.dashboard, 2200);
		await glideClick(
			s.dashboard,
			sheet.locator(".popover__footer button.button--primary").first(),
		).catch(() => undefined);
		await beat(s.dashboard, 600);
	});

	// ── 06: INSTALLED — the toast, then the icon in the grid ───────────────
	// The first cut spent this scene inside the marketplace and never showed the
	// new tile: "and there it is" played over a list of apps that were already
	// there. The marketplace is dismissed IN the beat now, and the scene lands
	// (and freezes) on the cursor sitting on the new icon.
	let tileRevealed = false;
	await s.scene("06-installed", async () => {
		await s.film(s.dashboard);
		await s.dashboard
			.locator(".toast--success .toast__title")
			.first()
			.waitFor({ state: "visible", timeout: 20_000 })
			.catch(() => undefined);
		await beat(s.dashboard, 500);
		// Park the cursor off the header before dismissing — an IconButton left
		// under the pointer holds its tooltip open over the reveal shot.
		await glideTo(s.dashboard, 700, 420, 350);
		await backToGrid();
		tileRevealed = await glideToTile(CLIENT_PULSE_APP_NAME, 700);
		await beat(s.dashboard, 1200);
	});

	// Asserted OUTSIDE the scene on purpose: `s.scene` swallows a driver throw
	// (and pads it with a 2.5s beat), so an `expect` inside it would degrade the
	// shot instead of failing the run.
	console.log(`[vid-build-apps] Client Pulse tile on the grid: ${tileRevealed}`);
	expect(tileRevealed, "the payoff tile must be on screen in 06-installed").toBe(true);
	console.log(`[vid-build-apps] icon cells after install: ${(await iconCells()).join(" ")}`);

	// ── 07: IT RUNS — its own window, its own sandbox, her real clients ────
	// Opened BETWEEN scenes, never inside one: `s.scene` starts the recorder
	// before the driver runs, so an in-scene `openApp` records ~4s of the
	// previous, settled surface — the renderer then pads that held frame out and
	// it lands as dead air in the middle of the take.
	const pulse = await s.openApp(CLIENT_PULSE_APP_ID);
	watch(pulse, "client-pulse");

	await s.scene("07-launch", async () => {
		await s.film(pulse);
		await pulse.locator("#board .card").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
		await beat(pulse, 250);
		// Two things keep this page painting: the cards' staggered rise-in on
		// load, and the cursor walking them — each lights up on hover. Reading it
		// that way is also what a person would do.
		for (const [x, y] of [
			[420, 260],
			[700, 400],
			[420, 540],
			[820, 300],
		] as const) {
			await glideTo(pulse, x, y, 700);
			await beat(pulse, 250);
		}
		await beat(pulse, 350);
	});

	const rendered = await pulse
		.locator("#board .card__name")
		.allTextContents()
		.catch(() => [] as string[]);
	console.log(`[vid-build-apps] Client Pulse rendered: ${JSON.stringify(rendered)}`);
	expect(rendered.length, "Client Pulse must render seeded clients").toBeGreaterThan(0);

	// ── 08: THE WALLS — what it was granted, and what it is refused ────────
	// A CONTINUATION of `07`, not a new setup: same app, same window, nothing
	// staged in between, so the join reads as a beat inside one shot.
	//
	// The consent-sheet recall this scene used to open with is gone (pacing pass
	// 2026-07-30). It was the third appearance of the install chrome in a 92s
	// film, and the point it made is already printed *by the app itself* in its
	// own header — `vault access: entities.read:brainstorm/Project/v1`, rendered
	// from `window.brainstorm.capabilities`. Holding on that and then running
	// the probe pair keeps the whole beat inside the running app, which is where
	// it is strongest and where it needs no dialog. See the storyboard,
	// §"Why the walls beat stopped recalling the consent sheet".
	//
	// The pair matters: the granted read succeeds and the ungranted one is
	// refused, side by side. The refusal on its own read like a broken app; next
	// to the call that works it reads as the wall holding. `vaultEntities.list`
	// statically requires `entities.read:*`, which this app was never granted,
	// and the message on screen is the broker's own.
	await s.scene("08-walls", async () => {
		await s.film(pulse);
		await beat(pulse, 250);
		await glideToBox(pulse, pulse.locator("#granted"), 600);
		await beat(pulse, 900);
		await glideClick(pulse, pulse.locator("#probe-ok")).catch(() => undefined);
		await pulse
			.locator("#probe-ok-out.out--granted")
			.waitFor({ state: "visible", timeout: 10_000 })
			.catch(() => undefined);
		const granted = await pulse.locator("#probe-ok-out").textContent().catch(() => null);
		await beat(pulse, 1100);
		await glideClick(pulse, pulse.locator("#probe")).catch(() => undefined);
		await pulse
			.locator("#probe-out.out--refused")
			.waitFor({ state: "visible", timeout: 10_000 })
			.catch(() => undefined);
		const refusal = await pulse.locator("#probe-out").textContent().catch(() => null);
		console.log(
			`[vid-build-apps] granted: ${granted ?? "(none)"} | refused: ${refusal ?? "(none)"}`,
		);
		await glideTo(pulse, 300, 690, 450);
		await beat(pulse, 400);
		await glideTo(pulse, 640, 690, 450);
		await beat(pulse, 900);
	});

	// ── THE AGENT ACT (09 → 13) ────────────────────────────────────────────
	// Four scenes and 29 of the film's 92 seconds, up from two scenes and 15.
	// The owner's note on the previous cut was that this is the part worth
	// watching and it was the thinnest, so it now shows the whole gesture:
	// asking, the drafts arriving, reading the code, approving, the files
	// landing in the same tree her own files live in, and only then a
	// deliberately compressed re-run of the install path.
	//
	// The new-chat dance is staged OFF camera: the app auto-selects a seeded
	// conversation on mount, and a New-chat click that misses drops the whole
	// act into someone else's thread (it did, once). Click, then confirm the
	// header fell back to the app title before a single frame is recorded.
	await s.closeAppWindows();
	const agent = await s.openApp(AGENT);
	watch(agent, "agent");
	const codeCard = agent.locator('[data-testid="agent-proposal"][data-kind="code-file"]');
	const codePre = agent.locator('[data-testid="agent-proposal-code"]');
	const tray = agent.locator(".agent-proposal-tray");
	await agent
		.locator('[data-testid="agent-send"]')
		.first()
		.waitFor({ state: "visible", timeout: 20_000 })
		.catch(() => undefined);
	const newChat = agent.locator('[aria-label="New chat"]').first();
	for (let attempt = 0; attempt < 3; attempt++) {
		await newChat.click().catch(() => undefined);
		await beat(agent, 400);
		const title = await agent.locator(".app-header__title").first().textContent().catch(() => null);
		if (title !== null && /agent/i.test(title)) break;
	}

	// ── 09: SHE ASKS — the prompt typed, sent, and the first draft landing ─
	await s.scene("09-agent-ask", async () => {
		await s.film(agent);
		await beat(agent, 200);
		const composer = agent.locator('[contenteditable="true"], textarea').last();
		await glideToBox(agent, composer, 500);
		await composer.click().catch(() => undefined);
		// Slower than the editor's typing pace on purpose: this is one short
		// sentence, and it is the only thing on screen while it is typed.
		await typeHuman(agent, MILESTONES_PROMPT, 58);
		await beat(agent, 400);
		await glideClick(agent, agent.locator('[data-testid="agent-send"]').first()).catch(
			() => undefined,
		);
		await agent
			.locator('[data-testid="agent-thinking"]')
			.waitFor({ state: "visible", timeout: 5_000 })
			.catch(() => undefined);
		await beat(agent, 600);
		await codeCard.first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
		await beat(agent, 500);
		await glideToBox(agent, tray, 600, 0.5, 0.06);
		await beat(agent, 700);
	});

	// ── 10: IT DRAFTS A REAL APP — both cards, read ────────────────────────
	// The tray is height-capped and scrolls internally (shell PR alongside this
	// one), so the composer stays put and both cards are reachable. Two code
	// previews at 240px each never fit the frame at once, so the beat reads them
	// the way a person would: card one's code, then travel to card two's.
	await s.scene("10-agent-drafts", async () => {
		await s.film(agent);
		await beat(agent, 250);
		await glideToBox(agent, codePre.first(), 550);
		await scrollHuman(agent, 200, 900).catch(() => undefined);
		await beat(agent, 700);
		// Wheel over the tray's own padding, not over a nested code preview, so
		// the tray is what scrolls.
		await glideToBox(agent, tray, 450, 0.015, 0.5);
		await scrollHuman(agent, 380, 900).catch(() => undefined);
		await beat(agent, 500);
		await glideToBox(agent, codePre.nth(1), 500);
		await scrollHuman(agent, 220, 800).catch(() => undefined);
		await beat(agent, 900);
	});

	const staged = await codeCard.count().catch(() => 0);
	console.log(`[vid-build-apps] staged code-file cards: ${staged}`);
	expect(staged, "the agent must stage both drafted files").toBe(2);

	// ── 11: APPROVE — and only then is anything written ────────────────────
	await s.scene("11-agent-approve", async () => {
		await s.film(agent);
		await beat(agent, 250);
		// Back to the top of the tray first: scene 10 left it parked on card two,
		// and approving a card that is scrolled out of frame is an invisible click.
		await glideToBox(agent, tray, 450, 0.015, 0.5);
		await scrollHuman(agent, -520, 650).catch(() => undefined);
		await beat(agent, 400);
		for (let i = 0; i < 2; i++) {
			// Approving removes the card, so always take the first one left.
			await codeCard
				.first()
				.locator('[data-testid="agent-proposal-approve"]')
				.scrollIntoViewIfNeeded()
				.catch(() => undefined);
			await glideClick(
				agent,
				codeCard.first().locator('[data-testid="agent-proposal-approve"]'),
			).catch(() => undefined);
			await beat(agent, 800);
		}
		await glideToBox(agent, agent.locator('[data-testid="agent-created-objects"]'), 600).catch(
			() => undefined,
		);
		await beat(agent, 900);
	});

	// ── 12: THE FILES LAND — beside the ones she wrote ─────────────────────
	// The Code editor is reopened off camera; its FILES tree is a folder tree,
	// so the agent's `milestones/` folder now sits next to her `client-pulse/`
	// one — the same place, the same file rows, no distinction between who
	// wrote them. That is the whole point of the beat.
	await s.closeAppWindows();
	const codeAgain = await s.openApp(CODE);
	watch(codeAgain, "code-editor (agent files)");

	const drafted = await readCodeFiles(codeAgain);
	console.log(
		`[vid-build-apps] vault code files after approval: ${drafted
			.map((f) => `${f.path} (${f.content.length}B)`)
			.join(", ")}`,
	);
	// The honesty gate for the whole act: what the agent staged has to be a real
	// app — one scoped capability, a real vault read, not a stub, not a copy of
	// the app she wrote. See `milestones-source.ts`.
	assertDraftedAppIsReal(drafted);

	const fileRow = (path: string) =>
		codeAgain.locator(".editor__file").filter({ has: codeAgain.locator(`[title="${path}"]`) });

	await s.scene("12-agent-files", async () => {
		await s.film(codeAgain);
		await beat(codeAgain, 250);
		await glideClick(codeAgain, fileRow(MILESTONES_MANIFEST_PATH).first()).catch(() => undefined);
		await beat(codeAgain, 700);
		await glideClick(codeAgain, fileRow(MILESTONES_INDEX_PATH).first()).catch(() => undefined);
		await beat(codeAgain, 500);
		await glideTo(codeAgain, 760, 420, 450);
		await scrollHuman(codeAgain, 300, 800).catch(() => undefined);
		await beat(codeAgain, 600);
	});

	// ── 13: SAME INSTALL PATH — deliberately compressed ────────────────────
	// The viewer watched the picker and the consent sheet in full at 04-05.
	// Re-running them at length taught nothing and was the main reason the back
	// half dragged, so the whole path — picker, row, sheet, confirm — plays here
	// inside four seconds (the renderer compresses the take ~1.7×).
	await s.closeAppWindows();
	await backToGrid();

	let agentAppInstalled = false;
	await s.scene("13-agent-install", async () => {
		await s.film(s.dashboard);
		await beat(s.dashboard, 250);
		await openVaultInstaller();
		await beat(s.dashboard, 500);
		const row = vaultRow(MILESTONES_APP_NAME);
		const install = row.getByRole("button", { name: "Install" });
		if (await install.isEnabled().catch(() => false)) {
			await glideClick(s.dashboard, install).catch(() => undefined);
			const sheet = s.dashboard.locator('[data-testid="confirm-dialog"]');
			await sheet.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
			await beat(s.dashboard, 900);
			await glideClick(
				s.dashboard,
				sheet.locator(".popover__footer button.button--primary").first(),
			).catch(() => undefined);
			await beat(s.dashboard, 600);
			agentAppInstalled = true;
		} else {
			// Dry-run signal: the candidate is listed but refused.
			// `.marketplace__vault-problem` carries the validator's reason — read it
			// into the run log rather than pretending the beat played.
			const problem = await row
				.locator(".marketplace__vault-problem")
				.first()
				.textContent()
				.catch(() => null);
			console.warn(`[vid-build-apps] Milestones not installable: ${problem ?? "row missing"}`);
			await beat(s.dashboard, 1500);
		}
	});
	expect(agentAppInstalled, "the agent's app must install from the vault").toBe(true);

	// ── 14: PAYOFF — both tiles, then the AGENT'S app running ──────────────
	// The previous cut closed on Client Pulse — the app SHE wrote — right after
	// the narration said the agent had written one, so the payoff argued against
	// itself. The closing shot is now the agent's app, reading the same vault
	// through the same broker: two apps in the grid, one of them written by the
	// OS, both real.
	await s.dashboard
		.locator(".toast--success .toast__title")
		.first()
		.waitFor({ state: "visible", timeout: 20_000 })
		.catch(() => undefined);
	await backToGrid();
	console.log(`[vid-build-apps] icon cells at payoff: ${(await iconCells()).join(" ")}`);
	const closer = await s.openApp(MILESTONES_APP_ID);
	watch(closer, "milestones (payoff)");
	await closer.locator(".lane").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
	const lanes = await closer.locator(".lane__name").allTextContents().catch(() => [] as string[]);
	const grant = (await closer.locator("#grant").textContent().catch(() => "")) ?? "";
	console.log(`[vid-build-apps] Milestones rendered: ${JSON.stringify(lanes)} · ${grant}`);
	expect(lanes.length, "the agent's app must render the seeded projects").toBeGreaterThan(0);

	let bothTiles = false;
	await s.scene("14-payoff", async () => {
		await s.film(s.dashboard);
		await beat(s.dashboard, 300);
		const hers = await glideToTile(CLIENT_PULSE_APP_NAME, 700);
		await beat(s.dashboard, 300);
		const its = await glideToTile(MILESTONES_APP_NAME, 700);
		bothTiles = hers && its;
		console.log(`[vid-build-apps] payoff tiles — Client Pulse: ${hers}, Milestones: ${its}`);
		await beat(s.dashboard, 400);
		// Reloaded ON camera so the lanes' staggered rise-in plays into the
		// closing frame instead of having finished off it.
		await s.film(closer);
		await closer.reload().catch(() => undefined);
		await closer.locator(".lane").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
		// `film` again, on purpose: the synthetic cursor is a DOM node injected
		// into the page, and a reload wipes it. Without this the closing shot has
		// no pointer at all AND — because the screencast only emits frames on
		// paint — the glides below paint nothing, which is how this scene came
		// back 2.1s short of its budget and got a frozen tail.
		await s.film(closer);
		await beat(closer, 450);
		// Walk the lanes the way the cards were walked in 07 — the closing frame
		// is a hold, but the seconds before it have to be motion or the renderer
		// clones a frame out to the budget (this scene came back 1.8s short once).
		await glideTo(closer, 700, 200, 600);
		await beat(closer, 400);
		await glideTo(closer, 420, 340, 600);
		await beat(closer, 400);
		await glideTo(closer, 700, 480, 600);
		await beat(closer, 1100);
	});

	// Asserted outside the scene, like the `06-installed` reveal: the closing
	// image is "two apps that weren't there this morning", so one missing tile
	// means the agent act silently degraded and the take is not shippable.
	expect(bothTiles, "both new tiles must be on the grid in 14-payoff").toBe(true);

	await s.finish();
	if (defects.length > 0) {
		console.warn(`[vid-build-apps] ${defects.length} console/page errors — the polish bar is zero:`);
		for (const defect of defects) console.warn(`  [${defect.where}] ${defect.text}`);
	} else {
		console.log("[vid-build-apps] 0 console/page errors");
	}
	console.log(`[vid-build-apps] clips → ${CLIPS}`);
});
