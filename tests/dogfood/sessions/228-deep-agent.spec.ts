/**
 * Session 228 — deep Agent walkthrough. Exercises the real Agent app surface:
 * starting a New chat, sending a message (asserting the user bubble appears
 * immediately), waiting for a model reply (the Agent talks to a local Ollama
 * model, so a reply MAY or may not come back — a pending/no-response state is
 * itself a finding, not a hard failure), switching between conversations,
 * the model-provenance label ("via llama3.2"), the conversations panel
 * hide/show, the header ⋯ "More actions" menu, a second message appended to
 * the same thread (verifying no message is dropped), any entity-link/insert
 * affordance in a reply, and PERSISTENCE across reopen.
 *
 * Every action is judged from observable DOM (conversation count, message
 * bubble count, response arrival within a timeout, model label, menu open)
 * and recorded as [PASS]/[FAIL]/[?] via s.note(). Each step is wrapped in
 * try/catch so one miss never aborts the rest; states + failures are shot.
 *
 * Real selectors (apps/agent/src/app.tsx):
 *   header                : [data-testid="app-header"]
 *   New chat button       : [aria-label="New chat"]  (header.newChat)
 *   conversation buttons  : .agent__conv  (active = .agent__conv--active)
 *   sidebar empty note    : .agent__sidebar-empty
 *   transcript            : [data-testid="agent-transcript"]
 *   message bubbles       : .agent__msg  (user=.agent__msg--user, asst=.agent__msg--assistant)
 *   thinking placeholder  : [data-testid="agent-thinking"]
 *   model provenance      : .agent__msg-model  ("· via llama3.2")
 *   input                 : [data-testid="agent-input"]
 *   send                  : [data-testid="agent-send"]
 *   error row             : [data-testid="agent-error"]
 *   ⋯ More actions        : .bs-object-menu__more  (header right group)
 *   shared menu (open)    : .fm-menu / [role="menu"]; items [role="menuitem"]
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

const SETTLE_MS = 2600;
const STEP_MS = 700;
const REPLY_TIMEOUT_MS = 30_000;

// Distinct prompts so user bubbles are individually identifiable in the DOM.
const FIRST_PROMPT = "List three benefits of keeping notes in a knowledge base.";
const SECOND_PROMPT = "Now summarize that in one short sentence.";
const THIRD_PROMPT = "What is 7 multiplied by 6?";

const userBubbles = (p: Page) => p.locator(".agent__msg--user");
const assistantBubbles = (p: Page) => p.locator(".agent__msg--assistant");
const allBubbles = (p: Page) => p.locator(".agent__msg");
const conversations = (p: Page) => p.locator(".agent__conv");

/** Count assistant bubbles that are NOT the transient "Thinking…" placeholder
 *  — a real reply has rendered body text and no thinking testid. */
async function realAssistantReplies(p: Page): Promise<number> {
	return p
		.locator(".agent__msg--assistant:not([data-testid='agent-thinking'])")
		.count()
		.catch(() => 0);
}

/** Poll for a real assistant reply to land within `timeoutMs`; returns the
 *  reply count delta observed (0 = none arrived). Never throws. */
async function waitForReply(p: Page, baseline: number, timeoutMs: number): Promise<number> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const now = await realAssistantReplies(p);
		if (now > baseline) return now - baseline;
		await p.waitForTimeout(1000);
	}
	return 0;
}

test("deep agent walkthrough (228)", async () => {
	test.setTimeout(600_000);
	const s = await startSession("228-deep-agent");
	let agent: Page | null = null;
	try {
		// ── Open the Agent app ────────────────────────────────────────────────
		try {
			agent = await s.openApp(APP.Agent);
			await agent.waitForTimeout(SETTLE_MS);
			const hasHeader = await agent
				.locator('[data-testid="app-header"]')
				.isVisible()
				.catch(() => false);
			const hasInput = await agent
				.locator('[data-testid="agent-input"]')
				.isVisible()
				.catch(() => false);
			s.note(
				`${hasHeader && hasInput ? "[PASS]" : "[FAIL]"} open Agent — header=${hasHeader} input=${hasInput}`,
			);
			await s.shot(agent, "01-agent-open");
		} catch (e) {
			s.note(`[FAIL] open Agent — ${(e as Error).message}`);
		}
		if (!agent) {
			s.note("[FAIL] Agent page never opened — aborting remaining steps");
			return;
		}
		const page = agent;

		// Baseline conversation count (Northbound vault may already hold some).
		let baseConvCount = 0;
		try {
			baseConvCount = await conversations(page).count();
			s.note(`[?] baseline conversations in vault — ${baseConvCount}`);
		} catch (e) {
			s.note(`[?] baseline conversation count — ${(e as Error).message}`);
		}

		// ── New chat → empty conversation selected ────────────────────────────
		try {
			await page.locator('[aria-label="New chat"]').first().click({ timeout: 5000 });
			await page.waitForTimeout(STEP_MS);
			// A new chat clears the active selection (activeId=null) → transcript
			// shows the empty state, no bubbles, input is empty.
			const bubbles = await allBubbles(page).count();
			const emptyVisible = await page
				.locator(".bs-empty-state")
				.isVisible()
				.catch(() => false);
			const inputVal = await page
				.locator('[data-testid="agent-input"]')
				.inputValue()
				.catch(() => "?");
			const ok = bubbles === 0 && emptyVisible && inputVal === "";
			s.note(
				`${ok ? "[PASS]" : "[FAIL]"} New chat creates empty conversation — bubbles=${bubbles} empty=${emptyVisible} input="${inputVal}"`,
			);
			await s.shot(page, "02-new-chat-empty");
		} catch (e) {
			s.note(`[FAIL] New chat — ${(e as Error).message}`);
		}

		// ── Send first message → user bubble appears immediately ──────────────
		try {
			await page.locator('[data-testid="agent-input"]').click();
			await page.locator('[data-testid="agent-input"]').fill(FIRST_PROMPT);
			await page.waitForTimeout(200);
			const sendEnabled = await page
				.locator('[data-testid="agent-send"]')
				.isEnabled()
				.catch(() => false);
			s.note(
				`${sendEnabled ? "[PASS]" : "[FAIL]"} Send enabled after typing — enabled=${sendEnabled}`,
			);
			await page.locator('[data-testid="agent-send"]').click({ timeout: 5000 });
			// The user echo is optimistic — it should render essentially instantly,
			// not gated on persistence or the model reply.
			await page.waitForTimeout(600);
			const userCount = await userBubbles(page).count();
			const userTextShown = await page
				.locator(".agent__msg--user")
				.last()
				.innerText()
				.catch(() => "");
			const ok = userCount >= 1 && userTextShown.includes("benefits");
			s.note(
				`${ok ? "[PASS]" : "[FAIL]"} user bubble appears immediately — userBubbles=${userCount} text~="${userTextShown.slice(0, 40)}"`,
			);
			await s.shot(page, "03-first-message-sent");
		} catch (e) {
			s.note(`[FAIL] send first message — ${(e as Error).message}`);
		}

		// ── Wait up to ~30s for an Agent response (Ollama may be down) ─────────
		let firstReplyArrived = false;
		try {
			const thinkingShown = await page
				.locator('[data-testid="agent-thinking"]')
				.isVisible()
				.catch(() => false);
			s.note(`[?] thinking placeholder shown while generating — ${thinkingShown}`);
			const before = await realAssistantReplies(page);
			const delta = await waitForReply(page, before, REPLY_TIMEOUT_MS);
			firstReplyArrived = delta > 0;
			if (firstReplyArrived) {
				const replyText = await assistantBubbles(page)
					.last()
					.innerText()
					.catch(() => "");
				s.note(
					`[PASS] Agent response arrived within ${REPLY_TIMEOUT_MS / 1000}s — replies+${delta}, text~="${replyText.slice(0, 60)}"`,
				);
			} else {
				// Surface whether it's an explicit error (Ollama down → Unavailable)
				// or a silent no-reply (the open-screenshot drop bug).
				const errVisible = await page
					.locator('[data-testid="agent-error"]')
					.isVisible()
					.catch(() => false);
				const errText = errVisible
					? await page
							.locator('[data-testid="agent-error"]')
							.innerText()
							.catch(() => "")
					: "";
				s.note(
					`[FAIL]/[?] no response within ${REPLY_TIMEOUT_MS / 1000}s — possible no-reply bug or Ollama not running. error-row=${errVisible} "${errText.slice(0, 80)}"`,
				);
			}
			await s.shot(page, "04-after-first-reply-wait");
		} catch (e) {
			s.note(`[FAIL] wait for first reply — ${(e as Error).message}`);
		}

		// ── Model provenance label ("via llama3.2") ───────────────────────────
		try {
			const modelLabel = await page
				.locator(".agent__msg-model")
				.first()
				.innerText()
				.catch(() => "");
			if (modelLabel) {
				s.note(`[PASS] model provenance label rendered — "${modelLabel.trim()}"`);
			} else {
				s.note(
					`[?] no model provenance label — expected "· via llama3.2" (none, consistent with no assistant reply yet)`,
				);
			}
		} catch (e) {
			s.note(`[?] model provenance — ${(e as Error).message}`);
		}

		// ── Second message in the SAME thread → appends, nothing dropped ──────
		try {
			const userBefore = await userBubbles(page).count();
			const replyBefore = await realAssistantReplies(page);
			await page.locator('[data-testid="agent-input"]').fill(SECOND_PROMPT);
			await page.locator('[data-testid="agent-send"]').click({ timeout: 5000 });
			await page.waitForTimeout(600);
			const userAfter = await userBubbles(page).count();
			const appended = userAfter === userBefore + 1;
			s.note(
				`${appended ? "[PASS]" : "[FAIL]"} second message appends to thread — userBubbles ${userBefore}→${userAfter}`,
			);
			const delta2 = await waitForReply(page, replyBefore, REPLY_TIMEOUT_MS);
			if (delta2 > 0) {
				s.note(`[PASS] second Agent response arrived — replies+${delta2}`);
			} else {
				s.note(
					`[FAIL]/[?] no second response within ${REPLY_TIMEOUT_MS / 1000}s — possible no-reply bug or Ollama not running`,
				);
			}
			// No-drop check: every user turn must still be present in the DOM.
			const finalUsers = await userBubbles(page).count();
			s.note(
				`${finalUsers >= 2 ? "[PASS]" : "[FAIL]"} no user message dropped — ${finalUsers} user bubbles still in transcript`,
			);
			await s.shot(page, "05-second-message");
		} catch (e) {
			s.note(`[FAIL] second message — ${(e as Error).message}`);
		}

		// ── Conversation list: duplicate auto-titles + selecting loads thread ─
		try {
			const convCount = await conversations(page).count();
			const titles = await conversations(page)
				.allInnerTexts()
				.catch(() => []);
			const trimmed = titles.map((tt) => tt.trim());
			const dupes = trimmed.filter((tt, i) => trimmed.indexOf(tt) !== i);
			s.note(
				`[?] conversation list — ${convCount} conversations, titles=${JSON.stringify(trimmed.slice(0, 8))}`,
			);
			s.note(
				`${dupes.length > 0 ? "[?]" : "[PASS]"} duplicate identically-named conversations — ${dupes.length} dupes${
					dupes.length > 0 ? ` (auto-title gap: ${JSON.stringify([...new Set(dupes)])})` : ""
				}`,
			);
			s.note(
				`${convCount > baseConvCount ? "[PASS]" : "[FAIL]"} New chat added a conversation — ${baseConvCount}→${convCount}`,
			);
			await s.shot(page, "06-conversation-list");
		} catch (e) {
			s.note(`[?] conversation list inventory — ${(e as Error).message}`);
		}

		// ── Switch between conversations → thread content swaps ───────────────
		try {
			const convCount = await conversations(page).count();
			if (convCount >= 2) {
				// Snapshot the current (active) thread, switch to another, assert the
				// transcript content changed, then switch back and assert it restores.
				const firstThread = await page
					.locator('[data-testid="agent-transcript"]')
					.innerText()
					.catch(() => "");
				// Click a conversation that is NOT the active one.
				const activeIdx = await conversations(page)
					.evaluateAll((els) => els.findIndex((el) => el.classList.contains("agent__conv--active")))
					.catch(() => 0);
				const otherIdx = activeIdx === 0 ? 1 : 0;
				await conversations(page).nth(otherIdx).click({ timeout: 5000 });
				await page.waitForTimeout(1000);
				const secondThread = await page
					.locator('[data-testid="agent-transcript"]')
					.innerText()
					.catch(() => "");
				const swapped = secondThread !== firstThread;
				s.note(
					`${swapped ? "[PASS]" : "[FAIL]"} switching conversation swaps thread content — changed=${swapped}`,
				);
				const otherActive = await conversations(page)
					.nth(otherIdx)
					.evaluate((el) => el.classList.contains("agent__conv--active"))
					.catch(() => false);
				s.note(
					`${otherActive ? "[PASS]" : "[FAIL]"} selected conversation becomes active — active=${otherActive}`,
				);
				await s.shot(page, "07-conversation-switch");
				// Switch back to the original.
				await conversations(page).nth(activeIdx).click({ timeout: 5000 });
				await page.waitForTimeout(800);
				const restored = await page
					.locator('[data-testid="agent-transcript"]')
					.innerText()
					.catch(() => "");
				s.note(
					`${restored === firstThread ? "[PASS]" : "[?]"} switching back restores original thread — match=${restored === firstThread}`,
				);
			} else {
				s.note(`[?] conversation switch skipped — only ${convCount} conversation(s)`);
			}
		} catch (e) {
			s.note(`[?] conversation switch — ${(e as Error).message}`);
		}

		// ── Conversations panel hide / show ───────────────────────────────────
		try {
			const toggle = page.locator('[data-testid="app-header"] button[aria-controls="agent-sidebar"]');
			const bodyOpenBefore = await page
				.locator(".agent__body")
				.getAttribute("data-sidebar-open")
				.catch(() => null);
			await toggle.first().click({ timeout: 5000 });
			await page.waitForTimeout(500);
			const bodyOpenAfter = await page
				.locator(".agent__body")
				.getAttribute("data-sidebar-open")
				.catch(() => null);
			const toggled = bodyOpenBefore !== bodyOpenAfter;
			s.note(
				`${toggled ? "[PASS]" : "[FAIL]"} conversations panel hide/show toggles — sidebar-open ${bodyOpenBefore}→${bodyOpenAfter}`,
			);
			await s.shot(page, "08-sidebar-toggled");
			// Restore the panel so later steps still see the conversation list.
			await toggle
				.first()
				.click({ timeout: 5000 })
				.catch(() => undefined);
			await page.waitForTimeout(400);
		} catch (e) {
			s.note(`[?] sidebar toggle — ${(e as Error).message}`);
		}

		// ── Header ⋯ "More actions" menu → open + inspect items ───────────────
		try {
			// The ⋯ lives in the header right group; with an active conversation it
			// is enabled and opens the shared object menu (Open / Pin / Remove…).
			const more = page.locator('[data-testid="app-header"] .bs-object-menu__more');
			const moreDisabled = await more
				.first()
				.isDisabled()
				.catch(() => true);
			s.note(`[?] header ⋯ disabled state (no object ⇒ disabled) — disabled=${moreDisabled}`);
			await more.first().click({ timeout: 5000 });
			await page.waitForTimeout(600);
			const menuVisible = await page
				.locator(".fm-menu, [role='menu']")
				.first()
				.isVisible()
				.catch(() => false);
			const items = await page
				.locator("[role='menuitem'], .fm-menu button")
				.allInnerTexts()
				.catch(() => []);
			s.note(
				`${menuVisible ? "[PASS]" : "[FAIL]"} header ⋯ More actions menu opens — visible=${menuVisible}, items=${JSON.stringify(
					items.map((i) => i.trim()).filter(Boolean),
				)}`,
			);
			await s.shot(page, "09-more-actions-menu");
			// Click "Open" if present (a safe, non-destructive item) — assert the
			// menu closes. Avoid "Remove" so we don't delete the active thread here.
			const openItem = page
				.locator("[role='menuitem'], .fm-menu button")
				.filter({ hasText: /^Open$/ });
			if ((await openItem.count().catch(() => 0)) > 0) {
				await openItem
					.first()
					.click({ timeout: 3000 })
					.catch(() => undefined);
				await page.waitForTimeout(600);
				const stillOpen = await page
					.locator(".fm-menu, [role='menu']")
					.first()
					.isVisible()
					.catch(() => false);
				s.note(
					`${!stillOpen ? "[PASS]" : "[?]"} clicking a menu item closes the menu — closed=${!stillOpen}`,
				);
			} else {
				await page.keyboard.press("Escape").catch(() => undefined);
				s.note("[?] no 'Open' item in menu — closed via Escape");
			}
			await page.waitForTimeout(400);
		} catch (e) {
			s.note(`[?] header ⋯ menu — ${(e as Error).message}`);
		}

		// ── LINKS (PRIORITY): does any reply cite/link a vault entity, or can
		//    the reply be inserted into a note? Exercise + assert navigation /
		//    insertion if the affordance exists; record its ABSENCE as a finding.
		try {
			// Probe for any in-transcript link affordance: anchors, link chips, or
			// an "insert into note" / "add to note" action button on a reply.
			const linkLike = page.locator(
				'[data-testid="agent-transcript"] a, [data-testid="agent-transcript"] [data-entity-id], ' +
					'[data-testid="agent-transcript"] .bs-link, [data-testid="agent-transcript"] [data-bs-entity-ref]',
			);
			const linkCount = await linkLike.count().catch(() => 0);
			const insertAction = page
				.locator(
					'[data-testid="agent-transcript"] button, [data-testid="agent-transcript"] [role="button"]',
				)
				.filter({ hasText: /insert|add to note|save to|cite|open in/i });
			const insertCount = await insertAction.count().catch(() => 0);
			if (linkCount > 0) {
				const before = page.url();
				await linkLike
					.first()
					.click({ timeout: 3000 })
					.catch(() => undefined);
				await page.waitForTimeout(800);
				// Navigation may open a new app page or change the in-app view.
				const navigated = page.url() !== before;
				s.note(
					`[PASS] reply contains an entity link — links=${linkCount}, click navigated=${navigated}`,
				);
				await s.shot(page, "10-reply-link-clicked");
			} else if (insertCount > 0) {
				await insertAction
					.first()
					.click({ timeout: 3000 })
					.catch(() => undefined);
				await page.waitForTimeout(800);
				s.note(`[PASS] reply offers insert-into-note action — actions=${insertCount}, invoked`);
				await s.shot(page, "10-reply-insert-action");
			} else {
				s.note(
					`[?] no entity-link or insert-into-note affordance in any reply — Agent replies are plain text only (links/insert not yet wired). links=${linkCount} insertActions=${insertCount}`,
				);
			}
		} catch (e) {
			s.note(`[?] reply links/insert probe — ${(e as Error).message}`);
		}

		// ── Third message in a fresh chat → no message dropped across threads ─
		try {
			await page.locator('[aria-label="New chat"]').first().click({ timeout: 5000 });
			await page.waitForTimeout(STEP_MS);
			await page.locator('[data-testid="agent-input"]').fill(THIRD_PROMPT);
			await page.locator('[data-testid="agent-send"]').click({ timeout: 5000 });
			await page.waitForTimeout(600);
			const userInNew = await userBubbles(page).count();
			s.note(
				`${userInNew >= 1 ? "[PASS]" : "[FAIL]"} fresh-chat message renders its own user bubble — ${userInNew}`,
			);
			const replyBefore = await realAssistantReplies(page);
			const delta3 = await waitForReply(page, replyBefore, REPLY_TIMEOUT_MS);
			s.note(
				`${delta3 > 0 ? "[PASS]" : "[FAIL]/[?]"} fresh-chat Agent response — ${delta3 > 0 ? `arrived (+${delta3})` : "no reply (no-reply bug or Ollama not running)"}`,
			);
			await s.shot(page, "11-fresh-chat-message");
		} catch (e) {
			s.note(`[FAIL] fresh-chat message — ${(e as Error).message}`);
		}

		// ── Persistence: snapshot conversation count, reopen, assert survival ─
		let convsBeforeReopen = 0;
		try {
			convsBeforeReopen = await conversations(page).count();
			s.note(`[?] conversations before reopen — ${convsBeforeReopen}`);
		} catch (e) {
			s.note(`[?] count before reopen — ${(e as Error).message}`);
		}
		try {
			// Re-launch the Agent app window (same vault) and re-read the list.
			const reopened = await s.openApp(APP.Agent);
			await reopened.waitForTimeout(SETTLE_MS);
			const convsAfter = await conversations(reopened).count();
			const survived = convsAfter >= convsBeforeReopen && convsAfter > 0;
			s.note(
				`${survived ? "[PASS]" : "[FAIL]"} conversations survive reopen — before=${convsBeforeReopen} after=${convsAfter}`,
			);
			// Open the most recent conversation and confirm its thread loads (the
			// persisted user turns are re-read from the vault, not just echoes).
			if (convsAfter > 0) {
				await conversations(reopened)
					.first()
					.click({ timeout: 5000 })
					.catch(() => undefined);
				await reopened.waitForTimeout(1000);
				const bubblesAfter = await allBubbles(reopened).count();
				s.note(
					`${bubblesAfter > 0 ? "[PASS]" : "[FAIL]"} reopened thread loads persisted messages — bubbles=${bubblesAfter}`,
				);
			}
			await s.shot(reopened, "12-after-reopen");
		} catch (e) {
			s.note(`[FAIL] reopen persistence — ${(e as Error).message}`);
		}
	} finally {
		await s.finish();
	}
});
