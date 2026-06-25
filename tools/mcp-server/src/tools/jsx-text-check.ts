/**
 * Stage 12.2 — ban hardcoded user-visible JSX text.
 *
 * Every user-facing string must go through `t()` (CLAUDE.md §Localization
 * / docs/foundations/35-code-conventions.md). This is the CI-enforceable
 * checker: a TS-AST walk (not a regex — JSX text vs. code is genuinely
 * structural) over `.tsx` source that flags a bare, user-visible string
 * sitting as a JSX **child** — either raw `JsxText` or a string-literal
 * expression container (`<span>{"Hi"}</span>`).
 *
 * Deliberately conservative so the repo-wide guard has ~zero false
 * positives: only text with a real word (≥2 consecutive letters) counts;
 * punctuation / separators / entities / numbers are ignored; an
 * `aria-hidden="true"` subtree is decorative and skipped; and an
 * `i18n-exempt` comment on or just above the line is an explicit escape
 * hatch for the rare legitimate literal.
 *
 * Pure: `(files) → violations`. No fs here — the caller supplies sources
 * (so unit tests pass fixtures and the guard passes the repo).
 */

import ts from "typescript";

export type JsxTextViolation = { path: string; line: number; text: string };
export type SourceFileInput = { path: string; source: string };

/** A word is ≥2 consecutive Unicode letters — enough to exclude `·`,
 *  `—`, `×`, `42`, `OK`-less single glyphs, math/markup punctuation. */
const HAS_WORD = /\p{L}{2,}/u;

function isUserVisible(raw: string): boolean {
	const text = raw.replace(/\s+/g, " ").trim();
	if (text.length === 0) return false;
	return HAS_WORD.test(text);
}

function attrLiteral(attr: ts.JsxAttribute): string | null {
	const init = attr.initializer;
	if (!init) return null;
	if (ts.isStringLiteral(init)) return init.text;
	if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
		return init.expression.text;
	}
	return null;
}

/** `aria-hidden="true"` → the whole subtree is decorative; don't flag
 *  text inside it (the same rule the rest of the chrome follows). */
function isAriaHidden(opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement): boolean {
	for (const prop of opening.attributes.properties) {
		if (ts.isJsxAttribute(prop) && prop.name.getText() === "aria-hidden") {
			return attrLiteral(prop) === "true";
		}
	}
	return false;
}

const EXEMPT = "i18n-exempt";

export function findHardcodedJsxText(files: readonly SourceFileInput[]): JsxTextViolation[] {
	const violations: JsxTextViolation[] = [];
	for (const file of files) {
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		const lines = file.source.split("\n");
		const lineHasExempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const flag = (node: ts.Node, text: string): void => {
			const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
			if (lineHasExempt(line)) return;
			violations.push({ path: file.path, line: line + 1, text: text.replace(/\s+/g, " ").trim() });
		};

		const walk = (node: ts.Node, ariaHiddenDepth: number): void => {
			let depth = ariaHiddenDepth;
			if (ts.isJsxElement(node) && isAriaHidden(node.openingElement)) depth++;

			if (depth === 0) {
				if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces && isUserVisible(node.text)) {
					flag(node, node.text);
				}
				// `<el>{"literal"}</el>` — a string literal used as a child.
				if (
					ts.isJsxExpression(node) &&
					node.parent &&
					(ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
					node.expression &&
					ts.isStringLiteralLike(node.expression) &&
					isUserVisible(node.expression.text)
				) {
					flag(node, node.expression.text);
				}
			}
			ts.forEachChild(node, (child) => walk(child, depth));
		};
		walk(sf, 0);
	}
	return violations;
}
