import { describe, expect, it } from "vitest";
import {
	buildBrainstormProjectEntities,
	parseDocPath,
	stripStatusPrefix,
} from "../src/seed/brainstorm-project.ts";

// Post-restructure plan grammar: `# Domain` → `## Section *(Stage N)*`
// → terse `- <icon> <id> — <task>` bullets, optional `Goal:` line.
const PLAN_FIXTURE = `# Implementation plan

## Status snapshot

| Domain | State |
|--------|-------|
| Infrastructure | mixed |

# Infrastructure

## Foundations & dev tooling *(Stage 0)*

Goal: Foundation cleanup.

- ✅ 0.10 — MCP server scaffolded.
- ⚪ 0.11 — Write tools land.

# Apps

## Notes (text-editor) *(Stage 9)*

- 🟡 9.6 — Notes app — heavy progress.
- ⚪ 9.7 — Code-editor app.
- ✅ 9.14.1.5 — Tasks preview drop.
`;

const OQ_FIXTURE = `# 11 — Open questions

## General — \`OQ-1\` … \`OQ-3\`

#### OQ-1 — TypeScript or JavaScript? *[RESOLVED in implementation-plan Stage 0]*

- **Where:** Stage 0
- **Resolution:** Picked TypeScript.

---

#### OQ-2 — Which database engine?

- **Where:** Stage 3
- **Question:** SQLite vs Postgres.

---

#### OQ-3 — Code-editor pick? *[RESOLVED in implementation-plan Stage 9.7]*

- **Where:** Stage 9
- **Resolution:** Shiki + brainstorm-editor.

---
`;

describe("buildBrainstormProjectEntities", () => {
	const built = buildBrainstormProjectEntities({
		planSource: PLAN_FIXTURE,
		oqSource: OQ_FIXTURE,
		now: Date.UTC(2026, 4, 14),
	});

	it("emits one iteration per plan iteration entry", () => {
		expect(built.iterations.map((i) => i.code).sort()).toEqual([
			"0.10",
			"0.11",
			"9.14.1.5",
			"9.6",
			"9.7",
		]);
	});

	it("maps the parser's IterationStatus to the wire status strings", () => {
		const i10 = built.iterations.find((i) => i.code === "0.10");
		expect(i10?.status).toBe("done");
		const i11 = built.iterations.find((i) => i.code === "0.11");
		expect(i11?.status).toBe("pending");
		const i96 = built.iterations.find((i) => i.code === "9.6");
		expect(i96?.status).toBe("partial");
	});

	it("sets completedAt on done iterations only", () => {
		const i10 = built.iterations.find((i) => i.code === "0.10");
		expect(i10?.completedAt).not.toBeNull();
		const i11 = built.iterations.find((i) => i.code === "0.11");
		expect(i11?.completedAt).toBeNull();
	});

	it("emits one stage entity per parsed stage and lists its iteration codes in order", () => {
		expect(built.stages.map((s) => s.stageId)).toEqual(["0", "9"]);
		const stage0 = built.stages.find((s) => s.stageId === "0");
		expect(stage0?.iterationCodes).toEqual(["0.10", "0.11"]);
		// Exit criteria were dropped in the restructure (the data moved to
		// implementation-log.md); the projector no longer fabricates them.
		expect(stage0?.exitCriteria).toEqual([]);
	});

	it("propagates stage goal + owning domain", () => {
		const stage0 = built.stages.find((s) => s.stageId === "0");
		expect(stage0?.goal).toBe("Foundation cleanup.");
		// ownerDomain is now the `# Domain` the section sits under.
		expect(stage0?.ownerDomain).toBe("Infrastructure");
	});

	it("emits an OQ row per parsed open question with correct status mapping", () => {
		expect(built.openQuestions.map((q) => q.code).sort()).toEqual(["OQ-1", "OQ-2", "OQ-3"]);
		const oq2 = built.openQuestions.find((q) => q.code === "OQ-2");
		expect(oq2?.status).toBe("open");
		const oq3 = built.openQuestions.find((q) => q.code === "OQ-3");
		expect(oq3?.status).toBe("resolved");
		expect(oq3?.resolutionRef).toContain("Stage 9.7");
	});

	it("cross-links resolved OQs back to their resolving iteration when the ref names an iteration code", () => {
		const iter97 = built.iterations.find((i) => i.code === "9.7");
		expect(iter97?.resolvedOQs).toContain("OQ-3");
	});

	it("leaves resolvedOQs empty on an iteration whose resolution ref names only a stage", () => {
		// OQ-1 is resolved at "Stage 0" — not at a specific iteration — so no
		// iteration gets the cross-link.
		const iter10 = built.iterations.find((i) => i.code === "0.10");
		expect(iter10?.resolvedOQs).toEqual([]);
	});

	it("emits stable opaque ids for entities — slugified from the code", () => {
		const i = built.iterations.find((i) => i.code === "9.14.1.5");
		expect(i?.id).toBe("iter-9-14-1-5");
		const oq = built.openQuestions.find((q) => q.code === "OQ-1");
		expect(oq?.id).toBe("oq-oq-1");
	});

	it("is idempotent — re-running with the same `now` produces structurally identical output", () => {
		const a = buildBrainstormProjectEntities({
			planSource: PLAN_FIXTURE,
			oqSource: OQ_FIXTURE,
			now: 999_999,
		});
		const b = buildBrainstormProjectEntities({
			planSource: PLAN_FIXTURE,
			oqSource: OQ_FIXTURE,
			now: 999_999,
		});
		expect(b).toEqual(a);
	});

	it("returns empty designDocs when none supplied", () => {
		expect(built.designDocs).toEqual([]);
	});

	it("maps supplied DesignDocSource list into entity rows with parsed path metadata", () => {
		const result = buildBrainstormProjectEntities({
			planSource: PLAN_FIXTURE,
			oqSource: OQ_FIXTURE,
			now: 100_000,
			designDocs: [
				{
					path: "docs/foundations/49-self-hosting.md",
					title: "49 — Self-hosting",
					excerpt: "Brainstorm is the IDE for building Brainstorm.",
				},
				{
					path: "docs/apps/03-app-model.md",
					title: "03 — App model",
					excerpt: "What an app is, how it is packaged.",
				},
			],
		});
		expect(result.designDocs).toHaveLength(2);
		expect(result.designDocs[0]?.docNumber).toBe(49);
		expect(result.designDocs[0]?.slug).toBe("self-hosting");
		expect(result.designDocs[0]?.category).toBe("foundations");
		expect(result.designDocs[1]?.category).toBe("apps");
	});
});

describe("parseDocPath", () => {
	it("extracts category + docNumber + slug from a nested foundations path", () => {
		const parsed = parseDocPath("docs/foundations/49-self-hosting.md");
		expect(parsed).toEqual({ category: "foundations", docNumber: 49, slug: "self-hosting" });
	});

	it("supports every documented category", () => {
		expect(parseDocPath("docs/apps/14-app-store.md").category).toBe("apps");
		expect(parseDocPath("docs/shell/12-shell-architecture.md").category).toBe("shell");
		expect(parseDocPath("docs/data/05-data-and-blocks-protocol.md").category).toBe("data");
		expect(parseDocPath("docs/editing/07-editing-lexical.md").category).toBe("editing");
		expect(parseDocPath("docs/security/09-security-and-sandbox.md").category).toBe("security");
		expect(parseDocPath("docs/platform/21-localization.md").category).toBe("platform");
		expect(parseDocPath("docs/reference/11-open-questions.md").category).toBe("reference");
	});

	it("treats unknown nested folders as `foundations`", () => {
		expect(parseDocPath("docs/wild/00-thing.md").category).toBe("foundations");
	});

	it("handles top-level docs by defaulting category to foundations", () => {
		expect(parseDocPath("docs/00-index.md").category).toBe("foundations");
	});

	it("falls back gracefully when the filename has no number prefix", () => {
		const parsed = parseDocPath("docs/foundations/links.md");
		expect(parsed.docNumber).toBe(0);
		expect(parsed.slug).toBe("links");
	});
});

describe("stripStatusPrefix", () => {
	it("strips a leading ✅ + dot", () => {
		expect(stripStatusPrefix("✅. Token namespace + themes")).toBe("Token namespace + themes");
	});

	it("strips a leading ✅ with no dot", () => {
		expect(stripStatusPrefix("✅ Token namespace")).toBe("Token namespace");
	});

	it("strips a leading 🟡 partial marker", () => {
		expect(stripStatusPrefix("🟡 Partial work")).toBe("Partial work");
	});

	it("strips ⚪ pending", () => {
		expect(stripStatusPrefix("⚪ Pending")).toBe("Pending");
	});

	it("strips ✅ DONE", () => {
		expect(stripStatusPrefix("✅ DONE Token namespace")).toBe("Token namespace");
	});

	it("strips ✅ (date) prefix", () => {
		expect(stripStatusPrefix("✅ (2026-05-13). Dev MCP server scaffold")).toBe(
			"Dev MCP server scaffold",
		);
	});

	it("returns input untouched when no status prefix present", () => {
		expect(stripStatusPrefix("Token namespace")).toBe("Token namespace");
	});

	it("returns empty string when input collapses to all-prefix", () => {
		expect(stripStatusPrefix("✅.")).toBe("");
	});
});

describe("iteration title shortening (firstLine via build pipeline)", () => {
	const plan = `# Infrastructure

## Foundations *(Stage 0)*

- ✅ 0.10 — Dev MCP server scaffold at tools/mcp-server/ (TypeScript, runs under Bun) using @modelcontextprotocol/sdk with StdioServerTransport. Package added under a new tools/* workspace glob; root scripts mcp:dev / mcp:build proxy to it. What's in: lots of detail that should NOT appear in the title.
- ✅ 0.5 — Token namespace + default-dark / default-light themes.
- ⚪ 0.11 — Coverage badges.
`;

	const oqs = "# Open questions\n";

	const { iterations } = buildBrainstormProjectEntities({
		planSource: plan,
		oqSource: oqs,
		designDocs: [],
	});

	it("title for 0.10 is the short topic, NOT the whole iteration body", () => {
		const it = iterations.find((i) => i.code === "0.10");
		expect(it).toBeDefined();
		expect(it?.title.length).toBeLessThanOrEqual(80);
		expect(it?.title).not.toMatch(/workspace glob/);
		expect(it?.title).toMatch(/Dev MCP server scaffold/);
	});

	it("title strips the leading ✅ + date prefix", () => {
		const it = iterations.find((i) => i.code === "0.10");
		expect(it?.title.startsWith("✅")).toBe(false);
		expect(it?.title.startsWith("(")).toBe(false);
	});

	it("title for 0.5 is the topic, not the status marker", () => {
		const it = iterations.find((i) => i.code === "0.5");
		expect(it?.title).toBe("Token namespace + default-dark / default-light themes");
	});

	it("title for PENDING iterations also strips and clips correctly", () => {
		const it = iterations.find((i) => i.code === "0.11");
		expect(it?.title).toMatch(/Coverage badges/);
	});

	it("clips to 80 chars when source sentence is longer than that", () => {
		const longPlan = `# Infrastructure

## Foundations *(Stage 0)*

- ✅ 9.9 — ${"x".repeat(200)} end-of-sentence`;
		const result = buildBrainstormProjectEntities({
			planSource: longPlan,
			oqSource: oqs,
			designDocs: [],
		});
		const it = result.iterations.find((i) => i.code === "9.9");
		expect(it?.title.length).toBeLessThanOrEqual(80);
		expect(it?.title.endsWith("…")).toBe(true);
	});
});
