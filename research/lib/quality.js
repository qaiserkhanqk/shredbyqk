// Nightly quality reports and feature extraction. Pure functions over accepted observations.
//  • A "stream" is one device × firmware × site × kind × derivation × aggregation. Different streams are NEVER pooled:
//    no averaging across sensors, sites, raw/derived data or device and firmware transitions.
//  • Only quality signals the source actually provides are used. Unknown source flags are reported verbatim and not
//    interpreted; nothing is inferred about wear or contact.
//  • Data-quality confidence describes the measurements only. It says nothing about any biological inference.
import { CONFIG, configHash } from './config.js';

export const QUALITY_VERSION = 'nightly-quality-1.0.0';
export const FEATURE_METHOD = 'median-mad-iqr-1.0.0';
const MIN = 60e3;

export const streamKey = o => [o.device.serial, o.device.model, o.device.firmware ?? 'fw?', o.site, o.kind, o.derivation, o.aggregation].join('|');
const localDate = ms => new Date(ms).toISOString().slice(0, 10);
const hhmm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function inWindow(localMs, w) {
  const m = new Date(localMs).getUTCHours() * 60 + new Date(localMs).getUTCMinutes(), a = hhmm(w.start), b = hhmm(w.end);
  return a <= b ? m >= a && m < b : m >= a || m < b; // windows may cross midnight
}
export function quantile(sorted, q) { if (!sorted.length) return null; const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); }
export const median = xs => quantile([...xs].sort((a, b) => a - b), 0.5);
export const mad = xs => { const m = median(xs); return median(xs.map(x => Math.abs(x - m))); };
const r3 = x => (x == null ? null : Math.round(x * 1000) / 1000);

/** Assign each observation to a night label, or give the reason it can't be placed. */
export function placeNight(o, config = CONFIG) {
  if (o.aggregation === 'nightly_value') return o.nightLabel ? { night: o.nightLabel, windowSource: 'vendor_night_label' } : { reason: 'no_night_label' };
  if (o.tsUtc == null) return { reason: 'no_timestamp' };
  if (o.offsetMin == null) return { reason: 'no_utc_offset' };
  const local = o.tsUtc + o.offsetMin * MIN, label = localDate(local - config.night.labelShiftHours * 36e5);
  if (o.sleepSessionId) return { night: label, windowSource: 'sleep_session', session: o.sleepSessionId };
  if (!inWindow(local, config.night.fallbackWindow)) return { reason: 'outside_fallback_window' };
  return { night: label, windowSource: 'config_fallback_window' };
}

/**
 * Nightly reports. observations: accepted observations with `id`, `seq` (ingestion order), optional `excludedBy`
 * (a researcher correction) and `ingestedAt`. annotations: effective annotations (see cycles.effectiveAnnotations).
 */
export function nightlyReports(observations, annotations = [], config = CONFIG) {
  const groups = new Map(), unplaced = {};
  for (const o of observations) {
    const p = placeNight(o, config);
    if (!p.night) { unplaced[p.reason] = (unplaced[p.reason] || 0) + 1; continue; }
    const k = `${p.night}#${streamKey(o)}`;
    if (!groups.has(k)) groups.set(k, { night: p.night, key: streamKey(o), windowSource: p.windowSource, obs: [] });
    groups.get(k).obs.push(o);
  }
  const confByDate = new Map();
  for (const a of annotations) if (['illness', 'fever', 'disrupted_sleep', 'travel', 'device_change'].includes(a.type) && a.value === 'yes') (confByDate.get(a.date) || confByDate.set(a.date, []).get(a.date)).push(a.type);
  const reports = [...groups.values()].map(g => report(g, confByDate.get(g.night) || [], config)).sort((a, b) => a.night.localeCompare(b.night) || a.streamKey.localeCompare(b.streamKey));
  // Device / firmware transitions between consecutive nights of the same site and kind.
  const last = new Map();
  for (const r of reports) {
    const fam = `${r.stream.site}|${r.stream.kind}`, prev = last.get(fam);
    if (prev && prev.stream.serial !== r.stream.serial) r.flags.push('device_change_since_previous_night');
    else if (prev && prev.stream.firmware !== r.stream.firmware) r.flags.push('firmware_change_since_previous_night');
    if (prev && prev.streamKey !== r.streamKey) r.dataQuality.reasons.push('stream_transition'), r.dataQuality.level = r.dataQuality.level === 'good' ? 'limited' : r.dataQuality.level;
    last.set(fam, r);
  }
  return { qualityVersion: QUALITY_VERSION, configVersion: config.version, configHash: configHash(config), unplaced, reports };
}

function report(g, confounders, config) {
  const o0 = g.obs[0], q = config.quality[o0.kind] || config.quality.skin_temperature;
  const excluded = {}, flags = [], ex = (r, n = 1) => { excluded[r] = (excluded[r] || 0) + n; };
  const offsets = [...new Set(g.obs.map(o => o.offsetMin))], tzNames = [...new Set(g.obs.map(o => o.tzName).filter(Boolean))];
  if (offsets.length > 1) flags.push('utc_offset_changed_within_night');
  // Out-of-order arrival (by ingestion sequence) and duplicate timestamps within the stream.
  const bySeq = [...g.obs].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  let outOfOrder = 0; for (let i = 1; i < bySeq.length; i++) if (bySeq[i].tsUtc != null && bySeq[i - 1].tsUtc != null && bySeq[i].tsUtc < bySeq[i - 1].tsUtc) outOfOrder++;
  if (outOfOrder) flags.push('out_of_order_arrival');
  const seenTs = new Set(), unrecognised = new Set();
  let candidates = [];
  for (const o of [...g.obs].sort((a, b) => (a.tsUtc ?? 0) - (b.tsUtc ?? 0))) {
    if (o.excludedBy) { ex('researcher_excluded'); continue; }
    const hit = o.sourceFlags.find(f => config.quality.exclusionFlags.includes(f));
    for (const f of o.sourceFlags) if (!config.quality.exclusionFlags.includes(f)) unrecognised.add(f);
    if (hit) { ex(`source_flag:${hit}`); continue; }
    if (o.valueC == null) { ex('no_normalised_value'); continue; }
    if (o.ingestedAt && o.tsUtc != null && o.tsUtc > o.ingestedAt + 5 * MIN) { ex('timestamp_after_ingestion'); continue; }
    if (o.tsUtc != null) { if (seenTs.has(o.tsUtc)) { ex('duplicate_timestamp'); continue; } seenTs.add(o.tsUtc); }
    candidates.push(o);
  }
  // Isolated outliers: far from the night's median (k × scaled MAD) while both neighbours are not.
  let jumps = 0;
  if (q.outlierMadK && candidates.length >= 5) {
    const vals = candidates.map(o => o.valueC), m = median(vals), s = Math.max(1.4826 * mad(vals), q.outlierMinScale || 0); // floor: a near-constant night has MAD 0
    if (s > 0) {
      const far = v => Math.abs(v - m) > q.outlierMadK * s;
      const keep = candidates.filter((o, i) => !(far(o.valueC) && !far(candidates[i - 1]?.valueC ?? m) && !far(candidates[i + 1]?.valueC ?? m)));
      if (keep.length < candidates.length) ex('isolated_outlier', candidates.length - keep.length);
      candidates = keep;
    }
  }
  if (q.jumpPerMinute) for (let i = 1; i < candidates.length; i++) { const dt = (candidates[i].tsUtc - candidates[i - 1].tsUtc) / MIN; if (dt > 0 && Math.abs(candidates[i].valueC - candidates[i - 1].valueC) / dt > q.jumpPerMinute) jumps++; }
  if (jumps) flags.push('implausible_jump');
  // Coverage: union of measurement intervals. Unknown if the source gives neither an end time nor a sampling interval.
  let coverage = null, maxGap = null;
  const iv = candidates.filter(o => o.tsUtc != null).map(o => [o.tsUtc, o.endUtc ?? (o.device.samplingIntervalS ? o.tsUtc + o.device.samplingIntervalS * 1e3 : null)]);
  if (iv.length && iv.every(([, e]) => e != null)) {
    iv.sort((a, b) => a[0] - b[0]); let tot = 0, [cs, ce] = iv[0]; maxGap = 0;
    for (const [s, e] of iv.slice(1)) { if (s > ce) { tot += ce - cs; maxGap = Math.max(maxGap, (s - ce) / MIN); cs = s; ce = e; } else ce = Math.max(ce, e); }
    tot += ce - cs; coverage = Math.round(tot / MIN);
  }
  const vals = candidates.map(o => o.valueC).sort((a, b) => a - b);
  const vendor = o0.aggregation === 'nightly_value';
  const reasons = [];
  let level = 'good';
  if (vals.length < (vendor ? 1 : q.minValidSamples)) { level = 'insufficient'; reasons.push('too_few_valid_samples'); }
  if (!vendor && coverage != null && coverage < q.minCoverageMinutes) { level = 'insufficient'; reasons.push('coverage_below_minimum'); }
  const limited = r => { reasons.push(r); if (level === 'good') level = 'limited'; };
  if (coverage == null) limited(vendor ? 'vendor_value_coverage_unknown' : 'coverage_unknown');
  if (vendor) limited('vendor_derived_value');
  if (q.maxGapMinutes != null && maxGap != null && maxGap > q.maxGapMinutes) limited('gap_above_maximum');
  if (flags.includes('utc_offset_changed_within_night')) limited('utc_offset_changed_within_night');
  if (jumps) limited('implausible_jump');
  if (unrecognised.size) limited('unrecognised_source_flags');
  const times = candidates.filter(o => o.tsUtc != null).map(o => o.tsUtc);
  return {
    night: g.night, streamKey: g.key,
    stream: { serial: o0.device.serial, model: o0.device.model, firmware: o0.device.firmware, site: o0.site, kind: o0.kind, derivation: o0.derivation, aggregation: o0.aggregation },
    window: { source: g.windowSource, startUtc: times.length ? new Date(Math.min(...times)).toISOString() : null, endUtc: times.length ? new Date(Math.max(...iv.map(x => x[1] ?? x[0]))).toISOString() : null, utcOffsetsMin: offsets, tzNames },
    counts: { total: g.obs.length, valid: vals.length, excluded, outOfOrder, implausibleJumps: jumps },
    coverageMinutes: coverage, maxGapMinutes: maxGap == null ? null : Math.round(maxGap), flags, confounders: [...new Set(confounders)], unrecognisedSourceFlags: [...unrecognised],
    features: vals.length ? { median: r3(quantile(vals, 0.5)), mad: r3(mad(vals)), p25: r3(quantile(vals, 0.25)), p75: r3(quantile(vals, 0.75)), unit: 'degC' } : null,
    method: vendor ? 'vendor_nightly_passthrough-1.0.0' : FEATURE_METHOD,
    dataQuality: { level, reasons, about: 'measurement quality only, not biological inference' },
  };
}
