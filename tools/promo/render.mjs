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
import { isAbsolute, join, resolve } from "node:path";

// Scene table + output dir + basename are selectable so this one renderer
// assembles both the 60s promo and the per-app VID-* reels (e.g.
// PROMO_SCENES=./notes-scenes.mjs PROMO_DIR=.promo-notes PROMO_OUT=vid-notes).
// Defaults are the promo.
const { SCENES } = await import(process.env.PROMO_SCENES ?? "./scenes.mjs");
const OUT_BASENAME = process.env.PROMO_OUT ?? "promo-60s";

const HARNESS = resolve(import.meta.dirname, "..", "..");
const PROMO = join(HARNESS, "tests", "dogfood", process.env.PROMO_DIR ?? ".promo");
const CLIPS = join(PROMO, "clips");
const VO = join(PROMO, "vo");
const ASSETS = join(import.meta.dirname, "assets");
const OUT_MP4 = join(PROMO, `${OUT_BASENAME}-1080p.mp4`);
const OUT_SRT = join(PROMO, `${OUT_BASENAME}.srt`);

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
	// Per-scene time-compression keeps footage dense — actions are captured
	// at a comfortable driving pace and played back snappier. The factor
	// auto-raises so the WHOLE captured action fits the scene budget (a cut
	// that trims the payoff is worse than a faster replay), capped at 3×.
	// tpad then clones the final frame out to the scene budget (screencast
	// clips end when paints stop), and `-t` trims to the exact scene length.
	let speed = scene.speed ?? 1;
	if (!scene.titleCard && !scene.introCard && !scene.slide) {
		const clipPath = join(CLIPS, `${scene.id}.mov`);
		if (existsSync(clipPath)) {
			const dur = Number(
				execFileSync("ffprobe", [
					"-v", "error",
					"-show_entries", "format=duration",
					"-of", "csv=p=0",
					clipPath,
				])
					.toString()
					.trim(),
			);
			if (Number.isFinite(dur) && dur > 0) {
				speed = Math.min(3, Math.max(speed, dur / (scene.seconds - 0.2)));
			}
		}
	}
	const vf = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS/${speed},fps=${FPS},tpad=stop_mode=clone:stop_duration=${scene.seconds},fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOutStart}:d=${FADE},setpts=PTS-STARTPTS`;
	if (scene.titleCard || scene.introCard || scene.slide) {
		// Pillow renders the stills (Homebrew ffmpeg has no drawtext/freetype)
		// in the site's indigo palette. Cards use the shell's indigo app icon
		// (same mark as the site favicon); slides are text-only interstitials.
		const iconCandidates = [
			join(HARNESS, "packages", "shell", "art", "icon.png"),
			join(HARNESS, "docs", "art", "icon", "icon9.png"),
		];
		const icon = iconCandidates.find((p) => existsSync(p)) ?? "-";
		const cardPng = join(PROMO, `card-${scene.id}.png`);
		const args = scene.slide
			? ["slide", scene.slide.title, scene.slide.sub ?? "", cardPng]
			: [scene.introCard ? "intro" : "outro", icon, cardPng];
		execFileSync(
			"uv",
			["run", "--with", "pillow", "python3", join(import.meta.dirname, "cards.py"), ...args],
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
		// Caption lower-third (site-indigo pill) overlaid on the footage so
		// a first-time viewer always knows which surface they're seeing.
		const captionPng = join(PROMO, `caption-${scene.id}.png`);
		execFileSync(
			"uv",
			["run", "--with", "pillow", "python3", join(import.meta.dirname, "cards.py"), "caption", scene.caption, captionPng],
			{ stdio: ["ignore", "inherit", "inherit"] },
		);
		// The chip fades in shortly after the cut and out again ~3s in — a
		// chapter label, not a persistent bar over the content.
		const capOut = Math.min(3.1, scene.seconds - 0.8);
		ffmpeg([
			"-i", clip,
			"-loop", "1", "-i", captionPng,
			"-t", String(scene.seconds),
			"-filter_complex",
			`[1:v]format=rgba,fade=t=in:st=0.4:d=0.3:alpha=1,fade=t=out:st=${capOut}:d=0.4:alpha=1[cap];[0:v]${vf}[base];[base][cap]overlay=0:0:shortest=1[v]`,
			"-map", "[v]",
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

// Music bed + mix are selectable so a reel can bring its own track and its own
// VO-vs-music balance. PROMO_MUSIC picks the file (else auto-find music.* in
// assets/); PROMO_VO_GAIN / PROMO_MUSIC_GAIN set the balance (defaults are the
// promo's). Keep VO_GAIN well above MUSIC_GAIN so narration always leads.
const VO_GAIN = process.env.PROMO_VO_GAIN ?? "2.2";
const MUSIC_GAIN = process.env.PROMO_MUSIC_GAIN ?? "1.0";
const musicPath = process.env.PROMO_MUSIC
	? isAbsolute(process.env.PROMO_MUSIC)
		? process.env.PROMO_MUSIC
		: join(HARNESS, process.env.PROMO_MUSIC)
	: existsSync(ASSETS)
		? (() => {
				const f = readdirSync(ASSETS).find((n) => /^music\.(mp3|m4a|wav|aac)$/.test(n));
				return f ? join(ASSETS, f) : undefined;
			})()
		: undefined;
if (musicPath && existsSync(musicPath)) {
	// The bed rides under speech via sidechain compression: narration is boosted
	// behind a limiter so it leads, and the bed ducks ~12dB whenever VO is
	// present and returns in the gaps.
	ffmpeg([
		"-i", silentVideo,
		"-i", voTrack,
		"-stream_loop", "-1", "-i", musicPath,
		"-filter_complex",
		`[1:a]asplit=2[voRaw][sc];` +
			`[voRaw]volume=${VO_GAIN},alimiter=limit=0.85:level=false[vo];` +
			`[2:a]volume=${MUSIC_GAIN}[m];` +
			`[m][sc]sidechaincompress=threshold=0.02:ratio=12:attack=20:release=400[duck];` +
			`[vo][duck]amix=inputs=2:duration=first:normalize=0[a]`,
		"-map", "0:v", "-map", "[a]",
		"-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", OUT_MP4,
	]);
	console.log(`[promo:render] music: ${musicPath} (VO gain ${VO_GAIN}, music gain ${MUSIC_GAIN})`);
} else {
	ffmpeg([
		"-i", silentVideo,
		"-i", voTrack,
		"-map", "0:v", "-map", "1:a",
		"-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", OUT_MP4,
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
const cues = [];
for (const scene of SCENES) {
	const start = cursor;
	cursor += scene.seconds;
	const vo = String(scene.vo ?? "").trim();
	if (!vo) continue;
	cues.push(`${cues.length + 1}\n${srtTime(start + 0.2)} --> ${srtTime(cursor - 0.2)}\n${vo}\n`);
}
writeFileSync(OUT_SRT, cues.join("\n"));

const total = SCENES.reduce((a, s) => a + s.seconds, 0);
console.log(`[promo:render] ${OUT_MP4} (${total}s) + ${OUT_SRT}${musicPath ? ` + music bed (${musicPath})` : " (no music bed)"}`);
