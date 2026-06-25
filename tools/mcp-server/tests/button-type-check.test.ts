import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findButtonsMissingType } from "../src/tools/button-type-check.ts";

const one = (source: string, path = "x.tsx") => findButtonsMissingType([{ path, source }]);

describe("findButtonsMissingType", () => {
	it("flags a `<button>` with no type attribute (the React-in-form footgun)", () => {
		expect(one("const A = () => <button onClick={x}>Save</button>;")).toHaveLength(1);
		expect(one("const A = () => <button />;")).toHaveLength(1);
	});

	it('passes with `type="button"` / `type="submit"` / `type="reset"`', () => {
		expect(one('const A = () => <button type="button">Save</button>;')).toEqual([]);
		expect(one('const A = () => <button type="submit">Save</button>;')).toEqual([]);
		expect(one('const A = () => <button type="reset">Reset</button>;')).toEqual([]);
	});

	it("passes with an expression `type={…}` (intent counts; dynamic stance from 12.2)", () => {
		expect(one("const A = ({t}) => <button type={t}>Save</button>;")).toEqual([]);
	});

	it("does NOT flag `<Button>` (uppercase component owns its own contract)", () => {
		expect(one("const A = () => <Button onClick={x}>Save</Button>;")).toEqual([]);
		expect(one("const A = () => <Button />;")).toEqual([]);
	});

	it("honours a `button-type-exempt` comment on or above the line", () => {
		expect(one("// button-type-exempt\nconst A = () => <button>Save</button>;")).toEqual([]);
		expect(one("const A = () => (<>{/* button-type-exempt */}<button>Save</button></>);")).toEqual(
			[],
		);
	});

	it("reports path + 1-based line + excerpt", () => {
		const v = findButtonsMissingType([
			{ path: "p/q.tsx", source: "\n\nconst A=()=> <button>Save</button>;" },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3 });
		expect(v[0]?.excerpt).toContain("<button");
	});

	it("ignores non-.tsx files", () => {
		expect(one('const A = "<button />";', "x.ts")).toEqual([]);
	});
});

// CI guard (Stage 12.14): every `<button>` in the shell renderer + sdk +
// apps UI must declare its `type` (`button` / `submit` / `reset`). A new
// occurrence fails here, not as "clicking save triggers an extra
// navigation" in a vault.
const KNOWN_NO_TYPE = new Set<string>();

describe("repo UI surface has no `<button>` missing `type=`", () => {
	it("apps/* + shell renderer + sdk .tsx — every <button> declares type", () => {
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
		const violations = findButtonsMissingType(files).filter(
			(v) => !KNOWN_NO_TYPE.has(`${v.path}:${v.line}`),
		);
		expect(
			violations,
			`<button> without explicit type — add type="button" / "submit" / "reset":\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${v.excerpt}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
