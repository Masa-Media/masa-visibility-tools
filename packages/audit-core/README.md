# @masamedia/audit-core

Framework-free web-page audit engine by **[Masa Media Digital LTD](https://masamedia.co.il)**.

One small, dependency-light library that reads a page and reports what matters for **SEO, GEO / AI-visibility, structured data, internationalisation, accessibility and social sharing** — the same engine that powers the Masa Search Inspector browser extension, the `masa-audit` CLI, and the Masa VS Code and WordPress tools.

## Install

```bash
npm install @masamedia/audit-core
```

## Use

```ts
import { analyzeHtml } from "@masamedia/audit-core";

const res = await fetch("https://example.com");
const report = analyzeHtml(await res.text(), "https://example.com");

console.log(report.score.overall);      // 0–100
console.log(report.headings.h1);         // ["Example Domain"]
console.log(report.schema.types);        // ["Organization", ...]
console.log(report.findings);            // [{ id, severity, category, message }]
```

In a browser (extension, bookmarklet) pass the **live, rendered** DOM — which is what AI crawlers see once JavaScript runs:

```ts
import { analyzeDocument } from "@masamedia/audit-core";
const report = analyzeDocument(document, location.href);
```

### AI-crawler (GEO) access from robots.txt

```ts
import { parseAiCrawlers } from "@masamedia/audit-core";

const robots = await (await fetch("https://example.com/robots.txt")).text();
parseAiCrawlers(robots).agents;
// { GPTBot: "blocked", ClaudeBot: "allowed", PerplexityBot: "partial", ... }
```

Covers GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended and meta-externalagent.

## What it checks

- **SEO** — title and meta-description presence/length, canonical (and self vs cross), H1 count, heading order, indexability from `meta robots`.
- **GEO / AI visibility** — per-crawler access from robots.txt.
- **Structured data** — every JSON-LD block parsed, `@type`s collected (including `@graph`), invalid blocks flagged.
- **Social** — Open Graph and Twitter card tags.
- **i18n** — `html lang`, hreflang set, `x-default`.
- **Accessibility** — images missing `alt`, heading-level jumps.
- **Links** — internal vs external, external `nofollow`.

Everything comes back as plain JSON — render it however you like.

## Privacy

The library does no network I/O of its own and sends nothing anywhere. You fetch; it analyses locally.

## License

MIT © Masa Media Digital LTD
