import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	claim as claimTask,
	handoff as handoffTask,
	release as releaseTask,
	renew as renewTask,
	resume as resumeTask,
	status as statusTasks,
} from "./orchestration/store.ts";
import { LeaseEffective } from "./orchestration/types.ts";
import { parseOpenQuestions } from "./parse-oqs.ts";
import { parsePlan } from "./parse-plan.ts";
import { repoPath } from "./repo.ts";
import { listResources, readOQSource, readPlanSource, readResource } from "./resources.ts";
import { SeedMode, SeedScope, seedVault } from "./seed/seeder.ts";
import { findFocusTrapsWithoutRestore } from "./tools/a11y-focus-trap-without-restore-check.ts";
import { findOnClickNonButton } from "./tools/a11y-onclick-non-button-check.ts";
import { findRawCompositeRoles } from "./tools/a11y-roles-check.ts";
import { findPositiveTabindexes } from "./tools/a11y-tabindex-check.ts";
import { runLint, runTests, runTypecheck } from "./tools/audit.ts";
import {
	diffCapabilitySurface,
	readAppManifestsAtRef,
	readLocalAppManifests,
	runCapabilityDiff,
} from "./tools/capability-diff.ts";
import { checkCoverage } from "./tools/coverage.ts";
import { findBareStrings } from "./tools/i18n.ts";
import { findRawKeyboardAccess } from "./tools/keyboard-raw-keys-check.ts";
import { findRelayImportViolations, isRelayModulePath } from "./tools/relay-noble-import-check.ts";
import { listIterations, listOpenQuestions } from "./tools/search.ts";
import { checkSize } from "./tools/size.ts";
import { diffBaseline, snapshotStage } from "./tools/stage-boundary-audit.ts";
import { baselineFor } from "./tools/stage-boundary-baselines.ts";
import { registerVisualTools } from "./tools/visual.ts";
import {
	appendImplementationLogEntry,
	markOQResolved,
	updatePlanIteration,
} from "./tools/write.ts";
import { IterationStatus, OQStatus } from "./types.ts";

const SERVER_INFO = {
	name: "@brainstorm/mcp-server",
	version: "0.0.1",
};

/**
 * Builds a fully wired `McpServer`. The caller is responsible for
 * connecting a transport (stdio in production, in-memory in tests).
 */
export function buildServer(): McpServer {
	const server = new McpServer(SERVER_INFO);

	for (const descriptor of listResources()) {
		server.registerResource(
			descriptor.name,
			descriptor.uri,
			{ description: descriptor.description, mimeType: descriptor.mimeType },
			async (uri) => ({
				contents: [
					{
						uri: uri.toString(),
						mimeType: descriptor.mimeType,
						text: readResource(uri.toString()).text,
					},
				],
			}),
		);
	}

	server.registerResource(
		"plan-stage",
		new ResourceTemplate("plan://stage/{stage}", { list: undefined }),
		{
			description: "Per-stage section of docs/implementation-plan.md.",
			mimeType: "application/json",
		},
		async (uri) => {
			const content = readResource(uri.toString());
			return {
				contents: [{ uri: uri.toString(), mimeType: content.mimeType, text: content.text }],
			};
		},
	);

	server.registerResource(
		"plan-iteration",
		new ResourceTemplate("plan://iteration/{id}", { list: undefined }),
		{
			description: "Single iteration entry (e.g. plan://iteration/9.6).",
			mimeType: "application/json",
		},
		async (uri) => {
			const content = readResource(uri.toString());
			return {
				contents: [{ uri: uri.toString(), mimeType: content.mimeType, text: content.text }],
			};
		},
	);

	server.registerResource(
		"open-question",
		new ResourceTemplate("oq://{id}", { list: undefined }),
		{ description: "Single open question (e.g. oq://OQ-34).", mimeType: "application/json" },
		async (uri) => {
			const content = readResource(uri.toString());
			return {
				contents: [{ uri: uri.toString(), mimeType: content.mimeType, text: content.text }],
			};
		},
	);

	server.registerResource(
		"doc",
		new ResourceTemplate("doc://{slug}", { list: undefined }),
		{ description: "Any design doc under docs/ by slug.", mimeType: "text/markdown" },
		async (uri) => {
			const content = readResource(uri.toString());
			return {
				contents: [{ uri: uri.toString(), mimeType: content.mimeType, text: content.text }],
			};
		},
	);

	server.registerResource(
		"package",
		new ResourceTemplate("package://{name}", { list: undefined }),
		{ description: "Workspace package metadata.", mimeType: "application/json" },
		async (uri) => {
			const content = readResource(uri.toString());
			return {
				contents: [{ uri: uri.toString(), mimeType: content.mimeType, text: content.text }],
			};
		},
	);

	server.registerTool(
		"coverage.check",
		{
			description:
				"Runs the vitest coverage suite and reports per-package line/branch/function/statement percentages plus a list of packages below their per-package floor (per docs/foundations/35-code-conventions.md).",
			inputSchema: {
				package: z
					.string()
					.optional()
					.describe("Scope to a single workspace package (e.g. '@brainstorm/sdk')."),
			},
		},
		async (args) => {
			const report = checkCoverage(args.package);
			return {
				content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
			};
		},
	);

	server.registerTool(
		"size.check",
		{
			description:
				"Runs `bun run size --json` and reports every size-limit budget plus a list of over-budget entries.",
			inputSchema: {},
		},
		async () => {
			const report = checkSize();
			return {
				content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
			};
		},
	);

	server.registerTool(
		"i18n.find_bare_strings",
		{
			description:
				"Greps TSX files for user-visible text not wrapped in t(). False positives expected; results are hints, not gates.",
			inputSchema: {
				path: z
					.string()
					.optional()
					.describe("Scope to a subdir relative to repo root (e.g. 'packages/shell/src/renderer')."),
			},
		},
		async (args) => {
			const findings = findBareStrings(args.path);
			return {
				content: [{ type: "text", text: JSON.stringify(findings, null, 2) }],
			};
		},
	);

	server.registerTool(
		"audit.test_run",
		{
			description:
				"Runs `bun --bun vitest run --reporter=json --silent` and reports { ok, totalFiles, totalTests, passed, failed, skipped, durationMs, failingFiles[] } parsed from the JSON reporter. First step of the stage-boundary stability audit (per docs/foundations/49-self-hosting.md SH-1).",
			inputSchema: {
				pattern: z
					.string()
					.optional()
					.describe(
						"Forwarded to vitest as a positional argument (e.g. 'apps/tasks' or 'packages/sdk-types/src/recurrence.test.ts').",
					),
			},
		},
		async (args) => {
			const report = runTests(args.pattern);
			const { raw: _raw, ...summary } = report;
			return {
				content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
			};
		},
	);

	server.registerTool(
		"audit.typecheck",
		{
			description:
				"Runs `bun run typecheck` (= `tsc --noEmit`) and reports { ok, errorCount, errors[] } parsed from the compiler output. Second step of the stage-boundary stability audit (SH-2 per docs/foundations/49-self-hosting.md).",
			inputSchema: {},
		},
		async () => {
			const report = runTypecheck();
			const { raw: _raw, ...summary } = report;
			return {
				content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
			};
		},
	);

	server.registerTool(
		"audit.stage_boundary",
		{
			description:
				"Per-stage structured snapshot for the boundary audit: iterations by status, preview-drop (◑) tail, resolved + open OQ counts, baseline-drift classification against the pinned Stages 0–7 fixtures. A regression below the recorded floor (status went backward, done-count dropped, resolved-OQ-count dropped) returns a non-empty `drift` array — for use in `docs/_review/<date>-stage-<n>-audit.md`.",
			inputSchema: {
				stage: z
					.string()
					.describe("Stage id (e.g. '0', '5b', '7a'). Matches parsePlan's Stage.stageId."),
			},
		},
		async (args) => {
			const plan = parsePlan(readPlanSource());
			const oqs = parseOpenQuestions(readOQSource());
			const stage = plan.stages.find((s) => s.stageId === args.stage);
			if (!stage) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									ok: false,
									stageId: args.stage,
									error: `unknown stage: ${args.stage}`,
								},
								null,
								2,
							),
						},
					],
				};
			}
			const snapshot = snapshotStage(stage, oqs.questions);
			const baseline = baselineFor(args.stage);
			const drift = diffBaseline(snapshot, baseline);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ ok: drift.length === 0, snapshot, baseline, drift }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"capability.diff",
		{
			description:
				"Diffs the declared capability surface (per-app manifest `capabilities`) between two git refs. Reports added / removed / scope-narrowed / scope-widened capabilities, per app and globally. Scope = the segment after `:` (e.g. `intents.dispatch:open` is narrower than `intents.dispatch`). Defaults: HEAD vs HEAD~1. Pass `local: true` to diff the (uncommitted) working tree against `before`.",
			inputSchema: {
				before: z.string().optional().describe("Earlier git ref (default 'HEAD~1')."),
				after: z.string().optional().describe("Later git ref (default 'HEAD')."),
				local: z
					.boolean()
					.optional()
					.describe(
						"If true, ignore `after` and compare `before` (default 'HEAD') against the uncommitted local manifests.",
					),
			},
		},
		async (args) => {
			const beforeRef = args.before ?? (args.local ? "HEAD" : "HEAD~1");
			if (args.local) {
				const before = readAppManifestsAtRef(beforeRef);
				const after = readLocalAppManifests();
				const diff = diffCapabilitySurface(before, after);
				return {
					content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
				};
			}
			const afterRef = args.after ?? "HEAD";
			const diff = runCapabilityDiff(beforeRef, afterRef);
			return {
				content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
			};
		},
	);

	server.registerTool(
		"keyboard.find_raw_keys",
		{
			description:
				'Hunts for raw `event.key` / `event.code` / `event.keyCode` / `event.which` access and `addEventListener("keydown"|"keyup"|"keypress", …)` calls outside the shortcut-registry allowlist. Per CLAUDE.md "Keyboard via the shortcut registry, never raw `e.key`" — repo-wide CI guard. Escape hatch: `// keyboard-exempt` on or above the line.',
			inputSchema: {
				roots: z
					.array(z.string())
					.optional()
					.describe(
						"Repo-relative roots to walk (default ['apps', 'packages/shell/src/renderer', 'packages/sdk/src']).",
					),
			},
		},
		async (args) => {
			const roots = args.roots ?? ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
			const files: { path: string; source: string }[] = [];
			const walk = (dir: string): void => {
				let entries: string[];
				try {
					entries = readdirSync(dir);
				} catch {
					return;
				}
				for (const e of entries) {
					const p = join(dir, e);
					let stat: ReturnType<typeof statSync>;
					try {
						stat = statSync(p);
					} catch {
						continue;
					}
					if (stat.isDirectory()) {
						if (e === "node_modules" || e === "dist" || e === ".git") continue;
						walk(p);
					} else if (
						(p.endsWith(".ts") || p.endsWith(".tsx")) &&
						!p.endsWith(".d.ts") &&
						!p.endsWith(".test.ts") &&
						!p.endsWith(".test.tsx")
					) {
						files.push({ path: p, source: readFileSync(p, "utf8") });
					}
				}
			};
			for (const r of roots) walk(repoPath(r));
			const violations = findRawKeyboardAccess(files);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ok: violations.length === 0, count: violations.length, violations },
							null,
							2,
						),
					},
				],
			};
		},
	);

	const walkSources = (
		roots: readonly string[],
		opts: { tsx_only?: boolean } = {},
	): { path: string; source: string }[] => {
		const files: { path: string; source: string }[] = [];
		const walk = (dir: string): void => {
			let entries: string[];
			try {
				entries = readdirSync(dir);
			} catch {
				return;
			}
			for (const e of entries) {
				const p = join(dir, e);
				let stat: ReturnType<typeof statSync>;
				try {
					stat = statSync(p);
				} catch {
					continue;
				}
				if (stat.isDirectory()) {
					if (e === "node_modules" || e === "dist" || e === ".git") continue;
					walk(p);
				} else {
					const tsxOk = p.endsWith(".tsx") && !p.endsWith(".test.tsx") && !p.endsWith(".stories.tsx");
					const tsOk =
						(p.endsWith(".ts") || p.endsWith(".tsx")) &&
						!p.endsWith(".d.ts") &&
						!p.endsWith(".test.ts") &&
						!p.endsWith(".test.tsx");
					if ((opts.tsx_only && tsxOk) || (!opts.tsx_only && tsOk)) {
						files.push({ path: p, source: readFileSync(p, "utf8") });
					}
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		return files;
	};

	server.registerTool(
		"a11y.find_positive_tabindex",
		{
			description:
				'KBN-G-tabindex (KBN-3) — flags `tabIndex` / `tabindex` values other than `0` and `-1` (positive tabindex breaks document order). Static TS-AST guard mirroring 12.11/12.12/12.13/12.14/0.11. JSX `tabIndex={N}` + `tabIndex="N"` + `el.tabIndex = N` + `el.setAttribute("tabindex", "N")`. Escape hatch: `// kbn-tabindex-exempt` on or above the line.',
			inputSchema: {
				roots: z
					.array(z.string())
					.optional()
					.describe(
						"Repo-relative roots to walk (default ['apps', 'packages/shell/src/renderer', 'packages/sdk/src']).",
					),
			},
		},
		async (args) => {
			const roots = args.roots ?? ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
			const violations = findPositiveTabindexes(walkSources(roots));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ok: violations.length === 0, count: violations.length, violations },
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"a11y.find_raw_composite_roles",
		{
			description:
				'KBN-G-roles (KBN-3) — flags hand-written `role="listbox|grid|tree|tablist|toolbar|radiogroup"` outside `@brainstorm/sdk/a11y`. Composite-keyboard roles must flow through the SDK hook (`useCompositeKeyboard` / `useTreeKeyboard`) that stamps `containerProps.role`. Escape hatch: `// kbn-roles-exempt`.',
			inputSchema: {
				roots: z
					.array(z.string())
					.optional()
					.describe(
						"Repo-relative roots to walk (default ['apps', 'packages/shell/src/renderer', 'packages/sdk/src']).",
					),
			},
		},
		async (args) => {
			const roots = args.roots ?? ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
			const violations = findRawCompositeRoles(walkSources(roots));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ok: violations.length === 0, count: violations.length, violations },
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"a11y.find_onclick_non_button",
		{
			description:
				"KBN-G-onclick-non-button (KBN-3) — flags JSX `onClick={…}` on a non-`<button>`/`<a>`/`<input>`/`<textarea>`/`<select>` raw DOM element without `role` and without `tabIndex` (mouse-only affordance). Passes on `disabled`, `contentEditable`, PascalCase components. Escape hatch: `// kbn-onclick-exempt`.",
			inputSchema: {
				roots: z
					.array(z.string())
					.optional()
					.describe(
						"Repo-relative roots to walk (default ['apps', 'packages/shell/src/renderer', 'packages/sdk/src']).",
					),
			},
		},
		async (args) => {
			const roots = args.roots ?? ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
			const violations = findOnClickNonButton(walkSources(roots, { tsx_only: true }));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ok: violations.length === 0, count: violations.length, violations },
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"a11y.find_focus_traps_without_restore",
		{
			description:
				"KBN-G-focus-trap-without-restore (KBN-3) — flags every `useFocusTrap({…})` call site whose options object lacks `restoreFocusTo` (the trap closes and focus drops to `<body>`). Only flags call sites whose enclosing file imports `useFocusTrap` from `@brainstorm/sdk/a11y`. Escape hatch: `// kbn-trap-restore-exempt`.",
			inputSchema: {
				roots: z
					.array(z.string())
					.optional()
					.describe(
						"Repo-relative roots to walk (default ['apps', 'packages/shell/src/renderer', 'packages/sdk/src']).",
					),
			},
		},
		async (args) => {
			const roots = args.roots ?? ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
			const violations = findFocusTrapsWithoutRestore(walkSources(roots));
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ ok: violations.length === 0, count: violations.length, violations },
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"sync.relay_noble_import_check",
		{
			description:
				"12th structural gate (Stage 10.3a). Scans every `packages/shell/src/main/sync/*relay*.ts` (and any future relay impl matching the same convention) for `@noble/*` or `./envelope-seal` / `./envelope-crypto` imports — the blind-relay invariant is structural: the production relay code path must never hold key material or import crypto primitives. Source scan only; comments mentioning the rule are stripped before matching.",
			inputSchema: {
				roots: z
					.array(z.string())
					.optional()
					.describe(
						"Repo-relative roots to walk (default ['packages/shell/src/main/sync']). The audit filters down to `*relay*.ts` itself.",
					),
			},
		},
		async (args) => {
			const roots = args.roots ?? ["packages/shell/src/main/sync"];
			const files: { path: string; source: string }[] = [];
			const walk = (dir: string): void => {
				let entries: string[];
				try {
					entries = readdirSync(dir);
				} catch {
					return;
				}
				for (const e of entries) {
					const p = join(dir, e);
					let stat: ReturnType<typeof statSync>;
					try {
						stat = statSync(p);
					} catch {
						continue;
					}
					if (stat.isDirectory()) {
						if (e === "node_modules" || e === "dist" || e === ".git") continue;
						walk(p);
					} else if (/\.(ts|tsx|js|mjs)$/.test(p) && !p.endsWith(".d.ts")) {
						files.push({ path: p, source: readFileSync(p, "utf8") });
					}
				}
			};
			for (const r of roots) walk(repoPath(r));
			const inScope = files.filter((f) => isRelayModulePath(f.path));
			const violations = findRelayImportViolations(inScope);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								ok: violations.length === 0,
								scanned: inScope.length,
								count: violations.length,
								violations,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"audit.lint",
		{
			description:
				"Runs `bunx biome check . --reporter=json` and reports { ok, errorCount, warningCount, diagnostics[] }. Third step of the stage-boundary stability audit (SH-2 per docs/foundations/49-self-hosting.md).",
			inputSchema: {},
		},
		async () => {
			const report = runLint();
			const { raw: _raw, ...summary } = report;
			return {
				content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
			};
		},
	);

	server.registerTool(
		"plan.list_iterations",
		{
			description:
				"Lists every iteration in implementation-plan.md as a flat array, optionally filtered by stage (e.g. '9' / '9a') and/or status (done / partial / pending / reverted / unknown). Search-friendly companion to the `plan://iteration/<id>` resource (SH-3 per docs/foundations/49-self-hosting.md).",
			inputSchema: {
				stage: z.string().optional().describe("Filter to a single stage id."),
				status: z
					.nativeEnum(IterationStatus)
					.optional()
					.describe("Filter to a single iteration status."),
			},
		},
		async (args) => {
			const filter: {
				stage?: string;
				status?: IterationStatus;
			} = {};
			if (args.stage !== undefined) filter.stage = args.stage;
			if (args.status !== undefined) filter.status = args.status;
			const items = listIterations(filter);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ count: items.length, items }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"oq.list",
		{
			description:
				"Lists every open question in 11-open-questions.md as a flat array, optionally filtered by stage mention or by status (open / resolved). Search-friendly companion to the `oq://<id>` resource (SH-3 per docs/foundations/49-self-hosting.md).",
			inputSchema: {
				stage: z
					.string()
					.optional()
					.describe("Match OQs whose `Where` / section / body mention this stage id."),
				status: z.nativeEnum(OQStatus).optional().describe("Filter to a single status."),
			},
		},
		async (args) => {
			const filter: { stage?: string; status?: OQStatus } = {};
			if (args.stage !== undefined) filter.stage = args.stage;
			if (args.status !== undefined) filter.status = args.status;
			const items = listOpenQuestions(filter);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ count: items.length, items }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"plan.update_iteration",
		{
			description:
				"Updates a single iteration's status across the three source-of-truth docs ATOMICALLY (implementation-plan.md + implementation-plan-table.md + optional implementation-log.md). Builds all three modified sources in memory first; writes only if every step succeeds (partial failure returns {ok:false, reason, failedStep} with no disk writes). Lease the iteration id via orchestration.claim before calling so concurrent landings don't race. logHeadline + logBody are OPTIONAL — pass both to land a log entry in the same atomic transaction; pass neither for plan + table only (backwards-compatible with pre-0.12 callers). Replaces an existing status prefix instead of stacking. Optionally appends a `**Update <date>:** <note>` segment to the plan bullet. Returns { ok, changed, planChanged, tableChanged, logChanged, before, after, statusAfterReparse, failedStep?, reason? } (per docs/foundations/49-self-hosting.md SH-4 + iteration 0.12).",
			inputSchema: {
				id: z.string().describe("Iteration id (e.g. '9.14.1.5' or 'SH-2')."),
				status: z.nativeEnum(IterationStatus).describe("Target status."),
				today: z.string().describe("YYYY-MM-DD timestamp baked into the badge."),
				note: z.string().optional().describe("Short note to append as `**Update <date>:** <note>`."),
				logHeadline: z
					.string()
					.optional()
					.describe(
						"Optional log-entry headline. When set together with logBody, also appends a `### <id> — <logHeadline>` entry to implementation-log.md in the same atomic transaction.",
					),
				logBody: z
					.string()
					.optional()
					.describe(
						"Optional log-entry body. Required if logHeadline is set. Becomes the prose after the `✅ DONE (YYYY-MM-DD). **<headline>**.` status prefix.",
					),
			},
		},
		async (args) => {
			const result = updatePlanIteration({
				id: args.id,
				status: args.status,
				today: args.today,
				...(args.note !== undefined ? { note: args.note } : {}),
				...(args.logHeadline !== undefined ? { logHeadline: args.logHeadline } : {}),
				...(args.logBody !== undefined ? { logBody: args.logBody } : {}),
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"plan.append_log_entry",
		{
			description:
				"Appends a single iteration's narrative to implementation-log.md without flipping plan status — the post-hoc companion to plan.update_iteration (useful when an iteration's plan/table rows already flipped via a separate landing and only the log needs the narrative). Produces the canonical `### <id> — <headline>` + `✅ DONE (YYYY-MM-DD). **<headline>**. <body>` shape that parseImplementationLog round-trips (the SH-27 seeder titling contract). Idempotent on same-id+same-date; refuses with {ok:false, reason:'log-entry-exists'} on a date mismatch.",
			inputSchema: {
				id: z.string().describe("Iteration id (e.g. '0.12' or 'SH-4')."),
				stage: z
					.string()
					.describe(
						"Stage id the entry lives under (e.g. '0' / '9' / '13'). Used as the heading title when synthesizing a new `## Stage N — <title>` section if the stage doesn't yet exist in the log.",
					),
				today: z.string().describe("YYYY-MM-DD ship date baked into the status prefix."),
				headline: z.string().describe("Short headline shown in the `### <id> — <headline>` heading."),
				body: z.string().describe("Prose body that follows the status prefix."),
			},
		},
		async (args) => {
			const result = appendImplementationLogEntry({
				id: args.id,
				stage: args.stage,
				today: args.today,
				headline: args.headline,
				body: args.body,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"plan.mark_oq_resolved",
		{
			description:
				"Marks an open question resolved in 11-open-questions.md: adds `*[RESOLVED in implementation-plan Stage N]*` to the heading and inserts a `- **Resolution:** <text>` bullet. Idempotent (SH-4 per docs/foundations/49-self-hosting.md).",
			inputSchema: {
				id: z.string().describe("OQ id with the OQ- prefix (e.g. 'OQ-34')."),
				stage: z.string().describe("Stage id the resolution lives in (e.g. '9' / '9a')."),
				resolution: z.string().describe("One-sentence resolution text."),
			},
		},
		async (args) => {
			const result = markOQResolved({
				id: args.id,
				stage: args.stage,
				resolution: args.resolution,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"vault.seed_demo",
		{
			description:
				"Writes a coherent demo dataset (cross-referencing notes via MentionNodes) into a target vault's per-app kv.json files. Idempotent — stable ids + timestamps. Use this to populate a freshly-created vault so Notes / Database / Graph render realistic data instead of falling back to their bundled demo fixtures.",
			inputSchema: {
				vaultPath: z
					.string()
					.describe("Absolute path to the vault directory (the parent of the 'data/' folder)."),
				scopes: z
					.array(z.nativeEnum(SeedScope))
					.optional()
					.describe("Which app scopes to seed. Defaults to all available scopes."),
				mode: z
					.nativeEnum(SeedMode)
					.optional()
					.describe(
						"merge (default) preserves keys that don't belong to the seed dataset; replace wipes the file and writes only seeded keys.",
					),
				dryRun: z.boolean().optional().describe("If true, returns the report without touching disk."),
			},
		},
		async (args) => {
			const report = seedVault({
				vaultPath: args.vaultPath,
				...(args.scopes !== undefined ? { scopes: args.scopes } : {}),
				...(args.mode !== undefined ? { mode: args.mode } : {}),
				...(args.dryRun !== undefined ? { dryRun: args.dryRun } : {}),
			});
			return {
				content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
			};
		},
	);

	server.registerTool(
		"orchestration.claim",
		{
			description:
				"Claims a task (typically a plan iteration id like '9.13.5') for one agent. Fails closed with conflict details if another agent holds an active, non-expired lease — unless `force` steals it. Re-claiming your own task refreshes the heartbeat. Taking over a released/handed-off/expired task returns the predecessor's handoff payload in `inherited`. `knownIteration` flags whether the task matches a real plan iteration (typo guard).",
			inputSchema: {
				task: z.string().describe("Stable task key — a plan iteration id (e.g. '9.13.5')."),
				owner: z.string().describe("Stable agent id (e.g. 'agent-graph-pixi')."),
				worktree: z.string().optional().describe("Absolute path of the git worktree the work runs in."),
				branch: z.string().optional().describe("Branch name the work lands on."),
				note: z.string().optional().describe("Short statement of intent."),
				ttlMinutes: z
					.number()
					.positive()
					.optional()
					.describe("Lease validity window between heartbeats (default 30)."),
				force: z.boolean().optional().describe("Steal an active lease held by another owner."),
			},
		},
		async (args) => {
			const result = claimTask({
				task: args.task,
				owner: args.owner,
				...(args.worktree !== undefined ? { worktree: args.worktree } : {}),
				...(args.branch !== undefined ? { branch: args.branch } : {}),
				...(args.note !== undefined ? { note: args.note } : {}),
				...(args.ttlMinutes !== undefined ? { ttlMs: args.ttlMinutes * 60_000 } : {}),
				...(args.force !== undefined ? { force: args.force } : {}),
			});
			const knownIteration = listIterations().some((i) => i.id === args.task);
			return {
				content: [{ type: "text", text: JSON.stringify({ ...result, knownIteration }, null, 2) }],
			};
		},
	);

	server.registerTool(
		"orchestration.renew",
		{
			description:
				"Heartbeat: re-asserts your lease on a task and resets its TTL so it isn't reaped as stale while you're still working. Call periodically during long work.",
			inputSchema: {
				task: z.string().describe("Task key."),
				owner: z.string().describe("Agent id that holds the lease."),
				force: z.boolean().optional().describe("Renew even if the recorded owner differs."),
			},
		},
		async (args) => {
			const result = renewTask({
				task: args.task,
				owner: args.owner,
				...(args.force !== undefined ? { force: args.force } : {}),
			});
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		"orchestration.handoff",
		{
			description:
				"Records a structured handoff and parks the task as resumable: what's done, what's left, files touched, how to verify. The next agent calls orchestration.resume to inherit this payload instead of reconstructing state by hand.",
			inputSchema: {
				task: z.string().describe("Task key."),
				owner: z.string().describe("Agent id handing off."),
				done: z.string().describe("What is complete."),
				remaining: z.string().describe("What is left to do."),
				files: z.array(z.string()).describe("Files touched so far (the blast radius)."),
				verify: z.string().describe("How to verify the work (command / test path / steps)."),
				force: z.boolean().optional().describe("Hand off even if the recorded owner differs."),
			},
		},
		async (args) => {
			const result = handoffTask({
				task: args.task,
				owner: args.owner,
				done: args.done,
				remaining: args.remaining,
				files: args.files,
				verify: args.verify,
				...(args.force !== undefined ? { force: args.force } : {}),
			});
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		"orchestration.resume",
		{
			description:
				"Picks up a task that is handed off, released, or expired and assigns it to a new owner. Returns the predecessor's handoff payload in `inherited`. Refuses a task actively held by another owner (use orchestration.claim with force to steal).",
			inputSchema: {
				task: z.string().describe("Task key."),
				owner: z.string().describe("Agent id taking over."),
				force: z.boolean().optional().describe("Resume even over an active lease."),
			},
		},
		async (args) => {
			const result = resumeTask({
				task: args.task,
				owner: args.owner,
				...(args.force !== undefined ? { force: args.force } : {}),
			});
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		"orchestration.release",
		{
			description:
				"Marks a task done/abandoned by its owner so it is freely re-claimable. Released leases are pruned from the ledger after 24h.",
			inputSchema: {
				task: z.string().describe("Task key."),
				owner: z.string().describe("Agent id that holds the lease."),
				force: z.boolean().optional().describe("Release even if the recorded owner differs."),
			},
		},
		async (args) => {
			const result = releaseTask({
				task: args.task,
				owner: args.owner,
				...(args.force !== undefined ? { force: args.force } : {}),
			});
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		"orchestration.status",
		{
			description:
				"Lists leases in the shared ledger with their time-derived effective state (active / stale / handoff / released) and expiry, optionally filtered. Read this before claiming work to see who owns what.",
			inputSchema: {
				task: z.string().optional().describe("Filter to one task."),
				owner: z.string().optional().describe("Filter to one agent's leases."),
				effective: z.nativeEnum(LeaseEffective).optional().describe("Filter to one effective state."),
			},
		},
		async (args) => {
			const filter: { task?: string; owner?: string; effective?: LeaseEffective } = {};
			if (args.task !== undefined) filter.task = args.task;
			if (args.owner !== undefined) filter.owner = args.owner;
			if (args.effective !== undefined) filter.effective = args.effective;
			const result = statusTasks(filter);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		},
	);

	registerVisualTools(server);

	return server;
}
