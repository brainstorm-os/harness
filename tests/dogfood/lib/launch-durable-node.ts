/**
 * SYNC-2 dogfood — launch the REAL `../brainstorm-sync` durable node as a child
 * process, so the shipped Electron shells exchange + DURABLY PERSIST encrypted
 * frames through the deployable zero-knowledge node (not the product's in-
 * process `relay-server`). Same `RelayHandle` shape as `launchRelay`, plus the
 * `storageDir` so a spec can assert the node persisted real product traffic.
 *
 * The node is the out-of-repo sibling (`../brainstorm-sync`); it runs under Bun
 * and reads `PORT` / `STORAGE_DIR` from the env (see its `main.ts`/`readConfig`).
 */

import { type ChildProcess, spawn } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SYNC_MAIN = resolve(REPO_ROOT, "..", "brainstorm-sync", "src", "main.ts");

export type DurableNodeHandle = {
	readonly port: number;
	readonly url: string;
	readonly storageDir: string;
	stop(): Promise<void>;
};

export async function launchDurableNode(options: {
	storageDir: string;
	port?: number;
}): Promise<DurableNodeHandle> {
	const port = options.port ?? (await findFreePort());
	const child = spawn("bun", [SYNC_MAIN], {
		cwd: dirname(SYNC_MAIN),
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			PORT: String(port),
			STORAGE_DIR: options.storageDir,
			LOG_LEVEL: "info",
		},
	});

	const out: string[] = [];
	const err: string[] = [];
	child.stdout?.on("data", (c) => out.push(String(c)));
	child.stderr?.on("data", (c) => err.push(String(c)));

	await waitForListen(child, port, out, err, 15_000);

	return {
		port,
		url: `ws://127.0.0.1:${port}`,
		storageDir: options.storageDir,
		stop: () => stopChild(child),
	};
}

function waitForListen(
	child: ChildProcess,
	port: number,
	out: readonly string[],
	err: readonly string[],
	timeoutMs: number,
): Promise<void> {
	return new Promise((resolveFn, rejectFn) => {
		const deadline = Date.now() + timeoutMs;
		let done = false;
		const onExit = (code: number | null) => {
			if (done) return;
			done = true;
			rejectFn(
				new Error(
					`durable node exited (${code}) before listening; out=${out.join("")} err=${err.join("")}`,
				),
			);
		};
		child.once("exit", onExit);
		const probe = (): void => {
			const sock = createConnection({ host: "127.0.0.1", port }, () => {
				sock.end();
				if (done) return;
				done = true;
				child.off("exit", onExit);
				resolveFn();
			});
			sock.on("error", () => {
				if (done) return;
				if (Date.now() > deadline) {
					done = true;
					child.off("exit", onExit);
					rejectFn(new Error(`durable node did not listen on :${port} within ${timeoutMs}ms`));
					return;
				}
				setTimeout(probe, 150);
			});
		};
		setTimeout(probe, 100);
	});
}

async function stopChild(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return;
	child.kill("SIGTERM");
	await new Promise<void>((res) => {
		const t = setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {}
			res();
		}, 2_000);
		child.once("exit", () => {
			clearTimeout(t);
			res();
		});
	});
}

function findFreePort(): Promise<number> {
	return new Promise((resolveFn, rejectFn) => {
		const server = createServer();
		server.unref();
		server.on("error", rejectFn);
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (addr && typeof addr === "object") {
				const p = addr.port;
				server.close(() => resolveFn(p));
			} else {
				server.close();
				rejectFn(new Error("findFreePort: unexpected address shape"));
			}
		});
	});
}
