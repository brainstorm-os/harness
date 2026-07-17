# Dogfood sessions — index

> **Generated** by `tools/dogfood-sessions-index.mjs` from the spec filenames in
> this directory. Do not hand-edit; run `bun tools/dogfood-sessions-index.mjs`.

The dogfood "session number" is the leading integer of each spec filename. It is a
loose ordering prefix, **not** a clean sequence. A number used by more than one spec is
marked `×N` in the manifest; there are two reasons a number is shared:

- **Accidental two-arc collisions: 011–028.** A "Mira build-the-business" narrative arc
  and an app-sweep / probe arc both numbered from 011, so each of 011–028 has two
  unrelated specs. They are **left in place** — renaming would break the slug references
  in `docs/dogfood/friction-log.md`; this index is how you disambiguate them.
- **Deliberate themed sweeps: e.g. 228 (×20), 332.** One number reserved for a cohort of
  related specs (`228-deep-mailbox`, `228-deep-agent`, …). That is allowed.

The two cases look identical from filenames, so the manifest just reports `×N`; use the
slugs to tell which is which.

## Go-forward rule (the fix for the divergence)

1. **A new dogfood session takes the next integer: `904`.** Never reuse an
   existing number for an unrelated session.
2. **A single themed sweep may group multiple specs under one reserved number** using
   `NNN-<topic>-<facet>.spec.ts` naming (the `228` pattern). Reserve the number once.
3. Regenerate this index in the same change (`bun tools/dogfood-sessions-index.mjs`).

## Manifest

- **Total spec files:** 404
- **Distinct session numbers:** 311
- **Highest number:** 903 → **next session = 904**
- **Numbers shared by >1 spec (`×N`):** 55

| Session | Spec file(s) |
| ------- | ------------ |
| 001 | `001-day-one.spec.ts` |
| 002 | `002-build-the-business.spec.ts` |
| 003 | `003-journal-fix-check.spec.ts` |
| 004 | `004-new-note-focus-check.spec.ts` |
| 005 | `005-add-task-button-check.spec.ts` |
| 006 | `006-crm-collection-check.spec.ts` |
| 007 | `007-collection-columns-check.spec.ts` |
| 008 | `008-small-fixes-check.spec.ts` |
| 009 | `009-mira-workday.spec.ts` |
| 010 | `010-tidy-vault.spec.ts` |
| 011 ×2 | `011-files-universal-browser-check.spec.ts`<br>`011-mira-builds-crm.spec.ts` |
| 012 ×2 | `012-all-apps-smoke.spec.ts`<br>`012-mira-expands.spec.ts` |
| 013 ×2 | `013-files-cross-app.spec.ts`<br>`013-probe.spec.ts` |
| 014 ×2 | `014-bookmark-add.spec.ts`<br>`014-notes-deep.spec.ts` |
| 015 ×2 | `015-name-client.spec.ts`<br>`015-shell-dashboard.spec.ts` |
| 016 ×2 | `016-rename-via-inspector.spec.ts`<br>`016-shell-search-bin-settings.spec.ts` |
| 017 ×2 | `017-rename-client-inline.spec.ts`<br>`017-shell-search-content.spec.ts` |
| 018 ×2 | `018-database-deep.spec.ts`<br>`018-flesh-out-crm.spec.ts` |
| 019 ×2 | `019-calendar-deep.spec.ts`<br>`019-column-name-check.spec.ts` |
| 020 ×2 | `020-set-client-status.spec.ts`<br>`020-whiteboard-deep.spec.ts` |
| 021 ×2 | `021-remaining-apps-probe.spec.ts`<br>`021-status-cell-probe.spec.ts` |
| 022 ×2 | `022-dark-mode-sweep.spec.ts`<br>`022-inspector-label-check.spec.ts` |
| 023 ×2 | `023-tasks-nav.spec.ts`<br>`023-track-deal-size.spec.ts` |
| 024 ×2 | `024-currency-render-check.spec.ts`<br>`024-plural-scan.spec.ts` |
| 025 ×2 | `025-currency-cell-probe.spec.ts`<br>`025-database-cell-edit.spec.ts` |
| 026 ×2 | `026-currency-inspector-entry.spec.ts`<br>`026-dashboard-pin.spec.ts` |
| 027 ×2 | `027-clipboard-cross-app.spec.ts`<br>`027-number-cell-lifecycle.spec.ts` |
| 028 ×2 | `028-deeplink-open.spec.ts`<br>`028-fresh-number-cell.spec.ts` |
| 029 | `029-currency-end-to-end.spec.ts` |
| 030 | `030-tidy-after-currency.spec.ts` |
| 031 | `031-remove-column-cleanup.spec.ts` |
| 032 | `032-last-contact-date.spec.ts` |
| 033 | `033-run-the-pipeline.spec.ts` |
| 034 | `034-sort-menu-label.spec.ts` |
| 035 | `035-schedule-followup.spec.ts` |
| 036 | `036-research-note.spec.ts` |
| 037 | `037-tidy-untitled-notes.spec.ts` |
| 038 | `038-schedule-meeting.spec.ts` |
| 039 | `039-capture-source.spec.ts` |
| 040 | `040-filter-pipeline.spec.ts` |
| 041 | `041-apply-status-filter.spec.ts` |
| 042 | `042-filter-select-by-label.spec.ts` |
| 043 | `043-organize-files.spec.ts` |
| 044 | `044-complete-task.spec.ts` |
| 045 | `045-pipeline-total.spec.ts` |
| 046 | `046-global-search.spec.ts` |
| 047 | `047-notes-search.spec.ts` |
| 048 | `048-pipeline-kanban.spec.ts` |
| 049 | `049-clients-gallery.spec.ts` |
| 050 | `050-review-schedule.spec.ts` |
| 051 | `051-tidy-tasks.spec.ts` |
| 052 | `052-prep-vertex-call.spec.ts` |
| 053 | `053-blank-note-no-cover.spec.ts` |
| 054 | `054-schedule-followup.spec.ts` |
| 055 | `055-pin-to-dashboard.spec.ts` |
| 056 | `056-note-icon.spec.ts` |
| 057 | `057-reading-list.spec.ts` |
| 058 | `058-find-in-note.spec.ts` |
| 059 | `059-nav-back-forward.spec.ts` |
| 060 | `060-note-property.spec.ts` |
| 061 | `061-whiteboard-sticky.spec.ts` |
| 062 | `062-bookmark-mark-read.spec.ts` |
| 063 | `063-investor-brief.spec.ts` |
| 064 | `064-operating-hub.spec.ts` |
| 065 | `065-content-calendar.spec.ts` |
| 066 | `066-editorial-pipeline.spec.ts` |
| 067 | `067-fill-pipeline.spec.ts` |
| 068 | `068-files-structure.spec.ts` |
| 069 | `069-weekly-cadence.spec.ts` |
| 070 | `070-weekly-review.spec.ts` |
| 071 | `071-journal-daily-log.spec.ts` |
| 072 | `072-tidy-vault.spec.ts` |
| 073 | `073-publishing-schedule.spec.ts` |
| 074 | `074-reading-list.spec.ts` |
| 075 | `075-strategy-board.spec.ts` |
| 076 | `076-monthly-review.spec.ts` |
| 077 | `077-week-view.spec.ts` |
| 078 | `078-archive-bookmark.spec.ts` |
| 079 | `079-agenda-view.spec.ts` |
| 080 | `080-task-to-project.spec.ts` |
| 082 | `082-draft-issue1.spec.ts` |
| 083 | `083-pipeline-board.spec.ts` |
| 084 | `084-filter-pipeline.spec.ts` |
| 085 | `085-sort-pipeline.spec.ts` |
| 086 | `086-clients-gallery.spec.ts` |
| 087 | `087-calendar-view.spec.ts` |
| 088 | `088-property-names-fix.spec.ts` |
| 089 | `089-designer-role-brief.spec.ts` |
| 090 | `090-candidates-pipeline.spec.ts` |
| 091 | `091-candidate-stages.spec.ts` |
| 092 | `092-hiring-board.spec.ts` |
| 093 | `093-design-review-database.spec.ts` |
| 094 | `094-design-review-notes.spec.ts` |
| 095 | `095-design-review-calendar.spec.ts` |
| 096 | `096-design-review-tasks.spec.ts` |
| 097 | `097-design-review-whiteboard.spec.ts` |
| 098 | `098-f044-sticky-placeholder.spec.ts` |
| 099 | `099-designer-scorecard.spec.ts` |
| 100 ×2 | `100-designer-hired.spec.ts`<br>`100-pitch-screenshots.spec.ts` |
| 101 | `101-marcus-verify-fixes.spec.ts` |
| 102 | `102-brand-system-kickoff.spec.ts` |
| 103 ×2 | `103-issue-1-draft.spec.ts`<br>`103-pitch-dashboard.spec.ts` |
| 104 | `104-research-and-bookmarks.spec.ts` |
| 105 | `105-marcus-editor-journal.spec.ts` |
| 106 | `106-verify-batch.spec.ts` |
| 107 | `107-recurring-cadence.spec.ts` |
| 108 | `108-verify-warroom.spec.ts` |
| 109 | `109-verify-medium.spec.ts` |
| 110 | `110-running-the-numbers.spec.ts` |
| 111 | `111-advisory-engagement.spec.ts` |
| 112 | `112-working-with-marcus.spec.ts` |
| 113 | `113-research-to-issue.spec.ts` |
| 114 | `114-link-research.spec.ts` |
| 115 | `115-engagement-model.spec.ts` |
| 116 | `116-verify-inspector-close.spec.ts` |
| 117 | `117-build-engagement-model.spec.ts` |
| 118 | `118-marcus-database-review.spec.ts` |
| 119 | `119-mira-week-plan.spec.ts` |
| 120 | `120-mira-close-the-day.spec.ts` |
| 121 | `121-priya-craft-trial.spec.ts` |
| 122 | `122-mira-standup-handoff.spec.ts` |
| 123 | `123-priya-beacon-onepager.spec.ts` |
| 124 | `124-marcus-notes-review.spec.ts` |
| 125 | `125-mira-beacon-active.spec.ts` |
| 126 | `126-marcus-bookmarks-review.spec.ts` |
| 127 | `127-priya-issue-3-draft.spec.ts` |
| 128 | `128-mira-hub-check.spec.ts` |
| 129 | `129-marcus-calendar-review.spec.ts` |
| 130 | `130-priya-graph-audit.spec.ts` |
| 133 | `133-verify-f067.spec.ts` |
| 134 | `134-marcus-whiteboard-review.spec.ts` |
| 135 | `135-priya-synthesis-links.spec.ts` |
| 136 | `136-mira-weekly-review.spec.ts` |
| 137 | `137-marcus-files-review.spec.ts` |
| 138 | `138-priya-content-calendar.spec.ts` |
| 139 | `139-mira-candidates-pipeline.spec.ts` |
| 140 | `140-marcus-tasks-review.spec.ts` |
| 141 | `141-marcus-dashboard-icons.spec.ts` |
| 142 | `142-priya-competitive-note.spec.ts` |
| 143 | `143-mira-workspace-open.spec.ts` |
| 144 | `144-marcus-database-recheck.spec.ts` |
| 145 | `145-priya-research-index.spec.ts` |
| 146 | `146-mira-running-numbers.spec.ts` |
| 147 | `147-marcus-property-cells.spec.ts` |
| 148 | `148-priya-findability.spec.ts` |
| 149 | `149-mira-hub-regression.spec.ts` |
| 150 | `150-marcus-dashboard-grid.spec.ts` |
| 151 | `151-priya-journal-shared-editor.spec.ts` |
| 152 | `152-mira-task-shared-editor.spec.ts` |
| 153 | `153-marcus-editor-consistency.spec.ts` |
| 154 | `154-mira-task-notes-roundtrip.spec.ts` |
| 155 | `155-priya-journal-knowledge.spec.ts` |
| 156 | `156-marcus-verify-f070-descriptions.spec.ts` |
| 157 | `157-priya-journal-reference.spec.ts` |
| 158 | `158-priya-verify-single-menu.spec.ts` |
| 159 | `159-priya-reference-roundtrip.spec.ts` |
| 160 | `160-mira-task-reference-card.spec.ts` |
| 161 | `161-verify-outstanding-fixes.spec.ts` |
| 170 | `170-windows-and-tabs.spec.ts` |
| 171 | `171-marcus-window-chrome.spec.ts` |
| 172 | `172-priya-live-embeds.spec.ts` |
| 173 | `173-mira-tabs-and-embeds.spec.ts` |
| 174 | `174-mira-agent-local-model.spec.ts` |
| 175 ×2 | `175-files-breadcrumbs-check.spec.ts`<br>`175-mira-contacts-first-run.spec.ts` |
| 176 ×2 | `176-files-folder-appearance.spec.ts`<br>`176-marcus-contacts-design-review.spec.ts` |
| 177 ×2 | `177-code-editor-syntax-theme.spec.ts`<br>`177-priya-contacts-knowledge.spec.ts` |
| 178 ×2 | `178-mira-contacts-fix-check.spec.ts`<br>`178-mira-notes-b11-fields.spec.ts` |
| 179 ×2 | `179-mira-link-contacts.spec.ts`<br>`179-mira-mention-and-emoji.spec.ts` |
| 180 ×2 | `180-mira-bulk-color.spec.ts`<br>`180-priya-picker-candidates.spec.ts` |
| 181 ×2 | `181-agent-app-review.spec.ts`<br>`181-tasks-detail-polish.spec.ts` |
| 182 | `182-contacts-depth.spec.ts` |
| 183 | `183-header-parity.spec.ts` |
| 184 | `184-mira-create-company.spec.ts` |
| 185 | `185-mira-weekly-cadence.spec.ts` |
| 186 | `186-marcus-tasks-detail-review.spec.ts` |
| 187 | `187-mira-team-roster.spec.ts` |
| 188 | `188-priya-issue4-outline.spec.ts` |
| 189 | `189-priya-findability-audit.spec.ts` |
| 190 | `190-marcus-graph-design-review.spec.ts` |
| 191 | `191-shared-inline-toolbar.spec.ts` |
| 192 | `192-mira-commercial-spine-tour.spec.ts` |
| 193 | `193-mira-browser-loads.spec.ts` |
| 194 | `194-priya-browser-research-instrument.spec.ts` |
| 195 | `195-mira-automations-run.spec.ts` |
| 196 | `196-mira-people-first-class.spec.ts` |
| 197 | `197-verify-blank-note-discard.spec.ts` |
| 198 | `198-fix-batch-verify.spec.ts` |
| 199 | `199-assignee-picker-probe.spec.ts` |
| 200 ×3 | `200-team-owns-the-week.spec.ts`<br>`200c-comment-review-retry.spec.ts`<br>`200d-services-probe.spec.ts` |
| 202 | `202-read-week-by-person.spec.ts` |
| 203 | `203-assignee-graph-edge.spec.ts` |
| 204 | `204-priya-clips-a-source.spec.ts` |
| 205 ×5 | `205-mira-strategy-board-v2.spec.ts`<br>`205b-edge-style-probe.spec.ts`<br>`205c-edge-style-probe2.spec.ts`<br>`205d-rename-probe.spec.ts`<br>`205e-typing-probe.spec.ts` |
| 206 ×3 | `206-priya-reading-room.spec.ts`<br>`206b-priya-bookmark-metadata.spec.ts`<br>`206c-priya-value-click.spec.ts` |
| 207 | `207-marcus-new-surfaces-review.spec.ts` |
| 208 | `208-mira-content-views.spec.ts` |
| 209 ×2 | `209-mira-web-research.spec.ts`<br>`209b-probe-browser-restore.spec.ts` |
| 210 ×3 | `210-mira-data-views.spec.ts`<br>`210b-probe-embed-timeline-link.spec.ts`<br>`210c-probe-timeline-linkdrag.spec.ts` |
| 211 ×2 | `211-priya-studio-tools.spec.ts`<br>`211b-probe-code-editor.spec.ts` |
| 212 ×4 | `212-mira-hires-ops.spec.ts`<br>`212b-mira-hiring-fixup.spec.ts`<br>`212c-mira-pipeline-cleanup.spec.ts`<br>`212d-mira-names-candidates.spec.ts` |
| 213 ×2 | `213-dana-day-one.spec.ts`<br>`213b-dana-wires-renewal.spec.ts` |
| 214 | `214-marcus-design-audit.spec.ts` |
| 215 ×4 | `215-kai-fix-verification.spec.ts`<br>`215b-probe-browser-page-paints.spec.ts`<br>`215b-probe-embed-theme.spec.ts`<br>`215c-probe-browser-boot-state.spec.ts` |
| 216 | `216-marcus-token-normalization.spec.ts` |
| 217 | `217-marcus-checkbox-and-thememenu.spec.ts` |
| 218 | `218-marcus-polish-verify.spec.ts` |
| 219 | `219-marcus-notes-export.spec.ts` |
| 220 | `220-marcus-db-name-and-exports.spec.ts` |
| 221 | `221-cover-consistency.spec.ts` |
| 222 ×2 | `222-broad-visual-sweep.spec.ts`<br>`222-marcus-form-designer.spec.ts` |
| 223 | `223-notes-functional.spec.ts` |
| 227 | `227-functional-sweep.spec.ts` |
| 228 ×20 | `228-deep-agent.spec.ts`<br>`228-deep-automations.spec.ts`<br>`228-deep-bookmarks.spec.ts`<br>`228-deep-books.spec.ts`<br>`228-deep-browser.spec.ts`<br>`228-deep-calendar.spec.ts`<br>`228-deep-code-editor.spec.ts`<br>`228-deep-contacts.spec.ts`<br>`228-deep-database.spec.ts`<br>`228-deep-files.spec.ts`<br>`228-deep-form-designer.spec.ts`<br>`228-deep-graph.spec.ts`<br>`228-deep-journal.spec.ts`<br>`228-deep-mailbox.spec.ts`<br>`228-deep-notes.spec.ts`<br>`228-deep-preview.spec.ts`<br>`228-deep-tasks.spec.ts`<br>`228-deep-theme-editor.spec.ts`<br>`228-deep-whiteboard.spec.ts`<br>`228-rightpanel-rollout.spec.ts` |
| 229 ×2 | `229-contacts-page-probe.spec.ts`<br>`229-verify-fixes.spec.ts` |
| 230 | `230-probe-bookmark-url.spec.ts` |
| 231 | `231-verify-fleet.spec.ts` |
| 232 | `232-verify-fleet-b.spec.ts` |
| 233 | `233-verify-files-pdf.spec.ts` |
| 234 | `234-verify-f236.spec.ts` |
| 235 | `235-mira-operating-hub.spec.ts` |
| 236 | `236-priya-evidence-brief.spec.ts` |
| 237 | `237-dana-operations-system.spec.ts` |
| 238 | `238-marcus-brand-system.spec.ts` |
| 239 | `239-fresh-design-sweep.spec.ts` |
| 240 | `240-verify-empty-more.spec.ts` |
| 241 | `241-deep-interactions.spec.ts` |
| 242 ×2 | `242-journal-persistence.spec.ts`<br>`242-shell-elements-sweep.spec.ts` |
| 243 | `243-notes-persistence.spec.ts` |
| 244 | `244-right-panel-sweep.spec.ts` |
| 245 | `245-verify-double-header.spec.ts` |
| 247 | `247-notion-import.spec.ts` |
| 248 | `248-books-epub.spec.ts` |
| 249 | `249-files-inspector-properties.spec.ts` |
| 251 | `251-relation-picker-titles.spec.ts` |
| 300 | `300-probe-slash-menu.spec.ts` |
| 301 ×2 | `301-probe-manage-values.spec.ts`<br>`301-probe-mention-transclusion.spec.ts` |
| 302 | `302-credfree-functional-sweep.spec.ts` |
| 303 | `303-deep-functional-verify.spec.ts` |
| 304 | `304-deep-functional-verify-2.spec.ts` |
| 305 | `305-deep-functional-verify-3.spec.ts` |
| 306 | `306-journal-persistence-verify.spec.ts` |
| 307 | `307-journal-link-entry-verify.spec.ts` |
| 308 | `308-deep-functional-verify-4.spec.ts` |
| 309 ×2 | `309-polish-verify.spec.ts`<br>`309b-whiteboard-nav-verify.spec.ts` |
| 310 | `310-widgets-7.3a.spec.ts` |
| 311 ×3 | `311-journal-rollup-blank.spec.ts`<br>`311-probe-runtime-pickers.spec.ts`<br>`311-sol-interaction-a11y-sweep.spec.ts` |
| 312 | `312-notes-switch-blank.spec.ts` |
| 313 | `313-chat-northbound.spec.ts` |
| 314 | `314-probe-bookmarks-react.spec.ts` |
| 315 | `315-probe-tasks-react.spec.ts` |
| 316 | `316-composer-context.spec.ts` |
| 317 | `317-widgets-iframe.spec.ts` |
| 320 ×2 | `320-deep-today.spec.ts`<br>`320-verify-menu-widget-fixes.spec.ts` |
| 321 | `321-interaction-sweep.spec.ts` |
| 322 | `322-column-resize.spec.ts` |
| 323 | `323-editor-block-sweep.spec.ts` |
| 324 | `324-chat-composer-verify.spec.ts` |
| 325 | `325-chat-roster-mention.spec.ts` |
| 326 | `326-collab-c6-whole-system.spec.ts` |
| 327 | `327-composer-resize-measure.spec.ts` |
| 328 ×2 | `328-every-button-sweep.spec.ts`<br>`328b-files-sort-dismiss.spec.ts` |
| 329 ×2 | `329-business-wishlist-readiness.spec.ts`<br>`329b-readiness-clickthrough.spec.ts` |
| 330 ×2 | `330-invoice-pdf.spec.ts`<br>`330-settings-polish-sweep.spec.ts` |
| 331 | `331-formula-property.spec.ts` |
| 332 ×3 | `332-glass-blur-eyeball.spec.ts`<br>`332-tasks-detail-close-no-stale-node.spec.ts`<br>`332-welcome-2-first-launch.spec.ts` |
| 333 ×2 | `333-f272-resize-ring-verify.spec.ts`<br>`333-settings-frost-in.spec.ts` |
| 334 | `334-new-logic-design-sweep.spec.ts` |
| 335 | `335-broadcast-and-lock-reverify.spec.ts` |
| 336 | `336-design-eyeball-walk.spec.ts` |
| 337 ×3 | `337-design-polish-sweep.spec.ts`<br>`337b-empty-cta-verify.spec.ts`<br>`337c-polish-batch-verify.spec.ts` |
| 338 ×2 | `338-empty-state-extraction.spec.ts`<br>`338-notes-share-dialog.spec.ts` |
| 339 | `339-cross-app-consistency.spec.ts` |
| 340 | `340-full-product-verify.spec.ts` |
| 342 | `342-deep-crud-verify.spec.ts` |
| 343 | `343-delete-lifecycle.spec.ts` |
| 344 | `344-database-lifecycle.spec.ts` |
| 345 | `345-delete-affordance-sweep.spec.ts` |
| 346 | `346-calendar-nav-no-setstate-warning.spec.ts` |
| 347 | `347-priya-knowledge-integrity.spec.ts` |
| 348 | `348-mira-structured-doc-reopen.spec.ts` |
| 349 | `349-mira-builds-automation.spec.ts` |
| 350 | `350-marcus-agent-design-review.spec.ts` |
| 351 | `351-mira-mailbox-connect.spec.ts` |
| 352 | `352-mira-browser-chrome.spec.ts` |
| 353 | `353-inline-toolbar-lock-and-align.spec.ts` |
| 354 | `354-journal-lock.spec.ts` |
| 355 ×2 | `355-code-editor-lock.spec.ts`<br>`355-highlight-palette.spec.ts` |
| 356 | `356-whiteboard-lock.spec.ts` |
| 357 | `357-tasks-lock.spec.ts` |
| 358 | `358-calendar-lock.spec.ts` |
| 359 | `359-database-lock.spec.ts` |
| 360 | `360-bookmarks-lock.spec.ts` |
| 361 | `361-property-editing-consistency.spec.ts` |
| 362 | `362-journal-first-char.spec.ts` |
| 363 | `363-empty-state-verify.spec.ts` |
| 365 | `365-calendar-status-select.spec.ts` |
| 366 | `366-tasks-empty-state.spec.ts` |
| 367 | `367-files-destination-picker.spec.ts` |
| 368 | `368-marcus-design-system-audit.spec.ts` |
| 369 | `369-files-control-face-verify.spec.ts` |
| 370 | `370-polish-r2-verify.spec.ts` |
| 371 | `371-inspector-no-collections-verify.spec.ts` |
| 372 ×2 | `372-agent-dynamic-context-qwen.spec.ts`<br>`372-drag-grip-gutter-verify.spec.ts` |
| 373 | `373-focus-frame-audit.spec.ts` |
| 374 ×5 | `374-a11y-name-audit.spec.ts`<br>`374-bin-purge-repro.spec.ts`<br>`374b-bin-empty-persistence.spec.ts`<br>`374c-bin-keyboard-multiselect.spec.ts`<br>`374d-bin-reactivity-repro.spec.ts` |
| 375 ×4 | `375-a11y-contrast-audit.spec.ts`<br>`375-widgets-dogfood.spec.ts`<br>`375b-widgets-probe.spec.ts`<br>`375c-widgets-fixes-verify.spec.ts` |
| 377 | `377-inline-mentions.spec.ts` |
| 900 | `900-dbv-list-probe.spec.ts` |
| 901 | `901-notes-select-placeholder.spec.ts` |
| 902 | `902-notes-all-blocks.spec.ts` |
| 903 | `903-recent-ship-sweep.spec.ts` |

### Unparsed (non-conforming filenames)

- `site-app-screenshots.spec.ts`
- `site-screenshots.spec.ts`
