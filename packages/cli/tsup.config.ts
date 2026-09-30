import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  target: "node20",
  // Bundle Masa's own core so the CLI is one file; node-html-parser stays a normal dependency (with its own licence).
  noExternal: ["@masamedia/audit-core"],
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: "#!/usr/bin/env node" },
});
