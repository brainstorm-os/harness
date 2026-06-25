/**
 * CLI for the 11.0 FTS5 search bench. Runs the harness against a
 * configurable corpus size and prints both a human summary and a
 * JSON-serialisable report (the JSON drops into a follow-up Tantivy
 * comparison verbatim).
 *
 * Usage:
 *   bun tools/bench-search.ts                       # default: 10k entities
 *   bun tools/bench-search.ts --size 100000         # the doc-18 cap
 *   bun tools/bench-search.ts --size 1000 --seed 7  # reproducible mini-run
 *   bun tools/bench-search.ts --path bench.db       # keep the index on disk
 *   bun tools/bench-search.ts --json                # JSON-only, no human text
 *
 * Spec: docs/data/18-storage-and-search.md §Performance budgets.
 *       docs/reference/11-open-questions.md OQ-128.
 */

import { existsSync, unlinkSync } from "node:fs";
import {
	type BenchEngine,
	formatBenchReport,
	makeFts5Engine,
	makeVectorEngine,
	runBench,
} from "../packages/shell/src/main/search/bench";

type Engine = "fts5" | "vector";

type Args = {
	size: number;
	seed: number;
	runsPerQuery: number;
	warmupRuns: number;
	path: string;
	json: boolean;
	engine: Engine;
};

function parseArgs(argv: readonly string[]): Args {
	const out: Args = {
		size: 10_000,
		seed: 42,
		runsPerQuery: 20,
		warmupRuns: 5,
		path: ":memory:",
		json: false,
		engine: "fts5",
	};
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		switch (a) {
			case "--engine": {
				const e = argv[++i];
				if (e !== "fts5" && e !== "vector") {
					console.error("bench-search: --engine must be 'fts5' or 'vector'");
					process.exit(2);
				}
				out.engine = e;
				break;
			}
			case "--size":
				out.size = Number.parseInt(argv[++i] ?? "0", 10);
				break;
			case "--seed":
				out.seed = Number.parseInt(argv[++i] ?? "0", 10);
				break;
			case "--runs":
				out.runsPerQuery = Number.parseInt(argv[++i] ?? "0", 10);
				break;
			case "--warmup":
				out.warmupRuns = Number.parseInt(argv[++i] ?? "0", 10);
				break;
			case "--path":
				out.path = argv[++i] ?? ":memory:";
				break;
			case "--json":
				out.json = true;
				break;
			case "--help":
			case "-h":
				console.log(USAGE);
				process.exit(0);
		}
	}
	if (!Number.isFinite(out.size) || out.size <= 0) {
		console.error("bench-search: --size must be a positive integer");
		process.exit(2);
	}
	return out;
}

const USAGE = `bench-search — FTS5 search bench (11.0)

Usage:
  bun tools/bench-search.ts [--engine fts5|vector] [--size N] [--seed N]
                            [--runs N] [--warmup N] [--path FILE] [--json]

Options:
  --engine E    fts5 (lexical, default) or vector (in-memory cosine
                baseline; the real sqlite-vec ANN bench runs in Electron)
  --size N      number of entities to index (default 10000)
  --seed N      PRNG seed; same seed = byte-identical corpus (default 42)
  --runs N      query runs per kind for stats (default 20)
  --warmup N    warmup runs per kind, not measured (default 5)
  --path FILE   on-disk DB path; default :memory: (FILE persists for
                inspection; the runner deletes it after the run; fts5 only)
  --json        emit JSON only (machine-readable; no human summary)
`;

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const cleanupPath = args.path !== ":memory:";
	if (cleanupPath && existsSync(args.path)) unlinkSync(args.path);

	// The vector engine runs the in-memory cosine baseline (sqlite-vec can't
	// load under the CLI's bun:sqlite either); it ignores --path. The real
	// sqlite-vec ANN bench is a real-Electron run.
	const makeEngine = (): BenchEngine | Promise<BenchEngine> =>
		args.engine === "vector" ? makeVectorEngine() : makeFts5Engine(args.path);

	const t0 = Date.now();
	const report = await runBench(makeEngine, {
		seed: args.seed,
		size: args.size,
		runsPerQuery: args.runsPerQuery,
		warmupRuns: args.warmupRuns,
	});
	const wall = Date.now() - t0;

	if (!args.json) {
		console.error(formatBenchReport(report));
		console.error(`(wall: ${wall}ms · path: ${args.path})`);
	}
	console.log(JSON.stringify(report, null, 2));

	if (cleanupPath && existsSync(args.path)) unlinkSync(args.path);
}

main().catch((err) => {
	console.error("bench-search: failed:", err);
	process.exit(1);
});
