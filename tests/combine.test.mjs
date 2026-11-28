// Athlete Combine tests: camera analysis on synthetic athletes with known answers, scoring, the limiter
// for main's sports and positions (athletes.js), and the limiter reaching the athlete programme.
// Run: node tests/combine.test.mjs
import { analyseHops, analyseFlyingSprint, analyseShuttle, analyseNordic, peakPowerSayers, asymmetryPct } from '../js/combine/tests.js';
import { TESTS, QUALITIES, WEIGHTS, LIMITER_WORK, testsFor, scoreTest, profile, bandName, programFocus } from '../js/combine/combine.js';
import { SPORTS, PHASES, buildProgram } from '../js/athletes.js';
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

// ---------------- helpers
check('Sayers peak power: 45 cm, 80 kg ≈ 4302 W', peakPowerSayers(45, 80) === Math.round(60.7 * 45 + 45.3 * 80 - 2055));
check('asymmetry: 30 vs 24 cm = 20%', asymmetryPct(30, 24) === 20);

// ---------------- scoring
check('score: CMJ 42 cm male = 75 (strong band edge)', scoreTest('cmj', 42, 'm') === 75);
check('score: 5-0-5 lower is better (2.40 s male = 75)', scoreTest('s505', 2.4, 'm') === 75);
check('score: 5-0-5 slower than the bands scores under 25', scoreTest('s505', 3.0, 'm') < 25);
check('score: elite or better caps at 100', scoreTest('fly10', 36, 'm') === 100);
check('score: female bands used for female athletes', scoreTest('cmj', 32, 'f') === 75 && scoreTest('cmj', 32, 'm') < 50);
check('band names', bandName(95) === 'Elite' && bandName(10) === 'Priority');

// ---------------- content integrity against main's athlete section
const qIds = Object.keys(QUALITIES);
const roleKeys = SPORTS.flatMap(s => s.roles.map(r => `${s.id}:${r.id}`));
check(`every one of the ${roleKeys.length} positions has combine weights`, roleKeys.every(k => WEIGHTS[k]), roleKeys.filter(k => !WEIGHTS[k]).join(' '));
check('no weights for positions that don\'t exist', Object.keys(WEIGHTS).every(k => roleKeys.includes(k)), Object.keys(WEIGHTS).filter(k => !roleKeys.includes(k)).join(' '));
check('every weight is a known quality', Object.values(WEIGHTS).every(w => Object.keys(w).every(q => qIds.includes(q))));
check('every sport has a combine test list of known tests', SPORTS.every(s => testsFor(s.id).length >= 5 && testsFor(s.id).every(t => TESTS[t])));
check('every quality has limiter work from the library', qIds.every(q => LIMITER_WORK[q]?.ex.every(id => LIB[id])), qIds.flatMap(q => (LIMITER_WORK[q]?.ex || ['?']).filter(id => !LIB[id])).join(' '));
check('every test has steps', Object.values(TESTS).every(t => t.how?.length >= 2));

// ---------------- profile & limiter
{
  const fb = { sport: 'football', role: 'fb', sex: 'm', age: 24, results: { cmj: { value: 44 }, fly10: { value: 26.5 }, s505: { value: 2.35 }, yoyo: { value: 1800 }, nordic: { value: 70 }, slHop: { L: 30, R: 29 } } };
  const p = profile(fb);
  check('full-back with slow top speed → limiter is speed', p.limiter?.quality === 'speed', p.limiter?.quality);
  check('centre-back with a low jump → limiter is power', profile({ ...fb, role: 'cb', results: { ...fb.results, cmj: { value: 28 }, fly10: { value: 31 } } }).limiter?.quality === 'power');
  check('leg gap over 15% comes first', profile({ ...fb, results: { ...fb.results, slHop: { L: 30, R: 23 } } }).limiter?.quality === 'symmetry');
  const youth = profile({ ...fb, age: 14 });
  check('under-16s are not scored against adult bands, so no limiter', youth.youth && youth.qualities.every(q => q.score == null) && youth.limiter === null);
  check('no results → no limiter', profile({ sport: 'squash', role: 'retrieve', sex: 'f', results: {} }).limiter === null);
  check('boxing power puncher with low push-ups → upper body', profile({ sport: 'boxing', role: 'power', sex: 'm', age: 25, results: { cmj: { value: 45 }, pushups: { value: 12 }, hops: { value: 2.2 } } }).limiter?.quality === 'upper');
}

// ---------------- the limiter reaches the programme
{
  const focus = programFocus({ sport: 'football', role: 'fb', sex: 'm', age: 24, results: { fly10: { value: 26 } } }, [{ title: 'Foot lands well ahead of your hips', ex: [['nordic', '3×5'], ['yFastSkipping', '3×20 m']] }]);
  check('focus: limiter and fixes', focus.limiter?.name === 'Top speed' && focus.fixes.length === 1);
  const bad = [];
  for (const s of SPORTS) for (const r of s.roles) for (const ph of PHASES) {
    const f = programFocus({ sport: s.id, role: r.id, sex: 'm', age: 25, results: { cmj: { value: 25 } } }, [{ title: 'Stiff landing', ex: [['yFrontBoxJump', '3×4'], ['gobletSquat', '3×8']] }]);
    const p = buildProgram(s.id, r.id, ph.id, LIB, f);
    if (!p.plan.every(d => d.items.every(i => LIB[i[0]]) && new Set(d.items.map(i => i[0])).size === d.items.length)) bad.push(`${s.id}/${r.id}/${ph.id} invalid`);
    if (f.limiter && !p.plan.every(d => f.limiter.ex.includes(d.items[0][0]))) bad.push(`${s.id}/${r.id}/${ph.id} limiter not first`);
    if (!/Athlete Combine/.test(p.method)) bad.push(`${s.id}/${r.id}/${ph.id} no note`);
  }
  check('every sport × position × phase: limiter work opens every day, no duplicates, note in the method', !bad.length, bad.slice(0, 4).join('; '));
  check('without a combine, programmes are unchanged', JSON.stringify(buildProgram('cricket', 'spin', 'off', LIB)) === JSON.stringify(buildProgram('cricket', 'spin', 'off', LIB, null)));
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
