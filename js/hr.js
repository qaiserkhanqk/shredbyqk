// Heart rate, HRV and alertness maths. Pure functions with no browser APIs, so every one is unit tested.
// Accuracy notes and sources: SCIENCE.md §11.

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

// Remove artefacts (missed or extra beats): outside 300–2000 ms, or more than 20% away from the recent median.
export function cleanRR(rr) {
  const inRange = rr.filter(x => x >= 300 && x <= 2000), start = median(inRange);
  const out = []; let removed = rr.length - inRange.length;
  for (const x of inRange) {
    const ref = out.length >= 3 ? median(out.slice(-5)) : start;
    if (Math.abs(x - ref) / ref > 0.2) { removed++; continue; }
    out.push(x);
  }
  return { rr: out, removed, pctRemoved: rr.length ? removed / rr.length : 1 };
}

// RMSSD: the standard short-recording HRV measure, mainly reflecting the rest-and-digest (vagal) system.
export function rmssd(rr) {
  if (rr.length < 2) return NaN;
  let s = 0; for (let i = 1; i < rr.length; i++) s += (rr[i] - rr[i - 1]) ** 2;
  return Math.sqrt(s / (rr.length - 1));
}

// A usable HRV reading needs enough clean beats and few artefacts; otherwise the client is asked to repeat it.
export function hrvReading(rawRR, { minBeats = 40, maxArtefacts = 0.1 } = {}) {
  const c = cleanRR(rawRR);
  if (c.rr.length < minBeats) return { ok: false, reason: 'Not enough clear beats. Keep your fingertip still on the camera for the whole minute.' };
  if (c.pctRemoved > maxArtefacts) return { ok: false, reason: 'Too many irregular beats in this reading. Sit still and try again.' };
  const v = rmssd(c.rr);
  return { ok: true, rmssd: Math.round(v * 10) / 10, ln: Math.log(v), bpm: Math.round(60000 / mean(c.rr)), beats: c.rr.length, artefacts: c.removed };
}

/* ---------- Phone camera (fingertip photoplethysmography) ---------- */
// The fingertip covers the camera and flash; each heartbeat briefly darkens the image.
// Red clearly dominant. Loose enough for a strong flash, where green and blue also brighten.
// Without a flash (iPhone browsers can't switch it on) room light through a fingertip is dim, so the brightness bar is low.
export function fingerOn({ r, g, b }) { return r > 20 && r > 1.3 * g && r > 1.3 * b; }

function movAvg(x, w) {
  const out = new Float64Array(x.length), h = w >> 1; let s = 0, lo = 0, hi = -1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - h), b = Math.min(x.length - 1, i + h);
    while (hi < b) s += x[++hi];
    while (lo < a) s -= x[lo++];
    out[i] = s / (hi - lo + 1);
  }
  return out;
}

// Time each beat precisely. A single peak sample is noisy (camera noise is a large fraction of the pulse), so:
// 1) average all beats into one template, 2) slide the template over each beat and take the best match,
// 3) refine between frames with a parabola through the match scores. This uses the whole beat shape, not one point.
function refineBeats(x, peaks, fs) {
  const pre = Math.round(fs * 0.25), post = Math.round(fs * 0.45), L = pre + post + 1, maxLag = Math.round(fs * 0.12);
  const ok = peaks.filter(p => p - pre - maxLag - 1 >= 0 && p + post + maxLag + 1 < x.length);
  if (ok.length < 4) return peaks.map(i => i);
  const tpl = new Float64Array(L);
  for (const p of ok) for (let k = 0; k < L; k++) tpl[k] += x[p - pre + k] / ok.length;
  const tm = tpl.reduce((a, v) => a + v, 0) / L; for (let k = 0; k < L; k++) tpl[k] -= tm;
  const score = (c) => { let m = 0; for (let k = 0; k < L; k++) m += x[c - pre + k]; m /= L; let s = 0; for (let k = 0; k < L; k++) s += (x[c - pre + k] - m) * tpl[k]; return s; };
  return peaks.map(p => {
    if (!ok.includes(p)) return p;
    let best = p, bs = -Infinity;
    for (let c = p - maxLag; c <= p + maxLag; c++) { const v = score(c); if (v > bs) { bs = v; best = c; } }
    const a = score(best - 1), b = bs, c2 = score(best + 1), d = a - 2 * b + c2;
    return best + (d < 0 ? 0.5 * (a - c2) / d : 0);
  });
}

// samples: [{t: seconds, v: mean red brightness}] at the camera's (irregular) frame rate.
export function ppgHeartRate(samples, { fs = 30, minBeats = 8 } = {}) {
  if (samples.length < fs * 4) return { ok: false, reason: 'Recording too short.' };
  const t0 = samples[0].t, n = Math.floor((samples.at(-1).t - t0) * fs);
  const x = new Float64Array(n); let j = 0;
  for (let k = 0; k < n; k++) {        // resample to an even 30 Hz
    const t = t0 + k / fs;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j], b = samples[j + 1], f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    x[k] = a.v + (b.v - a.v) * f;
  }
  const trend = movAvg(x, Math.round(fs * 1.5)), detr = x.map((v, i) => trend[i] - v); // remove drift; invert so beats are peaks
  const y = movAvg(detr, 5), s = sd([...y]);
  const gap = Math.round(fs * 60 / 200), peaks = [];  // no two beats closer than 200 bpm
  for (let i = gap; i < n - gap; i++) {
    if (y[i] < 0.3 * s) continue;
    let top = true;
    for (let k = i - gap; k <= i + gap && top; k++) if (y[k] > y[i]) top = false;
    if (top && (!peaks.length || i - peaks.at(-1) >= gap)) peaks.push(i);
  }
  const at = refineBeats(detr, peaks, fs);
  const ibi = at.slice(1).map((p, i) => (p - at[i]) * 1000 / fs);
  const c = cleanRR(ibi);
  if (c.rr.length < minBeats) return { ok: false, reason: 'No clear pulse. Cover the camera and flash completely, and press gently.' };
  const quality = 1 - c.pctRemoved;
  if (quality < 0.75) return { ok: false, reason: 'The signal was too noisy. Keep your hand still and try again.' };
  return { ok: true, bpm: Math.round(60000 / median(c.rr)), beats: c.rr.length, quality: Math.round(quality * 100) / 100, rr: c.rr };
}

// HRV estimate from a 60-second fingertip recording. Stricter than heart rate: one wrong beat distorts RMSSD.
// Phone-camera HRV tracks ECG closely but reads high, so it is shown only against the person's own baseline.
export function ppgHrv(samples, opts) {
  const r = ppgHeartRate(samples, opts);
  if (!r.ok) return r;
  const h = hrvReading(r.rr, { minBeats: 40, maxArtefacts: 0.1 });
  if (!h.ok) return h;
  if (r.quality < 0.9) return { ok: false, reason: 'The signal wasn\'t steady enough for HRV. Rest your hand on a table and try again.' };
  return { ...h, bpm: r.bpm };
}

/* ---------- Personal baseline ---------- */
// Readings are only compared with the person's own last 30 days (at least 5 readings):
// "normal" = within 1 SD of their average. Phone and strap values are never mixed.
export function vsBaseline(value, history, { now = Date.now(), days = 30, minN = 5 } = {}) {
  const past = history.filter(h => h.at < now && h.at >= now - days * 864e5).map(h => h.value);
  if (past.length < minN) return { status: 'building', need: minN - past.length };
  const m = mean(past), s = Math.max(sd(past), Math.abs(m) * 0.02);
  return { status: value < m - s ? 'low' : value > m + s ? 'high' : 'normal', mean: m, sd: s, pct: Math.round((value / m - 1) * 100) };
}

/* ---------- Alertness: 3-minute psychomotor vigilance test (PVT-B) ---------- */
// PVT-B (Basner et al.): 3 minutes, stimulus every 2–5 s, a lapse is a response of 355 ms or slower,
// a false start is a tap with no stimulus or under 100 ms.
export const PVT = { seconds: 180, isiMin: 2000, isiMax: 5000, lapseMs: 355, falseMs: 100 };
export const nextDelay = (rand = Math.random) => PVT.isiMin + rand() * (PVT.isiMax - PVT.isiMin);

export function pvtScore(trials) {
  const rts = trials.filter(t => t.rt != null && t.rt >= PVT.falseMs).map(t => t.rt);
  const falseStarts = trials.filter(t => t.falseStart || (t.rt != null && t.rt < PVT.falseMs)).length;
  if (!rts.length) return { ok: false, falseStarts };
  return {
    ok: true, n: rts.length, falseStarts,
    meanRT: Math.round(mean(rts)), medianRT: Math.round(median(rts)),
    lapses: rts.filter(r => r >= PVT.lapseMs).length,
    speed: Math.round(mean(rts.map(r => 1000 / r)) * 100) / 100, // responses per second: the most sensitive PVT measure
  };
}

/* ---------- What today's readings mean, in plain words ---------- */
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
export function vitalNotes(vitals = [], now = Date.now()) {
  const notes = [];
  const latest = kind => [...vitals].reverse().find(v => v.kind === kind && sameDay(v.at, now));
  const hist = (kind, key) => vitals.filter(v => v.kind === kind && !sameDay(v.at, now)).map(v => ({ at: v.at, value: v[key] }));
  const h = latest('hrv');
  if (h) {
    const b = vsBaseline(h.ln, hist('hrv', 'ln'), { now });
    if (b.status === 'low') notes.push({ level: 'adjust', text: `HRV ${Math.round((1 - Math.exp(h.ln - b.mean)) * 100)}% below your normal range: your body may still be recovering.` });
    else if (b.status === 'building') notes.push({ level: 'info', text: `HRV recorded. ${b.need} more morning reading${b.need > 1 ? 's' : ''} until it's compared with your normal.` });
    else notes.push({ level: 'go', text: b.status === 'high' ? 'HRV above your normal range.' : 'HRV in your normal range.' });
  }
  const p = latest('pvt');
  if (p) {
    const b = vsBaseline(p.speed, hist('pvt', 'speed'), { now });
    if (b.status === 'low') notes.push({ level: 'adjust', text: `Alertness ${Math.abs(b.pct)}% slower than your normal: you may be short on sleep. Take extra care with heavy or technical lifts.` });
    else if (b.status === 'building') notes.push({ level: 'info', text: `Alertness recorded. ${b.need} more test${b.need > 1 ? 's' : ''} until it's compared with your normal.` });
    else notes.push({ level: 'go', text: 'Alertness in your normal range.' });
  }
  return notes;
}
