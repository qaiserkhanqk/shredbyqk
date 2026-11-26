// Band-adjusted estimate (js/cycle/adjust.js, research flag temperatureEstimate, default OFF): freshness of band data.
// Reported issue: the last usable overnight temperature was the night of 12 Apr, yet on 19 May the card still showed the
// 23 Apr band-adjusted date. The result was already marked overdue, but nothing on the card said so.
// Written BEFORE the fix; the failing run is in docs/test-logs/. Synthetic data only.
// Run: node tests/cycle-adjust-freshness.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import * as A from '../js/cycle/adjust.js';
import { mergeNights } from '../js/cycle/wearables.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
const adj = (s, t, o) => A.adjustedEstimate(s, t, o);
const LIMIT = A.FRESHNESS?.MAX_NIGHTS_SINCE_USABLE;
const AT = '2026-01-01T00:00:00.000Z';
const words = v => JSON.stringify(v);
const D1 = { deviceId: 'd1', model: 'SYN', firmware: '1' };
const night = (d, v, extra = {}) => ({ night: d, ...D1, metric: 'skin_temp', kind: 'raw', status: 'ok', value: v, flags: [], coverageMin: 480, samples: 48, sleepSessionId: `d1-${d}`, syncedAt: `${addDays(d, 1)}T07:00:00.000Z`, ...extra });

/** Logged starts; nights from the first start until `lastNight` (inclusive). 33.5 °C, plus 0.4 from 14 nights before each
 *  next start, and in the current cycle from 14 nights after its start. */
function make(starts, today, lastNight, { skip = () => false } = {}) {
  const s = M.blankState('u'); M.giveConsent(s, AT); M.setScopeConsent(s, 'wearable', true, AT);
  for (const st of starts) M.logPeriodStart(s, st, { today, at: `${st}T09:00:00.000Z` });
  const nights = [];
  for (let d = starts[0]; d <= lastNight && d < today; d = addDays(d, 1)) {
    if (skip(d)) continue;
    const i = starts.filter(x => x <= d).length - 1, next = starts[i + 1];
    const high = next ? d >= addDays(next, -14) : d >= addDays(starts[i], 14);
    nights.push(night(d, 33.5 + (high ? 0.4 : 0)));
  }
  s.wearable.nights = nights;
  s.wearable.devices = [{ ...D1, adapter: 'mock', verified: false, connectedAt: today }]; // "connected today" must not matter
  return s;
}
const STARTS = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']; // rise in the current cycle from 9 Apr → 23 Apr
const noDate = a => a.status !== 'adjusted' && !a.rangeStart && !a.date;

check('a freshness limit is defined and documented as provisional (FRESHNESS.MAX_NIGHTS_SINCE_USABLE)', Number.isInteger(LIMIT) && LIMIT > 0 && /provisional/i.test(A.FRESHNESS_NOTE || ''), words(A.FRESHNESS));

run('control: the same data is used while it is recent', () => {
  const a = adj(make(STARTS, '2026-04-13', '2026-04-12'), '2026-04-13');
  check('13 Apr, last usable night 12 Apr: adjusted to 23 Apr', a.status === 'adjusted' && a.rangeStart === '2026-04-23' && a.rangeEnd === '2026-04-23', words(a));
  check('…and the date of the last usable overnight reading is given', a.lastUsableNight === '2026-04-12' && /12 Apr/.test(a.lastUsableText || ''), words(a));
});

run('regression: last usable night 12 Apr, today 19 May', () => {
  const s = make(STARTS, '2026-05-19', '2026-04-12'), a = adj(s, '2026-05-19');
  check('the band-adjusted 23 Apr date is no longer shown', noDate(a), words(a));
  check('reason: no recent usable band data', a.reason === 'band_stale' && /No recent usable band data\. This estimate is based on your logged periods\./.test(a.text), words(a));
  check('the last usable overnight reading (12 Apr) is shown', a.lastUsableNight === '2026-04-12' && /12 Apr/.test(a.lastUsableText || ''), a.lastUsableText);
  const e = estimateNext(s, '2026-05-19');
  check('it falls back to the existing dates-only estimate, unchanged', a.fallback?.status === 'dates_only' && a.fallback.rangeStart === e.rangeStart && a.fallback.rangeEnd === e.rangeEnd, words({ f: a.fallback, e }));
  check('the fallback date has passed with no new period: it says overdue and asks her to log or confirm', a.fallback?.overdue === true && /overdue/i.test(a.fallback.text) && /log/i.test(a.fallback.text) && /confirm/i.test(a.fallback.text), a.fallback?.text);
  check('the passed date is not rolled forward', a.fallback?.rangeEnd === e.rangeEnd && e.rangeEnd < '2026-05-19');
});

run('freshness boundary', () => {
  // Nights through 14 May; adjusted range 21 May.
  const P = [...STARTS, '2026-04-23'];
  const s = make(P, '2026-06-30', '2026-05-14');
  const at = t => adj(s, t);
  const fresh = at(addDays('2026-05-14', LIMIT)), stale = at(addDays('2026-05-14', LIMIT + 1));
  check(`last usable night exactly ${LIMIT} nights before today: still used`, fresh.status === 'adjusted' && fresh.rangeStart === '2026-05-21', words(fresh));
  check(`${LIMIT + 1} nights before today: not used, falls back`, stale.reason === 'band_stale' && noDate(stale), words(stale));
  const custom = adj(s, addDays('2026-05-14', 3), { freshness: { MAX_NIGHTS_SINCE_USABLE: 2 } });
  check('the limit is configurable (2 nights → 3 nights old is stale)', custom.reason === 'band_stale', words(custom));
});

run('a late or duplicate sync does not make old data fresh', () => {
  const s = make(STARTS, '2026-05-19', '2026-04-12');
  const late = [night('2026-04-05', 33.5, { syncedAt: '2026-05-19T06:00:00.000Z' }), night('2026-04-12', 33.9, { syncedAt: '2026-05-19T06:00:00.000Z' })];
  s.wearable.nights = mergeNights(s.wearable.nights, late, { at: '2026-05-19T06:00:00.000Z' });
  s.wearable.nights.push({ ...s.wearable.nights.at(-1), sleepSessionId: 'd1-2026-04-12-resend', syncedAt: '2026-05-19T06:01:00.000Z' });
  const a = adj(s, '2026-05-19');
  check('old nights re-sent on 19 May: still stale, last usable night still 12 Apr', a.reason === 'band_stale' && a.lastUsableNight === '2026-04-12' && noDate(a), words(a));
});

run('nights that fail quality checks do not count as recent', () => {
  const s = make(STARTS, '2026-05-19', '2026-04-12');
  s.wearable.nights.push(
    night('2026-05-15', null, { status: 'insufficient_wear', samples: 3, coverageMin: 40 }),
    night('2026-05-16', null, { status: 'no_usable_data', samples: 0 }),
    night('2026-05-17', 33.6, { flags: ['tz_change'] }),
    night('2026-05-18', 33.6));
  M.logDay(s, '2026-05-18', { unwell: true }, { today: '2026-05-19', at: '2026-05-19T08:00:00.000Z' });
  const a = adj(s, '2026-05-19');
  check('insufficient wear, no usable data, a time-zone change and a night she marked unwell: still stale', a.reason === 'band_stale' && a.lastUsableNight === '2026-04-12', words(a));
  const future = make(STARTS, '2026-05-19', '2026-04-12'); future.wearable.nights.push(night('2026-05-25', 33.6));
  check('a night labelled after today does not count either', adj(future, '2026-05-19').reason === 'band_stale');
});

run('overdue while the band data is still recent', () => {
  const P = [...STARTS, '2026-04-23'];
  const s = make(P, '2026-05-25', '2026-05-24'), a = adj(s, '2026-05-25');
  check('25 May, rise still there, 21 May has passed: the band date is still shown, marked overdue', a.status === 'adjusted' && a.rangeEnd === '2026-05-21' && a.overdue === true, words(a));
  check('…the card text says overdue and asks her to log or confirm her period', /overdue/i.test(a.overdueText || '') && /log/i.test(a.overdueText) && /confirm/i.test(a.overdueText), a.overdueText);
  check('…and the date is not rolled forward', a.rangeStart === '2026-05-21');
  const notYet = adj(s, '2026-05-20');
  check('before the date has passed: not overdue, no overdue text', notYet.status === 'adjusted' && !notYet.overdue && !notYet.overdueText, words(notYet));
});

run('fallback without enough logged periods', () => {
  const s = make(['2026-03-26'], '2026-05-19', '2026-04-12'), a = adj(s, '2026-05-19');
  check('one logged period, stale band data: no date, and it says there aren\'t enough logged periods', noDate(a) && a.fallback?.status === 'none' && !a.fallback.rangeStart && /No recent usable band data/.test(a.text) && /enough logged periods/i.test(a.text), words(a));
});

run('recovery', () => {
  const s = make([...STARTS, '2026-04-23'], '2026-05-19', '2026-04-12');
  // A successful sync that brings only unusable nights is not enough.
  s.wearable.nights = mergeNights(s.wearable.nights, [night('2026-05-18', null, { status: 'insufficient_wear' })], { at: '2026-05-19T06:00:00.000Z' });
  check('after a sync with only unusable nights: still stale', adj(s, '2026-05-19').reason === 'band_stale');
  // New usable nights: 6 baseline (5–10 May) then a rise from 11 May, in the cycle that began 23 Apr.
  const fresh = []; for (let d = '2026-05-05'; d <= '2026-05-18'; d = addDays(d, 1)) fresh.push(night(d, d >= '2026-05-11' ? 33.9 : 33.5));
  s.wearable.nights = mergeNights(s.wearable.nights, fresh, { at: '2026-05-19T06:00:00.000Z' });
  const a = adj(s, '2026-05-19');
  check('new usable nights that meet the existing rules: band adjustment resumes (11 May rise → 25 May)', a.status === 'adjusted' && a.rangeStart === '2026-05-25' && a.lastUsableNight === '2026-05-18', words(a));
  // Recent usable nights that do NOT meet the existing rules (no rise yet) keep it off, with the existing reason.
  const s2 = make([...STARTS, '2026-04-23'], '2026-05-19', '2026-04-12');
  const flat = []; for (let d = '2026-05-12'; d <= '2026-05-18'; d = addDays(d, 1)) flat.push(night(d, 33.5));
  s2.wearable.nights = mergeNights(s2.wearable.nights, flat, { at: '2026-05-19T06:00:00.000Z' });
  const b = adj(s2, '2026-05-19');
  check('recent usable nights without a rise: not adjusted, existing reason (no rise yet), not "stale"', b.status === 'not_adjusted' && b.reason === 'no_rise_yet' && b.lastUsableNight === '2026-05-18', words(b));
});

run('dates-only mode is unchanged', () => {
  const s = make([...STARTS, '2026-04-23'], '2026-05-19', '2026-04-12'), bare = structuredClone(s); bare.wearable = { devices: [], nights: [] };
  for (const t of ['2026-05-01', '2026-05-19', '2026-05-25', '2026-06-30']) check(`estimateNext on ${t} is the same with and without band data`, words(estimateNext(s, t)) === words(estimateNext(bare, t)));
  check('no band data at all: still "band not connected", not "stale"', adj(bare, '2026-05-19').reason === 'band_off');
});

console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`);
process.exit(fails ? 1 : 0);
