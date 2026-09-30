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

/** A robots.txt path pattern as a RegExp: "*" matches any run of characters, a trailing "$" anchors the end (RFC 9309). */
function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/**
 * Whether a group lets its crawlers fetch one path: the longest matching rule wins and Allow wins a tie (RFC 9309).
 * An empty "Disallow:" is not a rule.
 */
function allowsPath(group: Group, path: string): boolean {
  let best = { length: -1, allow: true };
  const consider = (rules: string[], allow: boolean) => {
    for (const rule of rules) {
      if (!rule || !patternToRegExp(rule).test(path)) continue;
      if (rule.length > best.length || (rule.length === best.length && allow)) best = { length: rule.length, allow };
    }
  };
  consider(group.disallow, false);
  consider(group.allow, true);
  return best.allow;
}

/** Site-wide summary for one group, used when no page path is given. */
function siteAccess(group: Group): AiAccess {
  if (!allowsPath(group, "/")) return "blocked";
  return group.disallow.some((d) => d) ? "partial" : "allowed";
}

/** The group that applies to a user-agent: its own named group, else the "*" group (RFC 9309). */
function groupFor(groups: Group[], agent: string): Group | undefined {
  const name = agent.toLowerCase();
  return groups.find((g) => g.agents.includes(name)) ?? groups.find((g) => g.agents.includes("*"));
}

/**
 * Report each AI crawler's access from a robots.txt body.
 * With `path` (the audited page's path and query), each crawler is "allowed" or "blocked" for that page.
 * Without it, the result summarises the whole site: "partial" means some paths are disallowed.
 * A named group wins over the "*" wildcard group. An empty body means no rules, so everything is allowed.
 */
export function parseAiCrawlers(robotsTxt: string | null | undefined, path?: string): AiCrawlerReport {
  if (robotsTxt == null) {
    return {
      source: "not-fetched",
      hasWildcardGroup: false,
      agents: Object.fromEntries(AI_CRAWLERS.map((a) => [a, "unspecified" as AiAccess])),
    };
  }
  const groups = parseGroups(robotsTxt);
  const agents: Record<string, AiAccess> = {};
  for (const crawler of AI_CRAWLERS) {
    const group = groupFor(groups, crawler);
    if (!group) agents[crawler] = "allowed";
    else if (path != null) agents[crawler] = allowsPath(group, path) ? "allowed" : "blocked";
    else agents[crawler] = siteAccess(group);
  }
  return {
    source: "robots.txt",
    hasWildcardGroup: groups.some((g) => g.agents.includes("*")),
    agents,
    ...(path != null ? { path } : {}),
  };
}

/** Whether robots.txt lets a user-agent (e.g. "Googlebot") fetch a path. No applicable group means allowed. */
export function robotsAllows(robotsTxt: string, agent: string, path: string): boolean {
  const group = groupFor(parseGroups(robotsTxt), agent);
  return group ? allowsPath(group, path) : true;
}
