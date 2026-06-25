import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePlan, stageBaseNumber } from "../src/parse-plan.ts";
import { repoPath } from "../src/repo.ts";
import { IterationStatus } from "../src/types.ts";

const planSource = readFileSync(repoPath("docs/implementation-plan.md"), "utf8");

// The plan was re-implemented by domain (2026-05-18): `# Infrastructure |
// Shell | Apps` → `## <Section> *(Stage N)*` → terse `- <icon> <id> —`
// bullets. These assert the projector against THAT structure (the legacy
// `### Stage N — Title` / `**Goal/Iterations/Exit**` blocks are gone; the
// per-iteration narrative moved to implementation-log.md).
describe("parsePlan", () => {
	const plan = parsePlan(planSource);

	it("emits one status-snapshot row per stage-tagged section", () => {
		expect(plan.statusSnapshot.length).toBeGreaterThan(10);
		expect(plan.statusSnapshot.some((r) => r.stageId === "0")).toBe(true);
		const monorepo = plan.statusSnapshot.find((r) => r.stageId === "1");
		expect(monorepo?.title).toMatch(/Monorepo/);
	});

	it("disambiguates lettered stage ids from the `*(Stage Nx)*` spec", () => {
		const ids = plan.statusSnapshot.map((r) => r.stageId);
		expect(ids).toContain("5b");
		expect(ids).toContain("7a");
		expect(ids).toContain("7b");
		expect(ids).toContain("11b");
	});

	it("aggregates sections sharing a primary stage and reads bullet status from the icon", () => {
		const stage0 = plan.stages.find((s) => s.stageId === "0");
		expect(stage0).toBeDefined();
		// `- ✅ 0.1–0.10 + 0.10.1 — …` → lead id 0.1, done.
		expect(stage0?.iterations.find((i) => i.id === "0.1")?.status).toBe(IterationStatus.Done);
		// `- ✅ 0.11 — …` (since 2026-05-20) → done.
		expect(stage0?.iterations.find((i) => i.id === "0.11")?.status).toBe(IterationStatus.Done);
		// `- ✅ 0.12 — …` landed 2026-05-25 (dev-MCP write tools). Was
		// pending — flipped in-place when the iteration shipped.
		expect(stage0?.iterations.find((i) => i.id === "0.12")?.status).toBe(IterationStatus.Done);
		// SH-/B-/VP- codes are first-class iteration ids.
		expect(stage0?.iterations.some((i) => i.id.startsWith("SH-"))).toBe(true);
	});

	it("rolls the whole Stage 9 platform-half + every per-app section into one stage", () => {
		const stage9 = plan.stages.find((s) => s.stageId === "9");
		expect(stage9).toBeDefined();
		const ids = stage9?.iterations.map((i) => i.id) ?? [];
		expect(ids).toContain("9.1"); // platform half
		expect(ids).toContain("9.13.1"); // Graph app section
	});

	it("scopes an iteration's `app` to its section only under the # Apps domain", () => {
		const stage9 = plan.stages.find((s) => s.stageId === "9");
		const notesIter = stage9?.iterations.find((i) => i.app?.includes("Notes"));
		expect(notesIter).toBeDefined();
		expect(notesIter?.app).toMatch(/Notes/);
		// The platform-half lives under # Infrastructure → no app scope.
		expect(stage9?.iterations.find((i) => i.id === "9.1")?.app).toBeNull();
		// The bullet's lead-id line is the body; the section spec/icon is not.
		expect(notesIter?.body).not.toContain("*(");
	});

	it("leaves app null for non-Apps domains", () => {
		const stage1 = plan.stages.find((s) => s.stageId === "1");
		expect(stage1?.iterations.length).toBeGreaterThan(0);
		expect(stage1?.iterations.every((i) => i.app === null)).toBe(true);
		expect(stage1?.ownerDomain).toBe("Infrastructure");
	});

	it("captures the optional `Goal:` line and the owning domain", () => {
		const stage0 = plan.stages.find((s) => s.stageId === "0");
		expect(stage0?.goal).toContain("brainstorm-dev");
		expect(stage0?.ownerDomain).toBe("Infrastructure");
	});

	it("exitCriteria is empty — that data moved to implementation-log.md", () => {
		const stage0 = plan.stages.find((s) => s.stageId === "0");
		expect(stage0?.exitCriteria).toEqual([]);
	});

	it("is deterministic — parsing the same input twice yields the same JSON", () => {
		expect(JSON.stringify(parsePlan(planSource))).toBe(JSON.stringify(parsePlan(planSource)));
	});

	it("infers stage status from the heading marker or its bullets", () => {
		// `## Monorepo … *(Stage 1)*` has no marker; its only bullet is ✅.
		expect(plan.stages.find((s) => s.stageId === "1")?.status).toBe(IterationStatus.Done);
		// `## Agent app *(group I, Stage 11c)* — 🟡` with Agent-1 ✅ shipped and the
		// rest pending → partial (heading marker + bullets agree it's in flight).
		expect(plan.stages.find((s) => s.stageId === "11c")?.status).toBe(IterationStatus.Partial);
	});
});

describe("stageBaseNumber", () => {
	it("strips trailing letters", () => {
		expect(stageBaseNumber("5b")).toBe(5);
		expect(stageBaseNumber("7a")).toBe(7);
		expect(stageBaseNumber("11")).toBe(11);
	});

	it("returns null for non-numeric input", () => {
		expect(stageBaseNumber("xyz")).toBeNull();
	});
});

describe("parsePlan property: round-trip stability across mutations", () => {
	it("ignores comments, blank lines, and surrounding prose", () => {
		const rng = mulberry32(0xc0ffee);
		for (let i = 0; i < 50; i++) {
			const parsed = parsePlan(sprinkleNoise(planSource, rng));
			expect(parsed.stages.length).toBeGreaterThan(10);
			const stage0 = parsed.stages.find((s) => s.stageId === "0");
			expect(stage0?.iterations.find((it) => it.id === "0.1")?.status).toBe(IterationStatus.Done);
		}
	});
});

function mulberry32(seed: number) {
	let state = seed >>> 0;
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function sprinkleNoise(src: string, rng: () => number): string {
	const lines = src.split("\n");
	const out: string[] = [];
	for (const line of lines) {
		if (rng() < 0.05) out.push("");
		if (rng() < 0.02) out.push("<!-- random comment -->");
		out.push(line);
	}
	return out.join("\n");
}
