// Coach dashboard page (coach.html): who's training, who isn't, what each client did, and one-tap messages.
// With no server configured (js/cloud-config.js) it shows sample clients so the coach can try it.
import { CLOUD, cloudOn } from './cloud-config.js';
import { Cloud } from './sync.js';
import { clientCard, sortCards, overview, TEMPLATES, fill, demoData } from './dash.js';
import { LIB } from './library.js';
import { byId as programById } from './programs.js';
import { EXERCISES, allRules } from './exercises.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); };
const D = 864e5, names = Object.fromEntries(Object.values(LIB).map(x => [x.id, x.name]));
// Fault id → what the client did wrong, in plain words ("Knees caving in").
const RULES_BY_ID = {}; for (const ex of Object.values(EXERCISES)) for (const r of allRules(ex)) RULES_BY_ID[r.id] ||= r.wrong || r.tag || r.id;
const ago = t => { if (t == null) return 'never'; const d = Math.floor((Date.now() - t) / D); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
const statusCls = s => s.replace(' ', '-');

const state = { demo: !cloudOn(), cards: [], raw: null, sel: null, filter: 'all', q: '', sent: {} };
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const cloud = cloudOn() ? new Cloud({ url: CLOUD.url, anonKey: CLOUD.anonKey, session: store.get('qk_coach_session'), onSession: s => store.set('qk_coach_session', s) }) : null;

async function load() {
  const now = Date.now();
  if (state.demo) state.raw = demoData(now);
  else {
    const me = await cloud.me();
    if (me?.role !== 'coach') { showLogin('This account isn\'t set up as a coach yet. See supabase/README.md, step 4.'); return; }
    $('#cdMe').innerHTML = `${esc(me.name || '')}<br>Client invite code: <code>${esc(me.invite_code)}</code>`;
    const profiles = await cloud.clients(), ids = profiles.map(p => p.id), from = new Date(now - 70 * D).toISOString();
    const [sets, opens, checks, sent] = await Promise.all([cloud.since('sessions', ids, from), cloud.since('events', ids, from), cloud.since('checkins', ids, from), cloud.sent(new Date(now - 14 * D).toISOString())]);
    state.raw = { profiles, sets, opens, checks };
    state.sent = {}; for (const m of sent) (state.sent[m.client_id] ||= []).push(m);
  }
  const { profiles, sets, opens, checks } = state.raw, by = (rows, id) => rows.filter(r => r.client_id === id);
  state.cards = sortCards(profiles.map(p => clientCard(p, by(sets, p.id), by(opens, p.id), by(checks, p.id), { now, names })));
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
      <span class="why">${esc(c.reason)} · seen ${ago(c.lastSeen)}</span></button>`).join('') || '<p class="empty">No clients match.</p>';
  renderDetail();
}

function renderDetail() {
  const c = state.cards.find(x => x.id === state.sel), box = $('#cdDetail');
  if (!c) { box.innerHTML = '<p class="empty">Pick a client to see their week, lifts and form, and to send a message.</p>'; return; }
  const prog = c.program?.id ? programById(c.program.id) : null;
  const kind = c.status === 'on track' ? 'cheer' : 'nudge', sent = state.sent[c.id] || [];
  const fault = c.topFault ? (RULES_BY_ID[c.topFault.id] || c.topFault.id) : null;
  box.innerHTML = `<div><span class="cd-badge ${statusCls(c.status)}">${c.status}</span><h2 class="display h2" style="margin-top:6px">${esc(c.name)}</h2><p class="muted small" style="margin:2px 0 0">${esc(c.reason)}</p></div>
    <div class="cd-kv">
      <span>Last opened the app</span><span>${ago(c.lastSeen)}</span>
      <span>Training days this week</span><span>${c.daysTrained} of ${c.weeklyGoal}</span>
      <span>Sets this week</span><span>${c.sets}</span>
      <span>Volume this week</span><span>${c.volume.toLocaleString()} kg</span>
      <span>Form score this week (last week)</span><span>${c.form == null ? '–' : c.form + '%'}${c.formPrev == null ? '' : ` (${c.formPrev}%)`}</span>
      <span>Program</span><span>${prog ? `${esc(prog.name)} · month ${c.program.block || 1}` : '–'}</span>
      <span>Last workout</span><span>${c.lastWorkout ? `${ago(c.lastWorkout.at)}: ${esc(c.lastWorkout.exercises.slice(0, 3).join(', '))}` : '–'}</span>
      <span>Personal bests this week</span><span>${c.prs.length ? esc(c.prs.map(p => p.name).join(', ')) : '–'}</span>
      <span>Most common fault (4 weeks)</span><span>${fault ? `${esc(fault)} ×${c.topFault.n}` : '–'}</span>
      <span>Clean reps, all time</span><span>${c.cleanReps}${c.medal ? ` · ${esc(c.medal.name)}` : ''}</span>
    </div>
    <div class="cd-msg">
      <span class="eyebrow">${kind === 'cheer' ? 'Send a cheer' : 'Send a nudge'} · QK says it when they open the app</span>
      <div class="cd-tpl">${TEMPLATES[kind].map((t, i) => `<button type="button" data-tpl="${kind}:${i}">${esc(fill(t, c.name))}</button>`).join('')}</div>
      <textarea id="cdText" maxlength="500" placeholder="Or write your own…"></textarea>
      <button class="cta" type="button" id="cdSendMsg" data-kind="${kind}">Send to ${esc(c.name.split(' ')[0])}</button>
      ${sent.length ? `<p class="cd-sent">Last sent ${ago(Date.parse(sent[0].created_at))}: “${esc(sent[0].body)}”${sent[0].read_at ? ' · read' : ''}</p>` : ''}
    </div>`;
}

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
    (state.sent[c.id] ||= []).unshift({ body, created_at: new Date().toISOString() });
    renderDetail(); toast(state.demo ? `Sample mode: this would be sent to ${c.name}.` : `Sent. QK will say it to ${c.name.split(' ')[0]} when they open the app.`);
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
