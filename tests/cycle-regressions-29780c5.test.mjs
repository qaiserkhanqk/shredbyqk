// Regression tests for issues independently reproduced in snapshot 29780c5 (issues 1–4; issue 5 is a browser test in
// tests/cycle-ui-regressions.cjs). Written BEFORE the fixes; the failing run on unchanged 29780c5 is committed in
// docs/test-logs/. Synthetic data only. Run: node tests/cycle-regressions-29780c5.test.mjs
import * as M from '../js/cycle/model.js';
import { normalise, summariseNights, isUsable } from '../js/cycle/wearables.js';
import { estimateNext } from '../js/cycle/predict.js';
import { openCycleRepo, memoryStorage, memoryKeys } from '../js/cycle/store.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const NOW = Date.parse('2026-11-15T12:00:00Z');
const at = (iso, i, minutes = 30) => { const t = Date.parse(iso) + i * minutes * 60e3; return { tStart: t, tEnd: t + minutes * 60e3 }; };
// A verified main-sleep session (what a real SDK would have to provide; see docs/wearable-sdk-requirements.md).
const SLEEP = { sleepSessionId: 'sess-1', sleepMain: true };
const pk = (o = {}) => ({ deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', unit: 'degC', tzOffsetMin: 0, kind: 'raw', value: 33.9, ...SLEEP, ...o });
const summarise = ps => summariseNights(normalise(ps, { now: NOW }).readings);
const okNights = ns => ns.filter(n => n.status === 'ok');

/* ---------- 1. Incompatible measurement types and sources are never pooled ---------- */
{
  const mixed = [0, 1, 2].map(i => pk({ ...at('2026-11-01T23:00:00Z', i), value: 33, kind: 'raw' }))
    .concat([3, 4, 5].map(i => pk({ ...at('2026-11-01T23:00:00Z', i), value: 37, kind: 'vendor_derived' })));
  const ns = summarise(mixed);
  check('1 three raw + three vendor-derived samples are not combined into one valid night', okNights(ns).length === 0, JSON.stringify(ns.map(n => ({ kind: n.kind, status: n.status, value: n.value }))));
  check('1 no summary reports a value that mixes the two kinds (35 °C)', !ns.some(n => n.value === 35));
  const unk = normalise([pk({ ...at('2026-11-01T23:00:00Z', 0), kind: 'estimated' }), pk({ ...at('2026-11-01T23:00:00Z', 1), kind: undefined })], { now: NOW }).readings;
  check('1 unknown or missing measurement kind does not default to raw, and is not usable', unk.every(r => r.kind !== 'raw' && !isUsable(r)), JSON.stringify(unk.map(r => r.kind)));
  const twoSources = [0, 1, 2].map(i => pk({ ...at('2026-11-01T23:00:00Z', i), model: 'm-A' })).concat([3, 4, 5].map(i => pk({ ...at('2026-11-01T23:00:00Z', i), model: 'm-B' })));
  check('1 two source identities (same device ID, different model) are not pooled into one night', okNights(summarise(twoSources)).length === 0);
  const sixRaw = [0, 1, 2, 3, 4, 5].map(i => pk({ ...at('2026-11-01T23:00:00Z', i) }));
  check('1 control: six compatible raw samples still form a night', okNights(summarise(sixRaw)).length === 1);
}

/* ---------- 2. Overnight means a verified sleep period, not a clock window ---------- */
{
  const noCtx = o => { const p = pk(o); delete p.sleepSessionId; delete p.sleepMain; return p; };
  const daytime = [0, 1, 2, 3, 4, 5].map(i => noCtx({ ...at('2026-11-01T14:00:00Z', i) })); // 14:00–17:00 local (UTC+0)
  check('2 daytime-only samples (14:00–17:00) without sleep information: no "overnight" summary', okNights(summarise(daytime)).length === 0, JSON.stringify(summarise(daytime).map(n => n.status)));
  const overnightNoCtx = [0, 1, 2, 3, 4, 5, 6, 7].map(i => noCtx({ ...at('2026-11-01T23:00:00Z', i) }));
  check('2 night-time samples without verified sleep information also abstain (no assumed sleep window)', okNights(summarise(overnightNoCtx)).length === 0);
  const mixed = [0, 1, 2, 3, 4, 5].map(i => pk({ ...at('2026-11-01T23:00:00Z', i) })).concat([0, 1, 2, 3, 4, 5].map(i => noCtx({ ...at('2026-11-02T14:00:00Z', i), value: 36 })));
  const mns = summarise(mixed);
  check('2 mixed batch: only the verified sleep session is summarised; daytime readings are not used', okNights(mns).length === 1 && okNights(mns)[0].value === 33.9, JSON.stringify(mns.map(n => ({ night: n.night, status: n.status, value: n.value }))));
  const shift = [0, 1, 2, 3, 4, 5, 6, 7].map(i => pk({ ...at('2026-11-02T08:00:00Z', i), sleepSessionId: 'day-sleep' })); // shift worker sleeping 08:00–12:00
  const sns = okNights(summarise(shift));
  check('2 shift worker: a verified main sleep in the daytime is used (no universal night window)', sns.length === 1, JSON.stringify(summarise(shift).map(n => n.status)));
  const nap = [0, 1, 2, 3, 4, 5, 6, 7].map(i => pk({ ...at('2026-11-02T14:00:00Z', i), sleepSessionId: 'nap', sleepMain: false }));
  check('2 a sleep session the source does not mark as main sleep (a nap) is not used as a night', okNights(summarise(nap)).length === 0);
}

/* ---------- 3. Time-zone offsets are validated; bad packets can't crash a batch ---------- */
{
  const good = [0, 1, 2, 3, 4, 5].map(i => pk({ ...at('2026-11-01T23:00:00Z', i) }));
  for (const [label, tz] of [['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity], ['100000 minutes', 100000], ['not a whole quarter hour (7 min)', 7], ['a string', '60']]) {
    let ns = null, err = null;
    try { ns = summarise([...good, pk({ ...at('2026-11-01T23:00:00Z', 9), tzOffsetMin: tz, value: 34.5 })]); } catch (e) { err = e.message; }
    check(`3 offset ${label}: no crash, valid data still summarised, bad packet quarantined`, !err && okNights(ns).length === 1 && okNights(ns)[0].value === 33.9 && !ns.some(n => n.night > '2026-11-15'), err || JSON.stringify(ns.map(n => ({ night: n.night, status: n.status }))));
  }
  const { readings } = normalise([pk({ ...at('2026-11-01T23:00:00Z', 0), tzOffsetMin: 100000 })], { now: NOW });
  check('3 the quarantined packet carries a clear reason', readings[0]?.flags.includes('tz_invalid'), JSON.stringify(readings[0]?.flags));
  // Tightened with the fix: every invalid offset carries the reason and is counted in the batch's quarantine report.
  for (const tz of [NaN, Infinity, -Infinity, 100000, 7, '60', -721, 841]) {
    const n = normalise([pk({ ...at('2026-11-01T23:00:00Z', 0), tzOffsetMin: tz })], { now: NOW }).readings;
    const q = summariseNights(n).quarantined;
    if (!(n[0]?.flags.includes('tz_invalid') && q?.tz_invalid === 1)) check(`3 offset ${String(tz)} quarantined as tz_invalid`, false, JSON.stringify({ flags: n[0]?.flags, q }));
  }
  check('3 every invalid offset (NaN, ±Infinity, 100000, 7, "60", −721, 841) is quarantined as tz_invalid and counted', true);
  check('3 real edge offsets are accepted: UTC−12:00, UTC+14:00, UTC+5:45', [-720, 840, 345].every(tz => okNights(summarise([0, 1, 2, 3, 4, 5].map(i => pk({ ...at('2026-11-01T23:00:00Z', i), tzOffsetMin: tz })))).length === 1));
  let err = null, res = null; try { res = normalise([null, 'garbage', { metric: 'skin_temp', get value() { throw new Error('boom'); } }, ...good], { now: NOW }); } catch (e) { err = e.message; }
  check('3 malformed packets (null, a string, a throwing object) cannot crash a batch; the valid ones still count', !err && res.stats.malformed >= 1 && okNights(summariseNights(res.readings)).length === 1, err || JSON.stringify(res.stats));
}

/* ---------- 4. Situations are versioned for historical views ---------- */
const setSituation = (s, key, on, opts) => (M.setSituation ? M.setSituation(s, key, on, opts) : (on ? (s.situation[key] = true) : delete s.situation[key])); // old UI behaviour when no API exists
function history() {
  const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z');
  M.logPeriodStart(s, '2026-01-05', { today: '2026-01-05', at: '2026-01-05T20:00:00.000Z' });
  M.logPeriodStart(s, '2026-02-03', { today: '2026-02-03', at: '2026-02-03T20:00:00.000Z' });
  return s;
}
{
  const s = history(), before = estimateNext(M.stateAsOf(s, '2026-03-02'), '2026-03-02');
  setSituation(s, 'pregnant', true, { at: '2026-04-10T09:00:00.000Z' }); // marked later
  const after = estimateNext(M.stateAsOf(s, '2026-03-02'), '2026-03-02');
  check('4 a 2 March historical forecast stays "early" after pregnancy is marked in April', before.status === 'early' && after.status === 'early', `${before.status} → ${after.status}`);
  check('4 current safety behaviour kept: estimates are paused now', estimateNext(s, '2026-04-11').status === 'paused');
  check('4 a historical view after the change sees it', estimateNext(M.stateAsOf(s, '2026-04-12'), '2026-04-12').status === 'paused');
}
{
  const s = history(); setSituation(s, 'pregnant', true, { at: '2026-02-20T09:00:00.000Z' });
  setSituation(s, 'pregnant', false, { at: '2026-04-10T09:00:00.000Z' }); // later change: no longer pregnant
  check('4 a later change ("no longer") does not rewrite history: 2 March view still paused', estimateNext(M.stateAsOf(s, '2026-03-02'), '2026-03-02').status === 'paused');
  if (M.eraseSituation) {
    M.eraseSituation(s, 'pregnant');
    check('4 deleting the entry as a mistake removes it from current AND historical views', estimateNext(M.stateAsOf(s, '2026-03-02'), '2026-03-02').status === 'early' && !JSON.stringify(s).includes('pregnant'));
  } else check('4 deleting the entry as a mistake removes it from current AND historical views', false, 'no deletion API');
}
{
  const st = memoryStorage(), ks = memoryKeys(), r = await openCycleRepo({ storage: st, keys: ks, userId: 'u' });
  await r.update(s => { Object.assign(s, history()); s.owner = 'u'; setSituation(s, 'pregnant', true, { at: '2026-04-10T09:00:00.000Z' }); });
  await r.deleteAll(); // withdrawing consent deletes everything
  const back = (await openCycleRepo({ storage: st, keys: ks, userId: 'u' })).read();
  check('4 consent withdrawal (delete all): no situation or history left in current or historical views', !JSON.stringify(back).includes('pregnant') && M.stateAsOf(back, '2026-03-02').periods.length === 0);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
