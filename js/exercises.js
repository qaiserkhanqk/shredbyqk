// Exercise library: how to measure each lift, count reps, time them, and which faults to cue.
//
// Cue wording follows motor-learning research (see SCIENCE.md):
//  - External focus of attention (Wulf 2013): cues point at the floor/bench/bar/effect, not muscles.
//  - Each rule has a priority: 1 = safety (joint load), 2 = effectiveness, 3 = refinement.
//    Only ONE cue is given per rep, highest priority first (working-memory limits).
//  - `yes` is the specific praise given when a previously-cued fault is corrected
//    (feedback after good trials improves learning — Chiviacowsky & Wulf 2007).
// Thresholds are starting points from coaching standards; tune with real client footage.
import { angle, fromVertical, dist, bestSide, mid } from './angles.js';

// NSCA sources behind the rules (src: on each rule). Read directly from NSCA's own publications;
// every cue is the app's own wording. Full list with pages in SCIENCE.md §11.
export const SOURCES = {
  S1: { short: 'NSCA TSAC Exercise Technique module', url: 'https://www.nsca.com/contentassets/24f7e187e9aa4a588439c9612231c7fd/tsac-module-3.0--3.3.pdf' },
  S2: { short: 'NSCA Position Statement on Weightlifting (2023)', url: 'https://www.nsca.com/contentassets/d8cfbfa7955544a78832822bbada99b7/nsca-position-statement-on-weightlifting.pdf' },
  S3: { short: 'NSCA Personal Training Quarterly 1.3', url: 'https://www.nsca.com/globalassets/education/ptq/ptq-1.3.pdf' },
  S5: { short: 'NSCA Coach 4.1, Stability and Weightlifting', url: 'https://www.nsca.com/contentassets/53f0e82e0e664f91898f1060e0a29883/coach-4.1.3-stability-and-weightlifting-mechanics-of-stabilization-part-11.pdf' },
  S6: { short: 'NSCA Position Statement on Resistance Training for Older Adults', url: 'https://www.nsca.com/contentassets/2a4112fb355a4a48853bbafbe070fb8e/resistance_training_for_older_adults__position.1.pdf' },
  S7: { short: 'NSCA PTQ 4.4, The Undervalued Lunge', url: 'https://www.nsca.com/contentassets/24dd7222ed1b4caeb8a0a46b81bd11f3/ptq-4.4.9-the-undervalued-lunge.pdf' },
  S8: { short: 'NSCA TSAC Report 80, the shoulder', url: 'https://www.nsca.com/globalassets/education/articles/tsac/tsac-80/tsac-report-80.1.3_rehabilitation-to-performance-of-the-shoulder-for-the-tactical-athlete.pdf' },
  S9: { short: 'NSCA PTQ 10.2, Teaching Fundamental Movement Patterns', url: 'https://www.nsca.com/contentassets/3d09f06f0b4c4f6fbd8cc382ed1f3d4a/ptq-10.2.1-progressive-strategies-for-teaching-fundamental-resistance-training-movement-patterns.pdf' },
};

// QK's spoken setup commands: what a coach would tell you before the first rep, for the things a
// phone camera can't check (bracing, grip, bar start, head). Short and imperative, said out loud at the
// start of a set rather than shown as text. Sources (src) are NSCA, listed in SCIENCE.md section 11.
export const TIPS = {
  squat: [['Big breath into your belly, ribs down.', 'S5'], ['Head in line, eyes forward.', 'S3']],
  rdl: [['Bar close to your shins.', 'S1'], ['Back flat the whole way.', 'S1']],
  lunge: [['Toes and knees pointing forward.', 'S7'], ['Drive through your front heel.', 'S7']],
  bench: [['Head, back and hips on the bench, feet flat.', 'S1'], ['Grip just wider than your shoulders.', 'S1']],
  press: [['Forearms straight up and down.', 'S9'], ['Move your head back, not the bar around it.', 'S9']],
  row: [['Pull to your stomach. Shoulders down.', 'S1']],
  vPull: [['Pull to the front, never behind your head.', 'S8']],
  pushUp: [['Body tight like a plank.', 'S9']],
};
// Breathing: brace for heavy lifts (S5); breathe out instead for higher-risk people (S6), said once per session.
export const BREATHING = { cue: 'Brace, and go.', safety: "If you have high blood pressure or a heart condition, breathe out as you lift. Don't hold your breath." };

// A personal limit from the lifter's body map (bodymap.js → personalFor), or the textbook default.
const lim = (c, k, d) => c?.P?.[k] ?? d;

// Signed offset of p from line a->c as a fraction of |ac|. Negative = above the line on screen.
function offsetFromLine(a, p, c) {
  const L = dist(a, c) || 1;
  const t = ((p.x - a.x) * (c.x - a.x) + (p.y - a.y) * (c.y - a.y)) / (L * L);
  return (p.y - (a.y + t * (c.y - a.y))) / L;
}

function common(p) {
  const s = bestSide(p);
  return {
    s,
    knee: angle(s.hip, s.kn, s.an),
    hip: angle(s.sh, s.hip, s.kn),
    elbow: angle(s.sh, s.el, s.wr),
    torsoLean: fromVertical(s.hip, s.sh),
    // Segment ratios: limb proportions change "correct" positions from person to person.
    femurTorso: dist(s.hip, s.kn) / (dist(s.sh, s.hip) || 1),
    ...steadiness(p, s),
  };
}

// Positions used by the "moving too much" checks, in torso lengths so camera distance doesn't matter.
// Each check compares the lifter with their OWN position at the start of the rep (ctx.top), so standing
// a little off-centre or leaning slightly by build is never flagged, only movement during the rep.
function steadiness(p, s) {
  const T = dist(s.sh, s.hip) || 1, mh = mid(p[23], p[24]), ms = mid(p[11], p[12]), ma = mid(p[27], p[28]);
  return { hipXn: s.hip.x / T, anXn: s.an.x / T, shiftXn: (mh.x - ma.x) / T, sideTilt: fromVertical(mh, ms) };
}
// Facing the camera the knees bend towards the lens, so the 2D knee angle hardly changes. Depth is read
// from how far the hips drop towards the ankles instead, scaled by shin length (the shin stays nearly
// upright, so it barely foreshortens): standing ≈ 180°, hips near knee height ≈ 85°. Mapped to a knee
// angle so the same depth and rep thresholds apply in both views.
function frontKnee(p) {
  const shin = (dist(p[25], p[27]) + dist(p[26], p[28])) / 2 || 1;
  const ext = ((p[27].y + p[28].y) - (p[23].y + p[24].y)) / 2;
  const r = Math.max(0, Math.min(1, ext / (2.1 * shin)));
  return Math.max(40, 85 + (r - 0.5) / 0.5 * 95);
}
const movedBy = (m, c, k, lim) => !!c?.top && c.top[k] != null && Math.abs(m[k] - c.top[k]) > lim;
const bodySway = (m, c, lean = 12) => movedBy(m, c, 'torsoLean', lean) || movedBy(m, c, 'hipXn', 0.15);

// Squat: forward lean is a consequence of femur length relative to torso (Fry et al. 2003;
// Demers et al. 2018). Long-femur lifters MUST lean more to keep the bar over mid-foot,
// so the allowed lean scales with their own proportions instead of one number for everyone.
// Which library exercises a rule applies to is set by flags on each exercise (js/library.js):
//   free: true      free-standing squat (not a leg press, hack squat or slant board)
//   bench: 'feet'   lying on a bench with feet on the floor; bench: 'scap' = lying, feet hooked / on the floor
const FREE_SQUATS = ex => !!ex.free;
// Flat or incline pressing with feet on the floor (decline has the feet hooked; machines have no bench).
const FEET_DOWN_PRESS = ex => ex.bench === 'feet';
const BENCH_PRESS = ex => !!ex.bench;

const squatLeanLimit = m => Math.min(60, Math.max(38, 45 + (m.femurTorso - 0.85) * 60));

export const EXERCISES = {
  squat: {
    track: 'hip', name: 'Squat', view: 'either', primary: 'knee', downT: 115, upT: 160, concentric: 'up',
    setup: 'Phone at hip height, side-on to the camera, whole body in frame.',
    metrics(p, view) {
      const m = common(p), s = m.s;
      m.armFlex = angle(s.hip, s.sh, s.el); // upper arm vs torso: high in a front rack, low if the elbows drop
      // Heel rise: how far the heel sits above the toe, as a fraction of foot length.
      // Judged against the lifter's own standing value (ctx.base), so camera tilt cancels out.
      if (s.he && s.ft && s.he.v > 0.4 && s.ft.v > 0.4) m.heelLift = (s.ft.y - s.he.y) / (dist(s.he, s.ft) || 1);
      if (view === 'front') {
        m.kneeGap = dist(p[25], p[26]);
        m.ankleGap = dist(p[27], p[28]);
        m.knee = frontKnee(p);
      }
      return m;
    },
    bottom: [
      { id: 'sq_valgus', view: 'front', priority: 1, screen: true, test: (m, c) => m.kneeGap < m.ankleGap * (c?.P?.sqValgus ?? 0.8) * (c?.base?.kneeGap && c.base.ankleGap ? Math.min(1, c.base.kneeGap / c.base.ankleGap) : 1),
        cue: 'Spread the floor apart with your feet.', yes: 'Yes, knees tracking out. That\'s it.', tag: 'Knees out', src: 'S1',
        why: 'Knees caving in (valgus) shifts load onto the inner knee ligaments.' },
      { id: 'sq_heels', view: 'side', only: FREE_SQUATS, priority: 2,
        test: (m, c) => m.heelLift != null && c?.base?.heelLift != null && m.heelLift - c.base.heelLift > 0.3,
        cue: 'Keep your whole foot down and push the floor away through your heels.', yes: 'Heels down. Much better.', tag: 'Heels down', src: 'S1',
        why: 'When the heels lift, the weight rolls onto the toes and the knees take load the hips should share.' },
      { id: 'sq_feet', priority: 2, test: (m, c) => movedBy(m, c, 'anXn', 0.2),
        cue: 'Keep your feet planted. Stay rooted to the floor.', yes: 'Feet planted. Good.', tag: 'Feet planted',
        why: 'Feet that shift mid-rep mean the balance is off, and the load moves somewhere it shouldn\'t.' },
      { id: 'sq_shift', view: 'front', priority: 2, test: (m, c) => movedBy(m, c, 'shiftXn', 0.12),
        cue: 'Stay centred. Push evenly through both feet.', yes: 'Centred. Nice and even.', tag: 'Stay centred',
        why: 'Shifting to one side loads one hip and knee more than the other.' },
      // NSCA (S1): in the front squat the elbow position must be maintained; dropped elbows tip the bar forward.
      { id: 'fsq_elbows', view: 'side', only: ex => !!ex.rack, priority: 2, test: m => m.armFlex < 55,
        cue: 'Elbows up high, pointing forward.', yes: 'Elbows high. Good rack.', tag: 'Elbows up', src: 'S1',
        why: 'Dropped elbows let the bar roll forward and pull the chest down with it.' },
      { id: 'sq_chest', view: 'side', priority: 2, test: (m, c) => m.torsoLean > (c?.P?.sqLean ?? squatLeanLimit(m)),
        cue: 'Show the logo on your shirt to the wall in front.', yes: 'Better, chest stayed proud.', tag: 'Chest up', src: 'S3',
        why: 'Leaning past what your limb proportions need moves load to the lower back.' },
      { id: 'sq_depth', priority: 3, test: (m, c) => m.knee > (c?.P?.sqDepth ?? 105),
        cue: 'Sit down between your heels, a little deeper.', yes: 'Great depth.', tag: 'Deeper', src: 'S1',
        why: 'Deeper squats train the glutes and quads through a longer range (Kubo 2019).' },
    ],
    // Judged early in the drive up (40% of the way from the bottom), where "hips shoot up" shows.
    ascent: [
      { id: 'sq_hips_first', view: 'side', only: FREE_SQUATS, priority: 2,
        test: (m, c) => c?.bottom && m.torsoLean - c.bottom.torsoLean > 10,
        cue: 'Lead with your chest. Hips and shoulders rise together.', yes: 'Yes, chest and hips together.', tag: 'Chest leads',
        why: 'If the hips rise before the shoulders, the squat turns into a good morning and the lower back takes the load.' },
    ],
    top: [
      { id: 'sq_lockout', priority: 3, test: (m, c) => m.knee < lim(c, 'lockKnee', 165),
        cue: 'Push the floor away and stand tall.', yes: 'Full lockout, nice.', tag: 'Stand tall',
        why: 'Finishing each rep completes hip extension.' },
    ],
  },

  hipThrust: {
    track: 'hip', name: 'Hip Thrust', view: 'side', primary: 'hip', downT: 125, upT: 155, concentric: 'up',
    setup: 'Side-on, camera at bench height about two metres away. Shoulders, hips, knees and feet visible.',
    metrics(p) {
      const m = common(p);
      m.arch = offsetFromLine(m.s.sh, m.s.hip, m.s.kn); // negative = hips above shoulder–knee line
      return m;
    },
    top: [
      { id: 'ht_arch', priority: 1, test: m => m.arch < -0.12,
        cue: 'Keep your ribs down, eyes on your knees, and finish with your glutes.', yes: 'Yes, ribs down. Perfect.',
        why: 'Over-arching finishes the rep with the lower back instead of the glutes.' },
      // Foot position is judged by YOUR shin angle at lockout (knee ≈ 90°, shin vertical),
      // so it adapts to each person's leg length rather than a fixed foot distance.
      { id: 'ht_feet_far', priority: 2, test: m => m.knee > 105,
        cue: 'Walk your feet back toward the bench, shins vertical at the top.', yes: 'That\'s the spot. Shins vertical.',
        why: 'Feet too far out shifts the work to the hamstrings.' },
      { id: 'ht_feet_close', priority: 2, test: m => m.knee < 72,
        cue: 'Move your feet a little further from the bench.', yes: 'Better foot position.',
        why: 'Feet too close makes it quad-dominant and loads the knee.' },
      { id: 'ht_lockout', priority: 3, test: (m, c) => m.hip < lim(c, 'lockHip', 165),
        cue: 'Drive your hips up to the ceiling and pause.', yes: 'Full lockout. Glutes on fire.',
        why: 'Glute activation peaks at full hip extension (Contreras 2015).' },
    ],
    bottom: [],
  },

  pushUp: {
    track: 'sh', name: 'Push-up', view: 'side', primary: 'elbow', downT: 105, upT: 150, concentric: 'up',
    setup: 'Camera on the floor, side-on, about two metres away.',
    metrics(p) {
      const m = common(p);
      m.line = angle(m.s.sh, m.s.hip, m.s.an);
      m.sag = offsetFromLine(m.s.sh, m.s.hip, m.s.an);
      m.handOff = Math.abs(m.s.wr.x - m.s.sh.x) / (dist(m.s.sh, m.s.hip) || 1);
      return m;
    },
    top: [
      { id: 'pu_hands', priority: 2, test: m => m.handOff > 0.35,
        cue: 'Put your hands right under your shoulders.', yes: 'Hands under shoulders. Good.', tag: 'Hands under shoulders', src: 'S9',
        why: 'Hands under the shoulders keeps the push straight and spares the shoulder joint.' },
    ],
    bottom: [
      { id: 'pu_depth', priority: 3, test: (m, c) => m.elbow > lim(c, 'pressDepth', 100),
        cue: 'Bring your chest to the floor.', yes: 'Good depth.',
        why: 'Full range trains the chest through its stretched position.' },
    ],
    always: [
      { id: 'pu_sag', priority: 1, test: (m, c) => m.line < lim(c, 'line', 160) && m.sag > 0,
        cue: 'Push the floor away and lift your belt buckle.', yes: 'Solid plank. Good.', src: 'S9',
        why: 'Sagging hips extend the lower back under load.' },
      { id: 'pu_pike', priority: 2, test: (m, c) => m.line < lim(c, 'line', 160) && m.sag < 0,
        cue: 'Make one straight line from head to heels.', yes: 'Straight line, nice.', src: 'S9',
        why: 'Piking shortens the range and takes load off the chest.' },
    ],
  },

  rdl: {
    track: 'wr', name: 'Romanian Deadlift', view: 'side', primary: 'hip', downT: 120, upT: 165, concentric: 'up',
    setup: 'Side-on, camera at hip height, whole body in frame.',
    metrics(p) {
      const m = common(p), s = m.s, T = dist(s.sh, s.hip) || 1;
      // Bar (wrists) relative to mid-foot, in torso lengths: NSCA wants it over the mid-foot and close to the legs.
      const mf = s.he && s.ft ? mid(s.he, s.ft) : s.an;
      m.barOff = Math.abs(s.wr.x - mf.x) / T;
      return m;
    },
    bottom: [
      { id: 'rdl_bar', only: ex => !ex.barOnBack && !ex.swing, priority: 2, test: m => m.barOff > 0.35,
        cue: 'Keep the bar close. Slide it down your legs.', yes: 'Bar close. Good.', tag: 'Bar close', src: 'S2',
        why: 'A bar drifting away from the legs loads the lower back far more for the same weight.' },
      { id: 'rdl_arms', only: ex => !ex.barOnBack, priority: 2, test: m => m.elbow < 155,
        cue: 'Arms are ropes: let the bar hang and slide it down your legs.', yes: 'Straight arms. Good.', tag: 'Straight arms', src: 'S1',
        why: 'Bending the arms in a pull wastes the leg drive and lets the bar drift.' },
      { id: 'rdl_locked', only: ex => !!ex.softKnee, priority: 2, test: m => m.knee > 174,
        cue: 'Push your hips back toward the wall behind you, knees soft.', yes: 'Soft knees. Good.', tag: 'Soft knees', src: 'S1',
        why: 'Locked knees put the hamstring stretch onto the back of the knee and lower back instead.' },
      { id: 'rdl_squat', only: ex => !ex.dl, priority: 2, test: m => m.knee < 135,
        cue: 'Push your hips back to touch the wall behind you.', yes: 'Beautiful hinge.',
        why: 'Too much knee bend turns the hinge into a squat and unloads the hamstrings.' },
      // Hinge depth depends on hamstring length, so it's only judged once the body map knows it.
      { id: 'rdl_short', priority: 3, test: (m, c) => m.hip > lim(c, 'hingeDepth', 999),
        cue: 'Push your hips further back until you feel your hamstrings stretch.', yes: 'Full stretch. Good.', tag: 'Hips back',
        why: 'The hamstrings grow most when trained through their full stretched range, which is set by your own flexibility.' },
    ],
    // NSCA (S1, S2): in a pull from the floor the hips and chest rise together; hips shooting up first is a common error.
    ascent: [
      { id: 'dl_hips_first', only: ex => !!ex.dl, priority: 2, view: 'side',
        // Knees straighten by 25°+ while the chest has barely risen (lean down less than 5°): the hips shot up first.
        continuous: true, test: (m, c) => c?.bottom && m.knee - c.bottom.knee > 25 && c.bottom.torsoLean - m.torsoLean < 5,
        cue: 'Chest and hips rise together. Push the floor away.', yes: 'Together. That\'s the pull.', tag: 'Chest up', src: 'S2',
        why: 'When the hips rise first, the back takes the weight the legs should be lifting.' },
    ],
    top: [
      { id: 'rdl_lockout', priority: 3, test: (m, c) => m.hip < lim(c, 'lockHip', 168),
        cue: 'Stand tall and bring your hips to the bar.', yes: 'Locked out.',
        why: 'Finishing the hinge completes glute and hamstring contraction.' },
    ],
  },

  lunge: {
    track: 'hip', name: 'Lunge', view: 'side', primary: 'knee', downT: 115, upT: 155, concentric: 'up',
    setup: 'Side-on, camera at hip height. Leave room in frame for the step.',
    metrics(p) {
      const m = common(p), s = m.s;
      m.knee = Math.min(angle(p[23], p[25], p[27]), angle(p[24], p[26], p[28]));
      // Stride: distance between the feet, in leg lengths (only when both ankles are clearly seen).
      if (p[27].v > 0.5 && p[28].v > 0.5) m.stride = Math.abs(p[27].x - p[28].x) / ((dist(s.hip, s.kn) + dist(s.kn, s.an)) || 1);
      return m;
    },
    bottom: [
      { id: 'lu_stride', only: ex => !ex.step, priority: 2, test: m => m.stride != null && m.stride < 0.6,
        cue: 'Take a longer step, so both knees can bend to ninety degrees.', yes: 'Good stride.', tag: 'Longer step', src: 'S7',
        why: 'With the feet too close the front knee takes much more stress.' },
      { id: 'lu_torso', priority: 2, test: (m, c) => m.torsoLean > lim(c, 'luLean', 25),
        cue: 'Stay tall, like a string pulling your head to the ceiling.', yes: 'Tall torso, good.',
        why: 'Excess lean reduces quad loading and stresses the lower back.' },
      { id: 'lu_depth', priority: 3, test: (m, c) => m.knee > lim(c, 'luDepth', 105),
        cue: 'Kiss the floor with your back knee.', yes: 'Good depth.', src: 'S7',
        why: 'Full depth trains the glutes in their lengthened position.' },
    ],
  },

  curl: {
    track: 'wr', name: 'Bicep Curl', view: 'either', primary: 'elbow', downT: 60, upT: 145, concentric: 'down',
    setup: 'Side-on or facing the camera, upper body clearly visible.',
    metrics(p) {
      const m = common(p);
      m.upperArmSwing = fromVertical(m.s.sh, m.s.el);
      return m;
    },
    always: [
      { id: 'cu_body', priority: 2, test: (m, c) => bodySway(m, c),
        cue: 'Keep the bar path close and smooth: no swinging the weight.', yes: 'Body still. That\'s it.', tag: 'Body still',
        why: 'Rocking the body uses momentum, so the biceps do less of the work.' },
      { id: 'cu_swing', priority: 2, test: m => m.upperArmSwing > 30,
        cue: 'Pin the weight close to your sides, like holding a newspaper under each arm.', yes: 'Elbows still. Perfect.',
        why: 'Swinging uses momentum and the shoulders instead of the biceps.' },
    ],
    bottom: [
      { id: 'cu_squeeze', priority: 3, test: m => m.elbow > 55,
        cue: 'Bring the weight all the way to your shoulders.', yes: 'Full squeeze.',
        why: 'Full range of motion maximises the training stimulus.' },
    ],
    top: [
      { id: 'cu_extend', priority: 3, test: (m, c) => m.elbow < lim(c, 'reachElbow', 150),
        cue: 'Lower the weight all the way down to your thighs.', yes: 'Full stretch, good.',
        why: 'The lengthened position is where much of the growth stimulus comes from (Pedrosa 2022).' },
    ],
  },

  press: {
    track: 'wr', name: 'Overhead Press', view: 'front', primary: 'elbow', downT: 95, upT: 155, concentric: 'up',
    setup: 'Facing the camera, upper body and arms fully in frame.',
    metrics(p) {
      const m = common(p);
      m.elbow = Math.min(angle(p[11], p[13], p[15]), angle(p[12], p[14], p[16]));
      m.wristDiff = Math.abs(p[15].y - p[16].y) / (dist(p[11], p[12]) || 1);
      // Wrist straight over elbow: forearm tilt as a share of upper-arm length, the worse arm.
      m.stack = Math.max(Math.abs(p[15].x - p[13].x) / (dist(p[11], p[13]) || 1), Math.abs(p[16].x - p[14].x) / (dist(p[12], p[14]) || 1));
      return m;
    },
    bottom: [
      { id: 'pr_stack', priority: 2, test: m => m.stack > 0.45,
        cue: 'Stack your wrists right above your elbows.', yes: 'Stacked. Good.', tag: 'Wrists over elbows', src: 'S1',
        why: 'Hands, elbows and shoulders should line up vertically; tilted forearms push the load forward onto the shoulder.' },
    ],
    always: [
      { id: 'pr_lean', priority: 1, test: (m, c) => m.sideTilt > 10 || movedBy(m, c, 'shiftXn', 0.12),
        cue: 'Stay tall and square. Don\'t lean to one side.', yes: 'Tall and square. Good.', tag: 'Stay square',
        why: 'Leaning to one side under a weight overhead loads the lower back unevenly.' },
    ],
    top: [
      { id: 'pr_even', priority: 2, test: m => m.wristDiff > 0.25,
        cue: 'Push both hands to the ceiling at the same time.', yes: 'Even press. Good.',
        why: 'An uneven press shows a side-to-side strength imbalance.' },
      { id: 'pr_lockout', priority: 3, test: (m, c) => m.elbow < lim(c, 'lockElbow', 160),
        cue: 'Punch the ceiling and lock out.', yes: 'Full lockout.',
        why: 'Full lockout trains the upper traps and triceps through range.' },
    ],
  },

  // ---- Additional movement patterns. Each one powers many exercises in js/library.js. ----
  row: {
    track: 'wr', name: 'Row', view: 'side', primary: 'elbow', downT: 95, upT: 145, concentric: 'down',
    setup: 'Side-on, camera at hip height. Arms, torso and hips in frame.',
    metrics(p) { const m = common(p); return m; },
    bottom: [
      { id: 'row_angle', only: ex => !!ex.bentOver, priority: 2, test: m => m.torsoLean < 45,
        cue: 'Hinge further. Bring your chest closer to parallel with the floor.', yes: 'Good hinge.', tag: 'Hinge more', src: 'S1',
        why: 'With your torso near parallel to the floor, your back muscles pull straight up against gravity.' },
      { id: 'row_body', priority: 2, test: (m, c) => movedBy(m, c, 'torsoLean', 15),
        cue: 'Keep your chest on the same spot and pull the weight to you.', yes: 'Torso still. Strict reps.', tag: 'Chest still', src: 'S1',
        why: 'Heaving the torso up turns the row into a swing and takes work off the back muscles.' },
      { id: 'row_short', priority: 3, test: m => m.elbow > 85, cue: 'Pull the weight all the way to your belly button.', yes: 'Full squeeze. Good.',
        why: 'The mid-back muscles (rhomboids, mid-traps) work hardest at the end of the pull.' },
    ],
    top: [
      { id: 'row_reach', priority: 3, test: (m, c) => m.elbow < lim(c, 'reachElbow', 150), cue: 'Let your arms reach all the way forward.', yes: 'Full stretch, nice.',
        why: 'Reaching lets the shoulder blades move, training the lats through their full length.' },
    ],
  },

  vPull: {
    track: 'wr', name: 'Vertical Pull', view: 'front', primary: 'elbow', downT: 85, upT: 150, concentric: 'down',
    setup: 'Facing the camera, arms and hands fully in frame at the top.',
    metrics(p) {
      const m = common(p);
      m.elbow = Math.max(angle(p[11], p[13], p[15]), angle(p[12], p[14], p[16]));
      m.wristDiff = Math.abs(p[15].y - p[16].y) / (dist(p[11], p[12]) || 1);
      return m;
    },
    bottom: [
      { id: 'vp_short', priority: 3, test: m => m.elbow > 80, cue: 'Pull the bar down to your collarbone.', yes: 'That\'s a full pull.',
        why: 'Pulling the elbows all the way down fully contracts the lats.' },
      { id: 'vp_even', priority: 2, test: m => m.wristDiff > 0.25, cue: 'Pull both hands down evenly.', yes: 'Even pull, good.',
        why: 'An uneven pull means one side is doing more of the work.' },
    ],
    top: [
      { id: 'vp_hang', priority: 3, test: (m, c) => m.elbow < lim(c, 'lockElbow', 155), cue: 'Let your arms go fully straight at the top.', yes: 'Full stretch.',
        why: 'The stretched position at the top builds lat length and strength.' },
    ],
  },

  bench: {
    track: 'wr', name: 'Press', view: 'side', primary: 'elbow', downT: 105, upT: 150, concentric: 'up',
    setup: 'Side-on, camera at bench height, about two metres away.',
    metrics(p) {
      const m = common(p), s = m.s;
      m.upperArm = dist(s.sh, s.el); m.torso = dist(s.sh, s.hip);
      m.shY = s.sh.y; m.hipY = s.hip.y;
      m.feetUp = s.an.y < s.hip.y; // ankles above the bench line = feet off the floor
      m.headY = s.ear.y;
      return m;
    },
    bottom: [
      { id: 'bp_legs', only: FEET_DOWN_PRESS, priority: 2, test: m => m.knee > 140 || m.feetUp,
        cue: 'Pull your feet back under your knees and drive them into the floor.', yes: 'Feet set. Good leg drive.', tag: 'Leg drive',
        why: 'Planted feet give a stable base and transfer force from the legs into the press.' },
      { id: 'bp_head', only: ex => !!ex.bench, priority: 2, test: (m, c) => c?.base && (c.base.headY - m.headY) / (m.torso || 1) > 0.15,
        cue: 'Keep your head down on the bench.', yes: 'Head down. Five points of contact.', tag: 'Head down', src: 'S1',
        why: 'Head, upper back, buttocks and both feet stay in contact for a stable base.' },
      { id: 'bp_depth', priority: 3, test: (m, c) => m.elbow > lim(c, 'pressDepth', 100), cue: 'Bring the weight all the way down to your chest.', yes: 'Good depth.', tag: 'Touch chest',
        why: 'Full range loads the chest in its stretched position, where much of the growth comes from.' },
    ],
    ascent: [
      { id: 'bp_butt', only: FEET_DOWN_PRESS, priority: 2,
        test: (m, c) => c?.base && (c.base.hipY - m.hipY) / (m.torso || 1) > 0.1,
        cue: 'Keep your glutes on the bench. Push with your legs, not your hips.', yes: 'Glutes down. That\'s it.', tag: 'Glutes down',
        why: 'Lifting the hips shortens the press and puts the lower back in extension under load.' },
    ],
    top: [
      // 2D proxy for scapular retraction: if the shoulder rises off the bench as the arms lock out,
      // the shoulder blades have rolled forward (protracted) instead of staying pinned back.
      { id: 'bp_scap', only: BENCH_PRESS, priority: 2,
        test: (m, c) => c?.bottom && (c.bottom.shY - m.shY) / (c.bottom.upperArm || 1) > 0.2,
        cue: 'Bend the bar into a smile and pin your back into the bench.', yes: 'Shoulders stayed pinned. Perfect.', tag: 'Pin shoulders',
        why: 'Retracted shoulder blades protect the shoulder joint and give the chest a stable base to press from.' },
      { id: 'bp_lockout', priority: 3, test: (m, c) => m.elbow < lim(c, 'lockElbow', 155), cue: 'Press all the way up until your arms are straight.', yes: 'Locked out.', tag: 'Lock out',
        why: 'Finishing each rep trains the triceps through range.' },
    ],
  },

  dip: {
    track: 'sh', name: 'Dip', view: 'side', primary: 'elbow', downT: 110, upT: 150, concentric: 'up',
    setup: 'Side-on, camera at chest height. Whole upper body in frame.',
    metrics: p => common(p),
    bottom: [
      { id: 'dip_depth', priority: 3, test: m => m.elbow > 100, cue: 'Lower until your upper arms are level with the floor.', yes: 'Good depth.',
        why: 'Upper arms at parallel trains the chest and triceps without overloading the shoulder.' },
      { id: 'dip_deep', priority: 1, test: m => m.elbow < 60, cue: 'Not so deep. Stop when your upper arms are level.', yes: 'Better depth.',
        why: 'Going very deep puts a lot of stress on the front of the shoulder.' },
    ],
    top: [{ id: 'dip_lockout', priority: 3, test: (m, c) => m.elbow < lim(c, 'lockElbow', 155), cue: 'Push all the way up and lock out.', yes: 'Locked out.', why: 'Full lockout trains the triceps.' }],
  },

  fly: {
    track: 'wr', name: 'Fly', view: 'front', primary: 'spread', downT: 90, upT: 140, concentric: 'down',
    setup: 'Facing the camera, arms and hands fully in frame.',
    metrics(p) {
      const m = common(p);
      m.spread = dist(p[15], p[16]) / (dist(p[11], p[12]) || 1) * 60;
      m.elbowBend = Math.min(angle(p[11], p[13], p[15]), angle(p[12], p[14], p[16]));
      return m;
    },
    always: [
      { id: 'fly_bend', priority: 2, test: m => m.elbowBend < 110, cue: 'Hug a big tree: keep the same wide arc every rep.', yes: 'Good arm shape.',
        why: 'Bending the elbows more turns the fly into a press and takes load off the chest.' },
    ],
  },

  triExt: {
    track: 'wr', name: 'Triceps Extension', view: 'side', primary: 'elbow', downT: 95, upT: 155, concentric: 'up',
    setup: 'Side-on, camera at chest height. Shoulder, elbow and hand in frame.',
    metrics(p) { const m = common(p); m.upperArmSwing = fromVertical(m.s.sh, m.s.el); return m; },
    always: [
      { id: 'tri_body', priority: 2, test: (m, c) => bodySway(m, c),
        cue: 'Smooth curl: the weight travels, your body stays put.', yes: 'Steady. Good.', tag: 'Body still',
        why: 'Leaning into the rep lets the shoulders and body weight do the triceps\' job.' },
    ],
    top: [
      { id: 'tri_lockout', priority: 3, test: (m, c) => m.elbow < lim(c, 'lockElbow', 160), cue: 'Push the weight all the way out until it stops.', yes: 'Full lockout.',
        why: 'The triceps are fully shortened at lockout, so finishing the rep matters.' },
    ],
  },

  raise: {
    track: 'wr', name: 'Raise', view: 'either', primary: 'shoulderClosed', downT: 105, upT: 150, concentric: 'down',
    setup: 'Facing the camera for side raises, side-on for front raises. Arms fully in frame.',
    metrics(p, view) {
      const m = common(p);
      const abd = view === 'front' ? Math.max(angle(p[23], p[11], p[13]), angle(p[24], p[12], p[14])) : angle(m.s.hip, m.s.sh, m.s.el);
      m.shoulder = abd; m.shoulderClosed = 180 - abd;
      return m;
    },
    bottom: [
      { id: 'raise_low', priority: 3, test: (m, c) => m.shoulder < lim(c, 'raiseLow', 75), cue: 'Lift your hands up to shoulder height.', yes: 'Right height.',
        why: 'The shoulder muscle does most of its work in the last part of the lift.' },
      { id: 'raise_high', priority: 2, test: m => m.shoulder > 110, cue: 'Stop at shoulder height. No higher.', yes: 'Good height.',
        why: 'Going above shoulder height shifts the work to the upper traps.' },
    ],
    always: [
      { id: 'raise_body', priority: 2, test: (m, c) => bodySway(m, c, 10),
        cue: 'Keep the weights floating out wide, body still like a statue.', yes: 'Steady body. Good.', tag: 'Body still',
        why: 'Rocking the body flings the weight up with momentum instead of the shoulder muscles.' },
      { id: 'raise_swing', priority: 2, test: m => m.torsoLean > 15, cue: 'Stay tall and float the weights up slowly, no swing.', yes: 'Strict reps. Nice.',
        why: 'Swinging the torso uses momentum instead of the target muscle.' },
    ],
  },

  calf: {
    track: 'an', name: 'Calf Raise', view: 'side', primary: 'heelDrop', downT: 88, upT: 96, concentric: 'down',
    setup: 'Side-on, camera at ankle height, feet clearly visible.',
    metrics(p) {
      const m = common(p), s = m.s, heel = s.side === 'left' ? p[29] : p[30];
      const foot = dist(heel, s.ft) || 1;
      m.lift = (s.ft.y - heel.y) / foot; // + when the heel is above the toes
      m.heelDrop = 100 - m.lift * 60;
      return m;
    },
    bottom: [
      { id: 'calf_high', priority: 3, test: (m, c) => m.lift < lim(c, 'calfLift', 0.35), cue: 'Push up higher onto the balls of your feet, and pause.', yes: 'Full height.',
        why: 'The calves are strongest at the top. A one-second pause removes bounce.' },
    ],
  },

  torsoCurl: {
    track: 'sh', name: 'Crunch', view: 'side', primary: 'torsoAngle', downT: 72, upT: 82, concentric: 'down',
    setup: 'Lying side-on to the camera, camera on the floor about two metres away.',
    metrics(p) { const m = common(p); m.torsoAngle = fromVertical(m.s.hip, m.s.sh); return m; },
    bottom: [
      { id: 'cr_short', priority: 3, test: m => m.torsoAngle > 68, cue: 'Bring your chest down toward your belt.', yes: 'Good crunch.',
        why: 'The abs flex the spine. Curling, not just lifting the head, is what trains them.' },
    ],
  },

  legRaise: {
    track: 'an', name: 'Leg Raise', view: 'side', primary: 'hipLine', downT: 125, upT: 160, concentric: 'down',
    setup: 'Side-on to the camera, whole body in frame.',
    metrics(p) { const m = common(p); m.hipLine = angle(m.s.sh, m.s.hip, m.s.an); return m; },
    bottom: [
      { id: 'lr_high', priority: 3, test: (m, c) => m.hipLine > lim(c, 'legRaise', 115), cue: 'Lift your legs up to ninety degrees.', yes: 'Good height.',
        why: 'Lifting higher makes the lower abs curl the pelvis, not just the hip flexors.' },
    ],
  },

  kneeExt: {
    track: 'an', name: 'Leg Extension', view: 'side', primary: 'knee', downT: 110, upT: 160, concentric: 'up',
    setup: 'Side-on to the camera, hip, knee and ankle in frame.',
    metrics: p => common(p),
    top: [{ id: 'ke_lockout', priority: 3, test: (m, c) => m.knee < lim(c, 'lockKnee', 165), cue: 'Kick the pad all the way up until it stops.', yes: 'Full squeeze.', why: 'The quads are fully contracted only at full knee extension.' }],
  },

  kneeFlex: {
    track: 'an', name: 'Leg Curl', view: 'side', primary: 'knee', downT: 95, upT: 150, concentric: 'down',
    setup: 'Side-on to the camera, hip, knee and ankle in frame.',
    metrics: p => common(p),
    bottom: [{ id: 'kf_short', priority: 3, test: m => m.knee > 85, cue: 'Curl your heels all the way towards your glutes.', yes: 'Full curl.', why: 'Hamstrings are trained best through their full range.' }],
    top: [{ id: 'kf_extend', priority: 3, test: (m, c) => m.knee < lim(c, 'reachKnee', 150), cue: 'Let your legs straighten fully between reps.', yes: 'Full stretch.', why: 'The stretched position builds the most hamstring strength.' }],
  },

  plank: {
    track: 'hip', name: 'Plank', view: 'side', primary: 'line', downT: -1, upT: 999, hold: true, concentric: 'up',
    setup: 'Side-on to the camera, camera on the floor about two metres away.',
    metrics(p) {
      const m = common(p);
      m.line = angle(m.s.sh, m.s.hip, m.s.an);
      m.sag = offsetFromLine(m.s.sh, m.s.hip, m.s.an);
      return m;
    },
    always: [
      { id: 'pl_sag', priority: 1, test: (m, c) => m.line < lim(c, 'line', 162) && m.sag > 0, cue: 'Lift your hips. Squeeze your glutes and brace like someone\'s about to poke your stomach.', yes: 'Solid. Hold it.',
        why: 'Sagging hips put the load on your lower back instead of your core.' },
      { id: 'pl_pike', priority: 2, test: (m, c) => m.line < lim(c, 'line', 162) && m.sag < 0, cue: 'Lower your hips into one straight line.', yes: 'Straight line, good.',
        why: 'Piking the hips up makes the plank much easier for the abs.' },
    ],
  },
};

// Faults that can be judged mid-rep (posture, alignment), not ones that need the end of the rep
// (depth, lockout, range). These are cued the moment they show.
const LIVE = new Set(['fsq_elbows', 'rdl_bar', 'rdl_arms', 'rdl_locked', 'lu_stride', 'row_angle', 'sq_feet', 'sq_shift', 'row_body', 'sq_valgus', 'sq_heels', 'sq_chest', 'bp_legs', 'pu_sag', 'pu_pike', 'rdl_squat', 'lu_torso', 'cu_swing', 'raise_swing', 'fly_bend', 'dip_deep']);
// What the lifter is doing wrong, in plain words, shown on screen next to the fix.
export const WRONG = {
  fsq_elbows: 'Elbows dropping', rdl_bar: 'Bar drifting away from your legs', rdl_arms: 'Bending your arms', rdl_locked: 'Knees locked straight',
  dl_hips_first: 'Hips rising before your chest', lu_stride: 'Step too short', bp_head: 'Head lifting off the bench', pr_stack: 'Wrists not over your elbows',
  row_angle: 'Torso too upright', pu_hands: 'Hands too far forward',
  sq_feet: 'Feet moving', sq_shift: 'Shifting to one side', cu_body: 'Swinging your body', tri_body: 'Moving your body',
  pr_lean: 'Leaning to one side', row_body: 'Heaving with your body', raise_body: 'Swinging your body',
  sq_valgus: 'Knees caving in', sq_heels: 'Heels lifting', sq_chest: 'Leaning too far forward', sq_depth: 'Not deep enough',
  sq_hips_first: 'Hips shooting up first', sq_lockout: 'Not standing all the way up',
  bp_legs: 'No leg drive', bp_butt: 'Hips coming off the bench', bp_scap: 'Shoulders rolling off the bench', bp_depth: 'Not touching your chest', bp_lockout: 'Not locking out',
  ht_arch: 'Arching your lower back', ht_feet_far: 'Feet too far away', ht_feet_close: 'Feet too close', ht_lockout: 'Hips not all the way up',
  pu_sag: 'Hips sagging', pu_pike: 'Hips too high', pu_depth: 'Not going low enough',
  rdl_squat: 'Squatting, not hinging', rdl_short: 'Not hinging far enough', rdl_lockout: 'Not standing tall', lu_torso: 'Leaning forward', lu_depth: 'Not deep enough',
  cu_swing: 'Swinging your elbows', cu_squeeze: 'Not curling all the way', cu_extend: 'Not lowering all the way',
  pr_even: 'Pressing unevenly', pr_lockout: 'Not locking out', raise_swing: 'Using momentum', raise_high: 'Lifting too high', raise_low: 'Not lifting high enough',
  dip_deep: 'Going too deep', fly_bend: 'Bending your elbows too much', pl_sag: 'Hips sagging', pl_pike: 'Hips too high',
};
// Short coach's shout used once the full cue has been said twice.
const SHOUT = {
  ht_arch: 'Ribs down', ht_feet_far: 'Feet back', ht_feet_close: 'Feet out', ht_lockout: 'Hips up',
  pu_sag: 'Hips up', pu_pike: 'Hips down', pu_depth: 'Chest down', rdl_squat: 'Hips back', rdl_lockout: 'Stand tall',
  lu_torso: 'Stay tall', lu_depth: 'Knee down', cu_swing: 'Elbows still', cu_squeeze: 'All the way up', cu_extend: 'All the way down',
  pr_even: 'Even', pr_lockout: 'Lock out', raise_swing: 'No swinging', raise_high: 'Shoulder height', raise_low: 'Higher',
  dip_deep: 'Not so deep', dip_depth: 'Lower', fly_bend: 'Soft elbows', pl_sag: 'Hips up', pl_pike: 'Hips down',
};
for (const ex of Object.values(EXERCISES)) {
  for (const r of ex.bottom || []) if (LIVE.has(r.id)) r.live = true;
  for (const r of [...(ex.bottom || []), ...(ex.ascent || []), ...(ex.top || []), ...(ex.always || [])]) { r.wrong ||= WRONG[r.id]; r.tag ||= SHOUT[r.id]; }
}

export const allRules = ex => [...(ex.bottom || []), ...(ex.ascent || []), ...(ex.top || []), ...(ex.always || [])];

/**
 * Rep counter, fault detector and tempo/fatigue tracker.
 * Feed it smoothed metrics + a timestamp (ms) every frame; it returns events.
 */
export class RepEngine {
  /** @param P personal thresholds from the lifter's body map (bodymap.js), or null for defaults */
  constructor(ex, view, P = null) {
    this.ex = ex; this.view = view; this.P = P;
    this.downT = P?.downT ?? ex.downT; this.upT = P?.upT ?? ex.upT;
    this.phase = 'top'; this.reps = 0; this.goodReps = 0;
    this.bottomSnap = null; this.topSnap = null; this.alwaysCount = {};
    this.faultTally = {}; this.tempo = []; // [{ecc, con}] seconds per rep
    this.tLeaveTop = null; this.tBottom = null; this.roms = [];
    this.base = null; this.ascentSnap = null; // base = start position (standing / set up on the bench)
    this.liveSeen = new Set(); this.liveCount = {};
    this.unsureReps = 0; this.checkTally = {}; // reps counted but not judged (joint hidden); screening flags
  }

  // `only` limits a rule to some library exercises (e.g. heel rise is meaningless on a leg press).
  // skipRules: a library exercise can switch off a rule that doesn't fit it (e.g. "elbow swing" on a
  // preacher curl, where the arm rests on a pad at an angle).
  rules(list) {
    const ex = this.ex;
    return (list || []).filter(r => (!r.view || r.view === this.view) && (!r.only || r.only(ex)) && !ex.skipRules?.includes(r.id));
  }
  ctx() { return { base: this.base, bottom: this.bottomSnap, top: this.topSnap, ascent: this.ascentSnap, P: this.P }; }

  // Velocity loss within a set (Sánchez-Medina & González-Badillo 2011): slowing of the lifting
  // phase vs the fastest of the first reps tracks how close the set is to failure.
  velocityLoss() {
    const con = this.tempo.map(t => t.con).filter(Boolean);
    if (con.length < 3) return 0;
    const best = Math.min(...con.slice(0, 3));
    return Math.max(0, 1 - best / con[con.length - 1]);
  }

  update(m, t) {
    const ex = this.ex, v = m[ex.primary], events = [];
    if (v == null || Number.isNaN(v)) return events;

    if (this.phase === 'top') {
      if (!this.topSnap || v > this.topSnap[ex.primary]) { this.topSnap = { ...m }; this.tLeaveTop = t; }
      if (v < this.downT) { this.base ||= { ...this.topSnap }; this.phase = 'bottom'; this.bottomSnap = { ...m }; this.tBottom = t; this.ascentSnap = null; this.liveSeen = new Set(); this.liveCount = {}; }
    } else {
      if (v < this.bottomSnap[ex.primary]) { this.bottomSnap = { ...m }; this.tBottom = t; this.ascentSnap = null; }
      const b = this.bottomSnap[ex.primary];
      // LIVE: faults that can be judged mid-rep are reported the moment they show (held ~0.2 s),
      // so the coach can correct the rep while it's happening, like a coach standing next to you.
      // Bottom-position faults are watched on the way down and at the bottom; once the lifter is
      // clearly rising, the drive-up (ascent) rules take over, so one mistake isn't cued twice.
      const lc = this.ctx(), rising = v > b + 0.15 * (this.upT - b);
      for (const r of this.rules(ex.bottom)) {
        if (!r.live || r.screen || rising || this.liveSeen.has(r.id)) continue;
        this.liveCount[r.id] = !m.unsure && r.test(m, lc) ? (this.liveCount[r.id] || 0) + 1 : 0;
        if (this.liveCount[r.id] >= 6) { this.liveSeen.add(r.id); events.push({ type: 'live', faults: [r] }); }
      }
      if (!this.ascentSnap && v >= b + 0.4 * (this.upT - b)) {
        this.ascentSnap = { ...m };
        for (const r of this.rules(ex.ascent)) if (!r.continuous && !r.screen && !m.unsure && !this.liveSeen.has(r.id) && r.test(this.ascentSnap, this.ctx())) { this.liveSeen.add(r.id); events.push({ type: 'live', faults: [r] }); }
      }
      // Continuous drive-up rules are checked on every frame of the way up, not at one moment.
      if (rising) for (const r of this.rules(ex.ascent)) {
        if (r.continuous && !r.screen && !m.unsure && !this.liveSeen.has(r.id) && r.test(m, lc)) { this.liveSeen.add(r.id); events.push({ type: 'live', faults: [r] }); }
      }
      if (v > this.upT) {
        this.phase = 'top';
        this.reps++;
        // Phase durations: top→bottom and bottom→top. Which is "lifting" depends on the exercise.
        const down = (this.tBottom - this.tLeaveTop) / 1000, up = (t - this.tBottom) / 1000;
        this.tempo.push(ex.concentric === 'down' ? { ecc: up, con: down } : { ecc: down, con: up });
        const c = this.ctx();
        const all = [...this.rules(ex.bottom), ...this.rules(ex.ascent)];
        this.repUnsure = !!this.bottomSnap.unsure;
        this.repFaults = [...(this.repUnsure ? [] : this.rules(ex.bottom).filter(r => r.test(this.bottomSnap, c))),
          ...(this.ascentSnap && !this.ascentSnap.unsure ? this.rules(ex.ascent).filter(r => r.test(this.ascentSnap, c)) : [])];
        // Faults caught live during the rep count for the rep even if the bottom snapshot missed them.
        for (const r of all) if (this.liveSeen.has(r.id) && !this.repFaults.includes(r)) this.repFaults.push(r);
        this.repLive = [...this.liveSeen];
        this.repBottom = this.bottomSnap;
        this.pendingTop = true; this.topSnap = { ...m }; this.topFrames = 0; this.tLeaveTop = t;
      }
    }

    // Give ~12 frames at the top to reach full lockout before judging it.
    if (this.pendingTop) {
      if (v > this.topSnap[ex.primary]) { this.topSnap = { ...m }; this.tLeaveTop = t; }
      if (++this.topFrames >= 12 || this.phase === 'bottom') {
        this.pendingTop = false;
        const c = { ...this.ctx(), bottom: this.repBottom };
        const found = [...this.repFaults, ...(this.topSnap.unsure ? [] : this.rules(ex.top).filter(r => r.test(this.topSnap, c)))]
          .sort((a, b) => a.priority - b.priority);
        const faults = found.filter(f => !f.screen), checks = found.filter(f => f.screen), unsure = this.repUnsure;
        faults.forEach(f => { this.faultTally[f.id] = (this.faultTally[f.id] || 0) + 1; });
        checks.forEach(f => { this.checkTally[f.id] = (this.checkTally[f.id] || 0) + 1; });
        if (unsure) this.unsureReps++;
        else if (!faults.length) this.goodReps++;
        const rom = Math.abs(this.topSnap[ex.primary] - this.bottomSnap[ex.primary]);
        this.roms.push({ rom, clean: !faults.length && !unsure });
        events.push({ type: 'rep', reps: this.reps, faults, checks, unsure, live: this.repLive || [], tempo: this.tempo[this.tempo.length - 1], vl: this.velocityLoss(), rom });
      }
    }

    // Continuous faults must persist ~10 frames (~0.33 s) — a "bandwidth" so brief wobbles are ignored.
    for (const r of this.rules(ex.always)) {
      this.alwaysCount[r.id] = !m.unsure && !r.screen && r.test(m, this.ctx()) ? (this.alwaysCount[r.id] || 0) + 1 : 0;
      if (this.alwaysCount[r.id] === 10) {
        this.faultTally[r.id] = (this.faultTally[r.id] || 0) + 1;
        events.push({ type: 'fault', faults: [r] });
      }
    }
    return events;
  }
}

// Reps-in-reserve from velocity loss (approximate, from VBT literature: ~20% loss ≈ half the
// possible reps done; 40%+ ≈ near failure on squats). Used for summaries, not as a hard rule.
export function estimateRIR(vl) {
  if (vl < 0.1) return '3+';
  if (vl < 0.2) return '2–3';
  if (vl < 0.3) return '1–2';
  return '0–1';
}
