#!/usr/bin/env node
'use strict';
/* Builds dist/claude-code-clicker.html: the whole game in one self-contained file, for pasting into
   Google Sites (Insert > Embed > Embed code) or anywhere else that takes a single HTML file.
   Usage: node tools/build-single.js
   If the optional packages "terser" and "csso" can be required (e.g. via NODE_PATH), the output is minified. */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const optional = name => { try { return require(name); } catch (e) { return null; } };
const terser = optional('terser');
const csso = optional('csso');

async function main() {
  let html = read('index.html');
  const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n?/g)].map(m => m[1]);
  if (!scripts.length) throw new Error('No scripts found in index.html');

  let css = read('css/style.css');
  if (csso) css = csso.minify(css).css;
  html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);

  const parts = ['<script>window.CCC_EMBED = true;</script>'];
  for (const f of scripts) {
    let code = read(f);
    if (terser) {
      // Top-level names are shared between the scripts, so they must keep their names.
      const out = await terser.minify(code, { compress: { passes: 2 }, mangle: true, toplevel: false, format: { comments: false } });
      code = out.code;
    }
    if (/<\/script/i.test(code)) code = code.replace(/<\/script/gi, '<\\/script');
    parts.push(`<script>/* ${f} */\n${code}\n</script>`);
  }
  // Swap the first script tag for the inlined bundle and drop the rest.
  let first = true;
  html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, () => (first ? ((first = false), parts.join('\n') + '\n') : ''));

  const out = path.join(root, 'dist', 'claude-code-clicker.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`Wrote ${path.relative(root, out)}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB` +
    `${terser ? ', minified' : ' (install terser and csso to minify)'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
