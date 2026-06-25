/**
 * Stage 12.12 — `<img>` ships without an `alt` attribute.
 *
 * The other canonical WCAG violation: an `<img>` without `alt` is opaque
 * to a screen reader (the user gets a file URL read out, or nothing).
 * An *empty* `alt=""` is the CORRECT way to mark an image as decorative
 * — that's a signal, not a violation. The missing attribute is the bug.
 *
 * Conservative (zero-false-positive rule for repo-wide guards): an
 * `<img>` passes if it carries ANY `alt` attribute — string literal
 * (empty or not), or an expression value (opaque but intent counts —
 * same dynamic-content stance as 12.2 / 12.11). It fails only when the
 * attribute is entirely absent. A `// a11y-exempt` comment on or above
 * the line is the explicit escape hatch.
 *
 * Pure: `(files) → violations`. Mirrors `12.11`'s pattern exactly so the
 * uniform-bar inventory reads consistently (`findUnnamedButtons` →
 * `findImagesMissingAlt`).
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type ImgAltViolation = { path: string; line: number; excerpt: string };

const EXEMPT = "a11y-exempt";

function hasAltAttr(props: ts.NodeArray<ts.JsxAttributeLike>): boolean {
	for (const prop of props) {
		if (!ts.isJsxAttribute(prop)) continue;
		if (prop.name.getText() === "alt") return true;
	}
	return false;
}

function isImgOpening(opening: ts.JsxOpeningLikeElement): boolean {
	// Lowercase `<img>` only. A `<Img>` React component owns its own
	// a11y contract — out of scope for this guard.
	return opening.tagName.getText() === "img";
}

export function findImagesMissingAlt(files: readonly SourceFileInput[]): ImgAltViolation[] {
	const violations: ImgAltViolation[] = [];
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
			if (ts.isJsxSelfClosingElement(node) && isImgOpening(node)) {
				if (!hasAltAttr(node.attributes.properties)) flag(node);
			} else if (ts.isJsxElement(node) && isImgOpening(node.openingElement)) {
				// `<img>…</img>` is legal HTML5 but vanishingly rare; treat
				// identically — the opening element's attrs are what count.
				if (!hasAltAttr(node.openingElement.attributes.properties)) {
					flag(node.openingElement);
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
