// Heart rate, HRV and alertness maths, on signals with a known true answer. Run: node tests/hr.test.mjs
import { cleanRR, rmssd, hrvReading, fingerOn, ppgHeartRate, ppgHrv, vitalNotes, vsBaseline, pvtScore, nextDelay, PVT } from '../js/hr.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

// --- RMSSD on a known series
check('RMSSD of 800,810,800,810 = 10 ms', Math.abs(rmssd([800, 810, 800, 810]) - 10) < 1e-9);
const rr = Array.from({ length: 80 }, (_, i) => 900 + 40 * Math.sin(i / 3));
const dirty = [...rr]; dirty[20] = 450; dirty[50] = 1800; dirty.splice(60, 0, 2400);
const c = cleanRR(dirty);
check('artefacts removed (missed/extra beats)', c.removed === 3 && c.rr.length === 78, `${c.removed} removed`);
check('artefact removal restores the true RMSSD', Math.abs(rmssd(c.rr) - rmssd(rr)) / rmssd(rr) < 0.1, `${rmssd(c.rr).toFixed(1)} vs ${rmssd(rr).toFixed(1)}`);
const good = hrvReading(rr);
check('HRV reading: ok with heart rate from RR', good.ok && good.bpm === 67 && good.beats === 80, JSON.stringify(good));
check('HRV reading: too few beats rejected', !hrvReading(rr.slice(0, 20)).ok);
const noisy = rr.map((x, i) => i % 6 === 0 ? x * 1.5 : x);
check('HRV reading: >10% artefacts rejected', !hrvReading(noisy).ok);

// --- Camera fingertip pulse: synthetic signals with drift, noise and jittery frame times
check('finger detection: red-dominant frame', fingerOn({ r: 210, g: 30, b: 25 }) && !fingerOn({ r: 120, g: 110, b: 100 }) && !fingerOn({ r: 20, g: 5, b: 5 }));
function ppg(bpm, secs = 15, noise = 0.25) {
  const f = bpm / 60, out = []; let t = 0;
  while (t < secs) {
    const ph = 2 * Math.PI * f * t;
    out.push({ t, v: 200 - (2 * Math.sin(ph) + 0.8 * Math.sin(2 * ph + 0.6)) + 4 * t / secs + noise * gauss() });
    t += (1 / 30) * (0.85 + 0.3 * rand()); // 25–35 fps
  }
  return out;
}
for (const bpm of [48, 62, 75, 98, 130, 165]) {
  const r = ppgHeartRate(ppg(bpm));
  check(`camera: ${bpm} bpm within ±2`, r.ok && Math.abs(r.bpm - bpm) <= 2, `${r.bpm} bpm, ${r.beats} beats`);
}
check('camera: pure noise is rejected, not reported as a heart rate', !ppgHeartRate(Array.from({ length: 450 }, (_, i) => ({ t: i / 30, v: 200 + 2 * gauss() }))).ok);
check('camera: too short is rejected', !ppgHeartRate(ppg(70, 2)).ok);

// HRV from the camera: beats with known variable spacing (breathing-linked), rendered at a jittery ~30 fps.
function ppgBeats(rrMs, noise = 0.15) {
  const beats = []; let tb = 0.5; for (const r of rrMs) { beats.push(tb); tb += r / 1000; }
  const out = []; let t = 0;
  while (t < tb) {
    let v = 200 + 3 * t / tb + noise * gauss();
    for (const b of beats) { const d = t - b; if (d > -0.3 && d < 0.6) v -= 2.2 * Math.exp(-((d - 0.08) ** 2) / 0.006) + 0.9 * Math.exp(-((d - 0.33) ** 2) / 0.012); }
    out.push({ t, v }); t += (1 / 30) * (0.85 + 0.3 * rand());
  }
  return out;
}
for (const [label, amp] of [['moderate HRV', 40], ['high HRV', 80]]) {
  const truth = Array.from({ length: 75 }, (_, i) => 850 + amp * Math.sin(i / 2.2) + amp * 0.3 * gauss());
  const est = ppgHrv(ppgBeats(truth)), real = rmssd(truth);
  check(`camera HRV (${label}): RMSSD within 25% of truth`, est.ok && Math.abs(est.rmssd - real) / real < 0.25, `${est.rmssd} vs ${real.toFixed(1)} ms`);
}
// Known limit, as in published phone-camera studies: frame-timing jitter adds a floor of roughly 10 ms,
// so very low HRV reads high. That's why the app compares only with the person's own baseline.
{ const truth = Array.from({ length: 75 }, (_, i) => 850 + 15 * Math.sin(i / 2.2) + 4.5 * gauss());
  const est = ppgHrv(ppgBeats(truth)), real = rmssd(truth);
  check('camera HRV (low HRV): reads high, by under 10 ms', est.ok && est.rmssd >= real && est.rmssd - real < 10, `${est.rmssd} vs ${real.toFixed(1)} ms`); }
const lo = ppgHrv(ppgBeats(Array.from({ length: 75 }, (_, i) => 850 + 15 * Math.sin(i / 2.2)))), hi = ppgHrv(ppgBeats(Array.from({ length: 75 }, (_, i) => 850 + 60 * Math.sin(i / 2.2))));
check('camera HRV: ranks a calmer heart above a tenser one', lo.ok && hi.ok && hi.rmssd > lo.rmssd * 1.5, `${lo.rmssd} → ${hi.rmssd}`);
check('camera HRV: 15 s is too short (needs a minute)', !ppgHrv(ppgBeats(Array.from({ length: 18 }, () => 850))).ok);

// --- Personal baseline
const DAY = 864e5, now = Date.now();
const hist = [50, 54, 52, 48, 51, 53, 49].map((v, i) => ({ at: now - (i + 1) * DAY, value: v }));
check('baseline: needs 5 readings first', vsBaseline(50, hist.slice(0, 3), { now }).status === 'building');
check('baseline: usual value → normal', vsBaseline(51, hist, { now }).status === 'normal');
check('baseline: well below usual → low, with % difference', vsBaseline(42, hist, { now }).status === 'low' && vsBaseline(42, hist, { now }).pct === -18);
check('baseline: ignores readings older than 30 days', vsBaseline(51, hist.map(h => ({ ...h, at: h.at - 40 * DAY })), { now }).status === 'building');

// --- Alertness test (PVT-B rules)
check('PVT-B timing: 3 minutes, stimulus every 2–5 s', PVT.seconds === 180 && nextDelay(() => 0) === 2000 && nextDelay(() => 1) === 5000);
const s = pvtScore([{ rt: 250 }, { rt: 300 }, { rt: 400 }, { rt: 80 }, { falseStart: true }, { rt: 260 }]);
check('PVT: lapses are ≥355 ms', s.lapses === 1);
check('PVT: false starts = early taps plus <100 ms', s.falseStarts === 2);
check('PVT: mean RT and speed from valid responses only', s.n === 4 && s.meanRT === 303 && s.speed === 3.42, JSON.stringify(s));
check('PVT: no responses → not ok', !pvtScore([{ falseStart: true }]).ok);
// --- Plain-words notes for the readiness card
const V = [...[50, 54, 52, 48, 51].map((v, i) => ({ at: now - (i + 1) * DAY, kind: 'hrv', ln: Math.log(v) })),
  ...[3.6, 3.7, 3.5, 3.6, 3.7].map((v, i) => ({ at: now - (i + 1) * DAY, kind: 'pvt', speed: v }))];
const n1 = vitalNotes([...V, { at: now, kind: 'hrv', ln: Math.log(40) }, { at: now, kind: 'pvt', speed: 3.0 }], now);
check('notes: low HRV and slow alertness flagged with %', n1.length === 2 && n1.every(n => n.level === 'adjust') && /HRV 22% below/.test(n1[0].text) && /17% slower/.test(n1[1].text), n1.map(n => n.text).join(' | '));
check('notes: usual values → normal', vitalNotes([...V, { at: now, kind: 'hrv', ln: Math.log(51) }], now)[0].level === 'go');
check('notes: first readings say how many more are needed', /4 more morning readings/.test(vitalNotes([{ at: now, kind: 'hrv', ln: 4 }, { at: now - DAY, kind: 'hrv', ln: 4 }], now)[0].text));
check('notes: nothing measured today → no notes', vitalNotes(V, now).length === 0);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
