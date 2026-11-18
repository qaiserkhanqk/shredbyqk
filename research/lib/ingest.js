// Ingestion: schema validation, unit normalisation, duplicate detection and quarantine. Pure: `preview()` returns what
// WOULD be stored; the store commits a preview in one transaction. Nothing is silently dropped: every row is either
// accepted, recognised as an exact duplicate, or quarantined with reason codes and its original cells kept.
//
// The participant is NEVER taken from the filename. Every row must carry `participant_ref`, and it must equal the
// participant the import was started for; anything else is rejected.
import { parseCSV, parseJSONRecords, ParseError } from './csv.js';
import { parseUnit, normalise } from './units.js';
import { CONFIG, configHash } from './config.js';
import { hashJSON, sha256 } from './hash.js';

export const INGEST_VERSION = 'ingest-1.0.0';
export const SITES = ['wrist', 'finger', 'oral', 'ambient', 'other'];
export const KINDS = { skin_temperature: ['wrist', 'finger', 'other'], basal_body_temperature: ['oral', 'other'], ambient_temperature: ['ambient'] };
export const DERIVATIONS = ['raw', 'vendor_derived'];
export const AGGREGATIONS = ['sample', 'nightly_value'];
export const ANNOTATION_TYPES = {
  bleeding: ['period_start', 'period', 'spotting', 'none'],
  lh_test: ['positive', 'negative', 'invalid'],
  illness: ['yes', 'no'], fever: ['yes', 'no'], disrupted_sleep: ['yes', 'no'], travel: ['yes', 'no'], device_change: ['yes', 'no'],
  hormonal_medication: ['yes', 'no'], // only with the separate `hormonal_context` consent
};
const REF = /^[A-Za-z0-9_-]{4,64}$/;
// Free-text fields are restricted to identifier-like formats, so imported data can never carry sentences into the UI.
const FORMATS = { device_manufacturer: /^[A-Za-z0-9 ._:+\/-]{1,64}$/, device_model: /^[A-Za-z0-9 ._:+\/-]{1,64}$/, firmware: /^[A-Za-z0-9 ._:+\/-]{1,64}$/, sampling_config: /^[A-Za-z0-9 ._:+=\/-]{1,64}$/,
  tz_name: /^[A-Za-z]+(?:[\/_+-][A-Za-z0-9]+)*$/, sleep_session_id: /^[A-Za-z0-9_.:-]{1,80}$/ };
const FLAG = /^[a-z0-9_]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

const str = v => (v == null ? '' : String(v).trim());
const num = v => { const s = str(v); if (s === '') return null; if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN; return Number(s); };
const isoMs = v => { const s = str(v); if (!s) return null; if (!ISO.test(s)) return NaN; const t = Date.parse(s); return Number.isFinite(t) ? t : NaN; };
const validDate = s => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
export const validOffset = m => Number.isInteger(m) && m % 15 === 0 && m >= -720 && m <= 840;

/** One observation row → { obs } | { quarantine: reasons[] } | { reject: reasons[] } */
export function validateObservation(r, { participantRef, config = CONFIG } = {}) {
  const reject = [], quarantine = [];
  const ref = str(r.participant_ref);
  if (!REF.test(ref)) reject.push('participant_ref_invalid'); else if (participantRef && ref !== participantRef) reject.push('participant_mismatch');
  const site = str(r.sensor_site), kind = str(r.measurement_kind), derivation = str(r.derivation), aggregation = str(r.aggregation);
  if (!SITES.includes(site)) reject.push('sensor_site_invalid');
  if (!(kind in KINDS)) reject.push('measurement_kind_invalid'); else if (SITES.includes(site) && !KINDS[kind].includes(site)) reject.push('site_kind_mismatch');
  if (!DERIVATIONS.includes(derivation)) reject.push('derivation_missing_or_invalid'); // never defaulted to raw
  if (!AGGREGATIONS.includes(aggregation)) reject.push('aggregation_invalid');
  if (aggregation === 'nightly_value' && derivation === 'raw') reject.push('nightly_value_must_be_vendor_derived');
  for (const [f, re] of Object.entries(FORMATS)) if (str(r[f]) && !re.test(str(r[f]))) reject.push(`field_format_invalid:${f}`);
  if (str(r.source_quality_flags) && !str(r.source_quality_flags).split(';').map(x => x.trim()).filter(Boolean).every(x => FLAG.test(x))) reject.push('field_format_invalid:source_quality_flags');
  const model = str(r.device_model), serial = str(r.device_serial_pseudonym);
  if (!model) reject.push('device_model_missing');
  if (!REF.test(serial)) reject.push('device_serial_pseudonym_invalid');
  const value = num(r.value);
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) reject.push('value_not_numeric');
  const precision = num(r.precision);
  if (Number.isNaN(precision) || (precision != null && precision <= 0)) reject.push('precision_invalid');
  const interval = num(r.sampling_interval_s);
  if (Number.isNaN(interval) || (interval != null && interval <= 0)) reject.push('sampling_interval_invalid');
  if (reject.length) return { reject };

  const ts = isoMs(r.timestamp_utc), end = isoMs(r.end_timestamp_utc);
  let nightLabel = str(r.night_label) || null;
  if (aggregation === 'nightly_value') { if (!nightLabel || !validDate(nightLabel)) quarantine.push('night_label_missing_or_invalid'); }
  else if (ts == null) quarantine.push('timestamp_missing');
  if (Number.isNaN(ts)) quarantine.push('timestamp_invalid');
  if (Number.isNaN(end)) quarantine.push('end_timestamp_invalid');
  if (Number.isFinite(ts) && Number.isFinite(end) && end <= ts) quarantine.push('end_not_after_start');
  const offStr = str(r.utc_offset_minutes), off = offStr === '' ? null : Number(offStr);
  if (off == null) { if (aggregation === 'sample') quarantine.push('utc_offset_missing'); }
  else if (!validOffset(off)) quarantine.push('utc_offset_invalid');
  const unitRaw = str(r.unit), unit = parseUnit(unitRaw);
  if (!unitRaw) quarantine.push('unit_missing'); else if (!unit) quarantine.push('unit_unrecognised'); // never guessed from the value
  let valueC = null, precisionC = null;
  if (unit) {
    ({ valueC, precisionC } = normalise(value, unit, precision));
    const b = config.bounds[kind];
    if (valueC < b.min || valueC > b.max) quarantine.push('out_of_bounds_for_kind');
  }
  const obs = {
    participantRef: ref, tsUtc: Number.isFinite(ts) ? ts : null, endUtc: Number.isFinite(end) ? end : null,
    offsetMin: off != null && validOffset(off) ? off : null, tzName: str(r.tz_name) || null,
    device: { manufacturer: str(r.device_manufacturer) || null, model, serial, firmware: str(r.firmware) || null, samplingIntervalS: interval, samplingConfig: str(r.sampling_config) || null },
    site, kind, derivation, aggregation, nightLabel,
    sourceValue: value, sourceUnit: unitRaw || null, valueC, precisionC,
    sourceFlags: str(r.source_quality_flags) ? str(r.source_quality_flags).split(';').map(x => x.trim()).filter(Boolean) : [],
    sleepSessionId: str(r.sleep_session_id) || null,
  };
  obs.obsKey = hashJSON({ p: ref, s: serial, site, kind, derivation, aggregation, ts: obs.tsUtc, end: obs.endUtc, n: nightLabel });
  obs.rowHash = hashJSON({ k: obs.obsKey, v: value, u: unitRaw, f: obs.sourceFlags, fw: obs.device.firmware, off: obs.offsetMin });
  return quarantine.length ? { quarantine, obs } : { obs };
}

/** One annotation row. Annotations are append-only: a correction is a new entry that `corrects` an earlier entry_id. */
export function validateAnnotation(r, { participantRef, consents = {} } = {}) {
  const reject = [];
  const ref = str(r.participant_ref);
  if (!REF.test(ref)) reject.push('participant_ref_invalid'); else if (participantRef && ref !== participantRef) reject.push('participant_mismatch');
  const entryId = str(r.entry_id), type = str(r.type), value = str(r.value), date = str(r.date), corrects = str(r.corrects) || null;
  if (!REF.test(entryId)) reject.push('entry_id_invalid');
  if (!(type in ANNOTATION_TYPES)) reject.push('type_invalid');
  else if (value !== 'retracted' && !ANNOTATION_TYPES[type].includes(value)) reject.push('value_invalid');
  if (value === 'retracted' && !corrects) reject.push('retraction_needs_corrects');
  if (!validDate(date)) reject.push('date_invalid');
  const rec = isoMs(r.recorded_at);
  if (rec == null || Number.isNaN(rec)) reject.push('recorded_at_missing_or_invalid');
  if (corrects && !REF.test(corrects)) reject.push('corrects_invalid');
  if (corrects && corrects === entryId) reject.push('self_correction'); // issue 8 reported against b3d9589
  if (type === 'hormonal_medication' && !consents.hormonal_context) reject.push('hormonal_context_not_consented');
  if (type === 'lh_test' && !consents.lh_tests) reject.push('lh_tests_not_consented');
  if (reject.length) return { reject };
  return { ann: { participantRef: ref, entryId, type, value, date, recordedAt: rec, corrects } };
}

export const annotationHash = a => hashJSON({ e: a.entryId, t: a.type, v: a.value, d: a.date, r: a.recordedAt, c: a.corrects });

/**
 * Preview an import without storing anything.
 * existing: { batchHashes:Set, obsRowHash:Map(obsKey→rowHash), entryHash:Map(entryId→hash), entryCorrects:Map(entryId→corrects) }
 */
export function preview(text, { format, recordType, participantRef, filename = '', existing = {}, consents = {}, config = CONFIG } = {}) {
  const sourceHash = sha256(String(text ?? ''));
  const base = { ingestVersion: INGEST_VERSION, configVersion: config.version, configHash: configHash(config), recordType, format, sourceHash,
    sourceFilenameHash: filename ? sha256(filename) : null, sourceExtension: (/\.([a-z0-9]{1,8})$/i.exec(filename)?.[1] || '').toLowerCase() || null };
  if (!['observations', 'annotations'].includes(recordType)) return { ...base, ok: false, error: 'record_type_invalid' };
  if (!['csv', 'json'].includes(format)) return { ...base, ok: false, error: 'format_invalid' };
  if (existing.batchHashes?.has(sourceHash)) return { ...base, ok: true, duplicateBatch: true, counts: { rows: 0, accepted: 0, duplicates: 0, quarantined: 0, rejected: 0 }, accepted: [], quarantined: [] };
  let rows;
  try { rows = format === 'csv' ? parseCSV(text, config.limits) : parseJSONRecords(text, config.limits); }
  catch (e) { if (e instanceof ParseError) return { ...base, ok: false, error: e.code, line: e.line }; throw e; }
  let accepted = []; const quarantined = [], seen = new Map(); let duplicates = 0, rejected = 0;
  for (const row of rows) {
    const raw = row.record ?? null;
    if (row.error) { quarantined.push({ line: row.line, reasons: [row.error], rejected: true, raw }); rejected++; continue; }
    if (recordType === 'observations') {
      const v = validateObservation(raw, { participantRef, config });
      if (v.reject) { quarantined.push({ line: row.line, reasons: v.reject, rejected: true, raw }); rejected++; continue; }
      const o = v.obs, prior = seen.get(o.obsKey) ?? existing.obsRowHash?.get(o.obsKey);
      if (prior != null && !v.quarantine) {
        if (prior === o.rowHash) { duplicates++; continue; }
        quarantined.push({ line: row.line, reasons: ['conflicting_duplicate'], raw, obs: o }); continue; // same reading, different value
      }
      if (v.quarantine) { quarantined.push({ line: row.line, reasons: v.quarantine, raw, obs: o }); continue; }
      seen.set(o.obsKey, o.rowHash); accepted.push({ line: row.line, ...o });
    } else {
      const v = validateAnnotation(raw, { participantRef, consents });
      // Issue 2 reported against b3d9589: a row whose content needs a consent the participant has not given is kept
      // only as a line number and reason codes. Its cells are NOT retained anywhere (saved preview, quarantine,
      // database or export).
      const unconsented = v.reject?.some(r => r === 'lh_tests_not_consented' || r === 'hormonal_context_not_consented');
      if (v.reject) { quarantined.push({ line: row.line, reasons: v.reject, rejected: true, raw: unconsented ? null : raw, ...(unconsented ? { redacted: 'content_not_retained_without_consent' } : {}) }); rejected++; continue; }
      const h = annotationHash(v.ann), prior = seen.get(v.ann.entryId) ?? existing.entryHash?.get(v.ann.entryId);
      if (prior != null) { if (prior === h) duplicates++; else quarantined.push({ line: row.line, reasons: ['entry_id_reused_with_different_content'], raw }); continue; }
      seen.set(v.ann.entryId, h); accepted.push({ line: row.line, ...v.ann, _raw: raw });
    }
  }
  if (recordType === 'annotations') {
    // Circular corrections (issue 8): follow `corrects` links through this file's entries and the stored ones
    // (existing.entryCorrects: entry_id → corrects). An entry whose chain returns to an entry already visited is
    // part of, or leads into, a loop; it is quarantined instead of stored.
    const links = new Map(existing.entryCorrects || []);
    for (const a of accepted) links.set(a.entryId, a.corrects);
    const loops = id => { const seenIds = new Set(); let cur = id; while (cur) { if (seenIds.has(cur)) return true; seenIds.add(cur); cur = links.get(cur); } return false; };
    const bad = new Set(accepted.filter(a => loops(a.entryId)).map(a => a.entryId));
    for (const a of accepted.filter(x => bad.has(x.entryId))) quarantined.push({ line: a.line, reasons: ['circular_correction'], raw: a._raw });
    accepted = accepted.filter(a => !bad.has(a.entryId));
    for (const a of accepted) delete a._raw;
  }
  return { ...base, ok: true, duplicateBatch: false, counts: { rows: rows.length, accepted: accepted.length, duplicates, quarantined: quarantined.length - rejected, rejected }, accepted, quarantined };
}
