// Weigh-to-calibrate and the accuracy study export. Run: node tests/calibrate.test.mjs
import { portionFactor, factors, studyCSV, studySummary, weighings } from '../js/calibrate.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const W = (id, photoG, weighedG, extra = {}) => ({ at: Date.UTC(2026, 10, 20), source: 'photo', ref: { t: 'dish', id }, opts: { servings: 1, style: 'home', grams: weighedG }, photoG, photoServings: photoG / 200, weighedG, ...extra });

const log = [W('chicken_karahi', 200, 260), W('daal_masoor', 200, 250), W('aloo_gobi', 150, 180), W('roti', 44, 44)];
check('only weighed photo entries count', weighings([...log, { source: 'search', ref: { t: 'dish', id: 'roti' }, photoG: 44, weighedG: 50 }]).length === 4);
check('no correction until 3 of a kind', portionFactor(log.slice(0, 2), 'curry') === 1);
const f = portionFactor(log, 'curry');
check('3 curries weighed bigger than the photo → curry photos scaled up', f > 1.15 && f < 1.35, f.toFixed(2));
check('breads are separate (no change)', portionFactor(log, 'bread') === 1);
check('correction is clamped (×0.6–×1.6)', portionFactor([W('chicken_karahi', 100, 400), W('daal_chana', 100, 400), W('bhindi', 100, 400)], 'curry') === 1.6);
check('factors lists each kind with a count', factors(log).curry.n === 3);
const csv = studyCSV(log).split('\n');
check('study CSV has a header and one row per weighing', csv.length === 5 && /weighed_grams/.test(csv[0]));
check('CSV row shows portion error (−23% for 200 vs 260 g)', csv[1].split(',')[6] === '-23', csv[1]);
const sm = studySummary(log);
check('study summary: median portion error', sm.n === 4 && sm.medianPortionError === 18, JSON.stringify(sm));
console.log(fails ? `\n${fails} FAILED` : '\nall calibration checks passed');
process.exit(fails ? 1 : 0);
