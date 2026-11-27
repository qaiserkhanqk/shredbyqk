// Offline cache: every app module is cached for offline use, and app code is fetched network-first so
// a deploy reaches phones on their next open (a cache-first shell kept old versions alive).
import { readFileSync, readdirSync } from 'node:fs';
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const missing = readdirSync(new URL('../js', import.meta.url)).filter(f => f.endsWith('.js') && !sw.includes(`'js/${f}'`));
check('every js module is in the offline shell', !missing.length, missing.join(' '));
check('app code is network-first', /fetch\(e\.request\)\.then\(save\)\.catch/.test(sw));
check('models stay cache-first', /heavy\s*\n?\s*\? caches\.match/.test(sw));
if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('sw: all pass');
