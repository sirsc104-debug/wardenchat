// Bundles the game into one self-contained HTML page (CSS and JS inlined).
// Usage: node tools/build-artifact.js <output.html>
// The output has no <html>/<head>/<body> wrapper, which is the format a
// Claude artifact expects; open index.html directly for normal play.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'dist', 'sands-of-the-pharaoh.html');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
let body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
body = body.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  return '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
const page = [title, fonts, '<style>\n' + css + '\n</style>', body.trim()].join('\n');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log('wrote', out, Math.round(page.length / 1024) + ' KB');
