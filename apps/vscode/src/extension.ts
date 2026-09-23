import * as vscode from "vscode";
import { analyzeHtml, type AuditReport, type Finding } from "@masamedia/audit-core";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("masa.auditFile", auditFile),
    vscode.commands.registerCommand("masa.auditUrl", auditUrl),
  );
}

export function deactivate(): void {
  /* nothing to clean up */
}

async function auditFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Masa: open an HTML file first.");
    return;
  }
  const doc = editor.document;
  const html = doc.getText();
  const report = analyzeHtml(html, doc.uri.toString());
  showReport(report, `Audit — ${shortName(doc.uri.fsPath)}`);
}

async function auditUrl(): Promise<void> {
  const url = await vscode.window.showInputBox({
    prompt: "URL to audit",
    placeHolder: "https://example.com",
    validateInput: (v) => (/^https?:\/\/.+/i.test(v) || /^[^\s.]+\.[^\s]+/.test(v) ? undefined : "Enter a valid URL"),
  });
  if (!url) return;
  const full = /^https?:\/\//i.test(url) ? url : "https://" + url;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Masa: auditing ${full}…` },
    async () => {
      try {
        const res = await fetch(full, { redirect: "follow", headers: { "user-agent": "MasaAudit/0.1 (+https://masamedia.co.il)" } });
        const body = await res.text();
        let robotsTxt: string | null = null;
        try {
          const rob = await fetch(new URL("/robots.txt", full).href);
          if (rob.ok) robotsTxt = await rob.text();
        } catch {
          /* best effort */
        }
        const report = analyzeHtml(body, full, { httpStatus: res.status, robotsTxt });
        showReport(report, `Audit — ${full}`);
      } catch (e) {
        vscode.window.showErrorMessage(`Masa: could not fetch ${full}: ${(e as Error).message}`);
      }
    },
  );
}

let panel: vscode.WebviewPanel | undefined;

function showReport(report: AuditReport, title: string): void {
  if (!panel) {
    panel = vscode.window.createWebviewPanel("masaAudit", "Masa Web Audit", vscode.ViewColumn.Beside, { enableScripts: false });
    panel.onDidDispose(() => (panel = undefined));
  }
  panel.title = title;
  panel.webview.html = renderHtml(report);
  panel.reveal(vscode.ViewColumn.Beside, true);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

const SEV_ORDER = { error: 3, warn: 2, info: 1, good: 0 } as const;

function renderHtml(r: AuditReport): string {
  const scoreColor = r.score.overall >= 80 ? "#35c07a" : r.score.overall >= 50 ? "#e0a83a" : "#e5484d";
  const kv = (k: string, v: string) => `<tr><td class="k">${esc(k)}</td><td>${v}</td></tr>`;
  const ai = Object.entries(r.ai.agents)
    .map(([a, v]) => {
      const c = v === "blocked" ? "#e5484d" : v === "allowed" ? "#35c07a" : v === "partial" ? "#e0a83a" : "#888";
      return `<span class="pill" style="color:${c};border-color:${c}">${esc(a)}: ${esc(v)}</span>`;
    })
    .join(" ");
  const findings = [...r.findings]
    .sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity])
    .map((f: Finding) => `<div class="f ${f.severity}"><b>${sev(f.severity)}</b> <span class="cat">[${esc(f.category)}]</span> ${esc(f.message)}</div>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  body{font:13px/1.5 var(--vscode-font-family,system-ui);padding:14px;color:var(--vscode-foreground)}
  h1{font-size:16px;margin:0 0 2px}
  .url{color:var(--vscode-descriptionForeground);word-break:break-all}
  .score{font-size:22px;font-weight:800;color:${scoreColor}}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  td{padding:4px 6px;border-bottom:1px solid var(--vscode-panel-border,#3333)}
  td.k{color:var(--vscode-descriptionForeground);width:130px}
  .pill{display:inline-block;border:1px solid;border-radius:999px;padding:1px 8px;margin:2px;font-size:11px}
  .f{padding:5px 0;border-bottom:1px solid var(--vscode-panel-border,#3333)}
  .f .cat{color:var(--vscode-descriptionForeground);font-size:11px}
  .f.error b{color:#e5484d}.f.warn b{color:#e0a83a}.f.info b{color:#888}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--vscode-descriptionForeground);margin:16px 0 4px}
  footer{margin-top:16px;color:var(--vscode-descriptionForeground);font-size:11px}
  a{color:var(--vscode-textLink-foreground)}
</style></head><body>
  <h1>Masa Web Audit</h1>
  <div class="url">${esc(r.url)}</div>
  <p class="score">${r.score.overall}<span style="font-size:13px;color:var(--vscode-descriptionForeground)"> / 100</span></p>
  <table>
    ${kv("Title", r.title.text ? `${esc(r.title.text)} <span style="color:#888">(${r.title.length})</span>` : "<i>none</i>")}
    ${kv("Description", r.metaDescription.text ? `${esc(r.metaDescription.text)} <span style="color:#888">(${r.metaDescription.length})</span>` : "<i>none</i>")}
    ${kv("Canonical", r.canonical.href ? `${esc(r.canonical.href)} ${r.canonical.isSelf ? "(self)" : "(other)"}` : "<i>none</i>")}
    ${kv("Indexable", r.indexable.value ? "yes" : `no — ${esc(r.indexable.reasons.join(", "))}`)}
    ${kv("H1", r.headings.h1.length ? esc(r.headings.h1.join(" / ")) : "<i>none</i>")}
    ${kv("Headings", Object.entries(r.headings.counts).filter(([, n]) => n).map(([k, n]) => `${k}:${n}`).join("  ") || "<i>none</i>")}
    ${kv("Images", `${r.images.total} total, ${r.images.missingAlt} missing alt`)}
    ${kv("Links", `${r.links.internal} internal, ${r.links.external} external (${r.links.nofollowExternal} nofollow)`)}
    ${kv("Schema", r.schema.types.length ? esc(r.schema.types.join(", ")) : "<i>none</i>")}
    ${kv("Open Graph", r.openGraph["og:title"] ? "present" : "<i>none</i>")}
    ${kv("hreflang", r.hreflang.length ? esc(r.hreflang.map((h) => h.lang).join(", ")) : "<i>none</i>")}
  </table>
  <h2>AI crawlers (GEO)</h2>
  <div>${r.ai.source === "not-fetched" ? "<i>robots.txt not fetched (audit a URL to see this)</i>" : ai}</div>
  <h2>Findings</h2>
  ${findings || "<i>No issues.</i>"}
  <footer>Made by <a href="https://masamedia.co.il">Masa Media Digital LTD</a></footer>
</body></html>`;
}

const sev = (s: Finding["severity"]) => ({ error: "✗", warn: "!", info: "·", good: "✓" }[s]);
const shortName = (p: string) => p.split(/[\\/]/).pop() ?? p;
