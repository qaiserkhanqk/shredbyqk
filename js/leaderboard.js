// Weekly health score for the leaderboard (0–100). Fair across ages and fitness levels: Fitness Age is scored
// against your own age, recovery against your own baseline, and most points come from showing up and logging.
// Pure, unit tested. How it's scored: SCIENCE.md "Leaderboard".
const DAY = 864e5;
const dayKey = t => new Date(t).toDateString();

/** Monday 00:00 (local) of the week containing t, and its YYYY-MM-DD key. */
export function weekStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
export const weekKey = t => { const d = new Date(weekStart(t)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const MAX = { train: 35, fitness: 20, recovery: 15, sleep: 15, mind: 15 };

/** Planned training days a week: the plan, else the program, else 4. */
const target = S => Math.max(2, Math.min(6, S.plan?.days?.length || S.program?.days || 4));

/**
 * Score for the week starting at ws (default this week). Returns { score, parts, tips }.
 * - train (35): training days (logged sets or classes) ÷ planned days, capped at 1.
 * - fitness (20): latest Fitness Age vs real age, 10 years younger = 20, 10 years older = 0. Retest monthly to keep it.
 * - recovery (15), sleep (15), mind (15): the morning check (Hooper 1–7 scale: 1 best) scored for quality, times how
 *   many days you checked in (5 days = full). Calm sessions add to mind.
 */
export function weekScore(S, ws = weekStart(), now = Date.now()) {
  const we = ws + 7 * DAY, inWeek = t => t >= ws && t < Math.min(we, now + 1);
  const trainDays = new Set([...(S.sessions || []).filter(s => !s.demo && inWeek(s.at)), ...(S.classes || []).filter(c => inWeek(c.at))].map(s => dayKey(s.at))).size;
  const parts = { train: Math.round(MAX.train * Math.min(1, trainDays / target(S))) };

  const fa = (S.fitage || []).filter(t => t.at < we).slice(-1)[0];
  const faFresh = fa && we - fa.at < 45 * DAY;
  parts.fitness = faFresh ? Math.round(Math.max(0, Math.min(MAX.fitness, 10 - (fa.fitnessAge - fa.age)))) : 0;

  const checks = new Map();
  for (const r of S.readiness || []) if (inWeek(r.at)) checks.set(dayKey(r.at), r);
  const days = [...checks.values()], cover = Math.min(1, days.length / 5);
  const q = (key, alt) => days.length ? days.reduce((a, r) => a + (7 - (r[key] ?? r[alt] ?? 4)) / 6, 0) / days.length : 0;
  parts.recovery = Math.round(MAX.recovery * cover * q('fatigue', 'soreness'));
  parts.sleep = Math.round(MAX.sleep * cover * q('sleepQ'));
  const calm = (S.calm || []).filter(c => inWeek(c.at)).length;
  parts.mind = Math.round(Math.min(MAX.mind, MAX.mind * cover * q('stress') + calm * 2));

  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const tips = [];
  if (parts.train < MAX.train) tips.push({ part: 'train', text: `Train ${target(S) - Math.min(target(S), trainDays)} more day${target(S) - trainDays === 1 ? '' : 's'} this week`, pts: MAX.train - parts.train });
  if (!faFresh) tips.push({ part: 'fitness', text: fa ? 'Retest your Fitness Age (it is over a month old)' : 'Find your Fitness Age', pts: 10 });
  if (days.length < 5) tips.push({ part: 'check', text: `Do the 10-second morning check on ${5 - days.length} more day${5 - days.length === 1 ? '' : 's'}`, pts: Math.round((MAX.recovery + MAX.sleep + MAX.mind) * (1 - cover) * 0.7) });
  if (!calm) tips.push({ part: 'mind', text: 'One calm session (2 bonus points each)', pts: 2 });
  return { score, parts, tips: tips.filter(t => t.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 3), trainDays, checkDays: days.length };
}

/** What shows on the board: their nickname, or first name + last initial. Never the full name or email. */
export function displayName(p = {}) {
  const nick = (p.nickname || '').trim();
  if (nick) return nick.slice(0, 24);
  const [f, l] = (p.name || '').trim().split(/\s+/);
  return f ? `${f}${l && /^\p{L}/u.test(l) ? ' ' + l[0].toUpperCase() + '.' : ''}` : 'Shredder';
}

/** Rank among rows [{ score, me }], ties share a rank (1, 2, 2, 4). */
export function ranked(rows = []) {
  const s = [...rows].sort((a, b) => b.score - a.score);
  let rank = 0;
  return s.map((r, i) => { if (i === 0 || s[i - 1].score !== r.score) rank = i + 1; return { ...r, rank }; });
}

/** The Mondays of a month (weeks that start in it), up to and including the week asOf ('YYYY-MM-DD'). */
export function weeksOfMonth(month /* 'YYYY-MM' */, asOf) {
  const [y, m] = month.split('-').map(Number), out = [];
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    const k = weekKey(d.getTime());
    if (d.getDay() === 1 && (!asOf || k <= asOf)) out.push(k);
  }
  return out;
}
/**
 * Month standings, fair to people who joined mid-month: average points per week over the month's weeks so far,
 * counted from their first week on the board (weeks skipped after that count as 0). Same rule as leaderboard()
 * on the server. rows: [{ client_id, week, score }] (their history, including earlier months); asOf: this week's key.
 */
export function monthTotals(rows = [], month, { asOf } = {}) {
  const weeks = weeksOfMonth(month, asOf), sum = new Map(), first = new Map();
  for (const r of rows) { const w = String(r.week).slice(0, 10); if (!first.has(r.client_id) || w < first.get(r.client_id)) first.set(r.client_id, w); }
  for (const r of rows) if (weeks.includes(String(r.week).slice(0, 10))) sum.set(r.client_id, (sum.get(r.client_id) || 0) + r.score);
  return ranked([...sum].map(([client_id, total]) => {
    const n = Math.max(1, weeks.filter(w => w >= first.get(client_id)).length);
    return { client_id, score: Math.round(total / n), total };
  }));
}

/** The line under your score: how far the next place is, or how far ahead you are. rows from the board, ranked. */
export function gapLine(rows = [], { unit = 'points', perDay = 9 } = {}) {
  const me = rows.find(r => r.me); if (!me) return null;
  const above = rows.filter(r => r.rank < me.rank).sort((a, b) => b.rank - a.rank)[0];
  if (!above) {
    const next = rows.filter(r => r.rank > me.rank).sort((a, b) => a.rank - b.rank)[0];
    return next ? `You're #1. ${next.name} is ${me.score - next.score} ${unit} behind you. Keep it.` : "You're #1. Keep it.";
  }
  const gap = above.score - me.score + 1, days = Math.max(1, Math.ceil(gap / perDay));
  return `${gap} ${unit} to pass #${above.rank}. ${days === 1 ? 'One training day' : `${days} training days`} gets you there.`;
}
/** Points one training day is worth this week (training is 35 points over the planned days). */
export const pointsPerDay = S => Math.round(MAX.train / target(S));
