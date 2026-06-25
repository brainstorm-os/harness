import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findIframeSrcViolations } from "../src/tools/iframe-src-check.ts";

const one = (source: string, path = "x.tsx") => findIframeSrcViolations([{ path, source }]);

describe("findIframeSrcViolations", () => {
	it('flags `<iframe src="...">` JSX (literal)', () => {
		expect(one('const A = () => <iframe src="https://example.com" />;')).toHaveLength(1);
	});

	it("flags `<iframe src={url}>` JSX (expression)", () => {
		expect(one("const A = ({u}) => <iframe src={u} />;")).toHaveLength(1);
	});

	it("flags `iframe.src = ...` assignment", () => {
		expect(
			one('const iframe = document.createElement("iframe"); iframe.src = "https://x";', "x.ts"),
		).toHaveLength(1);
	});

	it('flags `iframe.setAttribute("src", ...)`', () => {
		expect(
			one('const iframe = document.createElement("iframe"); iframe.setAttribute("src", "x");', "x.ts"),
		).toHaveLength(1);
	});

	it("does NOT flag `iframe.srcdoc = ...` (the allowed primitive)", () => {
		expect(
			one('const iframe = document.createElement("iframe"); iframe.srcdoc = "<html/>";', "x.ts"),
		).toEqual([]);
	});

	it('does NOT flag `iframe.setAttribute("srcdoc", ...)`', () => {
		expect(
			one(
				'const iframe = document.createElement("iframe"); iframe.setAttribute("srcdoc", "<html/>");',
				"x.ts",
			),
		).toEqual([]);
	});

	it('does NOT flag `iframe.removeAttribute("src")` (defensive call)', () => {
		expect(
			one('const iframe = document.createElement("iframe"); iframe.removeAttribute("src");', "x.ts"),
		).toEqual([]);
	});

	it("does NOT flag unrelated `.src` (e.g. `img.src` is image not iframe)", () => {
		expect(one('const img = new Image(); img.src = "x.png";', "x.ts")).toEqual([]);
	});

	it("does NOT flag a comment mentioning `iframe.src`", () => {
		expect(
			one("// We intentionally do NOT set iframe.src — srcdoc only.\nconst x = 1;", "x.ts"),
		).toEqual([]);
	});

	it("honours an `iframe-src-exempt` comment on or above the line", () => {
		expect(
			one(
				'// iframe-src-exempt\nconst iframe = document.createElement("iframe"); iframe.src = "x";',
				"x.ts",
			),
		).toEqual([]);
		expect(
			one('const A = () => (<>{/* iframe-src-exempt */}<iframe src="x" /></>);', "x.tsx"),
		).toEqual([]);
	});

	it("reports kind / path / 1-based line / excerpt", () => {
		const v = findIframeSrcViolations([
			{ path: "p/q.tsx", source: '\n\nconst A=()=> <iframe src="x" />;' },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3, kind: "jsx-src" });
		expect(v[0]?.excerpt).toContain("<iframe");
	});
});

// CI guard (Stage 9.5.3): every iframe in apps/* + shell renderer + sdk
// goes through the block-frame primitive (which uses `srcdoc`, not `src`).
// A new occurrence flags here, not as "the block-frame primitive's opaque-
// origin sandbox no longer applies because someone wrote iframe.src somewhere".
const KNOWN_IFRAME_SRC: Set<string> = new Set<string>();

describe("findIframeSrcViolations — integrator-pass bypass-form coverage (9.5.3)", () => {
	it('flags `iframe.setAttribute("SRC", url)` — case-insensitive matching', () => {
		const v = findIframeSrcViolations([
			{ path: "x.ts", source: 'const iframe: any = null;\niframe.setAttribute("SRC", url);' },
		]);
		expect(v).toHaveLength(1);
		expect(v[0]?.kind).toBe("setattr-src");
	});

	it('flags `iframe.setAttribute("Src", url)` — mixed-case bypass attempt', () => {
		const v = findIframeSrcViolations([
			{ path: "x.ts", source: 'const iframe: any = null;\niframe.setAttribute("Src", url);' },
		]);
		expect(v).toHaveLength(1);
		expect(v[0]?.kind).toBe("setattr-src");
	});

	it('flags `iframe["src"] = url` — ElementAccessExpression form', () => {
		const v = findIframeSrcViolations([
			{ path: "x.ts", source: 'const iframe: any = null;\niframe["src"] = url;' },
		]);
		expect(v).toHaveLength(1);
		expect(v[0]?.kind).toBe("assign-src");
	});

	it('flags `iframe["SRC"] = url` — case-insensitive ElementAccessExpression', () => {
		const v = findIframeSrcViolations([
			{ path: "x.ts", source: 'const iframe: any = null;\niframe["SRC"] = url;' },
		]);
		expect(v).toHaveLength(1);
		expect(v[0]?.kind).toBe("assign-src");
	});

	it("flags JSX spread with literal `src` field — `<iframe {...{src: url}} />`", () => {
		const v = findIframeSrcViolations([
			{ path: "x.tsx", source: 'export const E = () => <iframe {...{src: "x"}} />;' },
		]);
		expect(v.length).toBeGreaterThanOrEqual(1);
		expect(v.some((x) => x.kind === "jsx-spread-src")).toBe(true);
	});

	it("flags JSX spread with unknown identifier — `<iframe {...props} />` (conservative)", () => {
		const v = findIframeSrcViolations([
			{ path: "x.tsx", source: "export const E = (props: any) => <iframe {...props} />;" },
		]);
		expect(v.length).toBeGreaterThanOrEqual(1);
		expect(v.some((x) => x.kind === "jsx-spread-unknown")).toBe(true);
	});

	it("does NOT flag `iframe.srcdoc = url` (the allowed primitive)", () => {
		const v = findIframeSrcViolations([
			{ path: "x.ts", source: 'const iframe: any = null;\niframe["srcdoc"] = "<html/>";' },
		]);
		expect(v).toHaveLength(0);
	});

	it("honours `// iframe-src-exempt` on the spread or assignment form too", () => {
		const v = findIframeSrcViolations([
			{
				path: "x.tsx",
				source: "export const E = (props: any) =>\n\t<iframe {...props} />; // iframe-src-exempt",
			},
		]);
		expect(v).toHaveLength(0);
	});
});

describe("repo iframe surface uses srcdoc only — no `iframe.src` assignments / `<iframe src=>` JSX", () => {
	it("apps/* + shell renderer + sdk — every iframe uses srcdoc", () => {
		const roots = ["apps", "packages/shell/src", "packages/sdk/src"];
		const files: { path: string; source: string }[] = [];
		const walk = (dir: string): void => {
			for (const e of readdirSync(dir)) {
				const p = join(dir, e);
				if (statSync(p).isDirectory()) {
					if (e === "node_modules" || e === "dist" || e === ".git") continue;
					walk(p);
				} else if (
					(p.endsWith(".ts") || p.endsWith(".tsx")) &&
					!p.endsWith(".test.ts") &&
					!p.endsWith(".test.tsx") &&
					!p.endsWith(".stories.tsx")
				) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		const violations = findIframeSrcViolations(files).filter(
			(v) => !KNOWN_IFRAME_SRC.has(`${v.path}:${v.line}`),
		);
		expect(
			violations,
			`iframe.src / <iframe src=> — use srcdoc via @brainstorm/sdk/block-frame OR annotate // iframe-src-exempt with a security review note:\n${violations
				.map((v) => `  ${v.path}:${v.line}  [${v.kind}]  ${v.excerpt}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
