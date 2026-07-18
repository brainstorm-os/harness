import {
	type Iteration,
	IterationStatus,
	type PlanProjection,
	type PlanSection,
	type Stage,
	type StageStatusRow,
} from "./types.ts";

/**
 * Markdown projector for `docs/implementation-plan.md`. Pure — same input
 * string → same JSON.
 *
 * The plan was re-implemented (2026-05-18) by **domain** instead of by
 * stage: top-level `# Infrastructure | Shell | Apps`, then
 * `## <Section> *(<stage-spec>)*` (or `### …` for nested ladders), then
 * terse `- <icon> <id…> — <task>` bullets. Per-iteration narrative now
 * lives in `implementation-log.md`; the plan keeps only the legacy stage
 * id (in the `*(…)*` parenthetical) and the iteration codes, so commit /
 * OQ / review references stay valid.
 *
 * This projector therefore reads:
 *   - one `statusSnapshot` row per stage-tagged section (its primary
 *     legacy stage id + heading + status), and
 *   - `stages[]` = sections aggregated by that primary stage id, each
 *     stage's `iterations[]` = the section bullets (id = the bullet's
 *     lead code; ranges like `0.1–0.10` key on their head), `app` set to
 *     the owning section name only under the `# Apps` domain.
 * The legacy `### Stage N — Title` / `**Goal/Iterations/Exit**` blocks no
 * longer exist; `goal` is the optional `Goal:` line, `ownerDomain` is the
 * `# Domain`, `exitCriteria` is empty (the data moved to the log).
 */
export function parsePlan(source: string): PlanProjection {
	const sections = parseSections(source.split("\n"));
	// `stages` + `statusSnapshot` stay exactly as before: only stage-tagged
	// sections (a resolvable `*(Stage N)*` / bare-code spec) participate.
	const stageSections = sections.filter((s) => s.primaryStage !== null);
	const statusSnapshot = stageSections.map(
		(s): StageStatusRow => ({
			stageId: s.primaryStage as string,
			title: s.title,
			status: s.status,
		}),
	);
	const planSections = sections.map(
		(s): PlanSection => ({
			domain: s.domain,
			title: s.title,
			depth: s.depth,
			app: s.app,
			stageId: s.primaryStage,
			status: s.statusKind,
			iterations: s.iterations,
		}),
	);
	return { statusSnapshot, stages: aggregateStages(stageSections), sections: planSections };
}

const DOMAIN_RE = /^#\s+(Infrastructure|Shell|Apps)\s*$/;
const SECTION_RE = /^(#{2,3})\s+(.*\S)\s*$/;
const SPEC_RE = /\*\(([^)]+)\)\*/;
const STAGE_TOKEN_RE = /Stage\s+(\d+[a-z]?)/g;
/** A bare-id spec — app/sub-ladder sections tag with the iteration code
 *  itself (`*(9.6)*`, `*(9.3.5)*`); the stage is its leading number. */
const BARE_SPEC_RE = /^(\d+[a-z]?)(?:[.\d]|\b)/;
const STATUS_ICONS = ["✅", "🟡", "◑", "⚪", "❌"] as const;
const GOAL_RE = /^Goal:\s*(.+\S)\s*$/;
/** `- <icon> <rest>` (optionally indented). The icon is mandatory — a
 *  bullet without one is prose / the no-id "Cross-cutting tracks" line,
 *  never an iteration. */
// `u` flag is load-bearing: 🟡 is astral (U+1F7E1); without `u` the class
// splits it into surrogate halves and every in-flight bullet is dropped.
// Exported so the `plan-coverage` no-drop guard recognises iteration bullets
// with the exact same grammar the parser uses.
export const BULLET_RE = /^\s*-\s+([✅🟡◑⚪❌])\s+(\S.*)$/u;
/** Lead iteration code at the start of a bullet's text. Handles
 *  `SH-1..SH-10` → `SH-1`, `0.1–0.10` → `0.1`, `9.3.5.N-notes`,
 *  `B6.4a(a)` → `B6.4a`, `9.10(a)` → `9.10`, `9.10a` → `9.10a` (the
 *  trailing letter without a dot is a distinct id from the bare `9.10`,
 *  so `9.10`, `9.10(a)`, `9.10a` are three different iterations). Also
 *  catches named-track ids minted post-G0 (`Help-1`, `OpenRes-1c`,
 *  `Net-1a`, `NAPI-3d`, `Feedback-3`, `Welcome-1`, `SYNC-0`/`SYNC-4a`, …)
 *  so a `## YYYY-MM-DD — Help-1 — …` log entry can be joined back to its
 *  plan-side bullet. A second branch catches the letter/word-suffixed
 *  track ids (`NAPI-P`, `Public-source`) the digit-suffix list can't. */
const LEAD_ID_RE =
	/^(KBN-(?:\d+[a-z]?|[A-Z]-[A-Za-z]+(?:-[A-Za-z]+)*)|Collab-C\d+[a-z]?(?:-[A-Za-z]+)*|Connector-SEC\d+|Asset-B\d+[a-z]?|DS-[A-Za-z]+(?:-[A-Za-z]+)*-\d+[a-z]?|(?:Help|OpenRes|Net|NAPI|Feedback|Welcome|DocsHub|Browser|Mailbox|Connector|Agent|Clip|Chats|Community|Automation|Site|Account|Billing|DevPortal|Catalog|Support|BugTrack|Ops|Mktg|Launch|Lock|IE|AS|SYNC|MCP|DND|MOB)-\d+[a-z]?|(?:NAPI|Public)-[A-Za-z][\w-]*|SH-\d+|VP-\d+|B\d+(?:\.[\w-]+)*[a-z]?|\d+[a-z]?(?:\.[\w-]+)*)/;

function iconToStatus(icon: string): IterationStatus {
	switch (icon) {
		case "✅":
			return IterationStatus.Done;
		case "🟡":
			return IterationStatus.Partial;
		case "◑":
			return IterationStatus.PreviewDrop;
		case "❌":
			return IterationStatus.Reverted;
		default:
			return IterationStatus.Pending; // ⚪ — the legend's "pending"
	}
}

/** Roll several statuses into one: all-done → done; any in-flight or a
 *  done/todo mix → partial; any reverted-only stays reverted; else the
 *  common value (todo). `PreviewDrop` rolls up like `Partial` for stage
 *  aggregation — a section with `[Done, PreviewDrop]` is still "in flight"
 *  from the gating-stage view (the preview-half ships, the real-wiring
 *  half is debt) — but each iteration's own row keeps its `PreviewDrop`
 *  status so the SH-31 audit can target it precisely. Deterministic,
 *  order-independent. */
function aggregateStatus(parts: readonly IterationStatus[]): IterationStatus {
	if (parts.length === 0) return IterationStatus.Todo;
	const set = new Set(parts);
	if (set.size === 1) return parts[0] as IterationStatus;
	if (set.has(IterationStatus.Partial) || set.has(IterationStatus.PreviewDrop))
		return IterationStatus.Partial;
	const hasDone = set.has(IterationStatus.Done);
	const hasOpen = set.has(IterationStatus.Todo) || set.has(IterationStatus.Pending);
	if (hasDone && hasOpen) return IterationStatus.Partial;
	if (hasDone) return IterationStatus.Done;
	return IterationStatus.Todo;
}

type Section = {
	domain: string | null;
	title: string;
	/** 2 for `##`, 3 for `###`. */
	depth: number;
	/** Resolved legacy stage id, or `null` for sections without a stage spec
	 *  (the named cross-cutting tracks — KBN/Net/Help/Welcome/NAPI/OpenRes/
	 *  Mailbox/Browser/Connector). Such sections no longer have their bullets
	 *  dropped; they're absent only from the `stages` aggregation. */
	primaryStage: string | null;
	/** App name carried onto this section's iterations: the `## App` title
	 *  under `# Apps` (also for that app's `###` children), else `null`. */
	app: string | null;
	/** Section name carried onto this section's iterations: `null` for an
	 *  app's own `##` bullets, else the heading title. */
	section: string | null;
	status: string;
	statusKind: IterationStatus;
	goal: string | null;
	iterations: Iteration[];
	body: string;
};

function stagesFromSpec(spec: string): string[] {
	const ids: string[] = [];
	for (const m of spec.matchAll(STAGE_TOKEN_RE)) {
		if (m[1]) ids.push(m[1]);
	}
	if (ids.length > 0) return ids;
	const bare = BARE_SPEC_RE.exec(spec.trim());
	return bare?.[1] ? [bare[1]] : [];
}

function leadId(bulletText: string): string | null {
	// Many bullets bold their lead id ("**Help-1 — in-app Help center…**")
	// — strip a single `**` prefix so the id sits at position 0 where
	// LEAD_ID_RE expects it.
	const stripped = bulletText.replace(/^\*\*/, "");
	const firstToken = /^(\S+)/.exec(stripped)?.[1] ?? "";
	return LEAD_ID_RE.exec(firstToken)?.[1] ?? null;
}

function parseSections(lines: string[]): Section[] {
	const sections: Section[] = [];
	let domain: string | null = null;
	// The current `## App` under `# Apps`; carried onto that app's `###`
	// children so a sub-section's iterations attribute to the right app.
	let app: string | null = null;
	let current: (Section & { _lines: string[] }) | null = null;

	const flush = () => {
		if (!current) return;
		current.body = current._lines.join("\n").trim();
		// A section with no trailing-marker status infers from its bullets.
		if (!current.status) {
			const kind = aggregateStatus(current.iterations.map((i) => i.status));
			current.statusKind = kind;
			current.status = kind;
		}
		sections.push(current);
		current = null;
	};

	for (const raw of lines) {
		const domainMatch = DOMAIN_RE.exec(raw);
		if (domainMatch) {
			flush();
			domain = domainMatch[1] ?? null;
			app = null; // a new domain ends the previous `# Apps` app context
			continue;
		}
		const sectionMatch = SECTION_RE.exec(raw);
		if (sectionMatch) {
			flush();
			const depth = (sectionMatch[1] ?? "##").length;
			const heading = sectionMatch[2] ?? "";
			const spec = SPEC_RE.exec(heading);
			// Sections without a resolvable stage spec are NO LONGER skipped —
			// their bullets must reach `sections` so nothing is silently
			// dropped. They get `primaryStage: null` and stay out of the
			// `stages` aggregation only.
			const stages = spec ? stagesFromSpec(spec[1] ?? "") : [];
			const primaryStage = stages[0] ?? null;
			let title = spec ? heading.slice(0, spec.index).trim() : heading.trim();
			// A spec that embeds a markdown link (`*(KBN ladder — [x](y))*`) has
			// a nested `)` that defeats SPEC_RE, so it isn't sliced off. Strip a
			// trailing `*(…)*` from the title so the section name stays clean.
			if (!spec) title = title.replace(/\s*\*\(.*\)\*$/, "").trim();
			const trailing = spec ? heading.slice(spec.index + spec[0].length) : heading;
			const icon = STATUS_ICONS.find((c) => trailing.includes(c));
			// Domain/section/app attribution for this section's iterations.
			let iterApp: string | null = null;
			let iterSection: string | null = null;
			if (domain === "Apps") {
				if (depth === 2) {
					app = title; // a `## App` heading opens an app project
					iterApp = title;
				} else {
					iterApp = app; // a `### Sub` under the current app
					iterSection = title;
				}
			} else {
				iterSection = title; // Infra/Shell: the heading is the section
			}
			current = {
				domain,
				title,
				depth,
				primaryStage,
				app: iterApp,
				section: iterSection,
				status: icon ? iconToStatus(icon) : "",
				statusKind: icon ? iconToStatus(icon) : IterationStatus.Todo,
				goal: null,
				iterations: [],
				body: "",
				_lines: [],
			};
			continue;
		}
		if (!current) continue;
		current._lines.push(raw);
		if (!current.goal) {
			const g = GOAL_RE.exec(raw.trim());
			if (g?.[1]) current.goal = g[1];
		}
		const bullet = BULLET_RE.exec(raw);
		if (!bullet) continue;
		const text = (bullet[2] ?? "").trim();
		const id = leadId(text);
		if (!id) continue; // icon'd bullet without a code → not an iteration
		// Body is the human task, NOT the `<idspec> — ` head: the bullet
		// grammar is `<idspec> — <task> [— <gate>]` with a spaced em dash
		// (ranges use an *en* dash inside the idspec, so this never splits
		// `1.1–1.6`). Mirrors the pre-restructure parser's body so title
		// derivation downstream stays clean (no code in the headline).
		const sep = text.indexOf(" — ");
		current.iterations.push({
			id,
			stageId: current.primaryStage ?? "",
			status: iconToStatus(bullet[1] ?? "⚪"),
			body: sep === -1 ? text : text.slice(sep + 3).trim(),
			app: current.app,
			domain: current.domain,
			section: current.section,
		});
	}
	flush();
	return sections;
}

/** Group sections sharing a primary stage id into one `Stage` (Stage 9
 *  spans the platform-half section + every per-app section). First
 *  section wins for heading / domain / goal; iterations concatenate
 *  (each keeps its own `app`); status is the roll-up. */
function aggregateStages(sections: Section[]): Stage[] {
	const order: string[] = [];
	const byStage = new Map<string, Stage>();
	for (const s of sections) {
		if (s.primaryStage === null) continue;
		const existing = byStage.get(s.primaryStage);
		if (existing) {
			existing.iterations.push(...s.iterations);
			existing.body = existing.body ? `${existing.body}\n\n${s.body}` : s.body;
			if (!existing.goal && s.goal) existing.goal = s.goal;
			existing.status = aggregateStatus([existing.status, s.statusKind]);
			continue;
		}
		const stage: Stage = {
			stageId: s.primaryStage,
			heading: s.title,
			status: s.statusKind,
			goal: s.goal,
			ownerDomain: s.domain,
			iterations: [...s.iterations],
			exitCriteria: [],
			body: s.body,
		};
		byStage.set(s.primaryStage, stage);
		order.push(s.primaryStage);
	}
	return order.map((id) => byStage.get(id) as Stage);
}

/**
 * Leading numeric component of a stage id ("5b" → 5, "0" → 0). For
 * grouping only — several stages share a base (5 / 5b, 7a / 7b).
 */
export function stageBaseNumber(stageId: string): number | null {
	const numeric = Number.parseInt(stageId.replace(/[a-z]+$/, ""), 10);
	return Number.isNaN(numeric) ? null : numeric;
}
