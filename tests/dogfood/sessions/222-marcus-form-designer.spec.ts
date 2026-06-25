/**
 * Session 222 — Marcus dogfoods the new Form Designer v1: open it, build a
 * form (add a property field), and switch to Fill mode. Captures each step.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

test("Marcus dogfoods Form Designer v1 (222)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("222-marcus-form-designer");
	try {
		s.chat(SPEAKER.Marcus, "First look at the new Form Designer — building a form and filling it.");
		const fd = await s.openApp(APP.FormDesigner);
		await fd.waitForTimeout(2800);
		s.note(
			`builder present: ${await fd
				.locator(".fd-builder")
				.count()
				.catch(() => 0)}`,
		);
		s.note(
			`mode tabs: ${await fd
				.locator(".fd-mode__tab")
				.count()
				.catch(() => 0)}`,
		);
		s.note(
			`name input: ${await fd
				.locator(".fd-input")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(fd, "form-designer-open");

		// Name the form.
		await fd
			.locator(".fd-input")
			.first()
			.fill("Contact intake")
			.catch((e) => s.note(`name fill: ${(e as Error).message.slice(0, 50)}`));
		await fd.waitForTimeout(300);

		// Add a field — opens the property picker (fancy menu).
		await fd
			.locator(".fd-fields__header button")
			.first()
			.click()
			.catch((e) => s.note(`add-field: ${(e as Error).message.slice(0, 50)}`));
		await fd.waitForTimeout(600);
		s.note(
			`property picker rows: ${await fd
				.locator(".fm-row")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(fd, "form-designer-property-picker");
		await fd
			.locator(".fm-row")
			.first()
			.click()
			.catch((e) => s.note(`pick prop: ${(e as Error).message.slice(0, 50)}`));
		await fd.waitForTimeout(600);
		s.note(
			`field cards after add: ${await fd
				.locator(".fd-field-card")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(fd, "form-designer-field-added");

		// Switch to Fill mode.
		await fd
			.locator(".fd-mode__tab")
			.nth(1)
			.click()
			.catch((e) => s.note(`fill tab: ${(e as Error).message.slice(0, 50)}`));
		await fd.waitForTimeout(700);
		s.note(
			`fill pane present: ${await fd
				.locator(".fd-fill, .fd-main")
				.count()
				.catch(() => 0)}`,
		);
		await s.shot(fd, "form-designer-fill");

		s.chat(SPEAKER.Marcus, "Captures in — builder + property picker + fill mode all exercised.");
	} finally {
		await s.finish();
	}
});
