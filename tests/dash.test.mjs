// Coach dashboard model: statuses, weekly numbers, PRs, sorting, templates, demo data.
import { clientCard, sortCards, overview, TEMPLATES, fill, demoData, weekStart } from '../js/dash.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const D = 864e5, now = new Date(2026, 10, 26, 18, 0).getTime(); // Thursday evening
const wk = weekStart(now);
check('week starts on Monday', new Date(wk).getDay() === 1 && now - wk < 4 * D);

const set = (daysAgo, ex, kg, reps, good = reps, faults) => ({ at: new Date(now - daysAgo * D).toISOString(), ex, name: ex, kg, reps, good, faults });
const p = { id: 'a', name: 'Sara Ahmed', weekly_goal: 4 };
let c = clientCard(p, [set(10, 'squat', 60, 8), set(2, 'squat', 65, 8), set(1, 'bench', 40, 8)], [], [], { now });
check('on track: 2 training days by Thursday (goal 4)', c.status === 'on track' && c.daysTrained === 2, `${c.status} ${c.reason}`);
check('PR this week found', c.prs.length === 1 && c.prs[0].ex === 'squat');
check('weekly volume', c.volume === 65 * 8 + 40 * 8);
check('form score this week', c.form === 100);
check('last workout listed', c.lastWorkout.exercises.join() === 'bench');

c = clientCard(p, [set(5, 'squat', 60, 8)], [], [], { now });
check('inactive after 3+ days away', c.status === 'inactive' && c.daysAway === 5 && /5 days/.test(c.reason));
c = clientCard(p, [], [{ at: new Date(now - 3600e3).toISOString() }], [], { now });
check('opened today but no training → slipping', c.status === 'slipping' && c.openedToday && /0 of 2/.test(c.reason), c.reason);
c = clientCard(p, [set(8, 'squat', 100, 5, 5), set(0, 'squat', 100, 5, 2), set(1, 'squat', 100, 5, 2)], [], [], { now });
check('form dropped 10+ points → slipping', c.status === 'slipping' && /Form down/.test(c.reason), c.reason);
c = clientCard({ id: 'n', name: 'New' }, [], [], [], { now });
check('never opened → inactive', c.status === 'inactive' && /Never/.test(c.reason));
c = clientCard(p, [set(0, 'squat', 60, 8, 6, { sq_depth: 2 }), set(1, 'squat', 60, 8, 7, { sq_depth: 1, sq_knees: 1 })], [], [], { now });
check('most common fault over 4 weeks', c.topFault.id === 'sq_depth' && c.topFault.n === 3);

const cards = [clientCard({ id: '1', name: 'Bo' }, [set(0, 'x', 10, 5)], [], [], { now }), clientCard({ id: '2', name: 'Al' }, [set(4, 'x', 10, 5)], [], [], { now }), clientCard({ id: '3', name: 'Cy' }, [set(9, 'x', 10, 5)], [], [], { now })];
check('who needs you first: longest inactive at the top', sortCards(cards).map(x => x.name).join() === 'Cy,Al,Bo');
const ov = overview(cards);
check('overview counts', ov.total === 3 && ov.inactive === 2 && ov.openedToday === 1);
check('templates use the first name', fill(TEMPLATES.nudge[0], 'Sara Ahmed') === 'Haven\'t seen you this week, Sara. One short session today?');

const demo = demoData(now);
const dc = demo.profiles.map(pp => clientCard(pp, demo.sets.filter(s => s.client_id === pp.id), demo.opens.filter(e => e.client_id === pp.id), [], { now }));
const st = Object.fromEntries(dc.map(x => [x.name.split(' ')[0], x.status]));
check('demo has every status', st.Lena === 'inactive' && st.Jon === 'inactive' && st.Bilal === 'slipping' && st.Maya === 'slipping' && st.Sara === 'on track', JSON.stringify(st));

// What the coach should know: labels and counts only.
{
  const { careSummary, careChips } = await import('../js/dash.js');
  const now = Date.now(), c = careSummary({ profile: { pain: ['knee'], travel: { kind: 'hotel', until: now + 864e5 } }, checkinLog: [{ at: now - 864e5, level: 'rest' }, { at: now - 2 * 864e5, level: 'easy' }] }, now);
  check('care: sore knee, 2 rough days, travelling → chips for the coach', careChips(c).join('|') === 'Sore: knee|2 rough days|Travelling', careChips(c).join('|'));
  check('care: nothing to flag → null', careSummary({ profile: {} }, now) === null);
}
if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('dash: all pass');
