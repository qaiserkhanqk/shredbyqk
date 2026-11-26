#!/usr/bin/env node
// Run the photo test against the live recognition server and score it.
//   python3 tools/fetch-test-photos.py test-photos
//   GEMINI_API_KEY=... node tools/food-vision-server.mjs &
//   node tools/photo-test.mjs test-photos http://localhost:8787/food-vision
// Prints each photo's result and a summary: main dish right / fixable with one tap / wrong.
// The expected dish comes from the Commons category, which is noisy (see docs/PHOTO-TEST.md),
// so read the "wrong" lines before trusting the number.
import fs from 'node:fs';
import path from 'node:path';
import { consensus, catalogue } from '../js/foodphoto.js';
import { DISH } from '../js/nutrition.js';

const dir = process.argv[2] || 'test-photos', endpoint = process.argv[3] || 'http://localhost:8787/food-vision';
const list = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const tally = { right: 0, oneTap: 0, wrong: 0, failed: 0 };
for (const e of list) {
  const image = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, e.file)).toString('base64');
  let c;
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, samples: 3, catalogue: catalogue() }) });
    if (!r.ok) throw new Error('server ' + r.status);
    c = consensus((await r.json()).samples);
  } catch (err) { tally.failed++; console.log(`FAIL ${e.file}: ${err.message}`); continue; }
  const first = c.items[0]?.dish, fam = d => DISH[d]?.fam;
  const verdict = first === e.expect ? 'right' : c.items.some(i => i.dish === e.expect || i.alternative === e.expect) || (fam(first) && fam(first) === fam(e.expect)) ? 'oneTap' : 'wrong';
  tally[verdict]++;
  console.log(`${verdict.padEnd(6)} ${e.file.padEnd(24)} want ${e.expect.padEnd(16)} got ${c.items.map(i => `${i.dish || 'other:' + i.otherName}×${i.servings}`).join(', ') || '(nothing)'}  [scene ${c.scene}]`);
}
const n = list.length - tally.failed;
console.log(`\n${n} photos: ${tally.right} right (${Math.round(tally.right / n * 100)}%), ${tally.oneTap} one tap, ${tally.wrong} wrong${tally.failed ? `, ${tally.failed} failed` : ''}`);
