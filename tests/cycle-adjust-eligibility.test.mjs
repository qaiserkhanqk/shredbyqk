// Band-adjusted estimate (js/cycle/adjust.js, research flag temperatureEstimate, default OFF): three cases in which it
// gave a date without enough reliable information (reported against aee2de8). Written BEFORE the fix; the failing run
// is committed in docs/test-logs/. Synthetic data only. Run: node tests/cycle-adjust-eligibility.test.mjs
//   1. After a pregnancy: same restart boundary as the dates-only model.
//   2. A short-lived rise: newer usable nights show the current rise went back to baseline.
//   3. A new band or firmware: rise-to-period history from the old setup must not be combined with a new-setup rise.
// Plus a positive control (valid same-device history still adjusts) and evaluator alignment.
import * as M from '../js/cycle/model.js';
import { addDays, diffDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { startPregnancy, endPregnancy, finishPostpartum } from '../js/cycle/pregnancy.js';
import { adjustedEstimate as adj } from '../js/cycle/adjust.js';
import { sensorModel, baselineModel } from '../js/cycle/eval.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
const AT = '2026-01-01T00:00:00.000Z';
const words = v => JSON.stringify(v);
const D1 = { deviceId: 'd1', model: 'SYN', firmware: '1' };

/**
 * Synthetic nights. `starts`: logged period starts. Nights from the first start to the day before `today`.
 * A +0.4 °C step begins `riseBefore(cycleIndex)` nights before the next start (default 14); in the current cycle,
 * 14 nights after its start. `device(night)` gives the source identity; `value(night, base)` can override a value;
 * `skip(night)` leaves a night out.
 */
function make(starts, today, { riseBefore = () => 14, device = () => D1, value = (d, v) => v, skip = () => false } = {}) {
  const s = M.blankState('u'); M.giveConsent(s, AT); M.setScopeConsent(s, 'wearable', true, AT);
  for (const st of starts) M.logPeriodStart(s, st, { today, at: `${st}T09:00:00.000Z` });
  const nights = [];
  for (let d = starts[0]; d < today; d = addDays(d, 1)) {
    if (skip(d)) continue;
    const i = starts.filter(x => x <= d).length - 1, next = starts[i + 1];
    const high = next ? d >= addDays(next, -riseBefore(i)) : d >= addDays(starts[i], 14);
    nights.push({ night: d, ...device(d), metric: 'skin_temp', status: 'ok', value: value(d, 33.5 + (high ? 0.4 : 0)), flags: [], coverageMin: 480, samples: 48 });
  }
  s.wearable.nights = nights;
  return s;
}
const PRE = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23'];
// The evaluator's frozen-device filter is switched off (null) here, so these checks test the shared eligibility rules.
const ev = (s, t) => sensorModel(s, t, null);
const noDate = a => a.status !== 'adjusted' && !a.rangeStart && !a.date;

run('positive control: valid history from the same band still adjusts', () => {
  const s = make(PRE, '2026-05-15');
  const a = adj(s, '2026-05-15');
  check('same band and firmware throughout, a lasting rise: adjusted', a.status === 'adjusted' && a.rangeStart === '2026-05-21' && a.intervals.length === 4, words(a));
  check('…and the research evaluator gives the same range', ev(s, '2026-05-15').usedSensor && ev(s, '2026-05-15').rangeStart === a.rangeStart);
});

run('1. after a pregnancy', () => {
  // Pre-pregnancy rises 10 days before each period (different on purpose), so any mixing would show.
  const ended = '2026-06-10', after = '2026-07-01';
  const s = make([...PRE, after], '2026-07-24', { riseBefore: () => 10, skip: d => d >= '2026-05-07' && d < after });
  startPregnancy(s, { lmp: '2026-04-23', today: '2026-05-20', at: '2026-05-20T08:00:00.000Z' });
  endPregnancy(s, { outcome: 'ended', date: ended, today: ended, at: `${ended}T08:00:00.000Z` });
  const e = estimateNext(s, '2026-07-24'), a = adj(s, '2026-07-24');
  check('one period since the pregnancy: the dates-only model gives no date', e.status === 'none' && !e.rangeStart, words(e.status));
  check('…and neither does the temperature model, even with a rise this cycle', noDate(a), words(a));
  check('…with a plain reason about the pregnancy', a.reason === 'since_pregnancy' && /pregnan/i.test(a.text || ''), words(a.reason));
  check('…and "Not enough data yet" because neither model can estimate', a.fallback?.status === 'none' && a.fallback.text === 'Not enough data yet.', words(a.fallback));
  check('the evaluator agrees (no sensor use)', ev(s, '2026-07-24').usedSensor === false);
  // Two complete cycles after the pregnancy, each with a rise, plus a rise now → resumes, using only the new cycles.
  const r = make([...PRE, after, '2026-07-29', '2026-08-26'], '2026-09-18', { riseBefore: i => (i < 5 ? 10 : 14), skip: d => d >= '2026-05-07' && d < after });
  startPregnancy(r, { lmp: '2026-04-23', today: '2026-05-20', at: '2026-05-20T08:00:00.000Z' });
  endPregnancy(r, { outcome: 'ended', date: ended, today: ended, at: `${ended}T08:00:00.000Z` });
  const b = adj(r, '2026-09-18');
  check('two eligible new cycles with a rise + a rise now: adjusts again', b.status === 'adjusted', words(b));
  check('…using only cycles after the pregnancy (2 intervals, all 14 days, none of the old 10s)', words(b.intervals) === '[14,14]', words(b.intervals));
  // The same after a birth once postpartum mode is turned off.
  const pb = make([...PRE, after], '2026-07-24', { riseBefore: () => 10, skip: d => d >= '2026-05-07' && d < after });
  startPregnancy(pb, { lmp: '2026-04-23', today: '2026-05-20', at: '2026-05-20T08:00:00.000Z' });
  endPregnancy(pb, { outcome: 'birth', date: ended, today: ended, at: `${ended}T08:00:00.000Z` }); finishPostpartum(pb, { at: '2026-07-02T08:00:00.000Z' });
  check('after a birth, with postpartum mode off: still no date from one new period', noDate(adj(pb, '2026-07-24')) && estimateNext(pb, '2026-07-24').status === 'none', words(adj(pb, '2026-07-24')));
});

run('2. a short-lived rise', () => {
  // Rise on 7, 8, 9 May (enough to detect), back to the baseline level from 10 May; today 15 May.
  const s = make(PRE, '2026-05-15', { value: (d, v) => (d >= '2026-05-10' && d < '2026-05-15' ? 33.5 : v) });
  const a = adj(s, '2026-05-15'), e = estimateNext(s, '2026-05-15');
  check('newer usable nights show the rise went back to baseline: not adjusted', noDate(a), words(a));
  check('…with a plain reason, and no claim about what it means', a.reason === 'rise_ended' && /back/i.test(a.text || '') && !/ovulat|fertil/i.test(words(a)), words(a));
  check('…falling back to the dates-only result, which is shown', a.fallback?.status === 'dates_only' && a.fallback.rangeStart === e.rangeStart && a.fallback.rangeEnd === e.rangeEnd && /dates/i.test(a.fallback.text || ''), words(a.fallback));
  check('the evaluator falls back to the dates-only model too', (() => { const x = ev(s, '2026-05-15'), y = baselineModel(s, '2026-05-15'); return x.usedSensor === false && x.rangeStart === y.rangeStart; })());
  // Control: the same rise still going today is used.
  check('control: the same rise, still elevated, is used', adj(make(PRE, '2026-05-15'), '2026-05-15').status === 'adjusted');
});

run('3. a new band or firmware', () => {
  const fw2From = from => d => (d >= from ? { ...D1, firmware: '2' } : D1);
  const a = adj(make(PRE, '2026-05-15', { device: fw2From('2026-04-23') }), '2026-05-15');
  check('new firmware this cycle, history from the old firmware: not adjusted', noDate(a), words(a));
  check('…with a plain reason about the change', a.reason === 'new_setup' && /changed/i.test(a.text || ''), words(a));
  check('…and the dates-only result is shown instead', a.fallback?.status === 'dates_only' && a.fallback.rangeStart === '2026-05-21', words(a.fallback));
  const b = adj(make(PRE, '2026-05-15', { device: d => (d >= '2026-04-23' ? { ...D1, deviceId: 'd2' } : D1) }), '2026-05-15');
  check('a different band of the same model: not combined either', noDate(b) && b.reason === 'new_setup', words(b));
  const c = adj(make(PRE, '2026-05-15', { device: d => (d >= '2026-04-23' ? { deviceId: 'd1', model: 'SYN' } : D1) }), '2026-05-15');
  check('firmware unknown for the current readings: waits (no compatibility guess)', noDate(c) && c.reason === 'setup_unknown', words(c));
  const u = adj(make(PRE, '2026-05-15', { device: () => ({ deviceId: 'd1', model: 'SYN' }) }), '2026-05-15');
  check('identity unknown throughout: still not combined (unknown is never treated as the same)', noDate(u) && u.reason === 'setup_unknown', words(u));
  const one = adj(make(PRE, '2026-05-15', { device: fw2From('2026-03-26') }), '2026-05-15');
  check('one cycle of history from the new setup: still waiting', noDate(one) && one.reason === 'new_setup', words(one));
  const two = adj(make(PRE, '2026-05-15', { device: fw2From('2026-02-26') }), '2026-05-15');
  check('two cycles of history from the new setup: adjusts, using only that history', two.status === 'adjusted' && two.intervals.length === 2, words(two));
  check('the evaluator applies the same rule', ev(make(PRE, '2026-05-15', { device: fw2From('2026-04-23') }), '2026-05-15').usedSensor === false);
});

run('wording', () => {
  const all = [adj(make(PRE, '2026-05-15', { value: (d, v) => (d >= '2026-05-10' ? 33.5 : v) }), '2026-05-15'),
    adj(make(PRE, '2026-05-15', { device: d => (d >= '2026-04-23' ? { ...D1, firmware: '2' } : D1) }), '2026-05-15')];
  check('no forbidden wording and no ovulation, fertility or contraception claims', all.every(a => !FORBIDDEN.some(([, re]) => re.test(words(a))) && !/ovulat|fertil|safe day/i.test(words(a))));
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
