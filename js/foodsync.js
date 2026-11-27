// Food for the coach dashboard: one row per day (totals plus what was eaten) and the weekly report's
// summary on the profile. Sent through the same Supabase sync and privacy rules as training: a client
// sees only their own rows, a coach only their clients'. Photos are never sent.
import { dayKey, weekReport } from './weekly.js';

const r = v => Math.round(v || 0);

/** The last `days` days of food as server rows (re-sent each sync, so edits and deletions catch up). */
export function foodDayRows(uid, S, now = Date.now(), days = 8) {
  const f = S.food; if (!f?.log?.length && !Object.keys(f?.water || {}).length) return [];
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(now - i * 864e5), items = f.log.filter(e => dayKey(e.at) === k);
    const water = f.water?.[k] || 0, steps = f.steps?.[k] || null;
    if (!items.length && !water && !steps) continue;
    const sum = key => items.reduce((a, e) => a + (e[key] || 0), 0);
    out.push({ client_id: uid, at: k, kcal: r(sum('kcal')), protein: r(sum('protein')), carbs: r(sum('carbs')), fat: r(sum('fat')), water, steps,
      items: items.map(e => ({ meal: e.meal, name: e.name, label: e.label, kcal: r(e.kcal), src: e.source })) });
  }
  return out;
}

/** QK's weekly report, shortened for the coach: averages, wins and what QK suggested. */
export function foodWeekSummary(S, now = Date.now()) {
  const f = S.food; if (!f?.log?.length) return null;
  const weights = [...(f.weights || []), ...(S.scans || []).filter(s => s.weight).map(s => ({ at: s.at, kg: +s.weight }))];
  const rep = weekReport({ log: f.log, water: f.water, steps: f.steps, weights, sessions: S.sessions || [], profile: S.profile || {}, rehab: !!S.rehab?.active, now });
  return {
    at: new Date(now).toISOString(), logged: rep.logged, enough: rep.enough,
    kcal: r(rep.avg.kcal), protein: r(rep.avg.protein), vegFruit: r(rep.avg.vegFruit), water: rep.water.avg == null ? null : Math.round(rep.water.avg * 10) / 10, steps: rep.steps,
    target: rep.target ? { kcal: rep.target.kcal, protein: rep.target.protein } : null,
    weightPerWeek: rep.trend ? Math.round(rep.trend.perWeek * 100) / 100 : null, maintenance: rep.maintenance || null,
    wins: rep.wins, focus: rep.focus.map(x => x.title), outShare: Math.round((rep.avg.outShare || 0) * 100),
    checkin: f.adapt?.history?.length ? { last: f.adapt.history[f.adapt.history.length - 1], kcalAdjust: +(S.profile?.kcalAdjust || 0), stepGoal: f.adapt.stepGoal || null } : null,
    plan: f.plan ? { at: new Date(f.plan.at).toISOString(), kcal: r(f.plan.day.kcal), protein: r(f.plan.day.protein), meals: f.plan.meals.length, diet: f.plan.answers?.diet || 'all' } : null,
  };
}

/** Places a client added, so QK can review them and share good ones with everyone. */
export const placeRows = (uid, S) => [
  ...(S.food?.places || []).map(p => ({ client_id: uid, name: p.name, items: p.items })),
  // Calories clients read off menus, grouped by place, for QK to review and share with everyone.
  ...Object.entries(Object.values(S.food?.menuKcal || {}).reduce((g, m) => ((g[m.place] ||= []).push({ name: m.item, dish: m.dish, menuKcal: m.kcal, at: m.at }), g), {}))
    .map(([place, items]) => ({ client_id: uid, name: `${place} · menu calories`, items })),
];

/** Dashboard view of one client's food: from their day rows and weekly summary. */
export function foodCard(week, rows = [], now = Date.now()) {
  const keys = new Set(Array.from({ length: 7 }, (_, i) => dayKey(now - i * 864e5)));
  const recent = rows.filter(x => keys.has(typeof x.at === 'string' ? x.at.slice(0, 10) : dayKey(x.at)) && x.kcal > 0);
  if (!week && !recent.length) return null;
  const last = [...rows].sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
  return {
    daysLogged: recent.length, avgKcal: recent.length ? r(recent.reduce((a, x) => a + x.kcal, 0) / recent.length) : null,
    avgProtein: recent.length ? r(recent.reduce((a, x) => a + x.protein, 0) / recent.length) : null,
    target: week?.target || null, focus: week?.focus || [], wins: week?.wins || [], weightPerWeek: week?.weightPerWeek ?? null,
    maintenance: week?.maintenance ?? null, lastDay: last, plan: week?.plan || null, checkin: week?.checkin || null,
  };
}
