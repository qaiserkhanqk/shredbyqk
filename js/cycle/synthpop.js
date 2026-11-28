// SYNTHETIC POPULATION for stress-testing the cycle code. Every number is generated; nothing comes from a real person.
// The generator's parameters come from published studies where they exist (SOURCES) and are labelled ASSUMPTION where
// they don't (for example how often people forget to wear a band). Results on this population describe how the app's
// code behaves on data that follows OUR assumptions; they are not real-world accuracy and must not be quoted as such.
// The same assumptions shape both the data and what "good" looks like, so the numbers are partly circular by design.
import { addDays } from './dates.js';
import { rng, gauss } from './wearables.js';
import * as M from './model.js';
import { startPregnancy, endPregnancy, finishPostpartum } from './pregnancy.js';

export const SYNTHPOP_VERSION = 'synthetic-population-0.1.0';
export const SYNTHETIC_BANNER = 'SYNTHETIC DATA generated from published parameters and stated assumptions. It tests software behaviour only. It is not real-world or clinical performance and must not be quoted as accuracy.';

export const SOURCES = {
  bull2019: { what: 'Cycle structure: mean cycle 29.3 days; follicular phase mean 16.9 (95% CI 10–30); luteal phase mean 12.4 (95% CI 7–17); cycle length falls 0.18 days per year of age from 25 to 45', ref: 'Bull JR et al. npj Digit Med 2019', doi: '10.1038/s41746-019-0152-7' },
  goodale2019: { what: 'Temperature: nightly basal temperature rises 0.28–0.56 °C after ovulation; wrist temperature, heart rate and breathing rate shift by phase', ref: 'Goodale BM et al. J Med Internet Res 2019', doi: '10.2196/13404' },
  moghissi1976: { what: 'About 20% of ovulatory cycles show no clear temperature rise', ref: 'Moghissi KS. Fertil Steril 1976', pmid: '1001528' },
  bouchard2026: { what: 'About 11% of cycles in regularly cycling women were anovulatory (no ovulation)', ref: 'Bouchard TP et al. Reprod Biomed Online 2026', doi: '10.1016/j.rbmo.2026.105881' },
  acog651: { what: 'Cycles are more variable in the years after the first period', ref: 'ACOG Committee Opinion No. 651, 2015', doi: '10.1097/AOG.0000000000001215' },
  straw10: { what: 'Early perimenopause: a persistent ≥7-day difference in consecutive cycle lengths; late: ≥60 days without a period', ref: 'STRAW+10 (see docs/midlife-evidence.md)' },
  acog700: { what: 'Pregnancy: due date = last period + 280 days', ref: 'ACOG Committee Opinion No. 700, 2017', doi: '10.1097/AOG.0000000000002046' },
};

/** Generator settings. `src` says where a value comes from; ASSUMPTION means no published figure was used. */
export const PARAMS = Object.freeze({
  LUTEAL: { mean: 12.4, personSd: 1.2, withinSd: 1.0, min: 7, max: 17, src: 'bull2019 (SDs: ASSUMPTION, chosen so ~95% fall within 7–17)' },
  FOLLICULAR: { mean: 16.9, personSd: 2.5, min: 10, max: 30, ageSlopePerYear: -0.19, src: 'bull2019' },
  RISE_C: { min: 0.28, max: 0.56, src: 'goodale2019 (basal temperature; using it for wrist skin temperature is an ASSUMPTION)' },
  NO_VISIBLE_RISE: { p: 0.20, src: 'moghissi1976' },
  ANOVULATORY: { regular: 0.11, src: 'bouchard2026; higher rates for teens, variable cycles and perimenopause are ASSUMPTIONS' },
  NIGHT: { baseMean: 33.8, baseSd: 0.4, noiseSd: 0.12, src: 'ASSUMPTION (matches the app demo band)' },
  WEAR: { pMissing: 0.08, pPartial: 0.04, src: 'ASSUMPTION (no published wear data for the target band)' },
  LIFE: { pAlcoholNight: 0.05, alcoholRise: 0.15, pMarksAlcohol: 0.7, pIllnessPerCycle: 0.03, illnessRise: 0.6, pMarksIllness: 0.6, pTravelNight: 0.01, src: 'ASSUMPTION' },
  LOGGING: { maxDelayDays: 3, pMissedLog: 0.02, src: 'ASSUMPTION' },
  GROUPS: { regular: 0.45, teen: 0.10, variable: 0.10, perimenopause: 0.10, afterPregnancy: 0.07, forgetfulWearer: 0.08, bandChange: 0.05, noBand: 0.05, src: 'ASSUMPTION (a mix chosen to exercise every rule)' },
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, weights) => { let u = r() * Object.values(weights).filter(x => typeof x === 'number').reduce((a, b) => a + b, 0); for (const [k, w] of Object.entries(weights)) { if (typeof w !== 'number') continue; if ((u -= w) <= 0) return k; } return 'regular'; };

/** One synthetic person: her true cycles (with the hidden truth used only for checking), her logs and her band nights. */
export function makePerson(i, { seed = 20261126, cycles = 14 } = {}) {
  const r = rng(seed * 1000 + i), g = () => gauss(r);
  const group = pick(r, PARAMS.GROUPS);
  const age = group === 'teen' ? 14 + Math.floor(r() * 5) : group === 'perimenopause' ? 45 + Math.floor(r() * 8) : 20 + Math.floor(r() * 20);
  const F = PARAMS.FOLLICULAR, L = PARAMS.LUTEAL;
  const ageShift = age >= 25 ? F.ageSlopePerYear * (Math.min(age, 45) - 25) : 0;
  const follMean = { regular: F.mean, teen: 18, variable: 22, perimenopause: 16, afterPregnancy: F.mean, forgetfulWearer: F.mean, bandChange: F.mean, noBand: F.mean }[group] + ageShift + g() * F.personSd;
  const follSd = { teen: 5, variable: 7, perimenopause: 6 }[group] ?? 2; // within-person spread: ASSUMPTION
  const pAnov = { teen: 0.3, variable: 0.3, perimenopause: 0.3 }[group] ?? PARAMS.ANOVULATORY.regular;
  const lutMean = clamp(L.mean + g() * L.personSd, L.min, L.max);
  const base = PARAMS.NIGHT.baseMean + g() * PARAMS.NIGHT.baseSd;
  const truth = []; let start = addDays('2025-01-06', Math.floor(r() * 28));
  const pregAt = group === 'afterPregnancy' ? 6 : -1;
  for (let k = 0; k < cycles; k++) {
    let c;
    if (k === pregAt) { // pregnancy: no cycle; birth 280 days after this start; periods resume 90–270 days later (ASSUMPTION)
      const birth = addDays(start, 280), resume = addDays(birth, 90 + Math.floor(r() * 180));
      truth.push({ start, pregnancy: true, birth, length: null }); start = resume; continue;
    }
    const anov = r() < pAnov;
    if (anov) c = { start, anovulatory: true, ovulationDay: null, length: clamp(Math.round(follMean + lutMean + 5 + g() * 8), 18, 90) };
    else {
      const foll = clamp(Math.round(follMean + g() * follSd), F.min, group === 'variable' || group === 'perimenopause' || group === 'teen' ? 45 : F.max);
      const lut = clamp(Math.round(lutMean + g() * L.withinSd), L.min, L.max);
      c = { start, anovulatory: false, ovulationDay: foll, length: foll + lut };
    }
    if (group === 'perimenopause' && r() < 0.1) c.length = 60 + Math.floor(r() * 40); // a long gap (STRAW+10 late transition)
    if (group === 'teen') c.length = clamp(c.length, 21, 45); // ACOG CO 651 range
    c.visibleRise = !c.anovulatory && r() >= PARAMS.NO_VISIBLE_RISE.p;
    c.rise = PARAMS.RISE_C.min + r() * (PARAMS.RISE_C.max - PARAMS.RISE_C.min);
    c.missedLog = k > 0 && r() < PARAMS.LOGGING.pMissedLog;
    c.logDelay = Math.floor(r() * (PARAMS.LOGGING.maxDelayDays + 1));
    truth.push(c); start = addDays(start, c.length);
  }
  truth.push({ start, length: null, open: true }); // the next, not-yet-known start
  // Band nights.
  const nights = [], days = {};
  const wear = group === 'forgetfulWearer' ? 0.3 : PARAMS.WEAR.pMissing;
  const stopAfter = group === 'forgetfulWearer' ? truth[Math.min(8, truth.length - 1)].start : null;
  const setupFor = d => (group === 'bandChange' ? (d >= (truth[10]?.start || '9999') ? { deviceId: 'syn-b', model: 'SYN-1', firmware: '2' } : d >= (truth[7]?.start || '9999') ? { deviceId: 'syn-a', model: 'SYN-1', firmware: '2' } : { deviceId: 'syn-a', model: 'SYN-1', firmware: '1' }) : { deviceId: 'syn-a', model: 'SYN-1', firmware: '1' });
  if (group !== 'noBand') {
    for (let k = 0; k + 1 < truth.length; k++) {
      const c = truth[k]; if (c.pregnancy) continue; // no band during pregnancy and postpartum amenorrhoea (ASSUMPTION)
      const ill = r() < PARAMS.LIFE.pIllnessPerCycle ? Math.floor(r() * Math.max(1, c.length - 3)) : -1;
      for (let d = 0; d < c.length; d++) {
        const night = addDays(c.start, d);
        if (stopAfter && night >= stopAfter) break;
        if (r() < wear) continue;
        const shift = c.visibleRise && d >= c.ovulationDay + 1 ? c.rise * Math.min(1, (d - c.ovulationDay) / 2) : 0; // rises over ~2 nights
        let v = base + shift + g() * PARAMS.NIGHT.noiseSd;
        const flags = [];
        if (r() < PARAMS.LIFE.pAlcoholNight) { v += PARAMS.LIFE.alcoholRise; if (r() < PARAMS.LIFE.pMarksAlcohol) (days[night] ||= {}).alcohol = true; }
        if (ill >= 0 && d >= ill && d < ill + 3) { v += PARAMS.LIFE.illnessRise; if (r() < PARAMS.LIFE.pMarksIllness) (days[night] ||= {}).unwell = true; }
        if (r() < PARAMS.LIFE.pTravelNight) flags.push('tz_change');
        const partial = r() < PARAMS.WEAR.pPartial;
        nights.push({ night, ...setupFor(night), metric: 'skin_temp', status: partial ? 'insufficient_wear' : 'ok', value: partial ? null : +v.toFixed(2), flags, coverageMin: partial ? 60 : 480, samples: partial ? 6 : 48, syncedAt: `${addDays(night, 1)}T07:00:00.000Z` });
      }
    }
  }
  return { id: `SYN-${String(i).padStart(5, '0')}`, group, age, truth, nights, days, banded: group !== 'noBand' };
}

/** Her full app state as she would have entered it (periods logged on the right date, late by a few days or missed). */
export function personState(p) {
  const s = M.blankState(p.id), AT = '2025-01-01T00:00:00.000Z';
  M.giveConsent(s, AT);
  if (p.banded) M.setScopeConsent(s, 'wearable', true, AT);
  for (const [k, c] of p.truth.entries()) {
    if (c.open || c.missedLog) continue;
    const at = `${addDays(c.start, c.logDelay || 0)}T20:00:00.000Z`;
    M.logPeriodStart(s, c.start, { today: addDays(c.start, c.logDelay || 0), at });
    if (c.pregnancy) {
      const told = addDays(c.start, 42), birth = c.birth, next = p.truth[k + 1]?.start;
      startPregnancy(s, { lmp: c.start, today: told, at: `${told}T20:00:00.000Z` });
      endPregnancy(s, { outcome: 'birth', date: birth, today: birth, at: `${birth}T20:00:00.000Z` });
      if (next) finishPostpartum(s, { at: `${next}T21:00:00.000Z` }); // she turns postpartum mode off when periods return
    }
  }
  for (const [d, v] of Object.entries(p.days)) M.logDay(s, d, v, { today: d, at: `${d}T21:00:00.000Z` });
  s.wearable.nights = p.nights.map(n => ({ ...n }));
  return s;
}

export const makePopulation = (n, opts) => Array.from({ length: n }, (_, i) => makePerson(i, opts));
