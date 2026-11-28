// Calibrated range for the dates-only estimate (product owner's decision, 2026-11-26, after the held-out comparison in
// docs/design-comparison-marquette.md). Written BEFORE the change. Synthetic dates only. Run: node tests/cycle-calibrated-range.test.mjs
//   • The DATE (typical next start) is unchanged: her last start + the median of her last 6 usable cycles.
//   • The RANGE is now last start + median ± 1.20 × s, where s is her own cycle-to-cycle spread steadied by a population
//     spread of 2.94 days (worth 3 cycles), rounded to whole days. Both numbers were set on the development group only;
//     on the held-out test group the range held the real start 83.5% of the time (80–85% at every history length).
//   • The population figure only sets the WIDTH. No population cycle length (e.g. 28 days) ever sets the date, and no
//     date is given before one completed cycle.
import * as M from '../js/cycle/model.js';
import { addDays, diffDays } from '../js/cycle/dates.js';
import * as P from '../js/cycle/predict.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const AT = '2026-01-01T00:00:00.000Z';
function withLengths(lens, first = '2026-01-05') {
  const s = M.blankState('u'); M.giveConsent(s, AT);
  const starts = [first]; for (const l of lens) starts.push(addDays(starts.at(-1), l));
  for (const st of starts) M.logPeriodStart(s, st, { today: addDays(starts.at(-1), 1), at: AT });
  return { s, last: starts.at(-1), today: addDays(starts.at(-1), 1) };
}
const off = (e, d) => diffDays(e.lastStart, d);

check('version bumped to a calibrated-range algorithm', /^dates-only-2\./.test(P.ALGORITHM_VERSION), P.ALGORITHM_VERSION);
check('range settings are exported and documented (multiplier 1.20, population spread 2.94 days, weight 3 cycles)', P.RANGE?.Z === 1.2 && P.RANGE?.POP_SD === 2.94 && P.RANGE?.PRIOR_CYCLES === 3, JSON.stringify(P.RANGE));

{ const { s, today } = withLengths([28]); const e = P.estimateNext(s, today);
  check('one 28-day cycle: date at day 28, range day 24 to day 32 (9 days)', off(e, e.rangeStart) === 24 && off(e, e.rangeEnd) === 32 && Math.round(e.median) === 28, `${off(e, e.rangeStart)}–${off(e, e.rangeEnd)}`); }
{ const { s, today } = withLengths([28, 28, 28, 28, 28, 28]); const e = P.estimateNext(s, today);
  check('six identical 28-day cycles: day 26 to day 30 (it no longer pretends to a single day)', off(e, e.rangeStart) === 26 && off(e, e.rangeEnd) === 30 && !e.singleDate, `${off(e, e.rangeStart)}–${off(e, e.rangeEnd)}`); }
{ const { s, today } = withLengths([24, 34, 26, 33, 25, 32]); const e = P.estimateNext(s, today), w = diffDays(e.rangeStart, e.rangeEnd);
  const r = withLengths([28, 29, 28, 29, 28, 29]), er = P.estimateNext(r.s, r.today), wr = diffDays(er.rangeStart, er.rangeEnd);
  check('her own variability widens the range (variable cycles get a wider range than steady ones)', w > wr, `${w} vs ${wr}`); }
{ const { s, today } = withLengths([27, 31, 29]); const e = P.estimateNext(s, today);
  check('the date is unchanged: last start + median of her cycles (29)', diffDays(e.lastStart, addDays(e.lastStart, Math.round(e.median))) === 29 && e.median === 29);
  check('the range is centred on that date', off(e, e.rangeStart) + off(e, e.rangeEnd) === 58, `${off(e, e.rangeStart)}–${off(e, e.rangeEnd)}`);
  check('the result says it is calibrated, how, and on what data', e.calibrated === true && e.intervalSource === 'calibrated-80' && /Marquette/.test(e.calibration?.source || '') && e.calibration?.heldOutCoverage === 0.835, JSON.stringify(e.calibration));
  check('the wording says about 8 in 10, in a research dataset, not validated for her, and that it can fall outside', /8 in 10/.test(e.detail) && /research/i.test(e.detail) && /not (been )?validated/i.test(e.detail) && /earlier or later/i.test(e.detail), e.detail);
  check('no forbidden or fertility wording', !FORBIDDEN.some(([, re]) => re.test(JSON.stringify(e))) && !/ovulat|fertil/i.test(JSON.stringify(e))); }
{ const s = M.blankState('u'); M.giveConsent(s, AT); M.logPeriodStart(s, '2026-03-01', { today: '2026-03-02', at: AT });
  check('still no date before one completed cycle (no 28-day default)', !P.estimateNext(s, '2026-03-02').rangeStart); }
{ const { s, today } = withLengths([22, 45, 24, 44]); const e = P.estimateNext(s, today);
  check('cycles too variable: still no range (unchanged)', e.status === 'too_variable' && !e.rangeStart, e.status); }
{ const { s, last } = withLengths([28, 28, 28, 28, 28, 28]); const e = P.estimateNext(s, addDays(last, 31));
  check('overdue only after the end of the (new) range: day 31 > day 30', e.overdue === true && P.estimateNext(s, addDays(last, 30)).overdue === false); }
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
