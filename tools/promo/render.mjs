/**
 * Assemble the 60s promo — trims each captured clip to its storyboard
 * length, normalises to 1920×1080@60 with quick fade in/out per scene,
 * generates the S8 title card, lays the per-scene VO track (scene-aligned),
 * optionally beds music from `tools/promo/assets/music.*`, and writes:
 *
 *   tests/dogfood/.promo/promo-60s-1080p.mp4
 *   tests/dogfood/.promo/promo-60s.srt      (upload alongside; nothing burned in)
 *
 * Inputs: clips from `promo:capture`, VO from `promo:voiceover`.
 * A missing scene clip fails loudly — rerun the capture (defensive drivers
 * make that rare); the title card needs no capture.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SCENES } from "./scenes.mjs";

const HARNESS = resolve(import.meta.dirname, "..", "..");
const PROMO = join(HARNESS, "tests", "dogfood", ".promo");
const CLIPS = join(PROMO, "clips");
const VO = join(PROMO, "vo");
const ASSETS = join(import.meta.dirname, "assets");
const OUT_MP4 = join(PROMO, "promo-60s-1080p.mp4");
const OUT_SRT = join(PROMO, "promo-60s.srt");

const FADE = 0.25;
const FPS = 60;

function ffmpeg(args) {
	execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
		stdio: ["ignore", "inherit", "inherit"],
	});
}

// ── 1. per-scene normalised segments ─────────────────────────────────────
const segments = [];
for (const scene of SCENES) {
	const seg = join(PROMO, `seg-${scene.id}.mp4`);
	const fadeOutStart = Math.max(0, scene.seconds - FADE);
	// tpad clones the final frame out to the scene budget (screencast clips
	// end when paints stop), then `-t` trims to the exact scene length.
	const vf = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=${FPS},tpad=stop_mode=clone:stop_duration=${scene.seconds},fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOutStart}:d=${FADE},setpts=PTS-STARTPTS`;
	if (scene.titleCard) {
		// Pillow renders the card (Homebrew ffmpeg has no drawtext/freetype).
		const iconCandidates = [
			join(HARNESS, "docs", "art", "icon", "icon9.png"),
			join(HARNESS, "packages", "shell", "art", "icon.png"),
		];
		const icon = iconCandidates.find((p) => existsSync(p)) ?? "-";
		const cardPng = join(PROMO, "title-card.png");
		execFileSync(
			"uv",
			["run", "--with", "pillow", "python3", join(import.meta.dirname, "title-card.py"), icon, cardPng],
			{ stdio: ["ignore", "inherit", "inherit"] },
		);
		ffmpeg([
			"-loop", "1",
			"-i", cardPng,
			"-t", String(scene.seconds),
			"-vf", `fps=${FPS},fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOutStart}:d=${FADE}`,
			"-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", seg,
		]);
	} else {
		const clip = join(CLIPS, `${scene.id}.mov`);
		if (!existsSync(clip)) throw new Error(`missing clip: ${clip} — run promo:capture`);
		ffmpeg([
			"-i", clip,
			"-t", String(scene.seconds),
			"-vf", vf,
			"-an",
			"-c:v", "libx264", "-preset", "medium", "-crf", "18", seg,
		]);
	}
	segments.push(seg);
}

// ── 2. scene-aligned VO track (each line padded/trimmed to its scene) ────
const voSegs = [];
for (const scene of SCENES) {
	const src = join(VO, `${scene.id}.wav`);
	if (!existsSync(src)) throw new Error(`missing VO: ${src} — run promo:voiceover`);
	const seg = join(PROMO, `vo-${scene.id}.wav`);
	ffmpeg(["-i", src, "-af", `apad,atrim=0:${scene.seconds}`, seg]);
	voSegs.push(seg);
}
const voConcatList = join(PROMO, "vo-concat.txt");
writeFileSync(voConcatList, voSegs.map((p) => `file '${p}'`).join("\n"));
const voTrack = join(PROMO, "vo-track.wav");
ffmpeg(["-f", "concat", "-safe", "0", "-i", voConcatList, "-c", "copy", voTrack]);

// ── 3. video concat + audio mix ──────────────────────────────────────────
const videoConcatList = join(PROMO, "video-concat.txt");
writeFileSync(videoConcatList, segments.map((p) => `file '${p}'`).join("\n"));
const silentVideo = join(PROMO, "video-silent.mp4");
ffmpeg(["-f", "concat", "-safe", "0", "-i", videoConcatList, "-c", "copy", silentVideo]);

const music = existsSync(ASSETS)
	? readdirSync(ASSETS).find((f) => /^music\.(mp3|m4a|wav|aac)$/.test(f))
	: undefined;
if (music) {
	ffmpeg([
		"-i", silentVideo,
		"-i", voTrack,
		"-stream_loop", "-1", "-i", join(ASSETS, music),
		"-filter_complex",
		"[2:a]volume=0.22[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]",
		"-map", "0:v", "-map", "[a]",
		"-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT_MP4,
	]);
} else {
	ffmpeg([
		"-i", silentVideo,
		"-i", voTrack,
		"-map", "0:v", "-map", "1:a",
		"-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT_MP4,
	]);
}

// ── 4. captions ──────────────────────────────────────────────────────────
function srtTime(s) {
	const ms = Math.round(s * 1000);
	const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
	const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
	const sec = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
	return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, "0")}`;
}
let cursor = 0;
const srt = SCENES.map((scene, i) => {
	const start = cursor;
	cursor += scene.seconds;
	return `${i + 1}\n${srtTime(start + 0.2)} --> ${srtTime(cursor - 0.2)}\n${scene.vo}\n`;
}).join("\n");
writeFileSync(OUT_SRT, srt);

const total = SCENES.reduce((a, s) => a + s.seconds, 0);
console.log(`[promo:render] ${OUT_MP4} (${total}s) + ${OUT_SRT}${music ? ` + music bed (${music})` : " (no music bed)"}`);
