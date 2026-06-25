import { parseOpenQuestions } from "../parse-oqs.ts";
import { parsePlan } from "../parse-plan.ts";
import { readOQSource, readPlanSource } from "../resources.ts";
import type { Iteration, IterationStatus, OQStatus, OpenQuestion } from "../types.ts";

export interface IterationFilter {
	stage?: string;
	status?: IterationStatus | "any";
}

export interface IterationListing {
	id: string;
	stageId: string;
	status: IterationStatus;
	summary: string;
}

export interface OpenQuestionFilter {
	stage?: string;
	status?: OQStatus | "any";
}

export interface OpenQuestionListing {
	id: string;
	number: number;
	section: string;
	title: string;
	status: OQStatus;
	resolutionRef: string | null;
}

/**
 * Returns every iteration in the plan as a flat listing, filtered by
 * `stage` (matches the stage id, e.g. "9" or "9.12") and/or `status`.
 * Pure: caller supplies the parsed plan; the production tool wires
 * `readPlanSource()` + `parsePlan()` at the edge.
 */
export function filterIterations(
	stages: { stageId: string; iterations: Iteration[] }[],
	filter: IterationFilter = {},
): IterationListing[] {
	const wantStatus = filter.status && filter.status !== "any" ? filter.status : null;
	const wantStage = filter.stage?.trim() ?? "";
	const out: IterationListing[] = [];
	for (const stage of stages) {
		if (wantStage && !stageMatches(stage.stageId, wantStage)) continue;
		for (const iter of stage.iterations) {
			if (wantStatus && iter.status !== wantStatus) continue;
			out.push({
				id: iter.id,
				stageId: iter.stageId,
				status: iter.status,
				summary: firstLine(iter.body),
			});
		}
	}
	return out;
}

export function filterOpenQuestions(
	questions: OpenQuestion[],
	filter: OpenQuestionFilter = {},
): OpenQuestionListing[] {
	const wantStatus = filter.status && filter.status !== "any" ? filter.status : null;
	const wantStage = filter.stage?.trim() ?? "";
	const out: OpenQuestionListing[] = [];
	for (const q of questions) {
		if (wantStatus && q.status !== wantStatus) continue;
		if (wantStage && !oqMentionsStage(q, wantStage)) continue;
		out.push({
			id: q.id,
			number: q.number,
			section: q.section,
			title: q.title,
			status: q.status,
			resolutionRef: q.resolutionRef,
		});
	}
	return out;
}

/**
 * Production-edge wrapper: loads + parses + filters in one call.
 */
export function listIterations(filter: IterationFilter = {}): IterationListing[] {
	const plan = parsePlan(readPlanSource());
	return filterIterations(plan.stages, filter);
}

export function listOpenQuestions(filter: OpenQuestionFilter = {}): OpenQuestionListing[] {
	const oqs = parseOpenQuestions(readOQSource());
	return filterOpenQuestions(oqs.questions, filter);
}

function stageMatches(actual: string, want: string): boolean {
	if (actual === want) return true;
	// `want` "9" should match any "9", "9a", "9b"; not "10". Match by exact
	// or by the leading-digits prefix being equal.
	const wantDigits = leadingDigits(want);
	const actualDigits = leadingDigits(actual);
	return wantDigits.length > 0 && wantDigits === actualDigits;
}

function oqMentionsStage(q: OpenQuestion, stage: string): boolean {
	const haystack = `${q.where ?? ""} ${q.section ?? ""} ${q.body ?? ""}`.toLowerCase();
	const wantStage = stage.toLowerCase();
	// Match "stage 9" / "stages 9" / "stage 9 and 10" etc. We tokenise the
	// haystack on non-alphanumeric characters and look for a "stage" /
	// "stages" token immediately followed by tokens up to a stage id
	// equal to `wantStage`. The walk is short — OQ bodies are paragraphs.
	const tokens = haystack.split(/[^a-z0-9]+/);
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t !== "stage" && t !== "stages") continue;
		// scan forward up to ~6 tokens for the target stage id
		for (let j = i + 1; j < Math.min(tokens.length, i + 8); j++) {
			if (tokens[j] === wantStage) return true;
		}
	}
	return false;
}

function leadingDigits(s: string): string {
	const match = /^(\d+)/.exec(s);
	return match?.[1] ?? "";
}

function firstLine(body: string): string {
	const trimmed = body.trim();
	const newline = trimmed.indexOf("\n");
	return newline === -1 ? trimmed : trimmed.slice(0, newline).trim();
}
