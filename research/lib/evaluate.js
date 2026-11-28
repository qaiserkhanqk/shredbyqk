// Evaluation on SYNTHETIC cohorts. Reports coverage/abstention, conditional error with its denominator, the error
// distribution with a participant-level bootstrap interval, empirical-range coverage and width, and shift-rule
// behaviour against defined synthetic events. Results describe code behaviour on invented data only.
import { effectiveAnnotations, segment, diffDays, addDays } from './cycles.js';
import { nextPeriodForecast, sustainedShift } from './inference.js';
import { nightlyReports, quantile } from './quality.js';
import { rng } from './synth.js';

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);
function bootstrapMAE(byPerson, B = 1000, seed = 5) {
  const r = rng(seed), people = byPerson.filter(p => p.length), stats = [];
  if (!people.length) return null;
  for (let b = 0; b < B; b++) { const draw = []; for (let i = 0; i < people.length; i++) draw.push(...people[Math.floor(r() * people.length)]); stats.push(mean(draw.map(Math.abs))); }
  stats.sort((a, b) => a - b);
  return [r2(quantile(stats, 0.025)), r2(quantile(stats, 0.975))];
}

/**
 * Forecast evaluation without leakage: for each true period start S_k (k ≥ 1) the forecast is made at noon UTC on the
 * day after the previous start, using only annotations recorded before that moment. The target is S_k from the full
 * data. people: [{ ref, annotations (ingest form, recordedAt ms) }]
 */
export function evaluateForecast(people, config) {
  const rows = [], leaks = [];
  for (const p of people) {
    const truth = segment(effectiveAnnotations(p.annotations), config).cycles;
    for (let k = 1; k < truth.length; k++) {
      const asOfDate = addDays(truth[k - 1].start, 1), asOf = Date.parse(`${asOfDate}T12:00:00Z`);
      const known = p.annotations.filter(a => a.recordedAt < asOf);
      if (known.some(a => a.date > asOfDate)) leaks.push({ ref: p.ref, asOfDate });
      const f = nextPeriodForecast(segment(effectiveAnnotations(known, { asOf }), config).cycles, { asOfDate, config });
      const target = truth[k].start;
      rows.push({ ref: p.ref, asOfDate, target, status: f.status, reasons: f.reasons, error: f.status === 'estimate' ? diffDays(target, f.pointDate) : null,
        inRange: f.status === 'estimate' ? target >= f.uncertainty.rangeStart && target <= f.uncertainty.rangeEnd : null, width: f.status === 'estimate' ? diffDays(f.uncertainty.rangeStart, f.uncertainty.rangeEnd) + 1 : null });
    }
  }
  const est = rows.filter(r => r.status === 'estimate'), errs = est.map(r => r.error).sort((a, b) => a - b);
  const abst = {}; for (const r of rows.filter(r => r.status !== 'estimate')) abst[r.reasons[0]] = (abst[r.reasons[0]] || 0) + 1; // primary code per abstention
  return {
    endpoint: 'next period start date: forecast point minus logged start (days)', reference: 'synthetic logged period starts (generator truth)', denominator: rows.length,
    estimates: est.length, abstained: rows.length - est.length, abstentionRate: rows.length ? r2((rows.length - est.length) / rows.length) : null, abstentionReasons: abst,
    conditionalMAE: r2(mean(errs.map(Math.abs))), maeBootstrap95: bootstrapMAE(people.map(p => est.filter(r => r.ref === p.ref).map(r => r.error))),
    errorQuantiles: errs.length ? { p10: quantile(errs, 0.1), p50: quantile(errs, 0.5), p90: quantile(errs, 0.9), min: errs[0], max: errs.at(-1) } : null,
    withinRange: est.length ? r2(est.filter(r => r.inRange).length / est.length) : null, meanRangeWidthDays: r2(mean(est.map(r => r.width))),
    leakageViolations: leaks.length, exclusions: 'first cycle of each person (no prior start); none other', rows,
  };
}

/**
 * Shift-rule evaluation against synthetic events. A cycle "has an event" when the generator raised the level from
 * eventNight + 1. Detection is counted as matching when the reported night is within ±toleranceNights of that night.
 * people: [{ ref, observations (accepted form), annotations, events: [{cycleStart, eventNight}], flat: bool }]
 */
export function evaluateShift(people, config, toleranceNights = 2) {
  const rows = [];
  for (const p of people) {
    const eff = effectiveAnnotations(p.annotations), q = nightlyReports(p.observations, eff, config);
    for (const c of segment(eff, config).cycles.filter(c => c.complete)) {
      const s = sustainedShift(q.reports, c, { config }), ev = p.flat ? null : p.events.find(e => e.cycleStart === c.start);
      const truthNight = ev ? addDays(ev.eventNight, 1) : null;
      rows.push({ ref: p.ref, cycleStart: c.start, hasEvent: !!ev, status: s.status, reasons: s.reasons, offset: s.status === 'shift_detected' && truthNight ? diffDays(truthNight, s.shiftNight) : null });
    }
  }
  const ev = rows.filter(r => r.hasEvent), flat = rows.filter(r => !r.hasEvent);
  const decided = ev.filter(r => r.status !== 'insufficient_data'), hits = decided.filter(r => r.offset != null && Math.abs(r.offset) <= toleranceNights);
  const offs = ev.filter(r => r.offset != null).map(r => r.offset).sort((a, b) => a - b);
  return {
    endpoint: `reported first elevated night within ±${toleranceNights} nights of the synthetic rise night`, reference: 'generator-defined synthetic events (not ovulation)',
    cyclesWithEvent: ev.length, abstainedWithEvent: ev.length - decided.length, detectedWithinTolerance: hits.length, detectedOutsideTolerance: decided.filter(r => r.status === 'shift_detected').length - hits.length, missed: decided.filter(r => r.status === 'no_clear_shift').length,
    sensitivityAmongDecided: decided.length ? r2(hits.length / decided.length) : null,
    cyclesWithoutEvent: flat.length, abstainedWithoutEvent: flat.filter(r => r.status === 'insufficient_data').length, falseDetections: flat.filter(r => r.status === 'shift_detected').length,
    offsetQuantiles: offs.length ? { p10: r2(quantile(offs, 0.1)), p50: r2(quantile(offs, 0.5)), p90: r2(quantile(offs, 0.9)) } : null, rows,
  };
}
