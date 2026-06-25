/**
 * Mapper from the self-hosting model → the Whiteboard app's seed boards
 * (SH-21 per docs/foundations/49-self-hosting.md).
 *
 * Pure. Emits three `Whiteboard/v1` rows + their `WhiteboardEdge/v1`
 * connectors, written under the Whiteboard app's `whiteboard:` /
 * `whiteboard-edge:` keyspace (same on-disk protocol as
 * `apps/whiteboard/src/storage/codec.ts`):
 *
 *   1. `roadmap` — the v0.1.0 roadmap. One stage card per frame, laid
 *      out in two rows; status-coloured headers, scope sticky notes,
 *      a "TODAY ▶" marker pointing at the first non-done stage.
 *   2. `architecture` — pure visual overview of the three-layer
 *      architecture (Apps / Shell / Core services) with subsystem text
 *      nodes and IPC envelope flow edges.
 *   3. `in-flight` — current focus board: one card per stage with
 *      status=partial, with done/partial/pending iteration counts and
 *      a status sticky.
 *
 * **No `Embedded` nodes:** until 9.17.4 (BP block resolver) lands the
 * embedded renderer shows the raw entityRef URI as placeholder text,
 * which made the previous roadmap board look like a wall of
 * `brainstorm://entity/stage-9` boxes. Stage / milestone / iteration
 * data is materialised into Heading + plain Text nodes carrying the
 * real title, status, dates and counts — so the seeded boards work on
 * the renderer that ships today.
 *
 * Node/edge enum values ARE the wire strings (`frame`, `sticky`,
 * `text`, `right`, `bezier`, `arrow`); kept literal so the seed stays
 * a `tools/*` module with no `apps/*` import. The shape is pinned by
 * `plan-to-whiteboard.test.ts` round-tripping every row through the
 * real `apps/whiteboard` codec.
 */

import type { SerializedIterationEntity, SerializedStageEntity } from "./brainstorm-project.ts";
import type { SerializedMilestoneEntity, SerializedReleaseEntity } from "./release-schedule.ts";

export const WHITEBOARD_KEY_PREFIX = "whiteboard:";
export const EDGE_KEY_PREFIX = "whiteboard-edge:";
export const ROADMAP_ID = "roadmap";
export const ARCHITECTURE_ID = "architecture";
export const IN_FLIGHT_ID = "in-flight";

/** All seeded board ids in display order. */
export const SEED_BOARD_IDS: readonly string[] = Object.freeze([
	ROADMAP_ID,
	ARCHITECTURE_ID,
	IN_FLIGHT_ID,
]);

type Node = Record<string, unknown> & { id: string };
type Edge = Record<string, unknown> & { id: string };

// Render-side constraint: `.whiteboard__node` uses `box-sizing: border-box`,
// carries 8px vertical padding each side (= 16px) + a 1px border each side
// (= 2px), and the shell preload sets `line-height: 1.5`. So a `height: H`
// node has only `H - 18` of body height to render text into. The shell
// preload's `font-family` also pulls in the platform UI font, whose actual
// ascender + line gap pushes the rendered line-box above its 1.5em ideal —
// at the 16px heading size that's enough for ~half the glyph to clip when
// the body is the exact 1.5em it nominally needs. The constants below add
// a generous breathing margin per format so the seed reads as text, not
// half-clipped silhouettes, on every platform.
const NODE_PAD_V = 16;
const NODE_BORDER_V = 2;
const PLAIN_LINE_H = 24; // 12px @ 1.5 = 18px ideal + 6px platform breathing
const HEADING_LINE_H = 40; // 16px @ 1.5 = 24px ideal + 16px platform breathing
const HEADING_ROW_H = NODE_PAD_V + NODE_BORDER_V + HEADING_LINE_H; // 58
const STICKY_2L_H = NODE_PAD_V + NODE_BORDER_V + 2 * PLAIN_LINE_H; // 66

export interface RoadmapBoard {
	whiteboard: Record<string, unknown> & { id: string };
	edges: Edge[];
}

export interface SeedBoards {
	/** Every board to write, in display order. */
	boards: RoadmapBoard[];
}

/** Status → header tint (frame `colorHint`). Muted enough to keep the
 *  white-on-tint frame label legible against a light/dark canvas. */
const STAGE_TINT: Record<string, string> = {
	done: "#16a34a",
	partial: "#2563eb",
	pending: "#475569",
	reverted: "#dc2626",
	todo: "#475569",
};

const STATUS_GLYPH: Record<string, string> = {
	done: "✓",
	partial: "▶",
	pending: "○",
	reverted: "↺",
	todo: "○",
};

const STATUS_LABEL: Record<string, string> = {
	done: "Done",
	partial: "In flight",
	pending: "Pending",
	reverted: "Reverted",
	todo: "Pending",
};

function tint(status: string): string {
	return STAGE_TINT[status] ?? STAGE_TINT.pending ?? "#475569";
}

function glyph(status: string): string {
	return STATUS_GLYPH[status] ?? "·";
}

function statusLabel(status: string): string {
	return STATUS_LABEL[status] ?? status;
}

function isoDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

export function buildSeedBoards(
	stages: readonly SerializedStageEntity[],
	iterations: readonly SerializedIterationEntity[],
	milestones: readonly SerializedMilestoneEntity[],
	release: SerializedReleaseEntity,
	now: number,
): SeedBoards {
	return {
		boards: [
			buildRoadmapBoard(stages, iterations, milestones, release, now),
			buildArchitectureBoard(release, now),
			buildInFlightBoard(stages, iterations, release, now),
		],
	};
}

/**
 * Back-compat shim so callers that only want the roadmap board can keep
 * the old signature. New code should call `buildSeedBoards`.
 */
export function buildRoadmapWhiteboard(
	stages: readonly SerializedStageEntity[],
	iterations: readonly SerializedIterationEntity[],
	milestones: readonly SerializedMilestoneEntity[],
	release: SerializedReleaseEntity,
	now: number,
): RoadmapBoard {
	return buildRoadmapBoard(stages, iterations, milestones, release, now);
}

// ---------------------------------------------------------------------
// Board 1 — Roadmap
// ---------------------------------------------------------------------

const RM_FRAME_W = 280;
const RM_FRAME_H = 220;
const RM_FRAME_GAP_X = 40;
const RM_FRAME_GAP_Y = 56;
const RM_COLS = 6;
const RM_HEADER_Y = 24;
const RM_SUMMARY_Y = 96;
const RM_GRID_Y = 200;
const RM_SCOPE_W = 320;
const RM_SCOPE_H = 240;
const RM_TODAY_W = 16;
const RM_TODAY_LABEL_W = 160;

function buildRoadmapBoard(
	stages: readonly SerializedStageEntity[],
	iterations: readonly SerializedIterationEntity[],
	milestones: readonly SerializedMilestoneEntity[],
	release: SerializedReleaseEntity,
	now: number,
): RoadmapBoard {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	const cols = Math.min(RM_COLS, Math.max(stages.length, 1));
	const rowCount = Math.ceil(stages.length / cols);
	const gridW = cols * RM_FRAME_W + (cols - 1) * RM_FRAME_GAP_X;
	const gridH = rowCount * RM_FRAME_H + (rowCount - 1) * RM_FRAME_GAP_Y;

	const counts = countByStatus(stages.map((s) => s.status));
	const itCounts = countByStatus(iterations.map((it) => it.status));

	nodes.push({
		id: "n-title",
		kind: "text",
		x: 0,
		y: RM_HEADER_Y,
		width: gridW,
		height: 56,
		text: `Brainstorm ${release.version} — Roadmap`,
		format: "heading",
	});

	nodes.push({
		id: "n-summary",
		kind: "text",
		x: 0,
		y: RM_SUMMARY_Y,
		width: gridW,
		height: 80,
		text: [
			`GA target: ${isoDate(release.targetDate)}    Status: ${statusLabel(release.status)}`,
			`Stages: ${counts.done} done · ${counts.partial} in flight · ${counts.pending + counts.todo} pending${counts.reverted ? ` · ${counts.reverted} reverted` : ""}`,
			`Iterations: ${itCounts.done}/${iterations.length} shipped${itCounts.partial ? ` · ${itCounts.partial} in flight` : ""}`,
		].join("\n"),
		format: "plain",
	});

	const milestoneByStageId = new Map(milestones.map((m) => [m.stageId, m] as const));

	stages.forEach((stage, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const fx = col * (RM_FRAME_W + RM_FRAME_GAP_X);
		const fy = RM_GRID_Y + row * (RM_FRAME_H + RM_FRAME_GAP_Y);

		const frameId = `n-frame-${stage.stageId}`;
		nodes.push({
			id: frameId,
			kind: "frame",
			x: fx,
			y: fy,
			width: RM_FRAME_W,
			height: RM_FRAME_H,
			title: `${stage.stageId}. ${stage.heading}`,
			colorHint: tint(stage.status),
		});

		nodes.push({
			id: `n-stage-status-${stage.stageId}`,
			kind: "text",
			x: fx + 16,
			y: fy + 56,
			width: RM_FRAME_W - 32,
			height: HEADING_ROW_H,
			text: `${glyph(stage.status)}  ${statusLabel(stage.status)}`,
			format: "heading",
		});

		const stageIts = iterations.filter((it) => it.stageId === stage.stageId);
		const stageItCounts = countByStatus(stageIts.map((it) => it.status));
		const ms = milestoneByStageId.get(stage.id);

		const detailLines = [
			stage.goal ? clipLine(stage.goal, 110) : "—",
			`${stageIts.length} iterations · ${stageItCounts.done} ✓ · ${stageItCounts.partial} ▶ · ${stageItCounts.pending + stageItCounts.todo} ○`,
			ms ? `Gate: ${isoDate(ms.targetDate)}` : "",
		].filter((s) => s.length > 0);

		const stageBodyY = fy + 56 + HEADING_ROW_H + 4;
		nodes.push({
			id: `n-stage-body-${stage.stageId}`,
			kind: "text",
			x: fx + 16,
			y: stageBodyY,
			width: RM_FRAME_W - 32,
			height: fy + RM_FRAME_H - 16 - stageBodyY,
			text: detailLines.join("\n"),
			format: "plain",
		});

		if (i > 0) {
			const prev = stages[i - 1];
			if (prev) {
				const prevCol = (i - 1) % cols;
				const prevRow = Math.floor((i - 1) / cols);
				const sameRow = prevRow === row;
				edges.push(
					seqEdge(
						ROADMAP_ID,
						`e-seq-${prev.stageId}-${stage.stageId}`,
						`n-frame-${prev.stageId}`,
						sameRow ? "right" : "bottom",
						frameId,
						sameRow ? "left" : "top",
						now,
					),
				);
				void prevCol;
			}
		}
	});

	const lastStage = stages.at(-1);
	const releaseNodeId = "n-release";
	const releaseX = Math.max(0, gridW - RM_FRAME_W);
	const releaseY = RM_GRID_Y + gridH + RM_FRAME_GAP_Y;
	nodes.push({
		id: releaseNodeId,
		kind: "frame",
		x: releaseX,
		y: releaseY,
		width: RM_FRAME_W,
		height: 140,
		title: `🚢  Brainstorm ${release.version} GA`,
		colorHint: "#a855f7",
	});
	nodes.push({
		id: "n-release-body",
		kind: "text",
		x: releaseX + 16,
		y: releaseY + 56,
		width: RM_FRAME_W - 32,
		height: 70,
		text: `Ships on ${isoDate(release.targetDate)}\n${stages.length} stages · ${iterations.length} iterations`,
		format: "plain",
	});
	if (lastStage) {
		edges.push(
			seqEdge(
				ROADMAP_ID,
				`e-seq-${lastStage.stageId}-release`,
				`n-frame-${lastStage.stageId}`,
				"bottom",
				releaseNodeId,
				"top",
				now,
			),
		);
	}

	const firstInFlightIdx = stages.findIndex((s) => s.status === "partial");
	const todayIdx =
		firstInFlightIdx >= 0 ? firstInFlightIdx : stages.findIndex((s) => s.status !== "done");
	if (todayIdx >= 0) {
		const col = todayIdx % cols;
		const row = Math.floor(todayIdx / cols);
		const fx = col * (RM_FRAME_W + RM_FRAME_GAP_X);
		const fy = RM_GRID_Y + row * (RM_FRAME_H + RM_FRAME_GAP_Y);
		nodes.push({
			id: "n-today-pin",
			kind: "sticky",
			x: fx + (RM_FRAME_W - RM_TODAY_LABEL_W) / 2,
			y: fy - STICKY_2L_H - 8,
			width: RM_TODAY_LABEL_W,
			height: STICKY_2L_H,
			color: "yellow",
			text: `TODAY ▶  ${isoDate(now)}`,
		});
		edges.push({
			id: "e-today",
			whiteboardId: ROADMAP_ID,
			sourceNodeId: "n-today-pin",
			sourceHandle: "bottom",
			destNodeId: `n-frame-${stages[todayIdx]?.stageId}`,
			destHandle: "top",
			pathKind: "straight",
			arrowHead: "arrow",
			label: null,
			colorHint: "#eab308",
			createdAt: now,
			updatedAt: now,
		});
		void RM_TODAY_W;
	}

	const scopeIncludes = release.scopeIncludes
		.filter((s) => s.length > 0)
		.slice(0, 5)
		.map((s) => clipLine(s, 80));
	if (scopeIncludes.length > 0) {
		nodes.push({
			id: "n-scope-in",
			kind: "sticky",
			x: -(RM_SCOPE_W + RM_FRAME_GAP_X),
			y: RM_GRID_Y,
			width: RM_SCOPE_W,
			height: RM_SCOPE_H,
			color: "green",
			text: `v${release.version} ships:\n\n• ${scopeIncludes.join("\n• ")}`,
		});
	}

	const scopeExcludes = release.scopeExcludes
		.filter((s) => s.length > 0)
		.slice(0, 5)
		.map((s) => clipLine(s, 80));
	if (scopeExcludes.length > 0) {
		nodes.push({
			id: "n-scope-out",
			kind: "sticky",
			x: gridW + RM_FRAME_GAP_X,
			y: RM_GRID_Y,
			width: RM_SCOPE_W,
			height: RM_SCOPE_H,
			color: "pink",
			text: `v${release.version} does NOT include:\n\n• ${scopeExcludes.join("\n• ")}`,
		});
	}

	return {
		whiteboard: {
			id: ROADMAP_ID,
			name: `Brainstorm ${release.version} — Roadmap`,
			description: `Stage-by-stage path to the ${isoDate(release.targetDate)} release.`,
			nodes,
			createdAt: release.createdAt,
			updatedAt: now,
		},
		edges,
	};
}

// ---------------------------------------------------------------------
// Board 2 — Architecture overview
// ---------------------------------------------------------------------

interface ArchLane {
	id: string;
	title: string;
	tint: string;
	subsystems: readonly { id: string; label: string; detail: string }[];
}

const ARCH_LANES: readonly ArchLane[] = Object.freeze([
	{
		id: "apps",
		title: "Apps  ·  sandboxed renderers",
		tint: "#2563eb",
		subsystems: [
			{
				id: "notes",
				label: "Notes",
				detail: "Lexical · Block Protocol\nrich text + mentions",
			},
			{
				id: "tasks",
				label: "Tasks",
				detail: "Task/v1 + Project/v1\nfirst Database adopter",
			},
			{
				id: "database",
				label: "Database",
				detail: "List+View entities\n6 view kinds",
			},
			{
				id: "graph",
				label: "Graph",
				detail: "Pixi + d3 worker\npattern queries",
			},
			{
				id: "calendar",
				label: "Calendar",
				detail: "Event/v1 month grid",
			},
			{
				id: "whiteboard",
				label: "Whiteboard",
				detail: "Pixi edges +\nDOM nodes",
			},
			{
				id: "files",
				label: "Files",
				detail: "Folder/v1 tree",
			},
			{
				id: "more",
				label: "+ Code editor · Journal · Bookmarks · Self-hosting",
				detail: "shared SDK chrome",
			},
		],
	},
	{
		id: "shell",
		title: "Shell  ·  privileged main + dashboard",
		tint: "#7c3aed",
		subsystems: [
			{
				id: "broker",
				label: "IPC Broker",
				detail: "envelope schema\nfail-closed routing",
			},
			{
				id: "ledger",
				label: "Capability Ledger",
				detail: "per-vault grants\nscope-aware (intents.*)",
			},
			{
				id: "identity",
				label: "Renderer Identity",
				detail: "preload-stamped\napp attestation",
			},
			{
				id: "vault",
				label: "Vault Session",
				detail: "master key (in-mem)\nEd25519 identity",
			},
			{
				id: "windows",
				label: "Window Manager",
				detail: "intra-app share\ncross-app isolate",
			},
			{
				id: "dashboard",
				label: "Dashboard",
				detail: "launcher · settings\nshortcuts · search",
			},
		],
	},
	{
		id: "core",
		title: "Core services  ·  utilityProcess workers",
		tint: "#0d9488",
		subsystems: [
			{
				id: "storage",
				label: "Storage worker",
				detail: "ledger · registry\nentities · search",
			},
			{
				id: "ydoc",
				label: "Yjs doc worker",
				detail: "snapshot+tail format\nCRC32 per update",
			},
			{
				id: "search",
				label: "Search worker",
				detail: "SQLite FTS5\nshell-side writer",
			},
			{
				id: "sync",
				label: "Sync worker",
				detail: "ciphertext-only relay\nE2E AEAD",
			},
			{
				id: "credentials",
				label: "Credential store",
				detail: "@napi-rs/keyring\nplatform keystore",
			},
		],
	},
]);

const AR_LANE_W = 1120;
// Sized so each subsystem cell fits a HEADING_ROW_H header + 4px gap + a
// 2-line plain detail (STICKY_2L_H): 58 + 4 + 66 = 128 per row, ×2 rows
// + AR_SUB_GAP (12) + 2×AR_SUB_PAD (32) + frame header (56) = 356. Rounded
// up to 360 to land on the even-pixel scale.
const AR_LANE_H = 360;
const AR_LANE_GAP = 56;
const AR_LANE_X = 0;
const AR_LANE_Y = 160;
const AR_SUB_GAP = 12;
const AR_SUB_PAD = 16;
const AR_SUB_HEADER_GAP = 4;

function buildArchitectureBoard(release: SerializedReleaseEntity, now: number): RoadmapBoard {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	nodes.push({
		id: "n-arch-title",
		kind: "text",
		x: AR_LANE_X,
		y: 24,
		width: AR_LANE_W,
		height: 56,
		text: "Architecture  ·  three layers, two boundaries",
		format: "heading",
	});

	nodes.push({
		id: "n-arch-subtitle",
		kind: "text",
		x: AR_LANE_X,
		y: 96,
		width: AR_LANE_W,
		height: 48,
		text:
			"Every host-service call is an IPC envelope. Cross-app isolation is the security boundary; capability checks fail closed.",
		format: "quote",
	});

	ARCH_LANES.forEach((lane, laneIdx) => {
		const ly = AR_LANE_Y + laneIdx * (AR_LANE_H + AR_LANE_GAP);
		const laneFrameId = `n-arch-lane-${lane.id}`;
		nodes.push({
			id: laneFrameId,
			kind: "frame",
			x: AR_LANE_X,
			y: ly,
			width: AR_LANE_W,
			height: AR_LANE_H,
			title: lane.title,
			colorHint: lane.tint,
		});

		const inner = AR_LANE_W - 2 * AR_SUB_PAD;
		const cols = Math.max(1, Math.min(4, lane.subsystems.length));
		const subRows = Math.ceil(lane.subsystems.length / cols);
		const subW = Math.floor((inner - (cols - 1) * AR_SUB_GAP) / cols);
		const subH = Math.floor((AR_LANE_H - 56 - 2 * AR_SUB_PAD - (subRows - 1) * AR_SUB_GAP) / subRows);

		lane.subsystems.forEach((sub, si) => {
			const cx = si % cols;
			const ry = Math.floor(si / cols);
			const sx = AR_LANE_X + AR_SUB_PAD + cx * (subW + AR_SUB_GAP);
			const sy = ly + 56 + AR_SUB_PAD + ry * (subH + AR_SUB_GAP);
			nodes.push({
				id: `n-arch-${lane.id}-${sub.id}-h`,
				kind: "text",
				x: sx,
				y: sy,
				width: subW,
				height: HEADING_ROW_H,
				text: sub.label,
				format: "heading",
			});
			nodes.push({
				id: `n-arch-${lane.id}-${sub.id}-d`,
				kind: "text",
				x: sx,
				y: sy + HEADING_ROW_H + AR_SUB_HEADER_GAP,
				width: subW,
				height: subH - HEADING_ROW_H - AR_SUB_HEADER_GAP,
				text: sub.detail,
				format: "plain",
			});
		});
	});

	const lanePairs: ReadonlyArray<{
		from: string;
		to: string;
		label: string;
	}> = [
		{ from: "n-arch-lane-apps", to: "n-arch-lane-shell", label: "IPC envelope" },
		{ from: "n-arch-lane-shell", to: "n-arch-lane-core", label: "WorkerBridge" },
	];
	for (const [i, pair] of lanePairs.entries()) {
		edges.push({
			id: `e-arch-${i}`,
			whiteboardId: ARCHITECTURE_ID,
			sourceNodeId: pair.from,
			sourceHandle: "bottom",
			destNodeId: pair.to,
			destHandle: "top",
			pathKind: "straight",
			arrowHead: "arrow",
			label: pair.label,
			colorHint: "#94a3b8",
			createdAt: now,
			updatedAt: now,
		});
	}

	nodes.push({
		id: "n-arch-note-fail-closed",
		kind: "sticky",
		x: AR_LANE_X + AR_LANE_W + AR_LANE_GAP,
		y: AR_LANE_Y,
		width: 280,
		height: 160,
		color: "yellow",
		text:
			"Fail-closed rule\n\nAny throw from the capability check returns Unavailable, never approval.",
	});
	nodes.push({
		id: "n-arch-note-backpressure",
		kind: "sticky",
		x: AR_LANE_X + AR_LANE_W + AR_LANE_GAP,
		y: AR_LANE_Y + 180,
		width: 280,
		height: 160,
		color: "blue",
		text:
			"Per-app backpressure\n\nFixed-depth pending queue per app; overflow drops oldest non-streaming requests.",
	});
	nodes.push({
		id: "n-arch-note-keys",
		kind: "sticky",
		x: AR_LANE_X + AR_LANE_W + AR_LANE_GAP,
		y: AR_LANE_Y + 360,
		width: 280,
		height: 160,
		color: "pink",
		text:
			"Crypto routing\n\nOnly main/credentials may touch the platform keystore. Apps always go through the credential store.",
	});

	return {
		whiteboard: {
			id: ARCHITECTURE_ID,
			name: "Architecture overview",
			description:
				"Three-layer architecture: Apps (sandboxed) → Shell (broker + ledger) → Core services (workers).",
			nodes,
			createdAt: release.createdAt,
			updatedAt: now,
		},
		edges,
	};
}

// ---------------------------------------------------------------------
// Board 3 — In-flight stages
// ---------------------------------------------------------------------

const IF_CARD_W = 320;
// Card stacks (top→bottom inside the frame): frame title (56) + progress
// heading (HEADING_ROW_H=58) + 4 gap + 2-line quote (STICKY_2L_H=66) + 4
// gap + chip row (STICKY_2L_H=66) + 16 bottom padding = 270. Rounded up
// to 280 for the even-pixel scale.
const IF_CARD_H = 280;
const IF_CARD_GAP = 32;
const IF_GRID_Y = 200;
const IF_COLS = 4;

function buildInFlightBoard(
	stages: readonly SerializedStageEntity[],
	iterations: readonly SerializedIterationEntity[],
	release: SerializedReleaseEntity,
	now: number,
): RoadmapBoard {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	const inFlight = stages.filter((s) => s.status === "partial");
	const cols = Math.min(IF_COLS, Math.max(inFlight.length, 1));
	const gridW = cols * IF_CARD_W + (cols - 1) * IF_CARD_GAP;

	nodes.push({
		id: "n-if-title",
		kind: "text",
		x: 0,
		y: 24,
		width: gridW,
		height: 56,
		text: "In flight  ·  current focus",
		format: "heading",
	});

	if (inFlight.length === 0) {
		nodes.push({
			id: "n-if-empty",
			kind: "sticky",
			x: 0,
			y: 120,
			width: 360,
			height: 160,
			color: "green",
			text:
				"No stages currently in flight.\n\nEither the release is ready or all work is queued — check the Roadmap.",
		});
	} else {
		nodes.push({
			id: "n-if-summary",
			kind: "text",
			x: 0,
			y: 96,
			width: gridW,
			height: 60,
			text: `${inFlight.length} stage${inFlight.length === 1 ? "" : "s"} actively shipping toward ${isoDate(release.targetDate)} GA.`,
			format: "plain",
		});

		inFlight.forEach((stage, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const fx = col * (IF_CARD_W + IF_CARD_GAP);
			const fy = IF_GRID_Y + row * (IF_CARD_H + IF_CARD_GAP);

			const frameId = `n-if-frame-${stage.stageId}`;
			nodes.push({
				id: frameId,
				kind: "frame",
				x: fx,
				y: fy,
				width: IF_CARD_W,
				height: IF_CARD_H,
				title: `${stage.stageId}. ${stage.heading}`,
				colorHint: tint(stage.status),
			});

			const stageIts = iterations.filter((it) => it.stageId === stage.stageId);
			const c = countByStatus(stageIts.map((it) => it.status));
			const total = stageIts.length || 1;
			const pct = Math.round((c.done / total) * 100);

			nodes.push({
				id: `n-if-progress-${stage.stageId}`,
				kind: "text",
				x: fx + 16,
				y: fy + 56,
				width: IF_CARD_W - 32,
				height: HEADING_ROW_H,
				text: `${pct}% complete  ·  ${c.done}/${stageIts.length} iterations`,
				format: "heading",
			});

			const goal = stage.goal ? clipLine(stage.goal, 130) : "";
			nodes.push({
				id: `n-if-goal-${stage.stageId}`,
				kind: "text",
				x: fx + 16,
				y: fy + 56 + HEADING_ROW_H + 4,
				width: IF_CARD_W - 32,
				height: STICKY_2L_H,
				text: goal,
				format: "quote",
			});

			const chipY = fy + IF_CARD_H - 16 - STICKY_2L_H;
			const chipW = (IF_CARD_W - 32 - 16) / 3;
			nodes.push({
				id: `n-if-chip-done-${stage.stageId}`,
				kind: "sticky",
				x: fx + 16,
				y: chipY,
				width: chipW,
				height: STICKY_2L_H,
				color: "green",
				text: `✓ ${c.done}\nshipped`,
			});
			nodes.push({
				id: `n-if-chip-partial-${stage.stageId}`,
				kind: "sticky",
				x: fx + 16 + chipW + 8,
				y: chipY,
				width: chipW,
				height: STICKY_2L_H,
				color: "blue",
				text: `▶ ${c.partial}\nactive`,
			});
			nodes.push({
				id: `n-if-chip-pending-${stage.stageId}`,
				kind: "sticky",
				x: fx + 16 + 2 * (chipW + 8),
				y: chipY,
				width: chipW,
				height: STICKY_2L_H,
				color: "gray",
				text: `○ ${c.pending + c.todo}\nqueued`,
			});
		});

		const samples = pickRecentInFlightIterations(iterations, 6);
		if (samples.length > 0) {
			const stickyTop = IF_GRID_Y + Math.ceil(inFlight.length / cols) * (IF_CARD_H + IF_CARD_GAP) + 24;
			nodes.push({
				id: "n-if-recent-title",
				kind: "text",
				x: 0,
				y: stickyTop,
				width: gridW,
				height: HEADING_ROW_H,
				text: "Recently shipped",
				format: "heading",
			});
			samples.forEach((it, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				const sx = col * (IF_CARD_W + IF_CARD_GAP);
				const sy = stickyTop + HEADING_ROW_H + 16 + row * (96 + 16);
				nodes.push({
					id: `n-if-recent-${it.code}`,
					kind: "sticky",
					x: sx,
					y: sy,
					width: IF_CARD_W,
					height: 96,
					color: "yellow",
					text: `${it.code} — ${clipLine(it.title, 60)}\n${it.completedAt ? isoDate(it.completedAt) : ""}`,
				});
			});
		}
	}

	return {
		whiteboard: {
			id: IN_FLIGHT_ID,
			name: "In flight — current focus",
			description: "Stages currently in progress, with iteration progress and recent ships.",
			nodes,
			createdAt: release.createdAt,
			updatedAt: now,
		},
		edges,
	};
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function countByStatus(statuses: readonly string[]): {
	done: number;
	partial: number;
	pending: number;
	todo: number;
	reverted: number;
} {
	const c = { done: 0, partial: 0, pending: 0, todo: 0, reverted: 0 };
	for (const s of statuses) {
		if (s === "done") c.done++;
		else if (s === "partial") c.partial++;
		else if (s === "pending") c.pending++;
		else if (s === "reverted") c.reverted++;
		else c.todo++;
	}
	return c;
}

function clipLine(s: string, max: number): string {
	const t = stripMd(s).trim();
	return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function stripMd(s: string): string {
	return s
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/_([^_]+)_/g, "$1");
}

function pickRecentInFlightIterations(
	iterations: readonly SerializedIterationEntity[],
	n: number,
): SerializedIterationEntity[] {
	return iterations
		.filter((it) => it.status === "done" && it.completedAt != null)
		.slice()
		.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
		.slice(0, n);
}

function seqEdge(
	whiteboardId: string,
	id: string,
	sourceNodeId: string,
	sourceHandle: "top" | "right" | "bottom" | "left",
	destNodeId: string,
	destHandle: "top" | "right" | "bottom" | "left",
	now: number,
): Edge {
	return {
		id,
		whiteboardId,
		sourceNodeId,
		sourceHandle,
		destNodeId,
		destHandle,
		pathKind: "bezier",
		arrowHead: "arrow",
		label: null,
		colorHint: null,
		createdAt: now,
		updatedAt: now,
	};
}
