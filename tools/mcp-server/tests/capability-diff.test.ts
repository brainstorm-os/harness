/**
 * Stage 0.11 — `capability.diff` unit tests over synthetic manifest
 * snapshots. Covers the four diff classes (added / removed / narrowed
 * / widened) end-to-end plus the per-app rollup, the scope-breadth
 * comparator, and the `parseCapability` / `formatCapability` pair
 * (kept symmetric with `main/capabilities/ledger.ts`'s `parseCapability`).
 */

import { describe, expect, it } from "vitest";
import {
	type ManifestSnapshot,
	compareScopeBreadth,
	diffCapabilitySurface,
	formatCapability,
	manifestsToSurfaces,
	parseCapability,
} from "../src/tools/capability-diff.ts";

const m = (id: string, capabilities: readonly string[]): ManifestSnapshot => ({
	id,
	capabilities,
});

describe("parseCapability / formatCapability", () => {
	it("splits `service.verb:scope` into the three parts", () => {
		expect(parseCapability("entities.read:io.brainstorm.notes/Note/v1")).toEqual({
			capability: "entities.read",
			scope: "io.brainstorm.notes/Note/v1",
		});
		expect(parseCapability("intents.dispatch:open")).toEqual({
			capability: "intents.dispatch",
			scope: "open",
		});
	});

	it("returns `scope = null` for an unscoped cap", () => {
		expect(parseCapability("storage.kv")).toEqual({ capability: "storage.kv", scope: null });
	});

	it("preserves the `*` wildcard as the scope string", () => {
		expect(parseCapability("entities.read:*")).toEqual({
			capability: "entities.read",
			scope: "*",
		});
	});

	it("formatCapability is the symmetric inverse", () => {
		for (const raw of [
			"storage.kv",
			"entities.read:*",
			"entities.read:io.brainstorm.notes/Note/v1",
			"intents.dispatch:open",
		]) {
			expect(formatCapability(parseCapability(raw))).toBe(raw);
		}
	});
});

describe("compareScopeBreadth", () => {
	it("treats `null` and `*` as equally broad", () => {
		expect(compareScopeBreadth(null, "*")).toBe(0);
		expect(compareScopeBreadth("*", null)).toBe(0);
		expect(compareScopeBreadth(null, null)).toBe(0);
		expect(compareScopeBreadth("*", "*")).toBe(0);
	});

	it("treats a wildcard side as wider than a specific scope", () => {
		expect(compareScopeBreadth(null, "open")).toBe(1);
		expect(compareScopeBreadth("*", "open")).toBe(1);
		expect(compareScopeBreadth("open", null)).toBe(-1);
		expect(compareScopeBreadth("open", "*")).toBe(-1);
	});

	it("treats two distinct specifics as non-comparable (null)", () => {
		expect(compareScopeBreadth("open", "share")).toBeNull();
	});

	it("treats two identical specifics as equal", () => {
		expect(compareScopeBreadth("open", "open")).toBe(0);
	});
});

describe("manifestsToSurfaces", () => {
	it("flattens (manifest -> [...caps]) into the per-app CapSurface list", () => {
		const out = manifestsToSurfaces([
			m("a", ["storage.kv", "entities.read:Note/v1"]),
			m("b", ["intents.dispatch:open"]),
		]);
		expect(out).toEqual([
			{ appId: "a", capability: "storage.kv", scope: null },
			{ appId: "a", capability: "entities.read", scope: "Note/v1" },
			{ appId: "b", capability: "intents.dispatch", scope: "open" },
		]);
	});

	it("tolerates a manifest with no capabilities array (legacy / empty)", () => {
		expect(manifestsToSurfaces([{ id: "x" }])).toEqual([]);
		expect(manifestsToSurfaces([{ id: "y", capabilities: [] }])).toEqual([]);
	});

	it("skips non-string entries (malformed manifest tolerated)", () => {
		// Cast through unknown to plant a bad row without losing
		// type-checking on the rest of the surface.
		const bad = m("a", ["storage.kv", "", null as unknown as string, 42 as unknown as string]);
		expect(manifestsToSurfaces([bad])).toEqual([
			{ appId: "a", capability: "storage.kv", scope: null },
		]);
	});
});

describe("diffCapabilitySurface — added / removed", () => {
	it("flags a brand-new capability declaration as `added`", () => {
		const d = diffCapabilitySurface(
			[m("a", ["storage.kv"])],
			[m("a", ["storage.kv", "intents.dispatch:open"])],
		);
		expect(d.added).toEqual([{ appId: "a", capability: "intents.dispatch", scope: "open" }]);
		expect(d.removed).toEqual([]);
		expect(d.narrowed).toEqual([]);
		expect(d.widened).toEqual([]);
	});

	it("flags a dropped capability declaration as `removed`", () => {
		const d = diffCapabilitySurface(
			[m("a", ["storage.kv", "intents.dispatch:open"])],
			[m("a", ["storage.kv"])],
		);
		expect(d.removed).toEqual([{ appId: "a", capability: "intents.dispatch", scope: "open" }]);
		expect(d.added).toEqual([]);
	});

	it("a brand-new app is reported via every cap as `added`", () => {
		const d = diffCapabilitySurface(
			[m("a", ["storage.kv"])],
			[m("a", ["storage.kv"]), m("b", ["entities.read:*", "intents.dispatch:open"])],
		);
		expect(d.added).toEqual([
			{ appId: "b", capability: "entities.read", scope: "*" },
			{ appId: "b", capability: "intents.dispatch", scope: "open" },
		]);
	});

	it("swapping a specific scope for a different specific is added+removed (not narrow/widen)", () => {
		const d = diffCapabilitySurface(
			[m("a", ["entities.read:Note/v1"])],
			[m("a", ["entities.read:Folder/v1"])],
		);
		expect(d.removed).toEqual([{ appId: "a", capability: "entities.read", scope: "Note/v1" }]);
		expect(d.added).toEqual([{ appId: "a", capability: "entities.read", scope: "Folder/v1" }]);
		expect(d.narrowed).toEqual([]);
		expect(d.widened).toEqual([]);
	});
});

describe("diffCapabilitySurface — narrowed / widened", () => {
	it("flags `intents.dispatch` → `intents.dispatch:open` as narrowed", () => {
		const d = diffCapabilitySurface(
			[m("a", ["intents.dispatch"])],
			[m("a", ["intents.dispatch:open"])],
		);
		expect(d.narrowed).toEqual([
			{
				appId: "a",
				capability: "intents.dispatch",
				beforeScope: null,
				afterScope: "open",
			},
		]);
		expect(d.added).toEqual([]);
		expect(d.removed).toEqual([]);
	});

	it("flags `intents.dispatch:open` → `intents.dispatch` as widened", () => {
		const d = diffCapabilitySurface(
			[m("a", ["intents.dispatch:open"])],
			[m("a", ["intents.dispatch"])],
		);
		expect(d.widened).toEqual([
			{
				appId: "a",
				capability: "intents.dispatch",
				beforeScope: "open",
				afterScope: null,
			},
		]);
	});

	it("flags `entities.read:Note/v1` → `entities.read:*` as widened", () => {
		const d = diffCapabilitySurface(
			[m("a", ["entities.read:Note/v1"])],
			[m("a", ["entities.read:*"])],
		);
		expect(d.widened).toEqual([
			{
				appId: "a",
				capability: "entities.read",
				beforeScope: "Note/v1",
				afterScope: "*",
			},
		]);
	});

	it("treats `null` ↔ `*` as a no-op (both wildcard)", () => {
		const d = diffCapabilitySurface([m("a", ["entities.read"])], [m("a", ["entities.read:*"])]);
		expect(d.added).toEqual([]);
		expect(d.removed).toEqual([]);
		expect(d.narrowed).toEqual([]);
		expect(d.widened).toEqual([]);
	});
});

describe("diffCapabilitySurface — byApp rollup", () => {
	it("groups added/removed/narrowed/widened by appId", () => {
		const before = [m("a", ["storage.kv", "intents.dispatch:open"]), m("b", ["entities.read:*"])];
		const after = [
			m("a", ["storage.kv", "intents.dispatch"]),
			m("b", ["entities.read:Note/v1", "intents.dispatch:open"]),
		];
		const d = diffCapabilitySurface(before, after);

		expect(d.byApp.a).toBeDefined();
		expect(d.byApp.a?.widened).toHaveLength(1);
		expect(d.byApp.a?.added).toEqual([]);

		expect(d.byApp.b).toBeDefined();
		expect(d.byApp.b?.narrowed).toHaveLength(1);
		expect(d.byApp.b?.added).toEqual([{ appId: "b", capability: "intents.dispatch", scope: "open" }]);
	});

	it("apps with no diff don't appear in byApp", () => {
		const d = diffCapabilitySurface(
			[m("a", ["storage.kv"]), m("b", ["entities.read:*"])],
			[m("a", ["storage.kv", "intents.dispatch:open"]), m("b", ["entities.read:*"])],
		);
		expect(Object.keys(d.byApp).sort()).toEqual(["a"]);
	});
});

describe("diffCapabilitySurface — multi-scope-on-one-side fallback", () => {
	it("when before has 2 scopes for same cap and after has 1, diff stays in added/removed", () => {
		const d = diffCapabilitySurface(
			[m("a", ["entities.read:Note/v1", "entities.read:Folder/v1"])],
			[m("a", ["entities.read:*"])],
		);
		// Multi-scope-on-one-side fallback: every removed surface is
		// reported, the surviving one is treated as added.
		expect(d.removed).toContainEqual({
			appId: "a",
			capability: "entities.read",
			scope: "Note/v1",
		});
		expect(d.removed).toContainEqual({
			appId: "a",
			capability: "entities.read",
			scope: "Folder/v1",
		});
		expect(d.added).toEqual([{ appId: "a", capability: "entities.read", scope: "*" }]);
	});
});

describe("diffCapabilitySurface — no-op", () => {
	it("identical snapshots produce zero changes", () => {
		const snap = [m("a", ["storage.kv", "entities.read:*", "intents.dispatch:open"])];
		const d = diffCapabilitySurface(snap, snap);
		expect(d.added).toEqual([]);
		expect(d.removed).toEqual([]);
		expect(d.narrowed).toEqual([]);
		expect(d.widened).toEqual([]);
		expect(d.byApp).toEqual({});
	});
});
