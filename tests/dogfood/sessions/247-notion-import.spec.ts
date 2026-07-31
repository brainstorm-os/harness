/**
 * Session 247 — real-shell verification of the IE-6 Notion importer.
 *
 * Launches the production shell against a throwaway vault, writes a fixture
 * Notion "Markdown & CSV" export `.zip`, stubs ONLY the native file dialog
 * (Playwright can't drive an OS dialog), then drives the real
 * `window.brainstorm.importExport.pickNotion()` / `.runNotion()` bridge — so the
 * whole production path runs: dashboard preload → ipcMain handler → the
 * dependency-free PKZIP reader → the import engine → the real better-sqlite3
 * vault. Re-running proves idempotency (and therefore that the rows persisted).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, _electron, expect, test } from "@playwright/test";
import { shellLaunchEnv } from "../lib/shell-launch-env";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL_DIR = join(HERE, "..", "..", "..", "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

/** Minimal stored (uncompressed) PKZIP archive — the production reader handles
 *  both stored + deflate; stored keeps the fixture dependency-free. */
function makeStoredZip(members: { name: string; data: Buffer }[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const m of members) {
		const name = Buffer.from(m.name, "utf8");
		const local = Buffer.alloc(30 + name.length);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt32LE(m.data.length, 18);
		local.writeUInt32LE(m.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		name.copy(local, 30);
		locals.push(Buffer.concat([local, m.data]));
		const central = Buffer.alloc(46 + name.length);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt32LE(m.data.length, 20);
		central.writeUInt32LE(m.data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		name.copy(central, 46);
		centrals.push(central);
		offset += locals[locals.length - 1]!.length;
	}
	const localBlock = Buffer.concat(locals);
	const centralBlock = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(members.length, 8);
	eocd.writeUInt16LE(members.length, 10);
	eocd.writeUInt32LE(centralBlock.length, 12);
	eocd.writeUInt32LE(localBlock.length, 16);
	return Buffer.concat([localBlock, centralBlock, eocd]);
}

/** Launch the production shell against a fresh vault in `dataDir`. */
async function bootShell(dataDir: string, vaultName: string): Promise<ElectronApplication> {
	const app = await _electron.launch({
		executablePath: ELECTRON_BIN,
		args: [MAIN_ENTRY, `--user-data-dir=${dataDir}`],
		cwd: SHELL_DIR,
		timeout: 120_000,
		env: shellLaunchEnv(),
	});
	const dashboard = await app.firstWindow({ timeout: 60_000 });
	await dashboard.evaluate(
		async ({ dir, name }) => {
			const bs = (window as unknown as { brainstorm: any }).brainstorm;
			if ((await bs.vaults.list()).length === 0) {
				await bs.vaults.create({ name, path: `${dir}/vault` });
			}
			if (!(await bs.vaults.session())) {
				const list = await bs.vaults.list();
				await bs.vaults.activate(list[0].id);
			}
		},
		{ dir: dataDir, name: vaultName },
	);
	return app;
}

const importExport = (app: ElectronApplication, method: string, ...args: unknown[]) =>
	app
		.windows()[0]!
		.evaluate(
			({ m, a }) => (window as unknown as { brainstorm: any }).brainstorm.importExport[m](...a),
			{ m: method, a: args },
		);

test("IE-6: a Notion export imports end-to-end in the real shell, idempotently", async () => {
	test.setTimeout(180_000);
	const dataDir = mkdtempSync(join(tmpdir(), "bs-notion-shell-"));
	const PID = "0123456789abcdef0123456789abcdef";
	const zipPath = join(dataDir, "notion-export.zip");
	writeFileSync(
		zipPath,
		makeStoredZip([
			{ name: `Projects ${PID}.md`, data: Buffer.from("# Projects\n\nOur roadmap.\n") },
			{
				name: `Tasks ${"2".repeat(32)}.csv`,
				data: Buffer.from("Name,Status\nShip it,Done\nTest it,Open\n"),
			},
		]),
	);

	let app: ElectronApplication | null = null;
	try {
		app = await bootShell(dataDir, "NotionImport");
		const dashboard = app.windows()[0]!;

		// Stub the native open dialog (in the MAIN process) to return the fixture.
		await app.evaluate(({ dialog }, p) => {
			(dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = async () => ({
				canceled: false,
				filePaths: [p],
			});
		}, zipPath);

		// Drive the real bridge: pick → run.
		const preview = await dashboard.evaluate(() =>
			(window as unknown as { brainstorm: any }).brainstorm.importExport.pickNotion(),
		);
		expect(preview?.pageCount, "1 page + 2 database rows").toBe(3);

		const report = await dashboard.evaluate(() =>
			(window as unknown as { brainstorm: any }).brainstorm.importExport.runNotion(
				"brainstorm/Note/v1",
			),
		);
		expect(report.created, "3 entities created on first import").toBe(3);

		// Re-pick + re-run: idempotent (0 created) → proves the rows persisted in
		// the real vault and the external-id dedupe matched them.
		await dashboard.evaluate(() =>
			(window as unknown as { brainstorm: any }).brainstorm.importExport.pickNotion(),
		);
		const second = await dashboard.evaluate(() =>
			(window as unknown as { brainstorm: any }).brainstorm.importExport.runNotion(
				"brainstorm/Note/v1",
			),
		);
		expect(second.created, "re-import creates nothing (idempotent)").toBe(0);
		expect(second.updated, "re-import updates the existing rows").toBe(3);
	} finally {
		await app?.close().catch(() => undefined);
		rmSync(dataDir, { recursive: true, force: true });
	}
});

test("IE-5: an Obsidian folder + .canvas imports end-to-end in the real shell", async () => {
	test.setTimeout(180_000);
	const dataDir = mkdtempSync(join(tmpdir(), "bs-obsidian-shell-"));
	const vaultFolder = join(dataDir, "my-vault");
	mkdirSync(vaultFolder, { recursive: true });
	writeFileSync(
		join(vaultFolder, "Alpha.md"),
		"---\ntitle: Alpha\n---\nSee [[Beta]] and ![[wire.png]].\n",
	);
	writeFileSync(join(vaultFolder, "Beta.md"), "Back to [[Alpha]].\n");
	writeFileSync(join(vaultFolder, "wire.png"), Buffer.from([1, 2, 3, 4]));
	writeFileSync(
		join(vaultFolder, "Board.canvas"),
		JSON.stringify({
			nodes: [
				{ id: "n1", type: "text", text: "One", x: 0, y: 0 },
				{ id: "n2", type: "text", text: "Two", x: 200, y: 0 },
			],
			edges: [{ id: "c1", fromNode: "n1", toNode: "n2" }],
		}),
	);

	let app: ElectronApplication | null = null;
	try {
		app = await bootShell(dataDir, "ObsidianImport");
		await app.evaluate(({ dialog }, folder) => {
			(dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = async () => ({
				canceled: false,
				filePaths: [folder],
			});
		}, vaultFolder);

		const preview = (await importExport(app, "pickObsidian")) as { noteCount: number };
		expect(preview.noteCount, "2 markdown notes").toBe(2);

		const report = (await importExport(app, "runObsidian", "brainstorm/Note/v1")) as {
			created: number;
		};
		// 2 notes + 1 referenced File/v1 + 1 Whiteboard + 1 edge.
		expect(report.created, "notes + file + board + edge").toBe(5);
	} finally {
		await app?.close().catch(() => undefined);
		rmSync(dataDir, { recursive: true, force: true });
	}
});
