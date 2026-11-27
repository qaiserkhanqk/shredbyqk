// Premenstrual patterns (js/cycle/premenstrual.js) and the question budget (js/cycle/asks.js). Written BEFORE the
// modules. Synthetic data only.
// Rule, from published criteria (not invented): a symptom is "her premenstrual pattern" only if, in each of her last 3
// cycles where she logged it, it was notable in the 5 days before her period and NOT notable on cycle days 5 to 12
// (ACOG's PMS criteria: symptoms in the 5 days before menses in each of 3 cycles, eased within 4 days of the period
// starting, not back before cycle day 13; ACOG Clinical Practice Guideline No. 7, 2023: timing is key and a symptom
// log over several cycles; daily ratings as in the DRSP, Endicott et al. 2006). Cycles are counted BACKWARDS from each
// period, so the pattern is found even when her cycle length varies.
// UPDATE 2026-11-27 (same day, before release): the synthetic comparison (tools/premenstrual-eval.mjs,
// docs/premenstrual-patterns.md) showed the strict rule above found only 13-16% of real patterns, because one
// occasional symptom in the week after cancelled a cycle. The app now uses the C-PASS rule (Eisenlohr-Moul et al. 2017,
// calibrated against expert diagnosis): in each of her last 3 cycles with logs, the average on days -7..-1 before her
// period is at least 30% of the scale above the average on cycle days 4..10. False patterns stayed at 0.2-0.5%;
// patterns found rose to 32-35%. The strict ACOG rule stays available for comparison.
// Product owner (2026-11-27): personal, but never "too many questions": at most one check-in a day, no new
// notifications, at most 3 taps, Zara backs off after repeated "Not now", and a "Light" setting.
// Run: node tests/premenstrual.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { startPregnancy } from '../js/cycle/pregnancy.js';
import { companionToday, answerCheckIn, dismissCompanion } from '../js/cycle/companion.js';
import { readFlags, FLAG_DEFS } from '../js/cycle/flags.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
const words = v => JSON.stringify(v), AT = '2026-01-01T00:00:00.000Z', FAR = '2027-12-31';
let P = {}, A = {};
try { P = await import('../js/cycle/premenstrual.js'); } catch (e) { check('module js/cycle/premenstrual.js exists', false, e.message); }
try { A = await import('../js/cycle/asks.js'); } catch (e) { check('module js/cycle/asks.js exists', false, e.message); }

/** Cycles of the given lengths from `first`. `pre(cycleIndex)` = value logged on each of the 4 days before the next
 *  period; `post(cycleIndex)` = value logged on cycle days 5..12. Categories are turned on first. */
function person(lens, { cat = 'cravings', pre = () => 'strong', post = () => 'none', cats = ['cravings', 'sleep', 'mood'], first = '2026-01-05' } = {}) {
  const s = M.blankState('u'); M.giveConsent(s, AT);
  for (const c of cats) M.setCategory(s, c, true);
  const starts = [first]; for (const l of lens) starts.push(addDays(starts.at(-1), l));
  for (const st of starts) M.logPeriodStart(s, st, { today: FAR, at: AT });
  for (let i = 0; i + 1 < starts.length; i++) {
    const next = starts[i + 1];
    for (let d = 1; d <= 4; d++) { const v = pre(i); if (v != null && M.categoryOn(s, cat)) M.logDay(s, addDays(next, -d), { [cat]: v }, { today: FAR, at: AT }); }
    for (let d = 5; d <= 12; d++) { const v = post(i); if (v != null && M.categoryOn(s, cat)) M.logDay(s, addDays(starts[i], d - 1), { [cat]: v }, { today: FAR, at: AT }); }
  }
  return { s, starts, last: starts.at(-1) };
}

run('the rule and its sources', () => {
  check('the app uses the C-PASS rule: days -7..-1 vs cycle days 4..10, a rise of at least 30% of the scale, in 3 cycles', P.DEFAULT_RULE === 'cpass' && words(P.CPASS_RULE && { b: P.CPASS_RULE.BEFORE_DAYS, f: P.CPASS_RULE.AFTER_FROM_DAY, t: P.CPASS_RULE.AFTER_TO_DAY, e: P.CPASS_RULE.ELEVATION, n: P.CPASS_RULE.MIN_CYCLES }) === words({ b: 7, f: 4, t: 10, e: 0.3, n: 3 }), words({ d: P.DEFAULT_RULE, r: P.CPASS_RULE }));
  check('the strict ACOG rule (5 days before; nothing on days 5 to 12) is kept for comparison', words(P.PMS_RULE && { b: P.PMS_RULE.BEFORE_DAYS, f: P.PMS_RULE.AFTER_FROM_DAY, t: P.PMS_RULE.AFTER_TO_DAY, n: P.PMS_RULE.MIN_CYCLES }) === words({ b: 5, f: 5, t: 12, n: 3 }), words(P.PMS_RULE));
  const src = words(P.SOURCES || []);
  check('sources: ACOG guideline No. 7 (2023), the DRSP (Endicott 2006) and C-PASS (Eisenlohr-Moul 2017), with DOIs', /10\.1097\/AOG\.0000000000005426/.test(src) && /10\.1007\/s00737-005-0103-y/.test(src) && /10\.1176\/appi\.ajp\.2016\.15121510/.test(src));
  check('the flag is off by default', FLAG_DEFS.premenstrualPatterns?.default === false && readFlags({ getItem: () => null }).premenstrualPatterns === false);
  check('new optional symptoms: bloating, breast tenderness, headache, appetite', ['bloating', 'breasts', 'headache', 'appetite'].every(k => M.CATEGORIES[k] && !M.CATEGORIES[k].group && M.CATEGORIES[k].notable?.length), words(Object.keys(M.CATEGORIES)));
  check('…and each new symptom is off until she turns it on', ['bloating', 'breasts', 'headache', 'appetite'].every(k => !M.categoryOn((() => { const s = M.blankState('u'); M.giveConsent(s, AT); return s; })(), k)));
});

run('finding her pattern', () => {
  const t = '2026-06-01';
  const { s } = person([28, 28, 28, 28]);
  const r = P.premenstrualPatterns(s, t);
  const c = r.patterns?.find(x => x.category === 'cravings');
  check('strong cravings before each period and not in the week after: found, in 3 of her last 3 cycles', r.status === 'found' && c?.cycles === 3 && c?.of === 3, words(r));
  check('…described with the counts and the timing', /3 of your last 3 cycles/.test(c?.text || '') && /7 days before/.test(c?.text || ''), c?.text);
  const occ = person([28, 28, 28, 28], { post: () => 'none' });
  occ.s.days[addDays(occ.starts[2], 6)].cravings = 'strong'; // one occasional craving on day 7 of one cycle
  check('one occasional craving in the week after does not cancel a clear pattern (the reason for C-PASS)', P.premenstrualPatterns(occ.s, t).patterns?.some(x => x.category === 'cravings'), words(P.premenstrualPatterns(occ.s, t)));
  const v = person([24, 33, 27, 31]);
  check('found even when her cycle length varies (24, 33, 27, 31 days): counted back from each period', P.premenstrualPatterns(v.s, t).patterns?.some(x => x.category === 'cravings'), words(P.premenstrualPatterns(v.s, t)));
  const w = person([28, 28, 28, 28], { post: i => i === 2 ? 'strong' : 'none' });
  check('not a pattern if it was just as strong in the week after, in one of those cycles', !P.premenstrualPatterns(w.s, t).patterns?.some(x => x.category === 'cravings'), words(P.premenstrualPatterns(w.s, t)));
  const all = person([28, 28, 28, 28], { pre: () => 'strong', post: () => 'strong' });
  check('not a pattern if she logs it all the time', !P.premenstrualPatterns(all.s, t).patterns?.some(x => x.category === 'cravings'));
  const two = person([28, 28]);
  const r2 = P.premenstrualPatterns(two.s, t);
  check('with 2 cycles: still learning, and says how many more cycles it needs', r2.status === 'learning' && /1 more cycle/.test(r2.text || ''), words(r2));
  const gaps = person([28, 28, 28, 28], { post: i => i === 1 ? null : 'none' }); // nothing logged on days 5–12 in cycle 2
  const cg = P.premenstrualPatterns(gaps.s, t).patterns?.find(x => x.category === 'cravings');
  check('a cycle with no logs on days 4 to 10 is skipped (unknown), never counted as "it didn\'t happen"', cg?.of === 3 && !cg.cycleStarts.includes(gaps.starts[1]), words(cg));
  const short = person([28, 28, 28], { post: i => i === 1 ? null : 'none' }); // 3 cycles, one of them unknown
  check('…so with only 2 cycles she logged fully, it is still learning', P.premenstrualPatterns(short.s, t).status === 'learning', words(P.premenstrualPatterns(short.s, t)));
  const none = person([28, 28, 28, 28], { pre: () => 'none' });
  check('no symptom before her periods: no pattern, and it says so plainly', P.premenstrualPatterns(none.s, t).status === 'none' && P.premenstrualPatterns(none.s, t).patterns.length === 0);
});

run('when it does not apply', () => {
  const t = '2026-06-01';
  const h = person([28, 28, 28, 28]); M.setSituation(h.s, 'hormonalContraception', true, { at: AT });
  check('on hormonal contraception: not used (bleeds are not periods)', P.premenstrualPatterns(h.s, t).status === 'not_applicable');
  const p = person([28, 28, 28, 28]); startPregnancy(p.s, { lmp: p.last, today: addDays(p.last, 20), at: AT });
  check('in pregnancy: not used', P.premenstrualPatterns(p.s, addDays(p.last, 20)).status === 'not_applicable');
  const n = person([28, 28, 28, 28], { cats: [] });
  check('with no symptoms turned on: says which ones she can turn on', P.premenstrualPatterns(n.s, t).status === 'off');
});

run('in the moment', () => {
  const { s, last } = person([28, 28, 28, 28]);
  const e = d => estimateNext(s, d), pre = addDays(e(addDays(last, 1)).rangeStart, -3);
  const now = P.premenstrualNow(s, pre, e(pre));
  check('in the days before her expected period: a message about her own pattern', !!now && /cravings/.test(now.text) && /may/.test(now.text), words(now));
  check('…it says other things cause the same (stress, illness, travel, a bad night)', /stress/i.test(now?.text || '') && /illness/i.test(now?.text || ''));
  check('…never labels her ("binge"), never gives diet or calorie advice, no forbidden wording', !!now && !/binge|diet|calorie|weight|eat less/i.test(words(now)) && !FORBIDDEN.some(([, re]) => re.test(words(now))));
  check('…asks at most 3 one-tap questions, her pattern symptoms first', now?.questions?.length >= 1 && now.questions.length <= 3 && now.questions[0].category === 'cravings', words(now?.questions));
  check('not shown in the middle of her cycle', P.premenstrualNow(s, addDays(last, 8), e(addDays(last, 8))) === null);
  const after = person([28, 28, 28, 28]); M.logPeriodStart(after.s, pre, { today: pre, at: AT });
  check('not shown once her period has started', P.premenstrualNow(after.s, pre, estimateNext(after.s, pre)) === null);
  P.saveQuickLog(s, pre, { cravings: 'strong', sleep: 'poor' }, { at: AT });
  check('one tap saves only what she chose, and the question is done for today', s.days[pre].cravings === 'strong' && s.days[pre].sleep === 'poor' && P.premenstrualNow(s, pre, e(pre)) === null);
  let bad = null; try { P.saveQuickLog(s, pre, { cravings: 'huge' }, { at: AT }); } catch (x) { bad = x.code; }
  check('an invalid answer is refused', bad === 'INVALID_INPUT');
});

run('mood: PMDD note', () => {
  const t = '2026-06-01';
  const m = person([28, 28, 28, 28], { cat: 'mood', pre: () => 'low', post: () => 'good' });
  const r = P.premenstrualPatterns(m.s, t);
  check('a mood pattern adds a note: it has a name (PMDD), treatments help, talk to a doctor', /PMDD/.test(r.note || '') && /doctor/.test(r.note || ''), r.note);
  check('…and says to get help straight away with thoughts of harming herself', /harming yourself/.test(r.note || ''));
  check('no mood pattern: no such note', !P.premenstrualPatterns(person([28, 28, 28, 28]).s, t).note);
});

run('not too many questions', () => {
  const s = M.blankState('u'); M.giveConsent(s, AT); const d0 = '2026-03-01';
  check('asking is allowed by default', A.askAllowed(s, 'zara', d0) === true);
  for (let i = 0; i < 3; i++) A.recordNotNow(s, 'zara', addDays(d0, i));
  check(`after ${A.BACKOFF?.AFTER_NOT_NOW} "Not now" in a row: not asked the next day`, A.askAllowed(s, 'zara', addDays(d0, 3)) === false);
  check(`…but asked again ${A.BACKOFF?.EVERY_DAYS} days after the last "Not now" (backs off, never stops)`, A.askAllowed(s, 'zara', addDays(d0, 4)) === true);
  A.recordAnswer(s, 'zara');
  check('…and back to normal as soon as she answers', A.askAllowed(s, 'zara', addDays(d0, 3)) === true);

  // Zara uses the budget
  const z = person([28, 28, 28, 28], { cats: ['pain', 'mood', 'energy'] }), e = estimateNext(z.s, addDays(z.last, 1));
  const days = [-2, -1, 0].map(n => addDays(e.rangeStart, n));
  for (const d of days) dismissCompanion(z.s, d);
  const next = addDays(e.rangeStart, 1);
  check('Zara: after 3 "Not now" in a row, she stays quiet the next day', companionToday(z.s, next, { estimate: estimateNext(z.s, next) }) === null);
  answerCheckIn(z.s, addDays(next, 1), 'fine');
  check('…and is back after an answer', z.s.asks?.zara?.streak === 0);
  const l = person([28, 28, 28, 28], { cats: ['pain', 'mood', 'energy'] });
  M.logPeriodStart(l.s, addDays(l.last, 28), { today: FAR, at: AT }); const st = addDays(l.last, 28);
  check('control: on "Normal", Zara checks in on day 2 of her period', companionToday(l.s, addDays(st, 1), { estimate: estimateNext(l.s, addDays(st, 1)) })?.kind === 'periodDays');
  A.setAskLevel(l.s, 'light');
  check('"Light": Zara checks in only on day 1 of her period and before it, not on day 2', companionToday(l.s, addDays(st, 1), { estimate: estimateNext(l.s, addDays(st, 1)) }) === null && companionToday(l.s, st, { estimate: estimateNext(l.s, st) })?.kind === 'periodDays');
  let bad = null; try { A.setAskLevel(l.s, 'loud'); } catch (x) { bad = x.code; }
  check('only "light" or "normal"', bad === 'INVALID_INPUT' && A.ASK_LEVELS?.join() === 'light,normal');
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
