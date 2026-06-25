import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findHardcodedJsxText } from "../src/tools/jsx-text-check.ts";

const one = (source: string) => findHardcodedJsxText([{ path: "x.tsx", source }]);

describe("findHardcodedJsxText", () => {
	it("flags a bare user-visible JSX text child", () => {
		const v = one("const A = () => <div>Something went wrong</div>;");
		expect(v).toHaveLength(1);
		expect(v[0]?.text).toBe("Something went wrong");
	});

	it("flags a string-literal used as a child expression", () => {
		expect(one('const A = () => <span>{"Try again"}</span>;')).toHaveLength(1);
	});

	it("does NOT flag t() / dynamic expressions / interpolated data", () => {
		expect(one('const A = () => <div>{t("a.b")}</div>;')).toEqual([]);
		expect(one("const A = () => <div>{count} items</div>;").map((x) => x.text)).toEqual(["items"]);
		expect(one("const A = ({x}) => <span>{x}</span>;")).toEqual([]);
	});

	it("ignores punctuation / separators / entities / numbers (no real word)", () => {
		expect(one("const A = () => <span>·</span>;")).toEqual([]);
		expect(one("const A = () => <span>—</span>;")).toEqual([]);
		expect(one("const A = () => <span>42</span>;")).toEqual([]);
		expect(one("const A = () => <kbd>⌘K</kbd>;")).toEqual([]);
	});

	it("skips an aria-hidden subtree (decorative)", () => {
		expect(one('const A = () => <span aria-hidden="true">Loading dots</span>;')).toEqual([]);
		expect(one('const A = () => <div aria-hidden="true"><span>Nested copy</span></div>;')).toEqual(
			[],
		);
		// aria-hidden={false} / dynamic → still flagged.
		expect(one('const A = () => <span aria-hidden="false">Real copy</span>;')).toHaveLength(1);
	});

	it("honours an `i18n-exempt` comment on or above the line", () => {
		expect(one("const A = () => <div>{/* i18n-exempt */}Brand</div>;")).toEqual([]);
		expect(one("// i18n-exempt\nconst A = () => <div>Brand</div>;")).toEqual([]);
	});

	it("reports path + 1-based line", () => {
		const v = findHardcodedJsxText([
			{ path: "p/q.tsx", source: "\n\nconst A=()=> <p>Hello world</p>;" },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3 });
	});
});

// CI guard (Stage 12.2): the real UI surface must stay free of hardcoded
// user-visible JSX text. A new violation fails here, not in a vault.
describe("repo UI surface has no hardcoded JSX text", () => {
	it("apps/* + shell renderer + sdk .tsx are all t()-clean", () => {
		const roots = ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
		const files: { path: string; source: string }[] = [];
		const walk = (dir: string): void => {
			for (const e of readdirSync(dir)) {
				const p = join(dir, e);
				const s = statSync(p);
				if (s.isDirectory()) {
					if (e === "node_modules" || e === "dist" || e === ".git") continue;
					walk(p);
				} else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx") && !p.endsWith(".stories.tsx")) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		const violations = findHardcodedJsxText(files);
		expect(
			violations,
			`Hardcoded JSX text — wrap in t() (or annotate // i18n-exempt):\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${JSON.stringify(v.text)}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
