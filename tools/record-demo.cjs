// Records a walkthrough video and screenshots of the real app at phone size, for the demo page.
// Usage: node tools/record-demo.cjs OUT_DIR [VOICE_DIR]    (needs Playwright, Chromium and ffmpeg)
// VOICE_DIR: QK's recorded narration, one file per line of tools/demo-narration.json, named by its number
// (01.m4a, 02.mp3, 03 today.wav …). Each step waits until QK finishes speaking, and his voice is mixed onto demo.mp4.
// The client "Sara" and her history are example data, seeded so the progress screens have something to show.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = path.resolve(process.argv[2] || 'demo-out'), VOICE = process.argv[3] && path.resolve(process.argv[3]);
const NARR = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-narration.json'), 'utf8'));
const clips = {}, clipLen = {};
if (VOICE) for (const f of fs.readdirSync(VOICE)) {
  const m = f.match(/^(\d{2})/); if (!m || !/\.(m4a|mp3|wav|aac|ogg|opus|caf|mp4)$/i.test(f)) continue;
  clips[m[1]] = path.join(VOICE, f);
  clipLen[m[1]] = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clips[m[1]]]).toString()) || 0;
}
fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };

const DAY = 864e5, now = Date.now();
const ago = (d, h = 18) => { const x = new Date(now - d * DAY); x.setHours(h, 0, 0, 0); return x.getTime(); };
const seed = {
  profile: { name: 'Sara', sex: 'female', heightCm: 168, weeklyGoal: 4 },
  plan: { days: [...new Set([1, 3, 5, 6, new Date().getDay()])], time: '6:30pm', place: 'the gym' }, // today is always a training day in the demo
  sessions: [
    ...[13, 11, 9, 6, 4, 2].flatMap((d, i) => [0, 1, 2].map(k => ({ at: ago(d) + k * 4e5, ex: 'hipThrust', name: 'Barbell hip thrust', reps: 10, good: 6 + Math.min(4, i >> 1) + (k === 2 ? 0 : 0), faults: k === 0 && i < 3 ? { ht_feet_far: 2 } : {}, kg: 50 + i * 2.5 }))),
    ...[12, 8, 5, 1].flatMap((d, i) => [0, 1].map(k => ({ at: ago(d) + k * 4e5, ex: 'squat', name: 'Back squat', reps: 8, good: 5 + i, faults: i < 2 ? { sq_valgus: 2 } : {}, kg: 40 + i * 2.5 }))),
  ],
  checkins: [], scans: [],
  readiness: [13, 11, 9, 6, 4, 2, 1].map(d => ({ at: ago(d, 7), feel: 'ok', sleepQ: 3, fatigue: 3, stress: 3, soreness: 3, sleepH: 7.5 })),
  loads: Array.from({ length: 28 }, (_, d) => d + 1).filter(d => [1, 3, 5, 6].includes(new Date(now - d * DAY).getDay())).map(d => ({ at: ago(d), rpe: 6, minutes: 55 })),
  vitals: [
    ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map((d, i) => ({ at: ago(d, 7), kind: 'hrv', source: 'camera', rmssd: [48, 52, 50, 46, 55, 51, 49, 53, 50][i], ln: Math.log([48, 52, 50, 46, 55, 51, 49, 53, 50][i]), bpm: 62 })),
    ...[8, 6, 4, 2, 1].map((d, i) => ({ at: ago(d, 7), kind: 'pvt', source: 'camera', n: 40, meanRT: [262, 258, 266, 255, 260][i], medianRT: 255, lapses: 1, falseStarts: 0, speed: [3.9, 4.0, 3.85, 4.05, 3.95][i] })),
    { at: ago(1, 8), kind: 'hr', source: 'camera', bpm: 64 },
  ],
  calm: [6, 4, 2].map((d, i) => ({ at: ago(d, 22), goal: i === 1 ? 'sleep' : 'anxiety', before: [7, 6, 7][i], after: [4, 3, 4][i], minutes: 9, hr: { before: [84, 80, 86][i], after: [72, 70, 74][i] } })),
  calmPrefs: { tones: 'off', mode: 'binaural', minutes: 5, reciter: 'Alafasy_128kbps', quran: true, cue: true, breath: 'slow', hr: false, lastGoal: 'anxiety' },
};

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', recordVideo: { dir: OUT, size: { width: 390, height: 844 } } });
  await ctx.route('https://shred.local/**', r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': T[path.extname(f)] || 'application/octet-stream' } }); });
  for (const h of ['everyayah.com', 'verses.quran.com', 'verses.quran.foundation']) await ctx.route(`https://${h}/**`, r => r.abort());
  await ctx.addInitScript(s => { if (!localStorage.getItem('shred_qk_v1')) localStorage.setItem('shred_qk_v1', s); try { localStorage.setItem('qk_muted', '1'); } catch {} }, JSON.stringify(seed));
  const p = await ctx.newPage();
  const t0 = Date.now(); // the video starts with the page
  const wait = ms => p.waitForTimeout(ms);
  const timeline = [];
  // A caption bar drawn over the app, so the video explains itself.
  const showCaption = async (step, text) => p.evaluate(([s, t]) => {
    let el = document.getElementById('__cap');
    if (!el) { el = document.createElement('div'); el.id = '__cap'; el.style.cssText = 'position:fixed;left:10px;right:10px;bottom:96px;z-index:999;background:rgba(10,13,20,.92);border:1px solid #7c6cff;border-radius:16px;padding:10px 14px;font:600 14px/1.35 Figtree,system-ui;color:#edf0f6;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:none;transition:opacity .3s'; document.body.appendChild(el); }
    el.innerHTML = `<span style="display:block;font:700 10px/1 Figtree;letter-spacing:.14em;text-transform:uppercase;color:#45c3ff;margin-bottom:4px">${s}</span>${t}`; el.style.opacity = 1;
  }, [step, text]);
  // Show line `id` of the narration; if QK's recording exists, stay on it at least as long as he speaks.
  const narr = async (id, minMs) => {
    const n = NARR.find(x => x.id === id);
    await showCaption(n.step, n.caption);
    timeline.push({ id, at: Date.now() - t0 });
    await wait(Math.max(minMs, (clipLen[id] || 0) * 1000 + 400));
  };
  const hideCap = () => p.evaluate(() => { const el = document.getElementById('__cap'); if (el) el.style.opacity = 0; });
  const shot = async name => { await hideCap(); await wait(250); await p.screenshot({ path: path.join(OUT, name + '.png') }); };
  const tap = async sel => { await p.$eval(sel, el => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.click(sel); };

  await p.goto('https://shred.local/'); await wait(1200);

  // 1. Today: one tap, then one next step
  await narr('01', 2500); await tap('[data-feel=great]'); await wait(1200);
  await narr('02', 3000); await shot('01-today');
  await p.click('#nextBtn'); await wait(800);

  // 2. Train: live form coaching with the demo athlete
  await narr('03', 2500); await p.fill('#loadKg', '60'); await shot('03-setup');
  await p.click('#startDemo');
  await narr('04', 7000); await shot('04-live');
  await narr('05', 4000);
  await p.waitForSelector('#summary:not([hidden])', { timeout: 60000 }); await wait(600);
  await narr('06', 4000); await shot('05-summary');
  await p.click('#doneBtn'); await wait(500);
  await p.click('.tabs [data-tab=train]'); await wait(600);
  await narr('07', 2800); await shot('02-library');

  // 3. Tools
  await p.click('.tabs [data-tab=today]'); await wait(500); await tap('#today [data-go=body]'); await wait(600);
  await narr('08', 2800); await shot('06-body');
  await p.click('#body [data-go=rehab]'); await wait(600); await p.click('[data-area=Knee]'); await wait(400);
  await narr('09', 3200); await shot('07-rehab');
  await p.click('#rehab [data-back]'); await wait(400);
  await p.click('#body [data-go=vitals]'); await wait(600);
  await narr('10', 3200); await shot('08-body-check');
  await p.click('#vitals [data-back]'); await wait(400);

  // 4. Sukoon
  await p.click('#body [data-go=calm]'); await wait(600);
  await narr('11', 2500); await shot('09-sukoon');
  await p.click('#calmNow'); await wait(700);
  await narr('12', 1800); await shot('10-sukoon-rate');
  await p.click('#cBefore [data-v="7"]'); await wait(400);
  await narr('13', 5500); await shot('11-sukoon-breathe');
  await p.click('#calmSkip'); await wait(900);
  await narr('14', 2800);
  await p.click('#calmSkip'); await wait(600);
  await narr('15', 3000); await shot('12-sukoon-dua');
  await p.click('#calmSkip'); await wait(600); await p.click('#cAfter [data-v="4"]'); await wait(1000);
  await p.evaluate(() => document.querySelector('#calmHistory').scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await narr('16', 3000); await shot('13-sukoon-history');

  // 5. Me
  await p.click('.tabs [data-tab=progress]'); await wait(700);
  await narr('17', 2800); await shot('14-you');
  await p.evaluate(() => document.querySelector('#sendWeek').scrollIntoView({ block: 'center', behavior: 'smooth' })); await wait(900);
  await p.evaluate(() => { navigator.share = undefined; navigator.clipboard.writeText = () => Promise.reject(new Error('demo')); });
  await p.click('#sendWeek'); await wait(600);
  await p.evaluate(() => document.querySelector('#weekText').scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await narr('18', 3500); await shot('15-send-week');
  await p.click('.tabs [data-tab=today]'); await wait(500);
  await narr('19', 3000);

  const vid = await p.video().path(); await ctx.close(); await b.close();
  fs.renameSync(vid, path.join(OUT, 'demo.webm'));
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 1));

  // Mix QK's lines onto the video, each starting when its caption appears.
  const mp4 = path.join(OUT, 'demo.mp4'), used = timeline.filter(t => clips[t.id]);
  const args = ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'demo.webm'), ...used.flatMap(t => ['-i', clips[t.id]])];
  if (used.length) {
    const f = used.map((t, i) => `[${i + 1}:a]adelay=${t.at}|${t.at},aresample=48000[a${i}]`).join(';') + ';' + used.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${used.length}:normalize=0[a]`;
    args.push('-filter_complex', f, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k');
  } else args.push('-an');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
  execFileSync('ffmpeg', args);
  console.log(`done: ${mp4} (${used.length} of ${NARR.length} narration lines from QK)`);
})();
