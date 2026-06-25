/**
 * Session 059 — Mira jumps between notes and uses Back/Forward.
 *
 * She opens her prep note, then her thesis, then wants to step back to where
 * she was. Exercises the shared nav-history primitive (B8) in Notes: the
 * back/forward buttons restore the previously-viewed object, and forward
 * re-advances. A core daily interaction not yet dogfooded.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

async function currentTitle(notes: import("@playwright/test").Page): Promise<string> {
	const t = await notes.locator(".notes__title, .notes__header-title").first().textContent();
	return (t ?? "").trim();
}

test("nav back/forward restores the previously-viewed note", async () => {
	test.setTimeout(180_000);
	const s = await startSession("059-nav-back-forward");
	try {
		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);

		await notes.locator("text=Vertex Labs — intro call prep").first().click();
		await notes.waitForTimeout(800);
		const titleA = await currentTitle(notes);
		s.note(`opened A: "${titleA}"`);

		await notes.locator("text=Northbound — investment thesis").first().click();
		await notes.waitForTimeout(800);
		const titleB = await currentTitle(notes);
		s.note(`opened B: "${titleB}"`);
		await s.shot(notes, "01-at-B");

		await notes.locator('[data-testid="nav-back"]').first().click();
		await notes.waitForTimeout(800);
		const afterBack = await currentTitle(notes);
		s.note(`after Back: "${afterBack}"`);
		await s.shot(notes, "02-after-back");

		await notes.locator('[data-testid="nav-forward"]').first().click();
		await notes.waitForTimeout(800);
		const afterForward = await currentTitle(notes);
		s.note(`after Forward: "${afterForward}"`);
		await s.shot(notes, "03-after-forward");

		expect(titleA, "A is the prep note").toMatch(/Vertex Labs/i);
		expect(titleB, "B is the thesis note").toMatch(/Northbound/i);
		expect(afterBack, "Back returns to A (the prep note)").toMatch(/Vertex Labs/i);
		expect(afterForward, "Forward re-advances to B (the thesis note)").toMatch(/Northbound/i);
	} finally {
		await s.finish();
	}
});
