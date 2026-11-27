// Coach dashboard extras: broadcast a notification to everyone (or a group), and the leaderboard with monthly prizes.
import { AUDIENCES, audienceOf, BROADCAST_TEMPLATES, BROADCAST_MAX, fill } from './dash.js';
import { weekKey, monthTotals, ranked, displayName } from './leaderboard.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const D = 864e5;
let X; // { state, cloud, toast }
let board = { range: 'week', scores: [], rewards: [] };
const monthKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);

export function initCoachExtra(x) {
  X = x;
  $('#bcAud').innerHTML = AUDIENCES.map(a => `<option value="${a.id}">${esc(a.label)}</option>`).join('');
  $('#bcTpl').innerHTML = BROADCAST_TEMPLATES.map((t, i) => `<button type="button" class="chip" data-bctpl="${i}">${esc(t.title)}</button>`).join('');
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-bctpl]');
    if (t) { const tp = BROADCAST_TEMPLATES[+t.dataset.bctpl]; $('#bcTitle').value = tp.title; $('#bcBody').value = tp.body; preview(); }
    const r = e.target.closest('[data-cbrange]');
    if (r) { board.range = r.dataset.cbrange; renderBoard(); }
    const w = e.target.closest('[data-award]');
    if (w) award(w.dataset.award, +w.dataset.place);
  });
  ['#bcTitle', '#bcBody', '#bcAud'].forEach(id => $(id).addEventListener('input', preview));
  $('#bcSend').onclick = send;
  $('#cbSavePrizes').onclick = savePrizes;
}

/* ---------- Broadcast ---------- */
function targets() {
  const { state } = X, clients = (state.raw?.profiles || []).map(p => ({ id: p.id, name: p.name }));
  const lastTrain = new Map(); for (const s of state.raw?.sets || []) lastTrain.set(s.client_id, Math.max(lastTrain.get(s.client_id) || 0, s.at));
  const top = new Set(weekRows().slice(0, 10).map(r => r.client_id));
  return audienceOf(clients, $('#bcAud').value, { lastTrain, top });
}
function preview() {
  const t = targets(), body = $('#bcBody').value.trim(), title = $('#bcTitle').value.trim();
  $('#bcCount').textContent = `${t.length} client${t.length === 1 ? '' : 's'}`;
  $('#bcPreview').innerHTML = body ? `<div class="bc-notif"><b>${esc(title || 'QK')}</b><span>${esc(fill(body, t[0]?.name || 'Ali'))}</span></div>` : '';
  $('#bcLeft').textContent = `${BROADCAST_MAX - body.length}`;
}
async function send() {
  const t = targets(), title = $('#bcTitle').value.trim().slice(0, 60), body = $('#bcBody').value.trim().slice(0, BROADCAST_MAX);
  if (!body) return X.toast('Write a message first.');
  if (!t.length) return X.toast('Nobody in that group right now.');
  if (!confirm(`Send "${title || 'QK'}" to ${t.length} client${t.length === 1 ? '' : 's'}?`)) return;
  const names = new Map(t.map(c => [c.id, c.name]));
  try {
    if (!X.state.demo) await X.cloud.broadcast(t.map(c => c.id), title || 'QK', id => fill(body, names.get(id)));
    X.toast(X.state.demo ? `Demo: would send to ${t.length}.` : `Sent to ${t.length}. Phones get it within the hour; the app shows it next time it opens.`);
    $('#bcBody').value = ''; $('#bcTitle').value = ''; preview();
  } catch (e) { X.toast(`Not sent: ${e.message}`); }
}

/* ---------- Leaderboard and prizes ---------- */
export async function loadBoard() {
  const { state } = X, ids = (state.raw?.profiles || []).map(p => p.id);
  if (state.demo) {
    // Sample scores from each sample client's week, so the panel can be tried.
    board.scores = state.cards.map(c => ({ client_id: c.id, week: weekKey(Date.now()), score: Math.min(100, c.daysTrained * 14 + Math.round((c.form || 60) / 5)) }));
    board.rewards = []; board.prizes = JSON.parse(localStorage.getItem('qk_demo_prizes') || 'null');
  } else {
    const from = weekKey(Date.now() - 62 * D);
    [board.scores, board.rewards] = await Promise.all([X.cloud.scores(ids, from).catch(() => []), X.cloud.rewards(`${monthKey()}-01`).catch(() => [])]);
    board.prizes = (await X.cloud.me().catch(() => null))?.prizes || null;
  }
  ['1', '2', '3'].forEach(k => ($(`#cbPrize${k}`).value = board.prizes?.[k] || ''));
  renderBoard();
}
const weekRows = () => ranked(board.scores.filter(s => s.week === weekKey(Date.now())).map(s => ({ ...s })));
function renderBoard() {
  document.querySelectorAll('[data-cbrange]').forEach(b => b.classList.toggle('on', b.dataset.cbrange === board.range));
  const P = new Map((X.state.raw?.profiles || []).map(p => [p.id, p]));
  const rows = board.range === 'week' ? weekRows() : monthTotals(board.scores, monthKey());
  const won = new Map(board.rewards.map(r => [r.client_id, r]));
  $('#cbList').innerHTML = rows.length ? rows.slice(0, 30).map(r => {
    const p = P.get(r.client_id) || {}, nick = displayName(p), w = won.get(r.client_id);
    const act = board.range === 'month' && r.rank <= 3 ? (w ? `<span class="cb-won">${w.given_at ? 'Given ✓' : 'Recorded'}</span>` : `<button type="button" class="ghost small" data-award="${esc(r.client_id)}" data-place="${r.rank}">Record ${medal(r.rank)}</button>`) : '';
    return `<div class="b-row"><span class="b-rank">${medal(r.rank)}</span><span class="b-name">${esc(p.name || 'Client')}${nick !== p.name ? ` <span class="muted small">as ${esc(nick)}</span>` : ''}</span><b>${r.score}</b>${act}</div>`;
  }).join('') : '<p class="empty">No scores yet. Clients\' apps send their score when they sync.</p>';
}
async function savePrizes() {
  const prizes = Object.fromEntries(['1', '2', '3'].map(k => [k, $(`#cbPrize${k}`).value.trim().slice(0, 80)]).filter(([, v]) => v));
  try {
    if (X.state.demo) localStorage.setItem('qk_demo_prizes', JSON.stringify(prizes)); else await X.cloud.setPrizes(prizes);
    board.prizes = prizes; X.toast('Prizes saved. Clients see them on their leaderboard.');
  } catch (e) { X.toast(`Not saved: ${e.message}`); }
}
async function award(clientId, place) {
  const prize = board.prizes?.[String(place)] || '';
  try {
    const row = { client_id: clientId, month: `${monthKey()}-01`, place, prize };
    if (!X.state.demo) await X.cloud.setReward(row);
    board.rewards = [...board.rewards.filter(r => r.client_id !== clientId), row];
    X.toast(`Recorded. Their app will celebrate ${medal(place)}${prize ? ` and show "${prize}"` : ''}.`); renderBoard();
  } catch (e) { X.toast(`Not recorded: ${e.message}`); }
}
