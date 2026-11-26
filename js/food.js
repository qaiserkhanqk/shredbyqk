// Food screen.
//  - Snap a meal: it's added straight to today (no review step). A small card shows what was added,
//    with Undo and a tap-to-fix on each dish.
//  - Search: places and menus (KFC Zinger, Butt Karahi, the gol gappay cart), desi dishes, Indian
//    recipes and ingredients. One sheet sets portion, which one exactly (roti, naan, roghni naan…),
//    who cooked it, meat or gravy, and oil.
//  - Add a place: clients add their own dhaba or cart; each item is tied to a dish model.
//  - Water taps, weigh-ins, and QK's weekly report (js/weekly.js).
import * as N from './nutrition.js';
import { recognise, PHOTO_CONFIG } from './foodphoto.js';
import { searchPlaces, allPlaces, itemNutrition, suggestDish } from './menus.js';
import { weekReport, reportText, waterGoal, dayKey } from './weekly.js';
import { parseMeal, looksLikeMeal, bestTranscript } from './foodtext.js';
import { askText } from './foodphoto.js';
import { lookupBarcode, loadSaved, canScan, scanFrom } from './barcode.js';
import { portionFactor, factors, studyCSV, studySummary } from './calibrate.js';
import { canSyncSteps, syncSteps } from './activity.js';
import { searchFatSecret } from './fatsecret.js';
import { t as tr, setLang, getLang, translate } from './food-ur.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = v => Math.round(v), fmt = v => r0(v).toLocaleString('en');
const uid = () => Math.random().toString(36).slice(2, 10);

let ctx; // { S, persist, toast, rehab: () => bool }
let cur = null; // the sheet: { mode: 'food'|'place', ref, opts, name, official, onSave, saveLabel }
let fsCache = { q: '', list: [] }, fsTimer = null;
let mealPending = null, aiExtra = null; // parsed sentence waiting for "Add all"
let snap = null; // the last photo added: { dataUrl, ids, unsure, unknown, setting }

const F = () => {
  const f = (ctx.S.food ||= { log: [], prefs: {}, style: 'home' });
  f.water ||= {}; f.weights ||= []; f.places ||= []; f.products ||= {}; f.steps ||= {};
  return f;
};
const prefFor = ref => (ref.t === 'dish' ? F().prefs[ref.id] : null) || {};
const byId = id => F().log.find(x => x.id === id);

export function initFood(c) {
  ctx = c; F();
  $('#foodSearch').oninput = () => renderResults();
  $('#foodResults').onclick = e => {
    const m = e.target.closest('[data-menu]');
    if (m) { const [pid, i] = m.dataset.menu.split('|'); const place = allPlaces(F().places).find(p => p.id === pid); return openMenuItem(place, place.items[+i]); }
    const b = e.target.closest('[data-ref]'); if (b) return openSheet(JSON.parse(b.dataset.ref));
    if (e.target.closest('#addPlaceBtn')) openPlaceSheet($('#foodSearch').value);
    if (e.target.closest('#mealAskAI')) {
      const q = $('#foodSearch').value, left = parseMeal(q).unknown.join(', ');
      e.target.closest('#mealAskAI').textContent = 'Asking…';
      askText(left).then(found => {
        if (!found.length) { ctx.toast('QK’s AI didn’t recognise that either. Try searching for it.'); return renderResults(); }
        aiExtra = { q, items: found.map(it => ({ ref: { t: 'dish', id: it.dish }, opts: { servings: it.servings, meat: it.meat, oil: it.oil }, name: N.DISH[it.dish].name })) };
        renderResults();
      }).catch(() => { ctx.toast('Couldn’t reach QK’s AI.'); renderResults(); });
      return;
    }
    if (e.target.closest('#mealAddAll') && mealPending) {
      mealPending.forEach(it => addEntry(it.ref, it.opts, 'text', { name: it.name !== N.DISH[it.ref.id]?.name ? it.name : null, official: it.official }));
      mealPending = null; $('#foodSearch').value = ''; renderResults(); renderFood(); ctx.toast('Meal added');
    }
  };
  const snapIt = () => { if (!PHOTO_CONFIG.endpoint) return showNoEndpoint(); $('#foodPhoto').click(); };
  $('#foodPhotoBtn').onclick = snapIt;
  // From Today: switch to Food and open the camera in the same tap (browsers need the tap for the file picker).
  const sm = $('#snapMeal'); if (sm) sm.onclick = () => { $('.tabs [data-tab=food]').click(); snapIt(); };
  $('#foodPhoto').onchange = e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runPhoto(f); };
  $('#foodLog').onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) return removeEntries([del.dataset.del]);
    const ed = e.target.closest('[data-edit]'); if (ed) editEntry(ed.dataset.edit);
  };
  $('#foodPhotoBox').onclick = onSnapClick;
  $('#foodToday').onchange = e => { if (e.target.id === 'stepsToday') { const n = Math.round(+e.target.value); if (n >= 0 && n < 100000) { F().steps[dayKey(Date.now())] = n; ctx.persist(); } } };
  if (canSyncSteps()) syncSteps(F().steps).then(n => { if (n) { ctx.persist(); renderFood(); } }).catch(() => {});
  $('#foodToday').onclick = e => {
    if (e.target.closest('#stepsSync')) { syncSteps(F().steps).then(() => { ctx.persist(); renderFood(); }).catch(() => ctx.toast('Allow Shred to read steps in your health app')); return; }
    const w = e.target.closest('[data-water]');
    if (w) { const k = dayKey(Date.now()), W = F().water; W[k] = Math.max(0, (W[k] || 0) + +w.dataset.water); ctx.persist(); renderFood(); }
  };
  $('#foodWeek').onclick = onWeekClick;
  $('#calInfo').onclick = e => { if (e.target.closest('#calExport')) download('shred-food-accuracy.csv', studyCSV(F().log), 'text/csv'); };
  loadSaved();
  setLang(F().lang); applyLang();
  $('#foodLang').onclick = () => { F().lang = getLang() === 'ur' ? 'en' : 'ur'; setLang(F().lang); ctx.persist(); applyLang(); renderFood(); };
  $('#foodVoice').onclick = startVoice;
  $('#foodScan').onclick = openScanSheet;
  $('#foodSheet').onclick = e => { if (e.target.id === 'foodSheet') closeSheet(); };
  $('#foodSheetBody').onclick = onSheetClick;
  $('#foodSheetBody').oninput = e => {
    if (e.target.id === 'fsGrams') { cur.opts.grams = Math.max(1, +e.target.value || 0); renderSheetResult(); }
    if (e.target.id === 'fsWeighed') { const g = +e.target.value; cur.weighedG = g > 0 ? g : null; if (g > 0) cur.opts.grams = g; else delete cur.opts.grams; renderSheetResult(); }
    if (e.target.id === 'plItem') renderSuggestions();
  };
  const p = ctx.S.profile;
  const pl = $('#tPlate'); pl.value = F().plateCm || ''; pl.onchange = () => { F().plateCm = pl.value; ctx.persist(); };
  for (const [id, key] of [['#tWeight', 'weightKg'], ['#tAge', 'age'], ['#tGoal', 'dietGoal'], ['#tActivity', 'activity']]) {
    const el = $(id); el.value = key === 'dietGoal' ? N.dietGoal(p) : p[key] ?? el.value;
    el.onchange = () => { p[key] = el.value; ctx.persist(); renderFood(); };
  }
}

/* ---------- Today ---------- */
export function renderFood() {
  const p = ctx.S.profile, t = N.targets(p), d = N.dayTotals(F().log);
  const bar = (label, v, goal, unit) => {
    const pct = goal ? Math.min(100, v / goal * 100) : 0;
    return `<div class="mbar"><div class="row"><span>${label}</span><span class="data">${fmt(v)}${goal ? ` / ${fmt(goal)}` : ''} ${unit}</span></div><i><b style="width:${pct}%"></b></i></div>`;
  };
  const left = t ? t.kcal - d.kcal : null;
  const trainedToday = (ctx.S.sessions || []).some(s => dayKey(s.at) === dayKey(Date.now()));
  const glasses = F().water[dayKey(Date.now())] || 0, wGoal = waterGoal(+p.weightKg, trainedToday);
  $('#foodToday').innerHTML = `
    <div class="food-sum">
      <div><span class="eyebrow">${tr('Eaten today')}</span><div class="kbig num">${fmt(d.kcal)}<small> kcal</small></div>
        ${d.items.length ? `<p class="muted small" style="margin:2px 0 0">${tr('Likely')} <span class="data">${fmt(d.low)}–${fmt(d.high)}</span> kcal</p>` : ''}</div>
      ${t ? `<div class="left"><span class="eyebrow">${tr(left >= 0 ? 'Left' : 'Over')}</span><div class="num ${left >= 0 ? '' : 'over'}">${fmt(Math.abs(left))}</div><span class="muted small data">/ ${fmt(t.kcal)}</span></div>` : ''}
    </div>
    ${t ? bar(tr('Calories'), d.kcal, t.kcal, 'kcal') : ''}
    ${bar(tr('Protein'), d.protein, t?.protein, 'g')}
    <div class="grid2">${bar(tr('Carbs'), d.carbs, t?.carbs, 'g')}${bar(tr('Fat'), d.fat, t?.fat, 'g')}</div>
    <div class="water"><div><span class="eyebrow">${tr('Water')}</span><div class="glasses" aria-label="${glasses} of ${wGoal} glasses">${Array.from({ length: Math.max(wGoal, glasses) }, (_, i) => `<i class="${i < glasses ? 'on' : ''}"></i>`).join('')}</div>
      <span class="muted small"><span class="data">${glasses} / ${wGoal}</span> ${tr('glasses')}${trainedToday ? ` (${tr('training day')})` : ''}</span></div>
      <div class="water-btns"><button type="button" class="iconbtn" data-water="-1" aria-label="Remove a glass">−</button><button type="button" class="iconbtn plus" data-water="1" aria-label="Add a glass of water">+</button></div></div>
    <div class="water steps"><div><span class="eyebrow">${tr('Steps today')}</span><span class="muted small">${tr(canSyncSteps() ? 'From your phone’s health app' : 'From your phone’s health app or watch')}</span></div>
      ${canSyncSteps() ? `<div class="water-btns"><b class="num">${fmt(F().steps[dayKey(Date.now())] || 0)}</b><button type="button" class="ghost" id="stepsSync">Sync</button></div>`
        : `<input id="stepsToday" type="number" inputmode="numeric" placeholder="e.g. 6500" value="${F().steps[dayKey(Date.now())] || ''}" aria-label="Steps today">`}</div>
    ${t ? '' : '<p class="muted small" style="margin:0">Add your weight and age under <b>Your targets</b> to see how much to eat.</p>'}`;
  const cal = factors(F().log), sum = studySummary(F().log);
  $('#calInfo').innerHTML = sum ? `<span class="eyebrow">Your portions</span>
    <p class="muted small" style="margin:4px 0 8px">${sum.n} weighed photo meal${sum.n > 1 ? 's' : ''}; photo portions were off by ${sum.medianPortionError}% (median). ${Object.entries(cal).filter(([, v]) => v.factor !== 1).map(([k, v]) => `QK now adjusts your ${k} photos ×${v.factor.toFixed(2)}.`).join(' ') || 'Weigh 3 of a kind and QK starts adjusting.'}</p>
    <button type="button" class="ghost" id="calExport">Export accuracy data (CSV)</button>` : '<p class="muted small" style="margin:0">Got a kitchen scale? Tap a photo meal and enter its weight. After 3 of a kind, QK learns your portion sizes.</p>';
  $('#tSummary').textContent = t ? `${fmt(t.kcal)} kcal · ${t.protein} g protein` : 'Not set';

  const L = d.items.slice().sort((a, b) => a.at - b.at);
  const meals = [...new Set(L.map(e => e.meal))];
  $('#foodLog').innerHTML = L.length ? meals.map(m => {
    const its = L.filter(e => e.meal === m), k = its.reduce((s, e) => s + e.kcal, 0);
    return `<div class="meal-head"><span class="eyebrow">${tr(m)}</span><span class="data small">${fmt(k)} kcal</span></div>` + its.map(e => `
      <div class="row"><button type="button" class="food-hit" data-edit="${e.id}" aria-label="Change ${esc(e.name)}"><div><b>${esc(e.name)}</b><div class="muted small">${e.source === 'photo' ? '<span class="ftag">Photo</span> ' : ''}${esc(e.label)} · P ${r0(e.protein)} · C ${r0(e.carbs)} · F ${r0(e.fat)} g</div></div>
        <span class="r data">${fmt(e.kcal)}</span></button>
        <button type="button" class="linkbtn del" data-del="${e.id}" aria-label="Remove ${esc(e.name)}">✕</button></div>`).join('');
  }).join('') : '<p class="muted small" style="margin:0">Nothing logged yet. Snap your meal, or search a dish or a place.</p>';
  renderWeek();
}

/* ---------- Search: places first, then foods ---------- */
function renderResults() {
  const q = $('#foodSearch').value, box = $('#foodResults');
  box.hidden = !q.trim();
  if (!q.trim()) return;
  // A whole sentence ("do roti aur karahi") becomes one card that logs everything in one tap.
  let mealCard = '';
  if (looksLikeMeal(q)) {
    const m = parseMeal(q);
    if (m.items.length) {
      const extra = aiExtra?.q === q ? aiExtra.items : [];
      if (extra.length) m.unknown = [];
      mealPending = [...m.items, ...extra].map(it => ({ ...it, opts: { ...defaultOpts(it.ref), ...it.opts } }));
      const kc = it => it.official ? it.official.kcal * (it.opts.servings || 1) / (it.official.base || 1) : N.estimate(it.ref, it.opts).kcal;
      const tot = mealPending.reduce((a, it) => a + kc(it), 0);
      mealCard = `<div class="meal-card"><span class="eyebrow">${tr('Log this meal')}</span>
        <div class="list">${mealPending.map(it => `<div class="row"><div><b>${esc(it.name)}</b><div class="muted small">${esc(N.serveLabel(N.DISH[it.ref.id], it.opts.servings))}</div></div><span class="r data">${fmt(kc(it))}</span></div>`).join('')}</div>
        ${m.unknown.length ? `<p class="muted small" style="margin:0">Didn’t catch: ${m.unknown.map(esc).join(', ')}${PHOTO_CONFIG.endpoint ? ` · <button type="button" class="linkbtn" id="mealAskAI">Ask QK’s AI</button>` : ''}</p>` : ''}
        <button type="button" class="cta" id="mealAddAll">${tr('Add all')} · ${fmt(tot)} kcal</button></div>`;
    }
  }
  const prods = Object.values(F().products || {}).filter(p => p.name.toLowerCase().includes(q.toLowerCase().trim())).slice(0, 5);
  const menu = searchPlaces(q, F().places, 8);
  const res = N.search(q, 20);
  const tag = e => e.ref.t === 'dish' ? '<span class="ftag desi">Desi model</span>' : e.ref.t === 'indb' ? `<span class="ftag">Indian recipe${e.fried ? ' · fried' : ''}</span>` : '<span class="ftag">Ingredient</span>';
  const menuRows = menu.map(({ place, item }) => {
    const n = itemNutrition(item);
    return `<button type="button" class="row food-hit" data-menu="${esc(place.id)}|${place.items.indexOf(item)}"><div><b>${esc(item.name)}</b><div class="muted small"><span class="ftag place">${esc(place.name)}</span> ${n.official ? 'official values' : 'QK estimate'}</div></div><span class="r data">${fmt(n.kcal)} kcal</span></button>`;
  }).join('');
  const foodRows = res.map(e => {
    const est = N.estimate(e.ref, defaultOpts(e.ref));
    const unit = e.ref.t === 'dish' ? N.serveLabel(N.DISH[e.ref.id], 1) : e.ref.t === 'indb' ? (N.lookup(e.ref).food[7] || 'serving') : '100 g';
    return `<button type="button" class="row food-hit" data-ref='${JSON.stringify(e.ref)}'><div><b>${esc(e.name)}</b><div class="muted small">${tag(e)} ${esc(unit)}</div></div><span class="r data">${fmt(est.kcal)} kcal</span></button>`;
  }).join('');
  const prodRows = prods.map(p => `<button type="button" class="row food-hit" data-ref='${JSON.stringify({ t: 'bc', id: p.code })}'><div><b>${esc(p.name)}</b><div class="muted small"><span class="ftag">Barcode</span> ${p.servingLabel ? esc(p.servingLabel) : '100 g'}</div></div><span class="r data">${fmt(N.estimate({ t: 'bc', id: p.code }, {}).kcal)} kcal</span></button>`).join('');
  // Thin local results: ask FatSecret live (when the server is set up).
  const fsRows = (fsCache.q === q ? fsCache.list : []).map(p => `<button type="button" class="row food-hit" data-ref='${JSON.stringify({ t: 'bc', id: p.code })}'><div><b>${esc(p.name)}</b><div class="muted small"><span class="ftag">FatSecret</span> ${esc(p.servingLabel || '100 g')}</div></div><span class="r data">${fmt(N.estimate({ t: 'bc', id: p.code }, {}).kcal)} kcal</span></button>`).join('');
  if (PHOTO_CONFIG.searchEndpoint && menu.length + res.filter(e => e.ref.t === 'dish').length < 3 && q.trim().length > 2 && fsCache.q !== q) {
    clearTimeout(fsTimer);
    fsTimer = setTimeout(() => searchFatSecret(PHOTO_CONFIG.searchEndpoint, q.trim()).then(list => { fsCache = { q, list }; if ($('#foodSearch').value === q) renderResults(); }).catch(() => {}), 450);
  }
  box.innerHTML = mealCard + `${menuRows || foodRows || prodRows || fsRows ? `<div class="list">${prodRows}${menuRows}${foodRows}${fsRows}</div>` : `<p class="muted small" style="margin:0">No match for “${esc(q)}”. Try the Urdu or Hindi name, or the main ingredient.</p>`}
    <button type="button" class="ghost full add-place" id="addPlaceBtn">+ Add a place or menu item</button>`;
}

/* ---------- Sheet ---------- */
function defaultOpts(ref) {
  if (ref.t === 'ing') return { grams: 100 };
  if (ref.t === 'indb') return { servings: 1 };
  if (ref.t === 'bc') { const p = N.lookup(ref)?.food; return p?.servingG ? { servings: 1 } : { grams: 100 }; }
  const pr = prefFor(ref);
  return { servings: 1, style: pr.style || F().style || 'home', styleKnown: !!pr.style, meat: pr.meat || 'normal', oil: 'normal', size: pr.size || 'm', topping: !!pr.topping };
}

function openSheet(ref, opts, onSave, saveLabel, extra = {}) {
  const hit = N.lookup(ref);
  if (!hit) return;
  cur = { mode: 'food', ref, hit, opts: { ...defaultOpts(ref), ...(opts || {}) }, onSave, saveLabel, ...extra };
  renderSheet();
  $('#foodSheet').hidden = false;
}
function openMenuItem(place, item) {
  openSheet({ t: 'dish', id: item.dish }, { ...item.opts, menuBase: item.opts.servings || 1 }, null, null, { name: `${place.name} · ${item.name}`, official: item.official && { ...item.official, base: item.opts.servings || 1 }, place: place.name });
}
function closeSheet() { scanStop?.(); $('#foodSheet').hidden = true; cur = null; }

const seg = (key, items, val) => `<div class="seg fseg" data-key="${key}" role="group">${items.map(i => `<button type="button" data-v="${i.id}" class="${i.id === val ? 'on' : ''}" aria-pressed="${i.id === val}">${esc(tr(i.label))}</button>`).join('')}</div>`;

function renderSheet() {
  const { ref, hit, opts } = cur, d = ref.t === 'dish' ? hit.food : null;
  const title = cur.name || hit.name;
  const eyebrow = cur.official ? `${esc(cur.place || '')} · official values (${esc(cur.official.source)})` : cur.place ? `${esc(cur.place)} · QK estimate from the recipe` : ref.t === 'dish' ? 'Desi model · computed from ingredients' : ref.t === 'indb' ? 'Indian Nutrient Databank' : ref.t === 'bc' ? (hit.food.source === 'FatSecret' ? 'FatSecret (live search)' : 'Packaged food · label values (Open Food Facts)') : 'Ingredient (USDA)';
  let html = `<div class="grab"></div><div><span class="eyebrow">${eyebrow}</span><h2 class="display h2" style="margin-top:6px">${esc(title)}</h2></div>`;
  // "Roti" can mean a naan or a roghni naan: one tap to say which one.
  const fam = N.family(d);
  if (fam.length > 1 && !cur.official) html += `<div class="fq"><span class="eyebrow">${tr('Which one?')}</span><div class="chips-scroll fam" role="group" aria-label="Which ${esc(d.fam)}">${fam.map(x => `<button type="button" class="mchip ${x.id === d.id ? 'on' : ''}" data-fam="${x.id}" aria-pressed="${x.id === d.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
  if (ref.t === 'ing' || (ref.t === 'bc' && !hit.food.servingG)) html += `<label class="field">How much (grams)<input id="fsGrams" type="number" inputmode="decimal" value="${opts.grams}"></label>`;
  else html += `<div class="stepper"><button type="button" data-step="-0.5" aria-label="Less">−</button><div><b class="num" id="fsServe"></b></div><button type="button" data-step="0.5" aria-label="More">+</button></div>`;
  if (d && !cur.official) {
    if (d.sizes) html += `<div class="fq"><span class="eyebrow">${tr('Size')}</span>${seg('size', N.SIZES, opts.size)}</div>`;
    if (N.hasFatChoice(d) && !cur.place) html += `<div class="fq"><span class="eyebrow">${tr('Who cooked it?')}</span>${seg('style', N.STYLES, opts.style)}
      <p class="muted small fq-why">${['fried', 'fastfood', 'street'].includes(d.kind) ? 'Shops and stalls fry hotter and longer in older oil, so more soaks in.' : 'The camera can’t see how much oil went in. This is the biggest difference between plates.'}</p></div>`;
    if (N.hasMeatChoice(d)) html += `<div class="fq"><span class="eyebrow">${tr(d.kind === 'rice' ? 'Meat or rice?' : 'Meat or gravy?')}</span>${seg('meat', N.MEAT_SHARE.map(m => ({ ...m, label: d.kind === 'rice' && m.id === 'less' ? 'Mostly rice' : m.label })), opts.meat)}</div>`;
    if (N.hasOilChoice(d)) html += `<div class="fq"><span class="eyebrow">${tr('Oil you can see')}</span>${seg('oil', N.OIL_LEVEL, opts.oil)}</div>`;
    if (d.topping) html += `<label class="check"><input type="checkbox" id="fsTop" ${opts.topping ? 'checked' : ''}> ${esc(d.topping[2])}</label>`;
  }
  if (cur.weigh) html += `<label class="field">Weighed it? Plate contents in grams (optional)<input id="fsWeighed" type="number" inputmode="decimal" placeholder="e.g. 260" value="${cur.weighedG || ''}"></label>
    <p class="muted small fq-why" style="margin-top:-6px">Weigh a few photo meals and QK learns your portion sizes, so every photo after that is closer.</p>`;
  html += `<div id="fsResult"></div><button type="button" class="cta" id="fsSave">${esc(tr(cur.saveLabel || 'Add to ' + N.mealOf().toLowerCase()))}</button>`;
  $('#foodSheetBody').innerHTML = html;
  const top = $('#fsTop'); if (top) top.onchange = () => { cur.opts.topping = top.checked; renderSheetResult(); };
  const on = $('#foodSheetBody .fam .on'); if (on) on.parentElement.scrollLeft = on.offsetLeft - 16;
  renderSheetResult();
}

function sheetEstimate() {
  const { ref, opts, official } = cur;
  if (!official) return N.estimate(ref, opts);
  const n = itemNutrition({ official }), k = (opts.servings || 1) / (official.base || 1);
  return { ...n, kcal: n.kcal * k, protein: n.protein * k, carbs: n.carbs * k, fat: n.fat * k, fibre: n.fibre * k, low: n.low * k, high: n.high * k, parts: { fat: n.parts.fat * k, meat: 0, rest: n.parts.rest * k } };
}

function renderSheetResult() {
  const { ref, hit, opts } = cur, e = sheetEstimate(), d = ref.t === 'dish' ? hit.food : null;
  const serve = $('#fsServe');
  if (serve) serve.textContent = opts.menuBase ? `${N.fmtN(opts.servings / opts.menuBase)} × ${cur.name?.split(' · ')[1] || hit.name}` : d ? N.serveLabel(d, opts.servings) : ref.t === 'bc' ? `${N.fmtN(opts.servings)} × ${hit.food.servingLabel || hit.food.servingG + ' g'}${hit.food.source === 'FatSecret' ? '' : ` (${r0(e.grams)} g)`}` : `${N.fmtN(opts.servings)} × ${hit.food[7] || 'serving'} (≈${r0(e.grams)} g)`;
  const tot = Math.max(1, e.kcal), pf = e.parts.fat / tot * 100, pm = e.parts.meat / tot * 100;
  $('#fsResult').innerHTML = `
    <div class="fs-kcal"><div class="kbig num">${fmt(e.kcal)}<small> kcal</small></div><span class="muted small">${tr('likely')} ${fmt(e.low)}–${fmt(e.high)}</span></div>
    <div class="macros"><div><b class="num">${r0(e.protein)}</b><span>protein g</span></div><div><b class="num">${r0(e.carbs)}</b><span>carbs g</span></div><div><b class="num">${r0(e.fat)}</b><span>fat g</span></div><div><b class="num">${r0(e.fibre)}</b><span>fibre g</span></div></div>
    <div class="split" aria-label="Where the calories come from"><i class="sf" style="width:${pf}%"></i><i class="sm" style="width:${pm}%"></i><i class="sr" style="width:${Math.max(0, 100 - pf - pm)}%"></i></div>
    <p class="muted small" style="margin:0">${d && e.fatGrams > 0 ? `${e.fatLabel}: ${r0(e.fatGrams)} g, ${r0(pf)}% of the calories. ` : `Fat gives ${r0(pf)}% of the calories. `}${pm > 0 ? `Meat or protein: ${r0(pm)}%.` : ''}</p>
    ${cur.official ? `<p class="muted small" style="margin:0">Published by the chain for ${esc(cur.official.source)}. No chain publishes Pakistan values yet, and portions here can differ, so the range is ±10%.</p>` : ''}
    ${e.fried ? '<p class="warn-note small">This recipe counts all the frying oil as eaten, so it reads too high. For samosas, pakoray and puris use the Desi model instead.</p>' : ''}`;
}

function onSheetClick(e) {
  if (cur?.mode === 'place') return onPlaceClick(e);
  if (cur?.mode === 'scan') return;
  const st = e.target.closest('[data-step]');
  if (st) { const b = cur.opts.menuBase || 1; cur.opts.servings = Math.max(0.5 * b, Math.min(20 * b, (cur.opts.servings || 1) + +st.dataset.step * b)); return renderSheetResult(); }
  const f = e.target.closest('[data-fam]');
  if (f) { // switch to another member of the family, keeping the portion
    const ref = { t: 'dish', id: f.dataset.fam }, keep = { servings: cur.opts.servings };
    cur = { ...cur, ref, hit: N.lookup(ref), opts: { ...defaultOpts(ref), ...keep, portionSd: cur.opts.portionSd }, name: null, official: null, place: null, weigh: false, weighedG: null };
    return renderSheet();
  }
  const b = e.target.closest('.fseg [data-v]');
  if (b) {
    const key = b.closest('.fseg').dataset.key; cur.opts[key] = b.dataset.v;
    if (key === 'style') cur.opts.styleKnown = true;
    b.closest('.fseg').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    return renderSheetResult();
  }
  if (e.target.closest('#fsSave')) {
    const { ref, opts } = cur;
    if (ref.t === 'dish' && !cur.place) { // remember how this person's food is usually cooked
      const pr = F().prefs[ref.id] ||= {};
      if (opts.styleKnown) { pr.style = opts.style; F().style = opts.style; }
      if (opts.meat !== 'normal') pr.meat = opts.meat;
      if (N.DISH[ref.id].sizes) pr.size = opts.size;
      if (N.DISH[ref.id].topping) pr.topping = opts.topping;
    }
    const save = cur.onSave, extra = { name: cur.name, official: cur.official, weighedG: cur.weighedG };
    if (save) save({ ...opts }, ref, extra); else { addEntry(ref, opts, cur.place ? 'place' : 'search', extra); ctx.toast('Added'); $('#foodSearch').value = ''; renderResults(); }
    ctx.persist(); closeSheet(); renderFood();
  }
}

function entryFrom(ref, opts, extra = {}) {
  const hit = N.lookup(ref);
  let e = N.estimate(ref, opts);
  if (extra.official) { const n = itemNutrition({ official: extra.official }), k = (opts.servings || 1) / (extra.official.base || 1); e = { kcal: n.kcal * k, protein: n.protein * k, carbs: n.carbs * k, fat: n.fat * k, low: n.low * k, high: n.high * k }; }
  const label = opts.menuBase ? `${N.fmtN((opts.servings || 1) / opts.menuBase)} ×` : ref.t === 'dish' ? N.serveLabel(hit.food, (opts.servings || 1)) + (opts.style && N.hasFatChoice(hit.food) && !extra.name ? ` · ${N.STYLES.find(s => s.id === opts.style).label.toLowerCase()}` : '')
    : ref.t === 'indb' ? `${N.fmtN(opts.servings || 1)} × ${hit.food[7] || 'serving'}` : ref.t === 'bc' && !opts.grams ? `${N.fmtN(opts.servings || 1)} × ${hit.food.servingLabel || hit.food.servingG + ' g'}` : `${r0(opts.grams)} g`;
  return { ref, opts: { ...opts }, name: extra.name || hit.name, official: extra.official || undefined, label, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, low: e.low, high: e.high };
}
function addEntry(ref, opts, source, extra = {}) {
  const e = { id: uid(), at: Date.now(), meal: N.mealOf(), source, ...entryFrom(ref, opts, extra), ...(extra.photo ? { photo: extra.photo } : {}) };
  F().log.push(e);
  if (F().log.length > 3000) F().log.splice(0, F().log.length - 3000);
  ctx.persist();
  return e;
}
function editEntry(id) {
  const it = byId(id); if (!it) return;
  const custom = it.name !== N.lookup(it.ref)?.name ? it.name : null; // a place item keeps its own name
  const weigh = it.source === 'photo' && it.ref.t === 'dish';
  openSheet(it.ref, it.opts, (o, ref, extra) => {
    if (ref.id !== it.ref.id) { delete it.photoG; delete it.weighedG; } // a different dish: the photo estimate no longer applies
    Object.assign(it, entryFrom(ref, o, extra), { id: it.id, at: it.at, meal: it.meal });
    if (weigh && ref.id === it.ref.id) { if (extra.weighedG) it.weighedG = extra.weighedG; else delete it.weighedG; }
    ctx.persist(); renderFood(); renderSnap();
  }, 'Save', { name: custom, official: it.official, weigh, weighedG: it.weighedG });
}
function removeEntries(ids, quiet = false) {
  const L = F().log;
  for (const id of ids) { const i = L.findIndex(x => x.id === id); if (i >= 0) L.splice(i, 1); }
  ctx.persist(); if (quiet) return; renderFood(); renderSnap();
}

/* ---------- Add a place ---------- */
function openPlaceSheet(q = '') {
  cur = { mode: 'place', dish: null };
  const places = F().places.map(p => `<option value="${esc(p.name)}">`).join('');
  $('#foodSheetBody').innerHTML = `<div class="grab"></div><div><span class="eyebrow">Add a place</span><h2 class="display h2" style="margin-top:6px">Where did you eat?</h2></div>
    <label class="field">Place<input id="plName" list="plList" placeholder="e.g. Ali's dhaba, the cart outside the gym" value=""><datalist id="plList">${places}</datalist></label>
    <label class="field">What you had<input id="plItem" placeholder="e.g. Chicken cheese burger" value="${esc(q)}"></label>
    <div class="fq"><span class="eyebrow">Closest to</span><div class="chips-scroll" id="plSuggest" role="group"></div>
      <p class="muted small fq-why">QK builds the calories from the closest dish, so they stay realistic. You can set the portion next.</p></div>
    <button type="button" class="cta" id="plNext" disabled>Next: portion</button>`;
  $('#foodSheet').hidden = false;
  renderSuggestions();
}
function renderSuggestions() {
  const name = $('#plItem')?.value || '', box = $('#plSuggest'); if (!box) return;
  const list = suggestDish(name, 6);
  if (cur.dish && !list.some(d => d.id === cur.dish)) cur.dish = null;
  box.innerHTML = list.length ? list.map(d => `<button type="button" class="mchip ${d.id === cur.dish ? 'on' : ''}" data-pick="${d.id}">${esc(d.name)}</button>`).join('') : '<span class="muted small">Type what you had to see matches.</span>';
  $('#plNext').disabled = !cur.dish;
}
function onPlaceClick(e) {
  const pk = e.target.closest('[data-pick]');
  if (pk) { cur.dish = pk.dataset.pick; return renderSuggestions(); }
  if (e.target.closest('#plNext')) {
    const placeName = ($('#plName').value || '').trim() || 'My place', itemName = ($('#plItem').value || '').trim() || N.DISH[cur.dish].name, dish = cur.dish;
    const ref = { t: 'dish', id: dish };
    openSheet(ref, { style: 'restaurant', styleKnown: true }, (o, r2) => {
      // Save the place and the item, so next time it's one tap from search.
      let place = F().places.find(p => p.name.toLowerCase() === placeName.toLowerCase());
      if (!place) F().places.push(place = { id: 'u-' + uid(), name: placeName, items: [] });
      const item = { name: itemName, dish: r2.id, opts: { ...o, styleKnown: true } };
      const i = place.items.findIndex(x => x.name.toLowerCase() === itemName.toLowerCase());
      if (i >= 0) place.items[i] = item; else place.items.push(item);
      addEntry(r2, o, 'place', { name: `${placeName} · ${itemName}` });
      ctx.toast(`Saved ${placeName}. Next time just search it.`);
      $('#foodSearch').value = ''; renderResults();
    }, `Add and save ${placeName}`, { name: `${placeName} · ${itemName}` });
  }
}

/* ---------- One-tap photo ---------- */
/** The dishes this person logs most, so the model leans their way when a photo is ambiguous. */
function usualDishes() {
  const n = {};
  for (const e of F().log.slice(-300)) if (e.ref?.t === 'dish' && N.DISH[e.ref.id]) n[e.ref.id] = (n[e.ref.id] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id]) => N.DISH[id].name);
}
async function runPhoto(file, hint = null) {
  const box = $('#foodPhotoBox');
  // Words typed or said before snapping ("restaurant karahi, 2 naan") go with the photo as a hint.
  if (hint === null) { hint = $('#foodSearch').value.trim(); if (hint) { $('#foodSearch').value = ''; renderResults(); } }
  box.hidden = false; box.innerHTML = '<div class="card snap-card"><b>Adding your meal…</b><p class="muted small" style="margin:6px 0 0">QK is naming each dish and counting portions.</p></div>';
  try {
    const r = await recognise(file, { hint, plateCm: +F().plateCm || null, usual: usualDishes() });
    if (snap?.file === file) removeEntries(snap.ids, true); // re-reading the same photo with a note replaces the first try
    const guess = r.setting === 'restaurant' ? 'restaurant' : r.setting === 'home' ? 'home' : null;
    const photoId = uid();
    const ids = r.items.filter(i => i.dish).map(i => {
      const ref = { t: 'dish', id: i.dish }, pr = prefFor(ref);
      const style = pr.style || guess || F().style || 'home';
      // Learned from this person's weighings: e.g. the camera reads their katori 20% small.
      const k = portionFactor(F().log, N.DISH[i.dish].kind), servings = Math.max(0.5, Math.round(i.servings * k * 2) / 2);
      const opts = { ...defaultOpts(ref), servings, meat: i.meat, oil: i.oil, style, styleKnown: !!pr.style, portionSd: k === 1 ? 0.3 : 0.2 };
      const e = addEntry(ref, opts, 'photo', { photo: photoId });
      e.photoServings = i.servings; e.photoG = N.estimate(ref, { ...opts, servings: i.servings }).grams; // the raw photo estimate, for calibration
      if (i.alternative && N.DISH[i.alternative]) e.alt = i.alternative;
      return e.id;
    });
    ctx.persist();
    snap = { file, hint, dataUrl: r.dataUrl, ids, quality: r.quality, unsure: r.agreement < 0.75 || r.items.some(i => i.confidence < 0.6), unknown: r.items.filter(i => !i.dish).map(i => i.otherName) };
    renderFood(); renderSnap();
    box.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    box.innerHTML = `<div class="card"><b>Couldn’t read the photo</b><p class="muted small" style="margin:6px 0 0">${esc(err.message === 'no-endpoint' ? 'Photo recognition isn’t switched on yet.' : 'Check your connection and try again, or search for the dish.')}</p></div>`;
  }
}
function renderSnap() {
  const box = $('#foodPhotoBox');
  if (!snap) return;
  const items = snap.ids.map(byId).filter(Boolean);
  if (!items.length && !snap.unknown.length) { snap = null; box.hidden = true; box.innerHTML = ''; return; }
  const total = items.reduce((s, e) => s + e.kcal, 0);
  // Ask once how this person usually eats, the one thing a photo can't see, then never again.
  const ask = !F().styleAsked && items.some(e => N.DISH[e.ref.id] && N.hasFatChoice(N.DISH[e.ref.id]) && !e.opts.styleKnown);
  box.hidden = false;
  box.innerHTML = `<div class="card stack snap-card">
    <div class="photo-head"><img src="${snap.dataUrl}" alt="Your meal"><div><span class="eyebrow">${snap.unsure ? 'Added · please check' : 'Added to ' + esc(items[0]?.meal?.toLowerCase() || 'today')}</span><div class="kbig num">${fmt(total)}<small> kcal</small></div>
      <span class="muted small">Tap a dish if QK got it wrong.</span></div></div>
    <div class="list">${items.map(e => `<div class="row"><button type="button" class="food-hit" data-sedit="${e.id}"><div><b>${esc(e.name)}</b><div class="muted small">${esc(e.label)}${N.hasFatChoice(N.DISH[e.ref.id]) && !e.opts.styleKnown ? ' (guess)' : ''}</div></div><span class="r data">${fmt(e.kcal)}</span></button>
      <button type="button" class="linkbtn del" data-sdel="${e.id}" aria-label="Remove ${esc(e.name)}">✕</button></div>
      ${e.alt && N.DISH[e.alt] ? `<button type="button" class="alt-chip" data-salt="${e.id}">or ${esc(N.DISH[e.alt].name)}?</button>` : ''}`).join('')}</div>
    ${snap.quality?.dark || snap.quality?.blurry ? `<p class="warn-note small">The photo looks ${snap.quality.dark ? 'dark' : 'blurry'}, so these are rougher guesses. A clear photo from above, in good light, works best.</p>` : ''}
    <div class="snap-note"><input id="snapHint" placeholder="Add a note: restaurant karahi, 2 naan…" value="${esc(snap.hint || '')}" aria-label="Add a note about this meal"><button type="button" class="ghost" id="snapReread">Re-read</button></div>
    ${snap.unknown.length ? `<p class="muted small" style="margin:0">Also saw ${snap.unknown.map(esc).join(', ')}. Search to add ${snap.unknown.length > 1 ? 'these' : 'it'}.</p>` : ''}
    ${ask ? `<div class="fq"><span class="eyebrow">${tr('Who usually cooks your food?')}</span><div class="seg fseg" role="group"><button type="button" data-usual="home">${tr('Mostly home')}</button><button type="button" data-usual="mixed">${tr('Both')}</button><button type="button" data-usual="out">${tr('Mostly out')}</button></div>
      <p class="muted small fq-why">Asked once, so QK can guess the oil right from now on.</p></div>` : ''}
    <div class="btn-row"><button type="button" class="ghost" id="snapUndo">${tr('Undo')}</button><button type="button" class="ghost" id="snapDone">${tr('Done')}</button></div></div>`;
}
function onSnapClick(e) {
  if (!snap) return;
  const ed = e.target.closest('[data-sedit]'); if (ed) return editEntry(ed.dataset.sedit);
  const alt = e.target.closest('[data-salt]');
  if (alt) { // one tap: "naan" → "roghni naan", same portion; the old guess becomes the new alternative
    const it = byId(alt.dataset.salt), was = it.ref.id, ref = { t: 'dish', id: it.alt };
    Object.assign(it, entryFrom(ref, { ...defaultOpts(ref), servings: it.opts.servings, meat: it.opts.meat, oil: it.opts.oil, style: it.opts.style, styleKnown: it.opts.styleKnown, portionSd: it.opts.portionSd }), { id: it.id, at: it.at, meal: it.meal });
    it.alt = was; delete it.photoG; ctx.persist(); renderFood(); return renderSnap();
  }
  if (e.target.closest('#snapReread')) { const h = $('#snapHint').value.trim(); if (h && snap.file) runPhoto(snap.file, h); return; }
  const del = e.target.closest('[data-sdel]'); if (del) return removeEntries([del.dataset.sdel]);
  const u = e.target.closest('[data-usual]');
  if (u) {
    F().styleAsked = true;
    const v = u.dataset.usual; if (v !== 'mixed') F().style = v === 'out' ? 'restaurant' : 'home';
    for (const it of snap.ids.map(byId).filter(Boolean)) {
      if (it.opts.styleKnown || !N.DISH[it.ref.id]) continue;
      if (v !== 'mixed') it.opts.style = F().style;
      Object.assign(it, entryFrom(it.ref, it.opts, { name: it.name }), { id: it.id, at: it.at, meal: it.meal });
    }
    ctx.persist(); renderFood(); return renderSnap();
  }
  if (e.target.closest('#snapUndo')) { const ids = snap.ids; snap = null; $('#foodPhotoBox').hidden = true; removeEntries(ids); ctx.toast('Removed'); return; }
  if (e.target.closest('#snapDone')) { snap = null; $('#foodPhotoBox').hidden = true; $('#foodPhotoBox').innerHTML = ''; }
}
function showNoEndpoint() {
  const box = $('#foodPhotoBox'); box.hidden = false;
  box.innerHTML = `<div class="card"><b>Photo recognition needs its server</b><p class="muted small" style="margin:6px 0 0">Run <code>tools/food-vision-server.mjs</code> with your AI key and set <code>PHOTO_CONFIG.endpoint</code> in <code>js/foodphoto.js</code>. Until then, search for the dish; it takes two taps.</p></div>`;
}

/* ---------- Weekly report ---------- */
function report() {
  const S = ctx.S, f = F();
  const weights = [...f.weights, ...(S.scans || []).filter(s => s.weight).map(s => ({ at: s.at, kg: +s.weight }))];
  return weekReport({ log: f.log, water: f.water, steps: f.steps, weights, sessions: S.sessions || [], profile: S.profile, rehab: !!ctx.rehab?.() });
}
function renderWeek() {
  const r = report(), el = $('#foodWeek');
  const lastW = F().weights.slice(-1)[0];
  const weigh = `<div class="weigh"><label class="field">Weigh-in (kg)<input id="wkKg" type="number" inputmode="decimal" step="0.1" placeholder="${lastW ? lastW.kg : 'e.g. 72.5'}"></label><button type="button" class="ghost" id="wkSave">Save</button></div>
    <p class="muted small" style="margin:0">${lastW ? `Last: ${lastW.kg} kg on ${new Date(lastW.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. ` : ''}Weigh in on the same morning each week, before breakfast.</p>`;
  if (!r.enough) { el.innerHTML = `<div class="card-head"><div><span class="eyebrow">Your week</span><h2 class="display h2">QK's food report</h2></div></div><p class="muted small" style="margin:0 0 12px">${esc(r.line)}</p>${weigh}`; return; }
  const A = r.avg;
  el.innerHTML = `<div class="card-head"><div><span class="eyebrow">Your week · ${r.logged} days logged</span><h2 class="display h2">${tr("QK's food report")}</h2></div></div>
    <div class="wk-stats"><div><b class="num">${fmt(A.kcal)}</b><span>kcal / day</span></div><div><b class="num">${fmt(A.protein)}</b><span>protein g</span></div><div><b class="num">${fmt(A.vegFruit)}</b><span>veg + fruit g</span></div><div><b class="num">${r.water.avg === null ? '–' : fmt(r.water.avg)}</b><span>glasses</span></div></div>
    <div class="wk-block"><span class="eyebrow">${tr('Went well')}</span><ul class="wins">${r.wins.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>
    ${r.focus.length ? `<div class="wk-block"><span class="eyebrow">${tr('For next week')}</span>${r.focus.map(f => `<div class="focus"><b>${esc(f.title)}</b><p>${esc(f.why)}</p><p class="tip">${esc(f.tip)}</p>${f.nutrients ? `<div class="nut">${f.nutrients.map(n => `<span class="ftag">${esc(n)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>` : ''}
    ${r.notes.length ? `<div class="wk-block"><span class="eyebrow">${tr('Worth knowing')}</span>${r.notes.map(n => `<p class="muted small" style="margin:4px 0 0">${esc(n)}</p>`).join('')}</div>` : ''}
    <p class="qk-line"><span class="eyebrow">QK</span> ${esc(r.line)}</p>
    <button type="button" class="ghost full" id="wkShare">${tr('Send my week to QK')}</button>
    ${weigh}`;
}
async function onWeekClick(e) {
  if (e.target.closest('#wkSave')) {
    const kg = +$('#wkKg').value;
    if (!(kg > 25 && kg < 350)) return ctx.toast('Enter your weight in kg');
    F().weights.push({ at: Date.now(), kg }); ctx.S.profile.weightKg = kg; $('#tWeight').value = kg;
    ctx.persist(); ctx.toast('Weight saved'); renderFood();
  }
  if (e.target.closest('#wkShare')) {
    const text = reportText(report(), ctx.S.profile.name);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (err) { if (err?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); ctx.toast('Copied. Paste it into WhatsApp or a message to QK.'); } catch { ctx.toast('Couldn’t copy on this browser'); }
  }
}

/* ---------- Say it ---------- */
let rec = null;
function startVoice() {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const input = $('#foodSearch');
  if (!SR) { input.focus(); input.placeholder = 'Type it: do roti aur chicken karahi'; ctx.toast('Type what you ate, e.g. “do roti aur karahi”'); return; }
  if (rec) { rec.abort(); rec = null; }
  // Urdu screen → Urdu speech; otherwise Indian English, which hears desi dish names and Roman Urdu best.
  const lang = F().voiceLang || (getLang() === 'ur' ? 'ur-PK' : 'en-IN');
  rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 3;
  const btn = $('#foodVoice'), label = btn.querySelector('span');
  btn.classList.add('listening'); label.textContent = tr('Listening… tap to stop');
  rec.onresult = e => {
    // Each piece of speech comes with a few guesses: keep the one that names the most foods.
    input.value = [...e.results].map(r => r.isFinal ? bestTranscript([...r].map(a => a.transcript)) : r[0].transcript).join(' ');
    renderResults();
  };
  rec.onend = () => { btn.classList.remove('listening'); label.textContent = tr('Say what you ate'); rec = null; renderResults(); };
  rec.onerror = () => ctx.toast('Couldn’t hear that. Try again, or type it.');
  btn.onclick = () => { if (rec) { rec.stop(); } else startVoice(); };
  rec.start();
}

/* ---------- Scan a barcode ---------- */
let scanStop = null;
function openScanSheet() {
  cur = { mode: 'scan' };
  $('#foodSheetBody').innerHTML = `<div class="grab"></div><div><span class="eyebrow">Packaged food</span><h2 class="display h2" style="margin-top:6px">Scan the barcode</h2></div>
    ${canScan() ? '<div class="scan-view"><video id="scanVideo" playsinline muted></video><i></i></div>' : ''}
    <div class="weigh"><label class="field">Or type the number under the bars<input id="scanCode" inputmode="numeric" placeholder="e.g. 8964000123456"></label><button type="button" class="ghost" id="scanLook">Look up</button></div>
    <p class="muted small" id="scanMsg" style="margin:0">${canScan() ? 'Point the camera at the barcode.' : 'This browser can’t scan with the camera, so type the number instead.'}</p>`;
  $('#foodSheet').hidden = false;
  $('#scanLook').onclick = () => findProduct($('#scanCode').value);
  if (canScan()) startCamera();
}
async function startCamera() {
  const video = $('#scanVideo'), ac = new AbortController();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream; await video.play();
    scanStop = () => { ac.abort(); stream.getTracks().forEach(t => t.stop()); scanStop = null; };
    const code = await scanFrom(video, { signal: ac.signal });
    if (code) { scanStop?.(); $('#scanCode').value = code; findProduct(code); }
  } catch { const m = $('#scanMsg'); if (m) m.textContent = 'Camera unavailable. Type the number instead.'; }
}
async function findProduct(code) {
  const msg = $('#scanMsg'); msg.textContent = 'Looking it up…';
  try {
    const p = await lookupBarcode(code);
    if (!p) { msg.textContent = 'Not in the open database yet. Search the food by name instead.'; return; }
    (F().products ||= {})[p.code] = p; ctx.persist(); scanStop?.();
    openSheet({ t: 'bc', id: p.code });
  } catch (e) { msg.textContent = e.message === 'short' ? 'That number looks too short.' : 'Couldn’t reach the product database. Check your connection.'; }
}

function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Urdu ---------- */
function applyLang() {
  const ur = getLang() === 'ur';
  for (const el of [$('#food'), $('#foodSheet')]) { el.dir = ur ? 'rtl' : 'ltr'; el.classList.toggle('ur', ur); }
  $('#foodLang').textContent = ur ? 'English' : 'اردو';
  translate($('#food'));
}
