/**
 * Session 228 — deep Calendar walkthrough. A founder-driven functional sweep of
 * the Calendar app that exercises EVERY surface to surface broken features:
 * view switching (Year / Month / Week / Day / Agenda), Today / Prev / Next
 * navigation, the New-event dialog (title, native datetime inputs, all-day,
 * "More options", save → grid render), event-chip click → detail popover,
 * rename / reschedule, the CALENDARS sidebar source toggles, empty day / hour
 * slot create flows, event search, the header ⋯ "Calendar actions" menu, the
 * cross-object LINK path (clicking a Task / Note shown on the calendar must
 * open that object), and deletion cleanup. Every action is judged from
 * observable DOM and recorded as [PASS]/[FAIL]/[?]; nothing aborts the run.
 *
 * Read back from `tests/dogfood/.sessions/228-deep-calendar/notes.md`.
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, type FounderSession, startSession } from "../lib/founder";

const VIEW_KINDS = ["year", "month", "week", "day", "agenda"] as const;
type ViewKind = (typeof VIEW_KINDS)[number];

const SOURCES = ["event", "task", "note", "journal", "birthday"] as const;

const UNIQUE_TITLE = `Deep Calendar Probe ${Date.now().toString(36)}`;
const RENAMED_TITLE = `${UNIQUE_TITLE} (renamed)`;

test("deep calendar walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-calendar");
	const cal = await s.openApp(APP.Calendar);

	/** Record one judged step. Never throws. */
	const judge = async (
		action: string,
		fn: () => Promise<string | { verdict: string; detail: string }>,
	) => {
		try {
			const out = await fn();
			if (typeof out === "string") s.note(out);
			else s.note(`[${out.verdict}] ${action} — ${out.detail}`);
		} catch (error) {
			s.note(`[FAIL] ${action} — threw: ${(error as Error).message}`);
		}
	};

	const rangeLabel = async (): Promise<string> =>
		(
			await cal
				.locator(".cal-toolbar__range")
				.first()
				.textContent()
				.catch(() => null)
		)?.trim() ?? "";

	const activeView = async (): Promise<string> =>
		(await cal
			.locator(".calendar-main")
			.first()
			.getAttribute("data-view-kind")
			.catch(() => null)) ?? "";

	const dialogOpen = async (): Promise<boolean> =>
		cal
			.locator(".cal-detail")
			.first()
			.isVisible()
			.catch(() => false);

	const chipCount = async (): Promise<number> =>
		cal
			.locator(".cal-chip")
			.count()
			.catch(() => 0);

	const findOurChip = () =>
		cal.locator(`.cal-chip:has-text(${JSON.stringify(UNIQUE_TITLE)})`).first();

	const closeAnyMenu = async (): Promise<void> => {
		await cal.keyboard.press("Escape").catch(() => undefined);
		await cal.waitForTimeout(150);
	};

	try {
		await cal.waitForTimeout(2600);
		await cal.waitForSelector(".calendar-main", { timeout: 15_000 }).catch(() => undefined);
		await s.shot(cal, "00-calendar-opened");
		s.note(
			`Initial view: ${await activeView()} · range "${await rangeLabel()}" · chips ${await chipCount()}`,
		);

		// ── 1. View switching — every view tab changes layout ────────────────
		const viewMarker: Record<ViewKind, string> = {
			year: ".cal-year",
			month: ".cal-month-host",
			week: ".cal-week",
			day: ".cal-week",
			agenda: ".cal-agenda",
		};
		for (const kind of VIEW_KINDS) {
			await judge(`switch to ${kind} view`, async () => {
				const tab = cal.locator(`.cal-toolbar__tab[data-view="${kind}"]`).first();
				const present = await tab.count();
				if (!present) return { verdict: "FAIL", detail: "view tab not found" };
				await tab.click();
				await cal.waitForTimeout(700);
				const dv = await activeView();
				const markerVisible = await cal
					.locator(viewMarker[kind])
					.first()
					.isVisible()
					.catch(() => false);
				const selected = await tab.getAttribute("aria-selected").catch(() => null);
				const ok = dv === kind && markerVisible;
				return {
					verdict: ok ? "PASS" : "FAIL",
					detail: `data-view-kind=${dv} marker=${markerVisible} aria-selected=${selected} range="${await rangeLabel()}"`,
				};
			});
			await s.shot(cal, `01-view-${kind}`);
		}

		// ── 2. Navigation: Prev / Next / Today change the range label ────────
		// Settle on Month for stable per-step range deltas.
		await cal
			.locator('.cal-toolbar__tab[data-view="month"]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(500);

		await judge("navigate Next (month)", async () => {
			const before = await rangeLabel();
			await cal
				.locator('.cal-toolbar__nav button[aria-label="Next"], .cal-toolbar__nav [title="Next"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(500);
			const after = await rangeLabel();
			return {
				verdict: before !== after && after.length > 0 ? "PASS" : "FAIL",
				detail: `"${before}" → "${after}"`,
			};
		});

		await judge("navigate Previous (month)", async () => {
			const before = await rangeLabel();
			await cal
				.locator(
					'.cal-toolbar__nav button[aria-label="Previous"], .cal-toolbar__nav [title="Previous"]',
				)
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(500);
			const after = await rangeLabel();
			return { verdict: before !== after ? "PASS" : "FAIL", detail: `"${before}" → "${after}"` };
		});

		await judge("navigate forward twice then Today returns", async () => {
			const home = await rangeLabel();
			const next = cal
				.locator('.cal-toolbar__nav button[aria-label="Next"], .cal-toolbar__nav [title="Next"]')
				.first();
			await next.click().catch(() => undefined);
			await cal.waitForTimeout(300);
			await next.click().catch(() => undefined);
			await cal.waitForTimeout(300);
			const away = await rangeLabel();
			await cal
				.locator('.cal-toolbar__nav button[aria-label="Today"], .cal-toolbar__nav [title="Today"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(500);
			const back = await rangeLabel();
			return {
				verdict: away !== home && back === home ? "PASS" : "FAIL",
				detail: `home="${home}" away="${away}" today="${back}"`,
			};
		});
		await s.shot(cal, "02-after-nav");

		// ── 3. New event — create via the dialog, native datetime inputs ─────
		await judge("open New-event dialog", async () => {
			await cal
				.locator('.cal-toolbar__new, [aria-label="New event"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(700);
			return {
				verdict: (await dialogOpen()) ? "PASS" : "FAIL",
				detail: `dialog visible=${await dialogOpen()}`,
			};
		});
		await s.shot(cal, "03-new-event-dialog");

		await judge("fill event title", async () => {
			const title = cal.locator('.cal-detail__input--title, .cal-detail [aria-label="Title"]').first();
			await title.click().catch(() => undefined);
			await title.fill(UNIQUE_TITLE).catch(() => undefined);
			const v = await title.inputValue().catch(() => "");
			return { verdict: v === UNIQUE_TITLE ? "PASS" : "FAIL", detail: `value="${v}"` };
		});

		await judge("set start datetime (native input)", async () => {
			// Native datetime-local — fill via DOM value + dispatch input/change so React state commits.
			const inputs = cal.locator('.cal-detail__field input[type="datetime-local"]');
			const n = await inputs.count();
			if (n < 1) return { verdict: "FAIL", detail: `no datetime-local inputs (count=${n})` };
			const start = inputs.nth(0);
			const before = await start.inputValue().catch(() => "");
			// Move the minute up via keyboard arrows (works on native datetime-local segments).
			await start.click().catch(() => undefined);
			await start.fill("").catch(() => undefined);
			const target = nextHourLocal();
			const ok = await setNativeDateTime(cal, start, target);
			await cal.waitForTimeout(300);
			const after = await start.inputValue().catch(() => "");
			return {
				verdict: ok && after.length > 0 ? "PASS" : "?",
				detail: `before="${before}" after="${after}" target="${target}"`,
			};
		});

		await judge("toggle All-day on then off", async () => {
			const box = cal.locator(".cal-detail__checkbox").first();
			const start0 = await box.isChecked().catch(() => false);
			await box.click().catch(() => undefined);
			await cal.waitForTimeout(250);
			const on = await box.isChecked().catch(() => false);
			// When all-day, datetime inputs become date-only.
			const dateOnly = await cal
				.locator('.cal-detail__field input[type="date"]')
				.count()
				.catch(() => 0);
			await box.click().catch(() => undefined);
			await cal.waitForTimeout(250);
			const off = await box.isChecked().catch(() => false);
			return {
				verdict: on !== start0 && off === start0 ? "PASS" : "FAIL",
				detail: `start=${start0} on=${on} dateInputsWhenAllDay=${dateOnly} off=${off}`,
			};
		});

		await judge('expand "More options"', async () => {
			const summary = cal.locator(".cal-detail__more-summary").first();
			const present = await summary.count();
			if (!present) return { verdict: "FAIL", detail: "summary not found" };
			const wasOpen = await cal
				.locator("details.cal-detail__more")
				.first()
				.getAttribute("open")
				.catch(() => null);
			if (wasOpen === null) await summary.click().catch(() => undefined);
			await cal.waitForTimeout(300);
			const locationField = await cal
				.locator('.cal-detail__field input[type="text"]')
				.count()
				.catch(() => 0);
			const reminders = await cal
				.locator(".cal-detail__reminder")
				.count()
				.catch(() => 0);
			return {
				verdict: locationField > 0 ? "PASS" : "?",
				detail: `textInputsAfterExpand=${locationField} reminderPresets=${reminders}`,
			};
		});
		await s.shot(cal, "04-more-options-expanded");

		await judge("save new event → chip appears on grid", async () => {
			const before = await chipCount();
			await cal
				.locator('.cal-detail [data-bs-primary], .cal-detail button:has-text("Save")')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(1200);
			const stillOpen = await dialogOpen();
			const ourChip = await findOurChip()
				.count()
				.catch(() => 0);
			const after = await chipCount();
			return {
				verdict: !stillOpen && ourChip > 0 ? "PASS" : "FAIL",
				detail: `dialogClosed=${!stillOpen} chips ${before}→${after} ourChip=${ourChip}`,
			};
		});
		await s.shot(cal, "05-event-saved");

		// ── 4. Click the saved chip → detail/edit popover opens ──────────────
		await judge("click event chip → edit popover opens", async () => {
			// Jump to the chip's day; events default to today at the next hour, so Day view shows it.
			await cal
				.locator('.cal-toolbar__tab[data-view="day"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(500);
			const chip = findOurChip();
			if ((await chip.count()) === 0) {
				// fall back to month view where the chip is reliably present
				await cal
					.locator('.cal-toolbar__tab[data-view="month"]')
					.first()
					.click()
					.catch(() => undefined);
				await cal.waitForTimeout(500);
			}
			await findOurChip()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(700);
			const open = await dialogOpen();
			const editTitle = await cal
				.locator(".cal-detail__input--title")
				.first()
				.inputValue()
				.catch(() => "");
			return {
				verdict: open && editTitle.includes(UNIQUE_TITLE) ? "PASS" : "FAIL",
				detail: `dialogOpen=${open} title="${editTitle}"`,
			};
		});
		await s.shot(cal, "06-edit-popover");

		// ── 5. Rename + reschedule the event ─────────────────────────────────
		await judge("rename event and save", async () => {
			if (!(await dialogOpen())) return { verdict: "FAIL", detail: "edit dialog not open" };
			const title = cal.locator(".cal-detail__input--title").first();
			await title.fill(RENAMED_TITLE).catch(() => undefined);
			await cal
				.locator('.cal-detail [data-bs-primary], .cal-detail button:has-text("Save")')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(1000);
			const renamed = await cal
				.locator(`.cal-chip:has-text(${JSON.stringify(RENAMED_TITLE)})`)
				.count()
				.catch(() => 0);
			return { verdict: renamed > 0 ? "PASS" : "FAIL", detail: `renamed chips=${renamed}` };
		});

		await judge("reschedule via dialog start edit", async () => {
			const chip = cal.locator(`.cal-chip:has-text(${JSON.stringify(RENAMED_TITLE)})`).first();
			if ((await chip.count()) === 0) return { verdict: "FAIL", detail: "renamed chip not found" };
			await chip.click().catch(() => undefined);
			await cal.waitForTimeout(600);
			const start = cal.locator('.cal-detail__field input[type="datetime-local"]').first();
			const before = await start.inputValue().catch(() => "");
			const ok = await setNativeDateTime(cal, start, plusDaysLocal(before, 2));
			await cal.waitForTimeout(300);
			const after = await start.inputValue().catch(() => "");
			await cal
				.locator('.cal-detail [data-bs-primary], .cal-detail button:has-text("Save")')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(900);
			return {
				verdict: ok && after !== before ? "PASS" : "?",
				detail: `start "${before}" → "${after}"`,
			};
		});
		await s.shot(cal, "07-after-reschedule");

		// ── 6. CALENDARS sidebar — toggle each source on/off ─────────────────
		await cal
			.locator('.cal-toolbar__tab[data-view="month"]')
			.first()
			.click()
			.catch(() => undefined);
		await cal.waitForTimeout(500);
		// Ensure sidebar is visible.
		const sidebarVisible = await cal
			.locator(".cal-sidebar")
			.first()
			.isVisible()
			.catch(() => false);
		if (!sidebarVisible) {
			await cal
				.locator('[aria-label="Show sidebar"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(400);
		}
		for (const source of SOURCES) {
			await judge(`toggle "${source}" calendar source off`, async () => {
				const row = cal.locator(`.cal-sidebar__row--source[data-source="${source}"]`).first();
				if ((await row.count()) === 0) return { verdict: "FAIL", detail: "source row not found" };
				const before = await row.getAttribute("aria-pressed").catch(() => null);
				const chipsBefore = await cal
					.locator(`.cal-chip[data-source="${source}"]`)
					.count()
					.catch(() => 0);
				await row.click().catch(() => undefined);
				await cal.waitForTimeout(500);
				const after = await row.getAttribute("aria-pressed").catch(() => null);
				const chipsAfter = await cal
					.locator(`.cal-chip[data-source="${source}"]`)
					.count()
					.catch(() => 0);
				// The app refuses to hide the last visible source; treat unchanged-when-last as [?].
				const toggled = before !== after;
				return {
					verdict: toggled ? "PASS" : "?",
					detail: `aria-pressed ${before}→${after} chips[${source}] ${chipsBefore}→${chipsAfter}`,
				};
			});
			// Toggle back on so subsequent steps see all sources.
			await cal
				.locator(`.cal-sidebar__row--source[data-source="${source}"]`)
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(300);
		}
		await s.shot(cal, "08-sidebar-toggles");

		// ── 7. Empty day / hour slot → create flow at that time ──────────────
		await judge("click empty month day cell → opens create", async () => {
			// Click a day cell that has no chip; the SDK grid fires onEmptyCellClick.
			const cell = cal.locator(".bs-cal-month__cell").nth(20);
			if ((await cell.count()) === 0) return { verdict: "FAIL", detail: "no month cells" };
			await cell.click().catch(() => undefined);
			await cal.waitForTimeout(700);
			const open = await dialogOpen();
			const dv = await activeView();
			// Either opens the create dialog OR drills into Day view (both are "create at that time" affordances).
			return { verdict: open || dv === "day" ? "PASS" : "?", detail: `dialogOpen=${open} view=${dv}` };
		});
		if (await dialogOpen())
			await cal
				.locator('.cal-detail button:has-text("Cancel")')
				.first()
				.click()
				.catch(() => undefined);
		await cal.waitForTimeout(300);

		await judge("Day view per-hour slot click → create at that hour", async () => {
			await cal
				.locator('.cal-toolbar__tab[data-view="day"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(600);
			const slot = cal.locator('.cal-week__slot[data-hour="9"]').first();
			if ((await slot.count()) === 0) return { verdict: "FAIL", detail: "no hour slots in day view" };
			await slot.click({ force: true }).catch(() => undefined);
			await cal.waitForTimeout(700);
			const open = await dialogOpen();
			let startVal = "";
			if (open)
				startVal = await cal
					.locator('.cal-detail__field input[type="datetime-local"]')
					.first()
					.inputValue()
					.catch(() => "");
			return {
				verdict: open ? "PASS" : "FAIL",
				detail: `dialogOpen=${open} start="${startVal}" (expected ~09:00)`,
			};
		});
		await s.shot(cal, "09-hour-slot-create");
		if (await dialogOpen())
			await cal
				.locator('.cal-detail button:has-text("Cancel")')
				.first()
				.click()
				.catch(() => undefined);
		await cal.waitForTimeout(300);

		await judge("Week view per-hour slot click → create at that hour", async () => {
			await cal
				.locator('.cal-toolbar__tab[data-view="week"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(600);
			const slot = cal.locator('.cal-week__column .cal-week__slot[data-hour="14"]').first();
			if ((await slot.count()) === 0) return { verdict: "FAIL", detail: "no week hour slots" };
			await slot.click({ force: true }).catch(() => undefined);
			await cal.waitForTimeout(700);
			const open = await dialogOpen();
			return { verdict: open ? "PASS" : "FAIL", detail: `dialogOpen=${open}` };
		});
		if (await dialogOpen())
			await cal
				.locator('.cal-detail button:has-text("Cancel")')
				.first()
				.click()
				.catch(() => undefined);
		await cal.waitForTimeout(300);

		// ── 8. Search events ─────────────────────────────────────────────────
		await judge("open search overlay", async () => {
			await cal
				.locator('.cal-toolbar__search, [aria-label="Search events"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(600);
			const open = await cal
				.locator(".cal-search__input")
				.first()
				.isVisible()
				.catch(() => false);
			return { verdict: open ? "PASS" : "FAIL", detail: `searchInputVisible=${open}` };
		});
		await judge("search finds the renamed event", async () => {
			const input = cal.locator(".cal-search__input").first();
			if ((await input.count()) === 0) return { verdict: "FAIL", detail: "no search input" };
			await input.fill(UNIQUE_TITLE).catch(() => undefined);
			await cal.waitForTimeout(700);
			const rows = await cal
				.locator(".cal-search__row")
				.count()
				.catch(() => 0);
			const hit = await cal
				.locator(`.cal-search__row:has-text(${JSON.stringify(UNIQUE_TITLE)})`)
				.count()
				.catch(() => 0);
			return { verdict: hit > 0 ? "PASS" : "FAIL", detail: `rows=${rows} matching=${hit}` };
		});
		await s.shot(cal, "10-search");
		await judge("pick search result → jumps to event day", async () => {
			const row = cal.locator(".cal-search__row").first();
			if ((await row.count()) === 0) return { verdict: "?", detail: "no result to pick" };
			await row.click().catch(() => undefined);
			await cal.waitForTimeout(800);
			const closed = !(await cal
				.locator(".cal-search__input")
				.first()
				.isVisible()
				.catch(() => false));
			const dv = await activeView();
			return { verdict: closed ? "PASS" : "?", detail: `overlayClosed=${closed} view=${dv}` };
		});
		await closeAnyMenu();

		// ── 9. Header ⋯ "Calendar actions" menu ──────────────────────────────
		await judge("open header ⋯ Calendar actions menu", async () => {
			const more = cal.locator('.cal-actions__more, [aria-label="Calendar actions"]').first();
			if ((await more.count()) === 0)
				return { verdict: "FAIL", detail: "⋯ actions button not present" };
			await more.click().catch(() => undefined);
			await cal.waitForTimeout(500);
			const menuVisible = await cal
				.locator(".fm-menu, [role='menu']")
				.first()
				.isVisible()
				.catch(() => false);
			const importItem = await cal
				.locator('.fm-menu:has-text("Import"), [role="menuitem"]:has-text("Import")')
				.count()
				.catch(() => 0);
			const exportItem = await cal
				.locator('.fm-menu:has-text("Export"), [role="menuitem"]:has-text("Export")')
				.count()
				.catch(() => 0);
			return {
				verdict: menuVisible && (importItem > 0 || exportItem > 0) ? "PASS" : "FAIL",
				detail: `menuVisible=${menuVisible} import=${importItem} export=${exportItem}`,
			};
		});
		await s.shot(cal, "11-actions-menu");
		// Don't trigger Import (opens a native file dialog that blocks); just dismiss.
		await closeAnyMenu();

		// ── 10. LINK PRIORITY — a Task/Note on the calendar opens that object ─
		await judge("LINK: click a Task chip → opens the Task object", async () => {
			await cal
				.locator('.cal-toolbar__tab[data-view="agenda"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(700);
			const before = beforeWindowUrls(s);
			// Prefer a Task, fall back to a Note — both are non-owned linked objects.
			let chip = cal.locator('.cal-chip[data-source="task"]').first();
			let source = "task";
			if ((await chip.count()) === 0) {
				chip = cal.locator('.cal-chip[data-source="note"]').first();
				source = "note";
			}
			if ((await chip.count()) === 0) {
				// widen to month if agenda is empty
				await cal
					.locator('.cal-toolbar__tab[data-view="month"]')
					.first()
					.click()
					.catch(() => undefined);
				await cal.waitForTimeout(600);
				chip = cal.locator('.cal-chip[data-source="task"], .cal-chip[data-source="note"]').first();
				source = (await chip.getAttribute("data-source").catch(() => null)) ?? "?";
			}
			if ((await chip.count()) === 0)
				return { verdict: "?", detail: "no Task/Note chip present on the calendar to link from" };
			const entityId = await chip.getAttribute("data-entity-id").catch(() => null);
			await chip.click().catch(() => undefined);
			await cal.waitForTimeout(2000);
			const opened = await openedObjectWindow(s, before);
			return {
				verdict: opened ? "PASS" : "FAIL",
				detail: `source=${source} entityId=${entityId} openedNewWindow=${opened}`,
			};
		});
		await s.shot(cal, "12-link-open");

		// ── 11. Persistence — switch views away and back, event survives ─────
		await judge("persistence: switch views and back, event survives", async () => {
			await cal
				.locator('.cal-toolbar__tab[data-view="year"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(500);
			await cal
				.locator('.cal-toolbar__tab[data-view="month"]')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(700);
			const survived = await cal
				.locator(`.cal-chip:has-text(${JSON.stringify(UNIQUE_TITLE)})`)
				.count()
				.catch(() => 0);
			return { verdict: survived > 0 ? "PASS" : "FAIL", detail: `chips matching probe=${survived}` };
		});

		// ── 12. Cleanup — delete the test event, assert removal ──────────────
		await judge("delete the test event → removed from grid", async () => {
			const chip = cal.locator(`.cal-chip:has-text(${JSON.stringify(RENAMED_TITLE)})`).first();
			const fallback = cal.locator(`.cal-chip:has-text(${JSON.stringify(UNIQUE_TITLE)})`).first();
			const target = (await chip.count()) > 0 ? chip : fallback;
			if ((await target.count()) === 0)
				return { verdict: "?", detail: "test event chip already gone" };
			await target.click().catch(() => undefined);
			await cal.waitForTimeout(600);
			if (!(await dialogOpen()))
				return { verdict: "FAIL", detail: "edit dialog did not open for delete" };
			await cal
				.locator('.cal-detail .bs-btn--danger, .cal-detail button:has-text("Delete")')
				.first()
				.click()
				.catch(() => undefined);
			await cal.waitForTimeout(1000);
			const remaining = await cal
				.locator(`.cal-chip:has-text(${JSON.stringify(UNIQUE_TITLE)})`)
				.count()
				.catch(() => 0);
			return {
				verdict: remaining === 0 ? "PASS" : "FAIL",
				detail: `remaining probe chips=${remaining}`,
			};
		});
		await s.shot(cal, "13-after-delete");
		s.note(`Final view: ${await activeView()} · chips ${await chipCount()}`);
	} finally {
		await s.finish();
	}
});

/** ISO-ish local `YYYY-MM-DDTHH:00` for the next full hour. */
function nextHourLocal(): string {
	const d = new Date();
	d.setMinutes(0, 0, 0);
	d.setHours(d.getHours() + 1);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/** Add `days` to a `YYYY-MM-DDTHH:MM` local string (best-effort). */
function plusDaysLocal(value: string, days: number): string {
	const base = value && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? new Date(value) : new Date();
	base.setDate(base.getDate() + days);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}T${p(base.getHours())}:${p(base.getMinutes())}`;
}

/**
 * Set a native `datetime-local` input's value and dispatch input+change so the
 * React onChange handler commits. `fill` alone can leave segment state stale on
 * some platforms, so we set `.value` directly and fire the events.
 */
async function setNativeDateTime(
	page: Page,
	locator: import("@playwright/test").Locator,
	value: string,
): Promise<boolean> {
	try {
		await locator.fill(value);
		const got = await locator.inputValue().catch(() => "");
		if (got === value) return true;
	} catch {
		// fall through to manual DOM set
	}
	return locator
		.evaluate((el, v) => {
			const input = el as HTMLInputElement;
			input.value = v;
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
			return input.value === v;
		}, value)
		.catch(() => false);
}

/** Snapshot the set of app-renderer window URLs before a link click. */
function beforeWindowUrls(s: FounderSession): Set<string> {
	return new Set(s.app.windows().map((p) => p.url()));
}

/**
 * A linked-object click should open a NEW app window (Tasks / Notes / etc.).
 * Compare the live window set against the pre-click snapshot for any URL that
 * is a real app renderer (not the dashboard or tab-strip chrome).
 */
async function openedObjectWindow(s: FounderSession, before: Set<string>): Promise<boolean> {
	for (let i = 0; i < 10; i++) {
		const opened = s.app.windows().some((p) => {
			const url = p.url();
			if (before.has(url)) return false;
			if (url.includes("/chrome/tab-strip")) return false;
			if (url.includes("/renderer/index.html")) return false;
			return url.includes("io.brainstorm.");
		});
		if (opened) return true;
		await new Promise((r) => setTimeout(r, 300));
	}
	return false;
}
