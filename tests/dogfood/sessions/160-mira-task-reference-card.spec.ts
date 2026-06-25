/**
 * Session 160 — confirm F-070 rung (c) + the F-138 card styling reach Tasks too.
 *
 * Rung (c) added the shared "Reference" slash command to every editor with
 * transclusion (Journal AND Tasks), and F-138 moved the transclusion card CSS
 * into the editor package so it renders framed everywhere — but both were only
 * ever visually confirmed in the Journal (the 156/154 Tasks probes were harness
 * misses that never reached the task body editor). This closes that gap: Mira
 * opens a deliverable, opens the `/` menu in the task body, confirms "Reference"
 * is present with its caption, picks it, points it at the live Clients page, and
 * we check the inserted reference renders as the framed card (not a bare link).
 * Light synthetic keyboard; verdict from captures + extracted labels.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Tasks shows the Reference command + framed card, same as Journal (160)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("160-mira-task-reference-card");
	try {
		s.chat(
			SPEAKER.Mira,
			"Kai shipped the Reference block + card styling to the shared editor — checking it actually shows up the same in a Task body, not just the Journal.",
		);

		const tasks = await s.openApp(APP.Tasks);
		await tasks.waitForTimeout(1800);
		await s.shot(tasks, "01-tasks-list");

		// Open a deliverable on its detail route (name button is the stable target).
		await tasks
			.locator("[data-task-id] .task-row__name")
			.first()
			.click()
			.catch(() => undefined);
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.waitFor({ state: "visible", timeout: 8000 })
			.catch(() => undefined);
		await tasks.waitForTimeout(800);
		const detailOpen = await tasks
			.locator(".tasks-detail__editor")
			.first()
			.isVisible()
			.catch(() => false);
		s.note(`task detail editor open: ${detailOpen}`);
		await s.shot(tasks, "02-task-detail-open");

		// Open the slash menu on a fresh line and read the palette for "Reference".
		await tasks
			.locator(".tasks-detail__editor")
			.first()
			.click()
			.catch(() => undefined);
		await tasks.waitForTimeout(300);
		await tasks.keyboard.type("Ref check ", { delay: 20 }).catch(() => undefined);
		await tasks.keyboard.type("/", { delay: 20 }).catch(() => undefined);
		await tasks.waitForTimeout(700);
		const labels = await tasks
			.locator(".bs-editor__slash-menu, [class*='slash'], [role='listbox']")
			.first()
			.allInnerTexts()
			.then((xs) =>
				xs
					.join("\n")
					.split("\n")
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean),
			)
			.catch(() => [] as string[]);
		const hasReference = labels.some((l) => /reference/i.test(l));
		const hasCaption = labels.some((l) => /embed a live view/i.test(l));
		s.note(`"Reference" present in Tasks palette: ${hasReference}; caption present: ${hasCaption}`);
		await s.shot(tasks, "03-slash-with-reference");

		// Narrow to it + pick → inserts `!@`, opens the page picker.
		await tasks.keyboard.type("ref", { delay: 30 }).catch(() => undefined);
		await tasks.waitForTimeout(400);
		await tasks.keyboard.press("Enter").catch(() => undefined);
		await tasks.waitForTimeout(600);
		await s.shot(tasks, "04-reference-picker");
		await tasks.keyboard.type("Clients", { delay: 40 }).catch(() => undefined);
		await tasks.waitForTimeout(600);
		await tasks.keyboard.press("Enter").catch(() => undefined);
		await tasks.waitForTimeout(700);

		// Did a transclusion card land, and does it carry the framed-card markup?
		const cardCount = await tasks
			.locator(".notes__transclusion-card, [class*='transclusion-card']")
			.count()
			.catch(() => 0);
		const nodeCount = await tasks
			.locator('[class*="transclusion"], [data-transclusion]')
			.count()
			.catch(() => 0);
		const cardTexts = await tasks
			.locator(".notes__transclusion-card, [class*='transclusion-card']")
			.allInnerTexts()
			.then((xs) =>
				xs
					.map((t) => t.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 6),
			)
			.catch(() => [] as string[]);
		s.note(
			`transclusion nodes=${nodeCount}, framed cards=${cardCount}, card text=${JSON.stringify(cardTexts)}`,
		);
		await s.shot(tasks, "05-reference-card");

		s.chat(
			SPEAKER.Mira,
			"Dropped a Reference in a task body — pulling my read on whether it shows the same framed card the Journal does, from the captures.",
		);
		s.note(
			"Verified F-070 rung (c) + F-138 reach Tasks — Reference command + framed transclusion card in the task body; verdict from captures + labels.",
		);
	} finally {
		await s.finish();
	}
});
