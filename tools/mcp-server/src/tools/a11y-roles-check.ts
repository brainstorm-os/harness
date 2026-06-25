/**
 * KBN-3 — `KBN-G-roles`. Hand-written `role="listbox|grid|tree|tablist|
 * toolbar|radiogroup"` outside `@brainstorm/sdk/a11y` is flagged.
 *
 * Per [`docs/shell/61-keyboard-accessibility.md` §Validation](../../../../docs/shell/61-keyboard-accessibility.md#validation)
 * + CLAUDE.md "DRY everywhere — extract before you copy": every
 * composite-keyboard role (listbox / grid / tree / tablist / toolbar /
 * radiogroup) must flow through the SDK hook that stamps
 * `containerProps.role` (KBN-1b's `useCompositeKeyboard` /
 * `useTreeKeyboard` / `useRegionNavigation`). Spelling the role by
 * hand drops the keyboard contract — the surrounding code never gets
 * arrow-key handling, type-ahead, focus-restore, or the
 * `aria-activedescendant` mirroring.
 *
 * Allowlist: `packages/sdk/src/a11y/` — the substrate IS the place
 * where the role is stamped; flagging it would be circular.
 *
 * Match shapes:
 *   1. JSX `role="listbox"` (string literal).
 *   2. JSX `role={"listbox"}` (string literal in JsxExpression).
 *   3. JS property-set `el.role = "listbox"` (rare; covered for
 *      symmetry with the tabindex guard).
 *   4. JS `el.setAttribute("role", "listbox")`.
 *
 * Per-line escape hatch: `// kbn-roles-exempt`.
 *
 * Pure: `(files) → findings`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export type CompositeRoleViolation = {
	path: string;
	line: number;
	role: string;
	excerpt: string;
};

const EXEMPT = "kbn-roles-exempt";

export const COMPOSITE_ROLES: ReadonlySet<string> = new Set([
	"listbox",
	"grid",
	"tree",
	"tablist",
	"toolbar",
	"radiogroup",
]);

const ALLOWLIST_SUBSTRINGS: readonly string[] = ["/sdk/src/a11y/", "/packages/sdk/src/a11y/"];

export function isAllowlistedRolesFile(path: string): boolean {
	for (const seg of ALLOWLIST_SUBSTRINGS) {
		if (path.includes(seg)) return true;
	}
	return false;
}

function attrStringLiteral(init: ts.JsxAttributeValue | undefined): string | null {
	if (!init) return null;
	if (ts.isStringLiteral(init)) return init.text;
	if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
		return init.expression.text;
	}
	return null;
}

function assignmentToRole(node: ts.BinaryExpression): string | null {
	if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return null;
	const lhs = node.left;
	if (!ts.isPropertyAccessExpression(lhs)) return null;
	if (lhs.name.text !== "role") return null;
	const rhs = node.right;
	if (ts.isStringLiteralLike(rhs)) return rhs.text;
	return null;
}

function setAttributeRole(call: ts.CallExpression): string | null {
	if (!ts.isPropertyAccessExpression(call.expression)) return null;
	if (call.expression.name.text !== "setAttribute") return null;
	const [nameArg, valueArg] = call.arguments;
	if (!nameArg || !valueArg) return null;
	if (!ts.isStringLiteralLike(nameArg)) return null;
	if (nameArg.text.toLowerCase() !== "role") return null;
	if (ts.isStringLiteralLike(valueArg)) return valueArg.text;
	return null;
}

export function findRawCompositeRoles(files: readonly SourceFileInput[]): CompositeRoleViolation[] {
	const violations: CompositeRoleViolation[] = [];
	for (const file of files) {
		if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue;
		if (isAllowlistedRolesFile(file.path)) continue;
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

		const flag = (node: ts.Node, role: string): void => {
			const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, role, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isJsxAttribute(node)) {
				if (node.name.getText() === "role") {
					const lit = attrStringLiteral(node.initializer);
					if (lit !== null && COMPOSITE_ROLES.has(lit)) flag(node, lit);
				}
			}
			if (ts.isBinaryExpression(node)) {
				const v = assignmentToRole(node);
				if (v !== null && COMPOSITE_ROLES.has(v)) flag(node, v);
			}
			if (ts.isCallExpression(node)) {
				const v = setAttributeRole(node);
				if (v !== null && COMPOSITE_ROLES.has(v)) flag(node, v);
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
