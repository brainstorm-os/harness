/**
 * Markdown projector for `docs/implementation-log.md`. Pure — given the
 * log source, returns a `code → { title, completedAt }` index.
 *
 * Why this exists: most shipped iterations are *condensed* in
 * `implementation-plan.md` to a one-line pointer
 * (`0.1 — ✅ DONE — ✅. → [implementation-log.md]`); the real description
 * and ship date live only in the log. The plan parser therefore can't
 * recover a usable title for them (it produced `0.1 — — ✅`). This module
 * mines the log so the seeded Task / Iteration entities carry the real
 * human title and the real completion date.
 *
 * Log shapes accepted (both used in this repo's history):
 *
 *   ## Stage N — <stage heading> (...)
 *   ### <CODE> — <heading stub>          ← legacy "stage + code-headed" form
 *
 *   ## YYYY-MM-DD — <CODE> — <stub>      ← current form (date-headed)
 *   ## YYYY-MM-DD — <free-text bundle>   ← e.g. "iteration bundle", "integrator sync"
 *
 *   ✅ DONE (2026-05-17). **Descriptive headline.** Long narrative…
 *
 * For date-headed entries the heading date wins as the ship date (a body
 * `(YYYY-MM-DD)` prefix is the fallback). The iteration code is the first
 * recognised id token in the heading; if none matches, the second
 * ` — `-delimited segment becomes the code so the body still lands
 * somewhere addressable (used by bundle/meta entries).
 *
 * The best title is, in priority: a meaningful heading stub
 * ("Bun workspaces", "Settings → Search index panel"), else the first
 * bold span of the body ("**A diagnostic … surface**"), else the first
 * sentence of the body after its status prefix
 * ("`electron-vite` + Biome + TS strict + React 19 baseline").
 */

export interface LogIterationEntry {
	code: string;
	/** Best human title recovered from the log, or `null` if none. */
	title: string | null;
	/** First paragraph of the log narrative (status-prefix + markdown
	 *  stripped, clipped) — the real body for iterations the plan
	 *  condensed to a one-line pointer. `null` when the log has no entry. */
	summary: string | null;
	/** Full markdown narrative for this iteration as captured from the log
	 *  (status prefix stripped from the first line, surrounding whitespace
	 *  trimmed). Markdown is preserved (headings, lists, code, tables) so the
	 *  seeder can convert it to Lexical blocks via the shared
	 *  `markdownToBlocks` helper. `null` when the log has no entry or the
	 *  body would be empty. */
	body: string | null;
	/** UTC ms of the `(YYYY-MM-DD)` ship date in the status prefix, or `null`. */
	completedAt: number | null;
}

const HEADING_RE = /^#{3,4}\s+(.+?)\s*$/;
const STAGE_HEADING_RE = /^##\s+Stage\b/;
/** Date-headed iteration entry: `## YYYY-MM-DD — <rest>` (current shape). */
const HEADING_LEVEL2_DATE_RE = /^##\s+(\d{4})-(\d{2})-(\d{2})\s+—\s+(.+?)\s*$/;
/** Recognised iteration id tokens at the *start* of the rest-segment.
 *  Matches the plan parser's `LEAD_ID_RE` PLUS the named-track ids minted
 *  post-G0 (`Help-1`, `OpenRes-1c`, `Net-1a`, `NAPI-3d`, `Feedback-3`,
 *  `Welcome-1`, …) which the legacy numeric-only regex misses. Anchored
 *  to the leading position so a free-text bundle heading like
 *  "integrator sync — plan/table/log reconciled against `main` (G2 close
 *  + 13.4a.1 + …)" doesn't accidentally pluck `G2` or the deep mention
 *  of `13.4a.1` as the code. Bundle/meta headings without a leading id
 *  produce no log entry (intended — they're cross-cutting). */
const ITER_CODE_LEADING_RE =
	/^(?:(?:Help|OpenRes|Net|NAPI|Feedback|Welcome|DocsHub|Browser|Mailbox|Connector|Agent|Clip|Chats|Community|Automation)-\d+[a-z]?|SH-\d+|VP-\d+|B\d+(?:\.[\w-]+)*[a-z]?|\d+(?:\.[\w-]+)*[a-z]?)/u;
/** Leading status token in a log body: `✅`, `✅ DONE (2026-05-17).`, `↩️ Reverted.` … */
const BODY_STATUS_PREFIX_RE =
	/^\s*(?:(?:✅|🟡|⚪|↩️|🛠️|✓|🚫|⛔)\s*)*(?:(?:DONE|PENDING|PARTIAL|REVERTED|WIP|IN-FLIGHT)\b\s*)?(?:\(\s*\d{4}-\d{2}-\d{2}[^)]*\)\s*)?\.?\s*/iu;
const SHIP_DATE_RE = /\(\s*(\d{4})-(\d{2})-(\d{2})/;
const BOLD_RE = /\*\*([^*]+?)\*\*/;
const STATUS_WORD_ONLY_RE = /^(?:done|pending|partial|reverted|wip|in-flight)\.?$/i;

function stripMarkdown(s: string): string {
	return s
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.trim();
}

function clampTitle(s: string): string {
	const t = s.trim().replace(/[.;:,\s]+$/, "");
	if (t.length <= 90) return t;
	return `${t.slice(0, 87).trimEnd()}…`;
}

/**
 * A heading stub or candidate is a real title only if it has actual words
 * — not a bare status glyph (`✅`), a label fragment (`What's in:`), a size
 * measurement (`100.05 KB gz`), or a lone status word.
 */
export function isMeaningfulTitle(raw: string): boolean {
	const s = stripMarkdown(raw);
	if (s.length < 3) return false;
	if (s.endsWith(":")) return false;
	if (STATUS_WORD_ONLY_RE.test(s)) return false;
	// Must contain at least one alphabetic word of length ≥ 4 — rejects
	// "✅", "100.05 KB gz", "v2.1b" while keeping "Bun workspaces".
	return /[A-Za-z]{4,}/.test(s);
}

function firstSentence(body: string): string {
	const firstLine = body.split("\n", 1)[0] ?? "";
	const afterStatus = firstLine.replace(BODY_STATUS_PREFIX_RE, "");
	const stripped = stripMarkdown(afterStatus);
	const end = stripped.search(/[.!?](?:\s|$)/);
	return (end === -1 ? stripped : stripped.slice(0, end)).trim();
}

function resolveTitle(stub: string, body: string): string | null {
	if (isMeaningfulTitle(stub)) return clampTitle(stripMarkdown(stub));
	const bold = BOLD_RE.exec(body)?.[1] ?? "";
	if (isMeaningfulTitle(bold)) return clampTitle(stripMarkdown(bold));
	const sentence = firstSentence(body);
	if (isMeaningfulTitle(sentence)) return clampTitle(sentence);
	return null;
}

/**
 * First paragraph of the log narrative as a plain-text summary: drop the
 * leading status token, flatten markdown, take up to the first blank line,
 * clip. This is the real body for condensed iterations whose plan line is
 * just `✅ DONE — ✅. → [log]`.
 */
function bodySummary(body: string): string | null {
	const trimmed = body.trim();
	if (!trimmed) return null;
	const blank = trimmed.search(/\n\s*\n/);
	const para = (blank === -1 ? trimmed : trimmed.slice(0, blank)).replace(/\s+/g, " ").trim();
	const text = stripMarkdown(para.replace(BODY_STATUS_PREFIX_RE, "")).trim();
	if (text.length < 3) return null;
	return text.length <= 480 ? text : `${text.slice(0, 479).trimEnd()}…`;
}

/** Drop the leading status token from the first body line and return the
 *  remaining markdown verbatim (preserving headings, lists, code blocks,
 *  tables). Used by the seeder to render the iteration's full narrative as
 *  the seeded Note body. Returns `null` for a body that's empty after the
 *  prefix strip — the seeder falls back to the plan-side bullet body in
 *  that case. */
function stripStatusPrefixFromBody(body: string): string | null {
	if (body.length === 0) return null;
	const newlineAt = body.indexOf("\n");
	const firstLine = newlineAt === -1 ? body : body.slice(0, newlineAt);
	const rest = newlineAt === -1 ? "" : body.slice(newlineAt);
	const strippedFirst = firstLine.replace(BODY_STATUS_PREFIX_RE, "").trimStart();
	const out = `${strippedFirst}${rest}`.trim();
	return out.length === 0 ? null : out;
}

function shipDate(body: string): number | null {
	// Only the status-prefix date counts — a date deep in prose is not the
	// ship date. Look at the first body line only.
	const firstLine = body.split("\n", 1)[0] ?? "";
	const m = SHIP_DATE_RE.exec(firstLine);
	if (!m) return null;
	const [, y, mo, d] = m;
	const ts = Date.UTC(Number(y), Number(mo) - 1, Number(d));
	return Number.isNaN(ts) ? null : ts;
}

/**
 * Parse the implementation log into a `code → entry` map. Codes are the
 * left side of the `### <code> — <stub>` heading, verbatim, so the caller
 * looks them up by the iteration id from the plan (`0.1`, `9.22.4`,
 * `SH-15`, `B6.6`, …). Non-iteration headings are still indexed but never
 * collide with a numeric iteration code.
 */
export function parseImplementationLog(src: string): Map<string, LogIterationEntry> {
	const lines = src.split("\n");
	const out = new Map<string, LogIterationEntry>();
	let pending: {
		code: string;
		stub: string;
		bodyLines: string[];
		headingDate: number | null;
		/** When set, the heading is a bundle / integrator-sync entry — we
		 *  STILL flush nothing for the heading itself, but harvest each
		 *  body-level bullet whose lead is a recognised iteration id as
		 *  its own synthetic record (so the journal mapper buckets every
		 *  closed-out iteration on the right day even when its day's
		 *  rollup came in a single heading). */
		isBundle: boolean;
	} | null = null;

	const flushBundle = (): void => {
		if (!pending || !pending.isBundle) return;
		// Walk body lines; when one starts with `- **<CODE>` at the LEFT
		// MARGIN (no leading whitespace — nested bullets stay attached to
		// their parent's body), mint a record for that code. The bullet's
		// rest-of-line text seeds the body so single-line bullets — the
		// canonical integrator-sync shape — don't lose their narrative to
		// the 90-char title clip. A non-bullet block that follows the last
		// bullet (status snapshot deltas, `---` rules, sign-off paragraphs)
		// is terminated by the first such "outside-the-list" boundary so
		// trailing prose doesn't pollute the last bullet's body.
		const bulletRe = /^-\s+\*\*([^*]+?)\*\*\s*(.*)$/u;
		const nestedBulletRe = /^\s+-\s+\*\*([^*]+?)\*\*\s*(.*)$/u;
		let cur: { code: string; stub: string; bodyLines: string[] } | null = null;
		const closeCur = (): void => {
			if (!cur) return;
			const body = cur.bodyLines.join("\n").trim();
			// Existing same-code entry on this day? Merge bodies (don't
			// silently overwrite). The integrator-sync bundle and a
			// separate same-code level-2 heading on the same day can both
			// emit a record for the same iteration — both narratives are
			// worth keeping, in source order.
			const prior = out.get(cur.code);
			const mergedBody = prior?.body
				? `${prior.body}\n\n${stripStatusPrefixFromBody(body) ?? ""}`.trim()
				: stripStatusPrefixFromBody(body);
			out.set(cur.code, {
				code: cur.code,
				title:
					prior?.title && isMeaningfulTitle(prior.title) ? prior.title : resolveTitle(cur.stub, body),
				summary: prior?.summary ?? bodySummary(body),
				body: mergedBody && mergedBody.length > 0 ? mergedBody : null,
				// Heading date wins — the bullet bodies don't carry their own.
				completedAt: pending?.headingDate ?? null,
			});
			cur = null;
		};
		const isHardBoundary = (line: string): boolean => {
			// `---` horizontal rule + any line that starts with `**` at the
			// margin (a non-bullet "trailing prose" paragraph the
			// integrator wrote AFTER the bullet list). Pure blank lines
			// stay folded into the current bullet's body (paragraphs in a
			// single bullet's prose include blank-line separators).
			const trimmed = line.trim();
			if (trimmed === "---") return true;
			if (trimmed.startsWith("**") && !line.startsWith("-")) return true;
			return false;
		};
		for (const bl of pending.bodyLines) {
			const m = bulletRe.exec(bl);
			if (m) {
				const bold = m[1] ?? "";
				const rest = m[2] ?? "";
				const codeMatch = ITER_CODE_LEADING_RE.exec(bold);
				if (codeMatch) {
					closeCur();
					// Title from bold span (without code prefix when present)
					// + rest-of-line seeded into bodyLines so the bullet's
					// inline prose lands in the synthetic iteration's body.
					const stripped = bold.replace(ITER_CODE_LEADING_RE, "").trim();
					const stub = stripped.length > 0 ? stripped : bold;
					cur = { code: codeMatch[0], stub, bodyLines: rest ? [rest] : [] };
					continue;
				}
			}
			// Indented sub-bullet — stays inside the current parent bullet's
			// body, doesn't open a new entry.
			if (nestedBulletRe.test(bl)) {
				if (cur) cur.bodyLines.push(bl);
				continue;
			}
			// Hard boundary: close the current bullet so trailing wrap-up
			// prose doesn't pollute its body.
			if (isHardBoundary(bl)) {
				closeCur();
				continue;
			}
			if (cur) cur.bodyLines.push(bl);
		}
		closeCur();
	};

	const flush = (): void => {
		if (!pending) return;
		if (pending.isBundle) {
			flushBundle();
			pending = null;
			return;
		}
		const body = pending.bodyLines.join("\n").trim();
		// Merge same-code entries (incremental same-day landings like the
		// 2026-05-25 three Help-1 headings — content rewrite / polish /
		// main landing — all carry real prose; last-write-wins drops two
		// of three). Concatenate bodies; keep the most-specific title.
		const prior = out.get(pending.code);
		const mergedBody = prior?.body
			? `${prior.body}\n\n${stripStatusPrefixFromBody(body) ?? ""}`.trim()
			: stripStatusPrefixFromBody(body);
		out.set(pending.code, {
			code: pending.code,
			title:
				prior?.title && isMeaningfulTitle(prior.title) ? prior.title : resolveTitle(pending.stub, body),
			summary: prior?.summary ?? bodySummary(body),
			body: mergedBody && mergedBody.length > 0 ? mergedBody : null,
			completedAt: pending.headingDate ?? shipDate(body),
		});
		pending = null;
	};

	for (const line of lines) {
		// `## YYYY-MM-DD — …` (current log shape) wins over the stage check
		// because both start with `##` — `## Stage N — …` never starts with
		// a date so the order is safe.
		const dh = HEADING_LEVEL2_DATE_RE.exec(line);
		if (dh) {
			flush();
			const [, y, mo, d, rest] = dh;
			const headingDate = Date.UTC(Number(y), Number(mo) - 1, Number(d));
			const parts = rest.split(/\s+—\s+/);
			const firstSeg = (parts[0] ?? "").trim();
			const codeMatch = ITER_CODE_LEADING_RE.exec(firstSeg);
			if (codeMatch) {
				const code = codeMatch[0];
				const stub = parts.length > 1 ? parts.slice(1).join(" — ").trim() : firstSeg;
				pending = { code, stub, bodyLines: [], headingDate, isBundle: false };
			} else {
				// Bundle / meta heading ("iteration bundle", "integrator sync",
				// "parallel-team fan-out"). Open a bundle window so its body
				// bullets get harvested per-iteration on flush.
				pending = { code: "", stub: firstSeg, bodyLines: [], headingDate, isBundle: true };
			}
			continue;
		}
		if (STAGE_HEADING_RE.test(line)) {
			flush();
			continue;
		}
		const h = HEADING_RE.exec(line);
		if (h?.[1]) {
			flush();
			const parts = h[1].split(/\s+—\s+/);
			const code = (parts[0] ?? "").trim();
			const stub = parts.slice(1).join(" — ").trim();
			if (code) pending = { code, stub, bodyLines: [], headingDate: null, isBundle: false };
			continue;
		}
		if (pending) pending.bodyLines.push(line);
	}
	flush();
	return out;
}
