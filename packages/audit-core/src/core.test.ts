import { describe, it, expect } from "vitest";
import { analyzeHtml } from "./index.js";
import { parseAiCrawlers } from "./robots.js";

const GOOD = `<!doctype html><html lang="en"><head>
<title>Masa Media web audit for example.com</title>
<meta name="description" content="A clear, useful description of this page that is comfortably within the recommended length for a search snippet.">
<link rel="canonical" href="https://example.com/">
<meta property="og:title" content="Masa"><meta property="og:image" content="https://example.com/og.png">
<link rel="alternate" hreflang="en" href="https://example.com/">
<link rel="alternate" hreflang="x-default" href="https://example.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Masa Media Digital LTD"}</script>
</head><body>
<h1>Only one heading</h1><h2>Sub</h2>
<img src="/a.png" alt="described"><img src="/b.png">
<a href="/internal">in</a><a href="https://other.com" rel="nofollow">out</a>
</body></html>`;

describe("analyzeHtml", () => {
  const r = analyzeHtml(GOOD, "https://example.com/");

  it("reads the title and its length", () => {
    expect(r.title.text).toContain("Masa Media");
    expect(r.title.length).toBeGreaterThan(10);
  });

  it("detects a self canonical", () => {
    expect(r.canonical.href).toBe("https://example.com/");
    expect(r.canonical.isSelf).toBe(true);
  });

  it("counts headings and finds the single H1", () => {
    expect(r.headings.h1).toEqual(["Only one heading"]);
    expect(r.headings.counts.h2).toBe(1);
  });

  it("finds the missing alt", () => {
    expect(r.images.total).toBe(2);
    expect(r.images.missingAlt).toBe(1);
    expect(r.findings.some((f) => f.id === "img.alt.missing")).toBe(true);
  });

  it("classifies internal vs external links and nofollow", () => {
    expect(r.links.internal).toBe(1);
    expect(r.links.external).toBe(1);
    expect(r.links.nofollowExternal).toBe(1);
  });

  it("collects schema types and Open Graph", () => {
    expect(r.schema.types).toContain("Organization");
    expect(r.openGraph["og:image"]).toBe("https://example.com/og.png");
  });

  it("reads hreflang including x-default", () => {
    expect(r.hreflang.map((h) => h.lang)).toContain("x-default");
  });

  it("is indexable and scores high", () => {
    expect(r.indexable.value).toBe(true);
    expect(r.score.overall).toBeGreaterThan(80);
  });
});

describe("problem page", () => {
  const r = analyzeHtml(
    `<html><head><meta name="robots" content="noindex"></head><body><h2>no h1</h2><script type="application/ld+json">{ bad json </script></body></html>`,
    "https://example.com/x",
  );
  it("flags noindex, missing h1, missing title, invalid schema, missing lang", () => {
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("robots.noindex");
    expect(ids).toContain("h1.missing");
    expect(ids).toContain("title.missing");
    expect(ids).toContain("schema.invalid");
    expect(ids).toContain("lang.missing");
    expect(r.indexable.value).toBe(false);
  });
});

describe("parseAiCrawlers", () => {
  it("marks named blocks blocked and wildcard fallback", () => {
    const robots = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\n`;
    const rep = parseAiCrawlers(robots);
    expect(rep.agents.GPTBot).toBe("blocked");
    expect(rep.agents.ClaudeBot).toBe("partial"); // falls back to * (Disallow: /private)
    expect(rep.hasWildcardGroup).toBe(true);
  });

  it("reports not-fetched when no robots", () => {
    expect(parseAiCrawlers(undefined).source).toBe("not-fetched");
  });

  it("treats empty Disallow as allowed", () => {
    const rep = parseAiCrawlers("User-agent: *\nDisallow:\n");
    expect(rep.agents.PerplexityBot).toBe("allowed");
  });
});
