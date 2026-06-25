/**
 * KBN-3 — `KBN-G-focus-trap-without-restore`. Every `useFocusTrap({…})`
 * call site needs a `restoreFocusTo` option. The trap pushes focus into
 * a modal subtree; without a `restoreFocusTo` the trap closes and the
 * user's focus is lost (drops to `<body>`), defeating the keyboard
 * contract on overlay dismissal.
 *
 * Per [`docs/shell/61-keyboard-accessibility.md` §Validation](../../../../docs/shell/61-keyboard-accessibility.md#validation):
 * a `useFocusTrap` call site without `restoreFocusTo` is flagged.
 *
 * Detection: only flag `useFocusTrap` imported from
 * `@brainstorm/sdk/a11y` (or the relative-path equivalent inside the
 * SDK's own a11y package). A local function with the same name in an
 * unrelated module is out of scope. The import check keeps the guard
 * narrow without an external symbol-resolver pass.
 *
 * Match shapes:
 *   1. `useFocusTrap({ enabled, restoreFocusTo, … })` — property is a
 *      literal or a shorthand `restoreFocusTo` identifier. PASSES.
 *   2. `useFocusTrap({ enabled })` — no `restoreFocusTo`. FAILS.
 *   3. `useFocusTrap(opts)` — opaque options object; cannot statically
 *      verify. PASSES (conservative — same stance as `a11y-button-name`
 *      on opaque `{variable}` children).
 *   4. A spread inside the options object (`{...rest, enabled}`)
 *      means the value MAY carry `restoreFocusTo`. PASSES.
 *
 * Per-line escape hatch: `// kbn-trap-restore-exempt`.
 *
 * Pure: `(files) → findings`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type FocusTrapMissingRestoreViolation = {
	path: string;
	line: number;
	excerpt: string;
};

const EXEMPT = "kbn-trap-restore-exempt";
const HOOK_NAME = "useFocusTrap";
const RESTORE_PROP = "restoreFocusTo";

/** Treat imports from these module specifiers as the canonical
 *  `useFocusTrap` entry point. The relative-path form covers the
 *  SDK's own internal callers if any. */
const A11Y_MODULE_SPECIFIERS: readonly RegExp[] = [
	/^@brainstorm\/sdk\/a11y$/,
	/\.\.?\/a11y(\/.*)?$/,
	/\/sdk\/src\/a11y(\/.*)?$/,
];

function importComesFromA11ySubpath(spec: string): boolean {
	for (const re of A11Y_MODULE_SPECIFIERS) {
		if (re.test(spec)) return true;
	}
	return false;
}

/** Walk a SourceFile's top-level imports for `useFocusTrap` from the
 *  a11y subpath; return true if the name is in scope as the SDK hook. */
function fileImportsHook(sf: ts.SourceFile): boolean {
	for (const stmt of sf.statements) {
		if (!ts.isImportDeclaration(stmt)) continue;
		if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
		if (!importComesFromA11ySubpath(stmt.moduleSpecifier.text)) continue;
		const clause = stmt.importClause;
		if (!clause) continue;
		const bindings = clause.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) continue;
		for (const el of bindings.elements) {
			const local = el.name.text;
			const imported = el.propertyName?.text ?? local;
			if (imported === HOOK_NAME) return true;
		}
	}
	return false;
}

/** Inspect a `useFocusTrap(arg)` call; return true iff the argument is
 *  a statically verifiable options object that LACKS `restoreFocusTo`. */
function callMissesRestore(call: ts.CallExpression): boolean {
	const [arg] = call.arguments;
	if (!arg) return true; // zero args — clearly missing
	// Opaque options (an identifier, function call, etc.) — pass.
	if (!ts.isObjectLiteralExpression(arg)) return false;
	for (const prop of arg.properties) {
		// `...spread` could carry restoreFocusTo — pass.
		if (ts.isSpreadAssignment(prop)) return false;
		if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
			const nameNode = prop.name;
			if (nameNode && ts.isIdentifier(nameNode) && nameNode.text === RESTORE_PROP) {
				return false;
			}
			if (nameNode && ts.isStringLiteralLike(nameNode) && nameNode.text === RESTORE_PROP) {
				return false;
			}
		}
		if (ts.isMethodDeclaration(prop)) {
			const nameNode = prop.name;
			if (nameNode && ts.isIdentifier(nameNode) && nameNode.text === RESTORE_PROP) {
				return false;
			}
		}
	}
	return true;
}

export function findFocusTrapsWithoutRestore(
	files: readonly SourceFileInput[],
): FocusTrapMissingRestoreViolation[] {
	const violations: FocusTrapMissingRestoreViolation[] = [];
	for (const file of files) {
		if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue;
		const sf = ts.createSourceFile(
			file.path,
			file.source,
			ts.ScriptTarget.Latest,
			true,
			file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		if (!fileImportsHook(sf)) continue;
		const lines = file.source.split("\n");
		const exempt = (line0: number): boolean =>
			(lines[line0] ?? "").includes(EXEMPT) || (lines[line0 - 1] ?? "").includes(EXEMPT);

		const flag = (call: ts.CallExpression): void => {
			const { line } = sf.getLineAndCharacterOfPosition(call.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				const callee = node.expression;
				if (ts.isIdentifier(callee) && callee.text === HOOK_NAME) {
					if (callMissesRestore(node)) flag(node);
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
