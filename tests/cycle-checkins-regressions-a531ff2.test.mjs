// Regression tests for three check-in defects reported against a531ff2. Written BEFORE the fix. Synthetic dates only.
// The estimate formula (predict.js) and the band estimate are NOT changed by this fix; these tests check only when the
// check-in questions appear and what her answers do.
//   1. Pregnancy: no "missed period" question while pregnant, across a pregnancy, or from pre-pregnancy cycles
//      after the restart. Manual history editing stays available.
//   2. Cycles of 15, 15, 35, 15 days: the forecast has a range but "Has your period started?" never appeared, because
//      the guard against a duplicate question after a new start assumed ~4-week cycles.
//   3. Cycles of 48, 48, 48, 96: "No, it was one long cycle" dismissed the question but left the 96-day gap silently
//      left out of the estimate. The unusual-gap safeguard stays; she is told, and can review or confirm the gap.
// Run: node tests/cycle-checkins-regressions-a531ff2.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { startPregnancy, endPregnancy } from '../js/cycle/pregnancy.js';
import { FORBIDDEN } from '../research/lib/policy.js';
import * as C from '../js/cycle/checkins.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
const AT = '2026-01-01T00:00:00.000Z', words = v => JSON.stringify(v), FAR = '2027-12-31';
function hist(lens, first = '2026-01-05', s = null) {
  if (!s) { s = M.blankState('u'); M.giveConsent(s, AT); }
  const starts = [first]; for (const l of lens) starts.push(addDays(starts.at(-1), l));
  for (const st of starts) M.logPeriodStart(s, st, { today: FAR, at: AT });
  return { s, starts, last: starts.at(-1) };
}

run('1. pregnancy', () => {
  { // pregnant now (pregnancy mode), with a gap of about two cycles in her history
    const { s, last } = hist([28, 28, 28, 56]); const t = addDays(last, 3);
    check('control: before the pregnancy, the gap is asked about', C.missedLogQuestion(s, t) !== null);
    startPregnancy(s, { lmp: last, today: t, at: AT });
    check('while pregnant (pregnancy mode): no "missed period" question', C.missedLogQuestion(s, t) === null, words(C.missedLogQuestion(s, t)));
    const p = s.periods.find(x => x.start === last);
    M.editPeriod(s, p.id, { missedBefore: true }, { today: t, at: AT });
    check('…manual history editing still works while pregnant', s.periods.find(x => x.id === p.id).missedBefore === true);
  }
  { // pregnant ticked as a situation only
    const { s, last } = hist([28, 28, 28, 56]); const t = addDays(last, 3);
    M.setSituation(s, 'pregnant', true, { at: AT });
    check('while "Pregnant" is ticked: no "missed period" question', C.missedLogQuestion(s, t) === null);
  }
  { // a gap that crosses a pregnancy is not a missed log
    const { s, last } = hist([28, 28, 28]); // last start 30 Mar
    startPregnancy(s, { lmp: last, today: addDays(last, 20), at: AT });
    endPregnancy(s, { outcome: 'ended', date: addDays(last, 26), today: addDays(last, 26), at: AT });
    M.logPeriodStart(s, addDays(last, 56), { today: FAR, at: AT }); // 56 days later: about two of her cycles
    check('a gap that crosses a pregnancy is not asked about as a missed log', C.missedLogQuestion(s, addDays(last, 60)) === null, words(C.missedLogQuestion(s, addDays(last, 60))));
  }
  { // after the restart, pre-pregnancy cycles are not her "usual" cycle
    const { s, last } = hist([28, 28, 28]);
    startPregnancy(s, { lmp: last, today: addDays(last, 20), at: AT });
    const end = addDays(last, 26); endPregnancy(s, { outcome: 'ended', date: end, today: end, at: AT });
    const e1 = addDays(end, 37); M.logPeriodStart(s, e1, { today: FAR, at: AT }); M.logPeriodStart(s, addDays(e1, 56), { today: FAR, at: AT });
    check('after the restart: pre-pregnancy cycles are not used to call a gap "about twice your usual"', C.missedLogQuestion(s, addDays(e1, 60)) === null, words(C.missedLogQuestion(s, addDays(e1, 60))));
    const h = hist([28, 28, 28]); // the same pregnancy, then cycles of 28, 28 and 56 days since the restart
    startPregnancy(h.s, { lmp: h.last, today: addDays(h.last, 20), at: AT }); endPregnancy(h.s, { outcome: 'ended', date: end, today: end, at: AT });
    const r = hist([28, 28, 56], e1, h.s);
    check('…but with enough cycles since the restart, a gap of about two of them is asked about', C.missedLogQuestion(r.s, addDays(r.last, 3))?.length === 56, words(C.missedLogQuestion(r.s, addDays(r.last, 3))));
  }
  { // a pregnancy ticked and unticked as a situation inside the gap
    const { s, starts } = hist([28, 28, 28, 56]);
    const a = starts.at(-2);
    M.setSituation(s, 'pregnant', true, { at: `${addDays(a, 12)}T12:00:00.000Z` });
    M.setSituation(s, 'pregnant', false, { at: `${addDays(a, 30)}T12:00:00.000Z` });
    check('a gap during which she had ticked "Pregnant" is not asked about', C.missedLogQuestion(s, addDays(starts.at(-1), 3)) === null);
  }
});

run('2. short and variable cycles (15, 15, 35, 15)', () => {
  const { s, last } = hist([15, 15, 35, 15]);
  const e = estimateNext(s, addDays(last, 15));
  check('control: the forecast has a range', !!e.rangeStart && !!e.typicalDate, words({ status: e.status, rangeStart: e.rangeStart }));
  check('the check-in appears on her typical date', C.periodCheckIn(s, e.typicalDate)?.kind === 'periodStart', words({ typical: e.typicalDate, rangeStart: e.rangeStart }));
  const days = []; for (let d = e.typicalDate; d <= e.rangeEnd; d = addDays(d, 1)) days.push(d);
  check('…and on every day from her typical date to the end of her range', days.every(d => C.periodCheckIn(s, d)), days.filter(d => !C.periodCheckIn(s, d)).join(','));
  check('no duplicate question on the day of, or just after, her newly logged start', [0, 1, 2].every(n => C.periodCheckIn(s, addDays(last, n)) === null));
  const p = s.periods.find(x => x.start === last); M.logPeriodEnd(s, p.id, addDays(last, 3), { today: addDays(last, 4), at: AT });
  check('once her period end is logged (day 4), the check-in appears from the first day of her range (day 7)', e.rangeStart === addDays(last, 6) && C.periodCheckIn(s, e.rangeStart) !== null, words(e.rangeStart));
  M.logPeriodStart(s, e.typicalDate, { today: e.typicalDate, at: AT });
  check('after she logs the new start, it does not ask again that day or the next', C.periodCheckIn(s, e.typicalDate) === null && C.periodCheckIn(s, addDays(e.typicalDate, 1)) === null);
  check('a 15-day cycle after 15, 15, 35 is not asked about as "about twice your usual"', C.missedLogQuestion(hist([15, 15, 35, 15]).s, addDays(last, 3)) === null, words(C.missedLogQuestion(hist([15, 15, 35, 15]).s, addDays(last, 3))));
});

run('3. "No, it was one long cycle" (48, 48, 48, 96)', () => {
  const { s, last } = hist([48, 48, 48, 96]); const t = addDays(last, 10);
  const q = C.missedLogQuestion(s, t);
  check('control: the 96-day gap is asked about', q?.length === 96 && q.typical === 48, words(q));
  const before = words(s.periods);
  C.answerMissedLog(s, q.periodId, false, { at: AT, today: t });
  check('"No": her dates are not changed', words(s.periods) === before);
  check('"No": the unusual-gap safeguard stays (the 96-day gap is still not used)', !estimateNext(s, t).lengths.includes(96), words(estimateNext(s, t).lengths));
  check('…and the missed-period question is gone', C.missedLogQuestion(s, t) === null);
  const g = C.gapReview?.(s, t);
  check('…she is told the dates are saved but the gap is not used', g?.kind === 'unusualGap' && g.length === 96 && g.periodId === q.periodId && /saved/i.test(g.text) && /(not|isn't|is not) used/i.test(g.text), words(g));
  check('…with no forbidden wording or medical claims', !!g && !FORBIDDEN.some(([, re]) => re.test(words(g))) && !/ovulat|fertil|pregnan|diagnos/i.test(words(g)));
  check('…and asking or showing this never changes her data', words(s.periods) === before);
  const k = hist([48, 48, 48, 96]); const kq = C.missedLogQuestion(k.s, t); C.answerMissedLog(k.s, kq.periodId, false, { at: AT, today: t });
  C.dismissGapReview?.(k.s, kq.periodId, { today: t });
  check('"Keep it out": the notice goes away and the gap stays out', C.gapReview?.(k.s, t) === null && !estimateNext(k.s, t).lengths.includes(96));
  C.confirmGap?.(s, q.periodId, { at: AT, today: t });
  check('"Use this gap": only her explicit tap makes the 96-day gap count', estimateNext(s, t).lengths.includes(96) && s.periods.find(p => p.id === q.periodId).lengthConfirmed === true);
  check('…and the notice goes away', C.gapReview?.(s, t) === null);
  const n = hist([28, 28, 28, 56]); const nq = C.missedLogQuestion(n.s, addDays(n.last, 3)); C.answerMissedLog(n.s, nq.periodId, false, { at: AT, today: addDays(n.last, 3) });
  check('a gap that is used anyway (56 days) gets no notice', C.gapReview?.(n.s, addDays(n.last, 3)) === null);
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
