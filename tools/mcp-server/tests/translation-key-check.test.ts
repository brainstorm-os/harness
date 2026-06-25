import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// The live runtime is the source of truth — a key is "known" iff `t()`
// does NOT return the visible `[?…]` marker. No second manifest copy.
import { t } from "../../../packages/shell/src/renderer/i18n/t.ts";
import { repoPath } from "../src/repo.ts";
import { findUnknownTranslationKeys } from "../src/tools/translation-key-check.ts";

const KNOWN_ALL = (_k: string): boolean => true;
const KNOWN_NONE = (_k: string): boolean => false;
const KNOWN =
	(allow: string[]): ((k: string) => boolean) =>
	(k) =>
		allow.includes(k);

const one = (source: string, isKnown = KNOWN_ALL, path = "x.tsx") =>
	findUnknownTranslationKeys([{ path, source }], isKnown);

describe("findUnknownTranslationKeys", () => {
	it("flags a t('…') literal whose key the manifest does not know", () => {
		const v = one('import { t } from "./i18n/t";\nconst a = t("missing.key");', KNOWN(["other.key"]));
		expect(v).toHaveLength(1);
		expect(v[0]).toMatchObject({ key: "missing.key", fn: "t" });
	});

	it("flags a tIfKey('…') the same way", () => {
		const v = one('import { tIfKey } from "../i18n/t";\nconst a = tIfKey("nope");', KNOWN_NONE);
		expect(v[0]).toMatchObject({ key: "nope", fn: "tIfKey" });
	});

	it("does NOT flag a known key", () => {
		expect(one('import { t } from "./i18n/t";\nt("known.key");', KNOWN(["known.key"]))).toEqual([]);
	});

	it("skips dynamic / templated args — can't statically verify (same stance as 12.2)", () => {
		expect(
			one('import { t } from "./i18n/t";\nconst k = "x"; t(k); t(`tpl.${k}`);', KNOWN_NONE),
		).toEqual([]);
	});

	it("ignores an unrelated `t` identifier not imported from i18n/t", () => {
		// `t` here is shadowed/local — not the i18n function.
		expect(one('import { t } from "vitest";\nt("anything", () => {});', KNOWN_NONE)).toEqual([]);
	});

	it("honours an import rename (`{ t as tr }`)", () => {
		expect(one('import { t as tr } from "../i18n/t";\ntr("aliased.miss");', KNOWN_NONE)).toHaveLength(
			1,
		);
	});

	it("honours a `t-key-exempt` comment on or above the line", () => {
		expect(
			one('import { t } from "./i18n/t";\nt("dyn.minted"); // t-key-exempt', KNOWN_NONE),
		).toEqual([]);
		expect(
			one('import { t } from "./i18n/t";\n// t-key-exempt\nt("dyn.minted");', KNOWN_NONE),
		).toEqual([]);
	});

	it("reports path + 1-based line + key", () => {
		const v = findUnknownTranslationKeys(
			[
				{
					path: "p/q.tsx",
					source: '\nimport { t } from "../i18n/t";\nt("p.miss");',
				},
			],
			KNOWN_NONE,
		);
		expect(v[0]).toMatchObject({ path: "p/q.tsx", line: 3, key: "p.miss" });
	});
});

// CI guard (Stage 12.10): every static `t("…")` / `tIfKey("…")` in the
// shell renderer must resolve to a real manifest entry; an unknown key
// silently ships `[?…]` to users (renderer/i18n/t.ts). A new occurrence
// fails here, not in a vault.
describe("shell renderer has no unknown translation keys", () => {
	it("every literal t()/tIfKey key resolves through the live manifest", () => {
		const root = repoPath("packages/shell/src/renderer");
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
					!p.endsWith(".test.tsx") &&
					!p.endsWith(".stories.tsx")
				) {
					files.push({ path: p, source: readFileSync(p, "utf8") });
				}
			}
		};
		walk(root);
		const isKnown = (key: string): boolean => t(key) !== `[?${key}]`;
		const violations = findUnknownTranslationKeys(files, isKnown);
		expect(
			violations,
			`Unknown t() / tIfKey() key — add it to packages/shell/src/renderer/i18n/t.ts (or annotate // t-key-exempt):\n${violations
				.map((v) => `  ${v.path}:${v.line}  ${v.fn}(${JSON.stringify(v.key)})`)
				.join("\n")}`,
		).toEqual([]);
	});
});
