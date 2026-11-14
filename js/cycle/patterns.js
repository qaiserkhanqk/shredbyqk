// Personal patterns: explainable observations from the user's OWN logs, nothing else.
//
// A pattern for category C at cycle days [from..to] is reported only when ALL of these hold:
//   • it is looked for in complete, usable cycles (both starts logged, no missed log), the most recent RECENT;
//   • a cycle counts only if C was actually logged at least once in that window ("observed"); a cycle
//     with no log there is left out, never counted as "didn't happen";
//   • at least MIN_OBSERVED cycles were observed, and C was notable (e.g. "lower energy") in at least
//     MIN_SHARE of them and in at least MIN_OBSERVED cycles;
//   • notable entries were NOT common outside the window (< MAX_OUTSIDE of logged days), so a pattern is
//     not reported for something the user logs all the time.
// Cycles are aligned from the first day of bleeding (cycle day 1). With variable cycles that alignment is
// coarse, which is one reason everything here is an observation, not a prediction.
// The thresholds are placeholders for clarity, not tuned or validated.
import { addDays, diffDays } from './dates.js';
import { CATEGORIES, cycles, categoryOn } from './model.js';

export const PATTERN_PARAMS = Object.freeze({ RECENT: 6, HALF_WINDOW: 1, MIN_OBSERVED: 3, MIN_SHARE: 0.75, MAX_OUTSIDE: 0.5 });

function cycleLogs(s, c, cat) {
  const out = [];
  for (let i = 0; i < c.length; i++) { const d = addDays(c.start, i), v = s.days[d]?.[cat]; if (v != null) out.push({ day: i + 1, date: d, value: v, source: s.days[d].src?.[cat] || 'typed' }); }
  return out;
}

/** Evaluate one category at one cycle-day window. Returns the full evidence either way. */
export const evaluateWindow = (s, cat, centre, p = PATTERN_PARAMS) => evaluateRange(s, cat, Math.max(1, centre - p.HALF_WINDOW), centre + p.HALF_WINDOW, p);

export function evaluateRange(s, cat, from, to, p = PATTERN_PARAMS) {
  const def = CATEGORIES[cat];
  const complete = cycles(s).filter(c => c.usable).slice(-p.RECENT);
  let observed = 0, notable = 0, outN = 0, outNotable = 0, daysLogged = 0, fromSuggestions = 0; const evidence = [];
  for (const c of complete) {
    const logs = cycleLogs(s, c, cat); daysLogged += logs.length;
    fromSuggestions += logs.filter(l => l.source === 'suggestion').length;
    const inWin = logs.filter(l => l.day >= from && l.day <= to), outWin = logs.filter(l => l.day < from || l.day > to);
    outN += outWin.length; outNotable += outWin.filter(l => def.notable.includes(l.value)).length;
    if (!inWin.length) { evidence.push({ cycleStart: c.start, observed: false, entries: [] }); continue; }
    observed++; const hit = inWin.some(l => def.notable.includes(l.value)); if (hit) notable++;
    evidence.push({ cycleStart: c.start, observed: true, notable: hit, entries: inWin });
  }
  const outsideRate = outN ? outNotable / outN : 0;
  const found = observed >= p.MIN_OBSERVED && notable >= p.MIN_OBSERVED && notable / observed >= p.MIN_SHARE && outsideRate < p.MAX_OUTSIDE;
  let why;
  if (complete.length < p.MIN_OBSERVED) why = `Only ${complete.length} complete ${complete.length === 1 ? 'cycle' : 'cycles'} logged so far (we need ${p.MIN_OBSERVED}).`;
  else if (observed < p.MIN_OBSERVED) why = `${def.label} was logged around these days in only ${observed} of ${complete.length} complete cycles.`;
  else if (!found && outsideRate >= p.MAX_OUTSIDE && notable / observed >= p.MIN_SHARE) why = `You logged ${def.notableLabel} on many days at other times too, so these days don't stand out.`;
  else if (!found) why = `Not consistent: ${def.notableLabel} in ${notable} of ${observed} cycles with logs here.`;
  return { category: cat, from, to, found, observed, notable, completeCycles: complete.length, daysLogged, fromSuggestions, outsideRate, evidence, why };
}

/** All patterns for enabled categories, merged into day ranges, with plain-language text. */
export function findPatterns(s, { maxDay = 35, params = PATTERN_PARAMS } = {}) {
  const out = [];
  for (const cat of Object.keys(CATEGORIES)) {
    if (!categoryOn(s, cat)) continue;
    let run = null;
    for (let d = 1; d <= maxDay; d++) {
      const w = evaluateWindow(s, cat, d, params);
      if (w.found) { if (run && w.from <= run.to + 1) { run.to = w.to; if (w.notable / w.observed > run.notable / run.observed) Object.assign(run, { ...w, from: run.from }); } else { if (run) out.push(run); run = { ...w }; } }
      else if (run) { out.push(run); run = null; }
    }
    if (run) out.push(run);
  }
  return out.map(w => trim(s, w, params)).map(w => ({ ...w, key: `${w.category}:${w.from}-${w.to}`, text: patternText(w) }));
}

/* Merging overlapping windows widens a range by up to HALF_WINDOW days on each side. Trim it back to the days
   that were actually notable in at least MIN_OBSERVED cycles, and recompute the counts for exactly that range, so
   the text never claims more days than the records show. */
function trim(s, w, p) {
  const perDay = {}, full = evaluateRange(s, w.category, w.from, w.to, p);
  for (const e of full.evidence) for (const d of new Set(e.entries.filter(x => CATEGORIES[w.category].notable.includes(x.value)).map(x => x.day))) perDay[d] = (perDay[d] || 0) + 1;
  const days = Object.keys(perDay).map(Number).filter(d => perDay[d] >= p.MIN_OBSERVED).sort((a, b) => a - b);
  if (!days.length) return w;
  const t = evaluateRange(s, w.category, days[0], days.at(-1), p);
  return t.found ? t : w;
}

export function patternText(w) {
  const def = CATEGORIES[w.category];
  return `You logged ${def.notableLabel} around cycle days ${w.from}–${w.to} in ${w.notable} of your last ${w.observed} recorded cycles with ${def.label.toLowerCase()} logs there.`;
}
export function evidenceText(w) {
  return `Based on ${w.completeCycles} complete cycles and ${w.daysLogged} days with ${CATEGORIES[w.category].label.toLowerCase()} logs. ${w.observed} cycles had a log in this window. ${Math.round(w.outsideRate * 100)}% of your logs at other times were ${CATEGORIES[w.category].notableLabel}.${w.fromSuggestions ? ` ${w.fromSuggestions} of these logs were one-tap suggestions you accepted.` : ''}`;
}

/** The insight for "around now": a found, non-dismissed pattern whose window covers today's cycle day. */
export function insightForToday(s, today, patterns = findPatterns(s)) {
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort(); if (!starts.length) return null;
  const cd = diffDays(starts.at(-1), today) + 1;
  return patterns.find(p => cd >= p.from && cd <= p.to && !s.dismissed[p.key]) || null;
}

/** Per-category summary for the "not enough data" state. */
export function patternStatus(s) {
  const found = findPatterns(s), complete = cycles(s).filter(c => c.usable).slice(-PATTERN_PARAMS.RECENT);
  return Object.keys(CATEGORIES).filter(c => categoryOn(s, c)).map(cat => {
    const mine = found.filter(p => p.category === cat);
    if (mine.length) return { category: cat, status: 'found', patterns: mine };
    const withLogs = complete.filter(c => cycleLogs(s, c, cat).length).length; // cycles with no logs of this category don't count
    if (withLogs < PATTERN_PARAMS.MIN_OBSERVED) return { category: cat, status: 'insufficient', why: `We need ${PATTERN_PARAMS.MIN_OBSERVED} complete cycles with ${CATEGORIES[cat].label.toLowerCase()} logs; you have ${withLogs}.` };
    return { category: cat, status: 'none', why: 'No consistent pattern in your logs. A daily check-in reminder may help you keep a record.' };
  });
}

/* ---------- Experimental symptom forecast (flag symptomForecast, default OFF) ----------
   Says "you may want to check in about X on these days" when a found pattern covers an upcoming cycle day.
   It is compared in the evaluation harness with each person's own base-rate baseline, including false alerts. */
export function forecastCheckins(s, today, days = 7, patterns = findPatterns(s)) {
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort(); if (!starts.length) return [];
  const last = starts.at(-1), out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i), cd = diffDays(last, date) + 1;
    for (const p of patterns) if (cd >= p.from && cd <= p.to && !s.dismissed[p.key]) out.push({ date, category: p.category, key: p.key, basis: p });
  }
  return out;
}
