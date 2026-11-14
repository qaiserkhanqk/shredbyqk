// Low-effort mode: the app ASKS at the right moment, the person answers with one tap. Nothing here writes data.
//
//  1. periodPrompt(): a sensor-TIMED question, "Has your period started?", when nightly wrist skin temperature
//     dropped from its recent level. Wrist temperature often falls around the start of a period, but the drop is
//     not specific: illness, room temperature, alcohol, a loose strap or a missed night can all cause it. So it
//     only ever triggers a question. The period is recorded only if the person taps "Yes", with source
//     'sensor_prompt'. (flag sensorPrompts, default OFF; needs wearable consent)
//  2. checkinTiming(): when last night's HRV was well below the person's own recent level, offer a NEUTRAL
//     "Want to log how you feel?". It never names or guesses a mood: HRV reflects training, sleep, alcohol,
//     illness and stress far more than mood, and no sensor measures cravings. (flag sensorPrompts)
//  3. suggestions(): pre-filled answers from the person's OWN found patterns ("Around this time you logged lower
//     energy in 3 of 4 cycles. Same today?"). Accepting saves with source 'suggestion'; declining saves nothing.
//     (flag quickSuggestions, default OFF)
//
// Anchoring risk: accepted suggestions could make a pattern self-reinforcing. Every entry keeps its source, the
// pattern evidence reports how many entries were accepted suggestions, and the evaluation plan measures this.
// All thresholds are placeholders, NOT validated. The synthetic evaluation (js/cycle/eval.js) shows the plumbing
// works and says nothing about real devices.
import { addDays, diffDays } from './dates.js';
import { CATEGORIES } from './model.js';
import { segments } from './wearables.js';
import { findPatterns } from './patterns.js';

export const NUDGE_PARAMS = Object.freeze({ MIN_CYCLE_DAY: 15, BASE_NIGHTS: 5, TEMP_DROP: 0.2, RECENT_PERIOD_DAYS: 10, HRV_BASE: 14, HRV_MIN_BASE: 7, HRV_DROP: 0.2 });
export const NUDGE_VERSION = 'nudges-0.1.0';

const lastStartOf = (s, today) => s.periods.map(p => p.start).filter(d => d <= today).sort().at(-1) || null;
const mean = xs => xs.reduce((a, v) => a + v, 0) / xs.length;
const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/** Valid nights of one metric from the latest device+firmware segment, excluding flagged nights and user-flagged days. */
function validNights(s, metric, before) {
  const seg = segments(s.wearable.nights.filter(n => n.night < before), metric).at(-1);
  if (!seg) return [];
  return seg.nights.filter(n => n.status === 'ok' && n.value != null && !n.flags.includes('tz_change') && !s.days[n.night]?.unwell && !s.days[n.night]?.travel);
}

/** Should we ask "Has your period started?" because of a temperature drop last night? */
export function periodPrompt(s, today, p = NUDGE_PARAMS) {
  const no = why => ({ ask: false, why });
  if (!s.consent.wearable) return no('Wearable data is off.');
  if (s.situation?.pregnant || s.situation?.hormonalContraception) return no('Not used in this situation.');
  const last = lastStartOf(s, today);
  if (!last) return no('No period logged yet.');
  if (diffDays(last, today) < p.RECENT_PERIOD_DAYS) return no('A period was logged recently.');
  if (diffDays(last, today) + 1 < p.MIN_CYCLE_DAY) return no('Too early in the cycle.');
  const nights = validNights(s, 'skin_temp', today), lastNight = addDays(today, -1);
  const latest = nights.at(-1);
  if (!latest || latest.night !== lastNight) return no('No usable reading from last night.');
  const base = nights.slice(-1 - p.BASE_NIGHTS, -1);
  if (base.length < p.BASE_NIGHTS || diffDays(base[0].night, latest.night) > p.BASE_NIGHTS + 4) return no('Not enough recent nights to compare.');
  const baseMean = mean(base.map(n => n.value)), drop = +(baseMean - latest.value).toFixed(2);
  if (drop < p.TEMP_DROP) return no('No clear drop last night.');
  if (s.promptsDismissed[`sensor:${latest.night}`]) return no('Already answered.');
  return { ask: true, key: `sensor:${latest.night}`, night: latest.night, drop, baseMean: +baseMean.toFixed(2), value: latest.value,
    text: `Your wrist skin temperature last night was ${drop.toFixed(1)} °C below your recent nights. That sometimes happens around the start of a period, but it has other causes too. Has your period started?` };
}

/** Should we offer a neutral "how are you feeling?" check-in because last night's HRV was unusually low for this person? */
export function checkinTiming(s, today, p = NUDGE_PARAMS) {
  const no = why => ({ ask: false, why });
  if (!s.consent.wearable) return no('Wearable data is off.');
  if (!Object.keys(CATEGORIES).some(c => s.consent.categories[c])) return no('No symptom categories are on.');
  const nights = validNights(s, 'hrv_rmssd', today), latest = nights.at(-1);
  if (!latest || latest.night !== addDays(today, -1)) return no('No usable reading from last night.');
  const base = nights.slice(-1 - p.HRV_BASE, -1).map(n => n.value);
  if (base.length < p.HRV_MIN_BASE) return no('Not enough nights to know your usual.');
  const usual = median(base);
  if (latest.value > usual * (1 - p.HRV_DROP)) return no('Last night looked usual for you.');
  if (s.promptsDismissed[`hrv:${latest.night}`]) return no('Already answered.');
  return { ask: true, key: `hrv:${latest.night}`, night: latest.night, value: latest.value, usual,
    text: 'Your overnight heart-rate variability was lower than your usual. Training, short sleep, alcohol, illness and stress can all do this, so it doesn\'t tell us how you feel. Want to log how you feel today?' };
}

/** Pre-filled answers from the person's own found patterns for today's cycle day. Only for categories not yet logged today. */
export function suggestions(s, today, patterns = findPatterns(s)) {
  const last = lastStartOf(s, today); if (!last) return [];
  const cd = diffDays(last, today) + 1, out = [];
  for (const pt of patterns) {
    if (cd < pt.from || cd > pt.to || s.dismissed[pt.key] || s.days[today]?.[pt.category] != null || s.promptsDismissed[`sugg:${pt.category}:${today}`]) continue;
    if (out.some(o => o.category === pt.category)) continue;
    const def = CATEGORIES[pt.category], counts = {};
    for (const e of pt.evidence) for (const x of e.entries) if (def.notable.includes(x.value)) counts[x.value] = (counts[x.value] || 0) + 1;
    const value = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]; if (!value) continue;
    const label = def.options.find(([v]) => v === value)[1];
    out.push({ category: pt.category, value, label, key: pt.key, basis: pt,
      text: `${def.label}: around this time you logged "${label.toLowerCase()}" in ${pt.notable} of ${pt.observed} cycles. Same today?` });
  }
  return out;
}
