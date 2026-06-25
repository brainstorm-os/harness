import { spawnSync } from "node:child_process";
import { findRepoRoot } from "../repo.ts";

export interface TypecheckDiagnostic {
	file: string;
	line: number;
	column: number;
	code: string;
	message: string;
}

export interface TypecheckReport {
	ok: boolean;
	errorCount: number;
	errors: TypecheckDiagnostic[];
	raw: string;
}

export interface LintDiagnostic {
	file: string;
	line: number;
	column: number;
	rule: string;
	severity: "error" | "warning" | "info";
	message: string;
}

export interface LintReport {
	ok: boolean;
	errorCount: number;
	warningCount: number;
	diagnostics: LintDiagnostic[];
	raw: string;
}

/**
 * Runs `bun run typecheck` (= `tsc --noEmit`) and folds the human-readable
 * compiler output into structured diagnostics. Returns `ok: true` only when
 * the compiler produced zero `error TS####` lines.
 */
export function runTypecheck(): TypecheckReport {
	const result = spawnSync("bun", ["run", "typecheck"], {
		cwd: findRepoRoot(),
		encoding: "utf8",
		env: { ...process.env, FORCE_COLOR: "0" },
		maxBuffer: 32 * 1024 * 1024,
	});
	const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	return parseTypecheckOutput(raw);
}

const TSC_LINE_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;

export function parseTypecheckOutput(raw: string): TypecheckReport {
	const errors: TypecheckDiagnostic[] = [];
	const re = new RegExp(TSC_LINE_RE.source, TSC_LINE_RE.flags);
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: stdlib regex iteration pattern
	while ((match = re.exec(raw)) !== null) {
		errors.push({
			file: match[1] ?? "",
			line: Number.parseInt(match[2] ?? "0", 10),
			column: Number.parseInt(match[3] ?? "0", 10),
			code: match[4] ?? "",
			message: match[5] ?? "",
		});
	}
	return {
		ok: errors.length === 0,
		errorCount: errors.length,
		errors,
		raw,
	};
}

/**
 * Runs `bunx biome check . --reporter=json` and folds the JSON diagnostics
 * into structured `LintDiagnostic` rows. Returns `ok: true` when zero
 * error-severity entries surface (warnings do not flip `ok`).
 */
export function runLint(): LintReport {
	const result = spawnSync("bunx", ["biome", "check", ".", "--reporter=json"], {
		cwd: findRepoRoot(),
		encoding: "utf8",
		env: { ...process.env, FORCE_COLOR: "0" },
		maxBuffer: 32 * 1024 * 1024,
	});
	const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	return parseLintOutput(raw);
}

interface BiomeJsonLocation {
	path?: { file?: string } | string;
	span?: [number, number];
	sourceCode?: string;
}

interface BiomeJsonDiagnostic {
	category?: string;
	severity?: string;
	description?: string;
	message?: { content?: Array<{ content?: string }> | string };
	location?: BiomeJsonLocation;
}

interface BiomeJsonReport {
	diagnostics?: BiomeJsonDiagnostic[];
	files?: Record<string, { lines?: Array<{ lineStart?: number }>; content?: string }>;
}

export function parseLintOutput(raw: string): LintReport {
	const parsed = extractFirstJsonObject(raw, (obj) => Array.isArray(obj.diagnostics));
	const diagnostics: LintDiagnostic[] = [];
	if (parsed) {
		const report = parsed as BiomeJsonReport;
		for (const d of report.diagnostics ?? []) {
			const severity = normaliseSeverity(d.severity);
			const filePath = extractBiomeFile(d.location);
			const offset = d.location?.span?.[0] ?? 0;
			const source = d.location?.sourceCode ?? report.files?.[filePath]?.content ?? "";
			const { line, column } = offsetToLineColumn(source, offset);
			diagnostics.push({
				file: filePath,
				line,
				column,
				rule: d.category ?? "biome/unknown",
				severity,
				message: biomeMessage(d),
			});
		}
	}
	const errorCount = diagnostics.filter((d) => d.severity === "error").length;
	const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
	return {
		ok: errorCount === 0,
		errorCount,
		warningCount,
		diagnostics,
		raw,
	};
}

function extractBiomeFile(location: BiomeJsonLocation | undefined): string {
	if (!location?.path) return "";
	if (typeof location.path === "string") return location.path;
	return location.path.file ?? "";
}

function normaliseSeverity(s: string | undefined): "error" | "warning" | "info" {
	const lower = (s ?? "").toLowerCase();
	if (lower === "error" || lower === "fatal") return "error";
	if (lower === "warning") return "warning";
	return "info";
}

function biomeMessage(d: BiomeJsonDiagnostic): string {
	if (typeof d.description === "string" && d.description.length > 0) return d.description;
	const c = d.message?.content;
	if (typeof c === "string") return c;
	if (Array.isArray(c)) return c.map((p) => p.content ?? "").join("");
	return "";
}

function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
	if (!source || offset <= 0) return { line: 1, column: 1 };
	let line = 1;
	let lastNewline = -1;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source[i] === "\n") {
			line++;
			lastNewline = i;
		}
	}
	return { line, column: offset - lastNewline };
}

export interface FailingTest {
	fullName: string;
	message: string;
}

export interface FailingFile {
	name: string;
	failingTests: FailingTest[];
}

export interface TestRunReport {
	ok: boolean;
	totalFiles: number;
	totalTests: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
	failingFiles: FailingFile[];
	raw: string;
}

interface VitestAssertionResult {
	fullName?: string;
	title?: string;
	ancestorTitles?: string[];
	status?: string;
	failureMessages?: string[];
}

interface VitestFileResult {
	name?: string;
	status?: string;
	startTime?: number;
	endTime?: number;
	assertionResults?: VitestAssertionResult[];
}

interface VitestJsonReport {
	numTotalTestSuites?: number;
	numTotalTests?: number;
	numPassedTests?: number;
	numFailedTests?: number;
	numPendingTests?: number;
	startTime?: number;
	testResults?: VitestFileResult[];
}

/**
 * Runs `bun --bun vitest run --reporter=json --silent` and parses the
 * JSON report into the structured shape callers consume. Caller can scope
 * to a path / pattern via `pattern` (forwarded as a positional argument
 * to vitest, e.g. "apps/tasks").
 */
export function runTests(pattern?: string): TestRunReport {
	const args = ["--bun", "vitest", "run", "--reporter=json", "--silent"];
	if (pattern && pattern.trim().length > 0) {
		args.push(pattern);
	}
	const result = spawnSync("bun", args, {
		cwd: findRepoRoot(),
		encoding: "utf8",
		env: { ...process.env, FORCE_COLOR: "0" },
		maxBuffer: 64 * 1024 * 1024,
	});
	const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	return parseVitestJsonReport(raw);
}

/**
 * Pure parser over the combined stdout+stderr of a vitest JSON-reporter run.
 * Extracts the first top-level JSON object that has the vitest shape and
 * folds it into the report. Non-JSON noise on either stream is ignored,
 * so the function survives `--silent` chatter or a stderr deprecation note.
 */
export function parseVitestJsonReport(raw: string): TestRunReport {
	const report: TestRunReport = {
		ok: false,
		totalFiles: 0,
		totalTests: 0,
		passed: 0,
		failed: 0,
		skipped: 0,
		durationMs: 0,
		failingFiles: [],
		raw,
	};
	const parsed = extractVitestJson(raw);
	if (parsed === null) return report;

	report.totalFiles = parsed.testResults?.length ?? parsed.numTotalTestSuites ?? 0;
	report.totalTests = parsed.numTotalTests ?? 0;
	report.passed = parsed.numPassedTests ?? 0;
	report.failed = parsed.numFailedTests ?? 0;
	report.skipped = parsed.numPendingTests ?? 0;

	if (typeof parsed.startTime === "number" && Array.isArray(parsed.testResults)) {
		let latestEnd = parsed.startTime;
		for (const file of parsed.testResults) {
			if (typeof file.endTime === "number" && file.endTime > latestEnd) {
				latestEnd = file.endTime;
			}
		}
		report.durationMs = Math.max(0, latestEnd - parsed.startTime);
	}

	for (const file of parsed.testResults ?? []) {
		if (file.status !== "failed") continue;
		const failingTests: FailingTest[] = [];
		for (const a of file.assertionResults ?? []) {
			if (a.status !== "failed") continue;
			failingTests.push({
				fullName: assertionName(a),
				message: (a.failureMessages ?? []).join("\n").trim(),
			});
		}
		report.failingFiles.push({
			name: file.name ?? "<unknown file>",
			failingTests,
		});
	}

	report.ok = report.failed === 0 && report.failingFiles.length === 0;
	return report;
}

function assertionName(a: VitestAssertionResult): string {
	if (typeof a.fullName === "string" && a.fullName.length > 0) return a.fullName;
	const parts = [...(a.ancestorTitles ?? []), a.title ?? ""].filter((p) => p.length > 0);
	return parts.join(" > ");
}

/**
 * Greedy-scan the combined output for a `{ ... }` block that parses as
 * JSON and carries the `numTotalTests` field. Vitest's JSON reporter
 * writes one such object; any other JSON noise (e.g. a Bun deprecation
 * notice) is skipped over.
 */
function extractVitestJson(raw: string): VitestJsonReport | null {
	const obj = extractFirstJsonObject(
		raw,
		(c) =>
			typeof c.numTotalTests === "number" ||
			typeof c.numPassedTests === "number" ||
			Array.isArray(c.testResults),
	);
	return obj === null ? null : (obj as VitestJsonReport);
}

function extractFirstJsonObject(
	raw: string,
	predicate: (obj: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
	let cursor = 0;
	while (cursor < raw.length) {
		const start = raw.indexOf("{", cursor);
		if (start === -1) return null;
		const end = findMatchingBrace(raw, start);
		if (end === -1) return null;
		try {
			const candidate = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
			if (predicate(candidate)) return candidate;
		} catch {
			// keep scanning
		}
		cursor = start + 1;
	}
	return null;
}

function findMatchingBrace(raw: string, openIdx: number): number {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = openIdx; i < raw.length; i++) {
		const ch = raw[i];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (ch === "\\") {
				escaped = true;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}
