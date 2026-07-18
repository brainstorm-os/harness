/**
 * Session 905c — thumbnail + lane-fill probe on the CURRENT import's files.
 *
 * The 905 gallery capture searches the SLUGGED name ("screenshot-2026-03-20")
 * which only matches ghost File entities from pre-F-400 imports — those never
 * get repaired, so they can't witness the assetMime fix. This probe searches
 * the display name the current source's entities actually carry
 * ("Screenshot 2026-03-20", spaces) and asserts:
 *   1. rows exist,
 *   2. tiles render an <img.content-row__thumb> whose naturalWidth > 0
 *      (the assetMime gate passes and the sealed asset actually serves),
 *   3. the tile card fills its virtualized lane (no dead gap: card height
 *      ≈ lane height).
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("current-source file tiles render real thumbnails and fill their lanes", async () => {
	const s = await startSession("905c-files-thumbnail-probe");
	try {
		const files = await s.openApp(APP.Files);
		await files.waitForTimeout(3000);

		const search = files.locator('[data-testid="toolbar-search-input"]').first();
		await search.click();
		await search.fill("Screenshot 2026-03-20");
		await files.waitForTimeout(1800);

		const rows = await files.locator(".content-row").count();
		s.note(`[probe] searching "Screenshot 2026-03-20" (display name): ${rows} row(s)`);
		expect(rows).toBeGreaterThan(0);

		// Ensure gallery mode (sticky per vault; switch via the view select if not).
		const mode = await files.evaluate(() => document.body.dataset.viewMode ?? "");
		if (mode !== "gallery") {
			await files.locator(".bs-select").last().click();
			await files.getByText("Gallery", { exact: true }).last().click();
			await files.waitForTimeout(600);
		}

		const probe = await files.evaluate(() => {
			const rows = Array.from(document.querySelectorAll(".content-row"));
			const lanes = rows.map((row) => {
				const host = row.closest(".content-row__menu-host");
				const lane = host?.parentElement;
				const laneH = lane instanceof HTMLElement ? lane.getBoundingClientRect().height : 0;
				const rowH = row.getBoundingClientRect().height;
				const img = row.querySelector("img.content-row__thumb");
				return {
					rowH: Math.round(rowH),
					laneH: Math.round(laneH),
					hasThumb: img !== null,
					thumbLoaded: img instanceof HTMLImageElement && img.naturalWidth > 0,
				};
			});
			return lanes;
		});
		const withThumb = probe.filter((p) => p.hasThumb);
		const loaded = probe.filter((p) => p.thumbLoaded);
		const laneFilled = probe.filter((p) => p.laneH === 0 || Math.abs(p.rowH - p.laneH) <= 4);
		s.note(
			`[probe] tiles=${probe.length} withThumbEl=${withThumb.length} thumbLoaded=${loaded.length} laneFilled=${laneFilled.length}/${probe.length} (rowH vs laneH sample: ${JSON.stringify(probe.slice(0, 3))})`,
		);
		await s.shot(files, "files-display-name-gallery");

		expect(withThumb.length).toBeGreaterThan(0);
		expect(loaded.length).toBe(withThumb.length);
		expect(laneFilled.length).toBe(probe.length);
	} finally {
		await s.finish();
	}
});
