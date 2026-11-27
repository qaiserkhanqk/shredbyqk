// Leaderboard screen: this week's (or month's) board, your score and how to earn more, prizes, nickname.
// Scoring: leaderboard.js. Ranking happens on the server (supabase/schema.sql leaderboard()), names only.
import { weekScore, weekKey, MAX, displayName, gapLine, pointsPerDay } from './leaderboard.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ctx; // { S, persist, toast, cloud: () => Cloud|null, sync: () => Promise }
let range = 'month'; // the prize board; points never drop to zero on a Monday
const LABEL = { train: 'Training', fitness: 'Fitness Age', recovery: 'Recovery', sleep: 'Sleep', mind: 'Stress & mind' };
const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);

export function initBoard(c) {
  ctx = c;
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-brange]'); if (!r) return;
    range = r.dataset.brange; renderBoard();
  });
  $('#bNick').onchange = e => { ctx.S.profile.nickname = e.target.value.trim().slice(0, 24); ctx.persist(); ctx.sync?.(); renderBoard(); };
  $('#bHide').onchange = e => { ctx.S.profile.boardHidden = e.target.checked; ctx.persist(); ctx.sync?.(); renderBoard(); };
}

/** The small card on Progress: this week's points and rank. */
export function renderBoardCard() {
  if (!ctx) return;
  const me = weekScore(ctx.S), r = ctx.S.board?.month;
  $('#boardCardScore').textContent = me.score;
  $('#boardCardRank').textContent = r?.rank ? `${medal(r.rank)} of ${r.players} this month${r.gap ? ` · ${r.gap}` : ''}` : connected() ? 'Your rank updates when you sync' : 'Join to see your rank';
}
const connected = () => !!(ctx.cloud() && ctx.S.cloud?.coach);

export async function renderBoard() {
  if (!ctx) return;
  const S = ctx.S, me = weekScore(S);
  $$('[data-brange]').forEach(b => b.classList.toggle('on', b.dataset.brange === range));
  $('#bNick').value = S.profile.nickname || ''; $('#bNick').placeholder = displayName({ name: S.profile.name });
  $('#bHide').checked = !!S.profile.boardHidden;
  $('#bMine').innerHTML = `<div class="fa-big"><span class="num">${me.score}</span><span><b>points this week</b><br><span class="muted small">out of 100 · resets every Monday</span></span></div>
    <div class="b-parts">${Object.entries(me.parts).map(([k, v]) => `<div><span>${LABEL[k]}</span><div class="bar"><i style="width:${Math.round(v / MAX[k] * 100)}%"></i></div><b>${v}/${MAX[k]}</b></div>`).join('')}</div>
    ${me.tips.length ? `<div class="stack" style="gap:4px"><span class="eyebrow">Earn more this week</span>${me.tips.map(t => `<div class="fa-lever"><span>${esc(t.text)}</span><b>+${t.pts}</b></div>`).join('')}</div>` : ''}`;
  const list = $('#bList');
  if (!connected()) { list.innerHTML = '<p class="muted small" style="margin:0">Connect to your coach (Today → Profile → Your coach) to join the leaderboard. Your score is counted here already.</p>'; $('#bPrizes').hidden = true; return; }
  list.innerHTML = '<p class="muted small" style="margin:0">Loading…</p>';
  try {
    await ctx.sync?.();
    const cloud = ctx.cloud(), rows = await cloud.leaderboard(weekKey(Date.now()), range === 'month' ? 1 : 0);
    const mine = rows.find(r => r.me);
    const gap = gapLine(rows, { unit: range === 'month' ? 'points a week' : 'points', perDay: pointsPerDay(S) });
    (S.board ||= {})[range] = mine ? { rank: mine.rank, players: mine.players, gap: mine.rank > 1 && gap ? gap.split('.')[0] : '', at: Date.now() } : null; ctx.persist();
    const top = rows.filter(r => r.rank <= 50);
    list.innerHTML = rows.length ? `${gap ? `<p class="b-gap-line">${esc(gap)}</p>` : ''}${top.map(r => row(r, range === 'week')).join('')}${mine && mine.rank > 50 ? `<div class="b-gap">…</div>${row(mine, false)}` : ''}
      <p class="muted small" style="margin:6px 0 0">${rows[0].players} people on the board${mine ? ` · you're ${medal(mine.rank)}` : ''}${range === 'month' ? ' · average points a week, counted from your first week' : ' · the weekly race restarts Monday; your month keeps its points'}</p>` : '<p class="muted small" style="margin:0">No scores yet this week. Be the first.</p>';
    const pr = await cloud.prizes().catch(() => null);
    $('#bPrizes').hidden = !pr || !(pr['1'] || pr['2'] || pr['3']);
    if (pr) $('#bPrizes').innerHTML = `<span class="eyebrow">This month's prizes</span>${['1', '2', '3'].filter(k => pr[k]).map(k => `<div class="fa-lever"><span>${medal(+k)} ${esc(pr[k])}</span></div>`).join('')}<p class="muted small" style="margin:0">Top 3 on the monthly board at the end of the month.</p>`;
    renderBoardCard();
  } catch (e) { list.innerHTML = `<p class="muted small" style="margin:0">Couldn't load the board (${esc(e.message)}). Pull to refresh later.</p>`; }
}
const row = (r, week) => `<div class="b-row ${r.me ? 'me' : ''}"><span class="b-rank">${medal(r.rank)}</span><span class="b-name">${esc(r.name)}${r.me ? ' (you)' : ''}${week && r.rank === 1 ? ' <span class="b-mvp">MVP</span>' : ''}</span><b>${r.score}</b></div>`;
const $$ = s => [...document.querySelectorAll(s)];
