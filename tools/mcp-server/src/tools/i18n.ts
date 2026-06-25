import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "../repo.ts";

export interface BareStringFinding {
	file: string;
	line: number;
	text: string;
}

/**
 * Greps for likely bare user-visible JSX text — string literals between
 * `>` and `<` in TSX files, or template/string children of common
 * text-content props (placeholder, title, aria-label). Skips known wrap
 * patterns (`{t(...)}`, single-character glyphs, fully whitespace text).
 *
 * False positives are expected; the tool is a hint, not a gate.
 */
export function findBareStrings(rootRel?: string): BareStringFinding[] {
	const root = rootRel ? join(findRepoRoot(), rootRel) : findRepoRoot();
	const findings: BareStringFinding[] = [];
	for (const filePath of walkTsx(root)) {
		const source = readFileSync(filePath, "utf8");
		const lines = source.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (line.includes("{t(") || line.includes("t(`") || line.includes("tNoReturn(")) continue;
			for (const match of line.matchAll(/>([^<>{}]{2,}?)</g)) {
				const text = (match[1] ?? "").trim();
				if (isLikelyHumanText(text)) {
					findings.push({ file: relativeTo(filePath, findRepoRoot()), line: i + 1, text });
				}
			}
		}
	}
	return findings;
}

function isLikelyHumanText(text: string): boolean {
	if (!text) return false;
	if (text.length < 2) return false;
	if (/^[\s\-—•·…]+$/.test(text)) return false;
	if (/^\d+$/.test(text)) return false;
	if (!/[A-Za-z]/.test(text)) return false;
	if (text.startsWith("//") || text.startsWith("/*")) return false;
	if (text === "true" || text === "false" || text === "null") return false;
	return true;
}

const SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	"out",
	"build",
	"coverage",
	".vite",
	".git",
	".obsidian",
]);

function walkTsx(root: string): string[] {
	const out: string[] = [];
	const visit = (dir: string) => {
		let entries: string[] = [];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (SKIP_DIRS.has(entry)) continue;
			const full = join(dir, entry);
			let st: ReturnType<typeof statSync>;
			try {
				st = statSync(full);
			} catch {
				continue;
			}
			if (st.isDirectory()) visit(full);
			else if (entry.endsWith(".tsx")) out.push(full);
		}
	};
	visit(root);
	return out;
}

function relativeTo(filePath: string, rootDir: string): string {
	if (filePath.startsWith(`${rootDir}/`)) return filePath.slice(rootDir.length + 1);
	return filePath;
}
