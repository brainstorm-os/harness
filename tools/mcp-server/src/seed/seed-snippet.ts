/**
 * seed-snippet — extract a plain-text snippet from a seeded
 * `SerializedEditorState`. Used by the seeder to put a real preview into
 * the per-app `kv.json`'s `body` field instead of stuffing the whole
 * serialized state in there. Once the `.ydoc` file owns the rich body,
 * `kv.json.body` is just the sidebar snippet (and the search-fallback
 * index), so a 1-line plain-text walker is exactly enough.
 *
 * Mirrors the renderer-side `extractPlainText` + `clipPlainText`
 * narrowing: depth-first walk over `children`, collect any `text`
 * field, drop into a single space-separated line, cap at
 * `MAX_SNIPPET_CHARS` characters. The walker tolerates unknown node
 * types (block embeds, columns, etc.) by recursing into `.children`
 * regardless of the parent's `type`.
 */

import type { SerializedEditorState } from "lexical";

const MAX_SNIPPET_CHARS = 200;

export function seedBodyToSnippet(state: SerializedEditorState): string {
	const buf: string[] = [];
	walk(state.root as unknown, buf);
	const joined = buf.join(" ").replace(/\s+/g, " ").trim();
	if (joined.length <= MAX_SNIPPET_CHARS) return joined;
	return joined.slice(0, MAX_SNIPPET_CHARS);
}

function walk(node: unknown, out: string[]): void {
	if (!node || typeof node !== "object") return;
	const n = node as { text?: unknown; children?: unknown };
	if (typeof n.text === "string" && n.text.length > 0) out.push(n.text);
	if (Array.isArray(n.children)) {
		for (const c of n.children) walk(c, out);
	}
}
