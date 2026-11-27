// Coach dashboard: every client conversation with Muhammad (QK's AI assistant), the "Needs you" list of messages
// Muhammad handed to QK, QK's own replies, Muhammad on/off per client, and how Muhammad should talk.
import { LOCAL_ID } from './dash.js';
import { DEFAULT_NAME, DEFAULT_STYLE, DEMO_CHAT } from './chatbot.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return m < 1 ? 'now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

let X; // { state, cloud, toast, select(id) }
const C = { rows: [], off: new Set(), cfg: { name: DEFAULT_NAME, on: true, style: '' } };
const byClient = id => C.rows.filter(r => r.client_id === id);
const nameOf = id => X.state.cards.find(c => c.id === id)?.name || 'Client';
const open = r => r.sender === 'client' && r.flagged && !r.handled_at;
// Demo: this phone's own conversation is kept on the phone, so the app and the dashboard share it.
const demoSave = () => store.set(DEMO_CHAT, C.rows.filter(r => r.client_id === LOCAL_ID).map(({ client_id, ...r }) => r));

// Sample conversations for the demo dashboard (the real ones come from the server).
function demoRows(now = Date.now()) {
  const t = m => new Date(now - m * 60e3).toISOString(), R = (client_id, sender, body, mins, extra = {}) => ({ id: `${client_id}-${mins}-${sender}`, client_id, sender, body, created_at: t(mins), ...extra });
  const mine = (store.get(DEMO_CHAT) || []).map((r, i) => ({ ...r, id: `local-${i}`, client_id: LOCAL_ID }));
  return [
    R('d1', 'client', 'Bhai kal shaadi hai, kya khaun?', 190), R('d1', 'assistant', 'Shaadi pe tension nahi Sara! Pehle salad aur 2 boti tikka lo, phir ek roti ke saath qorma. Mithai ek piece, bas. Agle din normal plan pe wapas.', 189),
    R('d4', 'client', 'My knee hurts when I squat since Tuesday', 70, { flagged: 'Pain or injury' }), R('d4', 'assistant', "QK will reply to you himself. I've forwarded your message to him. Until then, please don't train through it: skip anything that hurts.", 70),
    R('d3', 'client', 'How much protein should I eat?', 25), R('d3', 'assistant', "Your target is about 120 g a day, Lena. Easiest win: 2 eggs at breakfast and a katori of daal or chicken with lunch and dinner.", 25),
    ...mine,
  ];
}

export async function loadChats() {
  const S = X.state;
  if (S.demo) { C.rows = demoRows(); C.off = new Set(store.get('qk_demo_assistant_off') || []); C.cfg = { ...C.cfg, ...(store.get('qk_demo_assistant') || {}) }; }
  else {
    const ids = S.raw.profiles.map(p => p.id);
    [C.rows, C.off] = await Promise.all([X.cloud.chats(ids, new Date(Date.now() - 30 * 864e5).toISOString()).catch(() => []), X.cloud.assistantOff().then(a => new Set(a)).catch(() => new Set())]);
    const me = await X.cloud.me().catch(() => null); C.cfg = { ...C.cfg, ...(me?.assistant || {}) };
  }
  renderInbox(); renderSettings(); X.render();
}

/** The inbox: conversations that need QK first, then the latest. */
export function renderInbox() {
  const ids = [...new Set(C.rows.map(r => r.client_id))];
  const convs = ids.map(id => { const rs = byClient(id), last = rs[rs.length - 1]; return { id, last, needs: rs.filter(open).length, unseen: rs.filter(r => r.sender === 'client' && !r.seen_by_coach_at).length }; })
    .sort((a, b) => (b.needs > 0) - (a.needs > 0) || Date.parse(b.last.created_at) - Date.parse(a.last.created_at));
  const needs = convs.filter(c => c.needs).length;
  $('#ccCount').textContent = needs ? `${needs} need${needs === 1 ? 's' : ''} you` : convs.length ? 'Nothing needs you' : '';
  $('#ccInbox').innerHTML = convs.length ? convs.map(c => `<button type="button" class="cc-row ${c.needs ? 'needs' : ''}" data-chat="${esc(c.id)}">
      <b>${esc(nameOf(c.id))}</b>${c.needs ? `<span class="cc-flag">Needs you · ${esc(byClient(c.id).filter(open).pop().flagged)}</span>` : c.unseen ? '<span class="cc-new">new</span>' : ''}
      <span class="muted small">${c.last.sender === 'client' ? '' : c.last.sender === 'coach' ? 'You: ' : `${esc(C.cfg.name || DEFAULT_NAME)}: `}${esc(String(c.last.body).slice(0, 90))} · ${ago(c.last.created_at)}</span></button>`).join('')
    : `<p class="muted small" style="margin:0">No messages yet. When clients message you in the app, ${esc(C.cfg.name || DEFAULT_NAME)} answers straight away and every conversation shows here.</p>`;
}

/** One client's conversation, inside their detail panel. */
export function chatHTML(c) {
  const rs = byClient(c.id), name = C.cfg.name || DEFAULT_NAME, first = esc(c.name.split(' ')[0]), off = C.off.has(c.id);
  const who = r => r.sender === 'client' ? first : r.sender === 'coach' ? 'You' : `${esc(name)} (AI)`;
  return `<div class="cd-food cc-chat" id="ccChat"><span class="eyebrow">Chat${rs.some(open) ? ' · needs you' : ''}</span>
    <div class="cc-thread">${rs.length ? rs.map(r => `<div class="chat-msg ${r.sender}"><span class="chat-who">${who(r)}</span><p>${esc(r.body)}</p><time>${ago(r.created_at)}</time>
      ${open(r) ? `<span class="cc-flag">Needs you: ${esc(r.flagged)}</span> <button type="button" class="linkbtn" data-handled="${esc(r.id)}">Mark handled</button>` : r.flagged ? '<span class="muted small">handled</span>' : ''}</div>`).join('')
      : `<p class="muted small" style="margin:0">No messages yet.</p>`}</div>
    <textarea id="ccReply" maxlength="2000" placeholder="Reply to ${first} as QK…"></textarea>
    <div class="btn-row"><button class="cta" type="button" id="ccSend">Send to ${first}</button></div>
    <label class="cc-toggle"><input type="checkbox" id="ccOff" ${off ? '' : 'checked'}> ${esc(name)} answers ${first} when you're not here</label>
    <p class="muted small" style="margin:0">While you're chatting (your last reply under 20 minutes ago) ${esc(name)} stays quiet.</p></div>`;
}

function renderSettings() {
  $('#ccName').value = C.cfg.name || DEFAULT_NAME; $('#ccOn').checked = C.cfg.on !== false;
  $('#ccStyle').value = C.cfg.style || ''; $('#ccStyle').placeholder = DEFAULT_STYLE;
}

/** Opening a conversation marks the client's messages seen (not handled: that stays QK's call). */
async function seen(id) {
  const ids = byClient(id).filter(r => r.sender === 'client' && !r.seen_by_coach_at).map(r => r.id);
  if (!ids.length) return;
  const at = new Date().toISOString(); C.rows.forEach(r => { if (ids.includes(r.id)) r.seen_by_coach_at = at; });
  if (!X.state.demo) await X.cloud.seen(ids).catch(() => {});
  renderInbox();
}

export function initCoachChat(x) {
  X = x;
  $('#ccInbox').onclick = e => { const b = e.target.closest('[data-chat]'); if (!b) return; X.select(b.dataset.chat); seen(b.dataset.chat); setTimeout(() => $('#ccChat')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  $('#cdDetail').addEventListener('click', async e => {
    const id = X.state.sel, h = e.target.closest('[data-handled]');
    if (h) {
      const r = C.rows.find(x => String(x.id) === h.dataset.handled); if (!r) return;
      if (!X.state.demo) try { await X.cloud.handled([r.id]); } catch (err) { return X.toast(`Couldn't save: ${err.message}`); }
      r.handled_at = new Date().toISOString(); if (X.state.demo) demoSave(); X.render(); renderInbox(); return;
    }
    if (e.target.id !== 'ccSend') return;
    const body = $('#ccReply').value.trim(); if (!body) return X.toast('Write a reply first.');
    const row = { id: 'me' + Date.now(), client_id: id, sender: 'coach', body, created_at: new Date().toISOString() };
    try {
      if (!X.state.demo) await X.cloud.reply(id, body);
    } catch (err) { return X.toast(`Couldn't send: ${err.message}`); }
    // Replying to a conversation deals with what was waiting in it.
    const waiting = byClient(id).filter(open);
    if (waiting.length && !X.state.demo) await X.cloud.handled(waiting.map(r => r.id)).catch(() => {});
    waiting.forEach(r => (r.handled_at = row.created_at));
    C.rows.push(row); if (X.state.demo) demoSave(); X.render(); renderInbox();
    X.toast(X.state.demo && id !== LOCAL_ID ? 'Sample mode: this would go to the client.' : X.state.demo ? 'Sent. Open Message QK in the app on this phone.' : 'Sent. They see it in the app, with a notification if the app is closed.');
  });
  $('#cdDetail').addEventListener('change', async e => {
    if (e.target.id !== 'ccOff') return;
    const id = X.state.sel, off = !e.target.checked;
    try { if (!X.state.demo) await X.cloud.setAssistantOff(id, off); } catch (err) { e.target.checked = off; return X.toast(`Couldn't save: ${err.message}`); }
    off ? C.off.add(id) : C.off.delete(id); if (X.state.demo) store.set('qk_demo_assistant_off', [...C.off]);
    X.toast(off ? `You'll answer ${nameOf(id).split(' ')[0]} yourself.` : `${C.cfg.name || DEFAULT_NAME} answers ${nameOf(id).split(' ')[0]} again.`);
  });
  $('#ccSave').onclick = async () => {
    const cfg = { name: $('#ccName').value.trim().slice(0, 30) || DEFAULT_NAME, on: $('#ccOn').checked, style: $('#ccStyle').value.trim().slice(0, 1500) };
    try { if (!X.state.demo) await X.cloud.updateMe({ assistant: cfg }); else store.set('qk_demo_assistant', cfg); }
    catch (err) { return X.toast(`Couldn't save: ${err.message}`); }
    C.cfg = cfg; renderInbox(); X.render(); X.toast(cfg.on ? `Saved. ${cfg.name} answers in this style from the next message.` : `Saved. ${cfg.name} is off: you answer every message.`);
  };
}
