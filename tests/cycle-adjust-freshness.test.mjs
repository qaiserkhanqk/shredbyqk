// Band-adjusted estimate (flag temperatureEstimate, default OFF): it kept showing a band-adjusted date after the band
// stopped sending usable overnight temperatures (reported: last usable night 12 April, still showing the 23 April
// band-adjusted date on 19 May, and the card did not show that it was overdue). Written BEFORE the fix; the failing
// run is committed in docs/test-logs/. Synthetic data only. Run: node tests/cycle-adjust-freshness.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { FLAG_DEFS } from '../js/cycle/flags.js';
import * as A from '../js/cycle/adjust.js';
import { sensorModel } from '../js/cycle/eval.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
const adj = A.adjustedEstimate, lines = a => (A.cardLines ? A.cardLines(a) : null);
const AT = '2026-01-01T00:00:00.000Z', D1 = { deviceId: 'd1', model: 'SYN', firmware: '1' };
const words = v => JSON.stringify(v);
const night = (d, more = {}) => ({ night: d, ...D1, metric: 'skin_temp', status: 'ok', value: 33.9, flags: [], coverageMin: 480, samples: 48, ...more });

/** Starts every 28 days; a +0.4 °C step 14 nights before each next start, and from cycle day 15 in the current cycle.
 *  Nights from the first start up to and including `lastNight` (the last night the band sent anything usable). */
function make(starts, lastNight, { value = (d, v) => v } = {}) {
  const s = M.blankState('u'); M.giveConsent(s, AT); M.setScopeConsent(s, 'wearable', true, AT);
  for (const st of starts) M.logPeriodStart(s, st, { today: '2026-12-31', at: `${st}T09:00:00.000Z` });
  for (let d = starts[0]; d <= lastNight; d = addDays(d, 1)) {
    const i = starts.filter(x => x <= d).length - 1, next = starts[i + 1];
    const high = next ? d >= addDays(next, -14) : d >= addDays(starts[i], 14);
    s.wearable.nights.push(night(d, { value: value(d, 33.5 + (high ? 0.4 : 0)), syncedAt: `${addDays(d, 1)}T07:00:00.000Z` }));
  }
  return s;
}
const STARTS = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']; // next due 23 April; rise from 9 April
const COPY = 'No recent usable band data. This estimate is based on your logged periods.';
const noDate = a => a.status !== 'adjusted' && !a.rangeStart && !a.date;

run('the reported regression: last usable night 12 April, viewed on 19 May', () => {
  const s = make(STARTS, '2026-04-12');
  const fresh = adj(s, '2026-04-13');
  check('control: on 13 April (fresh data) the band-adjusted estimate is 23 April', fresh.status === 'adjusted' && fresh.rangeStart === '2026-04-23', words(fresh));
  const a = adj(s, '2026-05-19');
  check('on 19 May: no band-adjusted date any more', noDate(a), words(a));
  check('…the reason is stale band data, in the agreed words', a.reason === 'stale_band' && a.text === COPY, a.text);
  check('…it shows the date of the last usable overnight reading (12 April)', a.lastUsableNight === '2026-04-12' && /12 Apr/.test(words(lines(a))), words(lines(a)));
  const e = estimateNext(s, '2026-05-19');
  check('…it falls back to the logged-period estimate, unchanged (23 April, not rolled forward)', a.fallback?.status === 'dates_only' && a.fallback.rangeStart === e.rangeStart && a.fallback.rangeStart === '2026-04-23', words(a.fallback));
  check('…which is shown as overdue, asking her to log her period', a.fallback.overdue === true && /passed/i.test(a.fallback.text) && /log/i.test(a.fallback.text), a.fallback.text);
  check('the evaluator applies the same rule', sensorModel(s, '2026-05-19', null).usedSensor === false);
});

run('freshness cutoff boundary', () => {
  const s = make(STARTS, '2026-04-12'), P = A.ADJUST_PARAMS || {};
  check('the limit is a documented, configurable setting (provisional, not clinical)', Number.isInteger(P.MAX_MISSING_RECENT_NIGHTS) && P.MAX_MISSING_RECENT_NIGHTS >= 1, words(P));
  const k = P.MAX_MISSING_RECENT_NIGHTS ?? 3;
  const edge = addDays('2026-04-12', k + 1), over = addDays('2026-04-12', k + 2); // k missing nights vs k + 1
  check(`${k} missing nights since the last usable one: still fresh`, adj(s, edge).status === 'adjusted', words(adj(s, edge)));
  check(`${k + 1} missing nights: stale`, adj(s, over).reason === 'stale_band', words(adj(s, over)));
  check('a different setting moves the cutoff (configurable)', adj(s, over, { params: { MAX_MISSING_RECENT_NIGHTS: k + 1 } }).status === 'adjusted');
});

run('late or duplicate sync, and a sync with nothing new', () => {
  const s = make(STARTS, '2026-04-12');
  s.wearable.nights.push(night('2026-04-05', { value: 33.5, syncedAt: '2026-05-18T07:00:00.000Z' })); // an old night arriving late
  s.wearable.nights.push(night('2026-04-12', { value: 33.9, sleepSessionId: 'dup', syncedAt: '2026-05-18T07:00:00.000Z' })); // a duplicate of the last night
  s.wearable.devices = [{ ...D1, connectedAt: '2026-05-19', lastSyncAt: '2026-05-19T07:00:00.000Z' }]; // the band connected today
  const a = adj(s, '2026-05-19');
  check('old readings synced late, a duplicate, and a successful sync today do not make it fresh', a.reason === 'stale_band' && a.lastUsableNight === '2026-04-12', words(a));
});

run('readings that fail quality checks', () => {
  const s = make(STARTS, '2026-04-12');
  s.wearable.nights.push(night('2026-05-15', { status: 'insufficient_wear', value: null }), night('2026-05-16', { value: null }),
    night('2026-05-17', { flags: ['tz_change'] }), night('2026-05-18', { metric: 'heart_rate', value: 60 }));
  M.logDay(s, '2026-05-18', { unwell: true }, { today: '2026-05-19', at: AT });
  s.wearable.nights.push(night('2026-05-18'));
  const a = adj(s, '2026-05-19');
  check('too little wear, missing values, a time-zone change, other metrics and a night she marked unwell: still stale', a.reason === 'stale_band' && a.lastUsableNight === '2026-04-12', words(a));
});

run('overdue with no new period logged, while band data is fresh', () => {
  const s = make(STARTS, '2026-04-27');
  const a = adj(s, '2026-04-28');
  check('still adjusted (fresh, the rise lasts), with its date unchanged: 23 April', a.status === 'adjusted' && a.rangeStart === '2026-04-23', words(a));
  check('marked overdue', a.overdue === true);
  const l = lines(a) || {};
  check('the card says the date has passed and asks her to log or confirm her period', /passed/i.test(l.overdue || '') && /log/i.test(l.overdue || '') && l.askToLog === true, words(l));
  check('the card shows the last usable overnight reading (27 April)', /27 Apr/.test(l.lastReading || ''), l.lastReading);
});

run('fallback with and without enough logged periods', () => {
  const ok = adj(make(STARTS, '2026-04-12'), '2026-05-19');
  check('enough logged periods: the logged-period estimate is shown', ok.fallback?.status === 'dates_only' && !!ok.fallback.rangeStart);
  const one = make(['2026-03-26'], '2026-04-12');
  const b = adj(one, '2026-05-19');
  check('one logged period: no date from either model', noDate(b) && !b.fallback?.rangeStart && estimateNext(one, '2026-05-19').status === 'none', words(b));
  check('…says there are not enough logged periods instead of showing a date', b.reason === 'stale_band' && /enough logged periods/i.test(b.text) && b.fallback.text === 'Not enough data yet.', `${b.text} / ${b.fallback?.text}`);
});

run('recovery', () => {
  const s = make(STARTS, '2026-04-12');
  const add = (from, to, v) => { for (let d = from; d <= to; d = addDays(d, 1)) s.wearable.nights.push(night(d, { value: v, syncedAt: '2026-05-19T07:00:00.000Z' })); };
  add('2026-05-15', '2026-05-18', 33.9); // new usable nights, still at the raised level
  const a = adj(s, '2026-05-19');
  check('new usable overnight readings that meet the existing rules: band adjustment resumes', a.status === 'adjusted' && a.lastUsableNight === '2026-05-18', words(a));
  check('…its date is not rolled forward (still 23 April), and it shows as overdue', a.rangeStart === '2026-04-23' && a.overdue === true);
  const r = make(STARTS, '2026-04-12');
  for (let d = '2026-05-15'; d <= '2026-05-18'; d = addDays(d, 1)) r.wearable.nights.push(night(d, { value: 33.5 }));
  check('new usable nights back at the earlier level: fresh, but the existing rule still says no', adj(r, '2026-05-19').reason === 'rise_ended', words(adj(r, '2026-05-19')));
});

run('dates-only mode unchanged', () => {
  const s = make(STARTS, '2026-04-12'), bare = make(STARTS, '2026-04-12'); bare.wearable.nights = [];
  const same = ['2026-04-13', '2026-04-28', '2026-05-19'].every(t => words(estimateNext(s, t)) === words(estimateNext(bare, t)));
  check('the logged-period estimate is identical with or without band data', same);
  check('the band-adjusted flag is still off by default', FLAG_DEFS.temperatureEstimate.default === false);
});

run('wording', () => {
  const all = [adj(make(STARTS, '2026-04-12'), '2026-05-19'), adj(make(STARTS, '2026-04-27'), '2026-04-28')];
  check('no forbidden wording, no ovulation or fertility claims, and the limit is never called clinical', all.every(a => !FORBIDDEN.some(([, re]) => re.test(words(a) + words(lines(a)))) && !/ovulat|fertil|clinical threshold/i.test(words(a) + words(lines(a)))));
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
