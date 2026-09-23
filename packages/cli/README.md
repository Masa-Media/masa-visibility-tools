# masa-audit

Audit any URL for **SEO, GEO / AI-visibility, structured data, hreflang and AI-crawler access** — straight from your terminal. By **[Masa Media Digital LTD](https://masamedia.co.il)**.

## Run without installing

```bash
npx @masamedia/audit-cli https://example.com
```

## Install

```bash
npm install -g @masamedia/audit-cli
masa-audit https://example.com
```

## Examples

```bash
masa-audit example.com                 # full report
masa-audit https://example.com --ai-only   # just the AI-crawler (GEO) table
masa-audit https://example.com --json > report.json
```

Sample output:

```
Masa Media web audit  https://example.com
Score 95/100   status 200

Title        Example Domain  [14]
Indexable    yes
H1           Example Domain
Schema       (none)
...

AI crawlers (GEO)
  GPTBot              allowed
  ClaudeBot           allowed
  PerplexityBot       blocked
  Google-Extended     allowed
```

## Options

| Flag | Meaning |
|------|---------|
| `--json` | Full report as JSON (for pipelines / CI) |
| `--ai-only` | Only the AI-crawler access table |
| `--no-robots` | Skip fetching robots.txt |
| `--timeout <ms>` | Request timeout (default 15000) |
| `-h`, `--help` | Help |

## Exit codes

`0` clean · `2` fetch failed · `3` at least one error-level finding — so you can gate a deploy:

```bash
masa-audit "$DEPLOY_URL" --json > audit.json || echo "audit found blocking issues"
```

Built on [`@masamedia/audit-core`](https://www.npmjs.com/package/@masamedia/audit-core). It fetches only the URL you give it and its `robots.txt`; nothing is sent anywhere else.

## License

MIT © Masa Media Digital LTD
