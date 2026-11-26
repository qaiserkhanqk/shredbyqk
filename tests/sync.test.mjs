// Sync: email-code sign-in, token refresh, pushing only new numbers, coach messages. Fake server, no network.
import { Cloud, pushAll, sessionRow } from '../js/sync.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

// A fake Supabase: records calls, answers the auth and REST endpoints.
function fakeServer() {
  const calls = [], db = { sessions: [], checkins: [], profiles: {} }; let refreshed = 0;
  const reply = (status, body) => ({ ok: status < 400, status, text: async () => (body == null ? '' : JSON.stringify(body)) });
  const fetch = async (url, o) => {
    const u = new URL(url), body = o.body ? JSON.parse(o.body) : null; calls.push({ path: u.pathname + u.search, method: o.method, headers: o.headers, body });
    if (o.headers.apikey !== 'anon') return reply(401, { message: 'no key' });
    if (u.pathname === '/auth/v1/otp') return reply(200, {});
    if (u.pathname === '/auth/v1/verify') return body.token === '123456' ? reply(200, { access_token: 'A1', refresh_token: 'R1', expires_in: 3600, user: { id: 'u1', email: body.email } }) : reply(403, { msg: 'Token has expired or is invalid' });
    if (u.pathname === '/auth/v1/token') { refreshed++; return reply(200, { access_token: 'A2', refresh_token: 'R2', expires_in: 3600, user: { id: 'u1' } }); }
    if (o.headers.Authorization?.startsWith('Bearer ') !== true) return reply(401, { message: 'JWT required' });
    if (u.pathname === '/rest/v1/rpc/join_coach') return body.code.toUpperCase() === 'QKTEST' ? reply(200, 'QK') : reply(400, { message: 'No coach with that code' });
    if (u.pathname === '/rest/v1/sessions') { db.sessions.push(...body); return reply(201); }
    if (u.pathname === '/rest/v1/checkins') { db.checkins.push(...body); return reply(201); }
    if (u.pathname === '/rest/v1/events') return reply(201);
    if (u.pathname === '/rest/v1/profiles' && o.method === 'PATCH') { db.profiles.u1 = { ...db.profiles.u1, ...body }; return reply(204); }
    if (u.pathname === '/rest/v1/messages' && o.method === 'GET') return reply(200, [{ id: 7, kind: 'cheer', body: 'Great week, Sara!' }]);
    if (u.pathname === '/rest/v1/messages' && o.method === 'PATCH') return reply(204);
    return reply(404, { message: 'not found ' + u.pathname });
  };
  return { fetch, calls, db, get refreshed() { return refreshed; } };
}

const srv = fakeServer(); let saved = null;
const c = new Cloud({ url: 'https://x.supabase.co/', anonKey: 'anon', fetch: srv.fetch, onSession: s => { saved = s; } });
await c.sendCode('sara@example.com ');
check('code request sends the trimmed email', srv.calls[0].body.email === 'sara@example.com' && srv.calls[0].path === '/auth/v1/otp');
let err = null; try { await c.verify('sara@example.com', '000000'); } catch (e) { err = e; }
check('wrong code shows the server message', err?.message === 'Token has expired or is invalid', err?.message);
await c.verify('sara@example.com', '123456');
check('right code signs in and saves the session', c.signedIn && c.uid === 'u1' && saved?.refresh_token === 'R1');
check('joining a coach with the invite code', (await c.joinCoach('qktest')) === 'QK');
err = null; try { await c.joinCoach('nope'); } catch (e) { err = e; } check('wrong invite code is reported', /No coach/.test(err?.message));

const D = 864e5, now = Date.now();
const S = { profile: { name: 'Sara', goal: 'muscle', weeklyGoal: 4 }, plan: { days: [1, 3] }, program: { id: 'powerPump', block: 2, start: now - 40 * D, blockStart: now - 5 * D, plan: [{ huge: true }] },
  sessions: [{ at: now - 2 * D, ex: 'squat', reps: 8, good: 7, kg: 60, faults: { sq_depth: 1 } }, { at: now - D, ex: 'bench', reps: 5, good: 5, kg: 40, demo: true }, { at: now - 3600e3, ex: 'curl', reps: 10, good: 10, kg: 12 }],
  checkins: [{ at: now - D, sleepQ: 2 }] };
let mark = await pushAll(c, S, {});
check('pushes real sets only (no demo sets)', srv.db.sessions.length === 2 && srv.db.sessions.every(r => r.ex !== 'bench'));
check('rows carry numbers only, tied to the user', srv.db.sessions.every(r => r.client_id === 'u1' && !('px' in r) && !('video' in r)) && srv.db.sessions[0].faults.sq_depth === 1);
check('upsert, so a retry never duplicates', srv.calls.some(x => x.path.startsWith('/rest/v1/sessions?on_conflict=client_id,at,ex') && /merge-duplicates/.test(x.headers.Prefer)));
check('profile carries program month, not the whole plan', srv.db.profiles.u1.program.block === 2 && !('plan' in srv.db.profiles.u1.program) && srv.db.profiles.u1.name === 'Sara');
await pushAll(c, S, mark);
check('second sync sends nothing new', srv.db.sessions.length === 2 && srv.db.checkins.length === 1);
S.sessions.push({ at: now, ex: 'row', reps: 8, good: 8, kg: 50 }); mark = await pushAll(c, S, mark);
check('a new set is sent on the next sync', srv.db.sessions.length === 3 && mark.sessions === now);
S.classes = [{ at: now + 1, class: 'ignite20', name: 'Ignite 20', minutes: 21, score: null, rpe: 6 }]; mark = await pushAll(c, S, mark);
check('a finished class syncs as a training day', srv.db.sessions.length === 4 && srv.db.sessions.at(-1).ex === 'class:ignite20' && srv.db.sessions.at(-1).secs === 1260 && srv.db.sessions.at(-1).guided);
await pushAll(c, S, mark); check('and only once', srv.db.sessions.length === 4);

const msgs = await c.unread(); await c.markRead(msgs.map(m => m.id));
check('coach messages read and marked', msgs[0].body === 'Great week, Sara!' && srv.calls.some(x => x.method === 'PATCH' && x.path === '/rest/v1/messages?id=in.(7)'));

c.session.expires_at = Math.floor(Date.now() / 1000) + 10; // about to expire
await c.opened();
check('expiring token refreshed before the request', srv.refreshed === 1 && c.session.access_token === 'A2' && srv.calls.at(-1).headers.Authorization === 'Bearer A2');
check('sessionRow converts time to ISO', sessionRow('u1', { at: 0, ex: 'x' }).at === '1970-01-01T00:00:00.000Z');

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('sync: all pass');
