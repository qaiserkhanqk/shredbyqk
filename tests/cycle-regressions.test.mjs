// Regression tests for 10 issues independently reproduced in snapshot 0f26696. Written BEFORE the fixes; each
// test failed on 0f26696 (see the commit that added this file). Synthetic data only.
// Run: node tests/cycle-regressions.test.mjs
import * as M from '../js/cycle/model.js';
import { openCycleRepo, memoryStorage, memoryKeys } from '../js/cycle/store.js';
import { addReminder, dueNow } from '../js/cycle/reminders.js';
import { phaseInfo } from '../js/cycle/phase.js';
import { suggestions } from '../js/cycle/nudges.js';
import { checkinTiming } from '../js/cycle/nudges.js';
import { normalise, summariseNights, isUsable } from '../js/cycle/wearables.js';
import { retrospectiveShift } from '../js/cycle/tempshift.js';
import { estimateNext } from '../js/cycle/predict.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const T = '2026-11-14';
const safe = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, `threw ${e.code || e.message}`); } };

/* ---------- 1. No-lock fallback: parallel saves, deletion and consent-withdrawal races ---------- */
await safe('1 parallel saves', async () => {
  const st = memoryStorage(), ks = memoryKeys();
  const A = await openCycleRepo({ storage: st, keys: ks, userId: 'u' }); await A.update(s => M.giveConsent(s));
  const B = await openCycleRepo({ storage: st, keys: ks, userId: 'u' });
  const r = await Promise.allSettled([A.update(s => M.logPeriodStart(s, '2026-09-01', { today: T })), B.update(s => M.logPeriodStart(s, '2026-10-01', { today: T }))]);
  const stored = (await openCycleRepo({ storage: st, keys: ks, userId: 'u' })).read().periods.map(p => p.start).sort();
  const lost = r.filter(x => x.status === 'fulfilled').length === 2 && stored.length < 2;
  check('1 no lock: two simultaneous saves never silently lose one (both kept, or one rejected as retryable CONFLICT)', !lost && (stored.length === 2 || r.some(x => x.reason?.code === 'CONFLICT')), JSON.stringify(stored));
});
await safe('1 parallel save vs delete', async () => {
  const st = memoryStorage(), ks = memoryKeys();
  const A = await openCycleRepo({ storage: st, keys: ks, userId: 'u' }); await A.update(s => M.giveConsent(s));
  const B = await openCycleRepo({ storage: st, keys: ks, userId: 'u' });
  await Promise.allSettled([B.update(s => M.logPeriodStart(s, '2026-10-01', { today: T })), A.deleteAll()]);
  const after = (await openCycleRepo({ storage: st, keys: ks, userId: 'u' })).read();
  check('1 no lock: a save racing a delete leaves nothing behind', after.periods.length === 0 && !M.hasConsent(after));
});
await safe('1 parallel save vs consent withdrawal', async () => {
  const st = memoryStorage(), ks = memoryKeys();
  const A = await openCycleRepo({ storage: st, keys: ks, userId: 'u' }); await A.update(s => { M.giveConsent(s); M.setScopeConsent(s, 'reminders', true); });
  const B = await openCycleRepo({ storage: st, keys: ks, userId: 'u' });
  await Promise.allSettled([A.update(s => M.setScopeConsent(s, 'reminders', false)), B.update(s => addReminder(s, { kind: 'dailyLog', time: '09:00' }))]);
  const after = (await openCycleRepo({ storage: st, keys: ks, userId: 'u' })).read();
  check('1 no lock: withdrawing reminder consent can\'t be undone by a racing save', !after.consent.reminders && after.reminders.length === 0, JSON.stringify({ consent: after.consent.reminders, n: after.reminders.length }));
});

/* ---------- 2. Simultaneous first opens ---------- */
await safe('2 concurrent first opens', async () => {
  const st = memoryStorage(), ks = memoryKeys();
  const [A, B] = await Promise.all([openCycleRepo({ storage: st, keys: ks, userId: 'u' }), openCycleRepo({ storage: st, keys: ks, userId: 'u' })]);
  await A.update(s => { M.giveConsent(s); M.logPeriodStart(s, '2026-10-01', { today: T }); });
  let reopened = null, err = null; try { reopened = await openCycleRepo({ storage: st, keys: ks, userId: 'u' }); } catch (e) { err = e.code; }
  check('2 simultaneous first opens share one key: reopen after a save decrypts', !err && reopened.read().periods.length === 1, err || '');
  let bOk = true; try { await B.update(s => M.logDay(s, '2026-10-03', { bleeding: 'spotting' }, { today: T })); } catch (e) { bOk = false; }
  const again = await openCycleRepo({ storage: st, keys: ks, userId: 'u' }).catch(e => e);
  check('2 the second first-opener can save, and the result still decrypts', bOk && again.read && again.read().periods.length === 1 && again.read().days['2026-10-03']?.bleeding === 'spotting');
});

/* ---------- 3. Purging a category removes what was derived from it ---------- */
{
  const s = M.blankState('u'); M.giveConsent(s); M.setCategory(s, 'mood', true); M.setScopeConsent(s, 'reminders', true);
  for (const d of ['2026-07-01', '2026-07-31', '2026-08-30', '2026-09-29', '2026-10-29']) M.logPeriodStart(s, d, { today: T });
  const r = addReminder(s, { kind: 'pattern', time: '09:00', cycleDay: 16, category: 'mood', origin: 'You logged low, anxious or irritable mood around cycle days 15–17 in 3 of your last 3 recorded cycles.' });
  addReminder(s, { kind: 'dailyLog', time: '20:00' });
  s.delivered[r.id] = '2026-11-13'; s.dismissed['mood:15-17'] = '2026-11-01'; s.promptsDismissed['sugg:mood:2026-11-12'] = '2026-11-12';
  M.setCategory(s, 'mood', false, { purge: true });
  const exported = JSON.stringify(s);
  check('3 purge: pattern reminders for the purged category are deleted', !s.reminders.some(x => x.category === 'mood') && s.reminders.length === 1);
  check('3 purge: their origin text, delivery state and dismissals are gone from the data (and so from exports)', !/irritable mood around/.test(exported) && !(r.id in s.delivered) && !Object.keys(s.dismissed).some(k => k.startsWith('mood:')) && !Object.keys(s.promptsDismissed).some(k => k.startsWith('sugg:mood:')));
  const est = estimateNext(s, '2026-11-13');
  check('3 purge: no reminder for the purged category is delivered', !dueNow(s, { today: '2026-11-13', nowMin: 600, estimate: est }).some(d => d.reminder.category === 'mood'));
}
{
  const s = M.blankState('u'); M.giveConsent(s); M.setCategory(s, 'mood', true); M.setScopeConsent(s, 'reminders', true);
  M.logPeriodStart(s, '2026-11-01', { today: T });
  addReminder(s, { kind: 'pattern', time: '09:00', cycleDay: 5, category: 'mood' });
  M.setCategory(s, 'mood', false);
  check('3 turning a category off (no purge) disables its pattern reminders', s.reminders.every(x => x.category !== 'mood' || !x.enabled));
}

/* ---------- 4. Open period vs confirmed daily bleeding ---------- */
{
  const s = M.blankState('u'); M.giveConsent(s); M.logPeriodStart(s, '2026-11-01', { today: T });
  M.logDay(s, '2026-11-03', { bleeding: 'none' }, { today: T }); M.logDay(s, '2026-11-04', { bleeding: 'spotting' }, { today: T });
  check('4 explicit "none" inside an open period is not "observed menstruation"', phaseInfo(s, '2026-11-03').status !== 'observed');
  check('4 spotting inside an open period is not "observed menstruation"', phaseInfo(s, '2026-11-04').status !== 'observed');
  check('4 an unlogged later day of an open period is unknown, not observed', phaseInfo(s, '2026-11-05').status !== 'observed');
  check('4 the logged start day is observed', phaseInfo(s, '2026-11-01').status === 'observed');
  const s2 = M.blankState('u'); M.giveConsent(s2); const p = M.logPeriodStart(s2, '2026-10-01', { today: T }); M.logPeriodEnd(s2, p.id, '2026-10-05', { today: T });
  M.logDay(s2, '2026-10-04', { bleeding: 'spotting' }, { today: T });
  check('4 confirmed end: days inside a confirmed start–end are observed', phaseInfo(s2, '2026-10-03').status === 'observed');
  check('4 confirmed end: a day logged as spotting inside it is not observed menstruation', phaseInfo(s2, '2026-10-04').status !== 'observed');
}

/* ---------- 5. Suggestions count the exact value per cycle ---------- */
function moodUser(valuesPerCycle) {
  const s = M.blankState('u'); M.giveConsent(s); M.setCategory(s, 'mood', true);
  const starts = ['2026-06-01', '2026-07-01', '2026-07-31', '2026-08-30', '2026-09-29'];
  for (const d of starts) M.logPeriodStart(s, d, { today: T });
  valuesPerCycle.forEach((vals, ci) => { for (let d = 1; d <= 30; d++) M.logDay(s, addDays(starts[ci], d - 1), { mood: vals[d] || 'good' }, { today: T }); });
  return { s, day: addDays(starts.at(-1), 23) };
}
{
  const { s, day } = moodUser([{ 24: 'low' }, { 24: 'anxious' }, { 24: 'irritable' }, { 24: 'low' }].slice(0, 3).concat([{}]));
  // 3 notable cycles with 3 different words, plus a 4th cycle with no notable mood
  const sg = suggestions(s, day);
  const bad = sg.some(x => /"low" in 3 of/.test(x.text) || /"anxious" in 3 of/.test(x.text) || /"irritable" in 3 of/.test(x.text));
  check('5 different moods in different cycles are never reported as one exact mood "in 3 of N"', !bad, JSON.stringify(sg.map(x => x.text)));
}
{
  const { s, day } = moodUser([{ 24: 'low', 25: 'low' }, { 24: 'anxious' }, { 24: 'anxious' }, { 24: 'anxious' }]);
  const sg = suggestions(s, day), t = sg[0]?.text || '';
  check('5 repeated logs in one cycle count once; ties and majorities use exact per-cycle counts', !/"low" in [2-9]/.test(t) && (!/"anxious"/.test(t) || /"anxious" in 3 of 4/.test(t)), t);
}

/* ---------- 6. Timestamp validation ---------- */
{
  const base = Date.parse('2026-11-01T23:00:00Z'), now = Date.parse('2026-11-14T00:00:00Z');
  const pk = o => ({ deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', value: 33.9, unit: 'degC', tzOffsetMin: 0, kind: 'raw', ...o });
  const inf = Array.from({ length: 6 }, (_, i) => pk({ tStart: base + i * 600e3, tEnd: Infinity }));
  const n = summariseNights(normalise(inf, { now }).readings)[0];
  check('6 tEnd = Infinity: never an "ok" night, coverage stays finite', !n || (n.status !== 'ok' && Number.isFinite(n.coverageMin)), JSON.stringify(n && { status: n.status, coverageMin: n.coverageMin }));
  const cases = { NaNend: pk({ tStart: base, tEnd: NaN }), NaNstart: pk({ tStart: NaN, tEnd: base }), futureEnd: pk({ tStart: base, tEnd: now + 864e5 }), reversed: pk({ tStart: base + 600e3, tEnd: base }), infStart: pk({ tStart: -Infinity, tEnd: base }) };
  for (const [k, p] of Object.entries(cases)) check(`6 ${k} is flagged and never usable`, !isUsable(normalise([p], { now }).readings[0] || { value: null, flags: [] }) );
}

/* ---------- 7. Duplicates with changed metadata ---------- */
{
  const now = Date.parse('2026-11-14T00:00:00Z'), t0 = Date.parse('2026-11-01T23:00:00Z');
  const pk = o => ({ deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', value: 33.9, unit: 'degC', tStart: t0, tEnd: t0 + 600e3, tzOffsetMin: 0, kind: 'raw', ...o });
  for (const [label, pair] of Object.entries({ 'clean then off-wrist': [pk({}), pk({ vendorQuality: 'off_wrist' })], 'off-wrist then clean': [pk({ vendorQuality: 'off_wrist' }), pk({})] })) {
    const rs = normalise(pair, { now }).readings;
    check(`7 same value, new off-wrist warning (${label}): the reading is not usable`, rs.length >= 1 && rs.every(r => !isUsable(r)));
  }
  for (const [label, second] of Object.entries({ firmware: pk({ firmware: 'f2' }), unit: pk({ unit: 'degF' }), 'end time': pk({ tEnd: t0 + 1200e3 }) })) {
    const { readings, stats } = normalise([pk({}), second], { now });
    check(`7 same value but different ${label}: not treated as an exact duplicate`, stats.duplicates === 0 && readings.every(r => !isUsable(r)), JSON.stringify(stats));
  }
}

/* ---------- 8. Temperature rule continuity ---------- */
{
  const s = M.blankState('u'); M.giveConsent(s); M.logPeriodStart(s, '2026-08-01', { today: T });
  const n = (d, v) => ({ night: addDays('2026-08-01', d), deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', status: 'ok', value: v, flags: [] });
  for (let d = 0; d < 6; d++) s.wearable.nights.push(n(d, 33.8));
  for (let d = 25; d < 28; d++) s.wearable.nights.push(n(d, 34.3)); // 19-night gap
  const r = retrospectiveShift(s, '2026-08-01', '2026-09-01');
  check('8 six baseline nights, a 19-night gap, three high nights: abstains (detected:false) and says why', !r.detected && /gap|continu/i.test(r.why), JSON.stringify({ detected: r.detected, why: r.why }));
}

/* ---------- 9. HRV baseline recency ---------- */
{
  const s = M.blankState('u'); M.giveConsent(s); M.setScopeConsent(s, 'wearable', true); M.setCategory(s, 'mood', true);
  const n = (night, v, o = {}) => ({ night, deviceId: 'd', model: 'm', firmware: 'f', metric: 'hrv_rmssd', unit: 'ms', kind: 'vendor_derived', status: 'ok', value: v, flags: [], ...o });
  for (let i = 0; i < 14; i++) s.wearable.nights.push(n(addDays('2024-12-01', i), 50));
  s.wearable.nights.push(n(addDays(T, -1), 30));
  const c = checkinTiming(s, T);
  check('9 a two-year-old HRV baseline is not called "your usual"', !c.ask || !/your usual/.test(c.text), JSON.stringify(c));
  const s2 = M.blankState('u'); M.giveConsent(s2); M.setScopeConsent(s2, 'wearable', true); M.setCategory(s2, 'mood', true);
  for (let i = 16; i >= 4; i--) s2.wearable.nights.push(n(addDays(T, -i), 50));
  for (let i = 3; i >= 1; i--) s2.wearable.nights.push(n(addDays(T, -i), i === 1 ? 30 : 50, { deviceId: 'd2' }));
  check('9 after a device change, old-device nights are not used as the baseline', !checkinTiming(s2, T).ask);
}

/* ---------- 10. What was known when ---------- */
{
  const s = M.blankState('u'); M.giveConsent(s, '2025-12-01T00:00:00Z');
  for (const d of ['2025-10-04', '2025-11-03', '2025-12-03']) M.logPeriodStart(s, d, { today: '2025-12-03', at: d + 'T08:00:00Z' });
  M.logPeriodStart(s, '2026-01-01', { today: '2026-06-01', at: '2026-06-01T09:00:00Z' }); // typed in five months later
  check('10 a period dated 1 Jan but entered 1 Jun is not visible as of 15 Jan', !M.stateAsOf(s, '2026-01-15').periods.some(p => p.start === '2026-01-01'));
  check('10 …and is visible once it had been entered', M.stateAsOf(s, '2026-06-02').periods.some(p => p.start === '2026-01-01'));
  const before = JSON.stringify(estimateNext(M.stateAsOf(s, '2025-12-20'), '2025-12-20'));
  M.editPeriod(s, s.periods.find(p => p.start === '2025-11-03').id, { start: '2025-11-06' }, { today: '2026-06-01', at: '2026-06-01T09:05:00Z' });
  check('10 a later correction does not change what the forecast was as of an earlier date', JSON.stringify(estimateNext(M.stateAsOf(s, '2025-12-20'), '2025-12-20')) === before);
  M.logDay(s, '2025-12-10', { bleeding: 'spotting' }, { today: '2026-06-01', at: '2026-06-01T09:10:00Z' });
  check('10 a day backfilled later is unknown in earlier views', !M.stateAsOf(s, '2025-12-20').days['2025-12-10']?.bleeding);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
