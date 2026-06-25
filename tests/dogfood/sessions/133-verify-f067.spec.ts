/**
 * Session 133 — verify the F-067 fix end to end.
 *
 * Priya writes a note that `@`-mentions Beacon (real keystrokes, so the gated
 * autosave arms and persists `bodyRefs`), then opens the graph. The shell's
 * temporary `[F067verify]` log reports the vault link count — it should rise
 * above the pre-fix baseline of 1 once the note's mention edge materializes.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("verify F-067 — a note mention now materializes a graph edge (133)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("133-verify-f067");
	try {
		s.chat(
			SPEAKER.Priya,
			"Testing the graph fix — writing a note that links Beacon and checking it shows up as a connection.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(1500);
		await notes
			.locator('[aria-label="New note"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.waitForTimeout(1300);
		await notes
			.locator('[contenteditable="true"]')
			.first()
			.click()
			.catch(() => undefined);
		await notes.keyboard.press("Meta+ArrowUp");
		await notes.waitForTimeout(200);
		await notes.keyboard.type("F-067 verify — Beacon link", { delay: 12 });
		await notes.waitForTimeout(300);

		// Body: a real @-mention of Beacon (typeahead → Enter inserts the chip
		// with Beacon's real entity id). Real keystrokes arm the autosave gate.
		await notes.keyboard.press("Enter");
		await notes.keyboard.type("Linked: ", { delay: 20 });
		await notes.keyboard.type("@Beacon", { delay: 70 });
		await notes.waitForTimeout(900);
		await s.shot(notes, "01-mention-typeahead");
		await notes.keyboard.press("Enter");
		await notes.waitForTimeout(300);
		// A trailing keystroke guarantees an autosave-eligible commit lands.
		await notes.keyboard.type(" done.", { delay: 20 });
		await notes.waitForTimeout(1500);
		await s.shot(notes, "02-note-saved");

		// Open the graph — this triggers vaultEntities.list() (the [F067verify]
		// link-count log) and lets the edge render.
		const graph = await s.openApp(APP.Graph);
		await graph.waitForTimeout(4000);
		await s.shot(graph, "03-graph");

		s.note(
			"Created a Beacon-mention note + opened the graph; check console.log for [F067verify] link count.",
		);
	} finally {
		await s.finish();
	}
});
