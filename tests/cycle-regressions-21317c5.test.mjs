// Regression tests for the js/cycle findings reported against 21317c5 (temperature interpretation and session timing;
// the input races are browser tests in tests/cycle-ui-races.cjs). Written BEFORE the fixes. Synthetic data only.
// Run: node tests/cycle-regressions-21317c5.test.mjs
import * as M from '../js/cycle/model.js';
import { retrospectiveShift } from '../js/cycle/tempshift.js';
import { normalise, summariseNights, NIGHT_PARAMS } from '../js/cycle/wearables.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const stateWith = vals => { const s = M.blankState('synthetic'); M.giveConsent(s); M.setScopeConsent(s, 'wearable', true);
  s.wearable.nights = vals.map(([night, value], i) => ({ night, sleepSessionId: `S${i}`, deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', kind: 'raw', status: 'ok', value, coverageMin: 400, flags: [] })); return s; };
const series = (vals, start = '2026-01-01') => vals.map((v, i) => (v == null ? null : [addDays(start, i), v])).filter(Boolean);

/* ---- 4a. Detection night vs possible onset (phone research rule) ---- */
{
  // Six low nights, two nights with no data, then three high nights: the rise may have begun on a missing night.
  const r = retrospectiveShift(stateWith(series([33.8, 33.8, 33.8, 33.8, 33.8, 33.8, null, null, 34.3, 34.3, 34.3])), '2026-01-01', '2026-02-01');
  check('4a detected rise reports a possible-onset interval separate from the first high night', r.detected === true && !!r.possibleOnset, JSON.stringify({ d: r.detected, po: r.possibleOnset }));
  check('4a ... the interval spans the unobserved nights before the first high night', r.possibleOnset?.earliestNight === '2026-01-07' && r.possibleOnset?.latestNight === '2026-01-09' && r.firstHighNight === '2026-01-09', JSON.stringify(r.possibleOnset));
  const c = retrospectiveShift(stateWith(series([33.8, 33.8, 33.8, 33.8, 33.8, 33.8, 34.3, 34.3, 34.3])), '2026-01-01', '2026-02-01');
  check('4a control: with no missing nights the onset interval is the first high night itself', c.possibleOnset?.earliestNight === '2026-01-07' && c.possibleOnset?.latestNight === '2026-01-07', JSON.stringify(c.possibleOnset));
  const b = retrospectiveShift(stateWith(series([33.8, 33.8, 33.8, 33.8, 33.8, 34.3, 34.3, 34.3, 34.3, 34.3])), '2026-01-01', '2026-02-01');
  check('4a a rise that began while the 6-night baseline was forming is not reported as plain "no sustained rise"', !b.detected && /baseline/i.test(b.why), b.why);
}
/* ---- 4b. Long gap (guard: already abstains since 0f26696) ---- */
{
  const vals = [33.8, 33.8, 33.8, 33.8, 33.8, 33.8, ...Array(55).fill(null), 34.4, 34.4, 34.4];
  const r = retrospectiveShift(stateWith(series(vals)), '2026-01-01', '2026-04-01');
  check('4b guard: six low nights, 55 missing days, three high nights → abstains, no rise reported', r.detected === false && r.abstained === true, JSON.stringify({ d: r.detected, a: r.abstained, why: r.why }));
}
/* ---- 4c. A corrupted reading time must not decide the whole session's night ---- */
{
  const pk = (t, v = 33.8) => ({ deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', unit: 'degC', tzOffsetMin: 0, kind: 'raw', value: v, tStart: t, tEnd: t + 1800e3, sleepSessionId: 'S1', sleepMain: true });
  const t0 = Date.parse('2026-02-10T23:00:00Z');
  const main = Array.from({ length: 12 }, (_, i) => pk(t0 + i * 1800e3));
  const n = summariseNights(normalise([...main, pk(Date.parse('2026-02-03T23:00:00Z'))], { now: Date.parse('2026-03-01T00:00:00Z') }).readings);
  const s1 = n.filter(x => x.metric === 'skin_temp');
  check('4c one reading a week away from its session does not move the session\'s night', s1.length === 1 && s1[0].night === '2026-02-10', JSON.stringify(s1.map(x => `${x.night}:${x.samples}`)));
  check('4c ... the outlying reading is excluded and reported, not used', s1[0]?.samples === 12 && s1[0]?.rejectedBy?.session_timing_outlier === 1 && s1[0]?.coverageMin <= 12 * 30, JSON.stringify({ s: s1[0]?.samples, r: s1[0]?.rejectedBy, c: s1[0]?.coverageMin }));
  check('4c the session-span limit is a documented, configurable parameter', Number.isFinite(NIGHT_PARAMS.maxSessionSpanHours));
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
