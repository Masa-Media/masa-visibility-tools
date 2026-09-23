# Masa Visibility Tools

Open developer tooling for **SEO, GEO, AI visibility, SXO, CRO, technical web, search & content intelligence, accessibility, performance and analytics** — by **[Masa Media Digital LTD](https://masamedia.co.il)**.

One shared audit engine, many surfaces: a browser extension, a CLI, a VS Code extension, a WordPress plugin and a Google Sheets add-on all read a page the same way and report the same findings.

## Packages

| Package | What it is | Where it ships |
|---------|-----------|----------------|
| [`@masamedia/audit-core`](packages/audit-core) | The framework-free audit engine (SEO / GEO / schema / a11y / AI crawlers) | npm |
| [`@masamedia/audit-cli`](packages/cli) — `masa-audit` | Audit any URL from the terminal | npm |
| [Masa Search Inspector](apps/browser-extension) | One-click on-page audit + AI-crawler check | Chrome / Edge / Firefox |
| [Masa Web Audit](apps/vscode) | Audit HTML/JSX as you write it | VS Code Marketplace / Open VSX |
| [Masa AI Crawler Control](wordpress/masa-ai-crawler-control) | Manage GPTBot / ClaudeBot / PerplexityBot / Google-Extended access | WordPress.org |
| [Masa Visibility Toolkit](google-apps-script/masa-visibility-toolkit) | `=MASA_TITLE(url)` and friends in Google Sheets | Google Workspace Marketplace |

## Develop

```bash
pnpm install
pnpm build      # build every package
pnpm test       # run the test suites
```

Requires Node 18+ and pnpm.

## Design

- **Local-first.** The engine does no telemetry and no network I/O of its own; callers fetch, it analyses.
- **One core.** Fix a check once in `@masamedia/audit-core` and every product gets it.
- **Real output.** Every finding has a stable id, a severity and a category — no vague scores.

## License

MIT © Masa Media Digital LTD · https://masamedia.co.il
