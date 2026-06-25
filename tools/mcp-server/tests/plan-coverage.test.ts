import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findUncoveredPlanBullets } from "../src/plan-coverage.ts";

const PLAN_PATH = join(import.meta.dirname, "../../../docs/implementation-plan.md");

describe("plan-coverage no-drop guard", () => {
	it("the live implementation-plan.md drops no id-shaped bullet", () => {
		const source = readFileSync(PLAN_PATH, "utf8");
		const uncovered = findUncoveredPlanBullets(source);
		// A non-empty list means a `##`/`###` section's bullets were silently
		// dropped — a missing stage token, an `##` heading the parser skipped,
		// or an iteration-id prefix absent from LEAD_ID_RE. Surface the exact
		// lines so the fix is obvious.
		expect(
			uncovered,
			`silently-dropped plan bullets:\n${uncovered
				.map((u) => `  L${u.line}: ${u.id} — ${u.text}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("flags a stage-less section's bullets as uncovered", () => {
		const source = [
			"# Shell",
			"## Some new track *(no stage spec — just a link [x](y))*",
			"- ⚪ Newtrack-1 — a bullet under a section the parser would skip.",
		].join("\n");
		const uncovered = findUncoveredPlanBullets(source);
		expect(uncovered.map((u) => u.id)).toContain("Newtrack-1");
	});

	it("flags a numeric id under a non-domain heading with no spec", () => {
		const source = ["## Orphan section", "- ⚪ 99.1 — orphan numeric bullet."].join("\n");
		// Captured (sections always open now), so this is actually covered —
		// assert the guard does NOT false-positive on a captured bullet.
		expect(findUncoveredPlanBullets(source)).toEqual([]);
	});
});
