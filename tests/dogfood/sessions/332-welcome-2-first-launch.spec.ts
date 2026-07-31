/**
 * Welcome-2 (9.3.5.V 7d) — **real-shell first-launch verification**. The template
 * gallery UI, the `welcome.listTemplates` / `importTemplate` IPC, and the import
 * pipeline are all unit/in-process tested; what no automated layer exercised is
 * the gallery actually MOUNTING + driving in a real Electron renderer (jsdom
 * can't catch a real-Electron mount regression — e.g. a stripped type-only
 * import killing an icon, per CLAUDE.md). This boots a FRESH user-data dir so the
 * Welcome flow shows, drives it through the gallery to vault creation, and
 * asserts the dashboard takes over — the one gate the plan left open for
 * Welcome-2.
 *
 * Native folder picker is avoided: the location field is an editable input that
 * auto-fills from `defaultPath(name)`, so we just type a name + a temp path and
 * submit (the same path the jsdom wiring test drives, but in real Electron).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ElectronApplication, type Page, _electron, expect, test } from "@playwright/test";
import { shellLaunchEnv } from "../lib/shell-launch-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SHELL_DIR = join(REPO_ROOT, "packages", "shell");
const ELECTRON_BIN = join(SHELL_DIR, "node_modules", ".bin", "electron");
const MAIN_ENTRY = join(SHELL_DIR, "out", "main", "index.js");

/** Tiles we expect the bundled registry to surface (a representative subset of
 *  the seven — see `template-registry.ts`). */
const EXPECTED_TILES = ["project-management", "research", "journaling"] as const;
const CHOSEN_TEMPLATE = "research";

test("Welcome-2 — fresh launch shows the template gallery and a chosen template creates the vault", async () => {
	test.setTimeout(180_000);
	const userDataDir = mkdtempSync(join(tmpdir(), "bs-welcome-first-launch-"));
	let app: ElectronApplication | undefined;
	const consoleErrors: string[] = [];
	try {
		app = await _electron.launch({
			executablePath: ELECTRON_BIN,
			args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
			cwd: SHELL_DIR,
			timeout: 120_000,
			env: shellLaunchEnv(),
		});

		const win: Page = await app.firstWindow({ timeout: 60_000 });
		win.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});
		win.on("pageerror", (err) => consoleErrors.push(err.message));

		// 1. Fresh launch → the Welcome menu (no vault yet).
		const createCta = win.locator('[data-testid="welcome-create-cta"]');
		await expect(createCta).toBeVisible({ timeout: 30_000 });
		await createCta.click();

		// 2. Create step — name (path auto-fills) + a contained temp path so the
		//    new vault lands under our temp dir, not the user's real Documents.
		const nameInput = win.locator("input.welcome__input").first();
		await expect(nameInput).toBeVisible();
		await nameInput.fill("First Launch");
		const pathInput = win.locator(".welcome__path-row input.welcome__input");
		await pathInput.fill(join(userDataDir, "vault"));

		// 3. Continue → the "Start" step (one mode-driven form, submit advances).
		await win.evaluate(() => document.querySelector("form")?.requestSubmit());

		// 4. The template gallery mounts in real Electron with its tiles.
		await expect(win.locator('[data-testid="welcome-templates"]')).toBeVisible({ timeout: 15_000 });
		for (const id of EXPECTED_TILES) {
			await expect(win.locator(`[data-testid="welcome-template-${id}"]`)).toBeVisible();
		}

		// 5. Pick a template → it reads as pressed (single-select state works).
		const chosen = win.locator(`[data-testid="welcome-template-${CHOSEN_TEMPLATE}"]`);
		await chosen.click();
		await expect(chosen).toHaveAttribute("aria-pressed", "true");

		// 6. Create the vault → doCreate runs vault create + importTemplate.
		await win.evaluate(() => document.querySelector("form")?.requestSubmit());

		// 7. Onboarding completes: the active vault becomes current, so the Welcome
		//    surface unmounts and the dashboard takes over (the welcome menu CTA is
		//    gone and a vault is active).
		await expect
			.poll(
				() =>
					win.evaluate(async () => {
						const bs = (
							window as unknown as { brainstorm: { vaults: { session: () => Promise<unknown> } } }
						).brainstorm;
						return Boolean(await bs.vaults.session());
					}),
				{ timeout: 60_000, intervals: [250, 500, 1000] },
			)
			.toBe(true);
		await expect(win.locator('[data-testid="welcome-create-cta"]')).toHaveCount(0);

		// 8. No renderer errors during the first-launch flow (a real-Electron mount
		//    regression — stripped type-import, missing icon — would surface here).
		expect(
			consoleErrors,
			`renderer errors during first-launch:\n${consoleErrors.join("\n")}`,
		).toEqual([]);
	} finally {
		await app?.close().catch(() => undefined);
		rmSync(userDataDir, { recursive: true, force: true });
	}
});
