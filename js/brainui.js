// Brain screen: Brain score, today's brain step, games (Speed Flash, Memory Grid, Colour Clash, Verse Order),
// Quran memorisation with spaced review, Sukoon, and 2-minute lessons. Logic lives in js/brain.js.
import * as B from './brain.js';
import { band } from './scores.js';
import { ayahUrls, RECITERS } from './sukoon.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
let ctx; // { S, persist, toast, go }
let Q = null; // Quran data (data/quran-hifz.json), loaded on first use
let openSet = null;

const brain = () => {
  const b = (ctx.S.brain ||= {});
  b.drills ||= []; b.games ||= []; b.lessons ||= {}; b.quran ||= {}; b.reviews ||= [];
  return b;
};
const reciter = () => ctx.S.calmPrefs?.reciter || RECITERS[0].id;
async function quran() {
  if (Q) return Q;
  const r = await fetch('data/quran-hifz.json');
  Q = await r.json();
  return Q;
}
const extra = {}; // whole surahs from the reader, for memorising any surah (id "s<number>")
const setById = id => Q?.sets.find(s => s.id === id) || extra[id];
const pad3 = n => String(n).padStart(3, '0');
const surahFiles = {};
/** One surah of the full Quran (data/quran/NNN.json), cached. */
export function loadSurah(n) {
  return (surahFiles[n] ||= fetch(`data/quran/${pad3(n)}.json`).then(r => { if (!r.ok) throw new Error('surah ' + n); return r.json(); }).catch(e => { delete surahFiles[n]; throw e; }));
}
let indexP = null;
export const quranIndex = () => (indexP ||= fetch('data/quran/index.json').then(r => r.json()).catch(e => { indexP = null; throw e; }));
/** A memorisation set by id: the short-surah sets, or any whole surah loaded from the reader. */
async function getSet(id) {
  await quran();
  if (setById(id)) return setById(id);
  const m = /^s(\d+)$/.exec(id || ''); if (!m) return null;
  const d = await loadSurah(+m[1]);
  return (extra[id] = { id, s: d.s, name: d.name, meaning: d.meaning, arName: d.arName, ayahs: d.ayahs.map(({ a, ar, en }) => ({ a, ar, en })) });
}
const NICE = { 'Al-Faatiha': 'Al-Fatiha', 'Al-Ikhlaas': 'Al-Ikhlas', 'An-Naas': 'An-Nas', 'Al-Kaafiroon': 'Al-Kafirun', 'Al-Maa\'un': 'Al-Ma\'un', 'At-Takaathur': 'At-Takathur', 'Al-Qaari\'a': 'Al-Qari\'ah', 'Al-Aadiyaat': 'Al-\'Adiyat', 'Az-Zalzala': 'Az-Zalzalah', 'Ad-Dhuhaa': 'Ad-Duha', 'Quraish': 'Quraysh' };
const nice = set => NICE[set.name] || set.name;
const ref = (set, a) => `${set.s}:${a}`;

/* ---------- Audio: one element, unlocked by the tap that starts it ---------- */
let audio = null, audioStop = null;
export function playAyah(s, a, times = 1, onEnd) {
  stopAudio();
  audio ||= new Audio();
  const urls = ayahUrls(s, a, reciter());
  let left = times, u = 0, stopped = false;
  const play = () => { audio.src = urls[u]; audio.play().catch(() => {}); };
  audio.onended = () => { if (stopped) return; if (--left > 0) { u = 0; play(); } else { audioStop = null; onEnd?.(); } };
  audio.onerror = () => { if (stopped) return; if (++u < urls.length) play(); else { ctx.toast('Couldn\'t load the recitation. Check your connection.'); onEnd?.(); } };
  audioStop = () => { stopped = true; audio.pause(); };
  play();
}
export function stopAudio() { audioStop?.(); audioStop = null; }

/* ---------- Overlay (dark session screen) ---------- */
const ov = () => $('#brainPlay');
function openOverlay(title, html) {
  ov().hidden = false;
  ov().innerHTML = `<div class="live-inner scroll"><div class="live-top"><div><span class="eyebrow">${esc(title)}</span><div class="set num" id="bpClock"></div></div><button type="button" class="linkbtn" id="bpClose">Close</button></div><div class="stack bp-body" id="bpBody">${html}</div></div>`;
  $('#bpClose').onclick = closeOverlay;
}
let overlayCleanup = null;
function closeOverlay() { overlayCleanup?.(); overlayCleanup = null; stopAudio(); ov().hidden = true; ov().innerHTML = ''; renderBrain(); if ($('#quran')?.classList.contains('on')) renderQuran(); }
const body = () => $('#bpBody');

export function initBrain(c) {
  ctx = c; brain();
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-brain]'); if (!a) return;
    const [act, arg] = a.dataset.brain.split(':');
    ({ speed: startSpeed, grid: startGrid, clash: startClash, lights: startLights, batak: startBatak, track: startTrack, order: () => startOrder(arg), lesson: () => openLesson(arg), recall: () => openRecall(arg),
      review: startReview, learn: () => startLearn(arg), set: () => { openSet = arg; getSet(arg).then(() => ctx.go('quran')).catch(() => ctx.toast('Couldn\'t load that surah. Check your connection.')); }, sets: () => { openSet = null; renderQuran(); },
      listen: () => listenSet(arg), play: () => { const [sid, n] = arg.split('-'); const set = setById(sid); playAyah(set.s, +n); }, reader: () => ctx.go('reader'),
      next: () => doNext(), games: () => $('#brainGames')?.scrollIntoView({ behavior: 'smooth' }), quran: () => { openSet = null; ctx.go('quran'); } }[act] || (() => {}))();
  });
}

/* ---------- Brain hub ---------- */
const ring = (score, cls) => {
  const C = 2 * Math.PI * 42, v = score ?? 0;
  return `<svg viewBox="0 0 100 100" class="sc-ring ${cls}" role="img" aria-label="Brain score ${score ?? 'not yet'}">
    <circle cx="50" cy="50" r="42" class="trk"/><circle cx="50" cy="50" r="42" class="val" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="50" class="num">${score ?? '–'}</text><text x="50" y="67" class="lbl">/ 100</text></svg>`;
};

export async function renderBrain() {
  const el = $('#brainMain'); if (!el) return;
  const S = ctx.S, b = brain(), now = Date.now();
  const sc = B.brainScore(S, now), bd = band(sc.score), nx = B.brainNext(S, [], now), prog = B.speedProgram(b.drills, now);
  const best = B.bests(b.games), lastSpeed = [...b.drills].filter(d => d.kind === 'speed').sort((x, y) => y.at - x.at)[0];
  const due = B.dueCards(b.quran, now).length, lq = B.lessonQueue(b.lessons, now);
  try { await quran(); } catch {}
  const learning = Q ? Q.sets.map(s => ({ s, p: B.setProgress(s, b.quran) })).filter(x => x.p.started) : [];
  const pill = k => { const v = sc.pillars[k]; return `<div class="bs-pill"><span>${B.PILLAR_NAMES[k]}</span><span class="bs-bar"><i style="width:${v ?? 0}%"></i></span><b class="num">${v ?? '–'}</b></div>`; };
  const dots = prog.of ? `<div class="bs-dots" aria-label="${prog.done} of ${prog.of} sessions">${Array.from({ length: prog.of }, (_, i) => `<i class="${i < prog.done ? 'on' : ''}"></i>`).join('')}</div>` : '';
  const lastTrack = [...b.games].filter(g => g.game === 'track').sort((x, y) => y.at - x.at)[0];
  const gameBest = { lights: best.lights != null ? `Best ${b.games.filter(g => g.game === 'lights' && g.best).reduce((m, g) => Math.min(m, g.best), 9999)} ms` : 'New', batak: best.batak != null ? `Best ${best.batak} hits` : 'New', track: best.track != null ? `Level ${lastTrack.score} · best ${best.track}` : 'New', speed: lastSpeed ? `Level ${lastSpeed.level}` : 'New', grid: best.grid ? `Best ${best.grid}` : 'New', clash: best.clash != null ? `Best ${best.clash}` : 'New', order: best.order != null ? `Best ${best.order}` : 'New' };
  const card = g => `<button type="button" class="game-card g-${g.id}" data-brain="${g.id}"><span class="game-ic">${GAME_IC[g.id]}</span><b>${esc(g.name)}</b><span class="small">${esc(g.sub)}</span><span class="game-best">${esc(gameBest[g.id])}${g.proven ? ' · <em>evidence</em>' : ''}</span></button>`;
  el.innerHTML = `
    <div class="card brain-score ${bd.id}">
      <div class="bs-top">${ring(sc.score, bd.id)}<div><span class="eyebrow">Brain score · last 7 days</span><b class="bs-band">${esc(sc.score == null ? 'Not started' : bd.label)}</b><p class="small muted" style="margin:4px 0 0">${esc(sc.fix)}</p></div></div>
      <div class="bs-pills">${['move', 'sleep', 'calm', 'drill', 'learn'].map(pill).join('')}</div>
      <p class="muted small" style="margin:0">It scores the habits that protect your brain, not game points: exercise counts most.</p>
    </div>
    <div class="card stack next-brain">
      <span class="eyebrow">Your brain step today</span>
      <h2 class="display h2" style="margin:0">${esc(nx.title)}</h2>
      <p class="muted" style="margin:0">${esc(nx.sub)}</p>
      <button class="cta" type="button" data-brain="next">${esc(nx.cta)}</button>
    </div>
    <div class="card stack">
      <div class="card-head"><b>Speed training plan</b><span class="muted small">${prog.phase === 'block' ? 'First block' : prog.phase === 'booster' ? 'Booster' : 'Kept up'}</span></div>
      ${dots}
      <p class="small muted" style="margin:0">${prog.phase === 'maintain' ? `Block done. Your next booster starts ${new Date(prog.nextAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Play any time for fun.` : prog.phase === 'block' ? `${prog.done} of 10 sessions. Aim for 2–3 a week. In the ACTIVE trial, the protection came with booster sessions, so you'll get a short booster every 3 months.` : `${prog.done} of 4 booster sessions. Boosters are what made speed training protective in ACTIVE.`}</p>
    </div>
    <div id="brainGames"><div class="card-head" style="padding:0 4px"><b>Brain games</b><span class="muted small">tap to play</span></div>
      <div class="game-grid">${B.GAMES.filter(g => !g.reflex).map(g => card(g)).join('')}</div></div>
    <div id="reflexGames"><div class="card-head" style="padding:0 4px"><b>Reflex games</b><span class="muted small">how F1 drivers train</span></div>
      <div class="game-grid">${B.GAMES.filter(g => g.reflex).map(g => card(g)).join('')}</div></div>
    <button type="button" class="tile quran-tile" data-brain="quran"><span class="tile-ic quran-ic">${QURAN_IC}</span><span><b>Quran memory</b><span>${due ? `<strong>${due} verse${due === 1 ? '' : 's'} to review today.</strong> ` : ''}${learning.length ? `Learning ${learning.length} surah${learning.length === 1 ? '' : 's'}, ${learning.reduce((a, x) => a + x.p.memorised, 0)} verses memorised.` : 'Learn short surahs and Ayat al-Kursi: listen, fade the words, recite, review.'}</span></span></button>
    <button type="button" class="tile" data-go="reader"><span class="tile-ic quran-ic">${QURAN_IC}</span><span><b>Read the Quran</b><span>All 114 surahs with translation and recitation.${ctx.S.reader?.last ? ` Continue: ${esc(ctx.S.reader.last.name)} ${ctx.S.reader.last.a}.` : ''}</span></span></button>
    <button type="button" class="tile" data-go="calm"><span class="tile-ic"><svg viewBox="0 0 24 24" fill="none" stroke="url(#zoneStroke)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></span><span><b>Calm: Sukoon</b><span>Slow breathing, a recitation and a dua. Stress is what steals your focus.</span></span></button>
    ${lq.recall.length ? `<div class="card stack recall"><span class="eyebrow">Quick recall</span><p style="margin:0">Remember <b>${esc(lq.recall[0].title.toLowerCase())}</b>? Answering from memory makes it stick.</p><button class="ghost" type="button" data-brain="recall:${lq.recall[0].id}">Answer one question</button></div>` : ''}
    <div class="card stack"><div class="card-head"><b>Learn your brain</b><span class="muted small">${lq.read} of ${B.LESSONS.length} read</span></div>
      <div class="list">${B.LESSONS.map((l, i) => `<button type="button" class="row lesson-row ${b.lessons[l.id] ? 'read' : ''} ${lq.next?.id === l.id ? 'next' : ''}" data-brain="lesson:${l.id}"><span class="ln num">${b.lessons[l.id] ? '✓' : i + 1}</span><div><b>${esc(l.title)}</b></div><span class="r">${l.mins} min</span></button>`).join('')}</div></div>
    <details class="card"><summary><b>What's proven, and what isn't</b></summary><div class="stack small" style="margin-top:10px">
      <p style="margin:0"><b>Strongest:</b> regular exercise, good sleep, treating hearing loss, blood pressure and cholesterol, not smoking, and staying social. The Lancet Commission (2024) links 14 such factors to about 45% of dementia cases.</p>
      <p style="margin:0"><b>Speed Flash:</b> modelled on the speed training in the ACTIVE trial, where 10 sessions plus boosters were linked to about 25% fewer dementia diagnoses 20 years later. Speed Flash is our own version, not the study's software.</p>
      <p style="margin:0"><b>Memory Grid and Colour Clash:</b> fun focus and memory games. Like most brain games, they mainly make you better at the game.</p>
      <p style="margin:0"><b>Reflex games:</b> F1 drivers train on light boards like the Batak, react to start lights, and some use object-tracking drills like NeuroTracker. Reaction drills make you faster at reaction drills; studies of object tracking in athletes are mixed. Play them for fun and focus, not as a promise.</p>
      <p style="margin:0"><b>Quran memory:</b> uses spaced review, the most reliable way to remember anything long-term, and the way huffaz have always worked.</p>
      <p style="margin:0">None of this diagnoses or treats any condition. If you're worried about your memory, see a doctor.</p>
    </div></details>`;
}

function doNext() {
  const nx = B.brainNext(ctx.S, [], Date.now());
  if (nx.kind === 'speed') return startSpeed();
  if (nx.kind === 'quran') return startReview();
  if (nx.kind === 'lesson') return openLesson(nx.id);
  if (nx.kind === 'game') return $('#brainGames')?.scrollIntoView({ behavior: 'smooth' });
  ctx.go('quran');
}

const GAME_IC = {
  lights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="20" height="8" rx="4"/><circle cx="7" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="17" cy="12" r="1.8" fill="currentColor"/></svg>',
  batak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="4.5" r="1"/><circle cx="19.5" cy="12" r="1"/><circle cx="12" cy="19.5" r="1"/><circle cx="4.5" cy="12" r="1"/></svg>',
  track: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="7" r="2.5" fill="currentColor"/><circle cx="17" cy="6" r="2.5"/><circle cx="9" cy="17" r="2.5"/><circle cx="18" cy="16" r="2.5" fill="currentColor"/><path d="M8 9l6 5" stroke-dasharray="2 2"/></svg>',
  speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  clash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="9" r="5"/><circle cx="16" cy="9" r="5"/><circle cx="12" cy="16" r="5"/></svg>',
  order: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/><path d="M15 7h4l-2-2M9 17H5l2 2"/></svg>',
};
const QURAN_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="url(#zoneStroke)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5z"/><path d="M12 6v14"/></svg>';

/* ---------- Speed Flash ---------- */
const CAR = '<svg viewBox="0 0 64 40" class="veh"><path d="M6 28v-7l8-9h22l10 9h10a4 4 0 0 1 4 4v3z" fill="currentColor"/><circle cx="18" cy="30" r="6" fill="currentColor" stroke="var(--night)" stroke-width="3"/><circle cx="48" cy="30" r="6" fill="currentColor" stroke="var(--night)" stroke-width="3"/></svg>';
const TRUCK = '<svg viewBox="0 0 64 40" class="veh"><path d="M4 28V8h34v20zM40 28V14h12l8 8v6z" fill="currentColor"/><circle cx="16" cy="30" r="6" fill="currentColor" stroke="var(--night)" stroke-width="3"/><circle cx="50" cy="30" r="6" fill="currentColor" stroke="var(--night)" stroke-width="3"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" class="star"><path d="M12 2l3 7 7 .6-5.4 4.7 1.7 7.2L12 17.8 5.7 21.5l1.7-7.2L2 9.6 9 9z" fill="currentColor"/></svg>';
const TRI = '<svg viewBox="0 0 24 24" class="tri"><path d="M12 4l9 16H3z" fill="currentColor"/></svg>';
const POS = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4 - Math.PI / 2; return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) }; });
const frame = () => new Promise(r => requestAnimationFrame(r));
const wait = ms => new Promise(r => setTimeout(r, ms));

function startSpeed() {
  const b = brain(), stair = new B.Staircase(B.speedStart(b.drills)), prog = B.speedProgram(b.drills);
  let alive = true, trial = 0, shown = [];
  const TRIALS = globalThis.__shredSpeedTrials || B.SPEED.trials; // shortened by the browser test
  overlayCleanup = () => { alive = false; };
  openOverlay('Speed Flash', `
    <div class="stack" id="sfIntro">
      <h2 class="display h2" style="margin:0">Spot the vehicle. Find the star.</h2>
      <p style="margin:0">Keep your eyes on the centre. A car or a truck flashes there, and at the same moment a star flashes somewhere around the edge.</p>
      <p style="margin:0">Then answer two things: <b>which vehicle</b>, and <b>where the star was</b>. The flashes get faster as you improve. Later, triangles appear too, to make the star harder to find.</p>
      <p class="muted small" style="margin:0">${prog.phase === 'block' ? `Session ${prog.done + 1} of 10.` : prog.phase === 'booster' ? `Booster ${prog.done + 1} of 4.` : 'Extra session.'} About 4 minutes. Hold the phone at a normal reading distance.</p>
      <button class="cta" type="button" id="sfGo">Start</button>
    </div>
    <div class="sf-arena" id="sfArena" hidden>
      <div class="sf-centre" id="sfCentre"><span class="sf-fix">+</span></div>
      ${POS.map((p, i) => `<button type="button" class="sf-spot" data-pos="${i}" style="left:${p.x}%;top:${p.y}%" aria-label="Position ${i + 1}"></button>`).join('')}
      <div class="sf-mask" id="sfMask" hidden></div>
    </div>
    <p class="sf-q" id="sfQ" hidden></p>
    <div class="sf-ans btn-row" id="sfVeh" hidden><button type="button" class="ghost" data-v="0">${CAR}<span>Car</span></button><button type="button" class="ghost" data-v="1">${TRUCK}<span>Truck</span></button></div>
    <div class="stack" id="sfDone" hidden></div>`);
  const arena = $('#sfArena'), centre = $('#sfCentre'), mask = $('#sfMask'), q = $('#sfQ'), veh = $('#sfVeh');
  const spots = [...arena.querySelectorAll('.sf-spot')];
  const ask = (sel, attr) => new Promise(res => { const h = e => { const t = e.target.closest(`[${attr}]`); if (!t) return; sel.removeEventListener('click', h); res(+t.getAttribute(attr)); }; sel.addEventListener('click', h); });
  async function run() {
    $('#sfIntro').hidden = true; arena.hidden = false;
    while (alive && trial < TRIALS) {
      trial++; $('#bpClock').textContent = `${trial} / ${TRIALS}`;
      const tr = B.speedTrial(stair.ms);
      arena.classList.remove('answer'); spots.forEach(s => { s.innerHTML = ''; s.className = 'sf-spot'; });
      centre.innerHTML = '<span class="sf-fix">+</span>'; q.hidden = true; veh.hidden = true;
      await wait(600); if (!alive) return;
      // Stimulus on for the requested time, measured by display frames.
      const others = tr.distractors ? [...Array(8).keys()].filter(i => i !== tr.pos).sort(() => Math.random() - 0.5).slice(0, tr.distractors) : [];
      await frame();
      centre.innerHTML = tr.centre ? TRUCK : CAR;
      spots[tr.pos].innerHTML = STAR; others.forEach(i => spots[i].innerHTML = TRI);
      await frame(); const t0 = performance.now();
      while (performance.now() - t0 < tr.ms - 8) await frame();
      centre.innerHTML = ''; spots.forEach(s => s.innerHTML = ''); mask.hidden = false;
      shown.push(Math.round(performance.now() - t0));
      await wait(350); mask.hidden = true; if (!alive) return;
      q.hidden = false; q.textContent = 'Which was in the centre?'; veh.hidden = false;
      const v = await ask(veh, 'data-v'); if (!alive) return;
      veh.hidden = true; q.textContent = 'Where was the star?'; arena.classList.add('answer');
      const p = await ask(arena, 'data-pos'); if (!alive) return;
      arena.classList.remove('answer');
      const ok = v === tr.centre && p === tr.pos;
      spots[tr.pos].classList.add('truth'); if (p !== tr.pos) spots[p].classList.add('wrong');
      centre.innerHTML = `<span class="sf-fb ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span>`; q.hidden = true;
      navigator.vibrate?.(ok ? 15 : [20, 40, 20]);
      stair.answer(ok);
      await wait(500);
    }
    if (!alive) return;
    const ms = stair.threshold(), level = B.speedLevel(ms), acc = stair.accuracy();
    const prev = [...brain().drills].filter(d => d.kind === 'speed').sort((x, y) => y.at - x.at)[0];
    brain().drills.push({ kind: 'speed', at: Date.now(), ms, level, acc, distractors: B.useDistractors(ms) });
    ctx.persist();
    arena.hidden = true; const done = $('#sfDone'); done.hidden = false;
    const p2 = B.speedProgram(brain().drills);
    done.innerHTML = `<h2 class="display h2" style="margin:0">Speed level ${level}</h2>
      <div class="kv"><span>Flash you can catch</span><span class="num">${ms} ms</span><span>Right answers</span><span class="num">${acc}%</span>${prev ? `<span>Last time</span><span class="num">Level ${prev.level}</span>` : ''}</div>
      <p style="margin:0">${prev ? (level > prev.level ? 'Faster than last time. Your brain is processing quicker.' : level === prev.level ? 'Same as last time. Steady practice moves it.' : 'A little slower today. Sleep and stress affect speed; it evens out over sessions.') : 'Your starting point. It usually improves over the first few sessions.'}</p>
      <p class="muted small" style="margin:0">${p2.phase === 'block' ? `${p2.done} of 10 sessions in your first block.` : p2.phase === 'booster' ? `${p2.done} of 4 booster sessions.` : 'Block complete. Next booster in about 3 months.'}</p>
      <button class="cta" type="button" id="sfFin">Done</button>`;
    $('#sfFin').onclick = closeOverlay;
  }
  $('#sfGo').onclick = () => run();
}

/* ---------- Memory Grid ---------- */
function startGrid() {
  let st = { span: B.GRID.startSpan, lives: B.GRID.lives, best: 0 }, alive = true;
  overlayCleanup = () => { alive = false; };
  openOverlay('Memory Grid', `<p style="margin:0" id="mgMsg">Watch the tiles light up, then tap them in the same order.</p>
    <div class="mg-grid" id="mgGrid">${Array.from({ length: B.GRID.size }, (_, i) => `<button type="button" class="mg-t" data-t="${i}" aria-label="Tile ${i + 1}"></button>`).join('')}</div>
    <div class="mg-stat"><span>Length <b class="num" id="mgSpan">${st.span}</b></span><span>Lives <b class="num" id="mgLives">${'♥'.repeat(st.lives)}</b></span></div>
    <button class="cta" type="button" id="mgGo">Start</button>`);
  const grid = $('#mgGrid'), tiles = [...grid.children], msg = $('#mgMsg');
  async function round() {
    $('#mgGo').hidden = true; grid.classList.add('watch');
    $('#mgSpan').textContent = st.span; $('#mgLives').textContent = '♥'.repeat(st.lives);
    msg.textContent = 'Watch…';
    const seq = B.gridSequence(st.span);
    await wait(600);
    for (const t of seq) { if (!alive) return; tiles[t].classList.add('lit'); await wait(480); tiles[t].classList.remove('lit'); await wait(220); }
    grid.classList.remove('watch'); msg.textContent = 'Your turn: tap them in order.';
    let i = 0;
    const ok = await new Promise(res => {
      grid.onclick = e => {
        const t = e.target.closest('[data-t]'); if (!t) return;
        const n = +t.dataset.t;
        t.classList.add(n === seq[i] ? 'hit' : 'miss'); setTimeout(() => t.classList.remove('hit', 'miss'), 250);
        if (n !== seq[i]) { grid.onclick = null; return res(false); }
        if (++i === seq.length) { grid.onclick = null; res(true); }
      };
    });
    if (!alive) return;
    navigator.vibrate?.(ok ? 15 : [20, 40, 20]);
    st = B.gridNext(st, ok);
    msg.textContent = ok ? `Right! Now ${st.span} tiles.` : st.over ? 'Game over.' : 'Not quite. Same length again.';
    if (st.over) return finish();
    await wait(900); round();
  }
  function finish() {
    const b = brain(), prev = B.bests(b.games).grid;
    b.games.push({ game: 'grid', at: Date.now(), score: st.best }); ctx.persist();
    body().insertAdjacentHTML('beforeend', `<div class="stack"><h2 class="display h2" style="margin:0">You remembered ${st.best} in a row</h2><p class="muted" style="margin:0">${prev && st.best > prev ? 'A new personal best!' : prev ? `Your best is ${prev}.` : 'Most adults manage 5 to 7.'}</p><div class="btn-row"><button class="ghost" type="button" id="mgAgain">Play again</button><button class="cta" type="button" id="mgFin">Done</button></div></div>`);
    $('#mgAgain').onclick = startGrid; $('#mgFin').onclick = closeOverlay;
  }
  $('#mgGo').onclick = round;
}

/* ---------- Colour Clash ---------- */
function startClash() {
  let alive = true, trials = [], cur = null, shownAt = 0, end = 0;
  overlayCleanup = () => { alive = false; };
  openOverlay('Colour Clash', `<p style="margin:0" id="ccMsg">Tap the colour of the <b>ink</b>, not the word. 45 seconds. Be fast, but right.</p>
    <div class="cc-word" id="ccWord"></div>
    <div class="cc-btns" id="ccBtns">${B.CLASH.colours.map((c, i) => `<button type="button" class="cc-b" data-c="${i}" style="--c:${c.hex}" aria-label="${c.id}"></button>`).join('')}</div>
    <div class="mg-stat"><span>Right <b class="num" id="ccRight">0</b></span><span>Wrong <b class="num" id="ccWrong">0</b></span></div>
    <button class="cta" type="button" id="ccGo">Start</button>`);
  const word = $('#ccWord');
  const show = () => { cur = B.clashTrial(); const c = B.CLASH.colours; word.textContent = c[cur.word].word; word.style.color = c[cur.ink].hex; shownAt = performance.now(); };
  const tick = () => { if (!alive) return; const left = Math.max(0, end - performance.now()); $('#bpClock').textContent = `${Math.ceil(left / 1000)} s`; if (left <= 0) return finish(); setTimeout(tick, 200); };
  $('#ccBtns').onclick = e => {
    const t = e.target.closest('[data-c]'); if (!t || !cur || !end) return;
    const ok = +t.dataset.c === cur.ink;
    trials.push({ ok, match: cur.match, rt: performance.now() - shownAt });
    $('#ccRight').textContent = trials.filter(x => x.ok).length; $('#ccWrong').textContent = trials.filter(x => !x.ok).length;
    word.classList.remove('flash-ok', 'flash-no'); void word.offsetWidth; word.classList.add(ok ? 'flash-ok' : 'flash-no');
    if (!ok) navigator.vibrate?.(30);
    show();
  };
  $('#ccGo').onclick = () => { $('#ccGo').hidden = true; $('#ccMsg').textContent = 'Ink colour, not the word!'; end = performance.now() + B.CLASH.seconds * 1000; show(); tick(); };
  function finish() {
    end = 0; cur = null; word.textContent = '';
    const s = B.clashScore(trials), b = brain(), prev = B.bests(b.games).clash;
    b.games.push({ game: 'clash', at: Date.now(), score: s.score, meanRT: s.meanRT, interference: s.interference }); ctx.persist();
    body().insertAdjacentHTML('beforeend', `<div class="stack"><h2 class="display h2" style="margin:0">Score ${s.score}</h2>
      <div class="kv"><span>Right</span><span class="num">${s.right}</span><span>Wrong</span><span class="num">${s.wrong}</span>${s.meanRT ? `<span>Average answer</span><span class="num">${s.meanRT} ms</span>` : ''}${s.interference != null ? `<span>Slower on tricky words by</span><span class="num">${s.interference} ms</span>` : ''}</div>
      <p class="muted small" style="margin:0">${prev != null && s.score > prev ? 'A new personal best!' : prev != null ? `Your best is ${prev}.` : 'The tricky words slow everyone down: that delay is your brain overriding a habit.'}</p>
      <div class="btn-row"><button class="ghost" type="button" id="ccAgain">Play again</button><button class="cta" type="button" id="ccFin">Done</button></div></div>`);
    $('#ccAgain').onclick = startClash; $('#ccFin').onclick = closeOverlay;
  }
}


/* ---------- Lights Out (F1 start) ---------- */
function startLights() {
  let alive = true, results = [], state = 'idle', outAt = 0, timers = [];
  overlayCleanup = () => { alive = false; timers.forEach(clearTimeout); };
  openOverlay('Lights Out', `<p style="margin:0" id="loMsg">Five red lights come on, one a second. When they <b>all go out</b>, tap as fast as you can. Tap before that and it's a jump start.</p>
    <div class="lo-gantry" id="loG">${'<div class="lo-pod"><i></i><i></i></div>'.repeat(5)}</div>
    <button type="button" class="lo-pad" id="loPad">Tap here</button>
    <div class="lo-times" id="loTimes"></div>
    <div id="loEnd"></div>`);
  const pods = [...$('#loG').children], pad = $('#loPad'), msg = $('#loMsg');
  const set = n => pods.forEach((p, i) => p.classList.toggle('on', i < n));
  const later = (fn, ms) => timers.push(setTimeout(() => alive && fn(), ms));
  const drawTimes = () => { $('#loTimes').innerHTML = results.map((r, i) => `<span class="${r == null ? 'jump' : ''}">${i + 1}. ${r == null ? 'Jump start' : `${(r / 1000).toFixed(3)} s`}</span>`).join(''); $('#bpClock').textContent = `Start ${Math.min(results.length + 1, B.LIGHTS.starts)} of ${B.LIGHTS.starts}`; };
  function go() {
    state = 'lights'; set(0); pad.textContent = 'Wait for lights out…'; pad.classList.remove('ready');
    for (let n = 1; n <= 5; n++) later(() => set(n), n * B.LIGHTS.gap);
    later(() => { set(0); state = 'out'; outAt = performance.now(); }, 5 * B.LIGHTS.gap + B.lightsHold());
  }
  pad.addEventListener('pointerdown', () => {
    if (state === 'idle') { msg.textContent = 'Eyes on the lights. Tap when they go out.'; return go(); }
    if (state === 'lights') { timers.forEach(clearTimeout); timers = []; set(0); results.push(null); state = 'wait'; pad.textContent = 'Jump start! Tap for the next start'; navigator.vibrate?.([30, 40, 30]); drawTimes(); return next(); }
    if (state === 'out') {
      const rt = Math.round(performance.now() - outAt); results.push(rt < B.LIGHTS.minHuman ? null : rt); state = 'wait';
      pad.textContent = rt < B.LIGHTS.minHuman ? 'Too quick to be real: jump start' : `${(rt / 1000).toFixed(3)} s`; navigator.vibrate?.(15); drawTimes(); return next();
    }
    if (state === 'wait' && results.length < B.LIGHTS.starts) go();
  });
  function next() {
    if (results.length < B.LIGHTS.starts) { later(() => { if (state === 'wait') pad.textContent += ' · tap for the next start'; }, 400); return; }
    state = 'done';
    const s = B.lightsScore(results), b = brain(), prev = b.games.filter(g => g.game === 'lights' && g.best).reduce((m, g) => Math.min(m, g.best), Infinity);
    b.games.push({ game: 'lights', at: Date.now(), score: s.score, best: s.best, avg: s.avg, jumps: s.jumps }); ctx.persist();
    $('#loEnd').innerHTML = `<div class="stack"><h2 class="display h2" style="margin:0">${esc(s.label)}</h2>
      <div class="kv">${s.avg != null ? `<span>Average</span><span class="num">${(s.avg / 1000).toFixed(3)} s</span><span>Best</span><span class="num">${(s.best / 1000).toFixed(3)} s</span>` : ''}<span>Jump starts</span><span class="num">${s.jumps}</span></div>
      <p class="muted small" style="margin:0">F1 drivers react in about 0.2 s, measured by the car. A phone screen and touch add their own delay, so beat your own best on this phone.${s.best && s.best < prev ? ' <b>New personal best!</b>' : ''}</p>
      <div class="btn-row"><button class="ghost" type="button" id="loAgain">Race again</button><button class="cta" type="button" id="loFin">Done</button></div></div>`;
    $('#loAgain').onclick = startLights; $('#loFin').onclick = closeOverlay;
    pad.hidden = true;
  }
  drawTimes(); $('#bpClock').textContent = '';
}

/* ---------- Reaction Wall (Batak) ---------- */
function startBatak() {
  let alive = true, lit = -1, hits = 0, misses = 0, end = 0;
  overlayCleanup = () => { alive = false; };
  const pos = Array.from({ length: B.BATAK.lights }, (_, i) => { const a = i * 2 * Math.PI / B.BATAK.lights - Math.PI / 2; return { x: 50 + 42 * Math.cos(a), y: 50 + 42 * Math.sin(a) }; });
  openOverlay('Reaction Wall', `<p style="margin:0" id="bkMsg">A light comes on somewhere on the ring. Hit it, and the next one lights up. 30 seconds: how many can you hit?</p>
    <div class="bk-ring" id="bkRing">${pos.map((p, i) => `<button type="button" class="bk-l" data-l="${i}" style="left:${p.x}%;top:${p.y}%" aria-label="Light ${i + 1}"></button>`).join('')}<div class="bk-score"><b class="num" id="bkHits">0</b><span>hits</span></div></div>
    <button class="cta" type="button" id="bkGo">Start</button><div id="bkEnd"></div>`);
  const ls = [...$('#bkRing').querySelectorAll('.bk-l')];
  const light = () => { if (lit >= 0) ls[lit].classList.remove('on'); lit = B.batakNext(lit); ls[lit].classList.add('on'); };
  $('#bkRing').addEventListener('pointerdown', e => {
    const t = e.target.closest('[data-l]'); if (!t || !end) return;
    if (+t.dataset.l === lit) { hits++; $('#bkHits').textContent = hits; t.classList.add('hit'); setTimeout(() => t.classList.remove('hit'), 160); light(); }
    else { misses++; t.classList.add('miss'); setTimeout(() => t.classList.remove('miss'), 200); }
  });
  const tick = () => { if (!alive) return; const left = Math.max(0, end - performance.now()); $('#bpClock').textContent = `${Math.ceil(left / 1000)} s`; if (left <= 0) return finish(); setTimeout(tick, 100); };
  $('#bkGo').onclick = () => { $('#bkGo').hidden = true; $('#bkMsg').textContent = 'Go!'; end = performance.now() + (globalThis.__shredBatakSeconds || B.BATAK.seconds) * 1000; light(); tick(); };
  function finish() {
    end = 0; if (lit >= 0) ls[lit].classList.remove('on');
    const b = brain(), prev = B.bests(b.games).batak;
    b.games.push({ game: 'batak', at: Date.now(), score: hits, misses }); ctx.persist();
    $('#bkEnd').innerHTML = `<div class="stack"><h2 class="display h2" style="margin:0">${hits} hits</h2>
      <p class="muted small" style="margin:0">${misses ? `${misses} wrong taps. ` : ''}${prev != null && hits > prev ? 'New personal best! ' : prev != null ? `Your best is ${prev}. ` : ''}That's ${(hits / B.BATAK.seconds).toFixed(1)} a second. Drivers use this kind of board to sharpen hand–eye speed and peripheral vision.</p>
      <div class="btn-row"><button class="ghost" type="button" id="bkAgain">Play again</button><button class="cta" type="button" id="bkFin">Done</button></div></div>`;
    $('#bkAgain').onclick = startBatak; $('#bkFin').onclick = closeOverlay;
  }
}

/* ---------- Tracker (multiple-object tracking) ---------- */
function startTrack() {
  const b = brain(), last = [...b.games].filter(g => g.game === 'track').sort((x, y) => y.at - x.at)[0];
  let alive = true, speed = last ? Math.max(B.TRACK.min, last.speed / B.TRACK.step) : B.TRACK.startSpeed, round = 0, bestSpeed = 0, perfectRounds = 0;
  const ROUNDS = globalThis.__shredTrackRounds || B.TRACK.rounds, SECS = globalThis.__shredTrackSeconds || B.TRACK.seconds;
  overlayCleanup = () => { alive = false; };
  openOverlay('Tracker', `<p style="margin:0" id="tkMsg">3 balls flash green. Then they all look the same and move around. Keep your eyes on the 3, then tap them when they stop.</p>
    <div class="tk-box" id="tkBox"></div><button class="cta" type="button" id="tkGo">Start</button><div id="tkEnd"></div>`);
  const box = $('#tkBox'), msg = $('#tkMsg');
  async function playRound() {
    round++; $('#bpClock').textContent = `Round ${round} of ${ROUNDS}`;
    const balls = B.trackSetup();
    box.innerHTML = balls.map((x, i) => `<button type="button" class="tk-b ${x.target ? 'tgt' : ''}" data-b="${i}"></button>`).join('');
    const els = [...box.children];
    const draw = () => balls.forEach((x, i) => { els[i].style.left = `${x.x * 100}%`; els[i].style.top = `${x.y * 100}%`; });
    draw(); msg.textContent = 'Remember the green balls…'; box.classList.remove('pick');
    await wait(1800); if (!alive) return;
    els.forEach(e => e.classList.remove('tgt')); msg.textContent = 'Follow them…';
    let t = performance.now(); const stop = t + SECS * 1000;
    while (alive && performance.now() < stop) { await frame(); const n = performance.now(); B.trackStep(balls, Math.min(0.05, (n - t) / 1000), speed); t = n; draw(); }
    if (!alive) return;
    msg.textContent = `Tap the ${B.TRACK.targets} you followed.`; box.classList.add('pick');
    const picked = await new Promise(res => { const got = new Set(); box.onclick = e => { const el = e.target.closest('[data-b]'); if (!el || got.has(+el.dataset.b)) return; got.add(+el.dataset.b); el.classList.add('picked'); if (got.size === B.TRACK.targets) { box.onclick = null; res([...got]); } }; });
    const right = picked.filter(i => balls[i].target).length, perfect = right === B.TRACK.targets;
    balls.forEach((x, i) => { if (x.target) els[i].classList.add('truth'); if (picked.includes(i) && !x.target) els[i].classList.add('wrongpick'); });
    msg.textContent = perfect ? 'All 3! Faster next round.' : `${right} of 3. A bit slower next round.`;
    navigator.vibrate?.(perfect ? 15 : [20, 40, 20]);
    if (perfect) { perfectRounds++; bestSpeed = Math.max(bestSpeed, speed); }
    speed = B.trackNext(speed, perfect);
    await wait(1300);
    if (round < ROUNDS) return playRound();
    const level = B.trackLevel(bestSpeed || B.TRACK.min), prev = B.bests(brain().games).track;
    brain().games.push({ game: 'track', at: Date.now(), score: level, speed: bestSpeed || speed, perfect: perfectRounds }); ctx.persist();
    $('#tkEnd').innerHTML = `<div class="stack"><h2 class="display h2" style="margin:0">Tracking level ${level}</h2>
      <p class="muted small" style="margin:0">${perfectRounds} of ${ROUNDS} rounds perfect. ${prev != null && level > prev ? 'New personal best! ' : ''}This trains holding attention on several moving things at once, like reading traffic or a game.</p>
      <div class="btn-row"><button class="ghost" type="button" id="tkAgain">Play again</button><button class="cta" type="button" id="tkFin">Done</button></div></div>`;
    $('#tkAgain').onclick = startTrack; $('#tkFin').onclick = closeOverlay;
  }
  $('#tkGo').onclick = () => { $('#tkGo').hidden = true; playRound(); };
}

/* ---------- Verse Order (Quran game) ---------- */
async function startOrder(setId) {
  await quran();
  const b = brain();
  // Default: the surah being learned most recently, else Al-Fatiha.
  const recent = Object.entries(b.quran).sort((x, y) => (y[1].last || 0) - (x[1].last || 0))[0]?.[0].split(':')[0];
  let set = null;
  try { set = await getSet(setId) || await getSet(recent); } catch {}
  set ||= Q.sets[0];
  const parts = set.ayahs.flatMap(a => B.chunks(B.words(a.ar)).map((ws, i, all) => ({ a: a.a, ws, part: all.length > 1 ? `${i + 1}/${all.length}` : '' })));
  let k = 0, firstTry = 0, total = 0, alive = true;
  overlayCleanup = () => { alive = false; };
  openOverlay(`Verse Order · ${nice(set)}`, `<p style="margin:0" class="muted">Tap the words in the right order (right to left). Tap a placed word to undo it.</p>
    <div class="vo-ref" id="voRef"></div><div class="vo-line ar" dir="rtl" id="voLine"></div><div class="vo-bank ar" dir="rtl" id="voBank"></div>
    <div class="btn-row"><button class="ghost" type="button" id="voHear">Hear it</button><button class="ghost" type="button" id="voSkip">Show answer</button></div>`);
  const line = $('#voLine'), bank = $('#voBank');
  function show() {
    if (!alive) return;
    if (k >= parts.length) return finish();
    const p = parts[k], sh = B.shuffleWords(p.ws);
    let placed = [], missed = false;
    $('#voRef').textContent = `Verse ${p.a}${p.part ? ` · part ${p.part}` : ''} · ${k + 1} of ${parts.length}`;
    $('#bpClock').textContent = `${firstTry} right first time`;
    const draw = () => {
      line.innerHTML = placed.map((n, u) => `<button type="button" class="vo-w placed" data-u="${u}">${esc(sh[n].w)}</button>`).join('') || '<span class="muted small">…</span>';
      bank.innerHTML = sh.map((x, n) => placed.includes(n) ? '' : `<button type="button" class="vo-w" data-n="${n}">${esc(x.w)}</button>`).join('');
    };
    draw();
    bank.onclick = e => {
      const t = e.target.closest('[data-n]'); if (!t) return;
      const n = +t.dataset.n;
      // Right if it's the next word (a word that appears twice in the verse can be either copy).
      if (sh[n].w !== p.ws[placed.length]) { missed = true; t.classList.add('miss'); navigator.vibrate?.(30); setTimeout(() => t.classList.remove('miss'), 300); return; }
      placed.push(n); draw();
      if (placed.length === p.ws.length) { if (!missed) firstTry++; line.classList.add('done'); setTimeout(() => { line.classList.remove('done'); k++; show(); }, 700); }
    };
    line.onclick = e => { const t = e.target.closest('[data-u]'); if (!t) return; placed = placed.slice(0, +t.dataset.u); draw(); };
    $('#voHear').onclick = () => playAyah(set.s, p.a);
    $('#voSkip').onclick = () => { missed = true; placed = p.ws.map((w, i) => sh.findIndex((x, n) => x.i === i)); draw(); setTimeout(() => { k++; show(); }, 1400); };
  }
  function finish() {
    const b2 = brain(); b2.games.push({ game: 'order', at: Date.now(), score: firstTry, set: set.id }); ctx.persist();
    body().innerHTML = `<h2 class="display h2" style="margin:0">${firstTry} of ${parts.length} right first time</h2><p class="muted" style="margin:0">${nice(set)} in order. Recite it once more aloud while it's fresh.</p><button class="cta" type="button" id="voFin">Done</button>`;
    $('#voFin').onclick = closeOverlay;
  }
  show();
}

/* ---------- Quran memory screen ---------- */
export async function renderQuran() {
  const el = $('#quranMain'); if (!el) return;
  try { await quran(); } catch { el.innerHTML = '<p class="muted">Couldn\'t load the Quran text. Check your connection and try again.</p>'; return; }
  const b = brain(), due = B.dueCards(b.quran).length;
  let set = null;
  try { set = openSet && await getSet(openSet); } catch {}
  if (!set) {
    // Whole surahs started from the reader (not in the short-surah list).
    const ids = [...new Set(Object.keys(b.quran).map(k => k.split(':')[0]))].filter(id => !Q.sets.some(x => x.id === id));
    let extraHtml = '';
    if (ids.length) {
      let idx = null; try { idx = await quranIndex(); } catch {}
      extraHtml = `<div class="card stack"><b>Also learning</b><div class="list">${ids.map(id => { const n = +id.slice(1), m = idx?.surahs[n - 1]; const started = Object.keys(b.quran).filter(k => k.startsWith(id + ':')).length; return `<button type="button" class="row q-row" data-brain="set:${id}"><span class="q-num num">${n}</span><div><b>${esc(m?.name || 'Surah ' + n)}</b> <span class="ar q-ar" dir="rtl">${esc((m?.arName || '').replace(/^سُورَةُ\s*/, ''))}</span><span class="q-sub small muted">${started} of ${m?.verses ?? '?'} verses started</span></div></button>`; }).join('')}</div></div>`;
    }
    el.innerHTML = `
      <p class="muted" style="margin:0">Learn a verse at a time: listen, read along, fade the words away, recite from memory. Then review on a schedule so it stays.</p>
      ${due ? `<div class="card stack due-card"><b>${due} verse${due === 1 ? '' : 's'} to review today</b><p class="small muted" style="margin:0">Recite each one from memory, then check yourself.</p><button class="cta" type="button" data-brain="review">Review now</button></div>` : ''}
      <div class="list q-sets">${Q.sets.map(s => { const p = B.setProgress(s, b.quran); return `<button type="button" class="row q-row" data-brain="set:${s.id}"><span class="q-num num">${s.id === 'kursi' ? '2:255' : s.id === 'baqarah-end' ? '2:285' : s.s}</span><div><b>${esc(nice(s))}</b> <span class="ar q-ar" dir="rtl">${esc(s.arName.replace(/^سُورَةُ\s*/, ''))}</span><span class="q-sub small muted">${esc(s.meaning)} · ${s.ayahs.length} verse${s.ayahs.length === 1 ? '' : 's'}</span>${p.started ? `<span class="bs-bar q-bar"><i style="width:${Math.max(4, Math.round(100 * p.started / p.total))}%" class="started"></i><i style="width:${p.pct}%"></i></span>` : ''}</div><span class="r">${p.memorised ? `${p.memorised}/${p.total}` : p.started ? 'Learning' : ''}</span></button>`; }).join('')}</div>
      ${extraHtml}
      <button type="button" class="tile" data-brain="reader"><span class="tile-ic quran-ic">${QURAN_IC}</span><span><b>Read the full Quran</b><span>All 114 surahs with translation and recitation. Memorise any surah from there.</span></span></button>
      <details class="card"><summary><b>How the review schedule works</b></summary><div class="stack small" style="margin-top:10px">
        <p style="margin:0">Each time you recite a verse well from memory, its next review moves further away: 1 day, 3 days, a week, 2 weeks, a month and beyond. Stumble, and it comes back sooner. A verse counts as memorised after 4 good reviews.</p>
        <p style="margin:0">This is spaced repetition, the most reliable method for long-term memory, and the same idea as daily muraja'ah. The Prophet ﷺ said to keep reciting the Quran, because it slips away faster than a camel from its rope (Bukhari 5033, Muslim 791).</p>
        <p style="margin:0">You mark yourself, so be honest. If you can, recite to someone who knows it, or a teacher, to check your tajweed.</p>
      </div></details>
      <p class="muted small" style="margin:0">Arabic: Tanzil Uthmani text. English: Saheeh International. Recitation: ${esc(RECITERS.find(r => r.id === reciter())?.name || 'Mishary Alafasy')} (change it in Sukoon settings).</p>`;
    return;
  }
  const p = B.setProgress(set, b.quran);
  el.innerHTML = `<button type="button" class="linkbtn" data-brain="sets" style="align-self:flex-start">‹ All surahs</button>
    <div class="card stack q-head"><div class="ar q-title" dir="rtl">${esc(set.arName)}</div><b>${esc(nice(set))} · ${esc(set.meaning)}</b>
      <span class="small muted">${p.memorised} of ${p.total} memorised${p.started > p.memorised ? `, ${p.started - p.memorised} learning` : ''}</span>
      <div class="btn-row"><button class="cta" type="button" data-brain="learn:${set.id}">${p.started ? 'Practise' : 'Start learning'}</button><button class="ghost" type="button" data-brain="listen:${set.id}">Listen ×3</button></div>
      <button class="ghost" type="button" data-brain="order:${set.id}">Play Verse Order</button></div>
    ${set.ayahs.map(a => { const c = b.quran[B.cardId(set.id, a.a)]; return `<div class="card stack ayah-card" id="ay-${set.id}-${a.a}">
      <div class="ay-top"><span class="ay-n num">${ref(set, a.a)}</span><span class="ay-st ${c ? (c.box >= B.MEMORISED_BOX ? 'mem' : 'lrn') : ''}">${c ? (c.box >= B.MEMORISED_BOX ? 'Memorised' : `Learning · next review ${new Date(c.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`) : 'New'}</span><button type="button" class="ay-play" data-brain="play:${set.id}-${a.a}" aria-label="Play verse ${a.a}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button></div>
      <p class="ar ay-ar" dir="rtl" lang="ar">${esc(a.ar)}</p><p class="small muted" style="margin:0">${esc(a.en)}</p></div>`; }).join('')}`;
}

/** Listen to the whole surah, each verse three times (the classic way to start memorising). */
function listenSet(id) {
  const set = setById(id); if (!set) return;
  let i = 0;
  const nextAyah = () => {
    document.querySelectorAll('.ayah-card.playing').forEach(x => x.classList.remove('playing'));
    if (i >= set.ayahs.length) return;
    const a = set.ayahs[i++], card = $(`#ay-${set.id}-${a.a}`);
    card?.classList.add('playing'); card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playAyah(set.s, a.a, 3, nextAyah);
  };
  nextAyah();
}

/* Practice: for each verse, listen and read → fade the words in steps → recite from first-letter cues → check → grade. */
const STEPS = ['Listen and read along', 'Some words hidden', 'More words hidden', 'Recite from the first letters'];
function ayahHtml(a, level) {
  const ws = B.words(a.ar), f = B.fade(ws, level);
  return f.map(x => x.hidden ? `<span class="fl">${esc(B.cue(x.w))}</span>` : esc(x.w)).join(' ');
}
async function startLearn(id, only) {
  let set = null; try { set = await getSet(id); } catch {}
  if (!set) return ctx.toast('Couldn\'t load that surah. Check your connection.');
  if (only) { const a = set.ayahs.find(x => x.a === only); if (a) return practise(set, [a], 'learn'); }
  const b = brain();
  // Start with verses not yet learned; if all started, practise those due first, then the rest.
  const order = [...set.ayahs].sort((x, y) => { const cx = b.quran[B.cardId(set.id, x.a)], cy = b.quran[B.cardId(set.id, y.a)]; return (cx ? cx.due : -1) - (cy ? cy.due : -1); });
  const queue = [order.find(a => !b.quran[B.cardId(set.id, a.a)]) || order[0]];
  // New learners: 1–3 new verses per sitting, depending on length.
  for (const a of order) { if (queue.length >= 3 || queue.includes(a)) continue; if (!b.quran[B.cardId(set.id, a.a)] && B.words(a.ar).length <= 12) queue.push(a); }
  queue.sort((x, y) => x.a - y.a);
  practise(set, queue, 'learn');
}
async function startReview() {
  const ids = B.dueCards(brain().quran);
  if (!ids.length) return ctx.toast('Nothing to review today.');
  const items = [];
  for (const id of ids) {
    const [sid, a] = id.split(':');
    let set = null; try { set = await getSet(sid); } catch {}
    const ay = set?.ayahs.find(x => x.a === +a); if (ay) items.push({ set, a: ay });
  }
  if (!items.length) return ctx.toast('Couldn\'t load your verses. Check your connection.');
  practise(null, items, 'review');
}
/** From the reader: memorise one verse (or the next verses) of any surah. */
export function learnVerse(s, a) { return startLearn(`s${s}`, a); }
function practise(set, list, mode) {
  let i = 0, level = mode === 'review' ? 3 : 0, revealed = false, done = 0;
  const item = () => mode === 'review' ? list[i] : { set, a: list[i] };
  openOverlay(mode === 'review' ? 'Quran review' : `Learning · ${nice(set)}`, '<div id="prBox" class="stack"></div>');
  const box = $('#prBox');
  const draw = () => {
    const { set: st, a } = item();
    $('#bpClock').textContent = `${i + 1} / ${list.length}`;
    box.innerHTML = `<span class="eyebrow">${esc(nice(st))} · verse ${a.a}${mode === 'learn' ? ` · ${STEPS[level]}` : ''}</span>
      <p class="ar pr-ar" dir="rtl" lang="ar">${revealed ? esc(a.ar) : ayahHtml(a, level)}</p>
      ${level === 0 || revealed ? `<p class="small muted" style="margin:0">${esc(a.en)}</p>` : ''}
      ${mode === 'learn' && level === 0 ? '<p class="small" style="margin:0">Listen 3 times, reading along. Then say it aloud with the recitation.</p>' : ''}
      ${level === 3 && !revealed ? '<p class="small" style="margin:0">Recite the whole verse aloud from memory, then check.</p>' : ''}
      <div class="btn-row">${revealed
        ? `<button class="ghost gr-again" type="button" data-g="again">Couldn't</button><button class="ghost gr-hard" type="button" data-g="hard">With mistakes</button><button class="cta" type="button" data-g="good">From memory</button>`
        : `<button class="ghost" type="button" id="prHear">${level === 0 ? 'Play ×3' : 'Hear it'}</button>${level < 3 ? `<button class="cta" type="button" id="prNext">${level === 0 ? 'I\'ve read it, hide words' : 'Hide more'}</button>` : '<button class="cta" type="button" id="prCheck">Check</button>'}`}</div>`;
    $('#prHear')?.addEventListener('click', () => playAyah(st.s, a.a, level === 0 ? 3 : 1));
    $('#prNext')?.addEventListener('click', () => { stopAudio(); level++; draw(); });
    $('#prCheck')?.addEventListener('click', () => { revealed = true; playAyah(st.s, a.a); draw(); });
    box.querySelectorAll('[data-g]').forEach(btn => btn.onclick = () => {
      stopAudio();
      const id = B.cardId(st.id, a.a), bq = brain().quran;
      bq[id] = B.review(bq[id], btn.dataset.g); done++;
      if (btn.dataset.g === 'again' && mode === 'learn') { level = 1; revealed = false; return draw(); } // go round again on the same verse
      i++; revealed = false; level = mode === 'review' ? 3 : 0;
      if (i >= list.length) return finish();
      draw();
    });
    if (mode === 'learn' && level === 0 && i === 0 && !revealed && !draw.started) { draw.started = true; playAyah(st.s, a.a, 3); }
  };
  const finish = () => {
    brain().reviews.push({ at: Date.now(), n: done, mode }); ctx.persist();
    const due = B.dueCards(brain().quran).length;
    box.innerHTML = `<h2 class="display h2" style="margin:0">${mode === 'review' ? 'Review done' : 'Well done'}</h2>
      <p style="margin:0">${mode === 'review' ? `You reviewed ${list.length} verse${list.length === 1 ? '' : 's'}.` : `You worked on ${list.length} verse${list.length === 1 ? '' : 's'}. They'll come back for review tomorrow.`}${due ? ` ${due} still due.` : ''}</p>
      <p class="muted small" style="margin:0">Recite them in your next salah: it's the best review there is.</p>
      <button class="cta" type="button" id="prFin">Done</button>`;
    $('#prFin').onclick = closeOverlay;
  };
  draw();
}

/* ---------- Lessons ---------- */
const GO_LABEL = { speed: 'Start Speed Flash', train: 'Go to Train', calm: 'Open Sukoon', games: 'See the games', quran: 'Open Quran memory', food: 'Open Food', vitals: 'Open Body check' };
function openLesson(id) {
  const l = B.LESSONS.find(x => x.id === id); if (!l) return;
  const b = brain();
  openOverlay(`Lesson · ${l.mins} minutes`, `<h2 class="display h2" style="margin:0">${esc(l.title)}</h2>
    ${l.body.map(p => `<p style="margin:0">${esc(p)}</p>`).join('')}
    <div class="card stack lesson-do"><span class="eyebrow">Do this</span><b>${esc(l.action)}</b></div>
    <div class="stack" id="lqBox"><span class="eyebrow">Check yourself</span><p style="margin:0"><b>${esc(l.quiz.q)}</b></p>
      <div class="stack quiz">${l.quiz.options.map((o, i) => `<button type="button" class="ghost" data-q="${i}">${esc(o)}</button>`).join('')}</div></div>
    <div class="btn-row">${l.go ? `<button class="ghost" type="button" id="lsGo">${GO_LABEL[l.go]}</button>` : ''}<button class="cta" type="button" id="lsDone">Done</button></div>`);
  b.lessons[l.id] ||= { read: Date.now() }; ctx.persist();
  $('#lqBox').onclick = e => {
    const t = e.target.closest('[data-q]'); if (!t) return;
    const ok = +t.dataset.q === l.quiz.answer;
    $('#lqBox').querySelectorAll('[data-q]').forEach(x => { x.disabled = true; if (+x.dataset.q === l.quiz.answer) x.classList.add('right'); });
    if (!ok) t.classList.add('wrong');
  };
  $('#lsDone').onclick = closeOverlay;
  $('#lsGo')?.addEventListener('click', () => { closeOverlay(); goTo(l.go); });
}
function goTo(go) {
  if (go === 'speed') return startSpeed();
  if (go === 'games') return $('#brainGames')?.scrollIntoView({ behavior: 'smooth' });
  ctx.go(go);
}
function openRecall(id) {
  const l = B.LESSONS.find(x => x.id === id); if (!l) return;
  openOverlay('Quick recall', `<p style="margin:0" class="muted">From "${esc(l.title)}", ${Math.max(2, Math.round((Date.now() - brain().lessons[id].read) / DAY))} days ago.</p><p style="margin:0"><b>${esc(l.quiz.q)}</b></p>
    <div class="stack quiz" id="rcBox">${l.quiz.options.map((o, i) => `<button type="button" class="ghost" data-q="${i}">${esc(o)}</button>`).join('')}</div><p id="rcMsg" style="margin:0"></p><button class="cta" type="button" id="rcDone" hidden>Done</button>`);
  $('#rcBox').onclick = e => {
    const t = e.target.closest('[data-q]'); if (!t) return;
    const ok = +t.dataset.q === l.quiz.answer;
    $('#rcBox').querySelectorAll('[data-q]').forEach(x => { x.disabled = true; if (+x.dataset.q === l.quiz.answer) x.classList.add('right'); });
    if (!ok) t.classList.add('wrong');
    $('#rcMsg').textContent = ok ? 'Right. Pulling it from memory is what makes it stick.' : `It's "${l.quiz.options[l.quiz.answer]}". You'll remember it better now.`;
    brain().lessons[id].recalled = Date.now(); ctx.persist();
    $('#rcDone').hidden = false;
  };
  $('#rcDone').onclick = closeOverlay;
}
