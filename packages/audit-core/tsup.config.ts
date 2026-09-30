import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2021",
  // node-html-parser stays a regular dependency (not bundled), so its licence ships with it.
  // Browser / VS Code consumers bundle it themselves.
});
