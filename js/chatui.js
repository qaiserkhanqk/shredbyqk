// "Message QK" in the app: a chat with QK. Muhammad, QK's assistant, replies straight away in the client's own language
// (any language); QK reads every chat and replies himself when it matters (injuries, medicine, money… go straight to
// him). See js/chatbot.js.
// Voice: hold a conversation by voice. The mic types what you say (Urdu, English, Arabic, Hindi), and every reply can
// be played aloud: Muhammad's own voice from the server (tools/chat-assistant.mjs speak()), or the phone's voice.
// With no server set up, the chat runs as a preview on this phone (the coach dashboard demo shows it too).
import * as CFG from './cloud-config.js';
const CHAT = CFG.CHAT || {}; // an older cloud-config.js without CHAT still works
import { PHOTO_CONFIG } from './foodphoto.js';
import { getLang } from './food-ur.js';
import { needsQK, handoverText, DEFAULT_NAME, DEMO_CHAT, speechLang } from './chatbot.js';
export { DEMO_CHAT };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const time = iso => { const d = new Date(iso), today = new Date().toDateString() === d.toDateString(); return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const base = () => CHAT.endpoint || (PHOTO_CONFIG.endpoint ? PHOTO_CONFIG.endpoint.replace(/\/food-vision.*$|\/?$/, '/chat') : '');
export const chatEndpoint = base;
export const voiceEndpoint = () => CHAT.voiceEndpoint || (base() ? base().replace(/\/chat$/, '/chat-voice') : '');
// Languages the mic listens in (the phone's speech recognition needs one).
export const MIC_LANGS = [['ur-PK', 'اردو'], ['en-IN', 'English'], ['ar-AE', 'العربية'], ['hi-IN', 'हिन्दी'], ['pa-IN', 'ਪੰਜਾਬੀ']];

let X, rows = [], open = false, pollT = null, waitUntil = 0, rec = null, spoken = new Set();
/** x: { cloud (or null), S, persist, toast } */
export function initChat(x) {
  X = x;
  $('#chatCard').onclick = openChat;
  $('#chatSheet').onclick = e => { if (e.target.id === 'chatSheet' || e.target.closest('#chatClose')) closeChat(); };
  $('#chatForm').onsubmit = e => { e.preventDefault(); send(); };
  $('#chatText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('#chatMic').onclick = listen;
  $('#chatMicLang').innerHTML = MIC_LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('#chatMicLang').value = X.S.chatMicLang || (getLang() === 'ur' ? 'ur-PK' : 'en-IN');
  $('#chatMicLang').onchange = e => { X.S.chatMicLang = e.target.value; X.persist(); };
  $('#chatSpeak').checked = !!X.S.chatSpeak;
  $('#chatSpeak').onchange = e => { X.S.chatSpeak = e.target.checked; X.persist(); if (e.target.checked) { const last = [...rows].reverse().find(r => r.sender !== 'client'); if (last) play(last); } };
  $('#chatThread').onclick = e => { const b = e.target.closest('[data-play]'); if (b) play(rows.find(r => String(r.id) === b.dataset.play)); };
  renderCard();
}
const live = () => !!(X.cloud?.signedIn && X.S.cloud?.coach);
const coachName = () => (live() ? X.S.cloud.coach : 'QK').split(' ')[0];

/** The Today card: shown when connected to a coach (or in preview with no server). */
export function renderCard(unread = X?.S.chatUnread || 0) {
  const card = $('#chatCard'); if (!card || !X) return;
  card.hidden = !!X.cloud && !live();
  card.innerHTML = `<span class="eyebrow">Questions?</span><b>Message ${esc(coachName())}</b><span class="muted small">Type or send a voice message, in any language. ${DEFAULT_NAME}, ${esc(coachName())}'s assistant, replies straight away; ${esc(coachName())} reads every chat.</span>${unread ? `<span class="chat-badge" aria-label="${unread} new">${unread}</span>` : ''}`;
}

async function load() {
  if (!live()) { rows = store.get(DEMO_CHAT) || []; return; }
  rows = await X.cloud.chat();
  const unread = rows.filter(r => r.sender !== 'client' && !r.read_at).map(r => r.id);
  if (open && unread.length) { X.cloud.chatRead(unread).catch(() => {}); rows.forEach(r => { if (unread.includes(r.id)) r.read_at = new Date().toISOString(); }); }
  X.S.chatUnread = open ? 0 : unread.length; X.persist(); renderCard();
}
/** Called by the app's sync: count new replies, toast once. */
export async function checkReplies() {
  if (!live() || open) return;
  const before = X.S.chatUnread || 0;
  try { await load(); } catch { return; }
  if ((X.S.chatUnread || 0) > before) { const last = [...rows].reverse().find(r => r.sender !== 'client'); X.toast(`${last?.sender === 'coach' ? coachName() : DEFAULT_NAME} replied: ${String(last?.body || '').slice(0, 80)}`); }
}

function render() {
  const who = r => r.sender === 'coach' ? `<span class="chat-who qk">${esc(coachName())}</span>` : r.sender === 'assistant' ? `<span class="chat-who">${DEFAULT_NAME}</span>` : '';
  const body = $('#chatThread');
  body.innerHTML = rows.length ? rows.map(r => `<div class="chat-msg ${r.sender}" dir="auto">${who(r)}<p>${esc(r.body)}</p><time>${time(r.created_at)}</time>${r.sender !== 'client' ? `<button type="button" class="chat-play" data-play="${esc(r.id)}" aria-label="Play this message">▶ Play</button>` : ''}</div>`).join('')
    : `<p class="muted small chat-empty">Ask anything about your food, training or plan, in any language. Type, or tap 🎤 and talk. Anything about pain, injuries, medicine or payments goes straight to ${esc(coachName())}.</p>`;
  const last = rows[rows.length - 1], waiting = Date.now() < waitUntil && last?.sender === 'client';
  // No reply yet (the server is busy or down): the message is safe, and QK sees every chat.
  const stale = !waiting && last?.sender === 'client' && Date.now() - Date.parse(last.created_at) > 45e3;
  $('#chatTyping').hidden = !waiting && !stale;
  $('#chatTyping').textContent = waiting ? `${DEFAULT_NAME} is typing…` : `Sent. ${coachName()} sees every chat; you'll get a reply here.`;
  body.scrollTop = body.scrollHeight;
  // Voice replies on: read out each new reply once.
  if (X.S.chatSpeak && open) { const fresh = rows.filter(r => r.sender !== 'client' && !spoken.has(r.id) && Date.now() - Date.parse(r.created_at) < 120e3); fresh.forEach(r => spoken.add(r.id)); if (fresh.length) play(fresh[fresh.length - 1]); }
}
async function openChat() {
  open = true; $('#chatSheet').hidden = false; $('#chatCoachName').textContent = coachName();
  $('#chatNote').textContent = live() ? `${DEFAULT_NAME}, ${coachName()}'s assistant, replies straight away, in your language, from what the app knows about you. ${coachName()} reads every chat and replies himself when it matters.`
    : `Preview on this phone. Once you're connected to your coach, ${DEFAULT_NAME}, QK's assistant, answers here straight away, in your language, and QK reads every chat.`;
  try { await load(); } catch (e) { X.toast(`Couldn't load the chat: ${e.message}`); }
  rows.forEach(r => spoken.add(r.id)); // don't read out old messages on open
  render(); $('#chatText').focus();
  clearInterval(pollT); pollT = setInterval(async () => { if (!open || !live()) return; const n = rows.length; try { await load(); } catch {} if (rows.length !== n || $('#chatTyping').hidden === false) render(); }, 3000);
}
function closeChat() { open = false; $('#chatSheet').hidden = true; clearInterval(pollT); rec?.abort(); stopAudio(); renderCard(); }

async function send() {
  const text = $('#chatText').value.trim(); if (!text) return;
  $('#chatText').value = '';
  const mine = { id: 'local' + Date.now(), sender: 'client', body: text.slice(0, 2000), created_at: new Date().toISOString() };
  rows.push(mine); waitUntil = Date.now() + 45e3; render();
  if (!live()) return demoReply(text);
  try {
    X.S.cloud.coachId ||= (await X.cloud.me())?.coach_id || null; X.persist();
    await X.cloud.sendChat(mine.body, X.S.cloud.coachId);
  } catch (e) { rows = rows.filter(r => r !== mine); waitUntil = 0; render(); $('#chatText').value = text; return X.toast(`Not sent: ${e.message}`); }
  // Ask Muhammad to answer now (if the server isn't reachable, the safety-net job answers within a minute).
  const url = base(), token = X.cloud.session?.access_token;
  if (url && token) fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }).then(() => load()).then(render).catch(() => {});
}

/* ---------- Voice ---------- */
// Talk: the phone's speech recognition types it into the box in the chosen language; it sends when you stop talking.
function listen() {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition, btn = $('#chatMic');
  if (!SR) return X.toast('Voice typing isn\'t available in this browser. Use the 🎤 on your keyboard instead.');
  if (rec) { rec.stop(); return; }
  stopAudio();
  rec = new SR(); rec.lang = $('#chatMicLang').value; rec.interimResults = true; rec.continuous = false;
  const before = $('#chatText').value.trim();
  btn.classList.add('listening'); btn.setAttribute('aria-pressed', 'true');
  rec.onresult = e => { $('#chatText').value = [before, [...e.results].map(r => r[0].transcript).join(' ')].filter(Boolean).join(' '); };
  rec.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') X.toast('Couldn\'t hear that. Try again, or type it.'); };
  rec.onend = () => { btn.classList.remove('listening'); btn.setAttribute('aria-pressed', 'false'); rec = null; if ($('#chatText').value.trim() && $('#chatText').value.trim() !== before) send(); };
  rec.start();
}

// Play: Muhammad's own voice from the server when it's set up, else the phone's voice in the message's language.
let audio = null;
const stopAudio = () => { try { audio?.pause(); } catch {} audio = null; try { globalThis.speechSynthesis?.cancel(); } catch {} };
async function play(r) {
  if (!r) return; stopAudio();
  const url = voiceEndpoint(), token = X.cloud?.session?.access_token;
  if (url && token && live()) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: r.body }) });
      if (res.ok) { audio = new Audio(URL.createObjectURL(await res.blob())); await audio.play(); return; }
    } catch {}
  }
  phoneVoice(r.body);
}
export function phoneVoice(text) {
  const synth = globalThis.speechSynthesis; if (!synth || !globalThis.SpeechSynthesisUtterance) return X?.toast('This phone can\'t read messages aloud.');
  const lang = speechLang(text), u = new SpeechSynthesisUtterance(text), voices = synth.getVoices();
  // Best voice for the language: exact match, then the same language, then Hindi for Urdu (they sound alike spoken).
  const pick = voices.find(v => v.lang === lang) || voices.find(v => v.lang?.startsWith(lang.slice(0, 2))) || (lang.startsWith('ur') ? voices.find(v => v.lang?.startsWith('hi')) : null);
  u.lang = pick?.lang || lang; try { if (pick) u.voice = pick; } catch {} u.rate = 1;
  synth.cancel(); synth.speak(u);
}

// Preview (no server): Muhammad's rules run on the phone so the flow can be tried; the reply says it's a preview.
function demoReply(text) {
  const reason = needsQK(text);
  setTimeout(() => {
    const all = store.get(DEMO_CHAT) || [], now = new Date().toISOString();
    all.push({ id: Date.now(), sender: 'client', body: text, created_at: now, ...(reason ? { flagged: reason } : {}) });
    all.push({ id: Date.now() + 1, sender: 'assistant', body: reason ? handoverText(text, reason, 'QK') : `(Preview) Once your coach is connected, I'll answer this from your profile in QK's style, in your language. QK reads every chat.`, created_at: new Date().toISOString() });
    store.set(DEMO_CHAT, all.slice(-100)); rows = all; waitUntil = 0; render();
  }, 700);
}
