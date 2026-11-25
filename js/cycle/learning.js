// Learning stage: an honest status of how much the app has learned about THIS person's cycle, and, when a wearable is
// on, how many nights it has recorded this cycle and whether last night was recorded.
//
// No new thresholds: "learned" uses the estimate's own minimum (predict.PARAMS.FULL_MIN = 3 usable cycles), and the
// band's figure is the temperature research rule's own need (tempshift.SHIFT_PARAMS.BASELINE + CONFIRM nights).
// Missing nights are never filled in, and the period estimate never depends on the band.
import { addDays } from './dates.js';
import { cycles } from './model.js';
import { PARAMS } from './predict.js';
import { SHIFT_PARAMS } from './tempshift.js';

export const LEARNING_VERSION = 'learning-stage-1.0.0';

export function learningStage(s, today) {
  const needed = PARAMS.FULL_MIN;
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort();
  const usable = cycles(s).filter(c => c.usable && c.nextStart <= today).length;
  let stage, text;
  if (s.situation?.pregnant) { stage = 'paused'; text = 'Learning is paused while you are pregnant.'; }
  else if (!starts.length) { stage = 'not_started'; text = 'Log your first period start to begin. The app learns only from what you log.'; }
  else if (!usable) { stage = 'first_cycle'; text = 'Learning your cycle: your first cycle is in progress. An estimate appears once your next period starts.'; }
  else if (usable < needed) { stage = 'learning'; text = `Learning your cycle: ${usable} of ${needed} cycles. Early estimates use very few cycles, so they are rough.`; }
  else { stage = 'learned'; text = `Your estimate uses your last ${Math.min(usable, PARAMS.RECENT)} cycles and keeps updating as you log. Every cycle is different, so it can still be off.`; }
  const out = { version: LEARNING_VERSION, stage, usableCycles: usable, needed, text };
  if (s.consent?.wearable) out.band = bandStatus(s, today, starts.at(-1) || null);
  return out;
}

function bandStatus(s, today, cycleStart) {
  const temp = (s.wearable?.nights || []).filter(n => n.metric === 'skin_temp');
  const yesterday = addDays(today, -1);
  const okNights = new Set(temp.filter(n => n.status === 'ok' && n.value != null && (!cycleStart || n.night >= cycleStart) && n.night < today).map(n => n.night));
  const last = temp.filter(n => n.night === yesterday);
  const lastNight = last.some(n => n.status === 'ok' && n.value != null) ? 'recorded' : last.length ? 'too_little_wear' : 'not_recorded';
  const neededForTemperature = SHIFT_PARAMS.BASELINE + SHIFT_PARAMS.CONFIRM;
  const gap = lastNight === 'not_recorded' ? 'Your band didn\'t record last night. ' : lastNight === 'too_little_wear' ? 'Your band recorded too little of last night to use. ' : '';
  const text = `${gap}${okNights.size} usable ${okNights.size === 1 ? 'night' : 'nights'} recorded this cycle (the temperature research needs ${neededForTemperature}). Missing nights stay missing: nothing is filled in, and your period estimate doesn't depend on the band.`;
  return { nightsThisCycle: okNights.size, neededForTemperature, lastNight, text };
}
