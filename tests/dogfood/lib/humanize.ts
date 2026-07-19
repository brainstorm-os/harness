/**
 * Human-pacing helpers for the promo capture rig. Playwright's mouse jumps
 * and types instantly — recorded footage of that reads robotic. These wrap
 * the same primitives with eased multi-step movement, jittered typing, and
 * smooth scrolling so the clips read like a person driving.
 */

import type { Page } from "@playwright/test";

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

const cursor: { x: number; y: number } = { x: 200, y: 200 };

/** Glide the cursor to (x, y) over `durationMs` with cubic easing. */
export async function glideTo(
	page: Page,
	x: number,
	y: number,
	durationMs = 600,
): Promise<void> {
	const steps = Math.max(8, Math.round(durationMs / 16));
	const from = { ...cursor };
	for (let i = 1; i <= steps; i++) {
		const t = easeInOutCubic(i / steps);
		await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
		await page.waitForTimeout(durationMs / steps);
	}
	cursor.x = x;
	cursor.y = y;
}

/** Glide to the centre of a locator, then click. */
export async function glideClick(
	page: Page,
	selector: string,
	options: { durationMs?: number; settleMs?: number } = {},
): Promise<void> {
	const box = await page.locator(selector).first().boundingBox();
	if (!box) throw new Error(`humanize.glideClick: no box for ${selector}`);
	await glideTo(page, box.x + box.width / 2, box.y + box.height / 2, options.durationMs ?? 600);
	await page.waitForTimeout(options.settleMs ?? 150);
	await page.mouse.down();
	await page.waitForTimeout(70);
	await page.mouse.up();
}

/** Press-drag from one locator to another with an eased path. */
export async function glideDrag(
	page: Page,
	fromSelector: string,
	toSelector: string,
	durationMs = 900,
): Promise<void> {
	const from = await page.locator(fromSelector).first().boundingBox();
	const to = await page.locator(toSelector).first().boundingBox();
	if (!from || !to) throw new Error("humanize.glideDrag: missing box");
	await glideTo(page, from.x + from.width / 2, from.y + from.height / 2, 500);
	await page.mouse.down();
	await page.waitForTimeout(180);
	await glideTo(page, to.x + to.width / 2, to.y + to.height / 2, durationMs);
	await page.waitForTimeout(180);
	await page.mouse.up();
}

/** Type text with per-keystroke jitter (feels ~55 wpm). */
export async function typeHuman(page: Page, text: string): Promise<void> {
	for (const ch of text) {
		await page.keyboard.type(ch);
		await page.waitForTimeout(35 + Math.random() * 70);
	}
}

/** Smooth wheel scroll in eased increments. */
export async function scrollHuman(
	page: Page,
	deltaY: number,
	durationMs = 1200,
): Promise<void> {
	const steps = Math.max(10, Math.round(durationMs / 40));
	let emitted = 0;
	for (let i = 1; i <= steps; i++) {
		const target = Math.round(deltaY * easeInOutCubic(i / steps));
		await page.mouse.wheel(0, target - emitted);
		emitted = target;
		await page.waitForTimeout(durationMs / steps);
	}
}

/** A deliberate on-camera pause. */
export async function beat(page: Page, ms = 800): Promise<void> {
	await page.waitForTimeout(ms);
}
