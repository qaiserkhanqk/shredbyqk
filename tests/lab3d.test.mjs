// 3D Lab: a synthetic athlete with known 3D angles, "filmed" by two virtual cameras (side + front, different
// resolutions, zoom and placement, the front camera started 0.5 s late, with pixel jitter). The lab must find the
// sync and recover the true angles.
import { reconstruct, reconstructMulti, syncAll, motionLag, resample, clapTime, measure, report, toCSV, summary, facingSign, LANDMARK as L } from '../js/lab3d.js';
import { pose, film, demoVideos4 } from '../js/lab-demo.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const side = film('side', { W: 1920, H: 1080, ppm: 420 });
const front = film('front', { W: 1080, H: 1920, ppm: 600, t0: 0.5 }); // started recording 0.5 s later → its clock reads 0.5 s less
check('side view: facing direction found', facingSign(side) === 1);
const lag = motionLag(resample(side, 60), resample(front, 60), { hz: 60 });
check(`sync: motion match finds the 0.5 s offset (found ${lag.lag.toFixed(3)} s, match ${lag.r.toFixed(2)})`, Math.abs(lag.lag - 0.5) <= 1 / 60 + 1e-9 && lag.r > 0.95);

const rec = reconstruct(side, front, { heightM: 1.75, sideW: 1920, sideH: 1080, frontW: 1080, frontH: 1920, lag: lag.lag });
check('reconstruct: overlapping frames at 60 Hz', rec.frames.length > 300 && rec.info.hz === 60);
const errs = rec.frames.map(f => { const truth = pose(f.t + 0).k; const m = measure(f.P); return Math.max(Math.abs(m.kneeL - truth), Math.abs(m.kneeR - truth)); });
const mae = errs.reduce((a, b) => a + b, 0) / errs.length;
check(`3D knee bend matches the truth (mean error ${mae.toFixed(1)}°, worst ${Math.max(...errs).toFixed(1)}°)`, mae < 3 && Math.max(...errs) < 8);

// A pose with both knees moving in: the front view sees it; the 3D angle reports it as valgus.
const vS = film('side', { W: 1920, H: 1080, ppm: 420, opts: { valgus: 1 } }), vF = film('front', { W: 1080, H: 1920, ppm: 600, opts: { valgus: 1 } });
const vRec = reconstruct(vS, vF, { heightM: 1.75, sideW: 1920, sideH: 1080, frontW: 1080, frontH: 1920 });
const vRep = report(vRec, { preset: 'squat' });
check('squat report: deepest point found', vRep.key?.label === 'Deepest point' && Math.abs(vRep.rows.find(r => r.key === 'kneeL').at - 100) < 6, JSON.stringify(vRep.rows.find(r => r.key === 'kneeL')));
const valgAt = Math.max(vRep.rows.find(r => r.key === 'valgusL').at, vRep.rows.find(r => r.key === 'valgusR').at);
check(`knee alignment: valgus seen at the bottom (${valgAt.toFixed(0)}°) and flagged`, valgAt > 5 && vRep.flags.some(f => /Knees moving in/.test(f)), JSON.stringify(vRep.flags));
const plain = report(rec, { preset: 'squat' });
check('knee alignment: straight knees are not flagged', !plain.flags.some(f => /Knees moving in/.test(f)), JSON.stringify(plain.flags));

// Rotation only shows in 3D: shoulders twisting ±30° over still hips.
const tS = film('side', { W: 1920, H: 1080, ppm: 420, opts: { twist: 30 } }), tF = film('front', { W: 1080, H: 1920, ppm: 600, opts: { twist: 30 } });
const tRec = reconstruct(tS, tF, { heightM: 1.75, sideW: 1920, sideH: 1080, frontW: 1080, frontH: 1920 });
const seps = tRec.frames.map(f => measure(f.P).separation), sepRange = Math.max(...seps) - Math.min(...seps);
check(`rotation: hip–shoulder separation range ≈ 60° (found ${sepRange.toFixed(0)}°)`, Math.abs(sepRange - 60) < 8);

// Bowling report: release found, elbow and counter-rotation lines present, framed as screening.
const bRep = report(tRec, { preset: 'bowling', bowlArm: 'R' });
check('bowling report: release, elbow vs the ICC 15° line (screening only), counter-rotation', bRep.key?.label.startsWith('Ball release') && bRep.flags.some(f => /15°/.test(f) && /Screening only/.test(f)) && bRep.flags.some(f => /counter-rotation/.test(f)));

// Left–right asymmetry.
const aS = film('side', { W: 1920, H: 1080, ppm: 420 }), aF = film('front', { W: 1080, H: 1920, ppm: 600 });
const aRec = reconstruct(aS, aF, { heightM: 1.75, sideW: 1920, sideH: 1080, frontW: 1080, frontH: 1920 });
aRec.frames.forEach(f => { f.P[L.lKn] = { ...f.P[L.lKn], z: f.P[L.lKn].z * 0.6 }; }); // left knee bends less
check('asymmetry: a 10°+ left–right difference is flagged', report(aRec, { preset: 'squat' }).flags.some(f => /difference between left and right/.test(f)));

// Clap sync from audio, and errors.
const rate = 8000, audio = new Float32Array(rate * 5).map(() => (Math.random() - 0.5) * 0.01); for (let i = 0; i < 400; i++) audio[Math.floor(rate * 1.3) + i] = (i % 2 ? 1 : -1) * 0.9;
check('clap: found at 1.3 s', Math.abs(clapTime(audio, rate) - 1.3) < 0.02);
check('clap: silence → no clap', clapTime(new Float32Array(rate * 3).map(() => (Math.random() - 0.5) * 0.01), rate) === null);
let threw = false; try { reconstruct(side, film('front', { W: 1080, H: 1920, ppm: 600, t0: 20 }), { lag: 0 }); } catch (e) { threw = /overlap/.test(e.message); }
check('no overlap → a clear message', threw);

check('CSV export: header + one row per frame', toCSV(rec, plain).split('\n').length === rec.frames.length + 1);
check('history summary: no video or frames kept', !('frames' in summary(plain, { athlete: 'Test' })) && summary(plain, { athlete: 'Test' }).rows.length > 3);

// ---- Four cameras: side-right, front, side-left, back; each started at a different moment; a side camera can't
// see the far-side limbs well (extra noise, low visibility). Four cameras should measure the hidden leg far better.
{
  const V = demoVideos4({});
  const sync = syncAll(V);
  check(`4 cameras: each synced to the first (found ${sync.lags.map(l => l.toFixed(2)).join(', ')} s)`, [0, 0.5, 1.2, 0.8].every((x, i) => Math.abs(sync.lags[i] - x) <= 1 / 60 + 1e-9), JSON.stringify(sync));
  const views = V.map((v, i) => ({ ...v, lag: sync.lags[i] }));
  const err = rec => { const e = rec.frames.map(f => Math.abs(measure(f.P).kneeL - pose(f.t).k)); return e.reduce((a, b) => a + b, 0) / e.length; };
  const two = err(reconstructMulti([views[0], views[1]], { heightM: 1.75 })), four = err(reconstructMulti(views, { heightM: 1.75 }));
  check(`4 cameras: the leg hidden from one side camera is measured better (left knee error ${two.toFixed(1)}° with 2 → ${four.toFixed(1)}° with 4)`, four < two * 0.6 && four < 3, `${two} → ${four}`);
  check('4 cameras: works with 3 as well', err(reconstructMulti(views.slice(0, 3), { heightM: 1.75 })) < two);
  let threw = ''; try { reconstructMulti([views[0], views[2]]); } catch (e) { threw = e.message; }
  check('4 cameras: two side cameras alone → asks for a front or back camera', /front or back/.test(threw));
  check('4 cameras: clap sync when every video has a clap', JSON.stringify(syncAll(V, { claps: [2.0, 1.5, 0.8, 1.2] }).lags) === JSON.stringify([0, 0.5, 1.2, 0.8]));
}

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\n3D lab: all passed');
