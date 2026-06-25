/**
 * MCP-server-side client for the visual worker. Spawns the Node worker on
 * first use, multiplexes JSON-RPC over its stdin/stdout, and exposes
 * `snapshot` / `list` / `shutdown` to the MCP tool handlers.
 *
 * Why this exists: the MCP server runs under Bun, but driving Playwright's
 * `_electron.launch` from a Bun process hangs (see `worker.ts`). The
 * worker runs under Node; this client is the seam.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { SnapshotInput, SnapshotResult } from "./session.ts";

const REPO_ROOT = (() => {
	const here = new URL(import.meta.url).pathname;
	const idx = here.indexOf("/tools/mcp-server/");
	if (idx < 0) throw new Error("visual client: cannot locate repo root");
	return here.slice(0, idx);
})();

const WORKER_ENTRY = join(REPO_ROOT, "tools", "mcp-server", "src", "visual", "worker.ts");

type Pending = {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
};

let worker: ChildProcessWithoutNullStreams | null = null;
let nextId = 1;
const pending = new Map<string, Pending>();
let workerReady: Promise<void> | null = null;
let spawning = false;

function ensureWorker(): Promise<void> {
	if (worker && !worker.killed) return workerReady ?? Promise.resolve();
	if (spawning && workerReady) return workerReady;
	spawning = true;
	workerReady = new Promise<void>((resolve, reject) => {
		const proc = spawn("node", [WORKER_ENTRY], {
			cwd: REPO_ROOT,
			stdio: ["pipe", "pipe", "inherit"],
			env: { ...process.env },
		});
		worker = proc;
		const rl = createInterface({ input: proc.stdout });
		rl.on("line", (line) => {
			const trimmed = line.trim();
			if (!trimmed) return;
			let reply: { id: string; ok: boolean; result?: unknown; error?: string };
			try {
				reply = JSON.parse(trimmed);
			} catch {
				return;
			}
			if (reply.id === "_ready") {
				spawning = false;
				resolve();
				return;
			}
			const slot = pending.get(reply.id);
			if (!slot) return;
			pending.delete(reply.id);
			if (reply.ok) slot.resolve(reply.result);
			else slot.reject(new Error(reply.error ?? "unknown worker error"));
		});
		proc.on("exit", (code) => {
			const wasReady = !spawning;
			worker = null;
			workerReady = null;
			spawning = false;
			for (const [, slot] of pending) {
				slot.reject(new Error(`visual worker exited (code=${code})`));
			}
			pending.clear();
			if (!wasReady) reject(new Error(`visual worker exited during boot (code=${code})`));
		});
		proc.on("error", (err) => {
			spawning = false;
			workerReady = null;
			reject(err);
		});
	});
	return workerReady;
}

async function call<T>(op: "snapshot" | "list" | "shutdown", args?: unknown): Promise<T> {
	await ensureWorker();
	const proc = worker;
	if (!proc) throw new Error("visual worker not running");
	const id = String(nextId++);
	const payload = JSON.stringify({ id, op, args });
	return new Promise<T>((resolve, reject) => {
		pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
		proc.stdin.write(`${payload}\n`, (err) => {
			if (err) {
				pending.delete(id);
				reject(err);
			}
		});
	});
}

export async function snapshot(input: SnapshotInput): Promise<SnapshotResult> {
	return call<SnapshotResult>("snapshot", input);
}

export async function listSpecsViaWorker(): Promise<
	Array<{ kind: "shell" | "app"; id: string; label: string; states: string[] }>
> {
	const result = await call<{
		specs: Array<{ kind: "shell" | "app"; id: string; label: string; states: string[] }>;
	}>("list");
	return result.specs;
}

export async function shutdownWorker(): Promise<void> {
	if (!worker) return;
	try {
		await call("shutdown");
	} catch {}
	try {
		worker?.kill();
	} catch {}
	worker = null;
	workerReady = null;
}

let exitHookInstalled = false;
export function installClientExitHook(): void {
	if (exitHookInstalled) return;
	exitHookInstalled = true;
	const kill = () => {
		if (!worker) return;
		try {
			worker.kill();
		} catch {}
	};
	process.on("exit", kill);
	process.on("SIGINT", () => {
		kill();
		process.exit(130);
	});
	process.on("SIGTERM", () => {
		kill();
		process.exit(143);
	});
}
