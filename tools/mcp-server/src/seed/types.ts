/**
 * On-disk shapes the seeder writes into `<vault>/data/apps/<id>/kv.json`.
 * Each shape is a copy of the corresponding app's persisted-protocol record
 * — keep them in lockstep with the apps' own types.
 *
 * The shell-side `vault-entities-service` reads these files; the apps'
 * renderers also read them (Notes via `storage.kv.list`, Database / Graph
 * via `vaultEntities.list`).
 */

export const NOTE_TYPE = "io.brainstorm.notes/Note/v1";
export const NOTE_KEY_PREFIX = "note:";

export const MENTION_NODE_TYPE = "mention";
export const MENTION_NODE_VERSION = 1;

export const TITLE_NODE_TYPE = "title";
export const TITLE_NODE_VERSION = 1;

export type SeedIcon = { kind: "emoji"; value: string };

export type SeedNote = {
	id: string;
	title: string;
	icon: SeedIcon | null;
	body: SeedEditorState;
	values: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
	/** Optional cross-link target for seeded notes that *narrate* a
	 *  source entity (iteration-note → iteration entity, doc-note →
	 *  DesignDoc entity, hub note → Release entity). Drives the
	 *  `Note/about` derived edge on the read side (SH-37). User-
	 *  authored notes leave this unset. */
	aboutEntityId?: string;
};

/** A Lexical SerializedEditorState shape — minimal subset sufficient to
 *  re-hydrate as an editor doc. Mirrors `SerializedEditorState` from
 *  `lexical` but typed locally so the seeder doesn't depend on lexical. */
export type SeedEditorState = {
	root: {
		type: "root";
		version: 1;
		format: "";
		indent: 0;
		direction: null;
		children: SeedBlock[];
	};
};

/** A `listitem` element. `value` is the 1-based ordinal Lexical uses for
 *  ordered-list numbering (and is harmless on bullet lists). */
export type SeedListItem = {
	type: "listitem";
	version: 1;
	format: "";
	indent: 0;
	direction: null;
	value: number;
	children: SeedInline[];
};

export type SeedBlock =
	| {
			type: "paragraph";
			version: 1;
			format: "" | "left";
			indent: 0;
			direction: null;
			children: SeedInline[];
	  }
	| {
			type: "heading";
			version: 1;
			format: "" | "left";
			indent: 0;
			direction: null;
			tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
			children: SeedInline[];
	  }
	| {
			type: "quote";
			version: 1;
			format: "";
			indent: 0;
			direction: null;
			children: SeedInline[];
	  }
	| {
			type: "code";
			version: 1;
			format: "";
			indent: 0;
			direction: null;
			language: string;
			children: SeedInline[];
	  }
	| {
			type: "list";
			version: 1;
			format: "";
			indent: 0;
			direction: null;
			listType: "bullet" | "number";
			start: 1;
			tag: "ul" | "ol";
			children: SeedListItem[];
	  }
	| { type: "horizontalrule"; version: 1 }
	| {
			type: "table";
			version: 1;
			format: "";
			indent: 0;
			direction: null;
			children: SeedTableRow[];
	  }
	| {
			type: typeof TITLE_NODE_TYPE;
			version: typeof TITLE_NODE_VERSION;
			format: "";
			indent: 0;
			direction: null;
			textFormat: 0;
			textStyle: "";
			children: SeedInline[];
	  };

/** A `tablerow` element — children are `tablecell`s. Mirrors
 *  `@lexical/table` `TableRowNode.exportJSON()` for v0.21. */
export type SeedTableRow = {
	type: "tablerow";
	version: 1;
	format: "";
	indent: 0;
	direction: null;
	children: SeedTableCell[];
};

/** A `tablecell` element. `headerState` is the `TableCellHeaderStates`
 *  bitmask (`0` NO_STATUS, `1` ROW, `2` COLUMN, `3` BOTH); seeded GFM
 *  tables only ever use ROW (the first row) or NO_STATUS. Cell content is
 *  block-level (a paragraph), matching `$createTableNodeWithDimensions`.
 *  Mirrors `@lexical/table` `TableCellNode.exportJSON()` for v0.21. */
export type SeedTableCell = {
	type: "tablecell";
	version: 1;
	format: "";
	indent: 0;
	direction: null;
	headerState: 0 | 1 | 2 | 3;
	colSpan: 1;
	rowSpan: 1;
	backgroundColor: null;
	children: SeedBlock[];
};

export type SeedInline =
	| { type: "text"; version: 1; format: 0; mode: "normal"; style: ""; text: string; detail: 0 }
	| { type: "linebreak"; version: 1 }
	| {
			type: typeof MENTION_NODE_TYPE;
			version: typeof MENTION_NODE_VERSION;
			entityId: string;
			entityType: string;
			label: string;
	  };
