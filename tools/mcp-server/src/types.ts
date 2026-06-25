/**
 * Structured projection of `docs/implementation-plan.md` and
 * `docs/reference/11-open-questions.md`. The markdown is the source of
 * truth; this is the shape every consumer reads.
 */

export enum IterationStatus {
	Done = "done",
	Partial = "partial",
	/** `◑` — a throwaway preview-only renderer has shipped; the real-wiring
	 *  half is still pending. Per the plan Legend: `◑` is debt with an
	 *  expiry — no `◑` ships in a v1 release build. Distinct from `Partial`
	 *  so the preview-drops audit (`SH-31`) can target it without the
	 *  `gate:`/`BLOCKED:` body heuristic that previously disambiguated
	 *  `◑` from `🟡` when both collapsed to `Partial`. */
	PreviewDrop = "preview-drop",
	Pending = "pending",
	Reverted = "reverted",
	/** Planned but not started — every future iteration. Replaces the
	 *  former catch-all `Unknown`, which created a junk board column. */
	Todo = "todo",
	Unknown = "unknown",
}

export interface Iteration {
	id: string;
	/** Resolved legacy stage id, or `""` for sections authored without a
	 *  `*(Stage N)*` / bare-code spec (the named cross-cutting tracks). Such
	 *  iterations are absent from `stages` aggregation but still present in
	 *  `sections` so no plan bullet is ever silently dropped. */
	stageId: string;
	status: IterationStatus;
	body: string;
	/**
	 * Per-app subsection an iteration sits under (the `## <App>` heading
	 * under `# Apps`), when the section groups iterations by app (Stage 9).
	 * `null` for iterations authored under `# Infrastructure` / `# Shell`.
	 */
	app: string | null;
	/** The `# Infrastructure | Shell | Apps` domain the iteration sits under
	 *  (`null` for sections authored before the first domain heading). */
	domain: string | null;
	/** The section heading the iteration sits under: the `##`/`###` title for
	 *  Infra/Shell, the `###` sub-heading for Apps (the `##` app name lives in
	 *  `app`), or `null` for app bullets with no `###` sub-section. */
	section: string | null;
}

export interface StageStatusRow {
	stageId: string;
	title: string;
	status: string;
}

export interface Stage {
	stageId: string;
	heading: string;
	status: IterationStatus;
	goal: string | null;
	ownerDomain: string | null;
	iterations: Iteration[];
	exitCriteria: string[];
	body: string;
}

/** One `##`/`###` section of the plan, complete — including sections
 *  without a stage spec, whose bullets the stage aggregation ignores.
 *  Domain/section projections (the Tasks app) read this so no bullet is
 *  ever silently dropped (the historical KBN/Net/Help/Welcome loss). */
export interface PlanSection {
	domain: string | null;
	title: string;
	/** 2 for `##`, 3 for `###`. */
	depth: number;
	/** The `##` app name when this section sits under `# Apps`, else `null`. */
	app: string | null;
	/** Resolved legacy stage id, or `null` for sections without a stage spec. */
	stageId: string | null;
	status: IterationStatus;
	iterations: Iteration[];
}

export interface PlanProjection {
	statusSnapshot: StageStatusRow[];
	stages: Stage[];
	/** Every parsed section, complete. `stages` is the stage-spec-tagged
	 *  subset aggregated by stage id; `sections` keeps the rest too. */
	sections: PlanSection[];
}

export enum OQStatus {
	Resolved = "resolved",
	Open = "open",
}

export interface OpenQuestion {
	id: string;
	number: number;
	section: string;
	title: string;
	status: OQStatus;
	resolutionRef: string | null;
	where: string | null;
	question: string | null;
	options: string | null;
	leaning: string | null;
	blocking: string | null;
	resolution: string | null;
	body: string;
}

export interface OQProjection {
	sections: string[];
	questions: OpenQuestion[];
}
