// Brain: the speed drill, brain games, Quran memorisation (spaced review), short lessons and the Brain score.
// Pure functions and data only, unit tested (tests/brain.test.mjs). The screen is js/brainui.js.
//
// What the evidence supports (SCIENCE.md §13):
// - Speed-of-processing training is the one drill with long-term evidence (ACTIVE trial, 20-year follow-up, 2026):
//   about 25% fewer dementia diagnoses, but only with booster sessions. Memory and reasoning drills showed no effect.
// - General brain games improve the game itself, rarely anything else (Simons et al. 2016). They are here because
//   they are fun and get people to come back; the app never claims they protect the brain.
// - What protects the brain most is the rest of the app: exercise, sleep, calm, health checks and other people.

const DAY = 864e5;
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const within = (list, now, days = 7) => (list || []).filter(x => x.at > now - days * DAY && x.at <= now);
const distinctDays = list => new Set(list.map(x => dayKey(x.at))).size;

/* ---------- Speed drill (like the "useful field of view" training used in ACTIVE) ----------
   Each trial flashes a target in the centre (which car?) and a star at the edge (where was it?), then a mask.
   Both answers right = correct. The flash gets shorter after 2 correct in a row and longer after a miss
   (a 2-down / 1-up staircase, which settles where you're right about 71% of the time). */
export const SPEED = { startMs: 500, minMs: 17, maxMs: 750, trials: 24, down: 0.8, block: 10, booster: 4, boosterDays: 90, distractorsBelowMs: 120, positions: 8 };

export class Staircase {
  constructor(ms = SPEED.startMs) { this.ms = ms; this.run = 0; this.dir = 0; this.reversals = []; this.n = 0; this.right = 0; }
  answer(ok) {
    this.n++; if (ok) this.right++;
    let dir = 0;
    if (ok) { if (++this.run >= 2) { this.run = 0; dir = -1; } } else { this.run = 0; dir = 1; }
    if (!dir) return this.ms;
    if (this.dir && dir !== this.dir) this.reversals.push(this.ms);
    this.dir = dir;
    this.ms = Math.round(clamp(dir < 0 ? this.ms * SPEED.down : this.ms / SPEED.down, SPEED.minMs, SPEED.maxMs));
    return this.ms;
  }
  /** Threshold: the mean of the last 6 reversals (or the current flash time if there aren't 2 yet). */
  threshold() { const r = this.reversals.slice(-6); return Math.round(r.length >= 2 ? r.reduce((a, b) => a + b, 0) / r.length : this.ms); }
  accuracy() { return this.n ? Math.round(100 * this.right / this.n) : 0; }
}

/** 0–100 speed level from a flash time: 500 ms = 0, 17 ms (one frame) = 100, on a log scale. */
export const speedLevel = ms => Math.round(clamp(100 * (Math.log(SPEED.startMs) - Math.log(ms)) / (Math.log(SPEED.startMs) - Math.log(SPEED.minMs))));

/** Where to start today: a little easier than last time's threshold. */
export function speedStart(drills = []) {
  const last = [...drills].filter(d => d.kind === 'speed').sort((a, b) => b.at - a.at)[0];
  return last ? Math.round(clamp(last.ms * 1.4, SPEED.minMs * 3, SPEED.startMs)) : SPEED.startMs;
}
export const useDistractors = ms => ms < SPEED.distractorsBelowMs;

/** One trial: centre target (0 car, 1 truck), edge position 0–7, and distractor positions when the level is high. */
export function speedTrial(ms, rand = Math.random) {
  const pos = Math.floor(rand() * SPEED.positions);
  return { centre: rand() < 0.5 ? 0 : 1, pos, ms, distractors: useDistractors(ms) ? 6 : 0 };
}

/** Training plan: a first block of 10 sessions (as in ACTIVE), then a 4-session booster every 3 months. */
export function speedProgram(drills = [], now = Date.now()) {
  const s = drills.filter(d => d.kind === 'speed').sort((a, b) => a.at - b.at);
  if (s.length < SPEED.block) return { phase: 'block', done: s.length, of: SPEED.block, due: true };
  // After the block: boosters. Count the sessions since the last block or booster finished.
  let since = s[SPEED.block - 1].at, count = 0;
  for (const d of s.slice(SPEED.block)) {
    if (d.at - since > SPEED.boosterDays * DAY * 0.8 || count) { count++; if (count >= SPEED.booster) { since = d.at; count = 0; } }
  }
  if (count) return { phase: 'booster', done: count, of: SPEED.booster, due: true };
  const next = since + SPEED.boosterDays * DAY;
  return now >= next ? { phase: 'booster', done: 0, of: SPEED.booster, due: true } : { phase: 'maintain', done: 0, of: 0, due: false, nextAt: next };
}

/* ---------- Games ---------- */

/** Memory Grid: remember the order tiles light up in (a spatial memory span). */
export const GRID = { size: 16, startSpan: 3, maxSpan: 12, lives: 2 };
export function gridSequence(span, rand = Math.random) {
  const out = [];
  while (out.length < span) { const t = Math.floor(rand() * GRID.size); if (t !== out[out.length - 1]) out.push(t); }
  return out;
}
/** After each round: right → one longer; wrong → lose a life, same length. Ends with no lives left. */
export function gridNext(st, ok) {
  const s = { ...st };
  if (ok) { s.best = Math.max(s.best || 0, s.span); s.span = Math.min(GRID.maxSpan, s.span + 1); } else s.lives--;
  s.over = s.lives <= 0 || (ok && s.best >= GRID.maxSpan);
  return s;
}

/** Colour Clash: tap the colour of the ink, not the word (the Stroop test). */
export const CLASH = { seconds: 45, colours: [
  { id: 'red', word: 'RED', hex: '#D9534F' }, { id: 'green', word: 'GREEN', hex: '#2E8B62' },
  { id: 'blue', word: 'BLUE', hex: '#3B6FD6' }, { id: 'gold', word: 'GOLD', hex: '#C9961A' }] };
export function clashTrial(rand = Math.random) {
  const n = CLASH.colours.length, ink = Math.floor(rand() * n);
  const word = rand() < 0.35 ? ink : (ink + 1 + Math.floor(rand() * (n - 1))) % n;
  return { word, ink, match: word === ink };
}
/** Score: correct answers minus wrong ones, plus how much slower the tricky (mismatched) words were. */
export function clashScore(trials) {
  const ok = trials.filter(t => t.ok), mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const rtMatch = mean(ok.filter(t => t.match).map(t => t.rt)), rtClash = mean(ok.filter(t => !t.match).map(t => t.rt));
  return { score: Math.max(0, ok.length - (trials.length - ok.length)), right: ok.length, wrong: trials.length - ok.length,
    meanRT: ok.length ? Math.round(mean(ok.map(t => t.rt))) : null, interference: rtMatch != null && rtClash != null ? Math.round(rtClash - rtMatch) : null };
}

export const GAMES = [
  { id: 'speed', name: 'Speed Flash', sub: 'Spot the car, find the star. The drill with long-term evidence.', minutes: 4, proven: true },
  { id: 'grid', name: 'Memory Grid', sub: 'Repeat the pattern. It grows each time you get it right.', minutes: 3 },
  { id: 'clash', name: 'Colour Clash', sub: 'Tap the ink, not the word. 45 seconds of focus.', minutes: 1 },
  { id: 'order', name: 'Verse Order', sub: 'Put the words of a verse you\'re learning back in order.', minutes: 2, quran: true },
];
/** Personal best per game, for the game cards. */
export function bests(games = []) {
  const b = {};
  for (const g of games) if (g.score != null && (b[g.game] == null || g.score > b[g.game])) b[g.game] = g.score;
  return b;
}

/* ---------- Quran memorisation: spaced review ----------
   The way huffaz have always worked: learn a little, then keep reviewing it (muraja'ah) on a schedule.
   Each verse moves up a box when you recite it well, so its next review is further away. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60, 120];
export const MEMORISED_BOX = 4; // reviewed well 4 times, at least 2 weeks apart by the end

export const cardId = (setId, a) => `${setId}:${a}`;
/** grade: 'again' (couldn't recite it) | 'hard' (with mistakes) | 'good' (from memory). */
export function review(card, grade, now = Date.now()) {
  const c = { box: 0, seen: 0, ...card };
  c.box = grade === 'again' ? 1 : grade === 'hard' ? Math.max(1, c.box) : Math.min(BOX_DAYS.length - 1, c.box + 1);
  c.seen++; c.last = now;
  const start = new Date(now); start.setHours(4, 0, 0, 0); // a review is due from 4 am on its day
  c.due = start.getTime() + BOX_DAYS[c.box] * DAY;
  return c;
}
export const isDue = (c, now = Date.now()) => c && c.due <= now;
export function dueCards(cards = {}, now = Date.now()) {
  return Object.entries(cards).filter(([, c]) => isDue(c, now)).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
}
/** Per set: how many verses started and memorised. */
export function setProgress(set, cards = {}) {
  let started = 0, memorised = 0;
  for (const a of set.ayahs) { const c = cards[cardId(set.id, a.a)]; if (c) { started++; if (c.box >= MEMORISED_BOX) memorised++; } }
  return { started, memorised, total: set.ayahs.length, pct: Math.round(100 * memorised / set.ayahs.length) };
}

// Arabic diacritics and Quranic annotation marks (harakat, superscript alef, small high signs, waqf marks).
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
/** Words of a verse, without stand-alone pause marks. */
export const words = ar => ar.split(/\s+/).filter(w => w.replace(MARKS, '').length);
/** First-letter cue for the fading exercise: the first letter with its vowel, then a line. */
export function cue(word) {
  const m = word.match(/^.[ؐ-ًؚ-ٰٟ]*/u);
  return (m ? m[0] : word[0]) + 'ـ';
}
/** Fading: at level 0 all words show; each level hides more of them (from the end of the verse first). */
export function fade(ws, level) {
  const hide = Math.min(ws.length, Math.ceil(ws.length * level / 3));
  return ws.map((w, i) => ({ w, hidden: i >= ws.length - hide }));
}
/** Verse Order: shuffled words with their correct positions. Never returns the verse already in order. */
export function shuffleWords(ws, rand = Math.random) {
  const idx = ws.map((_, i) => i);
  for (let tries = 0; tries < 10; tries++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.length < 2 || idx.some((v, i) => v !== i)) break;
  }
  return idx.map(i => ({ i, w: ws[i] }));
}
/** Long verses are split into chunks of about 8 words for the order game. */
export function chunks(ws, size = 8) {
  const n = Math.ceil(ws.length / size), per = Math.ceil(ws.length / n), out = [];
  for (let i = 0; i < ws.length; i += per) out.push(ws.slice(i, i + per));
  return out;
}

/* ---------- Lessons: one idea, one action, one recall question ---------- */
export const LESSONS = [
  { id: 'plastic', title: 'Your brain can change', mins: 2, go: 'speed',
    body: ['Your brain rewires itself every day. Connections you use get stronger; ones you don\'t, fade. This is called neuroplasticity, and it continues at every age.',
      'It needs three things: a challenge just beyond what\'s easy, repetition, and sleep to lock it in.'],
    action: 'Do one Speed Flash session today.',
    quiz: { q: 'What locks in what your brain learned today?', options: ['Coffee', 'Sleep', 'Scrolling'], answer: 1 } },
  { id: 'exercise', title: 'Training grows your memory centre', mins: 2, go: 'train',
    body: ['In a year-long trial, older adults who walked briskly 3 times a week grew their hippocampus (the brain\'s memory centre) by about 2%. The group that only stretched lost about 1.4%.',
      'Exercise raises BDNF, a protein that helps brain cells grow and connect. Cardio and strength training both count.'],
    action: 'Get your heart rate up for 20–30 minutes, three times this week.',
    quiz: { q: 'In the trial, what happened to the memory centre of people who did cardio?', options: ['It grew', 'It shrank', 'No change'], answer: 0 } },
  { id: 'sleep', title: 'Sleep cleans and saves', mins: 2, go: null,
    body: ['During deep sleep your brain replays the day and moves memories into long-term storage. It also clears waste that builds up while you\'re awake.',
      'Adults need 7–9 hours. A fixed wake-up time helps most, even at weekends.'],
    action: 'Tonight: phone away 30 minutes before bed, same wake-up time tomorrow.',
    quiz: { q: 'How much sleep do most adults need?', options: ['5–6 hours', '7–9 hours', '10+ hours'], answer: 1 } },
  { id: 'stress', title: 'Stress steals your focus', mins: 2, go: 'calm',
    body: ['Under stress the brain shifts from careful thinking to quick reactions. Short bursts are normal; constant stress makes focus and memory worse.',
      'Slow breathing, about 6 breaths a minute, calms the system within minutes. "Verily, in the remembrance of Allah do hearts find rest." (13:28)'],
    action: 'Do a 5-minute Sukoon session when you feel tense.',
    quiz: { q: 'What breathing pace calms the body fastest?', options: ['Fast and shallow', 'About 6 breaths a minute', 'Holding your breath'], answer: 1 } },
  { id: 'speed', title: 'The one drill with long-term evidence', mins: 2, go: 'speed',
    body: ['In the ACTIVE trial, 2,800 older adults did about 10 hours of speed training. Twenty years later, those who also did booster sessions had about 25% fewer dementia diagnoses.',
      'Memory and reasoning drills in the same trial showed no effect, and speed training without boosters didn\'t either. That\'s why Speed Flash has a first block and then boosters.'],
    action: 'Finish your first block: 10 Speed Flash sessions.',
    quiz: { q: 'In ACTIVE, what made speed training protective?', options: ['Booster sessions', 'Playing at night', 'Any brain game'], answer: 0 } },
  { id: 'games', title: 'The truth about brain games', mins: 2, go: 'games',
    body: ['Most brain games make you better at that game, and not much else. A review of over 130 studies found little evidence that they improve everyday thinking. One big brain-games company was fined for claiming otherwise.',
      'Play them because they\'re fun and get your brain working. Count on exercise, sleep and speed training to protect it.'],
    action: 'Play one game for fun, then do something from your plan.',
    quiz: { q: 'What do most brain games mainly improve?', options: ['Everything', 'The game itself', 'Your IQ'], answer: 1 } },
  { id: 'spacing', title: 'Memory loves spacing', mins: 2, go: 'quran',
    body: ['Reviewing something just as you\'re about to forget it is the most reliable way to remember it for life. Each review can be further apart.',
      'Huffaz have always worked like this: new lessons plus regular review (muraja\'ah). The Prophet ﷺ said to keep reciting the Quran, because it slips away faster than a camel from its rope (Bukhari 5033, Muslim 791). "And We have certainly made the Qur\'an easy for remembrance, so is there any who will remember?" (54:17)'],
    action: 'Learn one verse today and review what\'s due.',
    quiz: { q: 'When is the best time to review something?', options: ['Straight after learning it', 'Just before you forget it', 'Never'], answer: 1 } },
  { id: 'food', title: 'Food for your brain', mins: 2, go: 'food',
    body: ['The MIND diet links green leafy vegetables, berries, nuts, beans, olive oil and fish with slower brain ageing. It limits fried and fast food, sweets and butter.',
      'Dates, olive oil and figs, foods mentioned in the Quran, fit right in.'],
    action: 'Add one portion of leafy greens and a handful of nuts today.',
    quiz: { q: 'Which is part of the MIND diet?', options: ['Leafy greens', 'Fried food', 'Sweets'], answer: 0 } },
  { id: 'risks', title: 'Ears, eyes and heart', mins: 2, go: 'vitals',
    body: ['The Lancet Commission (2024) lists 14 things that together are linked to about 45% of dementia cases. Many are easy to check: hearing loss, untreated vision loss, high blood pressure, high LDL cholesterol, diabetes and smoking.',
      'Hearing aids and glasses, when you need them, are brain protection.'],
    action: 'If you haven\'t this year: get your eyes, hearing, blood pressure and cholesterol checked.',
    quiz: { q: 'Which of these is a risk you can fix?', options: ['Untreated hearing loss', 'Your age', 'Your genes'], answer: 0 } },
  { id: 'people', title: 'People keep your brain young', mins: 2, go: null,
    body: ['Loneliness is one of the 14 risk factors. Conversation, shared meals and helping others give the brain some of its richest workouts.',
      'Praying in congregation, visiting family and training with a friend all count. A structured, coached programme also beat going it alone in the US POINTER trial (2025).'],
    action: 'This week: train with a friend, or call someone you haven\'t spoken to in a while.',
    quiz: { q: 'Which is one of the 14 dementia risk factors?', options: ['Loneliness', 'Reading', 'Walking'], answer: 0 } },
];
/** The next lesson to read, and lessons ready for a recall question (read 2+ days ago, not yet recalled). */
export function lessonQueue(lessons = {}, now = Date.now()) {
  const next = LESSONS.find(l => !lessons[l.id]);
  const recall = LESSONS.filter(l => lessons[l.id]?.read && !lessons[l.id].recalled && now - lessons[l.id].read >= 2 * DAY);
  return { next, recall, read: LESSONS.filter(l => lessons[l.id]).length };
}

/* ---------- Brain score: how well this week looked after your brain ----------
   It rewards the habits with evidence (exercise, sleep, calm, speed training, learning), not game scores. */
const PILLARS = {
  move: { name: 'Move', w: 0.3, fix: 'Train or do cardio three times this week. It\'s the strongest brain protector.' },
  sleep: { name: 'Sleep', w: 0.2, fix: 'Aim for 7–9 hours with a fixed wake-up time.' },
  calm: { name: 'Calm', w: 0.15, fix: 'Three 5-minute Sukoon sessions this week.' },
  drill: { name: 'Speed & games', w: 0.2, fix: 'Three Speed Flash sessions this week.' },
  learn: { name: 'Learn & remember', w: 0.15, fix: 'Review your Quran verses or read a lesson on 3 days this week.' },
};
export const PILLAR_NAMES = Object.fromEntries(Object.entries(PILLARS).map(([k, v]) => [k, v.name]));

export function sleepPoints(h) { return h == null ? null : h >= 7 && h <= 9.5 ? 100 : h > 9.5 ? 80 : clamp(100 - (7 - h) * 40); }

export function brainScore(S, now = Date.now()) {
  const B = S.brain || {};
  const ever = (B.drills || []).length + (B.games || []).length + Object.keys(B.lessons || {}).length + Object.keys(B.quran || {}).length;
  const moveDays = distinctDays([...within(S.sessions, now).filter(s => !s.demo), ...within(S.classes, now)]);
  const sleeps = within(S.readiness, now).map(r => +r.sleepH).filter(h => h > 0);
  const sleepH = sleeps.length >= 2 ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;
  const calm = within(S.calm, now).length;
  const speed = within(B.drills, now).filter(d => d.kind === 'speed').length, games = within(B.games, now).filter(g => g.game !== 'speed').length;
  const learnDays = distinctDays([...within(B.reviews, now), ...Object.values(B.lessons || {}).filter(l => l.read).map(l => ({ at: l.read })).filter(x => x.at > now - 7 * DAY)]);
  const p = {
    move: clamp(100 * moveDays / 3),
    sleep: sleepPoints(sleepH),
    calm: clamp(100 * calm / 3),
    drill: clamp(100 * (speed + 0.5 * games) / 3),
    learn: clamp(100 * learnDays / 3),
  };
  const keys = Object.keys(p).filter(k => p[k] != null), w = keys.reduce((a, k) => a + PILLARS[k].w, 0);
  const score = ever ? Math.round(keys.reduce((a, k) => a + p[k] * PILLARS[k].w, 0) / w) : null;
  const low = keys.slice().sort((a, b) => (p[a] - p[b]) || (PILLARS[b].w - PILLARS[a].w))[0];
  return {
    score, pillars: Object.fromEntries(Object.keys(p).map(k => [k, p[k] == null ? null : Math.round(p[k])])),
    fix: score == null ? 'Do one Speed Flash session to get your Brain score.' : p[low] >= 100 ? 'Everything is on track this week. Keep it going.' : PILLARS[low].fix,
    detail: { moveDays, sleepH: sleepH == null ? null : Math.round(sleepH * 10) / 10, calm, speed, games, learnDays },
  };
}

/** The one brain thing to do now, for the Brain screen and Today. */
export function brainNext(S, quranSets = [], now = Date.now()) {
  const B = S.brain || {}, today = dayKey(now);
  const doneToday = list => (list || []).some(x => dayKey(x.at) === today);
  const prog = speedProgram(B.drills, now), due = dueCards(B.quran, now).length;
  if (prog.due && !(B.drills || []).some(d => d.kind === 'speed' && dayKey(d.at) === today))
    return { kind: 'speed', title: prog.phase === 'block' ? `Speed Flash · session ${prog.done + 1} of ${prog.of}` : `Booster · session ${prog.done + 1} of ${prog.of}`, sub: 'About 4 minutes. The drill with long-term evidence.', cta: 'Start Speed Flash' };
  if (due) return { kind: 'quran', title: `Review ${due} verse${due === 1 ? '' : 's'}`, sub: 'Due today. Recite from memory, then check.', cta: 'Review now' };
  const { next } = lessonQueue(B.lessons, now);
  if (next && !Object.values(B.lessons || {}).some(l => l.read && dayKey(l.read) === today)) return { kind: 'lesson', id: next.id, title: next.title, sub: `A ${next.mins}-minute lesson.`, cta: 'Read' };
  if (!doneToday(B.games)) return { kind: 'game', title: 'Play a brain game', sub: 'Memory Grid or Colour Clash: a few minutes of fun.', cta: 'Play' };
  return { kind: 'done', title: 'Brain work done for today', sub: 'Learn a new verse, or rest. Sleep is when it all sticks.', cta: 'Learn a verse' };
}
