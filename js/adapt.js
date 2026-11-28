// Two-weekly check-ins: the scale decides what changes next, the client chooses how.
//
// Bodies adapt. As someone gets lighter they burn less, so a target that worked for a month stops working.
// Every 14 days the app asks for a morning weigh-in, reads the trend, and offers a small next step:
//   - weight held steady while cutting → first, gently, more movement (steps); eating less is the second option
//   - losing at a healthy pace → "keep going as you are", or a small nudge: 100 kcal less or 1,500 more steps
//   - losing too fast (over 1% of body weight a week) → eat a little more, to keep muscle
//   - bulking too slowly or too fast, or maintenance drifting → ±100–150 kcal
// Changes are small (100–150 kcal, 1,500–2,000 steps) and never go below the safety floor in targets().
// During rehab it never suggests eating less.
import { weightTrend, dayKey } from './weekly.js';
import * as N from './nutrition.js';

const DAY = 864e5;
export const CHECKIN_DAYS = 14;
const r1 = v => Math.round(v * 10) / 10;
const fmt = v => Math.round(v).toLocaleString('en');

/** All weigh-ins, oldest first (the food log's weigh-ins plus body-scan weights). */
export const allWeights = S => [...(S.food?.weights || []), ...(S.scans || []).filter(s => +s.weight > 0).map(s => ({ at: s.at, kg: +s.weight }))]
  .filter(w => w.kg > 0).sort((a, b) => a.at - b.at);

/** Is a check-in due? Due 14 days after the last one (or after the first weigh-in), or now if they never weighed in. */
export function checkinDue(weights, adapt = {}, now = Date.now()) {
  const from = adapt.lastAt || (weights.length ? weights[0].at : null);
  if (from == null) return true;
  return now - from >= (CHECKIN_DAYS - 0.5) * DAY;
}
/** Days until the next check-in (0 when due). */
export function daysToCheckin(weights, adapt = {}, now = Date.now()) {
  const from = adapt.lastAt || (weights.length ? weights[0].at : now);
  return Math.max(0, Math.ceil((from + CHECKIN_DAYS * DAY - now) / DAY));
}

/** The step goal now: the one chosen at a check-in, or what they already walk (at least 6,000). */
export function stepGoal(adapt = {}, avgSteps = 0) {
  if (adapt.stepGoal) return adapt.stepGoal;
  return Math.max(8000, Math.ceil((avgSteps || 0) / 500) * 500); // 8,000 a day until a check-in sets one (same as the Activity score)
}

/**
 * Read the last two to three weeks and decide what to offer.
 * o: { weights, goal: 'lose'|'maintain'|'gain', target (from targets()), adapt, avgSteps, rehab, now, signals (js/signals.js), female }
 * Returns { kind, title, message, change: { kg, days } | null, choices: [{ id, label, delta?, steps? }] }.
 */
export function evaluate(o) {
  const now = o.now ?? Date.now(), adapt = o.adapt || {}, goal = o.goal || 'maintain';
  const trend = weightTrend(o.weights || [], now, 21);
  const latest = (o.weights || []).filter(w => w.at <= now).slice(-1)[0];
  const steps = stepGoal(adapt, o.avgSteps), keep = { id: 'keep', label: 'Keep everything as it is' };
  if (!latest || latest.at < now - 2 * DAY) return { kind: 'weigh', title: 'Check-in day', message: 'Weigh yourself in the morning, after the toilet and before breakfast, and enter it here. QK reads your last two weeks and suggests your next step.', change: null, choices: [] };
  if (!trend || trend.spanDays < 10) return { kind: 'more', title: 'Thanks for weighing in', message: 'QK needs about two weeks of weigh-ins to see a trend through the day-to-day ups and downs (water, salt, a big dinner). Weigh in once or twice a week and QK will check in again.', change: null, choices: [] };

  const kg = trend.perWeek * 2, pct = trend.perWeek / trend.latest * 100;
  // More than 2% of body weight a week is almost always a typo (or pounds typed as kg), not the body: no advice on it.
  if (Math.abs(pct) > 2) return { kind: 'check', change: { kg: r1(kg), days: 14 }, title: 'One weigh-in looks off',
    message: 'Your weigh-ins jump more than a body really changes in two weeks, so one of them is probably a typo (or pounds typed as kg). If it was the last one, delete it here; then weigh in again tomorrow morning.', choices: [{ id: 'undo', label: 'Delete my last weigh-in' }, { id: 'keep', label: 'It\'s right, keep it' }] };
  const change = { kg: r1(kg), days: 14 };
  // Ramadan: weight usually dips 1–1.5 kg (mostly water and less food in the gut) and comes back within weeks of Eid
  // (Sadeghirad 2014; Fernando 2019). Don't read it as progress, and never offer a cut while fasting.
  if (o.ramadan) return { kind: 'ramadan', change, title: 'Ramadan check-in',
    message: `${kg <= -0.05 ? `You're down ${r1(-kg)} kg` : kg >= 0.05 ? `You're up ${r1(kg)} kg` : 'Your weight is steady'}. In Ramadan the scale moves with water and meal timing, and most of a Ramadan drop comes back after Eid, so QK won't change your calories now. Protein at sehri and iftar, water between iftar and sehri, and keep training light. QK checks in properly after Eid.`,
    choices: [keep] };
  const said = kg <= -0.05 ? `You're down ${r1(-kg)} kg over the last two weeks` : kg >= 0.05 ? `You're up ${r1(kg)} kg over the last two weeks` : 'Your weight has held steady over the last two weeks';
  const lower = d => {
    if (o.rehab && d < 0) return null;
    return o.target && d < 0 && o.target.kcal + d < (o.target.floor || 1200) ? null : { id: 'kcal', label: `Eat ${Math.abs(d)} kcal ${d < 0 ? 'less' : 'more'} a day`, delta: d };
  };
  // No step increase past 15,000 a day, and none during rehab (the physio sets activity then).
  const moreSteps = add => o.rehab || steps >= 15000 ? null : ({ id: 'steps', label: `Walk ${fmt(Math.min(15000, steps + add) - steps)} more steps a day (goal ${fmt(Math.min(15000, steps + add))})`, steps: Math.min(15000, steps + add) });
  const pick = (...xs) => xs.filter(Boolean);
  // The small signals (js/signals.js) come first: they explain a fortnight better than the scale alone.
  const sig = o.signals || {}, cyc = sig.cycle, well = sig.wellbeing, str = sig.strength, eng = sig.engagement;
  const flat = pct > -0.15;
  if (cyc?.inWindow && (goal === 'lose' ? flat : pct > 0)) return { kind: 'cycle', change, title: 'Your period week',
    message: `${said}. In the days before and at the start of a period the body holds 1–2 kg of water${goal === 'lose' ? ', which hides fat loss' : ''}. Nothing to change: weigh in again next week and the real trend shows.`,
    choices: [{ id: 'keep', label: 'Keep everything as it is' }] };
  if (goal === 'lose' && flat && well?.poor) return { kind: 'rough-week', change, title: 'A tough week',
    message: `${said}. ${well.sleepH != null && well.sleepH < 6 ? `You slept about ${well.sleepH} hours a night` : 'Your mornings felt rough'} this week. Poor sleep and stress hold water and raise hunger, so the scale stalls even when you're doing well. Keep your food the same and protect your sleep; QK checks again in two weeks.`,
    choices: pick({ id: 'keep', label: 'Keep everything as it is' }, moreSteps(1000)) };
  if (goal === 'lose' && !flat && str?.change != null && str.change <= -5) return { kind: 'strength-drop', change, title: 'Your lifts are dipping',
    message: `${said}, but your strength is down about ${Math.abs(str.change)}% over the same weeks. That's a sign the cut is a bit steep. A little more food keeps the muscle you're working for.`,
    choices: pick(lower(100), { id: 'keep', label: 'Keep everything as it is' }) };
  const fewLogs = eng && eng.foodDays14 < 4 ? ` (You logged food on ${eng.foodDays14} of the last 14 days, so QK is reading the scale more than your meals. A photo a day makes this sharper.)` : '';

  if (goal === 'lose') {
    if (pct > 0.25) return { kind: 'gaining', change, title: 'The scale went up',
      message: `${said}. On a cut that usually means some meals aren't in the log (chai, a few bites, weekend dinners, oil in shared salan) or extra water from salty food. Log every meal for one week so QK can see the full picture, or take a small step now.${fewLogs}`,
      choices: pick({ id: 'keep', label: 'Log every meal this week, then check again' }, lower(-150), moreSteps(2000)) };
    if (pct > -0.15) return { kind: 'stalled', change, title: 'Your weight has paused',
      message: `${said}. That's normal: your body gets used to a routine, and water and salt can hide fat loss for a while. The kindest next step is a little more movement. Your food can stay the same.${fewLogs}`,
      choices: pick(moreSteps(2000), lower(-150), { id: 'keep', label: 'Give it two more weeks as it is' }, o.female ? { id: 'period', label: 'It\'s my period week', why: 'cycle' } : null) };
    if (pct < -1) return { kind: 'fast', change, title: 'You\'re losing quickly',
      message: `${said}, more than 1% of your weight a week. Going this fast can cost muscle and energy. A little more food keeps the progress and protects your training.`,
      choices: pick(lower(150), keep) };
    return { kind: 'progress', change, title: 'Great progress',
      message: `${said}. That's a healthy pace. As you get lighter, your body burns a little less each day, so to keep it going you can take one small step now, or keep everything the same for another two weeks.`,
      choices: pick(keep, moreSteps(1500), lower(-100)) };
  }
  if (goal === 'gain') {
    if (pct < 0.1) return { kind: 'slow', change, title: 'Time for a little more food',
      message: `${said}. To build muscle the scale needs to climb slowly, about 0.25–0.5% a week. A small extra snack does it.`,
      choices: pick(lower(150), keep) };
    if (pct > 0.6) return { kind: 'fast', change, title: 'Gaining a bit fast',
      message: `${said}. Faster than about 0.5% a week is mostly fat, not muscle. A little less food keeps the gains lean.`,
      choices: pick(lower(-100), keep) };
    return { kind: 'progress', change, title: 'Right on track', message: `${said}: a lean, steady gain. Keep training hard and eating the same.`, choices: [keep] };
  }
  if (Math.abs(pct) <= 0.3) return { kind: 'steady', change, title: 'Steady, as planned', message: `${said}. Your calories are right for staying where you are.`, choices: [keep] };
  return { kind: pct > 0 ? 'drift-up' : 'drift-down', change, title: pct > 0 ? 'Drifting up a little' : 'Drifting down a little',
    message: `${said}. A small change brings it back to steady.`,
    choices: pick(lower(pct > 0 ? -100 : 100), pct > 0 ? moreSteps(1500) : null, keep) };
}

/** Apply the client's choice. Mutates profile (kcalAdjust) and adapt (stepGoal, lastAt, history). */
export function applyChoice({ profile, adapt, decision, choiceId, weight, now = Date.now() }) {
  const c = (decision.choices || []).find(x => x.id === choiceId) || { id: 'keep' };
  if (c.delta) {
    const before = N.targets(profile), m = N.maintenance(profile);
    if (before && m) {
      // The adjustment that puts the target exactly `delta` from where it is now, even if it sat on the safety floor.
      const goalF = { lose: -0.2, maintain: 0, gain: 0.1 }[N.dietGoal(profile)];
      profile.kcalAdjust = Math.round(Math.max(-600, Math.min(600, before.kcal + c.delta - m.tdee * (1 + goalF))));
    } else profile.kcalAdjust = Math.max(-600, Math.min(600, (+profile.kcalAdjust || 0) + c.delta));
  }
  if (c.steps) adapt.stepGoal = c.steps;
  adapt.lastAt = now;
  (adapt.history ||= []).push({ at: now, day: dayKey(now), kind: decision.kind, choice: c.id, delta: c.delta || 0, stepGoal: adapt.stepGoal || null, kg: weight ?? null });
  if (adapt.history.length > 200) adapt.history.splice(0, adapt.history.length - 200);
  return c;
}

/** A repeating calendar reminder to weigh in every two weeks (works when the app is closed). */
export function weighInIcs(now = Date.now(), url = '') {
  const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0);
  const p = n => String(n).padStart(2, '0'), dt = x => `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T${p(x.getHours())}${p(x.getMinutes())}00`;
  const s = new Date(now), stamp = `${s.getUTCFullYear()}${p(s.getUTCMonth() + 1)}${p(s.getUTCDate())}T${p(s.getUTCHours())}${p(s.getUTCMinutes())}00Z`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shred by QK//Check-ins//EN', 'BEGIN:VEVENT', 'UID:shred-qk-weigh-in@shredbyqk', `DTSTAMP:${stamp}`,
    `DTSTART:${dt(d)}`, `DTEND:${dt(new Date(d.getTime() + 15 * 60e3))}`, 'RRULE:FREQ=WEEKLY;INTERVAL=2', 'SUMMARY:Weigh-in with QK',
    `DESCRIPTION:Weigh yourself before breakfast and enter it in Shred by QK. QK reads your two weeks and suggests your next step.${url ? '\\n' + url : ''}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Check-in day: weigh yourself before breakfast', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

/** Points for the weight chart: weigh-ins in the range, plus a 7-day smoothed line through them. */
export const RANGES = [{ id: '1m', label: '1M', days: 31 }, { id: '3m', label: '3M', days: 92 }, { id: '1y', label: '1Y', days: 366 }, { id: 'all', label: 'All', days: Infinity }];
export function weightSeries(weights, rangeId = '3m', now = Date.now()) {
  const R = RANGES.find(r => r.id === rangeId) || RANGES[1];
  const pts = weights.filter(w => w.at <= now && (R.days === Infinity || w.at >= now - R.days * DAY));
  const smooth = pts.map(w => {
    const near = weights.filter(x => x.at <= w.at && x.at > w.at - 7 * DAY);
    return { at: w.at, kg: near.reduce((a, x) => a + x.kg, 0) / near.length };
  });
  const first = pts[0], last = pts[pts.length - 1];
  const all = weights.filter(w => w.at <= now);
  return { pts, smooth, change: first && last && last !== first ? r1(last.kg - first.kg) : null, days: first && last ? Math.round((last.at - first.at) / DAY) : 0,
    sinceStart: all.length > 1 ? r1(all[all.length - 1].kg - all[0].kg) : null, startAt: all[0]?.at ?? null };
}
