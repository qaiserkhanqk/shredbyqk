// Perimenopause and menopause mode (flag midlifeMode, default OFF; shown only when she marks the "Perimenopause or
// menopause" situation herself). Built from the published literature in docs/midlife-evidence.md.
//
// What it does: DESCRIBES her own entries against published criteria. It never diagnoses, never says she "is" in a
// stage, and gives no treatment, hormone, medicine or dose advice (treatment decisions belong with a clinician).
// Bleeding criteria are those of the STRAW+10 consensus (Harlow et al. 2012), which also says they do not apply with
// hormonal contraception or conditions and medicines that change bleeding: then nothing is described.
//
// Operational choices (documented, conservative):
//  • "Persistent ≥7-day difference in consecutive cycles, recurring within 10 cycles": one odd cycle produces two
//    adjacent differences (up, then back); that counts as ONE episode. Two non-adjacent differences within 10 cycles
//    are needed.
//  • "Amenorrhoea ≥60 days" counts days WITHOUT a logged period: from the day after a period's last day (its start
//    day when no end was logged; an end is never invented) to the day before the next start.
//  • Cycles she marked as "missed a log before this" are left out.
// All wording is a placeholder awaiting clinician review.
import { addDays, diffDays, human } from './dates.js';
import { hasConsent, restartDate } from './model.js';
import { pregnantSpans } from './checkins.js';

export const MIDLIFE_VERSION = 'midlife-observations-0.1.0';
export const REVIEW_STATUS = 'awaiting_clinician_review';

export const SOURCES = [
  { key: 'straw10', authors: 'Harlow SD, Gass M, Hall JE, et al.', title: 'Executive summary of the Stages of Reproductive Aging Workshop + 10 (STRAW+10)', journal: 'J Clin Endocrinol Metab 2012', url: 'https://doi.org/10.1210/jc.2011-3362', used: 'Bleeding criteria for the menopause transition; 12 months without a period; when the criteria do not apply.' },
  { key: 'mrs', authors: 'Heinemann K, Ruebig A, Potthoff P, et al.', title: 'The Menopause Rating Scale (MRS): a methodological review', journal: 'Health Qual Life Outcomes 2004', url: 'https://doi.org/10.1186/1477-7525-2-45', used: 'The symptom areas (hot flushes, heart, sleep, mood, exhaustion, joints, bladder, dryness). Our wording is our own; the app does not reproduce or score the MRS.' },
  { key: 'gsm', authors: 'Portman DJ, Gass MLS; consensus panel', title: 'Genitourinary syndrome of menopause: new terminology', journal: 'Menopause 2014', url: 'https://doi.org/10.1097/GME.0000000000000329', used: 'Vaginal dryness and bladder changes as one group of symptoms.' },
  { key: 'santoro', authors: 'Santoro N, Roeca C, Peters BA, Neal-Perry G', title: 'The menopause transition: signs, symptoms, and management options', journal: 'J Clin Endocrinol Metab 2021', url: 'https://doi.org/10.1210/clinem/dgaa764', used: 'The transition can last over a decade; symptoms include temporary changes in concentration and memory.' },
  { key: 'swan', authors: 'El Khoudary SR, Greendale G, Crawford SL, et al.', title: 'The menopause transition and women\'s health at midlife: a progress report from SWAN', journal: 'Menopause 2019', url: 'https://doi.org/10.1097/GME.0000000000001424', used: 'Symptom areas: hot flushes, sleep, mood, cognition, urogenital and sexual health.' },
  { key: 'avis', authors: 'Avis NE, Crawford SL, Greendale G, et al.', title: 'Duration of menopausal vasomotor symptoms over the menopause transition', journal: 'JAMA Intern Med 2015', url: 'https://doi.org/10.1001/jamainternmed.2014.8063', used: 'Hot flushes and night sweats often last years (median 7.4 years), and vary between women.' },
  { key: 'davis', authors: 'Davis SR, Lambrinoudaki I, Lumsden M, et al.', title: 'Menopause (Nature Reviews Disease Primers)', journal: 'Nat Rev Dis Primers 2015', url: 'https://doi.org/10.1038/nrdp.2015.4', used: 'The experience varies widely between women.' },
  { key: 'hickey', authors: 'Hickey M, LaCroix AZ, Doust J, et al.', title: 'An empowerment model for managing menopause (Lancet Series)', journal: 'Lancet 2024', url: 'https://doi.org/10.1016/S0140-6736(23)02799-X', used: 'She is the expert in her own experience; the app supports informed decisions with her clinician.' },
  { key: 'prior', authors: 'Henry S, Shirin S, Goshtasebi A, Prior JC', title: 'Within-woman variability of follicular and luteal phase lengths', journal: 'Hum Reprod 2024', url: 'https://doi.org/10.1093/humrep/deae215', used: 'Cycles vary within the same woman; no fixed 14-day second half is assumed.' },
  { key: 'nams2022', authors: 'The North American Menopause Society advisory panel', title: 'The 2022 hormone therapy position statement', journal: 'Menopause 2022', url: 'https://doi.org/10.1097/GME.0000000000002028', used: 'Treatment should be individualised by a clinician, so the app gives no treatment advice.' },
];
const SRC = SOURCES.find(s => s.key === 'straw10');
/** Published STRAW+10 numbers, kept in one place with their source. */
export const STRAW = Object.freeze({ VARIABILITY_DAYS: 7, PERSIST_WITHIN_CYCLES: 10, GAP_DAYS: 60, FMP_MONTHS: 12, source: { title: SRC.title, url: SRC.url, alsoAt: 'https://doi.org/10.1097/gme.0b013e31824d8f40' } });

export const INTRO = 'The years around menopause are different for everyone: which symptoms come, how strong they are and how long they last all varies widely between women. You are the expert in your own experience. This mode helps you keep a clear record to talk through with your doctor. It describes what you log and never diagnoses.';
export const RED_FLAGS = [
  'Any bleeding, even spotting, after 12 months without a period',
  'Very heavy bleeding (for example, soaking through a pad or tampon every hour), bleeding that lasts much longer than usual, or large clots',
  'Bleeding between periods or after sex',
  'Periods stopping or becoming irregular before the age of 40',
  'Chest pain, breathlessness or fainting: get urgent help',
  'Low mood that doesn\'t lift, or thoughts of harming yourself: get help now',
  'Symptoms that stop you doing your usual things',
];
const NOT_APPLICABLE = ['hormonalContraception', 'other', 'pregnant'];

/** Months between two dates, counted on the calendar (a month is reached on the same day number, or the month's end). */
function monthsBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  let m = (yb - ya) * 12 + (mb - ma);
  if (db < da && !(db === new Date(Date.UTC(yb, mb, 0)).getUTCDate())) m--;
  return Math.max(0, m);
}

export function midlifeObservations(s, today) {
  if (!hasConsent(s) || !s.situation?.perimenopause) return null;
  const blocking = NOT_APPLICABLE.filter(k => s.situation?.[k]);
  const base = { version: MIDLIFE_VERSION, reviewStatus: REVIEW_STATUS, redFlags: RED_FLAGS, alerts: [] };
  if (blocking.length) return { ...base, applicable: false, why: 'Bleeding-pattern descriptions are not shown while you use hormonal contraception, are pregnant, or have another condition or medicine that affects your cycle, because your bleeding pattern then doesn\'t show these changes (STRAW+10).' };

  const ps = [...s.periods].filter(p => p.start <= today).sort((a, b) => a.start.localeCompare(b.start));
  const lastDay = p => (p.end && p.end <= today ? p.end : p.start);
  // Cycle lengths between consecutive starts, unless she marked a missed log before the later start.
  // A gap that contains a pregnancy is not a cycle or a gap without periods (fixed after ec0c0f4).
  const spans = pregnantSpans(s), crossesPregnancy = (a, b) => spans.some(p => a < p.to && b > p.from);
  const cyc = [];
  for (let i = 0; i + 1 < ps.length; i++) if (!crossesPregnancy(ps[i].start, ps[i + 1].start)) cyc.push({ start: ps[i].start, next: ps[i + 1].start, length: diffDays(ps[i].start, ps[i + 1].start), missed: !!ps[i + 1].missedBefore, from: ps[i] });

  // 1. Variability: a ≥7-day difference between consecutive cycles, in two separate episodes within 10 cycles.
  const idx = [];
  const recent = cyc.filter(c => !c.missed).slice(-(STRAW.PERSIST_WITHIN_CYCLES + 1));
  for (let i = 1; i < recent.length; i++) if (Math.abs(recent[i].length - recent[i - 1].length) >= STRAW.VARIABILITY_DAYS) idx.push(i);
  let found = false;
  for (let a = 0; a < idx.length && !found; a++) for (let b = a + 1; b < idx.length; b++) if (idx[b] - idx[a] >= 2 && idx[b] - idx[a] <= STRAW.PERSIST_WITHIN_CYCLES) { found = true; break; }
  const lengths = recent.map(c => c.length);
  const variability = { found, lengths, text: found
    ? `Your logged cycles changed in length by ${STRAW.VARIABILITY_DAYS} days or more from one cycle to the next, more than once within ${STRAW.PERSIST_WITHIN_CYCLES} cycles (recent lengths: ${lengths.join(', ')} days). This is the kind of change menopause researchers describe in the years before menopause (STRAW+10). It has other causes too, so it isn't a diagnosis.`
    : lengths.length >= 2 ? `Your recent cycle lengths: ${lengths.join(', ')} days. No repeated change of ${STRAW.VARIABILITY_DAYS} days or more from one cycle to the next.` : 'Not enough logged cycles yet to describe how their length changes.' };

  // 2. Gaps of 60+ days without a logged period.
  let longest = null;
  for (const c of cyc) { if (c.missed) continue; const days = diffDays(lastDay(c.from), c.next) - 1; if (!longest || days > longest.days) longest = { days, from: lastDay(c.from), next: c.next }; }
  const gapFound = !!longest && longest.days >= STRAW.GAP_DAYS;
  const longGap = { found: gapFound, longestDays: longest?.days ?? null, text: gapFound
    ? `You had ${longest.days} days without a logged period (after ${human(longest.from)}, until ${human(longest.next)}). Menopause researchers describe gaps of ${STRAW.GAP_DAYS} days or more in the later part of the transition (STRAW+10). If you may have missed logging a period, mark it in your history.`
    : longest ? `Your longest gap without a logged period was ${longest.days} days.` : 'No gaps to describe yet.' };

  // 3. Time since the last logged period, and bleeding after 12 months without one.
  // After a pregnancy, the months are counted from its end, not from the last period before it; while she is marked
  // as recently given birth or breastfeeding, a long time without periods is common and is not compared at all.
  const last = ps.at(-1), since = restartDate(s, today), postpartum = !!s.situation?.postpartum;
  let sinceLastPeriod = null;
  if (last) {
    const afterPregnancy = !!since && lastDay(last) < since;
    const from = afterPregnancy ? since : lastDay(last), months = monthsBetween(from, today), twelve = !postpartum && months >= STRAW.FMP_MONTHS;
    const what = afterPregnancy ? `your pregnancy ended (${human(since)})` : 'your last logged period';
    sinceLastPeriod = { from, months, twelveMonths: twelve, afterPregnancy, text: twelve
      ? `It has been ${months} months since ${what}. Looking back, 12 months without a period is how menopause is defined (STRAW+10). Any bleeding from now on, even spotting, should be checked by a doctor.`
      : `It has been ${months} ${months === 1 ? 'month' : 'months'} since ${what}.${afterPregnancy || postpartum ? ' Periods can take many months to come back after a pregnancy, often longer while breastfeeding, so this time is not compared with the 12-month menopause definition' + (postpartum ? ' while you are marked as recently given birth or breastfeeding.' : ' until 12 months after the pregnancy ended.') : ''}` };
  }
  const bleedDates = [...ps.map(p => p.start), ...Object.entries(s.days).filter(([d, v]) => d <= today && (v.bleeding === 'period' || v.bleeding === 'spotting')).map(([d]) => d)].sort();
  let afterTwelve = false;
  for (const d of bleedDates) {
    if (postpartum) break;
    const prev = ps.filter(p => lastDay(p) < d).at(-1); if (!prev) continue;
    const ended = spans.filter(p => p.to >= lastDay(prev) && p.to < d).map(p => p.to).sort().at(-1); // a pregnancy in between
    if (monthsBetween(ended || lastDay(prev), d) >= STRAW.FMP_MONTHS) { afterTwelve = true; break; }
  }
  const alerts = afterTwelve ? ['You logged bleeding after 12 months or more without a period. Please see a doctor to have this checked.'] : [];
  return { ...base, applicable: true, variability, longGap, sinceLastPeriod, bleedingAfterTwelveMonths: afterTwelve, alerts };
}
