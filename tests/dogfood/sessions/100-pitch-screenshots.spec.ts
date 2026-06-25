import { test } from "@playwright/test";
import { APP, type AppId, startSession } from "../lib/founder";

/**
 * Pitch-deck capture session. Not a founder narrative — it dresses the
 * persistent Northbound vault in the Rose theme + the pink low-poly wallpaper
 * and captures high-resolution screenshots of each flagship app for the
 * investor deck. Output lands in `tests/dogfood/.sessions/100-pitch-screenshots/`.
 */

const ROSE = "rose";
const WALLPAPER = { kind: "image", value: "brainstorm://wallpaper/pink-low-poly.jpg" };

// Wide, retina window so each capture is crisp and roomy for the deck.
const VIEWPORT = { width: 1600, height: 1000 };

test("pitch screenshots — rose theme", async () => {
	const s = await startSession("100-pitch-screenshots");

	// Dress the workspace: force light mode, Rose theme, pink wallpaper into the
	// active (light) slot so it shows regardless of OS appearance.
	await s.dashboard.evaluate(
		async ({ theme, wallpaper }) => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: {
							setAppearanceMode: (m: string) => Promise<void>;
							setAppearancePair: (slot: string, p: { theme: string; wallpaper: unknown }) => Promise<void>;
							setTheme: (t: string) => Promise<void>;
							setWallpaper: (w: unknown, slot?: string) => Promise<void>;
						};
					};
				}
			).brainstorm.dashboard;
			await bs.setAppearanceMode("light");
			await bs.setAppearancePair("light", { theme, wallpaper });
			await bs.setTheme(theme);
			await bs.setWallpaper(wallpaper, "light");
		},
		{ theme: ROSE, wallpaper: WALLPAPER },
	);

	// Give the dashboard a beat to repaint with the new wallpaper + theme.
	await s.dashboard.waitForTimeout(1500);
	await s.dashboard.setViewportSize(VIEWPORT);
	await s.dashboard.waitForTimeout(800);

	// Hero: the desktop/dashboard itself (wallpaper + pinned apps + widgets).
	await s.dashboard.screenshot({
		path: `${process.cwd()}/tests/dogfood/.sessions/100-pitch-screenshots/00-dashboard.png`,
		scale: "device",
	});

	// Flagship apps to capture, in deck order.
	const targets: Array<{ id: AppId; label: string }> = [
		{ id: APP.Notes, label: "notes" },
		{ id: APP.Database, label: "database" },
		{ id: APP.Graph, label: "graph" },
		{ id: APP.Calendar, label: "calendar" },
		{ id: APP.Whiteboard, label: "whiteboard" },
		{ id: APP.Tasks, label: "tasks" },
		{ id: APP.Agent, label: "agent" },
		{ id: APP.Journal, label: "journal" },
	];

	for (const { id, label } of targets) {
		try {
			const page = await s.openApp(id);
			await page.setViewportSize(VIEWPORT).catch(() => undefined);
			// Let the app mount, hydrate live entities, and settle layout/animation.
			await page.waitForTimeout(3500);
			await page.screenshot({
				path: `${process.cwd()}/tests/dogfood/.sessions/100-pitch-screenshots/${label}.png`,
				scale: "device",
			});
			s.note(`captured ${label}`);
		} catch (err) {
			s.note(`FAILED ${label}: ${(err as Error).message}`);
		}
	}

	await s.finish();
});
