// "QK" coach: the avatar + voice layer. Every spoken line goes through here.
//
// Voice sources, best first:
//   1. A clip QK recorded himself: audio/cues/<cueId>.mp3 listed in audio/cues/manifest.json.
//      Cues are a fixed list, so recording them once gives a 100% authentic voice for free.
//   2. A cloned-voice TTS endpoint (e.g. ElevenLabs) behind YOUR server — set CONFIG.ttsEndpoint.
//      Never put a TTS API key in the app itself.
//   3. The device's built-in speech voice (works offline, default).

export const CONFIG = {
  coachName: 'QK',
  ttsEndpoint: null,          // e.g. '/api/tts' -> POST {text} returns audio/mpeg
  sameCueCooldownMs: 8000,    // don't nag with the same correction
  anyCueGapMs: 2200,          // minimum gap between corrections
};

let manifest = new Set();
fetch('audio/cues/manifest.json').then(r => r.ok ? r.json() : []).then(list => { manifest = new Set(list); }).catch(() => {});

const lastSaid = {};
let lastAny = 0;
let speaking = false;
let queued = null;
let avatarEls = [];
let muted = false;

export function registerAvatar(el) { avatarEls.push(el); }
export function setMuted(v) { muted = v; if (v) speechSynthesis?.cancel(); }

function setTalking(on) {
  speaking = on;
  avatarEls.forEach(el => el.classList.toggle('talking', on));
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const saved = localStorage.getItem('qk_voice');
  return voices.find(v => v.name === saved)
    || voices.find(v => /en-(GB|AU)/.test(v.lang) && /male|daniel|google uk english male/i.test(v.name))
    || voices.find(v => v.lang.startsWith('en'));
}

async function play(text, id) {
  setTalking(true);
  showCaption(text);
  try {
    if (id && manifest.has(id)) return await playUrl(`audio/cues/${id}.mp3`);
    if (CONFIG.ttsEndpoint) {
      const r = await fetch(CONFIG.ttsEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (r.ok) return await playUrl(URL.createObjectURL(await r.blob()));
    }
    await new Promise(res => {
      if (!('speechSynthesis' in window)) return setTimeout(res, 1500);
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(); if (v) u.voice = v;
      u.rate = 1.02; u.pitch = 0.95;
      u.onend = u.onerror = res;
      speechSynthesis.speak(u);
      setTimeout(res, 9000); // safety net if onend never fires
    });
  } finally {
    setTalking(false);
    if (queued) { const q = queued; queued = null; say(q.text, q.opts); }
  }
}

function playUrl(url) {
  return new Promise(res => { const a = new Audio(url); a.onended = a.onerror = res; a.play().catch(res); });
}

let captionTimer;
function showCaption(text) {
  document.querySelectorAll('[data-coach-caption]').forEach(el => {
    el.textContent = text; el.classList.add('show');
  });
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => document.querySelectorAll('[data-coach-caption]').forEach(el => el.classList.remove('show')), 4500);
}

/**
 * Speak a line as the coach.
 * opts.id       cue id (enables recorded clips + per-cue cooldown)
 * opts.priority 'high' (corrections, queued if busy) | 'low' (counts/praise, dropped if busy)
 */
export function say(text, opts = {}) {
  if (muted) { showCaption(text); return; }
  const now = Date.now();
  if (opts.id && lastSaid[opts.id] && now - lastSaid[opts.id] < CONFIG.sameCueCooldownMs) return;
  if (opts.priority === 'high' && !speaking && now - lastAny < CONFIG.anyCueGapMs) {
    setTimeout(() => say(text, opts), CONFIG.anyCueGapMs - (now - lastAny));
    return;
  }
  if (speaking) {
    if (opts.priority === 'high') queued = { text, opts };
    return;
  }
  if (opts.id) lastSaid[opts.id] = now;
  if (opts.priority === 'high') lastAny = now;
  play(text, opts.id);
}

export function greeting(name) {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `Good ${part}${name ? ', ' + name : ''}.`;
}

const PRAISE = ['Good rep.', 'That\'s it.', 'Perfect, keep going.', 'Strong.', 'Lovely, same again.'];
export const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const countWord = n => NUM[n] || String(n);
