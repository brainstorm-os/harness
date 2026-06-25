/**
 * KBN-3 — `KBN-G-focus-trap-without-restore` unit + repo-wide CI guard.
 * Mirrors `keyboard-raw-keys-check` / `a11y-button-name-check`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findFocusTrapsWithoutRestore } from "../src/tools/a11y-focus-trap-without-restore-check.ts";

const one = (source: string, path = "x.tsx") => findFocusTrapsWithoutRestore([{ path, source }]);

const IMPORT = 'import { useFocusTrap } from "@brainstorm/sdk/a11y";\n';

describe("findFocusTrapsWithoutRestore", () => {
	it("flags `useFocusTrap({ enabled })` (no restoreFocusTo)", () => {
		expect(one(`${IMPORT}const A = () => { useFocusTrap({ enabled: true }); };`)).toHaveLength(1);
	});

	it("flags `useFocusTrap()` (zero args)", () => {
		expect(one(`${IMPORT}const A = () => { useFocusTrap(); };`)).toHaveLength(1);
	});

	it("passes with `restoreFocusTo` property assignment", () => {
		expect(
			one(`${IMPORT}const A = () => { useFocusTrap({ enabled: true, restoreFocusTo: opener }); };`),
		).toEqual([]);
	});

	it("passes with shorthand `restoreFocusTo` (same-name identifier)", () => {
		expect(
			one(
				`${IMPORT}const A = ({restoreFocusTo}) => { useFocusTrap({ enabled: true, restoreFocusTo }); };`,
			),
		).toEqual([]);
	});

	it("passes with an opaque options identifier (conservative)", () => {
		expect(one(`${IMPORT}const A = (opts) => { useFocusTrap(opts); };`)).toEqual([]);
	});

	it("passes when the options object spreads `...rest` (could carry restoreFocusTo)", () => {
		expect(
			one(`${IMPORT}const A = (rest) => { useFocusTrap({ ...rest, enabled: true }); };`),
		).toEqual([]);
	});

	it("does NOT flag `useFocusTrap` from an unrelated module", () => {
		expect(
			one('import { useFocusTrap } from "./local-impl";\nconst A = () => { useFocusTrap({}); };'),
		).toEqual([]);
	});

	it("does NOT flag a same-named local function with no import", () => {
		expect(one("function useFocusTrap(){}\nconst A = () => { useFocusTrap({}); };")).toEqual([]);
	});

	it("flags relative-path imports of `useFocusTrap` from the a11y subpath", () => {
		const src = 'import { useFocusTrap } from "../a11y";\nconst A = () => { useFocusTrap({}); };';
		expect(one(src)).toHaveLength(1);
	});

	it("honours `// kbn-trap-restore-exempt` on the line", () => {
		const src = `${IMPORT}const A = () => { useFocusTrap({ enabled: true }); }; // kbn-trap-restore-exempt`;
		expect(one(src)).toEqual([]);
	});

	it("honours `// kbn-trap-restore-exempt` on the line above", () => {
		const src = `${IMPORT}// kbn-trap-restore-exempt\nconst A = () => { useFocusTrap({ enabled: true }); };`;
		expect(one(src)).toEqual([]);
	});

	it("reports path + 1-based line + excerpt", () => {
		const v = findFocusTrapsWithoutRestore([
			{
				path: "p/q.tsx",
				source: `${IMPORT}\nconst A = () => { useFocusTrap({ enabled: true }); };`,
			},
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3 });
		expect(v[0]?.excerpt).toContain("useFocusTrap");
	});

	it("ignores files that aren't .ts/.tsx", () => {
		expect(one(`${IMPORT}const A = () => { useFocusTrap({}); };`, "x.md")).toEqual([]);
	});
});

// ─── Repo-wide CI guard ───────────────────────────────────────────────────────
// SH-31/.32 snapshot pattern. Today's repo carries ZERO call sites
// missing `restoreFocusTo` (no production usage yet of `useFocusTrap`
// — only tests + the hook itself). Locks the floor at zero.

const KNOWN_VIOLATION_PATHS: ReadonlySet<string> = new Set<string>([]);

describe("repo-wide KBN-G-focus-trap-without-restore audit", () => {
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
		const all = findFocusTrapsWithoutRestore(files);

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
			`New useFocusTrap call sites without restoreFocusTo — add restoreFocusTo: ref / openerEl (or annotate // kbn-trap-restore-exempt):\n${unexpectedNew
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
