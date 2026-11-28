// Athlete Combine tests: camera analysis on synthetic athletes with known answers, scoring,
// limiter choice, and plan integrity for every sport, position, phase and day count.
// Run: node tests/athlete.test.mjs
import { analyseHops, analyseFlyingSprint, analyseShuttle, analyseNordic, analyseBowling, peakPowerSayers, asymmetryPct } from '../js/athlete/tests.js';
import { SPORTS, TESTS, QUALITIES, scoreTest, profile, testsFor, bandName } from '../js/athlete/sports.js';
import { buildPlan, ALL_PLAN_EXERCISES, SPORT_BLOCK_KEYS } from '../js/athlete/plan.js';
import { LIB } from '../js/library.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const G = 9.80665;

// A standing skeleton: hips at (hx, hy), feet on the floor at floorY. px per metre = 200.
function body({ hx = 400, lift = 0, floorY = 600 } = {}) {
  const px = Array.from({ length: 33 }, () => ({ x: hx, y: 300, v: 1 }));
  const fy = floorY - lift;
  const set = (i, x, y) => { px[i] = { x, y, v: 1 }; };
  set(0, hx, fy - 340); set(11, hx - 10, fy - 290); set(12, hx + 10, fy - 290); set(15, hx - 20, fy - 180); set(16, hx + 20, fy - 180);
  set(23, hx - 8, fy - 180); set(24, hx + 8, fy - 180); set(25, hx - 8, fy - 90); set(26, hx + 8, fy - 90);
  set(27, hx - 8, fy - 8); set(28, hx + 8, fy - 8); set(29, hx - 14, fy); set(30, hx + 2, fy); set(31, hx, fy); set(32, hx + 16, fy);
  return px;
}

// ---------------- reactive hops: contact 0.20 s, flight 0.50 s → h = g·t²/8 = 0.306 m, RSI = 1.53
{
  const fps = 240, frames = [], contact = 0.2, flight = 0.5;
  let t = 0;
  for (; t < 0.6; t += 1 / fps) frames.push({ t: t * 1000, px: body() });
  for (let k = 0; k < 10; k++) {
    const t0 = t;
    for (; t < t0 + flight; t += 1 / fps) { const s = t - t0, h = (G * flight / 2) * s - G * s * s / 2; frames.push({ t: t * 1000, px: body({ lift: Math.max(0, h) * 200 }) }); }
    const t1 = t; for (; t < t1 + contact; t += 1 / fps) frames.push({ t: t * 1000, px: body() });
  }
  const r = analyseHops(frames);
  check('hops: finds rebound hops', r.ok && r.hops.length >= 8, `${r.hops?.length} hops`);
  check('hops: RSI ≈ 1.53 (within 0.15)', near(r.rsi, 1.53, 0.15), `RSI ${r.rsi}`);
  check('hops: contact ≈ 200 ms (within 15)', near(r.contactMs, 200, 15), `${r.contactMs} ms`);
}

// ---------------- flying sprint: 9 m/s, 200 px/m, cones 10 m (2000 px) apart → 1.111 s, 32.4 km/h
{
  const fps = 240, frames = [];
  for (let t = 0; t < 1.8; t += 1 / fps) frames.push({ t: t * 1000, px: body({ hx: 100 + 9 * 200 * t }) });
  const r = analyseFlyingSprint(frames, { gateA: 500, gateB: 2500, distanceM: 10 });
  check('fly10: speed ≈ 32.4 km/h (within 0.3)', r.ok && near(r.kmh, 32.4, 0.3), `${r.kmh} km/h, ${r.timeS} s`);
  const back = analyseFlyingSprint(frames.map(f => ({ t: f.t, px: body({ hx: 3000 - (f.px[23].x + 8 - 100) }) })), { gateA: 500, gateB: 2500, distanceM: 10 });
  check('fly10: works running right to left too', back.ok && near(back.kmh, 32.4, 0.3), `${back.kmh}`);
  check('fly10: refuses without cones', !analyseFlyingSprint(frames, {}).ok);
}

// ---------------- 5-0-5: line at x=1000, turn 5 m (1000 px) further; 6 m/s each way + 0.4 s stop → 2.067 s
{
  const fps = 240, frames = [], v = 6 * 200;
  let t = 0, x = 0;
  for (; x < 2000; t += 1 / fps) { x = Math.min(2000, v * t); frames.push({ t: t * 1000, px: body({ hx: x }) }); }
  const tTurn = t; for (; t < tTurn + 0.4; t += 1 / fps) frames.push({ t: t * 1000, px: body({ hx: 2000 }) });
  const t2 = t; for (; t < t2 + 1.4; t += 1 / fps) frames.push({ t: t * 1000, px: body({ hx: 2000 - v * (t - t2) }) });
  const r = analyseShuttle(frames, { gate: 1000 });
  check('5-0-5: time ≈ 2.07 s (within 0.03)', r.ok && near(r.timeS, 2.07, 0.03), `${r.timeS} s`);
}

// ---------------- Nordic: controlled lowering at 25°/s to 55°, then falls at 250°/s
{
  const fps = 60, frames = [];
  const at = deg => { const p = body(); const k = p[25], len = 200, a = deg * Math.PI / 180; p[11] = { x: k.x + Math.sin(a) * len, y: k.y - Math.cos(a) * len, v: 1 }; p[23] = { x: k.x + Math.sin(a) * len / 2, y: k.y - Math.cos(a) * len / 2, v: 1 }; return p; };
  let t = 0;
  for (; t < 0.5; t += 1 / fps) frames.push({ t: t * 1000, px: at(0) });
  for (let d = 0; d <= 55; d += 25 / fps, t += 1 / fps) frames.push({ t: t * 1000, px: at(d) });
  for (let d = 55; d <= 90; d += 250 / fps, t += 1 / fps) frames.push({ t: t * 1000, px: at(d) });
  const r = analyseNordic(frames);
  check('Nordic: break angle ≈ 55° (within 6)', r.ok && near(r.breakDeg, 55, 6), `${r.breakDeg}°`);
}

// ---------------- bowling: front knee 160° at contact, straightens to 175° at release → extender
{
  const fps = 240, frames = [];
  const knee = (p, deg, side) => { // put the knee so hip-knee-ankle = deg, ankle fixed
    const [H, K, A] = side === 'L' ? [23, 25, 27] : [24, 26, 28];
    const a = p[A], th = 90, ln = th * 1, half = (180 - deg) * Math.PI / 180 / 2;
    p[K] = { x: a.x + Math.sin(half) * ln, y: a.y - Math.cos(half) * ln, v: 1 };
    p[H] = { x: a.x, y: a.y - 2 * Math.cos(half) * ln, v: 1 };
  };
  let t = 0, hx = 200;
  const ffcT = 0.5, relT = 0.62;
  for (; t < 0.8; t += 1 / fps) {
    if (t < ffcT) hx += 5;
    const p = body({ hx });
    p[27] = { x: t < ffcT ? hx + 60 : 200 + ffcT * fps * 5 + 60, y: 592, v: 1 }; // front (left) ankle stops at contact
    const kd = t < ffcT ? 150 : 160 + 15 * Math.min(1, (t - ffcT) / (relT - ffcT));
    knee(p, kd, 'L');
    p[16] = { x: hx, y: t < relT ? 250 + (relT - t) * 500 : 250 + (t - relT) * 800, v: 1 };
    p[15] = { x: hx, y: 500, v: 1 };
    frames.push({ t: t * 1000, px: p });
  }
  const r = analyseBowling(frames);
  check('bowling: finds contact and release', r.ok, r.issues?.join(' '));
  check('bowling: knee at contact ≈ 160°', r.ok && near(r.kneeAtContact, 160, 4), `${r.kneeAtContact}°`);
  check('bowling: extending front knee → extender', r.pattern === 'extender', `${r.pattern} (${r.change}°)`);
}

// ---------------- helpers
check('Sayers peak power: 45 cm, 80 kg ≈ 4302 W', peakPowerSayers(45, 80) === Math.round(60.7 * 45 + 45.3 * 80 - 2055));
check('asymmetry: 30 vs 24 cm = 20%', asymmetryPct(30, 24) === 20);

// ---------------- scoring
check('score: CMJ 42 cm male = 75 (strong band edge)', scoreTest('cmj', 42, 'm') === 75);
check('score: 5-0-5 lower is better (2.40 s male = 75)', scoreTest('s505', 2.4, 'm') === 75);
check('score: 5-0-5 slower than band scores under 25', scoreTest('s505', 3.0, 'm') < 25);
check('score: elite or better caps at 100', scoreTest('fly10', 36, 'm') === 100);
check('score: female bands used for female athletes', scoreTest('cmj', 32, 'f') === 75 && scoreTest('cmj', 32, 'm') < 50);
check('score: bowling pattern scored, extender not ranked above brace', scoreTest('bowlKnee', 'flexor') < scoreTest('bowlKnee', 'brace') && scoreTest('bowlKnee', 'extender') === scoreTest('bowlKnee', 'brace'));
check('band names', bandName(95) === 'Elite' && bandName(10) === 'Priority');

// ---------------- content integrity
const qIds = Object.keys(QUALITIES);
check('every sport test exists', SPORTS.every(s => s.tests.every(t => TESTS[t])));
check('every role weight is a known quality', SPORTS.every(s => s.roles.every(r => Object.keys(r.weights).every(q => qIds.includes(q)))));
check('5 sports: cricket, football, MMA, squash, hockey', ['cricket', 'football', 'mma', 'squash', 'hockey'].every(id => SPORTS.some(s => s.id === id)));
check('football has 7 positions incl. CB, full-back, CDM', ['gk', 'cb', 'fb', 'cdm', 'cm', 'winger', 'st'].every(id => SPORTS.find(s => s.id === 'football').roles.some(r => r.id === id)));
check('cricket separates pace, finger spin and wrist spin', ['pace', 'fingerSpin', 'wristSpin'].every(id => SPORTS.find(s => s.id === 'cricket').roles.some(r => r.id === id)));
check('fast bowlers choose an action type', SPORTS.find(s => s.id === 'cricket').roles.find(r => r.id === 'pace').actions.includes('Mixed'));
check('every role has a sport-specific block', SPORTS.every(s => s.roles.every(r => SPORT_BLOCK_KEYS.includes(`${s.id}:${r.id}`))), SPORTS.flatMap(s => s.roles.map(r => `${s.id}:${r.id}`)).filter(k => !SPORT_BLOCK_KEYS.includes(k)).join(', '));
check('bowling check only for fast bowlers', testsFor('cricket', 'pace').includes('bowlKnee') && !testsFor('cricket', 'topBatter').includes('bowlKnee'));
const missing = ALL_PLAN_EXERCISES().filter(id => !LIB[id]);
check('every plan exercise exists in the library', !missing.length, missing.join(', '));
check('every camera test has steps; every manual test too', Object.values(TESTS).every(t => t.how?.length >= 2));

// ---------------- profile & limiter
{
  const fb = { sport: 'football', role: 'fb', sex: 'm', age: 24, results: { cmj: { value: 44 }, fly10: { value: 26.5 }, s505: { value: 2.35 }, yoyo: { value: 1800 }, nordic: { value: 70 }, slHop: { L: 30, R: 29 } } };
  const p = profile(fb);
  check('full-back with slow top speed → limiter is speed', p.limiter?.quality === 'speed', p.limiter?.quality);
  const cb = profile({ ...fb, role: 'cb', results: { ...fb.results, cmj: { value: 28 }, fly10: { value: 31 } } });
  check('centre-back with a low jump → limiter is power', cb.limiter?.quality === 'power', cb.limiter?.quality);
  const asym = profile({ ...fb, results: { ...fb.results, slHop: { L: 30, R: 23 } } });
  check('leg gap over 15% comes first, whatever else', asym.limiter?.quality === 'symmetry', asym.limiter?.quality);
  const youth = profile({ ...fb, age: 14 });
  check('under-16s are not scored against adult bands, so no limiter', youth.youth && youth.qualities.every(q => q.score == null) && youth.limiter === null);
  check('profile counts tests done', p.done === 6 && p.total === testsFor('football', 'fb').length);
  check('no results → no limiter', profile({ sport: 'squash', role: 'player', sex: 'f', results: {} }).limiter === null);
}

// ---------------- plans for every sport × role × phase × days
{
  let bad = [];
  for (const s of SPORTS) for (const r of s.roles) for (const phase of ['off', 'pre', 'in']) for (const days of [2, 3, 4, 5]) {
    const plan = buildPlan({ sport: s.id, role: r.id, limiter: 'agility', next: ['aerobic'], phase, days });
    if (!plan || !plan.sessions.length) { bad.push(`${s.id}:${r.id}:${phase}:${days} empty`); continue; }
    if (plan.sessions.some(x => x.blocks.some(b => !b || !b.items?.length))) bad.push(`${s.id}:${r.id}:${phase}:${days} empty block`);
    const work = plan.sessions.filter(x => !['Recovery', 'Primer'].includes(x.name));
    if (!work.every(x => x.blocks.some(b => b.focus))) bad.push(`${s.id}:${r.id}:${phase}:${days} limiter missing`);
    const sb = plan.sessions.flatMap(x => x.blocks).filter(b => !b.focus && !['Warm-up', 'Main strength', 'Recovery', 'Short and sharp'].includes(b.name) && !Object.values(QUALITIES).some(q => q.name === b.name));
    if (!sb.length) bad.push(`${s.id}:${r.id}:${phase}:${days} no sport block`);
  }
  check('every sport × position × phase × 2–5 days builds a complete plan', !bad.length, bad.slice(0, 5).join('; '));
  const inS = buildPlan({ sport: 'football', role: 'fb', limiter: 'speed', phase: 'in', days: 4 });
  check('in season uses match-day labels', inS.sessions.map(x => x.label).join(',') === 'MD+1,MD-4,MD-3,MD-1');
  const doses = inS.sessions.flatMap(x => x.blocks).filter(b => b.focus).map(b => b.items.find(([id]) => id === 'accelSprint')?.[1]);
  check('in-season volume drops once, not once per session', doses.every(d => d === '3×15 m'), doses.join(' | '));
  const mixed = buildPlan({ sport: 'cricket', role: 'pace', limiter: 'trunk', phase: 'pre', days: 3, action: 'Mixed' });
  check('mixed bowling action → coach-review note', mixed.notes.some(n => /Mixed/.test(n) && /coach/.test(n)));
  check('youth plan has no heavy strength doses', buildPlan({ sport: 'hockey', role: 'mid', phase: 'off', days: 3, youth: true }).sessions.flatMap(x => x.blocks).find(b => b.name === 'Main strength').items.every(([, d]) => /light/.test(d)));
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
