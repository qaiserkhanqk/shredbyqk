#!/usr/bin/env node
// Muhammad, QK's AI assistant: answers clients' chat messages straight away (see js/chatbot.js for the rules).
//
// Two ways it runs:
//   1. Instantly: the app calls POST /chat on the food server (tools/food-vision-server.mjs) right after the client
//      sends a message; the server checks the sign-in and calls answer(clientId) from this file.
//   2. As a safety net (a message sent while the server was down, or with no food server at all):
//        node tools/chat-assistant.mjs            answers anything waiting, once
//        node tools/chat-assistant.mjs --watch    keeps checking every 15 seconds
//
// Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only: it reads profiles and writes Muhammad's replies), and an
// AI key: GEMINI_API_KEY (default, model CHAT_MODEL or gemini-3.1-flash-lite, falling back to gemini-3.8-flash when busy), OPENAI_API_KEY or ANTHROPIC_API_KEY.
// CHAT_AI=mock gives canned replies with no AI (for testing).
import { needsQK, handoverText, profileBrief, buildPrompt, readAnswer, shouldAnswer, DEFAULT_NAME, langOf, translatePrompt } from '../js/chatbot.js';
import crypto from 'node:crypto';
import { byId as programById } from '../js/programs.js';

const E = process.env;

/* ---------- The database (Supabase REST with the service key) ---------- */
export function supabase(url = E.SUPABASE_URL, key = E.SUPABASE_SERVICE_ROLE_KEY, f = globalThis.fetch) {
  const base = url?.replace(/\/$/, ''), H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const call = async (path, opt = {}) => {
    const r = await f(base + path, { ...opt, headers: { ...H, ...(opt.headers || {}) }, signal: AbortSignal.timeout(10e3) });
    if (!r.ok) throw new Error(`supabase ${r.status} ${path.split('?')[0]}`);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };
  return {
    ok: !!(base && key),
    history: id => call(`/rest/v1/chats?client_id=eq.${id}&order=created_at.desc&limit=30&select=id,sender,body,created_at,flagged`).then(r => (r || []).reverse()),
    profile: id => call(`/rest/v1/profiles?id=eq.${id}&select=*`).then(r => r?.[0] || null),
    coach: id => id ? call(`/rest/v1/profiles?id=eq.${id}&select=id,name,assistant`).then(r => r?.[0] || null) : null,
    paused: id => call(`/rest/v1/assistant_off?client_id=eq.${id}&select=client_id`).then(r => !!r?.length),
    // QK's own words, newest first: chat replies, then cheers and notes. Style examples, never shown to clients.
    examples: async coachId => {
      const a = await call(`/rest/v1/chats?coach_id=eq.${coachId}&sender=eq.coach&order=created_at.desc&limit=12&select=body`).catch(() => []);
      const b = await call(`/rest/v1/messages?coach_id=eq.${coachId}&kind=neq.broadcast&order=created_at.desc&limit=8&select=body`).catch(() => []);
      return [...new Set([...(a || []), ...(b || [])].map(x => x.body).filter(Boolean))];
    },
    post: row => call('/rest/v1/chats', { method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=minimal' } }),
    flag: (ids, reason) => call(`/rest/v1/chats?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify({ flagged: reason }), headers: { Prefer: 'return=minimal' } }),
    waiting: sinceIso => call(`/rest/v1/chats?created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=2000&select=client_id,sender,created_at`),
  };
}

/* ---------- The model (text in, JSON text out) ---------- */
const PROVIDER = E.CHAT_AI === 'mock' || E.FOOD_AI === 'mock' ? 'mock' : E.GEMINI_API_KEY ? 'gemini' : E.OPENAI_API_KEY ? 'openai' : E.ANTHROPIC_API_KEY ? 'anthropic' : null;
const MODEL = E.CHAT_MODEL || { gemini: 'gemini-3.1-flash-lite' /* ~1 s, replies as good as Flash in tests */, openai: E.OPENAI_MODEL || 'gpt-4o', anthropic: 'claude-sonnet-5-5', mock: 'mock' }[PROVIDER];
const CHAT_TIMEOUT = +E.CHAT_TIMEOUT_MS || 12e3; // a slow model gives way to the fallback
const FALLBACK = E.CHAT_FALLBACK_MODEL ?? (PROVIDER === 'gemini' || /googleapis/.test(E.OPENAI_BASE_URL || '') ? (MODEL === 'gemini-3.8-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash') : '');
/** Ask the model; when it's busy (429/5xx), wait a moment and try again, then try the lighter fallback model. */
export async function think(prompt) {
  const tries = [MODEL, FALLBACK].filter(Boolean);
  for (let i = 0; i < tries.length; i++) {
    try { return await thinkOnce(prompt, tries[i]); }
    catch (e) { if (!(/ (429|5\d\d)$/.test(e.message) || e.name === 'TimeoutError') || i === tries.length - 1) throw e; }
  }
}
async function thinkOnce({ system, user }, MODEL) {
  if (PROVIDER === 'mock') return JSON.stringify({ reply: /protein/i.test(user) ? 'Add 2 eggs at breakfast and a katori of daal at lunch. Easy 25 g more protein.' : 'Got it. Keep logging every meal this week and we\'ll see the full picture at your check-in.', handover: false });
  if (PROVIDER === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(CHAT_TIMEOUT), headers: { 'content-type': 'application/json', 'x-goog-api-key': E.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 400, ...(/^gemini-[3-9]/.test(MODEL) ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}) } }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    return (await r.json()).candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }
  if (PROVIDER === 'openai') {
    const r = await fetch(`${E.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(CHAT_TIMEOUT), headers: { 'content-type': 'application/json', authorization: `Bearer ${E.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: 400, ...(/googleapis/.test(E.OPENAI_BASE_URL || '') ? { reasoning_effort: 'none' } : {}) }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    return (await r.json()).choices?.[0]?.message?.content || '';
  }
  if (PROVIDER === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(CHAT_TIMEOUT), headers: { 'content-type': 'application/json', 'x-api-key': E.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, system, max_tokens: 400, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status}`);
    return (await r.json()).content?.map(c => c.text || '').join('') || '';
  }
  throw new Error('no AI key');
}

/* ---------- Muhammad's voice ---------- */
// Replies read aloud in any language. Gemini's speech model (a calm male voice, VOICE_NAME) or OpenAI's; returns a WAV.
// Same text → same audio, so a reply played twice costs once.
const TTS_MODEL = E.CHAT_TTS_MODEL || 'gemini-2.5-flash-preview-tts', VOICE = E.VOICE_NAME || 'Charon';
const voiceCache = new Map();
/** 16-bit mono PCM → WAV. */
export function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export const voiceOn = () => !!(PROVIDER === 'mock' || E.GEMINI_API_KEY || (E.OPENAI_API_KEY && !/googleapis/.test(E.OPENAI_BASE_URL || '')));
export async function speak(text, f = globalThis.fetch) {
  text = String(text || '').slice(0, 700).trim(); if (!text) throw new Error('bad request');
  const key = crypto.createHash('sha1').update(VOICE + '|' + text).digest('hex');
  if (voiceCache.has(key)) return voiceCache.get(key);
  let audio;
  if (PROVIDER === 'mock') audio = wav(Buffer.alloc(4800)); // 0.1 s of silence
  else if (E.GEMINI_API_KEY) {
    const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TTS_MODEL)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(20e3), headers: { 'content-type': 'application/json', 'x-goog-api-key': E.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Say warmly, like a friendly coach on a voice note: ${text}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } } }),
    });
    if (!r.ok) throw new Error(`gemini tts ${r.status}`);
    const part = (await r.json()).candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
    const d = part?.inlineData || part?.inline_data; if (!d?.data) throw new Error('no audio');
    const rate = +(String(d.mimeType || d.mime_type).match(/rate=(\d+)/)?.[1] || 24000);
    audio = wav(Buffer.from(d.data, 'base64'), rate);
  } else if (E.OPENAI_API_KEY) {
    const r = await f(`${E.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/audio/speech`, {
      method: 'POST', signal: AbortSignal.timeout(20e3), headers: { 'content-type': 'application/json', authorization: `Bearer ${E.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: E.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: E.VOICE_NAME || 'onyx', input: text, response_format: 'wav' }),
    });
    if (!r.ok) throw new Error(`openai tts ${r.status}`);
    audio = Buffer.from(await r.arrayBuffer());
  } else throw new Error('no voice key');
  voiceCache.set(key, audio); if (voiceCache.size > 500) voiceCache.delete(voiceCache.keys().next().value);
  return audio;
}

/* ---------- Answer one client ---------- */
const busy = new Set(); // one answer per client at a time (a client often sends two messages quickly)
/**
 * Answer what the client is waiting for, if Muhammad should. Returns { posted, kind: 'reply'|'handover'|null, why }.
 * deps lets the tests swap the database and the model.
 */
export async function answer(clientId, { db = supabase(), ai = think, now = Date.now() } = {}) {
  if (!/^[\w-]{1,64}$/.test(String(clientId))) return { posted: false, why: 'bad id' }; // goes into a query: letters, digits, - and _ only
  if (busy.has(clientId)) return { posted: false, why: 'already answering' };
  busy.add(clientId);
  try {
    const history = await db.history(clientId);
    const profile = await db.profile(clientId); if (!profile) return { posted: false, why: 'no profile' };
    const coach = await db.coach(profile.coach_id); if (!coach) return { posted: false, why: 'no coach' };
    const cfg = coach.assistant || {}, name = String(cfg.name || DEFAULT_NAME).slice(0, 30), coachName = String(coach.name || 'QK').split(' ')[0] || 'QK';
    const go = shouldAnswer(history, { now, on: cfg.on !== false, paused: await db.paused(clientId) });
    if (!go.answer) return { posted: false, why: go.why };
    const text = go.pending.map(m => m.body).join('\n');
    // 1. The rules first: some messages are QK's alone, whatever the model would say.
    let reason = needsQK(text), reply = null;
    // 2. Otherwise ask the model, which can also hand over.
    if (!reason) {
      const examples = await db.examples(coach.id).catch(() => []);
      const prompt = buildPrompt({ assistantName: name, coachName, style: cfg.style, examples, brief: profileBrief(profile, { programName: id => programById(id)?.name }), history });
      const a = readAnswer(await ai(prompt));
      if (!a) return { posted: false, why: 'no usable answer' };
      if (a.handover) reason = a.reason || 'Asked for QK'; else reply = a.reply;
    }
    // The client may have written again, or QK may have replied, while we were thinking: check before posting.
    const latest = await db.history(clientId), lastNow = latest[latest.length - 1];
    if (!lastNow || lastNow.sender !== 'client' || lastNow.id !== go.pending[go.pending.length - 1].id) return { posted: false, why: 'conversation moved on' };
    if (reason) {
      await db.flag(go.pending.map(m => m.id), reason);
      let body = handoverText(text, reason, coachName);
      // A language we have no fixed words for (Pashto, Hindi, Punjabi…): the model translates; English if it can't.
      if (langOf(text) === 'other') body = readAnswer(await ai(translatePrompt(body, text)).catch(() => null))?.reply || body;
      await db.post({ client_id: clientId, coach_id: coach.id, sender: 'assistant', body });
      return { posted: true, kind: 'handover', why: reason };
    }
    await db.post({ client_id: clientId, coach_id: coach.id, sender: 'assistant', body: reply });
    return { posted: true, kind: 'reply' };
  } finally { busy.delete(clientId); }
}

/** Answer every conversation whose latest message is the client's (last 6 hours). */
export async function sweep({ db = supabase(), ai = think, now = Date.now() } = {}) {
  const rows = await db.waiting(new Date(now - 6 * 3600e3).toISOString()) || [];
  const latest = new Map(); for (const r of rows) if (!latest.has(r.client_id)) latest.set(r.client_id, r); // newest first
  const out = [];
  for (const [id, r] of latest) if (r.sender === 'client') out.push({ id, ...(await answer(id, { db, ai, now }).catch(e => ({ posted: false, why: e.message }))) });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!supabase().ok) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
  if (!PROVIDER) { console.error('Set GEMINI_API_KEY (or OPENAI_API_KEY / ANTHROPIC_API_KEY, or CHAT_AI=mock).'); process.exit(1); }
  const once = async () => { const r = await sweep(); if (r.length) console.log(new Date().toISOString(), r.map(x => `${x.id.slice(0, 8)}: ${x.posted ? x.kind : x.why}`).join(', ')); };
  if (process.argv.includes('--watch')) { console.log(`${DEFAULT_NAME} is watching the chats (${PROVIDER} ${MODEL}).`); for (;;) { await once().catch(e => console.error(e.message)); await new Promise(r => setTimeout(r, 15e3)); } }
  else once().catch(e => { console.error(e); process.exit(1); });
}
