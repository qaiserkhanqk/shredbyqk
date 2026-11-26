// Days a week: the same program at 3, 4 or 5 sessions a week, and QK judging the right number from
// what the lifter actually does. Pure functions, unit tested.
//
// Evidence: with weekly sets equal, training a muscle 1, 2 or 3+ times a week gives about the same growth
// (Schoenfeld 2019, doi:10.1080/02640414.2018.1555906) and strength (Grgic 2018,
// doi:10.1007/s40279-018-0872-x); more weekly sets give more growth (Schoenfeld 2017,
// doi:10.1080/02640414.2016.1210197). So fewer days keep each muscle's weekly sets and pack them into
// fewer, longer sessions. Limits per session (sets per muscle, minutes) are practical rules, not research
// findings: past them QK trims the smallest accessories first and never the main lifts.
import { liftClass } from './progression.js';
import { dayMinutes } from './warmup.js';

/** Programs whose sessions can be re-packed. Circuits, sport, HYROX, plyometric and specialist blocks
 *  keep their own days because moving their pieces would break how they work. */
export const FLEX = ['gainsEngine', 'powerPump', 'hypertrophyLab', 'platformPrep', 'strengthBuilder', 'massMonster', 'elitePhysique', 'gluteLab', 'dumbbellDen', 'bandStrong'];
export const DAY_CHOICES = [3, 4, 5];
export const canAdapt = p => !!p && FLEX.includes(p.id);
/** The days a week a program starts on: 5, except beginner programs, which start on their own 3. */
export const defaultDaysFor = p => (canAdapt(p) && p.level !== 'Beginner' ? 5 : p?.days);
export const clampDays = n => Math.max(3, Math.min(5, Math.round(n) || 5));

const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'];
const UPPER = ['Chest', 'Back', 'Shoulders', 'Triceps', 'Biceps', 'Forearms'];
export const MUSCLE_CAP = 10; // hard sets for one muscle in one session
const LETTERS = 'ABCDEFGH';

const primary = (lib, id) => lib[id]?.muscles?.[0] || 'Other';
const isBig = (lib, id) => (liftClass(lib[id]) || '').startsWith('big');
const warmups = (lib, items) => items.reduce((a, it) => a + (isBig(lib, it[0]) ? 3 : liftClass(lib[it[0]]) === 'mid' ? 1 : 0), 0);
const minutesOf = (lib, items) => dayMinutes(items, warmups(lib, items));

/** Primary-muscle working sets per week. */
export function muscleSets(p, lib) {
  const per = p.days / p.plan.length, out = {};
  for (const d of p.plan) for (const it of d.items) { const m = primary(lib, it[0]); out[m] = (out[m] || 0) + it[1] * per; }
  return out;
}

/**
 * The program re-packed into `n` sessions a week.
 * @returns the program with `days: n`, a new `plan`, `adapted: { from, to, cut: [{ id, from, to }] }`;
 *          the program itself when it can't or needn't be adapted.
 */
const MAX_MIN = { 3: 85, 4: 75, 5: 70 }; // longer sessions are normal when training fewer days
export function adapt(p, n, lib, { maxMinutes = MAX_MIN[n] || 75 } = {}) {
  if (!canAdapt(p) || !n || n === p.days || p.plan.length !== p.days) return p;
  // Units: a single exercise, or a superset/circuit group that moves as one.
  const units = [];
  p.plan.forEach((d, di) => {
    const byKey = new Map();
    d.items.forEach((it, ii) => {
      const key = it[5] ? `g${it[5]}` : `i${ii}`;
      if (!byKey.has(key)) byKey.set(key, { items: [], di, order: ii, grouped: !!it[5] });
      byKey.get(key).items.push(it.slice(0, 5));
    });
    for (const u of byKey.values()) {
      u.main = u.items.some(it => isBig(lib, it[0])) || (u.order === 0 && !u.grouped);
      u.muscle = primary(lib, u.items[0][0]);
      u.sets = u.items.reduce((a, it) => a + it[1], 0);
      u.ids = u.items.map(it => it[0]);
      units.push(u);
    }
  });
  const days = Array.from({ length: n }, () => ({ units: [], sets: {}, total: 0, mains: 0, lower: 0, upper: 0, ids: new Set() }));
  const add = (day, u) => {
    day.units.push(u); day.total += u.sets; u.ids.forEach(id => day.ids.add(id));
    for (const it of u.items) { const m = primary(lib, it[0]); day.sets[m] = (day.sets[m] || 0) + it[1]; if (LOWER.includes(m)) day.lower += it[1]; else if (UPPER.includes(m)) day.upper += it[1]; }
    if (u.main) day.mains++;
  };
  const clash = (day, u) => u.ids.some(id => day.ids.has(id));
  // Main lifts first, spread so no day repeats an exercise and the same muscle's mains sit on different days.
  const mains = units.filter(u => u.main).sort((a, b) => a.order - b.order || a.di - b.di);
  const rest = units.filter(u => !u.main).sort((a, b) => b.sets - a.sets || a.di - b.di);
  for (const u of mains) {
    const score = day => (clash(day, u) ? 1000 : 0) + (day.sets[u.muscle] || 0) * 3 + day.mains * 10 + day.total * 0.2;
    add(days.reduce((best, day) => (score(day) < score(best) ? day : best)), u);
  }
  // Accessories: the day with room for that muscle, in the same region (upper/lower) if possible, then the shortest.
  for (const u of rest) {
    const lower = LOWER.includes(u.muscle), upper = UPPER.includes(u.muscle);
    const score = day => {
      const have = day.sets[u.muscle] || 0, region = lower ? day.lower - day.upper : upper ? day.upper - day.lower : 0;
      return (clash(day, u) ? 1000 : 0) + Math.max(0, have + u.sets - MUSCLE_CAP) * 50 + have * 2 - Math.sign(region) * 4 + day.total * 0.6;
    };
    add(days.reduce((best, day) => (score(day) < score(best) ? day : best)), u);
  }
  const cut = [], base = muscleSets(p, lib), now = {};
  for (const u of units) for (const it of u.items) { const m = primary(lib, it[0]); now[m] = (now[m] || 0) + it[1]; }
  const trim = (it, to) => { cut.push({ id: it[0], from: it[1], to }); now[primary(lib, it[0])] -= it[1] - to; it[1] = to; };
  const kept = it => now[primary(lib, it[0])] / (base[primary(lib, it[0])] || 1);
  const SMALLM = ['Calves', 'Biceps', 'Triceps', 'Forearms', 'Core'];
  const rank = it => (isBig(lib, it[0]) ? 0 : liftClass(lib[it[0]]) === 'mid' ? 1 : 2) + (SMALLM.includes(primary(lib, it[0])) ? 3 : 0);
  // Per-session muscle cap: trim accessories of that muscle (never below 2 sets, never a main lift).
  for (const day of days) {
    for (const m of Object.keys(day.sets)) {
      let over = day.sets[m] - MUSCLE_CAP;
      for (const u of [...day.units].reverse()) for (const it of u.items) {
        while (over > 0 && !u.main && primary(lib, it[0]) === m && it[1] > 2) { trim(it, it[1] - 1); over--; day.sets[m]--; }
      }
    }
  }
  // Session length: never longer than the longest original session or `maxMinutes`, whichever is more.
  const limit = Math.max(maxMinutes, ...p.plan.map(d => minutesOf(lib, d.items)));
  const plan = days.map(day => {
    // Main lifts, then compound accessories, then isolation; supersets last.
    const urank = u => (u.grouped ? 10 : 0) + Math.min(...u.items.map(rank));
    const ordered = [...day.units.filter(u => u.main), ...day.units.filter(u => !u.main).sort((a, b) => urank(a) - urank(b) || a.order - b.order)];
    let items = () => ordered.flatMap(u => u.items);
    // Trim the largest accessory by a set at a time (not below 2) until the session fits.
    while (minutesOf(lib, items()) > limit) {
      // Fair cuts: the accessory whose muscle has kept the most of its weekly sets, then the biggest.
      const acc = ordered.filter(u => !u.main).flatMap(u => u.items).filter(it => it[1] > 2).sort((a, b) => kept(b) - kept(a) || b[1] - a[1])[0];
      if (!acc) break;
      trim(acc, acc[1] - 1);
    }
    // Supersets get fresh letters in order (A, B, …).
    let g = 0;
    const out = ordered.flatMap(u => (u.grouped ? (L => u.items.map(it => [...it, L]))(LETTERS[g++]) : u.items.map(it => [...it])));
    return { items: out, lower: day.lower, upper: day.upper, sets: day.sets };
  });
  // Names from what each session trains.
  const kind = d => (!d.upper && d.lower ? 'Lower' : !d.lower && d.upper ? 'Upper' : 'Full body');
  const kinds = plan.map(kind), seen = {};
  const named = plan.map((d, i) => {
    const k = kinds[i], same = kinds.filter(x => x === k).length;
    seen[k] = (seen[k] || 0) + 1;
    const top = Object.entries(d.sets).filter(([m]) => m !== 'Other').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m.toLowerCase());
    const focus = top.length ? top[0][0].toUpperCase() + top.join(', ').slice(1) : '';
    return { name: same > 1 ? `${k} ${LETTERS[seen[k] - 1]}` : k, focus, items: d.items };
  });
  // Merge cuts per exercise: one line per exercise from its original to final sets.
  const merged = Object.values(cut.reduce((a, c) => { a[c.id] = a[c.id] ? { ...a[c.id], to: c.to } : c; return a; }, {}));
  return { ...p, days: n, plan: named, adapted: { from: p.days, to: n, cut: merged } };
}

// ---------- Judging the right number of days from the training log ----------
const WEEK = 7 * 864e5;
// Monday-start week number (1 Jan 1970 was a Thursday, so Monday 5 Jan starts week 0).
// Local time, so a Monday-morning session in UTC+5 is not counted in the previous week.
export const weekOf = t => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4 - 4 * 864e5) / WEEK);

/**
 * Should the days a week change? Only on a clear, steady pattern:
 *  - complete weeks only (never the current one, never the first partial week of the program or of the
 *    last change), and at least `need` of them;
 *  - weeks with no sessions at all are treated as holiday or illness and skipped (up to `lookback` weeks);
 *  - every counted week below the plan → step down to the MOST they did in those weeks (never under 3);
 *    every counted week above the plan → step up to the LEAST they did (never over 5); anything mixed → no change.
 * @param log [{ day, at }] program sessions, one per training day
 * @param o { current, since (program start or last change), hold (no judging before), now }
 * @returns null or { days, counts, dir: 'down'|'up' }
 */
export function judgeDays(log, { current, since, hold = 0, now = Date.now(), need = 3, lookback = 6 } = {}) {
  if (!current || now < hold) return null;
  const thisWeek = weekOf(now), firstFull = weekOf(since) + 1, counts = {};
  for (const l of log || []) if (l.at >= since) { const w = weekOf(l.at); counts[w] = (counts[w] || 0) + 1; }
  const weeks = [];
  for (let w = thisWeek - 1; w >= firstFull && w >= thisWeek - lookback && weeks.length < need; w--) if (counts[w]) weeks.push(counts[w]);
  if (weeks.length < need) return null;
  if (weeks.every(c => c < current)) { const days = clampDays(Math.max(...weeks)); return days < current ? { days, counts: weeks.reverse(), dir: 'down' } : null; }
  if (weeks.every(c => c > current)) { const days = clampDays(Math.min(...weeks)); return days > current ? { days, counts: weeks.reverse(), dir: 'up' } : null; }
  return null;
}

/** Keep the weekdays someone chose and only add or remove days to reach `n` (Monday-first order). */
export function fitWeekdays(days, n) {
  const order = d => (d + 6) % 7, have = [...new Set(days || [])].sort((a, b) => order(a) - order(b)).slice(0, n);
  const spread = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] }[n] || [1, 2, 3, 4, 5, 6, 0];
  for (const d of [...spread, 1, 2, 3, 4, 5, 6, 0]) if (have.length < n && !have.includes(d)) have.push(d);
  return have.sort((a, b) => order(a) - order(b));
}

/** The weekdays (0 = Sunday) someone usually trains on, for reminders after a change. */
export function usualDays(log, n, { now = Date.now(), weeks = 6 } = {}) {
  const from = now - weeks * WEEK, tally = [0, 0, 0, 0, 0, 0, 0];
  for (const l of log || []) if (l.at >= from) tally[new Date(l.at).getDay()]++;
  const picked = [1, 2, 3, 4, 5, 6, 0].filter(d => tally[d]).sort((a, b) => tally[b] - tally[a]).slice(0, n);
  const spread = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] }[n] || [1, 3, 5];
  for (const d of spread) if (picked.length < n && !picked.includes(d)) picked.push(d);
  return picked.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}
