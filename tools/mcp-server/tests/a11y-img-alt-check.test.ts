import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findImagesMissingAlt } from "../src/tools/a11y-img-alt-check.ts";

const one = (source: string, path = "x.tsx") => findImagesMissingAlt([{ path, source }]);

describe("findImagesMissingAlt", () => {
	it("flags a self-closing <img> with no alt attribute", () => {
		expect(one('const A = () => <img src="x.png" />;')).toHaveLength(1);
	});

	it('passes with `alt=""` — the correct decorative signal', () => {
		expect(one('const A = () => <img src="x.png" alt="" />;')).toEqual([]);
	});

	it("passes with a non-empty literal alt", () => {
		expect(one('const A = () => <img src="x.png" alt="logo" />;')).toEqual([]);
	});

	it("passes with an expression alt (opaque but intent counts)", () => {
		expect(one("const A = ({a}) => <img src={x} alt={a} />;")).toEqual([]);
		expect(one('const A = () => <img src={x} alt={t("foo")} />;')).toEqual([]);
	});

	it("treats `<img>…</img>` (legal but rare) identically — opening attrs count", () => {
		expect(one('const A = () => <img src="x.png"></img>;')).toHaveLength(1);
		expect(one('const A = () => <img src="x.png" alt="x"></img>;')).toEqual([]);
	});

	it("does NOT flag `<Img>` (uppercase component owns its own a11y)", () => {
		expect(one('const A = () => <Img src="x.png" />;')).toEqual([]);
	});

	it("honours an `a11y-exempt` comment on or above the line", () => {
		expect(one('// a11y-exempt\nconst A = () => <img src="x" />;')).toEqual([]);
		expect(one('const A = () => (<>{/* a11y-exempt */}<img src="x" /></>);')).toEqual([]);
	});

	it("reports path + 1-based line + excerpt", () => {
		const v = findImagesMissingAlt([
			{ path: "p/q.tsx", source: '\n\nconst A=()=> <img src="x" />;' },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3 });
		expect(v[0]?.excerpt).toContain("<img");
	});

	it("ignores non-.tsx files", () => {
		expect(one("const A = \"<img src='x' />\";", "x.ts")).toEqual([]);
	});
});

// CI guard (Stage 12.12): every `<img>` in the shell renderer + sdk +
// apps UI must carry an `alt` attribute (`alt=""` for decorative is
// fine — the *signal* matters, not the value). A new occurrence fails
// here. Pre-existing violations snapshot into `KNOWN_NO_ALT` per the
// SH-31 / 12.11 pattern.
const KNOWN_NO_ALT = new Set<string>();

describe("repo UI surface has no <img> missing alt", () => {
	it("apps/* + shell renderer + sdk .tsx — every <img> carries an alt attribute", () => {
		const roots = ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
		const files: { path: string; source: string }[] = [];
		const walk = (dir: string): void => {
			for (const e of readdirSync(dir)) {
				const p = join(dir, e);
				if (statSync(p).isDirectory()) {
					if (e === "node_modules" || e === "dist" || e === ".git") continue;
					walk(p);
				} else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx") && !p.endsWith(".stories.tsx")) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		const violations = findImagesMissingAlt(files).filter(
			(v) => !KNOWN_NO_ALT.has(`${v.path}:${v.line}`),
		);
		expect(
			violations,
			`<img> without alt — add an alt attribute (\`alt=""\` for decorative is fine) or annotate // a11y-exempt:\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${v.excerpt}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
