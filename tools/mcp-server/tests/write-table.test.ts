/**
 * `applyTableUpdate` — mirrors a single iteration's status into
 * `docs/implementation-plan-table.md`, the at-a-glance grid that lives
 * alongside `implementation-plan.md` + `implementation-log.md` (per
 * [[feedback_keep_plan_table_in_sync]]). Pure helper: returns the
 * modified markdown without touching disk. Round-trip tested via fixtures
 * that mirror the actual table's row grammar.
 */

import { describe, expect, it } from "vitest";
import { applyTableUpdate } from "../src/tools/write.ts";
import { IterationStatus } from "../src/types.ts";

// A multi-table fixture mirroring the real `implementation-plan-table.md`
// shape: domain table (Status column 2), apps table (Status column 3),
// "Next up" table with 🔴/🟢 priority column (Pri column 2, no status
// cell at all for pending items), and a beta-roadmap row (State column
// 2). Backticked iteration ids in cells drive row matching — any
// backticked token in the row that matches `id` exactly through
// `LEAD_ID_RE` (the write.ts/parse-plan primitive) qualifies the row.
const TABLE_FIXTURE = `# Implementation plan — at-a-glance table

## Domain

| Section | Status | Done | Left |
| ------- | ------ | ---- | ---- |
| Monorepo & workers | ✅ | \`1.1\`–\`1.6\` | — |
| Dev-MCP + self-hosting | 🟡 | 0.1–0.10.1 · \`0.11\` audit tools | \`0.12\` write tools |
| Network broker | ⚪ | — | \`9.99\` pending row |

## Apps

| App | Stage | Status | Done | Left / gate |
| --- | ----- | ------ | ---- | ----------- |
| **Notes** | 9.6 | 🟡 | \`B6.1\` · \`B6.4\` | \`B6.4b\` transclusion |
| **Preview** | 9.20 | ◑ | \`9.20.1\` | \`9.20.5\` PDF |

## Beta roadmap

| Gate | State | Serial spine | Fan-out | Exit |
| ---- | ----- | ------------ | ------- | ---- |
| **G2 Sync** | ✅ | \`10.1\`–\`10.8\` ✅ | each app | E2E soaked |
| **G3 Quality** | 🟡 | \`13.4\` virtualization | \`12.1\` i18n | feature freeze |

## Next up

| # | Pri | Item | What's left | Gate / note |
| - | --- | ---- | ----------- | ----------- |
| 12 | 🟢 | \`0.12\` dev-MCP write tools | plan edits become tool-mediated | quality-of-life |
`;

describe("applyTableUpdate — basic matching + swap", () => {
	it("flips a 🟡 → ✅ in the domain table's Status column", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "0.12",
			status: IterationStatus.Done,
		});
		expect(result.changed).toBe(true);
		expect(result.before).toContain("| 🟡 |");
		expect(result.after).toContain("| ✅ |");
		expect(result.source).toContain(
			"| Dev-MCP + self-hosting | ✅ | 0.1–0.10.1 · `0.11` audit tools | `0.12` write tools |",
		);
	});

	it("preserves cell padding when swapping (single-space delim stays a single space)", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "0.12",
			status: IterationStatus.Done,
		});
		expect(result.after).toBe(
			"| Dev-MCP + self-hosting | ✅ | 0.1–0.10.1 · `0.11` audit tools | `0.12` write tools |",
		);
	});

	it("flips a ⚪ → 🟡 (pending → partial) in the same domain table", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "9.99",
			status: IterationStatus.Partial,
		});
		expect(result.changed).toBe(true);
		expect(result.after).toContain("| 🟡 |");
	});

	it("targets the Status column (col 3) in the Apps table, not the Stage column (col 2)", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "B6.4b",
			status: IterationStatus.Done,
		});
		expect(result.changed).toBe(true);
		// The Stage cell (9.6) stays as 9.6; the Status cell flips 🟡 → ✅.
		expect(result.after).toBe("| **Notes** | 9.6 | ✅ | `B6.1` · `B6.4` | `B6.4b` transclusion |");
	});

	it("flips a ◑ → ✅ on the Preview row (preview-drop closure)", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "9.20.5",
			status: IterationStatus.Done,
		});
		expect(result.changed).toBe(true);
		expect(result.after).toContain("| ✅ |");
		expect(result.after).not.toContain("| ◑ |");
	});
});

describe("applyTableUpdate — id-match safety", () => {
	it("does NOT false-positive 0.1 against 0.10 / 0.11 / 0.12", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "0.1",
			status: IterationStatus.Done,
		});
		// 0.1 isn't backticked in any row; the row mentioning 0.10 starts
		// with non-backticked text. So no match.
		expect(result.changed).toBe(false);
		expect(result.before).toBeNull();
	});

	it("matches only the exact id, not a prefix shorter or longer", () => {
		// 9.20.1 is backticked in the Preview row's Done cell — but the
		// FIRST backticked token in that row is `9.20.1`, so a request for
		// 9.20 should NOT match (LEAD_ID_RE exact-match guarantee).
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "9.20",
			status: IterationStatus.Done,
		});
		expect(result.changed).toBe(false);
	});
});

describe("applyTableUpdate — non-fatal misses", () => {
	it("returns { changed:false, before:null } when no row matches", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "9.99.99",
			status: IterationStatus.Done,
		});
		expect(result).toEqual({
			source: TABLE_FIXTURE,
			changed: false,
			before: null,
			after: null,
		});
	});

	it("skips a row whose only icon cell is a 🟢/🔴 priority (no status column)", () => {
		// A row whose only icon-bearing cell is 🔴 (priority, not status):
		// the writer matches the row by the backticked id `9.42.1`, but
		// 🔴 isn't in the status-icon set, so swapStatusCell returns null
		// and the writer falls through to "no row" semantics for this row.
		// The standalone "Next up" row for `0.12` in the main fixture is
		// shadowed by the earlier domain-table match — this isolated case
		// proves the skip in its purest form.
		const priorityOnly = "| 99 | 🔴 | `9.42.1` plan | tail | note |\n";
		const result = applyTableUpdate(priorityOnly, {
			id: "9.42.1",
			status: IterationStatus.Done,
		});
		// The id matches the row but no status cell exists → non-fatal miss.
		expect(result.changed).toBe(false);
		expect(result.before).toBeNull();
	});
});

describe("applyTableUpdate — idempotency + status coverage", () => {
	it("is idempotent — applying the same update twice yields the same source", () => {
		const first = applyTableUpdate(TABLE_FIXTURE, {
			id: "0.12",
			status: IterationStatus.Done,
		});
		const second = applyTableUpdate(first.source, {
			id: "0.12",
			status: IterationStatus.Done,
		});
		expect(second.source).toBe(first.source);
		expect(second.changed).toBe(false);
	});

	it("maps every renderable IterationStatus to the right table cell glyph", () => {
		// `0.12` row starts as 🟡; flipping to each non-🟡 status hits a
		// real change. The Partial case proves byte-stable idempotency
		// (already 🟡 → no-op `changed:false`) — that's its own assertion.
		for (const [status, glyph] of [
			[IterationStatus.Done, "✅"],
			[IterationStatus.PreviewDrop, "◑"],
			[IterationStatus.Pending, "⚪"],
			[IterationStatus.Reverted, "❌"],
		] as const) {
			const result = applyTableUpdate(TABLE_FIXTURE, { id: "0.12", status });
			expect(result.changed, `status=${status} should land`).toBe(true);
			expect(result.after, `status=${status} → ${glyph}`).toContain(`| ${glyph} |`);
		}
		// Partial = the fixture's existing state for `0.12` → no-op.
		const noop = applyTableUpdate(TABLE_FIXTURE, {
			id: "0.12",
			status: IterationStatus.Partial,
		});
		expect(noop.changed).toBe(false);
	});

	it("Todo / Unknown are no-ops (no glyph defined)", () => {
		expect(
			applyTableUpdate(TABLE_FIXTURE, { id: "0.12", status: IterationStatus.Todo }).changed,
		).toBe(false);
		expect(
			applyTableUpdate(TABLE_FIXTURE, { id: "0.12", status: IterationStatus.Unknown }).changed,
		).toBe(false);
	});
});

describe("applyTableUpdate — multi-table scope", () => {
	it("updates only the table that contains a matching row (Apps but not Domain)", () => {
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "B6.4b",
			status: IterationStatus.Done,
		});
		expect(result.changed).toBe(true);
		// The Notes row in the Apps table flipped.
		expect(result.source).toContain(
			"| **Notes** | 9.6 | ✅ | `B6.1` · `B6.4` | `B6.4b` transclusion |",
		);
		// The Dev-MCP row in the Domain table is untouched (still 🟡).
		expect(result.source).toContain(
			"| Dev-MCP + self-hosting | 🟡 | 0.1–0.10.1 · `0.11` audit tools | `0.12` write tools |",
		);
	});

	it("a single applyTableUpdate flips exactly one row even when ids could appear in multiple tables", () => {
		// `13.4` appears only in the Beta roadmap G3 row in the fixture.
		const result = applyTableUpdate(TABLE_FIXTURE, {
			id: "13.4",
			status: IterationStatus.Done,
		});
		expect(result.changed).toBe(true);
		// G3 row's State cell 🟡 → ✅.
		expect(result.source).toContain(
			"| **G3 Quality** | ✅ | `13.4` virtualization | `12.1` i18n | feature freeze |",
		);
	});
});
