// Bundles the extension's TS entry points into dist/ with esbuild, and
// copies static assets (CSS, popup HTML) alongside them.
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    background: "src/background/service-worker.ts",
    content: "src/content/content-script.ts",
    popup: "src/popup/popup.ts",
    offscreen: "src/offscreen/offscreen.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome110",
  sourcemap: true,
});

copyFileSync("src/content/content.css", "dist/content.css");
copyFileSync("src/offscreen/offscreen.html", "dist/offscreen.html");

console.log("Extension build complete -> dist/");
