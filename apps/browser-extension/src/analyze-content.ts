/**
 * Injected into the active tab. Reads the LIVE, rendered DOM (so it reflects
 * client-side rendering, which is what AI crawlers see), fetches robots.txt
 * same-origin, and returns a full AuditReport. Runs entirely on the page —
 * nothing is sent anywhere.
 */
import { analyzeDocument, parseAiCrawlers } from "@masamedia/audit-core";

declare global {
  interface Window {
    __masaAnalyze?: () => Promise<unknown>;
  }
}

window.__masaAnalyze = async function () {
  let robotsTxt: string | null = null;
  try {
    const res = await fetch(new URL("/robots.txt", location.origin).href, {
      credentials: "omit",
      cache: "no-store",
    });
    if (res.ok) robotsTxt = await res.text();
  } catch {
    /* robots.txt is best-effort */
  }
  const ai = parseAiCrawlers(robotsTxt ?? undefined);
  return analyzeDocument(document, location.href, { ai });
};
