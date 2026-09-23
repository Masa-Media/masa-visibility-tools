import { analyzeHtml, type AuditReport, type Finding } from "@masamedia/audit-core";

const HELP = `masa-audit — web visibility audit by Masa Media Digital LTD

Usage:
  masa-audit <url> [options]

Options:
  --json          Print the full report as JSON
  --ai-only       Print only the AI-crawler (GEO) access table
  --no-robots     Skip fetching robots.txt
  --timeout <ms>  Request timeout (default 15000)
  -h, --help      Show this help

Examples:
  masa-audit https://example.com
  masa-audit https://example.com --json > report.json
  npx @masamedia/audit-cli https://example.com --ai-only

Docs: https://masamedia.co.il/tools/  ·  Support: https://masamedia.co.il/support`;

interface Args {
  url?: string;
  json: boolean;
  aiOnly: boolean;
  robots: boolean;
  timeout: number;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { json: false, aiOnly: false, robots: true, timeout: 15000, help: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--json") a.json = true;
    else if (t === "--ai-only") a.aiOnly = true;
    else if (t === "--no-robots") a.robots = false;
    else if (t === "--timeout") a.timeout = Number(argv[++i]) || a.timeout;
    else if (t === "-h" || t === "--help") a.help = true;
    else if (t && !t.startsWith("-") && !a.url) a.url = t;
  }
  return a;
}

async function fetchText(url: string, timeout: number): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "MasaAudit/0.1 (+https://masamedia.co.il)" },
    });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR == null;
const paint = (s: string, c: string) => (supportsColor ? c + s + C.reset : s);

const SEV_ICON: Record<Finding["severity"], string> = { error: "✗", warn: "!", info: "·", good: "✓" };
const SEV_COLOR: Record<Finding["severity"], string> = { error: C.red, warn: C.yellow, info: C.dim, good: C.green };

function scoreColor(n: number): string {
  return n >= 80 ? C.green : n >= 50 ? C.yellow : C.red;
}

function printReport(r: AuditReport, aiOnly: boolean): void {
  const line = (s = "") => process.stdout.write(s + "\n");

  if (!aiOnly) {
    line();
    line(paint("Masa Media web audit", C.cyan + C.bold) + paint("  " + r.url, C.dim));
    line(paint(`Score ${r.score.overall}/100`, scoreColor(r.score.overall) + C.bold) +
      paint(`   status ${r.httpStatus ?? "?"}`, C.dim));
    line();

    const rows: [string, string][] = [
      ["Title", `${r.title.text ?? paint("(none)", C.red)}  ${paint(`[${r.title.length}]`, C.dim)}`],
      ["Description", r.metaDescription.text ? `${trunc(r.metaDescription.text, 60)} ${paint(`[${r.metaDescription.length}]`, C.dim)}` : paint("(none)", C.yellow)],
      ["Canonical", r.canonical.href ? `${r.canonical.href} ${r.canonical.isSelf ? paint("(self)", C.green) : paint("(other)", C.yellow)}` : paint("(none)", C.dim)],
      ["Indexable", r.indexable.value ? paint("yes", C.green) : paint("no — " + r.indexable.reasons.join(", "), C.red)],
      ["H1", r.headings.h1.length ? r.headings.h1.join(" / ") : paint("(none)", C.red)],
      ["Headings", Object.entries(r.headings.counts).filter(([, n]) => n).map(([k, n]) => `${k}:${n}`).join("  ") || paint("(none)", C.dim)],
      ["Images", `${r.images.total} total, ${r.images.missingAlt ? paint(r.images.missingAlt + " no alt", C.yellow) : "all with alt"}`],
      ["Links", `${r.links.internal} internal, ${r.links.external} external${r.links.nofollowExternal ? ` (${r.links.nofollowExternal} nofollow)` : ""}`],
      ["Schema", r.schema.types.length ? r.schema.types.join(", ") : paint("(none)", C.dim)],
      ["Open Graph", r.openGraph["og:title"] ? "present" : paint("(none)", C.yellow)],
      ["hreflang", r.hreflang.length ? r.hreflang.map((h) => h.lang).join(", ") : paint("(none)", C.dim)],
    ];
    const w = Math.max(...rows.map(([k]) => k.length));
    for (const [k, v] of rows) line(paint(k.padEnd(w), C.dim) + "  " + v);
    line();
  }

  // AI crawlers (GEO)
  line(paint("AI crawlers (GEO)", C.cyan + C.bold) + (r.ai.source === "not-fetched" ? paint("  robots.txt not fetched", C.dim) : ""));
  if (r.ai.source === "robots.txt") {
    for (const [agent, access] of Object.entries(r.ai.agents)) {
      const col = access === "blocked" ? C.red : access === "allowed" ? C.green : access === "partial" ? C.yellow : C.dim;
      line("  " + agent.padEnd(20) + paint(access, col));
    }
  }
  line();

  if (!aiOnly) {
    const findings = [...r.findings].sort((a, b) => rank(b.severity) - rank(a.severity));
    line(paint("Findings", C.cyan + C.bold));
    if (!findings.length) line(paint("  none", C.green));
    for (const f of findings) {
      line("  " + paint(SEV_ICON[f.severity], SEV_COLOR[f.severity]) + " " + paint(`[${f.category}]`, C.dim) + " " + f.message);
    }
    line();
    line(paint("Made by Masa Media Digital LTD · https://masamedia.co.il", C.dim));
    line();
  }
}

const rank = (s: Finding["severity"]) => ({ error: 3, warn: 2, info: 1, good: 0 })[s];
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    process.stdout.write(HELP + "\n");
    return args.url ? 0 : 1;
  }
  let url = args.url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let page: { status: number; body: string };
  try {
    page = await fetchText(url, args.timeout);
  } catch (e) {
    process.stderr.write(paint(`Failed to fetch ${url}: ${(e as Error).message}\n`, C.red));
    return 2;
  }

  let robotsTxt: string | null = null;
  if (args.robots) {
    try {
      const origin = new URL(url).origin;
      const rob = await fetchText(origin + "/robots.txt", args.timeout);
      if (rob.status >= 200 && rob.status < 300) robotsTxt = rob.body;
    } catch {
      /* robots.txt is best-effort */
    }
  }

  const report = analyzeHtml(page.body, url, { httpStatus: page.status, robotsTxt });

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    printReport(report, args.aiOnly);
  }
  // Non-zero exit when there is at least one error-level finding (useful in CI).
  return report.findings.some((f) => f.severity === "error") ? 3 : 0;
}

main().then((code) => process.exit(code));
