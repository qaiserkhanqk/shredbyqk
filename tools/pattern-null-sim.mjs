// Investigates the SYNTHETIC false-pattern rate of the symptom-pattern rule (js/cycle/patterns.js).
// Every simulated person has NO real pattern: each logged day is "notable" with the same probability on every
// cycle day. Any pattern found is therefore a false finding by construction.
//   node tools/pattern-null-sim.mjs            → markdown table to stdout
//   node tools/pattern-null-sim.mjs --users 400
// This measures the rule's behaviour on invented data. It is NOT a real-world error rate and must not be quoted as one:
// real logging is not random (people log more on bad days), and real symptoms are not independent day to day.
import * as M from '../js/cycle/model.js';
import { findPatterns, evaluateWindow, PATTERN_PARAMS } from '../js/cycle/patterns.js';
import { addDays } from '../js/cycle/dates.js';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : undefined; };
const USERS = arg('--users') || 200, SEED = 7;
function lcg(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

function person(r, { logP, baseP, cyclesN }) {
  const starts = Array.from({ length: cyclesN + 1 }, (_, i) => addDays('2026-01-01', i * 30));
  const s = M.blankState('u'); M.giveConsent(s); M.setCategory(s, 'energy', true);
  for (const d of starts) M.logPeriodStart(s, d, { today: '2027-12-31' });
  starts.slice(0, -1).forEach(st => { for (let d = 0; d < 30; d++) if (r() < logP) M.logDay(s, addDays(st, d), { energy: r() < baseP ? 'low' : 'usual' }, { today: '2027-12-31' }); });
  return s;
}

export function simulate({ users = USERS, seed = SEED } = {}) {
  const rows = [];
  for (const cyclesN of [3, 6]) for (const logP of [0.3, 0.6, 0.9]) for (const baseP of [0.1, 0.15, 0.25]) {
    const r = lcg(seed + Math.round(cyclesN * 1000 + logP * 100 + baseP * 1000));
    let anyScan = 0, patterns = 0, oneWindow = 0;
    for (let u = 0; u < users; u++) {
      const s = person(r, { logP, baseP, cyclesN });
      const found = findPatterns(s); if (found.length) anyScan++; patterns += found.length;
      if (evaluateWindow(s, 'energy', 15).found) oneWindow++; // a single window chosen in advance (cycle day 15)
    }
    rows.push({ cyclesN, logP, baseP, users, anyScanPct: +(100 * anyScan / users).toFixed(1), patternsPerUser: +(patterns / users).toFixed(2), oneWindowPct: +(100 * oneWindow / users).toFixed(1) });
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now(), rows = simulate();
  console.log('# Synthetic false-pattern investigation (NOT a real-world error rate)\n');
  console.log(`Rule: ${JSON.stringify(PATTERN_PARAMS)}. ${USERS} synthetic people per row, none with a real pattern. Seed ${SEED}.\n`);
  console.log('| Complete cycles | Days logged | "Notable" rate | People with ≥1 false pattern (scanning all windows) | False patterns per person | False pattern in ONE pre-chosen window |');
  console.log('|---|---|---|---|---|---|');
  for (const x of rows) console.log(`| ${x.cyclesN} | ${x.logP * 100}% | ${x.baseP * 100}% | ${x.anyScanPct}% | ${x.patternsPerUser} | ${x.oneWindowPct}% |`);
  console.error(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
