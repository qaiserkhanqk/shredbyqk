// Small pure helpers for logging weights and the weekly message to QK. No browser APIs, so they're unit tested.

// Equipment where a weight is worth logging (bodyweight, bands and props are left out).
export const WEIGHTED = ['Barbell', 'Dumbbells', 'Dumbbell', 'Machine', 'Cable', 'EZ bar', 'Kettlebell', 'Plate'];

// The most recent set of this exercise that had a weight logged.
export function lastLoad(sessions, ex) {
  for (let i = sessions.length - 1; i >= 0; i--) { const s = sessions[i]; if (s.ex === ex && s.kg > 0) return { kg: s.kg, reps: s.reps, at: s.at }; }
  return null;
}
export const lastLoadText = l => l ? `Last time: ${+l.kg} kg × ${l.reps}` : '';

const DAY = 864e5;
const scoreOf = list => { list = list.filter(s => !s.guided && !s.edited && !s.demo); const r = list.reduce((a, s) => a + s.reps, 0); return r ? Math.round(list.reduce((a, s) => a + s.good, 0) / r * 100) : null; };

// Plain-text summary of the last 7 days, to send to the coach. Text only: no video, no body points.
export function weekSummary(S, { now = Date.now(), faultName = id => id, light = null } = {}) {
  const from = now - 7 * DAY, prevFrom = from - 7 * DAY;
  const sets = (S.sessions || []).filter(s => s.at >= from && !s.demo), prevSets = (S.sessions || []).filter(s => s.at >= prevFrom && s.at < from && !s.demo);
  const days = new Set([...sets, ...(S.checkins || []).filter(c => c.at >= from)].map(s => new Date(s.at).toDateString())).size;
  const goal = S.profile?.weeklyGoal || 4;
  const score = scoreOf(sets), prev = scoreOf(prevSets);
  const tally = {};
  for (const s of sets) for (const [id, n] of Object.entries(s.faults || {})) tally[id] = (tally[id] || 0) + n;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const prs = [];
  for (const ex of new Set(sets.filter(s => s.kg > 0).map(s => s.ex))) {
    const best = Math.max(...sets.filter(s => s.ex === ex && s.kg > 0).map(s => s.kg));
    const before = (S.sessions || []).filter(s => s.ex === ex && s.kg > 0 && s.at < from);
    if (before.length && best > Math.max(...before.map(s => s.kg))) prs.push(`${sets.find(s => s.ex === ex).name} ${best} kg`);
  }
  const ready = (S.readiness || []).filter(c => c.at >= from).length;
  const calm = (S.calm || []).filter(c => c.at >= from);
  const lines = [
    `Shred weekly update${S.profile?.name ? ' from ' + S.profile.name : ''}`,
    `Trained ${days} of ${goal} planned days · ${sets.length} set${sets.length === 1 ? '' : 's'}`,
    score != null ? `Form score ${score}%${prev != null ? ` (last week ${prev}%)` : ''}` : null,
    top ? `Most common fault: ${faultName(top[0])} (${top[1]}×)` : null,
    prs.length ? `New best weights: ${prs.join(', ')}` : null,
    ready ? `Readiness check-ins: ${ready}` : null,
    light ? `Rehab pain light: ${light}` : null,
    calm.length ? `Sukoon sessions: ${calm.length}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}
