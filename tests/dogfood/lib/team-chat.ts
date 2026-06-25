/**
 * Northbound team chat — a live, append-only transcript the dogfood personas
 * (and the Brainstorm engineer) post to as they work, so their collaboration is
 * legible in real time.
 *
 * It is a plain file (NOT the SQLite vault) on purpose: a file has no vault lock,
 * so you can `tail -f` it WHILE sessions run without contending for the vault.
 * It lives under `.sessions/` (gitignored, ephemeral) — the durable record is
 * still `friction-log.md`; this is the watch-along.
 *
 *   tail -f tests/dogfood/.sessions/team-chat.md      # watch the team work
 *
 * Founder sessions post via `s.chat(SPEAKER.X, "…")`; the developer posts via
 * `bun run dogfood:chat Kai "…"`. Both route through `postToTeamChat` so the
 * format never diverges.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

export const TEAM_CHAT_PATH = join(REPO_ROOT, "tests", "dogfood", ".sessions", "team-chat.md");

/** The voices in the channel. The three founder-side personas use the shipped
 *  app and report; Kai (the Brainstorm engineer = the build workflow) responds
 *  with triage + fixes. Values are the rendered "Name · role" label. */
export const SPEAKER = {
	Mira: "Mira · founder",
	Marcus: "Marcus · designer",
	Priya: "Priya · research editor",
	Dana: "Dana · ops & growth",
	Sol: "Sol · interaction eng",
	Kai: "Kai · Brainstorm eng",
} as const;

export type Speaker = (typeof SPEAKER)[keyof typeof SPEAKER];

/** Resolve a short name ("mira", "kai", …) to its rendered Speaker label.
 *  Used by the dev CLI; returns null for an unknown name. */
export function resolveSpeaker(name: string): Speaker | null {
	const key = name.trim().toLowerCase();
	const match = Object.entries(SPEAKER).find(([k]) => k.toLowerCase() === key);
	return match ? (match[1] as Speaker) : null;
}

function stamp(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Append one message to the live transcript. Best-effort: the chat is a watch
 *  convenience, never load-bearing for a session. */
export function postToTeamChat(speaker: Speaker, message: string): void {
	try {
		mkdirSync(dirname(TEAM_CHAT_PATH), { recursive: true });
		appendFileSync(TEAM_CHAT_PATH, `${stamp()}  ${speaker}\n  ${message.trim()}\n\n`);
	} catch {
		// swallow — a failed chat post must never fail a dogfood session
	}
}
