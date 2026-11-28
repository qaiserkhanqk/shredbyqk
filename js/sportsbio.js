// Sports biomechanics screens from a phone camera (2D kinematics). Pure functions, unit tested.
//
// 1. Bowling action (cricket). Side-on clip: finds front-foot contact (FFC) and ball release, measures
//    the front-knee angle at both and classifies the front leg (braced / straightening / collapsing /
//    flex-then-extend). Clip from behind or in front: trunk side-bend at release. In injured adolescent
//    fast bowlers, thorax lateral flexion at release averaged ~50° vs ~40° in uninjured bowlers
//    (Bayne et al. 2016, doi:10.1016/j.jsams.2015.02.011), so above ~45° is flagged for trunk work and a
//    coach review. Fast movements need slow-motion video (120–240 fps) for accurate events.
// 2. Landing test. Front-on drop landing: peak frontal-plane knee angle (knee caving in) in the first
//    ~0.3 s after landing on each leg, and the left–right difference. The same 2D measure as the
//    single-leg squat test (kneetest.js); a movement screen, not an injury prediction or a diagnosis.
// Limits: 2D only, so angles are accurate in the plane the camera faces; no forces.
import { angle } from './angles.js';
import { fppa } from './kneetest.js';

const vis = (p, ...i) => i.every(k => p[k] && p[k].v >= 0.5);
const deg = r => r * 180 / Math.PI;

/**
 * @param frames [{ t (ms), px }] @param o { arm: 'R'|'L' } bowling arm
 * @returns { ok, view, ffc?, release?, kneeFfc?, kneeRelease?, kneeChange?, frontLeg?, sideBend?, findings, issues }
 */
export function analyseBowling(frames, { arm = 'R', view = 'side' } = {}) {
  const W = arm === 'R' ? 16 : 15, SH = arm === 'R' ? 12 : 11;
  const F = arm === 'R' ? { hip: 23, knee: 25, ankle: 27 } : { hip: 24, knee: 26, ankle: 28 }; // front leg is opposite the bowling arm
  const fr = frames.filter(f => vis(f.px, W, SH, 23, 24));
  if (fr.length < 10) return { ok: false, issues: ['Couldn\'t see the bowling arm and hips clearly. Film the whole body, side-on, in good light.'], findings: [] };
  // Release: the highest point of the bowling hand above its shoulder.
  let rel = 0; fr.forEach((f, i) => { if (f.px[W].y - f.px[SH].y < fr[rel].px[W].y - fr[rel].px[SH].y) rel = i; });
  const fps = (fr.length - 1) / ((fr[fr.length - 1].t - fr[0].t) / 1000 || 1);
  const out = { ok: true, view, release: fr[rel].t, fps: Math.round(fps), findings: [], issues: [] };
  if (fps < 100) out.issues.push(`Recorded at about ${Math.round(fps)} frames a second. For a bowling action, film in slow motion (120–240 fps) so QK catches front-foot contact and release exactly.`);

  if (view === 'side') {
    // Front-foot contact: within 0.35 s before release, the first frame where the front ankle reaches the ground (its lowest point).
    const win = fr.filter((f, i) => i <= rel && fr[rel].t - f.t <= 350 && vis(f.px, F.hip, F.knee, F.ankle));
    if (win.length < 3) return { ...out, ok: false, issues: [...out.issues, 'Couldn\'t see the front leg through the delivery stride.'] };
    const ground = Math.max(...win.map(f => f.px[F.ankle].y)), tol = Math.max(2, (ground - Math.min(...win.map(f => f.px[F.ankle].y))) * 0.08);
    const ffc = win.find(f => f.px[F.ankle].y >= ground - tol);
    const k = f => angle(f.px[F.hip], f.px[F.knee], f.px[F.ankle]);
    const kF = k(ffc), relF = vis(fr[rel].px, F.hip, F.knee, F.ankle) ? fr[rel] : win[win.length - 1], kR = k(relF);
    // Lowest knee angle between FFC and release (how far it collapses on the way).
    const between = win.filter(f => f.t >= ffc.t && f.t <= relF.t), kMin = Math.min(...between.map(k));
    Object.assign(out, { ffc: ffc.t, kneeFfc: Math.round(kF), kneeRelease: Math.round(kR), kneeMin: Math.round(kMin), kneeChange: Math.round(kR - kF) });
    const change = kR - kF, dip = kF - kMin;
    out.frontLeg = change >= 10 ? 'straightening' : change <= -10 ? 'collapsing' : dip >= 10 ? 'flex-then-extend' : 'braced';
    const text = {
      straightening: ['Front leg straightens into release', 'Good: the front knee gets straighter from landing to release, so the leg acts as a firm lever.', true],
      braced: ['Front leg stays braced', 'Good: the front knee holds its angle from landing to release.', true],
      'flex-then-extend': ['Front knee bends, then straightens', `The knee gives about ${Math.round(dip)}° after landing before straightening. Work on a firmer front-leg block: single-leg drop-and-stick and split squats.`, false],
      collapsing: ['Front knee collapses', `The front knee bends about ${Math.round(-change)}° from landing to release, which leaks energy and loads the knee. Train the front-leg block (drop-and-stick, Bulgarian split squats) and work on it with your coach.`, false],
    }[out.frontLeg];
    out.findings.push({ title: text[0], detail: text[1], ok: text[2] });
  } else {
    // From behind / in front: trunk side-bend at release = shoulder-midpoint vs hip-midpoint line from vertical.
    const p = fr[rel].px, sh = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 }, hp = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
    const bend = Math.abs(deg(Math.atan2(sh.x - hp.x, hp.y - sh.y)));
    out.sideBend = Math.round(bend);
    out.findings.push(bend > 45
      ? { title: `High trunk side-bend at release (${Math.round(bend)}°)`, detail: 'Side-bend helps pace; large amounts are something bowling coaches watch closely in young fast bowlers (Bayne 2016). Add the trunk work in your programme (Pallof press, suitcase carries, back-extension holds) and have a coach look at the action.', ok: false }
      : { title: `Trunk side-bend at release ${Math.round(bend)}°`, detail: 'Within the range seen in uninjured bowlers. Keep the trunk work in your programme.', ok: true });
  }
  return out;
}

/**
 * Drop landing, front view. Finds each landing (feet back on the ground after being in the air) and the
 * peak knee-caving angle (FPPA) in the next ~0.3 s for each knee.
 * @returns { ok, landings, L, R, asym, findings, issues }
 */
export function analyseLanding(frames, { flagDeg = 10, asymDeg = 5 } = {}) {
  const fr = frames.filter(f => vis(f.px, 23, 24, 25, 26, 27, 28));
  if (fr.length < 10) return { ok: false, issues: ['Couldn\'t see both legs. Face the camera, whole legs in view.'], findings: [] };
  const footY = f => (f.px[27].y + f.px[28].y) / 2;
  const floor = Math.max(...fr.map(footY)), top = Math.min(...fr.map(footY)), range = floor - top;
  if (range < 15) return { ok: false, issues: ['No landing found. Step off a low box (about 30 cm) and land on both feet.'], findings: [] };
  const air = f => footY(f) < floor - range * 0.4, onGround = f => footY(f) >= floor - range * 0.1;
  const landings = [];
  for (let i = 1; i < fr.length; i++) {
    if (onGround(fr[i]) && fr.slice(Math.max(0, i - 8), i).some(air)) {
      if (landings.length && fr[i].t - landings[landings.length - 1] < 600) continue;
      landings.push(fr[i].t);
    }
  }
  if (!landings.length) return { ok: false, issues: ['No landing found. Step off the box and land on both feet, facing the camera.'], findings: [] };
  const peak = side => Math.max(...landings.flatMap(t0 => fr.filter(f => f.t >= t0 && f.t <= t0 + 300).map(f => fppa(f.px, side))));
  const L = Math.round(peak('L')), R = Math.round(peak('R')), asym = Math.abs(L - R);
  const findings = [];
  for (const [side, v] of [['Left', L], ['Right', R]]) findings.push(v > flagDeg
    ? { title: `${side} knee caves in on landing (${v}°)`, detail: 'In lab studies, more knee-inward angle on landing went with higher knee load (Sigward 2015). Phone angles are rough, so compare with your own earlier videos. Practise single-leg drop-and-stick landings: knee over the second toe, hips back, soft and quiet.', ok: false }
    : { title: `${side} knee stays in line (${v}°)`, detail: 'Good landing control.', ok: true });
  if (asym > asymDeg) findings.push({ title: `Left and right differ by ${asym}°`, detail: 'One side controls the landing less well. Add extra single-leg landing work on the weaker side.', ok: false });
  return { ok: true, landings: landings.length, L, R, asym, findings, issues: [] };
}
