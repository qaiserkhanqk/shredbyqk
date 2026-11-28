// Offline support: the app shell and the default model are cached at install, so the app opens with no
// signal at the gym. App code (HTML, JS, CSS) is network-first: online, every deploy reaches the phone on
// its next open; offline, the cached copy is used. Models and audio are cache-first (large, rarely change).
const CACHE = 'shred-qk-v45';
  'js/accuracy.js', 'js/activity.js', 'js/adapt.js', 'js/angles.js', 'js/app.js', 'js/athletes.js', 'js/barcode.js', 'js/board-ui.js', 'js/bodymap.js', 'js/bodyscan.js', 'js/brain.js', 'js/brainui.js', 'js/brief.js', 'js/builder.js', 'js/calibrate.js', 'js/calm.js', 'js/chatbot.js', 'js/chatui.js', 'js/classes.js', 'js/clean.js', 'js/cloud-config.js', 'js/coach-chat.js', 'js/coach-extra.js', 'js/coach-page.js', 'js/coach-ur.js', 'js/coach.js', 'js/dash.js', 'js/demo.js', 'js/detect.js', 'js/diagnostics.js', 'js/dietplan.js', 'js/done-ui.js', 'js/exercises.js', 'js/fatsecret.js', 'js/feedback.js', 'js/fitage-ui.js', 'js/fitnessage.js', 'js/food-ur.js', 'js/food.js', 'js/foodphoto.js', 'js/foods-indb.js', 'js/foodsync.js', 'js/foodtext.js', 'js/frequency.js', 'js/fuzzy.js', 'js/fx.js', 'js/gait.js', 'js/hr.js', 'js/hud.js', 'js/jump.js', 'js/kneetest.js', 'js/leaderboard.js', 'js/library-athlete.js', 'js/library-extra.js', 'js/library-more.js', 'js/library.js', 'js/load.js', 'js/measure.js', 'js/memory.js', 'js/menus.js', 'js/mind.js', 'js/motion.js', 'js/nutrition.js', 'js/personal.js', 'js/places-local.js', 'js/places-uae.js', 'js/pose.js', 'js/programs.js', 'js/progression.js', 'js/push.js', 'js/reader.js', 'js/refresh.js', 'js/rehab.js', 'js/reminders.js', 'js/report-ui.js', 'js/report.js', 'js/rewards.js', 'js/rom.js', 'js/routines.js', 'js/scores.js', 'js/scoreview.js', 'js/share.js', 'js/signals.js', 'js/sportsbio.js', 'js/store.js', 'js/studio.js', 'js/sukoon.js', 'js/supersets.js', 'js/sync.js', 'js/today.js', 'js/vbt.js', 'js/vitals.js', 'js/voicecmd.js', 'js/volume.js', 'js/warmup.js', 'js/weekly.js',
const SHELL = ['./', 'index.html', 'coach.html', 'css/styles.css', 'css/coach.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/mark.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
  'vendor/vision_bundle.mjs', 'vendor/wasm/vision_wasm_internal.js', 'vendor/wasm/vision_wasm_internal.wasm', 'models/pose_landmarker_lite.task', 'audio/cues/manifest.json', 'data/quran-hifz.json', 'data/quran/index.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  const heavy = /\/(models|audio|vendor|data\/quran)\//.test(e.request.url); // the Quran text never changes: cache-first
  const save = res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; };
  e.respondWith(heavy
    ? caches.match(e.request).then(hit => hit || fetch(e.request).then(save))
    : fetch(e.request).then(save).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
// A push from the daily job (tools/push-checkins.mjs) while the app is closed: check-in day, or a plan update from QK.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Check-in day with QK', {
    body: d.body || 'Weigh yourself before breakfast and enter it in Food. QK will suggest your next step.',
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'qk-checkin', data: { url: d.url || './?tab=food' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus().then(c => c.navigate?.(url) || c) : self.clients.openWindow(url)));
});
