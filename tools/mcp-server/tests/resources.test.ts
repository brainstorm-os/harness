import { describe, expect, it } from "vitest";
import {
	InvalidUri,
	ResourceNotFound,
	ResourceScheme,
	parseUri,
	readResource,
} from "../src/resources.ts";

describe("parseUri", () => {
	it("splits scheme and path", () => {
		expect(parseUri("plan://status")).toEqual({ scheme: ResourceScheme.Plan, path: "status" });
		expect(parseUri("oq://OQ-1")).toEqual({ scheme: ResourceScheme.OQ, path: "OQ-1" });
		expect(parseUri("doc://implementation-plan")).toEqual({
			scheme: ResourceScheme.Doc,
			path: "implementation-plan",
		});
		expect(parseUri("package://@brainstorm/sdk")).toEqual({
			scheme: ResourceScheme.Package,
			path: "@brainstorm/sdk",
		});
	});

	it("rejects malformed URIs", () => {
		expect(() => parseUri("just-text")).toThrow(InvalidUri);
		expect(() => parseUri("unknown://path")).toThrow(InvalidUri);
		expect(() => parseUri("plan://")).toThrow(InvalidUri);
	});
});

describe("readResource — plan", () => {
	it("returns the status snapshot as JSON", () => {
		const result = readResource("plan://status");
		expect(result.mimeType).toBe("application/json");
		const parsed = JSON.parse(result.text);
		expect(parsed.statusSnapshot.length).toBeGreaterThan(0);
	});

	it("returns a specific stage by id", () => {
		const result = readResource("plan://stage/0");
		const parsed = JSON.parse(result.text);
		expect(parsed.stageId).toBe("0");
		expect(parsed.iterations.length).toBeGreaterThan(0);
	});

	it("returns a specific iteration by its lead code", () => {
		// Post-restructure the plan uses ranged bullets (`0.1–0.10`); an
		// iteration is keyed by its lead code. `0.11` is a discrete bullet.
		const result = readResource("plan://iteration/0.11");
		const parsed = JSON.parse(result.text);
		expect(parsed.id).toBe("0.11");
		expect(parsed.stageId).toBe("0");
	});

	it("throws ResourceNotFound for unknown stage", () => {
		expect(() => readResource("plan://stage/99")).toThrow(ResourceNotFound);
	});

	it("throws ResourceNotFound for unknown iteration", () => {
		expect(() => readResource("plan://iteration/99.99")).toThrow(ResourceNotFound);
	});

	it("rejects malformed plan paths", () => {
		expect(() => readResource("plan://gibberish")).toThrow(InvalidUri);
	});
});

describe("readResource — oq", () => {
	it("returns a single OQ", () => {
		const result = readResource("oq://OQ-1");
		const parsed = JSON.parse(result.text);
		expect(parsed.id).toBe("OQ-1");
	});

	it("accepts plain numeric ids and prefixes OQ- itself", () => {
		const result = readResource("oq://1");
		const parsed = JSON.parse(result.text);
		expect(parsed.id).toBe("OQ-1");
	});

	it("throws ResourceNotFound for unknown OQ", () => {
		expect(() => readResource("oq://OQ-99999")).toThrow(ResourceNotFound);
	});
});

describe("readResource — doc", () => {
	it("resolves an exact slug", () => {
		const result = readResource("doc://implementation-plan");
		expect(result.mimeType).toBe("text/markdown");
		expect(result.text).toContain("Implementation plan");
	});

	it("throws ResourceNotFound for a missing slug", () => {
		expect(() => readResource("doc://no-such-doc")).toThrow(ResourceNotFound);
	});
});

describe("readResource — package", () => {
	it("returns workspace package metadata", () => {
		const result = readResource("package://@brainstorm/sdk");
		const parsed = JSON.parse(result.text);
		expect(parsed.package.name).toBe("@brainstorm/sdk");
		expect(parsed.path).toContain("packages/sdk/package.json");
	});

	it("throws ResourceNotFound for a missing package", () => {
		expect(() => readResource("package://@brainstorm/not-real")).toThrow(ResourceNotFound);
	});
});
