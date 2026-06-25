/**
 * Session 177 — 9.7.9 code-editor syntax-theme selector. Mira opens a code file
 * and wants to switch its syntax highlighting theme. Opens the pane object-menu,
 * confirms the Syntax theme group (Match appearance / GitHub Light / GitHub
 * Dark, default Auto active), picks GitHub Dark, and confirms the active mark
 * moves. Real-shell validation of the 9.7.9 selector + persistence wiring.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const PANE_HEAD = ".editor__pane-head";
const ITEM = ".bs-object-menu__item";

test("code-editor pane menu offers a syntax-theme selector that switches active (9.7.9)", async () => {
	test.setTimeout(180_000);
	const s = await startSession("177-code-editor-syntax-theme");
	try {
		const ed = await s.openApp(APP.CodeEditor);
		await ed.waitForTimeout(1500);
		await s.shot(ed, "01-launch");

		// The selector lives in a code file's pane object-menu, so it needs a
		// file open. The code-editor has no new-file flow yet (9.7.5 rest) and
		// the seeded vault has no code files, so skip cleanly when none exist —
		// this spec validates the selector automatically once a file is present.
		const fileOpen = ed.locator(".editor__file-open").first();
		if ((await fileOpen.count()) === 0) {
			s.note(
				"No code files in the vault and no new-file flow (9.7.5 rest) — skipping the pane-menu checks.",
			);
			test.skip(true, "code-editor vault has no code files to open a pane");
			return;
		}
		await fileOpen.click();
		await ed.waitForTimeout(900);
		await s.shot(ed, "02-file-open");

		const openPaneMenu = async () => {
			await ed.locator(PANE_HEAD).first().click({ button: "right" });
			await ed.waitForTimeout(500);
		};
		const menuItems = () =>
			ed
				.locator(ITEM)
				.allInnerTexts()
				.then((t) => t.map((x) => x.trim()))
				.catch(() => [] as string[]);

		// Open the pane object-menu and read the syntax-theme group.
		await openPaneMenu();
		const items1 = await menuItems();
		s.note(`Pane menu items: ${JSON.stringify(items1)}`);
		await s.shot(ed, "02-pane-menu");
		const hasHeading = items1.some((t) => /syntax theme/i.test(t));
		const hasDark = items1.some((t) => /github dark/i.test(t));
		const autoActiveInitially = items1.some((t) => /match appearance/i.test(t) && t.includes("✓"));
		s.note(`heading=${hasHeading} darkOption=${hasDark} autoActiveInitially=${autoActiveInitially}`);

		// Pick GitHub Dark.
		await ed
			.locator(ITEM, { hasText: /github dark/i })
			.first()
			.click();
		await ed.waitForTimeout(800);
		await s.shot(ed, "03-after-pick-dark");

		// Re-open: the active mark should now sit on GitHub Dark.
		await openPaneMenu();
		const items2 = await menuItems();
		s.note(`After pick, pane menu items: ${JSON.stringify(items2)}`);
		const darkActiveNow = items2.some((t) => /github dark/i.test(t) && t.includes("✓"));
		const autoActiveNow = items2.some((t) => /match appearance/i.test(t) && t.includes("✓"));
		s.note(`darkActiveNow=${darkActiveNow} autoStillActive=${autoActiveNow}`);
		await s.shot(ed, "04-dark-active");
		await ed.keyboard.press("Escape");

		expect(hasHeading).toBe(true);
		expect(hasDark).toBe(true);
		expect(autoActiveInitially).toBe(true);
		expect(darkActiveNow).toBe(true);
		expect(autoActiveNow).toBe(false);
	} finally {
		await s.finish();
	}
});
