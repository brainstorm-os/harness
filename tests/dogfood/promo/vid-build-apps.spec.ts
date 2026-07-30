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
 * What is REAL here: the app, its code, that it installs and runs, the consent
 * sheet (shown at install and recalled in the walls beat), the capability
 * grants, and the refusal. The ONE scripted element is the model's output in
 * the agent act, via the capture-only `BRAINSTORM_DEMO_AGENT=appforge`
 * provider (`promo:capture:build-apps` sets it) — the tray, the approval, and
 * the entity writes are the genuine pipeline, exactly as in `vid-agent-team`.
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

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const DATA = join(HARNESS, "tests", "dogfood", ".promo-build-apps-data");
const CLIPS = join(HARNESS, "tests", "dogfood", ".promo-build-apps", "clips");

const CODE = "io.brainstorm.code-editor";
const AGENT = "io.brainstorm.agent";
const CODE_FILE_TYPE = "brainstorm/CodeFile/v1";

/** The `CmdOrCtrl` half of the editor's Save chord, per platform. */
const MOD = process.platform === "darwin" ? "Meta" : "Control";

const AGENT_PROMPT = "Build me a small hello app I can install — a manifest and a page.";

/** The agent-drafted app's name in the grid — the second tile in the payoff. */
const HELLO_APP_NAME = "Hello";

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

	/** Type into the Code editor's textarea one character at a time through
	 *  `Input.insertText` — see the header note on why `keyboard.type` cannot
	 *  be used here. Paces like a person; jitter keeps it off the metronome. */
	const typeSource = async (page: Page, text: string, paceMs: number): Promise<void> => {
		for (const ch of text) {
			await page.keyboard.insertText(ch);
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

	/** Dashboard → Marketplace → Install from… → From vault code files… */
	const openVaultInstaller = async (): Promise<void> => {
		const marketplace = s.dashboard.locator('[data-testid="marketplace"]');
		if (!(await marketplace.count().catch(() => 0))) {
			const open = s.dashboard.getByRole("button", { name: "Open Marketplace" }).first();
			if (await open.count().catch(() => 0)) await glideClick(s.dashboard, open).catch(() => undefined);
			else await s.dashboard.keyboard.press(`${MOD}+Shift+p`).catch(() => undefined);
			await marketplace.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
		}
		await beat(s.dashboard, 550);
		const installFrom = s.dashboard
			.locator('[data-testid="marketplace"] button.button')
			.filter({ hasText: "Install from" })
			.first();
		await glideClick(s.dashboard, installFrom).catch(() => undefined);
		await beat(s.dashboard, 650);
		const fromVault = s.dashboard
			.locator(".fm-menu .fm-row")
			.filter({ hasText: "From vault code files" })
			.first();
		await glideClick(s.dashboard, fromVault).catch(() => undefined);
		await s.dashboard
			.locator('[data-testid="install-from-vault-dialog"]')
			.waitFor({ state: "visible", timeout: 15_000 })
			.catch(() => undefined);
	};

	/** Dismiss whatever overlay stack is up and land back on bare wallpaper. The
	 *  reveal shots (`06-installed`, `11-payoff`) are shot on the grid, and an
	 *  Escape alone returns focus to the marketplace button — whose tooltip then
	 *  hangs open over the reveal. The wallpaper click drops it. */
	const backToGrid = async (): Promise<void> => {
		for (let i = 0; i < 3; i++) {
			await s.dashboard.keyboard.press("Escape").catch(() => undefined);
			await s.dashboard.waitForTimeout(250);
		}
		await s.dashboard.mouse.click(700, 470).catch(() => undefined);
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
	await s.scene("01-the-gap", async () => {
		await s.film(s.dashboard);
		await beat(s.dashboard, 400);
		// Scan the app grid the way someone looking for a tool they don't have does.
		await glideTo(s.dashboard, 240, 220, 600);
		await glideTo(s.dashboard, 700, 320, 700);
		await glideTo(s.dashboard, 1120, 250, 700);
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
		await beat(code, 1300);
	});

	// ── 03: THE PAGE — it asks the vault for her clients and draws them ────
	await s.scene("03-page", async () => {
		await s.film(code);
		await newCodeFile(code, CLIENT_PULSE_INDEX_PATH);
		await typeSource(code, CLIENT_PULSE_INDEX_HTML_ON_CAMERA, 9);
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
		await beat(s.dashboard, 3000);
		await glideClick(
			s.dashboard,
			sheet.locator(".popover__footer button.button--primary").first(),
		).catch(() => undefined);
		await beat(s.dashboard, 700);
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
		await beat(s.dashboard, 2200);
	});

	// Asserted OUTSIDE the scene on purpose: `s.scene` swallows a driver throw
	// (and pads it with a 2.5s beat), so an `expect` inside it would degrade the
	// shot instead of failing the run.
	console.log(`[vid-build-apps] Client Pulse tile on the grid: ${tileRevealed}`);
	expect(tileRevealed, "the payoff tile must be on screen in 06-installed").toBe(true);
	console.log(`[vid-build-apps] icon cells after install: ${(await iconCells()).join(" ")}`);

	// ── 07: IT RUNS — its own window, its own sandbox, her real clients ────
	let pulse: Page | null = null;
	await s.scene("07-launch", async () => {
		pulse = await s.openApp(CLIENT_PULSE_APP_ID);
		watch(pulse, "client-pulse");
		await s.film(pulse);
		await pulse.locator("#board .card").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
		await beat(pulse, 300);
		// Two things keep this page painting: the cards' staggered rise-in on
		// load, and the cursor walking them — each lights up on hover. Reading it
		// that way is also what a person would do.
		for (const [x, y] of [
			[320, 130],
			[420, 260],
			[700, 400],
			[420, 540],
			[820, 300],
		] as const) {
			await glideTo(pulse, x, y, 750);
			await beat(pulse, 250);
		}
		await beat(pulse, 400);
	});

	if (pulse) {
		const names = await (pulse as Page)
			.locator("#board .card__name")
			.allTextContents()
			.catch(() => [] as string[]);
		console.log(`[vid-build-apps] Client Pulse rendered: ${JSON.stringify(names)}`);
		expect(names.length, "Client Pulse must render seeded clients").toBeGreaterThan(0);
	}

	// ── 08: THE WALLS — what she consented to, and what it is refused ──────
	// Moved AHEAD of the agent act. It used to be the last content scene, so the
	// episode's final frame was a red `refused — …` line, which reads as a crash
	// rather than as proof. Here it lands one beat after the app has just read
	// her clients, which is where the contrast is most legible: same app, same
	// window, one call inside the grant and one outside it.
	//
	// The surface for the consent half is the INSTALL CONSENT SHEET, recalled —
	// not Settings → Security → Capability grants. The grants popover truthfully
	// lists the shell baseline every installed app receives *on top of* what its
	// manifest asked for (~22 rows), which reads as a contradiction under this
	// scene's VO. The consent sheet shows exactly what the user agreed to: the
	// one requested capability plus the unsigned advisory. See the storyboard,
	// §"Why the walls beat shows the consent sheet, not the grants popover".
	await s.closeAppWindows();
	await backToGrid();
	await openVaultInstaller();
	const consentRow = vaultRow(CLIENT_PULSE_APP_NAME);
	await consentRow.scrollIntoViewIfNeeded().catch(() => undefined);
	console.log(
		`[vid-build-apps] consent recall row present: ${await consentRow.count().catch(() => 0)}`,
	);

	await s.scene("08-walls", async () => {
		await s.film(s.dashboard);
		await beat(s.dashboard, 400);
		// What she actually consented to, in the shell's own words…
		await glideClick(s.dashboard, consentRow.getByRole("button", { name: "Install" })).catch(
			() => undefined,
		);
		const consentSheet = s.dashboard.locator('[data-testid="confirm-dialog"]');
		await consentSheet.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
		const consent = await consentSheet
			.locator(".confirm__body")
			.first()
			.textContent()
			.catch(() => null);
		console.log(`[vid-build-apps] consent sheet recalled: ${consent ?? "(none)"}`);
		await beat(s.dashboard, 2000);
		// Dismiss without installing — this is a recall of the sheet, not a
		// second install.
		await glideClick(
			s.dashboard,
			consentSheet.locator(".popover__footer button.button--neutral").first(),
		).catch(() => undefined);
		await backToGrid();

		// …and then the pair, in the app itself: the granted read succeeds and the
		// ungranted one is refused, side by side. The refusal on its own read like
		// a broken app; next to the call that works it reads as the wall holding.
		// `vaultEntities.list` statically requires `entities.read:*`, which this
		// app was never granted, and the message on screen is the broker's own.
		const app = await s.openApp(CLIENT_PULSE_APP_ID);
		await s.film(app);
		await beat(app, 400);
		await glideClick(app, app.locator("#probe-ok")).catch(() => undefined);
		await app
			.locator("#probe-ok-out.out--granted")
			.waitFor({ state: "visible", timeout: 10_000 })
			.catch(() => undefined);
		const granted = await app.locator("#probe-ok-out").textContent().catch(() => null);
		await beat(app, 800);
		await glideClick(app, app.locator("#probe")).catch(() => undefined);
		await app
			.locator("#probe-out.out--refused")
			.waitFor({ state: "visible", timeout: 10_000 })
			.catch(() => undefined);
		const refusal = await app.locator("#probe-out").textContent().catch(() => null);
		console.log(
			`[vid-build-apps] granted: ${granted ?? "(none)"} | refused: ${refusal ?? "(none)"}`,
		);
		await glideTo(app, 640, 690, 600);
		await beat(app, 1200);
	});

	// ── 09: THE AGENT DRAFTS IT — two staged code-file cards ───────────────
	await s.closeAppWindows();
	const agent = await s.openApp(AGENT);
	watch(agent, "agent");
	const codeCard = agent.locator('[data-testid="agent-proposal"][data-kind="code-file"]');

	await s.scene("09-agent-drafts", async () => {
		await s.film(agent);
		await agent
			.locator('[data-testid="agent-send"]')
			.first()
			.waitFor({ state: "visible", timeout: 20_000 })
			.catch(() => undefined);
		// Start clean: the app auto-selects a seeded conversation on mount, and a
		// New-chat click that misses drops the whole act into someone else's
		// thread (it did, first run). Click, then confirm the header fell back to
		// the app title before typing a word.
		const newChat = agent.locator('[aria-label="New chat"]').first();
		for (let attempt = 0; attempt < 3; attempt++) {
			await newChat.click().catch(() => undefined);
			await beat(agent, 500);
			const title = await agent.locator(".app-header__title").first().textContent().catch(() => null);
			if (title !== null && /agent/i.test(title)) break;
		}
		await beat(agent, 300);
		const composer = agent.locator('[contenteditable="true"], textarea').last();
		await composer.click().catch(() => undefined);
		await typeHuman(agent, AGENT_PROMPT, 18);
		await beat(agent, 300);
		await agent.locator('[data-testid="agent-send"]').first().click().catch(() => undefined);
		await codeCard.first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
		// Read them the way she would: hold on the manifest card, scroll to the
		// page card, hold again. (Also keeps the screencast painting.)
		await glideTo(agent, 760, 300, 700);
		await beat(agent, 1200);
		await scrollHuman(agent, 260, 900).catch(() => undefined);
		await beat(agent, 800);
		await glideTo(agent, 760, 520, 650);
		await scrollHuman(agent, 300, 900).catch(() => undefined);
		await beat(agent, 1200);
	});

	// ── 10: APPROVE → THE SAME INSTALL PATH ────────────────────────────────
	await s.scene("10-agent-approve", async () => {
		await s.film(agent);
		const cards = await codeCard.count().catch(() => 0);
		for (let i = 0; i < cards; i++) {
			// Approving removes the card, so always take the first one left.
			await codeCard
				.first()
				.locator('[data-testid="agent-proposal-approve"]')
				.click()
				.catch(() => undefined);
			await beat(agent, 700);
		}
		await beat(agent, 500);
		await s.closeAppWindows();
		await s.film(s.dashboard);
		await openVaultInstaller();
		await beat(s.dashboard, 900);
		const hello = vaultRow("hello-app");
		const install = hello.getByRole("button", { name: "Install" });
		if (await install.isEnabled().catch(() => false)) {
			await glideClick(s.dashboard, install).catch(() => undefined);
			const sheet = s.dashboard.locator('[data-testid="confirm-dialog"]');
			await sheet.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
			await beat(s.dashboard, 1200);
			await glideClick(
				s.dashboard,
				sheet.locator(".popover__footer button.button--primary").first(),
			).catch(() => undefined);
			await beat(s.dashboard, 600);
		} else {
			// Dry-run signal: the candidate is listed but refused. `.marketplace__vault-problem`
			// carries the validator's reason — read it into the run log rather than
			// pretending the beat played.
			const problem = await hello
				.locator(".marketplace__vault-problem")
				.first()
				.textContent()
				.catch(() => null);
			console.warn(`[vid-build-apps] hello-app not installable: ${problem ?? "row missing"}`);
			await beat(s.dashboard, 1500);
		}
	});

	// ── 11: PAYOFF — the grid carrying both new apps, and hers running ─────
	// The episode's closing image, and the reason the walls beat moved up. The
	// hook's claim ("it runs the apps you write") is affirmative, so the last
	// thing on screen is too: two tiles that were not in the grid at the top of
	// the episode, and then the app she wrote painting its cards in.
	await s.dashboard
		.locator(".toast--success .toast__title")
		.first()
		.waitFor({ state: "visible", timeout: 20_000 })
		.catch(() => undefined);
	await backToGrid();
	console.log(`[vid-build-apps] icon cells at payoff: ${(await iconCells()).join(" ")}`);

	await s.scene("11-payoff", async () => {
		await s.film(s.dashboard);
		await beat(s.dashboard, 400);
		const hers = await glideToTile(CLIENT_PULSE_APP_NAME, 750);
		await beat(s.dashboard, 350);
		const its = await glideToTile(HELLO_APP_NAME, 750);
		console.log(`[vid-build-apps] payoff tiles — Client Pulse: ${hers}, Hello: ${its}`);
		await beat(s.dashboard, 500);
		// Open hers one last time: the board's staggered rise-in is the closing
		// motion, and it lands the reel on the app WORKING rather than refused.
		const app = await s.openApp(CLIENT_PULSE_APP_ID);
		await s.film(app);
		await app.locator("#board .card").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
		await beat(app, 400);
		await glideTo(app, 640, 300, 700);
		await beat(app, 1200);
	});

	await s.finish();
	if (defects.length > 0) {
		console.warn(`[vid-build-apps] ${defects.length} console/page errors — the polish bar is zero:`);
		for (const defect of defects) console.warn(`  [${defect.where}] ${defect.text}`);
	} else {
		console.log("[vid-build-apps] 0 console/page errors");
	}
	console.log(`[vid-build-apps] clips → ${CLIPS}`);
});
