// Tracking HUD: lock-on, re-lock after losing the body, rep read-out and clean streaks.
import { TrackHUD } from '../js/hud.js';
import { bestSide } from '../js/angles.js';
import { frameAt } from './synth.mjs';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

// A canvas 2D context that records draw calls and ignores everything else.
function fakeCtx() {
  const calls = { arc: 0, text: 0 };
  const ctx = new Proxy({ canvas: { width: 720, height: 600 } }, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'arc') return () => calls.arc++;
      if (k === 'fillText') return () => calls.text++;
      if (k === 'measureText') return () => ({ width: 80 });
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(o, k, v) { o[k] = v; return true; },
  });
  return { ctx, calls };
}

const hud = new TrackHUD(), { ctx, calls } = fakeCtx();
const px = t => frameAt('squat', t / 1000);
let locks = 0;
for (let t = 0; t <= 2000; t += 33) if (hud.draw(ctx, px(t), bestSide(px(t)), t, { seen: true }) === 'lock') locks++;
check('locks on once when the body is found', locks === 1 && hud.locked, `locks=${locks}`);
check('lock-on draws the joint rings and label', calls.arc > 20 && calls.text > 0);
check('counts visible points', hud.points(px(0)) >= 10, hud.points(px(0)));
check('reports frame rate', Math.abs(hud.fps() - 30) <= 2, hud.fps());

// Brief dropout keeps the lock; a long one releases it and the next sighting locks on again.
hud.draw(ctx, px(2100), bestSide(px(2100)), 2100, { seen: false });
hud.draw(ctx, px(2600), bestSide(px(2600)), 2600, { seen: true });
check('a short dropout keeps the lock', hud.locked);
hud.draw(ctx, px(4500), bestSide(px(4500)), 4500, { seen: false });
check('losing the body for 1.5 s releases the lock', !hud.locked);
check('finding it again locks on again', hud.draw(ctx, px(4600), bestSide(px(4600)), 4600, { seen: true }) === 'lock');

// Streaks.
const h2 = new TrackHUD();
const s = [h2.rep(0, 1, true), h2.rep(1, 2, true), h2.rep(2, 3, true), h2.rep(3, 4, false), h2.rep(4, 5, true)];
check('clean streak counts up and resets on a faulty rep', s.join() === '1,2,3,0,1', s.join());
check('best streak kept', h2.best === 3);
h2.rep(5000, 6, true); const before = calls.text; h2.draw(ctx, px(5000), bestSide(px(5000)), 5000, { seen: true }); h2.draw(ctx, px(5300), bestSide(px(5300)), 5300, { seen: true });
check('rep number is drawn after a rep', calls.text > before);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('hud: all pass');
