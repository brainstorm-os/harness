/**
 * "Milestones" — the app the AGENT writes in the VID-build-apps episode.
 *
 * Companion to `client-pulse-source.ts`, and deliberately the mirror image of
 * it: Client Pulse is the app Mira types herself, Milestones is the one she
 * asks for. Both are genuine two-file, no-build apps; both ask for the SAME
 * single narrow capability (`entities.read:brainstorm/Project/v1`); both are
 * held by the same broker. That is the whole point of the closing shot — two
 * apps in the grid, one hand-written, one agent-written, indistinguishable in
 * how the platform treats them.
 *
 * ── Where the bytes live, and why not here ──────────────────────────────────
 *
 * Unlike Client Pulse, this app's source is NOT authored in the harness. It is
 * the scripted model output of the capture-only demo provider in the shell
 * (`packages/shell/src/main/ai/demo-agent-provider.ts`,
 * `DEMO_AGENT_APPFORGE_SCRIPT`, gated behind `BRAINSTORM_DEMO_AGENT=appforge`)
 * — because on camera the agent must *produce* it. Copying the file here would
 * create a second source of truth that silently drifts from the one the reel
 * actually stages.
 *
 * So this module holds the app's IDENTITY (what to click, what to open, what to
 * assert) and an invariant check run against the bytes the vault really
 * received after approval. The check is what enforces the episode's honesty
 * bar: the drafted app must be an app — it must ask for exactly one scoped
 * capability, read the vault through `window.brainstorm`, and not be a
 * restyled copy of the app she wrote.
 */

/** Vault-relative paths of the two CodeFile rows the agent stages. The install
 *  root is the shallowest `manifest.json`, so both live under `milestones/` —
 *  which also means the Code editor's FILES tree grows a second folder next to
 *  `client-pulse/`, the shot scene `12-agent-files` is built on. */
export const MILESTONES_DIR = "milestones";
export const MILESTONES_MANIFEST_PATH = `${MILESTONES_DIR}/manifest.json`;
export const MILESTONES_INDEX_PATH = `${MILESTONES_DIR}/index.html`;

/** The app id the installer registers and the payoff scene opens. */
export const MILESTONES_APP_ID = "studio.northbound.milestones";
export const MILESTONES_APP_NAME = "Milestones";

/** The one type it reads — the Northbound seed's client engagements, the same
 *  rows Client Pulse renders as a status board and this one as a timeline. */
export const MILESTONES_ENTITY_TYPE = "brainstorm/Project/v1";
export const MILESTONES_CAPABILITY = `entities.read:${MILESTONES_ENTITY_TYPE}`;

/** What the user asks for on camera. Short on purpose: the conversation title
 *  is the first message, and the app header's title face ellipsises at
 *  `min(440px, 60vw)` — the previous prompt truncated mid-sentence in the
 *  shipped cut ("Build me a small hello app I can install — a manifest and a…"). */
export const MILESTONES_PROMPT = "Build me a milestones board.";

type VaultFile = { path: string; content: string };

/** Assert the agent really drafted an app, against the bytes the vault holds
 *  after approval. Throws with a specific reason — a degraded agent act must
 *  fail the run, not ship a reel that claims more than it shows. */
export function assertDraftedAppIsReal(files: readonly VaultFile[]): void {
	const find = (path: string): string => {
		const row = files.find((file) => file.path === path);
		if (!row) {
			throw new Error(
				`milestones: the vault has no ${path} — the agent act did not land (saw: ${files
					.map((f) => f.path)
					.join(", ")})`,
			);
		}
		return row.content;
	};

	const manifest = JSON.parse(find(MILESTONES_MANIFEST_PATH)) as Record<string, unknown>;
	if (manifest.id !== MILESTONES_APP_ID) {
		throw new Error(`milestones: manifest id is ${String(manifest.id)}`);
	}
	if (manifest.name !== MILESTONES_APP_NAME) {
		throw new Error(`milestones: manifest name is ${String(manifest.name)}`);
	}
	// A manifest without `sdk` fails `validateManifest`, which greys out the
	// picker's Install button — the exact way this act broke once before.
	if (manifest.sdk !== "1") {
		throw new Error(`milestones: manifest sdk is ${String(manifest.sdk)}, expected "1"`);
	}
	const caps = manifest.capabilities;
	if (!Array.isArray(caps) || caps.length !== 1 || caps[0] !== MILESTONES_CAPABILITY) {
		throw new Error(`milestones: capabilities are ${JSON.stringify(caps)}`);
	}

	const html = find(MILESTONES_INDEX_PATH);
	for (const needle of ["window.brainstorm", "services.entities", MILESTONES_ENTITY_TYPE]) {
		if (!html.includes(needle)) {
			throw new Error(`milestones: index.html does not contain ${JSON.stringify(needle)}`);
		}
	}
	if (html.includes('type="module"')) {
		throw new Error("milestones: index.html uses an ES module, which is blocked over file://");
	}
	// Not a toy, and not a second copy of the app she wrote.
	if (html.length < 2000) {
		throw new Error(`milestones: index.html is only ${html.length}B — that is a stub, not an app`);
	}
	if (html.includes("Client Pulse")) {
		throw new Error("milestones: the drafted app is a copy of the hand-written one");
	}
}
