import { describe, expect, it } from "vitest";
import {
	EMPTY_WIKILINK_RESOLVER,
	parseInlineWithMentions,
	stripWikilinkBrackets,
} from "../src/seed/wikilinks.ts";

const ENTITY_TYPE = "io.brainstorm.notes/Note/v1";

const fixedResolver = (slug: string) => {
	if (slug.toLowerCase() === "9.14.1") {
		return {
			entityId: "iteration-9-14-1",
			entityType: ENTITY_TYPE,
			label: "9.14.1 — App scaffold",
		};
	}
	if (slug.toLowerCase() === "oq-228") {
		return {
			entityId: "oq-oq-228",
			entityType: "brainstorm/OpenQuestion/v1",
			label: "OQ-228 — Sync soak",
		};
	}
	return null;
};

describe("parseInlineWithMentions", () => {
	it("returns an empty array for empty input", () => {
		expect(parseInlineWithMentions("", fixedResolver)).toEqual([]);
	});

	it("returns a single text node when no wikilinks are present", () => {
		const out = parseInlineWithMentions("plain prose with no links", fixedResolver);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ type: "text", text: "plain prose with no links" });
	});

	it("emits a mention node for a resolved wikilink and text for the surrounding prose", () => {
		const out = parseInlineWithMentions("Shipped [[9.14.1]] today.", fixedResolver);
		expect(out).toHaveLength(3);
		expect(out[0]).toMatchObject({ type: "text", text: "Shipped " });
		expect(out[1]).toMatchObject({
			type: "mention",
			entityId: "iteration-9-14-1",
			entityType: ENTITY_TYPE,
			label: "9.14.1 — App scaffold",
		});
		expect(out[2]).toMatchObject({ type: "text", text: " today." });
	});

	it("uses the explicit pipe-label when present", () => {
		const out = parseInlineWithMentions("See [[9.14.1|the scaffold work]] above.", fixedResolver);
		expect(out[1]).toMatchObject({ type: "mention", label: "the scaffold work" });
	});

	it("strips brackets to plain text for unresolved memory-style wikilinks", () => {
		const out = parseInlineWithMentions(
			"Per [[feedback_serial_shell_then_apps]] note.",
			fixedResolver,
		);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			type: "text",
			text: "Per feedback_serial_shell_then_apps note.",
		});
	});

	it("honours pipe-label for unresolved wikilinks too", () => {
		const out = parseInlineWithMentions("Per [[some-memory|that memory]] note.", fixedResolver);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ type: "text", text: "Per that memory note." });
	});

	it("handles multiple wikilinks in one string and coalesces text runs", () => {
		const out = parseInlineWithMentions(
			"Closed [[9.14.1]] and resolved [[OQ-228]]; see [[memory_x]] for context.",
			fixedResolver,
		);
		expect(out.map((n) => n.type)).toEqual(["text", "mention", "text", "mention", "text"]);
		expect(out[0]).toMatchObject({ text: "Closed " });
		expect(out[2]).toMatchObject({ text: " and resolved " });
		expect(out[4]).toMatchObject({ text: "; see memory_x for context." });
	});

	it("the empty resolver collapses every wikilink to plain text", () => {
		const out = parseInlineWithMentions("See [[9.14.1]] and [[OQ-228]].", EMPTY_WIKILINK_RESOLVER);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ type: "text", text: "See 9.14.1 and OQ-228." });
	});

	it("does not greedy-match across multiple bracket pairs", () => {
		const out = parseInlineWithMentions("[[9.14.1]] then [[OQ-228]]", fixedResolver);
		expect(out).toHaveLength(3);
		expect(out[0]).toMatchObject({ type: "mention", entityId: "iteration-9-14-1" });
		expect(out[1]).toMatchObject({ type: "text", text: " then " });
		expect(out[2]).toMatchObject({ type: "mention", entityId: "oq-oq-228" });
	});

	it("leaves malformed empty `[[]]` brackets as-is (no slug to resolve)", () => {
		const out = parseInlineWithMentions("noise [[]] tail", fixedResolver);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ type: "text", text: "noise [[]] tail" });
	});
});

describe("stripWikilinkBrackets", () => {
	it("returns the input unchanged when no wikilinks are present", () => {
		expect(stripWikilinkBrackets("plain title")).toBe("plain title");
	});

	it("strips a single wikilink to its slug", () => {
		expect(stripWikilinkBrackets("App scaffold per [[app-scaffold-pattern]]")).toBe(
			"App scaffold per app-scaffold-pattern",
		);
	});

	it("honours the pipe-label override", () => {
		expect(stripWikilinkBrackets("See [[9.14.1|the scaffold]] above")).toBe("See the scaffold above");
	});

	it("strips every occurrence", () => {
		expect(stripWikilinkBrackets("[[a]] and [[b]] and [[c]]")).toBe("a and b and c");
	});
});
