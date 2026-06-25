/**
 * MCP tool registrations for the visual harness. Wraps the long-running
 * Playwright session in `../visual/session.ts`.
 *
 * Tools:
 *   - `visual.list`     — enumerate available specs + their states.
 *   - `visual.snapshot` — boot the shell if needed, capture (app × state ×
 *                         theme) as a PNG, return the path.
 *   - `visual.shutdown` — explicitly close the running shell.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	installClientExitHook,
	listSpecsViaWorker,
	shutdownWorker,
	snapshot,
} from "../visual/client.ts";

const REPO_ROOT = (() => {
	const here = new URL(import.meta.url).pathname;
	const idx = here.indexOf("/tools/mcp-server/");
	if (idx < 0) throw new Error(`visual tool: cannot locate repo root from ${here}`);
	return here.slice(0, idx);
})();

const DEFAULT_OUT_DIR = join(REPO_ROOT, ".screenshots", "mcp");

export function registerVisualTools(server: McpServer): void {
	installClientExitHook();

	server.registerTool(
		"visual.list",
		{
			description:
				"List every visual spec the harness can capture: dashboard (shell) and each first-party app (e.g. io.brainstorm.notes), along with their named states (e.g. files has list/grid/gallery).",
			inputSchema: {},
		},
		async () => {
			const specs = await listSpecsViaWorker();
			return {
				content: [{ type: "text", text: JSON.stringify({ specs }, null, 2) }],
			};
		},
	);

	server.registerTool(
		"visual.snapshot",
		{
			description:
				"Capture a PNG of one (app × state × theme). Boots the shell on first call and reuses it; per-call cost ≈ 1s after boot. App is either the shell spec id ('dashboard'), the full app id ('io.brainstorm.notes'), the short id ('notes'), or the label ('Notes'). State defaults to the first state in the spec. Theme defaults to 'light'. Returns the absolute path to the written PNG.",
			inputSchema: {
				app: z
					.string()
					.describe("Spec id — 'dashboard', 'io.brainstorm.notes', 'notes', or label like 'Notes'."),
				state: z
					.string()
					.optional()
					.describe("State name within the spec (e.g. 'grid' for Files). Defaults to the first state."),
				theme: z.enum(["light", "dark"]).optional().describe("Appearance mode. Defaults to 'light'."),
				outPath: z
					.string()
					.optional()
					.describe(
						"Where to write the PNG. Defaults to .screenshots/mcp/<app>--<state>--<theme>.png under the repo root.",
					),
			},
		},
		async (args) => {
			const app = String(args.app ?? "");
			const state = args.state == null ? undefined : String(args.state);
			const themeArg = args.theme;
			const theme: "light" | "dark" =
				themeArg === "dark" ? "dark" : themeArg === "light" ? "light" : "light";
			const outPath = (() => {
				if (typeof args.outPath === "string" && args.outPath.length > 0) {
					return resolve(args.outPath);
				}
				const safeApp = app.replace(/[^A-Za-z0-9._-]+/g, "_");
				const safeState = (state ?? "default").replace(/[^A-Za-z0-9._-]+/g, "_");
				return join(DEFAULT_OUT_DIR, `${safeApp}--${safeState}--${theme}.png`);
			})();
			mkdirSync(dirname(outPath), { recursive: true });
			try {
				const input: Parameters<typeof snapshot>[0] = { app, theme, outPath };
				if (state) input.state = state;
				const result = await snapshot(input);
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ ok: false, error: (err as Error).message }, null, 2),
						},
					],
				};
			}
		},
	);

	server.registerTool(
		"visual.shutdown",
		{
			description:
				"Close the running Electron shell used by visual.snapshot. Safe to call when nothing is running. Useful before pulling in code changes that require a fresh boot.",
			inputSchema: {},
		},
		async () => {
			await shutdownWorker();
			return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
		},
	);
}
