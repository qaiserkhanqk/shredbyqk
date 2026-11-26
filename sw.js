// Offline support: the app shell and the default model are cached at install, so the app opens with no
// signal at the gym. App code (HTML, JS, CSS) is network-first: online, every deploy reaches the phone on
// its next open; offline, the cached copy is used. Models and audio are cache-first (large, rarely change).
const CACHE = 'shred-qk-v20';
const SHELL = ['./', 'index.html', 'coach.html', 'css/styles.css', 'css/coach.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/angles.js', 'js/app.js', 'js/bodymap.js', 'js/bodyscan.js', 'js/brief.js', 'js/calm.js', 'js/cloud-config.js', 'js/coach-page.js', 'js/coach.js', 'js/dash.js', 'js/demo.js', 'js/detect.js', 'js/diagnostics.js', 'js/exercises.js', 'js/feedback.js', 'js/food.js', 'js/foodphoto.js', 'js/foods-indb.js', 'js/fx.js', 'js/gait.js', 'js/hr.js', 'js/hud.js', 'js/jump.js', 'js/kneetest.js', 'js/library-extra.js', 'js/library-more.js', 'js/library.js', 'js/load.js', 'js/measure.js', 'js/motion.js', 'js/nutrition.js', 'js/pose.js', 'js/programs.js', 'js/progression.js', 'js/refresh.js', 'js/rehab.js', 'js/reminders.js', 'js/rewards.js', 'js/rom.js', 'js/share.js', 'js/store.js', 'js/studio.js', 'js/sukoon.js', 'js/sync.js', 'js/today.js', 'js/vbt.js', 'js/vitals.js',
  'vendor/vision_bundle.mjs', 'vendor/wasm/vision_wasm_internal.js', 'vendor/wasm/vision_wasm_internal.wasm', 'models/pose_landmarker_lite.task', 'audio/cues/manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  const heavy = /\/(models|audio|vendor)\//.test(e.request.url);
  const save = res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; };
  e.respondWith(heavy
    ? caches.match(e.request).then(hit => hit || fetch(e.request).then(save))
    : fetch(e.request).then(save).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
