import { describe, expect, it } from "vitest";
import { entityToCodeFileRow } from "../../../apps/code-editor/src/logic/code-projection.ts";
import { buildReferenceCodeFiles } from "../src/seed/plan-to-codefiles.ts";

describe("buildReferenceCodeFiles", () => {
	const files = buildReferenceCodeFiles();

	it("emits the architectural touchstones with stable ids + content", () => {
		expect(files.map((f) => f.id).sort()).toEqual([
			"capability-check",
			"ipc-envelope",
			"release-anchor",
		]);
		for (const f of files) expect(f.content.length).toBeGreaterThan(40);
	});

	it("each row projects through the real Code-editor entity→row logic", () => {
		for (const f of files) {
			const row = entityToCodeFileRow({
				id: f.id,
				properties: { path: f.path, language: f.language, content: f.content },
			});
			expect(row.content).toBe(f.content);
			expect(row.path).toBe(f.path);
			expect(row.language).not.toBe("unknown");
		}
	});

	it("the release-anchor snippet states the real target date", () => {
		const anchor = files.find((f) => f.id === "release-anchor");
		expect(anchor?.content).toContain("2026-09-01");
		expect(anchor?.content).toContain('RELEASE_VERSION = "0.1.0"');
	});

	it("is deterministic", () => {
		expect(buildReferenceCodeFiles()).toEqual(files);
	});
});
