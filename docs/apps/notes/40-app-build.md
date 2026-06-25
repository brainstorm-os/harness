# Per-app build pipeline

The Notes app today ships **vanilla ES modules** (HTML+JS, no bundler). That's fine for a scratchpad but unsuitable for the block editor: Lexical + React + many component files need bundling.

This doc codifies the **per-app Vite pattern**. Every first-party app under `apps/<id>/` adopts it.

## Directory shape

```
apps/<id>/
  package.json           # per-app deps (lexical, react, etc.)
  vite.config.ts         # builds src/ → dist/
  tsconfig.json          # extends repo's base
  manifest.json          # `entry: "dist/index.html"`
  icon.svg
  src/
    main.tsx             # React root
    index.html           # Vite entry; references main.tsx
    app.tsx              # top-level component
    …                    # block code, components, etc.
  dist/                  # build output — gitignored, regenerated
```

Notable choices:

- **`src/index.html` is the source entry**; Vite injects the built JS/CSS and outputs `dist/index.html`.
- **`manifest.json#entry` points at `dist/index.html`** — when `AppInstaller.install({bundleDir})` copies the app into the vault, it copies *the whole bundleDir including `dist/`*. The installer doesn't care what's source vs. build.
- **CSP** identical to today's Notes: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: brainstorm:`.

## Vite config

```ts
// apps/notes/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  base: "./",          // relative paths so file:// loading works
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "chrome130", // Electron 41 ships Chromium 130
    rollupOptions: {
      output: { entryFileNames: "[name].js", assetFileNames: "[name][extname]" },
    },
  },
  plugins: [react()],
});
```

Target chromium 130 avoids `core-js` polyfill bloat.

## App `package.json`

```jsonc
{
  "name": "@brainstorm-app/notes",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev":   "vite build --watch"
  },
  "dependencies": {
    "lexical":            "^0.x",
    "@lexical/react":     "^0.x",
    "@lexical/rich-text": "^0.x",
    "@lexical/list":      "^0.x",
    "@lexical/code":      "^0.x",
    "@lexical/table":     "^0.x",
    "@lexical/markdown":  "^0.x",
    "react":              "^19.x",
    "react-dom":          "^19.x",
    "@brainstorm/sdk":    "workspace:*",
    "@brainstorm/sdk-types": "workspace:*"
  },
  "devDependencies": {
    "vite":                  "^5.x",
    "@vitejs/plugin-react":  "^4.x",
    "typescript":            "^5.x"
  }
}
```

The SDK workspace dep is what gives the app `window.brainstorm` typing on the renderer side. The runtime is already exposed by the shell's `app-preload`.

## Workspace integration

`apps/*` joins the workspace globs in the root `package.json`:

```jsonc
"workspaces": ["packages/*", "apps/*"]
```

Root scripts that need to know about apps:

```jsonc
"scripts": {
  "build":       "bun run --filter '*' build",
  "build:apps":  "bun run --filter './apps/*' build",
  "build:shell": "bun run --filter @brainstorm/shell build"
}
```

`bun install` after this change pulls in Lexical/React for the apps that declare them.

## Dev iteration

Per-app dev loop:

```sh
# from apps/notes/
bun run dev   # vite build --watch — rewrites dist/ on save
```

In a separate shell, `bun run dev` for the shell as usual. **There is no HMR for app windows** today — the app runs from `<vault>/apps/<id>/<version>/dist/` after install, not the live `apps/notes/dist/`. The dev seeder's "always uninstall + reinstall" (`main/dev/seed-demo-apps.ts`) copies the freshly-built `dist/` into the vault on each click — so the iteration loop is: edit → vite rebuilds `dist/` → click "Seed demo apps" in the dashboard → relaunch Notes.

A future improvement (post-Stage 8): a dev-only watch on `apps/<id>/dist/` that re-copies into the vault automatically.

## Production install

When a user installs an app from a `.brainstormapp` archive (Stage 3 install flow), the archive contains `manifest.json + dist/ + icon.*` (and nothing else — no source, no node_modules). The installer copies the archive contents verbatim.

## Stub for tests

App-level tests live next to source: `apps/<id>/src/**/*.test.ts(x)`. Vitest config is inherited from root. The shell's per-package coverage floor doesn't apply to apps (different bar); apps have their own target listed in their `package.json`.

## Migration

The current `apps/notes/{index.html,app.js,styles.css}` becomes legacy. Migration steps:

1. Move existing source under `apps/notes/src/legacy/` so nothing breaks while React is being added.
2. Add Vite config + scripts.
3. New `src/main.tsx` mounts a React root that calls into the existing storage code.
4. Switch `manifest.json#entry` to `dist/index.html`.
5. Delete `legacy/` once the React port is at parity.

## Open questions

- **Per-app CSP** — when an app needs `network.fetch`, its CSP needs `connect-src` opened. Should the manifest declare that, or should the shell rewrite CSP at install time based on declared capabilities? Likely the latter — keeps the manifest spec-shaped (capabilities) and CSP an implementation detail.
- **Shared chunks** — should React/Lexical be hoisted to a shared `@brainstorm/runtime-bundle` that the shell preloads, so apps don't ship their own copy? Defer until we have ≥2 apps using React.
