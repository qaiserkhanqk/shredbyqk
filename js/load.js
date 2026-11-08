// Readiness and training load: the injury-prevention layer.
//
// 1. Morning readiness (Hooper index; Hooper & Mackinnon 1995): sleep quality, fatigue, stress and
//    muscle soreness, each 1–7 (1 = very good, 7 = very bad), plus hours slept. Judged against the
//    athlete's OWN rolling baseline once 7+ days exist, because "normal" differs between people.
// 2. Session load (session-RPE; Foster et al. 2001): effort 0–10 × minutes = arbitrary units (AU).
//    Weekly load, monotony (mean ÷ SD of daily load) and strain (weekly load × monotony) follow Foster 1998.
// 3. Spike warning: this week's load against the average of the previous 3 weeks. Rapid load increases
//    are linked to injury, but the exact ratio thresholds (ACWR) are contested (Impellizzeri et al. 2020),
//    so the app warns and suggests rather than forbidding.
// 4. Today's recommendation combines readiness, load spike, recent sleep, jump readiness and rehab pain.

const DAY = 864e5;
export const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Hooper index: sum of the four 1–7 items (4 = excellent, 28 = very poor). */
export const hooper = c => c.sleepQ + c.fatigue + c.stress + c.soreness;

/**
 * Readiness 0–100 for a check-in, relative to the athlete's own baseline when available.
 * @param c today's check-in {sleepQ, fatigue, stress, soreness, sleepH}
 * @param history earlier check-ins (most recent last)
 */
export function readiness(c, history = []) {
  const h = hooper(c);
  const base = history.slice(-28).map(hooper);
  let score, basis;
  if (base.length >= 7) {
    const mean = base.reduce((s, v) => s + v, 0) / base.length;
    const sd = Math.sqrt(base.reduce((s, v) => s + (v - mean) ** 2, 0) / base.length) || 1.5;
    const z = (h - mean) / sd; // positive = worse than usual
    score = Math.round(Math.max(0, Math.min(100, 70 - z * 20)));
    basis = 'baseline';
  } else {
    score = Math.round(100 - ((h - 4) / 24) * 100); // absolute scale until a personal baseline exists
    basis = 'absolute';
  }
  if (c.sleepH != null && c.sleepH < 6) score = Math.max(0, score - 10); // short sleep penalty
  return { score, hooper: h, basis };
}

/** Session load in AU from effort (0–10 CR-10) and minutes. */
export const sessionLoad = s => Math.round((s.rpe || 0) * (s.minutes || 0));

/** Weekly figures for the 7 days ending at `endT`. */
export function weekStats(sessions, endT = Date.now()) {
  const days = [];
  for (let i = 6; i >= 0; i--) { const k = dayKey(endT - i * DAY); days.push(sessions.filter(s => dayKey(s.at) === k).reduce((a, s) => a + sessionLoad(s), 0)); }
  const load = days.reduce((a, v) => a + v, 0), mean = load / 7;
  const sd = Math.sqrt(days.reduce((a, v) => a + (v - mean) ** 2, 0) / 7);
  const monotony = sd > 0 ? mean / sd : (load > 0 ? 7 : 0);
  return { load, days, monotony: +monotony.toFixed(2), strain: Math.round(load * monotony) };
}

/** This week vs the average of the 3 weeks before. ratio > 1.3 is treated as a spike (a warning, not a rule). */
export function loadSpike(sessions, now = Date.now()) {
  const thisWeek = weekStats(sessions, now).load;
  const prev = [1, 2, 3].map(w => weekStats(sessions, now - w * 7 * DAY).load);
  const chronic = prev.reduce((a, v) => a + v, 0) / 3;
  if (chronic < 50) return { ratio: null, thisWeek, chronic, spike: false }; // not enough history
  const ratio = thisWeek / chronic;
  return { ratio: +ratio.toFixed(2), thisWeek, chronic: Math.round(chronic), spike: ratio > 1.3, low: ratio < 0.8 };
}

/**
 * Today's recommendation.
 * @returns { level: 'go'|'adjust'|'recover', title, reasons[] }
 */
export function recommendToday({ check, history = [], sessions = [], jumpStatus = null, rehabLight = null, now = Date.now() }) {
  const reasons = []; let level = 'go';
  const bump = l => { if (l === 'recover' || (l === 'adjust' && level === 'go')) level = l; };
  if (check) {
    const r = readiness(check, history);
    if (r.score < 40) { bump('recover'); reasons.push(`Readiness is low today (${r.score}/100).`); }
    else if (r.score < 60) { bump('adjust'); reasons.push(`Readiness is below your usual (${r.score}/100).`); }
    if (check.sleepH != null && check.sleepH < 6) reasons.push(`Only ${check.sleepH} h of sleep: short sleep is linked to higher injury risk.`);
    if (check.soreness >= 6) { bump('adjust'); reasons.push('Muscles are very sore: avoid heavy work on the sore areas.'); }
  }
  const sp = loadSpike(sessions, now);
  if (sp.spike) { bump('adjust'); reasons.push(`This week's training load is ${Math.round((sp.ratio - 1) * 100)}% above your recent average. Big jumps raise injury risk.`); }
  if (jumpStatus === 'fatigued') { bump('adjust'); reasons.push('Your jump height is well below your usual: a sign of fatigue.'); }
  if (rehabLight === 'red') { bump('adjust'); reasons.push('Your rehab pain went over the limit last time: keep the injured area light.'); }
  const title = level === 'go' ? 'Train as planned' : level === 'adjust' ? 'Train, but lighter: cut volume by about a third' : 'Recovery day: walk, mobility, easy cardio';
  if (!reasons.length) reasons.push(check ? 'Sleep, soreness, stress and load all look good.' : 'Do your morning check-in for a personalised recommendation.');
  return { level, title, reasons, spike: sp };
}
