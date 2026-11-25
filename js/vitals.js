// Body check: heart rate and HRV from a fingertip on the phone camera, and a 3-minute alertness test.
// Everything stays on the phone. Maths lives in hr.js (unit tested); this file is the camera, timing and screens.
import { fingerOn, ppgHeartRate, ppgHrv, vsBaseline, pvtScore, nextDelay, PVT } from './hr.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ctx; // { S, persist, toast }

export function initVitals(c) {
  ctx = c; ctx.S.vitals ||= [];
  $('#vHr').onclick = async () => { const r = await measureCamera({ mode: 'hr' }); if (r) { save({ kind: 'hr', bpm: r.bpm, source: r.source || 'camera' }); renderVitals(); } };
  $('#vHrv').onclick = async () => { const r = await measureCamera({ mode: 'hrv' }); if (r) { save({ kind: 'hrv', rmssd: r.rmssd, ln: r.ln, bpm: r.bpm }); renderVitals(); } };
  $('#vPvt').onclick = () => runPvt();
}
const save = v => { ctx.S.vitals.push({ at: Date.now(), source: 'camera', ...v }); ctx.persist(); };

/* ---------- Screen ---------- */
const fmtDay = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
function trendLine(kind, key, fmt) {
  const list = ctx.S.vitals.filter(v => v.kind === kind);
  if (!list.length) return '<span class="muted small">No readings yet.</span>';
  const last = list.at(-1), b = vsBaseline(last[key], list.slice(0, -1).map(v => ({ at: v.at, value: v[key] })), { now: last.at + 1 });
  const word = { low: kind === 'pvt' ? 'Slower than your normal' : 'Below your normal', high: kind === 'pvt' ? 'Faster than your normal' : 'Above your normal', normal: 'In your normal range', building: `${b.need} more until your normal range is set` }[b.status];
  return `<div class="vital-last"><span class="num">${fmt(last)}</span><span class="chip-note ${b.status}">${word}</span></div><span class="muted small">${fmtDay(last.at)} · ${list.length} reading${list.length > 1 ? 's' : ''}</span>`;
}
export function renderVitals() {
  $('#vHrLast').innerHTML = trendLine('hr', 'bpm', v => `${v.bpm} bpm`);
  $('#vHrvLast').innerHTML = trendLine('hrv', 'ln', v => `${v.rmssd} ms`);
  $('#vPvtLast').innerHTML = trendLine('pvt', 'speed', v => `${v.meanRT} ms`);
}

/* ---------- Camera measurement ---------- */
// Fingertip over the back camera (and flash, where the browser can switch it on). Each heartbeat darkens the image slightly.
// Returns the result, or null if cancelled or failed (the overlay explains why and offers a retry).
export function measureCamera({ mode = 'hr', title } = {}) {
  const secs = mode === 'hrv' ? 60 : 15, settle = 3;
  return new Promise(async resolve => {
    const ov = $('#measure'), wave = $('#mWave'), g = wave.getContext('2d');
    let stream = null, done = false, samples = [], fingerSince = null, lostSince = null, raf = 0;
    $('#mTitle').textContent = title || (mode === 'hrv' ? 'HRV · 1 minute' : 'Heart rate · 15 seconds');
    $('#mResult').hidden = true; $('#mLive').hidden = false; $('#mRetry').hidden = true;
    $('#mTip').textContent = mode === 'hrv'
      ? 'Sit still, rest your hand on a table and breathe normally. Best done each morning before coffee, in the same position.'
      : 'Rest your hand and keep still.';
    setProg(0); ov.hidden = false;
    const finish = r => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
      if (r === undefined) { ov.hidden = true; resolve(null); }
      else if (r.ok) { showResult(mode, r); $('#mDone').onclick = () => { ov.hidden = true; resolve(r); }; }
      else { $('#mStatus').textContent = r.reason; $('#mRetry').hidden = false; $('#mRetry').onclick = () => { ov.hidden = true; measureCamera({ mode, title }).then(resolve); }; }
    };
    $('#mCancel').onclick = () => finish(undefined);
    $('#mTap').hidden = true;
    // Hand over to tap-along: stop the camera without ending the measurement, then return the tap result instead.
    $('#mTap').onclick = () => { if (mode !== 'hr' || done) return; done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); ov.hidden = true; tapPulse().then(resolve); };
    $('#mTap').textContent = mode === 'hr' ? 'Can\'t get a reading? Tap along with your pulse instead' : '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }, audio: false });
    } catch {
      $('#mStatus').textContent = 'The camera isn\'t available. Allow camera access for Shred and try again.';
      $('#mRetry').hidden = false; $('#mRetry').onclick = () => { ov.hidden = true; measureCamera({ mode, title }).then(resolve); };
      $('#mCancel').onclick = () => { ov.hidden = true; resolve(null); };
      return;
    }
    const track = stream.getVideoTracks()[0];
    let torch = false;
    try { if (track.getCapabilities?.().torch) { await track.applyConstraints({ advanced: [{ torch: true }] }); torch = true; } } catch {}
    $('#mLight').hidden = torch;
    const v = $('#mVideo'); v.srcObject = stream; await v.play().catch(() => {});
    // iPhone: frames read before the camera has started are blank, so wait until the video has a size.
    if (!v.videoWidth) await new Promise(res => { const t = setTimeout(res, 3000); v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true }); });
    // Average many pixels: each pixel is noisy, the mean of thousands is not.
    const PW = 64, PH = 48, c = document.createElement('canvas'); c.width = PW; c.height = PH; const cx = c.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high';
    $('#mStatus').textContent = 'Cover the back camera with your fingertip. Press gently.';
    // Time each frame by when the camera captured it, not when the browser handed it over: callback timing
    // jitters by several ms, which would add false beat-to-beat variability (inflating HRV).
    // Safari and Chrome report these differently, so the capture time is used only when it is clearly on the same clock.
    let chan = null, frames = 0, firstAt = performance.now(), lastFrameAt = firstAt, useRaf = !v.requestVideoFrameCallback;
    const next = () => useRaf ? requestAnimationFrame(frame) : v.requestVideoFrameCallback(frame);
    // If the browser's per-frame callback never fires (seen on some iPhones), fall back to the screen refresh loop.
    const watchdog = setInterval(() => { if (done) return clearInterval(watchdog); if (!useRaf && performance.now() - lastFrameAt > 1500) { useRaf = true; raf = requestAnimationFrame(frame); } }, 500);
    const frame = (cbNow, meta) => {
      if (done) return;
      const pn = performance.now(), ct = meta?.captureTime;
      const now = (Number.isFinite(ct) && Math.abs(ct - pn) < 1000 ? ct : pn) / 1000;
      lastFrameAt = pn;
      if (!v.videoWidth) { raf = next(); return; }
      frames++;
      cx.drawImage(v, 0, 0, PW, PH);
      const d = cx.getImageData(0, 0, PW, PH).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const px = d.length / 4, rgb = { r: r / px, g: gg / px, b: b / px };
      // Live numbers so a failed reading can be explained (red should be high, green and blue low).
      $('#mSignal').textContent = `Signal: red ${Math.round(rgb.r)} · green ${Math.round(rgb.g)} · blue ${Math.round(rgb.b)} · ${Math.round(frames / Math.max(0.001, (pn - firstAt) / 1000))} fps`;
      if (fingerOn(rgb)) {
        lostSince = null;
        fingerSince ??= now;
        const t = now - fingerSince;
        if (t >= settle) {
          // A strong flash can max out the red channel, which flattens the pulse; green still carries it.
          chan ??= rgb.r > 245 ? 'g' : 'r';
          samples.push({ t: now, v: rgb[chan] });
          setProg((t - settle) / secs);
          $('#mStatus').textContent = 'Hold still…';
          drawWave(g, wave, samples);
          if (t - settle >= secs) {
            globalThis.__shredLastPulse = samples; // read by tests/camera-pulse.cjs
            return finish(mode === 'hrv' ? ppgHrv(samples) : ppgHeartRate(samples));
          }
        } else $('#mStatus').textContent = 'Finding your pulse…';
      } else if (fingerSince != null) {
        lostSince ??= now;
        if (now - lostSince > 1) { fingerSince = null; samples = []; chan = null; setProg(0); $('#mStatus').textContent = 'Finger moved. Cover the camera again and it starts over.'; }
      } else if (pn - firstAt > 8000) {
        $('#mStatus').textContent = rgb.r < 20 ? 'Too dark. Face a bright lamp or window so light shines through your fingertip.' : 'No fingertip found. Cover the whole camera with the pad of your finger.';
        $('#mTap').hidden = mode !== 'hr';
      }
      raf = next();
    };
    raf = next();
  });
}
// Backup when the camera can't see a pulse: feel your pulse (wrist or neck) and tap the screen on every beat for 15 s.
// Counting your own pulse is how nurses measure it, so this is accurate if you tap every beat.
function tapPulse() {
  return new Promise(resolve => {
    const ov = $('#tapPulse'), area = $('#tpArea'); let taps = [], timer = 0;
    $('#tpCount').textContent = 'Tap to start'; $('#tpDone').hidden = true; area.hidden = false; ov.hidden = false;
    const done = r => { clearTimeout(timer); ov.hidden = true; resolve(r); };
    $('#tpCancel').onclick = () => done(null);
    area.onpointerdown = e => {
      e.preventDefault(); taps.push(e.timeStamp);
      try { navigator.vibrate?.(15); } catch {}
      if (taps.length === 1) timer = setTimeout(() => {
        area.hidden = true;
        const ibi = taps.slice(1).map((t, i) => t - taps[i]).filter(x => x > 300 && x < 2000);
        if (ibi.length < 8) { $('#tpCount').textContent = 'Not enough taps. Try again, tapping every beat.'; setTimeout(() => done(null), 2000); return; }
        const bpm = Math.round(60000 / (ibi.sort((a, b) => a - b)[ibi.length >> 1]));
        $('#tpCount').textContent = `${bpm} bpm`; $('#tpDone').hidden = false;
        $('#tpDone').onclick = () => done({ ok: true, bpm, source: 'taps' });
      }, 15000);
      $('#tpCount').textContent = `${taps.length} beat${taps.length > 1 ? 's' : ''}`;
    };
  });
}

function setProg(f) { $('#mArc').style.strokeDashoffset = 251 * (1 - Math.max(0, Math.min(1, f))); }
function drawWave(g, cv, s) {
  const W = cv.width, H = cv.height, last = s.filter(p => p.t > s.at(-1).t - 4);
  if (last.length < 3) return;
  const m = last.reduce((a, p) => a + p.v, 0) / last.length, span = Math.max(1, ...last.map(p => Math.abs(p.v - m)));
  g.clearRect(0, 0, W, H); g.strokeStyle = '#7c6cff'; g.lineWidth = 2; g.beginPath();
  last.forEach((p, i) => { const x = (p.t - last[0].t) / 4 * W, y = H / 2 + (p.v - m) / span * H * 0.4; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
}
function showResult(mode, r) {
  $('#mLive').hidden = true; $('#mResult').hidden = false;
  $('#mValue').textContent = mode === 'hrv' ? `${r.rmssd} ms` : `${r.bpm} bpm`;
  $('#mWhat').textContent = mode === 'hrv'
    ? `HRV (RMSSD), heart rate ${r.bpm} bpm. A phone camera reads HRV a little high, so Shred only compares it with your own readings.`
    : 'Heart rate from your fingertip. Phone readings are usually within a few beats of a medical monitor.';
  $('#mStatus').textContent = '';
}

/* ---------- Alertness test (3-minute PVT-B) ---------- */
function runPvt() {
  const ov = $('#pvt'), area = $('#pvtArea'), num = $('#pvtNum');
  const seconds = globalThis.__shredPvtSeconds || PVT.seconds;
  const trials = []; let shownAt = null, timer = 0, tick = 0, start = 0, running = false;
  $('#pvtIntro').hidden = false; $('#pvtResult').hidden = true; num.textContent = ''; area.classList.remove('live');
  ov.hidden = false;
  const stop = () => { running = false; clearTimeout(timer); cancelAnimationFrame(tick); };
  const schedule = () => { timer = setTimeout(show, nextDelay()); };
  const show = () => {
    if (!running) return;
    if (performance.now() - start >= seconds * 1000) return end();
    requestAnimationFrame(ts => { shownAt = ts; num.textContent = '0'; area.classList.add('go'); count(); });
  };
  const count = () => { tick = requestAnimationFrame(ts => { if (shownAt == null) return; num.textContent = Math.round(ts - shownAt); if (ts - shownAt > 30000) { trials.push({ rt: 30000 }); reset(); } else count(); }); };
  const reset = () => { shownAt = null; cancelAnimationFrame(tick); area.classList.remove('go'); setTimeout(() => { num.textContent = ''; }, 300); schedule(); };
  area.onpointerdown = e => {
    if (!running) return;
    e.preventDefault();
    if (shownAt == null) { trials.push({ falseStart: true }); clearTimeout(timer); num.textContent = 'Too early'; setTimeout(() => { if (shownAt == null) num.textContent = ''; }, 500); return schedule(); }
    trials.push({ rt: e.timeStamp - shownAt }); reset();
  };
  const end = () => {
    stop(); area.classList.remove('live', 'go'); num.textContent = '';
    const s = pvtScore(trials);
    if (!s.ok) { ctx.toast('No responses recorded. Try again when you can give it your full attention.'); ov.hidden = true; return; }
    const prior = ctx.S.vitals.filter(v => v.kind === 'pvt').map(v => ({ at: v.at, value: v.speed }));
    save({ kind: 'pvt', ...s, ok: undefined });
    const b = vsBaseline(s.speed, prior);
    $('#pvtResult').hidden = false;
    $('#pvtSummary').innerHTML = `<div class="kv"><span>Average reaction</span><span class="num">${s.meanRT} ms</span>
      <span>Slow responses (355 ms or more)</span><span class="num">${s.lapses}</span><span>Early taps</span><span class="num">${s.falseStarts}</span></div>
      <p class="muted small" style="margin:0">${b.status === 'building' ? `Do this test ${b.need} more time${b.need > 1 ? 's' : ''}, ideally each morning, and Shred will show how today compares with your normal.` : b.status === 'low' ? `${Math.abs(b.pct)}% slower than your normal. Often a sign of short or poor sleep.` : 'In line with your normal alertness, or better.'} Always use the same phone: screens add their own delay.</p>`;
    renderVitals();
  };
  $('#pvtStart').onclick = () => {
    $('#pvtIntro').hidden = true; area.classList.add('live'); running = true; start = performance.now();
    $('#pvtClock').textContent = ''; schedule();
    const clock = () => { if (!running) return; const left = Math.max(0, seconds - (performance.now() - start) / 1000); const tot = Math.ceil(left); $('#pvtClock').textContent = `${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, '0')}`; if (left <= 0 && shownAt == null) return end(); setTimeout(clock, 250); };
    clock();
  };
  $('#pvtClose').onclick = $('#pvtDone').onclick = () => { stop(); ov.hidden = true; };
}
