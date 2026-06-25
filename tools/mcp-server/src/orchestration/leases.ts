/**
 * Pure lease state machine. Every function takes the current `LeaseStore`
 * and `now` (epoch ms) and returns a *new* store plus an outcome — no I/O,
 * no clock, fully unit-testable. The file/lock edge lives in `store.ts`,
 * mirroring the pure-core / edge-wrapper split in `tools/write.ts`.
 */

import {
	DEFAULT_TTL_MS,
	type HandoffRecord,
	type Lease,
	LeaseEffective,
	LeaseStatus,
	type LeaseStore,
	PRUNE_AGE_MS,
} from "./types.ts";

export enum LeaseAction {
	Created = "created",
	Reclaimed = "reclaimed",
	TakenOver = "taken-over",
	Renewed = "renewed",
	Released = "released",
	HandedOff = "handed-off",
	Resumed = "resumed",
	Denied = "denied",
	NotFound = "not-found",
}

export interface LeaseConflict {
	owner: string;
	status: LeaseStatus;
	renewedAt: string;
	expiresAt: string;
}

export interface LeaseOutcome {
	store: LeaseStore;
	ok: boolean;
	action: LeaseAction;
	lease: Lease | null;
	/** Set when `ok` is false because the task is actively held by someone else. */
	conflict: LeaseConflict | null;
	/**
	 * The handoff payload the caller just inherited (on take-over / resume),
	 * so the new owner gets full context in the same response.
	 */
	inherited: HandoffRecord | null;
}

export interface ClaimInput {
	task: string;
	owner: string;
	worktree?: string | null;
	branch?: string | null;
	note?: string | null;
	ttlMs?: number;
	/** Steal an active lease held by another owner. Use sparingly. */
	force?: boolean;
}

export interface OwnerScopedInput {
	task: string;
	owner: string;
	force?: boolean;
}

export interface HandoffInput extends OwnerScopedInput {
	done: string;
	remaining: string;
	files: string[];
	verify: string;
}

function iso(now: number): string {
	return new Date(now).toISOString();
}

function expiresAt(lease: Lease): number {
	return Date.parse(lease.renewedAt) + lease.ttlMs;
}

/** A lease nobody actively holds: released, handed off, or past its TTL. */
function isFree(lease: Lease, now: number): boolean {
	if (lease.status === LeaseStatus.Released) return true;
	if (lease.status === LeaseStatus.Handoff) return true;
	return now >= expiresAt(lease);
}

export function effectiveState(lease: Lease, now: number): LeaseEffective {
	if (lease.status === LeaseStatus.Released) return LeaseEffective.Released;
	if (lease.status === LeaseStatus.Handoff) return LeaseEffective.Handoff;
	return now >= expiresAt(lease) ? LeaseEffective.Stale : LeaseEffective.Active;
}

function find(store: LeaseStore, task: string): Lease | undefined {
	return store.leases.find((l) => l.task === task);
}

function replace(store: LeaseStore, task: string, next: Lease | null): LeaseStore {
	const leases = store.leases.filter((l) => l.task !== task);
	if (next) leases.push(next);
	return { ...store, leases };
}

/**
 * Drops Released / Stale leases whose last heartbeat is older than
 * `maxAgeMs`, so the ledger doesn't grow unbounded. Active and Handoff
 * leases are never pruned — a handoff is a pending obligation.
 */
export function pruneStore(
	store: LeaseStore,
	now: number,
	maxAgeMs: number = PRUNE_AGE_MS,
): LeaseStore {
	const leases = store.leases.filter((l) => {
		const eff = effectiveState(l, now);
		if (eff === LeaseEffective.Active || eff === LeaseEffective.Handoff) return true;
		return now - Date.parse(l.renewedAt) < maxAgeMs;
	});
	return leases.length === store.leases.length ? store : { ...store, leases };
}

export function claimLease(store: LeaseStore, now: number, input: ClaimInput): LeaseOutcome {
	const ttlMs = input.ttlMs && input.ttlMs > 0 ? input.ttlMs : DEFAULT_TTL_MS;
	const existing = find(store, input.task);

	if (existing && existing.owner !== input.owner && !isFree(existing, now) && !input.force) {
		return {
			store,
			ok: false,
			action: LeaseAction.Denied,
			lease: existing,
			conflict: {
				owner: existing.owner,
				status: existing.status,
				renewedAt: existing.renewedAt,
				expiresAt: iso(expiresAt(existing)),
			},
			inherited: null,
		};
	}

	const sameOwner = existing?.owner === input.owner;
	const lease: Lease = {
		task: input.task,
		owner: input.owner,
		worktree: input.worktree ?? existing?.worktree ?? null,
		branch: input.branch ?? existing?.branch ?? null,
		status: LeaseStatus.Claimed,
		note: input.note ?? (sameOwner ? (existing?.note ?? null) : null),
		createdAt: sameOwner && existing ? existing.createdAt : iso(now),
		renewedAt: iso(now),
		ttlMs,
		// Inherited handoffs are surfaced in the response, not carried onto
		// the live lease — the new owner owns a clean slate.
		handoff: null,
	};

	const action = !existing
		? LeaseAction.Created
		: sameOwner
			? LeaseAction.Reclaimed
			: LeaseAction.TakenOver;

	return {
		store: replace(store, input.task, lease),
		ok: true,
		action,
		lease,
		conflict: null,
		inherited: action === LeaseAction.TakenOver ? (existing?.handoff ?? null) : null,
	};
}

export function renewLease(store: LeaseStore, now: number, input: OwnerScopedInput): LeaseOutcome {
	const existing = find(store, input.task);
	if (!existing) {
		return notFound(store);
	}
	if (existing.owner !== input.owner && !input.force) {
		return denied(store, existing, now);
	}
	const lease: Lease = {
		...existing,
		owner: input.owner,
		status: LeaseStatus.Claimed,
		renewedAt: iso(now),
	};
	return {
		store: replace(store, input.task, lease),
		ok: true,
		action: LeaseAction.Renewed,
		lease,
		conflict: null,
		inherited: null,
	};
}

export function releaseLease(
	store: LeaseStore,
	now: number,
	input: OwnerScopedInput,
): LeaseOutcome {
	const existing = find(store, input.task);
	if (!existing) {
		return notFound(store);
	}
	if (existing.owner !== input.owner && !input.force) {
		return denied(store, existing, now);
	}
	const lease: Lease = {
		...existing,
		status: LeaseStatus.Released,
		renewedAt: iso(now),
	};
	return {
		store: replace(store, input.task, lease),
		ok: true,
		action: LeaseAction.Released,
		lease,
		conflict: null,
		inherited: null,
	};
}

export function handoffLease(store: LeaseStore, now: number, input: HandoffInput): LeaseOutcome {
	const existing = find(store, input.task);
	if (!existing) {
		return notFound(store);
	}
	if (existing.owner !== input.owner && !input.force) {
		return denied(store, existing, now);
	}
	const handoff: HandoffRecord = {
		by: input.owner,
		at: iso(now),
		done: input.done,
		remaining: input.remaining,
		files: input.files,
		verify: input.verify,
	};
	const lease: Lease = {
		...existing,
		status: LeaseStatus.Handoff,
		renewedAt: iso(now),
		handoff,
	};
	return {
		store: replace(store, input.task, lease),
		ok: true,
		action: LeaseAction.HandedOff,
		lease,
		conflict: null,
		inherited: null,
	};
}

/**
 * Picks up a task that is handed off, released, or stale. Refuses a task
 * that is actively held by another owner (use `claim` with `force` to
 * steal). Returns the handoff payload the resumer inherits.
 */
export function resumeLease(store: LeaseStore, now: number, input: OwnerScopedInput): LeaseOutcome {
	const existing = find(store, input.task);
	if (!existing) {
		return notFound(store);
	}
	if (existing.owner !== input.owner && !isFree(existing, now) && !input.force) {
		return denied(store, existing, now);
	}
	const lease: Lease = {
		task: existing.task,
		owner: input.owner,
		worktree: existing.worktree,
		branch: existing.branch,
		status: LeaseStatus.Claimed,
		note: existing.note,
		createdAt: iso(now),
		renewedAt: iso(now),
		ttlMs: existing.ttlMs,
		handoff: null,
	};
	return {
		store: replace(store, input.task, lease),
		ok: true,
		action: LeaseAction.Resumed,
		lease,
		conflict: null,
		inherited: existing.handoff,
	};
}

export interface LeaseView extends Lease {
	effective: LeaseEffective;
	expiresAt: string;
}

export interface ListFilter {
	task?: string;
	owner?: string;
	effective?: LeaseEffective;
}

export function listLeases(store: LeaseStore, now: number, filter: ListFilter = {}): LeaseView[] {
	return store.leases
		.filter((l) => !filter.task || l.task === filter.task)
		.filter((l) => !filter.owner || l.owner === filter.owner)
		.map((l) => ({ ...l, effective: effectiveState(l, now), expiresAt: iso(expiresAt(l)) }))
		.filter((v) => !filter.effective || v.effective === filter.effective)
		.sort((a, b) => a.task.localeCompare(b.task));
}

function notFound(store: LeaseStore): LeaseOutcome {
	return {
		store,
		ok: false,
		action: LeaseAction.NotFound,
		lease: null,
		conflict: null,
		inherited: null,
	};
}

function denied(store: LeaseStore, existing: Lease, now: number): LeaseOutcome {
	return {
		store,
		ok: false,
		action: LeaseAction.Denied,
		lease: existing,
		conflict: {
			owner: existing.owner,
			status: existing.status,
			renewedAt: existing.renewedAt,
			expiresAt: iso(expiresAt(existing)),
		},
		inherited: null,
	};
}
