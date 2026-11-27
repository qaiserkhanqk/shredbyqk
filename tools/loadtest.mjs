#!/usr/bin/env node
// A small load tester (no dependencies): many virtual users at once, ramped up, with a report.
// For the full test plan (and k6 scripts for staging) see docs/LOAD-TESTING.md.
//
//   node tools/loadtest.mjs photo  --url http://localhost:8787/food-vision --users 5000 --ramp 60 --duration 180 --think 60
//   node tools/loadtest.mjs static --url https://your-site.pages.dev/ --users 5000 --ramp 30 --duration 60 --think 5
//   node tools/loadtest.mjs sync   --url https://abc.supabase.co --anon <anon key> --tokens tokens.json --users 1000 ...
//
// photo: each user snaps a meal, waits --think seconds (±50%), snaps again, until --duration.
//        Point it at a server started with FOOD_AI=mock so it costs nothing (see the server's header).
// static: each user loads the app shell (index, css, the main JS) like a phone opening the app.
// sync:  each user does what the app does every 5 minutes: upsert today's food row and update its profile.
import fs from 'node:fs';
import { catalogue } from '../js/foodphoto.js';

const args = Object.fromEntries(process.argv.slice(3).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]]] : a), []));
const mode = process.argv[2] || 'photo';
const users = +args.users || 100, ramp = (+args.ramp || 10) * 1000, duration = (+args.duration || 30) * 1000, think = (+args.think || 10) * 1000;
const url = args.url || 'http://localhost:8787/food-vision';

const lat = [], codes = {};
let done = 0, errors = 0, retried = 0;
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (ms, spread = 0.5) => ms * (1 - spread + Math.random() * 2 * spread);

// One request, timed. Behaves like the app: on 503 it waits Retry-After once and tries again.
async function hit(fn) {
  const t0 = performance.now();
  try {
    let r = await fn();
    if (r.status === 503 && mode === 'photo') { retried++; await sleep(rnd(Math.min(12, +r.headers.get('retry-after') || 5) * 1000, 0.2)); r = await fn(); }
    await r.arrayBuffer();
    codes[r.status] = (codes[r.status] || 0) + 1;
    if (!r.ok) errors++;
  } catch (e) { codes[e.name || 'error'] = (codes[e.name || 'error'] || 0) + 1; errors++; }
  lat.push(performance.now() - t0); done++;
}

const cat = catalogue();
const photoReq = vu => () => {
  // A unique fake image per request so the server's photo cache doesn't hide the load.
  const image = 'data:image/jpeg;base64,' + Buffer.from(`vu${vu}-${Math.random()}`.repeat(400)).toString('base64');
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, hash: `${vu}-${Math.random()}`, samples: args.samples || 'fast', catalogue: cat }), signal: AbortSignal.timeout(90e3) });
};
const STATIC = ['', 'index.html', 'css/styles.css', 'js/app.js', 'js/food.js', 'js/nutrition.js'];
const staticReq = () => () => Promise.all(STATIC.map(p => fetch(new URL(p, url), { signal: AbortSignal.timeout(30e3) }).then(r => r.arrayBuffer().then(() => r)))).then(rs => rs.find(r => !r.ok) || rs[0]);
const tokens = args.tokens ? JSON.parse(fs.readFileSync(args.tokens, 'utf8')) : [];
const syncReq = vu => () => {
  const t = tokens[vu % Math.max(1, tokens.length)] || {}, h = { apikey: args.anon, authorization: `Bearer ${t.access_token}`, 'content-type': 'application/json' };
  const day = new Date().toISOString().slice(0, 10);
  return fetch(`${url}/rest/v1/food_days?on_conflict=client_id,at`, { method: 'POST', headers: { ...h, prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ client_id: t.id, at: day, kcal: 1800 + vu % 400, protein: 120, carbs: 200, fat: 60, water: 6, steps: 7000, items: [] }]), signal: AbortSignal.timeout(30e3) })
    .then(r => r.ok ? fetch(`${url}/rest/v1/profiles?id=eq.${t.id}`, { method: 'PATCH', headers: { ...h, prefer: 'return=minimal' }, body: JSON.stringify({ last_seen: new Date().toISOString() }), signal: AbortSignal.timeout(30e3) }) : r);
};
const make = { photo: photoReq, static: staticReq, sync: syncReq }[mode];
if (!make) { console.error('mode must be photo, static or sync'); process.exit(1); }

const start = Date.now(), end = start + duration;
let active = 0, peak = 0;
const vu = async i => {
  await sleep(ramp * i / users); // ramp up
  active++; peak = Math.max(peak, active);
  while (Date.now() < end) { await hit(make(i)); await sleep(Math.max(0, Math.min(rnd(think), end - Date.now()))); }
  active--;
};
const line = () => `${Math.round((Date.now() - start) / 1000)}s  users ${active}  requests ${done}  errors ${errors}  p95 ${Math.round(pct(lat.slice(-2000), 95))} ms`;
const tick = process.stdout.isTTY ? setInterval(() => process.stdout.write(`\r${line()}   `), 1000) : setInterval(() => console.log(line()), 15e3);
await Promise.all(Array.from({ length: users }, (_, i) => vu(i)));
clearInterval(tick);
const secs = (Date.now() - start) / 1000;
const report = { mode, url, users, peakActive: peak, seconds: Math.round(secs), requests: done, perSecond: Math.round(done / secs * 10) / 10,
  errors, errorRate: done ? Math.round(errors / done * 1000) / 10 + '%' : '0%', retriedAfterBusy: retried, statusCodes: codes,
  latencyMs: { p50: Math.round(pct(lat, 50)), p95: Math.round(pct(lat, 95)), p99: Math.round(pct(lat, 99)), max: Math.round(Math.max(0, ...lat)) } };
console.log('\n' + JSON.stringify(report, null, 2));
if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
process.exit(errors / Math.max(1, done) > (+args['max-error'] || 0.01) ? 1 : 0);
