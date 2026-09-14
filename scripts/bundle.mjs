// Bundles the compiled CLI and MCP server into self-contained single files so
// the repo can be installed without npm install. Run via `npm run bundle`.
import { build } from "esbuild";

await build({
  entryPoints: ["dist/cli.js", "dist/mcp/server.js"],
  outdir: "dist",
  allowOverwrite: true,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "inline",
  // CJS deps (jimp's gifwrap) call require("fs") at runtime; the ESM output
  // needs a real require bound to this module's URL.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

console.log("bundle written to dist/cli.js and dist/mcp/server.js");
