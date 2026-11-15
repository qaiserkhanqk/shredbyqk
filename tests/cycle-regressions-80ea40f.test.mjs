// Regression tests for issues independently reproduced in snapshot 80ea40f. Written BEFORE the fixes; the failing
// run on unchanged 80ea40f is committed in docs/test-logs/. Synthetic data only. Run: node tests/cycle-regressions-80ea40f.test.mjs
import * as M from '../js/cycle/model.js';
import { normalise, summariseNights, mergeNights } from '../js/cycle/wearables.js';
import { retrospectiveShift } from '../js/cycle/tempshift.js';
import { phaseInfo } from '../js/cycle/phase.js';
import { findPatterns, evaluateRange, evidenceText, patternStatus } from '../js/cycle/patterns.js';
import { estimateNext } from '../js/cycle/predict.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const T = '2026-11-15';

/* ---------- 1. Poor-quality readings ---------- */
{
  const now = Date.parse('2026-11-14T00:00:00Z'), t0 = Date.parse('2026-11-01T23:00:00Z');
  const pk = (i, o = {}) => ({ deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', value: 33.9, unit: 'degC', tzOffsetMin: 0, kind: 'raw', tStart: t0 + i * 1800e3, tEnd: t0 + (i + 1) * 1800e3, ...o });
  const allPoor = summariseNights(normalise(Array.from({ length: 6 }, (_, i) => pk(i, { vendorQuality: 'poor' })), { now }).readings)[0];
  check('1 six contiguous 30-min readings all marked poor: not an "ok" night, all 6 rejected', allPoor.status !== 'ok' && allPoor.value === null && allPoor.rejected === 6, JSON.stringify({ status: allPoor.status, rejected: allPoor.rejected }));
  check('1 rejection reasons are recorded per reason', allPoor.rejectedBy?.vendor_poor === 6, JSON.stringify(allPoor.rejectedBy));
  const mixed = summariseNights(normalise([...Array.from({ length: 6 }, (_, i) => pk(i)), ...Array.from({ length: 6 }, (_, i) => pk(i + 6, { vendorQuality: 'poor' }))], { now }).readings)[0];
  check('1 mixed night: only the good readings are used, poor ones counted as rejected', mixed.samples === 6 && mixed.rejected === 6 && mixed.rejectedBy?.vendor_poor === 6, JSON.stringify({ samples: mixed.samples, rejected: mixed.rejected, rejectedBy: mixed.rejectedBy }));
  // Poor nights can't trigger a temperature shift: baseline good, three "high" nights made only of poor readings
  const s = M.blankState('u'); M.giveConsent(s); M.logPeriodStart(s, '2026-10-01', { today: T });
  const packets = [];
  for (let d = 0; d < 12; d++) {
    const night0 = Date.parse(addDays('2026-10-01', d) + 'T23:00:00Z');
    for (let i = 0; i < 8; i++) packets.push({ deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', unit: 'degC', tzOffsetMin: 0, kind: 'raw', tStart: night0 + i * 1800e3, tEnd: night0 + (i + 1) * 1800e3,
      value: d >= 8 ? 34.4 : 33.8, ...(d >= 8 ? { vendorQuality: 'poor' } : {}) });
  }
  s.wearable.nights = summariseNights(normalise(packets, { now }).readings);
  check('1 nights made only of poor readings cannot trigger a temperature shift', !retrospectiveShift(s, '2026-10-01', '2026-10-20').detected);
}

/* ---------- 2. Historical temperature event vs current phase ---------- */
const tn = (night, v, o = {}) => ({ night, deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', unit: 'degC', status: 'ok', value: v, flags: [], ...o });
function tempUser(start, values, { periods = [start] } = {}) {
  const s = M.blankState('u'); M.giveConsent(s); for (const p of periods) M.logPeriodStart(s, p, { today: T });
  values.forEach((v, d) => { if (v != null) s.wearable.nights.push(tn(addDays(start, d), v)); });
  return s;
}
{
  // August: 3-night rise then back to baseline; it's now November, no new period logged
  const start = '2026-08-01', vals = Array.from({ length: 100 }, (_, d) => (d >= 14 && d < 17 ? 34.3 : 33.8));
  const s = tempUser(start, vals, { periods: ['2026-06-03', '2026-07-03', start] });
  const today = addDays(start, 100);
  const p = phaseInfo(s, today, { tempShift: retrospectiveShift(s, start, addDays(today, 1)) });
  check('2 a temporary August rise that returned to baseline is not shown in November as "possibly after ovulation"', p.status !== 'estimate', JSON.stringify(p));
}
{
  // Contradictory: rise confirmed, then back to baseline within the same cycle, today soon after
  const start = '2026-10-20', vals = Array.from({ length: 24 }, (_, d) => (d >= 12 && d < 15 ? 34.3 : 33.8));
  const s = tempUser(start, vals, { periods: ['2026-08-21', '2026-09-20', start] });
  const today = addDays(start, 24);
  check('2 contradictory evidence (rise, then back to baseline): abstains', phaseInfo(s, today, { tempShift: retrospectiveShift(s, start, addDays(today, 1)) }).status !== 'estimate');
}
{
  // Missing: rise sustained but no readings for the last 5 nights
  const start = '2026-10-20', vals = Array.from({ length: 20 }, (_, d) => (d >= 12 ? 34.3 : 33.8));
  const s = tempUser(start, vals, { periods: ['2026-08-21', '2026-09-20', start] });
  const today = addDays(start, 25);
  check('2 missing recent evidence (no readings for the last nights): abstains', phaseInfo(s, today, { tempShift: retrospectiveShift(s, start, addDays(today, 1)) }).status !== 'estimate');
}
{
  // Control: rise sustained through last night, within the person's usual cycle length → still an estimate
  const start = '2026-10-25', vals = Array.from({ length: 21 }, (_, d) => (d >= 12 ? 34.3 : 33.8));
  const s = tempUser(start, vals, { periods: ['2026-08-26', '2026-09-25', start] });
  const today = addDays(start, 21);
  check('2 control: a rise still present last night, within usual cycle length, can still be shown as an estimate', phaseInfo(s, today, { tempShift: retrospectiveShift(s, start, addDays(today, 1)) }).status === 'estimate');
}

/* ---------- 3. Patterns: unknown comparison is not 0% ---------- */
{
  const starts = Array.from({ length: 7 }, (_, i) => addDays('2026-03-01', i * 30));
  const s = M.blankState('u'); M.giveConsent(s); M.setCategory(s, 'energy', true);
  for (const d of starts) M.logPeriodStart(s, d, { today: T });
  [0, 2, 4].forEach(ci => M.logDay(s, addDays(starts[ci], 23), { energy: 'low' }, { today: T })); // day 24 in 3 of 6 cycles, nothing else
  const w = evaluateRange(s, 'energy', 24, 24);
  check('3 no logs outside the window: the outside rate is unknown (null), not 0', w.outsideRate === null, String(w.outsideRate));
  check('3 …and no pattern is surfaced without comparative evidence', findPatterns(s).length === 0);
  check('3 the explanation never says "0% of your logs at other times"', !/0% of your logs at other times/.test(evidenceText({ ...w, completeCycles: 6 })));
  const st = patternStatus(s)[0];
  check('3 the status says the comparison is missing', st.status !== 'found' && /other times|compare/i.test(st.why || ''), JSON.stringify(st));
}

/* ---------- 4. Past-cycle window is not an uncertainty interval ---------- */
{
  const starts = Array.from({ length: 7 }, (_, i) => addDays('2026-01-07', i * 28));
  const s = M.blankState('u'); M.giveConsent(s); for (const d of starts) M.logPeriodStart(s, d, { today: '2026-07-01' });
  const e = estimateNext(s, '2026-07-01');
  const point = e.rangeStart === e.rangeEnd;
  check('4 six identical 28-day cycles: a single date is not called an "estimated range"', !point || !/range/i.test(e.headline), JSON.stringify({ headline: e.headline, from: e.rangeStart, to: e.rangeEnd }));
  check('4 the text always says the period can fall outside what past cycles show', /earlier or later/i.test(e.detail), e.detail);
  check('4 the result declares it is not a calibrated interval', e.calibrated === false && e.intervalSource === 'past-cycles-only');
  const s1 = M.blankState('u'); M.giveConsent(s1); M.logPeriodStart(s1, '2026-09-20', { today: T }); M.logPeriodStart(s1, '2026-10-30', { today: T });
  const e1 = estimateNext(s1, T);
  check('4 no invented padding: one 40-day cycle shows day 40 only, not a ±2-day "range"', e1.rangeStart === addDays('2026-10-30', 40) && e1.rangeEnd === addDays('2026-10-30', 40), `${e1.rangeStart}–${e1.rangeEnd}`);
}

/* ---------- 5. Identical resyncs keep the first-known time ---------- */
{
  const n0 = tn('2026-01-10', 33.9, { samples: 48, rejected: 0, coverageMin: 480 });
  let nights = mergeNights([], [n0], { at: '2026-01-11T08:00:00.000Z' });
  nights = mergeNights(nights, [{ ...n0 }], { at: '2026-06-01T08:00:00.000Z' }); // identical resync in June
  const s = M.blankState('u'); M.giveConsent(s); s.wearable.nights = nights;
  check('5 identical resync keeps the January sync time', nights[0].syncedAt === '2026-01-11T08:00:00.000Z', nights[0].syncedAt);
  check('5 the January historical view still has the night', M.stateAsOf(s, '2026-01-20').wearable.nights.length === 1);
  nights = mergeNights(nights, [{ ...n0, value: 34.4 }], { at: '2026-06-02T08:00:00.000Z' }); // material change later
  s.wearable.nights = nights;
  check('5 a later material change: January view shows the January value, current view the new one',
    M.stateAsOf(s, '2026-01-20').wearable.nights[0]?.value === 33.9 && s.wearable.nights[0].value === 34.4, JSON.stringify(M.stateAsOf(s, '2026-01-20').wearable.nights.map(n => n.value)));
}

/* ---------- 6. Day values are versioned ---------- */
{
  const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z'); M.setCategory(s, 'mood', true, { at: '2026-01-01T00:00:00.000Z' });
  M.logDay(s, '2026-01-10', { mood: 'low' }, { today: '2026-01-10', at: '2026-01-10T20:00:00.000Z' });
  M.logDay(s, '2026-01-10', { mood: 'good' }, { today: '2026-06-01', at: '2026-06-01T09:00:00.000Z' }); // corrected in June
  check('6 current view shows the corrected value', s.days['2026-01-10'].mood === 'good');
  check('6 the January historical view keeps what was known in January', M.stateAsOf(s, '2026-01-15').days['2026-01-10']?.mood === 'low', JSON.stringify(M.stateAsOf(s, '2026-01-15').days['2026-01-10']));
  M.logDay(s, '2026-01-10', { mood: null }, { today: '2026-06-02', at: '2026-06-02T09:00:00.000Z' }); // user deletes the entry
  check('6 a deleted entry is gone from current AND historical views (deletion honoured)', !s.days['2026-01-10'] && !M.stateAsOf(s, '2026-01-15').days['2026-01-10']);
  M.logDay(s, '2026-01-12', { mood: 'low' }, { today: '2026-01-12', at: '2026-01-12T20:00:00.000Z' });
  M.logDay(s, '2026-01-12', { mood: 'anxious' }, { today: '2026-06-03', at: '2026-06-03T09:00:00.000Z' });
  M.setCategory(s, 'mood', false, { purge: true });
  check('6 purge (consent withdrawal for mood) removes the value and its history everywhere', !JSON.stringify(s).includes('anxious') && !JSON.stringify(s).includes('"low"') && !M.stateAsOf(s, '2026-01-15').days['2026-01-12']);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
