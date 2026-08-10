/**
 * One-off: extract every NOT-done iteration bullet from implementation-plan.md
 * into a faithful per-task table (skip only ✅ completed; future included).
 */
import { readFileSync } from "node:fs";

const ICON_STATUS: Record<string, string> = {
	"🟡": "🟡 in flight",
	"⚪": "⚪ pending",
	"◑": "◑ preview-drop",
};
const BULLET = /^\s*-\s+([🟡⚪◑])\s+(.*)$/u;

const src = readFileSync("docs/implementation-plan.md", "utf8").split("\n");
let section = "(preamble)";
const rows: { section: string; id: string; task: string; status: string; gate: string }[] = [];
const dropped: { section: string; text: string }[] = [];

for (const line of src) {
	const h = line.match(/^#{1,3}\s+(.*)$/);
	if (h) {
		// Strip trailing status markers / links from the heading.
		section = (h[1] ?? "")
			.replace(/\s*—.*$/, "")
			.replace(/\*\*/g, "")
			.trim();
		continue;
	}
	const m = line.match(BULLET);
	if (!m) continue;
	const icon = m[1] as string;
	let rest = (m[2] ?? "").trim();
	// id = first token, after stripping leading bold/backticks.
	rest = rest.replace(/^\*\*/, "").replace(/^`/, "");
	const idMatch = rest.match(/^([^\s—`*]+)/);
	const id = (idMatch?.[1] ?? "?").replace(/[*`]/g, "");
	// Only real iteration ids: digit-led (opt. B prefix) or a Name-Code like
	// NAPI-3 / Collab-C5 / Mailbox-2 / P2P-0 (digits allowed inside the prefix).
	// An open bullet with no id is REPORTED, not silently dropped: that silence
	// is how the Files shell bootstrap and the 9.18.6 scrape residue stayed out
	// of every status report for months, and how `10.3c`'s residue would have
	// disappeared the moment its parent went ✅.
	if (!/^(B?\d[\w.…/()]*|[A-Z][A-Za-z0-9]+-[A-Za-z0-9])/.test(id)) {
		dropped.push({ section, text: rest.slice(0, 100) });
		continue;
	}
	// task = text after the id up to the first em-dash separator; de-markdown.
	let after = rest
		.slice((idMatch?.[1] ?? "").length)
		.replace(/^[`*]+/, "")
		.trim();
	if (after.startsWith("—")) after = after.slice(1).trim();
	let task = after.split(/\s+—\s+/)[0] ?? "";
	task = task
		.replace(/\*\*/g, "")
		.replace(/`/g, "")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.trim();
	if (task.length > 90) task = `${task.slice(0, 89).trimEnd()}…`;
	// gate = an explicit "gate:" / "BLOCKED:" / "(gated:" clause, stopping at
	// the first clause boundary. The leading [\s(] guard avoids matching a
	// hyphen-joined word like "environment-blocked" used mid-prose.
	const gateMatch = line.match(/(?:^|[\s(*])(?:gate:?\s+|gated:\s*|blocked:\s*)([^·•)*;\n]+)/i);
	// Allow dots inside an id (8.3, 9.8.2b) but cut at a real sentence break
	// (period + space) so trailing prose doesn't leak in.
	let gate = gateMatch
		? ((gateMatch[1] ?? "").split(/\.\s/)[0]?.trim().replace(/`/g, "").replace(/\.$/, "") ?? "")
		: "";
	if (gate.length > 44) gate = `${gate.slice(0, 43).trimEnd()}…`;
	rows.push({ section, id, task, status: ICON_STATUS[icon] ?? icon, gate });
}

// Phase classification (per the plan's roadmap rules, §Release trains):
//   GA = v1, pre-1.0 — rides the single-user release trains 0.8.0→1.0.0
//        (the GA definition-of-done).
//   v2 = explicitly post-v1 (v1-excludes: paid / any commercial surface,
//        multi-user, marketplace) — Stage 14 / Collaboration layer / etc.
// Beta is retired (shipped v0.1.5, 2026-06-29). Section is the default signal;
// a small id override list handles the exceptions the section grouping misses.
type Phase = "GA" | "v2";
const PHASE_ORDER: Phase[] = ["GA", "v2"];
const V2_SECTION_HINTS = ["Collaboration layer", "Company / operational", "Durable sync node"];
const V2_IDS = ["IE-9", "Connector-8", "Asset-B7", "P2P-4"];

function phaseFor(section: string, id: string): Phase {
	if (V2_IDS.some((v) => id.startsWith(v))) return "v2";
	if (V2_SECTION_HINTS.some((s) => section.includes(s))) return "v2";
	return "GA";
}

// Group by phase → section, preserving section order within each phase.
const byPhase = new Map<Phase, Map<string, typeof rows>>();
const phaseCount: Record<Phase, number> = { GA: 0, v2: 0 };
for (const r of rows) {
	const phase = phaseFor(r.section, r.id);
	phaseCount[phase] += 1;
	const sections = byPhase.get(phase) ?? new Map<string, typeof rows>();
	const list = sections.get(r.section) ?? [];
	list.push(r);
	sections.set(r.section, list);
	byPhase.set(phase, sections);
}

const PHASE_LABEL: Record<Phase, string> = {
	GA: "GA / pre-1.0 (release trains 0.8.0→1.0.0)",
	v2: "v2 / post-v2 (commercial · multi-user · marketplace)",
};

let out = "";
for (const phase of PHASE_ORDER) {
	const sections = byPhase.get(phase);
	if (!sections) continue;
	out += `\n## ${phase} — ${PHASE_LABEL[phase]} (${phaseCount[phase]})\n`;
	for (const [sec, list] of sections) {
		out += `\n### ${sec}\n\n| ID | Task | Status | Gate |\n| -- | ---- | ------ | ---- |\n`;
		for (const r of list) out += `| \`${r.id}\` | ${r.task} | ${r.status} | ${r.gate} |\n`;
	}
}
console.log(`TOTAL open: ${rows.length} — GA ${phaseCount.GA} · v2 ${phaseCount.v2}\n`);
console.log(out);

if (dropped.length > 0) {
	console.error(
		`\n⚠️  ${dropped.length} OPEN bullet(s) carry no iteration id, so they are NOT in the table above.\n` +
			"    Give each one an id in implementation-plan.md, or the work stays invisible:\n",
	);
	for (const d of dropped) console.error(`    [${d.section}] ${d.text}`);
	process.exitCode = 1;
}
