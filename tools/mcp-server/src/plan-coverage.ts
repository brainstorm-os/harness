/**
 * Plan-coverage no-drop guard (SH-39 per docs/foundations/49-self-hosting.md).
 *
 * The historical failure: a `##`/`###` section authored without a resolvable
 * `*(Stage N)*` token had its bullets silently dropped by the parser, and an
 * iteration id whose prefix wasn't in `LEAD_ID_RE` was unrecognised — so the
 * whole KBN ladder, Net/Help/Welcome/NAPI/OpenRes tracks (68 bullets) never
 * reached the Tasks app, then half-reappeared from the log as a "Cross-cutting
 * tracks" catch-all.
 *
 * This guard scans the raw plan for every icon'd bullet (the exact `BULLET_RE`
 * the parser uses) and, with a deliberately BROAD id detector — broader than
 * `LEAD_ID_RE` so it catches a missing-prefix gap too — reports any id-shaped
 * bullet the parser did not capture. Non-empty ⇒ a silent drop. Wired as a
 * vitest CI assertion against the real plan and exposed for the dev-MCP audit.
 */

import { BULLET_RE, parsePlan } from "./parse-plan.ts";

export interface UncoveredBullet {
	line: number;
	id: string;
	text: string;
}

// Generic iteration-id shape, intentionally wider than the parser's
// `LEAD_ID_RE`: a dashed track id (`KBN-S-launcher`, `Net-2`, `Site-3`) OR a
// dotted/lettered numeric id (`9.3.5.N1`, `11b.4`, `B6.4a`). A missing track
// prefix in `LEAD_ID_RE` therefore still shows up here as uncovered. The track
// prefix requires ≥2 letters (`[A-Z][A-Za-z]+-`) so shorthand list notation
// like `B-1 / B-2 / B-3` in a summary bullet isn't mistaken for an id (real
// B-ladder ids are `B6.4a` — `B` + digit, no dash).
const ID_SHAPE_RE = /^((?:[A-Z][A-Za-z]+-)+[A-Za-z0-9][\w-]*|B?\d+[a-z]?(?:\.[\w-]+)*)/;

function looseLeadId(bulletText: string): string | null {
	const stripped = bulletText.replace(/^\*\*/, "");
	const firstToken = /^(\S+)/.exec(stripped)?.[1] ?? "";
	return ID_SHAPE_RE.exec(firstToken)?.[1] ?? null;
}

/**
 * Every id-shaped bullet in `source` the parser did not capture into a
 * section. Empty = no silent drop.
 */
export function findUncoveredPlanBullets(source: string): UncoveredBullet[] {
	const { sections } = parsePlan(source);
	const captured = new Set(sections.flatMap((s) => s.iterations).map((it) => it.id));
	const out: UncoveredBullet[] = [];
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i] as string;
		const bullet = BULLET_RE.exec(raw);
		if (!bullet) continue;
		const text = (bullet[2] ?? "").trim();
		const id = looseLeadId(text);
		if (!id || captured.has(id)) continue;
		out.push({ line: i + 1, id, text: text.slice(0, 80) });
	}
	return out;
}
