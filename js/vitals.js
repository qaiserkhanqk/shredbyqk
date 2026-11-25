// Body check: heart rate and HRV from a fingertip on the phone camera, and a 3-minute alertness test.
// Everything stays on the phone. Maths lives in hr.js (unit tested); this file is the camera, timing and screens.
import { fingerOn, ppgHeartRate, ppgHrv, ppgBest, signalQuality, rollingHrv, fitCorrection, applyCorrection, validationCsv, MIN_PAIRS, vsBaseline, pvtScore, nextDelay, PVT } from './hr.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ctx; // { S, persist, toast }

export function initVitals(c) {
  ctx = c; ctx.S.vitals ||= [];
  $('#vHr').onclick = async () => { const r = await measureCamera({ mode: 'hr' }); if (r) { save({ kind: 'hr', bpm: r.bpm, source: r.source || 'camera' }); renderVitals(); } };
  const hrvRun = mode => async () => { const r = await measureCamera({ mode }); if (r) { save({ kind: 'hrv', rmssd: r.rmssd, ln: r.ln, bpm: r.bpm, raw: r.raw, corrected: r.corrected || undefined, secs: mode === 'hrv2' ? 120 : 60 }); renderVitals(); } };
  $('#vHrv').onclick = hrvRun('hrv');
  $('#vHrv2').onclick = hrvRun('hrv2');
  // Checking the phone against a chest strap (SCIENCE.md §11): pairs of readings taken at the same moment.
  ctx.S.validation ||= { on: false, useFix: false, pairs: [] };
  $('#valOn').onchange = e => { ctx.S.validation.on = e.target.checked; ctx.persist(); renderValidation(); };
  $('#valFix').onchange = e => { ctx.S.validation.useFix = e.target.checked; ctx.persist(); renderValidation(); };
  $('#valExport').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([validationCsv(ctx.S.validation.pairs)], { type: 'text/csv' }));
    a.download = `shred-camera-vs-strap-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
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
  const avg = rollingHrv(ctx.S.vitals);
  // The 7-day average is the number to watch; a single morning moves around a lot.
  $('#vHrvLast').innerHTML = trendLine('hrv', 'ln', v => `${v.rmssd} ms`) + (avg ? `<div class="hrv-avg"><b class="num">${avg.rmssd} ms</b> <span class="muted small">7-day average · the number to watch</span></div>` : '');
  renderValidation();
  $('#vPvtLast').innerHTML = trendLine('pvt', 'speed', v => `${v.meanRT} ms`);
}

/* ---------- Camera measurement ---------- */
// Fingertip over the back camera (and flash, where it can be switched on). Each heartbeat darkens the image slightly.
// Returns the result, or null if cancelled or failed (the overlay explains why and offers a retry).
// mode: 'hr' (15 s), 'hrv' (1 min) or 'hrv2' (2 min, most accurate HRV).
const DURATION = { hr: 15, hrv: 60, hrv2: 120 };
// In the native app (native/README.md) a plugin reads the camera directly: flash on iPhone too, and up to 240 fps.
const nativeCam = () => globalThis.Capacitor?.isNativePlatform?.() && globalThis.Capacitor.Plugins?.PulseCamera;

export function measureCamera({ mode = 'hr', title } = {}) {
  const secs = DURATION[mode] || 15, settle = 3, hrv = mode !== 'hr';
  return new Promise(async resolve => {
    const ov = $('#measure'), wave = $('#mWave'), g = wave.getContext('2d');
    let stream = null, track = null, done = false, samples = [], fingerSince = null, lostSince = null, raf = 0, stopNative = null;
    $('#mTitle').textContent = title || (mode === 'hrv2' ? 'HRV · 2 minutes' : mode === 'hrv' ? 'HRV · 1 minute' : 'Heart rate · 15 seconds');
    $('#mResult').hidden = true; $('#mLive').hidden = false; $('#mRetry').hidden = true; $('#mQuality').textContent = ''; $('#mQuality').className = 'm-quality';
    $('#mTip').textContent = hrv
      ? 'Sit still, rest your hand on a table and breathe normally. Best done each morning before coffee, in the same position.'
      : 'Rest your hand and keep still.';
    setProg(0); ov.hidden = false;
    const stopAll = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); stopNative?.(); };
    const finish = r => {
      if (done) return; done = true; stopAll();
      if (r === undefined) { ov.hidden = true; resolve(null); }
      else if (r.ok) { r = showResult(mode, r); $('#mDone').onclick = () => { ov.hidden = true; saveValidation(mode, r); resolve(r); }; }
      else { $('#mStatus').textContent = r.reason; $('#mRetry').hidden = false; $('#mRetry').onclick = () => { ov.hidden = true; measureCamera({ mode, title }).then(resolve); }; }
    };
    const retryLater = msg => {
      $('#mStatus').textContent = msg;
      $('#mRetry').hidden = false; $('#mRetry').onclick = () => { ov.hidden = true; measureCamera({ mode, title }).then(resolve); };
      $('#mCancel').onclick = () => { ov.hidden = true; resolve(null); };
    };
    $('#mCancel').onclick = () => finish(undefined);
    $('#mTap').hidden = true;
    // Hand over to tap-along: stop the camera without ending the measurement, then return the tap result instead.
    $('#mTap').onclick = () => { if (mode !== 'hr' || done) return; done = true; stopAll(); ov.hidden = true; tapPulse().then(resolve); };
    $('#mTap').textContent = mode === 'hr' ? 'Can\'t get a reading? Tap along with your pulse instead' : '';
    $('#mStatus').textContent = 'Cover the back camera with your fingertip. Press gently.';

    let frames = 0, firstAt = performance.now(), locked = false, lastQ = 0, fps = 0;
    // One camera frame's average colour → progress, live quality and, at the end, the result.
    const onSample = (now, rgb) => {
      if (done) return;
      frames++;
      const pn = performance.now();
      $('#mSignal').textContent = `Signal: red ${Math.round(rgb.r)} · green ${Math.round(rgb.g)} · blue ${Math.round(rgb.b)} · ${fps || Math.round(frames / Math.max(0.001, (pn - firstAt) / 1000))} fps`;
      if (fingerOn(rgb)) {
        lostSince = null;
        fingerSince ??= now;
        const t = now - fingerSince;
        // Once the finger is on, stop the camera re-adjusting brightness and colour: those adjustments look like pulse waves.
        if (!locked && t > 1.5) { locked = true; lockCamera(track); }
        if (t >= settle) {
          samples.push({ t: now, r: rgb.r, g: rgb.g });
          setProg((t - settle) / secs);
          drawWave(g, wave, samples);
          if (pn - lastQ > 1000) { lastQ = pn; const q = signalQuality(samples, rgb.r > 245 ? 'g' : 'r'); $('#mQuality').textContent = q.tip; $('#mQuality').className = 'm-quality ' + q.level; $('#mStatus').textContent = ''; }
          if (t - settle >= secs) {
            globalThis.__shredLastPulse = samples.map(s => ({ t: s.t, v: s.r })); // read by tests/camera-pulse.cjs
            return finish(ppgBest(samples, hrv ? ppgHrv : ppgHeartRate));
          }
        } else $('#mStatus').textContent = 'Finding your pulse…';
      } else if (fingerSince != null) {
        lostSince ??= now;
        if (now - lostSince > 1) { fingerSince = null; samples = []; locked = false; setProg(0); $('#mQuality').textContent = ''; $('#mStatus').textContent = 'Finger moved. Cover the camera again and it starts over.'; }
      } else if (pn - firstAt > 8000) {
        $('#mStatus').textContent = rgb.r < 20 ? 'Too dark. Face a bright lamp or window so light shines through your fingertip.' : 'No fingertip found. Cover the whole camera with the pad of your finger.';
        $('#mTap').hidden = mode !== 'hr';
      }
    };

    // Native app: the plugin streams colour averages with the flash on and a high frame rate.
    const nat = nativeCam();
    if (nat) {
      try {
        const info = await nat.start({ fps: hrv ? 240 : 60 });
        fps = Math.round(info?.fps || 0); $('#mLight').hidden = true; $('#mVideo').hidden = true;
        const h = await nat.addListener('samples', d => { for (let i = 0; i < d.t.length; i++) onSample(d.t[i], { r: d.r[i], g: d.g[i], b: d.b[i] }); });
        stopNative = () => { h?.remove?.(); nat.stop().catch(() => {}); };
        return;
      } catch { /* fall back to the browser camera */ }
    }

    try {
      // 60 fps where the phone allows it: beats are timed twice as finely as at 30 fps.
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 60 } }, audio: false });
    } catch { return retryLater('The camera isn\'t available. Allow camera access for Shred and try again.'); }
    track = stream.getVideoTracks()[0];
    fps = Math.round(track.getSettings?.().frameRate || 0);
    let torch = false;
    try { if (track.getCapabilities?.().torch) { await track.applyConstraints({ advanced: [{ torch: true }] }); torch = true; } } catch {}
    $('#mLight').hidden = torch;
    const v = $('#mVideo'); v.hidden = false; v.srcObject = stream; await v.play().catch(() => {});
    // iPhone: frames read before the camera has started are blank, so wait until the video has a size.
    if (!v.videoWidth) await new Promise(res => { const t = setTimeout(res, 3000); v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true }); });
    // Average many pixels: each pixel is noisy, the mean of thousands is not.
    const PW = 64, PH = 48, c = document.createElement('canvas'); c.width = PW; c.height = PH; const cx = c.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high';
    // Time each frame by when the camera captured it, not when the browser handed it over: callback timing
    // jitters by several ms, which would add false beat-to-beat variability (inflating HRV).
    // Safari and Chrome report these differently, so the capture time is used only when it is clearly on the same clock.
    let lastFrameAt = firstAt, useRaf = !v.requestVideoFrameCallback;
    const next = () => useRaf ? requestAnimationFrame(frame) : v.requestVideoFrameCallback(frame);
    // If the browser's per-frame callback never fires (seen on some iPhones), fall back to the screen refresh loop.
    const watchdog = setInterval(() => { if (done) return clearInterval(watchdog); if (!useRaf && performance.now() - lastFrameAt > 1500) { useRaf = true; raf = requestAnimationFrame(frame); } }, 500);
    const frame = (cbNow, meta) => {
      if (done) return;
      const pn = performance.now(), ct = meta?.captureTime;
      lastFrameAt = pn;
      if (!v.videoWidth) { raf = next(); return; }
      cx.drawImage(v, 0, 0, PW, PH);
      const d = cx.getImageData(0, 0, PW, PH).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const px = d.length / 4;
      onSample((Number.isFinite(ct) && Math.abs(ct - pn) < 1000 ? ct : pn) / 1000, { r: r / px, g: gg / px, b: b / px });
      raf = next();
    };
    raf = next();
  });
}

// Lock exposure, white balance and focus where the browser allows it (Chrome on Android). Safari ignores this.
async function lockCamera(track) {
  try {
    const cap = track?.getCapabilities?.() || {}, want = {};
    for (const k of ['exposureMode', 'whiteBalanceMode', 'focusMode']) if (cap[k]?.includes?.('manual')) want[k] = 'manual';
    if (Object.keys(want).length) await track.applyConstraints({ advanced: [want] });
  } catch {}
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
const pairsOf = kind => (ctx.S.validation?.pairs || []).filter(p => p.kind === kind);
function showResult(mode, r) {
  const hrv = mode !== 'hr';
  // If enough chest-strap comparisons exist and the client turned the correction on, show the corrected HRV (raw is kept).
  const fit = hrv && ctx.S.validation?.useFix ? fitCorrection(pairsOf('hrv')) : null;
  if (hrv) { r = { ...r, raw: r.rmssd }; if (fit?.ok) { r.rmssd = applyCorrection(r.raw, fit); r.ln = Math.log(r.rmssd); r.corrected = true; } }
  $('#mLive').hidden = true; $('#mResult').hidden = false;
  $('#mValue').textContent = hrv ? `${r.rmssd} ms` : `${r.bpm} bpm`;
  $('#mWhat').textContent = hrv
    ? `HRV (RMSSD), heart rate ${r.bpm} bpm. ${r.corrected ? `Corrected using ${fit.n} chest-strap comparisons (camera read ${r.raw} ms).` : 'A phone camera reads HRV a little high, so Shred only compares it with your own readings.'}`
    : 'Heart rate from your fingertip. Phone readings are usually within a few beats of a medical monitor.';
  const val = !!ctx.S.validation?.on && r.source !== 'taps';
  $('#mRef').hidden = !val; $('#mRefVal').value = '';
  $('#mRefLbl').textContent = hrv ? 'Chest strap HRV (RMSSD, ms) for the same minute' : 'Chest strap heart rate (bpm) right now';
  $('#mStatus').textContent = '';
  return r;
}
function saveValidation(mode, r) {
  const ref = parseFloat($('#mRefVal').value);
  if (!ctx.S.validation?.on || !(ref > 0)) return;
  const hrv = mode !== 'hr';
  ctx.S.validation.pairs.push({ at: Date.now(), kind: hrv ? 'hrv' : 'hr', cam: hrv ? r.raw : r.bpm, ref, secs: DURATION[mode] });
  ctx.persist(); renderValidation();
}
function renderValidation() {
  const v = ctx.S.validation; if (!v || !$('#valOn')) return;
  $('#valOn').checked = v.on; $('#valBody').hidden = !v.on;
  const hr = pairsOf('hr'), hv = pairsOf('hrv'), fit = fitCorrection(hv);
  const hrErr = hr.length ? (hr.reduce((s, p) => s + Math.abs(p.cam - p.ref), 0) / hr.length).toFixed(1) : null;
  $('#valStats').innerHTML = `<span>Heart-rate comparisons</span><span class="num">${hr.length}${hrErr ? ` · off by ${hrErr} bpm on average` : ''}</span>
    <span>HRV comparisons</span><span class="num">${hv.length}${fit.ok ? ` · off by ${fit.maeBefore} ms → ${fit.maeAfter} ms corrected` : ''}</span>`;
  $('#valFixWrap').hidden = !fit.ok; $('#valFix').checked = !!v.useFix && fit.ok;
  $('#valNeed').textContent = fit.ok ? '' : `${fit.need} more HRV comparison${fit.need > 1 ? 's' : ''} before a correction can be worked out.`;
  $('#valExport').disabled = !v.pairs.length;
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
