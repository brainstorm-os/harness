/**
 * Seed-cli node set for the headless Lexical plant.
 *
 * The custom stand-in classes (title / mention / horizontalrule) now live in
 * `@brainstorm/editor` (`SEED_STANDIN_NODES`) so the shell's Welcome-1 starter
 * seeder and this dev-vault seeder share one definition — see that module's
 * header for the stand-in contract. This file only composes the seed-cli's
 * full set: the shared stand-ins + `@lexical/table`'s real node classes (the
 * seed-cli emits tables; the shell Welcome seeder does not).
 *
 * Keep in lockstep with `apps/notes/src/editor/notes-nodes.ts`
 * `NOTES_ADDITIONAL_NODES` — any node a seeder emits must be registered here.
 */

import { SEED_STANDIN_NODES } from "@brainstorm/editor";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import type { LexicalNode } from "lexical";

export {
	SEED_STANDIN_NODES,
	SeedHorizontalRuleNode,
	SeedMentionNode,
	SeedTitleNode,
	type SerializedSeedMentionNode,
} from "@brainstorm/editor";

/** Pass to `plantSerializedStateIntoDoc({ nodes: SEEDER_EXTRA_NODES })` —
 *  alongside `BASELINE_NODES` from `@brainstorm/editor`, this is the
 *  complete node set the seeder needs to plant every body shape it
 *  produces (iteration / docs / feature-article / hub / journal). */
export const SEEDER_EXTRA_NODES = [
	...SEED_STANDIN_NODES,
	TableNode,
	TableRowNode,
	TableCellNode,
] as const satisfies ReadonlyArray<new (...args: never[]) => LexicalNode>;
