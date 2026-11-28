// "Missing links" found in the Hume / WHOOP / Oura comparison (docs/competitor-gaps.md), built into our app.
// Written BEFORE the implementation; the failing run is committed in docs/test-logs/. Synthetic data only.
//   A. Learning stage: an honest "learning your cycle: n of 3 cycles" status (uses the existing 3-cycle minimum).
//   B. Band gaps: nights recorded this cycle and whether last night was recorded. Nothing is ever filled in.
//   C. Night disruptors: alcohol, a late night, a hot or cold room are optional per-night entries, and the
//      temperature research rule leaves those nights out (as it already does for unwell / travelling).
//   D. Comfort suggestions that learn what helps HER: offered after moderate or severe pain is logged, only
//      low-risk options with published evidence, "did it help?" afterwards, her own record decides the order.
//      Warning signs always shown; never medicines, supplements, doses, calories or weight.
//   E. Training feel: an optional category so her own pattern can show (no phase-based training rules).
//   F. Hume Band: a placeholder that refuses to connect until it is verified (app and research prototype).
// Run: node tests/cycle-missing-links.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { SHIFT_VERSION, retrospectiveShift } from '../js/cycle/tempshift.js';
import { readFlags, FLAG_DEFS } from '../js/cycle/flags.js';
import { estimateNext } from '../js/cycle/predict.js';
import * as W from '../js/cycle/wearables.js';
import { clinicianSummary } from '../js/cycle/summary.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const imp = async p => { try { return await import(p); } catch (e) { check(`module ${p} exists`, false, e.message); return {}; } };
const L = await imp('../js/cycle/learning.js'), C = await imp('../js/cycle/comfort.js');
const RA = await import('../research/lib/adapters.js');
const T = '2026-06-30', AT = '2026-06-30T08:00:00.000Z';
const fresh = () => { const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z'); return s; };
const withStarts = (s, starts) => { for (const d of starts) M.logPeriodStart(s, d, { today: T, at: `${d}T09:00:00.000Z` }); return s; };
const allText = v => JSON.stringify(v);

/* ---------- A. Learning stage ---------- */
try {
  const ls = L.learningStage || (() => ({}));
  const s0 = fresh();
  check('A no period logged: stage "not_started", tells her what to do first', ls(s0, T).stage === 'not_started' && /first period/i.test(ls(s0, T).text || ''), allText(ls(s0, T)));
  const s1 = withStarts(fresh(), ['2026-06-10']);
  check('A one start: "first_cycle", an estimate appears after the next start', ls(s1, T).stage === 'first_cycle' && ls(s1, T).usableCycles === 0 && /next period/i.test(ls(s1, T).text || ''), allText(ls(s1, T)));
  const s2 = withStarts(fresh(), ['2026-05-01', '2026-05-30']);
  const l2 = ls(s2, T);
  check('A one complete cycle: "learning", 1 of 3 cycles', l2.stage === 'learning' && l2.usableCycles === 1 && l2.needed === 3 && /1 of 3/.test(l2.text || ''), allText(l2));
  const s3 = withStarts(fresh(), ['2026-03-01', '2026-03-30', '2026-04-28', '2026-05-27']);
  const l3 = ls(s3, T);
  check('A three complete cycles: "learned", and it keeps updating', l3.stage === 'learned' && l3.usableCycles === 3 && /keeps updating/i.test(l3.text || ''), allText(l3));
  check('A the 3-cycle threshold is the estimate\'s own (no new number)', l3.needed === 3 && estimateNext(s3, T).status !== 'early' && estimateNext(s2, T).status === 'early');
  // A cycle marked as a missed log does not count.
  const s4 = withStarts(fresh(), ['2026-03-01', '2026-03-30', '2026-04-28', '2026-05-27']); M.editPeriod(s4, s4.periods[3].id, { missedBefore: true }, { today: T, at: AT });
  check('A a cycle with a missed log does not count towards learning', ls(s4, T).usableCycles === 2 && ls(s4, T).stage === 'learning', allText(ls(s4, T)));
  check('A pregnancy pauses the learning message too', (() => { const s = withStarts(fresh(), ['2026-03-01', '2026-03-30']); M.setSituation(s, 'pregnant', true, { at: AT }); return ls(s, T).stage === 'paused'; })());
} catch (e) { check('A section ran to the end', false, e.stack.split('\n').slice(0, 2).join(' ')); }

/* ---------- B. Band gaps: honest about nights not recorded ---------- */
try {
  const ls = L.learningStage || (() => ({}));
  const s = withStarts(fresh(), ['2026-06-20']);
  check('B no band consent: no band section', !ls(s, T).band);
  M.setScopeConsent(s, 'wearable', true, AT);
  const night = (n, status = 'ok') => ({ night: n, deviceId: 'd1', model: 'SYN', firmware: '1', metric: 'skin_temp', status, value: status === 'ok' ? 33.5 : null, flags: [], samples: status === 'ok' ? 48 : 3, coverageMin: status === 'ok' ? 480 : 30 });
  s.wearable.nights = ['2026-06-20', '2026-06-21', '2026-06-23', '2026-06-24', '2026-06-25'].map(n => night(n)).concat([night('2026-06-28', 'insufficient_wear')]);
  const b = ls(s, T).band || {};
  check('B counts nights recorded this cycle (usable ones only)', b.nightsThisCycle === 5, allText(b));
  check('B says how many nights the temperature research needs (its own 6 + 3)', b.neededForTemperature === 9, allText(b));
  check('B last night (29th) not recorded: says so plainly', b.lastNight === 'not_recorded' && /didn't record last night/i.test(b.text || ''), allText(b));
  check('B and says nothing is filled in, and the period estimate does not depend on the band', /nothing is filled in/i.test(b.text || '') && /estimate/i.test(b.text || ''), b.text);
  s.wearable.nights.push(night('2026-06-29', 'insufficient_wear'));
  check('B last night too short: "too little wear"', (ls(s, T).band || {}).lastNight === 'too_little_wear', allText(ls(s, T).band));
  s.wearable.nights = s.wearable.nights.filter(n => n.night !== '2026-06-29'); s.wearable.nights.push(night('2026-06-29'));
  check('B last night recorded: "recorded", no warning', (ls(s, T).band || {}).lastNight === 'recorded' && !/didn't record/i.test((ls(s, T).band || {}).text || ''));
} catch (e) { check('B section ran to the end', false, e.stack.split('\n').slice(0, 2).join(' ')); }

/* ---------- C. Night disruptors leave nights out of the temperature research ---------- */
try {
  const s = withStarts(fresh(), ['2026-06-01']);
  let threw = null;
  try { M.logDay(s, '2026-06-05', { alcohol: true, lateNight: true, hotOrColdRoom: true }, { today: T, at: AT }); } catch (e) { threw = e.code; }
  check('C alcohol, late night and hot or cold room can be logged per night (true/false)', !threw && s.days['2026-06-05'].alcohol === true && s.days['2026-06-05'].hotOrColdRoom === true, String(threw));
  let bad = null; try { M.logDay(s, '2026-06-05', { alcohol: 'lots' }, { today: T, at: AT }); } catch (e) { bad = e.code; }
  check('C only true or false is accepted', bad === 'INVALID_INPUT');
  M.logDay(s, '2026-06-05', { alcohol: false }, { today: T, at: AT });
  check('C unticking removes it', !('alcohol' in s.days['2026-06-05']));
  check('C M.NIGHT_DISRUPTORS lists them with unwell and travel', JSON.stringify(M.NIGHT_DISRUPTORS) === JSON.stringify(['unwell', 'travel', 'alcohol', 'lateNight', 'hotOrColdRoom']), JSON.stringify(M.NIGHT_DISRUPTORS));
  // Synthetic nights: 6 low then 3 high; marking a high night as "hot room" must remove it.
  const s2 = withStarts(fresh(), ['2026-06-01']); M.setScopeConsent(s2, 'wearable', true, AT);
  s2.wearable.nights = Array.from({ length: 12 }, (_, i) => ({ night: addDays('2026-06-03', i), deviceId: 'd1', model: 'SYN', firmware: '1', metric: 'skin_temp', status: 'ok', value: i < 6 ? 33.4 : 33.8, flags: [], coverageMin: 480 }));
  const before = retrospectiveShift(s2, '2026-06-01', '2026-06-20');
  M.logDay(s2, addDays('2026-06-03', 6), { hotOrColdRoom: true }, { today: T, at: AT });
  M.logDay(s2, addDays('2026-06-03', 7), { alcohol: true }, { today: T, at: AT });
  const after = retrospectiveShift(s2, '2026-06-01', '2026-06-20');
  check('C nights marked hot or cold room / alcohol are excluded from the temperature rule', after.excluded.userFlagged === 2 && after.nightsUsed === before.nightsUsed - 2, `${before.nightsUsed} → ${after.nightsUsed}, userFlagged ${after.excluded?.userFlagged}`);
  check('C the rule version changed (behaviour changed) and still names the night aggregation', SHIFT_VERSION !== 'three-over-six-skin-0.3.0-night-aggregated-onset-interval-research' && /night/.test(SHIFT_VERSION) && /research/.test(SHIFT_VERSION), SHIFT_VERSION);
} catch (e) { check('C section ran to the end', false, e.stack.split('\n').slice(0, 2).join(' ')); }

/* ---------- D. Comfort suggestions that learn what helps her ---------- */
try {
  check('D a separate flag, off by default', FLAG_DEFS.comfortSuggestions?.default === false && readFlags({ getItem: () => null }).comfortSuggestions === false);
  const sugg = C.comfortSuggestions || (() => null);
  const s = withStarts(fresh(), ['2026-06-28']);
  check('D nothing without the pain category on', sugg(s, T) === null);
  M.setCategory(s, 'pain', true, { at: AT });
  check('D nothing when no pain is logged today', sugg(s, T) === null);
  M.logDay(s, T, { pain: 'mild' }, { today: T, at: AT });
  check('D nothing for mild pain (only moderate or severe, the category\'s own "notable" values)', sugg(s, T) === null);
  M.logDay(s, T, { pain: 'moderate' }, { today: T, at: AT });
  const g = sugg(s, T) || {};
  const ids = (g.options || []).map(o => o.id);
  check('D moderate pain: offers heat, gentle movement and a warm drink', JSON.stringify([...ids].sort()) === JSON.stringify(['heat', 'movement', 'warmDrink']), JSON.stringify(ids));
  check('D every option cites published evidence (DOI links)', (g.options || []).every(o => o.evidence?.length && o.evidence.every(e => /^https:\/\/doi\.org\/10\./.test(e.url))), allText(g.options));
  check('D warning signs are always included', (g.redFlags || []).length >= 5 && g.redFlags.some(x => /heavy bleeding/i.test(x)) && g.redFlags.some(x => /faint/i.test(x)));
  check('D the wording is marked as awaiting clinician review', g.reviewStatus === 'awaiting_clinician_review');
  check('D says it is not treatment and that results differ between people', /not (medical advice|a treatment)/i.test(g.note || '') && /differ|different/i.test(g.note || ''), g.note);
  const words = allText(g);
  check('D never suggests medicines, supplements, doses, calories or weight', !/ibuprofen|paracetamol|naproxen|nsaid|painkiller|medicine|medication|supplement|omega|vitamin|magnesium|\bmg\b|dose|calorie|weight loss|diet/i.test(words.replace(/talk to a doctor|see a doctor|doctor/gi, '')), words.match(/ibuprofen|paracetamol|naproxen|nsaid|painkiller|medicine|medication|supplement|omega|vitamin|magnesium|\bmg\b|dose|calorie|weight loss|diet/i)?.[0]);
  check('D no forbidden wording (output policy)', !FORBIDDEN.some(([, re]) => re.test(words)));
  M.logDay(s, T, { pain: 'severe' }, { today: T, at: AT });
  check('D severe pain: warning signs come first', sugg(s, T)?.severe === true);
  // Trying and answering.
  const tryIt = (d, opt, at = `${d}T10:00:00.000Z`) => C.logComfortTry(s, d, opt, { today: T, at });
  let e1 = null; try { C.logComfortTry(s, T, 'ibuprofen', { today: T, at: AT }); } catch (e) { e1 = e.code; }
  check('D only the listed options can be logged', e1 === 'INVALID_INPUT');
  let e2 = null; try { C.logComfortTry(s, addDays(T, 1), 'heat', { today: T, at: AT }); } catch (e) { e2 = e.code; }
  check('D not in the future', e2 === 'FUTURE_DATE');
  const t1 = tryIt('2026-06-29', 'heat'), t2 = tryIt('2026-06-29', 'movement'), t3 = tryIt('2026-06-26', 'warmDrink');
  const pend = (C.pendingComfortQuestions || (() => []))(s, T);
  check('D "did it help?" is asked for recent tries (last 3 days) and not for older ones', pend.map(p => p.id).sort().join() === [t1.id, t2.id].sort().join(), JSON.stringify(pend.map(p => p.option)));
  let e3 = null; try { C.answerComfort(s, t1.id, 'maybe', { at: AT }); } catch (e) { e3 = e.code; }
  check('D answers are yes / a little / no only', e3 === 'INVALID_INPUT');
  C.answerComfort(s, t1.id, 'no', { at: AT }); C.answerComfort(s, t2.id, 'yes', { at: AT });
  check('D answered tries are not asked again; an unanswered old try stays unknown (never assumed)', (C.pendingComfortQuestions(s, T) || []).length === 0 && s.comfort.tries.find(x => x.id === t3.id).helped == null);
  // Her own record reorders the options.
  for (const d of ['2026-06-20', '2026-06-21']) { C.answerComfort(s, tryIt(d, 'movement').id, 'yes', { at: AT }); C.answerComfort(s, tryIt(d, 'heat').id, 'no', { at: AT }); }
  const o = sugg(s, T).options;
  check('D what helped her comes first; what didn\'t comes last', o[0].id === 'movement' && o.at(-1).id === 'heat', o.map(x => x.id).join());
  check('D her record is shown with its denominator ("helped 3 of 3 times you answered")', o[0].own.answered === 3 && o[0].own.helped === 3 && /3 of 3/.test(o[0].own.text || ''), allText(o[0].own));
  check('D an option she never tried says so, with no claim', o.find(x => x.id === 'warmDrink').own.answered === 0 && /not answered yet|haven't/i.test(o.find(x => x.id === 'warmDrink').own.text || ''), o.find(x => x.id === 'warmDrink').own.text);
  // Privacy: purging the pain category deletes comfort records (they reveal pain); a separate delete exists too.
  const s2 = JSON.parse(JSON.stringify(s));
  M.setCategory(s2, 'pain', false, { purge: true, at: AT });
  check('D turning pain off AND deleting also deletes the comfort records', !(s2.comfort?.tries?.length));
  const s3 = JSON.parse(JSON.stringify(s)); C.deleteComfort(s3);
  check('D "delete my comfort records" works on its own', !(s3.comfort?.tries?.length));
  M.setCategory(s, 'pain', false, { purge: false, at: AT });
  check('D turning pain off without deleting stops new suggestions but keeps records', sugg(s, T) === null && s.comfort.tries.length > 0);
  let e4 = null; try { C.logComfortTry(s, T, 'heat', { today: T, at: AT }); } catch (e) { e4 = e.code; }
  check('D no new comfort entries while pain logging is off', e4 === 'CATEGORY_OFF');
  check('D no consent, no entries', (() => { try { C.logComfortTry(M.blankState('x'), T, 'heat', { today: T }); return false; } catch (e) { return e.code === 'NO_CONSENT'; } })());
} catch (e) { check('D section ran to the end', false, e.stack.split('\n').slice(0, 2).join(' ')); }

/* ---------- E. Training feel ---------- */
try {
  const t = M.CATEGORIES.training;
  check('E "training" is an optional category: easier / usual / harder', !!t && JSON.stringify(t.options.map(o => o[0])) === '["easier","usual","harder"]');
  check('E its explanation says no training advice is given by cycle phase', /no .*advice.*phase|not.*by cycle phase/i.test(t?.why || ''), t?.why);
  const s = withStarts(fresh(), ['2026-06-01']);
  let e = null; try { M.logDay(s, '2026-06-02', { training: 'harder' }, { today: T, at: AT }); } catch (x) { e = x.code; }
  check('E off until switched on, like every category', e === 'CATEGORY_OFF');
  M.setCategory(s, 'training', true, { at: AT }); M.logDay(s, '2026-06-02', { training: 'harder' }, { today: T, at: AT });
  check('E once on, it is logged and appears in the doctor summary counts', s.days['2026-06-02'].training === 'harder' && clinicianSummary(s, { today: T, months: 3 }).symptoms.some(x => x.category === 'training' && x.daysLogged === 1));
} catch (e) { check('E section ran to the end', false, e.stack.split('\n').slice(0, 2).join(' ')); }

/* ---------- F. Hume Band: placeholder until verified ---------- */
try {
  const H = W.HumeBandAdapter ? new W.HumeBandAdapter() : null;
  check('F app: a Hume Band adapter exists and is not verified', !!H && H.verified === false && /hume/i.test(H.displayName));
  let code = null; try { await H?.connect(); } catch (e) { code = e.code; }
  check('F app: it refuses to connect (NOT_VERIFIED) and says why', code === 'NOT_VERIFIED' && /not verified|unverified/i.test(H?.status || '') && /no cycle/i.test(H?.status || ''), H?.status);
  check('F app: listed with the other adapters', typeof W.ADAPTERS?.['hume-band'] === 'function');
  const R = RA.HumeBandAdapter ? RA.HumeBandAdapter() : null;
  let rc = null; try { R?.preview(); } catch (e) { rc = e.code; }
  check('F research prototype: a Hume Band stub that refuses to import and returns the supplier questions', !!R && R.verified === false && rc === 'adapter_not_implemented');
} catch (e) { check('F section ran to the end', false, e.stack.split('\n').slice(0, 2).join(' ')); }
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
