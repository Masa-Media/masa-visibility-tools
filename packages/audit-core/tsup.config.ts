import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2021",
  // node-html-parser is bundled so browser/VS Code consumers get a single file.
  noExternal: ["node-html-parser"],
});
