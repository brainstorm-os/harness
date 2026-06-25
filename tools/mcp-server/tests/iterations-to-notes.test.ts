import { describe, expect, it } from "vitest";
import type { SerializedIterationEntity } from "../src/seed/brainstorm-project.ts";
import {
	buildIterationsAsNotes,
	iterationNoteId,
	iterationToNote,
} from "../src/seed/iterations-to-notes.ts";

function fakeIteration(over: Partial<SerializedIterationEntity> = {}): SerializedIterationEntity {
	return {
		id: "iteration-9.14.1",
		code: "9.14.1",
		stageId: "9",
		title: "Tasks scaffold",
		status: "done",
		summary: "Manifest + Task/v1 + Project/v1 entity types + helpers.",
		body: "",
		completedAt: Date.UTC(2026, 4, 14),
		scheduledStart: Date.UTC(2026, 3, 14),
		scheduledEnd: Date.UTC(2026, 4, 14),
		resolvedOQs: ["OQ-TK-1", "OQ-TK-2"],
		createdAt: Date.UTC(2026, 4, 14),
		updatedAt: Date.UTC(2026, 4, 14),
		...over,
	};
}

describe("iterationNoteId", () => {
	it("namespaces iteration ids with the `iteration-` prefix and dots → dashes", () => {
		expect(iterationNoteId(fakeIteration({ code: "9.14.1" }))).toBe("iteration-9-14-1");
		expect(iterationNoteId(fakeIteration({ code: "SH-7" }))).toBe("iteration-SH-7");
		expect(iterationNoteId(fakeIteration({ code: "0.10" }))).toBe("iteration-0-10");
	});

	it("never collides with the docs-to-notes `doc-*` namespace", () => {
		const id = iterationNoteId(fakeIteration({ code: "9.14.1" }));
		expect(id.startsWith("doc-")).toBe(false);
	});
});

describe("iterationToNote", () => {
	it("title carries the iteration code + title", () => {
		const note = iterationToNote(fakeIteration(), 1000);
		expect(note.title).toBe("9.14.1 — Tasks scaffold");
	});

	it("picks the status-matching emoji", () => {
		expect(iterationToNote(fakeIteration({ status: "done" }), 1000).icon).toEqual({
			kind: "emoji",
			value: "✅",
		});
		expect(iterationToNote(fakeIteration({ status: "in-flight" }), 1000).icon).toEqual({
			kind: "emoji",
			value: "🟡",
		});
		expect(iterationToNote(fakeIteration({ status: "pending" }), 1000).icon).toEqual({
			kind: "emoji",
			value: "⚪",
		});
	});

	it("falls back to a default emoji for unknown statuses", () => {
		expect(iterationToNote(fakeIteration({ status: "wat" }), 1000).icon).toEqual({
			kind: "emoji",
			value: "🛠️",
		});
	});

	it("body opens with the TitleNode followed by the Status & timing metadata card", () => {
		const note = iterationToNote(fakeIteration(), 1000);
		const root = note.body?.root as {
			children: Array<{ type: string; tag?: string; children?: Array<{ text?: string }> }>;
		};
		expect(root.children[0]?.type).toBe("title");
		expect(root.children[1]?.type).toBe("heading");
		expect(root.children[1]?.tag).toBe("h3");
		expect(root.children[1]?.children?.[0]?.text).toBe("Status & timing");
	});

	it("the TitleNode mirrors note.title", () => {
		const note = iterationToNote(fakeIteration(), 1000);
		const root = note.body?.root as {
			children: Array<{ type: string; children: Array<{ text?: string }> }>;
		};
		expect(root.children[0]?.children[0]?.text).toBe(note.title);
	});

	it("body does NOT duplicate the title as an H1 (TitleNode covers that)", () => {
		const note = iterationToNote(fakeIteration(), 1000);
		const root = note.body?.root as { children: Array<{ type: string; tag?: string }> };
		const h1 = root.children.filter((c) => c.type === "heading" && c.tag === "h1");
		expect(h1).toHaveLength(0);
	});

	it("metadata card carries status + stage and the scheduled / completed dates", () => {
		const note = iterationToNote(
			fakeIteration({
				status: "in-flight",
				stageId: "9",
				completedAt: null,
				scheduledStart: Date.UTC(2026, 3, 1),
				scheduledEnd: Date.UTC(2026, 4, 30),
			}),
			1000,
		);
		const root = note.body?.root as {
			children: Array<{ type: string; children?: Array<{ text?: string }> }>;
		};
		const metaLine = root.children[2];
		expect(metaLine?.type).toBe("paragraph");
		expect(metaLine?.children?.[0]?.text).toBe("Status: In flight · Stage 9");
		const scheduleLine = root.children[3];
		expect(scheduleLine?.type).toBe("paragraph");
		expect(scheduleLine?.children?.[0]?.text).toBe("Scheduled: 2026-04-01 → 2026-05-30");
	});

	it("appends the completed date to the schedule line when the iteration shipped", () => {
		const note = iterationToNote(
			fakeIteration({
				status: "done",
				completedAt: Date.UTC(2026, 4, 14),
				scheduledStart: Date.UTC(2026, 3, 1),
				scheduledEnd: Date.UTC(2026, 4, 30),
			}),
			1000,
		);
		const root = note.body?.root as {
			children: Array<{ children?: Array<{ text?: string }> }>;
		};
		const scheduleLine = root.children[3];
		expect(scheduleLine?.children?.[0]?.text).toBe(
			"Scheduled: 2026-04-01 → 2026-05-30 · Completed: 2026-05-14",
		);
	});

	it("renders resolved open questions as a bullet list under a Resolved questions heading", () => {
		const note = iterationToNote(fakeIteration({ resolvedOQs: ["OQ-7", "OQ-12"] }), 1000);
		const root = note.body?.root as {
			children: Array<{
				type: string;
				tag?: string;
				listType?: string;
				children?: Array<{ children?: Array<{ text?: string }> }>;
			}>;
		};
		const heading = root.children.find(
			(c) => c.type === "heading" && c.children?.[0]?.text === "Resolved questions",
		);
		expect(heading).toBeDefined();
		const list = root.children.find((c) => c.type === "list");
		expect(list?.listType).toBe("bullet");
		const items = list?.children ?? [];
		expect(items.map((li) => li.children?.[0]?.text)).toEqual(["OQ-7", "OQ-12"]);
	});

	it("omits the Resolved questions section entirely when resolvedOQs is empty", () => {
		const note = iterationToNote(fakeIteration({ resolvedOQs: [] }), 1000);
		const root = note.body?.root as {
			children: Array<{ type: string; children?: Array<{ text?: string }> }>;
		};
		const hasResolvedHeading = root.children.some(
			(c) => c.type === "heading" && c.children?.[0]?.text === "Resolved questions",
		);
		expect(hasResolvedHeading).toBe(false);
		expect(root.children.find((c) => c.type === "list")).toBeUndefined();
	});

	it("a non-empty markdown body lands as Lexical blocks after the metadata card + rule", () => {
		const note = iterationToNote(
			fakeIteration({
				body: "## Overview\n\nA real paragraph.\n\n- one\n- two\n",
				resolvedOQs: [],
			}),
			1000,
		);
		const root = note.body?.root as {
			children: Array<{ type: string; tag?: string; children?: Array<{ text?: string }> }>;
		};
		const ruleIndex = root.children.findIndex((c) => c.type === "horizontalrule");
		expect(ruleIndex).toBeGreaterThan(0);
		const afterRule = root.children.slice(ruleIndex + 1);
		expect(afterRule[0]?.type).toBe("heading");
		expect(afterRule[0]?.tag).toBe("h2");
		expect(afterRule[1]?.type).toBe("paragraph");
		expect(afterRule[2]?.type).toBe("list");
	});

	it("falls back to the summary as a single paragraph when the markdown body is empty", () => {
		const note = iterationToNote(
			fakeIteration({ body: "", summary: "One-liner summary.", resolvedOQs: [] }),
			1000,
		);
		const root = note.body?.root as {
			children: Array<{ type: string; children?: Array<{ text?: string }> }>;
		};
		const ruleIndex = root.children.findIndex((c) => c.type === "horizontalrule");
		expect(ruleIndex).toBeGreaterThan(0);
		const afterRule = root.children.slice(ruleIndex + 1);
		expect(afterRule).toHaveLength(1);
		expect(afterRule[0]?.type).toBe("paragraph");
		expect(afterRule[0]?.children?.[0]?.text).toBe("One-liner summary.");
	});

	it("emits no narrative section at all when both the body and summary are empty", () => {
		const note = iterationToNote(fakeIteration({ body: "", summary: "", resolvedOQs: [] }), 1000);
		const root = note.body?.root as { children: Array<{ type: string }> };
		expect(root.children.some((c) => c.type === "horizontalrule")).toBe(false);
	});

	it("values carry iteration code, stage, status for cross-app filtering", () => {
		const note = iterationToNote(fakeIteration(), 1000);
		expect(note.values).toEqual({
			"iteration-code": "9.14.1",
			"iteration-stage": "9",
			"iteration-status": "done",
		});
	});

	it("uses the provided timestamp for createdAt + updatedAt", () => {
		const note = iterationToNote(fakeIteration(), 12345);
		expect(note.createdAt).toBe(12345);
		expect(note.updatedAt).toBe(12345);
	});
});

describe("buildIterationsAsNotes", () => {
	it("emits one note per iteration in input order", () => {
		const result = buildIterationsAsNotes([
			fakeIteration({ code: "0.1", title: "First" }),
			fakeIteration({ code: "0.2", title: "Second" }),
		]);
		expect(result).toHaveLength(2);
		expect(result[0]?.title).toBe("0.1 — First");
		expect(result[1]?.title).toBe("0.2 — Second");
	});

	it("is empty for an empty input", () => {
		expect(buildIterationsAsNotes([])).toEqual([]);
	});

	it("is idempotent — same input yields identical output", () => {
		const a = buildIterationsAsNotes([fakeIteration()]);
		const b = buildIterationsAsNotes([fakeIteration()]);
		expect(b).toEqual(a);
	});

	it("resolves [[wikilinks]] in the iteration body into mention chips", () => {
		const resolver = (slug: string) =>
			slug.toLowerCase() === "9.14.1"
				? {
						entityId: "iteration-9-14-1",
						entityType: "io.brainstorm.notes/Note/v1",
						label: "9.14.1 — Tasks scaffold",
					}
				: null;
		const [note] = buildIterationsAsNotes(
			[
				fakeIteration({
					code: "9.15.1",
					body: "Adopts the pattern from [[9.14.1]] verbatim.\n\nSee also [[unknown_memory]].",
					resolvedOQs: [],
				}),
			],
			resolver,
		);
		const flat = JSON.stringify(note?.body);
		expect(flat).toContain('"type":"mention"');
		expect(flat).toContain('"entityId":"iteration-9-14-1"');
		expect(flat).not.toContain("[[9.14.1]]");
		expect(flat).not.toContain("[[unknown_memory]]");
		// Unresolved wikilink collapses to its label.
		expect(flat).toContain("unknown_memory");
	});

	it("strips wikilinks from the note title field so the sidebar reads plain text", () => {
		const [note] = buildIterationsAsNotes([
			fakeIteration({ title: "Adopt scaffold per [[app-scaffold-pattern]]" }),
		]);
		expect(note?.title).toBe("9.14.1 — Adopt scaffold per app-scaffold-pattern");
	});

	it("dates each note from the iteration's real history (completedAt, else scheduledEnd) — not 'just now'", () => {
		const completed = Date.UTC(2026, 1, 3);
		const scheduledEnd = Date.UTC(2026, 3, 9);
		const [doneNote] = buildIterationsAsNotes([
			fakeIteration({ status: "done", completedAt: completed, scheduledEnd }),
		]);
		expect(doneNote?.updatedAt).toBe(completed);
		expect(doneNote?.createdAt).toBe(completed);

		// Not yet complete → falls back to its per-iteration scheduled end,
		// so it still lands in a real date-section, never all-"just now".
		const [pendingNote] = buildIterationsAsNotes([
			fakeIteration({ status: "pending", completedAt: null, scheduledEnd }),
		]);
		expect(pendingNote?.updatedAt).toBe(scheduledEnd);

		// Distinct real dates → the seeded list spans multiple date
		// sections instead of collapsing to one.
		const notes = buildIterationsAsNotes([
			fakeIteration({ code: "a", completedAt: Date.UTC(2026, 4, 1) }),
			fakeIteration({ code: "b", completedAt: Date.UTC(2026, 0, 1) }),
		]);
		expect(notes[0]?.updatedAt).not.toBe(notes[1]?.updatedAt);
	});
});
