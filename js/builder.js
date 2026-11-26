// Workout builder: lets the coach (or a client) build their own program from the library.
// A built program has exactly the same shape as the built-in ones (programs.js), so everything else
// works on it unchanged: QK's weights, the Today plan, workout mode, the monthly refresh and swaps.
// Pure functions, unit tested.
import { liftClass } from './progression.js';

/** Sensible sets × reps × rest for an exercise, so adding one is a single tap. */
export function defaults(item) {
  if (!item) return [3, '10', 60];
  if (item.hold || item.pattern === 'plank') return [3, `${item.hold || 30}s`, 45];
  if (item.kind === 'run' || item.kind === 'cardio') return [1, '20 min', 0];
  if (item.kind === 'hyrox') return [3, '250m', 60];
  if (item.kind === 'plyo') return [3, '5', 90];
  if (item.kind === 'stretch' || item.kind === 'pilates') return [2, '30s', 15];
  const cls = liftClass(item);
  if (cls === 'big-lower' || cls === 'big-upper') return [4, '6-8', 150];
  if (cls === 'mid') return [3, '8-12', 90];
  if (cls === 'small') return [3, '12-15', 60];
  return [3, '10-15', 60]; // bodyweight
}

const REPS = /^(\d+)(-\d+)?$|^\d+(\.\d+)?\s?(s|min|m|km)$|^\d+\/side$|^\d+-\d+\/side$/;
/** Problems with a program, in plain words (empty when it's ready to use). */
export function validate(p, lib) {
  const out = [];
  if (!p.name?.trim()) out.push('Give it a name.');
  if (!p.plan?.length) out.push('Add at least one day.');
  p.plan?.forEach((d, i) => {
    if (!d.items.length) out.push(`${d.name || 'Day ' + (i + 1)} has no exercises.`);
    for (const it of d.items) {
      if (!lib[it[0]]) out.push(`Unknown exercise: ${it[0]}.`);
      if (!(it[1] >= 1 && it[1] <= 12)) out.push(`${lib[it[0]]?.name || it[0]}: sets should be 1 to 12.`);
      if (!REPS.test(String(it[2]).trim())) out.push(`${lib[it[0]]?.name || it[0]}: reps like 8, 8-12, 30s, 400m or 10/side.`);
    }
  });
  return out;
}

/** A new, empty program for the builder. */
export const blank = (now = Date.now()) => ({ id: 'my-' + now.toString(36), name: '', goal: 'Your program', level: 'Built by you', days: 3, weeks: 8, custom: true, tagline: '', method: 'Your own program, built in Shred by QK.', plan: [{ name: 'Day 1', focus: '', items: [] }] });

/** Finish a draft: tidy names, set days to the number of planned days. */
export function finalize(draft) {
  const plan = draft.plan.filter(d => d.items.length).map((d, i) => ({ ...d, name: d.name?.trim() || `Day ${i + 1}`, items: d.items.map(it => [it[0], +it[1], String(it[2]).trim(), +it[3] || 0, ...(it[4] || it[5] ? [it[4] || ''] : []), ...(it[5] ? [it[5]] : [])]) }));
  return { ...draft, name: draft.name.trim(), plan, days: Math.min(7, +draft.daysPerWeek || plan.length), tagline: draft.tagline?.trim() || `${plan.length} day${plan.length > 1 ? 's' : ''}, built by you.` };
}

/** Library search for the builder: name, muscle or equipment, camera-checked first. */
export function search(lib, q, { limit = 30, exclude = [] } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return Object.values(lib)
    .filter(x => !x.rehab && !exclude.includes(x.id) && words.every(w => `${x.name} ${(x.muscles || []).join(' ')} ${x.equipment} ${x.kind || ''}`.toLowerCase().includes(w)))
    .sort((a, b) => (b.pattern ? 1 : 0) - (a.pattern ? 1 : 0) || a.name.length - b.name.length)
    .slice(0, limit);
}

/** Start a custom program from a built-in one (so a coach can tweak a template). */
export const fromTemplate = (p, now = Date.now()) => ({ ...JSON.parse(JSON.stringify(p)), id: 'my-' + now.toString(36), name: `${p.name} (my version)`, custom: true, home: p.home, level: 'Built by you', method: `Your version of ${p.name}. ${p.method}` });

/** Move an item within a day (drag-free reordering with up/down buttons). */
export function move(items, i, dir) {
  const j = i + dir; if (j < 0 || j >= items.length) return items;
  const out = items.slice(); [out[i], out[j]] = [out[j], out[i]]; return out;
}
