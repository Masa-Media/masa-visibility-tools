import { describe, it, expect } from "vitest";
import { analyzeHtml } from "./index.js";
import { parseAiCrawlers, robotsAllows } from "./robots.js";

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

describe("pages search engines cannot index", () => {
  const PAGE = GOOD;
  it("an HTTP error page is an error and not indexable", () => {
    const r = analyzeHtml(PAGE, "https://example.com/", { httpStatus: 500 });
    expect(r.findings.find((f) => f.id === "http.status")?.severity).toBe("error");
    expect(r.indexable.value).toBe(false);
    expect(r.score.overall).toBeLessThan(90);
  });

  it("noindex from meta robots or the X-Robots-Tag header is an error", () => {
    const meta = analyzeHtml(PAGE.replace("<head>", '<head><meta name="robots" content="noindex,nofollow">'), "https://example.com/");
    expect(meta.findings.find((f) => f.id === "robots.noindex")?.severity).toBe("error");
    const header = analyzeHtml(PAGE, "https://example.com/", { xRobotsTag: "noindex" });
    expect(header.indexable.reasons).toContain("X-Robots-Tag: noindex");
    expect(analyzeHtml(PAGE, "https://example.com/", { xRobotsTag: "googlebot: noindex" }).indexable.value).toBe(false);
    expect(analyzeHtml(PAGE, "https://example.com/", { xRobotsTag: "otherbot: noindex" }).indexable.value).toBe(true);
  });

  it("robots.txt that blocks the URL is an error; one that blocks other paths is fine", () => {
    const blocked = analyzeHtml(PAGE, "https://example.com/", { robotsTxt: "User-agent: *\nDisallow: /\n" });
    expect(blocked.findings.map((f) => f.id)).toContain("robots.txt.blocked");
    expect(blocked.ai.agents.GPTBot).toBe("blocked");
    const open = analyzeHtml(PAGE, "https://example.com/", { robotsTxt: "User-agent: *\nAllow: /\nDisallow: /admin/\n" });
    expect(open.findings.map((f) => f.id)).not.toContain("robots.txt.blocked");
    expect(Object.values(open.ai.agents).every((a) => a === "allowed")).toBe(true);
    expect(open.ai.path).toBe("/");
  });

  it("a site with no robots.txt (404) allows every crawler", () => {
    const r = analyzeHtml(PAGE, "https://example.com/", { robotsStatus: 404 });
    expect(r.ai.source).toBe("missing");
    expect(Object.values(r.ai.agents).every((a) => a === "allowed")).toBe(true);
  });
});

describe("robots.txt matching (RFC 9309)", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$\n\nUser-agent: GPTBot\nDisallow: /\n";
  it("longest rule wins, Allow wins a tie, wildcards and $ work", () => {
    expect(robotsAllows(robots, "Googlebot", "/private/x")).toBe(false);
    expect(robotsAllows(robots, "Googlebot", "/private/public/x")).toBe(true);
    expect(robotsAllows(robots, "Googlebot", "/files/a.pdf")).toBe(false);
    expect(robotsAllows(robots, "Googlebot", "/files/a.pdf?x=1")).toBe(true);
    expect(robotsAllows(robots, "GPTBot", "/anything")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /a\nAllow: /a\n", "Googlebot", "/a")).toBe(true);
  });

  it("reports per page when given a path", () => {
    const rep = parseAiCrawlers(robots, "/blog/");
    expect(rep.agents.ClaudeBot).toBe("allowed");
    expect(rep.agents.GPTBot).toBe("blocked");
    expect(parseAiCrawlers(robots, "/private/x").agents.ClaudeBot).toBe("blocked");
  });

  it("an empty robots.txt allows everyone", () => {
    expect(parseAiCrawlers("").agents.GPTBot).toBe("allowed");
  });
});
