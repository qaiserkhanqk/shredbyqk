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
//       vendorQuality?: 'good'|'poor'|'off_wrist', seq? }
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
  for (const p of packets) {
    const m = METRICS[p.metric];
    if (!m) { stats.unknownMetric++; continue; }
    const key = `${p.deviceId}|${p.metric}|${p.tStart}`;
    if (seen.has(key)) {
      // Issue 7 reproduced in 0f26696: only an EXACT resend is a duplicate. If only the quality flag changed, keep
      // the worse quality (conservative, either arrival order). Any other change is a conflict and is excluded.
      const prev = seen.get(key), q = p.vendorQuality || null;
      const sameCore = Object.is(prev.originalValue, p.value) && prev.originalUnit === p.unit && Object.is(prev.tEnd, p.tEnd) && prev.firmware === p.firmware &&
        prev.model === p.model && (prev.tzOffsetMin ?? null) === (p.tzOffsetMin ?? null) && prev.kind === (p.kind === 'vendor_derived' ? 'vendor_derived' : 'raw');
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
    const r = { deviceId: p.deviceId, model: p.model, firmware: p.firmware, metric: p.metric, value, unit, originalValue: p.value, originalUnit: p.unit,
      tStart: p.tStart, tEnd: p.tEnd, tzOffsetMin: p.tzOffsetMin ?? null, kind: p.kind === 'vendor_derived' ? 'vendor_derived' : 'raw', vendorQuality: p.vendorQuality || null, flags };
    seen.set(key, r); out.push(r);
  }
  return { readings: out, stats };
}
export const isUsable = r => r.value != null && !r.flags.some(f => ['invalid', 'out_of_range', 'bad_timestamp', 'bad_duration', 'off_wrist', 'conflict', 'unit_unknown', 'quality_changed'].includes(f));

/** The "night" a reading belongs to: the local date of the evening it started (local time − 12 h). */
export function nightOf(r) {
  const local = r.tStart + (r.tzOffsetMin ?? 0) * 60e3 - 12 * 3600e3;
  return new Date(local).toISOString().slice(0, 10);
}

/** One summary per night × device × metric. Never fills gaps. */
export function summariseNights(readings, params = NIGHT_PARAMS) {
  const groups = new Map();
  for (const r of readings) {
    if (r.flags.includes('bad_timestamp') || r.flags.includes('bad_duration')) continue;
    const k = `${nightOf(r)}|${r.deviceId}|${r.firmware}|${r.metric}`;
    if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r);
  }
  const out = [];
  for (const [k, rs] of groups) {
    const [night, deviceId, firmware, metric] = k.split('|');
    const good = rs.filter(isUsable).sort((a, b) => a.tStart - b.tStart);
    const coverageMin = unionMinutes(good);
    const tzs = [...new Set(rs.map(r => r.tzOffsetMin))];
    const vals = good.map(r => r.value).sort((a, b) => a - b);
    const enough = good.length >= params.minSamples && coverageMin >= params.minCoverageMin;
    const med = vals.length ? (vals.length % 2 ? vals[vals.length >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
    out.push({ night, deviceId, model: rs[0].model, firmware, metric, unit: METRICS[metric].unit, kind: rs[0].kind,
      status: enough ? 'ok' : good.length ? 'insufficient_wear' : 'no_usable_data',
      value: enough ? +med.toFixed(3) : null, samples: good.length, rejected: rs.length - good.length, coverageMin,
      firstAt: good[0]?.tStart ?? rs[0].tStart, lastAt: good.at(-1)?.tEnd ?? rs.at(-1).tEnd, tzOffsetMin: tzs.length === 1 ? tzs[0] : tzs,
      flags: [...new Set(rs.flatMap(r => r.flags))] });
  }
  return markTravel(out.sort((a, b) => a.night.localeCompare(b.night) || a.metric.localeCompare(b.metric)));
}
function markTravel(nights) {
  let prev = null, prevDev = null, prevFw = null, first = true;
  for (const n of nights.filter(x => x.metric === 'skin_temp')) {
    const tz = Array.isArray(n.tzOffsetMin) ? null : n.tzOffsetMin;
    if (Array.isArray(n.tzOffsetMin) || (prev != null && tz !== prev)) n.flags.push('tz_change');
    if (!first && n.deviceId !== prevDev) n.flags.push('device_change');
    if (!first && n.deviceId === prevDev && n.firmware !== prevFw) n.flags.push('firmware_change');
    prev = tz ?? prev; prevDev = n.deviceId; prevFw = n.firmware; first = false;
  }
  return nights;
}

/** Merge new summaries into stored ones (re-syncing a night replaces it, never duplicates it). */
export function mergeNights(stored, fresh, { at = new Date().toISOString() } = {}) {
  const k = n => `${n.night}|${n.deviceId}|${n.firmware}|${n.metric}`;
  const m = new Map(stored.map(n => [k(n), n])); for (const n of fresh) m.set(k(n), { ...n, syncedAt: n.syncedAt || at }); // when it became known
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

/** Continuous segments of one device + firmware. Analyses never mix segments. */
export function segments(nights, metric = 'skin_temp') {
  const out = []; let cur = null;
  for (const n of nights.filter(x => x.metric === metric)) {
    const id = `${n.deviceId}|${n.firmware}`;
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
        const pk = { deviceId: dev.deviceId ?? this.o.deviceId, model: dev.model ?? this.o.model, firmware: dev.firmware ?? this.o.firmware, metric: 'skin_temp', value, unit, tStart, tEnd: tStart + 600e3, tzOffsetMin: tz, kind: 'raw', seq: out.length };
        out.push(pk); if (r() < this.o.pDuplicate) out.push({ ...pk });
        if (i % 6 === 0) out.push({ ...pk, metric: 'heart_rate', value: Math.round(58 + gauss(r) * 4), unit: 'bpm' });
        if (i % 12 === 0) out.push({ ...pk, metric: 'hrv_rmssd', value: Math.round(45 + gauss(r) * 8), unit: 'ms', kind: 'vendor_derived' });
      }
    }
    return out;
  }
}
export const ADAPTERS = { mock: () => new MockWearable(), 'swl-ds07': () => new SwlDs07Adapter() };
