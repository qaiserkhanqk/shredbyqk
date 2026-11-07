// Every exercise in the library must map to a working pattern: metrics compute a number for the
// primary joint on a realistic pose, and the rep engine accepts it without throwing.
import { LIBRARY, MUSCLES, exFor } from '../js/library.js';
import { RepEngine } from '../js/exercises.js';
import { simulateWalker } from '../js/gait.js';
const fail = m => { console.error('FAIL', m); process.exit(1); };
const ids = new Set();
for (const x of LIBRARY) {
  if (ids.has(x.id)) fail('duplicate id ' + x.id); ids.add(x.id);
  if (!x.muscles.every(m => MUSCLES.includes(m))) fail('unknown muscle in ' + x.id);
  if (!x.pattern) { if (!x.guide) fail('guided exercise without coaching text: ' + x.id); continue; }
  const ex = exFor(x.id); if (!ex) fail('no pattern for ' + x.id);
  for (let i = 0; i < 20; i++) {
    const px = simulateWalker(i / 10);
    const m = ex.metrics(px, ex.view === 'front' ? 'front' : 'side');
    if (!Number.isFinite(m[ex.primary])) fail(`${x.id}: primary "${ex.primary}" not a number`);
    new RepEngine(ex, 'side').update(m, i * 33);
  }
}
const byMuscle = Object.fromEntries(MUSCLES.map(m => [m, LIBRARY.filter(x => x.muscles.includes(m)).length]));
if (Object.values(byMuscle).some(n => n < 3)) fail('a muscle group has fewer than 3 exercises ' + JSON.stringify(byMuscle));
console.log(LIBRARY.length, 'exercises,', LIBRARY.filter(x => x.pattern).length, 'with camera form check'); console.log(byMuscle);
console.log('ALL PASS');
