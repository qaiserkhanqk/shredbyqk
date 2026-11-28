// "Workout complete": the moment right after the last set. Total kg (counting up), a fun comparison, personal bests
// with medals, milestones, clean-rep progress, and how today compares with last time. Confetti only for something
// real (a personal best or a milestone), so it keeps meaning something. Maths: volume.js.
import { workoutSummary, rollup, milestones, dayKey } from './volume.js';
import { fmtKg } from './report.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ctx; // { S, persist, say, lib, rewardsLine: () => string|null, unit: () => 'kg'|'lb', toUnit }

export function initDone(c) {
  ctx = c;
  $('#doneClose').onclick = () => close();
  $('#doneShare').onclick = share;
}
let after = null, last = null;
function close() { $('#done').hidden = true; document.body.classList.remove('no-scroll'); const f = after; after = null; f?.(); }

/** Today's summary. Saves it once a day in S.workouts (small: one row per workout). */
export function todaySummary(S, now = Date.now()) {
  const today = dayKey(now), all = (S.sessions || []).filter(s => !s.demo);
  const sets = all.filter(s => dayKey(s.at) === today), history = all.filter(s => dayKey(s.at) < today);
  if (!sets.length) return null;
  const T = rollup(S), workoutsBefore = Math.max(0, T.workouts - 1);
  const w = workoutSummary(sets, history, { lib: ctx?.lib || {}, workoutsBefore });
  const ms = milestones({ workouts: workoutsBefore, kg: T.kg - w.kg }, { workouts: T.workouts, kg: T.kg });
  return { ...w, milestones: ms, lifetimeKg: Math.round(T.kg), weekKg: Math.round(T.weeks[Object.keys(T.weeks).sort().pop()]?.kg || 0) };
}

/** Show the screen. then: what happens after "Continue" (the cool-down offer). */
export function showDone({ then, replay = false } = {}) {
  const S = ctx.S, w = todaySummary(S);
  if (!w) { then?.(); return false; }
  after = then; last = w;
  if (!replay) {
    S.workouts ||= [];
    const row = { at: Date.now(), day: dayKey(Date.now()), kg: w.kg, sets: w.sets, reps: w.reps, prs: w.prs.length, minutes: w.minutes, number: w.number };
    const i = S.workouts.findIndex(x => x.day === row.day); if (i >= 0) S.workouts[i] = row; else S.workouts.push(row);
    ctx.persist();
  }
  const u = ctx.unit(), kgTxt = v => `${Math.round(ctx.toUnit(v, u)).toLocaleString()}`;
  const big = w.prs.length || w.milestones.length;
  const title = w.milestones.find(m => m.kind === 'workouts')?.text || (w.prs.length ? `${w.prs.length} new personal best${w.prs.length > 1 ? 's' : ''}!` : ['Workout complete', 'Session smashed', 'Done and dusted', 'That\'s the work'][w.number % 4]);
  const medal = p => (p.kind === 'weight' ? '🥇' : p.kind === 'e1rm' ? '💪' : '🔁');
  const reward = ctx.rewardsLine?.();
  $('#doneBody').innerHTML = `
    <span class="eyebrow">Workout #${w.number}${w.minutes ? ` · ${w.minutes} min` : ''}</span>
    <h1 class="display h1 done-title">${esc(title)}</h1>
    ${w.kg > 0 ? `<div class="done-kg"><span class="num" id="doneKg" data-to="${Math.round(ctx.toUnit(w.kg, u))}">0</span><span>${u} lifted today</span></div>
      ${w.equivalent ? `<p class="done-eq">That's about ${esc(w.equivalent.text)} 🚗</p>` : ''}` : `<div class="done-kg"><span class="num">${w.reps}</span><span>reps today</span></div>`}
    <div class="done-stats">
      <div><b class="num">${w.sets}</b><span>sets</span></div>
      <div><b class="num">${w.reps}</b><span>reps</span></div>
      ${w.form != null ? `<div><b class="num">${w.form}%</b><span>clean form</span></div>` : `<div><b class="num">${w.exercises}</b><span>exercises</span></div>`}
      ${w.change != null && w.change > 0 ? `<div class="up"><b class="num">+${w.change}%</b><span>vs last time</span></div>` : ''}
    </div>
    ${w.prs.length ? `<div class="done-prs"><span class="eyebrow">Personal bests</span>${w.prs.map(p => `<div class="done-pr"><span class="m">${medal(p)}</span><span><b>${esc(p.name)}</b><br><span class="small">${esc(p.text)}${p.was ? ` (was ${p.was}${p.kind === 'reps' ? '' : ' kg'})` : ''}</span></span></div>`).join('')}</div>` : ''}
    ${w.milestones.filter(m => m.kind === 'kg').map(m => `<p class="done-ms">🏆 ${esc(m.text)}</p>`).join('')}
    ${reward ? `<p class="muted small done-next">${esc(reward)}</p>` : ''}
    <p class="muted small done-next">This week: ${kgTxt(w.weekKg)} ${u} · lifetime: ${esc(w.lifetimeKg >= 10000 ? fmtKg(w.lifetimeKg) : `${kgTxt(w.lifetimeKg)} ${u}`)}</p>`;
  $('#done').classList.toggle('big', !!big);
  $('#done').hidden = false; document.body.classList.add('no-scroll');
  if (big) confetti();
  countUp($('#doneKg'));
  const best = w.prs[0];
  ctx.say(best ? `Workout done! New personal best on ${best.name}. ${w.kg > 0 ? `${Math.round(w.kg)} kilos lifted today.` : ''}` : w.kg > 0 ? `Workout done. ${Math.round(w.kg)} kilos lifted today${w.equivalent ? `, about ${w.equivalent.text}` : ''}. Great work.` : 'Workout done. Great work.', { id: 'done_' + w.number, priority: 'high' });
  try { navigator.vibrate?.(big ? [60, 40, 60, 40, 120] : 80); } catch {}
  return true;
}

function countUp(el) {
  if (!el) return;
  const to = +el.dataset.to, t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
  const step = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('#doneConfetti'); box.innerHTML = '';
  const colors = ['var(--z1)', 'var(--z2)', 'var(--z3)', 'var(--good)', '#f2c94c'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.4}s;animation-duration:${1.6 + Math.random() * 1.2}s;transform:rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  setTimeout(() => (box.innerHTML = ''), 3400);
}
async function share() {
  const w = last; if (!w) return;
  const text = [`Workout #${w.number} done with Shred by QK 💪`, w.kg ? `${Math.round(w.kg).toLocaleString()} kg lifted${w.equivalent ? ` (about ${w.equivalent.text})` : ''}` : `${w.reps} reps`, ...w.prs.map(p => `🥇 ${p.name}: ${p.text}`)].join('\n');
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); ctx.toast?.('Copied. Paste it anywhere.'); } } catch {}
}
