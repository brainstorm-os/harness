/**
 * Long-running Playwright + Electron session that backs the
 * `visual.snapshot` MCP tool. The first MCP call boots Electron + creates
 * a temp vault + seeds demo apps; subsequent calls reuse the same shell,
 * each one launching the requested app window, capturing a PNG, then
 * closing the window.
 *
 * Why long-running: per-call boot is ~25s (electron + vault create + seed).
 * Reusing the shell drops per-call cost to ~1s. The MCP server is itself a
 * long-running stdio process driven by Claude Code, so the lifetime
 * matches.
 *
 * Lifecycle:
 *   - Lazy boot on first `snapshot()`.
 *   - All calls serialized via a single in-flight promise chain (one
 *     Electron, one dashboard, one app window at a time).
 *   - Idle timeout (default 10 min) auto-shuts-down. Each call resets it.
 *   - `shutdown()` is exposed via `visual.shutdown` and is also called on
 *     `process.on("exit")`.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, type Page, _electron } from "@playwright/test";
import {
	APP_SPECS,
	type AppVisualSpec,
	SHELL_SPECS,
	type ShellVisualSpec,
	type VisualSpec,
	type VisualState,
	type VisualTheme,
} from "../../../../tests/visual/lib/state-registry.ts";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

type BootedSession = {
	app: ElectronApplication;
	dashboard: Page;
	userDataDir: string;
};

let session: BootedSession | null = null;
let bootPromise: Promise<BootedSession> | null = null;
let mutexTail: Promise<unknown> = Promise.resolve();
let idleTimer: NodeJS.Timeout | null = null;

const REPO_ROOT = (() => {
	const here = new URL(import.meta.url).pathname;
	const idx = here.indexOf("/tools/mcp-server/");
	if (idx < 0) throw new Error(`visual session: cannot locate repo root from ${here}`);
	return here.slice(0, idx);
})();

const SHELL_DIR = join(REPO_ROOT, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

function resetIdleTimer(): void {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = setTimeout(() => {
		void shutdown().catch((err) => {
			console.error("[visual] idle shutdown failed:", err);
		});
	}, IDLE_TIMEOUT_MS);
}

async function boot(): Promise<BootedSession> {
	if (session) return session;
	if (bootPromise) return bootPromise;
	bootPromise = (async () => {
		const userDataDir = mkdtempSync(join(tmpdir(), "bs-mcp-visual-"));
		const app = await _electron.launch({
			executablePath: ELECTRON_BIN,
			args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
			cwd: SHELL_DIR,
			timeout: 60_000,
			env: {
				...process.env,
				BRAINSTORM_DEV_INSECURE_CREDENTIALS: "1",
				BRAINSTORM_AUTO_SEED: "0",
				NODE_ENV: "production",
			},
		});
		const dashboard = await app.firstWindow({ timeout: 60_000 });
		await dashboard.waitForLoadState("load", { timeout: 60_000 });
		await dashboard.evaluate(
			async ({ userDataDir }) => {
				type Api = {
					vaults: {
						list: () => Promise<unknown[]>;
						create: (opts: { name: string; path: string }) => Promise<unknown>;
						activate: (id: string) => Promise<unknown>;
						session: () => Promise<unknown>;
					};
					dev: { seedDemoApps: () => Promise<unknown> };
				};
				const bs = (window as unknown as { brainstorm: Api }).brainstorm;
				const list = (await bs.vaults.list()) as Array<{ id: string }>;
				let s = await bs.vaults.session();
				if (list.length === 0) {
					await bs.vaults.create({ name: "mcp-visual-fixture", path: `${userDataDir}/vault` });
					s = await bs.vaults.session();
				} else if (!s && list[0]) {
					await bs.vaults.activate(list[0].id);
					s = await bs.vaults.session();
				}
				if (!s) throw new Error("visual session: no active vault after setup");
				await bs.dev.seedDemoApps();
			},
			{ userDataDir },
		);
		await dashboard.reload({ waitUntil: "domcontentloaded" });
		await dashboard.waitForSelector(".dashboard", { state: "visible", timeout: 30_000 });
		const booted: BootedSession = { app, dashboard, userDataDir };
		session = booted;
		bootPromise = null;
		return booted;
	})();
	return bootPromise;
}

function findSpec(idOrShort: string): VisualSpec | null {
	const shell = SHELL_SPECS.find((s) => s.id === idOrShort);
	if (shell) return shell;
	const app =
		APP_SPECS.find((a) => a.appId === idOrShort) ??
		APP_SPECS.find((a) => a.appId.endsWith(`.${idOrShort}`)) ??
		APP_SPECS.find((a) => a.label.toLowerCase() === idOrShort.toLowerCase());
	return app ?? null;
}

function pickState(spec: VisualSpec, stateName?: string): VisualState | null {
	if (!stateName) return spec.states[0] ?? null;
	return spec.states.find((s) => s.name === stateName) ?? null;
}

async function withMutex<T>(fn: () => Promise<T>): Promise<T> {
	const next = mutexTail.then(fn, fn);
	mutexTail = next.catch(() => {});
	return next;
}

export type SnapshotInput = {
	app: string;
	state?: string;
	theme?: VisualTheme;
	outPath: string;
};

export type SnapshotResult = {
	ok: true;
	path: string;
	spec: string;
	state: string;
	theme: VisualTheme;
	durationMs: number;
};

export async function snapshot(input: SnapshotInput): Promise<SnapshotResult> {
	return withMutex(async () => {
		resetIdleTimer();
		const t0 = Date.now();
		const spec = findSpec(input.app);
		if (!spec) throw new Error(`visual.snapshot: unknown app "${input.app}"`);
		const state = pickState(spec, input.state);
		if (!state) {
			throw new Error(
				`visual.snapshot: spec "${input.app}" has no state "${input.state}". Available: ${spec.states.map((s) => s.name).join(", ")}`,
			);
		}
		const theme: VisualTheme = input.theme ?? "light";
		const s = await boot();
		await s.dashboard.evaluate(async (mode) => {
			type Api = { dashboard: { setAppearanceMode: (m: "light" | "dark" | "auto") => Promise<void> } };
			await (window as unknown as { brainstorm: Api }).brainstorm.dashboard.setAppearanceMode(mode);
		}, theme);
		await s.dashboard.waitForTimeout(150);
		if (spec.kind === "shell") {
			if (state.setup) await state.setup(s.dashboard);
			await s.dashboard.waitForTimeout(250);
			await s.dashboard.screenshot({ path: input.outPath, type: "png" });
		} else {
			await captureApp(s, spec as AppVisualSpec, state, input.outPath);
		}
		const specKey =
			spec.kind === "shell" ? (spec as ShellVisualSpec).id : (spec as AppVisualSpec).appId;
		return {
			ok: true as const,
			path: input.outPath,
			spec: specKey,
			state: state.name,
			theme,
			durationMs: Date.now() - t0,
		};
	});
}

async function captureApp(
	s: BootedSession,
	spec: AppVisualSpec,
	state: VisualState,
	outPath: string,
): Promise<void> {
	const newWindow = s.app.waitForEvent("window", { timeout: 30_000 });
	await s.dashboard.evaluate((appId) => {
		type Api = { apps: { launch: (id: string) => Promise<void> } };
		return (window as unknown as { brainstorm: Api }).brainstorm.apps.launch(appId);
	}, spec.appId);
	const appWindow = await newWindow;
	try {
		await appWindow.waitForLoadState("load", { timeout: 30_000 });
		await appWindow
			.waitForSelector(".app-header, body > div", { state: "attached", timeout: 5_000 })
			.catch(() => {});
		await appWindow.waitForTimeout(150);
		if (state.setup) await state.setup(appWindow);
		await appWindow.waitForTimeout(250);
		await appWindow.screenshot({ path: outPath, type: "png" });
	} finally {
		await appWindow.close().catch(() => {});
	}
}

export function listSpecs(): Array<{
	kind: "shell" | "app";
	id: string;
	label: string;
	states: string[];
}> {
	const out: Array<{ kind: "shell" | "app"; id: string; label: string; states: string[] }> = [];
	for (const s of SHELL_SPECS) {
		out.push({ kind: "shell", id: s.id, label: s.label, states: s.states.map((x) => x.name) });
	}
	for (const a of APP_SPECS) {
		out.push({ kind: "app", id: a.appId, label: a.label, states: a.states.map((x) => x.name) });
	}
	return out;
}

export async function shutdown(): Promise<void> {
	if (idleTimer) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}
	const s = session;
	session = null;
	bootPromise = null;
	if (!s) return;
	try {
		await s.app.close();
	} catch {}
	try {
		rmSync(s.userDataDir, { recursive: true, force: true });
	} catch {}
}

let exitHookInstalled = false;
export function installExitHook(): void {
	if (exitHookInstalled) return;
	exitHookInstalled = true;
	const hook = () => {
		if (!session) return;
		try {
			session.app.close();
		} catch {}
		try {
			rmSync(session.userDataDir, { recursive: true, force: true });
		} catch {}
	};
	process.on("exit", hook);
	process.on("SIGINT", () => {
		hook();
		process.exit(130);
	});
	process.on("SIGTERM", () => {
		hook();
		process.exit(143);
	});
}
