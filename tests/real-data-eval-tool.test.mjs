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
rmSync(dir, { recursive: true, force: true });
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
