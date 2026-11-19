// Browser tests for the doctor summary and optional LH-test logging. Written BEFORE the UI code.
// Synthetic data only. Run: node tests/cycle-ui-summary-lh.cjs
const { launch } = require('./browser.cjs'); // E2E_BROWSER=chromium|firefox|webkit
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const dayStr = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const has = async (p, sel) => (await p.$(sel)) !== null;

(async () => {
  const b = await launch(); const errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  async function open(flags) {
    const c = await b.newContext({ serviceWorkers: 'block', acceptDownloads: true }); await c.route('https://shred.local/**', serve);
    const offsite = []; c.on('request', r => { if (!r.url().startsWith('https://shred.local/')) offsite.push(r.url()); });
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    const go = async () => { await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(700); };
    await go(); await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    await p.evaluate(async (d) => { // three synthetic cycles of 30 days, one open period, a few pain logs
      const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), D = await import('/js/cycle/dates.js');
      const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') });
      await repo.update(s => {
        M.setCategory(s, 'pain', true);
        const starts = [-92, -62, -32, -2].map(n => D.addDays(d.today, n));
        for (const st of starts) M.logPeriodStart(s, st, { today: d.today });
        for (const per of s.periods.slice(0, -1)) M.logPeriodEnd(s, per.id, D.addDays(per.start, 4), { today: d.today });
        M.logDay(s, starts[2], { pain: 'severe' }, { today: d.today });
      });
    }, { today: dayStr(0) });
    await go(); await p.click('#cySettings summary');
    return { c, p, offsite, go };
  }

  /* ---- Doctor summary (cycle tracking on, nothing else) ---- */
  {
    const { c, p, offsite } = await open({ cycleTracking: true });
    check('S1 a "summary for a doctor" button is offered', await has(p, '[data-act=summary]'));
    check('S1 no summary is shown until the person asks', !(await has(p, '#cySummary')));
    if (await has(p, '[data-act=summary]')) {
      const before = offsite.length; await p.click('[data-act=summary]'); await p.waitForTimeout(300);
      const card = (await p.$('#cySummary')) ? await p.textContent('#cySummary') : '';
      check('S2 the summary appears on request, with periods, cycle lengths and pain counts', /30 days/.test(card) && /severe/i.test(card) && /end not (yet )?logged/i.test(card), card.slice(0, 200));
      check('S2 it says it is not a diagnosis and comes from the person\'s own entries', /not a diagnosis/i.test(card) && /your own entries/i.test(card));
      check('S2 it contains no estimate or fertility wording', !/fertile|safe day|ovulation day|next period/i.test(card));
      check('S3 print and download-as-text buttons are offered; nothing is sent anywhere', (await has(p, '[data-act=printSummary]')) && (await has(p, '[data-act=downloadSummary]')) && offsite.length === before, offsite.join(' '));
      if (await has(p, '[data-act=downloadSummary]')) {
        const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 3000 }).catch(() => null), p.click('[data-act=downloadSummary]')]);
        const body = dl ? fs.readFileSync(await dl.path(), 'utf8') : '';
        check('S3 the download is a local plain-text file with the same summary', !!dl && /\.txt$/.test(dl.suggestedFilename()) && /not a diagnosis/i.test(body), dl?.suggestedFilename());
      }
      const ls = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
      check('S4 the summary is not stored in plain localStorage', !/not a diagnosis|severe/i.test(ls));
      await p.click('[data-act=closeSummary]').catch(() => {});
      check('S4 the summary can be closed', !(await has(p, '#cySummary')));
    }
    check('L1 with the LH research flag off, there is no LH field or opt-in', !(await has(p, '#cyLh')) && !(await has(p, '[data-act=lhOn]')) && !/\bLH\b/.test(await p.textContent('#cycle')));
    await c.close();
  }

  /* ---- LH logging (research flag on) ---- */
  {
    const { c, p, go } = await open({ cycleTracking: true, lhTests: true });
    check('L2 with the flag on, LH logging needs its own opt-in first', !(await has(p, '#cyLh')) && (await has(p, '[data-act=lhOn]')));
    if (await has(p, '[data-act=lhOn]')) {
      await p.click('[data-act=lhOn]'); await p.waitForTimeout(400);
      check('L3 after opting in, the log form has an LH result field', await has(p, '#cyLh'));
      if (await has(p, '#cyLh')) {
        // Changed after the first run (stated in docs): the page already says "no assumed ovulation day" (a negation, in
        // the estimate's method note), so the check compares fertility/ovulation wording before and after a positive result.
        const CLAIM = /fertile|safe day|ovulation day|you (have )?ovulated|ovulating/gi;
        const claimsBefore = ((await p.textContent('#cycle')).match(CLAIM) || []).length;
        await p.selectOption('#cyLh', 'positive'); await p.click('[data-act=saveDay]'); await p.waitForTimeout(400);
        const stored = await p.evaluate(async (t) => { const S = await import('/js/cycle/store.js');
          const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') }); return repo.read().days[t]?.lh; }, dayStr(0));
        check('L3 the result is saved in the encrypted store', stored === 'positive', String(stored));
        const page = await p.textContent('#cycle');
        check('L4 a positive result adds no fertility or ovulation wording to the page', (page.match(CLAIM) || []).length === claimsBefore && !/fertile|safe day|you (have )?ovulated|ovulating/i.test(page), `${claimsBefore} → ${(page.match(CLAIM) || []).length}`);
        await go(); await p.click('#cySettings summary'); await p.click('[data-act=summary]'); await p.waitForTimeout(300);
        const card = (await p.$('#cySummary')) ? await p.textContent('#cySummary') : '';
        check('L5 the doctor summary lists the LH result as recorded, not interpreted', /positive/i.test(card) && /not interpreted/i.test(card), card.slice(-200));
        await p.click('[data-act=lhOff]').catch(() => {}); await p.waitForTimeout(400);
        const left = await p.evaluate(async () => { const S = await import('/js/cycle/store.js');
          const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') }); return Object.values(repo.read().days).filter(d => d.lh).length; });
        check('L6 turning LH logging off deletes the results', left === 0 && !(await has(p, '#cyLh')), String(left));
      }
    }
    await c.close();
  }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
