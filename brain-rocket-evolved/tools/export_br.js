// Dumps Brain Rocket's hand-made answer lists (../../brain-rocket/js) as JSON, so the
// sequel's data build can keep every answer they already accept and use their tiers as a hint.
//   node tools/export_br.js > tools/cache/br-topics.json
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', '..', 'brain-rocket', 'js');
const html = fs.readFileSync(path.join(dir, '..', 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1]);
const ctx = { localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(ctx);
for (const f of files.slice(0, files.indexOf('questions.js') + 1))
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8') + '\n;this.Quiz = typeof Quiz !== "undefined" ? Quiz : undefined;', ctx, { filename: f });
const out = {};
for (const [id, t] of Object.entries(ctx.Quiz.TOPIC)) {
  if (t.halloween) continue;
  out[id] = { name: t.name, q: t.q, level: t.level, answers: t.entities.map(e => ({ name: e.name, tier: e.tier, alt: e.variants.map(v => v.raw).filter(r => r !== e.name) })) };
}
process.stdout.write(JSON.stringify(out));
