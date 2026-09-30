import { analyzeHtml, type AuditReport, type Finding } from "@masamedia/audit-core";

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0";
const USER_AGENT = `MasaAudit/${VERSION} (+https://www.masamedia.co.il)`;

const HELP = `masa-audit ${VERSION}: web visibility audit by Masa Media Digital, an Israeli SEO and GEO agency

Usage:
  masa-audit <url> [options]

Options:
  --json          Print the full report as JSON
  --ai-only       Print only the AI-crawler (GEO) access table
  --no-robots     Skip fetching robots.txt
  --timeout <ms>  Request timeout (default 15000)
  -v, --version   Print the version
  -h, --help      Show this help

Exit codes: 0 no errors, 1 usage error, 2 the page could not be fetched,
3 the audit found at least one error-level problem.

Examples:
  masa-audit https://example.com
  masa-audit https://example.com --json > report.json
  npx @masamedia/audit-cli https://example.com --ai-only

Docs and issues: https://github.com/Masa-Media/masa-visibility-tools  ·  Masa Media Digital: https://www.masamedia.co.il/contact/`;

interface Args {
  url?: string;
  json: boolean;
  aiOnly: boolean;
  robots: boolean;
  timeout: number;
  help: boolean;
  version: boolean;
  unknown: string[];
}

function parseArgs(argv: string[]): Args {
  const a: Args = { json: false, aiOnly: false, robots: true, timeout: 15000, help: false, version: false, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--json") a.json = true;
    else if (t === "--ai-only") a.aiOnly = true;
    else if (t === "--no-robots") a.robots = false;
    else if (t === "--timeout") a.timeout = Number(argv[++i]) || a.timeout;
    else if (t === "-h" || t === "--help") a.help = true;
    else if (t === "-v" || t === "--version") a.version = true;
    else if (t && !t.startsWith("-") && !a.url) a.url = t;
    else if (t) a.unknown.push(t);
  }
  return a;
}

interface Fetched {
  status: number;
  body: string;
  /** The address after redirects. */
  url: string;
  headers: Headers;
}

async function fetchText(url: string, timeout: number): Promise<Fetched> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT },
    });
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, body: decode(bytes, res.headers.get("content-type")), url: res.url || url, headers: res.headers };
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`no answer within ${timeout} ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Decode with the page's declared charset (header, then <meta charset>), e.g. windows-1255 on older Hebrew sites. */
function decode(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(declared).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** "fetch failed" hides the reason; show the network error code (ENOTFOUND, ECONNREFUSED...) when there is one. */
function describeError(e: unknown): string {
  const err = e as Error & { cause?: { code?: string; message?: string } };
  const cause = err.cause?.code ?? err.cause?.message;
  return cause ? `${err.message} (${cause})` : err.message;
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
    line(paint("Masa Media Digital web audit", C.cyan + C.bold) + paint("  " + r.url, C.dim));
    line(paint(`Score ${r.score.overall}/100`, scoreColor(r.score.overall) + C.bold) +
      paint(`   status ${r.httpStatus ?? "?"}`, C.dim));
    line();

    const rows: [string, string][] = [
      ["Title", `${r.title.text ?? paint("(none)", C.red)}  ${paint(`[${r.title.length}]`, C.dim)}`],
      ["Description", r.metaDescription.text ? `${trunc(r.metaDescription.text, 60)} ${paint(`[${r.metaDescription.length}]`, C.dim)}` : paint("(none)", C.yellow)],
      ["Canonical", r.canonical.href ? `${r.canonical.href} ${r.canonical.isSelf ? paint("(self)", C.green) : paint("(other)", C.yellow)}` : paint("(none)", C.dim)],
      ["Indexable", r.indexable.value ? paint("yes", C.green) : paint("no: " + r.indexable.reasons.join(", "), C.red)],
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
  const aiNote =
    r.ai.source === "not-fetched"
      ? "robots.txt not read, access unknown"
      : r.ai.source === "missing"
        ? "no robots.txt, so all are allowed"
        : r.ai.path != null
          ? `robots.txt, for ${r.ai.path}`
          : "robots.txt, whole site";
  line(paint("AI crawlers (GEO)", C.cyan + C.bold) + paint("  " + aiNote, C.dim));
  if (r.ai.source !== "not-fetched") {
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
    line(paint("Made by Masa Media Digital, an Israeli SEO and GEO agency · https://www.masamedia.co.il", C.dim));
    line();
  }
}

const rank = (s: Finding["severity"]) => ({ error: 3, warn: 2, info: 1, good: 0 })[s];
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP + "\n");
    return 0;
  }
  if (args.version) {
    process.stdout.write(VERSION + "\n");
    return 0;
  }
  if (args.unknown.length) {
    process.stderr.write(`Unknown option: ${args.unknown.join(" ")}\nRun masa-audit --help for the options.\n`);
    return 1;
  }
  if (!args.url) {
    process.stderr.write(HELP + "\n");
    return 1;
  }
  let url = args.url;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    if (!/^https?:\/\//i.test(url)) {
      process.stderr.write(`Only http and https addresses can be audited: ${url}\n`);
      return 1;
    }
  } else {
    url = "https://" + url;
  }

  let page: Fetched;
  try {
    page = await fetchText(url, args.timeout);
  } catch (e) {
    process.stderr.write(paint(`Could not fetch ${url}: ${describeError(e)}\n`, C.red));
    return 2;
  }

  // Audit the address the page actually lives at (after redirects), with that site's robots.txt.
  let robotsTxt: string | null = null;
  let robotsStatus: number | undefined;
  if (args.robots) {
    try {
      const rob = await fetchText(new URL(page.url).origin + "/robots.txt", args.timeout);
      robotsStatus = rob.status;
      if (rob.status >= 200 && rob.status < 300) robotsTxt = rob.body;
    } catch {
      /* robots.txt is best-effort: access is reported as unknown */
    }
  }

  const report = analyzeHtml(page.body, page.url, {
    httpStatus: page.status,
    xRobotsTag: page.headers.get("x-robots-tag"),
    robotsTxt,
    robotsStatus,
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    printReport(report, args.aiOnly);
  }
  // Non-zero exit when there is at least one error-level finding (useful in CI).
  return report.findings.some((f) => f.severity === "error") ? 3 : 0;
}

// `masa-audit ... | head` closes the pipe early: stop quietly instead of crashing with EPIPE.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw err;
});

// exitCode, not process.exit(): exiting straight away can cut off a large --json report that is still being piped out.
main().then((code) => {
  process.exitCode = code;
});
