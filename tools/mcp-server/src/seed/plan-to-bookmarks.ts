/**
 * Curated external-research bookmarks for the Brainstorm 0.1.0 build
 * (SH-23 per docs/foundations/49-self-hosting.md).
 *
 * Not derived from the docs — these are the canonical external specs the
 * design anchors on, tagged by the subsystem that cites them. Written
 * under the Bookmarks app's `bookmark:<id>` keyspace (same on-disk
 * protocol as `apps/bookmarks/src/storage/codec.ts`). Frozen timestamps +
 * stable ids ⇒ byte-stable re-seed.
 */

export const BOOKMARK_KEY_PREFIX = "bookmark:";

const SAVED_AT = Date.UTC(2026, 4, 14);

export interface SeedBookmarkRow {
	id: string;
	url: string;
	title: string;
	description: string;
	/** 9.18.6 — source site name (the card's "from <site>" label). */
	siteName: string;
	icon: null;
	faviconUrl: null;
	coverImageUrl: null;
	tags: string[];
	savedAt: number;
	readAt: null;
	archivedAt: null;
	colorHint: null;
	createdAt: number;
	updatedAt: number;
}

const SOURCES: Array<{
	id: string;
	url: string;
	title: string;
	description: string;
	siteName: string;
	tags: string[];
}> = [
	{
		id: "block-protocol",
		url: "https://blockprotocol.org/docs",
		title: "Block Protocol — documentation",
		description: "The data-interop protocol Brainstorm anchors its block + entity model on.",
		siteName: "Block Protocol",
		tags: ["block-protocol", "data"],
	},
	{
		id: "yjs",
		url: "https://docs.yjs.dev/",
		title: "Yjs — shared editing CRDT",
		description: "The CRDT library backing collaborative documents + the ydoc worker.",
		siteName: "Yjs",
		tags: ["crdt", "yjs", "sync"],
	},
	{
		id: "lexical",
		url: "https://lexical.dev/docs/intro",
		title: "Lexical — extensible text editor framework",
		description: "The rich-text editor framework brainstorm-editor is built on.",
		siteName: "Lexical",
		tags: ["editor", "lexical"],
	},
	{
		id: "crdt-survey",
		url: "https://crdt.tech/",
		title: "crdt.tech — CRDT resources",
		description: "Background on conflict-free replicated data types for the sync design.",
		siteName: "crdt.tech",
		tags: ["crdt", "sync"],
	},
	{
		id: "electron-security",
		url: "https://www.electronjs.org/docs/latest/tutorial/security",
		title: "Electron — security checklist",
		description: "The hardening baseline for the shell's sandbox + IPC threat model.",
		siteName: "Electron",
		tags: ["security", "shell", "electron"],
	},
	{
		id: "sqlite-fts5",
		url: "https://www.sqlite.org/fts5.html",
		title: "SQLite — FTS5 full-text search",
		description: "The full-text engine behind the global-search index (9.22).",
		siteName: "SQLite",
		tags: ["storage", "search", "sqlite"],
	},
	{
		id: "phosphor-icons",
		url: "https://phosphoricons.com/",
		title: "Phosphor Icons",
		description: "The icon pack the universal-icon system + app glyphs draw from.",
		siteName: "Phosphor Icons",
		tags: ["design-system", "icons"],
	},
	{
		id: "noble-crypto",
		url: "https://paulmillr.com/noble/",
		title: "noble cryptography",
		description: "Audited @noble/* primitives used for identity, DEKs, and credentials.",
		siteName: "noble cryptography",
		tags: ["security", "crypto"],
	},
	{
		id: "mcp-spec",
		url: "https://modelcontextprotocol.io/",
		title: "Model Context Protocol",
		description: "The protocol the dev MCP server speaks to expose plan / OQ / audit state.",
		siteName: "Model Context Protocol",
		tags: ["mcp", "tooling", "self-hosting"],
	},
	{
		id: "wai-aria-apg",
		url: "https://www.w3.org/WAI/ARIA/apg/",
		title: "WAI-ARIA Authoring Practices",
		description: "Accessibility patterns the shell + apps follow for the a11y track.",
		siteName: "W3C WAI",
		tags: ["a11y", "design-system"],
	},
];

export function buildResearchBookmarks(): SeedBookmarkRow[] {
	return SOURCES.map((s) => ({
		id: s.id,
		url: s.url,
		title: s.title,
		description: s.description,
		siteName: s.siteName,
		icon: null,
		faviconUrl: null,
		coverImageUrl: null,
		tags: s.tags,
		savedAt: SAVED_AT,
		readAt: null,
		archivedAt: null,
		colorHint: null,
		createdAt: SAVED_AT,
		updatedAt: SAVED_AT,
	}));
}
