// Perimenopause and menopause mode (flag midlifeMode, default OFF), built from the published literature listed in
// docs/midlife-evidence.md. Written BEFORE the implementation; the failing run is committed in docs/test-logs/.
// Synthetic data only. Run: node tests/cycle-midlife.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { FLAG_DEFS, readFlags } from '../js/cycle/flags.js';
import { clinicianSummary } from '../js/cycle/summary.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
let L = {}; try { L = await import('../js/cycle/midlife.js'); } catch (e) { check('module js/cycle/midlife.js exists', false, e.message); }
const obs = L.midlifeObservations || (() => null);
const T = '2026-06-30', AT = '2026-06-30T08:00:00.000Z';
const fresh = () => { const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z'); return s; };
/** Period starts from a list of cycle lengths, ending so that the last start is `last`. */
function withLengths(lengths, last = '2026-06-01') {
  const s = fresh(); let d = last; const starts = [last];
  for (const L of [...lengths].reverse()) { d = addDays(d, -L); starts.unshift(d); }
  for (const st of starts) M.logPeriodStart(s, st, { today: T, at: `${st}T09:00:00.000Z` });
  return s;
}
const midlife = s => { M.setSituation(s, 'perimenopause', true, { at: AT }); return s; };
const words = v => JSON.stringify(v);
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };

run('flag', () => {
  check('a separate flag, off by default', FLAG_DEFS.midlifeMode?.default === false && readFlags({ getItem: () => null }).midlifeMode === false);
});

/* ---------- Symptoms (own wording; domains from validated instruments and consensus terminology) ---------- */
run('symptoms', () => {
  const keys = ['hotFlushes', 'focus', 'aches', 'heartRacing', 'dryness', 'bladder'];
  check('six midlife symptom categories exist', keys.every(k => M.CATEGORIES[k]), keys.filter(k => !M.CATEGORIES[k]).join());
  check('they are grouped as "midlife" (shown only in perimenopause mode)', keys.every(k => M.CATEGORIES[k]?.group === 'midlife'));
  check('each uses none / mild / moderate / severe, moderate or severe being notable', keys.every(k => JSON.stringify(M.CATEGORIES[k]?.options.map(o => o[0])) === '["none","mild","moderate","severe"]' && JSON.stringify(M.CATEGORIES[k]?.notable) === '["moderate","severe"]'));
  check('each explanation says what it is in plain words', keys.every(k => (M.CATEGORIES[k]?.why || '').length > 20));
  check('hot flushes include night sweats', /night sweats/i.test(M.CATEGORIES.hotFlushes?.label + M.CATEGORIES.hotFlushes?.why));
  check('heart racing says to get urgent help for chest pain, breathlessness or fainting', /chest pain/i.test(M.CATEGORIES.heartRacing?.why || '') && /urgent/i.test(M.CATEGORIES.heartRacing?.why || ''));
  const s = fresh();
  let e = null; try { M.logDay(s, '2026-06-02', { hotFlushes: 'moderate' }, { today: T, at: AT }); } catch (x) { e = x.code; }
  check('off until switched on, like every category', e === 'CATEGORY_OFF');
  M.setCategory(s, 'hotFlushes', true, { at: AT }); M.logDay(s, '2026-06-02', { hotFlushes: 'moderate' }, { today: T, at: AT });
  check('once on, logged and counted in the doctor summary', clinicianSummary(s, { today: T, months: 3 }).symptoms.some(x => x.category === 'hotFlushes' && x.daysLogged === 1));
  check('the older categories are not in the midlife group', !M.CATEGORIES.pain.group && !M.CATEGORIES.sleep.group);
});

/* ---------- Bleeding-pattern observations (STRAW+10 criteria, described, never diagnosed) ---------- */
run('observations', () => {
  check('nothing unless she marked perimenopause or menopause', obs(withLengths([28, 29, 28]), T) === null);
  check('STRAW+10 numbers are the published ones, kept in one place', L.STRAW?.VARIABILITY_DAYS === 7 && L.STRAW?.PERSIST_WITHIN_CYCLES === 10 && L.STRAW?.GAP_DAYS === 60 && L.STRAW?.FMP_MONTHS === 12 && /10\.1210\/jc\.2011-3362|10\.1097\/gme\.0b013e31824d8f40/.test(words(L.STRAW?.source)));
  const steady = obs(midlife(withLengths([28, 29, 28, 30])), T);
  check('steady cycles: no variability observation', steady && steady.applicable === true && steady.variability.found === false && steady.longGap.found === false, words(steady));
  // One odd cycle makes two adjacent differences (up, then back down). That is ONE episode, not a recurrence
  // (a conservative reading of "persistent"; see docs/midlife-evidence.md).
  check('one odd cycle (28, 36, 29) is a single episode, not described as persistent', obs(midlife(withLengths([28, 36, 29, 28, 29])), T)?.variability.found === false);
  check('a difference of 7+ days that recurs within 10 cycles is described', obs(midlife(withLengths([28, 36, 28, 37, 29])), T)?.variability.found === true);
  const v = obs(midlife(withLengths([28, 36, 28, 37, 29])), T)?.variability || {};
  check('the description gives her own cycle lengths and the published criterion, with the source', /36/.test(v.text || '') && /7 days or more/i.test(v.text || '') && /within 10 cycles/i.test(v.text || ''), v.text);
  check('it never says she IS in perimenopause or menopause (no diagnosis)', !/you are (in|perimenopausal|menopausal)|you have (perimenopause|menopause)|diagnos(is|ed) (of|with)/i.test(words(obs(midlife(withLengths([28, 36, 28, 37, 29])), T))));
  check('it says other things can cause it', /other (causes|things|reasons)/i.test(v.text || ''), v.text);
  const single = obs(midlife(withLengths([28, 29, 28, 29, 40])), T)?.variability || {};
  check('a single change that has not recurred is not described as persistent', single.found === false, words(single));
  const gap = obs(midlife(withLengths([28, 30, 64, 29])), T)?.longGap || {};
  // STRAW+10 counts days WITHOUT bleeding. With no end logged, the period is taken as its start day only (never invented).
  check('60+ days without a logged period (64-day cycle, no end logged → 63 days) is described', gap.found === true && gap.longestDays === 63 && /60 days or more/i.test(gap.text || ''), words(gap));
  const missed = midlife(withLengths([28, 30, 64, 29])); const p = missed.periods.find(x => x.start === addDays('2026-06-01', -29)); M.editPeriod(missed, p.id, { missedBefore: true }, { today: T, at: AT });
  check('a gap she marked as a missed log is not counted', obs(missed, T)?.longGap.found === false);
});

/* ---------- 12 months without a period, and bleeding after it ---------- */
run('twelve months', () => {
  const s = midlife(fresh()); M.logPeriodStart(s, '2025-05-10', { today: T, at: AT }); M.logPeriodEnd(s, s.periods[0].id, '2025-05-14', { today: T, at: AT });
  const o = obs(s, T) || {};
  check('12+ months since the last logged period: milestone, explained as looked back on', o.sinceLastPeriod?.twelveMonths === true && /12 months/i.test(o.sinceLastPeriod?.text || '') && /looking back|looked back/i.test(o.sinceLastPeriod?.text || ''), words(o.sinceLastPeriod));
  check('and it says any bleeding from now on should be checked by a doctor', /bleed/i.test(o.sinceLastPeriod?.text || '') && /doctor/i.test(o.sinceLastPeriod?.text || ''));
  const s2 = midlife(fresh()); M.logPeriodStart(s2, '2026-05-01', { today: T, at: AT });
  check('under 12 months: counts the months, no milestone', obs(s2, T)?.sinceLastPeriod?.twelveMonths === false);
  const s3 = midlife(fresh()); M.logPeriodStart(s3, '2025-03-01', { today: T, at: AT }); M.logPeriodStart(s3, '2026-06-20', { today: T, at: AT });
  const w = obs(s3, T) || {};
  check('bleeding logged after 12+ months without a period: a prominent "see a doctor" warning', w.bleedingAfterTwelveMonths === true && w.alerts?.some(a => /doctor/i.test(a)), words(w.alerts));
  const s4 = midlife(fresh()); M.logPeriodStart(s4, '2025-03-01', { today: T, at: AT }); M.logDay(s4, '2026-06-20', { bleeding: 'spotting' }, { today: T, at: AT });
  check('spotting after 12+ months counts too', obs(s4, T)?.bleedingAfterTwelveMonths === true);
});

/* ---------- When the criteria don't apply ---------- */
run('not applicable', () => {
  for (const sit of ['hormonalContraception', 'other']) {
    const s = midlife(withLengths([28, 36, 28, 37, 29])); M.setSituation(s, sit, true, { at: AT });
    const o = obs(s, T);
    check(`not applicable with "${sit}": no bleeding-pattern observations, and it says why`, o?.applicable === false && !o.variability && /bleeding pattern/i.test(o.why || ''), words(o));
  }
  const p = midlife(fresh()); M.setSituation(p, 'pregnant', true, { at: AT });
  check('not applicable while pregnant', obs(p, T)?.applicable === false);
});

/* ---------- Safety, sources, wording ---------- */
run('safety', () => {
  const o = obs(midlife(withLengths([28, 36, 28, 37, 29])), T) || {};
  check('warning signs always included', (o.redFlags || []).length >= 5 && o.redFlags.some(x => /after 12 months/i.test(x)) && o.redFlags.some(x => /before (the age of )?40|under 40/i.test(x)) && o.redFlags.some(x => /harm|suicid/i.test(x)), words(o.redFlags));
  check('marked as awaiting clinician review', o.reviewStatus === 'awaiting_clinician_review');
  check('sources are listed with DOI links (at least 8)', (L.SOURCES || []).length >= 8 && L.SOURCES.every(x => /^https:\/\/doi\.org\/10\./.test(x.url) && x.authors && x.title), words((L.SOURCES || []).slice(0, 2)));
  check('no hormone, medicine or dose advice', !/hormone therapy|HRT|estrogen|oestrogen|progesterone|tablet|dose|\bmg\b|supplement/i.test(words(o) + words(L.INTRO || '')), (words(o) + words(L.INTRO || '')).match(/hormone therapy|HRT|estrogen|oestrogen|progesterone|tablet|dose|\bmg\b|supplement/i)?.[0]);
  check('no forbidden wording (output policy)', !FORBIDDEN.some(([, re]) => re.test(words(o) + words(L.INTRO || ''))));
  check('the intro says experiences vary widely and she is the expert in her own experience', /vari/i.test(L.INTRO || '') && /expert/i.test(L.INTRO || ''), L.INTRO);
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
