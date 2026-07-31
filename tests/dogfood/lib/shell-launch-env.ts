/**
 * The env block every dogfood / promo / collab shell launch shares.
 *
 * **Hidden by default.** `BRAINSTORM_HIDDEN_WINDOWS=1` tells the shell never to
 * map a window onto a display (`packages/shell/src/main/window/reveal-window.ts`).
 * Agent-driven runs launch a real Electron shell — often several at once, often
 * for minutes — and until this existed every one of them threw windows over
 * whatever the developer was doing, mid-call, unrecoverably.
 *
 * Capture is unaffected: the shell's windows are all constructed `show: false`
 * and simply never revealed, and Chromium keeps a never-shown window's renderer
 * in the *visible* state (`paintWhenInitiallyHidden`, pinned on in the shell).
 * `page.screenshot()` and the `ScreencastRecorder`'s CDP `Page.startScreencast`
 * both read from the page, not the screen, so they keep returning real frames.
 * `tests/dogfood/sessions/919-hidden-window-mode.spec.ts` guards both halves.
 *
 * Two alternatives were measured and rejected: moving windows off the display
 * (`setPosition(-10000, 0)`) does not survive macOS, which constrains the frame
 * straight back onto the primary display, and `app.dock.hide()` breaks
 * Playwright's WebContents handle (see the dock-icon comment in the shell's
 * `main/index.ts`).
 *
 * Opt out with **`BRAINSTORM_TEST_VISIBLE=1`** when a human genuinely wants to
 * watch a run. `PROMO_CAPTURE=ffmpeg` opts out implicitly — display capture
 * films the physical screen, so it needs the windows on it.
 */

/** True when this run is allowed to paint windows on the developer's display. */
export function visibleWindowsRequested(): boolean {
	return process.env.BRAINSTORM_TEST_VISIBLE === "1" || process.env.PROMO_CAPTURE === "ffmpeg";
}

/** The hidden-window env fragment — empty when the run opted out. */
export function hiddenWindowEnv(): Record<string, string> {
	return visibleWindowsRequested() ? {} : { BRAINSTORM_HIDDEN_WINDOWS: "1" };
}

/**
 * The full env every harness shell launch passes to `_electron.launch`.
 * `extra` is merged last so a caller can add its own dev gates
 * (`BRAINSTORM_COLLAB_DEBUG`, window sizes, …).
 *
 * `BRAINSTORM_NO_FOCUS` is independent of hiding: it suppresses the `focus()`
 * calls the shell makes on windows it *has* mapped, which is still what a
 * `BRAINSTORM_TEST_VISIBLE=1` run wants.
 */
export function shellLaunchEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	return {
		...process.env,
		BRAINSTORM_DEV_INSECURE_CREDENTIALS: "1",
		BRAINSTORM_AUTO_SEED: "0",
		// Display capture films the physical screen, so it is the one mode that
		// needs windows both mapped and frontmost — leave its focus behaviour alone.
		...(process.env.PROMO_CAPTURE === "ffmpeg" ? {} : { BRAINSTORM_NO_FOCUS: "1" }),
		...hiddenWindowEnv(),
		NODE_ENV: "production",
		...extra,
	};
}
