/**
 * Barbell Back Squat tracker for MediaPipe Pose (33 landmarks). Runs fully on-device.
 *
 * Feed it one pose per video frame: `tracker.update(landmarks, timestampMs, worldLandmarks?)`.
 * It returns the current state and emits events when a rep completes.
 *
 * Pipeline per frame:
 *   1. Visibility gate:   ignore frames where the needed joints are not confidently seen.
 *   2. Joint angles:      knee angle from Hip→Knee→Ankle vectors (3D world coords if given, else 2D).
 *   3. Smoothing:         One Euro filter (low lag when moving, strong smoothing when still).
 *   4. State machine:     STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING = 1 rep,
 *                         with hysteresis + frame debouncing so jitter can't double-count.
 *   5. Form checks:       depth (side view) and knee valgus (front view), judged per rep.
 */

// ---------------------------------------------------------------- types

export interface Landmark { x: number; y: number; z: number; visibility?: number; }
export interface Vec3 { x: number; y: number; z: number; }

export const Phase = { Standing: 'STANDING', Descending: 'DESCENDING', Bottom: 'BOTTOM', Ascending: 'ASCENDING' } as const;
export type Phase = typeof Phase[keyof typeof Phase];
export type View = 'side' | 'front' | 'unknown';

export interface SquatConfig {
  standingAngle: number;      // knee ≥ this = standing (rep can finish here)
  descentStartAngle: number;  // knee < this = descent has started (hysteresis gap vs standingAngle)
  depthAngle: number;         // min knee angle must be ≤ this for "full depth"
  bottomReboundDeg: number;   // knee must rise this far above the rep's minimum to count as ascending
  confirmFrames: number;      // consecutive frames a transition must hold (debounce)
  minVisibility: number;      // MediaPipe visibility needed on hip/knee/ankle
  valgusRatioDrop: number;    // knee gap may fall to this fraction of the standing baseline before flagging
  valgusFrames: number;       // frames the cave must persist to count (ignores single-frame noise)
  minRepMs: number;           // faster than this is noise, not a rep
  maxRepMs: number;           // slower than this: reset (user walked away / paused mid-rep)
  imageAspect: number;        // width / height of the video, to un-squash normalized x
}

export const DEFAULT_CONFIG: SquatConfig = {
  standingAngle: 160,
  descentStartAngle: 145,
  depthAngle: 90,
  bottomReboundDeg: 10,
  confirmFrames: 3,
  minVisibility: 0.6,
  valgusRatioDrop: 0.8,
  valgusFrames: 4,
  minRepMs: 600,
  maxRepMs: 12000,
  imageAspect: 16 / 9,
};

export interface RepResult {
  rep: number;
  minKneeAngle: number;
  depthOk: boolean | null;        // null = not assessable from this camera view
  valgus: boolean | null;         // null = not assessable from this camera view
  minKneeToAnkleRatio: number | null;
  eccentricMs: number;            // standing → bottom
  concentricMs: number;           // bottom → standing
  view: View;
}

export interface FrameResult {
  phase: Phase;
  kneeAngle: number | null;       // smoothed, degrees
  reps: number;
  view: View;
  tracking: boolean;              // false when the visibility gate rejected this frame
  repCompleted?: RepResult;
}

// MediaPipe Pose landmark indices
export const LM = { L_SHOULDER: 11, R_SHOULDER: 12, L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28 } as const;

// ---------------------------------------------------------------- geometry

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3) => Math.sqrt(dot(a, a));

/**
 * Interior angle at vertex B formed by points A–B–C, in degrees.
 *   BA = A − B,  BC = C − B
 *   θ = arccos( (BA · BC) / (|BA| |BC|) )
 * Knee angle = angleAt(hip, knee, ankle): ~180° standing tall, ~90° thighs roughly parallel.
 * Returns NaN for degenerate input (zero-length segment).
 */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  const ba = sub(a, b), bc = sub(c, b);
  const denom = norm(ba) * norm(bc);
  if (denom < 1e-9) return NaN;
  const cos = Math.min(1, Math.max(-1, dot(ba, bc) / denom)); // clamp float error before acos
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Normalized image landmarks have x and y scaled to different pixel lengths (x by width,
 * y by height). Rescale x by the aspect ratio so 2D angles are not distorted.
 * The image-space z is too noisy for angles, so 2D mode drops it (z = 0).
 */
const to2D = (p: Landmark, aspect: number): Vec3 => ({ x: p.x * aspect, y: p.y, z: 0 });

// ---------------------------------------------------------------- One Euro filter
// Casiez et al. 2012. Adaptive low-pass: cutoff rises with speed, so fast movement has
// little lag while a held position is strongly de-jittered. Standard choice for pose data.

class LowPass { private y: number | null = null; filter(x: number, a: number) { this.y = this.y === null ? x : a * x + (1 - a) * this.y; return this.y; } last() { return this.y; } reset() { this.y = null; } }

export class OneEuroFilter {
  private x = new LowPass(); private dx = new LowPass(); private tPrev: number | null = null;
  private minCutoff: number; private beta: number; private dCutoff: number;
  /** minCutoff (Hz): jitter removal when still. beta: how fast the cutoff rises with speed (less lag). */
  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; }
  private alpha(cutoff: number, dt: number) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(value: number, tMs: number): number {
    if (this.tPrev === null) { this.tPrev = tMs; this.dx.filter(0, 1); return this.x.filter(value, 1); }
    const dt = Math.max(1e-3, (tMs - this.tPrev) / 1000); this.tPrev = tMs;
    const prev = this.x.last() ?? value;
    const edx = this.dx.filter((value - prev) / dt, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, this.alpha(cutoff, dt));
  }
  reset() { this.x.reset(); this.dx.reset(); this.tPrev = null; }
}

// ---------------------------------------------------------------- tracker

export class SquatTracker {
  readonly cfg: SquatConfig;
  private phase: Phase = Phase.Standing;
  private reps = 0;
  private pending: { phase: Phase; frames: number } | null = null;
  private angleFilter = new OneEuroFilter();
  private ratioFilter = new OneEuroFilter(1.0, 0.01);

  // per-rep accumulators
  private repStartMs = 0; private bottomMs = 0;
  private minAngle = Infinity;
  private baselineRatio: number | null = null; // knee gap / ankle gap while standing (personal stance)
  private minRatio = Infinity;
  private cavedFrames = 0; private caved = false;
  private viewVotes = { side: 0, front: 0 };

  constructor(cfg: Partial<SquatConfig> = {}) { this.cfg = { ...DEFAULT_CONFIG, ...cfg }; }

  reset(): void {
    this.phase = Phase.Standing; this.reps = 0; this.pending = null;
    this.angleFilter.reset(); this.ratioFilter.reset(); this.baselineRatio = null; this.thighLen = 0; this.shinLen = 0; this.thighS = 0; this.shinS = 0; this.lastTopMs = 0; this.topAngle = 0; this.resetRep(0);
  }

  /**
   * @param lm      33 normalized image landmarks (results.landmarks[0])
   * @param tMs     frame timestamp in ms (monotonic)
   * @param world   optional 33 world landmarks in metres (results.worldLandmarks[0]); gives true 3D angles
   */
  update(lm: Landmark[], tMs: number, world?: Landmark[]): FrameResult {
    const c = this.cfg;
    const visible = (i: number) => (lm[i]?.visibility ?? 1) >= c.minVisibility;

    // Use the leg the camera sees best (side view hides the far leg).
    const leftVis = [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE].reduce((s, i) => s + (lm[i]?.visibility ?? 1), 0);
    const rightVis = [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE].reduce((s, i) => s + (lm[i]?.visibility ?? 1), 0);
    const [hipI, kneeI, ankleI] = leftVis >= rightVis ? [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE] : [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE];

    const view = this.detectView(lm);
    if (![hipI, kneeI, ankleI].every(visible)) {
      return { phase: this.phase, kneeAngle: null, reps: this.reps, view, tracking: false };
    }

    // 1) knee angle
    //   a) 3D world landmarks (metres): true angle from any camera position — preferred.
    //   b) side view, 2D: the leg moves in the image plane, so the 2D angle is accurate.
    //   c) front view, 2D: the leg moves TOWARD the camera, so the 2D angle barely changes.
    //      Estimate it from foreshortening instead (see frontalKneeAngle).
    if (world) this.usedWorld = true;
    const P = (i: number): Vec3 => (world ? world[i] : to2D(lm[i], c.imageAspect));
    this.calibrateSegments(lm);
    const raw = !world && view === 'front' ? this.frontalKneeAngle(lm) : angleAt(P(hipI), P(kneeI), P(ankleI));
    if (Number.isNaN(raw)) return { phase: this.phase, kneeAngle: null, reps: this.reps, view, tracking: false };
    const knee = this.angleFilter.filter(raw, tMs);

    // 2) knee-to-ankle width ratio (front view only)
    const ratio = view === 'front' ? this.kneeAnkleRatio(lm) : null;
    const sRatio = ratio === null ? null : this.ratioFilter.filter(ratio, tMs);

    // 3) state machine — thresholds are relative to THIS lifter's own standing angle (learned live),
    //    capped by the configured absolutes. Handles slightly bent / hyper-extended knees and front-view compression.
    // While standing, follow the current standing angle (settles within ~1 s, discards start-up spikes);
    // during a rep it only ratchets up, so the lifter's own descent can't drag the threshold down.
    this.topAngle = this.phase === Phase.Standing ? Math.max(knee, this.topAngle - 0.3) : Math.max(this.topAngle, knee);
    const standT = Math.min(c.standingAngle, this.topAngle - 12);
    const descentT = Math.min(c.descentStartAngle, this.topAngle - 25);
    let completed: RepResult | undefined;
    switch (this.phase) {
      case Phase.Standing:
        // Keep learning this person's stance width while they stand.
        if (knee >= standT) this.lastTopMs = tMs; // the rep starts when they leave the top, not when we confirm it
        if (sRatio !== null && knee >= standT) this.baselineRatio = this.baselineRatio === null ? sRatio : 0.9 * this.baselineRatio + 0.1 * sRatio;
        if (this.confirm(knee < descentT, Phase.Descending)) { this.resetRep(this.lastTopMs || tMs); this.phase = Phase.Descending; }
        break;
      case Phase.Descending:
        this.track(knee, sRatio, tMs);
        // Bottom reached: the knee has stopped closing and opened slightly past the deepest point.
        if (this.confirm(knee > this.minAngle + 2 && this.minAngle < descentT - 15, Phase.Bottom)) this.phase = Phase.Bottom;
        else if (this.confirm(knee >= standT, Phase.Standing)) this.phase = Phase.Standing; // aborted dip, no rep
        break;
      case Phase.Bottom:
        this.track(knee, sRatio, tMs); // keeps updating minAngle if they sink lower (pause squats, bounce)
        if (this.confirm(knee > this.minAngle + c.bottomReboundDeg, Phase.Ascending)) this.phase = Phase.Ascending;
        break;
      case Phase.Ascending:
        this.track(knee, sRatio, tMs);
        if (this.confirm(knee >= standT, Phase.Standing)) {
          const dur = tMs - this.repStartMs;
          if (dur >= c.minRepMs && dur <= c.maxRepMs) completed = this.finishRep(tMs);
          this.phase = Phase.Standing;
        }
        break;
    }
    // Reset a rep that stalls too long (user racked the bar or walked out of frame mid-rep).
    if (this.phase !== Phase.Standing && tMs - this.repStartMs > c.maxRepMs) { this.phase = Phase.Standing; this.pending = null; }

    return { phase: this.phase, kneeAngle: knee, reps: this.reps, view, tracking: true, repCompleted: completed };
  }

  // ------------------------------------------------------------ internals

  /** Debounce: a transition fires only after `confirmFrames` consecutive frames agree. */
  private confirm(condition: boolean, target: Phase): boolean {
    if (!condition) { if (this.pending?.phase === target) this.pending = null; return false; }
    if (this.pending?.phase !== target) this.pending = { phase: target, frames: 0 };
    if (++this.pending.frames >= this.cfg.confirmFrames) { this.pending = null; return true; }
    return false;
  }

  private track(knee: number, ratio: number | null, tMs: number) {
    if (knee < this.minAngle) { this.minAngle = knee; this.bottomMs = tMs; }
    if (ratio !== null && this.baselineRatio !== null) {
      this.minRatio = Math.min(this.minRatio, ratio);
      // Valgus: knee gap shrinks relative to ankle gap compared with this lifter's own standing stance.
      const cavingNow = ratio < this.baselineRatio * this.cfg.valgusRatioDrop;
      this.cavedFrames = cavingNow ? this.cavedFrames + 1 : 0;
      if (this.cavedFrames >= this.cfg.valgusFrames) this.caved = true;
    }
    const v = this.lastView; if (v !== 'unknown') this.viewVotes[v]++;
  }

  private finishRep(tMs: number): RepResult {
    this.reps++;
    const view: View = this.viewVotes.side >= this.viewVotes.front ? 'side' : 'front';
    // Depth from a straight-on front view is unreliable (thigh is foreshortened), so only judge it side-on
    // unless 3D world landmarks were supplied.
    const depthJudgeable = view === 'side' || this.usedWorld;
    const valgusJudgeable = this.viewVotes.front > 0 && this.baselineRatio !== null && Number.isFinite(this.minRatio);
    return {
      rep: this.reps,
      minKneeAngle: Math.round(this.minAngle),
      depthOk: depthJudgeable ? this.minAngle <= this.cfg.depthAngle : null,
      valgus: valgusJudgeable ? this.caved : null,
      minKneeToAnkleRatio: valgusJudgeable ? +this.minRatio.toFixed(2) : null,
      eccentricMs: Math.round(this.bottomMs - this.repStartMs),
      concentricMs: Math.round(tMs - this.bottomMs),
      view,
    };
  }

  private resetRep(tMs: number) {
    this.repStartMs = tMs; this.bottomMs = tMs; this.minAngle = Infinity;
    this.minRatio = Infinity; this.cavedFrames = 0; this.caved = false; this.viewVotes = { side: 0, front: 0 };
  }

  private lastView: View = 'unknown';
  private lastTopMs = 0;
  private topAngle = 0; // highest smoothed knee angle seen = this lifter's 'standing tall'
  private usedWorld = false;

  /** Shoulder width relative to torso length: wide = facing camera, narrow = side-on. */
  private detectView(lm: Landmark[]): View {
    const shW = Math.abs(lm[LM.L_SHOULDER].x - lm[LM.R_SHOULDER].x) * this.cfg.imageAspect;
    const midSh = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2, midHip = (lm[LM.L_HIP].y + lm[LM.R_HIP].y) / 2;
    const torso = Math.abs(midHip - midSh);
    if (torso < 1e-6) return (this.lastView = 'unknown');
    const r = shW / torso;
    return (this.lastView = r > 0.55 ? 'front' : r < 0.35 ? 'side' : 'unknown');
  }

  /** |kneeL.x − kneeR.x| / |ankleL.x − ankleR.x| — < 1 means knees are inside the feet. */
  private kneeAnkleRatio(lm: Landmark[]): number | null {
    const ids = [LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];
    if (!ids.every(i => (lm[i]?.visibility ?? 1) >= this.cfg.minVisibility)) return null;
    const ankleGap = Math.abs(lm[LM.L_ANKLE].x - lm[LM.R_ANKLE].x);
    if (ankleGap < 0.02) return null; // feet too close together to measure a meaningful ratio
    return Math.abs(lm[LM.L_KNEE].x - lm[LM.R_KNEE].x) / ankleGap;
  }

  // Longest thigh/shin seen on screen. Standing tall, the segments are vertical, so these are their true lengths.
  private thighLen = 0; private shinLen = 0; private thighS = 0; private shinS = 0;
  private calibrateSegments(lm: Landmark[]) {
    const vis = [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE].every(i => (lm[i]?.visibility ?? 1) >= this.cfg.minVisibility);
    if (!vis) return;
    const thigh = (Math.abs(lm[LM.L_KNEE].y - lm[LM.L_HIP].y) + Math.abs(lm[LM.R_KNEE].y - lm[LM.R_HIP].y)) / 2;
    const shin = (Math.abs(lm[LM.L_ANKLE].y - lm[LM.L_KNEE].y) + Math.abs(lm[LM.R_ANKLE].y - lm[LM.R_KNEE].y)) / 2;
    // Smooth before taking the max: the max of raw noisy samples overshoots the true length, and arccos
    // is very sensitive near 1, so a 2% overshoot would read as ~11° of fake knee bend while standing.
    this.thighS = this.thighS ? 0.8 * this.thighS + 0.2 * thigh : thigh;
    this.shinS = this.shinS ? 0.8 * this.shinS + 0.2 * shin : shin;
    this.thighLen = Math.max(this.thighLen, this.thighS); this.shinLen = Math.max(this.shinLen, this.shinS);
  }

  /**
   * Front-view knee angle from foreshortening. A segment of true length L tilted φ from vertical
   * (toward/away from the camera) appears with vertical length L·cos φ, so φ = arccos(observed / L).
   * In a squat the thigh tilts forward by φ and the shin by ψ, and knee angle = 180° − (φ + ψ).
   * Needs one standing frame first to learn L. Accuracy is typically within ~10°: enough to count reps
   * and see depth trends, but judge depth from a side view or with world landmarks.
   */
  private frontalKneeAngle(lm: Landmark[]): number {
    if (this.thighLen <= 0 || this.shinLen <= 0) return NaN;
    const thigh = this.thighS, shin = this.shinS;
    const phi = Math.acos(Math.min(1, thigh / this.thighLen)), psi = Math.acos(Math.min(1, shin / this.shinLen));
    return 180 - ((phi + psi) * 180) / Math.PI;
  }

  /** Call once if you pass world landmarks, so depth can be judged from any camera angle. */
  useWorldLandmarks(on = true) { this.usedWorld = on; }
}
