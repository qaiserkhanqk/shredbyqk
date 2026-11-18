// Regression tests for the js/cycle issues reported against b3d9589 (issues 3 and 4; the research-prototype issues are in
// research/tests/regressions-b3d9589.test.mjs). Written BEFORE the fixes; the failing run is committed in docs/test-logs/.
// Synthetic data only. Run: node tests/cycle-regressions-b3d9589.test.mjs
import * as M from '../js/cycle/model.js';
import { mergeNights } from '../js/cycle/wearables.js';
import { retrospectiveShift } from '../js/cycle/tempshift.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const summary = o => ({ night: '2026-11-01', sleepSessionId: 'S1', deviceId: 'dev-1', model: 'M1', firmware: 'f1', metric: 'skin_temp', unit: 'degC', kind: 'raw', status: 'ok', value: 33.9, samples: 40,
  rejected: 0, rejectedBy: {}, coverageMin: 400, firstAt: Date.parse('2026-11-01T23:00:00Z'), lastAt: Date.parse('2026-11-02T06:00:00Z'), tzOffsetMin: 0, flags: [], ...o });

/* ---------- 3. A corrected sleep session is matched by its source-session identity, not by the derived night ---------- */
{
  const v1 = summary({});
  // The source re-sends session S1 with a corrected start: the first reading is now 11:30 the previous morning
  // (a corrected day-sleep record), so the DERIVED night label changes, but it is the same source session.
  const v2 = summary({ night: '2026-10-31', firstAt: Date.parse('2026-11-01T11:30:00Z'), value: 34.05, coverageMin: 420 });
  const stored = mergeNights([], [v1], { at: '2026-11-02T08:00:00.000Z' });
  const merged = mergeNights(stored, [v2], { at: '2026-11-03T08:00:00.000Z' });
  const s1 = merged.filter(n => n.sleepSessionId === 'S1' && n.metric === 'skin_temp');
  check('3 a corrected session replaces the current record (one record per source session, not two)', s1.length === 1, `${s1.length} records: ${s1.map(n => `${n.night}=${n.value}`).join(', ')}`);
  check('3 the current record is the corrected version', s1.length === 1 && s1[0].value === 34.05 && s1[0].night === '2026-10-31');
  check('3 the earlier version is kept in the version history', s1.length === 1 && s1[0].prior?.length === 1 && s1[0].prior[0].value === 33.9 && s1[0].prior[0].night === '2026-11-01');
  const s = M.blankState('synthetic'); M.giveConsent(s); M.setScopeConsent(s, 'wearable', true); s.wearable.nights = merged;
  const before = M.stateAsOf(s, '2026-11-03', { knownAt: '2026-11-02T12:00:00.000Z' }).wearable.nights.filter(n => n.sleepSessionId === 'S1');
  const after = M.stateAsOf(s, '2026-11-04', { knownAt: '2026-11-03T12:00:00.000Z' }).wearable.nights.filter(n => n.sleepSessionId === 'S1');
  check('3 history: the view as known before the correction shows only the original version', before.length === 1 && before[0].value === 33.9, JSON.stringify(before.map(n => n.value)));
  check('3 history: the view after the correction shows only the corrected version', after.length === 1 && after[0].value === 34.05, JSON.stringify(after.map(n => n.value)));
  const again = mergeNights(merged, [v2], { at: '2026-11-04T08:00:00.000Z' });
  check('3 an identical resync of the corrected session changes nothing', JSON.stringify(again) === JSON.stringify(merged));
  const other = mergeNights(merged, [summary({ sleepSessionId: 'S2', night: '2026-11-02', value: 33.8 })], { at: '2026-11-04T08:00:00.000Z' });
  check('3 a different session on another night is still a separate record', other.filter(n => n.metric === 'skin_temp').length === 2);
}

/* ---------- 4. One eligible observation per biological night in the temperature rule ---------- */
function stateWith(nights) {
  const s = M.blankState('synthetic'); M.giveConsent(s); M.setScopeConsent(s, 'wearable', true);
  s.wearable.nights = nights.map((n, i) => summary({ sleepSessionId: `S${i}`, ...n }));
  return s;
}
{
  // 6 baseline nights, then ONE night with three separate sessions that read high. Only 7 distinct nights exist.
  const base = Array.from({ length: 6 }, (_, i) => ({ night: addDays('2026-11-01', i), value: 33.8 + (i % 2) * 0.02 }));
  const sameNight = ['a', 'b', 'c'].map(x => ({ night: '2026-11-07', sleepSessionId: `S7${x}`, value: 34.3 }));
  const r = retrospectiveShift(stateWith([...base, ...sameNight]), '2026-11-01', '2026-11-20');
  check('4 three sessions on ONE night do not count as three confirmation nights', r.detected === false, `detected=${r.detected} nightsUsed=${r.nightsUsed}`);
  check('4 nightsUsed counts distinct biological nights', r.nightsUsed === 7, `nightsUsed=${r.nightsUsed}`);
  // Baseline made of 2 nights × 3 sessions must not satisfy a 6-night baseline.
  const twoNights = ['2026-11-01', '2026-11-02'].flatMap(n => ['a', 'b', 'c'].map(x => ({ night: n, sleepSessionId: `${n}-${x}`, value: 33.8 })));
  const high = Array.from({ length: 3 }, (_, i) => ({ night: addDays('2026-11-03', i), value: 34.3 }));
  const r2 = retrospectiveShift(stateWith([...twoNights, ...high]), '2026-11-01', '2026-11-20');
  check('4 a baseline of 2 nights split into 6 sessions does not satisfy the 6-night baseline', r2.detected === false && r2.nightsUsed === 5, `detected=${r2.detected} nightsUsed=${r2.nightsUsed}`);
  // Control: 6 distinct baseline nights + 3 distinct high nights is still detected, and a duplicate session on a
  // baseline night does not change the outcome.
  const good = [...base, ...Array.from({ length: 3 }, (_, i) => ({ night: addDays('2026-11-07', i), value: 34.3 }))];
  const r3 = retrospectiveShift(stateWith(good), '2026-11-01', '2026-11-20');
  const r4 = retrospectiveShift(stateWith([...good, { night: '2026-11-03', sleepSessionId: 'dup', value: 33.81, coverageMin: 100 }]), '2026-11-01', '2026-11-20');
  check('4 control: 6 distinct baseline nights + 3 distinct high nights is detected', r3.detected === true && r3.firstHighNight === '2026-11-07');
  check('4 a second, shorter session on a baseline night is not an extra night (same result, same count)', r4.detected === true && r4.nightsUsed === 9 && r4.firstHighNight === '2026-11-07', `nightsUsed=${r4.nightsUsed}`);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
