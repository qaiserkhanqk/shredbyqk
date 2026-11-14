// Cycle tracking screen. Talks only to the encrypted repository. Cycle content is never passed to the coach
// voice (which may use a remote TTS endpoint), the main app store, the session recorder or the error log.
import * as M from './model.js';
import { estimateNext, typicalPeriodLength, DISCLAIMER } from './predict.js';
import { findPatterns, patternStatus, evidenceText, insightForToday, forecastCheckins } from './patterns.js';
import { phaseInfo, PHASE_EDUCATION } from './phase.js';
import { KINDS, addReminder, updateReminder, deleteReminder, nextFire, dueNow, markDelivered, notificationContent } from './reminders.js';
import { MockWearable, SwlDs07Adapter, normalise, summariseNights, mergeNights, nightTable, METRICS } from './wearables.js';
import { retrospectiveShift } from './tempshift.js';
import { openCycleRepo, indexedDbKeys, syncStorage, localUserId } from './store.js';
import { today as localToday, localMinutes, addDays, diffDays, human, deviceTimeZone } from './dates.js';
import { readFlags, setFlag, FLAG_DEFS } from './flags.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MSG = {
  NO_CONSENT: 'Please agree to the terms first.', CATEGORY_OFF: 'Turn this category on in settings first.', FUTURE_DATE: 'That date is in the future.',
  END_BEFORE_START: 'The end can\'t be before the start.', OVERLAP: 'That overlaps a period you already logged. Edit that one instead.', INVALID_DATE: 'Choose a valid date.',
  NOT_VERIFIED: 'This device isn\'t available: its integration is not verified.', CRYPTO_UNAVAILABLE: 'This browser can\'t encrypt data, so cycle tracking is unavailable here.',
  DECRYPT_FAILED: 'Your saved cycle data could not be unlocked on this device.', KEYSTORE_UNAVAILABLE: 'Secure storage is blocked in this browser (private mode?).',
};
let repo = null, root = null, toast = () => {}, openErr = null, notified = new Set(), timer = null;
const flags = () => readFlags();
const now = () => ({ today: localToday(), nowMin: localMinutes(Date.now(), deviceTimeZone()) });

export async function initCycle(opts) {
  root = opts.root; toast = opts.toast;
  root.addEventListener('click', onClick); root.addEventListener('change', onChange);
}
async function ensureRepo() {
  if (repo || openErr) return;
  try { repo = await openCycleRepo({ storage: syncStorage(localStorage), keys: indexedDbKeys(), userId: localUserId() }); }
  catch (e) { openErr = e.code || 'UNKNOWN'; }
}
async function act(fn, ok) {
  try { await repo.update(s => fn(s, now().today)); if (ok) toast(ok); }
  catch (e) { toast(MSG[e.code] || 'That didn\'t work. Nothing was changed.'); } // codes only: no data in messages
  render();
}

export async function renderCycle() {
  if (!root) return;
  if (!flags().cycleTracking) { root.innerHTML = '<p class="muted small">This prototype is switched off.</p>'; return; }
  await ensureRepo();
  if (openErr) { root.innerHTML = `<div class="card"><b>Cycle tracking is unavailable</b><p class="muted small">${esc(MSG[openErr] || 'Secure storage could not be opened.')}</p></div>`; return; }
  render();
  clearInterval(timer); timer = setInterval(() => { if (root.closest('.screen.on')) notifyDue(); }, 60e3);
}

function render() {
  const s = repo.read(), { today, nowMin } = now(), f = flags();
  if (!M.hasConsent(s)) { root.innerHTML = consentHTML(); return; }
  const open = [...root.querySelectorAll('details[id][open]')].map(d => d.id); // keep sections the user opened
  const est = estimateNext(s, today);
  const tempShift = f.temperatureResearch && est.lastStart ? retrospectiveShift(s, est.lastStart, addDays(today, 1)) : null;
  root.innerHTML = [banner(), promptsHTML(s, est, today), dueHTML(s, est, today, nowMin), estimateHTML(s, est), logHTML(s, today), insightHTML(s, today),
    f.phaseEducation ? phaseHTML(s, today, tempShift) : '', historyHTML(s), patternsHTML(s, today, f), remindersHTML(s, est, today, nowMin),
    wearableHTML(s, today, f, tempShift), situationHTML(s), settingsHTML(s, f)].join('');
  for (const id of open) { const d = root.querySelector('#' + id); if (d) d.open = true; }
  notifyDue();
}

/* ---------- Sections ---------- */
const banner = () => `<p class="cy-banner">Prototype. Estimates are not clinically validated. Use demo data, not real client data.</p>`;

function consentHTML() {
  return `${banner()}<div class="card stack" id="cyConsent">
  <span class="eyebrow">Before you start</span><h2 class="display h2">Cycle tracking</h2>
  <ul class="issues">
    <li><b>What we keep:</b> the period dates you log, spotting, and only the symptom categories you switch on, one by one.</li>
    <li><b>Where:</b> on this device only, encrypted. Nothing is uploaded, shared, sent by SMS or used for ads. Nothing is shared with a partner, coach or anyone else.</li>
    <li><b>What it is:</b> estimates from your own logged dates. Not medical advice, not clinically validated, not contraception, and it can't detect pregnancy or diagnose conditions.</li>
    <li><b>A watch can't detect bleeding.</b> Periods are only ever what you log or confirm.</li>
    <li><b>Your control:</b> edit or delete any entry, export everything, or delete it all at any time.</li>
  </ul>
  <label class="check"><input type="checkbox" id="cyAgree"> I understand and want to start</label>
  <button class="cta" type="button" data-act="consent">Agree and start</button></div>`;
}

function promptsHTML(s, est, today) {
  const out = M.pendingPrompts(s, today).map(p => `<div class="card cy-ask" data-key="${esc(p.key)}"><b>${esc(p.kind === 'confirmStart' ? `Did a period start on ${human(p.date)}?` : 'Has your period ended?')}</b>
    <p class="muted small">${p.kind === 'confirmStart' ? 'You logged bleeding that day. We won\'t assume it was a period.' : 'Your period is still open. We won\'t close it for you.'}</p>
    <div class="btn-row">${p.kind === 'confirmStart' ? `<button class="ghost" type="button" data-act="confirmStart" data-date="${p.date}">Yes, it started</button><button class="ghost" type="button" data-act="wasSpotting" data-date="${p.date}">It was spotting</button>`
      : `<label class="field">Last day<input type="date" id="endFor-${esc(p.id)}" max="${today}" value="${today}"></label><button class="ghost" type="button" data-act="endPeriod" data-id="${esc(p.id)}">Save end</button>`}
    <button class="ghost" type="button" data-act="dismissPrompt" data-key="${esc(p.key)}">Not now</button></div></div>`);
  const started = est.lastStart && est.rangeStart && est.lastStart >= addDays(est.rangeStart, -10);
  if (!started && (est.inRange || est.beyondRange) && !s.promptsDismissed[`check:${today}`]) {
    out.unshift(`<div class="card cy-ask" id="cyCheck"><b>Has your period started?</b><p class="muted small">${est.beyondRange ? 'Your usual range has passed. Cycles vary for many reasons. If you\'re worried, talk to a health professional.' : 'You\'re in your estimated range.'} Only you can tell us; a missing entry is never read as "no bleeding".</p>
    <div class="btn-row"><button class="ghost" type="button" data-act="logStartToday">Yes, today</button><button class="ghost" type="button" data-act="spottingToday">Spotting only</button><button class="ghost" type="button" data-act="notYet">Not yet</button><button class="ghost" type="button" data-act="dismissPrompt" data-key="check:${today}">Ask later</button></div></div>`);
  }
  return out.join('');
}

function dueHTML(s, est, today, nowMin) {
  const due = dueNow(s, { today, nowMin, estimate: est }); if (!due.length) return '';
  return `<div class="card" id="cyDue"><span class="eyebrow">Check-ins due</span>${due.map(d => `<div class="row cy-row"><div><b>${esc(KINDS[d.reminder.kind])}</b><details><summary class="linkbtn">Why am I seeing this?</summary><p class="muted small">${esc(d.why)}</p></details></div><button class="ghost" type="button" data-act="ackDue" data-id="${d.reminder.id}">Done</button></div>`).join('')}</div>`;
}

function estimateHTML(s, est) {
  const range = est.rangeStart ? `<div class="num cy-range">${human(est.rangeStart)} – ${human(est.rangeEnd)}</div><p class="muted small">A date range, not a date.${est.beyondRange ? ' This range has passed.' : ''}</p>` : '';
  const pl = typicalPeriodLength(s);
  return `<div class="card stack" id="cyEstimate"><div><span class="eyebrow">Next period · ${esc(est.status === 'estimate' ? 'estimate' : est.status.replace('_', ' '))}</span><h2 class="display h2" id="cyHeadline">${esc(est.headline)}</h2></div>
    ${range}<p class="small" id="cyDetail">${esc(est.detail)}</p>
    ${est.cycleDay ? `<p class="muted small">Today is day ${est.cycleDay} since your last logged start (${human(est.lastStart)}).${pl ? ` Your logged periods usually last ${pl} days.` : ''}</p>` : ''}
    ${est.notes.map(n => `<p class="muted small">${esc(n)}</p>`).join('')}
    <details><summary class="linkbtn">Why this estimate?</summary><div class="stack small" style="margin-top:8px">
      <p>Used: ${est.lengths?.length ? est.lengths.map(l => `${l} days`).join(', ') : 'nothing yet'}.</p>
      ${est.excluded.length ? `<p>Left out:</p><ul class="issues">${est.excluded.map(c => `<li>${human(c.start)} – ${human(c.nextStart)} (${c.length} d): ${esc(c.reason)}</li>`).join('')}</ul>` : ''}
      <p class="muted">Method: shortest to longest of your last 6 usable cycles, counted from your last start. No 28-day default and no assumed ovulation day. Wearable data is not used.</p>
      <p class="muted">${esc(DISCLAIMER)}</p></div></details></div>`;
}

function logHTML(s, today) {
  const cats = Object.entries(M.CATEGORIES).filter(([k]) => M.categoryOn(s, k));
  const d = s.days[today] || {};
  return `<div class="card stack" id="cyLog"><span class="eyebrow">Log</span>
    <label class="field">Date<input type="date" id="cyDate" max="${today}" value="${today}"></label>
    <div class="btn-row"><button class="ghost" type="button" data-act="logStart">Period started</button><button class="ghost" type="button" data-act="logEnd">Period ended</button><button class="ghost" type="button" data-act="logSpotting">Spotting</button></div>
    ${cats.length ? `<div class="grid2">${cats.map(([k, c]) => `<label class="field">${c.label}<select data-sym="${k}"><option value="">Not logged</option>${c.options.map(([v, l]) => `<option value="${v}" ${d[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>` : '<p class="muted small">Symptom logging is off. You can switch categories on in settings below.</p>'}
    <div class="btn-row"><label class="check"><input type="checkbox" id="cyUnwell" ${d.unwell ? 'checked' : ''}> Unwell</label><label class="check"><input type="checkbox" id="cyTravel" ${d.travel ? 'checked' : ''}> Travelling</label></div>
    <button class="cta" type="button" data-act="saveDay">Save this day</button>
    <p class="muted small">Days you don't log stay blank. Blank never means "no bleeding" or "no symptoms".</p></div>`;
}

function insightHTML(s, today) {
  const p = insightForToday(s, today); if (!p) return '';
  return `<div class="card" id="cyInsight"><span class="eyebrow">From your own logs</span><p>${esc(p.text)} Would a check-in reminder help?</p>
    <div class="btn-row"><button class="ghost" type="button" data-act="patternReminder" data-key="${esc(p.key)}">Remind me next cycle</button><button class="ghost" type="button" data-act="dismissInsight" data-key="${esc(p.key)}">Dismiss</button></div></div>`;
}

function phaseHTML(s, today, tempShift) {
  const p = phaseInfo(s, today, { tempShift });
  return `<div class="card" id="cyPhase"><span class="eyebrow">Phase · ${esc(p.status.replace(/_/g, ' '))}</span><h2 class="display h2">${esc(p.label)}</h2><p class="small">${esc(p.text)}</p><p class="muted small">${esc(PHASE_EDUCATION)}</p></div>`;
}

function historyHTML(s) {
  const cs = M.cycles(s);
  const periods = [...s.periods].reverse().map(p => `<div class="row cy-row" data-pid="${esc(p.id)}"><div class="grid2">
      <label class="field">Start<input type="date" data-edit="start" value="${p.start}"></label><label class="field">End<input type="date" data-edit="end" value="${p.end || ''}"></label></div>
      <div class="stack" style="flex:0 0 auto"><label class="check small"><input type="checkbox" data-edit="missedBefore" ${p.missedBefore ? 'checked' : ''}> Missed a log before this</label>
      ${cs.find(c => c.nextStart === p.start && !c.usable && !p.missedBefore) ? `<label class="check small"><input type="checkbox" data-edit="lengthConfirmed" ${p.lengthConfirmed ? 'checked' : ''}> Gap before is correct</label>` : ''}
      <button class="linkbtn" type="button" data-act="deletePeriod">Delete</button></div></div>`).join('');
  const cyc = cs.slice(-8).reverse().map(c => `<div class="row"><div>${human(c.start)} → ${human(c.nextStart)}</div><span class="r">${c.length} days${c.usable ? '' : ' · not used'}</span></div>`).join('');
  const lastStart = s.periods.at(-1)?.start, t = localToday();
  const current = lastStart && (!cs.length || cs.at(-1).nextStart === lastStart) ? [{ start: lastStart, length: diffDays(lastStart, t) + 1, current: true }] : [];
  const syms = [...cs.slice(-4), ...current].reverse().map(c => {
    const e = []; for (let i = 0; i < c.length; i++) { const day = s.days[addDays(c.start, i)]; if (!day) continue; const parts = Object.entries(day).filter(([k]) => k in M.CATEGORIES || k === 'bleeding').map(([k, v]) => `${k === 'bleeding' ? v : M.CATEGORIES[k].label.toLowerCase() + ' ' + v}`); if (parts.length) e.push(`d${i + 1}: ${parts.join(', ')}`); }
    return `<div class="row"><div><b>${human(c.start)}${c.current ? ' (current)' : ''}</b><div class="muted small">${e.length ? esc(e.join(' · ')) : 'No day logs in this cycle'}</div></div></div>`;
  }).join('');
  return `<details class="card" id="cyHistory"><summary><span class="eyebrow">Your history</span></summary><div class="stack" style="margin-top:10px">
    <b class="small">Periods (edit to correct)</b><div class="list">${periods || '<p class="empty">No periods logged yet.</p>'}</div>
    <b class="small">Cycles</b><div class="list">${cyc || '<p class="empty">A cycle appears once two starts are logged.</p>'}</div>
    <b class="small">Day logs by cycle</b><div class="list">${syms || '<p class="empty">Nothing yet.</p>'}</div></div></details>`;
}

function patternsHTML(s, today, f) {
  const st = patternStatus(s); if (!st.length) return '';
  const rows = st.map(x => x.status === 'found' ? x.patterns.map(p => `<div class="row cy-row"><div><b>${esc(p.text)}</b><p class="muted small">${esc(evidenceText(p))}</p>${s.dismissed[p.key] ? '<span class="muted small">Dismissed</span>' : `<div class="btn-row"><button class="linkbtn" type="button" data-act="patternReminder" data-key="${esc(p.key)}">Remind me</button><button class="linkbtn" type="button" data-act="dismissInsight" data-key="${esc(p.key)}">Dismiss</button></div>`}</div></div>`).join('')
    : `<div class="row cy-row"><div><b>${esc(M.CATEGORIES[x.category].label)}: ${x.status === 'insufficient' ? 'not enough data' : 'no consistent pattern'}</b><p class="muted small">${esc(x.why)}</p></div><button class="linkbtn" type="button" data-act="checkinReminder">Daily check-in</button></div>`).join('');
  const fc = f.symptomForecast ? forecastCheckins(s, today) : [];
  return `<div class="card" id="cyPatterns"><span class="eyebrow">Your patterns</span><div class="list">${rows}</div>
    <p class="muted small">Observations from your own complete cycles only, never a prediction of how you will feel.</p>
    ${f.symptomForecast ? `<p class="small"><b>Experimental:</b> ${fc.length ? esc(`past logs suggest a check-in about ${[...new Set(fc.map(x => M.CATEGORIES[x.category].label.toLowerCase()))].join(', ')} around ${human(fc[0].date)}.`) : 'nothing to suggest this week.'}</p>` : ''}</div>`;
}

function remindersHTML(s, est, today, nowMin) {
  if (!s.consent.reminders) return `<div class="card stack" id="cyReminders"><span class="eyebrow">Reminders · off</span><p class="small">Optional. They appear in the app, and as a notification only while the app is open, with neutral text by default. Nothing is sent by SMS or shared.</p><button class="ghost" type="button" data-act="remindersOn">Turn on reminders</button></div>`;
  const list = s.reminders.map(r => { const n = nextFire(r, s, { today, nowMin, estimate: est });
    return `<div class="row cy-row" data-rid="${r.id}"><div><b>${esc(KINDS[r.kind])}</b><div class="muted small">${n.next ? `Next: ${human(n.next.date)} ${n.next.time}${n.next.shiftedForQuietHours ? ' (moved for quiet hours)' : ''}` : esc(n.why)}</div><div class="muted small">${esc(n.why === 'Paused.' ? '' : n.why)}</div></div>
      <div class="stack" style="flex:0 0 auto"><input type="time" data-rtime value="${r.time}"><button class="linkbtn" type="button" data-act="pauseRem">${r.pausedUntil && r.pausedUntil >= today ? 'Resume' : 'Pause 7 days'}</button><button class="linkbtn" type="button" data-act="delRem">Delete</button></div></div>`; }).join('');
  const q = s.settings.quietHours;
  return `<div class="card stack" id="cyReminders"><span class="eyebrow">Reminders</span><div class="list">${list || '<p class="empty">No reminders.</p>'}</div>
    <div class="grid2"><label class="field">Add<select id="cyRemKind"><option value="dailyLog">Daily log</option><option value="weeklyLog">Weekly check-in (Mondays)</option><option value="periodCheck">When my range begins</option></select></label><label class="field">Time<input type="time" id="cyRemTime" value="09:00"></label></div>
    <button class="ghost" type="button" data-act="addRem">Add reminder</button>
    <div class="grid2"><label class="field">Quiet from<input type="time" id="cyQs" value="${q.start}"></label><label class="field">Quiet until<input type="time" id="cyQe" value="${q.end}"></label></div>
    <label class="check"><input type="checkbox" id="cyLockDetail" ${s.settings.lockScreenDetail ? 'checked' : ''}> Show what the reminder is about on the lock screen (off = "You have a check-in")</label>
    <div class="btn-row"><button class="ghost" type="button" data-act="pauseAll">${s.settings.remindersPausedUntil && s.settings.remindersPausedUntil >= today ? 'Resume all' : 'Pause all 7 days'}</button><button class="ghost" type="button" data-act="notifPerm">Allow notifications</button><button class="ghost" type="button" data-act="remindersOff">Turn off &amp; delete reminders</button></div>
    <p class="muted small">Times follow your phone's current time zone. With no server, reminders can't arrive while the app is closed.</p></div>`;
}

function wearableHTML(s, today, f, tempShift) {
  const ds07 = new SwlDs07Adapter();
  if (!s.consent.wearable) return `<div class="card stack" id="cyWearable"><span class="eyebrow">Wearable · off</span><p class="small">Optional. Adds nightly wrist skin temperature and heart data, kept as nightly summaries. A watch can't detect a period and isn't used for your estimate.</p>
    <button class="ghost" type="button" data-act="wearableOn">Turn on and connect demo device (synthetic data)</button><p class="muted small"><b>${esc(ds07.displayName)}:</b> ${esc(ds07.status)}</p></div>`;
  const dev = s.wearable.devices[0], from = addDays(today, -7), tbl = nightTable(s.wearable.nights, from, addDays(today, -1));
  const hr = new Map(s.wearable.nights.filter(n => n.metric === 'heart_rate').map(n => [n.night, n]));
  return `<div class="card stack" id="cyWearable"><span class="eyebrow">Wearable · last 7 nights</span>
    ${dev ? `<p class="small"><b>${esc(dev.model)}</b> · firmware ${esc(dev.firmware)} · ${dev.verified ? 'verified' : '<b>synthetic demo, not your measurements</b>'}</p>` : '<p class="small">No device connected.</p>'}
    <div class="kv" id="cyNights">${tbl.map(n => `<span>${human(n.night)}</span><span>${n.status === 'ok' ? `${n.value.toFixed(2)} °C${hr.get(n.night)?.value ? ` · ${Math.round(hr.get(n.night).value)} bpm` : ''}` : n.status === 'no_data' ? 'No data' : n.status === 'insufficient_wear' ? 'Too little wear' : 'No usable data'}${n.rejected ? ` · ${n.rejected} rejected` : ''}${(n.flags || []).filter(x => ['tz_change', 'device_change', 'firmware_change'].includes(x)).map(x => ' · ' + ({ tz_change: 'time zone changed', device_change: 'new device', firmware_change: 'new firmware' })[x]).join('')}</span>`).join('')}</div>
    <p class="muted small">${esc(METRICS.skin_temp.note)} Raw values as reported by the device; heart-rate variability is vendor-derived. Gaps are never filled in.</p>
    ${f.temperatureResearch ? `<p class="small" id="cyShift"><b>Research:</b> ${esc(tempShift?.detected ? `A sustained rise in wrist skin temperature was seen from ${human(tempShift.firstHighNight)}. This may be consistent with ovulation having already happened. It is not proof, it is not a warning in advance, and it is not used for your period estimate.` : tempShift?.why || 'No data.')}</p>` : ''}
    <div class="btn-row"><button class="ghost" type="button" data-act="syncWearable">Sync demo data</button><button class="ghost" type="button" data-act="wearableOff">Disconnect &amp; delete wearable data</button></div>
    <p class="muted small"><b>${esc(ds07.displayName)}:</b> ${esc(ds07.status)}</p></div>`;
}

function situationHTML(s) {
  return `<details class="card" id="cySituation"><summary><span class="eyebrow">Situations that change how cycles work</span></summary><div class="stack" style="margin-top:10px">
    <p class="muted small">Optional. Used only to add caveats, pause estimates in pregnancy and hide phase information.</p>
    ${Object.entries(M.SITUATIONS).map(([k, v]) => `<label class="check"><input type="checkbox" data-sit="${k}" ${s.situation[k] ? 'checked' : ''}> ${esc(v.label)}</label>`).join('')}</div></details>`;
}

function settingsHTML(s, f) {
  return `<details class="card" id="cySettings"><summary><span class="eyebrow">Settings, export &amp; delete</span></summary><div class="stack" style="margin-top:10px">
    <b class="small">Symptom categories (each is optional)</b>
    ${Object.entries(M.CATEGORIES).map(([k, c]) => `<label class="check"><input type="checkbox" data-cat="${k}" ${M.categoryOn(s, k) ? 'checked' : ''}> <span><b>${c.label}</b> <span class="muted small">${esc(c.why)}</span></span></label>`).join('')}
    <p class="muted small">Turning a category off stops collecting it. You'll be asked whether to delete what you logged.</p>
    <b class="small">Optional features</b>
    ${['phaseEducation', 'symptomForecast', 'temperatureResearch'].map(k => `<label class="check"><input type="checkbox" data-flag="${k}" ${f[k] ? 'checked' : ''}> <span><b>${esc(FLAG_DEFS[k].label)}</b> <span class="muted small">${esc(FLAG_DEFS[k].desc)}</span></span></label>`).join('')}
    <div class="btn-row"><button class="ghost" type="button" data-act="export">Export my data</button><button class="stop" type="button" data-act="deleteAll">Delete all cycle data</button></div>
    <p class="muted small">Deleting removes your records and destroys the encryption key on this device. It can't reach files you exported or device backups made earlier (they hold encrypted data, but may also hold the key).</p>
    <details><summary class="linkbtn">Consent record</summary><ul class="issues">${s.consent.log.map(l => `<li>${esc(l.at.slice(0, 10))}: ${esc(l.change)}</li>`).join('')}</ul></details></div></details>`;
}

/* ---------- Local notifications (only while the app is open) ---------- */
async function notifyDue() {
  if (!repo || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const s = repo.read(); if (!M.hasConsent(s)) return;
  const { today, nowMin } = now();
  for (const d of dueNow(s, { today, nowMin, estimate: estimateNext(s, today) })) {
    const tag = `${d.reminder.id}:${today}`; if (notified.has(tag)) continue; notified.add(tag);
    const c = notificationContent(d.reminder, s.settings);
    try { const reg = await navigator.serviceWorker?.getRegistration?.(); reg ? reg.showNotification(c.title, { body: c.body, tag }) : new Notification(c.title, { body: c.body, tag }); } catch { /* ignore */ }
  }
}

/* ---------- Events ---------- */
const val = sel => root.querySelector(sel)?.value;
async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || !repo) return;
  const a = b.dataset.act, date = () => val('#cyDate');
  const run = {
    consent: () => { if (!root.querySelector('#cyAgree')?.checked) return toast('Tick the box to agree first.'); act(s => M.giveConsent(s), 'Cycle tracking is on'); },
    logStart: () => act((s, t) => M.logPeriodStart(s, date(), { today: t }), 'Period start saved'),
    logStartToday: () => act((s, t) => M.logPeriodStart(s, t, { today: t }), 'Period start saved'),
    confirmStart: () => act((s, t) => M.logPeriodStart(s, b.dataset.date, { today: t }), 'Period start saved'),
    wasSpotting: () => act((s, t) => M.logDay(s, b.dataset.date, { bleeding: 'spotting' }, { today: t }), 'Saved as spotting'),
    logEnd: () => act((s, t) => { const p = [...s.periods].reverse().find(x => x.start <= date()); if (!p) throw new M.CycleError('NOT_FOUND'); M.logPeriodEnd(s, p.id, date(), { today: t }); }, 'Period end saved'),
    endPeriod: () => act((s, t) => M.logPeriodEnd(s, b.dataset.id, val(`#endFor-${CSS.escape(b.dataset.id)}`), { today: t }), 'Period end saved'),
    logSpotting: () => act((s, t) => M.logDay(s, date(), { bleeding: 'spotting' }, { today: t }), 'Spotting saved'),
    spottingToday: () => act((s, t) => M.logDay(s, t, { bleeding: 'spotting' }, { today: t }), 'Spotting saved'),
    notYet: () => act((s, t) => { M.logDay(s, t, { bleeding: 'none' }, { today: t }); M.dismissPrompt(s, `check:${t}`, t); }, 'Noted for today'),
    dismissPrompt: () => act((s, t) => M.dismissPrompt(s, b.dataset.key, t)),
    saveDay: () => act((s, t) => {
      const f = { unwell: root.querySelector('#cyUnwell').checked, travel: root.querySelector('#cyTravel').checked };
      root.querySelectorAll('[data-sym]').forEach(x => { f[x.dataset.sym] = x.value || null; });
      M.logDay(s, date(), f, { today: t });
    }, 'Saved'),
    deletePeriod: () => act(s => M.deletePeriod(s, b.closest('[data-pid]').dataset.pid), 'Period deleted'),
    dismissInsight: () => act((s, t) => { s.dismissed[b.dataset.key] = t; }, 'Dismissed'),
    patternReminder: () => act(s => { if (!s.consent.reminders) M.setScopeConsent(s, 'reminders', true); const p = findPatterns(s).find(x => x.key === b.dataset.key); addReminder(s, { kind: 'pattern', time: '09:00', cycleDay: p.from, category: p.category, origin: p.text }); }, 'Reminder set for next cycle'),
    checkinReminder: () => act(s => { if (!s.consent.reminders) M.setScopeConsent(s, 'reminders', true); addReminder(s, { kind: 'dailyLog', time: '20:00' }); }, 'Daily check-in set for 20:00'),
    remindersOn: () => act(s => M.setScopeConsent(s, 'reminders', true)),
    remindersOff: () => act(s => M.setScopeConsent(s, 'reminders', false), 'Reminders deleted'),
    addRem: () => act(s => addReminder(s, { kind: val('#cyRemKind'), time: val('#cyRemTime'), weekday: 1 }), 'Reminder added'),
    delRem: () => act(s => deleteReminder(s, b.closest('[data-rid]').dataset.rid), 'Reminder deleted'),
    pauseRem: () => act((s, t) => { const r = s.reminders.find(x => x.id === b.closest('[data-rid]').dataset.rid); updateReminder(s, r.id, { pausedUntil: r.pausedUntil && r.pausedUntil >= t ? null : addDays(t, 6) }); }),
    pauseAll: () => act((s, t) => { s.settings.remindersPausedUntil = s.settings.remindersPausedUntil && s.settings.remindersPausedUntil >= t ? null : addDays(t, 6); }),
    ackDue: () => act((s, t) => markDelivered(s, b.dataset.id, t)),
    notifPerm: async () => { if (typeof Notification === 'undefined') return toast('Notifications aren\'t supported here.'); toast((await Notification.requestPermission()) === 'granted' ? 'Notifications allowed' : 'Notifications not allowed'); },
    wearableOn: async () => { await act(s => M.setScopeConsent(s, 'wearable', true)); await sync(); },
    syncWearable: () => sync(),
    wearableOff: () => act(s => M.setScopeConsent(s, 'wearable', false), 'Wearable data deleted'),
    export: () => { const data = repo.exportData(); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const l = document.createElement('a'); l.href = url; l.download = `shred-cycle-export-${now().today}.json`; document.body.appendChild(l); l.click(); setTimeout(() => { URL.revokeObjectURL(url); l.remove(); }, 1000); },
    deleteAll: async () => { if (!confirm('Delete all cycle data on this device? This can\'t be undone.')) return; const r = await repo.deleteAll(); toast(`Deleted. Not reachable: ${r.notReached.length} items (see settings).`); render(); },
  }[a];
  if (run) await run();
}
async function sync() {
  const { today } = now();
  const dev = new MockWearable({ seed: 7, highFrom: n => { const s = repo.read(); const st = s.periods.map(p => p.start).filter(x => x <= n).at(-1); return !!st && diffDays(st, n) >= 15; } });
  const info = await dev.connect();
  const { readings } = normalise(await dev.fetchPackets({ from: addDays(today, -21), to: addDays(today, -1) }));
  await act(s => { if (!s.consent.wearable) throw new M.CycleError('NO_CONSENT'); s.wearable.devices = [{ ...info, adapter: dev.id, verified: dev.verified, connectedAt: today }]; s.wearable.nights = mergeNights(s.wearable.nights, summariseNights(readings)); }, 'Demo data synced (synthetic)');
}
async function onChange(e) {
  const t = e.target; if (!repo) return;
  if (t.dataset.edit) {
    const id = t.closest('[data-pid]').dataset.pid, k = t.dataset.edit;
    const patch = k === 'missedBefore' || k === 'lengthConfirmed' ? { [k]: t.checked } : { [k]: t.value || (k === 'end' ? null : undefined) };
    return act((s, d) => M.editPeriod(s, id, patch, { today: d }), 'Corrected');
  }
  if (t.dataset.cat) {
    const k = t.dataset.cat;
    if (t.checked) return act(s => M.setCategory(s, k, true), `${M.CATEGORIES[k].label} logging on`);
    const purge = confirm(`Stop logging ${M.CATEGORIES[k].label.toLowerCase()}. Also delete what you already logged?`);
    return act(s => M.setCategory(s, k, false, { purge }), purge ? 'Turned off and deleted' : 'Turned off');
  }
  if (t.dataset.sit) return act(s => { if (t.checked) s.situation[t.dataset.sit] = true; else delete s.situation[t.dataset.sit]; });
  if (t.dataset.flag) { setFlag(t.dataset.flag, t.checked); return render(); }
  if (t.dataset.rtime != null) return act(s => updateReminder(s, t.closest('[data-rid]').dataset.rid, { time: t.value }), 'Time changed');
  if (t.id === 'cyQs' || t.id === 'cyQe') return act(s => { s.settings.quietHours = { start: val('#cyQs'), end: val('#cyQe') }; }, 'Quiet hours saved');
  if (t.id === 'cyLockDetail') return act(s => { s.settings.lockScreenDetail = t.checked; });
}
