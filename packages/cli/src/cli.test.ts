// Runs the built CLI (dist/index.js, so run `pnpm build` first) against a local server: no internet needed.
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));

const PAGE = `<!doctype html><html lang="en"><head>
<title>Local test page for masa-audit</title>
<meta name="description" content="A small page the CLI test serves to itself.">
<link rel="canonical" href="/">
</head><body><h1>Hello</h1><img src="/a.png"></body></html>`;
const ROBOTS = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";

function run(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, NO_COLOR: "1" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" }).end(ROBOTS);
    } else if (req.url === "/old") {
      res.writeHead(301, { location: "/" }).end();
    } else if (req.url === "/hebrew") {
      // "שלום" in windows-1255, as older Hebrew sites still serve it
      const title = Buffer.from([0xf9, 0xec, 0xe5, 0xed]);
      res.writeHead(200, { "content-type": "text/html; charset=windows-1255" });
      res.end(Buffer.concat([Buffer.from("<html><head><title>"), title, Buffer.from("</title></head><body><h1>x</h1></body></html>")]));
    } else if (req.url === "/gone") {
      res.writeHead(500, { "content-type": "text/html", "x-robots-tag": "noindex" }).end(PAGE);
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address && typeof address === "object") base = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("masa-audit CLI", () => {
  it("prints help and exits 0 with --help", async () => {
    const r = await run(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage:");
  });

  it("exits 1 with usage on stderr when no URL is given", async () => {
    const r = await run([]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("Usage:");
  });

  it("audits a page and reads robots.txt, as JSON", async () => {
    const r = await run([`${base}/`, "--json"]);
    expect([0, 3]).toContain(r.code);
    const report = JSON.parse(r.stdout);
    expect(report.url).toBe(`${base}/`);
    expect(report.httpStatus).toBe(200);
    expect(report.title.text).toBe("Local test page for masa-audit");
    expect(report.headings.h1).toEqual(["Hello"]);
    expect(report.images.missingAlt).toBe(1);
    expect(report.ai.source).toBe("robots.txt");
    expect(report.ai.agents.GPTBot).toBe("blocked");
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("skips robots.txt with --no-robots", async () => {
    const r = await run([`${base}/`, "--json", "--no-robots"]);
    expect(JSON.parse(r.stdout).ai.source).toBe("not-fetched");
  });

  it("audits the address after redirects", async () => {
    const r = await run([`${base}/old`, "--json"]);
    const report = JSON.parse(r.stdout);
    expect(report.url).toBe(`${base}/`);
    expect(report.canonical.isSelf).toBe(true);
  });

  it("decodes a windows-1255 page", async () => {
    const r = await run([`${base}/hebrew`, "--json", "--no-robots"]);
    expect(JSON.parse(r.stdout).title.text).toBe("שלום");
  });

  it("reports an error page with X-Robots-Tag noindex as not indexable, exit 3", async () => {
    const r = await run([`${base}/gone`, "--json", "--no-robots"]);
    expect(r.code).toBe(3);
    const report = JSON.parse(r.stdout);
    expect(report.indexable.value).toBe(false);
    expect(report.indexable.reasons).toEqual(expect.arrayContaining(["HTTP 500", "X-Robots-Tag: noindex"]));
  });

  it("prints the version and rejects unknown options", async () => {
    const v = await run(["--version"]);
    expect(v.code).toBe(0);
    expect(v.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    const bad = await run([`${base}/`, "--jsno"]);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain("Unknown option: --jsno");
    const ftp = await run(["ftp://example.com"]);
    expect(ftp.code).toBe(1);
  });

  it("exits 2 when the page cannot be fetched", async () => {
    const r = await run(["http://127.0.0.1:9/", "--timeout", "2000"]);
    expect(r.code).toBe(2);
  });
});
