// Bundles WikiDash into one page.
//   node build.mjs              the artifact page, with the demo Warden Chat back end (dist/wikidash.html)
//   node build.mjs --live       talks to the real Warden Chat (an artifact can't reach it; for other hosts)
//   node build.mjs --standalone a complete page to open anywhere (implies --live unless --demo is given)
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const standalone = args.includes("--standalone");
const live = args.includes("--live") || (standalone && !args.includes("--demo"));
const out = args.find((a) => !a.startsWith("--")) || (live ? (standalone ? "dist/wikidash-standalone.html" : "dist/wikidash-live.html") : "dist/wikidash.html");
const dir = new URL(".", import.meta.url).pathname;

const res = await build({
  entryPoints: [dir + (live ? "src/main.js" : "src/main-demo.js")],
  bundle: true,
  format: "iife",
  target: "es2020",
  write: false,
  minify: true,
  legalComments: "none",
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
let css = ["style.css", "artifact.css", "sirsc.css"].map((f) => readFileSync(dir + "src/" + f, "utf8")).join("\n");
// The viewer owns data-theme on the root; the game paints dark through its own class.
css = css.replaceAll('html[data-theme="dark"]', "html.dark").replace(/\n\s*\n/g, "\n");
const intro = readFileSync(dir + "src/intro.html", "utf8");
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,800&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">';
const title = "<title>WikiDash</title>";
// The intro goes first in the body (after the title, which the artifact host looks for in the first 8 KB).
const main = `<div id="app"><div class="center-msg"><div class="spinner"></div></div></div>\n<div id="toasts" aria-live="polite"></div>\n<script>\n${js}\n</script>\n`;
const head = `<meta name="description" content="Race across Wikipedia using only the links.">\n${fonts}\n<style>\n${css}\n</style>\n`;
const page = standalone
  ? `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${title}\n${head}</head>\n<body>\n${intro}${main}</body>\n</html>\n`
  : `${title}\n${intro}${head}${main}`;
// The intro must arrive byte for byte (a "$$" inside it once got eaten by a string replace).
if (!page.includes(intro)) throw new Error("the intro block was changed on its way into the page");
writeFileSync(dir + out, page);
console.log(`wrote ${out} ${Math.round(page.length / 1024)} KB (${live ? "live Warden Chat" : "demo wallet"})`);
