#!/usr/bin/env node
// Daily job: reach clients whose app is closed.
//   1. Check-in day: everyone whose next_checkin is today or earlier gets "Check-in day".
//   2. Plan updates: when QK edited a client's diet plan on the dashboard, they get "QK updated your plan".
//   3. Only for clients who chose "a gentle nudge too": one reminder after 3 quiet days, at most weekly.
//   4. Two weeks without training: "Your Fitness Age went up", at most every two weeks (needs a Fitness Age test).
//   5. QK's broadcasts from the dashboard, and QK's chat replies: sent within the hour (the hourly run sends only these).
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
  const offer = (id, kind, msg) => { const rank = { plan: 4, checkin: 3, lapse: 2, nudge: 1 }; if (!want.has(id) || rank[kind] > rank[want.get(id).kind]) want.set(id, { kind, msg }); };
  for (const c of plans) if (!(c.notified_at && c.notified_at >= c.updated_at))
    offer(c.client_id, 'plan', { title: 'QK updated your diet plan', body: c.note || 'Open Food to see your new amounts.', url: './?tab=food', tag: 'qk-plan' });
  for (const p of profiles) {
    if (p.notify === 'off') continue;
    // Once per due date: a client who stopped opening the app isn't reminded every day forever.
    const checkin = p.next_checkin && p.next_checkin <= day && !(byClient.get(p.id) || []).every(s => s.last_checkin_for === p.next_checkin);
    if (checkin) offer(p.id, 'checkin', { title: `Check-in day${first(p.id) ? ', ' + first(p.id) : ''}`, body: 'Weigh yourself before breakfast and enter it in Food. QK will read your two weeks and suggest your next step.', url: './?tab=food', tag: 'qk-checkin' });
    const quiet = p.last_food ? Math.floor((Date.parse(day) - Date.parse(p.last_food)) / 864e5) : null;
    const lastNudge = (byClient.get(p.id) || []).map(s => s.last_nudge).filter(Boolean).sort().pop();
    const lapse = lapseMsg(p, day);
    if (lapse) offer(p.id, 'lapse', lapse);
    if (nudgeDue({ level: p.notify || 'essential', daysSinceFood: quiet, lastNudge, checkinToday: checkin, today: day }))
      offer(p.id, 'nudge', { title: `Hi${first(p.id) ? ' ' + first(p.id) : ''}, QK here`, body: 'Snap your next meal when you get a moment. One photo keeps your week on track.', url: './?tab=food', tag: 'qk-nudge' });
  }
  const out = [];
  for (const [id, w] of want) {
    if (P.get(id)?.notify === 'off') continue; // Off means off, plan updates included
    for (const s of byClient.get(id) || []) if (s.last_sent !== day) out.push({ sub: s, kind: w.kind, client: id, msg: w.msg, due: P.get(id)?.next_checkin || null });
  }
  return out;
}

/** "Your Fitness Age went up": 14+ days since training, a Fitness Age that drops the activity term, not sent in 14 days. */
export function lapseMsg(p, day) {
  const fa = p.care?.fitAge, off = p.last_train ? Math.floor((Date.parse(day) - Date.parse(p.last_train)) / 864e5) : null;
  if (!fa?.ifStopped || !(fa.ifStopped > fa.fa) || off === null || off < 14) return null;
  if (p.lapse_sent && (Date.parse(day) - Date.parse(p.lapse_sent)) / 864e5 < 14) return null;
  const first = (p.name || '').split(' ')[0];
  return { title: `${first ? first + ', your' : 'Your'} Fitness Age went up to ${fa.ifStopped}`, body: `It was ${fa.fa} when you were training. ${off} days off and it's slipping. One session this week starts bringing it back.`, url: './', tag: 'qk-lapse' };
}

/** The coach's broadcasts not yet pushed: one notification per phone. Skips clients who turned notifications off
 *  (they still see it in the app). messages: [{ id, client_id, title, body }]. */
export function broadcastJobs({ messages = [], subs = [], profiles = [] }) {
  const P = new Map(profiles.map(p => [p.id, p])), out = [];
  for (const m of messages) {
    if (P.get(m.client_id)?.notify === 'off') continue;
    for (const s of subs) if (s.client_id === m.client_id) out.push({ sub: s, kind: 'broadcast', client: m.client_id, id: m.id, msg: { title: m.title || 'QK', body: m.body, url: './', tag: 'qk-b' + m.id } });
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
    get('/rest/v1/profiles?role=eq.client&select=id,name,next_checkin,notify,last_food,last_train,lapse_sent,care'),
    get('/rest/v1/push_subs?select=*'),
    get('/rest/v1/coach_plans?select=client_id,note,updated_at,notified_at'),
  ]);
  const vapid = { publicKey: E.VAPID_PUBLIC_KEY, privateKey: E.VAPID_PRIVATE_KEY, subject: E.VAPID_SUBJECT || 'mailto:coach@shredbyqk.app' };
  // Broadcasts first (every run); the daily reminders only on the morning and evening runs.
  const msgs = await get('/rest/v1/messages?kind=eq.broadcast&pushed_at=is.null&select=id,client_id,title,body&limit=5000').catch(() => []);
  // QK's chat replies the client hasn't seen: one "QK replied" per client (the latest), sent within the hour.
  const replies = await get('/rest/v1/chats?sender=eq.coach&pushed_at=is.null&read_at=is.null&order=created_at.desc&select=id,client_id,body&limit=2000').catch(() => []);
  const latest = [...new Map(replies.map(r => [r.client_id, r])).values()].reverse();
  const bjobs = broadcastJobs({ messages: [...msgs, ...latest.map(r => ({ id: 'c' + r.id, client_id: r.client_id, title: 'QK replied', body: r.body.slice(0, 140) }))], subs, profiles });
  const jobs = E.PUSH_ONLY === 'broadcasts' ? [] : plan({ profiles, subs, plans, day });
  let sent = 0, gone = 0;
  for (const j of bjobs) {
    const st = await send(j.sub, j.msg, vapid).catch(e => { console.warn(e.message); return 0; });
    if (st === 404 || st === 410) { gone++; await fetch(`${base}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { method: 'DELETE', headers: H }); }
    else if (st >= 200 && st < 300) sent++;
  }
  if (msgs.length) await patch(`/rest/v1/messages?id=in.(${msgs.map(m => m.id).join(',')})`, { pushed_at: new Date().toISOString() });
  if (replies.length) await patch(`/rest/v1/chats?id=in.(${replies.map(m => m.id).join(',')})`, { pushed_at: new Date().toISOString() });
  for (const j of jobs) {
    const st = await send(j.sub, j.msg, vapid).catch(e => { console.warn(e.message); return 0; });
    if (st === 404 || st === 410) { gone++; await fetch(`${base}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { method: 'DELETE', headers: H }); continue; }
    if (st >= 200 && st < 300) { sent++; j.ok = true; await patch(`/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { last_sent: day, ...(j.kind === 'nudge' ? { last_nudge: day } : {}), ...(j.kind === 'checkin' ? { last_checkin_for: j.due } : {}) }); }
  }
  // A plan update counts as notified only if it reached at least one of the client's phones.
  for (const c of new Set(jobs.filter(j => j.kind === 'plan' && j.ok).map(j => j.client))) await patch(`/rest/v1/coach_plans?client_id=eq.${c}`, { notified_at: new Date().toISOString() });
  for (const c of new Set(jobs.filter(j => j.kind === 'lapse').map(j => j.client))) await patch(`/rest/v1/profiles?id=eq.${c}`, { lapse_sent: day });
  console.log(`${day}: ${sent} sent (${msgs.length} broadcast messages), ${gone} phones unsubscribed, ${jobs.length + bjobs.length - sent - gone} failed.`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
