// Wearable data: adapter interface, normalisation and nightly summaries.
//
// HONESTY RULES
//  • A watch does not detect bleeding. Nothing here creates, ends or edits a period.
//  • Wrist SKIN temperature is not core or basal body temperature and is not a hormone measurement.
//  • Values are labelled "raw" or "vendor-derived" exactly as the device reports them.
//  • A missing night stays missing. Nothing is interpolated, and a gap is shown as "No data".
//  • Source, model, firmware, units, timestamps and quality flags are kept with every summary.
//  • Only nightly summaries are stored (data minimisation). Raw samples are discarded after summarising.
//
// ADAPTER CONTRACT (what any real SDK integration must provide; see docs/wearable-sdk-requirements.md)
//   id, displayName, verified (true only after the checks in that document pass)
//   capabilities() → { skinTemp, heartRate, hrv, breathing } as 'raw' | 'vendor_derived' | false
//   connect() / disconnect()
//   fetchPackets({ from, to }) → Packet[] where Packet =
//     { deviceId, model, firmware, metric: 'skin_temp'|'heart_rate'|'hrv_rmssd'|'breathing_rate',
//       value, unit: 'degC'|'degF'|'bpm'|'ms'|'brpm', tStart, tEnd (epoch ms, UTC),
//       tzOffsetMin (device's UTC offset when recorded), kind: 'raw'|'vendor_derived',
//       sleepSessionId (the source's identifier of the sleep period the reading belongs to),
//       sleepMain (true only when the SOURCE classifies that period as the person's main sleep),
//       vendorQuality?: 'good'|'poor'|'off_wrist', seq? }
//   Overnight extraction contract (issue 2 reproduced in 29780c5): a nightly summary is built ONLY from readings
//   the source attributes to a verified main-sleep session. There is no built-in sleep window: readings without
//   sleep information are quarantined (`no_sleep_context`), naps are not used (`not_main_sleep`), and a
//   shift worker's daytime main sleep counts like any other. Whether a vendor's sleep classification is reliable
//   must be verified per device (docs/wearable-sdk-requirements.md). Until a real SDK provides it, no night exists.
import { CycleError } from './model.js';

export const METRICS = {
  skin_temp: { label: 'Wrist skin temperature', unit: 'degC', min: 25, max: 40, note: 'Skin temperature at the wrist. Not core body temperature.' },
  heart_rate: { label: 'Heart rate', unit: 'bpm', min: 25, max: 220 },
  hrv_rmssd: { label: 'Heart rate variability (RMSSD)', unit: 'ms', min: 1, max: 300 },
  breathing_rate: { label: 'Breathing rate', unit: 'brpm', min: 4, max: 40 },
};
// minCoverageMin, minSamples, maxSampleMin and EARLIEST are placeholders that need device evidence
// (docs/wearable-sdk-requirements.md). EARLIEST only rejects obviously wrong clocks (e.g. epoch 0).
export const NIGHT_PARAMS = Object.freeze({ minCoverageMin: 180, minSamples: 6, maxSampleMin: 60 });
const EARLIEST = Date.UTC(2015, 0, 1);
/* Time-zone offsets (issue 3 reproduced in 29780c5): a whole number of minutes, a multiple of 15, within
   UTC−12:00…UTC+14:00 — the range of real civil time zones (not a physiological threshold). Anything else is
   quarantined as `tz_invalid` and never used to compute a date. */
export const validTzOffset = x => typeof x === 'number' && Number.isInteger(x) && x >= -720 && x <= 840 && x % 15 === 0;
const KINDS = ['raw', 'vendor_derived'];
const kindOf = p => (KINDS.includes(p.kind) ? p.kind : 'unknown'); // never defaults to raw (issue 1)

/** Why a packet's timestamps can't be trusted, or null (issue 6 reproduced in 0f26696: tEnd = Infinity was accepted). */
function timestampProblem(p, now, params = NIGHT_PARAMS) {
  if (!Number.isFinite(p.tStart) || !Number.isFinite(p.tEnd)) return 'bad_timestamp';
  if (p.tEnd <= p.tStart) return 'bad_timestamp';                   // reversed or zero-length
  if (p.tStart < EARLIEST || p.tEnd > now + 5 * 60e3) return 'bad_timestamp'; // implausibly old, or in the future
  if (p.tEnd - p.tStart > params.maxSampleMin * 60e3) return 'bad_duration';
  return null;
}
/** Total minutes covered by the UNION of [tStart, tEnd) intervals, so overlapping readings are not counted twice. */
function unionMinutes(rs) {
  let total = 0, curS = null, curE = null;
  for (const r of [...rs].sort((a, b) => a.tStart - b.tStart)) {
    if (curE == null || r.tStart > curE) { if (curE != null) total += curE - curS; curS = r.tStart; curE = r.tEnd; }
    else curE = Math.max(curE, r.tEnd);
  }
  if (curE != null) total += curE - curS;
  return Math.round(total / 60e3);
}

/* ---------- Normalisation ---------- */
export function normalise(packets, { now = Date.now() } = {}) {
  const seen = new Map(), out = [];
  const stats = { received: packets.length, duplicates: 0, conflicts: 0, invalid: 0, outOfRange: 0, badTimestamp: 0, offWrist: 0, unknownMetric: 0 };
  for (const p of packets) { try { // one malformed packet must never stop the batch (issue 3)
    const m = METRICS[p?.metric];
    if (!m) { stats.unknownMetric++; continue; }
    const key = `${p.deviceId}|${p.metric}|${p.tStart}`;
    if (seen.has(key)) {
      // Issue 7 reproduced in 0f26696: only an EXACT resend is a duplicate. If only the quality flag changed, keep
      // the worse quality (conservative, either arrival order). Any other change is a conflict and is excluded.
      const prev = seen.get(key), q = p.vendorQuality || null;
      const sameCore = Object.is(prev.originalValue, p.value) && prev.originalUnit === p.unit && Object.is(prev.tEnd, p.tEnd) && prev.firmware === p.firmware &&
        prev.model === p.model && Object.is(prev.originalTz ?? null, p.tzOffsetMin ?? null) && prev.kind === kindOf(p) && prev.sleepSessionId === (p.sleepSessionId ?? null) && prev.sleepMain === (p.sleepMain === true);
      if (sameCore && q === prev.vendorQuality) { stats.duplicates++; continue; }
      if (sameCore) {
        if (q === 'off_wrist' && !prev.flags.includes('off_wrist')) { prev.flags.push('off_wrist'); stats.offWrist++; }
        if (q === 'poor' && !prev.flags.includes('vendor_poor')) prev.flags.push('vendor_poor');
        if (!prev.flags.includes('quality_changed')) prev.flags.push('quality_changed');
        stats.qualityChanged = (stats.qualityChanged || 0) + 1; continue;
      }
      if (!prev.flags.includes('conflict')) prev.flags.push('conflict');
      stats.conflicts++; continue;
    }
    const flags = [];
    let value = Number(p.value), unit = p.unit;
    if (!Number.isFinite(value)) { flags.push('invalid'); stats.invalid++; value = null; }
    if (value != null && p.metric === 'skin_temp' && unit === 'degF') { value = +((value - 32) * 5 / 9).toFixed(3); unit = 'degC'; }
    if (value != null && unit !== m.unit) { flags.push('unit_unknown'); stats.invalid++; value = null; }
    if (value != null && (value < m.min || value > m.max)) { flags.push('out_of_range'); stats.outOfRange++; }
    const tsProblem = timestampProblem(p, now);
    if (tsProblem) { flags.push(tsProblem); stats.badTimestamp++; }
    if (p.vendorQuality === 'off_wrist') { flags.push('off_wrist'); stats.offWrist++; }
    if (p.vendorQuality === 'poor') flags.push('vendor_poor');
    if (p.tzOffsetMin == null) flags.push('tz_unknown'); // audit 3.3: without the device's offset the night can't be assigned; never assumed UTC
    else if (!validTzOffset(p.tzOffsetMin)) { flags.push('tz_invalid'); stats.tzInvalid = (stats.tzInvalid || 0) + 1; }
    const kind = kindOf(p); if (kind === 'unknown') flags.push('kind_unknown');
    if (typeof p.sleepSessionId !== 'string' || !p.sleepSessionId) flags.push('no_sleep_context');
    else if (p.sleepMain !== true) flags.push('not_main_sleep');
    const r = { deviceId: p.deviceId, model: p.model, firmware: p.firmware, metric: p.metric, value, unit, originalValue: p.value, originalUnit: p.unit,
      tStart: p.tStart, tEnd: p.tEnd, tzOffsetMin: validTzOffset(p.tzOffsetMin) ? p.tzOffsetMin : null, originalTz: p.tzOffsetMin ?? null, kind, originalKind: p.kind ?? null,
      sleepSessionId: typeof p.sleepSessionId === 'string' ? p.sleepSessionId : null, sleepMain: p.sleepMain === true, vendorQuality: p.vendorQuality || null, flags };
    seen.set(key, r); out.push(r);
  } catch { stats.malformed = (stats.malformed || 0) + 1; } }
  return { readings: out, stats };
}
// Flags that exclude a reading from every inference. 'vendor_poor' is excluded (issue 1 reproduced in 80ea40f): we
// have no clinically validated policy for using readings the device itself marks as poor quality, so they are
// never used. Using them would need device-specific validation against a reference (docs/wearable-sdk-requirements.md).
export const EXCLUDING = ['invalid', 'out_of_range', 'bad_timestamp', 'bad_duration', 'off_wrist', 'vendor_poor', 'conflict', 'unit_unknown', 'quality_changed', 'tz_unknown', 'tz_invalid', 'kind_unknown', 'no_sleep_context', 'not_main_sleep'];
// Readings that can't be placed in a verified sleep session or a valid local date are quarantined before grouping.
const UNGROUPABLE = ['bad_timestamp', 'bad_duration', 'tz_unknown', 'tz_invalid', 'no_sleep_context', 'not_main_sleep'];
export const isUsable = r => r.value != null && !r.flags.some(f => EXCLUDING.includes(f));
const rejectionReasons = rs => {
  const out = {};
  for (const r of rs) { if (isUsable(r)) continue; const why = r.value == null && !r.flags.some(f => EXCLUDING.includes(f)) ? ['no_value'] : r.flags.filter(f => EXCLUDING.includes(f)); for (const f of why) out[f] = (out[f] || 0) + 1; }
  return out;
};

/** Label for a sleep session: the local date of its first reading minus 12 h (a labelling convention so a session
 *  starting after midnight is filed with the evening before; it is not a sleep window). Null if the offset is invalid. */
export function nightOf(r) {
  if (!validTzOffset(r.tzOffsetMin) || !Number.isFinite(r.tStart)) return null;
  const local = r.tStart + r.tzOffsetMin * 60e3 - 12 * 3600e3;
  return new Date(local).toISOString().slice(0, 10);
}

/** One summary per verified main-sleep session × source identity (device, model, firmware) × metric × measurement
 *  kind. Incompatible kinds and sources are never pooled (issue 1 reproduced in 29780c5). Never fills gaps.
 *  The returned array has a `quarantined` property: readings that could not be placed, by reason. */
export function summariseNights(readings, params = NIGHT_PARAMS) {
  const groups = new Map(), quarantined = {};
  for (const r of readings) {
    const bad = r.flags.filter(f => UNGROUPABLE.includes(f));
    if (bad.length) { for (const f of bad) quarantined[f] = (quarantined[f] || 0) + 1; continue; }
    const k = JSON.stringify([r.sleepSessionId, r.deviceId, r.model, r.firmware, r.metric, r.kind]);
    if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r);
  }
  const out = [];
  for (const [k, rs] of groups) {
    const [sleepSessionId, deviceId, model, firmware, metric, kind] = JSON.parse(k);
    const night = nightOf([...rs].sort((a, b) => a.tStart - b.tStart)[0]);
    const good = rs.filter(isUsable).sort((a, b) => a.tStart - b.tStart);
    const coverageMin = unionMinutes(good);
    const tzs = [...new Set(rs.map(r => r.tzOffsetMin))];
    const vals = good.map(r => r.value).sort((a, b) => a - b);
    const enough = good.length >= params.minSamples && coverageMin >= params.minCoverageMin;
    const med = vals.length ? (vals.length % 2 ? vals[vals.length >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
    out.push({ night, sleepSessionId, deviceId, model, firmware, metric, unit: METRICS[metric].unit, kind,
      status: enough ? 'ok' : good.length ? 'insufficient_wear' : 'no_usable_data',
      value: enough ? +med.toFixed(3) : null, samples: good.length, rejected: rs.length - good.length, rejectedBy: rejectionReasons(rs), coverageMin,
      firstAt: good[0]?.tStart ?? rs[0].tStart, lastAt: good.at(-1)?.tEnd ?? rs.at(-1).tEnd, tzOffsetMin: tzs.length === 1 ? tzs[0] : tzs,
      flags: [...new Set(rs.flatMap(r => r.flags))] });
  }
  const result = markTravel(out.sort((a, b) => a.night.localeCompare(b.night) || a.metric.localeCompare(b.metric)));
  result.quarantined = quarantined;
  return result;
}
function markTravel(nights) {
  let prev = null, prevDev = null, prevModel = null, prevFw = null, first = true;
  for (const n of nights.filter(x => x.metric === 'skin_temp')) {
    const tz = Array.isArray(n.tzOffsetMin) ? null : n.tzOffsetMin;
    if (Array.isArray(n.tzOffsetMin) || (prev != null && tz !== prev)) n.flags.push('tz_change');
    if (!first && (n.deviceId !== prevDev || n.model !== prevModel)) n.flags.push('device_change');
    if (!first && n.deviceId === prevDev && n.model === prevModel && n.firmware !== prevFw) n.flags.push('firmware_change');
    prev = tz ?? prev; prevDev = n.deviceId; prevModel = n.model; prevFw = n.firmware; first = false;
  }
  return nights;
}

/* Merge new summaries into stored ones (issue 5 reproduced in 80ea40f):
   • an IDENTICAL resync keeps the night as it is, including its first-known `syncedAt`;
   • a MATERIAL change becomes the current version, and the earlier one is kept in `prior` (with its own syncedAt),
     so a historical view can still show what was known then. Withdrawing wearable consent deletes all of it. */
const sortKeys = v => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v);
const material = ({ syncedAt, prior, ...rest }) => JSON.stringify(sortKeys(rest));
const withoutPrior = ({ prior, ...rest }) => rest;
/* Records are matched by the SOURCE identity of the sleep session (issue 3 reported against b3d9589): the session ID
   plus device, model, firmware, metric and kind. The night label is derived from the session's first reading, so a
   corrected session can move to another label; matching on the label would have created a second record instead of
   a new version. Only records without a session ID (stored before sessions were required) fall back to the label. */
export const sessionKey = n => JSON.stringify([n.sleepSessionId ? `session:${n.sleepSessionId}` : `night:${n.night}`, n.deviceId, n.model, n.firmware, n.metric, n.kind]);
export function mergeNights(stored, fresh, { at = new Date().toISOString() } = {}) {
  const k = sessionKey;
  const m = new Map(stored.map(n => [k(n), n]));
  for (const n of fresh) {
    const old = m.get(k(n));
    if (!old) { m.set(k(n), { ...withoutPrior(n), syncedAt: n.syncedAt || at }); continue; }
    if (material(old) === material(n)) continue; // identical resync: keep the first-known time
    m.set(k(n), { ...withoutPrior(n), syncedAt: at, prior: [...(old.prior || []), withoutPrior(old)] });
  }
  return [...m.values()].sort((a, b) => a.night.localeCompare(b.night) || a.metric.localeCompare(b.metric));
}

/** Night-by-night view for display: every night in [from, to], with explicit "no data" nights. */
export function nightTable(nights, from, to, metric = 'skin_temp') {
  const by = new Map(nights.filter(n => n.metric === metric).map(n => [n.night, n])), out = [];
  for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const night = d.toISOString().slice(0, 10);
    out.push(by.get(night) || { night, metric, status: 'no_data', value: null });
  }
  return out;
}

/** Continuous segments of one source identity (device, model, firmware) and measurement kind. Analyses never mix segments. */
export function segments(nights, metric = 'skin_temp') {
  const out = []; let cur = null;
  for (const n of nights.filter(x => x.metric === metric)) {
    const id = `${n.deviceId}|${n.model}|${n.firmware}|${n.kind}`;
    if (!cur || cur.id !== id) { cur = { id, deviceId: n.deviceId, model: n.model, firmware: n.firmware, nights: [] }; out.push(cur); }
    cur.nights.push(n);
  }
  return out;
}

/* ---------- Adapters ---------- */
export class WearableAdapter {
  get id() { return 'base'; }
  get verified() { return false; }
  capabilities() { return { skinTemp: false, heartRate: false, hrv: false, breathing: false }; }
  async connect() { throw new CycleError('NOT_IMPLEMENTED'); }
  async disconnect() {}
  async fetchPackets() { throw new CycleError('NOT_IMPLEMENTED'); }
}

/** SWL DS07: placeholder only. Nothing about it is verified. It refuses to connect. */
export class SwlDs07Adapter extends WearableAdapter {
  get id() { return 'swl-ds07'; }
  get displayName() { return 'SWL DS07 (not available)'; }
  get status() { return 'Unverified. We have no SDK or documentation confirming overnight skin-temperature sampling, timestamps, units, firmware reporting or data access. Not connected.'; }
  async connect() { throw new CycleError('NOT_VERIFIED'); }
}

/* Seeded random numbers so synthetic data is reproducible. */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const gauss = r => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/**
 * Mock device producing SYNTHETIC packets. Its temperature model is invented for software testing only:
 * a baseline plus noise, with an optional step rise after a synthetic "event" day. It says nothing about
 * real physiology or any real device.
 * @param opts.highFrom(nightDate) → true on nights after the synthetic event (default: never)
 */
export class MockWearable extends WearableAdapter {
  constructor(opts = {}) {
    super();
    this.o = { seed: 1, deviceId: 'mock-001', model: 'Mock Band (synthetic)', firmware: 'mock-1.0', base: 33.8, noise: 0.12, rise: 0.3, tzOffsetMin: 0,
      pMissing: 0.08, pPartial: 0.06, pDuplicate: 0.1, pGlitch: 0.03, unit: 'degC', highFrom: () => false, deviceChanges: [], tzChanges: [], ...opts };
    this.connected = false;
  }
  get id() { return 'mock'; }
  get displayName() { return 'Demo device (synthetic data)'; }
  get verified() { return false; }
  capabilities() { return { skinTemp: 'raw', heartRate: 'raw', hrv: 'vendor_derived', breathing: false }; }
  async connect() { this.connected = true; return { deviceId: this.o.deviceId, model: this.o.model, firmware: this.o.firmware }; }
  async disconnect() { this.connected = false; }
  async fetchPackets({ from, to }) { if (!this.connected) throw new CycleError('NOT_CONNECTED'); return this.packets(from, to); }
  /** Synchronous generator, also used by the evaluation harness. Nights are local evening dates. */
  packets(from, to) {
    const r = rng(this.o.seed), out = [];
    for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const night = d.toISOString().slice(0, 10);
      const dev = [...this.o.deviceChanges].reverse().find(c => night >= c.from) || this.o;
      const tz = [...this.o.tzChanges].reverse().find(c => night >= c.from)?.tzOffsetMin ?? this.o.tzOffsetMin;
      const u = r(); if (u < this.o.pMissing) continue; // not worn
      const samples = u < this.o.pMissing + this.o.pPartial ? 8 : 48; // 10-min samples; partial nights are short
      const level = (dev.base ?? this.o.base) + (this.o.highFrom(night) ? this.o.rise : 0) + gauss(r) * 0.05;
      const startLocal = Date.parse(night + 'T23:00:00Z');
      for (let i = 0; i < samples; i++) {
        const tStart = startLocal + i * 600e3 - tz * 60e3;
        let v = level + gauss(r) * this.o.noise; if (r() < this.o.pGlitch) v = r() < 0.5 ? 18 + r() * 3 : NaN;
        const unit = dev.unit ?? this.o.unit, value = unit === 'degF' && Number.isFinite(v) ? +(v * 9 / 5 + 32).toFixed(2) : Number.isFinite(v) ? +v.toFixed(3) : v;
        // Synthetic sleep-session labels: the mock declares every night as one main-sleep session. A real SDK must
        // supply and verify these (docs/wearable-sdk-requirements.md); nothing here validates sleep detection.
        const pk = { deviceId: dev.deviceId ?? this.o.deviceId, model: dev.model ?? this.o.model, firmware: dev.firmware ?? this.o.firmware, metric: 'skin_temp', value, unit, tStart, tEnd: tStart + 600e3, tzOffsetMin: tz, kind: 'raw',
          sleepSessionId: `${dev.deviceId ?? this.o.deviceId}-${night}`, sleepMain: true, seq: out.length };
        out.push(pk); if (r() < this.o.pDuplicate) out.push({ ...pk });
        if (i % 6 === 0) out.push({ ...pk, metric: 'heart_rate', value: Math.round(58 + gauss(r) * 4), unit: 'bpm' });
        if (i % 12 === 0) out.push({ ...pk, metric: 'hrv_rmssd', value: Math.round(45 + gauss(r) * 8), unit: 'ms', kind: 'vendor_derived' });
      }
    }
    return out;
  }
}
export const ADAPTERS = { mock: () => new MockWearable(), 'swl-ds07': () => new SwlDs07Adapter() };
