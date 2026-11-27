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
  checkins: [], scans: [], prefs: { logMode: 'camera' }, // camera logging, as in the walkthrough
  readiness: [13, 11, 9, 6, 4, 2, 1].map(d => ({ at: ago(d, 7), feel: 'ok', sleepQ: 3, fatigue: 3, stress: 3, soreness: 3, sleepH: 7.5 })),
  loads: Array.from({ length: 28 }, (_, d) => d + 1).filter(d => [1, 3, 5, 6].includes(new Date(now - d * DAY).getDay())).map(d => ({ at: ago(d), rpe: 6, minutes: 55 })),
  vitals: [
    ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map((d, i) => ({ at: ago(d, 7), kind: 'hrv', source: 'camera', rmssd: [48, 52, 50, 46, 55, 51, 49, 53, 50][i], ln: Math.log([48, 52, 50, 46, 55, 51, 49, 53, 50][i]), bpm: 62 })),
    ...[8, 6, 4, 2, 1].map((d, i) => ({ at: ago(d, 7), kind: 'pvt', source: 'camera', n: 40, meanRT: [262, 258, 266, 255, 260][i], medianRT: 255, lapses: 1, falseStarts: 0, speed: [3.9, 4.0, 3.85, 4.05, 3.95][i] })),
    { at: ago(1, 8), kind: 'hr', source: 'camera', bpm: 64 },
  ],
  calm: [6, 4, 2].map((d, i) => ({ at: ago(d, 22), goal: i === 1 ? 'sleep' : 'anxiety', before: [7, 6, 7][i], after: [4, 3, 4][i], minutes: 9, hr: { before: [84, 80, 86][i], after: [72, 70, 74][i] } })),
  brain: {
    drills: [12, 10, 8, 6, 4, 2].map((d, i) => ({ kind: 'speed', at: ago(d, 20), ms: [260, 220, 190, 170, 150, 140][i], level: [19, 24, 29, 32, 36, 37][i], acc: 72 })),
    games: [{ game: 'grid', at: ago(5, 21), score: 6 }, { game: 'clash', at: ago(3, 21), score: 31 }, { game: 'batak', at: ago(2, 21), score: 38 }, { game: 'lights', at: ago(1, 21), score: 712, best: 262, avg: 288, jumps: 0 }],
    lessons: { plastic: { read: ago(9), recalled: ago(6) }, exercise: { read: ago(7), recalled: ago(4) }, sleep: { read: ago(4) } },
    quran: { ...Object.fromEntries([1, 2, 3, 4].map(a => [`s112:${a}`, { box: 4, seen: 5, last: ago(3), due: ago(-8) }])),
      ...Object.fromEntries([1, 2, 3, 4, 5].map(a => [`s113:${a}`, { box: a < 3 ? 2 : 1, seen: 2, last: ago(1), due: ago(a < 3 ? -2 : 0, 4) }])) },
    reviews: [6, 4, 3, 1].map(d => ({ at: ago(d, 21), n: 4 })),
  },
  calmPrefs: { tones: 'off', mode: 'binaural', minutes: 5, reciter: 'Alafasy_128kbps', quran: true, cue: true, breath: 'slow', hr: false, lastGoal: 'anxiety' },
};

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', recordVideo: { dir: OUT, size: { width: 390, height: 844 } } });
  await ctx.route('https://shred.local/**', r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': T[path.extname(f)] || 'application/octet-stream' } }); });
  // Recitation: a 2.5-second silent clip stands in for each verse, so the reader follows along in the recording.
  const silent = path.join(OUT, 'silent.mp3');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '2.5', '-q:a', '9', silent]);
  for (const h of ['everyayah.com', 'verses.quran.com', 'verses.quran.foundation']) await ctx.route(`https://${h}/**`, r => r.fulfill({ status: 200, body: fs.readFileSync(silent), headers: { 'content-type': 'audio/mpeg' } }));
  await ctx.addInitScript(s => { if (!localStorage.getItem('shred_qk_v1')) localStorage.setItem('shred_qk_v1', s); try { localStorage.setItem('qk_muted', '1'); localStorage.setItem('qk_demo', '1'); } catch {} }, JSON.stringify(seed));
  const p = await ctx.newPage();
  const t0 = Date.now(); // the video starts with the page
  const wait = ms => p.waitForTimeout(ms);
  const timeline = [];
  // A caption bar drawn over the app, so the video explains itself.
  const showCaption = async (step, text) => p.evaluate(([s, t]) => {
    let el = document.getElementById('__cap');
    if (!el) { el = document.createElement('div'); el.id = '__cap'; el.style.cssText = 'position:fixed;left:10px;right:10px;bottom:96px;z-index:999;background:rgba(11,19,17,.92);border:1px solid #5FB39D;border-radius:16px;padding:10px 14px;font:600 14px/1.35 Figtree,system-ui;color:#ECF1EC;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:none;transition:opacity .3s'; document.body.appendChild(el); }
    el.innerHTML = `<span style="display:block;font:700 10px/1 Figtree;letter-spacing:.14em;text-transform:uppercase;color:#9FD0B6;margin-bottom:4px">${s}</span>${t}`; el.style.opacity = 1;
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
  await p.evaluate(() => window.scrollTo({ top: 0 })); await p.click('.tabs [data-tab=train]'); await wait(500); await tap('#exOpen'); await wait(400); await p.click('.ex-card.feature'); await wait(800);

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
  await narr('10', 2000); await shot('08-body-check');
  await p.evaluate(() => document.querySelector('#vHrvLast').scrollIntoView({ block: 'center', behavior: 'smooth' })); await wait(2600); await shot('08b-hrv');
  await p.evaluate(() => window.scrollTo({ top: 0 }));
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

  // 5. Brain: score, Speed Flash, reflex games, Quran memory
  await p.click('.tabs [data-tab=today]'); await wait(500); await tap('#today [data-go=brain]'); await wait(800);
  await narr('17', 3200); await shot('16-brain');
  await p.evaluate(() => { window.__shredSpeedTrials = 3; window.__shredBatakSeconds = 8; });
  await tap('[data-brain=speed]'); await wait(300); await p.click('#sfGo');
  const speedTrial = async () => { await p.waitForSelector('#sfVeh:not([hidden])', { timeout: 10000 }); await wait(500); await p.click('#sfVeh [data-v="0"]'); await p.waitForSelector('#sfArena.answer'); await wait(500); await p.click('.sf-spot[data-pos="2"]', { force: true }); };
  await narr('18', 600); await speedTrial(); await p.waitForSelector('#sfVeh:not([hidden])', { timeout: 10000 }); await shot('17-speed-flash');
  await p.click('#sfVeh [data-v="1"]'); await p.waitForSelector('#sfArena.answer'); await wait(400); await p.click('.sf-spot[data-pos="5"]', { force: true });
  await speedTrial(); await p.waitForSelector('#sfDone:not([hidden])', { timeout: 10000 }); await wait(1200); await p.click('#sfFin'); await wait(500);
  await p.$eval('#reflexGames', el => el.scrollIntoView({ block: 'center', behavior: 'smooth' })); await wait(900);
  await tap('[data-brain=lights]'); await wait(300);
  await narr('19', 400); await p.click('#loPad');
  await p.waitForFunction(() => document.querySelectorAll('.lo-pod.on').length === 5, null, { timeout: 8000 }); await shot('18-lights-out');
  await p.waitForFunction(() => document.querySelectorAll('.lo-pod.on').length === 0, null, { timeout: 8000 }); await wait(240); await p.click('#loPad'); await wait(1800);
  await p.click('#bpClose'); await wait(400);
  await p.$eval('#reflexGames', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await tap('[data-brain=batak]'); await wait(300); await p.click('#bkGo');
  await narr('20', 200);
  for (let i = 0; i < 14; i++) { await wait(260); await p.click('.bk-l.on'); if (i === 9) await p.screenshot({ path: path.join(OUT, '19-reaction-wall.png') }); }
  await p.waitForSelector('#bkFin', { timeout: 10000 }); await wait(1200); await p.click('#bkFin'); await wait(400);
  await tap('[data-brain=quran]'); await wait(700); await p.click('[data-brain="set:s113"]'); await wait(700);
  await narr('21', 2200); await shot('20-quran-surah');
  await p.click('[data-brain="learn:s113"]'); await wait(1500); await p.click('#prNext'); await wait(1000); await p.click('#prNext'); await wait(800);
  await p.click('#prNext'); await wait(900); await shot('21-quran-recite');
  await p.click('#prCheck'); await wait(1200); await p.click('[data-g=good]'); await wait(500);
  await p.click('#bpClose'); await wait(400); await p.click('[data-brain=sets]'); await wait(700);
  await narr('22', 3200); await shot('22-quran-review');
  await tap('#quranMain [data-brain=reader]'); await wait(900);
  await narr('23', 3000); await shot('23-reader-list');
  await tap('#rdList [data-rd="open:18"]'); await wait(900);
  await p.click('#rdPlayAll'); await wait(500);
  await narr('24', 6500); await shot('24-reader-play');
  await p.click('[data-rd=stop]'); await wait(300);

  // 6. Me
  await p.click('.tabs [data-tab=progress]'); await wait(700);
  await narr('25', 2800); await shot('14-you');
  await p.evaluate(() => document.querySelector('#sendWeek').scrollIntoView({ block: 'center', behavior: 'smooth' })); await wait(900);
  await p.evaluate(() => { navigator.share = undefined; navigator.clipboard.writeText = () => Promise.reject(new Error('demo')); });
  await p.click('#sendWeek'); await wait(600);
  await p.evaluate(() => document.querySelector('#weekText').scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await narr('26', 3500); await shot('15-send-week');
  await p.click('.tabs [data-tab=today]'); await wait(500);
  await narr('27', 3000);

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
