import { describe, expect, it } from "vitest";
import {
	LeaseAction,
	type LeaseStore,
	claimLease,
	effectiveState,
	handoffLease,
	listLeases,
	pruneStore,
	releaseLease,
	renewLease,
	resumeLease,
} from "../src/orchestration/leases.ts";
import {
	DEFAULT_TTL_MS,
	LeaseEffective,
	LeaseStatus,
	emptyStore,
} from "../src/orchestration/types.ts";

const T0 = Date.parse("2026-05-17T10:00:00.000Z");
const MIN = 60_000;

function claimedBy(store: LeaseStore, owner: string, task = "9.13.5", now = T0): LeaseStore {
	const r = claimLease(store, now, { task, owner });
	expect(r.ok).toBe(true);
	return r.store;
}

describe("claimLease", () => {
	it("creates a fresh lease on an unclaimed task", () => {
		const r = claimLease(emptyStore(), T0, {
			task: "9.13.5",
			owner: "agent-a",
			note: "pixi swap",
		});
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.Created);
		expect(r.lease?.owner).toBe("agent-a");
		expect(r.lease?.status).toBe(LeaseStatus.Claimed);
		expect(r.lease?.ttlMs).toBe(DEFAULT_TTL_MS);
		expect(r.store.leases).toHaveLength(1);
	});

	it("denies a second agent while the lease is active, with conflict detail", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = claimLease(held, T0 + MIN, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(false);
		expect(r.action).toBe(LeaseAction.Denied);
		expect(r.conflict?.owner).toBe("agent-a");
		expect(r.store).toBe(held);
	});

	it("lets the same owner re-claim — refreshes heartbeat, keeps createdAt", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = claimLease(held, T0 + 5 * MIN, { task: "9.13.5", owner: "agent-a" });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.Reclaimed);
		expect(r.lease?.createdAt).toBe(new Date(T0).toISOString());
		expect(r.lease?.renewedAt).toBe(new Date(T0 + 5 * MIN).toISOString());
	});

	it("lets another agent take over once the lease has expired", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = claimLease(held, T0 + DEFAULT_TTL_MS + 1, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.TakenOver);
		expect(r.lease?.owner).toBe("agent-b");
	});

	it("surfaces a predecessor's handoff payload on take-over via `inherited`", () => {
		let s = claimedBy(emptyStore(), "agent-a");
		s = handoffLease(s, T0 + MIN, {
			task: "9.13.5",
			owner: "agent-a",
			done: "scaffold",
			remaining: "wire renderer",
			files: ["a.ts"],
			verify: "bun run verify",
		}).store;
		const r = claimLease(s, T0 + 2 * MIN, { task: "9.13.5", owner: "agent-b" });
		expect(r.action).toBe(LeaseAction.TakenOver);
		expect(r.inherited?.remaining).toBe("wire renderer");
		expect(r.lease?.handoff).toBeNull();
	});

	it("force steals an active lease", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = claimLease(held, T0 + MIN, { task: "9.13.5", owner: "agent-b", force: true });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.TakenOver);
	});
});

describe("renewLease", () => {
	it("resets the heartbeat for the owner", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = renewLease(held, T0 + 10 * MIN, { task: "9.13.5", owner: "agent-a" });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.Renewed);
		expect(r.lease?.renewedAt).toBe(new Date(T0 + 10 * MIN).toISOString());
	});

	it("denies a non-owner without force", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = renewLease(held, T0 + MIN, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(false);
		expect(r.action).toBe(LeaseAction.Denied);
	});

	it("reports not-found for an unknown task", () => {
		const r = renewLease(emptyStore(), T0, { task: "nope", owner: "agent-a" });
		expect(r.ok).toBe(false);
		expect(r.action).toBe(LeaseAction.NotFound);
	});
});

describe("handoffLease + resumeLease", () => {
	it("parks a task as handoff then a new owner resumes it with the payload", () => {
		let s = claimedBy(emptyStore(), "agent-a");
		const h = handoffLease(s, T0 + MIN, {
			task: "9.13.5",
			owner: "agent-a",
			done: "compiler keystone landed",
			remaining: "renderer + tests",
			files: ["graph/app.ts", "graph/pixi.ts"],
			verify: "bun run --filter @brainstorm-app/graph build",
		});
		expect(h.ok).toBe(true);
		expect(h.lease?.status).toBe(LeaseStatus.Handoff);
		s = h.store;

		const r = resumeLease(s, T0 + 2 * MIN, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.Resumed);
		expect(r.lease?.owner).toBe("agent-b");
		expect(r.lease?.status).toBe(LeaseStatus.Claimed);
		expect(r.inherited?.files).toEqual(["graph/app.ts", "graph/pixi.ts"]);
		expect(r.inherited?.by).toBe("agent-a");
	});

	it("refuses to resume a task actively held by another owner", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = resumeLease(held, T0 + MIN, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(false);
		expect(r.action).toBe(LeaseAction.Denied);
	});

	it("resumes a stale task even without an explicit handoff", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const r = resumeLease(held, T0 + DEFAULT_TTL_MS + 1, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.Resumed);
	});
});

describe("releaseLease", () => {
	it("marks the lease released so anyone can re-claim immediately", () => {
		const held = claimedBy(emptyStore(), "agent-a");
		const rel = releaseLease(held, T0 + MIN, { task: "9.13.5", owner: "agent-a" });
		expect(rel.ok).toBe(true);
		expect(rel.lease?.status).toBe(LeaseStatus.Released);
		const r = claimLease(rel.store, T0 + 2 * MIN, { task: "9.13.5", owner: "agent-b" });
		expect(r.ok).toBe(true);
		expect(r.action).toBe(LeaseAction.TakenOver);
	});
});

describe("effectiveState", () => {
	it("classifies active / stale / handoff / released", () => {
		const lease = claimLease(emptyStore(), T0, { task: "9.13.5", owner: "agent-a" }).lease;
		if (!lease) throw new Error("expected a lease");
		expect(effectiveState(lease, T0 + MIN)).toBe(LeaseEffective.Active);
		expect(effectiveState(lease, T0 + DEFAULT_TTL_MS + 1)).toBe(LeaseEffective.Stale);
		expect(effectiveState({ ...lease, status: LeaseStatus.Handoff }, T0)).toBe(
			LeaseEffective.Handoff,
		);
		expect(effectiveState({ ...lease, status: LeaseStatus.Released }, T0)).toBe(
			LeaseEffective.Released,
		);
	});
});

describe("listLeases", () => {
	it("annotates effective state and filters by owner/effective", () => {
		let s = claimedBy(emptyStore(), "agent-a", "9.13.5");
		s = claimedBy(s, "agent-b", "9.14.1");
		const all = listLeases(s, T0 + MIN);
		expect(all).toHaveLength(2);
		expect(all[0]?.task).toBe("9.13.5");
		expect(all.every((v) => v.effective === LeaseEffective.Active)).toBe(true);

		const mine = listLeases(s, T0 + MIN, { owner: "agent-b" });
		expect(mine).toHaveLength(1);
		expect(mine[0]?.task).toBe("9.14.1");

		const stale = listLeases(s, T0 + DEFAULT_TTL_MS + 1, { effective: LeaseEffective.Stale });
		expect(stale).toHaveLength(2);
	});
});

describe("pruneStore", () => {
	it("drops old released/stale leases but keeps active and handoff ones", () => {
		let s = claimedBy(emptyStore(), "agent-a", "old-released", T0);
		s = releaseLease(s, T0, { task: "old-released", owner: "agent-a" }).store;
		s = claimedBy(s, "agent-b", "active-task", T0);
		s = claimedBy(s, "agent-c", "handed-off", T0);
		s = handoffLease(s, T0, {
			task: "handed-off",
			owner: "agent-c",
			done: "x",
			remaining: "y",
			files: [],
			verify: "z",
		}).store;

		const wayLater = T0 + 48 * 60 * MIN;
		// Keep the active lease alive so it isn't reaped as stale.
		s = renewLease(s, wayLater, { task: "active-task", owner: "agent-b" }).store;

		const pruned = pruneStore(s, wayLater);
		const tasks = pruned.leases.map((l) => l.task).sort();
		expect(tasks).toEqual(["active-task", "handed-off"]);
	});
});
