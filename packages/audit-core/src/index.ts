/**
 * @masamedia/audit-core
 * Framework-free web-page audit engine by Masa Media Digital LTD.
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
export { parseAiCrawlers, AI_CRAWLERS, type AiCrawler } from "./robots.js";

import { analyzeSnapshot, type AnalyzeOptions } from "./analyze.js";
import { snapshotFromHtml } from "./snapshot.js";
import type { AuditReport } from "./types.js";

/** Analyse a raw HTML string. */
export function analyzeHtml(html: string, url: string, opts?: AnalyzeOptions): AuditReport {
  return analyzeSnapshot(snapshotFromHtml(html), url, opts);
}

/**
 * Analyse a live DOM Document (browser). Reads the rendered DOM, so it reflects
 * client-side rendering — which is exactly what matters for GEO / AI crawlers
 * that execute or skip JavaScript.
 */
export function analyzeDocument(doc: Document, url: string, opts?: AnalyzeOptions): AuditReport {
  const html = doc.documentElement?.outerHTML ?? "";
  return analyzeHtml(html, url, opts);
}
