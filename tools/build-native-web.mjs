// Copies the web app into www/, the folder the native iPhone/Android app (Capacitor) loads. See native/README.md.
// Run before every `npx cap sync`: node tools/build-native-web.mjs
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname, out = root + 'www/';
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
const items = ['index.html', 'manifest.webmanifest', 'css', 'js', 'vendor', 'models', 'audio', 'icons'];
for (const it of items) if (existsSync(root + it)) cpSync(root + it, out + it, { recursive: true });
// The service worker is for the website (offline caching); a native app ships its files inside, so it's left out.
console.log(`www/ ready: ${items.filter(i => existsSync(root + i)).join(', ')}`);
