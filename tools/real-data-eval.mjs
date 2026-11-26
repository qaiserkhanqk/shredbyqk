// Walk-forward test of the app's DATES-ONLY next-period estimate (js/cycle/predict.js) on a public, anonymised dataset
// of real cycle lengths: Fehring RJ, "Menstrual Cycle Data" (Marquette University, 2012),
// https://epublications.marquette.edu/data_nfp/7 (participants consented to data reuse; no open licence is stated).
// The data is NOT in this repository. Download the CSV yourself, then:
//   node tools/real-data-eval.mjs "path/to/FedCycleData071012 (2).csv" > report.md
// Only ClientID, CycleNumber and LengthofCycle are read; every other column is ignored. The report contains aggregate
// figures only, never a participant's rows.
//
// Method (no look-ahead): each participant's cycles are laid end to end from an arbitrary first start date. For each
// cycle k, only her starts up to k are logged in a fresh app state, and the app is asked for an estimate the day after
// her period started (cycle day 2). The dates-only estimate does not change during a cycle (it uses only logged starts),
// so later points in the cycle give the same answer. The real next start is then compared with the estimate. Only a participant's first unbroken run of cycle numbers is
// used (a gap or a repeated number ends it), so no dates are guessed.
// What it can show: how the dates-only logic behaves on real cycle-length sequences from this population (women in a
// natural family planning study). What it cannot show: accuracy for other populations, accuracy of any band feature
// (this data has no temperature), or anything clinical.
import { readFileSync } from 'node:fs';
import * as M from '../js/cycle/model.js';
import { addDays, diffDays } from '../js/cycle/dates.js';
import { estimateNext, PARAMS, ALGORITHM_VERSION } from '../js/cycle/predict.js';
import { learningStage } from '../js/cycle/learning.js';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/real-data-eval.mjs <FedCycleData csv>'); process.exit(2); }

function parseCSV(text) { // small RFC 4180 reader: quoted fields, commas, CRLF
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const [head, ...body] = parseCSV(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const col = n => head.findIndex(h => h.trim() === n);
const [iId, iNum, iLen] = ['ClientID', 'CycleNumber', 'LengthofCycle'].map(col);
if ([iId, iNum, iLen].includes(-1)) { console.error('expected columns ClientID, CycleNumber, LengthofCycle'); process.exit(2); }

const people = new Map();
for (const r of body) {
  const id = (r[iId] || '').trim(), num = Number(r[iNum]), len = Number(r[iLen]);
  if (!id || !Number.isInteger(num) || !Number.isInteger(len)) continue;
  (people.get(id) || people.set(id, []).get(id)).push({ num, len });
}
let truncated = 0;
const series = [...people.values()].map(cs => {
  cs.sort((a, b) => a.num - b.num);
  const run = [cs[0]];
  for (const c of cs.slice(1)) { if (c.num !== run.at(-1).num + 1) { truncated++; break; } run.push(c); }
  return run.map(c => c.len);
});

const ANCHOR = '2020-01-06', AT = '2020-01-01T00:00:00.000Z';
const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const rows = [], invariants = [];
for (const lens of series) {
  const starts = [ANCHOR]; for (const l of lens) starts.push(addDays(starts.at(-1), l));
  for (let k = 0; k < lens.length; k++) { // predict starts[k + 1] from starts[0..k]
    const truth = starts[k + 1], past = lens.slice(0, k);
    { const today = addDays(starts[k], 1);
      const s = M.blankState('eval'); M.giveConsent(s, AT);
      for (let j = 0; j <= k; j++) M.logPeriodStart(s, starts[j], { today, at: AT });
      const e = estimateNext(s, today), st = learningStage(s, today);
      if (e.rangeStart && e.rangeStart > e.rangeEnd) invariants.push('range start after end');
      if (e.rangeStart && past.length < PARAMS.EARLY_MIN) invariants.push('a date with no completed cycle');
      if (e.rangeStart && e.lengths?.some(l => !past.includes(l))) invariants.push('used a length that was not hers');
      if (st.usableCycles !== past.length) invariants.push('learning stage count differs from her completed cycles');
      const typical = e.rangeStart ? addDays(e.lastStart, Math.round(e.median)) : null;
      rows.push({ n: past.length, status: e.status, err: typical ? diffDays(truth, typical) : null, inRange: e.rangeStart ? truth >= e.rangeStart && truth <= e.rangeEnd : null,
        width: e.rangeStart ? diffDays(e.rangeStart, e.rangeEnd) + 1 : null, fixed28: diffDays(truth, addDays(starts[k], 28)), last: past.length ? diffDays(truth, addDays(starts[k], past.at(-1))) : null });
    }
  }
}

const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : '–');
const mae = xs => (xs.length ? (xs.reduce((a, v) => a + Math.abs(v), 0) / xs.length).toFixed(2) : '–');
const within = (xs, d) => pct(xs.filter(v => Math.abs(v) <= d).length, xs.length);
function table(rs) {
  const groups = [['1 past cycle', r => r.n === 1], ['2 past cycles', r => r.n === 2], ['3–5 past cycles', r => r.n >= 3 && r.n <= 5], ['6+ past cycles', r => r.n >= 6], ['All with ≥1 past cycle', r => r.n >= 1]];
  const out = ['| History | Cycles | Gave a date | Average error (days) | Within ±1 / ±2 / ±3 days | Real start inside the shown range | Median range width (days) | Fixed 28-day guess: average error | "Same as last cycle": average error |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [label, f] of groups) {
    const g = rs.filter(f), d = g.filter(r => r.err != null), errs = d.map(r => r.err);
    out.push(`| ${label} | ${g.length} | ${pct(d.length, g.length)} | ${mae(errs)} | ${within(errs, 1)} / ${within(errs, 2)} / ${within(errs, 3)} | ${pct(d.filter(r => r.inRange).length, d.length)} | ${d.length ? median(d.map(r => r.width)) : '–'} | ${mae(g.map(r => r.fixed28))} | ${mae(g.filter(r => r.last != null).map(r => r.last))} |`);
  }
  const none = rs.filter(r => r.n === 0);
  out.push('', `With no completed cycle yet (${none.length} cycles): a date was given ${none.filter(r => r.err != null).length} times (should be 0).`);
  const st = {}; for (const r of rs) st[r.status] = (st[r.status] || 0) + 1;
  out.push(`Statuses: ${Object.entries(st).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  return out.join('\n');
}
const nCycles = series.reduce((a, s) => a + s.length, 0);
console.log(`# Dates-only estimate on real cycle lengths (Marquette, Fehring 2012)

**This is a test of software behaviour on real, anonymised cycle-length data. It is not a clinical validation, it says
nothing about any band feature (this data has no temperature), and it may not apply to other groups of women.**

- Data: ${people.size} participants, ${nCycles} cycles used (${truncated} participants' sequences stopped at a gap or repeated cycle number).
- Algorithm: \`${ALGORITHM_VERSION}\` (app code, unchanged). Walk-forward: only her past cycles are used at each point.
- Error = real start − the estimate's typical date (median of her recent cycles), in days.
- "Shown range" = the shortest to longest of her recent cycles, as the app displays it. It is not a confidence interval.
- Baselines for comparison only: a fixed 28-day guess (the app never uses one) and "same length as her last cycle".

## Estimate made the day after her period started
(The dates-only estimate does not change during the cycle, so this is also what she sees later in the cycle.)

${table(rows)}

## Checks on the app's behaviour
${invariants.length ? `**${invariants.length} problems:** ${[...new Set(invariants)].join('; ')}` : 'All passed on every cycle: no range with its start after its end; no date before she has a completed cycle; only her own cycle lengths used; the learning stage counted exactly her completed cycles.'}
`);
