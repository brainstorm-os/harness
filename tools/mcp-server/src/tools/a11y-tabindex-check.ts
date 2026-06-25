/**
 * KBN-3 — `KBN-G-tabindex`. Positive `tabindex` values break document
 * order: any number other than `0` (focusable, normal order) or `-1`
 * (programmatically focusable, skipped by Tab) inserts the element into
 * a custom Tab sequence that fights the visible reading order, defeats
 * focus-restore conventions, and is universally a bug.
 *
 * Per [`docs/shell/61-keyboard-accessibility.md` §Validation](../../../../docs/shell/61-keyboard-accessibility.md#validation):
 * "`tabindex` values other than `0` and `-1` are flagged". Same shape as
 * the `12.11`/`.12`/`.13`/`.14` + `0.11-keyboard` structural CI guards.
 *
 * Match shapes:
 *   1. JSX `tabIndex={N}` where `N` is a numeric literal > 0.
 *   2. JSX `tabIndex="N"` where the string parses to a positive integer.
 *   3. JS `el.tabIndex = N` assignment with a positive integer literal.
 *   4. JS `el.setAttribute("tabindex", "N")` with a positive integer.
 *
 * The guard is intentionally narrow — only flags **numeric literals**.
 * A dynamic `tabIndex={x}` is opaque (the value could be 0 / -1 at
 * runtime); flagging it would false-positive widely. The repo
 * convention is `tabIndex={0}` / `tabIndex={-1}` literally; anything
 * else slips through this filter is by definition a manual override
 * that should justify itself with `// kbn-tabindex-exempt`.
 *
 * Pure: `(files) → findings`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type TabindexViolation = {
	path: string;
	line: number;
	value: number;
	excerpt: string;
};

const EXEMPT = "kbn-tabindex-exempt";

function parsePositiveIntLiteral(text: string): number | null {
	const t = text.trim();
	if (!/^-?\d+$/.test(t)) return null;
	const n = Number.parseInt(t, 10);
	if (!Number.isFinite(n)) return null;
	return n > 0 ? n : null;
}

/** Numeric value of a JSX attribute initializer if it is a positive
 *  integer literal, else `null`. Handles `tabIndex={5}` (NumericLiteral
 *  inside JsxExpression), `tabIndex="5"` (StringLiteral). */
function jsxPositiveIntAttrValue(init: ts.JsxAttributeValue | undefined): number | null {
	if (!init) return null;
	if (ts.isStringLiteral(init)) return parsePositiveIntLiteral(init.text);
	if (!ts.isJsxExpression(init) || !init.expression) return null;
	const expr = init.expression;
	if (ts.isNumericLiteral(expr)) return parsePositiveIntLiteral(expr.text);
	// `tabIndex={-1}` parses as a PrefixUnaryExpression of `-` + NumericLiteral.
	// PrefixUnary `+` / `-` rarely matters here (negatives are allowed); skip.
	if (ts.isStringLiteralLike(expr)) return parsePositiveIntLiteral(expr.text);
	return null;
}

function isTabindexAttrName(name: string): boolean {
	// React uses camelCase `tabIndex`; lowercase `tabindex` shows up only
	// in `dangerouslySetInnerHTML` content (not seen by AST) — but if a
	// raw lowercase attribute is ever spelled in JSX, catch it too.
	return name === "tabIndex" || name === "tabindex";
}

/** `el.tabIndex = N` assignment expression with a positive integer. */
function assignmentToTabIndex(node: ts.BinaryExpression): number | null {
	if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return null;
	const lhs = node.left;
	if (!ts.isPropertyAccessExpression(lhs)) return null;
	if (lhs.name.text !== "tabIndex") return null;
	const rhs = node.right;
	if (ts.isNumericLiteral(rhs)) return parsePositiveIntLiteral(rhs.text);
	return null;
}

/** `el.setAttribute("tabindex", "N")` / `el.setAttribute("tabindex", N)`. */
function setAttributeTabIndex(call: ts.CallExpression): number | null {
	if (!ts.isPropertyAccessExpression(call.expression)) return null;
	if (call.expression.name.text !== "setAttribute") return null;
	const [nameArg, valueArg] = call.arguments;
	if (!nameArg || !valueArg) return null;
	if (!ts.isStringLiteralLike(nameArg)) return null;
	if (nameArg.text.toLowerCase() !== "tabindex") return null;
	if (ts.isStringLiteralLike(valueArg)) return parsePositiveIntLiteral(valueArg.text);
	if (ts.isNumericLiteral(valueArg)) return parsePositiveIntLiteral(valueArg.text);
	return null;
}

export function findPositiveTabindexes(files: readonly SourceFileInput[]): TabindexViolation[] {
	const violations: TabindexViolation[] = [];
	for (const file of files) {
		if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue;
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const lines = file.source.split("\n");
		const exempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const flag = (node: ts.Node, value: number): void => {
			const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, value, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isJsxAttribute(node)) {
				const name = node.name.getText();
				if (isTabindexAttrName(name)) {
					const v = jsxPositiveIntAttrValue(node.initializer);
					if (v !== null) flag(node, v);
				}
			}
			if (ts.isBinaryExpression(node)) {
				const v = assignmentToTabIndex(node);
				if (v !== null) flag(node, v);
			}
			if (ts.isCallExpression(node)) {
				const v = setAttributeTabIndex(node);
				if (v !== null) flag(node, v);
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
