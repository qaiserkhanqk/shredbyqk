// Regression test for issue 3 reported against f67000b: the temperature rule's version string must distinguish the
// corrected one-observation-per-night logic (f67000b) from the earlier version. Written BEFORE the fix.
// Synthetic data only. Run: node tests/cycle-regressions-f67000b.test.mjs
import * as M from '../js/cycle/model.js';
import { SHIFT_VERSION, retrospectiveShift } from '../js/cycle/tempshift.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const OLD = 'three-over-six-skin-0.1.0-research'; // the version before night aggregation (up to b3d9589)
check('3 the version string differs from the version before night aggregation', SHIFT_VERSION !== OLD, SHIFT_VERSION);
check('3 the version string names the night-aggregation change', /night/i.test(SHIFT_VERSION) && /research/.test(SHIFT_VERSION), SHIFT_VERSION);
const s = M.blankState('synthetic'); M.giveConsent(s); M.setScopeConsent(s, 'wearable', true);
s.wearable.nights = [{ night: '2026-11-01', sleepSessionId: 'S1', deviceId: 'd', model: 'm', firmware: 'f', metric: 'skin_temp', kind: 'raw', status: 'ok', value: 33.9, coverageMin: 400, flags: [] }];
check('3 every result reports the new version', retrospectiveShift(s, '2026-11-01', '2026-11-05').version === SHIFT_VERSION);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
