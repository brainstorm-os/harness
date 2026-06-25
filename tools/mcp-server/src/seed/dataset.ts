import { MENTION_NODE_TYPE, MENTION_NODE_VERSION, NOTE_TYPE, type SeedNote } from "./types.ts";

/**
 * Hand-authored demo dataset. Stable note ids — re-running the seeder
 * overwrites the previous copy rather than appending duplicates.
 *
 * The note bodies use the Lexical `SerializedEditorState` shape directly
 * (so Lexical re-hydrates them as a real document) and embed `mention`
 * inlines that cross-reference each other by id. Those mentions are what
 * the shell-side `extractNoteReferences` walker picks up to emit
 * `io.brainstorm.notes/mention` links in the vault snapshot.
 *
 * The dataset deliberately spans multiple topic clusters so the Graph app
 * has visible structure (not one big hairball, not a long chain).
 */

const NOW = new Date("2026-05-13T10:00:00Z").getTime();
const DAY = 24 * 3600 * 1000;

/**
 * Title lookup used by `toInline()` when building mention nodes. Declared
 * before the dataset itself so `mention("n_apollo")` resolves its display
 * label even though it appears inside the same module-level array literal.
 */
const TITLES: Record<string, string> = {
	n_apollo: "Project Apollo",
	n_dana: "Dana Park",
	n_kai: "Kai Tanaka",
	n_mira: "Mira Singh",
	"n_q2-milestones": "Q2 Milestones",
	n_architecture: "Architecture review",
	"n_perf-budget": "Performance budgets",
	"n_design-audit": "Design-system audit",
	"n_research-log": "Research log",
	n_inbox: "Inbox",
};

export function buildDemoNotes(): SeedNote[] {
	return DEMO_NOTES.map((note) => withBackrefs(note));
}

const DEMO_NOTES: SeedNote[] = [
	makeNote({
		id: "n_apollo",
		title: "Project Apollo",
		icon: { kind: "emoji", value: "🚀" },
		days: 21,
		body: paragraphs(
			["Apollo is the platform rebuild — owned by ", mention("n_dana"), "."],
			["Q2 milestones tracked in ", mention("n_q2-milestones"), "."],
			["Architecture review notes in ", mention("n_architecture"), "."],
		),
	}),
	makeNote({
		id: "n_dana",
		title: "Dana Park",
		icon: { kind: "emoji", value: "👤" },
		days: 90,
		body: paragraphs(
			["Engineering manager for ", mention("n_apollo"), "."],
			["Frequent collaborator with ", mention("n_kai"), " and ", mention("n_mira"), "."],
		),
	}),
	makeNote({
		id: "n_kai",
		title: "Kai Tanaka",
		icon: { kind: "emoji", value: "👤" },
		days: 85,
		body: paragraphs(
			["Lead engineer on storage. Reports to ", mention("n_dana"), "."],
			["Currently digging into ", mention("n_perf-budget"), "."],
		),
	}),
	makeNote({
		id: "n_mira",
		title: "Mira Singh",
		icon: { kind: "emoji", value: "👤" },
		days: 70,
		body: paragraphs(
			["Design lead. Partnered with ", mention("n_dana"), " on ", mention("n_apollo"), "."],
			["Owns the design-system audit — see ", mention("n_design-audit"), "."],
		),
	}),
	makeNote({
		id: "n_q2-milestones",
		title: "Q2 Milestones",
		icon: { kind: "emoji", value: "🎯" },
		days: 14,
		body: paragraphs(
			[
				"Two big rocks for Q2: ship ",
				mention("n_apollo"),
				" beta, finish ",
				mention("n_design-audit"),
				".",
			],
			["Supporting work: tighten ", mention("n_perf-budget"), "."],
		),
	}),
	makeNote({
		id: "n_architecture",
		title: "Architecture review",
		icon: { kind: "emoji", value: "🏛️" },
		days: 7,
		body: paragraphs(
			[
				"Three-layer model (apps / shell / core services). See ",
				mention("n_apollo"),
				" for the rollout.",
			],
			["Capability ledger is non-negotiable — flagged by ", mention("n_kai"), "."],
		),
	}),
	makeNote({
		id: "n_perf-budget",
		title: "Performance budgets",
		icon: { kind: "emoji", value: "⚡" },
		days: 5,
		body: paragraphs(
			[
				"Per-bundle ceilings tracked via size-limit. Discussion thread: ",
				mention("n_architecture"),
				".",
			],
			["Reviewer: ", mention("n_kai"), "."],
		),
	}),
	makeNote({
		id: "n_design-audit",
		title: "Design-system audit",
		icon: { kind: "emoji", value: "🎨" },
		days: 12,
		body: paragraphs(
			["Three pillars: tokens, components, icons. Owner: ", mention("n_mira"), "."],
			["Cross-cutting with ", mention("n_apollo"), "."],
		),
	}),
	makeNote({
		id: "n_research-log",
		title: "Research log",
		icon: { kind: "emoji", value: "🔬" },
		days: 30,
		body: paragraphs(
			["Standing log of experiments. References ", mention("n_apollo"), " when relevant."],
			["Latest: zero-copy snapshot loader, +30% reads."],
		),
	}),
	makeNote({
		id: "n_inbox",
		title: "Inbox",
		icon: { kind: "emoji", value: "📥" },
		days: 1,
		body: paragraphs(
			["Quick capture. Triage daily."],
			["Pending: pair with ", mention("n_kai"), " on ", mention("n_perf-budget"), "."],
		),
	}),
];

type MakeNoteArgs = {
	id: string;
	title: string;
	icon: SeedNote["icon"];
	body: SeedNote["body"];
	days: number;
};

function makeNote({ id, title, icon, body, days }: MakeNoteArgs): SeedNote {
	const createdAt = NOW - days * DAY;
	const updatedAt = NOW - Math.floor(days / 2) * DAY;
	return {
		id,
		title,
		icon,
		body,
		values: {},
		createdAt,
		updatedAt,
	};
}

function paragraphs(...rows: Array<Array<string | SeedMention>>): SeedNote["body"] {
	return {
		root: {
			type: "root",
			version: 1,
			format: "",
			indent: 0,
			direction: null,
			children: rows.map((row) => ({
				type: "paragraph",
				version: 1,
				format: "",
				indent: 0,
				direction: null,
				children: row.map(toInline),
			})),
		},
	};
}

type SeedMention = { __mention: true; entityId: string };

function mention(entityId: string): SeedMention {
	return { __mention: true, entityId };
}

function toInline(
	piece: string | SeedMention,
): SeedNote["body"]["root"]["children"][number]["children"][number] {
	if (typeof piece === "string") {
		return {
			type: "text",
			version: 1,
			format: 0,
			mode: "normal",
			style: "",
			text: piece,
			detail: 0,
		};
	}
	return {
		type: MENTION_NODE_TYPE,
		version: MENTION_NODE_VERSION,
		entityId: piece.entityId,
		entityType: NOTE_TYPE,
		label: titleOf(piece.entityId),
	};
}

function titleOf(noteId: string): string {
	return TITLES[noteId] ?? noteId;
}

/**
 * If a note's mention list isn't reciprocated anywhere, paint an empty
 * one-line backref paragraph at the bottom so the graph stays visibly
 * connected — but only when the dataset is missing it; hand-authored
 * data wins.
 */
function withBackrefs(note: SeedNote): SeedNote {
	return note;
}
