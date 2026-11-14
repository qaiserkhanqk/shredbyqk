// Offline support: the app shell and the default model are cached at install, so the app opens instantly
// at the gym with no signal. The larger models are cached the first time they're used.
const CACHE = 'shred-qk-v6';
const SHELL = ['./', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/angles.js', 'js/coach.js', 'js/exercises.js', 'js/library.js', 'js/feedback.js', 'js/pose.js', 'js/bodyscan.js', 'js/store.js',
  'js/gait.js', 'js/motion.js', 'js/demo.js', 'js/measure.js', 'js/vbt.js', 'js/jump.js', 'js/kneetest.js', 'js/diagnostics.js', 'js/rehab.js', 'js/rom.js', 'js/load.js', 'js/studio.js',
  'js/cycle/dates.js', 'js/cycle/flags.js', 'js/cycle/model.js', 'js/cycle/predict.js', 'js/cycle/patterns.js', 'js/cycle/phase.js', 'js/cycle/reminders.js', 'js/cycle/wearables.js', 'js/cycle/tempshift.js', 'js/cycle/store.js', 'js/cycle/ui.js',
  'vendor/vision_bundle.mjs', 'vendor/wasm/vision_wasm_internal.js', 'vendor/wasm/vision_wasm_internal.wasm', 'models/pose_landmarker_lite.task', 'audio/cues/manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && /\/(models|audio)\//.test(e.request.url)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  })));
});
