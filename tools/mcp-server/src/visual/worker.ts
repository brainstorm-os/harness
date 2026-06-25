/**
 * Node child process that owns the long-running Playwright + Electron
 * session. The parent (the MCP server, which runs under Bun) spawns this
 * worker on first `visual.snapshot` call and reuses it for all later
 * calls.
 *
 * Why a separate Node process: driving `@playwright/test`'s `_electron`
 * from inside a Bun process hangs on the debugger WS handshake (the
 * Electron + Node inspectors come up but Playwright's WS client never
 * connects). Spawning under Node sidesteps the bun/Playwright integration
 * gap and keeps the long-running-session UX (~1s per snapshot after the
 * first one).
 *
 * Protocol: line-delimited JSON over stdin/stdout.
 *   stdin  : `{ "id": "1", "op": "snapshot"|"list"|"shutdown", "args": {...} }`
 *   stdout : `{ "id": "1", "ok": true, "result": {...} }` or
 *            `{ "id": "1", "ok": false, "error": "..." }`
 *
 * Run via `node tools/mcp-server/src/visual/worker.ts` (Node 22+ runs .ts
 * with --experimental-strip-types; 25+ does it by default).
 */

import { createInterface } from "node:readline";
import { installExitHook, listSpecs, shutdown, snapshot } from "./session.ts";

type Command =
	| { id: string; op: "snapshot"; args: Parameters<typeof snapshot>[0] }
	| { id: string; op: "list"; args?: undefined }
	| { id: string; op: "shutdown"; args?: undefined };

type Reply = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string };

function send(reply: Reply): void {
	process.stdout.write(`${JSON.stringify(reply)}\n`);
}

async function handle(cmd: Command): Promise<void> {
	try {
		switch (cmd.op) {
			case "snapshot": {
				const result = await snapshot(cmd.args);
				send({ id: cmd.id, ok: true, result });
				return;
			}
			case "list": {
				send({ id: cmd.id, ok: true, result: { specs: listSpecs() } });
				return;
			}
			case "shutdown": {
				await shutdown();
				send({ id: cmd.id, ok: true, result: { ok: true } });
				return;
			}
		}
	} catch (err) {
		send({ id: cmd.id, ok: false, error: (err as Error).message });
	}
}

function main(): void {
	installExitHook();
	const rl = createInterface({ input: process.stdin });
	rl.on("line", (line) => {
		const trimmed = line.trim();
		if (!trimmed) return;
		let cmd: Command;
		try {
			cmd = JSON.parse(trimmed) as Command;
		} catch (err) {
			send({ id: "_parse", ok: false, error: `bad JSON: ${(err as Error).message}` });
			return;
		}
		void handle(cmd);
	});
	rl.on("close", () => {
		void shutdown().finally(() => process.exit(0));
	});
	process.stdout.write(`${JSON.stringify({ id: "_ready", ok: true, result: { ready: true } })}\n`);
}

main();
