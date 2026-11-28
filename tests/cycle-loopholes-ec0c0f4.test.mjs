// Regression tests for four weak spots found reviewing ec0c0f4 (2026-11-27). Written BEFORE the fix. Synthetic dates
// only. The estimate formula and the band estimate are not changed by these fixes.
//   L1. Zara's "period soon" check-in used the same ~4-week guard as the old check-in, so with short or variable
//       cycles (15, 15, 35, 15) she never checked in around the estimated start.
//   L2. The "Has your period started?" REMINDER could fire during the period she had just logged (short cycles).
//   L3. Pregnancy mode accepted a "first day of last period" earlier than a period she had already logged after it.
//   L4. "Not yet" on the check-in overwrote spotting she had logged earlier that day with "no bleeding", and
//       "Spotting only" left the question on screen for the rest of the day.
//   L5. Perimenopause mode counted the months of a pregnancy (and after the birth) as "months without a period":
//       "12 months without a period is how menopause is defined", and any spotting raised "see a doctor".
//   L6. The summary for her doctor counted a gap that contains a pregnancy as an ordinary cycle in its figures.
// Run: node tests/cycle-loopholes-ec0c0f4.test.mjs
import * as M from '../js/cycle/model.js';
import * as R from '../js/cycle/reminders.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { startPregnancy, endPregnancy } from '../js/cycle/pregnancy.js';
import { midlifeObservations } from '../js/cycle/midlife.js';
import { clinicianSummary } from '../js/cycle/summary.js';
import { companionToday } from '../js/cycle/companion.js';
import * as C from '../js/cycle/checkins.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
const AT = '2026-01-01T00:00:00.000Z', FAR = '2027-12-31', words = v => JSON.stringify(v);
const err = fn => { try { fn(); return null; } catch (e) { return e.code; } };
function hist(lens, first = '2026-01-05') {
  const s = M.blankState('u'); M.giveConsent(s, AT);
  const starts = [first]; for (const l of lens) starts.push(addDays(starts.at(-1), l));
  for (const st of starts) M.logPeriodStart(s, st, { today: FAR, at: AT });
  return { s, starts, last: starts.at(-1) };
}
const periodCheckDays = (s, days) => days.filter(d => R.dueNow(s, { today: d, nowMin: 600, estimate: estimateNext(s, d) }).some(x => x.reminder.kind === 'periodCheck'));

run('L1. Zara with short or variable cycles', () => {
  const { s, last } = hist([15, 15, 35, 15]), t = addDays(last, 15), e = estimateNext(s, t);
  check('control: the forecast has a range', !!e.rangeStart);
  check('Zara checks in on her typical date (15, 15, 35, 15 days)', companionToday(s, t, { estimate: e })?.kind === 'periodSoon', words(companionToday(s, t, { estimate: e })));
  const r = hist([28, 28, 28, 28]), rt = addDays(r.last, 26);
  check('control: with 28-day cycles she still checks in before the range', companionToday(r.s, rt, { estimate: estimateNext(r.s, rt) })?.kind === 'periodSoon');
});

run('L2. "Has your period started?" reminder', () => {
  const { s, last } = hist([15, 15, 35, 15]); s.consent.reminders = true;
  R.addReminder(s, { kind: 'periodCheck', time: '09:00', offsetDays: 2 }, { at: AT });
  const early = periodCheckDays(s, [1, 2, 3, 4, 5, 6].map(n => addDays(last, n)));
  check('it does not fire during the period she has just logged (no end logged: first 7 days)', early.length === 0, early.join(','));
  const e = estimateNext(s, addDays(last, 15));
  check('…but it does fire on her typical date', periodCheckDays(s, [e.typicalDate]).length === 1);
  const r = hist([28, 28, 28, 28]); r.s.consent.reminders = true; R.addReminder(r.s, { kind: 'periodCheck', time: '09:00', offsetDays: 2 }, { at: AT });
  const re = estimateNext(r.s, addDays(r.last, 1));
  check('control: with 28-day cycles it still fires 2 days before her range', periodCheckDays(r.s, [addDays(re.rangeStart, -2)]).length === 1);
});

run('L3. Pregnancy: first day of last period', () => {
  const { s, last } = hist([28, 28, 28]), t = addDays(last, 10);
  const code = err(() => startPregnancy(s, { lmp: addDays(last, -40), today: t, at: AT }));
  check('an LMP before a period she logged after it is refused, so she can check the date', code === 'LMP_BEFORE_LOGGED_PERIOD' && !s.pregnancy, words({ code, pregnancy: s.pregnancy }));
  const ok = hist([28, 28, 28]);
  check('control: her last logged start as the LMP is accepted', err(() => startPregnancy(ok.s, { lmp: ok.last, today: addDays(ok.last, 10), at: AT })) === null && !!ok.s.pregnancy);
  const due = hist([28, 28, 28]);
  check('control: a due date from her midwife is accepted as given', err(() => startPregnancy(due.s, { dueDate: addDays(due.last, 250), today: addDays(due.last, 30), at: AT })) === null);
});

run('L4. "Not yet" and "Spotting only"', () => {
  const { s, last } = hist([28, 28, 28, 28]), t = addDays(last, 27);
  M.logDay(s, t, { bleeding: 'spotting' }, { today: t, at: AT });
  C.answerNotYet?.(s, t);
  check('"Not yet" keeps spotting she logged earlier today', s.days[t]?.bleeding === 'spotting', words(s.days[t]));
  check('…and quiets the question for today', C.periodCheckIn(s, t) === null);
  const n = hist([28, 28, 28, 28]); C.answerNotYet?.(n.s, t);
  check('"Not yet" with nothing logged today records no bleeding today (her answer)', n.s.days[t]?.bleeding === 'none', words(n.s.days[t]));
  const sp = hist([28, 28, 28, 28]); C.answerSpotting?.(sp.s, t);
  check('"Spotting only" saves spotting and quiets the question for today', sp.s.days[t]?.bleeding === 'spotting' && C.periodCheckIn(sp.s, t) === null, words({ day: sp.s.days[t], q: !!C.periodCheckIn(sp.s, t) }));
});
run('L5. Perimenopause mode after a pregnancy', () => {
  const mk = ({ pregnancy = true, postpartum = false } = {}) => {
    const { s } = hist([28, 28], '2025-01-05'); // last logged period 2 Mar 2025
    if (pregnancy) { startPregnancy(s, { lmp: '2025-03-02', today: '2025-04-10', at: AT }); endPregnancy(s, { outcome: 'birth', date: '2025-12-01', today: '2025-12-01', at: AT }); }
    if (!postpartum) M.setSituation(s, 'postpartum', false, { at: AT });
    M.setSituation(s, 'perimenopause', true, { at: AT });
    return s;
  };
  const t = '2026-04-10'; // 13 months after her last period; 4 months after the birth
  const p = mk(), o = midlifeObservations(p, t);
  check('the months of a pregnancy are not counted as "12 months without a period"', o?.sinceLastPeriod?.twelveMonths === false && !/how menopause is defined/.test(o?.sinceLastPeriod?.text || ''), words(o?.sinceLastPeriod));
  check('…and the text says it counts from the end of the pregnancy', /pregnan/i.test(o?.sinceLastPeriod?.text || ''), o?.sinceLastPeriod?.text);
  M.logDay(p, t, { bleeding: 'spotting' }, { today: t, at: AT });
  check('…so spotting after the birth does not raise the "bleeding after 12 months" alert', midlifeObservations(p, t)?.alerts.length === 0 && midlifeObservations(p, t)?.bleedingAfterTwelveMonths === false, words(midlifeObservations(p, t)?.alerts));
  const g = mk(); M.logPeriodStart(g, '2026-05-01', { today: FAR, at: AT });
  const og = midlifeObservations(g, '2026-05-10');
  check('a gap that contains a pregnancy is not described as a long gap without periods', og?.longGap?.found === false && !og?.variability?.lengths.some(l => l > 60), words({ gap: og?.longGap, lengths: og?.variability?.lengths }));
  const b = mk({ postpartum: true }), ob = midlifeObservations(b, '2027-02-10'); // 14 months after the birth, still marked postpartum/breastfeeding
  check('while marked as recently given birth or breastfeeding, a long time without periods is not compared with the 12-month definition', ob?.sinceLastPeriod?.twelveMonths === false, words(ob?.sinceLastPeriod));
  const c = mk({ pregnancy: false }), oc = midlifeObservations(c, t);
  check('control: without a pregnancy, 13 months without a period is still described', oc?.sinceLastPeriod?.twelveMonths === true && /how menopause is defined/.test(oc.sinceLastPeriod.text));
  M.logDay(c, t, { bleeding: 'spotting' }, { today: t, at: AT });
  check('control: …and spotting after it still raises the alert', midlifeObservations(c, t)?.alerts.length === 1);
});
run('L6. Summary for her doctor', () => {
  const { s, last } = hist([28, 28, 28], '2026-01-05'); // last start 30 Mar
  startPregnancy(s, { lmp: last, today: addDays(last, 30), at: AT });
  endPregnancy(s, { outcome: 'ended', date: addDays(last, 45), today: addDays(last, 45), at: AT });
  M.logPeriodStart(s, addDays(last, 75), { today: FAR, at: AT }); M.logPeriodStart(s, addDays(last, 103), { today: FAR, at: AT });
  const x = clinicianSummary(s, { today: addDays(last, 110), months: 12 });
  const gap = x.cycles.find(c => c.start === last);
  check('a gap that contains a pregnancy is listed but not used in the cycle figures', gap && gap.usable === false && /pregnan/i.test(gap.reason || '') && x.cycleStats.longest === 28, words({ gap, stats: x.cycleStats }));
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
