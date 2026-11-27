// Rehab: camera movement check (measure and target, never diagnose) and clinician mode.
// Run: node tests/rehab-screen.test.mjs
import * as R from '../js/rehab.js';
import { LIB } from '../js/library.js';
import { ROM_TESTS } from '../js/rom.js';
const { COND, evaluatePhase } = R;

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const section = async (name, fn) => { try { await fn(); } catch (e) { check(`${name}: runs`, false, e.message); } };
const day = 864e5, wk = 7 * day, now = Date.UTC(2026, 10, 27, 12);
const goodDays = (n = 3) => Array.from({ length: n }, (_, i) => ({ at: now - (i + 1) * day, during: 1, after: 1, nextMorning: 1 }));
const DIAGNOSIS = /tear|rupture|tendinopathy|osteoarthritis|patellofemoral|ACL|PCL|meniscus|sprain|fasciitis|you have|diagnos/i;

await section('Movement check set-up', () => {
  for (const area of ['Knee', 'Shoulder', 'Lower back', 'Ankle & foot', 'Hip']) {
    const q = R.screenQueue(area);
    check(`${area}: has a camera movement check`, q.length >= 1 && q.every(s => ROM_TESTS[s.test]), q.map(s => s.test + (s.side || '')).join(' '));
  }
  check('Knee check tests both knees for bend and straightening', ['kneeFlexion', 'kneeExtension'].every(t => ['L', 'R'].every(s => R.screenQueue('Knee').some(x => x.test === t && x.side === s))));
  check('Neck, Elbow, Thigh and Shin say there is no camera check', ['Neck', 'Elbow', 'Thigh', 'Shin'].every(a => R.screenQueue(a).length === 0));
  check('Knee check takes under 2 minutes of recording', R.screenQueue('Knee').reduce((s, x) => s + ROM_TESTS[x.test].secs, 0) <= 120);
  for (const area of ['Knee', 'Shoulder', 'Lower back', 'Ankle & foot', 'Hip']) {
    const c = COND[R.screenConditionFor(area)];
    check(`${area}: movement check leads to a programme that names no diagnosis`, !!c && (c.general || ['lbp', 'neck'].includes(c.id)) && !(c.general && DIAGNOSIS.test(c.name)), c?.name);
  }
  const missing = R.CONDITIONS.filter(c => c.general).flatMap(c => c.phases.flatMap(p => p.exercises.map(([id]) => id))).filter(id => !LIB[id]);
  check('general programmes only use library exercises', !missing.length, missing.join(', '));
});

await section('Findings: measured, not diagnosed', () => {
  const knee = [{ test: 'kneeFlexion', side: 'L', value: 105 }, { test: 'kneeFlexion', side: 'R', value: 138 }, { test: 'kneeExtension', side: 'L', value: 9 }, { test: 'kneeExtension', side: 'R', value: 1 }, { test: 'chairStand30', value: 11 }];
  const f = R.screenFindings(knee);
  const bend = f.find(x => x.test === 'kneeFlexion'), straight = f.find(x => x.test === 'kneeExtension');
  check('left knee bending 105° vs 138° is found, on the left', bend && bend.side === 'L' && /left/i.test(bend.text) && /105/.test(bend.text) && /138/.test(bend.text), bend?.text);
  check('left knee 9° short of straight is found', straight && straight.side === 'L' && /9°/.test(straight.text), straight?.text);
  check('sit-to-stand is kept as a baseline, not judged', !f.some(x => x.test === 'chairStand30' && x.criterion));
  check('no finding names a condition', f.every(x => !DIAGNOSIS.test(x.text)), f.map(x => x.text).join(' | '));
  check('each deficit becomes a goal for the injured side', bend.criterion?.side === 'L' && straight.criterion?.side === 'L');
  const even = R.screenFindings([{ test: 'kneeFlexion', side: 'L', value: 136 }, { test: 'kneeFlexion', side: 'R', value: 140 }]);
  check('a 3% difference within the typical range is not a finding', !even.some(x => x.criterion));
  const both = R.screenFindings([{ test: 'kneeFlexion', side: 'L', value: 110 }, { test: 'kneeFlexion', side: 'R', value: 112 }]);
  check('both knees limited → found against the typical range', both.some(x => x.criterion && /both/i.test(x.text)), both.map(x => x.text).join(' | '));
  const sh = R.screenFindings([{ test: 'shoulderAbduction', L: 175, R: 120 }]);
  check('shoulder side raise from one front-on recording compares L and R', sh.some(x => x.side === 'R' && x.criterion), sh.map(x => x.text).join(' | '));
  check('affected side is the side with the deficits', R.affectedSide(f) === 'L' && R.affectedSide(sh) === 'R' && R.affectedSide(even) === null);
});

await section("Movements the person can't do", () => {
  const res = [{ test: 'kneeFlexion', side: 'L', skipped: true, reason: 'pain' }, { test: 'kneeFlexion', side: 'R', value: 138 }, { test: 'chairStand30', skipped: true, reason: 'cant' }];
  const f = R.screenFindings(res);
  const pain = f.find(x => x.test === 'kneeFlexion' && x.skipped), cant = f.find(x => x.test === 'chairStand30' && x.skipped);
  check('a test skipped as too painful is a finding on that side', pain && pain.side === 'L' && /too painful/i.test(pain.text) && /left/i.test(pain.text), pain?.text);
  check("a test the person couldn't do is a finding", cant && /couldn't/i.test(cant.text), cant?.text);
  check('skipped tests name no condition', f.every(x => !DIAGNOSIS.test(x.text)));
  const adj = R.screenAdjust(res);
  check("anything skipped → gentle start, with the reason", adj.gentle && adj.reasons.length >= 1);
  check('2 tests not done → physio assessment advised', adj.physioAdvised);
  check('one test too painful → physio assessment advised', R.screenAdjust([res[0], res[1]]).physioAdvised);
  check("one test the person couldn't get into position for → gentle, no physio flag", R.screenAdjust([res[1], res[2]]).gentle && !R.screenAdjust([res[1], res[2]]).physioAdvised);
  check('everything done → no change', !R.screenAdjust([res[1]]).gentle && !R.screenAdjust([res[1]]).physioAdvised);
});

await section('Goals from findings gate the programme', () => {
  const c = COND[R.screenConditionFor('Knee')], f = R.screenFindings([{ test: 'kneeFlexion', side: 'L', value: 105 }, { test: 'kneeFlexion', side: 'R', value: 138 }]);
  const plan = { startedAt: now - 10 * wk, phaseStartedAt: now - 6 * wk, injured: 'L', checkins: goodDays(), psfs: [{ at: now, score: 8 }], tests: [], kneeTests: [], extraCriteria: R.screenCriteria(f) };
  const at = c.phases.findIndex((_, i) => (plan.extraCriteria[i] || []).length);
  check('measured goals sit on a phase of the programme', at >= 0);
  let ev = evaluatePhase(c, at, { ...plan, tests: [{ at: now, test: 'kneeFlexion', side: 'L', value: 112 }, { at: now, test: 'kneeFlexion', side: 'R', value: 138 }] }, now);
  check('goal not met while the left knee is still 81% of the right', ev.items.some(i => /left/i.test(i.label) && !i.met), ev.items.map(i => `${i.met ? '✓' : '✗'} ${i.label} ${i.detail}`).join(' | '));
  ev = evaluatePhase(c, at, { ...plan, tests: [{ at: now, test: 'kneeFlexion', side: 'L', value: 128 }, { at: now, test: 'kneeFlexion', side: 'R', value: 138 }] }, now);
  check('goal met once the left knee is within 10% of the right', ev.items.filter(i => /left/i.test(i.label)).every(i => i.met));
});

await section('Clinician access', async () => {
  const rec = await R.clinicianSetup({ name: 'Sara Ahmed', role: 'Physiotherapist', licence: 'DHA-P-12345', pin: '482915' });
  check('PIN is stored only as a salted hash', rec.pinHash && rec.salt && !JSON.stringify(rec).includes('482915'));
  check('right PIN opens', (await R.verifyPin(rec, '482915', now)).ok);
  check('wrong PIN refused', !(await R.verifyPin(rec, '000000', now)).ok);
  for (let i = 0; i < 4; i++) await R.verifyPin(rec, '111111', now);
  const locked = await R.verifyPin(rec, '482915', now + 1000);
  check('5 wrong PINs lock access for 10 minutes, even with the right PIN', !locked.ok && locked.lockedFor > 0);
  check('lock ends after 10 minutes', (await R.verifyPin(rec, '482915', now + 11 * 60e3)).ok);
  let threw = false; try { await R.clinicianSetup({ name: 'X', role: 'Physiotherapist', pin: '12' }); } catch { threw = true; }
  check('PIN must be 4–8 digits', threw);
});

await section('Clinician actions', () => {
  const who = { name: 'Sara Ahmed', role: 'Physiotherapist' };
  const p = { cond: R.screenConditionFor('Knee'), phase: 1, phaseStartedAt: now - wk, startedAt: now - 3 * wk, injured: 'L', checkins: [], tests: [{ at: now, test: 'kneeFlexion', side: 'L', value: 120 }], psfs: [], kneeTests: [], notes: [], painLimit: 3, doseLevel: 'standard' };
  R.applyClinician(p, { type: 'diagnose', cond: 'pfp' }, who, now);
  check('confirming a diagnosis switches to that programme at phase 1, keeping measurements', p.cond === 'pfp' && p.phase === 0 && p.tests.length === 1 && p.diagnosed && p.confirmedBy === 'Sara Ahmed');
  check('every clinician action is written to the notes with their name', p.notes.some(n => /Sara Ahmed/.test(n.text) && /patellofemoral|front of the knee/i.test(n.text)));
  let threw = false; try { R.applyClinician(p, { type: 'setPhase', phase: 2 }, who, now); } catch { threw = true; }
  check('changing the phase needs a reason', threw);
  R.applyClinician(p, { type: 'setPhase', phase: 2, reason: 'Strong single-leg control in clinic' }, who, now);
  check('clinician can set the phase with a reason', p.phase === 2 && p.notes.some(n => /Strong single-leg control/.test(n.text)));
  R.applyClinician(p, { type: 'dose', doseLevel: 'gentle', painLimit: 14 }, who, now);
  check('dose and pain limit set, pain limit kept within 0–10', p.doseLevel === 'gentle' && p.painLimit === 10);
  R.applyClinician(p, { type: 'dates', surgeryAt: now - 40 * wk }, who, now);
  check('clinician can record a surgery date (needed for the ACL 9-month goal)', p.surgeryAt === now - 40 * wk && p.notes.some(n => /surgery/.test(n.text)));
  R.applyClinician(p, { type: 'requireApproval', on: true }, who, now);
  const allMet = { allMet: true };
  check('with approval required, the patient cannot move on alone', !R.canAdvance(p, allMet) && R.canAdvance({ ...p, requireApproval: false }, allMet));
});

await section('Self-picked conditions stay in phase 1', () => {
  const allMet = { allMet: true };
  check('a named condition picked without a diagnosis cannot leave phase 1', !R.canAdvance({ cond: 'pfp', phase: 0, diagnosed: false }, allMet) && /phase 1/.test(R.advanceBlock({ cond: 'pfp', phase: 0, diagnosed: false })));
  check('diagnosed → can move on', R.canAdvance({ cond: 'pfp', phase: 0, diagnosed: true }, allMet));
  check('movement check with a painful test → held in phase 1 until assessed', !R.canAdvance({ cond: 'kneeCheck', phase: 0, physioAdvised: true }, allMet) && R.canAdvance({ cond: 'kneeCheck', phase: 0, physioAdvised: true, diagnosed: true }, allMet));
  check('movement-check programme and non-specific back pain are not capped', R.canAdvance({ cond: 'kneeCheck', phase: 0 }, allMet) && R.canAdvance({ cond: 'lbp', phase: 0 }, allMet));
});

await section('Shared report', () => {
  const p = { cond: 'acl', phase: 1, startedAt: now - 8 * wk, phaseStartedAt: now - 3 * wk, injured: 'L', surgeryAt: now - 20 * wk, painLimit: 3, doseLevel: 'standard',
    checkins: [{ at: now - 2 * day, during: 7, after: 6, nextMorning: 5 }, { at: now - day, during: 2, after: 1, nextMorning: 1 }], usualMorning: 2,
    tests: [{ at: now - 8 * wk, test: 'kneeFlexion', side: 'L', value: 95 }, { at: now, test: 'kneeFlexion', side: 'L', value: 125 }, { at: now, test: 'kneeFlexion', side: 'R', value: 140 }],
    psfs: [{ at: now - 8 * wk, score: 3 }, { at: now, score: 6 }], kneeTests: [], notes: [{ at: now, text: 'Sara Ahmed (Physiotherapist): phase set to 2.' }] };
  const d = R.reportData(p, { name: 'Omar' }, now);
  const kf = d.measurements.find(m => m.test === 'kneeFlexion');
  check('report shows first and latest for the injured side, and the other side', kf && kf.first === 95 && kf.latest === 125 && kf.other === 140 && kf.lsi === 89, JSON.stringify(kf));
  check('report counts flare-ups', d.flareUps === 1);
  check('report shows activity scores first → latest', d.psfs.first === 3 && d.psfs.latest === 6);
  const t = R.reportText(d);
  check('text report has the name, condition, phase and disclaimer', /Omar/.test(t) && /ACL/.test(t) && /Phase 2/.test(t) && /not a diagnosis/i.test(t));
  check('text report carries clinician notes', /Sara Ahmed/.test(t));
});

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
