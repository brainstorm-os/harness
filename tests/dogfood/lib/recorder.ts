/**
 * Per-scene screen recorder for the promo rig — ffmpeg avfoundation capture
 * of a fixed display region (the tiled shell windows), one clip per scene.
 *
 * Why OS-level capture (not CDP screencast / page.screenshot loops): real
 * cursor rendering (`-capture_cursor 1`), real compositing, solid 60 fps at
 * Retina scale. The trade-offs: the shell must run FOCUSED (the rig omits
 * `BRAINSTORM_NO_FOCUS`), the machine must be unattended during capture, and
 * the invoking terminal needs the one-time macOS Screen-Recording permission
 * (a capture without it produces black frames — `verifyCapturePermission`
 * catches that up front).
 */

import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession, Page } from "@playwright/test";

export type CaptureRegion = {
	/** Logical (CSS) coordinates of the captured rect on the main display. */
	x: number;
	y: number;
	width: number;
	height: number;
	/** Display backing scale (Retina = 2). */
	scale: number;
};

const FFMPEG = "ffmpeg";
/** avfoundation's screen device is listed as "Capture screen 0"; its index
 *  varies with attached cameras — and the device is HIDDEN entirely until
 *  macOS Screen-Recording permission is granted to the invoking terminal.
 *  Returns null when absent (→ the rig falls back to CDP screencast). */
export function resolveScreenDeviceIndex(): number | null {
	try {
		execFileSync(FFMPEG, ["-f", "avfoundation", "-list_devices", "true", "-i", ""], {
			stdio: ["ignore", "ignore", "pipe"],
		});
	} catch (error) {
		const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
		const match = stderr.match(/\[(\d+)\]\s+Capture screen 0/);
		if (match?.[1] !== undefined) return Number(match[1]);
	}
	return null;
}

/** A recorder produces one clip per `start(name)`/`stop()` pair; `film(page)`
 *  (re)targets page-level backends at the surface currently on camera —
 *  the ffmpeg backend films the display region and ignores it. */
export type PromoRecorder = {
	start(name: string): Promise<void>;
	film(page: Page): Promise<void>;
	stop(): Promise<void>;
};

/** Picks the best available backend: ffmpeg screen capture (60fps, real
 *  cursor — needs the one-time Screen-Recording permission) when the screen
 *  device is visible, else the permission-free CDP screencast fallback
 *  (paint-driven frame rate, synthetic cursor injected by the spec).
 *  `PROMO_CAPTURE=ffmpeg|screencast` forces one. */
export function makePromoRecorder(clipsDir: string, region: CaptureRegion): PromoRecorder {
	const forced = process.env.PROMO_CAPTURE;
	if (forced === "screencast") return new ScreencastRecorder(clipsDir);
	const device = resolveScreenDeviceIndex();
	if (device !== null) return new SceneRecorder(clipsDir, region, device);
	if (forced === "ffmpeg") {
		throw new Error(
			"recorder: PROMO_CAPTURE=ffmpeg but no screen device — grant Screen Recording permission to this terminal",
		);
	}
	console.warn(
		"[promo] Screen-Recording permission not granted — falling back to CDP screencast (lower fps, synthetic cursor). Grant the permission and re-run for 60fps footage.",
	);
	return new ScreencastRecorder(clipsDir);
}

export class SceneRecorder implements PromoRecorder {
	readonly #clipsDir: string;
	readonly #region: CaptureRegion;
	readonly #device: number;
	#proc: ChildProcess | null = null;
	#currentClip: string | null = null;

	constructor(clipsDir: string, region: CaptureRegion, device: number) {
		this.#clipsDir = clipsDir;
		this.#region = region;
		this.#device = device;
		mkdirSync(clipsDir, { recursive: true });
	}

	async film(_page: Page): Promise<void> {
		// Display-level capture films whatever is frontmost — nothing to do.
	}

	/** Start recording `NN-<name>.mov`. Stops any previous scene first. */
	async start(name: string): Promise<void> {
		await this.stop();
		const clip = join(this.#clipsDir, `${name}.mov`);
		rmSync(clip, { force: true });
		const { x, y, width, height, scale } = this.#region;
		const crop = `crop=${width * scale}:${height * scale}:${x * scale}:${y * scale}`;
		this.#proc = spawn(
			FFMPEG,
			[
				"-hide_banner",
				"-loglevel", "error",
				"-f", "avfoundation",
				"-capture_cursor", "1",
				"-framerate", "60",
				"-i", `${this.#device}:none`,
				"-vf", crop,
				// Near-lossless intermediate; the render pass does the real encode.
				"-c:v", "libx264",
				"-preset", "ultrafast",
				"-crf", "14",
				"-pix_fmt", "yuv420p",
				clip,
			],
			{ stdio: ["pipe", "ignore", "inherit"] },
		);
		this.#currentClip = clip;
		// Give ffmpeg a moment to open the device before the scene action starts.
		await new Promise((r) => setTimeout(r, 900));
	}

	/** Graceful stop (`q` on stdin flushes the moov atom). */
	async stop(): Promise<void> {
		const proc = this.#proc;
		if (!proc) return;
		this.#proc = null;
		await new Promise<void>((resolveStop) => {
			proc.on("exit", () => resolveStop());
			try {
				proc.stdin?.write("q");
				proc.stdin?.end();
			} catch {
				proc.kill("SIGINT");
			}
			setTimeout(() => {
				proc.kill("SIGKILL");
				resolveStop();
			}, 5000).unref();
		});
		const clip = this.#currentClip;
		this.#currentClip = null;
		if (clip && (!existsSync(clip) || statSync(clip).size < 10_000)) {
			throw new Error(
				`recorder: ${clip} is missing/tiny — is Screen Recording permission granted to this terminal?`,
			);
		}
	}
}

/** Permission-free fallback: CDP `Page.startScreencast` frames (PNG at
 *  device scale) written per scene, assembled into a 60fps clip via the
 *  ffmpeg concat demuxer using the real inter-frame timestamps. Frame rate
 *  follows paints (~10–40fps effective); the spec injects a synthetic
 *  cursor since screencast frames don't include one. */
export class ScreencastRecorder implements PromoRecorder {
	readonly #clipsDir: string;
	#session: CDPSession | null = null;
	#page: Page | null = null;
	#frames: { file: string; ts: number }[] = [];
	#framesDir: string | null = null;
	#scene: string | null = null;
	#counter = 0;

	constructor(clipsDir: string) {
		this.#clipsDir = clipsDir;
		mkdirSync(clipsDir, { recursive: true });
	}

	async start(name: string): Promise<void> {
		await this.stop();
		this.#scene = name;
		this.#frames = [];
		this.#counter = 0;
		this.#framesDir = join(this.#clipsDir, `.frames-${name}`);
		rmSync(this.#framesDir, { recursive: true, force: true });
		mkdirSync(this.#framesDir, { recursive: true });
	}

	async film(page: Page): Promise<void> {
		await this.#detach();
		const framesDir = this.#framesDir;
		if (!framesDir) throw new Error("screencast: film() before start()");
		const session = await page.context().newCDPSession(page);
		this.#session = session;
		this.#page = page;
		session.on("Page.screencastFrame", (frame) => {
			const file = join(framesDir, `f-${String(this.#counter++).padStart(5, "0")}.png`);
			try {
				writeFileSync(file, Buffer.from(frame.data, "base64"));
				this.#frames.push({ file, ts: frame.metadata.timestamp ?? Date.now() / 1000 });
			} catch {
				// drop the frame, keep the stream alive
			}
			session
				.send("Page.screencastFrameAck", { sessionId: frame.sessionId })
				.catch(() => undefined);
		});
		await session.send("Page.startScreencast", {
			format: "png",
			maxWidth: 2880,
			maxHeight: 1620,
			everyNthFrame: 1,
		});
	}

	async #detach(): Promise<void> {
		const session = this.#session;
		this.#session = null;
		this.#page = null;
		if (!session) return;
		await session.send("Page.stopScreencast").catch(() => undefined);
		await session.detach().catch(() => undefined);
	}

	async stop(): Promise<void> {
		await this.#detach();
		const scene = this.#scene;
		const framesDir = this.#framesDir;
		this.#scene = null;
		this.#framesDir = null;
		if (!scene || !framesDir) return;
		if (this.#frames.length === 0) {
			throw new Error(`screencast: scene ${scene} captured no frames`);
		}
		// A fully static surface legitimately paints once — hold that frame.
		const single = this.#frames.length === 1;
		// concat demuxer: each frame shown until the next one's timestamp.
		const lines: string[] = [];
		for (let i = 0; i < this.#frames.length; i++) {
			const cur = this.#frames[i];
			if (!cur) continue;
			const next = this.#frames[i + 1];
			const dur = next ? Math.max(0.008, next.ts - cur.ts) : 0.4;
			lines.push(`file '${cur.file}'`, `duration ${dur.toFixed(4)}`);
		}
		const last = this.#frames[this.#frames.length - 1];
		if (last && single) lines.push(`file '${last.file}'`, "duration 5.0");
		if (last) lines.push(`file '${last.file}'`);
		const list = join(framesDir, "concat.txt");
		writeFileSync(list, `${lines.join("\n")}\n`);
		const clip = join(this.#clipsDir, `${scene}.mov`);
		execFileSync(FFMPEG, [
			"-y",
			"-hide_banner",
			"-loglevel", "error",
			"-f", "concat",
			"-safe", "0",
			"-i", list,
			"-fps_mode", "cfr",
			"-r", "60",
			"-vf", "scale=2880:1620:force_original_aspect_ratio=decrease,pad=2880:1620:(ow-iw)/2:(oh-ih)/2",
			"-c:v", "libx264",
			"-preset", "ultrafast",
			"-crf", "14",
			"-pix_fmt", "yuv420p",
			clip,
		]);
		rmSync(framesDir, { recursive: true, force: true });
		this.#frames = [];
	}
}
