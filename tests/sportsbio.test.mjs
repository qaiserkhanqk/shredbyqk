// Sports biomechanics screens: bowling action and landing test, on simulated athletes.
import { analyseBowling, analyseLanding } from '../js/sportsbio.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const P = (x, y) => ({ x, y, v: 1 });
const blank = () => Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0.1 }));

// Side-on right-arm bowler at 240 fps. Front (left) leg lands at t=150 ms, release at t=250 ms.
// kneeAt(t): front-knee angle over time; the arm swings up to its highest point at release.
function bowler({ kneeAt, fps = 240, dur = 400 }) {
  const frames = [];
  for (let i = 0; i * 1000 / fps <= dur; i++) {
    const t = i * 1000 / fps, px = blank();
    const hip = P(300, 300); px[23] = hip; px[24] = P(305, 300);
    px[11] = P(300, 160); px[12] = P(305, 160);
    // Front leg: thigh down-forward, shin angle set by the knee angle. Foot lands (reaches y≈520) at 150 ms.
    const land = Math.min(1, t / 150), kneeDeg = kneeAt(t) * Math.PI / 180;
    const knee = P(hip.x + 60, hip.y + 105 * land + 20 * (1 - land));
    const thighA = Math.atan2(knee.y - hip.y, knee.x - hip.x), shinA = thighA + (Math.PI - kneeDeg);
    px[25] = knee; px[27] = P(knee.x + 115 * Math.cos(shinA), Math.max(knee.y + 115 * Math.sin(shinA), 0));
    px[26] = P(260, 420); px[28] = P(240, 520);
    // Bowling (right) hand: highest above the shoulder at release (250 ms).
    const ph = (t - 250) / 120; px[16] = P(320, 160 - 120 * Math.exp(-ph * ph)); px[15] = P(280, 260);
    frames.push({ t, px });
  }
  return frames;
}
// Make the front ankle land exactly on the ground at contact (set by the knee: the shin points down).
const braced = bowler({ kneeAt: t => (t < 150 ? 170 : 165 + (t - 150) / 100 * 10) });
let r = analyseBowling(braced, { arm: 'R' });
check('finds release at the highest hand position', Math.abs(r.release - 250) < 10, r.release);
check('braced/straightening front leg is good', r.ok && ['braced', 'straightening'].includes(r.frontLeg) && r.findings[0].ok, JSON.stringify(r));
const collapse = bowler({ kneeAt: t => (t < 150 ? 170 : 168 - (t - 150) / 100 * 30) });
r = analyseBowling(collapse, { arm: 'R' });
check('collapsing front knee is flagged with the fix', r.frontLeg === 'collapsing' && !r.findings[0].ok && /drop-and-stick/.test(r.findings[0].detail), JSON.stringify({ leg: r.frontLeg, f: r.kneeFfc, rel: r.kneeRelease }));
const slow = analyseBowling(bowler({ kneeAt: () => 170, fps: 30 }), { arm: 'R' });
check('30 fps video: asks for slow motion', slow.issues.some(x => /slow motion/.test(x)), JSON.stringify(slow.issues));

// From behind: trunk side-bend at release.
function behind(bendDeg) {
  const frames = [];
  for (let i = 0; i < 60; i++) {
    const t = i * 1000 / 240, px = blank(), b = bendDeg * Math.PI / 180 * Math.min(1, i / 40);
    px[23] = P(290, 300); px[24] = P(330, 300);
    const cx = 310 + 140 * Math.sin(b), cy = 300 - 140 * Math.cos(b);
    px[11] = P(cx - 25, cy); px[12] = P(cx + 25, cy);
    px[16] = P(cx + 30, cy - 120 * Math.min(1, i / 40)); px[15] = P(cx - 40, cy + 40);
    frames.push({ t, px });
  }
  return frames;
}
r = analyseBowling(behind(52), { arm: 'R', view: 'back' });
check('high side-bend at release flagged (~52°)', Math.abs(r.sideBend - 52) <= 2 && !r.findings[0].ok, JSON.stringify(r));
r = analyseBowling(behind(35), { arm: 'R', view: 'back' });
check('normal side-bend passes (~35°)', Math.abs(r.sideBend - 35) <= 2 && r.findings[0].ok);
check('no body in view → explains what to fix', analyseBowling([{ t: 0, px: blank() }]).ok === false);

// Landing, front view: drop from a box (feet up, then down), knees caving in by `cave` px on landing.
function landing(caveL, caveR) {
  const frames = [];
  for (let i = 0; i < 90; i++) {
    const t = i * 1000 / 60, px = blank(), air = i < 20 ? 0 : i < 35 ? (i - 20) / 15 : 1; // step off at 20, land at 35
    const lift = i >= 20 && i < 35 ? 80 * Math.sin(Math.PI * (i - 20) / 15) : 0, after = i >= 35 && i < 55;
    px[23] = P(280, 250 - lift); px[24] = P(340, 250 - lift);
    px[25] = P(280 + (after ? caveL : 0), 360 - lift); px[26] = P(340 - (after ? caveR : 0), 360 - lift);
    px[27] = P(280, 470 - lift); px[28] = P(340, 470 - lift);
    frames.push({ t, px });
  }
  return frames;
}
r = analyseLanding(landing(2, 2));
check('clean landing: both knees in line', r.ok && r.landings === 1 && r.findings.every(f => f.ok), JSON.stringify(r));
r = analyseLanding(landing(25, 3));
check('left knee caving in on landing is flagged, with asymmetry', r.L > 10 && r.R <= 10 && r.findings.some(f => /Left knee caves/.test(f.title)) && r.findings.some(f => /differ/.test(f.title)), JSON.stringify({ L: r.L, R: r.R }));
check('no landing → explains how to do it', analyseLanding(landing(0, 0).map(f => ({ ...f, px: f.px.map((p, k) => (k >= 23 ? { ...p, y: 300 + k } : p)) }))).ok === false);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('sportsbio: all pass');
