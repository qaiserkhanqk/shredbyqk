// Exercise library: how to measure each lift, count reps, time them, and which faults to cue.
//
// Cue wording follows motor-learning research (see SCIENCE.md):
//  - External focus of attention (Wulf 2013): cues point at the floor/bench/bar/effect, not muscles.
//  - Each rule has a priority: 1 = safety (joint load), 2 = effectiveness, 3 = refinement.
//    Only ONE cue is given per rep, highest priority first (working-memory limits).
//  - `yes` is the specific praise given when a previously-cued fault is corrected
//    (feedback after good trials improves learning — Chiviacowsky & Wulf 2007).
// Thresholds are starting points from coaching standards; tune with real client footage.
import { angle, fromVertical, dist, bestSide } from './angles.js';

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
  };
}

// Squat: forward lean is a consequence of femur length relative to torso (Fry et al. 2003;
// Demers et al. 2018). Long-femur lifters MUST lean more to keep the bar over mid-foot,
// so the allowed lean scales with their own proportions instead of one number for everyone.
const squatLeanLimit = m => Math.min(60, Math.max(38, 45 + (m.femurTorso - 0.85) * 60));

export const EXERCISES = {
  squat: {
    track: 'hip', name: 'Squat', view: 'either', primary: 'knee', downT: 115, upT: 160, concentric: 'up',
    setup: 'Phone at hip height, side-on to the camera, whole body in frame.',
    metrics(p, view) {
      const m = common(p);
      if (view === 'front') {
        m.kneeGap = dist(p[25], p[26]);
        m.ankleGap = dist(p[27], p[28]);
        m.knee = Math.min(angle(p[23], p[25], p[27]), angle(p[24], p[26], p[28]));
      }
      return m;
    },
    bottom: [
      { id: 'sq_valgus', view: 'front', priority: 1, test: m => m.kneeGap < m.ankleGap * 0.8,
        cue: 'Spread the floor apart with your feet.', yes: 'Yes, knees tracking out. That\'s it.',
        why: 'Knees caving in (valgus) shifts load onto the inner knee ligaments.' },
      { id: 'sq_chest', view: 'side', priority: 2, test: m => m.torsoLean > squatLeanLimit(m),
        cue: 'Show the logo on your shirt to the wall in front.', yes: 'Better, chest stayed proud.',
        why: 'Leaning past what your limb proportions need moves load to the lower back.' },
      { id: 'sq_depth', priority: 3, test: m => m.knee > 105,
        cue: 'Sit down between your heels, a little deeper.', yes: 'Great depth.',
        why: 'Deeper squats train the glutes and quads through a longer range (Kubo 2019).' },
    ],
    top: [
      { id: 'sq_lockout', priority: 3, test: m => m.knee < 165,
        cue: 'Push the floor away and stand tall.', yes: 'Full lockout, nice.',
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
      { id: 'ht_lockout', priority: 3, test: m => m.hip < 165,
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
      return m;
    },
    bottom: [
      { id: 'pu_depth', priority: 3, test: m => m.elbow > 100,
        cue: 'Bring your chest to the floor.', yes: 'Good depth.',
        why: 'Full range trains the chest through its stretched position.' },
    ],
    always: [
      { id: 'pu_sag', priority: 1, test: m => m.line < 160 && m.sag > 0,
        cue: 'Push the floor away and lift your belt buckle.', yes: 'Solid plank. Good.',
        why: 'Sagging hips extend the lower back under load.' },
      { id: 'pu_pike', priority: 2, test: m => m.line < 160 && m.sag < 0,
        cue: 'Make one straight line from head to heels.', yes: 'Straight line, nice.',
        why: 'Piking shortens the range and takes load off the chest.' },
    ],
  },

  rdl: {
    track: 'wr', name: 'Romanian Deadlift', view: 'side', primary: 'hip', downT: 120, upT: 165, concentric: 'up',
    setup: 'Side-on, camera at hip height, whole body in frame.',
    metrics: p => common(p),
    bottom: [
      { id: 'rdl_squat', priority: 2, test: m => m.knee < 135,
        cue: 'Push your hips back to touch the wall behind you.', yes: 'Beautiful hinge.',
        why: 'Too much knee bend turns the hinge into a squat and unloads the hamstrings.' },
    ],
    top: [
      { id: 'rdl_lockout', priority: 3, test: m => m.hip < 168,
        cue: 'Stand tall and bring your hips to the bar.', yes: 'Locked out.',
        why: 'Finishing the hinge completes glute and hamstring contraction.' },
    ],
  },

  lunge: {
    track: 'hip', name: 'Lunge', view: 'side', primary: 'knee', downT: 115, upT: 155, concentric: 'up',
    setup: 'Side-on, camera at hip height. Leave room in frame for the step.',
    metrics(p) {
      const m = common(p);
      m.knee = Math.min(angle(p[23], p[25], p[27]), angle(p[24], p[26], p[28]));
      return m;
    },
    bottom: [
      { id: 'lu_torso', priority: 2, test: m => m.torsoLean > 25,
        cue: 'Stay tall, like a string pulling your head to the ceiling.', yes: 'Tall torso, good.',
        why: 'Excess lean reduces quad loading and stresses the lower back.' },
      { id: 'lu_depth', priority: 3, test: m => m.knee > 105,
        cue: 'Kiss the floor with your back knee.', yes: 'Good depth.',
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
      { id: 'cu_swing', priority: 2, test: m => m.upperArmSwing > 30,
        cue: 'Keep your elbows glued to your ribs.', yes: 'Elbows still. Perfect.',
        why: 'Swinging uses momentum and the shoulders instead of the biceps.' },
    ],
    bottom: [
      { id: 'cu_squeeze', priority: 3, test: m => m.elbow > 55,
        cue: 'Bring the weight all the way to your shoulders.', yes: 'Full squeeze.',
        why: 'Full range of motion maximises the training stimulus.' },
    ],
    top: [
      { id: 'cu_extend', priority: 3, test: m => m.elbow < 150,
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
      return m;
    },
    top: [
      { id: 'pr_even', priority: 2, test: m => m.wristDiff > 0.25,
        cue: 'Push both hands to the ceiling at the same time.', yes: 'Even press. Good.',
        why: 'An uneven press shows a side-to-side strength imbalance.' },
      { id: 'pr_lockout', priority: 3, test: m => m.elbow < 160,
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
      { id: 'row_short', priority: 3, test: m => m.elbow > 85, cue: 'Pull your elbows back past your ribs.', yes: 'Full squeeze. Good.',
        why: 'The mid-back muscles (rhomboids, mid-traps) work hardest at the end of the pull.' },
    ],
    top: [
      { id: 'row_reach', priority: 3, test: m => m.elbow < 150, cue: 'Let your arms reach all the way forward.', yes: 'Full stretch, nice.',
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
      { id: 'vp_short', priority: 3, test: m => m.elbow > 80, cue: 'Drive your elbows down into your back pockets.', yes: 'That\'s a full pull.',
        why: 'Pulling the elbows all the way down fully contracts the lats.' },
      { id: 'vp_even', priority: 2, test: m => m.wristDiff > 0.25, cue: 'Pull both hands down evenly.', yes: 'Even pull, good.',
        why: 'An uneven pull means one side is doing more of the work.' },
    ],
    top: [
      { id: 'vp_hang', priority: 3, test: m => m.elbow < 155, cue: 'Let your arms go fully straight at the top.', yes: 'Full stretch.',
        why: 'The stretched position at the top builds lat length and strength.' },
    ],
  },

  bench: {
    track: 'wr', name: 'Press', view: 'side', primary: 'elbow', downT: 105, upT: 150, concentric: 'up',
    setup: 'Side-on, camera at bench height, about two metres away.',
    metrics: p => common(p),
    bottom: [
      { id: 'bp_depth', priority: 3, test: m => m.elbow > 100, cue: 'Bring the weight all the way down to your chest.', yes: 'Good depth.',
        why: 'Full range loads the chest in its stretched position, where much of the growth comes from.' },
    ],
    top: [
      { id: 'bp_lockout', priority: 3, test: m => m.elbow < 155, cue: 'Press all the way up until your arms are straight.', yes: 'Locked out.',
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
    top: [{ id: 'dip_lockout', priority: 3, test: m => m.elbow < 155, cue: 'Push all the way up and lock out.', yes: 'Locked out.', why: 'Full lockout trains the triceps.' }],
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
      { id: 'fly_bend', priority: 2, test: m => m.elbowBend < 110, cue: 'Keep a soft, fixed bend in your elbows, like hugging a tree.', yes: 'Good arm shape.',
        why: 'Bending the elbows more turns the fly into a press and takes load off the chest.' },
    ],
  },

  triExt: {
    track: 'wr', name: 'Triceps Extension', view: 'side', primary: 'elbow', downT: 95, upT: 155, concentric: 'up',
    setup: 'Side-on, camera at chest height. Shoulder, elbow and hand in frame.',
    metrics(p) { const m = common(p); m.upperArmSwing = fromVertical(m.s.sh, m.s.el); return m; },
    top: [
      { id: 'tri_lockout', priority: 3, test: m => m.elbow < 160, cue: 'Straighten your arm all the way and squeeze.', yes: 'Full lockout.',
        why: 'The triceps are fully shortened at lockout, so finishing the rep matters.' },
    ],
    always: [],
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
      { id: 'raise_low', priority: 3, test: m => m.shoulder < 75, cue: 'Lift your hands up to shoulder height.', yes: 'Right height.',
        why: 'The shoulder muscle does most of its work in the last part of the lift.' },
      { id: 'raise_high', priority: 2, test: m => m.shoulder > 110, cue: 'Stop at shoulder height. No higher.', yes: 'Good height.',
        why: 'Going above shoulder height shifts the work to the upper traps.' },
    ],
    always: [
      { id: 'raise_swing', priority: 2, test: m => m.torsoLean > 15, cue: 'Stand tall. Lift with your shoulders, not momentum.', yes: 'Strict reps. Nice.',
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
      { id: 'calf_high', priority: 3, test: m => m.lift < 0.35, cue: 'Push up higher onto the balls of your feet, and pause.', yes: 'Full height.',
        why: 'The calves are strongest at the top. A one-second pause removes bounce.' },
    ],
  },

  torsoCurl: {
    track: 'sh', name: 'Crunch', view: 'side', primary: 'torsoAngle', downT: 72, upT: 82, concentric: 'down',
    setup: 'Lying side-on to the camera, camera on the floor about two metres away.',
    metrics(p) { const m = common(p); m.torsoAngle = fromVertical(m.s.hip, m.s.sh); return m; },
    bottom: [
      { id: 'cr_short', priority: 3, test: m => m.torsoAngle > 68, cue: 'Curl your ribs towards your hips.', yes: 'Good crunch.',
        why: 'The abs flex the spine. Curling, not just lifting the head, is what trains them.' },
    ],
  },

  legRaise: {
    track: 'an', name: 'Leg Raise', view: 'side', primary: 'hipLine', downT: 125, upT: 160, concentric: 'down',
    setup: 'Side-on to the camera, whole body in frame.',
    metrics(p) { const m = common(p); m.hipLine = angle(m.s.sh, m.s.hip, m.s.an); return m; },
    bottom: [
      { id: 'lr_high', priority: 3, test: m => m.hipLine > 115, cue: 'Lift your legs up to ninety degrees.', yes: 'Good height.',
        why: 'Lifting higher makes the lower abs curl the pelvis, not just the hip flexors.' },
    ],
  },

  kneeExt: {
    track: 'an', name: 'Leg Extension', view: 'side', primary: 'knee', downT: 110, upT: 160, concentric: 'up',
    setup: 'Side-on to the camera, hip, knee and ankle in frame.',
    metrics: p => common(p),
    top: [{ id: 'ke_lockout', priority: 3, test: m => m.knee < 165, cue: 'Straighten your legs fully and squeeze your quads.', yes: 'Full squeeze.', why: 'The quads are fully contracted only at full knee extension.' }],
  },

  kneeFlex: {
    track: 'an', name: 'Leg Curl', view: 'side', primary: 'knee', downT: 95, upT: 150, concentric: 'down',
    setup: 'Side-on to the camera, hip, knee and ankle in frame.',
    metrics: p => common(p),
    bottom: [{ id: 'kf_short', priority: 3, test: m => m.knee > 85, cue: 'Curl your heels all the way towards your glutes.', yes: 'Full curl.', why: 'Hamstrings are trained best through their full range.' }],
    top: [{ id: 'kf_extend', priority: 3, test: m => m.knee < 150, cue: 'Let your legs straighten fully between reps.', yes: 'Full stretch.', why: 'The stretched position builds the most hamstring strength.' }],
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
      { id: 'pl_sag', priority: 1, test: m => m.line < 162 && m.sag > 0, cue: 'Lift your hips. Squeeze your glutes and brace like someone\'s about to poke your stomach.', yes: 'Solid. Hold it.',
        why: 'Sagging hips put the load on your lower back instead of your core.' },
      { id: 'pl_pike', priority: 2, test: m => m.line < 162 && m.sag < 0, cue: 'Lower your hips into one straight line.', yes: 'Straight line, good.',
        why: 'Piking the hips up makes the plank much easier for the abs.' },
    ],
  },
};

export const allRules = ex => [...(ex.bottom || []), ...(ex.top || []), ...(ex.always || [])];

/**
 * Rep counter, fault detector and tempo/fatigue tracker.
 * Feed it smoothed metrics + a timestamp (ms) every frame; it returns events.
 */
export class RepEngine {
  constructor(ex, view) {
    this.ex = ex; this.view = view;
    this.phase = 'top'; this.reps = 0; this.goodReps = 0;
    this.bottomSnap = null; this.topSnap = null; this.alwaysCount = {};
    this.faultTally = {}; this.tempo = []; // [{ecc, con}] seconds per rep
    this.tLeaveTop = null; this.tBottom = null; this.roms = [];
  }

  rules(list) { return (list || []).filter(r => !r.view || r.view === this.view); }

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
      if (v < ex.downT) { this.phase = 'bottom'; this.bottomSnap = { ...m }; this.tBottom = t; }
    } else {
      if (v < this.bottomSnap[ex.primary]) { this.bottomSnap = { ...m }; this.tBottom = t; }
      if (v > ex.upT) {
        this.phase = 'top';
        this.reps++;
        // Phase durations: top→bottom and bottom→top. Which is "lifting" depends on the exercise.
        const down = (this.tBottom - this.tLeaveTop) / 1000, up = (t - this.tBottom) / 1000;
        this.tempo.push(ex.concentric === 'down' ? { ecc: up, con: down } : { ecc: down, con: up });
        this.repFaults = this.rules(ex.bottom).filter(r => r.test(this.bottomSnap));
        this.pendingTop = true; this.topSnap = { ...m }; this.topFrames = 0; this.tLeaveTop = t;
      }
    }

    // Give ~12 frames at the top to reach full lockout before judging it.
    if (this.pendingTop) {
      if (v > this.topSnap[ex.primary]) { this.topSnap = { ...m }; this.tLeaveTop = t; }
      if (++this.topFrames >= 12 || this.phase === 'bottom') {
        this.pendingTop = false;
        const faults = [...this.repFaults, ...this.rules(ex.top).filter(r => r.test(this.topSnap))]
          .sort((a, b) => a.priority - b.priority);
        faults.forEach(f => { this.faultTally[f.id] = (this.faultTally[f.id] || 0) + 1; });
        if (!faults.length) this.goodReps++;
        const rom = Math.abs(this.topSnap[ex.primary] - this.bottomSnap[ex.primary]);
        this.roms.push({ rom, clean: !faults.length });
        events.push({ type: 'rep', reps: this.reps, faults, tempo: this.tempo[this.tempo.length - 1], vl: this.velocityLoss(), rom });
      }
    }

    // Continuous faults must persist ~15 frames (~0.5 s) — a "bandwidth" so brief wobbles are ignored.
    for (const r of this.rules(ex.always)) {
      this.alwaysCount[r.id] = r.test(m) ? (this.alwaysCount[r.id] || 0) + 1 : 0;
      if (this.alwaysCount[r.id] === 15) {
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
