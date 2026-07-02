---
name: release-notes
description: Write a release's notes to all three surfaces that must stay in sync — the in-app What's-New changelog (bundled at build time), the GitHub release body, and the site downloads page. Trigger when the user says "/release-notes", "add release notes", "update the changelog", "the app shows old/pre-alpha release notes", "the release notes are empty/missing", or when cutting a release (before tagging).
---

# Release notes

A Brainstorm release has notes on **three** surfaces. They drift because each lives in a different repo/format and nothing forces them together. This skill writes all three from one set of highlights.

The three surfaces:

| Surface | Where | Format | Timing |
| --- | --- | --- | --- |
| **In-app "What's New"** | `packages/shell/changelog/changelog.json` (shell repo) | `brainstorm/changelog/v2` block JSON | **Before the tag** — bundled at build time |
| **GitHub release body** | the `vX.Y.Z` release | Markdown | Auto in CI (`release.yml` `finalize` job); backfill by hand if missing |
| **Site downloads page** | `src/content/releases/X.Y.Z.md` (site repo) | Astro content frontmatter + prose | Any time after the tag/assets exist |

**The load-bearing rule: the in-app changelog is bundled into the binary at build time.** Committing it *after* the release is tagged does nothing for that build — the shipped app keeps the old notes. So the changelog entry MUST land on `main` **before** the release tag is pushed. If you're here because "the app shows pre-alpha content," it's because this step was skipped on prior releases; add the current entry now so the source is correct for the next build, and make it a pre-tag step from now on.

## Inputs

Gather once, reuse for all three:
- **version** (e.g. `0.1.7`) and **date** (today, `YYYY-MM-DD`).
- **5–8 user-facing highlights** — what a *user* notices, not commit subjects. Pull from the merged PRs / friction-log entries in this release's range, then rewrite in plain product language ("status cells edit as a pick list", not "DS-cell-combobox-1"). Name the app each highlight touches.
- a **one-line summary** (the hero subtitle).

## 1. In-app changelog (do this BEFORE tagging)

Edit `packages/shell/changelog/changelog.json` in a shell worktree (never the shared main tree — use `git worktree add`). **Prepend** the new release object to `releases[]` (newest first — the parser sorts, but keep the file readable). Mirror the existing entries' shape:

```json
{
  "version": "0.1.7",
  "date": "2026-07-02",
  "icon": "🧹",
  "title": "A full pass over every app",
  "summary": "One or two sentences — the hero subtitle.",
  "body": [
    { "kind": "h1", "text": "Fixes across the apps" },
    { "kind": "li", "text": [
      { "text": "Database", "marks": ["bold"] },
      { "text": " — status cells edit as a " },
      { "text": "combobox", "marks": ["highlight"] },
      { "text": "." }
    ]},
    { "kind": "p", "text": "Flowing prose, no marks needed." },
    { "kind": "callout", "icon": "🔄", "text": [
      { "text": "Update in place. ", "marks": ["bold"] },
      { "text": "Existing installs update from " },
      { "text": "Settings → Updates", "marks": ["highlight"] },
      { "text": "." }
    ]}
  ]
}
```

Block `kind`s: `h1` / `h2` / `h3` (h3 = bolded inline heading, not a divider), `p`, `li` (siblings auto-group into one list), `callout` (needs an `icon`). A block's `text` is either a plain string or an array of `TextRun`s. Marks: `bold`, `highlight` (tinted pill — use for app names' key terms, shortcuts, paths, enum names). **No Markdown, no HTML, no images, no nested blocks** — the shape is the wire form and any parse failure is a release-blocking bug (fail loud). The `title`/`summary` are required; keep `summary` ≥ 20 chars.

Validate before committing:
```sh
python3 -c "import json; json.load(open('packages/shell/changelog/changelog.json'))"
bunx vitest run packages/shell/src/main/help/changelog packages/shell/src/renderer/dashboard/changelog-gating
bunx biome format --write packages/shell/changelog/changelog.json   # keeps lint green
bun run lint
```

Commit on a branch → PR (don't push `main` directly; the tree is shared). This PR must merge **before** the release tag is pushed.

## 2. GitHub release body

As of `release.yml`'s `finalize` job this is **automatic** on a tag push — it generates a "What's Changed" list from the merged PRs, prepends the tag annotation subject, and publishes the draft `--latest`. Two things follow from that:
- **Tag with an annotation** (`git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary>"`) so the body gets a human first line.
- If you need richer notes than the auto list, or you're backfilling a release whose body is empty, set it by hand:
  ```sh
  gen=$(gh api repos/brainstorm-os/shell/releases/generate-notes -f tag_name=vX.Y.Z --jq .body)
  # write <summary + highlights> then the generated list into notes.md
  gh release edit vX.Y.Z --repo brainstorm-os/shell --notes-file notes.md
  ```

If a release built before the `finalize` job existed is still a **draft** with empty notes, publish it: `gh release edit vX.Y.Z --repo brainstorm-os/shell --draft=false --latest --notes-file notes.md`. Confirm the download URLs resolve (`curl -sIL -o /dev/null -w '%{http_code}' <asset-url>` → `200`) — a draft's assets 404.

## 3. Site downloads page

Add `src/content/releases/X.Y.Z.md` in the **site** repo, mirroring the previous release's file. `downloads.astro` auto-promotes the newest `status: published` entry (by date) to the front-page download, so once this merges it becomes the default download. Required frontmatter: `date`, `version`, `channel` (`beta`|`stable`), `status: published`, `summary` (≥20 chars), `highlights[]`, and `assets[]` — each asset `{ platform: mac|windows|linux, label, href }`. The six standard asset URLs follow the fixed electron-builder naming (verify against the prior release's file):
- `…/releases/download/vX.Y.Z/Brainstorm-X.Y.Z-arm64.dmg` (mac Apple silicon)
- `…/Brainstorm-X.Y.Z.dmg` (mac Intel)
- `…/Brainstorm-Setup-X.Y.Z.exe` (Windows)
- `…/Brainstorm-X.Y.Z-x86_64.AppImage`, `…-arm64.AppImage`, `…-amd64.deb` (Linux)

Verify each `href` returns `200` before pushing — a wrong link ships a broken download. See [[update-downloads-site-on-release]].

## Order of operations when cutting a release

1. Write the **in-app changelog** entry (§1), PR, **merge to main**.
2. Bump version, tag `-a vX.Y.Z` with a summary message, push the tag.
3. CI builds, signs, and — via `finalize` — publishes the release with generated notes (§2).
4. Add the **site** entry (§3) once assets exist; verify URLs.

Skipping step 1 before step 2 is the bug that leaves the app showing old notes. Related: [[pre-push-gate-full-test]], [[test-ci-without-burning-tags]].
