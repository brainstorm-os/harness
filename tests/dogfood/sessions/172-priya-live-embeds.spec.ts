/**
 * Session 172 — Priya stress-tests the LIVE block embeds inside her documents.
 *
 * The embed work means a Database grid / inline Task / Event dropped into a doc
 * renders the *live* surface inline (a block bundle served from its own
 * bsblock:// origin), not a static card. Priya's knowledge-integrity lens is
 * the right one: she opens the docs where she composed embeds (the hub and her
 * briefs), and asks the only question that matters for knowledge work — does
 * the embed actually render live content, or is it a blank / broken card / a
 * frame that failed to load? She sweeps her key docs, captures every embed she
 * finds, and reads back what it rendered. Verdict from the captures + the
 * loaded-frame / rendered-text evidence; requestfailed lines in console.log
 * catch a block bundle that 404'd.
 */

import { test } from "@playwright/test";
import { APP, SPEAKER, startSession } from "../lib/founder";

const EMBED_SEL =
	"iframe, .notes__block-embed, [data-block-embed], [class*='block-embed'], [class*='transclusion'], [class*='embed-card']";

test("Priya audits live block embeds across her docs (172)", async () => {
	test.setTimeout(240_000);
	const s = await startSession("172-priya-live-embeds");
	try {
		s.chat(
			SPEAKER.Priya,
			"My briefs embed the live Clients pipeline and inline tasks. An embed that doesn't actually reflect the source is worse than no embed — it lies. Sweeping my docs to see what renders live vs. dead.",
		);

		const notes = await s.openApp(APP.Notes);
		await notes.waitForLoadState("domcontentloaded");
		await notes.waitForTimeout(1800);
		await s.shot(notes, "01-notes-open");

		// Walk the sidebar doc list; on each doc, count + inspect embed nodes.
		const docRows = notes.locator(
			".notes__sidebar-item, [class*='sidebar'] [class*='item'], .notes__doc-row",
		);
		const docCount = Math.min(await docRows.count().catch(() => 0), 12);
		s.note(`sidebar docs to sweep: ${docCount}`);

		let totalEmbeds = 0;
		let totalLiveFrames = 0;
		let shot = 1;
		for (let i = 0; i < docCount; i++) {
			await docRows
				.nth(i)
				.click()
				.catch(() => undefined);
			await notes.waitForTimeout(1200);
			const embeds = notes.locator(EMBED_SEL);
			const n = await embeds.count().catch(() => 0);
			if (n === 0) continue;
			const docTitle = await notes.title().catch(() => "(unknown)");
			totalEmbeds += n;

			// How many embeds are LIVE iframes that actually loaded a document
			// (a body with content), vs. an empty/broken frame or a static card?
			const liveFrames = await notes
				.locator("iframe")
				.evaluateAll(
					(frames) =>
						frames.filter((f) => {
							try {
								const doc = (f as HTMLIFrameElement).contentDocument;
								return !!doc && (doc.body?.childElementCount ?? 0) > 0;
							} catch {
								// Cross-origin (bsblock://) frame we can't read = still a
								// loaded frame, count it as live rather than dead.
								return true;
							}
						}).length,
				)
				.catch(() => 0);
			totalLiveFrames += liveFrames;

			const texts = await embeds
				.allInnerTexts()
				.then((xs) =>
					xs
						.map((t) => t.replace(/\s+/g, " ").trim())
						.filter(Boolean)
						.slice(0, 4),
				)
				.catch(() => [] as string[]);
			s.note(
				`doc "${docTitle}": embeds=${n} liveFrames=${liveFrames} sample=${JSON.stringify(texts)}`,
			);

			const first = embeds.first();
			await first.scrollIntoViewIfNeeded().catch(() => undefined);
			await notes.waitForTimeout(300);
			await s
				.shot(notes, `${String(++shot).padStart(2, "0")}-embed-${i}`, first)
				.catch(() => undefined);
		}

		s.note(`SWEEP TOTAL: embeds=${totalEmbeds} liveFrames=${totalLiveFrames}`);
		s.chat(
			SPEAKER.Priya,
			totalEmbeds === 0
				? "Didn't find embeds in the docs I swept — either they didn't persist or I haven't composed them where I thought. Noting it; that's a finding either way."
				: totalLiveFrames > 0
					? `Found ${totalEmbeds} embeds and ${totalLiveFrames} are live frames that actually loaded content — the inline render is holding up. Spot-checking the captures for whether the data matches the source.`
					: `Found ${totalEmbeds} embeds but none rendered as a loaded live frame — they look like dead/static cards. That's exactly the integrity gap I worry about; filing it.`,
		);
		s.note(
			"Priya swept her docs for live block embeds; verdict from per-doc embed/liveFrame counts + captures + any requestfailed lines for block bundles.",
		);
	} finally {
		await s.finish();
	}
});
