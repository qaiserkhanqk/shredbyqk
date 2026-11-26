// QK's plan: turns the progression decisions into plain instructions, so the lifter never has to read
// a chart to know what to do. Pure functions, unit tested.
//  - For each exercise in today's workout: the weight, the sets × reps, and what changed since last time.
//  - A one-line weekly summary ("3 lifts go up, 1 stays the same") for the start of a new training week.
//  - A sentence QK says out loud as the set starts.
import { nextFor, fmtW, liftClass, sessionsOf, toUnit } from './progression.js';

const W = 7 * 864e5;
/** Monday-based week number, so "a new week" starts on Monday. */
export const weekOf = t => Math.floor((t - 4 * 864e5) / W); // 1 Jan 1970 was a Thursday

/** Last working weight for an exercise (kg), or null. */
export function lastKg(sets, id) {
  const days = sessionsOf(sets, id); if (!days.length) return null;
  return Math.max(...days[days.length - 1].map(s => s.kg));
}

/**
 * Plan rows for a list of exercise ids.
 * @param o { lib, sets, unit, light, schemeFor(id) }
 * @returns [{ id, name, rx, prevKg, delta, change: 'up'|'down'|'same'|'reps'|'new'|'light'|'none', line, why }]
 */
export function planRows(ids, o) {
  const { lib, sets, unit = 'kg', light = false, schemeFor = () => undefined } = o;
  return ids.map(id => {
    const item = lib[id]; if (!item) return null;
    const cls = liftClass(item), sc = schemeFor(id);
    if (!cls) return { id, name: item.name, change: 'none' };
    const rx = nextFor(item, sets, { unit, light, scheme: sc }), prevKg = lastKg(sets, id);
    if (!rx) {
      const target = sc ? `${sc.sets} × ${sc.lo === sc.hi ? sc.lo : sc.lo + '–' + sc.hi}` : '3 × 8';
      return { id, name: item.name, change: 'new', line: `${target} · pick weight`, why: 'First time: choose a weight you can do with good form. QK takes it from there.' };
    }
    const delta = prevKg ? rx.kg - prevKg : 0;
    const change = rx.action === 'light' ? 'light' : delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : rx.action === 'reps' ? 'reps' : 'same';
    const d = Math.abs(toUnit(delta, unit)), dTxt = `${Math.round(d * 4) / 4} ${unit}`;
    const tag = { up: `▲ ${dTxt}`, down: `▼ ${dTxt}`, reps: '+ reps', same: 'same weight', light: 'light week' }[change];
    return { id, name: item.name, rx, prevKg, delta, change, tag, line: `${rx.sets} × ${rx.reps} · ${fmtW(rx.kg, unit)}`, why: rx.why };
  }).filter(Boolean);
}

/** "3 lifts go up, 1 stays the same, 1 backs off." */
export function summary(rows) {
  const n = k => rows.filter(r => r.change === k).length, parts = [];
  if (rows.some(r => r.change === 'light')) return 'Light week: same weights, fewer sets. Recover and come back stronger.';
  const up = n('up'), reps = n('reps'), same = n('same'), down = n('down');
  if (up) parts.push(`${up} lift${up > 1 ? 's go' : ' goes'} up`);
  if (reps) parts.push(`${reps} add${reps > 1 ? '' : 's'} reps`);
  if (same) parts.push(`${same} stay${same > 1 ? '' : 's'} the same`);
  if (down) parts.push(`${down} back${down > 1 ? '' : 's'} off`);
  return parts.length ? parts.join(', ').replace(/^\w/, c => c.toUpperCase()) + '.' : '';
}

const say = (kg, unit) => { const v = Math.round(toUnit(kg, unit) * 4) / 4; return `${v} ${unit === 'lb' ? 'pounds' : 'kilos'}`; };
/** What QK says at the start of a set: "Today: 3 sets of 8 at 70 kilos. Up 5 from last time." */
export function spokenTarget(row, unit = 'kg') {
  if (!row?.rx) return '';
  const r = row.rx, base = `Today: ${r.sets} sets of ${r.reps} at ${say(r.kg, unit)}.`;
  const d = Math.round(Math.abs(toUnit(row.delta || 0, unit)) * 4) / 4;
  const tail = { up: ` Up ${d} from last time.`, down: ` Down ${d} from last time, so you can build back up.`, reps: ' Same weight, one more rep.', same: ' Same weight as last time.', light: ' Light week, fewer sets.' }[row.change] || '';
  return base + tail;
}

/** Program week (1-based) and whether it's finished. */
export function programWeek(active, prog, now = Date.now()) {
  if (!active || !prog) return null;
  const week = Math.floor((now - active.start) / W) + 1;
  return { week: Math.min(week, prog.weeks), of: prog.weeks, finished: week > prog.weeks };
}
