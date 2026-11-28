// One participant's analysis, end to end, as known at `asOf` (epoch ms; default: now). Reproducible history (issue 7
// reported against b3d9589): only information KNOWN at the cutoff is used —
//  • observations ingested before asOf (and with timestamps before it);
//  • annotations both recorded and ingested before asOf (cycles.effectiveAnnotations);
//  • researcher corrections made before asOf: each observation's exclusion state is replayed from its correction
//    history, so a correction made later never changes an earlier result.
// The provenance hash covers the observations, annotations and corrections known at the cutoff, and the stream
// identities used, so two runs with the same hash used the same information. Experimental layers run only when a
// researcher has enabled them.
import { CONFIG, configHash } from './config.js';
import { nightlyReports } from './quality.js';
import { effectiveAnnotations, segment, knownAt } from './cycles.js';
import { descriptiveTrend, sustainedShift, nextPeriodForecast } from './inference.js';
import { hashJSON } from './hash.js';
import { vendorNightCompleteAt } from './ingest.js';

export const PIPELINE_VERSION = 'pipeline-1.2.0';

/** Correction state from a correction history, replayed in order: "exclude" excludes the VALUE, "exclude_timing"
 *  excludes the TIMESTAMP / session assignment (the sample is then not placed at all), "restore" clears both.
 *  Shared by the pipeline (as of a cutoff) and the store (current state). */
export function correctionState(corrections = []) {
  let excludedBy = null, timingExcludedBy = null;
  for (const c of corrections) { if (c.action === 'exclude') excludedBy = 'correction'; else if (c.action === 'exclude_timing') timingExcludedBy = 'correction'; else if (c.action === 'restore') { excludedBy = null; timingExcludedBy = null; } }
  return { excludedBy, timingExcludedBy };
}
/** Exclusion state of one observation at a cutoff, replayed from its correction history (if it has one). */
function asKnownAt(o, asOf) {
  if (!Array.isArray(o.corrections)) return o;
  const known = o.corrections.filter(c => c.at < asOf);
  return { ...o, ...correctionState(known), corrections: known };
}
/** Known at the cutoff: ingested before it, and (by its own time) able to have happened before it. A vendor nightly
 *  value has no timestamp, so its night label is used with the documented convention (CONFIG.night.vendorNightCompleteRule). */
function knownObservation(o, asOf, config) {
  if ((o.ingestedAt ?? 0) >= asOf) return false;
  if (o.aggregation === 'nightly_value') return !!o.nightLabel && vendorNightCompleteAt(o.nightLabel, o.offsetMin, config) <= asOf;
  return o.tsUtc == null || !(o.tsUtc >= asOf);
}

export function analyse({ observations, annotations, asOf = Date.now(), features = {}, config = CONFIG }) {
  const asOfDate = new Date(asOf).toISOString().slice(0, 10);
  const obs = observations.filter(o => knownObservation(o, asOf, config)).map(o => asKnownAt(o, asOf));
  const eff = effectiveAnnotations(annotations, { asOf });
  const quality = nightlyReports(obs, eff, config);
  const seg = segment(eff, config);
  const cycles = seg.cycles;
  const trend = cycles.slice(-3).flatMap(c => descriptiveTrend(quality.reports, c, config).map(t => ({ cycleStart: c.start, ...t })));
  const effectiveCorrections = obs.flatMap(o => (o.corrections || []).map(c => ({ observation: o.obsKey, action: c.action, reason: c.reason, at: new Date(c.at).toISOString() })))
    .sort((a, b) => a.at.localeCompare(b.at) || a.observation.localeCompare(b.observation));
  const annKnown = annotations.filter(a => knownAt(a, asOf)).map(a => [a.entryId, a.type, a.value, a.date, a.recordedAt, a.ingestedAt ?? null, a.corrects ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const streams = [...new Set(quality.reports.map(r => r.streamKey))].sort();
  const out = {
    observed: { nights: quality.reports, unplaced: quality.unplaced, cycles, spottingDays: seg.spottingDays, annotations: eff.map(({ participantRef, ...a }) => a), malformedAnnotations: eff.malformed },
    descriptive: { trend },
    estimates: features.experimental_shift ? cycles.map(c => sustainedShift(quality.reports, c, { dataCutoff: c.complete ? null : asOfDate, config })) : { status: 'disabled', reasons: ['experimental_shift_not_enabled_by_researcher'] },
    forecasts: features.experimental_forecast ? nextPeriodForecast(cycles, { asOfDate, config }) : { status: 'disabled', reasons: ['experimental_forecast_not_enabled_by_researcher'] },
    provenance: { pipelineVersion: PIPELINE_VERSION, qualityVersion: quality.qualityVersion, segmentationVersion: seg.segmentationVersion, configVersion: config.version, configHash: configHash(config), asOf: new Date(asOf).toISOString(),
      streams, effectiveCorrections,
      inputHash: hashJSON({ obs: obs.map(o => o.rowHash).sort(), ann: annKnown, corrections: effectiveCorrections, streams }) },
  };
  return out;
}
