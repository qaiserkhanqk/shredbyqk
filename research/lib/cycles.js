// Annotation history and cycle segmentation from LOGGED bleeding only. Nothing here uses temperature.
// Annotations are append-only. A later entry with `corrects: X` replaces X (and anything X had replaced); a value of
// `retracted` removes it.
//
// Knowledge time (issue 7 reported against b3d9589): with `asOf` (epoch ms), an entry is used only if it was both
// RECORDED (`recordedAt`, the participant's entry time) and INGESTED into this system (`ingestedAt`, the commit time
// of its import batch) before asOf. An entry typed earlier but imported later was not known at the cutoff.
//
// Malformed corrections (issue 8): ingestion rejects self-referencing and circular corrections, but stored data could
// still be malformed (older imports, manual edits). Following `corrects` links uses a visited set, so a loop cannot
// hang analysis; entries in a loop, and entries whose correction chain leads into one, are left out and listed in the
// result's `malformed` property.
import { CONFIG } from './config.js';

export const SEGMENT_VERSION = 'segmentation-1.1.0';
const DAY = 864e5;
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export const knownAt = (a, asOf) => a.recordedAt < asOf && (a.ingestedAt == null || a.ingestedAt < asOf);

/** Walk `corrects` links from `id`. Returns { root, cyclic }: root is the oldest ancestor reached (or an unknown ID). */
export function correctionRoot(byId, id) {
  const seen = new Set(); let cur = id;
  for (;;) {
    if (seen.has(cur)) return { root: null, cyclic: true };
    seen.add(cur);
    const next = byId.get(cur)?.corrects;
    if (!next) return { root: cur, cyclic: false };
    cur = next;
  }
}

export function effectiveAnnotations(anns, { asOf = Infinity } = {}) {
  const known = anns.filter(a => knownAt(a, asOf)).sort((a, b) => a.recordedAt - b.recordedAt || a.entryId.localeCompare(b.entryId));
  const byId = new Map(known.map(a => [a.entryId, a]));
  const live = new Map(), malformed = [];
  for (const a of known) {
    const { root, cyclic } = correctionRoot(byId, a.entryId);
    if (cyclic) { malformed.push(a.entryId); continue; }
    if (a.value === 'retracted') { live.delete(root); continue; }
    live.set(root, a);
  }
  const out = [...live.values()].sort((a, b) => a.date.localeCompare(b.date) || a.entryId.localeCompare(b.entryId));
  out.malformed = malformed;
  return out;
}

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
