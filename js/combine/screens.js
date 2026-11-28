// Athlete Combine movement checks: screens from one phone, faults, and the fix for each.
//
// Evidence: docs/biomech-research/{cricket,football-hockey,mma-squash}.md. Rules followed here:
//  - Only markers one phone measures well: SAGITTAL angles side-on (knee, hip, trunk flexion, leg
//    angles, stride) and a few FRONTAL ones front-on on landings. Nothing rotational (shoulder
//    counter-rotation, hip–shoulder separation, action type, elbow legality): a phone can't, so the
//    lab says so and sends those to a coach or a 3D lab.
//  - Every threshold says where it comes from: basis 'study' (published cut-off or group values) or
//    'coaching' (a coaching rule of thumb, because no validated cut-off exists).
//  - Faults describe movement, never injury or diagnosis. Fixes are training, never treatment.
import { angle } from '../angles.js';
import { fppa } from '../kneetest.js';
import { measuredFps } from '../measure.js';

const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const r0 = v => Math.round(v);
const hipX = px => (px[23].x + px[24].x) / 2, hipY = px => (px[23].y + px[24].y) / 2;
const SIDE = { L: { s: 11, h: 23, k: 25, a: 27, heel: 29, toe: 31 }, R: { s: 12, h: 24, k: 26, a: 28, heel: 30, toe: 32 } };
const kneeA = (px, j) => angle(px[j.h], px[j.k], px[j.a]); // 180 = straight
const fromVert = (top, bot) => Math.atan2(top.x - bot.x, bot.y - top.y) * 180 / Math.PI; // signed, + = top ahead in +x
const legLenPx = (px, j) => Math.hypot(px[j.h].x - px[j.a].x, px[j.h].y - px[j.a].y);

/* ------------------------------------------------------------------ faults → fixes */
// muscles: what to strengthen; ex: [libraryId, dose]; cue: one thing to think about.
export const FAULTS = {
  // Fast bowling (side-on)
  frontKneeCollapse: { title: 'Front knee collapses after landing', basis: 'study', severity: 'watch',
    why: 'Your front knee bends a lot between front-foot landing and release (a "flexor" pattern). Bowlers whose front knee stays firm or straightens bowl faster in studies (Portus 2004; Worthington 2013). Some knee bend is fine: a fully locked knee has its own trade-offs (Crewe 2013), so this is about not collapsing, not locking.',
    muscles: ['Quads (eccentric, braking)', 'Glutes', 'Calves'], ex: [['stepDown', '3×8 front leg, 3 s down'], ['bulgarian', '3×6 heavy, front leg'], ['dropStick', '5 bowling-stride stops']],
    cue: 'Land on a firm front leg and "post" over it.' },
  shortPlant: { title: 'Front foot lands close under your body', basis: 'coaching', severity: 'watch',
    why: 'Your front leg is fairly upright when it lands. A bigger plant angle (front foot further ahead) went with more braking, and more braking went with faster balls (Worthington 2013). A small plant with a flat-foot landing went with higher, faster-rising landing forces.',
    muscles: ['Quads and glutes (braking)', 'Hip flexors (reach)'], ex: [['lunge', '3×8 long stride'], ['dropStick', '4 stride-and-stick'], ['bulgarian', '3×8']],
    cue: 'Reach the front foot out and land heel-first on a long, firm leg.' },
  longStride: { title: 'Delivery stride is very long', basis: 'study', severity: 'watch',
    why: 'Your stride is over about 85% of your height. Above that, one study found no extra pace and worse accuracy (Spratford 2016). Target 75–85%.',
    muscles: ['Hip and trunk control'], ex: [['lunge', '3×8 controlled'], ['sidePlank', '3×30 s each']], cue: 'A slightly shorter, more balanced last stride.' },
  shortStride: { title: 'Delivery stride is short', basis: 'coaching', severity: 'watch',
    why: 'Your stride is under about 70% of your height, below the 75–85% range coaches aim for (Spratford 2016). A short stride often comes from a slow approach or a weak bound.',
    muscles: ['Hip flexors and glutes (power)'], ex: [['skaterBounds', '3×4'], ['yLateralBound', '3×5 each'], ['yFastSkipping', '3×20 m']], cue: 'Drive the bound forward, not up.' },
  rearLegCollapse: { title: 'Back leg buckles at back-foot landing', basis: 'coaching', severity: 'watch',
    why: 'Your back knee bends a lot as the back foot lands. In one study of fast bowlers, a higher, harder bound went with a more bent back leg at back-foot landing (Bull et al. 2026). Not a pass/fail line: a pattern to clean up.',
    muscles: ['Quads and glutes (single-leg landing)'], ex: [['yLateralBound', '3×5 stick each'], ['stepDown', '3×8 each'], ['yFrontBoxJump', '3×3 soft landing']], cue: 'A low, quick bound; land the back foot under your hips.' },
  sideBend: { title: 'Big trunk side-bend at release', basis: 'coaching', severity: 'watch',
    why: 'Your trunk bends sideways a lot at release (filmed from behind). Side-bend at release helps pace. Large amounts are something bowling coaches watch closely in young fast bowlers (Bayne et al. 2016). The aim is control, not removing it.',
    muscles: ['Obliques and trunk (both sides)', 'Hips'], ex: [['sidePlank', '3×40 s each'], ['pallof', '3×10 each'], ['mbShotPut', '3×5 each, controlled']], cue: 'Stay taller through release; let the hips turn rather than the spine bend.' },
  // Sprint, max velocity (side-on). S-MAS-style items, scored automatically: a screen, not the validated eye score.
  overstride: { title: 'Foot lands well ahead of your hips', basis: 'coaching', severity: 'fix',
    why: 'At touch-down your foot is far in front of your body. In acceleration studies, a foot landing closer under the body went with a more horizontal push (King 2023). "Foot ahead of the body at touch-down" is also an item in the Sprint Mechanics Assessment Score (S-MAS), a coach-scored sprint checklist (Bramah 2026).',
    muscles: ['Hamstrings and glutes (hip extension)', 'Hip flexors'], ex: [['yFastSkipping', '3×20 m'], ['nordic', '3×5'], ['runSprints', '4×20 m, "step down under you"']], cue: 'Step down under your hips, pull the ground back.' },
  poorFrontSide: { title: 'Swing knee is low at touch-down', basis: 'coaching', severity: 'fix',
    why: 'When your foot lands, the other thigh hasn\'t come through in front. Thigh separation at touch-down is one item in the Sprint Mechanics Assessment Score (S-MAS), a coach-scored sprint checklist (Bramah 2026).',
    muscles: ['Hip flexors', 'Hamstrings (fast switching)'], ex: [['yFastSkipping', '3×20 m'], ['pogoJumps', '3×15'], ['runSprints', '3×20 m, "knees up"']], cue: 'Knees up and switch fast: the free knee should be in front when the foot lands.' },
  sprintCollapse: { title: 'Hips drop at mid-stance', basis: 'coaching', severity: 'watch',
    why: 'Your hips sink a lot while the foot is on the ground. "Vertical collapse at mid-stance" is an S-MAS item (Bramah 2026). Coaches often read this as legs that aren\'t stiff enough to bounce.',
    muscles: ['Calves and Achilles (stiffness)', 'Glutes'], ex: [['pogoJumps', '4×15'], ['singleCalf', '3×12 each'], ['yFrontBoxJump', '3×4']], cue: 'Run tall, "hot ground", bounce off it.' },
  sprintLean: { title: 'Trunk leans forward at top speed', basis: 'coaching', severity: 'watch',
    why: 'At top speed your trunk leans forward a lot. Forward lean belongs to the first steps of acceleration; at top speed coaches aim for tall posture so the legs can cycle in front.',
    muscles: ['Trunk', 'Hip flexors'], ex: [['deadBug', '3×8 each'], ['yFastSkipping', '3×20 m tall']], cue: 'Tall and proud at top speed.' },
  // Landing (drop jump)
  kneeValgus: { title: 'Knees cave inward on landing', basis: 'coaching', severity: 'fix',
    why: 'Your knees move inward when you land (front view). In lab studies, more knee-inward angle went with higher knee load (Sigward 2015). These angles are not yet checked against lab equipment, so compare with your own earlier videos filmed the same way.',
    muscles: ['Glute med and hip external rotators', 'Quads'], ex: [['bandedWalk', '3×12 each way'], ['yLateralBound', '3×5 stick'], ['stepDown', '3×8 knee over 2nd toe']], cue: 'Land with knees over your toes, "push the floor apart".' },
  landTrunkLean: { title: 'Trunk tips sideways on landing', basis: 'coaching', severity: 'watch',
    why: 'Your trunk leans to one side as you land. That is one of the Landing Error Scoring System items (Padua 2009).',
    muscles: ['Trunk', 'Hip abductors'], ex: [['sidePlank', '3×30 s each'], ['singleLegBalance', '3×30 s each']], cue: 'Chest over the knees, shoulders level.' },
  stiffLanding: { title: 'Stiff landing', basis: 'coaching', severity: 'fix',
    why: 'Your knees are fairly straight at touch-down (under 30° bend) or bend less than 45° after it. Both are Landing Error Scoring System errors (Padua 2009). Stiff landings go with higher landing forces.',
    muscles: ['Quads (eccentric)', 'Glutes'], ex: [['yFrontBoxJump', '3×4, step down'], ['jumpSquat', '3×5 soft landing'], ['gobletSquat', '3×8, 3 s down']], cue: 'Land quietly, bend knees and hips like a spring.' },
  // Squash / lunge
  shallowLunge: { title: 'Lunge is shallow', basis: 'coaching', severity: 'watch',
    why: 'Your front knee bends less than about 90° at the bottom of the lunge. A deeper, controlled lunge reaches further. Squash data are thin; badminton studies show skilled players land heel-first with lower peak forces (Lam 2018).',
    muscles: ['Quads and glutes', 'Hip mobility'], ex: [['lunge', '3×8 deep'], ['bulgarian', '3×8'], ['lateralLunge', '3×8 each']], cue: 'Sit into the lunge, heel first.' },
  lungeFatigue: { title: 'Lunges get shallower as you tire', basis: 'coaching', severity: 'fix',
    why: 'Your last lunges bend about 10° or more less than your first. Under fatigue, studies found less knee bend and stiffer legs, with higher modelled knee load (Xie 2025; Chen 2026, badminton and recreational athletes).',
    muscles: ['Quad and glute endurance', 'Hip abductors'], ex: [['ghosting', '6 × 40 s'], ['bulgarian', '3×12'], ['wallSit', '3×45 s']], cue: 'Keep the same depth on the last lunge as the first.' },
  lungeTrunk: { title: 'Trunk folds forward in the lunge', basis: 'coaching', severity: 'watch',
    why: 'Your trunk leans far forward (over about 45°) at the bottom of the lunge. Coaches aim for a more upright trunk so you can push back to the T.',
    muscles: ['Glutes and hamstrings', 'Trunk'], ex: [['rdl', '3×8'], ['gobletSquat', '3×8 upright'], ['pallof', '3×10 each']], cue: 'Chest up, push back to the T with the front heel.' },
  // Striking
  leadLegLeak: { title: 'Lead knee gives way in the punch', basis: 'coaching', severity: 'watch',
    why: 'Your lead knee bends further as the punch lands, so force leaks away. In one lab study of the jab, elite boxers produced about 50% more lead-leg force than juniors (Liu 2022). Coaches see a firm lead leg as the sign that force is reaching the punch.',
    muscles: ['Quads and glutes (lead leg)', 'Calves'], ex: [['pogoJumps', '3×20'], ['yLateralBound', '3×5 stick'], ['mbShotPut', '4×5 each']], cue: 'Plant and brace the lead leg as the punch lands.' },
};

/* ------------------------------------------------------------------ screens */
const FAST = ['fastSide', 'fastFront', 'fastMixed', 'allrounder'];
// Front-on landing and bowling side-bend from behind are main's own tests (sportsbio.js, "Test how you move").
export const SCREENS = {
  bowlSide: { name: 'Fast bowling stride · side-on', sports: { cricket: FAST }, view: 'side', minFps: 100,
    how: ['Tripod side-on to the popping crease, 8–10 m away, slow-motion (120–240 fps).', 'Film the last 3 strides to the end of the follow-through, at full pace.', 'Wear fitted clothes so knees and hips are visible.'] },
  sprint: { name: 'Top-speed sprint', sports: { football: '*', hockey: '*', cricket: ['batPower', 'batClassic', ...FAST] }, view: 'side', minFps: 120,
    how: ['Tripod side-on at hip height, about 7 m from the lane, 240 fps slow-motion (this is how S-MAS is filmed).', 'Build up over 30 m and sprint flat out through the frame.', 'Shorts, so the knees are visible.'] },
  landSide: { name: 'Drop-jump landing · side', sports: { football: '*', hockey: '*', squash: '*', padel: '*', tennis: '*', mma: '*', boxing: '*', cricket: [...FAST, 'keeper'] }, view: 'side', minFps: 60,
    how: ['Box about 30 cm high. Phone side-on at hip height, 3 m away.', 'Step off, land on both feet and jump straight up as high as you can.', 'Do 3. Shorts, so the knees are visible.'] },
  lunge: { name: 'Court lunge', sports: { squash: '*', padel: '*', tennis: '*' }, view: 'side', minFps: 60,
    how: ['Phone side-on, 3–4 m away, at hip height.', 'Lunge to a front corner and push back, 10 times, at match pace.', 'The lunge leg nearest the camera.'] },
  punch: { name: 'Straight punch · lead leg', sports: { mma: ['striker', 'allround'], boxing: '*' }, view: 'side', minFps: 120,
    how: ['Phone side-on at hip height, 3 m away, slow-motion.', 'Throw 5 full-power crosses at a bag or pads.', 'Whole body in view, lead leg nearest the camera.'] },
};
export const screensFor = (sport, role) => Object.entries(SCREENS).filter(([, s]) => { const r = s.sports[sport]; return r === '*' || (Array.isArray(r) && r.includes(role)); }).map(([id]) => id);

const finding = (id, value, unit, extra = {}) => ({ id, ...FAULTS[id], value, unit, ...extra });
const metric = (label, value, unit, target, basis) => ({ label, value, unit, target, basis });

/* ---- fast bowling, side-on */
const FEMALE_BOWL = 'These bowling ranges come from studies of male bowlers. Female bowlers move differently (more front-on, more pelvis and trunk rotation), so treat any flag as a question for your coach, not a verdict.';
export function bowlSide(frames, { heightCm, sex } = {}) {
  if (frames.length < 20) return fail('Recording is too short. Film the last 3 strides to the follow-through.');
  const fps = measuredFps(frames.map(f => f.t));
  const dir = Math.sign(hipX(frames[frames.length - 1].px) - hipX(frames[0].px)) || 1;
  let rel = -1, best = Infinity;
  frames.forEach((f, i) => { for (const w of [15, 16]) if (f.px[w].y < best && f.px[w].y < f.px[0].y) { best = f.px[w].y; rel = i; } });
  if (rel < 0) return fail('Couldn\'t see the bowling arm above the head. Keep the whole body in view.');
  const F = dir * (frames[rel].px[27].x - frames[rel].px[28].x) > 0 ? SIDE.L : SIDE.R, B = F === SIDE.L ? SIDE.R : SIDE.L;
  const landIdx = (j, before) => { // a foot lands: horizontal speed drops near zero after moving
    const sp = frames.map((f, i) => i ? Math.abs(f.px[j.a].x - frames[i - 1].px[j.a].x) / Math.max(1, f.t - frames[i - 1].t) : 0);
    const top = Math.max(...sp.slice(0, before + 1)) || 1;
    for (let i = before; i > 1; i--) if (sp[i] < top * 0.15 && sp[i - 1] >= top * 0.15) return i;
    return -1;
  };
  const ffc = landIdx(F, rel);
  if (ffc < 0 || rel - ffc > fps * 0.4) return fail('Couldn\'t find front-foot contact. Film side-on in slow-motion with the front foot in view.');
  const bfc = landIdx(B, ffc - 1);
  const knee = frames.slice(ffc, rel + 1).map(f => kneeA(f.px, F));
  const kFfc = knee[0], kRel = knee[knee.length - 1], kMin = Math.min(...knee);
  const flex = kFfc - kMin, ext = kRel - kMin;
  // Portus et al. 2004 categories, 10° cut-offs, using the minimum between FFC and release.
  const pattern = flex >= 10 && ext >= 10 ? 'flexor-extender' : flex >= 10 ? 'flexor' : ext >= 10 ? 'extender' : 'brace';
  const plant = Math.abs(fromVert(frames[ffc].px[F.h], frames[ffc].px[F.a]));
  const metrics = [
    metric('Front knee at landing', r0(kFfc), '°', '180° = straight', 'study'),
    metric('Front knee at release', r0(kRel), '°', 'firm or straightening goes with pace', 'study'),
    metric('Front-knee pattern', pattern, '', 'Portus 2004 categories', 'study'),
    metric('Front-leg plant angle', r0(plant), '°', 'bigger went with more braking and pace', 'study'),
  ];
  const faults = [];
  if (pattern === 'flexor') faults.push(finding('frontKneeCollapse', r0(flex), '° bend after landing'));
  if (plant < 20) faults.push(finding('shortPlant', r0(plant), '° plant angle', { threshold: 'under 20° (coaching guide; no published target)' }));
  if (bfc > 0) {
    const kB = Math.min(...frames.slice(bfc, Math.min(ffc, bfc + Math.round(fps * 0.15)) + 1).map(f => kneeA(f.px, B)));
    metrics.push(metric('Back knee after back-foot landing', r0(kB), '°', 'no published target', 'coaching'));
    if (kB < 130) faults.push(finding('rearLegCollapse', r0(kB), '° back knee', { threshold: 'under 130° (coaching guide)' }));
    // Stride: heel to heel, as % of height. Height in px from leg length (hip→ankle ≈ 0.49 × stature,
    // Drillis & Contini), so no calibration is needed. Estimate: ±5–10%.
    const strideX = Math.abs(frames[ffc].px[F.heel].x - frames[bfc].px[B.heel].x);
    const statPx = median(frames.slice(bfc, ffc + 1).map(f => legLenPx(f.px, B))) / 0.491;
    const pct = r0(strideX / statPx * 100);
    if (Number.isFinite(pct)) {
      metrics.push(metric('Delivery stride', pct, '% of height', '75–85% (Spratford 2016)', 'study'));
      if (pct > 85) faults.push(finding('longStride', pct, '% of height'));
      else if (pct < 70) faults.push(finding('shortStride', pct, '% of height'));
    }
  }
  const notes = ['A straighter front knee goes with pace, but also with more lower-back load (Crewe 2013), and uninjured bowlers kept a little more bend. The lab flags a collapse, not a bend.',
    'Not measurable with one phone: shoulder counter-rotation, hip–shoulder separation, action type (side-on, front-on, mixed) and elbow legality. Have a bowling coach review your action. Elbow legality can only be tested at an ICC-accredited lab.'];
  if (fps < 100) notes.unshift(`Filmed at ${Math.round(fps)} fps. Fast bowling needs 120 fps or more to catch front-foot contact.`);
  if (sex === 'f') notes.unshift(FEMALE_BOWL);
  return { ok: true, fps: Math.round(fps), metrics, faults, notes };
}

/* ---- fast bowling, from behind: trunk side-bend at release */
export function bowlBehind(frames, { sex } = {}) {
  if (frames.length < 15) return fail('Recording is too short.');
  const fps = measuredFps(frames.map(f => f.t));
  let rel = -1, best = Infinity;
  frames.forEach((f, i) => { for (const w of [15, 16]) if (f.px[w].y < best) { best = f.px[w].y; rel = i; } });
  // Trunk line (mid-hip → mid-shoulder) from vertical, median of ±2 frames around release.
  const tl = frames.slice(Math.max(0, rel - 2), rel + 3).map(f => Math.abs(fromVert({ x: (f.px[11].x + f.px[12].x) / 2, y: (f.px[11].y + f.px[12].y) / 2 }, { x: hipX(f.px), y: hipY(f.px) })));
  const bend = r0(median(tl));
  const faults = bend >= 50 ? [finding('sideBend', bend, '° side-bend', { threshold: '50°+ (coaching guide from one study; camera error on this angle is large)' })] : [];
  return { ok: true, fps: Math.round(fps), metrics: [metric('Trunk side-bend at release', bend, '°', 'uninjured young bowlers ≈ 40° ± 8°', 'study')], faults,
    notes: [...(sex === 'f' ? [FEMALE_BOWL] : []), 'A camera angle on side-bend has wide error (even wearable sensors are ±22° in bowling). Treat a flag as a reason to have a bowling coach review your action, and compare against your own earlier videos filmed the same way.'] };
}

/* ---- top-speed sprint, side-on */
export function sprint(frames) {
  if (frames.length < 30) return fail('Recording is too short. Run all the way through the frame.');
  const fps = measuredFps(frames.map(f => f.t));
  const dir = Math.sign(hipX(frames[frames.length - 1].px) - hipX(frames[0].px)) || 1;
  const ground = j => median(frames.map(f => f.px[j.a].y).sort((a, b) => b - a).slice(0, Math.max(3, frames.length / 6)));
  const tds = [];
  for (const [k, j] of Object.entries(SIDE)) {
    const g = ground(j), o = SIDE[k === 'L' ? 'R' : 'L'];
    const leg = median(frames.map(f => legLenPx(f.px, j)));
    const near = g - leg * 0.04;
    for (let i = 1; i < frames.length; i++) if (frames[i - 1].px[j.a].y < near && frames[i].px[j.a].y >= near) {
      const px = frames[i].px;
      // Touch-down distance: ankle ahead of the hips, in leg lengths.
      const td = dir * (px[j.a].x - hipX(px)) / leg;
      // Thigh separation: free thigh vs stance thigh, angle from vertical (+ = forward).
      const thigh = jj => Math.atan2(dir * (px[jj.k].x - px[jj.h].x), px[jj.k].y - px[jj.h].y) * 180 / Math.PI; // + = knee in front of hip
      const free = thigh(o), stance = thigh(j);
      // Collapse: hip drop from touch-down to its lowest in the next ~120 ms, in leg lengths.
      const win = frames.slice(i, i + Math.max(3, Math.round(fps * 0.12)));
      const drop = (Math.max(...win.map(f => hipY(f.px))) - hipY(px)) / leg;
      const lean = Math.abs(fromVert({ x: (px[11].x + px[12].x) / 2, y: (px[11].y + px[12].y) / 2 }, { x: hipX(px), y: hipY(px) }));
      tds.push({ td, sep: free - stance, drop, lean });
    }
  }
  if (tds.length < 2) return fail('Fewer than 2 foot landings seen. Film side-on with the whole body crossing the frame.');
  const m = k => median(tds.map(x => x[k]));
  const td = m('td'), sep = m('sep'), drop = m('drop'), lean = m('lean');
  const metrics = [
    metric('Foot ahead of hips at touch-down', +(td * 100).toFixed(0), '% of leg length', 'closer to under the body is better', 'study'),
    metric('Free thigh vs stance thigh', r0(sep), '°', 'free knee level with or in front of the stance knee', 'study'),
    metric('Hip drop in stance', +(drop * 100).toFixed(1), '% of leg length', 'small', 'study'),
    metric('Trunk lean', r0(lean), '°', 'tall at top speed', 'coaching'),
  ];
  const faults = [];
  if (td > 0.3) faults.push(finding('overstride', r0(td * 100), '% of leg length', { threshold: 'over 30% (coaching guide; no validated cut-off)' }));
  if (sep < -20) faults.push(finding('poorFrontSide', r0(sep), '° (free thigh behind)', { threshold: 'free thigh more than 20° behind the stance thigh (coaching guide)' }));
  if (drop > 0.08) faults.push(finding('sprintCollapse', +(drop * 100).toFixed(1), '% of leg length', { threshold: 'over 8% (coaching guide)' }));
  if (lean > 15) faults.push(finding('sprintLean', r0(lean), '°', { threshold: 'over 15° at top speed (coaching guide)' }));
  const notes = ['These items are taken from the Sprint Mechanics Assessment Score (S-MAS), which coaches score by eye from 240 fps video. Automatic scoring of S-MAS is new and not yet validated, so use it as a screen and have QK review the video.'];
  if (fps < 120) notes.unshift(`Filmed at ${Math.round(fps)} fps. Sprint touch-downs need 240 fps slow-motion.`);
  return { ok: true, fps: Math.round(fps), steps: tds.length, metrics, faults, notes };
}

/* ---- drop landing: initial contact = feet arrive at the floor after the drop */
function landingContact(frames) {
  const footY = px => Math.max(px[27].y, px[28].y, px[29].y, px[30].y, px[31].y, px[32].y);
  const n = frames.length, end = frames.slice(Math.round(n * 0.8));
  const floor = median(end.map(f => footY(f.px)));
  const leg = median(frames.map(f => legLenPx(f.px, SIDE.L)));
  // First frame the feet are on the floor, after having been well above it (on the box / in the air).
  let up = false;
  for (let i = 0; i < n; i++) { const y = footY(frames[i].px); if (y < floor - leg * 0.15) up = true; else if (up && y >= floor - leg * 0.03) return i; }
  return -1;
}
export function landFront(frames) {
  const fps = measuredFps(frames.map(f => f.t)), ic = landingContact(frames);
  if (ic < 0) return fail('Couldn\'t see the landing. Step off the box with your feet in view.');
  const win = frames.slice(ic, ic + Math.max(4, Math.round(fps * 0.25)));
  const fp = Math.max(...win.map(f => Math.max(fppa(f.px, 'L'), fppa(f.px, 'R'))));
  // Knee-to-ankle separation ratio (Mizner 2012): tracks 3D knee load better than FPPA.
  const ratio = Math.min(...win.map(f => Math.abs(f.px[25].x - f.px[26].x) / Math.max(1, Math.abs(f.px[27].x - f.px[28].x))));
  const lat = Math.max(...win.map(f => Math.abs(fromVert({ x: (f.px[11].x + f.px[12].x) / 2, y: (f.px[11].y + f.px[12].y) / 2 }, { x: hipX(f.px), y: hipY(f.px) }))));
  const metrics = [metric('Knee inward angle (worse knee)', r0(fp), '°', 'smaller is better', 'study'), metric('Knee-to-ankle width ratio', +ratio.toFixed(2), '', '1.0 = knees as wide as ankles', 'study'), metric('Trunk side lean', r0(lat), '°', 'minimal', 'study')];
  const faults = [];
  if (fp > 10 || ratio < 0.8) faults.push(finding('kneeValgus', r0(fp), '° inward', { threshold: 'over 10° or knees narrower than 80% of ankle width (coaching guide; no validated cut-off)' }));
  if (lat > 10) faults.push(finding('landTrunkLean', r0(lat), '°', { threshold: 'over 10° (coaching guide; trunk lean is a LESS item)' }));
  return { ok: true, fps: Math.round(fps), metrics, faults, notes: ['Front-view angles are rough. In 2D video studies, changes under about 8° between tests were within measurement noise (Munro 2012).'] };
}
export function landSide(frames) {
  const fps = measuredFps(frames.map(f => f.t)), ic = landingContact(frames);
  if (ic < 0) return fail('Couldn\'t see the landing. Step off the box with your feet in view.');
  const vis = k => median(frames.map(f => (f.px[SIDE[k].k].v ?? 1) + (f.px[SIDE[k].a].v ?? 1)));
  const S = vis('L') >= vis('R') ? SIDE.L : SIDE.R;
  const flexIC = 180 - kneeA(frames[ic].px, S);
  const peak = Math.max(...frames.slice(ic, ic + Math.max(4, Math.round(fps * 0.35))).map(f => 180 - kneeA(f.px, S)));
  const disp = peak - flexIC;
  const metrics = [metric('Knee bend at touch-down', r0(flexIC), '°', 'over 30° (based on LESS)', 'coaching'), metric('Extra knee bend after touch-down', r0(disp), '°', 'over 45° (based on LESS)', 'coaching')];
  const faults = flexIC < 30 || disp < 45 ? [finding('stiffLanding', `${r0(flexIC)}° / ${r0(disp)}°`, '', { threshold: 'under 30° at touch-down or under 45° after it (coaching guide based on LESS items, Padua 2009)' })] : [];
  return { ok: true, fps: Math.round(fps), metrics, faults, notes: [] };
}

/* ---- squash lunge, side-on: every lunge's deepest point */
export function lunge(frames) {
  if (frames.length < 30) return fail('Recording is too short. Do 10 lunges.');
  const fps = measuredFps(frames.map(f => f.t));
  // Front leg = the one nearer the camera (better visibility).
  const vis = k => median(frames.map(f => (f.px[SIDE[k].k].v ?? 1)));
  const S = vis('L') >= vis('R') ? SIDE.L : SIDE.R;
  const kneeFlex = frames.map(f => 180 - kneeA(f.px, S));
  const reps = [];
  const gap = Math.round(fps * 0.6);
  for (let i = 1; i < kneeFlex.length - 1; i++) {
    const v = kneeFlex[i];
    if (v < 45) continue;
    const lo = Math.max(0, i - gap), hi = Math.min(kneeFlex.length, i + gap);
    if (kneeFlex.slice(lo, hi).every(x => x <= v) && (!reps.length || i - reps[reps.length - 1].i > gap)) {
      const px = frames[i].px, trunk = Math.abs(fromVert({ x: px[S.s].x, y: px[S.s].y }, px[S.h]));
      reps.push({ i, flex: v, trunk });
    }
  }
  if (reps.length < 3) return fail('Fewer than 3 lunges found. Lunge with the front leg nearest the camera.');
  const flex = median(reps.map(r => r.flex)), trunk = median(reps.map(r => r.trunk));
  const n = Math.max(1, Math.floor(reps.length / 3));
  const early = median(reps.slice(0, n).map(r => r.flex)), late = median(reps.slice(-n).map(r => r.flex));
  const metrics = [metric('Front knee bend at the bottom', r0(flex), '°', 'about 90° or more', 'coaching'), metric('Trunk lean', r0(trunk), '°', 'under about 45°', 'coaching'), metric('Depth lost, first → last lunges', r0(early - late), '°', 'under 10°', 'coaching')];
  const faults = [];
  if (flex < 90) faults.push(finding('shallowLunge', r0(flex), '°', { threshold: 'under 90° (coaching guide)' }));
  if (early - late >= 10) faults.push(finding('lungeFatigue', r0(early - late), '° lost'));
  if (trunk > 45) faults.push(finding('lungeTrunk', r0(trunk), '°', { threshold: 'over 45° (coaching guide)' }));
  return { ok: true, fps: Math.round(fps), reps: reps.length, metrics, faults, notes: ['Squash lunge research is thin; most numbers come from badminton.'] };
}

/* ---- straight punch, side-on: lead knee from the start of the punch to impact (fist furthest out) */
export function punch(frames) {
  if (frames.length < 20) return fail('Recording is too short.');
  const fps = measuredFps(frames.map(f => f.t));
  const dir = Math.sign(median(frames.map(f => ((f.px[15].x + f.px[16].x) / 2) - hipX(f.px)))) || 1;
  const reach = frames.map(f => Math.max(dir * (f.px[15].x - hipX(f.px)), dir * (f.px[16].x - hipX(f.px))));
  const lead = median(frames.map(f => dir * (f.px[27].x - f.px[28].x))) > 0 ? SIDE.L : SIDE.R;
  const gap = Math.round(fps * 0.3), hits = [];
  for (let i = 1; i < reach.length - 1; i++) {
    const lo = Math.max(0, i - gap), hi = Math.min(reach.length, i + gap);
    if (reach.slice(lo, hi).every(x => x <= reach[i]) && reach[i] > median(reach) * 1.2 && (!hits.length || i - hits[hits.length - 1] > gap)) hits.push(i);
  }
  if (!hits.length) return fail('No full punches found. Throw full crosses, side-on to the camera.');
  const giveWay = median(hits.map(i => kneeA(frames[Math.max(0, i - gap)].px, lead) - kneeA(frames[i].px, lead)));
  const faults = giveWay >= 10 ? [finding('leadLegLeak', r0(giveWay), '° more bend at impact', { threshold: '10°+ (coaching guide)' })] : [];
  return { ok: true, fps: Math.round(fps), reps: hits.length, metrics: [metric('Lead-knee give at impact', r0(giveWay), '°', 'firm (under 10°)', 'coaching')], faults,
    notes: ['A phone can\'t measure fist speed or the hip-to-shoulder rotation sequence reliably. This screen checks the lead-leg brace only.'] };
}

function fail(msg) { return { ok: false, issues: [msg], metrics: [], faults: [], notes: [] }; }
export const ANALYSE = { bowlSide, bowlBehind, sprint, landFront, landSide, lunge, punch }; // bowlBehind and landFront stay for tests and reuse

/** Fixes for the plan: the two most important faults across all screens ('fix' before 'watch'). */
export function topFixes(lab = {}) {
  const all = Object.values(lab).flatMap(r => r?.faults || []);
  const seen = new Set();
  return all.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'fix' ? -1 : 1)).filter(f => !seen.has(f.id) && seen.add(f.id)).slice(0, 2);
}
