import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findUnnamedButtons } from "../src/tools/a11y-button-name-check.ts";

const one = (source: string, path = "x.tsx") => findUnnamedButtons([{ path, source }]);

describe("findUnnamedButtons", () => {
	it("flags an empty <button/> with no label attributes", () => {
		expect(one("const A = () => <button />;")).toHaveLength(1);
		expect(one("const A = () => <button></button>;")).toHaveLength(1);
	});

	it("flags an icon-only button (only an element child, no text, no aria)", () => {
		expect(one("const A = () => <button onClick={x}><CloseIcon /></button>;")).toHaveLength(1);
	});

	it("passes with `aria-label` (literal OR expression — intent counts)", () => {
		expect(one('const A = () => <button aria-label="Close"><CloseIcon /></button>;')).toEqual([]);
		expect(one('const A = () => <button aria-label={t("close")}><X/></button>;')).toEqual([]);
	});

	it("passes with `aria-labelledby` / `title`", () => {
		expect(one('const A = () => <button aria-labelledby="hdr"><X/></button>;')).toEqual([]);
		expect(one('const A = () => <button title="Close"><X/></button>;')).toEqual([]);
	});

	it("rejects an empty / whitespace-only label string", () => {
		expect(one('const A = () => <button aria-label=""><X/></button>;')).toHaveLength(1);
		expect(one('const A = () => <button aria-label="   "><X/></button>;')).toHaveLength(1);
	});

	it("passes with text-bearing JSX content (direct or nested)", () => {
		expect(one("const A = () => <button>Save</button>;")).toEqual([]);
		expect(one("const A = () => <button><span>Save</span></button>;")).toEqual([]);
		expect(one('const A = () => <button>{"Save"}</button>;')).toEqual([]);
	});

	it("passes with a `t(…)` / `tIfKey(…)` call (any module — call shape is the intent)", () => {
		expect(one('const A = () => <button>{t("save")}</button>;')).toEqual([]);
		expect(one('const A = () => <button>{tIfKey("save")}</button>;')).toEqual([]);
	});

	it("passes with an opaque `{variable}` child (conservative — same stance as 12.2)", () => {
		expect(one("const A = ({label}) => <button>{label}</button>;")).toEqual([]);
	});

	it("passes when a child element carries the accessible name", () => {
		expect(one('const A = () => <button><Icon aria-label="Close" /></button>;')).toEqual([]);
	});

	it("does NOT flag `<Button>` (uppercase — a component owns its own a11y contract)", () => {
		expect(one("const A = () => <Button />;")).toEqual([]);
		expect(one("const A = () => <Button onClick={x}><Icon/></Button>;")).toEqual([]);
	});

	it("honours an `a11y-exempt` comment on or above the line", () => {
		expect(one("// a11y-exempt\nconst A = () => <button />;")).toEqual([]);
		expect(one("const A = () => (<>{/* a11y-exempt */}<button /></>);")).toEqual([]);
	});

	it("reports path + 1-based line + line excerpt", () => {
		const v = findUnnamedButtons([{ path: "p/q.tsx", source: "\n\nconst A=()=> <button />;" }]);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3 });
		expect(v[0]?.excerpt).toContain("<button");
	});

	it("ignores non-.tsx files (the guard's surface is JSX)", () => {
		expect(one("const A = '<button />';", "x.ts")).toEqual([]);
	});
});

// CI guard (Stage 12.11): every `<button>` shipping in the shell renderer
// + sdk + apps UI must carry an accessible name (literal text, aria-label,
// aria-labelledby, title, or a labelled child). A new occurrence fails
// here, not in a vault. Pre-existing violations are snapshotted into
// `KNOWN_UNLABELED` so the gate locks today's state and only flags
// regressions; each entry is a TODO to drive to zero before beta.
const KNOWN_UNLABELED = new Set<string>();

describe("repo UI surface has no unlabeled buttons", () => {
	it("apps/* + shell renderer + sdk .tsx — every <button> has an accessible name", () => {
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
		const violations = findUnnamedButtons(files).filter(
			(v) => !KNOWN_UNLABELED.has(`${v.path}:${v.line}`),
		);
		expect(
			violations,
			`Unlabeled <button> — add an accessible name (aria-label / text content) or annotate // a11y-exempt:\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${v.excerpt}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
