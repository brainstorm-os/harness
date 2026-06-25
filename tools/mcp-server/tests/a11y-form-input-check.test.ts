import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findUnlabeledFormInputs } from "../src/tools/a11y-form-input-check.ts";

const one = (source: string, path = "x.tsx") => findUnlabeledFormInputs([{ path, source }]);

describe("findUnlabeledFormInputs", () => {
	it("flags a bare <input>/<textarea>/<select> with no labeling attr", () => {
		expect(one('const A = () => <input type="text" />;')).toHaveLength(1);
		expect(one("const A = () => <textarea />;")).toHaveLength(1);
		expect(one("const A = () => <select><option>x</option></select>;")).toHaveLength(1);
	});

	it("reports the tag name on the violation", () => {
		const v = one("const A = () => <textarea />;");
		expect(v[0]?.tag).toBe("textarea");
	});

	it("passes with `aria-label` / `aria-labelledby` / `title` / `placeholder` (literal or expression)", () => {
		expect(one('const A = () => <input aria-label="Name" />;')).toEqual([]);
		expect(one("const A = ({l}) => <input aria-label={l} />;")).toEqual([]);
		expect(one('const A = () => <input aria-labelledby="hdr" />;')).toEqual([]);
		expect(one('const A = () => <input title="Name" />;')).toEqual([]);
		expect(one('const A = () => <input placeholder="Search…" />;')).toEqual([]);
		expect(one('const A = () => <input placeholder={t("search")} />;')).toEqual([]);
	});

	it("rejects empty / whitespace-only labeling attrs", () => {
		expect(one('const A = () => <input aria-label="" placeholder="" />;')).toHaveLength(1);
		expect(one('const A = () => <input aria-label="   " />;')).toHaveLength(1);
	});

	it("passes when wrapped in a `<label>` element (implicit association)", () => {
		expect(one('const A = () => (<label>Name<input type="text" /></label>);')).toEqual([]);
		// nested deeper inside the label still associates
		expect(
			one('const A = () => (<label><span>Name</span><div><input type="text" /></div></label>);'),
		).toEqual([]);
	});

	it("skips `<input>` whose type doesn't need labeling here", () => {
		expect(one('const A = () => <input type="hidden" />;')).toEqual([]);
		expect(one('const A = () => <input type="submit" value="Go" />;')).toEqual([]);
		expect(one('const A = () => <input type="button" value="Go" />;')).toEqual([]);
		expect(one('const A = () => <input type="reset" />;')).toEqual([]);
	});

	it("does NOT flag uppercase component shapes (<Input>/<Textarea>/<Select>)", () => {
		expect(one('const A = () => <Input type="text" />;')).toEqual([]);
		expect(one("const A = () => <Textarea />;")).toEqual([]);
		expect(one("const A = () => <Select />;")).toEqual([]);
	});

	it("honours an `a11y-exempt` comment on or above the line", () => {
		expect(one('// a11y-exempt\nconst A = () => <input type="text" />;')).toEqual([]);
		expect(one('const A = () => (<>{/* a11y-exempt */}<input type="text" /></>);')).toEqual([]);
	});

	it("reports path + 1-based line + excerpt", () => {
		const v = findUnlabeledFormInputs([
			{ path: "p/q.tsx", source: '\n\nconst A=()=> <input type="text" />;' },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3, tag: "input" });
		expect(v[0]?.excerpt).toContain("<input");
	});

	it("ignores non-.tsx files", () => {
		expect(one('const A = "<input />";', "x.ts")).toEqual([]);
	});
});

// CI guard (Stage 12.13): every form input in the shell renderer + sdk +
// apps UI must carry an accessible name. A new occurrence fails here.
const KNOWN_UNLABELED_INPUTS = new Set<string>();

describe("repo UI surface has no unlabeled form inputs", () => {
	it("apps/* + shell renderer + sdk .tsx — every <input>/<textarea>/<select> is labeled", () => {
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
		const violations = findUnlabeledFormInputs(files).filter(
			(v) => !KNOWN_UNLABELED_INPUTS.has(`${v.path}:${v.line}`),
		);
		expect(
			violations,
			`Unlabeled form input — add aria-label / aria-labelledby / title / placeholder / wrap in <label>:\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${v.tag}  ${v.excerpt}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
