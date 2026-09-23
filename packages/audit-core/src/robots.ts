import type { AiAccess, AiCrawlerReport } from "./types.js";

/**
 * The AI / GEO crawlers worth reporting on, grouped by the company behind them.
 * These are the user-agents that gate whether a page can appear in AI answers
 * (ChatGPT, Claude, Perplexity, Google AI Overviews / Gemini, and the big
 * training crawlers).
 */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
] as const;

export type AiCrawler = (typeof AI_CRAWLERS)[number];

interface Group {
  agents: string[];
  disallow: string[];
  allow: string[];
}

/** Parse a robots.txt body into user-agent groups. */
function parseGroups(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one group.
      if (!current || !lastLineWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (!current) continue;
    if (field === "disallow") current.disallow.push(value);
    else if (field === "allow") current.allow.push(value);
  }
  return groups;
}

function accessFor(group: Group | undefined): AiAccess {
  if (!group) return "unspecified";
  const blocksRoot = group.disallow.some((d) => d === "/" || d === "");
  // "Disallow: " (empty) means allow-all in the robots spec.
  const rootDisallow = group.disallow.some((d) => d === "/");
  const allowsRoot = group.allow.some((a) => a === "/");
  if (rootDisallow && !allowsRoot) return "blocked";
  if (group.disallow.some((d) => d && d !== "")) return "partial";
  // Only empty disallows, or none at all.
  void blocksRoot;
  return "allowed";
}

/**
 * Report each AI crawler's access from a robots.txt body.
 * A named group wins over the "*" wildcard group; when only "*" applies the
 * result reflects the wildcard and the agent is still reported (not hidden).
 */
export function parseAiCrawlers(robotsTxt: string | null | undefined): AiCrawlerReport {
  if (robotsTxt == null) {
    return {
      source: "not-fetched",
      hasWildcardGroup: false,
      agents: Object.fromEntries(AI_CRAWLERS.map((a) => [a, "unspecified" as AiAccess])),
    };
  }
  const groups = parseGroups(robotsTxt);
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const agents: Record<string, AiAccess> = {};
  for (const crawler of AI_CRAWLERS) {
    const named = groups.find((g) => g.agents.includes(crawler.toLowerCase()));
    agents[crawler] = accessFor(named ?? wildcard);
  }
  return { source: "robots.txt", hasWildcardGroup: !!wildcard, agents };
}
