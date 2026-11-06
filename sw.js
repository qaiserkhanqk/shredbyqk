// Offline cache so the app (and the pose model) load instantly at the gym.
const CACHE = 'shred-qk-v1';
const ASSETS = ['./', 'index.html', 'css/styles.css', 'js/app.js', 'js/angles.js', 'js/coach.js', 'js/exercises.js', 'js/pose.js', 'js/bodyscan.js', 'js/store.js',
  'vendor/vision_bundle.mjs', 'models/pose_landmarker_lite.task', 'icons/icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
