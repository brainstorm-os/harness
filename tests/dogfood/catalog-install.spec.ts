/**
 * Real-shell catalog dogfood (14.34 residual). Closes the one gap the in-process
 * + node-fetch verifications can't: that Electron's `net.fetch` + the marketplace
 * IPC install an app from a live catalog inside the running shell.
 *
 * Publishes the first-party catalog into a temp dir → serves it over a local
 * HTTP server (logging every request) → launches the built shell with
 * `BRAINSTORM_CATALOG_URL` pointed at it + a fresh vault → drives the marketplace
 * IPC to install a not-installed app. The proof is the server log: Electron's
 * net.fetch must hit the index AND the bundle for the install to succeed.
 *
 * Prereq: a built shell + apps (the `dogfood:catalog` script chains the build).
 */

import { execFileSync } from "node:child_process";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import {
	createReadStream,
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { type Server, createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { launchShell } from "../perf/lib/launch-shell";

/** Standard Ed25519 PKCS8 DER prefix; append a 32-byte seed for the private key. */
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/** Wrap the publisher's raw index into the signed envelope the shell verifies —
 *  exactly what catalog-edge does in production (sign with the dev catalog seed
 *  [9] = kid catalog-k1, the public half baked into officialCatalogTrustedKeys),
 *  plus the generatedAt/ttl catalog-edge stamps. Node's crypto produces the same
 *  Ed25519 signature as @brainstorm/native (which isn't resolvable from here). */
function signCatalogIndex(rawPath: string): void {
	const raw = JSON.parse(readFileSync(rawPath, "utf8")) as { catalogId?: string; listings: unknown };
	const index = {
		catalogId: raw.catalogId ?? "brainstorm-official",
		generatedAt: 1,
		ttlSeconds: 3600,
		listings: raw.listings,
	};
	const payload = Buffer.from(JSON.stringify(index)).toString("base64url");
	const key = createPrivateKey({
		key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.alloc(32, 9)]),
		format: "der",
		type: "pkcs8",
	});
	const signature = cryptoSign(null, Buffer.from(payload), key).toString("base64url");
	writeFileSync(rawPath, JSON.stringify({ payload, kid: "catalog-k1", signature }));
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TARGET = "io.brainstorm.graph";

function contentType(path: string): string {
	if (path.endsWith(".json")) return "application/json";
	if (path.endsWith(".svg")) return "image/svg+xml";
	return "application/octet-stream";
}

test.describe("catalog install (real shell)", () => {
	let server: Server;
	let base: string;
	let catalogDir: string;
	let userDataDir: string;
	const served: string[] = [];

	test.beforeAll(async () => {
		catalogDir = mkdtempSync(join(tmpdir(), "bs-catalog-pub-"));
		userDataDir = mkdtempSync(join(tmpdir(), "bs-catalog-vault-"));
		server = createServer((req, res) => {
			const url = req.url ?? "/";
			served.push(url);
			let file: string | null = null;
			if (url === "/v1/catalog/index" || url.startsWith("/v1/catalog/index?")) {
				file = join(catalogDir, "catalog-index.json");
			} else if (url.startsWith("/assets/")) {
				const rel = decodeURIComponent(url.slice("/assets/".length).split("?")[0] ?? "");
				file = join(catalogDir, rel);
			}
			if (!file || !existsSync(file)) {
				res.statusCode = 404;
				res.end("not found");
				return;
			}
			res.setHeader("content-type", contentType(file));
			createReadStream(file).pipe(res);
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
		const addr = server.address();
		if (!addr || typeof addr === "string") throw new Error("server did not bind a port");
		base = `http://127.0.0.1:${addr.port}`;
		execFileSync("bun", ["tools/publish-first-party-catalog.ts"], {
			cwd: REPO,
			stdio: "inherit",
			env: { ...process.env, CATALOG_OUT: catalogDir, CATALOG_ASSET_BASE: `${base}/assets` },
		});
		signCatalogIndex(join(catalogDir, "catalog-index.json"));
	});

	test.afterAll(() => {
		server?.close();
		if (catalogDir) rmSync(catalogDir, { recursive: true, force: true });
		if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
	});

	test("installs a not-installed app from the live catalog via Electron net.fetch", async () => {
		const logPath = join(catalogDir, "main.log");
		const { app } = await launchShell({
			userDataDir,
			extraEnv: { BRAINSTORM_CATALOG_URL: base },
			timeoutMs: 120_000,
			stdioCapturePath: logPath,
		});
		let out: {
			installedBefore: string[];
			listingFound: boolean;
			targetSource: string | null;
			catalogSourced: number;
			installResult: { ok: boolean; reason?: string };
			installedAfter: string[];
			updatesIsArray: boolean;
		};
		try {
			const dashboard = await app.firstWindow({ timeout: 60_000 });
			out = await dashboard.evaluate(
				async ({ appId, vaultPath }) => {
					const bs = (window as unknown as { brainstorm: any }).brainstorm;
					const list = await bs.vaults.list();
					let session = await bs.vaults.session();
					if (list.length === 0) {
						await bs.vaults.create({ name: "Catalog Dogfood", path: vaultPath });
						session = await bs.vaults.session();
					} else if (!session && list[0]) {
						await bs.vaults.activate(list[0].id);
						session = await bs.vaults.session();
					}
					if (!session) throw new Error("no active vault after setup");

					const installedBefore = (await bs.marketplace.installed()).map((l: any) => l.id);
					const listings = await bs.marketplace.listings();
					const target = listings.find((l: any) => l.id === appId) ?? null;
					const catalogSourced = listings.filter((l: any) => l.source === "catalog").length;
					const installResult = await bs.marketplace.install(appId);
					const installedAfter = (await bs.marketplace.installed()).map((l: any) => l.id);
					const updates = await bs.marketplace.checkUpdates();
					return {
						installedBefore,
						listingFound: target !== null,
						targetSource: target?.source ?? null,
						catalogSourced,
						installResult,
						installedAfter,
						updatesIsArray: Array.isArray(updates),
					};
				},
				{ appId: TARGET, vaultPath: join(userDataDir, "vault") },
			);
		} finally {
			await app.close();
		}

		const catalogLogs = existsSync(logPath)
			? readFileSync(logPath, "utf8")
					.split("\n")
					.filter((l) => /catalog|Catalog|net\.fetch|verif|trust/.test(l))
			: [];
		console.log("── diagnostics ──");
		console.log("served:", JSON.stringify(served));
		console.log("targetSource:", out.targetSource, "catalogSourced:", out.catalogSourced);
		console.log("installResult:", JSON.stringify(out.installResult));
		console.log("catalog logs:\n" + catalogLogs.join("\n"));

		expect(out.installedBefore, "target not installed before").not.toContain(TARGET);
		expect(out.listingFound, "target appears in marketplace listings").toBe(true);
		expect(out.installResult.ok, `install ok (${out.installResult.reason ?? ""})`).toBe(true);
		expect(out.installedAfter, "target installed after marketplace.install").toContain(TARGET);
		expect(out.updatesIsArray, "checkUpdates returns an array").toBe(true);
		// The real proof: Electron's net.fetch hit the live server for both the
		// signed index and the app bundle.
		expect(
			served.some((u) => u.startsWith("/v1/catalog/index")),
			"Electron net.fetched the catalog index",
		).toBe(true);
		// The install routes through the catalog InstallEngine (proven by the
		// bundle fetch below). A first-party app present in BOTH the built-in
		// source and the catalog de-dupes to a built-in display label, so
		// targetSource is "built-in" here — not a catalog-path failure.
		expect(
			served.some((u) => u.startsWith("/assets/") && u.includes("graph") && u.endsWith(".brainstorm")),
			"Electron net.fetched the app bundle",
		).toBe(true);
	});
});
