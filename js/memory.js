// QK remembers: follow-ups on what the client told QK or did, the way a good coach would ask
// "How's the knee?" a few days later. Pure function over the saved state, unit tested.
// One follow-up at a time, each shown (and said) once; answering or dismissing it marks it done.
import { e1rm } from './progression.js';

const DAY = 864e5, WEEK = 7 * DAY;
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtDay = t => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const AREA = { shoulder: 'shoulder', knee: 'knee', back: 'lower back', elbow: 'elbow', wrist: 'wrist', hip: 'hip' };

/**
 * @param S saved state; @param o { now, lib }
 * @returns [{ id, kind, title, text, say, actions: [{ label, act }] }] most important first
 */
export function followUps(S, { now = Date.now(), lib = {} } = {}) {
  const done = S.memory?.done || {}, out = [], add = f => { if (!done[f.id]) out.push(f); };
  const name = S.profile?.name ? `, ${S.profile.name}` : '';
  const p = S.profile || {};

  // 1. Pain: first check after 3 days, then every 7 days.
  for (const a of p.pain || []) {
    const since = p.painSince?.[a], asked = p.painAsked?.[a] || 0, n = p.painAskCount?.[a] || 0;
    if (!since) continue;
    const due = n === 0 ? now - since >= 3 * DAY : now - asked >= WEEK;
    if (!due) continue;
    const label = AREA[a] || a, same = p.painSame?.[a] || 0;
    add({ id: `pain:${a}:${n}`, kind: 'pain', area: a, title: `How's your ${label}${name}?`,
      text: `You told me it hurt on ${fmtDay(since)}. I've kept the moves that load it out of your workouts since.${same >= 1 ? ' If it still isn\'t improving, please see a physio.' : ''}`,
      say: `Hi${name}. How's your ${label} today?`,
      actions: [{ label: 'Better', act: `pain:${a}:better` }, { label: 'Same', act: `pain:${a}:same` }, { label: 'Worse', act: `pain:${a}:worse` }] });
  }
  // 2. A rough day yesterday (pre-workout check-in or the morning card).
  const y = dayStart(now) - DAY;
  const roughY = (S.checkinLog || []).some(c => dayStart(c.at) === y && ['rest', 'easy'].includes(c.level))
    || (S.readiness || []).some(c => dayStart(c.at) === y && /rough/.test(c.feel || ''));
  if (roughY) add({ id: `rough:${y}`, kind: 'rough', title: `Feeling better today${name}?`, text: 'Yesterday you were running on empty. Tell me how today feels and I\'ll set the weights to match.',
    say: `Yesterday you were wiped out. Feeling better today?`, actions: [{ label: 'Much better', act: 'rough:better' }, { label: 'Still tired', act: 'rough:tired' }] });
  // 3. A personal best in the last 7 days, celebrated once.
  const best = {}; let pr = null;
  for (const s of [...(S.sessions || [])].filter(s => !s.demo && s.kg && s.reps).sort((a, b) => a.at - b.at)) {
    const v = e1rm(s.kg, s.reps); if (!v) continue;
    if (best[s.ex] && v > best[s.ex] * 1.005 && now - s.at < WEEK && dayStart(s.at) < dayStart(now)) pr = s;
    best[s.ex] = Math.max(best[s.ex] || 0, v);
  }
  if (pr) add({ id: `pr:${pr.ex}:${pr.at}`, kind: 'pr', title: 'New best last time', text: `${lib[pr.ex]?.name || pr.ex}: ${pr.kg} kg × ${pr.reps} on ${fmtDay(pr.at)}, your strongest yet. Today's plan builds on it.`,
    say: `Last time you set a new best on ${lib[pr.ex]?.name || 'that lift'}. Let's build on it.`, actions: [{ label: 'Let\'s go', act: 'ok' }] });
  // 4. An exercise skipped once in the last 2 weeks (twice already swaps it out by itself).
  const skips = Object.entries(S.prefs?.skips || {}).map(([id, ts]) => [id, ts.filter(t => now - t < 2 * WEEK)]).filter(([id, ts]) => ts.length === 1 && !(S.prefs?.avoid || []).includes(id));
  if (skips.length) { const [id, [t]] = skips[0]; add({ id: `skip:${id}:${t}`, kind: 'skip', ex: id, title: `Not a fan of ${lib[id]?.name || id}?`, text: `You skipped it on ${fmtDay(t)}. I can swap it for something similar from now on, or keep it in.`,
    say: `You skipped ${lib[id]?.name || 'an exercise'} last time. Want me to swap it for good?`, actions: [{ label: 'Swap it', act: `skip:${id}:swap` }, { label: 'Keep it', act: 'ok' }] }); }
  // 5. A whole week missed (trained before, nothing last week, on a program).
  const lastWeek = dayStart(now) - ((new Date(now).getDay() + 6) % 7) * DAY - WEEK;
  const real = (S.sessions || []).filter(s => !s.demo);
  if (S.program && real.some(s => s.at < lastWeek) && !real.some(s => s.at >= lastWeek && s.at < lastWeek + WEEK) && !real.some(s => s.at >= lastWeek + WEEK))
    add({ id: `missed:${lastWeek}`, kind: 'missed', title: `We missed you last week${name}`, text: 'No guilt, life happens. Today is a fresh start: your plan is ready, so just press Start.',
      say: 'We missed you last week. No guilt. Today is a fresh start.', actions: [{ label: 'I\'m back', act: 'ok' }] });
  // 6. Travel just ended; Ramadan just ended.
  if (p.travel && now >= p.travel.until && now - p.travel.until < 4 * DAY) add({ id: `travel:${p.travel.until}`, kind: 'travel', title: 'Welcome back from your trip', text: 'Your own gym is back in the plan from today.', say: 'Welcome back from your trip. Your own gym is back in the plan.', actions: [{ label: 'Thanks', act: 'ok' }] });
  if (p.ramadan && now >= p.ramadan.until && now - p.ramadan.until < 6 * DAY) add({ id: `ramadan:${p.ramadan.until}`, kind: 'ramadan', title: 'Eid Mubarak!', text: 'Ramadan mode is off: full sessions and full volume are back from today.', say: 'Eid Mubarak! Full sessions are back from today.', actions: [{ label: 'Khair Mubarak', act: 'ok' }] });
  // 7. A month with QK.
  const first = Math.min(...real.map(s => s.at));
  if (real.length && now - first >= 30 * DAY && now - first < 45 * DAY) {
    const days = new Set(real.map(s => dayStart(s.at))).size, clean = real.reduce((a, s) => a + (s.good || 0), 0);
    add({ id: 'month1', kind: 'milestone', title: 'One month with QK', text: `${days} training days and ${clean} clean reps since ${fmtDay(first)}. Proud of you.`, say: `One month together. ${days} training days. Proud of you.`, actions: [{ label: 'Thanks, QK', act: 'ok' }] });
  }
  const order = ['pain', 'rough', 'missed', 'ramadan', 'travel', 'pr', 'skip', 'milestone'];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** "How was it?" after a workout. Two "too hard" in a row → one set fewer on the extras; two "too easy" → one more. */
export function sessionFeel(feels = [], { now = Date.now() } = {}) {
  const recent = feels.filter(f => now - f.at < 3 * WEEK).slice(-2);
  if (recent.length === 2 && recent.every(f => f.rating === 'hard')) return { load: 1, setDelta: -1, note: 'Your last two workouts felt too hard, so QK trimmed a set from the extras.' };
  if (recent.length === 2 && recent.every(f => f.rating === 'easy')) return { load: 1, setDelta: 1, note: 'Your last two workouts felt too easy, so QK added a set to the extras.' };
  return null;
}

/** Areas cleared in the last 14 days: those exercises come back at 80% for two weeks. */
export const returningAreas = (p = {}, now = Date.now()) => Object.entries(p.painCleared || {}).filter(([, t]) => now - t < 14 * DAY).map(([a]) => a);
