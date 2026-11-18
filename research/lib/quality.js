// Nightly quality reports and feature extraction. Pure functions over accepted observations.
//  • A "stream" is one device serial × MODEL × firmware × site × kind × derivation × aggregation. `streamId` is the
//    ONE canonical identity used by quality control, inference and provenance (issue 6 reported against b3d9589), so
//    a change of any part, including the model, is a transition and is never pooled or compared across.
//  • Only quality signals the source actually provides are used. Unknown source flags are reported verbatim and not
//    interpreted; nothing is inferred about wear or contact.
//  • Data-quality confidence describes the measurements only. It says nothing about any biological inference.
import { CONFIG, configHash } from './config.js';

export const QUALITY_VERSION = 'nightly-quality-1.2.0';
export const FEATURE_METHOD = 'median-mad-iqr-1.0.0';
const MIN = 60e3;

/** Canonical stream identity from a stream description {serial, model, firmware, site, kind, derivation, aggregation}. */
export const streamId = st => [st.serial, st.model, st.firmware ?? 'fw?', st.site, st.kind, st.derivation, st.aggregation].join('|');
export const streamOf = o => ({ serial: o.device.serial, model: o.device.model, firmware: o.device.firmware, site: o.site, kind: o.kind, derivation: o.derivation, aggregation: o.aggregation });
export const streamKey = o => streamId(streamOf(o));
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

/* Night labels (issue 5 reported against b3d9589).
   • A sample with a source sleep session takes the label of its WHOLE SESSION: the local date of (session start −
     labelShiftHours), where the session start is its earliest sample and "local" uses the UTC offset recorded with
     that first sample. Every sample of the session gets the same label, so a daytime sleep crossing noon, or a
     session during which the person changes time zone, is never split. Later offset changes inside the session do
     not move the label; they are flagged (utc_offset_changed_within_night).
   • A sample without a session uses its own local time and the configured fallback window.
   Session identity is the source session ID within one device serial.

   VALUE vs TIMING exclusion (issue 4c reported against 21317c5):
   • `excludedBy` (correction action "exclude"): the VALUE is not used; the sample's timing is still trusted, so it is
     still placed in its night and still counts for the session's start.
   • `timingExcludedBy` (correction action "exclude_timing"): the TIMESTAMP or session assignment is wrong; the sample is
     not placed at all (unplaced: timing_excluded_by_correction) and cannot influence any session's label.
   • Automatic guard: a sample more than night.sessionTimingToleranceHours from its session's median time is a timing
     outlier (unplaced: session_timing_outlier). Session start = earliest NON-outlier sample. */
const sessionId = o => `${o.device?.serial ?? ""}|${o.sleepSessionId}`; // placeNight may be called on a bare reading
const timingUsable = o => Number.isFinite(o.tsUtc) && Number.isInteger(o.offsetMin) && !o.timingExcludedBy;
export function sessionLabels(observations, config = CONFIG) {
  const bySession = new Map();
  for (const o of observations) {
    if (!o.sleepSessionId || o.aggregation === 'nightly_value' || !timingUsable(o)) continue;
    const k = sessionId(o); (bySession.get(k) || bySession.set(k, []).get(k)).push(o);
  }
  const labels = new Map(), outliers = new Set(), tol = config.night.sessionTimingToleranceHours * 36e5;
  for (const [k, os] of bySession) {
    const mid = median(os.map(o => o.tsUtc));
    const inSession = os.filter(o => Math.abs(o.tsUtc - mid) <= tol);
    for (const o of os) if (!inSession.includes(o)) outliers.add(o);
    const first = inSession.reduce((a, o) => (o.tsUtc < a.tsUtc ? o : a), inSession[0]);
    if (first) labels.set(k, localDate(first.tsUtc + first.offsetMin * MIN - config.night.labelShiftHours * 36e5));
  }
  labels.outliers = outliers;
  return labels;
}
/** Assign each observation to a night label, or give the reason it can't be placed. */
export function placeNight(o, config = CONFIG, labels = null) {
  if (o.aggregation === 'nightly_value') return o.nightLabel ? { night: o.nightLabel, windowSource: 'vendor_night_label' } : { reason: 'no_night_label' };
  if (o.timingExcludedBy) return { reason: 'timing_excluded_by_correction' };
  if (o.tsUtc == null) return { reason: 'no_timestamp' };
  if (!Number.isFinite(o.tsUtc)) return { reason: 'timestamp_invalid' };
  if (o.offsetMin == null) return { reason: 'no_utc_offset' };
  if (!Number.isInteger(o.offsetMin)) return { reason: 'utc_offset_invalid' };
  const local = o.tsUtc + o.offsetMin * MIN, label = localDate(local - config.night.labelShiftHours * 36e5);
  if (o.sleepSessionId) {
    const ls = labels || sessionLabels([o], config);
    if (ls.outliers?.has(o)) return { reason: 'session_timing_outlier' };
    return { night: ls.get(sessionId(o)) ?? label, windowSource: 'sleep_session', session: o.sleepSessionId };
  }
  if (!inWindow(local, config.night.fallbackWindow)) return { reason: 'outside_fallback_window' };
  return { night: label, windowSource: 'config_fallback_window' };
}

/**
 * Nightly reports. observations: accepted observations with `id`, `seq` (ingestion order), optional `excludedBy`
 * (a researcher correction) and `ingestedAt`. annotations: effective annotations (see cycles.effectiveAnnotations).
 */
export function nightlyReports(observations, annotations = [], config = CONFIG) {
  const groups = new Map(), unplaced = {}, labels = sessionLabels(observations, config);
  for (const o of observations) {
    const p = placeNight(o, config, labels);
    if (!p.night) { unplaced[p.reason] = (unplaced[p.reason] || 0) + 1; continue; }
    const k = `${p.night}#${streamKey(o)}`;
    if (!groups.has(k)) groups.set(k, { night: p.night, key: streamKey(o), windowSource: p.windowSource, obs: [] });
    groups.get(k).obs.push(o);
  }
  const confByDate = new Map();
  for (const a of annotations) if (['illness', 'fever', 'disrupted_sleep', 'travel', 'device_change'].includes(a.type) && a.value === 'yes') (confByDate.get(a.date) || confByDate.set(a.date, []).get(a.date)).push(a.type);
  // One malformed group must not take down the whole analysis: it is reported as unusable with a reason.
  const safeReport = g => { try { return report(g, confByDate.get(g.night) || [], config); } catch {
    const o0 = g.obs[0];
    return { night: g.night, streamKey: g.key, stream: streamOf(o0), window: { source: g.windowSource, startUtc: null, endUtc: null, utcOffsetsMin: [], tzNames: [] },
      counts: { total: g.obs.length, valid: 0, excluded: { processing_error: g.obs.length }, outOfOrder: 0, implausibleJumps: 0 }, coverageMinutes: null, maxGapMinutes: null,
      flags: ['processing_error'], confounders: [], unrecognisedSourceFlags: [], features: null, method: FEATURE_METHOD, dataQuality: { level: 'insufficient', reasons: ['processing_error'], about: 'measurement quality only, not biological inference' } };
  } };
  const reports = [...groups.values()].map(safeReport).sort((a, b) => a.night.localeCompare(b.night) || a.streamKey.localeCompare(b.streamKey));
  // Device / firmware transitions between consecutive nights of the same site and kind.
  const last = new Map();
  for (const r of reports) {
    const fam = `${r.stream.site}|${r.stream.kind}`, prev = last.get(fam);
    if (prev && (prev.stream.serial !== r.stream.serial || prev.stream.model !== r.stream.model)) r.flags.push('device_change_since_previous_night');
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
  // Each sample covers [start, end): its explicit end if valid and within the maximum interval, otherwise start + its
  // sampling interval capped at the maximum (issue 3e reported against 21317c5). For fallback-window nights the union
  // is clipped to that night's window, so coverage can never exceed the window.
  const maxMs = config.limits.maxSamplingIntervalS * 1e3;
  const iv = candidates.filter(o => Number.isFinite(o.tsUtc)).map(o => {
    const si = Number(o.device?.samplingIntervalS);
    const end = Number.isFinite(o.endUtc) && o.endUtc > o.tsUtc && o.endUtc - o.tsUtc <= maxMs ? o.endUtc : Number.isFinite(si) && si > 0 ? o.tsUtc + Math.min(si * 1e3, maxMs) : null;
    return [o.tsUtc, end];
  });
  if (g.windowSource === 'config_fallback_window' && iv.length) {
    const off = o0.offsetMin * MIN, w = config.night.fallbackWindow, wStart = Date.parse(`${g.night}T${w.start}:00Z`) - off;
    const wEnd = Date.parse(`${g.night}T${w.end}:00Z`) - off + (hhmm(w.end) <= hhmm(w.start) ? 864e5 : 0);
    for (const x of iv) { x[0] = Math.max(x[0], wStart); if (x[1] != null) x[1] = Math.min(x[1], wEnd); }
    for (let k = iv.length - 1; k >= 0; k--) if (iv[k][1] != null && iv[k][1] <= iv[k][0]) iv.splice(k, 1);
  }
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
    stream: streamOf(o0),
    window: { source: g.windowSource, startUtc: times.length ? new Date(Math.min(...times)).toISOString() : null, endUtc: times.length ? new Date(Math.max(...iv.map(x => x[1] ?? x[0]))).toISOString() : null, utcOffsetsMin: offsets, tzNames },
    counts: { total: g.obs.length, valid: vals.length, excluded, outOfOrder, implausibleJumps: jumps },
    coverageMinutes: coverage, maxGapMinutes: maxGap == null ? null : Math.round(maxGap), flags, confounders: [...new Set(confounders)], unrecognisedSourceFlags: [...unrecognised],
    features: vals.length ? { median: r3(quantile(vals, 0.5)), mad: r3(mad(vals)), p25: r3(quantile(vals, 0.25)), p75: r3(quantile(vals, 0.75)), unit: 'degC' } : null,
    method: vendor ? 'vendor_nightly_passthrough-1.0.0' : FEATURE_METHOD,
    dataQuality: { level, reasons, about: 'measurement quality only, not biological inference' },
  };
}
