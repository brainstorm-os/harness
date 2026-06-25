import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDemoNotes } from "../src/seed/dataset.ts";
import { NOTES_APP_ID, SeedMode, SeedScope, seedVault } from "../src/seed/seeder.ts";
import { MENTION_NODE_TYPE, NOTE_KEY_PREFIX, NOTE_TYPE } from "../src/seed/types.ts";

function makeVault(): string {
	return mkdtempSync(join(tmpdir(), "brainstorm-seed-test-"));
}

function notesKvPath(vault: string): string {
	return join(vault, "data", "apps", NOTES_APP_ID, "kv.json");
}

describe("buildDemoNotes", () => {
	const notes = buildDemoNotes();

	it("emits a non-empty dataset", async () => {
		expect(notes.length).toBeGreaterThanOrEqual(8);
	});

	it("uses stable note ids", async () => {
		const ids = notes.map((n) => n.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain("n_apollo");
	});

	it("references only ids that exist in the dataset", async () => {
		const ids = new Set(notes.map((n) => n.id));
		for (const note of notes) {
			for (const block of note.body.root.children) {
				for (const child of block.children) {
					if (child.type === MENTION_NODE_TYPE) {
						expect(ids.has(child.entityId)).toBe(true);
						expect(child.entityType).toBe(NOTE_TYPE);
					}
				}
			}
		}
	});

	it("is deterministic — back-to-back builds compare equal", async () => {
		const a = JSON.stringify(buildDemoNotes());
		const b = JSON.stringify(buildDemoNotes());
		expect(a).toBe(b);
	});
});

describe("seedVault — notes scope", () => {
	it("writes a kv.json file with note: prefixed keys", async () => {
		const vault = makeVault();
		const report = await seedVault({ vaultPath: vault });
		expect(report.dryRun).toBe(false);
		expect(report.wrote[NOTES_APP_ID]).toBeDefined();
		const kv = JSON.parse(readFileSync(notesKvPath(vault), "utf8"));
		for (const key of Object.keys(kv)) {
			expect(key.startsWith(NOTE_KEY_PREFIX)).toBe(true);
		}
	});

	it("is idempotent — second run produces the same file", async () => {
		const vault = makeVault();
		await seedVault({ vaultPath: vault });
		const first = readFileSync(notesKvPath(vault), "utf8");
		await seedVault({ vaultPath: vault });
		const second = readFileSync(notesKvPath(vault), "utf8");
		expect(first).toBe(second);
	});

	it("merge mode preserves pre-existing non-seed keys", async () => {
		const vault = makeVault();
		const target = notesKvPath(vault);
		mkdirSync(join(vault, "data", "apps", NOTES_APP_ID), { recursive: true });
		writeFileSync(target, JSON.stringify({ "note:user-typed": { id: "user-typed", title: "Mine" } }));
		await seedVault({ vaultPath: vault, mode: SeedMode.Merge });
		const kv = JSON.parse(readFileSync(target, "utf8"));
		expect(kv["note:user-typed"]).toBeDefined();
		expect(kv["note:n_apollo"]).toBeDefined();
	});

	it("replace mode drops pre-existing keys", async () => {
		const vault = makeVault();
		const target = notesKvPath(vault);
		mkdirSync(join(vault, "data", "apps", NOTES_APP_ID), { recursive: true });
		writeFileSync(target, JSON.stringify({ "note:user-typed": { id: "user-typed", title: "Mine" } }));
		await seedVault({ vaultPath: vault, mode: SeedMode.Replace });
		const kv = JSON.parse(readFileSync(target, "utf8"));
		expect(kv["note:user-typed"]).toBeUndefined();
		expect(kv["note:n_apollo"]).toBeDefined();
	});

	it("dryRun reports what would happen without touching disk", async () => {
		const vault = makeVault();
		const report = await seedVault({ vaultPath: vault, dryRun: true });
		expect(report.dryRun).toBe(true);
		expect(report.wrote[NOTES_APP_ID]?.keysWritten.length).toBeGreaterThan(0);
		expect(() => readFileSync(notesKvPath(vault), "utf8")).toThrow();
	});

	it("rejects an empty vault path", async () => {
		await expect(seedVault({ vaultPath: "" })).rejects.toThrow();
	});

	it("default scope is notes", async () => {
		const vault = makeVault();
		const report = await seedVault({ vaultPath: vault });
		expect(Object.keys(report.wrote)).toEqual([NOTES_APP_ID]);
	});

	it("explicit notes scope behaves the same as default", async () => {
		const vault = makeVault();
		const report = await seedVault({ vaultPath: vault, scopes: [SeedScope.Notes] });
		expect(Object.keys(report.wrote)).toEqual([NOTES_APP_ID]);
	});
});

describe("seedVault → vault-entities compatibility", () => {
	it("written notes match the shape the shell's vault-entities-service expects", async () => {
		const vault = makeVault();
		await seedVault({ vaultPath: vault });
		const kv = JSON.parse(readFileSync(notesKvPath(vault), "utf8"));
		for (const [key, value] of Object.entries(kv)) {
			expect(key.startsWith(NOTE_KEY_PREFIX)).toBe(true);
			const note = value as Record<string, unknown>;
			expect(typeof note.id).toBe("string");
			expect(typeof note.title).toBe("string");
			expect(typeof note.createdAt).toBe("number");
			expect(typeof note.updatedAt).toBe("number");
			expect(note.body).toBeDefined();
		}
	});
});
