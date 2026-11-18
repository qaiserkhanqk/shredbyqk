// Browser regression tests for dashboard races reported against 21317c5: stale participant responses, mutations bound
// to the participant actually rendered, and import previews bound to file, type and participant. Responses are delayed
// and reordered with Playwright request interception. Real server on 127.0.0.1, in-memory database, synthetic data.
// Run: node research/tests/e2e-races.cjs
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { openStore } = await import('../server/store.js');
  const { createApp } = await import('../server/server.js');
  const { seedDemo } = await import('../tools/seed.mjs');
  const store = openStore(':memory:'), PW = 'synthetic-pass-123';
  const rid = store.createUser({ username: 'researcher', password: PW, role: 'researcher' });
  seedDemo(store, { researcherId: rid });
  const server = http.createServer(createApp({ store, settings: { secureCookies: true, idleMs: 30 * 60e3, absoluteMs: 8 * 36e5 }, log: () => {} }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext(), p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  // Delay any GET for participant A by `delayA` ms (0 = no delay).
  let delayA = 0;
  // The server answers immediately; the RESPONSE is held back, so it arrives late with real data (as on a slow network).
  await p.route(/\/api\/participants\/P-DEMO-A(\/analysis)?(\?.*)?$/, async route => {
    if (route.request().method() !== 'GET' || !delayA) return route.continue().catch(() => {});
    const resp = await route.fetch().catch(() => null); await sleep(delayA); if (resp) route.fulfill({ response: resp }).catch(() => {}); else route.abort().catch(() => {});
  });
  const commits = []; p.on('request', r => { if (r.url().includes('/imports/commit')) commits.push(r.url()); });
  const signIn = async () => { await p.goto(BASE + '/'); await p.waitForSelector('#login'); await p.fill('#u', 'researcher'); await p.fill('#p', PW); await p.click('#login button'); await p.waitForSelector('[data-act=open]'); };
  const h1 = async () => (await p.textContent('h1').catch(() => '')).trim();
  const id = ref => store.participantByRef(ref).id;
  // Each step starts from the participant list, whatever the previous step left on screen.
  const toList = async () => { for (let i = 0; i < 3 && !(await p.$('[data-act=open]')); i++) { if (await p.$('[data-act=home]')) await p.click('[data-act=home]'); else if (await p.$('#login')) { await p.fill('#u', 'researcher'); await p.fill('#p', PW); await p.click('#login button'); } await sleep(700); } };
  await signIn();

  /* ---- 1. Reversed responses: open A (slow), then B (fast) ---- */
  delayA = 1500;
  await p.click('[data-ref=P-DEMO-A]'); await sleep(100);
  await p.click('[data-ref=P-DEMO-B]'); await p.waitForSelector('#features'); await sleep(2000); // A's late responses have arrived by now
  check('1 reversed responses: B stays rendered after A\'s late response arrives', await h1() === 'P-DEMO-B', `rendered ${await h1()}`);
  const fa0 = store.features(id('P-DEMO-A')).experimental_shift, fb0 = store.features(id('P-DEMO-B')).experimental_shift;
  const rendered = await h1(); // the participant the researcher is looking at when they act
  await p.check('[data-feature=experimental_shift]'); await sleep(800);
  const fa1 = store.features(id('P-DEMO-A')).experimental_shift, fb1 = store.features(id('P-DEMO-B')).experimental_shift;
  check('1 a mutation made on the rendered page changes exactly that participant', (rendered === 'P-DEMO-B' && fb1 && !fb0 && fa1 === fa0) || (rendered === 'P-DEMO-A' && fa1 && !fa0 && fb1 === fb0), `rendered=${rendered} A:${fa0}→${fa1} B:${fb0}→${fb1}`);

  /* ---- 2. Navigate home while A is still loading ---- */
  await toList();
  await p.click('[data-ref=P-DEMO-A]'); await sleep(100);
  await p.click('[data-ref=P-DEMO-C]'); await p.waitForSelector('#features');
  await p.click('[data-act=home]'); await p.waitForSelector('[data-act=open]'); await sleep(2000);
  check('2 navigating home during loading: the list stays; A\'s late response is discarded', await h1() === 'Participants', `rendered ${await h1()}`);

  /* ---- 3. Log out while A is still loading ---- */
  await toList(); await sleep(1600);
  const errsBefore = errs.length;
  await p.click('[data-ref=P-DEMO-A]'); await sleep(100);
  await p.click('[data-act=logout]'); await p.waitForSelector('#login'); await sleep(2000);
  check('3 logging out during loading: the sign-in view stays, no participant data is rendered, and the late response raises no error', !!(await p.$('#login')) && !(await p.$('#quality')) && errs.length === errsBefore, `h1=${await h1()} errors=${errs.slice(errsBefore).join(' | ')}`);
  delayA = 0;

  /* ---- 4. Preview bound to file, type and participant ---- */
  await signIn(); await toList();
  const fx = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'overnight-samples.csv'), 'utf8').replace(/P-SYN-0001/g, 'P-DEMO-C');
  // A fresh, never-imported file for every scenario (rows 1–20, 21–40, …), so no preview is a duplicate by accident.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-races-')), lines = fx.trim().split('\n');
  const file = k => { const f = path.join(dir, `f${k}.csv`); fs.writeFileSync(f, [lines[0], ...lines.slice(1 + k * 20, 1 + (k + 1) * 20)].join('\n') + '\n'); return f; };
  const [fileA, fileB, fileC, fileD, fileE, fileF, fileG] = [0, 1, 2, 3, 4, 5, 6].map(file);
  const obsC = () => store.observations(id('P-DEMO-C')).length;
  const openC = async () => { await toList(); await p.click('[data-ref=P-DEMO-C]'); await p.waitForSelector('#import'); };
  const previewFile = async f => { await p.setInputFiles('#file', f); await p.click('[data-act=preview]'); await p.waitForFunction(() => !document.querySelector('#commitBtn').disabled, null, { timeout: 5000 }).catch(() => {}); };
  const forceCommit = async () => { await p.evaluate(() => { const c = document.querySelector('#commitBtn'); c.disabled = false; c.click(); }); await sleep(700); };
  const obsBefore = obsC();
  // 4a: preview file A, then choose file B.
  await openC(); await previewFile(fileA);
  check('4 setup: a preview enables Commit', !(await p.isDisabled('#commitBtn')));
  await p.setInputFiles('#file', fileB); await sleep(200);
  check('4 choosing another file after a preview disables Commit', await p.isDisabled('#commitBtn'));
  await forceCommit();
  check('4 a forced Commit after the file changed commits nothing', obsC() === obsBefore && commits.length === 0, `obs ${obsBefore}→${obsC()}, commit requests ${commits.length}`);
  // 4b: preview, then change the import type.
  await openC(); await previewFile(fileC);
  await p.selectOption('#rtype', 'annotations'); await sleep(200);
  check('4 changing the import type after a preview disables Commit', await p.isDisabled('#commitBtn'));
  await forceCommit();
  check('4 a forced Commit after the type changed commits nothing', obsC() === obsBefore && commits.length === 0, `commit requests ${commits.length}`);
  // 4c: preview on C, then go to B.
  await openC(); await previewFile(fileD);
  await toList(); await p.click('[data-ref=P-DEMO-B]'); await p.waitForSelector('#import');
  await forceCommit();
  check('4 a preview made for one participant cannot be committed from another participant\'s page', commits.length === 0 && obsC() === obsBefore, `commit requests ${commits.join(' ')}`);
  // 4d: a slow preview response for file A arrives after file B was chosen.
  await p.route(/\/imports\/preview$/, async route => { const resp = await route.fetch().catch(() => null); await sleep(1200); if (resp) route.fulfill({ response: resp }).catch(() => {}); });
  await openC(); await p.setInputFiles('#file', fileE); await p.click('[data-act=preview]'); await sleep(150);
  await p.setInputFiles('#file', fileF); await sleep(1800);
  check('4 a slow preview response for an earlier file does not enable Commit for the newly chosen file', await p.isDisabled('#commitBtn'));
  await forceCommit();
  check('4 ... and a forced Commit then commits nothing', commits.length === 0 && obsC() === obsBefore, `commit requests ${commits.length}`);
  await p.unroute(/\/imports\/preview$/);
  // Control: the normal flow still works.
  await openC(); await previewFile(fileG); await p.click('#commitBtn'); await sleep(800);
  check('4 control: preview then commit of the same file still works', commits.length === 1 && obsC() > obsBefore, `commits=${commits.length} obs ${obsBefore}→${obsC()}`);
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
