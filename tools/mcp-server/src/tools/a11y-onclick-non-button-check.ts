/**
 * KBN-3 — `KBN-G-onclick-non-button`. JSX `onClick={…}` on a non-button
 * raw DOM element with no `role` and no `tabIndex` is a mouse-only
 * affordance — invisible to the keyboard, invisible to screen readers
 * announcing actionable controls.
 *
 * Per [`docs/shell/61-keyboard-accessibility.md` §Validation](../../../../docs/shell/61-keyboard-accessibility.md#validation):
 * `onClick` on a non-`<button>` / non-`<a>` / non-input element without
 * `role` and without `tabIndex` is flagged. Mirrors `12.11` (button
 * accessible-name) — that guard says "if it IS a `<button>`, name it";
 * this guard catches "if it acts like a button, BE a button" (or carry
 * the role + tabindex contract that makes the keyboard work).
 *
 * In-scope tags (raw DOM): `<div>`, `<span>`, `<li>`, `<p>`, `<img>`,
 * `<svg>` and other lowercase tags. Out of scope:
 *
 *   - `<button>`, `<a>`, `<input>`, `<textarea>`, `<select>` —
 *     interactive by construction (the `<a>` href omission is a
 *     separate guard, not this one).
 *   - `<label>` — interactive by association with the wrapped form
 *     control.
 *   - PascalCase tag names — `<Button>`, `<MyClickable>`. The component
 *     owns its own a11y contract; this guard targets raw DOM only,
 *     mirroring the `a11y-button-name-check` precedent.
 *
 * Passes if any of:
 *   - the element has a `role` attribute (any value — the developer
 *     opted into a role contract, downstream `KBN-G-roles` covers
 *     composite-role abuses);
 *   - the element has a `tabIndex` attribute (any value — opts the
 *     element into the keyboard tab sequence);
 *   - the element has a `disabled` attribute (a disabled visual is not
 *     activatable; pairs with the no-mouse-without-keyboard rule);
 *   - a `// kbn-onclick-exempt` comment on or above the line.
 *
 * Pure: `(files) → findings`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type OnClickNonButtonViolation = {
	path: string;
	line: number;
	tag: string;
	excerpt: string;
};

const EXEMPT = "kbn-onclick-exempt";

/** Raw DOM tags whose default behaviour is interactive. `onClick` on
 *  these is fine (the keyboard contract comes for free). */
const INTERACTIVE_TAGS: ReadonlySet<string> = new Set([
	"button",
	"a",
	"input",
	"textarea",
	"select",
	"label",
	"option",
	"summary",
]);

/** Attribute names whose presence (any value) makes the element
 *  keyboard-reachable / annotated; the guard passes. */
const PASSING_ATTRS: ReadonlySet<string> = new Set([
	"role",
	"tabIndex",
	"tabindex",
	"disabled",
	"aria-disabled",
	"contentEditable",
	"contenteditable",
]);

/** A tag-name string is a raw DOM element iff its first letter is
 *  lowercase. React component usage (`<Button>`) starts uppercase and
 *  is out of scope for this guard. */
function isRawDomTag(name: string): boolean {
	if (name.length === 0) return false;
	const first = name[0] ?? "";
	return first === first.toLowerCase() && first !== first.toUpperCase();
}

function findAttr(props: ts.NodeArray<ts.JsxAttributeLike>, name: string): ts.JsxAttribute | null {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		if (prop.name.getText() === name) return prop;
	}
	return null;
}

function hasAnyPassingAttr(props: ts.NodeArray<ts.JsxAttributeLike>): boolean {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		if (PASSING_ATTRS.has(prop.name.getText())) return true;
	}
	return false;
}

export function findOnClickNonButton(
	files: readonly SourceFileInput[],
): OnClickNonButtonViolation[] {
	const violations: OnClickNonButtonViolation[] = [];
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

		const check = (opening: ts.JsxOpeningLikeElement): void => {
			const tagName = opening.tagName.getText();
			if (!isRawDomTag(tagName)) return;
			if (INTERACTIVE_TAGS.has(tagName)) return;
			const props = opening.attributes.properties;
			if (findAttr(props, "onClick") === null) return;
			if (hasAnyPassingAttr(props)) return;
			const { line } = sf.getLineAndCharacterOfPosition(opening.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, tag: tagName, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isJsxSelfClosingElement(node)) check(node);
			else if (ts.isJsxElement(node)) check(node.openingElement);
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
