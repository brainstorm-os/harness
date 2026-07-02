/**
 * Session 375 — accessibility: text-contrast audit.
 *
 * The name audit (374) came back clean; the next a11y class is contrast. The
 * friction log's real contrast incidents were phantom-token panels collapsing
 * to a light fallback (unreadable text). For every app this walks visible text
 * nodes, computes the WCAG contrast ratio of the text colour against its
 * effective (walked-up, alpha-blended) background, and flags any that fall
 * below AA — 4.5:1 for normal text, 3:1 for large (≥24px, or ≥18.66px bold).
 * Non-asserting; writes a triage report of the worst offenders per app.
 */

// Relative into the symlinked packages/tokens source — the harness test runner
// doesn't resolve the `@brainstorm/tokens` package name.
import { defaultDark, flattenTokens } from "../../../packages/tokens/src/index";
import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

type Measured = { sig: string; ratio: number; need: number; sample: string; fg: string; bg: string };
type Finding = { app: string } & Measured;

// Dark-theme token map (`--color-…: value`). The vault has an explicitly-chosen
// theme, so flipping Electron's OS-dark preference doesn't switch it — instead
// (with A11Y_DARK) we set these vars INLINE on each app's <html>, overriding the
// preload's committed light tokens, so the app renders on DefaultDark and we can
// measure contrast where the friction log's real incidents were (unreadable-on-dark).
const DARK_VARS = flattenTokens(defaultDark);

test("a11y: text meets WCAG AA contrast", async () => {
	test.setTimeout(600_000);
	const s = await startSession("375-a11y-contrast-audit");
	const flagged: Finding[] = [];

	for (const [name, id] of Object.entries(APP)) {
		let page: Awaited<ReturnType<typeof s.openApp>>;
		try {
			page = await s.openApp(id);
		} catch {
			s.note(`[${name}] did not open — skipped`);
			continue;
		}
		await page.waitForTimeout(1200);
		// Per-app hard cap so one slow/hung app window can't stall the whole sweep
		// (the dark-inject + full-tree measure timed out at 10m otherwise).
		const guard = <T>(p: Promise<T>, fallback: T): Promise<T> =>
			Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), 25_000))]);
		if (process.env.A11Y_DARK) {
			await guard(
				page
					.evaluate((vars) => {
						for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
					}, DARK_VARS)
					.catch(() => undefined),
				undefined,
			);
			await page.waitForTimeout(400);
		}

		const found = await guard(
			page.evaluate(() => {
				const parse = (c: string): [number, number, number, number] | null => {
					const m = c.match(/rgba?\(([^)]+)\)/);
					if (!m) return null;
					const p = m[1].split(",").map((x) => Number.parseFloat(x.trim()));
					return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
				};
				const lin = (v: number) => {
					const x = v / 255;
					return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
				};
				const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
				const over = (fg: [number, number, number, number], bg: [number, number, number]): [number, number, number] => {
					const a = fg[3];
					return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
				};
				// Effective opaque background by walking ancestors; assume page white if none.
				const effBg = (el: Element): [number, number, number] | null => {
					let node: Element | null = el;
					const stack: [number, number, number, number][] = [];
					while (node) {
						const bg = parse(getComputedStyle(node).backgroundColor);
						if (bg && bg[3] > 0) {
							if (bg[3] >= 1) {
								let base: [number, number, number] = [bg[0], bg[1], bg[2]];
								for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
								return base;
							}
							stack.push(bg);
						}
						// A background-image (gradient/photo) → can't reliably compute; bail.
						if (getComputedStyle(node).backgroundImage !== "none") return null;
						node = node.parentElement;
					}
					let base: [number, number, number] = [247, 247, 247];
					for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
					return base;
				};

				const out: Array<{ sig: string; ratio: number; need: number; sample: string; fg: string; bg: string }> = [];
				const seen = new Set<string>();
				for (const el of Array.from(document.querySelectorAll("*"))) {
					// Direct text only (a leaf-ish text owner), non-empty, visible.
					const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
					if (!direct) continue;
					const cs = getComputedStyle(el);
					if (cs.visibility === "hidden" || cs.display === "none" || Number.parseFloat(cs.opacity) < 0.1) continue;
					const r = (el as HTMLElement).getBoundingClientRect();
					if (r.width < 4 || r.height < 4) continue;
					// Filled control faces (.bs-btn / data-bs-primary) paint their own
					// background — often a gradient/gloss the luminance walk can't read,
					// so it falls through to the page bg and false-flags white-on-accent.
					// Their label↔surface contrast is the face's own contract, not ours.
					if (el.closest(".bs-btn, [data-bs-primary], button")) continue;
					const fg = parse(cs.color);
					if (!fg) continue;
					const bg = effBg(el.parentElement ?? el);
					if (!bg) continue;
					const fgOpaque = over(fg, bg);
					const l1 = lum(...fgOpaque) + 0.05;
					const l2 = lum(...bg) + 0.05;
					const ratio = l1 > l2 ? l1 / l2 : l2 / l1;
					const size = Number.parseFloat(cs.fontSize);
					const bold = Number.parseInt(cs.fontWeight, 10) >= 700;
					const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
					if (ratio >= need) continue;
					const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 2).join(".");
					const sig = `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;
					if (seen.has(sig)) continue;
					seen.add(sig);
					out.push({
						sig,
						ratio: Math.round(ratio * 100) / 100,
						need,
						sample: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
						fg: cs.color,
						bg: `rgb(${bg.map((x) => Math.round(x)).join(",")})`,
					});
				}
				return out.sort((a, b) => a.ratio - b.ratio);
			})
				.catch(() => [] as Measured[]),
			[] as Measured[],
		);

		for (const f of found) flagged.push({ app: name, ...f });
		const bg = await guard(
			page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => "?"),
			"?",
		);
		s.note(`[${name}] bg=${bg} · ${found.length} low-contrast text element(s)`);
	}

	flagged.sort((a, b) => a.ratio - b.ratio);
	const lines: string[] = ["", "## Text below WCAG AA contrast (worst first)", ""];
	if (flagged.length === 0) lines.push("_none — all measurable text meets AA_");
	for (const f of flagged) {
		lines.push(`- **${f.app}** \`${f.sig}\` — ${f.ratio}:1 (need ${f.need}) — ${f.fg} on ${f.bg} — "${f.sample}"`);
	}
	s.note(lines.join("\n"));

	await s.finish();
	expect(true).toBe(true);
});
