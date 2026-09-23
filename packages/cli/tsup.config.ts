import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  target: "node18",
  // Bundle the core so the published CLI is self-contained.
  noExternal: ["@masamedia/audit-core"],
  banner: { js: "#!/usr/bin/env node" },
});
