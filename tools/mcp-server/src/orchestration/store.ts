/**
 * The file/lock edge for the lease ledger.
 *
 * Cross-worktree visibility is the whole point: parallel agents work in
 * separate git worktrees (the Agent tool's `isolation: "worktree"`), and a
 * file in one worktree's working dir is invisible to another. So the
 * ledger lives under the *git common dir* (`git rev-parse
 * --git-common-dir`), which every linked worktree of the same repo
 * shares. That, plus an O_EXCL lockfile around read-modify-write, makes
 * concurrent claims race-safe.
 */

import { execFileSync } from "node:child_process";
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { findRepoRoot } from "../repo.ts";
import {
	type ClaimInput,
	type HandoffInput,
	type LeaseOutcome,
	type LeaseView,
	type ListFilter,
	type OwnerScopedInput,
	claimLease,
	handoffLease,
	listLeases,
	pruneStore,
	releaseLease,
	renewLease,
	resumeLease,
} from "./leases.ts";
import { type LeaseStore, STORE_VERSION, emptyStore } from "./types.ts";

const LEDGER_DIR = "brainstorm-orchestration";
const LEDGER_FILE = "leases.json";
/** A lockfile whose holder hasn't released within this window is stolen. */
const STALE_LOCK_MS = 15_000;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 25;

let cachedDir: string | null = null;

/**
 * Resolves the directory all worktrees share for the ledger. Uses the git
 * common dir; falls back to `<repo>/.git` if git isn't reachable (e.g. a
 * tarball checkout) so the tool degrades instead of crashing.
 */
export function ledgerDir(): string {
	if (cachedDir) return cachedDir;
	const repoRoot = findRepoRoot();
	let commonDir: string;
	try {
		const out = execFileSync("git", ["rev-parse", "--git-common-dir"], {
			cwd: repoRoot,
			encoding: "utf8",
		}).trim();
		commonDir = isAbsolute(out) ? out : resolve(repoRoot, out);
	} catch {
		commonDir = resolve(repoRoot, ".git");
	}
	cachedDir = join(commonDir, LEDGER_DIR);
	return cachedDir;
}

function ledgerPath(): string {
	return join(ledgerDir(), LEDGER_FILE);
}

function lockPath(): string {
	return `${ledgerPath()}.lock`;
}

function ensureDir(): void {
	const dir = ledgerDir();
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function acquireLock(): number {
	ensureDir();
	const path = lockPath();
	const deadline = Date.now() + LOCK_TIMEOUT_MS;
	for (;;) {
		try {
			return openSync(path, "wx");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
			let stale = false;
			try {
				stale = Date.now() - statSync(path).mtimeMs > STALE_LOCK_MS;
			} catch {
				// Lock vanished between open and stat — retry immediately.
				continue;
			}
			if (stale) {
				rmSync(path, { force: true });
				continue;
			}
			if (Date.now() > deadline) {
				rmSync(path, { force: true });
				continue;
			}
			sleepSync(LOCK_RETRY_MS);
		}
	}
}

function releaseLock(fd: number): void {
	closeSync(fd);
	rmSync(lockPath(), { force: true });
}

/** Blocking sleep — keeps the read-modify-write critical section fully synchronous. */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function readStore(): LeaseStore {
	const path = ledgerPath();
	if (!existsSync(path)) return emptyStore();
	const raw = readFileSync(path, "utf8");
	try {
		const parsed = JSON.parse(raw) as LeaseStore;
		if (parsed?.version === STORE_VERSION && Array.isArray(parsed.leases)) return parsed;
		throw new Error("unrecognized ledger shape");
	} catch {
		// A corrupt ledger must not silently wipe everyone's leases — quarantine
		// it next to the ledger and start fresh so orchestration self-heals.
		renameSync(path, `${path}.corrupt-${Date.now()}`);
		return emptyStore();
	}
}

function writeStoreAtomic(store: LeaseStore): void {
	ensureDir();
	const path = ledgerPath();
	const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
	renameSync(tmp, path);
}

/**
 * Runs `mutate` inside the cross-process lock against a freshly-read
 * store, persists the result atomically only when it changed, and strips
 * the bulky `store` from the outcome (mirroring how `write.ts` drops
 * `source`/`raw` before returning to the MCP tool).
 */
function transact(
	mutate: (store: LeaseStore, now: number) => LeaseOutcome,
): Omit<LeaseOutcome, "store"> & { ledger: string } {
	const fd = acquireLock();
	try {
		const now = Date.now();
		const outcome = mutate(readStore(), now);
		if (outcome.ok) {
			writeStoreAtomic(pruneStore(outcome.store, now));
		}
		const { store: _store, ...rest } = outcome;
		return { ...rest, ledger: ledgerPath() };
	} finally {
		releaseLock(fd);
	}
}

export function claim(input: ClaimInput) {
	return transact((store, now) => claimLease(store, now, input));
}

export function renew(input: OwnerScopedInput) {
	return transact((store, now) => renewLease(store, now, input));
}

export function release(input: OwnerScopedInput) {
	return transact((store, now) => releaseLease(store, now, input));
}

export function handoff(input: HandoffInput) {
	return transact((store, now) => handoffLease(store, now, input));
}

export function resume(input: OwnerScopedInput) {
	return transact((store, now) => resumeLease(store, now, input));
}

export function status(filter: ListFilter = {}): {
	ledger: string;
	count: number;
	leases: LeaseView[];
} {
	const fd = acquireLock();
	try {
		const now = Date.now();
		const views = listLeases(readStore(), now, filter);
		return { ledger: ledgerPath(), count: views.length, leases: views };
	} finally {
		releaseLock(fd);
	}
}
