import type { AuditReport, Finding } from "@masamedia/audit-core";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function runAudit(): Promise<AuditReport> {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error("Open a normal web page (http/https), then click again.");
  }
  // 1) inject the bundled analyzer, 2) call it and read the returned report.
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["analyze.bundle.js"] });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => await (window as unknown as { __masaAnalyze: () => Promise<unknown> }).__masaAnalyze(),
  });
  const result = results[0]?.result;
  if (!result) throw new Error("Could not read the page. Reload the tab and try again.");
  return result as AuditReport;
}

// ---- rendering ---------------------------------------------------------
const TABS = ["Overview", "GEO", "Schema", "Social", "Links", "Findings"] as const;
type Tab = (typeof TABS)[number];
let current: Tab = "Overview";
let report: AuditReport | null = null;

function scoreClass(n: number): string {
  return n >= 80 ? "good" : n >= 50 ? "warn" : "bad";
}
function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function kv(label: string, value: Node | string): HTMLElement {
  const row = el("div", "kv");
  row.appendChild(el("span", "k", label));
  const v = el("span", "v");
  if (typeof value === "string") v.textContent = value;
  else v.appendChild(value);
  row.appendChild(v);
  return row;
}
function pill(text: string, cls: string): HTMLElement {
  return el("span", "pill " + cls, text);
}

function renderTabs() {
  const nav = $("#tabs");
  nav.innerHTML = "";
  for (const t of TABS) {
    const b = el("button", "tab" + (t === current ? " active" : ""), t);
    if (t === "GEO" && report) {
      const blocked = Object.values(report.ai.agents).filter((v) => v === "blocked").length;
      if (blocked) b.appendChild(pill(String(blocked), "bad tiny"));
    }
    if (t === "Findings" && report) {
      const errs = report.findings.filter((f) => f.severity === "error").length;
      if (errs) b.appendChild(pill(String(errs), "bad tiny"));
    }
    b.onclick = () => {
      current = t;
      renderTabs();
      renderBody();
    };
    nav.appendChild(b);
  }
}

function renderBody() {
  const body = $("#body");
  body.innerHTML = "";
  if (!report) return;
  const r = report;
  if (current === "Overview") {
    body.appendChild(kv("Score", pill(`${r.score.overall} / 100`, scoreClass(r.score.overall))));
    body.appendChild(kv("Title", r.title.text ? `${r.title.text}  (${r.title.length})` : "—"));
    body.appendChild(kv("Description", r.metaDescription.text ? `${r.metaDescription.text} (${r.metaDescription.length})` : "—"));
    body.appendChild(kv("Canonical", r.canonical.href ? `${r.canonical.href} ${r.canonical.isSelf ? "(self)" : "(other)"}` : "—"));
    body.appendChild(kv("Indexable", r.indexable.value ? pill("yes", "good") : pill("no", "bad")));
    body.appendChild(kv("H1", r.headings.h1.join(" / ") || "—"));
    body.appendChild(kv("Headings", Object.entries(r.headings.counts).filter(([, n]) => n).map(([k, n]) => `${k}:${n}`).join("  ") || "—"));
    body.appendChild(kv("Images", `${r.images.total} total · ${r.images.missingAlt} missing alt`));
    body.appendChild(kv("Schema", r.schema.types.join(", ") || "—"));
  } else if (current === "GEO") {
    if (r.ai.source === "not-fetched") body.appendChild(el("p", "muted", "robots.txt was not available."));
    const grid = el("div", "grid");
    for (const [agent, access] of Object.entries(r.ai.agents)) {
      const cls = access === "blocked" ? "bad" : access === "allowed" ? "good" : access === "partial" ? "warn" : "muted";
      const cell = el("div", "cell");
      cell.appendChild(el("span", "agent", agent));
      cell.appendChild(pill(access, cls));
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  } else if (current === "Schema") {
    if (!r.schema.types.length) body.appendChild(el("p", "muted", "No JSON-LD structured data found."));
    for (const t of r.schema.types) body.appendChild(pill(t, "good"));
    for (const b of r.schema.blocks) if (!b.valid) body.appendChild(el("p", "bad", "Invalid JSON-LD: " + (b.error ?? "")));
  } else if (current === "Social") {
    const og = Object.entries(r.openGraph);
    const tw = Object.entries(r.twitter);
    body.appendChild(el("h3", undefined, "Open Graph"));
    if (!og.length) body.appendChild(el("p", "muted", "None."));
    for (const [k, v] of og) body.appendChild(kv(k, v));
    body.appendChild(el("h3", undefined, "Twitter"));
    if (!tw.length) body.appendChild(el("p", "muted", "None."));
    for (const [k, v] of tw) body.appendChild(kv(k, v));
    body.appendChild(el("h3", undefined, "hreflang"));
    if (!r.hreflang.length) body.appendChild(el("p", "muted", "None."));
    for (const h of r.hreflang) body.appendChild(kv(h.lang, h.href));
  } else if (current === "Links") {
    body.appendChild(kv("Internal", String(r.links.internal)));
    body.appendChild(kv("External", String(r.links.external)));
    body.appendChild(kv("External nofollow", String(r.links.nofollowExternal)));
  } else if (current === "Findings") {
    const findings = [...r.findings].sort((a, b) => rank(b.severity) - rank(a.severity));
    if (!findings.length) body.appendChild(el("p", "good", "No issues found."));
    for (const f of findings) {
      const row = el("div", "finding " + f.severity);
      row.appendChild(el("span", "sev", ICON[f.severity]));
      row.appendChild(el("span", "cat", f.category));
      row.appendChild(el("span", "msg", f.message));
      body.appendChild(row);
    }
  }
}

const ICON: Record<Finding["severity"], string> = { error: "✗", warn: "!", info: "·", good: "✓" };
const rank = (s: Finding["severity"]) => ({ error: 3, warn: 2, info: 1, good: 0 })[s];

async function main() {
  renderTabs();
  const body = $("#body");
  body.appendChild(el("p", "muted", "Analysing this page…"));
  try {
    report = await runAudit();
    const url = report.url;
    $("#url").textContent = url;
    renderTabs();
    renderBody();
  } catch (e) {
    body.innerHTML = "";
    body.appendChild(el("p", "bad", (e as Error).message));
  }
}

main();
