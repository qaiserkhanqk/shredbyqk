// Exercise recognition: each simulated exercise is recognised within its first couple of reps,
// standing still is not mistaken for an exercise, and the plank is recognised as a hold.
// Run: node tests/detect.test.mjs
import { ExerciseDetector } from '../js/detect.js';
import { frameAt, side } from './synth.mjs';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

function detect(name, secs = 8, opts) {
  const d = new ExerciseDetector();
  for (let t = 0; t < secs; t += 1 / 30) { const r = d.push(frameAt(name, t, opts), t * 1000); if (r) return { ...r, at: +t.toFixed(1) }; }
  return null;
}
const EXPECT = {
  squat: 'squat', squatFront: 'squat', lunge: 'lunge', rdl: 'rdl', calf: 'calf', curl: 'curl', curlFront: 'curl', pushdown: 'pushdown',
  ohTri: 'ohTri', press: 'press', row: 'row', lateral: 'lateral', frontRaise: 'front', pullUp: 'vPull', pushUp: 'pushUp', bench: 'bench',
  bridge: 'bridge', crunch: 'crunch', legRaise: 'legRaise',
};
for (const [name, key] of Object.entries(EXPECT)) {
  const r = detect(name);
  check(`${name} → ${key}`, r?.key === key, r ? `${r.key} (${r.label}) at ${r.at} s` : 'not recognised');
}
// Speed: recognised by the end of the second rep (lead 0.6 s + 2 × 2.4 s).
const slow = Object.keys(EXPECT).map(n => [n, detect(n)?.at ?? 99]).filter(([, at]) => at > 5.4);
check('every exercise recognised within two reps', !slow.length, slow.map(s => s.join(' ')).join(', '));

// Real cameras jitter: every joint wobbles a few pixels each frame. Still recognised correctly.
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
const jitter = px => px.map(p => ({ ...p, x: p.x + rnd() * 8, y: p.y + rnd() * 8 }));
const wrong = [];
for (const [name, key] of Object.entries(EXPECT)) {
  const d = new ExerciseDetector(); let r = null;
  for (let t = 0; t < 8 && !r; t += 1 / 30) r = d.push(jitter(frameAt(name, t)), t * 1000);
  if (r?.key !== key) wrong.push(`${name}→${r?.key ?? 'none'}`);
}
check('with ±4 px camera jitter, every exercise still recognised correctly', !wrong.length, wrong.join(', '));

// Standing still, or a single fidget, is not an exercise.
const still = new ExerciseDetector(); let hit = null;
for (let t = 0; t < 6; t += 1 / 30) hit ||= still.push(frameAt('squat', 0), t * 1000);
check('standing still → nothing', !hit, hit?.key);
const once = new ExerciseDetector(); hit = null;
for (let t = 0; t < 6; t += 1 / 30) hit ||= once.push(frameAt('squat', Math.min(t, 1.8), { lead: 0.6 }), t * 1000); // half a rep, then stops at the bottom
check('half a rep then stopping → nothing yet', !hit, hit?.key);

// Plank: still, lying, straight body.
const pl = new ExerciseDetector(); hit = null;
for (let t = 0; t < 6; t += 1 / 30) hit ||= pl.push(side({ k: 270, s: 272, t: 85, u: 180, f: 90 }), t * 1000);
check('plank hold → plank', hit?.key === 'plank', hit?.key);

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
