// Sukoon calm-session logic. Run: node tests/sukoon.test.mjs
import { PATTERNS, GOALS, AYAH_COUNT, SURAH, EVIDENCE, RECITERS, playlist, ayahUrl, ayahUrls, silentWav, binauralPair, breathAt, breathsPerMin, needsSupport, summarize } from '../js/sukoon.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

check('9 goals with unique ids', GOALS.length === 9 && new Set(GOALS.map(g => g.id)).size === 9);
check('every passage is a real verse range', GOALS.every(g => g.passages.every(([s, a, b]) => SURAH[s] && a >= 1 && b >= a && b <= AYAH_COUNT[s])),
  GOALS.flatMap(g => g.passages).map(p => p.join(':')).join(' '));
check('every goal has a meaning, a dua and a source', GOALS.every(g => g.meaning && g.key && g.dua?.t && g.dua?.m && /Bukhari|Tirmidhi|Quran|Dawud|Majah|Muslim/.test(g.dua.src)));
check('every goal has an evidence rating with text', GOALS.every(g => EVIDENCE[g.evidence]));
check('432 / 528 / 7.83 Hz are never rated better than weak', GOALS.filter(g => [432, 528].includes(g.carrier) || g.beat === 7.83).every(g => g.evidence === 'weak'));
check('band names match beat rates', GOALS.every(g => ({ Delta: g.beat < 4, Theta: g.beat >= 4 && g.beat < 8, Alpha: g.beat >= 8 && g.beat < 13, Gamma: g.beat >= 30 })[g.band]));

check('ayah URL format', ayahUrl(94, 5) === 'https://everyayah.com/data/Alafasy_128kbps/094005.mp3');
check('every reciter has backup sources on Quran.com', RECITERS.every(r => ayahUrls(94, 5, r.id).length === 3), ayahUrls(94, 5).join(' '));
check('backup source path format', ayahUrls(94, 5)[1] === 'https://verses.quran.com/Alafasy/mp3/094005.mp3');
check('playlist items carry all sources, EveryAyah first', playlist(GOALS[0]).every(x => x.urls.length === 3 && x.urls[0] === x.url));
const wav = silentWav(), txt = (o, n) => String.fromCharCode(...wav.slice(o, o + n));
check('unlock clip is a valid silent WAV', txt(0, 4) === 'RIFF' && txt(8, 4) === 'WAVE' && txt(36, 4) === 'data' && wav.length === 844 && wav.slice(44).every(x => x === 128));
const sharh = playlist(GOALS.find(g => g.id === 'anxiety'));
check('surah from verse 1 opens with the basmala', sharh[0].basmala && sharh[0].url.endsWith('001001.mp3') && sharh.length === 9);
const fatiha = playlist(GOALS.find(g => g.id === 'healing'));
check('Al-Fatiha: no extra basmala (verse 1 is the basmala)', fatiha.length === 7 && !fatiha.some(x => x.basmala));
const hujurat = playlist(GOALS.find(g => g.id === 'backbiting'));
check('mid-surah passage: no basmala', hujurat.length === 2 && !hujurat[0].basmala && hujurat[0].a === 11);
const envy = playlist(GOALS.find(g => g.id === 'envy'));
check('two surahs: each gets its basmala', envy.filter(x => x.basmala).length === 2 && envy.length === 13);

const bp = binauralPair(10, 200);
check('binaural: ears differ by exactly the beat', bp.right - bp.left === 10 && (bp.left + bp.right) / 2 === 200);
check('binaural: 40 Hz gamma stays audible', binauralPair(40, 200).left >= 100);

check('pacer: 6 breaths per minute', breathsPerMin() === 6);
check('pacer: breathe in for the first 5 s', breathAt(0).phase === 'in' && breathAt(4.9).phase === 'in');
check('pacer: breathe out from 5 s to 10 s', breathAt(5).phase === 'out' && breathAt(9.9).phase === 'out' && breathAt(10).phase === 'in');
check('pacer: circle fullest at end of inhale, smallest at end of exhale', breathAt(4.999).scale > 0.99 && breathAt(9.999).scale < 0.01 && Math.abs(breathAt(2.5).scale - 0.5) < 1e-9);

const sg = PATTERNS.sigh;
check('cyclic sighing: 2 s in, 1 s top-up, 6 s long breath out', breathAt(1, sg).phase === 'in' && breathAt(2.5, sg).phase === 'top' && breathAt(4, sg).phase === 'out' && breathAt(9.1, sg).phase === 'in');
check('cyclic sighing: lungs 80% full after first breath, 100% after top-up', Math.abs(breathAt(1.999, sg).scale - 0.8) < 0.01 && breathAt(2.999, sg).scale > 0.99 && breathAt(8.999, sg).scale < 0.01);
check('cyclic sighing: about 6.7 breaths a minute', breathsPerMin(sg) === 6.7 && breathsPerMin(PATTERNS.slow) === 6);
check('summary: average heart-rate change from sessions with both readings', summarize([{ before: 6, after: 3, hr: { before: 84, after: 72 } }, { before: 5, after: 4, hr: { before: 80, after: 74 } }, { before: 5, after: 4 }]).hrDrop === 9);
check('support shown at tension 9 and 10 only', needsSupport(9) && needsSupport(10) && !needsSupport(8));
const now = Date.now(), ses = [
  { at: now, goal: 'anxiety', before: 7, after: 4 }, { at: now, goal: 'anxiety', before: 6, after: 3 },
  { at: now, goal: 'sleep', before: 5, after: 5 }, { at: now, goal: 'sleep', before: 6, after: 5 }, { at: now, goal: 'anger', before: 8 },
];
const sum = summarize(ses);
check('summary: ignores unfinished sessions', sum.count === 4);
check('summary: average drop', sum.avgDrop === 1.8, `${sum.avgDrop}`);
check('summary: % of sessions that helped', sum.helpedPct === 75, `${sum.helpedPct}`);
check('summary: best goal needs ≥2 sessions', sum.bestGoal === 'anxiety');
check('summary: empty history', summarize([]).avgDrop === null);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
