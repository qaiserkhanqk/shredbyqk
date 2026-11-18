// Annotation history and cycle segmentation from LOGGED bleeding only. Nothing here uses temperature.
// Annotations are append-only. A later entry with `corrects: X` replaces X; a value of `retracted` removes X.
// `asOf` (an epoch ms) restricts everything to what had been recorded before that moment, so evaluations and
// retrospective analyses never use later information.
import { CONFIG } from './config.js';

export const SEGMENT_VERSION = 'segmentation-1.0.0';
const DAY = 864e5;
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export function effectiveAnnotations(anns, { asOf = Infinity } = {}) {
  const known = anns.filter(a => a.recordedAt < asOf).sort((a, b) => a.recordedAt - b.recordedAt || a.entryId.localeCompare(b.entryId));
  const live = new Map();
  for (const a of known) {
    if (a.corrects) { const root = [...live.entries()].find(([, v]) => v.chain.includes(a.corrects)); if (root) live.delete(root[0]); }
    if (a.value === 'retracted') continue;
    const chain = [a.entryId, ...(a.corrects ? (known.find(x => x.entryId === a.corrects) ? chainOf(known, a.corrects) : [a.corrects]) : [])];
    live.set(a.entryId, { ...a, chain });
  }
  return [...live.values()].map(({ chain, ...a }) => a).sort((a, b) => a.date.localeCompare(b.date) || a.entryId.localeCompare(b.entryId));
}
function chainOf(known, id) { const out = []; let cur = known.find(x => x.entryId === id); while (cur) { out.push(cur.entryId); cur = cur.corrects ? known.find(x => x.entryId === cur.corrects) : null; } return out; }

/**
 * Cycle starts: a logged `period_start`, or the first `period` day of a run with no period-type bleeding in the
 * preceding `bleedingRunGapDays` days (an engineering assumption). Spotting never starts a cycle.
 */
export function segment(effective, config = CONFIG) {
  const bleed = effective.filter(a => a.type === 'bleeding' && (a.value === 'period_start' || a.value === 'period')).map(a => ({ date: a.date, explicit: a.value === 'period_start' })).sort((a, b) => a.date.localeCompare(b.date));
  const starts = []; let lastBleed = null;
  const gap = config.segmentation.bleedingRunGapDays;
  for (const b of bleed) {
    const newRun = lastBleed == null || diffDays(lastBleed, b.date) > gap;
    const recentStart = starts.length && diffDays(starts.at(-1).date, b.date) <= gap; // same bleeding episode
    if (b.explicit && !recentStart) starts.push({ date: b.date, source: 'logged_period_start' });
    else if (!b.explicit && newRun && !recentStart) starts.push({ date: b.date, source: 'first_day_of_bleeding_run' });
    lastBleed = b.date;
  }
  const { min, max } = config.segmentation.plausibleCycleDays;
  const cycles = starts.map((s, i) => {
    const next = starts[i + 1]?.date ?? null, length = next ? diffDays(s.date, next) : null;
    const codes = [s.source];
    if (!next) codes.push('cycle_in_progress');
    else if (length < min || length > max) codes.push('length_outside_plausible_range_check_entries');
    return { start: s.date, nextStart: next, length, complete: !!next, usable: !!next && length >= min && length <= max, codes };
  });
  return { segmentationVersion: SEGMENT_VERSION, cycles, spottingDays: effective.filter(a => a.type === 'bleeding' && a.value === 'spotting').map(a => a.date) };
}
