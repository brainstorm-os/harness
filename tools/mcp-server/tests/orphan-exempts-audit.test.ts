import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t as shellT } from "../../../packages/shell/src/renderer/i18n/t.ts";
import { repoPath } from "../src/repo.ts";
import { type ExemptKind, findOrphanExempts } from "../src/tools/orphan-exempts-audit.ts";

const one = (source: string, path = "x.tsx") =>
	findOrphanExempts([{ path, source }], {
		tKeyIsKnown: (k: string) => shellT(k) !== `[?${k}]`,
	});

describe("findOrphanExempts — justified exempts (would-be violation present)", () => {
	it("`i18n-exempt` over a hardcoded JsxText is justified (not orphan)", () => {
		const src = "// i18n-exempt\nconst A = () => <div>Hello world</div>;";
		expect(one(src)).toEqual([]);
	});

	it("`a11y-exempt` over an icon-only <button> is justified", () => {
		const src = "// a11y-exempt\nconst A = () => <button onClick={x}><Icon/></button>;";
		expect(one(src)).toEqual([]);
	});

	it("`a11y-exempt` over an <img> missing alt is justified", () => {
		const src = '// a11y-exempt\nconst A = () => <img src="x" />;';
		expect(one(src)).toEqual([]);
	});

	it("`type-value-exempt` over a type-only import used as a value is justified", () => {
		// exempt goes directly above the USAGE line (where the violation
		// is reported), not above the import — the gate's 1-line-above
		// protection is current-or-prior line only.
		const src = 'import type { F } from "f";\n// type-value-exempt\nF.x();';
		expect(one(src, "x.ts")).toEqual([]);
	});

	it("`button-type-exempt` over a bare <button> is justified", () => {
		const src = "// button-type-exempt\nconst A = () => <button>Save</button>;";
		expect(one(src)).toEqual([]);
	});

	it("`t-key-exempt` over a real missing key is justified (when tKeyIsKnown supplied)", () => {
		const src = 'import { t } from "./i18n/t";\n// t-key-exempt\nconst a = t("non.existent.key");';
		expect(one(src, "x.ts")).toEqual([]);
	});
});

describe("findOrphanExempts — orphan exempts (no would-be violation)", () => {
	it("flags `i18n-exempt` next to a line with no JsxText", () => {
		const src = "// i18n-exempt\nconst a = 42;";
		const r = one(src);
		expect(r).toHaveLength(1);
		expect(r[0]?.kind).toBe<ExemptKind>("i18n-exempt");
	});

	it("flags `a11y-exempt` next to a line with no relevant interactive element", () => {
		const src = "// a11y-exempt\nconst x = 1;";
		const r = one(src);
		expect(r).toHaveLength(1);
		expect(r[0]?.kind).toBe<ExemptKind>("a11y-exempt");
	});

	it("flags `type-value-exempt` next to a value-imported (not type-only) binding used as a value", () => {
		const src = '// type-value-exempt\nimport { F } from "f";\nF.x();';
		const r = one(src, "x.ts");
		expect(r).toHaveLength(1);
		expect(r[0]?.kind).toBe<ExemptKind>("type-value-exempt");
	});

	it("flags `button-type-exempt` next to a `<button>` that already has type=", () => {
		const src = '// button-type-exempt\nconst A = () => <button type="button">Save</button>;';
		const r = one(src);
		expect(r).toHaveLength(1);
		expect(r[0]?.kind).toBe<ExemptKind>("button-type-exempt");
	});

	it("reports path + 1-based line + excerpt", () => {
		const src = "\n\n// i18n-exempt\nconst a = 42;";
		const r = findOrphanExempts([{ path: "p/q.tsx", source: src }], {
			tKeyIsKnown: (k: string) => shellT(k) !== `[?${k}]`,
		});
		expect(r[0]).toMatchObject({ path: "p/q.tsx", line: 3, kind: "i18n-exempt" });
		expect(r[0]?.excerpt).toContain("i18n-exempt");
	});
});

describe("findOrphanExempts — same-line exempt + violation", () => {
	it("justifies an exempt on the same line as the violation (12.13 inline-comment pattern)", () => {
		const src = "const A = () => (<><span>Hello world</span>{/* i18n-exempt */}</>);";
		// `i18n-exempt` is on the same line as the JsxText; the gate's
		// `lines[line0]` check passes, so this is justified.
		expect(one(src)).toEqual([]);
	});
});

describe("findOrphanExempts — t-key without tKeyIsKnown", () => {
	it("silently skips `t-key-exempt` when no `tKeyIsKnown` supplied (out of scope, not orphan)", () => {
		const src = '// t-key-exempt\nimport { t } from "./i18n/t";\nconst a = t("missing");';
		const r = findOrphanExempts([{ path: "x.ts", source: src }]);
		expect(r).toEqual([]);
	});
});

// Repo guard (Stage SH-32): every exempt comment in the shell renderer +
// sdk + apps source must still be justified by a would-be violation
// directly below. An orphan exempt fails here; the gate's authority
// stays current. Pre-existing orphans go into `KNOWN_ORPHAN_EXEMPTS`
// per the SH-31 / 12.11 / 12.13 snapshot pattern.
const KNOWN_ORPHAN_EXEMPTS = new Set<string>();

describe("repo has no orphan exempt comments", () => {
	it("apps/* + shell renderer + sdk — every exempt covers a real would-be violation", () => {
		const roots = ["apps", "packages/shell/src/renderer", "packages/sdk/src"];
		const files: { path: string; source: string }[] = [];
		const walk = (dir: string): void => {
			for (const e of readdirSync(dir)) {
				const p = join(dir, e);
				if (statSync(p).isDirectory()) {
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
		const tKeyIsKnown = (key: string): boolean => shellT(key) !== `[?${key}]`;
		const orphans = findOrphanExempts(files, { tKeyIsKnown }).filter(
			(o) => !KNOWN_ORPHAN_EXEMPTS.has(`${o.path}:${o.line}`),
		);
		expect(
			orphans,
			`Orphan exempt — the underlying violation is gone, remove the comment:\n${orphans
				.map((o) => `  ${o.path}:${o.line}  ${o.kind}  ${o.excerpt}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
