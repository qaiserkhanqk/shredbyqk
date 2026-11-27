// Personalisation: how QK bends a program around one person. Pure functions, unit tested.
// Every rule here is plain logic that runs on the phone: no AI model, no server, the same answer every time.
import { liftClass, e1rm } from './progression.js';
import { alternatives } from './refresh.js';
import { dayMinutes } from './warmup.js';

const DAY = 864e5, WEEK = 7 * DAY;
const primary = (lib, id) => lib[id]?.muscles?.[0] || 'Other';
const isBig = (lib, id) => (liftClass(lib[id]) || '').startsWith('big');
const isRehab = it => /^Rehab/.test(it[4] || '');
// Main lift: a heavy barbell lift, or the first real exercise of the day (rehab warm-ups don't count).
const isMain = (lib, items, i) => !isRehab(items[i]) && (isBig(lib, items[i][0]) || i === items.findIndex(x => !isRehab(x)));

// ---------- 1. Readiness: three taps before the session ----------
// Short wellness questions track training stress better than many objective markers
// (Saw et al. 2016, doi:10.1136/bjsports-2015-094758). QK uses them to lighten a bad day, never to push past the plan.
export const READY_Q = [
  { key: 'sleep', label: 'Sleep last night', opts: [['bad', 'Poor'], ['ok', 'OK'], ['good', 'Good']] },
  { key: 'sore', label: 'Muscle soreness', opts: [['very', 'Very sore'], ['some', 'A bit'], ['none', 'None']] },
  { key: 'energy', label: 'Energy today', opts: [['low', 'Low'], ['ok', 'OK'], ['high', 'High']] },
];
const PTS = { sleep: { bad: -2, ok: 0, good: 1 }, sore: { very: -2, some: -1, none: 1 }, energy: { low: -2, ok: 0, high: 1 } };
/**
 * @param a { sleep, sore, energy } @param o { restHr, baseHr } optional camera heart-rate readings (bpm)
 * @returns { level: 'rest'|'easy'|'normal'|'ready', score, load (multiplier), setDelta (accessories), note }
 */
export function readiness(a = {}, { restHr, baseHr } = {}) {
  let score = Object.keys(PTS).reduce((s, k) => s + (PTS[k][a[k]] ?? 0), 0);
  const hrHigh = restHr && baseHr && restHr - baseHr >= 7; // resting HR well above your usual
  if (hrHigh) score -= 1;
  const hr = hrHigh ? ` Your resting heart rate is ${restHr - baseHr} beats above your usual.` : '';
  if (score <= -4) return { level: 'rest', score, load: 0.9, setDelta: -1, note: `Rough day.${hr} QK made today lighter: 10% less weight and one set fewer on the extras. A recovery session is also an option.` };
  if (score <= -2) return { level: 'easy', score, load: 0.95, setDelta: -1, note: `Not your best day.${hr} QK took 5% off and one set off the extras. Main lifts stay.` };
  if (score >= 2) return { level: 'ready', score, load: 1, setDelta: 0, note: 'You feel great. Weights as planned: if the last reps fly, QK adds weight next time.' };
  return { level: 'normal', score, load: 1, setDelta: 0, note: 'Normal day. Weights as planned.' };
}
/** Today's items with the readiness adjustment: accessories lose sets (never below 2), main lifts keep theirs. */
export function readyItems(items, r, lib) {
  if (!r?.setDelta) return items;
  return items.map((it, i) => (isMain(lib, items, i) || it[1] <= 2 ? it : [it[0], Math.max(2, it[1] + r.setDelta), ...it.slice(2)]));
}

// ---------- 2. My gym: only exercises the client can actually do ----------
export const EQUIP = [
  { key: 'barbell', label: 'Barbell and rack', match: ['Barbell', 'EZ bar', 'Plate'] },
  { key: 'dumbbells', label: 'Dumbbells', match: ['Dumbbells', 'Dumbbell'] },
  { key: 'machines', label: 'Machines', match: ['Machine'] },
  { key: 'cable', label: 'Cable station', match: ['Cable'] },
  { key: 'kettlebell', label: 'Kettlebells', match: ['Kettlebell', 'Kettlebells'] },
  { key: 'bands', label: 'Resistance bands', match: ['Band'] },
  { key: 'pullup', label: 'Pull-up bar and dip bars', match: ['Pull-up bar', 'Dip bars'] },
  { key: 'bench', label: 'Bench and box', match: ['Bench', 'Box', 'Step', 'Hyperextension bench'] },
  { key: 'cardio', label: 'Cardio machines and sled', match: ['Treadmill', 'SkiErg', 'Rower', 'Sled'] },
];
const ALWAYS = ['Bodyweight', 'No equipment', 'None', 'Wall', 'Mat', 'Chair', 'Towel', 'Table', 'Other', 'Ab wheel', 'Dowel', 'Foam roller', 'Ball', 'Exercise ball', 'Medicine ball', 'Sandbag', 'Slant board'];
/** Can this exercise be done with this equipment? `have` = EQUIP keys; empty/undefined = a full gym. */
export function canDo(lib, id, have) {
  if (!have || !have.length) return true;
  const eq = lib[id]?.equipment; if (!eq || ALWAYS.includes(eq)) return true;
  return EQUIP.some(e => have.includes(e.key) && e.match.includes(eq));
}

// ---------- 3. Pain: work around it, add a little rehab ----------
// Not a diagnosis. Rules keep loaded movements away from the sore area and add gentle exercises a physio
// would commonly start with. Sharp pain, swelling, numbness or pain past two weeks: see a professional.
export const PAIN = {
  shoulder: { label: 'Shoulder', avoidPattern: ['press', 'dip'], avoidIds: ['uprightRow', 'arnoldPress', 'frontRaise', 'yPushPressBehindTheNeck', 'yOverheadSquat', 'xOneArmOverheadKettlebellSquat'], rehab: ['bandER', 'bandPullApart'] },
  knee: { label: 'Knee', avoidPattern: ['lunge'], avoidKinds: ['plyo'], avoidIds: ['legExtension', 'jumpSquat', 'xZercherSquat'], rehab: ['spanishSquat', 'terminalKneeExt'] },
  back: { label: 'Lower back', avoidPattern: [], avoidIds: ['deadlift', 'goodMorning', 'bentRow', 'xBarbellRearDeltRow', 'xLandmineRow', 'yCleanPull', 'backExt'], rehab: ['mcgillCurlUp', 'birdDog'] },
  elbow: { label: 'Elbow', avoidPattern: ['triExt'], avoidIds: ['closeGrip', 'chinUp', 'chestDip', 'benchDip', 'xSmithMachineCloseGripBenchPress'], rehab: ['eccWristExt', 'isoWristExt'] },
  wrist: { label: 'Wrist', avoidPattern: ['pushUp'], avoidIds: ['frontSquat', 'wristCurl', 'xBarbellFloorPress'], rehab: ['isoWristFlex', 'gripSqueeze'] },
  hip: { label: 'Hip', avoidPattern: ['lunge'], avoidIds: ['xWideStanceBarbellSquat', 'xPliDumbbellSquat', 'bulgarian'], rehab: ['clamshell', 'sideLyingAbd'] },
};
export function hurts(lib, id, areas = []) {
  const x = lib[id]; if (!x) return false;
  return areas.some(a => { const r = PAIN[a]; return r && (r.avoidIds.includes(id) || r.avoidPattern.includes(x.pattern) || (r.avoidKinds || []).includes(x.kind)); });
}

/**
 * A program day made personal: exercises the client can't do (equipment), shouldn't do (pain) or keeps
 * skipping are swapped for the closest alternative; pain areas get two rehab moves first.
 * @returns { items, swaps: [{ from, to, why }] }
 */
export function personalDay(items, lib, { have, pain = [], avoid = [] } = {}) {
  const swaps = [], used = new Set(items.map(it => it[0]));
  const ok = id => canDo(lib, id, have) && !hurts(lib, id, pain) && !avoid.includes(id);
  const out = items.map(it => {
    if (ok(it[0])) return it;
    const why = !canDo(lib, it[0], have) ? 'equipment' : hurts(lib, it[0], pain) ? 'pain' : 'skipped';
    const exclude = [...used];
    let to = alternatives(it[0], lib, { avoid, exclude, n: 20 }).find(ok);
    if (!to) {
      // Wider search: same main muscle, same kind of training, anything doable.
      const me = lib[it[0]];
      to = Object.values(lib).find(x => !x.rehab && x.id !== it[0] && !used.has(x.id) && (x.kind || 'gym') === (me.kind || 'gym') && x.muscles?.[0] === me.muscles?.[0] && ok(x.id))?.id;
    }
    if (!to) return it; // nothing suitable: keep it, the client can still swap by hand
    swaps.push({ from: it[0], to, why }); used.add(to);
    return [to, ...it.slice(1)];
  });
  const rehab = [...new Set(pain.flatMap(a => PAIN[a]?.rehab || []))].filter(id => lib[id] && !used.has(id)).map(id => [id, 2, lib[id].hold || /iso|Iso/.test(id) ? '30s' : '12', 45, 'Rehab: easy, pain-free range']);
  return { items: [...rehab, ...out], swaps };
}

// ---------- 4. Likes and skips ----------
/** Exercises skipped twice in four weeks drop out of future months. */
export function skipDrops(skips = {}, { now = Date.now() } = {}) {
  return Object.entries(skips).filter(([, ts]) => ts.filter(t => now - t < 4 * WEEK).length >= 2).map(([id]) => id);
}
/** Favourites: exercises done on 4+ days in the last 8 weeks with every set completed. Kept in new months. */
export function favourites(sessions = [], { now = Date.now() } = {}) {
  const days = {};
  for (const s of sessions) if (!s.demo && now - s.at < 8 * WEEK && (s.reps > 0 || s.secs)) (days[s.ex] ||= new Set()).add(new Date(s.at).toDateString());
  return Object.entries(days).filter(([, d]) => d.size >= 4).map(([id]) => id);
}

// ---------- 5. Where to start: age and experience ----------
/** New lifters and those 50+ start month 1 with one set fewer on the extras, and get a light week every 5 weeks. */
export const cautious = (p = {}) => p.experience === 'new' || (p.age || 0) >= 50;
export const lightEvery = (p = {}) => ((p.age || 0) >= 50 ? 5 : 7);
export function startItems(items, lib, profile, block = 1) {
  if (block > 1 || !cautious(profile)) return items;
  return items.map((it, i) => (isMain(lib, items, i) || it[1] <= 2 ? it : [it[0], it[1] - 1, ...it.slice(2)]));
}

// ---------- 6. Weak points: from the client's own numbers and form ----------
const FAULT_FIX = {
  sq_shift: { muscle: 'Quads', pick: ['bulgarian', 'xDumbbellSplitSquat', 'stepDown'], why: 'You shift to one side in the squat. Single-leg work evens the legs out.' },
  lu_torso: { muscle: 'Core', pick: ['deadBug', 'plank', 'birdDog'], why: 'Your torso tips forward in lunges. Extra core work helps you stay tall.' },
  pl_sag: { muscle: 'Core', pick: ['deadBug', 'abWheel', 'birdDog'], why: 'Your hips sag in the plank. More core work helps you hold a straight line.' },
  pu_sag: { muscle: 'Core', pick: ['plank', 'deadBug', 'birdDog'], why: 'Your hips sag in push-ups. More core work helps you hold a straight line.' },
};
/**
 * Up to two weak points, each with one exercise to add:
 *  - a form fault seen in 3+ sets in the last 4 weeks (with a known fix);
 *  - a lift whose estimated 1RM hasn't moved in 6 weeks while the others went up 3%+.
 * @returns [{ id (exercise to add), muscle, why }]
 */
export function weakPoints(sessions = [], lib, { now = Date.now(), plan = [], have, pain = [], avoid = [] } = {}) {
  const inPlan = new Set(plan.flatMap(d => d.items.map(it => it[0]))), out = [];
  const usable = id => lib[id] && !inPlan.has(id) && canDo(lib, id, have) && !hurts(lib, id, pain) && !avoid.includes(id) && !out.some(o => o.id === id);
  const recent = sessions.filter(s => !s.demo && now - s.at < 4 * WEEK);
  const tally = {};
  for (const s of recent) for (const [f, n] of Object.entries(s.faults || {})) if (n > 0) tally[f] = (tally[f] || 0) + 1;
  for (const [f, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    const fix = FAULT_FIX[f]; if (!fix || n < 3) continue;
    const id = fix.pick.find(usable); if (id) out.push({ id, muscle: fix.muscle, why: fix.why });
    if (out.length >= 2) return out;
  }
  // Strength: best e1RM in the first vs the last three weeks of a six-week window.
  const gains = {};
  for (const s of sessions) {
    if (s.demo || !s.kg || now - s.at > 6 * WEEK) continue;
    const v = e1rm(s.kg, s.reps); if (!v) continue;
    const g = (gains[s.ex] ||= { early: 0, late: 0 }), late = now - s.at < 3 * WEEK;
    if (late) g.late = Math.max(g.late, v); else g.early = Math.max(g.early, v);
  }
  const ch = Object.entries(gains).filter(([, g]) => g.early && g.late).map(([id, g]) => ({ id, pct: (g.late - g.early) / g.early * 100 }));
  if (ch.length >= 3) {
    for (const lag of ch.filter(c => c.pct <= 0)) {
      const others = ch.filter(c => c.id !== lag.id).map(c => c.pct).sort((a, b) => a - b), med = others[Math.floor(others.length / 2)];
      if (med < 3) continue;
      const m = primary(lib, lag.id);
      const pick = Object.values(lib).filter(x => !x.rehab && (x.kind || 'gym') === 'gym' && x.muscles?.[0] === m && ['mid', 'small'].includes(liftClass(x))).map(x => x.id).sort().find(usable);
      if (pick) out.push({ id: pick, muscle: m, why: `${lib[lag.id].name} hasn't gone up in 6 weeks while your other lifts did. Extra ${m.toLowerCase()} work to catch it up.` });
      if (out.length >= 2) break;
    }
  }
  return out;
}
/** Add weak-point exercises (3 × 8-12) to the sessions with the fewest sets. */
export function addWeak(plan, weak) {
  const out = plan.map(d => ({ ...d, items: d.items.map(it => it.slice()) }));
  for (const w of weak) {
    const day = out.reduce((a, d) => (d.items.reduce((s, it) => s + it[1], 0) < a.items.reduce((s, it) => s + it[1], 0) ? d : a));
    day.items.push([w.id, 3, '8-12', 75, `Weak point: ${w.muscle.toLowerCase()}`]);
  }
  return out;
}

// ---------- 7. Missed sessions ----------
const mon = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
/**
 * Behind this week? Planned sessions = `perWeek`; done = log entries this week (merged ones count twice);
 * training days left = planned weekdays from today on (today included if not trained yet).
 * @returns null or { behind, missedDays: [weekday], left }
 */
export function behind(log = [], { perWeek, weekdays = [], now = Date.now(), since = 0 } = {}) {
  if (!perWeek || !weekdays.length) return null;
  const start = mon(now), today = new Date(now).getDay(), ord = d => (d + 6) % 7;
  // Only planned days on or after the program start (or the last days change) can be missed.
  const sinceDay = new Date(since); sinceDay.setHours(0, 0, 0, 0);
  weekdays = weekdays.filter(d => start + ord(d) * DAY >= sinceDay.getTime());
  if (!weekdays.length) return null;
  const week = log.filter(l => l.at >= start && l.at <= now);
  const done = week.reduce((a, l) => a + (l.merged != null ? 2 : 1), 0);
  const doneToday = week.some(l => new Date(l.at).toDateString() === new Date(now).toDateString());
  const left = weekdays.filter(d => ord(d) > ord(today) || (d === today && !doneToday)).length;
  const missedDays = weekdays.filter(d => ord(d) < ord(today) && !week.some(l => new Date(l.at).getDay() === d));
  const need = Math.min(perWeek, weekdays.length) - done;
  return need > left && left > 0 && missedDays.length ? { behind: need - left, missedDays, left } : null;
}
/**
 * Today's session plus the main lifts of the next one, so a missed day isn't lost.
 * Extra lifts come in one set lighter (never below 2); the session stays under `maxMinutes`.
 * @returns { items, added: [id] }
 */
export function rescue(today, next, lib, { maxMinutes = 80 } = {}) {
  const have = new Set(today.map(it => it[0])), items = today.map(it => it.slice()), added = [];
  const warm = its => its.reduce((a, it) => a + (isBig(lib, it[0]) ? 3 : 0), 0);
  for (let i = 0; i < next.length; i++) {
    const it = next[i];
    if (isRehab(it) || !isMain(lib, next, i) || have.has(it[0])) continue;
    const cand = [it[0], Math.max(2, it[1] - 1), ...it.slice(2, 5)];
    // Insert after today's rehab warm-ups and main lifts, before its accessories.
    const at = items.findIndex((x, k) => !isRehab(x) && !isMain(lib, items, k));
    const tryItems = at < 0 ? [...items, cand] : [...items.slice(0, at), cand, ...items.slice(at)];
    if (dayMinutes(tryItems, warm(tryItems)) > maxMinutes) continue;
    items.splice(0, items.length, ...tryItems); added.push(it[0]); have.add(it[0]);
  }
  // Still too long? Trim today's accessories a set at a time (never below 2).
  for (let k = items.length - 1; dayMinutes(items, warm(items)) > maxMinutes && k >= 0; k--) {
    if (!isMain(lib, items, k) && items[k][1] > 2) { items[k] = [items[k][0], items[k][1] - 1, ...items[k].slice(2)]; k++; }
  }
  return { items, added };
}

// ---------- 8. Time per day ----------
/** Minutes allowed today: a one-off cap first, else the client's budget for this weekday. */
export const minutesFor = (budget = {}, cap = null, now = Date.now()) => cap || budget[new Date(now).getDay()] || null;
