# 60 — Inline spellchecking & custom dictionary (the cross-app prose primitive)

This doc introduces inline spellchecking — red-squiggle misspelling detection + a suggestion menu + a user-managed custom dictionary — across every **prose** surface in Brainstorm (Notes Lexical body, Journal, Database/Tasks cell text, Whiteboard sticky text, Mailbox compose). It is the cross-app counterpart to the find/replace seam in [59-find-and-replace.md](59-find-and-replace.md): one capability the platform provides, adopted identically everywhere, never hand-rolled per app. **Code-editor opts out — code is not prose.**

It builds on [07-editing-lexical.md](07-editing-lexical.md) (the editor baseline), [foundations/35-code-conventions.md](../foundations/35-code-conventions.md) (keyboard-via-registry, `t()`, enums-not-literals, no default exports, fancy-menus for every menu), and the sandbox/capability model in [security/09-security-and-sandbox.md](../security/09-security-and-sandbox.md) (every host-service call is a fail-closed capability-gated envelope). Engineering sequencing is impl-plan **B11.16 / B11.17**.

## The problem

Spell-as-you-type is table stakes in any prose surface. Two forces shape the design:

1. **The platform already has a spellchecker.** Chromium (which every sandboxed app renders in) ships a built-in spellchecker with OS/hunspell dictionaries and native squiggle painting. Re-implementing that in-renderer (nspell / hunspell-asm bundled per app) means a per-app dictionary download + a hand-painted squiggle layer for something the engine provides for ~zero bundle.
2. **The sandbox splits the surfaces.** With the native engine the misspelled word + suggestions arrive on the **main-process** `webContents` `context-menu` event, but the suggestion menu must render in the **sandboxed app** through the fancy-menus runtime (the OQ-FR-2 consistent-interface rule — never Chromium's native menu). So the data has to cross the sandbox boundary over a capability.

## Decisions (resolves OQ-SP-1 / OQ-SP-2 / OQ-SP-3)

> **OQ-SP-1 — engine: Electron-native.** Spellchecking runs as Chromium's built-in spellchecker on each sandboxed app's renderer session. The **shell enables it per app session at window-create** (`enableSessionSpellcheck` in `packages/shell/src/main/web/spellcheck.ts`, called from the app-view factory in `runtime/launch-setup.ts`) — apps declare nothing, mirroring the shell-injected `bs-find-bar` / `.header-nav` chrome. Languages come from the OS preference order (`app.getPreferredSystemLanguages()`) intersected with the platform's available dictionary list (`session.availableSpellCheckerLanguages`), falling back to `en-US`. On macOS the OS speller auto-detects (the available list is empty and no language list is set — the documented no-op). The in-renderer path was rejected: it re-implements a per-app dictionary download + a squiggle renderer the platform already provides.

> **OQ-SP-2 — custom dictionary: vault-scoped.** User-added words ("Brainstorm", a surname, a domain term) live in a **vault-resident store** that syncs across devices/users with the vault — the knowledge-product expectation that a custom word follows the user, not the machine. On vault-open the words are hydrated into each app session via `session.addWordToSpellCheckerDictionary`. This is the **linguistic** spell dictionary, deliberately separate from the `dictionaryStore` select-property vocabularies of B5.1–B5.9 (those are enum value-pickers, not word lists). The per-OS-user native list alone was rejected — it strands custom words per-machine and never syncs.

> **OQ-SP-3 — the cross-sandbox bridge.** Resolved to **two non-broker channels** rather than a broker capability, because the suggestion data is the app's *own editable content returning to itself* — no new authority crosses the boundary. (1) **Read:** the shell pushes `{word, suggestions, x, y}` to the renderer that fired the `context-menu` event over `app:spellcheck-context` (the `app:files-watch` / `app:intent` push pattern), exposed as `runtime.spellcheck.onContext`. (2) **Apply:** the renderer's chosen replacement returns on `app:spellcheck-apply`, and the shell calls `event.sender.replaceMisspelling` — scoped to the *calling* renderer's own current misspelling selection, so a renderer can only ever rewrite its own selected word. The renderer renders the suggestions through the shared fancy-menus runtime (`@brainstorm/sdk/spellcheck-menu`); **Chromium has no native context menu to show**. The privileged operation — adding a word to the shared/vault dictionary — is the *only* part that needs gating, and it lands with B11.17a (`editor.spellcheck.*`), not the read/apply path here.

## Architecture

### B11.16a — engine + session enablement *(shipped)*

`packages/shell/src/main/web/spellcheck.ts` is the engine config: `resolveSpellCheckLanguages(preferred, available)` (pure, unit-tested — preference order, de-dupe, unsupported-drop, `en-US` fallback, empty-list ⇒ macOS no-op) + `enableSessionSpellcheck(session, preferred)` (idempotent per session; sets `setSpellCheckerEnabled(true)` then the resolved language list). The app-view factory calls it on every app renderer's session (`session.defaultSession`, shared across app renderers — the idempotency guard means it configures once). Enabling at the session level is harmless for apps with no spellcheckable elements: Chromium only checks elements that opt in.

### B11.16b — editable-element opt-in

Chromium checks an element only when `spellcheck` is on (`contentEditable` defaults on; `<input>`/`<textarea>` inherit unless set). Brainstorm makes the choice explicit and shared so no app hand-rolls the attribute:

- **Prose surfaces opt in** (`spellcheck=true`): the Lexical `contentEditable`, the property-cell text/multiline editors, sticky-note text, Mailbox compose.
- **Code surfaces opt out** (`spellcheck=false`): the code-editor surface, any monospace/code cell, and structural inputs (search bars already set `spellCheck={false}`).

One shared SDK helper (`@brainstorm/sdk` — the spellcheck-attribute seam) so the decision lives in one place, keyed by surface kind rather than copied per app.

### B11.16c — suggestion menu across the sandbox boundary *(shipped)*

The app-view factory (`runtime/launch-setup.ts`) listens to `webContents.on("context-menu", …)` on each app view; the pure `spellcheckContextFromParams` (`main/web/spellcheck.ts`) maps an editable misspelling to `{word, suggestions, x, y}` (or `null`), which is pushed to that renderer over `SPELLCHECK_CONTEXT_CHANNEL`. The preload re-dispatches it to `runtime.spellcheck.onContext` listeners. `@brainstorm/sdk/spellcheck-menu` mounts one listener per app (`mountSpellcheckMenu(runtime.spellcheck, labels)`) that opens the suggestions through `openContextMenu` (fancy-menus) at the cursor — the pure `buildSpellMenuItems` builds the rows (one per suggestion, a disabled "No suggestions" row when empty). Picking a suggestion calls `runtime.spellcheck.replace(word)` → `SPELLCHECK_APPLY_CHANNEL` → the shell's `event.sender.replaceMisspelling(word)`, which rewrites the calling renderer's selected misspelling (Chromium keeps the right-clicked word selected). First adopter: Notes; other prose apps adopt the one-line mount. The B11.17 "Add to dictionary" / "Ignore" rows extend this menu.

### B11.17 — custom dictionary

- **B11.17a — store + capability + add / ignore from the menu *(shipped)*.** The vault-scoped word list lives in `main/vault/vault-spellcheck-dictionary-store.ts` (`<vault>/shell/spellcheck-dictionary.json`, pure I/O + `addWordToList`/`removeWordFromList`). The capability-gated `spellcheck` broker service (`main/spellcheck/spellcheck-service.ts`, injected session sink) exposes `listWords` (`editor.spellcheck.read`), `addWord`/`removeWord`/`ignoreWord` (`editor.spellcheck.write`); the renderer reaches it through `runtime.spellcheck.{addWord,removeWord,ignoreWord,listWords}` (preload → `bridge.dispatch` with the cap). "Add to dictionary" persists **and** `session.addWordToSpellCheckerDictionary`s so the squiggle clears; "Ignore" only adds to the live session (not persisted → returns next vault-open). On session config the vault's words hydrate via `hydrateSessionDictionary` (once per shared `defaultSession`; **vault-switch re-hydration is a documented follow-up** — the shared session persists the prior vault's words). The 5 prose-app manifests declare the two caps. *(Real-Electron residue: the install-time grant of the new caps + the live add→clear-squiggle round-trip.)*
- **B11.17b — dictionary manager surface *(shipped)*.** `SpellcheckDictionaryPanel` in Settings → Language & Region lists the vault's custom words with per-row remove, reading through the privileged dashboard bridge `window.brainstorm.spellcheck` (`listWords`/`removeWord`/`languages`) → ipcMain handlers (`main/ipc/spellcheck-handlers.ts`, the dashboard uses direct ipcMain, not the broker) reusing the same vault store + `defaultSession`. Active spellcheck languages show read-only (empty on macOS → "managed by your OS"); **explicit language selection + its persistence is a documented follow-up** (the OS-derived auto list from B11.16a works in the meantime).

## Privacy / offline note

On Windows/Linux Chromium's hunspell downloads dictionaries from a Google-hosted CDN on first use (`session.setSpellCheckerDictionaryDownloadURL` can repoint it). macOS uses the OS speller with no download. For a privacy-focused product this is a known consideration; the dev/beta target (macOS) is unaffected. A bundled-dictionary or self-hosted download URL is a follow-up if Windows/Linux offline-first becomes a requirement.

## Keyboard & a11y

The suggestion menu is a fancy-menus context menu — it inherits the shared keyboard model, anchoring, theming, and a11y (arrow nav, Enter to apply, Escape to dismiss) for free, the same as every other menu. Squiggles are Chromium-native and announced by the platform.
