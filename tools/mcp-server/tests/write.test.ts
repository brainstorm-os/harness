import { describe, expect, it } from "vitest";
import { parseOpenQuestions } from "../src/parse-oqs.ts";
import { parsePlan } from "../src/parse-plan.ts";
import { applyIterationUpdate, applyOQResolution, statusIcon } from "../src/tools/write.ts";
import { IterationStatus, OQStatus } from "../src/types.ts";

// Post-restructure grammar: status is the bullet's leading icon.
const PLAN_FIXTURE = `# Implementation plan

## Status snapshot

| Domain | State |
|--------|-------|
| Infrastructure | partial |

# Infrastructure

## Foundations *(Stage 0)*

- ⚪ 0.10 — repo scaffold at \`tools/mcp-server/\` (TypeScript, runs under Bun).
- 🟡 0.11 — audit / capability / keyboard tools land.
- ⚪ 0.12 — Write tools land.
`;

const STATUS_ICON_RE = /[✅🟡◑⚪❌]/gu;

describe("applyIterationUpdate", () => {
	it("flips the bullet's leading icon to ✅ when status is done", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.10",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		expect(result.changed).toBe(true);
		expect(result.after).toBe(
			"- ✅ 0.10 — repo scaffold at `tools/mcp-server/` (TypeScript, runs under Bun).",
		);
	});

	it("replaces the existing status icon instead of stacking them", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.11",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		expect(result.changed).toBe(true);
		const icons = (result.after ?? "").match(STATUS_ICON_RE) ?? [];
		expect(icons).toEqual(["✅"]); // exactly one, and it's done — no leftover 🟡
	});

	it("returns changed=false and metadata when the id is not found", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "9.99.99",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		expect(result.changed).toBe(false);
		expect(result.before).toBeNull();
		expect(result.source).toBe(PLAN_FIXTURE);
	});

	it("matches the lead code exactly — 0.1 does not hit 0.10", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.1",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		expect(result.changed).toBe(false);
	});

	it("appends a note as an `**Update <date>:** <note>` segment when provided", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.10",
			status: IterationStatus.Done,
			today: "2026-05-14",
			note: "MCP server scaffolded — see SH-1.",
		});
		expect(result.after).toContain("**Update 2026-05-14:** MCP server scaffolded — see SH-1.");
		expect(result.after?.startsWith("- ✅ 0.10 —")).toBe(true);
	});

	it("rewrites an in-flight bullet to pending", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.11",
			status: IterationStatus.Pending,
			today: "2026-05-14",
		});
		const icons = (result.after ?? "").match(STATUS_ICON_RE) ?? [];
		expect(icons).toEqual(["⚪"]);
		expect(result.after).not.toContain("🟡");
	});

	it("round-trip: the re-parsed plan reflects the new iteration status", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.10",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		const reparsed = parsePlan(result.source);
		const iter = reparsed.stages.flatMap((s) => s.iterations).find((i) => i.id === "0.10");
		expect(iter?.status).toBe(IterationStatus.Done);
	});

	it("is idempotent — applying the same update twice produces the same source", () => {
		const first = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.10",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		const second = applyIterationUpdate(first.source, {
			id: "0.10",
			status: IterationStatus.Done,
			today: "2026-05-14",
		});
		expect(second.source).toBe(first.source);
		expect(second.changed).toBe(false);
	});
});

describe("applyIterationUpdate — PreviewDrop (◑)", () => {
	it("flips a pending ⚪ bullet to ◑ when target is PreviewDrop", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.10",
			status: IterationStatus.PreviewDrop,
			today: "2026-05-25",
		});
		expect(result.changed).toBe(true);
		expect(result.after?.startsWith("- ◑ 0.10 —")).toBe(true);
		const icons = (result.after ?? "").match(STATUS_ICON_RE) ?? [];
		expect(icons).toEqual(["◑"]);
	});

	it("flips an in-flight 🟡 bullet to ◑ when target is PreviewDrop", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.11",
			status: IterationStatus.PreviewDrop,
			today: "2026-05-25",
		});
		expect(result.changed).toBe(true);
		const icons = (result.after ?? "").match(STATUS_ICON_RE) ?? [];
		expect(icons).toEqual(["◑"]);
		expect(result.after).not.toContain("🟡");
	});

	it("round-trip: parsePlan reports the flipped bullet as PreviewDrop", () => {
		const result = applyIterationUpdate(PLAN_FIXTURE, {
			id: "0.10",
			status: IterationStatus.PreviewDrop,
			today: "2026-05-25",
		});
		const reparsed = parsePlan(result.source);
		const iter = reparsed.stages.flatMap((s) => s.iterations).find((i) => i.id === "0.10");
		expect(iter?.status).toBe(IterationStatus.PreviewDrop);
	});

	it("statusIcon(PreviewDrop) returns the ◑ glyph", () => {
		expect(statusIcon(IterationStatus.PreviewDrop)).toBe("◑");
	});
});

const OQ_FIXTURE = `# 11 — Open questions

## General — \`OQ-1\` … \`OQ-3\`

#### OQ-1 — Should we use TypeScript?

- **Where:** Stage 1
- **Question:** Pick a language.

---

#### OQ-2 — What database engine?

- **Where:** Stage 3
- **Question:** SQLite vs Postgres.

---

#### OQ-3 — Already resolved? *[RESOLVED in implementation-plan Stage 2]*

- **Where:** Stage 2
- **Resolution:** Picked the third option.

---
`;

describe("applyOQResolution", () => {
	it("appends the *[RESOLVED]* tag to the heading", () => {
		const result = applyOQResolution(OQ_FIXTURE, {
			id: "OQ-1",
			stage: "1",
			resolution: "Picked TypeScript with strict mode.",
		});
		expect(result.changed).toBe(true);
		expect(result.headingAfter).toContain("*[RESOLVED in implementation-plan Stage 1]*");
		expect(result.source).toContain("- **Resolution:** Picked TypeScript with strict mode.");
	});

	it("inserts the Resolution bullet before the next `---` separator", () => {
		const result = applyOQResolution(OQ_FIXTURE, {
			id: "OQ-2",
			stage: "3",
			resolution: "Picked SQLite for v1.",
		});
		const lines = result.source.split("\n");
		const headingIdx = lines.findIndex((l) => l.startsWith("#### OQ-2"));
		const resolutionIdx = lines.findIndex(
			(l, idx) => idx > headingIdx && l.includes("**Resolution:** Picked SQLite"),
		);
		const nextSeparator = lines.findIndex((l, idx) => idx > headingIdx && l.startsWith("---"));
		expect(resolutionIdx).toBeGreaterThan(headingIdx);
		expect(resolutionIdx).toBeLessThan(nextSeparator);
	});

	it("is a no-op when the OQ is already marked resolved", () => {
		const result = applyOQResolution(OQ_FIXTURE, {
			id: "OQ-3",
			stage: "2",
			resolution: "Already done.",
		});
		expect(result.changed).toBe(false);
	});

	it("returns changed=false + null metadata when the id is not found", () => {
		const result = applyOQResolution(OQ_FIXTURE, {
			id: "OQ-99",
			stage: "9",
			resolution: "nothing.",
		});
		expect(result.changed).toBe(false);
		expect(result.headingBefore).toBeNull();
		expect(result.source).toBe(OQ_FIXTURE);
	});

	it("round-trip: the re-parsed OQ ledger reports the new status as resolved", () => {
		const result = applyOQResolution(OQ_FIXTURE, {
			id: "OQ-1",
			stage: "1",
			resolution: "TypeScript, strict mode.",
		});
		const reparsed = parseOpenQuestions(result.source);
		const oq = reparsed.questions.find((q) => q.id === "OQ-1");
		expect(oq?.status).toBe(OQStatus.Resolved);
		expect(oq?.resolutionRef).toContain("Stage 1");
	});

	it("is idempotent — applying the same resolution twice produces the same source", () => {
		const first = applyOQResolution(OQ_FIXTURE, {
			id: "OQ-1",
			stage: "1",
			resolution: "TypeScript.",
		});
		const second = applyOQResolution(first.source, {
			id: "OQ-1",
			stage: "1",
			resolution: "TypeScript.",
		});
		expect(second.source).toBe(first.source);
		expect(second.changed).toBe(false);
	});
});
