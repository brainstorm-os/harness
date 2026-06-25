/**
 * Session 192 — Mira tours the commercial + team spine that just shipped (Tue).
 *
 * Months of wishlist gaps (sessions 110/111/112) were all on the SAME theme:
 * Brainstorm was a strong knowledge/planning tool with **no commercial spine** —
 * no automations to manage a pipeline, no way to invoice, no client comms, no
 * people/team model. Those apps were scaffolded stubs back then. They're built
 * now (Automations, Form Designer, Mailbox, Contacts, Browser). So Mira sits
 * down to actually *run business processes* through them:
 *
 *   1. Automations — author a pipeline rule ("Client → Proposal ⇒ make a task").
 *   2. Form Designer — start an invoice for the Vertex engagement.
 *   3. Mailbox — client comms surface.
 *   4. Contacts — the people/team model (clients' contacts + teammates).
 *   5. Browser — capture a research source in-app.
 *
 * This is a *tour to verify the spine exists and is usable*, not a scripted
 * assertion. Chat lines stay neutral; the verdict (and any friction) is decided
 * from the captures afterward, per the loop protocol.
 */

import { test } from "@playwright/test";
import { APP, type AppId, SPEAKER, startSession } from "../lib/founder";

test("Mira tours the commercial + team spine (192)", async () => {
	test.setTimeout(360_000);
	const s = await startSession("192-mira-commercial-spine-tour");
	try {
		s.chat(
			SPEAKER.Mira,
			"Half my wishlist was 'Brainstorm can't run the business side' — no automations, no invoices, no client comms, no people model. Those apps exist now. Time to actually try running Northbound's commercial side through them.",
		);

		// A tolerant "open app, settle, capture the landing + a wide shot" helper.
		// Each app is its own try so one missing/raw app doesn't end the tour.
		const tour: Array<{ id: AppId; slug: string; what: string }> = [
			{ id: APP.Automations, slug: "automations", what: "pipeline status rules" },
			{ id: APP.FormDesigner, slug: "form-designer", what: "invoice / proposal builder" },
			{ id: APP.Mailbox, slug: "mailbox", what: "client + audience comms" },
			{ id: APP.Contacts, slug: "contacts", what: "people / team model" },
			{ id: APP.Browser, slug: "browser", what: "in-app source capture" },
		];

		let n = 0;
		for (const stop of tour) {
			n += 1;
			const prefix = `${String(n).padStart(2, "0")}-${stop.slug}`;
			s.note(`\n## ${stop.slug} — ${stop.what}`);
			try {
				const p = await s.openApp(stop.id);
				await p.waitForLoadState("domcontentloaded").catch(() => undefined);
				await p.waitForTimeout(1800);
				await s.shot(p, `${prefix}-landing`);

				// Record the broad shape of what loaded: header title, the primary
				// empty-state / body text, any obvious "new"/"create" affordance, and
				// whether it still reads as a coming-soon stub.
				const headerTitle = await p
					.locator(".app-header__title, .app-header h1, header h1")
					.first()
					.innerText()
					.catch(() => "");
				const comingSoon = await p
					.locator(".coming-soon, [data-coming-soon], text=/coming soon/i")
					.first()
					.count()
					.catch(() => 0);
				const createAffordances = await p
					.locator(
						"[data-testid$='-new'], button:has-text('New'), button:has-text('Create'), button:has-text('Add')",
					)
					.allInnerTexts()
					.catch(() => []);
				s.note(`header title: "${headerTitle}"`);
				s.note(`reads as coming-soon stub: ${comingSoon > 0}`);
				s.note(`create/add affordances: ${JSON.stringify(createAffordances.slice(0, 8))}`);

				// App-specific probe: try the first natural "start something" action so
				// the screenshot shows the authoring surface, not just the empty state.
				if (stop.id === APP.Automations) {
					const newRule = p
						.locator(
							"[data-testid='automations-new'], button:has-text('New rule'), button:has-text('New automation'), button:has-text('New')",
						)
						.first();
					if (await newRule.count().catch(() => 0)) {
						await newRule.click().catch(() => undefined);
						await p.waitForTimeout(1200);
						await s.shot(p, `${prefix}-new-rule`);
						const triggerOpts = await p
							.locator(".automations-trigger, [data-trigger], select, .fm-menu__item")
							.allInnerTexts()
							.catch(() => []);
						s.note(`rule-authoring surface text: ${JSON.stringify(triggerOpts.slice(0, 12))}`);
					}
				}
				if (stop.id === APP.FormDesigner) {
					const newForm = p
						.locator(
							"[data-testid='form-new'], button:has-text('New form'), button:has-text('Invoice'), button:has-text('New'), button:has-text('Template')",
						)
						.first();
					if (await newForm.count().catch(() => 0)) {
						await newForm.click().catch(() => undefined);
						await p.waitForTimeout(1200);
						await s.shot(p, `${prefix}-new-form`);
					}
				}
				if (stop.id === APP.Browser) {
					// Try to navigate to a real research source so capture is exercised.
					const addr = p
						.locator(
							"input[type='url'], input[placeholder*='Search'], input[placeholder*='address'], .browser-omnibox input, [data-testid='omnibox']",
						)
						.first();
					if (await addr.count().catch(() => 0)) {
						await addr.fill("https://example.com").catch(() => undefined);
						await addr.press("Enter").catch(() => undefined);
						await p.waitForTimeout(2500);
						await s.shot(p, `${prefix}-loaded-page`);
					}
				}

				await s.shot(p, `${prefix}-final`);
			} catch (err) {
				s.note(`could not complete the ${stop.slug} stop: ${(err as Error).message}`);
			}
		}

		// Back to the CRM to re-check the pipeline modelling the automations rule
		// would drive: does Clients carry a Stage, and is a pipeline total visible?
		try {
			const db = await s.openApp(APP.Database);
			await db.waitForTimeout(1800);
			await s.shot(db, "06-database-landing");
			const lists = await db
				.locator(".db-sidebar__item, .db-lists__item, [data-list-name]")
				.allInnerTexts()
				.catch(() => []);
			s.note(`database lists: ${JSON.stringify(lists.slice(0, 20))}`);
			const footer = await db
				.locator(".db-grid__footer, .db-aggregation, [data-aggregation]")
				.allInnerTexts()
				.catch(() => []);
			s.note(`aggregation footer text: ${JSON.stringify(footer.slice(0, 12))}`);
			await s.shot(db, "06-database-final");
		} catch (err) {
			s.note(`database re-check skipped: ${(err as Error).message}`);
		}

		s.chat(
			SPEAKER.Mira,
			"Walked the whole commercial + team spine. Reading the captures now to see what's real and usable vs. still a shell — then I'll mark the wishlist.",
		);
		s.note("\nTour complete; verdict per app + wishlist reconciliation decided from captures.");
	} finally {
		await s.finish();
	}
});
