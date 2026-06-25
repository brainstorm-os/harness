/**
 * Stage 12.14 — `<button>` without an explicit `type` attribute.
 *
 * The canonical React-in-form footgun: HTML defaults `<button>` to
 * `type="submit"` inside a `<form>`. A bare `<button onClick={save}>`
 * inside any form (now or in a future refactor) submits the form on
 * Enter / on click, kicking off whatever default-submit behaviour exists
 * (often a page reload, sometimes a stray request). The fix is trivial
 * and absolute: every `<button>` declares its `type` — `"button"` (the
 * common case), `"submit"`, or `"reset"`. The bug class shows up in
 * production as "clicking save triggers an extra navigation" — invisible
 * to typecheck, visible to the user.
 *
 * Conservative: only flags lowercase `<button>` JSX (React components
 * `<Button>` own their own contract). Both literal (`type="button"`) and
 * expression (`type={x}`) values pass — intent counts, same dynamic-
 * content stance as 12.11 / 12.12 / 12.13. A `button-type-exempt`
 * comment on or above the line is the explicit escape hatch (rare:
 * truly type-less is almost never right).
 *
 * Pure: `(files) → violations`. Mirrors 12.11–12.13 structure exactly.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type ButtonTypeViolation = { path: string; line: number; excerpt: string };

const EXEMPT = "button-type-exempt";

function hasTypeAttr(props: ts.NodeArray<ts.JsxAttributeLike>): boolean {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		if (prop.name.getText() === "type") return true;
	}
	return false;
}

function isButton(opening: ts.JsxOpeningLikeElement): boolean {
	return opening.tagName.getText() === "button";
}

export function findButtonsMissingType(files: readonly SourceFileInput[]): ButtonTypeViolation[] {
	const violations: ButtonTypeViolation[] = [];
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
			if (ts.isJsxSelfClosingElement(node) && isButton(node)) {
				if (!hasTypeAttr(node.attributes.properties)) flag(node);
			} else if (ts.isJsxElement(node) && isButton(node.openingElement)) {
				if (!hasTypeAttr(node.openingElement.attributes.properties)) flag(node.openingElement);
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
