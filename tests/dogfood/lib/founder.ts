/**
 * Founder-session harness — the "Mira Anand / Northbound" dogfooding loop.
 *
 * Boots the production-built shell under Playwright's Electron driver, but
 * unlike the perf harness this one points at a PERSISTENT user-data dir
 * (`tests/dogfood/.data`) that is never wiped between runs. Mira's workspace
 * accumulates over time — that continuity is the whole point: she is running
 * a real business inside the product, session after session.
 *
 * A session is authored as a thin spec under `tests/dogfood/sessions/`. The
 * spec encodes what Mira sets out to do that day; this harness captures what
 * actually happened (screenshots, renderer console, network-audit) into a
 * per-session folder under `tests/dogfood/.sessions/<name>/`. The captures are
 * then read back and distilled into `docs/dogfood/friction-log.md` — the
 * single channel through which the founder files feedback to the development
 * side. The founder never edits code; she only uses the app and reports.
 */

import { appendFileSync, mkdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Locator, type Page, _electron } from "@playwright/test";
import { type Speaker, postToTeamChat } from "./team-chat";
import { shellLaunchEnv } from "./shell-launch-env";

export { SPEAKER, type Speaker } from "./team-chat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
// `BRAINSTORM_SHELL_DIR` points a run at a side worktree's build (same
// contract as the site-screenshot specs) so a feature branch can be probed
// without touching the shared main shell tree; default is the symlinked
// main tree.
const SHELL_DIR = process.env.BRAINSTORM_SHELL_DIR ?? join(REPO_ROOT, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

/** Mira's persistent desk. Gitignored, never wiped between sessions. */
export const NORTHBOUND_DATA_DIR = join(REPO_ROOT, "tests", "dogfood", ".data");
const SESSIONS_ROOT = join(REPO_ROOT, "tests", "dogfood", ".sessions");

const VAULT_NAME = "Northbound";

/** First-party app ids Mira can open. Mirror of the shipped registry. */
export const APP = {
	Notes: "io.brainstorm.notes",
	Database: "io.brainstorm.database",
	Tasks: "io.brainstorm.tasks",
	Calendar: "io.brainstorm.calendar",
	Journal: "io.brainstorm.journal",
	Graph: "io.brainstorm.graph",
	Whiteboard: "io.brainstorm.whiteboard",
	Files: "io.brainstorm.files",
	Bookmarks: "io.brainstorm.bookmarks",
	CodeEditor: "io.brainstorm.code-editor",
	ThemeEditor: "io.brainstorm.theme-editor",
	Agent: "io.brainstorm.agent",
	Contacts: "io.brainstorm.contacts",
	Automations: "io.brainstorm.automations",
	Browser: "io.brainstorm.browser",
	Mailbox: "io.brainstorm.mailbox",
	FormDesigner: "io.brainstorm.form-designer",
	Books: "io.brainstorm.books",
	Preview: "io.brainstorm.preview",
	Chat: "io.brainstorm.chat",
} as const;

export type AppId = (typeof APP)[keyof typeof APP];

type BrainstormWindow = {
	brainstorm: {
		vaults: {
			list: () => Promise<Array<{ id: string }>>;
			create: (opts: { name: string; path: string }) => Promise<unknown>;
			activate: (id: string) => Promise<unknown>;
			session: () => Promise<unknown>;
		};
		dev: {
			seedDemoApps: () => Promise<unknown>;
			seedPrebuiltApps: () => Promise<unknown>;
		};
		apps: { launch: (id: string) => Promise<void> };
	};
};

/** The tab strip is a shell-owned chrome view loaded from
 *  `…/renderer/chrome/tab-strip.html`. A container window now hosts this plus
 *  one app-renderer page per tab, so harness page-selection matches on URL. */
const TAB_STRIP_URL_FRAGMENT = "/chrome/tab-strip";
const DASHBOARD_URL_FRAGMENT = "/renderer/index.html";

export type FounderSession = {
	app: ElectronApplication;
	dashboard: Page;
	/** Launch an app window and return its app-renderer Page (console already
	 *  captured). With shell-drawn tabs an app window is a container hosting a
	 *  chrome strip + tab pages, so this selects the app page by URL. */
	openApp: (id: AppId) => Promise<Page>;
	/** The shell tab-strip page for the most recently opened container — used to
	 *  assert tab count / labels in the real-Electron window-management session. */
	tabStrip: () => Page | null;
	/** All app-renderer pages currently open for `id` (one per tab). */
	appPagesFor: (id: AppId) => Page[];
	/** Numbered screenshot into the session folder; returns its path. Captures at
	 *  CSS resolution (`scale: "css"`) so Retina 2× windows don't produce 2200px
	 *  images. Pass a `target` Locator to capture just that element/region. */
	shot: (page: Page, label: string, target?: Locator) => Promise<string>;
	/** Append a narration line to the session's notes.md. */
	note: (line: string) => void;
	/** Post a message to the live Northbound team chat as `speaker`, so the
	 *  collaboration is watchable in real time (`tail -f .sessions/team-chat.md`). */
	chat: (speaker: Speaker, message: string) => void;
	/** Close the shell and flush capture metadata. */
	finish: () => Promise<void>;
};

/**
 * Electron locks the user-data dir with a `SingletonLock` symlink whose target
 * is `<host>-<pid>`. A session and a manual `dogfood:open` window can't share
 * the vault. If a *live* process holds the lock, fail with a clear message; if
 * the lock is *stale* (the owning pid is gone — e.g. a crashed run), clear it
 * and continue.
 */
function assertVaultUnlocked(): void {
	const lock = join(NORTHBOUND_DATA_DIR, "SingletonLock");
	let target: string;
	try {
		target = readlinkSync(lock);
	} catch {
		return; // no lock → free
	}
	const pid = Number.parseInt(target.slice(target.lastIndexOf("-") + 1), 10);
	if (Number.isFinite(pid)) {
		try {
			process.kill(pid, 0); // throws if the pid is gone
			throw new Error(
				`Mira's vault is already open (pid ${pid}). Close the "dogfood:open" window before running a founder session — two Electron processes can't share one vault.`,
			);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
		}
	}
	// Stale lock from a dead process — clear the Singleton* trio and continue.
	for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
		rmSync(join(NORTHBOUND_DATA_DIR, f), { force: true });
	}
}

function wireConsole(page: Page, file: string, tag: string): void {
	page.on("console", (msg) => {
		try {
			appendFileSync(file, `[${tag}] ${msg.type()}: ${msg.text()}\n`);
		} catch {
			// best-effort capture
		}
	});
	page.on("pageerror", (err) => {
		try {
			appendFileSync(file, `[${tag}] pageerror: ${err.message}\n`);
		} catch {
			// best-effort capture
		}
	});
	// Capture failed/4xx resource requests WITH their URL — `console` messages
	// for these only say "Failed to load resource" with no URL, which is useless
	// for triage (F-007).
	page.on("requestfailed", (req) => {
		try {
			appendFileSync(file, `[${tag}] requestfailed: ${req.url()} (${req.failure()?.errorText})\n`);
		} catch {
			// best-effort
		}
	});
	page.on("response", (resp) => {
		if (resp.status() < 400) return;
		try {
			appendFileSync(file, `[${tag}] http${resp.status()}: ${resp.url()}\n`);
		} catch {
			// best-effort
		}
	});
}

/**
 * Start a founder session named `name` (kebab-case, e.g. "001-day-one").
 * Boots the persistent Northbound vault warm and returns drive helpers.
 */
export async function startSession(name: string): Promise<FounderSession> {
	mkdirSync(NORTHBOUND_DATA_DIR, { recursive: true });
	assertVaultUnlocked();
	const sessionDir = join(SESSIONS_ROOT, name);
	mkdirSync(sessionDir, { recursive: true });
	const consoleLog = join(sessionDir, "console.log");
	const notesFile = join(sessionDir, "notes.md");
	writeFileSync(consoleLog, "");
	writeFileSync(notesFile, `# Session ${name}\n\n`);

	const app = await _electron.launch({
		executablePath: ELECTRON_BIN,
		args: [MAIN_ENTRY, `--user-data-dir=${NORTHBOUND_DATA_DIR}`],
		cwd: SHELL_DIR,
		timeout: 120_000,
		env: shellLaunchEnv(),
	});

	// Capture the Electron MAIN-process stdout/stderr too — that's where the
	// shell logs boot markers, worker crashes, and capability/vault errors. The
	// renderer `console` events alone leave triage blind to a wedged worker or a
	// hung vault open (the failure mode that makes a session time out with an
	// empty notes file).
	const mainProc = app.process();
	mainProc.stdout?.on("data", (chunk: Buffer) => {
		try {
			appendFileSync(consoleLog, `[main] ${chunk.toString()}`);
		} catch {
			// best-effort
		}
	});
	mainProc.stderr?.on("data", (chunk: Buffer) => {
		try {
			appendFileSync(consoleLog, `[main:err] ${chunk.toString()}`);
		} catch {
			// best-effort
		}
	});

	const dashboard = await app.firstWindow({ timeout: 60_000 });
	wireConsole(dashboard, consoleLog, "dashboard");

	await dashboard.evaluate(
		async ({ vaultName, dataDir }) => {
			const bs = (window as unknown as BrainstormWindow).brainstorm;
			const list = await bs.vaults.list();
			let session = await bs.vaults.session();
			if (list.length === 0) {
				await bs.vaults.create({ name: vaultName, path: `${dataDir}/vault` });
				session = await bs.vaults.session();
			} else if (!session && list[0]) {
				await bs.vaults.activate(list[0].id);
				session = await bs.vaults.session();
			}
			if (!session) {
				throw new Error("founder harness: no active vault after setup");
			}
			// Ensure the first-party apps are installed so Mira can open them.
			// Install the bundles built once in global setup — re-seeding from
			// source per session rebuilt all 11 apps (~200s) and timed sessions
			// out before any of Mira's work ran.
			await bs.dev.seedPrebuiltApps();
		},
		{ vaultName: VAULT_NAME, dataDir: NORTHBOUND_DATA_DIR },
	);

	let shotCounter = 0;

	const isAppPage = (p: Page, id: AppId): boolean => {
		const url = p.url();
		return (
			url.includes(`/${id}/`) &&
			!url.includes(TAB_STRIP_URL_FRAGMENT) &&
			!url.includes(DASHBOARD_URL_FRAGMENT)
		);
	};
	const wired = new WeakSet<Page>();

	/** Poll the live page set for an app-renderer page matching `id` — the
	 *  container's chrome strip + tab pages all surface as Playwright pages, so a
	 *  bare `waitForEvent("window")` can hand back the wrong one. */
	const waitForAppPage = async (id: AppId, timeoutMs = 20_000): Promise<Page> => {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const hit = app.windows().find((p) => isAppPage(p, id));
			if (hit) {
				if (!wired.has(hit)) {
					wireConsole(hit, consoleLog, id.replace("io.brainstorm.", ""));
					wired.add(hit);
				}
				return hit;
			}
			await app.waitForEvent("window", { timeout: 1_000 }).catch(() => undefined);
		}
		throw new Error(`founder: no app page for ${id} after ${timeoutMs}ms`);
	};

	return {
		app,
		dashboard,
		openApp: async (id) => {
			await dashboard.evaluate(
				(appId) => (window as unknown as BrainstormWindow).brainstorm.apps.launch(appId),
				id,
			);
			return waitForAppPage(id);
		},
		tabStrip: () => app.windows().find((p) => p.url().includes(TAB_STRIP_URL_FRAGMENT)) ?? null,
		appPagesFor: (id) => app.windows().filter((p) => isAppPage(p, id)),
		shot: async (page, label, target) => {
			shotCounter += 1;
			const file = join(sessionDir, `${String(shotCounter).padStart(2, "0")}-${label}.png`);
			// `scale: "css"` captures at CSS px (1×) instead of device px (2× on
			// Retina) so images stay under the 2000px image-API limit + readable.
			// A capture must NEVER fail the whole session: a hidden / zero-size
			// surface (e.g. a collapsed single-tab strip) throws "0 width", and a
			// detached locator throws too. Record the miss and carry on.
			try {
				if (target) await target.screenshot({ path: file, scale: "css" });
				else await page.screenshot({ path: file, scale: "css" });
			} catch (error) {
				try {
					appendFileSync(notesFile, `(shot "${label}" skipped: ${(error as Error).message})\n`);
				} catch {
					// best-effort
				}
			}
			return file;
		},
		note: (line) => {
			try {
				appendFileSync(notesFile, `${line}\n`);
			} catch {
				// best-effort
			}
		},
		chat: (speaker, message) => postToTeamChat(speaker, message),
		finish: async () => {
			await app.close().catch(() => undefined);
		},
	};
}
