// Quran reader: all 114 surahs, Arabic (Tanzil Uthmani) with optional English (Saheeh International),
// verse-by-verse recitation that plays on through the surah, "continue reading", bookmarks, text size,
// and "Memorise" on any verse (it joins the spaced review in Brain → Quran memory).
// Text is bundled in data/quran/ (built by tools/fetch-quran.mjs) so it opens fast and works offline once seen.
import { loadSurah, quranIndex, playAyah, stopAudio, learnVerse } from './brainui.js';
import { RECITERS } from './sukoon.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arNum = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
let ctx, view = { s: null, jump: null }, query = '', playing = null, saveTimer = null, observer = null;

const prefs = () => (ctx.S.reader ||= { size: 1, translation: true, bookmarks: [] });
const calmPrefs = () => (ctx.S.calmPrefs ||= {});

export function initReader(c) {
  ctx = c;
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-rd]'); if (!t) return;
    const [act, arg] = t.dataset.rd.split(':');
    const P = prefs();
    if (act === 'open') { const [s, a] = arg.split('-'); return openSurah(+s, a ? +a : null); }
    if (act === 'list') { view.s = null; stopPlay(); return renderReader(); }
    if (act === 'play') return playFrom(+arg);
    if (act === 'stop') return stopPlay();
    if (act === 'size') { P.size = Math.max(0.8, Math.min(1.8, +(P.size + (+arg)).toFixed(2))); ctx.persist(); return applySize(); }
    if (act === 'tr') { P.translation = !P.translation; ctx.persist(); $('#readerMain')?.classList.toggle('no-tr', !P.translation); t.setAttribute('aria-pressed', P.translation); return; }
    if (act === 'mark') return toggleMark(view.s, +arg, t);
    if (act === 'learn') { stopPlay(); return learnVerse(view.s, +arg); }
    if (act === 'prev' || act === 'next') { const n = view.s + (act === 'next' ? 1 : -1); if (n >= 1 && n <= 114) openSurah(n); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'rdSearch') { query = e.target.value; drawList(); }
    if (e.target.id === 'rdReciter') { calmPrefs().reciter = e.target.value; ctx.persist(); }
  });
}

function openSurah(s, a = null) { view = { s, jump: a }; stopPlay(); renderReader(); }

export async function renderReader() {
  const el = $('#readerMain'); if (!el) return;
  observer?.disconnect();
  if (!view.s) return renderList(el);
  el.innerHTML = '<p class="muted">Loading…</p>';
  let d; try { d = await loadSurah(view.s); } catch { el.innerHTML = `<p class="muted">Couldn't load this surah. Check your connection and try again.</p><button class="ghost" type="button" data-rd="list">‹ All surahs</button>`; return; }
  const P = prefs(), marks = new Set(P.bookmarks.filter(b => b.s === d.s).map(b => b.a));
  const mem = ctx.S.brain?.quran || {};
  el.classList.toggle('no-tr', !P.translation);
  el.innerHTML = `<button type="button" class="linkbtn" data-rd="list" style="align-self:flex-start">‹ All surahs</button>
    <div class="card stack rd-head">
      <div class="ar rd-title" dir="rtl">${esc(d.arName)}</div>
      <b>${d.s}. ${esc(d.name)} · ${esc(d.meaning)}</b>
      <span class="small muted">${d.type === 'Meccan' ? 'Makki' : 'Madani'} · ${d.verses} verses · Juz ${d.juz}</span>
      <div class="rd-tools">
        <button class="cta" type="button" data-rd="play:1" id="rdPlayAll"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play surah</button>
        <div class="rd-row">
          <button class="ghost sm" type="button" data-rd="size:-0.15" aria-label="Smaller text">A−</button>
          <button class="ghost sm" type="button" data-rd="size:0.15" aria-label="Larger text">A+</button>
          <button class="ghost sm" type="button" data-rd="tr" aria-pressed="${P.translation}">Translation</button>
        </div>
        <label class="field small">Reciter<select id="rdReciter">${RECITERS.map(r => `<option value="${r.id}" ${r.id === (calmPrefs().reciter || RECITERS[0].id) ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      </div>
    </div>
    ${d.basmala ? '<p class="ar rd-basmala" dir="rtl" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>' : ''}
    <div class="rd-verses">${d.ayahs.map(v => { const c = mem[`s${d.s}:${v.a}`]; return `<div class="rd-v" id="rv-${v.a}" data-a="${v.a}">
      <p class="ar rd-ar" dir="rtl" lang="ar">${esc(v.ar)} <span class="rd-no">${arNum(v.a)}</span></p>
      <p class="rd-en small">${esc(v.en)}</p>
      <div class="rd-acts"><span class="num rd-ref">${d.s}:${v.a}</span>${c ? '<span class="rd-mem">In memory</span>' : ''}
        <button type="button" class="rd-b" data-rd="play:${v.a}" aria-label="Play from verse ${v.a}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
        <button type="button" class="rd-b ${marks.has(v.a) ? 'on' : ''}" data-rd="mark:${v.a}" aria-label="Bookmark verse ${v.a}" aria-pressed="${marks.has(v.a)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>
        <button type="button" class="rd-b txt" data-rd="learn:${v.a}">Memorise</button></div></div>`; }).join('')}</div>
    <div class="rd-nav">${d.s > 1 ? `<button class="ghost" type="button" data-rd="prev">‹ Surah ${d.s - 1}</button>` : '<span></span>'}${d.s < 114 ? `<button class="ghost" type="button" data-rd="next">Surah ${d.s + 1} ›</button>` : ''}</div>
    <p class="muted small" style="margin:0">Arabic: Tanzil Uthmani text. English: Saheeh International (a translation of the meaning). Recitation: EveryAyah / Quran.com.</p>
    <div class="rd-player" id="rdPlayer" hidden><span id="rdNow"></span><button type="button" class="linkbtn" data-rd="stop">Stop</button></div>`;
  applySize();
  const target = view.jump && $(`#rv-${view.jump}`);
  if (target) target.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
  view.jump = null;
  trackPosition(d);
}

function applySize() { const el = $('#readerMain'); if (el) el.style.setProperty('--rd-size', prefs().size); }

// "Continue reading": remember the first verse on screen, a moment after scrolling stops.
function trackPosition(d) {
  if (!('IntersectionObserver' in globalThis)) return;
  const seen = new Map();
  observer = new IntersectionObserver(es => {
    for (const e of es) seen.set(+e.target.dataset.a, e.isIntersecting);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const top = [...seen].filter(([, v]) => v).map(([a]) => a).sort((x, y) => x - y)[0];
      if (top && view.s === d.s) { ctx.S.reader.last = { s: d.s, a: top, name: d.name, at: Date.now() }; ctx.persist(); }
    }, 800);
  }, { rootMargin: '-20% 0px -50% 0px' });
  document.querySelectorAll('.rd-v').forEach(v => observer.observe(v));
}

function toggleMark(s, a, btn) {
  const P = prefs(), i = P.bookmarks.findIndex(b => b.s === s && b.a === a);
  if (i >= 0) P.bookmarks.splice(i, 1); else P.bookmarks.unshift({ s, a, at: Date.now() });
  ctx.persist();
  btn.classList.toggle('on', i < 0); btn.setAttribute('aria-pressed', i < 0);
  ctx.toast(i < 0 ? `Bookmarked ${s}:${a}` : 'Bookmark removed');
}

/* Recitation: verse by verse from the chosen verse to the end of the surah, following along on screen. */
async function playFrom(a) {
  const d = await loadSurah(view.s);
  stopPlay();
  const token = playing = { s: d.s };
  const step = n => {
    if (playing !== token) return;
    document.querySelectorAll('.rd-v.playing').forEach(x => x.classList.remove('playing'));
    if (n > d.verses) return stopPlay();
    const v = $(`#rv-${n}`); v?.classList.add('playing'); v?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const pl = $('#rdPlayer'); if (pl) { pl.hidden = false; $('#rdNow').textContent = `${d.name} · verse ${n} of ${d.verses}`; }
    playAyah(d.s, n, 1, () => step(n + 1));
  };
  step(a);
}
/** Leaving the reader stops its recitation. */
export function leaveReader() { if (playing) stopPlay(); }
function stopPlay() {
  if (playing) stopAudio();
  playing = null;
  document.querySelectorAll('.rd-v.playing').forEach(x => x.classList.remove('playing'));
  const pl = $('#rdPlayer'); if (pl) pl.hidden = true;
}

/* ---------- Surah list ---------- */
let index = null;
async function renderList(el) {
  try { index = await quranIndex(); } catch { el.innerHTML = '<p class="muted">Couldn\'t load the Quran. Check your connection and try again.</p>'; return; }
  const P = prefs(), last = P.last;
  el.classList.remove('no-tr');
  el.innerHTML = `
    ${last ? `<button type="button" class="card rd-continue" data-rd="open:${last.s}-${last.a}"><span class="eyebrow">Continue reading</span><b>${esc(last.name)} · verse ${last.a}</b></button>` : ''}
    ${P.bookmarks.length ? `<div class="card stack"><b>Bookmarks</b><div class="rd-marks">${P.bookmarks.slice(0, 12).map(b => `<button type="button" class="chip" data-rd="open:${b.s}-${b.a}">${esc(index.surahs[b.s - 1].name)} ${b.s}:${b.a}</button>`).join('')}</div></div>` : ''}
    <label class="field"><span class="sr-only">Find a surah</span><input id="rdSearch" type="search" placeholder="Find a surah: name, number or meaning" value="${esc(query)}" autocomplete="off"></label>
    <div class="list rd-list" id="rdList"></div>
    <p class="muted small" style="margin:0">114 surahs, 6,236 verses. Arabic: Tanzil Uthmani text. English: Saheeh International.</p>`;
  drawList();
}
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function drawList() {
  const box = $('#rdList'); if (!box || !index) return;
  const q = norm(query);
  const hits = index.surahs.filter(m => !q || String(m.s) === q || norm(m.name).includes(q) || norm(m.meaning).includes(q) || norm(m.name.replace(/^(al|an|at|as|ar|az|ad|ash)-/i, '')).includes(q));
  box.innerHTML = hits.map(m => `<button type="button" class="row q-row" data-rd="open:${m.s}"><span class="rd-num num">${m.s}</span><div><b>${esc(m.name)}</b><span class="q-sub small muted">${esc(m.meaning)} · ${m.verses} verses · ${m.type === 'Meccan' ? 'Makki' : 'Madani'}</span></div><span class="ar rd-arname" dir="rtl">${esc(m.arName.replace(/^سُورَةُ\s*/, ''))}</span></button>`).join('') || '<p class="muted small" style="padding:12px 0;margin:0">No surah matches that.</p>';
}
