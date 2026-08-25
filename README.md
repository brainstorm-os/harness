# Brainstorm — design record & dev harness

Brainstorm is a local-first, end-to-end encrypted knowledge workspace: notes,
tasks, databases, whiteboards and more as one data model on your own disk, with
no account required. It is modelled as a desktop OS — an Electron shell hosting
sandboxed apps — and anchors on [Block Protocol](https://blockprotocol.org)
(data interop), [Yjs](https://yjs.dev) (CRDT) and
[Lexical](https://lexical.dev) (rich text).

**The application code lives in [`brainstorm-os/shell`](https://github.com/brainstorm-os/shell).**
This repository is the other half: the written design record that code is built
from, and the harness that exercises it.

## What is in here

| | |
|---|---|
| [`docs/`](docs/) | The design record — ~200 documents. Architecture, the security and capability model, the data model, every app's design, and the [implementation plan](docs/implementation-plan.md) that sequences it. Start at [`docs/00-index.md`](docs/00-index.md). |
| [`tests/dogfood/`](tests/dogfood/) | The dogfood harness. Scripted sessions that drive the real packaged shell as a fictional founder running a business inside it, and record what got in the way in a [friction log](docs/dogfood/friction-log.md). |
| [`tools/`](tools/) | Dev tooling: an MCP server exposing the plan / open questions / coverage checks to an agent, plus the promo-capture pipeline. |
| [`agent-guides/`](agent-guides/) | Per-repo agent instructions for the sibling repositories. |

The docs are the source of truth, not a description written after the fact —
`docs/implementation-plan.md` is parsed by live tests, and several checks in the
shell repo are enforced against rules stated in
[`docs/foundations/35-code-conventions.md`](docs/foundations/35-code-conventions.md).

## What is deliberately not here

A small number of documents are maintained privately and are **not** part of
this record: fundraising material, commercial strategy (monetisation, pricing,
payments architecture), internal launch runbooks and unreleased campaign copy,
credential-procurement notes, and the internal audit trail under
[`docs/_review/`](docs/_review/README.md).

Where the published docs cross-reference one of those, the path is kept with a
short stub explaining the omission, so links still resolve. Nothing published
here depends on their contents.

## Related repositories

- [`shell`](https://github.com/brainstorm-os/shell) — the Electron application, its apps and packages.
- [`site`](https://github.com/brainstorm-os/site) — getbrainstorm.online.
- [`docs`](https://github.com/brainstorm-os/docs) — the user-facing documentation site.
- [`sync`](https://github.com/brainstorm-os/sync) — the sync relay.

The harness expects those checked out as siblings (`../shell`, `../site`, …);
several scripts here drive the shell build directly.

## Licence

[AGPL-3.0-or-later](LICENSE.md), matching the shell repository.
