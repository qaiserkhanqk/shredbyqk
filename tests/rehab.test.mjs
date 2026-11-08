// Rehab clinic tests: content integrity, safety triage, pain rules, phase progression, camera ROM tests.
// Run: node tests/rehab.test.mjs
import { CONDITIONS, GENERAL_FLAGS, FLAG_ADVICE, triage, painLight, evaluatePhase, psfsScore, AREAS } from '../js/rehab.js';
import { ROM_TESTS, runRomTest, lsi } from '../js/rom.js';
import { LIB } from '../js/library.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// ---------------- content integrity
const missing = [];
for (const c of CONDITIONS) for (const p of c.phases) for (const [id] of p.exercises) if (!LIB[id]) missing.push(`${c.id}:${id}`);
check('every programme exercise exists in the library', !missing.length, missing.join(', '));
const badTests = CONDITIONS.flatMap(c => [...c.tests, ...c.phases.flatMap(p => p.criteria.filter(k => k.test).map(k => k.test))].filter(t => !ROM_TESTS[t]).map(t => `${c.id}:${t}`));
check('every referenced camera test exists', !badTests.length, badTests.join(', '));
check('every condition has red flags, 3+ phases, evidence and an area', CONDITIONS.every(c => c.flags.length && c.phases.length >= 3 && c.evidence && AREAS.includes(c.area)));
check('every phase has a minimum time and pain criterion', CONDITIONS.every(c => c.phases.every(p => p.minWeeks > 0 && p.criteria.some(k => k.type === 'pain'))));
check(`${CONDITIONS.length} conditions across ${AREAS.length} body areas`, CONDITIONS.length >= 18);
check('post-surgical conditions marked (ACL, PCL)', ['acl', 'pcl'].every(id => CONDITIONS.find(c => c.id === id).postOp));
check('cauda equina symptoms → emergency', CONDITIONS.find(c => c.id === 'lbp').flags.some(f => /bladder|bowel/.test(f.q) && f.level === 'emergency'));
check('Achilles snap → emergency; calf swelling (DVT) → emergency', CONDITIONS.find(c => c.id === 'achilles').flags.filter(f => f.level === 'emergency').length >= 2);
check('every flag level has advice text', [...GENERAL_FLAGS, ...CONDITIONS.flatMap(c => c.flags)].every(f => FLAG_ADVICE[f.level]));

// ---------------- triage
check('triage: all no → clear', triage([{ yes: false, level: 'emergency' }, { yes: false, level: 'urgent' }]) === null);
check('triage: worst level wins', triage([{ yes: true, level: 'assess' }, { yes: true, level: 'emergency' }, { yes: true, level: 'urgent' }]) === 'emergency');
{
  const acl = CONDITIONS.find(c => c.id === 'acl'), qs = [...acl.flags, ...GENERAL_FLAGS];
  const ans = qs.map(f => ({ yes: /fall, crash|swell up within/.test(f.q), level: f.level, unchecked: f.unchecked }));
  check('triage: diagnosed ACL with injury history → not blocked', triage(ans, { diagnosed: true }) === null);
  check('triage: same answers, NOT diagnosed → sent for assessment', triage(ans, { diagnosed: false }) === 'urgent');
  const dvt = qs.map(f => ({ yes: /calf swollen/.test(f.q), level: f.level, unchecked: f.unchecked }));
  check('triage: DVT signs → emergency even when diagnosed', triage(dvt, { diagnosed: true }) === 'emergency');
}
check('triage: urgent beats assess', triage([{ yes: true, level: 'assess' }, { yes: true, level: 'urgent' }]) === 'urgent');

// ---------------- pain monitoring
check('pain: 2/10 during, settled → green', painLight({ during: 2, after: 2, nextMorning: 1, usualMorning: 1 }).light === 'green');
check('pain: 4/10 with limit 3 → amber', painLight({ during: 4, after: 3, nextMorning: 1, usualMorning: 1 }, 3).light === 'amber');
check('pain: 4/10 with tendon limit 5 → green', painLight({ during: 4, after: 4, nextMorning: 2, usualMorning: 2 }, 5).light === 'green');
check('pain: worse next morning → red', painLight({ during: 3, after: 3, nextMorning: 5, usualMorning: 2 }, 3).light === 'red');
check('pain: 7/10 during → red', painLight({ during: 7, after: 6 }, 3).light === 'red');

// ---------------- phase progression
{
  const c = CONDITIONS.find(x => x.id === 'acl'), day = 864e5, now = Date.now();
  const base = { startedAt: now - 20 * day, phaseStartedAt: now - 20 * day, checkins: [], tests: [], psfs: [], kneeTests: [], injured: 'R' };
  let e = evaluatePhase(c, 0, base, now);
  check('ACL phase 1: blocked with no data', !e.allMet, e.items.filter(i => !i.met).map(i => i.label).join(' | '));
  const ok = { ...base, checkins: [1, 2, 3].map(k => ({ at: now - k * day, during: 2, after: 2, nextMorning: 1 })), tests: [{ at: now, test: 'kneeExtension', value: 2 }, { at: now, test: 'kneeFlexion', value: 118 }] };
  e = evaluatePhase(c, 0, ok, now);
  check('ACL phase 1: passes when straight, 118° bend, pain ≤3, 2+ weeks', e.allMet, e.items.map(i => `${i.met ? '✓' : '✗'} ${i.label}`).join(' | '));
  const early = { ...ok, phaseStartedAt: now - 5 * day };
  check('ACL phase 1: still blocked if under the minimum time', !evaluatePhase(c, 0, early, now).allMet);
  const rts = { ...ok, phaseStartedAt: now - 70 * day, checkins: [1, 2, 3].map(k => ({ at: now - k * day, during: 0, after: 0, nextMorning: 0 })),
    tests: [{ at: now, test: 'hop', side: 'L', value: 150 }, { at: now, test: 'hop', side: 'R', value: 128 }, { at: now, test: 'landingFPPA', L: 6, R: 8 }], psfs: [{ at: now, score: 9.3 }] };
  e = evaluatePhase(c, 3, rts, now);
  check('ACL return to sport: hop LSI 85% blocks (needs 90%)', !e.allMet && e.items.some(i => /90%/.test(i.label) && !i.met && i.detail === '85%'), e.items.map(i => `${i.met ? '✓' : '✗'} ${i.label} (${i.detail})`).join(' | '));
  rts.tests[1].value = 140;
  check('ACL return to sport: hop LSI 93% passes', evaluatePhase(c, 3, rts, now).allMet);
}
check('PSFS score = mean of activities', psfsScore([4, 6, 8]) === 6);
check('LSI 135/150 = 90%; inverted for lower-is-better', lsi(135, 150) === 90 && lsi(12, 6, false) === 50);

// ---------------- camera ROM tests on synthetic movement with known answers
const blank = () => Array.from({ length: 33 }, () => ({ x: 300, y: 300, v: 0.95 }));
const side = (fn, n = 240) => Array.from({ length: n }, (_, i) => { const px = blank(); fn(px, i / n); for (const k of [12, 14, 16, 24, 26, 28, 30, 32]) px[k] = { ...px[k - 1], v: 0.3 }; return { t: i * 33.3, px }; });
const rad = d => d * Math.PI / 180;
{
  // Shoulder forward raise to 150°: arm swings from down (0°) to 150° in front, 2 reps.
  const fr = side((px, u) => {
    px[23] = { x: 300, y: 400, v: .95 }; px[11] = { x: 300, y: 200, v: .95 }; px[25] = { x: 300, y: 550, v: .95 }; px[27] = { x: 300, y: 700, v: .95 };
    const a = rad(150 * Math.abs(Math.sin(u * 2 * Math.PI)));
    px[13] = { x: 300 + 120 * Math.sin(a), y: 200 + 120 * Math.cos(a), v: .95 }; px[15] = { x: 300 + 220 * Math.sin(a), y: 200 + 220 * Math.cos(a), v: .95 };
  });
  const r = await runRomTest('shoulderFlexion', fr);
  check('shoulder forward raise: 150° (±3)', r.ok && Math.abs(r.value - 150) <= 3, `${r.value}°`);
}
{
  // Knee bend to 125° flexion (lying side-on): knee angle 180 → 55.
  const fr = side((px, u) => {
    const flex = 125 * Math.abs(Math.sin(u * 3 * Math.PI)), hip = { x: 200, y: 400 }, th = rad(flex * 0.5), sh = rad(flex * 0.5);
    px[11] = { x: 50, y: 400, v: .95 }; px[23] = { ...hip, v: .95 };
    const knee = { x: hip.x + 160 * Math.cos(th), y: hip.y - 160 * Math.sin(th) };
    px[25] = { ...knee, v: .95 }; px[27] = { x: knee.x - 150 * Math.cos(sh) * 0 + 150 * Math.cos(Math.PI - sh + th) * -1, y: knee.y + 150 * Math.sin(sh + th) * 0 + 150 * Math.sin(th - (Math.PI - rad(flex))) * -1, v: .95 };
    // place ankle so the hip–knee–ankle angle is exactly 180 − flex
    const thighDir = Math.atan2(knee.y - hip.y, knee.x - hip.x), shinDir = thighDir + rad(flex);
    px[27] = { x: knee.x + 150 * Math.cos(shinDir), y: knee.y + 150 * Math.sin(shinDir), v: .95 };
  });
  const r = await runRomTest('kneeFlexion', fr);
  check('knee bend: 125° (±3)', r.ok && Math.abs(r.value - 125) <= 3, `${r.value}°`);
}
{
  // 30-second sit-to-stand: 11 full cycles of knee angle 90° ↔ 175°.
  const fr = side((px, u) => {
    const k = 132.5 - 42.5 * Math.cos(u * 11 * 2 * Math.PI), hip = { x: 300, y: 400 };
    px[11] = { x: 300, y: 200, v: .95 }; px[23] = { ...hip, v: .95 }; px[25] = { x: 460, y: 400, v: .95 };
    const d = Math.atan2(0, 160) + Math.PI - rad(k); px[27] = { x: 460 + 150 * Math.cos(d), y: 400 + 150 * Math.sin(d), v: .95 };
  }, 900);
  const r = await runRomTest('chairStand30', fr);
  check('30-s sit-to-stand: counts 11 reps', r.ok && r.value === 11, `${r.value}`);
}
{
  // Single-leg hop 1.20 m with a known scale (2 mm/px).
  const mPerPx = 0.002, fr = [];
  for (let i = 0; i < 120; i++) {
    const px = blank(), t = i / 60; let x = 100, lift = 0;
    if (t > 0.5 && t < 0.95) { const s = (t - 0.5) / 0.45; x = 100 + 600 * s; lift = 120 * Math.sin(Math.PI * s); } else if (t >= 0.95) x = 700;
    for (const k of [27, 28]) px[k] = { x, y: 680 - lift, v: .95 }; for (const k of [29, 30, 31, 32]) px[k] = { x, y: 700 - lift, v: .95 };
    for (const k of [25, 26]) px[k] = { x, y: 560 - lift, v: .95 };
    fr.push({ t: t * 1000, px });
  }
  const r = await runRomTest('hop', fr, { mPerPx });
  check('hop: 120 cm (±6)', r.ok && Math.abs(r.value - 120) <= 6, `${r.value} cm`);
  check('hop without a scale asks for height', !(await runRomTest('hop', fr)).ok);
}
{
  // Calf raise endurance: 18 rises (heel lifts above the toes).
  const fr = side((px, u) => {
    const lift = Math.max(0, Math.sin(u * 18 * 2 * Math.PI)) * 40;
    px[11] = { x: 300, y: 150, v: .95 }; px[23] = { x: 300, y: 350, v: .95 }; px[25] = { x: 300, y: 500, v: .95 };
    px[27] = { x: 300, y: 640 - lift, v: .95 }; px[29] = { x: 280, y: 660 - lift, v: .95 }; px[31] = { x: 380, y: 660, v: .95 };
  }, 1800);
  const r = await runRomTest('calfRaiseEndurance', fr);
  check('calf raise endurance: counts 18', r.ok && r.value === 18, `${r.value}`);
}

{
  // Forward bend to 80° filmed side-on (far side hidden, as in real use).
  const fr = side((px, u) => { const a = rad(80 * Math.abs(Math.sin(u * 2 * Math.PI))); px[23] = { x: 300, y: 400, v: .95 }; px[11] = { x: 300 + 200 * Math.sin(a), y: 400 - 200 * Math.cos(a), v: .95 }; px[25] = { x: 300, y: 550, v: .95 }; px[27] = { x: 300, y: 700, v: .95 }; });
  const r = await runRomTest('trunkFlexion', fr);
  check('forward bend, side-on: 80° (±3)', r.ok && Math.abs(r.value - 80) <= 3, `${r.value}°`);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
