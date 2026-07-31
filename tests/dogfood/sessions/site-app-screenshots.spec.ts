/**
 * Marketing-site PER-APP screenshot capture (not a dogfood session).
 *
 * Boots the production-built shell against a FRESH, throwaway user-data dir,
 * seeds the real-world studio workspace (seedMarketingEntities), then runs TWO
 * passes — Default Light theme in light mode, Midnight in dark mode — capturing several
 * good-looking views of EVERY first-party app for the site's /apps page.
 *
 * Output: PNGs into ../site/public/screenshots/apps-raw/<app>/<label>.png
 * (dark pass lands in <app>/midnight/<label>.png). Content-creating steps
 * (chat channel, code file, form, books, automations) run once in the light
 * pass and are reused by the dark pass. Every step is best-effort: a failed
 * capture logs a warning and the run continues.
 *
 * Run:  BRAINSTORM_DOGFOOD_SKIP_BUILD=1 npx playwright test \
 *         --config=playwright.dogfood.config.ts \
 *         tests/dogfood/sessions/site-app-screenshots.spec.ts
 */

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Page, _electron, test } from "@playwright/test";
import { shellLaunchEnv } from "../lib/shell-launch-env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SHELL_DIR = process.env.BRAINSTORM_SHELL_DIR ?? join(REPO_ROOT, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

const DATA_DIR = join(REPO_ROOT, "tests", "dogfood", ".app-screenshots-data");
const OUT_DIR = resolve(REPO_ROOT, "..", "site", "public", "screenshots", "apps-raw");
const WALLPAPER_SRC = join(REPO_ROOT, "docs", "art", "wallpaper", "stormy-sea.png");

const APP = {
	Notes: "io.brainstorm.notes",
	Database: "io.brainstorm.database",
	Tasks: "io.brainstorm.tasks",
	Calendar: "io.brainstorm.calendar",
	Journal: "io.brainstorm.journal",
	Contacts: "io.brainstorm.contacts",
	Bookmarks: "io.brainstorm.bookmarks",
	Files: "io.brainstorm.files",
	Graph: "io.brainstorm.graph",
	Whiteboard: "io.brainstorm.whiteboard",
	Agent: "io.brainstorm.agent",
	Automations: "io.brainstorm.automations",
	Mailbox: "io.brainstorm.mailbox",
	Browser: "io.brainstorm.browser",
	Chat: "io.brainstorm.chat",
	Books: "io.brainstorm.books",
	CodeEditor: "io.brainstorm.code-editor",
	FormDesigner: "io.brainstorm.form-designer",
	Preview: "io.brainstorm.preview",
	ThemeEditor: "io.brainstorm.theme-editor",
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

interface Pass {
	name: string;
	theme: string;
	mode: string;
	sub: string;
	create: boolean;
}

interface Ctx {
	create: boolean;
	shoot: (label: string) => Promise<void>;
	warn: (msg: string) => void;
}

const SETTLE: Partial<Record<AppId, number>> = {
	[APP.Graph]: 6000,
	[APP.Whiteboard]: 3500,
	[APP.Database]: 2600,
	[APP.Calendar]: 2600,
	[APP.CodeEditor]: 3000,
};

const CODE_SAMPLE = `import { vault } from "@brainstorm/sdk";

/** Every task past its due date, oldest first. */
export async function overdueTasks() {
  const tasks = await vault.entities.query({
    type: "brainstorm/Task/v1",
  });
  return tasks
    .filter((t) => t.dueAt && t.dueAt < Date.now() && !t.done)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
}
`;

async function clickIf(page: Page, selector: string, timeout = 2500): Promise<boolean> {
	const el = page.locator(selector).first();
	if ((await el.count().catch(() => 0)) === 0) return false;
	try {
		await el.click({ timeout });
		return true;
	} catch {
		return false;
	}
}

async function clickText(page: Page, text: string | RegExp, timeout = 2500): Promise<boolean> {
	const el = page.getByText(text).first();
	if ((await el.count().catch(() => 0)) === 0) return false;
	try {
		await el.click({ timeout });
		return true;
	} catch {
		return false;
	}
}

/** Seed an entity from inside an app renderer via the capability-gated
 *  entities service (same surface the app itself uses). */
async function seedEntity(
	page: Page,
	type: string,
	props: Record<string, unknown>,
): Promise<string> {
	return page.evaluate(
		async ({ t, p }) => {
			const bs = (
				window as unknown as {
					brainstorm?: {
						services?: {
							entities?: {
								create?: (
									type: string,
									props: Record<string, unknown>,
								) => Promise<{ id?: unknown }>;
							} | null;
						} | null;
					};
				}
			).brainstorm;
			const create = bs?.services?.entities?.create;
			if (!create) return "no-entities-create";
			try {
				const reply = await create(t, p);
				return typeof reply?.id === "string" ? reply.id : "created";
			} catch (e) {
				return `create-threw: ${(e as Error).message}`;
			}
		},
		{ t: type, p: props },
	);
}

// ── Per-app drivers ──────────────────────────────────────────────────

async function driveNotes(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2500);
	if (await clickText(p, "Reading — Designing for trust")) await p.waitForTimeout(1500);
	await ctx.shoot("01-editor");
	const items = p.locator(".notes__sidebar-item");
	const other = items.filter({ hasText: /Harbor|brief|kickoff|Northbound/i }).first();
	if (await other.count().catch(() => 0)) {
		await other.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1400);
		await ctx.shoot("02-document");
	}
	if (await clickIf(p, '[aria-controls="notes-props"]')) {
		await p.waitForTimeout(900);
		await ctx.shoot("03-properties");
		await clickIf(p, '[aria-controls="notes-props"]');
	}
}

async function driveDatabase(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(3000);
	const list = (name: RegExp) =>
		p.locator(".db-sidebar__list-item").filter({ hasText: name }).first();
	const tasks = list(/task/i);
	if (await tasks.count().catch(() => 0)) {
		await tasks.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1800);
	}
	await ctx.shoot("01-collection");

	// Flip to another view of the same collection: try a visible view tab
	// first, else the View-settings popover.
	let flipped = false;
	for (const label of ["Board", "Gallery", "Timeline", "Calendar"]) {
		const tab = p.locator("#view-tabs .db-tab").filter({ hasText: label }).first();
		if (await tab.count().catch(() => 0)) {
			await tab.click({ timeout: 2000 }).catch(() => undefined);
			await p.waitForTimeout(1500);
			flipped = true;
			break;
		}
	}
	if (!flipped && (await clickIf(p, "#toolbar-settings"))) {
		await p.waitForTimeout(600);
		const nav = p.locator(".db-popover__nav-row").filter({ hasText: /view type/i }).first();
		if (await nav.count().catch(() => 0)) {
			await nav.click({ timeout: 2000 }).catch(() => undefined);
			await p.waitForTimeout(400);
			const opt = p.locator(".db-popover__option").filter({ hasText: /^Board$/i }).first();
			if (await opt.count().catch(() => 0)) {
				await opt.click({ timeout: 2000 }).catch(() => undefined);
				flipped = true;
			}
		}
		await p.keyboard.press("Escape").catch(() => undefined);
		await p.waitForTimeout(1200);
	}
	if (flipped) await ctx.shoot("02-board");

	// Row inspector over a second collection.
	const people = list(/client|people|project|compan/i);
	if (await people.count().catch(() => 0)) {
		await people.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1800);
	}
	const open = p.locator(".dbv-grid__open").first();
	if (await open.count().catch(() => 0)) {
		await open.click({ timeout: 2500 }).catch(() => undefined);
	} else {
		await clickIf(p, "#header-btn-inspector");
	}
	await p.waitForTimeout(1200);
	await ctx.shoot("03-inspector");
}

async function driveTasks(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2200);
	const surface = (id: string) => p.locator(`.tasks-sidebar__row[data-surface="${id}"]`).first();
	for (const [id, label] of [
		["today", "01-today"],
		["board", "02-board"],
		["timeline", "03-timeline"],
	] as const) {
		const row = surface(id);
		if ((await row.count().catch(() => 0)) === 0) continue;
		await row.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1500);
		await ctx.shoot(label);
	}
}

async function driveCalendar(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(3000);
	const tab = (view: string) => p.locator(`.cal-toolbar__tab[data-view="${view}"]`).first();
	for (const [view, label] of [
		["month", "01-month"],
		["week", "02-week"],
		["agenda", "03-agenda"],
	] as const) {
		const t = tab(view);
		if (await t.count().catch(() => 0)) {
			await t.click({ timeout: 2500 }).catch(() => undefined);
			await p.waitForTimeout(1500);
		}
		await ctx.shoot(label);
	}
}

async function driveJournal(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2800);
	if (await clickText(p, /Three brand directions/)) await p.waitForTimeout(1400);
	await ctx.shoot("01-entry");
	const rollup = p.locator(".journal__rollup-btn").filter({ hasText: /this week/i }).first();
	if (await rollup.count().catch(() => 0)) {
		await rollup.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1200);
		await ctx.shoot("02-weekly-rollup");
	}
}

async function driveContacts(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2500);
	const person = p
		.locator('.contacts-row:has(.contacts-row__name:has-text("Daniel Ortiz"))')
		.first();
	if (await person.count().catch(() => 0)) {
		await person.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1400);
	} else if (await clickIf(p, ".contacts-row")) {
		await p.waitForTimeout(1400);
	}
	await ctx.shoot("01-person");
	if (await clickIf(p, '[data-testid="contacts-new"]')) {
		await p.waitForTimeout(800);
		await ctx.shoot("02-new-contact");
		await p.keyboard.press("Escape").catch(() => undefined);
	}
}

async function driveBookmarks(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	await ctx.shoot("01-inbox");
	const tags = p.locator(".bookmarks__nav-btn").filter({ hasText: /^Tags$/i }).first();
	if (await tags.count().catch(() => 0)) {
		await tags.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1300);
		await ctx.shoot("02-tags");
	}
}

async function driveFiles(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	if (ctx.create) {
		const rows = await p.locator('[data-testid="content-row"]').count().catch(() => 0);
		if (rows === 0) {
			for (const folder of ["Brand assets", "Contracts"]) {
				if (!(await clickIf(p, '[data-testid="toolbar-new"]'))) break;
				await p.waitForTimeout(400);
				if (!(await clickIf(p, '[data-testid="new-folder"]'))) break;
				await p.waitForTimeout(600);
				const rename = p
					.locator('[data-testid="rename-input"], .content-row__rename-input, input:focus')
					.first();
				if (await rename.count().catch(() => 0)) {
					await rename.fill(folder).catch(() => undefined);
					await p.keyboard.press("Enter").catch(() => undefined);
					await p.waitForTimeout(600);
				}
			}
			const png = readFileSync(WALLPAPER_SRC).toString("base64");
			const brief =
				"data:text/markdown;base64," +
				Buffer.from(
					"# Harbor rebrand — creative brief\n\nGoals, audience, tone, deliverables.\n",
				).toString("base64");
			ctx.warn(
				`files seed: ${await seedEntity(p, "brainstorm/File/v1", {
					name: "moodboard.png",
					mime: "image/png",
					attachment: `data:image/png;base64,${png}`,
					size: png.length,
					values: {},
				})}`,
			);
			ctx.warn(
				`files seed: ${await seedEntity(p, "brainstorm/File/v1", {
					name: "creative-brief.md",
					mime: "text/markdown",
					attachment: brief,
					size: brief.length,
					values: {},
				})}`,
			);
			await p.waitForTimeout(1500);
		}
	}
	await clickIf(p, '[data-testid="view-switch-list"]');
	await p.waitForTimeout(800);
	await ctx.shoot("01-list");
	if (
		(await clickIf(p, '[data-testid="view-switch-grid"]')) ||
		(await clickIf(p, '[aria-label="Grid view"]'))
	) {
		await p.waitForTimeout(800);
		await ctx.shoot("02-grid");
	}
	const row = p.locator('[data-testid="content-row"]').first();
	if (await row.count().catch(() => 0)) {
		await row.click({ timeout: 2000 }).catch(() => undefined);
		if (await clickIf(p, '[data-testid="toolbar-inspector"]')) {
			await p.waitForTimeout(900);
			await ctx.shoot("03-inspector");
		}
	}
}

async function driveGraph(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(6000);
	// Close any panel that opened by default so the first shot is pure canvas.
	if (await p.locator(".graph-sidebar__view--filters").count().catch(() => 0)) {
		await clickIf(p, '[aria-label="Filters"]');
		await p.waitForTimeout(600);
	}
	const canvas = p.locator("canvas").first();
	const box = await canvas.boundingBox().catch(() => null);
	if (box) {
		await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await p.mouse.wheel(0, -200).catch(() => undefined);
		await p.waitForTimeout(400);
		// Park the cursor in a corner so the hover preview never enters the shot.
		await p.mouse.move(30, box.y + box.height - 30);
		await p.waitForTimeout(900);
	}
	await ctx.shoot("01-graph");
	if (await clickIf(p, '[aria-label="Filters"]')) {
		await p.waitForTimeout(900);
		await ctx.shoot("02-filters");
		await p.keyboard.press("Escape").catch(() => undefined);
	}
}

async function driveWhiteboard(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(3500);
	await ctx.shoot("01-board");
	if (await clickIf(p, '[aria-label="Add to board"]')) {
		await p.waitForTimeout(600);
		await ctx.shoot("02-insert-menu");
		await p.keyboard.press("Escape").catch(() => undefined);
	}
}

async function driveAgent(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	if (await clickText(p, "Tighten the Harbor brief")) await p.waitForTimeout(1800);
	await ctx.shoot("01-conversation");
}

async function driveAutomations(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2400);
	const openGallery = () =>
		p
			.locator(".au-toolbar button")
			.filter({ hasText: /new from template/i })
			.first();
	if (ctx.create) {
		const rows = await p.locator(".au-list .au-row").count().catch(() => 0);
		if (rows === 0 && (await openGallery().count().catch(() => 0))) {
			await openGallery().click({ timeout: 2500 }).catch(() => undefined);
			await p.waitForTimeout(900);
			const adds = p.locator(".au-template button").filter({ hasText: /^Add$/i });
			const n = Math.min(await adds.count().catch(() => 0), 2);
			for (let i = 0; i < n; i++) {
				await adds.nth(0).click({ timeout: 2000 }).catch(() => undefined);
				await p.waitForTimeout(700);
			}
			await p.keyboard.press("Escape").catch(() => undefined);
			await p.waitForTimeout(800);
		}
	}
	await ctx.shoot("01-workflows");
	if (await openGallery().count().catch(() => 0)) {
		await openGallery().click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(900);
		if (await p.locator(".au-templates").count().catch(() => 0)) await ctx.shoot("02-templates");
		await p.keyboard.press("Escape").catch(() => undefined);
		await p.waitForTimeout(500);
	}
	const reminders = p.locator(".au-tab").filter({ hasText: /reminders/i }).first();
	if (await reminders.count().catch(() => 0)) {
		await reminders.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(900);
		if (ctx.create) {
			const subject = p.locator(".au-capture__subject").first();
			if (await subject.count().catch(() => 0)) {
				await subject.fill("Send the Harbor invoice on Friday").catch(() => undefined);
				await p
					.locator("button")
					.filter({ hasText: /add reminder/i })
					.first()
					.click({ timeout: 2000 })
					.catch(() => undefined);
				await p.waitForTimeout(700);
			}
		}
		await ctx.shoot("03-reminders");
	}
}

async function driveMailbox(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2400);
	await ctx.shoot("01-connect");
	const connect = p.locator(".mb-cta .bs-btn").first();
	if (await connect.count().catch(() => 0)) {
		await connect.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(800);
		if (await p.locator('[data-testid="mb-connect"]').count().catch(() => 0))
			await ctx.shoot("02-accounts");
		await p.keyboard.press("Escape").catch(() => undefined);
	}
}

async function driveBrowser(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	const omnibox = p.locator('[aria-label="Address bar"]').first();
	const goTo = async (url: string) => {
		if ((await omnibox.count().catch(() => 0)) === 0) return;
		await omnibox.click({ timeout: 2500 }).catch(() => undefined);
		await omnibox.fill(url).catch(() => undefined);
		await p.keyboard.press("Enter").catch(() => undefined);
		await p.waitForTimeout(5000);
	};
	// Build a little history so suggestions and the History panel have content.
	// The page itself paints in an isolated native view (never in this renderer),
	// so the shots lean on the chrome: tabs, omnibox, history.
	await goTo("https://example.com");
	await goTo("https://www.iana.org/help/example-domains");
	await ctx.shoot("01-tabs");
	if (await omnibox.count().catch(() => 0)) {
		await omnibox.click({ timeout: 2500 }).catch(() => undefined);
		await p.keyboard.type("example", { delay: 30 }).catch(() => undefined);
		await p.waitForTimeout(900);
		if (await p.locator(".browser__suggestion").count().catch(() => 0))
			await ctx.shoot("02-omnibox");
		await p.keyboard.press("Escape").catch(() => undefined);
	}
	if (await clickIf(p, '[aria-label="History"]')) {
		await p.waitForTimeout(800);
		await ctx.shoot("03-history");
		await p.keyboard.press("Escape").catch(() => undefined);
	}
}

async function driveChat(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2400);
	if (ctx.create) {
		const channels = await p.locator(".chat__channel-name").count().catch(() => 0);
		if (channels === 0) {
			// Display name first, so seeded messages carry a real author.
			if (await clickIf(p, '[aria-label="More actions"]')) {
				await p.waitForTimeout(400);
				if (await clickText(p, "Change display name")) {
					await p.waitForTimeout(400);
					const field = p.locator(".bs-popover__panel .chat__field-input").first();
					await field.fill("Mira").catch(() => undefined);
					await p
						.getByRole("button", { name: "Save" })
						.click({ timeout: 2000 })
						.catch(() => undefined);
					await p.waitForTimeout(500);
				}
				await p.keyboard.press("Escape").catch(() => undefined);
			}
			if (await clickIf(p, '[aria-label="New channel"]')) {
				await p.waitForTimeout(500);
				const field = p.locator(".chat__field-input").first();
				await field.fill("design-crit").catch(() => undefined);
				await p
					.getByRole("button", { name: "Create channel" })
					.click({ timeout: 2000 })
					.catch(() => undefined);
				await p.waitForTimeout(800);
			}
			const composer = p.locator(".chat__composer-input").first();
			if (await composer.count().catch(() => 0)) {
				for (const msg of [
					"Harbor v2 boards are up — take a look before Thursday's review.",
					"The teal direction reads best at small sizes. Vote in the note.",
					"Booked the client walkthrough for Friday 14:00.",
				]) {
					await composer.click({ timeout: 2000 }).catch(() => undefined);
					await p.keyboard.type(msg, { delay: 5 }).catch(() => undefined);
					await p.keyboard.press("Enter").catch(() => undefined);
					await p.waitForTimeout(600);
				}
			}
		}
	} else {
		await clickIf(p, ".chat__channel-name");
		await p.waitForTimeout(900);
	}
	await ctx.shoot("01-channel");
	if (await clickIf(p, '[aria-label="Show members"]')) {
		await p.waitForTimeout(700);
		await ctx.shoot("02-members");
	}
}

async function driveBooks(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2400);
	if (ctx.create) {
		const rows = await p.locator(".books__row").count().catch(() => 0);
		if (rows === 0) {
			const now = Date.now();
			for (const [name, author] of [
				["The Design of Everyday Things", "Don Norman"],
				["Thinking in Systems", "Donella Meadows"],
				["The Shape of Design", "Frank Chimero"],
			]) {
				ctx.warn(
					`books seed: ${await seedEntity(p, "brainstorm/Book/v1", {
						name,
						icon: null,
						format: "epub",
						author,
						fileId: null,
						spineLength: 0,
						reading: { position: null, progress: 0, lastReadAt: null },
						createdAt: now,
						updatedAt: now,
					})}`,
				);
			}
			await p.waitForTimeout(1500);
		}
	}
	await ctx.shoot("01-library");
}

async function driveCodeEditor(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(3000);
	const fileRows = p.locator(".editor__file");
	if (ctx.create && (await fileRows.count().catch(() => 0)) === 0) {
		(await clickIf(p, ".editor__file-new")) ||
			(await clickIf(p, ".editor__empty-new")) ||
			(await clickIf(p, ".editor__header-new"));
		await p.waitForTimeout(900);
		// Rename the fresh buffer if any rename affordance exists (focused input,
		// or a dblclick on the file row's name).
		let rename = p.locator("input:focus").first();
		if ((await rename.count().catch(() => 0)) === 0) {
			await p.locator(".editor__file-name").first().dblclick({ timeout: 2000 }).catch(() => undefined);
			await p.waitForTimeout(400);
			rename = p.locator("input:focus").first();
		}
		if (await rename.count().catch(() => 0)) {
			await rename.fill("overdue-tasks.ts").catch(() => undefined);
			await p.keyboard.press("Enter").catch(() => undefined);
			await p.waitForTimeout(600);
		}
		const buffer = p.locator(".editor__buffer").first();
		if (await buffer.count().catch(() => 0)) {
			await buffer.click({ timeout: 2500 }).catch(() => undefined);
			await buffer.fill(CODE_SAMPLE).catch(() => undefined);
			await p.keyboard.press("Meta+s").catch(() => undefined);
			await p.waitForTimeout(900);
		}
	} else if (await fileRows.count().catch(() => 0)) {
		await fileRows.first().click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1200);
	}
	await ctx.shoot("01-editor");
}

async function driveFormDesigner(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	if (ctx.create) {
		const saved = await p.locator(".fd-sidebar__item").count().catch(() => 0);
		if (saved === 0) {
			const name = p.locator(".fd-builder .fd-input").first();
			await name.fill("Client intake").catch(() => undefined);
			const typeSel = p.locator(".fd-builder .bs-select").first();
			if (await typeSel.count().catch(() => 0)) {
				await typeSel.click({ timeout: 2500 }).catch(() => undefined);
				await p.waitForTimeout(500);
				await p
					.locator(".fm-row")
					.filter({ hasText: /person/i })
					.first()
					.click({ timeout: 2000 })
					.catch(() => undefined);
				await p.waitForTimeout(500);
			}
			for (let i = 0; i < 3; i++) {
				const add = p.locator(".fd-fields__header button").first();
				if ((await add.count().catch(() => 0)) === 0) break;
				await add.click({ timeout: 2000 }).catch(() => undefined);
				await p.waitForTimeout(400);
				const row = p.locator(".fm-row").nth(i);
				if (await row.count().catch(() => 0)) {
					await row.click({ timeout: 2000 }).catch(() => undefined);
					await p.waitForTimeout(400);
				} else {
					await p.keyboard.press("Escape").catch(() => undefined);
					break;
				}
			}
			await p
				.locator(".fd-builder__footer button[data-bs-primary]")
				.first()
				.click({ timeout: 2000 })
				.catch(() => undefined);
			await p.waitForTimeout(800);
		}
	} else {
		await clickIf(p, ".fd-sidebar__item");
		await p.waitForTimeout(900);
	}
	await ctx.shoot("01-builder");
	const fill = p.locator(".fd-mode__tab").filter({ hasText: /fill/i }).first();
	if (await fill.count().catch(() => 0)) {
		await fill.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(900);
		await ctx.shoot("02-fill");
	}
	// The Documents surface (invoices) lives in the same app.
	const docs = p.getByRole("tab", { name: /documents/i }).first();
	if (await docs.count().catch(() => 0)) {
		await docs.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(900);
		if (!ctx.create) {
			await clickText(p, "INV-001");
			await p.waitForTimeout(700);
		}
		if (ctx.create) {
			const newInvoice = p.getByRole("button", { name: /new invoice/i }).first();
			if (await newInvoice.count().catch(() => 0)) {
				await newInvoice.click({ timeout: 2500 }).catch(() => undefined);
				await p.waitForTimeout(900);
				const party = p.locator(".invoices__party").nth(1).locator("input").first();
				await party.fill("Harbor Supply Co.").catch(() => undefined);
				const desc = p.locator(".invoices__item-edit input").first();
				await desc.fill("Brand identity — phase 2").catch(() => undefined);
				const nums = p.locator(".invoices__item-edit input[type=number]");
				await nums.nth(0).fill("1").catch(() => undefined);
				await nums.nth(1).fill("4800").catch(() => undefined);
				await p.waitForTimeout(700);
			}
		}
		if (await p.locator(".invoices__paper").count().catch(() => 0)) await ctx.shoot("03-invoice");
	}
}

async function drivePreview(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	if (ctx.create) {
		const rows = await p.locator(".preview__sidebar-row button").count().catch(() => 0);
		if (rows === 0) {
			const png = readFileSync(WALLPAPER_SRC).toString("base64");
			ctx.warn(
				`preview seed: ${await seedEntity(p, "brainstorm/File/v1", {
					name: "stormy-sea.png",
					mime: "image/png",
					attachment: `data:image/png;base64,${png}`,
					size: png.length,
					values: {},
				})}`,
			);
			await p.waitForTimeout(1500);
		}
	}
	const row = p.locator(".preview__sidebar-row button").first();
	if (await row.count().catch(() => 0)) {
		await row.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(1400);
	}
	await ctx.shoot("01-image");
	const collapsed = await p
		.locator("#preview-root")
		.evaluate((el) => el.classList.contains("preview--inspector-collapsed"))
		.catch(() => true);
	if (collapsed) {
		await clickIf(p, '[data-testid="inspector-toggle"]');
		await p.waitForTimeout(800);
	}
	await ctx.shoot("02-inspector");
}

async function driveThemeEditor(p: Page, ctx: Ctx): Promise<void> {
	await p.waitForTimeout(2600);
	await ctx.shoot("01-tokens");
	const typo = p.getByRole("tab", { name: /typography/i }).first();
	if (await typo.count().catch(() => 0)) {
		await typo.click({ timeout: 2500 }).catch(() => undefined);
		await p.waitForTimeout(900);
		await ctx.shoot("02-typography");
	}
}

const DRIVERS: Array<[AppId, string, (p: Page, ctx: Ctx) => Promise<void>]> = [
	[APP.Notes, "notes", driveNotes],
	[APP.Database, "database", driveDatabase],
	[APP.Tasks, "tasks", driveTasks],
	[APP.Calendar, "calendar", driveCalendar],
	[APP.Journal, "journal", driveJournal],
	[APP.Contacts, "contacts", driveContacts],
	[APP.Bookmarks, "bookmarks", driveBookmarks],
	[APP.Files, "files", driveFiles],
	[APP.Graph, "graph", driveGraph],
	[APP.Whiteboard, "whiteboard", driveWhiteboard],
	[APP.Agent, "agent", driveAgent],
	[APP.Automations, "automations", driveAutomations],
	[APP.Mailbox, "mailbox", driveMailbox],
	[APP.Browser, "browser", driveBrowser],
	[APP.Chat, "chat", driveChat],
	[APP.Books, "books", driveBooks],
	[APP.CodeEditor, "code-editor", driveCodeEditor],
	[APP.FormDesigner, "form-designer", driveFormDesigner],
	[APP.Preview, "preview", drivePreview],
	[APP.ThemeEditor, "theme-editor", driveThemeEditor],
];

test("capture per-app marketing screenshots", async () => {
	test.setTimeout(3_000_000);
	// Chunked invocation support (each chunk stays under external time caps):
	// SITE_SHOT_PASS=light|dark runs one pass, SITE_APP_FILTER=dir1,dir2 limits
	// apps, SITE_KEEP_DATA=1 keeps the seeded vault from a previous chunk.
	if (process.env.SITE_KEEP_DATA !== "1") {
		rmSync(DATA_DIR, { recursive: true, force: true });
	}
	mkdirSync(DATA_DIR, { recursive: true });
	mkdirSync(OUT_DIR, { recursive: true });

	const allPasses: Pass[] = [
		{ name: "light", theme: "default-light", mode: "light", sub: "", create: true },
		{ name: "dark", theme: "default-dark", mode: "dark", sub: "midnight", create: false },
	];
	const passes = process.env.SITE_SHOT_PASS
		? allPasses.filter((p) => p.name === process.env.SITE_SHOT_PASS)
		: allPasses;
	const only = process.env.SITE_APP_FILTER?.split(",").map((s) => s.trim());
	const drivers = only ? DRIVERS.filter(([, dir]) => only.includes(dir)) : DRIVERS;

	// Each pass boots its own shell. Re-launching an app whose window was
	// closed by the driver only works reliably on a fresh shell, so the theme
	// flip doubles as a full restart (which also proves cross-boot persistence
	// of the pass-1 content).
	for (const pass of passes) {
		const app: ElectronApplication = await _electron.launch({
			executablePath: ELECTRON_BIN,
			args: [MAIN_ENTRY, `--user-data-dir=${DATA_DIR}`],
			cwd: SHELL_DIR,
			timeout: 120_000,
			env: shellLaunchEnv({
				BRAINSTORM_APP_WINDOW_WIDTH: "1440",
				BRAINSTORM_APP_WINDOW_HEIGHT: "900",
			}),
		});

		const dashboard = await app.firstWindow({ timeout: 60_000 });
		dashboard.on("console", (m) => {
			if (m.type() === "error") console.log(`[dash:err] ${m.text()}`);
		});

		await dashboard.evaluate(async (dataDir) => {
			const bs = (window as unknown as BW).brainstorm;
			const list = await bs.vaults.list();
			if (list.length === 0) {
				await bs.vaults.create({ name: "Northbound Studio", path: `${dataDir}/vault` });
				await bs.dev.seedPrebuiltApps();
				await bs.dev.seedMarketingEntities();
			} else if (!(await bs.vaults.session()) && list[0]) {
				await bs.vaults.activate(list[0].id);
			}
		}, DATA_DIR);
		await dashboard.waitForTimeout(6000);

		// Dismiss the first-launch "What's new" modal.
		for (const label of ["Got it", "Close", "Done"]) {
			const btn = dashboard.getByRole("button", { name: label }).first();
			if (await btn.count().catch(() => 0)) {
				await btn.click({ timeout: 2000 }).catch(() => undefined);
				await dashboard.waitForTimeout(400);
			}
		}
		await dashboard.keyboard.press("Escape").catch(() => undefined);

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

		// Close through the shell's own window close so its bookkeeping stays
		// sound — a Playwright page.close() leaves a zombie entry behind and the
		// next launch of that app never opens a window.
		const closeAppWindow = async (page: Page) => {
			const url = page.url();
			await app
				.evaluate(({ BrowserWindow }, u) => {
					for (const w of BrowserWindow.getAllWindows()) {
						try {
							if (w.webContents.getURL() === u) w.close();
						} catch {
							// best-effort
						}
					}
				}, url)
				.catch(() => undefined);
		};

		await dashboard.evaluate(
			async ({ theme, mode }) => {
				const bs = (window as unknown as BW).brainstorm;
				await bs.dashboard.setAppearanceMode(mode);
				await bs.dashboard.setTheme(theme);
			},
			{ theme: pass.theme, mode: pass.mode },
		);
		await dashboard.waitForTimeout(2000);

		for (const [id, dir, drive] of drivers) {
			let page: Page | null = null;
			const outDir = join(OUT_DIR, dir, pass.sub);
			mkdirSync(outDir, { recursive: true });
			const ctx: Ctx = {
				create: pass.create,
				shoot: async (label) => {
					if (!page) return;
					await page.waitForTimeout(400);
					await page
						.screenshot({ path: join(outDir, `${label}.png`), scale: "css" })
						.catch((e) => console.warn(`[${pass.name}/${dir}] shot ${label} failed: ${e.message}`));
				},
				warn: (msg) => console.warn(`[${pass.name}/${dir}] ${msg}`),
			};
			try {
				page = await openApp(id);
				await page.waitForTimeout(SETTLE[id] ?? 2000);
				await drive(page, ctx);
			} catch (e) {
				console.warn(`[${pass.name}/${dir}] capture failed: ${(e as Error).message}`);
			}
			if (page) await closeAppWindow(page);
			await dashboard.waitForTimeout(600);
		}

		await app.close().catch(() => undefined);
	}
});
