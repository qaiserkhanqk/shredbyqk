// A summary for a health professional, made only when the person asks for it. Pure functions: nothing is stored,
// sent or logged. It describes what the person entered, in plain figures, and nothing else:
//  • periods (an open period keeps no end date), cycle lengths, spotting days, counts for symptom categories that are
//    switched on, situations marked, and ovulation-test (LH) results only while that research logging is on;
//  • NO estimates or predictions, no pattern findings, no wearable or temperature data, no fertility content.
// Days without an entry are unknown, never "none". Not a diagnosis and not clinically reviewed.
import * as M from './model.js';
import { isDate, diffDays } from './dates.js';

export const SUMMARY_MONTHS = [3, 6, 12, 24];

/** The date `months` calendar months before `t` (clamped to the last day of a shorter month). */
function monthsBefore(t, months) {
  const [y, m, d] = t.split('-').map(Number), total = y * 12 + (m - 1) - months, ny = Math.floor(total / 12), nm = total % 12 + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function clinicianSummary(s, { today, months = 12 } = {}) {
  if (!M.hasConsent(s)) throw new M.CycleError('NO_CONSENT');
  if (!isDate(today) || !SUMMARY_MONTHS.includes(months)) throw new M.CycleError('INVALID_INPUT');
  const from = monthsBefore(today, months), inWindow = d => d >= from && d <= today;
  const periods = [...s.periods].filter(p => inWindow(p.start)).sort((a, b) => a.start.localeCompare(b.start))
    .map(p => ({ start: p.start, end: p.end ?? null, days: p.end ? diffDays(p.start, p.end) + 1 : null }));
  const cycles = M.cycles(s).filter(c => inWindow(c.start)).map(c => ({ start: c.start, nextStart: c.nextStart, length: c.length, usable: c.usable, reason: c.reason }));
  const used = cycles.filter(c => c.usable).map(c => c.length), closed = periods.filter(p => p.days).map(p => p.days);
  const days = Object.entries(s.days).filter(([d]) => inWindow(d));
  const symptoms = Object.entries(M.CATEGORIES).filter(([k]) => M.categoryOn(s, k)).map(([k, c]) => {
    const vals = days.map(([, d]) => d[k]).filter(v => v != null);
    return { category: k, label: c.label, daysLogged: vals.length, counts: c.options.map(([value, label]) => ({ value, label, days: vals.filter(v => v === value).length })).filter(x => x.days) };
  });
  const marked = k => [...(s.situationLog || [])].reverse().find(e => e.key === k && e.on)?.at?.slice(0, 10) || null;
  return {
    generatedOn: today, from, to: today, months,
    periods, cycles,
    cycleStats: used.length ? { count: used.length, shortest: Math.min(...used), longest: Math.max(...used) } : null,
    periodStats: closed.length ? { count: closed.length, shortest: Math.min(...closed), longest: Math.max(...closed) } : null,
    spottingDays: days.filter(([, d]) => d.bleeding === 'spotting').length,
    symptoms,
    situations: Object.keys(s.situation || {}).filter(k => s.situation[k] && M.SITUATIONS[k]).map(k => ({ key: k, label: M.SITUATIONS[k].label, marked: marked(k) })),
    lhTests: s.consent.lhTests ? days.filter(([, d]) => d.lh).map(([date, d]) => ({ date, result: d.lh, label: M.LH_RESULTS[d.lh] })).sort((a, b) => a.date.localeCompare(b.date)) : null,
  };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Plain text for printing or saving. */
export function summaryText(x) {
  const L = [
    'Cycle summary for a health professional',
    `Made on ${x.generatedOn}, on request, from your own entries in Shred by QK (prototype). Covers ${x.from} to ${x.to}.`,
    'This is not a diagnosis and contains no predictions. It has not been reviewed by a clinician. Days without an entry are unknown, not "none".',
    '',
    `Periods logged (${x.periods.length})`,
    ...(x.periods.length ? x.periods.map(p => `  ${p.start}${p.end ? ` to ${p.end} (${plural(p.days, 'day')})` : ', end not logged yet'}`) : ['  No periods logged in this time.']),
    ...(x.periodStats ? [`  Logged period length: shortest ${plural(x.periodStats.shortest, 'day')}, longest ${plural(x.periodStats.longest, 'day')} (${x.periodStats.count} with an end date).`] : []),
    '',
    'Cycle lengths (from one logged start to the next)',
    ...(x.cycles.length ? x.cycles.map(c => `  ${c.start}: ${plural(c.length, 'day')}${c.usable ? '' : `, not used in the figures: ${c.reason}`}`) : ['  A cycle length needs two logged starts.']),
    ...(x.cycleStats ? [`  Usable cycles: ${x.cycleStats.count}. Shortest ${plural(x.cycleStats.shortest, 'day')}, longest ${plural(x.cycleStats.longest, 'day')}.`] : []),
    '',
    `Spotting: logged on ${plural(x.spottingDays, 'day')}.`,
  ];
  if (x.symptoms.length) L.push('', 'Symptoms (only the categories switched on; counts are days with that entry)',
    ...x.symptoms.map(c => `  ${c.label}: ${plural(c.daysLogged, 'day')} logged${c.counts.length ? `: ${c.counts.map(v => `${v.label.toLowerCase()} ${v.days}`).join(', ')}` : ''}`));
  if (x.situations.length) L.push('', 'Situations marked', ...x.situations.map(v => `  ${v.label}${v.marked ? ` (marked ${v.marked})` : ''}`));
  if (x.lhTests) L.push('', 'Ovulation test (LH) results, as recorded (not interpreted)',
    ...(x.lhTests.length ? x.lhTests.map(r => `  ${r.date}: ${r.label}`) : ['  None recorded in this time.']));
  return L.join('\n');
}
