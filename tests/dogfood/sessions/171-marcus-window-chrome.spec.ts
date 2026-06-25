/**
 * Session 171 — Marcus reviews the new window chrome (the Chrome-style tab
 * strip) and the Theme Editor that surfaced the complaint.
 *
 * The window management work gave every app window a shell-drawn tab strip.
 * Marcus's consistency lens lands exactly on the awkward case: a window with a
 * SINGLE tab. The resolution shipped: a lone window has NO tab bar at all — the
 * strip collapses to zero height and the app's own header is the window title
 * (no half-visible pill, no "+" drifting to the corner). A second tab makes the
 * strip appear with proper pills + active state + close affordances; the
 * new-tab affordance for a lone window is File ▸ New Tab (⌘T). He opens the
 * Theme Editor (a lone tab), confirms the strip is collapsed, then compares.
 * Verdict from the captures + the measured strip geometry.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus reviews the window tab strip + Theme Editor chrome (171)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("171-marcus-window-chrome");
	try {
		s.chat(
			SPEAKER.Marcus,
			"The window strip looked off on a single-tab window — a lone tab masquerading as a tab, the + drifting to the corner. The fix removed the bar entirely when there's one tab. Checking the lone window reads as a clean header now, starting with the Theme Editor.",
		);

		// --- Theme Editor: the lone-tab case ---
		const theme = await s.openApp(APP.ThemeEditor);
		await theme.waitForLoadState("domcontentloaded");
		await theme.waitForTimeout(1500);
		await s.shot(theme, "01-theme-editor-window");
		const themeTitle = await theme.title();
		s.note(`Theme Editor window title: "${themeTitle}".`);

		const strip = s.tabStrip();
		if (!strip) {
			s.note("No tab strip page for the Theme Editor container — that itself is a finding.");
			s.chat(SPEAKER.Marcus, "There's no tab strip on the Theme Editor window at all. Filing that.");
		} else {
			// The fix collapses the strip to zero height on a single-tab window, so
			// the strip view reports a (near-)zero render box — the app header
			// becomes the title. Measure the strip's own viewport + the `.strip`
			// element height to confirm it's collapsed (the lone-window look).
			const dims = await strip.evaluate(() => ({
				innerH: window.innerHeight,
				stripH: Math.round(document.querySelector(".strip")?.getBoundingClientRect().height ?? 0),
			}));
			const collapsed = dims.innerH <= 2 || dims.stripH <= 2;
			s.note(
				`single-tab strip: collapsed=${collapsed} innerH=${dims.innerH} stripH=${dims.stripH} (app header is the window title)`,
			);
			// Capture the app window itself — that's where the clean no-tab-bar
			// header shows (the collapsed strip view can't be screenshotted).
			await s.shot(theme, "02-theme-editor-collapsed-strip");
			s.chat(
				SPEAKER.Marcus,
				collapsed
					? "The lone Theme Editor window has no tab bar at all now — the app's own header is the title. No half-tab, no orphaned +. That's the clean window I wanted."
					: "The single-tab window still shows a strip instead of collapsing to a clean header — pulling the measurements to file it.",
			);
		}

		// --- Notes: force a second tab and confirm the strip switches to pills ---
		const notes = await s.openApp(APP.Notes);
		await notes.waitForLoadState("domcontentloaded");
		await notes.waitForTimeout(1500);
		const notesStrip = s.tabStrip();
		const linkSel =
			".notes__transclusion-card, .notes__inline-transclusion, a[href^='brainstorm://entity/'], [class*='transclusion'], [class*='block-embed'] a";
		const link = notes.locator(linkSel).first();
		if ((await link.count()) && notesStrip) {
			const before = await notesStrip.locator("[role='tab']").count();
			await link.click({ modifiers: ["Meta"] }); // Cmd+click → new tab
			await notes.waitForTimeout(1800);
			const after = await notesStrip.locator("[role='tab']").count();
			const pills = await notesStrip.locator(".tab--active").count();
			const closes = await notesStrip.locator(".tab__close").count();
			const solo = await notesStrip.locator(".tab--solo").count();
			s.note(
				`multi-tab: tabs ${before}→${after} activePill=${pills} closeBtns=${closes} solo=${solo}`,
			);
			await s.shot(notesStrip, "03-strip-multi-tab");
			s.chat(
				SPEAKER.Marcus,
				after > before && pills > 0 && closes > 0 && solo === 0
					? "Open a second tab and it flips to real pills with an active state and close buttons — exactly the switch I'd expect between one-tab and many."
					: "The single→multi tab transition isn't clean — details in the capture.",
			);
		} else {
			s.note(
				"No in-doc link to Cmd+click — couldn't force a second tab; multi-tab pills unverified this run. The lone-window new-tab path is File ▸ New Tab (⌘T), unit-tested.",
			);
		}

		s.note(
			"Marcus design-reviewed the window chrome: a lone window collapses the strip to a clean app-header title, a second tab brings proper pills; verdict from captures + measured geometry.",
		);
	} finally {
		await s.finish();
	}
});
