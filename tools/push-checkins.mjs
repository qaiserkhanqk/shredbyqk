#!/usr/bin/env node
// Daily job: reach clients whose app is closed.
//   1. Check-in day: everyone whose next_checkin is today or earlier gets "Check-in day".
//   2. Plan updates: when QK edited a client's diet plan on the dashboard, they get "QK updated your plan".
//   3. Only for clients who chose "a gentle nudge too": one reminder after 3 quiet days, at most weekly.
// Never more than one notification per client per day (see plan()).
// Runs from .github/workflows/push.yml (no server needed), or by hand:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@… node tools/push-checkins.mjs
// The service-role key bypasses the privacy rules, so it lives only in GitHub's encrypted secrets.
import { send } from './webpush.mjs';
import { nudgeDue } from '../js/signals.js';

const E = process.env;
const today = (now = Date.now(), tz = 'Asia/Karachi') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD

/**
 * Who gets what today. Pure, so it's unit tested.
 * profiles: [{ id, name, next_checkin, notify, last_food }], subs: [{ client_id, endpoint, last_sent, last_nudge }],
 * plans: [{ client_id, note, updated_at, notified_at }]. Returns [{ sub, kind, msg }].
 * The budget: at most one notification per client per day; QK's plan update beats a check-in beats a nudge;
 * nudges only for clients who chose them ('normal'), at most weekly, after 3 days without logging food,
 * never on a check-in day; 'off' gets nothing.
 */
export function plan({ profiles, subs, plans, day }) {
  const byClient = new Map(), P = new Map(profiles.map(p => [p.id, p]));
  for (const s of subs) (byClient.get(s.client_id) || byClient.set(s.client_id, []).get(s.client_id)).push(s);
  const first = id => (P.get(id)?.name || '').split(' ')[0];
  const want = new Map(); // client → { kind, msg } (the most important one only)
  const offer = (id, kind, msg) => { const rank = { plan: 3, checkin: 2, nudge: 1 }; if (!want.has(id) || rank[kind] > rank[want.get(id).kind]) want.set(id, { kind, msg }); };
  for (const c of plans) if (!(c.notified_at && c.notified_at >= c.updated_at))
    offer(c.client_id, 'plan', { title: 'QK updated your diet plan', body: c.note || 'Open Food to see your new amounts.', url: './?tab=food', tag: 'qk-plan' });
  for (const p of profiles) {
    if (p.notify === 'off') continue;
    const checkin = p.next_checkin && p.next_checkin <= day;
    if (checkin) offer(p.id, 'checkin', { title: `Check-in day${first(p.id) ? ', ' + first(p.id) : ''}`, body: 'Weigh yourself before breakfast and enter it in Food. QK will read your two weeks and suggest your next step.', url: './?tab=food', tag: 'qk-checkin' });
    const quiet = p.last_food ? Math.floor((Date.parse(day) - Date.parse(p.last_food)) / 864e5) : null;
    const lastNudge = (byClient.get(p.id) || []).map(s => s.last_nudge).filter(Boolean).sort().pop();
    if (nudgeDue({ level: p.notify || 'essential', daysSinceFood: quiet, lastNudge, checkinToday: checkin, today: day }))
      offer(p.id, 'nudge', { title: `Hi${first(p.id) ? ' ' + first(p.id) : ''}, QK here`, body: 'Snap your next meal when you get a moment. One photo keeps your week on track.', url: './?tab=food', tag: 'qk-nudge' });
  }
  const out = [];
  for (const [id, w] of want) {
    if (P.get(id)?.notify === 'off' && w.kind !== 'plan') continue;
    for (const s of byClient.get(id) || []) if (s.last_sent !== day) out.push({ sub: s, kind: w.kind, client: id, msg: w.msg });
  }
  return out;
}

async function main() {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) if (!E[k]) { console.log(`Not set up yet (${k} missing): nothing sent.`); return; }
  const base = E.SUPABASE_URL.replace(/\/$/, ''), H = { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const get = async path => { const r = await fetch(base + path, { headers: H }); if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`); return r.json(); };
  const patch = (path, body) => fetch(base + path, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  const day = today(Date.now(), E.PUSH_TZ || 'Asia/Karachi');
  const [profiles, subs, plans] = await Promise.all([
    get('/rest/v1/profiles?role=eq.client&select=id,name,next_checkin,notify,last_food'),
    get('/rest/v1/push_subs?select=*'),
    get('/rest/v1/coach_plans?select=client_id,note,updated_at,notified_at'),
  ]);
  const vapid = { publicKey: E.VAPID_PUBLIC_KEY, privateKey: E.VAPID_PRIVATE_KEY, subject: E.VAPID_SUBJECT || 'mailto:coach@shredbyqk.app' };
  const jobs = plan({ profiles, subs, plans, day });
  let sent = 0, gone = 0;
  for (const j of jobs) {
    const st = await send(j.sub, j.msg, vapid).catch(e => { console.warn(e.message); return 0; });
    if (st === 404 || st === 410) { gone++; await fetch(`${base}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { method: 'DELETE', headers: H }); continue; }
    if (st >= 200 && st < 300) { sent++; await patch(`/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { last_sent: day, ...(j.kind === 'nudge' ? { last_nudge: day } : {}) }); }
  }
  for (const c of new Set(jobs.filter(j => j.kind === 'plan').map(j => j.client))) await patch(`/rest/v1/coach_plans?client_id=eq.${c}`, { notified_at: new Date().toISOString() });
  console.log(`${day}: ${sent} sent, ${gone} phones unsubscribed, ${jobs.length - sent - gone} failed.`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
