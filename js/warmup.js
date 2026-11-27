// Warm-up sets and workout length. Pure functions, unit tested.
//  - Warm-ups: a ramp to today's working weight, rounded to real plates, so the first work set isn't the
//    first time the joints see load. Barbell lifts: bar × 10, ~40% × 5, ~60% × 3, ~80% × 1 (lighter
//    work weights use fewer steps). Dumbbell/machine lifts: one set at ~50% × 8. Small isolation moves: none.
//  - Length: an estimate from sets, reps and rest, and a time cap that trims accessories before main lifts.
import { liftClass, roundLoad, plates, fmtW, toUnit } from './progression.js';

export function warmupSets(item, workKg, unit = 'kg') {
  const cls = liftClass(item); if (!cls || !(workKg > 0)) return [];
  if (cls === 'small') return [];
  const round = kg => roundLoad(kg, cls, unit);
  if (cls === 'mid') { const kg = round(workKg * 0.5); return kg < workKg ? [{ kg, reps: 8 }] : []; }
  const bar = unit === 'lb' ? 45 * 0.45359237 : 20;
  if (workKg <= bar + 0.01) return [];
  const steps = workKg >= 100 ? [[0.4, 5], [0.6, 3], [0.8, 1]] : workKg >= 60 ? [[0.5, 5], [0.75, 2]] : [[0.6, 5]];
  const out = [{ kg: bar, reps: 10 }];
  for (const [f, reps] of steps) { const kg = round(workKg * f); if (kg > out[out.length - 1].kg + 0.01 && kg < workKg - 0.01) out.push({ kg, reps }); }
  return out.map(s => ({ ...s, plates: plates(s.kg, unit)?.text || '' }));
}

/** "Bar × 10, 40 kg × 5, 60 kg × 3" */
export const warmupLine = (sets, unit = 'kg') => sets.map((s, i) => `${i === 0 && s.plates === 'Just the bar' ? 'Bar' : fmtW(s.kg, unit)} × ${s.reps}`).join(', ');
/** Spoken: "Warm up: the bar for 10, then 40 kilos for 5." */
export const warmupSpeech = (sets, unit = 'kg') => sets.length ? 'Warm up: ' + sets.map((s, i) => `${i ? 'then ' : ''}${s.plates === 'Just the bar' ? 'the bar' : Math.round(toUnit(s.kg, unit) * 4) / 4 + (unit === 'lb' ? ' pounds' : ' kilos')} for ${s.reps}`).join(', ') + '.' : '';

// ---- Workout length ----
const repSecs = reps => { const m = /^(\d+)(?:-(\d+))?/.exec(String(reps)); if (!m) return null; const hi = +(m[2] || m[1]); return hi * 3.5 * (/side/.test(reps) ? 2 : 1); };
const timeSecs = reps => { const m = /^(\d+(?:\.\d+)?)\s*(s|min)$/.exec(String(reps).trim()); return m ? +m[1] * (m[2] === 'min' ? 60 : 1) : null; };

/** Seconds for one program item: work + rest between sets + changeover. */
export function itemSecs(it) {
  const [, sets, reps, rest] = it;
  const work = timeSecs(reps) ?? repSecs(reps) ?? (/\b(km|m)\b|m$/.test(reps) ? 300 : 45);
  return sets * (work + 15) + Math.max(0, sets - 1) * (rest || 0) + 60;
}
/** Minutes for a day, with ~1 minute per warm-up set on lifts that have them. */
export function dayMinutes(items, warmups = 0) {
  return Math.round((items.reduce((a, it) => a + itemSecs(it), 0) + warmups * 60 + 5 * 60) / 60); // + 5 min general warm-up
}

/**
 * Fit a day into `minutes`: first cut accessory sets to 2, then drop accessories from the end.
 * The first two items (main lifts) are never dropped.
 * @returns { items, minutes, cut: [{ id, from, to }] }
 */
export function fitTo(items, minutes, warmups = 0) {
  let out = items.map(it => it.slice()); const cut = [];
  const fits = () => dayMinutes(out, warmups) <= minutes;
  for (let i = out.length - 1; i >= 2 && !fits(); i--) if (out[i][1] > 2) { cut.push({ id: out[i][0], from: out[i][1], to: 2 }); out[i][1] = 2; }
  while (!fits() && out.length > 2) { const it = out.pop(); cut.push({ id: it[0], from: it[1], to: 0 }); }
  for (let i = 1; i >= 0 && !fits(); i--) if (out[i] && out[i][1] > 3) { cut.push({ id: out[i][0], from: out[i][1], to: 3 }); out[i][1] = 3; }
  return { items: out, minutes: dayMinutes(out, warmups), cut };
}
