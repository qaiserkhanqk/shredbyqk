// Gait engine test: a simulated walker with known cadence and a right-side hip restriction.
import { analyseGait, simulateWalker } from '../js/gait.js';
const frames = []; for (let i = 0; i < 30 * 8; i++) { const t = i / 30; frames.push({ t: t * 1000, px: simulateWalker(t) }); }
const r = analyseGait(frames, { mode: 'walk' });
const assert = (c, m) => { if (!c) { console.error('FAIL', m, JSON.stringify(r.metrics ?? r, null, 1)); process.exit(1); } console.log('ok -', m); };
assert(r.ok && r.view === 'side', 'detects side view');
console.table(r.metrics.map(m => ({ label: m.label, value: m.value, unit: m.unit, ok: m.ok, si: m.si && m.si.toFixed(1) })));
console.log(r.findings.map(f => f.title));
assert(Math.abs(r.cadence - 60 / 0.55) < 6, `cadence ≈ 109 (got ${r.cadence.toFixed(1)})`);
assert(r.findings.some(f => /hip extension \(right/.test(f.title)), 'finds the right hip restriction');
const sym = analyseGait(Array.from({ length: 240 }, (_, i) => ({ t: i / 30 * 1000, px: simulateWalker(i / 30, { asym: false }) })), { mode: 'walk' });
assert(!sym.findings.some(f => /hip extension/i.test(f.title)), 'symmetric walker: no hip finding');
console.log('ALL PASS');
