/**
 * Graph engineering, slice 2 — **squash-survivable lineage.**
 *
 * The failure this exists for happened three times in one day, and was caught by
 * luck each time:
 *
 *   - shell #313 squash-merged ~13 minutes BEFORE the wiring commit was pushed
 *     to the same branch. That commit was orphaned; nothing detected it. It was
 *     found only because a later edit's code anchor didn't match.
 *   - shell #315 was then opened from that stale branch, and merging it would
 *     have DELETED work already on main (154 deletions, 0 insertions).
 *   - harness #122 merged before its plan-update commit was pushed; the plan kept
 *     showing ⚪ for shipped rungs, which surfaced days later as "seed vault tasks
 *     aren't changing".
 *
 * **Why git can't see it.** A squash-merge writes ONE new commit onto main; the
 * branch's own commits never appear in main's history. Every ordinary signal
 * therefore reads "merged": the PR is closed-merged, `git log main` contains the
 * change, and the branch is simply… still there, holding commits nobody will look
 * at again. Parent links are exactly what squash discards, and parent links are
 * what would have made this visible.
 *
 * **The signal that survives squash is TIME, not topology.** A commit dated after
 * the PR merged cannot have been in the squash — that is arithmetic, not a
 * heuristic, and it holds no matter how the merge rewrote history. Content
 * comparison does not work here: `git diff main...branch` measures from the
 * merge-base, so it stays non-empty after a perfectly clean squash-merge and
 * would flag every merged branch in the repo. (That was this checker's own first
 * draft; its first live run "found" a branch that was fine.)
 *
 * **Two tiers, because a post-merge commit is not automatically lost.** Work
 * pushed late is often re-landed by the next PR. So the check asks a second
 * question: has main touched those same files since? If it has not, nothing could
 * have re-landed the commit and it is a hard orphan. If it has, the commit was
 * probably superseded and a human should confirm rather than be alarmed. Ranking
 * the second tier lower is what keeps the check worth reading — a lineage check
 * that cries wolf gets ignored, and then this slice is worthless.
 *
 * Pure `(observations) → findings`; the runner that gathers input from `git` and
 * `gh` lives in `tools/check-orphaned-commits.mjs`, because it needs the network
 * and a test must not.
 */

/** A commit on the branch dated after its PR merged — provably not in the squash. */
export type PostMergeCommit = {
	sha: string;
	subject: string;
	/** Files it touched. */
	files: readonly string[];
	/**
	 * The subset of `files` that main has NOT modified since the merge. Nothing
	 * could have re-landed those, so they are unrecoverable except from this
	 * branch.
	 */
	filesMainNeverTouchedSince: readonly string[];
};

/** What the runner observes about one remote branch. */
export type BranchObservation = {
	name: string;
	prNumber?: number;
	/** PR state for this head branch: "MERGED" | "OPEN" | "CLOSED" | null (no PR). */
	prState: "MERGED" | "OPEN" | "CLOSED" | null;
	commitsAfterMerge: readonly PostMergeCommit[];
};

export enum OrphanSeverity {
	/** Post-merge commits touching files main never revisited. Work is only here. */
	Orphaned = "orphaned",
	/** Post-merge commits, but main has since touched the same files — probably
	 *  re-landed by a later PR. Confirm, don't panic. */
	CheckSuperseded = "check-superseded",
}

export type OrphanFinding = {
	branch: string;
	prNumber?: number;
	severity: OrphanSeverity;
	commits: readonly PostMergeCommit[];
	detail: string;
};

const RECOVERY_ADVICE =
	"Cherry-pick onto a fresh branch, or delete the branch if the work is truly obsolete — " +
	"do NOT open a PR from the stale branch itself, which would revert whatever landed after it (shell #315).";

/**
 * Branches carrying commits their merged PR could not have included.
 *
 * Deliberately narrow, because volume is what kills a check like this:
 *   - an OPEN PR is not an orphan; that is work in progress.
 *   - a branch with NO PR is not an orphan; it may never have been proposed.
 *   - a branch whose every commit predates the merge is exactly what a healthy
 *     squash-merge leaves behind, and is silent.
 *
 * Hard orphans sort first so the report's first line is its most important one.
 */
export function findOrphanedBranches(
	branches: readonly BranchObservation[],
): OrphanFinding[] {
	const findings: OrphanFinding[] = [];
	for (const b of branches) {
		if (b.prState !== "MERGED") continue;
		if (b.commitsAfterMerge.length === 0) continue;

		const stranded = b.commitsAfterMerge.filter(
			(c) => c.filesMainNeverTouchedSince.length > 0,
		);
		const severity =
			stranded.length > 0 ? OrphanSeverity.Orphaned : OrphanSeverity.CheckSuperseded;
		const label = `${b.name}${b.prNumber ? ` (PR #${b.prNumber})` : ""}`;
		const n = b.commitsAfterMerge.length;
		const plural = n === 1 ? "commit" : "commits";

		const detail =
			severity === OrphanSeverity.Orphaned
				? `${label} — ${n} ${plural} pushed AFTER the PR merged, touching ` +
					`${[...new Set(stranded.flatMap((c) => c.filesMainNeverTouchedSince))].join(", ")}, ` +
					`which main has not touched since. That work exists nowhere else. ${RECOVERY_ADVICE}`
				: `${label} — ${n} ${plural} pushed after the PR merged, but main has since ` +
					"touched every file they changed, so they were most likely re-landed. Confirm, then delete the branch.";

		findings.push({
			branch: b.name,
			...(b.prNumber !== undefined ? { prNumber: b.prNumber } : {}),
			severity,
			commits: b.commitsAfterMerge,
			detail,
		});
	}
	findings.sort((a, z) =>
		a.severity === z.severity ? 0 : a.severity === OrphanSeverity.Orphaned ? -1 : 1,
	);
	return findings;
}

/** Human-readable report. Empty string when there is nothing to say. */
export function formatOrphanReport(findings: readonly OrphanFinding[]): string {
	if (findings.length === 0) return "";
	const hard = findings.filter((f) => f.severity === OrphanSeverity.Orphaned).length;
	const head =
		`orphaned lineage — ${findings.length} branch(es) carry commits their merged PR could not have included` +
		(hard > 0 ? ` (${hard} with work that exists nowhere else)` : "");
	const body = findings.map((f) => {
		const mark = f.severity === OrphanSeverity.Orphaned ? "✗" : "?";
		const commits = f.commits.map((c) => `      ${c.sha} ${c.subject}`).join("\n");
		return `  ${mark} ${f.detail}\n${commits}`;
	});
	return `${head}\n${body.join("\n")}`;
}
