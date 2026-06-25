import { test } from "@playwright/test";
import { startSession } from "../lib/founder";

const OUT = `${process.cwd()}/tests/dogfood/.sessions/100-pitch-screenshots`;
const WALLPAPER = { kind: "image", value: "brainstorm://wallpaper/lake.jpg" };

type IconRecord = { x: number; y: number; kind: string; target: string; label: string };
type DashApi = {
	snapshot: () => Promise<{ icons: Record<string, IconRecord> } | null>;
	setAppearanceMode: (m: string) => Promise<void>;
	setAppearancePair: (slot: string, p: { theme: string; wallpaper: unknown }) => Promise<void>;
	setTheme: (t: string) => Promise<void>;
	setWallpaper: (w: unknown, slot?: string) => Promise<void>;
	moveIcon: (id: string, x: number, y: number) => Promise<void>;
};

// Re-capture the dashboard hero: new (self-generated) lake wallpaper + Rose
// theme, with the app icons re-laid into a balanced 7-wide block in the upper
// left so the mountain/lake composition reads behind them.
test("pitch screenshots — dashboard hero v2", async () => {
	const s = await startSession("103-pitch-dashboard");

	await s.dashboard.evaluate(
		async ({ wallpaper }) => {
			const d = (window as unknown as { brainstorm: { dashboard: DashApi } }).brainstorm.dashboard;
			await d.setAppearanceMode("light");
			await d.setAppearancePair("light", { theme: "rose", wallpaper });
			await d.setWallpaper(wallpaper, "light");

			// Re-arrange icons: read current set, keep reading order, lay out as a
			// centered-left grid (7 columns) on the 14×6 grid.
			const snap = await d.snapshot();
			const entries = Object.entries(snap?.icons ?? {});
			entries.sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x);
			const COLS = 7;
			const startCol = 1;
			const startRow = 1;
			let i = 0;
			for (const [id] of entries) {
				const col = startCol + (i % COLS);
				const row = startRow + Math.floor(i / COLS);
				await d.moveIcon(id, col, row);
				i += 1;
			}
		},
		{ wallpaper: WALLPAPER },
	);

	await s.dashboard.setViewportSize({ width: 1600, height: 1000 });
	await s.dashboard.reload();
	await s.dashboard.waitForTimeout(2800);
	await s.dashboard.screenshot({ path: `${OUT}/00-dashboard.png`, scale: "device" });
	s.note("captured dashboard hero v2");

	await s.finish();
});
