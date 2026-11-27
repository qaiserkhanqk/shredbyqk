// Leaderboard score, mind check, Fitness Age lapse, broadcasts and the "Fitness Age went up" push.
import { weekScore, weekStart, weekKey, displayName, ranked, monthTotals, weeksOfMonth, gapLine, pointsPerDay, MAX } from '../js/leaderboard.js';
import { poorDays, mindDue, goodNews, reply } from '../js/mind.js';
import { liveFitAge, ifStopped, daysSinceTraining } from '../js/fitnessage.js';
import { audienceOf, awayText, BROADCAST_TEMPLATES, fill } from '../js/dash.js';
import { broadcastJobs, lapseMsg, plan } from '../tools/push-checkins.mjs';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const DAY = 864e5, NOW = new Date(2026, 10, 27, 18).getTime(); // Friday evening
const WS = weekStart(NOW);
const at = (d, h = 9) => WS + d * DAY + h * 3600e3; // d = 0 Monday

// ---- Weekly score ----
check('week key is the Monday', weekKey(NOW) === '2026-11-23', weekKey(NOW));
const full = {
  plan: { days: [1, 3, 5, 0] },
  sessions: [0, 2, 3, 4].map(d => ({ at: at(d), ex: 'squat', reps: 8 })),
  fitage: [{ at: NOW - 5 * DAY, fitnessAge: 30, age: 40 }],
  readiness: [0, 1, 2, 3, 4].map(d => ({ at: at(d, 7), sleepQ: 1, fatigue: 1, soreness: 1, stress: 1 })),
  calm: [{ at: at(2, 21) }],
};
const f = weekScore(full, WS, NOW);
check('score: everything done → 100', f.score === 100, JSON.stringify(f));
check('score: nothing logged → 0, with tips', weekScore({}, WS, NOW).score === 0 && weekScore({}, WS, NOW).tips.length >= 2);
check('score: fair at any age: 10 years younger than your age = full fitness points at 60 or 25',
  weekScore({ fitage: [{ at: NOW, fitnessAge: 50, age: 60 }] }, WS, NOW).parts.fitness === weekScore({ fitage: [{ at: NOW, fitnessAge: 15, age: 25 }] }, WS, NOW).parts.fitness);
check('score: Fitness Age older than you scores less', weekScore({ fitage: [{ at: NOW, fitnessAge: 45, age: 40 }] }, WS, NOW).parts.fitness === 5);
check('score: a Fitness Age test over 45 days old earns nothing (retest monthly)', weekScore({ fitage: [{ at: NOW - 60 * DAY, fitnessAge: 30, age: 40 }] }, WS, NOW).parts.fitness === 0);
check('score: training half the planned days → half the training points', weekScore({ plan: { days: [1, 3, 5, 0] }, sessions: [{ at: at(0) }, { at: at(1) }] }, WS, NOW).parts.train === Math.round(MAX.train / 2));
check('score: last week\'s sessions don\'t count this week', weekScore({ sessions: [{ at: WS - DAY }] }, WS, NOW).parts.train === 0);
const poorSleep = weekScore({ ...full, readiness: full.readiness.map(r => ({ ...r, sleepQ: 7 })) }, WS, NOW);
check('score: bad sleep all week → no sleep points, rest unchanged', poorSleep.parts.sleep === 0 && poorSleep.parts.train === MAX.train);
const twoChecks = weekScore({ readiness: full.readiness.slice(0, 2) }, WS, NOW);
check('score: checking in only 2 days earns 2/5 of the daily points', twoChecks.parts.sleep === Math.round(MAX.sleep * 0.4));
check('score: tips say how to earn more, biggest first', twoChecks.tips[0].pts >= twoChecks.tips[twoChecks.tips.length - 1].pts);

// ---- Names and ranking ----
check('board name: nickname wins', displayName({ name: 'Ali Khan', nickname: 'Beast Mode' }) === 'Beast Mode');
check('board name: otherwise first name + initial, never the full name', displayName({ name: 'Ali Raza Khan' }) === 'Ali R.' && displayName({}) === 'Shredder');
check('ranking: ties share a rank', ranked([{ score: 80 }, { score: 90 }, { score: 80 }, { score: 70 }]).map(r => r.rank).join() === '1,2,2,4');
check('month: weeks are the Mondays in the month, up to this week', weeksOfMonth('2026-11', '2026-11-23').join() === '2026-11-02,2026-11-09,2026-11-16,2026-11-23');
const mt = monthTotals([
  { client_id: 'steady', week: '2026-11-02', score: 60 }, { client_id: 'steady', week: '2026-11-09', score: 60 }, { client_id: 'steady', week: '2026-11-16', score: 60 }, { client_id: 'steady', week: '2026-11-23', score: 60 },
  { client_id: 'late', week: '2026-11-16', score: 70 }, { client_id: 'late', week: '2026-11-23', score: 70 },
  { client_id: 'quit', week: '2026-10-26', score: 90 }, { client_id: 'quit', week: '2026-11-02', score: 90 },
], '2026-11', { asOf: '2026-11-23' });
check('month: average a week from their first week, so a mid-month joiner can win', mt.map(r => `${r.client_id}${r.score}`).join() === 'late70,steady60,quit23', JSON.stringify(mt));
const board = [{ rank: 1, name: 'Sara A.', score: 80 }, { rank: 2, name: 'Omar', score: 71 }, { rank: 3, name: 'Ali K.', score: 65, me: true }];
check('gap: how far to the next place, in training days', gapLine(board, { perDay: 9 }) === '7 points to pass #2. One training day gets you there.', gapLine(board, { perDay: 9 }));
check('gap: #1 sees their lead', /You're #1\. Omar is 9 points behind you/.test(gapLine([{ rank: 1, name: 'Sara', score: 80, me: true }, { rank: 2, name: 'Omar', score: 71 }])));
check('gap: one training day is worth 35 ÷ planned days', pointsPerDay({ plan: { days: [1, 2, 3, 4, 5] } }) === 7 && pointsPerDay({}) === 9);

// ---- Mind check ----
const rough = { readiness: [{ at: NOW - DAY, sleepQ: 6, stress: 3 }, { at: NOW - 2 * DAY, sleepQ: 3, stress: 6 }] };
check('mind: two poor days in the last four → ask', poorDays(rough, NOW) === 2 && mindDue(rough, NOW));
check('mind: one poor night → don\'t ask', !mindDue({ readiness: [{ at: NOW - DAY, sleepQ: 7 }] }, NOW));
check('mind: asked 3 days ago → don\'t ask again yet', !mindDue({ ...rough, mind: [{ at: NOW - 3 * DAY, answer: 'good' }] }, NOW));
check('mind: "slept badly" in the training check counts', poorDays({ checkinLog: [{ at: NOW - DAY, sleep: 'bad' }, { at: NOW - 2 * DAY, sleep: 'bad' }] }, NOW) === 2);
const trained = { sessions: [1, 3, 5, 8, 10].map(d => ({ at: NOW - d * DAY })), vitals: [{ at: NOW - 2 * DAY, bpm: 61 }, { at: NOW - 20 * DAY, bpm: 60 }], fitage: [{ at: NOW - 9 * DAY, fitnessAge: 33, age: 40 }] };
const news = goodNews(trained, NOW);
check('mind: reassurance comes from their own numbers', /5 days/.test(news[0]) && news.some(n => /61/.test(n)) && news.some(n => /33/.test(n)), news.join(' | '));
check('mind: nothing logged → still a kind, true message', goodNews({}, NOW).length === 1);
check('mind: "a bit low" lightens today', reply('low', trained, NOW).light === true);
const s = reply('struggling', trained, NOW);
check('mind: "struggling" → support, talk to someone, emergency number', s.support && /talk to someone/i.test(s.text) && /emergency/i.test(s.text));

// ---- Fitness Age when training stops ----
const test = { at: NOW - 30 * DAY, sex: 'male', age: 40, waist: 95, rhr: 66, active: true, fitnessAge: 38 };
check('lapse: days since training', daysSinceTraining([{ at: NOW - 3 * DAY }, { at: NOW - 16 * DAY }], NOW) === 3);
const live = liveFitAge([test], [{ at: NOW - 16 * DAY }], NOW);
check('lapse: 16 days off → Fitness Age goes up (activity term drops)', live.lapsed && live.fitnessAge > 38 && live.was === 38, JSON.stringify(live));
check('lapse: 10 days off → no change (a busy week is fine)', !liveFitAge([test], [{ at: NOW - 10 * DAY }], NOW).lapsed);
check('lapse: the server knows the "if stopped" age for closed apps', ifStopped(test) === live.fitnessAge);

// ---- Push: lapse and broadcasts ----
const day = '2026-11-27';
const prof = { id: 'a', name: 'Ali Khan', notify: 'essential', last_train: '2026-11-10', care: { fitAge: { fa: 38, ifStopped: 41 } } };
check('push: 17 days off → "Your Fitness Age went up to 41"', /went up to 41/.test(lapseMsg(prof, day)?.title || ''), JSON.stringify(lapseMsg(prof, day)));
check('push: not again within 14 days', lapseMsg({ ...prof, lapse_sent: '2026-11-20' }, day) === null);
check('push: trained recently → nothing', lapseMsg({ ...prof, last_train: '2026-11-25' }, day) === null);
const subs = [{ client_id: 'a', endpoint: 'e1' }, { client_id: 'b', endpoint: 'e2' }];
check('push: lapse reminder goes through the daily budget', plan({ profiles: [prof], subs, plans: [], day }).some(j => j.kind === 'lapse'));
const bj = broadcastJobs({ messages: [{ id: 1, client_id: 'a', title: 'Dr. Doom aa gaya', body: 'Lekin tum gym nahi aaye' }, { id: 2, client_id: 'b', title: 'x', body: 'y' }], subs, profiles: [prof, { id: 'b', notify: 'off' }] });
check('broadcast: sent to each phone, not to people who turned notifications off', bj.length === 1 && bj[0].msg.title === 'Dr. Doom aa gaya');

// ---- Broadcast audiences ----
const clients = [{ id: 'a', name: 'Ali' }, { id: 'b', name: 'Sara' }, { id: 'c', name: 'Omar' }];
const lastTrain = new Map([['a', NOW - DAY], ['b', NOW - 10 * DAY]]);
check('audience: not trained in 7+ days (and never)', audienceOf(clients, 'quiet', { lastTrain, now: NOW }).map(c => c.id).join() === 'c,b');
check('audience: trained this week', audienceOf(clients, 'active', { lastTrain, now: NOW }).map(c => c.id).join() === 'a');
const lastOpen = new Map([['a', NOW - DAY], ['b', NOW - 40 * DAY], ['c', NOW - 100 * DAY]]);
const nt = audienceOf(clients, 'notrain', { lastTrain, away: 3, now: NOW });
check('hasn\'t trained for 3+ days: longest away first, never-trained included', nt.map(c => c.id).join() === 'c,b' && nt[0].trainDays === Infinity && Math.round(nt[1].trainDays) === 10, JSON.stringify(nt));
check('hasn\'t opened for 1 month+', audienceOf(clients, 'noopen', { lastOpen, away: 30, now: NOW }).map(c => c.id).join() === 'c,b');
check('hasn\'t opened for 3 months+', audienceOf(clients, 'noopen', { lastOpen, away: 90, now: NOW }).map(c => c.id).join() === 'c');
check('away text: days, weeks, months, never', [awayText(4), awayText(21), awayText(95), awayText(Infinity)].join() === '4 days,3 weeks,3 months,never');
check('templates: the Dr. Doom one is there, with their name filled in', /Dr\. Doom aa gaya lekin tum gym nahi aaye, Ali\?/.test(fill(BROADCAST_TEMPLATES[0].body, 'Ali Khan')));

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nleaderboard, mind, lapse and broadcast: all passed');
