/**
 * Session 176 — Marcus design-reviews the new Contacts app.
 *
 * Marcus's lens is consistency + craft, and a brand-new app is exactly where a
 * new tool betrays itself. He scrutinises the header (does the title sit on the
 * 44px baseline with the action on the same row, or does it read like an
 * unstyled page?), the empty state, the list rows + avatars, and the detail
 * route + properties panel. He compares against the apps he already trusts
 * (Tasks / Bookmarks) — same header height, same control sizes, same accent.
 * He files specific, substantiated findings: exact element, why it's wrong,
 * what he'd expect. Verdict from the captures + measured geometry.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus design-reviews the Contacts app (176)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("176-marcus-contacts-design-review");
	try {
		s.chat(
			SPEAKER.Marcus,
			"New Contacts app to review. First impressions matter — a new tool that looks unfinished loses me immediately. Checking the header first; an oversized title with the action stacked underneath is the classic 'unstyled app' tell.",
		);

		const c = await s.openApp(APP.Contacts);
		await c.waitForLoadState("domcontentloaded");
		await c.waitForTimeout(1500);
		await s.shot(c, "01-contacts-list");

		// Header geometry: height on the shared 44px baseline, title a sane
		// header-size (NOT a default browser h1 ~32px), and the right-group
		// action on the SAME row as the title (tops aligned, action to the right).
		const header = await c.evaluate(() => {
			const h = document.querySelector(".app-header");
			const title = document.querySelector(".app-header__title");
			const right = document.querySelector(".app-header__right");
			const hr = h?.getBoundingClientRect();
			const tr = title?.getBoundingClientRect();
			const rr = right?.getBoundingClientRect();
			return {
				headerHeight: hr ? Math.round(hr.height) : null,
				headerDisplay: h ? getComputedStyle(h).display : null,
				titleFontPx: title ? Math.round(Number.parseFloat(getComputedStyle(title).fontSize)) : null,
				titleWeight: title ? getComputedStyle(title).fontWeight : null,
				sameRow: tr && rr ? Math.abs(tr.top - rr.top) < 12 : null,
				actionRightOfTitle: tr && rr ? rr.left > tr.right : null,
			};
		});
		s.note(`header geometry: ${JSON.stringify(header)}`);
		const headerClean =
			header.headerDisplay === "flex" &&
			(header.titleFontPx ?? 99) <= 20 &&
			header.sameRow === true &&
			header.actionRightOfTitle === true;
		s.chat(
			SPEAKER.Marcus,
			headerClean
				? `Header reads right: ${header.headerHeight}px bar, ${header.titleFontPx}px title, action on the same row to the right. Matches the apps I already trust.`
				: `Header is off — title ${header.titleFontPx}px, sameRow=${header.sameRow}, action-right=${header.actionRightOfTitle}. That's the unstyled-app look. Filing it.`,
		);

		// Compare a control: the New-contact button vs the shared 28px control
		// height the other apps use.
		const btn = await c
			.locator("[data-testid='contacts-new']")
			.first()
			.evaluate((el) => {
				const r = el.getBoundingClientRect();
				const cs = getComputedStyle(el);
				return { h: Math.round(r.height), bg: cs.backgroundColor, radius: cs.borderRadius };
			})
			.catch(() => null);
		s.note(`New-contact button: ${JSON.stringify(btn)}`);

		// Empty-state copy (or, if Mira already seeded people, the list rows).
		const emptyTitle = await c
			.locator(".contacts-list__empty-title")
			.first()
			.innerText()
			.catch(() => null);
		const rowCount = await c
			.locator(".contacts-row")
			.count()
			.catch(() => 0);
		s.note(`empty-state title: ${emptyTitle ?? "(none — list populated)"} · rows=${rowCount}`);
		await s.shot(c, "02-contacts-list-or-empty");

		// If there are rows, open one and review the detail route + properties.
		if (rowCount > 0) {
			await c
				.locator(".contacts-row")
				.first()
				.click()
				.catch(() => undefined);
			await c.waitForTimeout(1100);
			await s.shot(c, "03-contacts-detail");
			const detail = await c.evaluate(() => {
				const name = document.querySelector(".contacts-detail__name");
				const header = document.querySelector(".contacts-detail .app-header");
				return {
					hasName: !!name,
					detailHeaderH: header ? Math.round(header.getBoundingClientRect().height) : null,
				};
			});
			s.note(`detail route: ${JSON.stringify(detail)}`);

			// Toggle the properties panel — it should be the shared `.bs-props`
			// glass overlay floating above content, not a reserved column.
			const infoBtn = c.locator(".contacts-icon-btn").first();
			if (await infoBtn.count()) {
				await infoBtn.click().catch(() => undefined);
				await c.waitForTimeout(900);
				const props = await c
					.locator(".bs-props, .bs-props__inner")
					.first()
					.evaluate((el) => {
						const cs = getComputedStyle(el);
						return { position: cs.position, display: cs.display };
					})
					.catch(() => null);
				s.note(`properties panel: ${JSON.stringify(props)}`);
				await s.shot(c, "04-contacts-properties");
			}
		}

		s.chat(
			SPEAKER.Marcus,
			"Done with the Contacts pass — header, controls, empty state, detail + properties. Verdict and specific findings from the captures + geometry.",
		);
		s.note(
			"Marcus design-reviewed Contacts: header geometry, controls, empty state, detail/properties.",
		);
	} finally {
		await s.finish();
	}
});
