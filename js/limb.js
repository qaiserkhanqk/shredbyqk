// Phone-on-the-limb measurements: the phone's own motion sensor used as a digital inclinometer.
// Published studies put a phone held on the limb close to a physio's goniometer for the knee
// (ICC about 0.8–0.99), which is better than a single camera. So any number that decides a phase change
// should come from here when the person can do it; the camera stays for screening and movement quality.
//
// How it works: the accelerometer reports gravity in the phone's own axes. Holding the phone flat on a body
// segment, the angle between two gravity readings is how far that segment (or the next one) turned.
// Only the ANGLE BETWEEN readings is used, so it doesn't matter that iOS and Android report gravity with
// opposite signs, or which way round the phone is, as long as it sits the same way for each reading.

const DEG = 180 / Math.PI;
const len = g => Math.hypot(g.x, g.y, g.z);

/** Angle in degrees between two gravity vectors {x,y,z}. */
export function angleBetween(a, b) {
  const la = len(a), lb = len(b);
  if (!la || !lb) return NaN;
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

/** How far the phone's long edge leans from vertical (0° = upright, 90° = lying flat or sideways). */
export function tiltFromVertical(g) {
  const l = len(g);
  return l ? Math.acos(Math.min(1, Math.abs(g.y) / l)) * DEG : NaN;
}

/**
 * A steady reading: the average of the last `ms` of samples, if every sample in that window is within
 * `tol` degrees of the average. Otherwise null (the limb is still moving).
 * samples: [{ t: ms, x, y, z }], oldest first.
 */
export function steadyReading(samples, { ms = 1000, tol = 1.5, minSamples = 8 } = {}) {
  if (!samples.length) return null;
  const end = samples[samples.length - 1].t;
  if (end - samples[0].t < ms) return null;
  const win = samples.filter(s => s.t >= end - ms);
  if (win.length < minSamples) return null;
  const m = { x: 0, y: 0, z: 0 };
  for (const s of win) { m.x += s.x; m.y += s.y; m.z += s.z; }
  m.x /= win.length; m.y /= win.length; m.z /= win.length;
  // Gravity should be about 9.8 m/s². Much more or less means the phone is being moved, not held.
  if (Math.abs(len(m) - 9.81) > 1.5) return null;
  return win.every(s => angleBetween(s, m) <= tol) ? m : null;
}

/**
 * Is the phone being moved right now? True when, in the last `ms`, the readings swing more than `tol` degrees
 * or gravity jumps away from 1 g (the phone is being lifted or carried). Used to know the person has moved the
 * phone to the next position, so the same position can't be captured twice.
 */
export function isMoving(samples, { ms = 400, tol = 4 } = {}) {
  if (samples.length < 3) return false;
  const end = samples[samples.length - 1].t, win = samples.filter(s => s.t >= end - ms);
  return win.some(s => Math.abs(len(s) - 9.81) > 1.2 || angleBetween(s, win[0]) > tol);
}

const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };

/**
 * Tests the phone can measure. Ids match ROM_TESTS, so results feed the same phase checks and report.
 * Each test is a list of positions; the phone takes one steady reading per position, and `compute`
 * turns the readings of one try into a value. Every test is done 3 times and the median is kept.
 */
export const SENSOR_TESTS = {
  kneeFlexion: {
    name: 'Knee bend', unit: '°', where: 'leg',
    steps: [
      { say: 'Bend your knee as far as you comfortably can and keep it there. Hold the phone flat on the front of your THIGH, top of the phone pointing to your knee. Hold still.' },
      { say: 'Keep the knee bent. Move the phone to the front of your SHIN, top still pointing towards your foot. Hold still.' },
    ],
    compute: ([thigh, shin]) => angleBetween(thigh, shin),
  },
  kneeExtension: {
    name: 'Knee straightening', unit: '° short of straight', where: 'leg',
    steps: [
      { say: 'Sit with your leg out in front and straighten the knee as much as you comfortably can. Hold the phone flat on the front of your THIGH, top pointing to your knee. Hold still.' },
      { say: 'Keep the knee straight. Move the phone to the front of your SHIN, top still pointing towards your foot. Hold still.' },
    ],
    compute: ([thigh, shin]) => angleBetween(thigh, shin),
  },
  ankleDorsiflexion: {
    name: 'Knee-to-wall ankle bend', unit: '° shin angle', where: 'leg',
    steps: [
      { say: 'Stand facing a wall in a lunge, test foot in front. Push the knee forward over the toes as far as you comfortably can, heel down. Hold the phone flat on the front of your shin, top pointing up. Hold still.' },
    ],
    compute: ([shin]) => tiltFromVertical(shin),
  },
  shoulderFlexion: {
    name: 'Shoulder forward raise', unit: '°', where: 'arm',
    steps: [
      { say: 'Let the arm hang by your side. Hold the phone flat against the outside of your upper arm, top pointing up to the shoulder. Hold still.' },
      { say: 'Keep the phone on your upper arm and raise the straight arm FORWARD and up as high as you comfortably can. Hold still.' },
    ],
    compute: ([down, up]) => angleBetween(down, up),
  },
  shoulderAbduction: {
    name: 'Shoulder side raise', unit: '°', where: 'arm',
    steps: [
      { say: 'Let the arm hang by your side. Hold the phone flat against the front of your upper arm, top pointing up to the shoulder. Hold still.' },
      { say: 'Keep the phone on your upper arm and raise the straight arm OUT TO THE SIDE and up as high as you comfortably can. Hold still.' },
    ],
    compute: ([down, up]) => angleBetween(down, up),
  },
};

export const TRIES = 3;

/**
 * Combine the tries of one test. tries: [[reading, reading, …], …].
 * Returns { ok, value, trials, spread, issues }. A spread of more than 6° between tries means the
 * positions weren't repeated the same way; the result is kept but marked less certain.
 */
export function sensorResult(id, tries) {
  const t = SENSOR_TESTS[id];
  if (!t) throw new Error('Unknown sensor test ' + id);
  const vals = tries.map(r => t.compute(r)).filter(Number.isFinite).map(v => Math.round(v * 10) / 10);
  if (!vals.length) return { ok: false, issues: ['No steady reading. Hold the phone flat on the limb and keep still for a second.'] };
  const spread = Math.round((Math.max(...vals) - Math.min(...vals)) * 10) / 10;
  const issues = spread > 6 ? [`Your ${vals.length} tries differed by ${spread}°, so this result is less certain. Repeat it the same way each time.`] : [];
  return { ok: true, test: id, unit: t.unit, value: Math.round(median(vals) * 10) / 10, trials: vals, spread, method: 'sensor', issues };
}

/**
 * Start listening to gravity readings. Calls onSample({t, x, y, z}).
 * Returns a stop function, or throws 'sensor_denied' / 'sensor_unavailable'.
 * On iOS, permission must be requested from a tap, so call this from a click handler.
 */
export async function listenGravity(onSample) {
  const DM = globalThis.DeviceMotionEvent;
  if (!DM) throw new Error('sensor_unavailable');
  if (typeof DM.requestPermission === 'function') {
    const res = await DM.requestPermission().catch(() => 'denied');
    if (res !== 'granted') throw new Error('sensor_denied');
  }
  const h = e => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    onSample({ t: performance.now(), x: g.x, y: g.y, z: g.z });
  };
  window.addEventListener('devicemotion', h);
  return () => window.removeEventListener('devicemotion', h);
}
