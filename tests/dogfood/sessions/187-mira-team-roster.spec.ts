/**
 * Session 187 — Mira builds the team roster in Contacts (Tue).
 *
 * F-152 (no assignee on tasks) means ownership lives in title strings. The
 * least Mira can do today is have real *people records* for her team, so when
 * an assignee field lands there's something to point at. She adds Marcus Lee
 * (Product Designer) and Priya Nair (Research Editor) to Contacts, sets their
 * company to Northbound, and tries to capture their role + relate them to each
 * other. Real CRM-of-team work; verdict + any friction from the captures.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

type Member = { name: string; role: string };
const TEAM: Member[] = [
	{ name: "Marcus Lee", role: "Product Designer" },
	{ name: "Priya Nair", role: "Research Editor" },
];

test("Mira builds the team roster in Contacts (187)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("187-mira-team-roster");
	try {
		s.chat(
			SPEAKER.Mira,
			"Can't assign tasks to people yet (F-152), but I can at least have real contact records for Marcus and Priya. Adding the team to Contacts with their roles + company.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);
		await s.shot(c, "01-contacts-open");

		const existing = (
			await c
				.locator(".contacts-row")
				.allInnerTexts()
				.catch(() => [])
		).map((t) => t.replace(/\s+/g, " ").trim());
		s.note(`contacts already in the book: ${JSON.stringify(existing)}`);

		for (const m of TEAM) {
			if (existing.some((e) => e.includes(m.name))) {
				s.note(`"${m.name}" already in the book — skipping create`);
				continue;
			}
			await c
				.locator("[data-testid='contacts-new']")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(900);
			const nameInput = c.locator(".contacts-detail__title-input").first();
			await nameInput.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
			await nameInput.fill(m.name).catch(() => undefined);
			await nameInput.press("Enter").catch(() => undefined);
			await c.waitForTimeout(1000);

			// Try to record the role. The detail view may expose a role/title field;
			// if it doesn't, that absence is the finding (a team roster needs roles).
			const roleField = c
				.locator(
					".contacts-detail__role input, [data-property-key='role'] input, [data-property-key='title'] input, .contacts-detail__field--role input",
				)
				.first();
			let roleSet = false;
			if (await roleField.count().catch(() => 0)) {
				await roleField.fill(m.role).catch(() => undefined);
				await roleField.press("Enter").catch(() => undefined);
				roleSet = true;
			}
			s.note(`created "${m.name}"; role field present + set: ${roleSet}`);
			await s.shot(c, `02-detail-${m.name.split(" ")[0]?.toLowerCase()}`);

			// Set company to Northbound via the inline add-company affordance.
			const addBtn = c.locator(".contacts-detail__add-company").first();
			if (await addBtn.count().catch(() => 0)) {
				await addBtn.click().catch(() => undefined);
				await c.waitForTimeout(400);
				const input = c.locator(".contacts-detail__add-company-input").first();
				await input.fill("Northbound").catch(() => undefined);
				await input.press("Enter").catch(() => undefined);
				await c.waitForTimeout(900);
			}
			const companyLink = await c
				.locator(".contacts-detail__company-link")
				.first()
				.innerText()
				.catch(() => "");
			s.note(`"${m.name}" company link: "${companyLink}"`);

			await c
				.locator("[data-testid='nav-back']")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(800);
		}

		// Confirm the roster.
		const finalRoster = (
			await c
				.locator(".contacts-row")
				.allInnerTexts()
				.catch(() => [])
		).map((t) => t.replace(/\s+/g, " ").trim());
		s.note(`final roster: ${JSON.stringify(finalRoster)}`);
		await s.shot(c, "03-roster");

		const haveBoth = TEAM.every((m) => finalRoster.some((r) => r.includes(m.name)));
		s.chat(
			SPEAKER.Mira,
			haveBoth
				? "Marcus and Priya are in Contacts now under Northbound. Whether a contact can even hold a job-title/role is the open question — checking the captures."
				: "Couldn't get the whole team into Contacts cleanly — filing what blocked me.",
		);
		s.note("Mira built the team roster; verdict + role-field finding from captures.");
	} finally {
		await s.finish();
	}
});
