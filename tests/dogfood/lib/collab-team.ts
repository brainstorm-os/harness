/**
 * Collab-C4-live — the two-shell (two-user) dogfooding harness.
 *
 * Where `founder.ts` boots ONE shell against Mira's single persistent vault,
 * this boots N shells — one per teammate — each with its OWN user-data dir and
 * therefore its OWN sovereign identity, all pointed at a shared in-process
 * relay (`tests/soak/lib/launch-relay.ts`). They share entities through the
 * C1/C2 flow over the `dev:collab:*` bridge (`main/ipc/collab-dev-handlers.ts`)
 * and converge their persisted Y.Docs through the encrypted wire path — the
 * live, real-Electron analog of the in-process `collab-dev-bridge.test.ts`.
 *
 * A scenario reads as the story (Mira shares a brief with Marcus; both edit;
 * Mira revokes); the harness captures what actually happened (per-shell
 * screenshots + console) and narrates it into the team chat so the session is
 * watchable live (`tail -f tests/dogfood/.sessions/team-chat.md`).
 *
 * Each shell is launched with BOTH dev gates: `BRAINSTORM_COLLAB_DEBUG=1` (the
 * share bridge) and `BRAINSTORM_SOAK_DEBUG=1` (reuses `dev.setSyncRelay` /
 * `dev.waitForRelayOpen` to wire the relay without a Settings round-trip — no
 * point duplicating those channels under a second gate).
 */

import { Buffer } from "node:buffer";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/** Theme ids mirrored from `@brainstorm/tokens` (`ThemeName` enum), inlined so
 *  the dogfood harness carries NO runtime import of a shell workspace package —
 *  the post-split harness can't resolve `@brainstorm/tokens`, and a value import
 *  of it silently broke the entire collab harness. Values must stay in sync with
 *  ../shell/packages/tokens/src/themes.ts. */
type ThemeName = "nord" | "rose" | "sepia" | "forest" | "high-contrast" | "midnight";
import { type ElectronApplication, type Page, _electron } from "@playwright/test";
import { type RelayHandle, launchRelay } from "../../soak/lib/launch-relay";
import { type Speaker, postToTeamChat } from "./team-chat";

/** Runtime mirror of `AccessRole` (../shell/.../collab/access-record.ts). The
 *  harness must not VALUE-import shell main-process source — that drags in
 *  yjs/@noble, which are absent from the thin harness node_modules post-split
 *  (importing the enum as a value is what broke every collab spec). Specs import
 *  this `AccessRole` from the lib instead. Keep the values in sync with the enum. */
export const AccessRole = { Owner: "owner", Editor: "editor", Viewer: "viewer" } as const;
export type AccessRole = (typeof AccessRole)[keyof typeof AccessRole];
import type {
	CollabAccessView,
	CollabIdentity,
} from "../../../packages/shell/src/main/collab/collab-dev-bridge";
import type { ShareInvite } from "../../../packages/shell/src/main/collab/share-invite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SHELL_DIR = join(REPO_ROOT, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

/** Per-teammate vault roots — separate from Mira's single-vault Northbound desk
 *  (`tests/dogfood/.data`) so the collab scenario never contends on its
 *  SingletonLock. Gitignored; one sub-dir per persona key. */
export const COLLAB_DATA_ROOT = join(REPO_ROOT, "tests", "dogfood", ".data-collab");
const SESSIONS_ROOT = join(REPO_ROOT, "tests", "dogfood", ".sessions");

export type CollabPersona = {
	/** kebab key — names the user-data dir + console tag (e.g. "mira"). */
	key: string;
	/** display name (presence + team-chat). */
	name: string;
	/** team-chat speaker identity. */
	speaker: Speaker;
	/** Per-persona vault theme — set on the shell at launch so each teammate's
	 *  window is visibly theirs (the "different themes in the vault" goal). When
	 *  absent the shell keeps its default theme. */
	theme?: ThemeName;
};

/** The suggested Northbound theme-per-employee mapping (the dogfood goal in
 *  docs/dogfood/README.md). Any distinct assignment works; this is the default
 *  a collab session reuses so the team reads at a glance. */
export const NORTHBOUND_THEMES: Readonly<Record<string, ThemeName>> = {
	mira: "nord",
	marcus: "rose",
	priya: "sepia",
	dana: "forest",
	sol: "high-contrast",
	kai: "midnight",
};

type CollabDevApi = {
	whoami: () => Promise<CollabIdentity>;
	createInvite: (label: string) => Promise<ShareInvite>;
	provisionEntity: (
		entityId: string,
		type: string,
		properties?: Record<string, unknown>,
	) => Promise<{ ok: boolean }>;
	installShareReceiver: (entityId: string, type: string) => Promise<{ ok: boolean }>;
	share: (
		entityId: string,
		type: string,
		invite: ShareInvite,
		role: AccessRole,
	) => Promise<CollabAccessView[]>;
	shareCollection: (
		entityId: string,
		type: string,
		invite: ShareInvite,
		role: AccessRole,
	) => Promise<CollabAccessView[]>;
	editText: (entityId: string, text: string) => Promise<{ ok: boolean }>;
	revoke: (entityId: string, memberB64: string) => Promise<{ revoked: boolean }>;
	access: (entityId: string) => Promise<CollabAccessView[]>;
	stateVector: (entityId: string) => Promise<Uint8Array>;
	readText: (entityId: string) => Promise<string>;
};

type CollabWindow = {
	brainstorm: {
		vaults: {
			list: () => Promise<Array<{ id: string }>>;
			create: (opts: { name: string; path: string }) => Promise<unknown>;
			activate: (id: string) => Promise<unknown>;
			session: () => Promise<unknown>;
		};
		dev: {
			setSyncRelay: (url: string | null) => Promise<{ changed: boolean }>;
			waitForRelayOpen: (timeoutMs?: number) => Promise<{ open: boolean }>;
			collab: CollabDevApi;
		};
		dashboard: {
			setTheme: (theme: string) => Promise<void>;
		};
	};
};

export type CollabShell = {
	persona: CollabPersona;
	app: ElectronApplication;
	dashboard: Page;
	/** This shell's sovereign identity (cached after first call). */
	whoami: () => Promise<CollabIdentity>;
	createInvite: (label: string) => Promise<ShareInvite>;
	provisionEntity: (
		entityId: string,
		type: string,
		properties?: Record<string, unknown>,
	) => Promise<void>;
	installShareReceiver: (entityId: string, type: string) => Promise<void>;
	share: (
		entityId: string,
		type: string,
		invite: ShareInvite,
		role: AccessRole,
	) => Promise<CollabAccessView[]>;
	/** Collection share (design 71): share the container + cascade onto its
	 *  existing children. */
	shareCollection: (
		entityId: string,
		type: string,
		invite: ShareInvite,
		role: AccessRole,
	) => Promise<CollabAccessView[]>;
	editText: (entityId: string, text: string) => Promise<void>;
	revoke: (entityId: string, memberB64: string) => Promise<boolean>;
	access: (entityId: string) => Promise<CollabAccessView[]>;
	readText: (entityId: string) => Promise<string>;
	stateVectorHex: (entityId: string) => Promise<string>;
	shot: (label: string) => Promise<string>;
	note: (line: string) => void;
	chat: (message: string) => void;
	finish: () => Promise<void>;
};

export type CollabTeam = {
	shells: CollabShell[];
	relay: RelayHandle;
	byKey: (key: string) => CollabShell;
	/** Poll until every named shell's persisted state vector matches. */
	awaitConverged: (entityId: string, shells: CollabShell[], timeoutMs?: number) => Promise<void>;
	finishAll: () => Promise<void>;
};

function wireConsole(page: Page, file: string, tag: string): void {
	page.on("console", (msg) => {
		try {
			appendFileSync(file, `[${tag}:${msg.type()}] ${msg.text()}\n`);
		} catch {
			// best-effort
		}
	});
	page.on("pageerror", (err) => {
		try {
			appendFileSync(file, `[${tag}:pageerror] ${err.message}\n`);
		} catch {
			// best-effort
		}
	});
}

/**
 * Boot a single shell for `persona`, wired to `relayUrl`. `freshVault=false`
 * relaunches against the persona's EXISTING user-data dir (keystore + vault.json
 * intact) — the load-bearing primitive for the 10.14 wipe-and-restore spec,
 * which closes a shell, deletes its `vault/data/entities.db` + `docs/`, then
 * relaunches here to drive a cold restore from the durable node.
 */
export async function launchCollabShell(
	persona: CollabPersona,
	relayUrl: string,
	sessionName: string,
	freshVault: boolean,
): Promise<CollabShell> {
	const dataDir = join(COLLAB_DATA_ROOT, persona.key);
	if (freshVault) rmSync(dataDir, { recursive: true, force: true });
	mkdirSync(dataDir, { recursive: true });
	const sessionDir = join(SESSIONS_ROOT, sessionName);
	mkdirSync(sessionDir, { recursive: true });
	const consoleLog = join(sessionDir, `${persona.key}.console.log`);
	writeFileSync(consoleLog, "");

	const app = await _electron.launch({
		executablePath: ELECTRON_BIN,
		args: [MAIN_ENTRY, `--user-data-dir=${dataDir}`],
		cwd: SHELL_DIR,
		timeout: 120_000,
		env: {
			...process.env,
			BRAINSTORM_DEV_INSECURE_CREDENTIALS: "1",
			BRAINSTORM_AUTO_SEED: "0",
			BRAINSTORM_NO_FOCUS: "1",
			BRAINSTORM_COLLAB_DEBUG: "1",
			BRAINSTORM_SOAK_DEBUG: "1",
			NODE_ENV: "production",
		},
	});

	const mainProc = app.process();
	const tee = (prefix: string) => (chunk: Buffer) => {
		try {
			appendFileSync(consoleLog, `${prefix} ${chunk.toString()}`);
		} catch {
			// best-effort
		}
	};
	mainProc.stdout?.on("data", tee("[main]"));
	mainProc.stderr?.on("data", tee("[main:err]"));

	const dashboard = await app.firstWindow({ timeout: 60_000 });
	wireConsole(dashboard, consoleLog, `${persona.key}/dashboard`);

	// Create/activate this teammate's vault, then point it at the shared relay.
	await dashboard.evaluate(
		async ({ name, dir, url, theme }) => {
			const bs = (window as unknown as CollabWindow).brainstorm;
			const list = await bs.vaults.list();
			let session = await bs.vaults.session();
			if (list.length === 0) {
				await bs.vaults.create({ name, path: `${dir}/vault` });
				session = await bs.vaults.session();
			} else if (!session && list[0]) {
				await bs.vaults.activate(list[0].id);
				session = await bs.vaults.session();
			}
			if (!session) throw new Error("collab-team: no active vault after setup");
			await bs.dev.setSyncRelay(url);
			await bs.dev.waitForRelayOpen(10_000);
			// Each teammate's window is visibly theirs — the per-persona theme goal.
			if (theme) await bs.dashboard.setTheme(theme);
		},
		{
			name: `Northbound (${persona.name})`,
			dir: dataDir,
			url: relayUrl,
			theme: persona.theme ?? null,
		},
	);

	const collab = <K extends keyof CollabDevApi>(
		method: K,
		...args: Parameters<CollabDevApi[K]>
	): Promise<Awaited<ReturnType<CollabDevApi[K]>>> =>
		dashboard.evaluate(
			({ m, a }) => {
				const api = (window as unknown as CollabWindow).brainstorm.dev.collab as unknown as Record<
					string,
					(...xs: unknown[]) => Promise<unknown>
				>;
				return api[m](...a);
			},
			{ m: method as string, a: args as unknown[] },
		) as Promise<Awaited<ReturnType<CollabDevApi[K]>>>;

	let shotCounter = 0;
	let cachedIdentity: CollabIdentity | null = null;

	return {
		persona,
		app,
		dashboard,
		whoami: async () => {
			if (!cachedIdentity) cachedIdentity = await collab("whoami");
			return cachedIdentity;
		},
		createInvite: (label) => collab("createInvite", label),
		provisionEntity: async (entityId, type, properties) => {
			await collab("provisionEntity", entityId, type, properties);
		},
		installShareReceiver: async (entityId, type) => {
			await collab("installShareReceiver", entityId, type);
		},
		share: (entityId, type, invite, role) => collab("share", entityId, type, invite, role),
		shareCollection: (entityId, type, invite, role) =>
			collab("shareCollection", entityId, type, invite, role),
		editText: async (entityId, text) => {
			await collab("editText", entityId, text);
		},
		revoke: async (entityId, memberB64) => (await collab("revoke", entityId, memberB64)).revoked,
		access: (entityId) => collab("access", entityId),
		readText: (entityId) => collab("readText", entityId),
		// State vectors cross the evaluate boundary as a hex string (a raw
		// Uint8Array would be JSON-serialized into a lossy {0:..,1:..} object).
		stateVectorHex: (entityId) =>
			dashboard.evaluate(async (id) => {
				const sv = await (window as unknown as CollabWindow).brainstorm.dev.collab.stateVector(id);
				return Array.from(sv)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
			}, entityId),
		shot: async (label) => {
			shotCounter += 1;
			const file = join(
				sessionDir,
				`${persona.key}-${String(shotCounter).padStart(2, "0")}-${label}.png`,
			);
			try {
				await dashboard.screenshot({ path: file, scale: "css" });
			} catch {
				// A capture must never fail the session.
			}
			return file;
		},
		note: (line) => {
			try {
				appendFileSync(join(sessionDir, `${persona.key}.notes.md`), `${line}\n`);
			} catch {
				// best-effort
			}
		},
		chat: (message) => postToTeamChat(persona.speaker, message),
		finish: async () => {
			await app.close().catch(() => undefined);
		},
	};
}

/**
 * Boot a relay + one shell per persona, all wired to the relay. `freshVaults`
 * (default true) wipes each teammate's vault dir first so a scenario starts
 * from a clean slate; pass false to accumulate across runs (founder-style
 * continuity).
 */
export async function startCollabTeam(
	personas: CollabPersona[],
	opts: {
		sessionName: string;
		freshVaults?: boolean;
		/** SYNC-2 dogfood — use an already-launched relay (e.g. the real durable
		 *  node from `launch-durable-node.ts`) instead of the in-process
		 *  `relay-server`. When set, the caller owns its lifetime (`finishAll`
		 *  won't stop it). */
		relay?: RelayHandle;
	} = { sessionName: "collab" },
): Promise<CollabTeam> {
	mkdirSync(COLLAB_DATA_ROOT, { recursive: true });
	const sessionDir = join(SESSIONS_ROOT, opts.sessionName);
	mkdirSync(sessionDir, { recursive: true });
	const ownsRelay = !opts.relay;
	const relay =
		opts.relay ??
		(await launchRelay({
			auditLogPath: join(sessionDir, "relay-audit.log"),
			stdioCapturePath: join(sessionDir, "relay.log"),
		}));

	const shells: CollabShell[] = [];
	try {
		for (const persona of personas) {
			shells.push(
				await launchCollabShell(persona, relay.url, opts.sessionName, opts.freshVaults ?? true),
			);
		}
	} catch (error) {
		await Promise.all(shells.map((s) => s.finish()));
		if (ownsRelay) await relay.stop();
		throw error;
	}

	return {
		shells,
		relay,
		byKey: (key) => {
			const hit = shells.find((s) => s.persona.key === key);
			if (!hit) throw new Error(`collab-team: no shell for persona "${key}"`);
			return hit;
		},
		awaitConverged: async (entityId, group, timeoutMs = 8_000) => {
			const deadline = Date.now() + timeoutMs;
			while (Date.now() < deadline) {
				const vectors = await Promise.all(group.map((s) => s.stateVectorHex(entityId)));
				if (vectors.every((v) => v === vectors[0])) return;
				await new Promise((r) => setTimeout(r, 100));
			}
			throw new Error(`collab-team: ${entityId} did not converge within ${timeoutMs}ms`);
		},
		finishAll: async () => {
			await Promise.all(shells.map((s) => s.finish()));
			if (ownsRelay) await relay.stop();
		},
	};
}

/** Hex of a state vector — handy for ad-hoc equality logging in specs. */
export function svHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("hex");
}
