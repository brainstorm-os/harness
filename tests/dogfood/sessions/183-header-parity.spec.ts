/**
 * Session 183 — header parity probe across Tasks (reference) / Contacts / Agent.
 *
 * The new React apps (Contacts, Agent) were missing the `body { margin: 0 }`
 * reset, so the browser-default 8px body margin inset the whole app and the
 * header read the wrong height/position; Agent additionally re-declared
 * `.app-header` height + padding, clobbering the shell's macOS inset padding.
 * This probe measures the body margin + the header's height and top edge in all
 * three and asserts the new apps now match the established one.
 */

import { expect, test } from "@playwright/test";
import { APP, type AppId, SPEAKER, startSession } from "../lib/founder";

async function measure(open: (id: AppId) => Promise<import("@playwright/test").Page>, id: AppId) {
	const p = await open(id);
	await p.waitForLoadState("domcontentloaded");
	await p.waitForTimeout(1200);
	return p.evaluate(() => {
		const h = document.querySelector(".app-header");
		const r = h?.getBoundingClientRect();
		return {
			bodyMarginTop: getComputedStyle(document.body).marginTop,
			bodyMarginLeft: getComputedStyle(document.body).marginLeft,
			headerH: r ? Math.round(r.height) : null,
			headerTop: r ? Math.round(r.top) : null,
		};
	});
}

test("Header parity: Contacts + Agent match Tasks (183)", async () => {
	test.setTimeout(300_000);
	const s = await startSession("183-header-parity");
	try {
		const tasks = await measure(s.openApp, APP.Tasks);
		const contacts = await measure(s.openApp, APP.Contacts);
		const agent = await measure(s.openApp, APP.Agent);
		s.note(`tasks    header: ${JSON.stringify(tasks)}`);
		s.note(`contacts header: ${JSON.stringify(contacts)}`);
		s.note(`agent    header: ${JSON.stringify(agent)}`);

		const parity =
			contacts.bodyMarginTop === "0px" &&
			agent.bodyMarginTop === "0px" &&
			contacts.headerH === tasks.headerH &&
			agent.headerH === tasks.headerH &&
			contacts.headerTop === tasks.headerTop &&
			agent.headerTop === tasks.headerTop;

		s.chat(
			SPEAKER.Marcus,
			parity
				? `Headers match now: body margin 0 everywhere, header ${tasks.headerH}px flush to the top in Tasks, Contacts and Agent. No more 8px inset.`
				: `Still off — tasks=${tasks.headerH}px@${tasks.headerTop} contacts=${contacts.headerH}px@${contacts.headerTop} (margin ${contacts.bodyMarginTop}) agent=${agent.headerH}px@${agent.headerTop} (margin ${agent.bodyMarginTop}).`,
		);

		expect(contacts.bodyMarginTop, "contacts body margin reset").toBe("0px");
		expect(agent.bodyMarginTop, "agent body margin reset").toBe("0px");
		expect(contacts.headerH, "contacts header height matches Tasks").toBe(tasks.headerH);
		expect(agent.headerH, "agent header height matches Tasks").toBe(tasks.headerH);
		expect(contacts.headerTop, "contacts header flush like Tasks").toBe(tasks.headerTop);
		expect(agent.headerTop, "agent header flush like Tasks").toBe(tasks.headerTop);
		s.note("Header parity verified across Tasks / Contacts / Agent.");
	} finally {
		await s.finish();
	}
});
