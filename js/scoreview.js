// The score card on Today: health score ring, fitness age, and four scores. Tap one to see why and the one fix.
import { allScores } from './scores.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = { nutrition: 'Nutrition', recovery: 'Recovery', activity: 'Activity', workout: 'Workout' };
let open = null;

const ring = (score, cls) => {
  const C = 2 * Math.PI * 42, v = score ?? 0;
  return `<svg viewBox="0 0 100 100" class="sc-ring ${cls}" role="img" aria-label="Health score ${score ?? 'not yet'}">
    <circle cx="50" cy="50" r="42" class="trk"/><circle cx="50" cy="50" r="42" class="val" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="50" class="num">${score ?? '–'}</text><text x="50" y="67" class="lbl">/ 100</text></svg>`;
};

export function renderScores(el, S, now = Date.now()) {
  if (!el) return;
  const s = allScores(S, now), h = s.health, fa = s.fitness;
  const tile = (key, v) => `<button type="button" class="sc-tile ${v.band.id} ${open === key ? 'open' : ''}" data-score="${key}" aria-expanded="${open === key}">
      <span class="sc-name">${NAMES[key]}</span><b class="num">${v.score ?? '–'}</b><span class="sc-band">${esc(v.band.label)}</span></button>`;
  const detail = key => {
    const v = key === 'health' ? h : s[key];
    return `<div class="sc-detail ${v.band.id}"><b>${key === 'health' ? 'Health score' : NAMES[key]}: ${esc(v.band.label)}</b><p class="small">${esc(v.why)}</p><p class="small"><b>${v.score != null && v.score < 50 ? 'Fix first: ' : 'Next step: '}</b>${esc(v.fix)}</p></div>`;
  };
  const faText = fa.age != null
    ? `<b class="num">${fa.age}</b><span class="sc-band">${fa.diff <= -3 ? `${-fa.diff} years younger than you are` : fa.diff >= 3 ? `${fa.diff} years older than you are` : 'about your real age'}</span>`
    : `<b class="num">?</b><span class="sc-band">Add your ${esc(fa.missing.join(' and '))}</span>`;
  el.innerHTML = `<div class="card-head"><b>Your scores</b><span class="muted small">last 7 days</span></div>
    <div class="sc-top">
      <button type="button" class="sc-health ${h.band.id}" data-score="health" aria-expanded="${open === 'health'}">${ring(h.score, h.band.id)}<span><span class="sc-name">Health score</span><span class="sc-band">${esc(h.band.label)}</span></span></button>
      <button type="button" class="sc-fit ${fa.age == null ? 'none' : fa.diff <= 0 ? 'good' : fa.diff <= 5 ? 'mid' : 'low'}" data-score="fitness" aria-expanded="${open === 'fitness'}"><span class="sc-name">Fitness age</span>${faText}</button>
    </div>
    <div class="sc-grid">${Object.keys(NAMES).map(k => tile(k, s[k])).join('')}</div>
    ${open === 'fitness' ? `<div class="sc-detail ${fa.age == null ? 'none' : 'mid'}"><b>Fitness age</b><p class="small">${fa.age != null ? `Your fitness (VO2max ${fa.vo2}) matches the healthy average for someone aged ${fa.age}; you are ${fa.actualAge}. Built on the HUNT Study, from your age, waist, resting heart rate and how often you train.${fa.lapsed ? ' It has gone up because you have not trained for two weeks.' : ''} <button type="button" class="linkbtn" data-go="fitage">${fa.tested ? 'See your Fitness Age' : 'Do the full Fitness Age test'}</button>` : `QK needs your ${esc(fa.missing.join(' and '))}: the Fitness Age tool (Tools → Fitness Age) takes both in two minutes. <button type="button" class="linkbtn" data-go="fitage">Open it</button>`}</p><p class="small"><b>Next step: </b>${fa.age != null && fa.diff > 0 ? 'Train 3–4 times a week, walk daily, and bring your waist down: each one makes your fitness age younger.' : 'Keep training: remeasure your resting heart rate and waist every two weeks.'}</p></div>` : open ? detail(open) : ''}`;
  el.onclick = e => { const b = e.target.closest('[data-score]'); if (!b) return; open = open === b.dataset.score ? null : b.dataset.score; renderScores(el, S, now); };
}

/** One line for the coach: chips coloured by band. */
export function scoreChips(raw) {
  if (!raw || typeof raw !== 'object') return '–';
  const num = v => Number.isFinite(v) ? Math.round(v) : null;
  const sc = Object.fromEntries(['health', 'nutrition', 'recovery', 'activity', 'workout', 'fitnessAge', 'age'].map(k => [k, num(raw[k])]));
  const c = v => v == null ? 'none' : v >= 75 ? 'good' : v >= 50 ? 'mid' : 'low';
  const chip = (label, v) => `<span class="sc-chip ${c(v)}">${label} ${v ?? '–'}</span>`;
  return [chip('Health', sc.health), chip('Nutrition', sc.nutrition), chip('Recovery', sc.recovery), chip('Activity', sc.activity), chip('Workout', sc.workout),
    sc.fitnessAge != null ? `<span class="sc-chip ${sc.fitnessAge <= sc.age ? 'good' : sc.fitnessAge - sc.age <= 5 ? 'mid' : 'low'}">Fitness age ${sc.fitnessAge}${sc.age ? ` (${sc.age})` : ''}</span>` : ''].join(' ');
}
