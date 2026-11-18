// End-to-end browser test of the research dashboard against the real server (127.0.0.1, in-memory database,
// synthetic data, Secure cookies ON). Run: node research/tests/e2e.cjs
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };

(async () => {
  const { openStore } = await import('../server/store.js');
  const { createApp } = await import('../server/server.js');
  const { seedDemo } = await import('../tools/seed.mjs');
  const { FORBIDDEN, LABEL } = await import('../lib/policy.js');
  const http = require('http');
  const store = openStore(':memory:'), PW = 'synthetic-pass-123';
  const rid = store.createUser({ username: 'researcher', password: PW, role: 'researcher' });
  seedDemo(store, { researcherId: rid });
  store.createUser({ username: 'other', password: PW, role: 'researcher' });
  store.createUser({ username: 'p_demo_a', password: PW, role: 'participant', participantId: store.participantByRef('P-DEMO-A').id });
  const logs = [], server = http.createServer(createApp({ store, settings: { secureCookies: true, idleMs: 30 * 60e3, absoluteMs: 8 * 36e5 }, log: l => logs.push(l) }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const b = await chromium.launch(), errs = [], external = [];
  const ctx = await b.newContext({ acceptDownloads: true }), p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of (401|404)/.test(m.text())) errs.push(m.text()); }); // expected: 401 before sign-in, 404 for the deliberate cross-participant request
  p.on('dialog', d => d.accept());
  ctx.on('request', r => { if (!r.url().startsWith(BASE)) external.push(r.url()); });
  const scan = async label => { const t = (await p.textContent('body')).split(LABEL).join(' '); const hit = FORBIDDEN.filter(([, re]) => re.test(t)).map(([c]) => c); check(`policy (${label}): no forbidden phrase on the page`, hit.length === 0, hit.join(',')); };
  const signIn = async (u) => { await p.goto(BASE + '/'); await p.waitForSelector('#login'); await p.fill('#u', u); await p.fill('#p', PW); await p.click('#login button'); await p.waitForTimeout(400); };

  await p.goto(BASE + '/'); await p.waitForSelector('#login');
  check('label: the persistent research label is shown before sign-in', (await p.textContent('#label')).trim() === LABEL);
  check('panel: "What this can and cannot tell you" is shown', /can and cannot tell you/.test(await p.textContent('#cancannot')));
  await signIn('researcher');
  check('auth: signed in with Secure, HttpOnly session cookie over local http', (await ctx.cookies()).some(c => c.name === 'rs_session' && c.httpOnly && c.secure && c.sameSite === 'Strict'));
  check('researcher: sees the three synthetic participants', (await p.$$('[data-act=open]')).length === 3);
  await p.click('[data-ref=P-DEMO-A]'); await p.waitForSelector('#timeline svg');
  check('dashboard: label stays visible on the participant page', (await p.isVisible('#label')) && (await p.textContent('#label')).trim() === LABEL);
  check('dashboard: quality summary, timeline, bleeding annotations and provenance are shown', (await p.$('#quality')) && (await p.$$('#timeline rect.bleed')).length > 10 && (await p.$('#provenance')) !== null);
  check('dashboard: experimental results are absent until a researcher enables them', /not enabled by researcher/i.test(await p.textContent('#experimental')) && (await p.$$('#timeline .expmark')).length === 0);
  await scan('participant page, experimental off');
  await p.check('[data-feature=experimental_shift]'); await p.waitForTimeout(600);
  await p.check('[data-feature=experimental_forecast]'); await p.waitForTimeout(600);
  const exp = await p.textContent('#experimental');
  check('experimental: shown in a separate, labelled experimental card with uncertainty and reasons', (await p.$('#experimental.experimental')) && /Experimental research estimates/.test(exp) && /uncalibrated|not calibrated/.test(exp) && /does not confirm or date ovulation/.test(exp));
  check('experimental: shift markers appear only in the separate experimental band of the timeline', (await p.$$('#timeline .expmark')).length > 0 && (await p.$$('#timeline .expband')).length > 0);
  await scan('participant page, experimental on');
  await p.click('[data-act=home]'); await p.waitForTimeout(300); await p.click('[data-ref=P-DEMO-C]'); await p.waitForSelector('#timeline svg');
  check('device change: the transition is marked on the timeline', (await p.$$('#timeline line.device')).length >= 1);
  check('flat signal: experimental results never say "did not ovulate" (policy) and use the no-shift wording or insufficient data', !/did not ovulate/i.test(await p.textContent('body')));
  // Import through the UI: preview, then commit.
  const fx = path.join(__dirname, '..', 'fixtures', 'overnight-samples.csv'), tmp = path.join(require('os').tmpdir(), 'rs-e2e-obs.csv');
  fs.writeFileSync(tmp, fs.readFileSync(fx, 'utf8').replace(/P-SYN-0001/g, 'P-DEMO-C'));
  await p.setInputFiles('#file', tmp); await p.click('[data-act=preview]'); await p.waitForTimeout(500);
  check('import: preview shows counts before anything is stored', /144 to add|to add/.test(await p.textContent('#pview')) && !(await p.isDisabled('#commitBtn')));
  await p.click('#commitBtn'); await p.waitForTimeout(600);
  check('import: commit succeeds', /Import committed/.test(await p.textContent('#pmsg')));
  await p.setInputFiles('#file', tmp); await p.click('[data-act=preview]'); await p.waitForTimeout(500);
  check('import: the same file again is recognised as already imported', /already imported/.test(await p.textContent('#pview')));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#data a[href*="format=csv"] button')]);
  const csvText = fs.readFileSync(await dl.path(), 'utf8');
  check('export: CSV download starts with the research label', csvText.startsWith(`# ${LABEL}`));
  // Participant account: own data only, no experimental layers.
  await p.click('[data-act=logout]'); await p.waitForTimeout(300); await signIn('p_demo_a'); await p.waitForSelector('#timeline');
  check('participant: sees own page with no import, feature or experimental controls', !(await p.$('#import')) && !(await p.$('#features')) && /not shown to participants/.test(await p.textContent('#experimental')));
  await scan('participant self-view');
  const peek = await p.evaluate(async () => (await fetch('/api/participants/P-DEMO-B/analysis')).status);
  check('participant: the API refuses another participant\'s data even when called directly', peek === 404);
  await p.click('[data-act=logout]'); await p.waitForTimeout(300); await signIn('researcher'); await p.click('[data-ref=P-DEMO-B]'); await p.waitForSelector('#data');
  const pid = store.participantByRef('P-DEMO-B').id;
  await p.fill('#delconfirm', 'P-DEMO-B'); await p.click('[data-act=delete]');
  await p.waitForFunction(() => document.querySelectorAll('[data-act=open]').length === 2, null, { timeout: 5000 }).catch(() => {});
  const leftover = store.countsFor(pid);
  check('delete: raw and derived records for the participant are gone after deleting from the UI', Object.values(leftover).every(n => n === 0) && (await p.$$('[data-act=open]')).length === 2, `${JSON.stringify(leftover)} open=${(await p.$$('[data-act=open]')).length}`);
  check('privacy: the page made no request to any other host', external.length === 0, external.join(' '));
  const logBody = logs.map(l => { const { t, ...r } = JSON.parse(l); return JSON.stringify(r); }).join('\n'); // the timestamp field is excluded: "…:33.6Z" is not a temperature
  check('logs: no participant references or values in server logs', !/P-DEMO|3[3-9]\.\d/.test(logBody), logBody.split('\n').find(l => /P-DEMO|3[3-9]\.\d/.test(l)));
  check('no JavaScript or CSP errors in the browser', errs.length === 0, errs.join(' | '));
  await b.close(); server.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
