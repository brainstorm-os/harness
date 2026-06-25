/**
 * Brainstorm-project seed builder (SH-6 per docs/foundations/49-self-hosting.md).
 *
 * Turns the project's own markdown source-of-truth (implementation-plan.md
 * + 11-open-questions.md + the docs index) into the four self-hosting
 * entity shapes from `@brainstorm/sdk-types`. Pure: callers supply the
 * markdown strings + optional doc path list; this module never reads disk.
 *
 * Consumers at SH-7+ (Tasks / Database / Graph / Notes) read these rows
 * back via `vaultEntities.list` filtered by entity type.
 */

import { type LogIterationEntry, isMeaningfulTitle, parseImplementationLog } from "../parse-log.ts";
import { parseOpenQuestions } from "../parse-oqs.ts";
import { parsePlan } from "../parse-plan.ts";
import type { Iteration, OpenQuestion, Stage } from "../types.ts";
import { IterationStatus as PlanIterationStatus, OQStatus as PlanOQStatus } from "../types.ts";
import {
	type SerializedMilestoneEntity,
	type SerializedReleaseEntity,
	deriveIterationSchedule,
	deriveReleaseSchedule,
	parseReleaseScope,
} from "./release-schedule.ts";
import { stripWikilinkBrackets } from "./wikilinks.ts";

export interface DesignDocSource {
	/** Repo-relative path, e.g. `docs/foundations/49-self-hosting.md`. */
	path: string;
	/** First non-empty H1 line in the file (without the leading `# `). */
	title: string;
	/** Excerpt — first ~240 chars of body, single-line. */
	excerpt: string;
}

export interface BrainstormProjectEntities {
	iterations: SerializedIterationEntity[];
	openQuestions: SerializedOpenQuestionEntity[];
	stages: SerializedStageEntity[];
	designDocs: SerializedDesignDocEntity[];
	release: SerializedReleaseEntity;
	milestones: SerializedMilestoneEntity[];
}

export interface SerializedIterationEntity {
	id: string;
	code: string;
	stageId: string;
	/** Per-section app subheading the iteration was authored under, when
	 *  its parent section sits under `# Apps`. `null` for iterations
	 *  authored under `# Infrastructure` or `# Shell`. SH-38b reads this
	 *  to bucket app-stage items past the Phase-1 window; using the
	 *  iteration's own section domain is correct because a stage like
	 *  Stage 9 splits across both the platform half (`# Infrastructure`)
	 *  and per-app sections (`# Apps`), and `stage.ownerDomain` rolls up
	 *  to the first section's domain only. */
	app: string | null;
	/** The `# Infrastructure | Shell | Apps` domain the iteration sits under.
	 *  Drives the Tasks-app project: Infrastructure / Shell are single
	 *  projects; each app under `# Apps` is its own project (via `app`). */
	domain: string | null;
	/** The `##`/`###` section heading the iteration sits under — the Tasks-app
	 *  section within its project. `null` for an app's own un-sub-sectioned
	 *  bullets. */
	section: string | null;
	title: string;
	status: string;
	summary: string;
	/** Full markdown body for this iteration (the substantive content the
	 *  seeder turns into the Notes-app body). Resolved from the
	 *  implementation log's narrative first (the canonical record for
	 *  shipped work), then from the plan-side bullet body for iterations
	 *  the log hasn't documented yet, else the empty string. The seeder
	 *  feeds this through `markdownToBlocks` to produce Lexical blocks. */
	body: string;
	completedAt: number | null;
	/** Distinct planned bar span (SH-16 fix): start/end derived per
	 *  iteration so the Timeline cascades instead of stacking. */
	scheduledStart: number;
	scheduledEnd: number;
	resolvedOQs: string[];
	createdAt: number;
	updatedAt: number;
}

export interface SerializedOpenQuestionEntity {
	id: string;
	code: string;
	number: number;
	section: string;
	title: string;
	status: string;
	where: string | null;
	question: string | null;
	resolution: string | null;
	resolutionRef: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface SerializedStageEntity {
	id: string;
	stageId: string;
	heading: string;
	status: string;
	goal: string | null;
	ownerDomain: string | null;
	iterationCodes: string[];
	exitCriteria: string[];
	createdAt: number;
	updatedAt: number;
}

export interface SerializedDesignDocEntity {
	id: string;
	path: string;
	slug: string;
	category: string;
	docNumber: number;
	title: string;
	excerpt: string;
	referencedDocs: string[];
	governingIterations: string[];
	createdAt: number;
	updatedAt: number;
}

const STABLE_TS = Date.UTC(2026, 4, 14, 0, 0, 0);
const DAY = 86_400_000;

export interface BuildOptions {
	planSource: string;
	oqSource: string;
	/** `docs/implementation-log.md` — recovers the real title + ship date
	 *  for iterations the plan condensed to a one-line log pointer. */
	logSource?: string;
	designDocs?: DesignDocSource[];
	/** Override the stable timestamp baseline; defaults to 2026-05-14 UTC. */
	now?: number;
}

export function buildBrainstormProjectEntities(opts: BuildOptions): BrainstormProjectEntities {
	const now = opts.now ?? STABLE_TS;
	const plan = parsePlan(opts.planSource);
	const oqs = parseOpenQuestions(opts.oqSource).questions;

	const log = opts.logSource
		? parseImplementationLog(opts.logSource)
		: new Map<string, LogIterationEntry>();

	const iterations: SerializedIterationEntity[] = [];
	const stages: SerializedStageEntity[] = [];

	// Stage entities are still the stage-spec-tagged aggregation only — the
	// release/calendar/graph/hub mappers + the pinned stage-boundary audit
	// baselines read these unchanged.
	for (const stage of plan.stages) {
		stages.push(
			mapStage(
				stage,
				stage.iterations.map((it) => it.id),
				now,
			),
		);
	}

	// Iteration entities are built from EVERY parsed section (the complete
	// `plan.sections`), so the named cross-cutting tracks
	// (KBN/Net/Help/Welcome/NAPI/OpenRes/Mailbox/Browser/Connector) are real
	// iterations instead of being silently dropped and then half-recovered
	// from the log. Dedupe by code: an id can appear in several sections (a
	// definition plus cross-references); keep the stage-tagged occurrence if
	// any, else the first in plan order.
	const seen = new Map<string, { it: Iteration; sectionHeading: string }>();
	for (const sec of plan.sections) {
		for (const it of sec.iterations) {
			const prev = seen.get(it.id);
			if (!prev) {
				seen.set(it.id, { it, sectionHeading: sec.title });
				continue;
			}
			if (prev.it.stageId === "" && it.stageId !== "") {
				seen.set(it.id, { it, sectionHeading: sec.title });
			}
		}
	}
	for (const { it, sectionHeading } of seen.values()) {
		iterations.push(mapIteration(it, now, log.get(it.id) ?? null, sectionHeading));
	}

	// Safety net for a log entry whose code is in neither the plan nor a
	// parsed section (genuinely undocumented shipped work). After the parser
	// fix this is normally empty — the `plan-coverage` audit is the real
	// guard against silent plan-side drops. No synthetic stage: these orphans
	// land section-less (Inbox), never an ugly catch-all project.
	const planCodes = new Set(iterations.map((it) => it.code));
	for (const [code, entry] of log) {
		if (planCodes.has(code)) continue;
		iterations.push(mapSyntheticIterationFromLog(code, entry, now));
	}

	const openQuestions = oqs.map((q) => mapOpenQuestion(q, now));

	// Cross-link: every resolved OQ shows up under the iteration whose
	// resolution-ref names it. The plan parser already captures the ref;
	// here we backfill the iteration's `resolvedOQs` list.
	const iterationByCode = new Map(iterations.map((it) => [it.code, it]));
	for (const oq of openQuestions) {
		if (!oq.resolutionRef) continue;
		const match = /([0-9]+(?:\.[0-9a-z]+)*|SH-[0-9]+|VP-[0-9]+|B[0-9]+(?:\.[0-9]+)*)/i.exec(
			oq.resolutionRef,
		);
		const code = match?.[1];
		if (!code) continue;
		const iter = iterationByCode.get(code);
		if (iter && !iter.resolvedOQs.includes(oq.code)) {
			iter.resolvedOQs.push(oq.code);
		}
	}

	const designDocs = (opts.designDocs ?? []).map((d) => mapDesignDoc(d, now));

	const { release, milestones } = deriveReleaseSchedule(stages, iterations, now);

	// Per-iteration date spans (distinct, cascading) so Timeline/Calendar
	// aren't a degenerate smear. Real log ship dates win for done work.
	const logDates = new Map<string, number | null>(
		Array.from(log.values(), (e) => [e.code, e.completedAt]),
	);
	const schedule = deriveIterationSchedule(stages, iterations, milestones, logDates, now);
	for (const it of iterations) {
		const s = schedule.get(it.code);
		if (!s) continue;
		it.scheduledStart = s.start;
		it.scheduledEnd = s.end;
		it.completedAt = s.completedAt;
		it.createdAt = s.start;
		it.updatedAt = s.completedAt ?? s.end;
	}

	const scope = parseReleaseScope(opts.planSource);
	release.scopeIncludes = scope.includes;
	release.scopeExcludes = scope.excludes;

	return { iterations, openQuestions, stages, designDocs, release, milestones };
}

function mapIteration(
	it: Iteration,
	now: number,
	log: LogIterationEntry | null,
	stageHeading: string,
): SerializedIterationEntity {
	const code = it.id;
	const id = `iter-${slugify(code)}`;
	const completed = mapStatus(it.status) === "done" ? now - DAY : null;
	// `title` and `summary` flow into plain-text surfaces (sidebar, search,
	// Tasks notes, Database grid cells). Strip `[[wikilink]]` brackets at
	// the source so every consumer sees clean prose. `body` keeps the raw
	// `[[X]]` markup — the rich-editor seeders route it through
	// `markdownToBlocks` + the wikilink resolver which converts known slugs
	// into real mention chips.
	return {
		id,
		code,
		stageId: it.stageId,
		app: it.app,
		domain: it.domain,
		section: it.section,
		title: stripWikilinkBrackets(resolveIterationTitle(it, log, stageHeading)),
		status: mapStatus(it.status),
		summary: stripWikilinkBrackets(resolveIterationSummary(it, log)),
		body: resolveIterationBody(it, log),
		completedAt: completed,
		scheduledStart: now - DAY * 30,
		scheduledEnd: now,
		resolvedOQs: [],
		createdAt: now - DAY * 30,
		updatedAt: now,
	};
}

/**
 * Build a `SerializedIterationEntity` from a log entry whose iteration
 * code didn't match any plan-side bullet (genuinely undocumented shipped
 * work — normally none, now that the parser captures every section). Date-
 * headed log entries imply shipped work; we mark these "done" with the log
 * heading date as `completedAt`. `stageId`/`domain`/`section` are empty so
 * the row is section-less (Inbox), never an ugly catch-all project. The
 * schedule layer still appends them in its second-pass "unstaged" loop, so
 * the journal mapper picks them up for the day they shipped.
 */
function mapSyntheticIterationFromLog(
	code: string,
	entry: LogIterationEntry,
	now: number,
): SerializedIterationEntity {
	const id = `iter-${slugify(code)}`;
	const title = entry.title ?? code;
	const summary = entry.summary ?? "";
	const body = entry.body ?? "";
	const completed = entry.completedAt ?? null;
	return {
		id,
		code,
		stageId: "",
		app: null,
		domain: null,
		section: null,
		title: stripWikilinkBrackets(title),
		status: completed != null ? "done" : "todo",
		summary: stripWikilinkBrackets(summary),
		body,
		completedAt: completed,
		scheduledStart: completed ?? now - DAY,
		scheduledEnd: completed ?? now,
		resolvedOQs: [],
		createdAt: completed ?? now - DAY,
		updatedAt: completed ?? now,
	};
}

/**
 * Body resolution for the seeded iteration Note: the log's full narrative
 * (the canonical record for shipped work, markdown-preserving) → the
 * plan-side bullet body when the log hasn't documented this iteration yet
 * → the empty string when neither source has prose worth showing.
 *
 * Returning the raw markdown lets the seeder reuse `markdownToBlocks` and
 * produce headings / lists / code / tables verbatim, matching the
 * design-doc seeder's rich-body output.
 */
function resolveIterationBody(it: Iteration, log: LogIterationEntry | null): string {
	if (log?.body) return log.body;
	const planBody = it.body.trim();
	if (planBody.length === 0) return "";
	// Keep the full prose — only the leading status marker + separator dash are
	// stripped. (A previous `→.*$` strip cut everything after the first arrow,
	// which mangled legitimate `A → B → C` flow prose into a fragment; the real
	// trailing doc pointers use the em-dash `— detail in [log]` form anyway, and
	// reading as one extra clause is far better than losing the body.)
	const cleaned = stripStatusPrefix(planBody)
		.replace(/^[\s—–-]+/, "")
		.replace(/\s*—\s*detail in \[[^\]]*\]\([^)]*\)\.?\s*$/i, "")
		.trim();
	return cleaned;
}

/**
 * Title resolution, in priority: the log's recovered title (real
 * description for condensed/archived iterations) → the plan body's first
 * sentence when it's a real phrase (future iterations carry their title
 * inline) → the stage heading as a last resort. Never `"— ✅"` or empty.
 */
function resolveIterationTitle(
	it: Iteration,
	log: LogIterationEntry | null,
	stageHeading: string,
): string {
	if (log?.title) return log.title;
	const planTitle = firstLine(it.body);
	if (isMeaningfulTitle(planTitle)) return planTitle;
	return stageHeading;
}

/**
 * Body/notes resolution: the log narrative's first paragraph (the real
 * body for condensed iterations) → the plan paragraph with the status
 * prefix / separator / `→ [log]` pointer stripped, if it's real prose →
 * empty (a bare title beats `"✅ DONE — ✅. → implementation-log.md"`).
 */
function resolveIterationSummary(it: Iteration, log: LogIterationEntry | null): string {
	if (log?.summary) return log.summary;
	const cleaned = stripStatusPrefix(firstParagraph(it.body))
		.replace(/^[\s—–-]+/, "")
		.replace(/\s*→.*$/, "")
		.trim();
	return isMeaningfulTitle(cleaned) ? cleaned : "";
}

function mapStage(stage: Stage, iterationCodes: string[], now: number): SerializedStageEntity {
	return {
		id: `stage-${slugify(stage.stageId)}`,
		stageId: stage.stageId,
		heading: stage.heading,
		status: mapStatus(stage.status),
		goal: stage.goal,
		ownerDomain: stage.ownerDomain,
		iterationCodes,
		exitCriteria: stage.exitCriteria.slice(),
		createdAt: now - DAY * 30,
		updatedAt: now,
	};
}

function mapOpenQuestion(q: OpenQuestion, now: number): SerializedOpenQuestionEntity {
	return {
		id: `oq-${slugify(q.id)}`,
		code: q.id,
		number: q.number,
		section: q.section,
		title: q.title,
		status: mapOQStatus(q.status),
		where: q.where,
		question: q.question,
		resolution: q.resolution,
		resolutionRef: q.resolutionRef,
		createdAt: now - DAY * 30,
		updatedAt: now,
	};
}

function mapDesignDoc(d: DesignDocSource, now: number): SerializedDesignDocEntity {
	const { category, docNumber, slug } = parseDocPath(d.path);
	return {
		id: `doc-${slug ? slug : `n${docNumber}`}`,
		path: d.path,
		slug,
		category,
		docNumber,
		title: d.title,
		excerpt: d.excerpt,
		referencedDocs: [],
		governingIterations: [],
		createdAt: now - DAY * 30,
		updatedAt: now,
	};
}

function mapStatus(s: PlanIterationStatus): string {
	switch (s) {
		case PlanIterationStatus.Done:
			return "done";
		case PlanIterationStatus.Partial:
			return "partial";
		case PlanIterationStatus.PreviewDrop:
			return "preview-drop";
		case PlanIterationStatus.Pending:
			return "pending";
		case PlanIterationStatus.Reverted:
			return "reverted";
		default:
			return "todo";
	}
}

function mapOQStatus(s: PlanOQStatus): string {
	return s === PlanOQStatus.Resolved ? "resolved" : "open";
}

const VALID_CATEGORIES = new Set([
	"foundations",
	"apps",
	"shell",
	"data",
	"editing",
	"security",
	"platform",
	"reference",
	"art",
]);

export function parseDocPath(path: string): { category: string; docNumber: number; slug: string } {
	const trimmed = path.replace(/^\/+/, "");
	const parts = trimmed.split("/");
	// Expect: docs/<category>/<NN-slug>.md  OR docs/<NN-slug>.md
	const file = parts[parts.length - 1] ?? "";
	const categoryRaw = parts.length >= 3 ? (parts[parts.length - 2] ?? "") : "foundations";
	const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : "foundations";
	const m = /^(\d+)[a-z]?-(.+?)\.md$/i.exec(file);
	if (!m) {
		return { category, docNumber: 0, slug: file.replace(/\.md$/, "") };
	}
	const docNumber = Number.parseInt(m[1] ?? "0", 10);
	const slug = m[2] ?? "";
	return { category, docNumber, slug };
}

/**
 * Extracts a SHORT title from an iteration body — first sentence,
 * status-marker stripped, clipped to ~80 chars. Iterations in the plan
 * are one long markdown paragraph; without this clip, the "title" balloons
 * into the whole iteration narrative (which the Notes-app surface then
 * renders as a hundred-pixel headline and the window-title footer
 * truncates).
 *
 * Strips a leading status indicator like "✅", "🟡", "⚪", "↩️" (optionally
 * followed by `.` / `DONE` / a date) so the title is the iteration's
 * topic, not its lifecycle marker.
 */
function firstLine(body: string): string {
	const trimmed = body.trim();
	const nl = trimmed.indexOf("\n");
	const head = nl === -1 ? trimmed : trimmed.slice(0, nl).trim();
	const stripped = stripMarkdown(head);
	// The plan's condensed form is `<status> — <title> → [log]`; after the
	// status prefix a separator dash leads the real title. Drop it (and
	// the `→ [log]` pointer tail) so the topic isn't `"— foo"`.
	const cleaned = stripStatusPrefix(stripped)
		.replace(/^[\s]*[—–-]+\s*/, "")
		.replace(/\s*→.*$/, "")
		.trim();
	const sentenceEnd = cleaned.search(/[.!?](?:\s|$)/);
	const sentence = sentenceEnd === -1 ? cleaned : cleaned.slice(0, sentenceEnd);
	const trimmedSentence = sentence.trim();
	if (trimmedSentence.length <= 80) return trimmedSentence;
	return `${trimmedSentence.slice(0, 77).trimEnd()}…`;
}

const STATUS_PREFIX_RE =
	/^(?:(?:✅|🟡|⚪|↩️|🛠️|✓)\s*\.?\s*)*(?:(?:DONE|PENDING|pending|partial|reverted|in-flight)\b\s*\.?\s*)?(?:\([^)]*\)\s*\.?\s*)?/u;

export function stripStatusPrefix(s: string): string {
	return s.replace(STATUS_PREFIX_RE, "").trimStart();
}

function firstParagraph(body: string): string {
	const trimmed = body.trim();
	const blank = trimmed.search(/\n\s*\n/);
	const head = blank === -1 ? trimmed : trimmed.slice(0, blank).trim();
	return stripMarkdown(head).slice(0, 480);
}

export function stripMarkdown(s: string): string {
	return s
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
