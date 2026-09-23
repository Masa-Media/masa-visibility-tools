import { parse } from "node-html-parser";
import type { Snapshot, MetaTag, LinkTag, Heading, ImageTag, Anchor } from "./types.js";

/**
 * Build a Snapshot from a raw HTML string (Node / CLI path).
 * Uses node-html-parser, which is dependency-free and also runs in the browser,
 * so this single implementation is safe to bundle anywhere.
 */
export function snapshotFromHtml(html: string): Snapshot {
  const root = parse(html, {
    lowerCaseTagName: true,
    comment: false,
    blockTextElements: { script: true, style: true, noscript: false },
  });

  const htmlEl = root.querySelector("html");
  const baseEl = root.querySelector("base");

  const metas: MetaTag[] = root.querySelectorAll("meta").map((m) => ({
    name: attr(m, "name"),
    property: attr(m, "property"),
    httpEquiv: attr(m, "http-equiv"),
    content: attr(m, "content"),
  }));

  const links: LinkTag[] = root.querySelectorAll("link").map((l) => ({
    rel: attr(l, "rel"),
    href: attr(l, "href"),
    hreflang: attr(l, "hreflang"),
  }));

  // Single grouped query keeps true document order (an h2 before an h1 stays first).
  const headings: Heading[] = root
    .querySelectorAll("h1, h2, h3, h4, h5, h6")
    .map((h) => ({
      level: Number(String(h.tagName ?? "H0").slice(1)) || 0,
      text: collapse(h.textContent),
    }))
    .filter((h) => h.level >= 1 && h.level <= 6);

  const images: ImageTag[] = root.querySelectorAll("img").map((img) => ({
    src: attr(img, "src"),
    alt: img.getAttribute("alt") ?? null,
  }));

  const anchors: Anchor[] = root.querySelectorAll("a").map((a) => ({
    href: attr(a, "href"),
    rel: attr(a, "rel"),
    text: collapse(a.textContent),
  }));

  const jsonLd = root
    .querySelectorAll("script")
    .filter((s) => (attr(s, "type") ?? "").toLowerCase() === "application/ld+json")
    .map((s) => s.textContent);

  return {
    lang: htmlEl?.getAttribute("lang") ?? null,
    title: root.querySelector("title")?.textContent ?? null,
    metas,
    links,
    headings,
    images,
    anchors,
    jsonLd,
    baseHref: baseEl?.getAttribute("href") ?? null,
  };
}

function attr(el: { getAttribute(name: string): string | null | undefined }, name: string): string | undefined {
  const v = el.getAttribute(name);
  return v == null ? undefined : v;
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
