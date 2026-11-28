// Smarter period-start check-ins (js/cycle/checkins.js). Written BEFORE the implementation. Synthetic dates only.
// Why: on the real Marquette data, recording starts 1–3 days late (the day she remembered, not the real day) raised the
// dates-only error from 2.21 to 2.68 days when 1 in 3 starts were late, and to 2.99 when 2 in 3 were. So the check-in
// lets her say WHEN it started, and asks (never assumes) whether a gap of about two cycles hides a missed log.
// Nothing is ever logged without her tap. Run: node tests/cycle-checkins.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { answerCheckIn } from '../js/cycle/companion.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
let C = {}; try { C = await import('../js/cycle/checkins.js'); } catch (e) { check('module js/cycle/checkins.js exists', false, e.message); }
const AT = '2026-01-01T00:00:00.000Z', words = v => JSON.stringify(v);
const err = fn => { try { fn(); return null; } catch (e) { return e.code; } };
function hist(lens, first = '2026-01-05') {
  const s = M.blankState('u'); M.giveConsent(s, AT);
  const starts = [first]; for (const l of lens) starts.push(addDays(starts.at(-1), l));
  for (const st of starts) M.logPeriodStart(s, st, { today: '2026-12-31', at: AT });
  return { s, last: starts.at(-1) };
}

run('when it asks', () => {
  const { s, last } = hist([28, 28, 28, 28]); // range day 26–30 from the last start
  const e = estimateNext(s, addDays(last, 25)), before = words(s);
  check('not before her range starts', C.periodCheckIn(s, addDays(last, 24)) === null);
  const q = C.periodCheckIn(s, e.rangeStart);
  check('from the first day of her range: "Has your period started?"', q?.kind === 'periodStart' && /started/i.test(q.title), words(q));
  check('…offering the real start day: today, yesterday, 2 days ago, or another date', words(q.options.map(o => o.id)) === '["today","yesterday","twoDaysAgo","pick"]' && q.options[0].date === e.rangeStart && q.options[1].date === addDays(e.rangeStart, -1));
  check('…never a day on or before her last logged start', q.options.filter(o => o.date).every(o => o.date > last) && q.pick.min === addDays(last, 1) && q.pick.max === e.rangeStart);
  check('…plus "Spotting only" and "Not yet"', q.spotting === true && q.notYet === true);
  check('asking never changes her data', words(s) === before);
  C.dismissPeriodCheckIn(s, e.rangeStart);
  check('"Not yet": quiet for the rest of the day, asks again tomorrow', C.periodCheckIn(s, e.rangeStart) === null && C.periodCheckIn(s, addDays(e.rangeStart, 1)) !== null);
});

run('how often, when late', () => {
  const { s, last } = hist([28, 28, 28, 28]), end = estimateNext(s, addDays(last, 1)).rangeEnd;
  const days = Array.from({ length: 20 }, (_, i) => addDays(end, i + 1)).filter(d => C.periodCheckIn(s, d));
  check(`daily for ${C.CADENCE?.DAILY_DAYS_AFTER_RANGE} days after her range, then every ${C.CADENCE?.THEN_EVERY_DAYS} days (less nagging)`, days.slice(0, 7).length === 7 && days.slice(0, 7).every((d, i) => d === addDays(end, i + 1)) && days.length < 20 && days.length >= 10, days.join(','));
  const late = C.periodCheckIn(s, addDays(end, 3));
  check('when late: gentle, no alarm, no pregnancy or medical claims', /vary/i.test(late.text) && !FORBIDDEN.some(([, re]) => re.test(words(late))) && !/pregnan|diagnos/i.test(words(late)), late.text);
  M.logPeriodStart(s, addDays(end, 2), { today: addDays(end, 3), at: AT });
  check('once she logs a start, it stops', C.periodCheckIn(s, addDays(end, 3)) === null);
});

run('answering with the real day', () => {
  const { s, last } = hist([28, 28, 28, 28]); const t = addDays(last, 29), y = addDays(t, -1);
  C.answerPeriodCheckIn(s, t, y, { at: AT });
  check('"Yesterday" logs yesterday (the real start), marked as from the check-in', s.periods.some(p => p.start === y && p.source === 'checkin'), words(s.periods.at(-1)));
  const r = hist([28, 28, 28, 28]);
  check('a future date is refused', err(() => C.answerPeriodCheckIn(r.s, t, addDays(t, 1), { at: AT })) === 'FUTURE_DATE');
  check('a date on or before her last start is refused', err(() => C.answerPeriodCheckIn(r.s, t, r.last, { at: AT })) === 'INVALID_DATE');
  const c = hist([28, 28, 28, 28]);
  answerCheckIn(c.s, t, 'periodStarted', { date: addDays(t, -2), today: t, at: AT });
  check('Zara\'s "My period started" can take the real day too (2 days ago)', c.s.periods.some(p => p.start === addDays(t, -2) && p.source === 'companion'));
});

run('a forgotten period', () => {
  const { s } = hist([28, 28, 28, 56]); // the last gap is about two of her cycles
  const q = C.missedLogQuestion(s, '2026-12-31');
  check('a gap of about two of her usual cycles: asks whether she missed logging one', q?.length === 56 && q.typical === 28 && /didn't log|missed/i.test(q.text), words(q));
  check('…asking never changes her data', !s.periods.some(p => p.missedBefore));
  C.answerMissedLog(s, q.periodId, true, { at: AT });
  const e = estimateNext(s, '2026-12-31');
  check('"Yes": that gap is no longer used as one long cycle in her estimate', !e.lengths.includes(56) && s.periods.find(p => p.id === q.periodId).missedBefore === true, words(e.lengths));
  const n = hist([28, 28, 28, 56]); const qn = C.missedLogQuestion(n.s, '2026-12-31');
  C.answerMissedLog(n.s, qn.periodId, false, { at: AT });
  check('"No": the gap is kept as a real cycle, and she is not asked again', estimateNext(n.s, '2026-12-31').lengths.includes(56) && C.missedLogQuestion(n.s, '2026-12-31') === null);
  check('a normal cycle (30 days) is not questioned', C.missedLogQuestion(hist([28, 28, 28, 30]).s, '2026-12-31') === null);
  check('a long cycle that is not near two of hers (40 days) is not questioned', C.missedLogQuestion(hist([28, 28, 28, 40]).s, '2026-12-31') === null);
  check('with fewer than 2 earlier cycles it does not ask (too little to compare)', C.missedLogQuestion(hist([28, 56]).s, '2026-12-31') === null);
  check('the rule is a data-quality question, documented, not a physiological threshold', typeof C.MISSED?.TOLERANCE_DAYS === 'number' && /not physiolog/i.test(C.MISSED?.note || ''));
});

run('wording', () => {
  const { s, last } = hist([28, 28, 28, 28]);
  const q = C.periodCheckIn(s, estimateNext(s, addDays(last, 1)).rangeStart), m = C.missedLogQuestion(hist([28, 28, 28, 56]).s, '2026-12-31');
  check('no forbidden wording, no fertility or pregnancy claims', [q, m].every(x => !FORBIDDEN.some(([, re]) => re.test(words(x))) && !/ovulat|fertil|pregnan/i.test(words(x))));
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
