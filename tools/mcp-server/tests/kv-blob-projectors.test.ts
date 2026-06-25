import { describe, expect, it } from "vitest";
import type { VaultEntitiesSnapshot } from "../../../packages/shell/src/main/entities/vault-entities-service.ts";
import { projectNotesFromBlob } from "../src/seed/kv-blob-projectors.ts";

const NOTE_TYPE = "io.brainstorm.notes/Note/v1";
const JOURNAL_ENTRY_TYPE = "io.brainstorm.journal/Entry/v1";

function emptySnapshot(): VaultEntitiesSnapshot {
	return { entities: [], links: [] };
}

function noteRow(id: string, title: string) {
	return { id, title, body: null, createdAt: 1, updatedAt: 2 };
}

describe("projectNotesFromBlob — journal re-typing", () => {
	it("re-types journal-<date> rows to the Journal entry type, leaving notes as notes", () => {
		const blob: Record<string, unknown> = {
			"note:n1": noteRow("n1", "A regular note"),
			"note:journal-2026-06-01": noteRow("journal-2026-06-01", "2026-06-01"),
		};
		const out = emptySnapshot();
		projectNotesFromBlob(blob, out);

		const byId = new Map(out.entities.map((e) => [e.id, e] as const));
		expect(byId.get("n1")?.type).toBe(NOTE_TYPE);
		expect(byId.get("journal-2026-06-01")?.type).toBe(JOURNAL_ENTRY_TYPE);
		expect(byId.get("journal-2026-06-01")?.ownerAppId).toBe("io.brainstorm.journal");
	});

	it("only matches the exact journal-YYYY-MM-DD id shape, never a user note that starts with 'journal-'", () => {
		const blob: Record<string, unknown> = {
			"note:journal-ideas": noteRow("journal-ideas", "Journal ideas"),
		};
		const out = emptySnapshot();
		projectNotesFromBlob(blob, out);

		expect(out.entities[0]?.type).toBe(NOTE_TYPE);
	});
});
