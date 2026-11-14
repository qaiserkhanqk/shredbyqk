// Cycle tracking unit tests (synthetic data only). Run: node tests/cycle.test.mjs
import * as M from '../js/cycle/model.js';
import { estimateNext, typicalPeriodLength, DISCLAIMER } from '../js/cycle/predict.js';
import { findPatterns, evaluateWindow, insightForToday, patternStatus, forecastCheckins } from '../js/cycle/patterns.js';
import { phaseInfo } from '../js/cycle/phase.js';
import { addReminder, updateReminder, deleteReminder, nextFire, dueNow, markDelivered, notificationContent, schedule } from '../js/cycle/reminders.js';
import { normalise, summariseNights, nightTable, segments, nightOf, MockWearable, SwlDs07Adapter, mergeNights } from '../js/cycle/wearables.js';
import { retrospectiveShift } from '../js/cycle/tempshift.js';
import { addDays, diffDays, localDate, localMinutes, isDate } from '../js/cycle/dates.js';
import { readFlags, setFlag, FLAG_DEFS } from '../js/cycle/flags.js';
import { leakageCheck, makeParticipant, splitOf, baselineModel, sensorModel } from '../js/cycle/eval.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const throwsCode = (fn, code) => { try { fn(); return false; } catch (e) { return e.code === code; } };
const T = '2026-11-14';
function user(starts = [], { end = 4 } = {}) {
  const s = M.blankState('u1'); M.giveConsent(s);
  for (const d of starts) { const p = M.logPeriodStart(s, d, { today: T }); if (end != null && addDays(d, end) <= T) M.logPeriodEnd(s, p.id, addDays(d, end), { today: T }); }
  return s;
}
const series = (first, lengths) => lengths.reduce((a, l) => [...a, addDays(a.at(-1), l)], [first]);
/** Starts whose LAST start is `last` (so history is recent relative to T). */
const ending = (last, lengths) => [...lengths].reverse().reduce((a, l) => [addDays(a[0], -l), ...a], [last]);

/* ---------- Dates & time zones ---------- */
check('dates: validates real calendar dates only', isDate('2026-02-28') && !isDate('2026-02-30') && !isDate('2026-2-3'));
check('dates: day maths ignores daylight saving (UK spring change)', diffDays('2026-03-28', '2026-03-30') === 2 && addDays('2026-10-24', 1) === '2026-10-25');
const instant = Date.parse('2026-11-14T13:30:00Z');
check('time zones: same instant is a different calendar day in London and Sydney', localDate(instant, 'Europe/London') === '2026-11-14' && localDate(instant, 'Australia/Sydney') === '2026-11-15');
check('time zones: local minutes follow the zone', localMinutes(instant, 'America/New_York') === 8 * 60 + 30);
{
  const s = user(); const p = M.logPeriodStart(s, '2026-11-15', { today: '2026-11-15' });
  check('travel: a logged start keeps the calendar date the user chose', p.start === '2026-11-15' && s.periods[0].start === '2026-11-15');
}

/* ---------- Logging, editing, spotting ---------- */
{
  const s = M.blankState('u1');
  check('consent: nothing can be logged before consent', throwsCode(() => M.logPeriodStart(s, '2026-11-01'), 'NO_CONSENT') && throwsCode(() => M.logDay(s, '2026-11-01', { bleeding: 'spotting' }), 'NO_CONSENT'));
  M.giveConsent(s);
  const p = M.logPeriodStart(s, '2026-10-01', { today: T });
  check('periods: start logged, end open', p.end === null && s.periods.length === 1);
  check('periods: end before start refused', throwsCode(() => M.logPeriodEnd(s, p.id, '2026-09-30', { today: T }), 'END_BEFORE_START'));
  check('periods: future dates refused', throwsCode(() => M.logPeriodStart(s, '2026-12-01', { today: T }), 'FUTURE_DATE'));
  M.logPeriodEnd(s, p.id, '2026-10-05', { today: T });
  check('periods: overlapping period refused', throwsCode(() => M.logPeriodStart(s, '2026-10-03', { today: T }), 'OVERLAP'));
  M.editPeriod(s, p.id, { start: '2026-10-02' }, { today: T });
  check('periods: correcting a start replaces it', s.periods[0].start === '2026-10-02');
  M.logDay(s, '2026-10-20', { bleeding: 'spotting' }, { today: T });
  check('spotting: logged as a day, never creates a period', s.periods.length === 1 && s.days['2026-10-20'].bleeding === 'spotting');
  check('spotting: no "did a period start?" prompt for spotting', M.pendingPrompts(s, T).length === 0);
  M.logDay(s, '2026-10-30', { bleeding: 'period' }, { today: T });
  const pr = M.pendingPrompts(s, T);
  check('confirmation: period-type bleeding outside a period asks, does not assume', pr.length === 1 && pr[0].kind === 'confirmStart' && s.periods.length === 1);
  M.logPeriodStart(s, '2026-10-30', { today: T });
  check('confirmation: confirming creates the period and clears the prompt', s.periods.length === 2 && M.pendingPrompts(s, T).every(x => x.kind !== 'confirmStart'));
  check('open period: asks whether it ended after a week, never closes it itself', M.pendingPrompts(s, '2026-11-08').some(x => x.kind === 'confirmEnd') && s.periods[1].end === null);
  check('open period: no "ended?" prompt a month later (left blank, never guessed)', !M.pendingPrompts(s, '2026-12-05').some(x => x.kind === 'confirmEnd'));
  M.deletePeriod(s, s.periods[1].id);
  check('periods: delete removes the entry', s.periods.length === 1);
  check('errors: messages carry a code, never the data', (() => { try { M.logPeriodStart(s, '2026-10-03', { today: T }); } catch (e) { return e.message === 'cycle:OVERLAP' && !/2026/.test(e.message); } })());
}

/* ---------- Missing days are unknown ---------- */
{
  const s = user(series('2026-06-01', [30, 30, 30, 30]));
  check('missing logs: no entry means unknown (no "none" written for gaps)', Object.values(s.days).every(d => d.bleeding !== 'none') && Object.keys(s.days).length === 0);
  check('missing logs: cycles are computed from confirmed starts only', M.cycles(s).length === 4 && M.cycles(s).every(c => c.length === 30));
}

/* ---------- Estimates ---------- */
check('sparse: no data → insufficient-data state, no range', estimateNext(user(), T).status === 'none' && !estimateNext(user(), T).rangeStart);
check('sparse: one start → still no estimate', estimateNext(user(['2026-11-01']), T).status === 'none');
{
  const e = estimateNext(user(['2026-09-20', '2026-10-30']), T); // one cycle of 40 days
  check('no 28-day default: one 40-day cycle → early estimate around day 40', e.status === 'early' && e.rangeStart === addDays('2026-10-30', 38) && e.rangeEnd === addDays('2026-10-30', 42), `${e.rangeStart}–${e.rangeEnd}`);
  check('early estimate explains why the range is padded', /can't show how much yours varies/.test(e.detail));
}
{
  const e = estimateNext(user(series('2026-04-10', [29, 31, 30, 30, 32, 29])), T);
  check('regular history → estimate, range = shortest…longest', e.status === 'estimate' && e.min === 29 && e.max === 32 && diffDays(e.rangeStart, e.rangeEnd) === 3);
  check('estimate text lists the cycles used', /last 6 cycles were between 29 and 32/.test(e.detail));
}
{
  const e = estimateNext(user(ending('2026-11-01', [25, 38, 30, 34, 27])), T);
  check('irregular: spread > 9 days → labelled variable with a wide range', e.status === 'variable' && e.spread === 13);
}
{
  const e = estimateNext(user(ending('2026-11-01', [24, 60, 30, 45, 52])), T);
  check('very irregular: spread > 20 days → no range, check-in offered', e.status === 'too_variable' && !e.rangeStart && /check-in/.test(e.detail));
}
{
  const e = estimateNext(user(ending('2026-11-01', [38, 41, 39, 40, 37, 39])), T);
  check('long cycles (37–41 days) are estimated from the person\'s own lengths', e.status === 'estimate' && e.min === 37 && e.max === 41 && e.rangeStart === '2026-12-08', `${e.status} ${e.min}-${e.max}`);
}
{
  const s = user(series('2026-03-01', [29, 30, 60, 30, 29]));
  const c3 = M.cycles(s)[2];
  check('missed log: a 60-day gap is usable unless marked (no silent exclusion of long cycles)', c3.usable);
  M.editPeriod(s, s.periods[3].id, { missedBefore: true }, { today: T });
  const e = estimateNext(s, T);
  check('missed log: marking it excludes that gap and shows why', !M.cycles(s)[2].usable && e.excluded.length === 1 && !e.lengths.includes(60) && /missed/.test(e.excluded[0].reason));
}
{
  const s = user(['2026-09-01', '2026-09-08', '2026-10-08']); // a 7-day "cycle": probably a typo
  const e = estimateNext(s, T);
  check('implausible length (7 d) kept but marked for checking, not used', M.cycles(s)[0].usable === false && e.lengths.length === 1 && /unusual/.test(e.excluded[0].reason));
  M.editPeriod(s, s.periods[1].id, { lengthConfirmed: true }, { today: T });
  check('user can confirm an unusual length is right', M.cycles(s)[0].usable === true);
}
check('stale history → no estimate from old data', estimateNext(user(series('2025-01-01', [30, 30, 30])), T).status === 'stale');
{
  const s = user(series('2026-05-01', [30, 30, 30, 30, 30])); s.situation.pregnant = true;
  check('pregnancy: estimates paused', estimateNext(s, T).status === 'paused');
  s.situation = { hormonalContraception: true };
  check('hormonal contraception: estimate carries a withdrawal-bleed note', /withdrawal/.test(estimateNext(s, T).notes[0]));
}
check('disclaimer: not a guarantee, not a confidence interval, not contraception', /not a guaranteed date/.test(DISCLAIMER) && /confidence interval/.test(DISCLAIMER) && /contraception/.test(DISCLAIMER));
{
  const s = user(['2026-09-01', '2026-10-01', '2026-11-01'], { end: null });
  check('no invented end dates: a new start never closes the previous period', s.periods.every(p => p.end === null) && typicalPeriodLength(s) === null);
  check('no end logged: an older period covers only its known start day', !!M.periodOn(s, '2026-09-01', T) && !M.periodOn(s, '2026-09-02', T));
}
check('typical period length needs 2 logged ends', typicalPeriodLength(user(['2026-10-01'])) === null && typicalPeriodLength(user(['2026-09-01', '2026-10-01'])) === 5);
{
  const s = user(series('2026-04-10', [29, 31, 30, 30, 32, 29]));
  const asOf = '2026-09-01', a = estimateNext(M.stateAsOf(s, asOf), asOf);
  M.logPeriodStart(s, '2026-11-13', { today: T }); // future (relative to asOf) data changes
  check('no future leakage: an estimate "as of" a date ignores later entries', JSON.stringify(a) === JSON.stringify(estimateNext(M.stateAsOf(s, asOf), asOf)));
}

/* ---------- Symptoms & patterns ---------- */
function symptomUser({ lowDays = [24, 25], cyclesN = 4, logEvery = 1, alwaysLow = false, skipWindowIn = [] } = {}) {
  const starts = series('2026-05-01', Array(cyclesN).fill(30)), s = user(starts);
  M.setCategory(s, 'energy', true);
  starts.slice(0, -1).forEach((st, ci) => {
    for (let d = 1; d <= 30; d += logEvery) {
      if (skipWindowIn.includes(ci) && d >= 22 && d <= 27) continue;
      M.logDay(s, addDays(st, d - 1), { energy: alwaysLow || lowDays.includes(d) ? 'low' : 'usual' }, { today: T });
    }
  });
  return s;
}
{
  const s = M.blankState('u1'); M.giveConsent(s);
  check('symptoms: categories are off by default; logging one is refused', throwsCode(() => M.logDay(s, '2026-11-01', { energy: 'low' }), 'CATEGORY_OFF'));
  M.setCategory(s, 'pain', true); M.logDay(s, '2026-11-01', { pain: 'mild' }, { today: T });
  check('symptoms: invalid values refused', throwsCode(() => M.logDay(s, '2026-11-01', { pain: 'agony' }), 'INVALID_INPUT'));
  M.setCategory(s, 'pain', false);
  check('disable category: stops collection, keeps past entries unless purge', s.days['2026-11-01'].pain === 'mild' && throwsCode(() => M.logDay(s, '2026-11-02', { pain: 'mild' }), 'CATEGORY_OFF'));
  M.setCategory(s, 'pain', true); M.setCategory(s, 'pain', false, { purge: true });
  check('disable category with purge deletes its entries', !s.days['2026-11-01'] && s.consent.log.some(l => /purged/.test(l.change)));
}
{
  const s = symptomUser(), pats = findPatterns(s);
  const p = pats.find(x => x.category === 'energy');
  check('pattern: found from 4 complete cycles of logs, range = the days actually logged', !!p && p.from === 24 && p.to === 25, JSON.stringify(pats.map(x => [x.from, x.to, x.notable, x.observed])));
  check('pattern: text is past tense with the counts', /^You logged lower energy around cycle days \d+–\d+ in 4 of your last 4 recorded cycles/.test(p.text) && !/ will /.test(p.text), p.text);
  check('pattern: evidence lists every cycle', p.evidence.length === 4 && p.evidence.every(e => e.observed));
  const today = addDays(s.periods.at(-1).start, 23);
  check('insight: shown when today falls in the pattern window', insightForToday(s, today)?.key === p.key);
  s.dismissed[p.key] = T;
  check('insight: dismissed insights are not shown again', insightForToday(s, today) === null);
}
{
  const s = symptomUser({ lowDays: [24, 25], skipWindowIn: [0, 1] });
  const w = evaluateWindow(s, 'energy', 24);
  check('pattern: cycles without logs in the window are not counted as "no symptom"', w.observed === 2 && !w.found && /only 2 of 4/.test(w.why), w.why);
}
check('pattern: 2 complete cycles → insufficient, says so', patternStatus(symptomUser({ cyclesN: 2 }))[0].status === 'insufficient' && /you have 2/.test(patternStatus(symptomUser({ cyclesN: 2 }))[0].why));
check('pattern: something logged all the time is not a pattern', findPatterns(symptomUser({ alwaysLow: true })).length === 0);
{
  const s = symptomUser({ lowDays: [] }); // no lows: inconsistent / nothing
  check('pattern: none found → offers a check-in instead of a prediction', patternStatus(s)[0].status === 'none' && /check-in/.test(patternStatus(s)[0].why));
}
check('experimental forecast: produces check-in suggestions only from found patterns', forecastCheckins(symptomUser(), addDays('2026-09-28', 20)).every(f => f.category === 'energy' && f.basis.found));

/* ---------- Phase education ---------- */
{
  const s = user(series('2026-08-01', [30, 30, 30]));
  check('phase: menstruation shown as observed during a logged period', phaseInfo(s, '2026-10-31').status === 'observed' && /follicular/.test(phaseInfo(s, '2026-10-31').text));
  const mid = phaseInfo(s, '2026-11-13');
  check('phase: otherwise "not enough data", no day-14 assumption', mid.status === 'not_enough_data' && !/14/.test(mid.text));
  check('phase: an estimate only with a retrospective temperature rise', phaseInfo(s, '2026-11-13', { tempShift: { detected: true, firstHighNight: '2026-11-10' } }).status === 'estimate');
  s.situation = { hormonalContraception: true };
  check('phase: not shown on hormonal contraception', phaseInfo(s, '2026-10-31').status === 'unsupported');
  for (const k of ['postpartum', 'perimenopause', 'pregnant']) { s.situation = { [k]: true }; if (phaseInfo(s, '2026-11-13').status !== 'unsupported') check(`phase unsupported: ${k}`, false); }
  check('phase: never labelled "confirmed"', ![phaseInfo(s, '2026-10-31'), mid].some(x => /confirm/i.test(x.label)));
}

/* ---------- Reminders ---------- */
{
  const s = user(series('2026-05-15', [30, 30, 30, 30, 30])); // last start 2026-10-12 → range 11-11..11-11
  check('reminders: need their own consent', throwsCode(() => addReminder(s, { kind: 'dailyLog', time: '09:00' }), 'NO_CONSENT'));
  M.setScopeConsent(s, 'reminders', true);
  const est = estimateNext(s, '2026-11-05');
  const r = addReminder(s, { kind: 'periodCheck', time: '08:00', offsetDays: 1 });
  const nf = nextFire(r, s, { today: '2026-11-05', nowMin: 600, estimate: est });
  check('reminders: period check fires the chosen days before the range', nf.next.date === addDays(est.rangeStart, -1) && nf.next.time === '08:00', JSON.stringify(nf.next));
  check('reminders: "why" names the estimate and the offset', /starts on/.test(nf.why) && /1 day before/.test(nf.why));
  s.settings.quietHours = { start: '22:00', end: '07:00' };
  const late = addReminder(s, { kind: 'dailyLog', time: '23:30' });
  const lf = nextFire(late, s, { today: '2026-11-05', nowMin: 600, estimate: est });
  check('quiet hours across midnight: 23:30 moves to 07:00 next day', lf.next.date === '2026-11-06' && lf.next.time === '07:00' && lf.next.shiftedForQuietHours);
  const early = addReminder(s, { kind: 'dailyLog', time: '06:15' });
  check('quiet hours: 06:15 moves to 07:00 same day', nextFire(early, s, { today: '2026-11-05', nowMin: 0, estimate: est }).next.time === '07:00');
  updateReminder(s, late.id, { pausedUntil: '2026-11-10' });
  check('pause: a paused reminder resumes after the pause date', nextFire(late, s, { today: '2026-11-05', nowMin: 600, estimate: est }).next.date === '2026-11-11');
  s.settings.remindersPausedUntil = '2026-11-20';
  check('pause all: nothing due while everything is paused', dueNow(s, { today: '2026-11-12', nowMin: 1200, estimate: est }).length === 0);
  s.settings.remindersPausedUntil = null;
  const due = dueNow(s, { today: '2026-11-12', nowMin: 9 * 60, estimate: est });
  check('due now: early-morning reminder due after quiet hours end', due.some(d => d.reminder.id === early.id));
  markDelivered(s, early.id, '2026-11-12');
  check('delivered once: not repeated the same day', !dueNow(s, { today: '2026-11-12', nowMin: 9 * 60 + 30, estimate: est }).some(d => d.reminder.id === early.id));
  check('lock screen: neutral by default', JSON.stringify(notificationContent(r, s.settings)) === JSON.stringify({ title: 'Shred by QK', body: 'You have a check-in.' }));
  s.settings.lockScreenDetail = true;
  const detailed = notificationContent(r, s.settings).body;
  check('lock screen detail (opt-in) still has no symptom values or dates', /period/.test(detailed) && !/\d/.test(detailed) && !/low|severe|pain/.test(detailed));
  deleteReminder(s, late.id);
  check('delete: reminder and its delivery record are gone', !s.reminders.some(x => x.id === late.id) && !(late.id in s.delivered));
  const none = estimateNext(user(), T);
  check('period check without an estimate waits and says why', nextFire(r, s, { today: T, nowMin: 0, estimate: none }).next === null && /no estimated range/.test(nextFire(r, s, { today: T, nowMin: 0, estimate: none }).why));
  s.situation.pregnant = true;
  check('pregnancy: period check-ins do not fire', schedule(r, s, '2026-11-01', '2026-11-30', est).length === 0);
  s.situation = {};
  const wk = addReminder(s, { kind: 'weeklyLog', time: '19:00', weekday: 1 });
  check('weekly check-in lands on the chosen weekday', new Date(nextFire(wk, s, { today: '2026-11-14', nowMin: 0, estimate: est }).next.date + 'T00:00:00Z').getUTCDay() === 1);
  M.setScopeConsent(s, 'reminders', false);
  check('consent withdrawn: all reminders deleted and none due', s.reminders.length === 0 && dueNow(s, { today: T, nowMin: 1000, estimate: est }).length === 0);
}

/* ---------- Wearable data ---------- */
const P = (o = {}) => ({ deviceId: 'd1', model: 'Mock', firmware: 'f1', metric: 'skin_temp', value: 33.9, unit: 'degC', tStart: Date.parse('2026-11-01T23:00:00Z'), tEnd: Date.parse('2026-11-01T23:10:00Z'), tzOffsetMin: 0, kind: 'raw', ...o });
{
  const now = Date.parse('2026-11-14T00:00:00Z');
  const { readings, stats } = normalise([P(), P(), P({ value: 34.5 }), P({ tStart: P().tStart + 6e5, tEnd: P().tStart + 12e5, value: 93.2, unit: 'degF' }), P({ tStart: P().tStart + 12e5, tEnd: P().tStart + 18e5, value: NaN }), P({ tStart: P().tStart + 18e5, tEnd: P().tStart + 24e5, value: 12 }), P({ tStart: now + 864e5, tEnd: now + 864e5 + 6e5 }), P({ metric: 'glucose' })], { now });
  check('sensor: exact duplicate packets dropped', stats.duplicates === 1);
  check('sensor: same timestamp, different value → first kept, flagged conflict', stats.conflicts === 1 && readings[0].flags.includes('conflict'));
  const f = readings.find(r => r.originalUnit === 'degF');
  check('sensor: °F converted to °C, original value and unit kept', Math.abs(f.value - 34) < 0.01 && f.originalValue === 93.2);
  check('sensor: missing value flagged invalid, not filled', readings.some(r => r.value === null && r.flags.includes('invalid')));
  check('sensor: implausible skin temperature flagged out of range', readings.some(r => r.flags.includes('out_of_range')));
  check('sensor: future timestamp flagged', stats.badTimestamp === 1);
  check('sensor: unsupported metric ignored', stats.unknownMetric === 1);
  check('sensor: source, model, firmware and kind preserved', readings.every(r => r.deviceId === 'd1' && r.model === 'Mock' && r.firmware === 'f1' && r.kind === 'raw'));
}
check('night: assigned by the device\'s local evening date', nightOf({ tStart: Date.parse('2026-11-01T14:00:00Z'), tzOffsetMin: 600 }) === '2026-11-01' && nightOf({ tStart: Date.parse('2026-11-02T01:00:00Z'), tzOffsetMin: 0 }) === '2026-11-01');
{
  const dev = new MockWearable({ seed: 3, pMissing: 0.3, pPartial: 0.2 });
  const nights = summariseNights(normalise(dev.packets('2026-10-01', '2026-10-31'), { now: Date.parse('2026-11-14T00:00:00Z') }).readings);
  const tbl = nightTable(nights, '2026-10-01', '2026-10-31');
  check('missing wear: missing nights shown as "no data" with no value (no interpolation)', tbl.length === 31 && tbl.filter(n => n.status === 'no_data').every(n => n.value === null) && tbl.some(n => n.status === 'no_data'));
  check('missing wear: short nights marked insufficient with no value', nights.filter(n => n.status === 'insufficient_wear').every(n => n.value === null) && nights.some(n => n.status === 'insufficient_wear'));
  check('re-sync: merging the same nights again does not duplicate them', mergeNights(nights, nights).length === nights.length);
}
{
  const dev = new MockWearable({ seed: 4, pMissing: 0, pPartial: 0, pGlitch: 0, deviceChanges: [{ from: '2026-10-16', deviceId: 'mock-002', firmware: 'mock-2.0', base: 34.6 }], tzChanges: [{ from: '2026-10-10', tzOffsetMin: 600 }] });
  const nights = summariseNights(normalise(dev.packets('2026-10-01', '2026-10-30'), { now: Date.parse('2026-11-14T00:00:00Z') }).readings).filter(n => n.metric === 'skin_temp');
  check('device change: flagged and split into separate segments', segments(nights).length === 2 && nights.some(n => n.flags.includes('device_change')));
  check('travel: time-zone change flagged', nights.some(n => n.flags.includes('tz_change')));
  const s = user(['2026-10-01']); s.wearable.nights = nights;
  const sh = retrospectiveShift(s, '2026-10-01', '2026-10-31');
  check('device change: a higher new device is not mistaken for a temperature rise', !sh.detected && sh.deviceChangedThisCycle, sh.why);
}
{
  const high = n => n >= '2026-10-15';
  const nightsFor = o => summariseNights(normalise(new MockWearable({ seed: 5, pMissing: 0, pPartial: 0, pGlitch: 0, highFrom: high, ...o }).packets('2026-10-01', '2026-10-25'), { now: Date.parse('2026-11-14T00:00:00Z') }).readings);
  const s = user(['2026-10-01']); s.wearable.nights = nightsFor({});
  const sh = retrospectiveShift(s, '2026-10-01', '2026-10-26');
  check('temp rise: detected retrospectively, only confirmed on the third high night', sh.detected && sh.firstHighNight === '2026-10-15' && sh.confirmedNight === '2026-10-17', JSON.stringify(sh));
  check('temp rise: cannot be seen before it is confirmed (no advance warning)', !retrospectiveShift(s, '2026-10-01', '2026-10-17').detected);
  check('temp rise: wording says "may be consistent", "not proof"', /may be consistent/.test(sh.why) && /not proof/.test(sh.why));
  for (const d of ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) { M.setCategory(s, 'energy', false); s.days[d] = { unwell: true }; }
  const ill = retrospectiveShift(s, '2026-10-01', '2026-10-26');
  check('illness: nights marked unwell are excluded', ill.excluded.userFlagged === 4 && ill.firstHighNight !== '2026-10-15');
}
check('SWL DS07: unverified adapter refuses to connect', await new SwlDs07Adapter().connect().then(() => false, e => e.code === 'NOT_VERIFIED') && new SwlDs07Adapter().verified === false);
{
  const s = user(); M.setScopeConsent(s, 'wearable', true); s.wearable.nights = [{ night: '2026-11-01' }];
  M.setScopeConsent(s, 'wearable', false);
  check('wearable consent withdrawn: device data deleted', s.wearable.nights.length === 0);
}

/* ---------- Flags ---------- */
{
  const mem = new Map(), st = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  check('flags: everything off by default', Object.values(readFlags(st)).every(v => v === false) && Object.keys(FLAG_DEFS).length === 4);
  setFlag('cycleTracking', true, st);
  check('flags: can be turned on; others stay off', readFlags(st).cycleTracking && !readFlags(st).symptomForecast);
}

/* ---------- Evaluation harness (small cohort) ---------- */
check('eval: participant split is deterministic', splitOf('P001') === splitOf('P001'));
check('eval: no future-data leakage in either model', leakageCheck(makeParticipant(1)) && leakageCheck(makeParticipant(2), sensorModel));
{
  const s = user(series('2026-05-01', [30, 30, 30, 30, 30, 30]));
  s.wearable.nights = summariseNights(normalise(new MockWearable({ seed: 9, highFrom: n => n >= '2026-11-01' }).packets('2026-10-28', '2026-11-12'), { now: Date.parse(T) }).readings);
  const a = baselineModel(s, T), b = baselineModel({ ...s, wearable: { devices: [], nights: [] } }, T);
  check('eval: baseline output is identical with or without wearable data', a.predicted && JSON.stringify(a) === JSON.stringify(b));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
