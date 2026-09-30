/**
 * @masamedia/audit-core
 * Framework-free web-page audit engine by Masa Media, an Israeli SEO and GEO agency.
 *
 *   import { analyzeHtml } from "@masamedia/audit-core";
 *   const report = analyzeHtml(html, "https://example.com", { robotsTxt });
 *
 * In a browser (extension / bookmarklet) pass the live document:
 *   analyzeDocument(document, location.href);
 */
export * from "./types.js";
export { analyzeSnapshot, type AnalyzeOptions } from "./analyze.js";
export { snapshotFromHtml } from "./snapshot.js";
export { parseAiCrawlers, robotsAllows, AI_CRAWLERS, type AiCrawler } from "./robots.js";

import { analyzeSnapshot, type AnalyzeOptions } from "./analyze.js";
import { snapshotFromHtml } from "./snapshot.js";
import type { AuditReport } from "./types.js";

/** Analyse a raw HTML string. */
export function analyzeHtml(html: string, url: string, opts?: AnalyzeOptions): AuditReport {
  return analyzeSnapshot(snapshotFromHtml(html), url, opts);
}

/**
 * Analyse a live DOM Document (browser). Reads the rendered DOM, after JavaScript has run.
 * Many AI crawlers read only the HTML the server sends, so compare with analyzeHtml on the raw response
 * to see what they miss.
 */
export function analyzeDocument(
  doc: { documentElement?: { outerHTML: string } | null },
  url: string,
  opts?: AnalyzeOptions,
): AuditReport {
  const html = doc.documentElement?.outerHTML ?? "";
  return analyzeHtml(html, url, opts);
}
