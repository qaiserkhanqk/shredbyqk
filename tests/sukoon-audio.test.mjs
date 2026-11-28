// Regression test, found 2026-11-28 (Firefox browser runs, "InvalidStateError: Navigated away from page", now and then).
// The calming-tones player asked the phone to start its sound (AudioContext.resume) but never handled a refusal. When
// the page is left while that request is still pending, Firefox rejects it, and the unhandled rejection is reported as
// an error. A refusal only means no tones, so it must be handled quietly. Written BEFORE the fix.
// Run: node tests/sukoon-audio.test.mjs
import { SukoonTones } from '../js/sukoon.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// A sound engine that refuses to start, the way Firefox does when the page is left mid-request.
const node = () => new Proxy(function () {}, { get: (t, k) => k === 'connect' ? () => node() : (k in t ? t[k] : node()), apply: () => node(), set: () => true });
class RefusingAudioContext {
  constructor() { this.currentTime = 0; this.destination = node(); }
  resume() { return Promise.reject(Object.assign(new Error('Navigated away from page'), { name: 'InvalidStateError' })); }
  createGain() { return node(); } createOscillator() { return node(); } createStereoPanner() { return node(); }
  createBiquadFilter() { return node(); } createBuffer() { return node(); } createBufferSource() { return node(); }
}
globalThis.AudioContext = RefusingAudioContext;

const unhandled = [];
process.on('unhandledRejection', e => unhandled.push(e?.message || String(e)));

const tones = new SukoonTones();
let threw = null;
try { tones.unlock(); tones.start({ beat: 6, carrier: 200, mode: 'binaural', volume: 0.5 }); tones.stop?.(0); } catch (e) { threw = e.message; }
await new Promise(r => setTimeout(r, 50)); // let the refused requests settle

check('a refused sound start does not throw', threw === null, threw || '');
check('a refused sound start is handled quietly (no unhandled error)', unhandled.length === 0, unhandled.join(' | '));
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
