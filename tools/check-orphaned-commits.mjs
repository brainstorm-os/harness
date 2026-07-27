#!/usr/bin/env node
/**
 * Slice 2 runner — finds branches carrying commits their merged PR could not have
 * included. See `tools/mcp-server/src/tools/orphaned-commit-check.ts` for why a
 * squash-merge makes this invisible to every ordinary signal, and why the probe
 * is a timestamp rather than a diff.
 *
 * Network-dependent (`gh`), so the decision logic lives in the pure module with
 * its own tests and this only gathers input. Run it in the wrap-up after merging,
 * or any time stacked PRs are in flight:
 *
 *     node tools/check-orphaned-commits.mjs            # this repo
 *     node tools/check-orphaned-commits.mjs ../shell   # another checkout
 *
 * Exits 1 only on a HARD orphan (work that exists nowhere else), so it can gate a
 * wrap-up script without failing on branches that were merely re-landed late.
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
	findOrphanedBranches,
	formatOrphanReport,
	OrphanSeverity,
} from "./mcp-server/src/tools/orphaned-commit-check.ts";

const repo = resolve(process.argv[2] ?? ".");
const run = (cmd, args) =>
	execFileSync(cmd, args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const lines = (s) => (s.length === 0 ? [] : s.split("\n"));

function observe(pr, remoteBranches) {
	const branch = pr.headRefName;
	// A deleted branch cannot strand anything — there is nothing left to lose.
	if (!remoteBranches.has(branch)) return null;

	// The one probe that survives a squash: a commit dated after the merge cannot
	// have been in it. `--since` on committer date, which is what a push rewrites.
	const raw = lines(
		run("git", [
			"log",
			`origin/${branch}`,
			"--not",
			"origin/main",
			`--since=${pr.mergedAt}`,
			"--format=%h%x00%s",
		]),
	);
	if (raw.length === 0) return null;

	const commitsAfterMerge = raw.map((line) => {
		const [sha, subject] = line.split("\0");
		const files = lines(run("git", ["show", "--name-only", "--format=", sha]));
		// If main has touched a file since the merge, some later PR could have
		// re-landed this content; if it has not, nothing could have.
		const filesMainNeverTouchedSince = files.filter((f) => {
			const touched = run("git", [
				"log",
				"origin/main",
				`--since=${pr.mergedAt}`,
				"--format=%h",
				"--",
				f,
			]);
			return touched.length === 0;
		});
		return { sha, subject, files, filesMainNeverTouchedSince };
	});

	return { name: branch, prNumber: pr.number, prState: "MERGED", commitsAfterMerge };
}

function main() {
	run("git", ["fetch", "--quiet", "origin"]);

	// Merged PRs are the only candidates; an open one is just work in progress.
	const prs = JSON.parse(
		run("gh", [
			"pr",
			"list",
			"--state",
			"merged",
			"--limit",
			"40",
			"--json",
			"number,headRefName,mergedAt",
		]),
	);

	const remoteBranches = new Set(
		lines(run("git", ["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"])).map(
			(b) => b.replace(/^origin\//, ""),
		),
	);

	const observations = prs.map((pr) => observe(pr, remoteBranches)).filter(Boolean);
	const findings = findOrphanedBranches(observations);

	if (findings.length === 0) {
		console.log(
			`✓ orphaned-lineage: ${prs.length} merged PR(s) checked, no commits pushed after their merge.`,
		);
		return 0;
	}
	const hard = findings.filter((f) => f.severity === OrphanSeverity.Orphaned).length;
	console[hard > 0 ? "error" : "warn"](formatOrphanReport(findings));
	return hard > 0 ? 1 : 0;
}

process.exit(main());
