/**
 * Session 175 — 9.8.14 in-window breadcrumbs check. Mira navigates into nested
 * folders and expects the header path to show where she is and let her jump
 * back up by clicking an ancestor crumb. Drives the folders already in her
 * vault (root has ≥1), reads the breadcrumb at each depth, then clicks the root
 * crumb to navigate back. Real-shell validation of the 9.8.14 slice
 * (derivation + render + live nav).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const ROW = '[data-testid="content-row"]';
const SEGMENTS = ".breadcrumb__segment, .breadcrumb__ellipsis";

test("breadcrumbs reflect folder path and navigate on ancestor click (9.8.14)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("175-files-breadcrumbs-check");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(1500);

		const crumbs = () =>
			files
				.locator(SEGMENTS)
				.allInnerTexts()
				.then((t) => t.map((x) => x.trim()))
				.catch(() => [] as string[]);
		const currentCrumb = () =>
			files
				.locator('.breadcrumb__segment[aria-current="page"]')
				.innerText()
				.then((t) => t.trim())
				.catch(() => "");

		// At root: a single non-link current crumb (no ancestor buttons).
		const rootCrumbs = await crumbs();
		const rootCurrent = await currentCrumb();
		const rootButtons = await files.locator("button.breadcrumb__segment").count();
		s.note(
			`Root: crumbs=${JSON.stringify(rootCrumbs)} current="${rootCurrent}" ancestorButtons=${rootButtons}`,
		);
		await s.shot(files, "01-root");
		expect(rootCrumbs.length).toBe(1);
		expect(rootButtons).toBe(0);
		const rootLabel = rootCurrent;

		// Descend into folders as deep as the vault allows (drive the first
		// folder row at each level), recording the breadcrumb each step.
		let depth = 0;
		let deepestName = rootLabel;
		for (; depth < 5; depth++) {
			const firstFolder = files.locator(`${ROW}[data-id]`).first();
			if ((await firstFolder.count()) === 0) break;
			const rowText = (await firstFolder.innerText().catch(() => "")).trim().split("\n")[0];
			await firstFolder.dblclick();
			await files.waitForTimeout(800);
			const here = await crumbs();
			const cur = await currentCrumb();
			// dblclick on a file (not a folder) opens it elsewhere and the path
			// won't have grown — stop descending in that case.
			if (here.length <= depth + 1) {
				s.note(`Row "${rowText}" did not deepen the path (likely a file, not a folder) — stop.`);
				break;
			}
			deepestName = cur;
			s.note(`Depth ${depth + 1}: crumbs=${JSON.stringify(here)} current="${cur}"`);
			await s.shot(files, `0${depth + 2}-depth-${depth + 1}`);
		}

		expect(depth).toBeGreaterThanOrEqual(1); // navigated into at least one folder
		const deepCrumbs = await crumbs();
		const deepCurrent = await currentCrumb();
		const deepButtons = await files.locator("button.breadcrumb__segment").count();
		s.note(
			`Deepest: crumbs=${JSON.stringify(deepCrumbs)} current="${deepCurrent}" ancestorButtons=${deepButtons}`,
		);
		expect(deepCrumbs.length).toBeGreaterThanOrEqual(2);
		expect(deepCurrent).toBe(deepestName);
		expect(deepButtons).toBeGreaterThanOrEqual(1); // root (+ deeper) are clickable

		// Click the root ancestor crumb → jump all the way back; the path
		// collapses to the single root crumb again.
		const rootButton = files.locator("button.breadcrumb__segment", { hasText: rootLabel }).first();
		await rootButton.click();
		await files.waitForTimeout(800);
		const backCrumbs = await crumbs();
		const backCurrent = await currentCrumb();
		s.note(
			`After clicking root crumb: crumbs=${JSON.stringify(backCrumbs)} current="${backCurrent}"`,
		);
		await s.shot(files, "09-back-at-root");
		expect(backCrumbs.length).toBe(1);
		expect(backCurrent).toBe(rootLabel);
	} finally {
		await s.finish();
	}
});
