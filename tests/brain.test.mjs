// Brain: speed drill, games, Quran spaced review, lessons and the Brain score. Run: node tests/brain.test.mjs
import { readFileSync } from 'node:fs';
import * as B from '../js/brain.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const DAY = 864e5, NOW = new Date(2026, 10, 27, 12).getTime();
const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Speed drill staircase
{
  const s = new B.Staircase(500);
  s.answer(true); check('one right answer → same flash time', s.ms === 500);
  s.answer(true); check('two right in a row → shorter flash (×0.8)', s.ms === 400);
  s.answer(false); check('a miss → longer flash', s.ms === 500);
  // A simulated player whose true threshold is ~100 ms: the staircase should settle near it.
  const p = new B.Staircase(500), rand = seeded(7);
  for (let i = 0; i < 80; i++) p.answer(rand() < 1 / (1 + Math.exp(-(p.ms - 100) / 15)) * 0.95 + 0.02);
  const t = p.threshold();
  check('staircase settles near the player\'s threshold', t > 60 && t < 160, `${t} ms`);
  const lo = new B.Staircase(20); for (let i = 0; i < 20; i++) lo.answer(true);
  check('never shorter than one frame (17 ms)', lo.ms === B.SPEED.minMs);
}
check('speed level: 500 ms → 0, 17 ms → 100', B.speedLevel(500) === 0 && B.speedLevel(17) === 100);
check('speed level rises as flash time falls', B.speedLevel(100) > B.speedLevel(200));
check('first session starts at 500 ms', B.speedStart([]) === 500);
check('next session starts a bit easier than last threshold', B.speedStart([{ kind: 'speed', at: 1, ms: 100 }]) === 140);
check('distractors only once the flash is short', !B.speedTrial(300).distractors && B.speedTrial(80).distractors > 0);
{
  const tr = B.speedTrial(200, seeded(3));
  check('trial has a centre target and one of 8 positions', [0, 1].includes(tr.centre) && tr.pos >= 0 && tr.pos < 8);
}

// Block then boosters
{
  const mk = days => days.map(d => ({ kind: 'speed', at: NOW - d * DAY, ms: 200 }));
  check('fewer than 10 sessions → first block', B.speedProgram(mk([3, 2, 1]), NOW).phase === 'block' && B.speedProgram(mk([3, 2, 1]), NOW).done === 3);
  const block = mk([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  const m = B.speedProgram(block, NOW);
  check('after 10 sessions → maintain, booster in about 3 months', m.phase === 'maintain' && !m.due && Math.round((m.nextAt - (NOW - 11 * DAY)) / DAY) === 90);
  check('3 months later → booster due', B.speedProgram(block, NOW + 80 * DAY).phase === 'booster');
  const boosting = [...block, { kind: 'speed', at: NOW + 80 * DAY, ms: 150 }];
  const b = B.speedProgram(boosting, NOW + 81 * DAY);
  check('in a booster → counts its sessions', b.phase === 'booster' && b.done === 1 && b.of === 4);
  const fin = [...boosting, ...[82, 83, 84].map(d => ({ kind: 'speed', at: NOW + d * DAY, ms: 140 }))];
  check('booster finished → maintain again', B.speedProgram(fin, NOW + 85 * DAY).phase === 'maintain');
}

// Memory Grid
{
  const seq = B.gridSequence(8, seeded(5));
  check('grid sequence: right length, no tile twice in a row', seq.length === 8 && seq.every((t, i) => i === 0 || t !== seq[i - 1]) && seq.every(t => t >= 0 && t < 16));
  let st = { span: 3, lives: 2, best: 0 };
  st = B.gridNext(st, true); check('right → one longer', st.span === 4 && st.best === 3);
  st = B.gridNext(st, false); check('wrong → lose a life, same length', st.span === 4 && st.lives === 1 && !st.over);
  st = B.gridNext(st, false); check('no lives left → game over', st.over);
}

// Colour Clash
{
  const rand = seeded(11), ts = Array.from({ length: 400 }, () => B.clashTrial(rand));
  const share = ts.filter(t => t.match).length / ts.length;
  check('about a third of words match their ink', share > 0.25 && share < 0.45, share.toFixed(2));
  check('mismatched words never accidentally match', ts.every(t => t.match === (t.word === t.ink)));
  const sc = B.clashScore([{ ok: true, match: true, rt: 500 }, { ok: true, match: false, rt: 700 }, { ok: false, match: false, rt: 400 }]);
  check('clash score = right − wrong; interference = slower on tricky words', sc.score === 1 && sc.interference === 200 && sc.meanRT === 600);
}

// Quran spaced review
{
  let c = B.review(undefined, 'good', NOW);
  check('first good recital → box 1, due tomorrow', c.box === 1 && c.due > NOW && c.due - NOW < DAY);
  c = B.review(c, 'good', NOW + DAY); check('good again → box 2, 3 days', c.box === 2);
  c = B.review(c, 'hard', NOW + 4 * DAY); check('with mistakes → stays in its box', c.box === 2);
  c = B.review(c, 'again', NOW + 5 * DAY); check('couldn\'t recite → back to box 1', c.box === 1);
  check('not due before its day, due after', !B.isDue(c, NOW + 5 * DAY) && B.isDue(c, NOW + 7 * DAY));
  const cards = { 's1:1': { box: 1, due: NOW - 1 }, 's1:2': { box: 2, due: NOW + DAY }, 's1:3': { box: 5, due: NOW - 5 } };
  check('due list: only due cards, oldest first', JSON.stringify(B.dueCards(cards, NOW)) === '["s1:3","s1:1"]');
  const set = { id: 's1', ayahs: [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }] };
  const pr = B.setProgress(set, cards);
  check('set progress: started and memorised', pr.started === 3 && pr.memorised === 1 && pr.total === 4);
}

// Real Quran text: words, cues, fading, order game
{
  const Q = JSON.parse(readFileSync(new URL('../data/quran-hifz.json', import.meta.url)));
  const ikhlas = Q.sets.find(s => s.s === 112);
  check('Quran data: 23 sets, Al-Ikhlas has 4 verses', Q.sets.length === 23 && ikhlas.ayahs.length === 4);
  check('Basmala removed from verse 1 (except Al-Fatiha)', !/^بِ?ّ?سْمِ/.test(ikhlas.ayahs[0].ar) && Q.sets.filter(s => s.s !== 1 && s.s !== 2).every(s => !s.ayahs[0].ar.startsWith('بِسْمِ') && !s.ayahs[0].ar.startsWith('بِّسْمِ')));
  check('Al-Fatiha keeps the Basmala as verse 1', Q.sets[0].ayahs[0].ar.startsWith('بِسْمِ'));
  check('no byte-order marks in the text', !/﻿/.test(JSON.stringify(Q)));
  const ws = B.words(ikhlas.ayahs[0].ar);
  check('words of 112:1 → 4 words', ws.length === 4, ws.join(' | '));
  const kursi = B.words(Q.sets.find(s => s.id === 'kursi').ayahs[0].ar);
  check('stand-alone pause marks are not counted as words', kursi.every(w => /[ء-يٱ]/.test(w)));
  check('cue = first letter + line', B.cue('قُلْ') === 'قُـ');
  check('fade level 0 shows all, level 3 hides all', B.fade(ws, 0).every(x => !x.hidden) && B.fade(ws, 3).every(x => x.hidden));
  check('fade hides from the end first', B.fade(ws, 1).at(-1).hidden && !B.fade(ws, 1)[0].hidden);
  const sh = B.shuffleWords(ws, seeded(2));
  check('order game: same words, not already in order', sh.map(x => x.i).sort().join() === '0,1,2,3' && sh.some((x, i) => x.i !== i));
  const ch = B.chunks(kursi);
  check('Ayat al-Kursi splits into chunks of 8 words or fewer', ch.every(c => c.length <= 8) && ch.flat().length === kursi.length, `${ch.length} chunks`);
}

// Lessons
{
  check('10 lessons, each with an action and a recall question', B.LESSONS.length === 10 && B.LESSONS.every(l => l.action && l.quiz.options[l.quiz.answer]));
  const q = B.lessonQueue({ plastic: { read: NOW - 3 * DAY }, exercise: { read: NOW - DAY } }, NOW);
  check('next lesson = first unread; recall after 2 days', q.next.id === 'sleep' && q.recall.map(l => l.id).join() === 'plastic');
}

// Brain score
{
  const empty = B.brainScore({}, NOW);
  check('no brain activity yet → no score, asks for a first drill', empty.score == null && /Speed Flash/.test(empty.fix));
  const S = {
    sessions: [1, 3, 5].map(d => ({ at: NOW - d * DAY })), readiness: [1, 2, 3].map(d => ({ at: NOW - d * DAY, sleepH: 7.5 })),
    calm: [1, 2, 3].map(d => ({ at: NOW - d * DAY })),
    brain: { drills: [1, 2, 3].map(d => ({ kind: 'speed', at: NOW - d * DAY, ms: 200 })), reviews: [1, 2, 4].map(d => ({ at: NOW - d * DAY })), games: [], lessons: {}, quran: {} },
  };
  const full = B.brainScore(S, NOW);
  check('a full week → 100', full.score === 100, JSON.stringify(full.pillars));
  const lazy = B.brainScore({ ...S, sessions: [], calm: [] }, NOW);
  check('no exercise → score drops and the fix is to move', lazy.score < 60 && /Train or do cardio/.test(lazy.fix), `${lazy.score}`);
  const noSleep = B.brainScore({ ...S, readiness: [] }, NOW);
  check('no sleep data → sleep left out, not counted as zero', noSleep.pillars.sleep == null && noSleep.score === 100);
  check('short sleep lowers the sleep pillar', B.sleepPoints(5) < 30 && B.sleepPoints(8) === 100);
  check('old activity (over 7 days) doesn\'t count', B.brainScore({ ...S, sessions: [{ at: NOW - 9 * DAY }] }, NOW).pillars.move === 0);
}

// Next brain step
{
  check('nothing done → Speed Flash session 1 of 10', /session 1 of 10/.test(B.brainNext({}, [], NOW).title));
  const S = { brain: { drills: [{ kind: 'speed', at: NOW - 60e3, ms: 200 }], quran: { 's112:1': { box: 1, due: NOW - 1 } } } };
  check('speed done today, verse due → review', B.brainNext(S, [], NOW).kind === 'quran');
  S.brain.quran['s112:1'].due = NOW + DAY;
  check('then a lesson', B.brainNext(S, [], NOW).kind === 'lesson');
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nbrain: all passed');
