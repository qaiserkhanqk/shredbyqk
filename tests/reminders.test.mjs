// Training-day reminders: calendar file and the in-app reminder rule.
import { icsFor, dueToday } from '../js/reminders.js';
let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const wed = new Date(2026, 10, 25, 9, 0).getTime(); // Wednesday 25 Nov 2026, 09:00 local
const ics = icsFor({ days: [1, 3, 5], time: '18:30', place: 'PureGym, Leeds' }, { name: 'Sara', url: 'https://example.app/', now: wed });
check('valid calendar wrapper', ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trim().endsWith('END:VCALENDAR'));
check('repeats on Mon, Wed, Fri', /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/.test(ics));
check('first one is today at 18:30', /DTSTART:20261125T183000/.test(ics), ics.match(/DTSTART:\S+/)?.[0]);
check('alert 30 minutes before', /TRIGGER:-PT30M/.test(ics));
check('commas escaped in location', /LOCATION:PureGym\\, Leeds/.test(ics));
check('personal, tells them the weights are set', /Sara\\, your weights for today are already set/.test(ics.replace(/\r\n /g, '')));
check('long lines folded', ics.split('\r\n').every(l => l.length <= 75));
check('no plan days → no file', icsFor({ days: [] }) === null);
const thu = new Date(2026, 10, 26, 9, 0).getTime();
check('next day used when today is not a training day', /DTSTART:20261127T183000/.test(icsFor({ days: [5], time: '18:30' }, { now: thu })));

const plan = { days: [3], time: '18:30' };
check('due from an hour before', dueToday(plan, { now: new Date(2026, 10, 25, 17, 45).getTime() }));
check('not due in the morning', !dueToday(plan, { now: new Date(2026, 10, 25, 9, 0).getTime() }));
check('not due once trained', !dueToday(plan, { now: new Date(2026, 10, 25, 19, 0).getTime(), trainedToday: true }));
check('only once a day', !dueToday(plan, { now: new Date(2026, 10, 25, 19, 0).getTime(), notifiedOn: new Date(2026, 10, 25).toDateString() }));
check('not on rest days', !dueToday(plan, { now: new Date(2026, 10, 26, 19, 0).getTime() }));

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('reminders: all pass');
