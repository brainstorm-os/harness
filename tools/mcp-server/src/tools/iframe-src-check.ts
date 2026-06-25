/**
 * Stage 9.5.3 — ban `iframe.src` writes / `<iframe src=...>` JSX.
 *
 * The block-frame primitive at `packages/sdk/src/block-frame/block-frame.ts`
 * mounts every BP block iframe with `srcdoc` and explicitly REMOVES `src`
 * to guarantee an opaque origin (no network fetch, no URL, no cache). A
 * future regression that swaps `srcdoc` for `src` — or assigns `iframe.src
 * = "..."` after construction, or adds an `<iframe src={url}>` JSX in
 * another part of the codebase — silently re-exposes a non-opaque origin
 * AND opens a network-fetch surface that the CSP `connect-src 'none'`
 * does NOT cover (the `src` URL is fetched as a top-level navigation by
 * the parser, not by `fetch`, and bypasses the iframe's own CSP `connect-src`).
 *
 * The guard is a TS-AST walk (not a regex — a comment `// iframe.src`
 * isn't a write) over the codebase. It flags:
 *
 *   • `<iframe src="..." />` / `<iframe src={url} />` — JSX form.
 *   • `iframe.src = "..."` — assignment-expression form on any identifier
 *     called `iframe` (typed or not — we look at the property name, not
 *     the type).
 *   • `iframe.setAttribute("src", ...)` — string-name form.
 *
 * Escape hatch: `// iframe-src-exempt` on or above the line. Used by
 * non-block-frame iframes that genuinely need to load a URL (e.g. a
 * future "preview a URL" feature that intentionally drops the opaque-
 * origin contract for some specific MIME type — and is then reviewed
 * separately).
 *
 * Pure: `(files) → violations`. Mirrors `jsx-text-check` / `button-type-check`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type IframeSrcViolation = { path: string; line: number; excerpt: string; kind: string };

const EXEMPT = "iframe-src-exempt";

function isIframeOpening(tagName: ts.JsxTagNameExpression): boolean {
	return tagName.getText() === "iframe";
}

function attrName(attr: ts.JsxAttributeLike): string | null {
	if (!ts.isJsxAttribute(attr)) return null;
	return attr.name.getText();
}

function isPropertyAccessName(expr: ts.Expression, name: string): boolean {
	if (!ts.isPropertyAccessExpression(expr)) return false;
	return expr.name.getText() === name;
}

function isSetAttributeWithSrc(call: ts.CallExpression): boolean {
	if (!ts.isPropertyAccessExpression(call.expression)) return false;
	if (call.expression.name.getText() !== "setAttribute") return false;
	const first = call.arguments[0];
	if (!first) return false;
	// HTML attribute names are case-insensitive — browsers normalise
	// `setAttribute("Src", …)` / `setAttribute("SRC", …)` to `src`, so
	// the guard must too. Pre-9.5.3-integrator-fix this was case-
	// sensitive, leaving a one-character bypass.
	if (ts.isStringLiteralLike(first) && first.text.toLowerCase() === "src") return true;
	return false;
}

// `el["src"] = ...` form. ElementAccessExpression with a string-literal
// key — equivalent to PropertyAccessExpression for the receiver, but a
// different AST node. Case-insensitive to match `setAttribute` semantics.
function isElementAccessSrc(expr: ts.Expression): expr is ts.ElementAccessExpression {
	if (!ts.isElementAccessExpression(expr)) return false;
	const arg = expr.argumentExpression;
	if (!ts.isStringLiteralLike(arg)) return false;
	return arg.text.toLowerCase() === "src";
}

export function findIframeSrcViolations(files: readonly SourceFileInput[]): IframeSrcViolation[] {
	const violations: IframeSrcViolation[] = [];
	for (const file of files) {
		const isTsx = file.path.endsWith(".tsx");
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const lines = file.source.split("\n");
		const exempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const flag = (node: ts.Node, kind: string): void => {
			const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, excerpt, kind });
		};

		const walk = (node: ts.Node): void => {
			// JSX form: <iframe src=...> or <iframe {...{src: url}} />.
			if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
				if (isIframeOpening(node.tagName)) {
					for (const prop of node.attributes.properties) {
						if (attrName(prop) === "src") {
							flag(prop, "jsx-src");
						}
						// Spread-attribute bypass: `<iframe {...{src: x}} />`
						// or `<iframe {...props} />` where props might contain
						// `src`. Object-literal spread we can inspect; arbitrary
						// identifier spread we flag conservatively so a caller
						// can add `// iframe-src-exempt` if they've verified.
						if (ts.isJsxSpreadAttribute(prop)) {
							const arg = prop.expression;
							if (ts.isObjectLiteralExpression(arg)) {
								for (const p of arg.properties) {
									if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "src") {
										flag(prop, "jsx-spread-src");
									}
								}
							} else {
								flag(prop, "jsx-spread-unknown");
							}
						}
					}
				}
			}
			// Assignment form: any `*.src = ...` where the receiver text
			// contains "iframe" / "frame" — covers `iframe.src = x`,
			// `el["src"] = x` (when `el` is named iframe-ish), etc.
			// We also catch the ElementAccessExpression form alongside
			// PropertyAccessExpression so `iframe["src"] = x` doesn't slip.
			if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
				let isSrcWrite = false;
				let receiver: ts.Expression | undefined;
				if (isPropertyAccessName(node.left, "src")) {
					isSrcWrite = true;
					receiver = (node.left as ts.PropertyAccessExpression).expression;
				} else if (isElementAccessSrc(node.left)) {
					isSrcWrite = true;
					receiver = (node.left as ts.ElementAccessExpression).expression;
				}
				if (isSrcWrite && receiver) {
					const objText = receiver.getText().toLowerCase();
					if (objText.includes("iframe") || objText.includes("frame")) {
						flag(node, "assign-src");
					}
				}
			}
			// setAttribute form: <anything>.setAttribute("src" | "Src" | …, ...)
			if (ts.isCallExpression(node) && isSetAttributeWithSrc(node)) {
				const recv = (node.expression as ts.PropertyAccessExpression).expression;
				const recvText = recv.getText().toLowerCase();
				if (recvText.includes("iframe") || recvText.includes("frame")) {
					flag(node, "setattr-src");
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
