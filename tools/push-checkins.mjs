#!/usr/bin/env node
// Daily job: reach clients whose app is closed.
//   1. Check-in day: everyone whose next_checkin is today or earlier gets "Check-in day with QK" (once a day).
//   2. Plan updates: when QK edited a client's diet plan on the dashboard, they get "QK updated your plan".
// Runs from .github/workflows/push.yml (no server needed), or by hand:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@… node tools/push-checkins.mjs
// The service-role key bypasses the privacy rules, so it lives only in GitHub's encrypted secrets.
import { send } from './webpush.mjs';

const E = process.env;
const today = (now = Date.now(), tz = 'Asia/Karachi') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD

/** Who gets what today. Pure, so it's unit tested: profiles, subs, plans → [{ sub, msg }]. */
export function plan({ profiles, subs, plans, day }) {
  const out = [], byClient = new Map();
  for (const s of subs) (byClient.get(s.client_id) || byClient.set(s.client_id, []).get(s.client_id)).push(s);
  const name = id => (profiles.find(p => p.id === id)?.name || '').split(' ')[0];
  for (const p of profiles) {
    if (!p.next_checkin || p.next_checkin > day) continue;
    for (const s of byClient.get(p.id) || []) if (s.last_sent !== day)
      out.push({ sub: s, kind: 'checkin', msg: { title: `Check-in day${name(p.id) ? ', ' + name(p.id) : ''}`, body: 'Weigh yourself before breakfast and enter it in Food. QK will read your two weeks and suggest your next step.', url: './?tab=food', tag: 'qk-checkin' } });
  }
  for (const c of plans) {
    if (c.notified_at && c.notified_at >= c.updated_at) continue;
    for (const s of byClient.get(c.client_id) || [])
      out.push({ sub: s, kind: 'plan', client: c.client_id, msg: { title: 'QK updated your diet plan', body: c.note || 'Open Food to see your new amounts.', url: './?tab=food', tag: 'qk-plan' } });
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
    get(`/rest/v1/profiles?role=eq.client&next_checkin=lte.${day}&select=id,name,next_checkin`),
    get('/rest/v1/push_subs?select=*'),
    get('/rest/v1/coach_plans?select=client_id,note,updated_at,notified_at'),
  ]);
  const vapid = { publicKey: E.VAPID_PUBLIC_KEY, privateKey: E.VAPID_PRIVATE_KEY, subject: E.VAPID_SUBJECT || 'mailto:coach@shredbyqk.app' };
  const jobs = plan({ profiles, subs, plans, day });
  let sent = 0, gone = 0;
  for (const j of jobs) {
    const st = await send(j.sub, j.msg, vapid).catch(e => { console.warn(e.message); return 0; });
    if (st === 404 || st === 410) { gone++; await fetch(`${base}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { method: 'DELETE', headers: H }); continue; }
    if (st >= 200 && st < 300) { sent++; if (j.kind === 'checkin') await patch(`/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(j.sub.endpoint)}`, { last_sent: day }); }
  }
  for (const c of new Set(jobs.filter(j => j.kind === 'plan').map(j => j.client))) await patch(`/rest/v1/coach_plans?client_id=eq.${c}`, { notified_at: new Date().toISOString() });
  console.log(`${day}: ${sent} sent, ${gone} phones unsubscribed, ${jobs.length - sent - gone} failed.`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
