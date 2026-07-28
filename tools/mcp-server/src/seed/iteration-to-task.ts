/**
 * Mapper from plan iterations → Tasks-app `Task/v1` + `Project/v1` +
 * `Section/v1` rows (SH-7 / SH-39 per docs/foundations/49-self-hosting.md).
 *
 * Pure. Lets the seeder write the implementation plan into the Tasks app's
 * own store so opening Tasks against a seeded vault shows the plan as real
 * projects with sectioned task lists — zero renderer changes required.
 *
 * SH-39 restructure: a Project is now a **domain**, not a stage. The three
 * domains map as the user reads the plan — `Infrastructure` and `Shell` are
 * single projects; every app under `# Apps` is its own project. The `##`/`###`
 * plan headings become `Section/v1` rows *within* a project. This replaces
 * the per-stage projects + the synthetic "Cross-cutting tracks" catch-all.
 *
 * The output shape mirrors `apps/tasks/src/storage/codec.ts`'s
 * `parseStored{Task,Project,Section}` contract: anything that fails that
 * validator drops on the Tasks side, so we keep the columns minimal +
 * well-typed here.
 */

import {
	type SerializedIterationEntity,
	type SerializedStageEntity,
	stripMarkdown,
} from "./brainstorm-project.ts";
import type { SerializedMilestoneEntity, SerializedReleaseEntity } from "./release-schedule.ts";
import { stripWikilinkBrackets } from "./wikilinks.ts";

/** The task body (notes): the iteration's FULL cleaned text — not the
 *  480-char `summary` (which is for the task name + plain-text grid/search
 *  surfaces). The Tasks editor renders this as plain paragraphs, so strip
 *  markdown + `[[wikilink]]` brackets so they don't show as literal syntax.
 *  Falls back to `summary` for iterations with no body. */
function taskNotes(it: SerializedIterationEntity): string {
	const full = it.body?.trim() ? stripMarkdown(stripWikilinkBrackets(it.body)).trim() : "";
	return full.length > 0 ? full : it.summary;
}

export const TASK_KEY_PREFIX = "task:";
export const PROJECT_KEY_PREFIX = "project:";
export const SECTION_KEY_PREFIX = "section:";

export interface SeedTaskRow {
	id: string;
	name: string;
	notes: string;
	completedAt: number | null;
	priority: "none" | "low" | "medium" | "high" | "critical";
	scheduledAt: number | null;
	dueAt: number | null;
	projectId: string | null;
	/** The `Section/v1` row this task belongs to within its project, or
	 *  `null` for an app's un-sub-sectioned bullets (rendered flat at top). */
	sectionId: string | null;
	recurrence: null;
	statusKey: string | null;
	createdAt: number;
	updatedAt: number;
	/** Source Iteration entity id. Drives the `Task/from-iteration` derived
	 *  edge so the seeded Task isn't a graph-orphan. SH-37. */
	iterationId: string;
}

export interface SeedProjectRow {
	id: string;
	name: string;
	description: string;
	statusKey: string | null;
	milestoneAt: number | null;
	archivedAt: number | null;
	colorHint: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface SeedSectionRow {
	id: string;
	name: string;
	projectId: string;
	/** Order within the project (plan-order of first appearance). */
	sortIndex: number;
	collapsed: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface MapResult {
	tasks: SeedTaskRow[];
	projects: SeedProjectRow[];
	sections: SeedSectionRow[];
}

/** Stable id of the umbrella release project. */
export const RELEASE_PROJECT_ID = "proj-release";

/** Identity colour + id per domain project (stable, not status-derived — a
 *  domain spans every status, so a status colour would be meaningless). */
const DOMAIN_PROJECTS: Record<string, { id: string; name: string; colorHint: string }> = {
	Infrastructure: { id: "proj-domain-infrastructure", name: "Infrastructure", colorHint: "#6366f1" },
	Shell: { id: "proj-domain-shell", name: "Shell", colorHint: "#0ea5e9" },
};
const APP_PROJECT_COLOR = "#10b981";

function slug(s: string): string {
	return (
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "x"
	);
}

/**
 * Map every plan iteration to a `Task/v1` row scoped to its domain/app
 * `Project/v1` and its `##`/`###` `Section/v1`. Stable ids derived from the
 * domain / app / section names so re-seeding overwrites in place.
 */
export function mapPlanToTasksApp(
	iterations: SerializedIterationEntity[],
	_stages: SerializedStageEntity[] = [],
	_milestones: SerializedMilestoneEntity[] = [],
	release: SerializedReleaseEntity | null = null,
): MapResult {
	const projects: SeedProjectRow[] = [];
	const sections: SeedSectionRow[] = [];
	const projectById = new Map<string, SeedProjectRow>();
	const sectionByKey = new Map<string, SeedSectionRow>();
	const sectionCountByProject = new Map<string, number>();
	const statusesByProject = new Map<string, string[]>();

	const baseTs = release?.createdAt ?? iterations[0]?.createdAt ?? 0;
	let projectSeq = 0;

	// Pinned umbrella project: the release itself, carrying the GA date so
	// Tasks surfaces the 0.1.0 deadline at a glance.
	if (release) {
		const row: SeedProjectRow = {
			id: RELEASE_PROJECT_ID,
			name: release.name,
			description: `Target ${new Date(release.targetDate).toISOString().slice(0, 10)} — ${release.scopeIncludes.length} in scope, ${release.scopeExcludes.length} explicitly out.`,
			statusKey: release.status === "shipped" ? "done" : "in-flight",
			milestoneAt: release.targetDate,
			archivedAt: null,
			colorHint: "#6366f1",
			createdAt: release.createdAt,
			updatedAt: release.updatedAt,
		};
		projects.push(row);
		projectById.set(RELEASE_PROJECT_ID, row);
	}

	const ensureProject = (it: SerializedIterationEntity): SeedProjectRow | null => {
		let id: string;
		let name: string;
		let colorHint: string;
		if (it.app) {
			id = `proj-app-${slug(it.app)}`;
			name = it.app;
			colorHint = APP_PROJECT_COLOR;
		} else if (it.domain && DOMAIN_PROJECTS[it.domain]) {
			const d = DOMAIN_PROJECTS[it.domain] as { id: string; name: string; colorHint: string };
			id = d.id;
			name = d.name;
			colorHint = d.colorHint;
		} else {
			return null;
		}
		let row = projectById.get(id);
		if (!row) {
			// Encode plan-order into createdAt so the Tasks sidebar lists
			// projects in plan order (it sorts by sortIndex then createdAt).
			const createdAt = baseTs + ++projectSeq * 1000;
			row = {
				id,
				name,
				description: "",
				statusKey: null,
				milestoneAt: null,
				archivedAt: null,
				colorHint,
				createdAt,
				updatedAt: createdAt,
			};
			projectById.set(id, row);
			projects.push(row);
		}
		return row;
	};

	const ensureSection = (project: SeedProjectRow, name: string): SeedSectionRow => {
		const key = `${project.id}::${name}`;
		let sec = sectionByKey.get(key);
		if (!sec) {
			const sortIndex = sectionCountByProject.get(project.id) ?? 0;
			sectionCountByProject.set(project.id, sortIndex + 1);
			sec = {
				id: `sec-${project.id.replace(/^proj-/, "")}-${slug(name)}`,
				name,
				projectId: project.id,
				sortIndex,
				collapsed: false,
				createdAt: project.createdAt,
				updatedAt: project.updatedAt,
			};
			sectionByKey.set(key, sec);
			sections.push(sec);
		}
		return sec;
	};

	const tasks: SeedTaskRow[] = [];
	for (const it of iterations) {
		const project = ensureProject(it);
		// Skip iterations with no domain/app project — these are log-only
		// synthetic sub-steps (granular shipped work documented in the log but
		// never a plan bullet). They stay in `entities.iterations` for the
		// journal / self-hosting / graph projections, but a task list of
		// historical sub-steps with no home is exactly the catch-all noise the
		// SH-39 restructure removes.
		if (!project) continue;
		// A REJECTED rung (Legend `❌`) is a decision NOT to do something — SH-11
		// "rejected (overreach)", Clip-1 "dropped from the plan", Props-1/2
		// "rejected, premise false". It is not work, so it does not belong on a
		// work list. It was worse than merely present: `completedAt` comes from
		// the implementation LOG, which only records shipped work, so a rejected
		// rung had none and rendered as OPEN — and `priorityForStatus` mapped it
		// to `critical`, making five abandoned ideas the most urgent-looking
		// items in the seeded vault.
		//
		// They stay in `entities.iterations` for the notes / graph / project
		// projections, where "we considered this and said no" is useful history.
		// Their status still feeds the project rollup below, so a project
		// containing one is not silently mis-summarised.
		if (it.status === REJECTED_STATUS) {
			const rejected = statusesByProject.get(project.id) ?? [];
			rejected.push(it.status);
			statusesByProject.set(project.id, rejected);
			continue;
		}
		const projectId = project.id;
		const sectionId = it.section ? ensureSection(project, it.section).id : null;
		const arr = statusesByProject.get(projectId) ?? [];
		arr.push(it.status);
		statusesByProject.set(projectId, arr);
		tasks.push({
			id: `task-${it.id}`,
			name: `${it.code} — ${truncate(it.title || it.summary || it.code, 120)}`,
			notes: taskNotes(it),
			completedAt: it.completedAt,
			priority: priorityForStatus(it.status),
			// Distinct per-iteration span (SH-16): the Timeline reads
			// createdAt→dueAt, so a cascading start/end stops the bars stacking.
			scheduledAt: it.scheduledStart,
			dueAt: it.scheduledEnd,
			projectId,
			sectionId,
			recurrence: null,
			statusKey: it.status,
			createdAt: it.scheduledStart,
			updatedAt: it.updatedAt,
			iterationId: it.id,
		});
	}

	// Roll member-iteration statuses up into a project status dot.
	for (const p of projects) {
		if (p.id === RELEASE_PROJECT_ID) continue;
		p.statusKey = rollupStatus(statusesByProject.get(p.id) ?? []);
	}

	return { tasks, projects, sections };
}

function rollupStatus(statuses: readonly string[]): string {
	if (statuses.length === 0) return "todo";
	if (statuses.every((s) => s === "done")) return "done";
	if (statuses.some((s) => s === "partial" || s === "preview-drop")) return "partial";
	if (statuses.some((s) => s === "done")) return "partial";
	if (statuses.some((s) => s === "reverted")) return "reverted";
	return "pending";
}

/** The parser's name for Legend `❌`. Historically "reverted"; the Legend calls
 *  it **rejected**, and both readings mean "not open work". */
export const REJECTED_STATUS = "reverted";

function priorityForStatus(status: string): SeedTaskRow["priority"] {
	switch (status) {
		case "partial":
			return "high";
		case "pending":
			return "medium";
		case "done":
			return "none";
		default:
			// Deliberately no `critical` case. Nothing earns top priority merely
			// from its status — the one that used to, `reverted`, is now filtered
			// out above precisely because it is not work.
			return "none";
	}
}

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1).trimEnd()}…`;
}
