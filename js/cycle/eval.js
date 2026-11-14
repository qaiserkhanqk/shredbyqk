// Reproducible evaluation harness: dates-only baseline vs a sensor-assisted CANDIDATE.
//
// ▸ Everything in this file runs on SYNTHETIC participants. Its numbers show that the harness works; they are
//   NOT real-world performance and must never be reported as such.
// ▸ The same code is meant to run on a real, consented study dataset later (see docs/cycle-validation-plan.md),
//   by replacing makeCohort() with a loader that yields the same participant shape.
//
// Design:
//  • Frozen configuration: algorithm versions, parameters, device model and firmware, cohort seed. Wearable
//    nights from any other model or firmware are excluded from the sensor model, and the count is reported.
//  • Participant-separated: participants are split by a hash of their ID into 'development' and 'test'.
//    No parameter is fitted at all (all are fixed in advance), and the headline report uses 'test' only.
//  • Time-ordered with no future-data leakage: each prediction made "on day D" sees only data dated before D
//    (model.stateAsOf). A self-check re-runs predictions with all future data scrambled and requires
//    identical output.
//  • Outcomes are LOGGED period starts, as in a real study. Cycles whose end was not logged are not scored.
import { addDays, diffDays } from './dates.js';
import { blankState, giveConsent, stateAsOf, cycles, setCategory } from './model.js';
import { estimateNext, PARAMS, ALGORITHM_VERSION } from './predict.js';
import { retrospectiveShift, SHIFT_PARAMS, SHIFT_VERSION } from './tempshift.js';
import { MockWearable, normalise, summariseNights, rng, gauss } from './wearables.js';
import { findPatterns, PATTERN_PARAMS } from './patterns.js';
import { CATEGORIES } from './model.js';

export const SYNTHETIC_BANNER = 'SYNTHETIC DATA. These results test the software only. They are not real-world or clinical performance and must not be quoted as accuracy.';

export const FROZEN = Object.freeze({
  cohortVersion: 'synthetic-cohort-1', seed: 20261114, participants: 40, cyclesEach: 12,
  device: { model: 'Mock Band (synthetic)', firmware: 'mock-1.0' },
  algorithms: { baseline: ALGORITHM_VERSION, sensor: `sensor-candidate-0.1.0+${SHIFT_VERSION}` },
  params: { predict: PARAMS, shift: SHIFT_PARAMS, patterns: PATTERN_PARAMS },
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const splitOf = id => (hash(id) % 10 < 3 ? 'development' : 'test');

/* ---------- Synthetic cohort ---------- */
export function makeParticipant(i, seed = FROZEN.seed, cyclesEach = FROZEN.cyclesEach) {
  const r = rng(seed + i * 7919), id = `P${String(i).padStart(3, '0')}`;
  const group = ['regular', 'regular', 'variable', 'long'][i % 4];
  const mean = group === 'regular' ? 26 + r() * 6 : group === 'variable' ? 29 + r() * 4 : 36 + r() * 6;
  const sd = group === 'regular' ? 1.2 : group === 'variable' ? 5 : 3;
  const pMissedLog = i % 5 === 0 ? 0.08 : 0;
  let start = addDays('2025-01-06', Math.floor(r() * 20));
  const truth = [], high = new Set();
  for (let k = 0; k < cyclesEach; k++) {
    const length = Math.round(clamp(mean + gauss(r) * sd, 20, 60)), luteal = Math.round(clamp(13 + gauss(r) * 1.5, 9, 17));
    const ovulation = addDays(start, length - luteal - 1);
    truth.push({ start, length, ovulation, logged: k === 0 || r() >= pMissedLog });
    for (let d = 1; d <= luteal; d++) high.add(addDays(ovulation, d));
    start = addDays(start, length);
  }
  truth.push({ start, length: null, ovulation: null, logged: true }); // the start that closes the last cycle
  const changeAt = i % 6 === 0 ? truth[Math.floor(cyclesEach / 2)].start : null; // some participants switch firmware mid-way
  const device = new MockWearable({ seed: seed + i, highFrom: n => high.has(n), base: 33.6 + r() * 0.6,
    deviceChanges: changeAt ? [{ from: changeAt, firmware: 'mock-2.0', base: 34.3 }] : [] });
  const sym = i % 3 === 0 ? { cat: 'energy', from: 1, to: 2 } : i % 3 === 1 ? { cat: 'energy', preMenstrual: 3 } : null;
  return { id, group, truth, device, sym, adherence: 0.4 + r() * 0.5, r };
}

/** Build the participant's full logged state (everything they would ever log). */
export function participantState(p) {
  const s = blankState(p.id); giveConsent(s, '2025-01-01T00:00:00Z'); setCategory(s, 'energy', true, { at: '2025-01-01T00:00:00Z' });
  const logged = p.truth.filter(t => t.logged);
  s.periods = logged.map((t, k) => ({ id: `${p.id}-${k}`, start: t.start, end: addDays(t.start, 4), missedBefore: false }));
  const last = p.truth.at(-1).start, r = rng(hash(p.id));
  // Symptom logs on a fraction of days; missing days stay missing.
  for (let k = 0; k + 1 < p.truth.length; k++) {
    const c = p.truth[k];
    for (let d = 1; d <= c.length; d++) {
      if (r() > p.adherence) continue;
      const date = addDays(c.start, d - 1);
      let notable = r() < 0.12;
      if (p.sym?.from && d >= p.sym.from && d <= p.sym.to) notable = r() < 0.85;
      if (p.sym?.preMenstrual && d > c.length - p.sym.preMenstrual) notable = r() < 0.85;
      s.days[date] = { energy: notable ? 'low' : 'usual' };
    }
  }
  const { readings } = normalise(p.device.packets(p.truth[0].start, addDays(last, -1)), { now: Date.parse(last + 'T12:00:00Z') });
  s.wearable.nights = summariseNights(readings).filter(n => n.metric === 'skin_temp');
  return s;
}

export const makeCohort = (n = FROZEN.participants, seed = FROZEN.seed) => Array.from({ length: n }, (_, i) => makeParticipant(i, seed));

/* ---------- Models ---------- */
const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

export function baselineModel(view, asOf) {
  const e = estimateNext(view, asOf);
  if (!e.rangeStart) return { predicted: false, status: e.status };
  return { predicted: true, date: addDays(e.lastStart, Math.round(e.median)), rangeStart: e.rangeStart, rangeEnd: e.rangeEnd, status: e.status };
}

/** Candidate: after a retrospective rise in THIS cycle, use the person's own past rise→next-start intervals. */
export function sensorModel(view, asOf, frozen = FROZEN) {
  const v = { ...view, wearable: { ...view.wearable, nights: view.wearable.nights.filter(n => n.model === frozen.device.model && n.firmware === frozen.device.firmware) } };
  const fallback = () => ({ ...baselineModel(view, asOf), usedSensor: false });
  const starts = v.periods.map(p => p.start).sort(); if (!starts.length) return fallback();
  const cur = retrospectiveShift(v, starts.at(-1), asOf);
  if (!cur.detected) return fallback();
  const intervals = [];
  for (const c of cycles(v).filter(c => c.usable)) {
    const sh = retrospectiveShift(v, c.start, c.nextStart);
    if (sh.detected) intervals.push(diffDays(sh.firstHighNight, c.nextStart));
  }
  if (intervals.length < 2) return fallback();
  const m = median(intervals);
  return { predicted: true, usedSensor: true, date: addDays(cur.firstHighNight, Math.round(m)),
    rangeStart: addDays(cur.firstHighNight, Math.min(...intervals)), rangeEnd: addDays(cur.firstHighNight, Math.max(...intervals)), status: 'sensor' };
}
export const MODELS = { baseline: baselineModel, sensor: sensorModel };

/* ---------- Period-start evaluation (walk-forward) ---------- */
export function evaluatePeriods(cohort, { models = MODELS } = {}) {
  const rows = [];
  for (const p of cohort) {
    const s = participantState(p), logged = s.periods.map(x => x.start);
    for (let k = 1; k + 1 <= logged.length - 1; k++) {
      const prev = logged[k], actual = logged[k + 1];
      for (let d = 1; addDays(prev, d) < actual; d++) {
        const asOf = addDays(prev, d), view = stateAsOf(s, asOf), lead = diffDays(asOf, actual);
        for (const [name, fn] of Object.entries(models)) {
          const out = fn(view, asOf);
          rows.push({ participant: p.id, split: splitOf(p.id), group: p.group, model: name, cycleDay: d + 1, lead, predicted: out.predicted, usedSensor: !!out.usedSensor,
            error: out.predicted ? diffDays(actual, out.date) : null, covered: out.predicted ? actual >= out.rangeStart && actual <= out.rangeEnd : null,
            width: out.predicted ? diffDays(out.rangeStart, out.rangeEnd) + 1 : null });
        }
      }
    }
  }
  return rows;
}

const BUCKETS = [['1–3 days ahead', 1, 3], ['4–7 days ahead', 4, 7], ['8–14 days ahead', 8, 14], ['15+ days ahead', 15, 1e9]];
export function periodMetrics(rows) {
  const n = rows.length, pr = rows.filter(r => r.predicted), abs = pr.map(r => Math.abs(r.error));
  const pct = f => (pr.length ? Math.round((1000 * pr.filter(f).length) / pr.length) / 10 : null);
  return { opportunities: n, predictions: pr.length, noPredictionPct: n ? Math.round((1000 * (n - pr.length)) / n) / 10 : null,
    mae: abs.length ? +(abs.reduce((a, v) => a + v, 0) / abs.length).toFixed(2) : null, medianAbsError: abs.length ? median(abs) : null,
    within1: pct(r => Math.abs(r.error) <= 1), within2: pct(r => Math.abs(r.error) <= 2), within3: pct(r => Math.abs(r.error) <= 3),
    rangeCoverage: pct(r => r.covered), meanRangeWidth: pr.length ? +(pr.reduce((a, r) => a + r.width, 0) / pr.length).toFixed(1) : null,
    meanLeadTime: pr.length ? +(pr.reduce((a, r) => a + r.lead, 0) / pr.length).toFixed(1) : null,
    sensorUsedPct: pr.length ? Math.round((1000 * pr.filter(r => r.usedSensor).length) / pr.length) / 10 : null };
}
export function periodReport(rows, split = 'test') {
  const sel = rows.filter(r => r.split === split), models = [...new Set(sel.map(r => r.model))], out = {};
  for (const m of models) {
    const mr = sel.filter(r => r.model === m);
    out[m] = { all: periodMetrics(mr), byLead: Object.fromEntries(BUCKETS.map(([l, a, b]) => [l, periodMetrics(mr.filter(r => r.lead >= a && r.lead <= b))])),
      byGroup: Object.fromEntries(['regular', 'variable', 'long'].map(g => [g, periodMetrics(mr.filter(r => r.group === g))])),
      cycleDay2: periodMetrics(mr.filter(r => r.cycleDay === 2)) };
  }
  return out;
}

/* ---------- Separate endpoint: retrospective rise vs SYNTHETIC ovulation ----------
   The synthetic "ovulation" is the generator's own label. A real evaluation needs a clinician-designed
   reference (e.g. urinary LH surge plus ultrasound) and is a separate study endpoint. */
export function evaluateShift(cohort, split = 'test') {
  const errs = []; let cyclesScored = 0, detected = 0, excludedFirmware = 0;
  for (const p of cohort.filter(x => splitOf(x.id) === split)) {
    const s = participantState(p);
    const v = { ...s, wearable: { nights: s.wearable.nights.filter(n => { const ok = n.firmware === FROZEN.device.firmware; if (!ok) excludedFirmware++; return ok; }) } };
    for (const t of p.truth.slice(0, -1)) {
      if (!t.ovulation || !t.logged) continue; cyclesScored++;
      const sh = retrospectiveShift(v, t.start, addDays(t.start, t.length));
      if (sh.detected) { detected++; errs.push(diffDays(t.ovulation, sh.firstHighNight)); }
    }
  }
  return { cyclesScored, detectedPct: cyclesScored ? Math.round((1000 * detected) / cyclesScored) / 10 : null, excludedNightsOtherFirmware: excludedFirmware,
    riseMinusSyntheticOvulation: errs.length ? { median: median(errs), min: Math.min(...errs), max: Math.max(...errs) } : null };
}

/* ---------- Symptom check-in forecast vs each person's own simple baselines ---------- */
export function evaluateSymptoms(cohort, split = 'test') {
  const tally = { pattern: z(), lastCycle: z(), baseRate: z() };
  function z() { return { alerts: 0, trueAlerts: 0, falseAlerts: 0, notableDays: 0, caught: 0, cycles: 0 }; }
  for (const p of cohort.filter(x => splitOf(x.id) === split)) {
    const s = participantState(p), starts = s.periods.map(x => x.start), def = CATEGORIES.energy;
    for (let k = 1; k + 1 < starts.length; k++) {
      const cs = starts[k], ce = starts[k + 1], view = stateAsOf(s, cs), pats = findPatterns(view).filter(x => x.category === 'energy');
      const prevStart = starts[k - 1], hist = Object.entries(view.days).filter(([, d]) => d.energy);
      const baseRate = hist.length ? hist.filter(([, d]) => def.notable.includes(d.energy)).length / hist.length : 0;
      for (const t of Object.values(tally)) t.cycles++;
      for (let d = 1; addDays(cs, d - 1) < ce; d++) {
        const date = addDays(cs, d - 1), logged = s.days[date]?.energy; if (!logged) continue; // only days with an outcome
        const truth = def.notable.includes(logged);
        const near = [-1, 0, 1].some(o => def.notable.includes(view.days[addDays(prevStart, d - 1 + o)]?.energy));
        const alerts = { pattern: pats.some(x => d >= x.from && d <= x.to), lastCycle: near, baseRate: baseRate >= 0.5 };
        for (const [m, a] of Object.entries(alerts)) { const t = tally[m]; if (truth) t.notableDays++; if (a) { t.alerts++; truth ? t.trueAlerts++ : t.falseAlerts++; } if (a && truth) t.caught++; }
      }
    }
  }
  return Object.fromEntries(Object.entries(tally).map(([m, t]) => [m, { ...t, precisionPct: t.alerts ? Math.round((1000 * t.trueAlerts) / t.alerts) / 10 : null,
    recallPct: t.notableDays ? Math.round((1000 * t.caught) / t.notableDays) / 10 : null, falseAlertsPerCycle: t.cycles ? +(t.falseAlerts / t.cycles).toFixed(2) : null }]));
}

/* ---------- Leakage self-check ---------- */
export function leakageCheck(p, model = baselineModel) {
  const s = participantState(p), asOf = s.periods[4].start, a = model(stateAsOf(s, asOf), asOf);
  const t = structuredClone(s); // scramble everything on or after asOf
  for (const x of t.periods) if (x.start >= asOf) x.start = addDays(x.start, 3);
  for (const n of t.wearable.nights) if (n.night >= asOf && n.value) n.value += 5;
  const b = model(stateAsOf(t, asOf), asOf);
  return JSON.stringify(a) === JSON.stringify(b);
}

export function runEvaluation({ participants = FROZEN.participants, seed = FROZEN.seed } = {}) {
  const cohort = makeCohort(participants, seed);
  const rows = evaluatePeriods(cohort);
  return { banner: SYNTHETIC_BANNER, frozen: { ...FROZEN, participants, seed },
    splits: { development: cohort.filter(p => splitOf(p.id) === 'development').length, test: cohort.filter(p => splitOf(p.id) === 'test').length },
    leakageFree: leakageCheck(cohort[1], baselineModel) && leakageCheck(cohort[1], sensorModel),
    periodStart: periodReport(rows, 'test'), ovulationEndpoint: evaluateShift(cohort, 'test'), symptomForecast: evaluateSymptoms(cohort, 'test') };
}

/** Markdown rendering of a report. */
export function toMarkdown(rep) {
  const L = [`# Cycle estimate evaluation (synthetic)`, '', `> **${rep.banner}**`, '',
    `Frozen config: cohort \`${rep.frozen.cohortVersion}\`, seed ${rep.frozen.seed}, device \`${rep.frozen.device.model}\` firmware \`${rep.frozen.device.firmware}\`, baseline \`${rep.frozen.algorithms.baseline}\`, sensor candidate \`${rep.frozen.algorithms.sensor}\`.`,
    `Participants: ${rep.splits.development} development (not scored), ${rep.splits.test} held-out test. Leakage self-check: **${rep.leakageFree ? 'passed' : 'FAILED'}**.`, '',
    '## Period-start estimate (held-out test participants, every day of every scored cycle)', ''];
  const head = '| Model | Slice | Opportunities | No prediction | MAE (days) | ±1 d | ±2 d | ±3 d | Range coverage | Mean width | Mean lead time | Sensor used |', sep = '|' + '---|'.repeat(12);
  L.push(head, sep);
  const row = (m, label, x) => L.push(`| ${m} | ${label} | ${x.opportunities} | ${x.noPredictionPct ?? '–'}% | ${x.mae ?? '–'} | ${x.within1 ?? '–'}% | ${x.within2 ?? '–'}% | ${x.within3 ?? '–'}% | ${x.rangeCoverage ?? '–'}% | ${x.meanRangeWidth ?? '–'} d | ${x.meanLeadTime ?? '–'} d | ${x.sensorUsedPct ?? '–'}% |`);
  for (const [m, r] of Object.entries(rep.periodStart)) {
    row(m, 'all', r.all); row(m, 'cycle day 2', r.cycleDay2);
    for (const [k, v] of Object.entries(r.byLead)) row(m, k, v);
    for (const [k, v] of Object.entries(r.byGroup)) row(m, `${k} cycles`, v);
  }
  const o = rep.ovulationEndpoint;
  L.push('', '## Separate endpoint: retrospective temperature rise vs the generator\'s synthetic ovulation label', '',
    `Cycles scored: ${o.cyclesScored}. Rise detected: ${o.detectedPct}%. Nights excluded for non-frozen firmware: ${o.excludedNightsOtherFirmware}.`,
    o.riseMinusSyntheticOvulation ? `Rise night minus synthetic ovulation (days): median ${o.riseMinusSyntheticOvulation.median}, range ${o.riseMinusSyntheticOvulation.min} to ${o.riseMinusSyntheticOvulation.max}.` : 'No rises detected.',
    'This only checks that the detector behaves as designed on data built to contain a step. A real ovulation endpoint needs a clinician-designed reference protocol.', '',
    '## Symptom check-in forecast vs personal simple baselines (energy, held-out test)', '',
    '| Method | Alerts | True | False | False per cycle | Precision | Recall |', '|---|---|---|---|---|---|---|');
  for (const [m, t] of Object.entries(rep.symptomForecast)) L.push(`| ${m} | ${t.alerts} | ${t.trueAlerts} | ${t.falseAlerts} | ${t.falseAlertsPerCycle} | ${t.precisionPct ?? '–'}% | ${t.recallPct ?? '–'}% |`);
  L.push('', '`pattern` = the app\'s personal-pattern rule; `lastCycle` = alert if the same cycle day (±1) was notable last cycle; `baseRate` = alert every day if the person logs "notable" on half or more of their days.');
  return L.join('\n');
}
