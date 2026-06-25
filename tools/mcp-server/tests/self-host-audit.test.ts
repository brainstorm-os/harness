/**
 * SH-26 — end-to-end self-host audit.
 *
 * Seeds the full `BrainstormProject` scope into a throwaway vault from
 * the REAL repo sources and asserts every first-party app surface is
 * populated, the round-trip is byte-stable across every Arm C mapper,
 * and Preview's role (open-intent on a `.md` DesignDoc) is wired.
 */

import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SeedMode, SeedScope, seedVault } from "../src/seed/seeder.ts";

const PREVIEW_MANIFEST = JSON.parse(
	readFileSync(join(process.cwd(), "apps/preview/manifest.json"), "utf8"),
) as { registrations?: { openers?: Array<{ mime?: string }> } };

function kv(vault: string, appId: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(vault, "data", "apps", appId, "kv.json"), "utf8")) as Record<
		string,
		unknown
	>;
}

describe("self-host end-to-end audit (SH-26)", () => {
	let vault: string;

	beforeAll(() => {
		vault = mkdtempSync(join(tmpdir(), "bs-selfhost-"));
		seedVault({ vaultPath: vault, scopes: [SeedScope.BrainstormProject], mode: SeedMode.Replace });
	});
	afterAll(() => rmSync(vault, { recursive: true, force: true }));

	it("populates every first-party app surface from the real plan", () => {
		const self = kv(vault, "io.brainstorm.self-hosting");
		const keys = Object.keys(self);
		for (const p of [
			"iteration:",
			"stage:",
			"open-question:",
			"release:",
			"milestone:",
			"design-doc:",
			"folder:",
			"code-file:",
		]) {
			expect(keys.some((k) => k.startsWith(p))).toBe(true);
		}
		expect(self["release:release-0-1-0"]).toBeDefined();

		const tasks = kv(vault, "io.brainstorm.tasks");
		expect(Object.keys(tasks).some((k) => k === "project:proj-release")).toBe(true);
		expect(Object.keys(tasks).some((k) => k.startsWith("task:"))).toBe(true);

		expect(kv(vault, "io.brainstorm.database")["database:state"]).toBeDefined();
		expect(kv(vault, "io.brainstorm.graph")["graph:state"]).toBeDefined();

		const cal = kv(vault, "io.brainstorm.calendar");
		expect(Object.keys(cal).some((k) => k === "event:event-milestone-ga")).toBe(true);

		const wb = kv(vault, "io.brainstorm.whiteboard");
		expect(wb["whiteboard:roadmap"]).toBeDefined();
		expect(Object.keys(wb).some((k) => k.startsWith("whiteboard-edge:"))).toBe(true);

		const bm = kv(vault, "io.brainstorm.bookmarks");
		expect(Object.keys(bm).some((k) => k === "bookmark:block-protocol")).toBe(true);

		const notes = kv(vault, "io.brainstorm.notes");
		expect(notes["note:release-hub"]).toBeDefined();
		expect(Object.keys(notes).some((k) => k.startsWith("note:journal-"))).toBe(true);
		expect(Object.keys(notes).some((k) => k.startsWith("note:doc-"))).toBe(true);
	});

	it("Preview's role is wired: a markdown opener + .md DesignDoc targets", () => {
		const hasMarkdownOpener = (PREVIEW_MANIFEST.registrations?.openers ?? []).some(
			(o) => o.mime === "text/markdown",
		);
		expect(hasMarkdownOpener).toBe(true);
		const self = kv(vault, "io.brainstorm.self-hosting");
		const designDocs = Object.entries(self)
			.filter(([k]) => k.startsWith("design-doc:"))
			.map(([, v]) => v as { path?: string });
		expect(designDocs.length).toBeGreaterThan(0);
		expect(designDocs.every((d) => typeof d.path === "string" && d.path.endsWith(".md"))).toBe(true);
	});

	it("round-trips byte-for-byte across every mapper", () => {
		const v2 = mkdtempSync(join(tmpdir(), "bs-selfhost2-"));
		try {
			seedVault({ vaultPath: v2, scopes: [SeedScope.BrainstormProject], mode: SeedMode.Replace });
			for (const appId of [
				"io.brainstorm.self-hosting",
				"io.brainstorm.tasks",
				"io.brainstorm.database",
				"io.brainstorm.graph",
				"io.brainstorm.calendar",
				"io.brainstorm.whiteboard",
				"io.brainstorm.bookmarks",
				"io.brainstorm.notes",
			]) {
				const a = readFileSync(join(vault, "data", "apps", appId, "kv.json"), "utf8");
				const b = readFileSync(join(v2, "data", "apps", appId, "kv.json"), "utf8");
				expect(b).toBe(a);
			}
		} finally {
			rmSync(v2, { recursive: true, force: true });
		}
	});
});
