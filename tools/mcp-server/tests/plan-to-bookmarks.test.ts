import { describe, expect, it } from "vitest";
import { parseStoredBookmark } from "../../../apps/bookmarks/src/storage/codec.ts";
import { buildResearchBookmarks } from "../src/seed/plan-to-bookmarks.ts";

describe("buildResearchBookmarks", () => {
	const rows = buildResearchBookmarks();

	it("emits a curated, non-trivial set with stable ids", () => {
		expect(rows.length).toBeGreaterThanOrEqual(10);
		expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
		expect(rows.find((r) => r.id === "block-protocol")).toBeDefined();
		expect(rows.find((r) => r.id === "yjs")).toBeDefined();
	});

	it("every row round-trips through the real Bookmarks codec", () => {
		for (const r of rows) {
			const parsed = parseStoredBookmark(r);
			expect(parsed).not.toBeNull();
			expect(parsed?.url.startsWith("https://")).toBe(true);
			expect(parsed?.tags.length).toBeGreaterThan(0);
		}
	});

	it("carries a source site name (9.18.6) that survives the codec round-trip", () => {
		for (const r of rows) {
			expect(r.siteName.length).toBeGreaterThan(0);
			expect(parseStoredBookmark(r)?.siteName).toBe(r.siteName);
		}
	});

	it("is deterministic", () => {
		expect(buildResearchBookmarks()).toEqual(rows);
	});
});
