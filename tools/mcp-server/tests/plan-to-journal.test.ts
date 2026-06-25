import { describe, expect, it } from "vitest";
import { projectJournalEntries } from "../../../apps/journal/src/logic/journal-projection.ts";
import type { SerializedIterationEntity } from "../src/seed/brainstorm-project.ts";
import { buildJournalEntries, dayKey, journalNoteId } from "../src/seed/plan-to-journal.ts";
import type { WikilinkResolver } from "../src/seed/wikilinks.ts";

const NOW = Date.UTC(2026, 4, 17);

function iter(
	code: string,
	completedAt: number | null,
	resolvedOQs: string[] = [],
	overrides: Partial<SerializedIterationEntity> = {},
): SerializedIterationEntity {
	return {
		id: `iter-${code}`,
		code,
		stageId: "9",
		title: `Thing ${code}`,
		status: completedAt == null ? "pending" : "done",
		summary: "",
		body: "",
		completedAt,
		scheduledStart: NOW - 1,
		scheduledEnd: completedAt ?? NOW,
		resolvedOQs,
		createdAt: NOW - 1,
		updatedAt: NOW,
		...overrides,
	};
}

describe("buildJournalEntries", () => {
	const day1 = Date.UTC(2026, 2, 14, 9, 0);
	const day2 = Date.UTC(2026, 4, 1, 17, 30);
	const iterations = [
		iter("9.2", day1),
		iter("9.1", day1, ["OQ-7"]),
		iter("9.9", day2),
		iter("9.20", null), // pending — never appears in the journal
	];
	const entries = buildJournalEntries(iterations);

	it("emits one dated Note per active day, sorted ascending, none for pending", () => {
		expect(entries.map((e) => e.title)).toEqual(["2026-03-14", "2026-05-01"]);
		expect(entries.map((e) => e.id)).toEqual([
			journalNoteId("2026-03-14"),
			journalNoteId("2026-05-01"),
		]);
	});

	it("title is exactly the canonical ISO date key", () => {
		expect(dayKey(day1)).toBe("2026-03-14");
		expect(entries[0]?.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("body summarises what shipped + OQs resolved that day", () => {
		const flat = JSON.stringify(entries[0]?.body);
		expect(flat).toContain("Shipped 2 iterations.");
		expect(flat).toContain("9.1 — Thing 9.1");
		expect(flat).toContain("resolved OQ-7");
	});

	it("reads as diary prose, not a bullet list — opener varies by count, closer mentions OQ count", () => {
		const flat0 = JSON.stringify(entries[0]?.body);
		expect(flat0).toContain("momentum");
		expect(flat0).toContain("One open question closed today");
		const oneEntry = buildJournalEntries([iter("9.50", day2)]);
		const flat1 = JSON.stringify(oneEntry[0]?.body);
		expect(flat1).toContain("Shipped 1 iteration.");
		expect(flat1).toContain("A narrow");
	});

	it("includes a per-iteration H3 heading rather than emitting a `✅ <code>` bullet", () => {
		const root = entries[0]?.body.root;
		const headings = root?.children.filter((c) => c.type === "heading") ?? [];
		expect(headings).toHaveLength(2);
		expect(JSON.stringify(headings[0])).toContain("9.1 — Thing 9.1");
		expect(JSON.stringify(headings[1])).toContain("9.2 — Thing 9.2");
	});

	it("draws on iteration body for a follow-up paragraph when one is available", () => {
		const richBody =
			"First-paragraph synopsis that the brainstorm-project mapper uses for summary.\n\nA second paragraph with real texture: an architectural note, the trade-off considered, the test count that landed, and the package boundary the change respected — enough prose to feel like a diary, not a changelog.";
		const richEntries = buildJournalEntries([
			iter("12.7", day2, [], { summary: "First-paragraph synopsis.", body: richBody }),
		]);
		const flat = JSON.stringify(richEntries[0]?.body);
		expect(flat).toContain("architectural note");
	});

	it("skips GFM tables in iteration bodies so the follow-up stays prose, not collapsed pipe-syntax", () => {
		// Collapsing a real iteration body's GFM table by `replace(/\s+/g, " ")`
		// turned the whole table into a >500-char single paragraph that won the
		// `length >= 80` picker — the journal then rendered raw `| col | col |`
		// rows inside a paragraph block. Tables must be skipped at the picker so
		// the entry falls through to a real prose chunk or to no follow-up.
		const bodyWithTable = [
			"Numbers landed on the keystroke→paint budget across three doc profiles:",
			"",
			"| Profile | Blocks | median | p95 | Budget | Status |",
			"|---------|--------|--------|-----|--------|--------|",
			"| empty   | 0      | 16 ms  | 17 ms | <17 ms | ✅ PASS |",
			"| dogfood | 200    | 16 ms  | 17 ms | <17 ms | ✅ PASS |",
			"",
			"A second prose paragraph that is long enough to clear the eighty-character picker threshold and reads like a diary entry rather than a changelog row.",
		].join("\n");
		const entries = buildJournalEntries([
			iter("13.4a", day2, [], { summary: "Numbers landed.", body: bodyWithTable }),
		]);
		const flat = JSON.stringify(entries[0]?.body);
		expect(flat).toContain("second prose paragraph");
		expect(flat).not.toContain("|---");
		expect(flat).not.toContain("| Profile |");
	});

	it("the seeded rows project back through the real Journal logic", () => {
		const projected = projectJournalEntries(
			entries.map((e) => ({ id: e.id, title: e.title, body: e.body })),
		);
		expect(projected.map((p) => p.dateKey)).toEqual(["2026-03-14", "2026-05-01"]);
	});

	it("is deterministic", () => {
		expect(buildJournalEntries(iterations)).toEqual(entries);
	});
});

describe("buildJournalEntries — wikilink handling", () => {
	const day = Date.UTC(2026, 4, 1, 12, 0);

	const resolver: WikilinkResolver = (slug) => {
		if (slug.toLowerCase() === "9.14.1") {
			return {
				entityId: "iteration-9-14-1",
				entityType: "io.brainstorm.notes/Note/v1",
				label: "9.14.1 — App scaffold",
			};
		}
		return null;
	};

	it("converts resolved [[wikilinks]] in iteration prose into mention chips", () => {
		const it: SerializedIterationEntity = {
			id: "iter-9-15-1",
			code: "9.15.1",
			stageId: "9",
			title: "Adopt app scaffold",
			status: "done",
			summary: "App scaffold per [[9.14.1]]. Manifest registers brainstorm/Event/v1.",
			body: "",
			completedAt: day,
			scheduledStart: day - 1,
			scheduledEnd: day,
			resolvedOQs: [],
			createdAt: day - 1,
			updatedAt: day,
		};
		const [entry] = buildJournalEntries([it], resolver);
		const flat = JSON.stringify(entry?.body);
		expect(flat).toContain('"type":"mention"');
		expect(flat).toContain('"entityId":"iteration-9-14-1"');
		expect(flat).not.toContain("[[9.14.1]]");
	});

	it("strips brackets from unresolved memory-style wikilinks (no broken chips)", () => {
		const it: SerializedIterationEntity = {
			id: "iter-9-16-1",
			code: "9.16.1",
			stageId: "9",
			title: "Adopt app scaffold per [[app-scaffold-pattern]]",
			status: "done",
			summary: "Closed out [[feedback_serial_shell_then_apps]] direction.",
			body: "",
			completedAt: day,
			scheduledStart: day - 1,
			scheduledEnd: day,
			resolvedOQs: [],
			createdAt: day - 1,
			updatedAt: day,
		};
		const [entry] = buildJournalEntries([it], resolver);
		const flat = JSON.stringify(entry?.body);
		// Brackets stripped to plain label everywhere — header AND body prose.
		expect(flat).not.toContain("[[");
		expect(flat).not.toContain("]]");
		expect(flat).toContain("app-scaffold-pattern");
		expect(flat).toContain("feedback_serial_shell_then_apps");
	});
});
