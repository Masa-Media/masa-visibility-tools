# masa-audit

Audit any URL from the terminal: SEO basics, indexability, AI-crawler access (GEO), structured data and hreflang. A free tool from [Masa Media](https://www.masamedia.co.il), an Israeli SEO and GEO agency.

## Run without installing

```bash
npx @masamedia/audit-cli https://example.com
```

## Install

```bash
npm install -g @masamedia/audit-cli
masa-audit https://example.com
```

Needs Node.js 20 or later.

## Examples

```bash
masa-audit example.com                      # full report
masa-audit https://example.com --ai-only    # only the AI-crawler (GEO) table
masa-audit https://example.com --json > report.json
```

Output of `masa-audit example.com` (30 September 2026, AI-crawler rows shortened):

```
Masa Media web audit  https://example.com/
Score 83/100   status 200

Title        Example Domain  [14]
Description  (none)
Canonical    (none)
Indexable    yes
H1           (none)
Headings     (none)
Images       0 total, all with alt
Links        0 internal, 1 external
Schema       (none)
Open Graph   (none)
hreflang     (none)

AI crawlers (GEO)  no robots.txt, so all are allowed
  GPTBot              allowed
  OAI-SearchBot       allowed
  ClaudeBot           allowed
  PerplexityBot       allowed
  Google-Extended     allowed
  ...

Findings
  ✗ [seo] No H1 on the page.
  ! [seo] No meta description.
  · [seo] No canonical link.
  · [social] No og:title; social shares may look poor.
  · [schema] No JSON-LD structured data found.
```

The tool audits the address the page ends up at after redirects, and reads that site's robots.txt for the page's own path.

## Options

| Flag | Meaning |
|------|---------|
| `--json` | The full report as JSON (for scripts and CI) |
| `--ai-only` | Only the AI-crawler access table |
| `--no-robots` | Don't fetch robots.txt |
| `--timeout <ms>` | Request timeout (default 15000) |
| `-v`, `--version` | Print the version |
| `-h`, `--help` | Help |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | No error-level findings |
| `1` | Usage error (no URL, unknown option, or not an http/https address) |
| `2` | The page could not be fetched |
| `3` | At least one error-level finding, such as noindex, an HTTP error or a missing H1 |

So you can use it as a check after a deploy:

```bash
masa-audit "$DEPLOY_URL" --json > audit.json || echo "audit found blocking issues"
```

## Privacy

It fetches only the URL you give it and that site's `robots.txt`, with the user-agent `MasaAudit/<version> (+https://www.masamedia.co.il)`. Nothing is sent anywhere else. It is built on [`@masamedia/audit-core`](https://www.npmjs.com/package/@masamedia/audit-core).

## License

MIT © Masa Media Digital LTD
