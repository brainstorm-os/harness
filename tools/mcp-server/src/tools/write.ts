import { writeFileSync } from "node:fs";
import { parseOpenQuestions } from "../parse-oqs.ts";
import { parsePlan } from "../parse-plan.ts";
import { repoPath } from "../repo.ts";
import { readLogSource, readOQSource, readPlanSource, readPlanTableSource } from "../resources.ts";
import { IterationStatus, type OQStatus } from "../types.ts";

export interface IterationUpdateInput {
	id: string;
	status: IterationStatus;
	today: string;
	note?: string;
}

export interface IterationUpdateResult {
	source: string;
	changed: boolean;
	before: string | null;
	after: string | null;
}

// Post-restructure the plan encodes status as the bullet's leading icon
// (`- <icon> <idspec> — <task>`), not a textual `✓ DONE (date).` badge.
// `u` flag is load-bearing — 🟡 is astral (U+1F7E1).
const BULLET_LINE_RE = /^(\s*-\s+)([✅🟡◑⚪❌])(\s+)(\S.*)$/u;
const LEAD_ID_RE = /^(SH-\d+|VP-\d+|B\d+(?:\.\d+)*[a-z]?|\d+(?:\.\d+)*(?:\.[A-Za-z][\w-]*)?)/;

/** The glyph for a status, or null for statuses the plan never renders
 *  on a bullet (Todo/Unknown) — those are treated as a no-op. Must mirror
 *  `parse-plan.ts` `iconToStatus` so a write round-trips through a read. */
export function statusIcon(status: IterationStatus): string | null {
	switch (status) {
		case IterationStatus.Done:
			return "✅";
		case IterationStatus.Partial:
			return "🟡";
		case IterationStatus.PreviewDrop:
			return "◑";
		case IterationStatus.Pending:
			return "⚪";
		case IterationStatus.Reverted:
			return "❌";
		default:
			return null;
	}
}

/**
 * Surgically updates one iteration's status in `implementation-plan.md`
 * by flipping its bullet's leading status icon (and optionally appending
 * an `**Update <date>:** <note>` segment). Pure: returns the modified
 * markdown plus the before/after of the touched line for round-trip
 * verification. Matches the bullet whose lead code exactly equals
 * `input.id` (so `0.1` never matches `0.10`).
 */
export function applyIterationUpdate(
	source: string,
	input: IterationUpdateInput,
): IterationUpdateResult {
	const targetIcon = statusIcon(input.status);
	if (!targetIcon) return { source, changed: false, before: null, after: null };
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const m = BULLET_LINE_RE.exec(lines[i] ?? "");
		if (!m) continue;
		const [, dash = "", , ws = " ", rest = ""] = m;
		const firstToken = /^(\S+)/.exec(rest)?.[1] ?? "";
		if (LEAD_ID_RE.exec(firstToken)?.[1] !== input.id) continue;
		const before = lines[i] ?? "";
		const body = input.note ? `${rest.trimEnd()} **Update ${input.today}:** ${input.note}` : rest;
		const after = `${dash}${targetIcon}${ws}${body}`;
		if (after === before) return { source, changed: false, before, after };
		lines[i] = after;
		return { source: lines.join("\n"), changed: true, before, after };
	}
	return { source, changed: false, before: null, after: null };
}

export interface OQResolutionInput {
	id: string;
	stage: string;
	resolution: string;
}

export interface OQResolutionResult {
	source: string;
	changed: boolean;
	headingBefore: string | null;
	headingAfter: string | null;
}

const OQ_HEADING_FOR = (id: string) => new RegExp(`^####\\s+${escapeRegex(id)}\\s+—\\s+(.+?)\\s*$`);
const RESOLVED_TAG_PRESENT = /\*\[(?:[A-Z\- ]+ )?RESOLVED[^\]]*\]\*/;

/**
 * Marks one OQ as resolved in `11-open-questions.md`. Appends the
 * `*[RESOLVED in implementation-plan Stage N]*` tag to the heading (if
 * not present) and inserts a `- **Resolution:** ...` bullet in the body
 * before the next OQ heading / section / `---` separator.
 */
export function applyOQResolution(source: string, input: OQResolutionInput): OQResolutionResult {
	const lines = source.split("\n");
	const headingPattern = OQ_HEADING_FOR(input.id);
	let lineIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (headingPattern.test(lines[i] ?? "")) {
			lineIdx = i;
			break;
		}
	}
	if (lineIdx === -1) {
		return { source, changed: false, headingBefore: null, headingAfter: null };
	}
	const headingBefore = lines[lineIdx] ?? "";
	const titleMatch = headingPattern.exec(headingBefore);
	if (!titleMatch?.[1]) {
		return { source, changed: false, headingBefore: null, headingAfter: null };
	}
	const titleSegment = titleMatch[1];
	const tag = `*[RESOLVED in implementation-plan Stage ${input.stage}]*`;
	const newTitleSegment = RESOLVED_TAG_PRESENT.test(titleSegment)
		? titleSegment
		: `${titleSegment} ${tag}`;
	const headingAfter = `#### ${input.id} — ${newTitleSegment}`;
	lines[lineIdx] = headingAfter;

	const bodyEnd = findOQBodyEnd(lines, lineIdx + 1);
	if (!hasResolutionBullet(lines, lineIdx + 1, bodyEnd)) {
		lines.splice(bodyEnd, 0, `- **Resolution:** ${input.resolution}`);
	}

	const changed = lines.join("\n") !== source;
	return {
		source: lines.join("\n"),
		changed,
		headingBefore,
		headingAfter,
	};
}

function findOQBodyEnd(lines: string[], from: number): number {
	for (let i = from; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (line.startsWith("####") || line.startsWith("### ") || line.startsWith("## ")) return i;
		if (line.startsWith("---")) return i;
	}
	return lines.length;
}

function hasResolutionBullet(lines: string[], from: number, to: number): boolean {
	for (let i = from; i < to; i++) {
		if ((lines[i] ?? "").includes("**Resolution:**")) return true;
	}
	return false;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface TableUpdateInput {
	id: string;
	status: IterationStatus;
}

export interface TableUpdateResult {
	source: string;
	changed: boolean;
	before: string | null;
	after: string | null;
}

/** A status-icon cell: contents are exactly one of `[✅🟡◑⚪❌]` (after
 *  trimming). `u` flag is load-bearing — 🟡 is astral (U+1F7E1). The 🔴
 *  / 🟢 priority icons in the "Next up" tables are deliberately NOT in
 *  this set: they're not status, and the writer must not swap them. */
const TABLE_STATUS_CELL_CONTENT_RE = /^[✅🟡◑⚪❌]$/u;
/** A markdown table row — starts with `|`. */
const TABLE_ROW_RE = /^\s*\|/;
/** Inline-code tokens inside a table cell: `` `<token>` ``. The writer
 *  scans every backticked token in a row and accepts the row when ANY of
 *  them, run through `LEAD_ID_RE`, matches `input.id` exactly. This
 *  handles the actual `implementation-plan-table.md` shape where an
 *  iteration id can appear in the row's "Done" or "Left" cell rather than
 *  as the row label itself (`| Dev-MCP | 🟡 | … \`0.11\` audit tools | \`0.12\` write tools |`).
 *  Exact-match via `LEAD_ID_RE` preserves the "0.1 ≠ 0.10" safety. */
const BACKTICKED_TOKEN_RE = /`([^`]+)`/g;

/**
 * Mirrors an iteration's status into `implementation-plan-table.md` (per
 * [[feedback_keep_plan_table_in_sync]]). Targets the row whose **first**
 * inline-code segment matches `input.id` exactly (so `0.1` never hits
 * `0.10`/`0.11`/`0.12`); within that row, swaps the **first** cell whose
 * trimmed contents are exactly one status icon (one of ✅/🟡/◑/⚪/❌).
 * The 🔴/🟢 priority cells in the "Next up" tables are deliberately
 * skipped — those track release-blocking vs nice-to-have, not status.
 *
 * Non-fatal when no matching row exists (returns `{ changed:false }`) —
 * not every plan iteration appears in every table (the Phase-2 apps table
 * tracks apps not iterations; the Beta roadmap tracks gates). Idempotent
 * (re-apply produces `{ changed:false }`). Preserves cell padding
 * (`| ✅ |` vs `|✅|`). Pure: returns the modified markdown.
 */
export function applyTableUpdate(source: string, input: TableUpdateInput): TableUpdateResult {
	const targetIcon = statusIcon(input.status);
	if (!targetIcon) return { source, changed: false, before: null, after: null };
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (!TABLE_ROW_RE.test(line)) continue;
		if (!rowMatchesIterationId(line, input.id)) continue;
		const swapped = swapStatusCell(line, targetIcon);
		if (swapped === null) continue; // row has no status-icon cell — skip
		if (swapped === line) return { source, changed: false, before: line, after: line };
		const before = line;
		lines[i] = swapped;
		return { source: lines.join("\n"), changed: true, before, after: swapped };
	}
	return { source, changed: false, before: null, after: null };
}

/** Scan every backticked token in a table row; return true iff one of
 *  them, run through `LEAD_ID_RE`, exact-matches `id`. */
function rowMatchesIterationId(row: string, id: string): boolean {
	BACKTICKED_TOKEN_RE.lastIndex = 0;
	for (let m = BACKTICKED_TOKEN_RE.exec(row); m; m = BACKTICKED_TOKEN_RE.exec(row)) {
		const token = m[1] ?? "";
		if (LEAD_ID_RE.exec(token)?.[1] === id) {
			BACKTICKED_TOKEN_RE.lastIndex = 0;
			return true;
		}
	}
	BACKTICKED_TOKEN_RE.lastIndex = 0;
	return false;
}

export interface LogAppendInput {
	id: string;
	stage: string;
	today: string;
	headline: string;
	body: string;
}

export enum LogAppendRefusal {
	/** An entry with this id already exists at a DIFFERENT date — refuse
	 *  to silently overwrite (the prior shipper's narrative is preserved). */
	LogEntryExists = "log-entry-exists",
}

export interface LogAppendResult {
	source: string;
	changed: boolean;
	reason?: LogAppendRefusal;
}

const LOG_STAGE_HEADING_RE = /^##\s+Stage\b/;
const LOG_ITERATION_HEADING_RE = /^#{3,4}\s+(.+?)\s*$/;
const LOG_SHIP_DATE_RE = /\(\s*(\d{4}-\d{2}-\d{2})/;

/**
 * Appends a single iteration's narrative to `implementation-log.md` under
 * the matching `## Stage N — <title>` heading, producing the canonical
 * `### <id> — <headline>` + `✅ DONE (YYYY-MM-DD). **<headline>**. <body>`
 * shape that `parseImplementationLog` round-trips through (the load-bearing
 * SH-27 seeder titling contract). If the Stage heading doesn't exist in
 * the source, synthesizes it (`## Stage <stage> — <stage>` — the `stage`
 * arg doubles as the human title when no plan-side title is on hand).
 *
 * Idempotent on same-id+same-date — re-running produces no change. Refuses
 * to silently overwrite an existing entry with a DIFFERENT date (returns
 * `{ changed:false, reason:"log-entry-exists" }`) — the prior shipper's
 * narrative is the authoritative record; landing a follow-up on the same
 * iteration belongs in a NEW entry, not by mutation.
 */
export function appendLogEntry(source: string, input: LogAppendInput): LogAppendResult {
	const lines = source.split("\n");
	const existing = findExistingLogEntry(lines, input.id);
	if (existing !== null) {
		const existingDate = LOG_SHIP_DATE_RE.exec(existing.firstBodyLine)?.[1] ?? null;
		if (existingDate === input.today) return { source, changed: false };
		return { source, changed: false, reason: LogAppendRefusal.LogEntryExists };
	}

	const stageHeadingIdx = findStageHeadingIndex(lines, input.stage);
	const entryLines = renderLogEntry(input);

	if (stageHeadingIdx === -1) {
		// Append a new `## Stage N — <title>` at the end of the source, then
		// the entry under it. A trailing blank line is added before the new
		// heading so the new section sits cleanly off the prior content.
		const trailing = source.endsWith("\n") ? "" : "\n";
		const synthesized = `${source}${trailing}\n## Stage ${input.stage} — ${input.stage}\n\n${entryLines.join("\n")}\n`;
		return { source: synthesized, changed: true };
	}

	// Insert at the END of the matching stage section (just before the next
	// `## ` heading, or at the source tail if this is the last section).
	const sectionEnd = findStageSectionEnd(lines, stageHeadingIdx + 1);
	const inserted = [...lines];
	const block = ["", ...entryLines];
	inserted.splice(sectionEnd, 0, ...block);
	return { source: inserted.join("\n"), changed: true };
}

/** Format the iteration narrative into the canonical log shape that
 *  `parseImplementationLog` round-trips. */
function renderLogEntry(input: LogAppendInput): string[] {
	const out = [`### ${input.id} — ${input.headline}`, ""];
	out.push(`✅ DONE (${input.today}). **${input.headline}**. ${input.body}`);
	return out;
}

/** Walk the log; if any `### <code> — <stub>` / `#### <code> — <stub>`
 *  heading's code matches `id`, return its location + first non-empty
 *  body line (where the `(YYYY-MM-DD)` ship date lives in the canonical
 *  shape). Returns `null` if no entry exists. */
function findExistingLogEntry(
	lines: readonly string[],
	id: string,
): { headingIdx: number; firstBodyLine: string } | null {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const h = LOG_ITERATION_HEADING_RE.exec(line);
		if (!h?.[1]) continue;
		const parts = h[1].split(/\s+—\s+/);
		const code = (parts[0] ?? "").trim();
		if (code !== id) continue;
		// Find the first non-empty body line (canonical: it carries the
		// `✅ DONE (YYYY-MM-DD).` status prefix).
		for (let j = i + 1; j < lines.length; j++) {
			const body = lines[j] ?? "";
			if (body.trim().length > 0) return { headingIdx: i, firstBodyLine: body };
			if (/^#{2,4}\s/.test(body)) break;
		}
		return { headingIdx: i, firstBodyLine: "" };
	}
	return null;
}

/** Find a `## Stage <stage> …` heading; returns the line index or -1. */
function findStageHeadingIndex(lines: readonly string[], stage: string): number {
	const pattern = new RegExp(`^##\\s+Stage\\s+${escapeRegex(stage)}\\b`);
	for (let i = 0; i < lines.length; i++) {
		if (pattern.test(lines[i] ?? "")) return i;
	}
	return -1;
}

/** Walk forward from `from` to find where a `## Stage N` section ends.
 *  A section ends at the next `## ` heading or the end of the file. */
function findStageSectionEnd(lines: readonly string[], from: number): number {
	for (let i = from; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (LOG_STAGE_HEADING_RE.test(line)) return i;
		if (/^##\s+(?!Stage\b)/.test(line)) return i;
	}
	return lines.length;
}

/** Find the first cell in a markdown table row whose trimmed content is
 *  exactly a status icon; replace that icon with `targetIcon` preserving
 *  the cell's padding. Returns `null` if the row has no status-icon cell
 *  (a 🔴/🟢-only priority row, or a row whose status moved out long ago). */
function swapStatusCell(row: string, targetIcon: string): string | null {
	// Split on `|` while tracking positions; preserve the boundary chars so
	// the join puts them back byte-identically. A leading `| ` and trailing
	// ` |` are themselves boundary pipes; the cell contents live between.
	const cells: string[] = [];
	let start = 0;
	for (let i = 0; i < row.length; i++) {
		if (row[i] === "|") {
			cells.push(row.slice(start, i));
			cells.push("|");
			start = i + 1;
		}
	}
	cells.push(row.slice(start));
	// `cells` alternates [pre, "|", cell, "|", cell, …, "|", post]; only
	// the cell slots (odd indices > 0 and < length-1, skipping the
	// boundary pipes) carry content.
	for (let k = 0; k < cells.length; k++) {
		const c = cells[k];
		if (c === undefined || c === "|") continue;
		if (k === 0 || k === cells.length - 1) continue; // leading / trailing
		const trimmed = c.trim();
		if (!TABLE_STATUS_CELL_CONTENT_RE.test(trimmed)) continue;
		const leading = c.slice(0, c.indexOf(trimmed));
		const trailing = c.slice(leading.length + trimmed.length);
		cells[k] = `${leading}${targetIcon}${trailing}`;
		return cells.join("");
	}
	return null;
}

export interface PlanIterationUpdateOrchestratedInput extends IterationUpdateInput {
	/** Optional log-side rung. When BOTH `logHeadline` and `logBody` are
	 *  provided the writer also appends a `### <id> — <headline>` entry
	 *  under the matching `## Stage N` heading. Absent → plan + table only
	 *  (the call is backwards-compatible — callers that don't want a log
	 *  entry leave both out). */
	logHeadline?: string;
	logBody?: string;
}

export enum OrchestrationStep {
	Plan = "plan",
	Table = "table",
	Log = "log",
}

export enum OrchestrationFailureReason {
	UnknownIterationId = "unknown-iteration-id",
	LogEntryExists = "log-entry-exists",
}

export interface UpdatePlanIterationResult {
	ok: boolean;
	changed: boolean;
	before: string | null;
	after: string | null;
	statusAfterReparse: IterationStatus | null;
	/** Per-file outcome. The writer builds all three modified sources in
	 *  memory first; only if no step fails does it commit to disk. */
	planChanged: boolean;
	tableChanged: boolean;
	logChanged: boolean;
	/** When `ok=false`, which step refused + why (the conflicting input
	 *  isn't applied; the other steps' modifications stay in memory and
	 *  are NOT written, so no partial state lands on disk). */
	failedStep?: OrchestrationStep;
	reason?: OrchestrationFailureReason;
}

export interface AtomicUpdateSources {
	planSource: string;
	tableSource: string;
	logSource: string;
}

export interface AtomicUpdateOutput {
	planResult: IterationUpdateResult;
	tableResult: TableUpdateResult;
	logResult: LogAppendResult | null;
}

/**
 * Pure atomic transform: applies `input` to all three in-memory sources
 * and reports the per-file outcome WITHOUT touching disk. Either
 *
 *   1. every step succeeds (or is a non-fatal no-op) → returns the three
 *      modified sources + per-file `changed` flags. Caller commits to disk.
 *
 *   2. a hard-failure step happens (plan id unknown, log entry exists at
 *      a different date) → returns `failedStep + reason`. Caller must NOT
 *      commit any partial in-memory results to disk.
 *
 * The plan + table writers are non-fatal on row-not-present (table mostly,
 * since not every iteration appears in every table); the plan id must
 * exist in `implementation-plan.md` itself or the call is a typo (hard
 * failure). The log writer fails hard on `log-entry-exists` (different
 * date) — the prior shipper's narrative is authoritative.
 */
export function computeAtomicUpdate(
	sources: AtomicUpdateSources,
	input: PlanIterationUpdateOrchestratedInput,
): UpdatePlanIterationResult & { sources: AtomicUpdateOutput } {
	const planResult = applyIterationUpdate(sources.planSource, input);

	// Plan no-op + not-matched-on-disk = unknown id (typo guard).
	// Plan no-op + matched-on-disk = idempotent re-run (still proceeds to
	// table + log so they can mirror if they're out-of-sync).
	if (!planResult.changed && planResult.before === null) {
		return {
			ok: false,
			changed: false,
			before: null,
			after: null,
			statusAfterReparse: null,
			planChanged: false,
			tableChanged: false,
			logChanged: false,
			failedStep: OrchestrationStep.Plan,
			reason: OrchestrationFailureReason.UnknownIterationId,
			sources: {
				planResult,
				tableResult: {
					source: sources.tableSource,
					changed: false,
					before: null,
					after: null,
				},
				logResult: null,
			},
		};
	}

	const tableResult = applyTableUpdate(sources.tableSource, {
		id: input.id,
		status: input.status,
	});

	const wantsLogEntry = input.logHeadline !== undefined && input.logBody !== undefined;
	let logResult: LogAppendResult | null = null;
	if (wantsLogEntry) {
		logResult = appendLogEntry(sources.logSource, {
			id: input.id,
			stage: deriveStageFromId(input.id),
			today: input.today,
			headline: input.logHeadline as string,
			body: input.logBody as string,
		});
		if (logResult.reason === LogAppendRefusal.LogEntryExists) {
			return {
				ok: false,
				changed: false,
				before: planResult.before,
				after: planResult.after,
				statusAfterReparse: null,
				planChanged: false,
				tableChanged: false,
				logChanged: false,
				failedStep: OrchestrationStep.Log,
				reason: OrchestrationFailureReason.LogEntryExists,
				sources: { planResult, tableResult, logResult },
			};
		}
	}

	const reparsed = parsePlan(planResult.source);
	const flatIter = reparsed.stages.flatMap((s) => s.iterations).find((i) => i.id === input.id);
	return {
		ok: true,
		changed: planResult.changed || tableResult.changed || (logResult?.changed ?? false),
		before: planResult.before,
		after: planResult.after,
		statusAfterReparse: flatIter?.status ?? null,
		planChanged: planResult.changed,
		tableChanged: tableResult.changed,
		logChanged: logResult?.changed ?? false,
		sources: { planResult, tableResult, logResult },
	};
}

/**
 * Production-edge wrapper: applies a single iteration update to ALL THREE
 * source-of-truth documents atomically (per
 * [[feedback_keep_plan_table_in_sync]]) —
 *
 *   1. `docs/implementation-plan.md`         (the iteration's status badge)
 *   2. `docs/implementation-plan-table.md`   (the at-a-glance grid)
 *   3. `docs/implementation-log.md`          (the narrative, optional)
 *
 * Build all three modified sources in memory first via `computeAtomicUpdate`;
 * write only if every step succeeded (no partial state ever lands on disk).
 *
 * Optional `logHeadline` / `logBody` arms the log-step; absent → plan +
 * table only (backwards-compatible with pre-0.12 callers).
 */
export function updatePlanIteration(
	input: PlanIterationUpdateOrchestratedInput,
): UpdatePlanIterationResult {
	const computed = computeAtomicUpdate(
		{
			planSource: readPlanSource(),
			tableSource: readPlanTableSource(),
			logSource: readLogSource(),
		},
		input,
	);
	if (!computed.ok) {
		const { sources: _sources, ...rest } = computed;
		return rest;
	}
	const { sources } = computed;
	if (sources.planResult.changed) {
		writeFileSync(repoPath("docs/implementation-plan.md"), sources.planResult.source, "utf8");
	}
	if (sources.tableResult.changed) {
		writeFileSync(repoPath("docs/implementation-plan-table.md"), sources.tableResult.source, "utf8");
	}
	if (sources.logResult?.changed) {
		writeFileSync(repoPath("docs/implementation-log.md"), sources.logResult.source, "utf8");
	}
	const { sources: _sources, ...rest } = computed;
	return rest;
}

/** The plan stage an iteration belongs to is its lead numeric segment
 *  (`9.13.5` → `9`, `13.4a.1` → `13`). The log-side `appendLogEntry`
 *  takes a `stage` arg explicitly — but `updatePlanIteration` callers
 *  haven't traditionally passed one. Derive it from the id as a fallback
 *  so the atomic call doesn't require redundant args. */
function deriveStageFromId(id: string): string {
	const m = /^([A-Z]+-?\d+|\d+)/.exec(id);
	return m?.[1] ?? id;
}

/**
 * Production-edge wrapper for `appendLogEntry` — wired as the
 * `plan.append_log_entry` MCP tool for landing a log entry post-hoc
 * without flipping plan status (the common case after an integrator
 * reconciles main; or for hand-written narratives the bare
 * `plan.update_iteration` call missed).
 */
export function appendImplementationLogEntry(input: LogAppendInput): {
	ok: boolean;
	changed: boolean;
	reason?: LogAppendRefusal;
} {
	const source = readLogSource();
	const result = appendLogEntry(source, input);
	if (result.changed) {
		writeFileSync(repoPath("docs/implementation-log.md"), result.source, "utf8");
	}
	const out: { ok: boolean; changed: boolean; reason?: LogAppendRefusal } = {
		ok: result.changed || result.reason === undefined,
		changed: result.changed,
	};
	if (result.reason !== undefined) out.reason = result.reason;
	return out;
}

export function markOQResolved(input: OQResolutionInput): {
	ok: boolean;
	changed: boolean;
	headingBefore: string | null;
	headingAfter: string | null;
	statusAfterReparse: OQStatus | null;
} {
	const source = readOQSource();
	const result = applyOQResolution(source, input);
	if (!result.changed) {
		return {
			ok: result.headingBefore !== null,
			changed: false,
			headingBefore: result.headingBefore,
			headingAfter: result.headingAfter,
			statusAfterReparse: null,
		};
	}
	writeFileSync(repoPath("docs/reference/11-open-questions.md"), result.source, "utf8");
	const reparsed = parseOpenQuestions(result.source);
	const oq = reparsed.questions.find((q) => q.id === input.id);
	return {
		ok: true,
		changed: true,
		headingBefore: result.headingBefore,
		headingAfter: result.headingAfter,
		statusAfterReparse: oq?.status ?? null,
	};
}
