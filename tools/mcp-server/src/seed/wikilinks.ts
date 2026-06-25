/**
 * Shared inline parser for `[[wikilink]]` patterns in seeded text.
 *
 * The implementation log uses Obsidian-style `[[slug]]` references heavily
 * (memory-file pointers, cross-iteration references, OQ pointers). When the
 * journal / iteration-note seeders splat that text through plain paragraphs,
 * the brackets leak straight into the rendered editor view — the rendered
 * output reads "App scaffold per [[app-scaffold-pattern]]" instead of a real
 * link or clean prose.
 *
 * This module is the one place that handles them. Given a resolver mapping
 * slugs to vault entities, it walks one string and emits a `SeedInline[]`
 * with `MentionNode` chips for resolved targets and bracket-stripped plain
 * text for the rest (memory references that don't correspond to any vault
 * entity collapse to a clean label, never a literal `[[...]]`).
 *
 * Supported forms — both Obsidian-shaped:
 *   `[[slug]]`        — resolve `slug`, label falls back to `slug`
 *   `[[slug|label]]`  — resolve `slug`, label overridden by the explicit pipe
 *
 * Pure + deterministic.
 */

import { MENTION_NODE_TYPE, MENTION_NODE_VERSION, type SeedInline } from "./types.ts";

export interface WikilinkTarget {
	entityId: string;
	entityType: string;
	/** Fallback display label when the wikilink omits a `|label` override. */
	label: string;
}

export type WikilinkResolver = (slug: string) => WikilinkTarget | null;

/** A resolver that never resolves — all wikilinks collapse to plain text.
 *  Used when a seed builder is called outside the project seeder (e.g. a
 *  unit test that supplies its own fixture iterations). */
export const EMPTY_WIKILINK_RESOLVER: WikilinkResolver = () => null;

const WIKILINK_RE = /\[\[([^\[\]]+?)\]\]/g;

/** Produce a `text` inline node — duplicated from `docs-to-notes.ts` so this
 *  module has no upstream import (would loop back through the seeders). */
function textInline(value: string): SeedInline {
	return { type: "text", version: 1, format: 0, mode: "normal", style: "", text: value, detail: 0 };
}

function mentionInline(target: WikilinkTarget, label: string): SeedInline {
	return {
		type: MENTION_NODE_TYPE,
		version: MENTION_NODE_VERSION,
		entityId: target.entityId,
		entityType: target.entityType,
		label,
	};
}

/**
 * Parse `text` into a `SeedInline[]`, replacing `[[X]]` / `[[X|label]]`
 * with `MentionNode`s when `resolver(X)` returns a target, and with plain
 * text (label only, no brackets) when it doesn't.
 *
 * Adjacent text runs are coalesced into a single text node so the output
 * has no zero-length or back-to-back text fragments. Returns an empty
 * array for empty / whitespace-only input.
 */
export function parseInlineWithMentions(
	text: string,
	resolver: WikilinkResolver = EMPTY_WIKILINK_RESOLVER,
): SeedInline[] {
	if (text.length === 0) return [];
	const out: SeedInline[] = [];
	let buf = "";
	let lastIndex = 0;
	const flushBuf = () => {
		if (buf.length > 0) {
			out.push(textInline(buf));
			buf = "";
		}
	};

	WIKILINK_RE.lastIndex = 0;
	for (let m = WIKILINK_RE.exec(text); m !== null; m = WIKILINK_RE.exec(text)) {
		const between = text.slice(lastIndex, m.index);
		buf += between;
		const inner = (m[1] ?? "").trim();
		const pipe = inner.indexOf("|");
		const slug = pipe === -1 ? inner : inner.slice(0, pipe).trim();
		const explicit = pipe === -1 ? null : inner.slice(pipe + 1).trim();
		const target = slug.length > 0 ? resolver(slug) : null;
		if (target) {
			const label = explicit && explicit.length > 0 ? explicit : target.label;
			flushBuf();
			out.push(mentionInline(target, label));
		} else {
			// No match — drop the brackets and inline the label so the prose
			// reads cleanly. Memory-file references (`feedback_x`, `project_y`)
			// land in this branch and become plain text.
			buf += explicit && explicit.length > 0 ? explicit : slug;
		}
		lastIndex = m.index + m[0].length;
	}
	buf += text.slice(lastIndex);
	flushBuf();
	return out;
}

/** Strip `[[wikilink]]` markup from a string, replacing each occurrence
 *  with its label (the `|label` override when present, else the slug).
 *  Used for fields that must stay plain text — note titles, snippets, the
 *  Notes-app list sidebar — where mention chips would not render. */
export function stripWikilinkBrackets(text: string): string {
	return text.replace(WIKILINK_RE, (_match, inner: string) => {
		const i = inner.indexOf("|");
		return (i === -1 ? inner : inner.slice(i + 1)).trim();
	});
}
