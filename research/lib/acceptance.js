// Supplier acceptance test: runs a supplier's sample files through every item of research/docs/supplier-checklist.md
// that a file can show, and lists the items that need a written answer from the supplier and a review by us.
//
// Inputs are files in the DOCUMENTED observation format (research/docs/data-dictionary.md), i.e. the output of the
// adapter under test applied to the supplier's export, plus optional evidence files:
//   • a re-sync export (an interrupted / repeated sync of an overlapping period),
//   • reference-clock pairs, a wear log of known removal times, and bench readings from a reference thermometer.
// The pass criteria are the acceptance numbers already written in the checklist (10 consecutive nights on 3 or more
// people, at least 90% of worn nights good or limited, timestamps within 2 minutes, off-wrist flagged, firmware and
// time-zone changes visible, no duplicates on re-sync, units confirmed against a bench reference). No other tolerance
// is invented: bench differences are REPORTED for a person to judge.
//
// Passing means the files are TECHNICALLY usable by this platform. It says nothing about accuracy, clinical
// usefulness, or ovulation, and it does not change any adapter's status.
import { preview } from './ingest.js';
import { nightlyReports } from './quality.js';
import { parseCSV } from './csv.js';
import { CONFIG } from './config.js';
import { addDays } from './synth.js';

export const ACCEPTANCE_VERSION = 'supplier-acceptance-1.0.0';
export const CRITERIA = Object.freeze({ consecutiveNights: 10, minPeople: 3, minGoodOrLimitedShare: 0.9, maxClockErrorS: 120, minBenchPairs: 10 }); // from supplier-checklist.md
export const DISCLAIMER = 'Technical acceptance of the supplied files only: it shows whether this platform can use them. It is not evidence of measurement accuracy, clinical usefulness or suitability for any medical purpose, it does not detect or confirm ovulation, and it does not mark any device adapter as verified.';

const AUTOMATED = [
  ['files_parse_cleanly', 'Every row passes schema validation (no rejected or quarantined rows)'],
  ['identity_on_every_record', 'Device manufacturer, model, serial and firmware on every record'],
  ['utc_offset_on_every_record', 'UTC offset at recording time on every sample'],
  ['sampling_interval_declared', 'Sampling interval or measurement end time on every sample'],
  ['quality_flags_documented', 'Only quality flags the supplier documented appear'],
  ['nights_and_quality', `${CRITERIA.consecutiveNights} consecutive nights on ${CRITERIA.minPeople}+ people, ≥${CRITERIA.minGoodOrLimitedShare * 100}% of worn nights good or limited`],
  ['clock_within_2_minutes', `Device timestamps within ${CRITERIA.maxClockErrorS / 60} minutes of a reference clock`],
  ['off_wrist_flagged', 'Known off-wrist periods are flagged (or produce no samples)'],
  ['firmware_change_detected', 'A known firmware change is visible as a stream change'],
  ['time_zone_change_reflected', 'A known time-zone change is reflected in the UTC offsets'],
  ['units_confirmed_against_bench', 'Declared units agree with a bench reference thermometer'],
  ['resync_no_duplicates', 'Re-sync of an overlapping period produces no conflicting duplicates'],
];
const MANUAL = [
  ['sensor_specification', 'Sensor site, contact method, units, resolution and stated accuracy (with its conditions)'],
  ['vendor_processing', 'Any filtering, smoothing or gap-filling, and whether it can be disabled'],
  ['offline_storage', 'Retention on the device and the backfill window'],
  ['sdk_licence', 'SDK rights and licence for research use of health data, local processing, export and deletion'],
  ['data_ownership_and_cloud', 'Whether data passes through a vendor cloud; location, retention, processor terms, sub-processors, deletion'],
  ['platform_route', 'Web Bluetooth GATT profile, native SDK or server API; sandbox with test data'],
  ['vendor_validation_evidence', 'Vendor validation protocol, population and results (does not transfer to our use)'],
  ['change_control', 'Advance notice of firmware or algorithm changes; version pinning for studies'],
];

const result = (id, title, kind, status, detail, evidence = {}) => ({ id, title, kind, status, detail, evidence });
const toMs = v => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(String(v).trim()) ? t : NaN; };
const csvRows = text => parseCSV(String(text), CONFIG.limits).map(r => r.record).filter(Boolean);
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };
const round = (x, d = 3) => (x == null ? null : Number(x.toFixed(d)));
const reasonsCount = qs => { const out = {}; for (const q of qs) for (const r of q.reasons) out[r] = (out[r] || 0) + 1; return out; };
function longestRun(nights) {
  const s = [...new Set(nights)].sort(); let best = 0, cur = 0, prev = null;
  for (const n of s) { cur = prev && addDays(prev, 1) === n ? cur + 1 : 1; best = Math.max(best, cur); prev = n; }
  return best;
}

/**
 * profile: { synthetic?, device: {manufacturer, model, name?}, documentedFlags: [], offWristFlags: [],
 *            expect: { firmwareChange?: {ref, night}, timeZoneChange?: {ref, night, offsetMin} },
 *            answers: { <manual id>: { answer, source, reviewedBy?, reviewedOn? } } }
 * people:  [{ ref, format: 'csv'|'json', text }]   (one file per person, documented observation format)
 * resync:  { ref, format, text } | null            clock / wear / bench: CSV text | null (see the tool for columns)
 */
export function runAcceptance({ profile = {}, people = [], resync = null, clock = null, wear = null, bench = null, config = CONFIG }) {
  const items = [], P = {};
  const auto = (id, status, detail, evidence) => items.push(result(id, AUTOMATED.find(a => a[0] === id)[1], 'automated', status, detail, evidence));

  // Parse each person's export with the platform's own importer (nothing is stored).
  for (const p of people) {
    const pv = preview(p.text, { format: p.format || 'csv', recordType: 'observations', participantRef: p.ref, config });
    P[p.ref] = { pv, obs: pv.ok ? pv.accepted.map((o, i) => ({ ...o, id: i + 1, seq: i + 1 })) : [] };
  }
  const refs = Object.keys(P), allObs = refs.flatMap(r => P[r].obs), samples = allObs.filter(o => o.aggregation === 'sample');

  // 1. Schema
  {
    const failed = refs.filter(r => !P[r].pv.ok), quarantined = refs.flatMap(r => (P[r].pv.quarantined || []));
    const conflictsInFile = quarantined.filter(q => q.reasons.includes('conflicting_duplicate')).length;
    auto('files_parse_cleanly', !refs.length ? 'fail' : failed.length || quarantined.length ? 'fail' : 'pass',
      !refs.length ? 'No observation files were supplied.' : failed.length ? `Unreadable file(s): ${failed.map(r => `${r} (${P[r].pv.error})`).join(', ')}` : quarantined.length ? `${quarantined.length} rows not accepted: ${JSON.stringify(reasonsCount(quarantined))}` : `${allObs.length} rows accepted from ${refs.length} files.`,
      { people: refs.length, rows: Object.fromEntries(refs.map(r => [r, P[r].pv.counts || null])), reasons: reasonsCount(quarantined), conflictingDuplicatesWithinFiles: conflictsInFile });
  }
  // 2. Identity
  {
    const missing = { manufacturer: 0, model: 0, serial: 0, firmware: 0 };
    for (const o of allObs) for (const k of Object.keys(missing)) if (!o.device?.[k]) missing[k]++;
    const bad = Object.entries(missing).filter(([, n]) => n);
    auto('identity_on_every_record', !allObs.length ? 'not_tested' : bad.length ? 'fail' : 'pass', !allObs.length ? 'No accepted records.' : bad.length ? `Missing on some records: ${bad.map(([k, n]) => `${k} (${n})`).join(', ')}` : `All ${allObs.length} records identify the device and firmware.`, { missing });
  }
  // 3. UTC offsets (rows without one are quarantined by the importer; this counts them explicitly)
  {
    const q = refs.flatMap(r => P[r].pv.quarantined || []).filter(x => x.reasons.some(r => /^utc_offset_/.test(r))).length, noOff = samples.filter(o => o.offsetMin == null).length;
    auto('utc_offset_on_every_record', !samples.length && !q ? 'not_tested' : q || noOff ? 'fail' : 'pass', q || noOff ? `${q + noOff} samples without a valid UTC offset.` : `All ${samples.length} samples carry a UTC offset.`, { withoutOffset: q + noOff });
  }
  // 4. Sampling interval
  {
    const undeclared = samples.filter(o => o.device?.samplingIntervalS == null && o.endUtc == null).length;
    const declared = [...new Set(samples.map(o => o.device?.samplingIntervalS).filter(x => x != null))];
    const spacing = []; // observed spacing between consecutive samples of a stream within 2 h, for the reviewer
    const byStream = new Map(); for (const o of samples) { const k = `${o.participantRef}|${o.device.serial}|${o.kind}`; (byStream.get(k) || byStream.set(k, []).get(k)).push(o.tsUtc); }
    for (const ts of byStream.values()) { ts.sort((a, b) => a - b); for (let i = 1; i < ts.length; i++) { const d = (ts[i] - ts[i - 1]) / 1000; if (d > 0 && d < 7200) spacing.push(d); } }
    auto('sampling_interval_declared', !samples.length ? 'not_tested' : undeclared ? 'fail' : 'pass', undeclared ? `${undeclared} samples have neither a sampling interval nor an end time.` : `Declared interval(s): ${declared.join(', ') || 'end times only'} s; observed median spacing ${median(spacing) ?? '—'} s (for review).`,
      { undeclared, declaredIntervalsS: declared, observedMedianSpacingS: median(spacing) });
  }
  // 5. Quality flags
  {
    const documented = new Set(profile.documentedFlags || []), seen = {};
    for (const o of allObs) for (const f of o.sourceFlags || []) seen[f] = (seen[f] || 0) + 1;
    const undocumented = Object.keys(seen).filter(f => !documented.has(f));
    auto('quality_flags_documented', !allObs.length ? 'not_tested' : undocumented.length ? 'fail' : 'pass', undocumented.length ? `Undocumented flags: ${undocumented.map(f => `${f} (${seen[f]})`).join(', ')}` : `Flags seen: ${Object.keys(seen).join(', ') || 'none'}; all documented.`, { seen, documented: [...documented] });
  }
  // 6. Nights and quality (per person: longest run of consecutive worn nights; quality share over worn nights)
  const nightsByRef = {};
  {
    const per = {}; let worn = 0, goodOrLimited = 0;
    for (const r of refs) {
      const reps = nightlyReports(P[r].obs, [], config).reports; nightsByRef[r] = reps;
      const wornNights = [...new Set(reps.filter(x => x.counts.valid > 0).map(x => x.night))];
      const ok = new Set(reps.filter(x => x.counts.valid > 0 && ['good', 'limited'].includes(x.dataQuality.level)).map(x => x.night));
      per[r] = { wornNights: wornNights.length, longestConsecutiveRun: longestRun(wornNights), goodOrLimited: wornNights.filter(n => ok.has(n)).length };
    }
    const qualifying = refs.filter(r => per[r].longestConsecutiveRun >= CRITERIA.consecutiveNights);
    for (const r of qualifying) { worn += per[r].wornNights; goodOrLimited += per[r].goodOrLimited; }
    const share = worn ? goodOrLimited / worn : null;
    const pass = qualifying.length >= CRITERIA.minPeople && share != null && share >= CRITERIA.minGoodOrLimitedShare;
    auto('nights_and_quality', !refs.length ? 'not_tested' : pass ? 'pass' : 'fail',
      `${qualifying.length} of ${refs.length} people have ${CRITERIA.consecutiveNights}+ consecutive worn nights (need ${CRITERIA.minPeople}); ${goodOrLimited} of ${worn} worn nights good or limited${share == null ? '' : ` (${round(share * 100, 1)}%)`}.`,
      { perPerson: per, qualifyingPeople: qualifying, wornNights: worn, goodOrLimitedNights: goodOrLimited, share: round(share, 4) });
  }
  // 7. Clock
  if (!clock) auto('clock_within_2_minutes', 'not_tested', 'No reference-clock pairs supplied (columns: participant_ref, device_serial_pseudonym, device_time_utc, reference_time_utc).');
  else {
    const pairs = csvRows(clock).map(r => ({ ref: r.participant_ref, d: toMs(r.device_time_utc), t: toMs(r.reference_time_utc) }));
    const bad = pairs.filter(p => !Number.isFinite(p.d) || !Number.isFinite(p.t)), errs = pairs.filter(p => Number.isFinite(p.d) && Number.isFinite(p.t)).map(p => Math.abs(p.d - p.t) / 1000);
    const max = errs.length ? Math.max(...errs) : null;
    auto('clock_within_2_minutes', !errs.length ? 'not_tested' : bad.length || max > CRITERIA.maxClockErrorS ? 'fail' : 'pass', !errs.length ? 'No usable reference-clock pairs.' : `${errs.length} pairs; largest difference ${max} s (limit ${CRITERIA.maxClockErrorS} s)${bad.length ? `; ${bad.length} unreadable pairs` : ''}.`, { pairs: errs.length, maxAbsErrorS: max, medianAbsErrorS: median(errs), unreadable: bad.length });
  }
  // 8. Off-wrist
  if (!wear) auto('off_wrist_flagged', 'not_tested', 'No wear log supplied (columns: participant_ref, removed_at_utc, put_on_at_utc).');
  else {
    const offFlags = new Set(profile.offWristFlags || []), periods = csvRows(wear).map(r => ({ ref: r.participant_ref, from: toMs(r.removed_at_utc), to: toMs(r.put_on_at_utc) })).filter(p => Number.isFinite(p.from) && Number.isFinite(p.to) && p.to > p.from);
    let inside = 0, flagged = 0; const perPeriod = [];
    for (const p of periods) {
      const s = (P[p.ref]?.obs || []).filter(o => o.aggregation === 'sample' && o.tsUtc < p.to && (o.endUtc ?? o.tsUtc) >= p.from && o.tsUtc >= p.from);
      const f = s.filter(o => (o.sourceFlags || []).some(x => offFlags.has(x))).length;
      inside += s.length; flagged += f; perPeriod.push({ ref: p.ref, samples: s.length, flagged: f });
    }
    auto('off_wrist_flagged', !periods.length ? 'not_tested' : !offFlags.size ? 'fail' : inside === flagged ? 'pass' : 'fail',
      !periods.length ? 'No usable wear-log periods.' : !offFlags.size ? 'The profile documents no off-wrist flag.' : inside === flagged ? `${periods.length} removal period${periods.length === 1 ? "" : "s"}: ${inside} samples inside, all flagged${inside === 0 ? ' (the device produced none)' : ''}.` : `${inside - flagged} of ${inside} samples during known removals are NOT flagged.`,
      { periods: perPeriod, offWristFlags: [...offFlags] });
  }
  // 9. Firmware change
  const fw = profile.expect?.firmwareChange;
  if (!fw) auto('firmware_change_detected', 'not_tested', 'No firmware change was planned during the sample (profile.expect.firmwareChange).');
  else {
    const reps = nightsByRef[fw.ref] || [], near = new Set([addDays(fw.night, -1), fw.night, addDays(fw.night, 1)]);
    const hit = reps.find(r => near.has(r.night) && r.flags.some(f => /firmware_change|device_change/.test(f)));
    const before = new Set(reps.filter(r => r.night < fw.night).map(r => r.stream.firmware)), after = new Set(reps.filter(r => r.night >= fw.night).map(r => r.stream.firmware));
    auto('firmware_change_detected', hit ? 'pass' : 'fail', hit ? `Stream change flagged on ${hit.night} (${[...before].join('/')} → ${[...after].join('/')}).` : `No firmware change visible for ${fw.ref} around ${fw.night} (firmware seen: ${[...new Set([...before, ...after])].join(', ') || 'none'}).`, { ref: fw.ref, expectedNight: fw.night, flaggedNight: hit?.night ?? null });
  }
  // 10. Time-zone change
  const tz = profile.expect?.timeZoneChange;
  if (!tz) auto('time_zone_change_reflected', 'not_tested', 'No time-zone change was planned during the sample (profile.expect.timeZoneChange).');
  else {
    const reps = nightsByRef[tz.ref] || [];
    const afterReps = reps.filter(r => r.night >= tz.night && r.counts.valid > 0), beforeReps = reps.filter(r => r.night < tz.night && r.counts.valid > 0);
    const afterOk = afterReps.length > 0 && afterReps.every(r => r.window.utcOffsetsMin.every(o => o === tz.offsetMin));
    const changed = beforeReps.length > 0 && beforeReps.some(r => r.window.utcOffsetsMin.some(o => o !== tz.offsetMin));
    auto('time_zone_change_reflected', afterOk && changed ? 'pass' : 'fail', afterOk && changed ? `Offsets change to ${tz.offsetMin} min from ${tz.night}.` : `Offsets after ${tz.night}: ${[...new Set(afterReps.flatMap(r => r.window.utcOffsetsMin))].join(', ') || 'none'}; expected ${tz.offsetMin}.`, { ref: tz.ref, expectedNight: tz.night, expectedOffsetMin: tz.offsetMin });
  }
  // 11. Units against a bench reference (no tolerance is applied to the size of the difference: it is reported)
  if (!bench) auto('units_confirmed_against_bench', 'not_tested', 'No bench reference supplied (columns: device_serial_pseudonym, timestamp_utc, reference_c).');
  else {
    const ref = csvRows(bench).map(r => ({ serial: r.device_serial_pseudonym, t: toMs(r.timestamp_utc), c: Number(r.reference_c) })).filter(r => Number.isFinite(r.t) && Number.isFinite(r.c));
    const declaredDiff = [], altDiff = [];
    for (const r of ref) {
      const o = samples.find(s => s.device.serial === r.serial && s.tsUtc <= r.t && r.t < (s.endUtc ?? (s.device.samplingIntervalS != null ? s.tsUtc + s.device.samplingIntervalS * 1000 : s.tsUtc)));
      if (!o || o.valueC == null) continue;
      const unit = String(o.sourceUnit || '').toUpperCase().replace(/[°\s]/g, '');
      const alt = /^(F|DEGF|FAHRENHEIT)$/.test(unit) ? o.sourceValue : (o.sourceValue - 32) / 1.8; // the other interpretation
      declaredDiff.push(o.valueC - r.c); altDiff.push(alt - r.c);
    }
    const absD = declaredDiff.map(Math.abs), absA = altDiff.map(Math.abs);
    const enough = absD.length >= CRITERIA.minBenchPairs, fits = enough && median(absD) < median(absA);
    auto('units_confirmed_against_bench', !absD.length ? 'not_tested' : !enough ? 'not_tested' : fits ? 'pass' : 'fail',
      !absD.length ? 'No bench reading fell inside a device measurement interval.' : !enough ? `Only ${absD.length} matched pairs (need ${CRITERIA.minBenchPairs}).` : fits ? `Declared units agree better than the alternative (median |difference| ${round(median(absD))} °C vs ${round(median(absA))} °C). The size of the difference is for a reviewer to judge; no tolerance is applied.` : `The bench reference agrees better with the OTHER unit (median |difference| ${round(median(absA))} °C) than with the declared one (${round(median(absD))} °C).`,
      { matchedPairs: absD.length, medianDiffC: round(median(declaredDiff)), medianAbsDiffC: round(median(absD)), p95AbsDiffC: round(quantile(absD, 0.95)), alternativeMedianAbsDiffC: round(median(absA)) });
  }
  // 12. Re-sync
  if (!resync) auto('resync_no_duplicates', 'not_tested', 'No re-sync export supplied.');
  else {
    const first = P[resync.ref]?.obs || [];
    const existing = { obsRowHash: new Map(first.map(o => [o.obsKey, o.rowHash])) };
    const pv = preview(resync.text, { format: resync.format || 'csv', recordType: 'observations', participantRef: resync.ref, existing, config });
    const conflicts = pv.ok ? pv.quarantined.filter(q => q.reasons.includes('conflicting_duplicate')).length : null;
    auto('resync_no_duplicates', !pv.ok ? 'fail' : !pv.counts.duplicates && !conflicts ? 'not_tested' : conflicts ? 'fail' : 'pass',
      !pv.ok ? `Re-sync file unreadable (${pv.error}).` : !pv.counts.duplicates && !conflicts ? 'The re-sync export shares no readings with the first export, so de-duplication was not exercised.' : conflicts ? `${conflicts} re-sent readings changed value (conflicting duplicates).` : `${pv.counts.duplicates} re-sent readings were exact duplicates; ${pv.counts.accepted} new; no conflicts.`,
      pv.ok ? { duplicates: pv.counts.duplicates, newRows: pv.counts.accepted, conflicts } : {});
  }
  // Manual items: a written supplier answer, then our review.
  for (const [id, title] of MANUAL) {
    const a = profile.answers?.[id];
    const status = !a?.answer ? 'needs_written_answer' : a.reviewedBy && a.reviewedOn ? 'reviewed' : 'supplier_answered';
    items.push(result(id, title, 'manual', status, status === 'needs_written_answer' ? 'Needs a written answer from the supplier.' : status === 'supplier_answered' ? `Supplier statement (${a.source || 'no source given'}); not yet reviewed by us.` : `Supplier statement (${a.source || 'no source given'}), reviewed by ${a.reviewedBy} on ${a.reviewedOn}.`,
      a ? { source: a.source || null, reviewedBy: a.reviewedBy || null, reviewedOn: a.reviewedOn || null } : {}));
  }
  const blockers = items.filter(i => (i.kind === 'automated' && i.status !== 'pass') || (i.kind === 'manual' && i.status !== 'reviewed')).map(i => i.id);
  return {
    format: 'supplier-acceptance-report-1', version: ACCEPTANCE_VERSION, configVersion: config.version, synthetic: profile.synthetic === true,
    device: profile.device || null, verdict: blockers.length ? 'not_verified' : 'technically_verified', blockers, criteria: CRITERIA, items, disclaimer: DISCLAIMER,
  };
}

const ICON = { pass: 'PASS', fail: 'FAIL', not_tested: 'NOT TESTED', needs_written_answer: 'NEEDS WRITTEN ANSWER', supplier_answered: 'ANSWERED, NOT REVIEWED', reviewed: 'REVIEWED' };
const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
/** Markdown rendering of a report. */
export function toMarkdown(r) {
  const out = [];
  out.push(`# Supplier acceptance report${r.synthetic ? ': SYNTHETIC SAMPLE (not a real device)' : ''}`, '');
  if (r.synthetic) out.push('> **These files are synthetic.** The result shows that the checks run, nothing about any real device.', '');
  out.push(`> ${r.disclaimer}`, '');
  out.push(`- **Device (as named by the supplier profile):** ${cell(r.device?.name || [r.device?.manufacturer, r.device?.model].filter(Boolean).join(' ') || 'not stated')}`,
    `- **Verdict:** ${r.verdict === 'technically_verified' ? 'technically verified (files usable by this platform; nothing more)' : 'not verified'}`,
    `- **Blocking items:** ${r.blockers.length ? r.blockers.join(', ') : 'none'}`,
    `- **Report version:** ${r.version}; configuration ${r.configVersion}`, '');
  for (const kind of ['automated', 'manual']) {
    out.push(kind === 'automated' ? '## Checks run on the files' : '## Supplier answers (need a written answer, then our review)', '', '| Item | Status | Detail |', '|---|---|---|');
    for (const i of r.items.filter(x => x.kind === kind)) out.push(`| \`${i.id}\`: ${cell(i.title)} | **${ICON[i.status] || i.status}** | ${cell(i.detail)} |`);
    out.push('');
  }
  out.push('Pass criteria come from `research/docs/supplier-checklist.md`. Bench differences are reported, not judged against an invented tolerance.');
  return out.join('\n') + '\n';
}
