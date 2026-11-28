// Sukoon screen and live session. Flow: pick a goal → rate tension → breathe (tones optional) → listen → dua → rate again.
import { measureCamera } from './vitals.js';
import { PATTERNS } from './sukoon.js';
import { GOALS, GOAL, EVIDENCE, RECITERS, SURAH, silentWav, playlist, passageLabel, quranComUrl, breathAt, breathsPerMin, needsSupport, summarize, SukoonTones } from './sukoon.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ctx; // { S, persist, toast }
let goalId = 'anxiety';
const tones = new SukoonTones();
let run = null; // the live session
let player = null; // one audio element, unlocked during the Begin tap and reused for every verse
/** If no recitation has started this long after a verse begins (and the phone isn't waiting for her tap), she is
 *  offered the passage on Quran.com. Some browsers (Firefox, 2026-11-27) never report an undecodable file as an error,
 *  which left her in silence. A UI choice, not a measured value. */
export const STALL_MS = 8000;

function unlockPlayer() {
  player ||= new Audio();
  try {
    player.src = URL.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' }));
    player.play().then(() => player.pause()).catch(() => {});
  } catch {}
}

// 5 minutes is the shortest breathing dose linked to a clear benefit (SCIENCE.md §10).
const prefs = () => (ctx.S.calmPrefs ||= { tones: 'before', mode: 'binaural', minutes: 5, reciter: RECITERS[0].id, quran: true, cue: true, breath: 'slow', hr: false });
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function initCalm(c) {
  ctx = c; ctx.S.calm ||= [];
  goalId = GOAL[prefs().lastGoal] ? prefs().lastGoal : goalId;
  $('#calmGoals').onclick = e => { const b = e.target.closest('[data-goal]'); if (b) { goalId = prefs().lastGoal = b.dataset.goal; ctx.persist(); renderCalm(); } };
  $('#calmStart').onclick = () => askBefore();
  $('#calmNow').onclick = () => askBefore();
  // The screen lock is released whenever the page is hidden: take it again when the user comes back.
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && run && run.step !== 'listen') try { run.lock = await navigator.wakeLock?.request('screen'); } catch {}
  });
  $('#calmSupportLink').onclick = () => showSupport();
  $('#calmSheet').onclick = e => { if (e.target.id === 'calmSheet') closeSheet(); };
  $('#calmEnd').onclick = () => finish(true);
  $('#calmSkip').onclick = () => run && next();
  $('#calmNotSafe').onclick = () => showSupport();
}

// Opened from the home-screen shortcut or a ?calm=now link: go straight to the first question.
export function startCalmNow() { askBefore(); }

export function renderCalm() {
  const g = GOAL[goalId], p = prefs();
  $('#calmGoals').innerHTML = GOALS.map(x => `<button type="button" class="goal ${x.id === goalId ? 'on' : ''}" data-goal="${x.id}" aria-pressed="${x.id === goalId}"><b>${esc(x.name)}</b><span>${esc(x.blurb)}</span></button>`).join('');
  $('#calmDetail').innerHTML = `
    <div><span class="eyebrow">${esc(g.name)}</span><h2 class="display h2" style="margin-top:4px">${esc(passageLabel(g))}</h2></div>
    <p class="verse">${g.why ? `<span class="muted small">Why this surah: </span>` : ''}“${esc(g.meaning)}” <span class="muted small">(${esc(g.key)})</span></p>
    <p class="muted small" style="margin:0">${p.minutes} min ${p.breath === 'sigh' ? 'cyclic sighing' : 'slow breathing'} · ${p.quran ? 'recitation' : 'no recitation'} · dua${p.hr ? ' · heart rate before and after' : ''}</p>`;
  $('#calmSettings').innerHTML = `
    <label class="field">Breathing style<select id="cBreath">${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${(p.breath || 'slow') === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" id="cHr" ${p.hr ? 'checked' : ''}> Measure my heart rate before and after (15 s each, fingertip on the camera)</label>
    <label class="check"><input type="checkbox" id="cCue" ${p.cue !== false ? 'checked' : ''}> Breath sound and vibration, so you can close your eyes</label>
    <label class="field">Background tone<select id="cTones">
      <option value="before" ${p.tones === 'before' ? 'selected' : ''}>On while breathing (plain tone, no music or instruments)</option>
      <option value="off" ${p.tones === 'off' ? 'selected' : ''}>Off</option></select></label>
    <label class="field">Tone type<select id="cMode">
      <option value="binaural" ${p.mode === 'binaural' ? 'selected' : ''}>Binaural (headphones)</option>
      <option value="isochronic" ${p.mode === 'isochronic' ? 'selected' : ''}>Pulsing (phone speaker)</option></select></label>
    ${p.tones === 'off' ? '' : `<p class="ev ${g.evidence}"><b>${g.band} ${g.beat} Hz on a ${g.carrier} Hz tone. Evidence: ${g.evidence}.</b> ${esc(EVIDENCE[g.evidence])}</p>`}
    <label class="field">Breathing<select id="cMin">${[[2, '2 minutes (quick, less effect)'], [3, '3 minutes'], [5, '5 minutes (recommended)'], [10, '10 minutes']].map(([m, l]) => `<option value="${m}" ${p.minutes === m ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Reciter<select id="cRec">${RECITERS.map(r => `<option value="${r.id}" ${p.reciter === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" id="cQuran" ${p.quran ? 'checked' : ''}> Play the recitation (needs internet)</label>`;
  const bind = (id, k, f = v => v) => $(id).onchange = e => { p[k] = f(e.target.type === 'checkbox' ? e.target.checked : e.target.value); ctx.persist(); renderCalm(); };
  bind('#cBreath', 'breath'); bind('#cHr', 'hr'); bind('#cCue', 'cue'); bind('#cTones', 'tones'); bind('#cMode', 'mode'); bind('#cMin', 'minutes', Number); bind('#cRec', 'reciter'); bind('#cQuran', 'quran');
  renderHistory();
}

function renderHistory() {
  const list = ctx.S.calm, sum = summarize(list);
  $('#calmHistory').hidden = !list.length;
  if (!list.length) return;
  $('#calmTrend').innerHTML = sum.avgDrop === null ? '' : `
    <div class="kv"><span>Sessions</span><span class="num">${sum.count}</span>
    <span>Average tension drop (last 7)</span><span class="num">${sum.avgDrop > 0 ? '−' : ''}${Math.abs(sum.avgDrop)} / 10</span>
    <span>Sessions that helped</span><span class="num">${sum.helpedPct}%</span>
    ${sum.hrDrop != null ? `<span>Average heart-rate change</span><span class="num">${sum.hrDrop > 0 ? '−' : '+'}${Math.abs(sum.hrDrop)} bpm</span>` : ''}
    ${sum.bestGoal ? `<span>Works best for you</span><span>${esc(GOAL[sum.bestGoal].name)}</span>` : ''}</div>`;
  $('#calmList').innerHTML = list.slice(-6).reverse().map(s => `<div class="row"><span>${esc(GOAL[s.goal]?.name || s.goal)} · ${new Date(s.at).toLocaleDateString()}</span><span class="num">${s.before ?? '–'} → ${s.after ?? '–'}${s.hr?.after ? ` · ${s.hr.before}→${s.hr.after} bpm` : ''}</span></div>`).join('');
}

/* ---------- Sheets ---------- */
const openSheet = html => { $('#calmSheetBody').innerHTML = html; $('#calmSheet').hidden = false; };
const closeSheet = () => { $('#calmSheet').hidden = true; };
// One tap on a number answers and moves on: easier than a slider for a shaky hand, and nothing is pre-set,
// so the answer isn't anchored. Skip is always allowed.
const scale = id => `<div class="scale" id="${id}" role="group" aria-label="Tension from 0 (calm) to 10 (the worst it gets)">${Array.from({ length: 11 }, (_, n) => `<button type="button" data-v="${n}">${n}</button>`).join('')}</div>
  <div class="scale-ends muted small"><span>0 calm</span><span>10 the worst it gets</span></div>`;
const onScale = (id, fn) => { $('#' + id).onclick = e => { const b = e.target.closest('[data-v]'); if (b) fn(+b.dataset.v); }; };

function askBefore() {
  const g = GOAL[goalId], p = prefs();
  openSheet(`<div><span class="eyebrow">${esc(g.name)} · ${p.minutes} min</span><h2 class="display h2" id="calmSheetTitle" style="margin-top:6px;font-size:1.3rem">How tense do you feel right now?</h2></div>
    ${scale('cBefore')}
    ${p.tones !== 'off' && p.mode === 'binaural' ? '<p class="muted small" style="margin:0">Headphones in for the background tone. Keep the volume low.</p>' : ''}
    <button class="linkbtn" type="button" id="cGo">Skip and start</button>`);
  const start = async before => {
    unlockAudio(); // inside the tap: phones only allow sound that a tap started
    let hr0 = null;
    if (p.hr) { closeSheet(); hr0 = (await measureCamera({ mode: 'hr', title: 'Heart rate before you start' }))?.bpm ?? null; }
    closeSheet(); begin(before, hr0);
  };
  const go = before => {
    if (needsSupport(before)) return showSupport(() => start(before));
    start(before);
  };
  onScale('cBefore', go);
  $('#cGo').onclick = () => go(null);
}

function showSupport(onContinue) {
  openSheet(`<div><span class="eyebrow" style="color:var(--warn)">You don't have to handle this alone</span><h2 class="display h2" id="calmSheetTitle" style="margin-top:6px;font-size:1.3rem">Get support now</h2></div>
    <div class="finding"><b>If you might hurt yourself or someone else, or you feel unsafe, call your emergency number now.</b>
      <p>UK: 999, or Samaritans on 116 123 (free, 24/7). US: 988. Pakistan: 1122 or 15. Anywhere else: find a free helpline at findahelpline.com.</p></div>
    <p class="muted small" style="margin:0">Sukoon is a short calming exercise. It isn't treatment for an anxiety disorder, depression or panic attacks. If you feel like this often, please talk to your doctor. Seeking treatment is part of tawakkul, not a lack of it: "Make use of medical treatment, for Allah has not made a disease without appointing a remedy for it." (Sunan Abi Dawud 3855)</p>
    <div class="btn-row"><a class="ghost" href="https://findahelpline.com" target="_blank" rel="noopener">Find a helpline</a>${onContinue ? '<button class="cta" type="button" id="cCont">Continue to breathing</button>' : '<button class="cta" type="button" id="cCont">Close</button>'}</div>`);
  $('#cCont').onclick = () => { closeSheet(); onContinue?.(); };
}

/* ---------- Live session ---------- */
function unlockAudio() {
  const p = prefs();
  if (p.tones !== 'off' || p.cue !== false) tones.unlock();
  if (p.quran) unlockPlayer();
}

async function begin(before, hr0 = null) {
  const g = GOAL[goalId], p = prefs();
  unlockAudio(); // also runs inside a tap (the heart-rate Done button) when there was a measurement first
  run = { g, p, before, hr0, at: Date.now(), step: null, t0: 0, raf: 0, audio: null, list: [], idx: 0, tonesOn: false };
  $('#calmLive').hidden = false;
  $('#calmLive').classList.toggle('night', g.id === 'sleep'); // dim, warm and no countdown for winding down
  try { run.lock = await navigator.wakeLock?.request('screen'); } catch {}
  breathe();
}

function setStep(step, eyebrow, title) {
  run.step = step;
  $('#calmEyebrow').textContent = eyebrow; $('#calmTitle').textContent = title;
  $('#calmPacer').hidden = step !== 'breathe';
  $('#calmVerse').hidden = step !== 'listen';
  $('#calmDua').hidden = step !== 'dua';
  $('#calmSkip').textContent = step === 'dua' ? 'Finish' : 'Next';
}

function breathe() {
  const { g, p } = run;
  const cue = p.cue !== false, still = reducedMotion();
  setStep('breathe', `${g.name} · step 1 of 3`, cue ? 'Breathe with the sound, eyes closed if you like' : 'Breathe with the circle');
  if (p.tones !== 'off') run.tonesOn = tones.start({ beat: g.beat, carrier: g.carrier, mode: p.mode, volume: 0.6 });
  const total = p.minutes * 60, start = performance.now(), pat = PATTERNS[p.breath] || PATTERNS.slow, sigh = pat === PATTERNS.sigh;
  const WORD = { in: sigh ? 'Breathe in through your nose' : 'Breathe in', top: 'Top up: one more short breath in', out: sigh ? 'Long, slow breath out' : 'Breathe out' };
  let phase = null;
  const tick = now => {
    if (!run || run.step !== 'breathe') return;
    const t = (now - start) / 1000, b = breathAt(t, pat);
    // Reduced motion: the circle brightens and fades instead of growing and shrinking.
    if (still) $('#calmCircle').style.opacity = 0.35 + 0.65 * b.scale;
    else $('#calmCircle').style.transform = `scale(${0.55 + 0.45 * b.scale})`;
    if (b.phase !== phase) {
      phase = b.phase;
      $('#calmWord').textContent = WORD[phase];
      if (cue) { tones.cue(phase); try { navigator.vibrate?.(phase === 'in' ? 60 : phase === 'top' ? 30 : [40, 80, 40]); } catch {} }
    }
    const left = Math.max(0, Math.ceil(total - t));
    $('#calmClock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (t >= total) return next();
    run.raf = requestAnimationFrame(tick);
  };
  run.raf = requestAnimationFrame(tick);
}

function listen() {
  const { g, p } = run;
  tones.stop(3); // the Quran is listened to in silence (7:204)
  if (!p.quran) return dua();
  setStep('listen', `${g.name} · step 2 of 3`, 'Listen');
  run.list = playlist(g, p.reciter); run.idx = 0;
  $('#calmVerseRef').textContent = passageLabel(g);
  $('#calmVerseText').textContent = `“${g.meaning}” (${g.key})`;
  $('#calmLinks').innerHTML = '';
  if (ctx.linkOnly) return showLinks('Open the recitation, listen, then come back and tap Next.');
  playAyah();
}

// Fallback when the audio can't stream (offline, or a page that blocks outside audio): open the passage on Quran.com.
function showLinks(msg) {
  $('#calmAyah').textContent = msg;
  $('#calmLinks').innerHTML = run.g.passages.map(p => `<a class="ghost" href="${quranComUrl(p)}" target="_blank" rel="noopener">Listen to ${esc(passageLabel({ passages: [p] }))} on Quran.com</a>`).join('');
}

function playAyah() {
  if (!run || run.step !== 'listen') return;
  if (run.idx >= run.list.length) return dua();
  const it = run.list[run.idx];
  $('#calmAyah').textContent = it.basmala ? 'Bismillah' : `Verse ${it.s}:${it.a} · ${run.idx + 1} of ${run.list.length}`;
  // Shows the surah and reciter on the lock screen, with play/pause there.
  try { if (globalThis.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: it.basmala ? 'Bismillah' : `${SURAH[it.s]} ${it.s}:${it.a}`, artist: RECITERS.find(r => r.id === run.p.reciter)?.name || '', album: 'Sukoon' }); } catch {}
  const a = run.audio = player ||= new Audio();
  let src = 0;
  const idx = run.idx, me = run;
  // Safety net: nothing playing after STALL_MS (and not waiting for her tap) → the Quran.com fallback.
  const arm = () => { clearTimeout(me.stall); me.stall = setTimeout(() => { if (run === me && run.step === 'listen' && run.idx === idx && run.audio === a) giveUp(); }, STALL_MS); };
  const giveUp = () => {
    clearTimeout(me.stall); a.onerror = a.onended = a.onplaying = null;
    try { a.pause(); } catch {}
    showLinks('Couldn\'t load the recitation. Check your internet, or open it on Quran.com and tap Next when you\'re done.');
  };
  a.onplaying = () => clearTimeout(me.stall);
  const load = () => { a.src = it.urls[src]; a.play().catch(blocked); };
  // The phone refused to start sound without a tap: ask for one instead of skipping the recitation.
  const blocked = err => {
    if (err?.name !== 'NotAllowedError' || !run || run.step !== 'listen') return;
    clearTimeout(me.stall); // waiting for her tap, not stalled
    $('#calmLinks').innerHTML = '<button class="cta" type="button" id="calmPlay"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play recitation</button>';
    $('#calmPlay').onclick = () => { $('#calmLinks').innerHTML = ''; arm(); a.play().catch(() => {}); };
  };
  a.onended = () => { clearTimeout(me.stall); run.idx++; playAyah(); };
  // If one audio server can't be reached, try the next; after the last, link to Quran.com.
  a.onerror = () => {
    if (++src < it.urls.length) return load();
    giveUp();
  };
  arm(); load();
}

function dua() {
  clearTimeout(run.stall); if (run.audio) { run.audio.onended = run.audio.onerror = run.audio.onplaying = null; run.audio.pause(); }
  tones.stop(2);
  const { g } = run, d = g.dua;
  setStep('dua', `${g.name} · step 3 of 3`, 'Make dua');
  $('#calmDua').innerHTML = `<p class="dua-t">${esc(d.t)}</p><p>${esc(d.m)}</p><span class="muted small">${esc(d.src)}</span>${d.also ? `<p class="muted small" style="margin:8px 0 0">${esc(d.also)}</p>` : ''}`;
}

function next() {
  cancelAnimationFrame(run.raf);
  if (run.step === 'breathe') return listen();
  if (run.step === 'listen') return dua();
  finish(false);
}

function finish(early) {
  if (!run) return;
  cancelAnimationFrame(run.raf);
  clearTimeout(run.stall); if (run.audio) { run.audio.onended = run.audio.onerror = run.audio.onplaying = null; run.audio.pause(); }
  tones.stop(1.5);
  try { run.lock?.release(); } catch {}
  const r = run; run = null;
  $('#calmLive').hidden = true;
  if (r.hr0) {
    openSheet(`<div><span class="eyebrow">Before: ${r.hr0} bpm</span><h2 class="display h2" id="calmSheetTitle" style="margin-top:6px;font-size:1.3rem">Measure your heart rate again</h2></div>
      <p class="muted small" style="margin:0">Same as before: fingertip over the back camera, 15 seconds.</p>
      <button class="cta" type="button" id="cHrAfter">Measure</button><button class="linkbtn" type="button" id="cHrSkip">Skip</button>`);
    $('#cHrAfter').onclick = async () => { closeSheet(); const m = await measureCamera({ mode: 'hr', title: 'Heart rate after' }); rateAfter(r, early, m?.bpm ?? null); };
    $('#cHrSkip').onclick = () => rateAfter(r, early, null);
    return;
  }
  rateAfter(r, early, null);
}

function rateAfter(r, early, hr1) {
  openSheet(`<div><span class="eyebrow">${early ? 'Ended early' : 'Done'}${hr1 ? ` · heart rate ${r.hr0} → ${hr1} bpm` : ''}</span><h2 class="display h2" id="calmSheetTitle" style="margin-top:6px;font-size:1.3rem">How tense do you feel now?</h2></div>
    ${scale('cAfter')}
    <button class="linkbtn" type="button" id="cSave">Skip</button>`);
  const save = after => {
    const minutes = Math.round((Date.now() - r.at) / 6000) / 10;
    ctx.S.calm.push({ at: r.at, goal: r.g.id, before: r.before, after, minutes, early, breath: r.p.breath, hr: r.hr0 && hr1 ? { before: r.hr0, after: hr1 } : undefined });
    ctx.persist(); closeSheet(); renderCalm();
    const d = r.before != null && after != null ? r.before - after : null;
    const hrTxt = r.hr0 && hr1 ? ` Heart rate ${r.hr0} → ${hr1}.` : '';
    ctx.toast((d > 0 ? `Tension down ${d} point${d > 1 ? 's' : ''}. Alhamdulillah.` : d === null ? 'Saved.' : 'Saved. Some days it takes longer, and that\'s normal.') + hrTxt);
    if (after >= 9) showSupport();
  };
  onScale('cAfter', save);
  $('#cSave').onclick = () => save(null);
}
