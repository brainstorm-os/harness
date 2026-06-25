/**
 * Mapper from completed iterations → Journal daily entries (SH-20 per
 * docs/foundations/49-self-hosting.md).
 *
 * The Journal app has no entity type — it projects every Note whose title
 * is exactly a canonical ISO date (`YYYY-MM-DD`, per
 * `apps/journal/src/logic/journal-keys.ts`). So the engineering log is
 * built by grouping iterations by their real `completedAt` day and
 * emitting one dated Note per active day. These rows share the Notes
 * app's `note:` keyspace with the design-doc + iteration notes (distinct
 * id namespace: `journal-<date>`), so the seed loop stays one source of
 * truth.
 *
 * Voice: first-person engineer diary, not a bullet list of shipped codes.
 * Each entry opens with a paragraph reflecting on the day, walks through
 * each iteration as its own short section (H3 + 1–2 paragraphs drawing on
 * the parsed log's title + summary + body), and closes by noting which
 * open questions got put to bed. The per-iteration `title` / `summary` /
 * `body` are already populated by `brainstorm-project.ts` from the
 * implementation-log narrative, so this mapper just shapes them into prose.
 *
 * `[[wikilink]]` references in the source narrative are routed through the
 * shared inline parser: known iteration / OQ / design-doc / stage /
 * milestone / release slugs become real `MentionNode` chips, anything else
 * (memory-file pointers like `[[feedback_x]]`) collapses to plain text.
 *
 * Pure. Deterministic in `iterations` (dates come from `completedAt`,
 * itself derived from the plan's "✅ DONE (YYYY-MM-DD)" markers).
 */

import type { SerializedIterationEntity } from "./brainstorm-project.ts";
import type { SeedBlock, SeedEditorState, SeedInline, SeedNote } from "./types.ts";
import {
	EMPTY_WIKILINK_RESOLVER,
	type WikilinkResolver,
	parseInlineWithMentions,
	stripWikilinkBrackets,
} from "./wikilinks.ts";

/** UTC `YYYY-MM-DD` for an epoch — the exact shape the Journal app's
 *  `parseJournalDateKey` accepts (`^\d{4}-\d{2}-\d{2}$`). */
export function dayKey(ms: number): string {
	const d = new Date(ms);
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function journalNoteId(dateKey: string): string {
	return `journal-${dateKey}`;
}

function textNode(text: string): SeedInline {
	return { type: "text", version: 1, format: 0, mode: "normal", style: "", text, detail: 0 };
}

function paragraph(children: SeedInline[]): SeedBlock {
	return {
		type: "paragraph",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		children,
	};
}

function heading(children: SeedInline[], tag: "h2" | "h3"): SeedBlock {
	return {
		type: "heading",
		version: 1,
		format: "",
		indent: 0,
		direction: null,
		tag,
		children,
	};
}

/** Open the day. Phrasing varies with count so a 1-iteration day doesn't
 *  read like a 9-iteration day, but the leading sentence is always
 *  `"Shipped N iteration(s)."` — Journal's own tests pin that phrase and
 *  it doubles as a search-friendly anchor inside the entry. */
function diaryOpener(count: number, weekday: string): string {
	const head = `Shipped ${count} iteration${count === 1 ? "" : "s"}.`;
	if (count === 1)
		return `${head} A narrow ${weekday} — one thing on the slab, picked it up, put it down done.`;
	if (count <= 3)
		return `${head} A ${weekday} with momentum: each one landed cleanly and left the next ready to start.`;
	if (count <= 6)
		return `${head} Heavier ${weekday} than I'd planned for; the kind of day where you keep clearing the desk and more keeps appearing on it, but none of it stuck.`;
	return `${head} One of those ${weekday}s. Lost track of the count halfway through and just kept shipping — the tail of an iteration bundle that had been queued up for a while.`;
}

/** Choose a verb for the per-iteration paragraph so the entries don't all
 *  open with the same word. Deterministic in `code` (a stable hash). */
function shippedVerb(code: string): string {
	const verbs = ["Landed", "Closed out", "Got out the door", "Put to bed", "Shipped"];
	let h = 0;
	for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) | 0;
	const idx = ((h % verbs.length) + verbs.length) % verbs.length;
	return verbs[idx] ?? "Shipped";
}

/** First-paragraph prose for one iteration. Falls back gracefully when
 *  the parsed log didn't recover a summary (older iterations, or ones
 *  the plan condensed without a narrative). */
function iterationOpening(it: SerializedIterationEntity): string {
	const verb = shippedVerb(it.code);
	const trimmedSummary = it.summary.trim();
	if (trimmedSummary.length > 0) {
		const cleaned = trimmedSummary.replace(/\s+/g, " ");
		const head = cleaned.length > 600 ? `${cleaned.slice(0, 597).trimEnd()}…` : cleaned;
		return `${verb} ${it.code}. ${head}`;
	}
	const headlineTitle = it.title.trim();
	if (headlineTitle.length > 0) {
		return `${verb} ${it.code} — ${headlineTitle}. The log entry is sparse, but the work is in the diff and the tests turned green.`;
	}
	return `${verb} ${it.code}. Plumbing iteration — no narrative worth keeping, just the bar going to ✅.`;
}

/** Optional second paragraph drawn from the iteration body. Picks the
 *  most substantive paragraph after the opening line so the entry has
 *  texture without dumping the whole log. */
function iterationFollowup(it: SerializedIterationEntity): string | null {
	const body = it.body.trim();
	if (body.length === 0) return null;
	const summary = it.summary.trim();
	const paragraphs = body
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\s+/g, " ").trim())
		.filter((p) => p.length > 0)
		.filter((p) => !/^[#>*\-\d.|]/.test(p))
		.filter((p) => summary.length === 0 || !p.startsWith(summary.slice(0, 40)));
	const pick = paragraphs.find((p) => p.length >= 80) ?? null;
	if (pick == null) return null;
	return pick.length > 500 ? `${pick.slice(0, 497).trimEnd()}…` : pick;
}

/** OQ wrap-up paragraph for one iteration, when it resolved at least one. */
function iterationOQLine(it: SerializedIterationEntity): string | null {
	if (it.resolvedOQs.length === 0) return null;
	const list = it.resolvedOQs.join(", ");
	const lead = it.resolvedOQs.length === 1 ? "resolved" : "resolved";
	return `Along the way, ${lead} ${list} — one less open thread to come back to.`;
}

/** Closing paragraph for the day. Mentions cumulative OQs resolved when
 *  there are any, otherwise a plain sign-off. */
function diaryCloser(totalOQs: number): string {
	if (totalOQs === 0)
		return "Calling it. Plan + table updated, log appended, tomorrow already has its first iteration teed up.";
	if (totalOQs === 1)
		return "One open question closed today. Calling it — the plan + log are up to date, and the next iteration is waiting on deck.";
	return `${totalOQs} open questions closed today. Calling it — plan and log updated, table refreshed, tomorrow's first iteration is already teed up.`;
}

function dayWeekday(dateKey: string): string {
	const y = Number(dateKey.slice(0, 4));
	const m = Number(dateKey.slice(5, 7)) - 1;
	const d = Number(dateKey.slice(8, 10));
	const dt = new Date(Date.UTC(y, m, d));
	const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	return names[dt.getUTCDay()] ?? "day";
}

function body(dateKey: string, blocks: SeedBlock[]): SeedEditorState {
	return {
		root: {
			type: "root",
			version: 1,
			format: "",
			indent: 0,
			direction: null,
			children: [
				{
					type: "title",
					version: 1,
					format: "",
					indent: 0,
					direction: null,
					textFormat: 0,
					textStyle: "",
					children: [textNode(dateKey)],
				},
				...blocks,
			],
		},
	} as unknown as SeedEditorState;
}

/**
 * One dated journal Note per day that had ≥1 iteration land. Body reads
 * as diary prose: opener, per-iteration H3 + 1–2 paragraphs, day closer.
 * Sorted by date so re-running the seed is byte-stable.
 *
 * `resolver` lets `[[X]]` patterns in the underlying iteration narrative
 * become real `MentionNode` chips when `X` names a known entity. Tests
 * that don't care about cross-linking can omit it — wikilinks then
 * collapse to plain text (label only, brackets stripped).
 */
export function buildJournalEntries(
	iterations: readonly SerializedIterationEntity[],
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedNote[] {
	const byDay = new Map<string, SerializedIterationEntity[]>();
	for (const it of iterations) {
		if (it.completedAt == null) continue;
		const key = dayKey(it.completedAt);
		const bucket = byDay.get(key);
		if (bucket) bucket.push(it);
		else byDay.set(key, [it]);
	}

	const days = [...byDay.keys()].sort();
	return days.map((dateKey) => {
		const shipped = (byDay.get(dateKey) ?? [])
			.slice()
			.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
		const ts = Date.UTC(
			Number(dateKey.slice(0, 4)),
			Number(dateKey.slice(5, 7)) - 1,
			Number(dateKey.slice(8, 10)),
		);
		const weekday = dayWeekday(dateKey);
		const totalOQs = shipped.reduce((acc, it) => acc + it.resolvedOQs.length, 0);
		const blocks: SeedBlock[] = [
			paragraph(parseInlineWithMentions(diaryOpener(shipped.length, weekday), resolver)),
		];

		for (const it of shipped) {
			// The note title is plain text upstream (`stripWikilinkBrackets`
			// runs in `brainstorm-project.ts`'s `firstLine`), so the H3 just
			// composes `<code> — <title>` without re-parsing wikilinks.
			blocks.push(heading([textNode(`${it.code} — ${stripWikilinkBrackets(it.title)}`)], "h3"));
			blocks.push(paragraph(parseInlineWithMentions(iterationOpening(it), resolver)));
			const followup = iterationFollowup(it);
			if (followup != null) {
				blocks.push(paragraph(parseInlineWithMentions(followup, resolver)));
			}
			const oqLine = iterationOQLine(it);
			if (oqLine != null) {
				blocks.push(paragraph(parseInlineWithMentions(oqLine, resolver)));
			}
		}

		blocks.push(paragraph(parseInlineWithMentions(diaryCloser(totalOQs), resolver)));

		return {
			id: journalNoteId(dateKey),
			title: dateKey,
			icon: { kind: "emoji", value: "📓" },
			body: body(dateKey, blocks),
			values: { "journal-date": dateKey, "journal-shipped": String(shipped.length) },
			createdAt: ts,
			updatedAt: ts,
		};
	});
}
