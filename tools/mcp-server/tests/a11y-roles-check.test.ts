/**
 * KBN-3 — `KBN-G-roles` unit + repo-wide CI guard tests.
 * Mirrors `keyboard-raw-keys-check` / `a11y-button-name-check`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findRawCompositeRoles, isAllowlistedRolesFile } from "../src/tools/a11y-roles-check.ts";

const one = (source: string, path = "x.tsx") => findRawCompositeRoles([{ path, source }]);

describe("findRawCompositeRoles — composite roles in JSX", () => {
	it('flags `role="listbox"`', () => {
		const v = one('const A = () => <div role="listbox" />;');
		expect(v).toHaveLength(1);
		expect(v[0]?.role).toBe("listbox");
	});

	it('flags `role={"grid"}` (string literal in JsxExpression)', () => {
		const v = one('const A = () => <div role={"grid"} />;');
		expect(v).toHaveLength(1);
		expect(v[0]?.role).toBe("grid");
	});

	it("flags every composite role in the set", () => {
		for (const r of ["listbox", "grid", "tree", "tablist", "toolbar", "radiogroup"]) {
			const v = one(`const A = () => <div role="${r}" />;`);
			expect(v, `role=${r}`).toHaveLength(1);
		}
	});

	it("does NOT flag non-composite roles", () => {
		for (const r of ["button", "dialog", "menuitem", "navigation", "presentation"]) {
			expect(one(`const A = () => <div role="${r}" />;`), `role=${r}`).toEqual([]);
		}
	});

	it("does NOT flag a dynamic `role={x}` (opaque)", () => {
		expect(one("const A = ({x}) => <div role={x} />;")).toEqual([]);
	});
});

describe("findRawCompositeRoles — JS shapes", () => {
	it('flags `el.role = "listbox"`', () => {
		expect(one('function f(el) { el.role = "listbox"; }', "x.ts")).toHaveLength(1);
	});

	it('flags `el.setAttribute("role", "grid")`', () => {
		expect(one('function f(el) { el.setAttribute("role", "grid"); }', "x.ts")).toHaveLength(1);
	});

	it("does NOT flag non-composite setAttribute", () => {
		expect(one('function f(el) { el.setAttribute("role", "dialog"); }', "x.ts")).toEqual([]);
	});
});

describe("findRawCompositeRoles — allowlist", () => {
	it("admits the SDK a11y subpath", () => {
		expect(isAllowlistedRolesFile("packages/sdk/src/a11y/use-composite-keyboard.ts")).toBe(true);
		expect(isAllowlistedRolesFile("/abs/repo/packages/sdk/src/a11y/index.ts")).toBe(true);
	});

	it("rejects ordinary app source", () => {
		expect(isAllowlistedRolesFile("apps/database/src/app.ts")).toBe(false);
		expect(isAllowlistedRolesFile("packages/sdk/src/property-ui/cell.tsx")).toBe(false);
	});

	it("does NOT flag a hand-written role inside the SDK a11y subpath", () => {
		const path = "packages/sdk/src/a11y/use-composite-keyboard.ts";
		expect(
			findRawCompositeRoles([{ path, source: 'const A = () => <div role="listbox" />;' }]),
		).toEqual([]);
	});
});

describe("findRawCompositeRoles — escape hatch + reporting", () => {
	it("honours `// kbn-roles-exempt` on the line", () => {
		expect(one('const A = () => <div role="listbox" />; // kbn-roles-exempt')).toEqual([]);
	});

	it("honours `// kbn-roles-exempt` on the line above", () => {
		expect(one('// kbn-roles-exempt\nconst A = () => <div role="listbox" />;')).toEqual([]);
	});

	it("reports path + 1-based line + role + excerpt", () => {
		const v = findRawCompositeRoles([
			{ path: "p/q.tsx", source: '\n\nconst A=()=> <div role="listbox" />;' },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3, role: "listbox" });
		expect(v[0]?.excerpt).toContain('role="listbox"');
	});

	it("ignores files that aren't .ts/.tsx", () => {
		expect(one('const A = "<div role=\\"listbox\\" />";', "x.html")).toEqual([]);
	});
});

// ─── Repo-wide CI guard ───────────────────────────────────────────────────────
// SH-31/.32 snapshot pattern. Today's repo carries 14 hand-rolled
// composite-role sites across 14 files — pinned here so the gate's
// stale-snapshot mechanic forces a real cleanup (apps must migrate
// onto `useCompositeKeyboard` / `useTreeKeyboard` / friends and drop
// the literal role attribute). The launcher (combobox), vault-switcher
// (listbox), marketplace (listbox + tablist), window-strip (toolbar),
// the icon/cover pickers, the shared `<Segmented>` primitive, the
// appearance + membership radiogroups, the devices-join tablist, the
// open-with-prompt radiogroup, and the Data-section kind grid +
// text-format row migrated off their literal composite roles onto
// `useCompositeKeyboard` in the KBN-S-* / KBN-G-roles drain (2026-05-29).
// The `property-ui` link/tag cells migrated onto the shared
// `useCellOptionsKeyboard` combobox hook (2026-05-31). What remains is the
// 12 KBN-A app surfaces (Phase 2).

const KNOWN_VIOLATION_PATHS: ReadonlySet<string> = new Set<string>([
	// Notes editor plugins (typeaheads / inline toolbars / inspectors + the
	// B11.3 select-field popover) — composite roles gated on the Lexical-decorator
	// KBN-A work, which rides the B11.x editor-parity ladder, not the 12.4 sweep.
	"apps/notes/src/editor/add-property-menu-plugin.tsx",
	"apps/notes/src/editor/block-embed-picker-plugin.tsx",
	"apps/notes/src/editor/link-markup-plugin.tsx",
	"apps/notes/src/editor/media-inspector-plugin.tsx",
	"apps/notes/src/editor/nodes/select-field-node.tsx",
	// Whiteboard board-list adopted the composite-keyboard binding
	// (KBN-A-whiteboard); the remaining literal is the canvas authoring `toolbar`.
	"apps/whiteboard/src/app.ts",
	// The window-management tab strip (shell chrome) — hand-written `tablist`/`tab`.
	"packages/shell/src/renderer/chrome/tab-strip.tsx",
]);

describe("repo-wide KBN-G-roles audit", () => {
	it("flags only the known pre-existing sites — anything new is a regression", () => {
		const roots = ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
		const files: { path: string; source: string }[] = [];
		const walk = (dir: string): void => {
			let entries: string[];
			try {
				entries = readdirSync(dir);
			} catch {
				return;
			}
			for (const e of entries) {
				const p = join(dir, e);
				let stat: ReturnType<typeof statSync>;
				try {
					stat = statSync(p);
				} catch {
					continue;
				}
				if (stat.isDirectory()) {
					if (e === "node_modules" || e === "dist" || e === ".git") continue;
					walk(p);
				} else if (
					(p.endsWith(".ts") || p.endsWith(".tsx")) &&
					!p.endsWith(".d.ts") &&
					!p.endsWith(".test.ts") &&
					!p.endsWith(".test.tsx")
				) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		const all = findRawCompositeRoles(files);

		const liveBuckets = new Map<string, number>();
		for (const v of all) {
			const rel = v.path.replace(`${repoPath("")}/`, "");
			liveBuckets.set(rel, (liveBuckets.get(rel) ?? 0) + 1);
		}
		const live = new Set(liveBuckets.keys());

		const unexpectedNew = [...live].filter((p) => !KNOWN_VIOLATION_PATHS.has(p)).sort();
		const stale = [...KNOWN_VIOLATION_PATHS].filter((p) => !live.has(p)).sort();

		expect(
			unexpectedNew,
			`New hand-written composite-role sites — route through @brainstorm/sdk/a11y or annotate // kbn-roles-exempt:\n${unexpectedNew
				.map((p) => `  ${p}  (${liveBuckets.get(p)} site(s))`)
				.join("\n")}`,
		).toEqual([]);
		expect(
			stale,
			`KNOWN_VIOLATION_PATHS contains entries with no live violation — prune the snapshot:\n${stale
				.map((p) => `  ${p}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
