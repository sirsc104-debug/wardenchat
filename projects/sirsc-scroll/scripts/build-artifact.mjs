// Turns dist/artifact/index.html (a full single-file page) into the body-only page the
// claude.ai Artifact host expects: it wraps the file in its own <!doctype>/<html>/<head>/<body>,
// so this keeps the <title>, the inlined <style>, the app's markup and the inlined script.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist/artifact/index.html', 'utf8');
const title = src.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>SirSC Scroll</title>';
const styles = [...src.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...src.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]);
const body = (src.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').trim();
if (!styles.length || !scripts.length || !body.includes('id="root"')) {
  console.error('build-artifact: unexpected input shape');
  process.exit(1);
}
const out = `${title}\n${styles.join('\n')}\n${body}\n${scripts.join('\n')}\n`;
writeFileSync('dist/sirsc-scroll-artifact.html', out);
console.log(`dist/sirsc-scroll-artifact.html: ${(out.length / 1024).toFixed(0)} KB`);
