// Coach dashboard extras: broadcast a notification to everyone (or a group), and the leaderboard with monthly prizes.
import { AUDIENCES, AWAY, awayText, audienceOf, BROADCAST_TEMPLATES, BROADCAST_MAX, fill } from './dash.js';
import { weekKey, monthTotals, ranked, displayName } from './leaderboard.js';
import { accuracy, needsTuning } from './accuracy.js';
import { WRONG as RULE_NAMES } from './exercises.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const D = 864e5;
let X; // { state, cloud, toast }
let board = { range: 'month', scores: [], rewards: [] };
let unticked = new Set(); // clients the coach unticked from the current list
const monthKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);

export function initCoachExtra(x) {
  X = x;
  $('#bcAud').innerHTML = AUDIENCES.map(a => `<option value="${a.id}">${esc(a.label)}</option>`).join('');
  $('#bcAway').innerHTML = AWAY.map(([d, l]) => `<option value="${d}" ${d === 7 ? 'selected' : ''}>${esc(l)} or more</option>`).join('');
  ['#bcAud', '#bcAway'].forEach(id => $(id).addEventListener('change', () => { unticked = new Set(); preview(); }));
  $('#bcWho').addEventListener('change', e => {
    const b = e.target.closest('[data-bcwho]'); if (!b) return;
    if (b.dataset.bcwho === '*') { unticked = b.checked ? new Set() : new Set(listed().map(c => c.id)); } else (b.checked ? unticked.delete(b.dataset.bcwho) : unticked.add(b.dataset.bcwho));
    preview();
  });
  $('#bcTpl').innerHTML = BROADCAST_TEMPLATES.map((t, i) => `<button type="button" class="chip" data-bctpl="${i}">${esc(t.title)}</button>`).join('');
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-bctpl]');
    if (t) { const tp = BROADCAST_TEMPLATES[+t.dataset.bctpl]; $('#bcTitle').value = tp.title; $('#bcBody').value = tp.body; preview(); }
    if (e.target.closest('#cbMvp')) {
      const [n, sc] = $('#cbMvp').dataset.mvp.split('|');
      $('#bcTitle').value = 'Weekly MVP 🏆'; $('#bcBody').value = `This week's MVP is ${n} with ${sc} points! Can you take it next week, {name}?`;
      $('#bcAud').value = 'all'; $('#bcAud').dispatchEvent(new Event('change')); $('#cdBroadcast').scrollIntoView({ behavior: 'smooth' }); X.toast('MVP shout-out ready. Check it and press Send.');
    }
    const r = e.target.closest('[data-cbrange]');
    if (r) { board.range = r.dataset.cbrange; renderBoard(); }
    const w = e.target.closest('[data-award]');
    if (w) award(w.dataset.award, +w.dataset.place);
  });
  ['#bcTitle', '#bcBody'].forEach(id => $(id).addEventListener('input', preview));
  $('#bcSend').onclick = send;
  $('#cbSavePrizes').onclick = savePrizes;
}

/* ---------- Broadcast ---------- */
// Everyone matching the chosen group (with how long they've been away); targets() = the ones still ticked.
function listed() {
  const { state } = X, P = state.raw?.profiles || [], clients = P.map(p => ({ id: p.id, name: p.name }));
  const day = d => (d ? Date.parse(d) : 0);
  // Last training: sets from the last 70 days, else the profile's last_train (covers people away for months).
  const lastTrain = new Map(P.map(p => [p.id, day(p.last_train)]).filter(([, t]) => t));
  for (const s of state.raw?.sets || []) lastTrain.set(s.client_id, Math.max(lastTrain.get(s.client_id) || 0, s.at));
  const lastOpen = new Map(state.cards.filter(c => c.lastSeen).map(c => [c.id, c.lastSeen]));
  const top = new Set(weekRows().slice(0, 10).map(r => r.client_id));
  return audienceOf(clients, $('#bcAud').value, { lastTrain, lastOpen, top, away: +$('#bcAway').value });
}
const ago = d => { const t = awayText(d); return t === 'never' || t === 'today' ? t : `${t} ago`; };
const targets = () => listed().filter(c => !unticked.has(c.id));
function drawWho(list) {
  const aud = $('#bcAud').value, away = aud === 'notrain' || aud === 'noopen';
  $('#bcAwayWrap').hidden = !away;
  $('#bcWho').innerHTML = list.length ? `<label class="check bc-all"><input type="checkbox" data-bcwho="*" ${unticked.size ? '' : 'checked'}> <b>Select all (${list.length})</b></label>
    <div class="bc-who">${list.map(c => `<label class="check"><input type="checkbox" data-bcwho="${esc(c.id)}" ${unticked.has(c.id) ? '' : 'checked'}> <span>${esc(c.name || 'Client')}</span><span class="muted small">trained ${ago(c.trainDays)} · opened ${ago(c.openDays)}</span></label>`).join('')}</div>`
    : `<p class="muted small" style="margin:0">${away ? 'Nobody has been away that long. 🎉' : 'Nobody in this group right now.'}</p>`;
}
function preview() {
  const all = listed(), t = all.filter(c => !unticked.has(c.id)), body = $('#bcBody').value.trim(), title = $('#bcTitle').value.trim();
  drawWho(all);
  $('#bcCount').textContent = `${t.length} of ${all.length} selected`;
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
    $('#bcBody').value = ''; $('#bcTitle').value = ''; unticked = new Set(); preview();
  } catch (e) { X.toast(`Not sent: ${e.message}`); }
}

/* ---------- Leaderboard and prizes ---------- */
export async function loadAccuracy() {
  const { state } = X, ids = (state.raw?.profiles || []).map(p => p.id);
  let labels = [];
  if (state.demo) { try { labels = JSON.parse(localStorage.getItem('shred_qk_v1') || '{}').labels || []; } catch {} }
  else labels = (await X.cloud.labels(ids, new Date(Date.now() - 90 * D).toISOString()).catch(() => [])).map(l => ({ ...l, at: Date.parse(l.at) }));
  const a = accuracy(labels), el = $('#accBody');
  if (!a) { el.innerHTML = '<p class="empty">No answers yet. After each camera set clients see "Was QK right?". Do a few sets yourself to start.</p>'; return; }
  const tune = needsTuning(a), name = id => RULE_NAMES?.[id] || id;
  el.innerHTML = `<div class="cd-stats">
      <div class="cd-stat good"><b>${a.countExact ?? '–'}%</b><span>rep counts exactly right</span></div>
      <div class="cd-stat"><b>${a.countWithin1 ?? '–'}%</b><span>within 1 rep</span></div>
      <div class="cd-stat ${a.cueRight >= 80 ? 'good' : 'warn'}"><b>${a.cueRight ?? '–'}%</b><span>cues confirmed</span></div>
      <div class="cd-stat"><b>${a.sets}</b><span>sets answered</span></div></div>
    ${tune.length ? `<p style="margin:6px 0 0"><b>Retune:</b> ${tune.map(c => `${esc(name(c.id))} (called wrong ${c.wrongPct}% of ${c.n})`).join(' · ')}</p>` : '<p class="muted small" style="margin:6px 0 0">No cue is being called wrong often (needs 5+ answers each).</p>'}
    ${a.byExercise.length ? `<p class="muted small" style="margin:4px 0 0">Counting by exercise: ${a.byExercise.slice(0, 6).map(e => `${esc(e.ex)} ${e.exactPct}% (${e.n})`).join(' · ')}</p>` : ''}
    ${a.unclearShare ? `<p class="muted small" style="margin:4px 0 0">${a.unclearShare}% of sets had reps QK couldn't see clearly (not judged). Better phone placement fixes these.</p>` : ''}`;
}
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
  const rows = board.range === 'week' ? weekRows() : monthTotals(board.scores, monthKey(), { asOf: weekKey(Date.now()) });
  const mvp = board.range === 'week' && rows[0] ? P.get(rows[0].client_id) : null;
  $('#cbMvp').hidden = !mvp; if (mvp) $('#cbMvp').dataset.mvp = `${displayName(mvp)}|${rows[0].score}`;
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
