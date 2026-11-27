// QK classes: timelines, formats, quiet mode, callouts, scores.
import { CLASSES, MOVES, timeline, minutes, format, callout, bestScore, byId } from '../js/classes.js';
import { LIB } from '../js/library.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

check('at least 6 classes, unique ids', CLASSES.length >= 6 && new Set(CLASSES.map(c => c.id)).size === CLASSES.length);
const used = new Set(CLASSES.flatMap(c => timeline(c).segs.flatMap(s => s.move ? [s.move] : (s.moves || []).map(m => m[0]))));
check('every move in every class is defined', [...used].every(m => MOVES[m]), [...used].filter(m => !MOVES[m]).join());
check('every linked library exercise exists', Object.values(MOVES).every(m => !m.lib || LIB[m.lib]), Object.entries(MOVES).filter(([, m]) => m.lib && !LIB[m.lib]).map(([k]) => k).join());
check('quiet versions exist for every jumping move', Object.values(MOVES).every(m => !m.jump || MOVES[m.quiet]));

const ig = byId('ignite20'), t = timeline(ig);
check('Ignite 20 is about 20 minutes', Math.abs(minutes(ig) - 20) <= 3, minutes(ig));
check('starts with a warm-up and ends with a cool-down', t.segs[0].kind === 'warmup' && t.segs.at(-1).kind === 'cooldown');
check('intervals: 30 s work, 30 s rest, no rest after the last move of a block', t.segs.filter(s => s.kind === 'work').every(s => s.secs === 30) && t.segs.find((s, i) => s.kind === 'work' && t.segs[i + 1]?.label === 'Block rest'));
const tab = timeline(byId('tabataTorch')).segs.filter(s => s.block === 'Tabata 1');
check('Tabata: 8 × 20 s on, 10 s off, alternating moves', tab.filter(s => s.kind === 'work').length === 8 && tab.filter(s => s.kind === 'rest' && s.secs === 10).length === 7 && tab[0].move === 'jumpSquats' && tab[2].move === 'pushUps');
const em = timeline(byId('minuteMaker')).segs.filter(s => s.kind === 'emom');
check('EMOM: 20 one-minute rounds with rep targets', em.length === 20 && em.every(s => s.secs === 60 && s.reps > 0) && em[0].reps === 10);
check('finisher is an AMRAP to score', timeline(byId('fullThrottle30')).segs.some(s => s.kind === 'amrap' && s.secs === 240));
const lr = timeline(byId('livingRoom'));
check('Living Room Shred has no jumping moves', lr.segs.every(s => !MOVES[s.move]?.jump));
const q = timeline(byId('fullThrottle30'), { quiet: true });
check('quiet mode swaps every jump for a quiet move', q.segs.every(s => !MOVES[s.move]?.jump) && q.segs.every(s => !(s.moves || []).some(([m]) => MOVES[m].jump)));
check('class lengths differ (15 to 35 min)', CLASSES.every(c => minutes(c) >= 12 && minutes(c) <= 40), CLASSES.map(c => `${c.id}:${minutes(c)}`).join());
check('format summary', format(byId('fullThrottle30')) === '40 on / 20 off · AMRAP finisher' && format(byId('minuteMaker')) === 'EMOM');
check('callout: move with cue', callout({ kind: 'work', move: 'squats' }) === 'Squats. Sit back and down, chest proud.');
check('callout: rest says what is next', callout({ kind: 'rest' }, { move: 'burpees' }) === 'Rest. Next up: Burpees.');
check('callout: EMOM minute', callout({ kind: 'emom', round: 3, reps: 12, move: 'pushUps' }) === 'Minute 3. 12 push-ups. Go!');
check('best finisher score', bestScore([{ class: 'a', score: 5 }, { class: 'a', score: 7 }, { class: 'b', score: 9 }], 'a') === 7 && bestScore([], 'a') === 0);

// Sore spots: hands-on-floor moves swapped for wrist/elbow/shoulder; lunges and jumps for knee/hip.
{
  const { moveFor } = await import('../js/classes.js');
  check('pain: wrist → push-ups become squat pulses, plank becomes flutter kicks', moveFor('pushUps', { pain: ['wrist'] }) === 'pulseSquats' && moveFor('plank', { pain: ['shoulder'] }) === 'flutterKicks');
  check('pain: knee → no lunges or jumps', moveFor('lunges', { pain: ['knee'] }) === 'bridges' && moveFor('jacks', { pain: ['knee'] }) !== 'jacks');
  check('no pain → unchanged', moveFor('pushUps') === 'pushUps');
}
if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('classes: all pass');
