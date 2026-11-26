// Photo → foods, with answers that stay the same from one photo to the next.
//
// Why the old ChatGPT feature gave different calories every time: it asked the model for calories,
// and a language model samples its answer, so the number drifted from photo to photo. Here the model
// is only allowed to do what vision is good at:
//   1. name each dish, chosen from OUR catalogue (a fixed list of ids, not free text)
//   2. count or estimate the portion in household units (rotis, katori, plate, pieces)
//   3. say what it can see: mostly meat or gravy, oil floating on top, restaurant or home setting
// The calories are then computed by js/nutrition.js, so the same dish and portion always give the
// same number. On top of that:
//   - the server asks the model several times and we keep the consensus (majority dish, median portion)
//   - results are cached by a hash of the image, so the same photo always returns the same answer
//   - the user confirms who cooked it, the one thing a camera can't see, and the app remembers it per dish
import { DISHES, DISH } from './nutrition.js';

export const PHOTO_CONFIG = {
  // Your server route (see tools/food-vision-server.mjs). Keep the AI key on the server, never in the app.
  endpoint: '',
  // Optional live fallback search (FatSecret) on the same server, e.g. 'https://your-server/food-search'.
  searchEndpoint: '',
  samples: 3,
  maxSide: 768, // a bigger image costs more and doesn't help the model count rotis
};

// The catalogue the model must choose from, with what one serving means, so portions come back in our units.
export const catalogue = () => DISHES.map(d => ({ id: d.id, name: d.name, serving: `1 ${d.serve} ≈ ${d.cooked} g` }));

const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mode = xs => { const c = {}; let best = null; for (const x of xs) { c[x] = (c[x] || 0) + 1; if (best === null || c[x] > c[best]) best = x; } return best; };
const half = v => Math.max(0.5, Math.round(v * 2) / 2);

// samples: [{ items: [{ dish, servings, meat_share, oil, confidence, other_name }], setting }]
// A dish is kept when at least half the samples saw it. Order follows the first sample that saw it.
export function consensus(samples) {
  const ok = (samples || []).filter(s => Array.isArray(s?.items));
  if (!ok.length) return { items: [], setting: 'unsure', agreement: 0 };
  const need = Math.ceil(ok.length / 2), by = new Map();
  ok.forEach((s, si) => {
    const seen = new Set();
    s.items.forEach((it, ii) => {
      const id = DISH[it.dish] ? it.dish : 'other:' + String(it.other_name || 'unknown').toLowerCase().trim();
      if (seen.has(id)) { const g = by.get(id); g.servings[g.servings.length - 1] += +it.servings || 0; return; } // two piles of the same dish
      seen.add(id);
      if (!by.has(id)) by.set(id, { id, order: si * 100 + ii, servings: [], meat: [], oil: [], conf: [], name: it.other_name });
      const g = by.get(id);
      g.servings.push(+it.servings || 1); g.meat.push(it.meat_share || 'na'); g.oil.push(it.oil || 'na'); g.conf.push(+it.confidence || 0.5);
    });
  });
  const items = [...by.values()].filter(g => g.servings.length >= need).sort((a, b) => a.order - b.order).map(g => ({
    dish: g.id.startsWith('other:') ? null : g.id,
    otherName: g.id.startsWith('other:') ? g.name : null,
    servings: half(median(g.servings)),
    meat: ['less', 'normal', 'more'].includes(mode(g.meat)) ? mode(g.meat) : 'normal',
    oil: ['less', 'normal', 'oily'].includes(mode(g.oil)) ? mode(g.oil) : 'normal',
    confidence: g.conf.reduce((a, b) => a + b, 0) / g.conf.length,
    agree: g.servings.length / ok.length,
  }));
  const setting = mode(ok.map(s => s.setting || 'unsure'));
  // How much the samples agreed overall: shown to the user as "QK is sure" vs "please check".
  const agreement = items.length ? items.reduce((a, i) => a + i.agree, 0) / items.length : 0;
  return { items, setting, agreement };
}

// Downscale to JPEG and hash it, so the same photo always maps to the same cache entry.
export async function prepareImage(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, PHOTO_CONFIG.maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), ch => ch.charCodeAt(0));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  return { dataUrl, hash };
}

const CACHE_KEY = 'shred_food_photo_v1';
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } };
function writeCache(hash, result) {
  const c = readCache(); c[hash] = { at: Date.now(), result };
  const keys = Object.keys(c).sort((a, b) => c[b].at - c[a].at).slice(0, 40); // keep the newest 40
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keys.map(k => [k, c[k]])))); } catch {}
}

export async function recognise(file) {
  if (!PHOTO_CONFIG.endpoint) throw new Error('no-endpoint');
  const { dataUrl, hash } = await prepareImage(file);
  const hit = readCache()[hash];
  if (hit) return { ...hit.result, cached: true, dataUrl };
  const r = await fetch(PHOTO_CONFIG.endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl, hash, samples: PHOTO_CONFIG.samples, catalogue: catalogue() }),
  });
  if (!r.ok) throw new Error('server ' + r.status);
  const result = consensus((await r.json()).samples);
  writeCache(hash, result);
  return { ...result, cached: false, dataUrl };
}
