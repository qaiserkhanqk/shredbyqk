#!/usr/bin/env node
// Food photo recogniser: a tiny server that keeps your AI key off the phone.
// No dependencies (Node 18+).
//
//   ANTHROPIC_API_KEY=... node tools/food-vision-server.mjs          # Claude (default model claude-sonnet-5-5)
//   OPENAI_API_KEY=...    node tools/food-vision-server.mjs          # OpenAI (set OPENAI_MODEL, default gpt-4o)
//   GEMINI_API_KEY=...    node tools/food-vision-server.mjs          # Google Gemini (set GEMINI_MODEL, default gemini-3.8-flash)
//   OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai OPENAI_MODEL=gemini-3.8-flash OPENAI_API_KEY=<gemini key> …
//                                                                     # Gemini through its OpenAI-compatible endpoint (Bearer key)
//   FOOD_AI=gemini …                                                  # pick one when several keys are set
// Gemini has a free tier, but on it Google may use what you send to improve its products: fine for
// testing, switch to a paid key before real clients upload meal photos.
//   FOOD_AI=mock node tools/food-vision-server.mjs                    # practice mode: instant made-up answers, no key, no cost (load tests)
//   PORT=8787 ALLOW_ORIGIN=https://you.github.io node tools/food-vision-server.mjs
//
// Built to stay up and cheap under load:
//   - "samples":"fast" (what the app sends): one call to FAST_MODEL with thinking off, answered in ~1–2 s; if that answer
//     is unsure the reply says refine:true and the app asks "samples":"refine" in the background (two calls to the main
//     model) and quietly updates the log. "auto": one call, two more when unsure, in one request. ~2.5x cheaper than always 3.
//   - The fixed part of the prompt (rules + dish list) comes first and is identical every time, so Gemini and
//     OpenAI cache it automatically and Claude caches it explicitly: repeated input costs a fraction.
//   - Gemini's "thinking" is off (naming dishes doesn't need it; thinking made photos 2–13 s instead of 1–2 s in our
//     test): GEMINI_THINKING=off (default) | low | default.
//   - Busy or rate-limited: retries with backoff (honours Retry-After), then GEMINI_FALLBACK_MODEL (Flash-Lite).
//   - At most AI_CONCURRENCY (default 16) AI calls at once; beyond MAX_QUEUE (default 300) waiting photos the
//     server answers 503 + Retry-After, and the app waits and tries once more instead of piling on.
//   - GET /health: provider, queue, calls, tokens (incl. cached) and an estimated cost so far.
//   FATSECRET_CLIENT_ID=... FATSECRET_CLIENT_SECRET=...   # optional: live fallback search, GET /food-search?q=
//
// Then set PHOTO_CONFIG.endpoint in js/foodphoto.js to http(s)://<host>:8787/food-vision.
// POST /food-text understands meal descriptions the app's own parser couldn't.
//
// The model is asked to IDENTIFY and MEASURE, never to give calories (see js/foodphoto.js for why).
// It answers through a strict JSON schema whose dish field is an enum of the app's catalogue, it is
// asked `samples` times in parallel, and the app keeps the consensus. Answers are cached by image hash.
import http from 'node:http';
import crypto from 'node:crypto';
import { parseFatSecret } from '../js/fatsecret.js';
import { catalogue as appCatalogue } from '../js/foodphoto.js';
import { answer as chatAnswer, speak, voiceOn } from './chat-assistant.mjs';

// The dish list comes from the app's own code, never from the request: a caller can't add dishes, inject text into
// the prompt through dish names, or poison the shared cache. Its version is part of every cache key.
const CATALOGUE = appCatalogue(), IDS = CATALOGUE.map(c => c.id);
const CAT_VERSION = crypto.createHash('sha1').update(JSON.stringify(CATALOGUE)).digest('hex').slice(0, 10);
// Sign-in check (recommended for production): with SUPABASE_URL and SUPABASE_ANON_KEY set, every photo or text request
// must carry the client's Supabase sign-in token, so only your clients can spend your AI budget.
const AUTH_URL = process.env.SUPABASE_URL?.replace(/\/$/, ''), AUTH_KEY = process.env.SUPABASE_ANON_KEY;
const RATE = +process.env.RATE_PER_MIN || 20; // requests per minute per signed-in client (or per network address)

const PORT = +process.env.PORT || 8787;
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const KEYS = { anthropic: process.env.ANTHROPIC_API_KEY, openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY };
const PROVIDER = process.env.FOOD_AI === 'mock' ? 'mock' : KEYS[process.env.FOOD_AI] ? process.env.FOOD_AI : ['anthropic', 'openai', 'gemini'].find(k => KEYS[k]) || null;
const MODEL = { anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', openai: process.env.OPENAI_MODEL || 'gpt-4o', gemini: process.env.GEMINI_MODEL || 'gemini-3.8-flash', mock: 'mock' }[PROVIDER];
const FALLBACK = PROVIDER === 'gemini' ? (process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.1-flash-lite') : '';
// The first answer comes from a fast model with thinking off (measured 1.3–2.3 s per photo on Flash-Lite, Nov 2026);
// a stronger model double-checks in the background only when that answer is unsure. FAST_MODEL='' turns it off.
const FAST = process.env.FAST_MODEL ?? (PROVIDER === 'gemini' ? 'gemini-3.1-flash-lite' : PROVIDER === 'mock' ? 'mock' : '');
const CONCURRENCY = +process.env.AI_CONCURRENCY || 16, MAX_QUEUE = +process.env.MAX_QUEUE || 300;
// $ per million tokens (input, cached input, output) for the /health estimate; set to your plan's prices.
const PRICE = { in: +process.env.PRICE_IN || 1.5, cached: +process.env.PRICE_CACHED || 0.15, out: +process.env.PRICE_OUT || 7.5 };
const cache = new Map(); // version|image hash|note|mode → samples

const RULES = `For each separate food:
- dish: pick the closest id from the catalogue below. Use "other" only if nothing is close, and then name it in other_name.
- alternative: the second most likely catalogue id for the same food (another member of its family is typical:
  naan vs roghni naan, chicken karahi vs chicken handi), or "none" if you're sure.
- servings: how many of that dish's serving unit (given per dish). Count breads, kebabs, samosas, eggs and pieces one
  by one. For curries and rice judge volume: a katori of meat curry is about 240 g (daal about 200 g, a small bowl,
  about 1 cup); a full dinner plate of rice or biryani is about 350 g. Use halves (0.5, 1.5). If only part of a roti or naan is left, count what is left.
  Breads differ a lot: a thin phulka, a roti/chapati, a big tandoori roti, a naan, a roghni naan (glossy, sesame),
  a kulcha, taftan or sheermal (sweet, yellowish), a paratha (layered, oily sheen) or a puri (puffed, fried).
- meat_share (curries and rice with meat only, else "na"): "more" if mostly meat pieces, "less" if mostly gravy or rice, else "normal".
- oil (cooked dishes only, else "na"): "oily" if a layer of oil (tarri) shows on top or pools at the edge, "less" if dry, else "normal".
- confidence: 0 to 1, how sure you are of the dish.
setting: "restaurant" for a restaurant, dhaba or wedding (karahi pans, foil, branded boxes, buffet), "home" for home, else "unsure".
scene: "plate" if it's one person's meal; "shared" if it's a dish for several people (a whole karahi pan, a big platter, a
  basket of naan for the table); "cooking_or_display" if food is being cooked or sold (pots on the stove, a stall's stack,
  a sweet shop tray); "not_food" if there's no ready-to-eat food (raw meat, a kitchen, a machine).
  For "shared", give servings for ONE person's share, not the whole dish.
Include drinks and small bowls at the edges (lassi, raita, chutney is fine to skip).
Chicken vs mutton/beef: look at the bones (long thin chicken bones vs thick mutton bones), the meat's colour and grain;
  if unsure, put the other one as the alternative.`;

const catalogueText = catalogue => `Catalogue (id: name, serving unit):\n${catalogue.map(c => `${c.id}: ${c.name} (${c.serving})`).join('\n')}`;

// The fixed part (identical for every photo, so providers cache it) and this photo's context (after it).
const STATIC_PHOTO = catalogue => `You are the food-recognition step of a calorie tracker for Pakistani, Indian and Gulf food.
Do NOT estimate calories, grams of fat or macros. Only identify and measure what is on the plate.

${RULES}

${catalogueText(catalogue)}`;
// What the person told us helps more than anything a camera can infer.
const PHOTO_CONTEXT = (x = {}) => [
  x.plateCm ? `Scale: this person's usual dinner plate is about ${x.plateCm} cm across; a katori is about 10 cm. Use them to judge volume.` : '',
  x.hint ? `The person says: "${String(x.hint).slice(0, 200)}". Trust it for what the food is and who cooked it; still count portions from the photo.` : '',
  x.usual?.length ? `Foods this person often eats (prefer these when the photo is ambiguous): ${x.usual.slice(0, 15).join(', ')}.` : '',
].filter(Boolean).join('\n') || 'Here is the photo.';

// Text: words the app's own parser didn't catch ("kadhi chawal ki plate").
const STATIC_TEXT = catalogue => `You are the meal-understanding step of a calorie tracker for Pakistani, Indian and Gulf food.
Map what someone ate to catalogue dishes with portions. Do NOT estimate calories. If nothing in the catalogue is close, use "other".
Use "na" for meat_share and oil unless the words say so, and "unsure" for setting unless they mention a restaurant or home.

${RULES}

${catalogueText(catalogue)}`;
const TEXT_CONTEXT = text => `They wrote, in English, Roman Urdu or Urdu: "${String(text).slice(0, 300)}".`;

const schema = ids => ({
  type: 'object', additionalProperties: false, required: ['items', 'setting', 'scene'],
  properties: {
    setting: { type: 'string', enum: ['home', 'restaurant', 'unsure'] },
    scene: { type: 'string', enum: ['plate', 'shared', 'cooking_or_display', 'not_food'] },
    items: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['dish', 'alternative', 'other_name', 'servings', 'meat_share', 'oil', 'confidence'],
        properties: {
          // Not an enum: Gemini rejects a 200-value enum ("too much branching") and big enums slow every
          // answer down. The catalogue is in the prompt; checkAnswer() maps the reply back onto real ids.
          dish: { type: 'string', description: 'a catalogue id, or "other"' },
          alternative: { type: 'string', description: 'a catalogue id, or "none"' },
          other_name: { type: 'string' },
          servings: { type: 'number' },
          meat_share: { type: 'string', enum: ['less', 'normal', 'more', 'na'] },
          oil: { type: 'string', enum: ['less', 'normal', 'oily', 'na'] },
          confidence: { type: 'number' },
        },
      },
    },
  },
});

const usage = { calls: 0, in: 0, cached: 0, out: 0 };
const track = (i = 0, c = 0, o = 0) => { usage.calls++; usage.in += i; usage.cached += c; usage.out += o; };
const httpError = async (who, r) => { const e = new Error(`${who} ${r.status}: ${(await r.text()).slice(0, 300)}`); e.status = r.status; e.retryAfter = +r.headers.get('retry-after') || 0; return e; };
const imageOf = image => { const [, mime, data] = String(image).match(/^data:(image\/[a-z]+);base64,(.+)$/) || []; return { mime, data }; };

async function askAnthropic({ image, stat, text, ids, model = MODEL, timeout = 45e3 }) {
  // The fixed rules + dish list carry a cache marker: after the first call they're billed at a fraction.
  const content = [{ type: 'text', text: stat, cache_control: { type: 'ephemeral' } }, { type: 'text', text }];
  if (image) { const { mime, data } = imageOf(image); content.push({ type: 'image', source: { type: 'base64', media_type: mime, data } }); }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(timeout),
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 1500,
      tools: [{ name: 'report_plate', description: 'Report the foods.', input_schema: schema(ids) }],
      tool_choice: { type: 'tool', name: 'report_plate' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!r.ok) throw await httpError('anthropic', r);
  const j = await r.json(), u = j.usage || {};
  track((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), u.cache_read_input_tokens || 0, u.output_tokens || 0);
  return j.content.find(b => b.type === 'tool_use')?.input;
}

async function askOpenAI({ image, stat, text, ids, model = MODEL, timeout = 45e3 }) {
  // OpenAI caches a repeated prompt prefix automatically (1,024+ tokens), so the fixed part goes first.
  const content = [{ type: 'text', text: stat }, { type: 'text', text }];
  if (image) content.push({ type: 'image_url', image_url: { url: image } });
  const r = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(timeout),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_schema', json_schema: { name: 'plate', strict: true, schema: schema(ids) } },
      ...(process.env.OPENAI_REASONING ? { reasoning_effort: process.env.OPENAI_REASONING } : {}), // e.g. 'low' or 'none' for speed
      messages: [{ role: 'user', content }],
    }),
  });
  if (!r.ok) throw await httpError('openai', r);
  const j = await r.json(), u = j.usage || {}, c = u.prompt_tokens_details?.cached_tokens || 0;
  track((u.prompt_tokens || 0) - c, c, u.completion_tokens || 0);
  return JSON.parse(j.choices[0].message.content);
}

// Gemini takes an OpenAPI-style schema: upper-case type names and no additionalProperties.
export function toGeminiSchema(x) {
  if (Array.isArray(x)) return x.map(toGeminiSchema);
  if (!x || typeof x !== 'object') return x;
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === 'additionalProperties') continue;
    out[k] = k === 'type' && typeof v === 'string' ? v.toUpperCase() : (k === 'enum' ? v : toGeminiSchema(v));
  }
  return out;
}

// Gemini: implicit caching of the identical prefix; thinking turned down unless GEMINI_THINKING=default.
let thinkingOk = true;
function thinkingConfig(model) {
  const t = process.env.GEMINI_THINKING || 'off';
  if (t === 'default' || !thinkingOk) return undefined;
  if (/2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-[3-9]/.test(model)) return { thinkingLevel: t === 'off' ? 'minimal' : 'low' };
  return undefined;
}
async function askGemini({ image, stat, text, ids, model = MODEL, timeout = 45e3 }) {
  const parts = [{ text: stat }, { text }];
  if (image) { const { mime, data } = imageOf(image); parts.push({ inline_data: { mime_type: mime, data } }); }
  const gen = { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema(ids)) }, tc = thinkingConfig(model);
  if (tc) gen.thinkingConfig = tc;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(timeout),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: gen }),
  });
  if (!r.ok) {
    const e = await httpError('gemini', r);
    // A model that doesn't accept this thinking setting: drop it for good and ask again.
    if (r.status === 400 && tc && /thinking/i.test(e.message)) { thinkingOk = false; return askGemini({ image, stat, text, ids, model, timeout }); }
    const delay = e.message.match(/retryDelay"?:\s*"?(\d+)s/); if (delay) e.retryAfter = +delay[1];
    throw e;
  }
  const j = await r.json(), u = j.usageMetadata || {}, c = u.cachedContentTokenCount || 0;
  track((u.promptTokenCount || 0) - c, c, (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0));
  const out = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  return out ? JSON.parse(out) : null;
}

// Practice mode: a believable answer from the catalogue, picked from the image so the same photo gives the
// same plate; about 1 in 4 answers is unsure, so the "ask again" path gets exercised too. No network, no cost.
export async function askMock({ image, ids, hashOf = image || '' }) {
  let h = 7; const step = Math.max(1, Math.floor(hashOf.length / 256)); for (let i = 0; i < hashOf.length; i += step) h = (Math.imul(h, 31) + hashOf.charCodeAt(i)) >>> 0;
  await new Promise(r => setTimeout(r, (+process.env.MOCK_MS || 400) * (0.7 + (h % 60) / 100)));
  track(1200, 4000, 220);
  const pick = k => ids[(h >>> k) % ids.length], unsure = h % 4 === 0;
  return { setting: 'unsure', scene: 'plate', items: [
    { dish: pick(0), alternative: unsure ? pick(3) : 'none', other_name: '', servings: 1 + (h % 3) / 2, meat_share: 'normal', oil: 'normal', confidence: unsure ? 0.55 : 0.9 },
    { dish: pick(7), alternative: 'none', other_name: '', servings: 1, meat_share: 'na', oil: 'na', confidence: 0.85 },
  ] };
}

/* ---------- Staying up under load ---------- */
// A small semaphore: at most CONCURRENCY AI calls in flight; the rest wait their turn.
let inFlight = 0; const waiting = [];
const slot = () => inFlight < CONCURRENCY ? (inFlight++, Promise.resolve()) : new Promise(r => waiting.push(r));
const free = () => { const next = waiting.shift(); if (next) next(); else inFlight--; };
export const queueState = () => ({ inFlight, waiting: waiting.length });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Retry what's worth retrying (rate limits, overload, timeouts) with backoff; then the cheaper fallback model.
export async function withRetry(fn, { tries = 4, base = 500 } = {}) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      const retryable = !e.status || [408, 429, 500, 502, 503, 504].includes(e.status);
      if (!retryable || i >= tries - 1) throw e;
      await sleep(Math.min(20e3, e.retryAfter ? e.retryAfter * 1000 : base * 2 ** i) * (0.8 + Math.random() * 0.4));
    }
  }
}
const providers = () => ({ anthropic: askAnthropic, openai: askOpenAI, gemini: askGemini, mock: askMock });
async function askOne(job) {
  await slot();
  try {
    try { return checkAnswer(await withRetry(() => providers()[PROVIDER](job)), job.ids); }
    catch (e) {
      if (FALLBACK && [429, 500, 503].includes(e.status)) { console.warn(`${MODEL} busy (${e.status}); using ${FALLBACK}`); return checkAnswer(await withRetry(() => askGemini({ ...job, model: FALLBACK }), { tries: 2 }), job.ids); }
      throw e;
    }
  } finally { free(); }
}

/** Keep only real catalogue ids: near-misses ("Chicken Karahi", "chicken-karahi") are mapped, anything else becomes "other". */
export function checkAnswer(a, ids) {
  if (!a || !Array.isArray(a.items)) return a;
  const set = new Set(ids), norm = x => String(x || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const fix = (x, none) => set.has(x) ? x : set.has(norm(x)) ? norm(x) : none;
  return { ...a, items: a.items.slice(0, 12).map(i => { const d = fix(i.dish, null); return { ...i, servings: Math.min(10, Math.max(0.25, +i.servings || 1)), confidence: Math.min(1, Math.max(0, +i.confidence || 0)), dish: d || 'other', other_name: d ? i.other_name : (i.other_name || String(i.dish || '')), alternative: fix(i.alternative, 'none') }; }) };
}

/** Is one answer clear enough to stop at one call? (Each dish named with confidence, no runner-up.) */
export function sureEnough(a) {
  return !!a?.items?.length && a.scene !== 'not_food' && a.items.every(i => i.dish !== 'other' && (+i.confidence || 0) >= 0.75 && (!i.alternative || i.alternative === 'none'));
}

async function ask(job, samples) {
  // "fast": one quick call; the reply says whether a background double-check is worth it.
  if (samples === 'fast') {
    const quick = FAST ? { ...job, model: FAST, timeout: 12e3 } : job;
    let a; try { a = await askOne(quick); } catch (e) { if (!FAST) throw e; a = await askOne(job); } // fast model down: the main one answers
    return { samples: [a], refine: !sureEnough(a) };
  }
  // "refine": the background double-check, two calls to the main model.
  if (samples === 'refine') samples = 2;
  // "auto": one call, and two more only when that answer is unsure (the app keeps the majority of three).
  const adaptive = samples === 'auto' || samples == null;
  const n = adaptive ? 1 : Math.min(5, Math.max(1, samples | 0));
  const run = k => Promise.allSettled(Array.from({ length: k }, () => askOne(job)));
  let settled = await run(n);
  let out = settled.filter(s => s.status === 'fulfilled' && s.value).map(s => s.value);
  if (adaptive && !(out.length && sureEnough(out[0]))) { const more = await run(2); settled = [...settled, ...more]; out = [...out, ...more.filter(s => s.status === 'fulfilled' && s.value).map(s => s.value)]; }
  const err = settled.find(s => s.status === 'rejected')?.reason;
  if (err) console.error(`${settled.filter(s => s.status === 'rejected').length}/${settled.length} requests failed: ${err.message}`);
  if (!out.length) { const e = new Error('every request failed: ' + (err?.message || 'empty answers')); e.status = err?.status; throw e; }
  return out;
}
const remember = (key, v) => { cache.set(key, v); if (cache.size > 500) cache.delete(cache.keys().next().value); return v; };

const MODES = new Set(['fast', 'refine', 'auto']);
async function recognise({ image, samples = 'auto', hint = '', plateCm = null, usual = [] }) {
  samples = MODES.has(samples) ? samples : 'auto';
  hint = typeof hint === 'string' ? hint.slice(0, 200) : '';
  plateCm = Number.isFinite(+plateCm) && +plateCm >= 15 && +plateCm <= 40 ? +plateCm : null;
  usual = Array.isArray(usual) ? usual.filter(u => typeof u === 'string').slice(0, 15).map(u => u.slice(0, 40)) : [];
  const catalogue = CATALOGUE;
  const hash = crypto.createHash('sha256').update(image).digest('hex'); // ours, not the caller's
  const key = `${CAT_VERSION}|${hash}|${hint}|${samples}`; // the same photo with a different note is a different question
  if (key && cache.has(key)) return cache.get(key);
  const out = await ask({ image, stat: STATIC_PHOTO(catalogue), text: PHOTO_CONTEXT({ hint, plateCm, usual }), ids: catalogue.map(c => c.id), hashOf: hash || image }, samples);
  return key ? remember(key, out) : out;
}
async function understand({ text }) {
  const catalogue = CATALOGUE;
  text = String(text).slice(0, 300);
  const key = `${CAT_VERSION}|text|` + text.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);
  return remember(key, await ask({ stat: STATIC_TEXT(catalogue), text: TEXT_CONTEXT(text), ids: catalogue.map(c => c.id), hashOf: text }, 1));
}

// FatSecret live search (optional). Their terms don't allow keeping their data beyond 24 hours, so this
// only passes results through; the app stores a food in the client's own diary when they log it.
let fsToken = null, fsExpires = 0;
async function fatsecretToken() {
  if (fsToken && Date.now() < fsExpires - 60e3) return fsToken;
  const auth = Buffer.from(`${process.env.FATSECRET_CLIENT_ID}:${process.env.FATSECRET_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://oauth.fatsecret.com/connect/token', { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=basic' });
  if (!r.ok) throw new Error(`fatsecret token ${r.status}`);
  const j = await r.json(); fsToken = j.access_token; fsExpires = Date.now() + j.expires_in * 1000;
  return fsToken;
}
async function fatsecretSearch(q) {
  const u = new URL('https://platform.fatsecret.com/rest/server.api');
  u.search = new URLSearchParams({ method: 'foods.search', search_expression: q, format: 'json', max_results: '12' });
  const r = await fetch(u, { headers: { authorization: `Bearer ${await fatsecretToken()}` } });
  if (!r.ok) throw new Error(`fatsecret ${r.status}`);
  let foods = (await r.json())?.foods?.food || [];
  if (!Array.isArray(foods)) foods = [foods];
  return foods.map(f => ({ id: String(f.food_id), name: [f.brand_name, f.food_name].filter(Boolean).join(' · '), ...parseFatSecret(f.food_description) }))
    .filter(f => Number.isFinite(f.kcal));
}

let served = 0, failed = 0, busy = 0, pending = 0;
export const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'GET' && req.url.startsWith('/health')) {
    res.setHeader('content-type', 'application/json');
    const cost = (usage.in * PRICE.in + usage.cached * PRICE.cached + usage.out * PRICE.out) / 1e6;
    return res.end(JSON.stringify({ ok: !!PROVIDER, provider: PROVIDER, model: MODEL, fast: FAST || null, fallback: FALLBACK || null, ...queueState(), pending, served, failed, busy, usage, estCostUsd: Math.round(cost * 1e4) / 1e4, costPerPhotoUsd: served ? Math.round(cost / served * 1e5) / 1e5 : null }));
  }
  if (req.method === 'GET' && req.url.startsWith('/food-search')) {
    const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
    if (!process.env.FATSECRET_CLIENT_ID || q.length < 2) { res.setHeader('content-type', 'application/json'); return res.end('{"foods":[]}'); }
    try { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ foods: await fatsecretSearch(q.slice(0, 80)) })); }
    catch (e) { console.error(e.message); res.statusCode = 502; return res.end('{"foods":[]}'); }
  }
  // Chat: the app calls this right after a client sends a message; Muhammad answers within a few seconds.
  // Needs the sign-in check (SUPABASE_URL + SUPABASE_ANON_KEY) to know who is asking, and the service key to reply.
  // Muhammad's voice: { text } → WAV. Signed-in clients only (it costs money), 20 a minute.
  if (req.method === 'POST' && req.url.startsWith('/chat-voice')) {
    let body = ''; for await (const c of req) { body += c; if (body.length > 4000) { res.statusCode = 413; return res.end(); } }
    const who = await caller(req);
    if (!who) { res.statusCode = 401; return res.end('{"error":"sign in"}'); }
    if (!voiceOn()) { res.statusCode = 501; return res.end('{"error":"no voice"}'); }
    if (!allow('voice:' + who, Date.now(), 2)) { res.statusCode = 429; return res.end('{"error":"busy"}'); }
    try { const q = JSON.parse(body || '{}'); const a = await speak(q.text); res.setHeader('content-type', 'audio/wav'); res.setHeader('cache-control', 'private, max-age=86400'); return res.end(a); }
    catch (e) { console.error('voice:', e.message); res.statusCode = e.message === 'bad request' ? 400 : 502; return res.end('{"error":"failed"}'); }
  }
  if (req.method === 'POST' && req.url.startsWith('/chat')) {
    res.setHeader('content-type', 'application/json');
    for await (const _ of req); // no body needed
    const who = await caller(req);
    if (!who) { res.statusCode = 401; return res.end('{"error":"sign in"}'); }
    if (!allow('chat:' + who, Date.now(), 3)) /* key isn't a bare id, so the limit is 3 × 10 = 30 a minute */ { res.statusCode = 429; return res.end('{"error":"busy"}'); }
    try { const r = await chatAnswer(who); return res.end(JSON.stringify({ ok: true, posted: !!r.posted })); }
    catch (e) { console.error('chat:', e.message); res.statusCode = 502; return res.end('{"error":"failed"}'); }
  }
  // Menu board: { image, item } → { kcal } read off a photo of the menu (UAE menus must show calories).
  if (req.method === 'POST' && req.url.startsWith('/food-menu')) {
    res.setHeader('content-type', 'application/json');
    let body = ''; for await (const c of req) { body += c; if (body.length > 1.5e6) { res.statusCode = 413; return res.end('{"error":"too big"}'); } }
    const who = await caller(req);
    if (who === false) { res.statusCode = 401; return res.end('{"error":"sign in"}'); }
    if (!allow('menu:' + (who || req.socket.remoteAddress), Date.now(), 1)) { res.statusCode = 429; return res.end('{"error":"busy"}'); }
    try {
      const q = JSON.parse(body || '{}');
      if (typeof q.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(q.image)) throw new Error('bad request');
      return res.end(JSON.stringify(await readMenu(q.image, typeof q.item === 'string' ? q.item.slice(0, 80) : '')));
    } catch (e) { console.error('menu:', e.message); res.statusCode = e.message === 'bad request' ? 400 : 502; return res.end(JSON.stringify({ error: e.message === 'bad request' ? 'bad request' : 'failed' })); }
  }
  if (req.method !== 'POST' || !/^\/food-(vision|text)/.test(req.url)) { res.statusCode = 404; return res.end(); }
  // Too many photos waiting: say so straight away (the app waits and tries once more) rather than time out.
  if (pending >= MAX_QUEUE) { busy++; res.statusCode = 503; res.setHeader('Retry-After', '5'); return res.end('{"error":"busy"}'); }
  pending++;
  try { await handle(req, res); } finally { pending--; }
});
async function handle(req, res) {
  let body = '';
  // A 640 px photo is ~100 KB; anything over 1.5 MB is not a meal photo from the app.
  for await (const chunk of req) { body += chunk; if (body.length > 1.5e6) { res.statusCode = 413; return res.end('{"error":"too big"}'); } }
  const who = await caller(req);
  if (who === false) { res.statusCode = 401; return res.end('{"error":"sign in"}'); }
  if (!allow(who || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress)) { res.statusCode = 429; res.setHeader('Retry-After', '30'); return res.end('{"error":"busy"}'); }
  try {
    let q; try { q = JSON.parse(body); } catch { throw new Error('bad request'); }
    if (!q || typeof q !== 'object') throw new Error('bad request');
    let samples;
    if (req.url.startsWith('/food-text')) { if (typeof q.text !== 'string' || !q.text.trim()) throw new Error('bad request'); samples = await understand(q); }
    else { if (typeof q.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(q.image)) throw new Error('bad request'); samples = await recognise(q); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(Array.isArray(samples) ? { samples } : samples)); served++;
  } catch (e) {
    console.error(e.message); failed++;
    const limited = e.status === 429 || e.status === 503;
    res.statusCode = limited ? 503 : e.message === 'bad request' ? 400 : 502; if (limited) res.setHeader('Retry-After', '10');
    // Never echo internal or provider error text to the caller.
    res.end(JSON.stringify({ error: limited ? 'busy' : e.message === 'bad request' ? 'bad request' : 'failed' }));
  }
}
if (import.meta.url === `file://${process.argv[1]}`)
  server.listen(PORT, () => console.log(PROVIDER ? `Food vision on :${PORT} using ${PROVIDER} ${MODEL}${FALLBACK ? ` (fallback ${FALLBACK})` : ''}, ${CONCURRENCY} at a time` : 'Set GEMINI_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY (or FOOD_AI=mock) first.'));

/* ---------- Who is asking, and how often ---------- */
const seen = new Map(); // token hash → { id, until }
/** The signed-in client's id, null when sign-in isn't required, or false when it's required and missing/invalid. */
async function caller(req) {
  if (!AUTH_URL || !AUTH_KEY) return null;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const k = crypto.createHash('sha256').update(token).digest('hex'), hit = seen.get(k);
  if (hit && hit.until > Date.now()) return hit.id;
  try {
    const r = await fetch(`${AUTH_URL}/auth/v1/user`, { headers: { apikey: AUTH_KEY, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    const id = (await r.json())?.id; if (!id) return false;
    seen.set(k, { id, until: Date.now() + 10 * 60e3 }); if (seen.size > 20000) seen.delete(seen.keys().next().value);
    return id;
  } catch { return false; }
}
// A sliding one-minute window per client (or address). Phones on the same mobile network share an address, so the
// per-address limit is 10x looser than the per-client one.
const hits = new Map();
export function allow(who, now = Date.now(), perMin = RATE) {
  const limit = /^[0-9a-f-]{36}$/.test(String(who)) ? perMin : perMin * 10;
  const list = (hits.get(who) || []).filter(t => t > now - 60e3);
  if (list.length >= limit) { hits.set(who, list); return false; }
  list.push(now); hits.set(who, list);
  if (hits.size > 50000) hits.delete(hits.keys().next().value);
  return true;
}

/* ---------- Menu board: read one item's calories ---------- */
/** { kcal: number|null, name } for the item on a photographed menu (null when the menu doesn't show calories). */
export async function readMenu(image, item = '') {
  const ask = `This is a photo of a restaurant menu or menu board. Find the item "${item.replace(/"/g, '')}" (or the closest match) and the calories printed for it. Answer with JSON only: {"name": "the item as printed", "kcal": number or null}. Use null if no calories are printed for it. Never estimate.`;
  const clean = a => { const k = Math.round(+a?.kcal); return { name: String(a?.name || item).slice(0, 80), kcal: k > 20 && k < 5000 ? k : null }; };
  if (PROVIDER === 'mock') return clean({ name: item, kcal: 550 });
  if (PROVIDER === 'gemini') {
    const { mime, data } = imageOf(image);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FAST || MODEL)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(20e3), headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: ask }, { inline_data: { mime_type: mime, data } }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    if (!r.ok) throw await httpError('gemini', r);
    return clean(JSON.parse((await r.json()).candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}'));
  }
  if (PROVIDER === 'openai') {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(20e3), headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: ask }, { type: 'image_url', image_url: { url: image } }] }] }),
    });
    if (!r.ok) throw await httpError('openai', r);
    return clean(JSON.parse((await r.json()).choices[0].message.content));
  }
  const { mime, data } = imageOf(image);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(20e3), headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data } }, { type: 'text', text: ask }] }] }),
  });
  if (!r.ok) throw await httpError('anthropic', r);
  const t = (await r.json()).content?.map(c => c.text || '').join('') || '{}';
  return clean(JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] || '{}'));
}
