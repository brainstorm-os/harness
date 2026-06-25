/**
 * `◑` is debt with an expiry — the implementation-plan Legend pins the
 * policy: "every `◑` must convert to ✅ or be removed by the boundary of
 * the stage that gates its real half. **No `◑` ships in a v1 release
 * build**" (beta-exit checklist). Until now the policy was prose only;
 * this audit makes it structural — it cross-references every `◑`
 * iteration's documented gate(s) against the live plan status and flags
 * any `◑` whose gates have all flipped ✅ ("expired" — the policy
 * violation: should have been converted or removed by now).
 *
 * Pure: `(iterations) → entries`. The repo-data test wires it to the
 * parsed live plan; mid-loop iterations stay green (`pending` /
 * `unevaluable` / `gateless` are non-failing); a flipped-gate-with-`◑`-
 * still-there fails the suite, not the release retrospective.
 *
 * Gate triggers in the plan's house style: `gate:` and `BLOCKED:`
 * (case-insensitive). Inside each trigger's scope (up to the next
 * sentence end / `**` closer / em-dash phrase / newline) the audit
 * extracts only **iteration-id-shaped** tokens (the `parse-plan`
 * `LEAD_ID_RE`, kept in lock-step) — descriptive deps like "shell route"
 * and OQ refs are out of scope and classify as `unevaluable` (the
 * conservative stance from 12.2 / 12.9: never false-positive a gate).
 */

import { type Iteration, IterationStatus } from "../types.ts";

export enum PreviewDropClass {
	/** Every parseable gate is ✅ — the policy violation. */
	Expired = "expired",
	/** ≥1 parseable gate is not yet ✅. */
	Pending = "pending",
	/** Gates exist in the body but none match a parsed iteration (OQ
	 *  refs / descriptive deps / external) — can't decide. */
	Unevaluable = "unevaluable",
	/** No `gate:` / `BLOCKED:` marker at all — legitimately independent. */
	Gateless = "gateless",
}

export type PreviewDropGate = {
	ref: string;
	status: IterationStatus | "unknown";
};

export type PreviewDropEntry = {
	id: string;
	body: string;
	gates: PreviewDropGate[];
	classification: PreviewDropClass;
};

/** A single iteration-id token. Stricter than parse-plan's `LEAD_ID_RE`
 *  because it scans *inside* a body (where OQ refs like `OQ-CT-1` could
 *  otherwise extract spurious `CT-1` substrings, and a bare `8` could
 *  match a stage-level ref):
 *    - lookarounds reject tokens touching `[\w-]` on either side (so
 *      `CT-1` inside `OQ-CT-1` never matches),
 *    - numeric ids require at least one dot (`\d+(?:\.\d+)+`) so a bare
 *      `8` from "design-system 8" never matches,
 *    - the trailing `[a-z]?` covers the `9.3.5.1b` combined-iteration
 *      style, and the alpha-prefix-dash branch (`Mailbox-1`, `Net-2`,
 *      `OpenRes-1c`) covers the new group-I ids. */
const ID_TOKEN_RE =
	/(?<![\w-])(SH-\d+|VP-\d+|B\d+(?:\.\d+)*[a-z]?|[A-Z][A-Za-z]+-\d+[a-z]?|\d+(?:\.\d+)+(?:\.[A-Za-z][\w-]*)?[a-z]?)(?![\w-])/g;

/** Each trigger ends at the first sentence-end / `**` bold closer /
 *  the next ` — ` em-dash phrase / newline / end-of-string. Conservative:
 *  smaller scopes are fine, false-positives across paragraphs aren't. */
const TRIGGER_RE = /\b(gate|BLOCKED)\s*[:=]\s*/gi;
/** Period-followed-by-whitespace OR period-at-end (sentence end without
 *  swallowing the `.` inside ids like `9.10`); ` — ` (em-dash phrase
 *  break); `**` markdown bold closer; `;` / `\n` / end of string. */
const SCOPE_END_RE = /(\*\*|\n|;| — |\.\s|\.$|$)/;

export function extractGateRefs(body: string): string[] {
	const seen = new Set<string>();
	for (let m = TRIGGER_RE.exec(body); m; m = TRIGGER_RE.exec(body)) {
		const start = m.index + m[0].length;
		const tail = body.slice(start);
		const end = SCOPE_END_RE.exec(tail);
		const scope = end ? tail.slice(0, end.index) : tail;
		for (let t = ID_TOKEN_RE.exec(scope); t; t = ID_TOKEN_RE.exec(scope)) {
			if (t[1]) seen.add(t[1]);
		}
		ID_TOKEN_RE.lastIndex = 0; // global flag — reset between scopes
	}
	TRIGGER_RE.lastIndex = 0;
	return [...seen];
}

/** Whether the body carries any `gate:` / `BLOCKED:` marker at all,
 *  irrespective of whether the audit could parse anything inside it.
 *  Discriminates "no gate documented" (`Gateless`) from "gate documented
 *  but only descriptive / OQ refs inside" (`Unevaluable`). */
export function hasGateTrigger(body: string): boolean {
	TRIGGER_RE.lastIndex = 0;
	const found = TRIGGER_RE.test(body);
	TRIGGER_RE.lastIndex = 0;
	return found;
}

export function auditPreviewDrops(iterations: readonly Iteration[]): PreviewDropEntry[] {
	const byId = new Map<string, IterationStatus>();
	for (const it of iterations) byId.set(it.id, it.status);
	/** Combined-iteration bullets like `- ✅ 9.3.5.1 / .1b — …` carry one
	 *  parsed id (`9.3.5.1`); a body that references `9.3.5.1b` should
	 *  still resolve. Strip a single trailing lowercase letter from a
	 *  numeric id when the exact ref is unknown. */
	const lookup = (ref: string): IterationStatus | "unknown" => {
		if (byId.has(ref)) return byId.get(ref) as IterationStatus;
		const stripped = /^(\d.*?\d)[a-z]$/.exec(ref)?.[1];
		if (stripped && byId.has(stripped)) return byId.get(stripped) as IterationStatus;
		return "unknown";
	};

	const out: PreviewDropEntry[] = [];
	for (const it of iterations) {
		if (it.status !== IterationStatus.PreviewDrop) continue;
		const refs = extractGateRefs(it.body);
		const gates: PreviewDropGate[] = refs.map((ref) => ({ ref, status: lookup(ref) }));
		const known = gates.filter((g) => g.status !== "unknown");
		let cls: PreviewDropClass;
		if (gates.length === 0) {
			// No id-shaped tokens — distinguish "no gate documented" from
			// "documented but only descriptive / OQ refs" (the author DID
			// say there's a gate; the audit just can't classify it).
			cls = hasGateTrigger(it.body) ? PreviewDropClass.Unevaluable : PreviewDropClass.Gateless;
		} else if (known.length === 0) cls = PreviewDropClass.Unevaluable;
		else if (known.every((g) => g.status === IterationStatus.Done)) cls = PreviewDropClass.Expired;
		else cls = PreviewDropClass.Pending;
		out.push({ id: it.id, body: it.body, gates, classification: cls });
	}
	return out;
}

/** Convenience: just the expired entries — the only class the beta-exit
 *  gate must reject. */
export function expiredPreviewDrops(iterations: readonly Iteration[]): PreviewDropEntry[] {
	return auditPreviewDrops(iterations).filter((e) => e.classification === PreviewDropClass.Expired);
}
