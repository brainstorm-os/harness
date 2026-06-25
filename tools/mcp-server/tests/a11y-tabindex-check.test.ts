/**
 * KBN-3 — `KBN-G-tabindex` unit + repo-wide CI guard tests.
 * Mirrors `keyboard-raw-keys-check` / `a11y-button-name-check`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findPositiveTabindexes } from "../src/tools/a11y-tabindex-check.ts";

const one = (source: string, path = "x.tsx") => findPositiveTabindexes([{ path, source }]);

describe("findPositiveTabindexes — JSX shapes", () => {
	it("flags `tabIndex={5}` (positive integer literal in JsxExpression)", () => {
		const v = one("const A = () => <div tabIndex={5} />;");
		expect(v).toHaveLength(1);
		expect(v[0]?.value).toBe(5);
	});

	it('flags `tabIndex="5"` (positive integer string literal)', () => {
		const v = one('const A = () => <div tabIndex="5" />;');
		expect(v).toHaveLength(1);
		expect(v[0]?.value).toBe(5);
	});

	it("flags lowercase `tabindex` JSX attribute too", () => {
		const v = one("const A = () => <div tabindex={3} />;");
		expect(v).toHaveLength(1);
		expect(v[0]?.value).toBe(3);
	});

	it("does NOT flag `tabIndex={0}` (focusable, in tab order)", () => {
		expect(one("const A = () => <div tabIndex={0} />;")).toEqual([]);
	});

	it("does NOT flag `tabIndex={-1}` (programmatically focusable)", () => {
		expect(one("const A = () => <div tabIndex={-1} />;")).toEqual([]);
	});

	it("does NOT flag a dynamic `tabIndex={x}` (opaque — could be 0/-1)", () => {
		expect(one("const A = ({x}) => <div tabIndex={x} />;")).toEqual([]);
	});

	it("does NOT flag PascalCase component props (component owns contract)", () => {
		// Same rationale as a11y-button-name-check: a component's own
		// internal use of tabIndex={5} is its responsibility. The JSX
		// site only encodes the developer's intent at this surface — a
		// raw `<div tabIndex={5}>` is the bug class.
		// Even a PascalCase tag's `tabIndex={5}` is flagged here because
		// the value is statically a positive literal — the host element
		// inherits it. Documented as intentional.
		expect(one("const A = () => <Button tabIndex={5} />;")).toHaveLength(1);
	});
});

describe("findPositiveTabindexes — JS shapes", () => {
	it("flags `el.tabIndex = 5` assignment", () => {
		const v = one("function f(el) { el.tabIndex = 5; }", "x.ts");
		expect(v).toHaveLength(1);
		expect(v[0]?.value).toBe(5);
	});

	it("does NOT flag `el.tabIndex = 0` / `-1`", () => {
		expect(one("function f(el) { el.tabIndex = 0; }", "x.ts")).toEqual([]);
		expect(one("function f(el) { el.tabIndex = -1; }", "x.ts")).toEqual([]);
	});

	it('flags `el.setAttribute("tabindex", "5")` and integer form', () => {
		expect(one('function f(el) { el.setAttribute("tabindex", "5"); }', "x.ts")).toHaveLength(1);
		expect(one('function f(el) { el.setAttribute("tabindex", 7); }', "x.ts")).toHaveLength(1);
	});

	it('does NOT flag `el.setAttribute("tabindex", "0")` / `"-1"`', () => {
		expect(one('function f(el) { el.setAttribute("tabindex", "0"); }', "x.ts")).toEqual([]);
		expect(one('function f(el) { el.setAttribute("tabindex", "-1"); }', "x.ts")).toEqual([]);
	});

	it('flags case-insensitive `setAttribute("TabIndex", ...)` only when name matches lowercased', () => {
		// Browsers normalize. The guard lowercases the attribute name.
		expect(one('function f(el) { el.setAttribute("TABINDEX", "5"); }', "x.ts")).toHaveLength(1);
	});
});

describe("findPositiveTabindexes — escape hatch + reporting", () => {
	it("honours `// kbn-tabindex-exempt` on the line", () => {
		expect(one("const A = () => <div tabIndex={5} />; // kbn-tabindex-exempt")).toEqual([]);
	});

	it("honours `// kbn-tabindex-exempt` on the line above", () => {
		expect(one("// kbn-tabindex-exempt\nconst A = () => <div tabIndex={5} />;")).toEqual([]);
	});

	it("reports path + 1-based line + excerpt", () => {
		const v = findPositiveTabindexes([
			{ path: "p/q.tsx", source: "\n\nconst A=()=> <div tabIndex={5} />;" },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3, value: 5 });
		expect(v[0]?.excerpt).toContain("tabIndex");
	});

	it("ignores files that aren't .ts/.tsx", () => {
		expect(one("const A = '<div tabIndex={5} />';", "x.html")).toEqual([]);
	});
});

// ─── Repo-wide CI guard ───────────────────────────────────────────────────────
// SH-31/.32 snapshot pattern (per keyboard-raw-keys-check.ts). Today's
// repo carries ZERO positive-tabindex sites — the snapshot is empty and
// the guard locks the floor at zero. Any new positive-tabindex site
// fails this test → fix it or annotate `// kbn-tabindex-exempt`.

const KNOWN_VIOLATION_PATHS: ReadonlySet<string> = new Set<string>([]);

describe("repo-wide KBN-G-tabindex audit", () => {
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
		const all = findPositiveTabindexes(files);

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
			`New positive-tabindex sites — use tabIndex={0}/{-1} (or annotate // kbn-tabindex-exempt):\n${unexpectedNew
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
