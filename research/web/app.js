// Dashboard. Everything shown comes from the API, which applies the output policy. Recorded observations, descriptive
// summaries and EXPERIMENTAL estimates are visually separate. Controls are hidden by role for convenience only: the
// server enforces every permission.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let me = null, csrf = null, current = null, pendingPreview = null;

async function api(method, path, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(csrf && method !== 'GET' ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `http_${r.status}`), { status: r.status, body: j });
  return j;
}
const view = html => { $('#app').innerHTML = html; };
const say = (sel, msg, err = false) => { const el = $(sel); if (el) { el.textContent = msg; el.className = err ? 'error small' : 'muted small'; } };

async function boot() {
  try { const r = await api('GET', '/api/me'); me = r.user; csrf = r.csrf; return home(); }
  catch { return loginView(); }
}
function loginView(msg = '') {
  view(`<div class="card"><h1>Sign in</h1><form id="login" class="row"><input type="text" id="u" autocomplete="username" placeholder="Username" required>
    <input type="password" id="p" autocomplete="current-password" placeholder="Password" required><button type="submit">Sign in</button></form><p id="lmsg" class="small error">${esc(msg)}</p></div>${canCannot()}`);
}
async function home() {
  if (me.role === 'admin') return view(`<div class="card"><h1>Administrator</h1><p class="small">Administrators manage accounts with the API or CLI and cannot view participant data.</p><button data-act="logout">Sign out</button></div>`);
  const { participants } = await api('GET', '/api/participants');
  if (me.role === 'participant' && participants[0]) return openParticipant(participants[0].ref);
  view(`<div class="row"><h1>Participants</h1><span class="muted small">Signed in as ${esc(me.username)} (${esc(me.role)})</span><button data-act="logout">Sign out</button></div>
    <div class="card"><h2>Your assigned participants</h2>${participants.length ? `<ul class="plain">${participants.map(p => `<li><button data-act="open" data-ref="${esc(p.ref)}">${esc(p.ref)}</button></li>`).join('')}</ul>` : '<p class="muted small">None yet.</p>'}
      <h3>Add a pseudonymous participant</h3><form id="newp" class="row"><input type="text" id="nref" placeholder="Pseudonymous reference, e.g. P-0001" pattern="[A-Za-z0-9_-]{4,64}" required>
      <label class="small"><input type="checkbox" id="nadult" required> I confirm the participant is an adult (18+). Minors are not supported.</label><button type="submit">Add</button></form><p id="nmsg" class="small"></p></div>${canCannot()}`);
}

function canCannot() {
  return `<details class="card" id="cancannot" open><summary><b>What this can and cannot tell you</b></summary>
    <div class="grid"><div><h3>It can</h3><ul class="plain small"><li>Show the temperatures that were imported, with their device, site and measurement type.</li><li>Show how complete and consistent each night's data is, and why nights were excluded.</li>
      <li>Show the bleeding days that were recorded.</li><li>Describe changes relative to the person's own earlier nights.</li><li>For researchers only, with an experimental setting on: mark nights where a sustained temperature change appears under a documented, unvalidated rule.</li></ul></div>
    <div><h3>It cannot</h3><ul class="plain small"><li>Be used for contraception or to plan or avoid pregnancy.</li><li>Diagnose any condition or measure hormones.</li><li>Confirm or date ovulation. A temperature change alone does not prove it.</li>
      <li>Treat missing data as reassurance: too little data gives "insufficient data".</li><li>Turn wrist or finger skin temperature into core or oral temperature.</li></ul></div></div></details>`;
}

async function openParticipant(ref, note = '') {
  current = ref;
  const [info, a] = await Promise.all([api('GET', `/api/participants/${encodeURIComponent(ref)}`), api('GET', `/api/participants/${encodeURIComponent(ref)}/analysis`)]);
  const R = me.role === 'researcher';
  view(`<div class="row"><h1>${esc(ref)}</h1>${R ? '<button data-act="home">← Participants</button>' : ''}<button data-act="logout">Sign out</button><span id="pmsg" class="muted small">${esc(note)}</span></div>
    ${canCannot()}
    <div class="grid">
      <div class="card" id="consents"><h2>Consent</h2>${Object.entries({ core_research: 'Core research data', lh_tests: 'LH test results', hormonal_context: 'Hormonal medication context' }).map(([k, l]) => `<div class="row small"><b>${l}:</b> ${info.consents[k] ? 'given' : 'not given'}
        ${R && !info.consents[k] ? `<button data-act="signed" data-scope="${k}">Record from signed form</button>` : ''}${info.consents[k] ? `<button data-act="withdraw" data-scope="${k}">Withdraw</button>` : ''}</div>`).join('')}
        <p class="muted small">Each scope is separate. Withdrawal is recorded with its time.</p></div>
      ${R ? `<div class="card experimental" id="features"><span class="tag">Experimental · researcher only · off by default</span><h2>Experimental analysis</h2>
        ${[['experimental_shift', 'Retrospective sustained-shift rule'], ['experimental_forecast', 'Next-period forecast from logged cycle lengths']].map(([k, l]) => `<label class="row small"><input type="checkbox" data-feature="${k}" ${info.features[k] ? 'checked' : ''}> ${l}</label>`).join('')}
        <p class="muted small">Unvalidated. Results are research estimates with stated uncertainty, never clinical findings. Contraceptive or fertility-status features do not exist.</p></div>` : ''}
    </div>
    ${R ? importHTML(info) : ''}
    ${qualityHTML(a)}
    ${timelineHTML(a)}
    ${experimentalHTML(a)}
    ${provenanceHTML(a, info)}
    <div class="card" id="data"><h2>Export and delete</h2><div class="row"><a href="/api/participants/${encodeURIComponent(ref)}/export?format=json" download><button>Export JSON</button></a>
      <a href="/api/participants/${encodeURIComponent(ref)}/export?format=csv" download><button>Export CSV</button></a>
      <input type="text" id="delconfirm" placeholder="Type ${esc(ref)} to confirm"><button class="danger" data-act="delete">Delete all data for this participant</button></div>
      <p class="muted small">Exports contain sensitive data and are not encrypted. Deletion removes raw and derived records, consents and the participant's account. It cannot reach files already exported or backups made earlier.</p></div>`);
}

function importHTML(info) {
  return `<div class="card" id="import"><h2>Import (synthetic data only)</h2><div class="row"><select id="rtype"><option value="observations">Temperature observations</option><option value="annotations">Cycle annotations</option></select>
    <input type="file" id="file" accept=".csv,.json"><button data-act="preview">Preview</button><button data-act="commit" id="commitBtn" disabled>Commit import</button></div>
    <div id="pview" class="small"></div>
    <p class="muted small">${info.batches.length} batches imported, ${info.quarantineCount} rows in quarantine. Nothing is stored until you commit. Suspicious rows are kept in quarantine, not deleted.</p></div>`;
}

function qualityHTML(a) {
  const n = a.observed.nights, lv = l => n.filter(r => r.dataQuality.level === l).length;
  const rows = n.slice(-14).reverse().map(r => `<tr><td>${esc(r.night)}</td><td>${esc(r.stream.model)} · ${esc(r.stream.site)} · ${esc(r.stream.kind.replace(/_/g, ' '))} · ${esc(r.stream.derivation)}</td><td>${r.counts.valid}/${r.counts.total}</td>
    <td>${r.coverageMinutes == null ? 'unknown' : `${r.coverageMinutes} min`}</td><td>${r.features ? `${r.features.median.toFixed(2)} °C` : '—'}</td><td>${esc(r.dataQuality.level)}${r.dataQuality.reasons.length ? `<div class="muted">${esc(r.dataQuality.reasons.join(', '))}</div>` : ''}</td>
    <td>${esc([...r.flags, ...r.confounders.map(c => `annotated: ${c}`)].join(', '))}</td></tr>`).join('');
  return `<div class="card" id="quality"><span class="tag obs">Recorded observations · data quality</span><h2>Import and quality summary</h2>
    <p class="small">${n.length} night summaries: ${lv('good')} good, ${lv('limited')} limited, ${lv('insufficient')} insufficient. ${Object.entries(a.observed.unplaced).map(([k, v]) => `${v} not placed (${k.replace(/_/g, ' ')})`).join('; ') || ''}</p>
    <p class="muted small">Quality describes the measurements only, not any biological conclusion. Thresholds are engineering assumptions that need validation.</p>
    <div class="scroll"><table><thead><tr><th>Night</th><th>Stream</th><th>Valid</th><th>Coverage</th><th>Median</th><th>Quality</th><th>Flags</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">No nights yet.</td></tr>'}</tbody></table></div></div>`;
}

function timelineHTML(a) {
  const nights = a.observed.nights.filter(r => r.features), cyc = a.observed.cycles, ann = a.observed.annotations;
  if (!nights.length) return `<div class="card" id="timeline"><h2>Temperature timeline</h2><p class="muted small">No nightly data yet.</p></div>`;
  const dates = [...new Set([...nights.map(r => r.night), ...ann.map(x => x.date)])].sort(), d0 = Date.parse(dates[0]), d1 = Date.parse(dates.at(-1)) + 864e5;
  const W = 1000, H = 300, L = 46, Rr = 10, T = 14, plotH = 190, x = d => L + (Date.parse(d) - d0) / (d1 - d0) * (W - L - Rr);
  const streams = [...new Set(nights.map(r => r.streamKey))];
  const kinds = [...new Set(nights.map(r => r.stream.kind))];
  const vals = nights.map(r => r.features.median), lo = Math.min(...vals) - 0.1, hi = Math.max(...vals) + 0.1, y = v => T + (hi - v) / (hi - lo) * plotH;
  const lines = streams.map(s => { const pts = nights.filter(r => r.streamKey === s); const k = kinds.indexOf(pts[0].stream.kind) % 2;
    return `<polyline class="obs${k}" points="${pts.map(r => `${x(r.night).toFixed(1)},${y(r.features.median).toFixed(1)}`).join(' ')}"><title>${esc(s.split('|').slice(1).join(' · '))}</title></polyline>${pts.map(r => `<circle class="dot${k}" r="2" cx="${x(r.night).toFixed(1)}" cy="${y(r.features.median).toFixed(1)}"><title>${esc(r.night)}: ${r.features.median.toFixed(2)} °C (${esc(r.dataQuality.level)})</title></circle>`).join('')}`; }).join('');
  const dev = nights.filter(r => r.flags.some(f => /device_change|firmware_change/.test(f))).map(r => `<line class="device" x1="${x(r.night)}" x2="${x(r.night)}" y1="${T}" y2="${T + plotH}"><title>${esc(r.flags.join(', '))}</title></line><text x="${x(r.night) + 3}" y="${T + 10}">device/firmware change</text>`).join('');
  const bleedY = T + plotH + 14;
  const bleed = ann.filter(x => x.type === 'bleeding' && (x.value === 'period' || x.value === 'period_start')).map(b => `<rect class="bleed" x="${x(b.date)}" y="${bleedY}" width="${Math.max(2, (W - L - Rr) / ((d1 - d0) / 864e5) - 1)}" height="8"><title>Recorded bleeding ${esc(b.date)}</title></rect>`).join('')
    + ann.filter(x => x.type === 'bleeding' && x.value === 'spotting').map(b => `<circle class="spot" cx="${x(b.date)}" cy="${bleedY + 4}" r="3"><title>Recorded spotting ${esc(b.date)}</title></circle>`).join('');
  const covY = bleedY + 16, cov = nights.map(r => `<rect class="cov" x="${x(r.night)}" y="${covY}" width="${Math.max(1.5, (W - L - Rr) / ((d1 - d0) / 864e5) - 1)}" height="8" opacity="${r.dataQuality.level === 'good' ? 0.9 : r.dataQuality.level === 'limited' ? 0.45 : 0.12}"><title>${esc(r.night)} coverage ${r.coverageMinutes ?? 'unknown'} min, ${esc(r.dataQuality.level)}</title></rect>`).join('');
  const est = Array.isArray(a.estimates) ? a.estimates.filter(e => e.status === 'shift_detected') : [];
  const expY = covY + 16, exp = est.map(e => `<rect class="expband" x="${x(e.uncertainty.earliestNight)}" y="${expY}" width="${Math.max(3, x(e.uncertainty.latestNight) - x(e.uncertainty.earliestNight) + 3)}" height="14"><title>Experimental: possible start range ${esc(e.uncertainty.earliestNight)} to ${esc(e.uncertainty.latestNight)}</title></rect><line class="expmark" x1="${x(e.shiftNight)}" x2="${x(e.shiftNight)}" y1="${expY}" y2="${expY + 14}"><title>Experimental: first night of a sustained temperature shift, ${esc(e.shiftNight)}</title></line>`).join('');
  const ticks = [0, 0.5, 1].map(f => { const v = lo + (hi - lo) * f; return `<text x="2" y="${y(v) + 3}">${v.toFixed(2)}</text><line class="axis" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/>`; }).join('');
  const months = dates.filter(d => d.endsWith('-01')).map(d => `<text x="${x(d)}" y="${H - 2}">${esc(d.slice(0, 7))}</text>`).join('');
  return `<div class="card" id="timeline"><span class="tag obs">Recorded observations</span>${est.length ? ' <span class="tag">+ experimental band</span>' : ''}<h2>Temperature timeline</h2>
    <p class="legend small">${kinds.map((k, i) => `<span><i class="sw o${i % 2}"></i>${esc(k.replace(/_/g, ' '))} (nightly median, °C)</span>`).join('')}<span><i class="sw b"></i>recorded bleeding</span><span><i class="sw d"></i>device or firmware change</span>${est.length ? '<span><i class="sw e"></i>experimental sustained-shift estimate</span>' : ''}</p>
    <svg class="timeline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nightly temperature by stream, recorded bleeding and data coverage">${ticks}${lines}${dev}${bleed}<text x="2" y="${bleedY + 8}">bleeding</text>${cov}<text x="2" y="${covY + 8}">coverage</text>${est.length ? `<text x="2" y="${expY + 10}">exp.</text>${exp}` : ''}${months}</svg>
    <p class="muted small">Each device, firmware, site and measurement type is drawn separately and never averaged together. Skin temperature is not core or oral temperature.</p></div>`;
}

function experimentalHTML(a) {
  if (!Array.isArray(a.estimates) && !a.forecasts?.layer) return `<div class="card muted small" id="experimental">Experimental estimates: ${esc(a.estimates.status.replace(/_/g, ' '))} (${esc(a.estimates.reasons.join(', ').replace(/_/g, ' '))}).</div>`;
  const rows = (Array.isArray(a.estimates) ? a.estimates : []).map(e => `<tr><td>${esc(e.cycleStart)}</td><td>${esc(e.status.replace(/_/g, ' '))}</td><td>${e.status === 'shift_detected' ? `${esc(e.shiftNight)}<div class="muted">possible range ${esc(e.uncertainty.earliestNight)} to ${esc(e.uncertainty.latestNight)} (uncalibrated)</div>` : esc(e.text || '')}</td>
    <td class="muted">${esc(e.reasons.join(', '))}</td></tr>`).join('');
  const f = a.forecasts;
  return `<div class="card experimental" id="experimental"><span class="tag">Experimental research estimates · not observations · not clinical</span><h2>Retrospective sustained-shift rule</h2>
    <p class="small">A sustained shift is a change in the temperature pattern. It does not confirm or date ovulation, and absence of a shift says nothing about health.</p>
    <div class="scroll"><table><thead><tr><th>Cycle start</th><th>Result</th><th>First elevated night</th><th>Reasons</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Not enabled.</td></tr>'}</tbody></table></div>
    <h2>Next-period forecast</h2>${f?.layer ? (f.status === 'estimate' ? `<p class="small">Point: <b>${esc(f.pointDate)}</b>. Empirical range of recent cycle lengths: ${esc(f.uncertainty.rangeStart)} to ${esc(f.uncertainty.rangeEnd)}. This range is <b>not calibrated</b> and is not a likelihood statement.</p>` : `<p class="small">Insufficient data.</p>`)
      + `<p class="muted small">Reasons: ${esc(f.reasons.join(', '))}. Uses only entries recorded before ${esc(f.asOfDate)}.</p>` : '<p class="muted small">Not enabled.</p>'}</div>`;
}

function provenanceHTML(a, info) {
  const p = a.provenance;
  return `<details class="card" id="provenance"><summary><b>Processing provenance</b></summary><table class="small"><tbody>
    ${[['Pipeline', p.pipelineVersion], ['Quality', p.qualityVersion], ['Segmentation', p.segmentationVersion], ['Configuration', `${p.configVersion} (${p.configHash.slice(0, 12)}…)`], ['Data as of', p.asOf], ['Input hash', `${p.inputHash.slice(0, 16)}…`], ['Output policy', a.policyVersion]].map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}
    </tbody></table><h3>Import batches</h3><ul class="plain small">${info.batches.map(b => `<li>${esc(b.record_type)} · ${esc(b.format)} · ${b.counts.accepted} accepted, ${b.counts.duplicates} duplicates, ${b.counts.quarantined} quarantined, ${b.counts.rejected} rejected · ${esc(b.ingest_version)} · source ${esc(b.source_hash.slice(0, 12))}…</li>`).join('') || '<li class="muted">None.</li>'}</ul></details>`;
}

/* ---------- events ---------- */
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'login') {
    try { const r = await api('POST', '/api/login', { username: $('#u').value, password: $('#p').value }); me = r.user; csrf = r.csrf; home(); }
    catch (err) { loginView(err.status === 429 ? 'Too many attempts. Wait a minute.' : 'Sign-in failed.'); }
  }
  if (e.target.id === 'newp') {
    try { await api('POST', '/api/participants', { ref: $('#nref').value.trim(), adultConfirmed: $('#nadult').checked }); home(); }
    catch (err) { say('#nmsg', `Could not add: ${err.message}`, true); }
  }
});
document.addEventListener('change', async e => {
  const f = e.target.dataset?.feature; if (!f) return;
  try { await api('POST', `/api/participants/${encodeURIComponent(current)}/features`, { name: f, enabled: e.target.checked }); openParticipant(current, `${f.replace(/_/g, ' ')} ${e.target.checked ? 'on' : 'off'}`); }
  catch (err) { say('#pmsg', err.message, true); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const P = `/api/participants/${encodeURIComponent(current || '')}`;
  try {
    switch (b.dataset.act) {
      case 'logout': await api('POST', '/api/logout'); me = csrf = null; return loginView();
      case 'home': return home();
      case 'open': return openParticipant(b.dataset.ref);
      case 'signed': if (!confirm('Record that a signed consent form exists for this scope?')) return; await api('POST', `${P}/consents/record-signed`, { scope: b.dataset.scope, signedFormReference: true }); return openParticipant(current, 'Consent recorded');
      case 'withdraw': if (!confirm('Record withdrawal of this consent?')) return; await api('POST', `${P}/consents`, { scope: b.dataset.scope, granted: false }); return openParticipant(current, 'Withdrawal recorded');
      case 'preview': case 'reimport': {
        const file = $('#file').files[0]; if (!file) return say('#pview', 'Choose a file first.', true);
        if (file.size > 5 * 1024 * 1024) return say('#pview', 'File is over the 5 MB limit.', true);
        const format = /\.json$/i.test(file.name) ? 'json' : 'csv';
        // A reimport is explicit and needs a reason; the server revalidates every row under the current consent and audits it.
        const extra = b.dataset.act === 'reimport' ? { reimport: true, reason: $('#reimportReason')?.value } : {};
        const r = await api('POST', `${P}/imports/preview`, { recordType: $('#rtype').value, format, filename: file.name, content: await file.text(), ...extra }).catch(err => ({ ok: false, error: err.body?.error || err.message }));
        if (!r.ok) { pendingPreview = null; $('#commitBtn').disabled = true; return say('#pview', `Not importable: ${r.error}`, true); }
        pendingPreview = r.previewId; $('#commitBtn').disabled = !r.previewId;
        const reasons = {}; for (const q of r.quarantined) for (const x of q.reasons) reasons[x] = (reasons[x] || 0) + 1;
        $('#pview').innerHTML = r.duplicateBatch
          ? `<p>This exact file was already imported. Nothing to add.</p>${r.reimportAvailable ? `<div class="row small"><span>If consent has changed since, or records were deleted, you can explicitly reimport it. Every row is checked again under the current consent; rows already stored are skipped. This is recorded in the audit trail.</span>
            <select id="reimportReason"><option value="consent_granted_after_rejection">Consent granted after rows were rejected</option><option value="deleted_records_reimport_requested">Re-adding records that were deleted</option><option value="researcher_review">Other researcher review</option></select><button data-act="reimport">Reimport under current consent</button></div>` : ''}`
          : `${r.reimport ? '<p><b>Reimport</b> under current consent.</p>' : ''}<p>${r.counts.rows} rows: <b>${r.counts.accepted}</b> to add, ${r.counts.duplicates} duplicates, ${r.counts.quarantined} to quarantine, ${r.counts.rejected} rejected.</p>${Object.keys(reasons).length ? `<ul class="plain">${Object.entries(reasons).map(([k, v]) => `<li>${esc(k)}: ${v}</li>`).join('')}</ul>` : ''}`;
        return;
      }
      case 'commit': if (!pendingPreview) return; { const r = await api('POST', `${P}/imports/commit`, { previewId: pendingPreview }); pendingPreview = null; return openParticipant(current, r.duplicateBatch ? 'Already imported' : 'Import committed'); }
      case 'delete': {
        if ($('#delconfirm').value !== current) return say('#pmsg', 'Type the reference exactly to confirm deletion.', true);
        if (!confirm('Delete all raw and derived data for this participant? This cannot be undone.')) return;
        await api('DELETE', P, { confirmRef: current }); current = null;
        return me.role === 'participant' ? loginView('Your data was deleted.') : home();
      }
    }
  } catch (err) { say('#pmsg', `That didn't work: ${err.message}`, true); }
});
boot();
