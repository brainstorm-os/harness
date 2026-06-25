/**
 * Stage 12.10 — ban a `t()` call whose key is missing from the manifest.
 *
 * Today an unknown `t(key)` returns a visible `[?key]` marker (per
 * `renderer/i18n/t.ts`) and ships to users — the i18n correctness
 * equivalent of the 12.9 import-type trap: silently fatal at the user
 * surface, invisible to typecheck. This is the structural CI-enforceable
 * guard mirroring 12.2 / 12.9: a TS-AST walk over the shell renderer
 * that flags every static `t("…")` / `tIfKey("…")` literal whose key is
 * absent from the live manifest.
 *
 * Conservative (zero false positives is the rule for repo-wide guards):
 * only flags **`t` / `tIfKey` identifiers actually imported from a
 * `…/i18n/t` module**, and only when the first argument is a literal
 * string. Dynamic / templated args are skipped (can't statically verify
 * — same stance as 12.2 skipping dynamic JSX expressions). A
 * `t-key-exempt` comment on or above the line is the explicit escape
 * hatch (rare: a key minted dynamically that's known at runtime).
 *
 * Pure: `(files, isKnown) → violations`. The CI guard supplies
 * `isKnown` by calling the live `t()` and asking "did it return the
 * `[?…]` marker?" — so the check rides the real runtime contract
 * instead of duplicating the manifest. Apps (which carry their own
 * manifests) are out of scope for this iteration; the shell renderer is
 * the bounded, unambiguous surface.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type TranslationKeyViolation = {
	path: string;
	line: number;
	key: string;
	fn: "t" | "tIfKey";
};

const I18N_MODULE_RE = /(^|\/)i18n\/t(\.[jt]sx?)?$/;
const EXEMPT = "t-key-exempt";

type Bound = { name: string; fn: "t" | "tIfKey" };

/** Names that this file imports from a `…/i18n/t` module, mapped back to
 *  which i18n function they bind to (renames honoured: `{ t as tr }`). */
function collectBindings(sf: ts.SourceFile): Map<string, "t" | "tIfKey"> {
	const bound = new Map<string, "t" | "tIfKey">();
	for (const stmt of sf.statements) {
		if (!ts.isImportDeclaration(stmt)) continue;
		const spec = stmt.moduleSpecifier;
		if (!ts.isStringLiteral(spec) || !I18N_MODULE_RE.test(spec.text)) continue;
		const clause = stmt.importClause;
		const nb = clause?.namedBindings;
		if (!nb || !ts.isNamedImports(nb)) continue;
		for (const el of nb.elements) {
			const imported = (el.propertyName ?? el.name).text;
			if (imported === "t" || imported === "tIfKey") {
				bound.set(el.name.text, imported);
			}
		}
	}
	return bound;
}

export function findUnknownTranslationKeys(
	files: readonly SourceFileInput[],
	isKnown: (key: string) => boolean,
): TranslationKeyViolation[] {
	const violations: TranslationKeyViolation[] = [];
	for (const file of files) {
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const bindings = collectBindings(sf);
		if (bindings.size === 0) continue;

		const lines = file.source.split("\n");
		const exempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const walk = (node: ts.Node): void => {
			if (
				ts.isCallExpression(node) &&
				ts.isIdentifier(node.expression) &&
				bindings.has(node.expression.text) &&
				node.arguments.length >= 1
			) {
				const arg = node.arguments[0];
				if (arg && ts.isStringLiteralLike(arg) && !isKnown(arg.text)) {
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					if (!exempt(line)) {
						const fn = bindings.get(node.expression.text);
						if (fn) {
							violations.push({ path: file.path, line: line + 1, key: arg.text, fn });
						}
					}
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
