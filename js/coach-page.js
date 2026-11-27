// Coach dashboard page (coach.html): who's training, who isn't, what each client did, and one-tap messages.
// With no server configured (js/cloud-config.js) it shows sample clients so the coach can try it.
import { CLOUD, cloudOn } from './cloud-config.js';
import { Cloud } from './sync.js';
import { clientCard, sortCards, overview, TEMPLATES, fill, demoData, localClient, LOCAL_ID, DEMO_INBOX } from './dash.js';
import { LIB } from './library.js';
import { byId as programById } from './programs.js';
import { EXERCISES, allRules } from './exercises.js';
import { retotal, FOOD_CHOICES, FOODS } from './dietplan.js';
import { scoreChips } from './scoreview.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); };
const D = 864e5, names = Object.fromEntries(Object.values(LIB).map(x => [x.id, x.name]));
// Fault id → what the client did wrong, in plain words ("Knees caving in").
const RULES_BY_ID = {}; for (const ex of Object.values(EXERCISES)) for (const r of allRules(ex)) RULES_BY_ID[r.id] ||= r.wrong || r.tag || r.id;
const ago = t => { if (t == null) return 'never'; const d = Math.floor((Date.now() - t) / D); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
const statusCls = s => s.replace(' ', '-');

const state = { demo: !cloudOn(), cards: [], raw: null, sel: null, filter: 'all', q: '', sent: {}, edit: {}, coachPlans: {} };
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const cloud = cloudOn() ? new Cloud({ url: CLOUD.url, anonKey: CLOUD.anonKey, session: store.get('qk_coach_session'), onSession: s => store.set('qk_coach_session', s) }) : null;

async function load() {
  const now = Date.now();
  if (state.demo) {
    state.raw = demoData(now);
    // Your own training on this device joins the sample clients, at the top.
    const me = localClient(store.get('shred_qk_v1'), now);
    if (me) { state.raw.profiles.unshift(me.profile); state.raw.sets.push(...me.sets); state.raw.opens.push(...me.opens); state.raw.checks.push(...me.checks); (state.raw.food ||= []).push(...me.food); }
  }
  else {
    const me = await cloud.me();
    if (me?.role !== 'coach') { showLogin('This account isn\'t set up as a coach yet. See supabase/README.md, step 4.'); return; }
    $('#cdMe').innerHTML = `${esc(me.name || '')}<br>Client invite code: <code>${esc(me.invite_code)}</code>`;
    const profiles = await cloud.clients(), ids = profiles.map(p => p.id), from = new Date(now - 70 * D).toISOString();
    const [sets, opens, checks, sent, food] = await Promise.all([cloud.since('sessions', ids, from), cloud.since('events', ids, from), cloud.since('checkins', ids, from), cloud.sent(new Date(now - 14 * D).toISOString()), cloud.since('food_days', ids, new Date(now - 14 * D).toISOString().slice(0, 10)).catch(() => [])]);
    state.raw = { profiles, sets, opens, checks, food };
    state.coachPlans = {}; for (const cp of await cloud.plans(ids).catch(() => [])) state.coachPlans[cp.client_id] = cp;
    state.sent = {}; for (const m of sent) (state.sent[m.client_id] ||= []).push(m);
  }
  const { profiles, sets, opens, checks, food = [] } = state.raw, by = (rows, id) => rows.filter(r => r.client_id === id);
  state.cards = sortCards(profiles.map(p => clientCard(p, by(sets, p.id), by(opens, p.id), by(checks, p.id), { now, names, food: by(food, p.id) })));
  // Demo: your own row first, so you can find yourself.
  const mine = state.cards.findIndex(c => c.id === LOCAL_ID); if (mine > 0) state.cards.unshift(...state.cards.splice(mine, 1));
  render();
}

function render() {
  const ov = overview(state.cards);
  $('#cdStats').innerHTML = [
    ['', ov.total, 'clients'], ['good', ov.onTrack, 'on track'], ['warn', ov.slipping, 'slipping'], ['bad', ov.inactive, 'inactive (3+ days)'],
    ['', ov.openedToday, 'opened the app today'], ['good', ov.prs, 'personal bests this week'],
  ].map(([c, n, l]) => `<div class="cd-stat ${c}"><b>${n}</b><span>${l}</span></div>`).join('');
  const q = state.q.toLowerCase();
  const list = state.cards.filter(c => (state.filter === 'all' || c.status === state.filter) && (!q || c.name.toLowerCase().includes(q)));
  $('#cdList').innerHTML = list.map(c => `<button type="button" role="listitem" class="cd-row ${c.id === state.sel ? 'sel' : ''}" data-client="${esc(c.id)}">
      <span class="cd-dot ${statusCls(c.status)}" aria-label="${c.status}"></span><b>${esc(c.name)}</b>
      <span class="nums"><strong>${c.daysTrained}/${c.weeklyGoal}</strong> days<span>${c.form == null ? '–' : c.form + '%'} form</span></span>
      <span class="why">${esc(c.reason)} · seen ${ago(c.lastSeen)}${healthOf(c.id) != null ? ` · <span class="sc-chip ${healthOf(c.id) >= 75 ? 'good' : healthOf(c.id) >= 50 ? 'mid' : 'low'}">Health ${healthOf(c.id)}</span>` : ''}</span></button>`).join('') || '<p class="empty">No clients match.</p>';
  renderDetail();
}

const healthOf = id => state.raw?.profiles.find(p => p.id === id)?.scores?.health ?? null;
function renderDetail() {
  const c = state.cards.find(x => x.id === state.sel), box = $('#cdDetail');
  if (!c) { box.innerHTML = '<p class="empty">Pick a client to see their week, lifts and form, and to send a message.</p>'; return; }
  const prog = c.program?.id ? programById(c.program.id) : null;
  const kind = c.status === 'on track' ? 'cheer' : 'nudge', sent = state.sent[c.id] || [];
  const fault = c.topFault ? (RULES_BY_ID[c.topFault.id] || c.topFault.id) : null;
  box.innerHTML = `<div><span class="cd-badge ${statusCls(c.status)}">${c.status}</span><h2 class="display h2" style="margin-top:6px">${esc(c.name)}</h2><p class="muted small" style="margin:2px 0 0">${esc(c.reason)}</p></div>
    <div class="cd-scores">${scoreChips(state.raw?.profiles.find(p => p.id === c.id)?.scores)}</div>
    <div class="cd-kv">
      <span>Last opened the app</span><span>${ago(c.lastSeen)}</span>
      <span>Training days this week</span><span>${c.daysTrained} of ${c.weeklyGoal}</span>
      <span>Sets this week</span><span>${c.sets}</span>
      <span>Volume this week</span><span>${c.volume.toLocaleString()} kg</span>
      <span>Form score this week (last week)</span><span>${c.form == null ? '–' : c.form + '%'}${c.formPrev == null ? '' : ` (${c.formPrev}%)`}</span>
      <span>Program</span><span>${prog || c.program?.name ? `${esc(prog?.name || c.program.name)} · month ${c.program.block || 1}` : '–'}</span>
      <span>Last workout</span><span>${c.lastWorkout ? `${ago(c.lastWorkout.at)}: ${esc(c.lastWorkout.exercises.slice(0, 3).join(', '))}` : '–'}</span>
      <span>Personal bests this week</span><span>${c.prs.length ? esc(c.prs.map(p => p.name).join(', ')) : '–'}</span>
      <span>Most common fault (4 weeks)</span><span>${fault ? `${esc(fault)} ×${c.topFault.n}` : '–'}</span>
      <span>Clean reps, all time</span><span>${c.cleanReps}${c.medal ? ` · ${esc(c.medal.name)}` : ''}</span>
    </div>
    ${foodHTML(c.food)}
    ${planHTML(c)}
    <div class="cd-msg">
      <span class="eyebrow">${kind === 'cheer' ? 'Send a cheer' : 'Send a nudge'} · QK says it when they open the app</span>
      <div class="cd-tpl">${TEMPLATES[kind].map((t, i) => `<button type="button" data-tpl="${kind}:${i}">${esc(fill(t, c.name))}</button>`).join('')}</div>
      <textarea id="cdText" maxlength="500" placeholder="Or write your own…"></textarea>
      <button class="cta" type="button" id="cdSendMsg" data-kind="${kind}">Send to ${esc(c.name.split(' ')[0])}</button>
      ${sent.length ? `<p class="cd-sent">Last sent ${ago(Date.parse(sent[0].created_at))}: “${esc(sent[0].body)}”${sent[0].read_at ? ' · read' : ''}</p>` : ''}
    </div>`;
}

function foodHTML(f) {
  if (!f) return '<div class="cd-food"><span class="eyebrow">Food</span><p class="muted small" style="margin:4px 0 0">No food logged yet.</p></div>';
  const t = f.target, pct = (v, g) => g ? ` (${Math.round(v / g * 100)}%)` : '';
  return `<div class="cd-food"><span class="eyebrow">Food · last 7 days</span>
    <div class="cd-kv">
      <span>Days logged</span><span>${f.daysLogged} of 7</span>
      <span>Calories a day</span><span>${f.avgKcal == null ? '–' : f.avgKcal.toLocaleString()}${t ? ` / ${t.kcal.toLocaleString()} target${pct(f.avgKcal, t.kcal)}` : ''}</span>
      <span>Protein a day</span><span>${f.avgProtein == null ? '–' : f.avgProtein + ' g'}${t ? ` / ${t.protein} g${pct(f.avgProtein, t.protein)}` : ''}</span>
      <span>Weight trend</span><span>${f.weightPerWeek == null ? '–' : `${f.weightPerWeek > 0 ? '+' : ''}${f.weightPerWeek} kg / week`}</span>
      ${f.maintenance ? `<span>Real maintenance (logs + scale)</span><span>${f.maintenance.toLocaleString()} kcal</span>` : ''}
      <span>Signals</span><span>${f.signals ? esc([f.signals.foodDays14 != null ? `food logged ${f.signals.foodDays14}/14 days` : '', f.signals.daysSinceFood >= 3 ? `quiet ${f.signals.daysSinceFood} days` : '', f.signals.sleepH != null ? `sleep ${f.signals.sleepH} h` : '', f.signals.mornings ? `rough mornings ${f.signals.rough}/${f.signals.mornings}` : '', f.signals.stressed >= 3 ? `stressed ${f.signals.stressed} days` : '', f.signals.strength != null ? `strength ${f.signals.strength > 0 ? '+' : ''}${f.signals.strength}%` : ''].filter(Boolean).join(' · ') || '–') : '–'}</span>
      <span>Last check-in</span><span>${f.checkin ? `${esc(f.checkin.last.day)}: ${esc({ keep: 'kept the plan', kcal: `calories ${f.checkin.last.delta > 0 ? '+' : ''}${f.checkin.last.delta}`, steps: `steps goal ${(f.checkin.stepGoal || 0).toLocaleString()}`, ok: 'weighed in' }[f.checkin.last.choice] || f.checkin.last.choice)}${f.checkin.kcalAdjust ? ` · total ${f.checkin.kcalAdjust > 0 ? '+' : ''}${f.checkin.kcalAdjust} kcal` : ''}` : 'None yet'}</span>
      <span>Diet plan</span><span>${f.plan ? `${f.plan.kcal.toLocaleString()} kcal · ${f.plan.protein} g protein · ${f.plan.meals} meals (made ${esc(f.plan.at.slice(0, 10))})` : 'Not made yet'}</span>
      <span>QK suggested</span><span>${f.focus.length ? esc(f.focus.join(' · ')) : '–'}</span>
      ${f.lastDay ? `<span>Latest day (${esc(String(f.lastDay.at).slice(0, 10))})</span><span>${esc((f.lastDay.items || []).slice(0, 4).map(i => i.name).join(', '))}${(f.lastDay.items || []).length > 4 ? '…' : ''}</span>` : ''}
    </div></div>`;
}

/* ---- QK edits a client's diet plan ---- */
const r0 = v => Math.round(v);
// The plan QK is editing: an unsaved edit, else the one QK last saved, else the client's own.
const planFor = id => state.edit[id] || state.coachPlans[id]?.plan || state.raw?.profiles.find(p => p.id === id)?.diet_plan || null;
function planHTML(c) {
  const plan = planFor(c.id);
  if (!plan?.meals) return '<div class="cd-food"><span class="eyebrow">Diet plan</span><p class="muted small" style="margin:4px 0 0">No plan yet. When the client answers the food questions in the app, their plan appears here for you to edit.</p></div>';
  const t = plan.target || {}, d = plan.day, edited = !!state.edit[c.id];
  const gap = k => t[k] ? Math.round((d[k] - t[k]) / t[k] * 100) : 0;
  return `<div class="cd-food cd-plan"><span class="eyebrow">Diet plan · ${state.coachPlans[c.id] ? 'edited by you' : 'made in the app'}${edited ? ' · unsaved changes' : ''}</span>
    <p class="small" style="margin:4px 0 8px"><b>${r0(d.kcal).toLocaleString()} kcal</b> · P ${r0(d.protein)} · C ${r0(d.carbs)} · F ${r0(d.fat)} g
      <span class="muted">(target ${(t.kcal || 0).toLocaleString()} kcal${t.kcal ? `, ${gap('kcal') > 0 ? '+' : ''}${gap('kcal')}%` : ''}; protein ${t.protein || '–'} g)</span></p>
    ${plan.meals.map((m, mi) => `<div class="cdp-meal"><b>${esc(m.name)}</b> <span class="muted small">${r0(m.target?.kcal || 0)} kcal target</span>
      ${m.options.map((o, oi) => `<div class="cdp-opt"><div class="cdp-head"><span>${m.options.length > 1 ? 'ABC'[oi] + '. ' : ''}${esc(o.title)}</span><span class="muted small">${r0(o.total.kcal)} kcal · P ${r0(o.total.protein)}</span></div>
        ${o.items.map((it, ii) => `<div class="cdp-item"><span>${esc(it.name)}</span>
          <input type="number" min="0" step="${FOODS[it.id]?.step || 1}" value="${it.amount}" data-amt="${mi}|${oi}|${ii}" aria-label="Amount of ${esc(it.name)}">
          <span class="muted small">${esc(FOODS[it.id]?.unit === 'g' ? 'g' : FOODS[it.id]?.unit || '')}</span><span class="muted small cdp-k">${r0(it.kcal)}</span>
          <button type="button" class="cdp-x" data-del="${mi}|${oi}|${ii}" aria-label="Remove ${esc(it.name)}">✕</button></div>`).join('')}
        <div class="cdp-add"><select data-addsel="${mi}|${oi}" aria-label="Add a food"><option value="">+ Add a food…</option>${FOOD_CHOICES.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div>
      </div>`).join('')}</div>`).join('')}
    <textarea id="cdPlanNote" maxlength="300" placeholder="A note for ${esc(c.name.split(' ')[0])} (optional): what you changed and why">${esc(state.edit[c.id]?.noteDraft || state.coachPlans[c.id]?.note || '')}</textarea>
    <div class="btn-row"><button class="cta" type="button" id="cdPlanSave" ${edited ? '' : 'disabled'}>Save and send to ${esc(c.name.split(' ')[0])}</button>${edited ? '<button class="ghost" type="button" id="cdPlanUndo">Discard changes</button>' : ''}</div></div>`;
}
function editPlan(id, fn) {
  const p = structuredClone(planFor(id)); fn(p);
  state.edit[id] = { ...retotal(p), noteDraft: $('#cdPlanNote')?.value || '' };
  renderDetail();
}
$('#cdDetail').addEventListener('change', e => {
  const id = state.sel, a = e.target.dataset;
  if (a.amt) { const [mi, oi, ii] = a.amt.split('|').map(Number); return editPlan(id, p => { p.meals[mi].options[oi].items[ii].amount = Math.max(0, +e.target.value || 0); }); }
  if (a.addsel && e.target.value) {
    const [mi, oi] = a.addsel.split('|').map(Number), f = FOODS[e.target.value];
    return editPlan(id, p => { p.meals[mi].options[oi].items.push({ id: f.id, amount: f.unit === 'g' || f.unit === 'ml' ? f.min : Math.max(f.min, f.step) }); });
  }
});
$('#cdDetail').addEventListener('click', async e => {
  const id = state.sel, del = e.target.closest('[data-del]');
  if (del) { const [mi, oi, ii] = del.dataset.del.split('|').map(Number); return editPlan(id, p => { p.meals[mi].options[oi].items.splice(ii, 1); }); }
  if (e.target.id === 'cdPlanUndo') { delete state.edit[id]; return renderDetail(); }
  if (e.target.id !== 'cdPlanSave') return;
  const c = state.cards.find(x => x.id === id), { noteDraft, ...plan } = state.edit[id], note = $('#cdPlanNote').value.trim(), at = new Date().toISOString();
  try {
    if (!state.demo) await cloud.setPlan(id, plan, note);
    else if (id === LOCAL_ID) store.set('qk_demo_plan', { plan, note, at });
    state.coachPlans[id] = { plan, note, updated_at: at }; delete state.edit[id]; renderDetail();
    toast(state.demo && id !== LOCAL_ID ? `Sample mode: this would go to ${c.name}.` : state.demo ? 'Saved. Open the app on this phone to see it.' : `Saved. ${c.name.split(' ')[0]} gets it next time the app syncs, with a notification.`);
  } catch (err) { toast(`Couldn't save: ${err.message}`); }
});

$('#cdList').onclick = e => { const b = e.target.closest('[data-client]'); if (!b) return; state.sel = b.dataset.client; render(); if (innerWidth < 820) $('#cdDetail').scrollIntoView({ behavior: 'smooth' }); };
$('#cdFilter').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; state.filter = b.dataset.f; $('#cdFilter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); render(); };
$('#cdSearch').oninput = e => { state.q = e.target.value; render(); };
$('#cdDetail').addEventListener('click', async e => {
  const t = e.target.closest('[data-tpl]');
  if (t) { $('#cdText').value = t.textContent; $('#cdText').focus(); return; }
  if (e.target.id !== 'cdSendMsg') return;
  const body = $('#cdText').value.trim(), c = state.cards.find(x => x.id === state.sel);
  if (!body || !c) return toast('Pick a message or write one first.');
  try {
    if (!state.demo) await cloud.send(c.id, e.target.dataset.kind, body);
    else if (c.id === LOCAL_ID) store.set(DEMO_INBOX, [...(store.get(DEMO_INBOX) || []), { id: Date.now(), kind: e.target.dataset.kind, body }]);
    (state.sent[c.id] ||= []).unshift({ body, created_at: new Date().toISOString() });
    renderDetail(); toast(state.demo && c.id !== LOCAL_ID ? `Sample mode: this would be sent to ${c.name}.` : state.demo ? 'Sent. Open the app on this phone and QK will say it.' : `Sent. QK will say it to ${c.name.split(' ')[0]} when they open the app.`);
  } catch (err) { toast(`Couldn't send: ${err.message}`); }
});

/* ---- sign in (real server only) ---- */
function showLogin(msg) { $('#cdMain').hidden = true; $('#cdLogin').hidden = false; $('#cdErr').hidden = !msg; $('#cdErr').textContent = msg || ''; }
$('#cdSend').onclick = async () => {
  const email = $('#cdEmail').value.trim(); if (!email) return;
  try { await cloud.sendCode(email); $('#cdCodeWrap').hidden = false; $('#cdErr').hidden = true; toast('Code sent. Check your email.'); }
  catch (err) { showLogin(err.message); }
};
$('#cdVerify').onclick = async () => {
  try { await cloud.verify($('#cdEmail').value, $('#cdCode').value); $('#cdLogin').hidden = true; $('#cdMain').hidden = false; await load(); }
  catch (err) { showLogin(err.message); }
};

(async () => {
  if (state.demo) { $('#cdDemo').hidden = false; $('#cdMain').hidden = false; $('#cdMe').textContent = 'Sample mode'; return load(); }
  if (!cloud.signedIn) return showLogin();
  $('#cdMain').hidden = false;
  try { await load(); } catch (err) { showLogin(err.status === 401 ? 'Please sign in again.' : err.message); }
})();
window.__coach = state;
