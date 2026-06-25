import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { repoPath } from "../repo.ts";

export interface SizeBudget {
	name: string;
	/** Declared ceiling in bytes (parsed from the `.size-limit.json`
	 *  human string, e.g. `"270 KB"` → 276480). */
	limitBytes: number;
	/** Whether the budget is measured gzipped — a property of the config
	 *  entry, not of size-limit's `--json` (so it has to come from here). */
	gzip: boolean;
}

export interface SizeEntry {
	name: string;
	size: number;
	limit: number;
	gzip: boolean;
	overBudget: boolean;
}

export interface SizeReport {
	entries: SizeEntry[];
	overBudget: SizeEntry[];
	/** `false` when size-limit emitted no parseable `--json` array (e.g.
	 *  a config / build error). The previous code returned an empty,
	 *  over-budget-free report in that case — indistinguishable from
	 *  "all green", so a failed run looked clean. Callers must treat
	 *  `parsed === false` as "unknown", never "passed". */
	parsed: boolean;
	raw: string;
}

const KB = 1024;
const UNIT: Record<string, number> = {
	b: 1,
	kb: KB,
	mb: KB * KB,
	gb: KB * KB * KB,
};

/** Parse a size-limit human limit (`"270 KB"`, `"1.5 MB"`, `"500 B"`,
 *  `"10kb"`) to bytes. Unitless → bytes. Unrecognised → 0. */
export function parseHumanSize(value: string): number {
	const m = /^\s*([\d.]+)\s*([a-zA-Z]*)\s*$/.exec(value);
	if (!m?.[1]) return 0;
	const n = Number.parseFloat(m[1]);
	if (!Number.isFinite(n)) return 0;
	const unit = (m[2] || "b").toLowerCase();
	return Math.round(n * (UNIT[unit] ?? 0));
}

/** Pure: the declared budgets from a `.size-limit.json` document. */
export function readSizeBudgets(configText: string): SizeBudget[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(configText);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.flatMap((e): SizeBudget[] => {
		if (!e || typeof e !== "object") return [];
		const rec = e as Record<string, unknown>;
		if (typeof rec.name !== "string") return [];
		return [
			{
				name: rec.name,
				limitBytes: typeof rec.limit === "string" ? parseHumanSize(rec.limit) : 0,
				gzip: rec.gzip === true,
			},
		];
	});
}

/**
 * Parse size-limit's `--json` output into a structured report. `gzip`
 * is taken from the JSON entry when it carries the flag, else from the
 * matching `.size-limit.json` budget by name (size-limit's `--json`
 * doesn't always echo it — the prior hardcoded `false` mislabelled the
 * two gzipped renderer budgets). A non-JSON run yields `parsed: false`,
 * not a falsely-clean empty report.
 */
export function parseSizeOutput(
	stdout: string,
	stderr: string,
	budgets: readonly SizeBudget[] = [],
): SizeReport {
	const raw = `${stdout}\n${stderr}`;
	const gzipByName = new Map(budgets.map((b) => [b.name, b.gzip]));
	const jsonStart = stdout.indexOf("[");
	if (jsonStart !== -1) {
		try {
			const parsed = JSON.parse(stdout.slice(jsonStart)) as Array<{
				name: string;
				size: number;
				sizeLimit?: number;
				passed?: boolean;
				gzip?: boolean;
			}>;
			if (Array.isArray(parsed)) {
				const entries: SizeEntry[] = parsed.map((e) => ({
					name: e.name,
					size: e.size ?? 0,
					limit: e.sizeLimit ?? 0,
					gzip: typeof e.gzip === "boolean" ? e.gzip : (gzipByName.get(e.name) ?? false),
					overBudget: e.passed === false,
				}));
				return { entries, overBudget: entries.filter((e) => e.overBudget), parsed: true, raw };
			}
		} catch {
			// Not the JSON array — fall through to the unparsed signal.
		}
	}
	return { entries: [], overBudget: [], parsed: false, raw };
}

/**
 * Run `bun run size --json` and parse it, cross-referencing the declared
 * `.size-limit.json` budgets so `gzip` is reported correctly.
 */
export function checkSize(): SizeReport {
	let budgets: SizeBudget[] = [];
	try {
		budgets = readSizeBudgets(readFileSync(repoPath(".size-limit.json"), "utf8"));
	} catch {
		budgets = [];
	}
	const result = spawnSync("bun", ["run", "size", "--json"], {
		cwd: repoPath(),
		encoding: "utf8",
		env: { ...process.env, FORCE_COLOR: "0" },
	});
	return parseSizeOutput(result.stdout ?? "", result.stderr ?? "", budgets);
}
