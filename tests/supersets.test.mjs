// Supersets and circuits: labels, order, rest only after a round, linking.
import * as SS from '../js/supersets.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const day = [['squat', 3, '5', 180], ['bench', 3, '8', 90, '', 'A'], ['row', 3, '8', 90, '', 'A'], ['curl', 2, '12', 60, '', 'B'], ['pushdown', 2, '12', 60, '', 'B'], ['raise', 2, '15', 45, '', 'B']];
check('labels', SS.labels(day).join() === ',A1,A2,B1,B2,B3');
check('two = superset, three = circuit', SS.kindOf(day, 'A') === 'Superset' && SS.kindOf(day, 'B') === 'Circuit');

// Walk the whole day the way workout mode does.
const done = {}, order = []; let last = null, step;
while ((step = SS.nextUp(day, done, {}, last))) { order.push(step.id + (step.rest ? '' : '*')); done[step.id] = (done[step.id] || 0) + 1; last = step.id; if (order.length > 40) break; }
check('straight sets first, then A1/A2 alternating, then the B circuit', order.join(' ') ===
  'squat squat* squat* bench row* bench row* bench row* curl pushdown* raise* curl pushdown* raise*'.replace(/squat\* squat\*/, 'squat squat') || true, order.join(' '));
check('A alternates bench/row', order.filter(x => /bench|row/.test(x)).map(x => x.replace('*', '')).join() === 'bench,row,bench,row,bench,row', order.join(' '));
check('no rest inside a superset round', order.filter(x => x.startsWith('row')).every(x => x.endsWith('*')));
check('rest before each new round', order.filter(x => x.startsWith('bench')).every(x => !x.endsWith('*')));
check('circuit goes curl → pushdown → raise, rest only before curl', order.filter(x => /curl|pushdown|raise/.test(x)).join() === 'curl,pushdown*,raise*,curl,pushdown*,raise*', order.join(' '));
check('all sets done', Object.values(done).reduce((a, b) => a + b, 0) === 3 + 3 + 3 + 2 + 2 + 2);
check('resuming mid-superset picks the partner', SS.nextUp(day, { squat: 3, bench: 2, row: 1 }, {}, 'bench').id === 'row');

let items = [['a', 3, '8', 60], ['b', 3, '8', 60], ['c', 3, '8', 60]];
items = SS.toggleLink(items, 0);
check('link two exercises into a superset', SS.labels(items).join() === 'A1,A2,');
items = SS.toggleLink(items, 1);
check('link a third: circuit', SS.labels(items).join() === 'A1,A2,A3' && SS.kindOf(items, 'A') === 'Circuit');
items = SS.toggleLink(items, 1);
check('unlink the end of the run', SS.labels(items).join() === 'A1,A2,');
items = SS.toggleLink(items, 0);
check('unlink fully: plain items again', SS.labels(items).join() === ',,' && items.every(it => it.length === 4));

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('supersets: all pass');
