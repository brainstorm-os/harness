import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/repo.ts";
import { findTypeOnlyImportUsedAsValue } from "../src/tools/type-import-check.ts";

const one = (source: string) => findTypeOnlyImportUsedAsValue([{ path: "x.ts", source }]);

describe("findTypeOnlyImportUsedAsValue", () => {
	it("flags a per-specifier `import { type X }` called as a value", () => {
		const v = one('import { type Texture } from "pixi.js";\nTexture.from(img);');
		expect(v).toHaveLength(1);
		expect(v[0]?.name).toBe("Texture");
	});

	it("flags whole-clause `import type { X }` used as new / call / JSX", () => {
		expect(one('import type { Foo } from "f";\nnew Foo();')).toHaveLength(1);
		expect(one('import type { Bar } from "b";\nBar();')).toHaveLength(1);
		expect(
			findTypeOnlyImportUsedAsValue([
				{ path: "c.tsx", source: 'import type { C } from "c";\nconst a = <C />;' },
			]),
		).toHaveLength(1);
	});

	it("flags type-only default and namespace imports used as values", () => {
		expect(one('import type D from "d";\nD.run();')).toHaveLength(1);
		expect(one('import type * as N from "n";\nN.go();')).toHaveLength(1);
	});

	it("does NOT flag a correctly value-imported binding", () => {
		expect(one('import { Texture } from "pixi.js";\nTexture.from(img);')).toEqual([]);
		expect(one('import Foo from "f";\nnew Foo();')).toEqual([]);
		// mixed: only the type-only specifier is at risk
		expect(one('import { type T, real } from "m";\nreal();').length).toBe(0);
		expect(one('import { type T, real } from "m";\nT.x();')).toHaveLength(1);
	});

	it("does NOT flag a type-only import used only in type positions", () => {
		expect(one('import type { Cfg } from "c";\nlet a: Cfg;\nfunction f(x: Cfg) {}')).toEqual([]);
		expect(one('import type { E } from "e";\ntype Y = E[];')).toEqual([]);
		expect(one('import type { G } from "g";\nconst x = y as G;')).toEqual([]);
	});

	it("honours a `type-value-exempt` comment on or above the line", () => {
		expect(one('import type { Z } from "z";\nZ.use(); // type-value-exempt')).toEqual([]);
		expect(one('import type { Z } from "z";\n// type-value-exempt\nZ.use();')).toEqual([]);
	});

	it("reports path + 1-based line", () => {
		const v = findTypeOnlyImportUsedAsValue([
			{ path: "p/q.ts", source: '\nimport type { K } from "k";\nK.f();' },
		]);
		expect(v[0]).toMatchObject({ path: "p/q.ts", line: 3, name: "K" });
	});
});

// CI guard (Stage 12.9): apps/* are NOT in the workspace `tsc` and Vite
// never typechecks, so a type-only import used as a value ships silently
// and throws at runtime. A new occurrence fails here, not in a vault.
describe("repo has no type-only import used as a runtime value", () => {
	it("apps/* + shell src + sdk src are clean", () => {
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
					!p.endsWith(".d.ts") &&
					!p.endsWith(".test.ts") &&
					!p.endsWith(".test.tsx")
				) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		for (const r of roots) walk(repoPath(r));
		const violations = findTypeOnlyImportUsedAsValue(files);
		expect(
			violations,
			`Type-only import used as a runtime value — drop the \`type\` modifier (or annotate // type-value-exempt):\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${v.name}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
