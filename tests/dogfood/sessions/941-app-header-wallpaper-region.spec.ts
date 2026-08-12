/**
 * Probe 941 — does an app header paint the region of the wallpaper the window
 * is actually over?
 *
 * The owner, after seeing shell and app side by side: the app-header wallpaper
 * stripe "should just show the same region of the wallpaper in the header,
 * blurring it the same way shell does."
 *
 * The shell dashboard header is `.glass--subtle` — a genuine
 * `backdrop-filter: blur(var(--glass-blur))` over the `.dashboard__wallpaper`
 * element behind it, so it is continuous with the desktop by construction. An
 * app window is a separate Electron window with no wallpaper element behind it,
 * so the stripe has to PAINT the image — and the first version cover-fitted it
 * to the header and anchored it top-left, meaning every app window in the
 * product showed the same top slice of the photo regardless of where it was.
 * That is what made the two read as unrelated surfaces.
 *
 * ── Why this probe exists at all ────────────────────────────────────────────
 * Probe 940 recorded an honest coverage gap: Mira's vault runs SOLID wallpaper
 * slots, so `--app-wallpaper-image` is unset in every capture the rig has ever
 * taken and the stripe has never once painted under test. A screenshot gate
 * that structurally cannot see a feature certifies nothing about it. So this
 * spec seeds a real IMAGE wallpaper (`lib/wallpaper-fixture`, through the real
 * upload path) and restores the vault's own slots in `finally`.
 *
 * ── What it asserts ─────────────────────────────────────────────────────────
 * Not the arithmetic — that is unit-tested as a pure function in the shell
 * (`preload/app-wallpaper-region.test.ts`), and re-deriving it here would only
 * prove the spec agrees with itself. What it asserts is the wiring and the
 * INVARIANT the owner actually cares about:
 *
 *   A. the geometry reaches the app renderer at all (the vars exist);
 *   B. moving the window by (dx, dy) slides the sampled region by exactly
 *      (−dx, −dy) — i.e. the same wallpaper pixels stay under the same screen
 *      pixels, which IS "continuous with the desktop";
 *   C. resizing the window does NOT move the region (only the origin selects
 *      it);
 *   D. moving the DASHBOARD moves the region under every app window;
 *   E. a SOLID wallpaper paints no stripe and no broken vars.
 *
 * And it captures both headers in one run so a human can see it.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";
import {
	type AppearanceSnapshot,
	readAppearanceSnapshot,
	restoreWallpaper,
	seedImageWallpaper,
} from "../lib/wallpaper-fixture";

/** Long enough for a geometry push to cross main → renderer AND for the
 *  renderer's own one-frame coalescing timer to fire. Generous: a race read as
 *  a missed update would send the next investigation somewhere wrong. */
const SETTLE_MS = 900;

type Rect = { x: number; y: number; width: number; height: number };

/** The three inline custom properties the stripe is driven by. */
type StripeVars = {
	image: string;
	size: string;
	x: string;
	y: string;
};

/** What the ENGINE resolved for the stripe layer, after the `calc()` that adds
 *  the bleed overshoot back. Reading the vars alone would only prove the
 *  preload wrote them — this proves the CSS consumes them, which is the half a
 *  var-only reading cannot see. */
type StripePaint = { position: string; size: string; repeat: string };

async function readStripePaint(page: Page): Promise<StripePaint> {
	return page.evaluate(() => {
		const header = document.querySelector(".app-header");
		if (!header) return { position: "(no header)", size: "(no header)", repeat: "(no header)" };
		const style = getComputedStyle(header, "::before");
		return {
			position: style.backgroundPosition,
			size: style.backgroundSize,
			repeat: style.backgroundRepeat,
		};
	});
}

/** Mean RGB of an element capture — the one reading that can tell WHICH part of
 *  the fixture grid a blurred stripe is showing. */
async function meanColour(page: Page, selector: string): Promise<[number, number, number]> {
	const shot = await page.locator(selector).first().screenshot({ scale: "css" });
	const bytes = Array.from(shot);
	return page.evaluate(async (data) => {
		const bitmap = await createImageBitmap(
			new Blob([new Uint8Array(data)], { type: "image/png" }),
		);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const ctx = canvas.getContext("2d");
		if (!ctx) return [0, 0, 0] as [number, number, number];
		ctx.drawImage(bitmap, 0, 0);
		const { data: px } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		let r = 0;
		let g = 0;
		let b = 0;
		for (let i = 0; i < px.length; i += 4) {
			r += px[i] ?? 0;
			g += px[i + 1] ?? 0;
			b += px[i + 2] ?? 0;
		}
		const n = px.length / 4;
		return [r / n, g / n, b / n] as [number, number, number];
	}, bytes);
}

async function readStripeVars(page: Page): Promise<StripeVars> {
	return page.evaluate(() => {
		const read = (name: string) =>
			getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return {
			image: read("--app-wallpaper-image") || "(unset)",
			size: read("--app-wallpaper-size") || "(unset)",
			x: read("--app-wallpaper-x") || "(unset)",
			y: read("--app-wallpaper-y") || "(unset)",
		};
	});
}

function pxOf(value: string): number {
	const n = Number.parseFloat(value);
	if (!Number.isFinite(n)) throw new Error(`expected a px length, got "${value}"`);
	return n;
}

/** Move/resize an OS window by title. Titles are how the harness tells the
 *  dashboard from an app container without reaching into shell internals. */
async function setWindowBounds(
	app: Awaited<ReturnType<typeof startSession>>["app"],
	titleFragment: string,
	bounds: Rect,
): Promise<Rect | null> {
	return app.evaluate(async ({ BaseWindow }, args) => {
		const match = BaseWindow.getAllWindows().find((w) => {
			try {
				return w.getTitle().includes(args.titleFragment);
			} catch {
				return false;
			}
		});
		if (!match) return null;
		match.setBounds(args.bounds);
		return match.getContentBounds();
	}, { titleFragment, bounds });
}

async function contentBoundsOf(
	app: Awaited<ReturnType<typeof startSession>>["app"],
	titleFragment: string,
): Promise<Rect | null> {
	return app.evaluate(({ BaseWindow }, fragment) => {
		const match = BaseWindow.getAllWindows().find((w) => {
			try {
				return w.getTitle().includes(fragment);
			} catch {
				return false;
			}
		});
		return match ? match.getContentBounds() : null;
	}, titleFragment);
}

test("941 — the app header samples the wallpaper region its window sits over", async () => {
	test.setTimeout(600_000);
	const s = await startSession("941-app-header-wallpaper-region");
	const dash = s.dashboard;
	let before: AppearanceSnapshot | null = null;

	try {
		before = await readAppearanceSnapshot(dash);
		s.note(`appearance before: ${JSON.stringify(before)}`);

		// ── seed an image wallpaper ────────────────────────────────────────
		const { url } = await seedImageWallpaper(s.app, dash);
		s.note(`seeded image wallpaper: ${url}`);
		await dash.waitForTimeout(SETTLE_MS);
		await s.shot(dash, "shell-desktop-with-image-wallpaper");

		// Park the shell desktop at a known rect so the app window can be put
		// squarely over it.
		const dashBounds = await setWindowBounds(s.app, "Brainstorm", {
			x: 60,
			y: 60,
			width: 1400,
			height: 900,
		});
		s.note(`dashboard content bounds: ${JSON.stringify(dashBounds)}`);
		await dash.waitForTimeout(SETTLE_MS);

		// ── A. the geometry reaches the app renderer ───────────────────────
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(SETTLE_MS * 2);
		const notesTitle = await contentBoundsOf(s.app, "Notes");
		s.note(`notes content bounds at open: ${JSON.stringify(notesTitle)}`);

		const opened = await readStripeVars(notes);
		s.note(`stripe vars at open: ${JSON.stringify(opened)}`);
		expect(opened.image, "the app renderer received the wallpaper URL").toContain(
			"brainstorm://wallpaper/",
		);
		// This is the assertion the rig could not make before today: the stripe
		// is aimed, not merely present.
		expect(opened.size, "the region SIZE reached the app renderer").not.toBe("(unset)");
		expect(opened.x, "the region X reached the app renderer").not.toBe("(unset)");
		expect(opened.y, "the region Y reached the app renderer").not.toBe("(unset)");

		// …and that the CSS CONSUMES them. A var the stylesheet ignores writes a
		// perfect number into a property nothing paints, which is exactly what a
		// vars-only reading would certify.
		const paint = await readStripePaint(notes);
		s.note(`resolved ::before paint: ${JSON.stringify(paint)}`);
		// Read the bleed rather than hardcode it: it is an SDK constant, and a
		// spec that fossilizes it would fail for the wrong reason if it changed.
		const bleed = pxOf(
			await notes.evaluate(() =>
				getComputedStyle(document.documentElement).getPropertyValue("--app-wallpaper-bleed").trim(),
			),
		);
		expect(paint.size, "background-size is the computed region size").toBe(opened.size);
		expect(
			paint.position,
			"background-position is the computed region offset plus the bleed overshoot",
		).toBe(`${pxOf(opened.x) + bleed}px ${pxOf(opened.y) + bleed}px`);
		// Without this a window off the wallpaper tiles the image across its header
		// instead of showing nothing.
		expect(paint.repeat, "the stripe never tiles").toBe("no-repeat");

		// ── B. moving the window slides the region by exactly −delta ───────
		const start = { x: 200, y: 200, width: 900, height: 620 };
		await setWindowBounds(s.app, "Notes", start);
		await notes.waitForTimeout(SETTLE_MS);
		const atStart = await readStripeVars(notes);

		const delta = { dx: 260, dy: 140 };
		await setWindowBounds(s.app, "Notes", {
			...start,
			x: start.x + delta.dx,
			y: start.y + delta.dy,
		});
		await notes.waitForTimeout(SETTLE_MS);
		const afterMove = await readStripeVars(notes);
		s.note(`move ${JSON.stringify(delta)}: ${JSON.stringify(atStart)} → ${JSON.stringify(afterMove)}`);

		expect(
			pxOf(afterMove.x) - pxOf(atStart.x),
			"the sampled region slid left by exactly the distance the window moved right",
		).toBeCloseTo(-delta.dx, 0);
		expect(
			pxOf(afterMove.y) - pxOf(atStart.y),
			"the sampled region slid up by exactly the distance the window moved down",
		).toBeCloseTo(-delta.dy, 0);
		expect(afterMove.size, "a move does not rescale the wallpaper").toBe(atStart.size);

		// ── C. resizing selects nothing new ────────────────────────────────
		await setWindowBounds(s.app, "Notes", {
			x: start.x + delta.dx,
			y: start.y + delta.dy,
			width: 1180,
			height: 760,
		});
		await notes.waitForTimeout(SETTLE_MS);
		const afterResize = await readStripeVars(notes);
		s.note(`after resize: ${JSON.stringify(afterResize)}`);
		expect(pxOf(afterResize.x), "resizing does not move the region").toBeCloseTo(
			pxOf(afterMove.x),
			0,
		);
		expect(pxOf(afterResize.y), "resizing does not move the region").toBeCloseTo(
			pxOf(afterMove.y),
			0,
		);
		expect(afterResize.size, "resizing does not rescale the wallpaper").toBe(afterMove.size);

		// ── D. moving the DESKTOP moves the region under the app ───────────
		await setWindowBounds(s.app, "Brainstorm", {
			x: 160,
			y: 130,
			width: 1400,
			height: 900,
		});
		await notes.waitForTimeout(SETTLE_MS * 2);
		const afterDesktopMove = await readStripeVars(notes);
		s.note(`after desktop move: ${JSON.stringify(afterDesktopMove)}`);
		expect(
			pxOf(afterDesktopMove.x) - pxOf(afterResize.x),
			"dragging the desktop 100 right drags the region with it",
		).toBeCloseTo(100, 0);
		expect(
			pxOf(afterDesktopMove.y) - pxOf(afterResize.y),
			"dragging the desktop 70 down drags the region with it",
		).toBeCloseTo(70, 0);

		// ── the region is a DIFFERENT region, not just a different number ──
		// The fixture wallpaper is a 4×3 colour grid, so a window moved down by
		// exactly one grid row must show a different colour band. This is the
		// reading that catches a var written but never painted — the failure a
		// numeric assertion on the var alone cannot see.
		const ROW_STEP = Math.round((1200 * 0.75) / 3); // fixture rows, at cover scale
		await setWindowBounds(s.app, "Notes", { x: 360, y: 200, width: 1000, height: 520 });
		await notes.waitForTimeout(SETTLE_MS * 2);
		const rowA = await meanColour(notes, ".app-header");
		await s.shot(notes, "app-header-row-a", notes.locator(".app-header").first());
		await setWindowBounds(s.app, "Notes", {
			x: 360,
			y: 200 + ROW_STEP,
			width: 1000,
			height: 520,
		});
		await notes.waitForTimeout(SETTLE_MS * 2);
		const rowB = await meanColour(notes, ".app-header");
		await s.shot(notes, "app-header-row-b", notes.locator(".app-header").first());
		const bandDistance = Math.hypot(rowA[0] - rowB[0], rowA[1] - rowB[1], rowA[2] - rowB[2]);
		s.note(
			`row A ${rowA.map(Math.round)} → row B ${rowB.map(Math.round)} (distance ${bandDistance.toFixed(1)})`,
		);
		expect(
			bandDistance,
			"moving the window down one wallpaper row shows a different band of the wallpaper",
		).toBeGreaterThan(18);

		// ── the capture the owner asked for ────────────────────────────────
		// Put the Notes window back over the desktop and photograph both headers
		// in the same run: the shell's (blurred through glass) and the app's
		// (painted). Same run, same wallpaper, same blur radius.
		await setWindowBounds(s.app, "Notes", { x: 360, y: 420, width: 1000, height: 520 });
		await notes.waitForTimeout(SETTLE_MS * 2);
		const anchorShot = await s.shot(dash, "shell-desktop-and-header");
		await s.shot(dash, "shell-header-strip", dash.locator(".dashboard__header").first());
		await s.shot(notes, "app-window-over-desktop");
		await s.shot(notes, "app-header-strip", notes.locator(".app-header").first());
		const placed = await readStripeVars(notes);
		s.note(`stripe vars for the capture: ${JSON.stringify(placed)}`);

		// A side-by-side is what makes continuity legible, and the rig's windows
		// are hidden (owner rule) so there is no screen to photograph. Compose
		// the two strips into one image inside a renderer instead.
		const composite = await composeStrips(
			notes,
			await dash.locator(".dashboard__header").first().screenshot({ scale: "css" }),
			await notes.locator(".app-header").first().screenshot({ scale: "css" }),
		);
		if (composite) {
			const file = join(dirname(anchorShot), "shell-vs-app-header.png");
			writeFileSync(file, composite);
			s.note(`composite: ${file}`);
		}

		// ── E. a SOLID wallpaper paints no stripe ──────────────────────────
		await dash.evaluate(async () => {
			const bs = (
				window as unknown as {
					brainstorm: {
						dashboard: {
							setWallpaper: (w: { kind: string; value: string }, slot?: string) => Promise<void>;
						};
					};
				}
			).brainstorm;
			for (const slot of ["light", "dark"]) {
				await bs.dashboard.setWallpaper({ kind: "solid", value: "#f7f7f7" }, slot);
			}
		});
		await notes.waitForTimeout(SETTLE_MS * 2);
		const solid = await readStripeVars(notes);
		s.note(`stripe vars on a solid wallpaper: ${JSON.stringify(solid)}`);
		expect(solid.image, "a solid wallpaper clears the stripe image").toBe("(unset)");
		expect(solid.size, "a solid wallpaper clears the region size").toBe("(unset)");
		expect(solid.x, "a solid wallpaper clears the region x").toBe("(unset)");
		expect(solid.y, "a solid wallpaper clears the region y").toBe("(unset)");
		await s.shot(notes, "app-header-solid-wallpaper", notes.locator(".app-header").first());
	} finally {
		if (before) await restoreWallpaper(dash, before).catch(() => undefined);
		await s.finish();
	}
});

/**
 * Stack two PNGs vertically inside a renderer and return the bytes. Decoding
 * goes through `createImageBitmap(Blob)` rather than an `<img src="data:…">`
 * because every shell surface ships a strict CSP and a `data:` image source
 * would be refused — a Blob built from bytes already in the page is not a
 * fetch, so no policy applies.
 */
async function composeStrips(
	page: Page,
	top: Buffer,
	bottom: Buffer,
): Promise<Buffer | null> {
	try {
		const out = await page.evaluate(
			async ({ a, b }) => {
				const decode = async (bytes: number[]) =>
					createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
				const top = await decode(a);
				const bottom = await decode(b);
				const gap = 12;
				const width = Math.max(top.width, bottom.width);
				const canvas = new OffscreenCanvas(width, top.height + bottom.height + gap);
				const ctx = canvas.getContext("2d");
				if (!ctx) return null;
				ctx.fillStyle = "#8a8a8a";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(top, 0, 0);
				ctx.drawImage(bottom, 0, top.height + gap);
				const blob = await canvas.convertToBlob({ type: "image/png" });
				return Array.from(new Uint8Array(await blob.arrayBuffer()));
			},
			{ a: Array.from(top), b: Array.from(bottom) },
		);
		return out ? Buffer.from(out) : null;
	} catch {
		return null;
	}
}
