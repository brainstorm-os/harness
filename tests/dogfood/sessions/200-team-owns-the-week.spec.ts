/**
 * Session 200 — Day 2: the team actually OWNS the week.
 *
 * Yesterday assignee shipped (F-152). Today Mira re-owns the title-string-era
 * deliverables with real assignees, and the team runs its first real comment
 * review on the Issue #4 outline — which also gives the just-landed B11.9
 * click-to-thread chip its first real-shell look (hover a commented block →
 * "View comments" chip → panel scrolls to the thread).
 */

import { expect, test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Mira re-owns the week's deliverables with real assignees (200)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("200-team-owns-the-week");
	try {
		s.chat(
			SPEAKER.Mira,
			"Monday housekeeping: every deliverable that says 'Priya —' or 'Marcus's' in the title gets a real assignee instead. Then I want to read the week by person.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(2000);

		// Work from Upcoming, where the week's deliverables live.
		await tasks
			.locator("text=Upcoming")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(1200);
		await s.shot(tasks, "01-upcoming-before");

		// Open a title-string-era deliverable (Priya's outline if findable).
		const priyaTask = tasks.locator("text=Issue #4").first();
		const target = (await priyaTask.isVisible().catch(() => false))
			? priyaTask
			: tasks.locator(".task-row, [data-task-id], .tasks-list li").first();
		await target.click().catch(() => undefined);
		await tasks.waitForTimeout(1500);

		// Properties panel up, then assign via the value cell.
		if (
			!(await tasks
				.locator("text=Assignee")
				.first()
				.isVisible()
				.catch(() => false))
		) {
			await tasks
				.locator('[aria-label*="roperties"], [aria-label*="Info"]')
				.first()
				.click()
				.catch(() => undefined);
			await tasks.waitForTimeout(1000);
		}
		await tasks
			.locator("text=Assignee")
			.first()
			.locator("xpath=following-sibling::*[1]")
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(800);
		await tasks.keyboard.type("Priya", { delay: 30 }).catch(() => undefined);
		await tasks.waitForTimeout(800);
		await tasks
			.locator("text=Priya Nair")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(1200);
		const assigned = await tasks
			.locator("text=Priya Nair")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`deliverable now carries assignee Priya Nair: ${assigned}`);
		await s.shot(tasks, "02-assigned");

		// The founder's next instinct: read the week BY PERSON. Look for any
		// group-by / filter-by assignee affordance on Upcoming / Board.
		await tasks
			.locator("text=Upcoming")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(1000);
		const anyAssigneeView = await tasks
			.locator("text=/by assignee|Assignee/i")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(
			`any by-assignee read on the list surfaces (group/filter/avatar chips): ${anyAssigneeView}`,
		);
		await s.shot(tasks, "03-upcoming-after");

		s.chat(
			SPEAKER.Mira,
			assigned
				? "Deliverables are owned properly now. But the lists still read as one undifferentiated pile — I can write 'Priya owns this' and still can't ASK 'what's on Priya's plate this week?'. Filing that."
				: "Couldn't finish re-owning — picker trouble; noting it.",
		);
		expect(assigned).toBe(true);
	} finally {
		await s.finish();
	}
});

test("Priya comments on the outline; Mira jumps to the thread from the block (200b)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("200b-comment-review");
	try {
		s.chat(
			SPEAKER.Priya,
			"First real review pass on the Issue #4 outline — leaving a comment where the argument is thin.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForTimeout(2000);

		// Open the Issue #4 outline (fall back to the first sidebar note).
		const outline = notes.locator("text=Issue #4").first();
		if (await outline.isVisible().catch(() => false)) {
			await outline.click().catch(() => undefined);
		} else {
			await notes
				.locator(".notes__list li, [data-note-id]")
				.first()
				.click()
				.catch(() => undefined);
		}
		await notes.waitForTimeout(1500);
		await s.shot(notes, "01-doc-open");

		// Select a sentence in a body paragraph (triple-click selects the block's
		// text) so the inline toolbar surfaces its "Comment" action.
		const para = notes.locator('[contenteditable="true"] p').first();
		await para.click({ clickCount: 3 }).catch(() => undefined);
		await notes.waitForTimeout(800);
		await s.shot(notes, "02-selection");

		const commentAction = notes.locator('button:has-text("Comment"), [aria-label="Comment"]').first();
		const toolbarHasComment = await commentAction.isVisible().catch(() => false);
		s.note(`inline toolbar offers Comment on selection: ${toolbarHasComment}`);
		if (toolbarHasComment) {
			await commentAction.click().catch(() => undefined);
			await notes.waitForTimeout(1000);
			// The Comments panel composer focuses; type + submit.
			await notes.keyboard.type("This claim needs the Beacon numbers behind it.", { delay: 10 });
			await notes
				.locator('button:has-text("Comment")')
				.last()
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1200);
			await s.shot(notes, "03-comment-posted");
		}

		// Mira's half: hover the commented block → the B11.9 chip appears →
		// click → the Comments panel scrolls to the thread.
		await para.hover().catch(() => undefined);
		await notes.waitForTimeout(800);
		const chip = notes.locator('[aria-label="View comments"]').first();
		const chipVisible = await chip.isVisible().catch(() => false);
		s.note(`B11.9: hover chip ("View comments") appears on the commented block: ${chipVisible}`);
		await s.shot(notes, "04-hover-chip");

		if (chipVisible) {
			await chip.click().catch(() => undefined);
			await notes.waitForTimeout(1200);
			const threadVisible = await notes
				.locator("text=This claim needs the Beacon numbers")
				.first()
				.isVisible()
				.catch(() => false);
			s.note(`panel open + thread in view after chip click: ${threadVisible}`);
			await s.shot(notes, "05-thread-focused");
		}

		s.chat(
			SPEAKER.Mira,
			chipVisible
				? "Saw Priya's highlight in the doc, hovered, one click and I'm reading her thread. Review inside the tool works."
				: "No way to get from the highlighted block to the comment — had to hunt the panel. Filing.",
		);
	} finally {
		await s.finish();
	}
});
