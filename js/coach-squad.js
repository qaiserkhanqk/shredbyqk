// Coach dashboard: Squad · Biomechanics Lab. Roster by team and position, each athlete's 3D tests over time,
// squad comparison (who sits far from the squad), add athletes, export the squad's data. Maths: squad.js.
import { roster, series, compare, squadCSV, metricsFor, presetKey, demoSquad } from './squad.js';
import { PRESETS } from './lab3d.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let X, data = { athletes: [], tests: [] }, sel = null, team = '';

export function initSquad(x) {
  X = x;
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-ath]'); if (a) { sel = a.dataset.ath; render(); }
  });
  $('#sqTeam').onchange = e => { team = e.target.value; render(); };
  ['#sqPreset', '#sqMetric'].forEach(id => $(id).addEventListener('change', () => { if (id === '#sqPreset') fillMetrics(); drawDetail(); }));
  $('#sqAdd').onclick = add;
  $('#sqCsv').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([squadCSV(data.athletes, data.tests)], { type: 'text/csv' })); a.download = `squad-biomechanics-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); };
  $('#sqPreset').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join('');
  fillMetrics();
}
function fillMetrics() { $('#sqMetric').innerHTML = metricsFor($('#sqPreset').value).map(m => `<option value="${m.k}">${esc(m.name)}</option>`).join(''); }

export async function loadSquad() {
  if (X.state.demo) {
    data = demoSquad();
    // Lab tests done on this device appear as their own athletes.
    try {
      const local = JSON.parse(localStorage.getItem('shred_qk_v1') || '{}').lab || [];
      for (const s of local) { const id = 'local:' + s.athlete; if (!data.athletes.some(a => a.id === id)) data.athletes.push({ id, name: `${s.athlete} (this phone)`, team: 'This phone' }); data.tests.push({ athlete_id: id, at: s.at, preset: s.preset, cameras: s.cameras, summary: s }); }
    } catch {}
  } else {
    const [athletes, tests] = await Promise.all([X.cloud.athletes().catch(() => []), X.cloud.labTests().catch(() => [])]);
    data = { athletes, tests };
  }
  const teams = [...new Set(data.athletes.map(a => a.team).filter(Boolean))].sort();
  $('#sqTeam').innerHTML = '<option value="">All teams</option>' + teams.map(t => `<option ${t === team ? 'selected' : ''}>${esc(t)}</option>`).join('');
  render();
}

function render() {
  const list = roster(data.athletes.filter(a => !team || a.team === team), data.tests);
  $('#sqCount').textContent = `${list.length} athlete${list.length === 1 ? '' : 's'} · ${data.tests.length} 3D test${data.tests.length === 1 ? '' : 's'}`;
  $('#sqList').innerHTML = list.length ? list.map(a => `<button type="button" class="cd-row ${a.id === sel ? 'sel' : ''}" data-ath="${esc(a.id)}"><span class="cd-dot ${a.flags ? 'slipping' : 'on-track'}"></span><b>${esc(a.name)}</b>
      <span class="nums"><strong>${a.tests}</strong> tests<span>${a.flags ? `${a.flags} flag${a.flags > 1 ? 's' : ''}` : 'no flags'}</span></span>
      <span class="why">${esc([a.team, a.position].filter(Boolean).join(' · ') || '–')}${a.last ? ` · last ${new Date(a.last).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} (${esc(a.lastPreset)})` : ' · no tests yet'}</span></button>`).join('')
    : '<p class="empty">No athletes yet. Add your squad below, then run 3D Lab tests from the app on a laptop signed in as you.</p>';
  if (!sel && list[0]) sel = list[0].id;
  // Default the chart to the selected athlete's latest movement.
  const last = data.tests.filter(t => t.athlete_id === sel).sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
  if (last) { const k = presetKey(last.summary?.preset || last.preset); if ($('#sqPreset').value !== k) { $('#sqPreset').value = k; fillMetrics(); } }
  drawDetail();
}

function drawDetail() {
  const a = data.athletes.find(x => x.id === sel), box = $('#sqDetail');
  if (!a) { box.innerHTML = '<p class="empty">Pick an athlete.</p>'; return; }
  const preset = $('#sqPreset').value;
  // If this athlete has no data for the chosen measurement, switch to the first one they do have.
  if (!series(data.tests, a.id, preset, $('#sqMetric').value).length) { const m = metricsFor(preset).find(m => series(data.tests, a.id, preset, m.k).length); if (m) $('#sqMetric').value = m.k; }
  const k = $('#sqMetric').value, mName = $('#sqMetric').selectedOptions[0]?.textContent || k;
  const T = data.tests.filter(t => t.athlete_id === a.id).sort((x, y) => +new Date(y.at) - +new Date(x.at));
  const s = series(data.tests, a.id, preset, k), cmp = compare(data.athletes.filter(x => !team || x.team === team), data.tests, preset, k);
  box.innerHTML = `<div><span class="eyebrow">${esc([a.team, a.position].filter(Boolean).join(' · '))}</span><h3 class="display h2" style="margin:2px 0 0">${esc(a.name)}</h3>${a.height_cm ? `<span class="muted small">${a.height_cm} cm</span>` : ''}</div>
    ${T[0]?.summary?.flags?.length ? `<div class="stack" style="gap:6px">${T[0].summary.flags.map(f => `<p class="sq-flag">${esc(f)}</p>`).join('')}</div>` : ''}
    <div><span class="eyebrow">${esc(mName)} over time</span>${s.length ? chart(s) : '<p class="muted small" style="margin:4px 0 0">No tests of this movement yet.</p>'}</div>
    <div><span class="eyebrow">Squad comparison · ${esc(mName)}</span>${cmp.rows.length ? `<p class="muted small" style="margin:2px 0 6px">Squad average ${Math.round(cmp.mean)}° (± ${Math.round(cmp.sd)}°). Marked: more than 1.5 SD from the squad, worth a closer look.</p>
      ${cmp.rows.map(r => `<div class="sq-row ${r.id === a.id ? 'me' : ''}"><span>${esc(r.name)}${r.outlier ? ' <b class="sq-out">look</b>' : ''}</span><span class="sq-bar"><i style="width:${Math.max(4, Math.round(Math.abs(r.v) / Math.max(...cmp.rows.map(x => Math.abs(x.v)), 1) * 100))}%"></i></span><b>${Math.round(r.v)}°</b><span class="muted small">${r.change == null ? '' : `${r.change > 0 ? '+' : ''}${Math.round(r.change)}°`}</span></div>`).join('')}` : '<p class="muted small" style="margin:4px 0 0">Nobody in the squad has this movement yet.</p>'}</div>
    <div><span class="eyebrow">All tests</span>${T.map(t => `<div class="sq-row"><span>${new Date(t.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}</span><span>${esc(t.summary?.preset || t.preset)}</span><span class="muted small">${t.cameras || 2} cameras</span><span class="muted small">${t.summary?.flags?.length || 0} flags</span></div>`).join('') || '<p class="muted small">None yet.</p>'}</div>`;
}
function chart(s) {
  const W = 320, H = 90, lo = Math.min(...s.map(p => p.v)) - 3, hi = Math.max(...s.map(p => p.v)) + 3;
  const x = i => (s.length === 1 ? W / 2 : 12 + i * (W - 24) / (s.length - 1)), y = v => 8 + (1 - (v - lo) / (hi - lo || 1)) * (H - 24);
  return `<svg viewBox="0 0 ${W} ${H}" class="sq-chart" role="img" aria-label="Trend"><polyline fill="none" stroke="#2F7568" stroke-width="2.5" points="${s.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}"/>${s.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" fill="#2F7568"/><text x="${x(i)}" y="${H - 4}" font-size="9" text-anchor="middle" fill="#6E7B73">${new Date(p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text><text x="${x(i)}" y="${y(p.v) - 7}" font-size="10" text-anchor="middle" fill="#12201B">${Math.round(p.v)}°</text>`).join('')}</svg>`;
}

async function add() {
  const a = { name: $('#sqName').value.trim(), team: $('#sqTeamIn').value.trim() || null, position: $('#sqPos').value.trim() || null, height_cm: parseInt($('#sqH').value) || null };
  if (!a.name) return X.toast('Add the athlete\'s name.');
  try {
    const row = X.state.demo ? { id: 'demo:' + Date.now(), ...a } : await X.cloud.addAthlete(a);
    data.athletes.push(row); sel = row.id;
    ['#sqName', '#sqTeamIn', '#sqPos', '#sqH'].forEach(id => ($(id).value = ''));
    X.toast(`${a.name} added.${X.state.demo ? ' (Demo: not saved.)' : ' Pick them in the app\'s 3D Lab to save tests to them.'}`); render();
  } catch (e) { X.toast(`Not added: ${e.message}`); }
}
