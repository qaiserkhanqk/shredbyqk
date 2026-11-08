// Tests for bar speed (VBT), jump height, single-leg squat knee angle (FPPA), scale and quality checks.
// Every test uses synthetic data with a KNOWN true answer, so the error can be measured exactly.
// Run: node tests/measurement.test.mjs
import { BarTracker, estimate1RM, velocityZone } from '../js/vbt.js';
import { analyseJumps, jumpReadiness } from '../js/jump.js';
import { analyseSingleLegSquat, fppa } from '../js/kneetest.js';
import { scaleFromPlate, scaleFromHeight, assessQuality, measuredFps, linearFit, G } from '../js/measure.js';
import { viewOf } from '../js/angles.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const blank = (v = 0.95) => Array.from({ length: 33 }, () => ({ x: 360, y: 300, v }));

// ---------------- scale + fps + fit
check('plate scale: 225 px across a 45 cm plate = 2 mm/px', Math.abs(scaleFromPlate({ x: 0, y: 0 }, { x: 0, y: 225 }) - 0.002) < 1e-9);
check('measured fps ignores one dropped frame', Math.round(measuredFps([0, 33.3, 66.7, 100, 166.7, 200, 233.3])) === 30);
const fit = linearFit([40, 60, 80, 100], [1.0, 0.8, 0.6, 0.4]);
check('linear fit exact line', Math.abs(fit.b + 0.01) < 1e-9 && Math.abs(fit.a - 1.4) < 1e-9 && fit.r2 > 0.999);
{
  const H = 1.80, pxPerM = 400, frames = Array.from({ length: 20 }, () => { const px = blank(); px[11].y = px[12].y = 100; px[27].y = px[28].y = 100 + 0.779 * H * pxPerM; return { px }; });
  check('height scale: shoulder–ankle 0.779·H', Math.abs(scaleFromHeight(frames, H) - 1 / pxPerM) < 1e-9);
}

// ---------------- bar speed (VBT)
function barSet({ reps = 5, romM = 0.5, conS = [0.8], eccS = 1.2, fps = 30, mPerPx = 0.002, noisePx = 0 }) {
  const bar = new BarTracker(); const out = []; let t = 0, y0 = 200;
  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
  for (let r = 0; r < reps; r++) {
    const con = conS[Math.min(r, conS.length - 1)];
    for (let i = 0; i < Math.round(0.4 * fps); i++, t += 1000 / fps) bar.push(t, y0 + noisePx * gauss(), mPerPx);
    for (let i = 1; i <= Math.round(eccS * fps); i++, t += 1000 / fps) bar.push(t, y0 + ease(i / (eccS * fps)) * romM / mPerPx + noisePx * gauss(), mPerPx);
    for (let i = 1; i <= Math.round(con * fps); i++, t += 1000 / fps) bar.push(t, y0 + (1 - ease(i / (con * fps))) * romM / mPerPx + noisePx * gauss(), mPerPx);
    for (let i = 0; i < Math.round(0.3 * fps); i++, t += 1000 / fps) bar.push(t, y0 + noisePx * gauss(), mPerPx);
    out.push(bar.closeRep());
  }
  return { bar, out };
}
{
  const { out } = barSet({});
  const err = Math.max(...out.map(r => Math.abs(r.mcv - 0.5 / 0.8)));
  check('bar speed: MCV within 0.03 m/s of truth (0.625)', err < 0.03, out.map(r => r.mcv.toFixed(3)).join(' '));
  check('bar speed: range of motion = 0.50 m', out.every(r => Math.abs(r.romM - 0.5) < 0.01));
  const noisy = barSet({ noisePx: 2 });
  check('bar speed with 2 px jitter: MCV within 0.05 m/s', noisy.out.every(r => Math.abs(r.mcv - 0.625) < 0.05), noisy.out.map(r => r.mcv.toFixed(3)).join(' '));
  const fat = barSet({ conS: [0.7, 0.7, 0.8, 1.0, 1.4] });
  check('velocity loss detected as reps slow (~50%)', Math.abs(fat.bar.velocityLoss() - 0.5) < 0.06, (fat.bar.velocityLoss() * 100).toFixed(0) + '%');
  check('tiny movement is not a rep', barSet({ romM: 0.05 }).out.every(r => r === null));
}
{
  // True profile: v = 1.30 − 0.0075·load ⇒ load at 0.30 m/s (squat MVT) = 133.3 kg.
  const sets = [60, 80, 100, 120].map(l => ({ loadKg: l, mcv: 1.30 - 0.0075 * l }));
  const e = estimate1RM(sets, 'squat');
  check('1RM estimate from load–velocity line = 133 kg', Math.abs(e.e1rm - 133.33) < 0.5 && e.reliable, e.e1rm.toFixed(1));
  check('1RM refused with one load only', estimate1RM([{ loadKg: 100, mcv: 0.5 }], 'squat') === null);
  check('velocity zones', velocityZone(0.4) === 'Absolute strength' && velocityZone(0.9) === 'Strength-speed' && velocityZone(1.4) === 'Starting strength');
}

// ---------------- jump height
function jumpFrames({ heightM = 0.40, fps = 120, mPerPx = 0.002, noisePx = 0, jumps = 1 }) {
  const frames = []; let t = 0; const v0 = Math.sqrt(2 * G * heightM), T = 2 * v0 / G;
  const ground = 560, push = (dyM, crouchM = 0) => {
    const px = blank(); const lift = dyM / mPerPx, c = crouchM / mPerPx;
    px[23].y = px[24].y = 300 + c - lift; px[25].y = px[26].y = 430 - lift; px[27].y = px[28].y = ground - 20 - lift;
    for (const i of [29, 30, 31, 32]) px[i].y = ground - lift;
    for (const i of [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) px[i].y += noisePx * gauss();
    frames.push({ t, px }); t += 1000 / fps;
  };
  for (let i = 0; i < fps * 0.6; i++) push(0);
  for (let k = 0; k < jumps; k++) {
    for (let i = 0; i < fps * 0.5; i++) push(0, 0.25 * Math.sin(Math.PI * i / (fps * 0.5))); // countermovement dip
    for (let i = 0; i * (1000 / fps) < T * 1000; i++) { const s = i / fps; push(v0 * s - 0.5 * G * s * s); }
    for (let i = 0; i < fps * 0.8; i++) push(0);
  }
  return frames;
}
for (const [fps, tol] of [[240, 1.0], [120, 1.5], [60, 2.5], [30, 5]]) {
  const r = analyseJumps(jumpFrames({ fps }), { mPerPx: 0.002 });
  check(`jump 40 cm at ${fps} fps: within ±${tol} cm`, r.ok && Math.abs(r.best.heightCm - 40) <= tol, `${r.best?.heightCm} cm, precision ±${r.precisionCm}`);
}
{
  const r = analyseJumps(jumpFrames({ fps: 120, noisePx: 1.5, jumps: 3 }), { mPerPx: 0.002 });
  check('3 noisy jumps at 120 fps: all found, each within ±2 cm', r.jumps.length === 3 && r.jumps.every(j => Math.abs(j.heightCm - 40) <= 2), r.jumps.map(j => j.heightCm).join(', '));
  check('30 fps warns to use slow-motion', analyseJumps(jumpFrames({ fps: 30 })).issues.some(s => /slow-motion/.test(s)));
  check('no jump → clear message', !analyseJumps(jumpFrames({ fps: 60, jumps: 0 })).ok);
  const rd = jumpReadiness(34, [40, 41, 39, 40, 42, 40]);
  check('readiness: 15% below baseline = fatigued', rd.status === 'fatigued', JSON.stringify(rd));
}

// ---------------- single-leg squat FPPA
function slsFrames({ leftMax = 15, rightMax = 4, reps = 4, fps = 60, noisePx = 0 }) {
  const frames = []; let t = 0; const T = 170, S = 160, W = 720;
  const legPose = (px, side, depth, fppaDeg) => {
    const hipIdx = side === 'L' ? 23 : 24, kn = side === 'L' ? 25 : 26, an = side === 'L' ? 27 : 28;
    const hip = { x: side === 'L' ? W * 0.56 : W * 0.44, y: 260 + 80 * depth };
    const toMid = side === 'L' ? -1 : 1; // subject's left appears on the image's right; midline is toward the centre
    const half = (fppaDeg / 2) * Math.PI / 180, bend = 0.9 * depth;
    const thighV = T * Math.cos(bend), shinV = S * Math.cos(bend * 0.6);
    const knee = { x: hip.x + toMid * thighV * Math.tan(half), y: hip.y + thighV };
    const ankle = { x: knee.x - toMid * shinV * Math.tan(half), y: knee.y + shinV };
    px[hipIdx] = { ...hip, v: 0.95 }; px[kn] = { ...knee, v: 0.95 }; px[an] = { ...ankle, v: 0.95 };
  };
  for (const side of ['L', 'R']) {
    const max = side === 'L' ? leftMax : rightMax;
    for (let r = 0; r < reps; r++) for (let i = 0; i < fps * 2; i++, t += 1000 / fps) {
      const depth = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fps * 2));
      const px = blank(); px[11] = { x: W * 0.6, y: 120, v: 0.95 }; px[12] = { x: W * 0.4, y: 120, v: 0.95 };
      legPose(px, side, depth, max * depth);
      const free = side === 'L' ? 'R' : 'L'; legPose(px, free, 0, 0);
      const fi = free === 'L' ? [23, 25, 27] : [24, 26, 28];
      px[fi[0]].y = px[side === 'L' ? 23 : 24].y; // level pelvis
      px[fi[1]].y = px[fi[0]].y + 120; px[fi[2]].y = px[fi[1]].y + 60; // free foot lifted
      for (const i of [23, 24, 25, 26, 27, 28]) { px[i].x += noisePx * gauss(); px[i].y += noisePx * gauss(); }
      frames.push({ t, px });
    }
  }
  return frames;
}
{
  const px = blank(); px[23] = { x: 400, y: 200, v: 1 }; px[24] = { x: 300, y: 200, v: 1 };
  px[25] = { x: 400, y: 400, v: 1 }; px[27] = { x: 400, y: 600, v: 1 };
  check('FPPA straight leg = 0°', Math.abs(fppa(px, 'L')) < 1e-9);
  const kx = 400 - 200 * Math.tan(10 * Math.PI / 180);
  px[25] = { x: kx, y: 400, v: 1 }; px[27] = { x: kx, y: 600, v: 1 }; // thigh 10° toward midline, shin vertical
  check('FPPA knee toward midline = +10°', Math.abs(fppa(px, 'L') - 10) < 0.01, fppa(px, 'L').toFixed(2));
  px[25] = { x: 400 + 200 * Math.tan(10 * Math.PI / 180), y: 400, v: 1 }; px[27] = { x: px[25].x, y: 600, v: 1 };
  check('FPPA knee away from midline = −10° (varus)', Math.abs(fppa(px, 'L') + 10) < 0.01, fppa(px, 'L').toFixed(2));
  const r = analyseSingleLegSquat(slsFrames({}));
  check('SLS: both legs, 4 reps each', r.legs.L?.reps === 4 && r.legs.R?.reps === 4, JSON.stringify(r.legs));
  check('SLS: left FPPA ≈ 15° (±1.5)', Math.abs(r.legs.L.meanFppa - 15) <= 1.5, r.legs.L.meanFppa);
  check('SLS: right FPPA ≈ 4° (±1.5)', Math.abs(r.legs.R.meanFppa - 4) <= 1.5, r.legs.R.meanFppa);
  check('SLS: flags left valgus + asymmetry, not right', r.findings.some(f => /Left knee collapses/.test(f.title)) && !r.findings.some(f => /Right knee/.test(f.title)) && r.findings.some(f => /differ/.test(f.title)));
  const n = analyseSingleLegSquat(slsFrames({ noisePx: 2 }));
  check('SLS with 2 px jitter: within ±2.5°', Math.abs(n.legs.L.meanFppa - 15) <= 2.5 && Math.abs(n.legs.R.meanFppa - 4) <= 2.5, `${n.legs.L.meanFppa} / ${n.legs.R.meanFppa}`);
  const good = analyseSingleLegSquat(slsFrames({ leftMax: 3, rightMax: 4 }));
  check('SLS: good control → no warnings', good.findings.length === 1 && good.findings[0].ok);
}

// ---------------- quality gate
{
  const ok = Array.from({ length: 60 }, (_, i) => ({ t: i * 33.3, px: blank() }));
  check('quality: clean recording passes', assessQuality(ok, { w: 720, h: 600 }).ok);
  const dark = ok.map(f => ({ t: f.t, px: blank(0.3) }));
  check('quality: poorly visible joints flagged', assessQuality(dark, { w: 720, h: 600 }).issues.some(s => /hard to see/.test(s)));
  const cut = ok.map(f => { const px = blank(); px[27] = { x: 360, y: 700, v: 0.9 }; return { t: f.t, px }; });
  check('quality: body out of frame flagged', assessQuality(cut, { w: 720, h: 600 }).issues.some(s => /left the frame/.test(s)));
  const slow = ok.map((f, i) => ({ t: i * 100, px: f.px }));
  check('quality: low fps flagged', assessQuality(slow, { w: 720, h: 600, minFps: 50 }).issues.some(s => /fps/.test(s)));
  const sideOnly = ok.map(f => { const px = blank(); px[11] = { x: 360, y: 100, v: .9 }; px[12] = { x: 362, y: 100, v: .9 }; px[23] = { x: 360, y: 300, v: .9 }; px[24] = { x: 362, y: 300, v: .9 }; return { t: f.t, px }; });
  check('quality: wrong camera view flagged', assessQuality(sideOnly, { w: 720, h: 600, view: 'front', viewOf }).issues.some(s => /Face the camera/.test(s)));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
