# AGENTS.md

Instructions for AI coding agents working in this repository.

## What this is

Open-source SEO and GEO tooling by Masa Media Digital LTD (https://www.masamedia.co.il). One audit engine, several surfaces:

- `packages/audit-core` (`@masamedia/audit-core`): the framework-free engine. It does no network I/O of its own: callers fetch, it analyses.
- `packages/cli` (`@masamedia/audit-cli`, the `masa-audit` command): audits a URL from the terminal.
- `apps/browser-extension`, `apps/vscode`, `wordpress/masa-ai-crawler-control`, `google-apps-script/masa-visibility-toolkit`: products built on the same engine.

## Commands

```bash
pnpm install
pnpm build       # build every package
pnpm test        # vitest in every package
pnpm typecheck   # tsc --noEmit
```

Run the CLI after a build: `node packages/cli/dist/index.js <url> [--json] [--ai-only]`.

## Rules

- Fix a check once, in `audit-core`; every surface picks it up. Do not duplicate check logic in an app.
- Every finding needs a stable `id`, a `severity` and a `category`. Changing an existing id is a breaking change.
- Keep `audit-core` free of network calls, telemetry and framework dependencies.
- Add or update a test in `packages/audit-core/src/core.test.ts` with every change to a check.

## Agent plugin

`plugin.json`, `mcp.json` and `skills/` make this repository an Agent Plugin (https://agent-plugins.org): the `masa-web-audit` skill runs the CLI, and `mcp.json` connects Masa Media's read-only MCP server.
