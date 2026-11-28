// Squad analytics for the coaching staff: every athlete's 3D Lab tests over time, squad comparisons and outliers.
// Pure, unit tested (tests/squad.test.mjs). Tests are { athlete_id, at, preset, cameras, summary } where
// summary = lab3d.summary(): { preset, key, rows: [{ k, min, max, at }], flags }.
import { METRICS, PRESETS } from './lab3d.js';

const ms = t => (typeof t === 'number' ? t : Date.parse(t));
/** The value used to compare: at the key moment (deepest point, release) when there is one, else the max. */
export const valueOf = (summary, k) => { const r = summary?.rows?.find(x => x.k === k); return r ? (r.at ?? r.max) : null; };
/** Movement name → preset key (summaries store the display name). */
export const presetKey = name => Object.keys(PRESETS).find(k => PRESETS[k].name === name || k === name) || 'other';

/** Roster rows: athlete + tests count, last test, flags on the latest test. */
export function roster(athletes = [], tests = []) {
  return athletes.map(a => {
    const T = tests.filter(t => t.athlete_id === a.id).sort((x, y) => ms(x.at) - ms(y.at)), last = T[T.length - 1];
    return { ...a, tests: T.length, last: last ? ms(last.at) : null, lastPreset: last?.summary?.preset || null, flags: last?.summary?.flags?.length || 0 };
  }).sort((x, y) => (y.flags - x.flags) || ((y.last || 0) - (x.last || 0)));
}

/** One athlete's values over time for a movement and measurement: [{ at, v }]. */
export function series(tests, athleteId, preset, k) {
  return tests.filter(t => t.athlete_id === athleteId && presetKey(t.summary?.preset || t.preset) === preset)
    .map(t => ({ at: ms(t.at), v: valueOf(t.summary, k) })).filter(p => Number.isFinite(p.v)).sort((a, b) => a.at - b.at);
}

/**
 * Squad comparison for a movement and measurement: each athlete's latest value, the squad mean and SD, and
 * who sits more than 1.5 SD from the squad (worth a closer look, not a verdict).
 */
export function compare(athletes, tests, preset, k) {
  const rows = athletes.map(a => { const s = series(tests, a.id, preset, k); return s.length ? { id: a.id, name: a.name, team: a.team, v: s[s.length - 1].v, n: s.length, change: s.length >= 2 ? s[s.length - 1].v - s[0].v : null } : null; }).filter(Boolean);
  if (!rows.length) return { rows: [], mean: null, sd: null };
  const mean = rows.reduce((a, r) => a + r.v, 0) / rows.length, sd = rows.length > 1 ? Math.sqrt(rows.reduce((a, r) => a + (r.v - mean) ** 2, 0) / (rows.length - 1)) : 0;
  return { mean, sd, rows: rows.map(r => ({ ...r, z: sd ? (r.v - mean) / sd : 0, outlier: sd > 0 && Math.abs(r.v - mean) > 1.5 * sd && rows.length >= 4 })).sort((a, b) => b.v - a.v) };
}

/** Measurements available for a movement. */
export const metricsFor = preset => (PRESETS[preset] || PRESETS.other).keys.map(k => ({ k, name: METRICS[k] }));

/** Squad CSV: one row per test, every measurement of that movement. */
export function squadCSV(athletes, tests) {
  const A = new Map(athletes.map(a => [a.id, a])), keys = Object.keys(METRICS);
  const lines = [['athlete', 'team', 'position', 'date', 'movement', 'cameras', ...keys, 'flags'].join(',')];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  for (const t of [...tests].sort((x, y) => ms(x.at) - ms(y.at))) {
    const a = A.get(t.athlete_id) || {};
    lines.push([q(a.name), q(a.team), q(a.position), new Date(ms(t.at)).toISOString().slice(0, 10), q(t.summary?.preset), t.cameras ?? '', ...keys.map(k => valueOf(t.summary, k) ?? ''), q((t.summary?.flags || []).join(' | '))].join(','));
  }
  return lines.join('\n');
}

/** A sample squad for trying the dashboard before the server is set up (generic names, invented numbers). */
export function demoSquad(now = Date.now()) {
  const D = 864e5, athletes = [
    { id: 'a1', name: 'Bowler A', team: 'U19', position: 'Fast bowler', height_cm: 186 },
    { id: 'a2', name: 'Bowler B', team: 'U19', position: 'Fast bowler', height_cm: 181 },
    { id: 'a3', name: 'Bowler C', team: 'Senior', position: 'Fast bowler', height_cm: 190 },
    { id: 'a4', name: 'Forward D', team: 'Football', position: 'Forward', height_cm: 178 },
    { id: 'a5', name: 'Midfielder E', team: 'Football', position: 'Midfielder', height_cm: 174 },
    { id: 'a6', name: 'Defender F', team: 'Football', position: 'Defender', height_cm: 183 },
  ];
  const t = (id, days, preset, vals, flags = []) => ({ athlete_id: id, at: now - days * D, preset, cameras: 4, summary: { preset: PRESETS[preset].name, key: null, rows: Object.entries(vals).map(([k, v]) => ({ k, min: v - 10, max: v, at: v })), flags } });
  const tests = [
    t('a1', 60, 'bowling', { elbowR: 12, sideBend: 48, separation: 34, kneeL: 22 }, ['Trunk side-bend at release about 48°.']), t('a1', 20, 'bowling', { elbowR: 10, sideBend: 42, separation: 30, kneeL: 18 }),
    t('a2', 45, 'bowling', { elbowR: 9, sideBend: 38, separation: 28, kneeL: 15 }), t('a2', 10, 'bowling', { elbowR: 11, sideBend: 39, separation: 29, kneeL: 14 }),
    t('a3', 30, 'bowling', { elbowR: 17, sideBend: 44, separation: 41, kneeL: 30 }, ['Bowling elbow: straightened about 17° in the last 0.15 s before release.']),
    t('a4', 40, 'squat', { kneeL: 98, kneeR: 101, valgusL: 6, valgusR: 4, trunkLean: 32 }), t('a4', 5, 'squat', { kneeL: 102, kneeR: 103, valgusL: 3, valgusR: 3, trunkLean: 30 }),
    t('a5', 25, 'squat', { kneeL: 88, kneeR: 104, valgusL: 14, valgusR: 5, trunkLean: 38 }, ['Knee bend: 16° difference between left and right.', 'Knees moving in about 14° at the bottom.']),
    t('a6', 15, 'squat', { kneeL: 95, kneeR: 97, valgusL: 5, valgusR: 6, trunkLean: 35 }),
  ];
  return { athletes, tests };
}
