// Low-effort mode tests: sensor-timed questions, pre-filled suggestions, provenance. Synthetic data only.
// Run: node tests/cycle-nudges.test.mjs
import * as M from '../js/cycle/model.js';
import { periodPrompt, checkinTiming, suggestions } from '../js/cycle/nudges.js';
import { findPatterns, evidenceText } from '../js/cycle/patterns.js';
import { estimateNext } from '../js/cycle/predict.js';
import { addDays } from '../js/cycle/dates.js';
import { evaluateSensorPrompt, makeCohort } from '../js/cycle/eval.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const T = '2026-11-14';
const night = (n, value, o = {}) => ({ night: n, deviceId: 'd1', model: 'Mock', firmware: 'f1', metric: 'skin_temp', unit: 'degC', kind: 'raw', status: 'ok', value, samples: 48, flags: [], ...o });

/** Last start 30 days before T; nights high (34.1) until 2 nights ago, last night low (33.8) unless overridden. */
function tempUser({ last = 33.8, wearable = true, start = addDays(T, -30), mutate } = {}) {
  const s = M.blankState('u1'); M.giveConsent(s);
  for (const d of [addDays(start, -60), addDays(start, -30), start]) M.logPeriodStart(s, d, { today: T });
  if (wearable) M.setScopeConsent(s, 'wearable', true);
  for (let i = 12; i >= 2; i--) s.wearable.nights.push(night(addDays(T, -i), 34.1));
  s.wearable.nights.push(night(addDays(T, -1), last));
  mutate?.(s);
  return s;
}

/* ---------- Period prompt (sensor-timed question) ---------- */
{
  const s = tempUser(), p = periodPrompt(s, T);
  check('period prompt: a clear overnight drop asks the question', p.ask && p.drop >= 0.2, JSON.stringify(p));
  check('period prompt: wording is a question with caveats, never "detected"', /Has your period started\?/.test(p.text) && /other causes/.test(p.text) && !/detect/i.test(p.text));
  const before = JSON.stringify(s); periodPrompt(s, T); estimateNext(s, T);
  check('period prompt: asking never writes anything (no period, no prediction stored)', JSON.stringify(s) === before && s.periods.length === 3);
  M.logPeriodStart(s, T, { today: T, source: 'sensor_prompt' });
  check('period prompt: only a "Yes" records a period, marked as sensor_prompt', s.periods.at(-1).source === 'sensor_prompt' && s.periods.at(-1).start === T);
  check('period prompt: no further prompt right after a period was logged', !periodPrompt(s, addDays(T, 2)).ask);
}
check('period prompt: no drop → no question', !periodPrompt(tempUser({ last: 34.08 }), T).ask && /No clear drop/.test(periodPrompt(tempUser({ last: 34.08 }), T).why));
check('period prompt: needs wearable consent', !periodPrompt(tempUser({ wearable: false }), T).ask);
check('period prompt: missing last night → no question (gaps are not guessed)', !periodPrompt(tempUser({ mutate: s => { s.wearable.nights.pop(); } }), T).ask && /last night/.test(periodPrompt(tempUser({ mutate: s => { s.wearable.nights.pop(); } }), T).why));
check('period prompt: too little wear last night → no question', !periodPrompt(tempUser({ mutate: s => { const n = s.wearable.nights.at(-1); n.status = 'insufficient_wear'; n.value = null; } }), T).ask);
check('period prompt: too early in the cycle → no question', !periodPrompt(tempUser({ start: addDays(T, -11) }), T).ask);
check('period prompt: a device change is not mistaken for a drop', !periodPrompt(tempUser({ mutate: s => { const n = s.wearable.nights.at(-1); n.deviceId = 'd2'; } }), T).ask);
check('period prompt: travel night (time-zone change) is ignored', !periodPrompt(tempUser({ mutate: s => { s.wearable.nights.at(-1).flags.push('tz_change'); } }), T).ask);
check('period prompt: a night marked unwell is ignored', !periodPrompt(tempUser({ mutate: s => { s.days[addDays(T, -1)] = { unwell: true }; } }), T).ask);
check('period prompt: off on hormonal contraception and in pregnancy', !periodPrompt(tempUser({ mutate: s => { s.situation.hormonalContraception = true; } }), T).ask && !periodPrompt(tempUser({ mutate: s => { s.situation.pregnant = true; } }), T).ask);
{
  const s = tempUser(); M.dismissPrompt(s, periodPrompt(s, T).key, T);
  check('period prompt: "Not yet" is remembered for that night', !periodPrompt(s, T).ask);
}

/* ---------- HRV-timed neutral check-in ---------- */
function hrvUser(last, { category = true } = {}) {
  const s = tempUser();
  if (category) M.setCategory(s, 'mood', true);
  for (let i = 15; i >= 2; i--) s.wearable.nights.push(night(addDays(T, -i), 50 + (i % 3), { metric: 'hrv_rmssd', unit: 'ms', kind: 'vendor_derived' }));
  s.wearable.nights.push(night(addDays(T, -1), last, { metric: 'hrv_rmssd', unit: 'ms', kind: 'vendor_derived' }));
  return s;
}
{
  const c = checkinTiming(hrvUser(32), T);
  check('check-in timing: HRV well below the person\'s usual offers a check-in', c.ask);
  check('check-in timing: never names or guesses a mood, lists other causes', !/(angry|irritable|anxious|sad|low mood|moody)/i.test(c.text) && /Training/.test(c.text) && /doesn't tell us how you feel/.test(c.text));
  check('check-in timing: usual HRV → no check-in', !checkinTiming(hrvUser(50), T).ask);
  check('check-in timing: no symptom categories on → no check-in', !checkinTiming(hrvUser(32, { category: false }), T).ask);
}

/* ---------- Pre-filled suggestions ---------- */
function symptomUser() {
  const s = M.blankState('u1'); M.giveConsent(s); M.setCategory(s, 'energy', true);
  const starts = [0, 30, 60, 90, 120].map(n => addDays('2026-06-01', n));
  for (const d of starts) M.logPeriodStart(s, d, { today: T });
  starts.slice(0, -1).forEach(st => { for (let d = 1; d <= 30; d++) M.logDay(s, addDays(st, d - 1), { energy: [24, 25].includes(d) ? 'low' : 'usual' }, { today: T }); });
  return { s, day24: addDays(starts.at(-1), 23) };
}
{
  const { s, day24 } = symptomUser(), sg = suggestions(s, day24);
  check('suggestion: offered from the person\'s own pattern on the matching cycle day', sg.length === 1 && sg[0].category === 'energy' && sg[0].value === 'low', JSON.stringify(sg.map(x => x.text)));
  check('suggestion: phrased as "Same today?" with the counts', /in 4 of 4 cycles\. Same today\?$/.test(sg[0].text));
  check('suggestion: not offered on other cycle days', suggestions(s, addDays(day24, -10)).length === 0);
  const before = JSON.stringify(s); suggestions(s, day24);
  check('suggestion: showing it saves nothing', JSON.stringify(s) === before);
  M.logDay(s, day24, { energy: 'low' }, { today: day24, source: 'suggestion' });
  check('suggestion: "Yes" saves the value marked as an accepted suggestion', s.days[day24].energy === 'low' && s.days[day24].src.energy === 'suggestion');
  check('suggestion: not offered again once that category is logged today', suggestions(s, day24).length === 0);
  check('provenance: typed entries are marked typed', s.days[addDays('2026-06-01', 0)].src.energy === 'typed');
  M.logDay(s, day24, { energy: null }, { today: day24 });
  check('provenance: clearing a value clears its source too', !s.days[day24]);
}
{
  const { s, day24 } = symptomUser(); M.dismissPrompt(s, `sugg:energy:${day24}`, day24);
  check('suggestion: "No" saves nothing and is not repeated that day', suggestions(s, day24).length === 0 && !s.days[day24]);
  s.dismissed[findPatterns(s)[0].key] = day24;
  check('suggestion: a dismissed insight gives no suggestions', suggestions(s, addDays(day24, 30)).length === 0);
}
{
  const { s } = symptomUser();
  for (const k of Object.keys(s.days)) if (s.days[k].energy === 'low') s.days[k].src.energy = 'suggestion';
  const p = findPatterns(s)[0];
  check('anchoring: pattern evidence says how many logs were accepted suggestions', p.fromSuggestions === 8 && /8 of these logs were one-tap suggestions/.test(evidenceText(p)));
}

/* ---------- Synthetic evaluation of the sensor prompt ---------- */
{
  const r = evaluateSensorPrompt(makeCohort(8));
  check('eval: sensor prompt and range prompt both scored on held-out participants', r.sensor.cycles > 0 && r.sensor.cycles === r.rangeOnly.cycles, JSON.stringify(r));
  check('eval: reports hit rate, lag and false prompts per cycle', ['hitPct', 'medianLagDays', 'falsePromptsPerCycle'].every(k => k in r.sensor && k in r.rangeOnly));
  // The synthetic data contains a temperature step before each period, so the wearable-timed prompt MUST find most
  // starts here. If it doesn't, the plumbing is broken. (This proves nothing about real devices.)
  check('eval (synthetic sanity): wearable-timed prompt finds most starts on data built to contain the signal', r.sensor.hitPct > 50 && r.sensor.medianLagDays >= 0, JSON.stringify(r.sensor));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
