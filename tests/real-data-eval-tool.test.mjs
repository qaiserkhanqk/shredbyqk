// Checks tools/real-data-eval.mjs on a tiny SYNTHETIC file in the real dataset's column layout (the real data is never
// in the repository). Run: node tests/real-data-eval-tool.test.mjs
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const dir = mkdtempSync(join(tmpdir(), 'rde-')), f = join(dir, 'synthetic.csv');
// Person A: 6 cycles of 28 days. Person B: cycle numbers 1, 2, 4 (a gap: only cycles 1-2 are used).
// Extra columns, including a sensitive-looking one, must be ignored.
const rows = [['ClientID', 'CycleNumber', 'Religion', 'LengthofCycle'],
  ...[1, 2, 3, 4, 5, 6].map(n => ['A', n, 'x', 28]), ['B', 1, 'y', 30], ['B', 2, 'y', '"32"'], ['B', 4, 'y', 29]];
writeFileSync(f, rows.map(r => r.join(',')).join('\r\n'));
const out = execFileSync('node', ['tools/real-data-eval.mjs', f], { encoding: 'utf8' });
check('reads 2 participants and stops B at the gap (8 cycles used)', /2 participants, 8 cycles used \(1 participants/.test(out), out.split('\n').find(l => l.includes('participants')));
check('no date before a completed cycle', /a date was given 0 times/.test(out));
check('person A (regular 28-day cycles): 5 cycles with 1+ past cycles, all exact; B adds 1 cycle 2 days off', /All with ≥1 past cycle \| 6 \| 100\.0% \| 0\.33 \|/.test(out), out.split('\n').find(l => l.includes('All with')));
check('the behaviour checks pass', /All passed on every cycle/.test(out));
check('no participant rows or other columns appear in the report', !/Religion|\| A \||\| B \|/.test(out));
// The design comparison (tools/compare-designs.mjs) on a larger synthetic file: it must run, and its copy of the
// current design must reproduce the app exactly (the tool stops otherwise).
let x = 99; const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296);
const big = [['ClientID', 'CycleNumber', 'LengthofCycle']];
for (let p = 0; p < 60; p++) { const base = 25 + Math.floor(rnd() * 8); for (let c = 1; c <= 10; c++) big.push([`P${p}`, c, base + Math.floor(rnd() * 7) - 3]); }
const f2 = join(dir, 'synthetic-big.csv'); writeFileSync(f2, big.map(r => r.join(',')).join('\n'));
let cmp = ''; try { cmp = execFileSync('node', ['tools/compare-designs.mjs', f2], { encoding: 'utf8' }); } catch (e) { cmp = String(e.stderr || e); }
check('design comparison runs; its current design matches the app on every point', /checked against the app's own code on every point: identical/.test(cmp), cmp.slice(0, 200));
check('it reports tuning on development only and scoring on test only', /development \d+ participants/.test(cmp) && /test \d+ participants/.test(cmp));
rmSync(dir, { recursive: true, force: true });
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
