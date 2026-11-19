// Browser test of the account features: two-factor sign-in (required for researchers), self-enrolment for a
// participant, password change, the session list and "sign out other sessions". Real server on 127.0.0.1, in-memory
// database, Secure cookies ON, synthetic data. Run: node research/tests/e2e-account.cjs
const { chromium } = require('playwright');
const http = require('http');
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };

(async () => {
  const { openStore } = await import('../server/store.js');
  const { createApp } = await import('../server/server.js');
  const { seedDemo } = await import('../tools/seed.mjs');
  let totp = () => '000000'; try { ({ totp } = await import('../server/totp.js')); } catch (e) { check('module server/totp.js exists', false, e.message); }
  let clock = Date.now(); const tick = () => { clock += 30000; };
  const store = openStore(':memory:', { now: () => clock }), PW = 'synthetic-pass-123', NEW = 'brand-new-password-77';
  const rid = store.createUser({ username: 'researcher', password: PW, role: 'researcher' });
  seedDemo(store, { researcherId: rid });
  store.createUser({ username: 'p_demo_a', password: PW, role: 'participant', participantId: store.participantByRef('P-DEMO-A').id });
  const server = http.createServer(createApp({ store, settings: { secureCookies: true, idleMs: 30 * 60e3, absoluteMs: 8 * 36e5, requireMfaRoles: ['admin', 'researcher'] }, log: () => {}, now: () => clock }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const b = await chromium.launch(), errs = [], external = [];
  const ctx = await b.newContext(), p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of (401|403)/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  ctx.on('request', r => { if (!r.url().startsWith(BASE)) external.push(r.url()); });
  const msg = async () => (await p.textContent('#lmsg').catch(() => '')) || '';
  const signIn = async (u, pw = PW) => { await p.goto(BASE + '/'); await p.waitForSelector('#login'); await p.fill('#u', u); await p.fill('#p', pw); await p.click('#login button[type=submit]'); await p.waitForTimeout(400); };

  try {
    // 1. Researcher without two-factor: refused with an explanation.
    await signIn('researcher');
    check('mfa ui: a researcher without two-factor is told it must be set up first', /two-factor/i.test(await msg()) && !!(await p.$('#login')), await msg());
    // The operator enrols the researcher (CLI path).
    const e = store.mfaBegin(rid); store.mfaConfirm(rid, totp(e.secret, clock));
    tick();
    await signIn('researcher');
    check('mfa ui: after the password, a code field appears', !!(await p.$('#code')), await msg());
    await p.fill('#code', '000000'); await p.click('#login button[type=submit]'); await p.waitForTimeout(400);
    check('mfa ui: a wrong code is refused and stays on the sign-in form', !!(await p.$('#login')) && /failed/i.test(await msg()), await msg());
    // A wrong code ends the two-step state: the person starts again with password and code.
    await signIn('researcher');
    await p.waitForSelector('#code', { timeout: 2000 }).catch(() => {});
    // A fresh time step, so the code was not used by enrolment (the server clock is simulated).
    tick();
    await p.fill('#code', totp(e.secret, clock)); await p.click('#login button[type=submit]'); await p.waitForTimeout(500);
    check('mfa ui: password + valid code signs in', !!(await p.$('text=Your assigned participants')), await msg());
    check('mfa ui: the password field is cleared after the two-step sign-in', (await p.$('#p')) === null);

    // 2. Account page: sessions and sign-out of others.
    const other = await b.newContext(), op = await other.newPage();
    tick();
    const lr = await op.request.post(BASE + '/api/login', { data: { username: 'researcher', password: PW, code: totp(e.secret, clock) } });
    check('account ui: a second session exists (other browser)', lr.status() === 200, String(lr.status()));
    await p.click('[data-act=account]'); await p.waitForSelector('#account');
    const rows = await p.$$('#sessions li');
    check('account ui: the session list shows both sessions, this one marked', rows.length === 2 && /this session/i.test(await p.textContent('#sessions')), String(rows.length));
    check('account ui: two-factor status is shown as on and required', /on/i.test(await p.textContent('#mfastatus')) && /required/i.test(await p.textContent('#mfastatus')));
    await p.click('[data-act=revoke-others]'); await p.waitForTimeout(400);
    check('account ui: "sign out other sessions" leaves only this one', (await p.$$('#sessions li')).length === 1 && (await op.request.get(BASE + '/api/me')).status() === 401);
    // 3. Password change (needs a code because two-factor is on).
    tick();
    await p.fill('#pwcur', 'not-the-password'); await p.fill('#pwnew', NEW); await p.fill('#pwcode', totp(e.secret, clock)); await p.click('#pwform button[type=submit]'); await p.waitForTimeout(400);
    check('account ui: a wrong current password is reported', /current password/i.test(await p.textContent('#pwmsg')), await p.textContent('#pwmsg'));
    tick();
    await p.fill('#pwcur', PW); await p.fill('#pwnew', NEW); await p.fill('#pwcode', totp(e.secret, clock)); await p.click('#pwform button[type=submit]'); await p.waitForTimeout(400);
    check('account ui: the password is changed', /changed/i.test(await p.textContent('#pwmsg')), await p.textContent('#pwmsg'));
    check('account ui: the password fields are cleared after a change', (await p.inputValue('#pwcur')) === '' && (await p.inputValue('#pwnew')) === '');
    await p.click('[data-act=logout]'); await p.waitForSelector('#login');
    await signIn('researcher', PW);
    check('account ui: the old password no longer works', !!(await p.$('#login')) && !(await p.$('#code')));

    // 4. Participant self-enrolment (two-factor optional for participants).
    await signIn('p_demo_a');
    check('participant ui: signs in without two-factor', !!(await p.$('[data-participant="P-DEMO-A"]')));
    await p.click('[data-act=account]'); await p.waitForSelector('#account');
    check('participant ui: two-factor shown as off and optional', /off/i.test(await p.textContent('#mfastatus')) && /optional/i.test(await p.textContent('#mfastatus')));
    await p.fill('#mfapw', PW); await p.click('#mfasetup button[type=submit]'); await p.waitForSelector('#mfasecret');
    const secret = (await p.textContent('#mfasecret')).replace(/\s+/g, '');
    check('participant ui: setup shows the secret to type into an authenticator app (no QR service is contacted)', /^[A-Z2-7]{32}$/.test(secret) && external.length === 0, secret);
    await p.fill('#mfacode', totp(secret, clock)); await p.click('#mfaconfirm button[type=submit]'); await p.waitForSelector('#recovery li');
    check('participant ui: confirming shows 10 one-time recovery codes', (await p.$$('#recovery li')).length === 10);
    check('participant ui: status now shows two-factor on', /on/i.test(await p.textContent('#mfastatus')));
  } catch (err) { check('e2e-account run completed', false, err.stack); }
  check('no external requests', external.length === 0, external.join(' '));
  check('no script, CSP or console errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
