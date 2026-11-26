#!/usr/bin/env node
// Food photo recogniser: a tiny server that keeps your AI key off the phone.
// No dependencies (Node 18+).
//
//   ANTHROPIC_API_KEY=... node tools/food-vision-server.mjs          # Claude (default model claude-sonnet-5-5)
//   OPENAI_API_KEY=...    node tools/food-vision-server.mjs          # OpenAI (set OPENAI_MODEL, default gpt-4o)
//   PORT=8787 ALLOW_ORIGIN=https://you.github.io node tools/food-vision-server.mjs
//
// Then set PHOTO_CONFIG.endpoint in js/foodphoto.js to http(s)://<host>:8787/food-vision.
//
// The model is asked to IDENTIFY and MEASURE, never to give calories (see js/foodphoto.js for why).
// It answers through a strict JSON schema whose dish field is an enum of the app's catalogue, it is
// asked `samples` times in parallel, and the app keeps the consensus. Answers are cached by image hash.
import http from 'node:http';

const PORT = +process.env.PORT || 8787;
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const PROVIDER = process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : null;
const MODEL = PROVIDER === 'anthropic' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5') : (process.env.OPENAI_MODEL || 'gpt-4o');
const cache = new Map(); // hash → samples

const PROMPT = catalogue => `You are the food-recognition step of a calorie tracker for Pakistani and Indian food.
Do NOT estimate calories, grams of fat or macros. Only identify and measure what is on the plate.

For each separate food you can see:
- dish: pick the closest id from the catalogue below. Use "other" only if nothing is close, and then name it in other_name.
- servings: how many of that dish's serving unit are visible (the unit is given per dish). Count breads, kebabs,
  samosas, eggs and pieces one by one. For curries and rice judge volume against the plate or bowl:
  a katori is about 200 g (a small bowl, about 1 cup); a full dinner plate of rice is about 300 g. Use halves (0.5, 1.5).
  If only part of a roti or naan is left, count what is left.
  Be exact about breads, they differ a lot: a thin phulka, a roti/chapati, a big tandoori roti, a naan, a roghni naan
  (glossy with sesame), a kulcha, taftan or sheermal (sweet, yellowish), a paratha (layered, oily sheen) or a puri (puffed, fried).
  Fast food counts too: burgers, fried chicken, fries, pizza slices, shawarma and rolls are in the catalogue.
- meat_share (curries and rice with meat only, else "na"): "more" if the serving is mostly meat pieces,
  "less" if it is mostly gravy or rice with few pieces, else "normal".
- oil (cooked dishes only, else "na"): "oily" if you can see a layer of oil (tarri) on top or pooled at the edge,
  "less" if it looks dry or lightly cooked, else "normal".
- confidence: 0 to 1, how sure you are of the dish.
setting: "restaurant" if this looks like a restaurant, dhaba or wedding (karahi pans, foil, branded boxes, buffet),
"home" if it looks like home, else "unsure".

Catalogue (id: name, serving unit):
${catalogue.map(c => `${c.id}: ${c.name} (${c.serving})`).join('\n')}`;

const schema = ids => ({
  type: 'object', additionalProperties: false, required: ['items', 'setting'],
  properties: {
    setting: { type: 'string', enum: ['home', 'restaurant', 'unsure'] },
    items: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['dish', 'other_name', 'servings', 'meat_share', 'oil', 'confidence'],
        properties: {
          dish: { type: 'string', enum: [...ids, 'other'] },
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

async function askAnthropic(image, catalogue) {
  const [, mediaType, data] = image.match(/^data:(image\/[a-z]+);base64,(.+)$/) || [];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500,
      tools: [{ name: 'report_plate', description: 'Report the foods on the plate.', input_schema: schema(catalogue.map(c => c.id)) }],
      tool_choice: { type: 'tool', name: 'report_plate' },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: PROMPT(catalogue) },
      ] }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j.content.find(b => b.type === 'tool_use')?.input;
}

async function askOpenAI(image, catalogue) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_schema', json_schema: { name: 'plate', strict: true, schema: schema(catalogue.map(c => c.id)) } },
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT(catalogue) }, { type: 'image_url', image_url: { url: image } }] }],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return JSON.parse((await r.json()).choices[0].message.content);
}

async function recognise({ image, hash, samples = 3, catalogue }) {
  if (hash && cache.has(hash)) return cache.get(hash);
  const ask = PROVIDER === 'anthropic' ? askAnthropic : askOpenAI;
  const n = Math.min(5, Math.max(1, samples | 0));
  const out = (await Promise.allSettled(Array.from({ length: n }, () => ask(image, catalogue))))
    .filter(s => s.status === 'fulfilled' && s.value).map(s => s.value);
  if (!out.length) throw new Error('every request failed');
  if (hash) { cache.set(hash, out); if (cache.size > 500) cache.delete(cache.keys().next().value); }
  return out;
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST' || !req.url.startsWith('/food-vision')) { res.statusCode = 404; return res.end(); }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 6e6) { res.statusCode = 413; return res.end(); } }
  try {
    const q = JSON.parse(body);
    if (!/^data:image\//.test(q.image || '') || !Array.isArray(q.catalogue)) throw new Error('bad request');
    const samples = await recognise(q);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ samples }));
  } catch (e) {
    console.error(e.message);
    res.statusCode = 502; res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log(PROVIDER ? `Food vision on :${PORT} using ${PROVIDER} ${MODEL}` : 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY first.'));
