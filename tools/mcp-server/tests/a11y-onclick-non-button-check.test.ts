/**
 * KBN-3 — `KBN-G-onclick-non-button` unit + repo-wide CI guard tests.
 * Mirrors `keyboard-raw-keys-check` / `a11y-button-name-check`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findOnClickNonButton } from "../src/tools/a11y-onclick-non-button-check.ts";

const one = (source: string, path = "x.tsx") => findOnClickNonButton([{ path, source }]);

describe("findOnClickNonButton — mouse-only affordances", () => {
	it("flags `<div onClick={…} />`", () => {
		const v = one("const A = () => <div onClick={x} />;");
		expect(v).toHaveLength(1);
		expect(v[0]?.tag).toBe("div");
	});

	it("flags `<span onClick={…}>`, `<li onClick>`", () => {
		expect(one("const A = () => <span onClick={x}>Click</span>;")).toHaveLength(1);
		expect(one("const A = () => <li onClick={x}>Item</li>;")).toHaveLength(1);
	});

	it("does NOT flag interactive tags (button/a/input/textarea/select/label/option/summary)", () => {
		for (const t of ["button", "a", "input", "textarea", "select", "label", "option", "summary"]) {
			expect(one(`const A = () => <${t} onClick={x} />;`), `tag=${t}`).toEqual([]);
		}
	});

	it("does NOT flag a `<div onClick>` with a `role` attribute (any value)", () => {
		expect(one('const A = () => <div onClick={x} role="button" />;')).toEqual([]);
		expect(one('const A = () => <div onClick={x} role="menuitem" />;')).toEqual([]);
	});

	it("does NOT flag a `<div onClick>` with a `tabIndex` attribute (any value)", () => {
		expect(one("const A = () => <div onClick={x} tabIndex={0} />;")).toEqual([]);
		expect(one("const A = () => <div onClick={x} tabIndex={-1} />;")).toEqual([]);
	});

	it("does NOT flag a `<div onClick>` with `disabled` / `aria-disabled`", () => {
		expect(one("const A = () => <div onClick={x} disabled />;")).toEqual([]);
		expect(one('const A = () => <div onClick={x} aria-disabled="true" />;')).toEqual([]);
	});

	it("does NOT flag a contentEditable surface (the editor IS interactive)", () => {
		expect(one("const A = () => <div onClick={x} contentEditable />;")).toEqual([]);
	});

	it("does NOT flag PascalCase component tags (component owns its own contract)", () => {
		expect(one("const A = () => <Button onClick={x} />;")).toEqual([]);
		expect(one("const A = () => <MyClickable onClick={x} />;")).toEqual([]);
	});

	it("honours `// kbn-onclick-exempt` on the line", () => {
		expect(one("const A = () => <div onClick={x} />; // kbn-onclick-exempt")).toEqual([]);
	});

	it("honours `// kbn-onclick-exempt` on the line above", () => {
		expect(one("// kbn-onclick-exempt\nconst A = () => <div onClick={x} />;")).toEqual([]);
	});

	it("reports path + 1-based line + tag + excerpt", () => {
		const v = findOnClickNonButton([
			{ path: "p/q.tsx", source: "\n\nconst A=()=> <div onClick={x} />;" },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3, tag: "div" });
		expect(v[0]?.excerpt).toContain("onClick");
	});

	it("ignores non-.tsx files", () => {
		expect(one('const A = "<div onClick={x} />";', "x.ts")).toEqual([]);
	});
});

// ─── Repo-wide CI guard ───────────────────────────────────────────────────────
// SH-31/.32 snapshot pattern. Today's repo carries 2 hand-rolled
// mouse-only affordances — pinned here so apps must migrate onto
// `<button>` or annotate `role` + `tabIndex` (or accept exempt).

const KNOWN_VIOLATION_PATHS: ReadonlySet<string> = new Set<string>([
	"apps/files/src/ui/content-list.tsx",
	"packages/shell/src/renderer/help/help-article.tsx",
]);

describe("repo-wide KBN-G-onclick-non-button audit", () => {
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
				} else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx") && !p.endsWith(".stories.tsx")) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		const all = findOnClickNonButton(files);

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
			`New mouse-only affordance — use <button>, or add role + tabIndex, or annotate // kbn-onclick-exempt:\n${unexpectedNew
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
