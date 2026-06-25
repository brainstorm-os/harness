/**
 * Mapper from the self-hosting model → the Graph app's persisted
 * `graph:state` (SH-18 per docs/foundations/49-self-hosting.md, closes the
 * old SH-9).
 *
 * The Graph app is a single-canvas app: it persists ONE edited
 * `GraphPattern` (+ view settings) under `storage.kv` key `graph:state`,
 * and paints whatever the vault snapshot resolves for that pattern. The
 * four self-hosting entity types + `Release/v1` + `Milestone/v1` and their
 * links are already projected into entities.db by
 * `kv-blob-projectors` (SH-15). So "use the Graph app for the release" means
 * seeding the pattern so opening Graph shows the plan structure —
 * Release ← Stage/Milestone ← Iteration → OpenQuestion, coloured by type.
 *
 * Pure. The pattern is a plain object: GraphPattern's enum values ARE the
 * wire strings (`entity` / `out` / `optional`), so the seed stays a
 * `tools/*` module with no `apps/*` import (layering). The shape is
 * pinned by `plan-to-graph.test.ts` so any rename in `apps/graph` that
 * drifts the wire contract fails a test rather than silently seeding a
 * pattern the app drops.
 */

const GRAPH_STATE_KEY = "graph:state";

const ITERATION_TYPE = "brainstorm/Iteration/v1";
const STAGE_TYPE = "brainstorm/Stage/v1";
const OQ_TYPE = "brainstorm/OpenQuestion/v1";
const DESIGN_DOC_TYPE = "brainstorm/DesignDoc/v1";
const RELEASE_TYPE = "brainstorm/Release/v1";
const MILESTONE_TYPE = "brainstorm/Milestone/v1";

/** `SubjectKind.Entity` wire value. */
const SUBJECT_ENTITY = "entity";

/** The six self-hosting types, in one subject. */
const PLAN_TYPES = [
	RELEASE_TYPE,
	MILESTONE_TYPE,
	STAGE_TYPE,
	ITERATION_TYPE,
	OQ_TYPE,
	DESIGN_DOC_TYPE,
];

/**
 * The seeded plan pattern + view settings.
 *
 * **One subject, no pattern edges — deliberately.** The pure matcher
 * (`apps/graph/src/logic/match-pattern.ts`) is `O(|entities|^|subjects|)`;
 * the SH-18 seed shipped a *six*-subject join, which against a real vault
 * (hundreds of iterations + OQs) is a cartesian explosion that the
 * cost-cap rejects → the graph painted nothing. SH-9's design note is
 * explicit: a *single* `Plan` subject scoped to the six type ids keeps the
 * matcher linear; the snapshot's own `in-stage` / `resolves-oq` /
 * `in-release` / `gated-by` links still paint the stage clusters between
 * the visible nodes (the scene draws snapshot links among matched nodes —
 * it does not need pattern edges to do so). `showUnmatched: true` so an
 * orphan plan item (no links yet) still appears.
 */
export function buildPlanGraphState(): {
	version: 7;
	pattern: {
		subjects: Record<
			string,
			{
				kind: string;
				types: string[];
				where: null;
				displayName: string;
				color: null;
				icon: null;
				limit: null;
			}
		>;
		edges: never[];
		primarySubject: string;
	};
	settings: {
		showUnmatched: boolean;
		showLabels: boolean;
		showArrows: boolean;
		showIcons: boolean;
		reveal: "eased";
	};
} {
	return {
		version: 7,
		pattern: {
			subjects: {
				P: {
					kind: SUBJECT_ENTITY,
					types: [...PLAN_TYPES],
					where: null,
					displayName: "Plan",
					color: null,
					icon: null,
					limit: null,
				},
			},
			edges: [],
			primarySubject: "P",
		},
		settings: {
			showUnmatched: true,
			showLabels: true,
			showArrows: true,
			showIcons: true,
			reveal: "eased",
		},
	};
}

export { GRAPH_STATE_KEY, DESIGN_DOC_TYPE };
