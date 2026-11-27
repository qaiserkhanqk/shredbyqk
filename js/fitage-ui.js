// Fitness Age screen: three inputs (waist, resting heart rate, activity), one big number, what would make you younger.
// Maths and sources: fitnessage.js and SCIENCE.md "Fitness Age".
import * as FA from './fitnessage.js';
import { measureCamera } from './vitals.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAY = 864e5, WEEK = 7 * DAY;
let ctx; // { S, persist, toast, say, onChange }
let activeOverride = null; // null = from the log

/** Training days per week for the last 4 full weeks (only weeks since they started). */
export function weeksFromLog(sessions = [], now = Date.now()) {
  if (!sessions.length) return [];
  const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // this Monday
  const first = Math.min(...sessions.map(s => s.at)), out = [];
  for (let k = 4; k >= 1; k--) {
    const a = d.getTime() - k * WEEK, b = a + WEEK;
    if (b <= first) continue;
    out.push(new Set(sessions.filter(s => s.at >= a && s.at < b).map(s => new Date(s.at).toDateString())).size);
  }
  return out;
}

/** Best resting heart rate from the last 30 days: the lowest camera reading (resting is the lowest you sit at). */
export function restingFromVitals(vitals = [], now = Date.now()) {
  const r = vitals.filter(v => v.bpm && now - v.at < 30 * DAY).map(v => Math.round(v.bpm));
  return r.length ? Math.min(...r) : null;
}

function inputs() {
  const { S } = ctx, p = S.profile || {}, last = (S.fitage || []).slice(-1)[0];
  const waist = parseFloat($('#faWaist').value) || null;
  const rhr = parseFloat($('#faRhr').value) || null;
  const fromLog = FA.meetsGuideline({ weeks: weeksFromLog(S.sessions || []), minsPerSession: Math.max(30, S.timeCap || 50) });
  const active = activeOverride ?? fromLog ?? last?.active ?? null;
  return { sex: p.sex, age: p.age ? +p.age : null, waistCm: waist, rhr, active, fromLog };
}

export function initFitAge(c) {
  ctx = c; ctx.S.fitage ||= [];
  $('#faRhrBtn').onclick = async () => { const r = await measureCamera({ mode: 'hr', title: 'Resting heart rate: sit still for a minute first' }); if (r?.bpm) { ctx.S.vitals.push({ at: Date.now(), kind: 'hr', bpm: r.bpm, source: 'camera' }); ctx.persist(); $('#faRhr').value = Math.round(r.bpm); drawActivity(); } };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-faact]'); if (!b) return;
    activeOverride = b.dataset.faact === 'yes'; drawActivity();
  });
  $('#faGo').onclick = calculate;
  $('#faExtraSave').onclick = saveExtra;
}

function drawActivity() {
  const i = inputs();
  document.querySelectorAll('[data-faact]').forEach(b => b.classList.toggle('on', i.active === (b.dataset.faact === 'yes')));
  $('#faActNote').textContent = activeOverride !== null ? 'Your answer.' : i.fromLog === null ? 'Not enough training logged yet to tell. Pick one.' : `From your training log: ${i.fromLog ? 'yes' : 'not yet'}. Tap to change.`;
}

export function renderFitAge() {
  if (!ctx) return;
  const { S } = ctx, p = S.profile || {}, last = S.fitage.slice(-1)[0];
  activeOverride = null;
  if (!$('#faWaist').value) $('#faWaist').value = last?.waist || S.profile.waistCm || '';
  $('#faRhr').value = restingFromVitals(S.vitals, Date.now()) || last?.rhr || '';
  $('#faNeed').hidden = !!(p.age && p.sex);
  $('#faPushWrap').hidden = p.sex === 'female';
  drawActivity();
  if (last) show(last); else $('#faResult').hidden = true;
  renderHistory();
}

function calculate() {
  const i = inputs(), miss = FA.missing(i);
  if (i.active === null) miss.push('activity');
  if (miss.length) {
    const words = { sex: 'your sex', age: 'your age (Today → Profile)', waist: 'your waist in cm', rhr: 'your resting heart rate', activity: 'whether you are active' };
    ctx.toast(`Add ${miss.map(m => words[m]).join(', ')} first.`); return;
  }
  const r = FA.fitnessAge(i), prev = ctx.S.fitage.slice(-1)[0];
  const test = { at: Date.now(), ...r, age: i.age, sex: i.sex, waist: i.waistCm, rhr: i.rhr, active: i.active };
  ctx.S.fitage.push(test); ctx.S.profile.waistCm = i.waistCm; ctx.persist();
  show(test, prev); renderHistory(); ctx.onChange?.();
  const d = r.diff;
  ctx.say(d < 0 ? `Your fitness age is ${r.fitnessAge}. That's ${-d} years younger than you are.` : d > 0 ? `Your fitness age is ${r.fitnessAge}. We can bring that down. Here's how.` : `Your fitness age is ${r.fitnessAge}, right on your age. Let's get it lower.`, { priority: 'high' });
}

function show(t, prev) {
  const d = t.fitnessAge - t.age, box = $('#faResult'); box.hidden = false;
  const line = d < 0 ? `${-d} year${d === -1 ? '' : 's'} younger than your age` : d > 0 ? `${d} year${d === 1 ? '' : 's'} older than your age` : 'Right on your age';
  const change = prev ? (prev.fitnessAge - t.fitnessAge) : 0;
  const L = FA.levers({ sex: t.sex, age: t.age, waistCm: t.waist, rhr: t.rhr, active: t.active });
  box.innerHTML = `<div class="fa-big"><span class="num">${t.fitnessAge}</span><span><b>${line}</b><br><span class="muted small">Fitness ${t.vo2} mL/kg/min · ${t.pct}% of the average for ${t.age}${change ? ` · ${change > 0 ? '−' : '+'}${Math.abs(change)} since last test` : ''}</span></span></div>
    ${L.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">What would make you younger</span>${L.map(l => `<div class="fa-lever"><span>${esc(l.text)}</span><b>−${l.years} yr${l.years > 1 ? 's' : ''}</b></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">You\'re doing all the big things. Keep training and retest next month.</p>'}
    <p class="muted small" style="margin:0">Retest in a month: same time of day, resting heart rate measured sitting.</p>`;
}

function renderHistory() {
  const T = ctx.S.fitage, el = $('#faHistory');
  el.hidden = T.length < 2; if (T.length < 2) return;
  const W = 300, H = 70, ages = T.map(t => t.fitnessAge), lo = Math.min(...ages) - 2, hi = Math.max(...ages) + 2;
  const x = i => 10 + i * (W - 20) / (T.length - 1), y = a => 8 + (a - lo) / (hi - lo) * (H - 16);
  el.innerHTML = `<span class="eyebrow">Your Fitness Age over time</span><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fitness age trend"><polyline fill="none" stroke="var(--z2)" stroke-width="2.5" points="${T.map((t, i) => `${x(i)},${y(t.fitnessAge)}`).join(' ')}"/>${T.map((t, i) => `<circle cx="${x(i)}" cy="${y(t.fitnessAge)}" r="3.5" fill="var(--z2)"/>`).join('')}</svg>
    <p class="muted small" style="margin:0">${T.map(t => `${new Date(t.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${t.fitnessAge}`).join(' · ')}</p>`;
}

function saveExtra() {
  const n = $('#faPush').value === '' ? null : +$('#faPush').value, s = $('#faSit').value === '' ? null : +$('#faSit').value;
  const rhr = parseFloat($('#faRhr').value) || null;
  const notes = [FA.rhrNote(rhr), ctx.S.profile.sex !== 'female' ? FA.pushupNote(n) : null, FA.sitRiseNote(s)].filter(Boolean);
  if (!notes.length) { ctx.toast('Add a push-up count or a sit-and-rise score.'); return; }
  const T = ctx.S.fitage, last = T[T.length - 1];
  if (last && Date.now() - last.at < 7 * DAY) Object.assign(last, { pushups: n ?? last.pushups, sitRise: s ?? last.sitRise });
  ctx.persist();
  $('#faExtraOut').innerHTML = notes.map(n => `<p class="fa-note ${n.level}" style="margin:0">${esc(n.text)}</p>`).join('');
}
