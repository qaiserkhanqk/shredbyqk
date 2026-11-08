// Regression suite: replays every recorded session in tests/fixtures/ and checks the stored expectation.
// When a real client session exposes a bug, save it here with the correct answer: it then can never regress.
// Run: node tests/regression.test.mjs
import fs from 'node:fs';
import { replay } from './replay.mjs';
import { agreement } from './validate.mjs';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

for (const file of fs.readdirSync('tests/fixtures').filter(f => f.endsWith('.json'))) {
  const json = JSON.parse(fs.readFileSync('tests/fixtures/' + file, 'utf8')), e = json.meta.expect || {};
  const r = replay(json);
  if (json.meta.kind === 'form') check(`${file}: ${e.reps} reps, ${e.clean} clean`, r.reps === e.reps && r.clean === e.clean, `got ${r.reps} reps, ${r.clean} clean`);
  if (json.meta.kind === 'gait') check(`${file}: cadence ${e.cadenceMin}–${e.cadenceMax}, finds "${e.finding}"`, r.ok && r.cadence >= e.cadenceMin && r.cadence <= e.cadenceMax && r.findings.some(f => f.title.toLowerCase().includes(e.finding)), `cadence ${r.cadence?.toFixed(1)}`);
}

// Validation statistics on data with known properties.
const ref = [30, 35, 40, 45, 50, 38, 42, 33];
const same = agreement(ref, ref);
check('agreement: identical data → bias 0, ICC 1', Math.abs(same.bias) < 1e-12 && Math.abs(same.icc - 1) < 1e-9);
const off = agreement(ref.map(v => v + 2), ref);
check('agreement: +2 offset → bias 2, MAE 2, LoA collapses to 2', Math.abs(off.bias - 2) < 1e-9 && Math.abs(off.mae - 2) < 1e-9 && Math.abs(off.loaLow - 2) < 1e-9);
check('agreement: constant offset lowers absolute-agreement ICC below 1', off.icc < 1 && off.icc > 0.8, off.icc.toFixed(3));
const noisy = agreement(ref.map((v, i) => v + [1, -1, 0.5, -0.5, 1.5, -1.5, 0, 0.8][i]), ref);
check('agreement: small random error → ICC excellent', noisy.band === 'excellent', noisy.icc.toFixed(3));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
