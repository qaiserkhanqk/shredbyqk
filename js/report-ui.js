// Weekly report screen: last week (or any saved week) in one place. Wins, training and kg lifted, health scores,
// sleep and mind, food, Fitness Age, leaderboard points, then one focus. Trend bars from the saved snapshots.
import { buildReport, lastWeekStart, history, fmtKg, saveWeek } from './report.js';
import { weekStart } from './leaderboard.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAY = 864e5;
let ctx; // { S, persist, lib, say }
let which = 'last';

export function initReport(c) {
  ctx = c;
  document.addEventListener('click', e => { const b = e.target.closest('[data-rweek]'); if (b) { which = b.dataset.rweek; renderReport(); } });
}
/** Monday job: save last week's snapshot. Returns true when a new report is ready (for the "QK remembers" card). */
export function weeklyTick(now = Date.now()) { const r = saveWeek(ctx.S, now, { lib: ctx.lib }); if (r) { ctx.persist(); return true; } return false; }

const band = v => (v == null ? 'none' : v >= 75 ? 'good' : v >= 50 ? 'mid' : 'low');
const word = v => (v == null ? '–' : v);
const sleepWord = q => (q == null ? null : q <= 2.5 ? 'Great' : q <= 4 ? 'OK' : 'Rough');

export function renderReport() {
  if (!ctx) return;
  const S = ctx.S, ws = which === 'this' ? weekStart(Date.now()) : lastWeekStart();
  const r = buildReport(S, ws, { lib: ctx.lib });
  const d = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  document.querySelectorAll('[data-rweek]').forEach(b => b.classList.toggle('on', b.dataset.rweek === which));
  $('#rpRange').textContent = `${d(r.from)} – ${d(r.to)}${which === 'this' ? ' (so far)' : ''}`;
  const T = r.training, H = r.health, M = r.mind;
  const tile = (name, v, sub = '') => `<div class="rp-tile ${band(v)}"><span class="sc-name">${name}</span><b class="num">${word(v)}</b>${sub ? `<span class="small muted">${esc(sub)}</span>` : ''}</div>`;
  const hist = history(S, 8);
  const maxKg = Math.max(1, ...hist.map(h => h.kg));
  $('#rpBody').innerHTML = `
    <div class="card stack rp-wins"><span class="eyebrow">Wins</span>${r.wins.map(w => `<p class="rp-win">✓ ${esc(w)}</p>`).join('')}</div>
    <div class="card stack"><span class="eyebrow">Training</span>
      <div class="done-stats">
        <div><b class="num">${T.days}/${T.planned}</b><span>days</span></div>
        <div><b class="num">${T.kg >= 10000 ? (T.kg / 1000).toFixed(1) + 't' : T.kg.toLocaleString()}</b><span>${T.kg >= 10000 ? 'tonnes' : 'kg'} lifted</span></div>
        <div><b class="num">${T.sets}</b><span>sets</span></div>
        ${T.form != null ? `<div><b class="num">${T.form}%</b><span>clean form</span></div>` : `<div><b class="num">${T.reps}</b><span>reps</span></div>`}
      </div>
      ${T.equivalent ? `<p class="done-eq" style="margin:0">That's about ${esc(T.equivalent.text)}.</p>` : ''}
      ${T.prs.length ? `<div class="done-prs">${T.prs.map(p => `<div class="done-pr"><span class="m">🥇</span><span><b>${esc(p.name)}</b><br><span class="small">${esc(p.text)}</span></span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card stack"><span class="eyebrow">Your health</span>
      <div class="rp-grid">${tile('Health', H.health)}${tile('Recovery', H.recovery)}${tile('Nutrition', H.nutrition)}${tile('Workouts', H.workout)}${tile('Activity', H.activity)}
        ${r.fitness ? `<div class="rp-tile ${r.fitness.fitnessAge <= r.fitness.age ? 'good' : 'mid'}"><span class="sc-name">Fitness Age</span><b class="num">${r.fitness.fitnessAge}</b><span class="small muted">you're ${r.fitness.age}</span></div>` : ''}</div>
    </div>
    <div class="card stack"><span class="eyebrow">Sleep & mind</span>
      <div class="done-stats">
        <div><b class="num">${sleepWord(M.sleep) || '–'}</b><span>sleep${M.sleepH ? ` · ${M.sleepH.toFixed(1)} h` : ''}</span></div>
        <div><b class="num">${M.stress == null ? '–' : M.stress <= 3 ? 'Low' : M.stress <= 4.5 ? 'Some' : 'High'}</b><span>stress</span></div>
        <div><b class="num">${M.calm}</b><span>calm sessions</span></div>
        <div><b class="num">${M.checkDays}/7</b><span>mornings checked</span></div>
      </div>
      ${M.checkDays < 3 ? '<p class="muted small" style="margin:0">Answer "How do you feel?" on Today each morning and this section fills in.</p>' : ''}
    </div>
    ${r.food ? `<div class="card stack"><span class="eyebrow">Food</span><p style="margin:0">${r.food.enough ? esc(r.food.wins[0] || `${r.food.logged} days logged.`) : `${r.food.logged} full day${r.food.logged === 1 ? '' : 's'} logged. Log a few more and QK reads your week.`}</p>${r.food.protein && r.food.target ? `<p class="muted small" style="margin:0">Protein ${Math.round(r.food.protein)} g a day (target ${r.food.target.protein} g)</p>` : ''}</div>` : ''}
    <div class="card stack rp-focus"><span class="eyebrow">Next week, one thing</span><p style="margin:0"><b>${esc(r.focus)}</b></p></div>
    <div class="card stack"><span class="eyebrow">Leaderboard</span><p style="margin:0"><b>${r.board.score}</b> points that week. <button type="button" class="linkbtn" data-go="board">See the board</button></p></div>
    ${hist.length >= 2 ? `<div class="card stack"><span class="eyebrow">Weight lifted, week by week</span><div class="rp-bars">${hist.map(h => `<div title="${esc(h.week)}: ${fmtKg(h.kg)}"><i style="height:${Math.max(3, Math.round(h.kg / maxKg * 100))}%"></i><span>${+h.week.slice(8, 10)}/${+h.week.slice(5, 7)}</span></div>`).join('')}</div>
      <p class="muted small" style="margin:0">${fmtKg(hist.reduce((a, h) => a + h.kg, 0))} over ${hist.length} weeks · ${hist.reduce((a, h) => a + h.days, 0)} training days</p></div>` : ''}`;
}
