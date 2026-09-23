import type {
  AuditReport,
  Finding,
  Snapshot,
  AiCrawlerReport,
  Category,
} from "./types.js";
import { parseAiCrawlers } from "./robots.js";

export interface AnalyzeOptions {
  httpStatus?: number;
  /** Pre-parsed AI crawler report, or pass robotsTxt to have it parsed here. */
  ai?: AiCrawlerReport;
  robotsTxt?: string | null;
}

const WEIGHT: Record<string, number> = { error: 12, warn: 5, info: 0, good: 0 };

/** Analyse a framework-neutral Snapshot into a full AuditReport. */
export function analyzeSnapshot(
  snap: Snapshot,
  url: string,
  opts: AnalyzeOptions = {},
): AuditReport {
  const findings: Finding[] = [];
  const add = (
    id: string,
    severity: Finding["severity"],
    category: Category,
    message: string,
    value?: string | number,
  ) => findings.push({ id, severity, category, message, value });

  let pageUrl: URL | null = null;
  try {
    pageUrl = new URL(url);
  } catch {
    /* url may be a local file or blank; degrade gracefully */
  }

  // ---- title -------------------------------------------------------------
  const title = (snap.title ?? "").trim();
  if (!title) add("title.missing", "error", "seo", "Page has no <title>.");
  else {
    if (title.length < 10)
      add("title.short", "warn", "seo", `Title is very short (${title.length} chars).`, title.length);
    if (title.length > 60)
      add("title.long", "warn", "seo", `Title is ${title.length} chars; ~60 is the safe SERP limit.`, title.length);
  }

  // ---- meta description --------------------------------------------------
  const desc = firstMeta(snap, (m) => m.name?.toLowerCase() === "description") ?? "";
  if (!desc) add("description.missing", "warn", "seo", "No meta description.");
  else {
    if (desc.length < 50)
      add("description.short", "info", "seo", `Meta description is short (${desc.length} chars).`, desc.length);
    if (desc.length > 160)
      add("description.long", "warn", "seo", `Meta description is ${desc.length} chars; ~160 is the safe limit.`, desc.length);
  }

  // ---- canonical ---------------------------------------------------------
  const canonicalHref =
    snap.links.find((l) => rels(l.rel).includes("canonical"))?.href ?? null;
  let canonicalIsSelf: boolean | null = null;
  if (canonicalHref && pageUrl) {
    try {
      canonicalIsSelf = normalize(new URL(canonicalHref, pageUrl)) === normalize(pageUrl);
      if (!canonicalIsSelf)
        add("canonical.other", "info", "seo", "Canonical points to a different URL.", canonicalHref);
    } catch {
      add("canonical.invalid", "warn", "seo", "Canonical URL is not valid.", canonicalHref);
    }
  } else if (!canonicalHref) {
    add("canonical.missing", "info", "seo", "No canonical link.");
  }

  // ---- robots meta -------------------------------------------------------
  const robotsContent =
    firstMeta(snap, (m) => ["robots", "googlebot"].includes(m.name?.toLowerCase() ?? "")) ?? null;
  const robotsLower = (robotsContent ?? "").toLowerCase();
  const index = !robotsLower.includes("noindex");
  const follow = !robotsLower.includes("nofollow");
  const reasons: string[] = [];
  if (!index) {
    reasons.push("meta robots: noindex");
    add("robots.noindex", "info", "crawl", "Page is set to noindex.");
  }
  if (!follow) add("robots.nofollow", "info", "crawl", "Page is set to nofollow.");

  // ---- html lang ---------------------------------------------------------
  if (!snap.lang) add("lang.missing", "warn", "i18n", "<html> has no lang attribute.");

  // ---- headings ----------------------------------------------------------
  const counts: Record<string, number> = {};
  for (let i = 1; i <= 6; i++) counts["h" + i] = 0;
  for (const h of snap.headings) counts["h" + h.level] = (counts["h" + h.level] ?? 0) + 1;
  const h1 = snap.headings.filter((h) => h.level === 1).map((h) => h.text);
  if (h1.length === 0) add("h1.missing", "error", "seo", "No H1 on the page.");
  else if (h1.length > 1) add("h1.multiple", "warn", "seo", `${h1.length} H1s; one is standard.`, h1.length);
  // heading level jumps (e.g. h2 -> h4)
  let prev = 0;
  for (const h of snap.headings) {
    if (prev && h.level > prev + 1) {
      add("headings.skip", "warn", "a11y", `Heading level jumps from H${prev} to H${h.level}.`);
      break;
    }
    prev = h.level;
  }

  // ---- images / alt ------------------------------------------------------
  const total = snap.images.length;
  const missingAlt = snap.images.filter((i) => i.alt === null).length;
  const emptyAlt = snap.images.filter((i) => i.alt === "").length;
  if (missingAlt > 0)
    add("img.alt.missing", "warn", "a11y", `${missingAlt} of ${total} images have no alt attribute.`, missingAlt);

  // ---- links -------------------------------------------------------------
  let internal = 0,
    external = 0,
    nofollowExternal = 0;
  for (const a of snap.anchors) {
    if (!a.href) continue;
    let u: URL | null = null;
    try {
      u = new URL(a.href, pageUrl ?? undefined);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    if (pageUrl && u.host === pageUrl.host) internal++;
    else {
      external++;
      if (rels(a.rel).includes("nofollow")) nofollowExternal++;
    }
  }

  // ---- Open Graph / Twitter ---------------------------------------------
  const openGraph: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  for (const m of snap.metas) {
    if (m.property?.toLowerCase().startsWith("og:") && m.content != null)
      openGraph[m.property.toLowerCase()] = m.content;
    if (m.name?.toLowerCase().startsWith("twitter:") && m.content != null)
      twitter[m.name.toLowerCase()] = m.content;
  }
  if (!openGraph["og:title"])
    add("og.missing", "info", "social", "No og:title; social shares may look poor.");
  if (openGraph["og:title"] && !openGraph["og:image"])
    add("og.image.missing", "info", "social", "Open Graph present but no og:image.");

  // ---- hreflang ----------------------------------------------------------
  const hreflang = snap.links
    .filter((l) => rels(l.rel).includes("alternate") && l.hreflang)
    .map((l) => ({ lang: l.hreflang as string, href: l.href ?? "" }));
  if (hreflang.length > 0) {
    const hasXDefault = hreflang.some((h) => h.lang.toLowerCase() === "x-default");
    if (!hasXDefault)
      add("hreflang.no-xdefault", "info", "i18n", "hreflang set has no x-default.");
  }

  // ---- schema (JSON-LD) --------------------------------------------------
  const blocks = snap.jsonLd.map((raw) => parseJsonLd(raw));
  const types = [...new Set(blocks.flatMap((b) => b.types))];
  const invalid = blocks.filter((b) => !b.valid).length;
  if (snap.jsonLd.length === 0)
    add("schema.none", "info", "schema", "No JSON-LD structured data found.");
  if (invalid > 0)
    add("schema.invalid", "error", "schema", `${invalid} JSON-LD block(s) failed to parse.`, invalid);

  // ---- AI crawlers -------------------------------------------------------
  const ai: AiCrawlerReport = opts.ai ?? parseAiCrawlers(opts.robotsTxt ?? undefined);
  const blockedAi = Object.entries(ai.agents).filter(([, v]) => v === "blocked").map(([k]) => k);
  if (ai.source === "robots.txt" && blockedAi.length > 0)
    add("ai.blocked", "info", "geo", `robots.txt blocks ${blockedAi.length} AI crawler(s): ${blockedAi.join(", ")}.`, blockedAi.length);

  // ---- scoring -----------------------------------------------------------
  const score = computeScore(findings);

  return {
    url,
    fetchedAt: new Date().toISOString(),
    httpStatus: opts.httpStatus,
    title: { text: snap.title, length: title.length },
    metaDescription: { text: desc || null, length: desc.length },
    canonical: { href: canonicalHref, isSelf: canonicalIsSelf },
    robotsMeta: { content: robotsContent, index, follow },
    indexable: { value: index, reasons },
    headings: { h1, counts, outline: snap.headings },
    schema: { blocks: blocks.map((b) => ({ valid: b.valid, types: b.types, error: b.error })), types },
    openGraph,
    twitter,
    hreflang,
    images: { total, missingAlt, emptyAlt },
    links: { internal, external, nofollowExternal },
    ai,
    findings,
    score,
  };
}

function computeScore(findings: Finding[]): AuditReport["score"] {
  const cats: Category[] = ["seo", "geo", "schema", "social", "i18n", "a11y", "crawl"];
  const byCategory: Partial<Record<Category, number>> = {};
  let overall = 100;
  for (const f of findings) overall -= WEIGHT[f.severity] ?? 0;
  for (const c of cats) {
    let s = 100;
    for (const f of findings) if (f.category === c) s -= WEIGHT[f.severity] ?? 0;
    byCategory[c] = clamp(s);
  }
  return { overall: clamp(overall), byCategory };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function rels(rel: string | undefined): string[] {
  return (rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

function firstMeta(snap: Snapshot, pred: (m: Snapshot["metas"][number]) => boolean): string | undefined {
  const m = snap.metas.find(pred);
  return m?.content;
}

function normalize(u: URL): string {
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
}

interface JsonLdResult {
  valid: boolean;
  types: string[];
  error?: string;
}
function parseJsonLd(raw: string): JsonLdResult {
  try {
    const data = JSON.parse(raw);
    return { valid: true, types: collectTypes(data) };
  } catch (e) {
    return { valid: false, types: [], error: (e as Error).message };
  }
}
function collectTypes(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, out);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.push(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") out.push(x);
    if (Array.isArray(obj["@graph"])) collectTypes(obj["@graph"], out);
  }
  return [...new Set(out)];
}
