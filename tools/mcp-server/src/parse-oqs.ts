import { type OQProjection, OQStatus, type OpenQuestion } from "./types.ts";

const OQ_HEADING_RE = /^####\s+OQ-(\d+)\s+—\s+(.+?)\s*$/;
const SECTION_HEADING_RE = /^###\s+(.+?)\s*$/;
const RESOLVED_TAG_RE = /\*\[(?:[A-Z\- ]+ )?RESOLVED(?:\s+(?:in|—)\s+([^\]]+))?\]\*/;

/**
 * Markdown projector for `docs/reference/11-open-questions.md`. Pure.
 */
export function parseOpenQuestions(source: string): OQProjection {
	const lines = source.split("\n");
	const sections = new Set<string>();
	const questions: OpenQuestion[] = [];
	let currentSection = "";
	let buffer: { line: number; lines: string[] } | null = null;

	const flush = () => {
		if (!buffer) return;
		const oq = buildOpenQuestion(buffer.lines, currentSection);
		if (oq) questions.push(oq);
		buffer = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const sectionMatch = SECTION_HEADING_RE.exec(line);
		if (sectionMatch?.[1]) {
			flush();
			currentSection = sectionMatch[1].trim();
			sections.add(currentSection);
			continue;
		}
		if (OQ_HEADING_RE.test(line)) {
			flush();
			buffer = { line: i, lines: [line] };
			continue;
		}
		if (buffer) {
			if (line.startsWith("---") || SECTION_HEADING_RE.test(line) || OQ_HEADING_RE.test(line)) {
				flush();
				if (SECTION_HEADING_RE.test(line) || OQ_HEADING_RE.test(line)) i--;
				continue;
			}
			buffer.lines.push(line);
		}
	}
	flush();

	return { sections: Array.from(sections), questions };
}

function buildOpenQuestion(blockLines: string[], section: string): OpenQuestion | null {
	const headingLine = blockLines[0] ?? "";
	const headingMatch = OQ_HEADING_RE.exec(headingLine);
	if (!headingMatch) return null;
	const numStr = headingMatch[1];
	const titleAndStatus = headingMatch[2];
	if (!numStr || !titleAndStatus) return null;
	const number = Number.parseInt(numStr, 10);
	if (Number.isNaN(number)) return null;

	const resolvedMatch = RESOLVED_TAG_RE.exec(titleAndStatus);
	const status = resolvedMatch ? OQStatus.Resolved : OQStatus.Open;
	const resolutionRef = resolvedMatch?.[1]?.trim() ?? null;
	const title = titleAndStatus.replace(RESOLVED_TAG_RE, "").trim();

	const body = blockLines.slice(1).join("\n").trim();
	const where = extractBullet(blockLines, "Where");
	const question = extractBullet(blockLines, "Question");
	const options = extractBullet(blockLines, "Options");
	const optionsAndTradeoffs = extractBullet(blockLines, "Options & trade-offs");
	const leaning = extractBullet(blockLines, "Tentative leaning");
	const tentativeLeaning = extractBullet(blockLines, "Tentative leaning (if any)");
	const blocking = extractBullet(blockLines, "Blocking?");
	const resolution = extractBullet(blockLines, "Resolution");
	const resolutionV1 = extractBullet(blockLines, "Resolution (v1)");

	return {
		id: `OQ-${number}`,
		number,
		section,
		title,
		status,
		resolutionRef,
		where,
		question,
		options: options ?? optionsAndTradeoffs,
		leaning: leaning ?? tentativeLeaning,
		blocking,
		resolution: resolution ?? resolutionV1,
		body,
	};
}

function extractBullet(blockLines: string[], fieldName: string): string | null {
	const prefix = `**${fieldName}:**`;
	for (const line of blockLines) {
		const trimmed = line.replace(/^\s*-\s*/, "");
		if (!trimmed.startsWith(prefix)) continue;
		return trimmed.slice(prefix.length).trim();
	}
	return null;
}
