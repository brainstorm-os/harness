/**
 * Structural gate — a plan bullet may not lead with a status icon outside the
 * Legend (`✅ 🟡 ◑ ⚪ ❌`).
 *
 * `BULLET_RE` skips an unrecognised icon SILENTLY, so the iteration disappears
 * from every projection — the vault's Tasks app, the at-a-glance table, the
 * stage rollups — with nothing logged. Two bullets did exactly that with `⛔`
 * (`8.T` from 2026-05-23, `LAN-4b` from 2026-07-26); the owner noticed as "no
 * new tasks appear and old tasks are not being closed".
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findUnknownStatusIcons } from "../src/parse-plan";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

describe("findUnknownStatusIcons", () => {
	it("flags a bullet leading with a non-Legend icon", () => {
		const found = findUnknownStatusIcons(
			["- ⛔ LAN-4b — blocked on a dep", "- ✅ LAN-3 — done"].join("\n"),
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.icon).toBe("⛔");
		expect(found[0]?.line).toBe(1);
	});

	it("accepts every Legend icon", () => {
		const plan = ["- ✅ a.1 — x", "- 🟡 a.2 — x", "- ◑ a.3 — x", "- ⚪ a.4 — x", "- ❌ a.5 — x"].join(
			"\n",
		);
		expect(findUnknownStatusIcons(plan)).toEqual([]);
	});

	it("leaves ordinary prose bullets alone", () => {
		// Only a glyph exactly where the status icon belongs counts; a bullet that
		// merely starts with a word (or mentions an emoji later) is not a status line.
		const plan = ["- plain prose bullet", "- **bold** lead", "- see the ⛔ sign in the copy"].join(
			"\n",
		);
		expect(findUnknownStatusIcons(plan)).toEqual([]);
	});

	it("the LIVE plan has none", () => {
		const src = readFileSync(join(repoRoot, "docs/implementation-plan.md"), "utf8");
		const found = findUnknownStatusIcons(src);
		expect(
			found.map((f) => `line ${f.line}: ${f.icon} ${f.text}`),
			"a bullet with a non-Legend icon is invisible to every projection — use ✅ 🟡 ◑ ⚪ ❌",
		).toEqual([]);
	});
});
