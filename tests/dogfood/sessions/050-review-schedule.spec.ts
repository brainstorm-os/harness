/**
 * Session 050 — Mira reviews her upcoming schedule. Opens Calendar → Agenda and
 * checks her "Vertex Labs — intro call" meeting (18 Jun) appears in the upcoming
 * list. Dogfoods the Agenda view + that a created event surfaces there.
 */

import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

test("review the upcoming schedule in the Agenda view", async () => {
	test.setTimeout(180_000);
	const s = await startSession("050-review-schedule");
	try {
		const cal = await s.openApp(APP.Calendar);
		await cal.waitForTimeout(1500);

		const agendaTab = cal.locator('.cal-toolbar__tab[data-view="agenda"]').first();
		s.note(`Agenda tab present: ${(await agendaTab.count()) > 0}`);
		await agendaTab.click({ timeout: 6000 });
		await cal.waitForTimeout(900);
		await s.shot(cal, "01-agenda");

		const agendaPresent = (await cal.locator(".cal-agenda").count()) > 0;
		const rows = await cal
			.locator(".cal-agenda__row")
			.allInnerTexts()
			.catch(() => []);
		s.note(`Agenda renders: ${agendaPresent}; rows: ${rows.length}`);
		const agendaText =
			(await cal
				.locator(".cal-agenda")
				.innerText()
				.catch(() => "")) ?? "";
		const foundMeeting = /Vertex Labs — intro call/.test(agendaText);
		s.note(`Meeting "Vertex Labs — intro call" in agenda: ${foundMeeting}`);
		s.note(`Agenda preview: ${JSON.stringify(agendaText.replace(/\s+/g, " ").trim().slice(0, 200))}`);

		expect(agendaPresent).toBe(true);
		expect(foundMeeting).toBe(true);
	} finally {
		await s.finish();
	}
});
