/**
 * Stage 12.9 — ban a type-only import used as a runtime value.
 *
 * The silently-fatal `apps/*` trap (CLAUDE.md §Conventions that bite):
 * `import { type Texture } from "pixi.js"` then `Texture.from(...)`. The
 * `type` modifier means esbuild/Vite **strips the import entirely**, so
 * `Texture` is `undefined` at runtime and throws — with *zero* build or
 * typecheck signal, because the workspace `tsc` only covers the
 * `packages` sources and Vite never typechecks. This exact bug killed all
 * Graph icons and was "fixed" blind 5× ([[feedback_app_tsc_not_gated_import_type_trap]]).
 *
 * This is the structural (TS-AST, not regex — a type vs. value position
 * is genuinely structural) CI-enforceable guard. It flags a binding that
 * was imported type-only — whole-clause `import type { X }` / `import type
 * D` / `import type * as N`, or per-specifier `import { type X }` — and is
 * then referenced in a **value** position: a call/new callee, a
 * property/element-access target, or a JSX tag.
 *
 * Conservative by design (the repo-wide guard must have ~zero false
 * positives): only unambiguous value positions count; pure type positions
 * (`TypeReference`, `typeof` query, heritage) never match because none of
 * them is a call/access/JSX callee. A `type-value-exempt` comment on or
 * just above the line is the explicit escape hatch.
 *
 * Pure: `(files) → violations`. No fs here — the caller supplies sources
 * (unit tests pass fixtures; the guard passes the repo).
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type TypeImportViolation = { path: string; line: number; name: string };

const EXEMPT = "type-value-exempt";

/** Names imported type-only in this file (whole-clause or per-specifier). */
function typeOnlyBindings(sf: ts.SourceFile): Set<string> {
	const names = new Set<string>();
	for (const stmt of sf.statements) {
		if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
		const clause = stmt.importClause;
		const clauseIsType = clause.isTypeOnly;
		if (clause.name && clauseIsType) names.add(clause.name.text); // import type D from "..."
		const nb = clause.namedBindings;
		if (!nb) continue;
		if (ts.isNamespaceImport(nb)) {
			if (clauseIsType) names.add(nb.name.text); // import type * as N
		} else {
			for (const spec of nb.elements) {
				if (clauseIsType || spec.isTypeOnly) names.add(spec.name.text);
			}
		}
	}
	return names;
}

/** Is this identifier reference a runtime *value* use (not a type)? */
function isValuePosition(id: ts.Identifier): boolean {
	const p = id.parent;
	if (ts.isCallExpression(p) || ts.isNewExpression(p)) return p.expression === id;
	if (ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p)) {
		return p.expression === id;
	}
	if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) return p.tagName === id;
	return false;
}

export function findTypeOnlyImportUsedAsValue(
	files: readonly SourceFileInput[],
): TypeImportViolation[] {
	const violations: TypeImportViolation[] = [];
	for (const file of files) {
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const typeOnly = typeOnlyBindings(sf);
		if (typeOnly.size === 0) continue;

		const lines = file.source.split("\n");
		const exempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const walk = (node: ts.Node): void => {
			if (
				ts.isIdentifier(node) &&
				typeOnly.has(node.text) &&
				!ts.isImportSpecifier(node.parent) &&
				!ts.isImportClause(node.parent) &&
				!ts.isNamespaceImport(node.parent) &&
				isValuePosition(node)
			) {
				const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
				if (!exempt(line)) {
					violations.push({ path: file.path, line: line + 1, name: node.text });
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
