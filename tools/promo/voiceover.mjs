/**
 * Render the promo voiceover — one audio file per scene into
 * `tests/dogfood/.promo/vo/`.
 *
 * Engine order (all free, no keys):
 *   1. edge-tts (`uvx edge-tts`) — MS neural voices, best free quality.
 *   2. macOS `say` — always available; robotic, but keeps the pipeline
 *      renderable end-to-end (swap the engine and re-run to upgrade).
 *
 * `PROMO_TTS=say` forces the fallback; `PROMO_VOICE` overrides the voice.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

// The scene table + output dir are selectable so the same pipeline drives both
// the 60s promo and the per-app VID-* reels (e.g. PROMO_SCENES=./notes-scenes.mjs
// PROMO_DIR=.promo-notes). Defaults are the promo.
const { SCENES } = await import(process.env.PROMO_SCENES ?? "./scenes.mjs");

const HARNESS = resolve(import.meta.dirname, "..", "..");
const VO_DIR = join(HARNESS, "tests", "dogfood", process.env.PROMO_DIR ?? ".promo", "vo");
mkdirSync(VO_DIR, { recursive: true });

const EDGE_VOICE = process.env.PROMO_VOICE ?? "en-US-AndrewMultilingualNeural";

function edgeTtsAvailable() {
	if (process.env.PROMO_TTS === "say") return false;
	try {
		execFileSync("uvx", ["edge-tts", "--help"], { stdio: "ignore", timeout: 60_000 });
		return true;
	} catch {
		return false;
	}
}

const useEdge = edgeTtsAvailable();
console.log(`[promo:vo] engine: ${useEdge ? `edge-tts (${EDGE_VOICE})` : "macOS say (fallback)"}`);

for (const scene of SCENES) {
	const out = join(VO_DIR, `${scene.id}.wav`);
	if (!scene.vo) {
		// Silent scene (slide breath) — the mix still needs a segment.
		execFileSync("ffmpeg", [
			"-y", "-loglevel", "error",
			"-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
			"-t", String(scene.seconds), out,
		]);
		console.log(`[promo:vo] ${scene.id}: silent (${scene.seconds}s)`);
		continue;
	}
	if (useEdge) {
		const mp3 = join(VO_DIR, `${scene.id}.mp3`);
		execFileSync("uvx", [
			"edge-tts",
			"--voice", EDGE_VOICE,
			"--rate", "+8%",
			"--text", scene.vo,
			"--write-media", mp3,
		]);
		execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3, "-ar", "48000", "-ac", "2", out]);
	} else {
		const aiff = join(VO_DIR, `${scene.id}.aiff`);
		execFileSync("say", ["-v", process.env.PROMO_VOICE ?? "Samantha", "-o", aiff, scene.vo]);
		execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ar", "48000", "-ac", "2", out]);
	}
	const dur = execFileSync("ffprobe", [
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		out,
	])
		.toString()
		.trim();
	const fits = Number(dur) <= scene.seconds;
	console.log(
		`[promo:vo] ${scene.id}: ${Number(dur).toFixed(2)}s / ${scene.seconds}s budget${fits ? "" : "  ⚠ OVER — tighten the line or stretch the scene"}`,
	);
	if (!existsSync(out)) throw new Error(`voiceover missing: ${out}`);
}
console.log(`[promo:vo] done → ${VO_DIR}`);
