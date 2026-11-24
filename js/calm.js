// Sukoon screen and live session. Flow: pick a goal → rate tension → breathe (tones optional) → listen → dua → rate again.
import { GOALS, GOAL, EVIDENCE, RECITERS, playlist, passageLabel, quranComUrl, breathAt, breathsPerMin, needsSupport, summarize, SukoonTones } from './sukoon.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ctx; // { S, persist, toast }
let goalId = 'anxiety';
const tones = new SukoonTones();
let run = null; // the live session

const prefs = () => (ctx.S.calmPrefs ||= { tones: 'before', mode: 'binaural', minutes: 3, reciter: RECITERS[0].id, quran: true });

export function initCalm(c) {
  ctx = c; ctx.S.calm ||= [];
  $('#calmGoals').onclick = e => { const b = e.target.closest('[data-goal]'); if (b) { goalId = b.dataset.goal; renderCalm(); } };
  $('#calmStart').onclick = () => askBefore();
  $('#calmSupportLink').onclick = () => showSupport();
  $('#calmSheet').onclick = e => { if (e.target.id === 'calmSheet') closeSheet(); };
  $('#calmEnd').onclick = () => finish(true);
  $('#calmSkip').onclick = () => run && next();
  $('#calmNotSafe').onclick = () => showSupport();
}

export function renderCalm() {
  const g = GOAL[goalId], p = prefs();
  $('#calmGoals').innerHTML = GOALS.map(x => `<button type="button" class="goal ${x.id === goalId ? 'on' : ''}" data-goal="${x.id}" aria-pressed="${x.id === goalId}"><b>${esc(x.name)}</b><span>${esc(x.blurb)}</span></button>`).join('');
  $('#calmDetail').innerHTML = `
    <div class="card-head" style="margin:0"><div><span class="eyebrow">${esc(g.name)}</span><h2 class="display h2" style="margin-top:4px">${esc(passageLabel(g))}</h2></div><span class="chip-note">${g.band} ${g.beat} Hz</span></div>
    <p class="verse">“${esc(g.meaning)}” <span class="muted small">(${esc(g.key)})</span></p>
    <div class="kv">
      <span>Breathing</span><span>${breathsPerMin()} breaths/min · ${p.minutes} min</span>
      <span>Tone</span><span>${p.tones === 'off' ? 'Off' : `${g.band} ${g.beat} Hz on a ${g.carrier} Hz tone`}</span>
      <span>Recitation</span><span>${p.quran ? esc(RECITERS.find(r => r.id === p.reciter)?.name || '') : 'Off'}</span>
    </div>
    ${p.tones === 'off' ? '' : `<p class="ev ${g.evidence}"><b>${g.evidence === 'moderate' ? 'Evidence: moderate' : 'Evidence: weak'}.</b> ${esc(EVIDENCE[g.evidence])}</p>`}`;
  $('#calmSettings').innerHTML = `
    <label class="field">Tones<select id="cTones">
      <option value="before" ${p.tones === 'before' ? 'selected' : ''}>During breathing only, silent for the Quran</option>
      <option value="off" ${p.tones === 'off' ? 'selected' : ''}>Off</option></select></label>
    <label class="field">Tone type<select id="cMode">
      <option value="binaural" ${p.mode === 'binaural' ? 'selected' : ''}>Binaural (headphones)</option>
      <option value="isochronic" ${p.mode === 'isochronic' ? 'selected' : ''}>Pulsing (phone speaker)</option></select></label>
    <label class="field">Breathing<select id="cMin">${[2, 3, 5, 10].map(m => `<option value="${m}" ${p.minutes === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
    <label class="field">Reciter<select id="cRec">${RECITERS.map(r => `<option value="${r.id}" ${p.reciter === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" id="cQuran" ${p.quran ? 'checked' : ''}> Play the recitation (needs internet)</label>`;
  const bind = (id, k, f = v => v) => $(id).onchange = e => { p[k] = f(e.target.type === 'checkbox' ? e.target.checked : e.target.value); ctx.persist(); renderCalm(); };
  bind('#cTones', 'tones'); bind('#cMode', 'mode'); bind('#cMin', 'minutes', Number); bind('#cRec', 'reciter'); bind('#cQuran', 'quran');
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
    ${sum.bestGoal ? `<span>Works best for you</span><span>${esc(GOAL[sum.bestGoal].name)}</span>` : ''}</div>`;
  $('#calmList').innerHTML = list.slice(-6).reverse().map(s => `<div class="row"><span>${esc(GOAL[s.goal]?.name || s.goal)} · ${new Date(s.at).toLocaleDateString()}</span><span class="num">${s.before} → ${s.after ?? '–'}</span></div>`).join('');
}

/* ---------- Sheets ---------- */
const openSheet = html => { $('#calmSheetBody').innerHTML = html; $('#calmSheet').hidden = false; };
const closeSheet = () => { $('#calmSheet').hidden = true; };
const slider = (id, label, v) => `<label class="field slider">${label} <span class="val" id="${id}v">${v}</span><input type="range" min="0" max="10" value="${v}" id="${id}"></label>`;
const bindSlider = id => $('#' + id).oninput = e => $('#' + id + 'v').textContent = e.target.value;

function askBefore() {
  openSheet(`<div><span class="eyebrow">Before you start</span><h2 class="display h2" id="calmSheetTitle" style="margin-top:6px;font-size:1.3rem">How tense do you feel?</h2></div>
    ${slider('cBefore', '0 = completely calm, 10 = the worst it gets', 5)}
    ${prefs().tones !== 'off' && prefs().mode === 'binaural' ? '<p class="muted small" style="margin:0">Put headphones in for binaural tones. Keep the volume low and comfortable.</p>' : ''}
    <button class="cta" type="button" id="cGo">Begin</button>`);
  bindSlider('cBefore');
  $('#cGo').onclick = () => {
    if (prefs().tones !== 'off') tones.unlock();
    const before = +$('#cBefore').value;
    if (needsSupport(before)) return showSupport(() => begin(before));
    closeSheet(); begin(before);
  };
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
async function begin(before) {
  const g = GOAL[goalId], p = prefs();
  run = { g, p, before, at: Date.now(), step: null, t0: 0, raf: 0, audio: null, list: [], idx: 0, tonesOn: false };
  $('#calmLive').hidden = false;
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
  setStep('breathe', `${g.name} · step 1 of 3`, 'Breathe with the circle');
  if (p.tones !== 'off') run.tonesOn = tones.start({ beat: g.beat, carrier: g.carrier, mode: p.mode, volume: 0.6 });
  const total = p.minutes * 60, start = performance.now();
  const tick = now => {
    if (!run || run.step !== 'breathe') return;
    const t = (now - start) / 1000, b = breathAt(t);
    $('#calmCircle').style.transform = `scale(${0.55 + 0.45 * b.scale})`;
    $('#calmWord').textContent = b.phase === 'in' ? 'Breathe in' : 'Breathe out';
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
  const a = run.audio ||= new Audio();
  a.src = it.url; a.onended = () => { run.idx++; playAyah(); };
  a.onerror = () => { a.onerror = a.onended = null; showLinks('Couldn\'t load the recitation here. Open it on Quran.com, then tap Next.'); };
  a.play().catch(() => { if (!$('#calmLinks').innerHTML) $('#calmAyah').textContent = 'Tap Next to continue'; });
}

function dua() {
  if (run.audio) { run.audio.onended = run.audio.onerror = null; run.audio.pause(); }
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
  if (run.audio) { run.audio.onended = run.audio.onerror = null; run.audio.pause(); }
  tones.stop(1.5);
  try { run.lock?.release(); } catch {}
  const r = run; run = null;
  $('#calmLive').hidden = true;
  openSheet(`<div><span class="eyebrow">${early ? 'Ended early' : 'Done'}</span><h2 class="display h2" id="calmSheetTitle" style="margin-top:6px;font-size:1.3rem">How tense do you feel now?</h2></div>
    ${slider('cAfter', '0 = completely calm, 10 = the worst it gets', r.before)}
    <button class="cta" type="button" id="cSave">Save</button>`);
  bindSlider('cAfter');
  $('#cSave').onclick = () => {
    const after = +$('#cAfter').value, minutes = Math.round((Date.now() - r.at) / 6000) / 10;
    ctx.S.calm.push({ at: r.at, goal: r.g.id, before: r.before, after, minutes, early });
    ctx.persist(); closeSheet(); renderCalm();
    const d = r.before - after;
    ctx.toast(d > 0 ? `Tension down ${d} point${d > 1 ? 's' : ''}. Alhamdulillah.` : 'Saved. Some days it takes longer, and that\'s normal.');
    if (after >= 9) showSupport();
  };
}
