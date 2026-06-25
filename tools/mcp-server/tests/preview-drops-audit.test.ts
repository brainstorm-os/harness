/**
 * `◑` expiry audit — pins the doc-stated policy that `◑` is debt with an
 * expiry, not a state. Unit cases over synthetic iterations, plus a live
 * repo-data check that hard-fails on any **expired** `◑` (a gate fully
 * flipped ✅ while the `◑` lingers — the policy violation).
 *
 * Mid-loop `Pending` / `Unevaluable` / `Gateless` items stay green: the
 * suite catches the genuine forward-looking signal, not today's
 * legitimate preview-drops awaiting their gate.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePlan } from "../src/parse-plan.ts";
import { repoPath } from "../src/repo.ts";
import {
	PreviewDropClass,
	auditPreviewDrops,
	expiredPreviewDrops,
	extractGateRefs,
} from "../src/tools/preview-drops-audit.ts";
import { type Iteration, IterationStatus } from "../src/types.ts";

const it_ = (over: Partial<Iteration> & Pick<Iteration, "id" | "status">): Iteration => ({
	stageId: "9",
	body: "",
	app: null,
	...over,
});

describe("extractGateRefs", () => {
	it("captures id-shaped tokens after `gate:` up to the scope end", () => {
		expect(extractGateRefs("X — **gate: 9.10**.")).toEqual(["9.10"]);
		expect(extractGateRefs("Y — **gate: 9.4 / 9.5**.")).toEqual(["9.4", "9.5"]);
		expect(extractGateRefs("Z — gate: SH-30 / Net-1 / Mailbox-2.")).toEqual([
			"SH-30",
			"Net-1",
			"Mailbox-2",
		]);
	});

	it("captures id-shaped tokens after `BLOCKED:` too (the plan's other house marker)", () => {
		expect(extractGateRefs("X — BLOCKED: 9.3.5.1b List→entity promotion")).toEqual(["9.3.5.1b"]);
	});

	it("ignores descriptive / OQ refs — only iteration ids count", () => {
		expect(extractGateRefs("X — gate: shell route.")).toEqual([]);
		expect(extractGateRefs("X — gate: OQ-CT-1 / OQ-CT-2.")).toEqual([]);
		expect(extractGateRefs("X — gate: design-system 8.")).toEqual([]);
	});

	it("handles multiple triggers in one body and dedupes", () => {
		const body = "Lead — **gate: 9.10**. Follow-up — BLOCKED: 9.10 + 9.4.";
		expect(extractGateRefs(body).sort()).toEqual(["9.10", "9.4"]);
	});

	it("does not bleed across the next sentence / em-dash phrase / newline", () => {
		// id outside the scope must not be captured
		expect(extractGateRefs("X — gate: 9.10. Mentions 9.99 separately.")).toEqual(["9.10"]);
		expect(extractGateRefs("X — gate: 9.10\n9.99 lives below.")).toEqual(["9.10"]);
		expect(extractGateRefs("X — gate: 9.10 — 9.99 outside the scope.")).toEqual(["9.10"]);
	});

	it("returns [] when there is no gate / BLOCKED marker", () => {
		expect(extractGateRefs("Plain body with 9.10 mentioned but no marker.")).toEqual([]);
	});
});

describe("auditPreviewDrops", () => {
	it("classifies a `◑` whose every parseable gate is ✅ as expired", () => {
		const its: Iteration[] = [
			it_({ id: "9.10", status: IterationStatus.Done }),
			it_({
				id: "x.1",
				status: IterationStatus.PreviewDrop,
				body: "tail — **gate: 9.10**.",
			}),
		];
		expect(auditPreviewDrops(its).map((e) => e.classification)).toEqual([PreviewDropClass.Expired]);
		expect(expiredPreviewDrops(its)).toHaveLength(1);
	});

	it("classifies a `◑` with ≥1 unsatisfied parseable gate as pending", () => {
		const its: Iteration[] = [
			it_({ id: "9.10", status: IterationStatus.Done }),
			it_({ id: "9.4", status: IterationStatus.Pending }),
			it_({
				id: "x.1",
				status: IterationStatus.PreviewDrop,
				body: "tail — **gate: 9.10 / 9.4**.",
			}),
		];
		expect(auditPreviewDrops(its).map((e) => e.classification)).toEqual([PreviewDropClass.Pending]);
		expect(expiredPreviewDrops(its)).toEqual([]);
	});

	it("classifies a `◑` whose gates are all descriptive/OQ as unevaluable", () => {
		const its: Iteration[] = [
			it_({
				id: "x.1",
				status: IterationStatus.PreviewDrop,
				body: "tail — **gate: OQ-CT-1 / design-system 8**.",
			}),
		];
		expect(auditPreviewDrops(its)[0]?.classification).toBe(PreviewDropClass.Unevaluable);
		expect(expiredPreviewDrops(its)).toEqual([]);
	});

	it("classifies a `◑` with no gate marker as gateless", () => {
		const its: Iteration[] = [
			it_({ id: "x.1", status: IterationStatus.PreviewDrop, body: "ad-hoc preview render." }),
		];
		expect(auditPreviewDrops(its)[0]?.classification).toBe(PreviewDropClass.Gateless);
	});

	it("only audits `◑` (PreviewDrop) iterations — ignores ✅ / 🟡 / ⚪", () => {
		const its: Iteration[] = [
			it_({ id: "a", status: IterationStatus.Done }),
			it_({ id: "b", status: IterationStatus.Pending }),
			it_({ id: "c", status: IterationStatus.Partial, body: "🟡 — gate: 9.10" }),
		];
		expect(auditPreviewDrops(its)).toEqual([]);
	});

	it("attaches per-gate status — `unknown` when the gate id is not in the plan", () => {
		const its: Iteration[] = [
			it_({
				id: "x.1",
				status: IterationStatus.PreviewDrop,
				body: "tail — **gate: 9.10 / 9.999**.",
			}),
			it_({ id: "9.10", status: IterationStatus.Pending }),
		];
		const [entry] = auditPreviewDrops(its);
		expect(entry?.gates).toEqual([
			{ ref: "9.10", status: IterationStatus.Pending },
			{ ref: "9.999", status: "unknown" },
		]);
	});
});

// Repo-data gate: any NEW expired ◑ (its parseable gate(s) all flipped
// ✅) is the policy-violation signal — fail here, not at beta
// retrospective. `KNOWN_EXPIRED` snapshots the pre-existing edge cases
// the audit surfaces today so a new expiration is what fails, not the
// known-debt; each entry must carry a reason + follow-up trigger.
const KNOWN_EXPIRED: ReadonlyMap<string, string> = new Map([
	[
		"9.12.13",
		// 9.12.13(c) Dashboard PinnedList Contacts — the id-shaped gate
		// `9.3.5.1b` (Collection contract) has flipped ✅, but the body
		// also names two descriptive co-blockers ("Database open-list
		// intent" + "activateIcon human-initiated") the audit can't
		// classify. Real cleanup: confirm those two are still pending
		// (then reword the gate as `BLOCKED: <those>`, dropping the
		// stale `9.3.5.1b` reference) OR ship the conversion / removal.
		"co-blockers are descriptive (no id) — see SH-31 follow-up note in the log",
	],
	[
		"9.8.9",
		// Files 9.8.9 — body says "gate: 9.8.2b follow-up". The id
		// `9.8.2b` IS ✅ (Files read-half shipped), but "follow-up"
		// qualifies it as a TODO that piggy-backs on 9.8.2b, not on
		// 9.8.2b itself. Real cleanup: reword the gate to name the
		// actual blocker (an OQ id, a real follow-up iteration id, or
		// drop the gate) OR ship the conversion. See SH-31 log note.
		"`follow-up` qualifier on a ✅ id — gate text mis-specifies; rewording or shipping needed",
	],
	// 9.12.16 (UI) entry removed 2026-05-23 — slice 1 shipped (the
	// `9.12.16-UI` iteration in the plan flipped to ✅; the audit no
	// longer surfaces it as expired because the iteration body now
	// reads as done, not preview-drop).
]);

describe("live plan has no NEW expired ◑ items", () => {
	it("docs/implementation-plan.md — every preview-drop's id-gate(s) still pending", () => {
		const source = readFileSync(repoPath("docs/implementation-plan.md"), "utf8");
		const projection = parsePlan(source);
		const iterations = projection.stages.flatMap((s) => s.iterations);
		const expired = expiredPreviewDrops(iterations);
		const novel = expired.filter((e) => !KNOWN_EXPIRED.has(e.id));
		expect(
			novel,
			`NEW expired ◑ — gate flipped ✅, preview-drop should now convert or be removed (Legend §◑ expiry):\n${novel
				.map((e) => `  ${e.id}  gates: ${e.gates.map((g) => `${g.ref}=${g.status}`).join(", ")}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("KNOWN_EXPIRED entries each correspond to a real expired finding (no stale snapshot)", () => {
		const source = readFileSync(repoPath("docs/implementation-plan.md"), "utf8");
		const projection = parsePlan(source);
		const iterations = projection.stages.flatMap((s) => s.iterations);
		const expiredIds = new Set(expiredPreviewDrops(iterations).map((e) => e.id));
		const stale = [...KNOWN_EXPIRED.keys()].filter((id) => !expiredIds.has(id));
		expect(
			stale,
			`Stale KNOWN_EXPIRED entries (no longer expired — remove from the snapshot):\n${stale
				.map((id) => `  ${id}`)
				.join("\n")}`,
		).toEqual([]);
	});
});
