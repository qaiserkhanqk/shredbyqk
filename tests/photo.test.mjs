// Photo recognition helpers: consensus with alternatives, image quality check. Run: node tests/photo.test.mjs
import { consensus, imageQuality, needsShareCheck } from '../js/foodphoto.js';
import { bestTranscript } from '../js/foodtext.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const it = (dish, alternative = 'none', servings = 1) => ({ dish, alternative, servings, meat_share: 'na', oil: 'na', confidence: 0.9, other_name: '' });
const c = consensus([{ items: [it('naan', 'roghni_naan')] }, { items: [it('naan', 'roghni_naan')] }, { items: [it('naan', 'kulcha')] }]);
check('runner-up dish is the one named most', c.items[0].alternative === 'roghni_naan');
check('"none" and unknown ids are not alternatives', consensus([{ items: [it('naan', 'none')] }, { items: [it('naan', 'xyz')] }]).items[0].alternative === null);
const w = 64, h = 64, img = f => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const v = f(i % w, Math.floor(i / w)); a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v; a[i * 4 + 3] = 255; } return a; };
const sharp = imageQuality(img((x, y) => (((x >> 2) + (y >> 2)) % 2 ? 220 : 30)), w, h);
const flat = imageQuality(img(() => 128), w, h), dark = imageQuality(img((x, y) => (((x >> 2) + (y >> 2)) % 2 ? 40 : 5)), w, h);
check('sharp, bright photo passes', !sharp.dark && !sharp.blurry);
check('featureless photo is flagged blurry', flat.blurry);
check('dark photo is flagged dark', dark.dark);
check('speech: picks the guess that names foods', bestTranscript(['do roti aur car hi', 'do roti aur karahi']) === 'do roti aur karahi');
check('speech: keeps the first guess when equal', bestTranscript(['ek chai', 'ek chay']) === 'ek chai');
// Lessons from 60 real web photos: stalls and shared pans must not be logged as one person's meal.
check('scene is the majority answer', consensus([{ scene: 'shared', items: [it('naan')] }, { scene: 'shared', items: [it('naan')] }, { scene: 'plate', items: [it('naan')] }]).scene === 'shared');
check('old answers without a scene count as a plate', consensus([{ items: [it('naan')] }]).scene === 'plate');
check('a naan seller\'s stack (15 naans, 5,300 kcal) → ask', needsShareCheck('plate', [{ kind: 'bread', servings: 15 }], 5312));
check('a whole karahi pan (4 katori) → ask', needsShareCheck('plate', [{ kind: 'curry', servings: 4 }], 1650));
check('the model says shared → ask', needsShareCheck('shared', [{ kind: 'curry', servings: 1 }], 400));
check('a normal plate (karahi + 2 naan, 1,100 kcal) → no question', !needsShareCheck('plate', [{ kind: 'curry', servings: 1.5 }, { kind: 'bread', servings: 2 }], 1100));

console.log(fails ? `\n${fails} FAILED` : '\nall photo checks passed');
process.exit(fails ? 1 : 0);
