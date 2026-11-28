// Biomechanics lab tests: each screen run on synthetic athletes with a known fault (and without it).
// Run: node tests/lab.test.mjs
import { FAULTS, SCREENS, ANALYSE, screensFor, topFixes } from '../js/athlete/lab.js';
import { buildPlan } from '../js/athlete/plan.js';
import { LIB } from '../js/library.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const ids = r => (r.faults || []).map(f => f.id);
const P = (x, y) => ({ x, y, v: 1 });

// Side-on stick figure. Legs given as hip/knee/ankle points per side; px per metre ≈ 200.
function figure({ hip = [400, 400], kneeL, ankleL, kneeR, ankleR, sh = null, wristUp = null }) {
  const px = Array.from({ length: 33 }, () => P(hip[0], hip[1] - 100));
  const [hx, hy] = hip;
  px[23] = P(hx - 1, hy); px[24] = P(hx + 1, hy);
  const s = sh || [hx, hy - 110];
  px[11] = P(s[0] - 1, s[1]); px[12] = P(s[0] + 1, s[1]); px[0] = P(s[0], s[1] - 40);
  px[25] = P(...kneeL); px[27] = P(...ankleL); px[26] = P(...kneeR); px[28] = P(...ankleR);
  px[29] = P(ankleL[0] - 6, ankleL[1] + 6); px[31] = P(ankleL[0] + 14, ankleL[1] + 6);
  px[30] = P(ankleR[0] - 6, ankleR[1] + 6); px[32] = P(ankleR[0] + 14, ankleR[1] + 6);
  px[15] = P(s[0] - 20, s[1] + 90); px[16] = wristUp ? P(...wristUp) : P(s[0] + 20, s[1] + 90);
  return px;
}
// Knee position for a leg hip→ankle with interior knee angle deg, knee bent forward (+x).
function kneeFor(h, a, deg, fwd = 1) {
  const dx = a[0] - h[0], dy = a[1] - h[1], L = Math.hypot(dx, dy) / 2;
  const seg = Math.max(L, L / Math.sin(deg * Math.PI / 360)); // thigh = shank = seg
  const off = Math.sqrt(Math.max(0, seg * seg - L * L));
  const mx = (h[0] + a[0]) / 2, my = (h[1] + a[1]) / 2, nx = -dy / (2 * L), ny = dx / (2 * L);
  return [mx + fwd * Math.abs(nx) * off * Math.sign(nx || 1), my + ny * off * (fwd * Math.sign(nx || 1))];
}

// ---------------- fast bowling side-on: flexor (collapse) vs brace
function bowler(kneeProfile) {
  const fps = 240, frames = []; let hx = 100;
  const bfcT = 0.3, ffcT = 0.5, relT = 0.62;
  for (let t = 0; t < 0.8; t += 1 / fps) {
    if (t < ffcT) hx += 6; else if (t < relT) hx += 1.5;
    const hip = [hx, 400];
    const frontA = t < ffcT ? [hx + 120, 590] : [100 + ffcT * fps * 6 + 120, 590];
    const backA = t < bfcT ? [hx + 40, 590] : [100 + bfcT * fps * 6 - 20, 590];
    const kd = t < ffcT ? 170 : kneeProfile((t - ffcT) / (relT - ffcT));
    const kneeL = kneeFor(hip, frontA, kd), kneeR = kneeFor(hip, backA, 160);
    frames.push({ t: t * 1000, px: figure({ hip, ankleL: frontA, kneeL, ankleR: backA, kneeR, wristUp: [hx, t < relT ? 200 + (relT - t) * 400 : 200 + (t - relT) * 900] }) });
  }
  return frames;
}
{
  const collapse = ANALYSE.bowlSide(bowler(u => 170 - 35 * Math.min(1, u)));
  check('bowling: analyses a delivery', collapse.ok, collapse.issues?.join(' '));
  check('bowling: a 35° collapse is the flexor pattern', collapse.metrics.find(m => m.label === 'Front-knee pattern')?.value === 'flexor', collapse.metrics.map(m => `${m.label}=${m.value}`).join(', '));
  check('bowling: collapse is flagged with its fix', ids(collapse).includes('frontKneeCollapse'));
  const brace = ANALYSE.bowlSide(bowler(() => 170));
  check('bowling: a braced knee is not flagged', !ids(brace).includes('frontKneeCollapse'), brace.metrics.find(m => m.label === 'Front-knee pattern')?.value);
  const fe = ANALYSE.bowlSide(bowler(u => u < 0.5 ? 170 - 30 * u * 2 : 140 + 35 * (u - 0.5) * 2));
  check('bowling: bend then straighten = flexor-extender (Portus category)', fe.metrics.find(m => m.label === 'Front-knee pattern')?.value === 'flexor-extender', fe.metrics.find(m => m.label === 'Front-knee pattern')?.value);
  check('bowling: says what one phone can\'t measure', collapse.notes.some(n => /counter-rotation/.test(n) && /ICC/.test(n)));
  check('bowling: stride as % of height is measured', collapse.metrics.some(m => m.label === 'Delivery stride' && Number.isFinite(m.value)));
}

// ---------------- sprint: overstriding vs landing under the hips
function sprinter(tdAhead, swingKnee = 40) {
  const fps = 240, frames = [], v = 1800, step = 0.25; // px/s, s per step
  for (let t = 0; t < 1.6; t += 1 / fps) {
    const hx = 100 + v * t, ph = (t % step) / step, side = Math.floor(t / step) % 2;
    // Stance phase first 40% of each step: stance foot on the floor, moving back relative to the hip.
    const stanceX = hx + tdAhead - ph * 120, swingX = hx - 60 + ph * 160;
    const stanceY = ph < 0.4 ? 590 : 590 - Math.sin((ph - 0.4) / 0.6 * Math.PI) * 120;
    const hip = [hx, 400];
    const stanceK = [(hx + stanceX) / 2 + 10, 495], swingK = [hx + swingKnee, 480];
    const L = side ? { a: [stanceX, stanceY], k: stanceK } : { a: [swingX, 520], k: swingK }, R = side ? { a: [swingX, 520], k: swingK } : { a: [stanceX, stanceY], k: stanceK };
    frames.push({ t: t * 1000, px: figure({ hip, ankleL: L.a, kneeL: L.k, ankleR: R.a, kneeR: R.k }) });
  }
  return frames;
}
{
  const over = ANALYSE.sprint(sprinter(110)), under = ANALYSE.sprint(sprinter(20));
  check('sprint: finds touch-downs', over.ok && over.steps >= 2, over.issues?.join(' ') || `${over.steps}`);
  check('sprint: foot far ahead → overstride flagged', ids(over).includes('overstride'), over.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
  check('sprint: foot under hips → no overstride', under.ok && !ids(under).includes('overstride'), under.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
  const trail = ANALYSE.sprint(sprinter(20, -60));
  check('sprint: free knee trailing behind → front-side fault', ids(trail).includes('poorFrontSide'), trail.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
  check('sprint: free knee in front → no front-side fault', !ids(under).includes('poorFrontSide'), under.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
  check('sprint: says automatic S-MAS is not validated', over.notes.some(n => /not yet validated/.test(n)));
}

// ---------------- drop landing, side-on: stiff vs soft
function lander(icFlex, peakFlex) {
  const fps = 120, frames = [];
  for (let t = 0; t < 1.6; t += 1 / fps) {
    let hipY, flex;
    if (t < 0.4) { hipY = 300; flex = 5; } // on the box, feet at 490
    else if (t < 0.6) { hipY = 300 + (t - 0.4) / 0.2 * 100; flex = icFlex * (t - 0.4) / 0.2; }
    else { const u = Math.min(1, (t - 0.6) / 0.25); flex = t < 0.85 ? icFlex + (peakFlex - icFlex) * Math.sin(u * Math.PI / 2) : peakFlex * Math.max(0, 1 - (t - 0.85) / 0.4); hipY = 590 - 190 * Math.cos(flex * Math.PI / 360); }
    const footY = t < 0.4 ? 490 : t < 0.6 ? 490 + (t - 0.4) / 0.2 * 100 : 590;
    const hip = [400, hipY], ank = [400, footY], knee = kneeFor(hip, ank, 180 - flex);
    frames.push({ t: t * 1000, px: figure({ hip, ankleL: ank, kneeL: knee, ankleR: [402, footY], kneeR: [knee[0] + 2, knee[1]] }) });
  }
  return frames;
}
{
  const stiff = ANALYSE.landSide(lander(10, 35)), soft = ANALYSE.landSide(lander(35, 95));
  check('landing side: stiff landing flagged', stiff.ok && ids(stiff).includes('stiffLanding'), stiff.issues?.join(' ') || stiff.metrics.map(m => `${m.label}=${m.value}`).join(', '));
  check('landing side: soft landing passes', soft.ok && !ids(soft).includes('stiffLanding'), soft.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
}

// ---------------- drop landing, front-on: knees cave in vs stay over the toes
function frontLander(cave) {
  const fps = 120, frames = [];
  for (let t = 0; t < 1.6; t += 1 / fps) {
    const footY = t < 0.4 ? 490 : t < 0.6 ? 490 + (t - 0.4) / 0.2 * 100 : 590, landed = t >= 0.6;
    const hipY = footY - 190, kc = landed ? cave * Math.min(1, (t - 0.6) / 0.15) : 0;
    const px = figure({ hip: [400, hipY], ankleL: [360, footY - 8], kneeL: [360 + kc, footY - 98], ankleR: [440, footY - 8], kneeR: [440 - kc, footY - 98] });
    px[23] = P(370, hipY); px[24] = P(430, hipY); px[11] = P(365, hipY - 110); px[12] = P(435, hipY - 110);
    frames.push({ t: t * 1000, px });
  }
  return frames;
}
{
  const cave = ANALYSE.landFront(frontLander(28)), good = ANALYSE.landFront(frontLander(0));
  check('landing front: knees caving in flagged', cave.ok && ids(cave).includes('kneeValgus'), cave.issues?.join(' ') || cave.metrics.map(m => `${m.label}=${m.value}`).join(', '));
  check('landing front: knees over toes passes', good.ok && !ids(good).includes('kneeValgus'), good.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
}

// ---------------- squash lunge: depth lost with fatigue
function lunger(depths) {
  const fps = 60, frames = []; let t = 0;
  for (const d of depths) for (let u = 0; u < 1; u += 1 / (fps * 1.2), t += 1 / fps) {
    const flex = 10 + (d - 10) * Math.sin(u * Math.PI), hip = [400, 400 + flex * 1.2], ank = [520, 590];
    frames.push({ t: t * 1000, px: figure({ hip, ankleL: ank, kneeL: kneeFor(hip, ank, 180 - flex, -1), ankleR: [300, 590], kneeR: [350, 500] }) });
  }
  return frames;
}
{
  const tired = ANALYSE.lunge(lunger([110, 110, 108, 106, 100, 96, 94, 92, 90])), steady = ANALYSE.lunge(lunger([105, 106, 105, 104, 106, 105, 105, 104, 105]));
  check('lunge: counts lunges', tired.ok && tired.reps >= 8, tired.issues?.join(' ') || `${tired.reps}`);
  check('lunge: depth lost with fatigue flagged', ids(tired).includes('lungeFatigue'), tired.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
  check('lunge: steady depth not flagged', steady.ok && !ids(steady).includes('lungeFatigue'), steady.metrics?.map(m => `${m.label}=${m.value}`).join(', '));
}

// ---------------- content integrity
const exMissing = Object.entries(FAULTS).flatMap(([id, f]) => f.ex.filter(([x]) => !LIB[x]).map(([x]) => `${id}:${x}`));
check('every fault fix exercise exists in the library', !exMissing.length, exMissing.join(', '));
check('every fault has why, muscles, cue and a basis', Object.values(FAULTS).every(f => f.why && f.muscles.length && f.cue && ['study', 'coaching'].includes(f.basis)));
check('no fault claims to diagnose, treat or prevent', !Object.values(FAULTS).some(f => /\b(diagnos|treat|cure|prevent)/i.test(f.why + f.title)));
check('every screen has an analyser and steps', Object.keys(SCREENS).every(id => ANALYSE[id] && SCREENS[id].how.length >= 2));
check('fast bowlers get both bowling screens', ['bowlSide', 'bowlBehind'].every(id => screensFor('cricket', 'pace').includes(id)));
check('spinners don\'t get the fast-bowling screens', !screensFor('cricket', 'wristSpin').includes('bowlSide'));
check('squash gets the lunge; strikers get the punch', screensFor('squash', 'player').includes('lunge') && screensFor('mma', 'striker').includes('punch'));

// ---------------- plan integration
{
  const lab = { bowlSide: { faults: [{ ...FAULTS.shortPlant, id: 'shortPlant' }, { ...FAULTS.frontKneeCollapse, id: 'frontKneeCollapse' }] }, landFront: { faults: [{ ...FAULTS.kneeValgus, id: 'kneeValgus' }] } };
  const fixes = topFixes(lab);
  check('top fixes: "fix" faults come before "watch"', fixes[0].id === 'kneeValgus', fixes.map(f => f.id).join(','));
  const plan = buildPlan({ sport: 'cricket', role: 'pace', limiter: 'trunk', phase: 'pre', days: 3, fixes });
  const work = plan.sessions.filter(s => !['Recovery', 'Primer'].includes(s.name));
  check('female bowlers get the male-data caveat', ANALYSE.bowlSide(bowler(() => 170), { sex: 'f' }).notes.some(n => /male bowlers/.test(n)));
  check('plan: every working session has the movement-fix block', work.every(s => s.blocks.some(b => b.fix)));
  check('plan: fix block lists at most 4 exercises, no duplicates', work.every(s => { const b = s.blocks.find(x => x.fix); const i = b.items.map(([x]) => x); return i.length <= 4 && new Set(i).size === i.length; }));
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
