---
name: masa-web-audit
description: Audits one web page for technical SEO and GEO with the masa-audit CLI - indexability, canonical, headings, structured data, Open Graph, hreflang, image alt text, links and which AI crawlers robots.txt lets in. Use when a user asks why a page may not rank in Google or be cited by AI assistants, or wants a quick technical check of a URL.
license: MIT
metadata:
  author: Masa Media Digital LTD
  homepage: https://www.masamedia.co.il/developers/
---

# Masa web audit

Runs the `masa-audit` command-line tool from this repository against a URL and explains the result.

## Run it

From the repository root (Node 18+ and pnpm):

```bash
pnpm install
pnpm build
node packages/cli/dist/index.js https://example.com --json
```

Other options: `--ai-only` prints only the AI-crawler table, `--no-robots` skips robots.txt, `--timeout <ms>` sets the request timeout (default 15000).

## Read the result

The JSON report has these top-level fields: `httpStatus`, `title`, `metaDescription`, `canonical`, `robotsMeta`, `indexable` (with `reasons` when it is not), `headings`, `schema` (JSON-LD blocks, their types and validity), `openGraph`, `twitter`, `hreflang`, `images` (missing and empty alt text), `links`, `ai` (per AI crawler: `allowed`, `partial` or `blocked`, read from robots.txt), `findings` and `score`.

- Start with `indexable`: if it is false, the `reasons` explain why the page cannot appear in search at all.
- Then `findings`: each has a stable `id`, a `severity` and a `category`. Report the errors first, then the warnings.
- For GEO questions, look at `ai`: `blocked` means that crawler may not read the page; `partial` means robots.txt blocks some paths of the site but not necessarily this one.
- `score` summarises by category; explain the findings behind it rather than quoting the number alone.

## Limits

The tool reads one page and its robots.txt. It does not measure rankings, traffic or page speed, and it does not render JavaScript. For content questions about Masa Media itself (services, prices, Hebrew SEO guides), use the MCP server in `mcp.json`.
