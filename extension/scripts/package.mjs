// Builds the extension and zips exactly what Chrome Web Store needs into
// deal-assistant-extension.zip, ready to upload as-is.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const zipPath = "deal-assistant-extension.zip";

console.log("Building...");
execSync("node scripts/build.mjs", { stdio: "inherit" });

if (existsSync(zipPath)) rmSync(zipPath);

console.log("Zipping...");
execSync(
  [
    "zip -r",
    zipPath,
    "manifest.json",
    "icons",
    "dist/background.js",
    "dist/content.js",
    "dist/content.css",
    "dist/popup.js",
    "dist/offscreen.js",
    "dist/offscreen.html",
    "src/popup/popup.html",
  ].join(" "),
  { stdio: "inherit" }
);

console.log(`\nDone -> ${zipPath}. Upload this file directly to the Chrome Web Store dashboard.`);
