/**
 * Stage 0.11 — ban raw `event.key` / `event.code` / `event.keyCode` /
 * `event.which` access (and direct keyboard `addEventListener`) outside
 * the small set of files that *are* the shortcut registry.
 *
 * Per [`docs/foundations/35-code-conventions.md §Keyboard handling`](../../../../docs/foundations/35-code-conventions.md)
 * + the project CLAUDE.md "Keyboard via the shortcut registry, never
 * raw `e.key`": every keyboard interaction in renderer + apps + SDK code
 * routes through a named action id via `useShortcut(id, handler)` (or
 * the SDK's `attachShortcut` / `attachFindShortcuts`). Raw `e.key` and
 * raw `addEventListener("keydown", …)` make the keyboard contract
 * un-greppable, defeat the cheatsheet, and leak chord-matching all over
 * the renderer.
 *
 * Structural CI guard mirrors 12.9 (`type-import-check`). Two checks
 * run together because they're the same policy from two angles:
 *
 *   1. `event.<key|code|keyCode|which>` on a parameter named
 *      `event` / `e` / `ev` / `evt` AND used in a "value-y" way
 *      (comparison, method chain, argument). The identifier heuristic
 *      keeps false positives down (so `entries.set(e.key, e)` where
 *      `e` is a Map entry doesn't trip the guard).
 *   2. `addEventListener("keydown" | "keyup" | "keypress", …)` —
 *      a registry implementation can pass through here, every other
 *      caller must adopt `useShortcut` / `attachShortcut`.
 *
 * Allowlist (the chord-matching modules themselves):
 *
 *   - `packages/shell/src/renderer/shortcuts/**`
 *   - `packages/sdk/src/shortcut/**`, `packages/sdk/src/find-replace/**`,
 *     `packages/sdk/src/popover/**`, `packages/sdk/src/object-menu/**`,
 *     `packages/sdk/src/property-ui/use-anchored-panel.ts`,
 *     `packages/sdk/src/property-ui/use-dictionary-shortcut.ts`,
 *     `packages/sdk/src/resizable.ts`
 *   - Every app's `*chord*.ts` / `*shortcut*.ts` / `keyboard/**` —
 *     the per-app chord layer (shared parser, registered action ids,
 *     no raw keys leak out of these modules).
 *
 * Escape hatch: a `// keyboard-exempt` comment on or one line above the
 * offending line — mirrors the existing checker pattern (12.2 / 12.9 /
 * 12.10 / 12.11 / 12.12 / 12.13 / 12.14 / SH-32). Used sparingly for
 * the rare legitimate raw-key — flagged by the SH-32 orphan-exempts
 * audit if the underlying code stops needing it.
 *
 * Pure: `(files) → violations`. No fs here — the caller supplies
 * sources (unit tests pass fixtures; the repo-wide guard passes the
 * repo). Same I/O shape as `findTypeOnlyImportUsedAsValue`.
 */

import ts from "typescript";
import type { SourceFileInput } from "./jsx-text-check.ts";

export enum KeyboardViolationKind {
	/** `event.key === "X"` / `e.key.toLowerCase()` / `evt.code` — direct
	 *  property access on a KeyboardEvent. */
	RawKeyAccess = "raw-key-access",
	/** `target.addEventListener("keydown" | "keyup" | "keypress", …)`
	 *  outside the allowlist. */
	RawKeydownListener = "raw-keydown-listener",
}

export type KeyboardViolation = {
	path: string;
	line: number;
	kind: KeyboardViolationKind;
	excerpt: string;
};

const EXEMPT = "keyboard-exempt";

/** Variable / parameter names that are conventionally a KeyboardEvent.
 *  Anything else (`entry`, `row`, …) is excluded — too many false
 *  positives in iteration code (`Map<string, Entry>`-style `e.key`). */
const EVENT_IDENTIFIERS = new Set(["event", "e", "ev", "evt"]);

/** KeyboardEvent fields that signal a raw-key contract. `.key` /
 *  `.code` / `.keyCode` / `.which`. (`.shiftKey` / `.metaKey` / etc.
 *  are not raw keys — they're modifier predicates the chord parser
 *  uses, and they're common in pointer handlers too.) */
const KEY_FIELDS = new Set(["key", "code", "keyCode", "which"]);

const LISTENER_EVENT_NAMES = new Set(["keydown", "keyup", "keypress"]);

/** Path segments / filename suffixes that mark "this file IS the
 *  shortcut registry". Match in either `/` or `\` form (the checker
 *  treats `path` as opaque; tests use POSIX, repo paths are POSIX on
 *  CI hosts). The allowlist is intentionally narrow — every entry is
 *  a known chord-parser module. */
const ALLOWLIST_SUBSTRINGS: readonly string[] = [
	"/renderer/shortcuts/",
	"/sdk/src/shortcut/",
	"/sdk/src/find-replace/",
	"/sdk/src/popover/",
	"/sdk/src/object-menu/",
	"/sdk/src/property-ui/use-anchored-panel.ts",
	"/sdk/src/property-ui/use-dictionary-shortcut.ts",
	"/sdk/src/resizable.ts",
	// The `@brainstorm/sdk/a11y` substrate (KBN-1a/b/2) owns the bare keys
	// inside the focused composite (Arrow*, Tab/Shift+Tab, Home/End,
	// Page*, Enter/Space, Escape, F6) per docs/shell/61-keyboard-
	// accessibility.md §"chord vs context-key boundary". These are
	// canonical raw-key sites, not shortcut-registry leaks.
	"/sdk/src/a11y/",
	"/keyboard/",
	"/shortcuts.ts",
	"/shortcuts.tsx",
];

/** Filename basenames that match the per-app chord layer pattern
 *  (`*chord*`, `*shortcut*`). Used as a second-pass allowlist after
 *  `ALLOWLIST_SUBSTRINGS`. */
const ALLOWLIST_BASENAME_PATTERNS: readonly RegExp[] = [
	/-chord(s)?\.tsx?$/,
	/-shortcut(s)?\.tsx?$/,
];

export function isAllowlistedKeyboardFile(path: string): boolean {
	for (const seg of ALLOWLIST_SUBSTRINGS) {
		if (path.includes(seg)) return true;
	}
	for (const re of ALLOWLIST_BASENAME_PATTERNS) {
		if (re.test(path)) return true;
	}
	return false;
}

/** Is this `node` a Identifier whose name is one of the `event-ish`
 *  parameter conventions? */
function isEventIdent(node: ts.Node): node is ts.Identifier {
	return ts.isIdentifier(node) && EVENT_IDENTIFIERS.has(node.text);
}

/** A PropertyAccess `<ident>.<field>` where `<ident>` is event-ish
 *  and `<field>` is one of the KeyboardEvent raw-key fields. */
function isRawKeyAccess(node: ts.PropertyAccessExpression): boolean {
	if (!isEventIdent(node.expression)) return false;
	return KEY_FIELDS.has(node.name.text);
}

/** Conservative position check: only flag the access when it sits in
 *  a context that proves it's being *used* (not just read into a
 *  passthrough alias). This mirrors `type-import-check`'s "value
 *  position" idea — keep the guard tight enough to avoid noise.
 *
 *   - parent is a comparison (`===`, `!==`, `==`, `!=`, `<`, `>`, …)
 *   - parent is a CallExpression argument (`callback(event.key)`)
 *   - parent is a PropertyAccessExpression where THIS access is the
 *     expression (`event.key.toLowerCase()`)
 *   - parent is an ElementAccessExpression / TemplateExpression
 *     (`map[event.key]`, `` `${event.key}` ``)
 *   - parent is a Switch discriminant (`switch (event.key) {…}`)
 *   - parent is a `case` label expression — but only after one of the
 *     above flagged the read; not a position on its own.
 *
 *  The "value position" set is generous: we'd rather flag a benign
 *  `const k = event.key; doStuff(k)` as a violation than miss the
 *  raw-key contract leak — the exempt comment exists for that exact
 *  case. The "passthrough alias" case is rare; if it surfaces, an
 *  exempt is the right answer.
 */
function isUsedAsKeyboardValue(access: ts.PropertyAccessExpression): boolean {
	const parent = access.parent;
	if (!parent) return false;
	if (ts.isBinaryExpression(parent)) return true;
	if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
		// Either the callee (rare for a property access) or an argument.
		return parent.expression === access || (parent.arguments?.includes(access) ?? false);
	}
	if (ts.isPropertyAccessExpression(parent) && parent.expression === access) return true;
	if (ts.isElementAccessExpression(parent) && parent.expression === access) return true;
	if (ts.isTemplateSpan(parent)) return true;
	if (ts.isSwitchStatement(parent) && parent.expression === access) return true;
	if (ts.isCaseClause(parent) && parent.expression === access) return true;
	if (ts.isConditionalExpression(parent) && parent.condition === access) return true;
	if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) return true;
	if (ts.isReturnStatement(parent)) return true;
	if (ts.isVariableDeclaration(parent) && parent.initializer === access) return true;
	return false;
}

/** Detect `target.addEventListener("keydown" | "keyup" | "keypress",
 *  …)` calls. We don't need to type-check `target` — any string
 *  literal in that slot for those names is a keyboard listener. */
function listenerEventName(call: ts.CallExpression): string | null {
	if (!ts.isPropertyAccessExpression(call.expression)) return null;
	if (call.expression.name.text !== "addEventListener") return null;
	const first = call.arguments[0];
	if (!first) return null;
	if (!ts.isStringLiteralLike(first)) return null;
	return LISTENER_EVENT_NAMES.has(first.text) ? first.text : null;
}

export function findRawKeyboardAccess(files: readonly SourceFileInput[]): KeyboardViolation[] {
	const violations: KeyboardViolation[] = [];
	for (const file of files) {
		if (isAllowlistedKeyboardFile(file.path)) continue;
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

		const flag = (node: ts.Node, kind: KeyboardViolationKind): void => {
			const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
			if (exempt(line)) return;
			const excerpt = (lines[line] ?? "").trim();
			violations.push({ path: file.path, line: line + 1, kind, excerpt });
		};

		const walk = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node) && isRawKeyAccess(node)) {
				if (isUsedAsKeyboardValue(node)) {
					flag(node, KeyboardViolationKind.RawKeyAccess);
				}
			}
			if (ts.isCallExpression(node)) {
				const evName = listenerEventName(node);
				if (evName !== null) {
					flag(node, KeyboardViolationKind.RawKeydownListener);
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
	}
	return violations;
}
