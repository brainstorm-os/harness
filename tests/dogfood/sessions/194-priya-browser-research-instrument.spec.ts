/**
 * Session 194 — Priya tests the (just-revived) Browser as a research instrument.
 *
 * The Browser couldn't load a single page until session 193 fixed the dead
 * WebView service. Now that it works, Priya — the research editor, whose whole
 * job is reading sources and citing them — puts it through a real research
 * pattern: open a source, open a second source in another tab, move back and
 * forward, and then look for the one thing she actually needs: a way to **clip
 * the source into the vault** so she can cite it in a brief. Per the roadmap
 * that's Browser-5 (`web.capture` → `Bookmark/v1`) and may not be built yet —
 * if it isn't, that absence is precisely her finding (a research browser you
 * can't save *from* isn't a research tool). Verdict from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const SOURCES = ["https://example.com", "https://example.org"];

test("Priya tests the Browser as a research instrument (194)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("194-priya-browser-research-instrument");
	try {
		s.chat(
			SPEAKER.Priya,
			"The browser loads now. Real test: can I actually research in it — open a couple of sources in tabs, navigate between them, and most importantly clip a source into the vault so I can cite it. Trying it.",
		);

		const b = await s.openApp(APP.Browser);
		await b.waitForLoadState("domcontentloaded").catch(() => undefined);
		await b.waitForTimeout(1500);
		await s.shot(b, "01-open");

		const omnibox = () =>
			b
				.locator(
					"input[type='url'], input[placeholder*='Search'], input[placeholder*='address'], .browser-omnibox input, [data-testid='omnibox']",
				)
				.first();

		const navigate = async (url: string, label: string) => {
			const box = omnibox();
			if (!(await box.count().catch(() => 0))) {
				s.note(`(no omnibox to navigate to ${url})`);
				return;
			}
			await box.click().catch(() => undefined);
			await box.fill(url).catch(() => undefined);
			await box.press("Enter").catch(() => undefined);
			await b.waitForTimeout(3500);
			const title = await b
				.locator(".browser-tab__title, [data-tab-title], .tab-strip__tab")
				.first()
				.innerText()
				.catch(() => "");
			s.note(`navigated to ${url} → tab title "${title}"`);
			await s.shot(b, label);
		};

		await navigate(SOURCES[0] ?? "https://example.com", "02-source-1");

		// Open a second tab (research is multi-source). Try the "+" new-tab affordance.
		const newTab = b
			.locator(
				"[data-testid='new-tab'], .tab-strip__new, button[title*='tab' i], button:has-text('New tab')",
			)
			.first();
		if (await newTab.count().catch(() => 0)) {
			await newTab.click().catch(() => undefined);
			await b.waitForTimeout(800);
			s.note("opened a second tab via the + affordance");
		} else {
			// Fall back to the keyboard chord.
			await b.keyboard.press("Meta+t").catch(() => undefined);
			await b.waitForTimeout(800);
			s.note("opened a second tab via Cmd+T (no visible + affordance found)");
		}
		await navigate(SOURCES[1] ?? "https://example.org", "03-source-2");

		// Move back / forward — the core navigation a researcher leans on.
		const back = b
			.locator(
				"[data-testid='nav-back'], .browser-nav__back, button[title*='back' i], button[aria-label*='back' i]",
			)
			.first();
		if (await back.count().catch(() => 0)) {
			await back.click().catch(() => undefined);
			await b.waitForTimeout(2000);
			await s.shot(b, "04-after-back");
			s.note("clicked Back");
		} else {
			s.note("no Back affordance located");
		}

		// The thing that matters: can she clip/save/capture this source to the vault?
		const clip = b
			.locator(
				"[data-testid='capture'], [data-testid='clip'], button:has-text('Save'), button:has-text('Clip'), button:has-text('Capture'), button:has-text('Bookmark'), button[title*='save' i], button[title*='clip' i], button[title*='bookmark' i]",
			)
			.first();
		const haveClip = (await clip.count().catch(() => 0)) > 0;
		s.note(`clip-to-vault / capture affordance present in the browser: ${haveClip}`);
		if (haveClip) {
			await clip.click().catch(() => undefined);
			await b.waitForTimeout(1200);
			await s.shot(b, "05-after-clip");
		}
		await s.shot(b, "06-browser-final");

		// If she could clip, the source should appear in Bookmarks; check either way
		// so the captures show whether the read→save→cite seam exists end to end.
		try {
			const bm = await s.openApp(APP.Bookmarks);
			await bm.waitForTimeout(1500);
			const rows = await bm
				.locator(".bookmark-card, .bookmarks-row, [data-bookmark-id], .bs-card")
				.allInnerTexts()
				.catch(() => []);
			s.note(
				`bookmarks after the browser session (${rows.length}): ${JSON.stringify(rows.slice(0, 10))}`,
			);
			await s.shot(bm, "07-bookmarks");
		} catch (err) {
			s.note(`bookmarks check skipped: ${(err as Error).message}`);
		}

		s.chat(
			SPEAKER.Priya,
			"Navigation + tabs are the easy part. Reading the captures to see whether I can actually get a source out of the browser and into something I can cite — that's the test that matters for research.",
		);
		s.note("Verdict (usable researcher's browser? capture→cite seam?) decided from captures.");
	} finally {
		await s.finish();
	}
});
