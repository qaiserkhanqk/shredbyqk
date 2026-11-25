// Companion flow (flag companion, default OFF): one caring check-in on the days that matter for HER, built from her
// own history. It never guesses her symptoms: it asks, and saves only what she taps. Written BEFORE the
// implementation; the failing run is committed in docs/test-logs/. Synthetic data only.
// Run: node tests/cycle-companion.test.mjs
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { FLAG_DEFS, readFlags } from '../js/cycle/flags.js';
import * as R from '../js/cycle/reminders.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
let C = {}; try { C = await import('../js/cycle/companion.js'); } catch (e) { check('module js/cycle/companion.js exists', false, e.message); }
const today = C.companionToday || (() => undefined);
const AT = '2026-06-30T08:00:00.000Z';
const fresh = () => { const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z'); return s; };
/** Five 28-day cycles; the last start is `last`. Pain moderate on days 1–2 of each complete cycle, none otherwise. */
function history(last, { painPattern = true } = {}) {
  const s = fresh(); M.setCategory(s, 'pain', true, { at: AT }); M.setCategory(s, 'energy', true, { at: AT });
  const starts = Array.from({ length: 6 }, (_, i) => addDays(last, -28 * (5 - i)));
  for (const st of starts) M.logPeriodStart(s, st, { today: addDays(last, 40), at: `${st}T09:00:00.000Z` });
  if (painPattern) for (const st of starts.slice(0, 5)) for (let k = 0; k < 28; k++) M.logDay(s, addDays(st, k), { pain: k < 2 ? 'moderate' : 'none' }, { today: addDays(last, 40), at: `${addDays(st, k)}T20:00:00.000Z` });
  return s;
}
const opts = (s, t, more = {}) => ({ estimate: estimateNext(s, t), patternsOn: false, ...more });
const words = v => JSON.stringify(v);

run('flag', () => {
  check('a separate flag, off by default', FLAG_DEFS.companion?.default === false && readFlags({ getItem: () => null }).companion === false);
});

run('when it speaks', () => {
  const s0 = fresh();
  check('no consent or nothing to say: null', today(M.blankState('x'), '2026-06-30', {}) === null && today(s0, '2026-06-30', opts(s0, '2026-06-30')) === null);
  // Period started yesterday: day 2 → "how are you feeling?"
  const last = '2026-06-29', s = history(last);
  const m = today(s, '2026-06-30', opts(s, '2026-06-30'));
  check('day 2 of her period: a check-in', m?.kind === 'periodDays' && /day 2/i.test(m.title + m.text) && /how are you feeling/i.test(m.text), words(m));
  check('it offers one-tap answers only for categories she switched on (+ Fine, Something else)', words(m?.quick?.map(q => q.id)) === '["fine","cramps","lowEnergy","other"]', words(m?.quick));
  check('it explains why it is asking', /period started/i.test(m?.why || ''), m?.why);
  // Not in a period, not near one: nothing.
  const quiet = today(s, '2026-07-12', opts(s, '2026-07-12'));
  check('mid-cycle with no pattern: nothing (no daily nagging)', quiet === null, words(quiet));
  // Near the next estimated start (range = her past cycles: 28 days → 2026-07-27).
  const soon = today(s, '2026-07-26', opts(s, '2026-07-26'));
  check('a day before her estimated range: "may start around now", from past cycles, not certain', soon?.kind === 'periodSoon' && /past cycles/i.test(soon.text) && /may/i.test(soon.text), words(soon));
  check('…with a "period started" answer', soon?.quick?.some(q => q.id === 'periodStarted'));
  // Pattern heads-up only with the research flag (patterns are unvalidated).
  const s2 = history('2026-06-01'), t2 = '2026-06-28'; // next start estimated 2026-06-29: cycle day 28 → pattern days 1–2 are tomorrow+
  const noPat = today(s2, t2, opts(s2, t2));
  const withPat = today(s2, t2, opts(s2, t2, { patternsOn: true }));
  check('pattern heads-up needs the pattern research flag', noPat?.kind !== 'pattern');
  const s3 = history('2026-06-01'), t3 = '2026-06-02'; // cycle day 2: in the pattern window, but periodDays has priority
  check('period days come before a pattern heads-up (one message only)', today(s3, t3, opts(s3, t3, { patternsOn: true }))?.kind === 'periodDays');
  const s4 = history('2026-06-01'); const t4 = '2026-06-30'; // cycle day 30, overdue: periodSoon still applies
  check('overdue period: still a gentle check-in', ['periodSoon'].includes(today(s4, t4, opts(s4, t4))?.kind), words(today(s4, t4, opts(s4, t4))));
  check('the pattern heads-up (when on) shows her own numbers and says it may be chance', !withPat || withPat.kind !== 'pattern' || (/of (your|the)/.test(withPat.text) && /chance/i.test(withPat.text)), words(withPat));
  const preg = history(last); M.setSituation(preg, 'pregnant', true, { at: AT });
  check('pregnant: silent (pregnancy mode will handle it)', today(preg, '2026-06-30', opts(preg, '2026-06-30')) === null);
});

run('answers', () => {
  const s = history('2026-06-29'), t = '2026-06-30';
  const before = JSON.stringify(s); today(s, t, opts(s, t));
  check('asking never changes her data (nothing guessed or saved)', JSON.stringify(s) === before);
  let e = null; try { C.answerCheckIn(s, t, 'cramps', { severity: 'extreme', today: t, at: AT }); } catch (x) { e = x.code; }
  check('cramps needs a valid severity', e === 'INVALID_INPUT');
  C.answerCheckIn(s, t, 'cramps', { severity: 'moderate', today: t, at: AT });
  check('cramps → saves pain as she chose it, marked as coming from the companion', s.days[t].pain === 'moderate' && s.days[t].src.pain === 'companion', words(s.days[t]));
  check('once answered, no more companion message today', today(s, t, opts(s, t)) === null);
  check('…and it comes back on the next relevant day', today(s, '2026-07-01', opts(s, '2026-07-01'))?.kind === 'periodDays');
  const f = history('2026-06-29'); C.answerCheckIn(f, t, 'fine', { today: t, at: AT });
  check('"Fine" records only that she answered: no symptom is invented', !f.days[t]?.pain && f.companion.answered[t] === 'fine');
  const off = history('2026-06-29'); M.setCategory(off, 'energy', false, { at: AT });
  let e2 = null; try { C.answerCheckIn(off, t, 'lowEnergy', { today: t, at: AT }); } catch (x) { e2 = x.code; }
  check('an answer for a category she switched off is refused', e2 === 'CATEGORY_OFF');
  const ps = history('2026-06-01'), tp = '2026-06-28';
  C.answerCheckIn(ps, tp, 'periodStarted', { today: tp, at: AT });
  check('"Period started" logs a period start (she confirmed it)', ps.periods.some(p => p.start === tp && p.source === 'companion'));
  const d = history('2026-06-29'); C.dismissCompanion(d, t);
  check('"Not now" hides it for today only', today(d, t, opts(d, t)) === null && today(d, '2026-07-01', opts(d, '2026-07-01')) !== null);
  const logged = history('2026-06-29'); M.logDay(logged, t, { energy: 'low' }, { today: t, at: AT });
  check('if she already logged today, it stays quiet', today(logged, t, opts(logged, t)) === null);
});

run('notifications', () => {
  check('a "companion" reminder kind exists', !!R.KINDS?.companion);
  const s = history('2026-06-29'); M.setScopeConsent(s, 'reminders', true, AT);
  let r = null; try { r = R.addReminder(s, { kind: 'companion', time: '09:00' }, { at: AT }); } catch (e) { check('companion reminder can be added', false, e.code); }
  if (r) {
    const est = estimateNext(s, '2026-06-30');
    const days = R.schedule(r, s, '2026-06-30', '2026-07-31', est).map(o => o.date);
    check('it fires only on companion days (period days, around the estimated start), not every day', days.includes('2026-06-30') && !days.includes('2026-07-12') && days.includes('2026-07-26'), days.join(','));
    check('lock-screen text stays neutral', R.notificationContent(r, { lockScreenDetail: false }).body === 'You have a check-in.' && !/period|pain|cramp/i.test(R.notificationContent(r, { lockScreenDetail: true }).body));
  }
});

run('wording', () => {
  const s = history('2026-06-29'); const m = today(s, '2026-06-30', opts(s, '2026-06-30')) || {};
  check('no forbidden wording', !FORBIDDEN.some(([, re]) => re.test(words(m))));
  check('warm, first person from QK, and no medical claims', /QK/.test(m.from || '') && !/diagnos|treat|cure|medicine|tablet|dose/i.test(words(m)), words(m));
  check('no sexual or adult content (the audience may include teenagers)', !/\bsex\b|intercourse|contracept/i.test(words(m)));
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
