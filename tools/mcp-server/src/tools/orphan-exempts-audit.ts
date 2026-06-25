/**
 * Stage SH-32 — orphan escape-hatch comments (the meta-gate keeping the
 * 9 structural CI gates honest over time).
 *
 * Each of the existing gates (12.2 hardcoded-JSX · 12.9 type-only-import
 * · 12.10 missing t() key · 12.11/12/13 a11y trio · 12.14 button-type)
 * carries an `…-exempt` comment escape hatch for the rare legitimate
 * case. **An exempt is debt with an expiry**: when the underlying code
 * is later refactored so the violation goes away, the exempt is supposed
 * to be removed. In practice nobody remembers to — orphan exempts
 * accumulate, the escape hatch quietly normalises into permanent
 * silence, and the gate's authority erodes.
 *
 * This audit cross-references every exempt comment against the
 * **would-be violation** at the same position: mutate the source so the
 * exempt token is masked (same-length placeholder — positions and lines
 * are byte-identical to the original), re-run the matching checker, and
 * classify the exempt as **justified** (a would-be violation appears at
 * line N or N+1) or **orphan** (none does). Zero checker modification is
 * needed — the existing `EXEMPT.includes(...)` line check naturally
 * fails against the masked token.
 *
 * Pure: `(files) → orphans`. Mirrors the SH-31 `KNOWN_*` snapshot
 * pattern: today's findings can be allow-listed while still locking in
 * the gate forward, and a stale snapshot entry (an orphan that was
 * later cleaned up but not removed from the snapshot) fails too.
 */

import { findUnnamedButtons } from "./a11y-button-name-check.ts";
import { findUnlabeledFormInputs } from "./a11y-form-input-check.ts";
import { findImagesMissingAlt } from "./a11y-img-alt-check.ts";
import { findButtonsMissingType } from "./button-type-check.ts";
import { type SourceFileInput, findHardcodedJsxText } from "./jsx-text-check.ts";
import {
	type TranslationKeyViolation,
	findUnknownTranslationKeys,
} from "./translation-key-check.ts";
import { findTypeOnlyImportUsedAsValue } from "./type-import-check.ts";

export type ExemptKind =
	| "i18n-exempt"
	| "a11y-exempt"
	| "t-key-exempt"
	| "type-value-exempt"
	| "button-type-exempt";

export type OrphanExempt = {
	path: string;
	line: number;
	kind: ExemptKind;
	excerpt: string;
};

export type FindOrphanExemptsOptions = {
	/** Live `isKnown` used to evaluate `t-key-exempt` (mirrors 12.10's
	 *  test rig). When absent, `t-key-exempt` comments are not audited
	 *  — they pass through silently rather than reported as orphan. */
	tKeyIsKnown?: (key: string) => boolean;
};

const TOKEN_RE = /\b(i18n|a11y|t-key|type-value|button-type)-exempt\b/g;

type ViolationLike = { line: number };

type CheckResult = ViolationLike[];

function runForKind(
	kind: ExemptKind,
	file: SourceFileInput,
	options: FindOrphanExemptsOptions,
): CheckResult {
	switch (kind) {
		case "i18n-exempt":
			return findHardcodedJsxText([file]);
		case "a11y-exempt":
			// One a11y-exempt may shadow any of the three a11y guards.
			return [
				...findUnnamedButtons([file]),
				...findImagesMissingAlt([file]),
				...findUnlabeledFormInputs([file]),
			];
		case "t-key-exempt":
			if (!options.tKeyIsKnown) return [];
			return findUnknownTranslationKeys([file], options.tKeyIsKnown) as TranslationKeyViolation[];
		case "type-value-exempt":
			return findTypeOnlyImportUsedAsValue([file]);
		case "button-type-exempt":
			return findButtonsMissingType([file]);
	}
}

/** Replace `[start, end)` of `source` with same-length filler so that
 *  every byte position past `end` and every newline position is
 *  preserved — checker line numbers are byte-identical to the original
 *  source. */
function maskRange(source: string, start: number, end: number): string {
	const fill = "X".repeat(end - start);
	return source.slice(0, start) + fill + source.slice(end);
}

export function findOrphanExempts(
	files: readonly SourceFileInput[],
	options: FindOrphanExemptsOptions = {},
): OrphanExempt[] {
	const orphans: OrphanExempt[] = [];
	for (const file of files) {
		const lines = file.source.split("\n");
		TOKEN_RE.lastIndex = 0;
		for (let m = TOKEN_RE.exec(file.source); m; m = TOKEN_RE.exec(file.source)) {
			const tokenStart = m.index;
			const tokenEnd = m.index + m[0].length;
			const kindRaw = m[1] as "i18n" | "a11y" | "t-key" | "type-value" | "button-type";
			const kind = `${kindRaw}-exempt` as ExemptKind;
			// Convert byte offset to 1-based line.
			const preceding = file.source.slice(0, tokenStart);
			const line0 = preceding.split("\n").length - 1;

			// t-key-exempt without an isKnown supplied is silently skipped:
			// not orphan, not justified — out of scope.
			if (kind === "t-key-exempt" && !options.tKeyIsKnown) continue;

			const masked = maskRange(file.source, tokenStart, tokenEnd);
			const violations = runForKind(kind, { path: file.path, source: masked }, options);
			// An exempt at source-line E protects a violation reported at
			// line E (the same line) or E+1 (the line below) — mirrors the
			// `lines[line0] || lines[line0 - 1]` check every gate uses.
			const justified = violations.some((v) => v.line === line0 + 1 || v.line === line0 + 2);
			if (!justified) {
				const excerpt = (lines[line0] ?? "").trim();
				orphans.push({ path: file.path, line: line0 + 1, kind, excerpt });
			}
		}
	}
	return orphans;
}
