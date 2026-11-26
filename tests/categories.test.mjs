// Plyometrics, Olympic lifts, stretching, cardio, running and HYROX in the library.
// Run: node tests/categories.test.mjs
import fs from 'node:fs';
import { LIBRARY, LIB, KINDS, exFor } from '../js/library.js';
import { MORE } from '../js/library-more.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const of = k => LIBRARY.filter(x => x.kind === k);

for (const [label, k] of Object.entries(KINDS)) check(`${label}: in the library`, of(k).length > 0, `${of(k).length}`);
check('plyometrics: 50+', of('plyo').length >= 50, of('plyo').length);
check('Olympic lifts: 30+, the squat/press/hinge variants are camera-checked', of('olympic').length >= 30 && of('olympic').filter(x => x.pattern).length >= 6);
check('stretching and mobility: 100+', of('stretch').length >= 100, of('stretch').length);
check('cardio: 12+', of('cardio').length >= 12);

const MODES = ['tempo', 'hold', 'explosive', 'mobility', 'timer', 'intervals', 'stopwatch', 'camera'];
const bad = LIBRARY.filter(x => x.kind && !x.pattern && !MODES.includes(x.coach));
check('every new exercise has a coaching mode', !bad.length, bad.map(x => x.id).join(', '));
check('timers, intervals and holds have their numbers', LIBRARY.every(x => (x.coach !== 'timer' || x.mins > 0) && (x.coach !== 'intervals' || (x.work > 0 && x.rest > 0 && x.rounds > 0)) && (x.coach !== 'hold' || x.hold > 0)));
check('every new exercise has a spoken guide', LIBRARY.filter(x => x.kind).every(x => x.guide && x.guide.length > 30));
check('strongman left out (no sledgehammer, no heavy bag)', !LIBRARY.some(x => /sledgehammer|heavy bag/i.test(x.name)));

// Guides are the app's own words, never the database's instruction text.
// Set FREE_EXERCISE_DB to a downloaded copy of free-exercise-db's dist/exercises.json to run this check.
const db = process.env.FREE_EXERCISE_DB;
if (db && fs.existsSync(db)) {
  const instr = new Set(JSON.parse(fs.readFileSync(db, 'utf8')).flatMap(x => x.instructions).map(s => s.trim()));
  check('no database instruction text copied into guides', !MORE.some(r => instr.has(r[5].guide.trim())));
}

// HYROX: the 8 stations in race order, plus the 1 km run; the two camera-checked ones work.
const H = ['hyroxRun', 'hyroxSki', 'hyroxSledPush', 'hyroxSledPull', 'hyroxBurpeeBJ', 'hyroxRow', 'hyroxFarmers', 'hyroxLunges', 'hyroxWallBalls'];
check('HYROX: run + 8 stations', H.every(id => LIB[id]?.kind === 'hyrox'));
check('HYROX: stations numbered in race order', H.slice(1).every((id, i) => LIB[id].guide.startsWith(`Station ${i + 1}.`)));
check('HYROX: weights point to hyrox.com rather than guessing', ['hyroxSledPush', 'hyroxSledPull', 'hyroxFarmers', 'hyroxLunges', 'hyroxWallBalls'].every(id => /hyrox\.com/.test(LIB[id].guide)));
check('HYROX: wall balls counted by the squat camera check, lunges by the lunge check', exFor('hyroxWallBalls')?.patternKey === 'squat' && exFor('hyroxWallBalls').free && exFor('hyroxLunges')?.patternKey === 'lunge');
check('running: treadmill run links to the running-form camera check', LIB.runTreadmill.formTest === 'run');

// Pilates: the classical mat sequence (34, Return to Life 1945) plus two modern staples.
const pil = of('pilates');
check('Pilates: 34 classical mat exercises + chest lift and criss-cross', pil.length === 36, pil.length);
check('Pilates: the Hundred is a 100-second breathing hold', LIB.pilHundred.coach === 'hold' && LIB.pilHundred.hold === 100);
check('Pilates: push up, leg pull front and shoulder bridge use the camera checks', exFor('pilPushUp')?.patternKey === 'pushUp' && exFor('pilLegPullFront')?.patternKey === 'plank' && exFor('pilShoulderBridge')?.patternKey === 'hipThrust');
check('Pilates: neck-loading moves warn about the neck', ['pilRollOver', 'pilJackKnife', 'pilBoomerang', 'pilControlBalance'].every(id => /neck/i.test(LIB[id].guide)));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
