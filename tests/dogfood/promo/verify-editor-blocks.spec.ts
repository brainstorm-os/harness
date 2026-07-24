/**
 * Editor block audit — drives the Notes editor through EVERY block type and
 * records every console error / page error, so "the editor doesn't work" becomes
 * a concrete per-block pass/fail list instead of a vibe. Screenshots each phase
 * to disk for visual inspection.
 *
 *   ./node_modules/.bin/playwright test --config=playwright.promo.config.ts verify-editor-blocks
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { beat, typeHuman } from "../lib/humanize";
import { launchPromoStage } from "../lib/promo-stage";

const HARNESS = join(import.meta.dirname, "..", "..", "..");
const DATA = join(HARNESS, "tests", "dogfood", ".verify-editor-data");
const OUT = join(HARNESS, "tests", "dogfood", ".verify-editor");
const NOTES = "io.brainstorm.notes";

test("audit every editor block", async () => {
	test.setTimeout(600_000);
	mkdirSync(OUT, { recursive: true });
	const s = await launchPromoStage({ dataDir: DATA, clipsDir: OUT });
	await s.createVault("Editor Audit", join(DATA, "vault"));
	await s.waitForSession();
	await s.seedMarketing();

	const notes = await s.openApp(NOTES);

	// Collect EVERY error — this is the signal.
	const errors: string[] = [];
	notes.on("console", (m) => {
		if (m.type() === "error") errors.push(`[console] ${m.text()}`);
	});
	notes.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
	const mark = (label: string) => errors.push(`--- after: ${label} ---`);

	const shot = (name: string) => notes.screenshot({ path: join(OUT, `${name}.png`) });

	const newNote = async () => {
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await beat(notes, 700);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await beat(notes, 300);
	};
	// Insert a block via the slash menu by typing "/<query>" then Enter (top match).
	const slash = async (query: string, label: string) => {
		await typeHuman(notes, `/${query}`, 28);
		await beat(notes, 700);
		await notes.keyboard.press("Enter").catch(() => undefined);
		await beat(notes, 600);
		mark(`slash /${query} (${label})`);
	};

	// ── Phase A: markdown-shortcut blocks ────────────────────────────────
	await newNote();
	await typeHuman(notes, "Editor block audit", 20);
	await notes.keyboard.press("Enter");
	for (const [text, label] of [
		["# Heading one", "h1"],
		["## Heading two", "h2"],
		["### Heading three", "h3"],
		["- Bullet item", "bullet"],
		["", "exit-bullet"],
		["1. Numbered item", "numbered"],
		["", "exit-numbered"],
		["[] Checklist item", "checklist"],
		["", "exit-checklist"],
		["> A block quote", "quote"],
		["", "exit-quote"],
		["--- ", "divider"],
		["`inline code`", "inline-code"],
	] as const) {
		if (text) await typeHuman(notes, text, 14);
		await notes.keyboard.press("Enter");
		mark(`markdown ${label}`);
	}
	await beat(notes, 600);
	await shot("phase-a-markdown");

	// ── Phase B: the slash palette itself ────────────────────────────────
	await newNote();
	await typeHuman(notes, "Slash palette", 20);
	await notes.keyboard.press("Enter");
	await typeHuman(notes, "/", 40);
	await beat(notes, 1200);
	await shot("phase-b-slash-menu");
	await notes.keyboard.press("Escape").catch(() => undefined);
	await notes.keyboard.press("Backspace").catch(() => undefined);

	// ── Phase C: slash-inserted blocks (one per fresh note) ──────────────
	// NOTE: image/video/file are deliberately NOT inserted here — they open a
	// native file picker that would block a headless run. Their presence in the
	// palette is audited by the phase-b slash-menu screenshot; their RENDER is
	// what the media-src CSP fix addresses.
	for (const [query, label] of [
		["code", "code block"],
		["callout", "callout"],
		["toggle", "toggle"],
		["table", "table"],
		["columns", "columns"],
		["divider", "divider"],
		["quote", "quote"],
		["embed", "embed"],
	] as const) {
		await newNote();
		await typeHuman(notes, `Block: ${label}`, 18);
		await notes.keyboard.press("Enter");
		await slash(query, label);
		await notes.keyboard.press("Escape").catch(() => undefined);
		await shot(`phase-c-${query}`);
	}

	// ── Report ───────────────────────────────────────────────────────────
	console.log("\n========= EDITOR BLOCK AUDIT — console/page errors =========");
	if (errors.length === 0) console.log("(no errors captured)");
	for (const e of errors) console.log(e);
	console.log("========= END AUDIT =========\n");

	await s.finish().catch(() => undefined);
});
