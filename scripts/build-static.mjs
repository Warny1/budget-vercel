import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = "dist";
const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
};

rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });

writeFileSync("config.js", `window.BUDGET_CONFIG = ${JSON.stringify(config, null, 2)};\n`);

for (const file of ["index.html", "styles.css", "app.js", "config.js", "sw.js", "manifest.webmanifest", "icon.svg"]) {
  copyFileSync(file, join(distDir, file));
}
