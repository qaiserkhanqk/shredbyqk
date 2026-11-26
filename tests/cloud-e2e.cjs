// End-to-end: client connects to a coach, sets sync, the coach sees them and sends a cheer, the client hears it.
// Runs the real app and dashboard in Chromium against a fake Supabase (in memory), so no account is needed.
// Run: node tests/cloud-e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// Fake Supabase: the auth endpoints and the handful of REST calls the app makes, with the same privacy rules.
const DB = { users: {}, profiles: {}, sessions: [], events: [], checkins: [], messages: [] };
const COACH = 'coach-1'; DB.profiles[COACH] = { id: COACH, role: 'coach', name: 'QK', invite_code: 'QKTEST' };
let tokenN = 0; const tokens = {};
function fakeSupabase(route) {
  const req = route.request(), u = new URL(req.url()), body = req.postData() ? JSON.parse(req.postData()) : null;
  const json = (status, data) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: data == null ? '' : JSON.stringify(data) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const p = u.pathname;
  if (p === '/auth/v1/otp') return json(200, {});
  if (p === '/auth/v1/verify') {
    if (body.token !== '123456') return json(403, { msg: 'Token has expired or is invalid' });
    const id = body.email === 'qk@coach.com' ? COACH : DB.users[body.email] ||= 'client-' + Object.keys(DB.users).length;
    DB.profiles[id] ||= { id, role: 'client', name: body.email.split('@')[0] };
    const t = 'T' + ++tokenN; tokens[t] = id;
    return json(200, { access_token: t, refresh_token: 'R' + tokenN, expires_in: 3600, user: { id, email: body.email } });
  }
  const uid = tokens[(req.headers().authorization || '').replace('Bearer ', '')];
  if (!uid) return json(401, { message: 'JWT expired' });
  const q = k => u.searchParams.get(k) || '';
  const inList = k => (q(k).match(/^in\.\((.*)\)$/) || [, ''])[1].split(',').filter(Boolean);
  const mine = cid => cid === uid || DB.profiles[cid]?.coach_id === uid;
  if (p === '/rest/v1/rpc/join_coach') { const c = Object.values(DB.profiles).find(x => x.invite_code === body.code.toUpperCase()); if (!c) return json(400, { message: 'No coach with that code' }); DB.profiles[uid].coach_id = c.id; return json(200, c.name); }
  if (p === '/rest/v1/profiles' && req.method() === 'GET') { if (q('id')) return json(200, [DB.profiles[q('id').slice(3)]].filter(x => x && (x.id === uid || x.coach_id === uid))); return json(200, Object.values(DB.profiles).filter(x => x.coach_id === uid)); }
  if (p === '/rest/v1/profiles' && req.method() === 'PATCH') { const { role, invite_code, coach_id, ...ok } = body; Object.assign(DB.profiles[uid], ok); return json(204); }
  for (const t of ['sessions', 'events', 'checkins']) if (p === '/rest/v1/' + t) {
    if (req.method() === 'POST') { for (const r of [].concat(body)) { if ((r.client_id || uid) !== uid) return json(403, { message: 'RLS' }); const row = { ...r, client_id: uid, at: r.at || new Date().toISOString() }; const i = DB[t].findIndex(x => x.client_id === uid && x.at === row.at && x.ex === row.ex); i >= 0 ? (DB[t][i] = row) : DB[t].push(row); } return json(201); }
    return json(200, DB[t].filter(r => inList('client_id').includes(r.client_id) && mine(r.client_id)));
  }
  if (p === '/rest/v1/messages') {
    if (req.method() === 'POST') { if (body.coach_id !== uid || DB.profiles[body.client_id]?.coach_id !== uid) return json(403, { message: 'RLS' }); DB.messages.push({ id: DB.messages.length + 1, ...body, created_at: new Date().toISOString(), read_at: null }); return json(201); }
    if (req.method() === 'PATCH') { for (const id of inList('id')) { const m = DB.messages.find(x => x.id === +id && x.client_id === uid); if (m) m.read_at = body.read_at; } return json(204); }
    if (q('client_id')) return json(200, DB.messages.filter(m => m.client_id === uid && !m.read_at));
    return json(200, DB.messages.filter(m => m.coach_id === uid));
  }
  return json(404, { message: 'not faked: ' + p });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('https://fake.supabase.co/**', fakeSupabase);
  await ctx.route('https://shred.local/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    // Point the app at the fake server.
    if (p === '/js/cloud-config.js') return r.fulfill({ status: 200, contentType: 'text/javascript', body: "export const CLOUD = { url: 'https://fake.supabase.co', anonKey: 'anon' }; export const cloudOn = () => true;" });
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
  });
  const errs = [];
  // Client: sign up, log two sets (injected), connect to the coach.
  const c = await ctx.newPage(); c.on('pageerror', e => errs.push('client: ' + e.message));
  await c.goto('https://shred.local/');
  await c.fill('#welcomeName', 'Sara'); await c.click('#welcomeBtn'); await c.click('[data-focus=train]'); await c.click('[data-goal=hyrox]'); await c.click('#obDone');
  await c.evaluate(() => { const S = JSON.parse(localStorage.getItem('shred_qk_v1')); const now = Date.now(); S.sessions = [0, 1].map(i => ({ at: now - 3600e3 + i * 6e4, ex: 'squat', name: 'Back Squat', reps: 8, good: 8 - i, kg: 60 })); localStorage.setItem('shred_qk_v1', JSON.stringify(S)); });
  await c.reload(); await c.waitForTimeout(400);
  await c.click('.tabs [data-tab=progress]'); await c.click('#coachLink summary');
  check('client: "Your coach" card appears when the server is set up', await c.isVisible('#clEmail'));
  await c.fill('#clEmail', 'sara@example.com'); await c.click('#clSend'); await c.waitForTimeout(300);
  await c.fill('#clCode', '123456'); await c.click('#clVerify'); await c.waitForTimeout(300);
  check('client: email code accepted, asks for the invite code', await c.isVisible('#clInvite'));
  await c.fill('#clInvite', 'nope'); await c.click('#clJoin'); await c.waitForTimeout(300);
  check('client: wrong invite code explained', /didn't match/.test(await c.textContent('#toast')));
  await c.fill('#clInvite', 'qktest'); await c.click('#clJoin'); await c.waitForTimeout(1500);
  check('client: connected to the coach', /Connected to QK/.test(await c.textContent('#clStatus')), await c.textContent('#clStatus'));
  check('server: the sets arrived (numbers only)', DB.sessions.length === 2 && DB.sessions.every(r => r.client_id === 'client-0' && r.kg === 60 && !('video' in r)), JSON.stringify(DB.sessions[0] || {}));
  check('server: profile has the program, app open logged', DB.profiles['client-0'].program?.id === 'raceReady' && DB.events.length >= 1);

  // Coach: sign in on the dashboard, sees Sara, sends a cheer.
  const k = await ctx.newPage(); k.on('pageerror', e => errs.push('coach: ' + e.message));
  await k.setViewportSize({ width: 1200, height: 900 });
  await k.goto('https://shred.local/coach.html'); await k.waitForTimeout(300);
  check('coach: asks to sign in', await k.isVisible('#cdEmail'));
  await k.fill('#cdEmail', 'qk@coach.com'); await k.click('#cdSend'); await k.waitForTimeout(200);
  await k.fill('#cdCode', '123456'); await k.click('#cdVerify'); await k.waitForTimeout(800);
  check('coach: invite code shown', /QKTEST/.test(await k.textContent('#cdMe')));
  check('coach: sees the client, trained today, on track', /Sara|sara/i.test(await k.textContent('#cdList')) && /seen today/.test(await k.textContent('#cdList')), (await k.textContent('#cdList')).replace(/\s+/g, ' '));
  await k.click('[data-client=client-0]'); await k.waitForTimeout(200);
  check('coach: client detail shows program and sets', /Race Ready · month 1/.test(await k.textContent('#cdDetail')) && /Sets this week\s*2/.test(await k.textContent('#cdDetail')));
  await k.fill('#cdText', 'Huge first session, Sara!'); await k.click('#cdSendMsg'); await k.waitForTimeout(300);
  check('server: the cheer was stored for Sara', DB.messages.length === 1 && DB.messages[0].client_id === 'client-0');

  // Client opens the app again: QK reads the message.
  await c.reload(); await c.waitForTimeout(2500);
  const caption = await c.textContent('[data-coach-caption]').catch(() => '');
  check('client: QK reads the coach\'s message out', /Message from QK\. Huge first session, Sara!/.test(caption) || /QK: Huge first session/.test(await c.textContent('#toast')), caption);
  check('server: message marked read', !!DB.messages[0].read_at);
  check('no JavaScript errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'cloud e2e: ALL PASS'); process.exit(fails ? 1 : 0);
})();
