// Body Scan: posture + joint-alignment analysis from a standing photo or short video,
// plus body-fat estimation from tape measurements (US Navy method).
//
// What a camera CAN measure reliably: joint angles, left/right asymmetry, posture alignment.
// What it CANNOT measure from video: body water, muscle density, bone mass. Those need
// bioimpedance (smart scale / InBody) or DEXA — the app lets clients log those readings instead.
import { getImageLandmarker, drawPose } from './pose.js';
import { toPx, tilt, angle, dist, mid, viewOf, bestSide, fromVertical } from './angles.js';

const median = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// Run pose on a photo, or on ~12 frames of a video and take the median pose (removes sway / jitter).
export async function landmarksFrom(file) {
  const lm = await getImageLandmarker();
  if (file.type.startsWith('image/')) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const r = lm.detect(img);
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, lms: r.landmarks[0] };
  }
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.src = URL.createObjectURL(file);
  await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = rej; });
  const frames = [], N = 12, dur = video.duration || 1;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  let snapshot = null;
  for (let i = 0; i < N; i++) {
    video.currentTime = dur * (0.1 + 0.8 * i / (N - 1));
    await new Promise(res => { video.onseeked = res; });
    ctx.drawImage(video, 0, 0);
    const r = lm.detect(canvas);
    if (r.landmarks[0]) {
      frames.push(r.landmarks[0]);
      if (i === Math.floor(N / 2) || !snapshot) { snapshot = document.createElement('canvas'); snapshot.width = canvas.width; snapshot.height = canvas.height; snapshot.getContext('2d').drawImage(canvas, 0, 0); }
    }
  }
  if (!frames.length) return { lms: null };
  const lms = frames[0].map((_, j) => ({
    x: median(frames.map(f => f[j].x)), y: median(frames.map(f => f[j].y)),
    z: median(frames.map(f => f[j].z)), visibility: median(frames.map(f => f[j].visibility)),
  }));
  return { source: snapshot, w: canvas.width, h: canvas.height, lms };
}

// Signed knee deviation in the frontal plane. Positive = knee drifts toward the midline (valgus).
function kneeDeviation(hip, knee, ankle, midX) {
  const t = (knee.y - hip.y) / ((ankle.y - hip.y) || 1);
  const lineX = hip.x + t * (ankle.x - hip.x);
  const legLen = dist(hip, ankle) || 1;
  const towardMid = Math.sign(midX - lineX);
  return towardMid * (knee.x - lineX) / legLen * 100; // % of leg length
}

// Posture can only be judged in a relaxed, neutral stance. Anything else (lunging, arms up,
// mid-rep) produces "asymmetries" that are just the pose, so we refuse rather than mislead.
export function stanceProblem(px, view) {
  const k = Math.min(angle(px[23], px[25], px[27]), angle(px[24], px[26], px[28]));
  if (k < 155) return 'Stand up straight with your knees relaxed, not bent.';
  if (px[15].y < px[11].y || px[16].y < px[12].y) return 'Let your arms hang by your sides.';
  if (view === 'front' && dist(px[27], px[28]) > dist(px[23], px[24]) * 1.8) return 'Stand with your feet about hip-width apart.';
  const vis = [11, 12, 23, 24, 25, 26, 27, 28].filter(i => px[i].v < 0.5);
  if (vis.length > 2) return 'I can\'t see your whole body. Step back so head to feet are in frame.';
  return null;
}

export function analyse(px) {
  const view = viewOf(px);
  const findings = [], metrics = [], labels = [];
  const add = (f) => findings.push(f);

  if (view === 'front') {
    const sh = tilt(px[12], px[11]), hp = tilt(px[24], px[23]);
    const shTilt = Math.abs(sh) > 90 ? 180 - Math.abs(sh) : Math.abs(sh);
    const hpTilt = Math.abs(hp) > 90 ? 180 - Math.abs(hp) : Math.abs(hp);
    // In image space the subject's left shoulder is on the viewer's right.
    const lowShoulder = px[11].y > px[12].y ? 'left' : 'right';
    const lowHip = px[23].y > px[24].y ? 'left' : 'right';
    const midX = (px[23].x + px[24].x) / 2;
    const lKnee = kneeDeviation(px[23], px[25], px[27], midX);
    const rKnee = kneeDeviation(px[24], px[26], px[28], midX);
    const hipW = dist(px[23], px[24]) || 1;
    const shift = (mid(px[23], px[24]).x - mid(px[27], px[28]).x) / hipW * 100;

    metrics.push(['Shoulder tilt', `${shTilt.toFixed(1)}°`, shTilt > 3]);
    metrics.push(['Hip tilt', `${hpTilt.toFixed(1)}°`, hpTilt > 3]);
    metrics.push(['Left knee alignment', `${lKnee > 0 ? 'in' : 'out'} ${Math.abs(lKnee).toFixed(1)}%`, Math.abs(lKnee) > 4]);
    metrics.push(['Right knee alignment', `${rKnee > 0 ? 'in' : 'out'} ${Math.abs(rKnee).toFixed(1)}%`, Math.abs(rKnee) > 4]);
    metrics.push(['Weight shift', `${Math.abs(shift).toFixed(0)}% of hip width`, Math.abs(shift) > 12]);

    labels.push({ at: px[11], value: shTilt, bad: shTilt > 3 }, { at: px[23], value: hpTilt, bad: hpTilt > 3 });
    labels.push({ at: px[25], value: angle(px[23], px[25], px[27]), bad: Math.abs(lKnee) > 4 });
    labels.push({ at: px[26], value: angle(px[24], px[26], px[28]), bad: Math.abs(rKnee) > 4 });

    if (shTilt > 3) add({ title: `Uneven shoulders (${lowShoulder} side lower)`,
      why: 'Often linked to a tighter lat or weaker upper back on one side, or carrying bags on one shoulder.',
      fix: ['Single-arm dumbbell rows (start with the weaker side)', 'Suitcase carries', 'Side planks'] });
    if (hpTilt > 3) add({ title: `Hip tilt (${lowHip} hip lower)`,
      why: 'A lateral pelvic tilt usually points to glute medius weakness on one side.',
      fix: ['Side-lying hip abduction', 'Single-leg Romanian deadlift', 'Copenhagen plank'] });
    if (lKnee > 4 || rKnee > 4) add({ title: `Knees drifting inward (${[lKnee > 4 && 'left', rKnee > 4 && 'right'].filter(Boolean).join(' & ')})`,
      why: 'Knee valgus while standing suggests weak hip abductors/external rotators or flat feet.',
      fix: ['Banded lateral walks', 'Clamshells', 'Short-foot drill for arch strength'] });
    if (Math.abs(shift) > 12) add({ title: `Weight shifted to the ${shift > 0 ? 'left' : 'right'}`,
      why: 'Standing with weight favouring one leg can hide a strength imbalance.',
      fix: ['Bulgarian split squats, weaker leg first', 'Single-leg balance holds'] });
  } else {
    const s = bestSide(px);
    const headFwd = (s.ear.x - s.sh.x) * Math.sign(s.ft.x - s.an.x); // ear ahead of shoulder (direction the feet point)
    const torso = dist(s.sh, s.hip) || 1;
    const headPct = headFwd / torso * 100;
    const neckAngle = fromVertical(s.sh, s.ear);
    const shFwd = (s.sh.x - s.hip.x) * Math.sign(s.ft.x - s.an.x) / torso * 100;
    const knee = angle(s.hip, s.kn, s.an);

    metrics.push(['Head position', `${headPct > 0 ? 'forward' : 'back'} ${Math.abs(headPct).toFixed(0)}% of torso`, headPct > 12]);
    metrics.push(['Neck angle from vertical', `${neckAngle.toFixed(0)}°`, neckAngle > 20]);
    metrics.push(['Shoulders vs hips', `${shFwd > 0 ? 'forward' : 'back'} ${Math.abs(shFwd).toFixed(0)}%`, shFwd > 10]);
    metrics.push(['Knee angle', `${knee.toFixed(0)}°`, knee < 170]);
    labels.push({ at: s.ear, value: neckAngle, bad: neckAngle > 20 }, { at: s.kn, value: knee, bad: knee < 170 }, { at: s.hip, value: angle(s.sh, s.hip, s.kn), bad: false });

    if (headPct > 12 || neckAngle > 20) add({ title: 'Forward head posture',
      why: 'Head sits ahead of the shoulders — common with desk and phone time. Loads the neck and upper traps.',
      fix: ['Chin tucks, 3×10 daily', 'Deep neck flexor holds', 'Thoracic extensions over a foam roller'] });
    if (shFwd > 10) add({ title: 'Rounded shoulders / upper-back lean',
      why: 'Shoulders sit forward of the hips — often tight chest and weak mid-back.',
      fix: ['Face pulls', 'Band pull-aparts', 'Doorway pec stretch'] });
    if (knee < 170) add({ title: 'Soft knees when standing',
      why: 'Standing with bent knees can mean tight hip flexors or hamstrings.',
      fix: ['Half-kneeling hip-flexor stretch', 'Hamstring floss / stretch'] });
  }
  if (!findings.length) add({ title: 'No major alignment issues detected', why: 'Nice — keep it that way with balanced training.', fix: [], good: true });
  return { view, findings, metrics, labels };
}

export function render(canvas, source, w, h, px, labels, view) {
  const maxW = 900, scale = Math.min(1, maxW / w);
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sp = px.map(p => ({ ...p, x: p.x * scale, y: p.y * scale }));
  // Plumb line: through ankle midpoint (front) or ankle (side).
  const base = view === 'front' ? mid(sp[27], sp[28]) : bestSide(sp).an;
  ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(base.x, 0); ctx.lineTo(base.x, canvas.height); ctx.stroke(); ctx.setLineDash([]);
  if (view === 'front') {
    ctx.strokeStyle = 'rgba(255,200,0,.9)';
    for (const [a, b] of [[11, 12], [23, 24]]) { ctx.beginPath(); ctx.moveTo(sp[a].x, sp[a].y); ctx.lineTo(sp[b].x, sp[b].y); ctx.stroke(); }
  }
  drawPose(ctx, sp, { labels: labels.map(l => ({ ...l, at: { x: l.at.x * scale, y: l.at.y * scale } })) });
}

// US Navy circumference method. Inputs in cm. Typical error vs DEXA: ±3–4 % body fat.
export function navyBodyFat({ sex, heightCm, neckCm, waistCm, hipCm }) {
  const inch = v => v / 2.54;
  const H = inch(heightCm), N = inch(neckCm), W = inch(waistCm), Hp = inch(hipCm || 0);
  let bf;
  if (sex === 'male') {
    if (W - N <= 0) return NaN;
    bf = 86.010 * Math.log10(W - N) - 70.041 * Math.log10(H) + 36.76;
  } else {
    if (W + Hp - N <= 0) return NaN;
    bf = 163.205 * Math.log10(W + Hp - N) - 97.684 * Math.log10(H) - 78.387;
  }
  return Math.max(2, Math.min(60, bf));
}

export function bfCategory(bf, sex) {
  const t = sex === 'male' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  return bf < t[0] ? 'Essential / stage-lean' : bf < t[1] ? 'Athletic' : bf < t[2] ? 'Fit' : bf < t[3] ? 'Average' : 'Above healthy range';
}
