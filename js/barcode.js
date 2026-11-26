// Barcode scanning for packaged food (Shan masala, Nestlé, biscuits, drinks, protein bars).
// Product data comes from Open Food Facts: free, open (ODbL, so we may keep a copy), and it covers many
// Pakistani brands. Scanning uses the browser's BarcodeDetector where available (Chrome on Android);
// everywhere else the user types the number under the bars.
import { registerProduct } from './nutrition.js';

export const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const KEY = 'shred_barcodes_v1';

const num = v => (v === undefined || v === null || v === '' || Number.isNaN(+v) ? null : +v);

/** Open Food Facts product JSON → our product, or null when it has no usable nutrition. */
export function fromOFF(code, j) {
  const p = j?.product; if (!p || j.status === 0) return null;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null && num(n.energy_100g) !== null) kcal = n.energy_100g / 4.184; // only kJ given
  if (kcal === null) return null;
  const name = [p.brands?.split(',')[0]?.trim(), p.product_name || p.generic_name].filter(Boolean).join(' · ') || `Product ${code}`;
  return {
    code: String(code), name, source: 'Open Food Facts',
    per100: { kcal, protein: num(n.proteins_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0, fat: num(n.fat_100g) ?? 0, fibre: num(n.fiber_100g) ?? 0, sugar: num(n.sugars_100g), salt: num(n.salt_100g) },
    servingG: num(p.serving_quantity) || null, servingLabel: p.serving_size || null,
  };
}

const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
/** Restore products the user scanned before, so old log entries still resolve offline. */
export function loadSaved() { const c = readCache(); Object.values(c).forEach(registerProduct); return c; }

export async function lookupBarcode(code, fetcher = fetch) {
  code = String(code).replace(/\D/g, '');
  if (code.length < 6) throw new Error('short');
  const c = readCache(); if (c[code]) return registerProduct(c[code]);
  const r = await fetcher(`${OFF_URL}${code}.json?fields=product_name,generic_name,brands,nutriments,serving_size,serving_quantity`);
  if (!r.ok && r.status !== 404) throw new Error('network');
  const p = fromOFF(code, await r.json());
  if (!p) return null;
  c[code] = p; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
  return registerProduct(p);
}

/** Live camera scanning; resolves with the first code seen. Needs BarcodeDetector support. */
export const canScan = () => 'BarcodeDetector' in globalThis;
export async function scanFrom(video, { signal } = {}) {
  const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  while (!signal?.aborted) {
    try { const codes = await det.detect(video); if (codes[0]?.rawValue) return codes[0].rawValue; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}
