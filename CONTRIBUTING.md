# Contributing to Brainstorm

This is a brief entry point. The canonical reference is [`docs/foundations/35-code-conventions.md`](docs/foundations/35-code-conventions.md).

## Before you write code

1. Read the relevant design doc(s). Start at [`docs/00-index.md`](docs/00-index.md) for the reading order.
2. If your change requires a design-doc update, do that first.
3. Open or reference an existing OQ in [`docs/reference/11-open-questions.md`](docs/reference/11-open-questions.md) for non-trivial decisions.

## Quick reference

- **Files:** `kebab-case`. **Components / types:** `PascalCase`. **Functions / variables:** `camelCase`. **Constants:** `SCREAMING_SNAKE_CASE`.
- **Imports:** external → `@brainstorm/*` → workspace → relative; alphabetical within groups.
- **Tests:** alongside source as `*.test.ts(x)`. Coverage floors: 85% shell, 80% SDK, 70% first-party apps.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, …).
- **Branches:** trunk-based; `feature/<short-name>` for short-lived work.
- **PR template:** capability changes, localization, tests, performance, breaking changes — see [35-code-conventions.md](docs/foundations/35-code-conventions.md#git-and-contribution).

## Required compliance

- **Every user-facing string** goes through `t()` (per [21-localization.md](docs/platform/21-localization.md)).
- **Bundle-size budgets** are enforced via `size-limit` (per [13-frontend-stack.md](docs/shell/13-frontend-stack.md)).
- **Accessibility:** `react-aria` for non-menu primitives.
- **Crypto routing:** only via the credential store (per [29-credentials-storage.md](docs/security/29-credentials-storage.md)).
- **Capability declarations:** every host-service call needs a manifest-declared capability (per [09-security-and-sandbox.md](docs/security/09-security-and-sandbox.md)).
- **Personal-by-default:** customizations default to `user` scope (per Vision Principle 9).

## Tooling

- **Bun workspaces** (or pnpm — see OQ-151) for the monorepo.
- **Biome** for lint + format.
- **TypeScript** with `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Vite + Rollup** for build.
- **Vitest** for unit and component tests.
- **Playwright** for E2E.

## Dev MCP server

From Stage 0.10 onward, this repo ships an in-tree MCP (Model Context Protocol) server at `tools/mcp-server/` that exposes the implementation plan, OQ ledger, coverage state, size budgets, and i18n checks as MCP resources + tools. Claude Code (and any other MCP-capable assistant) loads it locally — it is **not** a runtime feature of Brainstorm.

See [`docs/implementation-plan.md` → Dev MCP server](docs/implementation-plan.md#dev-mcp-server) for the full design.

### Wire it up (one time per machine)

Add this entry to your `~/.claude/mcp.json` (Claude Code) or the equivalent for your client:

```json
{
  "mcpServers": {
    "brainstorm-dev": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/brainstorm/tools/mcp-server/src/index.ts"]
    }
  }
}
```

Replace `/absolute/path/to/brainstorm` with this repo's checkout path.

### Smoke test

From the repo root:

```sh
bun run mcp:dev        # boots the server on stdio (Ctrl-C to stop)
bun run mcp:build      # bundles to tools/mcp-server/dist/index.js
```

To verify the server responds to an initialize handshake without a client:

```sh
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'; sleep 0.2; echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'; echo '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"plan://status"}}'; sleep 0.3; } | bun run mcp:dev
```

You should see two JSON-RPC responses: a server `initialize` ack and the status snapshot as a JSON document.

### What's available

- Resources: `plan://status`, `plan://stage/<n>`, `plan://iteration/<n.m>`, `oq://OQ-<n>`, `doc://<slug>`, `package://<name>`.
- Tools:
  - **Audit**: `audit.test_run`, `audit.typecheck`, `audit.lint`, `coverage.check`, `size.check`, `i18n.find_bare_strings`.
  - **Plan / OQ read**: `plan.list_iterations`, `oq.list` (search-friendly companions to the `plan://` / `oq://` resources).
  - **Plan / OQ write**: `plan.update_iteration`, `plan.mark_oq_resolved` — the canonical path for editing `implementation-plan.md` + `11-open-questions.md` (raw markdown edits to those files are PR-rejected).
  - **Vault**: `vault.seed_demo`.

### Seeding a vault with demo data

`vault.seed_demo` writes a coherent multi-note dataset (10 cross-referenced notes) into a target vault. The shell's `vault-entities-service` reads the seeded `kv.json` and surfaces the data through `vaultEntities.list()`, so Notes / Database / Graph all render real entities + links with no further wiring.

Call it from any MCP-capable client, or with a direct JSON-RPC line over stdio:

```sh
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"seed","version":"0"}}}'; sleep 0.2; echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'; echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"vault.seed_demo","arguments":{"vaultPath":"/abs/path/to/your/vault"}}}'; sleep 0.4; } | bun run mcp:dev
```

Idempotent — stable note ids + frozen timestamps mean re-running yields the same files. Pass `dryRun: true` to preview, or `mode: "replace"` to wipe any pre-existing seeded keys.

The `BrainstormProject` seed scope (per [`docs/foundations/49-self-hosting.md`](docs/foundations/49-self-hosting.md)) compiles the real `implementation-plan.md` + `11-open-questions.md` + design docs into typed `Iteration/v1` + `OpenQuestion/v1` + `Stage/v1` + `DesignDoc/v1` rows the Tasks / Database / Notes / Graph apps render natively.

## Reporting bugs / asking questions

For now, open an issue. Once the project is closer to public, contribution guidelines will solidify around a community process.

## Summary

The full conventions live in [`docs/foundations/35-code-conventions.md`](docs/foundations/35-code-conventions.md). This file is the brief landing.
