import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(HERE, "src", "extension.ts")],
  outfile: join(HERE, "dist", "extension.js"),
  bundle: true,
  minify: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  external: ["vscode"], // provided by the editor host
  legalComments: "none",
});
console.log("built dist/extension.js");
