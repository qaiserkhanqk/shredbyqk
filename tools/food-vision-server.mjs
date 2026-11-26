#!/usr/bin/env node
// Food photo recogniser: a tiny server that keeps your AI key off the phone.
// No dependencies (Node 18+).
//
//   ANTHROPIC_API_KEY=... node tools/food-vision-server.mjs          # Claude (default model claude-sonnet-5-5)
//   OPENAI_API_KEY=...    node tools/food-vision-server.mjs          # OpenAI (set OPENAI_MODEL, default gpt-4o)
//   PORT=8787 ALLOW_ORIGIN=https://you.github.io node tools/food-vision-server.mjs
//   FATSECRET_CLIENT_ID=... FATSECRET_CLIENT_SECRET=...   # optional: live fallback search, GET /food-search?q=
//
// Then set PHOTO_CONFIG.endpoint in js/foodphoto.js to http(s)://<host>:8787/food-vision.
// POST /food-text understands meal descriptions the app's own parser couldn't.
//
// The model is asked to IDENTIFY and MEASURE, never to give calories (see js/foodphoto.js for why).
// It answers through a strict JSON schema whose dish field is an enum of the app's catalogue, it is
// asked `samples` times in parallel, and the app keeps the consensus. Answers are cached by image hash.
import http from 'node:http';
import { parseFatSecret } from '../js/fatsecret.js';

const PORT = +process.env.PORT || 8787;
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const PROVIDER = process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : null;
const MODEL = PROVIDER === 'anthropic' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5') : (process.env.OPENAI_MODEL || 'gpt-4o');
const cache = new Map(); // hash → samples

const RULES = `For each separate food:
- dish: pick the closest id from the catalogue below. Use "other" only if nothing is close, and then name it in other_name.
- alternative: the second most likely catalogue id for the same food (another member of its family is typical:
  naan vs roghni naan, chicken karahi vs chicken handi), or "none" if you're sure.
- servings: how many of that dish's serving unit (given per dish). Count breads, kebabs, samosas, eggs and pieces one
  by one. For curries and rice judge volume: a katori is about 200 g (a small bowl, about 1 cup); a full dinner plate of
  rice is about 300 g. Use halves (0.5, 1.5). If only part of a roti or naan is left, count what is left.
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

// Photo: what the person told us helps more than anything a camera can infer.
const PHOTO_PROMPT = (catalogue, x = {}) => `You are the food-recognition step of a calorie tracker for Pakistani and Indian food.
Do NOT estimate calories, grams of fat or macros. Only identify and measure what is on the plate.
${x.plateCm ? `Scale: this person's usual dinner plate is about ${x.plateCm} cm across; a katori is about 10 cm. Use them to judge volume.\n` : ''}${x.hint ? `The person says: "${String(x.hint).slice(0, 200)}". Trust it for what the food is and who cooked it; still count portions from the photo.\n` : ''}${x.usual?.length ? `Foods this person often eats (prefer these when the photo is ambiguous): ${x.usual.slice(0, 15).join(', ')}.\n` : ''}
${RULES}

${catalogueText(catalogue)}`;

// Text: words the app's own parser didn't catch ("kadhi chawal ki plate").
const TEXT_PROMPT = (catalogue, text) => `You are the meal-understanding step of a calorie tracker for Pakistani and Indian food.
Someone described what they ate, in English, Roman Urdu or Urdu: "${String(text).slice(0, 300)}".
Map it to catalogue dishes with portions. Do NOT estimate calories. If nothing in the catalogue is close, use "other".
Use "na" for meat_share and oil unless the words say so, and "unsure" for setting unless they mention a restaurant or home.

${RULES}

${catalogueText(catalogue)}`;

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
          dish: { type: 'string', enum: [...ids, 'other'] },
          alternative: { type: 'string', enum: [...ids, 'none'] },
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

async function askAnthropic({ image, text, ids }) {
  const content = [{ type: 'text', text }];
  if (image) { const [, mediaType, data] = image.match(/^data:(image\/[a-z]+);base64,(.+)$/) || []; content.unshift({ type: 'image', source: { type: 'base64', media_type: mediaType, data } }); }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500,
      tools: [{ name: 'report_plate', description: 'Report the foods.', input_schema: schema(ids) }],
      tool_choice: { type: 'tool', name: 'report_plate' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).content.find(b => b.type === 'tool_use')?.input;
}

async function askOpenAI({ image, text, ids }) {
  const content = [{ type: 'text', text }];
  if (image) content.push({ type: 'image_url', image_url: { url: image } });
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_schema', json_schema: { name: 'plate', strict: true, schema: schema(ids) } },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return JSON.parse((await r.json()).choices[0].message.content);
}

async function ask(job, samples) {
  const fn = PROVIDER === 'anthropic' ? askAnthropic : askOpenAI;
  const n = Math.min(5, Math.max(1, samples | 0));
  const out = (await Promise.allSettled(Array.from({ length: n }, () => fn(job)))).filter(s => s.status === 'fulfilled' && s.value).map(s => s.value);
  if (!out.length) throw new Error('every request failed');
  return out;
}
const remember = (key, v) => { cache.set(key, v); if (cache.size > 500) cache.delete(cache.keys().next().value); return v; };

async function recognise({ image, hash, samples = 3, catalogue, hint = '', plateCm = null, usual = [] }) {
  const key = hash && `${hash}|${hint}`; // the same photo with a different note is a different question
  if (key && cache.has(key)) return cache.get(key);
  const out = await ask({ image, text: PHOTO_PROMPT(catalogue, { hint, plateCm, usual }), ids: catalogue.map(c => c.id) }, samples);
  return key ? remember(key, out) : out;
}
async function understand({ text, catalogue }) {
  const key = 'text|' + text.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);
  return remember(key, await ask({ text: TEXT_PROMPT(catalogue, text), ids: catalogue.map(c => c.id) }, 1));
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

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'GET' && req.url.startsWith('/food-search')) {
    const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
    if (!process.env.FATSECRET_CLIENT_ID || q.length < 2) { res.setHeader('content-type', 'application/json'); return res.end('{"foods":[]}'); }
    try { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ foods: await fatsecretSearch(q.slice(0, 80)) })); }
    catch (e) { console.error(e.message); res.statusCode = 502; return res.end('{"foods":[]}'); }
  }
  if (req.method !== 'POST' || !/^\/food-(vision|text)/.test(req.url)) { res.statusCode = 404; return res.end(); }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 6e6) { res.statusCode = 413; return res.end(); } }
  try {
    const q = JSON.parse(body);
    if (!Array.isArray(q.catalogue)) throw new Error('bad request');
    let samples;
    if (req.url.startsWith('/food-text')) { if (!q.text) throw new Error('bad request'); samples = await understand(q); }
    else { if (!/^data:image\//.test(q.image || '')) throw new Error('bad request'); samples = await recognise(q); }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ samples }));
  } catch (e) {
    console.error(e.message);
    res.statusCode = 502; res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log(PROVIDER ? `Food vision on :${PORT} using ${PROVIDER} ${MODEL}` : 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY first.'));
