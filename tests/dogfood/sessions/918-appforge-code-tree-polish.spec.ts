/**
 * Session 918 — polish sweep over the surfaces added after 0.11.1.
 *
 * Part A — Code editor FILES tree (#372): indentation, carets, New file /
 * New folder affordances, a deep path, a very long filename, collapse state
 * and the empty state, in both appearances.
 *
 * Part B — AppForge install flows (#364/#366/#371): the Marketplace toolbar
 * row (chips + search + "Install from…"), the install-from menu, the
 * from-vault picker (empty AND populated), the consent sheet stacked over it,
 * and the installed-app detail with the unsigned advisory.
 *
 * The vault fixture is written through the code editor's own entities
 * service, so the from-vault picker sees a real `manifest.json` candidate.
 */

import { test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const CODE_FILE = "brainstorm/CodeFile/v1";

const LONG_NAME =
	"quarterly-revenue-reconciliation-pipeline-with-a-deliberately-long-name.config.ts";

type Seed = { path: string; content: string; language: string };

const SEEDS: Seed[] = [
	{
		path: "milestones/manifest.json",
		content: JSON.stringify(
			{
				id: "io.northbound.milestones",
				name: "Milestones",
				version: "0.1.0",
				sdk: "1",
				entry: "index.html",
				capabilities: ["vault.entities:read", "vault.entities:write"],
			},
			null,
			2,
		),
		language: "json",
	},
	{
		path: "milestones/index.html",
		content: "<!doctype html>\n<title>Milestones</title>\n<div id=root></div>\n",
		language: "html",
	},
	{
		path: "milestones/src/app.ts",
		content: "export function boot(): void {\n\tconsole.log('milestones');\n}\n",
		language: "typescript",
	},
	{
		path: `milestones/src/config/${LONG_NAME}`,
		content: "export const config = { retries: 3 };\n",
		language: "typescript",
	},
	{
		path: "milestones/src/ui/panels/inspector/deep/nested/leaf.ts",
		content: "export const leaf = 1;\n",
		language: "typescript",
	},
	{
		path: "broken-app/manifest.json",
		content: '{ "name": "No id here" }',
		language: "json",
	},
];

test("918 — code tree + AppForge install polish", async () => {
	test.setTimeout(600_000);
	const s = await startSession("918-appforge-code-tree-polish");
	const dash = s.dashboard;
	await dash.waitForTimeout(1500);
	await dash.keyboard.press("Escape");

	// ---------- Part A: the FILES tree ----------
	const code = await s.openApp(APP.CodeEditor);
	await code.waitForTimeout(2500);

	// Empty state first (a fresh vault has no code files).
	await s.shot(code, "code-empty-state-light");

	await code.evaluate(
		async ({ type, seeds }) => {
			const services = (
				window as unknown as {
					brainstorm?: {
						services?: {
							entities?: {
								create?: (t: string, p: Record<string, unknown>) => Promise<{ id: string }>;
							};
							vaultEntities?: {
								list?: () => Promise<{
									entities: Array<{ type: string; properties: Record<string, unknown> }>;
								}>;
							};
						};
					};
				}
			).brainstorm?.services;
			const create = services?.entities?.create;
			if (!create) throw new Error("918: no entities.create in the code editor runtime");
			const snapshot = await services?.vaultEntities?.list?.();
			const existing = new Set(
				(snapshot?.entities ?? [])
					.filter((e) => e.type === type)
					.map((e) => String(e.properties.path ?? "")),
			);
			for (const seed of seeds) {
				if (existing.has(seed.path)) continue;
				await create(type, { path: seed.path, content: seed.content, language: seed.language });
			}
		},
		{ type: CODE_FILE, seeds: SEEDS },
	);
	await code.waitForTimeout(2500);
	await s.shot(code, "code-tree-light");
	const sidebar = code.locator(".editor__files").first();
	await s.shot(code, "code-tree-sidebar-light", sidebar);

	// Collapse a mid-level folder via its caret, then re-shoot.
	const srcRow = code.locator('.editor__folder[data-folder-path="milestones/src"]').first();
	if ((await srcRow.count()) > 0) {
		await srcRow.click();
		await code.waitForTimeout(500);
		await code.keyboard.press("ArrowLeft");
		await code.waitForTimeout(600);
		await s.shot(code, "code-tree-collapsed-light", sidebar);
		await code.keyboard.press("ArrowRight");
		await code.waitForTimeout(600);
	}

	// Row geometry — the "one content column" check, measured not eyeballed.
	const geometry = await code.evaluate(() => {
		const rows = Array.from(document.querySelectorAll(".editor__row"));
		const head = document.querySelector(".editor__files-heading");
		const out: string[] = [];
		if (head) out.push(`heading FILES left=${Math.round(head.getBoundingClientRect().left)}`);
		for (const row of rows) {
			const el = row as HTMLElement;
			const label = el.querySelector(".editor__file-name, .editor__folder-name, span");
			const icon = el.querySelector("svg");
			const kind = el.classList.contains("editor__folder") ? "folder" : "file";
			out.push(
				`${kind} path=${el.dataset.folderPath ?? el.textContent?.trim().slice(0, 28)} ` +
					`row=${Math.round(el.getBoundingClientRect().left)} ` +
					`h=${Math.round(el.getBoundingClientRect().height)} ` +
					`icon=${icon ? Math.round(icon.getBoundingClientRect().left) : "-"} ` +
					`label=${label ? Math.round(label.getBoundingClientRect().left) : "-"}`,
			);
		}
		return out.join("\n");
	});
	s.note(`\n### FILES tree geometry\n\`\`\`\n${geometry}\n\`\`\`\n`);

	// Folder row ⋯ menu.
	const folderRow = code.locator('.editor__folder[data-folder-path="milestones"]').first();
	if ((await folderRow.count()) > 0) {
		await folderRow.hover();
		await code.waitForTimeout(300);
		await s.shot(code, "code-folder-row-hover-light", sidebar);
		const more = folderRow.locator(".bs-object-menu__more").first();
		if ((await more.count()) > 0) {
			await more.click({ force: true }).catch(() => undefined);
			await code.waitForTimeout(800);
			await s.shot(code, "code-folder-menu-light");
			await code.keyboard.press("Escape");
			await code.waitForTimeout(400);
		}
	}

	// The right panel — diagnostics band + REFERENCES header stacked.
	const rightPanel = code.locator(".editor__aside, .editor__references, .editor__right").first();
	if ((await rightPanel.count()) > 0) {
		await s.shot(code, "code-right-panel-light", rightPanel);
	}
	await s.shot(code, "code-header-light", code.locator(".app-header").first());

	// New folder affordance (header button) — the rename popover it arms.
	const newFolder = code.locator('.editor__files-actions button[aria-label]').first();
	if ((await newFolder.count()) > 0) {
		await newFolder.click();
		await code.waitForTimeout(900);
		await s.shot(code, "code-new-folder-light");
		await code.keyboard.press("Escape");
		await code.waitForTimeout(400);
	}

	// New file affordance.
	const newFile = code.locator(".editor__file-new").first();
	if ((await newFile.count()) > 0) {
		await newFile.click();
		await code.waitForTimeout(1400);
		await s.shot(code, "code-new-file-rename-light");
		await code.keyboard.press("Escape");
		await code.waitForTimeout(500);
	}

	// ---------- Part B: Marketplace install flows (light) ----------
	const openMarket = async () => {
		await dash.locator('[aria-label="Open Marketplace"]').first().click();
		await dash.waitForTimeout(1400);
	};
	await openMarket();
	await s.shot(dash, "market-toolbar-light");
	const toolbar = dash.locator(".marketplace__toolbar").first();
	await s.shot(dash, "market-toolbar-zoom-light", toolbar);

	const installBtn = dash.locator(".marketplace__toolbar button", { hasText: "Install from" }).first();
	await installBtn.click();
	await dash.waitForTimeout(900);
	await s.shot(dash, "market-install-menu-light");

	const fromVault = dash.locator(".fm-row", { hasText: "From vault code files" }).first();
	await fromVault.click();
	await dash.waitForTimeout(2000);
	await s.shot(dash, "market-vault-picker-light");

	// Consent sheet stacked over the picker (the #371 fix surface).
	const installRow = dash
		.locator(".marketplace__vault-sources .marketplace__update-row", { hasText: "Milestones" })
		.first();
	if ((await installRow.count()) > 0) {
		await installRow.locator("button").first().click();
		await dash.waitForTimeout(1200);
		await s.shot(dash, "market-consent-sheet-light");
	}

	// ---------- Dark appearance sweep of the same surfaces ----------
	await dash.keyboard.press("Escape");
	await dash.waitForTimeout(500);
	await dash.keyboard.press("Escape");
	await dash.waitForTimeout(500);
	await dash.keyboard.press("Escape");
	await dash.waitForTimeout(800);
	const toDark = dash.locator('[aria-label="Switch to Dark appearance"]').first();
	if ((await toDark.count()) > 0) {
		await toDark.click();
		await dash.waitForTimeout(1200);
	}
	await s.shot(code, "code-tree-dark", sidebar);

	await openMarket();
	await s.shot(dash, "market-toolbar-dark");
	await s.shot(dash, "market-toolbar-zoom-dark", dash.locator(".marketplace__toolbar").first());
	await dash
		.locator(".marketplace__toolbar button", { hasText: "Install from" })
		.first()
		.click();
	await dash.waitForTimeout(900);
	await s.shot(dash, "market-install-menu-dark");
	await dash.locator(".fm-row", { hasText: "From vault code files" }).first().click();
	await dash.waitForTimeout(2000);
	await s.shot(dash, "market-vault-picker-dark");

	// Install for real from the dark pass so the toast + detail can be read.
	const darkRow = dash
		.locator(".marketplace__vault-sources .marketplace__update-row", { hasText: "Milestones" })
		.first();
	if ((await darkRow.count()) > 0) {
		await darkRow.locator("button").first().click();
		await dash.waitForTimeout(1200);
		await s.shot(dash, "market-consent-sheet-dark");
		const confirmBtn = dash.locator('.popover button', { hasText: /^Install$/ }).last();
		if ((await confirmBtn.count()) > 0) {
			await confirmBtn.click();
			await dash.waitForTimeout(3500);
			await s.shot(dash, "market-installed-toast-dark");
		}
	}

	// The installed app's detail — unsigned advisory chip.
	const card = dash.locator(".marketplace__card", { hasText: "Milestones" }).first();
	if ((await card.count()) > 0) {
		await card.click();
		await dash.waitForTimeout(1200);
		await s.shot(dash, "market-detail-unsigned-dark");
	}

	await dash.keyboard.press("Escape");
	await dash.waitForTimeout(600);
	const toLight = dash.locator('[aria-label="Switch to Light appearance"]').first();
	if ((await toLight.count()) > 0) {
		await toLight.click();
		await dash.waitForTimeout(900);
	}
	await s.finish();
});
