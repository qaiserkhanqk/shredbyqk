// Accuracy of "say it / type it" on realistic phrase sets in tests/phrases/.
// Run: node tests/meal-phrases.mjs [holdout.json | blind.json] [--fail-under 95]
//   meal-phrases.json: tuned on; holdout.json: written after, then fixed; blind.json: scored once before any fix (85%).
import fs from 'node:fs';
import { parseMeal } from '../js/foodtext.js';
const file = process.argv.find(a => a.endsWith('.json')) || 'meal-phrases.json';
const set = JSON.parse(fs.readFileSync(new URL('./phrases/' + file.replace(/^.*\//, ''), import.meta.url)));
const fmt = n => String(Math.round(n * 100) / 100);
let ok = 0; const bad = [];
for (let [text, want] of set) {
  const r = parseMeal(text), got = [...r.items.map(i => `${fmt(i.opts.servings / (i.opts.menuBase || 1))}×${i.ref.id}`), ...r.unknown.map(() => '?')].join(' ');
  want = want.split(' ').sort().join(' ');
  if (got.split(' ').sort().join(' ') === want) ok++; else bad.push(`  "${text}"\n     want ${want}\n     got  ${got || '—'}${r.unknown.length ? '  (didn\'t catch: ' + r.unknown.join(', ') + ')' : ''}`);
}
const pct = Math.round(ok / set.length * 1000) / 10;
if (bad.length) console.log(bad.join('\n'));
console.log(`\nmeal phrases: ${ok}/${set.length} understood exactly (${pct}%)`);
const floor = +(process.argv[process.argv.indexOf('--fail-under') + 1] || 0);
process.exit(process.argv.includes('--fail-under') && pct < floor ? 1 : 0);
