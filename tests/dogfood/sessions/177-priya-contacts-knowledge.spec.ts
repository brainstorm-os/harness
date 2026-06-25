/**
 * Session 177 — Priya stress-tests the Contacts app's knowledge layer.
 *
 * Contacts is a surface over the shared Person/v1 space, and its value to
 * knowledge work is the *connections*: a person → their company, a person →
 * related people, and whether those refs actually resolve + navigate. Priya's
 * lens: a contact that names a company that doesn't open, or a "related person"
 * that dead-ends, is worse than no link. She opens a contact, reads the linked
 * company / related people, and tries to follow them. She also checks the
 * upcoming-birthdays strip reflects real data. Findings from captures + the
 * resolved-vs-dead-link evidence.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Priya audits Contacts' links + knowledge connections (177)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("177-priya-contacts-knowledge");
	try {
		s.chat(
			SPEAKER.Priya,
			"Contacts is only as good as its connections. A person who names a company should let me open that company; a 'related person' should resolve, not dead-end. Auditing the link layer.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);
		await s.shot(c, "01-contacts-open");

		const rowCount = await c
			.locator(".contacts-row")
			.count()
			.catch(() => 0);
		s.note(`contacts in the book: ${rowCount}`);

		if (rowCount === 0) {
			s.chat(
				SPEAKER.Priya,
				"Empty book this run — no contacts to trace links through. Noting that the link audit needs seeded people; I'll re-run after Mira fills it.",
			);
			s.note("Priya: empty Contacts book — link audit deferred until people exist.");
			return;
		}

		// Open the first contact and inspect the detail route for link affordances.
		await c
			.locator(".contacts-row")
			.first()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(1100);
		await s.shot(c, "02-contact-detail");

		const links = await c.evaluate(() => {
			const company = document.querySelector(".contacts-detail__company-link");
			const related = Array.from(
				document.querySelectorAll(
					".contacts-detail__related a, .contacts-detail__related button, [class*='related'] a, [class*='related'] button",
				),
			);
			return {
				hasCompanyLink: !!company,
				companyText: company?.textContent?.trim() ?? null,
				relatedCount: related.length,
				relatedNames: related
					.map((r) => r.textContent?.trim() ?? "")
					.filter(Boolean)
					.slice(0, 8),
			};
		});
		s.note(`detail links: ${JSON.stringify(links)}`);

		// Follow a related person if one exists — does the in-app navigation land
		// on a real contact (name renders), or dead-end?
		if (links.relatedCount > 0) {
			const before = await c
				.locator(".contacts-detail__name")
				.first()
				.innerText()
				.catch(() => "");
			await c
				.locator(
					".contacts-detail__related a, .contacts-detail__related button, [class*='related'] a, [class*='related'] button",
				)
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(1000);
			const after = await c
				.locator(".contacts-detail__name")
				.first()
				.innerText()
				.catch(() => "");
			s.note(`related-person navigation: "${before}" → "${after}" (changed=${before !== after})`);
			await s.shot(c, "03-after-following-related");
		}

		// Birthday strip — is the upcoming-birthdays section reflecting real data?
		await c
			.locator("[aria-label='Back to list'], .header-nav button")
			.first()
			.click()
			.catch(() => undefined);
		await c.waitForTimeout(800);
		const upcoming = await c
			.locator(".contacts-list__upcoming .contacts-row__name")
			.allInnerTexts()
			.then((xs) => xs.map((t) => t.trim()).filter(Boolean))
			.catch(() => [] as string[]);
		s.note(`upcoming-birthday strip: ${JSON.stringify(upcoming)}`);

		s.chat(
			SPEAKER.Priya,
			links.hasCompanyLink || links.relatedCount > 0
				? "There are real link affordances here — tracing whether they resolve and navigate. Verdict from the capture."
				: "The contacts I checked carry no resolvable company / related-person links yet — that's the gap for knowledge work. Filing it.",
		);
		s.note(
			"Priya audited Contacts' link layer: company link, related people navigation, birthday strip.",
		);
	} finally {
		await s.finish();
	}
});
