/**
 * Stage 12.11 — a `<button>` ships without an accessible name.
 *
 * The canonical a11y bug class: an icon-only or empty button with no
 * `aria-label` / `aria-labelledby` / `title` and no text-bearing
 * descendant. A sighted user sees a glyph; a screen reader reads
 * "button" with no purpose. The 12.4 a11y audit on the beta-exit
 * checklist needs a structural floor under it — this is the i18n /
 * type-import / coverage-floor sibling, the fifth class in the actually-
 * enforced uniform bar (Workflow standard 3).
 *
 * Conservative (zero-false-positive rule for repo-wide guards): a button
 * passes if ANY of the following hold:
 *   1. it carries a non-empty `aria-label`, `aria-labelledby`, or
 *      `title` attribute (literal **or** expression — an expression's
 *      runtime value can't be inspected, but its *intent* counts);
 *   2. any descendant carries a non-empty `JsxText` with a real word, a
 *      string-literal `JsxExpression` child, or a `t(…)` / `tIfKey(…)`
 *      call from any module (Notes / shell / SDK `createT` all qualify);
 *   3. any descendant `{variable}` JsxExpression — the value is opaque
 *      but is presumed to be the label (matches the 12.2 stance on
 *      dynamic content: can't statically verify, don't false-positive);
 *   4. any direct or nested child with an `aria-label` / `aria-labelledby`
 *      attribute (a labelled inner element labels the button);
 *   5. a `// a11y-exempt` comment on or above the opening tag's line
 *      (the explicit escape hatch — rare cases where the button is
 *      genuinely decorative or its name is set imperatively).
 *
 * Pure: `(files) → violations`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type ButtonNameViolation = { path: string; line: number; excerpt: string };

const HAS_WORD = /\p{L}{2,}/u;
const EXEMPT = "a11y-exempt";

function attrStringValue(attr: ts.JsxAttribute): string | null {
	const init = attr.initializer;
	if (!init) return null;
	if (ts.isStringLiteral(init)) return init.text;
	if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
		return init.expression.text;
	}
	return null;
}

function attrHasExpressionValue(attr: ts.JsxAttribute): boolean {
	const init = attr.initializer;
	return !!(init && ts.isJsxExpression(init) && init.expression);
}

/** `aria-label` (or `aria-labelledby` / `title`) with either a literal
 *  non-empty string OR an expression value (intent counts). */
function isLabelAttr(name: string): boolean {
	return name === "aria-label" || name === "aria-labelledby" || name === "title";
}

function attributesNameButton(props: ts.NodeArray<ts.JsxAttributeLike>): boolean {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		const n = prop.name.getText();
		if (!isLabelAttr(n)) continue;
		const lit = attrStringValue(prop);
		if (lit && lit.trim().length > 0) return true;
		if (lit === null && attrHasExpressionValue(prop)) return true;
	}
	return false;
}

/** Recursively scan a JSX subtree for any text-bearing descendant or a
 *  labelled inner element. */
function subtreeHasAccessibleContent(node: ts.Node): boolean {
	let found = false;
	const visit = (n: ts.Node): void => {
		if (found) return;
		if (ts.isJsxText(n) && !n.containsOnlyTriviaWhiteSpaces && HAS_WORD.test(n.text)) {
			found = true;
			return;
		}
		if (
			ts.isJsxExpression(n) &&
			n.expression &&
			n.parent &&
			(ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))
		) {
			// JsxExpression visited here is a real child (`<el>{…}</el>`),
			// not an attribute value (`onClick={x}`) — the parent gate
			// disambiguates (mirrors the 12.2 child-only check).
			const e = n.expression;
			if (ts.isStringLiteralLike(e) && HAS_WORD.test(e.text)) {
				found = true;
				return;
			}
			// `t(…)` / `tIfKey(…)` (any module — call shape is intent enough).
			if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
				const name = e.expression.text;
				if (name === "t" || name === "tIfKey") {
					found = true;
					return;
				}
			}
			// Any other expression child → opaque but presumed to be the
			// label (conservative — same stance as 12.2 on dynamic JSX).
			found = true;
			return;
		}
		// Labelled inner element labels its container.
		if (ts.isJsxOpeningLikeElement(n) && attributesNameButton(n.attributes.properties)) {
			found = true;
			return;
		}
		ts.forEachChild(n, visit);
	};
	ts.forEachChild(node, visit);
	return found;
}

function isButtonOpening(opening: ts.JsxOpeningLikeElement): boolean {
	// Lowercase `<button>` only. A `<Button>` React component owns its
	// own a11y contract — out of scope for this guard.
	return opening.tagName.getText() === "button";
}

export function findUnnamedButtons(files: readonly SourceFileInput[]): ButtonNameViolation[] {
	const violations: ButtonNameViolation[] = [];
	for (const file of files) {
		if (!file.path.endsWith(".tsx")) continue;
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		const lines = file.source.split("\n");
		const exempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const flag = (opening: ts.JsxOpeningLikeElement): void => {
			const { line } = sf.getLineAndCharacterOfPosition(opening.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isJsxSelfClosingElement(node) && isButtonOpening(node)) {
				if (!attributesNameButton(node.attributes.properties)) flag(node);
			} else if (ts.isJsxElement(node) && isButtonOpening(node.openingElement)) {
				if (
					!attributesNameButton(node.openingElement.attributes.properties) &&
					!subtreeHasAccessibleContent(node)
				) {
					flag(node.openingElement);
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
