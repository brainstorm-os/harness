/**
 * Slice 2 — the orphan detector, tested against the real incidents it was written
 * for (shell #313/#315, harness #119/#122).
 */

import { describe, expect, it } from "vitest";
import {
	type BranchObservation,
	findOrphanedBranches,
	formatOrphanReport,
	OrphanSeverity,
	type PostMergeCommit,
} from "../src/tools/orphaned-commit-check";

/** A post-merge commit whose files main never revisited — work stranded on the branch. */
const stranded = (sha: string, subject: string, files: string[]): PostMergeCommit => ({
	sha,
	subject,
	files,
	filesMainNeverTouchedSince: files,
});

/** A post-merge commit whose files main HAS since touched — probably re-landed. */
const superseded = (sha: string, subject: string, files: string[]): PostMergeCommit => ({
	sha,
	subject,
	files,
	filesMainNeverTouchedSince: [],
});

const merged = (
	name: string,
	prNumber: number,
	commitsAfterMerge: PostMergeCommit[],
): BranchObservation => ({ name, prNumber, prState: "MERGED", commitsAfterMerge });

describe("findOrphanedBranches", () => {
	it("flags the #313 shape — a commit pushed after the PR merged, on files main never revisited", () => {
		// The wiring commit landed on the branch ~13 minutes AFTER the squash-merge.
		// Nothing else ever touched those files, so the work existed only there.
		const found = findOrphanedBranches([
			merged("feat/lan-handshake-wire", 313, [
				stranded("abc1234", "wire the handshake into the port", [
					"packages/shell/src/main/sync/websocket-relay-port.ts",
				]),
			]),
		]);
		expect(found).toHaveLength(1);
		expect(found[0]?.severity).toBe(OrphanSeverity.Orphaned);
		expect(found[0]?.detail).toContain("exists nowhere else");
		expect(found[0]?.detail).toContain("do NOT open a PR from the stale branch");
	});

	it("stays SILENT on a clean squash-merge — the case that broke the first draft", () => {
		// Every ordinary content probe fails here. `git diff main...branch` measures
		// from the merge-base, so it is non-empty for every squash-merged branch in
		// the repo; the first draft of this checker used it and its first live run
		// reported a branch that was fine. A branch whose commits all predate the
		// merge must produce nothing at all.
		expect(findOrphanedBranches([merged("fix/normal", 300, [])])).toEqual([]);
	});

	it("downgrades the harness #119 shape — pushed late, but main has since moved those files", () => {
		// Real: the LAN security-gate doc was committed 35 minutes after #119 merged,
		// then re-landed and evolved by three later PRs. Reporting this at the same
		// volume as a hard orphan is how a lineage check earns being ignored.
		const found = findOrphanedBranches([
			merged("docs/v0101-shipped", 119, [
				superseded("4a68166", "docs(security): the LAN gate ran", [
					"docs/_review/2026-07-26-lan-p2p-security-gate.md",
					"docs/implementation-plan.md",
				]),
			]),
		]);
		expect(found[0]?.severity).toBe(OrphanSeverity.CheckSuperseded);
		expect(found[0]?.detail).toContain("most likely re-landed");
	});

	it("treats a mixed commit as a hard orphan — one stranded file is enough", () => {
		const found = findOrphanedBranches([
			merged("feat/mixed", 400, [
				superseded("aaa", "plan update", ["docs/implementation-plan.md"]),
				stranded("bbb", "the actual fix", ["packages/shell/src/main/sync/lan-relay-host.ts"]),
			]),
		]);
		expect(found[0]?.severity).toBe(OrphanSeverity.Orphaned);
		expect(found[0]?.detail).toContain("lan-relay-host.ts");
		// Both commits are reported; only the stranded one drives severity.
		expect(found[0]?.commits).toHaveLength(2);
	});

	it("ignores open, closed, and PR-less branches — those are just work", () => {
		const branches: BranchObservation[] = [
			{
				name: "feat/in-progress",
				prState: "OPEN",
				prNumber: 999,
				commitsAfterMerge: [stranded("x", "wip", ["a.ts"])],
			},
			{ name: "scratch/local-idea", prState: null, commitsAfterMerge: [stranded("y", "idea", ["b.ts"])] },
			{
				name: "fix/abandoned",
				prState: "CLOSED",
				prNumber: 998,
				commitsAfterMerge: [stranded("z", "dropped", ["c.ts"])],
			},
		];
		expect(findOrphanedBranches(branches)).toEqual([]);
	});

	it("sorts hard orphans first, so the report's first line is its most important", () => {
		const found = findOrphanedBranches([
			merged("maybe-fine", 1, [superseded("s", "late plan tweak", ["docs/x.md"])]),
			merged("really-lost", 2, [stranded("h", "the fix", ["src/y.ts"])]),
		]);
		expect(found.map((f) => f.branch)).toEqual(["really-lost", "maybe-fine"]);
	});
});

describe("formatOrphanReport", () => {
	it("is silent when there is nothing to say", () => {
		expect(formatOrphanReport([])).toBe("");
	});

	it("names the branch, the commits, and how many are unrecoverable", () => {
		const report = formatOrphanReport(
			findOrphanedBranches([
				merged("feat/x", 313, [stranded("abc1234", "wire the handshake", ["port.ts"])]),
			]),
		);
		expect(report).toContain("feat/x");
		expect(report).toContain("abc1234");
		expect(report).toContain("wire the handshake");
		expect(report).toContain("1 with work that exists nowhere else");
	});

	it("omits the unrecoverable count when every finding is a supersession check", () => {
		const report = formatOrphanReport(
			findOrphanedBranches([merged("docs/y", 119, [superseded("4a68166", "doc", ["d.md"])])]),
		);
		expect(report).not.toContain("exists nowhere else");
		expect(report).toContain("?");
	});
});
