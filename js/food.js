// Food screen: search or snap a plate → adjust in one sheet → today's log against your targets.
import * as N from './nutrition.js';
import { recognise, PHOTO_CONFIG } from './foodphoto.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r0 = v => Math.round(v), fmt = v => r0(v).toLocaleString('en');

let ctx; // { S, persist, toast }
let cur = null; // the food open in the sheet: { ref, opts, onSave }
let photo = null; // { dataUrl, items: [{ ref, name, opts }], agreement, cached }

const F = () => (ctx.S.food ||= { log: [], prefs: {}, style: 'home' });
const prefFor = ref => (ref.t === 'dish' ? F().prefs[ref.id] : null) || {};

export function initFood(c) {
  ctx = c; F();
  $('#foodSearch').oninput = () => renderResults();
  $('#foodResults').onclick = e => { const b = e.target.closest('[data-ref]'); if (b) openSheet(JSON.parse(b.dataset.ref)); };
  $('#foodPhotoBtn').onclick = () => {
    if (!PHOTO_CONFIG.endpoint) return showNoEndpoint();
    $('#foodPhoto').click();
  };
  $('#foodPhoto').onchange = e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runPhoto(f); };
  $('#foodLog').onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) { const L = F().log; const i = L.findIndex(x => x.id === del.dataset.del); if (i >= 0) { L.splice(i, 1); ctx.persist(); renderFood(); } return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { const it = F().log.find(x => x.id === ed.dataset.edit); if (it) openSheet(it.ref, it.opts, o => { Object.assign(it, entryFrom(it.ref, o), { id: it.id, at: it.at, meal: it.meal }); ctx.persist(); renderFood(); }); }
  };
  $('#foodPhotoBox').onclick = e => {
    const ed = e.target.closest('[data-pedit]');
    if (ed) { const it = photo.items[+ed.dataset.pedit]; return openSheet(it.ref, it.opts, o => { it.opts = o; renderPhoto(); }, 'Save'); }
    const rm = e.target.closest('[data-prm]');
    if (rm) { photo.items.splice(+rm.dataset.prm, 1); return renderPhoto(); }
    if (e.target.closest('#photoAddAll')) {
      photo.items.forEach(it => addEntry(it.ref, it.opts, 'photo'));
      photo = null; renderPhoto(); renderFood(); ctx.toast('Added to today');
    }
    if (e.target.closest('#photoCancel')) { photo = null; renderPhoto(); }
  };
  $('#foodSheet').onclick = e => { if (e.target.id === 'foodSheet') closeSheet(); };
  $('#foodSheetBody').onclick = onSheetClick;
  $('#foodSheetBody').oninput = e => {
    if (e.target.id === 'fsGrams') { cur.opts.grams = Math.max(1, +e.target.value || 0); renderSheetResult(); }
  };
  const p = ctx.S.profile;
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
  $('#foodToday').innerHTML = `
    <div class="food-sum">
      <div><span class="eyebrow">Eaten today</span><div class="kbig num">${fmt(d.kcal)}<small> kcal</small></div>
        ${d.items.length ? `<p class="muted small" style="margin:2px 0 0">Likely ${fmt(d.low)}–${fmt(d.high)} kcal</p>` : ''}</div>
      ${t ? `<div class="left"><span class="eyebrow">${left >= 0 ? 'Left' : 'Over'}</span><div class="num ${left >= 0 ? '' : 'over'}">${fmt(Math.abs(left))}</div><span class="muted small">of ${fmt(t.kcal)}</span></div>` : ''}
    </div>
    ${t ? bar('Calories', d.kcal, t.kcal, 'kcal') : ''}
    ${bar('Protein', d.protein, t?.protein, 'g')}
    <div class="grid2">${bar('Carbs', d.carbs, t?.carbs, 'g')}${bar('Fat', d.fat, t?.fat, 'g')}</div>
    ${t ? '' : '<p class="muted small" style="margin:0">Add your weight and age under <b>Your targets</b> to see how much to eat.</p>'}`;
  $('#tSummary').textContent = t ? `${fmt(t.kcal)} kcal · ${t.protein} g protein` : 'Not set';

  const L = d.items.slice().sort((a, b) => a.at - b.at);
  const meals = [...new Set(L.map(e => e.meal))];
  $('#foodLog').innerHTML = L.length ? meals.map(m => {
    const its = L.filter(e => e.meal === m), k = its.reduce((s, e) => s + e.kcal, 0);
    return `<div class="meal-head"><span class="eyebrow">${m}</span><span class="data small">${fmt(k)} kcal</span></div>` + its.map(e => `
      <div class="row"><div><b>${esc(e.name)}</b><div class="muted small">${esc(e.label)} · P ${r0(e.protein)} · C ${r0(e.carbs)} · F ${r0(e.fat)} g</div></div>
        <span class="r data">${fmt(e.kcal)}</span>
        <button type="button" class="linkbtn" data-edit="${e.id}" aria-label="Change ${esc(e.name)}">Edit</button>
        <button type="button" class="linkbtn del" data-del="${e.id}" aria-label="Remove ${esc(e.name)}">✕</button></div>`).join('');
  }).join('') : '<p class="muted small" style="margin:0">Nothing logged yet. Search a dish or snap your plate.</p>';
}

/* ---------- Search ---------- */
function renderResults() {
  const q = $('#foodSearch').value, box = $('#foodResults');
  const res = N.search(q, 25);
  box.hidden = !q.trim();
  if (!q.trim()) return;
  const tag = e => e.ref.t === 'dish' ? '<span class="ftag desi">Desi model</span>' : e.ref.t === 'indb' ? `<span class="ftag">Indian recipe${e.fried ? ' · fried' : ''}</span>` : '<span class="ftag">Ingredient</span>';
  box.innerHTML = res.length ? `<div class="list">${res.map(e => {
    const est = N.estimate(e.ref, defaultOpts(e.ref));
    const unit = e.ref.t === 'dish' ? N.serveLabel(N.DISH[e.ref.id], 1) : e.ref.t === 'indb' ? (N.lookup(e.ref).food[7] || 'serving') : '100 g';
    return `<button type="button" class="row food-hit" data-ref='${JSON.stringify(e.ref)}'><div><b>${esc(e.name)}</b><div class="muted small">${tag(e)} ${esc(unit)}</div></div><span class="r data">${fmt(est.kcal)} kcal</span></button>`;
  }).join('')}</div>` : `<p class="muted small" style="margin:0">No match for “${esc(q)}”. Try the Urdu or Hindi name, or a main ingredient.</p>`;
}

/* ---------- Sheet ---------- */
function defaultOpts(ref) {
  if (ref.t === 'ing') return { grams: 100 };
  if (ref.t === 'indb') return { servings: 1 };
  const pr = prefFor(ref);
  return { servings: 1, style: pr.style || F().style || 'home', styleKnown: !!pr.style, meat: pr.meat || 'normal', oil: 'normal', size: pr.size || 'm', topping: !!pr.topping };
}

function openSheet(ref, opts, onSave, saveLabel) {
  const hit = N.lookup(ref);
  if (!hit) return;
  cur = { ref, hit, opts: { ...defaultOpts(ref), ...(opts || {}) }, onSave, saveLabel };
  renderSheet();
  $('#foodSheet').hidden = false;
}
function closeSheet() { $('#foodSheet').hidden = true; cur = null; }

const seg = (key, items, val) => `<div class="seg fseg" data-key="${key}" role="group">${items.map(i => `<button type="button" data-v="${i.id}" class="${i.id === val ? 'on' : ''}" aria-pressed="${i.id === val}">${esc(i.label)}</button>`).join('')}</div>`;

function renderSheet() {
  const { ref, hit, opts } = cur, d = ref.t === 'dish' ? hit.food : null;
  let html = `<div class="grab"></div><div><span class="eyebrow">${ref.t === 'dish' ? 'Desi model · computed from ingredients' : ref.t === 'indb' ? 'Indian Nutrient Databank' : 'Ingredient (USDA)'}</span>
    <h2 class="display h2" style="margin-top:6px">${esc(hit.name)}</h2></div>`;
  if (ref.t === 'ing') {
    html += `<label class="field">How much (grams)<input id="fsGrams" type="number" inputmode="decimal" value="${opts.grams}"></label>`;
  } else {
    html += `<div class="stepper"><button type="button" data-step="-0.5" aria-label="Less">−</button><div><b class="num" id="fsServe"></b></div><button type="button" data-step="0.5" aria-label="More">+</button></div>`;
  }
  if (d) {
    if (d.sizes) html += `<div class="fq"><span class="eyebrow">Size</span>${seg('size', N.SIZES, opts.size)}</div>`;
    if (N.hasFatChoice(d)) html += `<div class="fq"><span class="eyebrow">Who cooked it?</span>${seg('style', N.STYLES, opts.style)}
      <p class="muted small fq-why">${d.kind === 'fried' ? 'Shops and stalls fry hotter and longer in older oil, so more soaks in.' : 'The camera can’t see how much oil went in. This is the biggest difference between plates.'}</p></div>`;
    if (N.hasMeatChoice(d)) html += `<div class="fq"><span class="eyebrow">${d.kind === 'rice' ? 'Meat or rice?' : 'Meat or gravy?'}</span>${seg('meat', N.MEAT_SHARE.map(m => ({ ...m, label: d.kind === 'rice' && m.id === 'less' ? 'Mostly rice' : m.label })), opts.meat)}</div>`;
    if (N.hasOilChoice(d)) html += `<div class="fq"><span class="eyebrow">Oil you can see</span>${seg('oil', N.OIL_LEVEL, opts.oil)}</div>`;
    if (d.topping) html += `<label class="check"><input type="checkbox" id="fsTop" ${opts.topping ? 'checked' : ''}> ${esc(d.topping[2])}</label>`;
  }
  html += `<div id="fsResult"></div><button type="button" class="cta" id="fsSave">${esc(cur.saveLabel || 'Add to ' + N.mealOf().toLowerCase())}</button>`;
  $('#foodSheetBody').innerHTML = html;
  const top = $('#fsTop'); if (top) top.onchange = () => { cur.opts.topping = top.checked; renderSheetResult(); };
  renderSheetResult();
}

function renderSheetResult() {
  const { ref, hit, opts } = cur, e = N.estimate(ref, opts), d = ref.t === 'dish' ? hit.food : null;
  const serve = $('#fsServe');
  if (serve) serve.textContent = d ? N.serveLabel(d, opts.servings) : `${N.fmtN(opts.servings)} × ${hit.food[7] || 'serving'} (≈${r0(e.grams)} g)`;
  const tot = Math.max(1, e.kcal), pf = e.parts.fat / tot * 100, pm = e.parts.meat / tot * 100;
  const fatName = d ? e.fatLabel : 'Fat';
  $('#fsResult').innerHTML = `
    <div class="fs-kcal"><div class="kbig num">${fmt(e.kcal)}<small> kcal</small></div><span class="muted small">likely ${fmt(e.low)}–${fmt(e.high)}</span></div>
    <div class="macros"><div><b class="num">${r0(e.protein)}</b><span>protein g</span></div><div><b class="num">${r0(e.carbs)}</b><span>carbs g</span></div><div><b class="num">${r0(e.fat)}</b><span>fat g</span></div><div><b class="num">${r0(e.fibre)}</b><span>fibre g</span></div></div>
    <div class="split" aria-label="Where the calories come from"><i class="sf" style="width:${pf}%"></i><i class="sm" style="width:${pm}%"></i><i class="sr" style="width:${Math.max(0, 100 - pf - pm)}%"></i></div>
    <p class="muted small" style="margin:0">${d && e.fatGrams > 0 ? `${fatName}: ${r0(e.fatGrams)} g, ${r0(pf)}% of the calories. ` : `Fat gives ${r0(pf)}% of the calories. `}${pm > 0 ? `Meat or protein: ${r0(pm)}%.` : ''}</p>
    ${e.fried ? '<p class="warn-note small">This recipe counts all the frying oil as eaten, so it reads too high. For samosas, pakoray and puris use the Desi model instead.</p>' : ''}`;
}

function onSheetClick(e) {
  const st = e.target.closest('[data-step]');
  if (st) { cur.opts.servings = Math.max(0.5, Math.min(20, (cur.opts.servings || 1) + +st.dataset.step)); return renderSheetResult(); }
  const b = e.target.closest('.fseg [data-v]');
  if (b) {
    const key = b.closest('.fseg').dataset.key; cur.opts[key] = b.dataset.v;
    if (key === 'style') cur.opts.styleKnown = true;
    b.closest('.fseg').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    return renderSheetResult();
  }
  if (e.target.closest('#fsSave')) {
    const { ref, opts } = cur;
    if (ref.t === 'dish') { // remember how this person's food is usually cooked
      const pr = F().prefs[ref.id] ||= {};
      if (opts.styleKnown) { pr.style = opts.style; F().style = opts.style; }
      if (opts.meat !== 'normal') pr.meat = opts.meat;
      if (N.DISH[ref.id].sizes) pr.size = opts.size;
      if (N.DISH[ref.id].topping) pr.topping = opts.topping;
    }
    const save = cur.onSave;
    if (save) save({ ...opts }); else { addEntry(ref, opts, 'search'); ctx.toast('Added'); $('#foodSearch').value = ''; renderResults(); }
    ctx.persist(); closeSheet(); renderFood();
  }
}

function entryFrom(ref, opts) {
  const hit = N.lookup(ref), e = N.estimate(ref, opts);
  const label = ref.t === 'dish' ? N.serveLabel(hit.food, (opts.servings || 1)) + (opts.style && N.hasFatChoice(hit.food) ? ` · ${N.STYLES.find(s => s.id === opts.style).label.toLowerCase()}` : '')
    : ref.t === 'indb' ? `${N.fmtN(opts.servings || 1)} × ${hit.food[7] || 'serving'}` : `${r0(opts.grams)} g`;
  return { ref, opts: { ...opts }, name: hit.name, label, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, low: e.low, high: e.high };
}
function addEntry(ref, opts, source) {
  F().log.push({ id: Math.random().toString(36).slice(2, 10), at: Date.now(), meal: N.mealOf(), source, ...entryFrom(ref, opts) });
  if (F().log.length > 3000) F().log.splice(0, F().log.length - 3000);
  ctx.persist();
}

/* ---------- Photo ---------- */
async function runPhoto(file) {
  const box = $('#foodPhotoBox');
  box.hidden = false; box.innerHTML = '<div class="card"><b>Looking at your plate…</b><p class="muted small" style="margin:6px 0 0">QK names each dish and counts portions. The calories are worked out from ingredients, so the same plate always gives the same number.</p></div>';
  try {
    const r = await recognise(file);
    const styleGuess = r.setting === 'restaurant' ? 'restaurant' : null;
    photo = {
      dataUrl: r.dataUrl, agreement: r.agreement, cached: r.cached,
      unknown: r.items.filter(i => !i.dish).map(i => i.otherName),
      items: r.items.filter(i => i.dish).map(i => {
        const ref = { t: 'dish', id: i.dish }, pr = prefFor(ref);
        const style = pr.style || styleGuess || F().style || 'home';
        return { ref, conf: i.confidence, opts: { ...defaultOpts(ref), servings: i.servings, meat: i.meat, oil: i.oil, style, styleKnown: !!pr.style, portionSd: 0.3 } };
      }),
    };
    renderPhoto();
  } catch (err) {
    box.innerHTML = `<div class="card"><b>Couldn’t read the photo</b><p class="muted small" style="margin:6px 0 0">${esc(err.message === 'no-endpoint' ? 'Photo recognition isn’t switched on yet.' : 'Check your connection and try again, or search for the dish.')}</p></div>`;
  }
}
function renderPhoto() {
  const box = $('#foodPhotoBox');
  if (!photo) { box.hidden = true; box.innerHTML = ''; return; }
  const total = photo.items.reduce((s, it) => s + N.estimate(it.ref, it.opts).kcal, 0);
  const unsure = photo.agreement < 0.75 || photo.items.some(i => i.conf < 0.6);
  box.innerHTML = `<div class="card stack">
    <div class="photo-head"><img src="${photo.dataUrl}" alt="Your plate"><div><span class="eyebrow">${unsure ? 'Please check' : 'QK sees'}</span><div class="kbig num">${fmt(total)}<small> kcal</small></div>
      <span class="muted small">Tap a dish to fix the portion or who cooked it.</span></div></div>
    <div class="list">${photo.items.map((it, i) => { const e = N.estimate(it.ref, it.opts), d = N.DISH[it.ref.id]; return `
      <div class="row"><button type="button" class="food-hit" data-pedit="${i}"><div><b>${esc(d.name)}</b><div class="muted small">${esc(N.serveLabel(d, it.opts.servings))}${N.hasFatChoice(d) ? ' · ' + (it.opts.styleKnown ? '' : 'probably ') + N.STYLES.find(s => s.id === it.opts.style).label.toLowerCase() : ''}</div></div><span class="r data">${fmt(e.kcal)}</span></button>
      <button type="button" class="linkbtn del" data-prm="${i}" aria-label="Remove ${esc(d.name)}">✕</button></div>`; }).join('')}</div>
    ${photo.unknown.length ? `<p class="muted small" style="margin:0">Also saw: ${photo.unknown.map(esc).join(', ')}. Search to add these.</p>` : ''}
    <div class="btn-row"><button type="button" class="ghost" id="photoCancel">Cancel</button><button type="button" class="cta" id="photoAddAll"${photo.items.length ? '' : ' disabled'}>Add all</button></div></div>`;
}
function showNoEndpoint() {
  const box = $('#foodPhotoBox'); box.hidden = false;
  box.innerHTML = `<div class="card"><b>Photo recognition needs its server</b><p class="muted small" style="margin:6px 0 0">Run <code>tools/food-vision-server.mjs</code> with your AI key and set <code>PHOTO_CONFIG.endpoint</code> in <code>js/foodphoto.js</code>. Until then, search for the dish; it takes two taps.</p></div>`;
}
