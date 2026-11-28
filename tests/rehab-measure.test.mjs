// Rehab measurement upgrades: phone-on-limb sensor, stricter camera checks, measurement error,
// strength checks, the overall rating, and the goniometer accuracy check.
// Run: node tests/rehab-measure.test.mjs
import * as L from '../js/limb.js';
import * as A from '../js/assess.js';
import * as R from '../js/rehab.js';
import { ROM_TESTS, runRomTest, repPeaks, outOfPlane } from '../js/rom.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const section = async (name, fn) => { try { await fn(); } catch (e) { check(`${name}: runs`, false, e.message); } };
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const g = 9.81, rad = d => d * Math.PI / 180;
// Gravity in the phone's frame when its long edge is tilted `deg` from vertical, in the phone's own y–z plane.
const tilt = (deg, s = 1) => ({ x: 0, y: s * g * Math.cos(rad(deg)), z: s * g * Math.sin(rad(deg)) });
const now = Date.UTC(2026, 10, 28, 12);

await section('Phone sensor geometry', () => {
  check('angle between two readings', near(L.angleBetween(tilt(0), tilt(90)), 90));
  check('same answer when the platform reports gravity with the opposite sign (iOS vs Android)', near(L.angleBetween(tilt(10, -1), tilt(100, -1)), 90));
  check('tilt from vertical: upright 0°, flat 90°, upside down 0°', near(L.tiltFromVertical(tilt(0)), 0) && near(L.tiltFromVertical(tilt(90)), 90) && near(L.tiltFromVertical(tilt(180)), 0));
  check('knee bend: thigh flat, shin hanging = 90°', near(L.SENSOR_TESTS.kneeFlexion.compute([tilt(90), tilt(0)]), 90));
  check('knee straight: thigh and shin in line = 0° short of straight', near(L.SENSOR_TESTS.kneeExtension.compute([tilt(80), tilt(80)]), 0));
  check('shoulder raise: arm hanging to overhead = 170°', near(L.SENSOR_TESTS.shoulderFlexion.compute([tilt(0), tilt(170)]), 170));
  check('ankle: shin 38° forward of vertical', near(L.SENSOR_TESTS.ankleDorsiflexion.compute([tilt(38)]), 38));
  check('sensor tests use the same ids as the camera tests', Object.keys(L.SENSOR_TESTS).every(id => ROM_TESTS[id]));
});

await section('Steady reading', () => {
  const still = Array.from({ length: 70 }, (_, i) => ({ t: i * 16, ...tilt(45 + Math.sin(i) * 0.3) }));
  const r = L.steadyReading(still);
  check('a phone held still gives a reading', !!r && near(L.tiltFromVertical(r), 45, 1));
  const moving = Array.from({ length: 70 }, (_, i) => ({ t: i * 16, ...tilt(20 + i) }));
  check('a moving phone gives no reading', L.steadyReading(moving) === null);
  check('less than a second of samples gives no reading', L.steadyReading(still.slice(0, 30)) === null);
  const shaken = still.map(s => ({ ...s, x: 6 }));
  check('readings far from 1 g (phone being swung) give no reading', L.steadyReading(shaken) === null);
  check('a phone held still is not moving', !L.isMoving(still));
  check('a phone turning is moving', L.isMoving(moving));
  check('a phone being lifted (gravity off 1 g) is moving', L.isMoving(still.map((s, i) => (i > 60 ? { ...s, z: s.z + 3 } : s))));
});

await section('Three tries', () => {
  const r = L.sensorResult('kneeFlexion', [[tilt(90), tilt(-30)], [tilt(90), tilt(-28)], [tilt(90), tilt(-31)]]);
  check('the middle of 3 tries is kept', r.ok && near(r.value, 120), String(r.value));
  check('tries close together: no warning', r.ok && r.issues.length === 0 && r.spread <= 3);
  check('result is marked as the phone sensor', r.method === 'sensor');
  const w = L.sensorResult('kneeFlexion', [[tilt(90), tilt(-30)], [tilt(90), tilt(-10)], [tilt(90), tilt(-31)]]);
  check('tries far apart: marked less certain', w.ok && w.issues.length === 1 && /less certain/.test(w.issues[0]), w.issues[0]);
  check('no readings: not ok', !L.sensorResult('kneeFlexion', []).ok);
});

await section('Camera: repetitions and side-on check', async () => {
  const sig = [0, 10, 80, 90, 85, 20, 5, 82, 88, 86, 30, 0, 91, 93, 90, 10];
  check('finds one peak per repetition', repPeaks(sig).length === 3, JSON.stringify(repPeaks(sig)));
  // Synthetic side-on knee bend: 60 frames, left side visible.
  const frame = (i, zKnee) => {
    const px = Array.from({ length: 33 }, () => ({ x: 300, y: 300, v: 0.2 }));
    const bend = 40 + 60 * Math.abs(Math.sin(i / 10));
    px[11] = { x: 300, y: 100, v: 1 }; px[13] = { x: 300, y: 200, v: 1 }; px[15] = { x: 300, y: 280, v: 1 };
    px[23] = { x: 300, y: 300, v: 1 }; px[25] = { x: 400, y: 300, v: 1 };
    px[27] = { x: 400 + 100 * Math.cos(rad(180 - bend)), y: 300 + 100 * Math.sin(rad(180 - bend)), v: 1 };
    px[31] = { x: px[27].x + 20, y: px[27].y, v: 1 };
    px.world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    px.world[23] = { x: 0, y: 0, z: 0 }; px.world[25] = { x: 0.4, y: 0, z: zKnee };
    return { t: i * 33, px };
  };
  const good = Array.from({ length: 60 }, (_, i) => frame(i, 0.05));
  check('side-on limb: out-of-plane angle is small', outOfPlane('kneeFlexion', good) < 15, String(outOfPlane('kneeFlexion', good)));
  const r = await runRomTest('kneeFlexion', good);
  check('side-on recording is measured, marked camera', r.ok && r.method === 'camera', JSON.stringify(r.issues));
  const turned = Array.from({ length: 60 }, (_, i) => frame(i, 0.4));
  const t = await runRomTest('kneeFlexion', turned);
  check('limb turned towards the camera: not measured, says to turn side-on', !t.ok && /side-on/.test(t.issues[0]), t.issues?.[0]);
  const no3d = good.map(f => { const px = [...f.px]; return { t: f.t, px }; });
  check('recordings without 3D points (old uploads) still work', (await runRomTest('kneeFlexion', no3d)).ok);
});

await section('Measurement error', () => {
  check('phone sensor error is smaller than camera error', A.errorFor('kneeFlexion', 'sensor') < A.errorFor('kneeFlexion', 'camera'));
  check('shoulder camera error is larger than knee camera error', A.errorFor('shoulderFlexion', 'camera') > A.errorFor('kneeFlexion', 'camera'));
  const small = A.realChange('kneeFlexion', { value: 100, method: 'camera' }, { value: 106, method: 'camera' });
  check('a 6° camera change is within measurement error', small && !small.real && small.band === 8);
  const big = A.realChange('kneeFlexion', { value: 100, method: 'sensor' }, { value: 112, method: 'sensor' });
  check('a 12° sensor change is real', big && big.real);
  const mixed = A.realChange('kneeFlexion', { value: 100, method: 'camera' }, { value: 107, method: 'sensor' });
  check('mixed methods use the larger error', mixed && mixed.band === 8 && !mixed.real);
});

await section('Strength checks', () => {
  check('every rehab area with a programme has at least one strength check or a dynamometer group', ['Knee', 'Hip', 'Lower back', 'Ankle & foot', 'Shoulder'].every(a => A.strengthFor(a).length > 0));
  const rows = [{ at: 1, test: 'slBridge', L: 12, method: 'self' }, { at: 2, test: 'slBridge', R: 20, method: 'self' }, { at: 3, test: 'slBridge', L: 15, method: 'self' }];
  const s = A.strengthSummary(rows, 'L')[0];
  check('sides tested separately are combined (latest each side)', s.latest.L === 15 && s.latest.R === 20, JSON.stringify(s.latest));
  check('injured side as % of the other', s.lsi === 75);
  check('first reading kept for progress', s.first.L === 12);
  const auto = A.strengthSummary([{ test: 'sidePlank', L: 30, R: 45 }])[0];
  check('no injured side: the weaker side is compared', auto.weaker === 'L' && auto.lsi === 67);
});

await section('Overall rating', () => {
  check('SANE question names the area and the scale', /knee/.test(A.saneQuestion('Knee')) && /percentage of normal/.test(A.saneQuestion('Knee')));
  check('GROC has 7 answers from a lot worse to a lot better', A.GROC.length === 7 && A.GROC[0][0] === -3 && A.GROC[6][0] === 3);
  const t = A.saneTrend([{ value: 40 }, { value: 50 }, { value: 60 }]);
  check('SANE trend: first, latest, meaningful change', t.first === 40 && t.latest === 60 && t.meaningful);
  check('a 5-point SANE change is not called meaningful', !A.saneTrend([{ value: 50 }, { value: 55 }]).meaningful);
});

await section('Accuracy check (Bland–Altman)', () => {
  const pairs = [{ app: 100, ref: 98 }, { app: 90, ref: 91 }, { app: 120, ref: 116 }, { app: 80, ref: 80 }];
  const a = A.agreement(pairs);
  check('bias is the mean difference', a.n === 4 && near(a.bias, 1.3, 0.05), JSON.stringify(a));
  check('limits of agreement are bias ± 1.96 SD', near(a.loaHigh - a.bias, 1.96 * a.sd, 0.11) && near(a.bias - a.loaLow, 1.96 * a.sd, 0.11));
  check('no pairs: n = 0', A.agreement([]).n === 0);
  const csv = A.agreementCsv([{ at: now, test: 'kneeFlexion', side: 'L', method: 'sensor', app: 100, ref: 98, role: 'Physiotherapist' }]);
  check('CSV is in the validate format, camera and sensor kept apart', csv.split('\n').length === 2 && csv.startsWith('subject,metric,app,reference') && /pair1,kneeFlexion_sensor,100,98,2026-11-28,L,Physiotherapist/.test(csv), csv);
});

await section('Clinician mode: dynamometer and goniometer', () => {
  const who = { name: 'Sara Ahmed', role: 'Physiotherapist' };
  const p = { cond: 'kneeCheck', phase: 0, injured: 'L', tests: [{ at: now, test: 'kneeFlexion', side: 'L', value: 110, method: 'sensor' }, { at: now, test: 'shoulderAbduction', L: 150, R: 170, method: 'camera' }], notes: [] };
  R.applyClinician(p, { type: 'dynamometer', group: 'kneeExt', L: '18.5', R: '26' }, who, now);
  check('dynamometer reading stored per side, logged under the clinician', p.strength[0].L === 18.5 && p.strength[0].R === 26 && /Sara Ahmed \(Physiotherapist\): dynamometer/.test(p.notes[0].text));
  let err = ''; try { R.applyClinician(p, { type: 'dynamometer', group: 'kneeExt', L: '', R: '' }, who, now); } catch (e) { err = e.message; }
  check('dynamometer with no reading is refused', /at least one side/.test(err));
  R.applyClinician(p, { type: 'goniometer', index: 0, ref: 113 }, who, now);
  check('goniometer pair stored with the app value and method', p.validation[0].app === 110 && p.validation[0].ref === 113 && p.validation[0].method === 'sensor');
  R.applyClinician(p, { type: 'goniometer', index: 1, side: 'R', ref: 165 }, who, now);
  check('two-sided result: the chosen side is paired', p.validation[1].app === 170 && p.validation[1].side === 'R');
  err = ''; try { R.applyClinician(p, { type: 'goniometer', index: 0, ref: 'abc' }, who, now); } catch (e) { err = e.message; }
  check('a non-number goniometer reading is refused', /degrees/.test(err));
  check('validation pairs keep no names', !JSON.stringify(p.validation).includes('Sara'));

  const d = R.reportData({ ...p, startedAt: now - 864e6, checkins: [], psfs: [], sane: [{ at: 1, value: 40 }, { at: 2, value: 65 }], groc: [{ at: 2, value: 2 }],
    tests: [...p.tests, { at: now + 1, test: 'kneeFlexion', side: 'L', value: 113, method: 'sensor' }] }, {}, now);
  const km = d.measurements.find(m => m.test === 'kneeFlexion');
  check('report: method per measurement', km.methods.includes('sensor'));
  check('report: 3° sensor change is within measurement error', km.change && !km.change.real);
  check('report: strength and rating included', d.strength.length === 1 && d.sane.latest === 65 && d.groc === 2);
  check('report: goniometer summary hidden below 5 pairs (looks like a validation result)', d.accuracy === null);
  const txt = R.reportText(d);
  check('report text: phone on limb, working margin, SANE', /phone on limb/.test(txt) && /working margin/.test(txt) && /SANE/.test(txt));
  check('report text: no accuracy claim; says accuracy not yet tested', !/more accurate/i.test(txt) && /accuracy has not yet been tested/.test(txt));
  check('report text: dynamometer side is named, not called weaker', /left side 71% of the other/.test(txt) && !/weaker/.test(txt));
  const many = R.reportData({ ...p, startedAt: now, checkins: [], psfs: [], validation: Array.from({ length: 5 }, (_, i) => ({ at: now, test: 'kneeFlexion', app: 100 + i, ref: 101 + i })) }, {}, now);
  check('report text: from 5 pairs, summary shown and says one person only', /one person only; not a test of the app's accuracy/.test(R.reportText(many)));
  check('report text: disclaimer covers sensor estimates and typed clinician readings', /phone-sensor estimates/.test(txt) && /readings typed in clinician mode/.test(txt));
});

await section('Wording', () => {
  const words = JSON.stringify([L.SENSOR_TESTS, A.STRENGTH_TESTS, A.GROC, A.saneQuestion('Knee')]);
  check('every strength check has a stop rule that includes pain', Object.values(A.STRENGTH_TESTS).every(t => /Stop when/.test(t.how) && /pain goes above your limit/.test(t.how)));
  check('sensor steps say "comfortably" where the person pushes range', ['kneeFlexion', 'kneeExtension', 'ankleDorsiflexion', 'shoulderFlexion', 'shoulderAbduction'].every(id => L.SENSOR_TESTS[id].steps.some(s => /comfortabl/.test(s.say))));
  check('no diagnosis, treatment or cure wording in the new tests', !/diagnos|treat|cure|heal|fix/i.test(words));
});

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
