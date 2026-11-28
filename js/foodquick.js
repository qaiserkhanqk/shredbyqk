// Fewer taps: the meals people eat again and again, logged in one tap. Pure logic (no DOM), unit tested.
//
// - usualMeals: "Your usual" chips for this meal (the same meal eaten on 2+ days in the last 30, with the client's
//   own portions and cooking style from the last time).
// - copyOf: a meal or a whole day again (yesterday's lunch, today).
// - saved meals: "Ammi's daal chawal" = the exact items, searchable.
// - shared plates: "hum 4 the" / "shared with 3" divides the shared dishes (karahi, biryani, salan), not counted
//   items (roti, naan, kebab): those stay the client's own count.
// - extras: the things photos and memory miss most (chai, cold drink, raita, an extra roti, mithai, fries).
// - protein ideas: "Protein left 60 g" with desi ways to get it.
// - Ramadan: meals become Sehri, Iftar and Late.
import { DISH } from './nutrition.js';

const DAY = 864e5;
export const dayKey = t => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/* ---------- Meal slots (and Ramadan) ---------- */
export const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'], RAMADAN_MEALS = ['Sehri', 'Iftar', 'Late'];
/** The meal a time belongs to. In Ramadan: before 9 am Sehri, then Iftar from 5 pm, later Late. */
export function mealFor(t = Date.now(), ramadan = false) {
  const h = new Date(t).getHours();
  if (ramadan) return h < 9 ? 'Sehri' : h < 21 ? 'Iftar' : 'Late';
  return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19 ? 'Snack' : 'Dinner';
}
const HOUR = { Breakfast: 8, Lunch: 13, Snack: 17, Dinner: 20, Sehri: 4, Iftar: 18, Late: 22 };
/** A time for "I'm logging this meal for that day": now if it's today and the slot is now, else the slot's usual hour. */
export function timeFor(meal, daysAgo = 0, now = Date.now(), ramadan = false) {
  if (!daysAgo && mealFor(now, ramadan) === meal) return now;
  const d = new Date(now - daysAgo * DAY); d.setHours(HOUR[meal] ?? 12, 0, 0, 0);
  // Logging a later meal of today in advance makes no sense: keep it today but not in the future.
  return Math.min(d.getTime(), now);
}

/* ---------- Your usual ---------- */
const itemOf = e => ({ ref: e.ref, opts: { ...e.opts }, name: e.name, official: e.official });
const sig = items => items.map(i => `${i.ref?.t}:${i.ref?.id ?? i.ref?.code ?? ''}`).sort().join('+');
/** Meals in the log grouped by day and slot: [{ day, meal, at, items }]. */
export function mealGroups(log = []) {
  const g = new Map();
  for (const e of log) { if (!e?.ref) continue; const k = dayKey(e.at) + '|' + e.meal; if (!g.has(k)) g.set(k, { day: dayKey(e.at), meal: e.meal, at: e.at, items: [] }); const x = g.get(k); x.items.push(e); x.at = Math.max(x.at, e.at); }
  return [...g.values()];
}
/**
 * One-tap chips for a meal slot: whole meals eaten on 2+ days in the last 30 (most frequent first, the latest
 * portions), then single dishes the client logs often in this slot. Already-logged-today meals are left out.
 */
export function usualMeals(log = [], meal, now = Date.now(), max = 5) {
  const since = now - 30 * DAY, today = dayKey(now);
  const groups = mealGroups(log.filter(e => e.at >= since && e.at <= now)).filter(g => g.meal === meal);
  const todays = new Set(groups.filter(g => g.day === today).map(g => sig(g.items)));
  const by = new Map();
  for (const g of groups) {
    if (g.items.length > 8) continue;
    const s = sig(g.items); const x = by.get(s) || { sig: s, days: new Set(), last: null };
    x.days.add(g.day); if (!x.last || g.at > x.last.at) x.last = g; by.set(s, x);
  }
  const whole = [...by.values()].filter(x => x.days.size >= 2 && !todays.has(x.sig)).sort((a, b) => b.days.size - a.days.size || b.last.at - a.last.at)
    .map(x => ({ key: x.sig, items: x.last.items.map(itemOf), days: x.days.size }));
  // Single dishes logged in this slot on 3+ days (a chai every morning).
  const single = new Map();
  for (const g of groups) for (const e of g.items) { const s = sig([e]); const x = single.get(s) || { days: new Set(), last: e }; x.days.add(g.day); if (e.at > x.last.at) x.last = e; single.set(s, x); }
  const singles = [...single.entries()].filter(([s, x]) => x.days.size >= 3 && !whole.some(w => w.key === s)).sort((a, b) => b[1].days.size - a[1].days.size)
    .map(([s, x]) => ({ key: s, items: [itemOf(x.last)], days: x.days.size }));
  return [...whole, ...singles].slice(0, max).map(u => ({ ...u, label: labelOf(u.items), kcal: Math.round(u.items.reduce((a, i) => a + (kcalOf(i, log) || 0), 0)) }));
}
const short = n => String(n || '').split(' · ').pop().replace(/\s*\(.*?\)\s*/g, ' ').trim();
export const labelOf = items => items.slice(0, 3).map(i => short(i.name)).join(' + ') + (items.length > 3 ? ` +${items.length - 3}` : '');
// The calories of an item as last logged (the log entry has them; saved items look them up by the same ref).
function kcalOf(item, log) { const e = [...log].reverse().find(x => x.ref && sig([x]) === sig([item]) && JSON.stringify(x.opts) === JSON.stringify(item.opts)); return e?.kcal ?? null; }

/** The items of one meal (or the whole day, meal = null) on the day `daysAgo` before `now`. */
export function copyOf(log = [], daysAgo = 1, meal = null, now = Date.now()) {
  const k = dayKey(now - daysAgo * DAY);
  return log.filter(e => e.ref && dayKey(e.at) === k && (!meal || e.meal === meal)).sort((a, b) => a.at - b.at).map(e => ({ ...itemOf(e), meal: e.meal }));
}

/* ---------- Saved meals ---------- */
/** A saved meal from log entries. */
export function saveMeal(name, entries) {
  const items = entries.filter(e => e.ref).map(itemOf);
  if (!items.length) return null;
  return { id: 'm' + Math.random().toString(36).slice(2, 9), name: String(name || labelOf(items)).trim().slice(0, 60), items, kcal: Math.round(entries.reduce((a, e) => a + (e.kcal || 0), 0)), at: Date.now() };
}
/** Saved meals matching a search ("daal" finds "Ammi's daal chawal"). */
export function findSaved(saved = [], q = '') {
  const t = String(q).toLowerCase().trim(); if (t.length < 2) return [];
  return saved.filter(m => m.name.toLowerCase().includes(t) || m.items.some(i => String(i.name).toLowerCase().includes(t))).slice(0, 4);
}

/* ---------- Shared plates ---------- */
// Dishes served in one pot for everyone; counted things (roti, kebab, samosa, egg, drinks) are not divided.
const SHARED_KINDS = new Set(['curry', 'rice']), COUNTED = new Set(['anda_curry']);
export const isShared = ref => { const d = ref?.t === 'dish' && DISH[ref.id]; return !!d && !COUNTED.has(d.id) && (SHARED_KINDS.has(d.kind) || /karahi|handi|biryani|pulao|qorma|nihari|haleem|mandi|machboos|kabsa|sajji|lasagna/.test(d.id)); };
const WORD_N = { do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chay: 6, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, saat: 7, aath: 8 };
/** "hum 4 the", "4 logon ne khaya", "shared with 3", "split between 2", "family of 5", "teen dost" → number of people. */
export function sharedCount(text = '') {
  const t = String(text).toLowerCase(), num = s => +s || WORD_N[s] || null;
  // "with 2 friends" means 3 people at the table.
  const w = t.match(/\b(?:with|ke saath|ke sath)\s+(\d+|\w+)\s+(?:friends|dost|dosto[nm]?|people|log|logon|bande)\b/) || t.match(/\b(\d+|\w+)\s+(?:friends|dost|dosto[nm]?|log|logon)\s+(?:ke saath|ke sath)\b/);
  if (w && num(w[1]) >= 1 && num(w[1]) < 20) return num(w[1]) + 1;
  const pats = [/\bhum\s+(\d+|\w+)\s+(?:the|thay|thi|log|logon|bande|dost)/, /\b(\d+|\w+)\s+(?:logon|log|bandon|bande|dosto[nm]?|dost|people|persons|friends)\b(?:\s+(?:ne|mein|ke saath|ke sath|ka|ki))?/,
    /\bshared?\s+(?:it\s+)?(?:with|between|among)\s+(\d+|\w+)/, /\bsplit\s+(?:between|among|with|in)\s+(\d+|\w+)/, /\bfamily of\s+(\d+|\w+)/, /\bfor\s+(\d+|\w+)\s+people\b/];
  for (const re of pats) { const m = t.match(re); const n = m && num(m[1]); if (n >= 2 && n <= 20) return /with/.test(m[0]) && !/between|among|people|family/.test(m[0]) ? n + 1 : n; }
  return /\b(shared|sharing|family style|family karahi|mil ke|mil kar|milkar)\b/.test(t) ? 2 : 1;
}
/** Divide the shared dishes of parsed meal items by the number of people. */
export function splitShared(items, n) {
  if (!(n > 1)) return items;
  return items.map(it => isShared(it.ref) ? { ...it, opts: { ...it.opts, servings: Math.round((it.opts?.servings || 1) / n * 100) / 100, sharedBy: n, wholeServings: it.opts?.servings || 1 } } : it);
}

/* ---------- Anything else? ---------- */
export const EXTRAS = [
  { id: 'chai', label: '+ Chai', ref: { t: 'dish', id: 'chai' } },
  { id: 'cola', label: '+ Cold drink', ref: { t: 'dish', id: 'cola' } },
  { id: 'raita', label: '+ Raita', ref: { t: 'dish', id: 'raita' } },
  { id: 'roti', label: '+ 1 roti', ref: { t: 'dish', id: 'roti' } },
  { id: 'mithai', label: '+ Mithai', ref: { t: 'dish', id: 'mithai' } },
  { id: 'fries', label: '+ Fries', ref: { t: 'dish', id: 'fries' } },
  { id: 'salad', label: '+ Salad', ref: { t: 'dish', id: 'salad' } },
];
/** The extras worth offering after a meal: not already in it, and fitting the meal (no fries with breakfast). */
export function extrasFor(mealItems = [], meal = 'Lunch') {
  const have = new Set(mealItems.map(e => e.ref?.id));
  const breakfast = meal === 'Breakfast' || meal === 'Sehri';
  return EXTRAS.filter(x => DISH[x.ref.id] && !have.has(x.ref.id) && !(breakfast && ['fries', 'cola', 'raita', 'salad'].includes(x.id)) && !(x.id === 'roti' && !mealItems.some(e => isShared(e.ref) || /roti|naan|paratha/.test(e.ref?.id || ''))))
    .slice(0, 5);
}

/* ---------- Protein left ---------- */
// Desi ways to close a protein gap, smallest first. grams of protein are approximate, for one serving.
export const PROTEIN_IDEAS = [
  { id: 'eggs', label: '2 boiled eggs', ref: { t: 'dish', id: 'boiled_egg' }, opts: { servings: 2 }, protein: 12 },
  { id: 'dahi', label: '1 katori dahi', ref: { t: 'dish', id: 'dahi' }, opts: { servings: 1 }, protein: 7 },
  { id: 'tikka', label: 'Chicken tikka (leg)', ref: { t: 'dish', id: 'chicken_tikka' }, opts: { servings: 1, style: 'restaurant' }, protein: 35 },
  { id: 'shake', label: 'Protein shake', ref: { t: 'dish', id: 'protein_shake' }, opts: { servings: 1 }, protein: 24 },
  { id: 'chana', label: 'Roasted chana (handful)', ref: { t: 'dish', id: 'roasted_chana' }, opts: { servings: 1 }, protein: 6 },
  { id: 'daal', label: '1 katori daal', ref: { t: 'dish', id: 'daal_masoor' }, opts: { servings: 1, style: 'home' }, protein: 10 },
];
/** Show "Protein left" from 2 pm, when 20 g+ is left: 2–3 ideas that fit (a big gap gets the bigger ones). */
export function proteinNudge(left, now = Date.now(), dislikes = []) {
  if (!(left >= 20) || new Date(now).getHours() < 14) return null;
  const ok = PROTEIN_IDEAS.filter(i => DISH[i.ref.id] && !dislikes.includes(i.id));
  const pick = left >= 40 ? ok.filter(i => i.protein >= 10).sort((a, b) => b.protein - a.protein) : ok.filter(i => i.protein <= left + 5).sort((a, b) => b.protein - a.protein);
  return { left: Math.round(left), ideas: pick.slice(0, 3) };
}

/** Fibre target: 14 g per 1,000 kcal (the same rule as the weekly report). */
export const fibreTarget = kcal => Math.round((kcal || 2000) / 1000 * 14);

/* ---------- Weekend vs weekdays ---------- */
/** { weekday, weekend, outShare } kcal averages over fully logged days (weekend = Fri–Sun, the Pakistani/Gulf weekend feel). */
export function weekendSplit(dayTotals) {
  const wk = dayTotals.filter(d => ![5, 6, 0].includes(new Date(d.day + 'T12:00').getDay())), we = dayTotals.filter(d => [5, 6, 0].includes(new Date(d.day + 'T12:00').getDay()));
  if (wk.length < 2 || we.length < 1) return null;
  const avg = a => Math.round(a.reduce((s, d) => s + d.kcal, 0) / a.length / 10) * 10;
  return { weekday: avg(wk), weekend: avg(we) };
}
