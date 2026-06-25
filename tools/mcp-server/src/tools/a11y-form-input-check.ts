/**
 * Stage 12.13 — `<input>` / `<textarea>` / `<select>` ships without an
 * accessible name. The third leg of WCAG SC 4.1.2 "Name, Role, Value"
 * at the JSX surface (12.11 buttons + 12.12 imgs + this).
 *
 * A user-facing form control without a label is opaque to screen readers
 * and to dictation. Conservative passes — any ONE of these makes the
 * input labeled:
 *   1. `aria-label` (literal non-empty OR expression — intent counts).
 *   2. `aria-labelledby` (literal OR expression).
 *   3. `title` (lower-bar but accepted convention).
 *   4. `placeholder` (literal non-empty OR expression). Placeholder
 *      alone isn't ideal a11y but is the established repo convention
 *      and ships a screen-reader-readable cue — flagging it would
 *      false-positive widely.
 *   5. **Wrapped in a `<label>` element** — the implicit-association
 *      pattern (an ancestor `<label>` element makes its descendants
 *      labelled). Walks `node.parent` up the AST.
 *
 * Skipped by `type`: `hidden` (never user-facing), `submit` / `button` /
 * `reset` (uses `value` or text as label — different rules; the
 * `<button>` guard 12.11 covers the JSX-button equivalents). An
 * `a11y-exempt` comment on or above the line is the explicit escape
 * hatch.
 *
 * Pure: `(files) → violations`. Mirrors 12.11 / 12.12 structure exactly.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type FormInputViolation = {
	path: string;
	line: number;
	tag: string;
	excerpt: string;
};

const EXEMPT = "a11y-exempt";
const TARGET_TAGS = new Set(["input", "textarea", "select"]);
const SKIP_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset"]);
const LABEL_ATTRS = new Set(["aria-label", "aria-labelledby", "title", "placeholder"]);

function attrLiteral(attr: ts.JsxAttribute): string | null {
	const init = attr.initializer;
	if (!init) return null;
	if (ts.isStringLiteral(init)) return init.text;
	if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
		return init.expression.text;
	}
	return null;
}

function attrHasExpression(attr: ts.JsxAttribute): boolean {
	const init = attr.initializer;
	return !!(init && ts.isJsxExpression(init) && init.expression);
}

function getInputTypeLiteral(props: ts.NodeArray<ts.JsxAttributeLike>): string | null {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		if (prop.name.getText() !== "type") continue;
		return attrLiteral(prop);
	}
	return null;
}

function hasLabelingAttr(props: ts.NodeArray<ts.JsxAttributeLike>): boolean {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		const n = prop.name.getText();
		if (!LABEL_ATTRS.has(n)) continue;
		const lit = attrLiteral(prop);
		if (lit && lit.trim().length > 0) return true;
		if (lit === null && attrHasExpression(prop)) return true;
	}
	return false;
}

/** Walk up the AST to find an ancestor `<label>` element — the
 *  implicit-association pattern. Stops at the source file root. */
function hasAncestorLabel(node: ts.Node): boolean {
	let n: ts.Node | undefined = node.parent;
	while (n && !ts.isSourceFile(n)) {
		if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === "label") {
			return true;
		}
		n = n.parent;
	}
	return false;
}

function targetTagName(opening: ts.JsxOpeningLikeElement): string | null {
	const name = opening.tagName.getText();
	return TARGET_TAGS.has(name) ? name : null;
}

export function findUnlabeledFormInputs(files: readonly SourceFileInput[]): FormInputViolation[] {
	const violations: FormInputViolation[] = [];
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

		const check = (
			opening: ts.JsxOpeningLikeElement,
			elementForAncestor: ts.Node,
			tag: string,
		): void => {
			// `<input type="…">` skip list.
			if (tag === "input") {
				const t = getInputTypeLiteral(opening.attributes.properties);
				if (t && SKIP_INPUT_TYPES.has(t)) return;
			}
			if (hasLabelingAttr(opening.attributes.properties)) return;
			if (hasAncestorLabel(elementForAncestor)) return;
			const { line } = sf.getLineAndCharacterOfPosition(opening.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, tag, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isJsxSelfClosingElement(node)) {
				const tag = targetTagName(node);
				if (tag) check(node, node, tag);
			} else if (ts.isJsxElement(node)) {
				const tag = targetTagName(node.openingElement);
				if (tag) check(node.openingElement, node, tag);
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
