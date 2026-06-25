/**
 * Agent orchestration ledger. A *task* (typically a plan iteration id such
 * as "9.13.5", but any stable string works) can be claimed by exactly one
 * agent at a time. The ledger is the coordination chokepoint: agents read
 * it before touching work and hand off through it instead of leaving the
 * next agent to reconstruct state by hand.
 *
 * This is dev-process state, not product/design state — it never lives
 * under `docs/` (which exports to the org repo). It persists under the
 * shared git common dir so every worktree of the repo sees the same
 * ledger (see `store.ts`).
 */

export enum LeaseStatus {
	/** Held by an owner and being actively worked (subject to TTL expiry). */
	Claimed = "claimed",
	/** Owner stopped and wrote a handoff payload; available to resume. */
	Handoff = "handoff",
	/** Owner finished / abandoned; freely re-claimable. */
	Released = "released",
}

/**
 * The effective, time-derived state of a lease at read time. `stale` is
 * not stored — it is computed from `renewedAt + ttlMs` vs now.
 */
export enum LeaseEffective {
	Active = "active",
	Stale = "stale",
	Handoff = "handoff",
	Released = "released",
}

export interface HandoffRecord {
	by: string;
	at: string;
	/** What is complete. */
	done: string;
	/** What is left to do. */
	remaining: string;
	/** Files touched so far (so the next agent knows the blast radius). */
	files: string[];
	/** How to verify the work (command / test path / manual steps). */
	verify: string;
}

export interface Lease {
	task: string;
	owner: string;
	worktree: string | null;
	branch: string | null;
	status: LeaseStatus;
	note: string | null;
	createdAt: string;
	/** Heartbeat timestamp; `renewedAt + ttlMs` is the expiry instant. */
	renewedAt: string;
	ttlMs: number;
	handoff: HandoffRecord | null;
}

export interface LeaseStore {
	version: 1;
	leases: Lease[];
}

export const STORE_VERSION = 1 as const;

/** Default lease validity window: 30 minutes between heartbeats. */
export const DEFAULT_TTL_MS = 30 * 60 * 1000;

/** Released / stale leases older than this are pruned on every write. */
export const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

export function emptyStore(): LeaseStore {
	return { version: STORE_VERSION, leases: [] };
}
