// Gait analysis from a phone video (walking or running).
//
// Method (see SCIENCE.md §5):
//  - Gait events from landmark coordinates (Zeni et al. 2008): heel strike = the foot's
//    most-forward point relative to the pelvis, toe-off = its most-backward point.
//  - Side view (sagittal): cadence, stance %, step length, knee flexion at contact and in swing,
//    hip extension in late stance, trunk lean, left/right symmetry (Robinson et al. 1987).
//  - Front view (frontal): pelvic drop (Trendelenburg sign), knee alignment, step width.
//  - Norms: walking (Perry & Burnfield, Gait Analysis), running (Heiderscheit 2011 on cadence
//    and overstriding). This is a movement screen, not a clinical gait lab.
import { angle, dist, mid, viewOf, fromVertical } from './angles.js';

const SIDE = {
  L: { hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 },
  R: { hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 },
};

const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const smooth = (a, k = 2) => a.map((_, i) => { let s = 0, n = 0; for (let j = i - k; j <= i + k; j++) if (a[j] != null && !Number.isNaN(a[j])) { s += a[j]; n++; } return n ? s / n : NaN; });
// Robinson symmetry index: 0 = perfect symmetry. >10% is usually considered clinically notable.
export const symmetry = (l, r) => (Number.isFinite(l) && Number.isFinite(r) && (l + r)) ? Math.abs(l - r) / (0.5 * Math.abs(l + r)) * 100 : NaN;

function peaks(sig, minGap, wantMax = true) {
  const out = [];
  for (let i = 1; i < sig.length - 1; i++) {
    const v = sig[i]; if (!Number.isFinite(v)) continue;
    let ok = true;
    for (let j = Math.max(0, i - minGap); j <= Math.min(sig.length - 1, i + minGap); j++) {
      if (j !== i && Number.isFinite(sig[j]) && (wantMax ? sig[j] > v : sig[j] < v)) { ok = false; break; }
    }
    if (ok && (!out.length || i - out[out.length - 1] >= minGap)) out.push(i);
  }
  return out;
}

const NORMS = {
  walk: { cadence: [100, 125], stance: [57, 65], swingKnee: [55, 72], hipExt: [8, 25], trunk: [-5, 8] },
  run: { cadence: [160, 190], stance: [25, 45], swingKnee: [80, 130], hipExt: [5, 30], trunk: [2, 15], contactKnee: [12, 30] },
};

/**
 * frames: [{ t: ms, px: 33 landmarks in pixels {x,y,v} }]
 * returns { ok, reason?, view, mode, metrics:[...], findings:[...], curves:{L,R} }
 */
export function analyseGait(frames, { mode = 'walk' } = {}) {
  frames = frames.filter(f => f.px && [23, 24, 25, 26, 27, 28].every(i => f.px[i].v > 0.3));
  if (frames.length < 30) return { ok: false, reason: 'I need about 6 seconds of walking with your whole body in view. Try again a little further from the camera.' };
  const fps = (frames.length - 1) / ((frames[frames.length - 1].t - frames[0].t) / 1000);
  const views = frames.map(f => viewOf(f.px));
  const view = views.filter(v => v === 'side').length >= views.length / 2 ? 'side' : 'front';
  return view === 'side' ? sideView(frames, fps, mode) : frontView(frames, fps, mode);
}

function sideView(frames, fps, mode) {
  const N = NORMS[mode];
  // Walking direction from the feet (toe ahead of heel) — works on a treadmill and overground.
  const dir = Math.sign(mean(frames.map(f => (f.px[31].x - f.px[29].x) + (f.px[32].x - f.px[30].x)))) || 1;
  const legLen = median(frames.map(f => (dist(f.px[23], f.px[27]) + dist(f.px[24], f.px[28])) / 2));
  const T = frames.map(f => f.t / 1000);
  const minGap = Math.max(3, Math.round(fps * (mode === 'run' ? 0.22 : 0.35)));

  const per = {};
  for (const [k, s] of Object.entries(SIDE)) {
    const fwd = smooth(frames.map(f => dir * (f.px[s.ankle].x - mid(f.px[23], f.px[24]).x) / legLen));
    const knee = smooth(frames.map(f => 180 - angle(f.px[s.hip], f.px[s.knee], f.px[s.ankle])));
    // Thigh angle from vertical, + = in front of the body (hip flexion), − = behind (hip extension).
    const thigh = smooth(frames.map(f => Math.atan2(dir * (f.px[s.knee].x - f.px[s.hip].x), f.px[s.knee].y - f.px[s.hip].y) * 180 / Math.PI));
    const hs = peaks(fwd, minGap, true).filter(i => fwd[i] > 0.05);
    const to = peaks(fwd, minGap, false).filter(i => fwd[i] < 0);
    per[k] = { fwd, knee, thigh, hs, to };
  }

  const allHS = [...per.L.hs.map(i => ({ i, s: 'L' })), ...per.R.hs.map(i => ({ i, s: 'R' }))].sort((a, b) => a.i - b.i);
  if (allHS.length < 4) return { ok: false, reason: 'I couldn\'t pick out enough steps. Walk side-on to the camera for at least 6 seconds, or use a treadmill.' };

  const stepTimes = []; for (let j = 1; j < allHS.length; j++) stepTimes.push(T[allHS[j].i] - T[allHS[j - 1].i]);
  const cadence = 60 / median(stepTimes.filter(x => x > 0.15 && x < 1.5));

  const stats = {};
  const curves = {};
  for (const k of ['L', 'R']) {
    const o = k === 'L' ? 'R' : 'L', p = per[k], q = per[o];
    const stance = [], swingKnee = [], contactKnee = [], hipExt = [], stepLen = [], strike = [], cycles = [];
    for (let j = 0; j < p.hs.length - 1; j++) {
      const a = p.hs[j], b = p.hs[j + 1], dur = T[b] - T[a];
      if (dur < 0.3 || dur > 2.5) continue;
      const toe = p.to.find(i => i > a && i < b);
      if (toe != null) {
        stance.push((T[toe] - T[a]) / dur * 100);
        swingKnee.push(Math.max(...p.knee.slice(toe, b + 1)));
        hipExt.push(-Math.min(...p.thigh.slice(a, toe + 1)));
      }
      contactKnee.push(p.knee[a]);
      stepLen.push(p.fwd[a] - q.fwd[a]);
      strike.push(p.fwd[a]);
      // Knee curve over one gait cycle, resampled to 0–100 %.
      cycles.push(Array.from({ length: 51 }, (_, n) => { const x = a + (b - a) * n / 50, lo = Math.floor(x), hi = Math.min(b, lo + 1); return p.knee[lo] + (p.knee[hi] - p.knee[lo]) * (x - lo); }));
    }
    stats[k] = { stance: median(stance), swingKnee: median(swingKnee), contactKnee: median(contactKnee), hipExt: median(hipExt), stepLen: median(stepLen), strike: median(strike), n: cycles.length };
    curves[k] = cycles.length ? cycles[0].map((_, n) => mean(cycles.map(c => c[n]))) : [];
  }
  const trunk = median(frames.map(f => {
    const h = mid(f.px[23], f.px[24]), s = mid(f.px[11], f.px[12]);
    return Math.sign(dir * (s.x - h.x)) * fromVertical(h, s);
  }));

  const metrics = [], findings = [];
  const inRange = (v, [lo, hi]) => v >= lo && v <= hi;
  const fmt = (v, d = 0) => Number.isFinite(v) ? v.toFixed(d) : '–';
  const avg = key => mean([stats.L[key], stats.R[key]].filter(Number.isFinite));
  const m = (label, value, unit, norm, ok, si) => metrics.push({ label, value, unit, norm, ok, si });

  m('Cadence', fmt(cadence), 'steps/min', `${N.cadence[0]}–${N.cadence[1]}`, inRange(cadence, N.cadence));
  const stSI = symmetry(stats.L.stance, stats.R.stance);
  m('Stance time', `${fmt(stats.L.stance)} / ${fmt(stats.R.stance)}`, '% L / R', `${N.stance[0]}–${N.stance[1]}%`, inRange(avg('stance'), N.stance) && !(stSI > 10), stSI);
  const slSI = symmetry(stats.L.stepLen, stats.R.stepLen);
  m('Step length', `${fmt(stats.L.stepLen * 100)} / ${fmt(stats.R.stepLen * 100)}`, '% leg L / R', 'symmetry < 10%', !(slSI > 10), slSI);
  const skSI = symmetry(stats.L.swingKnee, stats.R.swingKnee);
  m('Knee bend in swing', `${fmt(stats.L.swingKnee)}° / ${fmt(stats.R.swingKnee)}°`, 'L / R', `${N.swingKnee[0]}–${N.swingKnee[1]}°`, inRange(avg('swingKnee'), N.swingKnee) && !(skSI > 10), skSI);
  const heSI = symmetry(stats.L.hipExt, stats.R.hipExt);
  m('Hip extension', `${fmt(stats.L.hipExt)}° / ${fmt(stats.R.hipExt)}°`, 'L / R', `${N.hipExt[0]}°+`, Math.min(stats.L.hipExt, stats.R.hipExt) >= N.hipExt[0], heSI);
  m('Trunk lean', fmt(trunk), '° forward', `${N.trunk[0]}–${N.trunk[1]}°`, inRange(trunk, N.trunk));
  if (mode === 'run') m('Knee bend at landing', `${fmt(stats.L.contactKnee)}° / ${fmt(stats.R.contactKnee)}°`, 'L / R', `${N.contactKnee[0]}°+`, avg('contactKnee') >= N.contactKnee[0]);

  const weaker = (a, b) => (stats.L[a] < stats.R[a] ? 'left' : 'right');
  if (cadence < N.cadence[0]) findings.push(mode === 'run'
    ? { title: 'Low running cadence', why: 'Fewer, longer steps raise braking and impact loads at the knee and hip. A 5–10% cadence increase lowers them (Heiderscheit 2011).', fix: [`Run to a ${Math.round(cadence * 1.07)} bpm metronome`, 'Shorter, quicker steps', 'Land with the foot under the hip'] }
    : { title: 'Slow cadence', why: 'Slower stepping is linked to lower walking confidence and leg power.', fix: ['Brisk walking intervals', 'Calf raises 3×15', 'Step-ups'] });
  if (mode === 'run' && (stats.L.strike > 0.32 || stats.R.strike > 0.32 || avg('contactKnee') < N.contactKnee[0])) findings.push({ title: 'Overstriding', why: 'The foot lands well ahead of the hips with a near-straight knee, which acts like a brake on every step.', fix: ['Raise cadence 5–10%', 'Think "land under you"', 'A-skips and quick-feet drills'] });
  if (Math.min(stats.L.hipExt, stats.R.hipExt) < N.hipExt[0]) findings.push({ title: `Limited hip extension (${weaker('hipExt')} side)`, why: 'The thigh doesn\'t travel far enough behind the body at push-off. Common with tight hip flexors from sitting and under-active glutes; it shortens the stride.', fix: ['Half-kneeling hip-flexor stretch 2×45 s', 'Glute bridges and hip thrusts', 'Split squats'] });
  if (avg('swingKnee') < N.swingKnee[0]) findings.push({ title: 'Stiff-knee swing', why: 'The knee doesn\'t bend enough while the leg swings through, which reduces toe clearance and can mean tight quads or weak hip flexors.', fix: ['Quad stretch', 'High-knee marching', 'Hamstring curls'] });
  if (slSI > 10 || stSI > 10) findings.push({ title: `Uneven steps (${slSI > 10 ? 'step length' : 'stance time'} differs ${fmt(Math.max(slSI || 0, stSI || 0))}%)`, why: 'One leg is doing more work, or one side is being protected. Asymmetry over 10% is worth addressing, and over 15% after an injury suggests incomplete rehab.', fix: ['Single-leg work, weaker side first', 'Single-leg balance 3×30 s', 'See a physio if there was an injury'] });
  if (trunk > N.trunk[1]) findings.push({ title: 'Leaning forward', why: 'Extra forward trunk lean often compensates for weak glutes or limited hip extension.', fix: ['Tall posture cue: "head to the ceiling"', 'Glute and back-extensor strength'] });
  if (!findings.length) findings.push({ ok: true, title: 'Balanced, efficient gait', why: 'All measures are inside typical ranges and your left and right sides are well matched.', fix: [] });

  return { ok: true, view: 'side', mode, metrics, findings, curves, cadence, steps: allHS.length, cycles: stats.L.n + stats.R.n };
}

function frontView(frames, fps, mode) {
  // Pelvic tilt per frame, + = right hip lower. The drop on each side happens while standing on the opposite leg.
  const tiltSig = smooth(frames.map(f => {
    const a = f.px[23], b = f.px[24];
    let d = Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * 180 / Math.PI; return d;
  }));
  const base = median(tiltSig);
  const dev = tiltSig.map(v => v - base);
  const dropR = Math.max(...dev.filter(Number.isFinite)), dropL = -Math.min(...dev.filter(Number.isFinite));
  const hipW = median(frames.map(f => dist(f.px[23], f.px[24])));
  const valgus = k => median(frames.map(f => {
    const s = SIDE[k], hip = f.px[s.hip], kn = f.px[s.knee], an = f.px[s.ankle];
    const t = (kn.y - hip.y) / ((an.y - hip.y) || 1), lineX = hip.x + t * (an.x - hip.x);
    const midX = (f.px[23].x + f.px[24].x) / 2;
    return Math.sign(midX - lineX) * (kn.x - lineX) / (dist(hip, an) || 1) * 100;
  }));
  const vL = valgus('L'), vR = valgus('R');
  const width = median(frames.map(f => Math.abs(f.px[27].x - f.px[28].x) / hipW));
  // Steps from the alternating vertical position of the ankles.
  const minGap = Math.max(3, Math.round(fps * (mode === 'run' ? 0.22 : 0.35)));
  const diff = smooth(frames.map(f => f.px[27].y - f.px[28].y));
  const steps = peaks(diff, minGap, true).length + peaks(diff, minGap, false).length;
  const dur = (frames[frames.length - 1].t - frames[0].t) / 1000;
  const cadence = steps / dur * 60;

  const fmt = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '–';
  const metrics = [
    { label: 'Pelvic drop', value: `${fmt(dropL)}° / ${fmt(dropR)}°`, unit: 'L / R hip', norm: 'under 5°', ok: Math.max(dropL, dropR) < 5, si: symmetry(dropL, dropR) },
    { label: 'Knee alignment', value: `${fmt(vL)}% / ${fmt(vR)}%`, unit: 'in(+) L / R', norm: 'under 5%', ok: Math.max(vL, vR) < 5 },
    { label: 'Step width', value: fmt(width * 100, 0), unit: '% hip width', norm: '40–110%', ok: width > 0.4 && width < 1.1 },
    { label: 'Cadence (estimate)', value: fmt(cadence, 0), unit: 'steps/min', norm: mode === 'run' ? '160–190' : '100–125', ok: true },
  ];
  const findings = [];
  if (Math.max(dropL, dropR) >= 5) findings.push({ title: `Hip drop on the ${dropR > dropL ? 'right' : 'left'} (Trendelenburg sign)`, why: `When you stand on your ${dropR > dropL ? 'left' : 'right'} leg the opposite hip sinks, which points to a weak glute medius on the standing side. Linked to knee and lower-back pain.`, fix: [`Side-lying abduction, ${dropR > dropL ? 'left' : 'right'} side first`, 'Single-leg stance with level hips', 'Lateral band walks'] });
  if (Math.max(vL, vR) >= 5) findings.push({ title: `Knee drifts inward (${vL > vR ? 'left' : 'right'})`, why: 'Dynamic knee valgus loads the inside of the knee and is linked to patellofemoral pain.', fix: ['Clamshells', 'Banded squats, knees out', 'Short-foot drill'] });
  if (width < 0.4) findings.push({ title: 'Narrow, crossover steps', why: 'Feet landing close to or across the midline increase hip and IT-band load.', fix: ['Run or walk along a line, feet either side', 'Hip abductor strength'] });
  if (!findings.length) findings.push({ ok: true, title: 'Hips and knees stay well aligned', why: 'No pelvic drop or knee collapse beyond normal ranges.', fix: [] });
  return { ok: true, view: 'front', mode, metrics, findings, curves: null, cadence, steps };
}

// ---------- Simulated walker (demo mode + tests) ----------
// Sagittal-plane forward kinematics with textbook joint-angle patterns. The right leg is given
// reduced hip extension so the demo has something real to find.
export function simulateWalker(t, { cycle = 1.1, w = 720, h = 600, asym = true } = {}) {
  const g = (p, c, s) => { let d = Math.abs(p - c); d = Math.min(d, 1 - d); return Math.exp(-(d * d) / (2 * s * s)); };
  const T = 125, S = 120, Lt = 150;
  const H = { x: w * 0.45, y: h * 0.42 + 4 * Math.cos(4 * Math.PI * t / cycle) };
  const leg = (p, right) => {
    const flex = (right && asym ? 15 : 20) * Math.cos(2 * Math.PI * p) + (right && asym ? 13 : 8);
    const knee = 5 + 12 * g(p, 0.12, 0.05) + 60 * g(p, 0.72, 0.09);
    const r = flex * Math.PI / 180, sh = (flex - knee) * Math.PI / 180;
    const K = { x: H.x + T * Math.sin(r), y: H.y + T * Math.cos(r) };
    const A = { x: K.x + S * Math.sin(sh), y: K.y + S * Math.cos(sh) };
    return { K, A, heel: { x: A.x - 12, y: A.y + 10 }, toe: { x: A.x + 30, y: A.y + 12 } };
  };
  const p = (t / cycle) % 1, L = leg(p, false), R = leg((p + 0.5) % 1, true);
  const lean = 4 * Math.PI / 180;
  const Sh = { x: H.x + Lt * Math.sin(lean), y: H.y - Lt * Math.cos(lean) };
  const pt = (o, v = 1) => ({ x: o.x, y: o.y, v });
  const px = Array.from({ length: 33 }, () => pt(H, 0.2));
  px[0] = pt({ x: Sh.x + 14, y: Sh.y - 46 }); px[7] = pt({ x: Sh.x + 4, y: Sh.y - 44 }); px[8] = pt({ x: Sh.x + 4, y: Sh.y - 44 }, .5);
  px[11] = pt(Sh); px[12] = pt({ x: Sh.x + 3, y: Sh.y });
  const arm = (ph, i) => { const a = 18 * Math.cos(2 * Math.PI * ph) * Math.PI / 180; const E = { x: Sh.x - 75 * Math.sin(a), y: Sh.y + 75 * Math.cos(a) }; px[i] = pt(E); px[i + 2] = pt({ x: E.x - 60 * Math.sin(a - .3), y: E.y + 60 * Math.cos(a - .3) }); };
  arm((p + 0.5) % 1, 13); arm(p, 14);
  px[23] = pt(H); px[24] = pt({ x: H.x + 3, y: H.y });
  px[25] = pt(L.K); px[27] = pt(L.A); px[29] = pt(L.heel); px[31] = pt(L.toe);
  px[26] = pt(R.K); px[28] = pt(R.A); px[30] = pt(R.heel); px[32] = pt(R.toe);
  return px;
}
