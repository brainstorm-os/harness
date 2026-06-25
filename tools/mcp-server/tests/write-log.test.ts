/**
 * `appendLogEntry` — appends a single iteration's narrative to
 * `docs/implementation-log.md` under the matching `## Stage N — <title>`
 * heading in the canonical `### <id> — <headline>` + `✅ DONE (YYYY-MM-DD).
 * **<headline>**. <body>` shape that `parseImplementationLog` round-trips
 * (the load-bearing SH-27 seeder titling contract).
 *
 * Pure helper: returns the modified markdown without touching disk.
 * Idempotent on same-id+same-date; refuses to silently overwrite on a
 * different date.
 */

import { describe, expect, it } from "vitest";
import { parseImplementationLog } from "../src/parse-log.ts";
import { LogAppendRefusal, appendLogEntry } from "../src/tools/write.ts";

const LOG_FIXTURE = `# Implementation log

## Stage 0 — Self-hosting + dev-MCP foundations

### 0.10 — repo scaffold

✅ DONE (2026-05-14). **MCP server scaffolded.** Foundation in place.

### 0.11 — audit tools

✅ DONE (2026-05-20). **Audit tools land.** Coverage, capability diff.

## Stage 9 — Apps + BP host

### 9.6 — Notes mention typeahead

✅ DONE (2026-05-22). **Cross-app linking.** MentionNode + @-trigger.
`;

describe("appendLogEntry — happy path under an existing Stage heading", () => {
	it("appends a new entry at the end of the matching Stage section", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "dev-MCP write tools",
			body: "Plan + table + log atomically writable via MCP tool.",
		});
		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.source).toContain("### 0.12 — dev-MCP write tools");
		expect(result.source).toContain(
			"✅ DONE (2026-05-25). **dev-MCP write tools**. Plan + table + log atomically writable via MCP tool.",
		);
	});

	it("uses the ### heading level (mirrors the canonical SH-27 shape)", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "tools",
			body: "body.",
		});
		expect(result.source).toMatch(/^### 0\.12 — tools$/m);
		expect(result.source).not.toMatch(/^#### 0\.12 — /m);
	});

	it("places the new entry at the end of its stage section (before the next ## heading)", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "tools",
			body: "body.",
		});
		const newEntryAt = result.source.indexOf("### 0.12 — tools");
		const stage9HeadingAt = result.source.indexOf("## Stage 9 — Apps + BP host");
		expect(newEntryAt).toBeGreaterThan(0);
		expect(stage9HeadingAt).toBeGreaterThan(0);
		expect(newEntryAt).toBeLessThan(stage9HeadingAt);
	});

	it("appends after the LAST entry in the stage (not before existing entries)", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "tools",
			body: "body.",
		});
		const prior010 = result.source.indexOf("### 0.10 — repo scaffold");
		const prior011 = result.source.indexOf("### 0.11 — audit tools");
		const newEntry = result.source.indexOf("### 0.12 — tools");
		expect(prior010).toBeLessThan(prior011);
		expect(prior011).toBeLessThan(newEntry);
	});
});

describe("appendLogEntry — Stage heading synthesis", () => {
	it("synthesizes a new `## Stage N — <title>` heading when none exists", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "13.4a.1",
			stage: "13",
			today: "2026-05-25",
			headline: "editor virtualization keystones",
			body: "Block-id stamp + height cache + OffscreenGate.",
		});
		expect(result.changed).toBe(true);
		expect(result.source).toContain("## Stage 13 — 13");
		expect(result.source).toContain("### 13.4a.1 — editor virtualization keystones");
	});

	it("places the synthesized stage section at the END of the source", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "13.4a.1",
			stage: "13",
			today: "2026-05-25",
			headline: "h",
			body: "b.",
		});
		// All pre-existing sections precede the synthesized one.
		const newStageAt = result.source.indexOf("## Stage 13 — 13");
		const stage9At = result.source.indexOf("## Stage 9 — Apps + BP host");
		expect(newStageAt).toBeGreaterThan(stage9At);
	});
});

describe("appendLogEntry — round-trip through parseImplementationLog", () => {
	it("the appended entry's title/summary/completedAt are recoverable by the SH-27 parser", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "dev-MCP write tools",
			body: "Plan + table + log atomically writable via MCP tool. Closes 0.12.",
		});
		const reparsed = parseImplementationLog(result.source);
		const entry = reparsed.get("0.12");
		expect(entry, "0.12 entry must be in the reparsed log").toBeDefined();
		expect(entry?.title).toBe("dev-MCP write tools");
		expect(entry?.summary).toContain("dev-MCP write tools");
		expect(entry?.completedAt).toBe(Date.UTC(2026, 4, 25));
	});

	it("byte-stable date format — `(YYYY-MM-DD)` is exactly what the parser's SHIP_DATE_RE captures", () => {
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "h",
			body: "b.",
		});
		// The status prefix carries the date literally as `(2026-05-25)`.
		expect(result.source).toContain("✅ DONE (2026-05-25).");
	});
});

describe("appendLogEntry — idempotency + refusal", () => {
	it("same-id + same-date is a no-op (changed:false, no reason)", () => {
		const first = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "h",
			body: "b.",
		});
		const second = appendLogEntry(first.source, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "h-alt", // headline differs — but date matches → still no-op
			body: "b-alt.",
		});
		expect(second.changed).toBe(false);
		expect(second.reason).toBeUndefined();
		expect(second.source).toBe(first.source);
	});

	it("same-id + DIFFERENT date returns { changed:false, reason:'log-entry-exists' }", () => {
		const first = appendLogEntry(LOG_FIXTURE, {
			id: "0.12",
			stage: "0",
			today: "2026-05-25",
			headline: "h",
			body: "b.",
		});
		const second = appendLogEntry(first.source, {
			id: "0.12",
			stage: "0",
			today: "2026-05-26", // a day later
			headline: "h2",
			body: "b2.",
		});
		expect(second.changed).toBe(false);
		expect(second.reason).toBe(LogAppendRefusal.LogEntryExists);
		expect(second.source).toBe(first.source);
	});

	it("refuses an entry whose id already exists in the fixture (different date case)", () => {
		// 0.10 is already in the fixture at 2026-05-14; trying to re-land
		// today must refuse, not stack a second entry.
		const result = appendLogEntry(LOG_FIXTURE, {
			id: "0.10",
			stage: "0",
			today: "2026-05-25",
			headline: "h",
			body: "b.",
		});
		expect(result.changed).toBe(false);
		expect(result.reason).toBe(LogAppendRefusal.LogEntryExists);
	});
});
