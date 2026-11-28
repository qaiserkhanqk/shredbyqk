// Band-adjusted period estimate (research flag temperatureEstimate, default OFF). When a sustained rise in her wrist
// skin temperature is seen in THIS cycle, and she has at least 2 past cycles with a rise, the estimate is re-centred
// on the rise plus HER OWN past rise→next-period intervals. It is the sensor candidate already evaluated in the
// synthetic harness (js/cycle/eval.js), now usable in the app behind a flag. Written BEFORE the implementation.
// Synthetic data only. Run: node tests/cycle-adjust.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { FLAG_DEFS, readFlags } from '../js/cycle/flags.js';
import { makeCohort, participantState, sensorModel, splitOf, FROZEN } from '../js/cycle/eval.js';
import { stateAsOf } from '../js/cycle/model.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
let A = {}; try { A = await import('../js/cycle/adjust.js'); } catch (e) { check('module js/cycle/adjust.js exists', false, e.message); }
const adj = A.adjustedEstimate || (() => ({}));
const AT = '2026-06-30T08:00:00.000Z';
const words = v => JSON.stringify(v);

/** Synthetic: 28-day cycles from `first`; a +0.4 °C step 14 nights before each next start (all nights recorded). */
function banded(first, n, { today, skip = () => false } = {}) {
  const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z'); M.setScopeConsent(s, 'wearable', true, AT);
  const starts = Array.from({ length: n }, (_, i) => addDays(first, 28 * i));
  for (const st of starts) M.logPeriodStart(s, st, { today, at: `${st}T09:00:00.000Z` });
  const nights = [];
  for (let d = first; d < today; d = addDays(d, 1)) {
    if (skip(d)) continue;
    const idx = Math.floor((Date.parse(d) - Date.parse(first)) / 864e5 / 28), cd = (Date.parse(d) - Date.parse(starts[idx] || first)) / 864e5;
    nights.push({ night: d, deviceId: 'd1', model: 'SYN', firmware: '1', metric: 'skin_temp', status: 'ok', value: 33.5 + (cd >= 14 ? 0.4 : 0), flags: [], coverageMin: 480, samples: 48 });
  }
  s.wearable.nights = nights;
  return { s, starts };
}

run('flag', () => {
  check('a separate research flag, off by default', FLAG_DEFS.temperatureEstimate?.default === false && readFlags({ getItem: () => null }).temperatureEstimate === false);
});

run('adjusts', () => {
  const today = '2026-05-15'; // last start 2026-04-23 (cycle day 23); rise from cycle day 15 = 2026-05-07
  const { s, starts } = banded('2026-01-01', 5, { today });
  const a = adj(s, today);
  check('rise this cycle + 2 or more past rises: the estimate is adjusted', a.status === 'adjusted', words(a));
  check('re-centred on the rise plus her own past rise-to-period intervals (all 14 days here)', a.rangeStart === addDays(a.riseNight, 14) && a.rangeEnd === addDays(a.riseNight, 14) && a.intervals?.length >= 2 && a.intervals.every(x => x === 14), words(a));
  check('the adjusted date is the next start of the synthetic schedule', a.rangeStart === addDays(starts.at(-1), 28), `${a.rangeStart} vs ${addDays(starts.at(-1), 28)}`);
  check('it explains itself with her numbers and says it is research, not validated', /your band/i.test(a.text || '') && /research/i.test(a.why || '') && /not (been )?validated/i.test(a.why || ''), a.why);
  check('it never mentions ovulation, fertility or safe days', !/ovulat|fertil|safe day/i.test(words(a)) && !FORBIDDEN.some(([, re]) => re.test(words(a))));
});

run('falls back honestly', () => {
  const early = banded('2026-01-01', 5, { today: '2026-05-01' }); // cycle day 9: no rise yet
  const a = adj(early.s, '2026-05-01');
  check('no rise yet this cycle: not adjusted, with that reason', a.status === 'not_adjusted' && a.reason === 'no_rise_yet', words(a));
  const few = banded('2026-03-01', 2, { today: '2026-04-15' }); // only one past cycle with a rise
  check('fewer than 2 past cycles with a rise: not adjusted', adj(few.s, '2026-04-15').reason === 'too_few_past_rises', words(adj(few.s, '2026-04-15')));
  const gap = banded('2026-01-01', 5, { today: '2026-05-15', skip: d => d >= '2026-05-01' && d < '2026-05-15' });
  check('band not worn in this cycle\'s second half: not adjusted, no guessing', adj(gap.s, '2026-05-15').status === 'not_adjusted', words(adj(gap.s, '2026-05-15')));
  const off = banded('2026-01-01', 5, { today: '2026-05-15' }); M.setScopeConsent(off.s, 'wearable', false, AT);
  check('band switched off (data deleted): not adjusted', adj(off.s, '2026-05-15').status === 'not_adjusted');
  const preg = banded('2026-01-01', 5, { today: '2026-05-15' }); M.setSituation(preg.s, 'pregnant', true, { at: AT });
  check('pregnant: not adjusted', adj(preg.s, '2026-05-15').status === 'not_adjusted');
  const hc = banded('2026-01-01', 5, { today: '2026-05-15' }); M.setSituation(hc.s, 'hormonalContraception', true, { at: AT });
  check('hormonal contraception: not adjusted (no natural temperature pattern to use)', adj(hc.s, '2026-05-15').status === 'not_adjusted');
});

run('same as the evaluated candidate', () => {
  // The app's research estimate must give the same dates as the harness's sensor candidate that was evaluated.
  let compared = 0, same = 0;
  for (const p of makeCohort(12)) {
    if (p.device.o.deviceChanges.length) continue; // the harness also drops non-frozen firmware nights
    const full = participantState(p);
    for (const c of p.truth.slice(3, 8)) {
      if (!c.length) continue;
      const asOf = addDays(c.start, c.length - 5), view = stateAsOf(full, asOf);
      const h = sensorModel(view, asOf);
      if (!h.usedSensor) continue;
      const a = adj(view, asOf); compared++;
      if (a.status === 'adjusted' && a.rangeStart === h.rangeStart && a.rangeEnd === h.rangeEnd) same++;
    }
  }
  check('identical ranges to the evaluated sensor candidate wherever it used the band', compared > 10 && same === compared, `${same}/${compared}`);
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
