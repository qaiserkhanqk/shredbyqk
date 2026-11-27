// "QK" coach: the avatar + voice layer. Every spoken line goes through here.
//
// Voice sources, best first:
//   0. A clip recorded in this phone's Studio (IndexedDB), heard immediately by the person who recorded it.
//   1. A clip QK recorded and published: audio/cues/<file> listed in audio/cues/manifest.json
//      ({id: filename}). Cues are a fixed list, so recording them once gives his real voice for free.
//   2. A cloned-voice TTS endpoint (e.g. ElevenLabs) behind YOUR server — set CONFIG.ttsEndpoint.
//      Never put a TTS API key in the app itself.
//   3. The device's built-in speech voice (works offline, default).

export const CONFIG = {
  coachName: 'QK',
  ttsEndpoint: null,          // e.g. '/api/tts' -> POST {text} returns audio/mpeg
  sameCueCooldownMs: 8000,    // don't nag with the same correction
  anyCueGapMs: 2200,          // minimum gap between corrections
};

import { toUrdu } from './coach-ur.js';
import { getClip } from './studio.js';
let manifest = {};
fetch('audio/cues/manifest.json').then(r => r.ok ? r.json() : {}).then(m => { manifest = Array.isArray(m) ? Object.fromEntries(m.map(id => [id, id + '.mp3'])) : m; }).catch(() => {});

const lastSaid = {};
let lastAny = 0;
let speaking = false;
let queued = null;
let gen = 0, currentAudio = null;
let avatarEls = [];
let muted = false;

export function registerAvatar(el) { avatarEls.push(el); }
export function setMuted(v) { muted = v; if (v) speechSynthesis?.cancel(); }
// Coaching language: 'ur' speaks the short workout cues in Urdu when the phone has an Urdu voice.
let lang = 'en';
export const setLang = l => { lang = l === 'ur' ? 'ur' : 'en'; };
export const urduVoice = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices().find(v => /^ur/i.test(v.lang)) : null) || null;

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
  // Urdu: only lines with an Urdu version, and only with an Urdu voice; everything else stays English.
  let voice = null;
  if (lang === 'ur') { const ur = toUrdu(text), v = ur && urduVoice(); if (v) { text = ur; id = null; voice = v; } }
  const my = ++gen;
  setTalking(true);
  showCaption(text);
  try {
    if (id) {
      const local = await getClip(id).catch(() => null);
      if (local) return await playUrl(URL.createObjectURL(local));
      if (manifest[id]) return await playUrl(`audio/cues/${manifest[id]}`);
    }
    if (CONFIG.ttsEndpoint) {
      const r = await fetch(CONFIG.ttsEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (r.ok) return await playUrl(URL.createObjectURL(await r.blob()));
    }
    await new Promise(res => {
      if (!('speechSynthesis' in window)) return setTimeout(res, 1500);
      const u = new SpeechSynthesisUtterance(text);
      const v = voice || pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 1.02; u.pitch = 0.95;
      u.onend = u.onerror = res;
      speechSynthesis.speak(u);
      setTimeout(res, 9000); // safety net if onend never fires
    });
  } finally {
    // An interruption started a newer line: leave the talking state to it.
    if (my === gen) {
      setTalking(false);
      if (queued) { const q = queued; queued = null; say(q.text, q.opts); }
    }
  }
}

function playUrl(url) {
  return new Promise(res => { const a = currentAudio = new Audio(url); a._done = res; a.onended = a.onerror = res; a.play().catch(res); });
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
 * opts.priority 'now' (live correction: interrupts the current line and speaks at once)
 *              | 'high' (corrections, queued if busy) | 'low' (counts/praise, dropped if busy)
 */
export function say(text, opts = {}) {
  if (muted) { showCaption(text); return; }
  const now = Date.now();
  if (opts.priority === 'now') {
    // Same fault again within 1.5 s is the same moment, not a new mistake.
    if (opts.id && lastSaid[opts.id] && now - lastSaid[opts.id] < 1500) return;
    stopSpeaking(); queued = null;
    if (opts.id) lastSaid[opts.id] = now;
    lastAny = now;
    play(text, opts.id);
    return;
  }
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

function stopSpeaking() {
  if (!speaking) return;
  gen++; // the interrupted play() won't clear the talking state of the new line
  try { speechSynthesis?.cancel(); } catch {}
  if (currentAudio) { currentAudio.pause(); currentAudio._done?.(); currentAudio = null; }
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
