import { describe, expect, it } from "vitest";
import { isMeaningfulTitle, parseImplementationLog } from "../src/parse-log.ts";

const SRC = [
	"# Implementation log",
	"",
	"## Stage 0 — Foundations (✅)",
	"",
	"### 0.1 — ✅",
	"",
	"✅. `electron-vite` + Biome + TS strict + React 19 baseline.",
	"",
	"### 0.10 — What's in:",
	"",
	"✅ (2026-05-13). Dev MCP server scaffold at `tools/mcp-server/`. More prose.",
	"",
	"### 1.1 — Bun workspaces",
	"",
	"✅. **Bun workspaces** adopted; placeholder packages stood up.",
	"",
	"## Stage 9 — Apps",
	"",
	"#### 9.22.4 — Settings → Search index panel",
	"",
	"✅ DONE (2026-05-17). **A diagnostic + manual-maintenance surface for the index.** Long narrative…",
	"",
	"#### Database Filter v2.1b — nested filter groups",
	"",
	"✅ DONE (2026-05-16). **Recursive AND/OR tree.**",
	"",
].join("\n");

describe("parseImplementationLog", () => {
	const idx = parseImplementationLog(SRC);

	it("recovers a title from the body when the heading stub is just a status glyph", () => {
		expect(idx.get("0.1")?.title).toBe("electron-vite + Biome + TS strict + React 19 baseline");
	});

	it("recovers a title from the body when the stub is a label fragment ('What's in:')", () => {
		expect(idx.get("0.10")?.title).toBe("Dev MCP server scaffold at tools/mcp-server/");
	});

	it("keeps a meaningful heading stub verbatim", () => {
		expect(idx.get("1.1")?.title).toBe("Bun workspaces");
		expect(idx.get("9.22.4")?.title).toBe("Settings → Search index panel");
	});

	it("recovers the body summary (status prefix + markdown stripped)", () => {
		expect(idx.get("0.1")?.summary).toBe("electron-vite + Biome + TS strict + React 19 baseline.");
		expect(idx.get("9.22.4")?.summary).toBe(
			"A diagnostic + manual-maintenance surface for the index. Long narrative…",
		);
		// Heading present but the stub is the only content → still no entry
		// crash; summary is null when there's no body paragraph.
		const noBody = parseImplementationLog("### 5.1 — Thing\n");
		expect(noBody.get("5.1")?.summary).toBeNull();
	});

	it("extracts the ship date from the status prefix, null when absent", () => {
		expect(idx.get("0.10")?.completedAt).toBe(Date.UTC(2026, 4, 13));
		expect(idx.get("9.22.4")?.completedAt).toBe(Date.UTC(2026, 4, 17));
		expect(idx.get("0.1")?.completedAt).toBeNull();
	});

	it("indexes non-iteration headings without colliding with numeric codes", () => {
		expect(idx.get("Database Filter v2.1b")?.title).toBe("nested filter groups");
		expect(idx.has("9.22.4")).toBe(true);
	});

	it("a date deep in prose is not mistaken for the ship date", () => {
		const one = parseImplementationLog(
			["### 7.1 — Thing", "", "✅. Shipped. Note: see the 2025-01-01 spec."].join("\n"),
		);
		expect(one.get("7.1")?.completedAt).toBeNull();
	});
});

describe("isMeaningfulTitle", () => {
	it("accepts real phrases", () => {
		expect(isMeaningfulTitle("Bun workspaces")).toBe(true);
		expect(isMeaningfulTitle("Settings → Search index panel")).toBe(true);
	});
	it("rejects glyphs, labels, sizes, and bare status words", () => {
		expect(isMeaningfulTitle("✅")).toBe(false);
		expect(isMeaningfulTitle("What's in:")).toBe(false);
		expect(isMeaningfulTitle("100.05 KB gz")).toBe(false);
		expect(isMeaningfulTitle("DONE")).toBe(false);
		expect(isMeaningfulTitle("")).toBe(false);
	});
});
