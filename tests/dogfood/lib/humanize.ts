/**
 * Human-pacing helpers for the promo capture rig. Playwright's mouse jumps
 * and types instantly — recorded footage of that reads robotic. These wrap
 * the same primitives with eased multi-step movement, jittered typing, and
 * smooth scrolling so the clips read like a person driving.
 */

import type { Locator, Page } from "@playwright/test";

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

function toLocator(page: Page, target: string | Locator): Locator {
	return typeof target === "string" ? page.locator(target).first() : target.first();
}

/** Glide to the centre of a selector/Locator, then click. */
export async function glideClick(
	page: Page,
	target: string | Locator,
	options: { durationMs?: number; settleMs?: number } = {},
): Promise<void> {
	const box = await toLocator(page, target).boundingBox();
	if (!box) throw new Error("humanize.glideClick: no box for target");
	await glideTo(page, box.x + box.width / 2, box.y + box.height / 2, options.durationMs ?? 450);
	await page.waitForTimeout(options.settleMs ?? 120);
	await page.mouse.down();
	await page.waitForTimeout(60);
	await page.mouse.up();
}

/** Press-drag from one selector/Locator to another with an eased path. */
export async function glideDrag(
	page: Page,
	fromTarget: string | Locator,
	toTarget: string | Locator,
	durationMs = 900,
): Promise<void> {
	const from = await toLocator(page, fromTarget).boundingBox();
	const to = await toLocator(page, toTarget).boundingBox();
	if (!from || !to) throw new Error("humanize.glideDrag: missing box");
	await glideTo(page, from.x + from.width / 2, from.y + from.height / 2, 400);
	await page.mouse.down();
	await page.waitForTimeout(150);
	await glideTo(page, to.x + to.width / 2, to.y + to.height / 2, durationMs);
	await page.waitForTimeout(150);
	await page.mouse.up();
}

/** Type text with per-keystroke jitter. Default is a brisk on-camera
 *  typist (~90 wpm); pass `paceMs` to slow/speed it. */
export async function typeHuman(page: Page, text: string, paceMs = 22): Promise<void> {
	for (const ch of text) {
		await page.keyboard.type(ch);
		await page.waitForTimeout(paceMs + Math.random() * paceMs);
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
