/**
 * Mapper from seeded iterations → Notes-app `Note/v1` rows.
 *
 * Per the user's "open tasks in notes for editing" direction: every
 * iteration in `implementation-plan.md` becomes a Note keyed by iteration
 * code (`9.14.1`, `SH-7`, etc.). The seeded body is a real document, not a
 * one-line summary:
 *
 *   1. Title node
 *   2. A short metadata card (status · stage · scheduled / completed dates,
 *      optional resolved-OQs bullet list)
 *   3. Horizontal rule
 *   4. The iteration's full narrative — the implementation log's prose if
 *      one is recorded, else the plan-side bullet body — rendered through
 *      the shared `markdownToBlocks` so headings / lists / code / tables
 *      are preserved (mirrors the design-doc seeder's rich-body output).
 *
 * Doesn't displace the Task seed — both flows write rows: Tasks holds the
 * status-pill row, Notes holds the editable body. Cross-app navigation
 * arrives when the Tasks renderer learns to dispatch `intent.open` against
 * the Note id. For now the user can browse Notes directly to find any
 * iteration by title.
 */

import type { SerializedIterationEntity } from "./brainstorm-project.ts";
import {
	headingBlock,
	listBlock,
	markdownToBlocks,
	paragraph,
	ruleBlock,
	textInline,
} from "./docs-to-notes.ts";
import { dayKey } from "./plan-to-journal.ts";
import type { SeedBlock, SeedNote } from "./types.ts";
import {
	EMPTY_WIKILINK_RESOLVER,
	type WikilinkResolver,
	stripWikilinkBrackets,
} from "./wikilinks.ts";

const STABLE_TS = Date.UTC(2026, 4, 14);

const STATUS_EMOJI: Record<string, string> = {
	done: "✅",
	"in-flight": "🟡",
	partial: "🟡",
	pending: "⚪",
	reverted: "↩️",
};

/** Human-facing status label for the metadata card — keeps the same casing
 *  we use in the plan + tasks UI. */
const STATUS_LABEL: Record<string, string> = {
	done: "Done",
	"in-flight": "In flight",
	partial: "Partial",
	pending: "Pending",
	reverted: "Reverted",
};

/**
 * Stable id for the iteration-as-note row. Distinct from the
 * `iteration:<code>` key used in the self-hosting app and the
 * `task:<id>` key used in the Tasks app — the Note has its own namespace
 * so the three rows can coexist without collision, and the id is
 * deterministic so re-running the seed overwrites in place.
 */
export function iterationNoteId(iteration: SerializedIterationEntity): string {
	return `iteration-${iteration.code.replace(/\./g, "-")}`;
}

/** The "last edited" instant a seeded iteration-note carries: the
 *  iteration's REAL history — when it actually completed, else its
 *  per-iteration scheduled end (always set by the project seeder). This
 *  is why the Notes date-sections (Today / Previous 7 days / by month)
 *  reflect true project history instead of every iteration collapsing to
 *  "just now". `now`/`STABLE_TS` is retained only as the signature's
 *  determinism anchor for callers that pass synthetic fixtures. */
function iterationTimestamp(it: SerializedIterationEntity): number {
	return it.completedAt ?? it.scheduledEnd;
}

export function buildIterationsAsNotes(
	iterations: readonly SerializedIterationEntity[],
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
	// Kept for signature/determinism compat with the other seed builders
	// (docs/iterations share a `(items, now)` shape); the timestamp now
	// comes from each iteration's real history, not a synthetic offset.
	_now: number = STABLE_TS,
): SeedNote[] {
	return iterations.map((it) => iterationToNote(it, iterationTimestamp(it), resolver));
}

export function iterationToNote(
	it: SerializedIterationEntity,
	ts: number,
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedNote {
	const emoji = STATUS_EMOJI[it.status] ?? "🛠️";
	// Note titles are surfaced in the sidebar / search / window header as
	// plain text; wikilinks in the upstream title collapse to their label.
	const title = `${it.code} — ${stripWikilinkBrackets(it.title)}`;
	return {
		id: iterationNoteId(it),
		title,
		icon: { kind: "emoji", value: emoji },
		// Cross-link to the source Iteration entity so the graph paints a
		// `Note/about` edge and the iteration-note isn't a graph-orphan
		// when its body has no wikilinks (SH-37). The Iteration entity's
		// own id is the canonical target.
		aboutEntityId: it.id,
		body: {
			root: {
				type: "root",
				version: 1,
				format: "",
				indent: 0,
				direction: null,
				children: [titleNode(title), ...iterationBodyBlocks(it, resolver)],
			},
		},
		values: {
			"iteration-code": it.code,
			"iteration-stage": it.stageId,
			"iteration-status": it.status,
		},
		createdAt: ts,
		updatedAt: ts,
	};
}

function titleNode(title: string): SeedBlock {
	return {
		type: "title",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		textFormat: 0,
		textStyle: "",
		children: [textInline(title)],
	};
}

/** Compose the iteration's seeded body: metadata card → rule → narrative.
 *  Pure: every branch is driven by the SerializedIterationEntity fields, no
 *  IO, no time-of-call surprises. */
function iterationBodyBlocks(
	it: SerializedIterationEntity,
	resolver: WikilinkResolver,
): SeedBlock[] {
	const blocks: SeedBlock[] = [];

	blocks.push(headingBlock(3, "Status & timing"));
	blocks.push(paragraph([textInline(metadataLine(it))]));
	blocks.push(paragraph([textInline(scheduleLine(it))]));

	if (it.resolvedOQs.length > 0) {
		blocks.push(headingBlock(3, "Resolved questions"));
		blocks.push(listBlock(false, [...it.resolvedOQs]));
	}

	const narrative = narrativeBlocks(it, resolver);
	if (narrative.length > 0) {
		blocks.push(ruleBlock());
		blocks.push(...narrative);
	}

	return blocks;
}

/** First metadata row — status + stage. Joined with `·` so the card reads
 *  as one compact line in the editor. */
function metadataLine(it: SerializedIterationEntity): string {
	const status = STATUS_LABEL[it.status] ?? it.status;
	return `Status: ${status} · Stage ${it.stageId}`;
}

/** Second metadata row — scheduled span, plus the completed date if the
 *  iteration shipped. Dates are UTC `YYYY-MM-DD` to stay stable across
 *  seeder runs in any timezone. */
function scheduleLine(it: SerializedIterationEntity): string {
	const start = dayKey(it.scheduledStart);
	const end = dayKey(it.scheduledEnd);
	const base = `Scheduled: ${start} → ${end}`;
	if (it.completedAt === null) return base;
	return `${base} · Completed: ${dayKey(it.completedAt)}`;
}

/** Render the iteration's narrative as Lexical blocks. Empty when neither
 *  the log nor the plan body carries prose — the metadata card stands on
 *  its own in that case. The summary line is appended as a fallback
 *  paragraph for iterations whose only narrative is the one-line summary
 *  (so the card still has *some* prose body underneath). */
function narrativeBlocks(it: SerializedIterationEntity, resolver: WikilinkResolver): SeedBlock[] {
	const md = it.body.trim();
	if (md.length > 0) return markdownToBlocks(md, resolver);
	const summary = it.summary.trim();
	if (summary.length === 0) return [];
	return [paragraph([textInline(summary)])];
}
