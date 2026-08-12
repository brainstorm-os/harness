/**
 * An IMAGE wallpaper for the dogfood rig.
 *
 * Every wallpaper-dependent surface in the shell was, until this module,
 * structurally invisible to the screenshot gate: Mira's Northbound vault runs
 * on SOLID slots (light `#f7f7f7` / dark `#161616`), so `--app-wallpaper-image`
 * is unset in every capture and the app-header wallpaper stripe never paints.
 * Probe 940 recorded that as an honest coverage gap — a gate that cannot see a
 * feature certifies nothing about it.
 *
 * So this module seeds one, through the SAME path a user takes: it writes a
 * fixture PNG to a temp file, stubs the native open-dialog for exactly one
 * call, and drives `dashboard.uploadWallpaper()` → `dashboard.setWallpaper()`.
 * That means the sealed-at-rest write, the thumbnail, and the
 * `brainstorm://wallpaper/` protocol all run for real; nothing hand-writes
 * vault state.
 *
 * The fixture image is deliberately a coarse colour grid rather than a
 * photograph. The stripe blurs whatever it samples by `--glass-blur`, which
 * destroys fine detail — but a 4×3 field of strongly separated hues survives
 * the blur, so the colour in a 44 px header strip identifies WHICH REGION of
 * the wallpaper is being painted. That is the only property a capture of this
 * feature has to be able to show.
 *
 * The caller MUST restore: `seedImageWallpaper` returns the previous appearance
 * state and `restoreWallpaper` puts it back. Mira's vault is permanent and is
 * never left mutated by a probe.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import type { ElectronApplication, Page } from "@playwright/test";

/** Natural size of the fixture wallpaper. Wider than it is tall, and a
 *  different aspect ratio from any window the rig opens, so a cover-fit that
 *  ignored the basis would land visibly wrong. */
export const FIXTURE_WALLPAPER_SIZE = { width: 1920, height: 1200 } as const;

/** Mirror of the shell's `DashboardWallpaper`. The harness has no dependency on
 *  the shell workspace, so the wire shape is re-declared. */
export type HarnessWallpaper = { kind: string; value: string };

/** Both appearance slots plus the mode, i.e. everything `setWallpaper` can
 *  disturb. Captured before seeding so the vault can be put back exactly. */
export type AppearanceSnapshot = {
	mode: string | null;
	slots: Record<string, { wallpaper?: HarnessWallpaper } | undefined>;
};

type DashboardBridge = {
	brainstorm: {
		dashboard: {
			snapshot: () => Promise<{
				appearance?: { mode?: string; light?: unknown; dark?: unknown };
			} | null>;
			setWallpaper: (wallpaper: HarnessWallpaper, slot?: string) => Promise<void>;
			uploadWallpaper: () => Promise<{ url: string; thumbUrl: string } | null>;
		};
	};
};

// ── PNG encoding ────────────────────────────────────────────────────────────
// A dependency-free encoder: one IDAT of unfiltered 8-bit RGB scanlines. The
// rig must be able to mint a fixture on any machine without adding an image
// library to the harness.

const CRC_TABLE = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
})();

function crc32(bytes: Buffer): number {
	let c = -1;
	for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([length, body, crc]);
}

function encodePng(
	width: number,
	height: number,
	pixel: (x: number, y: number) => [number, number, number],
): Buffer {
	const stride = width * 3 + 1;
	const raw = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		let offset = y * stride + 1; // leading 0 = filter type "none"
		for (let x = 0; x < width; x++) {
			const [r, g, b] = pixel(x, y);
			raw[offset++] = r;
			raw[offset++] = g;
			raw[offset++] = b;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", deflateSync(raw, { level: 6 })),
		pngChunk("IEND", Buffer.alloc(0)),
	]);
}

/** Twelve well-separated hues, one per cell of a 4×3 grid. Chosen so any two
 *  neighbours differ in more than one channel — after a 10 px blur the boundary
 *  smears, but the cell centres stay unmistakable. */
const CELL_COLOURS: ReadonlyArray<[number, number, number]> = [
	[214, 69, 65],
	[232, 138, 46],
	[233, 199, 60],
	[126, 189, 68],
	[52, 160, 118],
	[46, 149, 196],
	[54, 96, 184],
	[110, 74, 186],
	[176, 68, 168],
	[214, 84, 124],
	[92, 104, 122],
	[36, 44, 58],
];

/** Write the fixture wallpaper to a temp file and return its path. A gentle
 *  vertical gradient rides on top of the grid so a REGION within one cell is
 *  still distinguishable from another region of the same cell. */
export function writeFixtureWallpaper(): string {
	const { width, height } = FIXTURE_WALLPAPER_SIZE;
	const cols = 4;
	const rows = 3;
	const cellW = width / cols;
	const cellH = height / rows;
	const png = encodePng(width, height, (x, y) => {
		const index = Math.min(rows - 1, Math.floor(y / cellH)) * cols + Math.min(cols - 1, Math.floor(x / cellW));
		const [r, g, b] = CELL_COLOURS[index] ?? [0, 0, 0];
		// −18…+18 across the cell's height: enough to read a vertical offset,
		// small enough not to blur into the neighbouring cell's identity.
		const shade = Math.round(((y % cellH) / cellH - 0.5) * 36);
		const clamp = (v: number) => Math.max(0, Math.min(255, v + shade));
		return [clamp(r), clamp(g), clamp(b)];
	});
	const dir = mkdtempSync(join(tmpdir(), "brainstorm-wallpaper-fixture-"));
	const file = join(dir, "region-grid.png");
	writeFileSync(file, png);
	return file;
}

/** Read everything `setWallpaper` can disturb, so a probe can put it back. */
export async function readAppearanceSnapshot(dash: Page): Promise<AppearanceSnapshot> {
	return dash.evaluate(async () => {
		const bs = (window as unknown as DashboardBridge).brainstorm;
		const snapshot = await bs.dashboard.snapshot();
		const appearance = (snapshot?.appearance ?? {}) as Record<string, unknown>;
		return {
			mode: (appearance.mode as string | undefined) ?? null,
			slots: {
				light: appearance.light as { wallpaper?: HarnessWallpaper } | undefined,
				dark: appearance.dark as { wallpaper?: HarnessWallpaper } | undefined,
			},
		};
	});
}

/**
 * Install an image wallpaper into BOTH appearance slots, through the real
 * upload path. Both slots on purpose: a probe that flips light/dark to prove
 * the stripe follows the switch must not fall off an image slot onto a solid
 * one and read the absence as a bug.
 *
 * Returns the `brainstorm://wallpaper/…` URL that was installed.
 */
export async function seedImageWallpaper(
	app: ElectronApplication,
	dash: Page,
): Promise<{ url: string; sourcePath: string }> {
	const sourcePath = writeFixtureWallpaper();
	// Stub the native picker for exactly one call, then restore it. Left
	// installed, it would silently answer every later dialog in the session.
	await app.evaluate(async ({ dialog }, path) => {
		const original = dialog.showOpenDialog;
		(dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = async () => {
			(dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = original;
			return { canceled: false, filePaths: [path] };
		};
	}, sourcePath);

	const url = await dash.evaluate(async () => {
		const bs = (window as unknown as DashboardBridge).brainstorm;
		const uploaded = await bs.dashboard.uploadWallpaper();
		if (!uploaded) return null;
		for (const slot of ["light", "dark"]) {
			await bs.dashboard.setWallpaper({ kind: "image", value: uploaded.url }, slot);
		}
		return uploaded.url;
	});
	if (!url) throw new Error("wallpaper-fixture: uploadWallpaper() returned null");
	return { url, sourcePath };
}

/** Put every slot back the way the vault had it. Best-effort per slot so one
 *  failure cannot leave the other slot mutated. */
export async function restoreWallpaper(dash: Page, before: AppearanceSnapshot): Promise<void> {
	await dash.evaluate(async (snapshot) => {
		const bs = (window as unknown as DashboardBridge).brainstorm;
		for (const [slot, state] of Object.entries(snapshot.slots)) {
			const wallpaper = state?.wallpaper;
			if (!wallpaper) continue;
			try {
				await bs.dashboard.setWallpaper(wallpaper, slot);
			} catch {
				// keep going — the other slot still has to be restored
			}
		}
	}, before);
}
