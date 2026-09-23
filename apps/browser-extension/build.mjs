// Builds Masa Search Inspector for Chrome/Edge and Firefox from one codebase.
// Output: dist/chrome/ and dist/firefox/ (loadable unpacked), plus zips with --zip.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const ZIP = process.argv.includes("--zip");
const VERSION = "0.1.0";

rmSync(DIST, { recursive: true, force: true });

const baseManifest = {
  manifest_version: 3,
  name: "Masa Search Inspector",
  version: VERSION,
  description:
    "One-click on-page SEO, GEO and AI-visibility audit: title, meta, canonical, schema, hreflang, Open Graph, headings, alt text and AI-crawler access.",
  author: "Masa Media Digital LTD",
  homepage_url: "https://masamedia.co.il/tools/search-inspector/",
  action: { default_popup: "popup.html", default_title: "Masa Search Inspector" },
  icons: { 16: "icons/icon16.png", 32: "icons/icon32.png", 48: "icons/icon48.png", 128: "icons/icon128.png" },
  permissions: ["activeTab", "scripting"],
};

const targets = {
  chrome: { ...baseManifest, minimum_chrome_version: "114" },
  firefox: {
    ...baseManifest,
    browser_specific_settings: {
      gecko: { id: "search-inspector@masamedia.co.il", strict_min_version: "128.0" },
    },
  },
};

async function bundle(entry, outfile, target) {
  await build({
    entryPoints: [join(HERE, "src", entry)],
    outfile,
    bundle: true,
    minify: true,
    format: "iife",
    target: target === "firefox" ? ["firefox128"] : ["chrome114"],
    legalComments: "none",
  });
}

for (const [name, manifest] of Object.entries(targets)) {
  const dir = join(DIST, name);
  mkdirSync(dir, { recursive: true });
  await bundle("popup.ts", join(dir, "popup.js"), name);
  await bundle("analyze-content.ts", join(dir, "analyze.bundle.js"), name);
  cpSync(join(HERE, "public", "popup.html"), join(dir, "popup.html"));
  cpSync(join(HERE, "public", "styles.css"), join(dir, "styles.css"));
  cpSync(join(HERE, "public", "logo.png"), join(dir, "logo.png"));
  cpSync(join(HERE, "public", "icons"), join(dir, "icons"), { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`built dist/${name}/`);
  if (ZIP) {
    const zipPath = join(DIST, `masa-search-inspector-${name}.zip`);
    execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: dir });
    console.log(`packaged ${zipPath}`);
  }
}
