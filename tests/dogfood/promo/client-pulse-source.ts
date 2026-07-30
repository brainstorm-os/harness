/**
 * "Client Pulse" — the two-file app the VID-build-apps episode writes on camera.
 *
 * These are the REAL bytes: the capture types them into the Code editor, saves
 * them as `brainstorm/CodeFile/v1` rows at `client-pulse/manifest.json` and
 * `client-pulse/index.html`, and the shell's `apps:install-from-vault` handler
 * installs exactly this source. If the app doesn't run, the episode doesn't
 * ship — so nothing here is a prop.
 *
 * Platform contract this leans on (all verified against `main`):
 *   - A valid app is `{id, name, version, sdk, entry, capabilities}` +
 *     an entry page. No bundler, no build step (`main/apps/manifest.ts`).
 *   - Files must sit at the BUNDLE ROOT — `main/apps/bundle-filter.ts`
 *     strips a top-level `src/`, `package.json`, `README.md`, …
 *   - The page is loaded as `file://…/index.html?v=<sha8>`, so the script must
 *     be a CLASSIC `<script>` (ES modules are blocked over `file://`).
 *   - `window.brainstorm` is exposed by `preload/app-preload.ts` BEFORE any
 *     page script runs, so no ready event is needed. Entity reads live at
 *     `window.brainstorm.services.entities.query(...)`.
 *   - The shell injects the design tokens (`--color-*`, `--space-*`,
 *     `--radius-*`, `--motion-*`) and the shared `.app-header` chrome into
 *     every app page, so a hand-written app inherits the product's look for
 *     free. Only tokens that exist in `packages/tokens` are referenced here —
 *     a phantom `var(--nope)` renders through its fallback in one theme and
 *     breaks silently in every other.
 *
 * The capability is deliberately NARROW — `entities.read:brainstorm/Project/v1`
 * and nothing else. That is what makes the episode's walls beat honest: the
 * board renders the vault's real client projects, and the same app asking for
 * everything (`vaultEntities.list()`, which statically requires
 * `entities.read:*`) is refused by the broker, on camera, with the broker's own
 * message.
 *
 * ── Why the page looks the way it does (camera notes) ───────────────────────
 *
 * The first cut of this app was a short stack of cards on a page with no
 * layout: it filled the top third of a 16:9 window and left a large empty
 * white area under it for two whole scenes. Three things fix that, and all
 * three are ordinary app code, not camera tricks:
 *
 *   1. **The page owns the viewport.** `body` is a `min-height: 100vh` column;
 *      the board `flex: 1` with `grid-auto-rows: minmax(…, 1fr)` so the cards
 *      stretch to fill whatever height is left, and the walls panel sits on
 *      the bottom edge instead of floating mid-page.
 *   2. **Real derived detail.** A three-tile summary strip (clients, active,
 *      next milestone) computed from the SAME granted query — no second
 *      capability, no invented data — gives the top of the frame something to
 *      be.
 *   3. **Motion.** Cards rise in with a staggered delay on load and light up
 *      on hover. Beyond looking alive, this matters mechanically: the capture
 *      records through the CDP screencast, which only emits frames ON PAINT —
 *      a page that never repaints yields a fraction of a second of footage for
 *      a nine-second scene.
 *
 * The walls panel deliberately runs BOTH probes side by side — the granted
 * read (which succeeds, in green) and the ungranted one (which is refused, in
 * red). Showing only the refusal made the episode's last frame read as a
 * crash; showing the pair reads as what it is: the wall holding.
 */

/** Vault-relative paths of the two CodeFile rows (the install root is the
 *  shallowest `manifest.json`, so both live under `client-pulse/`). */
export const CLIENT_PULSE_DIR = "client-pulse";
export const CLIENT_PULSE_MANIFEST_PATH = `${CLIENT_PULSE_DIR}/manifest.json`;
export const CLIENT_PULSE_INDEX_PATH = `${CLIENT_PULSE_DIR}/index.html`;

/** The app id the installer registers and the launcher opens. */
export const CLIENT_PULSE_APP_ID = "studio.northbound.client-pulse";
export const CLIENT_PULSE_APP_NAME = "Client Pulse";

/** The entity type the board reads — the Northbound Studio seed's client
 *  engagements (`seedMarketingEntities`: Harbor & Co, Meridian, Atlas), each
 *  carrying `name` / `statusKey` / `description` / `milestoneAt`. */
export const CLIENT_PULSE_ENTITY_TYPE = "brainstorm/Project/v1";

export const CLIENT_PULSE_MANIFEST = `{
  "id": "${CLIENT_PULSE_APP_ID}",
  "name": "${CLIENT_PULSE_APP_NAME}",
  "version": "1.0.0",
  "sdk": "1",
  "description": "A pulse board for the studio's client work.",
  "entry": "index.html",
  "capabilities": ["entities.read:${CLIENT_PULSE_ENTITY_TYPE}"]
}
`;

/** What gets typed keystroke-by-keystroke on camera in scene `03-page` — the
 *  page's skeleton and the one call the episode is about. Typing the whole
 *  file would overrun the scene's 9-second budget past the renderer's 3×
 *  compression cap, so the capture types this and then reveals the finished
 *  file in one motion (the way a person writes markup first and fills in the
 *  styling after).
 *
 *  Every LINE here appears verbatim, in this order, inside
 *  `CLIENT_PULSE_INDEX_HTML` — `assertOnCameraIsSubsequence` pins that, so
 *  what the viewer watches being typed can never drift into something the
 *  shipped app doesn't contain. */
export const CLIENT_PULSE_INDEX_HTML_ON_CAMERA = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Client Pulse</title>
  </head>
  <body>
    <header class="app-header">
      <div class="app-header__left">
        <h1 class="app-header__title">Client Pulse</h1>
      </div>
    </header>
    <main id="board"></main>
    <script>
      (function () {
        var api = window.brainstorm;
        var board = document.getElementById("board");
        api.services.entities
          .query({ type: "brainstorm/Project/v1", orderBy: [{ property: "name", direction: "asc" }] })
          .then(render)
`;

/** Fail loudly if the on-camera text ever stops being a line-subsequence of
 *  the real file — the whole honesty claim of scene `03-page` rests on it. */
export function assertOnCameraIsSubsequence(): void {
	const shipped = CLIENT_PULSE_INDEX_HTML.split("\n");
	let cursor = 0;
	for (const line of CLIENT_PULSE_INDEX_HTML_ON_CAMERA.split("\n")) {
		if (line.trim() === "") continue;
		const at = shipped.indexOf(line, cursor);
		if (at === -1) {
			throw new Error(
				`client-pulse: on-camera line is not in the shipped file: ${JSON.stringify(line)}`,
			);
		}
		cursor = at + 1;
	}
}

/** The complete, working page. `CLIENT_PULSE_INDEX_HTML_ON_CAMERA` is a
 *  faithful prefix of the same idea; the capture replaces the buffer with THIS
 *  before saving, so the installed bytes are always the finished file. */
export const CLIENT_PULSE_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:"
    />
    <title>Client Pulse</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        font: 14px/1.5 system-ui, sans-serif;
        color: var(--color-text-primary);
        background: var(--color-background-primary);
      }
      /* The shell injects the design tokens and the app-header height +
         platform padding into every app page; the header FACE ships with the
         SDK stylesheet, which a two-file app does not bundle — so it draws its
         own from the same tokens and lands on the product's 44px baseline. */
      .app-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        box-sizing: border-box;
        border-bottom: 1px solid var(--color-border-subtle);
        background: var(--color-background-elevated);
        -webkit-app-region: drag;
      }
      .app-header__title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
      }
      #granted {
        font-size: 11px;
        color: var(--color-text-tertiary);
      }
      .strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-3);
        padding: var(--space-5) var(--space-5) var(--space-3);
      }
      .stat {
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-subtle);
        border-radius: var(--radius-lg);
        background: var(--color-background-elevated);
      }
      .stat__value {
        font-size: 26px;
        font-weight: 600;
        line-height: 1.15;
      }
      .stat__key {
        font-size: 11px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      main {
        flex: 1;
        display: grid;
        grid-auto-rows: minmax(84px, 1fr);
        gap: var(--space-3);
        padding: 0 var(--space-5) var(--space-4);
      }
      .card {
        display: grid;
        align-content: center;
        gap: var(--space-1);
        padding: var(--space-4) var(--space-5);
        border: 1px solid var(--color-border-subtle);
        border-radius: var(--radius-lg);
        background: var(--color-background-elevated);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard);
        opacity: 0;
        transform: translateY(12px);
        animation: rise 420ms var(--motion-easing-decelerated) forwards;
      }
      .card:hover {
        border-color: var(--color-border-strong);
        background: var(--color-surface-raised);
      }
      @keyframes rise {
        to {
          opacity: 1;
          transform: none;
        }
      }
      .card__head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .card__name {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
      }
      .card__due {
        margin-left: auto;
        font-size: 12px;
        color: var(--color-text-tertiary);
        white-space: nowrap;
      }
      .card__meta {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .card__desc {
        margin: 0;
        color: var(--color-text-secondary);
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: var(--radius-full);
        background: var(--color-text-tertiary);
        flex: 0 0 auto;
      }
      .dot--active {
        background: var(--color-state-info);
      }
      .dot--done {
        background: var(--color-state-success);
      }
      .walls {
        display: grid;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-5) var(--space-5);
        border-top: 1px solid var(--color-border-subtle);
        background: var(--color-background-elevated);
      }
      .walls__label {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .walls__row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .walls button {
        min-width: 250px;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .walls button:hover {
        border-color: var(--color-border-strong);
      }
      .out {
        font-size: 13px;
        color: var(--color-text-tertiary);
      }
      .out--granted {
        color: var(--color-state-success);
      }
      .out--granted::before {
        content: "✓ ";
      }
      .out--refused {
        color: var(--color-state-error);
      }
      .out--refused::before {
        content: "✕ ";
      }
    </style>
  </head>
  <body>
    <header class="app-header">
      <div class="app-header__left">
        <h1 class="app-header__title">Client Pulse</h1>
      </div>
      <div class="app-header__right"><span id="granted"></span></div>
    </header>
    <section class="strip" id="strip"></section>
    <main id="board"></main>
    <footer class="walls">
      <p class="walls__label">What this app may ask the vault for</p>
      <div class="walls__row">
        <button id="probe-ok" type="button">Read her client projects</button>
        <span class="out" id="probe-ok-out"></span>
      </div>
      <div class="walls__row">
        <button id="probe" type="button">Read everything in this vault</button>
        <span class="out" id="probe-out"></span>
      </div>
    </footer>
    <script>
      (function () {
        var api = window.brainstorm;
        var board = document.getElementById("board");
        var strip = document.getElementById("strip");

        var vaultGrants = api.capabilities.filter(function (cap) {
          return cap.indexOf("entities.") === 0;
        });
        document.getElementById("granted").textContent =
          "vault access: " + (vaultGrants.join(", ") || "none");

        function dotClass(status) {
          if (status === "done") return "dot dot--done";
          if (status === "active") return "dot dot--active";
          return "dot";
        }

        function days(at) {
          return Math.round((at - Date.now()) / 86400000);
        }

        function dueLabel(at) {
          if (typeof at !== "number") return "no milestone";
          var d = days(at);
          if (d < 0) return "milestone passed";
          if (d === 0) return "milestone today";
          return "milestone in " + d + " days";
        }

        function el(tag, className, text) {
          var node = document.createElement(tag);
          if (className) node.className = className;
          if (text !== undefined) node.textContent = text;
          return node;
        }

        function stat(value, key) {
          var tile = el("div", "stat");
          tile.appendChild(el("div", "stat__value", value));
          tile.appendChild(el("div", "stat__key", key));
          return tile;
        }

        function summarise(rows) {
          strip.textContent = "";
          var active = rows.filter(function (row) {
            return (row.properties || {}).statusKey === "active";
          });
          var due = rows
            .map(function (row) {
              return (row.properties || {}).milestoneAt;
            })
            .filter(function (at) {
              return typeof at === "number" && days(at) >= 0;
            })
            .sort(function (a, b) {
              return a - b;
            });
          strip.appendChild(stat(String(rows.length), "clients"));
          strip.appendChild(stat(String(active.length), "active"));
          strip.appendChild(
            stat(due.length ? days(due[0]) + "d" : "—", "next milestone")
          );
        }

        function render(rows) {
          board.textContent = "";
          summarise(rows);
          if (rows.length === 0) {
            board.appendChild(el("p", "card__desc", "No client work in this vault yet."));
            return;
          }
          rows.forEach(function (row, index) {
            var p = row.properties || {};
            var card = el("article", "card");
            card.style.animationDelay = index * 90 + "ms";
            var head = el("div", "card__head");
            head.appendChild(el("span", dotClass(p.statusKey)));
            head.appendChild(el("h2", "card__name", String(p.name || "Untitled")));
            head.appendChild(el("span", "card__due", dueLabel(p.milestoneAt)));
            card.appendChild(head);
            card.appendChild(el("p", "card__meta", String(p.statusKey || "unknown")));
            if (typeof p.description === "string" && p.description.length > 0) {
              card.appendChild(el("p", "card__desc", p.description));
            }
            board.appendChild(card);
          });
        }

        api.services.entities
          .query({ type: "brainstorm/Project/v1", orderBy: [{ property: "name", direction: "asc" }] })
          .then(render)
          .catch(function (error) {
            board.appendChild(el("p", "card__desc", "Could not read clients: " + error.message));
          });

        // The two probes are the same shape — one inside the granted scope,
        // one outside it — so the wall is visible as a pair, not as an error.
        function probe(buttonId, outId, run) {
          var out = document.getElementById(outId);
          document.getElementById(buttonId).addEventListener("click", function () {
            out.className = "out";
            out.textContent = "asking…";
            run()
              .then(function (text) {
                out.className = "out out--granted";
                out.textContent = text;
              })
              .catch(function (error) {
                out.className = "out out--refused";
                out.textContent = "refused — " + error.message;
              });
          });
        }

        probe("probe-ok", "probe-ok-out", function () {
          return api.services.entities
            .query({ type: "brainstorm/Project/v1" })
            .then(function (rows) {
              return "granted — read " + rows.length + " client projects";
            });
        });

        probe("probe", "probe-out", function () {
          return api.services.vaultEntities.list().then(function (snapshot) {
            return "read " + snapshot.entities.length + " objects";
          });
        });
      })();
    </script>
  </body>
</html>
`;
