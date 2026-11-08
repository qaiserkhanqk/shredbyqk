// Builds the regression fixtures in tests/fixtures/ from the demo athletes (known answers).
// Real client sessions that exposed a bug get added to that folder too, with the corrected answer.
// Run: node tests/make-fixtures.mjs
import fs from 'node:fs';
import { HipThrustDemo, WalkDemo } from '../js/demo.js';

const toSession = (meta, frames) => ({ meta: { app: 'fixture', ...meta }, frames: frames.map(f => ({ t: Math.round(f.t * 10) / 10, p: f.px.map(q => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round((q.v ?? 1) * 100) / 100]) })) });
const run = (demo, seconds, fps = 30) => { const fr = []; for (let i = 0; i < seconds * fps; i++) { const t = i * 1000 / fps; fr.push({ t, px: demo.frame(t) }); if (demo.done) break; } return fr; };

fs.writeFileSync('tests/fixtures/hipthrust-demo.json', JSON.stringify(toSession({ kind: 'form', exercise: 'hipThrust', expect: { reps: 10, clean: 7 } }, run(new HipThrustDemo(), 45))));
fs.writeFileSync('tests/fixtures/walk-demo.json', JSON.stringify(toSession({ kind: 'gait', gaitMode: 'walk', expect: { cadenceMin: 100, cadenceMax: 118, finding: 'hip extension (right' } }, run(new WalkDemo(), 10))));
console.log('fixtures written:', fs.readdirSync('tests/fixtures').join(', '));
