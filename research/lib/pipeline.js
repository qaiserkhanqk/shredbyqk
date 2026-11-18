// One participant's analysis, end to end, as known at `asOf` (epoch ms; default: now). Observations ingested after
// asOf and annotations recorded after asOf are invisible, so a retrospective view can be reproduced exactly and later
// data never changes an earlier result. Experimental layers run only when the researcher has enabled them.
import { CONFIG, configHash } from './config.js';
import { nightlyReports } from './quality.js';
import { effectiveAnnotations, segment } from './cycles.js';
import { descriptiveTrend, sustainedShift, nextPeriodForecast } from './inference.js';
import { hashJSON } from './hash.js';

export const PIPELINE_VERSION = 'pipeline-1.0.0';

export function analyse({ observations, annotations, asOf = Date.now(), features = {}, config = CONFIG }) {
  const asOfDate = new Date(asOf).toISOString().slice(0, 10);
  const obs = observations.filter(o => (o.ingestedAt ?? 0) < asOf && (o.tsUtc == null || o.tsUtc < asOf));
  const eff = effectiveAnnotations(annotations, { asOf });
  const quality = nightlyReports(obs, eff, config);
  const seg = segment(eff, config);
  const cycles = seg.cycles;
  const trend = cycles.slice(-3).flatMap(c => descriptiveTrend(quality.reports, c, config).map(t => ({ cycleStart: c.start, ...t })));
  const out = {
    observed: { nights: quality.reports, unplaced: quality.unplaced, cycles, spottingDays: seg.spottingDays, annotations: eff.map(({ participantRef, ...a }) => a) },
    descriptive: { trend },
    estimates: features.experimental_shift ? cycles.map(c => sustainedShift(quality.reports, c, { dataCutoff: c.complete ? null : asOfDate, config })) : { status: 'disabled', reasons: ['experimental_shift_not_enabled_by_researcher'] },
    forecasts: features.experimental_forecast ? nextPeriodForecast(cycles, { asOfDate, config }) : { status: 'disabled', reasons: ['experimental_forecast_not_enabled_by_researcher'] },
    provenance: { pipelineVersion: PIPELINE_VERSION, qualityVersion: quality.qualityVersion, segmentationVersion: seg.segmentationVersion, configVersion: config.version, configHash: configHash(config), asOf: new Date(asOf).toISOString(),
      inputHash: hashJSON({ obs: obs.map(o => o.rowHash).sort(), ann: annotations.filter(a => a.recordedAt < asOf).map(a => [a.entryId, a.recordedAt]).sort() }) },
  };
  return out;
}
