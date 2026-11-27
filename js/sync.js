// Talks to the coach server (Supabase) over plain HTTPS: no SDK, so nothing extra to download or cache.
// Used by the client app (sign in with an email code, join a coach, sync numbers, read coach messages)
// and by the coach dashboard (sign in, list clients, send cheers).
// Only numbers are sent: sets, reps, weights, form scores, check-ins, app opens, and food totals with dish
// names (no photos). Never video.
// The fetch function is injected, so this is unit tested without a network.

import { foodDayRows, foodWeekSummary, placeRows } from './foodsync.js';
import { careSummary } from './dash.js';
import { weekScore, weekStart, weekKey } from './leaderboard.js';
import { allWeights, daysToCheckin, checkinDue } from './adapt.js';
import { notifyLevel } from './signals.js';
import { allScores, scoreSummary } from './scores.js';

export class Cloud {
  /** @param o { url, anonKey, fetch, session: { access_token, refresh_token, expires_at, user } | null, onSession } */
  constructor({ url, anonKey, fetch: f = globalThis.fetch?.bind(globalThis), session = null, onSession = () => {} }) {
    this.url = url.replace(/\/$/, ''); this.key = anonKey; this.f = f; this.session = session; this.onSession = onSession;
  }
  get uid() { return this.session?.user?.id || null; }
  get signedIn() { return !!this.session?.access_token; }

  async req(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
    if (auth) await this.fresh();
    const h = { apikey: this.key, 'Content-Type': 'application/json', ...headers };
    if (auth && this.session) h.Authorization = `Bearer ${this.session.access_token}`;
    const res = await this.f(this.url + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
    const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) { const e = new Error(data?.msg || data?.message || data?.error_description || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }
  setSession(s) {
    this.session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user } : null;
    this.onSession(this.session);
  }
  // Tokens last an hour; refresh a minute before they run out.
  async fresh() {
    const s = this.session; if (!s?.refresh_token || s.expires_at * 1000 - Date.now() > 60e3) return;
    try { this.setSession(await this.req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token }, auth: false })); }
    catch (e) { if (e.status === 400 || e.status === 401) this.setSession(null); throw e; }
  }

  /* ---- sign in with a 6-digit email code ---- */
  sendCode(email) { return this.req('/auth/v1/otp', { method: 'POST', auth: false, body: { email: email.trim(), create_user: true } }); }
  async verify(email, code) { const s = await this.req('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'email', email: email.trim(), token: String(code).trim() } }); this.setSession(s); return s.user; }
  signOut() { this.setSession(null); }

  /* ---- client ---- */
  joinCoach(code) { return this.req('/rest/v1/rpc/join_coach', { method: 'POST', body: { code } }); }
  me() { return this.req(`/rest/v1/profiles?id=eq.${this.uid}&select=*`).then(r => r?.[0] || null); }
  /** Save this phone's push address so check-in reminders reach it while the app is closed. */
  savePush(sub) { const j = sub.toJSON ? sub.toJSON() : sub; return this.upsert('push_subs', [{ client_id: this.uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }], 'endpoint'); }
  /** The plan QK edited for me, or null. */
  coachPlan() { return this.req(`/rest/v1/coach_plans?client_id=eq.${this.uid}&select=plan,note,updated_at`).then(r => r?.[0] || null); }
  updateMe(fields) { return this.req(`/rest/v1/profiles?id=eq.${this.uid}`, { method: 'PATCH', body: fields, headers: { Prefer: 'return=minimal' } }); }
  upsert(table, rows, conflict) {
    if (!rows.length) return Promise.resolve();
    return this.req(`/rest/v1/${table}?on_conflict=${conflict}`, { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  }
  opened() { return this.req('/rest/v1/events', { method: 'POST', body: { client_id: this.uid, kind: 'open' }, headers: { Prefer: 'return=minimal' } }); }
  unread() { return this.req(`/rest/v1/messages?client_id=eq.${this.uid}&read_at=is.null&order=created_at.asc&select=id,kind,title,body,created_at`); }
  /** Leaderboard: this week's (or, with months = 1, this month's) top 50 plus my own row. */
  leaderboard(week, months = 0) { return this.req('/rest/v1/rpc/leaderboard', { method: 'POST', body: { wk: week, months } }); }
  prizes() { return this.req('/rest/v1/rpc/my_prizes', { method: 'POST', body: {} }); }
  myRewards() { return this.req(`/rest/v1/rewards?client_id=eq.${this.uid}&select=month,place,prize,given_at&order=month.desc`); }
  markRead(ids) { return ids.length ? this.req(`/rest/v1/messages?id=in.(${ids.join(',')})`, { method: 'PATCH', body: { read_at: new Date().toISOString() }, headers: { Prefer: 'return=minimal' } }) : Promise.resolve(); }

  /* ---- coach ---- */
  clients() { return this.req(`/rest/v1/profiles?coach_id=eq.${this.uid}&select=*`); }
  since(table, ids, fromIso) {
    if (!ids.length) return Promise.resolve([]);
    return this.req(`/rest/v1/${table}?client_id=in.(${ids.join(',')})&at=gte.${encodeURIComponent(fromIso)}&order=at.asc&limit=10000`);
  }
  /** Coach: save a client's edited diet plan (they see it next time the app syncs, plus a notification). */
  setPlan(clientId, plan, note = '') { return this.upsert('coach_plans', [{ client_id: clientId, coach_id: this.uid, plan, note, updated_at: new Date().toISOString(), notified_at: null }], 'client_id'); }
  plans(ids) { return ids.length ? this.req(`/rest/v1/coach_plans?client_id=in.(${ids.join(',')})&select=*`) : Promise.resolve([]); }
  send(clientId, kind, body) { return this.req('/rest/v1/messages', { method: 'POST', body: { coach_id: this.uid, client_id: clientId, kind, body }, headers: { Prefer: 'return=minimal' } }); }
  /** One message per client (they see it in the app; the push job sends it as a notification within the hour). */
  broadcast(clientIds, title, bodyFor) { return clientIds.length ? this.req('/rest/v1/messages', { method: 'POST', body: clientIds.map(id => ({ coach_id: this.uid, client_id: id, kind: 'broadcast', title, body: bodyFor(id) })), headers: { Prefer: 'return=minimal' } }) : Promise.resolve(); }
  scores(ids, fromWeek) { return ids.length ? this.req(`/rest/v1/scores?client_id=in.(${ids.join(',')})&week=gte.${fromWeek}&select=client_id,week,score,parts`) : Promise.resolve([]); }
  setPrizes(prizes) { return this.updateMe({ prizes }); }
  rewards(month) { return this.req(`/rest/v1/rewards?coach_id=eq.${this.uid}&month=eq.${month}&select=*`); }
  setReward(row) { return this.upsert('rewards', [{ coach_id: this.uid, ...row }], 'client_id,month'); }
  sent(fromIso) { return this.req(`/rest/v1/messages?coach_id=eq.${this.uid}&created_at=gte.${encodeURIComponent(fromIso)}&order=created_at.desc`); }
}

/** A local set → a server row (numbers only). */
export const sessionRow = (uid, s) => ({
  client_id: uid, at: new Date(s.at).toISOString(), ex: s.ex, name: s.name ?? null, reps: s.reps ?? null, good: s.good ?? null,
  kg: s.kg ?? null, secs: s.secs ?? null, target: s.target ?? null, guided: !!s.guided, faults: s.faults || null, vl: s.vl ?? null,
});

/**
 * Push everything new since the last sync. Returns the new high-water marks.
 * @param S app state, @param mark { sessions, checkins } timestamps already pushed
 */
export async function pushAll(cloud, S, mark = {}) {
  const uid = cloud.uid; if (!uid) return mark;
  const classSets = (S.classes || []).filter(c => c.at > (mark.classes || 0)).map(c => ({ at: c.at, ex: 'class:' + c.class, name: c.name, reps: 0, good: 0, secs: (c.minutes || 0) * 60, guided: true }));
  const sets = [...(S.sessions || []).filter(s => !s.demo && s.at > (mark.sessions || 0)), ...classSets];
  const checks = (S.checkins || []).filter(c => c.at > (mark.checkins || 0));
  await cloud.upsert('sessions', sets.map(s => sessionRow(uid, s)), 'client_id,at,ex');
  await cloud.upsert('checkins', checks.map(c => ({ client_id: uid, at: new Date(c.at).toISOString(), data: c })), 'client_id,at');
  // Food: the last 8 days (re-sent, so edits catch up), places the client added, and the weekly summary.
  // If the server hasn't got the food tables yet (supabase/schema.sql not re-run), training still syncs.
  let food = null;
  try {
    await cloud.upsert('food_days', foodDayRows(uid, S), 'client_id,at');
    await cloud.upsert('places', placeRows(uid, S), 'client_id,name');
    food = foodWeekSummary(S);
  } catch (e) { console.warn('food sync skipped:', e.message); }
  // The next check-in date (for reminders while the app is closed) and the full diet plan (for QK to edit).
  // Servers set up before these columns existed just skip them.
  const lastFood = Math.max(0, ...(S.food?.log || []).map(e => e.at));
  const extra = { next_checkin: nextCheckin(S), diet_plan: S.food?.plan || null, notify: notifyLevel(S), scores: scoreSummary(allScores(S)), last_food: lastFood ? new Date(lastFood).toISOString().slice(0, 10) : null };
  try { await cloud.updateMe(extra); } catch (e) { console.warn('check-in/plan sync skipped:', e.message); }
  // Leaderboard: this week's and last week's score (last week settles on Monday), nickname, last training day.
  try {
    const now = Date.now(), lastT = Math.max(0, ...(S.sessions || []).filter(s => !s.demo).map(s => s.at), ...(S.classes || []).map(c => c.at));
    await cloud.updateMe({ nickname: S.profile?.nickname || null, board_hidden: !!S.profile?.boardHidden, last_train: lastT ? new Date(lastT).toISOString().slice(0, 10) : null });
    const rows = [weekStart(now), weekStart(now) - 7 * 864e5].map(ws => { const r = weekScore(S, ws, now); return { client_id: uid, week: weekKey(ws), score: r.score, parts: r.parts, updated_at: new Date().toISOString() }; });
    await cloud.upsert('scores', rows.filter(r => r.score > 0), 'client_id,week');
  } catch (e) { console.warn('leaderboard sync skipped:', e.message); }
  await cloud.updateMe({
    ...(food ? { food_week: food } : {}),
    name: S.profile?.name || null, goal: S.profile?.goal || null, weekly_goal: S.profile?.weeklyGoal || null,
    plan: S.plan || null, program: S.program ? { id: S.program.id, name: (S.customPrograms || []).find(p => p.id === S.program.id)?.name, block: S.program.block || 1, start: S.program.start, blockStart: S.program.blockStart } : null,
    care: careSummary(S),
    last_seen: new Date().toISOString(),
  });
  return {
    sessions: Math.max(mark.sessions || 0, ...sets.filter(s => !String(s.ex).startsWith('class:')).map(s => s.at)),
    classes: Math.max(mark.classes || 0, ...classSets.map(s => s.at)),
    checkins: Math.max(mark.checkins || 0, ...checks.map(c => c.at)),
  };
}

/** The date of the next two-weekly check-in, as YYYY-MM-DD (today when it's due). */
export function nextCheckin(S, now = Date.now()) {
  const ws = allWeights(S), A = S.food?.adapt || {};
  const d = new Date(now + (checkinDue(ws, A, now) ? 0 : daysToCheckin(ws, A, now)) * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
