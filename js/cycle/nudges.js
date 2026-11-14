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
import { addDays, diffDays, human } from './dates.js';
import { CATEGORIES } from './model.js';
import { segments } from './wearables.js';
import { findPatterns, PATTERN_PARAMS } from './patterns.js';

export const NUDGE_PARAMS = Object.freeze({ MIN_CYCLE_DAY: 15, BASE_NIGHTS: 5, TEMP_DROP: 0.2, RECENT_PERIOD_DAYS: 10, HRV_BASE: 14, HRV_MIN_BASE: 7, HRV_DROP: 0.2, HRV_WINDOW_DAYS: 28 });
// HRV_WINDOW_DAYS (issue 9 reproduced in 0f26696): the baseline may only use the current device's nights from the
// last 28 days. Like every value here it is a placeholder that needs device and clinical evidence.
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
  const since = addDays(latest.night, -p.HRV_WINDOW_DAYS);
  const baseNights = nights.slice(0, -1).filter(n => n.night >= since).slice(-p.HRV_BASE), base = baseNights.map(n => n.value);
  if (base.length < p.HRV_MIN_BASE) return no(`Not enough recent nights from this device (${base.length} in the last ${p.HRV_WINDOW_DAYS} days; ${p.HRV_MIN_BASE} needed).`);
  const usual = median(base), from = baseNights[0].night, to = baseNights.at(-1).night;
  if (latest.value > usual * (1 - p.HRV_DROP)) return no('Last night looked usual for you.');
  if (s.promptsDismissed[`hrv:${latest.night}`]) return no('Already answered.');
  return { ask: true, key: `hrv:${latest.night}`, night: latest.night, value: latest.value, usual, baseline: { nights: base.length, from, to },
    text: `Your overnight heart-rate variability was lower than your typical level over ${base.length} nights from ${human(from)} to ${human(to)}. Training, short sleep, alcohol, illness and stress can all do this, so it doesn't tell us how you feel. Want to log how you feel today?` };
}

/** Pre-filled answers from the person's own found patterns for today's cycle day. Only for categories not yet logged today. */
export function suggestions(s, today, patterns = findPatterns(s)) {
  const last = lastStartOf(s, today); if (!last) return [];
  const cd = diffDays(last, today) + 1, out = [];
  for (const pt of patterns) {
    if (cd < pt.from || cd > pt.to || s.dismissed[pt.key] || s.days[today]?.[pt.category] != null || s.promptsDismissed[`sugg:${pt.category}:${today}`]) continue;
    if (out.some(o => o.category === pt.category)) continue;
    // Count CYCLES per exact value (issue 5 reproduced in 0f26696): repeated logs in one cycle count once, and
    // different words in different cycles are never reported as one word.
    const def = CATEGORIES[pt.category], cyclesWith = {};
    for (const e of pt.evidence) if (e.observed) for (const v of new Set(e.entries.map(x => x.value).filter(v => def.notable.includes(v)))) cyclesWith[v] = (cyclesWith[v] || 0) + 1;
    const ranked = Object.entries(cyclesWith).sort((a, b) => b[1] - a[1]);
    const [top, n] = ranked[0] || [];
    if (top && n >= PATTERN_PARAMS.MIN_OBSERVED && (ranked.length === 1 || ranked[1][1] < n)) {
      const label = def.options.find(([v]) => v === top)[1];
      out.push({ category: pt.category, value: top, label, cycles: n, key: pt.key, basis: pt,
        text: `${def.label}: around this time you logged "${label.toLowerCase()}" in ${n} of ${pt.observed} cycles. Same today?` });
    } else {
      out.push({ category: pt.category, value: null, label: null, cycles: pt.notable, key: pt.key, basis: pt, // nothing pre-filled
        text: `${def.label}: around this time you logged ${def.notableLabel} in ${pt.notable} of ${pt.observed} cycles${ranked.length > 1 ? ', not always the same' : ''}. How is it today?` });
    }
  }
  return out;
}
