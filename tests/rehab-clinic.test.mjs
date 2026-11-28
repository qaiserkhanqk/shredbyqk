// Rehab clinic: progression loopholes (found in the 2026-11-27 audit) and the clinic intake.
// Run: node tests/rehab-clinic.test.mjs
import * as R from '../js/rehab.js';
const { COND, evaluatePhase } = R;

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const day = 864e5, wk = 7 * day, now = Date.UTC(2026, 10, 27, 12);
const goodDays = (n = 3, during = 1) => Array.from({ length: n }, (_, i) => ({ at: now - (i + 1) * day, during, after: during, nextMorning: 1 }));
const item = (ev, re) => ev.items.find(i => re.test(i.label)) || { met: false, label: '(missing)', detail: 'criterion missing' };
// Each section runs on its own so a missing function fails its checks instead of stopping the file.
const section = (name, fn) => { try { fn(); } catch (e) { check(`${name}: runs`, false, e.message); } };

// ---------------- Loophole 1: the healthy side must not pass the injured side's test
section('Loophole 1', () => {
  const acl = COND.acl;
  const base = { startedAt: now - 10 * wk, phaseStartedAt: now - 7 * wk, injured: 'L', checkins: goodDays(), psfs: [], kneeTests: [{ at: now, L: 5, R: 5 }] };
  let ev = evaluatePhase(acl, 1, { ...base, tests: [{ at: now, test: 'kneeFlexion', side: 'R', value: 140 }] }, now);
  check('1: healthy-knee bend does not pass the injured knee criterion', !item(ev, /bends 130/).met, item(ev, /bends 130/).detail);
  ev = evaluatePhase(acl, 1, { ...base, tests: [{ at: now, test: 'kneeFlexion', side: 'L', value: 132 }, { at: now + 1, test: 'kneeFlexion', side: 'R', value: 140 }] }, now);
  check('1: injured-knee bend 132° passes even if the healthy side was tested later', item(ev, /bends 130/).met, item(ev, /bends 130/).detail);
  ev = evaluatePhase(acl, 1, { ...base, tests: [{ at: now, test: 'kneeFlexion', value: 140 }] }, now);
  check('1: a result with no side does not count once the injured side is known', !item(ev, /bends 130/).met);
  const both = { ...base, injured: null, tests: [{ at: now, test: 'kneeFlexion', side: 'L', value: 120 }, { at: now, test: 'kneeFlexion', side: 'R', value: 140 }] };
  ev = evaluatePhase(acl, 1, both, now);
  check('1: both sides affected → the worse side decides', !item(ev, /bends 130/).met, item(ev, /bends 130/).detail);
});

// ---------------- Loophole 2: pain rule needs 3 different days, not 3 taps
section('Loophole 2', () => {
  const c = COND.pfp, plan = { startedAt: now - 3 * wk, phaseStartedAt: now - 3 * wk, injured: null, tests: [], kneeTests: [], psfs: [{ at: now, score: 6 }] };
  const sameDay = [1, 2, 3].map(i => ({ at: now - day + i * 1000, during: 1, after: 1, nextMorning: 1 }));
  let ev = evaluatePhase(c, 0, { ...plan, checkins: sameDay }, now);
  check('2: three check-ins on one day do not pass the pain rule', !item(ev, /^Pain/).met, item(ev, /^Pain/).detail);
  ev = evaluatePhase(c, 0, { ...plan, checkins: goodDays() }, now);
  check('2: three good days pass the pain rule', item(ev, /^Pain/).met, item(ev, /^Pain/).detail);
  const flare = [...goodDays(), { at: now - day + 5000, during: 6, after: 5, nextMorning: null }];
  ev = evaluatePhase(c, 0, { ...plan, checkins: flare }, now);
  check('2: a second, worse check-in on the same day counts (worst of the day)', !item(ev, /^Pain/).met);
});

// ---------------- Loophole 3: a skipped morning check is not a pass
section('Loophole 3', () => {
  const c = COND.pfp, plan = { startedAt: now - 3 * wk, phaseStartedAt: now - 3 * wk, tests: [], kneeTests: [], psfs: [{ at: now, score: 6 }] };
  const noMorning = goodDays().map(k => ({ ...k, nextMorning: null }));
  const ev = evaluatePhase(c, 0, { ...plan, checkins: noMorning }, now);
  check('3: check-ins without the next-morning answer do not pass', !item(ev, /^Pain/).met, item(ev, /^Pain/).detail);
  check('3: the detail says the morning check is missing', /morning/i.test(item(ev, /^Pain/).detail));
});

// ---------------- Loophole 4: ACL return to sport needs 9+ months since surgery or injury
section('Loophole 4', () => {
  const acl = COND.acl, last = acl.phases.length - 1;
  const rts = { startedAt: now - 30 * wk, phaseStartedAt: now - 10 * wk, injured: 'R', psfs: [{ at: now, score: 9.5 }], kneeTests: [],
    checkins: goodDays(3, 0).map(k => ({ ...k, nextMorning: 0 })),
    tests: [{ at: now, test: 'hop', side: 'L', value: 150 }, { at: now, test: 'hop', side: 'R', value: 140 }, { at: now, test: 'landingFPPA', L: 6, R: 8 }] };
  let ev = evaluatePhase(acl, last, { ...rts, surgeryAt: now - 26 * wk }, now);
  check('4: ACL return to sport blocked at 6 months after surgery', !ev.allMet && item(ev, /9 months/) && !item(ev, /9 months/).met);
  ev = evaluatePhase(acl, last, { ...rts, surgeryAt: now - 40 * wk }, now);
  check('4: ACL return to sport passes at 9+ months with tests passed', ev.allMet, ev.items.filter(i => !i.met).map(i => i.label).join(' | '));
  ev = evaluatePhase(acl, last, rts, now);
  check('4: no surgery or injury date → blocked and asks for it', !item(ev, /9 months/).met && /date/i.test(item(ev, /9 months/).detail));
  check('4: ACL asks for a surgery/injury date at the start', !!acl.needsDate);
});

// ---------------- Clinic intake (consultation)
section('Clinic intake (consultation)', () => {
  const high = R.consult({ restPain: 7, worstPain: 9, settle: 'nextDay', nightPain: true, duration: 'acute', goal: 'daily', daysAvailable: 5 });
  check('intake: severe, slow-to-settle pain → high irritability', high.irritability === 'high');
  const mod = R.consult({ restPain: 2, worstPain: 6, settle: 'hours', nightPain: false, duration: 'subacute', goal: 'gym', daysAvailable: 3 });
  check('intake: moderate pain that settles in hours → moderate', mod.irritability === 'moderate');
  const low = R.consult({ restPain: 0, worstPain: 3, settle: 'minutes', nightPain: false, duration: 'persistent', goal: 'sport', daysAvailable: 4 });
  check('intake: mild pain that settles in minutes → low', low.irritability === 'low');
  check('intake: every result explains why', [high, mod, low].every(r => r.reasons.length >= 1));
  check('intake: sessions follow the days available, capped at 5', R.consult({ restPain: 1, worstPain: 3, settle: 'minutes', duration: 'acute', goal: 'gym', daysAvailable: 7 }).sessionsPerWeek === 5);
  const one = R.consult({ restPain: 1, worstPain: 3, settle: 'minutes', duration: 'acute', goal: 'gym', daysAvailable: 1 });
  check('intake: under 2 days a week → warns that 2 is the minimum', one.sessionsPerWeek === 2 && one.warnings.some(w => /2/.test(w)));
  check('intake: high irritability lowers the pain limit by 1', R.carePlan(COND.pfp, high).painLimit === COND.pfp.painLimit - 1);
  check('intake: other levels keep the condition pain limit', R.carePlan(COND.pfp, mod).painLimit === COND.pfp.painLimit);
  check('intake: pain limit never goes below 0', R.carePlan(COND.hamstring, high).painLimit === 0);
  check('dose: gentle start takes one set off', R.dose('3×10', 'gentle') === '2×10' && R.dose('5×45 s', 'gentle') === '4×45 s');
  check('dose: single sets and free text are left alone', R.dose('1×10', 'gentle') === '1×10' && R.dose('daily', 'gentle') === 'daily');
  check('dose: standard is unchanged', R.dose('3×10', 'standard') === '3×10');
  check('care plan never promises a recovery date', !/cure|guarantee|will be healed/i.test(JSON.stringify(R.carePlan(COND.acl, low))));
});

// ---------------- Escalation: repeated flare-ups → physio review
section('Escalation', () => {
  const c = COND.pfp;
  const reds = [{ at: now - 2 * day, during: 7, after: 6, nextMorning: 5 }, { at: now - day, during: 7, after: 6, nextMorning: 5 }];
  check('review: 2 red sessions in a row → needs a physio review', R.needsReview(c, { checkins: reds, usualMorning: 2, phaseStartedAt: 0 }));
  check('review: one red then green → no review', !R.needsReview(c, { checkins: [reds[0], { at: now - day, during: 1, after: 1, nextMorning: 1 }], usualMorning: 2, phaseStartedAt: 0 }));
  const ev = evaluatePhase(c, 0, { startedAt: now - 3 * wk, phaseStartedAt: now - 3 * wk, checkins: [...goodDays(3).map(k => ({ ...k, at: k.at - 3 * day })), ...reds], tests: [], kneeTests: [], psfs: [{ at: now, score: 6 }], usualMorning: 2 }, now);
  check('review: progression is blocked while a review is needed', !ev.allMet);
});

// ---------------- Emergency numbers by region (owner is in the UAE)
section('Emergency numbers by region (owner is in the UAE)', () => {
  const uae = R.emergencyInfo({ timeZone: 'Asia/Dubai' }), uk = R.emergencyInfo({ timeZone: 'Europe/London' }), other = R.emergencyInfo({ timeZone: 'UTC' });
  check('emergency: UAE → 998 ambulance, no NHS', uae.number === '998' && !/NHS/.test(JSON.stringify(uae)));
  check('emergency: UK → 999 and NHS 111', uk.number === '999' && /NHS 111/.test(uk.urgent));
  check('emergency: unknown region lists the common numbers', /999/.test(other.text) && /998/.test(other.text) && /911/.test(other.text));
});

// ---------------- Evidence: osteoarthritis cites the ACR guideline
section('Evidence: osteoarthritis cites the ACR guideline', () => {
check('OA evidence cites the 2019 ACR/Arthritis Foundation guideline', /American College of Rheumatology/.test(COND.oa.evidence) && /2019/.test(COND.oa.evidence));
check('hip OA gets hip safety questions, not only knee', COND.oa.flags.some(f => /hip/i.test(`${f.q} ${f.why || ''}`)));
});

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
