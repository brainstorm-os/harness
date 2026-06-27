/**
 * "Iterations shipped without a test signal" audit (enforces workflow
 * standard #1, "New features ship with tests", per CLAUDE.md /
 * docs/implementation-plan.md).
 *
 * The signal is exact-over-the-docs, not RAG-fuzzy: for every Done (✅)
 * iteration we concatenate its plan bullet body with its implementation-log
 * narrative (the authoritative shipped-work record) and look for any
 * test-shaped token (`test`, `vitest`, `playwright`, `coverage`, a
 * `*.test.ts` path, …). A Done iteration whose combined narrative mentions
 * no test is flagged — either the work shipped without tests, or the log
 * entry under-describes it. Like `i18n.find_bare_strings`, this is a HINT
 * surface, not a hard gate: false positives are expected (some iterations
 * are pure docs/infra and legitimately carry no test), so the output is for
 * a human/agent to triage, never to fail CI on.
 */

import { parseImplementationLog } from "../parse-log.ts";
import { parsePlan } from "../parse-plan.ts";
import { readLogSource, readPlanSource } from "../resources.ts";
import type { Iteration, IterationStatus } from "../types.ts";
import { IterationStatus as Status } from "../types.ts";

export interface LogEntryLike {
	title: string | null;
	summary: string | null;
	body: string | null;
}

export enum UntestedReason {
	/** A log entry exists for the iteration but its narrative mentions no
	 *  test work — most likely a real gap or an under-described landing. */
	LogEntryNoTestMention = "log-entry-no-test-mention",
	/** No implementation-log entry at all, and the terse plan bullet carries
	 *  no test token — coverage is simply unverifiable from the docs. */
	NoLogEntry = "no-log-entry",
}

export interface UntestedIteration {
	id: string;
	stageId: string;
	app: string | null;
	status: IterationStatus;
	hasLogEntry: boolean;
	reason: UntestedReason;
	/** Clipped narrative the auditor scanned, for quick eyeballing. */
	preview: string;
}

export interface UntestedReport {
	/** True when nothing was flagged. */
	ok: boolean;
	/** Iterations considered (those matching `statuses`). */
	considered: number;
	/** Considered iterations that DID carry a test signal. */
	withTestSignal: number;
	/** Considered iterations with no test signal AND no code signal — likely
	 *  pure docs / OQ / planning work to which "ship with tests" doesn't
	 *  apply. Excluded from `flagged` to keep it a genuine-gap list. */
	skippedNoCodeSignal: number;
	flagged: UntestedIteration[];
}

export interface UntestedOptions {
	/** Statuses to audit. Default: Done only — "ship with tests" applies to
	 *  shipped work; in-flight iterations are expected to be incomplete. */
	statuses?: readonly IterationStatus[];
}

// A test-shaped token anywhere in the narrative. `\btest(s|ed|ing)?\b`
// covers "property test", "tested", "unit tests"; the `*.test.tsx?` arm
// catches a bare file path. Word boundaries keep "latest"/"fastest" out.
const TEST_SIGNAL_RE =
	/\btest(?:s|ed|ing)?\b|\bspecs?\b|\bvitest\b|\bplaywright\b|\bcoverage\b|\bproperty[-\s]?test\b|\bround[-\s]?trip\b|\bassertions?\b|\be2e\b|\bdogfood\b|\.(?:test|spec)\.tsx?\b/i;

// A code-touching signal: a real source path (`packages/…`, `apps/…`,
// `src/…`), a `.ts`/`.tsx` file, or an extension-suffixed module name. The
// "ship with tests" bar only applies to iterations that changed code — a
// pure docs / OQ-resolution / plan-reconciliation iteration legitimately
// carries no test, and flagging it is noise. An iteration with NO code
// signal is reported as `skippedNoCodeSignal` (a count), never `flagged`.
const CODE_SIGNAL_RE =
	/\b(?:packages|apps|tools)\/[\w./-]+|\bsrc\/[\w./-]+|\b[\w-]+\.(?:ts|tsx|mjs|css)\b/i;

function narrativeFor(iter: Iteration, log: LogEntryLike | undefined): string {
	return [iter.body, log?.title, log?.summary, log?.body].filter(Boolean).join("\n");
}

function clip(text: string, max = 160): string {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Pure auditor: caller supplies the parsed plan stages and the log
 * `code → entry` map (the production wrapper wires `parsePlan` +
 * `parseImplementationLog`). Same input → same output.
 */
export function findUntestedIterations(
	stages: readonly { stageId: string; iterations: readonly Iteration[] }[],
	logEntries: ReadonlyMap<string, LogEntryLike>,
	opts: UntestedOptions = {},
): UntestedReport {
	const statuses = new Set<IterationStatus>(opts.statuses ?? [Status.Done]);
	let considered = 0;
	let withTestSignal = 0;
	let skippedNoCodeSignal = 0;
	const flagged: UntestedIteration[] = [];

	for (const stage of stages) {
		for (const iter of stage.iterations) {
			if (!statuses.has(iter.status)) continue;
			considered++;
			const log = logEntries.get(iter.id);
			const narrative = narrativeFor(iter, log);
			if (TEST_SIGNAL_RE.test(narrative)) {
				withTestSignal++;
				continue;
			}
			if (!CODE_SIGNAL_RE.test(narrative)) {
				skippedNoCodeSignal++;
				continue;
			}
			flagged.push({
				id: iter.id,
				stageId: iter.stageId,
				app: iter.app,
				status: iter.status,
				hasLogEntry: log !== undefined,
				reason: log !== undefined ? UntestedReason.LogEntryNoTestMention : UntestedReason.NoLogEntry,
				preview: clip(narrative),
			});
		}
	}

	return { ok: flagged.length === 0, considered, withTestSignal, skippedNoCodeSignal, flagged };
}

/**
 * Production-edge wrapper: loads + parses the plan and the implementation
 * log, then audits in one call.
 */
export function auditUntestedIterations(opts: UntestedOptions = {}): UntestedReport {
	const plan = parsePlan(readPlanSource());
	const log = parseImplementationLog(readLogSource());
	return findUntestedIterations(plan.stages, log, opts);
}
