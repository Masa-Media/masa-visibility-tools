# @masamedia/audit-core

A web-page audit engine by [Masa Media](https://www.masamedia.co.il), an Israeli SEO and GEO agency. It reads a page's HTML and reports on SEO, AI-crawler access (GEO), structured data, hreflang, accessibility basics and social tags. It is the engine behind the [`masa-audit`](https://www.npmjs.com/package/@masamedia/audit-cli) command-line tool.

## Install

```bash
npm install @masamedia/audit-core
```

## Use

```ts
import { analyzeHtml } from "@masamedia/audit-core";

const res = await fetch("https://example.com");
const robots = await fetch("https://example.com/robots.txt");
const report = analyzeHtml(await res.text(), res.url, {
  httpStatus: res.status,
  xRobotsTag: res.headers.get("x-robots-tag"),
  robotsTxt: robots.ok ? await robots.text() : null,
  robotsStatus: robots.status,
});

report.score.overall;   // 0 to 100
report.indexable;       // { value: true, reasons: [] }
report.headings.h1;     // the page's H1 texts
report.findings;        // [{ id, severity, category, message }]
```

In a browser (an extension or a bookmarklet) you can pass the rendered DOM, after JavaScript has run:

```ts
import { analyzeDocument } from "@masamedia/audit-core";
const report = analyzeDocument(document, location.href);
```

Many AI crawlers read only the HTML the server sends and do not run JavaScript, so compare this with `analyzeHtml` on the raw response.

### AI-crawler (GEO) access from robots.txt

```ts
import { parseAiCrawlers } from "@masamedia/audit-core";

const robots = await (await fetch("https://example.com/robots.txt")).text();
parseAiCrawlers(robots, "/blog/").agents;
// { GPTBot: "blocked", ClaudeBot: "allowed", ... } for the page /blog/
```

With a path, each crawler is `allowed` or `blocked` for that page, using the RFC 9309 rules (the longest matching rule wins, `*` and `$` supported). Without a path the result summarises the site: `partial` means some paths are disallowed.

Covers GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended and meta-externalagent.

## What it checks

- SEO: title and meta description (presence and length), canonical (self or another URL), H1 count, heading order.
- Indexability: HTTP status, `noindex` in meta robots or the `X-Robots-Tag` header, and whether robots.txt blocks the URL.
- GEO: which AI crawlers robots.txt lets fetch the page.
- Structured data: every JSON-LD block parsed, `@type` values collected (including `@graph`), invalid blocks flagged.
- Social: Open Graph and Twitter card tags.
- Internationalisation: `html lang`, hreflang and `x-default`.
- Accessibility basics: images without `alt`, heading-level jumps.
- Links: internal and external, external `nofollow`.

The report is plain JSON.

## Privacy

The library makes no network requests and sends nothing anywhere. You fetch the page; it analyses it locally.

## License

MIT © Masa Media Digital LTD
